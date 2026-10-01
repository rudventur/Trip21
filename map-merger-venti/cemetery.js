// =====================================================================
//  cemetery.js -- The Eternal Art Spaces
//  Grey pins, spooky fog, gallows humour. Rest in prints.
// =====================================================================

// ── CEMETERY LISTINGS ──
// Each cemetery seeks a real art type so red-string connections
// form between the living and the dead. :@D

const CEMETERIES = [
  {
    id: 'cem1', lat: 48.861, lng: 2.394, cemetery: true,
    username: 'GhostOfModernArt',
    signature: 'dead but still making art',
    artSpace: { active: true,
      offer: { types: ['\u{1FAA6} Cemetery'], desc: 'P\u00e8re Lachaise \u2014 Eternal open-air sculpture park. Residents include Chopin, Wilde & Jim Morrison. Free entry, no exit.', dateFrom: '1804-05-21', dateTo: '9999-12-31', exchange: ['\u{1FAA6} RIP'] },
      seek:  { types: ['\u{1F3A8} Paint'], desc: 'Seeking someone to touch up my headstone. Getting mossy.', exchange: ['\u{1FAA6} RIP'] }
    }
  },
  {
    id: 'cem2', lat: 51.567, lng: -0.147, cemetery: true,
    username: 'DeadGoodPrints',
    signature: 'six feet of creativity',
    artSpace: { active: true,
      offer: { types: ['\u{1FAA6} Cemetery'], desc: 'Highgate Cemetery \u2014 Victorian gothic vibes. Karl Marx charges no rent. Overgrown in the best way. Come for the art, stay forever.', dateFrom: '1839-01-01', dateTo: '9999-12-31', exchange: ['\u{1FAA6} RIP'] },
      seek:  { types: ['\u{1F33F} Garden'], desc: 'Ivy is taking over. Need a gardener. Urgently. The dead can\u2019t prune.', exchange: ['\u{1FAA6} RIP'] }
    }
  },
  {
    id: 'cem3', lat: 45.447, lng: 12.352, cemetery: true,
    username: 'GondolaGhost',
    signature: 'floating between worlds',
    artSpace: { active: true,
      offer: { types: ['\u{1FAA6} Cemetery'], desc: 'San Michele Island \u2014 Venice\u2019s cemetery island. Arrive by vaporetto, leave by... well. Beautiful mosaics, zero Wi-Fi, ultimate peace & quiet.', dateFrom: '1469-01-01', dateTo: '9999-12-31', exchange: ['\u{1FAA6} RIP'] },
      seek:  { types: ['\u{1FA9A} Wood'], desc: 'Coffins getting creaky. Woodworker needed. Must be comfortable with silence.', exchange: ['\u{1FAA6} RIP'] }
    }
  },
  {
    id: 'cem4', lat: 41.882, lng: 12.465, cemetery: true,
    username: 'CatacomBoss',
    signature: 'underground networking since 300AD',
    artSpace: { active: true,
      offer: { types: ['\u{1FAA6} Cemetery'], desc: 'Catacombs of Rome \u2014 The original underground art scene. 500km of tunnels. Gallery space is... infinite. Literally no one will bother you.', dateFrom: '0200-01-01', dateTo: '9999-12-31', exchange: ['\u{1FAA6} RIP'] },
      seek:  { types: ['\u{1F4BB} Digital'], desc: 'Need help setting up a website. Currently relying on word of mouth (very slow when you\u2019re dead).', exchange: ['\u{1FAA6} RIP'] }
    }
  },
  {
    id: 'cem5', lat: 49.962, lng: 15.288, cemetery: true,
    username: 'BoneChapelBarista',
    signature: 'arranging things beautifully',
    artSpace: { active: true,
      offer: { types: ['\u{1FAA6} Cemetery'], desc: 'Sedlec Ossuary, Kutn\u00e1 Hora \u2014 40,000 skeletons arranged into chandeliers & coat of arms. This IS the art. Interior design goals.', dateFrom: '1400-01-01', dateTo: '9999-12-31', exchange: ['\u{1FAA6} RIP'] },
      seek:  { types: ['\u{1F528} Metal'], desc: 'The bone chandelier needs a new chain. Metalworker who doesn\u2019t scare easily.', exchange: ['\u{1FAA6} RIP'] }
    }
  },
  {
    id: 'cem6', lat: 55.693, lng: 12.570, cemetery: true,
    username: 'AssistentenGravedigger',
    signature: 'digging the arts scene',
    artSpace: { active: true,
      offer: { types: ['\u{1FAA6} Cemetery'], desc: 'Assistens Cemetery, Copenhagen \u2014 Where Hans Christian Andersen & Kierkegaard rest. Locals sunbathe here. Existential picnics encouraged.', dateFrom: '1760-01-01', dateTo: '9999-12-31', exchange: ['\u{1FAA6} RIP'] },
      seek:  { types: ['\u{1F4F7} Darkroom'], desc: 'Looking for a photographer. The light through the trees is unreal. Literally.', exchange: ['\u{1FAA6} RIP'] }
    }
  },
  {
    id: 'cem7', lat: 43.267, lng: -2.937, cemetery: true,
    username: 'EternalSculptor',
    signature: 'the marble never complains',
    artSpace: { active: true,
      offer: { types: ['\u{1FAA6} Cemetery'], desc: 'Cementerio de Vista Alegre, Bilbao \u2014 Neo-gothic stunner on a hilltop. Angel statues that would make Michelangelo nervous. Views that are to die for.', dateFrom: '1902-01-01', dateTo: '9999-12-31', exchange: ['\u{1FAA6} RIP'] },
      seek:  { types: ['\u{1F9F5} Textile'], desc: 'The angel robes are crumbling. Textile artist needed for... stone fabric consulting?', exchange: ['\u{1FAA6} RIP'] }
    }
  },
  {
    id: 'cem8', lat: 47.085, lng: 15.437, cemetery: true,
    username: 'StyrianSpook',
    signature: 'haunting since 1786',
    artSpace: { active: true,
      offer: { types: ['\u{1FAA6} Cemetery'], desc: 'St. Peter\u2019s Cemetery, Graz \u2014 The most charming graveyard in Austria. Wrought iron crosses, flower boxes on every grave. The dead here have better gardens than the living.', dateFrom: '1786-01-01', dateTo: '9999-12-31', exchange: ['\u{1FAA6} RIP'] },
      seek:  { types: ['\u{1F3A8} Paint'], desc: 'The ornamental grave crosses need repainting. Must enjoy working alone (very alone).', exchange: ['\u{1FAA6} RIP'] }
    }
  },
];


