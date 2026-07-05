# Product Requirements Document (PRD)
## SKYBOARD — City Weather Board

| | |
|---|---|
| **Document owner** | Product |
| **Status** | Draft v1.0 |
| **Last updated** | July 2026 |
| **Related docs** | Technical Requirements Document, Design Document |

---

## 1. Executive Summary

SKYBOARD is a single-page web app that lets a person type in any place — a major city or a small town/village — and see its current weather in full detail, a same-day rain forecast, and a real photo of that place, all presented in a distinctive "airport departure board" visual style.

The product was built to solve two specific gaps found in typical weather-widget apps:
1. Most free weather demos only work reliably for large, well-known cities and fail on smaller towns.
2. Most weather demos show numbers with no sense of place — no visual context for where you're actually looking at.

## 2. Problem Statement

People checking weather for smaller towns, villages, or less-common spellings of a place name (a common issue with transliterated Indian place names, e.g. "Shrawasti" vs. "Shravasti") are frequently told the place "can't be found," even though the place exists and has weather data available. Separately, weather apps rarely show *where* a place is or what it looks like, which matters for users unfamiliar with smaller or foreign locations.

## 3. Goals & Objectives

| Goal | Description |
|---|---|
| G1 | Resolve as many real-world place-name queries as possible, including small towns and inconsistent transliterations |
| G2 | Present complete current weather conditions in one view, without tabs or scrolling to a second screen |
| G3 | Answer the single most common practical question — "will it rain today?" — as a clear yes/no, not just raw numbers |
| G4 | Give visual context for the searched place (a real photo, or a map if no photo exists) |
| G5 | Show which state/region and country the place belongs to, since place names can repeat across regions |
| G6 | Deliver all of this as a lightweight, static, no-login, no-backend web app |

## 4. Target Users

- **Primary:** People in India (and similar regions) checking weather for their own town, a relative's town, or a travel destination — including smaller towns not well covered by mainstream weather apps.
- **Secondary:** Anyone globally who wants a quick, visually engaging single-page weather lookup for any city.

### Persona snapshot
> "I want to check if it's going to rain in my hometown today before I travel there, but every weather app I try says it can't find the town."

## 5. Scope

### In scope
- Free-text city/place search (any spelling, any country)
- Current conditions: temperature (current/min/max), humidity, cloud cover, pressure, sea-level pressure, ground-level pressure, wind speed, wind direction (degrees + compass), wind gust
- Same-day rain outlook with a percentage chance and a clear yes/no verdict
- State/province and country display for the resolved place
- A representative photo of the place (or the surrounding state/country if no local photo exists), with a map as an absolute last-resort visual
- Default view on load (Delhi) so the app is never blank on first visit
- Clear, non-confusing error state when a place genuinely cannot be resolved by any source

### Out of scope (for this version)
- User accounts, saved locations, or search history
- Multi-day / weekly forecast view
- Push notifications or alerts
- Offline support
- Non-English language interface
- Native mobile app (this is a responsive web app only)

## 6. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | User can type a place name and submit via a search button or Enter key | Must |
| FR-2 | App resolves the place to a specific location even with minor misspellings or missing state/country context | Must |
| FR-3 | App displays current temperature, min/max, and a text + icon description of conditions | Must |
| FR-4 | App displays humidity, cloud cover, pressure, sea-level pressure, ground-level pressure | Must |
| FR-5 | App displays wind speed (km/h), wind direction (degrees and compass letters), and wind gust | Must |
| FR-6 | App displays a same-day rain prediction with percentage chance and a plain-language verdict | Must |
| FR-7 | App displays the resolved place's state/province and country | Must |
| FR-8 | App displays a real photo representative of the searched place | Should |
| FR-9 | If no photo exists for the exact place, app shows a photo of the surrounding state, then country, before giving up | Should |
| FR-10 | If no photo exists anywhere in the fallback chain, app shows a map of the coordinates instead of a blank space | Should |
| FR-11 | If a place cannot be resolved at all, app shows a clear, actionable error message and resets the board to a neutral empty state (no stale data left on screen) | Must |
| FR-12 | App loads with a default city (Delhi) shown immediately, with no action required from the user | Should |

## 7. Non-Functional Requirements

- **Performance:** Initial weather result should render within a few seconds on a typical broadband/mobile connection.
- **Reliability:** A single external service being slow or down should not blank the whole app — each data source (weather, rain outlook, photo) fails independently and gracefully.
- **Cost:** Must run entirely on free-tier APIs; no paid infrastructure or backend server required.
- **Portability:** Must run as static files (HTML/CSS/JS) with no build step, so it can be opened directly or hosted anywhere.

## 8. Success Metrics

| Metric | Target |
|---|---|
| Search success rate (place resolved) | Noticeably higher than a single-provider baseline, especially for small/rural place names |
| Rate of "photo not found" (blank visual) | ~0%, since a map fallback guarantees *some* visual |
| User confusion incidents (stale/contradictory data shown after an error) | 0 |
| Time to first meaningful result on load | As fast as the default-city fetch allows |

## 9. Assumptions & Constraints

- The app is a pure front-end project; any API key used is visible to anyone viewing page source. This is an accepted constraint of a no-backend architecture (see Technical Requirements Document for mitigations).
- Relies entirely on third-party free APIs (weather, geocoding, place photos) and their availability/rate limits.
- Primary testing focus is Indian place names, though the design generalizes to any country.

## 10. Risks & Dependencies

| Risk | Impact | Mitigation |
|---|---|---|
| Weather/geocoding API key gets rate-limited or revoked | App stops returning data | Document key restriction steps; keep design portable to swap providers |
| Wikipedia/OpenStreetMap services rate-limit or block high-volume automated use | Photos/geocoding degrade | Cascading fallbacks mean one provider failing doesn't blank the app |
| Very obscure place names with no data in any provider | Search fails | Clear error messaging guides the user to add state/country |

## 11. Future Roadmap (not in current scope)

- Multi-day forecast view
- "Recent searches" (stored client-side only, no accounts)
- Unit toggle (°C/°F, km/h/mph)
- Share-a-city-board link/image export
- Language localization
