// ═══════════════════════════════════════════════════════════════
//  weather.js — Real weather overlay via Open-Meteo (free, no key)
//  Rain particles, cloud shadows, temperature display
// ═══════════════════════════════════════════════════════════════

let weatherData = null;
let lastWeatherPos = null;
let weatherParticles = [];
let weatherLoading = false;

// Weather codes: 0=clear, 1-3=cloudy, 45-48=fog, 51-57=drizzle,
// 61-67=rain, 71-77=snow, 80-82=showers, 85-86=snow showers, 95-99=thunderstorm
const WEATHER_NAMES = {
  0: 'Clear', 1: 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime Fog',
  51: 'Light Drizzle', 53: 'Drizzle', 55: 'Heavy Drizzle',
  61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
  71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow',
  77: 'Snow Grains', 80: 'Light Showers', 81: 'Showers', 82: 'Heavy Showers',
  85: 'Light Snow Showers', 86: 'Snow Showers',
  95: 'Thunderstorm', 96: 'Hail Storm', 99: 'Heavy Hail'
};

async function fetchWeather(lat, lng) {
  if (weatherLoading) return;
  weatherLoading = true;
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat.toFixed(4) +
      '&longitude=' + lng.toFixed(4) +
      '&current=weather_code,temperature_2m,apparent_temperature,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,visibility,relative_humidity_2m,pressure_msl,uv_index' +
      '&forecast_days=1';
    const res = await fetch(url);
    weatherData = await res.json();
    lastWeatherPos = { lat, lng };
  } catch (e) {
    console.log('Weather fetch error:', e);
  }
  weatherLoading = false;
}

