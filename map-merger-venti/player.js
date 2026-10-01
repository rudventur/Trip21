// ═══════════════════════════════════════════════════════════════
//  player.js — Vehicle sprite router + remaining inline sprites
//  Calls: drawBoatSprite() from boat.js, drawBikeSprite() from bike.js
//  Contains: walk, scooter, car, bus, train, plane, ufo inline
// ═══════════════════════════════════════════════════════════════

function drawPlayer() {
  if (G.veh === 'boat')  { drawBoatSprite(); return; }
  if (G.veh === 'bike')  { drawBikeSprite(); return; }
  if (G.veh === 'plane') { drawPlaneSprite(); return; }
  if (G.veh === 'car')   { drawCarSprite(); return; }

  const px = cv.width / 2, py = cv.height / 2;
  const moving = Object.values(G.keys).some(Boolean);
  const bob = moving ? Math.sin(G.frameN * 0.18) * 2 : 0;

  // ── UFO ──
  if (G.veh === 'ufo') {
    ctx.fillStyle = '#cc44ff'; ctx.beginPath(); ctx.ellipse(px, py + bob, 22, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(200,100,255,0.35)'; ctx.beginPath(); ctx.ellipse(px, py + bob - 8, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff44ff'; ctx.lineWidth = 2; ctx.shadowColor = '#ff44ff'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.ellipse(px, py + bob, 22, 9, 0, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
    if (moving) { ctx.fillStyle = 'rgba(255,200,50,0.12)'; ctx.beginPath(); ctx.moveTo(px-9,py+bob+9); ctx.lineTo(px+9,py+bob+9); ctx.lineTo(px+17,py+bob+38); ctx.lineTo(px-17,py+bob+38); ctx.closePath(); ctx.fill(); }
    return;
  }

  // ── TRAIN ──
  if (G.veh === 'train') {
    if (moving) { ctx.strokeStyle='rgba(255,102,0,0.15)';ctx.lineWidth=1;for(let i=-30;i<=30;i+=10){const o=(G.frameN*2+i)%60-30;ctx.beginPath();ctx.moveTo(px-18,py+bob+o);ctx.lineTo(px+18,py+bob+o);ctx.stroke()}ctx.strokeStyle='rgba(255,102,0,0.25)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px-10,py-30);ctx.lineTo(px-10,py+30);ctx.stroke();ctx.beginPath();ctx.moveTo(px+10,py-30);ctx.lineTo(px+10,py+30);ctx.stroke(); }
    ctx.fillStyle='#cc4400';ctx.beginPath();ctx.moveTo(px-16,py+bob-8);ctx.lineTo(px-12,py+bob-12);ctx.lineTo(px+12,py+bob-12);ctx.lineTo(px+16,py+bob-8);ctx.lineTo(px+16,py+bob+12);ctx.lineTo(px-16,py+bob+12);ctx.closePath();ctx.fill();
    ctx.fillStyle='#ffcc00';ctx.fillRect(px-11,py+bob-7,8,7);ctx.fillRect(px+3,py+bob-7,8,7);
    ctx.fillStyle='#ffe600';ctx.shadowColor='#ffe600';ctx.shadowBlur=8;ctx.beginPath();ctx.arc(px,py+bob-13,3,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#333';ctx.beginPath();ctx.arc(px-9,py+bob+14,5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(px+9,py+bob+14,5,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#ff6600';ctx.lineWidth=2;ctx.shadowColor='#ff6600';ctx.shadowBlur=9;ctx.strokeRect(px-16,py+bob-12,32,24);ctx.shadowBlur=0;
    if(moving){for(let i=0;i<3;i++){const age=(G.frameN*0.05+i*0.3)%1,sx=px+Math.sin(G.frameN*0.1+i)*4,sy=py+bob-16-age*25;ctx.fillStyle='rgba(180,180,180,'+(0.3-age*0.3)+')';ctx.beginPath();ctx.arc(sx,sy,3+age*6,0,Math.PI*2);ctx.fill()}}
    return;
  }

  // ── CAR is handled by drawCarSprite() in car.js ──

  // ── BUS ──
  if (G.veh === 'bus') {
    ctx.fillStyle='#ff4400';ctx.fillRect(px-21,py+bob-13,42,24);ctx.fillStyle='#cc3300';ctx.fillRect(px-21,py+bob+2,42,3);
    ctx.fillStyle='rgba(150,220,255,0.55)';for(let i=-13;i<16;i+=10)ctx.fillRect(px+i,py+bob-9,7,9);
    ctx.fillStyle='rgba(255,255,255,0.2)';ctx.fillRect(px+15,py+bob-9,5,18);
    ctx.fillStyle='#ffe600';ctx.font="6px 'Press Start 2P'";ctx.textAlign='center';ctx.fillText('42',px-14,py+bob-4);
    ctx.fillStyle='#222';ctx.beginPath();ctx.arc(px-12,py+bob+13,5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(px+12,py+bob+13,5,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#ff6622';ctx.lineWidth=2;ctx.shadowColor='#ff4400';ctx.shadowBlur=8;ctx.strokeRect(px-21,py+bob-13,42,24);ctx.shadowBlur=0;return;
  }

  // ── SCOOTER ──
  if (G.veh === 'scooter') {
    const step = moving ? Math.sin(G.frameN * 0.22) * 4 : 0;
    ctx.fillStyle='rgba(0,0,0,0.35)';ctx.beginPath();ctx.ellipse(px,py+12,7,3,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#1a1a22';ctx.fillRect(px-5,py+bob+2,4,8+step);ctx.fillRect(px+1,py+bob+2,4,8-step);
    ctx.strokeStyle='#ff6600';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(px-11,py+bob+14,6,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.arc(px+11,py+bob+14,6,0,Math.PI*2);ctx.stroke();
    // Scooter deck
    ctx.fillStyle='#ff6600';ctx.fillRect(px-10,py+bob+8,20,3);
    // Handlebar
    ctx.strokeStyle='#ff6600';ctx.beginPath();ctx.moveTo(px+9,py+bob+8);ctx.lineTo(px+9,py+bob-2);ctx.moveTo(px+4,py+bob-2);ctx.lineTo(px+14,py+bob-2);ctx.stroke();
    ctx.fillStyle='#ffe600';ctx.fillRect(px-6,py+bob-9,12,11);
    ctx.fillStyle='#ffcc88';ctx.fillRect(px-4,py+bob-17,8,8);
    ctx.fillStyle='#000';
    if(G.dir==='down'){ctx.fillRect(px-2,py+bob-14,2,2);ctx.fillRect(px+1,py+bob-14,2,2)}
    if(G.dir==='up'){ctx.fillRect(px-2,py+bob-11,2,2);ctx.fillRect(px+1,py+bob-11,2,2)}
    if(G.dir==='left')ctx.fillRect(px-3,py+bob-13,2,2);
    if(G.dir==='right')ctx.fillRect(px+2,py+bob-13,2,2);
    ctx.strokeStyle='#00ff41';ctx.lineWidth=1;ctx.shadowColor='#00ff41';ctx.shadowBlur=7;ctx.strokeRect(px-6,py+bob-17,12,26);ctx.shadowBlur=0;
    return;
  }

  // ── WALK (default) ──
  const step = moving ? Math.sin(G.frameN * 0.22) * 4 : 0;
  ctx.fillStyle='rgba(0,0,0,0.35)';ctx.beginPath();ctx.ellipse(px,py+12,7,3,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#1a1a22';ctx.fillRect(px-5,py+bob+2,4,8+step);ctx.fillRect(px+1,py+bob+2,4,8-step);
  ctx.fillStyle='#ffe600';ctx.fillRect(px-6,py+bob-9,12,11);
  ctx.fillStyle='#ffcc88';ctx.fillRect(px-4,py+bob-17,8,8);
  ctx.fillStyle='#000';
  if(G.dir==='down'){ctx.fillRect(px-2,py+bob-14,2,2);ctx.fillRect(px+1,py+bob-14,2,2)}
  if(G.dir==='up'){ctx.fillRect(px-2,py+bob-11,2,2);ctx.fillRect(px+1,py+bob-11,2,2)}
  if(G.dir==='left')ctx.fillRect(px-3,py+bob-13,2,2);
  if(G.dir==='right')ctx.fillRect(px+2,py+bob-13,2,2);
  ctx.strokeStyle='#00ff41';ctx.lineWidth=1;ctx.shadowColor='#00ff41';ctx.shadowBlur=7;ctx.strokeRect(px-6,py+bob-17,12,26);ctx.shadowBlur=0;
}
