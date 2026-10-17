// multiplayer.js — group trips for rudTrip20 (Trip21 version).
//
// What this file does, in plain terms:
//   * signs you in anonymously (no account, no email) with Firebase
//   * lets you start a group trip (a short room code and a join link: ?room=CODE)
//     or join one
//   * shares your rolls with the room and shows the rolls of others
//   * if you choose to, shares where you are (rounded to about 1 kilometre by
//     default) and draws the other players as coloured dots with names
//
// It works on both pages (index.html and globe.html). It adds its own small
// "Group trip" panel and talks to the pages through window events:
//   rt-mp-players  detail = list of players (see emitPlayers)
//   rt-mp-roll     detail = { roll, mine, apply }   (a roll made in the room)
//   rt-mp-room     detail = { code } or { code: null }
// and through window.RudMultiplayer (shareRoll, attachLeafletMap).
//
// Nothing happens (and nothing is loaded) beyond the small panel until someone
// starts or joins a room, so the app behaves as before when no room is used.

const STALE_MS = 10 * 60 * 1000;      // a position older than this is greyed out
const SEND_MIN_MS = 5000;             // never send positions more often than this
const MOVE_MIN_METRES = 25;           // send again after about this much movement
const HEARTBEAT_MS = 60 * 1000;       // while standing still, refresh once a minute
const ROUGH_KM = 1;                   // rough sharing rounds to about this distance
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;
const COLOURS = ["#ff6b35", "#2ec4b6", "#e71d73", "#7b6cf6", "#f4c20d", "#3a86ff", "#8ac926", "#ff595e"];
const FEED_SIZE = 8;

const mp = {
  fb: null,            // { auth, db, A, D } once the Firebase library is loaded
  uid: null,
  room: null,          // room code while joined
  host: null,
  locked: false,
  title: "",
  members: {},
  presence: {},
  positions: {},
  feed: [],
  unsubs: [],
  shareMode: "off",    // off | rough | exact
  watchId: null,
  lastGeo: null,
  lastSent: null,
  lastSentAt: 0,
  followRolls: true,
  leaflet: null,
  ui: null,
  busy: false,
  leaving: false
};

// ───────────────────────── small helpers ─────────────────────────

const clampText = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const finite = (v) => (typeof v === "number" && isFinite(v) ? v : null);

function myName() {
  let n = localStorage.getItem("rt_mp_name");
  if (!n) {
    n = "Traveller " + (100 + Math.floor(Math.random() * 900));
    localStorage.setItem("rt_mp_name", n);
  }
  return n;
}
function colourFor(uid) {
  let h = 0;
  for (let i = 0; i < uid.length; i += 1) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return COLOURS[h % COLOURS.length];
}
function newCode() {
  const bytes = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}
