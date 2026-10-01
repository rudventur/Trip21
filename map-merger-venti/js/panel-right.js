// ═══════════════════════════════════════════════════════════════
//  panel-right.js — Snout First Right Panel
//  Tabs: Pack · Family · Home · Vets · Food (LOCKED)
//  Additive only — reads S.pets, writes nothing upstream
// ═══════════════════════════════════════════════════════════════

(function () {

const VETS_KEY   = 'sf_vets_custom';
const FOOD_KEY   = 'sf_food_custom';

// ── Inject HTML ──
function injectRightPanel() {
  const html = `
  <style>
    .rp-root {
      position: fixed; top: 50px; right: 0; bottom: 0;
      width: 230px;
      background: rgba(26,18,10,0.94);
      border-left: 2px solid #cc8833;
      z-index: 950;
      display: flex; flex-direction: column;
      transition: width .2s;
      backdrop-filter: blur(2px);
      font-family: 'VT323', monospace;
    }
    .rp-root.rp-collapsed { width: 26px; }
    .rp-root.lost-mode {
      border-left-color: #ff2222;
      box-shadow: 0 0 18px rgba(255,30,30,0.2);
    }

    .rp-toggle {
      position: absolute; top: 50%; left: -13px;
      transform: translateY(-50%);
      width: 13px; height: 44px;
      background: #cc8833; border-radius: 7px 0 0 7px;
      cursor: pointer; display: flex; align-items: center;
      justify-content: center; z-index: 955;
      font-size: .65rem; color: #1a120a; user-select: none;
    }
    .rp-root.lost-mode .rp-toggle { background: #ff2222; }
    .rp-root.rp-collapsed .rp-inner { opacity: 0; pointer-events: none; }

    .rp-inner { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

    .rp-tabs {
      display: flex; flex-shrink: 0;
      border-bottom: 1.5px solid rgba(204,136,51,0.25);
      overflow-x: auto;
    }
    .rp-tabs::-webkit-scrollbar { height: 0; }
    .rp-tab {
      flex-shrink: 0; padding: 5px 7px;
      color: rgba(255,204,102,0.4); font-size: .7rem;
      cursor: pointer; border-bottom: 2px solid transparent;
      transition: all .12s; white-space: nowrap; position: relative;
      font-family: 'VT323', monospace;
    }
    .rp-tab.active { color: #ffcc66; border-bottom-color: #cc8833; }
    .rp-tab:hover:not(.active) { color: rgba(255,204,102,0.7); }
    .rp-tab-opts {
      position: absolute; top: 2px; right: 1px;
      font-size: .5rem; color: rgba(204,136,51,0.3);
      cursor: pointer; line-height: 1;
    }
    .rp-tab-opts:hover { color: #cc8833; }

    .rp-content { flex: 1; overflow-y: auto; padding: 6px; }

    /* Friend / Family cards */
    .rp-friend {
      background: rgba(0,0,0,0.3);
      border: 1.5px solid rgba(204,136,51,0.22);
      border-radius: 9px; padding: 6px 8px; margin-bottom: 4px;
      cursor: grab; transition: all .12s;
      display: flex; align-items: center; gap: 6px;
    }
    .rp-friend:hover { border-color: #cc8833; background: rgba(204,136,51,0.07); }
    .rp-friend.dragging { opacity: .4; cursor: grabbing; border-color: #ffcc66; }
    .rp-friend.drag-over { border-color: #88cc44; background: rgba(136,204,68,0.07); }
    .rp-fem { font-size: 1.2rem; flex-shrink: 0; }
    .rp-finfo { flex: 1; min-width: 0; }
    .rp-fname {
      font-family: 'Bubblegum Sans', cursive;
      color: #ffcc66; font-size: .8rem;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .rp-fsub { color: rgba(255,204,102,0.4); font-size: .65rem; }
    .rp-fdot { width: 7px; height: 7px; border-radius: 50%; background: #88cc44; flex-shrink: 0; }
    .rp-fdot.away { background: rgba(255,204,102,0.25); }
    .drag-hint {
      color: rgba(255,204,102,0.2); font-size: .63rem;
      text-align: center; padding: 3px; font-style: italic;
      margin-bottom: 4px; font-family: 'VT323', monospace;
    }

    /* Home tab */
    .rp-home-gps {
      background: rgba(136,204,68,0.07);
      border: 1px solid rgba(136,204,68,0.2);
      border-radius: 8px; padding: 7px; margin-bottom: 6px;
    }
    .rp-hg-title { color: #88cc44; font-size: .72rem; margin-bottom: 3px; }
    .rp-hg-coords { color: rgba(255,204,102,0.55); font-size: .7rem; font-family: 'VT323', monospace; }
    .rp-hg-upd { color: rgba(255,204,102,0.28); font-size: .6rem; margin-top: 2px; }
    .rp-set-home {
      width: 100%; padding: 5px;
      background: rgba(204,136,51,0.1);
      border: 1px solid rgba(204,136,51,0.3);
      color: #cc8833; border-radius: 7px; cursor: pointer;
      font-family: 'VT323', monospace; font-size: .72rem;
    }
    .rp-set-home:hover { background: rgba(204,136,51,0.2); }

    /* Link cards (Vets / Food) */
    .rp-link {
      background: rgba(0,0,0,0.3);
      border: 1.5px solid rgba(204,136,51,0.2);
      border-radius: 9px; padding: 6px 8px; margin-bottom: 4px;
      transition: all .12s;
    }
    .rp-link:hover { border-color: rgba(204,136,51,0.5); background: rgba(204,136,51,0.06); }
    .rp-lname {
      font-family: 'Bubblegum Sans', cursive;
      color: #ffcc66; font-size: .78rem;
      display: flex; align-items: center; justify-content: space-between; gap: 4px;
    }
    .rp-lname a {
      color: #ffcc66; text-decoration: none; flex: 1;
    }
    .rp-lname a:hover { color: #fff; text-decoration: underline; }
    .rp-laddr { color: rgba(255,204,102,0.4); font-size: .65rem; margin-top: 2px; }
    .rp-ltags { display: flex; gap: 3px; margin-top: 4px; flex-wrap: wrap; }
    .rp-ltag {
      font-size: .58rem; padding: 1px 5px; border-radius: 4px;
      background: rgba(136,204,68,0.1);
      border: 1px solid rgba(136,204,68,0.25); color: #88cc44;
      font-family: 'VT323', monospace;
    }
    .rp-ltag.em {
      background: rgba(204,51,51,0.1);
      border-color: rgba(204,51,51,0.3); color: #ff6666;
    }
    .rp-ltag.pl {
      background: rgba(204,136,51,0.08);
      border-color: rgba(204,136,51,0.3); color: #cc8833;
    }
    .rp-pin-btn {
      font-size: .6rem; padding: 1px 5px; border-radius: 4px;
      background: rgba(204,136,51,0.1);
      border: 1px solid rgba(204,136,51,0.25); color: #cc8833;
      cursor: pointer; font-family: 'VT323', monospace; flex-shrink: 0;
    }
    .rp-pin-btn:hover { background: rgba(204,136,51,0.2); }

    /* Charity subtle buttons */
    .rp-charity-section {
      margin-top: 10px; padding-top: 8px;
      border-top: 1px solid rgba(204,136,51,0.15);
    }
    .rp-charity-label {
      color: rgba(255,204,102,0.3); font-size: .6rem;
      letter-spacing: 2px; margin-bottom: 5px;
      font-family: 'VT323', monospace;
    }
    .rp-charity-grid { display: flex; flex-wrap: wrap; gap: 4px; }
    .rp-charity-btn {
      font-size: .65rem; padding: 3px 7px; border-radius: 6px;
      background: rgba(0,0,0,0.25);
      border: 1px solid rgba(204,136,51,0.2);
      color: rgba(255,204,102,0.5);
      cursor: pointer; font-family: 'VT323', monospace;
      text-decoration: none; display: inline-block;
      transition: all .12s;
    }
    .rp-charity-btn:hover {
      background: rgba(204,136,51,0.12);
      color: #ffcc66;
      border-color: rgba(204,136,51,0.4);
    }
    .rp-charity-btn.pl {
      border-color: rgba(255,80,80,0.2);
      color: rgba(255,150,150,0.5);
    }
    .rp-charity-btn.pl:hover { color: #ff8888; border-color: rgba(255,80,80,0.4); }

    .rp-add-btn {
      width: 100%; padding: 4px; margin-top: 4px;
      background: rgba(204,136,51,0.06);
      border: 1.5px dashed rgba(204,136,51,0.22);
      color: rgba(204,136,51,0.5); border-radius: 8px;
      cursor: pointer; font-family: 'VT323', monospace; font-size: .7rem;
    }
    .rp-add-btn:hover { background: rgba(204,136,51,0.12); color: #cc8833; }

    /* Family tree placeholder */
    .rp-tree-node {
      display: flex; align-items: center; gap: 6px;
      padding: 5px 7px; margin-bottom: 3px;
      border-left: 2px solid rgba(204,136,51,0.2);
    }
    .rp-tree-node.root { border-left-color: #cc8833; padding-left: 8px; }
    .rp-tree-node.child { margin-left: 14px; border-left-color: rgba(204,136,51,0.15); font-size: .85em; }
    .rp-tree-label { font-family: 'Bubblegum Sans', cursive; color: #ffcc66; font-size: .78rem; }
    .rp-tree-sub { color: rgba(255,204,102,0.35); font-size: .65rem; }

    /* Real vet locator */
    .rp-vet-search { margin-bottom: 8px; }
    .rp-vet-status {
      color: rgba(255,204,102,0.45); font-size: .68rem;
      text-align: center; padding: 4px 2px; font-family: 'VT323', monospace;
      line-height: 1.4;
    }
    .rp-vet-status.err { color: rgba(255,120,120,0.7); }

    /* Doglost embed */
    .rp-doglost-frame {
      width: 100%; height: 220px; border: none;
      border-radius: 8px; margin-top: 6px;
      background: rgba(0,0,0,0.3);
    }
    .rp-doglost-fallback {
      background: rgba(0,0,0,0.3); border-radius: 8px;
      padding: 10px; text-align: center;
      color: rgba(255,204,102,0.4); font-size: .72rem; margin-top: 6px;
    }
  </style>

  <div class="rp-root" id="rpRoot">
    <div class="rp-toggle" id="rpToggleBtn">▶</div>
    <div class="rp-inner">
      <div class="rp-tabs" id="rpTabBar">
        <div class="rp-tab active" data-rptab="mypets">&#128062; My Pets<span class="rp-tab-opts">⚙</span></div>
        <div class="rp-tab" data-rptab="friends">Pack<span class="rp-tab-opts">⚙</span></div>
        <div class="rp-tab" data-rptab="family">Family<span class="rp-tab-opts">⚙</span></div>
        <div class="rp-tab" data-rptab="home">Home<span class="rp-tab-opts">⚙</span></div>
        <div class="rp-tab" data-rptab="vets">Vets<span class="rp-tab-opts">⚙</span></div>
        <div class="rp-tab" data-rptab="food">Food<span class="rp-tab-opts">⚙</span></div>
      </div>
      <div class="rp-content" id="rpContent"></div>
    </div>
  </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
}

// ── Data ──
const FRIENDS_DATA = [
  { e:'🐕', n:'Rex', o:'Mia · dog', s:'online', species:'dog' },
  { e:'🐩', n:'Biscuit', o:'Tom · dog', s:'away', species:'dog' },
  { e:'🐈', n:'Luna', o:'Sara · cat', s:'online', species:'cat' },
];

const FAMILY_TREE = [
  { e:'🐶', n:'Grandpaw', rel:'patriarch', level:'root' },
  { e:'🐶', n:'Young', rel:'son', level:'child' },
  { e:'🐶', n:'Booboo', rel:'son', level:'child' },
  { e:'🐱', n:'Ferajna', rel:'adopted chaos', level:'child' },
];

const VETS_DEFAULT = [
  { n:'City Vet Clinic', a:'12 Park Rd, London', url:'https://maps.google.com/?q=vet+near+me', tags:['24h','emergency'], pinned:true },
  { n:'Paws & Claws', a:'88 High St, London', url:'https://maps.google.com/?q=paws+claws+vet', tags:['cats','dogs','rabbits'], pinned:false },
];

// Real emergency contacts — shown first, always visible, not dependent on location
const EMERGENCY_UK = [
  { label:'🚨 Vets Now (24h Emergency)', url:'https://www.vets-now.com/find-a-clinic/' },
  { label:'☠️ Animal PoisonLine', url:'https://www.animalpoisonline.co.uk' },
  { label:'🐾 RSPCA 24h Cruelty Line', url:'https://www.rspca.org.uk/whatwedo/contactus' },
];

// FOOD TAB — LOCKED AS HOLY GRAIL
const FOOD_DATA = [
  { n:'East London Pet Food Bank', a:'Whitechapel Community Hub', url:'https://www.eastlondonpetfoodbank.org', tags:['dogs','cats','free'], pinned:true },
  { n:'RSPCA Foodshare', a:'rspca.org.uk', url:'https://www.rspca.org.uk', tags:['all pets','national'], pinned:false },
  { n:'Hackney Animal Aid', a:'Hackney, E8', url:'https://maps.google.com/?q=hackney+animal+aid', tags:['emergency','local'], pinned:false },
];

const CHARITIES_UK = [
  { label:'RSPCA', url:'https://www.rspca.org.uk' },
  { label:'PDSA', url:'https://www.pdsa.org.uk' },
  { label:'Blue Cross', url:'https://www.bluecross.org.uk' },
  { label:'Dogs Trust', url:'https://www.dogstrust.org.uk' },
  { label:"Cats Protection", url:'https://www.cats.org.uk' },
  { label:'DogLost', url:'https://www.doglost.co.uk' },
  { label:'Freeads Pets', url:'https://www.freeads.co.uk/pets' },
  { label:'Battersea', url:'https://www.battersea.org.uk' },
  { label:'Woodgreen', url:'https://www.woodgreen.org.uk' },
  { label:'International Cat Care', url:'https://icatcare.org' },
  { label:'Animal Trust (low-cost vets)', url:'https://www.animaltrust.org.uk' },
];

const CHARITIES_PL = [
  { label:'Psia Krew 🇵🇱', url:'https://fundacjapsiakrew.pl' },
  { label:'Animal Helper 🇵🇱', url:'https://www.animalhelper.pl' },
  { label:'RatujemyZwierzaki 🇵🇱', url:'https://www.ratujemyzwierzaki.pl' },
  { label:'Fundacja Viva! 🇵🇱', url:'https://www.viva.org.pl' },
  { label:'OTOZ Animals 🇵🇱', url:'https://www.otoz.pl' },
];

// ── State ──
let rpOpen = true;
let rpActiveTab = 'mypets';

// A pet with no registered_by only exists in this browser, so it's inherently "mine".
// A pet registered through Firebase is only mine if I'm the one who registered it.
function isMyPet(pet) {
  if (!pet) return false;
  if (pet.registered_by) return typeof getUid === 'function' && pet.registered_by === getUid();
  return true;
}
let rpNearbyVets = [];
let rpNearbySearchCenter = null;
let rpNearbyLoading = false;
let rpNearbyError = '';

// ── Real vet locator (OpenStreetMap Overpass API — free, no key) ──
function rpGetGeoPosition() {
  const geoCall = new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('no geolocation')); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => reject(err),
      { timeout: 8000 }
    );
  });
  // Some browsers never call back at all if a permission prompt sits unanswered
  // (backgrounded tab, locked-down config) — geolocation's own `timeout` option
  // doesn't cover that wait, so a hard client-side ceiling keeps the button from
  // getting stuck on "Sniffing out nearby vets..." forever.
  const hardCeiling = new Promise((_, reject) => setTimeout(() => reject(new Error('geo timeout')), 10000));
  return Promise.race([geoCall, hardCeiling]);
}

async function rpFetchNearbyVets(lat, lon, radius) {
  radius = radius || 8000; // metres
  const query = `[out:json][timeout:15];(node["amenity"="veterinary"](around:${radius},${lat},${lon});way["amenity"="veterinary"](around:${radius},${lat},${lon}););out center;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: query });
  if (!res.ok) throw new Error('bad response: ' + res.status);
  const data = await res.json();
  const results = (data.elements || []).map(el => {
    const elat = el.lat ?? (el.center && el.center.lat);
    const elon = el.lon ?? (el.center && el.center.lon);
    if (elat == null || elon == null) return null;
    const dist = (typeof haversine === 'function') ? haversine({ lat, lng: lon }, { lat: elat, lng: elon }) : null;
    return {
      name: (el.tags && el.tags.name) || 'Unnamed vet clinic',
      lat: elat, lon: elon,
      phone: (el.tags && (el.tags.phone || el.tags['contact:phone'])) || '',
      dist
    };
  }).filter(Boolean);
  results.sort((a, b) => (a.dist ?? 1e9) - (b.dist ?? 1e9));
  return results.slice(0, 10);
}

