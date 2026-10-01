// ═══════════════════════════════════════════════════════════════
//  train.js — Railway tracks, stations, progressive loading
//  Now includes: subway, light_rail, metro, tram
//  Gap jumping: wider snap radius lets train bridge small gaps
// ═══════════════════════════════════════════════════════════════

let trainStations = [];
let trainTracks = [];    // [{coords:[[lat,lon],...], type:'rail'|'subway'|'light_rail'|'tram'}]
let trainLoading = false;
let trainLastCenter = null;
const TRAIN_RELOAD_DIST = 5;

// ── TRAIN VARIANTS ──
const TRAIN_VARIANTS = [
  { id: 'regional',  name: 'Regional',       spd: 0.0011,  kmh: '160 km/h',  color: '#ff6600', desc: 'Standard passenger train' },
  { id: 'intercity', name: 'Intercity',       spd: 0.0015,  kmh: '200 km/h',  color: '#ffcc44', desc: 'Fast intercity service' },
  { id: 'tgv',       name: 'TGV / Shinkansen', spd: 0.0022, kmh: '320 km/h', color: '#0088ff', desc: 'High-speed rail (France, Japan, Spain)' },
  { id: 'maglev',    name: 'Maglev',          spd: 0.0038,  kmh: '600 km/h',  color: '#cc44ff', desc: 'Magnetic levitation — Shanghai, Chuo' },
  { id: 'freight',   name: 'Freight',         spd: 0.0006,  kmh: '80 km/h',   color: '#cc8844', desc: 'Heavy goods hauler' },
  { id: 'metro',     name: 'Metro',           spd: 0.0008,  kmh: '110 km/h',  color: '#ff2266', desc: 'Underground rapid transit' },
];
let curTrain = TRAIN_VARIANTS[0];

function openTrainSelector() {
  let html = '<button class="mcl" onclick="closeModal()">\u2715</button>';
  html += '<div class="mh">\u{1F682} SELECT TRAIN</div>';
  TRAIN_VARIANTS.forEach(t => {
    const isCur = curTrain.id === t.id;
    html += '<div style="padding:8px;margin:4px 0;border:2px solid ' + (isCur ? t.color : 'rgba(0,255,65,0.15)') +
      ';border-radius:4px;cursor:pointer;background:' + (isCur ? 'rgba(255,255,255,0.05)' : 'transparent') +
      '" onclick="selectTrain(\'' + t.id + '\')">';
    html += '<div style="font-family:\'Press Start 2P\',monospace;font-size:.3rem;color:' + t.color + '">' + t.name + '</div>';
    html += '<div style="font-family:VT323,monospace;font-size:.9rem;color:rgba(0,255,65,0.6)">' + t.desc + ' \u00B7 ' + t.kmh + '</div>';
    html += '</div>';
  });
  document.getElementById('MB').innerHTML = html;
  document.getElementById('MO').classList.add('open');
}

function selectTrain(id) {
  curTrain = TRAIN_VARIANTS.find(t => t.id === id) || TRAIN_VARIANTS[0];
  closeModal();
  document.getElementById('SPD').innerHTML = '\u{1F682}<br>' + curTrain.kmh;
  showToast('\u{1F682} ' + curTrain.name + ' \u2014 ' + curTrain.desc, curTrain.color);
}

// ── FORWARD TRACK LOADING ──
// Loads tracks ahead of the train's current direction first
let trainForwardLoading = false;

