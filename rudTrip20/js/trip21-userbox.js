// trip21-userbox.js — Trip21 only.
//
// Mateusz asked: when rudTrip20 runs inside Trip21, the searches and the
// inventory should live in the LEFT section of the useRbox (the shared RUDVENTUR
// profile box from RudVentur.com/embed/useRbox.js, opened with the R circle top
// right), instead of on the page.
//
// What this does, once the useRbox has appeared:
//   * adds three folds at the top of the useRbox left section:
//       🔎 TRIP SEARCHES  the search modes, Present / Past / Future, start point,
//                         keywords, time window, trip type and transport ticks
//                         (the real controls are moved there, so they keep working)
//       🎒 INVENTORY      the inventory column (also moved, still saves the same way)
//       👥 GROUP TRIP     the room status and a button to open the group trip panel
//   * leaves a small bar on the page where the searches were, with a button that
//     opens the useRbox on that section. The search region map and the
//     "I'm Feeling Lucky" button stay on the page.
//
// If the useRbox cannot load (offline, or the page is used outside Trip21),
// nothing is moved and the page looks exactly as before.
(function () {
  "use strict";
  const WAIT_MS = 20000;

  const page = {
    searchBlocks: () => {
      const container = document.querySelector(".container");
      if (!container) return [];
      const start = container.querySelector(":scope > .lucky-row");
      const end = container.querySelector(":scope > .ticks");
      if (!start || !end) return [];
      const out = [];
      for (let n = start; n; n = n.nextElementSibling) {
        out.push(n);
        if (n === end) break;
      }
      return out;
    },
    inventory: () => document.getElementById("inventory")
  };

  const CSS = `
    #useRbox .rt21-fold .rb-fold-body { padding-top: 6px; }
    #useRbox .rt21-fold input[type=checkbox], #useRbox .rt21-fold input[type=radio] { width: auto; }
    #useRbox .rt21-search .row { display: flex; flex-wrap: wrap; gap: 6px; }
    #useRbox .rt21-search .row > input[type=text], #useRbox .rt21-search .row > input[type=date] { flex: 1 1 100%; min-width: 0; }
    #useRbox .rt21-search .lucky-row, #useRbox .rt21-search .secondary { display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 8px; }
    #useRbox .rt21-search .lucky-btn, #useRbox .rt21-search .sec-btn { flex: 1 1 auto; font-size: 11px; padding: 5px 7px; }
    #useRbox .rt21-search .field { margin: 0 0 10px; }
    #useRbox .rt21-search .ticks { display: grid; gap: 2px; }
    #useRbox .rt21-search .ticks label { display: flex; gap: 6px; align-items: center; }
    #useRbox #inventory { width: auto; flex: none; margin: 0; }
    #useRbox #inventory .sf-ptoggle { display: none; }
    #useRbox #inventory.sf-panel-collapsed { display: block; }
    body.rt21-in-userbox .sf-ptab.side-tab--left { display: none !important; }
    .rt21-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; justify-content: space-between;
      margin: 0 0 14px; padding: 10px 12px; border: 1px dashed #c4b06a; border-radius: 8px; color: #e6d3a3; font-size: 0.9rem; }
    .rt21-bar button { background: #c4b06a; color: #111; border: 0; border-radius: 6px; padding: 7px 12px; font-weight: 700; cursor: pointer; }
    .rt21-bar small { display: block; opacity: 0.75; }
  `;

  function fold(title, open) {
    const d = document.createElement("details");
    d.className = "rb-fold rt21-fold";
    d.open = open;
    const s = document.createElement("summary");
    s.textContent = title;
    const body = document.createElement("div");
    body.className = "rb-fold-body";
    d.append(s, body);
    return { d, body };
  }

  function openUserbox(section) {
    const box = document.getElementById("useRbox");
    if (!box) return;
    box.classList.remove("hidden");
    if (box.classList.contains("collapsed")) {
      const notch = document.getElementById("useRboxNotch");
      if (notch) notch.click();
    }
    const tab = box.querySelector('#rbTabs [data-col="left"]');
    if (tab) tab.click();
    if (section) {
      section.open = true;
      section.scrollIntoView({ block: "start" });
    }
  }

  function summaryText() {
    const mode = document.querySelector(".lucky-btn.active");
    const when = document.querySelector(".sec-btn.active");
    const start = document.getElementById("start");
    const parts = [];
    if (mode) parts.push(mode.textContent.trim());
    if (when) parts.push(when.textContent.trim());
    if (start && start.value) parts.push("from " + start.value);
    return parts.join(" · ");
  }

  function groupSection(body) {
    const status = document.createElement("div");
    status.className = "rb-dev-note";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn";
    btn.style.width = "100%";
    btn.style.marginTop = "6px";
    btn.textContent = "👥 OPEN GROUP TRIP";
    btn.onclick = () => {
      const box = document.getElementById("useRbox");
      if (box) box.classList.add("hidden");
      const mp = document.getElementById("rt-mp");
      if (mp) mp.classList.add("open");
    };
    const paint = () => {
      const room = window.RudMultiplayer && window.RudMultiplayer.room;
      if (room) {
        const n = window.RudMultiplayer.players.length;
        status.textContent = `In room ${room} with ${n} ${n === 1 ? "person" : "people"}.`;
      } else {
        status.textContent = "Not in a group trip. Start one or join with a code.";
      }
    };
    paint();
    window.addEventListener("rt-mp-room", paint);
    window.addEventListener("rt-mp-players", paint);
    body.append(status, btn);
  }

  function adopt(left) {
    const blocks = page.searchBlocks();
    const inv = page.inventory();
    if (!blocks.length && !inv) return;

    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    const title = left.querySelector(".rb-col-title");
    const anchor = title ? title.nextSibling : left.firstChild;

    // 🔎 searches
    let searchFold = null;
    let lastFold = null;
    if (blocks.length) {
      const f = fold("🔎 TRIP SEARCHES", true);
      f.body.classList.add("rt21-search");
      const bar = document.createElement("div");
      bar.className = "rt21-bar";
      const text = document.createElement("div");
      const line = document.createElement("small");
      text.append("🔎 Search settings and 🎒 inventory are in your useRbox (left section).", line);
      const open = document.createElement("button");
      open.type = "button";
      open.textContent = "Open search settings";
      open.onclick = () => openUserbox(f.d);
      bar.append(text, open);
      blocks[0].before(bar);
      blocks.forEach((b) => f.body.appendChild(b));
      const refresh = () => { line.textContent = summaryText(); };
      refresh();
      f.body.addEventListener("click", () => setTimeout(refresh, 0));
      f.body.addEventListener("change", refresh);
      left.insertBefore(f.d, anchor);
      searchFold = f.d;
      lastFold = f.d;
    }

    // 🎒 inventory (make sure it is open: its own hide / show tab is not used in here)
    if (inv) {
      if (window.sfPanels && window.sfPanels.isOpen && !window.sfPanels.isOpen("inventory")) {
        try { window.sfPanels.set("inventory", true, { noSave: true }); } catch (e) { /* ignore */ }
      }
      inv.classList.remove("sf-panel-collapsed");
      document.body.classList.remove("sf-hidden-inventory");
      document.body.classList.add("rt21-in-userbox");
      const f = fold("🎒 INVENTORY", true);
      f.body.appendChild(inv);
      left.insertBefore(f.d, lastFold ? lastFold.nextSibling : anchor);
      lastFold = f.d;
      window.dispatchEvent(new Event("resize"));   // the grid map re-measures now that the column is gone
    }

    // 👥 group trip
    const g = fold("👥 GROUP TRIP", false);
    groupSection(g.body);
    left.insertBefore(g.d, lastFold ? lastFold.nextSibling : anchor);

    window.rt21Userbox = { open: () => openUserbox(searchFold) };
  }

  function waitForLeft() {
    const found = () => document.querySelector("#useRbox .rb-col-left");
    const now = found();
    if (now) { adopt(now); return; }
    const obs = new MutationObserver(() => {
      const el = found();
      if (el) { obs.disconnect(); clearTimeout(timer); adopt(el); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    const timer = setTimeout(() => obs.disconnect(), WAIT_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", waitForLeft);
  else waitForLeft();
})();
