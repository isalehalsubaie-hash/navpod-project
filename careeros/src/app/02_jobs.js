/* Discover Opportunities, Job details, Job Analysis input. */
const F = { show: 30, showApplied: false, q: "", tab: "apply", city: "", company: "", track: "", elig: "", minScore: 0, type: "", level: "", exp: "", deadline: "", recent: "", sort: "match", paid: "" };
function jobCity(j) { const l = (j.location || "").toLowerCase(); if (/remote/.test(l)) return "Remote"; if (/riyadh|الرياض|kharj/.test(l)) return "Riyadh"; if (/jedd|jidd/.test(l)) return "Jeddah"; if (/makkah|mecca|kaec|king abdullah|rabigh/.test(l)) return "Makkah Region"; if (/dammam/.test(l)) return "Dammam"; if (/khobar/.test(l)) return "Khobar"; if (/dhahran/.test(l)) return "Dhahran"; if (/jubail|jubayl/.test(l)) return "Jubail"; if (/yanbu/.test(l)) return "Yanbu"; if (/neom/.test(l)) return "NEOM"; if (/eastern|ras al|qatif/.test(l)) return "Eastern Province (other)"; if (/madinah|medina/.test(l)) return "Madinah Region"; if (/tabuk|duba/.test(l)) return "Tabuk"; if (/dubai|abu dhabi|uae|emirates|qatar|doha|kuwait|bahrain|oman|muscat/.test(l)) return "GCC"; if (/saudi/.test(l)) return "Saudi Arabia (unspecified)"; return "Other Saudi"; }
function jobKind(j) { const t = ((j.type || "") + " " + (j.title || "")).toLowerCase(); if (/intern|co-?op|summer|trainee|tamheer|apprentic/.test(t)) return "Internship / trainee"; if (/graduate|gdp|development program|fresh/.test(t)) return "Graduate program / fresh grad"; if (/contract/.test(t)) return "Contract"; return "Full-time"; }
function paidLabel(j) { if (j.salary && j.salary !== "Not disclosed") return "Paid: " + j.salary; if (/volunteer|unpaid/i.test((j.type || "") + (j.description || "").slice(0, 3000)) && !/stipend|allowance|salary|paid/i.test(j.description || "")) return "Unpaid or not stated"; return "Compensation not disclosed"; }
function filteredJobs() {
  let list = S.jobs.slice();
  const q = F.q.trim().toLowerCase();
  if (F.tab === "apply") list = list.filter((j) => !isExpired(j) && ["GREEN", "YELLOW"].includes(C(j).el.label));
  else if (F.tab === "stretch") list = list.filter((j) => !isExpired(j) && C(j).el.label === "ORANGE");
  else if (F.tab === "red") list = list.filter((j) => !isExpired(j) && C(j).el.label === "RED");
  else if (F.tab === "all") list = list.filter((j) => !isExpired(j));
  if (!F.showApplied) list = list.filter((j) => !alreadyApplied(j));
  if (q) list = list.filter((j) => (j.title + " " + j.employer + " " + j.location + " " + (j.description || "").slice(0, 4000)).toLowerCase().includes(q));
  if (F.city) list = list.filter((j) => jobCity(j) === F.city);
  if (F.company) list = list.filter((j) => j.employer === F.company);
  if (F.track) list = list.filter((j) => (j.tracks || []).includes(F.track));
  if (F.elig) list = list.filter((j) => C(j).el.label === F.elig);
  if (F.minScore) list = list.filter((j) => C(j).m.total >= F.minScore);
  if (F.type) list = list.filter((j) => jobKind(j) === F.type);
  if (F.level === "student") list = list.filter((j) => C(j).a.constraints.studentOnly || /intern|co-?op/i.test(j.title + j.type));
  if (F.level === "graduate") list = list.filter((j) => /graduate|fresh|gdp|tamheer|trainee|entry/i.test(j.title + " " + j.seniority) || C(j).a.constraints.entry);
  if (F.exp === "0") list = list.filter((j) => !(C(j).a.constraints.minYears > 0));
  if (F.exp === "1-2") list = list.filter((j) => C(j).a.constraints.minYears >= 1 && C(j).a.constraints.minYears <= 2);
  if (F.exp === "3+") list = list.filter((j) => C(j).a.constraints.minYears >= 3);
  if (F.deadline === "has") list = list.filter((j) => j.deadline);
  if (F.deadline === "30") list = list.filter((j) => j.deadline && daysUntil(j.deadline) <= 30);
  if (F.recent) list = list.filter((j) => j.published && daysUntil(j.published) >= -parseInt(F.recent, 10));
  if (F.paid === "paid") list = list.filter((j) => /^Paid/.test(paidLabel(j)));
  if (F.paid === "unpaid") list = list.filter((j) => /Unpaid/.test(paidLabel(j)));
  const sorters = {
    match: (a, b) => C(b).m.total - C(a).m.total,
    newest: (a, b) => (b.published || "").localeCompare(a.published || ""),
    deadline: (a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999"),
    riyadh: (a, b) => (jobCity(b) === "Riyadh") - (jobCity(a) === "Riyadh") || C(b).m.total - C(a).m.total,
    dev: (a, b) => (C(b).m.factors.find((f) => f.key === "development").points - C(a).m.factors.find((f) => f.key === "development").points) || C(b).m.total - C(a).m.total,
    value: (a, b) => C(b).v.total - C(a).v.total || C(b).m.total - C(a).m.total,
  };
  return list.sort(sorters[F.sort] || sorters.match);
}
function jobCard(j) {
  const c = C(j), app = appFor(j.jobId);
  const top = c.el.reasons.find((r) => !["PASS", "NOTE"].includes(r.level));
  return `<div class="job">
    <div class="row between" style="align-items:flex-start;flex-wrap:nowrap"><div style="min-width:0"><a class="t" href="#/job/${j.jobId}">${esc(j.title)}</a> ${isNew(j) ? '<span class="badge-new">NEW</span>' : ""}<div class="c">${esc(j.employer)} · ${esc(j.location)}</div></div>
      <div class="scores"><div class="s"><span>Match</span><b class="score">${c.m.total}</b></div><div class="s"><span>Value</span><b class="score">${c.v.total}</b></div></div></div>
    <div class="meta">${elPill(c.el.label)}<span class="pill">${esc(jobKind(j))}</span>${(j.tracks || []).slice(0, 2).map((t) => `<span class="pill">${esc(trackName(t))}</span>`).join("")}${j.deadline ? `<span class="pill" style="border-color:#efc2c2">Deadline ${fmtDate(j.deadline)}</span>` : ""}${app ? `<span class="pill">Tracker: ${esc(app.status)}</span>` : ""}</div>
    ${top ? `<div class="reason">${esc(top.msg)}</div>` : ""}
    <div class="tiny muted">Published ${j.published ? fmtDate(j.published) : "not stated"} · Verified ${fmtDate(j.verifiedDate)} · ${esc(paidLabel(j))}</div>
    <div class="foot"><a class="btn sm primary" href="#/job/${j.jobId}">Open analysis</a><a class="btn sm" href="#/optimize/${j.jobId}">Tailor CV</a>
      ${app ? "" : `<button class="btn sm" data-act="track" data-id="${j.jobId}">Save</button>`}<button class="btn sm ${(S.compareIds || []).includes(j.jobId) ? "primary" : ""}" data-act="cmpToggle" data-id="${j.jobId}">⇄ Compare</button><a class="btn sm ghost" href="${esc(j.applyUrl || j.source)}" target="_blank" rel="noopener">Advert ↗</a></div>
  </div>`;
}
function jobRow(j) {
  const c = C(j);
  return `<tr><td><a href="#/job/${j.jobId}"><b>${esc(j.title)}</b></a><div class="tiny muted">${esc(j.jobId)}</div></td><td>${esc(j.employer)}</td><td>${esc(j.location)}</td><td>${esc(jobKind(j))}</td><td>${(j.tracks || []).map(trackName).join(", ")}</td>
    <td>${elPill(c.el.label)}</td><td class="num">${c.m.total}</td><td class="num">${c.v.total}</td><td>${j.published ? fmtDate(j.published) : "-"}</td><td>${j.deadline ? fmtDate(j.deadline) : "-"}</td><td><a href="${esc(j.applyUrl || j.source)}" target="_blank" rel="noopener">Apply ↗</a></td></tr>`;
}
route("discover", () => {
  const appliedN = S.jobs.filter((j) => !isExpired(j) && alreadyApplied(j)).length;
  const all = S.jobs.filter((j) => !isExpired(j) && (F.showApplied || !alreadyApplied(j)));
  const counts = { apply: all.filter((j) => ["GREEN", "YELLOW"].includes(C(j).el.label)).length, stretch: all.filter((j) => C(j).el.label === "ORANGE").length, red: all.filter((j) => C(j).el.label === "RED").length, all: all.length, expired: S.excluded.length + S.jobs.filter(isExpired).length };
  const opt = (arr, cur) => arr.map((v) => `<option ${v[0] === String(cur) ? "selected" : ""} value="${esc(v[0])}">${esc(v[1])}</option>`).join("");
  const cities = [...new Set(S.jobs.map(jobCity))].sort();
  const companies = [...new Set(S.jobs.map((j) => j.employer))].sort();
  let body;
  if (F.tab === "expired") {
    const rows = [...S.jobs.filter(isExpired).map((j) => ({ id: j.jobId, title: j.title, employer: j.employer, category: "Expired", reason: j.status === "Closed" ? "Closed" : "Deadline passed " + j.deadline, source: j.source })), ...S.excluded];
    body = `<div class="note mb">Historical, expired, upcoming-but-not-open and excluded records are kept here, separate from active opportunities. Each has a reason.</div>
      <div class="tablewrap"><table><thead><tr><th>Category</th><th>Title</th><th>Employer</th><th>Reason</th><th>Source</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.category || "Excluded")}</td><td>${esc(r.title)}</td><td>${esc(r.employer)}</td><td class="small">${esc(r.reason)}</td><td>${r.source ? `<a href="${esc(r.source)}" target="_blank" rel="noopener">Open ↗</a>` : ""}</td></tr>`).join("")}</tbody></table></div>`;
  } else {
    body = `<div id="discBody">${discoverBody()}</div>`;
  }
  return {
    title: "Discover Opportunities", sub: "Researched " + fmtDate(S.researchDate) + " · " + S.jobs.length + " opportunities in the database",
    actions: `${HOOKS.mcp ? `<a class="btn" href="#/gmail">Import job alerts from Gmail</a>` : ""}<button class="btn" data-act="refresh">Refresh opportunities</button><a class="btn" href="#/compare">Compare (${(S.compareIds || []).length})</a><a class="btn primary" href="#/analysis">+ Add a job</a>`,
    html: `<div class="tabs">${[["apply", "Apply Now (Green + Yellow)"], ["stretch", "Stretch (Orange)"], ["red", "Not eligible (Red)"], ["all", "All active"], ["expired", "Expired & excluded"]].map(([k, l]) => `<a class="${F.tab === k ? "on" : ""}" data-act="tab" data-t="${k}">${l} <span class="muted">${counts[k]}</span></a>`).join("")}</div>
    ${F.tab === "expired" ? "" : `<input type="search" placeholder="Search title, company or advert text" value="${esc(F.q)}" data-inp="fq" class="mb" style="width:100%">
    <div class="chips mb">${["", "Riyadh", "Jeddah", "Dammam", "Khobar", "Dhahran", "Jubail", "Yanbu", "NEOM", "GCC", "Remote"].map((c) => `<button class="chip ${F.city === c ? "on" : ""}" data-act="cityChip" data-c="${c}">${c || "All locations"}</button>`).join("")}</div>
    ${appliedN ? `<div class="tiny muted mb">${F.showApplied ? "Including" : "Hiding"} ${appliedN} job${appliedN === 1 ? "" : "s"} you already applied to (they stay in your tracker). <button class="btn sm ghost" data-act="toggleApplied">${F.showApplied ? "Hide them" : "Show them"}</button></div>` : ""}
    <details class="mb" id="fdet" ${window.innerWidth > 820 ? "open" : ""}><summary>Filters and sorting${activeFilterCount() ? " (" + activeFilterCount() + " active)" : ""}</summary><div class="filters mt">
      <select data-chg="f" data-k="city"><option value="">All cities</option>${opt(cities.map((c) => [c, c]), F.city)}</select>
      <select data-chg="f" data-k="company" style="max-width:180px"><option value="">All companies</option>${opt(companies.map((c) => [c, c]), F.company)}</select>
      <select data-chg="f" data-k="track"><option value="">All career tracks</option>${opt(Object.entries(TRACKS), F.track)}</select>
      <select data-chg="f" data-k="elig"><option value="">Any eligibility</option>${opt([["GREEN", "Green"], ["YELLOW", "Yellow"], ["ORANGE", "Orange"], ["RED", "Red"]], F.elig)}</select>
      <select data-chg="f" data-k="minScore"><option value="0">Any match</option>${opt([["50", "Match 50+"], ["60", "Match 60+"], ["70", "Match 70+"], ["80", "Match 80+"]], F.minScore)}</select>
      <select data-chg="f" data-k="type"><option value="">Internship / full-time</option>${opt([["Internship / trainee", "Internship / trainee"], ["Graduate program / fresh grad", "Graduate program / fresh grad"], ["Full-time", "Full-time"], ["Contract", "Contract"]], F.type)}</select>
      <select data-chg="f" data-k="level"><option value="">Student or graduate</option>${opt([["student", "Student roles"], ["graduate", "Graduate / entry roles"]], F.level)}</select>
      <select data-chg="f" data-k="exp"><option value="">Any experience</option>${opt([["0", "No minimum stated"], ["1-2", "1 to 2 years"], ["3+", "3+ years"]], F.exp)}</select>
      <select data-chg="f" data-k="deadline"><option value="">Any deadline</option>${opt([["has", "Has a deadline"], ["30", "Deadline within 30 days"]], F.deadline)}</select>
      <select data-chg="f" data-k="recent"><option value="">Any publish date</option>${opt([["7", "Last 7 days"], ["14", "Last 14 days"], ["30", "Last 30 days"]], F.recent)}</select>
      <select data-chg="f" data-k="paid"><option value="">Paid / unpaid</option>${opt([["paid", "Salary stated"], ["unpaid", "Unpaid or not stated"]], F.paid)}</select>
      <select data-chg="f" data-k="sort">${opt([["match", "Sort: highest match"], ["newest", "Sort: newest"], ["deadline", "Sort: closest deadline"], ["riyadh", "Sort: Riyadh first"], ["dev", "Sort: career development"], ["value", "Sort: career value"]], F.sort)}</select>
      <span class="row" style="gap:4px">${[["DEF", "Defence/UAV"], ["ME", "Mechanical"], ["INSP", "Safety & inspection"], ["ENERGY", "Energy & industrial"]].map(([k, l]) => `<button class="btn sm ${F.track === k ? "primary" : ""}" data-act="quick" data-k="${k}">${l}</button>`).join("")}</span>
      <button class="btn sm ghost" data-act="clearF">Clear</button></div></details>`}
    ${body}`,
  };
});

function discoverBody() {
    let body;
    const list = filteredJobs();
    body = `<div class="row between mb"><div class="small muted">${list.length} opportunit${list.length === 1 ? "y" : "ies"} shown</div>
      <div class="row"><button class="btn sm ${S.settings.discoverView === "cards" ? "primary" : ""}" data-act="view" data-v="cards">Cards</button><button class="btn sm ${S.settings.discoverView === "table" ? "primary" : ""}" data-act="view" data-v="table">Table</button></div></div>` +
      (list.length ? (S.settings.discoverView === "table"
        ? `<div class="tablewrap"><table><thead><tr><th>Job</th><th>Employer</th><th>Location</th><th>Type</th><th>Track</th><th>Eligibility</th><th class="num">Match</th><th class="num">Value</th><th>Published</th><th>Deadline</th><th>Link</th></tr></thead><tbody>${list.slice(0, F.show * 2).map(jobRow).join("")}</tbody></table></div>${list.length > F.show * 2 ? `<div class="row mt" style="justify-content:center"><button class="btn" data-act="showMore">Show more (${list.length - F.show * 2} left)</button></div>` : ""}`
        : `<div class="jobs">${list.slice(0, F.show).map(jobCard).join("")}</div>${list.length > F.show ? `<div class="row mt" style="justify-content:center"><button class="btn" data-act="showMore">Show ${Math.min(30, list.length - F.show)} more (${list.length - F.show} left)</button></div>` : ""}`)
        : `<div class="empty">No opportunities match these filters.</div>`);
    return body;
}
ACT.tab = (d) => { F.tab = d.t; F.show = 30; render(); };
ACT.showMore = () => { F.show += 30; rerender(); };
ACT.f = (d, t) => { F[d.k] = d.k === "minScore" ? parseInt(t.value, 10) : t.value; F.show = 30; rerender(); };
let fqTimer;
ACT.fq = (d, t) => { F.q = t.value; F.show = 30; clearTimeout(fqTimer); fqTimer = setTimeout(() => { const el = document.getElementById("discBody"); if (el) { el.innerHTML = discoverBody(); labelTables(el); } else rerender(); }, 220); };
ACT.quick = (d) => { if (d.k === "DEF") { F.track = F.track === "DEF" ? "" : "DEF"; } else F.track = F.track === d.k ? "" : d.k; rerender(); };
ACT.clearF = () => { Object.assign(F, { q: "", city: "", company: "", track: "", elig: "", minScore: 0, type: "", level: "", exp: "", deadline: "", recent: "", paid: "", sort: "match" }); rerender(); };
ACT.view = (d) => { S.settings.discoverView = d.v; save(); rerender(); };
ACT.track = (d) => { addToTracker(d.id); rerender(); };
function addToTracker(jobId, status) {
  let a = appFor(jobId);
  const j = jobById(jobId);
  if (!a) {
    a = { id: uid("APP"), jobId, snapshot: { title: j.title, employer: j.employer, location: j.location, tracks: j.tracks || [], source: j.source }, status: status || "Interested", created: TODAY(), appliedDate: "", deadline: j.deadline || "", followUp: "", contact: "", notes: "", cvVersionId: "", packageId: "", history: [{ date: TODAY(), status: status || "Interested" }] };
    S.applications.push(a);
    logActivity("Saved to tracker: " + j.title + " (" + j.employer + ")");
    toast("Saved to Application Tracker");
    save();
  }
  return a;
}

// ---------------------------------------------------------------- job details / analysis screen
const JT = { tab: "overview" };
route("job", (id) => {
  const j = jobById(id);
  if (!j) return { title: "Job not found", html: `<div class="empty">No job with id ${esc(id)}. <a href="#/discover">Back to Discover</a></div>` };
  const c = C(j), app = appFor(j.jobId), comp = companyFor(j.employer);
  const tabs = [["overview", "Overview"], ["requirements", "Requirements"], ["keywords", "Keywords & CV"], ["score", "Match score"], ["value", "Career value"], ["strategy", "Strategy"], ["advert", "Original advert"]];
  let body = "";
  if (JT.tab === "overview") {
    body = `<div class="grid g2">
      <div class="card"><h2>Eligibility ${elPill(c.el.label, c.el.summary)}</h2>
        ${c.el.reasons.map((r) => `<div class="row" style="align-items:flex-start;flex-wrap:nowrap;margin:6px 0">${elPill(r.level)}<span class="small">${esc(r.msg)}</span></div>`).join("")}
        <p class="tiny muted mt">Eligibility is separate from the match score. A high score never overrides a failed mandatory requirement. Missing personal information is never treated as proof of eligibility.</p></div>
      <div class="card"><h2>Opportunity match <span class="score">${c.m.total}<small>/100</small></span></h2>${meter(c.m.total)}
        <p class="small mt">${esc(c.m.strategy)}</p>
        <h3>What makes you suitable</h3><ul class="small">${c.m.suitable.map((s) => `<li>${esc(s)}</li>`).join("") || "<li>No factor scored 75% or more.</li>"}</ul>
        <h3>Supporting experience</h3><ul class="small">${c.m.supportingExperience.map((s) => `<li>${esc(s.title)}${s.org ? " · " + esc(s.org) : ""}</li>`).join("") || "<li>None matched.</li>"}</ul>
        <p class="tiny muted">${esc(c.m.disclaimer)}</p></div>
      <div class="card"><h2>Three independent assessments</h2><div class="grid g3"><div class="tile"><div class="l">Eligibility</div><div class="v" style="font-size:18px">${elPill(c.el.label)}</div><div class="d">${esc(c.el.summary)}</div></div><div class="tile"><div class="l">Candidate match</div><div class="v">${c.m.total}</div><div class="d">how well you fit</div></div><div class="tile"><div class="l">Career value</div><div class="v">${c.v.total}</div><div class="d">long-term usefulness</div></div></div><p class="tiny muted mt">Separate measures. A high match or value never overrides a failed mandatory requirement.</p></div>
      <div class="card"><h2>Application readiness ${(() => { const r = E.readiness(j, c.a, { cvVersions: S.cvVersions, packages: S.packages, profile: S.profile }); return `<span class="tag pill">${r.score}%</span></h2>${r.items.map((i) => `<div class="row" style="flex-wrap:nowrap;padding:3px 0"><span>${i.done ? '<b class="ok">✓</b>' : i.needed ? '<b class="bad">○</b>' : '<span class="muted">○</span>'}</span><span class="small">${esc(i.name)} <span class="tiny muted">${esc(i.note || "")}</span></span></div>`).join("")}<p class="tiny muted">${esc(r.note)}</p>`; })()}</div>
      <div class="card"><h2>CV optimisation status</h2>${c.cov ? `
        <div class="grid g2"><div class="tile"><div class="l">Keyword coverage</div><div class="v">${c.cov.keywordCoverage}%</div><div class="d">${c.cov.counts.exact + c.cov.counts.equivalent} of ${c.cov.total} advert keywords in your master CV</div></div>
        <div class="tile"><div class="l">Evidence coverage</div><div class="v">${c.cov.evidenceCoverage}%</div><div class="d">incl. ${c.cov.counts.supported} supported by your profile but not on the CV</div></div></div>
        <p class="tiny muted mt">${esc(c.cov.method)}</p>` : `<p class="muted">Upload or approve a master CV to compute coverage.</p>`}
        <div class="row mt"><a class="btn primary big" href="#/optimize/${j.jobId}">ANALYZE AND TAILOR MY CV</a></div></div>
      <div class="card"><h2>Details</h2><table><tbody>
        ${[["Job ID", j.jobId + " (source id " + j.id + ")"], ["Employer", j.employer], ["Location", j.location], ["Career track", (j.tracks || []).map(trackName).join(", ")], ["Employment type", (j.type || "Not stated") + (j.seniority ? " · " + j.seniority : "")], ["Salary", j.salary || "Not disclosed"], ["Compensation", paidLabel(j)], ["Education", c.a.extracted.education.join(", ") || describeDegree(c.a.constraints.degree)], ["Experience", c.a.constraints.minYears != null ? c.a.constraints.minYears + "+ years" + (c.a.constraints.maxYears ? " (up to " + c.a.constraints.maxYears + ")" : "") : "Not stated"], ["Published", j.published ? fmtDate(j.published) + (j.postedAgo ? " (" + j.postedAgo + ")" : "") : "Not stated"], ["Deadline", j.deadline ? fmtDate(j.deadline) + " (" + daysUntil(j.deadline) + " days)" : "Not stated"], ["Status", j.status], ["Verified", fmtDate(j.verifiedDate) + ": " + (j.verification || "")], ["Verification level", j.verificationLevel || ""], ["Applicants", j.applicants || "Not shown"], ["Source", `<a href="${esc(j.source)}" target="_blank" rel="noopener">${esc(j.source)}</a>`], ["Notes", j.notes || ""]].map(([k, v]) => `<tr><th style="width:150px;position:static">${k}</th><td class="small">${k === "Source" ? v : esc(v)}</td></tr>`).join("")}
        ${(j.duplicates || []).length ? `<tr><th style="position:static">Duplicates merged</th><td class="small">${j.duplicates.map((u) => `<a href="${esc(u)}" target="_blank">${esc(u)}</a>`).join("<br>")}</td></tr>` : ""}
      </tbody></table>
      ${comp ? `<h3>Company (watchlist)</h3><p class="small">${esc(comp.industry)} · ${esc(comp.location)}${comp.careersUrl ? ` · <a href="${esc(comp.careersUrl)}" target="_blank">Careers ↗</a>` : ""}</p><p class="small muted">${esc(comp.notes)}</p>` : ""}</div>
    </div>`;
  } else if (JT.tab === "requirements") {
    const rm = E.requirementMatrix(c.a, S.master.model, S.profile, { evidenceIndex: evidenceIndex() });
    const ex = c.a.extracted;
    body = `<div class="grid g2 mb">
      <div class="card"><h2>Extracted from the advert</h2>
        ${[["Mandatory qualifications", ex.mandatory], ["Preferred qualifications", ex.preferred], ["Technical skills", ex.technical], ["Software and tools", ex.software], ["Industry / domain", ex.domain], ["Certifications", ex.certifications], ["Education", ex.education], ["Business / professional", ex.business], ["Soft skills", ex.soft], ["Saudi-specific", ex.saudiSpecific]].map(([k, v]) => `<h3>${k}</h3>${v.length ? (k.endsWith("qualifications") ? `<ul class="small">${v.slice(0, 12).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : v.map((x) => `<span class="kw">${esc(x)}</span>`).join("")) : `<span class="muted small">None detected</span>`}`).join("")}
        <h3>Years of experience</h3><span class="small">${ex.years != null ? ex.years + "+" : "Not stated"}</span>
        <h3>Repeated terms</h3>${ex.repeated.map((r) => `<span class="kw">${esc(r.term)} ×${r.hits}</span>`).join("") || '<span class="muted small">None</span>'}</div>
      <div class="card"><h2>Responsibilities</h2><ul class="small">${c.a.responsibilities.slice(0, 20).map((r) => `<li>${esc(r.text)}</li>`).join("") || "<li class='muted'>No responsibilities section detected.</li>"}</ul></div></div>
      <div class="card"><h2>Requirement-by-requirement assessment</h2><p class="small muted">Importance comes from the advert's wording and section. "Confirm" means evidence is unconfirmed or depends on personal details not in your profile.</p>
      <div class="tablewrap"><table><thead><tr><th>Requirement</th><th>Importance</th><th>Do you meet it?</th><th>Evidence in profile</th><th>Where in CV</th><th>Can be added to tailored CV?</th></tr></thead><tbody>
      ${rm.map((r) => `<tr><td class="small">${esc(r.requirement)}</td><td>${esc(r.importance)}</td><td><b class="${r.meets === "Yes" ? "ok" : r.meets === "No" ? "bad" : "warnc"}">${esc(r.meets)}</b></td><td class="small">${r.evidence.map(esc).join("<br>") || "-"}</td><td class="small">${r.whereInCV.map(esc).join(", ") || "-"}</td><td class="small">${esc(r.canIncorporate)}</td></tr>`).join("") || `<tr><td colspan="6" class="muted">No requirement lines detected. Read the original advert.</td></tr>`}
      </tbody></table></div></div>`;
  } else if (JT.tab === "keywords") {
    body = c.cov ? `<div class="card"><h2>Keyword coverage: ${c.cov.keywordCoverage}% · evidence coverage: ${c.cov.evidenceCoverage}%</h2>
      <div class="row small mb">${["exact", "equivalent", "supported", "unsupported", "missing"].map((k) => `<span class="kw ${k}">${{ exact: "Exact match", equivalent: "Verified equivalent", supported: "Supported, not on CV", unsupported: "Unconfirmed only", missing: "Missing" }[k]}: ${c.cov.counts[k]}</span>`).join("")}</div>
      <div class="tablewrap"><table><thead><tr><th>Keyword (advert wording)</th><th>Category</th><th class="num">Mentions</th><th>Status</th><th>Explanation</th></tr></thead><tbody>
      ${c.cov.rows.map((r) => `<tr><td><b>${esc(r.jdForms.join(" / "))}</b>${r.jdForms[0] !== r.term ? `<div class="tiny muted">canonical: ${esc(r.term)}</div>` : ""}</td><td>${esc(r.cat)}</td><td class="num">${r.hits}</td><td><span class="kw ${r.status}">${esc(r.status)}</span></td><td class="small">${esc(r.note)}</td></tr>`).join("")}
      </tbody></table></div><p class="tiny muted mt">${esc(c.cov.method)} Unconfirmed and missing keywords are never added to a CV automatically.</p></div>` : `<div class="empty">No master CV model available.</div>`;
  } else if (JT.tab === "score") {
    body = `<div class="card"><h2>Explainable match score: ${c.m.total}/100</h2>
      ${c.m.factors.map((f) => `<div class="factor"><b class="small">${esc(f.label)} <span class="muted">(${f.weight}%)</span></b>${meter((f.points / f.weight) * 100)}<span class="num small"><b>${f.points}</b> / ${f.weight}</span><div class="why">${esc(f.why)}${f.details.length ? `<br><span class="tiny">${f.details.slice(0, 12).map(esc).join(" · ")}</span>` : ""}</div></div>`).join("")}
      <h3>What you are missing</h3>${c.m.missing.map((x) => `<span class="kw missing">${esc(x)}</span>`).join("") || '<span class="small muted">Nothing from the keyword library.</span>'}
      <h3>Mandatory requirements without evidence</h3><ul class="small">${c.m.mandatoryGaps.map((x) => `<li>${esc(x)}</li>`).join("") || "<li>None detected.</li>"}</ul>
      <p class="tiny muted">${esc(c.m.disclaimer)}</p></div>`;
  } else if (JT.tab === "value") {
    body = `<div class="card"><h2>Career value: ${c.v.total}/100</h2>
      ${c.v.factors.map((f) => `<div class="factor"><b class="small">${esc(f.label)} <span class="muted">(${f.weight}%)</span></b><div class="meter v"><i style="width:${(f.points / f.weight) * 100}%"></i></div><span class="num small"><b>${f.points}</b> / ${f.weight}</span><div class="why">${esc(f.why)}</div></div>`).join("")}
      <p class="tiny muted mt">${esc(c.v.note)}</p></div>`;
  } else if (JT.tab === "strategy") {
    body = `<div class="card"><h2>Recommended application strategy</h2><p>${esc(c.m.strategy)}</p>
      <h3>Emphasise</h3>${c.m.emphasize.map((x) => `<span class="kw supported">${esc(x)}</span>`).join("") || "-"}
      <h3>Blocking or risky items</h3><ul class="small">${c.el.reasons.filter((r) => !["PASS", "NOTE"].includes(r.level)).map((r) => `<li>${esc(r.level)}: ${esc(r.msg)}</li>`).join("") || "<li>None</li>"}</ul>
      <h3>Next steps</h3><ol class="small"><li><a href="#/optimize/${j.jobId}">Optimise the CV for this job</a> and approve each change.</li><li><a href="#/builder/${j.jobId}">Generate the application package</a>.</li><li>Apply on the official advert: <a href="${esc(j.applyUrl || j.source)}" target="_blank">${esc(j.applyUrl || j.source)}</a></li><li>Mark as Applied in the tracker only after you submit.</li></ol></div>`;
  } else {
    body = `<div class="card"><h2>Original advert text</h2><p class="small muted">Captured ${fmtDate(j.verifiedDate)} from <a href="${esc(j.source)}" target="_blank">${esc(j.source)}</a>. Always re-check the live advert before applying.</p><pre class="doc">${esc(j.description || "No description stored.")}</pre>
      <div class="row mt"><button class="btn" data-act="editJD" data-id="${j.jobId}">Edit / replace description</button></div></div>`;
  }
  return {
    title: j.title, sub: j.employer + " · " + j.location,
    actions: `<button class="btn ${(S.compareIds || []).includes(j.jobId) ? "primary" : ""}" data-act="cmpToggle" data-id="${j.jobId}">⇄ Compare</button><a class="btn" href="#/company/${encodeURIComponent((companyFor(j.employer) || {}).name || "")}" ${companyFor(j.employer) ? "" : 'style="display:none"'}>Company</a><a class="btn" href="#/interview/${j.jobId}">Interview prep</a><button class="btn" data-act="recheck" data-id="${j.jobId}">Re-check if open</button><a class="btn" href="${esc(j.applyUrl || j.source)}" target="_blank" rel="noopener">Official advert ↗</a>${app ? `<a class="btn" href="#/tracker">In tracker: ${esc(app.status)}</a>` : `<button class="btn" data-act="track" data-id="${j.jobId}">Save to tracker</button>`}<a class="btn primary" href="#/optimize/${j.jobId}">Analyze and tailor my CV</a>`,
    html: `<div class="row mb">${elPill(c.el.label, c.el.summary)}<span class="pill">Match ${c.m.total}/100</span><span class="pill">Career value ${c.v.total}/100</span>${c.cov ? `<span class="pill">Keyword coverage ${c.cov.keywordCoverage}%</span>` : ""}<span class="pill">${esc(jobKind(j))}</span>${(j.tracks || []).map((t) => `<span class="pill">${esc(trackName(t))}</span>`).join("")}</div>
      <div class="tabs">${tabs.map(([k, l]) => `<a class="${JT.tab === k ? "on" : ""}" data-act="jtab" data-t="${k}">${l}</a>`).join("")}</div>${body}`,
  };
});
function describeDegree(d) { return { mechanical: "Mechanical Engineering", engineering: "Engineering (any discipline)", other_engineering: "Another engineering discipline", business: "Business / finance", unknown: "Not stated" }[d] || d; }
ACT.jtab = (d) => { JT.tab = d.t; rerender(); };
ACT.editJD = (d) => {
  const j = jobById(d.id);
  modal(`<h2>Edit job description</h2><textarea id="jdText" style="min-height:320px">${esc(j.description || "")}</textarea><div class="row mt"><button class="btn primary" data-act="saveJD" data-id="${j.jobId}">Save and re-analyse</button><button class="btn" data-act="closeModal">Cancel</button></div>`);
};
ACT.saveJD = (d) => { const j = jobById(d.id); j.description = document.getElementById("jdText").value; j.userEdited = true; invalidate(j.jobId); save(); closeModal(); rerender(); };
function companyFor(name) { return S.companies.find((c) => companyMatch(c, name)); }

