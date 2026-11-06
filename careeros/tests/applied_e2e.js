/* Jobs already applied to are not suggested again (Discover, Dashboard, AI shortlist) but stay in the tracker. */
const { chromium } = require('playwright'); const path = require('path');
const ok = (n, c, i) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : '')); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1360, height: 950 } });
  await ctx.addInitScript(() => { window.CAREEROS_AUTO_CONFIRM = true; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '../CareerOS.html')); await p.waitForSelector('#nav a', { timeout: 60000 });
  await p.evaluate(() => go('#/discover')); await p.waitForTimeout(400);
  const top = await p.evaluate(() => filteredJobs()[0].jobId);
  await p.evaluate((id) => { const a = addToTracker(id); a.status = 'Applied'; a.appliedDate = TODAY(); invalidate(); go('#/discover'); }, top); await p.waitForTimeout(400);
  ok('Applied job hidden from Discover', await p.evaluate((id) => !filteredJobs().some((j) => j.jobId === id), top), top);
  ok('Discover says how many are hidden', /Hiding 1 job you already applied to/.test(await p.textContent('#content')));
  await p.click('[data-act="toggleApplied"]'); await p.waitForTimeout(300);
  ok('Show them brings it back', await p.evaluate((id) => filteredJobs().some((j) => j.jobId === id), top));
  await p.click('[data-act="toggleApplied"]'); await p.waitForTimeout(300);
  await p.evaluate(() => go('#/dashboard')); await p.waitForTimeout(400);
  ok('Not in Dashboard suggestions', !(await p.$(`.move a[href$="${top}"]`)) && !(await p.evaluate((id) => nextMoves().some((m) => m.jobId === id && m.kind === 'apply'), top)));
  ok('Still in tracker', await p.evaluate((id) => appFor(id).status === 'Applied', top));
  ok('No page errors', !errs.length, errs.join(' | '));
  await b.close();
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
