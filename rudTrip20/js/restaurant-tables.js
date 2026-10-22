// restaurant-tables.js — restaurant tables for Trip21.
//
// What this file does, in plain terms:
//   * guests: a "🍽️ RESTAURANTS" fold in the useRbox left section lists the open
//     restaurants and their tables, with a box to type a table code. Opening a
//     link with ?table=CODE (for example from the scannable code on the table)
//     joins straight away. At the table you see who is there and can chat.
//   * owners: a "🍽️ MY RESTAURANT (TRIP21)" fold in the useRbox settings (right
//     section). Owners sign in with Google, claim their place by its
//     OpenStreetMap id, and wait for approval. Once approved they can open or
//     close, add, rename and remove tables, see and renew each table code, and
//     print a sheet with a scannable code for every table.
//   * table codes: while the owner has Trip21 open, each code is kept valid for
//     the next 4 hours (refreshed every few minutes). When the owner leaves, the
//     codes stop being refreshed and run out 4 hours later. The database rules
//     check the expiry against the database clock, so an expired code lets
//     nobody in, and guests already seated lose access to the table.
//
// It uses its own named Firebase app, so it never disturbs the group trip
// sign-in in multiplayer.js. Data lives in the trip21-25f36 project.

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const KEEP_MS = 4 * 60 * 60 * 1000;          // a code lasts 4 hours after the last refresh
const REFRESH_MS = 5 * 60 * 1000;            // the owner's open page refreshes every 5 minutes
const CHAT_SIZE = 50;
const COLOURS = ["#ff6b35", "#2ec4b6", "#e71d73", "#7b6cf6", "#f4c20d", "#3a86ff", "#8ac926", "#ff595e"];
const QR_LIBRARY = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js";

const st = {
  fb: null, uid: null, google: false, admin: false, offset: 0,
  restaurants: {},          // every restaurant (public list)
  mineId: null,             // the restaurant this owner claimed
  myCodes: {},              // table id -> code (owner only)
  codeInfo: {},             // code -> { expires }
  refreshTimer: null,
  seat: null,               // { code, r, t } while sitting at a table
  seatOffs: [],
  members: {}, presence: {}, chat: [],
  ui: {}
};

// ───────────── small helpers ─────────────
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  Object.entries(props || {}).forEach(([k, v]) => {
    if (k === "style") el.style.cssText = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  });
  kids.flat().forEach((k) => { if (k != null && k !== false) el.append(k); });
  return el;
}
const clampText = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const serverNow = () => Date.now() + st.offset;
const denied = (e) => /PERMISSION_DENIED|permission/i.test(String(e && (e.code || e.message)));
function myName() {
  let n = localStorage.getItem("rt_mp_name");
  if (!n) { n = "Traveller " + (100 + Math.floor(Math.random() * 900)); localStorage.setItem("rt_mp_name", n); }
  return n;
}
function colourFor(uid) {
  let x = 0;
  for (let i = 0; i < uid.length; i += 1) x = (x * 31 + uid.charCodeAt(i)) >>> 0;
  return COLOURS[x % COLOURS.length];
}
function newCode() {
  const b = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(b);
  return Array.from(b, (n) => CODE_ALPHABET[n % CODE_ALPHABET.length]).join("");
}
function cleanCode(raw) {
  const c = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return c.length === CODE_LENGTH && [...c].every((x) => CODE_ALPHABET.includes(x)) ? c : null;
}
function newTableId() { return "t" + newCode().toLowerCase(); }
function tableLink(code) {
  const u = new URL(location.href);
  u.search = ""; u.hash = "";
  u.searchParams.set("table", code);
  return u.toString();
}
function untilText(ms) {
  const left = ms - serverNow();
  if (left <= 0) return "expired";
  const m = Math.round(left / 60000);
  return m < 60 ? `${m} min left` : `${Math.floor(m / 60)} h ${m % 60} min left`;
}
// "node/123", "N123", "https://www.openstreetmap.org/way/45" -> "way-45"
export function osmId(raw) {
  const s = String(raw || "").trim();
  let m = s.match(/(node|way|relation)[\/\-= ]+(\d{1,15})/i);
  if (m) return m[1].toLowerCase() + "-" + m[2];
  m = s.match(/^([NWR])(\d{1,15})$/i);
  if (m) return { n: "node", w: "way", r: "relation" }[m[1].toLowerCase()] + "-" + m[2];
  return null;
}
function friendly(e) {
  const code = (e && e.code) || "";
  if (code === "auth/operation-not-allowed") return "That sign-in method is not switched on in Firebase yet (see MULTIPLAYER.md).";
  if (code === "auth/popup-blocked") return "The browser blocked the Google window. Allow pop-ups and try again.";
  if (code === "auth/popup-closed-by-user") return "The Google window was closed before signing in.";
  if (code === "auth/unauthorized-domain") return "This web address is not on the Firebase list of authorised domains.";
  if (denied(e)) return "Firebase said no (the rules may not be published yet, or you are not allowed).";
  return (e && e.message) || "Something went wrong.";
}

