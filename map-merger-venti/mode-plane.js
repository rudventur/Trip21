// ═══════════════════════════════════════════════════════════════
//  mode-plane.js — COMPLETE AIRPLANE MODE
//  Plane NEVER stops when airborne. Left/Right only for turning.
//  Hardcoded major airports (no Overpass dependency).
//  Aircraft fleet · Airports · Flights · Physics · Weather · Sprite
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  SECTION 1: AIRCRAFT FLEET
// ═══════════════════════════════════════════════════════════════

const PLANE_FLEET = [
  // ── COMMERCIAL (must board at airport) ──
  { id:'cessna172', name:'Cessna 172',    cat:'civil',      kmh:230,   mach:0.19,  spd:0.0013,
    alt:14000,  turnRate:4.0,  color:'#88cc44', desc:'Light single-prop trainer',
    minRunway:'small', wingSpan:11, fuseLen:8, tailColor:'#44aa22' },
  { id:'a320',      name:'Airbus A320',   cat:'commercial', kmh:840,   mach:0.78,  spd:0.0048,
    alt:39000,  turnRate:1.5,  color:'#44aaff', desc:'Short-haul workhorse',
    minRunway:'medium', wingSpan:34, fuseLen:37, tailColor:'#0044cc' },
  { id:'b737',      name:'Boeing 737',    cat:'commercial', kmh:838,   mach:0.78,  spd:0.0048,
    alt:41000,  turnRate:1.5,  color:'#00bfff', desc:'Most-produced jet ever',
    minRunway:'medium', wingSpan:35, fuseLen:39, tailColor:'#0066aa' },
  { id:'b747',      name:'Boeing 747',    cat:'commercial', kmh:920,   mach:0.85,  spd:0.0052,
    alt:45000,  turnRate:1.0,  color:'#4488ff', desc:'Queen of the Skies',
    minRunway:'large', wingSpan:64, fuseLen:70, tailColor:'#0033aa' },
  { id:'a380',      name:'Airbus A380',   cat:'commercial', kmh:903,   mach:0.84,  spd:0.0051,
    alt:43000,  turnRate:0.8,  color:'#6644ff', desc:'Double-deck superjumbo',
    minRunway:'large', wingSpan:80, fuseLen:73, tailColor:'#4422cc' },

  // ── MILITARY / SPECIAL (take off anywhere) ──
  { id:'f16',       name:'F-16 Falcon',   cat:'fighter',    kmh:2414,  mach:2.0,   spd:0.014,
    alt:50000,  turnRate:8.0,  color:'#ff2244', desc:'Agile multirole fighter',
    minRunway:'any', wingSpan:10, fuseLen:15, tailColor:'#cc0022' },
  { id:'f22',       name:'F-22 Raptor',   cat:'fighter',    kmh:2414,  mach:2.25,  spd:0.015,
    alt:65000,  turnRate:7.5,  color:'#ff4466', desc:'5th gen stealth supremacy',
    minRunway:'any', wingSpan:13, fuseLen:19, tailColor:'#aa0033' },
  { id:'su57',      name:'Su-57 Felon',   cat:'fighter',    kmh:2600,  mach:2.0,   spd:0.015,
    alt:65000,  turnRate:7.0,  color:'#ff8844', desc:'Russian stealth fighter',
    minRunway:'any', wingSpan:14, fuseLen:20, tailColor:'#cc4400' },
  { id:'concorde',  name:'Concorde',      cat:'civil',      kmh:2180,  mach:2.04,  spd:0.012,
    alt:60000,  turnRate:2.0,  color:'#ff6600', desc:'Supersonic legend',
    minRunway:'large', wingSpan:26, fuseLen:62, tailColor:'#cc4400' },
  { id:'sr71',      name:'SR-71 Blackbird', cat:'recon',    kmh:3540,  mach:3.3,   spd:0.020,
    alt:85000,  turnRate:1.5,  color:'#222',    desc:'Untouchable spy plane',
    minRunway:'any', wingSpan:17, fuseLen:32, tailColor:'#111' },
  { id:'b2',        name:'B-2 Spirit',    cat:'bomber',     kmh:1010,  mach:0.95,  spd:0.0058,
    alt:50000,  turnRate:1.2,  color:'#555',    desc:'Stealth flying wing',
    minRunway:'large', wingSpan:52, fuseLen:21, tailColor:'#333' },
  { id:'b12',       name:'B-12 Stratofortress X', cat:'bomber', kmh:14700, mach:12.0, spd:0.085,
    alt:200000, turnRate:0.5,  color:'#ff0044', desc:'Experimental hypersonic bomber',
    minRunway:'any', wingSpan:40, fuseLen:50, tailColor:'#aa0022' },
  { id:'x15',       name:'X-15 Rocket',   cat:'experimental', kmh:7274, mach:6.7,  spd:0.042,
    alt:354000, turnRate:1.0,  color:'#ff4400', desc:'Edge of space',
    minRunway:'any', wingSpan:7, fuseLen:15, tailColor:'#cc2200' },
];

// ═══════════════════════════════════════════════════════════════
//  SECTION 2: STATE
// ═══════════════════════════════════════════════════════════════

let airports = [];
let flights = [];
let showFlights = false;
let flightInt = null;
let planeAirborne = false;
let nearAirport = null;
let planeHeading = 0;       // degrees, 0=north
let planeTargetHeading = 0;
let prevPos = null;
let planeAltitude = 0;
let targetAltitude = 0;
let planeSpeed = 0;
let curAircraft = PLANE_FLEET[1]; // default A320

// Altitude control
let planeAltitudePresets = [1000, 5000, 10000, 20000, 35000]; // updated per aircraft
let planeLandingMode = false; // approach mode — slow descent, reduced speed

// Atmosphere state
let planeLightning = 0;
let planeLightningPos = null;
let planeRainDrops = [];
let planeWindParticles = [];
let planeTurbulence = 0;
let planeWeather = null;
let planeWeatherPos = null;
let realLightningStrikes = [];
let lightningLastFetch = 0;

// ═══════════════════════════════════════════════════════════════
//  BLITZORTUNG REAL-TIME LIGHTNING (WebSocket)
//  Connects to Blitzortung network for live strike data
//  Sound delay based on distance / speed of sound (343 m/s)
// ═══════════════════════════════════════════════════════════════

let blitzWs = null;
let blitzConnected = false;
let blitzRetries = 0;
const BLITZ_MAX_RETRIES = 1;
let thunderSoundsQueued = [];

// Audio context for thunder
let thunderAudioCtx = null;

function getThunderAudioCtx() {
  if (!thunderAudioCtx) {
    try { thunderAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ }
  }
  return thunderAudioCtx;
}

function playThunderSound(distKm) {
  const audioCtx = getThunderAudioCtx();
  if (!audioCtx) return;
  // Volume drops with distance, character changes (close = sharp crack, far = low rumble)
  const vol = Math.max(0.02, Math.min(0.5, 1.0 / (1 + distKm * 0.05)));
  const baseFreq = distKm < 5 ? 120 : distKm < 20 ? 80 : 50; // closer = higher crack
  const duration = distKm < 5 ? 0.8 : distKm < 20 ? 1.5 : 2.5; // far = longer rumble

  try {
    // Create thunder-like sound: filtered noise burst + low rumble
    const now = audioCtx.currentTime;

    // Noise burst (crack)
    const bufSize = Math.floor(audioCtx.sampleRate * duration);
    const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      const t = i / audioCtx.sampleRate;
      const env = Math.exp(-t * (distKm < 5 ? 3 : 1.5)) * (0.5 + 0.5 * Math.random());
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buf;

    // Low-pass filter (far thunder = more muffled)
    const filt = audioCtx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = baseFreq + (distKm < 10 ? 200 : 50);

    const gain = audioCtx.createGain();
    gain.gain.value = vol;

    src.connect(filt); filt.connect(gain); gain.connect(audioCtx.destination);
    src.start(now);
    src.stop(now + duration + 0.5);
  } catch (e) { /* audio error, silent */ }
}

