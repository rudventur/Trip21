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

// Limits shared with database.rules.json (keep them in step).
const PET_LIMITS = { name: 40, breed: 40, bio: 200, tag: 24, tags: 8, owner: 30, species: 20, mood: 20 };

function cleanTags(tags) {
  return (tags || []).map(t => String(t).trim().slice(0, PET_LIMITS.tag)).filter(Boolean).slice(0, PET_LIMITS.tags);
}

async function registerPet(petData) {
  if (!isSharing()) {
    // Fallback: save locally
    return registerPetLocally(petData);
  }

  const uid = getUid();
  const petId = db.ref('snoutfirst/pets').push().key;

  // Photos are NOT sent to the shared database (they would fill the free
  // allowance fast). They stay on this device — see savePetPhotoLocally().
  const pet = {
    name: String(petData.name).slice(0, PET_LIMITS.name),
    species: String(petData.species || 'dog').slice(0, PET_LIMITS.species),
    breed: String(petData.breed || '').slice(0, PET_LIMITS.breed),
    emoji: getSpeciesEmoji(petData.species),
    bio: String(petData.bio || '').slice(0, PET_LIMITS.bio),
    personality_tags: cleanTags(petData.tags),
    // Shared pin position is rounded to about 100 metres (privacy).
    home_lat: roundShared(petData.lat),
    home_lng: roundShared(petData.lng),
    owner_uid: uid,
    registered_by: uid,
    owner_name: getUserName(),
    notify_walks: true,
    notify_feedings: true,
    status: 'home',
    mood: String(petData.mood || 'happy').slice(0, PET_LIMITS.mood),
    created_at: firebase.database.ServerValue.TIMESTAMP,
    stats: {
      lifetime_distance_km: 0,
      total_walks: 0,
      total_feedings: 0
    },
    active: true
  };

  await db.ref(`snoutfirst/pets/${petId}`).set(pet);
  return petId;
}

// ── Pet photos: kept on this device only ──
const PET_PHOTO_KEY = 'sf_pet_photos';
function savePetPhotoLocally(petId, dataUrl) {
  if (!petId || !/^data:image\//.test(dataUrl || '')) return;
  try {
    const all = JSON.parse(localStorage.getItem(PET_PHOTO_KEY) || '{}');
    all[safeId(petId)] = dataUrl;
    localStorage.setItem(PET_PHOTO_KEY, JSON.stringify(all));
  } catch (e) { console.warn('Photo not saved (device storage full?):', e); }
}
function getPetPhotoLocal(petId) {
  try {
    const url = JSON.parse(localStorage.getItem(PET_PHOTO_KEY) || '{}')[safeId(petId)] || '';
    return /^data:image\//.test(url) ? url : '';
  } catch (e) { return ''; }
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
  if (!isSharing()) return null;
  const snap = await db.ref(`snoutfirst/pets/${petId}`).once('value');
  return snap.exists() ? { id: petId, ...snap.val() } : null;
}

async function getAllPets() {
  if (!isSharing()) {
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
  if (!isSharing()) {
    return JSON.parse(localStorage.getItem('snoutfirst_pets_v2') || '[]');
  }
  const snap = await db.ref('snoutfirst/pets')
    .orderByChild('owner_uid')
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

// Only the pet's owner may change its status (the database rules enforce this).
async function updatePetStatus(petId, status) {
  if (!isSharing()) return;
  const updates = { status };
  updates.current_walker = status === 'walking' ? getUid() : null;
  await db.ref(`snoutfirst/pets/${petId}`).update(updates);
}

// Convert photo file to base64
function photoToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Resize if too large
      const img = new Image();
      img.onload = () => {
        const maxSize = 160;  // small: kept in this device's storage
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
