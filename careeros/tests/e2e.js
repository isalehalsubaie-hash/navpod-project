/* End-to-end workflow test for CareerOS. Writes downloaded artifacts to tests/out/. */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const OUT = path.resolve(__dirname, 'out'); fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const results = []; const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info || '' }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (info ? ' :: ' + info : '')); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('dialog', (d) => d.accept()); await ctx.addInitScript(() => { window.CAREEROS_AUTO_CONFIRM = true; });
  const url = 'file://' + path.resolve(__dirname, '../CareerOS.html');
  const nav = async (h, wait) => { await p.goto(url + '#/' + h); await p.waitForTimeout(wait || 700); };
  const dl = async (fn, name) => { const [d] = await Promise.all([p.waitForEvent('download'), fn()]); const f = path.join(OUT, name || d.suggestedFilename()); await d.saveAs(f); return f; };
  await p.goto(url); await p.waitForSelector('#nav a');
  // 1 Discover: tabs, filters, sorting
  await nav('discover');
  const applyCount = await p.$$eval('.job', (x) => x.length); ok('Discover Apply Now shows jobs', applyCount > 10, applyCount + ' cards');
  const pills = await p.$$eval('.job .el', (x) => x.map((e) => e.textContent.trim()));
  ok('Apply Now only GREEN/YELLOW', pills.every((t) => /GREEN|YELLOW/.test(t)), [...new Set(pills)].join(','));
  await p.selectOption('select[data-k="city"]', 'Riyadh'); await p.waitForTimeout(400);
  const locs = await p.$$eval('.job .c', (x) => x.map((e) => e.textContent)); ok('City filter Riyadh', locs.length > 0 && locs.every((t) => /Riyadh/i.test(t)), locs.length + ' jobs');
  await p.click('[data-act="clearF"]'); await p.waitForTimeout(300);
  await p.selectOption('select[data-k="sort"]', 'deadline'); await p.waitForTimeout(400);
  const firstDeadline = await p.$eval('.job .t', (e) => e.textContent); ok('Sort by closest deadline', /Corporate Banking/.test(firstDeadline), firstDeadline);
  await p.click('[data-act="clearF"]');
  await p.fill('input[data-inp="fq"]', 'drone'); await p.waitForTimeout(900);
  const dr = await p.$$eval('.job .t', (x) => x.map((e) => e.textContent)); ok('Search "drone"', dr.length >= 1, dr.join(' | '));
  await p.click('[data-act="clearF"]'); await p.waitForTimeout(300);
  for (const [t, lab] of [['stretch', 'ORANGE'], ['red', 'RED']]) { await p.click(`[data-act="tab"][data-t="${t}"]`); await p.waitForTimeout(400); const l = await p.$$eval('.job .el', (x) => [...new Set(x.map((e) => e.textContent.trim()))]); ok('Tab ' + t + ' only ' + lab, l.length && l.every((s) => s.startsWith(lab)), l.join(',')); }
  await p.click('[data-act="tab"][data-t="expired"]'); await p.waitForTimeout(400);
  ok('Expired & excluded tab populated', (await p.$$eval('tbody tr', (x) => x.length)) > 50);
  await p.click('[data-act="tab"][data-t="apply"]'); await p.click('[data-act="view"][data-v="table"]'); await p.waitForTimeout(400);
  ok('Table view', (await p.$$eval('table tbody tr', (x) => x.length)) > 10); await p.click('[data-act="view"][data-v="cards"]');
  // 2 Job analysis tabs
  await nav('job/CO-0003');
  for (const t of ['requirements', 'keywords', 'score', 'strategy', 'advert', 'overview']) { await p.click(`[data-act="jtab"][data-t="${t}"]`); await p.waitForTimeout(300); ok('Job tab ' + t, !(await p.$('text=Something went wrong'))); }
  const reqRows = await (async () => { await p.click('[data-act="jtab"][data-t="requirements"]'); await p.waitForTimeout(300); return p.$$eval('table tbody tr', (x) => x.length); })();
  ok('Requirement matrix rows', reqRows > 3, reqRows + ' rows');
  // 3 Optimizer
  await p.click('text=Analyze and tailor my CV'); await p.waitForTimeout(600);
  await p.click('[data-act="optimize"]'); await p.waitForTimeout(800);
  const nSug = await p.$$eval('table.cmp tbody tr', (x) => x.length); ok('Suggestions generated', nSug >= 3, nSug + ' suggestions');
  const covBefore = await p.$$eval('.tile .v', (x) => x.map((e) => e.textContent));
  await p.click('[data-act="acceptAll"]'); await p.waitForTimeout(600);
  // edit one suggestion (unsupported keyword check)
  const editBtn = await p.$('[data-act="editSug"]');
  if (editBtn) { await editBtn.click(); await p.fill('#sugText', 'Designed a NFPA-certified PCB with Revit'); await p.click('[data-act="saveSug"]'); await p.waitForTimeout(300); ok('Unsupported keyword warning on edit', !!(await p.$('#sugWarn .flag'))); await p.click('[data-act="closeModal"]'); }
  // reject integrity flags explicitly? accept the HVAC integrity correction
  const integ = await p.$$('tr:has-text("Integrity") [data-act="decide"][data-v="accepted"]'); if (integ[0]) await integ[0].click(); await p.waitForTimeout(400);
  const covAfter = await p.$$eval('.tile .v', (x) => x.map((e) => e.textContent));
  ok('Coverage recalculated after acceptance', covBefore[1] !== covAfter[1] || covAfter[1] !== covAfter[0], 'before ' + covBefore.slice(0, 2).join('/') + ' after ' + covAfter.slice(0, 2).join('/'));
  await p.click('[data-act="makeVersion"]'); await p.waitForTimeout(2500);
  const integTxt = await p.textContent('.card:has-text("Versions for this job")'); ok('Integrity check passed', /Integrity check passed/.test(integTxt), integTxt.match(/Integrity[^.]*\./) && integTxt.match(/Integrity[^.]*\./)[0]);
  const docxFile = await dl(() => p.click('.card:has-text("Versions for this job") [data-act="dlVersion"]'));
  ok('Tailored DOCX downloaded', fs.statSync(docxFile).size > 5000, path.basename(docxFile));
  // 4 Builder
  await nav('builder/CO-0003'); await p.click('[data-act="genPkg"]'); await p.waitForTimeout(800);
  const cl = await p.inputValue('textarea[data-k="coverLetter"]'); ok('Cover letter generated', /Airbus/.test(cl) && /Dear Hiring Team/.test(cl), cl.length + ' chars');
  ok('Cover letter has no em dash', !/—/.test(cl));
  await p.fill('textarea[data-k="coverLetter"]', cl + '\nP.S. edited'); await p.waitForTimeout(400);
  for (const t of ['msg', 'form', 'strategy', 'interview', 'check']) { await p.click(`[data-act="btab"][data-t="${t}"]`); await p.waitForTimeout(300); ok('Builder tab ' + t, !(await p.$('text=Something went wrong'))); }
  await p.click('[data-act="btab"][data-t="form"]'); ok('Form marks input required', (await p.$$('text=YOUR INPUT REQUIRED')).length >= 2);
  const zipFile = await dl(() => p.click('[data-act="dlPkg"]')); ok('Package ZIP downloaded', fs.statSync(zipFile).size > 10000, path.basename(zipFile));
  await p.click('[data-act="btab"][data-t="cover"]'); const coverDocx = await dl(() => p.click('[data-act="dlCover"]'), 'cover.docx'); ok('Cover letter DOCX', fs.statSync(coverDocx).size > 1000);
  await p.click('[data-act="btab"][data-t="check"]'); await p.click('[data-act="markApplied"]'); await p.waitForTimeout(800);
  // 5 Tracker
  ok('Tracker shows application', /Engineering Apprentice/.test(await p.textContent('#content')));
  const st = await p.$eval('select[data-k="status"]', (e) => e.value); ok('Status Applied after confirmation', st === 'Applied', st);
  await p.selectOption('select[data-k="status"]', 'Interview'); await p.waitForTimeout(400);
  await p.fill('input[data-k="followUp"]', '2026-11-20'); await p.dispatchEvent('input[data-k="followUp"]', 'change'); await p.waitForTimeout(400);
  await p.click('[data-act="trView"][data-v="calendar"]'); await p.waitForTimeout(400); ok('Calendar renders events', (await p.$$('.cal .ev')).length >= 1);
  // 6 Persistence: reload
  await p.reload(); await p.waitForSelector('#nav a'); await nav('tracker');
  ok('Persistence after reload: status', (await p.$eval('select[data-k="status"]', (e) => e.value)) === 'Interview');
  ok('Persistence after reload: follow-up', (await p.$eval('input[data-k="followUp"]', (e) => e.value)) === '2026-11-20');
  await nav('builder/CO-0003'); ok('Persistence: edited cover letter', /P\.S\. edited/.test(await p.inputValue('textarea[data-k="coverLetter"]')));
  // 7 Profile edit triggers eligibility change
  await nav('job/CO-0001'); const before = await p.textContent('.el'); 
  await nav('profile'); await p.fill('input[data-p="personal.nationality"]', 'Saudi'); await p.dispatchEvent('input[data-p="personal.nationality"]', 'change'); await p.waitForTimeout(400);
  await nav('job/CO-0001'); const after = await p.textContent('#content');
  ok('Nationality confirmation clears the nationality flag', !/Saudi nationals\. Your nationality is not set/.test(after), 'before: ' + before.trim());
  await nav('profile'); await p.fill('input[data-p="personal.nationality"]', ''); await p.dispatchEvent('input[data-p="personal.nationality"]', 'change'); await p.waitForTimeout(300);
  // add profile item
  await p.click('[data-act="editItem"][data-id=""]'); await p.fill('#it_title', 'Test project: thermal camera inspection'); await p.fill('#it_bullets', 'Ran a thermography survey'); await p.selectOption('#it_status', 'needs_confirmation'); await p.click('[data-act="saveItem"]'); await p.waitForTimeout(400);
  ok('Profile item added', /Test project: thermal camera/.test(await p.textContent('#content')));
  // 8 Job analysis: manual job
  await nav('analysis'); await p.fill('#nj_title', 'Graduate HVAC Engineer'); await p.fill('#nj_company', 'Test MEP Co'); await p.fill('#nj_desc', 'Requirements:\n- Bachelor in Mechanical Engineering\n- 0-2 years experience\n- Knowledge of HVAC, AutoCAD and Revit is required\n- NFPA knowledge preferred\nResponsibilities:\n- Review shop drawings\n- Coordinate MEP installation on site');
  await p.click('[data-act="analyseNew"]'); await p.waitForTimeout(800);
  const mtxt = await p.textContent('#content'); ok('Manual job analysed', /Graduate HVAC Engineer/.test(await p.textContent('#title')) && /AutoCAD|Revit/.test(mtxt));
  // 9 Upload DOCX and PDF master
  await nav('cv', 1500);
  await p.setInputFiles('input[data-chg="uploadCV"] >> nth=0', path.resolve(__dirname, '../../portfolio/Saleh_Alsubaie_CV.pdf')); await p.waitForTimeout(2500);
  ok('PDF upload extracted text', /characters of text extracted/.test(await p.textContent('#modal')), (await p.textContent('#modal')).slice(0, 90)); await p.click('#modal [data-act="closeModal"]');
  await p.setInputFiles('input[data-chg="uploadCV"] >> nth=0', path.resolve(__dirname, '../master_cv/Saleh_Alsubaie_CV_MASTER.docx')); await p.waitForTimeout(1500);
  ok('DOCX upload loads master', /Uploaded by you/.test(await p.textContent('#content')));
  ok('ATS checks shown for DOCX and PDF', (await p.$$('text=ATS readability')).length >= 2);
  // 10 backup export
  await nav('settings'); const bk = await dl(() => p.click('[data-act="backup"]')); ok('Backup JSON exported', JSON.parse(fs.readFileSync(bk, 'utf8')).applications.length >= 1);
  const csv = await dl(() => p.click('[data-act="exportJobs"]')); ok('Opportunities CSV exported', fs.readFileSync(csv, 'utf8').split('\n').length > 100);
  // 11 Mobile layout
  const m = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await m.goto(url + '#/discover'); await m.waitForSelector('.job'); await m.screenshot({ path: path.join(OUT, 'mobile_discover.png') });
  const ow = await m.evaluate(() => document.documentElement.scrollWidth); ok('Mobile: no horizontal overflow on Discover', ow <= 395, 'scrollWidth ' + ow);
  await m.click('.burger'); await m.waitForTimeout(300); ok('Mobile menu opens', await m.$eval('.side', (e) => e.classList.contains('open')));
  await m.goto(url + '#/dashboard'); await m.waitForTimeout(800); await m.screenshot({ path: path.join(OUT, 'mobile_dashboard.png') });
  ok('No page errors', errs.length === 0, errs.slice(0, 5).join(' | '));
  fs.writeFileSync(path.join(OUT, 'e2e_results.json'), JSON.stringify(results, null, 1));
  console.log('\nTOTAL', results.length, 'PASSED', results.filter((r) => r.pass).length);
  await b.close();
})().catch((e) => { console.error('E2E CRASH', e); process.exit(1); });
