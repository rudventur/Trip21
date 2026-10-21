// ═══════════════════════════════════════════════════════════════
//  firebase-config.js — Firebase setup for Map Merger Venti + Snout First
//  Uses Firebase 10 compat mode (CDN-friendly)
//
//  SHARING IS OFF until the blanks below are filled in.
//  Step-by-step instructions: FIREBASE-SETUP.md (in the repository root).
//  Copy the values from: Firebase console → Project settings → Your apps →
//  Web app → "SDK setup and configuration" → Config.
//  These values are public by design; the database rules
//  (database.rules.json) are what protect the data.
//
//  While any required value is blank, Snout First runs on this device only
//  and says so on screen — nothing is sent anywhere.
// ═══════════════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey: "",             // ← PASTE (starts with "AIza…")
  authDomain: "",         // ← PASTE (probably "map-merger-venti.firebaseapp.com")
  databaseURL: "https://map-merger-venti-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "",          // ← PASTE (probably "map-merger-venti")
  storageBucket: "",      // ← PASTE (optional, not used yet)
  messagingSenderId: "",  // ← PASTE (a long number)
  appId: ""               // ← PASTE (looks like "1:1234567890:web:abc123…")
};

// Without these, sharing stays off.
const FIREBASE_REQUIRED = ['apiKey', 'authDomain', 'projectId', 'databaseURL', 'appId'];

// db is only set after a successful anonymous sign-in, so every read and
// write to the shared database happens as a signed-in user (auth.uid).
// While db is null, every module keeps its data on this device.
let firebaseApp = null, db = null, auth = null;
// Why sharing is off: 'config' (blanks above), 'sdk' (library didn't load),
// 'signin' (anonymous sign-in failed / not enabled), 'connecting' (signing in),
// '' (sharing is on).
let firebaseOffReason = 'config';

function firebaseConfigMissing() {
  return FIREBASE_REQUIRED.filter(k => !String(firebaseConfig[k] || '').trim());
}

function initFirebase() {
  if (typeof firebase === 'undefined') {
    firebaseOffReason = 'sdk';
    console.info('[Snout First] Firebase library not loaded — this device only.');
    return false;
  }
  const missing = firebaseConfigMissing();
  if (missing.length) {
    firebaseOffReason = 'config';
    console.info('[Snout First] Sharing not set up yet (blank: ' + missing.join(', ') +
      ' in js/firebase-config.js) — this device only. See FIREBASE-SETUP.md.');
    return false;
  }
  try {
    firebaseApp = firebase.apps.length ? firebase.apps[0] : firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    return true;
  } catch (e) {
    firebaseOffReason = 'config';
    auth = null;
    console.warn('[Snout First] Firebase settings rejected — this device only:', e.code || e.message);
    return false;
  }
}

// Anonymous sign-in — returns the uid, or null (then we stay on this device).
async function ensureAuth() {
  if (!auth) return null;
  try {
    // Wait until Firebase has restored a previous session (if any).
    const existing = await new Promise(resolve => {
      const off = auth.onAuthStateChanged(u => { off(); resolve(u); });
    });
    const user = existing || (await auth.signInAnonymously()).user;
    db = firebase.database();
    firebaseOffReason = '';
    return user.uid;
  } catch (e) {
    firebaseOffReason = 'signin';
    db = null;
    console.warn('[Snout First] Anonymous sign-in failed — this device only:', e.code || e.message);
    return null;
  }
}

// The signed-in uid when sharing is on; otherwise a persistent id for this device.
function getUid() {
  if (auth && auth.currentUser) return auth.currentUser.uid;
  let localUid = localStorage.getItem('rv_local_uid');
  if (!localUid) {
    localUid = 'local_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('rv_local_uid', localUid);
  }
  return localUid;
}

// True when the shared database is usable (signed in).
function isSharing() {
  return !!(db && auth && auth.currentUser);
}

function getUserName() {
  return (localStorage.getItem('rv_username') || 'Anonymous Walker').slice(0, 30);
}

function setUserName(name) {
  localStorage.setItem('rv_username', String(name).trim().slice(0, 30));
}