function cleanCode(raw) {
  const code = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null;
}
// About 1 kilometre: round the latitude to 0.01 degrees and the longitude to a
// step that is also about 1 kilometre at that latitude.
export function roughen(lat, lon) {
  const latStep = ROUGH_KM / 111.2;
  const lonStep = ROUGH_KM / (111.2 * Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
  return {
    lat: Number((Math.round(lat / latStep) * latStep).toFixed(4)),
    lon: Number((Math.round(lon / lonStep) * lonStep).toFixed(4))
  };
}
export function distanceMetres(a, b) {
  const r = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}
function friendlyError(e) {
  const code = (e && e.code) || "";
  if (code === "auth/operation-not-allowed" || code === "auth/admin-restricted-operation") {
    return "Anonymous sign-in is not switched on in the Firebase project yet. See MULTIPLAYER.md.";
  }
  if (code === "auth/network-request-failed") return "No connection to Firebase. Check your internet and try again.";
  if (code === "auth/api-key-not-valid" || code === "auth/invalid-api-key") return "The Firebase web key was rejected. Check firebase-config.js.";
  if (/PERMISSION_DENIED/i.test(String(e && (e.code || e.message)))) return "Firebase said no (the rules may not be published yet).";
  return (e && e.message) || "Something went wrong.";
}
function timeAgo(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return Math.round(s / 60) + " min ago";
  return Math.round(s / 3600) + " h ago";
}
function emit(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

// ───────────────────────── Firebase loading and sign-in ─────────────────────────

async function loadFirebase() {
  if (mp.fb) return mp.fb;
  const { firebaseConfig, firebaseSdkVersion } = await import("../../firebase-config.js");
  const base = `https://www.gstatic.com/firebasejs/${firebaseSdkVersion}/`;
  const [appMod, A, D] = await Promise.all([
    import(base + "firebase-app.js"),
    import(base + "firebase-auth.js"),
    import(base + "firebase-database.js")
  ]);
  const app = appMod.initializeApp(firebaseConfig);
  mp.fb = { app, auth: A.getAuth(app), db: D.getDatabase(app), A, D };
  return mp.fb;
}
async function ensureUser() {
  const fb = await loadFirebase();
  if (!fb.auth.currentUser) await fb.A.signInAnonymously(fb.auth);
  mp.uid = fb.auth.currentUser.uid;
  return mp.uid;
}
const path = (...parts) => ["rooms", mp.room, ...parts].join("/");
const ref = (p) => mp.fb.D.ref(mp.fb.db, p);

// ───────────────────────── rooms ─────────────────────────

async function createRoom() {
  setBusy(true, "Starting a group trip…");
  try {
    await ensureUser();
    const { D } = mp.fb;
    let made = null;
    for (let i = 0; i < 6 && !made; i += 1) {
      const code = newCode();
      try {
        // The rules only allow creating a room that does not exist yet.
        await D.set(D.ref(mp.fb.db, `rooms/${code}/meta`), { host: mp.uid, created: D.serverTimestamp() });
        made = code;
      } catch (e) {
        if (!/PERMISSION_DENIED/i.test(String(e.code || e.message))) throw e;
      }
    }
    if (!made) throw new Error("Could not start a group trip. The Firebase rules may not be published yet (see MULTIPLAYER.md).");
    await joinRoom(made, { quiet: true });
  } catch (e) {
    setStatus(friendlyError(e), true);
  } finally {
    setBusy(false);
  }
}

async function joinRoom(rawCode, { quiet = false } = {}) {
  const code = cleanCode(rawCode);
  if (!code) { setStatus("A room code has 5 letters or numbers.", true); return; }
  if (mp.room) await leaveRoom({ keepStatus: true });
  if (!quiet) setBusy(true, "Joining…");
  try {
    await ensureUser();
    const { D } = mp.fb;
    mp.room = code;
    // The rules allow joining only when the room exists and is not locked.
    try {
      await D.set(ref(path("members", mp.uid)), {
        name: clampText(myName(), 30) || "Traveller",
        color: colourFor(mp.uid),
        joined: D.serverTimestamp(),
        share: "off"
      });
    } catch (e) {
      mp.room = null;
      if (/PERMISSION_DENIED/i.test(String(e.code || e.message))) {
        throw new Error("No room with that code, or the room is locked.");
      }
      throw e;
    }
    attachRoomListeners();
    const url = new URL(location.href);
    url.searchParams.set("room", code);
    history.replaceState(null, "", url);
    setStatus("");
    emit("rt-mp-room", { code });
    renderUi();
  } catch (e) {
    mp.room = null;
    setStatus(friendlyError(e), true);
    renderUi();
  } finally {
    setBusy(false);
  }
}

function listen(query, onData, onError) {
  const { D } = mp.fb;
  const off = D.onValue(query, onData, onError || (() => {}));
  mp.unsubs.push(off);
}

function attachRoomListeners() {
  const { D } = mp.fb;
  let hadMembers = false;

  listen(ref(path("members")), (snap) => {
    mp.members = snap.val() || {};
    if (Object.keys(mp.members).length) hadMembers = true;
    else if (hadMembers) { roomEnded(); return; }
    emitPlayers();
    renderUi();
  }, () => {
    // Firebase cancels this listener when we are no longer allowed to read the
    // room: the host deleted it, or we just left. Only the first case is news.
    if (mp.room && !mp.leaving) roomEnded();
  });
  listen(ref(path("presence")), (snap) => { mp.presence = snap.val() || {}; emitPlayers(); renderUi(); });
  listen(ref(path("positions")), (snap) => { mp.positions = snap.val() || {}; emitPlayers(); renderUi(); });
  listen(ref(path("meta")), (snap) => { mp.host = (snap.val() || {}).host || null; emitPlayers(); renderUi(); });
  listen(ref(path("settings")), (snap) => {
    const s = snap.val() || {};
    mp.locked = s.locked === true;
    mp.title = clampText(s.title, 40);
    renderUi();
  });

  // Presence: when the connection drops, Firebase itself marks us offline and
  // removes our position, even if the tab was closed without warning.
  listen(D.ref(mp.fb.db, ".info/connected"), async (snap) => {
    if (snap.val() !== true || !mp.room) return;
    try {
      const pres = ref(path("presence", mp.uid));
      await D.onDisconnect(pres).set({ online: false, lastSeen: D.serverTimestamp() });
      await D.onDisconnect(ref(path("positions", mp.uid))).remove();
      await D.set(pres, { online: true, lastSeen: D.serverTimestamp() });
    } catch (e) { setStatus(friendlyError(e), true); }
  });

  // Rolls: read what is there, show the newest, then follow new ones.
  (async () => {
    try {
      const rollsRef = ref(path("rolls"));
      const first = await D.get(D.query(rollsRef, D.orderByKey(), D.limitToLast(FEED_SIZE)));
      const items = [];
      first.forEach((c) => { items.push({ id: c.key, ...c.val() }); });
      let lastKey = null;
      items.forEach((roll, i) => {
        lastKey = roll.id;
        addToFeed(roll);
        if (i === items.length - 1) deliverRoll(roll, false);
      });
      const q = lastKey
        ? D.query(rollsRef, D.orderByKey(), D.startAfter(lastKey))
        : D.query(rollsRef, D.orderByKey());
      const off = D.onChildAdded(q, (c) => {
        const roll = { id: c.key, ...c.val() };
        addToFeed(roll);
        deliverRoll(roll, true);
      });
      mp.unsubs.push(off);
    } catch (e) { setStatus(friendlyError(e), true); }
  })();
}

function roomEnded() {
  teardownLocal();
  setStatus("The host ended this group trip.");
  renderUi();
}

function teardownLocal() {
  mp.unsubs.forEach((off) => { try { off(); } catch { /* already gone */ } });
  mp.unsubs = [];
  stopWatching();
  mp.room = null; mp.host = null; mp.locked = false; mp.title = "";
  mp.members = {}; mp.presence = {}; mp.positions = {}; mp.feed = [];
  mp.shareMode = "off"; mp.lastSent = null; mp.lastSentAt = 0;
  const url = new URL(location.href);
  url.searchParams.delete("room");
  history.replaceState(null, "", url);
  emit("rt-mp-players", []);
  emit("rt-mp-room", { code: null });
  redrawLeaflet();
}

async function leaveRoom({ keepStatus = false } = {}) {
  if (!mp.room || !mp.fb) return;
  const { D } = mp.fb;
  const code = mp.room;
  mp.leaving = true;
  try {
    // Order matters: the rules let you write only while you are still a member.
    await D.onDisconnect(ref(path("presence", mp.uid))).cancel();
    await D.onDisconnect(ref(path("positions", mp.uid))).cancel();
    if (mp.host === mp.uid && Object.keys(mp.members).length <= 1) {
      // The host is the last one out: tidy the whole room away.
      await D.remove(ref(`rooms/${code}`));
    } else {
      await D.remove(ref(path("positions", mp.uid)));
      await D.remove(ref(path("presence", mp.uid)));
      await D.remove(ref(path("members", mp.uid)));
    }
  } catch { /* leaving is best effort */ }
  teardownLocal();
  mp.leaving = false;
  if (!keepStatus) setStatus("You left room " + code + ".");
  renderUi();
}

async function endRoomForEveryone() {
  if (!mp.room || mp.host !== mp.uid) return;
  if (!confirm("End this group trip for everyone? Rolls and positions in the room are deleted.")) return;
  const { D } = mp.fb;
  try {
    await D.remove(ref(`rooms/${mp.room}`));
  } catch (e) { setStatus(friendlyError(e), true); }
}

async function setLocked(locked) {
  if (!mp.room || mp.host !== mp.uid) return;
  try {
    await mp.fb.D.set(ref(path("settings")), mp.title ? { locked: !!locked, title: mp.title } : { locked: !!locked });
  } catch (e) { setStatus(friendlyError(e), true); }
}

// ───────────────────────── players ─────────────────────────

function currentPlayers() {
  const now = Date.now();
  return Object.entries(mp.members).map(([id, m]) => {
    const pos = mp.positions[id];
    const pres = mp.presence[id];
    const hasPosition = !!pos && finite(pos.lat) !== null && finite(pos.lon) !== null;
    return {
      id,
      name: clampText(m.name, 30) || "Traveller",
      color: /^#[0-9a-f]{6}$/i.test(m.color || "") ? m.color : colourFor(id),
      share: m.share || "off",
      online: !!pres && pres.online === true,
      lastSeen: pres ? finite(pres.lastSeen) : null,
      hasPosition,
      lat: hasPosition ? pos.lat : null,
      lon: hasPosition ? pos.lon : null,
      positionTime: hasPosition ? finite(pos.t) : null,
      stale: hasPosition ? now - (finite(pos.t) || 0) > STALE_MS : false,
      me: id === mp.uid,
      host: id === mp.host
    };
  }).sort((a, b) => (b.me - a.me) || a.name.localeCompare(b.name));
}
function emitPlayers() {
  const players = currentPlayers();
  emit("rt-mp-players", players);
  redrawLeaflet(players);
}

// ───────────────────────── sharing my position ─────────────────────────

function startWatching() {
  if (mp.watchId !== null) return;
  if (!navigator.geolocation) { setStatus("This device cannot share a location.", true); return; }
  mp.watchId = navigator.geolocation.watchPosition(
    (pos) => { mp.lastGeo = pos.coords; maybeSendPosition(false); },
    (err) => {
      setStatus(err && err.code === 1 ? "Location permission was refused, so nothing is shared." : "Could not read your location.", true);
      stopSharing();
    },
    { enableHighAccuracy: false, maximumAge: 10000, timeout: 20000 }
  );
}
function stopWatching() {
  if (mp.watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(mp.watchId);
  mp.watchId = null;
  mp.lastGeo = null;
}
async function setShareMode(mode) {
  if (!mp.room) return;
  const { D } = mp.fb;
  mp.shareMode = mode;
  mp.lastSent = null;
  mp.lastSentAt = 0;
  try {
    await D.update(ref(path("members", mp.uid)), { share: mode });
    if (mode === "off") {
      stopWatching();
      await D.remove(ref(path("positions", mp.uid)));
    } else {
      startWatching();
      if (mp.lastGeo) maybeSendPosition(true);
    }
  } catch (e) { setStatus(friendlyError(e), true); }
  renderUi();
}
const stopSharing = () => setShareMode("off");

function maybeSendPosition(force) {
  if (!mp.room || mp.shareMode === "off" || !mp.lastGeo) return;
  if (document.hidden && !force) return;
  const now = Date.now();
  const since = now - mp.lastSentAt;
  if (since < SEND_MIN_MS) return;
  const g = mp.lastGeo;
  const p = mp.shareMode === "rough"
    ? roughen(g.latitude, g.longitude)
    : { lat: Number(g.latitude.toFixed(5)), lon: Number(g.longitude.toFixed(5)) };
  const moved = mp.lastSent ? distanceMetres(mp.lastSent, p) : Infinity;
  if (moved < MOVE_MIN_METRES && since < HEARTBEAT_MS) return;
  mp.lastSent = p;
  mp.lastSentAt = now;
  const acc = mp.shareMode === "rough" ? 1000 : Math.min(100000, Math.max(1, Math.round(g.accuracy || 50)));
  mp.fb.D.set(ref(path("positions", mp.uid)), { lat: p.lat, lon: p.lon, acc, t: now })
    .catch((e) => setStatus(friendlyError(e), true));
}
setInterval(() => maybeSendPosition(false), 15000);                 // heartbeat while standing still
setInterval(() => { if (mp.room) { emitPlayers(); renderUi(); } }, 30000);   // refresh greyed-out state
document.addEventListener("visibilitychange", () => { if (!document.hidden) maybeSendPosition(true); });

// ───────────────────────── rolls ─────────────────────────

function cleanPlace(t) {
  const lat = finite(Number(t && t.lat));
  const lon = finite(Number(t && t.lon));
  if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const out = { name: clampText(t.name, 120) || "Unnamed place", lat, lon };
  const desc = clampText(t.desc, 300); if (desc) out.desc = desc;
  const loc = clampText(t.loc, 120); if (loc) out.loc = loc;
  const source = clampText(t.source, 20); if (source) out.source = source;
  const link = clampText(t.link, 300); if (/^https?:\/\//i.test(link)) out.link = link;
  const wiki = clampText(t.wikipedia, 200); if (wiki) out.wikipedia = wiki;
  return out;
}

// Called by the pages after a roll made on this device.
function shareRoll(roll) {
  if (!mp.room || !mp.fb || !roll) return;
  const target = cleanPlace(roll.target);
  if (!target) return;
  const extras = (roll.extras || []).map(cleanPlace).filter(Boolean).slice(0, 6);
  const start = {
    lat: finite(Number(roll.start && roll.start.lat)) ?? 0,
    lon: finite(Number(roll.start && roll.start.lon)) ?? 0,
    name: clampText(roll.start && roll.start.name, 120)
  };
  const { D } = mp.fb;
  const entry = {
    by: mp.uid,
    name: clampText(myName(), 30) || "Traveller",
    t: D.serverTimestamp(),
    kind: clampText(roll.kind, 12) || "place",
    tripType: clampText(roll.tripType, 20) || "oneway",
    start,
    target
  };
  if (extras.length) entry.extras = extras;
  D.set(D.push(ref(path("rolls"))), entry).catch((e) => setStatus(friendlyError(e), true));
}

function addToFeed(roll) {
  if (mp.feed.some((r) => r.id === roll.id)) return;
  mp.feed.push(roll);
  mp.feed.sort((a, b) => (a.id < b.id ? -1 : 1));
  mp.feed = mp.feed.slice(-FEED_SIZE);
  renderUi();
}
function deliverRoll(roll, live) {
  const mine = roll.by === mp.uid;
  const target = cleanPlace(roll.target);
  if (!target) return;
  const extras = (roll.extras ? Object.values(roll.extras) : []).map(cleanPlace).filter(Boolean);
  const clean = {
    id: roll.id, by: roll.by, name: clampText(roll.name, 30) || "Someone",
    kind: ["place", "event", "trip"].includes(roll.kind) ? roll.kind : "place",
    tripType: clampText(roll.tripType, 20) || "oneway",
    start: roll.start || null, target, extras
  };
  emit("rt-mp-roll", { roll: clean, mine, live, apply: !mine && mp.followRolls });
}

// ───────────────────────── the Leaflet map (index.html result map) ─────────────────────────

function attachLeafletMap(map) {
  if (mp.leaflet && mp.leaflet.layer) { try { mp.leaflet.layer.remove(); } catch { /* old map is gone */ } }
  mp.leaflet = null;
  if (!map || !window.L) return;
  mp.leaflet = { map, layer: window.L.layerGroup().addTo(map) };
  redrawLeaflet();
}
function redrawLeaflet(players = currentPlayers()) {
  const lf = mp.leaflet;
  if (!lf || !window.L) return;
  try {
    lf.layer.clearLayers();
    players.filter((p) => p.hasPosition).forEach((p) => {
      const label = document.createElement("span");
      label.textContent = p.name + (p.me ? " (you)" : "") + (p.stale ? " · away" : "");
      window.L.circleMarker([p.lat, p.lon], {
        radius: 9,
        color: p.me ? "#ffffff" : "#111111",
        weight: 2,
        fillColor: p.stale ? "#888888" : p.color,
        fillOpacity: p.stale ? 0.5 : 0.95,
        opacity: p.stale ? 0.6 : 1
      }).bindTooltip(label, { permanent: true, direction: "top", offset: [0, -8], className: "rt-mp-tip" }).addTo(lf.layer);
    });
  } catch { /* the map was removed while drawing */ }
}
function focusOn(p) {
  emit("rt-mp-focus", { lat: p.lat, lon: p.lon });
  if (mp.leaflet) { try { mp.leaflet.map.setView([p.lat, p.lon], Math.max(mp.leaflet.map.getZoom(), 10)); } catch { /* ignore */ } }
}

// ───────────────────────── the panel ─────────────────────────

const CSS = `
#rt-mp{position:fixed;left:12px;bottom:12px;z-index:3000;font:13px/1.35 system-ui,sans-serif;color:#eee;max-width:min(320px,calc(100vw - 24px))}
#rt-mp *{box-sizing:border-box}
#rt-mp .rt-pill{background:#1c1e18;color:#f4e9b8;border:1px solid #c4b06a;border-radius:999px;padding:.45rem .9rem;cursor:pointer;font:inherit;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.5)}
#rt-mp .rt-box{display:none;background:#171913;border:1px solid #c4b06a;border-radius:10px;padding:.7rem;margin-bottom:.5rem;max-height:70vh;overflow:auto;box-shadow:0 4px 16px rgba(0,0,0,.6)}
#rt-mp.open .rt-box{display:block}
#rt-mp h4{margin:.6rem 0 .25rem;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#c4b06a}
#rt-mp h4:first-child{margin-top:0}
#rt-mp input[type=text]{width:100%;background:#0f100c;color:#eee;border:1px solid #555;border-radius:6px;padding:.35rem .5rem;font:inherit}
#rt-mp button.rt-btn{background:#ff6b35;color:#111;border:0;border-radius:6px;padding:.4rem .7rem;cursor:pointer;font:inherit;font-weight:600;margin:.25rem .25rem 0 0}
#rt-mp button.rt-btn.alt{background:#2a2d22;color:#eee;border:1px solid #666}
#rt-mp button.rt-btn:disabled{opacity:.5;cursor:default}
#rt-mp .rt-code{font:700 22px ui-monospace,monospace;letter-spacing:.15em;color:#f4e9b8}
#rt-mp .rt-status{min-height:1.2em;margin-top:.4rem;color:#c4b06a}
#rt-mp .rt-status.bad{color:#ff8a80}
#rt-mp ul{list-style:none;margin:0;padding:0}
#rt-mp li{display:flex;align-items:center;gap:.4rem;padding:.15rem 0}
#rt-mp .rt-dot{width:11px;height:11px;border-radius:50%;border:2px solid #111;flex:none}
#rt-mp .rt-dot.stale{background:#888!important;opacity:.6}
#rt-mp .rt-sub{color:#999;font-size:11px}
#rt-mp li button.rt-link{background:none;border:0;color:#f4e9b8;text-decoration:underline;cursor:pointer;font:inherit;padding:0}
#rt-mp label{display:block;margin:.2rem 0}
.rt-mp-tip{background:#111;color:#fff;border:1px solid #c4b06a;font:600 11px system-ui,sans-serif;padding:1px 5px}
`;

function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v);
  });
  kids.flat().forEach((c) => { if (c) n.append(c); });
  return n;
}