window.rpSearchNearbyVets = async function(useGeo) {
  rpNearbyLoading = true;
  rpNearbyError = '';
  rpRender();
  try {
    let lat, lon, label;
    if (useGeo) {
      const pos = await rpGetGeoPosition();
      lat = pos.lat; lon = pos.lon; label = 'your location';
    } else {
      lat = (typeof S !== 'undefined') ? S.lat : 51.505;
      lon = (typeof S !== 'undefined') ? S.lon : -0.09;
      label = 'the map centre';
    }
    rpNearbySearchCenter = { lat, lon, label };
    rpNearbyVets = await rpFetchNearbyVets(lat, lon);
    if (!rpNearbyVets.length) {
      rpNearbyError = `No vets found in OpenStreetMap near ${label} — try panning somewhere more built-up 🐾`;
    }
  } catch (e) {
    rpNearbyVets = [];
    rpNearbyError = useGeo
      ? "Couldn't get your location — check location permissions 🐾"
      : "Couldn't sniff out nearby vets — check your connection 🐾";
  }
  rpNearbyLoading = false;
  rpRender();
};

window.rpPinNearbyVet = function(i) {
  const v = rpNearbyVets[i];
  if (!v) return;
  if (typeof addServicePin === 'function') addServicePin('vet', v.name, v.lat, v.lon);
};

