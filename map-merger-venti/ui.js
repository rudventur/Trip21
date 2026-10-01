// ═══════════════════════════════════════════════════════════════
//  ui.js — All UI: layers, smooth zoom, country selector, modals,
//          grid, compass, listings, conspiracy patch, bus stops
// ═══════════════════════════════════════════════════════════════

// Pre-declare shared state
var busStops = [];
var waterBodies = [];
var boatNearWater = false;

// ── View mode (Full Screen Horizontal / Panoramic / Vertical / Normal) ──
// Shared with snout-first.html and translator_v7.html via the same
// localStorage key, so "Redirect" can carry the current mode across tabs.
var VIEW_MODE_KEY = 'rvViewMode';

function requestFS() {
  var el = document.documentElement;
  var fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  return fn ? fn.call(el).catch(function() {}) : Promise.resolve();
}
function exitFS() {
  if (!document.fullscreenElement && !document.webkitFullscreenElement) return Promise.resolve();
  var fn = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
  return fn ? fn.call(document).catch(function() {}) : Promise.resolve();
}
function lockOrientation(type) {
  try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock(type).catch(function() {}); } catch (e) {}
}
function unlockOrientation() {
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
}
function applyViewMode(mode) {
  switch (mode) {
    case 'horizontal': requestFS().then(function() { lockOrientation('landscape'); }); break;
    case 'panoramic':  requestFS().then(function() { unlockOrientation(); }); break;
    case 'vertical':   requestFS().then(function() { lockOrientation('portrait'); }); break;
    case 'normal':      unlockOrientation(); exitFS(); break;
  }
}
function currentViewMode() {
  return localStorage.getItem(VIEW_MODE_KEY) || '';
}
function setView(mode) {
  localStorage.setItem(VIEW_MODE_KEY, mode);
  closeViewMenu();
  applyViewMode(mode);
}

// Adopt ?view= from a Redirect link (highest priority), else fall back to the
// last mode chosen on this device. Fullscreen needs a real user gesture, so
// it's applied on the first click/keydown rather than immediately on load
// (this also replaces the old unconditional "auto fullscreen on first
// interaction" behavior — it now only fires when a mode is actually pending).
(function() {
  var pendingViewMode = null;
  var params = new URLSearchParams(location.search);
  var urlMode = params.get('view');
  if (urlMode) {
    localStorage.setItem(VIEW_MODE_KEY, urlMode);
    params.delete('view');
    var clean = location.pathname + (params.toString() ? '?' + params.toString() : '') + location.hash;
    history.replaceState(null, '', clean);
    pendingViewMode = urlMode;
  } else {
    pendingViewMode = localStorage.getItem(VIEW_MODE_KEY);
  }
  if (!pendingViewMode || pendingViewMode === 'normal') return;
  function autoApply() {
    applyViewMode(pendingViewMode);
    document.removeEventListener('click', autoApply);
    document.removeEventListener('keydown', autoApply);
  }
  document.addEventListener('click', autoApply, { once: true });
  document.addEventListener('keydown', autoApply, { once: true });
})();

// ── LAYERS MENU ──
function toggleLayersMenu() {
  document.getElementById('layersMenu').classList.toggle('show');
  document.getElementById('layersToggle').classList.toggle('open');
}
function setTileLayer(n) {
  G.curTileLayer = n;
  document.querySelectorAll('.layers-menu input[name="bl"]').forEach(r => r.checked = false);
  const el = document.getElementById('bl-' + n);
  if (el) el.checked = true;
  showToast('Map: ' + n, '#00bfff');
}

// ═══════════════════════════════════════════════════════════════
//  SMOOTH ZOOM — continuous float from ZOOM_MIN to ZOOM_MAX
//  G.zoom is the float. Tiles load at floor(G.zoom), scaled by
//  the fractional part. No more clunky jumps.
// ═══════════════════════════════════════════════════════════════

// Target zoom for smooth animation
let _zoomTarget = 15; // will be set from G.zoom on boot
const ZOOM_SPEED = 0.12; // lerp speed per frame (0..1)

function updateZoomUI() {
  const z = Math.round(G.zoom);
  const name = ZOOM_NAMES[z] || 'Z' + z;
  document.getElementById('zLevDisp').textContent = z;
  document.getElementById('zDesc').textContent = name;
  const t = document.getElementById('zTrack');
  const th = document.getElementById('zThumb');
  const pct = (G.zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN);
  th.style.top = (1 - pct) * (t.offsetHeight - 10) + 'px';
}

// Called every frame from game loop to smoothly animate zoom
function updateZoomSmooth() {
  const diff = _zoomTarget - G.zoom;
  if (Math.abs(diff) > 0.01) {
    G.zoom += diff * ZOOM_SPEED;
    updateZoomUI();
  } else if (Math.abs(diff) > 0.001) {
    G.zoom = _zoomTarget;
    updateZoomUI();
  }
}

function zoomIn() {
  _zoomTarget = Math.min(ZOOM_MAX, _zoomTarget + 0.5);
}
function zoomOut() {
  _zoomTarget = Math.max(ZOOM_MIN, _zoomTarget - 0.5);
}

// Set zoom directly (for country select, plane takeoff etc)
function setZoomLevel(z) {
  _zoomTarget = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
  G.zoom = _zoomTarget; // instant jump
  updateZoomUI();
}

