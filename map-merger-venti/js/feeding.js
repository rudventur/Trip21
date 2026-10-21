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
  if (typeof isSharing !== 'function' || !isSharing()) return null;
  const uid = getUid();
  const feedingId = db.ref(`feeding_log/${petId}`).push().key;
  const feeding = {
    fed_by_uid: uid,
    fed_by_name: getUserName(),
    timestamp: firebase.database.ServerValue.TIMESTAMP,
    food_type: String(foodType || 'dry').slice(0, 20),
    food_brand: String(foodBrand || '').slice(0, 40),
    amount: String(amount || '').slice(0, 40),
    notes: String(notes || '').slice(0, 200)
  };
  await db.ref(`feeding_log/${petId}/${feedingId}`).set(feeding);

  const petSnap = await db.ref(`snoutfirst/pets/${petId}`).once('value');
  const pet = petSnap.val();
  if (!pet) return feedingId;

  if (pet.owner_uid === uid) {
    // Your own pet: update its totals (only the owner may write the pet record)
    await db.ref(`snoutfirst/pets/${petId}/stats`).transaction(stats => {
      if (!stats) stats = { lifetime_distance_km: 0, total_walks: 0, total_feedings: 0 };
      stats.total_feedings = (stats.total_feedings || 0) + 1;
      stats.last_fed = Date.now();
      stats.last_fed_by = getUserName();
      return stats;
    }).catch(e => console.warn('Feeding totals not saved:', e));
  } else if (pet.notify_feedings !== false) {
    // Someone else's pet: tell the owner
    sendNotification(pet.owner_uid, {
      type: 'feeding',
      pet_id: petId,
      pet_name: pet.name,
      message: `🍖 ${pet.name} was fed by ${getUserName()} (${feeding.food_type})`
    });
  }

  return feedingId;
}

async function getRecentFeedings(petId, limit) {
  if (typeof isSharing !== 'function' || !isSharing()) return [];
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
    <div style="margin-bottom:10px;font-family:'Bubblegum Sans',cursive;font-size:1.1rem;color:#ffcc66">🍖 Feed ${escHtml(petName)}</div>
    <label style="font-size:.8rem;color:rgba(255,204,102,.6)">Food type</label>
    <select id="feed-type" style="width:100%;background:rgba(0,0,0,.4);color:#ffcc66;border:2px solid rgba(204,136,51,.4);padding:6px;border-radius:8px;font-family:'VT323',monospace;margin-bottom:6px">
      ${FOOD_TYPES.map(f => `<option value="${f.id}">${f.emoji} ${f.label}</option>`).join('')}
    </select>
    <label style="font-size:.8rem;color:rgba(255,204,102,.6)">Brand (optional)</label>
    <input id="feed-brand" maxlength="40" placeholder="e.g. Pedigree" style="width:100%;background:rgba(0,0,0,.4);color:#ffcc66;border:2px solid rgba(204,136,51,.4);padding:6px;border-radius:8px;font-family:'VT323',monospace;margin-bottom:6px">
    <label style="font-size:.8rem;color:rgba(255,204,102,.6)">Amount (optional)</label>
    <input id="feed-amount" maxlength="40" placeholder="e.g. 1 bowl" style="width:100%;background:rgba(0,0,0,.4);color:#ffcc66;border:2px solid rgba(204,136,51,.4);padding:6px;border-radius:8px;font-family:'VT323',monospace;margin-bottom:6px">
    <label style="font-size:.8rem;color:rgba(255,204,102,.6)">Notes (optional)</label>
    <input id="feed-notes" maxlength="200" placeholder="e.g. Ate everything" style="width:100%;background:rgba(0,0,0,.4);color:#ffcc66;border:2px solid rgba(204,136,51,.4);padding:6px;border-radius:8px;font-family:'VT323',monospace;margin-bottom:8px">
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
        ${ft ? ft.emoji : '🍖'} ${ago} — ${escHtml(f.fed_by_name)} fed ${escHtml(f.food_type)}${f.food_brand ? ' (' + escHtml(f.food_brand) + ')' : ''}
      </div>`;
    }).join('');
}
