// ═══════════════════════════════════════════════════════════════
//  vets.js — real vets near the map, from OpenStreetMap (through Overpass)
//
//  Fills the Vets tab ("Places and help" in the right panel) and draws a
//  🏥 marker on the map for each vet. Nothing here is made up: every name,
//  address, opening time, phone number and website comes from the
//  OpenStreetMap tags, and a missing tag is shown as "not listed".
//
//  Being gentle with the free Overpass service:
//    · one request per user action, or per map view change after the map has
//      been still for a few seconds (only while the Vets tab is open)
//    · a search circle of at most 5 kilometres, a server timeout and a
//      result limit in the query
//    · answers kept per area in memory and in sessionStorage
//    · one main server and one fallback, tried one after the other, never
//      both at once; no automatic retries; a growing wait after errors and
//      a longer one after "too many requests" (429)
//
//  Hooks: window.sfVets (used by js/panel-right.js and js/foodbanks.js).
//  Draws by wrapping drawPets(), the same way js/map-spots.js and
//  js/clown-markers.js do.
//
//  Top search box: while the Vets tab is open the "sniff sniff" box searches
//  vets (registered with sfDash.registerSearchMode). Typing filters the vets
//  already found; Enter looks the text up as a place or postcode with
//  Nominatim (geocodePlace in snout-first.html) and searches vets there.
// ═══════════════════════════════════════════════════════════════

