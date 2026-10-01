// ═══════════════════════════════════════════════════════════════
//  game.js — State, loop, controls, movement, boot
// ═══════════════════════════════════════════════════════════════

const G = {
  pos: { lat: 51.5155, lng: -0.0922 },
  dir: 'up', keys: {}, frameN: 0, veh: 'walk', zoom: 15,
  pinMode: false, curTileLayer: 'dark',
  overlays: { grid: true, pins: true, transit: true, compass: true, weather: false },
  listings: [...DEMO], selectedCountry: null,
  showOffersOnly: false, showRedStrings: false, commentMode: false,
  searchResults: [],  // sprinkled search discoveries
  // 360° analog movement
  analogMode: false, heading: 0, velocity: 0,
  comments: [
    { lat:51.51, lng:-0.13, text:"This kiln is amazing", from:"NeonWanderer42", timestamp:"2026-03-12" },
    { lat:52.52, lng:13.40, text:"Collab on large-scale prints?", from:"CosmicNomad7", timestamp:"2026-03-14" },
    { lat:48.86, lng:2.35, text:"Darkroom available this weekend", from:"ElectricSeeker12", timestamp:"2026-03-10" },
  ],
  notesMode: localStorage.getItem('rvNotesMode') || 'full', // full | medium | small | off
};

// ── NOTES DISPLAY MODES ──
// full   — auto-expand into the big box within 120px of screen center (default)
// medium — auto-expand only within 60px of screen center
// small  — always just the yellow dot, never expands into a box
// off    — notes are not drawn at all
const NOTES_MODES = {
  full:   { label: '\u{1F7E1} Full Notes',   radius: 120, cls: 'notes-lvl-full' },
  medium: { label: '\u{1F7E0} Medium Notes', radius: 60,  cls: 'notes-lvl-medium' },
  small:  { label: '⚪ Small Notes',     radius: 0,   cls: 'notes-lvl-small' },
  off:    { label: '⚫ Notes Off',       radius: -1,  cls: 'notes-lvl-off' },
};
const NOTES_MODE_ORDER = ['full', 'medium', 'small', 'off'];

function applyNotesModeStyle() {
  const b = document.getElementById('commentBtn');
  if (!b) return;
  NOTES_MODE_ORDER.forEach(m => b.classList.remove(NOTES_MODES[m].cls));
  b.classList.add(NOTES_MODES[G.notesMode].cls);
}

function setNotesMode(mode) {
  if (!NOTES_MODES[mode]) return;
  G.notesMode = mode;
  try { localStorage.setItem('rvNotesMode', mode); } catch (e) {}
  applyNotesModeStyle();
  showToast(NOTES_MODES[mode].label, '#ffe600');
  closeNotesMenu();
}

// ── Right-click on NOTE button → small menu to pick display mode ──
let _notesMenuEl = null;
function closeNotesMenu() {
  if (_notesMenuEl) { _notesMenuEl.remove(); _notesMenuEl = null; }
}
function openNotesMenu(clientX, clientY) {
  closeNotesMenu();
  const menu = document.createElement('div');
  menu.id = 'notesModeMenu';
  menu.style.cssText = 'position:fixed;z-index:5000;background:#0a0a0a;border:1.5px solid #ffe600;' +
    'border-radius:6px;padding:4px;font-family:\'VT323\',monospace;box-shadow:0 0 14px rgba(255,230,0,0.35)';
  let left = clientX, top = clientY;
  if (left + 160 > window.innerWidth) left = window.innerWidth - 165;
  if (top + 140 > window.innerHeight) top = window.innerHeight - 145;
  menu.style.left = left + 'px'; menu.style.top = top + 'px';

  NOTES_MODE_ORDER.forEach(m => {
    const opt = document.createElement('div');
    opt.textContent = NOTES_MODES[m].label;
    opt.style.cssText = 'padding:6px 10px;cursor:pointer;color:#ffe600;font-size:.95rem;white-space:nowrap;border-radius:3px' +
      (m === G.notesMode ? ';background:rgba(255,230,0,0.2)' : '');
    opt.onmouseenter = () => opt.style.background = 'rgba(255,230,0,0.3)';
    opt.onmouseleave = () => opt.style.background = (m === G.notesMode ? 'rgba(255,230,0,0.2)' : '');
    opt.onclick = () => setNotesMode(m);
    menu.appendChild(opt);
  });

  document.body.appendChild(menu);
  _notesMenuEl = menu;

  setTimeout(() => {
    document.addEventListener('pointerdown', function onOutside(e) {
      if (_notesMenuEl && !_notesMenuEl.contains(e.target)) {
        closeNotesMenu();
        document.removeEventListener('pointerdown', onOutside);
      }
    });
  }, 0);
}
document.getElementById('commentBtn')?.addEventListener('contextmenu', e => {
  e.preventDefault();
  openNotesMenu(e.clientX, e.clientY);
});
applyNotesModeStyle();