function rpToggle() {
  rpOpen = !rpOpen;
  document.getElementById('rpRoot').classList.toggle('rp-collapsed', !rpOpen);
  document.getElementById('rpToggleBtn').textContent = rpOpen ? '▶' : '◀';
}

function rpSwitchTab(tab) {
  rpActiveTab = tab;
  document.querySelectorAll('.rp-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.rptab === tab)
  );
  rpRender();
}

function rpRender() {
  const el = document.getElementById('rpContent');
  if (!el) return;
  switch (rpActiveTab) {
    case 'mypets':  el.innerHTML = rpRenderMyPets();  break;
    case 'friends': el.innerHTML = rpRenderFriends(); break;
    case 'family':  el.innerHTML = rpRenderFamily();  break;
    case 'home':    el.innerHTML = rpRenderHome();    break;
    case 'vets':    el.innerHTML = rpRenderVets();    break;
    case 'food':    el.innerHTML = rpRenderFood();    break;
  }
  rpBindDrag();
}

// ── My Pets (protected — view/wag/go only, no delete or lost-toggle here) ──
function rpRenderMyPets() {
  const pets = ((typeof S !== 'undefined' ? S.pets : []) || []).filter(isMyPet);
  if (!pets.length) {
    return '<div style="color:rgba(255,204,102,0.35);text-align:center;padding:16px;font-size:.8rem">No pets of yours yet.<br>Pin one on the map to see it here! 🐾</div>';
  }
  return '<div class="drag-hint">these are yours — manage them from the left panel</div>' +
    pets.map(p => {
      const idx = S.pets.indexOf(p);
      const em = (typeof SPECIES_EM !== 'undefined' ? SPECIES_EM[p.species] : '') || '🐾';
      return `<div class="rp-link">
        <div class="rp-lname">
          <span>${em} ${p.name}</span>
          <span class="rp-pin-btn" onclick="if(typeof panToPet==='function')panToPet(${idx})">🎯 Go</span>
        </div>
        <div class="rp-laddr">${p.breed || p.species || ''}${p.mood ? ' · ' + (typeof MOOD_EM !== 'undefined' ? MOOD_EM[p.mood] : '') + ' ' + p.mood : ''}</div>
        ${p.bio ? `<div class="rp-laddr" style="font-style:italic">"${p.bio}"</div>` : ''}
      </div>`;
    }).join('');
}

