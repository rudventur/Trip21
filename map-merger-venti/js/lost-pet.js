// ═══════════════════════════════════════════════════════════════
//  lost-pet.js — Lost Pet Core
//  Handles: lost state, UI emergency mode, ArtSpace City hook
//  Additive only — reads/writes S.pets via savePets()
// ═══════════════════════════════════════════════════════════════

(function () {

const LOST_KEY = 'sf_lost_pets';

// ── Load persisted lost state ──
function loadLostState() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOST_KEY) || '[]');
    if (typeof S !== 'undefined' && S.pets) {
      saved.forEach(lostName => {
        const p = S.pets.find(x => x.name === lostName);
        if (p) { p.lost = true; }
      });
    }
    return saved;
  } catch(e) { return []; }
}

function saveLostState() {
  try {
    if (typeof S === 'undefined') return;
    const lostNames = S.pets.filter(p => p.lost).map(p => p.name);
    localStorage.setItem(LOST_KEY, JSON.stringify(lostNames));
  } catch(e) {}
}

// ── Emergency UI mode ──
const LOST_CSS = `
  .sf-lost-active body,
  .sf-lost-active .hud {
    border-color: #ff2222 !important;
  }
  .sf-lost-active .hud {
    background: rgba(40,5,5,0.97) !important;
    box-shadow: 0 0 28px rgba(255,20,20,0.35) !important;
    animation: lm-hud-pulse 1.8s infinite;
  }
  .sf-lost-active #snoutMap {
    filter: sepia(0.3) saturate(1.2) hue-rotate(300deg) brightness(0.95) !important;
  }
  @keyframes lm-hud-pulse {
    0%,100% { box-shadow: 0 0 18px rgba(255,20,20,0.25); }
    50%      { box-shadow: 0 0 38px rgba(255,20,20,0.55); }
  }
  .sf-lost-banner {
    position: fixed; top: 50px; left: 0; right: 0;
    background: rgba(40,0,0,0.92);
    border-bottom: 2px solid #ff2222;
    color: #ff4444; font-family: 'Bubblegum Sans', cursive;
    font-size: .95rem; text-align: center; padding: 5px;
    z-index: 999; animation: lm-hud-pulse 1.8s infinite;
    text-shadow: 0 0 8px rgba(255,30,30,0.6);
    letter-spacing: 1px;
  }
`;

let lostStyleEl = null;
let lostBannerEl = null;

window.activateLostMode = function(pet) {
  // Inject emergency CSS
  if (!lostStyleEl) {
    lostStyleEl = document.createElement('style');
    lostStyleEl.id = 'sf-lost-style';
    lostStyleEl.textContent = LOST_CSS;
    document.head.appendChild(lostStyleEl);
  }
  document.documentElement.classList.add('sf-lost-active');

  // Banner
  if (!lostBannerEl) {
    lostBannerEl = document.createElement('div');
    lostBannerEl.id = 'sfLostBanner';
    lostBannerEl.className = 'sf-lost-banner';
    document.body.appendChild(lostBannerEl);
  }
  lostBannerEl.innerHTML =
    `🔴 ${pet.name} IS LOST — Last seen: ${pet.lostLat ? pet.lostLat.toFixed(4) : '?'}° N · ${pet.lostLon ? pet.lostLon.toFixed(4) : '?'}° W &nbsp;|&nbsp;
     <span style="cursor:pointer;text-decoration:underline" onclick="window.lpMarkFound && lpMarkFound(${(typeof S !== 'undefined' ? S.pets.indexOf(pet) : 0)})">✅ MARK FOUND</span>`;

  // Sync panels
  if (typeof lpRefresh === 'function') lpRefresh();
  if (typeof rpSetLostMode === 'function') rpSetLostMode(true);

  // Draw zone
  if (typeof drawLostZone === 'function') drawLostZone(pet);

  // Push to ArtSpace City (placeholder hook)
  pushToArtSpaceCity(pet);

  // Firebase broadcast (placeholder)
  broadcastLostToFirebase(pet);

  saveLostState();
};

window.deactivateLostMode = function() {
  document.documentElement.classList.remove('sf-lost-active');
  if (lostBannerEl) { lostBannerEl.remove(); lostBannerEl = null; }
  if (typeof rpSetLostMode === 'function') rpSetLostMode(false);
  if (typeof clearLostZone === 'function') clearLostZone();
  saveLostState();

  // Celebration toast
  setTimeout(() => {
    if (typeof toast === 'function') toast('🎉 So happy they\'re home safe! 🐾🐾🐾');
  }, 300);
};

// ── ArtSpace City crossover ──
function pushToArtSpaceCity(pet) {
  // PLACEHOLDER — when ArtSpace City adds a lost-pet layer:
  // window.parent.postMessage({ type: 'SF_LOST_PET', pet }, '*');
  // or: artSpaceCityAddPin({ type:'lost', ...pet });
  // For now, write to localStorage so ArtSpace can read it
  try {
    const existing = JSON.parse(localStorage.getItem('artspace_lost_pets') || '[]');
    const idx = existing.findIndex(p => p.name === pet.name);
    const entry = {
      name: pet.name, species: pet.species,
      lat: pet.lostLat, lon: pet.lostLon,
      lostAt: pet.lostAt, active: true
    };
    if (idx >= 0) existing[idx] = entry;
    else existing.push(entry);
    localStorage.setItem('artspace_lost_pets', JSON.stringify(existing));
    // PLACEHOLDER: ArtSpace City will read 'artspace_lost_pets' on its map init
    console.log('[SnoutFirst] Lost pet written to artspace_lost_pets localStorage key');
  } catch(e) {}
}

// ── Firebase broadcast (placeholder) ──
function broadcastLostToFirebase(pet) {
  // PLACEHOLDER — replace with actual Firebase write:
  // db.ref('snoutfirst/lost/' + pet._fbId || pet.name).set({
  //   name: pet.name, lat: pet.lostLat, lon: pet.lostLon,
  //   lostAt: pet.lostAt, active: true
  // });
  if (typeof db !== 'undefined' && db) {
    try {
      const key = (pet._fbId || pet.name.replace(/\s+/g, '_')).toLowerCase();
      db.ref('snoutfirst/lost/' + key).set({
        name: pet.name, species: pet.species,
        lat: pet.lostLat, lon: pet.lostLon,
        lostAt: pet.lostAt, active: true,
        owner: localStorage.getItem('rv_username') || 'anonymous'
      });
    } catch(e) { console.warn('[lost-pet] Firebase write failed:', e); }
  }
}

// ── Check on load if any pets were lost ──
function checkOnLoad() {
  setTimeout(() => {
    loadLostState();
    if (typeof S !== 'undefined' && S.pets) {
      const lostPet = S.pets.find(p => p.lost);
      if (lostPet) {
        if (typeof toast === 'function') toast(`🔴 ${lostPet.name} is still marked as LOST`);
        window.activateLostMode(lostPet);
      }
    }
  }, 1200); // after firebase sync
}

checkOnLoad();

})();
