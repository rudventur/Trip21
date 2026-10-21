// =====================================================================
//  lost-pets.js — lost pets from Snout First on the ArtSpace City map
//  Snout First (js/lost-pet.js) keeps the pets that are lost right now in
//  localStorage 'artspace_lost_pets' ([{ name, species, lat, lon, lostAt }]).
//  This draws each one as a pulsing red pin with a search ring, and follows
//  changes made in another tab. Tap a pin to fly there.
// =====================================================================

const LOST_EMOJI = { dog: '🐶', cat: '🐱', bird: '🐦', fish: '🐠', rabbit: '🐰', hamster: '🐹', reptile: '🦎' };
let lostPets = [];

function loadLostPets() {
  try {
    const list = JSON.parse(localStorage.getItem('artspace_lost_pets') || '[]');
    lostPets = (Array.isArray(list) ? list : []).filter(p => p && p.active !== false && isFinite(p.lat) && isFinite(p.lon));
  } catch (e) { lostPets = []; }
}
loadLostPets();
window.addEventListener('storage', e => {
  if (e.key !== 'artspace_lost_pets') return;
  const before = lostPets.length;
  loadLostPets();
  if (lostPets.length > before && typeof showToast === 'function') showToast('🚨 ' + lostPets[lostPets.length - 1].name + ' is lost — look out for them!', '#ff4444');
});

function drawLostPets() {
  if (!lostPets.length) return;
  const t = G.frameN * 0.08;
  lostPets.forEach(p => {
    const s = worldToScreen(p.lat, p.lon);
    if (s.x < -60 || s.x > cv.width + 60 || s.y < -60 || s.y > cv.height + 60) return;
    const pulse = 14 + Math.sin(t) * 5;
    ctx.strokeStyle = 'rgba(255,40,40,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s.x, s.y, pulse + 10, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ff2222';
    ctx.shadowColor = '#ff2222'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(s.x, s.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(LOST_EMOJI[p.species] || '🐾', s.x, s.y + 5);
    ctx.fillStyle = '#ff6666';
    ctx.font = "11px 'VT323',monospace";
    ctx.fillText('LOST: ' + String(p.name).slice(0, 24), s.x, s.y - 16);
  });
}

// tap a lost pin to fly to it
function lostPetAt(x, y) {
  return lostPets.find(p => { const s = worldToScreen(p.lat, p.lon); return Math.abs(x - s.x) < 14 && Math.abs(y - s.y) < 14; });
}