(function () {

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',              // main
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter' // single fallback
];
const MAX_RADIUS_M = 5000;      // never search further than 5 kilometres
const MIN_RADIUS_M = 1500;
const RESULT_LIMIT = 50;        // "out center 50" in the query
const QUERY_TIMEOUT_S = 20;     // [timeout:20] in the query
const CLIENT_TIMEOUT_MS = 25000;
const DEBOUNCE_MS = 3000;       // map must be still this long before a search
const WATCH_MS = 500;
const CACHE_KEY = 'sf_vets_cache_v1';
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX_AREAS = 20;
const FIRST_WAIT_S = 5, MAX_WAIT_S = 300, BUSY_WAIT_S = 60;

const DAY_CODES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ── State ──
const st = {
  status: 'idle',        // idle | loading | ready | error
  vets: [],              // parsed vets for the current area
  areaKey: '',           // area the vets belong to
  origin: null,          // { lat, lon, label } distances are measured from here
  error: '',
  waitUntil: 0,          // no requests before this time (after errors)
  failures: 0,
  inFlight: false,
  note: '',              // e.g. location permission problems
  selected: '',          // vet id last chosen with Go (bigger marker)
  goHold: null,          // map centred on a vet by Go: don't search again for that
  userLoc: null,
  requests: 0,           // how many requests this page has sent (for the tests)
  filter: '',            // text typed in the top search box (Vets mode)
};
let active = false;
let mountEl = null;
const memCache = new Map();

// ── Small helpers ──
function clean(v, max) {
  if (v == null) return '';
  return String(v).replace(/\s+/g, ' ').trim().slice(0, max || 300);
}
function distKm(a, b) {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function fmtDist(km) {
  if (km == null || !isFinite(km)) return '';
  if (km < 1) return Math.round(km * 1000 / 10) * 10 + ' metres away';
  return km.toFixed(1) + ' kilometres away';
}
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// ── Safe links ──
// Phone links keep only digits, "+", spaces and dashes.
function telHref(phone) {
  const s = String(phone == null ? '' : phone).replace(/[^0-9+\- ]/g, '').trim();
  return /[0-9]/.test(s) ? 'tel:' + s : '';
}
// Only http and https web links are ever made clickable.
function webHref(url) {
  const s = String(url == null ? '' : url).trim();
  if (!/^https?:\/\//i.test(s)) return '';
  try {
    const u = new URL(s);
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : '';
  } catch (e) { return ''; }
}

// ── OpenStreetMap tags → a vet ──
function formatAddress(t) {
  if (t['addr:full']) return clean(t['addr:full']);
  const street = clean(t['addr:street'] || t['addr:place']);
  const num = clean(t['addr:housenumber']);
  const line1 = street ? [num, street].filter(Boolean).join(' ') : '';
  const parts = [clean(t['addr:unit']) ? 'Unit ' + clean(t['addr:unit']) : '', clean(t['addr:housename']), line1,
    clean(t['addr:suburb']), clean(t['addr:city'] || t['addr:town'] || t['addr:village']), clean(t['addr:postcode'])];
  const seen = new Set();
  return parts.filter(p => p && !seen.has(p.toLowerCase()) && seen.add(p.toLowerCase())).join(', ');
}
function parsePhones(t) {
  const out = [], seen = new Set();
  ['phone', 'contact:phone', 'contact:mobile'].forEach(k => {
    String(t[k] || '').split(';').forEach(p => {
      const text = clean(p, 40);
      const key = text.replace(/[^0-9+]/g, '');
      if (text && !seen.has(key)) { seen.add(key); out.push(text); }
    });
  });
  return out.slice(0, 3);
}
function parseElement(e) {
  if (!e || typeof e !== 'object') return null;
  const lat = typeof e.lat === 'number' ? e.lat : (e.center && e.center.lat);
  const lon = typeof e.lon === 'number' ? e.lon : (e.center && e.center.lon);
  if (typeof lat !== 'number' || typeof lon !== 'number' || !isFinite(lat) || !isFinite(lon)) return null;
  const t = (e.tags && typeof e.tags === 'object') ? e.tags : {};
  const site = clean(String(t.website || t['contact:website'] || '').split(';')[0], 500);
  return {
    id: clean(e.type, 10) + '/' + clean(e.id, 20),
    lat, lon,
    name: clean(t.name, 120),
    address: formatAddress(t),
    hours: clean(t.opening_hours, 300),
    phones: parsePhones(t),
    website: site,
    emergency: String(t.emergency || '').trim().toLowerCase() === 'yes',
  };
}

// ── Opening hours: a tiny reader for the common simple forms ──
// Handles "24/7", and rules like "Mo-Fr 08:00-18:00; Sa 09:00-13:00; Su off",
// several times per day ("08:00-12:00,14:00-18:00"), public holidays ("PH off",
// shown but not used for "Open now") and times past midnight. Anything else
// returns null and the raw text is shown instead.
function parseHours(raw) {
  const s = clean(raw);
  if (!s) return null;
  if (s === '24/7') return { always: true, lines: ['Open 24 hours, every day'], rules: [] };
  const rules = [], lines = [];
  const parts = s.split(';').map(p => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  for (let part of parts) {
    part = part.replace(/\s*,\s*/g, ',').replace(/\s*-\s*/g, '-');
    const m = part.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su|PH)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*):?(?:\s+(.+))?$/);
    let dayPart = null, timePart = part;
    if (m) { dayPart = m[1]; timePart = (m[2] || '').trim(); }
    if (!timePart) return null;            // "Mo-Fr" alone: too unusual, show as written
    // Days
    let days = [0, 1, 2, 3, 4, 5, 6], ph = false, dayWords = 'Every day';
    if (dayPart) {
      days = []; const words = [];
      for (const item of dayPart.split(',')) {
        if (item === 'PH') { ph = true; words.push('public holidays'); continue; }
        const [a, b] = item.split('-');
        const ia = DAY_CODES.indexOf(a), ib = b ? DAY_CODES.indexOf(b) : ia;
        if (ia < 0 || ib < 0) return null;
        for (let d = ia; ; d = (d + 1) % 7) { if (!days.includes(d)) days.push(d); if (d === ib) break; }
        words.push(b ? DAY_NAMES[ia] + ' to ' + DAY_NAMES[ib] : DAY_NAMES[ia]);
      }
      dayWords = words.join(', ');
      dayWords = dayWords.charAt(0).toUpperCase() + dayWords.slice(1);
    }
    // Times
    let spans = [];
    if (/^(off|closed)$/i.test(timePart)) {
      spans = [];
      lines.push(dayWords + ': closed');
    } else {
      const words = [];
      for (const r of timePart.split(',')) {
        const t = r.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
        if (!t) return null;
        const start = +t[1] * 60 + +t[2]; let end = +t[3] * 60 + +t[4];
        if (+t[1] > 24 || +t[2] > 59 || +t[3] > 48 || +t[4] > 59) return null;
        if (end <= start) end += 24 * 60;     // runs past midnight
        spans.push([start, end]);
        words.push(t[1].padStart(2, '0') + ':' + t[2] + ' to ' + t[3].padStart(2, '0') + ':' + t[4]);
      }
      lines.push(dayWords + ': ' + words.join(', '));
    }
    rules.push({ days, spans });
  }
  return { always: false, lines, rules };
}
// true / false, or null when it can't tell. Uses this device's clock.
function isOpenAt(parsed, date) {
  if (!parsed) return null;
  if (parsed.always) return true;
  const perDay = {};                     // later rules replace earlier ones
  parsed.rules.forEach(r => r.days.forEach(d => { perDay[d] = r.spans; }));
  if (!Object.keys(perDay).length) return null;
  const today = (date.getDay() + 6) % 7, yesterday = (today + 6) % 7;
  const mins = date.getHours() * 60 + date.getMinutes();
  if ((perDay[today] || []).some(([a, b]) => mins >= a && mins < b)) return true;
  if ((perDay[yesterday] || []).some(([a, b]) => b > 1440 && mins + 1440 < b)) return true;
  return false;
}

// ── Which area to search: the map view, at most 5 kilometres ──
function viewArea() {
  if (typeof S === 'undefined') return null;
  const lat = S.lat, lon = S.lon;
  const z = (typeof zoomTarget === 'number') ? zoomTarget : S.zoom;
  const canvas = document.getElementById('snoutMap');
  const w = canvas ? canvas.width : window.innerWidth, h = canvas ? canvas.height : window.innerHeight;
  const metresPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, z);
  let r = Math.hypot(w, h) / 2 * metresPerPixel;
  r = Math.max(MIN_RADIUS_M, Math.min(MAX_RADIUS_M, Math.round(r / 500) * 500));
  // Snap the centre to a grid of about 1 kilometre so small nudges reuse the cache.
  const cLat = Math.round(lat * 100) / 100, cLon = Math.round(lon * 100) / 100;
  return { lat: cLat, lon: cLon, radius: r, key: cLat.toFixed(2) + ',' + cLon.toFixed(2) + ',' + r, at: { lat, lon } };
}
function buildQuery(a) {
  const around = `(around:${a.radius},${a.lat},${a.lon})`;
  return `[out:json][timeout:${QUERY_TIMEOUT_S}];(` +
    `node["amenity"="veterinary"]${around};way["amenity"="veterinary"]${around};relation["amenity"="veterinary"]${around};` +
    `);out center ${RESULT_LIMIT};`;
}