function buildUi() {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
  const root = el("div", { id: "rt-mp" });
  const box = el("div", { class: "rt-box" });
  const pill = el("button", { class: "rt-pill", type: "button", onclick: () => root.classList.toggle("open") });
  root.append(box, pill);
  document.body.appendChild(root);
  mp.ui = { root, box, pill, status: "", bad: false, nameInput: null, codeInput: null };
}
function setBusy(on, message) {
  mp.busy = on;
  if (message) setStatus(message);
  renderUi();
}
function setStatus(message, bad = false) {
  if (!mp.ui) return;
  mp.ui.status = message || "";
  mp.ui.bad = !!bad;
  const s = mp.ui.box.querySelector(".rt-status");
  if (s) { s.textContent = mp.ui.status; s.classList.toggle("bad", mp.ui.bad); }
  if (bad) mp.ui.root.classList.add("open");
}

function playerLine(p) {
  let sub;
  if (p.hasPosition && !p.stale) sub = p.share === "exact" ? "sharing exact location" : "sharing rough location";
  else if (p.hasPosition && p.stale) sub = "away, last seen " + timeAgo(p.positionTime);
  else if (p.online) sub = "online, not sharing location";
  else sub = p.lastSeen ? "offline, " + timeAgo(p.lastSeen) : "offline";
  const li = el("li", {},
    el("span", { class: "rt-dot" + (p.stale || (!p.online && !p.me) ? " stale" : ""), style: `background:${p.color}` }),
    el("div", {},
      el("div", { text: p.name + (p.me ? " (you)" : "") + (p.host ? " · host" : "") }),
      el("div", { class: "rt-sub", text: sub })));
  if (p.hasPosition) {
    li.append(el("button", { class: "rt-link", type: "button", text: "show", onclick: () => focusOn(p) }));
  }
  return li;
}

