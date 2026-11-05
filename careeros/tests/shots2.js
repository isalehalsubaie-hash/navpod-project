/* Screenshots for visual review: node tests/shots2.js <outdir> <theme> <route,...> [desktop] */
const { chromium, devices } = require('playwright'); const path = require('path');
(async () => {
  const [out, theme, routes, desk] = process.argv.slice(2);
  const b = await chromium.launch();
  const ctx = await b.newContext(desk ? { viewport: { width: 1400, height: 1000 } } : { ...devices['iPhone 13'] });
  await ctx.addInitScript((t) => { window.CAREEROS_AUTO_CONFIRM = true; window.__theme = t; }, theme);
  const p = await ctx.newPage(); await p.goto('file://' + path.resolve(__dirname, '../CareerOS.html')); await p.waitForSelector('#nav a');
  await p.evaluate(() => { S.settings.theme = window.__theme; applyTheme(); });
  for (const r of routes.split(',')) { await p.evaluate((h) => go('#/' + h), r); await p.waitForTimeout(900); await p.screenshot({ path: path.join(out, (desk ? 'd_' : 'm_') + theme + '_' + r.replace(/\W/g, '_') + '.png') }); }
  await b.close();
})();