// Zoom drag on slider
(function() {
  const t = document.getElementById('zTrack');
  const th = document.getElementById('zThumb');
  let dr = false;
  function sfy(y) {
    const r = t.getBoundingClientRect();
    const pct = 1 - Math.max(0, Math.min(1, (y - r.top) / r.height));
    _zoomTarget = ZOOM_MIN + pct * (ZOOM_MAX - ZOOM_MIN);
    G.zoom = _zoomTarget; // instant for drag
    updateZoomUI();
  }
  th.addEventListener('pointerdown', e => { dr = true; th.setPointerCapture(e.pointerId); });
  th.addEventListener('pointermove', e => { if (dr) sfy(e.clientY); });
  th.addEventListener('pointerup', () => { dr = false; });
  t.addEventListener('click', e => sfy(e.clientY));
})();

// Scroll wheel — smooth, trackpad-friendly
// Only zoom when the cursor is actually over the map canvas, not over
// HUD buttons/panels/modals that happen to sit on top of it.
document.addEventListener('wheel', e => {
  if (e.target.id !== 'world') return;
  // Normalize: trackpads send many small deltas, mice send large discrete ones.
  // deltaMode 1 = lines (~40px each), 0 = pixels
  const px = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
  // Scale so ~120px (one mouse notch) ≈ 0.35 zoom levels; trackpad micro-scrolls stay gentle
  const delta = -px / 340;
  // Clamp individual step so even a fast flick can't jump more than 0.6 levels at once
  const clamped = Math.max(-0.6, Math.min(0.6, delta));
  _zoomTarget = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, _zoomTarget + clamped));
  e.preventDefault();
}, { passive: false });

// Pinch-to-zoom on mobile
let _pinchStartDist = 0;
let _pinchStartZoom = 0;
document.addEventListener('touchstart', e => {
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    _pinchStartDist = Math.sqrt(dx * dx + dy * dy);
    _pinchStartZoom = _zoomTarget;
  }
}, { passive: true });
document.addEventListener('touchmove', e => {
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (_pinchStartDist > 0) {
      const ratio = dist / _pinchStartDist;
      const zoomDelta = Math.log2(ratio) * 2; // 2x pinch = 2 zoom levels
      _zoomTarget = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, _pinchStartZoom + zoomDelta));
    }
    e.preventDefault();
  }
}, { passive: false });
document.addEventListener('touchend', () => { _pinchStartDist = 0; }, { passive: true });

// ── COUNTRY SELECTOR ──
function toggleCountrySelector() {
  const panel = document.getElementById('countryPanel');
  panel.classList.toggle('show');
}

function selectCountry(code) {
  const country = COUNTRIES.find(c => c.code === code);
  if (!country) return;
  G.selectedCountry = country;
  document.getElementById('countryLabel').textContent = country.name;
  document.getElementById('countryPanel').classList.remove('show');
  showToast('\u{1F30D} ' + country.name + ' selected!', '#ffe600');

  G.pos.lat = country.lat;
  G.pos.lng = country.lng;
  setZoomLevel(5); // Country zoom

  // Load mode-specific data for the new location
  trainOnCountrySelect(country);
  if (G.veh === 'bus') loadBusData();
  if (G.veh === 'plane') flyLoadAirports();
  if (G.veh === 'boat') fetchWaterBodies();
  if (G.veh === 'car') { carLoadRoads(); carLoadStations(); }
  if (G.overlays.weather) fetchWeather(G.pos.lat, G.pos.lng);
  if (typeof showFlights !== 'undefined' && showFlights) fetchFlights();
}

function detectCountryFromCoords(lat, lng) {
  let best = null, bestDist = Infinity;
  COUNTRIES.forEach(c => {
    if (lat >= c.bbox[0] && lat <= c.bbox[2] && lng >= c.bbox[1] && lng <= c.bbox[3]) {
      const d = haversine(lat, lng, c.lat, c.lng);
      if (d < bestDist) { bestDist = d; best = c; }
    }
  });
  if (best && (!G.selectedCountry || G.selectedCountry.code !== best.code)) {
    G.selectedCountry = best;
    document.getElementById('countryLabel').textContent = best.name;
    showToast('\u{1F30D} Detected: ' + best.name, '#ffe600');
    if (G.veh === 'train') trainOnCountrySelect(best);
  }
}

