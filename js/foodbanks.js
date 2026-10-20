// ═══════════════════════════════════════════════════════════════
//  foodbanks.js — real food banks near the map, from several free sources
//
//  Fills the Food tab ("Places and help" in the right panel) and draws a 🥣
//  marker on the map for each food bank. Nothing here is made up: every name,
//  address, phone number and website comes from one of the sources below, and
//  each entry says which source it came from.
//
//  Sources (all free, no key, readable from a web page on another site):
//    · Give Food (givefood.org.uk) — public data on United Kingdom food banks,
//      including the Trussell network, with the items each one asks to be
//      donated. A food bank that asks for cat, dog or pet food gives it out.
//      Rules: credit Give Food with a link, link to the food bank, link to
//      the full list when showing what it needs.
//    · Blue Cross pet food bank map — the public map Blue Cross publishes of
//      its own pet food banks and the partner food banks it supplies with pet
//      food (read through the map's own download link).
//    · OpenStreetMap through Overpass — places tagged as food banks
//      (social_facility=food_bank), with the same gentle rules as the Vets
//      tab (js/vets.js): main server then one fallback, never both at once,
//      a server time limit, no automatic retries, a growing wait after errors.
//  Not used: the Royal Society for the Prevention of Cruelty to Animals pet
//  food bank map. It has no open data feed (the results only come back as a
//  web page after a form is sent with a one-time token, and its site does not
//  allow other sites to read or embed it), so it is offered as a link only.
//
//  When a source is offline, slow (each has a time limit) or finds nothing,
//  the others still show, with a short honest note. Each area's answers are
//  kept for 30 minutes in sessionStorage; the last good list per area is kept
//  in localStorage and shown, clearly dated, only when every source fails.
//
//  Hooks: window.sfFood (used by js/panel-right.js). Draws by wrapping
//  drawPets(), the same way js/vets.js does. Registers the "food" mode of the
//  top search box with sfDash.registerSearchMode.
// ═══════════════════════════════════════════════════════════════

