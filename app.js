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

  // Draw colored segments per leg — keep refs for self-drawing animation
  const legPolylines = [];
  [['peru', peruStops, '#E8834A', 1200], ['brazil', brazilStops, '#22a447', 3000], ['argentina', argStops, '#5b9bd5', 5000]].forEach(([legKey, stops, color, delay]) => {
    if (stops.length > 1) {
      const pl = L.polyline(stops.map(s => s.coords), {
        color,
        weight:   3,
        opacity:  0.7,
        lineJoin: 'round',
      }).addTo(map);
      legPolylines.push({ pl, color, delay, leg: legKey });
    }
  });

  // ── Self-drawing route animation ────────────────────────────
  // After tiles render, animate the SVG stroke-dashoffset of each polyline path
  function animatePathDraw(polyline, durationMs, delay) {
    setTimeout(() => {
      try {
        const path = polyline._path;
        if (!path || !path.getTotalLength) return;
        const len = path.getTotalLength();
        path.style.strokeDasharray  = len;
        path.style.strokeDashoffset = len;
        path.style.transition       = `stroke-dashoffset ${durationMs}ms ease-in-out`;
        // Force reflow then animate
        void path.getBoundingClientRect();
        requestAnimationFrame(() => { path.style.strokeDashoffset = '0'; });
        // Clear inline transition once finished so map redraws work normally
        setTimeout(() => { path.style.transition = ''; }, durationMs + delay + 50);
      } catch (e) { /* fallback: leave drawn */ }
    }, delay);
  }

  setTimeout(() => {
    animatePathDraw(routeLine, 1500, 0);                  // dashed line first (relative offset)
    legPolylines.forEach(({ pl, delay }) => animatePathDraw(pl, 2200, delay));
  }, 800);

  // ── Curved Bezier flight arcs for inter-leg flights ─────────
  // Identify consecutive stops where the leg changes (= a flight)
  function curvedArc(startLatLng, endLatLng, segments = 60, curvature = 0.25) {
    const [lat1, lng1] = startLatLng;
    const [lat2, lng2] = endLatLng;
    // midpoint perpendicular-offset gives a nice arc
    const midLat = (lat1 + lat2) / 2;
    const midLng = (lng1 + lng2) / 2;
    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;
    const dist = Math.hypot(dLat, dLng);
    // perpendicular vector
    const perpLat = -dLng / dist;
    const perpLng =  dLat / dist;
    const offset  = dist * curvature;
    const ctrlLat = midLat + perpLat * offset;
    const ctrlLng = midLng + perpLng * offset;
    // quadratic bezier
    const pts = [];
    for (let t = 0; t <= 1; t += 1 / segments) {
      const u = 1 - t;
      const lat = u*u*lat1 + 2*u*t*ctrlLat + t*t*lat2;
      const lng = u*u*lng1 + 2*u*t*ctrlLng + t*t*lng2;
      pts.push([lat, lng]);
    }
    return pts;
  }

  const flightArcs = [];
  for (let i = 0; i < TRIP.stops.length - 1; i++) {
    const a = TRIP.stops[i], b = TRIP.stops[i + 1];
    if (a.leg !== b.leg) {
      const pts = curvedArc(a.coords, b.coords, 60, 0.2);
      const arc = L.polyline(pts, {
        color:     '#f59e0b',
        weight:    2,
        opacity:   0.85,
        dashArray: '6, 6',
        lineCap:   'round',
      }).addTo(map);
      // ✈️ marker at midpoint
      const mid = pts[Math.floor(pts.length / 2)];
      const planeIcon = L.divIcon({
        className: '',
        iconSize:  [22, 22],
        iconAnchor:[11, 11],
        html: `<div style="font-size:1.1rem;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.6));pointer-events:none;">✈️</div>`,
      });
      L.marker(mid, { icon: planeIcon, interactive: false }).addTo(map);
      flightArcs.push(arc);
      // animate this flight arc with extra delay
      animatePathDraw(arc, 1800, 6000 + i * 300);
    }
  }

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
  window._mapInstance = map;  // expose for fly-to from flip cards

  // Bug fix: ensure we never end up at world-zoom (sometimes fitBounds races tile load)
  setTimeout(() => {
    if (!map.getZoom() || map.getZoom() < 3) {
      map.setView([-20, -60], 4);
    }
  }, 250);

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
      <div class="tl-detail-item">
        <h4>Weather Forecast</h4>
        <div id="tl-weather-box" class="tl-weather-box">
          <span class="loading-pulse">⏳ Loading live forecast…</span>
        </div>
      </div>
    </div>
  `;

  detail.classList.remove('hidden');
  detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  // Fetch live weather for this stop's coords (cached 30 min)
  fetchAndRenderWeather(stop, document.getElementById('tl-weather-box'));
}

// ─────────────────────────────────────────────────────────────
// LIVE WEATHER (Open-Meteo, no auth, free)
// ─────────────────────────────────────────────────────────────
const WMO_EMOJI = {
  0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',
  51:'🌦️',53:'🌦️',55:'🌦️',56:'🌧️',57:'🌧️',
  61:'🌧️',63:'🌧️',65:'🌧️',66:'🌧️',67:'🌧️',
  71:'🌨️',73:'🌨️',75:'❄️',77:'❄️',
  80:'🌦️',81:'🌧️',82:'⛈️',85:'🌨️',86:'❄️',
  95:'⛈️',96:'⛈️',99:'⛈️',
};
const WMO_LABEL = {
  0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Cloudy',45:'Fog',48:'Fog',
  51:'Drizzle',53:'Drizzle',55:'Drizzle',56:'Freezing drizzle',57:'Freezing drizzle',
  61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Freezing rain',
  71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',
  80:'Showers',81:'Rain showers',82:'Heavy showers',85:'Snow showers',86:'Snow showers',
  95:'Thunderstorm',96:'Thunderstorm',99:'Severe storm',
};

async function fetchWeatherForCoords(lat, lng) {
  const key = `weather_${lat.toFixed(2)}_${lng.toFixed(2)}`;
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) {
      const { ts, data } = JSON.parse(cached);
      if (Date.now() - ts < 30 * 60 * 1000) return data;  // 30-min TTL
    }
  } catch { /* ignore cache errors */ }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&timezone=auto&forecast_days=5`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API ${res.status}`);
  const data = await res.json();
  try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
  return data;
}

async function fetchAndRenderWeather(stop, container) {
  if (!container) return;
  try {
    const [lat, lng] = stop.coords;
    const data = await fetchWeatherForCoords(lat, lng);
    const cur  = data.current || {};
    const days = data.daily   || {};
    const curCode = cur.weather_code;
    const curTemp = Math.round(cur.temperature_2m ?? 0);

    let html = `
      <div class="tl-weather-now">
        <span class="tlw-emoji">${WMO_EMOJI[curCode] || '🌡️'}</span>
        <div>
          <div class="tlw-temp">${curTemp}°C</div>
          <div class="tlw-label">${WMO_LABEL[curCode] || 'Current'}</div>
        </div>
      </div>
      <div class="tl-weather-5day">`;
    const times = days.time || [];
    for (let i = 0; i < Math.min(5, times.length); i++) {
      const d  = new Date(times[i]);
      const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
      const hi = Math.round(days.temperature_2m_max[i]);
      const lo = Math.round(days.temperature_2m_min[i]);
      const wc = days.weather_code[i];
      const pp = days.precipitation_probability_max?.[i] ?? null;
      html += `
        <div class="tlw-day" title="${WMO_LABEL[wc]||''}">
          <div class="tlw-day-name">${wd}</div>
          <div class="tlw-day-icon">${WMO_EMOJI[wc] || '·'}</div>
          <div class="tlw-day-hl">${hi}° / ${lo}°</div>
          ${pp != null ? `<div class="tlw-day-pp">💧${pp}%</div>` : ''}
        </div>`;
    }
    html += `</div><div class="tl-weather-credit">Live · Open-Meteo</div>`;
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem;">Couldn't load live weather (${e.message}). Try again later.</p>`;
  }
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
    card.className = `dest-card card-${stop.leg} flip-card`;
    card.innerHTML = `
      <div class="flip-inner">
        <div class="flip-front">
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
            <div class="flip-hint">Click for more →</div>
          </div>
        </div>
        <div class="flip-back" style="border-top:4px solid ${legInfo.color};">
          <div class="flip-back-head">
            <span style="font-size:1.6rem">${stop.emoji}</span>
            <div>
              <div class="flip-back-city">${stop.city}</div>
              <div class="flip-back-sub">${legInfo.flag} ${stop.nights} nights · ~$${stop.budgetPerDay}/day</div>
            </div>
          </div>
          <div class="flip-back-row"><strong>🏨 Stay</strong><span>${stop.accommodation}</span></div>
          <div class="flip-back-row"><strong>🚌 Onward</strong><span>${stop.transport}</span></div>
          <div class="flip-back-row"><strong>📍 Coords</strong><span>${stop.coords[0].toFixed(2)}, ${stop.coords[1].toFixed(2)}</span></div>
          <button class="flip-fly-btn" data-coords="${stop.coords[0]},${stop.coords[1]}" data-city="${stop.city}">🗺️ Fly to on map</button>
          <div class="flip-hint">← Click to flip back</div>
        </div>
      </div>
    `;
    // Toggle flip on click (ignore button clicks)
    card.addEventListener('click', (e) => {
      if (e.target.closest('.flip-fly-btn')) return;
      card.classList.toggle('flipped');
    });
    container.appendChild(card);
  });

  // Wire fly-to buttons
  container.querySelectorAll('.flip-fly-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const [lat, lng] = btn.dataset.coords.split(',').map(parseFloat);
      const mapSection = document.getElementById('map-section');
      mapSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => {
        if (window._mapInstance) window._mapInstance.flyTo([lat, lng], 8, { duration: 1.5 });
      }, 600);
      showToast?.(`✈️ Flying to ${btn.dataset.city}`, 'info', 1500);
    });
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
    // Confetti burst the moment the trip starts (diff just crossed 0)
    if (diff <= 0 && diff > -2000 && !window._tripStartConfetti) {
      window._tripStartConfetti = true;
      fireConfetti('trip-start');
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

function renderBudgetCharts(rows, total, expenses) {
  const COLORS = { peru: '#E8834A', brazil: '#22a447', argentina: '#5b9bd5' };
  const NAMES  = { peru: '🇵🇪 Peru', brazil: '🇧🇷 Brazil', argentina: '🇦🇷 Argentina' };
  const legTotals = { peru: 0, brazil: 0, argentina: 0 };
  rows.forEach(r => { legTotals[r.leg] = (legTotals[r.leg]||0) + r.sub; });

  // ───── Donut ─────
  const donut = document.getElementById('bc-donut');
  if (donut) {
    const cx=100, cy=100, r=72, stroke=24;
    const C = 2 * Math.PI * r;
    let offset = 0;
    const parts = Object.entries(legTotals).filter(([,v]) => v > 0);
    const sum = parts.reduce((s,[,v]) => s+v, 0) || 1;
    let svg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#f0f0f0" stroke-width="${stroke}"/>`;
    parts.forEach(([leg, val]) => {
      const frac = val / sum;
      const dash = C * frac;
      svg += `<circle class="bc-donut-arc" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${COLORS[leg]}" stroke-width="${stroke}" stroke-dasharray="${dash} ${C}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})" />`;
      offset += dash;
    });
    svg += `<text x="${cx}" y="${cy-4}" text-anchor="middle" font-size="14" fill="#666" font-family="Inter">Total</text>`;
    svg += `<text x="${cx}" y="${cy+18}" text-anchor="middle" font-size="22" fill="#1a1a1a" font-family="Playfair Display" font-weight="700">$${total.toLocaleString()}</text>`;
    donut.innerHTML = svg;
    const legend = document.getElementById('bc-donut-legend');
    if (legend) {
      legend.innerHTML = parts.map(([leg,val]) => {
        const pct = Math.round(val/sum*100);
        return `<span><i style="background:${COLORS[leg]}"></i>${NAMES[leg]} ${pct}%</span>`;
      }).join('');
    }
  }

  // ───── Pace bar ─────
  const pace = document.getElementById('bc-pace');
  if (pace) {
    const start = new Date('2026-10-23T00:00:00');
    const totalDays = rows.reduce((s,r)=>s+(r.nights||0),0) || 80;
    const now = new Date();
    const dayNum = Math.max(0, Math.min(totalDays, Math.ceil((now - start)/86400000)));
    const tripPct = Math.round(dayNum/totalDays*100);
    const spent = expenses.reduce((s,e)=>s+(Number(e.amount)||0), 0);
    const spentPct = Math.min(100, Math.round(spent/(total||1)*100));
    pace.innerHTML = `
      <text x="10" y="20" font-size="11" fill="#666" font-family="Inter">Trip progress: ${tripPct}% (Day ${dayNum}/${totalDays})</text>
      <rect x="10" y="28" width="300" height="14" rx="7" fill="#f0f0f0"/>
      <rect class="bc-pace-bar" x="10" y="28" width="${tripPct*3}" height="14" rx="7" fill="#5b9bd5"/>
      <text x="10" y="68" font-size="11" fill="#666" font-family="Inter">Budget spent: ${spentPct}% ($${spent.toLocaleString()} of $${total.toLocaleString()})</text>
      <rect x="10" y="76" width="300" height="14" rx="7" fill="#f0f0f0"/>
      <rect class="bc-pace-bar" x="10" y="76" width="${spentPct*3}" height="14" rx="7" fill="${spentPct > tripPct + 10 ? '#e74c3c' : '#22a447'}"/>
      <text x="10" y="108" font-size="10" fill="#999" font-family="Inter" font-style="italic">${spentPct > tripPct + 10 ? '⚠ Spending faster than trip pace' : '✓ On pace or under-budget'}</text>
    `;
  }

  // ───── Timeline ─────
  const tl = document.getElementById('bc-timeline');
  if (tl) {
    // Group expenses by day
    const byDay = {};
    expenses.forEach(e => {
      const d = (e.date || '').slice(0,10);
      if (!d) return;
      byDay[d] = (byDay[d]||0) + (Number(e.amount)||0);
    });
    const days = Object.keys(byDay).sort();
    if (!days.length) {
      tl.innerHTML = `<text x="300" y="70" text-anchor="middle" font-size="12" fill="#999" font-family="Inter" font-style="italic">Add expenses to see your daily spending curve</text>`;
    } else {
      const W=600, H=140, pad=30;
      const maxVal = Math.max(...Object.values(byDay));
      const x = i => pad + (i/(Math.max(1, days.length-1))) * (W - pad*2);
      const y = v => H - pad - (v/maxVal) * (H - pad*2);
      const pts = days.map((d,i) => `${x(i)},${y(byDay[d])}`).join(' ');
      const area = `M${pad},${H-pad} L${pts.split(' ').join(' L')} L${W-pad},${H-pad} Z`;
      tl.innerHTML = `
        <defs><linearGradient id="bcGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.6"/>
          <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.05"/>
        </linearGradient></defs>
        <line class="bc-tl-axis" x1="${pad}" y1="${H-pad}" x2="${W-pad}" y2="${H-pad}"/>
        <line class="bc-tl-axis" x1="${pad}" y1="${pad}" x2="${pad}" y2="${H-pad}"/>
        <path class="bc-tl-area" d="${area}"/>
        <polyline class="bc-tl-line" points="${pts}"/>
        ${days.map((d,i) => `<circle cx="${x(i)}" cy="${y(byDay[d])}" r="3" fill="#f59e0b"/>`).join('')}
        <text x="${pad}" y="${H-8}" font-size="9" fill="#999" font-family="Inter">${days[0]}</text>
        <text x="${W-pad}" y="${H-8}" text-anchor="end" font-size="9" fill="#999" font-family="Inter">${days[days.length-1]}</text>
        <text x="${pad-4}" y="${pad+4}" text-anchor="end" font-size="9" fill="#999" font-family="Inter">$${maxVal.toFixed(0)}</text>
      `;
    }
  }
}

function renderBudget() {
  const expenses = loadExpenses();
  const { rows, total } = calcBudgetEstimates();
  renderBudgetCharts(rows, total, expenses);

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
  // Confetti once when crossing 50%
  if (pct >= 50 && !window._packing50) {
    window._packing50 = true;
    fireConfetti('packing-half');
  }

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
      const wasFirst = list.length === 0;
      list.unshift({ url, caption: caption || 'Memory', leg, date: new Date().toISOString() });
      saveMemories(list);
      document.getElementById('mem-url').value     = '';
      document.getElementById('mem-caption').value = '';
      renderMemories();
      showToast('Memory added to the wall! 📸', 'success');
      if (wasFirst) fireConfetti('first-memory');
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
// 3D GLOBE VIEW (globe.gl)
// ─────────────────────────────────────────────────────────────
let _globeInstance = null;
let _globeClickCount = 0;  // for easter-egg confetti
function initGlobe() {
  const btn       = document.getElementById('globe-toggle-btn');
  const closeBtn  = document.getElementById('globe-close-btn');
  const container = document.getElementById('globe-container');
  const canvas    = document.getElementById('globe-canvas');
  if (!btn || !container || !canvas) return;

  function buildGlobe() {
    if (_globeInstance) return _globeInstance;
    if (typeof Globe === 'undefined') {
      showToast?.('Globe library not loaded yet — try again', 'warn');
      return null;
    }

    // Arc data: each consecutive stop pair
    const arcs = [];
    for (let i = 0; i < TRIP.stops.length - 1; i++) {
      const a = TRIP.stops[i], b = TRIP.stops[i + 1];
      arcs.push({
        startLat: a.coords[0], startLng: a.coords[1],
        endLat:   b.coords[0], endLng:   b.coords[1],
        color: [getLegColor(a.leg), getLegColor(b.leg)],
      });
    }

    // City points
    const points = TRIP.stops.map(s => ({
      lat: s.coords[0], lng: s.coords[1],
      label: `${s.emoji || '📍'} ${s.city}`,
      color: getLegColor(s.leg),
      size:  0.45,
    }));

    _globeInstance = Globe()(canvas)
      .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')
      .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundColor('rgba(0,0,0,0)')
      .arcsData(arcs)
      .arcColor('color')
      .arcDashLength(0.4)
      .arcDashGap(0.15)
      .arcDashAnimateTime(2500)
      .arcStroke(0.5)
      .arcAltitudeAutoScale(0.35)
      .pointsData(points)
      .pointAltitude(0.012)
      .pointColor('color')
      .pointRadius('size')
      .pointLabel('label')
      .atmosphereColor('#5b9bd5')
      .atmosphereAltitude(0.18);

    // Auto-rotate + initial view: center on South America
    _globeInstance.pointOfView({ lat: -20, lng: -60, altitude: 1.8 }, 0);
    const controls = _globeInstance.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.5;
    }

    // Easter-egg: 5 clicks on the globe → confetti
    canvas.addEventListener('click', () => {
      _globeClickCount++;
      if (_globeClickCount === 5 && typeof confetti === 'function') {
        fireConfetti('easter');
        showToast?.('🎉 You found the secret! Adventure mode unlocked.', 'success', 3500);
        _globeClickCount = 0;
      }
    });

    return _globeInstance;
  }

  function openGlobe() {
    container.classList.remove('hidden');
    setTimeout(() => {
      const g = buildGlobe();
      if (g) {
        // Re-size to current container
        const rect = canvas.getBoundingClientRect();
        g.width(rect.width).height(rect.height);
      }
    }, 50);
    // De-activate other map-style buttons visually
    document.querySelectorAll('.map-style-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  function closeGlobe() {
    container.classList.add('hidden');
    document.querySelector('.map-style-btn[data-style="dark"]')?.classList.add('active');
    btn.classList.remove('active');
  }

  btn.addEventListener('click', openGlobe);
  closeBtn?.addEventListener('click', closeGlobe);

  // Resize when window resizes
  window.addEventListener('resize', () => {
    if (_globeInstance && !container.classList.contains('hidden')) {
      const rect = canvas.getBoundingClientRect();
      _globeInstance.width(rect.width).height(rect.height);
    }
  });
}

// ─────────────────────────────────────────────────────────────
// LIVE CURRENCY CONVERTER (open.er-api.com, no auth)
// ─────────────────────────────────────────────────────────────
const FALLBACK_RATES = { USD: 1, EUR: 0.92, PEN: 3.75, BRL: 5.70, ARS: 1020, GBP: 0.79 };

async function fetchRates() {
  const KEY = 'la_aventura_rates';
  try {
    const cached = sessionStorage.getItem(KEY);
    if (cached) {
      const { ts, rates } = JSON.parse(cached);
      if (Date.now() - ts < 60 * 60 * 1000) return { rates, live: true, cachedAt: ts };
    }
  } catch {}
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    if (data?.rates) {
      sessionStorage.setItem(KEY, JSON.stringify({ ts: Date.now(), rates: data.rates }));
      return { rates: data.rates, live: true, cachedAt: Date.now() };
    }
    throw new Error('No rates');
  } catch (e) {
    return { rates: FALLBACK_RATES, live: false, cachedAt: null };
  }
}

function initCurrencyConverter() {
  const amount = document.getElementById('cc-amount');
  const from   = document.getElementById('cc-from');
  const out    = document.getElementById('cc-results');
  const credit = document.getElementById('cc-credit');
  if (!amount || !from || !out) return;

  let cache = null;

  function render() {
    if (!cache) return;
    const { rates, live, cachedAt } = cache;
    const amt = parseFloat(amount.value) || 0;
    // Convert: first to USD, then to each target
    const usd = amt / (rates[from.value] || 1);
    const fmt = (n, dp = 2) => n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
    out.innerHTML = `
      <div class="cc-pill">🇵🇪 ${fmt(usd * (rates.PEN || FALLBACK_RATES.PEN))} PEN</div>
      <div class="cc-pill">🇧🇷 ${fmt(usd * (rates.BRL || FALLBACK_RATES.BRL))} BRL</div>
      <div class="cc-pill">🇦🇷 ${fmt(usd * (rates.ARS || FALLBACK_RATES.ARS), 0)} ARS</div>
    `;
    credit.textContent = live
      ? `Live · ${new Date(cachedAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })} · open.er-api.com`
      : `⚠ Offline — using fallback rates`;
  }

  fetchRates().then(r => { cache = r; render(); });
  amount.addEventListener('input', render);
  from.addEventListener('change', render);
}

// ─────────────────────────────────────────────────────────────
// WORLD CLOCKS (Lima · São Paulo · Buenos Aires)
// ─────────────────────────────────────────────────────────────
function initWorldClocks() {
  const cards = document.querySelectorAll('.wc-card');
  if (!cards.length) return;

  function tick() {
    cards.forEach(card => {
      const tz = card.dataset.tz;
      if (!tz) return;
      try {
        const now = new Date();
        const time = now.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const date = now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' });
        card.querySelector('.wc-time').textContent = time;
        card.querySelector('.wc-date').textContent = date;
      } catch {}
    });
  }
  tick();
  setInterval(tick, 1000);
}

// ─────────────────────────────────────────────────────────────
// CULTURE HUB (phrases · food · music · emergency · climate)
// ─────────────────────────────────────────────────────────────
const CULTURE_DATA = {
  peru: {
    phrases: [
      { en: 'Hello',           es: 'Hola',                  pr: 'OH-lah' },
      { en: 'Thank you',       es: 'Gracias',               pr: 'GRAH-syas' },
      { en: 'Please',          es: 'Por favor',             pr: 'por fah-VOR' },
      { en: 'How much?',       es: '¿Cuánto cuesta?',       pr: 'KWAN-toh KWES-tah' },
      { en: 'Where is...?',    es: '¿Dónde está...?',       pr: 'DON-deh es-TAH' },
      { en: 'The bill, please',es: 'La cuenta, por favor',  pr: 'lah KWEN-tah' },
      { en: 'Help!',           es: '¡Ayuda!',               pr: 'ah-YOO-dah' },
      { en: 'Delicious',       es: 'Delicioso',             pr: 'deh-lee-SYOH-soh' },
      { en: 'Cheers!',         es: '¡Salud!',               pr: 'sah-LOOD' },
      { en: 'I don\'t speak Spanish', es: 'No hablo español',pr: 'noh AH-bloh es-pahn-YOL' },
      { en: 'Yes / No',        es: 'Sí / No',               pr: 'see / noh' },
      { en: 'Good morning',    es: 'Buenos días',           pr: 'BWAY-nos DEE-as' },
    ],
    foods: [
      { e:'🐟', n:'Ceviche', d:'Citrus-cured fresh fish — national dish' },
      { e:'🥩', n:'Lomo Saltado', d:'Stir-fry beef with onion + chips' },
      { e:'🐟', n:'Tiradito', d:'Sashimi-style Peruvian raw fish' },
      { e:'🌽', n:'Choclo con Queso', d:'Giant Andean corn with cheese' },
      { e:'🍗', n:'Pollo a la Brasa', d:'Charcoal rotisserie chicken' },
      { e:'🍠', n:'Causa', d:'Yellow potato terrine with avocado' },
      { e:'🥟', n:'Empanadas', d:'Beef or cheese hand pies' },
      { e:'🍹', n:'Pisco Sour', d:'Cocktail of pisco, lime, egg white' },
      { e:'🍫', n:'Chocolate from Cusco', d:'Bean-to-bar from Quillabamba' },
      { e:'🌶️', n:'Ají de Gallina', d:'Creamy yellow chili chicken stew' },
    ],
    music: [
      { genre:'Andean Folk', title:'Susana Baca — Afro-Peruvian queen', q:'Susana Baca María Landó', yt:'OTakQy_smVk' },
      { genre:'Cumbia',      title:'Los Mirlos — psychedelic Amazon', q:'Los Mirlos La Danza de los Mirlos', yt:'OdRYxg-LhT0' },
      { genre:'Modern',      title:'Bareto — fusion icons',           q:'Bareto Ya Se Ha Muerto Mi Abuelo', yt:'EBoSWeKj5GU' },
      { genre:'Folk',        title:'Yma Sumac — 5-octave legend',     q:'Yma Sumac Gopher Mambo', yt:'BAdb0wF7Pdc' },
    ],
    emergency: [
      { label:'Police', num:'105' },
      { label:'Ambulance', num:'117' },
      { label:'Fire', num:'116' },
      { label:'Tourist Police', num:'(01) 460-1060' },
      { label:'🇨🇦 Embassy Lima', num:'(01) 319-3200' },
      { label:'🇺🇸 Embassy Lima', num:'(01) 618-2000' },
    ],
  },
  brazil: {
    phrases: [
      { en: 'Hello',           es: 'Olá',                pr: 'oh-LAH' },
      { en: 'Thank you',       es: 'Obrigado/a',         pr: 'oh-bree-GAH-doo/dah' },
      { en: 'Please',          es: 'Por favor',          pr: 'por fah-VOR' },
      { en: 'How much?',       es: 'Quanto custa?',      pr: 'KWAN-toh KOOS-tah' },
      { en: 'Where is...?',    es: 'Onde fica...?',      pr: 'ON-jee FEE-kah' },
      { en: 'The bill, please',es: 'A conta, por favor', pr: 'ah KON-tah' },
      { en: 'Help!',           es: 'Socorro!',           pr: 'soh-KOH-hoo' },
      { en: 'Delicious',       es: 'Delicioso',          pr: 'deh-lee-SYOH-zoh' },
      { en: 'Cheers!',         es: 'Saúde!',             pr: 'sah-OO-jee' },
      { en: 'I don\'t speak Portuguese', es: 'Não falo português', pr: 'now FAH-loo por-too-GES' },
      { en: 'Yes / No',        es: 'Sim / Não',          pr: 'seen / now' },
      { en: 'Good morning',    es: 'Bom dia',            pr: 'bohn JEE-ah' },
    ],
    foods: [
      { e:'🥩', n:'Picanha', d:'Top sirloin BBQ — Brazilian icon' },
      { e:'🍲', n:'Feijoada', d:'Black bean + pork stew, Saturdays' },
      { e:'🧀', n:'Pão de Queijo', d:'Cheese balls of pure joy' },
      { e:'🍤', n:'Moqueca', d:'Bahian seafood coconut stew' },
      { e:'🌽', n:'Açaí Bowl', d:'Amazonian berry + granola + banana' },
      { e:'🍹', n:'Caipirinha', d:'Cachaça + lime + sugar' },
      { e:'🥟', n:'Coxinha', d:'Teardrop chicken croquette' },
      { e:'🐟', n:'Tucunaré', d:'Amazon peacock bass grilled' },
      { e:'🍰', n:'Brigadeiro', d:'Chocolate truffle — birthday classic' },
      { e:'🌶️', n:'Vatapá', d:'Bahian shrimp-bread-coconut paste' },
    ],
    music: [
      { genre:'Samba',      title:'Cartola — old-school samba master',  q:'Cartola As Rosas Não Falam', yt:'qIxCWv6JtRQ' },
      { genre:'Bossa Nova', title:'João Gilberto — invented bossa',     q:'João Gilberto Chega de Saudade', yt:'mDvxqUOQ4-w' },
      { genre:'MPB',        title:'Caetano Veloso — Tropicalia',        q:'Caetano Veloso Sozinho', yt:'kxJJpsNzCkY' },
      { genre:'Funk Carioca',title:'Anitta — modern pop-funk',          q:'Anitta Vai Malandra', yt:'JsnNiTacqLk' },
    ],
    emergency: [
      { label:'Police', num:'190' },
      { label:'Ambulance', num:'192' },
      { label:'Fire', num:'193' },
      { label:'Tourist Police Rio', num:'(21) 2334-6802' },
      { label:'🇨🇦 Embassy Brasilia', num:'(61) 3424-5400' },
      { label:'🇺🇸 Embassy Brasilia', num:'(61) 3312-7000' },
    ],
  },
  argentina: {
    phrases: [
      { en: 'Hello',           es: 'Hola / Che',          pr: 'OH-lah / cheh' },
      { en: 'Thank you',       es: 'Gracias',             pr: 'GRAH-syas' },
      { en: 'Please',          es: 'Por favor',           pr: 'por fah-VOR' },
      { en: 'How much?',       es: '¿Cuánto sale?',       pr: 'KWAN-toh SAH-leh' },
      { en: 'Where is...?',    es: '¿Dónde queda...?',    pr: 'DON-deh KEH-dah' },
      { en: 'The bill, please',es: 'La cuenta, porfa',    pr: 'lah KWEN-tah POR-fah' },
      { en: 'Help!',           es: '¡Ayuda!',             pr: 'ah-YOO-dah' },
      { en: 'Awesome / cool',  es: 'Bárbaro / copado',    pr: 'BAR-bah-roh / koh-PAH-doh' },
      { en: 'Cheers!',         es: '¡Salud!',             pr: 'sah-LOOD' },
      { en: 'I don\'t speak Spanish', es: 'No hablo castellano', pr: 'noh AH-bloh kas-teh-SHAH-noh' },
      { en: 'Yes / No',        es: 'Sí / No',             pr: 'see / noh' },
      { en: 'Dude (informal)', es: 'Boludo',              pr: 'boh-LOO-doh' },
    ],
    foods: [
      { e:'🥩', n:'Asado', d:'Wood-fire grilled meat feast' },
      { e:'🥟', n:'Empanadas Salteñas', d:'Spicy beef from Salta' },
      { e:'🍝', n:'Milanesa Napolitana', d:'Breaded steak + ham + cheese' },
      { e:'🧀', n:'Provoleta', d:'Grilled provolone with oregano' },
      { e:'🍷', n:'Malbec', d:'Mendoza red wine — the world\'s best' },
      { e:'🥧', n:'Choripán', d:'Chorizo sandwich, street legend' },
      { e:'🍦', n:'Helado Artesanal', d:'Italian-style ice cream perfection' },
      { e:'🧉', n:'Mate', d:'The shared green tea ritual' },
      { e:'🍰', n:'Alfajores', d:'Dulce de leche cookie sandwiches' },
      { e:'🍮', n:'Dulce de Leche', d:'Argentine caramel — on everything' },
    ],
    music: [
      { genre:'Tango',       title:'Carlos Gardel — the voice of tango', q:'Carlos Gardel Por Una Cabeza', yt:'JjReWNmrEsQ' },
      { genre:'Tango Nuevo', title:'Astor Piazzolla — Libertango',       q:'Astor Piazzolla Libertango', yt:'PJXzJyM3iIE' },
      { genre:'Rock Nacional',title:'Soda Stereo — rock icons',          q:'Soda Stereo De Música Ligera', yt:'YqRgfp3pQzU' },
      { genre:'Cuarteto',    title:'Mona Giménez — Córdoba dance',       q:'Mona Giménez Quién Se Ha Tomado', yt:'2zPzPMxYZcs' },
    ],
    emergency: [
      { label:'Police', num:'911' },
      { label:'Ambulance', num:'107' },
      { label:'Fire', num:'100' },
      { label:'Tourist Police BA', num:'(11) 4346-5748' },
      { label:'🇨🇦 Embassy BA', num:'(11) 4808-1000' },
      { label:'🇺🇸 Embassy BA', num:'(11) 5777-4533' },
    ],
  },
};

const CLIMATE_DATA = [
  // Peru — dry season ending → start of wet
  { city:'Lima',           leg:'peru', e:'☁️', hi:22, lo:17, note:'Misty (garúa)' },
  { city:'Paracas',        leg:'peru', e:'☀️', hi:23, lo:16, note:'Coastal desert' },
  { city:'Huacachina',     leg:'peru', e:'🌵', hi:30, lo:14, note:'Dry & sunny' },
  { city:'Arequipa',       leg:'peru', e:'☀️', hi:23, lo:8,  note:'Cool nights' },
  { city:'Puno',           leg:'peru', e:'❄️', hi:17, lo:2,  note:'Altitude · cold' },
  { city:'Cusco',          leg:'peru', e:'⛅', hi:20, lo:6,  note:'Sun + showers' },
  { city:'Machu Picchu',   leg:'peru', e:'🌧️', hi:21, lo:11, note:'Cloud forest rain' },
  // Brazil — late spring → summer
  { city:'Rio',            leg:'brazil', e:'☀️', hi:30, lo:22, note:'Hot beach days' },
  { city:'Iguazu',         leg:'brazil', e:'⛅', hi:32, lo:21, note:'Humid · waterfalls' },
  { city:'São Paulo',      leg:'brazil', e:'🌦️', hi:28, lo:19, note:'Summer storms' },
  { city:'Salvador',       leg:'brazil', e:'☀️', hi:31, lo:24, note:'Tropical heat' },
  { city:'Florianópolis',  leg:'brazil', e:'☀️', hi:28, lo:22, note:'Beach paradise' },
  // Argentina — early summer
  { city:'Buenos Aires',   leg:'argentina', e:'☀️', hi:29, lo:18, note:'Warm & lively' },
  { city:'Mendoza',        leg:'argentina', e:'☀️', hi:31, lo:16, note:'Wine harvest soon' },
  { city:'Bariloche',      leg:'argentina', e:'⛅', hi:21, lo:7,  note:'Alpine summer' },
  { city:'El Calafate',    leg:'argentina', e:'🌬️', hi:18, lo:5,  note:'Windy Patagonia' },
  { city:'El Chaltén',     leg:'argentina', e:'⛅', hi:17, lo:4,  note:'Trekking weather' },
  { city:'Ushuaia',        leg:'argentina', e:'🌧️', hi:13, lo:4,  note:'End of world chill' },
  { city:'Puerto Iguazu',  leg:'argentina', e:'⛅', hi:32, lo:21, note:'Falls humidity' },
];

let _activeCultureCountry = 'peru';

function initCulture() {
  const tabs = document.querySelectorAll('.culture-tab');
  if (!tabs.length) return;

  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(b => b.classList.remove('active'));
    t.classList.add('active');
    _activeCultureCountry = t.dataset.country;
    renderCulture();
  }));

  document.getElementById('phrases-shuffle')?.addEventListener('click', () => {
    const data = CULTURE_DATA[_activeCultureCountry];
    data.phrases = data.phrases.sort(() => Math.random() - 0.5);
    renderPhrases();
  });

  // Personal emergency info persistence
  ['ep-blood','ep-allergies','ep-insurance','ep-contact'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    try {
      const saved = JSON.parse(localStorage.getItem('la_aventura_emergency') || '{}');
      el.value = saved[id] || '';
    } catch {}
    el.addEventListener('input', () => {
      let cur = {};
      try { cur = JSON.parse(localStorage.getItem('la_aventura_emergency') || '{}'); } catch {}
      cur[id] = el.value;
      localStorage.setItem('la_aventura_emergency', JSON.stringify(cur));
    });
  });

  renderCulture();
}

