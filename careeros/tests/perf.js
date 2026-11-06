/* Performance check on an iPhone-sized viewport with the CPU throttled 4x (rough phone approximation).
   Usage: node tests/perf.js [file] */
const { chromium, devices } = require('playwright'); const path = require('path');
(async () => {
  const file = process.argv[2] || '../CareerOS.html';
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(() => { window.CAREEROS_AUTO_CONFIRM = true; });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now(); await p.goto('file://' + path.resolve(__dirname, file)); await p.waitForSelector('#nav a', { timeout: 120000 });
  const boot = Date.now() - t0;
  const time = async (label, fn) => { const s = Date.now(); await fn(); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))); const ms = Date.now() - s; console.log(label.padEnd(34), String(ms).padStart(6), 'ms'); return ms; };
  console.log('boot to first screen'.padEnd(34), String(boot).padStart(6), 'ms');
  const res = { boot };
  for (const r of ['dashboard', 'discover', 'job/CO-0001', 'compare', 'cv', 'optimize/CO-0001', 'builder/CO-0001', 'tracker', 'interview', 'devmap', 'analytics', 'market', 'watchlist', 'keywords', 'profile', 'ai', 'settings', 'discover']) res[r] = await time('open ' + r, () => p.evaluate((h) => go('#/' + h), r));
  res.filter = await time('Discover: filter by Riyadh', () => p.click('[data-act="cityChip"][data-c="Riyadh"]'));
  res.search = await time('Discover: type search "engineer"', async () => { await p.evaluate(() => { const d = document.getElementById('fdet'); if (d) d.open = true; }); await p.fill('input[data-inp="fq"]', 'engineer'); await p.waitForTimeout(400); });
  await p.evaluate(() => go('#/profile'));
  res.profileEdit = await time('Profile: change nationality', async () => { await p.fill('input[data-p="personal.nationality"]', 'Saudi'); await p.dispatchEvent('input[data-p="personal.nationality"]', 'change'); });
  res.afterEdit = await time('Dashboard after profile edit', () => p.evaluate(() => go('#/dashboard')));
  await p.evaluate(() => go('#/optimize/CO-0009')); await p.waitForTimeout(300);
  res.optimize = await time('Optimizer: generate suggestions', () => p.click('[data-act="optimize"]'));
  res.accept = await time('Optimizer: accept one', () => p.click('[data-act="decide"][data-v="accepted"] >> nth=0'));
  const worst = Object.entries(res).filter(([k]) => k !== 'boot').sort((a, b) => b[1] - a[1]).slice(0, 3);
  console.log('slowest:', worst.map(([k, v]) => k + ' ' + v + 'ms').join(', '));
  require('fs').writeFileSync(path.join(__dirname, 'out_perf.json'), JSON.stringify(res));
  await b.close();
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
