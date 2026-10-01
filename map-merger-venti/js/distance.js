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
class WalkTracker {
  constructor(petId, walkId, channelId) {
    this.petId = petId;
    this.walkId = walkId;
    this.channelId = channelId;
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
    if (!db) return;
    // Get current position from map state
    const currentPos = this.getCurrentPosition();
    if (!currentPos) return;

    if (this.lastPos) {
      const segmentKm = haversine(this.lastPos, currentPos);
      if (segmentKm > 0.005 && segmentKm < 1.0) { // > 5m and < 1km (sanity)
        this.totalDistance += segmentKm;
        this.lastPos = currentPos;

        // Save breadcrumb
        const crumb = { lat: currentPos.lat, lng: currentPos.lng, t: Date.now() };
        this.breadcrumbs.push(crumb);

        // Update Firebase
        if (db) {
          db.ref(`walk_history/${this.petId}/${this.walkId}/path`).push(crumb);
          db.ref(`walk_history/${this.petId}/${this.walkId}`).update({
            distance_km: Math.round(this.totalDistance * 100) / 100,
            duration_mins: Math.round((Date.now() - this.startTime) / 60000)
          });
          if (this.channelId) {
            db.ref(`mapmergerventi/active_pets/${this.channelId}/${this.petId}`).update({
              session_distance_km: Math.round(this.totalDistance * 100) / 100
            });
          }
        }
      }
    } else {
      this.lastPos = currentPos;
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

  async finish() {
    this.stop();
    if (!db) return;
    // Update walk history
    await db.ref(`walk_history/${this.petId}/${this.walkId}`).update({
      ended_at: Date.now(),
      distance_km: this.getDistanceKm(),
      duration_mins: this.getDurationMins(),
      status: 'completed'
    });
    // Update pet lifetime stats
    const statsRef = db.ref(`snoutfirst/pets/${this.petId}/stats`);
    await statsRef.transaction(stats => {
      if (!stats) stats = { lifetime_distance_km: 0, total_walks: 0, total_feedings: 0 };
      stats.lifetime_distance_km = Math.round((stats.lifetime_distance_km + this.totalDistance) * 100) / 100;
      stats.total_walks = (stats.total_walks || 0) + 1;
      stats.last_walked = Date.now();
      return stats;
    });
  }
}