function renderCulture() {
  renderPhrases();
  renderFood();
  renderMusic();
  renderEmergency();
  renderClimate();
}

function renderPhrases() {
  const grid = document.getElementById('phrase-grid');
  if (!grid) return;
  const data = CULTURE_DATA[_activeCultureCountry];
  grid.innerHTML = data.phrases.map(p => `
    <div class="phrase-card">
      <div class="phrase-inner">
        <div class="phrase-face phrase-front">${p.en}</div>
        <div class="phrase-face phrase-back">${p.es}<div class="phrase-pron">/${p.pr}/</div></div>
      </div>
    </div>`).join('');
  grid.querySelectorAll('.phrase-card').forEach(card => {
    card.addEventListener('click', () => card.classList.toggle('flipped'));
  });
}

function renderFood() {
  const grid = document.getElementById('food-grid');
  const prog = document.getElementById('food-progress');
  if (!grid) return;
  const data    = CULTURE_DATA[_activeCultureCountry];
  let ratings   = {};
  try { ratings = JSON.parse(localStorage.getItem('la_aventura_food_ratings') || '{}'); } catch {}
  const key     = name => `${_activeCultureCountry}::${name}`;
  let tasted    = 0;
  grid.innerHTML = data.foods.map(f => {
    const r = ratings[key(f.n)] || 0;
    if (r > 0) tasted++;
    const stars = [1,2,3,4,5].map(i => `<span class="food-star ${i <= r ? 'on':''}" data-name="${f.n}" data-val="${i}">★</span>`).join('');
    return `
      <div class="food-card ${r > 0 ? 'tasted':''}">
        <div class="food-emoji">${f.e}</div>
        <div class="food-name">${f.n}</div>
        <div class="food-desc">${f.d}</div>
        <div class="food-stars">${stars}</div>
      </div>`;
  }).join('');
  if (prog) prog.textContent = `${tasted} / ${data.foods.length} tasted`;
  grid.querySelectorAll('.food-star').forEach(star => {
    star.addEventListener('click', () => {
      let cur = {};
      try { cur = JSON.parse(localStorage.getItem('la_aventura_food_ratings') || '{}'); } catch {}
      const k = key(star.dataset.name);
      const v = parseInt(star.dataset.val, 10);
      cur[k] = cur[k] === v ? 0 : v;  // tap same → clear
      localStorage.setItem('la_aventura_food_ratings', JSON.stringify(cur));
      renderFood();
    });
  });
}

