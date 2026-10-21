// ═══════════════════════════════════════════════════════════════
//  snout-first-service.js — the SnoutFirst pet service
//
//  One front door for "a pet and its tile":
//    • the pet's state     pets(), byKey(), key(), emoji() — read from the map
//                          state (S.pets) that snout-first.html loads and syncs
//    • its dashboard place isOnDashboard(), placeOnDashboard(),
//                          takeOffDashboard() — the choice itself is stored by
//                          js/dashboard.js (sfDash, this device only)
//    • its tile behaviour  picking a pet up and dropping it on the dashboard,
//                          from a list tile on the right or a pin on the map
//
//  Why the drag is done here with pointer events (and not the browser's
//  built-in drag and drop it used before):
//    • the old drop target was a strip with no height that only appeared at
//      the top of the Pets tab, so dropping a tile anywhere else on the
//      dashboard (on other tiles, empty space, the header, another tab, the
//      collapsed edge) did nothing, while the cursor still said "drop here"
//    • built-in drag and drop does not start from a finger on most phones,
//      and on a phone the dashboard sheet is hidden while Lists is open, so
//      there was nowhere to drop
//    • dragging a map pin also panned the map under it, and on touch screens
//      the browser took the gesture over and cancelled the drag
//  Now the whole dashboard (any tab, open or tucked to its edge, the phone
//  strip) accepts the drop, the same code handles mouse, finger and pen, and
//  the map holds still while a pet is carried.
//
//  Gestures:
//    mouse on a list tile        press and move
//    finger / pen on a list tile press and hold (350 ms), then move
//    any pointer on a map pin    press and hold (350 ms), then move
//
//  Public: window.SnoutFirst (see the bottom of this file).
// ═══════════════════════════════════════════════════════════════

