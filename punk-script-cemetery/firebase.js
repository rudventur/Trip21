// ─── RudVentur Social — Firebase Helper ───
//
// Profiles live in the shared RUDVENTUR Firebase project (the PopCOIN project, the same
// one the useRbox uses for rooms and channels). Its web config comes from
// https://rudventur.github.io/RudVentur.com/popcoin/config.js (window.POPCOIN_FIREBASE),
// loaded by the page before this file, together with firebase-auth-compat.
// Everyone signs in anonymously; your profile is stored under your sign-in id at
// rudventur-social/profiles/<uid>, and the database rules (RudVentur.com
// popcoin/database.rules.json) only let you write your own. Anyone can read them.
// Without a connection, profiles are still cached on this device.

const socialApp = (function () {
  if (!window.firebase || !window.POPCOIN_FIREBASE) return null;
  return firebase.apps.filter(a => a.name === 'rvsocial')[0] || firebase.initializeApp(window.POPCOIN_FIREBASE, 'rvsocial');
})();
const db = socialApp ? socialApp.database() : null;

// resolves with this browser's sign-in id (also kept in localStorage for invite links)
const socialReady = new Promise(function (resolve, reject) {
  if (!socialApp || typeof socialApp.auth !== 'function') { reject(new Error('offline')); return; }
  const auth = socialApp.auth();
  auth.onAuthStateChanged(function (user) {
    if (user) { localStorage.setItem('rudventur-social-uid', user.uid); resolve(user.uid); }
  });
  auth.signInAnonymously().catch(reject);
});
socialReady.catch(function (e) { console.warn('RudVentur Social offline:', e && e.message); });

// ─── UID management ───
// The id is the anonymous sign-in id once known; until then a local one, replaced on sign-in.
function getOrCreateUID() {
  let uid = localStorage.getItem('rudventur-social-uid');
  if (!uid) {
    uid = 'rv-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 6);
    localStorage.setItem('rudventur-social-uid', uid);
  }
  return uid;
}

function getMyUID() {
  return localStorage.getItem('rudventur-social-uid');
}

// ─── Profile CRUD ───
// Saves as the signed-in user (the uid argument is kept for older callers); resolves with the uid used.
function saveProfile(uid, data) {
  return socialReady.then(function (me) {
    return db.ref('rudventur-social/profiles/' + me).set(Object.assign({}, data, { updated: firebase.database.ServerValue.TIMESTAMP }))
      .then(function () { return me; });
  });
}

function loadProfile(uid) {
  if (!db) return Promise.reject(new Error('offline'));
  return db.ref('rudventur-social/profiles/' + uid).once('value').then(snap => snap.val());
}

function loadRecentProfiles(limit) {
  limit = limit || 50;
  if (!db) return Promise.reject(new Error('offline'));
  return db.ref('rudventur-social/profiles')
    .orderByChild('updated')
    .limitToLast(limit)
    .once('value')
    .then(snap => {
      const profiles = [];
      snap.forEach(child => {
        profiles.push({ uid: child.key, ...child.val() });
      });
      return profiles.reverse();
    });
}

// ─── Local cache for offline viewing ───
function cacheProfile(uid, data) {
  try {
    localStorage.setItem('rudventur-profile-' + uid, JSON.stringify(data));
  } catch (e) { /* storage full, ignore */ }
}

function getCachedProfile(uid) {
  try {
    const d = localStorage.getItem('rudventur-profile-' + uid);
    return d ? JSON.parse(d) : null;
  } catch (e) { return null; }
}

// ─── Toast ───
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

// ─── Entity type config ───
const ENTITY_TYPES = {
  human:     { icon: '\u{1F464}', label: 'Human',     desc: 'a person. the classic.' },
  bot:       { icon: '\u{1F916}', label: 'Bot',       desc: 'automated. tireless. possibly sentient.' },
  ai:        { icon: '\u{1F9E0}', label: 'AI',        desc: 'language, attention, and a lot of parameters.' },
  pet:       { icon: '\u{1F43E}', label: 'Pet',       desc: 'paws. vibes. unconditional presence.' },
  kingdom:   { icon: '\u{1F451}', label: 'Kingdom',   desc: 'many as one. a collective with a name.' },
  directory: { icon: '\u{1F3E2}', label: 'Directory', desc: 'a list that knows what it contains.' },
  cemetery:  { icon: '\u{1FAA6}', label: 'Cemetery',  desc: 'eternal resident. no checkout date. still networking.' }
};

// ─── RudVentur Universe links per type ───
const UNIVERSE_LINKS = {
  all: [
    { name: 'rudventur.com', url: 'https://rudventur.com', icon: '\u{1F310}' }
  ],
  human: [
    { name: 'ArtSpace City', url: 'https://rudventur.github.io/map-merger-venti/', icon: '\u{1F3A8}' },
    { name: 'ChemVentur', url: 'https://rudventur.github.io/ChemVentur/', icon: '\u{1F9EA}' },
    { name: 'Map Merger Venti', url: 'https://rudventur.github.io/map-merger-venti/', icon: '\u{1F5FA}' }
  ],
  bot: [
    { name: 'ArtSpace City', url: 'https://rudventur.github.io/map-merger-venti/', icon: '\u{1F3A8}' },
    { name: 'ChemVentur', url: 'https://rudventur.github.io/ChemVentur/', icon: '\u{1F9EA}' },
    { name: 'Map Merger Venti', url: 'https://rudventur.github.io/map-merger-venti/', icon: '\u{1F5FA}' }
  ],
  ai: [
    { name: 'ArtSpace City', url: 'https://rudventur.github.io/map-merger-venti/', icon: '\u{1F3A8}' },
    { name: 'ChemVentur', url: 'https://rudventur.github.io/ChemVentur/', icon: '\u{1F9EA}' },
    { name: 'Map Merger Venti', url: 'https://rudventur.github.io/map-merger-venti/', icon: '\u{1F5FA}' }
  ],
  pet: [
    { name: 'Snout First', url: 'https://rudventur.github.io/map-merger-venti/snout-first.html', icon: '\u{1F415}' }
  ],
  kingdom: [
    { name: 'ArtSpace City', url: 'https://rudventur.github.io/map-merger-venti/', icon: '\u{1F3A8}' },
    { name: 'ChemVentur', url: 'https://rudventur.github.io/ChemVentur/', icon: '\u{1F9EA}' },
    { name: 'Map Merger Venti', url: 'https://rudventur.github.io/map-merger-venti/', icon: '\u{1F5FA}' },
    { name: 'Snout First', url: 'https://rudventur.github.io/map-merger-venti/snout-first.html', icon: '\u{1F415}' }
  ],
  directory: [],
  cemetery: [
    { name: 'Map Merger Venti', url: 'https://rudventur.github.io/map-merger-venti/', icon: '\u{1F5FA}' },
    { name: 'ArtSpace City', url: 'https://rudventur.github.io/map-merger-venti/', icon: '\u{1F3A8}' }
  ]
};

function getUniverseLinks(type) {
  const specific = UNIVERSE_LINKS[type] || [];
  return [...specific, ...UNIVERSE_LINKS.all];
}