// ---------------------------------------------------------------- Job Analysis (independent input)
route("analysis", () => {
  const analysed = S.jobs.filter((j) => j.origin === "manual").concat(S.jobs.filter((j) => S.optim[j.jobId] && j.origin !== "manual"));
  return {
    title: "Job Analysis", sub: "Analyse any advert: paste text, upload a PDF or DOCX, or pick a job from Discover",
    html: `<div class="grid g2"><div class="card"><h2>Analyse a new job</h2>
      <div class="note mb small"><b>From your phone:</b> take screenshots of the whole advert (several are fine, in order) and tap <b>📷 Add from screenshots</b>. ${HOOKS.sample ? "CareerOS AI reads them and fills in the form for you to check." : "Screenshot reading needs your private claude.ai page. Here, use iPhone Live Text: open the screenshot in Photos, press and hold the text, Select All, Copy, and paste below."}</div>
      <div class="grid g2"><label class="f">Job title *<input type="text" id="nj_title"></label><label class="f">Company *<input type="text" id="nj_company"></label>
      <label class="f">Location<input type="text" id="nj_loc" value="Riyadh, Saudi Arabia"></label><label class="f">Advert URL<input type="url" id="nj_url" placeholder="https://"></label>
      <label class="f">Employment type<select id="nj_type"><option>Full-time</option><option>Internship</option><option>Graduate program</option><option>Contract</option></select></label><label class="f">Deadline (if stated)<input type="date" id="nj_deadline"></label></div>
      <label class="f mt">Job description (paste the complete advert)<textarea id="nj_desc" style="min-height:220px" placeholder="Paste the full job description here"></textarea></label>
      <div class="row mt"><label class="btn primary">📷 Add from screenshots<input type="file" id="nj_img" accept="image/*" multiple class="hide" data-chg="jdImages"></label><label class="btn">Upload PDF or DOCX<input type="file" id="nj_file" accept=".pdf,.docx" class="hide" data-chg="jdFile"></label><span class="small muted" id="nj_fileinfo"></span></div>
      <div class="row mt"><button class="btn primary big" data-act="analyseNew">Analyse this job</button></div>
      <p class="tiny muted mt">The analysis runs in your browser. Nothing is sent anywhere. The job is saved as a manually imported opportunity with its own ID.</p></div>
      <div class="card"><h2>Recently analysed and imported</h2>${analysed.length ? `<table><tbody>${analysed.slice(0, 30).map((j) => `<tr><td><a href="#/job/${j.jobId}">${esc(j.title)}</a><div class="tiny muted">${esc(j.employer)} · ${esc(j.origin === "manual" ? "Manually imported" : "Researched")}</div></td><td>${elPill(C(j).el.label)}</td><td class="num">${C(j).m.total}</td></tr>`).join("")}</tbody></table>` : `<p class="muted small">Nothing yet. Jobs you optimise a CV for, or import here, appear in this list.</p>`}
      <h3>Pick from researched jobs</h3><select id="pickJob" data-chg="pickJob" style="width:100%"><option value="">Choose a job...</option>${S.jobs.filter((j) => !isExpired(j)).sort((a, b) => C(b).m.total - C(a).m.total).map((j) => `<option value="${j.jobId}">${esc(j.title)} · ${esc(j.employer)} (${C(j).m.total})</option>`).join("")}</select></div></div>`,
  };
});
ACT.pickJob = (d, t) => { if (t.value) go("#/job/" + t.value); };
ACT.jdFile = async (d, t) => {
  const f = t.files[0]; if (!f) return;
  const info = document.getElementById("nj_fileinfo");
  info.textContent = "Reading " + f.name + "...";
  const buf = new Uint8Array(await f.arrayBuffer());
  let text = "";
  if (/\.docx$/i.test(f.name)) text = (await E.readDocx(JSZip, buf, DOMParser)).text;
  else text = (await pdfText(buf)).text;
  document.getElementById("nj_desc").value = text;
  info.textContent = f.name + ": " + text.length + " characters extracted";
};
ACT.analyseNew = () => {
  const v = (id) => document.getElementById(id).value.trim();
  if (!v("nj_title") || !v("nj_company") || v("nj_desc").length < 40) return toast("Enter a title, company and the job description (at least a few lines).");
  const job = { id: uid("MAN"), jobId: uid("MAN"), title: v("nj_title"), employer: v("nj_company"), location: v("nj_loc"), country: /saudi|riyadh|jeddah|dammam/i.test(v("nj_loc")) ? "Saudi Arabia" : "", type: v("nj_type"), seniority: "", description: v("nj_desc"), source: v("nj_url") || "Manually imported", applyUrl: v("nj_url"), published: "", deadline: v("nj_deadline"), status: "Unknown", verifiedDate: TODAY(), verification: (window.__jdFromScreens ? "Transcribed by CareerOS AI from " + window.__jdFromScreens.count + " screenshot(s) you uploaded on " + TODAY() + ". Check it against the live advert" : "Manually imported by you on " + TODAY()) + "; open status not verified by CareerOS", verificationLevel: window.__jdFromScreens ? "Screenshot import (AI transcription)" : "Manual import", origin: "manual", salary: "Not disclosed", tracks: [] };
  job.tracks = E.inferTracks(job, E.analyzeJob(job));
  window.__jdFromScreens = null; S.jobs.push(job); logActivity("Imported and analysed: " + job.title + " (" + job.employer + ")"); save();
  JT.tab = "requirements"; go("#/job/" + job.jobId);
};

