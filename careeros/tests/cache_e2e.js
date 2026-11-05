/* The on-device analysis cache must never change results: compare a cold boot with a warm boot,
   and check that editing an advert's text (same length) refreshes its analysis. */
const { chromium } = require('playwright'); const path = require('path');
const ok = (n, c, i) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : '')); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(); await ctx.addInitScript(() => { window.CAREEROS_AUTO_CONFIRM = true; });
  const p = await ctx.newPage(); const url = 'file://' + path.resolve(__dirname, '../CareerOS.html');
  const snap = () => p.evaluate(() => JSON.stringify(S.jobs.map((j) => { const c = C(j); return [j.jobId, c.el.label, c.m.total, c.v.total, c.cov && c.cov.keywordCoverage, c.a.keywords.length, c.a.requirements.length]; })));
  await p.goto(url); await p.waitForSelector('#nav a'); const cold = await snap(); await p.waitForTimeout(10500);
  await p.reload(); await p.waitForSelector('#nav a'); ok('Warm boot loaded cached analyses', await p.evaluate(() => acache.size > 200));
  const warm = await snap(); ok('Warm boot results identical to cold boot', cold === warm);
  const before = await p.evaluate(() => C(jobById('CO-0003')).a.keywords.map((k) => k.id).join());
  await p.evaluate(() => { const j = jobById('CO-0003'); j.description = j.description.replace('Systems Engineering', 'Mechanical Design!!'); invalidate(j.jobId); });
  const after = await p.evaluate(() => C(jobById('CO-0003')).a.keywords.map((k) => k.id).join());
  ok('Edited advert (same length) re-analysed', before !== after && /mechdesign/.test(after));
  await b.close();
})();
