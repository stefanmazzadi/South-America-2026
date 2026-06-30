# South America 2026 — Copilot Agent Instructions

> **Agent onboarding:** Read `/docs/README.md` first. It has a "Where to Edit X" lookup table covering every feature and function, a glossary, and links to deep-dive docs for data, frontend, planner, and conventions. This will save you from re-reading source files.

## What this project is
A personal travel planning webapp for a ~80-day South America backpacking trip (Oct 23 2026 – Jan ~10 2027) through Peru, Brazil, and Argentina. Built as a static site hosted on GitHub Pages. Friends can view it live; the owner manages it locally via a planner page.

---

## Live URLs
- **GitHub Pages (public):** `https://stefanmazzadi.github.io/South-America-2026`
- **Local dev server:** `http://localhost:8765` (Python: `python -m http.server 8765`)
- **Git remote:** `https://github.com/stefanmazzadi/South-America-2026.git` — branch `master`

---

## File structure
```
index.html      — Main public trip page (map, timeline, cards, friends, notes)
style.css       — All styling for index.html
app.js          — All JS logic for index.html (~1200 lines)
planner.html    — Admin/planning page (edit stops, drag-reorder, export)
planner.js      — All JS logic for planner.html (~700 lines)
tripdata.js     — Single source of truth: DEFAULT_TRIP_DATA (stops, friends, notes)
.gitignore
copilot-instructions.md  ← this file
```

No build tools. No framework. No npm. Pure vanilla JS + HTML + CSS.

---

## Tech stack
- **Leaflet.js 1.9.4** (CDN) — interactive map, tour mode
- **Google Fonts CDN** — Playfair Display (headings) + Inter (body)
- **localStorage** — 3 keys:
  - `la_aventura_trip` — trip data (stops, startDate)
  - `la_aventura_notes` — notes array
  - `la_aventura_friends` — friends array
- **File System Access API** (`showSaveFilePicker`) — export overwrites `tripdata.js` directly; fallback to download
- **No backend.** Everything is client-side.

---

## Data architecture

### tripdata.js
Defines `DEFAULT_TRIP_DATA` (global const):
```js
const DEFAULT_TRIP_DATA = {
  "startDate": "2026-10-23",
  "stops": [ /* 19 stops, each with id, city, leg, emoji, coords, nights, accommodation, activities[], food, budgetPerDay, transport */ ],
  "friends": [],
  "notes": []
}
```
Stops store only `nights` — no computed dates. `computeTrip()` in app.js cascades dates.

### app.js data flow
```js
function computeTrip(raw)   // cascades startDate/endDate per stop from cumulative nights
function loadTripData()     // reads localStorage or falls back to DEFAULT_TRIP_DATA
let TRIP = computeTrip(loadTripData())  // global, computed on page load
```

### Legs / countries
- `peru` — color `#e63946` (red)
- `brazil` — color `#2d6a4f` (green)
- `argentina` — color `#4361ee` (blue)

---

## Current features (already built)

### index.html / app.js
- **Sticky header** with logo, nav, flags, hamburger mobile menu
- **Hero map** (Leaflet, dark CartoDB tiles) with animated route polylines, city markers, map overlay stats, legend
- **Tour mode** — animated city-by-city playback with slide-in panel
- **Trip Timeline** — calendar grid by week, colored by leg, click day for detail — collapsible, starts collapsed
- **Destinations** — tabbed city cards per leg (Peru/Brazil/Argentina) — collapsible, starts collapsed
- **Travel Buddies** — friend cards with add/edit/delete form, persists to localStorage — collapsible, starts collapsed
- **Trip Notes** — add/delete notes with author, leg tag, type (idea/reminder/food/logistics/must-do), persists to localStorage
- **Export button** — exports entire state (stops + friends + notes) as new `tripdata.js` via File System Access API
- **Dynamic stats** — header date range, map overlay, stat bar (days/countries/cities), legend dates all computed from TRIP data
- **Collapsible sections** — Timeline, Destinations, Friends all toggle on header click with arrow indicator

### planner.html / planner.js
- Full stop list with drag-drop reorder
- Edit panel: change city, leg, nights, emoji, coords, accommodation, activities, food, budget, transport
- Add/delete stops
- Trip start date editor
- Export button (generates tripdata.js including friends from localStorage)
- Reset to defaults
- Save to localStorage

---

## Deployment workflow
```powershell
# Must add git to PATH each terminal session:
$env:PATH = $env:PATH + ";C:\Program Files\Git\bin"
Set-Location "C:\Users\smazzadi\OneDrive\Personal Files\Travel Folder\South America 2026"
git add .
git commit -m "your message"
git push
# GitHub Pages deploys in ~60 seconds. Hard refresh: Ctrl+Shift+R
```

---

