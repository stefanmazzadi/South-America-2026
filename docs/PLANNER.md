# Planner Page — Admin Reference

---

## How planner.html Differs from index.html

| Aspect | `index.html` + `app.js` | `planner.html` + `planner.js` |
|---|---|---|
| Audience | Public (friends) | Owner only (not linked from public page) |
| Purpose | View trip, notes, friends, map | Edit itinerary, reorder stops, export |
| Data load | `loadTripData()` — falls back to DEFAULT | `loadData()` — same fallback logic |
| Data save | Read-only; writes only friends/notes/expenses | `saveData()` writes `la_aventura_trip` to localStorage |
| Map | Full Leaflet map, tour mode, flip cards | No map |
| TRIP global | `let TRIP = computeTrip(loadTripData())` | No `TRIP`; uses `tripData` + `computeDates()` inline |
| Date computation | `computeTrip()` returns full TRIP object | `computeDates()` returns just `[{ startDate, endDate }]` array |
| Security helper | `escapeHTML()` | `esc()` (same logic, different name) |

---

## planner.js Global State

```js
let tripData   = null;   // { startDate, stops[] } — loaded from localStorage or DEFAULT
let editingId  = null;   // string id of stop currently open in edit panel; null if closed
let isDirty    = false;  // true if unsaved changes exist
let dragSrcIdx = null;   // index of stop being dragged (set during dragstart)
```

---

## Function Map

| Function | ~Line | Purpose |
|---|---|---|
| `computeDates(data)` | 40 | Returns `[{ startDate, endDate }]` for each stop; same cascade logic as `computeTrip()` in app.js |
| `esc(str)` | 55 | HTML-escape helper (XSS prevention) |
| `loadData()` | 65 | Read `la_aventura_trip` from localStorage; fallback to `DEFAULT_TRIP_DATA` |
| `saveData()` | 80 | Write `tripData` to localStorage; show toast; clear dirty flag |
| `markDirty()` | 90 | Set `isDirty = true`; update save button appearance |
| `updateSaveBtn()` | 95 | Adds ● and glow to Save button when dirty |
| `renderSummary()` | 105 | Update trip stats pills (nights, cities, countries, avg budget, dates) |
| `renderStopList()` | 120 | Full re-render of stop list rows including dates, buttons |
| `setupDragDrop(container)` | 200 | Attach HTML5 drag-drop listeners to all `.stop-row` elements |
| `openEditPanel(stopId, isNew)` | 245 | Populate and show the right edit panel; highlight active row |
| `closeEditPanel()` | 335 | Clear `editingId`, remove `.open` from `#edit-panel`, re-render list |
| `saveEditPanel()` | 345 | Read all form fields, validate, write to `tripData.stops`, call `closeEditPanel()` |
| `deleteStop(id)` | 380 | Remove stop, show undo toast (6 s window), call `markDirty()` |
| `showUndoToast(message, undoFn)` | 395 | Dynamically creates undo toast in `#toast-container` |
| `duplicateStop(id)` | 430 | Deep-clone stop, assign new id (`stop_` + Date.now()), insert after original |
| `addStop()` | 445 | Push skeleton stop, re-render, scroll to it, auto-open edit panel |
| `exportTripData()` | 450 | Generate `tripdata.js` file content, save via File System Access API or download |
| `showToast(msg)` | 515 | Simple toast via `#toast` element |
| `initPlanner()` | 520 | Load data, set start-date input, render list, wire all event listeners |

---

## Stop List Row

Each stop renders a `.stop-row` div with `data-id` and `data-idx`, `draggable="true"`:

```
⠿  [num]  [emoji]  [city + leg badge]  [− nights +]  [date range]  [✏️ ⧉ 🗑]
```

- **Nights ±** buttons: `button.nights-btn[data-id][data-delta]` — inline update, no panel needed.
- **Edit (✏️):** opens `openEditPanel(id)`.
- **Duplicate (⧉):** calls `duplicateStop(id)`.
- **Delete (🗑):** calls `deleteStop(id)` with undo toast.
- Active stop (edit panel open): row gets `.stop-row--active` class.

