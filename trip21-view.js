// trip21-view.js — full screen from the logo, on every Trip21 page.
//
// The logo (the element marked data-rv-logo) opens the shared RUDVENTUR view menu
// from RudVentur.com/embed/rvView.js, the same script trip-randomiser uses for its
// logo-click full screen. This file adds one quick item to that menu:
//   "Full screen on / off"  toggles full screen straight away.
// On iPhone and iPad Safari, where web pages cannot go full screen, the item
// explains how to add Trip21 to the Home Screen instead: opened from there it
// runs without the browser bars (the manifest asks for "fullscreen").
// If rvView.js could not load, clicking the logo toggles full screen directly.
(function () {
  "use strict";
  var root = document.documentElement;
  var canFullscreen = !!(root.requestFullscreen || root.webkitRequestFullscreen);
  var standalone = (window.matchMedia && matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches) ||
    navigator.standalone === true;

  function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function toggle() {
    if (!canFullscreen) { hint(); return; }
    try {
      if (isFull()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else {
        var r = (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
        if (r && r.catch) r.catch(hint);
      }
    } catch (e) { hint(); }
  }
  function hint() {
    if (standalone) return;
    var msg = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
      ? "Safari on iPhone and iPad cannot make a web page full screen.\n\nFor full screen: tap the Share button (the square with the arrow), then \"Add to Home Screen\". Open Trip21 from the new icon and it fills the whole screen."
      : "This browser did not allow full screen. Try the browser menu, or press F11 on a computer.";
    alert(msg);
  }

  function setup() {
    var label = canFullscreen ? "⛶ Full screen on / off" : (standalone ? "" : "📲 Full screen: add to Home Screen");
    if (window.rvView && window.rvView.addMenuItem) {
      if (label) window.rvView.addMenuItem({ id: "trip21-fullscreen", label: label, title: "Trip21 full screen", onClick: toggle });
      return;
    }
    // rvView.js did not load: the logo toggles full screen by itself
    document.querySelectorAll("[data-rv-logo]").forEach(function (el) {
      el.style.cursor = "pointer";
      el.addEventListener("click", toggle);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup);
  else setup();
  window.trip21View = { toggle: toggle, canFullscreen: canFullscreen };
})();
