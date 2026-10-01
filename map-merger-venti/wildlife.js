// =====================================================================
//  wildlife.js — iNaturalist Wildlife layer
//  Random wild animals near you. Paw prints, feathers, scales.
//  Free API, no key. Research-grade observations only.
// =====================================================================

let wildlifeData = [];
let wildlifeLastFetch = 0;
let wildlifeLastPos = null;
let wildlifeEnabled = false;
let wildlifeLoading = false;

// Iconic taxa groups with their own colours and icons
const WILDLIFE_TAXA = {
  Mammalia:  { icon: '\u{1F43E}', col: '#b5651d', label: 'mammal' },
  Aves:      { icon: '\u{1F426}', col: '#4a90d9', label: 'bird' },
  Reptilia:  { icon: '\u{1F98E}', col: '#6b8e23', label: 'reptile' },
  Amphibia:  { icon: '\u{1F438}', col: '#2e8b57', label: 'amphibian' },
  Insecta:   { icon: '\u{1F41B}', col: '#daa520', label: 'insect' },
  Arachnida: { icon: '\u{1F577}', col: '#8b0000', label: 'arachnid' },
  Actinopterygii: { icon: '\u{1F41F}', col: '#4682b4', label: 'fish' },
  Mollusca:  { icon: '\u{1F41A}', col: '#bc8f8f', label: 'mollusc' },
};

function getWildlifeStyle(taxon) {
  if (!taxon) return { icon: '\u{1F43E}', col: '#999', label: 'animal' };
  // Walk up ancestry to find iconic group
  const ancestors = taxon.ancestor_ids || [];
  const name = taxon.iconic_taxon_name || '';
  if (WILDLIFE_TAXA[name]) return WILDLIFE_TAXA[name];
  // Fallback
  return { icon: '\u{1F43E}', col: '#999', label: 'animal' };
}

async function fetchWildlife(lat, lng) {
  if (wildlifeLoading) return;
  wildlifeLoading = true;

  const z = getZoom().z;
  const radius = z <= 5 ? 200 : z <= 8 ? 80 : z <= 11 ? 30 : 10;
  const limit = z <= 6 ? 30 : z <= 10 ? 60 : 100;

  const url = 'https://api.inaturalist.org/v1/observations'
    + '?lat=' + lat + '&lng=' + lng
    + '&radius=' + radius
    + '&taxon_id=1'            // Animalia kingdom
    + '&photos=true'
    + '&quality_grade=research'
    + '&per_page=' + limit
    + '&order=desc&order_by=votes';

  try {
    const res = await fetch(url);
    const data = await res.json();
    wildlifeData = (data.results || []).map(obs => {
      const style = getWildlifeStyle(obs.taxon);
      return {
        lat: obs.latitude || (obs.geojson && obs.geojson.coordinates[1]),
        lng: obs.longitude || (obs.geojson && obs.geojson.coordinates[0]),
        name: obs.taxon?.name || 'Unknown',
        common: obs.taxon?.preferred_common_name || obs.taxon?.common_name?.name || '',
        iconic: obs.taxon?.iconic_taxon_name || '',
        photo: obs.observation_photos?.[0]?.photo?.url?.replace('square', 'small') || '',
        date: obs.observed_on || '',
        user: obs.user?.login || 'anon',
        icon: style.icon,
        col: style.col,
        label: style.label
      };
    }).filter(w => w.lat && w.lng);

    wildlifeLastPos = { lat, lng };
    wildlifeLastFetch = Date.now();
  } catch (e) { /* silent */ }
  wildlifeLoading = false;
}

function drawWildlife() {
  if (!wildlifeEnabled || wildlifeData.length === 0) return;
  const z = getZoom().z;
  const t = G.frameN * 0.02;

  wildlifeData.forEach((w, i) => {
    const s = worldToScreen(w.lat, w.lng);
    if (s.x < -20 || s.x > cv.width + 20 || s.y < -30 || s.y > cv.height + 20) return;

    // ── Paw print / animal marker ──
    ctx.shadowColor = w.col;
    ctx.shadowBlur = 5;

    // Coloured circle
    ctx.fillStyle = w.col;
    ctx.beginPath();
    ctx.arc(s.x, s.y - 8, 7, 0, Math.PI * 2);
    ctx.fill();

    // Icon on circle
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000';
    ctx.font = '9px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(w.icon, s.x, s.y - 8);

    // Little tail/pointer
    ctx.fillStyle = w.col;
    ctx.beginPath();
    ctx.moveTo(s.x - 3, s.y - 2);
    ctx.lineTo(s.x, s.y + 3);
    ctx.lineTo(s.x + 3, s.y - 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // ── Name at zoom >= 9 ──
    if (z >= 9) {
      const label = w.common || w.name;
      ctx.fillStyle = w.col;
      ctx.font = "9px 'VT323',monospace";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(label.length > 22 ? label.slice(0, 20) + '..' : label, s.x, s.y + 12);
    }

    // ── Taxa label at zoom >= 11 ──
    if (z >= 11) {
      ctx.fillStyle = w.col + '80';
      ctx.font = "7px 'VT323',monospace";
      ctx.fillText(w.label, s.x, s.y + 20);
    }

    // ── Scientific name at zoom >= 13 ──
    if (z >= 13 && w.common) {
      ctx.fillStyle = '#88888840';
      ctx.font = "italic 7px 'VT323',monospace";
      ctx.fillText(w.name, s.x, s.y + 27);
    }
  });
}

function wildlifeCheck() {
  if (!wildlifeEnabled) return;
  const now = Date.now();
  if (now - wildlifeLastFetch < 120000 && wildlifeLastPos &&
      haversine(G.pos.lat, G.pos.lng, wildlifeLastPos.lat, wildlifeLastPos.lng) < 20) return;
  fetchWildlife(G.pos.lat, G.pos.lng);
}

function toggleWildlife() {
  wildlifeEnabled = !wildlifeEnabled;
  if (wildlifeEnabled) {
    fetchWildlife(G.pos.lat, G.pos.lng);
    showToast('\u{1F43E} Wildlife ON \u2014 iNaturalist sightings', '#b5651d');
  } else {
    showToast('\u{1F43E} Wildlife OFF', '#666');
  }
}
