// ═══════════════════════════════════════════════════════════════
//  mode-train.js — Train atmosphere: clouds, sunshine, scenic
// ═══════════════════════════════════════════════════════════════

let trainClouds = [];
let trainSunAngle = 0;

// Initialize clouds
function trainInitClouds() {
  trainClouds = [];
  for (let i = 0; i < 12; i++) {
    trainClouds.push({
      x: Math.random() * cv.width * 2 - cv.width * 0.5,
      y: 30 + Math.random() * cv.height * 0.25,
      w: 60 + Math.random() * 120,
      h: 20 + Math.random() * 30,
      spd: 0.1 + Math.random() * 0.3,
      opacity: 0.06 + Math.random() * 0.08
    });
  }
}

function drawTrainAtmosphere() {
  if (G.veh !== 'train') return;

  // Init clouds on first call
  if (trainClouds.length === 0) trainInitClouds();

  // ── Sunshine rays (golden hour vibe) ──
  trainSunAngle = (G.frameN * 0.0003) % (Math.PI * 2);
  const sunX = cv.width * 0.8 + Math.cos(trainSunAngle) * 100;
  const sunY = 60 + Math.sin(trainSunAngle * 0.5) * 30;

  // Sun glow
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, 120);
  sunGrad.addColorStop(0, 'rgba(255,230,100,0.08)');
  sunGrad.addColorStop(0.5, 'rgba(255,200,50,0.03)');
  sunGrad.addColorStop(1, 'rgba(255,200,50,0)');
  ctx.fillStyle = sunGrad;
  ctx.fillRect(0, 0, cv.width, cv.height);

  // Sun rays (god rays through clouds)
  ctx.strokeStyle = 'rgba(255,230,120,0.02)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const angle = trainSunAngle + i * 0.5;
    const rx = sunX + Math.cos(angle) * 300;
    const ry = sunY + Math.sin(angle) * 300;
    ctx.beginPath(); ctx.moveTo(sunX, sunY); ctx.lineTo(rx, ry); ctx.stroke();
  }

  // ── Drifting clouds ──
  trainClouds.forEach(c => {
    // Cloud shadow on ground
    ctx.fillStyle = 'rgba(0,0,0,' + (c.opacity * 0.3) + ')';
    ctx.beginPath();
    ctx.ellipse(c.x + 20, c.y + cv.height * 0.4, c.w * 0.8, c.h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cloud body
    ctx.fillStyle = 'rgba(220,230,245,' + c.opacity + ')';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.w, c.h, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cloud puffs
    ctx.beginPath();
    ctx.ellipse(c.x - c.w * 0.3, c.y + 5, c.w * 0.5, c.h * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(c.x + c.w * 0.3, c.y - 3, c.w * 0.4, c.h * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Drift
    c.x += c.spd;
    if (c.x > cv.width + c.w) { c.x = -c.w; c.y = 30 + Math.random() * cv.height * 0.25; }
  });

  // ── Light rain (occasional) ──
  if (G.frameN % 3000 < 600) {
    const intensity = Math.sin((G.frameN % 3000) / 600 * Math.PI) * 0.5;
    ctx.strokeStyle = 'rgba(150,180,220,' + (intensity * 0.2) + ')';
    ctx.lineWidth = 1;
    for (let i = 0; i < intensity * 30; i++) {
      const rx = (G.frameN * 3 + i * 137) % cv.width;
      const ry = (G.frameN * 5 + i * 89) % cv.height;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + 1, ry + 8); ctx.stroke();
    }
    // Dim slightly
    ctx.fillStyle = 'rgba(100,110,130,' + (intensity * 0.05) + ')';
    ctx.fillRect(0, 0, cv.width, cv.height);
  }

  // ── Scenic passing landscape indicator ──
  const moving = Object.values(G.keys).some(Boolean);
  if (moving) {
    // Subtle parallax tree shadows at edges
    ctx.fillStyle = 'rgba(0,40,0,0.03)';
    for (let i = 0; i < 5; i++) {
      const tx = ((G.frameN * 1.5 + i * 180) % (cv.width + 100)) - 50;
      const ty = cv.height * 0.7 + Math.sin(i * 3) * 40;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + 15, ty - 30 - i * 5);
      ctx.lineTo(tx + 30, ty);
      ctx.closePath();
      ctx.fill();
    }
  }
}
