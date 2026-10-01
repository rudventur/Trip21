// ═══════════════════════════════════════════════════════════════
//  utils.js — Helper functions + Overpass rate limiter
// ═══════════════════════════════════════════════════════════════

function esc(s) {
  const d = document.createElement('div');
  d.textContent = String(s || '');
  return d.innerHTML;
}

function fmtD(a, b) {
  if (!a && !b) return '';
  const f = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '?';
  return a === b || !b ? f(a) : f(a) + ' \u2192 ' + f(b);
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dl = (lat2 - lat1) * Math.PI / 180;
  const dn = (lon2 - lon1) * Math.PI / 180;
  const x = Math.sin(dl / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dn / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function showToast(msg, color) {
  color = color || '#00ff41';
  document.querySelectorAll('.rud-toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'rud-toast';
  t.innerHTML = msg;
  t.style.cssText = 'border-color:' + color + ';color:' + color + ';box-shadow:0 0 10px ' + color + '44';
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3000);
}

function getPCol(l) {
  if (!l?.artSpace?.active) return PCOLS.swap;
  if (l.cemetery) return PCOLS.rip;
  const a = l.artSpace;
  if (!a.offer?.types?.length && a.seek?.types?.length) return PCOLS.seek;
  const e = a.offer?.exchange || [];
  if (e.some(x => x.includes('RIP'))) return PCOLS.rip;
  if (e.some(x => x.includes('FREE'))) return PCOLS.free;
  if (e.some(x => x.includes('SWAP'))) return PCOLS.swap;
  if (e.some(x => x.includes('DONATION'))) return PCOLS.donation;
  return PCOLS.free;
}

// ── OVERPASS RATE LIMITER ──
// Prevents 429 errors by queuing requests with minimum 3s gap
const _overpassQueue = [];
let _overpassBusy = false;
let _overpassLastCall = 0;
const OVERPASS_MIN_GAP = 3000; // 3 seconds between calls

async function overpassQuery(q) {
  return new Promise((resolve, reject) => {
    _overpassQueue.push({ q, resolve, reject });
    _processOverpassQueue();
  });
}

async function _processOverpassQueue() {
  if (_overpassBusy || _overpassQueue.length === 0) return;
  _overpassBusy = true;

  const now = Date.now();
  const wait = Math.max(0, OVERPASS_MIN_GAP - (now - _overpassLastCall));

  if (wait > 0) {
    await new Promise(r => setTimeout(r, wait));
  }

  const { q, resolve, reject } = _overpassQueue.shift();
  _overpassLastCall = Date.now();

  try {
    const r = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: 'data=' + encodeURIComponent(q),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    if (r.status === 429) {
      // Rate limited — wait longer, retry this request
      console.log('Overpass 429 — backing off 10s');
      _overpassLastCall = Date.now() + 7000; // force 10s total gap
      _overpassQueue.unshift({ q, resolve, reject }); // re-queue at front
    } else if (!r.ok) {
      reject(new Error('Overpass HTTP ' + r.status));
    } else {
      resolve(await r.json());
    }
  } catch (e) {
    reject(e);
  }

  _overpassBusy = false;
  if (_overpassQueue.length > 0) {
    setTimeout(_processOverpassQueue, 100);
  }
}

// Angle between two points (for plane heading)
function angleBetween(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
  return Math.atan2(y, x) * 180 / Math.PI;
}
