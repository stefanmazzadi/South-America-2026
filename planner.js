/* ============================================================
   TRIP PLANNER — planner.js
   Interactive backend for editing the South America 2026 trip.
   DEFAULT_TRIP_DATA is loaded from tripdata.js (script above).
   Saves to localStorage key 'la_aventura_trip'.
   ============================================================ */

'use strict';

const LEGS_META = {
  peru:      { name: 'Peru',      color: '#E8834A', flag: '🇵🇪' },
  brazil:    { name: 'Brazil',    color: '#22a447', flag: '🇧🇷' },
  argentina: { name: 'Argentina', color: '#5b9bd5', flag: '🇦🇷' },
};

// ── State ─────────────────────────────────────────────────────
let tripData   = null;   // { startDate, stops: [...] }
let editingId  = null;   // id of stop being edited in side panel
let isDirty    = false;  // unsaved changes
let dragSrcIdx = null;   // source index during drag

// ── Date helpers ───────────────────────────────────────────────
function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtShort(dateObj) {
  return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Compute sequential startDate/endDate for each stop based on nights. */
function computeDates(data) {
  let cursor = parseDate(data.startDate);
  return data.stops.map(s => {
    const sd = dateToStr(cursor);
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + s.nights);
    return { startDate: sd, endDate: dateToStr(cursor) };
  });
}

// ── Security ───────────────────────────────────────────────────
function esc(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Storage ────────────────────────────────────────────────────
function loadData() {
  try {
    const raw = localStorage.getItem('la_aventura_trip');
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.startDate && Array.isArray(data.stops) && data.stops.length > 0) {
        return data;
      }
    }
  } catch { /* fall through */ }
  return JSON.parse(JSON.stringify(DEFAULT_TRIP_DATA));
}

function saveData() {
  localStorage.setItem('la_aventura_trip', JSON.stringify(tripData));
  isDirty = false;
  updateSaveBtn();
  showToast('✓ Changes saved — switch to the main page to see them.');
}

function markDirty() {
  isDirty = true;
  updateSaveBtn();
}

function updateSaveBtn() {
  const btn = document.getElementById('save-btn');
  if (isDirty) {
    btn.textContent = '💾 Save Changes ●';
    btn.style.boxShadow = '0 0 0 2px rgba(232,131,74,0.5)';
  } else {
    btn.textContent = '💾 Save Changes';
    btn.style.boxShadow = '';
  }
}

// ── Trip summary stats ─────────────────────────────────────────
function renderSummary() {
  const dates     = computeDates(tripData);
  const totalNights = tripData.stops.reduce((s, c) => s + c.nights, 0);
  const endDate   = dates.length ? parseDate(dates[dates.length - 1].endDate) : parseDate(tripData.startDate);
  const countries = [...new Set(tripData.stops.map(s => s.leg))].length;
  const avgBudget = tripData.stops.length
    ? Math.round(tripData.stops.reduce((s, c) => s + (c.budgetPerDay || 0), 0) / tripData.stops.length)
    : 0;

  document.getElementById('trip-summary').innerHTML = `
    <div class="summary-pills">
      <span class="spill">${totalNights} nights</span>
      <span class="spill">${tripData.stops.length} cities</span>
      <span class="spill">${countries} countr${countries !== 1 ? 'ies' : 'y'}</span>
      <span class="spill">~$${avgBudget}/day avg</span>
    </div>
    <div class="summary-dates">${fmtShort(parseDate(tripData.startDate))} → ${fmtShort(endDate)}</div>
  `;
  document.getElementById('stop-count').textContent = `(${tripData.stops.length})`;
}