// ── CEMETERY RENDERING ──
// Grey pins with tombstone emoji, plus drifting fog particles

let cemeteryFogParticles = [];

function initCemeteryFog() {
  cemeteryFogParticles = [];
  for (let i = 0; i < 40; i++) {
    cemeteryFogParticles.push({
      ox: (Math.random() - 0.5) * 120,  // offset from cemetery center
      oy: (Math.random() - 0.5) * 60,
      r:  8 + Math.random() * 20,
      speed: 0.15 + Math.random() * 0.3,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.04 + Math.random() * 0.08
    });
  }
}
initCemeteryFog();

function drawCemeteryOverlay() {
  if (!G.overlays.pins) return;
  const z = getZoom().z;
  const t = G.frameN * 0.02;

  G.listings.forEach(l => {
    if (!l.cemetery) return;
    const s = worldToScreen(l.lat, l.lng);
    if (s.x < -80 || s.x > cv.width + 80 || s.y < -80 || s.y > cv.height + 80) return;

    // ── Fog wisps around cemetery ──
    if (z >= 6) {
      cemeteryFogParticles.forEach(p => {
        const fx = s.x + p.ox + Math.sin(t * p.speed + p.phase) * 25;
        const fy = s.y + p.oy + Math.cos(t * p.speed * 0.7 + p.phase) * 10;
        const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, p.r);
        grad.addColorStop(0, 'rgba(160,160,170,' + (p.alpha * 0.8) + ')');
        grad.addColorStop(1, 'rgba(160,160,170,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(fx - p.r, fy - p.r, p.r * 2, p.r * 2);
      });
    }

    // ── Grey tombstone pin ──
    ctx.fillStyle = '#8a8a8a';
    ctx.shadowColor = '#8a8a8a';
    ctx.shadowBlur = 10;

    // Tombstone shape (rounded rectangle + base)
    const px = s.x, py = s.y - 14;
    ctx.beginPath();
    ctx.moveTo(px - 7, py + 5);
    ctx.lineTo(px - 7, py - 3);
    ctx.quadraticCurveTo(px - 7, py - 10, px, py - 12);
    ctx.quadraticCurveTo(px + 7, py - 10, px + 7, py - 3);
    ctx.lineTo(px + 7, py + 5);
    ctx.closePath();
    ctx.fill();

    // Inner darker slab
    ctx.fillStyle = '#666';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(px - 5, py + 3);
    ctx.lineTo(px - 5, py - 2);
    ctx.quadraticCurveTo(px - 5, py - 8, px, py - 9);
    ctx.quadraticCurveTo(px + 5, py - 8, px + 5, py - 2);
    ctx.lineTo(px + 5, py + 3);
    ctx.closePath();
    ctx.fill();

    // RIP text on tombstone
    ctx.fillStyle = '#bbb';
    ctx.font = "bold 6px 'VT323',monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RIP', px, py - 3);

    // Tombstone emoji above
    ctx.font = '10px serif';
    ctx.fillText('\u{1FAA6}', px, py - 18);

    ctx.shadowBlur = 0;

    // ── Name label at zoom >= 9 ──
    if (z >= 9) {
      ctx.fillStyle = '#8a8a8a';
      ctx.font = "9px 'VT323',monospace";
      ctx.textAlign = 'center';
      ctx.fillText(l.username || '', s.x, s.y + 8);
    }

    // ── Funny epitaph at zoom >= 12 ──
    if (z >= 12) {
      ctx.fillStyle = 'rgba(138,138,138,0.5)';
      ctx.font = "italic 8px 'VT323',monospace";
      ctx.fillText('"' + (l.signature || '') + '"', s.x, s.y + 18);
    }
  });
}

// ── LOAD CEMETERIES into global listings ──
function loadCemeteries() {
  CEMETERIES.forEach(c => G.listings.push(c));
  document.getElementById('SS').textContent = G.listings.length;
}
