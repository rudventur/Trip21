// ═══════════════════════════════════════════════════════════════
//  panel-left.js — Snout First Left Panel
//  Tabs: My Pets · GPS · Notebook · 🔴 LOST
//  Additive only — reads S.pets from main, writes nothing upstream
// ═══════════════════════════════════════════════════════════════

(function () {

// ── Inject panel HTML ──
function injectLeftPanel() {
  const html = `
  <style>
    .lp-root {
      position: fixed; top: 50px; left: 0; bottom: 0;
      width: 220px;
      background: rgba(26,18,10,0.94);
      border-right: 2px solid #cc8833;
      z-index: 950;
      display: flex; flex-direction: column;
      transition: width .2s, opacity .2s;
      backdrop-filter: blur(2px);
      font-family: 'VT323', monospace;
    }
    .lp-root.lp-collapsed { width: 26px; }
    .lp-root.lost-mode {
      border-right-color: #ff2222;
      box-shadow: 0 0 18px rgba(255,30,30,0.25);
    }

    .lp-toggle {
      position: absolute; top: 50%; right: -13px;
      transform: translateY(-50%);
      width: 13px; height: 44px;
      background: #cc8833; border-radius: 0 7px 7px 0;
      cursor: pointer; display: flex; align-items: center;
      justify-content: center; z-index: 955;
      font-size: .65rem; color: #1a120a; user-select: none;
    }
    .lp-root.lost-mode .lp-toggle { background: #ff2222; }

    .lp-inner {
      flex: 1; overflow: hidden; display: flex;
      flex-direction: column; min-width: 0;
    }
    .lp-root.lp-collapsed .lp-inner { opacity: 0; pointer-events: none; }

    /* Tab bar */
    .lp-tabs {
      display: flex; flex-shrink: 0;
      border-bottom: 1.5px solid rgba(204,136,51,0.25);
      overflow-x: auto;
    }
    .lp-tabs::-webkit-scrollbar { height: 0; }
    .lp-tab {
      flex-shrink: 0; padding: 5px 8px;
      color: rgba(255,204,102,0.4);
      font-size: .72rem; cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all .12s; white-space: nowrap;
      user-select: none;
    }
    .lp-tab.active { color: #ffcc66; border-bottom-color: #cc8833; }
    .lp-tab.lost-tab {
      color: rgba(255,60,60,0.5);
      border-bottom-color: transparent;
      position: relative;
    }
    .lp-tab.lost-tab.active {
      color: #ff3333;
      border-bottom-color: #ff2222;
      text-shadow: 0 0 8px rgba(255,30,30,0.6);
    }
    .lp-root.lost-mode .lp-tabs {
      border-bottom-color: rgba(255,30,30,0.3);
    }

    .lp-content { flex: 1; overflow-y: auto; padding: 6px; }

    /* Pet tile */
    .lp-pet-tile {
      background: rgba(0,0,0,0.3);
      border: 1.5px solid rgba(204,136,51,0.25);
      border-radius: 9px; padding: 6px 8px;
      margin-bottom: 5px; cursor: pointer;
      transition: all .12s; position: relative;
    }
    .lp-pet-tile:hover { border-color: #cc8833; background: rgba(204,136,51,0.07); }
    .lp-pet-tile.dragging-over { border-color: #88cc44; background: rgba(136,204,68,0.07); }
    .lp-pt-name {
      font-family: 'Bubblegum Sans', cursive;
      color: #ffcc66; font-size: .82rem;
      display: flex; align-items: center; gap: 4px;
    }
    .lp-pt-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #88cc44; flex-shrink: 0;
    }
    .lp-pt-dot.walk { background: #ffcc66; }
    .lp-pt-dot.lost { background: #ff3333; animation: lp-pulse 1s infinite; }
    @keyframes lp-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    .lp-pt-breed { color: rgba(255,204,102,0.4); font-size: .68rem; margin-top: 2px; }
    .lp-pt-opts {
      position: absolute; top: 4px; right: 5px;
      background: none; border: none;
      color: rgba(204,136,51,0.35); cursor: pointer; font-size: .8rem;
    }
    .lp-pt-opts:hover { color: #cc8833; }

    /* GPS tab — tracker ecosystem links */
    .lp-tracker-section { margin-bottom: 8px; }
    .lp-tracker-label { color: rgba(136,204,68,0.6); font-size: .68rem; letter-spacing: 1px; margin-bottom: 4px; font-family: 'VT323', monospace; }
    .lp-tracker-grid { display: flex; flex-wrap: wrap; gap: 4px; }
    .lp-tracker-badge {
      font-size: .68rem; padding: 3px 7px; border-radius: 6px;
      text-decoration: none; font-family: 'VT323', monospace;
      border: 1px solid rgba(136,204,68,0.3);
      background: rgba(136,204,68,0.06); color: #88cc44;
      transition: all .12s;
    }
    .lp-tracker-badge:hover { background: rgba(136,204,68,0.18); border-color: #88cc44; }
    .lp-tracker-badge.cellular { border-color: rgba(255,204,102,0.3); background: rgba(255,204,102,0.06); color: #ffcc66; }
    .lp-tracker-badge.cellular:hover { background: rgba(255,204,102,0.18); border-color: #ffcc66; }
    .lp-tracker-hint { color: rgba(255,204,102,0.25); font-size: .62rem; margin-top: 4px; font-style: italic; }

    /* GPS tab */
    .lp-gps-card {
      background: rgba(0,0,0,0.3);
      border: 1.5px solid rgba(136,204,68,0.2);
      border-radius: 9px; padding: 7px 8px; margin-bottom: 5px;
    }
    .lp-gps-name {
      font-family: 'Bubblegum Sans', cursive;
      color: #ffcc66; font-size: .8rem; margin-bottom: 4px;
    }
    .lp-gps-row { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
    .lp-gps-btn {
      font-size: .65rem; padding: 2px 6px; border-radius: 5px;
      cursor: pointer; font-family: 'VT323', monospace;
      border: 1px solid rgba(136,204,68,0.3);
      background: rgba(136,204,68,0.08); color: #88cc44;
    }
    .lp-gps-btn:hover { background: rgba(136,204,68,0.18); }
    .lp-gps-btn.device {
      border-color: rgba(255,204,102,0.25);
      background: rgba(255,204,102,0.06);
      color: rgba(255,204,102,0.5);
    }
    .lp-gps-btn.device.linked {
      border-color: rgba(255,204,102,0.5);
      color: #ffcc66;
    }
    .lp-coords { color: rgba(255,204,102,0.45); font-size: .65rem; font-family: 'VT323', monospace; }

    /* Notebook tab */
    .lp-note {
      background: rgba(0,0,0,0.3);
      border: 1.5px solid rgba(204,136,51,0.2);
      border-radius: 9px; padding: 7px 8px; margin-bottom: 5px;
    }
    .lp-note-head {
      display: flex; align-items: center;
      justify-content: space-between; margin-bottom: 4px;
    }
    .lp-note-label {
      font-family: 'Bubblegum Sans', cursive;
      color: rgba(255,204,102,0.6); font-size: .75rem;
    }
    .lp-note-del {
      background: none; border: none;
      color: rgba(204,51,51,0.4); cursor: pointer; font-size: .75rem;
    }
    .lp-note-del:hover { color: #ff4444; }
    .lp-note-txt { color: rgba(255,204,102,0.75); font-size: .82rem; line-height: 1.3; }
    .lp-note-time { color: rgba(255,204,102,0.25); font-size: .6rem; margin-top: 3px; }
    .lp-note-form { margin-top: 6px; }
    .lp-note-select, .lp-note-input {
      width: 100%; background: rgba(0,0,0,0.4);
      color: #ffcc66; border: 1.5px solid rgba(204,136,51,0.3);
      padding: 4px 7px; border-radius: 7px;
      font-family: 'VT323', monospace; font-size: .82rem;
      outline: none; margin-bottom: 4px; resize: none;
    }
    .lp-note-input:focus, .lp-note-select:focus { border-color: #ffcc66; }
    .lp-note-save {
      width: 100%; padding: 4px;
      background: rgba(204,136,51,0.1);
      border: 1px solid rgba(204,136,51,0.35);
      color: #cc8833; border-radius: 7px;
      cursor: pointer; font-family: 'VT323', monospace; font-size: .75rem;
    }
    .lp-note-save:hover { background: rgba(204,136,51,0.2); }

    /* LOST tab */
    .lp-lost-header {
      text-align: center; padding: 8px 6px 4px;
      font-family: 'Bubblegum Sans', cursive;
      color: #ff3333; font-size: 1rem;
      text-shadow: 0 0 10px rgba(255,30,30,0.5);
    }
    .lp-lost-pet-btn {
      width: 100%; padding: 10px;
      background: rgba(180,20,20,0.15);
      border: 2px solid rgba(255,30,30,0.5);
      color: #ff4444; border-radius: 10px;
      cursor: pointer; font-family: 'Bubblegum Sans', cursive;
      font-size: .95rem; margin-bottom: 6px;
      transition: all .15s; text-align: left;
      display: flex; align-items: center; gap: 8px;
    }
    .lp-lost-pet-btn:hover {
      background: rgba(180,20,20,0.28);
      border-color: #ff2222;
      box-shadow: 0 0 12px rgba(255,20,20,0.2);
    }
    .lp-lost-pet-btn.active-lost {
      background: rgba(180,20,20,0.35);
      border-color: #ff2222;
      animation: lp-pulse 1.2s infinite;
    }
    .lp-found-btn {
      width: 100%; padding: 8px;
      background: rgba(20,140,20,0.15);
      border: 2px solid rgba(80,200,80,0.4);
      color: #88cc44; border-radius: 10px;
      cursor: pointer; font-family: 'Bubblegum Sans', cursive;
      font-size: .9rem; margin-bottom: 6px;
      transition: all .15s;
    }
    .lp-found-btn:hover { background: rgba(20,140,20,0.28); }
    .lp-lost-info {
      color: rgba(255,80,80,0.5); font-size: .68rem;
      text-align: center; padding: 4px; line-height: 1.4;
    }

    /* Minimap (per tab) */
    .lp-minimap-wrap {
      position: relative; width: 100%; height: 78px;
      border-radius: 9px; overflow: hidden; margin-bottom: 6px;
      border: 1.5px solid rgba(204,136,51,0.3); cursor: pointer;
      background: #d4c5a9; flex-shrink: 0;
    }
    .lp-minimap-wrap canvas { display: block; width: 100%; height: 100%; }
    .lp-minimap-empty {
      position: absolute; inset: 0; display: none; align-items: center;
      justify-content: center; text-align: center; padding: 0 8px;
      color: rgba(26,18,10,0.55); font-size: .65rem;
      font-family: 'VT323', monospace; background: rgba(212,197,169,0.88);
    }

    /* Per-tile quick action buttons */
    .lp-tile-btns { display: flex; gap: 4px; margin-top: 4px; }
    .lp-tile-btn {
      font-size: .62rem; padding: 2px 6px; border-radius: 5px;
      cursor: pointer; font-family: 'VT323', monospace;
      border: 1px solid rgba(204,136,51,0.35);
      background: rgba(204,136,51,0.08); color: #cc8833;
    }
    .lp-tile-btn:hover { background: rgba(204,136,51,0.18); }
    .lp-tile-btn.lost { border-color: rgba(255,60,60,0.4); color: #ff6666; background: rgba(255,30,30,0.08); }
    .lp-tile-btn.lost:hover { background: rgba(255,30,30,0.18); }
    .lp-tile-btn.found { border-color: rgba(136,204,68,0.4); color: #88cc44; background: rgba(136,204,68,0.08); }
    .lp-tile-btn.found:hover { background: rgba(136,204,68,0.18); }

    /* Add pet button */
    .lp-add-btn {
      margin: 5px; padding: 5px;
      background: rgba(136,204,68,0.06);
      border: 1.5px dashed rgba(136,204,68,0.25);
      color: #88cc44; border-radius: 9px;
      cursor: pointer; font-size: .72rem; text-align: center;
      font-family: 'VT323', monospace; flex-shrink: 0;
    }
    .lp-add-btn:hover { background: rgba(136,204,68,0.12); }

    /* Drop zone */
    .lp-drop-zone {
      border: 2px dashed rgba(136,204,68,0.0);
      border-radius: 9px; padding: 10px;
      text-align: center;
      color: rgba(136,204,68,0); font-size: .72rem;
      transition: all .2s; margin: 4px 0;
      font-family: 'VT323', monospace;
    }
    .lp-drop-zone.active {
      border-color: rgba(136,204,68,0.5);
      color: #88cc44;
      background: rgba(136,204,68,0.06);
    }

    /* Tractive connect modal */
    .lp-tv-overlay {
      display: none; position: fixed; inset: 0; z-index: 3000;
      background: rgba(0,0,0,0.7); align-items: center; justify-content: center;
    }
    .lp-tv-overlay.show { display: flex; }
    .lp-tv-modal {
      background: rgba(26,18,10,0.98); border: 2px solid #88cc44;
      border-radius: 14px; padding: 16px; width: 90%; max-width: 300px;
      font-family: 'VT323', monospace;
    }
    .lp-tv-modal h4 { font-family: 'Bubblegum Sans', cursive; color: #88cc44; margin-bottom: 8px; font-size: 1.05rem; }
    .lp-tv-note { color: rgba(255,204,102,0.5); font-size: .72rem; line-height: 1.4; margin-bottom: 10px; }
    .lp-tv-modal input {
      width: 100%; background: rgba(0,0,0,0.4); color: #ffcc66;
      border: 1.5px solid rgba(136,204,68,0.3); padding: 6px 8px;
      border-radius: 8px; font-family: 'VT323', monospace; font-size: .9rem;
      outline: none; margin-bottom: 6px;
    }
    .lp-tv-modal input:focus { border-color: #88cc44; }
    .lp-tv-status { font-size: .72rem; min-height: 16px; margin: 4px 0; color: rgba(255,204,102,0.6); }
    .lp-tv-status.err { color: #ff8888; }
    .lp-tv-status.ok { color: #88cc44; }
    .lp-tv-btns { display: flex; gap: 6px; margin-top: 6px; }
    .lp-tv-btns button { flex: 1; }
  </style>

  <div class="lp-tv-overlay" id="tractiveModalOverlay">
    <div class="lp-tv-modal">
      <h4>🔗 Connect Tractive</h4>
      <p class="lp-tv-note">Goes straight from your browser to our relay to Tractive's own login — only your pets' current locations come back. Your email and password are never stored or logged anywhere.</p>
      <input type="email" id="tractiveEmail" placeholder="Tractive account email" autocomplete="off">
      <input type="password" id="tractivePassword" placeholder="Tractive password" autocomplete="off">
      <div class="lp-tv-status" id="tractiveStatus"></div>
      <div class="lp-tv-btns">
        <button class="lp-tile-btn" onclick="closeTractiveModal()">Cancel</button>
        <button class="lp-tile-btn found" onclick="submitTractiveSync()">Sync now</button>
      </div>
    </div>
  </div>

  <div class="lp-root" id="lpRoot">
    <div class="lp-toggle" id="lpToggleBtn">◀</div>
    <div class="lp-inner">
      <div class="lp-tabs" id="lpTabBar">
        <div class="lp-tab active" data-lptab="pets">🐾 Pets</div>
        <div class="lp-tab" data-lptab="gps">📍 GPS</div>
        <div class="lp-tab" data-lptab="notebook">📓 Notes</div>
        <div class="lp-tab lost-tab" data-lptab="lost" id="lpLostTab">🔴 LOST</div>
      </div>
      <div class="lp-content" id="lpContent"></div>
      <div class="lp-add-btn" id="lpAddBtn">+ register a pet</div>
    </div>
  </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
}

// ── State ──
let lpOpen = true;
let lpActiveTab = 'pets';
let lpNotes = JSON.parse(localStorage.getItem('sf_notes') || '[]');

// ── Minimap engine (self-contained — shares the main map's tile cache when present) ──
const lpMmCache = {};
function lpMmLon2Tile(lon, z) { return ((lon + 180) / 360) * Math.pow(2, z); }
function lpMmLat2Tile(lat, z) {
  const r = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z);
}
function lpMmTileUrl(x, y, z) {
  if (typeof tileUrl === 'function') return tileUrl(x, y, z);
  const sub = ['a', 'b', 'c'][(x + y) % 3];
  return `https://${sub}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
}
function lpMmLoadTile(url) {
  if (typeof loadTile === 'function') return loadTile(url); // reuse main map's cache — no duplicate downloads
  if (!lpMmCache[url]) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { img._loaded = true; };
    img.src = url;
    lpMmCache[url] = img;
  }
  return lpMmCache[url];
}

// Tile-space deltas scale linearly with 2^z, so we can size-fit a bbox in one shot
function lpFitZoom(markers, w, h) {
  if (markers.length <= 1) return 13;
  const lons = markers.map(m => m.lon), lats = markers.map(m => m.lat);
  const x0 = lpMmLon2Tile(Math.min(...lons), 0), x1 = lpMmLon2Tile(Math.max(...lons), 0);
  const y0 = lpMmLat2Tile(Math.max(...lats), 0), y1 = lpMmLat2Tile(Math.min(...lats), 0);
  const dx = Math.max(Math.abs(x1 - x0), 0.0005);
  const dy = Math.max(Math.abs(y1 - y0), 0.0005);
  const TILE = 256, pad = 0.75;
  const zx = Math.log2((w * pad) / (dx * TILE));
  const zy = Math.log2((h * pad) / (dy * TILE));
  return Math.max(2, Math.min(15, Math.floor(Math.min(zx, zy))));
}

function lpBoundsCenter(pets) {
  const withLoc = pets.filter(p => typeof p.lat === 'number' && typeof (p.lon ?? p.lng) === 'number');
  if (!withLoc.length) return (typeof S !== 'undefined') ? { lat: S.lat, lon: S.lon } : { lat: 51.505, lon: -0.09 };
  const lats = withLoc.map(p => p.lat), lons = withLoc.map(p => p.lon ?? p.lng);
  return { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lon: (Math.min(...lons) + Math.max(...lons)) / 2 };
}

function lpDrawMinimap(canvas, centerLat, centerLon, markers) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 200, h = canvas.clientHeight || 78;
  if (!w || !h) return;
  if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
  if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const z = lpFitZoom(markers, w, h);
  const TILE = 256;
  const cxT = lpMmLon2Tile(centerLon, z), cyT = lpMmLat2Tile(centerLat, z);
  const x0 = Math.floor(cxT - w / 2 / TILE) - 1, x1 = Math.ceil(cxT + w / 2 / TILE) + 1;
  const y0 = Math.floor(cyT - h / 2 / TILE) - 1, y1 = Math.ceil(cyT + h / 2 / TILE) + 1;
  const maxT = Math.pow(2, z);

  ctx.filter = 'sepia(0.3) saturate(1.15) brightness(1.05) hue-rotate(-8deg)';
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (y < 0 || y >= maxT) continue;
      const wx = ((x % maxT) + maxT) % maxT;
      const sx = w / 2 + (x - cxT) * TILE, sy = h / 2 + (y - cyT) * TILE;
      const img = lpMmLoadTile(lpMmTileUrl(wx, y, z));
      if (img._loaded && img.naturalWidth) ctx.drawImage(img, sx, sy, TILE + 1, TILE + 1);
      else { ctx.fillStyle = '#d4c5a9'; ctx.fillRect(sx, sy, TILE + 1, TILE + 1); }
    }
  }
  ctx.filter = 'none';

  markers.forEach(m => {
    const tx = lpMmLon2Tile(m.lon, z), ty = lpMmLat2Tile(m.lat, z);
    const sx = w / 2 + (tx - cxT) * TILE, sy = h / 2 + (ty - cyT) * TILE;
    if (sx < -10 || sx > w + 10 || sy < -10 || sy > h + 10) return;
    if (m.pulse) {
      ctx.beginPath();
      ctx.arc(sx, sy, 11 + Math.sin(Date.now() / 220) * 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,30,30,0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(sx, sy, m.big ? 7 : 5, 0, Math.PI * 2);
    ctx.fillStyle = m.color || '#cc8833';
    ctx.fill();
    ctx.strokeStyle = '#1a120a';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    if (m.emoji) {
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.emoji, sx, sy);
    }
  });
}

