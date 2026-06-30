# Conventions — Rules to Avoid Breaking Things

> Read this before making ANY edit. Many things that look safe aren't.

---

## Hard Constraints (Never Violate)

| Rule | Why |
|---|---|
| **No npm, no build step, no bundler** | Site is served directly from the filesystem / GitHub Pages as static files. Adding a build step requires changing the entire deployment model. |
| **All libraries via CDN only** | Leaflet, Google Fonts. No local copies. |
| **No backend** | Everything is client-side. No server-side rendering, no API keys in server, no Node.js. |
| **`tripdata.js` must be a plain JS file defining `const DEFAULT_TRIP_DATA`** | It is loaded via `<script src="tripdata.js">` before `app.js` and `planner.js`. It creates a global variable. It must NOT use `import`, `export`, `module.exports`, or any ES module syntax. |
| **Script load order in HTML** | `tripdata.js` → then `app.js` or `planner.js`. Swapping this order breaks everything — `DEFAULT_TRIP_DATA` won't exist when the main script runs. |
| **Do not rename localStorage keys** | `la_aventura_trip`, `la_aventura_friends`, `la_aventura_notes`, `la_aventura_expenses`, `la_aventura_theme`. Users already have data under these keys. Renaming causes silent data loss and fallback to defaults. |

---

## Encoding Rules (Critical — Most Common Source of Corruption)

### The core problem
PowerShell on Windows uses code page 1252 (cp1252) by default. If you write to a file using PowerShell's built-in string operations (e.g. `Set-Content`, `Out-File` without explicit `-Encoding UTF8`), emoji and special characters get corrupted into sequences like `ðŸŒŽ` (mojibake).

### Rules for agents

1. **Write emoji as literal UTF-8 characters** in all files. Never as `\uXXXX` Unicode escapes.
   - ✅ `"emoji": "🏙️"` in tripdata.js
   - ❌ `"emoji": "\uD83C\uDFD9\uFE0F"`

2. **Never write to source files using PowerShell string operations.** Use:
   - The VS Code file-edit tools (replace_string_in_file, create_file) — these handle UTF-8 correctly.
   - Python: `open('file.js', 'w', encoding='utf-8').write(content)` — always specify encoding.

3. **The flag-emoji-in-gradient-text workaround.** Flag emoji (🇵🇪 🇧🇷 🇦🇷) inside an element that has `-webkit-text-fill-color: transparent` (gradient text headings) become invisible. Fix:
   ```html
   <span style="-webkit-text-fill-color:initial;background:none">🇵🇪🇧🇷🇦🇷</span>
   ```
   Already applied in `index.html` `.topbar-title` and `.sidebar-flags`.

4. **After writing any file that contains emoji**, verify it immediately:
   ```python
   with open('filename.js', 'rb') as f:
       raw = f.read()
   # Look for corruption — cp1252-mojibake produces sequences starting with 0xC3
   if b'\xc3\xb0\xc5\xb8' in raw:
       print("CORRUPTED — contains mojibake")
   # Or simpler: decode as UTF-8 and check a known emoji
   txt = raw.decode('utf-8')
   assert '🌎' in txt or '🏙️' in txt, "Emoji check failed"
   ```

5. **Recovering corrupted files**: If you see `ðŸ` or `?Y` sequences in file content, the file has been corrupted through cp1252. See user memory note: recover with Windows-1252 bytes → UTF-8 decode (not ISO-8859-1) to avoid data loss for characters like œ/€.

---

## Change-Safety Checklist

Before adding any feature, verify these:

- [ ] **localStorage keys unchanged** — are you introducing any new key? Use a new distinct name. Never modify the 5 existing key names.
- [ ] **`tripdata.js` format preserved** — export must still produce a file that starts with `/* ... */` comment and then `const DEFAULT_TRIP_DATA =` followed by valid JSON + `;`. The planner's `exportTripData()` function generates this — don't change the format unless you also update the export function.
- [ ] **Script load order unchanged in HTML** — `tripdata.js` must remain the first `<script>` tag before `app.js` or `planner.js`.
- [ ] **`computeTrip()` contract** — the function expects `raw.startDate` (string) and `raw.stops[]` each with a `nights` number. If you add new stop fields, they pass through fine. If you change `nights` to something else, all date computation breaks.
- [ ] **`collapsible/section state`** — sections use `.active` class and `showSection(id)`. If you add a new section, add a corresponding `.sidebar-nav-item[data-section="your-id"]` and handle ambient palette in `AMBIENT_PALETTES` if used.
- [ ] **`escapeHTML` / `esc` always used for user content** — any string from localStorage, user input, or stop fields rendered to innerHTML must go through `escapeHTML()` (app.js) or `esc()` (planner.js). Never render raw strings directly.
- [ ] **Leaflet map size** — if you hide/show the map section or change its CSS dimensions, call `map.invalidateSize()` after the CSS transition. `showSection('map-section')` already does this (app.js ~line 1500). Don't remove it.
- [ ] **CDN scripts** — if adding a new CDN library, add it to `sw.js`'s `APP_SHELL` array only if it's same-origin. CDN scripts are cached by the service worker's cache-first fallback anyway.

---

## Things That Look Safe But Aren't

| Action | Problem |
|---|---|
| Adding a `type="module"` attribute to any script tag | Breaks `DEFAULT_TRIP_DATA` global — modules have their own scope |
| Adding `export` or `import` to `app.js` or `planner.js` | Same — makes them modules, breaks global TRIP and DEFAULT_TRIP_DATA access |
| Changing `"la_aventura_trip"` string anywhere | Silent data loss for users with existing localStorage |
| Using `innerHTML` with un-escaped user strings | XSS vulnerability — always use `escapeHTML()` |
| Calling `map.fitBounds()` before `initMap()` runs | `map` is undefined until `initMap()` is called on DOMContentLoaded |
| Modifying `TRIP.stops` directly | `TRIP` is the computed runtime object. Mutations don't persist — they're lost on reload. To persist changes, modify the planner or call `saveData()` in planner.js |
| Writing emoji via PowerShell `Set-Content` | Encodes as cp1252 → corrupts emoji to mojibake |
| Removing the `void emojiEl.offsetWidth` line in tour mode | Forces DOM reflow; removing it breaks the CSS bounce animation |
| Setting `currentTileLayer` to null before calling `removeLayer` | Will cause a null-reference error; always check `if (currentTileLayer)` first (already done) |
| Adding a new `.page-section` without a sidebar nav item | Section becomes unreachable from the UI |

---

## Git / Deployment Workflow

```powershell
# Required every new PowerShell terminal session:
$env:PATH = $env:PATH + ";C:\Program Files\Git\bin"

# Navigate to project:
Set-Location "C:\Users\smazzadi\OneDrive\Personal Files\Travel Folder\South America 2026"

# Stage, commit, push:
git add .
git commit -m "descriptive message"
git push
```

- GitHub Pages deploys in **~30–90 seconds** after push.
- Deployment status: `https://github.com/stefanmazzadi/South-America-2026/actions`
- After deploying: hard refresh with `Ctrl+Shift+R` to bypass browser cache.
- Live URL: `https://stefanmazzadi.github.io/South-America-2026`

### Undoing a bad commit (safe)
```powershell
git revert HEAD
git push
```
`git revert` adds a new commit that undoes the last one — it does NOT rewrite history.

**Do NOT use `git reset --hard` or `git push --force`** without confirming with the user first.

---

## Service Worker / PWA Notes

`sw.js` caches the app shell (`index.html`, `style.css`, `app.js`, `planner.js`, `tripdata.js`, `manifest.json`) under cache key `la-aventura-v1`.

- **Cache version:** if you need to force all users to get a fresh cache (e.g., after a major update), increment the `CACHE_NAME` constant in `sw.js`.
- **Old cache cleanup:** the `activate` handler deletes any cache key that isn't `CACHE_NAME`. This is already correct — don't add exceptions.
- **API calls** to `open-meteo.com` and `er-api.com` are network-first (weather + currency). Everything else is cache-first.
- The service worker does NOT cache Leaflet CDN tiles — they have their own HTTP caching.
