/* ============================================================
   THE ADVENTURE — SOUTH AMERICA 2026
   app.js — Map, Timeline, Cards, Notes, Friends, Tour Mode
   Trip data lives in tripdata.js (DEFAULT_TRIP_DATA).
   User edits are stored in localStorage key 'la_aventura_trip'.
   ============================================================ */

'use strict';

// ─────────────────────────────────────────────────────────────
// LEGS METADATA (countries)
// ─────────────────────────────────────────────────────────────
const LEGS = {
  peru:      { name: 'Peru',      color: '#E8834A', flag: '🇵🇪' },
  brazil:    { name: 'Brazil',    color: '#22a447', flag: '🇧🇷' },
  argentina: { name: 'Argentina', color: '#5b9bd5', flag: '🇦🇷' },
};

// ─────────────────────────────────────────────────────────────
// TRIP DATA — loaded from localStorage or DEFAULT_TRIP_DATA
// computed dates from tripdata.js (loaded before this script)
// ─────────────────────────────────────────────────────────────

/** Build the full TRIP runtime object from raw data (adds computed dates). */
function computeTrip(raw) {
  let cursor = parseDate(raw.startDate);
  const stops = raw.stops.map(s => {
    const sd = dateToStr(cursor);
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + s.nights);
    return { ...s, startDate: sd, endDate: dateToStr(cursor) };
  });
  return { startDate: raw.startDate, endDate: dateToStr(cursor), legs: LEGS, stops };
}

function loadTripData() {
  try {
    const raw = localStorage.getItem('la_aventura_trip');
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.startDate && Array.isArray(data.stops) && data.stops.length > 0) return data;
    }
  } catch { /* fall through to default */ }
  return JSON.parse(JSON.stringify(DEFAULT_TRIP_DATA));
}

let TRIP = computeTrip(loadTripData());

// Show reload banner when planner saves new data in another tab
window.addEventListener('storage', (e) => {
  if (e.key === 'la_aventura_trip' && !document.getElementById('planner-reload-banner')) {
    const b = document.createElement('div');
    b.id = 'planner-reload-banner';
    b.innerHTML = '✏️ Trip plan updated! <button onclick="location.reload()" style="margin-left:0.5rem;background:rgba(255,255,255,0.25);border:none;color:#fff;padding:0.2rem 0.8rem;border-radius:999px;cursor:pointer;font-weight:700">↺ Reload</button>';
    b.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#E8834A;color:#fff;text-align:center;padding:0.75rem 1rem;z-index:9999;font-size:0.9rem;';
    document.body.appendChild(b);
  }
});