async function trainLoadForward() {
  if (trainForwardLoading || trainLoading) return;
  trainForwardLoading = true;
  const dir = G.dir;
  const lookAhead = 0.15;
  let fLat = G.pos.lat, fLng = G.pos.lng;
  if (dir === 'up')    fLat += lookAhead;
  if (dir === 'down')  fLat -= lookAhead;
  if (dir === 'left')  fLng -= lookAhead * 1.6;
  if (dir === 'right') fLng += lookAhead * 1.6;
  const pad = 0.08;
  const bbox = (fLat - pad) + ',' + (fLng - pad * 1.6) + ',' + (fLat + pad) + ',' + (fLng + pad * 1.6);
  try {
    const q = '[out:json][timeout:10];(way["railway"="rail"](' + bbox + ');node["railway"="station"](' + bbox + '););out body;>;out skel qt;';
    const data = await overpassQuery(q);
    const nodes = {};
    data.elements.filter(e => e.type === 'node').forEach(n => { nodes[n.id] = [n.lat, n.lon]; });
    const newTracks = [];
    data.elements.filter(e => e.type === 'way' && e.tags?.railway === 'rail').forEach(w => {
      const coords = w.nodes.map(id => nodes[id]).filter(Boolean);
      if (coords.length >= 2) newTracks.push({ coords, type: 'rail' });
    });
    const newStations = data.elements.filter(e => e.type === 'node' && e.tags?.railway === 'station')
      .map(e => ({ lat: e.lat, lon: e.lon, name: e.tags.name || 'Station', isMain: true, type: 'rail' }));
    // Merge
    const etk = new Set(trainTracks.map(t => t.coords[0][0].toFixed(3) + ',' + t.coords[0][1].toFixed(3)));
    newTracks.forEach(t => { const k = t.coords[0][0].toFixed(3) + ',' + t.coords[0][1].toFixed(3); if (!etk.has(k)) { trainTracks.push(t); etk.add(k); } });
    const esk = new Set(trainStations.map(s => s.lat.toFixed(3) + ',' + s.lon.toFixed(3)));
    newStations.forEach(s => { const k = s.lat.toFixed(3) + ',' + s.lon.toFixed(3); if (!esk.has(k)) { trainStations.push(s); esk.add(k); } });
    if (newTracks.length > 0) showToast('\u{1F682} +' + newTracks.length + ' forward tracks', '#ff6600');
  } catch (e) { /* silent */ }
  trainForwardLoading = false;
}

// Snap distance threshold — wider = can jump bigger gaps between track segments
const SNAP_THRESHOLD = 0.0008; // ~90m at equator — allows jumping small gaps
const SNAP_LOOSE = 0.003;      // ~330m — "searching for track" mode, very slow

async function trainLoadAround() {
  if (trainLoading) return;
  trainLoading = true;
  trainLastCenter = { lat: G.pos.lat, lng: G.pos.lng };
  const z = getZoom().z;
  const pad = z <= 5 ? 2.0 : z <= 7 ? 0.8 : z <= 9 ? 0.3 : z <= 11 ? 0.12 : z <= 13 ? 0.06 : 0.025;
  const bbox = (G.pos.lat - pad) + ',' + (G.pos.lng - pad * 1.6) + ',' + (G.pos.lat + pad) + ',' + (G.pos.lng + pad * 1.6);
  showToast('\u{1F682} Loading tracks...', '#ff6600');
  try {
    // Zoom-aware: only load rail types appropriate for current zoom
    let railTypes = 'way["railway"="rail"](' + bbox + ');';
    if (z >= 9)  railTypes += 'way["railway"="subway"](' + bbox + ');' +
                              'way["railway"="light_rail"](' + bbox + ');';
    if (z >= 11) railTypes += 'way["railway"="tram"](' + bbox + ');' +
                              'way["railway"="narrow_gauge"](' + bbox + ');';
    let stationTypes = 'node["railway"="station"](' + bbox + ');';
    if (z >= 7) stationTypes += 'node["railway"="halt"](' + bbox + ');';
    if (z >= 9) stationTypes += 'node["station"="subway"](' + bbox + ');';
    if (z >= 11) stationTypes += 'node["railway"="tram_stop"](' + bbox + ');';
    const q = '[out:json][timeout:20];(' + railTypes + stationTypes + ');out body;>;out skel qt;';
    const data = await overpassQuery(q);
    const nodes = {};
    data.elements.filter(e => e.type === 'node').forEach(n => { nodes[n.id] = [n.lat, n.lon]; });

    const newTracks = [];
    data.elements.filter(e => e.type === 'way' && e.tags?.railway).forEach(w => {
      const rtype = w.tags.railway;
      if (!['rail', 'subway', 'light_rail', 'tram', 'narrow_gauge'].includes(rtype)) return;
      const coords = w.nodes.map(id => nodes[id]).filter(Boolean);
      if (coords.length >= 2) newTracks.push({ coords, type: rtype });
    });

    const newStations = data.elements
      .filter(e => e.type === 'node' && e.tags && (
        e.tags.railway === 'station' || e.tags.railway === 'halt' ||
        e.tags.station === 'subway' || e.tags.railway === 'tram_stop'
      ))
      .map(e => ({
        lat: e.lat, lon: e.lon,
        name: e.tags.name || 'Stop',
        isMain: e.tags.railway === 'station',
        type: e.tags.station === 'subway' ? 'subway' :
              e.tags.railway === 'tram_stop' ? 'tram' : 'rail'
      }));

    // Merge without duplicates
    const etk = new Set(trainTracks.map(t => t.coords[0][0].toFixed(3) + ',' + t.coords[0][1].toFixed(3)));
    newTracks.forEach(t => {
      const k = t.coords[0][0].toFixed(3) + ',' + t.coords[0][1].toFixed(3);
      if (!etk.has(k)) { trainTracks.push(t); etk.add(k); }
    });
    const esk = new Set(trainStations.map(s => s.lat.toFixed(3) + ',' + s.lon.toFixed(3)));
    newStations.forEach(s => {
      const k = s.lat.toFixed(3) + ',' + s.lon.toFixed(3);
      if (!esk.has(k)) { trainStations.push(s); esk.add(k); }
    });

    document.getElementById('transitInfo').style.display = 'block';
    document.getElementById('transitText').innerHTML = trainStations.length + ' stations \u00B7 ' + trainTracks.length + ' tracks';
    if (newTracks.length > 0) showToast('\u{1F682} +' + newTracks.length + ' tracks, ' + newStations.length + ' stations!', '#ff6600');
  } catch (e) { console.log('Train error:', e); showToast('Track data unavailable', '#ff4444'); }
  trainLoading = false;
}

