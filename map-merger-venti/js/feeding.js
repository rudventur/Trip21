// ═══════════════════════════════════════════════════════════════
//  feeding.js — Pet feeding log system
// ═══════════════════════════════════════════════════════════════

const FOOD_TYPES = [
  { id: 'dry', emoji: '🥣', label: 'Dry Food' },
  { id: 'wet', emoji: '🥫', label: 'Wet Food' },
  { id: 'treats', emoji: '🦴', label: 'Treats' },
  { id: 'water', emoji: '💧', label: 'Water' },
  { id: 'other', emoji: '🍖', label: 'Other' }
];

async function logFeeding(petId, foodType, foodBrand, amount, notes) {
  if (!db) return null;
  const uid = getUid();
  const feedingId = db.ref(`feeding_log/${petId}`).push().key;
  const feeding = {
    fed_by_uid: uid,
    fed_by_name: getUserName(),
    timestamp: Date.now(),
    food_type: foodType || 'dry',
    food_brand: foodBrand || '',
    amount: amount || '',
    notes: notes || ''
  };
  await db.ref(`feeding_log/${petId}/${feedingId}`).set(feeding);

  // Update pet stats
  await db.ref(`snoutfirst/pets/${petId}/stats`).transaction(stats => {
    if (!stats) stats = { lifetime_distance_km: 0, total_walks: 0, total_feedings: 0 };
    stats.total_feedings = (stats.total_feedings || 0) + 1;
    stats.last_fed = Date.now();
    stats.last_fed_by = getUserName();
    return stats;
  });

  // Notify owner
  const petSnap = await db.ref(`snoutfirst/pets/${petId}`).once('value');
  const pet = petSnap.val();
  if (pet && pet.registered_by && pet.notify_feedings !== false) {
    sendNotification(pet.registered_by, {
      type: 'feeding',
      pet_id: petId,
      pet_name: pet.name,
      by_uid: uid,
      by_name: getUserName(),
      message: `🍖 ${pet.name} was fed by ${getUserName()} (${foodType})`
    });
  }

  return feedingId;
}

async function getRecentFeedings(petId, limit) {
  if (!db) return [];
  limit = limit || 10;
  const snap = await db.ref(`feeding_log/${petId}`)
    .orderByChild('timestamp')
    .limitToLast(limit)
    .once('value');
  const feedings = [];
  snap.forEach(child => {
    feedings.push({ id: child.key, ...child.val() });
  });
  return feedings.reverse();
}

function getTimeSinceLastFeeding(feedings) {
  if (!feedings || !feedings.length) return null;
  const last = feedings[0];
  return (Date.now() - last.timestamp) / 3600000; // hours
}

function getFeedingAlert(hoursSince, petName) {
  if (hoursSince === null) return { level: 'info', message: `No feeding records for ${petName}` };
  if (hoursSince > 8) return { level: 'warning', message: `⚠️ ${petName} hasn't been fed in ${Math.round(hoursSince)} hours!` };
  if (hoursSince < 2) return { level: 'ok', message: `✅ ${petName} was recently fed` };
  return { level: 'info', message: `Last fed ${Math.round(hoursSince)} hours ago` };
}

function renderFeedingForm(petId, petName, container) {
  container.innerHTML = `
    <div style="margin-bottom:10px;font-family:'Bubblegum Sans',cursive;font-size:1.1rem;color:#ffcc66">🍖 Feed ${petName}</div>
    <label style="font-size:.8rem;color:rgba(255,204,102,.6)">Food type</label>
    <select id="feed-type" style="width:100%;background:rgba(0,0,0,.4);color:#ffcc66;border:2px solid rgba(204,136,51,.4);padding:6px;border-radius:8px;font-family:'VT323',monospace;margin-bottom:6px">
      ${FOOD_TYPES.map(f => `<option value="${f.id}">${f.emoji} ${f.label}</option>`).join('')}
    </select>
    <label style="font-size:.8rem;color:rgba(255,204,102,.6)">Brand (optional)</label>
    <input id="feed-brand" placeholder="e.g. Pedigree" style="width:100%;background:rgba(0,0,0,.4);color:#ffcc66;border:2px solid rgba(204,136,51,.4);padding:6px;border-radius:8px;font-family:'VT323',monospace;margin-bottom:6px">
    <label style="font-size:.8rem;color:rgba(255,204,102,.6)">Amount (optional)</label>
    <input id="feed-amount" placeholder="e.g. 1 bowl" style="width:100%;background:rgba(0,0,0,.4);color:#ffcc66;border:2px solid rgba(204,136,51,.4);padding:6px;border-radius:8px;font-family:'VT323',monospace;margin-bottom:6px">
    <label style="font-size:.8rem;color:rgba(255,204,102,.6)">Notes (optional)</label>
    <input id="feed-notes" placeholder="e.g. Ate everything" style="width:100%;background:rgba(0,0,0,.4);color:#ffcc66;border:2px solid rgba(204,136,51,.4);padding:6px;border-radius:8px;font-family:'VT323',monospace;margin-bottom:8px">
    <button id="feed-submit" class="hbtn paw" style="width:100%;padding:8px">🍖 Log Feeding</button>
    <div id="feed-recent" style="margin-top:10px"></div>
    <div id="feed-alert" style="margin-top:6px;font-size:.85rem"></div>
  `;

  document.getElementById('feed-submit').addEventListener('click', async () => {
    const type = document.getElementById('feed-type').value;
    const brand = document.getElementById('feed-brand').value;
    const amount = document.getElementById('feed-amount').value;
    const notes = document.getElementById('feed-notes').value;
    await logFeeding(petId, type, brand, amount, notes);
    if (typeof toast === 'function') toast('🍖 Feeding logged!');
    loadRecentFeedings(petId);
  });

  loadRecentFeedings(petId);
}

async function loadRecentFeedings(petId) {
  const el = document.getElementById('feed-recent');
  const alertEl = document.getElementById('feed-alert');
  if (!el) return;

  const feedings = await getRecentFeedings(petId, 5);
  const hoursSince = getTimeSinceLastFeeding(feedings);
  const alert = getFeedingAlert(hoursSince, '');

  if (alertEl) {
    alertEl.style.color = alert.level === 'warning' ? '#ff6666' : alert.level === 'ok' ? '#88cc44' : 'rgba(255,204,102,.5)';
    alertEl.textContent = alert.message;
  }

  if (!feedings.length) {
    el.innerHTML = '<div style="color:rgba(255,204,102,.4);font-size:.8rem;font-style:italic">No feedings yet</div>';
    return;
  }

  el.innerHTML = '<div style="font-size:.8rem;color:rgba(255,204,102,.5);margin-bottom:4px">Recent feedings:</div>' +
    feedings.map(f => {
      const ago = timeAgo(f.timestamp);
      const ft = FOOD_TYPES.find(t => t.id === f.food_type);
      return `<div style="font-size:.82rem;color:rgba(255,204,102,.7);padding:2px 0;border-bottom:1px solid rgba(204,136,51,.1)">
        ${ft ? ft.emoji : '🍖'} ${ago} — ${f.fed_by_name} fed ${f.food_type}${f.food_brand ? ' (' + f.food_brand + ')' : ''}
      </div>`;
    }).join('');
}