// UTILITY HELPERS
// ─────────────────────────────────────────────────────────────
function parseDate(str) {
  // Returns midnight UTC-safe date
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(dateObj) {
  return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateObj) {
  return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Returns the stop active on a given date string 'YYYY-MM-DD' */
function getStopForDate(dateStr) {
  const d = parseDate(dateStr);
  for (const stop of TRIP.stops) {
    const s = parseDate(stop.startDate);
    const e = parseDate(stop.endDate);
    if (d >= s && d < e) return stop;
  }
  // Last day (Jan 2 – Jan 5 = departure)
  const lastStop = TRIP.stops[TRIP.stops.length - 1];
  const lastEnd  = parseDate(lastStop.endDate);
  const dt       = parseDate(dateStr);
  if (dt >= lastEnd && dt <= parseDate(TRIP.endDate)) return lastStop;
  return null;
}

/** Generate all dates between start and end (inclusive) */
function generateDateRange(startStr, endStr) {
  const dates = [];
  const cur   = parseDate(startStr);
  const end   = parseDate(endStr);
  while (cur <= end) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getLegColor(leg) {
  return TRIP.legs[leg]?.color || '#555';
}

function fmtShortDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function populatePageStats() {
  const stops    = TRIP.stops;
  const totalNights = stops.reduce((s, c) => s + c.nights, 0);
  const countries   = [...new Set(stops.map(s => s.leg))].length;
  const avgBudget   = stops.length ? Math.round(stops.reduce((s, c) => s + (c.budgetPerDay || 0), 0) / stops.length) : 45;

  // Header date range
  const el = document.getElementById('header-date-range');
  if (el) el.textContent = `${fmtShortDate(TRIP.startDate)} \u2013 ${fmtShortDate(TRIP.endDate)}`;

  // Map overlay stats
  const mo = document.getElementById('map-overlay-stats');
  if (mo) mo.textContent = `${totalNights} Days \u00b7 ${countries} Countries \u00b7 ${stops.length} Cities`;

  // Stats bar
  const sd = document.getElementById('stat-days');      if (sd) sd.textContent = totalNights;
  const sc = document.getElementById('stat-countries'); if (sc) sc.textContent = countries;
  const si = document.getElementById('stat-cities');    if (si) si.textContent = stops.length;

  // Map legend — compute first/last date per leg
  ['peru', 'brazil', 'argentina'].forEach(leg => {
    const legStops = stops.filter(s => s.leg === leg);
    if (!legStops.length) return;
    const first = legStops[0].startDate;
    const last  = legStops[legStops.length - 1].endDate;
    const el = document.getElementById('legend-' + leg);
    if (el) {
      const name = TRIP.legs[leg]?.name || leg;
      const flag = TRIP.legs[leg]?.flag || '';
      el.innerHTML = `<span class="dot dot-${leg}"></span>${flag} ${name} \u00b7 ${fmtShortDate(first)} \u2013 ${fmtShortDate(last)}`;
    }
  });
}

// ─────────────────────────────────────────────────────────────
// MAP INITIALIZATION
// ─────────────────────────────────────────────────────────────
let map;

function initMap() {
  map = L.map('map', {
    center:     [-20, -60],
    zoom:       4,
    zoomControl: true,
  });

  // Dark CartoDB tile layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
    subdomains:  'abcd',
    maxZoom:     19,
  }).addTo(map);

  // Build route polyline coords
  const routeCoords = TRIP.stops.map(s => s.coords);

  // Animated dashed route line
  const routeLine = L.polyline(routeCoords, {
    color:     'rgba(255,255,255,0.35)',
    weight:    2,
    dashArray: '8, 8',
    lineJoin:  'round',
  }).addTo(map);

  // Colored leg segments
  const peruStops  = TRIP.stops.filter(s => s.leg === 'peru');
  const brazilStops = TRIP.stops.filter(s => s.leg === 'brazil');
  const argStops   = TRIP.stops.filter(s => s.leg === 'argentina');

  // Draw colored segments per leg
  [[peruStops, '#E8834A'], [brazilStops, '#22a447'], [argStops, '#5b9bd5']].forEach(([stops, color]) => {
    if (stops.length > 1) {
      L.polyline(stops.map(s => s.coords), {
        color,
        weight:   3,
        opacity:  0.7,
        lineJoin: 'round',
      }).addTo(map);
    }
  });

  // Add markers for each stop
  TRIP.stops.forEach((stop, idx) => {
    const color  = getLegColor(stop.leg);
    const isLast = idx === TRIP.stops.length - 1;

    const markerIcon = L.divIcon({
      className:   '',
      iconSize:    [44, 44],
      iconAnchor:  [22, 22],
      popupAnchor: [0, -26],
      html: `
        <div style="
          width:44px; height:44px;
          background:${color};
          border-radius:50%;
          border:3px solid rgba(255,255,255,0.9);
          display:flex; align-items:center; justify-content:center;
          font-size:15px;
          box-shadow: 0 3px 14px rgba(0,0,0,0.5);
          position:relative;
          cursor:pointer;
        ">
          ${stop.emoji}
          <div style="
            position:absolute;
            top:-8px; right:-8px;
            width:20px; height:20px;
            background:#fff;
            border-radius:50%;
            display:flex; align-items:center; justify-content:center;
            font-size:9px; font-weight:800;
            color:${color};
            box-shadow:0 1px 4px rgba(0,0,0,0.4);
            line-height:1;
            font-family: -apple-system, sans-serif;
            z-index:10;
          ">${idx + 1}</div>
          <div style="
            position:absolute;
            width:44px; height:44px;
            background:${color};
            border-radius:50%;
            opacity:0.3;
            animation: mapPulse ${1.5 + idx * 0.1}s ease-out infinite;
            top:0; left:0;
          "></div>
        </div>
      `,
    });

    const topActivities = stop.activities.slice(0, 3)
      .map(a => `<li>${a}</li>`)
      .join('');

    const popupContent = `
      <div class="popup-inner">
        <div class="popup-header">
          <span class="popup-flag">${TRIP.legs[stop.leg].flag}</span>
          <div>
            <div class="popup-city">${stop.emoji} ${stop.city}</div>
          </div>
        </div>
        <div class="popup-dates">📅 ${formatDateShort(parseDate(stop.startDate))} – ${formatDateShort(parseDate(stop.endDate))} · ${stop.nights} night${stop.nights !== 1 ? 's' : ''}</div>
        <ul class="popup-activities">${topActivities}</ul>
        <div class="popup-food">${stop.food}</div>
        <div class="popup-budget">💵 ~$${stop.budgetPerDay}/day · 🏨 ${stop.accommodation}</div>
      </div>
    `;

    L.marker(stop.coords, { icon: markerIcon })
      .addTo(map)
      .bindPopup(popupContent, { maxWidth: 300 });
  });

  // Add pulse CSS keyframe to document
  const style = document.createElement('style');
  style.textContent = `
    @keyframes mapPulse {
      0%   { transform: scale(1);   opacity: 0.4; }
      100% { transform: scale(2.5); opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  // Fit map to route bounds with padding
  map.fitBounds(L.latLngBounds(routeCoords), { padding: [40, 40] });

  // ── Map style switcher ────────────────────────────────────
  const TILE_LAYERS = {
    dark:      { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', opts: { subdomains:'abcd', maxZoom:19 } },
    light:     { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', opts: { subdomains:'abcd', maxZoom:19 } },
    satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', opts: { maxZoom:19, attribution:'Tiles © Esri' } },
  };
  let currentTileLayer = null;

  function setTileLayer(style) {
    if (currentTileLayer) map.removeLayer(currentTileLayer);
    const cfg = TILE_LAYERS[style] || TILE_LAYERS.dark;
    currentTileLayer = L.tileLayer(cfg.url, cfg.opts).addTo(map);
    currentTileLayer.bringToBack();
  }

  document.querySelectorAll('.map-style-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.map-style-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setTileLayer(btn.dataset.style);
    });
  });
}

// ─────────────────────────────────────────────────────────────
// TOUR MODE — geographical route playback on the live map
// ─────────────────────────────────────────────────────────────
function initTourMode() {
  const STOPS       = TRIP.stops;
  const TOTAL       = STOPS.length;
  const STEP_MS     = 4200;  // time per stop in auto-play mode
  const TRAVEL_MS   = 1800;  // traveler animation duration

  // Brighter colours for the progressively-drawn route
  const LEG_COLORS = {
    peru:      '#FF9F5A',
    brazil:    '#2ECC71',
    argentina: '#74B9FF',
  };

  // State
  let currentIdx   = 0;
  let isPlaying    = false;
  let stepTimer    = null;
  let animFrame    = null;
  let travelerMarker  = null;
  let drawnSegments   = [];   // bright L.Polyline objects drawn so far

  // DOM
  const playBtn    = document.getElementById('tour-play-btn');
  const panel      = document.getElementById('tour-panel');
  const pauseBtn   = document.getElementById('tp-pause');
  const exitBtn    = document.getElementById('tp-exit');
  const nextBtn    = document.getElementById('tp-next');
  const prevBtn    = document.getElementById('tp-prev');
  const fillEl     = document.getElementById('tp-fill');
  const numEl      = document.getElementById('tp-num');
  const emojiEl    = document.getElementById('tp-emoji');
  const cityEl     = document.getElementById('tp-city');
  const subEl      = document.getElementById('tp-sub');
  const actEl      = document.getElementById('tp-act');
  const mapTitle   = document.getElementById('map-overlay-title');
  const mapLegend  = document.getElementById('map-legend');

  // ── Helpers ───────────────────────────────────────────────

  /** Compass bearing between two [lat, lng] points, in degrees */
  function getBearing(from, to) {
    const dLng = (to[1] - from[1]) * Math.PI / 180;
    const lat1 = from[0] * Math.PI / 180;
    const lat2 = to[0]   * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2)
             - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  /** Create / update the traveler plane marker */
  function makeTravelerIcon(bearing, color) {
    // Rotate the plane emoji to face the direction of travel.
    // ✈️ default points right (east ≈ 90°), so subtract 90 to align.
    const rot = bearing - 90;
    return L.divIcon({
      className:  '',
      iconSize:   [34, 34],
      iconAnchor: [17, 17],
      html: `<div class="traveler-icon" style="transform:rotate(${rot}deg);--tc:${color}">✈️</div>`,
    });
  }

  /** Update the bottom info panel */
  function updatePanel(idx) {
    const stop    = STOPS[idx];
    const legInfo = TRIP.legs[stop.leg];
    const color   = LEG_COLORS[stop.leg];

    numEl.textContent  = `${idx + 1} / ${TOTAL}`;
    cityEl.textContent = stop.city;
    cityEl.style.color = color;
    subEl.textContent  = `${legInfo.flag} ${legInfo.name} · ${formatDateShort(parseDate(stop.startDate))} – ${formatDateShort(parseDate(stop.endDate))} · ${stop.nights} night${stop.nights !== 1 ? 's' : ''}`;
    actEl.textContent  = stop.activities[0] || '';
    fillEl.style.width = `${((idx + 1) / TOTAL) * 100}%`;
    fillEl.style.background = color;

    // Bounce the emoji on change
    emojiEl.textContent = stop.emoji;
    emojiEl.classList.remove('tp-anim');
    void emojiEl.offsetWidth; // force reflow
    emojiEl.classList.add('tp-anim');
  }

  /**
   * Animate the traveler from `fromCoords` to `toCoords`,
   * simultaneously drawing the route segment on the map.
   */
  function animateTraveler(fromCoords, toCoords, color) {
    if (animFrame) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }

    const bearing = getBearing(fromCoords, toCoords);
    travelerMarker.setIcon(makeTravelerIcon(bearing, color));

    // Start a new bright polyline for this segment (starts at `from`)
    const segLine = L.polyline([fromCoords, fromCoords], {
      color,
      weight:   5,
      opacity:  0.95,
      lineJoin: 'round',
      lineCap:  'round',
    }).addTo(map);
    drawnSegments.push(segLine);

    const t0 = performance.now();

    function tick(now) {
      const raw = Math.min((now - t0) / TRAVEL_MS, 1);
      // Cubic ease-in-out
      const e = raw < 0.5 ? 4 * raw * raw * raw
                           : 1 - Math.pow(-2 * raw + 2, 3) / 2;

      const lat = fromCoords[0] + (toCoords[0] - fromCoords[0]) * e;
      const lng = fromCoords[1] + (toCoords[1] - fromCoords[1]) * e;
      const pos = [lat, lng];

      travelerMarker.setLatLng(pos);
      segLine.setLatLngs([fromCoords, pos]);

      if (raw < 1) {
        animFrame = requestAnimationFrame(tick);
      } else {
        travelerMarker.setLatLng(toCoords);
        segLine.setLatLngs([fromCoords, toCoords]);
        animFrame = null;
      }
    }

    animFrame = requestAnimationFrame(tick);
  }

  /**
   * Show stop at `idx`.
   * `animated` = true → animate traveler from previous stop.
   * `backward`  = true → just jump (no line drawn backwards).
   */
  function showStop(idx, animated, backward) {
    const stop    = STOPS[idx];
    const prev    = STOPS[idx - 1];
    const color   = LEG_COLORS[stop.leg];

    updatePanel(idx);
    currentIdx = idx;

    if (animated && prev && !backward && travelerMarker) {
      // Fly map camera to destination (timed slightly behind traveler)
      map.flyTo(stop.coords, 6, {
        duration:      TRAVEL_MS / 1000 * 0.9,
        easeLinearity: 0.4,
      });
      animateTraveler(prev.coords, stop.coords, color);
    } else {
      // Instant jump — update traveler position & icon
      if (travelerMarker) {
        // Point plane towards next stop (or previous if going back)
        const target = backward
          ? (STOPS[idx + 1] || stop)
          : (STOPS[idx + 1] || stop);
        const bearing = getBearing(stop.coords, target.coords);
        travelerMarker.setIcon(makeTravelerIcon(bearing, color));
        travelerMarker.setLatLng(stop.coords);
      }
      map.flyTo(stop.coords, 6, { duration: 0.6 });
    }
  }

  // ── Playback control ──────────────────────────────────────

  function startAutoPlay() {
    isPlaying = true;
    pauseBtn.textContent = '⏸';
    pauseBtn.title = 'Pause';
    clearInterval(stepTimer);
    stepTimer = setInterval(() => {
      if (currentIdx < TOTAL - 1) {
        showStop(currentIdx + 1, true, false);
      } else {
        pauseAutoPlay();   // reached last stop — stop
      }
    }, STEP_MS);
  }

  function pauseAutoPlay() {
    isPlaying = false;
    pauseBtn.textContent = '▶';
    pauseBtn.title = 'Resume';
    clearInterval(stepTimer);
    stepTimer = null;
  }

  function exitTour() {
    pauseAutoPlay();
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }

    // Clean up map overlays
    drawnSegments.forEach(l => map.removeLayer(l));
    drawnSegments = [];
    if (travelerMarker) { map.removeLayer(travelerMarker); travelerMarker = null; }

    // Restore UI
    panel.classList.add('hidden');
    playBtn.classList.remove('hidden');
    mapTitle  && mapTitle.classList.remove('hidden');
    mapLegend && mapLegend.classList.remove('hidden');

    // Exit fullscreen map
    document.body.classList.remove('tour-active');
    setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(L.latLngBounds(TRIP.stops.map(s => s.coords)), { padding: [40, 40] });
    }, 80);
  }

  // ── Entry point ───────────────────────────────────────────

  playBtn.addEventListener('click', () => {
    // Clean up any previous tour state
    drawnSegments.forEach(l => map.removeLayer(l));
    drawnSegments = [];
    if (travelerMarker) { map.removeLayer(travelerMarker); travelerMarker = null; }
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    currentIdx = 0;

    // Expand the map to fullscreen
    document.body.classList.add('tour-active');
    document.getElementById('map-section').scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Hide other map chrome
    playBtn.classList.add('hidden');
    mapTitle  && mapTitle.classList.add('hidden');
    mapLegend && mapLegend.classList.add('hidden');

    // Show panel
    panel.classList.remove('hidden');

    // Let the CSS transition settle, then initialise
    setTimeout(() => {
      map.invalidateSize();
      // Fit to entire route first so user sees the continent
      map.fitBounds(L.latLngBounds(TRIP.stops.map(s => s.coords)), { padding: [70, 70] });

      // Place traveler at first stop
      const first  = STOPS[0];
      const color  = LEG_COLORS[first.leg];
      const second = STOPS[1];
      const initBearing = getBearing(first.coords, second.coords);
      travelerMarker = L.marker(first.coords, {
        icon: makeTravelerIcon(initBearing, color),
        zIndexOffset: 2000,
      }).addTo(map);

      updatePanel(0);

      // Fly to first stop then begin playback
      setTimeout(() => {
        map.flyTo(first.coords, 6, { duration: 1.2 });
        startAutoPlay();
      }, 900);
    }, 120);
  });

  pauseBtn.addEventListener('click', () => {
    if (isPlaying) pauseAutoPlay(); else startAutoPlay();
  });

  exitBtn.addEventListener('click', exitTour);

  nextBtn.addEventListener('click', () => {
    if (currentIdx < TOTAL - 1) {
      pauseAutoPlay();
      showStop(currentIdx + 1, true, false);
    }
  });

  prevBtn.addEventListener('click', () => {
    if (currentIdx > 0) {
      pauseAutoPlay();
      // Remove last drawn segment when going back
      if (drawnSegments.length > 0) {
        const last = drawnSegments.pop();
        map.removeLayer(last);
      }
      showStop(currentIdx - 1, false, true);
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (panel.classList.contains('hidden')) return;
    if (e.key === 'Escape')      exitTour();
    if (e.key === 'ArrowRight')  nextBtn.click();
    if (e.key === 'ArrowLeft')   prevBtn.click();
    if (e.key === ' ')           { e.preventDefault(); pauseBtn.click(); }
  });

  // Page Visibility API — pause tour when tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && isPlaying) pauseAutoPlay();
  });
}

// ─────────────────────────────────────────────────────────────
// TIMELINE GENERATION
// ─────────────────────────────────────────────────────────────
function buildTimeline() {
  const container = document.getElementById('timeline-container');
  const allDates  = generateDateRange(TRIP.startDate, TRIP.endDate);

  // We'll build a Monday-aligned calendar grid
  // Find the Monday on or before the start date
  const firstDate = parseDate(TRIP.startDate);
  const startDay  = firstDate.getDay(); // 0=Sun, 1=Mon…
  const offset    = (startDay === 0) ? 6 : startDay - 1;

  // Create main grid
  const grid = document.createElement('div');
  grid.className = 'timeline-grid';
  // Column headers are injected per-month by the while loop below

  // Generate full weeks from (firstDate - offset) through endDate
  const gridStart = new Date(firstDate);
  gridStart.setDate(gridStart.getDate() - offset);

  const lastDate = parseDate(TRIP.endDate);
  const cur      = new Date(gridStart);
  let currentMonth = -1;

  while (cur <= lastDate) {
    // Week label
    const weekLabel = makeEl('div', 'tl-week-label', formatDateShort(cur));

    // Week row — inject month label before week if month changes
    const monthNum = cur.getMonth();
    if (monthNum !== currentMonth) {
      currentMonth = monthNum;
      const monthLabel = makeEl('div', 'tl-month-label',
        cur.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      );
      grid.appendChild(monthLabel);

      // Re-add column headers after month label
      grid.appendChild(makeEl('div', 'tl-week-label', ''));
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(day => {
        grid.appendChild(makeEl('div', 'tl-col-header', day));
      });
    }

    grid.appendChild(weekLabel);

    // 7 day cells
    for (let i = 0; i < 7; i++) {
      const dayCur  = new Date(cur);
      dayCur.setDate(dayCur.getDate() + i);
      const dateStr = dateToStr(dayCur);
      const tripStart = parseDate(TRIP.startDate);
      const tripEnd   = parseDate(TRIP.endDate);
      const isInTrip  = dayCur >= tripStart && dayCur <= tripEnd;

      const cell = document.createElement('div');
      cell.className = 'tl-day';

      if (!isInTrip) {
        cell.classList.add('leg-empty');
        cell.style.opacity = '0';
        cell.style.pointerEvents = 'none';
        grid.appendChild(cell);
        continue;
      }

      const stop = getStopForDate(dateStr);

      if (stop) {
        cell.classList.add(`leg-${stop.leg}`);
        cell.title = `${stop.city} — ${formatDateShort(dayCur)}`;

        // Check if it's a transition day (last day of a stop)
        const stopEnd = parseDate(stop.endDate);
        stopEnd.setDate(stopEnd.getDate() - 1);
        if (dateStr === dateToStr(stopEnd)) {
          cell.classList.add('transition-day');
        }
      } else {
        cell.classList.add('leg-transit');
      }

      // Cell content
      cell.innerHTML = `
        <span class="tl-day-num">${dayCur.getDate()}</span>
        <span class="tl-day-mon">${dayCur.toLocaleDateString('en-US', { month: 'short' })}</span>
      `;

      cell.addEventListener('click', () => showTimelineDetail(dateStr, stop, cell));
      grid.appendChild(cell);
    }

    cur.setDate(cur.getDate() + 7);
  }

  container.appendChild(grid);

  // Close button
  document.getElementById('tl-close').addEventListener('click', () => {
    document.getElementById('timeline-detail').classList.add('hidden');
    document.querySelectorAll('.tl-day.selected').forEach(el => el.classList.remove('selected'));
  });
}

function makeEl(tag, className, text) {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

function showTimelineDetail(dateStr, stop, cellEl) {
  const detail  = document.getElementById('timeline-detail');
  const content = document.getElementById('tl-detail-content');

  // Clear previous selection
  document.querySelectorAll('.tl-day.selected').forEach(el => el.classList.remove('selected'));
  cellEl.classList.add('selected');

  if (!stop) {
    content.innerHTML = `<p style="color:var(--text-muted)">Travel/transit day or outside trip dates.</p>`;
    detail.classList.remove('hidden');
    detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  const legInfo  = TRIP.legs[stop.leg];
  const color    = legInfo.color;
  const activities = stop.activities.map(a => `<li>${a}</li>`).join('');

  content.innerHTML = `
    <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.75rem;">
      <span style="font-size:2rem">${stop.emoji}</span>
      <div>
        <div class="tl-detail-city" style="color:${color}">${stop.city}</div>
        <div class="tl-detail-dates">${legInfo.flag} ${legInfo.name} · ${formatDateShort(parseDate(stop.startDate))} – ${formatDateShort(parseDate(stop.endDate))} · ${stop.nights} nights</div>
      </div>
    </div>
    <div class="tl-detail-grid">
      <div class="tl-detail-item">
        <h4>Activities</h4>
        <ul>${activities}</ul>
      </div>
      <div class="tl-detail-item">
        <h4>Food Rec</h4>
        <p>${stop.food}</p>
        <br>
        <h4>Budget</h4>
        <p>~$${stop.budgetPerDay} USD/day · ${stop.accommodation}</p>
        <br>
        <h4>Next Transport</h4>
        <p>${stop.transport}</p>
      </div>
    </div>
  `;

  detail.classList.remove('hidden');
  detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─────────────────────────────────────────────────────────────
// DESTINATION CARDS
// ─────────────────────────────────────────────────────────────
function renderCards(leg) {
  const container = document.getElementById('cards-container');
  container.innerHTML = '';

  const stops = TRIP.stops.filter(s => s.leg === leg);

  stops.forEach(stop => {
    const legInfo = TRIP.legs[stop.leg];
    const activities = stop.activities.map(a => `<li>${a}</li>`).join('');

    const card = document.createElement('div');
    card.className = `dest-card card-${stop.leg}`;
    card.innerHTML = `
      <div class="card-header">
        <span class="card-emoji">${stop.emoji}</span>
        <div class="card-meta">
          <div class="card-city">${stop.city}</div>
          <div class="card-country">${legInfo.flag} ${legInfo.name}</div>
        </div>
        <span class="card-dates-badge">${formatDateShort(parseDate(stop.startDate))} – ${formatDateShort(parseDate(stop.endDate))}</span>
      </div>
      <div class="card-body">
        <div>
          <div class="card-section-label">Top Activities</div>
          <ul class="card-activities">${activities}</ul>
        </div>
        <div>
          <div class="card-section-label">Food Recommendation</div>
          <div class="card-food">${stop.food}</div>
        </div>
        <div class="card-info-row">
          <div class="card-chip">💵 <span>~$${stop.budgetPerDay}/day</span></div>
          <div class="card-chip">🌙 <span>${stop.nights} nights</span></div>
        </div>
        <div>
          <div class="card-section-label">Accommodation</div>
          <div class="card-chip">🏨 <span>${stop.accommodation}</span></div>
        </div>
        <div>
          <div class="card-section-label">Onward Transport</div>
          <div class="card-transport">${stop.transport}</div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function initTabs() {
  const tabs = document.querySelectorAll('.leg-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderCards(tab.dataset.leg);
    });
  });
  // Default: Peru
  renderCards('peru');
}

