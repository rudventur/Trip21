// =====================================================================
//  search-panel.js — 3-tab search + left results panel + overlay toggles
//  Simplified to the bone :@)
// =====================================================================

// ══════════════════════════════════════════════════════════════════════
//  OVERLAY CONTROL — all toggles in one place
// ══════════════════════════════════════════════════════════════════════

const OVERLAY_SECTIONS = [
  { title: '\u{1F326} WEATHER & RADAR', items: [
    { key: 'weather',    label: '\u{1F326} Weather HUD',       col: '#00bfff', get: () => G.overlays.weather,                    toggle: () => { G.overlays.weather = !G.overlays.weather; if (G.overlays.weather) fetchWeather(G.pos.lat, G.pos.lng); }},
    { key: 'radar',      label: '\u{1F327} Precip Radar',      col: '#00bfff', get: () => rainRadarEnabled,                      toggle: () => toggleRainRadar() },
    { key: 'lightning',  label: '\u26A1 Lightning Strikes',    col: '#ffe600', get: () => blitzEnabled,                          toggle: () => toggleBlitzortung() },
    { key: 'clouds',     label: '\u2601 Cloud Layers',         col: '#aabbcc', get: () => cloudLayersEnabled,                    toggle: () => toggleCloudLayers() },
    { key: 'wind',       label: '\u{1F32C} Wind Arrows',       col: '#66ccff', get: () => windOverlayEnabled,                    toggle: () => toggleWindOverlay() },
    { key: 'temp',       label: '\u{1F321} Temperature Tint',  col: '#ff6644', get: () => tempOverlayEnabled,                    toggle: () => toggleTempOverlay() },
    { key: 'humidity',   label: '\u{1F4A7} Humidity / Fog',     col: '#6699cc', get: () => humidityOverlayEnabled,                toggle: () => toggleHumidityOverlay() },
    { key: 'visibility', label: '\u{1F441} Visibility Fog',     col: '#99aabb', get: () => G.overlays.weather,                    toggle: () => { G.overlays.weather = !G.overlays.weather; if (G.overlays.weather) fetchWeather(G.pos.lat, G.pos.lng); }},
    { key: 'pressure',   label: '\u{1F4CA} Pressure (HUD)',     col: '#88aacc', get: () => G.overlays.weather,                    toggle: () => { G.overlays.weather = !G.overlays.weather; if (G.overlays.weather) fetchWeather(G.pos.lat, G.pos.lng); }},
  ]},
  { title: '\u{1F33F} NATURE', items: [
    { key: 'mushroom',  label: '\u{1F344} Mushrooms',          col: '#c97b2a', get: () => mushroomEnabled,   toggle: () => toggleMushrooms() },
    { key: 'wildlife',  label: '\u{1F43E} Wildlife',           col: '#b5651d', get: () => wildlifeEnabled,   toggle: () => toggleWildlife() },
    { key: 'cemetery',  label: '\u{1FAA6} Cemeteries',         col: '#8a8a8a', get: () => G.overlays.pins,   toggle: () => { G.overlays.pins = !G.overlays.pins; }},
  ]},
  { title: '\u{1F5FA} MAP & TRANSPORT', items: [
    { key: 'pins',      label: '\u{1F4CC} ArtSpaces',          col: '#00ff41', get: () => G.overlays.pins,     toggle: () => { G.overlays.pins = !G.overlays.pins; }},
    { key: 'flights',   label: '\u2708 Live Flights',          col: '#00bfff', get: () => showFlights,         toggle: () => toggleFlights() },
    { key: 'transit',   label: '\u{1F682} Transit',            col: '#ff6600', get: () => G.overlays.transit,  toggle: () => { G.overlays.transit = !G.overlays.transit; }},
    { key: 'grid',      label: '\u{1F4CA} Grid',               col: '#00ff41', get: () => G.overlays.grid,     toggle: () => { G.overlays.grid = !G.overlays.grid; }},
    { key: 'compass',   label: '\u{1F9ED} Compass',            col: '#00ff41', get: () => G.overlays.compass,  toggle: () => { G.overlays.compass = !G.overlays.compass; }},
  ]},
];

function buildOverlayPanel() {
  const panel = document.getElementById('overlayPanel');
  if (!panel) return;
  let html = '<div class="ov-head">\u2699 LAYERS<button class="ov-close" onclick="toggleOverlayPanel()">\u2715</button></div>';
  OVERLAY_SECTIONS.forEach(sec => {
    html += '<div class="ov-section">' + sec.title + '</div>';
    sec.items.forEach(d => {
      const on = d.get();
      html += '<div class="ov-row" onclick="toggleOverlayRow(\'' + d.key + '\')">'
        + '<div class="ov-dot" style="background:' + (on ? d.col : '#333') + '"></div>'
        + '<span class="ov-label">' + d.label + '</span>'
        + '<span class="ov-status" style="color:' + (on ? d.col : '#555') + '">' + (on ? 'ON' : 'OFF') + '</span>'
        + '</div>';
    });
  });
  panel.innerHTML = html;
}

