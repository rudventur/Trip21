// ═══════════════════════════════════════════════════════════════
//  panel-drag.js — service pins for Snout First
//  Adds service pins (vets / food banks) to the map when requested.
//  (Dragging pets onto the dashboard moved to js/snout-first-service.js.)
//  Additive only
// ═══════════════════════════════════════════════════════════════

(function () {

// ── Service pins (vets / food banks on the map) ──
const servicePins = [];

window.addServicePin = function(type, name, lat, lon) {
  if (typeof S === 'undefined') return;
  // Only real positions: a pin without coordinates is never placed at a
  // made-up spot (the old Food "+ map" button scattered pins at random).
  if (typeof lat !== 'number' || typeof lon !== 'number' || !isFinite(lat) || !isFinite(lon)) return;
  servicePins.push({ type, name, lat, lon });
  if (typeof toast === 'function') toast(`📍 ${name} pinned on map!`);
};

// ── Draw service pins on canvas (hooked into RAF below) ──
function drawServicePins() {
  if (!servicePins.length) return;
  const canvas = document.getElementById('snoutMap');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof worldToScreen !== 'function') return;

  servicePins.forEach(pin => {
    const p = worldToScreen(pin.lat, pin.lon);
    if (p.x < -40 || p.x > canvas.width + 40) return;

    const color = pin.type === 'vet' ? '#4499ff' : '#88cc44';
    const em = pin.type === 'vet' ? '🏥' : '🥣';

    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(26,18,10,0.92)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(em, p.x, p.y);

    // Label
    ctx.font = '11px "Bubblegum Sans", cursive';
    ctx.fillStyle = color;
    const lw = ctx.measureText(pin.name).width + 6;
    ctx.fillStyle = 'rgba(26,18,10,0.85)';
    ctx.fillRect(p.x - lw / 2, p.y - 30, lw, 14);
    ctx.fillStyle = color;
    ctx.fillText(pin.name, p.x, p.y - 22);
    ctx.restore();
  });
}

// ── Pet pins → dashboard ──
// Carrying a pet pin (or a list tile) onto the dashboard now lives in the
// SnoutFirst pet service, js/snout-first-service.js. The old version here
// listened on the map only, so the map panned under the pet and touch
// screens cancelled the drag.

// ── Patch RAF to draw service pins ──
const _raf0 = window.requestAnimationFrame.bind(window);
let _patched = false;

function patchRAF() {
  if (_patched) return;
  _patched = true;
  window.requestAnimationFrame = function(cb) {
    return _raf0(function(ts) {
      cb(ts);
      drawServicePins();
    });
  };
}

// ── Init (wait for DOM + canvas) ──
function init() {
  // Wait a tick for canvas to exist
  setTimeout(patchRAF, 800);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