// ── Friends ──
function rpRenderFriends() {
  const pets = (typeof S !== 'undefined' ? S.pets : []) || [];
  // Mix Firebase friends with demo data
  const cards = FRIENDS_DATA.map((f, i) =>
    `<div class="rp-friend" draggable="true" data-fi="${i}">
      <span class="rp-fem">${f.e}</span>
      <div class="rp-finfo">
        <div class="rp-fname">${f.n}</div>
        <div class="rp-fsub">${f.o}</div>
      </div>
      <div class="rp-fdot ${f.s === 'away' ? 'away' : ''}"></div>
    </div>`
  ).join('');
  return `<div class="drag-hint">grab a pet → drop to left panel</div>${cards}`;
}

// ── Family tree ──
function rpRenderFamily() {
  return FAMILY_TREE.map(n =>
    `<div class="rp-tree-node ${n.level}">
      <span>${n.e}</span>
      <div>
        <div class="rp-tree-label">${n.n}</div>
        <div class="rp-tree-sub">${n.rel}</div>
      </div>
    </div>`
  ).join('') +
  `<div style="color:rgba(255,204,102,0.2);font-size:.62rem;text-align:center;margin-top:8px;font-family:'VT323',monospace">
    Family tree builder coming soon 🐾
  </div>`;
}