function renderMusic() {
  const grid = document.getElementById('music-grid');
  if (!grid) return;
  const data = CULTURE_DATA[_activeCultureCountry];
  grid.innerHTML = data.music.map(m => `
    <div class="music-card">
      <div class="music-genre">${m.genre}</div>
      <div class="music-title">${m.title}</div>
      <div class="music-actions">
        <a class="music-btn" target="_blank" rel="noopener" href="https://open.spotify.com/search/${encodeURIComponent(m.q)}">▶ Spotify</a>
        <a class="music-btn" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${m.yt}">▶ YouTube</a>
      </div>
    </div>`).join('');
}

function renderEmergency() {
  const grid = document.getElementById('emergency-grid');
  if (!grid) return;
  const data = CULTURE_DATA[_activeCultureCountry];
  grid.innerHTML = data.emergency.map(e => `
    <div class="em-card" data-copy="${e.num}" title="Click to copy">
      <div class="em-label">${e.label}</div>
      <div class="em-num">${e.num}</div>
    </div>`).join('');
  grid.querySelectorAll('.em-card').forEach(card => {
    card.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(card.dataset.copy);
        showToast?.(`📋 Copied ${card.dataset.copy}`, 'success', 1500);
      } catch {
        showToast?.('Could not copy', 'error');
      }
    });
  });
}

