/* CPU-profile specific interactions (4x throttle) and print the top self-time functions. */
const { chromium, devices } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(() => { window.CAREEROS_AUTO_CONFIRM = true; });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  const top = (prof, label) => {
    const idx = {}; prof.nodes.forEach((n) => (idx[n.id] = n)); const self = {};
    prof.samples.forEach((s, i) => { const n = idx[s]; const k = (n.callFrame.functionName || '(anon)') + ':' + n.callFrame.lineNumber; self[k] = (self[k] || 0) + (prof.timeDeltas[i] || 0); });
    console.log('--- ' + label); Object.entries(self).sort((a, c) => c[1] - a[1]).slice(0, 10).forEach(([k, v]) => console.log(String(Math.round(v / 1000)).padStart(6) + 'ms ' + k));
  };
  await cdp.send('Profiler.start');
  await p.goto('file://' + path.resolve(__dirname, '../CareerOS.html')); await p.waitForSelector('#nav a', { timeout: 120000 });
  top((await cdp.send('Profiler.stop')).profile, 'boot');
  await cdp.send('Profiler.start'); await p.evaluate(() => go('#/builder/CO-0003')); await p.waitForTimeout(200); top((await cdp.send('Profiler.stop')).profile, 'open builder');
  await p.evaluate(() => go('#/profile')); await p.waitForTimeout(300);
  await cdp.send('Profiler.start'); await p.fill('input[data-p="personal.nationality"]', 'Saudi'); await p.dispatchEvent('input[data-p="personal.nationality"]', 'change'); await p.waitForTimeout(500); top((await cdp.send('Profiler.stop')).profile, 'profile edit');
  await p.evaluate(() => go('#/discover')); await p.waitForTimeout(300);
  await cdp.send('Profiler.start'); await p.evaluate(() => { const d = document.getElementById('fdet'); if (d) d.open = true; }); await p.fill('input[data-inp="fq"]', 'engineer'); await p.waitForTimeout(700); top((await cdp.send('Profiler.stop')).profile, 'search');
  await b.close();
})();
