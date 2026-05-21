/* ============================================================
   THE ADVENTURE â€” SOUTH AMERICA 2026
   app.js â€” Map, Timeline, Cards, Notes, Friends, Tour Mode
   Trip data lives in tripdata.js (DEFAULT_TRIP_DATA).
   User edits are stored in localStorage key 'la_aventura_trip'.
   ============================================================ */

'use strict';

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// LEGS METADATA (countries)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const LEGS = {
  peru:      { name: 'Peru',      color: '#E8834A', flag: 'ðŸ‡µðŸ‡ª' },
  brazil:    { name: 'Brazil',    color: '#22a447', flag: 'ðŸ‡§ðŸ‡·' },
  argentina: { name: 'Argentina', color: '#5b9bd5', flag: 'ðŸ‡¦ðŸ‡·' },
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TRIP DATA â€” loaded from localStorage or DEFAULT_TRIP_DATA
// computed dates from tripdata.js (loaded before this script)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    b.innerHTML = 'âœï¸ Trip plan updated! <button onclick="location.reload()" style="margin-left:0.5rem;background:rgba(255,255,255,0.25);border:none;color:#fff;padding:0.2rem 0.8rem;border-radius:999px;cursor:pointer;font-weight:700">â†º Reload</button>';
    b.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#E8834A;color:#fff;text-align:center;padding:0.75rem 1rem;z-index:9999;font-size:0.9rem;';
    document.body.appendChild(b);
  }
});

// UTILITY HELPERS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  // Last day (Jan 2 â€“ Jan 5 = departure)
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MAP INITIALIZATION
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let map;

