// ═══════════════════════════════════════════════════════════════
//  map-spots.js — Map Spots system
//  Any user can drop a GPS marker: memorial, feeding station,
//  danger zone, event, found-pet sighting, vet/shelter, dog park,
//  water source, free item, community notice, wildlife sighting,
//  hazard, or custom. Each spot has a timer mode, reactions, and
//  comments.
//
//  ADDITIVE ONLY — never modifies snout-first.html's core engine.
//  Reads/writes only through the global S object. Hooks the render
//  loop the same way lost-zone.js does: wrap drawPets(), call our
//  own draw after it.
// ═══════════════════════════════════════════════════════════════

// ── SECTION 1: SPOT TYPE CONFIG ──
const SPOT_TYPES = {
  memorial:    { id: 'memorial',    label: 'Memorial',           emoji: '\u{1F56F}\uFE0F', color: '#a89bb5', defaultTimer: 'timestamp' },
  feeding:     { id: 'feeding',     label: 'Feeding Station',    emoji: '\u{1F356}',       color: '#ff9944', defaultTimer: 'time_since' },
  danger:      { id: 'danger',      label: 'Danger Zone',        emoji: '\u26A0\uFE0F',    color: '#ff3344', defaultTimer: 'countdown' },
  event:       { id: 'event',       label: 'Event',              emoji: '\u{1F389}',       color: '#cc66ff', defaultTimer: 'expires_at' },
  found_pet:   { id: 'found_pet',   label: 'Pet Sighting',       emoji: '\u{1F43E}',       color: '#66cc44', defaultTimer: 'time_since' },
  vet_shelter: { id: 'vet_shelter', label: 'Vet / Shelter',      emoji: '\u2695\uFE0F',    color: '#44aaff', defaultTimer: 'timestamp' },
  dog_park:    { id: 'dog_park',    label: 'Dog Park',           emoji: '\u{1F333}',       color: '#55bb55', defaultTimer: 'timestamp' },
  water:       { id: 'water',       label: 'Water Source',       emoji: '\u{1F4A7}',       color: '#33bbdd', defaultTimer: 'timestamp' },
  free_item:   { id: 'free_item',   label: 'Free Item',          emoji: '\u{1F381}',       color: '#ffcc33', defaultTimer: 'countdown' },
  notice:      { id: 'notice',      label: 'Community Notice',   emoji: '\u{1F4E2}',       color: '#ffaa55', defaultTimer: 'expires_at' },
  wildlife:    { id: 'wildlife',    label: 'Wildlife Sighting',  emoji: '\u{1F98A}',       color: '#bb7733', defaultTimer: 'time_since' },
  hazard:      { id: 'hazard',      label: 'Hazard',             emoji: '\u{1F6A7}',       color: '#ff6622', defaultTimer: 'countdown' },
  custom:      { id: 'custom',      label: 'Custom',             emoji: '\u{1F4CD}',       color: '#cccccc', defaultTimer: 'time_since' },
};
const SPOT_TYPE_LIST = Object.values(SPOT_TYPES);

// ── SECTION 2: TIMER MODES ──
// time_since   — "posted 3h ago", never expires, purely informational
// countdown    — user sets a duration from creation; shows "expires in Xh", auto-expires
// expires_at   — user sets a fixed date/time; shows "expires <date>", auto-expires
// timestamp    — exact fixed date/time always shown, permanent, never expires
const TIMER_MODES = {
  time_since: { id: 'time_since', label: 'Time since posted' },
  countdown:  { id: 'countdown',  label: 'Countdown duration' },
  expires_at: { id: 'expires_at', label: 'Expires at date/time' },
  timestamp:  { id: 'timestamp',  label: 'Fixed timestamp (permanent)' },
};

function spotTimeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}

function spotTimeUntil(ts) {
  const diff = ts - Date.now();
  if (diff <= 0) return 'expired';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + 'm left';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h left';
  return Math.floor(hrs / 24) + 'd left';
}

