// ═══════════════════════════════════════════════════════════════
//  lost-social.js — Social Blast Buttons for Lost Pet
//  Pre-filled share links — no OAuth, no API keys, just URLs
//  Called by panel-left.js when a pet is marked lost
// ═══════════════════════════════════════════════════════════════

(function () {

const PLATFORMS = [
  {
    id: 'whatsapp',
    label: '💬 WhatsApp',
    color: '#25D366',
    build: (pet, mapLink) =>
      `https://api.whatsapp.com/send?text=${enc(buildText(pet, mapLink))}`
  },
  {
    id: 'twitter',
    label: '🐦 X / Twitter',
    color: '#1DA1F2',
    build: (pet, mapLink) =>
      `https://twitter.com/intent/tweet?text=${enc(buildText(pet, mapLink))}`
  },
  {
    id: 'facebook',
    label: '📘 Facebook',
    color: '#1877F2',
    build: (pet, mapLink) =>
      `https://www.facebook.com/sharer/sharer.php?u=${enc(mapLink)}&quote=${enc(buildText(pet, mapLink))}`
  },
  {
    id: 'nextdoor',
    label: '🏘️ Nextdoor',
    color: '#8DB600',
    build: (pet, mapLink) =>
      `https://nextdoor.co.uk/` // Nextdoor has no pre-fill API — opens home, user pastes
  },
  {
    id: 'instagram',
    label: '📸 Instagram',
    color: '#E1306C',
    build: (pet, mapLink) =>
      `https://www.instagram.com/` // No web share API — opens app
  },
  {
    id: 'freeads',
    label: '📋 Freeads',
    color: '#cc8833',
    build: (pet, mapLink) =>
      `https://www.freeads.co.uk/pets/lost-and-found/`
  },
  {
    id: 'doglost',
    label: '🐕 DogLost',
    color: '#ff6633',
    build: (pet, mapLink) =>
      `https://www.doglost.co.uk/register-lost-dog`
  },
  {
    id: 'sms',
    label: '📱 SMS',
    color: '#88cc44',
    build: (pet, mapLink) =>
      `sms:?body=${enc(buildText(pet, mapLink))}`
  },
  {
    id: 'copy',
    label: '📋 Copy text',
    color: '#cc8833',
    isCopy: true,
    build: (pet, mapLink) => buildText(pet, mapLink)
  },
];

// ── Text builder ──
function buildText(pet, mapLink) {
  const em = (typeof SPECIES_EM !== 'undefined' ? SPECIES_EM[pet.species] : '') || '🐾';
  const lat = pet.lostLat ? pet.lostLat.toFixed(4) : (pet.lat ? pet.lat.toFixed(4) : '?');
  const lon = pet.lostLon ? pet.lostLon.toFixed(4) : (pet.lon ? pet.lon.toFixed(4) : '?');
  const when = pet.lostAt ? timeAgoFull(pet.lostAt) : 'recently';
  return [
    `🔴 LOST PET — ${em} ${pet.name}`,
    `Species: ${pet.species || 'unknown'}${pet.breed ? ' · ' + pet.breed : ''}`,
    `Last seen: ${lat}° N, ${lon}° W (${when})`,
    pet.bio ? `"${pet.bio}"` : '',
    `Please contact if found! 🐾`,
    mapLink ? `Map: ${mapLink}` : '',
  ].filter(Boolean).join('\n');
}

function enc(str) { return encodeURIComponent(str); }

function timeAgoFull(ts) {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + ' minutes ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' hours ago';
  return Math.floor(h / 24) + ' days ago';
}

function buildMapLink(pet) {
  if (!pet.lostLat) return window.location.href;
  return `https://www.google.com/maps?q=${pet.lostLat},${pet.lostLon}&z=15`;
}

// ── Native Web Share API (mobile) ──
async function tryNativeShare(pet) {
  const mapLink = buildMapLink(pet);
  if (!navigator.share) return false;
  try {
    await navigator.share({
      title: `🔴 LOST: ${pet.name}`,
      text: buildText(pet, mapLink),
      url: mapLink,
    });
    return true;
  } catch(e) { return false; }
}

// ── Render buttons into a container ──
window.renderLostSocialButtons = function(pet, container) {
  if (!container) return;
  const mapLink = buildMapLink(pet);

  // Native share first (mobile)
  const nativeBtn = navigator.share
    ? `<button class="lsb-btn lsb-native" onclick="lsbNativeShare()">📤 Share (native)</button>`
    : '';

  const btns = PLATFORMS.map(p => {
    if (p.isCopy) {
      return `<button class="lsb-btn" style="--lsb-c:${p.color}" onclick="lsbCopy('${encodeURIComponent(buildText(pet, mapLink))}')">${p.label}</button>`;
    }
    return `<a class="lsb-btn" style="--lsb-c:${p.color}" href="${p.build(pet, mapLink)}" target="_blank" rel="noopener">${p.label}</a>`;
  }).join('');

  container.innerHTML = `
    <style>
      .lsb-grid { display: flex; flex-wrap: wrap; gap: 4px; }
      .lsb-btn {
        display: inline-flex; align-items: center; gap: 3px;
        padding: 5px 8px; border-radius: 7px; cursor: pointer;
        font-family: 'Bubblegum Sans', cursive; font-size: .78rem;
        text-decoration: none; border: 1.5px solid var(--lsb-c, #cc8833);
        background: rgba(0,0,0,0.3); color: var(--lsb-c, #ffcc66);
        transition: all .12s; white-space: nowrap;
      }
      .lsb-btn:hover {
        background: rgba(255,30,30,0.15);
        box-shadow: 0 0 8px rgba(255,30,30,0.2);
        color: #fff;
      }
      .lsb-native {
        width: 100%; justify-content: center; margin-bottom: 4px;
        border-color: #ffcc66; color: #ffcc66;
        background: rgba(255,204,102,0.08);
      }
      .lsb-copied { color: #88cc44 !important; border-color: #88cc44 !important; }
    </style>
    ${nativeBtn}
    <div class="lsb-grid">${btns}</div>
  `;

  window.lsbNativeShare = () => tryNativeShare(pet);
  window.lsbCopy = (encoded) => {
    const text = decodeURIComponent(encoded);
    navigator.clipboard.writeText(text).then(() => {
      if (typeof toast === 'function') toast('📋 Copied! Paste anywhere 🐾');
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      if (typeof toast === 'function') toast('📋 Copied!');
    });
  };
};

})();
