# Design Document
## SKYBOARD — City Weather Board

| | |
|---|---|
| **Document owner** | Design |
| **Status** | Draft v1.0 |
| **Last updated** | July 2026 |
| **Related docs** | Product Requirements Document, Technical Requirements Document |

---

## 1. Design Concept

SKYBOARD borrows its visual language from **airport departure boards**: dark background, monospaced digits, amber accent color, and a "flip" animation on every value update — evoking the physical split-flap boards that tick over to show a new flight, gate, or status. The metaphor fits naturally: searching a city and seeing its conditions "post" to the board feels like checking a departure for a real trip, which reinforces the app's secondary goal of giving a sense of *place*, not just numbers.

**Design principles:**
1. **Numbers feel alive.** Every data update animates, so re-searching feels responsive rather than a static page reload.
2. **Place before data.** The searched city's name, region, and a real photo are the visual anchor; the numeric board sits underneath, secondary to the place itself.
3. **Never blank, never broken-looking.** Every state (loading, success, no-photo-found, place-not-found) has an intentional visual treatment — nothing renders as an empty box or raw error text.

## 2. Visual System

### 2.1 Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--charcoal` | `#12141a` | Page background |
| `--panel` | `#1b1e27` | Search bar / rain-strip surface |
| `--panel-line` | `#2c303c` | Borders, dividers |
| `--amber` | `#f5a623` | Primary accent — temperature, search button, brand mark |
| `--amber-dim` | `#a97327` | Secondary labels (region eyebrow, search label) |
| `--sky` | `#5dd0e8` | Condition text, focus outlines |
| `--paper` | `#edf0f5` | Primary text |
| `--mist` | `#8b93a7` | Secondary/muted text (labels, descriptions) |
| `--rain-yes` | `#6fb3ff` | Rain-likely state |
| `--rain-no` | `#7fd99a` | No-rain state |

The palette is deliberately low-saturation and dark, so the background photo of the searched place — regardless of what's in it — always reads clearly against the UI rather than competing with a bright interface.

### 2.2 Typography

| Role | Font | Notes |
|---|---|---|
| Data/numerics | **Space Mono** | Monospaced, used for temperature, all board row values, wind/pressure figures — reinforces the "digital board" feel and keeps digits visually aligned |
| Headings & body | **Archivo** | Used for the city name, brand name, and descriptive text; a heavier grotesk that contrasts with the mono data |

City names use a large, bold Archivo weight (up to `clamp(2rem, 6vw, 3.6rem)`) so the place itself is the most visually dominant element on the page — bigger than the temperature.

### 2.3 Iconography

- Weather condition icon: OpenWeatherMap's own icon set (`@2x` PNG), loaded dynamically per condition code.
- Rain outlook icon: a simple emoji-based icon (`☂` while checking, `🌧` if rain is expected, `☀` if not) — kept lightweight, no icon library dependency.
- Brand mark: a plane emoji (`✈`), reinforcing the "departure board" concept without needing a custom logo asset.

## 3. Layout

### 3.1 Structure (single column, top to bottom)

```
┌───────────────────────────────────────────────┐
│  ✈ SKYBOARD                                    │  ← brand + tagline
│  live conditions, anywhere on the map          │
├───────────────────────────────────────────────┤
│  DEPARTURE CITY   [ search input ]   [SEARCH]  │  ← search row
├───────────────────────────────────────────────┤
│  (inline status/error line — only when needed) │
├───────────────────────────────────────────────┤
│  STATE · COUNTRY                     ☁ icon    │
│  City Name (large)                    27 °C    │  ← hero row
│  Short place description         OVERCAST CLOUDS│
│                                       26° / 28° │
├───────────────────────────────────────────────┤
│  ☂  RAIN EXPECTED TODAY              65%       │  ← rain outlook strip
│     Based on today's 3-hour forecast           │
├───────────────────────────────────────────────┤
│  HUMIDITY                              35 %    │
│  CLOUD COVER                           86 %    │  ← split-flap data table
│  PRESSURE                          1026 hPa    │     (8 rows)
│  SEA LEVEL / GROUND LEVEL / WIND SPEED /       │
│  WIND DIRECTION / WIND GUST                    │
├───────────────────────────────────────────────┤
│  Photo: <place> — Wikipedia (small credit line)│
└───────────────────────────────────────────────┘
```

