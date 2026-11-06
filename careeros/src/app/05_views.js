/* Dashboard, Profile, Market Intelligence, Watchlist, Keywords, Settings, boot. */
function barList(rows, max, unit) {
  max = max || Math.max(1, ...rows.map((r) => r[1]));
  return `<div class="bars">${rows.map(([l, v, extra]) => `<div class="b" title="${esc(l)}: ${v}${unit || ""}${extra ? " · " + esc(extra) : ""}"><span class="lbl small">${esc(l)}</span><span class="track"><i style="width:${(v / max) * 100}%"></i></span><span class="num small">${v}${unit || ""}</span></div>`).join("")}</div>`;
}
function tableView(rows, heads) { return `<details><summary class="small">Table view</summary><table><thead><tr>${heads.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((x, i) => `<td class="${i ? "num" : ""}">${esc(x)}</td>`).join("")}</tr>`).join("")}</tbody></table></details>`; }

route("dashboard", () => {
  const active = S.jobs.filter((j) => !isExpired(j));
  const lab = (l) => active.filter((j) => C(j).el.label === l).length;
  const verifiedOpen = active.filter((j) => j.status === "Open").length;
  const high = active.filter((j) => C(j).m.total >= 70 && ["GREEN", "YELLOW"].includes(C(j).el.label));
  const prepared = S.packages.length;
  const submitted = S.applications.filter((a) => SUBMITTED.has(a.status)).length;
  const interviews = S.applications.filter((a) => a.status === "Interview").length;
  const upcomingDl = active.filter((j) => j.deadline && daysUntil(j.deadline) >= 0);
  const moves = nextMoves();
  const reach = active.filter((j) => ["GREEN", "YELLOW"].includes(C(j).el.label));
  const covs = reach.map((j) => C(j).cov).filter(Boolean).map((c) => c.keywordCoverage);
  const avgCov = covs.length ? Math.round(covs.reduce((a, b) => a + b, 0) / covs.length) : null;
  const avgEv = reach.length ? Math.round(reach.map((j) => C(j).cov ? C(j).cov.evidenceCoverage : 0).reduce((a, b) => a + b, 0) / reach.length) : null;
  const attention = S.applications.map((a) => ({ a, j: jobById(a.jobId) })).filter((x) => x.j && ((x.a.followUp && x.a.followUp <= TODAY() && !["Rejected", "Accepted", "Withdrawn"].includes(x.a.status)) || x.a.status === "Interview" || x.a.status === "Follow-up required" || (x.a.status === "Applied" && x.a.appliedDate && daysUntil(x.a.appliedDate) < -21)));
  const fresh = active.filter((j) => !alreadyApplied(j));
  const newest = fresh.slice().sort((a, b) => (b.firstSeen || b.published || "").localeCompare(a.firstSeen || a.published || "")).slice(0, 6);
  const closing = fresh.filter((j) => j.deadline && daysUntil(j.deadline) >= 0 && daysUntil(j.deadline) <= 14).sort((a, b) => a.deadline.localeCompare(b.deadline));
  const topHigh = reach.filter((j) => !alreadyApplied(j)).sort((a, b) => (0.55 * C(b).m.total + 0.45 * C(b).v.total) - (0.55 * C(a).m.total + 0.45 * C(a).v.total)).slice(0, 5);
  const dm = devMapData();
  const trackRows = Object.keys(TRACKS).map((t) => { const js = active.filter((j) => (j.tracks || []).includes(t)); return [trackName(t), js.filter((j) => ["GREEN", "YELLOW"].includes(C(j).el.label)).length, js.length + " active in total"]; }).sort((a, b) => b[1] - a[1]);
  const tile = (l, v, d, href) => `<a class="tile" href="${href}"><div class="l">${l}</div><div class="v">${v}</div>${d ? `<div class="d">${d}</div>` : ""}</a>`;
  const jl = (j, extra) => `<div class="row" style="padding:7px 0;border-bottom:1px solid var(--line);flex-wrap:nowrap"><div style="flex:1;min-width:0"><a href="#/job/${j.jobId}"><b class="small">${esc(j.title)}</b></a> ${isNew(j) ? '<span class="badge-new">NEW</span>' : ""}<div class="tiny muted">${esc(j.employer)} · ${esc(j.location)}${extra ? " · " + extra : ""}</div></div>${elPill(C(j).el.label)}<span class="score">${C(j).m.total}</span></div>`;
  const devDone = Object.values(S.devDone || {}).filter((x) => /^Done/.test(x)).length, devLearning = Object.values(S.devDone || {}).filter((x) => x === "Learning").length;
  return {
    title: "Dashboard", sub: "Today " + fmtDate(TODAY()) + " · research verified " + fmtDate(S.researchDate),
    actions: `<a class="btn" href="#/analysis">📷 Add a job from screenshots</a><a class="btn" href="#/ai">Ask CareerOS AI</a><a class="btn primary" href="#/discover">Find opportunities</a>`,
    html: `${closing.filter((j) => daysUntil(j.deadline) <= 7).length ? `<div class="flag high mb"><b>Closing within 7 days:</b> ${closing.filter((j) => daysUntil(j.deadline) <= 7).map((j) => `<a href="#/job/${j.jobId}">${esc(j.title)} · ${esc(j.employer)}</a> (${fmtDate(j.deadline)})`).join("; ")}</div>` : ""}
    <div class="grid mb"><div class="card span2"><h2>✦ My next best moves <span class="tag tiny muted">ranked from deadlines, eligibility, match, career value and effort</span></h2>
        ${moves.length ? `<div class="moves">${moves.map((m, i) => `<div class="move"><span class="n">${i + 1}</span><div style="min-width:0"><b>${esc(m.title)}</b><div class="why">${esc(m.why)}</div><div class="tm">About ${esc(m.time)}</div></div><a class="btn sm primary" href="#/${m.action === "job" ? "job/" + m.jobId : m.action === "optimize" ? "optimize/" + m.jobId : m.action === "builder" ? "builder/" + m.jobId : m.action === "interview" ? "interview/" + m.jobId : m.action}">Go</a></div>`).join("")}</div>` : emptyState("Nothing urgent", "Explore Discover for new roles.")}</div></div>
    <div class="eyebrow">Career overview</div>
    <div class="kpis">
      ${tile("Opportunities discovered", S.jobs.length + S.excluded.length, S.excluded.length + " expired or excluded", "#/discover")}
      ${tile("Verified open", verifiedOpen, (active.length - verifiedOpen) + " unverified or unknown", "#/discover")}
      ${tile("Green eligibility", lab("GREEN"), lab("YELLOW") + " more Yellow", "#/discover")}
      ${tile("High match (70+)", high.length, "Green or Yellow only", "#/discover")}
      ${tile("Applications prepared", prepared, S.cvVersions.length + " tailored CVs", "#/builder")}
      ${tile("Submitted", submitted, "confirmed by you or LinkedIn", "#/tracker")}
      ${tile("Interviews", interviews, "", "#/interview")}
      ${tile("Upcoming deadlines", upcomingDl.length, "most adverts state none", "#/tracker")}
    </div>
    <div class="grid g2">
      <div class="card"><h2>Best opportunities for you</h2>${topHigh.map((j) => jl(j, "value " + C(j).v.total)).join("") || emptyState("No reachable opportunities", "Check your profile settings.")}<p class="tiny muted mt">Green and Yellow only, ranked by match and career value. Not hiring probabilities.</p></div>
      <div class="card"><h2>Applications needing attention</h2>${attention.length ? attention.slice(0, 8).map((x) => `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line);flex-wrap:nowrap"><div style="min-width:0"><a href="#/job/${x.j.jobId}"><b class="small">${esc(x.j.title)}</b></a><div class="tiny muted">${esc(x.j.employer)} · ${esc(x.a.status)}${x.a.followUp ? " · follow-up " + fmtDate(x.a.followUp) : ""}</div></div><a class="btn sm" href="#/tracker">Update</a></div>`).join("") : emptyState("Nothing needs attention", S.applications.length ? "No overdue follow-ups or interviews." : "Track applications from Discover" + (HOOKS.mcp ? ', or <a href="#/gmail">import them from Gmail</a>.' : "."))}</div>
      <div class="card"><h2>How competitive is your CV?</h2>${avgCov != null ? `<div class="row" style="gap:24px"><div><div class="hero">${avgCov}%</div><div class="tiny muted">average keyword coverage of your master CV on ${reach.length} reachable adverts</div></div><div><div class="hero" style="font-size:30px">${avgEv}%</div><div class="tiny muted">evidence coverage: what your profile could support truthfully</div></div></div>
        <p class="small mt">The gap between the two is what tailoring can add without inventing anything. ${S.master.approved ? "" : '<a href="#/cv">Approve your master CV first.</a>'}</p>
        ${(() => { const ats = S.master.model ? E.atsGreenhouse(S.master.model) : null; return ats ? `<p class="tiny">ATS risk check (Greenhouse guidance): ${ats.checks.filter((c) => c.result === "pass").length} of ${ats.checks.length} pass.</p>` : ""; })()}` : emptyState("No master CV yet", "", '<a class="btn" href="#/cv">Open CV Studio</a>')}</div>
      <div class="card"><h2>What you are missing</h2>${dm.list.slice(0, 6).map((x) => `<div class="row between" style="padding:5px 0;border-bottom:1px solid var(--line);flex-wrap:nowrap"><span class="small"><b>${esc(x.term)}</b> <span class="tiny muted">${x.tier}</span></span><span class="tiny muted">${x.n} adverts · ${esc(x.cost)}</span></div>`).join("")}<div class="row mt"><a class="btn sm" href="#/devmap">Development map</a><span class="tiny muted">${devDone} done, ${devLearning} in progress</span></div></div>
      <div class="card"><h2>Opportunity intelligence</h2><h3>Newest</h3>${newest.slice(0, 4).map((j) => jl(j, j.published ? fmtDate(j.published) : "")).join("")}${closing.length ? `<h3>Closing soon</h3>${closing.slice(0, 3).map((j) => jl(j, "closes " + fmtDate(j.deadline))).join("")}` : ""}<p class="tiny muted mt">Re-opened roles are only shown when a re-check confirms them; none recorded.</p></div>
      <div class="card"><h2>Career tracks (Green + Yellow)</h2>${barList(trackRows.map((r) => [r[0], r[1], r[2]]))}${tableView(trackRows, ["Track", "Green+Yellow", "All active"])}<p class="small mt">${esc(trackAdvice(trackRows))}</p></div>
    </div>`,
  };
});
function trackAdvice(rows) {
  const best = rows.filter((r) => r[1] > 0).slice(0, 3).map((r) => r[0]);
  return best.length ? "Most open, reachable roles right now are in " + best.join(", ") + ". Defence and UAV roles at entry level are scarce on public boards, so pair applications with direct outreach to SAMI Autonomous, INTRA, Terra Drone Arabia and GADD (see Company Watchlist)." : "No reachable roles yet.";
}

// ---------------------------------------------------------------- Profile
const PT = { type: "" };
route("profile", () => {
  const P = S.profile;
  const types = ["employment", "internship", "project", "leadership", "achievement", "training", "certification", "research"];
  const items = P.items.filter((i) => !PT.type || i.type === PT.type);
  const fld = (label, path, obj) => `<tr><th style="position:static;width:170px">${label}</th><td><div class="row"><input type="text" value="${esc(obj.value)}" data-chg="pfield" data-p="${path}" style="flex:1;min-width:160px">${stPill(obj.status)}</div><div class="tiny muted">${esc(obj.note || "")}</div></td></tr>`;
  return {
    title: "My Career Profile", sub: "The single source of truth for every generated application",
    actions: `<button class="btn primary" data-act="editItem" data-id="">+ Add experience, project or certificate</button>`,
    html: `<div class="grid g2"><div class="card"><h2>Personal and academic status</h2><table><tbody>
      <tr><th style="position:static;width:170px">Name</th><td>${esc(P.personal.name)}</td></tr><tr><th style="position:static">Contact</th><td class="small">${esc(P.personal.email)} · ${esc(P.personal.phone)} · ${esc(P.personal.city)}</td></tr>
      <tr><th style="position:static">Education</th><td class="small">${esc(P.education.degree)}, ${esc(P.education.university)} · ${esc(P.education.start)} to ${esc(P.education.expectedGraduation)} ${stPill(P.education.status)}<br><b>${esc(P.education.academicStatus)}</b></td></tr>
      <tr><th style="position:static">Graduated?</th><td><select data-chg="graduated"><option value="no" ${!P.education.graduated ? "selected" : ""}>No (student)</option><option value="yes" ${P.education.graduated ? "selected" : ""}>Yes, officially graduated</option></select> <input type="month" value="${esc(P.education.expectedGraduation)}" data-chg="gradDate"></td></tr>
      ${fld("Nationality", "personal.nationality", P.personal.nationality)}${fld("Gender (optional)", "personal.gender", P.personal.gender)}${fld("Work authorisation", "personal.workAuthorization", P.personal.workAuthorization)}${P.education.gpa.private ? `<tr><th style="position:static;width:170px">GPA</th><td class="small">Private (not recorded). GPA minimums appear as notes. <button class="btn sm" data-act="gpaPrivate" data-v="0">Record it instead</button></td></tr>` : fld("GPA", "education.gpa", P.education.gpa) + `<tr><td></td><td><button class="btn sm" data-act="gpaPrivate" data-v="1">Keep my GPA private</button></td></tr>`}${fld("University co-op required?", "education.coopRequired", P.education.coopRequired)}${fld("Availability", "personal.availability", P.personal.availability)}${fld("Salary expectation", "personal.salaryExpectation", P.personal.salaryExpectation)}
      </tbody></table><p class="tiny muted">Typing a value marks it <b>Confirmed by me</b>. Eligibility recalculates for every job.</p></div>
      <div class="card"><h2>Integrity flags</h2>${P.integrityFlags.map((f) => `<div class="flag ${f.severity}"><b>${esc(f.title)}</b> <span class="tiny">(${f.severity})</span><br><span class="small">${esc(f.detail)}</span>${f.item ? ` <a class="small" href="#" data-act="editItem" data-id="${f.item}">Open item</a>` : ""}</div>`).join("")}
        <h3>Evidence sources</h3><ul class="small">${P.meta.sources.map((s) => `<li><b>${esc(s.id)}</b> ${esc(s.label)}</li>`).join("")}</ul></div></div>
    <div class="card mt"><div class="row between"><h2>Career evidence (${P.items.length})</h2><div class="row"><select data-chg="ptype"><option value="">All types</option>${types.map((t) => `<option ${PT.type === t ? "selected" : ""}>${t}</option>`).join("")}</select></div></div>
      <div class="tablewrap" style="max-height:none"><table><thead><tr><th>Item</th><th>Type</th><th>Dates</th><th>Verification</th><th>Career tracks</th><th>Skills</th><th></th></tr></thead><tbody>
      ${items.map((i) => `<tr><td><b class="small">${esc(i.title)}</b><div class="tiny muted">${esc(i.org || "")}</div>${i.notes ? `<div class="tiny warnc">${esc(i.notes)}</div>` : ""}</td><td class="small">${esc(i.type)}</td><td class="small">${esc(i.start || "")}${i.end ? " to " + esc(i.end) : ""}</td><td>${stPill(i.status)}</td><td class="tiny">${(i.tracks || []).map(trackName).join(", ")}</td><td class="tiny">${(i.skills || []).slice(0, 8).map((k) => (E.TAXONOMY.find((t) => t.id === k) || { term: k }).term).join(", ")}</td><td><button class="btn sm" data-act="editItem" data-id="${i.id}">Edit</button></td></tr>`).join("")}
      </tbody></table></div></div>
    <div class="card mt"><h2>Skills and software (${P.skills.length})</h2><div class="tablewrap"><table><thead><tr><th>Skill</th><th>Verification</th><th>Strength of evidence</th><th>Evidence</th><th>Note</th><th></th></tr></thead><tbody>
      ${P.skills.map((s, n) => `<tr><td class="small"><b>${esc(s.name)}</b></td><td>${stPill(s.status)}</td><td class="small">${esc({ project: "Used in documented work", listed: "Listed only", interest: "Interest only" }[s.strength] || s.strength)}</td><td class="tiny">${esc((s.evidence || []).join(", "))}</td><td class="tiny">${esc(s.note || "")}</td><td><select data-chg="skillStatus" data-n="${n}" class="small">${Object.entries(E.STATUS_LABEL).map(([k, v]) => `<option value="${k}" ${k === s.status ? "selected" : ""}>${v}</option>`).join("")}</select></td></tr>`).join("")}
      </tbody></table></div><div class="row mt"><button class="btn" data-act="addSkill">+ Add skill</button><span class="tiny muted">A personal interest is never converted into a qualification. Only Verified or Confirmed skills are used in CVs.</span></div></div>`,
  };
});
ACT.gpaPrivate = (d) => { const g = S.profile.education.gpa; g.private = d.v === "1"; if (g.private) { g.value = ""; g.status = "confirmed_user"; } else g.status = "needs_confirmation"; profileChanged(); rerender(); };
ACT.ptype = (d, t) => { PT.type = t.value; rerender(); };
ACT.pfield = (d, t) => { const [a, b] = d.p.split("."); const o = S.profile[a][b]; o.value = t.value.trim(); o.status = o.value ? "confirmed_user" : "needs_confirmation"; logActivity("Profile updated: " + b); profileChanged(); rerender(); };
ACT.graduated = (d, t) => { S.profile.education.graduated = t.value === "yes"; S.profile.education.academicStatus = t.value === "yes" ? "Graduated (confirmed by you)" : "Final-year student. Not yet graduated."; profileChanged(); rerender(); };
ACT.gradDate = (d, t) => { S.profile.education.expectedGraduation = t.value; profileChanged(); rerender(); };
ACT.skillStatus = (d, t) => { S.profile.skills[d.n].status = t.value; profileChanged(); rerender(); };
ACT.addSkill = () => {
  modal(`<h2>Add a skill</h2><label class="f">Skill name<input type="text" id="sk_name"></label><label class="f mt">Keyword library match<select id="sk_kid"><option value="">(none)</option>${E.TAXONOMY.map((k) => `<option value="${k.id}">${esc(k.term)}</option>`).join("")}</select></label>
    <label class="f mt">Verification<select id="sk_st">${Object.entries(E.STATUS_LABEL).map(([k, v]) => `<option value="${k}" ${k === "confirmed_user" ? "selected" : ""}>${v}</option>`).join("")}</select></label><label class="f mt">Evidence (project, course, certificate)<input type="text" id="sk_ev"></label>
    <label class="f mt">Strength<select id="sk_str"><option value="project">Used in documented work</option><option value="listed">Listed only</option><option value="interest">Interest only (never used as qualification)</option></select></label>
    <div class="row mt"><button class="btn primary" data-act="saveSkill">Save</button><button class="btn" data-act="closeModal">Cancel</button></div>`);
};
ACT.saveSkill = () => { const v = (i) => document.getElementById(i).value.trim(); if (!v("sk_name")) return; S.profile.skills.push({ name: v("sk_name"), kid: v("sk_kid") || null, status: v("sk_st"), strength: v("sk_str"), evidence: v("sk_ev") ? [v("sk_ev")] : [], note: "Added by you " + TODAY() }); logActivity("Skill added: " + v("sk_name")); profileChanged(); closeModal(); rerender(); };
ACT.editItem = (d) => {
  const it = S.profile.items.find((i) => i.id === d.id) || { id: "", type: "project", title: "", org: "", start: "", end: "", bullets: [], skills: [], tracks: [], status: "confirmed_user", evidence: [], notes: "" };
  modal(`<h2>${it.id ? "Edit" : "Add"} career evidence</h2><div class="grid g2">
    <label class="f">Title<input type="text" id="it_title" value="${esc(it.title)}"></label><label class="f">Organisation<input type="text" id="it_org" value="${esc(it.org)}"></label>
    <label class="f">Type<select id="it_type">${["employment", "internship", "project", "leadership", "achievement", "training", "certification", "research", "competition"].map((t) => `<option ${t === it.type ? "selected" : ""}>${t}</option>`).join("")}</select></label>
    <label class="f">Verification<select id="it_status">${Object.entries(E.STATUS_LABEL).map(([k, v]) => `<option value="${k}" ${k === it.status ? "selected" : ""}>${v}</option>`).join("")}</select></label>
    <label class="f">Start (YYYY-MM)<input type="text" id="it_start" value="${esc(it.start)}"></label><label class="f">End (YYYY-MM or Present)<input type="text" id="it_end" value="${esc(it.end)}"></label></div>
    <label class="f mt">Description / achievements (one per line, facts only)<textarea id="it_bullets">${esc((it.bullets || []).join("\n"))}</textarea></label>
    <label class="f mt">Evidence or source (document, link, certificate number)<input type="text" id="it_ev" value="${esc((it.evidence || []).join(", "))}"></label>
    <label class="f mt">Career tracks</label><div class="row">${Object.entries(TRACKS).map(([k, v]) => `<label class="small"><input type="checkbox" class="it_tr" value="${k}" ${(it.tracks || []).includes(k) ? "checked" : ""}> ${esc(v)}</label>`).join("")}</div>
    <p class="tiny muted mt">Skills are detected automatically from the text using the keyword library. Use "Requires confirmation" for anything not yet backed by a document.</p>
    <div class="row mt"><button class="btn primary" data-act="saveItem" data-id="${it.id}">Save</button>${it.id ? `<button class="btn danger" data-act="delItem" data-id="${it.id}">Delete</button>` : ""}<button class="btn" data-act="closeModal">Cancel</button></div>`);
};
ACT.saveItem = (d) => {
  const v = (i) => document.getElementById(i).value.trim();
  if (!v("it_title")) return toast("Title is required");
  let it = S.profile.items.find((i) => i.id === d.id);
  if (!it) { it = { id: "U" + Date.now().toString(36) }; S.profile.items.push(it); }
  const bullets = v("it_bullets").split("\n").map((x) => x.trim()).filter(Boolean);
  Object.assign(it, { title: v("it_title"), org: v("it_org"), type: v("it_type"), status: v("it_status"), start: v("it_start"), end: v("it_end"), bullets, evidence: v("it_ev") ? v("it_ev").split(/,\s*/) : [], tracks: [...document.querySelectorAll(".it_tr:checked")].map((x) => x.value) });
  it.skills = [...new Set([...(it.skills || []), ...E.findKeywords([it.title, it.org, ...bullets].join(". ")).map((k) => k.id)])];
  logActivity((d.id ? "Updated" : "Added") + " profile item: " + it.title);
  profileChanged(); closeModal(); rerender();
};
ACT.delItem = async (d) => { if (!await ask("Delete this item from your career profile?")) return; S.profile.items = S.profile.items.filter((i) => i.id !== d.id); profileChanged(); closeModal(); rerender(); };

// ---------------------------------------------------------------- Market intelligence
route("market", () => {
  const active = S.jobs.filter((j) => !isExpired(j));
  const kwCount = (filterFn, cats) => { const m = {}; active.filter(filterFn || (() => true)).forEach((j) => C(j).a.keywords.forEach((k) => { if (!cats || cats.includes(k.cat)) m[k.term] = (m[k.term] || 0) + 1; })); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const tech = kwCount(null, ["technical", "domain"]).slice(0, 15);
  const soft = kwCount(null, ["software"]).slice(0, 12);
  const certs = {}; active.forEach((j) => C(j).a.constraints.certsRequired.forEach((c) => (certs[c.name] = (certs[c.name] || 0) + 1)));
  const certRows = Object.entries(certs).sort((a, b) => b[1] - a[1]);
  const city = {}; active.forEach((j) => (city[jobCity(j)] = (city[jobCity(j)] || 0) + 1));
  const kinds = {}; active.forEach((j) => (kinds[jobKind(j)] = (kinds[jobKind(j)] || 0) + 1));
  const sat = active.filter((j) => C(j).a.constraints.nationality === "saudi").length;
  const yrs = { "No minimum stated": 0, "0 years": 0, "1 to 2 years": 0, "3 to 5 years": 0, "6+ years": 0 };
  active.forEach((j) => { const y = C(j).a.constraints.minYears; if (y == null) yrs["No minimum stated"]++; else if (y === 0) yrs["0 years"]++; else if (y <= 2) yrs["1 to 2 years"]++; else if (y <= 5) yrs["3 to 5 years"]++; else yrs["6+ years"]++; });
  const emp = {}; active.forEach((j) => (emp[j.employer] = (emp[j.employer] || 0) + 1));
  const libs = Object.keys(TRACKS).map((t) => [t, kwCount((j) => (j.tracks || []).includes(t), ["technical", "software", "domain", "cert", "business", "regulatory"]).slice(0, 14)]);
  const R = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
  return {
    title: "Saudi Market Intelligence", sub: "Observed advert patterns (" + active.length + " active adverts, captured " + fmtDate(S.researchDate) + ") kept separate from verified external facts",
    html: `<div class="note mb"><b>Two kinds of evidence.</b> "Observed in adverts" counts what this database's adverts say; it is a sample, not labour-market statistics. "Verified external facts" are regulations and program facts with sources. No market statistics are invented.</div>
    <h2 style="font-size:16px">Observed in adverts</h2><div class="grid g2">
      <div class="card"><h2>Most requested technical and domain terms</h2><p class="tiny muted">Number of active adverts mentioning each term</p>${barList(tech)}${tableView(tech, ["Term", "Adverts"])}</div>
      <div class="card"><h2>Software and tools requested</h2>${barList(soft)}${tableView(soft, ["Tool", "Adverts"])}</div>
      <div class="card"><h2>Certifications and licences mentioned</h2>${certRows.length ? barList(certRows) : '<p class="small muted">None</p>'}</div>
      <div class="card"><h2>Experience asked for</h2>${barList(R(yrs))}<p class="small mt">${sat} of ${active.length} active adverts (${Math.round((sat / active.length) * 100)}%) are restricted to Saudi nationals.</p></div>
      <div class="card"><h2>Location</h2>${barList(R(city))}</div>
      <div class="card"><h2>Opportunity type (internship and graduate availability)</h2>${barList(R(kinds))}</div>
      <div class="card"><h2>Employers with the most adverts</h2>${barList(R(emp).slice(0, 12))}<p class="tiny muted">Recruitment pattern: large consultancies (Parsons, WSP, AESG) post mostly experienced site roles; graduate entry comes through named programs (Saipem GDP, ENGIE, Siemens Energy, Hitachi Energy) and Tamheer.</p></div>
    </div>
    <h2 style="font-size:16px;margin-top:22px">Verified external facts</h2><div class="grid g2">${S.market.facts.map((f) => `<div class="card"><h2>${esc(f.topic)}</h2><p class="small">${esc(f.fact)}</p><p class="small"><b>What it means for you:</b> ${esc(f.implication)}</p><p class="tiny muted">${esc(f.type)} · verified ${fmtDate(f.verified)}${f.caveat ? " · Caveat: " + esc(f.caveat) : ""}</p><div class="tiny">${f.sources.map((s) => `<a href="${esc(s)}" target="_blank" rel="noopener">${esc(s.replace(/^https?:\/\//, "").slice(0, 70))}</a>`).join("<br>")}</div></div>`).join("")}</div>
    <p class="small muted mt">${esc(S.market.salaryNote)}</p>
    <h2 style="font-size:16px;margin-top:22px">Keyword libraries by career track (from adverts)</h2><div class="grid g3">${libs.map(([t, rows]) => `<div class="card"><h2>${esc(trackName(t))}</h2>${rows.map(([k, n]) => `<span class="kw">${esc(k)} <span class="muted">${n}</span></span>`).join("") || '<span class="small muted">Too few adverts</span>'}</div>`).join("")}</div>`,
  };
});

// ---------------------------------------------------------------- Watchlist
route("watchlist", () => {
  const T = { A: "Actual advertised vacancy", B: "Open talent pool", C: "General CV submission", D: "Speculative networking" };
  const comps = S.companies.map((c) => { const open = S.jobs.filter((j) => !isExpired(j) && companyMatch(c, j.employer)); return { c, open }; });
  return {
    title: "Company Watchlist", sub: S.companies.length + " organisations · a company is only called 'hiring' when a verified vacancy is in the database",
    actions: `<button class="btn primary" data-act="addCompany">+ Add company</button>`,
    html: `<div class="row mb">${Object.entries(T).map(([k, v]) => `<span class="pill"><b>${k}</b> ${v}</span>`).join("")}</div>
    <div class="tablewrap" style="max-height:none"><table><thead><tr><th>Company</th><th>Type</th><th>Industry / location</th><th>Tracks</th><th>Programs</th><th>Careers site</th><th>Notes / your reason to join</th></tr></thead><tbody>
    ${comps.map(({ c, open }, n) => `<tr><td><a href="#/company/${encodeURIComponent(c.name)}"><b class="small">${c.followed ? "★ " : ""}${esc(c.name)}</b></a><div class="tiny muted">Checked ${fmtDate(c.userChecked || c.lastChecked)}${c.userChecked ? " (you)" : ""}</div></td>
      <td><select data-chg="compType" data-n="${n}" class="small">${Object.keys(T).map((k) => `<option value="${k}" ${(open.length ? "A" : c.opportunityType) === k ? "selected" : ""} ${k === "A" && !open.length ? "disabled" : ""}>${k}: ${T[k]}</option>`).join("")}</select>${open.length ? `<div class="tiny"><a href="#/discover" data-act="filterCo" data-co="${esc(open[0].employer)}">${open.length} verified vacanc${open.length > 1 ? "ies" : "y"}</a></div>` : '<div class="tiny muted">No verified vacancy</div>'}</td>
      <td class="small">${esc(c.industry)}<div class="tiny muted">${esc(c.location)}</div></td><td class="tiny">${(c.tracks || []).map(trackName).join(", ")}</td>
      <td class="tiny">${esc([c.internshipPrograms, c.graduatePrograms, c.talentPool].filter(Boolean).join(" · "))}</td>
      <td class="tiny">${c.careersUrl ? `<a href="${esc(c.careersUrl)}" target="_blank" rel="noopener">Open ↗</a><div class="muted">${esc(c.careersCheck)}</div>` : '<span class="muted">Not recorded</span>'}</td>
      <td class="tiny">${esc(c.notes)}<textarea data-chg="compWhy" data-n="${n}" placeholder="Your own reason to join (used in cover letters)" style="min-height:44px;margin-top:4px">${esc(c.whyNote || "")}</textarea></td></tr>`).join("")}
    </tbody></table></div>`,
  };
});
function companyMatch(c, employer) { const e = (employer || "").toLowerCase(); const first = c.name.toLowerCase().split(/[ (/]/)[0]; return (first.length > 3 && e.includes(first)) || (c.aliases || []).some((a) => e.includes(a.toLowerCase())); }
ACT.compType = (d, t) => { S.companies[d.n].opportunityType = t.value; save(); };
ACT.compWhy = (d, t) => { S.companies[d.n].whyNote = t.value; save(); toast("Saved. Used in cover letters for this company."); };
ACT.filterCo = (d) => { F.tab = "all"; F.company = d.co; go("#/discover"); };
ACT.addCompany = () => {
  modal(`<h2>Add a company</h2><div class="grid g2"><label class="f">Name<input type="text" id="co_name"></label><label class="f">Industry<input type="text" id="co_ind"></label><label class="f">Location<input type="text" id="co_loc" value="Riyadh"></label><label class="f">Careers URL<input type="url" id="co_url"></label></div>
    <label class="f mt">Type<select id="co_type"><option value="B">B: Open talent pool</option><option value="C">C: General CV submission</option><option value="D" selected>D: Speculative networking</option></select></label><label class="f mt">Notes<textarea id="co_notes" style="min-height:70px"></textarea></label>
    <div class="row mt"><button class="btn primary" data-act="saveCompany">Save</button><button class="btn" data-act="closeModal">Cancel</button></div>`);
};
ACT.saveCompany = () => { const v = (i) => document.getElementById(i).value.trim(); if (!v("co_name")) return; S.companies.unshift({ name: v("co_name"), aliases: [], industry: v("co_ind"), location: v("co_loc"), careersUrl: v("co_url"), careersCheck: "Added by you", tracks: [], departments: [], typicalRoles: [], keywords: [], internshipPrograms: "", graduatePrograms: "", talentPool: "", lastChecked: TODAY(), notes: v("co_notes"), opportunityType: v("co_type"), whyNote: "" }); save(); closeModal(); rerender(); };

// ---------------------------------------------------------------- Keyword intelligence
route("keywords", () => {
  const active = S.jobs.filter((j) => !isExpired(j));
  const idx = evidenceIndex();
  const cvText = S.master.model ? S.master.model.text : "";
  const freq = {}; active.forEach((j) => C(j).a.keywords.forEach((k) => (freq[k.id] = (freq[k.id] || 0) + 1)));
  const rows = E.TAXONOMY.map((k) => { const ev = idx[k.id]; const inCV = [k.term, ...k.syn].some((v) => E.countVariant(cvText, v)); const st = inCV ? "On your CV" : ev && ev.trusted.length ? "Evidenced, not on CV" : ev && ev.unverified.length ? "Unconfirmed" : "No evidence"; return { k, n: freq[k.id] || 0, st }; }).sort((a, b) => b.n - a.n);
  const gaps = rows.filter((r) => r.n >= 3 && r.st === "No evidence").slice(0, 12);
  return {
    title: "Keyword Intelligence", sub: E.TAXONOMY.length + " canonical terms with employer synonyms, measured against " + active.length + " active adverts",
    html: `<div class="grid g2 mb"><div class="card"><h2>Skill gaps worth closing</h2><p class="small muted">Requested in 3+ active adverts and with no evidence in your profile. These are learning targets, not things to add to a CV.</p>${gaps.map((r) => `<span class="kw missing">${esc(r.k.term)} · ${r.n}</span>`).join("") || '<span class="small muted">None</span>'}</div>
      <div class="card"><h2>Evidenced but missing from your master CV</h2><p class="small muted">You can surface these truthfully when a job asks for them.</p>${rows.filter((r) => r.n >= 2 && r.st === "Evidenced, not on CV").map((r) => `<span class="kw supported">${esc(r.k.term)} · ${r.n}</span>`).join("") || '<span class="small muted">None</span>'}</div></div>
      <div class="card"><div class="tablewrap"><table><thead><tr><th>Term</th><th>Equivalent wording (synonyms)</th><th>Category</th><th>Tracks</th><th class="num">Adverts</th><th>Your status</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td><b class="small">${esc(r.k.term)}</b></td><td class="tiny">${esc(r.k.syn.join(" · "))}</td><td class="small">${esc(r.k.cat)}</td><td class="tiny">${r.k.tracks.map(trackName).join(", ")}</td><td class="num">${r.n}</td><td><span class="kw ${{ "On your CV": "exact", "Evidenced, not on CV": "supported", Unconfirmed: "unsupported", "No evidence": "missing" }[r.st]}">${r.st}</span></td></tr>`).join("")}
      </tbody></table></div><p class="tiny muted mt">Exact matches use the advert's own wording; equivalent matches use a synonym listed here. Only true equivalents are listed (for example HVAC = heating, ventilation and air conditioning; UAV = UAS = drone).</p></div>`,
  };
});

// ---------------------------------------------------------------- Settings
route("settings", () => ({
  title: "Settings", sub: "Privacy, backups, integrations",
  html: `<div class="grid g2"><div class="card"><h2>Privacy</h2><p class="small">All data (profile, CVs, jobs, applications) is stored in this browser's IndexedDB on this device. CareerOS makes no network requests with your data. The only optional network use is the local companion you run yourself, and live search only sends the keywords you type.</p>
      <p class="small">Last saved: ${esc(S._savedAt ? new Date(S._savedAt).toLocaleString() : "this session")}</p></div>
    <div class="card"><h2>Appearance</h2><label class="f">Theme<select data-chg="setTheme">${["auto", "light", "dark"].map((t) => `<option value="${t}" ${(S.settings.theme || "auto") === t ? "selected" : ""}>${{ auto: "Match my device", light: "Light", dark: "Dark" }[t]}</option>`).join("")}</select></label></div>
    <div class="card"><h2>CV format</h2><label class="row"><input type="checkbox" ${S.settings.formatLock ? "checked" : ""} data-chg="formatLock"> <b>LOCK ORIGINAL CV FORMAT: ${S.settings.formatLock ? "ON" : "OFF"}</b></label><p class="small muted">See My Master CV for details.</p></div>
    <div class="card"><h2>Backup and restore</h2><div class="row"><button class="btn primary" data-act="backup">Export full backup (JSON)</button><label class="btn">Restore from backup<input type="file" accept=".json" class="hide" data-chg="restore"></label><button class="btn" data-act="exportProfile">Export career profile (JSON)</button><button class="btn" data-act="exportJobs">Export opportunities (CSV)</button></div><p class="tiny muted mt">A backup includes your CV files, tailored versions and tracker. Keep it private.</p></div>
    <div class="card"><h2>Live search companion (optional)</h2><label class="f">Companion URL<input type="url" value="${esc(S.settings.companionUrl)}" data-chg="setCompanion"></label><div class="row mt"><button class="btn" data-act="testCompanion">Test connection</button><span id="compStatus" class="small"></span></div>
      <p class="small mt">The companion (<code>tools/careeros_server.py</code>) adds: real search via Google Programmable Search or JSearch (needs your own API key, stored only on your computer), re-checking whether an advert is still open, and exact DOCX to PDF export with LibreOffice. Keys never enter this page.</p></div>
    <div class="card"><h2>Reset research data</h2><p class="small">Reload the jobs, companies and market facts from the research snapshot (${fmtDate(SEED.researchDate)}). Your profile, CVs and tracker are kept.</p><button class="btn" data-act="reseed">Reload research snapshot</button></div>
    <div class="card"><h2>Delete all local data</h2><p class="small">Removes everything CareerOS stored in this browser. Export a backup first if you want to keep anything.</p><button class="btn danger" data-act="wipe">Delete all my data</button></div></div>`,
}));
ACT.setTheme = (d, t) => { S.settings.theme = t.value; save(); applyTheme(); };
ACT.theme = () => { const o = ["auto", "light", "dark"]; S.settings.theme = o[(o.indexOf(S.settings.theme || "auto") + 1) % 3]; save(); applyTheme(); toast("Theme: " + S.settings.theme); };
ACT.setCompanion = (d, t) => { S.settings.companionUrl = t.value.replace(/\/$/, ""); save(); };
ACT.testCompanion = async () => { const el = document.getElementById("compStatus"); el.textContent = "Testing..."; try { const r = await fetch(S.settings.companionUrl + "/health"); const j = await r.json(); el.innerHTML = `<b class="ok">Connected.</b> Search: ${esc(j.search || "not configured")} · PDF export: ${j.pdf ? "available" : "LibreOffice not found"}`; } catch (e) { el.innerHTML = `<b class="bad">Not reachable.</b> Start it with python3 tools/careeros_server.py`; } };
ACT.backup = () => download("CareerOS_Backup_" + TODAY() + ".json", JSON.stringify(S), "application/json");
ACT.restore = async (d, t) => { const f = t.files[0]; if (!f) return; try { const st = JSON.parse(await f.text()); if (!st.profile || !st.jobs) throw new Error("Not a CareerOS backup"); if (!await ask("Replace all current data with this backup?")) return; saveBlocked = ""; S = st; invalidate(); await save(true); toast("Backup restored"); go("#/dashboard"); } catch (e) { toast("Restore failed: " + e.message, 5000); } };
ACT.exportProfile = () => download("CareerOS_Master_Profile.json", JSON.stringify(S.profile, null, 2), "application/json");
ACT.exportJobs = () => {
  const H = ["Job ID", "Job Title", "Employer", "Location", "Career Track", "Employment Type", "Salary", "Education", "Experience (min years)", "Skills", "Publication Date", "Deadline", "Verification Date", "Job Status", "Eligibility", "Match Score", "Source", "Application URL", "Notes"];
  const rows = S.jobs.map((j) => { const c = C(j); return [j.jobId, j.title, j.employer, j.location, (j.tracks || []).map(trackName).join("; "), j.type, j.salary, describeDegree(c.a.constraints.degree), c.a.constraints.minYears ?? "", c.a.keywords.slice(0, 10).map((k) => k.term).join("; "), j.published, j.deadline, j.verifiedDate, isExpired(j) ? "Closed" : j.status, c.el.label, c.m.total, j.source, j.applyUrl, j.notes || ""]; });
  download("CareerOS_Opportunities_" + TODAY() + ".csv", "﻿" + [H, ...rows].map((r) => r.map((x) => '"' + String(x == null ? "" : x).replace(/"/g, '""') + '"').join(",")).join("\n"), "text/csv");
};
ACT.reseed = async () => { if (!await ask("Reload research jobs, companies and market facts? Manually imported jobs are kept.")) return; const manual = S.jobs.filter((j) => j.origin !== "research_session"); S.jobs = clone(SEED.jobs).concat(manual); S.companies = clone(SEED.companies); S.excluded = clone(SEED.excluded); S.market = clone(SEED.market); invalidate(); save(); toast("Research snapshot reloaded"); rerender(); };
ACT.wipe = async () => { if (!await ask("Delete ALL CareerOS data stored in this browser? This cannot be undone.")) return; saveBlocked = ""; await idbClear(); S = freshState(); await rebuildMasterModel(); invalidate(); await save(true); toast("All data deleted. Fresh research snapshot loaded."); go("#/dashboard"); };

// ---------------------------------------------------------------- boot
(async function boot() {
  try {
    await loadState();
    applyTheme();
    const sn = document.getElementById("storeNote"); if (sn) sn.textContent = HOOKS.save ? "Saved privately to your Claude account." : "Saved in this browser only.";
    document.getElementById("loading").remove();
    render();
  } catch (e) {
    document.getElementById("loading").innerHTML = "CareerOS could not start: " + esc(e.message) + ". Your browser must allow IndexedDB (not a private window in some browsers).";
    console.error(e);
  }
})();