let lpMmTimer = null;
function lpStartMinimapLoop() {
  if (lpMmTimer) return;
  lpMmTimer = setInterval(() => {
    const canvas = document.getElementById('lpMinimap');
    if (canvas && canvas._mmDraw) canvas._mmDraw();
  }, 400);
}

function lpMountMinimap(center, markers, emptyMsg) {
  const canvas = document.getElementById('lpMinimap');
  if (!canvas) return;
  const wrap = canvas.closest('.lp-minimap-wrap');
  const emptyEl = wrap ? wrap.querySelector('.lp-minimap-empty') : null;
  if (emptyEl) {
    if (!markers.length && emptyMsg) { emptyEl.textContent = emptyMsg; emptyEl.style.display = 'flex'; }
    else emptyEl.style.display = 'none';
  }
  canvas._mmDraw = () => lpDrawMinimap(canvas, center.lat, center.lon, markers);
  canvas._mmDraw();
  if (wrap) {
    wrap.onclick = () => {
      if (typeof S !== 'undefined') { S.lat = center.lat; S.lon = center.lon; }
      if (typeof zoomTarget !== 'undefined') zoomTarget = 14;
    };
  }
  lpStartMinimapLoop();
}

function lpMountTabMinimap() {
  const pets = (typeof S !== 'undefined' ? S.pets : []) || [];
  const emoji = p => (typeof SPECIES_EM !== 'undefined' ? SPECIES_EM[p.species] : '') || '🐾';

  if (lpActiveTab === 'pets') {
    const markers = pets.filter(p => typeof p.lat === 'number').map(p => ({
      lat: p.lat, lon: p.lon ?? p.lng,
      color: p.lost ? '#ff3333' : (p.status === 'walking' ? '#ffcc66' : '#88cc44'),
      emoji: emoji(p), pulse: !!p.lost
    }));
    lpMountMinimap(lpBoundsCenter(pets), markers, 'No pets on the map yet 🐾');
  } else if (lpActiveTab === 'gps') {
    const markers = pets.filter(p => typeof p.lat === 'number').map(p => ({
      lat: p.lat, lon: p.lon ?? p.lng,
      color: p.gps ? '#88cc44' : 'rgba(204,136,51,0.5)',
      emoji: emoji(p), big: !!p.gps
    }));
    lpMountMinimap(lpBoundsCenter(pets), markers, 'No pets registered yet');
  } else if (lpActiveTab === 'lost') {
    const lostPets = pets.filter(p => p.lost);
    if (lostPets.length) {
      const markers = lostPets.map(p => ({
        lat: p.lostLat || p.lat, lon: p.lostLon || (p.lon ?? p.lng),
        color: '#ff3333', emoji: emoji(p), pulse: true, big: true
      }));
      lpMountMinimap(lpBoundsCenter(lostPets.map(p => ({ lat: p.lostLat || p.lat, lon: p.lostLon || p.lon }))), markers, '');
    } else {
      const markers = pets.filter(p => typeof p.lat === 'number').map(p => ({
        lat: p.lat, lon: p.lon ?? p.lng, color: 'rgba(136,204,68,0.55)', emoji: emoji(p)
      }));
      lpMountMinimap(lpBoundsCenter(pets), markers, 'No pets currently lost 🎾');
    }
  }
}

