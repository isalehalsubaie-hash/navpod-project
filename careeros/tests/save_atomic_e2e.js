/* Hosted build: a save interrupted part-way must not corrupt the stored copy, and data that cannot be read
   must never be overwritten. The mock private store lives in the test process (not localStorage), so what is
   stored is exactly what the page has written, and it can be told to stop accepting writes after N of them.
   Usage: node tests/save_atomic_e2e.js [path to CareerOS_web.html] */
const { chromium } = require('playwright'); const path = require('path');
const ok = (n, c, i) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : '')); if (!c) process.exitCode = 1; };
(async () => {
  const store = new Map(); let writes = 0, failAfter = Infinity;
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.exposeFunction('__dbGet', (k) => (store.has(k) ? JSON.parse(store.get(k)) : null));
  await ctx.exposeFunction('__dbSet', (k, v) => { if (writes >= failAfter) return 'FAIL'; writes++; store.set(k, JSON.stringify(v)); return 'OK'; });
  await ctx.addInitScript(() => {
    window.CAREEROS_AUTO_CONFIRM = true;
    const db = { collection: (p) => ({ doc: (k) => ({ get: async () => { const v = await window.__dbGet(p + '/' + k); return v ? { exists: true, data: () => v } : { exists: false, data: () => undefined }; }, set: async (v) => { if ((await window.__dbSet(p + '/' + k, v)) === 'FAIL') throw new Error('simulated page close'); } }) }) };
    const api = { db, user: { id: async () => 'u1' } }; window.claude = { use: (n) => Promise.resolve(api[n] || null) };
  });
  const p = await ctx.newPage(); const url = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '../CareerOS_web.html'));
  const blocked = () => p.evaluate(() => (typeof saveBlocked !== 'undefined' ? saveBlocked : ''));
  await p.goto(url); await p.waitForSelector('#nav a', { timeout: 60000 }); await p.waitForTimeout(500);
  await p.evaluate(async () => { addToTracker('CO-0001'); await save(true); });
  // interrupted save: a large change, but the store stops accepting writes after the first part
  writes = 0; failAfter = 1;
  await p.evaluate(async () => { addToTracker('CO-0004'); S.profile.personal.name = { value: 'X'.repeat(700000), status: 'confirmed_user' }; await save(true); });
  failAfter = Infinity;
  await p.reload(); await p.waitForSelector('#nav a', { timeout: 60000 }); await p.waitForTimeout(800);
  const apps = await p.evaluate(() => S.applications.map((a) => a.jobId).join());
  ok('Interrupted save leaves the previous complete copy readable', apps === 'CO-0001' && !(await blocked()), apps);
  // corrupt the store: meta points to a part that does not exist
  const mk = [...store.keys()].find((k) => /careeros_meta$/.test(k)); const m = JSON.parse(store.get(mk));
  store.set(mk, JSON.stringify({ ...m, n: m.n + 1, slots: [...(m.slots || new Array(m.n).fill('')), 'a'] }));
  const before = JSON.stringify([...store]);
  await p.reload(); await p.waitForSelector('#nav a', { timeout: 60000 }); await p.waitForTimeout(800);
  await p.evaluate(async () => { addToTracker('CO-0009'); await save(true); }); await p.waitForTimeout(1500);
  ok('Unreadable data is never overwritten', before === JSON.stringify([...store]) && !!(await blocked()));
  ok('User is told why nothing is saved', /could not be read/.test(await blocked()));
  await b.close();
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
