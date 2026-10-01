// ═══════════════════════════════════════════════════════════════
//  functions/index.js — Snout First tracker relays
//
//  These functions exist because Tractive's API has no CORS headers,
//  so a browser can never call it directly (confirmed by hand — see
//  commit history). This is a pure pass-through: a user's email and
//  password come in, go straight to Tractive, and only the resulting
//  pet locations go back out. Nothing is written to a database,
//  nothing is logged. If you're extending this file, keep that
//  invariant — never console.log(email/password/access_token), never
//  add a db.ref(...).set() call anywhere in this relay.
//
//  1st-gen functions (not v2) on purpose: the URL is predictable —
//  https://europe-west1-map-merger-venti.cloudfunctions.net/tractiveSync
//  — as soon as it's deployed, with nothing to copy back into the
//  client code afterward.
// ═══════════════════════════════════════════════════════════════

const functions = require('firebase-functions');

// Reverse-engineered from the aiotractive project (community-maintained,
// unofficial — not affiliated with Tractive GmbH). Tractive has no public
// API; this client ID is what their own web/app clients send.
const TRACTIVE_CLIENT_ID = '625e533dc3c3b41c28a669f0';
const TRACTIVE_BASE = 'https://graph.tractive.com/4';

const ALLOWED_ORIGINS = [
  'https://rudventur.github.io',
];
const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function applyCors(req, res) {
  const origin = req.get('Origin') || '';
  if (ALLOWED_ORIGINS.includes(origin) || LOCAL_ORIGIN_RE.test(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

function tractiveHeaders(extra) {
  return Object.assign({
    'x-tractive-client': TRACTIVE_CLIENT_ID,
    'content-type': 'application/json;charset=UTF-8',
    'accept': 'application/json, text/plain, */*',
  }, extra || {});
}

async function tractiveLogin(email, password) {
  const res = await fetch(`${TRACTIVE_BASE}/auth/token`, {
    method: 'POST',
    headers: tractiveHeaders(),
    body: JSON.stringify({
      platform_email: email,
      platform_token: password,
      grant_type: 'tractive',
    }),
  });
  if (!res.ok) {
    const err = new Error('tractive_auth_failed');
    err.status = res.status;
    throw err;
  }
  return res.json(); // { user_id, access_token, ... }
}

async function tractiveGet(path, auth) {
  const res = await fetch(`${TRACTIVE_BASE}/${path}`, {
    headers: tractiveHeaders({
      'x-tractive-user': auth.user_id,
      'authorization': `Bearer ${auth.access_token}`,
    }),
  });
  if (!res.ok) {
    const err = new Error('tractive_request_failed:' + path);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Position report field names weren't verifiable without a live account —
// this checks the shapes the community client is known to use, and falls
// back gracefully rather than throwing if Tractive's response differs.
function extractLatLon(posReport) {
  if (!posReport) return null;
  if (Array.isArray(posReport.latlong) && posReport.latlong.length === 2) {
    return { lat: posReport.latlong[0], lon: posReport.latlong[1] };
  }
  if (typeof posReport.lat === 'number' && typeof posReport.lon === 'number') {
    return { lat: posReport.lat, lon: posReport.lon };
  }
  if (typeof posReport.latitude === 'number' && typeof posReport.longitude === 'number') {
    return { lat: posReport.latitude, lon: posReport.longitude };
  }
  return null;
}

exports.tractiveSync = functions.region('europe-west1').https.onRequest(async (req, res) => {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST' });
    return;
  }

  const { email, password } = req.body || {};
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Missing email or password' });
    return;
  }

  try {
    const auth = await tractiveLogin(email, password);

    const [trackers, trackableObjects] = await Promise.all([
      tractiveGet(`user/${auth.user_id}/trackers`, auth),
      tractiveGet(`user/${auth.user_id}/trackable_objects`, auth),
    ]);

    const trackerList = Array.isArray(trackers) ? trackers : (trackers.trackers || []);
    const petList = Array.isArray(trackableObjects) ? trackableObjects : (trackableObjects.trackable_objects || []);

    const positions = await Promise.all(
      trackerList.map(t =>
        tractiveGet(`device_pos_report/${t._id || t.id}`, auth).catch(() => null)
      )
    );

    const pets = petList.map(pet => {
      const trackerId = pet.device_id || pet.tracker_id;
      const trackerIdx = trackerList.findIndex(t => (t._id || t.id) === trackerId);
      const pos = trackerIdx >= 0 ? extractLatLon(positions[trackerIdx]) : null;
      return {
        name: pet.details ? pet.details.name : pet.name,
        source: 'tractive',
        lat: pos ? pos.lat : null,
        lon: pos ? pos.lon : null,
      };
    }).filter(p => p.lat != null && p.lon != null);

    res.status(200).json({ pets });
  } catch (e) {
    if (e.status === 401 || e.status === 403) {
      res.status(401).json({ error: "Couldn't log in to Tractive — check the email and password." });
    } else {
      res.status(502).json({ error: 'Tractive relay failed — their API may have changed. Try again later.' });
    }
  }
});
