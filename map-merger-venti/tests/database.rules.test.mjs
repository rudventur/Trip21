// Tests for database.rules.json (Snout First), run against the local Firebase
// database emulator — nothing touches the real project.
//   npm i -D firebase-tools @firebase/rules-unit-testing firebase
//   npx firebase emulators:exec --only database --project demo-snoutfirst "node tests/database.rules.test.mjs"
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { ref, set, update, get, remove, serverTimestamp } from 'firebase/database';
import fs from 'fs';

const env = await initializeTestEnvironment({
  projectId: 'demo-snoutfirst',
  database: { rules: fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8'), host: '127.0.0.1', port: 9000 }
});
const db = uid => env.authenticatedContext(uid).database();
const anon = env.unauthenticatedContext().database();
const TS = serverTimestamp();
let pass = 0, fail = 0;
async function t(name, expectOk, fn) {
  try { await (expectOk ? assertSucceeds : assertFails)(fn()); pass++; console.log('  ok  ', name); }
  catch (e) { fail++; console.log('  FAIL', name, '->', (e.message || '').split('\n')[0].slice(0, 160)); }
}
const pet = (uid, extra = {}) => ({
  name: 'Ferajna', species: 'cat', breed: '', emoji: '🐱', bio: 'Hates the carrier',
  personality_tags: ['Lap Monster', 'Night Zoomie'], home_lat: 51.505, home_lng: -0.09,
  owner_uid: uid, registered_by: uid, owner_name: 'Rudy', notify_walks: true, notify_feedings: true,
  status: 'home', mood: 'sleepy', created_at: TS,
  stats: { lifetime_distance_km: 0, total_walks: 0, total_feedings: 0 }, active: true, ...extra
});

console.log('— default deny');
await t('signed-out visitor reads pets', false, () => get(ref(anon, 'snoutfirst/pets')));
await t('signed-out visitor creates a pet', false, () => set(ref(anon, 'snoutfirst/pets/p0'), pet('x')));
await t('read the database root', false, () => get(ref(db('alice'), '/')));
await t('write an unknown top-level path', false, () => set(ref(db('alice'), 'junk/x'), 1));
await t('old live-walk path (walk_history) is closed', false, () => set(ref(db('alice'), 'walk_history/p1/w1/path/0'), { lat: 1, lng: 1 }));
await t('old wandering path is closed', false, () => set(ref(db('alice'), 'wandering_pets/snoutfirst_global/p1'), { lat: 1 }));
await t('old active_pets path is closed', false, () => set(ref(db('alice'), 'mapmergerventi/active_pets/snoutfirst_global/p1'), { lat: 1 }));

console.log('— pets');
await t('alice registers her pet', true, () => set(ref(db('alice'), 'snoutfirst/pets/p1'), pet('alice')));
await t('signed-in visitor reads pets', true, () => get(ref(db('bob'), 'snoutfirst/pets')));
await t('bob registers a pet in alice\'s name', false, () => set(ref(db('bob'), 'snoutfirst/pets/p2'), pet('alice')));
await t('bob overwrites alice\'s pet', false, () => set(ref(db('bob'), 'snoutfirst/pets/p1'), pet('bob')));
await t('bob changes alice\'s pet status', false, () => update(ref(db('bob'), 'snoutfirst/pets/p1'), { status: 'walking', current_walker: 'bob' }));
await t('bob deletes alice\'s pet', false, () => remove(ref(db('bob'), 'snoutfirst/pets/p1')));
await t('alice takes her pet out', true, () => update(ref(db('alice'), 'snoutfirst/pets/p1'), { status: 'walking', current_walker: 'alice' }));
await t('alice sets a made-up status', false, () => update(ref(db('alice'), 'snoutfirst/pets/p1'), { status: 'wandering' }));
await t('alice brings it home', true, () => update(ref(db('alice'), 'snoutfirst/pets/p1'), { status: 'home', current_walker: null }));
await t('alice hands the pet to bob (owner change)', false, () => update(ref(db('alice'), 'snoutfirst/pets/p1'), { owner_uid: 'bob' }));
await t('alice changes the created time', false, () => update(ref(db('alice'), 'snoutfirst/pets/p1'), { created_at: 1 }));
await t('extra unknown field', false, () => update(ref(db('alice'), 'snoutfirst/pets/p1'), { vip: true }));
await t('big photo in the database', false, () => update(ref(db('alice'), 'snoutfirst/pets/p1'), { photo_base64: 'data:image/jpeg;base64,' + 'A'.repeat(50000) }));
await t('name longer than 40', false, () => set(ref(db('alice'), 'snoutfirst/pets/p3'), pet('alice', { name: 'x'.repeat(41) })));
await t('empty name', false, () => set(ref(db('alice'), 'snoutfirst/pets/p3'), pet('alice', { name: '' })));
await t('bio longer than 200', false, () => set(ref(db('alice'), 'snoutfirst/pets/p3'), pet('alice', { bio: 'x'.repeat(201) })));
await t('9 tags', false, () => set(ref(db('alice'), 'snoutfirst/pets/p3'), pet('alice', { personality_tags: Array(9).fill('t') })));
await t('tag longer than 24', false, () => set(ref(db('alice'), 'snoutfirst/pets/p3'), pet('alice', { personality_tags: ['x'.repeat(25)] })));
await t('latitude out of range', false, () => set(ref(db('alice'), 'snoutfirst/pets/p3'), pet('alice', { home_lat: 123 })));
await t('name that is a number', false, () => set(ref(db('alice'), 'snoutfirst/pets/p3'), pet('alice', { name: 42 })));
await t('fake old created time', false, () => set(ref(db('alice'), 'snoutfirst/pets/p3'), pet('alice', { created_at: 5 })));
await t('missing required field', false, () => { const p = pet('alice'); delete p.status; return set(ref(db('alice'), 'snoutfirst/pets/p3'), p); });
await t('alice updates her walk totals', true, () => set(ref(db('alice'), 'snoutfirst/pets/p1/stats'), { lifetime_distance_km: 1.2, total_walks: 1, total_feedings: 0, last_walked: Date.now() - 1000 }));
await t('bob updates alice\'s totals', false, () => set(ref(db('bob'), 'snoutfirst/pets/p1/stats'), { lifetime_distance_km: 999, total_walks: 1, total_feedings: 0 }));
await t('negative walk total', false, () => update(ref(db('alice'), 'snoutfirst/pets/p1/stats'), { total_walks: -1 }));
await t('alice deletes her own pet', true, () => remove(ref(db('alice'), 'snoutfirst/pets/p1')));
await t('alice registers again', true, () => set(ref(db('alice'), 'snoutfirst/pets/p1'), pet('alice')));

console.log('— lost reports');
const lost = (uid, extra = {}) => ({ name: 'Ferajna', species: 'cat', lat: 51.505, lon: -0.09, lostAt: TS, active: true, owner: 'Rudy', owner_uid: uid, ...extra });
await t('alice reports her pet lost (pet id key)', true, () => set(ref(db('alice'), 'snoutfirst/lost/p1'), lost('alice')));
await t('alice reports a device-only pet (uid_name key)', true, () => set(ref(db('alice'), 'snoutfirst/lost/alice_rex'), lost('alice', { name: 'Rex' })));
await t('bob reports alice\'s pet as his', false, () => set(ref(db('bob'), 'snoutfirst/lost/p1'), lost('bob')));
await t('bob squats a key with alice\'s uid', false, () => set(ref(db('bob'), 'snoutfirst/lost/alice_luna'), lost('bob')));
await t('bob takes down alice\'s report', false, () => remove(ref(db('bob'), 'snoutfirst/lost/p1')));
await t('lost report with extra field', false, () => set(ref(db('alice'), 'snoutfirst/lost/alice_x'), lost('alice', { phone: '07700' })));
await t('signed-in visitor reads lost reports', true, () => get(ref(db('bob'), 'snoutfirst/lost')));
await t('alice takes her report down (found)', true, () => remove(ref(db('alice'), 'snoutfirst/lost/p1')));

console.log('— shared walks (only when the walker chooses to share)');
const walk = uid => ({ owner_uid: uid, pet_id: 'p1', pet_name: 'Ferajna', started_at: Date.now() - 600000, ended_at: TS, distance_km: 1.2, duration_mins: 10, path: [{ lat: 51.505, lng: -0.09 }, { lat: 51.506, lng: -0.091 }] });
await t('alice shares a walk', true, () => set(ref(db('alice'), 'snoutfirst/shared_walks/alice/w1'), walk('alice')));
await t('bob writes into alice\'s walks', false, () => set(ref(db('bob'), 'snoutfirst/shared_walks/alice/w2'), walk('bob')));
await t('route longer than 200 points', false, () => set(ref(db('alice'), 'snoutfirst/shared_walks/alice/w3'), { ...walk('alice'), path: Array(201).fill({ lat: 1, lng: 1 }) }));
await t('route of exactly 200 points', true, () => set(ref(db('alice'), 'snoutfirst/shared_walks/alice/w4'), { ...walk('alice'), path: Array(200).fill({ lat: 1, lng: 1 }) }));
await t('route point with extra data', false, () => set(ref(db('alice'), 'snoutfirst/shared_walks/alice/w5'), { ...walk('alice'), path: [{ lat: 1, lng: 1, t: 5 }] }));

console.log('— clown markers (SHOW ME)');
const clown = extra => ({ lat: 51.505, lng: -0.09, name: 'Rudy', emoji: '🤡', last_updated: TS, status: 'active', ...extra });
await t('alice shows herself', true, () => set(ref(db('alice'), 'clown_markers/snoutfirst_global/alice'), clown()));
await t('bob moves alice\'s clown', false, () => set(ref(db('bob'), 'clown_markers/snoutfirst_global/alice'), clown()));
await t('clown with fake timestamp', false, () => set(ref(db('alice'), 'clown_markers/snoutfirst_global/alice'), clown({ last_updated: 1 })));
await t('clown with extra field', false, () => set(ref(db('alice'), 'clown_markers/snoutfirst_global/alice'), clown({ address: 'x' })));
await t('signed-in visitor sees clowns', true, () => get(ref(db('bob'), 'clown_markers/snoutfirst_global')));
await t('signed-out visitor sees clowns', false, () => get(ref(anon, 'clown_markers/snoutfirst_global')));
await t('alice hides herself', true, () => remove(ref(db('alice'), 'clown_markers/snoutfirst_global/alice')));

console.log('— feeding log');
const feed = uid => ({ fed_by_uid: uid, fed_by_name: 'Bob', timestamp: TS, food_type: 'dry', food_brand: '', amount: '1 bowl', notes: '' });
await t('bob logs feeding alice\'s pet', true, () => set(ref(db('bob'), 'feeding_log/p1/f1'), feed('bob')));
await t('bob logs a feeding in carol\'s name', false, () => set(ref(db('bob'), 'feeding_log/p1/f2'), feed('carol')));
await t('feeding for a pet that does not exist', false, () => set(ref(db('bob'), 'feeding_log/nope/f3'), feed('bob')));
await t('carol deletes bob\'s feeding', false, () => remove(ref(db('carol'), 'feeding_log/p1/f1')));
await t('bob edits his feeding afterwards', false, () => update(ref(db('bob'), 'feeding_log/p1/f1'), { amount: '10 bowls' }));
await t('bob deletes his own feeding', true, () => remove(ref(db('bob'), 'feeding_log/p1/f1')));

console.log('— notifications');
const note = (by, extra = {}) => ({ type: 'feeding', pet_id: 'p1', pet_name: 'Ferajna', by_uid: by, by_name: 'Bob', message: 'Ferajna was fed by Bob', timestamp: TS, read: false, ...extra });
await t('bob notifies alice', true, () => set(ref(db('bob'), 'notifications/alice/n1'), note('bob')));
await t('bob pretends to be carol', false, () => set(ref(db('bob'), 'notifications/alice/n2'), note('carol')));
await t('bob reads alice\'s notifications', false, () => get(ref(db('bob'), 'notifications/alice')));
await t('bob overwrites his note later', false, () => set(ref(db('bob'), 'notifications/alice/n1'), note('bob', { message: 'changed' })));
await t('message longer than 160', false, () => set(ref(db('bob'), 'notifications/alice/n3'), note('bob', { message: 'x'.repeat(161) })));
await t('alice reads her notifications', true, () => get(ref(db('alice'), 'notifications/alice')));
await t('alice marks one read', true, () => update(ref(db('alice'), 'notifications/alice/n1'), { read: true }));

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