function trainCheckProgressiveLoad() {
  if (G.veh !== 'train') return;
  if (!trainLastCenter) { trainLoadAround(); return; }
  if (haversine(G.pos.lat, G.pos.lng, trainLastCenter.lat, trainLastCenter.lng) > TRAIN_RELOAD_DIST) trainLoadAround();
}

// ── DRAW TRACKS ──
// Colors per track type
const TRACK_COLORS = {
  rail:         { main: '#ff6600', glow: 'rgba(255,102,0,0.12)' },
  subway:       { main: '#ff2266', glow: 'rgba(255,34,102,0.12)' },
  light_rail:   { main: '#44ccff', glow: 'rgba(68,204,255,0.12)' },
  tram:         { main: '#44ff88', glow: 'rgba(68,255,136,0.12)' },
  narrow_gauge: { main: '#cc8844', glow: 'rgba(204,136,68,0.12)' },
};

// Minimum zoom to show each rail type
const RAIL_MIN_ZOOM = {
  rail: 2, subway: 9, light_rail: 9, tram: 11, narrow_gauge: 11
};

function drawTrainTracks() {
  if (G.veh !== 'train' || !G.overlays.transit || trainTracks.length === 0) return;
  const z = getZoom().z;

  trainTracks.forEach(track => {
    // Only show mainline rail at zoomed out, others at closer zoom
    const minZ = RAIL_MIN_ZOOM[track.type] || 9;
    if (z < minZ) return;

    const tk = track.coords;
    if (tk.length < 2) return;

    let onScreen = false;
    for (let i = 0; i < tk.length; i += Math.max(1, Math.floor(tk.length / 5))) {
      const s = worldToScreen(tk[i][0], tk[i][1]);
      if (s.x > -200 && s.x < cv.width + 200 && s.y > -200 && s.y < cv.height + 200) { onScreen = true; break; }
    }
    if (!onScreen) return;

    const col = TRACK_COLORS[track.type] || TRACK_COLORS.rail;

    // Glow
    ctx.strokeStyle = col.glow; ctx.lineWidth = 8; ctx.setLineDash([]);
    ctx.beginPath(); tk.forEach((p, i) => { const s = worldToScreen(p[0], p[1]); i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y); }); ctx.stroke();

    // Main line — subway uses solid, rail uses dashed
    ctx.strokeStyle = col.main;
    ctx.lineWidth = track.type === 'subway' ? 3.5 : 3;
    ctx.setLineDash(track.type === 'subway' ? [] : [10, 5]);
    ctx.beginPath(); tk.forEach((p, i) => { const s = worldToScreen(p[0], p[1]); i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y); }); ctx.stroke();
    ctx.setLineDash([]);

    // Sleepers (not for subway — underground)
    if (track.type !== 'subway') {
      ctx.strokeStyle = col.main.replace(')', ',0.2)').replace('rgb', 'rgba');
      ctx.lineWidth = 1;
      for (let i = 0; i < tk.length - 1; i++) {
        const a = worldToScreen(tk[i][0], tk[i][1]), b = worldToScreen(tk[i + 1][0], tk[i + 1][1]);
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy);
        if (len < 5) continue;
        const nx = -dy / len * 5, ny = dx / len * 5;
        for (let t = 0; t < 1; t += 14 / len) {
          const mx = a.x + dx * t, my = a.y + dy * t;
          ctx.beginPath(); ctx.moveTo(mx + nx, my + ny); ctx.lineTo(mx - nx, my - ny); ctx.stroke();
        }
      }
    }
  });
}

