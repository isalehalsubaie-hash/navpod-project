/* Research refresh: an older saved state must gain new jobs, refresh research fields, keep user edits,
   drop untracked removed listings and keep tracked ones. */
const { chromium } = require('playwright'); const path = require('path');
const ok = (n, c, i) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : '')); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(); await ctx.addInitScript(() => { window.CAREEROS_AUTO_CONFIRM = true; });
  const p = await ctx.newPage(); const url = 'file://' + path.resolve(__dirname, '../CareerOS.html');
  await p.goto(url); await p.waitForSelector('#nav a');
  await p.evaluate(async () => {
    const st = JSON.parse(JSON.stringify(S));
    st.seedVersion = 1;
    st.jobs = st.jobs.filter((j) => j.jobId !== 'CO-0288');                      // KPMG did not exist yet
    const j3 = st.jobs.find((j) => j.jobId === 'CO-0003'); j3.notes = 'OLD NOTE'; j3.description = 'USER EDITED TEXT ' + j3.description; j3.userEdited = true;
    const j4 = st.jobs.find((j) => j.jobId === 'CO-0004'); j4.notes = 'OLD NOTE 4';
    st.jobs.push({ ...st.jobs[0], id: 'LI-GONE1', jobId: 'CO-9001', title: 'Removed listing', origin: 'research_session' });
    st.jobs.push({ ...st.jobs[0], id: 'LI-GONE2', jobId: 'CO-9002', title: 'Removed but tracked', origin: 'research_session' });
    st.jobs.push({ ...st.jobs[0], id: 'MAN-1', jobId: 'MAN-1', title: 'My manual job', origin: 'manual' });
    st.applications = [{ id: 'A1', jobId: 'CO-9002', status: 'Applied', history: [] }];
    await idbSet('state', st);
  });
  await p.reload(); await p.waitForSelector('#nav a');
  const r = await p.evaluate(() => ({ kpmg: !!jobById('CO-0288'), note4: jobById('CO-0004').notes, desc3: jobById('CO-0003').description.slice(0, 17), gone: !!jobById('CO-9001'), tracked: !!jobById('CO-9002'), manual: !!jobById('MAN-1'), ver: S.seedVersion, gpa: S.profile.education.gpa.private }));
  ok('New research job added (KPMG CO-0288)', r.kpmg);
  ok('Research fields refreshed (notes)', r.note4 !== 'OLD NOTE 4');
  ok('Your edited description kept', r.desc3 === 'USER EDITED TEXT ');
  ok('Untracked removed listing dropped', !r.gone);
  ok('Tracked removed listing kept', r.tracked);
  ok('Manual job kept', r.manual);
  ok('GPA set to private on existing data', r.gpa === true);
  await b.close();
})();
