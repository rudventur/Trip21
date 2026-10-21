// ═══════════════════════════════════════════════════════════════
//  lost-zone.js — Canvas Lost Zone Overlay
//  Draws pulsing red radius from last known GPS position
//  Hooks into the existing render loop via requestAnimationFrame
//  Additive only — never modifies existing drawPets/drawTiles
// ═══════════════════════════════════════════════════════════════

(function () {

let lostZoneActive = false;
let lostZonePet = null;
let lostZoneFrame = 0;
const BASE_RADIUS_M = 500; // metres — the initial search zone
let zoneRadiusM = BASE_RADIUS_M; // grows with updateLostZoneRadius()

// ── Metres to pixels at current zoom ──
function metresToPixels(metres) {
  if (typeof S === 'undefined') return 80;
  const metersPerPixel = 156543.03392 * Math.cos(S.lat * Math.PI / 180) / Math.pow(2, S.zoom);
  return metres / metersPerPixel;
}

// ── Draw the zone on the existing canvas ──
function drawLostZoneOverlay() {
  if (!lostZoneActive || !lostZonePet) return;
  window.updateLostZoneRadius(); // the zone widens the longer the pet has been missing

  const canvas = document.getElementById('snoutMap');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (typeof worldToScreen !== 'function') return;
  const pos = worldToScreen(lostZonePet.lostLat || lostZonePet.lat, lostZonePet.lostLon || lostZonePet.lon);

  lostZoneFrame++;
  const pulse = 0.5 + 0.5 * Math.sin(lostZoneFrame * 0.04); // 0→1→0
  const radiusPx = metresToPixels(zoneRadiusM);

  // Outer pulse ring
  ctx.save();
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radiusPx * (1 + pulse * 0.12), 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255,30,30,${0.15 + pulse * 0.2})`;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 6]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Fill zone
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radiusPx, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(200,0,0,${0.06 + pulse * 0.05})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(255,40,40,${0.4 + pulse * 0.3})`;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Centre cross — last known position
  ctx.strokeStyle = `rgba(255,60,60,${0.7 + pulse * 0.3})`;
  ctx.lineWidth = 2;
  const cs = 10;
  ctx.beginPath();
  ctx.moveTo(pos.x - cs, pos.y); ctx.lineTo(pos.x + cs, pos.y);
  ctx.moveTo(pos.x, pos.y - cs); ctx.lineTo(pos.x, pos.y + cs);
  ctx.stroke();

  // Label
  ctx.font = '13px "Bubblegum Sans", cursive';
  ctx.fillStyle = `rgba(255,80,80,${0.8 + pulse * 0.2})`;
  ctx.textAlign = 'center';
  const em = (typeof SPECIES_EM !== 'undefined' ? SPECIES_EM[lostZonePet.species] : '') || '🐾';
  ctx.fillText(`${em} ${lostZonePet.name} — LAST SEEN HERE`, pos.x, pos.y - radiusPx - 10);

  // Radius label
  ctx.font = '11px "VT323", monospace';
  ctx.fillStyle = `rgba(255,100,100,0.5)`;
  ctx.fillText(`~${zoneRadiusM < 1000 ? Math.round(zoneRadiusM) + 'm' : (zoneRadiusM / 1000).toFixed(1) + 'km'} search zone`, pos.x, pos.y + radiusPx + 14);

  ctx.restore();
}

// ── Hook into render loop ──
// The existing render() in snoutfirst.html calls requestAnimationFrame(render)
// We patch in AFTER the existing drawPets call by wrapping requestAnimationFrame
const _origRAF = window.requestAnimationFrame.bind(window);
let _rafPatched = false;

function patchRenderLoop() {
  if (_rafPatched) return;
  _rafPatched = true;

  // Override requestAnimationFrame to inject our overlay draw
  // after each frame
  window.requestAnimationFrame = function(cb) {
    return _origRAF(function(ts) {
      cb(ts);
      // Draw AFTER the main render so we're on top
      if (lostZoneActive) drawLostZoneOverlay();
    });
  };
}

// ── Public API ──
window.drawLostZone = function(pet) {
  lostZoneActive = true;
  lostZonePet = pet;
  zoneRadiusM = BASE_RADIUS_M;
  patchRenderLoop();
};

window.clearLostZone = function() {
  lostZoneActive = false;
  lostZonePet = null;
};

// Widen (or reset) the search zone, in metres. With no number it grows by the time
// since the pet went missing: a lost pet can cover about 1 km an hour, capped at 5 km.
window.updateLostZoneRadius = function(metres) {
  if (!isFinite(metres)) {
    const since = lostZonePet && lostZonePet.lostAt ? (Date.now() - lostZonePet.lostAt) / 3600000 : 0;
    metres = BASE_RADIUS_M + since * 1000;
  }
  zoneRadiusM = Math.max(BASE_RADIUS_M, Math.min(5000, metres));
  return zoneRadiusM;
};
window.getLostZoneRadius = function() { return zoneRadiusM; };

})();
