/* Screenshot of the CV Optimizer with two accepted suggestions (visual check). Usage: node tests/shot_optimizer.js out.png */
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 1100 } }); p.on('dialog', (d) => d.accept());
  await p.goto('file://' + path.resolve(__dirname, '../CareerOS.html') + '#/optimize/CO-0009'); await p.waitForSelector('#nav a'); await p.waitForTimeout(800);
  await p.click('[data-act="optimize"]'); await p.waitForTimeout(600);
  for (let i = 0; i < 2; i++) { const btn = (await p.$$('[data-act="decide"][data-v="accepted"]'))[0]; if (btn) { await btn.click(); await p.waitForTimeout(300); } }
  await p.screenshot({ path: process.argv[2] }); await b.close();
})();