function toggleOverlayRow(key) {
  for (const sec of OVERLAY_SECTIONS) {
    const def = sec.items.find(d => d.key === key);
    if (def) { def.toggle(); break; }
  }
  buildOverlayPanel(); // refresh UI
}

let overlayPanelOpen = false;
function toggleOverlayPanel() {
  overlayPanelOpen = !overlayPanelOpen;
  const el = document.getElementById('overlayPanel');
  if (el) {
    el.style.display = overlayPanelOpen ? 'block' : 'none';
    if (overlayPanelOpen) buildOverlayPanel();
  }
}

// ══════════════════════════════════════════════════════════════════════
//  3-PART SEARCH SYSTEM
// ══════════════════════════════════════════════════════════════════════

let searchTab = 'places'; // 'places' | 'items' | 'general'
let searchResultsData = [];
let searchPanelOpen = false;

function setSearchTab(tab) {
  searchTab = tab;
  ['st-places', 'st-items', 'st-general'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('sactive', id === 'st-' + tab);
  });
  const input = document.getElementById('searchInput');
  if (!input) return;
  if (tab === 'places')  input.placeholder = 'City, address, landmark...';
  if (tab === 'items')   input.placeholder = 'Free food, doctors, shops...';
  if (tab === 'general') input.placeholder = 'Search anything...';
}

async function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) return;
  showToast('\u{1F50D} Searching...', '#00bfff');

  if (searchTab === 'places')  return searchPlaces(q);
  if (searchTab === 'items')   return searchItems(q);
  if (searchTab === 'general') return searchGeneral(q);
}

// ── TAB 1: PLACES (geo APIs merged) ──
async function searchPlaces(q) {
  searchResultsData = [];

  // Nominatim (OpenStreetMap)
  const nominatimP = fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(q)
    + '&format=json&limit=8&addressdetails=1', { headers: { 'User-Agent': 'ArtSpaceCity/1.0' } })
    .then(r => r.json()).catch(() => []);

  // Photon (Komoot)
  const photonP = fetch('https://photon.komoot.io/api/?q=' + encodeURIComponent(q) + '&limit=6')
    .then(r => r.json()).catch(() => ({ features: [] }));

  const [nominatim, photon] = await Promise.all([nominatimP, photonP]);

  // Merge results, deduplicate by rough lat/lng
  const seen = new Set();

  nominatim.forEach(r => {
    const key = Math.round(r.lat * 100) + ',' + Math.round(r.lon * 100);
    if (seen.has(key)) return;
    seen.add(key);
    searchResultsData.push({
      lat: parseFloat(r.lat), lng: parseFloat(r.lon),
      label: r.display_name.split(',').slice(0, 2).join(', '),
      full: r.display_name,
      type: r.type || '', source: 'OSM'
    });
  });

  (photon.features || []).forEach(f => {
    const c = f.geometry?.coordinates;
    if (!c) return;
    const key = Math.round(c[1] * 100) + ',' + Math.round(c[0] * 100);
    if (seen.has(key)) return;
    seen.add(key);
    const p = f.properties || {};
    searchResultsData.push({
      lat: c[1], lng: c[0],
      label: [p.name, p.city, p.country].filter(Boolean).join(', '),
      full: [p.name, p.street, p.city, p.state, p.country].filter(Boolean).join(', '),
      type: p.osm_value || '', source: 'Photon'
    });
  });

  // Fly to first result
  if (searchResultsData.length > 0) {
    const first = searchResultsData[0];
    G.pos.lat = first.lat;
    G.pos.lng = first.lng;
    detectCountryFromCoords(first.lat, first.lng);
    if (G.veh === 'train') trainLoadAround();
    if (G.veh === 'bus') loadBusData();
    if (G.veh === 'plane') flyLoadAirports();
    if (G.veh === 'boat') fetchWaterBodies();
    if (showFlights) fetchFlights();
    if (G.overlays.weather) fetchWeather(first.lat, first.lng);
    if (mushroomEnabled) fetchMushrooms(first.lat, first.lng);
    if (wildlifeEnabled) fetchWildlife(first.lat, first.lng);
  }

  showSearchResults();
  showToast('\u{1F4CD} ' + searchResultsData.length + ' places found', '#00ff41');
}