// ── Home ──
function rpRenderHome() {
  const lat = (typeof S !== 'undefined' && S.lat) ? S.lat.toFixed(4) : '51.5120';
  const lon = (typeof S !== 'undefined' && S.lon) ? S.lon.toFixed(4) : '-0.0900';
  const saved = JSON.parse(localStorage.getItem('sf_home') || 'null');
  const hLat = saved ? saved.lat.toFixed(4) : lat;
  const hLon = saved ? saved.lon.toFixed(4) : lon;
  const ago = saved ? rpTimeAgo(saved.ts) : 'not set';
  return `
    <div class="rp-home-gps">
      <div class="rp-hg-title">📍 Home GPS anchor</div>
      <div class="rp-hg-coords">${hLat}° N · ${hLon}° W</div>
      <div class="rp-hg-upd">set ${ago} · <span id="rpAutoGPS" style="cursor:pointer;color:${rpIsAutoGpsOn() ? '#88cc44' : 'rgba(136,204,68,0.5)'}" onclick="rpToggleAutoGPS()">auto ${rpIsAutoGpsOn() ? 'on' : 'off'}</span></div>
    </div>
    <button class="rp-set-home" onclick="rpSetHome()">📍 Set current location as home</button>
    <div style="color:rgba(255,204,102,0.25);font-size:.62rem;margin-top:6px;font-family:'VT323',monospace;line-height:1.4">
      Home anchor is used as the base for all pets.<br>Override per-pet in the left GPS tab.
    </div>`;
}

