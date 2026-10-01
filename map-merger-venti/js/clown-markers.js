// ═══════════════════════════════════════════════════════════════
//  clown-markers.js — User Presence on Map
//  "We're all clowns on the internet" — Rudy, 2026
//
//  Additive: wraps drawPets() like map-spots.js and lost-zone.js.
//  Uses Firebase Realtime DB for multi-user presence.
//  Falls back to local-only single-clown mode if no Firebase.
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  const STALE_MS   = 5 * 60 * 1000;   // 5 min -> sleeping badge
  const GONE_MS    = 15 * 60 * 1000;   // 15 min -> remove
  const UPDATE_MS  = 30 * 1000;        // auto-update GPS every 30s
  const CHANNEL    = 'snoutfirst_global';

  let clownActive = false;
  let myClownRef = null;
  let clownListener = null;
  let clownUpdateTimer = null;
  let clowns = {};  // uid -> { lat, lon, name, last_updated, pet_id, status }
  let myUid = null;

  // ── Toggle visibility ──
  window.toggleClownMe = function() {
    if (clownActive) {
      hideMe();
    } else {
      showMe();
    }
  };

  async function showMe() {
    const pos = await getBestPosition();
    myUid = getMyUid();
    if (!myUid) {
      toast('Need to connect first — try refreshing!');
      return;
    }

    const name = localStorage.getItem('rv_username') || 'Anonymous Clown';
    const walkingPet = getWalkingPetEmoji();

    const data = {
      lat: pos.lat,
      lng: pos.lon,
      name: name,
      emoji: '🤡',
      last_updated: Date.now(),
      pet_id: typeof activeWalkPetId !== 'undefined' ? activeWalkPetId : null,
      pet_emoji: walkingPet,
      status: 'active'
    };

    if (typeof db !== 'undefined' && db) {
      myClownRef = db.ref('clown_markers/' + CHANNEL + '/' + myUid);
      await myClownRef.set(data);
      myClownRef.onDisconnect().remove();
      startListening();
    }

    // Always store locally too
    clowns[myUid] = { ...data, lon: data.lng };
    clownActive = true;

    const btn = document.getElementById('btnClown');
    if (btn) btn.classList.add('active');
    const badge = document.getElementById('clownBadge');
    if (badge) badge.classList.add('show');

    toast('🤡 You\'re on the map!');

    // Start auto-updating position
    clownUpdateTimer = setInterval(refreshMyPosition, UPDATE_MS);
  }

  function hideMe() {
    if (myClownRef) {
      myClownRef.remove();
      myClownRef = null;
    }
    if (myUid) delete clowns[myUid];
    clownActive = false;

    if (clownUpdateTimer) {
      clearInterval(clownUpdateTimer);
      clownUpdateTimer = null;
    }

    const btn = document.getElementById('btnClown');
    if (btn) btn.classList.remove('active');
    const badge = document.getElementById('clownBadge');
    if (badge) badge.classList.remove('show');

    toast('🤡 Hidden from map');
  }

  // ── Refresh position (manual or auto) ──
  async function refreshMyPosition() {
    if (!clownActive || !myUid) return;
    const pos = await getBestPosition();
    const walkingPet = getWalkingPetEmoji();

    const update = {
      lat: pos.lat,
      lng: pos.lon,
      last_updated: Date.now(),
      status: 'active',
      pet_id: typeof activeWalkPetId !== 'undefined' ? activeWalkPetId : null,
      pet_emoji: walkingPet
    };

    if (myClownRef) {
      myClownRef.update(update);
    }
    Object.assign(clowns[myUid], update, { lon: update.lng });
  }

  // ── Firebase listener for all clowns in channel ──
  function startListening() {
    if (clownListener) return;
    if (typeof db === 'undefined' || !db) return;

    const ref = db.ref('clown_markers/' + CHANNEL);

    ref.on('child_added', snap => {
      const uid = snap.key;
      const d = snap.val();
      clowns[uid] = {
        lat: d.lat,
        lon: d.lng,
        name: d.name || 'Anonymous',
        emoji: d.emoji || '🤡',
        last_updated: d.last_updated || Date.now(),
        pet_id: d.pet_id || null,
        pet_emoji: d.pet_emoji || null,
        status: d.status || 'active'
      };
    });

    ref.on('child_changed', snap => {
      const uid = snap.key;
      const d = snap.val();
      clowns[uid] = {
        lat: d.lat,
        lon: d.lng,
        name: d.name || 'Anonymous',
        emoji: d.emoji || '🤡',
        last_updated: d.last_updated || Date.now(),
        pet_id: d.pet_id || null,
        pet_emoji: d.pet_emoji || null,
        status: d.status || 'active'
      };
    });

    ref.on('child_removed', snap => {
      delete clowns[snap.key];
    });

    clownListener = ref;
  }

  // ── Stale detection — runs every 60s ──
  setInterval(function() {
    const now = Date.now();
    Object.keys(clowns).forEach(uid => {
      if (uid === myUid) return;
      const c = clowns[uid];
      const age = now - c.last_updated;
      if (age > GONE_MS) {
        delete clowns[uid];
      } else if (age > STALE_MS) {
        c.status = 'stale';
      }
    });
  }, 60000);

  // ── Drawing — wraps drawPets chain ──
  const _clownOrigDrawPets = drawPets;
  drawPets = function() {
    _clownOrigDrawPets();
    drawClowns();
  };

  function drawClowns() {
    const canvas = document.getElementById('snoutMap');
    const ctx = canvas.getContext('2d');
    const now = Date.now();

    Object.keys(clowns).forEach(uid => {
      const c = clowns[uid];
      const p = worldToScreen(c.lat, c.lon);

      if (p.x < -40 || p.x > canvas.width + 40 || p.y < -40 || p.y > canvas.height + 40) return;

      const isMe = uid === myUid;
      const isStale = c.status === 'stale' || (now - c.last_updated > STALE_MS);

      // Glow ring
      const glowAlpha = isStale ? 0.15 : (0.25 + Math.sin(now * 0.003 + c.lat * 100) * 0.1);
      const glowColor = isMe ? 'rgba(255,105,180,' : 'rgba(255,204,102,';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
      ctx.fillStyle = glowColor + glowAlpha + ')';
      ctx.fill();

      // Clown emoji
      const baseSize = isMe ? 26 : 22;
      const bounce = isStale ? 0 : Math.sin(now * 0.004 + c.lon * 50) * 2;
      ctx.font = baseSize + 'px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = isStale ? 0.5 : 1;
      ctx.fillText('🤡', p.x, p.y - 2 + bounce);

      // Walking pet emoji (beside clown)
      if (c.pet_emoji) {
        ctx.font = '16px serif';
        ctx.fillText(c.pet_emoji, p.x + 18, p.y + 6 + bounce);
      }

      // Stale sleeping badge
      if (isStale) {
        ctx.font = '14px serif';
        ctx.fillText('💤', p.x + 16, p.y - 14);
      }

      ctx.globalAlpha = 1;

      // Name label below
      ctx.font = '11px "VT323", monospace';
      const label = isMe ? 'You' : c.name;
      const tw = ctx.measureText(label).width + 8;
      ctx.fillStyle = 'rgba(26,18,10,0.85)';
      const lx = p.x - tw / 2;
      const ly = p.y + 18;
      ctx.fillRect(lx, ly, tw, 15);
      ctx.strokeStyle = isMe ? '#ff69b4' : 'rgba(204,136,51,0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(lx, ly, tw, 15);
      ctx.fillStyle = isMe ? '#ff69b4' : '#ffcc66';
      ctx.textAlign = 'center';
      ctx.fillText(label, p.x, ly + 12);

      // "ME" marker for own clown
      if (isMe) {
        ctx.font = 'bold 8px "Press Start 2P", monospace';
        ctx.fillStyle = '#ff69b4';
        ctx.fillText('ME', p.x, p.y - 20);
      }
    });

    // Update spot count in HUD
    const countEl = document.getElementById('clownCount');
    if (countEl) countEl.textContent = Object.keys(clowns).length;
  }

  // ── Click detection for clowns ──
  document.getElementById('snoutMap').addEventListener('click', function(e) {
    if (!clownActive) return;
    const rect = e.target.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    Object.keys(clowns).forEach(uid => {
      if (uid === myUid) return;
      const c = clowns[uid];
      const p = worldToScreen(c.lat, c.lon);
      const dx = mx - p.x, dy = my - p.y;
      if (dx * dx + dy * dy < 900) {
        showClownInfo(c, uid);
      }
    });
  });

  function showClownInfo(c, uid) {
    const age = Date.now() - c.last_updated;
    const mins = Math.floor(age / 60000);
    let timeStr;
    if (mins < 1) timeStr = 'just now';
    else if (mins < 60) timeStr = mins + 'm ago';
    else timeStr = Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm ago';

    const stale = c.status === 'stale' ? ' (stale 💤)' : '';
    const pet = c.pet_emoji ? '\nWalking: ' + c.pet_emoji : '';

    toast('🤡 ' + c.name + stale + '\nHere: ' + timeStr + pet);
  }

  // ── Helpers ──
  async function getBestPosition() {
    // Try GPS first, fall back to map center
    if (navigator.geolocation) {
      try {
        const gps = await new Promise((res, rej) => {
          navigator.geolocation.getCurrentPosition(res, rej, {
            timeout: 5000,
            maximumAge: 30000,
            enableHighAccuracy: false
          });
        });
        return { lat: gps.coords.latitude, lon: gps.coords.longitude };
      } catch(e) {
        // GPS unavailable, use map center
      }
    }
    return { lat: S.lat, lon: S.lon };
  }

  function getMyUid() {
    if (typeof auth !== 'undefined' && auth && auth.currentUser) {
      return auth.currentUser.uid;
    }
    // Fallback: generate a persistent local ID
    let id = localStorage.getItem('sf_clown_uid');
    if (!id) {
      id = 'local_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('sf_clown_uid', id);
    }
    return id;
  }

  function getWalkingPetEmoji() {
    if (typeof activeWalkPetId === 'undefined' || !activeWalkPetId) return null;
    const SPECIES_EM = {dog:'🐶',cat:'🐱',bird:'🐦',fish:'🐠',rabbit:'🐰',hamster:'🐹',reptile:'🦎',other:'🐾'};
    const pet = S.pets.find(p => p._fbId === activeWalkPetId);
    if (pet) return SPECIES_EM[pet.species] || '🐾';
    return '🐾';
  }

})();
