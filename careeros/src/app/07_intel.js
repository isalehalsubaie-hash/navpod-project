/* CareerOS 2.0 modules: shared helpers, Compare, Company intelligence, Interview prep,
   Development map, Analytics, Gmail import, career-track CV targets. */
function nextMoves() {
  return E.nextBestMoves({ jobs: S.jobs.filter((j) => !isExpired(j)).map((j) => ({ job: j, ...C(j) })), applications: S.applications, profile: S.profile, master: S.master, today: TODAY(), cvVersions: S.cvVersions, packages: S.packages });
}
let _dm = null, _dmRev = -1;
function devMapData() {
  if (_dm && _dmRev === S.profileRev + S.jobs.length * 1000) return _dm;
  _dm = E.devMap({ jobs: S.jobs.filter((j) => !isExpired(j)).map((j) => ({ job: j, a: C(j).a, el: C(j).el })), idx: evidenceIndex(), profile: S.profile });
  _dmRev = S.profileRev + S.jobs.length * 1000; return _dm;
}
let _tt = null;
function trackTargetsList() { return _tt || (_tt = E.trackTargets(S.jobs.filter((j) => !isExpired(j)))); }
function trackTarget(id) { return /^TRACK-/.test(id || "") ? trackTargetsList().find((t) => t.jobId === id) : null; }
const _jobById = jobById;
jobById = (id) => _jobById(id) || trackTarget(id);
function isNew(j) { const imported = ["gmail_alert", "gmail_application", "live_search", "manual"].includes(j.origin) && j.firstSeen && daysUntil(j.firstSeen) >= -2; return !!(imported || (j.published && daysUntil(j.published) >= -2 && daysUntil(j.published) <= 0)); }
const emptyState = (title, body, action) => `<div class="empty"><b>${esc(title)}</b>${body ? `<div class="small">${body}</div>` : ""}${action ? `<div class="mt">${action}</div>` : ""}</div>`;