// ── Toggle ──
function lpToggle() {
  lpOpen = !lpOpen;
  const root = document.getElementById('lpRoot');
  const btn = document.getElementById('lpToggleBtn');
  root.classList.toggle('lp-collapsed', !lpOpen);
  btn.textContent = lpOpen ? '◀' : '▶';
}

// ── Tab switch ──
function lpSwitchTab(tab) {
  lpActiveTab = tab;
  document.querySelectorAll('.lp-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.lptab === tab);
  });
  lpRender();
}

// ── Render ──
function lpRender() {
  const el = document.getElementById('lpContent');
  if (!el) return;
  if (lpActiveTab === 'pets') el.innerHTML = lpRenderPets();
  else if (lpActiveTab === 'gps') el.innerHTML = lpRenderGPS();
  else if (lpActiveTab === 'notebook') lpRenderNotebook(el);
  else if (lpActiveTab === 'lost') el.innerHTML = lpRenderLost();
  lpMountTabMinimap();
  lpBindContent();
}

// ── Pets tab ──
function lpRenderPets() {
  const pets = (typeof S !== 'undefined' ? S.pets : []) || [];
  const minimap = '<div class="lp-minimap-wrap"><canvas id="lpMinimap"></canvas><div class="lp-minimap-empty"></div></div>';
  if (!pets.length) {
    return minimap +
      '<div style="color:rgba(255,204,102,0.3);text-align:center;padding:16px;font-style:italic;font-size:.8rem">No pets yet...<br>Drop a pin or register one!</div>' +
      '<div class="lp-drop-zone" id="lpDropZone">drop from map or friends panel</div>';
  }
  return minimap + '<div class="lp-drop-zone" id="lpDropZone">drop from map or friends panel</div>' +
    pets.map((p, i) => {
      const em = (typeof SPECIES_EM !== 'undefined' ? SPECIES_EM[p.species] : '') || '🐾';
      const dotClass = p.lost ? 'lost' : (p.status === 'walking' ? 'walk' : '');
      return `<div class="lp-pet-tile" data-pidx="${i}" id="lpTile${i}">
        <button class="lp-pt-opts">⚙</button>
        <div class="lp-pt-name">
          <span class="lp-pt-dot ${dotClass}"></span>
          ${em} ${p.name}
          ${p.lost ? '<span style="color:#ff3333;font-size:.65rem;margin-left:4px">LOST</span>' : ''}
        </div>
        <div class="lp-pt-breed">${p.breed || p.species || ''} · ${p.lost ? '🔴 LOST' : (p.status || 'home')}</div>
        <div class="lp-tile-btns">
          <span class="lp-tile-btn" onclick="if(typeof panToPet==='function')panToPet(${i})">🎯 Go</span>
          ${p.lost
            ? `<span class="lp-tile-btn found" onclick="lpMarkFound(${i})">✅ Found</span>`
            : `<span class="lp-tile-btn lost" onclick="lpMarkLost(${i})">🔴 Lost</span>`}
        </div>
      </div>`;
    }).join('');
}

