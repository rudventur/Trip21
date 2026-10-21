// ═══════════════════════════════════════════════════════════════
//  distance.js — Haversine formula + walk tracking
// ═══════════════════════════════════════════════════════════════

function haversine(pos1, pos2) {
  const R = 6371; // Earth radius km
  const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
  const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Walk tracker instance
// Privacy: the route is recorded on THIS DEVICE ONLY (local storage key
// 'sf_walks'). Nothing is streamed to the shared database while walking.
// At the end the walker is asked whether to share the walk; only then a
// summary with a rough route (rounded to about 100 m) is sent — see shareWalk().
const WALKS_KEY = 'sf_walks';
const WALKS_KEEP = 20;          // walks kept on this device
const SHARED_PATH_MAX = 200;    // points in a shared route (database rules cap it too)

class WalkTracker {
  constructor(petId, walkId) {
    this.petId = petId;
    this.walkId = walkId;
    this.totalDistance = 0;
    this.lastPos = null;
    this.startTime = Date.now();
    this.interval = null;
    this.breadcrumbs = [];
  }

  start() {
    this.interval = setInterval(() => this.tick(), 5000);
  }

  tick() {
    const currentPos = this.getCurrentPosition();
    if (!currentPos) return;

    if (this.lastPos) {
      const segmentKm = haversine(this.lastPos, currentPos);
      if (segmentKm > 0.005 && segmentKm < 1.0) { // > 5m and < 1km (sanity)
        this.totalDistance += segmentKm;
        this.lastPos = currentPos;
        // Breadcrumb stays in memory / on this device only
        this.breadcrumbs.push({ lat: currentPos.lat, lng: currentPos.lng, t: Date.now() });
      }
    } else {
      this.lastPos = currentPos;
      this.breadcrumbs.push({ lat: currentPos.lat, lng: currentPos.lng, t: Date.now() });
    }
  }

  // Override this to get position from your map
  getCurrentPosition() {
    // Snout First: use S.lat, S.lon
    if (typeof S !== 'undefined' && S.lat !== undefined) {
      return { lat: S.lat, lng: S.lon || S.lng };
    }
    // Map Merger: use G.pos
    if (typeof G !== 'undefined' && G.pos) {
      return { lat: G.pos.lat, lng: G.pos.lng };
    }
    return null;
  }

  getDistanceKm() {
    return Math.round(this.totalDistance * 100) / 100;
  }

  getDurationMins() {
    return Math.round((Date.now() - this.startTime) / 60000);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  // Ends the walk: saves it on this device, updates the pet's totals
  // (the owner's own pet record) and returns the walk summary.
  async finish() {
    this.stop();
    const walk = {
      id: this.walkId,
      pet_id: this.petId,
      started_at: this.startTime,
      ended_at: Date.now(),
      distance_km: this.getDistanceKm(),
      duration_mins: this.getDurationMins(),
      path: this.breadcrumbs
    };
    try {
      const walks = JSON.parse(localStorage.getItem(WALKS_KEY) || '[]');
      walks.push(walk);
      localStorage.setItem(WALKS_KEY, JSON.stringify(walks.slice(-WALKS_KEEP)));
    } catch (e) { console.warn('Walk not saved on device:', e); }

    if (typeof isSharing === 'function' && isSharing()) {
      const statsRef = db.ref(`snoutfirst/pets/${this.petId}/stats`);
      await statsRef.transaction(stats => {
        if (!stats) stats = { lifetime_distance_km: 0, total_walks: 0, total_feedings: 0 };
        stats.lifetime_distance_km = Math.round(((stats.lifetime_distance_km || 0) + this.totalDistance) * 100) / 100;
        stats.total_walks = (stats.total_walks || 0) + 1;
        stats.last_walked = Date.now();
        return stats;
      }).catch(e => console.warn('Walk totals not saved:', e));
    }
    return walk;
  }
}

// Share one finished walk — only called after the walker says yes.
// Coordinates are rounded to 3 decimals (about 100 m) and the route is thinned.
async function shareWalk(walk, petName) {
  if (typeof isSharing !== 'function' || !isSharing() || !walk) return false;
  const pts = walk.path || [];
  const step = Math.max(1, Math.ceil(pts.length / SHARED_PATH_MAX));
  const path = [];
  for (let i = 0; i < pts.length && path.length < SHARED_PATH_MAX; i += step) {
    path.push({ lat: roundShared(pts[i].lat), lng: roundShared(pts[i].lng) });
  }
  const uid = getUid();
  const key = db.ref(`snoutfirst/shared_walks/${uid}`).push().key;
  const data = {
    owner_uid: uid,
    pet_id: safeId(walk.pet_id).slice(0, 40),
    pet_name: String(petName || '').slice(0, 40),
    started_at: Math.min(walk.started_at, Date.now()),
    ended_at: firebase.database.ServerValue.TIMESTAMP,
    distance_km: Math.min(walk.distance_km, 500),
    duration_mins: Math.min(walk.duration_mins, 1440)
  };
  if (path.length) data.path = path;
  try {
    await db.ref(`snoutfirst/shared_walks/${uid}/${key}`).set(data);
    return true;
  } catch (e) {
    console.warn('Walk not shared:', e);
    return false;
  }
}
