const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ acceptDownloads: true }); const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const url = 'file://' + path.resolve(__dirname, '../CareerOS.html');
  await p.goto(url + '#/optimize/CO-0010'); await p.waitForSelector('#nav a'); await p.waitForTimeout(800);
  await p.click('[data-act="optimize"]'); await p.waitForTimeout(500); await p.click('[data-act="acceptAll"]'); await p.waitForTimeout(500);
  await p.click('[data-act="makeVersion"]'); await p.waitForTimeout(2000);
  const [d] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('[data-act="pdfVersion"]')]);
  const f = path.join(__dirname, 'out', d.suggestedFilename()); await d.saveAs(f);
  console.log('PDF via companion:', path.basename(f), fs.statSync(f).size, 'bytes', fs.readFileSync(f).slice(0, 5).toString());
  await p.goto(url + '#/settings'); await p.waitForTimeout(500); await p.click('[data-act="testCompanion"]'); await p.waitForTimeout(1500); console.log('Settings test:', await p.textContent('#compStatus'));
  await p.goto(url + '#/discover'); await p.waitForTimeout(500); await p.click('[data-act="refresh"]'); await p.waitForTimeout(1500); console.log('Refresh:', (await p.textContent('#modal')).slice(0, 120));
  await p.goto(url + '#/job/CO-0003'); await p.waitForTimeout(500); await p.click('[data-act="recheck"]'); await p.waitForTimeout(8000); console.log('Recheck verification:', (await p.textContent('#content')).match(/Re-checked[^.]*\./)?.[0]);
  await b.close();
})();
