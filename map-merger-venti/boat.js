// ═══════════════════════════════════════════════════════════════
//  boat.js — Boat variants, water boundary enforcement, sprites
//  Boats ONLY move properly on water. On land = barely crawl.
// ═══════════════════════════════════════════════════════════════

const BOAT_VARIANTS = [
  { id: 'dinghy',    name: 'Dinghy',     spd: 0.00018, kmh: '25 km/h',  color: '#00bfff', desc: 'Agile small boat' },
  { id: 'yacht',     name: 'Yacht',      spd: 0.00028, kmh: '40 km/h',  color: '#ff6600', desc: 'Fast luxury' },
  { id: 'tanker',    name: 'Tanker',     spd: 0.00015, kmh: '20 km/h',  color: '#888',    desc: 'Slow heavy hauler' },
  { id: 'speedboat', name: 'Speedboat',  spd: 0.00038, kmh: '55 km/h',  color: '#ff2244', desc: 'Racing machine' },
];
let curBoat = BOAT_VARIANTS[1]; // default yacht

let lastWaterPos = null;
let waterLoading = false;

// ── POINT IN POLYGON (for water body check) ──
function pointInPoly(lat, lng, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if (((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// ── CHECK IF POSITION IS ON WATER ──
function isOnWater(lat, lng) {
  if (waterBodies.length === 0) return false;
  for (let i = 0; i < waterBodies.length; i++) {
    const poly = waterBodies[i];
    if (poly.length < 3) continue;
    // For closed polygons (lakes, seas): point-in-polygon
    const first = poly[0], last = poly[poly.length - 1];
    const isClosed = haversine(first[0], first[1], last[0], last[1]) < 0.05;
    if (isClosed && pointInPoly(lat, lng, poly)) return true;
    // For rivers/streams (not closed): check proximity to line segments
    for (let j = 0; j < poly.length - 1; j++) {
      const [ax, ay] = poly[j], [bx, by] = poly[j + 1];
      const dx = bx - ax, dy = by - ay, ls = dx * dx + dy * dy;
      if (!ls) continue;
      let t = ((lat - ax) * dx + (lng - ay) * dy) / ls;
      t = Math.max(0, Math.min(1, t));
      const cx = ax + t * dx, cy = ay + t * dy;
      const dist = Math.sqrt((cx - lat) ** 2 + (cy - lng) ** 2);
      if (dist < 0.0005) return true; // ~55m from river centerline
    }
  }
  return false;
}

// ── UPDATE WATER STATUS (called from game loop) ──
function boatUpdateWaterStatus() {
  if (G.veh !== 'boat') return;
  boatNearWater = isOnWater(G.pos.lat, G.pos.lng);
}

// ── FETCH WATER BODIES ──
async function fetchWaterBodies() {
  if (waterLoading) return;
  waterLoading = true;
  lastWaterPos = { lat: G.pos.lat, lng: G.pos.lng };
  try {
    const pad = 0.04;
    const bbox = (G.pos.lat - pad) + ',' + (G.pos.lng - pad * 1.6) + ',' +
                 (G.pos.lat + pad) + ',' + (G.pos.lng + pad * 1.6);
    const q = '[out:json][timeout:12];(' +
      'way["natural"="water"]('+bbox+');' +
      'way["waterway"="river"]('+bbox+');' +
      'way["waterway"="canal"]('+bbox+');' +
      'way["waterway"="stream"]('+bbox+');' +
      'way["natural"="coastline"]('+bbox+');' +
      'relation["natural"="water"]('+bbox+');' +
      ');out geom;';
    const data = await overpassQuery(q);
    waterBodies = [];
    data.elements.forEach(e => {
      if (e.geometry && e.geometry.length >= 3) {
        waterBodies.push(e.geometry.map(g => [g.lat, g.lon]));
      }
      // Relations may have members with geometry
      if (e.members) {
        e.members.forEach(m => {
          if (m.geometry && m.geometry.length >= 3) {
            waterBodies.push(m.geometry.map(g => [g.lat, g.lon]));
          }
        });
      }
    });
    boatNearWater = waterBodies.length > 0 && isOnWater(G.pos.lat, G.pos.lng);
    if (waterBodies.length > 0) {
      showToast('\u26F5 ' + waterBodies.length + ' water bodies found', '#00bfff');
    } else {
      showToast('\u26F5 No water nearby \u2014 move to find some!', '#ff4444');
    }
  } catch (e) {
    console.log('Water fetch error:', e);
  }
  waterLoading = false;
}

// ── DRAW WATER HIGHLIGHT ──
function drawWaterHighlight() {
  if (G.veh !== 'boat' || waterBodies.length === 0) return;

  waterBodies.forEach(poly => {
    if (poly.length < 2) return;

    // Check if any point on screen
    let onScreen = false;
    for (let i = 0; i < poly.length; i += Math.max(1, Math.floor(poly.length / 6))) {
      const s = worldToScreen(poly[i][0], poly[i][1]);
      if (s.x > -100 && s.x < cv.width + 100 && s.y > -100 && s.y < cv.height + 100) { onScreen = true; break; }
    }
    if (!onScreen) return;

    // Glow fill
    ctx.fillStyle = 'rgba(0, 120, 255, 0.2)';
    ctx.strokeStyle = 'rgba(0, 191, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00bfff';
    ctx.shadowBlur = 8;

    ctx.beginPath();
    poly.forEach((p, i) => {
      const s = worldToScreen(p[0], p[1]);
      i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y);
    });

    // For rivers/streams (not closed), just stroke
    const first = poly[0], last = poly[poly.length - 1];
    const isRiver = poly.length < 20 || haversine(first[0], first[1], last[0], last[1]) > 0.1;
    if (isRiver) {
      ctx.lineWidth = 4;
      ctx.stroke();
    } else {
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  });
}

// ── DRAW BOAT SPRITE ──
function drawBoatSprite() {
  const px = cv.width / 2, py = cv.height / 2;
  const moving = Object.values(G.keys).some(Boolean);
  const bob = moving ? Math.sin(G.frameN * 0.12) * 3 : Math.sin(G.frameN * 0.04) * 1;
  const w = curBoat.id === 'tanker' ? 22 : curBoat.id === 'speedboat' ? 12 : curBoat.id === 'yacht' ? 16 : 10;
  const h = curBoat.id === 'tanker' ? 14 : 8;

  // Hull
  ctx.fillStyle = curBoat.color;
  ctx.beginPath();
  ctx.moveTo(px - w, py + bob);
  ctx.lineTo(px + w, py + bob);
  ctx.lineTo(px + w - 4, py + bob + h);
  ctx.lineTo(px - w + 4, py + bob + h);
  ctx.closePath();
  ctx.fill();

  // Deck line
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(px - w + 3, py + bob + 1, (w - 3) * 2, 2);

  // Mast + sail for yacht/dinghy/speedboat
  if (curBoat.id !== 'tanker') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(px - 1, py + bob - 16, 2, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.moveTo(px + 1, py + bob - 14);
    ctx.lineTo(px + 14, py + bob - 4);
    ctx.lineTo(px + 1, py + bob + 2);
    ctx.closePath();
    ctx.fill();
  }

  // Tanker: containers on deck
  if (curBoat.id === 'tanker') {
    const colors = ['#cc4400', '#4466ff', '#44cc44', '#ffe600'];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = colors[i];
      ctx.fillRect(px - 14 + i * 8, py + bob - 8, 6, 6);
    }
  }

  // Speedboat: red stripe
  if (curBoat.id === 'speedboat') {
    ctx.fillStyle = '#ff2244';
    ctx.fillRect(px - w + 2, py + bob + h - 3, (w - 2) * 2, 2);
  }

  // Wake
  if (moving && boatNearWater) {
    ctx.strokeStyle = 'rgba(100,180,255,0.25)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const r = 6 + i * 5;
      const spread = 0.15 + i * 0.05;
      ctx.beginPath();
      ctx.arc(px, py + bob + h + 2, r, spread, Math.PI - spread);
      ctx.stroke();
    }
  }

  // Water status
  ctx.font = "7px 'Press Start 2P'";
  ctx.textAlign = 'center';
  if (boatNearWater) {
    ctx.fillStyle = '#00bfff';
    ctx.fillText(curBoat.name + ' ON WATER', px, py + bob - 22);
  } else {
    ctx.fillStyle = '#ff4444';
    ctx.fillText('\u26D4 ON LAND \u2014 FIND WATER!', px, py + bob - 22);
    // Red warning border flash
    if (G.frameN % 40 < 20) {
      ctx.strokeStyle = 'rgba(255,68,68,0.3)';
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, cv.width, cv.height);
    }
  }
}

// ── VARIANT SELECTOR ──
function openBoatSelector() {
  let html = '<button class="mcl" onclick="closeModal()">\u2715</button>';
  html += '<div class="mh">\u26F5 SELECT BOAT</div>';
  BOAT_VARIANTS.forEach(b => {
    const isCur = curBoat.id === b.id;
    html += '<div style="padding:8px;margin:4px 0;border:2px solid ' + (isCur ? b.color : 'rgba(0,255,65,0.15)') +
      ';border-radius:4px;cursor:pointer;background:' + (isCur ? 'rgba(255,255,255,0.05)' : 'transparent') +
      '" onclick="selectBoat(\'' + b.id + '\')">';
    html += '<div style="font-family:\'Press Start 2P\',monospace;font-size:.3rem;color:' + b.color + '">' + b.name + '</div>';
    html += '<div style="font-family:VT323,monospace;font-size:.9rem;color:rgba(0,255,65,0.6)">' + b.desc + ' \u00B7 ' + b.kmh + '</div>';
    html += '</div>';
  });
  document.getElementById('MB').innerHTML = html;
  document.getElementById('MO').classList.add('open');
}

function selectBoat(id) {
  curBoat = BOAT_VARIANTS.find(b => b.id === id) || BOAT_VARIANTS[1];
  closeModal();
  document.getElementById('SPD').innerHTML = '\u26F5<br>' + curBoat.kmh;
  showToast('\u26F5 ' + curBoat.name + ' \u2014 ' + curBoat.desc, curBoat.color);
}

// Water check for progressive loading
function boatCheckWater() {
  if (G.veh !== 'boat') return;
  if (!lastWaterPos || haversine(G.pos.lat, G.pos.lng, lastWaterPos.lat, lastWaterPos.lng) > 0.5) {
    fetchWaterBodies();
  }
}