(function () {

const V = window.sfVets || {};
const RADIUS_M = 10000;                  // food banks within 10 kilometres
const CACHE_KEY = 'sf_food_cache_v1';    // sessionStorage: answers per source and area
const SAVED_KEY = 'sf_food_saved_v1';    // localStorage: last good list per area
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX = 24;
const SAVED_MAX_AREAS = 8;
const SAVED_NEAR_KM = 5;                 // a saved list this close counts as the same area
const OVERPASS_LIMIT = 60;

// Time limits and waits; the tests make the time limits shorter.
const config = {
  timeouts: { givefood: 12000, bluecross: 15000, osm: (V.CLIENT_TIMEOUT_MS || 25000) },
  firstWaitS: 5, maxWaitS: 300, busyWaitS: 60,
};

const GIVEFOOD_URL = 'https://www.givefood.org.uk/api/2/locations/search/?lat_lng=';
const BLUECROSS_MAP_ID = '1iRyVerw5T4iY5I6psKfxmIylXS4gx7g';
const BLUECROSS_KML = 'https://www.google.com/maps/d/kml?mid=' + BLUECROSS_MAP_ID + '&forcekml=1';
const BLUECROSS_PAGE = 'https://www.bluecross.org.uk/help-and-support/our-pet-food-banks';
const OVERPASS = (V.ENDPOINTS && V.ENDPOINTS.length) ? V.ENDPOINTS.slice()
  : ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const OVERPASS_SERVER_TIMEOUT_S = V.QUERY_TIMEOUT_S || 20;

// Order matters: it is the order sources are listed and how merged details are picked.
const SOURCES = [
  { id: 'givefood', name: 'Give Food', site: 'https://www.givefood.org.uk/' },
  { id: 'bluecross', name: 'Blue Cross pet food bank map', site: BLUECROSS_PAGE },
  { id: 'osm', name: 'OpenStreetMap', site: 'https://www.openstreetmap.org/copyright' },
];
const SOURCE = Object.fromEntries(SOURCES.map(s => [s.id, s]));

// ── State ──
const st = {
  status: 'idle',      // idle | loading | ready | saved | failed
  area: null,          // { lat, lon, radius, key, at }
  origin: null,        // { lat, lon, label } distances are measured from here
  items: [],           // merged food banks for the current area
  src: {},             // per source: { status, count, error, failures, waitUntil }
  saved: null,         // { ts, label } when showing saved results
  note: '',
  filter: '',
  selected: '',
  inFlight: false,
  pending: null,
  requests: { givefood: 0, bluecross: 0, osm: 0 },
  userLoc: null,
};
SOURCES.forEach(s => { st.src[s.id] = { status: 'idle', count: 0, error: '', failures: 0, waitUntil: 0 }; });
let active = false;
let mountEl = null;
const mem = new Map();

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
// Phone links keep only digits, "+", spaces and dashes.
function telHref(phone) {
  if (typeof V.telHref === 'function') return V.telHref(phone);
  const s = String(phone == null ? '' : phone).replace(/[^0-9+\- ]/g, '').trim();
  return /[0-9]/.test(s) ? 'tel:' + s : '';
}
// Only http and https web links are ever made clickable.
function webHref(url) {
  if (typeof V.webHref === 'function') return V.webHref(url);
  const s = String(url == null ? '' : url).trim();
  if (!/^https?:\/\//i.test(s)) return '';
  try { const u = new URL(s); return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : ''; } catch (e) { return ''; }
}
function joinNames(ids) {
  const n = ids.map(id => SOURCE[id] ? SOURCE[id].name : id);
  if (n.length <= 1) return n.join('');
  return n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
}
function fmtDate(ts) {
  const d = new Date(ts);
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return day + ' at ' + time;
}
function cleanPhones(list) {
  const out = [], seen = new Set();
  list.forEach(p => {
    const text = clean(p, 40);
    const key = text.replace(/[^0-9]/g, '').replace(/^44/, '0');
    if (text && key.length >= 6 && !seen.has(key)) { seen.add(key); out.push(text); }
  });
  return out.slice(0, 3);
}

// Items that mean "pet food" in a needs list or a description.
const PET_ITEM = /\b(pet|cat|dog|kitten|puppy|animal)s?'?\s*(food|biscuits?|pouches|treats|meals?|tins?)\b/i;
const PET_PLACE = /\bpet food\b|\banimal food\b|\bpet pantry\b|\bpets?\b.*\bfood ?bank\b/i;

// ── Give Food → food banks ──
function parseGiveFood(data) {
  if (!Array.isArray(data)) { const e = new Error('not a list'); e.kind = 'parse'; throw e; }
  const out = [];
  data.forEach(x => {
    if (!x || typeof x !== 'object') return;
    const ll = String(x.lat_lng || '').split(',').map(Number);
    if (ll.length !== 2 || !ll.every(isFinite)) return;
    const fb = (x.foodbank && typeof x.foodbank === 'object') ? x.foodbank : {};
    const needs = (x.needs && typeof x.needs === 'object') ? x.needs : {};
    const lines = s => String(s || '').split(/\r?\n/).map(t => clean(t, 80)).filter(Boolean);
    const asked = lines(needs.needs).filter(t => PET_ITEM.test(t));
    const spare = lines(needs.excess).filter(t => PET_ITEM.test(t));
    const urls = (x.urls && typeof x.urls === 'object') ? x.urls : {};
    const why = [];
    if (asked.length) why.push('asks for ' + asked.join(', ') + ' on its Give Food list, so it gives out pet food');
    if (spare.length) why.push('has spare ' + spare.join(', ') + ' (Give Food list)');
    const network = clean(fb.network || x.network, 40);
    const parent = clean(fb.name, 120);
    const name = clean(x.name, 120);
    out.push({
      id: 'givefood/' + clean(x.id || x.slug, 60),
      lat: ll[0], lon: ll[1],
      name,
      what: x.type === 'location' && parent && parent.toLowerCase() !== name.toLowerCase()
        ? 'A centre of ' + parent + ' food bank' : 'Food bank',
      network: network && network !== 'Independent' ? network + ' network' : (network === 'Independent' ? 'independent' : ''),
      address: clean(String(x.address || '').replace(/\r?\n/g, ', '), 300),
      hours: '',
      phones: cleanPhones([x.phone, x.secondary_phone]),
      website: clean(urls.homepage, 500),
      notes: '',
      pet: !!(asked.length || spare.length),
      petWhy: why.map(w => ({ source: 'givefood', text: w })),
      links: { givefood: clean(urls.html, 500) },
      needsFound: clean(needs.found, 40),
      sources: ['givefood'],
    });
  });
  return out;
}

// ── Blue Cross pet food bank map (KML) → pet food banks ──
function decodeEntities(s) {
  return s.replace(/&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi, (m, c) => {
    c = c.toLowerCase();
    if (c[0] === '#') { const n = c[1] === 'x' ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10); return isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[c];
  });
}
function parseKml(text) {
  if (typeof text !== 'string' || !/<kml[\s>]/i.test(text)) { const e = new Error('not a map file'); e.kind = 'parse'; throw e; }
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) { const e = new Error('bad map file'); e.kind = 'parse'; throw e; }
  const out = [];
  const marks = doc.getElementsByTagName('Placemark');
  for (let i = 0; i < marks.length; i++) {
    const pm = marks[i];
    const get = tag => { const n = pm.getElementsByTagName(tag)[0]; return n ? n.textContent : ''; };
    const co = get('coordinates').trim().split(/[\s]+/)[0].split(',').map(Number);
    if (co.length < 2 || !isFinite(co[0]) || !isFinite(co[1]) || Math.abs(co[1]) > 90 || Math.abs(co[0]) > 180) continue;
    // The description is a little HTML; turn it into plain lines of text.
    const raw = decodeEntities(get('description').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' '));
    const lines = raw.split(/[\n\t]+/).map(t => clean(t, 300)).filter(Boolean);
    let website = '';
    const phones = [], notes = [];
    lines.forEach(line => {
      const url = line.match(/https?:\/\/[^\s<>"']+/i);
      if (url && !website) website = url[0].replace(/[.,;)]+$/, '');
      const bare = line.replace(/https?:\/\/[^\s<>"']+/gi, '').replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '').trim();
      const phone = bare.match(/(?:\+44\s?|\b0)\d[\d\s()-]{8,14}\d/);
      if (phone) phones.push(phone[0]);
      const rest = clean(bare.replace(phone ? phone[0] : '', '').replace(/^[\s,.:;-]+|[\s,:;-]+$/g, ''));
      if (rest && /[a-z]/i.test(rest) && !/^(details at|located at)$/i.test(rest)) notes.push(rest);
    });
    const style = get('styleUrl');
    const own = /0288D1/i.test(style);       // blue pins are Blue Cross's own sites
    const name = clean(get('name'), 120);
    out.push({
      id: 'bluecross/' + co[1].toFixed(5) + ',' + co[0].toFixed(5) + '/' + name.slice(0, 40),
      lat: co[1], lon: co[0],
      name,
      what: own ? 'Blue Cross site with a pet food bank' : 'Food bank partnered with Blue Cross for pet food',
      network: '',
      address: '',
      hours: '',
      phones: cleanPhones(phones),
      website,
      notes: notes.join(' · ').slice(0, 300),
      pet: true,
      petWhy: [{ source: 'bluecross', text: 'on the Blue Cross pet food bank map (ring first to check they have stock)' }],
      links: { bluecross: BLUECROSS_PAGE },
      sources: ['bluecross'],
    });
  }
  return out;
}

// ── OpenStreetMap (Overpass) → food banks ──
function osmAddress(t) {
  if (typeof V.formatAddress === 'function') return V.formatAddress(t);
  return clean(t['addr:full'] || [t['addr:housenumber'], t['addr:street'], t['addr:city'], t['addr:postcode']].filter(Boolean).join(', '));
}
function osmPhones(t) {
  if (typeof V.parsePhones === 'function') return V.parsePhones(t);
  return cleanPhones(String(t.phone || t['contact:phone'] || '').split(';'));
}
function parseOsm(elements) {
  const out = [], seen = new Set();
  (elements || []).forEach(e => {
    if (!e || typeof e !== 'object') return;
    const lat = typeof e.lat === 'number' ? e.lat : (e.center && e.center.lat);
    const lon = typeof e.lon === 'number' ? e.lon : (e.center && e.center.lon);
    if (typeof lat !== 'number' || typeof lon !== 'number' || !isFinite(lat) || !isFinite(lon)) return;
    const id = clean(e.type, 10) + '/' + clean(e.id, 20);
    if (seen.has(id)) return; seen.add(id);
    const t = (e.tags && typeof e.tags === 'object') ? e.tags : {};
    const forWho = clean(t['social_facility:for'], 120);
    const text = [t.name, t.description, t.note].map(x => clean(x)).join(' ');
    const why = [];
    if (/animal|pet/i.test(forWho)) why.push('tagged on OpenStreetMap as a food bank for animals');
    else if (PET_PLACE.test(text)) why.push('its OpenStreetMap name or description mentions pet food');
    out.push({
      id: 'osm/' + id,
      osmId: id,
      lat, lon,
      name: clean(t.name, 120),
      what: 'Food bank',
      network: clean(t.network, 60),
      address: osmAddress(t),
      hours: clean(t.opening_hours, 300),
      phones: osmPhones(t),
      website: clean(String(t.website || t['contact:website'] || t.foodbank_url || '').split(';')[0], 500),
      notes: clean(t.description, 200),
      pet: why.length > 0,
      petWhy: why.map(w => ({ source: 'osm', text: w })),
      links: { osm: /^(node|way|relation)\/\d+$/.test(id) ? 'https://www.openstreetmap.org/' + id : '' },
      sources: ['osm'],
    });
  });
  return out;
}
function overpassQuery(a) {
  const around = `(around:${a.radius},${a.lat},${a.lon})`;
  return `[out:json][timeout:${OVERPASS_SERVER_TIMEOUT_S}];(nwr["social_facility"="food_bank"]${around};);out center ${OVERPASS_LIMIT};`;
}

// ── Merging: the same food bank from two sources becomes one entry ──
const NAME_NOISE = /\b(the|a|of|and|food ?banks?|foodbanks?|food|banks?|pantry|larder|community|centre|center|hub|project|charity|trust|trussell|network|ltd|cic|uk)\b/g;
function nameWords(n) {
  return String(n || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ')
    .replace(NAME_NOISE, ' ').split(/\s+/).filter(w => w.length > 1);
}
function similarNames(a, b) {
  const A = nameWords(a), B = nameWords(b);
  if (!A.length || !B.length) return false;
  const sa = A.join(' '), sb = B.join(' ');
  if (sa === sb || sa.includes(sb) || sb.includes(sa)) return true;
  const setB = new Set(B);
  const common = A.filter(w => setB.has(w)).length;
  return common / Math.min(A.length, B.length) >= 0.6;
}
// Same place: within 60 metres, or within 400 metres with a matching name.
function samePlace(a, b) {
  const m = distKm(a, b) * 1000;
  if (m <= 60) return true;
  return m <= 400 && similarNames(a.name, b.name);
}
const PICK = {   // which source's detail wins when two agree on a place
  name: ['osm', 'bluecross', 'givefood'],
  address: ['givefood', 'osm', 'bluecross'],
  website: ['osm', 'givefood', 'bluecross'],
  coords: ['givefood', 'osm', 'bluecross'],
};
function pick(group, field, order) {
  for (const id of order) {
    const hit = group.find(x => x.sources[0] === id && x[field]);
    if (hit) return hit;
  }
  return group.find(x => x[field]) || group[0];
}
function mergeGroup(group) {
  if (group.length === 1) return Object.assign({}, group[0], { names: [], key: group[0].id });
  const c = pick(group, 'lat', PICK.coords);
  const nm = pick(group, 'name', PICK.name);
  const names = [];
  group.forEach(x => { if (x.name && x.name !== nm.name && !names.some(n => n.toLowerCase() === x.name.toLowerCase())) names.push(x.name); });
  const sources = [];
  group.forEach(x => x.sources.forEach(s => { if (!sources.includes(s)) sources.push(s); }));
  sources.sort((a, b) => SOURCES.findIndex(s => s.id === a) - SOURCES.findIndex(s => s.id === b));
  const links = {};
  group.forEach(x => Object.keys(x.links || {}).forEach(k => { if (x.links[k] && !links[k]) links[k] = x.links[k]; }));
  return {
    id: group.map(x => x.id).sort().join('+'),
    key: group.map(x => x.id).sort().join('+'),
    lat: c.lat, lon: c.lon,
    name: nm.name,
    names,
    what: (group.find(x => x.sources[0] === 'givefood' && x.what !== 'Food bank') || group.find(x => x.sources[0] === 'bluecross') || nm).what,
    network: (group.find(x => x.network) || {}).network || '',
    address: pick(group, 'address', PICK.address).address || '',
    hours: (group.find(x => x.hours) || {}).hours || '',
    phones: cleanPhones([].concat(...group.map(x => x.phones || []))),
    website: pick(group, 'website', PICK.website).website || '',
    notes: (group.find(x => x.notes) || {}).notes || '',
    pet: group.some(x => x.pet),
    petWhy: [].concat(...group.map(x => x.petWhy || [])),
    links,
    sources,
  };
}
function mergeAll(lists) {
  const all = [].concat(...lists).filter(Boolean);
  const groups = [];
  all.forEach(item => {
    const g = groups.find(gr => gr.some(x => samePlace(x, item)));
    if (g) g.push(item); else groups.push([item]);
  });
  return groups.map(mergeGroup);
}

// ── Caches ──
function readJson(store, key) {
  try { return JSON.parse(store.getItem(key) || '{}') || {}; } catch (e) { return {}; }
}
function cacheGet(key) {
  let hit = mem.get(key);
  if (!hit) { const s = readJson(sessionStorage, CACHE_KEY)[key]; if (s && Array.isArray(s.items)) { hit = s; mem.set(key, s); } }
  return hit && Date.now() - hit.ts < CACHE_TTL_MS ? hit.items : null;
}
function cachePut(key, items) {
  const entry = { ts: Date.now(), items };
  mem.set(key, entry);
  try {
    const all = readJson(sessionStorage, CACHE_KEY); all[key] = entry;
    Object.keys(all).sort((a, b) => all[b].ts - all[a].ts).slice(CACHE_MAX).forEach(k => delete all[k]);
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch (e) { /* storage full or blocked: the memory copy still works */ }
}
function savePut(area, origin, items, okSources) {
  if (!items.length) return;
  try {
    const all = readJson(localStorage, SAVED_KEY);
    all[area.key] = { ts: Date.now(), lat: area.at.lat, lon: area.at.lon, label: origin.label, items, sources: okSources };
    Object.keys(all).sort((a, b) => all[b].ts - all[a].ts).slice(SAVED_MAX_AREAS).forEach(k => delete all[k]);
    localStorage.setItem(SAVED_KEY, JSON.stringify(all));
  } catch (e) {}
}
function saveGet(area) {
  const all = readJson(localStorage, SAVED_KEY);
  if (all[area.key] && Array.isArray(all[area.key].items)) return all[area.key];
  let best = null, bestD = Infinity;
  Object.keys(all).forEach(k => {
    const s = all[k];
    if (!s || !Array.isArray(s.items) || !isFinite(s.lat) || !isFinite(s.lon)) return;
    const d = distKm(area.at, s);
    if (d < SAVED_NEAR_KM && d < bestD) { best = s; bestD = d; }
  });
  return best;
}

// ── Network ──
async function getWithLimit(id, url, opts, kindOf) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), config.timeouts[id]) : null;
  st.requests[id]++;
  try {
    const res = await fetch(url, Object.assign({ signal: ctl ? ctl.signal : undefined, credentials: 'omit' }, opts || {}));
    if (res.status === 429) {
      const e = new Error('busy'); e.kind = 'busy';
      const ra = parseInt(res.headers.get('Retry-After') || '', 10);
      e.wait = isFinite(ra) ? Math.min(config.maxWaitS, Math.max(config.busyWaitS, ra)) : config.busyWaitS;
      throw e;
    }
    if (res.status >= 500) { const e = new Error('server ' + res.status); e.kind = 'server'; throw e; }
    if (!res.ok) { const e = new Error('bad request ' + res.status); e.kind = 'bad'; throw e; }
    return await (kindOf === 'text' ? res.text() : res.json());
  } catch (e) {
    if (!e.kind) e.kind = (e.name === 'AbortError') ? 'timeout' : (e instanceof SyntaxError ? 'parse' : 'network');
    throw e;
  } finally { if (timer) clearTimeout(timer); }
}
const FETCH = {
  async givefood(area) {
    const data = await getWithLimit('givefood', GIVEFOOD_URL + area.lat.toFixed(4) + ',' + area.lon.toFixed(4), { method: 'GET' }, 'json');
    return parseGiveFood(data);
  },
  async bluecross() {
    // One small file for the whole country, read once per 30 minutes.
    const all = cacheGet('bluecross|all');
    if (all) return all;
    const text = await getWithLimit('bluecross', BLUECROSS_KML, { method: 'GET' }, 'text');
    const items = parseKml(text);
    cachePut('bluecross|all', items);
    return items;
  },
  async osm(area) {
    const body = 'data=' + encodeURIComponent(overpassQuery(area));
    let lastErr = null;
    for (const url of OVERPASS) {          // main, then the fallback; never both at once
      try {
        const data = await getWithLimit('osm', url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body }, 'json');
        const elements = Array.isArray(data && data.elements) ? data.elements : null;
        if (!elements) { const e = new Error('no elements'); e.kind = 'server'; throw e; }
        if (!elements.length && data.remark && /error|timed? ?out|timeout/i.test(String(data.remark))) { const e = new Error('remark'); e.kind = 'server'; throw e; }
        return parseOsm(elements);
      } catch (e) { lastErr = e; if (e.kind === 'bad' || e.kind === 'busy') break; }
    }
    throw lastErr;
  },
};
function problem(e) {
  if (e && e.kind === 'busy') return 'says it is too busy';
  if (e && e.kind === 'timeout') return 'did not answer in time';
  if (e && (e.kind === 'parse' || e.kind === 'bad')) return 'sent an answer this page could not read';
  if (e && e.kind === 'server') return 'is having trouble';
  return 'unreachable';
}

// ── Searching ──
function areaAt(lat, lon) {
  const cLat = Math.round(lat * 100) / 100, cLon = Math.round(lon * 100) / 100;
  return { lat: cLat, lon: cLon, radius: RADIUS_M, key: cLat.toFixed(2) + ',' + cLon.toFixed(2) + ',' + RADIUS_M, at: { lat, lon } };
}
function viewArea() {
  if (typeof S === 'undefined' || !isFinite(S.lat) || !isFinite(S.lon)) return null;
  return areaAt(S.lat, S.lon);
}
function inRadius(items, area) {
  return items.filter(x => distKm(area.at, x) * 1000 <= area.radius);
}

// reason: 'open' | 'button' | 'retry' | 'me' | 'place'
async function search(reason, area, placeLabel) {
  area = area || viewArea();
  if (!area) return;
  if (st.inFlight) { st.pending = [reason, area, placeLabel]; return; }
  const near = st.userLoc && distKm(st.userLoc, area.at) < 0.2;
  const origin = { lat: area.at.lat, lon: area.at.lon, label: placeLabel || (near ? 'your location' : 'the map view') };
  const sameArea = st.area && st.area.key === area.key;
  Object.assign(st, { area, origin, saved: null });
  if (!sameArea) { st.items = []; st.selected = ''; }
  const now = Date.now();
  const lists = {};
  const todo = [];
  SOURCES.forEach(s => {
    const ss = st.src[s.id];
    const cached = s.id === 'bluecross' ? cacheGet('bluecross|all') : cacheGet(s.id + '|' + area.key);
    if (cached) { lists[s.id] = inRadius(cached, area); Object.assign(ss, { status: 'ok', count: lists[s.id].length, error: '' }); return; }
    if (now < ss.waitUntil) { Object.assign(ss, { status: 'waiting' }); return; }   // still waiting after an error
    Object.assign(ss, { status: 'loading', error: '' });
    todo.push(s.id);
  });
  const finish = () => {
    st.items = mergeAll(SOURCES.map(s => lists[s.id] || []));
    const ok = SOURCES.filter(s => st.src[s.id].status === 'ok').map(s => s.id);
    const loading = SOURCES.some(s => st.src[s.id].status === 'loading');
    if (ok.length) {
      st.status = loading ? 'loading' : 'ready';
      if (!loading) savePut(area, origin, st.items, ok);
    } else if (loading) {
      st.status = 'loading';
    } else {
      const saved = saveGet(area);
      if (saved) { st.status = 'saved'; st.items = saved.items; st.saved = { ts: saved.ts, label: saved.label, sources: saved.sources || [] }; }
      else st.status = 'failed';
    }
    draw();
  };
  if (!todo.length) { finish(); return; }
  st.inFlight = true;
  finish();                                   // shows "Sniffing…" plus anything cached
  // A few different services at once, one request each.
  await Promise.all(todo.map(async id => {
    const ss = st.src[id];
    try {
      const items = await FETCH[id](area);
      if (id !== 'bluecross') cachePut(id + '|' + area.key, items);
      lists[id] = inRadius(items, area);
      Object.assign(ss, { status: 'ok', count: lists[id].length, error: '', failures: 0, waitUntil: 0 });
    } catch (e) {
      ss.failures++;
      const wait = e && e.kind === 'busy' ? e.wait : Math.min(config.maxWaitS, config.firstWaitS * Math.pow(2, ss.failures - 1));
      Object.assign(ss, { status: 'error', error: problem(e), waitUntil: Date.now() + wait * 1000 });
    }
    if (st.area && st.area.key === area.key) finish();
  }));
  st.inFlight = false;
  finish();
  if (st.pending) { const p = st.pending; st.pending = null; search.apply(null, p); }
}

function getPosition() {
  const ask = new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('no geolocation')); return; }
    navigator.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }), reject, { timeout: 8000, maximumAge: 60000 });
  });
  const ceiling = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000));
  return Promise.race([ask, ceiling]);
}
async function nearMe() {
  st.note = 'Asking for your location…'; draw();
  try {
    const pos = await getPosition();
    st.userLoc = pos; st.note = '';
    if (typeof S !== 'undefined') { S.lat = pos.lat; S.lon = pos.lon; }
    if (typeof zoomTarget !== 'undefined' && zoomTarget < 13) zoomTarget = 13;
    await search('me', areaAt(pos.lat, pos.lon));
  } catch (e) {
    st.note = 'Could not get your location (check the location permission). Showing food banks around the map view instead.';
    draw();
  }
}
// Enter in the top search box (Food mode): look the place or postcode up with
// Nominatim, move the map there and search for food banks around it.
async function placeSearch(text) {
  const q = clean(text, 120);
  if (!q) return search('button');
  if (typeof geocodePlace !== 'function') { st.note = 'The place search did not load. Reload the page to try again.'; draw(); return; }
  st.note = 'Looking up "' + q + '"…'; draw();
  let place = null;
  try { place = await geocodePlace(q); }
  catch (e) { st.note = 'Could not reach the place search (Nominatim). Check your connection and try again.'; draw(); return; }
  if (!place) { st.note = 'No place called "' + q + '" was found. Try a town, street or postcode.'; draw(); return; }
  st.note = '';
  if (typeof S !== 'undefined') { S.lat = place.lat; S.lon = place.lon; }
  if (typeof zoomTarget !== 'undefined') zoomTarget = 13;
  st.filter = '';
  if (window.sfDash && sfDash.setModeText) sfDash.setModeText('food', '');
  await search('place', areaAt(place.lat, place.lon), place.name);
}
function goTo(f) {
  if (typeof S === 'undefined' || !f) return;
  S.lat = f.lat; S.lon = f.lon;
  if (typeof zoomTarget !== 'undefined' && zoomTarget < 16) zoomTarget = 16;
  st.selected = f.key;
  st.goHold = { lat: f.lat, lon: f.lon };
  // The "No pets on the map yet" hint sits in the middle of the map, right on
  // top of the marker; hide it while the map stays on this food bank.
  document.body.classList.add('sf-food-focus');
  if (window.sfDash && sfDash.isPhone()) sfDash.setPanelOpen('right', false);
  draw();
}
setInterval(() => {
  if (!document.body.classList.contains('sf-food-focus') || typeof S === 'undefined') return;
  if (!st.goHold || distKm(st.goHold, { lat: S.lat, lon: S.lon }) >= 0.15) {
    document.body.classList.remove('sf-food-focus'); st.goHold = null;
  }
}, 500);