// ───────────── Firebase ─────────────
async function loadFirebase() {
  if (st.fb) return st.fb;
  const { firebaseConfig, firebaseSdkVersion } = await import("../../firebase-config.js");
  const base = `https://www.gstatic.com/firebasejs/${firebaseSdkVersion}/`;
  const [appMod, A, D] = await Promise.all([
    import(base + "firebase-app.js"), import(base + "firebase-auth.js"), import(base + "firebase-database.js")
  ]);
  const app = appMod.initializeApp(firebaseConfig, "trip21-tables");
  st.fb = { app, auth: A.getAuth(app), db: D.getDatabase(app), A, D };
  // For testing on this computer only: ?emulator=1 on localhost uses the Firebase emulators.
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).get("emulator") === "1") {
    A.connectAuthEmulator(st.fb.auth, "http://127.0.0.1:9099", { disableWarnings: true });
    D.connectDatabaseEmulator(st.fb.db, "127.0.0.1", 9000);
  }
  D.onValue(D.ref(st.fb.db, ".info/serverTimeOffset"), (s) => { st.offset = s.val() || 0; });
  return st.fb;
}
const ref = (p) => st.fb.D.ref(st.fb.db, p);

async function ensureUser() {
  const fb = await loadFirebase();
  await fb.auth.authStateReady();
  if (!fb.auth.currentUser) await fb.A.signInAnonymously(fb.auth);
  return fb.auth.currentUser.uid;
}

async function signInGoogle() {
  const fb = await loadFirebase();
  const provider = new fb.A.GoogleAuthProvider();
  try { await fb.A.signInWithPopup(fb.auth, provider); }
  catch (e) { say(friendly(e), true); }
}
async function signOutOwner() {
  stopRefresh();
  if (st.seat) await leaveTable();
  await st.fb.A.signOut(st.fb.auth);
  await ensureUser();
}

// Who am I? Called whenever the sign-in changes.
async function onUser(user) {
  st.uid = user ? user.uid : null;
  st.google = !!(user && user.providerData.some((p) => p.providerId === "google.com"));
  st.admin = false;
  st.mineId = null; st.myCodes = {};
  stopRefresh();
  if (user && st.google) {
    try { st.admin = (await st.fb.D.get(ref(`admins/${user.uid}`))).val() === true; } catch { st.admin = false; }
    try {
      const q = st.fb.D.query(ref("restaurants"), st.fb.D.orderByChild("owner"), st.fb.D.equalTo(user.uid));
      const snap = await st.fb.D.get(q);
      snap.forEach((c) => { st.mineId = st.mineId || c.key; });
    } catch (e) { say(friendly(e), true); }
    if (st.mineId) await loadMyCodes();
  }
  startRefresh();
  paintOwner();
}

// ───────────── the public list of restaurants ─────────────
function listenRestaurants() {
  st.fb.D.onValue(ref("restaurants"), (snap) => {
    st.restaurants = snap.val() || {};
    // owner: make sure every table has a working code (first load, approval, new table)
    const mine = st.restaurants[st.mineId];
    if (mine && mine.open && Object.keys(mine.tables || {}).some((t) => !st.myCodes[t] || !st.codeInfo[st.myCodes[t]] || st.codeInfo[st.myCodes[t]].expires <= serverNow())) refreshCodes();
    paintGuest(); paintOwner();
  }, (e) => { say(friendly(e), true); });
}