function initMap() {
  map = L.map('map', {
    center:     [-20, -60],
    zoom:       4,
    zoomControl: true,
  });

  // Dark CartoDB tile layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: 'Â© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> Â© <a href="https://carto.com/">CARTO</a>',
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
        <div class="popup-dates">ðŸ“… ${formatDateShort(parseDate(stop.startDate))} â€“ ${formatDateShort(parseDate(stop.endDate))} Â· ${stop.nights} night${stop.nights !== 1 ? 's' : ''}</div>
        <ul class="popup-activities">${topActivities}</ul>
        <div class="popup-food">${stop.food}</div>
        <div class="popup-budget">ðŸ’µ ~$${stop.budgetPerDay}/day Â· ðŸ¨ ${stop.accommodation}</div>
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
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TOUR MODE â€” geographical route playback on the live map
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    // âœˆï¸ default points right (east â‰ˆ 90Â°), so subtract 90 to align.
    const rot = bearing - 90;
    return L.divIcon({
      className:  '',
      iconSize:   [34, 34],
      iconAnchor: [17, 17],
      html: `<div class="traveler-icon" style="transform:rotate(${rot}deg);--tc:${color}">âœˆï¸</div>`,
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
    subEl.textContent  = `${legInfo.flag} ${legInfo.name} Â· ${formatDateShort(parseDate(stop.startDate))} â€“ ${formatDateShort(parseDate(stop.endDate))} Â· ${stop.nights} night${stop.nights !== 1 ? 's' : ''}`;
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
   * `animated` = true â†’ animate traveler from previous stop.
   * `backward`  = true â†’ just jump (no line drawn backwards).
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
      // Instant jump â€” update traveler position & icon
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

  // â”€â”€ Playback control â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function startAutoPlay() {
    isPlaying = true;
    pauseBtn.textContent = 'â¸';
    pauseBtn.title = 'Pause';
    clearInterval(stepTimer);
    stepTimer = setInterval(() => {
      if (currentIdx < TOTAL - 1) {
        showStop(currentIdx + 1, true, false);
      } else {
        pauseAutoPlay();   // reached last stop â€” stop
      }
    }, STEP_MS);
  }

  function pauseAutoPlay() {
    isPlaying = false;
    pauseBtn.textContent = 'â–¶';
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

  // â”€â”€ Entry point â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TIMELINE GENERATION
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildTimeline() {
  const container = document.getElementById('timeline-container');
  const allDates  = generateDateRange(TRIP.startDate, TRIP.endDate);

  // We'll build a Monday-aligned calendar grid
  // Find the Monday on or before the start date
  const firstDate = parseDate(TRIP.startDate);
  const startDay  = firstDate.getDay(); // 0=Sun, 1=Monâ€¦
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

    // Week row â€” inject month label before week if month changes
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
        cell.title = `${stop.city} â€” ${formatDateShort(dayCur)}`;

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
        <div class="tl-detail-dates">${legInfo.flag} ${legInfo.name} Â· ${formatDateShort(parseDate(stop.startDate))} â€“ ${formatDateShort(parseDate(stop.endDate))} Â· ${stop.nights} nights</div>
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
        <p>~$${stop.budgetPerDay} USD/day Â· ${stop.accommodation}</p>
        <br>
        <h4>Next Transport</h4>
        <p>${stop.transport}</p>
      </div>
    </div>
  `;

  detail.classList.remove('hidden');
  detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DESTINATION CARDS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        <span class="card-dates-badge">${formatDateShort(parseDate(stop.startDate))} â€“ ${formatDateShort(parseDate(stop.endDate))}</span>
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
          <div class="card-chip">ðŸ’µ <span>~$${stop.budgetPerDay}/day</span></div>
          <div class="card-chip">ðŸŒ™ <span>${stop.nights} nights</span></div>
        </div>
        <div>
          <div class="card-section-label">Accommodation</div>
          <div class="card-chip">ðŸ¨ <span>${stop.accommodation}</span></div>
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// FRIENDS PANEL
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      <button class="friend-delete" data-id="${f.id}" title="Remove">âœ•</button>
      <div class="friend-card-header">
        <div class="friend-avatar" style="background:${f.color}">${initials}</div>
        <div>
          <div class="friend-name">${escapeHTML(f.name)}</div>
          <div class="friend-legs">${escapeHTML(f.legs)}</div>
        </div>
      </div>
      <div class="friend-dates">ðŸ“… ${escapeHTML(f.dates)}</div>
      <div class="friend-note-display" id="note-display-${f.id}">
        ${f.note ? `<div class="friend-note">ðŸ’¬ "${escapeHTML(f.note)}"</div>` : '<div class="friend-note-empty">No note yet</div>'}
        <button class="friend-edit-note-btn" data-id="${f.id}">âœï¸ Edit note</button>
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
    form.classList.add('hidden');
    clearFriendForm();
  });
}

function clearFriendForm() {
  ['f-name', 'f-legs', 'f-dates', 'f-note'].forEach(id => {
    document.getElementById(id).value = '';
  });
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// NOTES
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let notes = [];
let activeFilter = 'all';

const TYPE_ICONS = {
  idea:       'ðŸ’¡',
  reminder:   'â°',
  food:       'ðŸ½ï¸',
  logistics:  'âœˆï¸',
  excitement: 'ðŸŽ‰',
};

function loadNotes() {
  try {
    const stored = localStorage.getItem('la_aventura_notes');
    notes = stored ? JSON.parse(stored) : [];
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
        <span class="note-author">ðŸ‘¤ ${escapeHTML(note.author || 'Anonymous')}</span>
        <div class="note-badges">
          <span class="note-badge ${legClass}">${note.leg}</span>
          <span style="font-size:1.1rem">${TYPE_ICONS[note.type] || 'ðŸ“'}</span>
        </div>
      </div>
      <div class="note-text">${escapeHTML(note.text)}</div>
      <div class="note-meta">
        <span>${note.date}</span>
        <button class="note-delete" data-id="${note.id}">âœ• delete</button>
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MOBILE NAV
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function initMobileNav() {
  document.getElementById('hamburger').addEventListener('click', () => {
    const nav = document.getElementById('mobile-nav');
    nav.classList.toggle('hidden');
  });
}

function closeMobileNav() {
  document.getElementById('mobile-nav').classList.add('hidden');
}
window.closeMobileNav = closeMobileNav;

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SECURITY: HTML escape helper
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// HEADER SCROLL EFFECT
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MAIN INIT
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.addEventListener('DOMContentLoaded', () => {
  populatePageStats();
  initMap();
  buildTimeline();
  initTabs();
  initFriends();
  initNotes();
  initMobileNav();
  initScrollEffect();
  initTourMode();

  console.log('%cðŸŒŽ The Adventure â€” South America 2026', 'font-size:16px; font-weight:bold; color:#E8834A');
  console.log('%cTrip data loaded:', 'color:#22a447', TRIP.stops.length, 'stops across', Object.keys(TRIP.legs).length, 'countries');
  console.log('%cNotes stored in localStorage key: la_aventura_notes', 'color:#5b9bd5');
  console.log('%cTo connect to Firebase/Supabase, replace loadNotes/saveNotesToStorage with API calls.', 'color:#94a3b8');
});