// ── Cache (memory + sessionStorage) ──
function readStore() {
  try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}') || {}; } catch (e) { return {}; }
}
function cacheGet(key) {
  let hit = memCache.get(key);
  if (!hit) { const s = readStore()[key]; if (s && Array.isArray(s.vets)) { hit = s; memCache.set(key, s); } }
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.vets;
  return null;
}
function cachePut(key, vets) {
  const entry = { ts: Date.now(), vets };
  memCache.set(key, entry);
  try {
    const all = readStore(); all[key] = entry;
    const keys = Object.keys(all).sort((a, b) => all[b].ts - all[a].ts);
    keys.slice(CACHE_MAX_AREAS).forEach(k => delete all[k]);
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch (e) { /* storage full or blocked: memory cache still works */ }
}

// ── Network: one server, then the fallback; never both at once ──
async function postOnce(url, query) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), CLIENT_TIMEOUT_MS) : null;
  st.requests++;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: 'data=' + encodeURIComponent(query),
      signal: ctl ? ctl.signal : undefined,
    });
    if (res.status === 429) {
      const e = new Error('busy'); e.kind = 'busy';
      const ra = parseInt(res.headers.get('Retry-After') || '', 10);
      e.wait = isFinite(ra) ? Math.min(MAX_WAIT_S, Math.max(BUSY_WAIT_S, ra)) : BUSY_WAIT_S;
      throw e;
    }
    if (res.status >= 500) { const e = new Error('server ' + res.status); e.kind = 'server'; throw e; }
    if (!res.ok) { const e = new Error('bad request ' + res.status); e.kind = 'bad'; throw e; }
    const data = await res.json();
    const elements = Array.isArray(data && data.elements) ? data.elements : null;
    if (!elements) { const e = new Error('no elements'); e.kind = 'server'; throw e; }
    // Overpass reports its own time-outs inside a normal answer.
    if (!elements.length && data.remark && /error|timed? ?out|timeout/i.test(String(data.remark))) {
      const e = new Error('remark'); e.kind = 'server'; throw e;
    }
    return elements;
  } catch (e) {
    if (!e.kind) e.kind = (e.name === 'AbortError') ? 'timeout' : 'network';
    throw e;
  } finally { if (timer) clearTimeout(timer); }
}
async function fetchArea(area) {
  const q = buildQuery(area);
  let lastErr = null;
  for (const url of ENDPOINTS) {
    try { return await postOnce(url, q); }
    catch (e) { lastErr = e; if (e.kind === 'bad') break; }
  }
  throw lastErr;
}

