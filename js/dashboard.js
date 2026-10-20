// ═══════════════════════════════════════════════════════════════
//  dashboard.js — shared state for the new Snout First layout
//
//    top bar     : the "sniff sniff" search box filters pets in both panels
//    left panel  : the dashboard (pet cards you can take off with ✕)
//    right panel : lists that always show every pet (All, My pets, Lost,
//                  Out walking, Off dashboard) with a button to put a pet
//                  back on / pin it to the top of the dashboard
//
//  Taking a pet off the dashboard is a choice for THIS DEVICE ONLY. It never
//  deletes the pet from the map, the shared database or the lists. The choice
//  is kept in localStorage under DASH_KEY.
//
//  Hook for later features: window.sfDash (see the bottom of this file).
//    sfDash.setQuery(text) / sfDash.query()   — drive or read the search
//    sfDash.onChange(fn)                      — run fn whenever pets, the
//                                               search or the dashboard change
//    sfDash.LISTS                             — the list definitions the right
//                                               panel draws; add one here
//
//  Search modes: the top box searches whatever the open tab is about.
//    pets (default) · vets (js/vets.js) · food banks (js/foodbanks.js)
//    sfDash.registerSearchMode(id, spec)      — add a mode; id is the right
//                                               panel tab it belongs to
//    sfDash.searchMode() / sfDash.setTabMode(tab) / sfDash.onModeChange(fn)
//    sfDash.submitSearch()                    — what Enter and the search
//                                               button do in the current mode
// ═══════════════════════════════════════════════════════════════