window.rpSetHome = function() {
  if (typeof S === 'undefined') return;
  const home = { lat: S.lat, lon: S.lon, ts: Date.now() };
  localStorage.setItem('sf_home', JSON.stringify(home));
  if (typeof toast === 'function') toast('🏠 Home location saved!');
  rpRender();
};

let rpAutoGpsWatchId = null;
function rpIsAutoGpsOn() {
  return localStorage.getItem('sf_home_auto') === '1';
}

window.rpToggleAutoGPS = function() {
  if (rpIsAutoGpsOn()) rpStopAutoGPS();
  else rpStartAutoGPS();
};

function rpStartAutoGPS() {
  if (!navigator.geolocation) {
    if (typeof toast === 'function') toast('GPS not supported by this browser 🐾');
    return;
  }
  rpAutoGpsWatchId = navigator.geolocation.watchPosition(
    pos => {
      localStorage.setItem('sf_home', JSON.stringify({
        lat: pos.coords.latitude, lon: pos.coords.longitude, ts: Date.now()
      }));
      if (rpActiveTab === 'home') rpRender();
    },
    err => { if (typeof toast === 'function') toast('Auto-GPS error: ' + err.message); },
    { enableHighAccuracy: false, maximumAge: 30000 }
  );
  localStorage.setItem('sf_home_auto', '1');
  if (typeof toast === 'function') toast('📍 Auto-GPS on — home anchor will follow you');
  rpRender();
}

function rpStopAutoGPS() {
  if (rpAutoGpsWatchId != null && navigator.geolocation) navigator.geolocation.clearWatch(rpAutoGpsWatchId);
  rpAutoGpsWatchId = null;
  localStorage.setItem('sf_home_auto', '0');
  if (typeof toast === 'function') toast('📍 Auto-GPS off');
  rpRender();
}

// Resume tracking if it was left on from a previous session
if (rpIsAutoGpsOn()) rpStartAutoGPS();