---

## Drag & Drop Reorder

`setupDragDrop(container)` (planner.js ~line 200). Pure HTML5 drag-drop, no library.

```
dragstart  → save dragSrcIdx; add .dragging to row
dragover   → prevent default; add .drag-over to target row
dragleave  → remove .drag-over
drop       → splice stops array: remove from dragSrcIdx, insert at target idx
             → markDirty(); renderStopList();
dragend    → cleanup classes
```

---

## Edit Panel Fields

`openEditPanel()` injects the form into `#edit-form`. Fields:

| Field ID | Type | Maps to stop field |
|---|---|---|
| `#e-emoji` | text, maxlength 4 | `stop.emoji` |
| `#e-city` | text | `stop.city` (required — validated on save) |
| `#e-leg` | select | `stop.leg` (peru/brazil/argentina) |
| `#e-nights` | number, min 1 | `stop.nights` |
| `#e-lat` | number, step 0.0001 | `stop.coords[0]` |
| `#e-lng` | number, step 0.0001 | `stop.coords[1]` |
| `#e-accommodation` | text | `stop.accommodation` |
| `#e-activities` | textarea (one per line) | `stop.activities[]` — split on `\n`, trimmed, empty lines removed |
| `#e-food` | text | `stop.food` |
| `#e-budget` | number | `stop.budgetPerDay` |
| `#e-transport` | text | `stop.transport` |

Panel opens/closes via `.open` class on `#edit-panel`. `Esc` key and close/save buttons are wired in `initPlanner()`.

---

## Trip Start Date

`<input id="trip-start-date" type="date">` in the planner header. On `change`, updates `tripData.startDate`, calls `markDirty()` + `renderStopList()`. This re-cascades all stop dates immediately.

---

## Export — Generating tripdata.js

`exportTripData()` (planner.js ~line 450):

1. Reads `la_aventura_friends` from localStorage (falls back to `DEFAULT_TRIP_DATA.friends`).
2. **Notes are NOT exported** — they live only in `la_aventura_notes` localStorage.
3. Builds the file as a string:
   ```js
   /* ===... header comment ===*/
   const DEFAULT_TRIP_DATA =
   { ...JSON.stringify({ ...tripData, friends }, null, 2) };
   ```
4. Tries `window.showSaveFilePicker({ suggestedName: 'tripdata.js' })` — Chrome/Edge only. User navigates to project folder and saves directly.
5. On `AbortError` (user cancelled): returns silently.
6. Fallback: `Blob` + `<a download>` click — user must manually move file to project folder.

After export, the user must run `git add tripdata.js && git commit && git push` to deploy.

---

## Reset

Reset button in planner header calls `localStorage.removeItem('la_aventura_trip')`, deep-copies `DEFAULT_TRIP_DATA`, clears dirty state, and re-renders. Guarded by `confirm()` dialog.

---

## initPlanner() Event Wiring

```
DOMContentLoaded → initPlanner()
  #trip-start-date  change    → update tripData.startDate + renderStopList()
  #save-btn         click     → saveData()
  #add-stop-btn     click     → addStop()
  #edit-close-btn   click     → closeEditPanel()
  #edit-save-btn    click     → saveEditPanel()
  #edit-delete-btn  click     → deleteStop(editingId)
  #export-btn       click     → exportTripData()
  #reset-btn        click     → confirm + reset
  keydown Esc                 → closeEditPanel()
  keydown Ctrl+S              → saveData()
  beforeunload (if dirty)     → browser "unsaved changes" warning
```

---

## Relationship Between Planner and Main Page

When planner calls `saveData()`, it writes to `localStorage['la_aventura_trip']`. If the main page (`index.html`) is open in another tab, the `storage` event fires. `app.js` (~line 52) listens and shows a reload banner:

```js
window.addEventListener('storage', (e) => {
  if (e.key === 'la_aventura_trip' && !document.getElementById('planner-reload-banner')) {
    // Creates fixed banner: "Trip plan updated! ↺ Reload"
  }
});
```