const cv = document.getElementById('world');
const ctx = cv.getContext('2d');
function resize() { cv.width = window.innerWidth; cv.height = window.innerHeight; }
resize(); window.addEventListener('resize', resize);

// ── CONTROLS ──
document.addEventListener('keydown', e => {
  G.keys[e.key] = true;
  if (e.key === 'Escape') { closeModal(); document.getElementById('layersMenu')?.classList.remove('show'); document.getElementById('countryPanel')?.classList.remove('show'); }
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  if (e.key === '=' || e.key === '+') zoomIn();
  if (e.key === '-') zoomOut();
});
document.addEventListener('keyup', e => { G.keys[e.key] = false; });

const DM = { up:'ArrowUp', down:'ArrowDown', left:'ArrowLeft', right:'ArrowRight' };
document.querySelectorAll('.db[data-dir]').forEach(btn => {
  const k = DM[btn.dataset.dir];
  btn.addEventListener('pointerdown', () => { G.keys[k] = true; btn.classList.add('pressed'); });
  btn.addEventListener('pointerup', () => { G.keys[k] = false; btn.classList.remove('pressed'); });
  btn.addEventListener('pointerleave', () => { G.keys[k] = false; btn.classList.remove('pressed'); });
});
function centerPlayer() { toggleAnalogMode(); }

// ── ANALOG / 360° MODE ──
function toggleAnalogMode() {
  G.analogMode = !G.analogMode;
  G.velocity = 0;
  const dpad = document.querySelector('.dpad');
  const joystick = document.getElementById('joystickZone');
  if (G.analogMode) {
    if (dpad) dpad.style.display = 'none';
    if (joystick) joystick.style.display = 'block';
    showToast('\u{1F3AE} 360\u00B0 Analog mode! Touch/drag to steer', '#00bfff');
  } else {
    if (dpad) dpad.style.display = '';
    if (joystick) joystick.style.display = 'none';
    showToast('\u{1F4F1} Classic D-Pad mode', '#ffe600');
  }
}

// Joystick state (set by touch events on the joystick zone)
let _joyAngle = 0, _joyForce = 0; // angle in radians, force 0..1

// ── SEARCH (uses 3-tab system from search-panel.js) ──
document.getElementById('searchInput').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
// Backwards compat: goCity still works if called
async function goCity() {
  const el = document.getElementById('searchInput') || document.getElementById('CI');
  const name = el ? el.value.trim() : '';
  if (!name) return;
  if (el) el.value = name;
  if (typeof setSearchTab === 'function') setSearchTab('places');
  doSearch();
}

// ── SEARCH SPRINKLE ──
// Scatters a few random "discovery" pins from search results across the visible map
function sprinkleSearchResults(query, nominatimResults) {
  G.searchResults = [];
  const DISCOVERY_NAMES = [
    'Hidden Studio', 'Art Collective', 'Maker Space', 'Print Workshop',
    'Ceramics Lab', 'Dark Room', 'Sound Studio', 'Textile Hub',
    'Community Garden', 'Gallery Space', 'Open Workshop', 'Creative Den',
    'Craft Corner', 'Forge & Fire', 'The Art Vault', 'Colour House'
  ];
  // Use actual Nominatim results (skip first — that's the main destination)
  const extras = nominatimResults.slice(1);
  extras.forEach(r => {
    G.searchResults.push({
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      label: r.display_name.split(',')[0],
      query: query,
      fade: 1.0
    });
  });
  // Also sprinkle a few random fictional discoveries near the target
  const count = 3 + Math.floor(Math.random() * 4); // 3-6 random spots
  for (let i = 0; i < count; i++) {
    const spread = 0.02 + Math.random() * 0.06;
    G.searchResults.push({
      lat: G.pos.lat + (Math.random() - 0.5) * spread * 2,
      lng: G.pos.lng + (Math.random() - 0.5) * spread * 3,
      label: DISCOVERY_NAMES[Math.floor(Math.random() * DISCOVERY_NAMES.length)],
      query: query,
      fade: 1.0
    });
  }
  showToast('\u{1F50D} ' + G.searchResults.length + ' discoveries sprinkled!', '#cc44ff');
}