// ── Vets ──
function rpRenderVets() {
  const custom = JSON.parse(localStorage.getItem(VETS_KEY) || '[]');
  const all = [...VETS_DEFAULT, ...custom];

  const emergencySection = `
    <div class="rp-charity-section" style="margin-top:0;border:1px solid rgba(255,60,60,0.35);border-radius:8px;padding:6px 6px 4px;background:rgba(255,30,30,0.06)">
      <div class="rp-charity-label" style="color:#ff8888">🚨 EMERGENCY — CALL FIRST</div>
      <div class="rp-charity-grid">
        ${EMERGENCY_UK.map(c => `<a class="rp-charity-btn" style="border-color:rgba(255,80,80,0.4);color:#ff9999" href="${c.url}" target="_blank" rel="noopener">${c.label}</a>`).join('')}
      </div>
    </div>`;
  const cards = all.map((v, i) =>
    `<div class="rp-link">
      <div class="rp-lname">
        <a href="${v.url}" target="_blank" rel="noopener">🏥 ${v.n}</a>
        <span class="rp-pin-btn" onclick="rpPinOnMap('vet',${i},'${v.n}')">
          ${v.pinned ? '📍' : '+ map'}
        </span>
      </div>
      <div class="rp-laddr">${v.a}</div>
      <div class="rp-ltags">
        ${v.tags.map(t => `<span class="rp-ltag ${t==='emergency'||t==='24h'?'em':''}">${t}</span>`).join('')}
      </div>
    </div>`
  ).join('');

  const nearbyCards = rpNearbyVets.map((v, i) =>
    `<div class="rp-link">
      <div class="rp-lname">
        <a href="https://www.google.com/maps?q=${v.lat},${v.lon}" target="_blank" rel="noopener">🏥 ${v.name}</a>
        <span class="rp-pin-btn" onclick="rpPinNearbyVet(${i})">+ map</span>
      </div>
      <div class="rp-laddr">${v.dist != null ? v.dist.toFixed(1) + ' km away' : 'distance unknown'}${v.phone ? ' · 📞 ' + v.phone : ''}</div>
    </div>`
  ).join('');

  const searchSection = `
    <div class="rp-vet-search">
      <div class="rp-charity-label">🔎 FIND VETS NEARBY (live)</div>
      <div style="display:flex;gap:4px;margin-bottom:4px">
        <button class="rp-add-btn" style="flex:1;margin:0" onclick="rpSearchNearbyVets(false)">🗺️ Near map centre</button>
        <button class="rp-add-btn" style="flex:1;margin:0" onclick="rpSearchNearbyVets(true)">📍 Near me</button>
      </div>
      ${rpNearbyLoading ? '<div class="rp-vet-status">🐾 Sniffing out nearby vets...</div>' : ''}
      ${!rpNearbyLoading && rpNearbyError ? `<div class="rp-vet-status err">${rpNearbyError}</div>` : ''}
      ${!rpNearbyLoading && !rpNearbyError && rpNearbySearchCenter && rpNearbyVets.length
        ? `<div class="rp-vet-status">Found ${rpNearbyVets.length} near ${rpNearbySearchCenter.label} · via OpenStreetMap</div>`
        : ''}
      ${nearbyCards}
    </div>
  `;

  const ukCharities = CHARITIES_UK.map(c =>
    `<a class="rp-charity-btn" href="${c.url}" target="_blank" rel="noopener">${c.label}</a>`
  ).join('');
  const plCharities = CHARITIES_PL.map(c =>
    `<a class="rp-charity-btn pl" href="${c.url}" target="_blank" rel="noopener">${c.label}</a>`
  ).join('');

  // DogLost embed attempt
  const doglostSection = `
    <div style="margin-top:8px;border-top:1px solid rgba(204,136,51,0.15);padding-top:6px">
      <div class="rp-charity-label">🐾 DOGLOST MAP</div>
      <a class="rp-charity-btn" href="https://www.doglost.co.uk/map" target="_blank" rel="noopener" style="display:block;text-align:center;margin-bottom:5px">
        Open DogLost Map ↗
      </a>
      <div class="rp-doglost-fallback" id="rpDoglostEmbed">
        🗺️ DogLost map tiles will load here<br>
        <span style="font-size:.6rem;opacity:.5">(embed blocked by CORS — opening in new tab is the fallback)</span>
      </div>
    </div>`;

  return emergencySection + searchSection +
    `<div class="rp-charity-section" style="margin-top:2px">
      <div class="rp-charity-label">⭐ TRUSTED / SAVED</div>
      ${cards}
      <button class="rp-add-btn" onclick="rpAddVet()">+ add vet / clinic</button>
    </div>` +
    `<div class="rp-charity-section">
      <div class="rp-charity-label">🇬🇧 UK ORGANISATIONS</div>
      <div class="rp-charity-grid">${ukCharities}</div>
    </div>
    <div class="rp-charity-section">
      <div class="rp-charity-label">🇵🇱 POLISH ORGS</div>
      <div class="rp-charity-grid">${plCharities}</div>
    </div>
    ${doglostSection}`;
}