function renderClimate() {
  const grid = document.getElementById('climate-grid');
  if (!grid) return;
  const cities = CLIMATE_DATA.filter(c => c.leg === _activeCultureCountry);
  grid.innerHTML = cities.map(c => `
    <div class="climate-card">
      <div class="cl-city">${c.city}</div>
      <div class="cl-emoji">${c.e}</div>
      <div class="cl-temp">${c.hi}° / ${c.lo}°</div>
      <div class="cl-note">${c.note}</div>
    </div>`).join('');
}

// ─────────────────────────────────────────────────────────────
// AMBIENT BACKGROUND — cinematic color shift per section
// ─────────────────────────────────────────────────────────────
const AMBIENT_PALETTES = {
  'map-section':      ['#0d1117', '#161b22', '#fef7ed', '#fff5ea'],
  'timeline-section': ['#1a1a2e', '#16213e', '#f0f4ff', '#ffffff'],
  'destinos':         ['#2d1b3d', '#1a1424', '#fff7ed', '#ffeacc'],
  'budget':           ['#1e3a2f', '#0f1f1a', '#ecfdf5', '#d1fae5'],
  'culture':          ['#3d1b2f', '#241420', '#fff1f2', '#ffe4e6'],
  'amigos':           ['#1e293b', '#0f172a', '#eff6ff', '#dbeafe'],
  'packing':          ['#2d2a1a', '#1c1a0f', '#fefce8', '#fef9c3'],
  'memories':         ['#3d1b1b', '#241010', '#fef2f2', '#ffe4e4'],
  'notas':            ['#1a2d3d', '#0f1c24', '#f0f9ff', '#e0f2fe'],
};