// ---------------------------------------------------------------- live search via optional local companion
ACT.refresh = async () => {
  const url = S.settings.companionUrl;
  let ok = false, info = null;
  try { const r = await fetch(url + "/health", { cache: "no-store" }); info = await r.json(); ok = r.ok; } catch (e) { ok = false; }
  if (!ok) {
    modal(`<h2>Refresh opportunities</h2><p>Live search needs the optional local companion (<code>tools/careeros_server.py</code>) running with a search API configured. It was not reachable at <code>${esc(url)}</code>.</p>
      <ol class="small"><li>Open a terminal in the CareerOS folder.</li><li>Run <code>python3 tools/careeros_server.py</code></li><li>For search results, set <code>GOOGLE_CSE_KEY</code> and <code>GOOGLE_CSE_CX</code> (Google Programmable Search) or <code>JSEARCH_API_KEY</code> (RapidAPI JSearch) before starting it. See README.</li></ol>
      <p class="small">Without it you can still add any advert in <a href="#/analysis" data-act="closeModal">Job Analysis</a>. CareerOS does not fake live search.</p><button class="btn" data-act="closeModal">Close</button>`);
    return;
  }
  if (!info.search) { modal(`<h2>Companion running, no search API configured</h2><p class="small">${esc(info.message || "")}</p><button class="btn" data-act="closeModal">Close</button>`); return; }
  modal(`<h2>Live search</h2><p class="small">Queries go from your computer to ${esc(info.search)}. Only the keywords below are sent, never your CV or profile.</p>
    <label class="f">Keywords<input type="text" id="lsq" value="graduate mechanical engineer Riyadh"></label><div class="row mt"><button class="btn primary" data-act="runSearch">Search</button><button class="btn" data-act="closeModal">Cancel</button></div><div id="lsout" class="mt"></div>`);
};
ACT.runSearch = async () => {
  const q = document.getElementById("lsq").value;
  const out = document.getElementById("lsout"); out.innerHTML = "Searching...";
  const r = await fetch(S.settings.companionUrl + "/search?q=" + encodeURIComponent(q));
  const data = await r.json();
  if (!r.ok) { out.innerHTML = `<div class="flag high">${esc(data.error || "Search failed")}</div>`; return; }
  const have = new Set(S.jobs.map((j) => (j.source || "").split("?")[0]));
  const fresh = data.results.filter((x) => !have.has((x.url || "").split("?")[0]));
  fresh.forEach((x) => S.jobs.push({ id: uid("LIVE"), jobId: uid("LIVE"), title: x.title, employer: x.company || "Unknown", location: x.location || "", country: "", type: x.type || "", seniority: "", description: x.description || x.snippet || "", source: x.url, applyUrl: x.applyUrl || x.url, published: x.published || "", deadline: "", status: "Unknown", verifiedDate: TODAY(), verification: "Found by live search (" + data.provider + ") on " + TODAY() + ". Not yet verified against the employer advert.", verificationLevel: "Live search result (unverified)", origin: "live_search", salary: x.salary || "Not disclosed", tracks: [] }));
  fresh.forEach((j) => { j.tracks = E.inferTracks(j, E.analyzeJob(j)); });
  logActivity("Live search '" + q + "': " + fresh.length + " new results"); save();
  out.innerHTML = `<p class="small">${data.results.length} results, ${fresh.length} new. New results are marked as unverified live-search results.</p><button class="btn" data-act="closeModal">Done</button>`;
  rerender();
};

