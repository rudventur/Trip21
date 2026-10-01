// ═══════════════════════════════════════════════════════════════
//  tiles.js — Smooth zoom tile rendering
//  Tiles load at integer Z levels. Fractional zoom scales them
//  on canvas for butter-smooth zooming.
// ═══════════════════════════════════════════════════════════════

const tileCache = {};
const TILE_SIZE = 256;

function lon2tile(lon, z) { return ((lon + 180) / 360) * Math.pow(2, z); }
function lat2tile(lat, z) { return (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z); }
function tile2lon(x, z) { return x / Math.pow(2, z) * 360 - 180; }
function tile2lat(y, z) { const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z); return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); }

function loadTile(x, y, z, urlTemplate) {
  const key = urlTemplate.slice(0, 20) + ':' + z + ':' + x + ':' + y;
  if (tileCache[key]) return tileCache[key];
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = urlTemplate.replace('{z}', z).replace('{x}', x).replace('{y}', y);
  img._loaded = false;
  img._failed = false;
  img.onload = () => { img._loaded = true; };
  img.onerror = () => { img._failed = true; };
  tileCache[key] = img;
  const ks = Object.keys(tileCache);
  if (ks.length > 600) {
    for (let i = 0; i < 120; i++) delete tileCache[ks[i]];
  }
  return img;
}

// ── SMOOTH ZOOM HELPERS ──
// getZoom() returns { z: integerZoom, frac: 0..1, smooth: floatZoom }
// - z is used for tile loading and threshold checks (z >= 9 etc)
// - frac is the fractional part used for scaling tiles between levels
// - smooth is the raw float for worldToScreen precision
function getZoom() {
  const smooth = G.zoom;
  const z = Math.floor(smooth);
  const frac = smooth - z;
  const name = ZOOM_NAMES[z] || 'Z' + z;
  return { z, frac, smooth, name, desc: name };
}

// Draw base map tiles with smooth scaling
function drawTiles() {
  const { z, frac } = getZoom();
  // Scale factor: at frac=0 tiles are 1x, at frac=0.99 they're ~2x (next zoom level)
  const scale = Math.pow(2, frac);
  const scaledTile = TILE_SIZE * scale;

  const cx = lon2tile(G.pos.lng, z), cy = lat2tile(G.pos.lat, z);
  // Need more tiles when zoomed in between levels (tiles are bigger)
  const tw = Math.ceil(cv.width / scaledTile) + 3;
  const th = Math.ceil(cv.height / scaledTile) + 3;
  const sx = Math.floor(cx - tw / 2), sy = Math.floor(cy - th / 2);
  const maxT = Math.pow(2, z);

  for (let dy = 0; dy < th; dy++) {
    for (let dx = 0; dx < tw; dx++) {
      const tx = sx + dx, ty = sy + dy;
      if (ty < 0 || ty >= maxT) continue;
      const wtx = ((tx % maxT) + maxT) % maxT;
      // Position: offset from center, scaled
      const px = cv.width / 2 + (tx - cx) * scaledTile;
      const py = cv.height / 2 + (ty - cy) * scaledTile;

      const tile = loadTile(wtx, ty, z, TILE_URLS[G.curTileLayer]);
      if (tile._loaded) {
        ctx.drawImage(tile, Math.floor(px), Math.floor(py), Math.ceil(scaledTile) + 1, Math.ceil(scaledTile) + 1);
      } else if (!tile._failed) {
        ctx.fillStyle = (G.curTileLayer === 'dark' || G.curTileLayer === 'darkclean') ? '#1a1a2e' : '#eee';
        ctx.fillRect(Math.floor(px), Math.floor(py), Math.ceil(scaledTile), Math.ceil(scaledTile));
      }
    }
  }
}

// Rail tile overlay (disabled by default)
let railTilesEnabled = false;
let railTilesFailed = 0;

function drawRailTileOverlay() {
  if (!railTilesEnabled) return;
  if (G.veh !== 'train' || !G.overlays.transit) return;
  if (railTilesFailed > 3) return;
  const { z, frac } = getZoom();
  if (z < 5) return;

  const scale = Math.pow(2, frac);
  const scaledTile = TILE_SIZE * scale;
  const cx = lon2tile(G.pos.lng, z), cy = lat2tile(G.pos.lat, z);
  const tw = Math.ceil(cv.width / scaledTile) + 3;
  const th = Math.ceil(cv.height / scaledTile) + 3;
  const sx = Math.floor(cx - tw / 2), sy = Math.floor(cy - th / 2);
  const maxT = Math.pow(2, z);

  for (let dy = 0; dy < th; dy++) {
    for (let dx = 0; dx < tw; dx++) {
      const tx = sx + dx, ty = sy + dy;
      if (ty < 0 || ty >= maxT) continue;
      const wtx = ((tx % maxT) + maxT) % maxT;
      const px = cv.width / 2 + (tx - cx) * scaledTile;
      const py = cv.height / 2 + (ty - cy) * scaledTile;

      const tile = loadTile(wtx, ty, z, RAIL_TILE_URL);
      if (tile._loaded) {
        ctx.globalAlpha = 0.85;
        ctx.drawImage(tile, Math.floor(px), Math.floor(py), Math.ceil(scaledTile) + 1, Math.ceil(scaledTile) + 1);
        ctx.globalAlpha = 1.0;
      }
      if (tile._failed) railTilesFailed++;
    }
  }
}

// ── COORDINATE TRANSFORMS (smooth zoom aware) ──
function worldToScreen(lat, lng) {
  const { z, frac } = getZoom();
  const scale = Math.pow(2, frac);
  const scaledTile = TILE_SIZE * scale;
  const cx = lon2tile(G.pos.lng, z);
  const cy = lat2tile(G.pos.lat, z);
  return {
    x: cv.width / 2 + (lon2tile(lng, z) - cx) * scaledTile,
    y: cv.height / 2 + (lat2tile(lat, z) - cy) * scaledTile
  };
}

function screenToWorld(sx, sy) {
  const { z, frac } = getZoom();
  const scale = Math.pow(2, frac);
  const scaledTile = TILE_SIZE * scale;
  const cx = lon2tile(G.pos.lng, z);
  const cy = lat2tile(G.pos.lat, z);
  return {
    lat: tile2lat(cy + (sy - cv.height / 2) / scaledTile, z),
    lng: tile2lon(cx + (sx - cv.width / 2) / scaledTile, z)
  };
}