window.rpAddVet = function() {
  const n = prompt('Vet / clinic name:');
  if (!n) return;
  const a = prompt('Address or website:') || '';
  const u = prompt('URL (https://...):') || '#';
  const custom = JSON.parse(localStorage.getItem(VETS_KEY) || '[]');
  custom.push({ n, a, url: u, tags: ['custom'], pinned: false });
  localStorage.setItem(VETS_KEY, JSON.stringify(custom));
  rpRender();
  if (typeof toast === 'function') toast('🏥 Vet added!');
};

// ── Food (LOCKED AS HOLY GRAIL) ──
function rpRenderFood() {
  const cards = FOOD_DATA.map((f, i) =>
    `<div class="rp-link">
      <div class="rp-lname">
        <a href="${f.url}" target="_blank" rel="noopener">🥣 ${f.n}</a>
        <span class="rp-pin-btn" onclick="rpPinOnMap('food',${i},'${f.n}')">
          ${f.pinned ? '📍' : '+ map'}
        </span>
      </div>
      <div class="rp-laddr">${f.a}</div>
      <div class="rp-ltags">
        ${f.tags.map(t => `<span class="rp-ltag">${t}</span>`).join('')}
      </div>
    </div>`
  ).join('');

  const ukCharities = CHARITIES_UK.map(c =>
    `<a class="rp-charity-btn" href="${c.url}" target="_blank" rel="noopener">${c.label}</a>`
  ).join('');

  return cards +
    `<button class="rp-add-btn" onclick="rpAddFood()">+ add food bank</button>` +
    `<div class="rp-charity-section">
      <div class="rp-charity-label">🇬🇧 UK RESOURCES</div>
      <div class="rp-charity-grid">${ukCharities}</div>
    </div>`;
}

window.rpAddFood = function() {
  const n = prompt('Food bank name:');
  if (!n) return;
  const a = prompt('Address:') || '';
  const u = prompt('URL (https://...):') || '#';
  const custom = JSON.parse(localStorage.getItem(FOOD_KEY) || '[]');
  custom.push({ n, a, url: u, tags: ['custom'], pinned: false });
  localStorage.setItem(FOOD_KEY, JSON.stringify(custom));
  rpRender();
  if (typeof toast === 'function') toast('🥣 Food bank added!');
};

// ── Pin on map ──
window.rpPinOnMap = function(type, idx, name) {
  // Tells panel-drag / lost-zone to place a map marker
  if (typeof addServicePin === 'function') {
    addServicePin(type, name);
  } else {
    if (typeof toast === 'function') toast(`📍 ${name} pinned to map (placeholder)`);
  }
};

// ── Drag from right panel ──
function rpBindDrag() {
  document.querySelectorAll('.rp-friend[draggable]').forEach((card, i) => {
    card.addEventListener('dragstart', e => {
      const f = FRIENDS_DATA[+card.dataset.fi] || {};
      e.dataTransfer.setData('sfPet', JSON.stringify({
        name: f.n, species: f.species || 'dog',
        breed: f.o || '', e: f.e
      }));
      e.dataTransfer.setData('pet', JSON.stringify({ name: f.n, e: f.e, o: f.o, species: f.species }));
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });
}

// ── Helpers ──
function rpTimeAgo(ts) {
  if (!ts) return 'never';
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

// ── Lost mode sync ──
window.rpSetLostMode = function(on) {
  document.getElementById('rpRoot').classList.toggle('lost-mode', on);
};

// ── Public ──
window.rpRefresh = rpRender;
window.rpSwitchTab = rpSwitchTab;

// ── Init ──
function init() {
  injectRightPanel();
  document.getElementById('rpToggleBtn').addEventListener('click', rpToggle);
  document.getElementById('rpTabBar').addEventListener('click', e => {
    const tab = e.target.closest('.rp-tab');
    if (!tab) return;
    rpSwitchTab(tab.dataset.rptab);
  });
  rpRender();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