function initAmbient() {
  const root = document.documentElement;
  const sections = Object.keys(AMBIENT_PALETTES).map(id => document.getElementById(id)).filter(Boolean);
  if (!sections.length) return;

  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting && en.intersectionRatio > 0.4) {
        const p = AMBIENT_PALETTES[en.target.id];
        if (p) {
          root.style.setProperty('--amb1', p[0]);
          root.style.setProperty('--amb2', p[1]);
          root.style.setProperty('--amb1-light', p[2]);
          root.style.setProperty('--amb2-light', p[3]);
        }
      }
    });
  }, { threshold: [0.4, 0.6] });
  sections.forEach(s => io.observe(s));

  // Parallax on map title
  const mapTitle = document.getElementById('map-overlay-title');
  if (mapTitle) {
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (y < 800) mapTitle.style.transform = `translateY(${y * 0.3}px)`;
    }, { passive: true });
  }
}

// ─────────────────────────────────────────────────────────────
// TRAVEL STATS DASHBOARD
// ─────────────────────────────────────────────────────────────
function haversineKm(a, b) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat/2)**2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function initStatsDashboard() {
  const counters  = document.getElementById('stats-counters');
  const heatmap   = document.getElementById('heatmap-grid');
  const distBody  = document.getElementById('dist-table-body');
  if (!counters || !heatmap || !distBody) return;

  const stops = TRIP.stops;
  let totalKm = 0;
  const segments = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const d = haversineKm(stops[i].coords, stops[i+1].coords);
    totalKm += d;
    segments.push({ from: stops[i], to: stops[i+1], km: d });
  }
  const totalNights = stops.reduce((s, x) => s + x.nights, 0);
  const countries   = new Set(stops.map(s => s.leg)).size;
  const cities      = stops.length;
  const flights     = segments.filter(s => s.from.leg !== s.to.leg).length;

  // Counters with simple count-up animation
  const counterDefs = [
    { label: 'Cities',    val: cities,                fmt: n => n },
    { label: 'Countries', val: countries,             fmt: n => n },
    { label: 'Nights',    val: totalNights,           fmt: n => n },
    { label: 'Total km',  val: Math.round(totalKm),   fmt: n => n.toLocaleString() },
    { label: 'Flights',   val: flights,               fmt: n => n },
    { label: 'Avg/city',  val: Math.round(totalNights / cities), fmt: n => `${n} nts` },
  ];
  counters.innerHTML = counterDefs.map((c, i) =>
    `<div class="stat-counter"><div class="stat-c-num" data-target="${c.val}" data-fmt-idx="${i}">0</div><div class="stat-c-label">${c.label}</div></div>`
  ).join('');

  function animateCounters() {
    counters.querySelectorAll('.stat-c-num').forEach(el => {
      const target = parseInt(el.dataset.target, 10);
      const def = counterDefs[parseInt(el.dataset.fmtIdx,10)];
      const dur = 1200;
      const t0 = performance.now();
      function step(t) {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = def.fmt(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }
  // Animate when section enters viewport
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) { animateCounters(); io.disconnect(); }
    });
  }, { threshold: 0.3 });
  io.observe(counters);

  // Heatmap of nights per city
  const maxNights = Math.max(...stops.map(s => s.nights));
  heatmap.innerHTML = stops.map(s => `
    <div class="hm-city">${s.emoji||'📍'} ${s.city}</div>
    <div class="hm-bar-track"><div class="hm-bar-fill" style="width:${(s.nights/maxNights)*100}%; background:${getLegColor(s.leg)}"></div></div>
    <div class="hm-num">${s.nights}</div>
  `).join('');

  // Distance breakdown table
  distBody.innerHTML = segments.map(s => `
    <tr>
      <td>${s.from.emoji||''} ${s.from.city}</td>
      <td style="color:var(--accent)">→</td>
      <td>${s.to.emoji||''} ${s.to.city}</td>
      <td>${Math.round(s.km).toLocaleString()} km${s.from.leg !== s.to.leg ? ' ✈️' : ''}</td>
    </tr>
  `).join('') + `<tr><td colspan="3"><strong>Total</strong></td><td><strong>${Math.round(totalKm).toLocaleString()} km</strong></td></tr>`;
}