// ── TAB 2: ITEMS / SERVICES (Overpass + open sources) ──
async function searchItems(q) {
  searchResultsData = [];
  const qLower = q.toLowerCase();

  // Detect intent and map to Overpass tags
  let overpassFilter = '';
  let label = q;

  if (qLower.includes('food') || qLower.includes('olio') || qLower.includes('free food')) {
    overpassFilter = 'node["amenity"="food_bank"](around:15000,LAT,LNG);node["social_facility"="food_bank"](around:15000,LAT,LNG);node["amenity"="community_centre"](around:15000,LAT,LNG);';
    label = 'Food banks & community';
  } else if (qLower.includes('doctor') || qLower.includes('health') || qLower.includes('gp') || qLower.includes('hospital') || qLower.includes('nhs')) {
    overpassFilter = 'node["amenity"="doctors"](around:10000,LAT,LNG);node["amenity"="hospital"](around:10000,LAT,LNG);node["amenity"="clinic"](around:10000,LAT,LNG);node["amenity"="pharmacy"](around:10000,LAT,LNG);';
    label = 'Health services';
  } else if (qLower.includes('shop') || qLower.includes('store') || qLower.includes('open') || qLower.includes('supermarket')) {
    overpassFilter = 'node["shop"="supermarket"](around:5000,LAT,LNG);node["shop"="convenience"](around:5000,LAT,LNG);node["shop"="general"](around:5000,LAT,LNG);';
    label = 'Shops nearby';
  } else if (qLower.includes('cafe') || qLower.includes('coffee')) {
    overpassFilter = 'node["amenity"="cafe"](around:5000,LAT,LNG);';
    label = 'Cafes';
  } else if (qLower.includes('library') || qLower.includes('book')) {
    overpassFilter = 'node["amenity"="library"](around:15000,LAT,LNG);';
    label = 'Libraries';
  } else if (qLower.includes('park') || qLower.includes('garden')) {
    overpassFilter = 'node["leisure"="park"](around:10000,LAT,LNG);node["leisure"="garden"](around:10000,LAT,LNG);';
    label = 'Parks & gardens';
  } else if (qLower.includes('toilet') || qLower.includes('wc') || qLower.includes('restroom')) {
    overpassFilter = 'node["amenity"="toilets"](around:5000,LAT,LNG);';
    label = 'Public toilets';
  } else if (qLower.includes('wifi') || qLower.includes('internet')) {
    overpassFilter = 'node["internet_access"="wlan"](around:5000,LAT,LNG);node["amenity"="internet_cafe"](around:5000,LAT,LNG);';
    label = 'Free WiFi spots';
  } else if (qLower.includes('atm') || qLower.includes('bank') || qLower.includes('cash')) {
    overpassFilter = 'node["amenity"="atm"](around:5000,LAT,LNG);node["amenity"="bank"](around:5000,LAT,LNG);';
    label = 'ATMs & banks';
  } else if (qLower.includes('petrol') || qLower.includes('gas') || qLower.includes('fuel')) {
    overpassFilter = 'node["amenity"="fuel"](around:10000,LAT,LNG);';
    label = 'Petrol stations';
  } else if (qLower.includes('charg') || qLower.includes('ev') || qLower.includes('electric')) {
    overpassFilter = 'node["amenity"="charging_station"](around:10000,LAT,LNG);';
    label = 'EV charging';
  } else if (qLower.includes('pub') || qLower.includes('bar') || qLower.includes('beer')) {
    overpassFilter = 'node["amenity"="pub"](around:5000,LAT,LNG);node["amenity"="bar"](around:5000,LAT,LNG);';
    label = 'Pubs & bars';
  } else if (qLower.includes('restaurant') || qLower.includes('eat')) {
    overpassFilter = 'node["amenity"="restaurant"](around:5000,LAT,LNG);';
    label = 'Restaurants';
  } else {
    // Generic amenity search
    overpassFilter = 'node["amenity"](around:5000,LAT,LNG);node["shop"](around:5000,LAT,LNG);';
    label = 'Services near you';
  }

  // Replace LAT,LNG
  overpassFilter = overpassFilter.replace(/LAT/g, G.pos.lat.toFixed(5)).replace(/LNG/g, G.pos.lng.toFixed(5));

  const overpassUrl = 'https://overpass-api.de/api/interpreter?data=[out:json][timeout:10];(' + encodeURIComponent(overpassFilter) + ');out%20center%2030;';

  try {
    const res = await fetch(overpassUrl);
    const data = await res.json();
    (data.elements || []).forEach(el => {
      const lat = el.lat || el.center?.lat;
      const lng = el.lon || el.center?.lon;
      if (!lat || !lng) return;
      const tags = el.tags || {};
      const name = tags.name || tags.amenity || tags.shop || tags.social_facility || 'Unknown';
      const addr = [tags['addr:street'], tags['addr:housenumber'], tags['addr:city']].filter(Boolean).join(', ');
      const hours = tags.opening_hours || '';
      const phone = tags.phone || tags['contact:phone'] || '';
      const website = tags.website || tags['contact:website'] || '';

      searchResultsData.push({
        lat, lng, label: name, full: addr || name,
        type: tags.amenity || tags.shop || '',
        hours, phone, website, source: 'Overpass'
      });
    });
  } catch (e) { /* silent */ }

  showSearchResults();
  showToast('\u{1F6D2} ' + label + ': ' + searchResultsData.length + ' found', '#ff6600');
}