function drawWeather() {
  if (!G.overlays.weather || !weatherData || !weatherData.current) return;

  const cur = weatherData.current;
  const wc = cur.weather_code || 0;
  const prec = cur.precipitation || 0;
  const cloud = cur.cloud_cover || 0;
  const temp = cur.temperature_2m;
  const wind = cur.wind_speed_10m || 0;
  const isSnow = wc >= 71 && wc <= 77 || wc >= 85 && wc <= 86;
  const isRain = wc >= 51 && wc <= 67 || wc >= 80 && wc <= 82;
  const isStorm = wc >= 95;

  // ── Cloud overlay ──
  if (cloud > 20) {
    ctx.globalAlpha = (cloud / 100) * 0.25;
    ctx.fillStyle = '#556';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.globalAlpha = 1;
  }

  // ── Fog ──
  if (wc >= 45 && wc <= 48) {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#aab';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.globalAlpha = 1;
  }

  // ── Rain particles ──
  if (isRain || isStorm) {
    const intensity = isStorm ? 4 : prec > 5 ? 3 : prec > 1 ? 2 : 1;
    const maxP = intensity * 120;
    while (weatherParticles.length < maxP) {
      weatherParticles.push({
        x: Math.random() * cv.width,
        y: Math.random() * cv.height,
        len: 6 + Math.random() * 10 * intensity,
        spd: 3 + intensity * 2 + Math.random() * 3,
        drift: (wind * 0.1) + Math.random() * 0.5
      });
    }
    // Trim if too many
    if (weatherParticles.length > maxP) weatherParticles.length = maxP;

    ctx.strokeStyle = 'rgba(120, 180, 255, 0.5)';
    ctx.lineWidth = 1.2;
    weatherParticles.forEach(p => {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.drift * 2, p.y + p.len);
      ctx.stroke();
      p.y += p.spd;
      p.x += p.drift;
      if (p.y > cv.height + p.len) { p.y = -p.len; p.x = Math.random() * cv.width; }
      if (p.x > cv.width + 10) p.x = -10;
    });
  }

  // ── Snow particles ──
  if (isSnow) {
    const maxP = 200;
    while (weatherParticles.length < maxP) {
      weatherParticles.push({
        x: Math.random() * cv.width,
        y: Math.random() * cv.height,
        size: 1.5 + Math.random() * 3,
        spd: 0.5 + Math.random() * 1.5,
        drift: Math.sin(Math.random() * Math.PI * 2) * 0.5,
        wobble: Math.random() * Math.PI * 2
      });
    }
    if (weatherParticles.length > maxP) weatherParticles.length = maxP;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    weatherParticles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x + Math.sin(p.wobble + G.frameN * 0.02) * 2, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      p.y += p.spd;
      p.x += p.drift;
      if (p.y > cv.height + 5) { p.y = -5; p.x = Math.random() * cv.width; }
    });
  }

  // ── Visibility reduction ──
  const vis = cur.visibility;
  if (vis && vis < 5000) {
    const fogAlpha = Math.min(0.2, (1 - vis / 5000) * 0.2);
    ctx.globalAlpha = fogAlpha;
    ctx.fillStyle = '#99a';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.globalAlpha = 1;
  }

  // ── Lightning flash (thunderstorm) ──
  if (isStorm && G.frameN % 300 < 3 && Math.random() < 0.3) {
    ctx.globalAlpha = 0.15 + Math.random() * 0.1;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.globalAlpha = 1;
  }

  // Clear particles if weather changed to clear
  if (!isRain && !isSnow && !isStorm && weatherParticles.length > 0) {
    weatherParticles = [];
  }

  // ── Weather HUD (bottom-left info) ──
  const name = WEATHER_NAMES[wc] || ('Code ' + wc);
  const tempStr = temp !== undefined ? Math.round(temp) + '\u00B0C' : '?';
  const visStr = vis ? (vis >= 10000 ? '' : ' \u{1F441} ' + (vis >= 1000 ? (vis/1000).toFixed(1) + 'km' : vis + 'm')) : '';
  const windDir = cur.wind_direction_10m;
  const dirStr = windDir !== undefined ? ' ' + Math.round(windDir) + '\u00B0' : '';
  const feelsLike = cur.apparent_temperature;
  const humidity = cur.relative_humidity_2m;
  const pressure = cur.pressure_msl;
  const uvIndex = cur.uv_index;
  const gusts = cur.wind_gusts_10m;

  const hudW = 260;
  const hudH = 32;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(6, cv.height - 56, hudW, hudH);
  ctx.strokeStyle = 'rgba(0,191,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(6, cv.height - 56, hudW, hudH);
  ctx.fillStyle = 'rgba(0,191,255,0.6)';
  ctx.font = "10px 'VT323',monospace";
  ctx.textAlign = 'left';
  // Line 1: condition, temp, wind
  ctx.fillText('\u{1F326} ' + name + ' ' + tempStr + (feelsLike !== undefined ? ' (feels ' + Math.round(feelsLike) + '\u00B0)' : '') + ' \u{1F32C} ' + Math.round(wind) + 'km/h' + dirStr, 10, cv.height - 44);
  // Line 2: humidity, pressure, UV, visibility, gusts
  ctx.fillStyle = 'rgba(0,191,255,0.35)';
  ctx.font = "9px 'VT323',monospace";
  const extras = [];
  if (humidity !== undefined) extras.push('\u{1F4A7}' + humidity + '%');
  if (pressure !== undefined) extras.push(Math.round(pressure) + 'hPa');
  if (uvIndex !== undefined && uvIndex > 0) extras.push('UV ' + uvIndex);
  if (gusts !== undefined && gusts > wind * 1.3) extras.push('Gusts ' + Math.round(gusts));
  if (visStr) extras.push(visStr.trim());
  ctx.fillText(extras.join(' \u00B7 '), 10, cv.height - 32);
}

// Check if weather needs refreshing (every 10 min or 50km movement)
function weatherCheck() {
  if (!G.overlays.weather) return;
  if (!lastWeatherPos || haversine(G.pos.lat, G.pos.lng, lastWeatherPos.lat, lastWeatherPos.lng) > 50) {
    fetchWeather(G.pos.lat, G.pos.lng);
  }
}

// ═══════════════════════════════════════════════════════════════
//  RAINVIEWER — Real-time precipitation radar overlay tiles
//  Free API, no key needed. Global coverage, 10-min updates.
// ═══════════════════════════════════════════════════════════════