// ── GPS tab ──
// Well-established networks first (huge existing device base, no subscription),
// then dedicated cellular pet trackers (real-time, but need their own subscription).
const TRACKER_ECOSYSTEM = [
  { label: '🍎 Find My / AirTag', url: 'https://www.apple.com/airtag/', cls: '' },
  { label: '🔷 Galaxy SmartTag', url: 'https://www.samsung.com/global/galaxy/galaxy-smarttag2/', cls: '' },
  { label: '📡 Tractive', url: 'https://tractive.com', cls: 'cellular' },
  { label: '🐕 Fi', url: 'https://tryfi.com', cls: 'cellular' },
  { label: '🛰️ Findster', url: 'https://findsterpet.com', cls: 'cellular' },
];

const TRACTIVE_RELAY_URL = 'https://europe-west1-map-merger-venti.cloudfunctions.net/tractiveSync';

function lpRenderTrackerEcosystem() {
  return `<div class="lp-tracker-section">
    <div class="lp-tracker-label">🔗 REAL TRACKER OPTIONS</div>
    <div class="lp-tracker-grid">
      ${TRACKER_ECOSYSTEM.map(t => `<a class="lp-tracker-badge ${t.cls}" href="${t.url}" target="_blank" rel="noopener">${t.label}</a>`).join('')}
    </div>
    <button class="lp-tracker-badge cellular" style="border-style:solid;margin-top:4px;cursor:pointer" onclick="openTractiveModal()">📡 Connect Tractive account →</button>
    <div class="lp-tracker-hint">Got an AirTag/SmartTag/Fi/Findster already? Use "+ link device" below.</div>
  </div>`;
}

