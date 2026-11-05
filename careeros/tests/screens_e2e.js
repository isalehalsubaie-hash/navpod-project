/* Screenshot import: simulated vision model on the hosted build.
   Usage: node tests/screens_e2e.js <image.png> */
const { chromium, devices } = require('playwright'); const path = require('path');
const ok = (n, c, i) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : '')); if (!c) process.exitCode = 1; };
(async () => {
  const img = path.resolve(process.argv[2]);
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(() => {
    window.confirm = () => false; window.__mode = 'confirmation'; window.__imgs = 0;
    const mem = {}; const db = { collection: (p) => ({ doc: (k) => ({ get: async () => (mem[p + k] ? { exists: true, data: () => mem[p + k] } : { exists: false, data: () => undefined }), set: async (v) => { mem[p + k] = v; } }) }) };
    const sample = async () => ({ text: 'x' });
    sample.limits = async () => ({ images: true });
    sample.json = async (prompt, opts) => { window.__imgs = (opts.images || []).length; window.__imgTypes = (opts.images || []).map((x) => x.type);
      return window.__mode === 'confirmation'
        ? { title: 'KPMG COOP Program - Riyadh, Jeddah & Khobar (12091)', company: 'KPMG', location: 'Riyadh, Jeddah & Khobar', employmentType: 'Internship', deadline: '', url: '', reference: '12091', description: '', pageKind: 'application_confirmation', unreadable: '' }
        : { title: 'Graduate Mechanical Engineer', company: 'Example Industrial Co', location: 'Riyadh, Saudi Arabia', employmentType: 'Full-time', deadline: '2026-11-30', url: 'https://example.com/job/1', reference: 'R-77', description: 'Requirements:\n- Bachelor in Mechanical Engineering\n- 0-2 years experience\n- AutoCAD and HVAC knowledge required\nResponsibilities:\n- Review MEP shop drawings', pageKind: 'advert', unreadable: '' }; };
    const api = { db, user: { id: async () => 'u1' }, sample, downloads: { save: async () => {} } };
    window.claude = { use: (n) => new Promise((r) => setTimeout(() => r(api[n] || null), 20)) };
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '../CareerOS_web.html')); await p.waitForSelector('#nav a', { timeout: 30000 }); await p.waitForTimeout(500);
  await p.evaluate(() => go('#/analysis')); await p.waitForTimeout(500);
  ok('Screenshot button visible on iPhone', await p.isVisible('text=📷 Add from screenshots'));
  await p.setInputFiles('#nj_img', [img]); await p.waitForTimeout(1500);
  ok('Image sent to the model, downscaled to JPEG', (await p.evaluate(() => window.__imgs)) === 1 && (await p.evaluate(() => window.__imgTypes[0])) === 'image/jpeg');
  ok('Confirmation page detected and matched to CO-0288', /application confirmation/.test(await p.textContent('#modal')) && /CO-0288/.test(await p.textContent('#modal')), (await p.textContent('#modal')).slice(0, 160));
  await p.click('[data-act="markFromShot"]'); await p.waitForTimeout(300); await p.click('#ask-ok'); await p.waitForTimeout(600);
  ok('Marked Applied in tracker with follow-up', await p.evaluate(() => { const a = S.applications.find((x) => x.jobId === 'CO-0288'); return a && a.status === 'Applied' && !!a.followUp; }));
  await p.evaluate(() => { window.__mode = 'advert'; go('#/analysis'); }); await p.waitForTimeout(500);
  await p.setInputFiles('#nj_img', [img, img]); await p.waitForTimeout(1500);
  ok('Advert fields filled from screenshots', (await p.inputValue('#nj_title')) === 'Graduate Mechanical Engineer' && (await p.inputValue('#nj_deadline')) === '2026-11-30' && /AutoCAD/.test(await p.inputValue('#nj_desc')));
  ok('Two screenshots sent together', (await p.evaluate(() => window.__imgs)) === 2);
  await p.click('[data-act="analyseNew"]'); await p.waitForTimeout(800);
  ok('Job analysed and labelled as screenshot import', await p.evaluate(() => { const j = S.jobs[S.jobs.length - 1]; return j.title === 'Graduate Mechanical Engineer' && /screenshot/i.test(j.verificationLevel) && j.deadline === '2026-11-30'; }));
  ok('No page errors', errs.length === 0, errs.join(' | '));
  await b.close();
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