// ───────────── owner: claim and manage ─────────────
async function lookUpPlace(id) {
  const [type, num] = id.split("-");
  const url = `https://nominatim.openstreetmap.org/lookup?format=json&osm_ids=${type[0].toUpperCase()}${num}`;
  const res = await fetch(url, { headers: { "Accept-Language": "en-GB" } });
  const list = await res.json();
  if (!list.length) return null;
  const p = list[0];
  return { name: clampText(p.name || String(p.display_name || "").split(",")[0], 60), lat: Number(p.lat), lon: Number(p.lon), address: p.display_name };
}
async function claim(raw) {
  const id = osmId(raw);
  if (!id) { say("Paste an OpenStreetMap link like openstreetmap.org/node/123456, or type node/123456.", true); return; }
  if (st.restaurants[id]) { say("That place is already claimed.", true); return; }
  say("Looking the place up on OpenStreetMap…");
  let place = null;
  try { place = await lookUpPlace(id); } catch { /* lookup is a helper only */ }
  const name = clampText(prompt("Name of your restaurant", (place && place.name) || "") || "", 60);
  if (!name) { say("Claim cancelled."); return; }
  const { D } = st.fb;
  const data = { owner: st.uid, name, approved: false, open: false, claimed: D.serverTimestamp() };
  if (place && isFinite(place.lat) && isFinite(place.lon)) { data.lat = place.lat; data.lon = place.lon; }
  try {
    await D.set(ref(`restaurants/${id}`), data);
    st.mineId = id;
    say("Claimed. Mateusz will check it and approve it soon.");
  } catch (e) { say(friendly(e), true); }
  paintOwner();
}
async function loadMyCodes() {
  try { st.myCodes = (await st.fb.D.get(ref(`ownerCodes/${st.mineId}`))).val() || {}; } catch { st.myCodes = {}; }
  for (const code of Object.values(st.myCodes)) {
    try { const v = (await st.fb.D.get(ref(`tableCodes/${code}`))).val(); st.codeInfo[code] = v || { expires: 0 }; }
    catch { st.codeInfo[code] = { expires: 0 }; }   // expired codes cannot be read any more
  }
}
// Write (or extend) the code for one table. Reusing the same code keeps a
// printed sheet working when the owner comes back after the code ran out.
async function putCode(tid, code) {
  const { D } = st.fb;
  const expires = serverNow() + KEEP_MS - 60000;
  await D.set(ref(`tableCodes/${code}`), { r: st.mineId, table: tid, owner: st.uid, expires });
  await D.set(ref(`ownerCodes/${st.mineId}/${tid}`), code);
  st.myCodes[tid] = code;
  st.codeInfo[code] = { expires };
}
async function freshCode(tid) {
  for (let i = 0; i < 6; i += 1) {
    try { const c = newCode(); await putCode(tid, c); return c; }
    catch (e) { if (!denied(e)) throw e; }   // taken by someone else: try another
  }
  throw new Error("Could not make a table code.");
}
async function refreshCodes() {
  const r = st.restaurants[st.mineId];
  if (!r || !r.approved || !r.open || !st.google || st.refreshing) return;
  st.refreshing = true;
  try { await refreshAll(r); } finally { st.refreshing = false; }
}
async function refreshAll(r) {
  for (const tid of Object.keys(r.tables || {})) {
    const code = st.myCodes[tid];
    try { if (code) await putCode(tid, code); else await freshCode(tid); }
    catch (e) { if (code) { try { await freshCode(tid); } catch { /* try again next time */ } } }
  }
  paintOwner();
}
function startRefresh() {
  stopRefresh();
  if (!st.mineId) return;
  refreshCodes();
  st.refreshTimer = setInterval(refreshCodes, REFRESH_MS);
}
function stopRefresh() { if (st.refreshTimer) clearInterval(st.refreshTimer); st.refreshTimer = null; }