(function () {

const HOLD_MS = 350;          // hold this long to pick a pet up (finger, pen, map pin)
const SLOP_PX = 8;            // moving further before the hold ends = scroll or pan, not a drag
const MOUSE_START_PX = 6;     // mouse on a list tile: start carrying after this much movement

// ── Pet state ──
function dash() { return window.sfDash || null; }
function pets() { return (typeof S !== 'undefined' && Array.isArray(S.pets)) ? S.pets : []; }
function key(pet) { return dash() ? dash().key(pet) : ''; }
function byKey(k) { return dash() ? dash().byKey(k) : null; }
function emoji(pet) { return (pet && typeof SPECIES_EM !== 'undefined' && SPECIES_EM[pet.species]) || '🐾'; }
function say(msg) { if (typeof toast === 'function') toast(msg); }

// ── Dashboard placement ──
function isOnDashboard(pet) { return !!pet && !!dash() && !dash().isOff(pet); }

function placeOnDashboard(pet) {
  const D = dash();
  if (!pet || !D) return false;
  const already = isOnDashboard(pet);
  if (!already) D.putBack(pet);
  // Wide screens: open a tucked-away dashboard so the pet can be seen.
  // Phones keep their sheets as they are (the strip shows the new count).
  if (!D.isPhone() && !D.isPanelOpen('left')) D.setPanelOpen('left', true);
  if (typeof lpSwitchTab === 'function') lpSwitchTab('pets');
  flashTile(pet);
  say(already ? `${emoji(pet)} ${pet.name} is already on your dashboard`
              : `${emoji(pet)} ${pet.name} is on your dashboard`);
  return true;
}

function takeOffDashboard(pet) {
  if (!pet || !dash()) return false;
  dash().takeOff(pet);
  return true;
}

function flashTile(pet) {
  const k = key(pet);
  requestAnimationFrame(() => {
    const tile = Array.from(document.querySelectorAll('#lpContent .lp-pet-tile[data-key]'))
      .find(el => el.getAttribute('data-key') === k);
    if (!tile) return;
    tile.classList.add('sf-flash');
    if (tile.scrollIntoView) tile.scrollIntoView({ block: 'nearest' });
    setTimeout(() => tile.classList.remove('sf-flash'), 1200);
  });
}

// ── Where a pet can be dropped ──
function hit(el, x, y) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}
function dropTargetAt(x, y) {
  if (hit(document.getElementById('lpRoot'), x, y) || hit(document.getElementById('lpToggleBtn'), x, y)) return 'dashboard';
  if (hit(document.getElementById('rpRoot'), x, y) || hit(document.getElementById('rpToggleBtn'), x, y)) return 'lists';
  return null;
}

// ── Carrying a pet (one gesture at a time) ──
let g = null;   // { pet, pointerId, x0, y0, needsHold, timer, carrying, ghost, sourceEl }
let suppressClickUntil = 0;

function begin(e, pet, opts) {
  if (g || !pet) return;
  g = {
    pet, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY,
    needsHold: opts.needsHold, carrying: false, ghost: null, sourceEl: opts.sourceEl || null, timer: null
  };
  if (g.needsHold) g.timer = setTimeout(() => { if (g && !g.carrying) startCarry(g.x0, g.y0); }, HOLD_MS);
  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', cancel, true);
}

function startCarry(x, y) {
  if (!g) return;
  clearTimeout(g.timer);
  g.carrying = true;
  const ghost = document.createElement('div');
  ghost.className = 'sf-drag-ghost';
  ghost.textContent = `${emoji(g.pet)} ${g.pet.name}`;
  document.body.appendChild(ghost);
  g.ghost = ghost;
  moveGhost(x, y);
  if (g.sourceEl) g.sourceEl.classList.add('dragging');
  document.body.classList.add('sf-dragging');
  if (navigator.vibrate && g.needsHold) { try { navigator.vibrate(15); } catch (err) {} }
  say(`${emoji(g.pet)} Drop ${g.pet.name} on the dashboard`);
}

function moveGhost(x, y) {
  if (!g || !g.ghost) return;
  g.ghost.style.left = (x + 14) + 'px';
  g.ghost.style.top = (y + 14) + 'px';
  const over = dropTargetAt(x, y);
  const lp = document.getElementById('lpRoot');
  if (lp) lp.classList.toggle('sf-drop-over', over === 'dashboard');
}

function onMove(e) {
  if (!g || e.pointerId !== g.pointerId) return;
  const far = Math.abs(e.clientX - g.x0) > SLOP_PX || Math.abs(e.clientY - g.y0) > SLOP_PX;
  if (!g.carrying) {
    if (g.needsHold) { if (far) end(); return; }                 // it was a scroll or a pan
    if (Math.abs(e.clientX - g.x0) > MOUSE_START_PX || Math.abs(e.clientY - g.y0) > MOUSE_START_PX) startCarry(e.clientX, e.clientY);
    return;
  }
  if (e.cancelable) e.preventDefault();
  moveGhost(e.clientX, e.clientY);
}

function onUp(e) {
  if (!g || e.pointerId !== g.pointerId) return;
  if (g.carrying) {
    const pet = g.pet;
    const where = dropTargetAt(e.clientX, e.clientY);
    suppressClickUntil = Date.now() + 500;     // the release is not a click on whatever is under it
    end();
    if (where === 'dashboard') placeOnDashboard(pet);
    else if (where === 'lists') say(`🐾 ${pet.name} is always in the lists`);
    return;
  }
  end();
}

function cancel() { end(); }

function end() {
  if (!g) return;
  clearTimeout(g.timer);
  if (g.ghost) g.ghost.remove();
  if (g.sourceEl) g.sourceEl.classList.remove('dragging');
  document.body.classList.remove('sf-dragging');
  const lp = document.getElementById('lpRoot');
  if (lp) lp.classList.remove('sf-drop-over');
  window.removeEventListener('pointermove', onMove, true);
  window.removeEventListener('pointerup', onUp, true);
  window.removeEventListener('pointercancel', cancel, true);
  g = null;
}

function isDragging() { return !!(g && g.carrying); }

// While a pet is carried by a finger, the page must not scroll under it,
// and a long press must not open the phone's own menu.
document.addEventListener('touchmove', e => { if (isDragging() && e.cancelable) e.preventDefault(); }, { passive: false });
document.addEventListener('contextmenu', e => { if (g) e.preventDefault(); }, true);
document.addEventListener('click', e => {
  if (Date.now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); suppressClickUntil = 0; }
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && g) end(); });

// ── Tiles: any element matching selector inside container, carrying data-key ──
function bindTiles(container, selector) {
  if (!container) return;
  container.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('a, input, textarea, select')) return;
    const tile = e.target.closest(selector);
    if (!tile || !container.contains(tile)) return;
    const pet = byKey(tile.getAttribute('data-key'));
    if (pet) begin(e, pet, { needsHold: e.pointerType !== 'mouse', sourceEl: tile });
  });
}

// ── Map pins: hold a pin, then carry it ──
function bindMapPins(canvas) {
  if (!canvas) return;
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0 || typeof petAtScreen !== 'function') return;
    const i = petAtScreen(e.clientX, e.clientY);
    if (i >= 0) begin(e, pets()[i], { needsHold: true });
  });
}

function init() {
  bindTiles(document.getElementById('rpContent'), '.rp-pet[data-key]');
  bindMapPins(document.getElementById('snoutMap'));
}
// The panels are injected on DOMContentLoaded; bind one task later so they exist.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
else setTimeout(init, 0);

// ── Public ──
window.SnoutFirst = {
  pets, key, byKey, emoji,
  isOnDashboard, placeOnDashboard, takeOffDashboard,
  dropTargetAt, isDragging, cancelDrag: end,
  bindTiles, bindMapPins
};

})();
