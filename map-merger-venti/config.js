// ═══════════════════════════════════════════════════════════════
//  config.js — Vehicles, aircraft, zoom, countries, tiles
// ═══════════════════════════════════════════════════════════════

// Ground/water vehicles
const VEH = {
  walk:    { spd: 0.000038, em: '&#128694;', lbl: 'WALK',   kmh: '5 km/h' },
  bike:    { spd: 0.00011,  em: '&#128690;', lbl: 'BIKE',   kmh: '18 km/h' },
  scooter: { spd: 0.00020,  em: '&#128757;', lbl: 'SCOOT',  kmh: '35 km/h' },
  car:     { spd: 0.00042,  em: '&#128663;', lbl: 'CAR',    kmh: '60 km/h' },
  bus:     { spd: 0.00033,  em: '&#128652;', lbl: 'BUS',    kmh: '45 km/h' },
  train:   { spd: 0.0011,   em: '&#128642;', lbl: 'TRAIN',  kmh: '160 km/h' },
  boat:    { spd: 0.00028,  em: '&#9973;',   lbl: 'BOAT',   kmh: '40 km/h' },
  plane:   { spd: 0.0042,   em: '&#9992;',   lbl: 'PLANE',  kmh: '850 km/h' },
  ufo:     { spd: 0.0075,   em: '&#128760;', lbl: 'UFO',    kmh: '\u221E km/h' },
};

// Smooth zoom: float from 2.0 to 19.0
// Tiles load at integer levels, canvas scales for fractional part
const ZOOM_MIN = 2;
const ZOOM_MAX = 19;

// Named levels for display (mapped to nearest integer)
const ZOOM_NAMES = {
  2: 'World',    3: 'Continental', 4: 'Subcontinental',
  5: 'Country',  6: 'Large region', 7: 'Region',
  8: 'Wide area', 9: 'Metro', 10: 'City wide',
  11: 'City',    12: 'Town',  13: 'District',
  14: 'Neighbourhood', 15: 'Streets', 16: 'Street detail',
  17: 'Block',   18: 'Building', 19: 'Close-up',
};

