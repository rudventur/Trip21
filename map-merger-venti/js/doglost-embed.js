// ═══════════════════════════════════════════════════════════════
//  doglost-embed.js — DogLost Map Integration
//  Tries iframe embed → falls back to graceful link + tile note
//  Additive only
// ═══════════════════════════════════════════════════════════════

(function () {

const DOGLOST_MAP_URL = 'https://www.doglost.co.uk/map';
const DOGLOST_REGISTER = 'https://www.doglost.co.uk/register-lost-dog';

// ── Try embedding DogLost map in a container ──
window.tryDogLostEmbed = function(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  // Attempt iframe
  const iframe = document.createElement('iframe');
  iframe.src = DOGLOST_MAP_URL;
  iframe.style.cssText = 'width:100%;height:200px;border:none;border-radius:8px;background:rgba(0,0,0,0.3)';
  iframe.setAttribute('loading', 'lazy');
  iframe.setAttribute('title', 'DogLost Map');

  // If it loads — great. If blocked by X-Frame-Options → show fallback
  iframe.onload = function() {
    try {
      // Check if content accessible (will throw if cross-origin blocked)
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      if (!doc || !doc.body || doc.body.innerHTML === '') throw new Error('blocked');
    } catch(e) {
      showDogLostFallback(el);
    }
  };
  iframe.onerror = function() { showDogLostFallback(el); };

  el.innerHTML = '';
  el.appendChild(iframe);

  // Timeout fallback — if no load event in 4s, assume blocked
  setTimeout(() => {
    if (el.querySelector('iframe')) showDogLostFallback(el);
  }, 4000);
};

function showDogLostFallback(el) {
  el.innerHTML = `
    <div style="
      background:rgba(0,0,0,0.3);border-radius:8px;padding:10px;
      text-align:center;font-family:'VT323',monospace;
    ">
      <div style="color:rgba(255,100,50,0.7);font-size:.78rem;margin-bottom:6px">
        🐕 DogLost blocks embedding (CORS/X-Frame)<br>
        <span style="color:rgba(255,204,102,0.3);font-size:.65rem">opening in new tab is the safe fallback</span>
      </div>
      <a href="${DOGLOST_MAP_URL}" target="_blank" rel="noopener" style="
        display:inline-block;padding:5px 12px;
        background:rgba(255,100,50,0.1);
        border:1px solid rgba(255,100,50,0.4);
        color:#ff6633;border-radius:7px;
        text-decoration:none;font-size:.75rem;
        font-family:'Bubblegum Sans',cursive;
      ">🗺️ Open DogLost Map ↗</a>
      <a href="${DOGLOST_REGISTER}" target="_blank" rel="noopener" style="
        display:inline-block;margin-top:5px;padding:5px 12px;
        background:rgba(255,50,50,0.1);
        border:1px solid rgba(255,50,50,0.35);
        color:#ff4444;border-radius:7px;
        text-decoration:none;font-size:.75rem;
        font-family:'Bubblegum Sans',cursive;
      ">🔴 Register Lost Dog ↗</a>
    </div>
  `;
}

// ── Auto-init on the placeholder div injected by panel-right ──
function init() {
  setTimeout(() => {
    const el = document.getElementById('rpDoglostEmbed');
    if (el) window.tryDogLostEmbed('rpDoglostEmbed');
  }, 1500); // after panel-right renders
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ── Re-try when vets tab opens ──
// panel-right calls rpRender → rpDoglostEmbed appears → we need to re-init
const _origRpRender = window.rpRefresh;
window.rpRefresh = function() {
  if (typeof _origRpRender === 'function') _origRpRender();
  setTimeout(() => {
    const el = document.getElementById('rpDoglostEmbed');
    if (el && !el.querySelector('iframe') && !el.querySelector('a')) {
      window.tryDogLostEmbed('rpDoglostEmbed');
    }
  }, 100);
};

})();