// ─────────────────────────────────────────────────────────────
// FRIENDS PANEL
// ─────────────────────────────────────────────────────────────
let friends = [];

// Friends default comes from tripdata.js (shared source of truth)
const DEFAULT_FRIENDS = DEFAULT_TRIP_DATA.friends || [];

function loadFriends() {
  try {
    const stored = localStorage.getItem('la_aventura_friends');
    friends = stored ? JSON.parse(stored) : JSON.parse(JSON.stringify(DEFAULT_FRIENDS));
  } catch {
    friends = JSON.parse(JSON.stringify(DEFAULT_FRIENDS));
  }
}

function saveFriendsToStorage() {
  localStorage.setItem('la_aventura_friends', JSON.stringify(friends));
}

function renderFriends() {
  const container = document.getElementById('friends-container');
  container.innerHTML = '';

  if (friends.length === 0) {
    container.innerHTML = `<p style="color:#94a3b8; text-align:center; grid-column:1/-1;">No friends added yet!</p>`;
    return;
  }

  friends.forEach(f => {
    const initials = f.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const card = document.createElement('div');
    card.className = 'friend-card';
    card.innerHTML = `
      <button class="friend-delete" data-id="${f.id}" title="Remove">✕</button>
      <div class="friend-card-header">
        <div class="friend-avatar" style="background:${f.color}">${initials}</div>
        <div>
          <div class="friend-name">${escapeHTML(f.name)}</div>
          <div class="friend-legs">${escapeHTML(f.legs)}</div>
        </div>
      </div>
      <div class="friend-dates">📅 ${escapeHTML(f.dates)}</div>
      <div class="friend-note-display" id="note-display-${f.id}">
        ${f.note ? `<div class="friend-note">💬 "${escapeHTML(f.note)}"</div>` : '<div class="friend-note-empty">No note yet</div>'}
        <button class="friend-edit-note-btn" data-id="${f.id}">✏️ Edit note</button>
      </div>
      <div class="friend-note-edit hidden" id="note-edit-${f.id}">
        <textarea class="friend-note-textarea" id="note-ta-${f.id}" rows="2">${escapeHTML(f.note || '')}</textarea>
        <div class="friend-note-edit-actions">
          <button class="btn-primary" style="padding:0.35rem 0.9rem;font-size:0.8rem" data-save-id="${f.id}">Save</button>
          <button class="btn-ghost" style="padding:0.35rem 0.9rem;font-size:0.8rem" data-cancel-id="${f.id}">Cancel</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  // Bind delete buttons
  container.querySelectorAll('.friend-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      friends = friends.filter(f => f.id !== btn.dataset.id);
      saveFriendsToStorage();
      renderFriends();
    });
  });

  // Bind edit note buttons
  container.querySelectorAll('.friend-edit-note-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      document.getElementById(`note-display-${id}`).classList.add('hidden');
      document.getElementById(`note-edit-${id}`).classList.remove('hidden');
      document.getElementById(`note-ta-${id}`).focus();
    });
  });

  // Bind save note buttons
  container.querySelectorAll('[data-save-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id   = btn.dataset.saveId;
      const text = document.getElementById(`note-ta-${id}`).value.trim();
      const idx  = friends.findIndex(f => f.id === id);
      if (idx !== -1) {
        friends[idx].note = text;
        saveFriendsToStorage();
        renderFriends();
      }
    });
  });

  // Bind cancel note buttons
  container.querySelectorAll('[data-cancel-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.cancelId;
      document.getElementById(`note-edit-${id}`).classList.add('hidden');
      document.getElementById(`note-display-${id}`).classList.remove('hidden');
    });
  });
}

function initFriends() {
  loadFriends();
  renderFriends();

  const addBtn    = document.getElementById('add-friend-btn');
  const form      = document.getElementById('friend-form');
  const saveBtn   = document.getElementById('save-friend-btn');
  const cancelBtn = document.getElementById('cancel-friend-btn');

  addBtn.addEventListener('click', () => {
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) {
      document.getElementById('f-name').focus();
    }
  });

  cancelBtn.addEventListener('click', () => {
    form.classList.add('hidden');
    clearFriendForm();
  });

  saveBtn.addEventListener('click', () => {
    const name  = document.getElementById('f-name').value.trim();
    const legs  = document.getElementById('f-legs').value.trim();
    const dates = document.getElementById('f-dates').value.trim();
    const color = document.getElementById('f-color').value;
    const note  = document.getElementById('f-note').value.trim();

    if (!name) { alert('Please enter a name!'); return; }

    friends.push({
      id:    'f' + Date.now(),
      name, legs, dates, color, note,
    });
    saveFriendsToStorage();
    renderFriends();
    renderFriendOverlap();
    form.classList.add('hidden');
    clearFriendForm();
    showToast(`${name} added to the crew! ✈️`, 'success');
  });
}

// ─────────────────────────────────────────────────────────────
// FRIEND OVERLAP CHART
// ─────────────────────────────────────────────────────────────
function renderFriendOverlap() {
  const chartEl = document.getElementById('friend-overlap-chart');
  if (!chartEl) return;
  if (!friends.length) {
    chartEl.innerHTML = '<p style="color:#94a3b8;font-size:0.85rem;text-align:center;padding:1rem">Add friends above to see the overlap chart</p>';
    return;
  }

  // Trip overall range
  const tripStart = parseDate(TRIP.startDate);
  const lastStop  = TRIP.stops[TRIP.stops.length - 1];
  const tripEnd   = parseDate(lastStop.endDate);
  const totalMs   = tripEnd - tripStart;

  // Leg boundaries as % of total
  const legRanges = {};
  let legStopMap = { peru: [], brazil: [], argentina: [] };
  TRIP.stops.forEach(s => { if (legStopMap[s.leg]) legStopMap[s.leg].push(s); });
  ['peru', 'brazil', 'argentina'].forEach(leg => {
    const stops = legStopMap[leg];
    if (!stops.length) return;
    const start = parseDate(stops[0].startDate);
    const end   = parseDate(stops[stops.length - 1].endDate);
    legRanges[leg] = {
      left:  ((start - tripStart) / totalMs * 100).toFixed(1),
      width: ((end   - start)    / totalMs * 100).toFixed(1),
      color: ({ peru:'#E8834A', brazil:'#22a447', argentina:'#5b9bd5' })[leg]
    };
  });

  // Axis labels
  const axisHTML = `<div class="foc-leg-labels"><div></div><div class="foc-axis">
    ${['peru','brazil','argentina'].filter(l => legRanges[l]).map(l =>
      `<span style="color:${legRanges[l].color}">${{peru:'🇵🇪 Peru',brazil:'🇧🇷 Brazil',argentina:'🇦🇷 Argentina'}[l]}</span>`
    ).join('')}
  </div></div>`;

  const rowsHTML = friends.map(f => {
    // Try to parse dates from friend data
    let barLeft = 0, barWidth = 100;
    const datesStr = f.dates || '';
    const m = datesStr.match(/(\w+\s+\d+)\s*[–\-]\s*(\w+\s+\d+)/);
    if (m) {
      try {
        const s = new Date(m[1] + ' 2026');
        const e = new Date(m[2] + ' 2026');
        if (!isNaN(s) && !isNaN(e)) {
          barLeft  = Math.max(0, (s - tripStart) / totalMs * 100);
          barWidth = Math.min(100 - barLeft, (e - s) / totalMs * 100);
        }
      } catch { /**/ }
    }
    return `<div class="foc-row">
      <div class="foc-name" title="${escapeHTML(f.name)}">${escapeHTML(f.name)}</div>
      <div class="foc-track">
        <div class="foc-bar" style="left:${barLeft.toFixed(1)}%;width:${Math.max(barWidth,2).toFixed(1)}%;background:${f.color || '#888'}">
          ${barWidth > 5 ? escapeHTML(f.legs || '') : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  chartEl.innerHTML = axisHTML + rowsHTML;
}

// ─────────────────────────────────────────────────────────────
// SHARE CARD GENERATOR
// ─────────────────────────────────────────────────────────────
function initShareCard() {
  const btn   = document.getElementById('share-card-btn');
  const modal = document.getElementById('share-modal');
  if (!btn || !modal) return;

  function openShareModal() {
    // Populate stats
    const statsEl = document.getElementById('sc-stats');
    const datesEl = document.getElementById('sc-dates');
    if (statsEl) {
      const items = [
        { num: TRIP.stops.length, lbl: 'Cities' },
        { num: Object.keys(TRIP.legs).length, lbl: 'Countries' },
        { num: TRIP.stats?.totalNights || 80, lbl: 'Nights' },
      ];
      statsEl.innerHTML = items.map(i =>
        `<div class="sc-stat"><div class="sc-num" style="background:linear-gradient(90deg,#E8834A,#f59e0b);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${i.num}</div><div class="sc-lbl">${i.lbl}</div></div>`
      ).join('');
    }
    if (datesEl) {
      const first = TRIP.stops[0];
      const last  = TRIP.stops[TRIP.stops.length - 1];
      datesEl.textContent = `${formatDateShort(parseDate(first.startDate))} – ${formatDateShort(parseDate(last.endDate))}`;
    }
    modal.classList.remove('hidden');
  }

  btn.addEventListener('click', openShareModal);
  document.getElementById('share-overlay')?.addEventListener('click', () => modal.classList.add('hidden'));
  document.getElementById('share-close')?.addEventListener('click', () => modal.classList.add('hidden'));

  document.getElementById('share-download-btn')?.addEventListener('click', async () => {
    const card = document.querySelector('.share-card');
    if (!card) return;
    try {
      if (typeof html2canvas !== 'undefined') {
        const canvas = await html2canvas(card, { scale: 2, useCORS: true, backgroundColor: '#0d1117' });
        const link = document.createElement('a');
        link.download = 'south-america-2026-share.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else {
        alert('html2canvas not loaded. Try refreshing the page.');
      }
    } catch (e) {
      console.error('Share card error:', e);
    }
  });

  document.getElementById('share-copy-btn')?.addEventListener('click', () => {
    const url = 'https://stefanmazzadi.github.io/South-America-2026';
    navigator.clipboard?.writeText(url).then(() => {
      const btn2 = document.getElementById('share-copy-btn');
      if (btn2) { btn2.textContent = '✓ Copied!'; setTimeout(() => { btn2.textContent = '📋 Copy Link'; }, 2000); }
      showToast('Link copied to clipboard!', 'success');
    });
  });
}

function clearFriendForm() {
  ['f-name', 'f-legs', 'f-dates', 'f-note'].forEach(id => {
    document.getElementById(id).value = '';
  });
}

// ─────────────────────────────────────────────────────────────
// NOTES
// ─────────────────────────────────────────────────────────────
let notes = [];
let activeFilter = 'all';

const TYPE_ICONS = {
  idea:       '💡',
  reminder:   '⏰',
  food:       '🍽️',
  logistics:  '✈️',
  excitement: '🎉',
};

function loadNotes() {
  try {
    const stored = localStorage.getItem('la_aventura_notes');
    notes = stored ? JSON.parse(stored) : JSON.parse(JSON.stringify(DEFAULT_TRIP_DATA.notes || []));
  } catch {
    notes = [];
  }
}

function saveNotesToStorage() {
  localStorage.setItem('la_aventura_notes', JSON.stringify(notes));
}

function renderNotes() {
  const list  = document.getElementById('notes-list');
  const empty = document.getElementById('notes-empty');

  const filtered = activeFilter === 'all'
    ? notes
    : notes.filter(n => n.leg === activeFilter);

  // Update stats counter
  document.getElementById('notes-count').textContent = notes.length;

  list.innerHTML = '';

  if (filtered.length === 0) {
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  // Most recent first
  [...filtered].reverse().forEach(note => {
    const legClass = 'leg-' + (note.leg === 'General' ? 'general' : note.leg.toLowerCase());
    const card = document.createElement('div');
    card.className = 'note-card';
    card.innerHTML = `
      <div class="note-card-header">
        <span class="note-author">👤 ${escapeHTML(note.author || 'Anonymous')}</span>
        <div class="note-badges">
          <span class="note-badge ${legClass}">${note.leg}</span>
          <span style="font-size:1.1rem">${TYPE_ICONS[note.type] || '📝'}</span>
        </div>
      </div>
      <div class="note-text">${escapeHTML(note.text)}</div>
      <div class="note-meta">
        <span>${note.date}</span>
        <button class="note-delete" data-id="${note.id}">✕ delete</button>
      </div>
    `;
    list.appendChild(card);
  });

  // Bind deletes
  list.querySelectorAll('.note-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      notes = notes.filter(n => n.id !== btn.dataset.id);
      saveNotesToStorage();
      renderNotes();
    });
  });
}

function initNotes() {
  loadNotes();
  renderNotes();

  document.getElementById('save-note-btn').addEventListener('click', () => {
    const author = document.getElementById('n-author').value.trim();
    const text   = document.getElementById('n-text').value.trim();
    const leg    = document.getElementById('n-leg').value;
    const type   = document.getElementById('n-type').value;

    if (!text) { alert('Write something first!'); return; }

    notes.push({
      id:     'n' + Date.now(),
      author: author || 'Anonymous',
      text,
      leg,
      type,
      date:   new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    });
    saveNotesToStorage();
    renderNotes();

    document.getElementById('n-text').value   = '';
    document.getElementById('n-author').value = '';
  });

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderNotes();
    });
  });
}

