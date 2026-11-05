/* Audit helper: render each route at iPhone size, report horizontal overflow and save screenshots. */
const { chromium, devices } = require('playwright'); const path = require('path');
(async () => {
  const out = process.argv[2]; const file = process.argv[3] || '../CareerOS.html';
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(() => { window.CAREEROS_AUTO_CONFIRM = true; });
  const p = await ctx.newPage(); const url = 'file://' + path.resolve(__dirname, file);
  await p.goto(url); await p.waitForSelector('#nav a');
  const routes = (process.argv[4] || 'dashboard,discover,job/CO-0003,analysis,profile,cv,optimize/CO-0003,builder/CO-0003,tracker,market,watchlist,keywords,settings').split(',');
  for (const r of routes) {
    await p.evaluate((h) => go('#/' + h), r); await p.waitForTimeout(r.startsWith('cv') ? 2000 : 700);
    const ow = await p.evaluate(() => document.documentElement.scrollWidth);
    const wide = await p.evaluate(() => [...document.querySelectorAll('#content *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 2).slice(0, 3).map((e) => e.tagName + '.' + (e.className || '').toString().slice(0, 20)));
    console.log(r.padEnd(18), 'scrollWidth', ow, ow > 392 ? 'OVERFLOW ' + wide.join(' ') : '');
    if (out) await p.screenshot({ path: path.join(out, 'm_' + r.replace(/\W/g, '_') + '.png') });
  }
  await b.close();
})();
