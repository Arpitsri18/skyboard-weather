# Technical Requirements Document (TRD)
## SKYBOARD — City Weather Board

| | |
|---|---|
| **Document owner** | Engineering |
| **Status** | Draft v1.0 |
| **Last updated** | July 2026 |
| **Related docs** | Product Requirements Document, Design Document |

---

## 1. Overview

SKYBOARD is a static, client-only web application — three files (`index.html`, `style.css`, `script.js`), no build step, no backend, no database. All data comes from free third-party HTTP APIs called directly from the browser. This document specifies the architecture, data flow, external integrations, and engineering decisions behind the app.

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Markup | Plain HTML5 | Single page, semantic structure |
| Styling | Plain CSS3 | No framework/preprocessor; CSS custom properties for theming |
| Logic | Vanilla JavaScript (ES2020+, `async/await`, `fetch`) | No framework, no bundler |
| Fonts | Google Fonts — Space Mono (data/numerics), Archivo (headings/body) | Loaded via `<link>`, no local hosting |
| Hosting model | Static files; works from `file://` or any static host (no server-side code) | |

No package manager, transpiler, or build pipeline is required — the app runs as-is in any modern browser.

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser (client)                     │
│                                                               │
│  index.html  ──renders──▶  DOM elements (hero, rows, strip)  │
│  style.css   ──styles───▶  DOM                                │
│  script.js   ──orchestrates all data fetching & DOM updates  │
│                                                               │
└───────────────┬───────────────┬───────────────┬─────────────┘
                │               │               │
        (geocoding)      (weather data)   (place photo)
                │               │               │
   ┌────────────▼───┐  ┌────────▼────────┐  ┌───▼─────────────┐
   │ Open-Meteo Geo  │  │ OpenWeatherMap  │  │ Wikipedia        │
   │ Nominatim (OSM) │  │ (current +      │  │ (MediaWiki API)  │
   │ OpenWeatherMap  │  │  5-day/3-hr     │  │ staticmap.       │
   │ Geocoding       │  │  forecast)      │  │ openstreetmap.de │
   └─────────────────┘  └─────────────────┘  └──────────────────┘
```

There is no server component. Every API call is made directly from `script.js` using `fetch()`. All state lives in memory (DOM + JS variables) for the duration of the page session; nothing is persisted.

## 4. External API Integrations

### 4.1 Geocoding (place name → coordinates + state/country)

Resolving a typed place name to a real location is the highest-risk step (see Product Requirements Document, FR-2), so three providers are chained in order of coverage breadth:

| Order | Provider | Endpoint | Why |
|---|---|---|---|
| 1 | Open-Meteo Geocoding | `GET https://geocoding-api.open-meteo.com/v1/search?name={query}&count=10&language=en&format=json` | Free, keyless, broad global place database; returns multiple candidates so a best-match can be chosen |
| 2 | Nominatim (OpenStreetMap) | `GET https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=1&addressdetails=1` | Deepest coverage of very small villages/towns not present in the above |
| 3 | OpenWeatherMap Geocoding | `GET https://api.openweathermap.org/geo/1.0/direct?q={query}&limit=1&appid={key}` | Final fallback; also retried once with `,IN` appended for bare small-town names |

**Spelling-variant handling:** Before calling any provider, the query is expanded into spelling variants by swapping `v ↔ w` (e.g. "Shrawasti" → also tries "Shravasti"), since this is a very common transliteration inconsistency for Indian place names. Each provider is tried against all variants before moving to the next provider.

**Best-match selection (Open-Meteo step):** Since Open-Meteo can return several candidates, each candidate's name is scored against the user's query using a lightweight character-overlap similarity function (see §6.1), and the highest-scoring candidate is selected — this prevents picking an unrelated same-country result over the intended one.

**Output contract** (normalized across all three providers before use):
```js
{ name: string, state: string|null, country: string /* ISO code */, lat: number, lon: number }
```

### 4.2 Weather Data

| Purpose | Endpoint |
|---|---|
| Current conditions | `GET https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={key}&units=metric` |
| Same-day rain outlook | `GET https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={key}&units=metric` |

Both calls use **coordinates**, not the raw place-name string — this is deliberate. OpenWeatherMap's name-based weather lookup is comparatively strict and was the original source of "place not found" failures; looking up by the coordinates already resolved during geocoding is far more reliable.

### 4.3 Place Photo

A single combined MediaWiki API call is used per candidate (search + thumbnail + intro text in one round trip, rather than chaining separate search/summary requests, which is more failure-prone):

```
GET https://en.wikipedia.org/w/api.php
  ?action=query
  &generator=search&gsrsearch={candidate}&gsrlimit=1
  &prop=pageimages|extracts
  &exintro=1&explaintext=1&exchars=400
  &pithumbsize=1600
  &format=json&origin=*
```

**Escalation order** — tries each candidate until one returns a usable thumbnail:
1. Resolved place name (e.g. "Shravasti")
2. Place name + state (e.g. "Shravasti, Uttar Pradesh")
3. State alone (e.g. "Uttar Pradesh")
4. Country (full name, resolved from ISO code via `Intl.DisplayNames`)

**Guaranteed final fallback:** If no level in the cascade returns an image (rare, but possible for very obscure places with no Wikipedia coverage at all), a keyless static map centered on the coordinates is used instead, so the UI never shows a blank visual panel:
```
https://staticmap.openstreetmap.de/staticmap.php?center={lat},{lon}&zoom=11&size=1200x700&maptype=mapnik
```

## 5. Core Application Flow

