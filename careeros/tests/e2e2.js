/* CareerOS 2.0 feature tests on the hosted build, with a simulated host:
   db (private store), downloads, sample (AI with tool calls) and mcp (Gmail connector).
   The Gmail mock returns synthetic emails with the same structure as LinkedIn's. */
const { chromium, devices } = require('playwright'); const path = require('path');
const results = []; const ok = (n, c, i) => { results.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : '')); };
(async () => {
  const b = await chromium.launch();
  const mk = async (opts) => {
    const ctx = await b.newContext(opts);
    await ctx.addInitScript(() => {
      window.confirm = () => false; window.open = () => null;
      const mem = JSON.parse(localStorage.getItem('mockdb') || '{}'); const persist = () => localStorage.setItem('mockdb', JSON.stringify(mem));
      window.__downloads = []; window.__toolCalls = []; window.__mcpCalls = [];
      const db = { collection: (p) => ({ doc: (k) => ({ get: async () => (mem[p + '/' + k] ? { exists: true, data: () => mem[p + '/' + k] } : { exists: false, data: () => undefined }), set: async (v) => { mem[p + '/' + k] = v; persist(); } }) }) };
      const sample = async (input, opts) => {
        const tool = (opts.tools || []).find((t) => t.name === 'search_jobs');
        const r = tool ? await tool.execute({ eligibility: ['GREEN', 'YELLOW'], limit: 3 }) : { rows: [] };
        window.__toolCalls.push('search_jobs');
        const text = 'Based on your data, apply first to ' + r.rows.map((x) => x.id + ' (' + x.title + ')').join(', ') + '. Evidence: P01, E04.';
        if (opts.onText) opts.onText({ text, delta: text });
        return { text, truncated: false };
      };
      const conf = 'Your application was sent to Test Robotics Co\n\nRobotics Integration Engineer\nTest Robotics Co\nRiyadh\nView job: https://www.linkedin.com/comm/jobs/view/9990001111/?t=1\n\n---------------------------------------------------------\n\nApplied on October 20, 2026----------------------------------------------------------------\n Now, take these next steps for more success\n';
      const alert = 'Your job alert for Engineer in Riyadh Region\n\nGraduate Mechanical Engineer\nExample Industrial Co\nRiyadh\n\nView job: https://www.linkedin.com/comm/jobs/view/9990002222/?x\n\n---------------------------------------------------------\n\nSee all jobs on LinkedIn: https://y';
      const mcp = { callTool: async (server, tool, input) => { window.__mcpCalls.push(server + ':' + tool); if (tool === 'search_threads') return { payload: { threads: /application was sent/.test(input.query) ? [{ id: 't1' }] : [{ id: 't2' }] } }; if (tool === 'get_thread') return { payload: { messages: [{ date: '2026-10-20T10:00:00Z', plaintextBody: input.threadId === 't1' ? conf : alert }] } }; throw new Error('unknown tool'); } };
      const api = { db, user: { id: async () => 'u777' }, downloads: { save: async ({ filename }) => { window.__downloads.push(filename); } }, sample, mcp };
      window.claude = { use: (n) => new Promise((r) => setTimeout(() => r(api[n] || null), 30)) };
    });
    return ctx;
  };
  const ctx = await mk({ viewport: { width: 1360, height: 950 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const url = 'file://' + path.resolve(__dirname, '../CareerOS_web.html');
  await p.goto(url); await p.waitForSelector('#nav a', { timeout: 30000 }); await p.waitForTimeout(800);
  const nav = async (h, w) => { await p.evaluate((x) => go('#/' + x), h); await p.waitForTimeout(w || 500); };
  // Dashboard
  ok('Dashboard: next best moves', (await p.$$('.move')).length >= 4, (await p.$$eval('.move b', (x) => x.slice(0, 3).map((e) => e.textContent))).join(' | '));
  ok('Dashboard: CV competitiveness shown', /average keyword coverage/.test(await p.textContent('#content')));
  // Discover: compare two jobs
  await nav('discover'); await p.click('.job [data-act="cmpToggle"] >> nth=0'); await p.waitForTimeout(300); await p.click('.job [data-act="cmpToggle"] >> nth=1'); await p.waitForTimeout(300);
  await nav('compare'); ok('Compare: recommendation for 2 jobs', /ranks first/.test(await p.textContent('#content')));
  ok('Career value on cards', await p.evaluate(() => S.jobs.length > 250));
  // Job page
  await nav('job/CO-0003'); await p.click('[data-act="jtab"][data-t="value"]'); await p.waitForTimeout(300);
  ok('Career value tab with 6 factors', (await p.$$('.factor')).length === 6);
  await p.click('[data-act="jtab"][data-t="overview"]'); await p.waitForTimeout(300);
  ok('Three independent assessments + readiness', /Three independent assessments/.test(await p.textContent('#content')) && /Application readiness/.test(await p.textContent('#content')));
  // Track CV
  await nav('optimize/TRACK-ME', 800); await p.click('[data-act="optimize"]'); await p.waitForTimeout(600);
  const nsug = await p.$$eval('table.cmp tbody tr', (x) => x.length); ok('Track CV suggestions', nsug >= 1, nsug + ' suggestions');
  await p.click('[data-act="acceptAll"]'); await p.waitForTimeout(400);
  await p.click('[data-act="makeVersion"]'); await p.waitForTimeout(400); if (await p.$('#ask-ok')) await p.click('#ask-ok'); await p.waitForTimeout(2500);
  ok('Track CV created, not added to tracker', (await p.evaluate(() => S.cvVersions.some((v) => v.isTrack))) && !(await p.evaluate(() => S.applications.some((a) => /TRACK/.test(a.jobId)))));
  await nav('cv', 1500); ok('CV Studio lists track versions', /TRACK_Mechanical_Engineering/.test(await p.textContent('#content')));
  ok('Greenhouse ATS check rendered', /Greenhouse guidance/.test(await p.textContent('#content')));
  await p.click('[data-act="masterPdf"]'); await p.waitForTimeout(2500);
  ok('In-app master PDF export', (await p.evaluate(() => window.__downloads)).some((f) => /\.pdf$/.test(f)), (await p.evaluate(() => window.__downloads)).join(','));
  await p.click('[data-act="viewChanges"] >> nth=0'); await p.waitForTimeout(400); ok('Original vs tailored change review', /Original vs tailored/.test(await p.textContent('#modal'))); await p.click('#modal [data-act="closeModal"]');
  // Command center
  await nav('builder/CO-0003'); await p.click('[data-act="genPkg"]'); await p.waitForTimeout(800);
  ok('Readiness score shown', /Application readiness: \d+%/.test(await p.textContent('#content')));
  await p.click('[data-act="btab"][data-t="msg"]'); await p.waitForTimeout(300); ok('Application email generated', /Subject: Application for/.test(await p.inputValue('textarea[data-k="messages.applicationEmail"]')));
  await p.click('[data-act="btab"][data-t="cover"]'); await p.waitForTimeout(200); await p.click('[data-act="approve"][data-k="coverLetter"]'); await p.waitForTimeout(300);
  ok('Approval recorded', await p.evaluate(() => S.packages.slice(-1)[0].approved.coverLetter === true));
  // Interview
  await nav('interview/CO-0003'); await p.click('[data-act="ivGen"]'); await p.waitForTimeout(600);
  const iv = await p.textContent('#content'); ok('Interview briefing generated', /Engineering fundamentals|Behavioural questions/.test(iv) && /STAR/.test(iv));
  await p.click('[data-act="ivAI"]'); await p.waitForTimeout(1500); ok('Interview AI notes via tool calls', /apply first to CO-/.test(await p.textContent('#content')));
  // AI agent
  await nav('ai'); await p.fill('#aiq', 'Which jobs should I apply for today?'); await p.click('[data-act="aiSend"]'); await p.waitForTimeout(1500);
  const ans = await p.textContent('#chat'); ok('AI answer uses real job ids from tool', /CO-\d{4}/.test(ans) && (await p.evaluate(() => window.__toolCalls.length)) >= 1, ans.slice(-160));
  // Dev map and analytics
  await nav('devmap'); ok('Development map tiers', /Essential/.test(await p.textContent('#content')) && (await p.$$('select[data-chg="devSet"]')).length > 5);
  // Gmail import
  await nav('gmail'); await p.click('[data-act="gmScan"]'); await p.waitForTimeout(1500);
  ok('Gmail scan parsed application and alert', /Applications found: 1/.test(await p.textContent('#content')) && /Alert jobs found: 1/.test(await p.textContent('#content')));
  await p.click('[data-act="gmImport"]'); await p.waitForTimeout(800);
  ok('Imported application in tracker as Applied with email date', await p.evaluate(() => S.applications.some((a) => a.liId === '9990001111' && a.status === 'Applied' && a.appliedDate === '2026-10-20')));
  ok('Imported alert job marked unverified', await p.evaluate(() => S.jobs.some((j) => j.origin === 'gmail_alert' && /not yet verified/i.test(j.verification))));
  await nav('analytics'); ok('Analytics counts submitted', /Submitted<\/div><div class="v">[1-9]/.test(await p.innerHTML('#content')));
  // Company page and theme
  await nav('company/' + encodeURIComponent('Hitachi Energy')); await p.click('[data-act="coChecked"]'); await p.waitForTimeout(300); ok('Company: checked today recorded', await p.evaluate(() => S.companies.find((c) => c.name === 'Hitachi Energy').userChecked === TODAY()));
  await p.evaluate(() => { S.settings.theme = 'dark'; applyTheme(); }); ok('Dark theme applies', (await p.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
  // Persistence of 2.0 data
  await p.waitForTimeout(1500); await p.reload(); await p.waitForSelector('#nav a', { timeout: 30000 }); await p.waitForTimeout(1500);
  ok('After reload: imported application, interview briefing, compare list persist', await p.evaluate(() => S.applications.length >= 2 && Object.keys(S.interviews || {}).length >= 1 && (S.compareIds || []).length === 2));
  ok('No page errors (desktop)', errs.length === 0, errs.join(' | '));
  // iPhone layout audit on every screen
  const m = await (await mk({ ...devices['iPhone 13'] })).newPage(); const merr = []; m.on('pageerror', (e) => merr.push(e.message));
  await m.goto(url); await m.waitForSelector('#nav a', { timeout: 30000 }); await m.waitForTimeout(800);
  const over = [];
  for (const r of ['dashboard', 'discover', 'job/CO-0003', 'compare', 'analysis', 'profile', 'cv', 'optimize/CO-0003', 'builder/CO-0003', 'tracker', 'interview', 'devmap', 'analytics', 'market', 'watchlist', 'company/Hitachi%20Energy', 'keywords', 'settings', 'ai', 'gmail']) {
    await m.evaluate((h) => go('#/' + h), r); await m.waitForTimeout(r === 'cv' ? 1500 : 400);
    const w = await m.evaluate(() => document.documentElement.scrollWidth); if (w > 392) over.push(r + ':' + w);
  }
  ok('iPhone: no horizontal overflow on any screen', over.length === 0, over.join(', '));
  ok('iPhone: tab bar visible', await m.$eval('#tabbar', (e) => getComputedStyle(e).display !== 'none'));
  ok('No page errors (iPhone)', merr.length === 0, merr.join(' | '));
  console.log('TOTAL', results.length, 'PASSED', results.filter(Boolean).length);
  await b.close();
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