async function setOpen(open) {
  try {
    await st.fb.D.set(ref(`restaurants/${st.mineId}/open`), open);
    st.restaurants[st.mineId].open = open;
    if (open) await refreshCodes();
  } catch (e) { say(friendly(e), true); }
}
async function addTable() {
  const name = clampText(prompt("Table name (for example: Window 1)", "Table " + (Object.keys(myTables()).length + 1)) || "", 30);
  if (!name) return;
  const tid = newTableId();
  try {
    await st.fb.D.set(ref(`restaurants/${st.mineId}/tables/${tid}`), { name });
    st.restaurants[st.mineId].tables = { ...myTables(), [tid]: { name } };
    await refreshCodes();
  } catch (e) { say(friendly(e), true); }
  paintOwner();
}
async function renameTable(tid) {
  const name = clampText(prompt("New table name", myTables()[tid].name) || "", 30);
  if (!name) return;
  try { await st.fb.D.set(ref(`restaurants/${st.mineId}/tables/${tid}/name`), name); } catch (e) { say(friendly(e), true); }
}
async function removeTable(tid) {
  if (!confirm(`Remove "${myTables()[tid].name}"? Everyone at it is removed and its code stops working.`)) return;
  const { D } = st.fb;
  const code = st.myCodes[tid];
  try {
    await D.remove(ref(`tables/${st.mineId}/${tid}`));
    if (code) await D.remove(ref(`tableCodes/${code}`)).catch(() => {});
    await D.remove(ref(`ownerCodes/${st.mineId}/${tid}`));
    await D.remove(ref(`restaurants/${st.mineId}/tables/${tid}`));
    delete st.myCodes[tid];
  } catch (e) { say(friendly(e), true); }
}
async function renewCode(tid) {
  if (!confirm("Make a new code for this table? The old code stops working and the people at the table are removed.")) return;
  const { D } = st.fb;
  const old = st.myCodes[tid];
  try {
    await D.remove(ref(`tables/${st.mineId}/${tid}`));
    if (old) await D.remove(ref(`tableCodes/${old}`)).catch(() => {});
    await freshCode(tid);
  } catch (e) { say(friendly(e), true); }
  paintOwner();
}
async function approve(id, yes) {
  try {
    if (yes) await st.fb.D.set(ref(`restaurants/${id}/approved`), true);
    else if (confirm("Refuse and delete this claim?")) await st.fb.D.remove(ref(`restaurants/${id}`));
  } catch (e) { say(friendly(e), true); }
}
const myTables = () => ((st.restaurants[st.mineId] || {}).tables || {});

// ───────────── printable sheet ─────────────
function loadQr() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  return new Promise((ok, bad) => {
    const s = document.createElement("script");
    s.src = QR_LIBRARY; s.onload = () => ok(window.qrcode); s.onerror = bad;
    document.head.appendChild(s);
  });
}
async function printSheet() {
  const r = st.restaurants[st.mineId];
  const win = window.open("", "_blank");
  if (!win) { say("The browser blocked the new window. Allow pop-ups and try again.", true); return; }
  let qr = null;
  try { qr = await loadQr(); } catch { /* the codes and links still print */ }
  const doc = win.document;
  doc.title = `${r.name} — table codes`;
  const css = doc.createElement("style");
  css.textContent = "body{font-family:system-ui,sans-serif;margin:20px;color:#111}" +
    ".card{display:inline-block;width:46%;margin:1%;padding:16px;border:2px dashed #999;border-radius:12px;text-align:center;vertical-align:top;page-break-inside:avoid;box-sizing:border-box}" +
    ".code{font:700 30px monospace;letter-spacing:4px}.link{font-size:11px;word-break:break-all;color:#555}" +
    "img{width:180px;height:180px;image-rendering:pixelated}@media print{button{display:none}}";
  doc.head.appendChild(css);
  const add = (tag, text, cls) => { const e = doc.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };
  const top = add("h1", `🍽️ ${r.name}`);
  const btn = add("button", "🖨️ Print"); btn.onclick = () => win.print();
  doc.body.append(top, btn, add("p", "Scan the code with your phone camera, or open Trip21 and type the code in the useRbox, Restaurants section."));
  Object.entries(r.tables || {}).forEach(([tid, t]) => {
    const code = st.myCodes[tid];
    const card = add("div", "", "card");
    card.append(add("h2", t.name));
    if (code) {
      const link = tableLink(code);
      if (qr) {
        const q = qr(0, "M"); q.addData(link); q.make();
        const img = doc.createElement("img"); img.src = q.createDataURL(6, 2); img.alt = "Scannable code for " + t.name;
        card.append(img);
      }
      card.append(add("div", code, "code"), add("div", link, "link"));
    } else card.append(add("p", "No code yet. Open the restaurant first."));
    doc.body.append(card);
  });
  doc.body.append(add("p", "A code keeps working while the restaurant's owner has Trip21 open, and for 4 hours after they leave."));
}

