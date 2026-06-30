# Agent Entry Point — South America 2026 Webapp

> **Read this file first.** It tells you exactly where everything lives so you don't need to re-read source files from scratch.

This is a personal travel planning webapp for an ~80-day South America backpacking trip (Oct 23 2026 – Jan ~10 2027) through Peru, Brazil, and Argentina. It is a **zero-build static site** hosted on GitHub Pages. Friends view `index.html` publicly; the owner edits trip data via `planner.html`.

---

## Read Order for New Agents

| Task | Read first |
|---|---|
| Understanding the data model / localStorage | [DATA.md](DATA.md) |
| Changing UI layout, colors, CSS | [FRONTEND.md](FRONTEND.md) |
| Modifying the admin planner page | [PLANNER.md](PLANNER.md) |
| Any edit at all (avoid breaking things) | [CONVENTIONS.md](CONVENTIONS.md) |
| Where a specific feature lives | "Where to Edit X" table below |

---

## Where to Edit X

| Feature / Area | File | Key Functions | ~Lines |
|---|---|---|---|
| **Trip data / stops schema** | `tripdata.js` | `DEFAULT_TRIP_DATA` const | 1–end |
| **Date cascade computation** | `app.js` | `computeTrip()` | 27–39 |
| **Load trip from localStorage** | `app.js` | `loadTripData()` | 41–48 |
| **Global TRIP runtime object** | `app.js` | `let TRIP = computeTrip(...)` | 50 |
| **Header stats / legend dates** | `app.js` | `populatePageStats()` | 118–155 |
| **Leaflet map init, markers, polylines** | `app.js` | `initMap()` | 160–395 |
| **Animated route drawing (SVG stroke)** | `app.js` | `animatePathDraw()` inside `initMap()` | 230–250 |
| **Curved flight arcs between legs** | `app.js` | `curvedArc()` inside `initMap()` | 255–310 |
| **Map marker popup content** | `app.js` | inside `initMap()` — `TRIP.stops.forEach` | 315–360 |
| **Map style switcher (dark/light/satellite)** | `app.js` | `setTileLayer()` inside `initMap()` | 370–395 |
| **Tour mode (play/pause/next/prev)** | `app.js` | `initTourMode()` | 400–620 |
| **Tour: animated plane traveler** | `app.js` | `animateTraveler()`, `makeTravelerIcon()` | 450–520 |
| **Timeline calendar grid** | `app.js` | `buildTimeline()` | 710–810 |
| **Timeline day click detail** | `app.js` | `showTimelineDetail()` | 815–870 |
| **Live weather (Open-Meteo)** | `app.js` | `fetchAndRenderWeather()`, `fetchWeatherForCoords()` | 875–960 |
| **Destination flip cards** | `app.js` | `renderCards()`, `initTabs()` | 965–1050 |
| **Friends panel** | `app.js` | `initFriends()`, `renderFriends()`, `loadFriends()` | 1055–1165 |
| **Friend overlap timeline chart** | `app.js` | `renderFriendOverlap()` | 1200–1260 |
| **Share card modal** | `app.js` | `initShareCard()` | 1265–1320 |
| **Notes (add/delete/filter)** | `app.js` | `initNotes()`, `renderNotes()` | 1325–1420 |
| **Sidebar navigation / section switching** | `app.js` | `showSection()`, `initSideNav()` | 1455–1555 |
| **Theme toggle (dark/light mode)** | `app.js` | `initThemeToggle()` | 1560–1575 |
| **Countdown widget (map overlay)** | `app.js` | `initCountdown()` | 1665–1720 |
| **Budget tracker (estimates + charts)** | `app.js` | `calcBudgetEstimates()`, `renderBudgetCharts()` | 1725–end |
| **All CSS variables and theming** | `style.css` | `:root` block | 1–45 |
| **Header / topbar styles** | `style.css` | `#site-header`, `.topbar` | 50–120 |
| **Sidebar styles** | `style.css` | `.sidebar`, `.sidebar-nav` | 130–200 |
| **Light mode overrides** | `style.css` | `body.light-mode` | 270–310 |
| **Planner stop list + drag-drop** | `planner.js` | `renderStopList()`, `setupDragDrop()` | 110–240 |
| **Planner edit panel (all fields)** | `planner.js` | `openEditPanel()`, `saveEditPanel()` | 245–375 |
| **Planner add/delete/duplicate** | `planner.js` | `addStop()`, `deleteStop()`, `duplicateStop()` | 375–445 |
| **Planner export → tripdata.js** | `planner.js` | `exportTripData()` | 450–510 |
| **Planner init + event wiring** | `planner.js` | `initPlanner()` | 520–590 |
| **Service worker / PWA caching** | `sw.js` | install/activate/fetch listeners | 1–55 |
| **PWA manifest** | `manifest.json` | — | 1–end |

---

## Glossary

| Term | Meaning |
|---|---|
| **leg** | One country segment of the trip. Values: `"peru"`, `"brazil"`, `"argentina"`. Controls color-coding throughout the app. |
| **stop** | One city visit. An object in `DEFAULT_TRIP_DATA.stops[]`. Has `id`, `city`, `leg`, `emoji`, `coords`, `nights`, `accommodation`, `activities`, `food`, `budgetPerDay`, `transport`. |
| **TRIP** | The global runtime object in `app.js` (line ~50). Created by `computeTrip(loadTripData())`. Contains computed `startDate`/`endDate` on every stop. Never stored — always re-computed on load. |
| **DEFAULT_TRIP_DATA** | The `const` exported by `tripdata.js`. Single source of truth for the original itinerary. Used as fallback if localStorage is absent or corrupt. |
| **computeTrip(raw)** | `app.js` ~line 27. Takes raw data (no dates on stops) and returns a new object with `startDate`/`endDate` cascaded from cumulative `nights`. |
| **loadTripData()** | `app.js` ~line 41. Reads `la_aventura_trip` from localStorage, validates, falls back to `DEFAULT_TRIP_DATA`. |
| **la_aventura_trip** | localStorage key for the stop itinerary. Shape: `{ startDate, stops[] }`. |
| **la_aventura_friends** | localStorage key for the friends array. Shape: `[{ id, name, legs, dates, color, note }]`. |
| **la_aventura_notes** | localStorage key for the group notes array. Shape: `[{ id, author, text, leg, type, date }]`. |
| **escapeHTML / esc** | XSS-prevention helper. `escapeHTML()` is in `app.js`; `esc()` is the equivalent in `planner.js`. Always use when rendering user-supplied strings to the DOM. |
| **section / page-section** | `index.html` uses a SPA-style layout where only one `<section class="page-section">` has `.active` at a time. `showSection(id)` handles the switch. |
| **LEGS / LEGS_META** | Constants in `app.js` / `planner.js` mapping leg keys to `{ name, color, flag }`. Colors differ slightly from CSS variables — see [FRONTEND.md](FRONTEND.md). |
