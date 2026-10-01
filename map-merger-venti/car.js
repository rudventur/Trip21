// ═══════════════════════════════════════════════════════════════
//  car.js — Full car mode
//  Variants · Road snapping · Fuel system · Petrol stations ·
//  Passenger capacity · Speed by road type · Sprites
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  SECTION 1: CAR VARIANTS
// ═══════════════════════════════════════════════════════════════

const CAR_VARIANTS = [
  { id: 'hatchback', name: 'Hatchback',   spd: 0.00038, kmh: '55 km/h',  color: '#3366ff',
    desc: 'Nimble city car', seats: 4, tankL: 45, mpg: 42, w: 15, h: 11 },
  { id: 'sedan',     name: 'Sedan',       spd: 0.00042, kmh: '65 km/h',  color: '#44aaff',
    desc: 'Comfortable cruiser', seats: 5, tankL: 55, mpg: 38, w: 17, h: 12 },
  { id: 'sports',    name: 'Sports Car',  spd: 0.00065, kmh: '95 km/h',  color: '#ff2244',
    desc: 'Fast and loud', seats: 2, tankL: 60, mpg: 22, w: 16, h: 10 },
  { id: 'suv',       name: 'SUV',         spd: 0.00048, kmh: '70 km/h',  color: '#44cc44',
    desc: 'Off-road capable', seats: 7, tankL: 70, mpg: 28, w: 19, h: 14 },
  { id: 'pickup',    name: 'Pickup Truck', spd: 0.00040, kmh: '60 km/h', color: '#cc8844',
    desc: 'Hauls anything', seats: 3, tankL: 80, mpg: 24, w: 20, h: 13 },
  { id: 'van',       name: 'Van',         spd: 0.00035, kmh: '50 km/h',  color: '#ffffff',
    desc: 'Max cargo space', seats: 8, tankL: 70, mpg: 30, w: 21, h: 15 },
  { id: 'supercar',  name: 'Supercar',    spd: 0.00090, kmh: '130 km/h', color: '#ffaa00',
    desc: 'Pure speed machine', seats: 2, tankL: 75, mpg: 14, w: 17, h: 10 },
  { id: 'electric',  name: 'Electric',    spd: 0.00050, kmh: '75 km/h',  color: '#00ddaa',
    desc: 'Silent & green', seats: 5, tankL: 999, mpg: 999, w: 16, h: 11,
    isElectric: true, rangeKm: 400, batteryKwh: 75 },
];

let curCar = CAR_VARIANTS[1]; // default sedan

// ═══════════════════════════════════════════════════════════════
//  SECTION 2: CAR STATE
// ═══════════════════════════════════════════════════════════════

let carFuel = 1.0;           // 0..1 (percentage of tank)
let carPassengers = 1;       // driver always counts
let carOnRoad = false;
let carRoads = [];           // [{coords:[[lat,lon],...], type:'motorway'|'primary'|...}]
let carRoadLoading = false;
let carRoadLastPos = null;
let carPetrolStations = [];  // [{lat,lon,name,brand}]
let carNearStation = null;
let carOdometer = 0;         // km driven
let carFuelPrices = null;    // fetched prices {country, petrol, diesel, currency}

// Road speed multipliers by type
const ROAD_SPEEDS = {
  motorway:      1.8,   // fast
  trunk:         1.5,
  primary:       1.2,
  secondary:     1.0,
  tertiary:      0.85,
  residential:   0.6,
  service:       0.4,
  unclassified:  0.7,
  living_street: 0.3,
  track:         0.25,  // dirt road — SUV bonus
};

// ═══════════════════════════════════════════════════════════════
//  SECTION 3: ROAD LOADING (Overpass)
// ═══════════════════════════════════════════════════════════════

