// ═══════════════════════════════════════════════════════════════
//  pet-registration.js — Register real pets on the map
// ═══════════════════════════════════════════════════════════════

const PET_SPECIES = [
  { id: 'dog', emoji: '🐶', label: 'Dog' },
  { id: 'cat', emoji: '🐱', label: 'Cat' },
  { id: 'bird', emoji: '🐦', label: 'Bird' },
  { id: 'fish', emoji: '🐠', label: 'Fish' },
  { id: 'rabbit', emoji: '🐰', label: 'Rabbit' },
  { id: 'hamster', emoji: '🐹', label: 'Hamster' },
  { id: 'reptile', emoji: '🦎', label: 'Reptile' },
  { id: 'horse', emoji: '🐴', label: 'Horse' },
  { id: 'turtle', emoji: '🐢', label: 'Turtle' },
  { id: 'other', emoji: '🐾', label: 'Other' }
];

const PET_MOODS = [
  { id: 'playful', emoji: '🎾' },
  { id: 'sleepy', emoji: '😴' },
  { id: 'hungry', emoji: '🍖' },
  { id: 'majestic', emoji: '👑' },
  { id: 'chaos', emoji: '🤡' },
  { id: 'happy', emoji: '😊' },
  { id: 'grumpy', emoji: '😾' },
  { id: 'adventurous', emoji: '🏔️' }
];

function getSpeciesEmoji(species) {
  const s = PET_SPECIES.find(sp => sp.id === species);
  return s ? s.emoji : '🐾';
}

function getMoodEmoji(mood) {
  const m = PET_MOODS.find(mo => mo.id === mood);
  return m ? m.emoji : '';
}

async function registerPet(petData) {
  if (!db) {
    // Fallback: save locally
    return registerPetLocally(petData);
  }

  const uid = getUid();
  const petId = db.ref('snoutfirst/pets').push().key;

  const pet = {
    name: petData.name,
    species: petData.species || 'dog',
    breed: petData.breed || '',
    emoji: getSpeciesEmoji(petData.species),
    bio: petData.bio || '',
    photo_url: petData.photo_url || '',
    photo_base64: petData.photo_base64 || '',
    personality_tags: petData.tags || [],
    home_lat: petData.lat,
    home_lng: petData.lng,
    home_address: petData.address || '',
    registered_by: uid,
    owner_name: getUserName(),
    owner_contact: petData.contact || '',
    notify_walks: true,
    notify_feedings: true,
    notify_wandering: true,
    status: 'home',
    current_walker: null,
    mood: petData.mood || 'happy',
    created_at: Date.now(),
    stats: {
      lifetime_distance_km: 0,
      total_walks: 0,
      total_feedings: 0,
      last_walked: null
    },
    active: true
  };

  await db.ref(`snoutfirst/pets/${petId}`).set(pet);
  return petId;
}

function registerPetLocally(petData) {
  // Fallback for when Firebase is unavailable
  const pets = JSON.parse(localStorage.getItem('snoutfirst_pets_v2') || '[]');
  const petId = 'local_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const pet = {
    id: petId,
    name: petData.name,
    species: petData.species || 'dog',
    breed: petData.breed || '',
    bio: petData.bio || '',
    tags: petData.tags || [],
    mood: petData.mood || 'happy',
    lat: petData.lat,
    lng: petData.lng,
    status: 'home',
    created_at: Date.now(),
    stats: { lifetime_distance_km: 0, total_walks: 0, total_feedings: 0 }
  };
  pets.push(pet);
  localStorage.setItem('snoutfirst_pets_v2', JSON.stringify(pets));
  return petId;
}

async function getPet(petId) {
  if (!db) return null;
  const snap = await db.ref(`snoutfirst/pets/${petId}`).once('value');
  return snap.exists() ? { id: petId, ...snap.val() } : null;
}

async function getAllPets() {
  if (!db) {
    return JSON.parse(localStorage.getItem('snoutfirst_pets_v2') || '[]');
  }
  const snap = await db.ref('snoutfirst/pets').orderByChild('active').equalTo(true).once('value');
  const pets = [];
  snap.forEach(child => {
    pets.push({ id: child.key, ...child.val() });
  });
  return pets;
}

async function getMyPets() {
  const uid = getUid();
  if (!db) {
    return JSON.parse(localStorage.getItem('snoutfirst_pets_v2') || '[]');
  }
  const snap = await db.ref('snoutfirst/pets')
    .orderByChild('registered_by')
    .equalTo(uid)
    .once('value');
  const pets = [];
  snap.forEach(child => {
    pets.push({ id: child.key, ...child.val() });
  });
  return pets;
}

async function getNearbyPets(lat, lng, radiusKm) {
  radiusKm = radiusKm || 10;
  const all = await getAllPets();
  return all.filter(pet => {
    const pLat = pet.home_lat || pet.lat;
    const pLng = pet.home_lng || pet.lng;
    if (!pLat || !pLng) return false;
    const dist = haversine({ lat, lng }, { lat: pLat, lng: pLng });
    pet._distance = dist;
    return dist <= radiusKm;
  }).sort((a, b) => a._distance - b._distance);
}

async function updatePetStatus(petId, status, walkerUid, walkerName) {
  if (!db) return;
  const updates = { status };
  if (walkerUid !== undefined) updates.current_walker = walkerUid;
  await db.ref(`snoutfirst/pets/${petId}`).update(updates);

  // Notify owner
  const pet = await getPet(petId);
  if (!pet) return;

  if (status === 'walking' && pet.notify_walks !== false) {
    sendNotification(pet.registered_by, {
      type: 'walk_started',
      pet_id: petId,
      pet_name: pet.name,
      by_uid: walkerUid,
      by_name: walkerName || getUserName(),
      message: `🐾 ${pet.name} is being walked by ${walkerName || getUserName()}!`
    });
  } else if (status === 'home') {
    sendNotification(pet.registered_by, {
      type: 'returned_home',
      pet_id: petId,
      pet_name: pet.name,
      by_uid: getUid(),
      by_name: getUserName(),
      message: `🏠 ${pet.name} is back home!`
    });
  } else if (status === 'wandering' && pet.notify_wandering !== false) {
    sendNotification(pet.registered_by, {
      type: 'wandering',
      pet_id: petId,
      pet_name: pet.name,
      message: `⚠️ ${pet.name}'s walker disconnected — wandering!`
    });
  }
}

// Convert photo file to base64
function photoToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Resize if too large
      const img = new Image();
      img.onload = () => {
        const maxSize = 400;
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          const ratio = Math.min(maxSize / w, maxSize / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
