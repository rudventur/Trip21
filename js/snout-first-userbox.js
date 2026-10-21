// snout-first-userbox.js — Snout First's part of the shared RUDVENTUR useRbox.
//
// The profile box is the same on every RUDVENTUR page (embed/useRbox.js from
// RudVentur.com, the R circle top right): name, motto, saved places, restaurant
// and room are edited there. Only its left section changes per service; this file
// fills it for Snout First with:
//   📍 WALK SPOTS   the saved places of the shared profile (Snout First's old
//                   sf_walk_spots were copied in by the box), each with a button that
//                   flies the map there, and a way to save the map centre as a spot
//   🗑️ RESET        clears the Snout First data kept only in this browser
// If the shared box cannot load (offline), nothing here runs and the map still works.
(function () {
  'use strict';
  if (!window.rvUserbox || typeof window.rvUserbox.setLeft !== 'function') return;
  const box = window.rvUserbox;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const say = m => { if (typeof toast === 'function') toast(m); };

  const el = document.createElement('div');
  el.id = 'sfLeftSlot';
  el.innerHTML =
    '<div class="sfl-sub">📍 WALK SPOTS</div>' +
    '<div id="sflSpots"></div>' +
    '<div class="sfl-row"><input type="text" id="sflSpotName" maxlength="40" placeholder="Name this map spot">' +
    '<button type="button" class="btn btn-small" id="sflSave" title="Save the middle of the map as a walk spot">💾</button></div>' +
    '<small class="rb-dev-note">Spots are your saved places: the same list as 📌 Saved GPS Locations in Editing.</small>' +
    '<button type="button" class="btn" id="sflReset" style="width:100%;margin-top:10px">🗑️ RESET SNOUT FIRST DATA</button>';
  const css = document.createElement('style');
  css.textContent = '#sfLeftSlot .sfl-sub{font-weight:bold;margin:2px 0 6px}' +
    '#sfLeftSlot .sfl-row{display:flex;gap:6px;margin-top:6px}#sfLeftSlot .sfl-row input{flex:1;min-width:0}' +
    '#sfLeftSlot .sfl-spot{display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid rgba(0,255,65,.2)}' +
    '#sfLeftSlot .sfl-spot span{flex:1;min-width:0;overflow-wrap:anywhere}#sfLeftSlot .sfl-spot small{opacity:.6}';
  document.head.appendChild(css);

  function spots() { return (box.get().savedLocations || []).filter(l => isFinite(parseFloat(l.lat)) && isFinite(parseFloat(l.lon))); }
  function render() {
    const list = el.querySelector('#sflSpots'), all = spots();
    list.innerHTML = all.length ? all.map(l =>
      '<div class="sfl-spot"><span>' + esc(l.name || 'spot') + ' <small>' + (+l.lat).toFixed(4) + ', ' + (+l.lon).toFixed(4) + '</small></span>' +
      '<button type="button" class="btn btn-small" data-go="' + esc(l.id) + '" title="Fly the map here">🐾 GO</button></div>').join('')
      : '<div class="rb-empty">No walk spots yet</div>';
  }
  el.addEventListener('click', e => {
    const go = e.target.closest('[data-go]');
    if (go) {
      const s = spots().find(l => String(l.id) === go.getAttribute('data-go'));
      if (!s || typeof S === 'undefined') return;
      S.lat = +s.lat; S.lon = +s.lon;
      if (typeof zoomTarget !== 'undefined') zoomTarget = 15; // eslint-disable-line no-global-assign
      box.close();
      say('🐾 Off to ' + (s.name || 'your spot') + '!');
    }
  });
  el.querySelector('#sflSave').onclick = () => {
    const name = el.querySelector('#sflSpotName').value.trim();
    if (!name) { say('Name this spot first! 🐾'); return; }
    if (typeof S === 'undefined') return;
    const list = box.get().savedLocations || [];
    list.push({ name, lat: S.lat.toFixed(6), lon: S.lon.toFixed(6) });
    box.save({ savedLocations: list });
    el.querySelector('#sflSpotName').value = '';
    render();
    say('📍 ' + name + ' saved!');
  };
  el.querySelector('#sflReset').onclick = () => {
    if (!confirm('Reset all local Snout First data on this device? This clears pets pinned only in this browser, your notes, walks and settings. Pets already saved to the network and your useRbox profile are not affected.')) return;
    ['snoutfirst_pets', 'snoutfirst_sniffs', 'snoutfirst_pets_v2', 'sf_notes', 'sf_home', 'sf_lost_pets', 'sf_vets_custom', 'sf_food_custom', 'sf_walk_spots', 'sf_owner_signature', 'rv_local_uid', 'sf_walks', 'sf_pet_photos', 'sf_dashboard', 'sf_food_saved_v1', 'sf_panels'].forEach(k => localStorage.removeItem(k));
    say('🗑️ Local data cleared! Reloading...');
    setTimeout(() => location.reload(), 900);
  };
  // keep the R clear of Snout First's top bar and lists panel (where the old paw hub sat)
  function placeR() {
    if (typeof box.place !== 'function') return;
    const bar = document.getElementById('sfBar'), rp = document.getElementById('rpRoot');
    const barH = bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect().bottom : 0;
    if (window.matchMedia('(max-width: 700px)').matches || !rp) { box.place({ top: barH + 10, right: 10 }); return; }
    box.place({ top: barH + 10, right: Math.max(10, window.innerWidth - rp.getBoundingClientRect().left + 8) });
  }
  placeR();
  // panel-right.js builds #rpRoot on DOMContentLoaded, after this deferred script has run
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(placeR, 0));
  else setTimeout(placeR, 0);
  window.addEventListener('load', placeR);
  window.addEventListener('resize', placeR);
  document.addEventListener('transitionend', e => { if (e.target && (e.target.id === 'rpRoot' || e.target.id === 'sfBar')) placeR(); });
  document.addEventListener('click', () => setTimeout(placeR, 300));
  render();
  window.addEventListener('storage', e => { if (e.key === box.KEY) render(); });
  document.addEventListener('click', e => { if (e.target && e.target.id === 'saveGpsBtn' || (e.target.closest && e.target.closest('#gpsList'))) setTimeout(render, 0); });
  box.setLeft(el, { title: '🐾 SNOUT FIRST' });
  window.sfUserbox = { render, el };
})();