// ───────────── guest: sitting at a table ─────────────
async function joinTable(raw) {
  const code = cleanCode(raw);
  if (!code) { say("A table code has 6 letters or numbers.", true, "guest"); return; }
  if (st.seat) await leaveTable();
  say("Finding your table…", false, "guest");
  try {
    await ensureUser();
    const { D } = st.fb;
    let info = null;
    try { info = (await D.get(ref(`tableCodes/${code}`))).val(); } catch (e) { if (!denied(e)) throw e; }
    if (!info) { say("That code does not work. It may be wrong or it has run out.", true, "guest"); return; }
    await D.set(ref(`tables/${info.r}/${info.table}/members/${st.fb.auth.currentUser.uid}`), {
      name: clampText(myName(), 30) || "Traveller", color: colourFor(st.fb.auth.currentUser.uid), joined: D.serverTimestamp(), code
    });
    st.seat = { code, r: info.r, t: info.table, expires: info.expires };
    const u = new URL(location.href); u.searchParams.set("table", code); history.replaceState(null, "", u);
    attachSeat();
    say("", false, "guest");
  } catch (e) {
    say(denied(e) ? "The restaurant is closed, or the code has run out." : friendly(e), true, "guest");
  }
  paintGuest(); paintTable();
}
function attachSeat() {
  const { D } = st.fb;
  const s = st.seat;
  const base = `tables/${s.r}/${s.t}`;
  const uid = st.fb.auth.currentUser.uid;
  const on = (q, fn, err) => st.seatOffs.push(D.onValue(q, fn, err || (() => {})));
  const gone = (why) => () => { if (st.seat) { teardownSeat(); say(why, true, "guest"); paintGuest(); paintTable(); } };
  on(ref(`${base}/members`), (snap) => {
    st.members = snap.val() || {};
    if (!st.members[uid]) { gone("You are no longer at the table (the owner may have renewed the code).")(); return; }
    paintTable();
  }, gone("The table code has run out or the restaurant closed, so you have left the table."));
  on(ref(`${base}/presence`), (snap) => { st.presence = snap.val() || {}; paintTable(); });
  on(D.query(ref(`${base}/chat`), D.orderByKey(), D.limitToLast(CHAT_SIZE)), (snap) => {
    st.chat = []; snap.forEach((c) => { st.chat.push(c.val()); }); paintTable();
  });
  on(ref(`tableCodes/${s.code}/expires`), (snap) => { if (snap.val()) s.expires = snap.val(); paintTable(); },
    gone("The table code has run out, so you have left the table."));
  on(ref(".info/connected"), async (snap) => {
    if (snap.val() !== true || !st.seat) return;
    try {
      const pres = ref(`${base}/presence/${uid}`);
      await D.onDisconnect(pres).remove();
      await D.set(pres, { online: true, lastSeen: D.serverTimestamp() });
    } catch { /* not allowed any more */ }
  });
  const tick = setInterval(() => {
    if (st.seat && st.seat.expires && st.seat.expires <= serverNow()) gone("The table code has run out, so you have left the table.")();
    else paintTable();
  }, 30000);
  st.seatOffs.push(() => clearInterval(tick));
}
function teardownSeat() {
  st.seatOffs.forEach((off) => { try { off(); } catch { /* gone */ } });
  st.seatOffs = []; st.seat = null; st.members = {}; st.presence = {}; st.chat = [];
  const u = new URL(location.href); u.searchParams.delete("table"); history.replaceState(null, "", u);
}
async function leaveTable() {
  if (!st.seat) return;
  const { D } = st.fb;
  const s = st.seat; const uid = st.fb.auth.currentUser.uid;
  try {
    await D.onDisconnect(ref(`tables/${s.r}/${s.t}/presence/${uid}`)).cancel();
    await D.remove(ref(`tables/${s.r}/${s.t}/presence/${uid}`)).catch(() => {});
    await D.remove(ref(`tables/${s.r}/${s.t}/members/${uid}`));
  } catch { /* best effort */ }
  teardownSeat(); paintGuest(); paintTable();
}
async function sendChat(text) {
  const t = clampText(text, 300);
  if (!t || !st.seat) return;
  const { D } = st.fb;
  try {
    await D.set(D.push(ref(`tables/${st.seat.r}/${st.seat.t}/chat`)), {
      by: st.fb.auth.currentUser.uid, name: clampText(myName(), 30) || "Traveller", text: t, t: D.serverTimestamp()
    });
  } catch (e) { say(friendly(e), true, "guest"); }
}

