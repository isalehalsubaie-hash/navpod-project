const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  const url = 'file://' + path.resolve(__dirname, '../CareerOS.html');
  await p.goto(url); await p.waitForSelector('#nav a', { timeout: 20000 });
  const routes = ['dashboard','discover','analysis','profile','cv','optimize','builder','tracker','market','watchlist','keywords','settings','ai','compare','interview','devmap','analytics','gmail','optimize/TRACK-ME','company/Hitachi%20Energy','job/CO-0001','builder/CO-0001','interview/CO-0001'];
  for (const r of routes) {
    await p.goto(url + '#/' + r); await p.waitForTimeout(r === 'cv' ? 2500 : 600);
    const t = await p.textContent('#title'); const bad = await p.$('text=Something went wrong');
    console.log(r.padEnd(10), '|', t, bad ? ' <<< ERROR' : '');
    if (bad) console.log(await p.textContent('#content'));
  }
  await p.screenshot({ path: process.argv[2] || '/tmp/shot.png', fullPage: false });
  console.log('errors:', errs.length); errs.slice(0, 15).forEach((e) => console.log(e));
  await b.close();
})();