// ── Render stop list ───────────────────────────────────────────
function renderStopList() {
  const container = document.getElementById('stop-list');
  const dates = computeDates(tripData);

  container.innerHTML = '';

  if (tripData.stops.length === 0) {
    container.innerHTML = '<p style="padding:1.5rem;text-align:center;color:#8b949e">No stops yet. Add a city to get started!</p>';
    renderSummary();
    return;
  }

  tripData.stops.forEach((stop, idx) => {
    const d      = dates[idx];
    const leg    = LEGS_META[stop.leg] || LEGS_META.peru;
    const active = stop.id === editingId;

    const row = document.createElement('div');
    row.className = 'stop-row' + (active ? ' stop-row--active' : '');
    row.dataset.id  = stop.id;
    row.dataset.idx = idx;
    row.draggable   = true;

    row.innerHTML = `
      <div class="drag-handle" title="Drag to reorder">⠿</div>
      <div class="stop-num">${idx + 1}</div>
      <div class="stop-emoji">${stop.emoji}</div>
      <div class="city-info">
        <div class="city-name">${esc(stop.city)}</div>
        <span class="leg-badge" style="background:${leg.color}22;color:${leg.color};border:1px solid ${leg.color}44">${leg.flag} ${leg.name}</span>
      </div>
      <div class="nights-ctrl">
        <button class="nights-btn" data-id="${stop.id}" data-delta="-1" title="Fewer nights">−</button>
        <span class="nights-val">${stop.nights}<span class="nts-label">n</span></span>
        <button class="nights-btn" data-id="${stop.id}" data-delta="1" title="More nights">+</button>
      </div>
      <div class="dates-preview">${fmtShort(parseDate(d.startDate))} → ${fmtShort(parseDate(d.endDate))}</div>
      <div class="row-actions">
        <button class="row-edit-btn" data-id="${stop.id}" title="Edit details">✏️</button>
        <button class="row-del-btn"  data-id="${stop.id}" title="Remove stop">🗑</button>
      </div>
    `;

    container.appendChild(row);
  });

  // Nights +/- buttons
  container.querySelectorAll('.nights-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const stop = tripData.stops.find(s => s.id === btn.dataset.id);
      if (!stop) return;
      stop.nights = Math.max(1, stop.nights + parseInt(btn.dataset.delta));
      markDirty();
      renderStopList();
      // Keep edit panel nights field in sync if this stop is open
      if (editingId === stop.id) {
        const ni = document.getElementById('e-nights');
        if (ni) ni.value = stop.nights;
      }
    });
  });

  // Edit buttons
  container.querySelectorAll('.row-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditPanel(btn.dataset.id));
  });

  // Delete buttons
  container.querySelectorAll('.row-del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteStop(btn.dataset.id));
  });

  setupDragDrop(container);
  renderSummary();
}

// ── Drag & drop ────────────────────────────────────────────────
function setupDragDrop(container) {
  container.querySelectorAll('.stop-row').forEach((row, idx) => {

    row.addEventListener('dragstart', e => {
      dragSrcIdx = idx;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(idx));
    });

    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      container.querySelectorAll('.drag-over').forEach(r => r.classList.remove('drag-over'));
      dragSrcIdx = null;
    });

    row.addEventListener('dragover', e => {
      e.preventDefault();
      if (dragSrcIdx === null || dragSrcIdx === idx) return;
      container.querySelectorAll('.drag-over').forEach(r => r.classList.remove('drag-over'));
      row.classList.add('drag-over');
    });

    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));

    row.addEventListener('drop', e => {
      e.preventDefault();
      if (dragSrcIdx === null || dragSrcIdx === idx) return;
      const stops = [...tripData.stops];
      const [moved] = stops.splice(dragSrcIdx, 1);
      stops.splice(idx, 0, moved);
      tripData.stops = stops;
      markDirty();
      renderStopList();
    });
  });
}

