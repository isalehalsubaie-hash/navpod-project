/* CareerOS Engine 2.0 additions: career value, comparison, next best moves, readiness, career-track
   CV targets, development map, application analytics, job-alert email parsing, ATS checks based on
   Greenhouse's published parsing guidance. Extends CareerEngine; usable in browser and Node. */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory(require("./engine.js"));
  else root.CareerEngine2 = factory(root.CareerEngine);
})(typeof window !== "undefined" ? window : globalThis, function (E) {
  "use strict";
  const TRUSTED = E.TRUSTED;
  const clamp = (x) => Math.max(0, Math.min(1, x));

  // ---------------------------------------------------------------- Career value (0..100)
  const MAJOR = /aramco|sabic|sami\b|gami|gadd|ma'?aden|acwa|saudi electricity|swpc|neom|pif\b|kacst|kaust|lockheed|boeing|raytheon|bae\b|airbus|thales|siemens|ge vernova|schneider|abb\b|honeywell|hitachi|parsons|atkins|jacobs|worley|\bwood\b|kbr|bechtel|technip|wsp|egis|aecom|dar al|mckinsey|kpmg|deloitte|engie|saipem|luberef|amazon|aws\b|jensen hughes|alfanar|zamil|lenovo|jpmorgan|mastercard|visa\b|alstom|nestl|red sea|roshn|qiddiya|elm\b|saudia|alfaisal|hexagon|lucid/i;
  function careerValue(job, analysis, profile) {
    const t = ((job.title || "") + "\n" + (job.description || "")).toLowerCase();
    const f = [];
    const add = (key, label, weight, frac, why) => f.push({ key, label, weight, points: Math.round(clamp(frac) * weight * 10) / 10, why });
    const tracks = job.tracks && job.tracks.length ? job.tracks : E.inferTracks(job, analysis);
    const pr = {}; (profile.careerTracks || []).forEach((x) => (pr[x.code] = x.priority));
    const best = tracks.length ? Math.min(...tracks.map((x) => pr[x] || 4)) : 4;
    add("relevance", "Relevance to your target tracks", 25, { 1: 1, 2: 0.8, 3: 0.55, 4: 0.25 }[best], tracks.length ? "Tracks: " + tracks.map((x) => E.TRACKS[x]).join(", ") + " (your priority " + (best < 4 ? best : "not set") + ")." : "No clear career track.");
    const tech = analysis.keywords.filter((k) => ["technical", "software", "domain"].includes(k.cat)).length;
    add("learning", "Technical learning content", 20, Math.min(1, tech / 10), tech + " technical, tool or domain topics named in the advert.");
    const structured = /graduate (development )?program|\bgdp\b|rotation|rotational|apprentice|mentor|structured (training|learning)|training program|development program|tamayuz|tawteen|tamheer|on-the-job training|learning journey/.test(t);
    add("development", "Structured development", 20, structured ? 1 : /intern|co-?op|trainee|junior|fresh graduate/.test(t) ? 0.55 : 0.3, structured ? "Advert describes a structured program (rotation, mentoring or formal training)." : "No structured development described in the advert.");
    const major = MAJOR.test(job.employer || "");
    add("employer", "Employer scale (not a reputation rating)", 15, major ? 1 : 0.45, major ? "Multinational or major Saudi organisation, based on the employer's identity only. CareerOS does not rate employers." : "Smaller or unidentified employer. This says nothing about quality.");
    const projects = /giga[- ]?project|neom|red sea|qiddiya|diriyah|roshn|vision 2030|defen[cs]e|aerospace|refiner|power plant|substation|desalination|data cent(er|re)|metro|airport|mining|oil (and|&) gas|offshore/.test(t);
    add("exposure", "Exposure to major projects or sectors", 10, projects ? 1 : 0.3, projects ? "Advert names major projects or strategic sectors." : "No major project or strategic sector named.");
    const mobility = /international|secondment|abroad|global|rotation|multinational/.test(t) || analysis.keywords.some((k) => ["systemseng", "pm", "systemsintegration", "testing", "commissioning", "reliability", "bizdev"].includes(k.id));
    add("mobility", "Future mobility (transferable skills, international exposure)", 10, mobility ? 1 : 0.4, mobility ? "Builds transferable skills (systems, project, commissioning, reliability or business development) or offers international exposure." : "Narrow or location-bound role.");
    return { total: Math.round(f.reduce((s, x) => s + x.points, 0)), factors: f, note: "Career value estimates long-term usefulness from the advert text and your track priorities. It uses no salary data and no employer ratings." };
  }

  // ---------------------------------------------------------------- Comparison
  const ELW = { GREEN: 1, YELLOW: 0.85, ORANGE: 0.5, RED: 0 };
  function compareJobs(items) {
    // items: [{job, el, m, v, cov}]
    const rows = items.map((x) => {
      const dl = x.job.deadline ? Math.round((new Date(x.job.deadline) - new Date(new Date().toISOString().slice(0, 10))) / 86400000) : null;
      const urgency = dl != null && dl >= 0 && dl <= 7 ? 5 : 0;
      const priority = Math.round(ELW[x.el.label] * (0.55 * x.m.total + 0.45 * x.v.total) + urgency);
      return { ...x, deadlineDays: dl, priority };
    }).sort((a, b) => b.priority - a.priority);
    const top = rows[0];
    let why = "";
    if (top) {
      const other = rows[1];
      why = top.job.title + " at " + top.job.employer + " ranks first: eligibility " + top.el.label + ", match " + top.m.total + ", career value " + top.v.total + (top.deadlineDays != null && top.deadlineDays <= 7 ? ", and it closes in " + top.deadlineDays + " day(s)" : "") + ".";
      if (other) {
        const diffs = [];
        if (ELW[top.el.label] > ELW[other.el.label]) diffs.push("better eligibility (" + top.el.label + " vs " + other.el.label + ")");
        if (top.m.total - other.m.total >= 5) diffs.push("stronger match (+" + (top.m.total - other.m.total) + ")");
        if (top.v.total - other.v.total >= 5) diffs.push("higher career value (+" + (top.v.total - other.v.total) + ")");
        if (diffs.length) why += " Against " + other.job.title + " (" + other.job.employer + ") it has " + diffs.join(", ") + ".";
        else why += " It is close to " + other.job.title + "; apply to both if time allows.";
      }
      if (top.el.label === "RED") why = "None of the selected roles is currently reachable: all have a failed mandatory requirement. " + why;
    }
    return { rows, recommendation: why, method: "Priority = eligibility weight (Green 1, Yellow 0.85, Orange 0.5, Red 0) × (55% match + 45% career value), +5 if the deadline is within 7 days." };
  }

  // ---------------------------------------------------------------- Next best moves
  function nextBestMoves(ctx) {
    // ctx: {jobs:[{job,el,m,v}], applications, profile, master, today, cvVersions, packages}
    const moves = [];
    const today = ctx.today;
    const days = (d) => Math.round((new Date(d + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000);
    const appBy = new Map(ctx.applications.map((a) => [a.jobId, a]));
    for (const x of ctx.jobs) if (x.job.deadline && days(x.job.deadline) >= 0 && days(x.job.deadline) <= 7 && x.el.label !== "RED") {
      const a = appBy.get(x.job.jobId);
      if (a && ["Applied", "Assessment", "Interview", "Offer received", "Accepted", "Rejected", "Withdrawn"].includes(a.status)) continue;
      moves.push({ kind: "deadline", score: 100 - days(x.job.deadline), title: "Decide on " + x.job.title + " (" + x.job.employer + ")", why: "Closes in " + days(x.job.deadline) + " day(s). Eligibility " + x.el.label + ", match " + x.m.total + ".", time: "30 to 45 min", jobId: x.job.jobId, action: "job" });
    }
    for (const a of ctx.applications) if (a.followUp && a.followUp <= today && !["Rejected", "Accepted", "Withdrawn", "Offer received"].includes(a.status)) {
      const x = ctx.jobs.find((j) => j.job.jobId === a.jobId);
      moves.push({ kind: "followup", score: 90, title: "Follow up: " + (x ? x.job.title + " (" + x.job.employer + ")" : a.jobId), why: "Follow-up date " + a.followUp + (days(a.followUp) < 0 ? " (" + -days(a.followUp) + " day(s) overdue)" : " is today") + ". Status: " + a.status + ".", time: "10 min", jobId: a.jobId, action: "builder" });
    }
    for (const a of ctx.applications) if (a.status === "Interview") {
      const x = ctx.jobs.find((j) => j.job.jobId === a.jobId);
      moves.push({ kind: "interview", score: 95, title: "Prepare for the interview: " + (x ? x.job.title : a.jobId), why: "Tracker status is Interview.", time: "1 to 2 h", jobId: a.jobId, action: "interview" });
    }
    const P = ctx.profile;
    const blockedBy = (kind) => ctx.jobs.filter((x) => x.el.label === "YELLOW" && x.el.reasons.some((r) => r.kind === kind)).length;
    if (!(P.personal.nationality || {}).value) { const n = blockedBy("nationality"); if (n) moves.push({ kind: "profile", score: 85, title: "Confirm your nationality in your profile", why: n + " Yellow opportunities are waiting on it (Saudi-nationals-only adverts).", time: "1 min", action: "profile" }); }
    if (!(P.education.coopRequired || {}).value) { const n = blockedBy("coop"); if (n) moves.push({ kind: "profile", score: 70, title: "Record whether IMSIU requires co-op", why: n + " co-op adverts need a university training letter.", time: "1 min", action: "profile" }); }
    if (!(P.education.gpa || {}).value) { const n = blockedBy("gpa"); if (n) moves.push({ kind: "profile", score: 68, title: "Add your GPA", why: n + " adverts set a GPA minimum.", time: "1 min", action: "profile" }); }
    if (!ctx.master.approved) moves.push({ kind: "cv", score: 80, title: "Approve your master CV (or upload your original DOCX)", why: "Every tailored CV is copied from it.", time: "5 min", action: "cv" });
    const flags = (P.integrityFlags || []).filter((f) => f.severity === "high" && f.item && P.items.find((i) => i.id === f.item && i.status === "needs_confirmation"));
    if (flags.length) moves.push({ kind: "integrity", score: 60, title: "Resolve: " + flags[0].title, why: flags[0].detail.slice(0, 140), time: "5 min", action: "profile" });
    const prepared = new Set([...ctx.cvVersions.map((v) => v.jobId), ...ctx.packages.map((p) => p.jobId)]);
    const cand = ctx.jobs.filter((x) => ["GREEN", "YELLOW"].includes(x.el.label) && !(appBy.get(x.job.jobId) && ["Applied", "Assessment", "Interview", "Rejected", "Offer received", "Accepted", "Withdrawn"].includes(appBy.get(x.job.jobId).status)))
      .sort((a, b) => (0.55 * b.m.total + 0.45 * b.v.total) - (0.55 * a.m.total + 0.45 * a.v.total)).slice(0, 4);
    cand.forEach((x, i) => moves.push({ kind: "apply", score: 75 - i * 3, title: (prepared.has(x.job.jobId) ? "Finish and submit: " : "Tailor your CV and apply: ") + x.job.title + " (" + x.job.employer + ")", why: "Eligibility " + x.el.label + ", match " + x.m.total + ", career value " + x.v.total + ". " + ((x.el.reasons.find((r) => r.level === "YELLOW") || {}).msg || "").slice(0, 110), time: prepared.has(x.job.jobId) ? "15 to 20 min" : "40 to 60 min", jobId: x.job.jobId, action: prepared.has(x.job.jobId) ? "builder" : "optimize" }));
    return moves.sort((a, b) => b.score - a.score).slice(0, 7);
  }

  // ---------------------------------------------------------------- Application readiness
  function readiness(job, analysis, ctx) {
    const t = (job.description || "").toLowerCase();
    const items = [];
    const add = (name, needed, done, note) => items.push({ name, needed, done: !!done, note });
    const v = ctx.cvVersions.filter((x) => x.jobId === job.jobId).slice(-1)[0];
    add("Tailored CV", true, v, v ? v.name : "Create it in CV Studio");
    const pk = ctx.packages.filter((x) => x.jobId === job.jobId).slice(-1)[0];
    const clRequired = /cover letter|motivation letter|letter of motivation/.test(t);
    add("Cover letter" + (clRequired ? " (asked for in the advert)" : " (recommended)"), clRequired, pk && pk.approved && pk.approved.coverLetter, pk ? (pk.approved && pk.approved.coverLetter ? "Approved" : "Generated, not yet approved") : "Generate in Command Center");
    const portfolioRelevant = (job.tracks || []).some((x) => ["DEF", "UAV", "ROB", "ME"].includes(x)) || /portfolio/.test(t);
    add("Portfolio link", portfolioRelevant, ctx.profile.personal.portfolio, ctx.profile.personal.portfolio || "");
    const certs = analysis.constraints.certsRequired.filter((c) => c.mandatory);
    for (const c of certs) add("Certificate: " + c.name, true, false, "Required by the advert and not in your verified profile");
    const answersOpen = pk ? pk.form.filter((f) => /YOUR INPUT REQUIRED/.test(f.a)).length : null;
    add("Application form answers", true, pk && answersOpen === 0, pk ? (answersOpen ? answersOpen + " answer(s) still need your input" : "Complete") : "Generate in Command Center");
    if (analysis.constraints.gpa || /transcript/.test(t)) add("Transcript", true, false, "Have your latest official transcript ready");
    if (analysis.constraints.nationality === "saudi" || analysis.constraints.tamheer) add("National ID copy", true, false, "Saudi-only or Tamheer role");
    if (analysis.constraints.coopLetter) add("University training letter", true, false, "Ask IMSIU co-op office");
    if (/recommendation|reference letter/.test(t)) add("Recommendation letter", true, false, "The Defensathon letter still has blank title and contact fields");
    const need = items.filter((i) => i.needed);
    const score = need.length ? Math.round((need.filter((i) => i.done).length / need.length) * 100) : 100;
    return { items, score, missing: need.filter((i) => !i.done).map((i) => i.name), note: "Readiness counts what you have prepared. It is not a chance of being hired." };
  }

  // ---------------------------------------------------------------- Career-track CV targets
  const TRACK_CV = { ME: "Mechanical Engineering", DEF: "UAV and Aerospace", INSP: "Safety and Inspection", PM: "Project Engineering", BD: "Business and Technical Development" };
  function trackTargets(jobs) {
    const out = [];
    for (const [code, name] of Object.entries(TRACK_CV)) {
      const set = code === "DEF" ? ["DEF", "UAV", "ROB"] : code === "INSP" ? ["INSP", "HSE"] : code === "BD" ? ["BD", "STRAT"] : [code];
      const rel = jobs.filter((j) => (j.tracks || []).some((t) => set.includes(t)));
      const freq = {};
      rel.forEach((j) => E.analyzeJob(j).keywords.forEach((k) => { if (k.cat !== "soft" && k.cat !== "regulatory") freq[k.term] = (freq[k.term] || 0) + 1; }));
      const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k]) => k);
      out.push({ id: "TRACK-" + code, jobId: "TRACK-" + code, isTrack: true, title: name + " CV", employer: "", location: "Riyadh, Saudi Arabia", type: "Full-time", tracks: [code === "DEF" ? "DEF" : code, ...set.filter((s) => s !== code)].slice(0, 2), status: "Open", verifiedDate: "", source: "", applyUrl: "", basedOn: rel.length,
        description: "Career-track target built from the " + rel.length + " active adverts in this track. Requirements:\n- " + top.join("\n- ") });
    }
    return out;
  }

  // ---------------------------------------------------------------- Development map
  const RES = {
    maintenance: { kind: "Competence", cost: "Free to low", time: "2 to 4 weeks", res: [["Coursera: maintenance and reliability courses (audit for free)", "https://www.coursera.org/search?query=maintenance%20reliability"]] },
    reliability: { kind: "Competence", cost: "Free to low", time: "2 to 4 weeks", res: [["Coursera: reliability engineering (audit)", "https://www.coursera.org/search?query=reliability%20engineering"], ["SMRP CMRP (later; experience expected)", "https://smrp.org"]] },
    planning: { kind: "Tool", cost: "Free to medium", time: "2 to 3 weeks", res: [["Coursera: project scheduling / Primavera (audit)", "https://www.coursera.org/search?query=primavera%20p6"], ["Oracle Primavera P6 product page", "https://www.oracle.com/construction-engineering/primavera-p6/"]] },
    commissioning: { kind: "Competence", cost: "Free to low", time: "2 weeks", res: [["Coursera: building commissioning and MEP (audit)", "https://www.coursera.org/search?query=building%20commissioning"]] },
    leansix: { kind: "Certification", cost: "Free to low", time: "1 to 3 weeks", res: [["Council for Six Sigma Certification: free self-study guides", "https://www.sixsigmacouncil.org/"]] },
    qaqc: { kind: "Certification", cost: "Low to medium", time: "1 to 2 weeks", res: [["ISO 9001 internal auditor courses (various accredited providers)", "https://www.iso.org/iso-9001-quality-management.html"]] },
    office: { kind: "Tool", cost: "Free", time: "1 week", res: [["Microsoft Learn (free)", "https://learn.microsoft.com/training/"]] },
    excel: { kind: "Tool", cost: "Free", time: "1 week", res: [["Microsoft Learn: Excel (free)", "https://learn.microsoft.com/training/"]] },
    powerbi: { kind: "Tool", cost: "Free", time: "1 to 2 weeks", res: [["Microsoft Learn: Power BI (free)", "https://learn.microsoft.com/training/powerplatform/power-bi"]] },
    autocad: { kind: "Tool", cost: "Free for students", time: "2 weeks", res: [["Autodesk Education: free student access to AutoCAD, Revit, Inventor, Navisworks", "https://www.autodesk.com/education/edu-software/overview"]] },
    revit: { kind: "Tool", cost: "Free for students", time: "3 weeks", res: [["Autodesk Education (free student licence)", "https://www.autodesk.com/education/edu-software/overview"]] },
    navisworks: { kind: "Tool", cost: "Free for students", time: "1 week", res: [["Autodesk Education (free student licence)", "https://www.autodesk.com/education/edu-software/overview"]] },
    bim: { kind: "Competence", cost: "Free for students", time: "3 weeks", res: [["Autodesk Education (Revit, Navisworks)", "https://www.autodesk.com/education/edu-software/overview"]] },
    ansys: { kind: "Tool", cost: "Free", time: "2 to 4 weeks", res: [["Ansys Innovation Courses (free)", "https://innovationspace.ansys.com/courses/"]] },
    sap: { kind: "Tool", cost: "Free", time: "2 weeks", res: [["SAP Learning (free learning journeys)", "https://learning.sap.com"]] },
    gis: { kind: "Tool", cost: "Free", time: "6 weeks (MOOC)", res: [["Esri MOOCs (free)", "https://www.esri.com/training/mooc/"]] },
    arcgis: { kind: "Tool", cost: "Free", time: "6 weeks (MOOC)", res: [["Esri MOOCs (free)", "https://www.esri.com/training/mooc/"]] },
    python: { kind: "Tool", cost: "Free", time: "3 weeks", res: [["The Python Tutorial (python.org)", "https://docs.python.org/3/tutorial/"]] },
    ros: { kind: "Tool", cost: "Free", time: "3 weeks", res: [["ROS 2 official tutorials", "https://docs.ros.org/"]] },
    hse: { kind: "Certification", cost: "Low to high", time: "1 to 10 weeks", res: [["Finish your in-progress OSHA course first", ""], ["NEBOSH International General Certificate (higher cost)", "https://www.nebosh.org.uk/"]] },
    nebosh: { kind: "Certification", cost: "High", time: "8 to 10 weeks", res: [["NEBOSH IGC", "https://www.nebosh.org.uk/"]] },
    sce: { kind: "Registration", cost: "Registration fee", time: "After graduation", res: [["Saudi Council of Engineers e-services", "https://www.saudieng.sa"]] },
    pmp: { kind: "Certification", cost: "High", time: "Needs 3+ years experience", res: [["Finish CAPM first (in progress)", "https://www.pmi.org/certifications/certified-associate-capm"]] },
    thermography: { kind: "Certification", cost: "Medium to high", time: "1 week course", res: [["Infrared Training Center (Level I thermography)", "https://www.infraredtraining.com/"]] },
    ndt: { kind: "Certification", cost: "Medium", time: "1 to 2 weeks per method", res: [["ASNT certification overview", "https://www.asnt.org/"]] },
  };
  function devMap(ctx) {
    // ctx: {jobs:[{job,a,el}], idx, profile}
    const pr = {}; (ctx.profile.careerTracks || []).forEach((t) => (pr[t.code] = t.priority));
    const g = {};
    for (const x of ctx.jobs) {
      if (x.el.label === "RED") continue;
      const rel = (x.job.tracks || []).some((t) => (pr[t] || 4) <= 2);
      const mand = new Set(x.a.requirements.filter((r) => r.importance === "mandatory").flatMap((r) => r.keywords));
      for (const k of x.a.keywords) {
        if (["soft", "education"].includes(k.cat) || ["saudinational", "coop"].includes(k.id)) continue;
        const ev = ctx.idx[k.id];
        if (ev && ev.trusted.length) continue;
        const o = (g[k.id] = g[k.id] || { id: k.id, term: k.term, cat: k.cat, n: 0, relevant: 0, mandatory: 0, unconfirmed: !!(ev && ev.unverified.length) });
        o.n++; if (rel) o.relevant++; if (mand.has(k.id)) o.mandatory++;
      }
    }
    const reachable = ctx.jobs.filter((x) => x.el.label !== "RED").length || 1;
    const list = Object.values(g).filter((o) => o.n >= 2).map((o) => {
      const r = RES[o.id] || { kind: o.cat === "cert" ? "Certification" : o.cat === "software" ? "Tool" : "Competence", cost: "Check providers", time: "Varies", res: [["Coursera search (audit for free)", "https://www.coursera.org/search?query=" + encodeURIComponent(o.term)]] };
      const costScore = /^free/i.test(r.cost) ? 1 : /low/i.test(r.cost) ? 0.75 : /medium/i.test(r.cost) ? 0.5 : 0.25;
      const benefit = o.n / reachable;
      const rank = Math.round((0.45 * Math.min(1, o.n / 20) + 0.25 * (o.relevant / o.n) + 0.15 * costScore + 0.15 * Math.min(1, o.mandatory / 5)) * 100);
      const tier = o.mandatory >= 5 || (o.id === "sce") ? "Essential" : o.n >= 8 ? "Competitive advantage" : "Optional development";
      return { ...o, rank, tier, share: Math.round(benefit * 100), ...r };
    }).sort((a, b) => b.rank - a.rank);
    const roadmap = [
      { when: "This week (free)", items: list.filter((x) => /free/i.test(x.cost)).slice(0, 3).map((x) => x.term) },
      { when: "Before graduation (Jan 2027)", items: ["Finish CAPM and OSHA (in progress)", ...list.filter((x) => x.tier !== "Optional development" && !/high/i.test(x.cost)).slice(0, 3).map((x) => x.term)] },
      { when: "First 6 months after graduation", items: ["Register with the Saudi Council of Engineers", ...list.filter((x) => /high|medium/i.test(x.cost) && x.tier !== "Optional development").slice(0, 2).map((x) => x.term)] },
    ];
    return { list, roadmap, reachable, note: "Ranked by frequency in reachable adverts (45%), relevance to your priority tracks (25%), cost (15%) and how often the item is mandatory (15%). Costs are bands, not quotes; check each provider. Expensive certifications are never ranked first on cost." };
  }

  // ---------------------------------------------------------------- Analytics
  const RESPONDED = new Set(["Assessment", "Interview", "Rejected", "Offer received", "Accepted"]);
  const SUBMITTED = new Set(["Applied", "Assessment", "Interview", "Rejected", "Offer received", "Accepted", "Follow-up required"]);
  function analytics(ctx) {
    // ctx: {applications, jobById(id), versionName(id), discovered, saved}
    const subs = ctx.applications.filter((a) => SUBMITTED.has(a.status));
    const group = (keyFn) => { const m = {}; for (const a of subs) { const ks = [].concat(keyFn(a) || "Unknown"); for (const k of ks) { const o = (m[k] = m[k] || { key: k, n: 0, responses: 0, interviews: 0, offers: 0 }); o.n++; if (RESPONDED.has(a.status)) o.responses++; if (["Interview", "Offer received", "Accepted"].includes(a.status)) o.interviews++; if (["Offer received", "Accepted"].includes(a.status)) o.offers++; } } return Object.values(m).sort((a, b) => b.n - a.n); };
    const job = (a) => ctx.jobById(a.jobId) || a.snapshot || {};
    const out = {
      discovered: ctx.discovered, saved: ctx.applications.length, submitted: subs.length,
      responses: subs.filter((a) => RESPONDED.has(a.status)).length,
      interviews: subs.filter((a) => ["Interview", "Offer received", "Accepted"].includes(a.status)).length,
      offers: subs.filter((a) => ["Offer received", "Accepted"].includes(a.status)).length,
      byTrack: group((a) => (job(a).tracks || []).map((t) => E.TRACKS[t] || t)),
      byLocation: group((a) => { const l = (job(a).location || "").split(",")[0].trim(); return l || "Unknown"; }),
      byChannel: group((a) => a.channel || "Not recorded"),
      byVersion: group((a) => (a.cvVersionId ? "Tailored CV" : "Master or other CV")),
      byEmployer: group((a) => job(a).employer || "Unknown"),
      byMonth: group((a) => (a.appliedDate || a.created || "").slice(0, 7) || "Unknown"),
      avgMatch: null,
    };
    const ms = subs.map((a) => ctx.matchFor(a.jobId)).filter((x) => x != null);
    out.avgMatch = ms.length ? Math.round(ms.reduce((s, x) => s + x, 0) / ms.length) : null;
    out.responseRate = subs.length ? Math.round((out.responses / subs.length) * 100) : null;
    out.interviewRate = subs.length ? Math.round((out.interviews / subs.length) * 100) : null;
    const obs = [];
    if (subs.length < 20) obs.push("Only " + subs.length + " submitted application(s) recorded. Patterns below are too small to draw conclusions from.");
    const noResp = subs.filter((a) => a.status === "Applied" && a.appliedDate && (new Date() - new Date(a.appliedDate)) / 86400000 > 21).length;
    if (noResp) obs.push(noResp + " application(s) have had no recorded response for more than 3 weeks. Update their status or send a follow-up.");
    const tr = out.byTrack.filter((x) => x.n >= 5).sort((a, b) => b.responses / b.n - a.responses / a.n);
    if (tr.length >= 2 && tr[0].responses > 0) obs.push("Highest recorded response rate so far: " + tr[0].key + " (" + tr[0].responses + " of " + tr[0].n + "). Correlation only, not cause.");
    const ch = out.byChannel.filter((x) => x.n >= 5);
    if (ch.length) obs.push("Most used channel: " + ch[0].key + " (" + ch[0].n + " applications, " + ch[0].responses + " responses recorded).");
    const unmatched = subs.filter((a) => !ctx.jobById(a.jobId)).length;
    if (unmatched) obs.push(unmatched + " imported application(s) are for jobs outside the researched database, so their match score is unknown.");
    out.observations = obs;
    return out;
  }

  // ---------------------------------------------------------------- Job-alert and confirmation email parsing (LinkedIn)
  function parseLinkedInBlocks(text) {
    const jobs = [];
    const parts = text.split(/\n-{20,}\n?/);
    for (const part of parts) {
      const m = part.match(/View job:\s*(https:\/\/www\.linkedin\.com\/(?:comm\/)?jobs\/view\/(\d+))/);
      if (!m) continue;
      const before = part.slice(0, part.indexOf("View job:")).split("\n").map((s) => s.trim()).filter(Boolean)
        .filter((s) => !/^(\d+ (connection|school alum)|Apply with resume|Fast growing|This company is actively hiring|Actively recruiting|Easy Apply|Promoted|Be an early applicant|\d+ applicants?)/i.test(s) && !/^(Your job alert|New jobs match|Manage alerts|See all jobs|New jobs from|<strong|Now, take these|View similar jobs|Your application was sent|Applied on)/i.test(s) && !/^https?:/.test(s));
      if (before.length < 3) continue;
      const [title, company, location] = before.slice(-3);
      jobs.push({ title, company, location, liId: m[2], url: "https://www.linkedin.com/jobs/view/" + m[2] + "/" });
    }
    return jobs;
  }
  function parseLinkedInApplication(text) {
    const mTo = text.match(/Your application was sent to ([^\n]+)/);
    if (!mTo) return null;
    const head = text.split(/Now, take these next steps|View similar jobs/)[0];
    const blocks = parseLinkedInBlocks(head);
    const applied = (text.match(/Applied on ([A-Z][a-z]+ \d{1,2}, \d{4})/) || [])[1];
    const b = blocks[0];
    if (!b) return null;
    const d = applied ? new Date(applied + " 12:00 UTC") : null;
    return { ...b, appliedDate: d && !isNaN(d) ? d.toISOString().slice(0, 10) : "", sentTo: mTo[1].trim() };
  }

  // ---------------------------------------------------------------- ATS checks based on Greenhouse's published guidance
  const GREENHOUSE = "https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse";
  function atsGreenhouse(model, fileSize) {
    const text = model.paragraphs.map((p) => p.text).join("\n");
    const checks = [];
    const add = (name, result, detail) => checks.push({ name, result, detail, source: GREENHOUSE });
    add("Spaces between letters", /\b(?:[A-Za-z] ){4,}[A-Za-z]\b/.test(text) ? "fail" : "pass", "Greenhouse lists 'spaces between the letters' (for example S A L E H) as a parse failure.");
    add("Graphics, photos or word art", model.meta.images ? "warn" : "pass", model.meta.images ? model.meta.images + " image(s) found." : "None found.");
    add("Uploaded as an image", text.length > 400 ? "pass" : "fail", text.length > 400 ? "Real text layer extracted (" + text.length + " characters)." : "Almost no text: likely an image.");
    add("Tables, headers and footers", model.meta.tables || model.meta.headerText || model.meta.footerText ? "warn" : "pass", "Tables: " + model.meta.tables + ", header text: " + (model.meta.headerText ? "yes" : "no") + ", footer text: " + (model.meta.footerText ? "yes" : "no") + ".");
    add("Contact details in header, footer or text box", /@|\+966/.test((model.meta.headerText || "") + (model.meta.footerText || "")) || model.meta.textboxes ? "fail" : "pass", "Name and contact are in the document body.");
    add("Columned layout", model.meta.columns > 1 ? "fail" : "pass", model.meta.columns > 1 ? "Section uses " + model.meta.columns + " columns." : "Single column.");
    const heads = model.paragraphs.filter((p) => p.isHeading).length;
    add("Clear sections", heads >= 4 ? "pass" : "warn", heads + " section headings detected.");
    const orgs = model.paragraphs.filter((p) => /\t/.test(p.text) && /,/.test(p.text.split("\t")[0])).map((p) => p.text.split("\t")[0].split(",").slice(1).join(",").trim()).filter(Boolean);
    const noSuffix = orgs.filter((o) => !/\b(inc|co|ltd|llc|company|corporation|group|systems|construction|university|academy|association|robotics|institute)\b/i.test(o));
    add("Company names with identifying words", noSuffix.length ? "warn" : "pass", noSuffix.length ? "Greenhouse notes that company names without words like Inc., Co., LTD or LLC can parse poorly: " + noSuffix.join(", ") + ". Consider the full legal or descriptive name if you know it." : "Employer names include identifying words.");
    const abbr = model.paragraphs.filter((p) => /\t/.test(p.text)).map((p) => p.text.split(",")[0]).filter((t) => /\b(Sr|Jr|Eng|Mgr|Asst|Exec|Dept)\.?\b/.test(t));
    add("Complete job titles", abbr.length ? "warn" : "pass", abbr.length ? "Abbreviated titles: " + abbr.join("; ") : "No abbreviated job titles found.");
    if (fileSize != null) add("File size under 2.5 MB", fileSize <= 2.5 * 1024 * 1024 ? "pass" : "fail", Math.round(fileSize / 1024) + " KB.");
    return { checks, source: GREENHOUSE, note: "Based on Greenhouse's published list of causes of unsuccessful parsing. Workday, Lever and iCIMS do not publish equivalent public pages that could be verified; third-party guides suggest the same risks (tables, columns, text boxes, image-only files). This is a risk check, not a reproduction of any ranking algorithm." };
  }

  return Object.assign({}, E, { careerValue, compareJobs, nextBestMoves, readiness, trackTargets, TRACK_CV, devMap, analytics, parseLinkedInBlocks, parseLinkedInApplication, atsGreenhouse, GREENHOUSE });
});
