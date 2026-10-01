// ═══════════════════════════════════════════════════════════════
//  notifications.js — Owner notification system
// ═══════════════════════════════════════════════════════════════

function sendNotification(ownerUid, data) {
  if (!db || !ownerUid) return;
  const notifRef = db.ref(`notifications/${ownerUid}`).push();
  notifRef.set({
    ...data,
    timestamp: Date.now(),
    read: false
  });
}

// Listen for notifications for current user
let notifListener = null;
let notifCallbacks = [];

function onNotification(callback) {
  notifCallbacks.push(callback);
}

function startNotificationListener() {
  const uid = getUid();
  if (!uid || !db) return;
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
  if (!uid || !db) return [];
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
  if (!uid || !db) return;
  await db.ref(`notifications/${uid}/${notifId}`).update({ read: true });
}

async function markAllNotificationsRead() {
  const uid = getUid();
  if (!uid || !db) return;
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