// ─────────────────────────────────────────────────────────────
// MOBILE NAV
// ─────────────────────────────────────────────────────────────
function initMobileNav() {
  const hamburger = document.getElementById('hamburger');
  const nav       = document.getElementById('mobile-nav');

  hamburger.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    hamburger.textContent = isOpen ? '✕' : '☰';
  });
}

function closeMobileNav() {
  const nav = document.getElementById('mobile-nav');
  nav.classList.remove('open');
  const hamburger = document.getElementById('hamburger');
  if (hamburger) hamburger.textContent = '☰';
}
window.closeMobileNav = closeMobileNav;

// ─────────────────────────────────────────────────────────────
// SECURITY: HTML escape helper
// ─────────────────────────────────────────────────────────────
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─────────────────────────────────────────────────────────────
// HEADER SCROLL EFFECT
// ─────────────────────────────────────────────────────────────
function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const isLight = localStorage.getItem('la_aventura_theme') === 'light';
  if (isLight) { document.body.classList.add('light-mode'); btn.textContent = '☀️'; }

  btn.addEventListener('click', () => {
    const light = document.body.classList.toggle('light-mode');
    btn.textContent = light ? '☀️' : '🌙';
    localStorage.setItem('la_aventura_theme', light ? 'light' : 'dark');
  });
}