(function () {

const DASH_KEY = 'sf_dashboard';               // { off: [petKey], pinned: [petKey] }
const PHONE = window.matchMedia('(max-width: 700px)');

// ── Saved dashboard choices (this device only) ──
function loadState() {
  try {
    const v = JSON.parse(localStorage.getItem(DASH_KEY) || '{}') || {};
    return {
      off: Array.isArray(v.off) ? v.off.map(String) : [],
      pinned: Array.isArray(v.pinned) ? v.pinned.map(String) : []
    };
  } catch (e) { return { off: [], pinned: [] }; }
}
let state = loadState();
function saveState() {
  try { localStorage.setItem(DASH_KEY, JSON.stringify(state)); } catch (e) {}
}

// ── Pets ──
function allPets() {
  return (typeof S !== 'undefined' && Array.isArray(S.pets)) ? S.pets : [];
}
// A stable name for a pet on this device. Shared pets use their database id;
// pets kept only in this browser use the time they were pinned plus their name.
function petKey(pet) {
  if (!pet) return '';
  if (pet._fbId) return 'shared:' + safeId(pet._fbId);
  return 'local:' + (Number(pet.timestamp) || 0) + ':' + String(pet.name == null ? '' : pet.name);
}
function petByKey(k) { return allPets().find(p => petKey(p) === k) || null; }
function petIndex(pet) { return allPets().indexOf(pet); }

// A pet with no owner id only exists in this browser, so it is this device's.
// A shared pet is mine only if this sign-in registered it.
function isMine(pet) {
  if (!pet) return false;
  if (pet.registered_by) return typeof getUid === 'function' && pet.registered_by === getUid();
  return true;
}
function isOff(pet) { return state.off.includes(petKey(pet)); }
function isPinned(pet) { return !isOff(pet) && state.pinned.includes(petKey(pet)); }

function takeOff(pet) {
  const k = petKey(pet);
  if (!k) return;
  if (!state.off.includes(k)) state.off.push(k);
  state.pinned = state.pinned.filter(x => x !== k);
  saveState(); changed();
}
function putBack(pet) {
  const k = petKey(pet);
  if (!k) return;
  state.off = state.off.filter(x => x !== k);
  saveState(); changed();
}
function pin(pet) {
  const k = petKey(pet);
  if (!k) return;
  state.off = state.off.filter(x => x !== k);
  state.pinned = [k].concat(state.pinned.filter(x => x !== k));
  saveState(); changed();
}
function unpin(pet) {
  const k = petKey(pet);
  state.pinned = state.pinned.filter(x => x !== k);
  saveState(); changed();
}

// ── Search ("sniff sniff") — name, breed, species and tags ──
let q = '';
function terms() { return q.toLowerCase().split(/\s+/).filter(Boolean); }
function matches(pet) {
  const t = terms();
  if (!t.length) return true;
  const tags = Array.isArray(pet.tags) ? pet.tags : [];
  const hay = [pet.name, pet.breed, pet.species].concat(tags)
    .map(x => String(x == null ? '' : x).toLowerCase()).join('\n');
  return t.every(w => hay.includes(w));
}
function setQuery(text) {
  const t = String(text == null ? '' : text).slice(0, 80);
  // In the vets or food bank mode the pet search waits until pets come back.
  if (curMode !== 'pets') { modeText.pets = t; return; }
  q = t;
  const input = document.getElementById('searchInput');
  if (input && input.value !== q) input.value = q;
  changed();
}

// Pets for the dashboard: not taken off, pinned ones first (newest pin first).
function dashboardPets() {
  const on = allPets().filter(p => !isOff(p));
  const rank = p => { const i = state.pinned.indexOf(petKey(p)); return i < 0 ? Infinity : i; };
  return on.map((p, i) => ({ p, i })).sort((a, b) => (rank(a.p) - rank(b.p)) || (a.i - b.i)).map(x => x.p);
}

// ── Lists for the right panel — built only from real pet data ──
const LISTS = [
  { id: 'all', icon: '🐾', label: 'All pets', test: () => true,
    desc: 'Every pet on the map, including ones taken off your dashboard.',
    empty: 'No pets on the map yet. Tap 🐾 PIN PET, then tap the map to add one.' },
  { id: 'mine', icon: '🏠', label: 'My pets', test: isMine,
    desc: 'Pets pinned from this device (or by your sign-in when the shared map is on).',
    empty: 'None of the pets here are yours yet. Pets you pin from this device show up here.' },
  { id: 'lost', icon: '🔴', label: 'Lost', test: p => !!p.lost,
    desc: 'Pets marked lost.',
    empty: 'No pets are marked lost right now. 🎾' },
  { id: 'walking', icon: '🚶', label: 'Out walking', test: p => p.status === 'walking',
    desc: 'Pets out on a walk right now (walks come from the shared map).',
    empty: 'No pets are out on a walk right now.' },
  { id: 'off', icon: '💤', label: 'Off dashboard', test: isOff,
    desc: 'Pets you took off your dashboard on this device. They are still on the map.',
    empty: 'Every pet is on your dashboard. Take one off with ✕ on the left and it waits here.' },
  { id: 'friends', icon: '🤝', label: 'Friends and family', later: true, test: () => false,
    desc: '',
    empty: 'Friends and family lists are coming later. There is nothing here yet.' }
];
function listById(id) { return LISTS.find(l => l.id === id) || null; }
function listPets(id) {
  const l = listById(id);
  if (!l || l.later) return [];
  return allPets().filter(p => { try { return l.test(p); } catch (e) { return false; } });
}

// ── Change notification ──
const listeners = [];
function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }
let lastSig = '';
function signature() {
  return allPets().map(p => [petKey(p), p.name, p.breed, p.status, p.lost ? 1 : 0, p.mood,
    p.registered_by || '', (Array.isArray(p.tags) ? p.tags : []).join(',')].join('|')).join('\n');
}
function changed() {
  lastSig = signature();
  updateBar();
  listeners.forEach(fn => { try { fn(); } catch (e) { console.warn('dashboard listener', e); } });
}
// Pets arrive from the shared database and from other panels at any time;
// a light check keeps both panels in step without touching that code.
setInterval(() => { if (signature() !== lastSig) changed(); }, 800);

// ── Top bar: match count + clear button ──
function updateBar() {
  // Panel header numbers: pets on the dashboard / pets in the lists.
  document.querySelectorAll('[data-count="dash"]').forEach(el => { el.textContent = dashboardPets().length; });
  document.querySelectorAll('[data-count="all"]').forEach(el => { el.textContent = allPets().length; });
  const count = document.getElementById('sfSearchCount');
  const clear = document.getElementById('sfSearchClear');
  const text = curMode === 'pets' ? q : (modeText[curMode] || '');
  if (clear) clear.style.visibility = text ? 'visible' : 'hidden';
  if (!count) return;
  let label = '';
  if (curMode === 'pets') {
    const total = allPets().length;
    if (q) label = allPets().filter(matches).length + ' of ' + total + ' pet' + (total === 1 ? '' : 's');
  } else if (text) {
    const m = modes[curMode];
    let c = null;
    try { c = m && typeof m.count === 'function' ? m.count() : null; } catch (e) { c = null; }
    if (c && c.total) label = c.shown + ' of ' + c.total + ' ' + (c.total === 1 ? c.one : c.many);
  }
  count.textContent = label;
  count.style.display = label ? 'inline' : 'none';
}

// ── Search modes: the top box follows the open tab ──
// Each mode remembers its own text, so a pet name typed earlier never filters
// the vets, and coming back to the pets brings the pet search back.
const modes = {
  pets: { id: 'pets', icon: '🐾', label: 'pets', placeholder: 'sniff sniff',
    aria: 'Search pets by name, breed or tag. Press Enter to go to the first match, or to look up a place.',
    button: '🗺 place', buttonTitle: 'Look up this text as a place and move the map there' }
};
const modeText = {};
const modeListeners = [];
let tabMode = 'pets';      // mode of the open tab in the right panel
let curMode = 'pets';      // mode actually in use (see effectiveMode)
function registerSearchMode(id, spec) {
  id = String(id || '');
  if (!id || id === 'pets' || !spec) return;
  modes[id] = Object.assign({ id, icon: '🔎', label: id, placeholder: 'sniff sniff ' + id + '…',
    aria: 'Search ' + id, button: '🔎 search', buttonTitle: 'Search' }, spec, { id });
  applyMode();
}
// The tab the right panel shows decides the mode. On a phone only one sheet
// is visible: while the dashboard sheet is open, the box searches pets.
function setTabMode(tab) {
  tabMode = modes[tab] ? tab : 'pets';
  applyMode();
}
function effectiveMode() {
  if (tabMode !== 'pets' && isPhone() && isPanelOpen('left')) return 'pets';
  return modes[tabMode] ? tabMode : 'pets';
}
function applyMode(force) {
  const next = effectiveMode();
  const input = document.getElementById('searchInput');
  if (next !== curMode || force) {
    const prev = curMode;
    if (next !== prev) {
      // Leaving a mode: keep its text. Leaving pets also stops filtering the pets.
      if (prev === 'pets') { modeText.pets = q; if (q) { q = ''; changed(); } }
      curMode = next;
      if (next === 'pets') { const back = modeText.pets || ''; if (back !== q) { q = back; changed(); } }
    }
    const m = modes[curMode];
    const text = curMode === 'pets' ? q : (modeText[curMode] || '');
    if (input) {
      input.placeholder = m.placeholder;
      input.setAttribute('aria-label', m.aria);
      if (input.value !== text) input.value = text;
    }
    const bar = document.getElementById('sfBar');
    if (bar) bar.dataset.searchMode = curMode;
    const chip = document.getElementById('sfModeChip');
    if (chip) {
      chip.dataset.mode = curMode;
      chip.classList.toggle('other', curMode !== 'pets');
      chip.title = curMode === 'pets' ? 'The search box is searching pets'
        : 'The search box is searching ' + m.label + ' (the ' + m.label + ' tab is open). Tap to show the list.';
      const lab = document.getElementById('sfModeLabel');
      if (lab) lab.textContent = m.icon + ' ' + m.label;
    }
    const btn = document.getElementById('sfSearchGo');
    if (btn) { btn.textContent = m.button; btn.title = m.buttonTitle; }
    if (next !== prev || force) {
      if (curMode !== 'pets' && typeof m.filter === 'function') { try { m.filter(text); } catch (e) {} }
      modeListeners.forEach(fn => { try { fn(curMode, prev); } catch (e) { console.warn('search mode listener', e); } });
    }
  }
  updateBar();
}
function onModeChange(fn) { if (typeof fn === 'function') modeListeners.push(fn); }
// Typing in the box.
function typed(text) {
  if (curMode === 'pets') { setQuery(text); return; }
  modeText[curMode] = String(text == null ? '' : text).slice(0, 80);
  const m = modes[curMode];
  if (m && typeof m.filter === 'function') { try { m.filter(modeText[curMode]); } catch (e) {} }
  updateBar();
}
// Enter or the search button. Returns false in pet mode so the page keeps its
// pet search and place behaviour.
function submitSearch() {
  if (curMode === 'pets') return false;
  const m = modes[curMode];
  const text = (modeText[curMode] || '').trim();
  if (m && typeof m.submit === 'function') {
    // The results show in the right panel: open it (the bottom sheet on phones).
    if (!isPanelOpen('right')) setPanelOpen('right', true);
    try { m.submit(text); } catch (e) { console.warn('search submit', e); }
  }
  return true;
}
// Lets a mode empty the box after its search (e.g. a place was found).
function setModeText(id, text) {
  if (!modes[id] || id === 'pets') return;
  modeText[id] = String(text == null ? '' : text).slice(0, 80);
  if (curMode === id) {
    const input = document.getElementById('searchInput');
    if (input && input.value !== modeText[id]) input.value = modeText[id];
    const m = modes[id];
    if (m && typeof m.filter === 'function') { try { m.filter(modeText[id]); } catch (e) {} }
  }
  updateBar();
}

// Enter in the search box: focus the first matching pet on the map. Returns
// false when nothing matches, so the caller can look the text up as a place.
function focusFirstMatch() {
  if (!terms().length) return false;
  const list = dashboardPets().filter(matches);
  const pet = list[0] || allPets().find(matches);
  if (!pet) return false;
  if (typeof panToPet === 'function') panToPet(petIndex(pet));
  return true;
}

// ── Panels: side columns on wide screens, bottom sheets on phones ──
function isPhone() { return PHONE.matches; }
function roots() { return { lp: document.getElementById('lpRoot'), rp: document.getElementById('rpRoot') }; }

// opts.restore: setting the starting state, not a choice to remember.
function setPanelOpen(side, open, opts) {
  const { lp, rp } = roots();
  const me = side === 'left' ? lp : rp;
  if (!me) return;
  me.classList.toggle(side === 'left' ? 'lp-collapsed' : 'rp-collapsed', !open);
  // Wide screens remember each column (js/panel-toggle.js, key sf_panels).
  // Phones always start with both sheets closed, so nothing is saved there.
  if (!isPhone() && !(opts && opts.restore) && window.sfPanels) sfPanels.save(side, !!open);
  // On a phone only one sheet is open at a time.
  if (open && isPhone()) {
    const other = side === 'left' ? rp : lp;
    if (other) other.classList.add(side === 'left' ? 'rp-collapsed' : 'lp-collapsed');
  }
  layout();
}
function isPanelOpen(side) {
  const { lp, rp } = roots();
  if (side === 'left') return !!lp && !lp.classList.contains('lp-collapsed');
  return !!rp && !rp.classList.contains('rp-collapsed');
}

function layout() {
  const { lp, rp } = roots();
  const rootStyle = document.documentElement.style;
  const phone = isPhone();
  const lpOpen = isPanelOpen('left'), rpOpen = isPanelOpen('right');
  document.body.classList.toggle('sf-phone', phone);
  document.body.classList.toggle('sf-sheet-left', phone && lpOpen);
  document.body.classList.toggle('sf-sheet-right', phone && rpOpen && !lpOpen);
  // Edge tabs and header buttons: chevron, "hide"/"show", title and aria state.
  if (window.sfPanels) { sfPanels.sync('left'); sfPanels.sync('right'); }
  // How much of each side the panels cover, so floating buttons sit beside them.
  rootStyle.setProperty('--lp-edge', (!phone && lp) ? Math.round(lp.getBoundingClientRect().right) + 'px' : '0px');
  rootStyle.setProperty('--rp-edge', (!phone && rp) ? Math.round(window.innerWidth - rp.getBoundingClientRect().left) + 'px' : '0px');
  if (effectiveMode() !== curMode) applyMode();
}

// Header buttons inside both panels (the phone sheet tabs).
document.addEventListener('click', e => {
  const b = e.target.closest('[data-sheet]');
  if (!b || !isPhone()) return;
  const which = b.dataset.sheet;
  if (which === 'close') { setPanelOpen('left', false); setPanelOpen('right', false); return; }
  if (isPanelOpen(which)) setPanelOpen(which, false);
  else setPanelOpen(which, true);
});

function applyScreenSize() {
  // Phones start with both sheets closed so the map is visible; wide screens
  // start with both columns the way they were left (open the first time).
  const phone = isPhone();
  const remembered = side => window.sfPanels ? sfPanels.saved(side, true) : true;
  setPanelOpen('left', !phone && remembered('left'), { restore: true });
  setPanelOpen('right', !phone && remembered('right'), { restore: true });
}
if (PHONE.addEventListener) PHONE.addEventListener('change', applyScreenSize);
else if (PHONE.addListener) PHONE.addListener(applyScreenSize);
window.addEventListener('resize', layout);
document.addEventListener('transitionend', e => {
  if (e.target && (e.target.id === 'lpRoot' || e.target.id === 'rpRoot')) layout();
});

// ── Search box wiring ──
function bindSearch() {
  const input = document.getElementById('searchInput');
  if (input) input.addEventListener('input', () => typed(input.value));
  const clear = document.getElementById('sfSearchClear');
  if (clear) clear.addEventListener('click', () => { typed(''); if (input) { input.value = ''; input.focus(); } });
  const chipX = document.getElementById('sfModeExit');
  if (chipX) chipX.addEventListener('click', () => {
    // Back to the pet search: show the pet lists in the right panel.
    if (typeof rpSwitchTab === 'function') rpSwitchTab('all'); else setTabMode('all');
    if (input) input.focus();
  });
  const chip = document.getElementById('sfModeChip');
  if (chip) chip.addEventListener('click', e => {
    if (e.target.closest('#sfModeExit')) return;
    // On a phone the Vets and Food lists live in the bottom sheet: open it.
    if (curMode !== 'pets') setPanelOpen('right', true);
  });
  applyMode(true);
  updateBar();
}
bindSearch();

// Both panels exist once every DOMContentLoaded listener has run.
document.addEventListener('DOMContentLoaded', () => setTimeout(() => { applyScreenSize(); changed(); }, 0));

// ── Public hook ──
window.sfDash = {
  STORE_KEY: DASH_KEY,
  LISTS, listById, listPets,
  key: petKey, byKey: petByKey, indexOf: petIndex,
  isMine, isOff, isPinned,
  takeOff, putBack, pin, unpin,
  query: () => q, setQuery, matches, dashboardPets, focusFirstMatch,
  onChange, refresh: changed,
  isPhone, setPanelOpen, isPanelOpen, layout,
  // search modes (the top box follows the open tab)
  registerSearchMode, setTabMode, onModeChange, submitSearch, setModeText,
  searchMode: () => curMode, tabMode: () => tabMode,
  modeText: id => (id || curMode) === 'pets' ? q : (modeText[id || curMode] || ''),
  searchModes: () => Object.keys(modes)
};

})();