// ─────────────────────────────────────────────────────────────
// DAILY JOURNAL
// ─────────────────────────────────────────────────────────────
function initJournal() {
  const strip   = document.getElementById('journal-strip');
  const dateEl  = document.getElementById('je-date');
  const statusEl= document.getElementById('je-status');
  const moods   = document.querySelectorAll('.mood-btn');
  const tags    = document.querySelectorAll('.tag-chip');
  const text    = document.getElementById('je-text');
  if (!strip || !dateEl) return;

  // Date range: trip start → trip end (or +80 days)
  const start = parseDate(TRIP.startDate || '2026-10-23');
  const totalDays = 80;
  const days = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  const isoKey = d => d.toISOString().slice(0, 10);

  let entries = {};
  try { entries = JSON.parse(localStorage.getItem('la_aventura_journal') || '{}'); } catch {}

  let active = isoKey(days[0]);

  function renderStrip() {
    strip.innerHTML = days.map(d => {
      const k = isoKey(d);
      const e = entries[k];
      const isActive = k === active;
      return `
        <div class="js-day ${isActive ? 'active':''} ${e ? 'has-entry':''}" data-k="${k}">
          <div class="js-d-wk">${d.toLocaleDateString('en-US',{weekday:'short'})}</div>
          <div class="js-d-num">${d.getDate()}</div>
          <div class="js-d-mo">${d.toLocaleDateString('en-US',{month:'short'})}</div>
          <div class="js-d-mood">${e?.mood || '·'}</div>
        </div>`;
    }).join('');
    strip.querySelectorAll('.js-day').forEach(el => {
      el.addEventListener('click', () => { active = el.dataset.k; loadEntry(); renderStrip(); el.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'}); });
    });
  }

  function loadEntry() {
    const e = entries[active] || { mood: '', tags: [], text: '' };
    const d = new Date(active);
    dateEl.textContent = d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
    moods.forEach(m => m.classList.toggle('active', m.dataset.mood === e.mood));
    tags.forEach(t => t.classList.toggle('active', (e.tags || []).includes(t.dataset.tag)));
    text.value = e.text || '';
    statusEl.textContent = e.text || e.mood ? '✓ Saved' : '— new entry —';
  }

  function saveEntry() {
    const sel = Array.from(tags).filter(t => t.classList.contains('active')).map(t => t.dataset.tag);
    const mood = Array.from(moods).find(m => m.classList.contains('active'))?.dataset.mood || '';
    if (!sel.length && !mood && !text.value.trim()) { delete entries[active]; }
    else { entries[active] = { mood, tags: sel, text: text.value }; }
    localStorage.setItem('la_aventura_journal', JSON.stringify(entries));
    statusEl.textContent = '✓ Saved ' + new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    renderStrip();
    renderMoodBars();
  }

  moods.forEach(m => m.addEventListener('click', () => {
    const wasActive = m.classList.contains('active');
    moods.forEach(b => b.classList.remove('active'));
    if (!wasActive) m.classList.add('active');
    saveEntry();
  }));
  tags.forEach(t => t.addEventListener('click', () => { t.classList.toggle('active'); saveEntry(); }));

  let dt;
  text.addEventListener('input', () => { clearTimeout(dt); dt = setTimeout(saveEntry, 500); });

  function renderMoodBars() {
    const counts = {};
    Object.values(entries).forEach(e => { if (e.mood) counts[e.mood] = (counts[e.mood] || 0) + 1; });
    const moodList = ['😍','🤩','😊','🙂','😐','😩','🤒'];
    const max = Math.max(1, ...Object.values(counts));
    const bars = document.getElementById('mood-bars');
    if (!bars) return;
    bars.innerHTML = moodList.map(m => {
      const c = counts[m] || 0;
      return `<div class="mb-emoji">${m}</div><div class="mb-track"><div class="mb-fill" style="width:${(c/max)*100}%"></div></div><div class="mb-count">${c}</div>`;
    }).join('');
  }

  renderStrip();
  loadEntry();
  renderMoodBars();
}

// ─────────────────────────────────────────────────────────────
// CONFETTI HELPER (canvas-confetti CDN)
// ─────────────────────────────────────────────────────────────
function fireConfetti(kind = 'default') {
  if (typeof confetti !== 'function') return;
  const presets = {
    'trip-start':   { particleCount: 300, spread: 120, origin: { y: 0.6 }, scalar: 1.2 },
    'packing-half': { particleCount: 120, spread: 80,  origin: { y: 0.7 } },
    'first-memory': { particleCount: 100, spread: 60,  origin: { y: 0.7 } },
    'under-budget': { particleCount: 180, spread: 90,  origin: { y: 0.6 }, colors: ['#22a447','#f59e0b','#5b9bd5'] },
    'easter':       { particleCount: 200, spread: 90,  origin: { y: 0.5 } },
    'default':      { particleCount: 80,  spread: 60,  origin: { y: 0.7 } },
  };
  confetti(presets[kind] || presets.default);
}

// ─────────────────────────────────────────────────────────────
// SMART INSIGHTS (rule-based "AI" trip tips)
// ─────────────────────────────────────────────────────────────
const INSIGHTS_DISMISSED_KEY = 'la_aventura_dismissed_insights';

function generateInsights() {
  const out = [];
  const stops = (typeof TRIP !== 'undefined' && TRIP.stops) ? TRIP.stops : [];
  const startDate = new Date('2026-10-23T00:00:00');
  const today = new Date();
  const daysUntil = Math.ceil((startDate - today) / 86400000);

  // 1. Countdown
  if (daysUntil > 0) {
    out.push({ id:'countdown', icon:'⏳', html:`Only <strong>${daysUntil} days</strong> until you set foot in Lima. Start brushing up on your Spanish!` });
  } else if (daysUntil > -80) {
    out.push({ id:'on-trip', icon:'🌎', html:`You're <strong>${Math.abs(daysUntil)+1} days</strong> into the adventure. Soak it in!` });
  }

  // 2. Longest stop
  if (stops.length) {
    const longest = [...stops].sort((a,b)=>(b.nights||0)-(a.nights||0))[0];
    if (longest) out.push({ id:'longest', icon:'🏖️', html:`Your longest stop is <strong>${longest.city}</strong> (${longest.nights} nights) — perfect time to slow down and explore deeply.` });
  }

  // 3. Total nights & countries
  const totalNights = stops.reduce((s,x)=>s+(x.nights||0),0);
  const countries = new Set(stops.map(s=>s.leg));
  out.push({ id:'totals', icon:'📊', html:`<strong>${totalNights} nights</strong> across <strong>${countries.size} countries</strong> and <strong>${stops.length} cities</strong> — that's an epic itinerary.` });

  // 4. Budget pulse
  try {
    const expenses = JSON.parse(localStorage.getItem('la_aventura_expenses')||'[]');
    if (expenses.length) {
      const spent = expenses.reduce((s,e)=>s+(e.amount||0),0);
      const estimate = totalNights * 52; // avg
      const pct = Math.round(spent/estimate*100);
      if (pct < 80) {
        out.push({ id:'budget-good', icon:'💰', html:`You've spent <strong>$${spent.toFixed(0)}</strong> — about <strong>${pct}%</strong> of your estimated budget. You're on pace!` });
        // confetti once for under-budget
        if (pct < 60 && !window._underBudgetFired) {
          window._underBudgetFired = true;
          if (typeof fireConfetti === 'function') fireConfetti('under-budget');
        }
      } else {
        out.push({ id:'budget-warn', icon:'⚠️', html:`Heads up: you've used <strong>${pct}%</strong> of your budget. Consider reining in those caipirinhas 🍹` });
      }
    } else {
      out.push({ id:'budget-empty', icon:'🧾', html:`No expenses logged yet. Track your first one to unlock budget insights.` });
    }
  } catch {}

  // 5. Packing
  try {
    const pack = JSON.parse(localStorage.getItem('la_aventura_packing')||'{}');
    const all = Object.values(pack).flat();
    if (all.length) {
      const done = all.filter(i=>i.checked).length;
      const pct = Math.round(done/all.length*100);
      out.push({ id:'packing', icon:'🎒', html:`Packing progress: <strong>${pct}%</strong> (${done}/${all.length}). ${pct===100?'You\'re ready to fly!':'Keep ticking those boxes.'}` });
    }
  } catch {}

  // 6. Friend overlap
  try {
    const friends = JSON.parse(localStorage.getItem('la_aventura_friends')||'[]');
    if (friends.length) {
      out.push({ id:'friends', icon:'👥', html:`<strong>${friends.length} friend${friends.length>1?'s':''}</strong> joining segments of the trip — group adventures incoming!` });
    }
  } catch {}

  // 7. Climate tip
  out.push({ id:'climate-peru', icon:'☀️', html:`Late October in <strong>Peru</strong> is dry season — perfect for the Inca Trail. Bring layers for cold Cusco nights though.` });
  out.push({ id:'climate-brazil', icon:'🌴', html:`November in <strong>Rio</strong> means warm Atlantic vibes and pre-summer beach days. Sunscreen is non-negotiable.` });
  out.push({ id:'climate-arg', icon:'🍷', html:`December in <strong>Patagonia</strong> = peak hiking season. Long daylight hours mean more time on the trails.` });

  // 8. Culture nudge
  out.push({ id:'language', icon:'🗣️', html:`Knowing even basic <strong>Spanish/Portuguese</strong> opens doors. Check the Culture Hub for essential phrases.` });

  // 9. Currency reminder
  out.push({ id:'currency', icon:'💱', html:`The <strong>Argentine peso</strong> swings wildly. Use the live converter and bring USD cash for blue-market rates.` });

  // 10. Photo nudge
  out.push({ id:'photos', icon:'📸', html:`Pro tip: drop photos into the Memory Wall daily — your future self will thank you.` });

  return out;
}

function renderInsights() {
  const wrap = document.getElementById('insights-list');
  if (!wrap) return;
  const dismissed = JSON.parse(localStorage.getItem(INSIGHTS_DISMISSED_KEY)||'[]');
  const insights = generateInsights().filter(i => !dismissed.includes(i.id));
  if (!insights.length) {
    wrap.innerHTML = `<p style="color:var(--text-muted);font-style:italic;margin-top:0.6rem;">You've dismissed all insights. <button id="insights-reset" class="btn-ghost" style="margin-left:0.4rem;">Reset</button></p>`;
    document.getElementById('insights-reset')?.addEventListener('click', () => {
      localStorage.removeItem(INSIGHTS_DISMISSED_KEY);
      renderInsights();
    });
    return;
  }
  // Show up to 4 insights, rotated by day of year so they feel fresh
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(),0,0).getTime())/86400000);
  const shown = [];
  for (let i = 0; i < Math.min(4, insights.length); i++) {
    shown.push(insights[(dayOfYear + i) % insights.length]);
  }
  wrap.innerHTML = shown.map(i => `
    <div class="insight-card" data-id="${i.id}">
      <span class="insight-icon">${i.icon}</span>
      <div class="insight-body">${i.html}</div>
      <button class="insight-dismiss" title="Dismiss">✕</button>
    </div>
  `).join('');
  wrap.querySelectorAll('.insight-dismiss').forEach(btn => {
    btn.addEventListener('click', e => {
      const card = e.target.closest('.insight-card');
      const id = card.dataset.id;
      const d = JSON.parse(localStorage.getItem(INSIGHTS_DISMISSED_KEY)||'[]');
      d.push(id);
      localStorage.setItem(INSIGHTS_DISMISSED_KEY, JSON.stringify(d));
      card.style.transition = 'all 0.3s';
      card.style.opacity = '0';
      card.style.transform = 'translateX(20px)';
      setTimeout(renderInsights, 300);
    });
  });
}