function errorText(e) {
  if (e && e.kind === 'busy') return 'The free OpenStreetMap vet search (Overpass) says it is too busy right now.';
  if (e && (e.kind === 'server' || e.kind === 'timeout')) return 'The free OpenStreetMap vet search (Overpass) did not answer in time.';
  if (e && e.kind === 'bad') return 'The OpenStreetMap vet search (Overpass) did not understand the request.';
  return 'Could not reach the OpenStreetMap vet search (Overpass). Check your connection.';
}

// ── Searching ──
// reason: 'open' | 'button' | 'retry' | 'me' | 'view'
async function search(reason, area, placeLabel) {
  area = area || viewArea();
  if (!area) return;
  const user = reason !== 'view';
  const originNear = st.userLoc && distKm(st.userLoc, area.at) < 0.2;
  const origin = { lat: area.at.lat, lon: area.at.lon, label: placeLabel || (originNear ? 'your location' : 'the map view') };
  const cached = cacheGet(area.key);
  if (cached) {
    Object.assign(st, { status: 'ready', vets: cached, areaKey: area.key, radius: area.radius, origin, error: '' });
    draw(); return;
  }
  if (st.inFlight) return;                         // one request at a time
  if (Date.now() < st.waitUntil) {                 // still waiting after an error
    if (user) draw();
    return;
  }
  st.inFlight = true;
  Object.assign(st, { status: 'loading', error: '', areaKey: area.key, radius: area.radius, origin });
  draw();
  try {
    const elements = await fetchArea(area);
    const seen = new Set();
    const vets = elements.map(parseElement).filter(v => v && !seen.has(v.id) && seen.add(v.id));
    cachePut(area.key, vets);
    st.failures = 0; st.waitUntil = 0;
    Object.assign(st, { status: 'ready', vets });
  } catch (e) {
    st.failures++;
    const wait = e && e.kind === 'busy' ? e.wait : Math.min(MAX_WAIT_S, FIRST_WAIT_S * Math.pow(2, st.failures - 1));
    st.waitUntil = Date.now() + wait * 1000;
    Object.assign(st, { status: 'error', error: errorText(e), vets: [], areaKey: '', lastFailedKey: area.key });
  } finally {
    st.inFlight = false;
    draw();
  }
}