// ── Edit panel ─────────────────────────────────────────────────
function openEditPanel(stopId, isNew) {
  editingId = stopId;
  const stop = tripData.stops.find(s => s.id === stopId);
  if (!stop) return;

  document.getElementById('edit-panel-title').textContent = isNew ? '✚ New City' : `✏️ ${stop.city}`;

  document.getElementById('edit-form').innerHTML = `
    <div class="ef-row">
      <div class="ef-field ef-field--short">
        <label>Emoji</label>
        <input id="e-emoji" type="text" value="${esc(stop.emoji)}" maxlength="4" class="ef-input">
      </div>
      <div class="ef-field ef-field--grow">
        <label>City Name</label>
        <input id="e-city" type="text" value="${esc(stop.city)}" class="ef-input">
      </div>
    </div>

    <div class="ef-row">
      <div class="ef-field ef-field--grow">
        <label>Country</label>
        <select id="e-leg" class="ef-input">
          <option value="peru"      ${stop.leg === 'peru'      ? 'selected' : ''}>🇵🇪 Peru</option>
          <option value="brazil"    ${stop.leg === 'brazil'    ? 'selected' : ''}>🇧🇷 Brazil</option>
          <option value="argentina" ${stop.leg === 'argentina' ? 'selected' : ''}>🇦🇷 Argentina</option>
        </select>
      </div>
      <div class="ef-field ef-field--short">
        <label>Nights</label>
        <input id="e-nights" type="number" value="${stop.nights}" min="1" max="365" class="ef-input">
      </div>
    </div>

    <div class="ef-row">
      <div class="ef-field">
        <label>Latitude</label>
        <input id="e-lat" type="number" value="${stop.coords[0]}" step="0.0001" class="ef-input">
      </div>
      <div class="ef-field">
        <label>Longitude</label>
        <input id="e-lng" type="number" value="${stop.coords[1]}" step="0.0001" class="ef-input">
      </div>
    </div>
    <p class="ef-hint">💡 Right-click a pin on <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer">Google Maps</a>, then "Copy coordinates"</p>

    <div class="ef-field">
      <label>Accommodation</label>
      <input id="e-accommodation" type="text" value="${esc(stop.accommodation || '')}" class="ef-input" placeholder="e.g. Hostel near center (~$15/night)">
    </div>

    <div class="ef-field">
      <label>Activities <span class="ef-hint-inline">(one per line)</span></label>
      <textarea id="e-activities" rows="7" class="ef-input ef-textarea" placeholder="One activity per line">${esc((stop.activities || []).join('\n'))}</textarea>
    </div>

    <div class="ef-field">
      <label>Food Recommendation</label>
      <input id="e-food" type="text" value="${esc(stop.food || '')}" class="ef-input" placeholder="🍴 Restaurant name — description">
    </div>

    <div class="ef-row">
      <div class="ef-field">
        <label>Budget / Day (USD)</label>
        <input id="e-budget" type="number" value="${stop.budgetPerDay || 40}" min="0" class="ef-input">
      </div>
    </div>

    <div class="ef-field">
      <label>Transport to Next City</label>
      <input id="e-transport" type="text" value="${esc(stop.transport || '')}" class="ef-input" placeholder="e.g. ✈️ Flight to ... (~2 hrs)">
    </div>
  `;

  document.getElementById('edit-panel').classList.add('open');
  // Focus city name on open (small delay to let animation settle)
  setTimeout(() => document.getElementById('e-city')?.focus(), 60);

  // Re-render list to show the active highlight
  renderStopList();
}

function closeEditPanel() {
  editingId = null;
  document.getElementById('edit-panel').classList.remove('open');
  renderStopList();
}

function saveEditPanel() {
  const stop = tripData.stops.find(s => s.id === editingId);
  if (!stop) return;

  const city = document.getElementById('e-city').value.trim();
  if (!city) { alert('City name cannot be empty.'); return; }

  stop.emoji         = document.getElementById('e-emoji').value.trim() || '📍';
  stop.city          = city;
  stop.leg           = document.getElementById('e-leg').value;
  stop.nights        = Math.max(1, parseInt(document.getElementById('e-nights').value) || 1);
  stop.coords        = [
    parseFloat(document.getElementById('e-lat').value) || 0,
    parseFloat(document.getElementById('e-lng').value) || 0,
  ];
  stop.accommodation = document.getElementById('e-accommodation').value.trim();
  stop.activities    = document.getElementById('e-activities').value
                         .split('\n')
                         .map(l => l.trim())
                         .filter(Boolean);
  stop.food          = document.getElementById('e-food').value.trim();
  stop.budgetPerDay  = parseInt(document.getElementById('e-budget').value) || 40;
  stop.transport     = document.getElementById('e-transport').value.trim();

  markDirty();
  closeEditPanel();
  showToast('City updated — click Save Changes to apply.');
}

