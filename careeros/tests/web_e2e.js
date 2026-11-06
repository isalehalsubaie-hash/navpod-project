/* Tests CareerOS_web.html under a simulated artifact host: confirm() blocked, no IndexedDB,
   mock claude.use("db" | "user" | "downloads"). State must survive a reload via the mock db. */
const { chromium } = require('playwright'); const path = require('path');
const ok = (n, c, i) => console.log((c ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : ''));
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const store = new Map(); // mock private store kept in the test process
  await ctx.exposeFunction('__dbGet', (k) => (store.has(k) ? JSON.parse(store.get(k)) : null)); await ctx.exposeFunction('__dbSet', (k, v) => { store.set(k, JSON.stringify(v)); });
  await ctx.addInitScript(() => {
    window.confirm = () => false; window.open = () => null;
    try { Object.defineProperty(window, 'indexedDB', { value: undefined }); } catch (e) {}
    
    
    window.__downloads = [];
    const db = { collection: (p) => ({ doc: (k) => ({ get: async () => { const v = await window.__dbGet(p + '/' + k); return v ? { exists: true, data: () => v } : { exists: false, data: () => undefined }; }, set: async (v) => { await window.__dbSet(p + '/' + k, v); } }) }) };
    const api = { db, user: { id: async () => 'u123' }, downloads: { save: async ({ filename, data }) => { window.__downloads.push(filename); } } };
    window.claude = { use: (n) => new Promise((r) => setTimeout(() => r(api[n] || null), 50)) };
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const url = 'file://' + path.resolve(__dirname, '../CareerOS_web.html');
  await p.goto(url); await p.waitForSelector('#nav a', { timeout: 30000 }); await p.waitForTimeout(800);
  await p.click('#tabbar a[href="#/discover"]'); await p.waitForTimeout(500);
  ok('Internal routing to Discover', (await p.textContent('#title')) === 'Discover Opportunities');
  ok('URL hash untouched', !(await p.evaluate(() => location.hash)));
  const cardT = (await p.textContent('.job a.t >> nth=1')).trim(); await p.click('.job a.t >> nth=1'); await p.waitForTimeout(500); ok('Open job via card link', (await p.textContent('#title')).trim() === cardT, await p.textContent('#title'));
  await p.evaluate(() => go('#/job/CO-0001')); await p.waitForTimeout(500);
  await p.click('#moreBtn'); await p.click('#actmenu >> text=Analyze and tailor my CV'); await p.waitForTimeout(500);
  await p.click('[data-act="optimize"]'); await p.waitForTimeout(600); await p.click('[data-act="acceptAll"]'); await p.waitForTimeout(500);
  await p.click('[data-act="makeVersion"]'); await p.waitForTimeout(600);
  ok('In-page confirm shown (browser confirm blocked)', !!(await p.$('#askmodal')));
  await p.click('#ask-ok'); await p.waitForTimeout(2500);
  ok('Tailored version created', /Integrity check passed/.test(await p.textContent('#content')));
  await p.click('.card:has-text("Versions for this job") [data-act="dlVersion"]'); await p.waitForTimeout(800);
  ok('Download via platform API', (await p.evaluate(() => window.__downloads)).length === 1, (await p.evaluate(() => window.__downloads)).join());
  await p.evaluate(() => go('#/tracker')); await p.waitForTimeout(500);
  await p.selectOption('select[data-k="status"]', 'Applied'); await p.waitForTimeout(400); await p.click('#ask-ok'); await p.waitForTimeout(400);
  await p.evaluate(() => go('#/profile')); await p.waitForTimeout(400);
  await p.fill('input[data-p="personal.availability"]', 'From February 2027'); await p.dispatchEvent('input[data-p="personal.availability"]', 'change'); await p.waitForTimeout(2500);
  const stored = [...store.keys()];
  ok('State written to private per-person store', stored.some((k) => k.startsWith('data/users/u123/careeros_')), stored.join(','));
  const meta = JSON.parse(store.get('data/users/u123/careeros_meta')); const size = Array.from({ length: meta.n }, (_, i) => JSON.parse(store.get('data/users/u123/careeros_' + i + (meta.slots ? '_' + meta.slots[i] : ''))).s.length).reduce((a, b) => a + b, 0); ok('Compact state size', size < 600000, size + ' chars');
  await p.reload(); await p.waitForSelector('#nav a', { timeout: 30000 }); await p.waitForTimeout(1500);
  await p.evaluate(() => go('#/tracker')); await p.waitForTimeout(500);
  ok('After reload: tracker restored from store', (await p.$eval('select[data-k="status"]', (e) => e.value)) === 'Applied');
  await p.evaluate(() => go('#/profile')); await p.waitForTimeout(400);
  ok('After reload: availability restored', (await p.$eval('input[data-p="personal.availability"]', (e) => e.value)) === 'From February 2027');
  ok('After reload: 176 research jobs present', await p.evaluate(() => S.jobs.length) >= 176);
  ok('After reload: master CV readable', await p.evaluate(() => !!(S.master.model && S.master.model.paragraphs.length === 53)));
  await p.evaluate(() => go('#/settings')); await p.waitForTimeout(300); await p.click('[data-act="wipe"]'); await p.waitForTimeout(300);
  await p.click('#ask-no'); await p.waitForTimeout(300); ok('Cancel on in-page confirm keeps data', await p.evaluate(() => S.applications.length) === 1);
  ok('No page errors', errs.length === 0, errs.join(' | '));
  await b.close();
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
