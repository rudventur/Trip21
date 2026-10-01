// ═══════════════════════════════════════════════════════════════
//  panel-drag.js — Drag Manager for Snout First
//  Makes map pet pins draggable into left/right panels
//  Also adds service pins (vets/food) to map when requested
//  Additive only
// ═══════════════════════════════════════════════════════════════

(function () {

// ── Service pins (vets / food banks on the map) ──
const servicePins = [];

window.addServicePin = function(type, name, lat, lon) {
  if (typeof S === 'undefined') return;
  // Explicit coords (e.g. a real vet locator result) win; otherwise scatter near map centre
  servicePins.push({
    type, name,
    lat: (typeof lat === 'number') ? lat : S.lat + (Math.random() - 0.5) * 0.005,
    lon: (typeof lon === 'number') ? lon : S.lon + (Math.random() - 0.5) * 0.005,
  });
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

// ── Canvas drag — make pet pins draggable ──
// We intercept pointerdown on the canvas and check if it hits a pet
// If it does and held for 300ms without moving → start drag

let dragState = null;
const DRAG_HOLD_MS = 300;
const DRAG_MOVE_THRESHOLD = 8;

function initCanvasDrag() {
  const canvas = document.getElementById('snoutMap');
  if (!canvas) return;

  canvas.addEventListener('pointerdown', onCanvasPointerDown);
  canvas.addEventListener('pointermove', onCanvasPointerMove);
  canvas.addEventListener('pointerup', onCanvasPointerUp);
  canvas.addEventListener('pointercancel', cancelDrag);

  // Drag-over on panels
  const leftContent = document.getElementById('lpContent');
  const rightContent = document.getElementById('rpContent');

  [leftContent, rightContent].forEach(el => {
    if (!el) return;
    el.addEventListener('dragover', e => e.preventDefault());
  });
}

function onCanvasPointerDown(e) {
  if (typeof petAtScreen !== 'function') return;
  const petIdx = petAtScreen(e.clientX, e.clientY);
  if (petIdx < 0) return;

  dragState = {
    petIdx,
    startX: e.clientX, startY: e.clientY,
    moved: false,
    dragging: false,
    ghost: null,
    timer: setTimeout(() => {
      if (dragState && !dragState.moved) startPetDrag(dragState);
    }, DRAG_HOLD_MS)
  };
}

function onCanvasPointerMove(e) {
  if (!dragState) return;
  const dx = Math.abs(e.clientX - dragState.startX);
  const dy = Math.abs(e.clientY - dragState.startY);
  if (dx > DRAG_MOVE_THRESHOLD || dy > DRAG_MOVE_THRESHOLD) {
    dragState.moved = true;
    if (!dragState.dragging) {
      clearTimeout(dragState.timer);
    }
  }
  if (dragState.dragging && dragState.ghost) {
    dragState.ghost.style.left = (e.clientX + 12) + 'px';
    dragState.ghost.style.top  = (e.clientY + 12) + 'px';
    // Highlight panels on hover
    highlightDropTarget(e.clientX, e.clientY);
  }
}

function onCanvasPointerUp(e) {
  if (!dragState) return;
  clearTimeout(dragState.timer);
  if (dragState.dragging) {
    dropPetOnPanel(e.clientX, e.clientY, dragState.petIdx);
    removeGhost();
  }
  dragState = null;
}

function cancelDrag() {
  if (dragState) {
    clearTimeout(dragState.timer);
    removeGhost();
    dragState = null;
  }
}

function startPetDrag(state) {
  state.dragging = true;
  if (typeof S === 'undefined') return;
  const pet = S.pets[state.petIdx];
  if (!pet) return;

  const em = (typeof SPECIES_EM !== 'undefined' ? SPECIES_EM[pet.species] : '') || '🐾';

  // Ghost element
  const ghost = document.createElement('div');
  ghost.id = 'sfDragGhost';
  ghost.style.cssText = `
    position:fixed; z-index:9999; pointer-events:none;
    background:rgba(26,18,10,0.95); border:2px solid #cc8833;
    border-radius:10px; padding:5px 10px;
    font-family:'Bubblegum Sans',cursive; color:#ffcc66; font-size:.85rem;
    box-shadow:0 4px 16px rgba(0,0,0,0.5);
    left:${state.startX + 12}px; top:${state.startY + 12}px;
    white-space:nowrap;
  `;
  ghost.textContent = `${em} ${pet.name}`;
  document.body.appendChild(ghost);
  state.ghost = ghost;

  if (typeof toast === 'function') toast(`${em} Drag ${pet.name} to a panel!`);
}

function removeGhost() {
  const g = document.getElementById('sfDragGhost');
  if (g) g.remove();
  // Remove highlights
  document.querySelectorAll('.sf-drop-highlight').forEach(el => {
    el.classList.remove('sf-drop-highlight');
  });
}

function highlightDropTarget(x, y) {
  const lp = document.getElementById('lpRoot');
  const rp = document.getElementById('rpRoot');

  [lp, rp].forEach(panel => {
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const over = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    panel.style.boxShadow = over ? '0 0 20px rgba(136,204,68,0.4)' : '';
  });
}

function dropPetOnPanel(x, y, petIdx) {
  if (typeof S === 'undefined') return;
  const pet = S.pets[petIdx];
  if (!pet) return;

  const lp = document.getElementById('lpRoot');
  const rp = document.getElementById('rpRoot');

  let dropped = false;

  if (lp) {
    const rect = lp.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      // Already in S.pets — just refresh left panel and notify
      if (typeof lpRefresh === 'function') lpRefresh();
      if (typeof toast === 'function') toast(`🐾 ${pet.name} is in your litter panel!`);
      dropped = true;
    }
  }

  if (!dropped && rp) {
    const rect = rp.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      if (typeof toast === 'function') toast(`🐾 ${pet.name} added to friends panel!`);
      dropped = true;
    }
  }

  if (lp) lp.style.boxShadow = '';
  if (rp) rp.style.boxShadow = '';
}

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
  setTimeout(() => {
    initCanvasDrag();
    patchRAF();
  }, 800);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
