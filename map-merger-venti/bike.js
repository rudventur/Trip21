// ═══════════════════════════════════════════════════════════════
//  bike.js — Bike variants, sprites, selector
// ═══════════════════════════════════════════════════════════════

const BIKE_VARIANTS = [
  { id: 'road',     name: 'Road Bike',     spd: 0.00014, kmh: '22 km/h',  color: '#ff6600', desc: 'Fast on pavement' },
  { id: 'mountain', name: 'Mountain Bike', spd: 0.00011, kmh: '18 km/h',  color: '#88cc44', desc: 'Offroad tough' },
  { id: 'trike',    name: 'Trike',         spd: 0.00009, kmh: '15 km/h',  color: '#cc44ff', desc: 'Stable 3-wheeler' },
  { id: 'ebike',    name: 'E-Bike',        spd: 0.00018, kmh: '28 km/h',  color: '#00bfff', desc: 'Electric assist' },
];
let curBike = BIKE_VARIANTS[0];

function drawBikeSprite() {
  const px = cv.width / 2, py = cv.height / 2;
  const moving = Object.values(G.keys).some(Boolean);
  const bob = moving ? Math.sin(G.frameN * 0.18) * 2 : 0;
  const step = moving ? Math.sin(G.frameN * 0.22) * 4 : 0;
  const wheelSpin = G.frameN * 0.3;

  // Wheels
  ctx.strokeStyle = curBike.color;
  ctx.lineWidth = 2;
  const wr = curBike.id === 'trike' ? 5 : 6;
  ctx.beginPath(); ctx.arc(px - 11, py + bob + 14, wr, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(px + 11, py + bob + 14, wr, 0, Math.PI * 2); ctx.stroke();

  // Spokes (animated)
  [px - 11, px + 11].forEach(wx => {
    ctx.strokeStyle = curBike.color + '55';
    ctx.lineWidth = 1;
    for (let a = 0; a < 3; a++) {
      const angle = wheelSpin + a * Math.PI * 2 / 3;
      ctx.beginPath();
      ctx.moveTo(wx, py + bob + 14);
      ctx.lineTo(wx + Math.cos(angle) * wr, py + bob + 14 + Math.sin(angle) * wr);
      ctx.stroke();
    }
  });

  // Trike: third wheel
  if (curBike.id === 'trike') {
    ctx.strokeStyle = curBike.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px, py + bob + 22, 5, 0, Math.PI * 2); ctx.stroke();
    // Rear axle
    ctx.strokeStyle = curBike.color + '88'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px - 11, py + bob + 14); ctx.lineTo(px, py + bob + 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px + 11, py + bob + 14); ctx.lineTo(px, py + bob + 22); ctx.stroke();
  }

  // Frame
  ctx.strokeStyle = curBike.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px - 11, py + bob + 14);
  ctx.lineTo(px, py + bob + 4);
  ctx.lineTo(px + 11, py + bob + 14);
  ctx.stroke();

  // Handlebars
  ctx.beginPath();
  ctx.moveTo(px - 5, py + bob + 2);
  ctx.lineTo(px + 5, py + bob + 2);
  ctx.stroke();

  // E-bike battery indicator
  if (curBike.id === 'ebike') {
    ctx.fillStyle = '#00bfff';
    ctx.shadowColor = '#00bfff'; ctx.shadowBlur = 4;
    ctx.fillRect(px - 2, py + bob + 6, 4, 6);
    ctx.shadowBlur = 0;
  }

  // Rider
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(px, py + 12, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1a22';
  ctx.fillRect(px - 5, py + bob + 2, 4, 8 + step);
  ctx.fillRect(px + 1, py + bob + 2, 4, 8 - step);
  ctx.fillStyle = '#ffe600';
  ctx.fillRect(px - 6, py + bob - 9, 12, 11);
  ctx.fillStyle = '#ffcc88';
  ctx.fillRect(px - 4, py + bob - 17, 8, 8);

  // Eyes
  ctx.fillStyle = '#000';
  if (G.dir === 'down') { ctx.fillRect(px - 2, py + bob - 14, 2, 2); ctx.fillRect(px + 1, py + bob - 14, 2, 2); }
  if (G.dir === 'up') { ctx.fillRect(px - 2, py + bob - 11, 2, 2); ctx.fillRect(px + 1, py + bob - 11, 2, 2); }
  if (G.dir === 'left') ctx.fillRect(px - 3, py + bob - 13, 2, 2);
  if (G.dir === 'right') ctx.fillRect(px + 2, py + bob - 13, 2, 2);

  // Glow outline
  ctx.strokeStyle = curBike.color + '44';
  ctx.lineWidth = 1;
  ctx.shadowColor = curBike.color; ctx.shadowBlur = 5;
  ctx.strokeRect(px - 6, py + bob - 17, 12, 26);
  ctx.shadowBlur = 0;

  // Bike name
  ctx.font = "7px 'Press Start 2P'";
  ctx.fillStyle = curBike.color;
  ctx.textAlign = 'center';
  ctx.fillText(curBike.name, px, py + bob - 22);
}

// ── SELECTOR ──
function openBikeSelector() {
  let html = '<button class="mcl" onclick="closeModal()">\u2715</button>';
  html += '<div class="mh">\u{1F6B2} SELECT BIKE</div>';
  BIKE_VARIANTS.forEach(b => {
    const isCur = curBike.id === b.id;
    html += '<div style="padding:8px;margin:4px 0;border:2px solid ' + (isCur ? b.color : 'rgba(0,255,65,0.15)') +
      ';border-radius:4px;cursor:pointer;background:' + (isCur ? 'rgba(255,255,255,0.05)' : 'transparent') +
      '" onclick="selectBike(\'' + b.id + '\')">';
    html += '<div style="font-family:\'Press Start 2P\',monospace;font-size:.3rem;color:' + b.color + '">' + b.name + '</div>';
    html += '<div style="font-family:VT323,monospace;font-size:.9rem;color:rgba(0,255,65,0.6)">' + b.desc + ' \u00B7 ' + b.kmh + '</div>';
    html += '</div>';
  });
  document.getElementById('MB').innerHTML = html;
  document.getElementById('MO').classList.add('open');
}

function selectBike(id) {
  curBike = BIKE_VARIANTS.find(b => b.id === id) || BIKE_VARIANTS[0];
  closeModal();
  document.getElementById('SPD').innerHTML = '\u{1F6B2}<br>' + curBike.kmh;
  showToast('\u{1F6B2} ' + curBike.name + ' \u2014 ' + curBike.desc, curBike.color);
}
