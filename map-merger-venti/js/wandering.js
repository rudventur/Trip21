// ═══════════════════════════════════════════════════════════════
//  wandering.js — Taking your own pet out for a walk
//
//  Changed for safe sharing:
//  • Only the pet's owner can take it out (each person writes only their
//    own records — see database.rules.json).
//  • No live position is streamed while walking (the old
//    mapmergerventi/active_pets + walk_history writes are gone); the route
//    stays on this device unless you choose to share it at the end.
//  • The old "wandering" simulation (a pet moving randomly by bus, train or
//    boat after the walker disconnected) is removed: it showed invented
//    movement and needed every visitor to write to other people's pets.
//    If the walker's connection drops, the pet is simply marked back home.
// ═══════════════════════════════════════════════════════════════

// Start a walk (take out your own pet). Returns a walk id or null.
async function takeOutPet(petId) {
  if (typeof isSharing !== 'function' || !isSharing()) return null;
  const uid = getUid();

  // Check the pet is yours and at home
  const pet = await getPet(petId);
  if (!pet || pet.status !== 'home' || pet.owner_uid !== uid) return null;

  await updatePetStatus(petId, 'walking');

  // If this browser disconnects mid-walk, put the pet back home.
  db.ref(`snoutfirst/pets/${petId}`).onDisconnect().update({ status: 'home', current_walker: null });

  // Walk id only used on this device
  return 'walk_' + Date.now().toString(36);
}

// Return pet home. Returns the finished walk summary (or null).
async function returnPetHome(petId, walkTracker) {
  if (typeof isSharing !== 'function' || !isSharing()) return null;
  const walk = walkTracker ? await walkTracker.finish() : null;
  db.ref(`snoutfirst/pets/${petId}`).onDisconnect().cancel();
  await updatePetStatus(petId, 'home');
  return walk;
}