The full background behind this content is the searched place's photo, dimmed with a top-to-bottom dark gradient overlay so text stays legible at every scroll position, brightest near the hero and darkest by the data table.

### 3.2 Responsive Behavior

- Below 640px width: the hero row's right-hand temperature block moves to left-aligned, stacked below the city name instead of beside it; the rain-outlook strip wraps its content rather than staying in one row.
- The search row wraps its label/input/button onto multiple lines on very narrow viewports rather than truncating.

## 4. Component Inventory

| Component | Purpose | Key states |
|---|---|---|
| **Search row** | Text input + submit button | default, focused (amber underline / sky outline) |
| **Status line** | Inline feedback below search | hidden, "looking up…", error (red text) |
| **Hero row** | Place identity + headline weather | populated, empty/reset ("—" placeholders) |
| **Rain outlook strip** | Same-day rain verdict | checking (neutral), rain expected (blue), no rain (green), unavailable (neutral) |
| **Split-flap data table** | 8 detail rows (humidity → wind gust) | each value re-plays a flip animation on update |
| **Background photo layer** | Sense-of-place visual | condition-tinted gradient (always present) + photo (when loaded) + map (last-resort fallback) |
| **Photo credit line** | Attribution | Wikipedia credit, OpenStreetMap fallback credit, or hidden if nothing loaded |

## 5. Interaction Design

1. **Search submit** (button click or Enter key) triggers the full lookup chain; the status line immediately shows "Looking up {query}…" so the app never feels unresponsive during the geocoding/photo cascade.
2. **Successful result:** hero, rain strip, and all data rows update together; each numeric value replays its flip animation regardless of whether the value actually changed, so every search feels like a fresh "posting" to the board.
3. **Failed result:** the status line shows a specific, actionable message (e.g. suggesting the user add a state/country), and the entire board resets to neutral placeholders — deliberately avoiding the earlier failure mode where an error message could appear alongside a previous search's stale data, which was confusing.
4. **Photo load:** background image swaps in only after it has fully loaded (via an offscreen `Image()` preload), avoiding a flash of a broken image or layout shift.

## 6. Accessibility

- Status line uses `aria-live="polite"` so screen readers announce lookup progress and errors without needing focus to move.
- Interactive elements (search input, submit button) have visible focus outlines using the `--sky` accent color, distinct from the default hover states.
- A `prefers-reduced-motion` media query disables the flip animation and background transition for users who have that preference set.
- Text contrast is maintained against the photo background at every point via the dark gradient overlay, rather than relying on the photo's own brightness.

## 7. Content & Copy Guidelines

- Row labels are short, all-caps, and monospaced (e.g. `WIND DIRECTION`, not `Wind Direction (°)`), consistent with the departure-board metaphor.
- Error copy is always specific and actionable ("Try adding the state or country, e.g. …") rather than a generic "not found."
- The place description under the city name uses the first one to two sentences of the matched Wikipedia extract, kept short enough not to compete visually with the numeric board below it.
- Photo credit is honest about its source and quality: it explicitly says when a map is shown in place of a photo ("no photo was available for this place"), rather than presenting it as equivalent to a real photo.

## 8. Design Rationale — Notable Decisions

| Decision | Why |
|---|---|
| Dark theme over light | Keeps varied, unpredictable background photos (any place, any lighting) visually consistent and text always legible |
| Monospace for all data, not just some | Consistent digit width avoids layout jitter as values update via the flip animation |
| State/country shown as a small eyebrow line, not a separate section | Keeps the hero visually simple while still resolving ambiguity between same-named places |
| Rain outlook as its own distinct strip, not folded into the data table | It's the single most actionable piece of information in the app and deserves a stronger visual treatment (color-coded, larger type) than a plain data row |
| Map as final photo fallback rather than a solid color/icon | Preserves the "give a sense of place" goal even when no photo exists anywhere in the cascade |
