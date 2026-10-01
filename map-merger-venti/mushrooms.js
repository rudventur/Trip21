// =====================================================================
//  mushrooms.js — iNaturalist Fungi layer
//  Spore-shaped pins, earthy colours, real mushroom sightings.
//  Free API, no key. Research-grade observations only.
// =====================================================================

let mushroomData = [];        // { lat, lng, name, common, photo, date, user }
let mushroomLastFetch = 0;
let mushroomLastPos = null;
let mushroomEnabled = false;
let mushroomLoading = false;

const MUSHROOM_COLOURS = [
  '#c97b2a',  // earthy orange
  '#8b5e3c',  // brown
  '#a0522d',  // sienna
  '#d4a03c',  // golden chanterelle
  '#7a4420',  // dark cap
  '#cc6633',  // russet
];

function mushroomCol(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return MUSHROOM_COLOURS[Math.abs(h) % MUSHROOM_COLOURS.length];
}

async function fetchMushrooms(lat, lng) {
  if (mushroomLoading) return;
  mushroomLoading = true;

  // Radius based on zoom — wider at low zoom, tighter at high zoom
  const z = getZoom().z;
  const radius = z <= 5 ? 200 : z <= 8 ? 80 : z <= 11 ? 30 : 10;
  const limit = z <= 6 ? 30 : z <= 10 ? 60 : 100;

  const url = 'https://api.inaturalist.org/v1/observations'
    + '?lat=' + lat + '&lng=' + lng
    + '&radius=' + radius
    + '&taxon_id=47170'       // Fungi kingdom
    + '&photos=true'
    + '&quality_grade=research'
    + '&per_page=' + limit
    + '&order=desc&order_by=votes';

  try {
    const res = await fetch(url);
    const data = await res.json();
    mushroomData = (data.results || []).map(obs => ({
      lat: obs.latitude || (obs.geojson && obs.geojson.coordinates[1]),
      lng: obs.longitude || (obs.geojson && obs.geojson.coordinates[0]),
      name: obs.taxon?.name || 'Unknown',
      common: obs.taxon?.preferred_common_name || obs.taxon?.common_name?.name || '',
      photo: obs.observation_photos?.[0]?.photo?.url?.replace('square', 'small') || '',
      date: obs.observed_on || '',
      user: obs.user?.login || 'anon'
    })).filter(m => m.lat && m.lng);

    mushroomLastPos = { lat, lng };
    mushroomLastFetch = Date.now();
  } catch (e) { /* silent */ }
  mushroomLoading = false;
}

function drawMushrooms() {
  if (!mushroomEnabled || mushroomData.length === 0) return;
  const z = getZoom().z;
  const t = G.frameN * 0.03;

  mushroomData.forEach((m, i) => {
    const s = worldToScreen(m.lat, m.lng);
    if (s.x < -20 || s.x > cv.width + 20 || s.y < -30 || s.y > cv.height + 20) return;

    const col = mushroomCol(m.name);

    // ── Spore cloud (subtle glow) ──
    if (z >= 8) {
      const grad = ctx.createRadialGradient(s.x, s.y - 8, 0, s.x, s.y - 8, 18);
      grad.addColorStop(0, col + '30');
      grad.addColorStop(1, col + '00');
      ctx.fillStyle = grad;
      ctx.fillRect(s.x - 18, s.y - 26, 36, 36);
    }

    // ── Mushroom cap shape ──
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 6;

    // Cap (half ellipse)
    ctx.beginPath();
    ctx.ellipse(s.x, s.y - 12, 8, 6, 0, Math.PI, 0);
    ctx.fill();

    // Stem
    ctx.fillStyle = '#d4c9a8';
    ctx.shadowBlur = 0;
    ctx.fillRect(s.x - 2, s.y - 12, 4, 8);

    // Tiny dot pattern on cap
    ctx.fillStyle = '#ffffff40';
    const dots = Math.abs((m.name.charCodeAt(0) || 0) % 4) + 1;
    for (let d = 0; d < dots; d++) {
      const dx = (d - dots / 2) * 3.5;
      ctx.beginPath();
      ctx.arc(s.x + dx, s.y - 14, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;

    // ── Species label at zoom >= 10 ──
    if (z >= 10) {
      const label = m.common || m.name;
      ctx.fillStyle = col;
      ctx.font = "9px 'VT323',monospace";
      ctx.textAlign = 'center';
      ctx.fillText(label.length > 22 ? label.slice(0, 20) + '..' : label, s.x, s.y + 6);
    }

    // ── Scientific name at zoom >= 13 ──
    if (z >= 13 && m.common) {
      ctx.fillStyle = '#88776640';
      ctx.font = "italic 7px 'VT323',monospace";
      ctx.fillText(m.name, s.x, s.y + 14);
    }
  });
}

function mushroomCheck() {
  if (!mushroomEnabled) return;
  const now = Date.now();
  // Refresh every 2 min or 20km movement
  if (now - mushroomLastFetch < 120000 && mushroomLastPos &&
      haversine(G.pos.lat, G.pos.lng, mushroomLastPos.lat, mushroomLastPos.lng) < 20) return;
  fetchMushrooms(G.pos.lat, G.pos.lng);
}

function toggleMushrooms() {
  mushroomEnabled = !mushroomEnabled;
  if (mushroomEnabled) {
    fetchMushrooms(G.pos.lat, G.pos.lng);
    showToast('\u{1F344} Mushrooms ON \u2014 iNaturalist research-grade', '#c97b2a');
  } else {
    showToast('\u{1F344} Mushrooms OFF', '#666');
  }
}