```
User submits search
      │
      ▼
geocodeCity(query)
      │  (spelling variants × 3 providers, see §4.1)
      ▼
place resolved? ──No──▶ resetBoard() + show actionable error message
      │ Yes
      ▼
fetch current weather by lat/lon ──fails──▶ show error, keep board reset
      │ succeeds
      ▼
populate hero (temp, condition, icon), state/country line, all data rows
      │
      ├──▶ getRainOutlook(lat, lon)   [async, non-blocking]
      │
      └──▶ getPlacePhoto(name, state, country, lat, lon)   [async, non-blocking]
                  │
                  ▼
            apply background image + credit line
```

Rain outlook and photo lookup run **independently** of the main weather render and of each other — neither blocks the other, and a failure in either only degrades that one piece of UI (see §7).

## 6. Key Algorithms

### 6.1 Name similarity scoring
Used to pick the best candidate among multiple geocoding results. Approach:
1. Normalize both strings (lowercase, strip non-letters).
2. Exact match → score 1.
3. Substring containment → score = shorter length / longer length.
4. Otherwise, character-overlap ratio (greedy multiset intersection) / longer length.

This is intentionally simple (no external library) since it only needs to rank a handful of same-language candidates, not perform general-purpose fuzzy text search.

### 6.2 Rain outlook aggregation
1. Fetch the 5-day/3-hour forecast for the resolved coordinates.
2. Determine "today" in the **place's own local time** using the `city.timezone` offset returned by the API (not the browser's local time), so the outlook is correct regardless of where the user is physically located.
3. Filter forecast entries to those matching today's date; if none fall within today (e.g. very late in the day), fall back to the next few available slots.
4. Compute the maximum precipitation probability (`pop`) across those slots, and flag rain likely if that probability is ≥ 40% or if any slot's weather condition code falls in the rain/drizzle/thunderstorm ranges (200–599).

### 6.3 Split-flap update animation
Each data row's value is wrapped in a CSS class toggle (`flip`) on every update, triggering a short `rotateX` keyframe animation reminiscent of an airport departure board flipping to a new value. The animation is removed and re-added (via a forced reflow) on each search so it replays even if the value is unchanged.

## 7. Error Handling & Resilience

| Failure point | Behavior |
|---|---|
| All three geocoders fail | User sees a specific, actionable message suggesting they add state/country; entire board resets to a neutral empty state — no stale data from a previous search is left visible |
| Weather API fails after successful geocoding | Error message shown; board reset |
| Forecast API fails (rain outlook) | Rain strip shows "outlook unavailable" without affecting the rest of the board |
| Wikipedia photo lookup fails at every cascade level | Static map fallback is used instead of leaving the background blank |
| Network failure of any kind | Caught explicitly; user sees a plain-language network error rather than a silent failure or console-only error |

## 8. Security Considerations

- The OpenWeatherMap API key is embedded in client-side JavaScript and is therefore visible to anyone viewing page source. This is an inherent limitation of a pure front-end, no-backend architecture, not an oversight.
- **Recommended mitigation (documented in-code and to the user):** restrict the API key by HTTP referrer/domain in the OpenWeatherMap dashboard once the app is deployed to a fixed domain, and monitor usage there.
- **Production-grade alternative (not implemented in this version):** proxy all OpenWeatherMap calls through a minimal backend so the key never reaches the browser at all. Out of scope for the current static-app version by product decision (see Product Requirements Document, §9).
- Geocoding/photo providers used (Open-Meteo, Nominatim, Wikipedia, OpenStreetMap static maps) do not require any secret key, so they carry no equivalent exposure risk.

## 9. Performance Considerations

- All non-essential data (rain outlook, photo) fetches run in parallel with, not blocking, the primary weather render — the user sees temperature and core stats as soon as possible.
- Geocoding/photo cascades short-circuit as soon as a provider succeeds, so the common case (well-known city, first provider succeeds) incurs no extra latency from the fallback chain.
- No images, fonts, or scripts are bundled; Google Fonts and all API responses are fetched over the network on each load (acceptable for a lightweight static app with no build step).

## 10. Browser/Runtime Compatibility

- Requires a browser with `fetch`, `async/await`, and `Intl.DisplayNames` support (all evergreen browsers: current Chrome, Edge, Firefox, Safari).
- CSS uses custom properties and `backdrop-filter`; graceful degradation is acceptable (blur effects simply won't render) on older browsers, but core functionality is unaffected.
- Tested primarily via `file://` execution and standard static hosting; both are supported since no server-side logic is required.

## 11. Known Limitations

- Client-exposed API key (see §8).
- No offline mode — every search requires network access to at least the geocoding and weather providers.
- Nominatim's public instance has an informal rate limit (~1 request/second); acceptable for individual/low-traffic use but not suitable as-is for high-traffic production deployment without switching to a self-hosted or commercial Nominatim instance.
- Photo relevance depends on Wikipedia coverage; extremely obscure places will fall back to a state/country photo or a plain map rather than a location-specific image.

## 12. Testing Approach

- Pure logic functions (similarity scoring, spelling-variant generation, wind-compass mapping, rain-code classification, rain-outlook aggregation, country-code resolution) are unit-testable in isolation with mock API response shapes, independent of live network access.
- DOM wiring is verified by cross-checking every `getElementById` reference in `script.js` against actual `id` attributes in `index.html`, and every CSS class/state toggled from JS against selectors defined in `style.css`.
- Live end-to-end verification requires a network environment with access to the four external domains listed in §4; this should be performed in the actual deployment/browser environment.
