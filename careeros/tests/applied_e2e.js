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
  // Quick wins: confirming a skill adds it to the profile and removes it from the list
  await p.evaluate(() => go('#/profile')); await p.waitForTimeout(400);
  const qk = await p.getAttribute('[data-act="qwYes"] >> nth=0', 'data-k');
  await p.click('[data-act="qwYes"] >> nth=0'); await p.waitForTimeout(400);
  ok('Quick win confirmed into profile skills', await p.evaluate((k) => S.profile.skills.some((s) => s.kid === k && s.status === 'confirmed_user'), qk), qk);
  ok('Confirmed quick win leaves the list', !(await p.$(`[data-act="qwYes"][data-k="${qk}"]`)));
  const nk = await p.getAttribute('[data-act="qwNo"] >> nth=0', 'data-k'); await p.click('[data-act="qwNo"] >> nth=0'); await p.waitForTimeout(300);
  ok('Dismissed quick win hidden, not added', !(await p.$(`[data-act="qwYes"][data-k="${nk}"]`)) && await p.evaluate((k) => !S.profile.skills.some((s) => s.kid === k), nk));
  // Coursework line offered for a maintenance advert, never for one that does not ask for it
  const r = await p.evaluate(() => { const out = {}; for (const id of ['CO-0010', 'CO-0001']) { const j = jobById(id); const o = E.optimizeSuggestions(j, C(j).a, S.master.model, S.profile, { evidenceIndex: evidenceIndex() }); out[id] = (o.suggestions.find((s) => s.type === 'Coursework') || {}).proposed || ''; } return out; });
  ok('Coursework line for a maintenance advert', /Maintenance Engineering \(A\+\)/.test(r['CO-0010']), r['CO-0010']);
  ok('No pasted coursework when the advert does not ask', !/Maintenance/.test(r['CO-0001']) || /maint/i.test(await p.evaluate(() => jobById('CO-0001').description)), r['CO-0001']);
  ok('No page errors', !errs.length, errs.join(' | '));
  await b.close();
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
