const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const url = 'file://' + path.resolve(__dirname, '../CareerOS.html');
  const out = process.argv[2];
  await p.goto(url); await p.waitForSelector('#nav a');
  for (const r of process.argv.slice(3)) { await p.goto(url + '#/' + r); await p.waitForTimeout(1500); await p.screenshot({ path: out + '/' + r.replace(/\W/g, '_') + '.png' }); }
  await b.close();
})();