function renderUi() {
  if (!mp.ui) return;
  const { box, pill } = mp.ui;
  // Keep what the person is typing across redraws.
  const typedName = mp.ui.nameInput ? mp.ui.nameInput.value : null;
  const typedCode = mp.ui.codeInput ? mp.ui.codeInput.value : "";
  const hadFocus = document.activeElement && box.contains(document.activeElement) && document.activeElement.tagName === "INPUT"
    ? document.activeElement.dataset.key : null;
  box.textContent = "";
  const players = mp.room ? currentPlayers() : [];
  const online = players.filter((p) => p.online || p.me).length;
  pill.textContent = mp.room ? `👥 Room ${mp.room} · ${online} online` : "👥 Group trip";

  if (!mp.room) {
    const nameInput = el("input", { type: "text", maxlength: "30", "data-key": "name", value: typedName ?? myName(), "aria-label": "Your name" });
    nameInput.addEventListener("change", () => { localStorage.setItem("rt_mp_name", clampText(nameInput.value, 30) || myName()); });
    const codeInput = el("input", { type: "text", maxlength: "8", "data-key": "code", placeholder: "Room code", value: typedCode, "aria-label": "Room code", style: "text-transform:uppercase" });
    mp.ui.nameInput = nameInput;
    mp.ui.codeInput = codeInput;
    box.append(
      el("h4", { text: "Group trip" }),
      el("div", { class: "rt-sub", text: "Travel together: share rolls and, if you choose, where you are. No account needed." }),
      el("h4", { text: "Your name" }), nameInput,
      el("button", { class: "rt-btn", type: "button", text: "Start group trip", disabled: mp.busy, onclick: () => { localStorage.setItem("rt_mp_name", clampText(nameInput.value, 30) || myName()); createRoom(); } }),
      el("h4", { text: "Or join one" }), codeInput,
      el("button", { class: "rt-btn alt", type: "button", text: "Join", disabled: mp.busy, onclick: () => { localStorage.setItem("rt_mp_name", clampText(nameInput.value, 30) || myName()); joinRoom(codeInput.value); } })
    );
  } else {
    mp.ui.nameInput = null; mp.ui.codeInput = null;
    const link = `${location.origin}${location.pathname}?room=${mp.room}`;
    const sharing = mp.shareMode !== "off";
    const isHost = mp.host === mp.uid;
    const exact = el("input", { type: "checkbox", id: "rt-mp-exact", checked: mp.shareMode === "exact", onchange: (e) => { if (mp.shareMode !== "off") setShareMode(e.target.checked ? "exact" : "rough"); } });
    const follow = el("input", { type: "checkbox", id: "rt-mp-follow", checked: mp.followRolls, onchange: (e) => { mp.followRolls = e.target.checked; } });
    box.append(
      el("h4", { text: mp.title ? "Group trip · " + mp.title : "Group trip" }),
      el("div", { class: "rt-code", text: mp.room }),
      el("button", { class: "rt-btn", type: "button", text: "Copy join link", onclick: async () => {
        try { await navigator.clipboard.writeText(link); setStatus("Join link copied."); } catch { setStatus("Copy this link: " + link); }
      } }),
      el("button", { class: "rt-btn alt", type: "button", text: "Leave", onclick: () => leaveRoom() }),
      isHost ? el("div", {},
        el("label", {}, el("input", { type: "checkbox", checked: mp.locked, onchange: (e) => setLocked(e.target.checked) }), " Lock room (nobody new can join)"),
        el("button", { class: "rt-btn alt", type: "button", text: "End for everyone", onclick: endRoomForEveryone })) : "",
      el("h4", { text: "My location" }),
      el("div", { class: "rt-sub", text: sharing
        ? (mp.shareMode === "exact" ? "Others see your exact position." : "Others see roughly where you are (rounded to about 1 kilometre).")
        : "Not shared. Nobody sees where you are until you choose to." }),
      el("button", { class: "rt-btn" + (sharing ? " alt" : ""), type: "button", text: sharing ? "Stop sharing" : "Share my location (rough)", onclick: () => (sharing ? stopSharing() : setShareMode("rough")) }),
      el("label", {}, exact, " Exact instead of rough"),
      el("h4", { text: `Players (${players.length})` }),
      el("ul", {}, players.map(playerLine)),
      el("h4", { text: "Rolls" }),
      el("label", {}, follow, " Show the group's rolls on my screen"),
      mp.feed.length
        ? el("ul", {}, [...mp.feed].reverse().map((r) => {
            const extra = r.extras ? Object.keys(r.extras).length : 0;
            const when = typeof r.t === "number" ? new Date(r.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
            return el("li", {}, el("div", {},
              el("div", { text: `${clampText(r.name, 30) || "Someone"} rolled ${clampText(r.target && r.target.name, 60)}${extra ? ` (+${extra} more)` : ""}` }),
              el("div", { class: "rt-sub", text: when })));
          }))
        : el("div", { class: "rt-sub", text: "No rolls yet. Roll something and the room sees it." })
    );
  }
  box.append(el("div", { class: "rt-status" + (mp.ui.bad ? " bad" : ""), text: mp.ui.status }));
  if (hadFocus) {
    const again = box.querySelector(`input[data-key="${hadFocus}"]`);
    if (again) again.focus();
  }
}

// ───────────────────────── start up ─────────────────────────

window.RudMultiplayer = {
  shareRoll,
  attachLeafletMap,
  get room() { return mp.room; },
  get players() { return currentPlayers(); }
};

function boot() {
  buildUi();
  renderUi();
  const code = cleanCode(new URLSearchParams(location.search).get("room"));
  if (code) {
    mp.ui.root.classList.add("open");
    joinRoom(code);
  }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