// ── PIN / CONSPIRACY ──
function togglePin() {
  G.pinMode = !G.pinMode; const pb = document.getElementById('pinBtn');
  if (G.pinMode) { pb.innerHTML = '\u{1F4CC} PINNING...'; pb.style.background = '#ff6600'; pb.style.color = '#000'; cv.style.cursor = 'crosshair'; showToast('Click to pin!', '#ff6600'); }
  else { pb.innerHTML = '\u{1F4CC} PIN'; pb.style.cssText = ''; cv.style.cursor = ''; }
}
function toggleOfferFilter() {
  G.showOffersOnly = !G.showOffersOnly; const b = document.getElementById('offerFilterBtn');
  if (G.showOffersOnly) { b.style.background = '#ffe600'; b.style.color = '#000'; setZoomLevel(3); }
  else b.style.cssText = '';
  showToast(G.showOffersOnly ? 'OFFERS only' : 'All spaces', '#ffe600');
}
function toggleRedStrings() {
  if (G.veh === 'ufo') {
    // In UFO mode, STRINGS opens the connections panel
    toggleUfoPanel();
    return;
  }
  G.showRedStrings = !G.showRedStrings; const b = document.getElementById('redStringBtn');
  if (G.showRedStrings) { b.style.background = '#ff2244'; b.style.color = '#fff'; showToast('Red strings \u{1F441}', '#ff2244'); }
  else { b.style.cssText = ''; showToast('Strings off', '#00ff41'); }
}
function toggleCommentMode() {
  G.commentMode = !G.commentMode; const b = document.getElementById('commentBtn');
  if (G.commentMode) { b.style.background = '#ffe600'; b.style.color = '#000'; cv.style.cursor = 'text'; }
  else { b.style.cssText = ''; cv.style.cursor = ''; }
}

// ── CANVAS CLICK ──
cv.addEventListener('click', e => {
  const w = screenToWorld(e.clientX, e.clientY);
  // UFO string drawing takes priority
  if (ufoDrawingString && ufoHandleMapClick(w.lat, w.lng)) return;
  if (G.commentMode) { G.commentMode = false; cv.style.cursor = ''; document.getElementById('commentBtn').style.cssText = ''; const t = prompt('Drop your note:'); if (t) { G.comments.push({ lat:w.lat, lng:w.lng, text:t, from:'Anonymous', timestamp:new Date().toISOString().split('T')[0] }); showToast('Note dropped!', '#ffe600'); } return; }
  if (G.pinMode) { G.pinMode = false; document.getElementById('pinBtn').innerHTML = '\u{1F4CC} PIN'; document.getElementById('pinBtn').style.cssText = ''; cv.style.cursor = ''; openNewPin(w.lat, w.lng); return; }
  let clicked = false;
  G.listings.forEach(l => { const s = worldToScreen(l.lat, l.lng); if (Math.abs(e.clientX - s.x) < 15 && Math.abs(e.clientY - s.y + 10) < 20) { openView(l); clicked = true; } });
  if (!clicked && !(G.veh === 'plane' && planeAirborne)) { G.pos.lat = w.lat; G.pos.lng = w.lng; }
});

