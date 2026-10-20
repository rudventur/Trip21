// Headless browser checks for Snout First: carrying a pet onto the dashboard
// (js/snout-first-service.js) and the hide / show toggles on every panel
// (js/panel-toggle.js). Serves the repository itself; outside network
// requests (map tiles, fonts, Firebase) are blocked, so nothing is sent anywhere.
//   npm i -D puppeteer            (or: npm i -D puppeteer-core and set CHROME_PATH)
//   node tests/snout-first-panels.test.mjs
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const puppeteer = (await import(process.env.CHROME_PATH ? 'puppeteer-core' : 'puppeteer')).default;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(0);
const URL_ = `http://127.0.0.1:${server.address().port}/snout-first.html`;

const T0 = 1700000000000;
const PETS = [
  { name: 'Ferajna', species: 'cat', breed: 'Tabby', bio: '', tags: ['Lap Monster'], mood: 'sleepy', lat: 51.505, lon: -0.09, timestamp: T0 },
  { name: 'Burek', species: 'dog', breed: 'Mutt', bio: '', tags: [], mood: 'playful', lat: 51.507, lon: -0.085, timestamp: T0 + 1 }
];
const BUREK = 'local:' + (T0 + 1) + ':Burek';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--no-sandbox'] });

let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('  ok  ', name); } else { fail++; console.log('  FAIL', name, extra === undefined ? '' : JSON.stringify(extra)); }
}

async function open({ phone = false, off = [BUREK], storage = null } = {}) {
  const page = await browser.newPage();
  if (phone) await page.emulate({ viewport: { width: 390, height: 780, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36' });
  else await page.setViewport({ width: 1280, height: 800 });
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => r.url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.evaluateOnNewDocument((pets, off, storage) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('snoutfirst_pets', JSON.stringify(pets));
    localStorage.setItem('sf_dashboard', JSON.stringify({ off, pinned: [] }));
    if (storage) for (const k in storage) localStorage.setItem(k, storage[k]);
  }, PETS, off, storage);
  await page.goto(URL_, { waitUntil: 'load' });
  await sleep(900);
  return page;
}
const box = (page, sel) => page.$eval(sel, el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, bottom: r.bottom, w: r.width, h: r.height }; });
const burekOff = page => page.evaluate(k => sfDash.isOff(sfDash.byKey(k)), BUREK);
async function mouseDrag(page, from, to, holdMs = 0) {
  await page.mouse.move(from.x, from.y); await page.mouse.down(); if (holdMs) await sleep(holdMs);
  for (let i = 1; i <= 12; i++) { await page.mouse.move(from.x + (to.x - from.x) * i / 12, from.y + (to.y - from.y) * i / 12); await sleep(20); }
  await page.mouse.up(); await sleep(250);
}
async function touchDrag(page, from, to, holdMs) {
  await page.touchscreen.touchStart(from.x, from.y); await sleep(holdMs);
  for (let i = 1; i <= 12; i++) { await page.touchscreen.touchMove(from.x + (to.x - from.x) * i / 12, from.y + (to.y - from.y) * i / 12); await sleep(25); }
  await page.touchscreen.touchEnd(); await sleep(300);
}

console.log('— loads cleanly');
for (const phone of [false, true]) {
  const page = await open({ phone });
  check((phone ? 'phone' : 'desktop') + ': no script errors on load', page.errors.length === 0, page.errors);
  check((phone ? 'phone' : 'desktop') + ': SnoutFirst service and panels are there', await page.evaluate(() => !!window.SnoutFirst && !!window.sfPanels));
  await page.close();
}