const TILE_URLS = {
  // CARTO basemaps now stamp "API KEY REQUIRED" on every tile without a paid key;
  // Esri's canvas / street tiles are free and keyless (z/y/x order)
  dark:       'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  darkclean:  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  osm:        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  voyager:    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
  positron:   'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  topo:       'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
  watercolor: 'https://watercolormaps.collection.cooperhewitt.org/tile/watercolor/{z}/{x}/{y}.jpg',
  satellite:  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

const RAIL_TILE_URL = 'https://a.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png';

const PCOLS = { free: { bg: '#00ff41', bd: '#00cc33' }, swap: { bg: '#00bfff', bd: '#0088bb' }, donation: { bg: '#ffaa00', bd: '#cc8800' }, fee: { bg: '#ff4488', bd: '#bb2266' }, seek: { bg: '#ffe600', bd: '#ccaa00' }, rip: { bg: '#8a8a8a', bd: '#555555' } };
const TYPES = ['&#128566; Print','&#127994; Ceramics','&#128247; Darkroom','&#129683; Wood','&#129525; Textile','&#127912; Paint','&#128297; Metal','&#128187; Digital','&#127807; Garden','&#129702; Cemetery','&#10024; Other'];

const COUNTRIES = [
  { code:'GB', name:'United Kingdom', lat:54.0, lng:-2.0, bbox:[49.9,-8.6,60.9,1.8] },
  { code:'DE', name:'Germany', lat:51.2, lng:10.4, bbox:[47.3,5.9,55.1,15.0] },
  { code:'FR', name:'France', lat:46.6, lng:2.2, bbox:[41.3,-5.1,51.1,9.6] },
  { code:'IT', name:'Italy', lat:42.5, lng:12.5, bbox:[36.6,6.6,47.1,18.5] },
  { code:'ES', name:'Spain', lat:40.0, lng:-3.7, bbox:[36.0,-9.3,43.8,3.3] },
  { code:'PL', name:'Poland', lat:52.0, lng:19.4, bbox:[49.0,14.1,54.9,24.2] },
  { code:'NL', name:'Netherlands', lat:52.1, lng:5.3, bbox:[50.8,3.4,53.5,7.2] },
  { code:'BE', name:'Belgium', lat:50.8, lng:4.4, bbox:[49.5,2.5,51.5,6.4] },
  { code:'AT', name:'Austria', lat:47.5, lng:13.3, bbox:[46.4,9.5,49.0,17.2] },
  { code:'CH', name:'Switzerland', lat:46.8, lng:8.2, bbox:[45.8,5.9,47.8,10.5] },
  { code:'CZ', name:'Czech Republic', lat:49.8, lng:15.5, bbox:[48.6,12.1,51.1,18.9] },
  { code:'SE', name:'Sweden', lat:62.0, lng:15.0, bbox:[55.3,11.1,69.1,24.2] },
  { code:'NO', name:'Norway', lat:64.0, lng:12.0, bbox:[58.0,4.5,71.2,31.2] },
  { code:'PT', name:'Portugal', lat:39.4, lng:-8.2, bbox:[36.9,-9.5,42.2,-6.2] },
  { code:'IE', name:'Ireland', lat:53.4, lng:-8.2, bbox:[51.4,-10.5,55.4,-6.0] },
  { code:'JP', name:'Japan', lat:36.2, lng:138.3, bbox:[30.0,129.0,46.0,146.0] },
  { code:'US', name:'United States', lat:39.8, lng:-98.6, bbox:[24.5,-125.0,49.4,-66.9] },
  { code:'IN', name:'India', lat:20.6, lng:79.0, bbox:[6.7,68.1,35.5,97.4] },
  { code:'AU', name:'Australia', lat:-25.3, lng:133.8, bbox:[-43.6,113.2,-10.7,153.6] },
  { code:'RO', name:'Romania', lat:45.9, lng:24.9, bbox:[43.6,20.3,48.3,29.7] },
  { code:'GR', name:'Greece', lat:39.1, lng:21.8, bbox:[34.8,19.4,41.7,29.6] },
  { code:'HU', name:'Hungary', lat:47.2, lng:19.5, bbox:[45.7,16.1,48.6,22.9] },
  { code:'FI', name:'Finland', lat:64.0, lng:26.0, bbox:[59.8,20.6,70.1,31.6] },
  { code:'SK', name:'Slovakia', lat:48.7, lng:19.7, bbox:[47.7,16.8,49.6,22.6] },
];

const DEMO = [
  { id:'d1', lat:51.529, lng:-0.078, username:'NeonWanderer42', signature:'making things, breaking things', artSpace:{ active:true, offer:{ types:['&#128566; Print','&#128247; Darkroom'], desc:'Risograph + screenprint in a railway arch.', dateFrom:'2026-03-20', dateTo:'2026-04-10', exchange:['&#128154; FREE','&#128260; SWAP'] }, seek:{ types:[], desc:'', exchange:[] }}},
  { id:'d2', lat:52.520, lng:13.405, username:'CosmicNomad7', signature:'ceramicist wandering', artSpace:{ active:true, offer:{ types:[], desc:'', exchange:[] }, seek:{ types:['&#127994; Ceramics'], desc:'Seeking kiln in Berlin.', dateFrom:'2026-04-05', dateTo:'2026-04-19', exchange:['&#128260; SKILLS'] }}},
  { id:'d3', lat:51.883, lng:-3.436, username:'QuantumDrifter88', signature:'wood + light + time', artSpace:{ active:true, offer:{ types:['&#129683; Wood','&#128297; Metal'], desc:'Workshop in Wales.', dateFrom:'2026-03-25', dateTo:'2026-05-01', exchange:['&#9749; DONATION'] }, seek:{ types:[], desc:'', exchange:[] }}},
  { id:'d4', lat:48.857, lng:2.352, username:'ElectricSeeker12', signature:'sound artist', artSpace:{ active:true, offer:{ types:[], desc:'', exchange:[] }, seek:{ types:['&#128187; Digital'], desc:'Studio in Paris.', dateFrom:'2026-03-28', dateTo:'2026-04-02', exchange:['&#128260; SKILLS'] }}},
  { id:'d5', lat:38.567, lng:-8.050, username:'PlasmaVoyager303', signature:'natural dyes', artSpace:{ active:true, offer:{ types:['&#129525; Textile','&#127807; Garden'], desc:'Dye studio Portugal.', dateFrom:'2026-04-01', dateTo:'2026-07-31', exchange:['&#128154; FREE'] }, seek:{ types:[], desc:'', exchange:[] }}},
  { id:'d6', lat:55.862, lng:-4.258, username:'AtomicPioneer55', signature:'printmaker', artSpace:{ active:true, offer:{ types:['&#128566; Print','&#127912; Paint'], desc:'Print studio Glasgow.', dateFrom:'2026-03-15', dateTo:'2026-12-31', exchange:['&#128154; FREE'] }, seek:{ types:['&#128247; Darkroom'], desc:'Seeking darkroom!', dateFrom:'', dateTo:'', exchange:['&#128260; SWAP'] }}},
];