function spotFullTimestamp(ts) {
  return new Date(ts).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

// Returns the label to show under a spot based on its timer mode
function spotTimerDisplay(spot) {
  switch (spot.timerMode) {
    case 'time_since': return spotTimeAgo(spot.createdAt);
    case 'countdown':  return spot.expiresAt ? spotTimeUntil(spot.expiresAt) : spotTimeAgo(spot.createdAt);
    case 'expires_at': return spot.expiresAt ? spotTimeUntil(spot.expiresAt) : spotTimeAgo(spot.createdAt);
    case 'timestamp':  return spotFullTimestamp(spot.createdAt);
    default: return spotTimeAgo(spot.createdAt);
  }
}

function spotIsExpired(spot) {
  if (spot.timerMode !== 'countdown' && spot.timerMode !== 'expires_at') return false;
  if (!spot.expiresAt) return false;
  return Date.now() > spot.expiresAt;
}

// ── SECTION 3: STATE (lives on global S, additive) ──
S.spots = S.spots || [];
S._spotsMode = false;        // "drop a spot" mode toggle
S._pendingSpotLatLon = null;
S._activeSpotDetail = null;  // spot object currently shown in detail panel

function saveSpots() {
  try { localStorage.setItem('snoutfirst_spots', JSON.stringify(S.spots)); } catch (e) {}
}
function loadSpots() {
  try {
    const raw = localStorage.getItem('snoutfirst_spots');
    if (raw) S.spots = JSON.parse(raw);
  } catch (e) {}
}
loadSpots();

// Periodic cleanup of expired countdown/expires_at spots (keep them 1hr after expiry, greyed, then drop)
function spotsCleanupExpired() {
  const now = Date.now();
  const before = S.spots.length;
  S.spots = S.spots.filter(s => {
    if (!spotIsExpired(s)) return true;
    return (now - s.expiresAt) < 3600000; // keep 1hr past expiry, greyed out
  });
  if (S.spots.length !== before) saveSpots();
}
setInterval(spotsCleanupExpired, 60000);

// ── SECTION 4: INJECT DOM (button, modal, detail panel) ──
(function injectSpotsDOM() {
  const style = document.createElement('style');
  style.textContent = `
    .spot-fab{position:fixed;bottom:70px;left:230px;z-index:1400;width:44px;height:44px;
      background:rgba(26,18,10,0.95);border:2px solid #ffaa55;border-radius:50%;
      display:flex;align-items:center;justify-content:center;cursor:pointer;
      font-size:1.3rem;transition:all .15s;box-shadow:0 0 12px rgba(255,170,85,0.25)}
    .spot-fab:hover{background:#ffaa55;box-shadow:0 0 18px rgba(255,170,85,0.5)}
    .spot-fab.active{background:#ffaa55;box-shadow:0 0 20px rgba(255,170,85,0.6);animation:spotPulse 1s infinite}
    @keyframes spotPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}

    .spot-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:2100;
      display:none;align-items:center;justify-content:center}
    .spot-modal-overlay.show{display:flex}
    .spot-modal{background:rgba(26,18,10,0.98);border:3px solid #ffaa55;border-radius:16px;
      padding:16px;width:92%;max-width:360px;max-height:82vh;overflow-y:auto;
      box-shadow:0 0 30px rgba(255,170,85,0.25);font-family:'VT323',monospace;color:#ffcc99}
    .spot-modal h2{font-family:'Bubblegum Sans',cursive,sans-serif;color:#ffaa55;
      font-size:1.25rem;margin-bottom:10px;text-align:center}
    .spot-modal label{display:block;color:rgba(255,204,153,0.7);font-size:.85rem;margin:8px 0 3px}
    .spot-modal input,.spot-modal textarea,.spot-modal select{width:100%;
      background:rgba(0,0,0,0.4);color:#ffcc99;border:2px solid rgba(255,170,85,0.4);
      padding:6px 8px;border-radius:8px;font-family:'VT323',monospace;font-size:.95rem;
      outline:none;resize:vertical}
    .spot-modal input:focus,.spot-modal textarea:focus,.spot-modal select:focus{border-color:#ffaa55}
    .spot-type-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:4px}
    .spot-type-opt{border:2px solid rgba(255,170,85,0.25);border-radius:10px;padding:6px 4px;
      text-align:center;cursor:pointer;transition:all .12s;background:rgba(0,0,0,0.2)}
    .spot-type-opt:hover{border-color:#ffaa55}
    .spot-type-opt.sel{border-color:#ffaa55;background:rgba(255,170,85,0.15)}
    .spot-type-opt .em{font-size:1.3rem;display:block}
    .spot-type-opt .lb{font-size:.65rem;color:rgba(255,204,153,0.7);display:block;margin-top:2px;line-height:1.1}
    .spot-timer-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
    .spot-timer-opt{border:2px solid rgba(255,170,85,0.25);border-radius:8px;padding:4px 8px;
      cursor:pointer;font-size:.78rem;color:rgba(255,204,153,0.65);transition:all .12s}
    .spot-timer-opt.sel{border-color:#ffaa55;background:rgba(255,170,85,0.15);color:#ffaa55}
    .spot-btn-row{display:flex;gap:8px;margin-top:14px}
    .spot-btn-row button{flex:1;padding:8px;border-radius:8px;font-family:'VT323',monospace;
      font-size:1rem;cursor:pointer;border:2px solid #ffaa55;background:transparent;color:#ffaa55;
      transition:all .15s}
    .spot-btn-row button:hover{background:rgba(255,170,85,0.15)}
    .spot-btn-row button.primary{background:#ffaa55;color:#1a120a}
    .spot-btn-row button.primary:hover{background:#ffbb77}

    .spot-detail{position:fixed;z-index:1600;background:rgba(26,18,10,0.98);
      border:3px solid;border-radius:16px;padding:14px;width:270px;max-height:70vh;
      overflow-y:auto;box-shadow:0 0 30px rgba(0,0,0,0.4);display:none;
      font-family:'VT323',monospace;color:#ffcc99}
    .spot-detail.show{display:block}
    .spot-detail .sd-close{position:absolute;top:6px;right:8px;background:none;
      border:1px solid rgba(255,255,255,0.3);color:#ccc;padding:1px 6px;border-radius:8px;
      cursor:pointer;font-size:.8rem}
    .spot-detail .sd-emoji{font-size:2rem;text-align:center;margin-bottom:4px}
    .spot-detail .sd-title{font-family:'Bubblegum Sans',cursive,sans-serif;font-size:1.15rem;
      text-align:center;margin-bottom:2px}
    .spot-detail .sd-timer{text-align:center;font-size:.8rem;color:rgba(255,255,255,0.45);margin-bottom:8px}
    .spot-detail .sd-desc{font-size:.9rem;color:rgba(255,204,153,0.8);font-style:italic;
      border-left:3px solid rgba(255,170,85,0.3);padding-left:8px;margin-bottom:8px}
    .spot-detail .sd-reactions{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}
    .spot-detail .sd-react-btn{background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);
      border-radius:10px;padding:3px 8px;cursor:pointer;font-size:.85rem;color:#ffcc99;
      transition:all .12s}
    .spot-detail .sd-react-btn:hover{border-color:#ffaa55}
    .spot-detail .sd-comments{border-top:1px solid rgba(255,255,255,0.1);margin-top:6px;padding-top:6px}
    .spot-detail .sd-comment{font-size:.82rem;color:rgba(255,204,153,0.7);margin:4px 0;
      padding-left:6px;border-left:2px solid rgba(255,170,85,0.2)}
    .spot-detail .sd-comment b{color:#ffaa55}
    .spot-detail .sd-comment-input{display:flex;gap:4px;margin-top:6px}
    .spot-detail .sd-comment-input input{flex:1;background:rgba(0,0,0,0.4);color:#ffcc99;
      border:1.5px solid rgba(255,170,85,0.35);padding:4px 6px;border-radius:6px;
      font-family:'VT323',monospace;font-size:.85rem;outline:none}
    .spot-detail .sd-comment-input button{background:#ffaa55;color:#1a120a;border:none;
      border-radius:6px;padding:4px 10px;cursor:pointer;font-family:'VT323',monospace}
    .spot-detail .sd-actions{display:flex;justify-content:flex-end;margin-top:8px}
    .spot-detail .sd-remove{background:none;border:1px solid #ff4444;color:#ff4444;
      padding:3px 8px;border-radius:6px;cursor:pointer;font-size:.78rem}
  `;
  document.head.appendChild(style);

  const fab = document.createElement('div');
  fab.className = 'spot-fab';
  fab.id = 'spotFab';
  fab.title = 'Drop a map spot';
  fab.innerHTML = '\u{1F4CD}';
  fab.onclick = toggleSpotDropMode;
  document.body.appendChild(fab);

  // Anchor to the left panel's outer edge instead of a fixed viewport spot, so it
  // moves with the panel (collapsed vs expanded) instead of sitting on top of it.
  function positionSpotFab() {
    const lp = document.getElementById('lpRoot');
    fab.style.left = lp ? (lp.getBoundingClientRect().right + 8) + 'px' : '10px';
  }
  positionSpotFab();
  // panel-left.js's own init() is itself deferred to DOMContentLoaded (its script
  // isn't the last thing in the document either), so #lpRoot may not exist yet even
  // here. Re-run one macrotask after DOMContentLoaded — by then every synchronous
  // DOMContentLoaded listener, including panel-left's, has already finished, so this
  // isn't a timing guess the way a fixed setTimeout delay would be.
  document.addEventListener('DOMContentLoaded', () => setTimeout(positionSpotFab, 0));
  window.addEventListener('resize', positionSpotFab);
  document.addEventListener('transitionend', e => {
    if (e.target && e.target.id === 'lpRoot') positionSpotFab();
  });

  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'spot-modal-overlay';
  modalOverlay.id = 'spotModalOverlay';
  modalOverlay.innerHTML = '<div class="spot-modal" id="spotModalBody"></div>';
  document.body.appendChild(modalOverlay);

  const detail = document.createElement('div');
  detail.className = 'spot-detail';
  detail.id = 'spotDetail';
  document.body.appendChild(detail);
})();

// ── SECTION 5: DROP MODE + CREATION FORM ──
function toggleSpotDropMode() {
  S._spotsMode = !S._spotsMode;
  document.getElementById('spotFab').classList.toggle('active', S._spotsMode);
  if (S._spotsMode) {
    toast('\u{1F4CD} Tap the map to drop a spot');
  }
}

// Called from our own canvas click listener below
function handleSpotMapClick(lat, lon) {
  S._pendingSpotLatLon = { lat, lon };
  S._spotsMode = false;
  document.getElementById('spotFab').classList.remove('active');
  openSpotCreateForm();
}

let _spotFormType = 'custom';
let _spotFormTimer = SPOT_TYPES.custom.defaultTimer;

function openSpotCreateForm() {
  _spotFormType = 'custom';
  _spotFormTimer = SPOT_TYPES.custom.defaultTimer;
  renderSpotCreateForm();
  document.getElementById('spotModalOverlay').classList.add('show');
}

function renderSpotCreateForm() {
  const typeGrid = SPOT_TYPE_LIST.map(t => `
    <div class="spot-type-opt ${t.id === _spotFormType ? 'sel' : ''}" onclick="selectSpotType('${t.id}')">
      <span class="em">${t.emoji}</span><span class="lb">${t.label}</span>
    </div>`).join('');

  const timerRow = Object.values(TIMER_MODES).map(tm => `
    <div class="spot-timer-opt ${tm.id === _spotFormTimer ? 'sel' : ''}" onclick="selectSpotTimer('${tm.id}')">${tm.label}</div>
  `).join('');

  const needsDuration = _spotFormTimer === 'countdown';
  const needsDate = _spotFormTimer === 'expires_at';

  document.getElementById('spotModalBody').innerHTML = `
    <h2>\u{1F4CD} Drop a Spot</h2>
    <label>What is this?</label>
    <div class="spot-type-grid">${typeGrid}</div>
    <label>Title</label>
    <input id="spotTitle" placeholder="Short title" maxlength="40">
    <label>Description</label>
    <textarea id="spotDesc" rows="2" placeholder="Details..." maxlength="200"></textarea>
    <label>Timer mode</label>
    <div class="spot-timer-row">${timerRow}</div>
    ${needsDuration ? `
      <label>Expires in (hours)</label>
      <input id="spotDurationHrs" type="number" min="1" max="720" value="4">
    ` : ''}
    ${needsDate ? `
      <label>Expires at</label>
      <input id="spotExpiryDate" type="datetime-local">
    ` : ''}
    <div class="spot-btn-row">
      <button onclick="closeSpotCreateForm()">Cancel</button>
      <button class="primary" onclick="saveNewSpot()">Drop Pin</button>
    </div>
  `;
}

function selectSpotType(id) {
  _spotFormType = id;
  _spotFormTimer = SPOT_TYPES[id].defaultTimer;
  renderSpotCreateForm();
}
function selectSpotTimer(id) {
  _spotFormTimer = id;
  renderSpotCreateForm();
}
function closeSpotCreateForm() {
  document.getElementById('spotModalOverlay').classList.remove('show');
  S._pendingSpotLatLon = null;
}

function saveNewSpot() {
  const title = (document.getElementById('spotTitle')?.value || '').trim();
  if (!title) { toast('\u26A0\uFE0F Give it a title'); return; }
  const desc = (document.getElementById('spotDesc')?.value || '').trim();
  const pos = S._pendingSpotLatLon;
  if (!pos) { closeSpotCreateForm(); return; }

  const now = Date.now();
  let expiresAt = null;
  if (_spotFormTimer === 'countdown') {
    const hrs = parseFloat(document.getElementById('spotDurationHrs')?.value || '4');
    expiresAt = now + Math.max(1, hrs) * 3600000;
  } else if (_spotFormTimer === 'expires_at') {
    const val = document.getElementById('spotExpiryDate')?.value;
    if (val) expiresAt = new Date(val).getTime();
  }

  const spot = {
    id: 'spot_' + now + '_' + Math.floor(Math.random() * 1000),
    type: _spotFormType,
    title,
    desc,
    lat: pos.lat,
    lon: pos.lon,
    timerMode: _spotFormTimer,
    createdAt: now,
    expiresAt,
    reactions: {},   // { emoji: count }
    comments: [],     // [{text, timestamp}]
    linkedPetIndex: null, // future: pet linking
  };
  S.spots.push(spot);
  saveSpots();
  closeSpotCreateForm();
  toast(SPOT_TYPES[spot.type].emoji + ' Spot dropped!');
}

// ── SECTION 6: DETAIL PANEL ──
function openSpotDetail(spot, screenX, screenY) {
  S._activeSpotDetail = spot;
  const cfg = SPOT_TYPES[spot.type] || SPOT_TYPES.custom;
  const el = document.getElementById('spotDetail');
  el.style.borderColor = cfg.color;

  const reactionEmojis = ['\u2764\uFE0F', '\u{1F440}', '\u26A0\uFE0F', '\u{1F44D}'];
  const reactionsHtml = reactionEmojis.map(em => {
    const count = spot.reactions[em] || 0;
    return `<div class="sd-react-btn" onclick="reactToSpot('${spot.id}','${em}')">${em} ${count > 0 ? count : ''}</div>`;
  }).join('');

  const commentsHtml = spot.comments.length
    ? spot.comments.map(c => `<div class="sd-comment"><b>\u2022</b> ${escSpot(c.text)} <span style="opacity:.5;font-size:.7rem">(${spotTimeAgo(c.timestamp)})</span></div>`).join('')
    : '<div style="opacity:.4;font-size:.8rem">No comments yet.</div>';

  const expiredTag = spotIsExpired(spot) ? ' <span style="color:#ff5555">(expired)</span>' : '';

  el.innerHTML = `
    <button class="sd-close" onclick="closeSpotDetail()">&times;</button>
    <div class="sd-emoji">${cfg.emoji}</div>
    <div class="sd-title" style="color:${cfg.color}">${escSpot(spot.title)}</div>
    <div class="sd-timer">${cfg.label} \u00B7 ${spotTimerDisplay(spot)}${expiredTag}</div>
    ${spot.desc ? `<div class="sd-desc">${escSpot(spot.desc)}</div>` : ''}
    <div class="sd-reactions">${reactionsHtml}</div>
    <div class="sd-comments" id="spotCommentsList">${commentsHtml}</div>
    <div class="sd-comment-input">
      <input id="spotCommentInput" placeholder="Add a comment..." maxlength="120">
      <button onclick="addSpotComment('${spot.id}')">Post</button>
    </div>
    <div class="sd-actions">
      <button class="sd-remove" onclick="removeSpot('${spot.id}')">Remove</button>
    </div>
  `;

  let left = screenX + 16, top = screenY - 40;
  if (left + 280 > window.innerWidth) left = screenX - 286;
  if (top < 50) top = 50;
  if (top + 400 > window.innerHeight) top = window.innerHeight - 410;
  if (left < 0) left = 8;
  el.style.left = left + 'px';
  el.style.top = top + 'px';
  el.classList.add('show');
}

function closeSpotDetail() {
  S._activeSpotDetail = null;
  document.getElementById('spotDetail').classList.remove('show');
}

function reactToSpot(id, emoji) {
  const spot = S.spots.find(s => s.id === id);
  if (!spot) return;
  spot.reactions[emoji] = (spot.reactions[emoji] || 0) + 1;
  saveSpots();
  openSpotDetail(spot, parseInt(document.getElementById('spotDetail').style.left), parseInt(document.getElementById('spotDetail').style.top));
}

function addSpotComment(id) {
  const spot = S.spots.find(s => s.id === id);
  if (!spot) return;
  const input = document.getElementById('spotCommentInput');
  const text = (input.value || '').trim();
  if (!text) return;
  spot.comments.push({ text, timestamp: Date.now() });
  saveSpots();
  input.value = '';
  openSpotDetail(spot, parseInt(document.getElementById('spotDetail').style.left), parseInt(document.getElementById('spotDetail').style.top));
}

function removeSpot(id) {
  S.spots = S.spots.filter(s => s.id !== id);
  saveSpots();
  closeSpotDetail();
  toast('\u{1F5D1}\uFE0F Spot removed');
}

function escSpot(s) {
  const d = document.createElement('div');
  d.textContent = String(s || '');
  return d.innerHTML;
}

// ── SECTION 7: MAP RENDERING (hook into existing render loop) ──
// Same pattern as lost-zone.js — wrap drawPets() so our spots draw
// every frame without touching the core engine's render() function.
const _spotsOriginalDrawPets = drawPets;
drawPets = function() {
  _spotsOriginalDrawPets();
  drawMapSpots();
};

function drawMapSpots() {
  const cv = document.getElementById('snoutMap');
  const cx = cv.getContext('2d');

  S.spots.forEach(spot => {
    const p = worldToScreen(spot.lat, spot.lon);
    if (p.x < -30 || p.x > cv.width + 30 || p.y < -30 || p.y > cv.height + 30) return;

    const cfg = SPOT_TYPES[spot.type] || SPOT_TYPES.custom;
    const expired = spotIsExpired(spot);
    const alpha = expired ? 0.35 : 1;

    cx.save();
    cx.globalAlpha = alpha;

    // Shadow
    cx.beginPath();
    cx.arc(p.x, p.y + 2, 13, 0, Math.PI * 2);
    cx.fillStyle = 'rgba(0,0,0,0.3)';
    cx.fill();

    // Pin
    cx.beginPath();
    cx.arc(p.x, p.y, 13, 0, Math.PI * 2);
    cx.fillStyle = 'rgba(20,20,20,0.88)';
    cx.fill();
    cx.strokeStyle = cfg.color;
    cx.lineWidth = 2;
    cx.stroke();

    // Emoji icon
    cx.font = '14px sans-serif';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(cfg.emoji, p.x, p.y);

    cx.restore();

    // Title label at closer zoom
    if (S.zoom >= 14) {
      cx.font = '11px "Bubblegum Sans", cursive, sans-serif';
      cx.fillStyle = cfg.color;
      cx.textAlign = 'center';
      const label = spot.title.length > 18 ? spot.title.slice(0, 16) + '..' : spot.title;
      const w = cx.measureText(label).width + 8;
      cx.fillStyle = 'rgba(20,20,20,0.75)';
      cx.fillRect(p.x - w / 2, p.y + 16, w, 14);
      cx.fillStyle = cfg.color;
      cx.fillText(label, p.x, p.y + 26);
    }
  });
}

// ── SECTION 8: CLICK HANDLING ──
// Own listener, doesn't touch the core engine's pointerup handler.
// Runs alongside it; core engine ignores clicks we've already used.
(function bindSpotClicks() {
  const cv = document.getElementById('snoutMap');
  let downPos = null;

  cv.addEventListener('pointerdown', e => { downPos = { x: e.clientX, y: e.clientY }; }, { capture: true });

  cv.addEventListener('pointerup', e => {
    if (!downPos) return;
    const dx = Math.abs(e.clientX - downPos.x), dy = Math.abs(e.clientY - downPos.y);
    downPos = null;
    if (dx > 5 || dy > 5) return; // was a drag, not a tap

    // Spot-drop mode takes priority
    if (S._spotsMode) {
      const w = screenToWorld(e.clientX, e.clientY);
      handleSpotMapClick(w.lat, w.lon);
      return;
    }

    // Otherwise check if a spot pin was tapped
    for (let i = S.spots.length - 1; i >= 0; i--) {
      const spot = S.spots[i];
      const p = worldToScreen(spot.lat, spot.lon);
      const ddx = e.clientX - p.x, ddy = e.clientY - p.y;
      if (ddx * ddx + ddy * ddy < 16 * 16) {
        openSpotDetail(spot, e.clientX, e.clientY);
        return;
      }
    }
  }, { capture: true });
})();