function connectBlitzortung() {
  if (blitzWs && blitzWs.readyState <= 1) return; // already open/connecting
  if (blitzRetries >= BLITZ_MAX_RETRIES) return;

  try {
    // Blitzortung public WebSocket for real-time strike data (port 3000)
    const servers = ['ws1', 'ws5', 'ws6', 'ws7'];
    const srv = servers[Math.floor(Math.random() * servers.length)];
    blitzWs = new WebSocket('wss://' + srv + '.blitzortung.org:3000');

    blitzWs.onopen = function() {
      blitzConnected = true;
      blitzRetries = 0;
      // Request strikes in a wide area around current position
      const bounds = {
        west: Math.floor(G.pos.lng - 15),
        east: Math.ceil(G.pos.lng + 15),
        south: Math.floor(G.pos.lat - 10),
        north: Math.ceil(G.pos.lat + 10)
      };
      blitzWs.send(JSON.stringify(bounds));
      showToast('\u26A1 Lightning data connected', '#ffe600');
    };

    blitzWs.onmessage = function(ev) {
      try {
        const d = JSON.parse(ev.data);
        if (d.lat !== undefined && d.lon !== undefined) {
          const strikeTime = d.time ? d.time / 1000000 : Date.now(); // Blitzortung sends nanoseconds
          const strike = { lat: d.lat, lon: d.lon, time: Date.now(), realTime: strikeTime, sig: d.sig || 0 };
          realLightningStrikes.push(strike);

          // Calculate sound delay: distance in km / 0.343 km/s = delay in seconds
          const distKm = haversine(G.pos.lat, G.pos.lng, d.lat, d.lon);
          if (distKm < 100) {
            const delaySec = distKm / 0.343; // speed of sound ≈ 343 m/s
            const delayMs = Math.min(delaySec * 1000, 30000); // cap at 30s
            thunderSoundsQueued.push({ time: Date.now() + delayMs, distKm });
          }

          // Limit stored strikes
          if (realLightningStrikes.length > 200) {
            realLightningStrikes = realLightningStrikes.slice(-100);
          }
        }
      } catch (e) { /* parse error */ }
    };

    blitzWs.onclose = function() {
      blitzConnected = false;
      blitzRetries++;
      // Retry after delay
      if (blitzRetries < BLITZ_MAX_RETRIES) {
        setTimeout(connectBlitzortung, 5000 * blitzRetries);
      }
    };

    blitzWs.onerror = function() {
      blitzConnected = false;
    };
  } catch (e) {
    blitzConnected = false;
    blitzRetries++;
  }
}

function disconnectBlitzortung() {
  if (blitzWs) { try { blitzWs.close(); } catch (e) {} blitzWs = null; }
  blitzConnected = false;
}

function updateBlitzortungBounds() {
  if (!blitzWs || blitzWs.readyState !== 1) return;
  const bounds = {
    west: Math.floor(G.pos.lng - 15),
    east: Math.ceil(G.pos.lng + 15),
    south: Math.floor(G.pos.lat - 10),
    north: Math.ceil(G.pos.lat + 10)
  };
  try { blitzWs.send(JSON.stringify(bounds)); } catch (e) {}
}