// ── TAB 3: GENERAL (web-style, results in left panel) ──
async function searchGeneral(q) {
  searchResultsData = [];

  // Use Nominatim for geo results
  const nominatimP = fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(q)
    + '&format=json&limit=5&addressdetails=1', { headers: { 'User-Agent': 'ArtSpaceCity/1.0' } })
    .then(r => r.json()).catch(() => []);

  // Use Wikipedia API for knowledge results
  const wikiP = fetch('https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch='
    + encodeURIComponent(q) + '&format=json&origin=*&srlimit=6')
    .then(r => r.json()).catch(() => ({ query: { search: [] } }));

  const [nominatim, wiki] = await Promise.all([nominatimP, wikiP]);

  // Geo results
  nominatim.forEach(r => {
    searchResultsData.push({
      lat: parseFloat(r.lat), lng: parseFloat(r.lon),
      label: r.display_name.split(',').slice(0, 2).join(', '),
      full: r.display_name, type: 'place', source: 'OSM', onMap: true
    });
  });

  // Wiki results (no lat/lng — panel only)
  (wiki.query?.search || []).forEach(r => {
    searchResultsData.push({
      lat: null, lng: null,
      label: r.title,
      full: r.snippet.replace(/<\/?[^>]+(>|$)/g, ''),
      type: 'wiki', source: 'Wikipedia', onMap: false,
      url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(r.title)
    });
  });

  showSearchResults();
  showToast('\u{1F50D} ' + searchResultsData.length + ' results', '#cc44ff');
}

// ══════════════════════════════════════════════════════════════════════
//  LEFT RESULTS PANEL
// ══════════════════════════════════════════════════════════════════════

function showSearchResults() {
  const panel = document.getElementById('searchResultsPanel');
  if (!panel) return;
  searchPanelOpen = true;
  panel.style.display = 'block';

  // Also place map-able results onto the canvas
  G.searchResults = searchResultsData.filter(r => r.lat && r.lng).map(r => ({
    lat: r.lat, lng: r.lng, label: r.label, query: '', fade: 1.0
  }));

  let html = '<div class="srp-head">'
    + '<span class="srp-title">\u{1F50D} ' + searchResultsData.length + ' results</span>'
    + '<button class="srp-close" onclick="closeSearchPanel()">\u2715</button>'
    + '</div>';

  searchResultsData.forEach((r, i) => {
    const mapIcon = r.lat ? '\u{1F4CD}' : '\u{1F4D6}';
    const typeTag = r.type ? '<span class="srp-type">' + r.type + '</span>' : '';
    const srcTag = '<span class="srp-src">' + r.source + '</span>';
    const extras = [];
    if (r.hours) extras.push('\u{1F552} ' + r.hours);
    if (r.phone) extras.push('\u{1F4DE} ' + r.phone);

    html += '<div class="srp-row" onclick="' + (r.lat ? 'flyToResult(' + i + ')' : (r.url ? 'window.open(\'' + r.url + '\',\'_blank\')' : '')) + '">'
      + '<span class="srp-icon">' + mapIcon + '</span>'
      + '<div class="srp-info">'
      + '<div class="srp-name">' + esc(r.label) + '</div>'
      + '<div class="srp-detail">' + esc(r.full || '').slice(0, 80) + '</div>'
      + (extras.length ? '<div class="srp-extras">' + extras.map(e => esc(e)).join(' \u00B7 ') + '</div>' : '')
      + '<div class="srp-tags">' + typeTag + srcTag + '</div>'
      + '</div></div>';
  });

  panel.innerHTML = html;
}

function closeSearchPanel() {
  searchPanelOpen = false;
  const panel = document.getElementById('searchResultsPanel');
  if (panel) panel.style.display = 'none';
}

function flyToResult(idx) {
  const r = searchResultsData[idx];
  if (!r || !r.lat) return;
  G.pos.lat = r.lat;
  G.pos.lng = r.lng;
  showToast('\u{1F4CD} ' + r.label, '#00ff41');
  // Refresh data for new location
  detectCountryFromCoords(r.lat, r.lng);
  if (G.veh === 'train') trainLoadAround();
  if (G.veh === 'bus') loadBusData();
  if (G.veh === 'plane') flyLoadAirports();
  if (G.overlays.weather) fetchWeather(r.lat, r.lng);
  if (mushroomEnabled) fetchMushrooms(r.lat, r.lng);
  if (wildlifeEnabled) fetchWildlife(r.lat, r.lng);
}