let rainRadarPath = null;    // e.g. "/v2/radar/1609401600"
let rainRadarHost = null;    // e.g. "https://tilecache.rainviewer.com"
let rainRadarLastFetch = 0;
let rainRadarTiles = {};     // cache: "z/x/y" → { img, loaded }
let rainRadarEnabled = false;

async function fetchRainRadarMeta() {
  try {
    const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
    const data = await res.json();
    rainRadarHost = data.host || 'https://tilecache.rainviewer.com';
    const past = data.radar?.past;
    if (past && past.length > 0) {
      const latest = past[past.length - 1];
      if (latest.path !== rainRadarPath) {
        rainRadarPath = latest.path;
        rainRadarTiles = {}; // clear cache on new timestamp
      }
    }
    rainRadarLastFetch = Date.now();
  } catch (e) { /* silent */ }
}

function getRainRadarTile(z, x, y) {
  // RainViewer supports zoom 1-7
  const rz = Math.min(7, Math.max(1, z));
  const key = rz + '/' + x + '/' + y;
  if (rainRadarTiles[key]) return rainRadarTiles[key];

  // Load tile
  const img = new Image();
  img.crossOrigin = 'anonymous';
  const tile = { img, loaded: false, error: false };
  img.onload = function() { tile.loaded = true; };
  img.onerror = function() { tile.error = true; };
  // Color scheme 2 (universal blue-green-yellow-red), smooth=1, snow=1
  img.src = rainRadarHost + rainRadarPath + '/256/' + rz + '/' + x + '/' + y + '/2/1_1.png';
  rainRadarTiles[key] = tile;

  // Limit cache size
  const keys = Object.keys(rainRadarTiles);
  if (keys.length > 100) {
    keys.slice(0, 30).forEach(k => delete rainRadarTiles[k]);
  }
  return tile;
}

// Convert lat/lng to slippy tile coords at given zoom
function latLngToTile(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
}

// Convert tile coords back to lat/lng (top-left corner)
function tileToBounds(x, y, zoom) {
  const n = Math.pow(2, zoom);
  const lng1 = x / n * 360 - 180;
  const lng2 = (x + 1) / n * 360 - 180;
  const lat1Rad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
  const lat2Rad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n)));
  return { lat1: lat1Rad * 180 / Math.PI, lng1, lat2: lat2Rad * 180 / Math.PI, lng2 };
}

function drawRainRadar() {
  if (!rainRadarEnabled || !rainRadarPath || !G.overlays.weather) return;

  // Determine which tiles cover the screen
  const rz = Math.min(7, Math.max(1, Math.floor(getZoom().z * 0.6))); // radar zoom lower than map zoom
  const corners = [
    screenToWorld(0, 0),
    screenToWorld(cv.width, 0),
    screenToWorld(0, cv.height),
    screenToWorld(cv.width, cv.height)
  ];
  const latMin = Math.min(corners[0].lat, corners[1].lat, corners[2].lat, corners[3].lat);
  const latMax = Math.max(corners[0].lat, corners[1].lat, corners[2].lat, corners[3].lat);
  const lngMin = Math.min(corners[0].lng, corners[1].lng, corners[2].lng, corners[3].lng);
  const lngMax = Math.max(corners[0].lng, corners[1].lng, corners[2].lng, corners[3].lng);

  const tl = latLngToTile(latMax, lngMin, rz);
  const br = latLngToTile(latMin, lngMax, rz);

  ctx.globalAlpha = 0.45; // semi-transparent radar overlay

  for (let tx = tl.x; tx <= br.x; tx++) {
    for (let ty = tl.y; ty <= br.y; ty++) {
      const tile = getRainRadarTile(rz, tx, ty);
      if (!tile.loaded || tile.error) continue;

      const bounds = tileToBounds(tx, ty, rz);
      const s1 = worldToScreen(bounds.lat1, bounds.lng1);
      const s2 = worldToScreen(bounds.lat2, bounds.lng2);
      const w = s2.x - s1.x;
      const h = s2.y - s1.y;
      if (w > 1 && h > 1) {
        try { ctx.drawImage(tile.img, s1.x, s1.y, w, h); } catch (e) {}
      }
    }
  }

  ctx.globalAlpha = 1;
}