ACT.recheck = async (d) => {
  const j = jobById(d.id);
  if (!/^https?:/.test(j.source || "")) return toast("This job has no advert URL to check.");
  let r;
  try { r = await (await fetch(S.settings.companionUrl + "/recheck?url=" + encodeURIComponent(j.source))).json(); }
  catch (e) { return modal(`<h2>Re-check needs the companion</h2><p class="small">Start <code>python3 tools/careeros_server.py</code>, or open the advert yourself and update the status. CareerOS will not guess.</p><a class="btn" href="${esc(j.source)}" target="_blank">Open advert ↗</a> <button class="btn" data-act="closeModal">Close</button>`); }
  j.verifiedDate = TODAY();
  if (r.closed) { j.status = "Closed"; j.verification = "Re-checked " + TODAY() + " via companion: page shows a closed notice (HTTP " + r.http + ")"; toast("Advert now shows as closed. Moved to Expired."); }
  else { j.verification = "Re-checked " + TODAY() + " via companion: HTTP " + r.http + ", no closed notice found" + (r.note ? ". " + r.note : ""); toast("No closed notice found (HTTP " + r.http + ")"); }
  invalidate(j.jobId); logActivity("Re-checked advert: " + j.title); save(); rerender();
};

ACT.toggleApplied = () => { F.showApplied = !F.showApplied; F.show = 30; rerender(); };
ACT.cityChip = (d) => { F.city = d.c; F.show = 30; rerender(); };
function activeFilterCount() { return ["q", "company", "track", "elig", "type", "level", "exp", "deadline", "recent", "paid"].filter((k) => F[k]).length + (F.minScore ? 1 : 0); }