// ── DRAW GRID ──
function drawGrid() {
  if (!G.overlays.grid) return;
  const z = getZoom().z;
  let g;
  if (z >= 17) g = 0.001; else if (z >= 15) g = 0.005; else if (z >= 13) g = 0.01;
  else if (z >= 11) g = 0.05; else if (z >= 9) g = 0.1; else if (z >= 7) g = 0.5;
  else if (z >= 5) g = 2; else g = 10;
  ctx.strokeStyle = G.curTileLayer === 'dark' ? 'rgba(0,255,65,0.06)' : 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  const sl = Math.floor(G.pos.lat / g) * g - g * 20;
  const sg = Math.floor(G.pos.lng / g) * g - g * 20;
  for (let lat = sl; lat < sl + g * 40; lat += g) {
    const p = worldToScreen(lat, G.pos.lng);
    if (p.y > -10 && p.y < cv.height + 10) {
      ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(cv.width, p.y); ctx.stroke();
    }
  }
  for (let lng = sg; lng < sg + g * 40; lng += g) {
    const p = worldToScreen(G.pos.lat, lng);
    if (p.x > -10 && p.x < cv.width + 10) {
      ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, cv.height); ctx.stroke();
    }
  }
  ctx.font = "9px 'VT323',monospace";
  ctx.fillStyle = G.curTileLayer === 'dark' ? 'rgba(0,255,65,0.15)' : 'rgba(0,0,0,0.2)';
  ctx.textAlign = 'left';
  for (let lat = sl; lat < sl + g * 40; lat += g) {
    const p = worldToScreen(lat, G.pos.lng);
    if (p.y > 25 && p.y < cv.height - 25) ctx.fillText(lat.toFixed(z >= 13 ? 3 : 1) + '\u00B0', 4, p.y - 2);
  }
  for (let lng = sg; lng < sg + g * 40; lng += g) {
    const p = worldToScreen(G.pos.lat, lng);
    if (p.x > 25 && p.x < cv.width - 50) ctx.fillText(lng.toFixed(z >= 13 ? 3 : 1) + '\u00B0', p.x + 2, cv.height - 62);
  }
}