// ── Filter (typing in the top search box in Food mode) ──
function filterTerms() { return st.filter.toLowerCase().split(/\s+/).filter(Boolean); }
function foodMatches(f) {
  const t = filterTerms();
  if (!t.length) return true;
  const hay = [f.name, f.what, f.network, f.address, f.notes, f.hours, f.website]
    .concat(f.names || [], f.phones || [], f.sources.map(s => SOURCE[s] ? SOURCE[s].name : s), f.pet ? ['pet food', 'pets'] : [])
    .map(x => String(x == null ? '' : x).toLowerCase()).join('\n');
  return t.every(w => hay.includes(w));
}
function setFilter(text) {
  const t = clean(text, 80);
  if (t === st.filter) return;
  st.filter = t;
  draw();
}
function sorted() {
  const o = st.origin;
  return st.items.map(f => Object.assign({}, f, { dist: o ? distKm(o, f) : null }))
    .sort((a, b) => (b.pet - a.pet) || ((a.dist ?? 1e9) - (b.dist ?? 1e9)));
}

// ── Drawing (DOM nodes and textContent only) ──
function retryLeft() {
  const waits = SOURCES.map(s => st.src[s.id]).filter(ss => ss.status === 'error' || ss.status === 'waiting').map(ss => ss.waitUntil);
  if (!waits.length) return 0;
  return Math.max(0, Math.ceil((Math.min.apply(null, waits) - Date.now()) / 1000));
}
function updateRetry(b) {
  const left = retryLeft();
  b.disabled = left > 0;
  b.textContent = left > 0 ? `↻ Try again in ${left} second${left === 1 ? '' : 's'}` : '↻ Try again';
}
function card(f) {
  const c = el('div', 'rp-link sf-vet sf-food' + (f.pet ? ' pet' : ''));
  c.dataset.foodId = f.key;
  if (f.key === st.selected) c.classList.add('sel');
  const head = el('div', 'sf-vet-head');
  head.appendChild(el('span', 'sf-vet-icon sf-food-icon', '🥣'));
  const nm = el('span', 'sf-vet-name sf-food-name', f.name || 'Name not listed');
  if (!f.name) nm.classList.add('missing');
  head.appendChild(nm);
  c.appendChild(head);
  if (f.names && f.names.length) c.appendChild(el('div', 'sf-food-aka', 'Also listed as: ' + f.names.join(', ')));

  const badges = el('div', 'rp-ltags');
  badges.appendChild(el('span', 'rp-ltag sf-food-pet' + (f.pet ? '' : ' maybe'), f.pet ? '🐾 Pet food confirmed' : 'General food bank, may help with pet food'));
  if (f.dist != null) badges.appendChild(el('span', 'rp-ltag pl sf-food-dist', fmtDist(f.dist)));
  const parsed = f.hours && typeof V.parseHours === 'function' ? V.parseHours(f.hours) : null;
  const open = parsed && typeof V.isOpenAt === 'function' ? V.isOpenAt(parsed, new Date()) : null;
  if (open != null) badges.appendChild(el('span', 'rp-ltag sf-vet-open' + (open ? '' : ' em'), open ? 'Open now' : 'Closed now'));
  c.appendChild(badges);

  const kind = [f.what, f.network].filter(Boolean).join(' · ');
  if (kind) c.appendChild(el('div', 'sf-food-what', kind));
  if (f.pet && f.petWhy && f.petWhy.length) {
    const why = el('div', 'sf-food-why');
    why.textContent = '🐾 ' + f.petWhy.map(w => w.text).join('; ');
    c.appendChild(why);
  }
  if (f.address) c.appendChild(el('div', 'rp-laddr sf-vet-addr sf-food-addr', '📍 ' + f.address));
  else c.appendChild(el('div', 'rp-laddr sf-vet-addr sf-food-addr missing', '📍 Address not listed'));
  if (f.notes) c.appendChild(el('div', 'sf-food-notes', '📝 ' + f.notes));

  const hrs = el('div', 'sf-vet-hours sf-food-hours');
  if (!f.hours) { hrs.textContent = '🕒 Opening hours not listed'; hrs.classList.add('missing'); }
  else if (parsed) parsed.lines.forEach((l, i) => hrs.appendChild(el('div', null, (i ? '' : '🕒 ') + l)));
  else hrs.textContent = '🕒 ' + f.hours;
  c.appendChild(hrs);

  const ph = el('div', 'sf-vet-phone sf-food-phone');
  if (!f.phones || !f.phones.length) { ph.textContent = '📞 Phone not listed'; ph.classList.add('missing'); }
  else {
    ph.appendChild(document.createTextNode('📞 '));
    f.phones.forEach((p, i) => {
      if (i) ph.appendChild(document.createTextNode(' · '));
      const href = telHref(p);
      if (href) { const a = el('a', 'sf-vet-tel sf-food-tel', p); a.setAttribute('href', href); ph.appendChild(a); }
      else ph.appendChild(el('span', null, p));
    });
  }
  c.appendChild(ph);

  if (f.website) {
    const w = el('div', 'sf-vet-web sf-food-web');
    const href = webHref(f.website);
    w.appendChild(document.createTextNode('🌐 '));
    if (href) {
      const shown = f.website.replace(/^https?:\/\//i, '').replace(/[?&]ref=givefood\.org\.uk$/i, '').replace(/\/$/, '').slice(0, 60);
      const a = el('a', 'sf-food-site', shown);
      a.setAttribute('href', href); a.target = '_blank'; a.rel = 'noopener noreferrer nofollow';
      w.appendChild(a);
    } else {
      w.appendChild(el('span', 'sf-food-site-text', f.website));   // shown, never clickable
    }
    c.appendChild(w);
  }

  const from = el('div', 'sf-food-from');
  from.appendChild(document.createTextNode('From: '));
  f.sources.forEach((s, i) => {
    if (i) from.appendChild(document.createTextNode(', '));
    const link = webHref((f.links || {})[s] || '');
    const name = SOURCE[s] ? SOURCE[s].name : s;
    if (link) { const a = el('a', 'sf-food-src', name + ' ↗'); a.setAttribute('href', link); a.target = '_blank'; a.rel = 'noopener'; a.dataset.source = s; from.appendChild(a); }
    else { const sp = el('span', 'sf-food-src', name); sp.dataset.source = s; from.appendChild(sp); }
  });
  if (f.links && f.links.givefood && f.pet && f.sources.includes('givefood')) from.appendChild(el('span', 'sf-food-src-hint', ' (full list of what it needs is on Give Food)'));
  c.appendChild(from);

  const btns = el('div', 'rp-pet-btns');
  const go = el('button', 'rp-pin-btn sf-vet-go sf-food-go', '🎯 Go');
  go.type = 'button'; go.title = 'Put a marker on the map at this food bank';
  go.addEventListener('click', () => goTo(f));
  btns.appendChild(go);
  c.appendChild(btns);
  return c;
}
function sourceLines(root) {
  const box = el('div', 'sf-food-sources');
  SOURCES.forEach(s => {
    const ss = st.src[s.id];
    let text = '', cls = '';
    if (ss.status === 'loading') { text = '… ' + s.name + ': still sniffing'; cls = 'loading'; }
    else if (ss.status === 'ok') text = '✓ ' + s.name + ': ' + (ss.count ? ss.count + ' found' : 'none within ' + RADIUS_M / 1000 + ' kilometres');
    else if (ss.status === 'error') { text = '⚠️ ' + s.name + ': ' + ss.error; cls = 'err'; }
    else if (ss.status === 'waiting') { text = '⏳ ' + s.name + ': resting after an error, not asked this time'; cls = 'err'; }
    if (!text) return;
    const line = el('div', 'sf-food-src-line ' + cls, text);
    line.dataset.source = s.id; line.dataset.state = ss.status;
    box.appendChild(line);
  });
  if (box.childNodes.length) root.appendChild(box);
}
function fallbackNote() {
  const bad = SOURCES.filter(s => ['error', 'waiting'].includes(st.src[s.id].status)).map(s => s.id);
  const ok = SOURCES.filter(s => st.src[s.id].status === 'ok').map(s => s.id);
  if (!bad.length || !ok.length) return '';
  return joinNames(bad) + ' unreachable, showing ' + joinNames(ok) + ' results.';
}
function draw() {
  if (!mountEl || !mountEl.isConnected) return;
  const root = el('div', 'sf-vets sf-food');
  root.id = 'sfFood';

  const bar = el('div', 'sf-vet-bar');
  const here = el('button', 'rp-add-btn sf-food-here', '🗺️ Search this map view');
  here.type = 'button';
  here.addEventListener('click', () => search('button'));
  const me = el('button', 'rp-add-btn sf-food-me', '📍 Near me');
  me.type = 'button';
  me.addEventListener('click', nearMe);
  bar.append(here, me);
  root.appendChild(bar);
  root.appendChild(el('div', 'rp-vet-status sf-vet-hint sf-food-tip', 'Tip: with this tab open, the top search box searches food banks. Type to filter, or type a town or postcode and press Enter.'));

  if (st.note) root.appendChild(el('div', 'rp-vet-status sf-vet-note sf-food-note', st.note));

  const status = el('div', 'rp-vet-status sf-vet-status sf-food-status');
  status.id = 'sfFoodStatus';
  const km = RADIUS_M / 1000;
  const where = st.origin ? st.origin.label : 'the map view';
  let showList = false, showRetry = false;
  if (st.status === 'loading' && !st.items.length) {
    status.textContent = '🥣 Sniffing for food banks…';
    status.classList.add('loading');
  } else if (st.status === 'loading' || st.status === 'ready') {
    const pets = st.items.filter(f => f.pet).length;
    if (!st.items.length) {
      status.textContent = 'No food banks found within ' + km + ' kilometres of ' + where;
      status.classList.add('empty');
    } else {
      status.textContent = `Found ${st.items.length} food bank${st.items.length === 1 ? '' : 's'} within ${km} kilometres of ${where}` +
        (pets ? ` (${pets} with pet food confirmed, listed first)` : '') + ', nearest first' + (st.status === 'loading' ? '. Still sniffing…' : '');
      showList = true;
    }
    if (st.status === 'loading') status.classList.add('loading');
    showRetry = SOURCES.some(s => ['error', 'waiting'].includes(st.src[s.id].status));
  } else if (st.status === 'saved') {
    status.textContent = '⚠️ Every source is unreachable right now.';
    status.classList.add('err');
    const sv = el('div', 'rp-vet-status sf-food-saved', 'Saved from your last search on ' + fmtDate(st.saved.ts) + ', may be out of date' +
      (st.saved.label ? ' (around ' + st.saved.label + ')' : '') + '.');
    sv.id = 'sfFoodSaved';
    root.appendChild(status);
    root.appendChild(sv);
    showList = true; showRetry = true;
  } else if (st.status === 'failed') {
    status.textContent = '⚠️ Could not reach any food bank source, and nothing was saved from an earlier search on this device. Nothing is shown rather than guessing.';
    status.classList.add('err');
    showRetry = true;
  } else {
    status.textContent = 'Move the map to where you need food, then search this map view.';
  }
  if (!status.isConnected) root.appendChild(status);

  const note = fallbackNote();
  if (note && st.status !== 'saved') { const n = el('div', 'rp-vet-status sf-food-fallback', note); n.id = 'sfFoodFallback'; root.appendChild(n); }
  if (st.status !== 'idle' && st.status !== 'saved') sourceLines(root);
  if (showRetry) {
    const retry = el('button', 'rp-add-btn sf-vet-retry sf-food-retry');
    retry.id = 'sfFoodRetry'; retry.type = 'button';
    updateRetry(retry);
    retry.addEventListener('click', () => search('retry', st.area || undefined, st.origin && st.area ? st.origin.label : undefined));
    root.appendChild(retry);
  }

  if (showList) {
    const all = sorted();
    const shown = all.filter(foodMatches);
    if (st.filter) {
      root.appendChild(el('div', 'rp-vet-status sf-food-filter' + (shown.length ? '' : ' empty'),
        shown.length ? `Showing ${shown.length} of ${all.length} matching "${st.filter}". Press Enter to look "${st.filter}" up as a place instead.`
          : `No food banks here match "${st.filter}". Press Enter to look it up as a place or postcode.`));
    }
    const list = el('div', 'sf-vet-list sf-food-list');
    let lastPet = null;
    shown.forEach(f => {
      if (f.pet !== lastPet) {
        list.appendChild(el('div', 'rp-charity-label sf-food-group', f.pet ? '🐾 PET FOOD CONFIRMED' : '🥣 FOOD BANKS THAT MAY HELP (ASK ABOUT PET FOOD)'));
        lastPet = f.pet;
      }
      list.appendChild(card(f));
    });
    root.appendChild(list);
  }

  // The Royal Society for the Prevention of Cruelty to Animals map: link only.
  const rs = el('div', 'rp-vet-status sf-food-rspca');
  rs.appendChild(document.createTextNode('The Royal Society for the Prevention of Cruelty to Animals pet food bank map (England and Wales) has no open data feed this page can read, so it is not searched here. '));
  const rsa = el('a', null, 'Open their map ↗');
  rsa.setAttribute('href', 'https://www.rspca.org.uk/adviceandwelfare/costofliving/foodbank'); rsa.target = '_blank'; rsa.rel = 'noopener';
  rs.appendChild(rsa);
  root.appendChild(rs);

  const credit = el('div', 'sf-vet-credit sf-food-credit');
  const link = (text, href) => { const a = el('a', null, text); a.setAttribute('href', href); a.target = '_blank'; a.rel = 'noopener'; return a; };
  credit.append('Food bank data: ', link('Give Food', 'https://www.givefood.org.uk/'),
    ' (what each food bank asks for is a hint; check its own list) · ', link('Blue Cross pet food bank map', BLUECROSS_PAGE),
    ' · © ', link('OpenStreetMap contributors', 'https://www.openstreetmap.org/copyright'),
    ', found through Overpass. Please ring before you travel. Missing details are not listed by the source yet. "Open now" uses this device\'s clock.');
  root.appendChild(credit);

  mountEl.replaceChildren(root);
}
setInterval(() => {
  if (!active || !mountEl) return;
  const b = mountEl.querySelector('#sfFoodRetry');
  if (b) updateRetry(b);
}, 1000);

// ── Map markers: 🥣 for each food bank found ──
function drawMarkers() {
  if (!st.items.length || typeof worldToScreen !== 'function') return;
  const canvas = document.getElementById('snoutMap');
  const ctx = canvas && canvas.getContext('2d');
  if (!ctx) return;
  const z = (typeof S !== 'undefined') ? S.zoom : 13;
  st.items.forEach(f => {
    const p = worldToScreen(f.lat, f.lon);
    if (p.x < -30 || p.x > canvas.width + 30 || p.y < -30 || p.y > canvas.height + 30) return;
    const sel = f.key === st.selected;
    const r = sel ? 15 : 11;
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(26,18,10,0.92)';
    ctx.fill();
    ctx.lineWidth = sel ? 3 : 2;
    ctx.strokeStyle = sel ? '#ffcc66' : (f.pet ? '#88cc44' : '#cc8833');
    ctx.stroke();
    ctx.font = (sel ? 16 : 12) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🥣', p.x, p.y + 1);
    if ((sel || z >= 16) && f.name) {
      ctx.font = '12px "VT323", monospace';
      const w = ctx.measureText(f.name).width + 8;
      ctx.fillStyle = 'rgba(26,18,10,0.88)';
      ctx.fillRect(p.x - w / 2, p.y - r - 18, w, 15);
      ctx.fillStyle = f.pet ? '#bbee77' : '#ffcc66';
      ctx.fillText(f.name, p.x, p.y - r - 10);
    }
    ctx.restore();
  });
}
if (typeof drawPets === 'function') {
  const _foodOrigDrawPets = drawPets;
  // eslint-disable-next-line no-global-assign
  drawPets = function () { drawMarkers(); _foodOrigDrawPets.apply(this, arguments); };
}

// ── The top search box in Food mode ──
if (window.sfDash && sfDash.registerSearchMode) {
  sfDash.registerSearchMode('food', {
    icon: '🥣', label: 'food banks', placeholder: 'sniff sniff food banks…',
    aria: 'Search food banks. Typing filters the food banks found; press Enter to look up food banks near a place or postcode.',
    button: '🔎 food', buttonTitle: 'Look up food banks near this place or postcode',
    filter: setFilter,
    submit: placeSearch,
    count: () => ({ shown: st.items.filter(foodMatches).length, total: st.items.length, one: 'food bank', many: 'food banks' }),
  });
}

// ── Public ──
window.sfFood = {
  mount(elm) {
    mountEl = elm;
    if (!document.getElementById('sfFoodStyle')) {
      const css = el('style', null, 'body.sf-food-focus #emptyHint { display: none !important; }');
      css.id = 'sfFoodStyle';
      document.head.appendChild(css);
    }
    draw();
  },
  setActive(on) {
    const was = active; active = !!on;
    if (active && !was && st.status === 'idle') search('open');
  },
  state: st, config, SOURCES,
  search, searchAt: (lat, lon, label) => search('place', areaAt(lat, lon), label), placeSearch, setFilter, nearMe,
  clearSession() { mem.clear(); try { sessionStorage.removeItem(CACHE_KEY); } catch (e) {} },
  // for the tests
  _parseGiveFood: parseGiveFood, _parseKml: parseKml, _parseOsm: parseOsm, _mergeAll: mergeAll, _samePlace: samePlace,
  _telHref: telHref, _webHref: webHref, SAVED_KEY, CACHE_KEY,
};

})();