## Important constraints
1. **No npm, no build step** — all libraries via CDN only
2. **No backend** — everything must work as static files
3. **Preserve localStorage key names** — changing them breaks existing user data
4. **tripdata.js must remain a plain JS file** defining `DEFAULT_TRIP_DATA` as a `const` — it's loaded via `<script src="tripdata.js">` before app.js and planner.js
5. **Emoji in JS files** — write emoji as literal UTF-8 characters, never as `\uXXXX` escapes (PowerShell cp1252 issues). When writing files use Python or direct file edit tools.
6. **Flag emojis in gradient-text h1** — must be wrapped in `<span style="-webkit-text-fill-color:initial;background:none">` to be visible
7. **Git is at** `C:\Program Files\Git\bin\git.exe` — must prepend to PATH each terminal session

---

## CSS variables (key ones)
```css
--peru: #e63946
--brazil: #2d6a4f  
--argentina: #4361ee
--accent: #f4a261
--dark-1: #0d1117   (page background)
--dark-2: #161b22
--dark-3: #21262d
--dark-4: #30363d
--text-main: #e6edf3
--text-muted: #8b949e
--font-head: 'Playfair Display', serif
--font-body: 'Inter', sans-serif
```

---

## After every feature: commit and push
```powershell
$env:PATH = $env:PATH + ";C:\Program Files\Git\bin"
Set-Location "C:\Users\smazzadi\OneDrive\Personal Files\Travel Folder\South America 2026"
git add .
git commit -m "descriptive message"
git push
```

---

## GitHub Pages — User Guide (enabling live site & seeing changes)

### One-time setup: enabling GitHub Pages
1. Go to `https://github.com/stefanmazzadi/South-America-2026`
2. Click **Settings** (top tab row of the repo)
3. In the left sidebar click **Pages**
4. Under **Source**, select **Deploy from a branch**
5. Set branch to **`master`**, folder to **`/ (root)`** → click **Save**
6. Wait ~60 seconds. Refresh the Pages settings tab — you'll see:
   > "Your site is live at https://stefanmazzadi.github.io/South-America-2026"
7. That URL is permanent and shareable with friends immediately.

> **Already enabled?** If you see the green "Your site is live at…" banner, skip above — nothing to do.

---

### Deploying a change so friends see it

Every time you edit files locally, run these commands in PowerShell to push the update live:

```powershell
# Step 1 — add Git to PATH (required every new terminal session)
$env:PATH = $env:PATH + ";C:\Program Files\Git\bin"

# Step 2 — navigate to project
Set-Location "C:\Users\smazzadi\OneDrive\Personal Files\Travel Folder\South America 2026"

# Step 3 — stage all changed files
git add .

# Step 4 — commit with a description of what changed
git commit -m "describe what you changed here"

# Step 5 — push to GitHub → triggers Pages rebuild
git push
```

After `git push` completes, **GitHub Pages rebuilds in ~30–90 seconds**. There is no manual trigger needed.

---

### Confirming the live site has updated

| Method | How |
|---|---|
| **Check deploy status** | Go to `https://github.com/stefanmazzadi/South-America-2026/actions` — look for a green checkmark on the latest workflow run called "pages build and deployment" |
| **Hard refresh (force reload)** | Open `https://stefanmazzadi.github.io/South-America-2026` → press `Ctrl+Shift+R` (Windows/Chrome) — bypasses browser cache |
| **Incognito window** | Open an incognito/private tab and visit the URL — guaranteed no cache |
| **Check commit is live** | At the bottom of the GitHub Pages settings page, it shows the SHA of the last deployed commit — match it to your latest commit |

> **If changes don't appear after 2 minutes:** always hard refresh first (`Ctrl+Shift+R`). Browser caching is the #1 reason changes seem missing.

---

### Sharing with friends

Send them this link directly — no account or login needed:
```
https://stefanmazzadi.github.io/South-America-2026
```
The site is fully public and works on mobile. Friends can view the map, timeline, destinations, and travel buddies. They **cannot** access the planner page (`/planner.html`) unless they know the URL — it has no password protection, but it is not linked from the public page.

---

### Checking what's currently deployed vs. local

```powershell
$env:PATH = $env:PATH + ";C:\Program Files\Git\bin"
Set-Location "C:\Users\smazzadi\OneDrive\Personal Files\Travel Folder\South America 2026"

# See all uncommitted local changes
git status

# See last 5 commits (top = most recent)
git log --oneline -5

# See if local is ahead of GitHub
git fetch
git status   # will say "Your branch is ahead by N commits" if not pushed yet
```

---

### Troubleshooting

| Problem | Fix |
|---|---|
| `git` not found | Run `$env:PATH = $env:PATH + ";C:\Program Files\Git\bin"` first |
| Push rejected | Run `git pull` first, then push again |
| Site shows old version | Hard refresh `Ctrl+Shift+R`, or wait another 60 seconds |
| Pages not building | Check `https://github.com/stefanmazzadi/South-America-2026/actions` for red error |
| Accidentally committed bad code | Tell the AI agent to `git revert HEAD` — this undoes the last commit safely |
