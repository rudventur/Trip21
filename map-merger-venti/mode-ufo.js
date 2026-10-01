// ═══════════════════════════════════════════════════════════════
//  mode-ufo.js — UFO CONSPIRACY MAP + ART NETWORK HUB
//  Atmosphere visuals · User-drawn strings · Auto-connections ·
//  Connections panel · Art swap offers · Colour/thickness picker
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  SECTION 1: ATMOSPHERE STATE
// ═══════════════════════════════════════════════════════════════

let ufoLightningTimer = 0;
let ufoAuroraWaves = [];
let ufoStaticParticles = [];
let ufoAnomaly = 0;

// ═══════════════════════════════════════════════════════════════
//  SECTION 2: CONNECTIONS (strings) SYSTEM
//  Two types:
//   - auto: generated from matching offers/seeks
//   - user: drawn by clicking two points on the map
// ═══════════════════════════════════════════════════════════════

// User-drawn connections
let ufoConnections = [
  // Demo connections
  { id: 'c1', from: { lat: 51.529, lng: -0.078 }, to: { lat: 52.520, lng: 13.405 },
    label: 'Print exchange London→Berlin', color: '#ff2244', thickness: 2, type: 'user' },
  { id: 'c2', from: { lat: 51.883, lng: -3.436 }, to: { lat: 55.862, lng: -4.258 },
    label: 'Wood workshop collab', color: '#ff6600', thickness: 3, type: 'user' },
];

// String drawing state
let ufoDrawingString = false;
let ufoStringStart = null;   // {lat, lng} first click
let ufoStringColor = '#ff2244';
let ufoStringThickness = 2;
let ufoStringLabel = '';

// Connections panel state
let ufoShowPanel = false;

// Available string colours
const STRING_COLORS = [
  { id: 'red',    hex: '#ff2244', name: 'Red' },
  { id: 'orange', hex: '#ff6600', name: 'Orange' },
  { id: 'yellow', hex: '#ffe600', name: 'Yellow' },
  { id: 'green',  hex: '#44ff44', name: 'Green' },
  { id: 'cyan',   hex: '#00bfff', name: 'Cyan' },
  { id: 'purple', hex: '#cc44ff', name: 'Purple' },
  { id: 'pink',   hex: '#ff44aa', name: 'Pink' },
  { id: 'white',  hex: '#ffffff', name: 'White' },
];

// ═══════════════════════════════════════════════════════════════
//  SECTION 3: AUTO-CONNECTIONS (offer↔seek matching)
// ═══════════════════════════════════════════════════════════════

function getAutoConnections() {
  const connections = [];
  const offers = G.listings.filter(l => l.artSpace?.offer?.types?.length > 0);
  const seeks = G.listings.filter(l => l.artSpace?.seek?.types?.length > 0);

  seeks.forEach(sk => {
    const seekTypes = sk.artSpace.seek.types;
    offers.forEach(of => {
      if (of.id === sk.id) return;
      const ofTypes = of.artSpace.offer.types;
      const matches = seekTypes.filter(st => ofTypes.some(ot => ot === st));
      if (matches.length === 0) return;

      connections.push({
        id: 'auto_' + of.id + '_' + sk.id,
        from: { lat: of.lat, lng: of.lng },
        to: { lat: sk.lat, lng: sk.lng },
        label: (of.username || 'Anon') + ' → ' + (sk.username || 'Anon') + ' [' + matches.join(', ') + ']',
        color: '#ff2244',
        thickness: 1.5,
        type: 'auto',
        fromUser: of.username,
        toUser: sk.username,
        matchTypes: matches,
      });
    });
  });
  return connections;
}