console.log('— carrying a list tile onto the dashboard (mouse)');
const targets = {
  'a tile on the dashboard': p => box(p, '#lpContent .lp-pet-tile'),
  'empty space low on the dashboard': async p => { const b = await box(p, '#lpContent'); return { x: b.x, y: b.bottom - 20 }; },
  'the dashboard header': p => box(p, '#lpRoot .sf-phead'),
  'the dashboard tab bar': p => box(p, '#lpTabBar')
};
for (const [name, where] of Object.entries(targets)) {
  const page = await open();
  await page.evaluate(() => rpSwitchTab('off')); await sleep(150);
  const mapBefore = await page.evaluate(() => [S.lat, S.lon]);
  await mouseDrag(page, await box(page, '#rpContent .rp-pet'), await where(page));
  check('drop on ' + name + ' puts the pet back', !(await burekOff(page)));
  check('  …and the release is not taken as a click (map did not jump)', JSON.stringify(mapBefore) === JSON.stringify(await page.evaluate(() => [S.lat, S.lon])));
  await page.close();
}
{
  const page = await open();
  await page.evaluate(() => { rpSwitchTab('off'); lpSwitchTab('notebook'); }); await sleep(150);
  await mouseDrag(page, await box(page, '#rpContent .rp-pet'), await box(page, '#lpContent'));
  check('drop while the dashboard shows Notes works and switches to Pets', !(await burekOff(page)) && await page.$eval('.lp-tab.active', el => el.dataset.lptab) === 'pets');
  await page.close();
}
{
  const page = await open();
  await page.evaluate(() => { rpSwitchTab('off'); sfPanels.set('left', false); }); await sleep(300);
  await mouseDrag(page, await box(page, '#rpContent .rp-pet'), await box(page, '#lpRoot'));
  check('drop on the tucked-away dashboard edge works and opens it', !(await burekOff(page)) && await page.evaluate(() => sfDash.isPanelOpen('left')));
  await page.close();
}
{
  const page = await open();
  await page.evaluate(() => rpSwitchTab('off')); await sleep(150);
  await mouseDrag(page, await box(page, '#rpContent .rp-pet'), { x: 640, y: 400 });
  check('drop on the map does nothing', await burekOff(page));
  check('  …and leaves nothing behind', await page.evaluate(() => !document.querySelector('.sf-drag-ghost') && !document.body.classList.contains('sf-dragging')));
  const before = await page.evaluate(() => [S.lat, S.lon]);
  await page.evaluate(() => rpSwitchTab('all')); await sleep(150);
  await page.click('#rpContent .rp-pet[data-key="' + 'local:' + (1700000000001) + ':Burek' + '"] .rp-laddr');
  await sleep(150);
  check('a plain click on a list tile still goes to the pet', JSON.stringify(before) !== JSON.stringify(await page.evaluate(() => [S.lat, S.lon])));
  await page.close();
}

console.log('— carrying a map pin onto the dashboard (mouse)');
{
  const page = await open();
  const pin = await page.evaluate(() => worldToScreen(S.pets[1].lat, S.pets[1].lon));
  const before = await page.evaluate(() => [S.lat, S.lon]);
  await mouseDrag(page, pin, await box(page, '#lpContent'), 500);
  check('hold a pin, drop it on the dashboard: back on', !(await burekOff(page)));
  const after = await page.evaluate(() => [S.lat, S.lon]);
  check('  …and the map held still while it was carried', Math.abs(after[1] - before[1]) < 1e-4, { before, after });
  await page.close();
}

console.log('— phone (touch)');
{
  const page = await open({ phone: true });
  await page.evaluate(() => { sfDash.setPanelOpen('right', true); rpSwitchTab('off'); }); await sleep(200);
  const tile = await box(page, '#rpContent .rp-pet');
  await touchDrag(page, tile, { x: tile.x, y: tile.y - 80 }, 0);
  check('a quick swipe on a list tile is a scroll, not a drag', await burekOff(page));
  await page.evaluate(() => rpSwitchTab('off')); await sleep(150);
  const t2 = await box(page, '#rpContent .rp-pet');
  await page.touchscreen.touchStart(t2.x, t2.y); await sleep(500);
  const strip = await page.$eval('#lpRoot', el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height }; });
  check('while carrying, the dashboard strip shows over the Lists sheet', strip.h > 0, strip);
  for (let i = 1; i <= 12; i++) { await page.touchscreen.touchMove(t2.x + (strip.x - t2.x) * i / 12, t2.y + (strip.y - t2.y) * i / 12); await sleep(25); }
  await page.touchscreen.touchEnd(); await sleep(300);
  check('hold a list tile, drop it on the dashboard strip: back on', !(await burekOff(page)));
  check('no script errors', page.errors.length === 0, page.errors);
  await page.close();
}
{
  const page = await open({ phone: true });
  const pin = await page.evaluate(() => worldToScreen(S.pets[1].lat, S.pets[1].lon));
  await touchDrag(page, pin, await box(page, '#lpRoot'), 500);
  check('hold a map pin, drop it on the dashboard strip: back on', !(await burekOff(page)));
  const before = await page.evaluate(() => [S.lat, S.lon]);
  await touchDrag(page, { x: 200, y: 450 }, { x: 260, y: 520 }, 0);
  check('a finger still pans the map', JSON.stringify(before) !== JSON.stringify(await page.evaluate(() => [S.lat, S.lon])));
  await page.close();
}