function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('anim-visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.anim-ready').forEach(el => observer.observe(el));
}

// ─────────────────────────────────────────────────────────────
// TOAST NOTIFICATIONS
// ─────────────────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;z-index:99999;display:flex;flex-direction:column;gap:0.5rem;pointer-events:none;';
    document.body.appendChild(container);
  }

  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
  const colors = { info: '#5b9bd5', success: '#22a447', error: '#ef4444', warning: '#f59e0b' };

  const toast = document.createElement('div');
  toast.style.cssText = `background:rgba(22,27,34,0.95);backdrop-filter:blur(8px);border:1px solid ${colors[type]};border-radius:12px;padding:0.75rem 1.1rem;display:flex;align-items:center;gap:0.6rem;font-size:0.87rem;color:#e2e8f0;max-width:320px;box-shadow:0 8px 24px rgba(0,0,0,0.4);animation:toastIn 0.25s ease;pointer-events:auto;`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.25s ease forwards';
    setTimeout(() => toast.remove(), 280);
  }, duration);
}

// Add toast keyframes once
(function addToastCSS() {
  const s = document.createElement('style');
  s.textContent = `
    @keyframes toastIn  { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
    @keyframes toastOut { from { opacity:1; transform:translateY(0); } to { opacity:0; transform:translateY(12px); } }
  `;
  document.head.appendChild(s);
})();