// Get ALL connections (user + auto)
function getAllConnections() {
  return [...ufoConnections, ...getAutoConnections()];
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 4: DRAW STRINGS ON MAP
// ═══════════════════════════════════════════════════════════════

function drawUfoStrings() {
  if (G.veh !== 'ufo') return;

  const all = getAllConnections();

  all.forEach(conn => {
    const a = worldToScreen(conn.from.lat, conn.from.lng);
    const b = worldToScreen(conn.to.lat, conn.to.lng);

    // Skip if both endpoints off screen
    if (a.x < -100 && b.x < -100) return;
    if (a.x > cv.width + 100 && b.x > cv.width + 100) return;
    if (a.y < -100 && b.y < -100) return;
    if (a.y > cv.height + 100 && b.y > cv.height + 100) return;

    const isAuto = conn.type === 'auto';

    // Glow layer
    ctx.strokeStyle = conn.color + '22';
    ctx.lineWidth = conn.thickness + 4;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();

    // Main string
    ctx.strokeStyle = conn.color + (isAuto ? '88' : 'cc');
    ctx.lineWidth = conn.thickness;
    ctx.setLineDash(isAuto ? [6, 4] : []);
    ctx.lineDashOffset = isAuto ? -G.frameN * 0.5 : 0;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.setLineDash([]);

    // Endpoints — pins
    [a, b].forEach(p => {
      ctx.fillStyle = conn.color;
      ctx.shadowColor = conn.color; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Label at midpoint
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const z = getZoom().z;
    if (z >= 5 && conn.label) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      const tw = Math.min(conn.label.length * 5 + 10, 200);
      ctx.fillRect(mx - tw / 2, my - 8, tw, 14);
      ctx.fillStyle = conn.color;
      ctx.font = "8px 'VT323',monospace"; ctx.textAlign = 'center';
      ctx.fillText(conn.label.substring(0, 40), mx, my + 3);
    }

    // Distance
    if (z >= 7) {
      const dist = haversine(conn.from.lat, conn.from.lng, conn.to.lat, conn.to.lng);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = "7px 'VT323',monospace"; ctx.textAlign = 'center';
      ctx.fillText(dist.toFixed(0) + 'km', mx, my + 14);
    }
  });

  // ── Drawing preview (when user is placing second point) ──
  if (ufoDrawingString && ufoStringStart) {
    const a = worldToScreen(ufoStringStart.lat, ufoStringStart.lng);
    const mouse = { x: cv.width / 2, y: cv.height / 2 }; // follows player
    ctx.strokeStyle = ufoStringColor + '66';
    ctx.lineWidth = ufoStringThickness;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
    ctx.setLineDash([]);

    // Start pin
    ctx.fillStyle = ufoStringColor;
    ctx.shadowColor = ufoStringColor; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(a.x, a.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Instructions
    ctx.fillStyle = ufoStringColor; ctx.font = "7px 'Press Start 2P'"; ctx.textAlign = 'center';
    ctx.fillText('CLICK TO SET END POINT', cv.width / 2, 80);
  }
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 5: STRING DRAWING (user interaction)
// ═══════════════════════════════════════════════════════════════

function ufoStartDrawString() {
  if (G.veh !== 'ufo') { showToast('Switch to UFO mode first!', '#cc44ff'); return; }
  // Open string config modal
  openStringConfig();
}

function openStringConfig() {
  let html = '<button class="mcl" onclick="closeModal()">\u2715</button>';
  html += '<div class="mh">\u{1F9F5} NEW STRING</div>';

  // Label
  html += '<div class="mf"><label>LABEL</label><input type="text" id="strLabel" placeholder="What connects these places?" maxlength="50"></div>';

  // Colour picker
  html += '<div class="mf"><label>COLOUR</label><div style="display:flex;gap:4px;flex-wrap:wrap">';
  STRING_COLORS.forEach(c => {
    const sel = c.hex === ufoStringColor;
    html += '<div onclick="ufoStringColor=\'' + c.hex + '\';document.querySelectorAll(\'.str-col\').forEach(e=>e.style.outline=\'\');this.style.outline=\'2px solid #fff\'" ' +
      'class="str-col" style="width:24px;height:24px;background:' + c.hex + ';border-radius:3px;cursor:pointer;' +
      (sel ? 'outline:2px solid #fff' : '') + '"></div>';
  });
  html += '</div></div>';

  // Thickness
  html += '<div class="mf"><label>THICKNESS</label><div style="display:flex;gap:6px;align-items:center">';
  [1, 2, 3, 4, 5].forEach(t => {
    const sel = t === ufoStringThickness;
    html += '<div onclick="ufoStringThickness=' + t + ';document.querySelectorAll(\'.str-th\').forEach(e=>e.style.borderColor=\'rgba(0,255,65,0.25)\');this.style.borderColor=\'#ffe600\'" ' +
      'class="str-th" style="width:30px;height:' + (t * 4 + 8) + 'px;background:' + ufoStringColor + ';border:2px solid ' +
      (sel ? '#ffe600' : 'rgba(0,255,65,0.25)') + ';border-radius:2px;cursor:pointer"></div>';
  });
  html += '</div></div>';

  html += '<button class="msave" onclick="ufoConfirmDrawString()">\u{1F4CC} PLACE FIRST PIN</button>';

  document.getElementById('MB').innerHTML = html;
  document.getElementById('MO').classList.add('open');
}

function ufoConfirmDrawString() {
  ufoStringLabel = document.getElementById('strLabel')?.value || '';
  closeModal();
  ufoDrawingString = true;
  ufoStringStart = null;
  cv.style.cursor = 'crosshair';
  showToast('\u{1F4CC} Click map to place first pin!', ufoStringColor);
}

// Called from canvas click handler in game.js
function ufoHandleMapClick(lat, lng) {
  if (!ufoDrawingString) return false;

  if (!ufoStringStart) {
    // First click — set start
    ufoStringStart = { lat, lng };
    showToast('\u{1F4CC} First pin placed! Click for end point.', ufoStringColor);
    return true;
  } else {
    // Second click — complete string
    const conn = {
      id: 'u' + Date.now(),
      from: { lat: ufoStringStart.lat, lng: ufoStringStart.lng },
      to: { lat, lng },
      label: ufoStringLabel || 'Connection',
      color: ufoStringColor,
      thickness: ufoStringThickness,
      type: 'user',
    };
    ufoConnections.push(conn);
    ufoDrawingString = false;
    ufoStringStart = null;
    cv.style.cursor = '';
    showToast('\u{1F9F5} String connected!', ufoStringColor);
    return true;
  }
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 6: CONNECTIONS PANEL
// ═══════════════════════════════════════════════════════════════

function toggleUfoPanel() {
  ufoShowPanel = !ufoShowPanel;
  const panel = document.getElementById('ufoPanel');
  if (!panel) return;
  if (ufoShowPanel) {
    panel.classList.add('show');
    updateUfoPanel();
  } else {
    panel.classList.remove('show');
  }
}

function updateUfoPanel() {
  const panel = document.getElementById('ufoPanelContent');
  if (!panel) return;

  const all = getAllConnections();
  if (all.length === 0) {
    panel.innerHTML = '<div style="color:rgba(200,100,255,0.4);padding:8px;font-size:.8rem">No connections yet. Draw some strings!</div>';
    return;
  }

  let html = '';

  // User connections
  const userConns = all.filter(c => c.type === 'user');
  if (userConns.length > 0) {
    html += '<div style="font-family:\'Press Start 2P\',monospace;font-size:.18rem;color:#ff2244;margin:6px 0 4px">\u{1F9F5} YOUR STRINGS (' + userConns.length + ')</div>';
    userConns.forEach(c => {
      const dist = haversine(c.from.lat, c.from.lng, c.to.lat, c.to.lng).toFixed(0);
      html += '<div style="padding:4px 6px;margin:2px 0;border-left:3px solid ' + c.color + ';background:rgba(255,255,255,0.03);display:flex;justify-content:space-between;align-items:center">';
      html += '<div>';
      html += '<div style="font-family:VT323,monospace;font-size:.85rem;color:' + c.color + '">' + (c.label || 'Untitled') + '</div>';
      html += '<div style="font-family:VT323,monospace;font-size:.7rem;color:rgba(200,100,255,0.4)">' + dist + 'km</div>';
      html += '</div>';
      html += '<button onclick="ufoDeleteConnection(\'' + c.id + '\')" style="background:none;border:1px solid #ff2244;color:#ff2244;padding:2px 5px;cursor:pointer;font-size:.7rem;border-radius:2px">\u2715</button>';
      html += '</div>';
    });
  }

  // Auto connections
  const autoConns = all.filter(c => c.type === 'auto');
  if (autoConns.length > 0) {
    html += '<div style="font-family:\'Press Start 2P\',monospace;font-size:.18rem;color:#cc44ff;margin:8px 0 4px">\u{1F504} ART MATCHES (' + autoConns.length + ')</div>';
    autoConns.forEach(c => {
      const dist = haversine(c.from.lat, c.from.lng, c.to.lat, c.to.lng).toFixed(0);
      html += '<div style="padding:4px 6px;margin:2px 0;border-left:3px solid #cc44ff;background:rgba(200,100,255,0.03)">';
      html += '<div style="font-family:VT323,monospace;font-size:.85rem;color:#cc44ff">' + (c.fromUser || '?') + ' \u2194 ' + (c.toUser || '?') + '</div>';
      html += '<div style="font-family:VT323,monospace;font-size:.7rem;color:rgba(200,100,255,0.4)">' + (c.matchTypes || []).join(', ') + ' \u00B7 ' + dist + 'km</div>';
      html += '</div>';
    });
  }

  panel.innerHTML = html;
}

function ufoDeleteConnection(id) {
  ufoConnections = ufoConnections.filter(c => c.id !== id);
  updateUfoPanel();
  showToast('\u{1F5D1} String removed', '#ff2244');
}

// ── FLY TO CONNECTION ──
function ufoFlyToConnection(lat, lng) {
  G.pos.lat = lat; G.pos.lng = lng;
  showToast('\u{1F6F8} Teleported!', '#cc44ff');
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 7: ART SWAP OFFERS DISPLAY (UFO mode overlay)
// ═══════════════════════════════════════════════════════════════

function drawUfoArtOffers() {
  if (G.veh !== 'ufo') return;
  const z = getZoom().z;

  G.listings.forEach(l => {
    if (!l.artSpace?.active) return;
    const hasOffer = l.artSpace.offer?.types?.length > 0;
    const hasSeek = l.artSpace.seek?.types?.length > 0;
    if (!hasOffer && !hasSeek) return;

    const s = worldToScreen(l.lat, l.lng);
    if (s.x < -40 || s.x > cv.width + 40 || s.y < -50 || s.y > cv.height + 30) return;

    // Pulsing aura
    const pulse = 0.5 + Math.sin(G.frameN * 0.03 + l.lat * 100) * 0.3;
    const auraColor = hasOffer && hasSeek ? 'rgba(255,230,0,' : hasOffer ? 'rgba(0,255,65,' : 'rgba(200,100,255,';
    ctx.fillStyle = auraColor + (pulse * 0.15) + ')';
    ctx.beginPath(); ctx.arc(s.x, s.y - 12, 18, 0, Math.PI * 2); ctx.fill();

    // Type icons below pin (at decent zoom)
    if (z >= 7) {
      const types = [...(l.artSpace.offer?.types || []), ...(l.artSpace.seek?.types || [])];
      ctx.font = "7px 'VT323',monospace"; ctx.textAlign = 'center';
      ctx.fillStyle = hasOffer ? 'rgba(0,255,65,0.6)' : 'rgba(200,100,255,0.6)';
      const typeStr = types.slice(0, 3).map(t => t.split(' ')[0]).join(' ');
      ctx.fillText(typeStr, s.x, s.y + 22);
    }

    // Exchange mode badge
    if (z >= 9) {
      const exchange = l.artSpace.offer?.exchange || l.artSpace.seek?.exchange || [];
      if (exchange.length > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(s.x - 20, s.y + 26, 40, 10);
        ctx.fillStyle = 'rgba(255,230,0,0.5)';
        ctx.font = "6px 'VT323',monospace";
        ctx.fillText(exchange[0], s.x, s.y + 34);
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 7b: UFO NOTEBOOK — collect findings while exploring
// ═══════════════════════════════════════════════════════════════

let ufoNotebookEntries = [
  // Demo entries
  { id: 'n1', text: 'Strange energy readings near Shoreditch', lat: 51.527, lng: -0.078, timestamp: '2026-03-14', tag: 'anomaly' },
  { id: 'n2', text: 'Art collective spotted — prints everywhere', lat: 52.520, lng: 13.405, timestamp: '2026-03-15', tag: 'art' },
];
let ufoNotebookOpen = false;

const NOTEBOOK_TAGS = [
  { id: 'anomaly', label: '\u{1F47E} Anomaly', color: '#cc44ff' },
  { id: 'art',     label: '\u{1F3A8} Art',     color: '#ffe600' },
  { id: 'signal',  label: '\u{1F4E1} Signal',  color: '#00bfff' },
  { id: 'contact', label: '\u{1F91D} Contact', color: '#44ff88' },
  { id: 'note',    label: '\u{1F4DD} Note',    color: '#ff6600' },
];

function toggleUfoNotebook() {
  ufoNotebookOpen = !ufoNotebookOpen;
  const panel = document.getElementById('ufoNotebook');
  if (!panel) return;
  if (ufoNotebookOpen) {
    panel.classList.add('show');
    updateNotebookPanel();
  } else {
    panel.classList.remove('show');
  }
}

function updateNotebookPanel() {
  const el = document.getElementById('notebookContent');
  if (!el) return;

  if (ufoNotebookEntries.length === 0) {
    el.innerHTML = '<div style="color:rgba(68,255,136,0.4);padding:8px;font-size:.8rem">No findings yet. Explore and log!</div>';
    return;
  }

  let html = '';
  ufoNotebookEntries.slice().reverse().forEach(entry => {
    const tag = NOTEBOOK_TAGS.find(t => t.id === entry.tag) || NOTEBOOK_TAGS[4];
    html += '<div style="padding:5px 6px;margin:3px 0;border-left:3px solid ' + tag.color + ';background:rgba(68,255,136,0.03);position:relative">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center">';
    html += '<span style="font-family:VT323,monospace;font-size:.75rem;color:' + tag.color + '">' + tag.label + '</span>';
    html += '<button onclick="deleteNotebookEntry(\'' + entry.id + '\')" style="background:none;border:1px solid #ff2244;color:#ff2244;padding:1px 4px;cursor:pointer;font-size:.6rem;border-radius:2px">\u2715</button>';
    html += '</div>';
    html += '<div style="font-family:VT323,monospace;font-size:.85rem;color:#44ff88;margin:2px 0">' + esc(entry.text) + '</div>';
    html += '<div style="font-family:VT323,monospace;font-size:.65rem;color:rgba(68,255,136,0.35)">' + entry.lat.toFixed(4) + '\u00B0, ' + entry.lng.toFixed(4) + '\u00B0 \u00B7 ' + entry.timestamp + '</div>';
    html += '<div style="cursor:pointer;font-family:VT323,monospace;font-size:.7rem;color:rgba(200,100,255,0.5);margin-top:1px" onclick="ufoFlyToConnection(' + entry.lat + ',' + entry.lng + ')">\u{1F6F8} Go here</div>';
    html += '</div>';
  });
  el.innerHTML = html;
}

function addNotebookEntry() {
  if (G.veh !== 'ufo') { showToast('Switch to UFO mode first!', '#cc44ff'); return; }

  let html = '<button class="mcl" onclick="closeModal()">\u2715</button>';
  html += '<div class="mh" style="color:#44ff88">\u{1F4D3} LOG FINDING</div>';
  html += '<div class="mf"><label>WHAT DID YOU FIND?</label><textarea id="nbText" placeholder="Describe your discovery..." style="border-color:#44ff88;color:#44ff88"></textarea></div>';
  html += '<div class="mf"><label>TAG</label><div style="display:flex;gap:4px;flex-wrap:wrap">';
  NOTEBOOK_TAGS.forEach((t, i) => {
    html += '<span class="chip' + (i === 0 ? ' on' : '') + '" style="border-color:' + t.color + ';color:' + t.color + '" data-tag="' + t.id + '" onclick="document.querySelectorAll(\'#MB .chip\').forEach(c=>c.classList.remove(\'on\'));this.classList.add(\'on\')">' + t.label + '</span>';
  });
  html += '</div></div>';
  html += '<div style="font-family:VT323,monospace;font-size:.8rem;color:rgba(68,255,136,0.4);margin:4px 0">\u{1F4CD} Location: ' + G.pos.lat.toFixed(4) + '\u00B0, ' + G.pos.lng.toFixed(4) + '\u00B0</div>';
  html += '<button class="msave" style="background:#44ff88" onclick="saveNotebookEntry()">\u{1F4BE} SAVE FINDING</button>';

  document.getElementById('MB').innerHTML = html;
  document.getElementById('MO').classList.add('open');
}

function saveNotebookEntry() {
  const text = document.getElementById('nbText')?.value?.trim();
  if (!text) { showToast('Write something!', '#ff4444'); return; }
  const activeTag = document.querySelector('#MB .chip.on');
  const tag = activeTag ? activeTag.dataset.tag : 'note';

  ufoNotebookEntries.push({
    id: 'nb' + Date.now(),
    text: text,
    lat: G.pos.lat,
    lng: G.pos.lng,
    timestamp: new Date().toISOString().split('T')[0],
    tag: tag
  });

  closeModal();
  updateNotebookPanel();
  showToast('\u{1F4D3} Finding logged!', '#44ff88');
}

function deleteNotebookEntry(id) {
  ufoNotebookEntries = ufoNotebookEntries.filter(e => e.id !== id);
  updateNotebookPanel();
  showToast('\u{1F5D1} Entry removed', '#ff2244');
}

// Draw notebook markers on map (only in UFO mode)
function drawNotebookMarkers() {
  if (G.veh !== 'ufo') return;
  const z = getZoom().z;

  ufoNotebookEntries.forEach(entry => {
    const s = worldToScreen(entry.lat, entry.lng);
    if (s.x < -30 || s.x > cv.width + 30 || s.y < -30 || s.y > cv.height + 30) return;

    const tag = NOTEBOOK_TAGS.find(t => t.id === entry.tag) || NOTEBOOK_TAGS[4];
    const pulse = 0.5 + Math.sin(G.frameN * 0.05 + entry.lat * 100) * 0.3;

    // Marker
    ctx.fillStyle = tag.color + '44';
    ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = tag.color + (pulse > 0.6 ? 'aa' : '55');
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, Math.PI * 2); ctx.stroke();

    // Icon
    ctx.fillStyle = tag.color;
    ctx.font = '8px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('\u{1F4D3}', s.x, s.y);

    // Label at closer zoom
    if (z >= 10) {
      ctx.fillStyle = tag.color + '88';
      ctx.font = "8px 'VT323',monospace"; ctx.textAlign = 'left';
      ctx.fillText(entry.text.substring(0, 25), s.x + 10, s.y + 3);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 8: ATMOSPHERE (kept from original, enhanced)
// ═══════════════════════════════════════════════════════════════

function drawUfoAtmosphere() {
  if (G.veh !== 'ufo') return;

  // ── Dark space tint ──
  ctx.fillStyle = 'rgba(5,0,20,0.12)';
  ctx.fillRect(0, 0, cv.width, cv.height);

  // ── Aurora Borealis ──
  if (ufoAuroraWaves.length === 0) {
    for (let i = 0; i < 5; i++) {
      ufoAuroraWaves.push({
        y: 20 + i * 25,
        amp: 15 + Math.random() * 20,
        freq: 0.003 + Math.random() * 0.004,
        phase: Math.random() * Math.PI * 2,
        color: i % 2 === 0 ? [0, 255, 100] : [100, 0, 255],
        width: 30 + Math.random() * 20
      });
    }
  }

  ufoAuroraWaves.forEach(w => {
    w.phase += 0.008;
    const [r, g, b] = w.color;
    ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.06)';
    ctx.lineWidth = w.width;
    ctx.beginPath();
    for (let x = 0; x < cv.width; x += 4) {
      const y = w.y + Math.sin(x * w.freq + w.phase) * w.amp + Math.sin(x * w.freq * 2.3 + w.phase * 1.5) * w.amp * 0.4;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  });

  // ── Electromagnetic grid (pulsing) ──
  const gridPulse = 0.015 + Math.sin(G.frameN * 0.015) * 0.01;
  ctx.strokeStyle = 'rgba(180,0,255,' + gridPulse + ')';
  ctx.lineWidth = 1;
  const gridSpacing = 80;
  for (let x = (G.frameN * 0.5) % gridSpacing; x < cv.width; x += gridSpacing) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cv.height); ctx.stroke();
  }
  for (let y = (G.frameN * 0.3) % gridSpacing; y < cv.height; y += gridSpacing) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cv.width, y); ctx.stroke();
  }

  // ── Electric static particles (reduced for performance) ──
  while (ufoStaticParticles.length < 25) {
    ufoStaticParticles.push({
      x: Math.random() * cv.width,
      y: Math.random() * cv.height,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      life: 30 + Math.random() * 60,
      maxLife: 60
    });
  }

  ufoStaticParticles.forEach((p, idx) => {
    p.x += p.vx; p.y += p.vy;
    p.life--;
    if (p.life <= 0 || p.x < 0 || p.x > cv.width || p.y < 0 || p.y > cv.height) {
      ufoStaticParticles[idx] = {
        x: cv.width / 2 + (Math.random() - 0.5) * 200,
        y: cv.height / 2 + (Math.random() - 0.5) * 200,
        vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
        life: 30 + Math.random() * 60, maxLife: 60
      };
      return;
    }
    const alpha = (p.life / p.maxLife) * 0.5;
    ctx.fillStyle = 'rgba(180,100,255,' + alpha + ')';
    ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2); ctx.fill();
  });

  // ── Lightning storm ──
  if (G.frameN % 240 < 2 && Math.random() < 0.25) ufoLightningTimer = 10;
  if (ufoLightningTimer > 0) {
    ufoLightningTimer--;
    ctx.globalAlpha = ufoLightningTimer / 10 * 0.12;
    ctx.fillStyle = ufoLightningTimer > 5 ? '#cc66ff' : '#fff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.globalAlpha = 1;

    if (ufoLightningTimer > 5) {
      const lx = cv.width * 0.15 + Math.random() * cv.width * 0.7;
      ctx.strokeStyle = 'rgba(200,150,255,0.6)';
      ctx.lineWidth = 1.5; ctx.shadowColor = '#cc66ff'; ctx.shadowBlur = 8;
      ctx.beginPath();
      let ly = 0; ctx.moveTo(lx, ly);
      for (let seg = 0; seg < 8; seg++) {
        ly += 25 + Math.random() * 35;
        ctx.lineTo(lx + (Math.random() - 0.5) * 40, ly);
      }
      ctx.stroke(); ctx.shadowBlur = 0;
    }
  }

  // ── Anomaly pulse ──
  if (G.frameN % 1200 < 2 && Math.random() < 0.3) {
    ufoAnomaly = 40;
    showToast('\u{1F47E} Anomaly detected...', '#cc44ff');
  }
  if (ufoAnomaly > 0) {
    ufoAnomaly--;
    const pulse = ufoAnomaly / 40;
    const cx = cv.width / 2, cy = cv.height / 2;
    const r = (1 - pulse) * 200;
    ctx.strokeStyle = 'rgba(200,100,255,' + (pulse * 0.25) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2); ctx.stroke();
  }

  // ── Scanline effect ──
  ctx.fillStyle = 'rgba(0,0,0,0.015)';
  for (let y = 0; y < cv.height; y += 3) {
    ctx.fillRect(0, y, cv.width, 1);
  }

  // ── Draw connections, art offers, and notebook markers AFTER atmosphere ──
  drawUfoStrings();
  drawUfoArtOffers();
  drawNotebookMarkers();
}