window.openTractiveModal = function() {
  document.getElementById('tractiveStatus').textContent = '';
  document.getElementById('tractiveStatus').className = 'lp-tv-status';
  document.getElementById('tractiveModalOverlay').classList.add('show');
};
window.closeTractiveModal = function() {
  document.getElementById('tractiveModalOverlay').classList.remove('show');
  document.getElementById('tractivePassword').value = '';
};
window.submitTractiveSync = async function() {
  const email = document.getElementById('tractiveEmail').value.trim();
  const password = document.getElementById('tractivePassword').value;
  const status = document.getElementById('tractiveStatus');
  if (!email || !password) {
    status.textContent = 'Enter both email and password.';
    status.className = 'lp-tv-status err';
    return;
  }
  status.textContent = '🐾 Syncing with Tractive...';
  status.className = 'lp-tv-status';
  try {
    const res = await fetch(TRACTIVE_RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Sync failed');
    document.getElementById('tractivePassword').value = '';
    if (!data.pets || !data.pets.length) {
      status.textContent = 'Logged in, but no pet locations came back.';
      status.className = 'lp-tv-status err';
      return;
    }
    mergeTractivePets(data.pets);
    status.textContent = `✅ Synced ${data.pets.length} pet(s)!`;
    status.className = 'lp-tv-status ok';
    setTimeout(closeTractiveModal, 1200);
  } catch (e) {
    status.textContent = e.message || 'Sync failed — try again.';
    status.className = 'lp-tv-status err';
  }
};

function mergeTractivePets(tractivePets) {
  if (typeof S === 'undefined') return;
  tractivePets.forEach(tp => {
    const existing = S.pets.find(p => p.name === tp.name);
    if (existing) {
      existing.lat = tp.lat;
      existing.lon = tp.lon;
      existing.gpsDevice = true;
      existing.trackerSource = 'tractive';
    } else {
      S.pets.push({
        name: tp.name, species: 'dog', breed: '', bio: '', tags: [], mood: 'playful',
        lat: tp.lat, lon: tp.lon, timestamp: Date.now(),
        gpsDevice: true, gps: true, trackerSource: 'tractive',
      });
    }
  });
  if (typeof savePets === 'function') savePets();
  lpRender();
  if (typeof toast === 'function') toast('📡 Tractive pets synced to the map!');
}

function lpRenderGPS() {
  const pets = (typeof S !== 'undefined' ? S.pets : []) || [];
  const minimap = '<div class="lp-minimap-wrap"><canvas id="lpMinimap"></canvas><div class="lp-minimap-empty"></div></div>';
  const ecosystem = lpRenderTrackerEcosystem();
  if (!pets.length) return minimap + ecosystem + '<div style="color:rgba(255,204,102,0.3);text-align:center;padding:16px;font-size:.8rem">No pets registered yet.</div>';
  return minimap + ecosystem + pets.map((p, i) => {
    const em = (typeof SPECIES_EM !== 'undefined' ? SPECIES_EM[p.species] : '') || '🐾';
    const hasGPS = p.gps || false;
    const hasDevice = p.gpsDevice || false;
    const lat = p.lat ? p.lat.toFixed(4) : '—';
    const lon = p.lon ? p.lon.toFixed(4) : '—';
    return `<div class="lp-gps-card">
      <div class="lp-gps-name">${em} ${p.name} <span class="lp-coords">&middot; ${lat}&deg;N ${lon}&deg;W</span></div>
      <div class="lp-gps-row">
        <span class="lp-gps-btn" onclick="lpToggleGPS(${i})">${hasGPS ? '📍 GPS on' : '📍 GPS off'}</span>
        <span class="lp-gps-btn device ${hasDevice ? 'linked' : ''}" onclick="lpLinkDevice(${i})">${hasDevice ? '⚡ tracking' : '+ link device'}</span>
        <span class="lp-gps-btn" onclick="if(typeof panToPet==='function')panToPet(${i})">🎯 Go</span>
      </div>
    </div>`;
  }).join('');
}

window.lpToggleGPS = function(i) {
  if (typeof S === 'undefined') return;
  S.pets[i].gps = !S.pets[i].gps;
  lpRender();
  if (typeof savePets === 'function') savePets();
};

window.lpLinkDevice = function(i) {
  if (typeof S === 'undefined') return;
  // PLACEHOLDER — connect to GPS tracker device API here
  // e.g. Tractive, Findster, Pod Tracker, etc.
  const name = S.pets[i].name;
  if (S.pets[i].gpsDevice) {
    S.pets[i].gpsDevice = false;
    if (typeof toast === 'function') toast(`📍 Tracker unlinked from ${name}`);
  } else {
    S.pets[i].gpsDevice = true;
    if (typeof toast === 'function') toast(`🔗 Tracker linked to ${name} (placeholder)`);
  }
  lpRender();
  if (typeof savePets === 'function') savePets();
};

// ── Notebook tab ──
function lpRenderNotebook(el) {
  const pets = (typeof S !== 'undefined' ? S.pets : []) || [];
  const petOptions = pets.map((p, i) =>
    `<option value="${i}">${(typeof SPECIES_EM !== 'undefined' ? SPECIES_EM[p.species] : '') || '🐾'} ${p.name}</option>`
  ).join('');

  const noteCards = lpNotes.slice().reverse().map((n, ri) => {
    const i = lpNotes.length - 1 - ri;
    const pet = n.petIdx >= 0 && pets[n.petIdx] ? pets[n.petIdx].name : 'General';
    const ago = lpTimeAgo(n.ts);
    const goBtn = n.petIdx >= 0 ? `<span class="lp-tile-btn" style="margin-left:5px" onclick="if(typeof panToPet==='function')panToPet(${n.petIdx})">🎯</span>` : '';
    return `<div class="lp-note">
      <div class="lp-note-head">
        <span class="lp-note-label">🐾 ${pet}${goBtn}</span>
        <button class="lp-note-del" onclick="lpDeleteNote(${i})">✕</button>
      </div>
      <div class="lp-note-txt">${lpEscape(n.text)}</div>
      <div class="lp-note-time">${ago}</div>
    </div>`;
  }).join('');

  el.innerHTML = noteCards +
    `<div class="lp-note-form">
      <select class="lp-note-select" id="lpNoteTarget">
        <option value="-1">📓 General note</option>
        ${petOptions}
      </select>
      <textarea class="lp-note-input" id="lpNoteText" rows="2" placeholder="e.g. Ferajna hates the carrier..."></textarea>
      <button class="lp-note-save" onclick="lpSaveNote()">💾 Save note</button>
    </div>`;
}

window.lpSaveNote = function() {
  const text = (document.getElementById('lpNoteText') || {}).value || '';
  const petIdx = parseInt((document.getElementById('lpNoteTarget') || {}).value || '-1');
  if (!text.trim()) return;
  lpNotes.push({ text: text.trim(), petIdx, ts: Date.now() });
  localStorage.setItem('sf_notes', JSON.stringify(lpNotes));
  lpRender();
  if (typeof toast === 'function') toast('📓 Note saved!');
};

window.lpDeleteNote = function(i) {
  lpNotes.splice(i, 1);
  localStorage.setItem('sf_notes', JSON.stringify(lpNotes));
  lpRender();
};

// ── LOST tab ──
function lpRenderLost() {
  const pets = (typeof S !== 'undefined' ? S.pets : []) || [];
  const lostMode = document.getElementById('lpRoot').classList.contains('lost-mode');
  const minimap = '<div class="lp-minimap-wrap"><canvas id="lpMinimap"></canvas><div class="lp-minimap-empty"></div></div>';

  if (!pets.length) {
    return minimap + '<div style="color:rgba(255,80,80,0.4);text-align:center;padding:16px;font-size:.8rem">No pets registered.<br>Register a pet first.</div>';
  }

  const petBtns = pets.map((p, i) => {
    const em = (typeof SPECIES_EM !== 'undefined' ? SPECIES_EM[p.species] : '') || '🐾';
    const isLost = p.lost || false;
    if (isLost) {
      return `<button class="lp-lost-pet-btn active-lost" onclick="lpMarkFound(${i})">
        ${em} ${p.name} <span style="margin-left:auto;font-size:.75rem">🔴 LOST</span>
      </button>
      <div class="lp-tile-btns" style="margin:-2px 0 6px">
        <span class="lp-tile-btn" onclick="if(typeof panToPet==='function')panToPet(${i})">🎯 Last seen</span>
      </div>
      <button class="lp-found-btn" onclick="lpMarkFound(${i})">✅ ${p.name} IS FOUND!</button>`;
    }
    return `<button class="lp-lost-pet-btn" onclick="lpMarkLost(${i})">
      ${em} ${p.name} <span style="margin-left:auto;font-size:.75rem;color:rgba(255,80,80,0.4)">mark lost →</span>
    </button>`;
  }).join('');

  const socialBtns = lostMode
    ? `<div style="margin-top:8px;border-top:1px solid rgba(255,30,30,0.2);padding-top:8px">
        <div style="color:rgba(255,80,80,0.5);font-size:.65rem;margin-bottom:5px">📢 Broadcast to:</div>
        <div id="lpSocialBtns"></div>
      </div>`
    : '';

  return minimap + `<div class="lp-lost-header">🔴 Lost Pet Alert</div>
    <div class="lp-lost-info">Tap a pet to mark lost.<br>The whole network will be alerted.</div>
    ${petBtns}
    ${socialBtns}`;
}

window.lpMarkLost = function(i) {
  if (typeof S === 'undefined') return;
  const pet = S.pets[i];
  if (!pet) return;
  if (!confirm(`Mark ${pet.name} as LOST? This will alert the whole Snout First network.`)) return;

  pet.lost = true;
  pet.lostAt = Date.now();
  pet.lostLat = pet.lat;
  pet.lostLon = pet.lon;

  if (typeof savePets === 'function') savePets();
  if (typeof activateLostMode === 'function') activateLostMode(pet);
  if (typeof toast === 'function') toast(`🔴 ${pet.name} marked as LOST. Network alerted.`);

  lpRender();

  // Inject social buttons via lost-social.js
  setTimeout(() => {
    const el = document.getElementById('lpSocialBtns');
    if (el && typeof renderLostSocialButtons === 'function') renderLostSocialButtons(pet, el);
  }, 50);
};

window.lpMarkFound = function(i) {
  if (typeof S === 'undefined') return;
  const pet = S.pets[i];
  if (!pet) return;
  pet.lost = false;
  pet.foundAt = Date.now();
  if (typeof savePets === 'function') savePets();
  if (typeof deactivateLostMode === 'function') deactivateLostMode();
  if (typeof toast === 'function') toast(`🎉 ${pet.name} is HOME SAFE! 🐾`);
  lpRender();
};

// ── Bind content interactions ──
function lpBindContent() {
  // Drop zone for dragged pets
  const dz = document.getElementById('lpDropZone');
  if (dz) {
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('active'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('active'));
    dz.addEventListener('drop', e => {
      e.preventDefault();
      dz.classList.remove('active');
      try {
        const data = JSON.parse(e.dataTransfer.getData('sfPet') || e.dataTransfer.getData('pet') || '{}');
        if (data.name && typeof S !== 'undefined') {
          const exists = S.pets.findIndex(p => p.name === data.name);
          if (exists < 0) {
            S.pets.push({
              name: data.name, species: data.species || 'other',
              breed: data.breed || data.o || '',
              bio: data.bio || '', tags: data.tags || [],
              mood: data.mood || 'playful',
              lat: data.lat || S.lat, lon: data.lon || S.lon,
              timestamp: Date.now()
            });
            if (typeof savePets === 'function') savePets();
            if (typeof toast === 'function') toast(`🐾 ${data.name} added to My Pets!`);
          } else {
            if (typeof toast === 'function') toast(`${data.name} is already in your pack!`);
          }
          lpRender();
        }
      } catch(e) { console.warn('LP drop parse error', e); }
    });
  }

  // Pet tile click → pan to pet
  document.querySelectorAll('.lp-pet-tile[data-pidx]').forEach(tile => {
    tile.addEventListener('click', e => {
      if (e.target.closest('.lp-pt-opts') || e.target.closest('.lp-tile-btn')) return;
      const i = parseInt(tile.dataset.pidx);
      if (typeof panToPet === 'function') panToPet(i);
    });
  });

  // Social buttons after render
  if (lpActiveTab === 'lost') {
    const el = document.getElementById('lpSocialBtns');
    if (el && typeof S !== 'undefined') {
      const lostPet = S.pets.find(p => p.lost);
      if (lostPet && typeof renderLostSocialButtons === 'function') {
        renderLostSocialButtons(lostPet, el);
      }
    }
  }
}

// ── Helpers ──
function lpTimeAgo(ts) {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}
function lpEscape(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Register a pet shortcut ──
function bindAddBtn() {
  const btn = document.getElementById('lpAddBtn');
  if (btn) btn.addEventListener('click', () => {
    if (typeof togglePinPet === 'function') togglePinPet();
    if (typeof toast === 'function') toast('📍 Tap the map to drop a pet pin!');
  });
}

// ── Init ──
function init() {
  injectLeftPanel();

  // Toggle
  document.getElementById('lpToggleBtn').addEventListener('click', lpToggle);

  // Tab bar clicks
  document.getElementById('lpTabBar').addEventListener('click', e => {
    const tab = e.target.closest('.lp-tab');
    if (!tab) return;
    lpSwitchTab(tab.dataset.lptab);
  });

  bindAddBtn();
  lpRender();

  // Re-render when pets change (poll — lightweight)
  setInterval(() => {
    if (document.getElementById('lpRoot') && lpActiveTab === 'pets') {
      lpRenderPetsQuick();
    }
  }, 3000);
}

function lpRenderPetsQuick() {
  // Lightweight re-render just the pet count badge without full redraw
  const el = document.getElementById('lpContent');
  if (!el || lpActiveTab !== 'pets') return;
  // Only re-render if count changed
  const pets = (typeof S !== 'undefined' ? S.pets : []) || [];
  const current = el.querySelectorAll('.lp-pet-tile').length;
  if (current !== pets.length) lpRender();
}

// ── Public API ──
window.lpRefresh = lpRender;
window.lpSwitchTab = lpSwitchTab;

// ── Kick off after DOM ready ──
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