function getPosition() {
  const ask = new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('no geolocation')); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }), reject, { timeout: 8000, maximumAge: 60000 });
  });
  // Some browsers never answer while a permission prompt sits unanswered.
  const ceiling = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000));
  return Promise.race([ask, ceiling]);
}
async function nearMe() {
  st.note = 'Asking for your location…'; draw();
  try {
    const pos = await getPosition();
    st.userLoc = pos; st.note = ''; st.goHold = null;
    if (typeof S !== 'undefined') { S.lat = pos.lat; S.lon = pos.lon; }
    if (typeof zoomTarget !== 'undefined' && zoomTarget < 14) zoomTarget = 14;
    lastView = viewSig(); stillSince = Date.now();
    await search('me');
  } catch (e) {
    st.note = 'Could not get your location (check the location permission). Showing vets around the map view instead.';
    draw();
  }
}
// Enter in the top search box (Vets mode): look the place or postcode up,
// move the map there and search for vets around it.
async function placeSearch(text) {
  const q = clean(text, 120);
  if (!q) { st.goHold = null; return search('button'); }
  if (typeof geocodePlace !== 'function') { st.note = 'The place search did not load. Reload the page to try again.'; draw(); return; }
  st.note = 'Looking up "' + q + '"…'; draw();
  let place = null;
  try { place = await geocodePlace(q); }
  catch (e) { st.note = 'Could not reach the place search (Nominatim). Check your connection and try again.'; draw(); return; }
  if (!place) { st.note = 'No place called "' + q + '" was found. Try a town, street or postcode.'; draw(); return; }
  st.note = ''; st.goHold = null; st.selected = '';
  if (typeof S !== 'undefined') { S.lat = place.lat; S.lon = place.lon; }
  if (typeof zoomTarget !== 'undefined') zoomTarget = 14;
  document.body.classList.remove('sf-vet-focus');
  // The text was a place, not a filter: empty the box so every vet shows.
  st.filter = '';
  if (window.sfDash && sfDash.setModeText) sfDash.setModeText('vets', '');
  const area = viewArea();
  lastView = area ? area.key : ''; stillSince = Date.now();
  await search('place', area, place.name);
}

// Typing in the top search box (Vets mode) filters the vets already found.
function filterTerms() { return st.filter.toLowerCase().split(/\s+/).filter(Boolean); }
function vetMatches(v) {
  const t = filterTerms();
  if (!t.length) return true;
  const hay = [v.name, v.address, v.hours, v.website].concat(v.phones || [], v.emergency ? ['emergency', '24 hour'] : [])
    .map(x => String(x == null ? '' : x).toLowerCase()).join('\n');
  return t.every(w => hay.includes(w));
}
function setFilter(text) {
  const t = clean(text, 80);
  if (t === st.filter) return;
  st.filter = t;
  draw();
}

function goTo(v) {
  if (typeof S === 'undefined' || !v) return;
  S.lat = v.lat; S.lon = v.lon;
  if (typeof zoomTarget !== 'undefined' && zoomTarget < 16) zoomTarget = 16;
  st.selected = v.id;
  st.goHold = { lat: v.lat, lon: v.lon };          // looking at this vet: no new search
  // The "No pets on the map yet" hint sits in the middle of the map, right on
  // top of the vet; hide it while the map stays on this vet.
  document.body.classList.add('sf-vet-focus');
  if (window.sfDash && sfDash.isPhone()) sfDash.setPanelOpen('right', false);
  draw();
}

