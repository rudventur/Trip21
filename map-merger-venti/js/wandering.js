// ═══════════════════════════════════════════════════════════════
//  wandering.js — Autonomous pet wandering when walker disconnects
// ═══════════════════════════════════════════════════════════════

const WANDER_VEHICLES = [
  { id: 'walk', emoji: '🚶', speed: 0.00003, label: 'Walking' },
  { id: 'bus', emoji: '🚌', speed: 0.0002, label: 'On a bus' },
  { id: 'train', emoji: '🚂', speed: 0.0008, label: 'On a train' },
  { id: 'boat', emoji: '⛵', speed: 0.00015, label: 'On a boat' }
];

const WANDER_DURATION = 60 * 60 * 1000; // 1 hour

class WanderingPet {
  constructor(petId, channelId, startLat, startLng, petData) {
    this.petId = petId;
    this.channelId = channelId;
    this.lat = startLat;
    this.lng = startLng;
    this.petData = petData;
    this.direction = Math.random() * Math.PI * 2;
    this.vehicleIdx = 0; // start walking
    this.startTime = Date.now();
    this.despawnAt = Date.now() + WANDER_DURATION;
    this.walkId = petData.walk_id || null;
    this.interval = null;
  }

  get vehicle() { return WANDER_VEHICLES[this.vehicleIdx]; }

  start() {
    if (!db) return;
    // Write initial wandering state
    db.ref(`wandering_pets/${this.channelId}/${this.petId}`).set({
      lat: this.lat,
      lng: this.lng,
      emoji: this.petData.emoji || '🐾',
      name: this.petData.name,
      photo_url: this.petData.photo_url || '',
      started_wandering: this.startTime,
      despawn_at: this.despawnAt,
      direction: this.direction,
      speed: this.vehicle.speed,
      vehicle: this.vehicle.id,
      walk_id: this.walkId
    });

    // Update pet status
    updatePetStatus(this.petId, 'wandering');

    this.interval = setInterval(() => this.tick(), 5000);
  }

  tick() {
    // Check despawn
    if (Date.now() >= this.despawnAt) {
      this.goHome();
      return;
    }

    // Move in current direction
    const speed = this.vehicle.speed;
    this.lat += Math.cos(this.direction) * speed;
    this.lng += Math.sin(this.direction) * speed;

    // 10% chance: change direction
    if (Math.random() < 0.10) {
      this.direction += (Math.random() - 0.5) * Math.PI;
    }

    // 5% chance: change vehicle
    if (Math.random() < 0.05) {
      this.vehicleIdx = Math.floor(Math.random() * WANDER_VEHICLES.length);
    }

    // Update Firebase
    if (db) {
      db.ref(`wandering_pets/${this.channelId}/${this.petId}`).update({
        lat: this.lat,
        lng: this.lng,
        direction: this.direction,
        speed: this.vehicle.speed,
        vehicle: this.vehicle.id
      });
    }
  }

  async goHome() {
    this.stop();
    if (!db) return;

    // Remove from wandering
    await db.ref(`wandering_pets/${this.channelId}/${this.petId}`).remove();

    // Remove from active pets
    await db.ref(`mapmergerventi/active_pets/${this.channelId}/${this.petId}`).remove();

    // Set pet status back to home
    await updatePetStatus(this.petId, 'home', null);

    // End the walk
    if (this.walkId) {
      await db.ref(`walk_history/${this.petId}/${this.walkId}`).update({
        ended_at: Date.now(),
        status: 'abandoned'
      });
    }

    // Notify owner
    const pet = await getPet(this.petId);
    if (pet) {
      sendNotification(pet.registered_by, {
        type: 'returned_home',
        pet_id: this.petId,
        pet_name: pet.name,
        message: `💤 ${pet.name} wandered home safely`
      });
    }
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }
}

// Pick up a wandering pet
async function pickUpWanderingPet(petId, channelId) {
  if (!db) return null;
  const uid = getUid();
  const name = getUserName();

  // Remove from wandering
  await db.ref(`wandering_pets/${channelId}/${petId}`).remove();

  // Create new walk
  const walkId = db.ref(`walk_history/${petId}`).push().key;
  await db.ref(`walk_history/${petId}/${walkId}`).set({
    walker_uid: uid,
    walker_name: name,
    started_at: Date.now(),
    distance_km: 0,
    duration_mins: 0,
    status: 'active',
    path: []
  });

  // Update pet status
  await db.ref(`snoutfirst/pets/${petId}`).update({
    status: 'walking',
    current_walker: uid
  });

  // Notify owner
  const pet = await getPet(petId);
  if (pet) {
    sendNotification(pet.registered_by, {
      type: 'picked_up',
      pet_id: petId,
      pet_name: pet.name,
      by_uid: uid,
      by_name: name,
      message: `🎾 ${pet.name} was picked up by ${name}!`
    });
  }

  return walkId;
}

// Start a walk (take out a pet)
async function takeOutPet(petId, channelId) {
  if (!db) return null;
  const uid = getUid();
  const name = getUserName();

  // Check if pet is available
  const pet = await getPet(petId);
  if (!pet || pet.status !== 'home') return null;

  // Create walk record
  const walkId = db.ref(`walk_history/${petId}`).push().key;
  await db.ref(`walk_history/${petId}/${walkId}`).set({
    walker_uid: uid,
    walker_name: name,
    started_at: Date.now(),
    distance_km: 0,
    duration_mins: 0,
    status: 'active',
    path: []
  });

  // Update pet status
  await updatePetStatus(petId, 'walking', uid, name);

  // Deploy pet to active map
  if (channelId) {
    const pos = typeof S !== 'undefined' ? { lat: S.lat, lng: S.lon || S.lng } :
      typeof G !== 'undefined' ? { lat: G.pos.lat, lng: G.pos.lng } :
      { lat: pet.home_lat, lng: pet.home_lng };

    await db.ref(`mapmergerventi/active_pets/${channelId}/${petId}`).set({
      lat: pos.lat,
      lng: pos.lng,
      emoji: pet.emoji || getSpeciesEmoji(pet.species),
      name: pet.name,
      photo_url: pet.photo_url || '',
      walker_uid: uid,
      walker_name: name,
      walker_online: true,
      last_active: Date.now(),
      mode: 'walk',
      vehicle: 'walk',
      walk_id: walkId,
      session_distance_km: 0,
      session_start: Date.now()
    });

    // Set up onDisconnect → wandering after 30s grace
    db.ref(`mapmergerventi/active_pets/${channelId}/${petId}/walker_online`)
      .onDisconnect().set(false);
  }

  return walkId;
}

// Return pet home
async function returnPetHome(petId, channelId, walkTracker) {
  if (!db) return;

  // End walk tracking
  if (walkTracker) {
    await walkTracker.finish();
  }

  // Remove from active map
  if (channelId) {
    await db.ref(`mapmergerventi/active_pets/${channelId}/${petId}`).remove();
  }

  // Update status
  await updatePetStatus(petId, 'home', null);
}

// Watch for walker disconnect (run on all clients)
function watchForDisconnects(channelId, onWander) {
  if (!db) return;
  db.ref(`mapmergerventi/active_pets/${channelId}`).on('child_changed', snap => {
    const data = snap.val();
    if (data && data.walker_online === false) {
      // Walker disconnected — start 30s grace period
      setTimeout(async () => {
        // Re-check if still disconnected
        const recheck = await db.ref(`mapmergerventi/active_pets/${channelId}/${snap.key}/walker_online`).once('value');
        if (recheck.val() === false) {
          if (onWander) onWander(snap.key, data);
        }
      }, 30000);
    }
  });
}