// Process queued thunder sounds (delayed by distance / speed of sound)
function processThunderSounds() {
  const now = Date.now();
  thunderSoundsQueued = thunderSoundsQueued.filter(t => {
    if (now >= t.time) { playThunderSound(t.distKm); return false; }
    return t.time - now < 60000; // discard if > 60s away
  });
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 3: HARDCODED MAJOR AIRPORTS
//  ~5 per country. Instant load, no Overpass needed.
// ═══════════════════════════════════════════════════════════════

const WORLD_AIRPORTS = [
  // UK
  { lat:51.4700, lon:-0.4543, name:'Heathrow', iata:'LHR', icao:'EGLL', size:'large' },
  { lat:51.1537, lon:-0.1821, name:'Gatwick', iata:'LGW', icao:'EGKK', size:'large' },
  { lat:51.8860, lon:0.2389, name:'Stansted', iata:'STN', icao:'EGSS', size:'medium' },
  { lat:53.3537, lon:-2.2750, name:'Manchester', iata:'MAN', icao:'EGCC', size:'large' },
  { lat:55.9500, lon:-3.3725, name:'Edinburgh', iata:'EDI', icao:'EGPH', size:'medium' },
  { lat:51.4894, lon:-3.3433, name:'Cardiff', iata:'CWL', icao:'EGFF', size:'medium' },
  { lat:52.4539, lon:-1.7480, name:'Birmingham', iata:'BHX', icao:'EGBB', size:'medium' },

  // Germany
  { lat:50.0379, lon:8.5622, name:'Frankfurt', iata:'FRA', icao:'EDDF', size:'large' },
  { lat:48.3538, lon:11.7861, name:'Munich', iata:'MUC', icao:'EDDM', size:'large' },
  { lat:52.5597, lon:13.2877, name:'Berlin Brandenburg', iata:'BER', icao:'EDDB', size:'large' },
  { lat:53.6304, lon:9.9882, name:'Hamburg', iata:'HAM', icao:'EDDH', size:'medium' },
  { lat:50.8659, lon:7.1427, name:'Cologne Bonn', iata:'CGN', icao:'EDDK', size:'medium' },

  // France
  { lat:49.0097, lon:2.5479, name:'Charles de Gaulle', iata:'CDG', icao:'LFPG', size:'large' },
  { lat:48.7233, lon:2.3794, name:'Orly', iata:'ORY', icao:'LFPO', size:'large' },
  { lat:43.6293, lon:1.3638, name:'Toulouse', iata:'TLS', icao:'LFBO', size:'medium' },
  { lat:43.4366, lon:5.2148, name:'Marseille', iata:'MRS', icao:'LFML', size:'medium' },
  { lat:43.6584, lon:7.2159, name:'Nice', iata:'NCE', icao:'LFMN', size:'medium' },

  // Italy
  { lat:41.8003, lon:12.2389, name:'Rome Fiumicino', iata:'FCO', icao:'LIRF', size:'large' },
  { lat:45.6306, lon:8.7231, name:'Milan Malpensa', iata:'MXP', icao:'LIMC', size:'large' },
  { lat:45.5053, lon:12.3519, name:'Venice', iata:'VCE', icao:'LIPZ', size:'medium' },
  { lat:40.8847, lon:14.2908, name:'Naples', iata:'NAP', icao:'LIRN', size:'medium' },

  // Spain
  { lat:40.4936, lon:-3.5668, name:'Madrid Barajas', iata:'MAD', icao:'LEMD', size:'large' },
  { lat:41.2971, lon:2.0785, name:'Barcelona', iata:'BCN', icao:'LEBL', size:'large' },
  { lat:37.4181, lon:-5.8932, name:'Seville', iata:'SVQ', icao:'LEZL', size:'medium' },
  { lat:36.6749, lon:-4.4991, name:'Malaga', iata:'AGP', icao:'LEMG', size:'medium' },

  // Netherlands
  { lat:52.3086, lon:4.7639, name:'Schiphol', iata:'AMS', icao:'EHAM', size:'large' },
  { lat:51.4491, lon:5.3743, name:'Eindhoven', iata:'EIN', icao:'EHEH', size:'medium' },

  // Belgium
  { lat:50.9014, lon:4.4844, name:'Brussels', iata:'BRU', icao:'EBBR', size:'large' },

  // Switzerland
  { lat:47.4647, lon:8.5492, name:'Zurich', iata:'ZRH', icao:'LSZH', size:'large' },
  { lat:46.2370, lon:6.1089, name:'Geneva', iata:'GVA', icao:'LSGG', size:'medium' },

  // Austria
  { lat:48.1103, lon:16.5697, name:'Vienna', iata:'VIE', icao:'LOWW', size:'large' },

  // Poland
  { lat:52.1657, lon:20.9671, name:'Warsaw Chopin', iata:'WAW', icao:'EPWA', size:'large' },
  { lat:50.0777, lon:19.7848, name:'Krakow', iata:'KRK', icao:'EPKK', size:'medium' },

  // Czech Republic
  { lat:50.1008, lon:14.2600, name:'Prague', iata:'PRG', icao:'LKPR', size:'large' },

  // Sweden
  { lat:59.6519, lon:17.9186, name:'Stockholm Arlanda', iata:'ARN', icao:'ESSA', size:'large' },
  { lat:57.6628, lon:12.2798, name:'Gothenburg', iata:'GOT', icao:'ESGG', size:'medium' },

  // Norway
  { lat:60.1939, lon:11.1004, name:'Oslo Gardermoen', iata:'OSL', icao:'ENGM', size:'large' },
  { lat:60.2934, lon:5.2181, name:'Bergen Flesland', iata:'BGO', icao:'ENBR', size:'medium' },

  // Finland
  { lat:60.3172, lon:24.9633, name:'Helsinki Vantaa', iata:'HEL', icao:'EFHK', size:'large' },

  // Portugal
  { lat:38.7813, lon:-9.1359, name:'Lisbon', iata:'LIS', icao:'LPPT', size:'large' },
  { lat:41.2481, lon:-8.6814, name:'Porto', iata:'OPO', icao:'LPPR', size:'medium' },

  // Ireland
  { lat:53.4264, lon:-6.2499, name:'Dublin', iata:'DUB', icao:'EIDW', size:'large' },
  { lat:52.7019, lon:-8.9248, name:'Shannon', iata:'SNN', icao:'EINN', size:'medium' },

  // Greece
  { lat:37.9364, lon:23.9445, name:'Athens', iata:'ATH', icao:'LGAV', size:'large' },
  { lat:35.5317, lon:24.1497, name:'Chania', iata:'CHQ', icao:'LGSA', size:'medium' },

  // Romania
  { lat:44.5711, lon:26.0850, name:'Bucharest Otopeni', iata:'OTP', icao:'LROP', size:'large' },

  // Hungary
  { lat:47.4369, lon:19.2556, name:'Budapest', iata:'BUD', icao:'LHBP', size:'large' },

  // Slovakia
  { lat:48.1702, lon:17.2127, name:'Bratislava', iata:'BTS', icao:'LZIB', size:'medium' },

  // Japan
  { lat:35.7647, lon:140.3864, name:'Tokyo Narita', iata:'NRT', icao:'RJAA', size:'large' },
  { lat:35.5494, lon:139.7798, name:'Tokyo Haneda', iata:'HND', icao:'RJTT', size:'large' },
  { lat:34.4347, lon:135.2441, name:'Osaka Kansai', iata:'KIX', icao:'RJBB', size:'large' },
  { lat:33.5902, lon:130.4017, name:'Fukuoka', iata:'FUK', icao:'RJFF', size:'medium' },

  // United States
  { lat:40.6413, lon:-73.7781, name:'New York JFK', iata:'JFK', icao:'KJFK', size:'large' },
  { lat:33.9425, lon:-118.4081, name:'Los Angeles', iata:'LAX', icao:'KLAX', size:'large' },
  { lat:41.9742, lon:-87.9073, name:'Chicago O\'Hare', iata:'ORD', icao:'KORD', size:'large' },
  { lat:33.6407, lon:-84.4277, name:'Atlanta', iata:'ATL', icao:'KATL', size:'large' },
  { lat:37.6213, lon:-122.3790, name:'San Francisco', iata:'SFO', icao:'KSFO', size:'large' },
  { lat:25.7959, lon:-80.2870, name:'Miami', iata:'MIA', icao:'KMIA', size:'large' },
  { lat:47.4502, lon:-122.3088, name:'Seattle', iata:'SEA', icao:'KSEA', size:'large' },

  // India
  { lat:28.5562, lon:77.1000, name:'Delhi', iata:'DEL', icao:'VIDP', size:'large' },
  { lat:19.0896, lon:72.8656, name:'Mumbai', iata:'BOM', icao:'VABB', size:'large' },
  { lat:13.1979, lon:77.7063, name:'Bangalore', iata:'BLR', icao:'VOBL', size:'large' },

  // Australia
  { lat:-33.9461, lon:151.1772, name:'Sydney', iata:'SYD', icao:'YSSY', size:'large' },
  { lat:-37.6733, lon:144.8433, name:'Melbourne', iata:'MEL', icao:'YMML', size:'large' },
  { lat:-27.3842, lon:153.1175, name:'Brisbane', iata:'BNE', icao:'YBBN', size:'large' },
  { lat:-31.9403, lon:115.9672, name:'Perth', iata:'PER', icao:'YPPH', size:'large' },
];

// Load airports = just copy the hardcoded list (instant, no network)
function flyLoadAirports() {
  airports = WORLD_AIRPORTS.map(a => ({ ...a }));
  showToast('\u2708 ' + airports.length + ' airports loaded!', '#00bfff');
}

// No progressive reload needed for hardcoded data
function airportCheckReload() { /* noop — all airports always loaded */ }

// ═══════════════════════════════════════════════════════════════
//  SECTION 3b: AIRCRAFT SELECTOR
// ═══════════════════════════════════════════════════════════════

function openAircraftSelector() {
  let html = '<button class="mcl" onclick="closeModal()">\u2715</button>';
  html += '<div class="mh">\u2708 SELECT AIRCRAFT</div>';

  const cats = { commercial:'COMMERCIAL (board at airport)', civil:'CIVIL AVIATION', fighter:'FIGHTER JETS', bomber:'BOMBERS', recon:'RECONNAISSANCE', experimental:'EXPERIMENTAL' };
  const grouped = {};
  PLANE_FLEET.forEach(ac => {
    if (!grouped[ac.cat]) grouped[ac.cat] = [];
    grouped[ac.cat].push(ac);
  });

  Object.keys(cats).forEach(cat => {
    if (!grouped[cat]) return;
    html += '<div style="font-family:\'Press Start 2P\',monospace;font-size:.2rem;color:rgba(0,255,65,0.4);margin:10px 0 4px;text-transform:uppercase">' + cats[cat] + '</div>';
    grouped[cat].forEach(ac => {
      const isCur = curAircraft.id === ac.id;
      const machStr = ac.mach >= 1 ? ' \u00B7 Mach ' + ac.mach : '';
      html += '<div style="padding:6px 8px;margin:3px 0;border:2px solid ' + (isCur ? ac.color : 'rgba(0,255,65,0.12)') +
        ';border-radius:4px;cursor:pointer;background:' + (isCur ? 'rgba(255,255,255,0.04)' : 'transparent') +
        '" onclick="selectAircraft(\'' + ac.id + '\')">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center">';
      html += '<span style="font-family:\'Press Start 2P\',monospace;font-size:.26rem;color:' + ac.color + '">' + ac.name + '</span>';
      html += '<span style="font-family:VT323,monospace;font-size:.85rem;color:rgba(0,191,255,0.5)">' + ac.kmh + ' km/h' + machStr + '</span>';
      html += '</div>';
      html += '<div style="font-family:VT323,monospace;font-size:.82rem;color:rgba(0,255,65,0.5);margin-top:2px">' + ac.desc;
      html += ' \u00B7 Alt ' + (ac.alt > 100000 ? Math.round(ac.alt/1000) + 'k' : ac.alt.toLocaleString()) + 'ft';
      html += ' \u00B7 Turn ' + ac.turnRate + '\u00B0/f';
      if (ac.cat === 'commercial') html += ' \u00B7 <span style="color:#ffe600">BOARD AT AIRPORT</span>';
      html += '</div></div>';
    });
  });

  document.getElementById('MB').innerHTML = html;
  document.getElementById('MO').classList.add('open');
}

function selectAircraft(id) {
  const ac = PLANE_FLEET.find(a => a.id === id);
  if (!ac) return;

  if (ac.cat === 'commercial' && planeAirborne && curAircraft.cat !== 'commercial') {
    showToast('Land first \u2014 commercial needs airport boarding!', '#ff4444');
    return;
  }

  curAircraft = ac;
  targetAltitude = ac.alt;
  closeModal();
  document.getElementById('SPD').innerHTML = '\u2708<br>' + ac.kmh + ' km/h';
  showToast('\u2708 ' + ac.name + ' \u2014 ' + ac.desc, ac.color);
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 4: DRAW AIRPORTS
// ═══════════════════════════════════════════════════════════════

function drawAirports() {
  if (G.veh !== 'plane' || !G.overlays.transit) return;
  const z = getZoom().z;

  airports.forEach(ap => {
    const s = worldToScreen(ap.lat, ap.lon);
    if (s.x < -120 || s.x > cv.width + 120 || s.y < -50 || s.y > cv.height + 50) return;

    const d = haversine(G.pos.lat, G.pos.lng, ap.lat, ap.lon);
    const isLarge = ap.iata || ap.size === 'large' || ap.size === 'international';
    const ts = z >= 13 ? 12 : z >= 9 ? 8 : isLarge ? 6 : 4;

    if (!isLarge && z < 9) return;

    // Runway
    ctx.fillStyle = 'rgba(0,191,255,0.1)';
    ctx.fillRect(s.x - ts * 3, s.y - 1, ts * 6, 2);

    // Terminal
    ctx.fillStyle = d < 3 ? 'rgba(255,230,0,0.25)' : 'rgba(0,191,255,0.2)';
    ctx.fillRect(s.x - ts, s.y - ts, ts * 2, ts * 2);
    ctx.strokeStyle = d < 3 ? '#ffe600' : '#00bfff';
    ctx.lineWidth = isLarge ? 2 : 1;
    ctx.strokeRect(s.x - ts, s.y - ts, ts * 2, ts * 2);

    // IATA label
    if (z >= 7 || isLarge) {
      ctx.fillStyle = d < 3 ? '#ffe600' : '#00bfff';
      ctx.font = "bold " + (z >= 11 ? '11' : z >= 7 ? '9' : '7') + "px 'VT323',monospace";
      ctx.textAlign = 'center';
      const label = ap.iata || ap.icao || ap.name;
      ctx.fillText('\u2708 ' + label, s.x, s.y - ts - 3);
    }

    // Distance
    if (z >= 9) {
      ctx.fillStyle = 'rgba(0,191,255,0.3)';
      ctx.font = "8px 'VT323',monospace";
      ctx.textAlign = 'center';
      ctx.fillText(d.toFixed(0) + 'km', s.x, s.y + ts + 9);
    }

    // Proximity highlight ring
    if (d < 3) {
      ctx.strokeStyle = '#ffe600'; ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(s.x, s.y, ts + 10, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 5: REAL-TIME FLIGHTS (OpenSky Network)
// ═══════════════════════════════════════════════════════════════

function toggleFlights() {
  showFlights = !showFlights;
  const fb = document.getElementById('flightBtn'), fp = document.getElementById('FP');
  const ov = document.getElementById('ov-flights');
  if (ov) ov.checked = showFlights;
  if (showFlights) {
    fb.style.background = '#00bfff'; fb.style.color = '#000';
    fp.classList.add('show'); fetchFlights();
    flightInt = setInterval(fetchFlights, 15000);
  } else {
    fb.style.cssText = ''; fp.classList.remove('show');
    clearInterval(flightInt); flights = [];
    document.getElementById('SF').textContent = '0';
  }
}

async function fetchFlights() {
  const pad = getZoom().z >= 9 ? 1 : 3;
  try {
    const res = await fetch('https://opensky-network.org/api/states/all?lamin=' +
      (G.pos.lat - 5 - pad) + '&lomin=' + (G.pos.lng - 8 - pad) +
      '&lamax=' + (G.pos.lat + 5 + pad) + '&lomax=' + (G.pos.lng + 8 + pad));
    const data = await res.json();
    const st = (data.states || []).slice(0, 100);
    flights = st.map(s => ({
      icao: s[0], callsign: (s[1] || '').trim(), country: s[2],
      lon: s[5], lat: s[6], altitude: s[7], onGround: s[8],
      velocity: s[9], heading: s[10], vertRate: s[11]
    }));
    document.getElementById('SF').textContent = flights.length;
    const rows = flights.slice(0, 14).map(f => {
      const alt = f.altitude ? Math.round(f.altitude * 3.281) : '?';
      const spd = f.velocity ? Math.round(f.velocity * 3.6) : '?';
      return '<div class="fpflight"><span>' + (f.onGround ? '\u{1F6E9}' : '\u2708') + ' ' +
        (f.callsign || f.icao || '???') + '</span><span style="color:rgba(0,191,255,0.4)">' +
        alt + 'ft ' + spd + 'km/h</span></div>';
    });
    const gr = flights.filter(f => f.onGround).length;
    document.getElementById('FL').innerHTML =
      (rows.join('') || '<div style="color:rgba(0,191,255,0.3);padding:6px">No flights</div>') +
      '<div style="margin-top:4px;padding-top:4px;border-top:1px solid rgba(0,191,255,0.1);font-size:.7rem;color:rgba(0,191,255,0.3)">' +
      '\u2708 ' + (flights.length - gr) + ' airborne \u00B7 \u{1F6E9} ' + gr + ' grounded</div>';
  } catch (e) {
    document.getElementById('FL').innerHTML = '<div style="color:#ff4444;font-size:.82rem">OpenSky offline</div>';
  }
}

function drawFlights() {
  if (!showFlights) return;
  const z = getZoom().z;
  flights.forEach(f => {
    if (!f.lat || !f.lon) return;
    const s = worldToScreen(f.lat, f.lon);
    if (s.x < -40 || s.x > cv.width + 40 || s.y < -40 || s.y > cv.height + 40) return;
    ctx.save(); ctx.translate(s.x, s.y);
    if (f.heading != null) ctx.rotate((f.heading - 90) * Math.PI / 180);
    ctx.globalAlpha = f.onGround ? 0.35 : 0.9;
    ctx.fillStyle = f.onGround ? '#888' : '#00bfff';
    if (!f.onGround) { ctx.shadowColor = '#00bfff'; ctx.shadowBlur = 4; }
    ctx.font = (f.onGround ? '12' : '15') + 'px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('\u2708', 0, 0);
    ctx.shadowBlur = 0; ctx.restore();
    if (z >= 9 && f.callsign) {
      ctx.fillStyle = 'rgba(0,191,255,0.45)';
      ctx.font = "7px 'VT323',monospace"; ctx.textAlign = 'center';
      ctx.fillText(f.callsign, s.x, s.y + 11);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 6: BOARDING + LANDING + PROXIMITY
// ═══════════════════════════════════════════════════════════════

function checkAirportProximity() {
  if (G.veh !== 'plane') { nearAirport = null; return; }
  nearAirport = null;
  let closest = Infinity;
  airports.forEach(ap => {
    const d = haversine(G.pos.lat, G.pos.lng, ap.lat, ap.lon);
    if (d < 5 && d < closest) { nearAirport = ap; closest = d; }
  });
  const ind = document.getElementById('airInd');
  const bb = document.getElementById('boardBtn');
  const lb = document.getElementById('landBtn');
  const ab = document.getElementById('altBtn');
  const apb = document.getElementById('approachBtn');
  if (nearAirport && !planeAirborne) {
    ind.style.display = 'block';
    ind.innerHTML = '\u2708 AT ' + (nearAirport.iata || nearAirport.name) + ' \u2014 Press BOARD';
    bb.style.display = 'inline-block'; lb.style.display = 'none';
    if (ab) ab.style.display = 'none';
    if (apb) apb.style.display = 'none';
  } else if (nearAirport && planeAirborne) {
    ind.style.display = 'block';
    ind.innerHTML = '\u2708 NEAR ' + (nearAirport.iata || nearAirport.name) + ' \u2014 Press LAND';
    bb.style.display = 'none'; lb.style.display = 'inline-block';
    if (ab) ab.style.display = 'inline-block';
    if (apb) apb.style.display = 'inline-block';
  } else if (planeAirborne) {
    ind.style.display = 'none'; bb.style.display = 'none'; lb.style.display = 'none';
    if (ab) ab.style.display = 'inline-block';
    if (apb) apb.style.display = 'inline-block';
  } else {
    ind.style.display = 'none'; bb.style.display = 'none'; lb.style.display = 'none';
    if (ab) ab.style.display = 'none';
    if (apb) apb.style.display = 'none';
  }
}

function boardPlane() {
  // Commercial must board at airport
  if (curAircraft.cat === 'commercial' && !nearAirport) {
    showToast('Commercial aircraft must board at an airport!', '#ff4444');
    return;
  }
  // Military/experimental can take off anywhere
  if (curAircraft.cat !== 'commercial' && curAircraft.cat !== 'civil') {
    planeAirborne = true; targetAltitude = curAircraft.alt;
    planeSpeed = curAircraft.spd * 0.3; // start with some speed immediately
    showToast('\u2708 ' + curAircraft.name + ' SCRAMBLE!', curAircraft.color);
    if (G.zoom > 9) { setZoomLevel(9); }
    connectBlitzortung();
    return;
  }
  if (!nearAirport) { showToast('Get to an airport!', '#ff4444'); return; }
  planeAirborne = true; targetAltitude = curAircraft.alt;
  planeSpeed = curAircraft.spd * 0.3; // start with some speed immediately
  showToast('\u2708 ' + curAircraft.name + ' TAKEOFF from ' + (nearAirport.iata || nearAirport.name) + '!', curAircraft.color);
  if (G.zoom > 9) { setZoomLevel(9); }
  connectBlitzortung(); // Start receiving real lightning data
}

function landPlane() {
  if (curAircraft.cat === 'commercial' || curAircraft.cat === 'civil') {
    if (!nearAirport) { showToast('Fly to an airport to land!', '#ff4444'); return; }
  }
  planeAirborne = false; targetAltitude = 0; planeSpeed = 0;
  planeLandingMode = false;
  disconnectBlitzortung();
  const where = nearAirport ? (nearAirport.iata || nearAirport.name) : 'field landing';
  showToast('\u2708 Landed at ' + where + '!', '#ffe600');
  setZoomLevel(15);
}

// ── LANDING MODE ──
function toggleLandingMode() {
  if (!planeAirborne) return;
  planeLandingMode = !planeLandingMode;
  if (planeLandingMode) {
    targetAltitude = 1000; // descend to 1000ft approach altitude
    showToast('\u{1F6EC} APPROACH MODE \u2014 descending to 1000ft', '#ffe600');
  } else {
    targetAltitude = curAircraft.alt;
    showToast('\u2708 Climbing back to cruise', '#00bfff');
  }
}

// ── ALTITUDE CHOOSER ──
function setPlaneAltitude(alt) {
  if (!planeAirborne) { showToast('Take off first!', '#ff4444'); return; }
  targetAltitude = alt;
  planeLandingMode = false;
  const altStr = alt > 100000 ? Math.round(alt / 1000) + 'k' : alt.toLocaleString();
  showToast('\u2708 Target: ' + altStr + ' ft', '#00bfff');
}

function openAltitudeChooser() {
  if (!planeAirborne) { showToast('Take off first!', '#ff4444'); return; }
  const ac = curAircraft;
  // Build altitude presets based on aircraft ceiling
  planeAltitudePresets = [];
  if (ac.alt >= 1000)  planeAltitudePresets.push(1000);
  if (ac.alt >= 5000)  planeAltitudePresets.push(5000);
  if (ac.alt >= 10000) planeAltitudePresets.push(10000);
  if (ac.alt >= 20000) planeAltitudePresets.push(20000);
  if (ac.alt >= 35000) planeAltitudePresets.push(35000);
  planeAltitudePresets.push(ac.alt); // max ceiling

  let html = '<button class="mcl" onclick="closeModal()">\u2715</button>';
  html += '<div class="mh">\u2708 SET ALTITUDE</div>';
  html += '<div style="font-family:VT323,monospace;font-size:.9rem;color:rgba(0,191,255,0.5);margin-bottom:8px">Current: ' + Math.round(planeAltitude).toLocaleString() + ' ft \u00B7 ' + ac.name + '</div>';
  html += '<div style="font-family:VT323,monospace;font-size:.8rem;color:rgba(255,230,0,0.4);margin-bottom:8px">\u26A0 Lower altitude = slower speed</div>';

  planeAltitudePresets.forEach(alt => {
    const isCur = Math.abs(targetAltitude - alt) < 500;
    const speedPct = Math.round(Math.max(30, Math.min(100, (alt / ac.alt) * 100)));
    const altStr = alt > 100000 ? Math.round(alt / 1000) + 'k ft' : alt.toLocaleString() + ' ft';
    const spdStr = Math.round(ac.kmh * speedPct / 100) + ' km/h';
    html += '<div style="padding:6px 8px;margin:3px 0;border:2px solid ' + (isCur ? '#ffe600' : 'rgba(0,191,255,0.15)') +
      ';border-radius:4px;cursor:pointer;display:flex;justify-content:space-between;align-items:center" onclick="setPlaneAltitude(' + alt + ');closeModal()">';
    html += '<span style="font-family:\'Press Start 2P\',monospace;font-size:.24rem;color:' + (isCur ? '#ffe600' : '#00bfff') + '">' + altStr + '</span>';
    html += '<span style="font-family:VT323,monospace;font-size:.85rem;color:rgba(0,191,255,0.4)">' + speedPct + '% \u00B7 ~' + spdStr + '</span>';
    html += '</div>';
  });

  html += '<div style="margin-top:8px;border-top:1px solid rgba(0,191,255,0.15);padding-top:8px">';
  html += '<div style="padding:6px 8px;margin:3px 0;border:2px solid ' + (planeLandingMode ? '#ffe600' : 'rgba(255,230,0,0.2)') + ';border-radius:4px;cursor:pointer;background:' + (planeLandingMode ? 'rgba(255,230,0,0.08)' : 'transparent') + '" onclick="toggleLandingMode();closeModal()">';
  html += '<span style="font-family:\'Press Start 2P\',monospace;font-size:.24rem;color:#ffe600">\u{1F6EC} LANDING APPROACH</span>';
  html += '<div style="font-family:VT323,monospace;font-size:.8rem;color:rgba(255,230,0,0.4)">Descend to 1000ft, reduced speed, auto-land near airport</div>';
  html += '</div></div>';

  document.getElementById('MB').innerHTML = html;
  document.getElementById('MO').classList.add('open');
}

// Altitude keybindings (Q = descend step, E = climb step, L = landing mode)
document.addEventListener('keydown', function(e) {
  if (G.veh !== 'plane' || !planeAirborne) return;
  if (e.key === 'q' || e.key === 'Q') {
    // Step down altitude
    const steps = [1000, 5000, 10000, 20000, 35000, curAircraft.alt];
    let cur = steps.findIndex(s => s >= targetAltitude);
    if (cur > 0) { setPlaneAltitude(steps[cur - 1]); }
  }
  if (e.key === 'e' || e.key === 'E') {
    // Step up altitude
    const steps = [1000, 5000, 10000, 20000, 35000, curAircraft.alt];
    let cur = steps.findIndex(s => s >= targetAltitude);
    if (cur < steps.length - 1) { setPlaneAltitude(steps[cur + 1]); }
  }
  if (e.key === 'l' || e.key === 'L') {
    toggleLandingMode();
  }
});

// ═══════════════════════════════════════════════════════════════
//  SECTION 7: FLIGHT PHYSICS + CONTROLS
//  PLANE NEVER STOPS. Left/Right = turn. Always moving forward.
// ═══════════════════════════════════════════════════════════════

function planeUpdateControls() {
  if (G.veh !== 'plane') return;

  const k = G.keys;
  const up = k.ArrowUp || k.w || k.W;
  const dn = k.ArrowDown || k.s || k.S;
  const lt = k.ArrowLeft || k.a || k.A;
  const rt = k.ArrowRight || k.d || k.D;

  if (!planeAirborne) {
    // TAXIING — slow ground movement (can stop)
    const taxi = VEH.walk.spd;
    if (up) { G.pos.lat += taxi; G.dir = 'up'; }
    if (dn) { G.pos.lat -= taxi; G.dir = 'down'; }
    if (lt) { G.pos.lng -= taxi; G.dir = 'left'; }
    if (rt) { G.pos.lng += taxi; G.dir = 'right'; }
    return;
  }

  // ═══ AIRBORNE: CONSTANT FORWARD MOTION — PLANE NEVER STOPS ═══
  const ac = curAircraft;
  const maxSpd = ac.spd;

  // Speed scales with altitude — lower = slower (realistic approach)
  // At cruising altitude = 100% speed, at 1000ft = 30% speed
  const altRatio = Math.max(0.3, Math.min(1.0, planeAltitude / ac.alt));
  const altAdjustedMax = maxSpd * (planeLandingMode ? altRatio * 0.6 : altRatio);

  // Fast speed ramp — reaches cruise quickly
  planeSpeed += (altAdjustedMax - planeSpeed) * 0.02;
  if (planeSpeed < altAdjustedMax * 0.4) planeSpeed = altAdjustedMax * 0.4;

  // ── ANGULAR TURNING: Left/Right ONLY ──
  const turnSpd = ac.turnRate * (planeLandingMode ? 1.5 : 1.0); // tighter turns when landing

  if (lt && !rt) {
    planeHeading -= turnSpd;
  }
  if (rt && !lt) {
    planeHeading += turnSpd;
  }

  // Up = climb / speed boost, Down = descend / slow down
  if (up) {
    if (planeLandingMode) {
      // In landing mode, Up aborts landing
      planeLandingMode = false;
      targetAltitude = ac.alt;
      showToast('\u2708 Go-around! Climbing back to cruise', '#ffe600');
    } else {
      planeSpeed = Math.min(planeSpeed * 1.01, maxSpd * 1.3);
    }
  }
  if (dn) {
    planeSpeed = Math.max(planeSpeed * 0.99, altAdjustedMax * 0.25);
  }

  // Normalize heading 0-360
  planeHeading = ((planeHeading % 360) + 360) % 360;

  // ── CONSTANT FORWARD MOTION (always, every frame) ──
  const headRad = planeHeading * Math.PI / 180;
  G.pos.lat += Math.cos(headRad) * planeSpeed;
  G.pos.lng += Math.sin(headRad) * planeSpeed;

  // ── ALTITUDE ──
  const altLerp = planeLandingMode ? 0.008 : 0.015; // slower descent in landing mode
  planeAltitude += (targetAltitude - planeAltitude) * altLerp;
  if (!planeAirborne && planeAltitude < 10) planeAltitude = 0;

  // Auto-land when very low in landing mode
  if (planeLandingMode && planeAltitude < 200 && nearAirport) {
    landPlane();
    planeLandingMode = false;
  }
}

function flyUpdatePhysics() {
  // Track heading from actual movement
  if (prevPos) {
    const dLat = G.pos.lat - prevPos.lat, dLng = G.pos.lng - prevPos.lng;
    if (Math.abs(dLat) > 0.00001 || Math.abs(dLng) > 0.00001) {
      const k = G.keys;
      const anyDir = k.ArrowUp || k.ArrowDown || k.ArrowLeft || k.ArrowRight || k.w || k.s || k.a || k.d;
      if (!anyDir && planeAirborne) {
        // No input but airborne — keep current heading (don't update from movement)
        // This prevents heading jitter when no keys pressed
      }
    }
  }
  prevPos = { lat: G.pos.lat, lng: G.pos.lng };
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 8: WEATHER ATMOSPHERE
// ═══════════════════════════════════════════════════════════════

async function fetchPlaneWeather() {
  try {
    // Enhanced: get hourly cloud layers, precipitation, wind direction, visibility
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + G.pos.lat.toFixed(2) +
      '&longitude=' + G.pos.lng.toFixed(2) +
      '&current=weather_code,temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,cloud_cover,visibility' +
      '&hourly=cloud_cover_low,cloud_cover_mid,cloud_cover_high,precipitation,wind_speed_10m,wind_direction_10m' +
      '&forecast_hours=1';
    const res = await fetch(url);
    const data = await res.json();
    planeWeather = data.current;
    // Attach cloud layer data for altitude-specific rendering
    if (data.hourly) {
      planeWeather._cloudLow = data.hourly.cloud_cover_low?.[0] || 0;
      planeWeather._cloudMid = data.hourly.cloud_cover_mid?.[0] || 0;
      planeWeather._cloudHigh = data.hourly.cloud_cover_high?.[0] || 0;
      planeWeather._windDir = data.hourly.wind_direction_10m?.[0] || 0;
    }
    planeWeatherPos = { lat: G.pos.lat, lng: G.pos.lng };
  } catch (e) { /* silent */ }
}

function drawPlaneAtmosphere() {
  if (G.veh !== 'plane') return;
  if (!planeAirborne) return;

  const alt = planeAltitude;
  const ac = curAircraft;

  const realCloud = planeWeather?.cloud_cover || 0;
  const realPrec = planeWeather?.precipitation || 0;
  const realWind = planeWeather?.wind_speed_10m || 0;
  const realCode = planeWeather?.weather_code || 0;
  const isStorm = realCode >= 95;
  // Real cloud layers from Open-Meteo hourly data
  const cloudLow = planeWeather?._cloudLow || 0;   // ~2000-6500ft (stratus, cumulus)
  const cloudMid = planeWeather?._cloudMid || 0;    // ~6500-20000ft (altostratus)
  const cloudHigh = planeWeather?._cloudHigh || 0;  // ~20000-40000ft (cirrus)
  const windDir = planeWeather?._windDir || 0;      // degrees
  const windDirRad = windDir * Math.PI / 180;

  // Process delayed thunder sounds
  processThunderSounds();

  // ── Space view for very high altitude ──
  if (alt > 80000) {
    ctx.fillStyle = 'rgba(0,0,15,' + Math.min(0.5, (alt - 80000) / 200000) + ')';
    ctx.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < 40; i++) {
      const sx = (Math.sin(i * 137.5 + G.frameN * 0.0008) * 0.5 + 0.5) * cv.width;
      const sy = (Math.cos(i * 84.3 + G.frameN * 0.0006) * 0.5 + 0.5) * cv.height * 0.6;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.2 + Math.sin(G.frameN * 0.04 + i) * 0.2) + ')';
      ctx.beginPath(); ctx.arc(sx, sy, 1, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ── REAL CLOUD LAYERS ──
  // Low clouds (2000-6500ft) — thick, grey, bottom of view
  if (cloudLow > 10 && alt > 1500 && alt < 10000) {
    const inCloud = (alt > 2000 && alt < 6500);
    const alpha = (cloudLow / 100) * (inCloud ? 0.15 : 0.06);
    ctx.fillStyle = 'rgba(180,190,200,' + alpha + ')';
    const nClouds = Math.ceil(cloudLow / 12);
    for (let i = 0; i < nClouds; i++) {
      const driftX = Math.cos(windDirRad) * G.frameN * 0.4;
      const cx = ((driftX + i * 160) % (cv.width + 400)) - 200;
      const cy = inCloud ? cv.height * (0.3 + Math.sin(i * 1.7) * 0.2)
                         : cv.height * 0.7 + Math.sin(i * 2.1) * 30;
      ctx.beginPath(); ctx.ellipse(cx, cy, 60 + i * 8, 22 + i * 3, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Fog effect when inside low cloud layer
    if (inCloud && cloudLow > 50) {
      ctx.globalAlpha = (cloudLow / 100) * 0.08;
      ctx.fillStyle = '#bcc2cc';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.globalAlpha = 1;
    }
  }

  // Mid clouds (6500-20000ft) — wispy, lighter
  if (cloudMid > 10 && alt > 5000 && alt < 25000) {
    const inCloud = (alt > 6500 && alt < 20000);
    const alpha = (cloudMid / 100) * (inCloud ? 0.1 : 0.04);
    ctx.fillStyle = 'rgba(200,210,225,' + alpha + ')';
    const nClouds = Math.ceil(cloudMid / 18);
    for (let i = 0; i < nClouds; i++) {
      const driftX = Math.cos(windDirRad) * G.frameN * 0.25;
      const cx = ((driftX + i * 220) % (cv.width + 400)) - 200;
      const cy = inCloud ? cv.height * (0.2 + Math.sin(i * 3.1) * 0.25)
                         : cv.height * 0.15 + Math.sin(i * 2.8) * 40;
      ctx.beginPath(); ctx.ellipse(cx, cy, 80 + i * 15, 12 + i * 3, 0.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  // High clouds (20000-40000ft) — thin cirrus, ice crystals
  if (cloudHigh > 10 && alt > 15000 && alt < 45000) {
    const inCloud = (alt > 20000 && alt < 40000);
    const alpha = (cloudHigh / 100) * (inCloud ? 0.06 : 0.03);
    ctx.fillStyle = 'rgba(220,230,245,' + alpha + ')';
    const nClouds = Math.ceil(cloudHigh / 25);
    for (let i = 0; i < nClouds; i++) {
      const driftX = Math.cos(windDirRad) * G.frameN * 0.15;
      const cx = ((driftX + i * 300) % (cv.width + 500)) - 250;
      const cy = inCloud ? cv.height * (0.15 + Math.sin(i * 4.2) * 0.15)
                         : cv.height * 0.05 + i * 12;
      // Cirrus = long thin streaks
      ctx.beginPath(); ctx.ellipse(cx, cy, 120 + i * 20, 5 + i * 2, 0.3 + i * 0.1, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Fallback: use total cloud_cover if no layer data
  if (cloudLow === 0 && cloudMid === 0 && cloudHigh === 0 && realCloud > 15 && alt > 10000 && alt < 50000) {
    const alpha = (realCloud / 100) * 0.08;
    ctx.fillStyle = 'rgba(200,210,230,' + alpha + ')';
    for (let i = 0; i < Math.ceil(realCloud / 15); i++) {
      const cx = ((G.frameN * 0.3 + i * 180) % (cv.width + 300)) - 150;
      const cy = cv.height * 0.25 + Math.sin(i * 2.5 + G.frameN * 0.002) * 80;
      ctx.beginPath(); ctx.ellipse(cx, cy, 50 + i * 12, 18 + i * 4, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ── RAIN — uses real wind direction for drift ──
  if (realPrec > 0 && alt < 25000) {
    const intensity = Math.min(1, realPrec / 10) * Math.max(0, 1 - alt / 25000);
    const targetDrops = Math.floor(intensity * 150);
    while (planeRainDrops.length < targetDrops) {
      planeRainDrops.push({
        x: Math.random() * cv.width, y: Math.random() * cv.height,
        len: 12 + Math.random() * 20, spd: 7 + Math.random() * 5
      });
    }
    // Rain color: heavier = more opaque, bluer
    const rainAlpha = intensity * 0.35;
    ctx.strokeStyle = 'rgba(140,190,255,' + rainAlpha + ')'; ctx.lineWidth = 1;
    // Wind-driven drift using real direction
    const driftX = Math.sin(windDirRad) * realWind * 0.04;
    const driftY = Math.cos(windDirRad) * realWind * 0.02;
    planeRainDrops.forEach(p => {
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + driftX * 2, p.y + p.len); ctx.stroke();
      p.y += p.spd + driftY; p.x += driftX;
      if (p.y > cv.height) { p.y = -p.len; p.x = Math.random() * cv.width; }
      if (p.x > cv.width + 20) p.x = -10;
      if (p.x < -20) p.x = cv.width + 10;
    });
    if (planeRainDrops.length > targetDrops) planeRainDrops.length = targetDrops;
    // Visibility reduction during heavy rain
    if (realPrec > 5 && alt < 8000) {
      ctx.globalAlpha = Math.min(0.15, realPrec * 0.01);
      ctx.fillStyle = '#889';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.globalAlpha = 1;
    }
  } else { planeRainDrops = []; }

  // ── REAL LIGHTNING — from Blitzortung WebSocket ──
  const now = Date.now();

  realLightningStrikes.forEach(strike => {
    const age = now - strike.time;
    if (age > 8000) return; // keep visible longer for real strikes
    const s = worldToScreen(strike.lat, strike.lon);
    if (s.x < -100 || s.x > cv.width + 100 || s.y < -100 || s.y > cv.height + 100) return;

    const distKm = haversine(G.pos.lat, G.pos.lng, strike.lat, strike.lon);
    const fade = 1 - (age / 8000);

    // Ground strike glow — expanding ring
    const ringRadius = 6 + (1 - fade) * 50;
    ctx.fillStyle = 'rgba(255,255,200,' + (fade * 0.2) + ')';
    ctx.shadowColor = '#ffe666'; ctx.shadowBlur = 15 * fade;
    ctx.beginPath(); ctx.arc(s.x, s.y, ringRadius, 0, Math.PI * 2); ctx.fill();

    // Sound propagation ring — visible circle expanding at speed of sound
    // 343 m/s ≈ 0.343 km/s — ring shows where sound has reached
    const soundDistKm = (age / 1000) * 0.343;
    if (soundDistKm > 0.5 && soundDistKm < 100) {
      // Convert km to screen pixels (rough: depends on zoom)
      const z = getZoom().z;
      const kmPerPixel = 40075 * Math.cos(G.pos.lat * Math.PI / 180) / (256 * Math.pow(2, z));
      const soundRadiusPx = soundDistKm / kmPerPixel;
      if (soundRadiusPx > 2 && soundRadiusPx < cv.width) {
        const ringFade = Math.max(0, 1 - soundRadiusPx / cv.width);
        ctx.strokeStyle = 'rgba(200,200,255,' + (ringFade * 0.15 * fade) + ')';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(s.x, s.y, soundRadiusPx, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.shadowBlur = 0;

    // Lightning bolt (visible for first 600ms)
    if (age < 600) {
      const boltFade = 1 - (age / 600);
      ctx.strokeStyle = 'rgba(200,220,255,' + (boltFade * 0.8) + ')';
      ctx.lineWidth = 2.5; ctx.shadowColor = '#aaccff'; ctx.shadowBlur = 15 * boltFade;

      // Main bolt
      ctx.beginPath();
      let ly = Math.max(0, s.y - 300);
      let lx = s.x + (Math.random() - 0.5) * 30;
      ctx.moveTo(lx, ly);
      const segments = 8 + Math.floor(Math.abs(s.y - ly) / 40);
      const stepY = (s.y - ly) / segments;
      for (let seg = 0; seg < segments; seg++) {
        ly += stepY;
        lx = s.x + (Math.random() - 0.5) * 45 * (1 - seg / segments);
        ctx.lineTo(lx, ly);
        // Branch bolt (20% chance per segment)
        if (Math.random() < 0.2 && seg > 1) {
          ctx.moveTo(lx, ly);
          const bx = lx + (Math.random() - 0.5) * 60;
          const by = ly + stepY * (1 + Math.random());
          ctx.lineTo(bx, by);
          ctx.moveTo(lx, ly);
        }
      }
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Small label showing distance
    if (age < 4000 && distKm < 200) {
      ctx.fillStyle = 'rgba(255,255,200,' + (fade * 0.5) + ')';
      ctx.font = "7px 'VT323',monospace"; ctx.textAlign = 'center';
      ctx.fillText('\u26A1 ' + Math.round(distKm) + 'km', s.x, s.y + ringRadius + 10);
    }
  });

  // Screen flash for nearby strikes (< 10km)
  const recentNearby = realLightningStrikes.find(s =>
    (now - s.time) < 300 && haversine(G.pos.lat, G.pos.lng, s.lat, s.lon) < 10
  );
  if (recentNearby) {
    const flashAge = (now - recentNearby.time) / 300;
    ctx.globalAlpha = (1 - flashAge) * 0.18;
    ctx.fillStyle = '#ffe';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.globalAlpha = 1;
  }

  // Simulated storm strikes when no real Blitzortung data available
  if (isStorm && !blitzConnected && G.frameN % 90 < 2) {
    const strikeLat = G.pos.lat + (Math.random() - 0.5) * 0.5;
    const strikeLon = G.pos.lng + (Math.random() - 0.5) * 0.7;
    const strike = { lat: strikeLat, lon: strikeLon, time: now };
    realLightningStrikes.push(strike);
    // Simulated thunder too
    const distKm = haversine(G.pos.lat, G.pos.lng, strikeLat, strikeLon);
    if (distKm < 80) {
      thunderSoundsQueued.push({ time: now + (distKm / 0.343) * 1000, distKm });
    }
  }

  // Clean old strikes
  realLightningStrikes = realLightningStrikes.filter(s => now - s.time < 10000);

  // ── Speed lines (supersonic) ──
  if (ac.mach > 1) {
    const windInt = Math.min(1, (ac.mach - 1) / 10);
    while (planeWindParticles.length < windInt * 50) {
      planeWindParticles.push({ x: cv.width + Math.random() * 30, y: Math.random() * cv.height, len: 20 + Math.random() * 60 * ac.mach, spd: 8 + windInt * 20 });
    }
    ctx.strokeStyle = 'rgba(200,220,255,' + (windInt * 0.12) + ')'; ctx.lineWidth = 1;
    planeWindParticles.forEach(p => {
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.len, p.y); ctx.stroke();
      p.x -= p.spd; if (p.x < -p.len) { p.x = cv.width + 10; p.y = Math.random() * cv.height; }
    });
    if (planeWindParticles.length > windInt * 50) planeWindParticles.length = Math.floor(windInt * 50);
  } else { planeWindParticles = []; }

  // ── Sonic boom cone ──
  if (ac.mach >= 2) {
    const px = cv.width / 2, py = cv.height / 2;
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.02 * ac.mach) + ')';
    ctx.lineWidth = 1;
    const coneAngle = Math.asin(1 / ac.mach);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - Math.cos(coneAngle) * 200, py + Math.sin(coneAngle) * 200);
    ctx.moveTo(px, py);
    ctx.lineTo(px - Math.cos(coneAngle) * 200, py - Math.sin(coneAngle) * 200);
    ctx.stroke();
  }

  // ── Turbulence ──
  if (realWind > 40 && alt > 10000 && alt < 40000 && planeTurbulence === 0 && G.frameN % 300 === 0) {
    planeTurbulence = Math.floor(realWind / 4);
    showToast('\u26A0 Turbulence! Wind ' + Math.round(realWind) + ' km/h', '#ff6600');
  }
  if (planeTurbulence > 0) {
    planeTurbulence--;
    const shake = planeTurbulence * 0.35;
    ctx.save(); ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  // ── Weather HUD — enhanced with real data ──
  if (planeWeather) {
    const temp = planeWeather.temperature_2m;
    const vis = planeWeather.visibility;
    const visStr = vis ? (vis >= 10000 ? (vis / 1000).toFixed(0) + 'km' : vis + 'm') : '';
    const blitzStr = blitzConnected ? ' \u26A1LIVE' : '';
    const hudW = 230;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(6, cv.height - 48, hudW, 18);
    ctx.fillStyle = 'rgba(0,191,255,0.5)'; ctx.font = "9px 'VT323',monospace"; ctx.textAlign = 'left';
    let hudText = '\u{1F326} ' + Math.round(temp) + '\u00B0C  \u{1F32C} ' + Math.round(realWind) + 'km/h ' + Math.round(windDir) + '\u00B0  \u2601 ' + realCloud + '%';
    if (visStr) hudText += '  \u{1F441} ' + visStr;
    ctx.fillText(hudText, 10, cv.height - 35);
    // Blitzortung status
    if (blitzConnected) {
      ctx.fillStyle = '#ffe600'; ctx.font = "7px 'Press Start 2P',monospace";
      ctx.fillText('\u26A1 LIVE LIGHTNING', 10, cv.height - 52);
    }
  }
}

function drawPlaneAtmosphereEnd() {
  if (planeTurbulence > 0) ctx.restore();
}

// Periodic weather fetch for plane mode
function planeWeatherCheck() {
  if (G.veh !== 'plane' || !planeAirborne) return;
  if (!planeWeatherPos || haversine(G.pos.lat, G.pos.lng, planeWeatherPos.lat, planeWeatherPos.lng) > 50) {
    fetchPlaneWeather();
  }
}

// Blitzortung connection managed by connectBlitzortung() / disconnectBlitzortung()
// Called when boarding plane and when flying over new regions

// ═══════════════════════════════════════════════════════════════
//  SECTION 9: PLANE SPRITE
// ═══════════════════════════════════════════════════════════════

function drawPlaneSprite() {
  const px = cv.width / 2, py = cv.height / 2;
  const ac = curAircraft;
  const altOff = planeAirborne ? -10 : 0;
  const headRad = ((planeHeading - 90) * Math.PI / 180);

  ctx.save(); ctx.translate(px, py + altOff);

  // Ground shadow
  if (planeAirborne) {
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath(); ctx.ellipse(0, 22, 16, 4, 0, 0, Math.PI * 2); ctx.fill();
  }

  ctx.rotate(headRad);

  const scale = Math.min(1.3, Math.max(0.6, ac.fuseLen / 30));
  ctx.scale(scale, scale);

  // Fuselage
  ctx.fillStyle = '#e0e8f0';
  ctx.beginPath(); ctx.ellipse(0, 0, 22, 7, 0, 0, Math.PI * 2); ctx.fill();

  // Wings
  ctx.fillStyle = '#b8c4d0';
  ctx.beginPath(); ctx.moveTo(-2, -3); ctx.lineTo(5, -28); ctx.lineTo(9, -25); ctx.lineTo(5, -3); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-2, 3); ctx.lineTo(5, 28); ctx.lineTo(9, 25); ctx.lineTo(5, 3); ctx.closePath(); ctx.fill();

  // Tail
  ctx.fillStyle = '#9aa8b8';
  ctx.beginPath(); ctx.moveTo(-16, -2); ctx.lineTo(-22, -12); ctx.lineTo(-24, -10); ctx.lineTo(-20, -2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-16, 2); ctx.lineTo(-22, 12); ctx.lineTo(-24, 10); ctx.lineTo(-20, 2); ctx.closePath(); ctx.fill();

  // Tail fin
  ctx.fillStyle = ac.tailColor || ac.color;
  ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-22, 0); ctx.lineTo(-24, -7); ctx.lineTo(-18, -2); ctx.closePath(); ctx.fill();

  // Cockpit
  ctx.fillStyle = '#00bfff';
  ctx.beginPath(); ctx.ellipse(16, 0, 5, 4, 0, 0, Math.PI * 2); ctx.fill();

  // Engine effects
  if (planeAirborne) {
    const f = 0.3 + Math.random() * 0.3;
    ctx.fillStyle = 'rgba(255,140,0,' + f + ')';
    const exLen = 4 + (ac.mach > 1 ? ac.mach * 3 : 0) + Math.random() * 3;
    ctx.beginPath(); ctx.ellipse(-8, -16, exLen, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-8, 16, exLen, 2.5, 0, 0, Math.PI * 2); ctx.fill();

    if (ac.mach >= 1.5) {
      ctx.fillStyle = 'rgba(255,50,0,' + (f * 0.7) + ')';
      const abLen = ac.mach * 5 + Math.random() * 4;
      ctx.beginPath(); ctx.ellipse(-14, -16, abLen, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-14, 16, abLen, 2, 0, 0, Math.PI * 2); ctx.fill();
    }

    if (ac.mach >= 5) {
      ctx.fillStyle = 'rgba(255,100,0,' + (f * 0.3) + ')';
      ctx.beginPath(); ctx.ellipse(0, 0, 28, 10, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Glow outline
  ctx.strokeStyle = planeAirborne ? ac.color + '66' : 'rgba(0,255,65,0.2)';
  ctx.lineWidth = 1; ctx.shadowColor = ac.color;
  ctx.shadowBlur = planeAirborne ? 10 : 2;
  ctx.beginPath(); ctx.ellipse(0, 0, 22, 7, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.restore();

  // ── HUD readout ──
  if (planeAirborne) {
    ctx.font = "8px 'Press Start 2P'"; ctx.fillStyle = ac.color; ctx.textAlign = 'center';
    ctx.fillText(ac.name, px, py + altOff - 34);
    ctx.font = "6px 'Press Start 2P'"; ctx.fillStyle = 'rgba(0,191,255,0.5)';
    const altStr = planeAltitude > 100000 ? (planeAltitude / 1000).toFixed(0) + 'k ft' : Math.floor(planeAltitude) + ' ft';
    const machStr = ac.mach >= 1 ? 'M' + ac.mach : ac.kmh + 'km/h';
    ctx.fillText(altStr + ' \u00B7 ' + machStr + ' \u00B7 HDG ' + Math.round(planeHeading) + '\u00B0', px, py + altOff - 24);
    if (planeLandingMode) {
      ctx.fillStyle = '#ffe600'; ctx.font = "5px 'Press Start 2P'";
      ctx.fillText('\u{1F6EC} APPROACH MODE \u2014 Q/E altitude \u2014 L toggle', px, py + altOff - 16);
    } else if (ac.cat === 'commercial') {
      ctx.fillStyle = 'rgba(255,230,0,0.4)'; ctx.font = "5px 'Press Start 2P'";
      ctx.fillText('COMMERCIAL FLIGHT \u2014 Q/E altitude \u2014 L approach', px, py + altOff - 16);
    }
  } else if (nearAirport) {
    ctx.font = "7px 'Press Start 2P'"; ctx.fillStyle = '#ffe600'; ctx.textAlign = 'center';
    ctx.fillText(ac.name + ' @ ' + (nearAirport.iata || 'AIRPORT'), px, py - 30);
  } else if (!planeAirborne && (ac.cat === 'fighter' || ac.cat === 'bomber' || ac.cat === 'experimental' || ac.cat === 'recon')) {
    ctx.font = "7px 'Press Start 2P'"; ctx.fillStyle = ac.color; ctx.textAlign = 'center';
    ctx.fillText('PRESS BOARD TO SCRAMBLE', px, py - 30);
  }
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 10: CLEANUP
// ═══════════════════════════════════════════════════════════════

function flyClear() {
  airports = []; flights = [];
  planeAirborne = false; nearAirport = null;
  planeAltitude = 0; targetAltitude = 0; planeSpeed = 0;
  planeLandingMode = false;
  planeRainDrops = []; planeWindParticles = [];
  planeLightning = 0; planeTurbulence = 0;
  planeWeather = null; planeWeatherPos = null;
  disconnectBlitzortung(); thunderSoundsQueued = [];
  document.getElementById('airInd').style.display = 'none';
  document.getElementById('boardBtn').style.display = 'none';
  document.getElementById('landBtn').style.display = 'none';
  const ab = document.getElementById('altBtn'); if (ab) ab.style.display = 'none';
  const apb = document.getElementById('approachBtn'); if (apb) apb.style.display = 'none';
}