// Refresh radar metadata periodically (every 5 min)
function rainRadarCheck() {
  if (!rainRadarEnabled || !G.overlays.weather) return;
  if (Date.now() - rainRadarLastFetch > 300000) {
    fetchRainRadarMeta();
  }
}

function toggleRainRadar() {
  rainRadarEnabled = !rainRadarEnabled;
  if (rainRadarEnabled) {
    fetchRainRadarMeta();
    showToast('\u{1F327} Radar ON \u2014 real-time precipitation', '#00bfff');
  } else {
    showToast('\u{1F327} Radar OFF', '#666');
  }
}

// ═══════════════════════════════════════════════════════════════
//  STANDALONE WEATHER TOGGLES
//  Lightning + clouds work outside plane mode when toggled here.
// ═══════════════════════════════════════════════════════════════

// ── Lightning (Blitzortung) standalone toggle ──
let blitzEnabled = false;
function toggleBlitzortung() {
  blitzEnabled = !blitzEnabled;
  if (blitzEnabled) {
    if (typeof connectBlitzortung === 'function') connectBlitzortung();
    showToast('\u26A1 Lightning ON \u2014 real-time strikes', '#ffe600');
  } else {
    if (typeof blitzWs !== 'undefined' && blitzWs) {
      try { blitzWs.close(); } catch(e) {}
    }
    showToast('\u26A1 Lightning OFF', '#666');
  }
}

// ── Cloud layers standalone toggle ──
let cloudLayersEnabled = false;
function toggleCloudLayers() {
  cloudLayersEnabled = !cloudLayersEnabled;
  if (cloudLayersEnabled) {
    if (!G.overlays.weather) { G.overlays.weather = true; fetchWeather(G.pos.lat, G.pos.lng); }
    showToast('\u2601 Clouds ON \u2014 3-layer real cloud cover', '#aabbcc');
  } else {
    showToast('\u2601 Clouds OFF', '#666');
  }
}