// ── DRAW COMPASS + COORDS ──
function drawHUD() {
  if (!G.overlays.compass) return;
  ctx.save();
  const cx = cv.width - 70, cy = cv.height - 100;
  ctx.strokeStyle = 'rgba(0,255,65,0.15)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(0,255,65,0.25)'; ctx.font = "8px 'Press Start 2P'"; ctx.textAlign = 'center';
  ctx.fillText('N', cx, cy - 9);
  ctx.fillStyle = 'rgba(0,255,65,0.12)';
  ctx.fillText('S', cx, cy + 13); ctx.fillText('W', cx - 13, cy + 3); ctx.fillText('E', cx + 13, cy + 3);
  // Heading needle in analog mode
  if (G.analogMode) {
    const hRad = G.heading * Math.PI / 180;
    const nx = cx + Math.sin(hRad) * 14, ny = cy - Math.cos(hRad) * 14;
    ctx.strokeStyle = 'rgba(0,191,255,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny); ctx.stroke();
    ctx.fillStyle = '#00bfff'; ctx.beginPath(); ctx.arc(nx, ny, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(0,255,65,0.2)'; ctx.font = "10px 'VT323',monospace"; ctx.textAlign = 'left';
  ctx.fillText(G.pos.lat.toFixed(5) + '\u00B0N  ' + G.pos.lng.toFixed(5) + '\u00B0' + (G.pos.lng >= 0 ? 'E' : 'W'), 8, cv.height - 62);
  if (G.selectedCountry) {
    ctx.fillStyle = 'rgba(255,230,0,0.3)'; ctx.font = "9px 'VT323',monospace";
    ctx.fillText('\u{1F30D} ' + G.selectedCountry.name, 8, cv.height - 50);
  }
}

// ── DRAW ARTSPACE PINS ──
function drawListings() {
  if (!G.overlays.pins) return;
  const z = getZoom().z;
  const list = G.showOffersOnly
    ? G.listings.filter(l => l.artSpace?.offer?.types?.length > 0)
    : G.listings;

  list.forEach(l => {
    if (l.cemetery) return; // drawn by cemetery.js
    const s = worldToScreen(l.lat, l.lng);
    if (s.x < -30 || s.x > cv.width + 30 || s.y < -40 || s.y > cv.height + 20) return;
    const col = getPCol(l);
    ctx.fillStyle = col.bg; ctx.shadowColor = col.bg; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(s.x, s.y - 12, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(s.x - 4, s.y - 5); ctx.lineTo(s.x, s.y + 2); ctx.lineTo(s.x + 4, s.y - 5); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000'; ctx.font = '10px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(l.cemetery ? '\u{1FAA6}' : l.artSpace?.offer?.types?.length > 0 ? '\u{1F3E0}' : '\u{1F9E9}', s.x, s.y - 12);
    if (z >= 11) {
      ctx.fillStyle = col.bg; ctx.font = "9px 'VT323',monospace"; ctx.textAlign = 'center';
      ctx.fillText(l.username || '', s.x, s.y + 12);
    }
  });
}

// ── GREYED-OUT CONSPIRACY STRINGS (always visible, all modes) ──
// Faint offer↔seek match strings that are always drawn beneath everything
function drawConspiracyStrings() {
  // Skip if full red strings are already on (they draw brighter versions)
  if (G.showRedStrings) return;
  // Skip in UFO mode — UFO draws its own strings via drawUfoStrings()
  if (G.veh === 'ufo') return;

  const offers = G.listings.filter(l => l.artSpace?.offer?.types?.length > 0);
  const seeks = G.listings.filter(l => l.artSpace?.seek?.types?.length > 0);

  seeks.forEach(sk => {
    const seekTypes = sk.artSpace.seek.types;
    offers.forEach(of => {
      if (of.id === sk.id) return;
      const ofTypes = of.artSpace.offer.types;
      const match = seekTypes.some(st => ofTypes.some(ot => ot === st));
      if (!match) return;

      const a = worldToScreen(of.lat, of.lng);
      const b = worldToScreen(sk.lat, sk.lng);
      if (a.x < -50 && b.x < -50) return;
      if (a.x > cv.width + 50 && b.x > cv.width + 50) return;

      // Very faint greyed-out string
      ctx.strokeStyle = 'rgba(255,34,68,0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -G.frameN * 0.2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - 12); ctx.lineTo(b.x, b.y - 12); ctx.stroke();
      ctx.setLineDash([]);

      // Tiny endpoint dots
      [a, b].forEach(p => {
        ctx.fillStyle = 'rgba(255,34,68,0.1)';
        ctx.beginPath(); ctx.arc(p.x, p.y - 12, 3, 0, Math.PI * 2); ctx.fill();
      });
    });
  });
}

// ── SEARCH RESULT SPRINKLES ──
function drawSearchResults() {
  if (!G.searchResults || G.searchResults.length === 0) return;
  const z = getZoom().z;

  G.searchResults.forEach((r, idx) => {
    // Slowly fade out over time
    r.fade = Math.max(0, r.fade - 0.0003);
    if (r.fade <= 0) return;

    const s = worldToScreen(r.lat, r.lng);
    if (s.x < -60 || s.x > cv.width + 60 || s.y < -40 || s.y > cv.height + 40) return;

    const alpha = r.fade;
    const pulse = 0.5 + Math.sin(G.frameN * 0.04 + idx * 1.3) * 0.3;

    // Glow ring
    ctx.strokeStyle = 'rgba(200,100,255,' + (alpha * pulse * 0.4) + ')';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.lineDashOffset = -G.frameN * 0.3;
    ctx.beginPath(); ctx.arc(s.x, s.y, 12 + pulse * 4, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    // Pin dot
    ctx.fillStyle = 'rgba(200,100,255,' + (alpha * 0.8) + ')';
    ctx.shadowColor = '#cc44ff'; ctx.shadowBlur = 8 * alpha;
    ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Search icon
    ctx.fillStyle = 'rgba(255,255,255,' + (alpha * 0.7) + ')';
    ctx.font = '9px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('\u{1F50D}', s.x, s.y);

    // Label
    if (z >= 9) {
      ctx.fillStyle = 'rgba(200,100,255,' + (alpha * 0.7) + ')';
      ctx.font = "9px 'VT323',monospace"; ctx.textAlign = 'center';
      ctx.fillText(r.label, s.x, s.y + 18);
      if (z >= 12) {
        ctx.fillStyle = 'rgba(200,100,255,' + (alpha * 0.35) + ')';
        ctx.font = "7px 'VT323',monospace";
        ctx.fillText('\u{1F50D} ' + r.query, s.x, s.y + 28);
      }
    }
  });

  // Clean up fully faded results
  G.searchResults = G.searchResults.filter(r => r.fade > 0);
}

// ── RED STRINGS ──
function drawRedStrings() {
  if (!G.showRedStrings) return;
  const offers = G.listings.filter(l => l.artSpace?.offer?.types?.length > 0);
  const seeks = G.listings.filter(l => l.artSpace?.seek?.types?.length > 0);

  seeks.forEach(sk => {
    const seekTypes = sk.artSpace.seek.types;
    offers.forEach(of => {
      if (of.id === sk.id) return;
      const ofTypes = of.artSpace.offer.types;
      const match = seekTypes.some(st => ofTypes.some(ot => ot === st));
      if (!match) return;

      const a = worldToScreen(of.lat, of.lng);
      const b = worldToScreen(sk.lat, sk.lng);
      if (a.x < -50 && b.x < -50) return;
      if (a.x > cv.width + 50 && b.x > cv.width + 50) return;

      ctx.strokeStyle = 'rgba(255,34,68,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -G.frameN * 0.5;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - 12); ctx.lineTo(b.x, b.y - 12); ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = 'rgba(255,34,68,0.1)';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - 12); ctx.lineTo(b.x, b.y - 12); ctx.stroke();
    });
  });
}

// ── COMMENTS ──
// Note box close (×) hit zones, rebuilt every frame in screen space
let _noteCloseZones = [];

function drawComments() {
  _noteCloseZones = [];
  if (G.notesMode === 'off') return;

  const z = getZoom().z;
  if (z < 5) return;

  const radius = NOTES_MODES[G.notesMode].radius; // -1 handled above, 0 = never expand

  G.comments.forEach((c, i) => {
    const s = worldToScreen(c.lat, c.lng);
    if (s.x < -40 || s.x > cv.width + 40 || s.y < -40 || s.y > cv.height + 40) return;

    ctx.fillStyle = '#ffe600'; ctx.shadowColor = '#ffe600'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

    if (c.folded || radius <= 0) return; // small mode, or manually folded: dot only

    const dx = s.x - cv.width / 2, dy = s.y - cv.height / 2;
    if (Math.sqrt(dx * dx + dy * dy) < radius) {
      const bx = s.x + 12, by = s.y - 40, bw = 240, bh = 60;
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#ffe600'; ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = '#ffe600'; ctx.font = "bold 11px 'VT323',monospace"; ctx.textAlign = 'left';
      ctx.fillText(c.from, bx + 8, by + 18);
      ctx.fillStyle = '#ffdd44'; ctx.font = "10px 'VT323',monospace";
      ctx.fillText(c.text.length > 60 ? c.text.substring(0, 60) + '...' : c.text, bx + 8, by + 35);
      ctx.fillStyle = 'rgba(255,230,0,0.6)'; ctx.font = "9px 'VT323',monospace";
      ctx.fillText(c.timestamp, bx + 8, by + 52);

      // Close button — folds this note back to a dot until clicked again
      const cx2 = bx + bw - 12, cy2 = by + 10;
      ctx.strokeStyle = '#ffe600'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx2 - 4, cy2 - 4); ctx.lineTo(cx2 + 4, cy2 + 4);
      ctx.moveTo(cx2 + 4, cy2 - 4); ctx.lineTo(cx2 - 4, cy2 + 4);
      ctx.stroke();
      _noteCloseZones.push({ index: i, x: cx2, y: cy2, r: 10 });
    }
  });
}

function findNoteCloseZoneAt(sx, sy) {
  for (let i = _noteCloseZones.length - 1; i >= 0; i--) {
    const z = _noteCloseZones[i];
    const dx = sx - z.x, dy = sy - z.y;
    if (dx * dx + dy * dy < z.r * z.r) return z.index;
  }
  return -1;
}

// ── BUS STOPS ──
async function loadBusData() {
  busStops = [];
  showToast('\u{1F68C} Loading bus stops...', '#ff2244');
  try {
    const pad = getZoom().z >= 13 ? 0.015 : 0.05;
    const bbox = (G.pos.lat - pad) + ',' + (G.pos.lng - pad * 1.5) + ',' + (G.pos.lat + pad) + ',' + (G.pos.lng + pad * 1.5);
    const q = '[out:json][timeout:15];(node["highway"="bus_stop"](' + bbox + ');node["public_transport"="platform"]["bus"="yes"](' + bbox + '););out body;';
    const data = await overpassQuery(q);
    busStops = data.elements.filter(e => e.type === 'node').map(e => ({ lat: e.lat, lon: e.lon, name: e.tags?.name || e.tags?.ref || '' }));
    document.getElementById('transitInfo').style.display = 'block';
    document.getElementById('transitText').innerHTML = busStops.length + ' bus stops';
    showToast('\u{1F68C} ' + busStops.length + ' stops!', '#ff2244');
  } catch (e) { showToast('Bus data unavailable', '#ff4444'); }
}

function drawBusStops() {
  if (G.veh !== 'bus' || !G.overlays.transit) return;
  const z = getZoom().z;
  busStops.forEach(stop => {
    const s = worldToScreen(stop.lat, stop.lon);
    if (s.x < -40 || s.x > cv.width + 40 || s.y < -20 || s.y > cv.height + 20) return;
    ctx.fillStyle = '#ff2244'; ctx.shadowColor = '#ff2244'; ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2); ctx.stroke();
    if (z >= 13 && stop.name) {
      ctx.fillStyle = '#ff4466'; ctx.font = "9px 'VT323',monospace"; ctx.textAlign = 'left';
      ctx.fillText('\u{1F68F} ' + stop.name, s.x + 6, s.y + 3);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD — pinboard with polaroid pictures and yellow note tiles
// ═══════════════════════════════════════════════════════════════

let dashboardOpen = false;

function toggleDashboard() {
  dashboardOpen = !dashboardOpen;
  const panel = document.getElementById('dashboard');
  if (!panel) return;
  panel.style.display = dashboardOpen ? 'block' : 'none';
  const btn = document.getElementById('dashboardBtn');
  if (btn) {
    if (dashboardOpen) { btn.style.background = '#011289'; btn.style.color = '#fff'; }
    else btn.style.cssText = 'border-color:#011289;color:#6688ff';
  }
  if (dashboardOpen) updateDashboard();
}

function updateDashboard() {
  const el = document.getElementById('dashboardContent');
  if (!el) return;

  // ── Search bar at top of dashboard ──
  let searchHtml = '<div style="margin-bottom:8px">';
  searchHtml += '<div style="font-family:\'Press Start 2P\',monospace;font-size:.18rem;color:rgba(1,18,137,0.5);margin-bottom:4px">\u{1F50D} DISCOVER</div>';
  searchHtml += '<div style="display:flex;gap:4px">';
  searchHtml += '<input id="dashSearch" type="text" placeholder="Search places..." style="flex:1;background:#000;color:#6688ff;border:1.5px solid rgba(1,18,137,0.4);padding:4px 6px;border-radius:3px;font-family:VT323,monospace;font-size:.9rem;outline:none">';
  searchHtml += '<button onclick="dashboardSearch()" style="background:#000;border:1.5px solid #011289;color:#6688ff;padding:3px 8px;border-radius:3px;cursor:pointer;font-family:VT323,monospace;font-size:.85rem;white-space:nowrap">GO</button>';
  searchHtml += '</div>';
  searchHtml += '<div id="dashSearchResults" style="margin-top:4px"></div>';
  searchHtml += '</div>';

  // Collect all items: comments (notes) + listings (polaroids) + notebook entries
  const items = [];

  // Yellow note tiles from comments
  G.comments.forEach((c, i) => {
    items.push({ type: 'note', data: c, index: i });
  });

  // Polaroid cards from listings
  G.listings.forEach((l, i) => {
    items.push({ type: 'polaroid', data: l, index: i });
  });

  // Notebook entries (if in UFO mode)
  if (typeof ufoNotebookEntries !== 'undefined') {
    ufoNotebookEntries.forEach((n, i) => {
      items.push({ type: 'notebook', data: n, index: i });
    });
  }

  if (items.length === 0) {
    el.innerHTML = searchHtml + '<div style="color:rgba(1,18,137,0.4);padding:12px;font-size:.85rem;text-align:center">Nothing pinned yet.<br>Drop notes or explore!</div>';
    _dashSearchBind();
    return;
  }

  // Scale: more items = smaller cards
  const count = items.length;
  const scale = count <= 6 ? 'large' : count <= 15 ? 'medium' : 'small';
  const noteH = scale === 'large' ? 70 : scale === 'medium' ? 50 : 36;
  const polaroidH = scale === 'large' ? 90 : scale === 'medium' ? 65 : 45;
  const fontSize = scale === 'large' ? '.85rem' : scale === 'medium' ? '.75rem' : '.65rem';
  const titleSize = scale === 'large' ? '.28rem' : scale === 'medium' ? '.22rem' : '.18rem';

  let html = '<div style="font-family:VT323,monospace;font-size:.7rem;color:rgba(1,18,137,0.4);margin-bottom:6px">' + items.length + ' items \u00B7 ' + scale + ' view</div>';

  // Use a grid for small view
  if (scale === 'small') html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">';

  items.forEach(item => {
    if (item.type === 'note') {
      const c = item.data;
      // Yellow sticky note tile
      html += '<div style="background:rgba(255,230,0,0.12);border:1.5px solid rgba(255,230,0,0.35);border-radius:3px;padding:5px 7px;margin:' + (scale === 'small' ? '0' : '4px 0') + ';min-height:' + noteH + 'px;cursor:pointer;position:relative" onclick="dashboardFlyTo(' + c.lat + ',' + c.lng + ')">';
      html += '<div style="font-family:\'Press Start 2P\',monospace;font-size:' + titleSize + ';color:#ffe600;margin-bottom:2px">\u{1F4CC} ' + esc(c.from) + '</div>';
      html += '<div style="font-family:VT323,monospace;font-size:' + fontSize + ';color:rgba(255,230,0,0.7);line-height:1.3">' + esc(c.text.substring(0, scale === 'small' ? 30 : 60)) + '</div>';
      html += '<div style="font-family:VT323,monospace;font-size:.6rem;color:rgba(255,230,0,0.3);margin-top:2px">' + c.timestamp + '</div>';
      html += '</div>';
    } else if (item.type === 'polaroid') {
      const l = item.data;
      const col = getPCol(l);
      const hasOffer = l.artSpace?.offer?.types?.length > 0;
      const hasSeek = l.artSpace?.seek?.types?.length > 0;
      // Polaroid card — white border, tilted slightly
      const tilt = ((item.index * 7 + 3) % 7) - 3; // -3 to +3 degrees
      html += '<div style="background:#111;border:3px solid rgba(255,255,255,0.8);border-bottom-width:' + (scale === 'small' ? '12px' : '20px') + ';border-radius:2px;padding:4px;margin:' + (scale === 'small' ? '0' : '4px 0') + ';min-height:' + polaroidH + 'px;cursor:pointer;transform:rotate(' + tilt + 'deg);position:relative" onclick="dashboardFlyTo(' + l.lat + ',' + l.lng + ')">';
      // "Photo" area — coloured gradient representing the space
      html += '<div style="background:linear-gradient(135deg,' + col.bg + '22,' + col.bg + '08);border:1px solid ' + col.bg + '33;height:' + (polaroidH - 30) + 'px;display:flex;align-items:center;justify-content:center">';
      html += '<span style="font-size:' + (scale === 'small' ? '14px' : '20px') + '">' + (hasOffer ? '\u{1F3E0}' : '\u{1F9E9}') + '</span>';
      html += '</div>';
      // Caption
      html += '<div style="font-family:VT323,monospace;font-size:' + fontSize + ';color:rgba(255,255,255,0.7);margin-top:3px;text-align:center">' + esc(l.username || 'Anon') + '</div>';
      if (scale !== 'small' && l.signature) {
        html += '<div style="font-family:VT323,monospace;font-size:.65rem;color:rgba(255,255,255,0.35);text-align:center;font-style:italic">"' + esc(l.signature.substring(0, 25)) + '"</div>';
      }
      html += '</div>';
    } else if (item.type === 'notebook') {
      const n = item.data;
      const NTAGS = typeof NOTEBOOK_TAGS !== 'undefined' ? NOTEBOOK_TAGS : [];
      const tag = NTAGS.find(t => t.id === n.tag) || { label: '\u{1F4DD} Note', color: '#ff6600' };
      html += '<div style="background:rgba(68,255,136,0.06);border:1.5px solid rgba(68,255,136,0.25);border-radius:3px;padding:5px 7px;margin:' + (scale === 'small' ? '0' : '4px 0') + ';min-height:' + noteH + 'px;cursor:pointer" onclick="dashboardFlyTo(' + n.lat + ',' + n.lng + ')">';
      html += '<div style="font-family:\'Press Start 2P\',monospace;font-size:' + titleSize + ';color:' + tag.color + '">' + tag.label + '</div>';
      html += '<div style="font-family:VT323,monospace;font-size:' + fontSize + ';color:rgba(68,255,136,0.7)">' + esc(n.text.substring(0, scale === 'small' ? 30 : 50)) + '</div>';
      html += '</div>';
    }
  });

  if (scale === 'small') html += '</div>';

  el.innerHTML = searchHtml + html;
  _dashSearchBind();
}

// Bind Enter key in dashboard search input
function _dashSearchBind() {
  const inp = document.getElementById('dashSearch');
  if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') dashboardSearch(); });
}

// Dashboard search — queries Nominatim and sprinkles results on map
async function dashboardSearch() {
  const inp = document.getElementById('dashSearch');
  const resEl = document.getElementById('dashSearchResults');
  if (!inp || !resEl) return;
  const q = inp.value.trim();
  if (!q) return;
  resEl.innerHTML = '<div style="color:rgba(1,18,137,0.5);font-size:.75rem;font-style:italic">Searching...</div>';
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(q) + '&format=json&limit=8', { headers: { 'User-Agent': 'ArtSpaceCity/1.0' } });
    const data = await r.json();
    if (!data.length) { resEl.innerHTML = '<div style="color:#ff4444;font-size:.75rem">Nothing found</div>'; return; }
    // Fly to first result
    G.pos.lat = parseFloat(data[0].lat); G.pos.lng = parseFloat(data[0].lon);
    detectCountryFromCoords(G.pos.lat, G.pos.lng);
    // Sprinkle all results onto the map as search discoveries
    sprinkleSearchResults(q, data);
    // Show results in dashboard
    let rhtml = '';
    data.forEach((d, i) => {
      const lat = parseFloat(d.lat), lon = parseFloat(d.lon);
      const label = d.display_name.split(',').slice(0, 2).join(',');
      rhtml += '<div style="padding:3px 5px;cursor:pointer;font-family:VT323,monospace;font-size:.8rem;color:#6688ff;border-bottom:1px solid rgba(1,18,137,0.12);transition:background .1s" onmouseover="this.style.background=\'rgba(1,18,137,0.1)\'" onmouseout="this.style.background=\'none\'" onclick="dashboardFlyTo(' + lat + ',' + lon + ')">';
      rhtml += '<span style="color:rgba(200,100,255,0.7)">\u{1F50D}</span> ' + esc(label);
      rhtml += '</div>';
    });
    resEl.innerHTML = rhtml;
    showToast('\u{1F50D} ' + data.length + ' places found & mapped!', '#011289');
  } catch (e) { resEl.innerHTML = '<div style="color:#ff4444;font-size:.75rem">Network error</div>'; }
}

function dashboardFlyTo(lat, lng) {
  G.pos.lat = lat; G.pos.lng = lng;
  showToast('\u{1F4CD} Jumped to location!', '#011289');
}

// ═══════════════════════════════════════════════════════════════
//  MOVABLE NOTES — drag yellow comment dots on the map
// ═══════════════════════════════════════════════════════════════

let draggingComment = null;
let dragOffsetX = 0, dragOffsetY = 0;

function findCommentAt(sx, sy) {
  for (let i = G.comments.length - 1; i >= 0; i--) {
    const c = G.comments[i];
    const s = worldToScreen(c.lat, c.lng);
    if (Math.abs(sx - s.x) < 15 && Math.abs(sy - s.y) < 15) return i;
  }
  return -1;
}

// Hook into canvas for dragging notes, folding/unfolding note boxes
(function() {
  const canvas = document.getElementById('world');
  let dragActive = false;
  let downX = 0, downY = 0;
  let downIdx = -1;

  canvas.addEventListener('pointerdown', function(e) {
    // Only interact with notes when NOT in pin mode, comment mode, or string drawing
    if (G.pinMode || G.commentMode) return;
    if (typeof ufoDrawingString !== 'undefined' && ufoDrawingString) return;

    // Closing an expanded note box takes priority over dragging
    if (findNoteCloseZoneAt(e.clientX, e.clientY) >= 0) return;

    const idx = findCommentAt(e.clientX, e.clientY);
    if (idx >= 0) {
      downIdx = idx;
      downX = e.clientX; downY = e.clientY;
      draggingComment = idx;
      dragActive = true;
      canvas.style.cursor = 'grabbing';
      e.preventDefault();
      e.stopPropagation();
    }
  });

  canvas.addEventListener('pointermove', function(e) {
    if (!dragActive || draggingComment === null) return;
    const w = screenToWorld(e.clientX, e.clientY);
    G.comments[draggingComment].lat = w.lat;
    G.comments[draggingComment].lng = w.lng;
  });

  canvas.addEventListener('pointerup', function(e) {
    if (dragActive && draggingComment !== null) {
      const moved = Math.abs(e.clientX - downX) > 5 || Math.abs(e.clientY - downY) > 5;
      if (moved) {
        showToast('\u{1F4CC} Note moved!', '#ffe600');
        if (dashboardOpen) updateDashboard();
      } else if (G.comments[downIdx]?.folded) {
        // A tap (not a drag) on a folded dot unfolds it again
        G.comments[downIdx].folded = false;
        showToast('\u{1F4CC} Note unfolded', '#ffe600');
      }
      draggingComment = null;
      dragActive = false;
      downIdx = -1;
      document.getElementById('world').style.cursor = '';
    }
  });

  // Close (×) button on an expanded note box: fold it into a dot, permanently
  // until tapped again (see pointerup above). Registered before game.js's own
  // click handler (script load order) and stops it from also firing on this click.
  canvas.addEventListener('click', function(e) {
    const idx = findNoteCloseZoneAt(e.clientX, e.clientY);
    if (idx >= 0) {
      G.comments[idx].folded = true;
      showToast('\u{1F4CD} Note folded', '#ffe600');
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  });
})();

// ── MODALS ──
function openNewPin(lat, lng) {
  document.getElementById('MB').innerHTML = '<button class="mcl" onclick="closeModal()">\u2715</button><div class="mh">\u{1F4CC} NEW ARTSPACE</div><div class="mf"><label>YOUR NAME</label><input type="text" id="pU" placeholder="username..." maxlength="30"></div><div class="mf"><label>SIGNATURE</label><input type="text" id="pS" placeholder="your vibe..." maxlength="60"></div><div class="mf"><label>SPACE TYPES</label><div class="chips">' + TYPES.map(t => '<span class="chip" onclick="this.classList.toggle(\'on\')">' + t + '</span>').join('') + '</div></div><div class="mf"><label>DESCRIPTION</label><textarea id="pD" placeholder="What do you have or seek?"></textarea></div><div class="mf"><label>I AM</label><select id="pR"><option value="offer">\u{1F3E0} Offering</option><option value="seek">\u{1F9E9} Seeking</option><option value="both">\u{1F3E0}\u{1F9E9} Both</option></select></div><div class="mf"><label>EXCHANGE</label><div class="chips"><span class="chip on" onclick="this.classList.toggle(\'on\')">\u{1F49A} FREE</span><span class="chip" onclick="this.classList.toggle(\'on\')">\u{1F504} SWAP</span><span class="chip" onclick="this.classList.toggle(\'on\')">\u2615 DONATION</span><span class="chip" onclick="this.classList.toggle(\'on\')">\u{1F4B8} PAID</span><span class="chip" onclick="this.classList.toggle(\'on\')">\u{1FAA6} RIP</span></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:7px"><div class="mf"><label>FROM</label><input type="date" id="pF"></div><div class="mf"><label>TO</label><input type="date" id="pT"></div></div><button class="msave" onclick="savePin(' + lat + ',' + lng + ')">\u{1F4BE} PUBLISH</button>';
  document.getElementById('MO').classList.add('open');
}

function savePin(lat, lng) {
  const user = document.getElementById('pU').value.trim() || 'Anonymous';
  const sig = document.getElementById('pS').value.trim();
  const desc = document.getElementById('pD').value.trim();
  const role = document.getElementById('pR').value;
  const types = [...document.querySelectorAll('#MB .chips .chip.on')].map(c => c.textContent);
  const isCemetery = types.some(t => t.includes('Cemetery'));
  const l = { id: 'p' + Date.now(), lat, lng, username: user, signature: sig, cemetery: isCemetery, artSpace: { active: true,
    offer: role === 'seek' ? { types: [], desc: '', exchange: [] } : { types, desc, exchange: types, dateFrom: document.getElementById('pF').value, dateTo: document.getElementById('pT').value },
    seek: role === 'offer' ? { types: [], desc: '', exchange: [] } : { types, desc, exchange: ['\u{1F504} SKILLS'], dateFrom: document.getElementById('pF').value, dateTo: document.getElementById('pT').value }
  }};
  G.listings.push(l);
  document.getElementById('SS').textContent = G.listings.length;
  closeModal();
  showToast('\u{1F4CC} Space published!', '#00ff41');
}

function openView(p) {
  const art = p.artSpace || {};
  const io = art.offer?.types?.length > 0, is = art.seek?.types?.length > 0;
  const col = getPCol(p);
  const sec = (data, isO) => {
    if (!(isO ? io : is)) return '';
    const chips = (data.types || []).map(t => '<span class="mc ' + (isO ? 'mc-o' : 'mc-s') + '">' + t + '</span>').join('');
    const dates = fmtD(data.dateFrom, data.dateTo);
    return '<div class="msec ' + (isO ? 'msec-o' : 'msec-s') + '"><div class="mst">' + (isO ? '\u{1F3E0} OFFERING' : '\u{1F9E9} SEEKING') + '</div><div class="mchips">' + chips + '</div>' + (data.desc ? '<div class="mdesc">' + esc(data.desc) + '</div>' : '') + (dates ? '<div class="mdates">\u{1F4C5} ' + dates + '</div>' : '') + (data.exchange?.length ? '<div class="mxch">' + data.exchange.join(' \u00B7 ') + '</div>' : '') + '</div>';
  };
  const badge = p.cemetery ? '\u{1FAA6} CEMETERY' : (io && is ? '\u{1F3E0}\u{1F9E9} HOST+SEEKER' : io ? '\u{1F3E0} SPACE' : '\u{1F9E9} SEEKING');
  document.getElementById('MB').innerHTML = '<button class="mcl" onclick="closeModal()">\u2715</button><div class="mbt" style="color:' + col.bg + ';text-shadow:0 0 6px ' + col.bg + '">' + badge + '</div><div class="mu">' + esc(p.username || 'Anon') + '</div>' + (p.signature ? '<div class="msig">"' + esc(p.signature) + '"</div>' : '') + sec(art.offer || {}, true) + sec(art.seek || {}, false) + '<button class="mcon" onclick="showToast(\'Find ' + esc(p.username || '') + ' \u2014 auth coming soon!\',\'#00bfff\');closeModal()">\u{1F4AC} CONNECT</button>';
  document.getElementById('MO').classList.add('open');
}

function closeModal() { document.getElementById('MO').classList.remove('open'); }