// ───────────── drawing ─────────────
const CSS = `
  #useRbox .rt-tab-list button, #useRbox .rt-own button { margin: 2px 2px 2px 0; }
  #useRbox .rt-rest { margin: 6px 0; padding: 6px 8px; border: 1px solid rgba(196,176,106,.4); border-radius: 8px; }
  #useRbox .rt-rest b { display: block; }
  #useRbox .rt-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  #useRbox .rt-row input { flex: 1 1 120px; min-width: 0; }
  #useRbox .rt-msg { font-size: 12px; margin: 4px 0; min-height: 1em; }
  #useRbox .rt-msg.bad { color: #ff7b7b; }
  #useRbox .rt-code { font: 700 14px monospace; letter-spacing: 2px; }
  #useRbox .rt-uid { font: 11px monospace; word-break: break-all; opacity: .8; }
  #rt-table { position: fixed; right: 12px; bottom: 12px; width: min(360px, calc(100vw - 24px)); max-height: min(70vh, 560px);
    display: none; flex-direction: column; z-index: 10050; background: #15161c; color: #eee; border: 1px solid #c4b06a;
    border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,.5); font: 14px system-ui, sans-serif; }
  #rt-table.open { display: flex; }
  #rt-table header { padding: 10px 12px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; gap: 8px; align-items: center; }
  #rt-table header small { display: block; opacity: .7; }
  #rt-table .people { padding: 6px 12px; font-size: 12px; border-bottom: 1px solid #333; }
  #rt-table .people span { display: inline-block; margin: 2px 8px 2px 0; }
  #rt-table .chat { flex: 1; overflow: auto; padding: 8px 12px; }
  #rt-table .chat p { margin: 0 0 6px; word-wrap: break-word; }
  #rt-table form { display: flex; gap: 6px; padding: 8px; border-top: 1px solid #333; }
  #rt-table input { flex: 1; min-width: 0; padding: 7px; border-radius: 6px; border: 1px solid #555; background: #0d0e12; color: #eee; }
  #rt-table button { background: #c4b06a; color: #111; border: 0; border-radius: 6px; padding: 7px 10px; font-weight: 700; cursor: pointer; }
`;
function say(text, bad, where = "owner") {
  const el = where === "guest" ? st.ui.guestMsg : st.ui.ownerMsg;
  if (!el) return;
  el.textContent = text || "";
  el.classList.toggle("bad", !!bad);
}
function fold(title, open) {
  const body = h("div", { className: "rb-fold-body" });
  const d = h("details", { className: "rb-fold rt-fold", open }, h("summary", {}, title), body);
  return { d, body };
}
function btn(text, onclick, cls = "btn") { return h("button", { type: "button", className: cls, onclick }, text); }

function paintGuest() {
  const box = st.ui.guestList;
  if (!box) return;
  box.replaceChildren();
  if (st.seat) {
    const r = st.restaurants[st.seat.r] || {};
    const t = ((r.tables || {})[st.seat.t] || {}).name || "a table";
    box.append(h("div", { className: "rt-rest" }, h("b", {}, `You are at ${t}, ${r.name || "a restaurant"}`),
      btn("💬 Open the table", () => st.ui.panel.classList.add("open")), btn("Leave", leaveTable)));
  }
  const open = Object.entries(st.restaurants).filter(([, r]) => r.approved && r.open && r.tables && Object.keys(r.tables).length);
  if (!open.length) { box.append(h("div", { className: "rb-empty" }, "No restaurants open right now")); return; }
  open.forEach(([id, r]) => {
    const map = r.lat != null ? h("a", { href: `https://www.openstreetmap.org/${id.replace("-", "/")}`, target: "_blank", rel: "noopener" }, "📍 map") : null;
    box.append(h("div", { className: "rt-rest" }, h("b", {}, "🍽️ " + r.name), map,
      h("div", { className: "rt-tab-list" }, Object.values(r.tables).map((t) => btn("🪑 " + t.name, () => {
        st.ui.codeInput.focus(); say(`Type the code you see on "${t.name}".`, false, "guest");
      }, "btn rt-small")))));
  });
}