// ── DRAW STATIONS ──
function drawTrainStations() {
  if (G.veh !== 'train' || !G.overlays.transit) return;
  const z = getZoom().z;
  trainStations.forEach(st => {
    if (z <= 7 && !st.isMain) return;
    const s = worldToScreen(st.lat, st.lon);
    if (s.x < -100 || s.x > cv.width + 100 || s.y < -40 || s.y > cv.height + 40) return;

    const r = z >= 13 ? 5 : z >= 9 ? 4 : 3;
    const stCol = st.type === 'subway' ? '#ff2266' : st.type === 'tram' ? '#44ff88' : '#ffe600';
    const icon = st.type === 'subway' ? '\u{1F687}' : st.type === 'tram' ? '\u{1F68A}' : '\u{1F689}';

    ctx.fillStyle = stCol; ctx.shadowColor = stCol; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ff6600'; ctx.lineWidth = st.isMain ? 2.5 : 1.5;
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.stroke();

    if (z >= 9 || (z >= 5 && st.isMain)) {
      ctx.fillStyle = stCol;
      ctx.font = (st.isMain ? 'bold ' : '') + (z >= 13 ? '11' : z >= 9 ? '9' : '8') + "px 'VT323',monospace";
      ctx.textAlign = 'left'; ctx.fillText(icon + ' ' + st.name, s.x + r + 4, s.y + 3);
    }
  });
}

// ── SNAP TO TRACK ──
// Returns closest point on any track segment within threshold
// Two tiers: tight snap (on track) and loose snap (searching, very slow)
function snapToTrack(lat, lng) {
  let minD = Infinity, bL = lat, bG = lng;
  trainTracks.forEach(track => {
    const tk = track.coords;
    for (let i = 0; i < tk.length - 1; i++) {
      const [ax, ay] = tk[i], [bx, by] = tk[i + 1];
      const dx = bx - ax, dy = by - ay, ls = dx * dx + dy * dy;
      if (!ls) continue;
      let t = ((lat - ax) * dx + (lng - ay) * dy) / ls;
      t = Math.max(0, Math.min(1, t));
      const cx = ax + t * dx, cy = ay + t * dy, d = (cx - lat) ** 2 + (cy - lng) ** 2;
      if (d < minD) { minD = d; bL = cx; bG = cy; }
    }
  });

  if (minD < SNAP_THRESHOLD * SNAP_THRESHOLD) {
    return { lat: bL, lng: bG, snapped: true, tight: true };
  }
  if (minD < SNAP_LOOSE * SNAP_LOOSE) {
    // Loose snap — pull toward track but move slowly (gap jumping)
    const mix = 0.3; // blend 30% toward track, 70% toward intended position
    return {
      lat: lat + (bL - lat) * mix,
      lng: lng + (bG - lng) * mix,
      snapped: true, tight: false
    };
  }
  return { lat, lng, snapped: false, tight: false };
}

function trainClear() {
  trainStations = []; trainTracks = []; trainLastCenter = null;
  document.getElementById('transitInfo').style.display = 'none';
}

function trainOnCountrySelect() {
  trainClear();
  if (G.veh === 'train') trainLoadAround();
}