// ── Watching the map view (only while the Vets tab is open) ──
let lastView = '', stillSince = 0;
function viewSig() {
  const a = viewArea();
  return a ? a.key : '';
}
setInterval(() => {
  if (!active || typeof S === 'undefined') return;
  const sig = viewSig();
  if (sig !== lastView) { lastView = sig; stillSince = Date.now(); return; }
  if (Date.now() - stillSince < DEBOUNCE_MS) return;
  if (!sig || sig === st.areaKey || st.inFlight || Date.now() < st.waitUntil) return;
  if (st.status === 'error' && st.lastFailedKey === sig) return;   // no automatic retries
  if (st.goHold && distKm(st.goHold, { lat: S.lat, lon: S.lon }) < 0.15) return;
  st.goHold = null;
  search('view');
}, WATCH_MS);
// Bring the map hint back once the map is moved away from the vet chosen with Go.
setInterval(() => {
  if (!document.body.classList.contains('sf-vet-focus') || typeof S === 'undefined') return;
  const hold = st.goHold;
  if (!hold || distKm(hold, { lat: S.lat, lon: S.lon }) >= 0.15) {
    document.body.classList.remove('sf-vet-focus');
    if (hold) { st.goHold = null; }
  }
}, WATCH_MS);
// Retry button countdown while waiting after an error
setInterval(() => {
  if (!active || st.status !== 'error' || !mountEl) return;
  const b = mountEl.querySelector('#sfVetRetry');
  if (b) updateRetry(b);
}, 1000);