/** Downscale a photo so several screenshots fit in one AI request. */
async function shrinkImage(file, maxSide) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, maxSide / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob(res, "image/jpeg", 0.85));
  } finally { URL.revokeObjectURL(url); }
}
ACT.jdImages = async (d, t) => {
  const files = [...t.files].slice(0, 8); if (!files.length) return;
  const info = document.getElementById("nj_fileinfo");
  const sample = await aiSample();
  let can = !!sample;
  if (sample && typeof sample.limits === "function") { try { const l = await sample.limits(); can = !!(l && l.images); } catch (e) { can = false; } }
  if (!can) { modal(`<h2>Reading screenshots</h2><p class="small">Screenshot reading uses CareerOS AI, which is only available on your private claude.ai page${sample ? " with image access" : ""}.</p><p class="small"><b>Alternative on iPhone:</b> open the screenshot in Photos, press and hold the text, choose Select All, then Copy, and paste it into the job description box.</p><button class="btn primary" data-act="closeModal">OK</button>`); t.value = ""; return; }
  info.textContent = "Reading " + files.length + " screenshot(s)...";
  try {
    const images = []; for (const f of files) images.push(await shrinkImage(f, 1600));
    const prompt = "These " + images.length + " image(s) are screenshots of one job advert, in order (or of an application portal page). Transcribe the advert text faithfully; do not add, summarise or invent anything. Return only JSON with these keys: " +
      '{"title": string, "company": string, "location": string, "employmentType": "Full-time"|"Internship"|"Graduate program"|"Contract"|"", "deadline": "YYYY-MM-DD" or "", "url": string or "", "reference": string or "", "description": string (the full advert text, keep headings and bullet points on separate lines), "pageKind": "advert"|"application_confirmation"|"other", "unreadable": string (parts you could not read, or "")}. ' +
      "Use empty strings for anything not visible. If the screenshots show an application confirmation or thank-you page instead of the advert, set pageKind to application_confirmation.";
    const opts = { images, cache: false, modelTier: "default" };
    let r;
    if (typeof sample.json === "function") r = await sample.json(prompt, opts);
    else { const out = await sample(prompt, opts); r = JSON.parse((out.text.match(/\{[\s\S]*\}/) || ["{}"])[0]); }
    const set = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = String(v).replace(/\u2014/g, " - "); };
    set("nj_title", r.title); set("nj_company", r.company); set("nj_loc", r.location); set("nj_url", r.url); set("nj_deadline", /^\d{4}-\d{2}-\d{2}$/.test(r.deadline || "") ? r.deadline : "");
    if (r.employmentType) set("nj_type", r.employmentType);
    set("nj_desc", (r.description || "") + (r.reference ? "\n\nReference: " + r.reference : ""));
    window.__jdFromScreens = { count: images.length, unreadable: r.unreadable || "" };
    info.textContent = "Filled from " + images.length + " screenshot(s). Check every field against your screenshots before analysing." + (r.unreadable ? " Could not read: " + r.unreadable : "");
    if (r.pageKind === "application_confirmation") {
      const match = S.jobs.find((j) => r.title && j.title.toLowerCase().startsWith(String(r.title).toLowerCase().split(" (")[0].slice(0, 25)) && (!r.company || (j.employer || "").toLowerCase().includes(String(r.company).toLowerCase().split(" ")[0])));
      modal(`<h2>This looks like an application confirmation</h2><p class="small">The screenshot shows a "thank you" or submitted page${r.title ? " for <b>" + esc(r.title) + "</b>" : ""}, not the job advert. The job description is usually not on this page.</p>
        ${match ? `<p class="small">It matches <b>${esc(match.jobId)} ${esc(match.title)}</b> (${esc(match.employer)}) in your database.</p><div class="row"><button class="btn primary" data-act="markFromShot" data-id="${match.jobId}">I submitted it: mark as Applied</button><a class="btn" href="#/job/${match.jobId}" data-act="closeModal">Open the job</a></div>` : `<p class="small">Take screenshots of the advert itself, or paste the link and the advert text.</p>`}
        <div class="row mt"><button class="btn" data-act="closeModal">Close</button></div>`);
    }
  } catch (e) {
    info.textContent = "";
    toast(e && e.code === "not_granted" ? "Image reading was not allowed. Allow it when prompted, or paste the text instead." : "Could not read the screenshots: " + (e.message || e.code), 6000);
  }
  t.value = "";
};
ACT.markFromShot = async (d) => {
  if (!(await ask("Mark this application as Applied? Only do this if you submitted it."))) return;
  const a = addToTracker(d.id); a.status = "Applied"; a.appliedDate = a.appliedDate || TODAY(); a.channel = a.channel || "Employer career portal"; a.history.push({ date: TODAY(), status: "Applied" });
  if (!a.followUp) { const f = new Date(); f.setDate(f.getDate() + 10); a.followUp = f.toISOString().slice(0, 10); }
  logActivity("Marked as applied from a screenshot: " + jobById(d.id).title); save(); closeModal(); toast("Marked as Applied. Follow-up set for " + fmtDate(a.followUp)); go("#/tracker");
};