console.log('— panel toggles');
{
  const page = await open();
  const ids = ['bar', 'stats', 'left', 'right', 'trail', 'pack', 'account'];
  for (const id of ids) {
    const n = await page.$$eval(`[data-panel-toggle="${id}"]`, els => els.length);
    check(`"${id}" has a toggle`, n >= 1, n);
  }
  // header toggles: every panel header uses the same button
  const heads = await page.$$eval('.sf-phead', els => els.map(h => !!h.querySelector('.sf-ptoggle')));
  check('every panel header carries the same .sf-ptoggle button', heads.length >= 6 && heads.every(Boolean), heads);

  check('the tab that brings the top bar back is hidden while the bar shows', await page.$eval('.sf-ptab-top', el => getComputedStyle(el).display === 'none'));
  await page.click('#sfBar .sf-ptoggle'); await sleep(250);
  check('top bar hides', await page.$eval('#sfBar', el => getComputedStyle(el).display === 'none'));
  check('  …the side panels move up into its space', (await box(page, '#lpRoot')).top === 0);
  check('  …a tab to bring it back is shown', await page.$eval('.sf-ptab-top', el => getComputedStyle(el).display !== 'none'));
  await page.click('#sfStats .sf-ptoggle'); await sleep(100);
  check('stats collapse to their header', await page.$eval('#sfStats .sf-pbody', el => getComputedStyle(el).display === 'none'));
  await page.click('#lpRoot .sf-ptoggle'); await sleep(300);
  check('dashboard header "hide" works (no error)', !(await page.evaluate(() => sfDash.isPanelOpen('left'))) && page.errors.length === 0, page.errors);
  check('  …edge tab says "Show the dashboard"', await page.$eval('#lpToggleBtn', el => el.title === 'Show the dashboard' && el.getAttribute('aria-expanded') === 'false'));
  await page.click('#rpRoot .sf-ptoggle'); await sleep(300);
  check('lists header "hide" works', !(await page.evaluate(() => sfDash.isPanelOpen('right'))));

  await page.reload({ waitUntil: 'load' }); await sleep(900);
  check('after reload: top bar still hidden', await page.$eval('#sfBar', el => getComputedStyle(el).display === 'none'));
  check('after reload: stats still collapsed', await page.$eval('#sfStats', el => el.classList.contains('sf-panel-collapsed')));
  check('after reload: dashboard and lists still tucked away', await page.evaluate(() => !sfDash.isPanelOpen('left') && !sfDash.isPanelOpen('right')));

  await page.click('.sf-ptab-top'); await sleep(150);
  check('the tab brings the top bar back', await page.$eval('#sfBar', el => getComputedStyle(el).display !== 'none'));
  await page.click('#lpToggleBtn'); await sleep(300);
  check('the edge tab brings the dashboard back', await page.evaluate(() => sfDash.isPanelOpen('left')));

  await page.click('button[data-panel-toggle="trail"].hbtn'); await sleep(150);
  check('TRAIL opens, its button shows it is open', await page.evaluate(() => S.trailOpen) && await page.$eval('button.hbtn[data-panel-toggle="trail"]', el => el.getAttribute('aria-expanded') === 'true'));
  await page.click('#trailPanel .sf-ptoggle'); await sleep(150);
  check('the Trail header "hide" closes it', !(await page.evaluate(() => S.trailOpen)));
  await page.click('button[data-panel-toggle="pack"].hbtn'); await sleep(150);
  await page.click('#packPanel .sf-ptoggle'); await sleep(150);
  check('the Pack opens and its header "hide" closes it', !(await page.evaluate(() => S.packOpen)));
  await page.click('#sfuCircle'); await sleep(150);
  check('useRbox opens from the paw', await page.evaluate(() => sfPanels.isOpen('account')));
  await page.click('#sfuPanel .sf-ptoggle'); await sleep(150);
  check('the useRbox header "hide" closes it', !(await page.evaluate(() => sfPanels.isOpen('account'))));
  check('no script errors', page.errors.length === 0, page.errors);
  await page.close();
}
{
  const page = await open({ phone: true, storage: { sf_panels: JSON.stringify({ left: true, right: true }) } });
  check('phone: sheets still start closed even if the columns were left open on a wide screen', await page.evaluate(() => !sfDash.isPanelOpen('left') && !sfDash.isPanelOpen('right')));
  const tb = await box(page, '#sfBar .sf-ptoggle');
  check('phone: the top bar toggle is visible in the bar', tb.w > 0 && tb.x < 390, tb);
  await page.click('#sfBar .sf-ptoggle'); await sleep(200);
  check('phone: top bar hides and frees its height', (await page.$eval('#sfStats', el => el.getBoundingClientRect().top)) < 20);
  check('no script errors', page.errors.length === 0, page.errors);
  await page.close();
}

await browser.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