// ── Drawing the list (DOM nodes and textContent only) ──
function updateRetry(b) {
  const left = Math.ceil((st.waitUntil - Date.now()) / 1000);
  b.disabled = left > 0;
  b.textContent = left > 0 ? `↻ Try again in ${left} second${left === 1 ? '' : 's'}` : '↻ Try again';
}
function card(v) {
  const c = el('div', 'rp-link sf-vet');
  c.dataset.vetId = v.id;
  if (v.id === st.selected) c.classList.add('sel');

  const head = el('div', 'sf-vet-head');
  head.appendChild(el('span', 'sf-vet-icon', '🏥'));
  const nm = el('span', 'sf-vet-name', v.name || 'Name not listed');
  if (!v.name) nm.classList.add('missing');
  head.appendChild(nm);
  c.appendChild(head);

  const badges = el('div', 'rp-ltags');
  if (v.emergency) badges.appendChild(el('span', 'rp-ltag em sf-vet-emergency', '🚨 24 hour emergency'));
  if (v.dist != null) badges.appendChild(el('span', 'rp-ltag pl sf-vet-dist', fmtDist(v.dist)));
  const parsed = parseHours(v.hours);
  const open = isOpenAt(parsed, new Date());
  if (open != null) badges.appendChild(el('span', 'rp-ltag sf-vet-open' + (open ? '' : ' em'), open ? 'Open now' : 'Closed now'));
  if (badges.childNodes.length) c.appendChild(badges);

  if (v.address) c.appendChild(el('div', 'rp-laddr sf-vet-addr', '📍 ' + v.address));

  const hrs = el('div', 'sf-vet-hours');
  if (!v.hours) { hrs.textContent = '🕒 Hours not listed'; hrs.classList.add('missing'); }
  else if (parsed) parsed.lines.forEach((l, i) => hrs.appendChild(el('div', null, (i ? '' : '🕒 ') + l)));
  else hrs.textContent = '🕒 ' + v.hours;
  c.appendChild(hrs);

  const ph = el('div', 'sf-vet-phone');
  if (!v.phones.length) { ph.textContent = '📞 Phone not listed'; ph.classList.add('missing'); }
  else {
    ph.appendChild(document.createTextNode('📞 '));
    v.phones.forEach((p, i) => {
      if (i) ph.appendChild(document.createTextNode(' · '));
      const href = telHref(p);
      if (href) { const a = el('a', 'sf-vet-tel', p); a.setAttribute('href', href); ph.appendChild(a); }
      else ph.appendChild(el('span', null, p));
    });
  }
  c.appendChild(ph);

  if (v.website) {
    const w = el('div', 'sf-vet-web');
    const href = webHref(v.website);
    w.appendChild(document.createTextNode('🌐 '));
    if (href) {
      const a = el('a', 'sf-vet-site', v.website.replace(/^https?:\/\//i, '').replace(/\/$/, ''));
      a.setAttribute('href', href); a.target = '_blank'; a.rel = 'noopener noreferrer nofollow';
      w.appendChild(a);
    } else {
      w.appendChild(el('span', 'sf-vet-site-text', v.website));   // shown, never clickable
    }
    c.appendChild(w);
  }

  const btns = el('div', 'rp-pet-btns');
  const go = el('button', 'rp-pin-btn sf-vet-go', '🎯 Go');
  go.type = 'button'; go.title = 'Centre the map on this vet';
  go.addEventListener('click', () => goTo(v));
  btns.appendChild(go);
  const osm = el('a', 'rp-pin-btn sf-vet-osm', 'on OpenStreetMap ↗');
  const [type, id] = v.id.split('/');
  if (/^(node|way|relation)$/.test(type) && /^\d+$/.test(id)) {
    osm.setAttribute('href', `https://www.openstreetmap.org/${type}/${id}`);
    osm.target = '_blank'; osm.rel = 'noopener';
    btns.appendChild(osm);
  }
  c.appendChild(btns);
  return c;
}

function sortedVets() {
  const o = st.origin;
  return st.vets.map(v => Object.assign({}, v, { dist: o ? distKm(o, v) : null }))
    .sort((a, b) => (a.dist ?? 1e9) - (b.dist ?? 1e9));
}

function draw() {
  if (!mountEl || !mountEl.isConnected) return;
  const root = el('div', 'sf-vets');
  root.id = 'sfVets';

  const bar = el('div', 'sf-vet-bar');
  const here = el('button', 'rp-add-btn sf-vet-here', '🗺️ Search this map view');
  here.type = 'button';
  here.addEventListener('click', () => { st.goHold = null; search('button'); });
  const me = el('button', 'rp-add-btn sf-vet-me', '📍 Near me');
  me.type = 'button';
  me.addEventListener('click', nearMe);
  bar.append(here, me);
  root.appendChild(bar);

  if (st.note) root.appendChild(el('div', 'rp-vet-status sf-vet-note', st.note));

  const status = el('div', 'rp-vet-status sf-vet-status');
  status.id = 'sfVetStatus';
  const km = st.radius ? Math.round(st.radius / 100) / 10 : 0;
  if (st.status === 'loading') {
    status.textContent = '🐾 Sniffing for vets…';
    status.classList.add('loading');
    root.appendChild(status);
  } else if (st.status === 'error') {
    status.textContent = '⚠️ ' + st.error;
    status.classList.add('err');
    root.appendChild(status);
    const retry = el('button', 'rp-add-btn sf-vet-retry');
    retry.id = 'sfVetRetry'; retry.type = 'button';
    updateRetry(retry);
    retry.addEventListener('click', () => { st.goHold = null; search('retry'); });
    root.appendChild(retry);
  } else if (st.status === 'ready' && !st.vets.length) {
    status.textContent = 'No vets found nearby on OpenStreetMap';
    status.classList.add('empty');
    root.appendChild(status);
    root.appendChild(el('div', 'rp-vet-status sf-vet-hint',
      `Searched ${km} kilometres around ${st.origin ? st.origin.label : 'the map view'}. Try moving the map somewhere else.`));
  } else if (st.status === 'ready') {
    status.textContent = `Found ${st.vets.length} vet${st.vets.length === 1 ? '' : 's'} within ${km} kilometres of ${st.origin ? st.origin.label : 'the map view'}, nearest first`;
    root.appendChild(status);
    const shown = sortedVets().filter(vetMatches);
    if (st.filter) {
      root.appendChild(el('div', 'rp-vet-status sf-vet-filter' + (shown.length ? '' : ' empty'),
        shown.length ? `Showing ${shown.length} of ${st.vets.length} matching "${st.filter}". Press Enter to look "${st.filter}" up as a place instead.`
          : `No vets here match "${st.filter}". Press Enter to look it up as a place or postcode.`));
    }
    const list = el('div', 'sf-vet-list');
    shown.forEach(v => list.appendChild(card(v)));
    root.appendChild(list);
  } else {
    status.textContent = 'Move the map to where you need a vet, then search this map view.';
    root.appendChild(status);
  }

  const credit = el('div', 'sf-vet-credit');
  credit.appendChild(document.createTextNode('Vet data © '));
  const a = el('a', null, 'OpenStreetMap contributors');
  a.setAttribute('href', 'https://www.openstreetmap.org/copyright'); a.target = '_blank'; a.rel = 'noopener';
  credit.appendChild(a);
  credit.appendChild(document.createTextNode(', found through Overpass. Missing details are not listed on OpenStreetMap yet. "Open now" uses this device\'s clock.'));
  root.appendChild(credit);

  mountEl.replaceChildren(root);
}

// ── Map markers: 🏥 for each vet found ──
function drawMarkers() {
  if (!st.vets.length || typeof worldToScreen !== 'function') return;
  const canvas = document.getElementById('snoutMap');
  const ctx = canvas && canvas.getContext('2d');
  if (!ctx) return;
  const z = (typeof S !== 'undefined') ? S.zoom : 13;
  st.vets.forEach(v => {
    const p = worldToScreen(v.lat, v.lon);
    if (p.x < -30 || p.x > canvas.width + 30 || p.y < -30 || p.y > canvas.height + 30) return;
    const sel = v.id === st.selected;
    const r = sel ? 15 : 11;
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(26,18,10,0.92)';
    ctx.fill();
    ctx.lineWidth = sel ? 3 : 2;
    ctx.strokeStyle = sel ? '#ffcc66' : '#4499ff';
    ctx.stroke();
    ctx.font = (sel ? 16 : 12) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🏥', p.x, p.y + 1);
    if ((sel || z >= 16) && v.name) {
      ctx.font = '12px "VT323", monospace';
      const w = ctx.measureText(v.name).width + 8;
      ctx.fillStyle = 'rgba(26,18,10,0.88)';
      ctx.fillRect(p.x - w / 2, p.y - r - 18, w, 15);
      ctx.fillStyle = '#88bbff';
      ctx.fillText(v.name, p.x, p.y - r - 10);
    }
    ctx.restore();
  });
}
if (typeof drawPets === 'function') {
  const _vetsOrigDrawPets = drawPets;
  // eslint-disable-next-line no-global-assign
  drawPets = function () { drawMarkers(); _vetsOrigDrawPets.apply(this, arguments); };
}

// ── The top search box in Vets mode ──
if (window.sfDash && sfDash.registerSearchMode) {
  sfDash.registerSearchMode('vets', {
    icon: '🏥', label: 'vets', placeholder: 'sniff sniff vets…',
    aria: 'Search vets. Typing filters the vets found; press Enter to look up vets near a place or postcode.',
    button: '🔎 vets', buttonTitle: 'Look up vets near this place or postcode',
    filter: setFilter,
    submit: placeSearch,
    count: () => ({ shown: st.vets.filter(vetMatches).length, total: st.vets.length, one: 'vet', many: 'vets' }),
  });
}

// ── Public ──
window.sfVets = {
  // panel-right gives us an empty element inside the Vets tab
  mount(elm) {
    mountEl = elm;
    if (!document.getElementById('sfVetsStyle')) {
      const css = el('style', null, 'body.sf-vet-focus #emptyHint { display: none !important; }');
      css.id = 'sfVetsStyle';
      document.head.appendChild(css);
    }
    draw();
  },
  setActive(on) {
    const was = active; active = !!on;
    if (active && !was) { lastView = viewSig(); stillSince = Date.now(); search('open'); }
  },
  state: st,
  setFilter, placeSearch,
  // shared with js/foodbanks.js (same gentle Overpass rules and tag readers)
  ENDPOINTS: ENDPOINTS.slice(), QUERY_TIMEOUT_S, CLIENT_TIMEOUT_MS,
  formatAddress, parsePhones, parseHours, isOpenAt, telHref, webHref, distKm, fmtDist, clean,
  // for the tests
  _parseHours: parseHours, _isOpenAt: isOpenAt, _telHref: telHref, _webHref: webHref, _viewArea: viewArea,
};

})();