function initInsights() { renderInsights(); }

// ─────────────────────────────────────────────────────────────
// STORY MODE
// ─────────────────────────────────────────────────────────────
function initStoryMode() {
  const btn   = document.getElementById('story-mode-btn');
  const modal = document.getElementById('story-mode');
  const stage = document.getElementById('story-stage');
  const prog  = document.getElementById('story-progress');
  if (!btn || !modal || !stage) return;

  const flags = { peru: '🇵🇪', brazil: '🇧🇷', argentina: '🇦🇷' };
  const names = { peru: 'Peru', brazil: 'Brazil', argentina: 'Argentina' };
  let idx = 0;
  let autoTimer = null;
  const stops = TRIP.stops || [];

  function buildCards() {
    stage.innerHTML = stops.map((s, i) => `
      <div class="story-card" data-i="${i}">
        <div class="story-flag">${flags[s.leg] || '🌎'}</div>
        <div class="story-country">${names[s.leg] || s.leg} · Stop ${i+1} of ${stops.length}</div>
        <h2 class="story-city">${escapeHTML(s.city)}</h2>
        <div class="story-meta">
          <span><strong>${s.nights||'?'}</strong>nights</span>
          <span><strong>${(s.start||'').slice(5)}</strong>arrive</span>
          <span><strong>${(s.end||'').slice(5)}</strong>depart</span>
        </div>
        <ul class="story-activities">
          ${(s.activities || []).slice(0,5).map(a => `<li>✦ ${escapeHTML(a)}</li>`).join('')}
        </ul>
      </div>
    `).join('');
    prog.innerHTML = stops.map((_,i)=>`<div class="story-dot" data-i="${i}"></div>`).join('');
    prog.querySelectorAll('.story-dot').forEach(d => {
      d.addEventListener('click', () => show(Number(d.dataset.i)));
    });
  }

  function show(i) {
    idx = (i + stops.length) % stops.length;
    stage.querySelectorAll('.story-card').forEach((c, ci) => {
      c.classList.toggle('active', ci === idx);
      c.classList.toggle('exit-left', ci < idx);
    });
    prog.querySelectorAll('.story-dot').forEach((d, di) => {
      d.classList.toggle('active', di === idx);
    });
  }

  function open() {
    buildCards();
    modal.classList.remove('hidden');
    show(0);
    document.body.style.overflow = 'hidden';
  }
  function close() {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    stopAuto();
  }
  function startAuto() {
    stopAuto();
    autoTimer = setInterval(() => show(idx + 1), 3500);
    document.getElementById('story-auto').textContent = '⏸ Pause';
  }
  function stopAuto() {
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = null;
    const a = document.getElementById('story-auto');
    if (a) a.textContent = '▶ Auto';
  }

  btn.addEventListener('click', open);
  document.getElementById('story-close').addEventListener('click', close);
  document.getElementById('story-prev').addEventListener('click', () => { stopAuto(); show(idx - 1); });
  document.getElementById('story-next').addEventListener('click', () => { stopAuto(); show(idx + 1); });
  document.getElementById('story-auto').addEventListener('click', () => {
    autoTimer ? stopAuto() : startAuto();
  });
  document.addEventListener('keydown', e => {
    if (modal.classList.contains('hidden')) return;
    if (e.key === 'ArrowRight') { stopAuto(); show(idx + 1); }
    if (e.key === 'ArrowLeft')  { stopAuto(); show(idx - 1); }
    if (e.key === 'Escape')     close();
  });
  // Swipe
  let touchX = null;
  stage.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive:true });
  stage.addEventListener('touchend', e => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) { stopAuto(); show(idx + (dx < 0 ? 1 : -1)); }
    touchX = null;
  });
}