// ── VEHICLE CHANGE ──
function setV(btn) {
  const nv = btn.dataset.v; if (nv === G.veh) return;
  G.veh = nv; planeAirborne = false; boatNearWater = false;
  document.querySelectorAll('.vbtn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
  const v = VEH[G.veh];

  // Update speed display based on vehicle type
  if (nv === 'plane') document.getElementById('SPD').innerHTML = '\u2708<br>' + curAircraft.kmh + ' km/h';
  else if (nv === 'boat') document.getElementById('SPD').innerHTML = '\u26F5<br>' + curBoat.kmh;
  else if (nv === 'bike') document.getElementById('SPD').innerHTML = '\u{1F6B2}<br>' + curBike.kmh;
  else if (nv === 'car') document.getElementById('SPD').innerHTML = '\u{1F697}<br>' + curCar.kmh;
  else if (nv === 'train') document.getElementById('SPD').innerHTML = '\u{1F682}<br>' + curTrain.kmh;
  else document.getElementById('SPD').innerHTML = v.em + '<br>' + v.kmh;

  document.getElementById('VS').innerHTML = v.em + ' ' + v.lbl;
  showToast('Vehicle: ' + v.em + ' ' + v.lbl, '#ffe600');

  // Clear all transit
  trainClear(); busStops = []; flyClear(); waterBodies = []; carClear();
  document.getElementById('transitInfo').style.display = 'none';

  // Show/hide notebook button (UFO mode only)
  const nbBtn = document.getElementById('notebookBtn');
  if (nbBtn) nbBtn.style.display = nv === 'ufo' ? 'inline-block' : 'none';
  if (nv !== 'ufo' && typeof ufoNotebookOpen !== 'undefined' && ufoNotebookOpen) toggleUfoNotebook();

  // Load mode-specific data + open variant selector
  if (nv === 'train') { trainLoadAround(); setTimeout(openTrainSelector, 300); }
  if (nv === 'bus') loadBusData();
  if (nv === 'plane') { flyLoadAirports(); if (!showFlights) toggleFlights(); setTimeout(openAircraftSelector, 300); }
  if (nv === 'boat') { fetchWaterBodies(); setTimeout(openBoatSelector, 300); }
  if (nv === 'bike') setTimeout(openBikeSelector, 300);
  if (nv === 'car') { carLoadRoads(); carLoadStations(); carFetchFuelPrices(); setTimeout(openCarSelector, 300); }
}

// ── MOVEMENT ──
// Analog movement constants
const TURN_SPEED = 3.0;    // degrees per frame
const ACCEL = 0.06;        // velocity units per frame
const FRICTION = 0.94;     // velocity multiplier when no input
const MAX_VEL = 1.0;       // max velocity (multiplied by vehicle spd)

function updateMovement() {
  const k = G.keys;
  const up = k.ArrowUp || k.w || k.W;
  const dn = k.ArrowDown || k.s || k.S;
  const lt = k.ArrowLeft || k.a || k.A;
  const rt = k.ArrowRight || k.d || k.D;
  const mv = up || dn || lt || rt;

  // ── ANALOG 360° MODE ──
  if (G.analogMode && G.veh !== 'plane') {
    const spd = VEH[G.veh]?.spd || VEH.walk.spd;
    // Joystick input (touch) takes priority over keyboard
    if (_joyForce > 0.05) {
      // Joystick: angle sets heading directly, force sets velocity
      G.heading = _joyAngle * 180 / Math.PI;
      G.velocity = Math.min(MAX_VEL, _joyForce * MAX_VEL);
    } else {
      // Keyboard analog: left/right = turn, up/down = accel/brake
      if (lt) G.heading -= TURN_SPEED;
      if (rt) G.heading += TURN_SPEED;
      G.heading = ((G.heading % 360) + 360) % 360;
      if (up) G.velocity = Math.min(MAX_VEL, G.velocity + ACCEL);
      else if (dn) G.velocity = Math.max(-MAX_VEL * 0.4, G.velocity - ACCEL * 1.5);
      else G.velocity *= FRICTION;
    }
    if (Math.abs(G.velocity) < 0.005) { G.velocity = 0; return; }
    // Convert heading + velocity to lat/lng delta
    const rad = G.heading * Math.PI / 180;
    const dlng = Math.sin(rad) * G.velocity * spd;
    const dlat = -Math.cos(rad) * G.velocity * spd; // screen-up = heading 0 = north = +lat, but cos(0)=1, so negate for math
    const nl = G.pos.lat - dlat; // minus because: heading 0 (north) → +lat
    const ng = G.pos.lng + dlng;
    // Set direction for sprite
    if (Math.abs(dlng) > Math.abs(dlat)) G.dir = dlng > 0 ? 'right' : 'left';
    else G.dir = dlat < 0 ? 'up' : 'down';
    G.pos.lat = nl; G.pos.lng = ng;
    return;
  }

  // ── CLASSIC MODE (unchanged logic below) ──

  if (G.veh === 'plane') {
    planeUpdateControls(); // mode-plane.js handles all plane movement

  } else if (G.veh === 'train' && trainTracks.length > 0 && mv) {
    // ── TRAIN: snap to tracks with gap jumping ──
    const s = curTrain.spd;
    let nl = G.pos.lat, ng = G.pos.lng;
    if (up) { nl += s; G.dir = 'up'; }
    if (dn) { nl -= s; G.dir = 'down'; }
    if (lt) { ng -= s; G.dir = 'left'; }
    if (rt) { ng += s; G.dir = 'right'; }
    const sn = snapToTrack(nl, ng);
    if (sn.snapped && sn.tight) {
      G.pos.lat = sn.lat; G.pos.lng = sn.lng;
    } else if (sn.snapped && !sn.tight) {
      G.pos.lat = sn.lat; G.pos.lng = sn.lng;
    } else {
      const slow = VEH.walk.spd * 0.4;
      if (up) G.pos.lat += slow; if (dn) G.pos.lat -= slow;
      if (lt) G.pos.lng -= slow; if (rt) G.pos.lng += slow;
    }

  } else if (G.veh === 'boat') {
    if (!mv) return;
    if (boatNearWater) {
      const spd = curBoat.spd;
      let nl = G.pos.lat, ng = G.pos.lng;
      if (up) { nl += spd; G.dir = 'up'; }
      if (dn) { nl -= spd; G.dir = 'down'; }
      if (lt) { ng -= spd; G.dir = 'left'; }
      if (rt) { ng += spd; G.dir = 'right'; }
      if (isOnWater(nl, ng)) {
        G.pos.lat = nl; G.pos.lng = ng;
      } else {
        const crawl = VEH.walk.spd * 0.15;
        if (up) G.pos.lat += crawl; if (dn) G.pos.lat -= crawl;
        if (lt) G.pos.lng -= crawl; if (rt) G.pos.lng += crawl;
      }
    } else {
      const crawl = VEH.walk.spd * 0.15;
      if (up) { G.pos.lat += crawl; G.dir = 'up'; }
      if (dn) { G.pos.lat -= crawl; G.dir = 'down'; }
      if (lt) { G.pos.lng -= crawl; G.dir = 'left'; }
      if (rt) { G.pos.lng += crawl; G.dir = 'right'; }
    }

  } else if (G.veh === 'bike') {
    const spd = curBike.spd;
    if (up) { G.pos.lat += spd; G.dir = 'up'; }
    if (dn) { G.pos.lat -= spd; G.dir = 'down'; }
    if (lt) { G.pos.lng -= spd; G.dir = 'left'; }
    if (rt) { G.pos.lng += spd; G.dir = 'right'; }

  } else if (G.veh === 'car') {
    if (!mv) return;
    if (carFuel <= 0 && !curCar.isElectric) {
      if (G.frameN % 60 === 0) showToast('\u26FD OUT OF FUEL! Find a station!', '#ff2244');
      return;
    }
    let baseSpd = curCar.spd;
    let nl = G.pos.lat, ng = G.pos.lng;
    if (up) { nl += baseSpd; G.dir = 'up'; }
    if (dn) { nl -= baseSpd; G.dir = 'down'; }
    if (lt) { ng -= baseSpd; G.dir = 'left'; }
    if (rt) { ng += baseSpd; G.dir = 'right'; }
    const snap = carSnapToRoad(nl, ng);
    if (snap.snapped && snap.tight) {
      const mult = ROAD_SPEEDS[snap.roadType] || 1.0;
      const offRoadBonus = (curCar.id === 'suv' && mult < 0.5) ? 1.5 : 1.0;
      const finalSpd = baseSpd * mult * offRoadBonus;
      nl = G.pos.lat; ng = G.pos.lng;
      if (up) nl = G.pos.lat + finalSpd;
      if (dn) nl = G.pos.lat - finalSpd;
      if (lt) ng = G.pos.lng - finalSpd;
      if (rt) ng = G.pos.lng + finalSpd;
      const snap2 = carSnapToRoad(nl, ng);
      G.pos.lat = snap2.lat; G.pos.lng = snap2.lng;
      carOnRoad = true;
    } else if (snap.snapped && !snap.tight) {
      G.pos.lat = snap.lat; G.pos.lng = snap.lng;
      carOnRoad = false;
    } else {
      const offMult = curCar.id === 'suv' ? 0.5 : 0.25;
      const slow = baseSpd * offMult;
      if (up) G.pos.lat += slow; if (dn) G.pos.lat -= slow;
      if (lt) G.pos.lng -= slow; if (rt) G.pos.lng += slow;
      carOnRoad = false;
    }
    carOdometer += haversine(G.pos.lat, G.pos.lng, G.pos.lat - (up ? baseSpd : dn ? -baseSpd : 0), G.pos.lng);
    carBurnFuel();

  } else {
    const s = VEH[G.veh]?.spd || VEH.walk.spd;
    if (up) { G.pos.lat += s; G.dir = 'up'; }
    if (dn) { G.pos.lat -= s; G.dir = 'down'; }
    if (lt) { G.pos.lng -= s; G.dir = 'left'; }
    if (rt) { G.pos.lng += s; G.dir = 'right'; }
  }
}

// ── MAIN LOOP ──
function loop() {
  G.frameN++;
  updateZoomSmooth();
  updateMovement();
  if (G.veh === 'plane') flyUpdatePhysics();

  // Periodic checks
  if (G.frameN % 20 === 0 && G.veh === 'plane') checkAirportProximity();
  if (G.frameN % 300 === 0 && G.veh === 'plane') { airportCheckReload(); planeWeatherCheck(); updateBlitzortungBounds(); }
  if (G.frameN % 90 === 0 && G.veh === 'train') trainCheckProgressiveLoad();
  if (G.frameN % 45 === 0 && G.veh === 'train' && Object.values(G.keys).some(Boolean)) trainLoadForward();
  if (G.frameN % 180 === 0 && G.veh === 'boat') boatCheckWater();
  if (G.frameN % 10 === 0 && G.veh === 'boat') boatUpdateWaterStatus(); // frequent water check
  if (G.frameN % 120 === 0 && G.veh === 'car') carCheckProgressiveLoad();
  if (G.frameN % 15 === 0 && G.veh === 'car') carCheckStationProximity();
  if (G.frameN % 600 === 0) weatherCheck();
  if (G.frameN % 600 === 0) rainRadarCheck();
  if (G.frameN % 300 === 0) mushroomCheck();
  if (G.frameN % 300 === 0) wildlifeCheck();

  // ── RENDER PIPELINE ──
  ctx.fillStyle = '#0a0a12'; ctx.fillRect(0, 0, cv.width, cv.height);

  drawTiles();             // 1. Base map tiles
  drawRainRadar();         // 1b. RainViewer precipitation radar overlay
  drawRailTileOverlay();   // 2. OpenRailwayMap overlay (train mode)
  drawGrid();              // 3. Coordinate grid
  drawWaterHighlight();    // 4. Water body highlighting (boat mode)
  drawTrainTracks();       // 5. Train tracks (Overpass data)
  drawTrainStations();     // 6. Train stations
  drawBusStops();          // 7. Bus stops
  drawCarRoads();          // 7b. Car roads (car mode)
  drawPetrolStations();    // 7c. Petrol stations (car mode)
  drawAirports();          // 8. Airports
  drawFlights();           // 9. Real-time flights
  drawRedStrings();        // 10. Red string connections
  drawConspiracyStrings(); // 10b. Greyed-out conspiracy strings (all modes)
  drawCemeteryOverlay();   // 10c. Cemetery fog + tombstone pins
  drawListings();          // 11. ArtSpace pins
  drawSearchResults();     // 11b. Search sprinkle discoveries
  drawMushrooms();         // 11c. iNaturalist fungi sightings
  drawWildlife();          // 11d. iNaturalist wildlife sightings
  drawComments();          // 12. Conspiracy comments
  // Mode-specific atmospheres
  drawTrainAtmosphere();   // 13a. Train: clouds, sunshine
  drawPlaneAtmosphere();   // 13b. Plane: lightning, rain, wind
  drawUfoAtmosphere();     // 13c. UFO: aurora, static, lightning
  drawWeather();           // 14. General weather overlay
  drawCloudOverlay();      // 14b. Standalone cloud layer (non-plane)
  drawLightningOverlay();  // 14c. Standalone lightning strikes (non-plane)
  drawWindOverlay();       // 14d. Wind direction arrows
  drawTempOverlay();       // 14e. Temperature colour tint
  drawHumidityOverlay();   // 14f. Humidity fog effect
  drawPlayer();            // 15. Player sprite
  drawPlaneAtmosphereEnd();// 15b. End turbulence shake
  drawHUD();               // 16. Compass + coords

  requestAnimationFrame(loop);
}

// ── VIRTUAL JOYSTICK ──
(function() {
  const zone = document.getElementById('joystickZone');
  const jcv = document.getElementById('joystickCanvas');
  if (!jcv) return;
  const jcx = jcv.getContext('2d');
  const CX = 60, CY = 60, R = 50, KR = 18;
  let knobX = CX, knobY = CY, active = false;

  function drawJoystick() {
    jcx.clearRect(0, 0, 120, 120);
    // Outer ring
    jcx.strokeStyle = 'rgba(0,255,65,0.2)'; jcx.lineWidth = 2;
    jcx.beginPath(); jcx.arc(CX, CY, R, 0, Math.PI * 2); jcx.stroke();
    // Cross-hairs
    jcx.strokeStyle = 'rgba(0,255,65,0.06)'; jcx.lineWidth = 1;
    jcx.beginPath(); jcx.moveTo(CX, CY - R); jcx.lineTo(CX, CY + R); jcx.stroke();
    jcx.beginPath(); jcx.moveTo(CX - R, CY); jcx.lineTo(CX + R, CY); jcx.stroke();
    // Heading indicator (N marker)
    const hRad = G.heading * Math.PI / 180;
    const nx = CX + Math.sin(hRad) * (R - 6), ny = CY - Math.cos(hRad) * (R - 6);
    jcx.fillStyle = 'rgba(255,230,0,0.4)'; jcx.beginPath(); jcx.arc(nx, ny, 3, 0, Math.PI * 2); jcx.fill();
    // Knob
    jcx.fillStyle = active ? 'rgba(0,255,65,0.6)' : 'rgba(0,255,65,0.25)';
    jcx.shadowColor = '#00ff41'; jcx.shadowBlur = active ? 12 : 4;
    jcx.beginPath(); jcx.arc(knobX, knobY, KR, 0, Math.PI * 2); jcx.fill();
    jcx.shadowBlur = 0;
    jcx.strokeStyle = 'rgba(0,255,65,0.5)'; jcx.lineWidth = 2;
    jcx.beginPath(); jcx.arc(knobX, knobY, KR, 0, Math.PI * 2); jcx.stroke();
    // Speed arc
    if (G.velocity > 0.01) {
      jcx.strokeStyle = 'rgba(0,191,255,0.4)'; jcx.lineWidth = 3;
      jcx.beginPath(); jcx.arc(CX, CY, R + 4, -Math.PI / 2, -Math.PI / 2 + (G.velocity / MAX_VEL) * Math.PI * 2); jcx.stroke();
    }
    requestAnimationFrame(drawJoystick);
  }
  drawJoystick();

  function updateKnob(clientX, clientY) {
    const rect = jcv.getBoundingClientRect();
    let dx = clientX - rect.left - CX;
    let dy = clientY - rect.top - CY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > R) { dx = dx / dist * R; dy = dy / dist * R; }
    knobX = CX + dx; knobY = CY + dy;
    const force = Math.min(1, dist / R);
    if (force > 0.1) {
      _joyAngle = Math.atan2(dx, -dy); // angle: 0=up, pi/2=right
      _joyForce = force;
    } else {
      _joyForce = 0;
    }
  }

  function resetKnob() { knobX = CX; knobY = CY; active = false; _joyForce = 0; }

  // Touch events
  jcv.addEventListener('pointerdown', e => { active = true; jcv.setPointerCapture(e.pointerId); updateKnob(e.clientX, e.clientY); });
  jcv.addEventListener('pointermove', e => { if (active) updateKnob(e.clientX, e.clientY); });
  jcv.addEventListener('pointerup', () => resetKnob());
  jcv.addEventListener('pointercancel', () => resetKnob());
})();

// ── BOOT ──
loadCemeteries();
document.getElementById('SS').textContent = G.listings.length;
updateZoomUI(); // Initialize zoom display (G now exists)
const countryList = document.getElementById('countryList');
if (countryList) {
  COUNTRIES.forEach(c => {
    const row = document.createElement('div');
    row.className = 'country-row';
    row.innerHTML = '<span class="country-code">' + c.code + '</span> ' + c.name;
    row.onclick = () => selectCountry(c.code);
    countryList.appendChild(row);
  });
}
loop();