async function carLoadRoads() {
  if (carRoadLoading) return;
  carRoadLoading = true;
  carRoadLastPos = { lat: G.pos.lat, lng: G.pos.lng };
  showToast('\u{1F697} Loading roads...', '#3366ff');
  try {
    const z = getZoom().z;
    // Zoom-aware: bigger area for major roads, smaller for minor
    const pad = z <= 7 ? 1.0 : z <= 9 ? 0.15 : z <= 13 ? 0.05 : 0.02;
    const bbox = (G.pos.lat - pad) + ',' + (G.pos.lng - pad * 1.6) + ',' +
                 (G.pos.lat + pad) + ',' + (G.pos.lng + pad * 1.6);
    // Only load road types appropriate for current zoom level
    let roadTypes = 'way["highway"="motorway"](' + bbox + ');' +
                    'way["highway"="trunk"](' + bbox + ');';
    if (z >= 7)  roadTypes += 'way["highway"="primary"](' + bbox + ');';
    if (z >= 9)  roadTypes += 'way["highway"="secondary"](' + bbox + ');';
    if (z >= 11) roadTypes += 'way["highway"="tertiary"](' + bbox + ');';
    if (z >= 13) roadTypes += 'way["highway"="residential"](' + bbox + ');' +
                              'way["highway"="unclassified"](' + bbox + ');';
    if (z >= 15) roadTypes += 'way["highway"="service"](' + bbox + ');';
    const q = '[out:json][timeout:15];(' + roadTypes + ');out geom;';
    const data = await overpassQuery(q);

    const newRoads = [];
    data.elements.forEach(e => {
      if (e.geometry && e.geometry.length >= 2) {
        newRoads.push({
          coords: e.geometry.map(g => [g.lat, g.lon]),
          type: e.tags?.highway || 'unclassified',
          name: e.tags?.name || '',
          maxspeed: e.tags?.maxspeed || ''
        });
      }
    });

    // Merge without duplicates
    const existing = new Set(carRoads.map(r => r.coords[0][0].toFixed(4) + ',' + r.coords[0][1].toFixed(4)));
    newRoads.forEach(r => {
      const k = r.coords[0][0].toFixed(4) + ',' + r.coords[0][1].toFixed(4);
      if (!existing.has(k)) { carRoads.push(r); existing.add(k); }
    });

    showToast('\u{1F697} ' + newRoads.length + ' roads loaded!', '#3366ff');
  } catch (e) {
    console.log('Road load error:', e);
    showToast('Road data unavailable', '#ff4444');
  }
  carRoadLoading = false;
}

// ── LOAD PETROL STATIONS ──
async function carLoadStations() {
  try {
    const pad = 0.03;
    const bbox = (G.pos.lat - pad) + ',' + (G.pos.lng - pad * 1.6) + ',' +
                 (G.pos.lat + pad) + ',' + (G.pos.lng + pad * 1.6);
    const q = '[out:json][timeout:10];(node["amenity"="fuel"](' + bbox + '););out body;';
    const data = await overpassQuery(q);
    const newStations = data.elements.map(e => ({
      lat: e.lat, lon: e.lon,
      name: e.tags?.name || 'Petrol Station',
      brand: e.tags?.brand || e.tags?.operator || '',
    }));
    // Merge
    const existing = new Set(carPetrolStations.map(s => s.lat.toFixed(4) + ',' + s.lon.toFixed(4)));
    newStations.forEach(s => {
      const k = s.lat.toFixed(4) + ',' + s.lon.toFixed(4);
      if (!existing.has(k)) { carPetrolStations.push(s); existing.add(k); }
    });
  } catch (e) { /* silent */ }
}