function paintOwner() {
  const box = st.ui.owner;
  if (!box || !st.fb) return;
  box.replaceChildren();
  if (!st.google) {
    box.append(h("small", {}, "Own a restaurant? Sign in with Google to set up tables where your guests can talk to each other."),
      btn("🔑 Sign in with Google", signInGoogle));
    return;
  }
  const u = st.fb.auth.currentUser;
  box.append(h("small", {}, `Signed in as ${u.displayName || u.email || "owner"}. `), btn("Sign out", signOutOwner, "btn rt-small"),
    h("div", { className: "rt-uid" }, "Your user id: " + u.uid));
  const r = st.mineId && st.restaurants[st.mineId];
  if (!r) {
    const input = h("input", { type: "text", placeholder: "openstreetmap.org/node/123456" });
    box.append(h("div", { className: "rb-subtitle" }, "CLAIM YOUR RESTAURANT"),
      h("small", {}, "Find your place on openstreetmap.org, click it, and paste the link here."),
      h("div", { className: "rt-row" }, input, btn("Claim", () => claim(input.value))));
  } else if (!r.approved) {
    box.append(h("p", {}, `⏳ "${r.name}" is waiting for approval by Mateusz.`));
  } else {
    box.append(h("div", { className: "rb-subtitle" }, "🍽️ " + r.name),
      h("div", { className: "rt-row" },
        h("label", { className: "toggle" }, h("input", { type: "checkbox", checked: !!r.open, onchange: (e) => setOpen(e.target.checked) }), h("span", {}, r.open ? "🟢 Open" : "🔴 Closed")),
        btn("✏️ Rename", async () => { const n = clampText(prompt("Restaurant name", r.name) || "", 60); if (n) try { await st.fb.D.set(ref(`restaurants/${st.mineId}/name`), n); } catch (e) { say(friendly(e), true); } }, "btn rt-small")));
    const tables = Object.entries(r.tables || {});
    if (!tables.length) box.append(h("small", {}, "No tables yet."));
    tables.forEach(([tid, t]) => {
      const code = st.myCodes[tid];
      const exp = code && st.codeInfo[code] ? st.codeInfo[code].expires : 0;
      box.append(h("div", { className: "rt-rest" }, h("b", {}, "🪑 " + t.name),
        h("div", {}, code ? h("span", { className: "rt-code" }, code) : "no code yet", code ? ` · ${r.open ? untilText(exp) : "closed"}` : ""),
        h("div", { className: "rt-row" }, btn("Rename", () => renameTable(tid), "btn rt-small"), btn("🔄 New code", () => renewCode(tid), "btn rt-small"),
          code ? btn("Sit here", () => joinTable(code), "btn rt-small") : null, btn("🗑️ Remove", () => removeTable(tid), "btn rt-small"))));
    });
    box.append(h("div", { className: "rt-row" }, btn("➕ Add a table", addTable), tables.length ? btn("🖨️ Printable sheet", printSheet) : null),
      h("small", {}, "Codes keep working while you have Trip21 open, and for 4 hours after you leave. A new code removes the people at that table."));
  }
  if (st.admin) {
    const waiting = Object.entries(st.restaurants).filter(([, x]) => !x.approved);
    box.append(h("div", { className: "rb-subtitle" }, `🛡️ CLAIMS WAITING (${waiting.length})`));
    waiting.forEach(([id, x]) => box.append(h("div", { className: "rt-rest" }, h("b", {}, x.name),
      h("a", { href: `https://www.openstreetmap.org/${id.replace("-", "/")}`, target: "_blank", rel: "noopener" }, id),
      h("div", { className: "rt-uid" }, "owner " + x.owner),
      h("div", { className: "rt-row" }, btn("✅ Approve", () => approve(id, true), "btn rt-small"), btn("❌ Refuse", () => approve(id, false), "btn rt-small")))));
  }
}