// ── Draw standalone cloud overlay (when not in plane mode) ──
function drawCloudOverlay() {
  if (!cloudLayersEnabled || G.veh === 'plane') return; // plane has its own
  if (!weatherData?.current) return;
  const cc = weatherData.current.cloud_cover || 0;
  if (cc < 10) return;
  const t = G.frameN * 0.008;
  const alpha = (cc / 100) * 0.08;

  // Drifting cloud shadows across the map
  for (let i = 0; i < 8; i++) {
    const cx = (cv.width * 0.5) + Math.sin(t + i * 1.7) * cv.width * 0.6;
    const cy = (cv.height * 0.4) + Math.cos(t * 0.7 + i * 2.3) * cv.height * 0.4;
    const r = 60 + (i % 3) * 40;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(180,190,200,' + alpha + ')');
    grad.addColorStop(1, 'rgba(180,190,200,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
}

// ── Draw standalone lightning strikes (when not in plane mode) ──
function drawLightningOverlay() {
  if (!blitzEnabled || G.veh === 'plane') return; // plane has its own
  if (typeof realLightningStrikes === 'undefined' || realLightningStrikes.length === 0) return;
  const now = Date.now();
  realLightningStrikes.forEach(s => {
    const age = now - s.time;
    if (age > 60000) return; // max 1 min
    const lat = s.lat, lng = s.lon || s.lng;
    const scr = worldToScreen(lat, lng);
    if (scr.x < -20 || scr.x > cv.width + 20 || scr.y < -20 || scr.y > cv.height + 20) return;
    const fade = Math.max(0, 1 - age / 60000);
    // Flash
    if (age < 200) {
      ctx.globalAlpha = 0.4 * (1 - age / 200);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(scr.x, scr.y, 15, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Strike dot
    ctx.fillStyle = 'rgba(255,255,100,' + (fade * 0.8) + ')';
    ctx.beginPath(); ctx.arc(scr.x, scr.y, 3 * fade + 1, 0, Math.PI * 2); ctx.fill();
    // Bolt icon
    if (fade > 0.3) {
      ctx.fillStyle = 'rgba(255,230,0,' + fade * 0.6 + ')';
      ctx.font = '10px serif'; ctx.textAlign = 'center';
      ctx.fillText('\u26A1', scr.x, scr.y - 8);
    }
  });
}

// ── Wind direction indicator ──
let windOverlayEnabled = false;
function toggleWindOverlay() {
  windOverlayEnabled = !windOverlayEnabled;
  showToast(windOverlayEnabled ? '\u{1F32C} Wind arrows ON' : '\u{1F32C} Wind arrows OFF', windOverlayEnabled ? '#66ccff' : '#666');
}

function drawWindOverlay() {
  if (!windOverlayEnabled || !weatherData?.current) return;
  const windDir = weatherData.current.wind_direction_10m;
  const windSpd = weatherData.current.wind_speed_10m;
  if (windDir === undefined || windSpd === undefined || windSpd < 1) return;

  const rad = (windDir - 90) * Math.PI / 180; // -90 because 0° = from north
  const spacing = 80;

  ctx.strokeStyle = 'rgba(100,200,255,0.12)';
  ctx.lineWidth = 1;

  for (let x = 20; x < cv.width; x += spacing) {
    for (let y = 70; y < cv.height - 70; y += spacing) {
      const jx = x + Math.sin(y * 0.01 + G.frameN * 0.02) * 8;
      const jy = y + Math.cos(x * 0.01 + G.frameN * 0.015) * 8;
      const len = 10 + (windSpd / 40) * 15;
      const ex = jx + Math.cos(rad) * len;
      const ey = jy + Math.sin(rad) * len;
      ctx.beginPath(); ctx.moveTo(jx, jy); ctx.lineTo(ex, ey); ctx.stroke();
      // Arrowhead
      const a1 = rad + 2.5, a2 = rad - 2.5;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - Math.cos(a1) * 4, ey - Math.sin(a1) * 4);
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - Math.cos(a2) * 4, ey - Math.sin(a2) * 4);
      ctx.stroke();
    }
  }
}

// ── Temperature colour overlay ──
let tempOverlayEnabled = false;
function toggleTempOverlay() {
  tempOverlayEnabled = !tempOverlayEnabled;
  showToast(tempOverlayEnabled ? '\u{1F321} Temp overlay ON' : '\u{1F321} Temp overlay OFF', tempOverlayEnabled ? '#ff6644' : '#666');
}

function drawTempOverlay() {
  if (!tempOverlayEnabled || !weatherData?.current) return;
  const temp = weatherData.current.temperature_2m;
  if (temp === undefined) return;
  // Colour the whole screen with a faint tint based on temperature
  let col;
  if (temp <= -10)     col = '80,120,255';    // deep cold blue
  else if (temp <= 0)  col = '100,180,255';    // cold blue
  else if (temp <= 10) col = '100,220,200';    // cool teal
  else if (temp <= 20) col = '200,220,100';    // mild green-yellow
  else if (temp <= 30) col = '255,180,50';     // warm orange
  else                 col = '255,80,30';      // hot red

  ctx.fillStyle = 'rgba(' + col + ',0.04)';
  ctx.fillRect(0, 0, cv.width, cv.height);
}

// ── Humidity / fog overlay ──
let humidityOverlayEnabled = false;
function toggleHumidityOverlay() {
  humidityOverlayEnabled = !humidityOverlayEnabled;
  showToast(humidityOverlayEnabled ? '\u{1F4A7} Humidity ON' : '\u{1F4A7} Humidity OFF', humidityOverlayEnabled ? '#6699cc' : '#666');
}

function drawHumidityOverlay() {
  if (!humidityOverlayEnabled || !weatherData?.current) return;
  const hum = weatherData.current.relative_humidity_2m;
  if (!hum || hum < 60) return;
  // High humidity = subtle fog effect
  const alpha = ((hum - 60) / 40) * 0.06;
  ctx.fillStyle = 'rgba(180,200,210,' + alpha + ')';
  ctx.fillRect(0, 0, cv.width, cv.height);
}