// ---------------------------------------------------------------- Compare
ACT.cmpToggle = (d) => { S.compareIds = S.compareIds || []; const i = S.compareIds.indexOf(d.id); if (i >= 0) S.compareIds.splice(i, 1); else S.compareIds.push(d.id); S.compareIds = S.compareIds.slice(-6); save(); rerender(); toast(i >= 0 ? "Removed from comparison" : "Added to comparison (" + S.compareIds.length + ")"); };
ACT.cmpClear = () => { S.compareIds = []; save(); rerender(); };
route("compare", () => {
  const ids = (S.compareIds || []).filter((id) => jobById(id));
  if (ids.length < 2) return { title: "Compare Opportunities", sub: "Select two to six jobs with the ⇄ button on any job card or job page", html: emptyState("Pick at least two jobs to compare", "Open Discover and tap ⇄ Compare on the jobs you are weighing up. " + ids.length + " selected so far.", '<a class="btn primary" href="#/discover">Open Discover</a>') };
  const r = E.compareJobs(ids.map((id) => { const j = jobById(id); return { job: j, ...C(j) }; }));
  const rows = [
    ["Priority", (x) => `<b>${x.priority}</b>`], ["Eligibility", (x) => elPill(x.el.label)], ["Match", (x) => x.m.total + "/100"], ["Career value", (x) => x.v.total + "/100"],
    ["Keyword coverage", (x) => (x.cov ? x.cov.keywordCoverage + "%" : "-")], ["Salary", (x) => esc(x.job.salary || "Not disclosed")], ["Location", (x) => esc(x.job.location)],
    ["Experience asked", (x) => (x.a.constraints.minYears != null ? x.a.constraints.minYears + "+ years" : "Not stated")], ["Deadline", (x) => (x.job.deadline ? fmtDate(x.job.deadline) : "Not stated")],
    ["Type", (x) => esc(jobKind(x.job))], ["Employer", (x) => esc(x.job.employer)], ["Development", (x) => esc(x.v.factors.find((f) => f.key === "development").why)],
    ["Key skills", (x) => x.a.keywords.filter((k) => k.cat !== "soft").slice(0, 6).map((k) => `<span class="kw">${esc(k.term)}</span>`).join("")],
    ["Missing", (x) => x.m.missing.slice(0, 6).map((k) => `<span class="kw missing">${esc(k)}</span>`).join("") || "-"],
    ["Blocking items", (x) => x.el.reasons.filter((q) => q.level !== "PASS").map((q) => `<div class="tiny">${esc(q.level)}: ${esc(q.msg)}</div>`).join("") || "None"],
  ];
  return { title: "Compare Opportunities", sub: ids.length + " selected", actions: `<button class="btn" data-act="cmpClear">Clear selection</button><a class="btn" href="#/discover">Add more</a>`,
    html: `<div class="card mb"><h2>Recommendation</h2><p>${esc(r.recommendation)}</p><p class="tiny muted">${esc(r.method)} Not a hiring probability.</p></div>
    <div class="tablewrap" style="max-height:none"><table class="cmpt"><thead><tr><th></th>${r.rows.map((x) => `<th style="min-width:220px"><a href="#/job/${x.job.jobId}">${esc(x.job.title)}</a><div class="tiny muted" style="text-transform:none">${esc(x.job.employer)}</div><button class="btn sm ghost" data-act="cmpToggle" data-id="${x.job.jobId}">Remove</button></th>`).join("")}</tr></thead><tbody>
    ${rows.map(([l, f]) => `<tr><td><b class="small">${l}</b></td>${r.rows.map((x) => `<td class="small">${f(x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`,
    after: () => document.querySelectorAll("table.cmpt").forEach((t) => t.classList.remove("rt")) };
});

// ---------------------------------------------------------------- Company intelligence
route("company", (name) => {
  const c = S.companies.find((x) => x.name === name);
  if (!c) return { title: "Company not found", html: emptyState("No company called " + name, "", '<a class="btn" href="#/watchlist">Back to companies</a>') };
  const open = S.jobs.filter((j) => !isExpired(j) && companyMatch(c, j.employer));
  const past = S.excluded.filter((x) => companyMatch(c, x.employer || ""));
  const apps = S.applications.filter((a) => { const j = jobById(a.jobId); return companyMatch(c, j ? j.employer : (a.snapshot || {}).employer || ""); });
  const kwc = {}; open.forEach((j) => C(j).a.keywords.forEach((k) => { if (k.cat !== "soft") kwc[k.term] = (kwc[k.term] || 0) + 1; }));
  const facts = (S.market.facts || []).filter((f) => new RegExp(c.name.split(/[ (]/)[0], "i").test(f.topic + " " + f.fact));
  return {
    title: c.name, sub: c.industry + " · " + c.location,
    actions: `<button class="btn" data-act="coFollow" data-n="${esc(c.name)}">${c.followed ? "★ Following" : "☆ Follow"}</button><button class="btn" data-act="coChecked" data-n="${esc(c.name)}">I checked their careers page today</button>${c.careersUrl ? `<a class="btn primary" href="${esc(c.careersUrl)}" target="_blank" rel="noopener">Careers site ↗</a>` : ""}`,
    html: `<div class="grid g3 mb"><div class="tile"><div class="l">Verified open vacancies</div><div class="v">${open.length}</div><div class="d">in your database</div></div><div class="tile"><div class="l">Your applications</div><div class="v">${apps.length}</div></div><div class="tile"><div class="l">Careers page last checked</div><div class="v" style="font-size:16px">${c.userChecked ? fmtDate(c.userChecked) + " (you)" : fmtDate(c.lastChecked) + " (research)"}</div><div class="d">${esc(c.careersCheck || "")}</div></div></div>
    <div class="grid g2">
      <div class="card"><h2>Profile <span class="pill tag">${esc({ A: "A: Actual vacancy", B: "B: Talent pool", C: "C: General CV submission", D: "D: Speculative networking" }[open.length ? "A" : c.opportunityType])}</span></h2>
        <p class="small"><b>Verified facts (research ${fmtDate(c.lastChecked)}):</b> ${esc(c.notes || "None recorded.")}</p>
        <table><tbody>${[["Industry", c.industry], ["Saudi locations", c.location], ["Relevant departments", (c.departments || []).join(", ")], ["Career tracks", (c.tracks || []).map(trackName).join(", ")], ["Typical roles", (c.typicalRoles || []).join(", ")], ["Internship programs", c.internshipPrograms], ["Graduate programs", c.graduatePrograms], ["Talent pool", c.talentPool]].map(([k, v]) => `<tr><td class="small" style="width:40%"><b>${k}</b></td><td class="small">${esc(v || "Not recorded")}</td></tr>`).join("")}</tbody></table>
        ${facts.length ? `<h3>Verified announcements</h3>${facts.map((f) => `<p class="small">${esc(f.fact)} <span class="tiny muted">(${esc(f.type)}, ${fmtDate(f.verified)})</span></p>`).join("")}` : ""}
        <h3>Your reason to join (used in cover letters)</h3><textarea data-chg="coWhy" data-n="${esc(c.name)}" style="min-height:70px" placeholder="One specific, true reason">${esc(c.whyNote || "")}</textarea></div>
      <div class="card"><h2>Open vacancies</h2>${open.length ? open.sort((a, b) => C(b).m.total - C(a).m.total).map((j) => `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line);flex-wrap:nowrap"><div style="min-width:0"><a href="#/job/${j.jobId}"><b class="small">${esc(j.title)}</b></a><div class="tiny muted">${esc(j.location)} · verified ${fmtDate(j.verifiedDate)}</div></div>${elPill(C(j).el.label)}</div>`).join("") : emptyState("No verified vacancy right now", "CareerOS never calls a company hiring without a verified advert.")}
        ${Object.keys(kwc).length ? `<h3>Skills they ask for</h3>${Object.entries(kwc).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, n]) => `<span class="kw">${esc(k)} ${n}</span>`).join("")}` : ""}
        ${past.length ? `<h3>Past or excluded postings</h3>${past.slice(0, 6).map((x) => `<div class="tiny">${esc(x.title)}: ${esc(x.reason)}</div>`).join("")}` : ""}
        ${apps.length ? `<h3>Your applications</h3>${apps.map((a) => `<div class="tiny">${esc(((jobById(a.jobId) || a.snapshot || {}).title) || a.jobId)}: ${esc(a.status)} ${a.appliedDate ? "(" + fmtDate(a.appliedDate) + ")" : ""}</div>`).join("")}` : ""}</div>
    </div>`,
  };
});
ACT.coFollow = (d) => { const c = S.companies.find((x) => x.name === d.n); c.followed = !c.followed; save(); rerender(); };
ACT.coChecked = (d) => { const c = S.companies.find((x) => x.name === d.n); c.userChecked = TODAY(); logActivity("Checked careers page: " + c.name); save(); rerender(); toast("Recorded: checked today"); };
ACT.coWhy = (d, t) => { const c = S.companies.find((x) => x.name === d.n); c.whyNote = t.value; save(); toast("Saved"); };

// ---------------------------------------------------------------- Interview intelligence
const FUNDAMENTALS = {
  ME: ["Thermodynamics: first and second law, cycles (Rankine, refrigeration) at a conceptual level", "Fluid mechanics: Bernoulli, pressure drop, pump curves and NPSH", "Heat transfer: conduction, convection, fins; how it drives HVAC load", "Strength of materials: stress, strain, factor of safety, fatigue basics", "Engineering drawings: GD&T symbols, tolerances, reading MEP layouts"],
  UAV: ["Lift, drag and stall; wing loading and endurance trade-offs", "Stability and control: CG, static margin, elevon mixing on tailless aircraft", "Sensors and estimation: IMU, GNSS, barometer, EKF predict/update", "Autopilot architecture: ArduPilot modes, MAVLink, failsafes", "GACA operating rules for drones in Saudi Arabia (be accurate about your licence)"],
  DEF: ["Systems engineering V-model: requirements, verification, validation", "Interface control and integration testing", "Reliability and redundancy concepts", "Security and export-control awareness (do not discuss restricted details)"],
  INSP: ["Inspection planning: visual inspection, defect classification, reporting", "Thermography basics (only as an interest unless certified): emissivity, delta-T", "Risk-based inspection concepts", "Drone survey data quality: overlap, GSD, accuracy checks"],
  HSE: ["Hierarchy of controls", "Job safety analysis and permit-to-work", "Incident investigation and root cause", "Zero-incident culture on construction sites"],
  PM: ["Scope, schedule, cost, risk, quality", "Critical path and float", "Earned value basics (PV, EV, AC)", "Stakeholder communication and change control"],
  ENERGY: ["Power plant and utilities overview", "Rotating vs static equipment", "Maintenance strategies and availability"],
  BD: ["Value proposition and qualifying a lead", "CAPEX/OPEX, payback and margin", "Proposal structure and technical-commercial alignment"],
  STRAT: ["Structured problem solving (issue trees, hypothesis-driven)", "Basic financial statements and ratios", "Market sizing"],
  ROB: ["Robot/vehicle autonomy stack: perception, localisation, planning, control", "SLAM concepts and loop closure", "Testing in simulation (Gazebo, HIL)"],
};
const IV = { jobId: "", company: "", title: "", details: "", jd: "" };
route("interview", (id) => {
  if (id && jobById(id)) { const j = jobById(id); Object.assign(IV, { jobId: id, company: j.employer, title: j.title, jd: j.description || "" }); }
  const ivApps = S.applications.filter((a) => ["Interview", "Assessment"].includes(a.status));
  const brief = S.interviews && S.interviews[IV.jobId || IV.company + "|" + IV.title];
  return {
    title: "Interview Intelligence", sub: "Prepare from the real advert and your verified evidence",
    html: `<div class="grid g2 mb"><div class="card"><h2>Interview details</h2>
      ${ivApps.length ? `<label class="f">From your tracker<select data-chg="ivPick"><option value="">Choose an interview...</option>${ivApps.map((a) => { const j = jobById(a.jobId); return `<option value="${a.jobId}" ${IV.jobId === a.jobId ? "selected" : ""}>${esc(j ? j.title + " · " + j.employer : a.jobId)}</option>`; }).join("")}</select></label>` : ""}
      <div class="grid g2 mt"><label class="f">Company<input type="text" id="iv_co" value="${esc(IV.company)}"></label><label class="f">Job title<input type="text" id="iv_ti" value="${esc(IV.title)}"></label></div>
      <label class="f mt">Interview details (format, panel, date, anything they told you)<textarea id="iv_de" style="min-height:70px">${esc(IV.details)}</textarea></label>
      <label class="f mt">Job description (pre-filled from the advert when known)<textarea id="iv_jd" style="min-height:120px">${esc(IV.jd)}</textarea></label>
      <div class="row mt"><button class="btn primary big" data-act="ivGen">Generate interview briefing</button>${HOOKS.sample ? `<button class="btn" data-act="ivAI">Deepen with CareerOS AI</button>` : ""}</div>
      <p class="tiny muted mt">Questions are generated from the advert and your profile. They are not questions supplied by the employer.</p></div>
      <div class="card"><h2>Upcoming interviews</h2>${ivApps.length ? ivApps.map((a) => { const j = jobById(a.jobId); return `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)"><span class="small">${esc(j ? j.title + " · " + j.employer : a.jobId)}</span><a class="btn sm" href="#/interview/${a.jobId}">Prepare</a></div>`; }).join("") : emptyState("No interviews in your tracker yet", "Set an application's status to Interview, or type the details on the left.")}</div></div>
    ${brief ? interviewHTML(brief) : ""}`,
  };
});
ACT.ivPick = (d, t) => { if (t.value) go("#/interview/" + t.value); };
function ivRead() { const v = (i) => (document.getElementById(i) || {}).value || ""; IV.company = v("iv_co").trim(); IV.title = v("iv_ti").trim(); IV.details = v("iv_de"); IV.jd = v("iv_jd"); }
function buildBrief() {
  const j = IV.jobId && jobById(IV.jobId) && jobById(IV.jobId).title === IV.title ? jobById(IV.jobId) : { jobId: "IV", title: IV.title, employer: IV.company, description: IV.jd, location: "", tracks: [] };
  if (!j.tracks || !j.tracks.length) j.tracks = E.inferTracks(j, E.analyzeJob(j));
  const a = E.analyzeJob(j), m = E.scoreMatch(j, S.profile, a, { evidenceIndex: evidenceIndex() });
  const g = E.generatePackage(j, a, m, S.profile, companyFor(j.employer), { today: Date.now() });
  const ev = m.supportingExperience.map((x) => S.profile.items.find((i) => i.id === x.id)).filter(Boolean);
  const star = ev.slice(0, 3).map((it) => ({ item: it.id + " " + it.title, situation: it.org || "", task: (it.bullets[0] || "").slice(0, 160), action: (it.bullets[1] || it.bullets[0] || "").slice(0, 160), result: (it.bullets.find((b) => /\d/.test(b)) || "State a verified outcome only").slice(0, 160) }));
  return { key: IV.jobId || IV.company + "|" + IV.title, created: TODAY(), company: g.interview.company, role: [j.title + " at " + j.employer, ...a.responsibilities.slice(0, 6).map((r) => r.text)], details: IV.details,
    fundamentals: [...new Set((j.tracks || []).flatMap((t) => FUNDAMENTALS[t] || []))].slice(0, 10), topics: g.interview.technicalTopics, advertQs: g.interview.likelyQuestions,
    behavioural: ["Tell me about a time you led a team under a fixed deadline. (Use NavPod, P01)", "Describe a conflict with a contractor or colleague and how you resolved it. (Athlath clashes, E04)", "Tell me about a mistake you made and what changed afterwards.", "How do you prioritise when you have a part-time job, an internship and final-year study?"],
    cvQs: ev.map((it) => "Walk me through " + it.title.split(":")[0] + ". What exactly did you own, and what would you do differently?"), star, ask: g.interview.questionsToAsk, ai: "" };
}
function interviewHTML(b) {
  const L = (h, arr) => (arr && arr.length ? `<h3>${h}</h3><ul class="small">${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");
  return `<div class="card"><div class="row between"><h2>Briefing: ${esc(b.role[0])}</h2><button class="btn sm" data-act="ivDocx" data-k="${esc(b.key)}">Download DOCX</button></div><p class="tiny muted">Generated ${fmtDate(b.created)}. Built from the advert and your verified profile.</p>
    <div class="grid g2"><div>${L("Company briefing", b.company)}${L("Role briefing", b.role.slice(1))}${b.details ? `<h3>Your notes</h3><p class="small">${esc(b.details)}</p>` : ""}${L("Engineering fundamentals to revise", b.fundamentals)}${L("Technical topics from the advert", b.topics)}</div>
    <div>${L("Questions based on the advert", b.advertQs)}${L("Behavioural questions", b.behavioural)}${L("Questions about your CV and projects", b.cvQs)}
      <h3>Suggested answer structures (STAR, from your evidence)</h3>${b.star.map((s) => `<div class="reason mb"><b class="small">${esc(s.item)}</b><div class="tiny"><b>Situation:</b> ${esc(s.situation)}<br><b>Task:</b> ${esc(s.task)}<br><b>Action:</b> ${esc(s.action)}<br><b>Result:</b> ${esc(s.result)}</div></div>`).join("")}
      ${L("Questions to ask the interviewer", b.ask)}</div></div>
    ${b.ai ? `<h3>CareerOS AI notes</h3><div class="msg">${aiFormat(b.ai)}</div>` : ""}</div>`;
}
ACT.ivGen = () => { ivRead(); if (!IV.company || !IV.title) return toast("Enter the company and job title"); S.interviews = S.interviews || {}; const b = buildBrief(); S.interviews[b.key] = b; logActivity("Interview briefing: " + IV.title + " at " + IV.company); save(); rerender(); };
ACT.ivAI = async () => {
  ivRead(); const sample = await aiSample(); if (!sample) return toast("CareerOS AI is not available in this view");
  S.interviews = S.interviews || {}; const b = S.interviews[IV.jobId || IV.company + "|" + IV.title] || buildBrief(); S.interviews[b.key] = b;
  toast("CareerOS AI is preparing deeper notes...", 4000);
  try {
    const r = await sample([{ role: "user", content: AI_RULES + "\n\nPrepare interview notes for " + IV.title + " at " + IV.company + ". Interview details: " + (IV.details || "none") + ". Job description:\n" + (IV.jd || "not provided").slice(0, 6000) + "\n\nUse get_profile for evidence. Give: 5 likely technical questions with a 2-line answer outline each citing evidence ids, 3 risks in the candidate's profile for this role and how to address them honestly, and 3 sharp questions to ask. Say clearly that these are predictions, not the employer's questions." }], { tools: AI_TOOLS(), cache: false, modelTier: "default" });
    b.ai = (r.text || "").replace(/\u2014/g, ", "); save(); rerender();
  } catch (e) { toast("AI notes failed: " + (e.message || e.code), 5000); }
};
ACT.ivDocx = async (d) => { const b = S.interviews[d.k]; const out = [{ text: "Interview briefing: " + b.role[0], bold: true, size: 14 }, "Generated " + b.created + " from the advert and your verified profile. Questions are predictions, not the employer's.", ""]; const sec = (h, a) => { if (!a || !a.length) return; out.push({ text: h, bold: true }); a.forEach((x) => out.push("- " + x)); out.push(""); }; sec("Company", b.company); sec("Role", b.role.slice(1)); sec("Fundamentals", b.fundamentals); sec("Technical topics", b.topics); sec("Advert-based questions", b.advertQs); sec("Behavioural", b.behavioural); sec("CV questions", b.cvQs); b.star.forEach((s) => { out.push({ text: "STAR: " + s.item, bold: true }); out.push("Situation: " + s.situation); out.push("Task: " + s.task); out.push("Action: " + s.action); out.push("Result: " + s.result); out.push(""); }); sec("Questions to ask", b.ask); if (b.ai) { out.push({ text: "CareerOS AI notes", bold: true }); b.ai.split("\n").forEach((x) => out.push(x)); } download("Interview_Briefing_" + (b.role[0] || "").replace(/\W+/g, "_").slice(0, 50) + ".docx", await makeDocx(out)); };

// ---------------------------------------------------------------- Development map
route("devmap", () => {
  const d = devMapData();
  const tiers = ["Essential", "Competitive advantage", "Optional development"];
  const done = S.devDone || {};
  return { title: "My Career Development Map", sub: "What reachable adverts ask for that your profile cannot yet show",
    html: `<div class="note mb">${esc(d.note)} Based on ${d.reachable} reachable (non-red) adverts.</div>
    <div class="card mb"><h2>Practical roadmap</h2><div class="grid g3">${d.roadmap.map((r) => `<div><h3>${esc(r.when)}</h3><ul class="small">${r.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}</div></div>
    ${tiers.map((t) => { const L = d.list.filter((x) => x.tier === t); return L.length ? `<div class="eyebrow">${t} (${L.length})</div><div class="tablewrap mb" style="max-height:none"><table><thead><tr><th>Skill / qualification</th><th class="num">Adverts</th><th class="num">Mandatory in</th><th>Type</th><th>Cost</th><th>Time</th><th>Where to learn</th><th>Progress</th></tr></thead><tbody>
      ${L.map((x) => `<tr><td><b class="small">${esc(x.term)}</b>${x.unconfirmed ? '<div class="tiny warnc">In your profile but unconfirmed</div>' : ""}</td><td class="num">${x.n}</td><td class="num">${x.mandatory}</td><td class="small">${esc(x.kind)}</td><td class="small">${esc(x.cost)}</td><td class="small">${esc(x.time)}</td><td class="tiny">${x.res.map((r) => (r[1] ? `<a href="${esc(r[1])}" target="_blank" rel="noopener">${esc(r[0])}</a>` : esc(r[0]))).join("<br>")}</td>
      <td><select data-chg="devSet" data-id="${x.id}" class="small">${["Not started", "Learning", "Done (add evidence to profile)"].map((o) => `<option ${(done[x.id] || "Not started") === o ? "selected" : ""}>${o}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table></div>` : ""; }).join("")}`,
  };
});
ACT.devSet = (d, t) => { S.devDone = S.devDone || {}; S.devDone[d.id] = t.value; save(); if (/^Done/.test(t.value)) { toast("Add it to your profile with evidence so CareerOS can use it."); go("#/profile"); } };

// ---------------------------------------------------------------- Analytics
route("analytics", () => {
  const A = E.analytics({ applications: S.applications, jobById: (id) => jobById(id), discovered: S.jobs.length + S.excluded.length, matchFor: (id) => (jobById(id) ? C(jobById(id)).m.total : null) });
  const t = (l, v, d) => `<div class="tile"><div class="l">${l}</div><div class="v">${v == null ? "-" : v}</div>${d ? `<div class="d">${d}</div>` : ""}</div>`;
  const grp = (h, rows) => `<div class="card"><h2>${h}</h2>${rows.length ? barList(rows.slice(0, 10).map((r) => [r.key, r.n, r.responses + " response(s), " + r.interviews + " interview(s)"])) + tableView(rows.map((r) => [r.key, r.n, r.responses, r.interviews, r.offers]), ["Group", "Applied", "Responses", "Interviews", "Offers"]) : '<p class="small muted">No submitted applications yet.</p>'}</div>`;
  return { title: "Application Analytics", sub: "From your tracker only. Small samples are flagged.",
    actions: HOOKS.mcp ? `<a class="btn primary" href="#/gmail">Import from Gmail</a>` : "",
    html: `<div class="kpis">${t("Jobs discovered", A.discovered)}${t("Saved / tracked", A.saved)}${t("Submitted", A.submitted)}${t("Responses", A.responses, A.responseRate != null ? A.responseRate + "% response rate" : "")}${t("Interviews", A.interviews, A.interviewRate != null ? A.interviewRate + "% interview rate" : "")}${t("Offers", A.offers)}${t("Average match of applied jobs", A.avgMatch, "jobs in your database only")}</div>
    <div class="card mb"><h2>Observations</h2>${A.observations.length ? `<ul class="small">${A.observations.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>` : '<p class="small muted">No patterns yet.</p>'}<p class="tiny muted">Correlation is not causation. Record responses (Assessment, Interview, Rejected, Offer) in the tracker so these numbers mean something.</p></div>
    <div class="grid g2">${grp("By career track", A.byTrack)}${grp("By channel", A.byChannel)}${grp("By CV version", A.byVersion)}${grp("By location", A.byLocation)}${grp("By employer", A.byEmployer)}${grp("By month", A.byMonth.sort((a, b) => b.key.localeCompare(a.key)))}</div>`,
  };
});

// ---------------------------------------------------------------- Gmail import (hosted page, Gmail connector via mcp capability)
const GM = { busy: false, found: null };
route("gmail", () => {
  const avail = !!HOOKS.mcp;
  const f = GM.found;
  return { title: "Import from Gmail", sub: "Job-alert emails and LinkedIn application confirmations",
    html: avail ? `<div class="card mb"><h2>What this does</h2><p class="small">Reads your own LinkedIn job-alert emails and "your application was sent" confirmations through your Gmail connector, inside this private page. Nothing is sent anywhere else. Imported alert jobs are marked <b>From job alert (not yet verified)</b>: only title, company, location and the LinkedIn link are known until you open the advert.</p>
      <div class="row mt"><label class="f">Look back<select id="gm_days"><option value="7">7 days</option><option value="30" selected>30 days</option><option value="120">120 days</option></select></label><button class="btn primary big" data-act="gmScan" ${GM.busy ? "disabled" : ""}>${GM.busy ? "Scanning..." : "Scan my Gmail"}</button></div></div>
      ${f ? `<div class="grid g2"><div class="card"><h2>Applications found: ${f.apps.length}</h2><p class="tiny muted">${f.apps.filter((a) => a.isNew).length} not yet in your tracker. LinkedIn's confirmation email is evidence you submitted, so these are imported as Applied with the date from the email.</p>${f.apps.slice(0, 80).map((a) => `<div class="tiny" style="padding:3px 0;border-bottom:1px solid var(--line)">${a.isNew ? "🆕 " : "✓ "}<b>${esc(a.title)}</b> · ${esc(a.company)} · ${esc(a.location)} · applied ${esc(a.appliedDate)}</div>`).join("")}</div>
        <div class="card"><h2>Alert jobs found: ${f.jobs.length}</h2><p class="tiny muted">${f.jobs.filter((x) => x.isNew).length} new to your database. Irrelevant titles are still imported; CareerOS scores them like any other job.</p>${f.jobs.slice(0, 80).map((x) => `<div class="tiny" style="padding:3px 0;border-bottom:1px solid var(--line)">${x.isNew ? "🆕 " : "✓ "}<b>${esc(x.title)}</b> · ${esc(x.company)} · ${esc(x.location)} · alert ${esc(x.date)}</div>`).join("")}</div></div>
        <div class="row mt"><button class="btn primary big" data-act="gmImport">Import ${f.apps.filter((a) => a.isNew).length} application(s) and ${f.jobs.filter((x) => x.isNew).length} job(s)</button></div>` : ""}`
      : emptyState("Gmail import works on your private claude.ai page", "It uses your Gmail connector through Claude, which a local HTML file cannot reach. Open CareerOS from your claude.ai link to use it."),
  };
});
async function gmCall(tool, input) { const m = await HOOKS.mcp(); if (!m) throw new Error("Gmail connector not available"); const r = await m.callTool("Gmail", tool, input); const p = r && (r.payload !== undefined ? r.payload : r); return typeof p === "string" ? JSON.parse(p) : p; }
ACT.gmScan = async () => {
  const days = document.getElementById("gm_days").value;
  GM.busy = true; rerender();
  try {
    const threads = [];
    for (const q of ["from:jobs-noreply@linkedin.com subject:\"your application was sent\" newer_than:" + days + "d", "from:jobalerts-noreply@linkedin.com newer_than:" + days + "d"]) {
      let token = ""; let pages = 0;
      do { const r = await gmCall("search_threads", { query: q, pageSize: 50, pageToken: token || undefined, view: "THREAD_VIEW_IDS_ONLY" }); (r.threads || []).forEach((t) => threads.push({ id: t.id, kind: /application was sent/.test(q) ? "app" : "alert" })); token = r.nextPageToken; pages++; } while (token && pages < 4);
    }
    const apps = [], jobs = [], seenJ = new Set(), have = new Set(S.jobs.map((j) => (String(j.source || "").match(/jobs\/view\/(\d+)/) || [])[1]).filter(Boolean)), haveApp = new Set(S.applications.map((a) => a.liId).filter(Boolean));
    let i = 0;
    for (const t of threads) {
      i++; if (i % 10 === 0) toast("Reading email " + i + " of " + threads.length + "...", 1500);
      const th = await gmCall("get_thread", { threadId: t.id, messageFormat: "PLAIN_TEXT" });
      for (const msg of th.messages || []) {
        const text = msg.plaintextBody || ""; const date = (msg.date || "").slice(0, 10);
        if (t.kind === "app") { const a = E.parseLinkedInApplication(text); if (a && !apps.find((x) => x.liId === a.liId)) apps.push({ ...a, appliedDate: a.appliedDate || date, isNew: !haveApp.has(a.liId) }); }
        else for (const b of E.parseLinkedInBlocks(text)) if (!seenJ.has(b.liId)) { seenJ.add(b.liId); jobs.push({ ...b, date, isNew: !have.has(b.liId) }); }
      }
    }
    GM.found = { apps, jobs };
  } catch (e) { toast("Gmail scan failed: " + (e.message || e.code), 6000); }
  GM.busy = false; rerender();
};
ACT.gmImport = () => {
  const f = GM.found; let nj = 0, na = 0;
  const byLi = (id) => S.jobs.find((j) => (String(j.source || "").match(/jobs\/view\/(\d+)/) || [])[1] === id);
  for (const x of f.jobs.filter((x) => x.isNew)) { const j = { id: "LI-" + x.liId, jobId: "GM-" + x.liId, title: x.title, employer: x.company, location: x.location, country: "Saudi Arabia", type: "", seniority: "", description: "", source: x.url, applyUrl: x.url, published: x.date, firstSeen: TODAY(), deadline: "", status: "Unknown", verifiedDate: x.date, verification: "From a LinkedIn job-alert email dated " + x.date + ". Not yet verified against the live advert; open it to read the requirements.", verificationLevel: "Job-alert email (unverified)", origin: "gmail_alert", salary: "Not disclosed", tracks: [] }; j.tracks = E.inferTracks(j, E.analyzeJob(j)); S.jobs.push(j); nj++; }
  for (const a of f.apps.filter((a) => a.isNew)) {
    let j = byLi(a.liId);
    if (!j) { j = { id: "LI-" + a.liId, jobId: "GM-" + a.liId, title: a.title, employer: a.company, location: a.location, country: "Saudi Arabia", type: "", seniority: "", description: "", source: a.url, applyUrl: a.url, published: "", firstSeen: TODAY(), deadline: "", status: "Unknown", verifiedDate: a.appliedDate, verification: "From your LinkedIn application confirmation (" + a.appliedDate + ").", verificationLevel: "Application confirmation email", origin: "gmail_application", salary: "Not disclosed", tracks: [] }; j.tracks = E.inferTracks(j, E.analyzeJob(j)); S.jobs.push(j); }
    if (!appFor(j.jobId)) { S.applications.push({ id: uid("APP"), jobId: j.jobId, liId: a.liId, status: "Applied", created: TODAY(), appliedDate: a.appliedDate, deadline: "", followUp: "", contact: "", notes: "Imported from LinkedIn confirmation email", channel: "LinkedIn Easy Apply", source: "gmail_import", cvVersionId: "", packageId: "", history: [{ date: a.appliedDate, status: "Applied" }], snapshot: { title: a.title, employer: a.company, location: a.location, tracks: j.tracks } }); na++; }
  }
  invalidate(); logActivity("Gmail import: " + na + " applications, " + nj + " jobs"); save(); GM.found = null; toast("Imported " + na + " application(s) and " + nj + " job(s)", 4000); go("#/analytics");
};