function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        btn.classList.toggle('visible', window.scrollY > 300);
        ticking = false;
      });
      ticking = true;
    }
  });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function initScrollEffect() {
  const header = document.getElementById('site-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 60) {
      header.style.boxShadow = '0 4px 24px rgba(0,0,0,0.5)';
    } else {
      header.style.boxShadow = 'none';
    }
  });
}

// ─────────────────────────────────────────────────────────────
// COUNTDOWN WIDGET
// ─────────────────────────────────────────────────────────────
function initCountdown() {
  const widget = document.getElementById('countdown-widget');
  if (!widget) return;

  const tripStart = new Date('2026-10-23T00:00:00');
  const tripEnd   = new Date('2026-01-11T00:00:00'); // ~80 days later

  // Compute end from TRIP data if available
  const tripEndComputed = (() => {
    try {
      const stops = TRIP.stops;
      const last  = stops[stops.length - 1];
      const d = new Date(last.end + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      return d;
    } catch { return new Date('2027-01-11T00:00:00'); }
  })();

  function update() {
    const now  = new Date();
    const diff = tripStart - now;

    if (diff > 0) {
      // Before trip
      const totalSec = Math.floor(diff / 1000);
      const d = Math.floor(totalSec / 86400);
      const h = Math.floor((totalSec % 86400) / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      widget.textContent = `✈️ Departs in ${d}d ${h}h ${m}m ${s}s`;
    } else {
      const elapsed = now - tripStart;
      if (now < tripEndComputed) {
        // During trip
        const dayNum = Math.floor(elapsed / 86400000) + 1;
        const totalDays = Math.round((tripEndComputed - tripStart) / 86400000);
        const stop = getStopForDate(dateToStr(now)) || { city: '?' };
        widget.textContent = `🌎 Day ${dayNum} of ${totalDays} — ${stop.city}`;
      } else {
        // After trip
        widget.textContent = '✅ Trip complete — what an adventure!';
        return; // no need to keep ticking
      }
    }
  }

  update();
  if (new Date() < tripEndComputed) setInterval(update, 1000);
}

// ─────────────────────────────────────────────────────────────
// BUDGET TRACKER
// ─────────────────────────────────────────────────────────────
const BUDGET_KEY = 'la_aventura_expenses';

// Per-country estimated daily costs (USD)
const BUDGET_ESTIMATES = {
  peru:      { dailyCost: 45, color: '#E8834A' },
  brazil:    { dailyCost: 60, color: '#22a447' },
  argentina: { dailyCost: 50, color: '#5b9bd5' }
};

function loadExpenses() {
  try { return JSON.parse(localStorage.getItem(BUDGET_KEY) || '[]'); }
  catch { return []; }
}

function saveExpenses(list) {
  localStorage.setItem(BUDGET_KEY, JSON.stringify(list));
}

function calcBudgetEstimates() {
  const rows = [];
  let total = 0;
  if (!TRIP || !TRIP.stops) return { rows, total };
  TRIP.stops.forEach(stop => {
    const nights = stop.nights || 0;
    const leg    = stop.leg || 'general';
    const daily  = (BUDGET_ESTIMATES[leg] || { dailyCost: 50 }).dailyCost;
    const sub    = nights * daily;
    total += sub;
    rows.push({ city: stop.city, leg, nights, daily, sub });
  });
  return { rows, total };
}

function renderBudget() {
  const expenses = loadExpenses();
  const { rows, total } = calcBudgetEstimates();

  // Total card
  const totalEl = document.getElementById('budget-total');
  if (totalEl) totalEl.textContent = '$' + total.toLocaleString();

  // Per-leg bar chart
  const barsEl = document.getElementById('budget-leg-bars');
  if (barsEl) {
    const legTotals = {};
    rows.forEach(r => { legTotals[r.leg] = (legTotals[r.leg] || 0) + r.sub; });
    const maxVal = Math.max(...Object.values(legTotals), 1);
    barsEl.innerHTML = '';
    const legNames = { peru: '🇵🇪 Peru', brazil: '🇧🇷 Brazil', argentina: '🇦🇷 Argentina' };
    Object.entries(legTotals).forEach(([leg, val]) => {
      const pct = Math.round((val / maxVal) * 100);
      const color = (BUDGET_ESTIMATES[leg] || {}).color || '#888';
      const row = document.createElement('div');
      row.className = 'budget-leg-row';
      row.innerHTML = `<div class="budget-leg-header"><span>${legNames[leg] || leg}</span><span>$${val.toLocaleString()}</span></div>
        <div class="budget-bar-track"><div class="budget-bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
      barsEl.appendChild(row);
    });
  }

  // Table
  const tbody = document.getElementById('budget-table-body');
  if (tbody) {
    tbody.innerHTML = rows.map(r =>
      `<tr><td>${escapeHTML(r.city)}</td><td>${r.nights}</td><td>$${r.daily}</td><td>$${r.sub.toLocaleString()}</td></tr>`
    ).join('');
    const tfoot = document.getElementById('budget-table-total');
    if (tfoot) tfoot.textContent = '$' + total.toLocaleString();
  }

  // Expenses list
  const listEl = document.getElementById('expenses-list');
  if (listEl) {
    const catIcons = { accommodation: '🏨', food: '🍽️', transport: '🚌', activities: '🧗', misc: '📦', general: '🌎' };
    listEl.innerHTML = expenses.length ? expenses.map((e, i) =>
      `<div class="expense-item">
        <span class="exp-cat">${catIcons[e.cat] || '📦'} ${e.cat}</span>
        <span class="exp-name">${escapeHTML(e.name)}</span>
        <span class="exp-amount">$${Number(e.amount).toLocaleString()}</span>
        <button class="exp-delete btn-ghost" data-idx="${i}" title="Delete">✕</button>
      </div>`).join('') : '<p style="color:#94a3b8;font-size:0.88rem;text-align:center;padding:1rem">No expenses added yet</p>';

    listEl.querySelectorAll('.exp-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const list = loadExpenses();
        list.splice(Number(btn.dataset.idx), 1);
        saveExpenses(list);
        renderBudget();
      });
    });
  }

  // Actual vs estimate cards
  const totalsEl = document.getElementById('budget-actual-totals');
  if (totalsEl) {
    const legTotals = {};
    expenses.forEach(e => { legTotals[e.leg] = (legTotals[e.leg] || 0) + Number(e.amount); });
    const legNames = { peru: '🇵🇪 Peru', brazil: '🇧🇷 Brazil', argentina: '🇦🇷 Argentina', general: '🌎 General' };
    const legEst = {};
    rows.forEach(r => { legEst[r.leg] = (legEst[r.leg] || 0) + r.sub; });
    const allLegs = new Set([...Object.keys(legTotals), ...Object.keys(legEst)]);
    totalsEl.innerHTML = '';
    allLegs.forEach(leg => {
      const actual = legTotals[leg] || 0;
      const est    = legEst[leg] || 0;
      if (actual === 0 && est === 0) return;
      const cls = est > 0 ? (actual > est ? 'over' : 'under') : '';
      const card = document.createElement('div');
      card.className = 'budget-vs-card ' + cls;
      card.innerHTML = `<div class="bvc-label">${legNames[leg] || leg}</div>
        <div class="bvc-amount">$${actual.toLocaleString()} <span style="font-size:0.72rem;color:#94a3b8">/ est $${est.toLocaleString()}</span></div>`;
      totalsEl.appendChild(card);
    });
  }
}

function initBudget() {
  renderBudget();
  const addBtn = document.getElementById('exp-add-btn');
  if (!addBtn) return;
  addBtn.addEventListener('click', () => {
    const name   = document.getElementById('exp-name').value.trim();
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const leg    = document.getElementById('exp-leg').value;
    const cat    = document.getElementById('exp-cat').value;
    if (!name || isNaN(amount) || amount <= 0) return;
    const list = loadExpenses();
    list.push({ name, amount, leg, cat, date: new Date().toISOString() });
    saveExpenses(list);
    document.getElementById('exp-name').value  = '';
    document.getElementById('exp-amount').value = '';
    renderBudget();
    showToast(`Added $${amount} — ${name}`, 'success');
  });
}

// ─────────────────────────────────────────────────────────────
// PACKING LIST
// ─────────────────────────────────────────────────────────────
const PACKING_KEY = 'la_aventura_packing';

const DEFAULT_PACKING = {
  general: ['Passport & copies','Travel insurance docs','Debit/credit cards','First aid kit','Sunscreen SPF 50+','Insect repellent (DEET)','Power adapter','Portable charger','Headlamp','Padlock for hostel','Quick-dry towel','Rain jacket','Sandals','Comfortable walking shoes','Sunglasses','Water bottle (filter)','Earplugs','Neck pillow','VPN app installed'],
  peru:    ['Altitude sickness pills (Diamox)','Warm layers (Cusco cold nights)','Sleeping bag liner','Machu Picchu tickets','Bus/train to Aguas Calientes','Trekking poles (optional)','Spanish phrasebook'],
  brazil:  ['Yellow fever certificate','Bikini / boardshorts','Flip flops','Carnival outfit (if applicable)','Caipirinha mix recipe 😄','Portuguese basics','PIX / cash for street food'],
  argentina: ['Tango shoes (optional)','Mate cup & bombilla','Dulce de leche supply','Warm jacket for Patagonia','Pesos cash (ATMs vary)','Good offline map (Patagonia signal)']
};

function loadPacking() {
  try {
    const stored = localStorage.getItem(PACKING_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /**/ }
  // Deep-copy defaults with checked=false
  const init = {};
  Object.entries(DEFAULT_PACKING).forEach(([tab, items]) => {
    init[tab] = items.map(text => ({ text, checked: false, custom: false }));
  });
  return init;
}

function savePacking(data) {
  localStorage.setItem(PACKING_KEY, JSON.stringify(data));
}

function renderPackingList(tab) {
  const data   = loadPacking();
  const items  = data[tab] || [];
  const listEl = document.getElementById('packing-list');
  if (!listEl) return;

  const all     = Object.values(data).flat();
  const done    = all.filter(i => i.checked).length;
  const pct     = all.length ? Math.round(done / all.length * 100) : 0;
  const countEl = document.getElementById('pack-count');
  const pctEl   = document.getElementById('pack-pct');
  const barEl   = document.getElementById('packing-bar-fill');
  if (countEl) countEl.textContent = `${done} / ${all.length} items packed`;
  if (pctEl)   pctEl.textContent   = pct + '%';
  if (barEl)   barEl.style.width   = pct + '%';

  listEl.innerHTML = '';
  items.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'pack-item' + (item.checked ? ' checked' : '');
    div.innerHTML = `<input type="checkbox" ${item.checked ? 'checked' : ''} data-idx="${idx}" data-tab="${tab}">
      <span>${escapeHTML(item.text)}</span>
      ${item.custom ? `<button class="pack-delete btn-ghost" data-idx="${idx}" data-tab="${tab}" title="Remove">✕</button>` : ''}`;

    div.querySelector('input').addEventListener('change', e => {
      const d2 = loadPacking();
      d2[tab][idx].checked = e.target.checked;
      savePacking(d2);
      renderPackingList(tab);
    });

    if (item.custom) {
      div.querySelector('.pack-delete').addEventListener('click', () => {
        const d2 = loadPacking();
        d2[tab].splice(idx, 1);
        savePacking(d2);
        renderPackingList(tab);
      });
    }
    listEl.appendChild(div);
  });
}

function initPacking() {
  let currentTab = 'general';
  const tabs = document.querySelectorAll('.pack-tab');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      renderPackingList(currentTab);
    });
  });

  const addBtn = document.getElementById('pack-add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const input = document.getElementById('pack-new-item');
      const text  = input.value.trim();
      if (!text) return;
      const data = loadPacking();
      if (!data[currentTab]) data[currentTab] = [];
      data[currentTab].push({ text, checked: false, custom: true });
      savePacking(data);
      input.value = '';
      renderPackingList(currentTab);
    });
  }

  renderPackingList(currentTab);
}

// ─────────────────────────────────────────────────────────────
// MEMORY WALL
// ─────────────────────────────────────────────────────────────
const MEMORIES_KEY = 'la_aventura_memories';

function loadMemories() {
  try { return JSON.parse(localStorage.getItem(MEMORIES_KEY) || '[]'); }
  catch { return []; }
}

function saveMemories(list) {
  localStorage.setItem(MEMORIES_KEY, JSON.stringify(list));
}

function renderMemories() {
  const grid = document.getElementById('memory-grid');
  if (!grid) return;
  const mems = loadMemories();
  if (!mems.length) {
    grid.innerHTML = '<div class="memory-grid-empty">No memories yet — add a photo URL above to get started! 📷</div>';
    return;
  }
  const legFlags = { peru: '🇵🇪', brazil: '🇧🇷', argentina: '🇦🇷' };
  grid.innerHTML = mems.map((m, i) => `
    <div class="memory-card" data-idx="${i}">
      <img src="${escapeHTML(m.url)}" alt="${escapeHTML(m.caption)}" loading="lazy" onerror="this.parentElement.style.display='none'">
      <div class="mem-card-footer">
        <span>${legFlags[m.leg] || ''} ${escapeHTML(m.caption)}</span>
        <button class="mem-delete btn-ghost" data-idx="${i}" title="Delete">✕</button>
      </div>
    </div>`).join('');

  grid.querySelectorAll('.memory-card img').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.src, img.alt));
  });

  grid.querySelectorAll('.mem-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const list = loadMemories();
      list.splice(Number(btn.dataset.idx), 1);
      saveMemories(list);
      renderMemories();
    });
  });
}

function openLightbox(src, caption) {
  const lb = document.getElementById('mem-lightbox');
  if (!lb) return;
  document.getElementById('mem-lb-img').src      = src;
  document.getElementById('mem-lb-caption').textContent = caption;
  lb.classList.remove('hidden');
}

function closeLightbox() {
  const lb = document.getElementById('mem-lightbox');
  if (lb) lb.classList.add('hidden');
}

function initMemories() {
  renderMemories();
  const addBtn = document.getElementById('mem-add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const url     = document.getElementById('mem-url').value.trim();
      const caption = document.getElementById('mem-caption').value.trim();
      const leg     = document.getElementById('mem-leg').value;
      if (!url) return;
      const list = loadMemories();
      list.unshift({ url, caption: caption || 'Memory', leg, date: new Date().toISOString() });
      saveMemories(list);
      document.getElementById('mem-url').value     = '';
      document.getElementById('mem-caption').value = '';
      renderMemories();
      showToast('Memory added to the wall! 📸', 'success');
    });
  }
  document.getElementById('mem-lb-close')?.addEventListener('click', closeLightbox);
  document.getElementById('mem-lb-close-btn')?.addEventListener('click', closeLightbox);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
}

function initTimelineToggle() {
  const toggleHeader = document.getElementById('timeline-toggle-header');
  const body         = document.getElementById('timeline-body');
  const icon         = toggleHeader.querySelector('.tl-toggle-icon');
  let collapsed = body.classList.contains('collapsed');

  toggleHeader.addEventListener('click', () => {
    collapsed = !collapsed;
    body.classList.toggle('collapsed', collapsed);
    icon.style.transform = collapsed ? 'rotate(180deg)' : '';
  });
}

function initCollapsible(headerId, bodyId) {
  const header = document.getElementById(headerId);
  const body   = document.getElementById(bodyId);
  if (!header || !body) return;
  const icon = header.querySelector('.tl-toggle-icon');
  let collapsed = body.classList.contains('collapsed');

  header.addEventListener('click', () => {
    collapsed = !collapsed;
    body.classList.toggle('collapsed', collapsed);
    if (icon) icon.style.transform = collapsed ? 'rotate(180deg)' : '';
  });
}

// ─────────────────────────────────────────────────────────────
// MAIN INIT
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  populatePageStats();
  initMap();
  buildTimeline();
  initTimelineToggle();
  initCollapsible('destinos-toggle-header', 'destinos-body');
  initCollapsible('amigos-toggle-header', 'amigos-body');
  initTabs();
  initFriends();
  renderFriendOverlap();
  initNotes();
  initMobileNav();
  initScrollEffect();
  initThemeToggle();
  initScrollAnimations();
  initBackToTop();
  initCountdown();
  initCollapsible('budget-toggle-header', 'budget-body');
  initBudget();
  initCollapsible('packing-toggle-header', 'packing-body');
  initPacking();
  initCollapsible('memories-toggle-header', 'memories-body');
  initMemories();
  initShareCard();
  initTourMode();

  // Wire up the main-page export button
  document.getElementById('export-all-btn')?.addEventListener('click', exportAllData);

  console.log('%c🌎 The Adventure — South America 2026', 'font-size:16px; font-weight:bold; color:#E8834A');
  console.log('%cTrip data loaded:', 'color:#22a447', TRIP.stops.length, 'stops across', Object.keys(TRIP.legs).length, 'countries');
  console.log('%cNotes stored in localStorage key: la_aventura_notes', 'color:#5b9bd5');
  console.log('%cTo connect to Firebase/Supabase, replace loadNotes/saveNotesToStorage with API calls.', 'color:#94a3b8');
});

// ─────────────────────────────────────────────────────────────
// EXPORT ALL DATA  →  new tripdata.js
// ─────────────────────────────────────────────────────────────
async function exportAllData() {
  // Collect the latest from localStorage (falls back to in-memory if not set)
  let rawTrip = loadTripData();

  let exportedFriends = friends;  // already loaded into memory
  try {
    const sf = localStorage.getItem('la_aventura_friends');
    if (sf) exportedFriends = JSON.parse(sf);
  } catch { /* use in-memory */ }

  let exportedNotes = notes;  // already loaded into memory
  try {
    const sn = localStorage.getItem('la_aventura_notes');
    if (sn) exportedNotes = JSON.parse(sn);
  } catch { /* use in-memory */ }

  const exportData = { ...rawTrip, friends: exportedFriends, notes: exportedNotes };

  const content = [
    '/* ============================================================',
    '   tripdata.js  \u2014  South America 2026',
    '   Single source of truth: trip stops, friends & notes.',
    '   Generated by Export on ' + new Date().toLocaleString() + '.',
    '   ============================================================ */',
    '',
    'const DEFAULT_TRIP_DATA =',
    JSON.stringify(exportData, null, 2) + ';',
  ].join('\n');

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'tripdata.js',
        types: [{ description: 'JavaScript file', accept: { 'text/javascript': ['.js'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      // Brief visual feedback on the button
      const btn = document.getElementById('export-all-btn');
      const orig = btn.textContent;
      btn.textContent = '\u2713 Saved!';
      btn.style.background = '#22a447';
      setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 2500);
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }

  // Fallback download
  const blob = new Blob([content], { type: 'text/javascript' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'tripdata.js';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
