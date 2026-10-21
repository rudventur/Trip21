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
    position: fixed; top: var(--bar-h, 50px); left: 0; right: 0;
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
    `🔴 ${escHtml(pet.name)} IS LOST — Last seen: ${pet.lostLat ? pet.lostLat.toFixed(4) : '?'}° N · ${pet.lostLon ? pet.lostLon.toFixed(4) : '?'}° W &nbsp;|&nbsp;
     <span style="cursor:pointer;text-decoration:underline" onclick="window.lpMarkFound && lpMarkFound(${(typeof S !== 'undefined' ? S.pets.indexOf(pet) : 0)})">✅ MARK FOUND</span>`;

  // Sync panels
  if (typeof lpRefresh === 'function') lpRefresh();
  if (typeof rpSetLostMode === 'function') rpSetLostMode(true);

  // Draw zone
  if (typeof drawLostZone === 'function') drawLostZone(pet);

  // Show it in ArtSpace City too (lost-pets.js there reads 'artspace_lost_pets')
  pushToArtSpaceCity(pet);

  // Share the report on the network (your own pets only, rounded position)
  broadcastLostToFirebase(pet);

  saveLostState();
};

window.deactivateLostMode = function() {
  document.documentElement.classList.remove('sf-lost-active');
  if (lostBannerEl) { lostBannerEl.remove(); lostBannerEl = null; }
  if (typeof rpSetLostMode === 'function') rpSetLostMode(false);
  if (typeof clearLostZone === 'function') clearLostZone();
  saveLostState();
  setTimeout(pushToArtSpaceCity, 0); // after the found pet's lost flag is cleared

  // Celebration toast
  setTimeout(() => {
    if (typeof toast === 'function') toast('🎉 So happy they\'re home safe! 🐾🐾🐾');
  }, 300);
};

// ── ArtSpace City crossover ──
function pushToArtSpaceCity(justLost) {
  // ArtSpace City (index.html, lost-pets.js) draws every entry of this key on its map and
  // follows changes, also when both pages are open side by side. Written from the pets that
  // are lost right now, so a found pet disappears from there as well.
  try {
    const pets = (typeof S !== 'undefined' && S.pets) || [];
    const list = pets.filter(p => (p.lost || p === justLost) && isFinite(p.lostLat) && isFinite(p.lostLon)).map(p => ({
      name: String(p.name || '').slice(0, 40), species: p.species,
      lat: +p.lostLat, lon: +p.lostLon, lostAt: p.lostAt || Date.now(), active: true
    }));
    localStorage.setItem('artspace_lost_pets', JSON.stringify(list));
  } catch(e) {}
}

// ── Firebase broadcast ──
// Only your own pets are broadcast, under a key tied to your uid, with the
// last-seen spot rounded to about 100 m. The database rules check owner_uid.
function isMine(pet) {
  return !pet.registered_by || pet.registered_by === getUid();
}
function lostKeyFor(pet) {
  if (pet._fbId) return safeId(pet._fbId);
  const slug = String(pet.name || 'pet').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30);
  return safeId(getUid() + '_' + slug);
}
function broadcastLostToFirebase(pet) {
  if (typeof isSharing !== 'function' || !isSharing() || !isMine(pet)) return;
  const data = {
    name: String(pet.name || '').slice(0, 40),
    species: String(pet.species || 'other').slice(0, 20),
    lostAt: firebase.database.ServerValue.TIMESTAMP,
    active: true,
    owner: getUserName(),
    owner_uid: getUid()
  };
  if (isFinite(pet.lostLat) && isFinite(pet.lostLon)) {
    data.lat = roundShared(pet.lostLat);
    data.lon = roundShared(pet.lostLon);
  }
  db.ref('snoutfirst/lost/' + lostKeyFor(pet)).set(data)
    .catch(e => console.warn('[lost-pet] Firebase write failed:', e));
}
// Found again: take the report down (your own pets only).
window.clearLostFromFirebase = function(pet) {
  if (!pet || typeof isSharing !== 'function' || !isSharing() || !isMine(pet)) return;
  db.ref('snoutfirst/lost/' + lostKeyFor(pet)).remove()
    .catch(e => console.warn('[lost-pet] Firebase remove failed:', e));
};

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