function paintTable() {
  const p = st.ui.panel;
  if (!p) return;
  if (!st.seat) { p.classList.remove("open"); return; }
  const r = st.restaurants[st.seat.r] || {};
  st.ui.title.textContent = `🍽️ ${((r.tables || {})[st.seat.t] || {}).name || "Table"} · ${r.name || ""}`;
  st.ui.sub.textContent = st.seat.expires ? "Code " + st.seat.code + " · " + untilText(st.seat.expires) : "";
  st.ui.people.replaceChildren(...Object.entries(st.members).map(([uid, m]) =>
    h("span", { style: `color:${m.color}` }, (st.presence[uid] && st.presence[uid].online ? "● " : "○ ") + m.name)));
  const atBottom = st.ui.chat.scrollTop + st.ui.chat.clientHeight >= st.ui.chat.scrollHeight - 20;
  st.ui.chat.replaceChildren(...(st.chat.length ? st.chat.map((m) => h("p", {}, h("b", {}, m.name + ": "), m.text)) : [h("p", { style: "opacity:.6" }, "Say hello to your table!")]));
  if (atBottom) st.ui.chat.scrollTop = st.ui.chat.scrollHeight;
}

function buildPanel() {
  const input = h("input", { type: "text", maxLength: 300, placeholder: "Message the table…" });
  const title = h("b"); const sub = h("small"); const people = h("div", { className: "people" }); const chat = h("div", { className: "chat" });
  const panel = h("div", { id: "rt-table" },
    h("header", {}, h("div", {}, title, sub), h("div", {}, btn("–", () => panel.classList.remove("open"), ""), " ", btn("Leave", leaveTable, ""))),
    people, chat,
    h("form", { onsubmit: (e) => { e.preventDefault(); sendChat(input.value); input.value = ""; } }, input, h("button", { type: "submit" }, "Send")));
  document.body.append(panel);
  Object.assign(st.ui, { panel, title, sub, people, chat });
}

function buildUserbox(left, right) {
  document.head.append(h("style", {}, CSS));
  // 🍽️ guests, left section (after the folds trip21-userbox.js adds)
  const g = fold("🍽️ RESTAURANTS", !!new URLSearchParams(location.search).get("table"));
  const codeInput = h("input", { type: "text", placeholder: "Table code, for example K7QX2M", maxLength: 8, style: "text-transform:uppercase" });
  st.ui.guestMsg = h("div", { className: "rt-msg" });
  st.ui.guestList = h("div");
  st.ui.codeInput = codeInput;
  g.body.append(h("div", { className: "rt-row" }, codeInput, btn("🪑 Join table", () => joinTable(codeInput.value))), st.ui.guestMsg, st.ui.guestList);
  codeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") joinTable(codeInput.value); });
  const groupFold = [...left.querySelectorAll(":scope > details.rt21-fold")].pop();
  if (groupFold) groupFold.after(g.d);
  else { const tt = left.querySelector(".rb-col-title"); left.insertBefore(g.d, tt ? tt.nextSibling : left.firstChild); }
  // 🍽️ owners, settings (right section)
  if (right) {
    const o = fold("🍽️ MY RESTAURANT (TRIP21)", false);
    st.ui.owner = h("div", { className: "rt-own" });
    st.ui.ownerMsg = h("div", { className: "rt-msg" });
    o.body.append(st.ui.owner, st.ui.ownerMsg);
    right.insertBefore(o.d, right.firstChild);
  }
}

async function start(left, right) {
  buildUserbox(left, right);
  buildPanel();
  try {
    await ensureUser();
    listenRestaurants();
    st.fb.A.onAuthStateChanged(st.fb.auth, (u) => { if (u) onUser(u); });
    const code = new URLSearchParams(location.search).get("table");
    if (code) {
      await joinTable(code);
      if (st.seat) st.ui.panel.classList.add("open");
    }
  } catch (e) { say(friendly(e), true, "guest"); }
}

function waitForBox() {
  const go = () => {
    const left = document.querySelector("#useRbox .rb-col-left");
    if (!left) return false;
    start(left, document.querySelector("#useRbox .rb-col-right"));
    return true;
  };
  if (go()) return;
  const obs = new MutationObserver(() => { if (go()) obs.disconnect(); });
  obs.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => obs.disconnect(), 20000);
}
// Wait a moment so trip21-userbox.js has added its folds first.
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(waitForBox, 0));
else setTimeout(waitForBox, 0);

window.RudTables = { join: joinTable, leave: leaveTable, osmId };
