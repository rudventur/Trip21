// ═══════════════════════════════════════════════════════════════
//  firebase-config.js — Firebase setup for Map Merger Venti + Snout First
//  Uses Firebase 9 compat mode (CDN-friendly)
// ═══════════════════════════════════════════════════════════════

const firebaseConfig = {
  databaseURL: "https://map-merger-venti-default-rtdb.europe-west1.firebasedatabase.app"
};

// Init Firebase (loaded via CDN in HTML)
let firebaseApp, db, auth;

function initFirebase() {
  if (typeof firebase === 'undefined') {
    console.warn('Firebase SDK not loaded');
    return false;
  }
  if (!firebase.apps.length) {
    firebaseApp = firebase.initializeApp(firebaseConfig);
  } else {
    firebaseApp = firebase.apps[0];
  }
  db = firebase.database();
  auth = firebase.auth();
  return true;
}

// Anonymous auth — returns uid
async function ensureAuth() {
  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser.uid;
  try {
    const cred = await auth.signInAnonymously();
    return cred.user.uid;
  } catch (e) {
    console.warn('Auth failed, using local fallback:', e.message);
    // Fallback: generate a persistent local uid
    let localUid = localStorage.getItem('rv_local_uid');
    if (!localUid) {
      localUid = 'local_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('rv_local_uid', localUid);
    }
    return localUid;
  }
}

function getUid() {
  if (auth && auth.currentUser) return auth.currentUser.uid;
  let localUid = localStorage.getItem('rv_local_uid');
  if (!localUid) {
    localUid = 'local_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('rv_local_uid', localUid);
  }
  return localUid;
}

function getUserName() {
  return localStorage.getItem('rv_username') || 'Anonymous Walker';
}

function setUserName(name) {
  localStorage.setItem('rv_username', name);
}
