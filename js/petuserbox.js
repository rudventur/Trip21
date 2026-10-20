// ═══════════════════════════════════════════════════════════════
//  petuserbox.js — Shared PETuserBox component (full + compact)
//  Used by both Snout First and Map Merger Venti
// ═══════════════════════════════════════════════════════════════

// Pets are the main character here — a random passerby's identity isn't part of the
// pet's page by default. The owner always knows who's walking their own pet, and you
// obviously know when it's you. Everyone else sees the walker only as a supporter:
// "I am a subscriber (supporter)" in the useRbox (localStorage 'rvPublicSettings').
function canSeeWalkerIdentity(pet, uid) {
  if (pet.registered_by === uid) return true;
  if (pet.current_walker === uid) return true;
  return typeof isPremiumViewer === 'function' && isPremiumViewer();
}
function isPremiumViewer() {
  try { return !!(JSON.parse(localStorage.getItem('rvPublicSettings') || '{}') || {}).subscriber; }
  catch (e) { return false; }
}

function renderPetUserboxFull(pet, container, options) {
  options = options || {};
  const uid = getUid();
  const isOwner = pet.registered_by === uid;
  const emoji = getSpeciesEmoji(pet.species);
  const mood = getMoodEmoji(pet.mood);
  const stats = pet.stats || {};
  // Photos are kept on the owner's device only (never in the shared database)
  const photo = typeof getPetPhotoLocal === 'function' ? getPetPhotoLocal(pet.id) : '';
  const pid = safeId(pet.id);
  const statusColors = {
    home: '#88cc44',
    walking: '#ffcc66',
    wandering: '#ff6666'
  };
  const statusEmojis = {
    home: '🏠',
    walking: '🚶',
    wandering: '🐕'
  };

  const statusText = pet.status === 'walking' && pet.current_walker === uid
    ? 'Walking with you!'
    : pet.status === 'walking'
    ? (canSeeWalkerIdentity(pet, uid) ? `Being walked by ${escHtml(pet.owner_name || 'the owner')}` : '🚶 Out for a walk!')
    : 'At Home';

  // Only the owner can take their pet out (the database rules enforce it too)
  let actionsHtml = '';
  if (isOwner && pet.status === 'home') {
    actionsHtml = `
      <button class="hbtn paw" onclick="handleTakeOut('${pid}')" style="flex:1">🚶 Take Out</button>
      <button class="hbtn" onclick="handleFeedPet('${pid}')" style="flex:1">🍖 Feed</button>
    `;
  } else if (pet.status === 'walking' && pet.current_walker === uid) {
    actionsHtml = `
      <button class="hbtn" onclick="handleReturnHome('${pid}')" style="flex:1;border-color:#88cc44;color:#88cc44">🏠 Return Home</button>
      <button class="hbtn" onclick="handleFeedPet('${pid}')" style="flex:1">🍖 Feed</button>
    `;
  } else {
    actionsHtml = `
      <button class="hbtn" onclick="handleFeedPet('${pid}')" style="flex:1">🍖 Feed</button>
    `;
  }

  if (isOwner) {
    actionsHtml += `<button class="hbtn red" onclick="handleEditPet('${pid}')" style="flex-shrink:0">✏️</button>`;
  }

  container.innerHTML = `
    <div style="text-align:center;margin-bottom:4px">
      ${photo ? `<img src="${escHtml(photo)}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid #cc8833;margin-bottom:4px">` : ''}
      <div style="font-size:2rem">${emoji}</div>
      <div style="font-family:'Bubblegum Sans',cursive;font-size:1.3rem;color:#ffcc66;text-shadow:0 0 8px rgba(255,204,102,.3)">${escHtml(pet.name)}</div>
      <div style="color:rgba(255,204,102,.45);font-size:.82rem">${pet.breed ? escHtml(pet.breed) + ' · ' : ''}${escHtml(pet.species)}</div>
    </div>
    ${pet.bio ? `<div style="color:rgba(255,204,102,.7);font-size:.92rem;font-style:italic;border-left:3px solid rgba(204,136,51,.3);padding-left:8px;margin:6px 0">"${escHtml(pet.bio)}"</div>` : ''}
    ${pet.personality_tags && pet.personality_tags.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin:6px 0">${pet.personality_tags.map(t => `<span style="background:rgba(136,204,68,.12);border:1px solid rgba(136,204,68,.3);color:#88cc44;padding:2px 7px;border-radius:10px;font-size:.75rem">${escHtml(t)}</span>`).join('')}</div>` : ''}
    <div style="text-align:center;margin:6px 0">
      <span style="font-size:1.1rem">${mood}</span>
      <span style="color:rgba(255,204,102,.5);font-size:.85rem;margin-left:4px">${escHtml(pet.mood || '')}</span>
    </div>
    <div style="display:flex;gap:12px;justify-content:center;margin:8px 0;font-size:.85rem;color:rgba(255,204,102,.6)">
      <span>📏 ${(Number(stats.lifetime_distance_km) || 0).toFixed(1)} km</span>
      <span>🚶 ${Number(stats.total_walks) || 0} walks</span>
      <span>🍖 ${Number(stats.total_feedings) || 0} fed</span>
    </div>
    ${stats.last_fed ? `<div style="font-size:.8rem;color:rgba(255,204,102,.4);text-align:center">🍖 Last fed: ${timeAgo(stats.last_fed)}${stats.last_fed_by ? ' by ' + escHtml(stats.last_fed_by) : ''}</div>` : ''}
    <div style="text-align:center;margin:8px 0;padding:6px;border-radius:8px;background:rgba(0,0,0,.2);border:1px solid ${statusColors[pet.status] || '#cc8833'}">
      <span style="font-size:.9rem">${statusEmojis[pet.status] || '🏠'} ${statusText}</span>
    </div>
    <div style="display:flex;gap:6px;margin-top:8px">${actionsHtml}</div>
    <div style="font-size:.72rem;color:rgba(255,204,102,.3);text-align:center;margin-top:6px">
      Registered by ${escHtml(pet.owner_name || 'Unknown')} · ${timeAgo(pet.created_at)}
    </div>
    <div id="pet-feed-section-${pid}" style="margin-top:10px"></div>
  `;
}

function renderPetUserboxCompact(pet, container) {
  const emoji = getSpeciesEmoji(pet.species);
  const stats = pet.stats || {};
  const uid = getUid();
  const pid = safeId(pet.id);
  const isWalking = pet.status === 'walking' && pet.current_walker === uid;

  let actions = '';
  if (isWalking) {
    actions = `
      <button class="hbtn" onclick="handleReturnHome('${pid}')" style="font-size:.75rem;padding:2px 6px;border-color:#88cc44;color:#88cc44">🏠 Return</button>
    `;
  } else if (pet.status === 'home' && pet.registered_by === uid) {
    actions = `<button class="hbtn paw" onclick="handleTakeOut('${pid}')" style="font-size:.75rem;padding:2px 6px">🚶 Walk</button>`;
  }

  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:1.3rem">${emoji}</span>
      <div style="flex:1">
        <div style="font-family:'Bubblegum Sans',cursive;color:#ffcc66;font-size:.95rem">${escHtml(pet.name)}</div>
        <div style="font-size:.75rem;color:rgba(255,204,102,.4)">
          📏 ${(Number(stats.lifetime_distance_km) || 0).toFixed(1)}km
          ${isWalking ? '· ⏱️' + Math.round((Date.now() - (pet.session_start || Date.now())) / 60000) + 'm' : ''}
        </div>
      </div>
      ${actions}
    </div>
  `;
}
