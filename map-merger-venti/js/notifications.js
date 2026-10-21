// ═══════════════════════════════════════════════════════════════
//  notifications.js — Owner notification system
// ═══════════════════════════════════════════════════════════════

// Sends a short note to a pet owner. The database rules only accept notes
// whose by_uid is the sender's own signed-in uid.
function sendNotification(ownerUid, data) {
  if (typeof isSharing !== 'function' || !isSharing() || !ownerUid) return;
  const uid = getUid();
  if (ownerUid === uid) return; // no need to notify yourself
  const notifRef = db.ref(`notifications/${ownerUid}`).push();
  notifRef.set({
    type: String(data.type || 'info').slice(0, 20),
    pet_id: safeId(data.pet_id).slice(0, 40),
    pet_name: String(data.pet_name || '').slice(0, 40),
    by_uid: uid,
    by_name: getUserName(),
    message: String(data.message || '').slice(0, 160),
    timestamp: firebase.database.ServerValue.TIMESTAMP,
    read: false
  }).catch(e => console.warn('Notification not sent:', e));
}

// Listen for notifications for current user
let notifListener = null;
let notifCallbacks = [];

function onNotification(callback) {
  notifCallbacks.push(callback);
}

function startNotificationListener() {
  const uid = getUid();
  if (!uid || typeof isSharing !== 'function' || !isSharing()) return;
  if (notifListener) return; // already listening

  notifListener = db.ref(`notifications/${uid}`)
    .orderByChild('timestamp')
    .startAt(Date.now());

  notifListener.on('child_added', snap => {
    const notif = snap.val();
    if (!notif.read) {
      notifCallbacks.forEach(cb => cb(notif, snap.key));
    }
  });
}

async function getUnreadNotifications(limit) {
  const uid = getUid();
  if (!uid || typeof isSharing !== 'function' || !isSharing()) return [];
  limit = limit || 20;
  const snap = await db.ref(`notifications/${uid}`)
    .orderByChild('timestamp')
    .limitToLast(limit)
    .once('value');
  const notifs = [];
  snap.forEach(child => {
    notifs.push({ id: child.key, ...child.val() });
  });
  return notifs.reverse();
}

async function markNotificationRead(notifId) {
  const uid = getUid();
  if (!uid || typeof isSharing !== 'function' || !isSharing()) return;
  await db.ref(`notifications/${uid}/${notifId}`).update({ read: true });
}

async function markAllNotificationsRead() {
  const uid = getUid();
  if (!uid || typeof isSharing !== 'function' || !isSharing()) return;
  const snap = await db.ref(`notifications/${uid}`)
    .orderByChild('read')
    .equalTo(false)
    .once('value');
  const updates = {};
  snap.forEach(child => {
    updates[`${child.key}/read`] = true;
  });
  if (Object.keys(updates).length) {
    await db.ref(`notifications/${uid}`).update(updates);
  }
}

function getUnreadCount(notifs) {
  return notifs.filter(n => !n.read).length;
}