// ─────────────────────────────────────────────────────────────
// MEMORY SLIDESHOW
// ─────────────────────────────────────────────────────────────
function initMemoriesSlideshow() {
  const modal   = document.getElementById('mem-slideshow');
  const imgEl   = document.getElementById('mss-image');
  const capEl   = document.getElementById('mss-caption');
  const countEl = document.getElementById('mss-counter');
  if (!modal || !imgEl) return;
  let idx = 0;
  let timer = null;
  let items = [];

  function show(i) {
    if (!items.length) return;
    idx = (i + items.length) % items.length;
    imgEl.style.animation = 'none';
    void imgEl.offsetWidth;
    imgEl.style.animation = '';
    imgEl.src = items[idx].url;
    capEl.textContent = items[idx].caption || '';
    countEl.textContent = `${idx+1} / ${items.length}`;
  }
  function open() {
    items = (typeof loadMemories === 'function' ? loadMemories() : []);
    if (!items.length) { showToast?.('No memories yet — add some first', 'warning'); return; }
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    show(0);
  }
  function close() {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    stopAuto();
  }
  function startAuto() {
    stopAuto();
    timer = setInterval(() => show(idx + 1), 4000);
    document.getElementById('mss-auto').textContent = '⏸ Pause';
  }
  function stopAuto() {
    if (timer) clearInterval(timer);
    timer = null;
    const a = document.getElementById('mss-auto');
    if (a) a.textContent = '▶ Auto';
  }

  document.querySelectorAll('.mv-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.mv-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      if (b.dataset.mode === 'slideshow') open();
    });
  });
  document.getElementById('mss-close').addEventListener('click', close);
  document.getElementById('mss-prev').addEventListener('click', () => { stopAuto(); show(idx - 1); });
  document.getElementById('mss-next').addEventListener('click', () => { stopAuto(); show(idx + 1); });
  document.getElementById('mss-auto').addEventListener('click', () => {
    timer ? stopAuto() : startAuto();
  });
  document.addEventListener('keydown', e => {
    if (modal.classList.contains('hidden')) return;
    if (e.key === 'ArrowRight') { stopAuto(); show(idx + 1); }
    if (e.key === 'ArrowLeft')  { stopAuto(); show(idx - 1); }
    if (e.key === 'Escape')     close();
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
  initCollapsible('notes-toggle-header', 'notes-body');
  initShareCard();
  initTourMode();
  initGlobe();
  initCurrencyConverter();
  initWorldClocks();
  initCollapsible('culture-toggle-header', 'culture-body');
  initCulture();
  initAmbient();
  initCollapsible('stats-toggle-header', 'stats-body');
  initStatsDashboard();
  initCollapsible('journal-toggle-header', 'journal-body');
  initJournal();
  initInsights();
  initStoryMode();
  initMemoriesSlideshow();
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
