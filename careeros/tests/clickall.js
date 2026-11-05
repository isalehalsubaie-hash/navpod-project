/* Bug hunt: on every screen, click every visible button/action once (fresh page state per screen),
   and report page errors, "Something went wrong" screens and handlers that throw (toast "Error:").
   Usage: node tests/clickall.js [web] [mobile] */
const { chromium, devices } = require('playwright'); const path = require('path');
const web = process.argv.includes('web'), mobile = process.argv.includes('mobile');
const SKIP = new Set(['wipe', 'reseed', 'restore', 'uploadCV', 'jdFile', 'jdImages', 'aiSend', 'aiAsk', 'gmScan', 'gmImport', 'recheck', 'refresh', 'runSearch', 'testCompanion', 'printVersion', 'printDoc']);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext(mobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1360, height: 950 } });
  await ctx.addInitScript((isWeb) => {
    window.CAREEROS_AUTO_CONFIRM = true; window.open = () => ({ document: { write() {}, close() {} } });
    if (isWeb) { const mem = {}; const db = { collection: (p) => ({ doc: (k) => ({ get: async () => (mem[p + k] ? { exists: true, data: () => mem[p + k] } : { exists: false }), set: async (v) => { mem[p + k] = v; } }) }) };
      const api = { db, user: { id: async () => 'u' }, downloads: { save: async () => {} } }; window.claude = { use: (n) => Promise.resolve(api[n] || null) }; }
  }, web);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  p.on('download', (d) => d.cancel().catch(() => {}));
  const url = 'file://' + path.resolve(__dirname, web ? '../CareerOS_web.html' : '../CareerOS.html');
  await p.goto(url); await p.waitForSelector('#nav a', { timeout: 60000 });
  // prepare some state so conditional buttons exist
  await p.evaluate(async () => { addToTracker('CO-0003'); S.compareIds = ['CO-0001', 'CO-0003']; go('#/builder/CO-0003'); });
  await p.waitForTimeout(300); await p.click('[data-act="genPkg"]').catch(() => {}); await p.waitForTimeout(300);
  await p.evaluate(() => go('#/optimize/CO-0003')); await p.waitForTimeout(300); await p.click('[data-act="optimize"]').catch(() => {}); await p.waitForTimeout(300);
  await p.click('[data-act="decide"][data-v="accepted"] >> nth=0').catch(() => {}); await p.waitForTimeout(300); await p.click('[data-act="makeVersion"]').catch(() => {}); await p.waitForTimeout(1500);
  await p.evaluate(() => go('#/interview/CO-0003')); await p.waitForTimeout(300); await p.click('[data-act="ivGen"]').catch(() => {}); await p.waitForTimeout(400);
  const routes = ['dashboard', 'discover', 'job/CO-0003', 'compare', 'analysis', 'watchlist', 'company/Hitachi%20Energy', 'cv', 'optimize/CO-0003', 'optimize/TRACK-ME', 'builder/CO-0003', 'builder', 'tracker', 'interview/CO-0003', 'profile', 'devmap', 'analytics', 'market', 'keywords', 'ai', 'gmail', 'settings'];
  const problems = []; let clicks = 0;
  for (const r of routes) {
    const go = async () => { await p.evaluate(() => { const m = document.getElementById('modal'); if (m) m.remove(); const a = document.getElementById('askmodal'); if (a) a.remove(); }); await p.evaluate((h) => go('#/' + h), r); await p.waitForTimeout(r === 'cv' ? 900 : 250); };
    await go();
    if (await p.$('text=Something went wrong')) { problems.push(r + ': screen failed: ' + (await p.textContent('#content')).slice(0, 200)); continue; }
    const acts = await p.$$eval('#content [data-act], #topActions [data-act], #content [data-chg]', (els) => els.filter((e) => e.offsetParent !== null || e.closest('#topActions')).map((e, i) => ({ act: e.dataset.act || e.dataset.chg, chg: !!e.dataset.chg, tag: e.tagName, idx: i, sel: e.dataset.act ? '[data-act="' + e.dataset.act + '"]' : '[data-chg="' + e.dataset.chg + '"]', ds: JSON.stringify(e.dataset) })));
    const seen = new Set();
    for (const a of acts) {
      if (SKIP.has(a.act) || seen.has(a.act + a.ds)) continue; seen.add(a.act + a.ds);
      if (seen.size > 40) break;
      await go();
      const before = errs.length;
      try {
        await p.evaluate((x) => {
          const els = [...document.querySelectorAll('#content [data-act], #topActions [data-act], #content [data-chg]')].filter((e) => JSON.stringify(e.dataset) === x.ds);
          const e = els[0]; if (!e) return;
          if (x.chg) { if (e.tagName === 'SELECT' && e.options.length > 1) { e.selectedIndex = (e.selectedIndex + 1) % e.options.length; } else if (e.type === 'checkbox') e.checked = !e.checked; else if (e.type !== 'file') e.value = e.type === 'date' ? '2026-11-20' : e.type === 'month' ? '2027-01' : 'test'; e.dispatchEvent(new Event('change', { bubbles: true })); }
          else e.click();
        }, a);
        clicks++;
        await p.waitForTimeout(350);
        const toastErr = await p.$$eval('.toast', (t) => t.map((x) => x.textContent).filter((x) => /^Error:/.test(x)));
        if (toastErr.length) problems.push(r + ' ' + a.act + ': ' + toastErr.join(' | '));
        if (await p.$('#content >> text=Something went wrong')) problems.push(r + ' ' + a.act + ': screen crashed after click');
        if (errs.length > before) problems.push(r + ' ' + a.act + ': page error ' + errs.slice(before).join(' | '));
        if (await p.$('#modal')) { const mb = await p.$$('#modal [data-act]'); for (const x of mb.slice(0, 1)) { const act = await x.getAttribute('data-act'); if (!SKIP.has(act) && act !== 'closeModal') { await x.click().catch(() => {}); await p.waitForTimeout(250); } } }
      } catch (e) { problems.push(r + ' ' + a.act + ': ' + e.message.slice(0, 120)); }
    }
  }
  console.log((web ? 'hosted' : 'file') + (mobile ? ' iPhone' : ' desktop') + ': ' + clicks + ' actions clicked across ' + routes.length + ' screens');
  console.log(problems.length ? 'PROBLEMS:\n' + [...new Set(problems)].join('\n') : 'No problems found');
  await b.close();
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