// ── FETCH FUEL PRICES ──
async function carFetchFuelPrices() {
  // Use a free fuel price API — creativecommons data
  try {
    // GlobalPetrolPrices provides rough data. We use a static approximation
    // that gets updated when you search a city (country detection triggers this)
    const country = G.selectedCountry?.code || 'GB';
    // Approximate petrol prices per litre (EUR) — updated periodically
    const FUEL_PRICES = {
      GB: { petrol: 1.45, diesel: 1.52, currency: '£', unit: '/L' },
      DE: { petrol: 1.78, diesel: 1.68, currency: '€', unit: '/L' },
      FR: { petrol: 1.82, diesel: 1.75, currency: '€', unit: '/L' },
      IT: { petrol: 1.85, diesel: 1.72, currency: '€', unit: '/L' },
      ES: { petrol: 1.62, diesel: 1.55, currency: '€', unit: '/L' },
      PL: { petrol: 1.42, diesel: 1.40, currency: 'zł', unit: '/L' },
      NL: { petrol: 2.05, diesel: 1.72, currency: '€', unit: '/L' },
      US: { petrol: 0.92, diesel: 0.98, currency: '$', unit: '/L' },
      JP: { petrol: 1.35, diesel: 1.20, currency: '¥', unit: '/L' },
      AU: { petrol: 1.60, diesel: 1.65, currency: 'A$', unit: '/L' },
    };
    carFuelPrices = FUEL_PRICES[country] || FUEL_PRICES.GB;
  } catch (e) { /* silent */ }
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 4: ROAD SNAPPING + ON-ROAD CHECK
// ═══════════════════════════════════════════════════════════════

const CAR_SNAP_TIGHT = 0.0004;  // ~45m — on road
const CAR_SNAP_LOOSE = 0.002;   // ~220m — near road, slow approach

function carSnapToRoad(lat, lng) {
  let minD = Infinity, bL = lat, bG = lng, roadType = 'none', roadName = '';
  carRoads.forEach(road => {
    const tk = road.coords;
    for (let i = 0; i < tk.length - 1; i++) {
      const [ax, ay] = tk[i], [bx, by] = tk[i + 1];
      const dx = bx - ax, dy = by - ay, ls = dx * dx + dy * dy;
      if (!ls) continue;
      let t = ((lat - ax) * dx + (lng - ay) * dy) / ls;
      t = Math.max(0, Math.min(1, t));
      const cx = ax + t * dx, cy = ay + t * dy, d = (cx - lat) ** 2 + (cy - lng) ** 2;
      if (d < minD) { minD = d; bL = cx; bG = cy; roadType = road.type; roadName = road.name; }
    }
  });

  if (minD < CAR_SNAP_TIGHT * CAR_SNAP_TIGHT) {
    return { lat: bL, lng: bG, snapped: true, tight: true, roadType, roadName };
  }
  if (minD < CAR_SNAP_LOOSE * CAR_SNAP_LOOSE) {
    const mix = 0.25;
    return {
      lat: lat + (bL - lat) * mix,
      lng: lng + (bG - lng) * mix,
      snapped: true, tight: false, roadType, roadName
    };
  }
  return { lat, lng, snapped: false, tight: false, roadType: 'none', roadName: '' };
}

function carCheckRoadStatus() {
  if (G.veh !== 'car') return;
  const snap = carSnapToRoad(G.pos.lat, G.pos.lng);
  carOnRoad = snap.snapped && snap.tight;
}

// Progressive road loading
function carCheckProgressiveLoad() {
  if (G.veh !== 'car') return;
  if (!carRoadLastPos || haversine(G.pos.lat, G.pos.lng, carRoadLastPos.lat, carRoadLastPos.lng) > 1) {
    carLoadRoads();
    carLoadStations();
  }
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 5: FUEL SYSTEM
// ═══════════════════════════════════════════════════════════════

function carBurnFuel() {
  if (G.veh !== 'car') return;
  if (curCar.isElectric) return; // electric doesn't burn fuel this way
  const moving = Object.values(G.keys).some(Boolean);
  if (!moving) return;

  // Burn rate based on MPG — lower MPG = burns faster
  // Base: 1 full tank lasts ~800 frames at MPG 38
  const burnRate = 0.00003 * (38 / curCar.mpg);
  carFuel = Math.max(0, carFuel - burnRate);
}

function carRefuel() {
  if (!carNearStation) { showToast('Drive to a petrol station!', '#ff4444'); return; }
  const litresNeeded = (1 - carFuel) * curCar.tankL;
  const price = carFuelPrices || { petrol: 1.50, currency: '£', unit: '/L' };
  const cost = (litresNeeded * price.petrol).toFixed(2);
  carFuel = 1.0;
  showToast('\u26FD Filled ' + litresNeeded.toFixed(1) + 'L \u2014 ' + price.currency + cost, '#44cc44');
}

// Check proximity to petrol stations
function carCheckStationProximity() {
  if (G.veh !== 'car') { carNearStation = null; return; }
  carNearStation = null;
  carPetrolStations.forEach(st => {
    if (haversine(G.pos.lat, G.pos.lng, st.lat, st.lon) < 0.15) {
      carNearStation = st;
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 6: DRAW ROADS
// ═══════════════════════════════════════════════════════════════

const ROAD_COLORS = {
  motorway:    { main: '#ff8800', glow: 'rgba(255,136,0,0.1)', width: 5 },
  trunk:       { main: '#ff6644', glow: 'rgba(255,102,68,0.1)', width: 4 },
  primary:     { main: '#ffcc44', glow: 'rgba(255,204,68,0.08)', width: 3.5 },
  secondary:   { main: '#aaddff', glow: 'rgba(170,221,255,0.08)', width: 3 },
  tertiary:    { main: '#ffffff', glow: 'rgba(255,255,255,0.05)', width: 2.5 },
  residential: { main: 'rgba(255,255,255,0.4)', glow: 'rgba(255,255,255,0.03)', width: 2 },
  service:     { main: 'rgba(255,255,255,0.2)', glow: 'rgba(255,255,255,0.02)', width: 1.5 },
  unclassified:{ main: 'rgba(255,255,255,0.3)', glow: 'rgba(255,255,255,0.03)', width: 2 },
};

// Minimum zoom level to show each road type
const ROAD_MIN_ZOOM = {
  motorway: 2, trunk: 5, primary: 7, secondary: 9,
  tertiary: 11, residential: 13, service: 15, unclassified: 13
};

function drawCarRoads() {
  if (G.veh !== 'car' || !G.overlays.transit || carRoads.length === 0) return;
  const z = getZoom().z;

  carRoads.forEach(road => {
    // Skip minor roads at zoomed-out levels
    const minZ = ROAD_MIN_ZOOM[road.type] || 13;
    if (z < minZ) return;

    const tk = road.coords;
    if (tk.length < 2) return;

    // Visibility check
    let onScreen = false;
    for (let i = 0; i < tk.length; i += Math.max(1, Math.floor(tk.length / 5))) {
      const s = worldToScreen(tk[i][0], tk[i][1]);
      if (s.x > -200 && s.x < cv.width + 200 && s.y > -200 && s.y < cv.height + 200) { onScreen = true; break; }
    }
    if (!onScreen) return;

    const col = ROAD_COLORS[road.type] || ROAD_COLORS.unclassified;

    // Glow
    ctx.strokeStyle = col.glow; ctx.lineWidth = col.width + 4; ctx.setLineDash([]);
    ctx.beginPath();
    tk.forEach((p, i) => { const s = worldToScreen(p[0], p[1]); i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y); });
    ctx.stroke();

    // Main road line
    ctx.strokeStyle = col.main; ctx.lineWidth = col.width;
    ctx.beginPath();
    tk.forEach((p, i) => { const s = worldToScreen(p[0], p[1]); i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y); });
    ctx.stroke();
  });
}

// ── DRAW PETROL STATIONS ──
function drawPetrolStations() {
  if (G.veh !== 'car' || !G.overlays.transit) return;
  const z = getZoom().z;

  carPetrolStations.forEach(st => {
    const s = worldToScreen(st.lat, st.lon);
    if (s.x < -40 || s.x > cv.width + 40 || s.y < -40 || s.y > cv.height + 40) return;

    const isNear = carNearStation && st.lat === carNearStation.lat && st.lon === carNearStation.lon;

    // Station icon
    ctx.fillStyle = isNear ? '#44ff44' : '#ff8800';
    ctx.shadowColor = isNear ? '#44ff44' : '#ff8800';
    ctx.shadowBlur = isNear ? 10 : 4;
    ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Pump icon
    ctx.fillStyle = '#000';
    ctx.font = '8px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('\u26FD', s.x, s.y);

    // Label
    if (z >= 14) {
      ctx.fillStyle = isNear ? '#44ff44' : '#ff8800';
      ctx.font = "9px 'VT323',monospace"; ctx.textAlign = 'left';
      const label = st.brand || st.name;
      ctx.fillText('\u26FD ' + label, s.x + 8, s.y + 3);
    }

    // "REFUEL" prompt when near
    if (isNear) {
      ctx.fillStyle = '#44ff44'; ctx.font = "7px 'Press Start 2P'"; ctx.textAlign = 'center';
      ctx.fillText('PRESS R TO REFUEL', s.x, s.y - 14);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 7: CAR SPRITE
// ═══════════════════════════════════════════════════════════════

function drawCarSprite() {
  const px = cv.width / 2, py = cv.height / 2;
  const moving = Object.values(G.keys).some(Boolean);
  const bob = moving ? Math.sin(G.frameN * 0.15) * 1 : 0;
  const c = curCar;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(px, py + c.h + 3, c.w * 0.8, 3, 0, 0, Math.PI * 2); ctx.fill();

  // Body
  ctx.fillStyle = c.color;
  ctx.fillRect(px - c.w, py + bob - c.h / 2, c.w * 2, c.h);

  // Roof / windshield
  ctx.fillStyle = 'rgba(150,220,255,0.55)';
  if (c.id === 'pickup' || c.id === 'van') {
    ctx.fillRect(px - c.w + 4, py + bob - c.h / 2 - 5, c.w, 6);
  } else {
    ctx.fillRect(px - c.w * 0.55, py + bob - c.h / 2 - 5, c.w * 1.1, 6);
  }

  // Wheels
  ctx.fillStyle = '#222';
  const wheelY = py + bob + c.h / 2;
  ctx.beginPath(); ctx.arc(px - c.w + 5, wheelY, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(px + c.w - 5, wheelY, 4, 0, Math.PI * 2); ctx.fill();

  // Wheel spin
  if (moving) {
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
    [px - c.w + 5, px + c.w - 5].forEach(wx => {
      const angle = G.frameN * 0.4;
      for (let a = 0; a < 3; a++) {
        const ra = angle + a * Math.PI * 2 / 3;
        ctx.beginPath();
        ctx.moveTo(wx, wheelY);
        ctx.lineTo(wx + Math.cos(ra) * 3, wheelY + Math.sin(ra) * 3);
        ctx.stroke();
      }
    });
  }

  // Sports car: racing stripe
  if (c.id === 'sports' || c.id === 'supercar') {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(px - 1, py + bob - c.h / 2, 2, c.h);
  }

  // SUV: roof rack
  if (c.id === 'suv') {
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
    ctx.strokeRect(px - 8, py + bob - c.h / 2 - 7, 16, 2);
  }

  // Van: side panel
  if (c.id === 'van') {
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
    ctx.strokeRect(px + 2, py + bob - c.h / 2 + 2, c.w - 4, c.h - 4);
  }

  // Electric: glow effect
  if (c.isElectric) {
    ctx.strokeStyle = '#00ddaa44'; ctx.lineWidth = 2;
    ctx.shadowColor = '#00ddaa'; ctx.shadowBlur = 8;
    ctx.strokeRect(px - c.w, py + bob - c.h / 2, c.w * 2, c.h);
    ctx.shadowBlur = 0;
  }

  // Pickup: truck bed
  if (c.id === 'pickup') {
    ctx.fillStyle = c.color + 'aa';
    ctx.fillRect(px + 4, py + bob - c.h / 2, c.w - 4, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
    ctx.strokeRect(px + 4, py + bob - c.h / 2, c.w - 4, c.h);
  }

  // Headlights
  if (G.dir === 'up' || G.dir === 'left' || G.dir === 'right') {
    ctx.fillStyle = 'rgba(255,255,200,0.6)';
    ctx.beginPath(); ctx.arc(px - c.w + 2, py + bob - c.h / 2 + 2, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px + c.w - 2, py + bob - c.h / 2 + 2, 2, 0, Math.PI * 2); ctx.fill();
  }

  // Tail lights (when going down/braking)
  if (G.dir === 'down') {
    ctx.fillStyle = 'rgba(255,0,0,0.7)';
    ctx.beginPath(); ctx.arc(px - c.w + 2, py + bob + c.h / 2 - 2, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px + c.w - 2, py + bob + c.h / 2 - 2, 2, 0, Math.PI * 2); ctx.fill();
  }

  // Exhaust when moving (not electric)
  if (moving && !c.isElectric) {
    for (let i = 0; i < 2; i++) {
      const age = (G.frameN * 0.04 + i * 0.4) % 1;
      const ex = px + c.w + age * 12;
      const ey = py + bob + c.h / 2 - 2 + Math.sin(G.frameN * 0.1 + i) * 2;
      ctx.fillStyle = 'rgba(180,180,180,' + (0.3 - age * 0.3) + ')';
      ctx.beginPath(); ctx.arc(ex, ey, 2 + age * 4, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Glow outline
  ctx.strokeStyle = c.color + '44'; ctx.lineWidth = 1;
  ctx.shadowColor = c.color; ctx.shadowBlur = 5;
  ctx.strokeRect(px - c.w, py + bob - c.h / 2, c.w * 2, c.h);
  ctx.shadowBlur = 0;

  // ── HUD: car name + road status ──
  ctx.font = "7px 'Press Start 2P'"; ctx.textAlign = 'center';
  ctx.fillStyle = c.color;
  ctx.fillText(c.name, px, py + bob - c.h / 2 - 18);

  if (carOnRoad) {
    ctx.fillStyle = '#44ff44'; ctx.font = "6px 'Press Start 2P'";
    ctx.fillText('ON ROAD', px, py + bob - c.h / 2 - 10);
  } else if (carRoads.length > 0) {
    ctx.fillStyle = '#ff6644'; ctx.font = "6px 'Press Start 2P'";
    ctx.fillText('OFF-ROAD', px, py + bob - c.h / 2 - 10);
  }

  // ── FUEL GAUGE (bottom of screen) ──
  const gaugeX = cv.width / 2 - 60;
  const gaugeY = cv.height - 72;
  const gaugeW = 120;
  const gaugeH = 8;

  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(gaugeX - 2, gaugeY - 2, gaugeW + 4, gaugeH + 4);

  // Fuel bar
  const fuelColor = carFuel > 0.3 ? '#44ff44' : carFuel > 0.1 ? '#ffaa00' : '#ff2244';
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(gaugeX, gaugeY, gaugeW, gaugeH);
  ctx.fillStyle = fuelColor;
  ctx.fillRect(gaugeX, gaugeY, gaugeW * carFuel, gaugeH);

  // Fuel text
  ctx.fillStyle = fuelColor;
  ctx.font = "8px 'VT323',monospace"; ctx.textAlign = 'left';
  const fuelText = curCar.isElectric
    ? '\u26A1 ' + Math.round(carFuel * 100) + '% \u00B7 ' + Math.round(carFuel * curCar.rangeKm) + 'km range'
    : '\u26FD ' + Math.round(carFuel * 100) + '% \u00B7 ' + Math.round(carFuel * curCar.tankL) + 'L';
  ctx.fillText(fuelText, gaugeX, gaugeY - 4);

  // Passengers + odometer
  ctx.fillStyle = 'rgba(0,191,255,0.5)';
  ctx.textAlign = 'right';
  ctx.fillText('\u{1F465} ' + carPassengers + '/' + curCar.seats + ' \u00B7 ' + carOdometer.toFixed(1) + 'km', gaugeX + gaugeW, gaugeY - 4);

  // Fuel price at station
  if (carNearStation && carFuelPrices) {
    ctx.fillStyle = '#44ff44'; ctx.font = "8px 'VT323',monospace"; ctx.textAlign = 'center';
    ctx.fillText('\u26FD ' + carFuelPrices.currency + carFuelPrices.petrol.toFixed(2) + carFuelPrices.unit +
      ' @ ' + (carNearStation.brand || carNearStation.name), cv.width / 2, gaugeY + gaugeH + 10);
  }

  // LOW FUEL WARNING
  if (carFuel < 0.1 && G.frameN % 40 < 20) {
    ctx.fillStyle = '#ff2244'; ctx.font = "8px 'Press Start 2P'"; ctx.textAlign = 'center';
    ctx.fillText('\u26A0 LOW FUEL \u26A0', cv.width / 2, gaugeY + gaugeH + 22);
  }
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 8: VARIANT SELECTOR
// ═══════════════════════════════════════════════════════════════

function openCarSelector() {
  let html = '<button class="mcl" onclick="closeModal()">\u2715</button>';
  html += '<div class="mh">\u{1F697} SELECT CAR</div>';
  CAR_VARIANTS.forEach(c => {
    const isCur = curCar.id === c.id;
    const fuelInfo = c.isElectric
      ? '\u26A1 ' + c.batteryKwh + 'kWh \u00B7 ' + c.rangeKm + 'km'
      : '\u26FD ' + c.tankL + 'L \u00B7 ' + c.mpg + 'mpg';
    html += '<div style="padding:8px;margin:4px 0;border:2px solid ' + (isCur ? c.color : 'rgba(0,255,65,0.15)') +
      ';border-radius:4px;cursor:pointer;background:' + (isCur ? 'rgba(255,255,255,0.05)' : 'transparent') +
      '" onclick="selectCar(\'' + c.id + '\')">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center">';
    html += '<span style="font-family:\'Press Start 2P\',monospace;font-size:.28rem;color:' + c.color + '">' + c.name + '</span>';
    html += '<span style="font-family:VT323,monospace;font-size:.85rem;color:rgba(0,191,255,0.5)">' + c.kmh + '</span>';
    html += '</div>';
    html += '<div style="font-family:VT323,monospace;font-size:.85rem;color:rgba(0,255,65,0.5);margin-top:2px">' +
      c.desc + ' \u00B7 \u{1F465} ' + c.seats + ' seats \u00B7 ' + fuelInfo + '</div>';
    html += '</div>';
  });

  // Passenger control
  html += '<div style="margin-top:10px;padding:8px;border:2px solid rgba(0,191,255,0.25);border-radius:4px">';
  html += '<div style="font-family:\'Press Start 2P\',monospace;font-size:.22rem;color:#00bfff;margin-bottom:6px">\u{1F465} PASSENGERS</div>';
  html += '<div style="display:flex;gap:6px;align-items:center">';
  html += '<button class="hbtn" onclick="carSetPassengers(-1)" style="padding:4px 8px">-</button>';
  html += '<span id="carPassDisp" style="font-family:VT323,monospace;font-size:1.1rem;color:#ffe600;min-width:40px;text-align:center">' + carPassengers + '/' + curCar.seats + '</span>';
  html += '<button class="hbtn" onclick="carSetPassengers(1)" style="padding:4px 8px">+</button>';
  html += '</div></div>';

  document.getElementById('MB').innerHTML = html;
  document.getElementById('MO').classList.add('open');
}

function selectCar(id) {
  curCar = CAR_VARIANTS.find(c => c.id === id) || CAR_VARIANTS[1];
  if (carPassengers > curCar.seats) carPassengers = curCar.seats;
  closeModal();
  document.getElementById('SPD').innerHTML = '\u{1F697}<br>' + curCar.kmh;
  showToast('\u{1F697} ' + curCar.name + ' \u2014 ' + curCar.desc, curCar.color);
  carFetchFuelPrices();
}

function carSetPassengers(delta) {
  carPassengers = Math.max(1, Math.min(curCar.seats, carPassengers + delta));
  const el = document.getElementById('carPassDisp');
  if (el) el.textContent = carPassengers + '/' + curCar.seats;
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 9: CLEANUP
// ═══════════════════════════════════════════════════════════════

function carClear() {
  carRoads = []; carPetrolStations = [];
  carRoadLastPos = null; carNearStation = null;
  carOnRoad = false;
}

// Refuel keybind
document.addEventListener('keydown', e => {
  if ((e.key === 'r' || e.key === 'R') && G.veh === 'car' && carNearStation) {
    carRefuel();
  }
});