function deleteStop(id) {
  const stop = tripData.stops.find(s => s.id === id);
  if (!stop) return;
  if (!confirm(`Remove "${stop.city}" from the itinerary?`)) return;
  tripData.stops = tripData.stops.filter(s => s.id !== id);
  if (editingId === id) closeEditPanel();
  markDirty();
  renderStopList();
}

// ── Add new city ───────────────────────────────────────────────
function addStop() {
  const newStop = {
    id:            'stop_' + Date.now(),
    city:          'New City',
    leg:           'peru',
    emoji:         '📍',
    coords:        [-15, -65],
    nights:        3,
    accommodation: '',
    activities:    [],
    food:          '',
    budgetPerDay:  40,
    transport:     '',
  };

  tripData.stops.push(newStop);
  markDirty();
  renderStopList();

  // Scroll to new stop and open edit panel
  setTimeout(() => {
    const lastRow = document.querySelector('#stop-list .stop-row:last-child');
    lastRow?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    openEditPanel(newStop.id, true);
  }, 80);
}

// ── Export tripdata.js ────────────────────────────────────────
async function exportTripData() {
  const content = [
    '/* ============================================================',
    '   tripdata.js  —  South America 2026',
    '   DEFAULT_TRIP_DATA: single source of truth for the trip.',
    '   Generated by Trip Planner on ' + new Date().toLocaleString() + '.',
    '   Loaded by both app.js (main page) and planner.js.',
    '   Stops store only `nights`; dates are computed at runtime.',
    '   ============================================================ */',
    '',
    'const DEFAULT_TRIP_DATA =',
    JSON.stringify(tripData, null, 2) + ';',
  ].join('\n');

  // File System Access API (Chrome/Edge): lets you navigate to the project
  // folder and save directly over the existing tripdata.js.
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'tripdata.js',
        types: [{ description: 'JavaScript file', accept: { 'text/javascript': ['.js'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      showToast('✓ tripdata.js saved! Run: git add tripdata.js && git commit -m "update trip" && git push');
      return;
    } catch (e) {
      if (e.name === 'AbortError') return; // user cancelled
      // fall through to regular download
    }
  }

  // Fallback: standard browser download
  const blob = new Blob([content], { type: 'text/javascript' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'tripdata.js';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('⬇ tripdata.js downloaded — move it to your project folder, then push to GitHub.');
}

// ── Toast ──────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ── Initialise ────────────────────────────────────────────────
function initPlanner() {
  tripData = loadData();

  // Set start date picker value
  document.getElementById('trip-start-date').value = tripData.startDate;

  renderStopList();

  // ── Event listeners ──
  document.getElementById('trip-start-date').addEventListener('change', e => {
    if (e.target.value) {
      tripData.startDate = e.target.value;
      markDirty();
      renderStopList();
    }
  });

  document.getElementById('save-btn').addEventListener('click', saveData);

  document.getElementById('add-stop-btn').addEventListener('click', addStop);

  document.getElementById('edit-close-btn').addEventListener('click', closeEditPanel);

  document.getElementById('edit-save-btn').addEventListener('click', saveEditPanel);

  document.getElementById('edit-delete-btn').addEventListener('click', () => {
    if (editingId) deleteStop(editingId);
  });

  document.getElementById('export-btn').addEventListener('click', exportTripData);

  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('Reset the entire itinerary to the original defaults? All your custom changes will be lost.')) {
      localStorage.removeItem('la_aventura_trip');
      tripData  = JSON.parse(JSON.stringify(DEFAULT_TRIP_DATA));
      isDirty   = false;
      editingId = null;
      document.getElementById('trip-start-date').value = tripData.startDate;
      document.getElementById('edit-panel').classList.remove('open');
      updateSaveBtn();
      renderStopList();
      showToast('Trip reset to original defaults.');
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeEditPanel();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveData();
    }
  });

  // Warn about unsaved changes on page unload
  window.addEventListener('beforeunload', e => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

document.addEventListener('DOMContentLoaded', initPlanner);
