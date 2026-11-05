/* Application Builder and Application Tracker. */
route("builder", (id) => {
  if (!id) {
    const withV = [...new Set(S.cvVersions.map((v) => v.jobId))].map(jobById).filter(Boolean);
    const pk = S.packages.slice().reverse();
    return { title: "Application Command Center", sub: "Complete, editable application packages",
      html: `<div class="grid g2"><div class="card"><h2>Jobs with a tailored CV</h2>${withV.length ? `<table><tbody>${withV.map((j) => `<tr><td><a href="#/builder/${j.jobId}">${esc(j.title)}</a><div class="tiny muted">${esc(j.employer)}</div></td><td>${elPill(C(j).el.label)}</td></tr>`).join("")}</tbody></table>` : `<p class="small muted">None yet. Start in <a href="#/optimize">CV Optimizer</a>. You can also build a package from any job page.</p>`}</div>
      <div class="card"><h2>Generated packages</h2>${pk.length ? `<table><tbody>${pk.map((p) => { const j = jobById(p.jobId); return `<tr><td><a href="#/builder/${p.jobId}">${esc(j ? j.title : p.jobId)}</a><div class="tiny muted">${esc(j ? j.employer : "")} · ${fmtDate(p.created)}</div></td></tr>`; }).join("")}</tbody></table>` : `<p class="small muted">None yet.</p>`}</div></div>` };
  }
  const j = jobById(id); if (!j) return { title: "Job not found", html: "" };
  const c = C(j);
  const versions = S.cvVersions.filter((v) => v.jobId === id);
  const p = S.packages.filter((x) => x.jobId === id).slice(-1)[0];
  let html = `<div class="row mb">${elPill(c.el.label, c.el.summary)}<span class="pill">Match ${c.m.total}/100</span><span class="pill">CV versions: ${versions.length}</span></div>`;
  html += `<div class="card mb"><div class="row between"><div><h2>Package for ${esc(j.title)} · ${esc(j.employer)}</h2><p class="small muted">Uses only your verified career database. Fields that need you are marked <b>YOUR INPUT REQUIRED</b>. CareerOS never submits anything for you.</p></div>
    <button class="btn primary big" data-act="genPkg" data-id="${id}">${p ? "REGENERATE" : "GENERATE"} COMPLETE APPLICATION PACKAGE</button></div>
    ${versions.length ? `<p class="small">Tailored CV linked: <b>${esc(versions[versions.length - 1].name)}</b></p>` : `<div class="flag">No tailored CV yet for this job. The package will reference your master CV. <a href="#/optimize/${id}">Tailor the CV first</a> for best results.</div>`}</div>`;
  const rd = E.readiness(j, c.a, { cvVersions: S.cvVersions, packages: S.packages, profile: S.profile });
  html += `<div class="card mb"><div class="row between"><h2>Application readiness: ${rd.score}%</h2><a class="btn sm" href="${esc(j.applyUrl || j.source)}" target="_blank" rel="noopener">Open application page ↗</a></div><div class="meter"><i style="width:${rd.score}%"></i></div>
    <div class="grid g2 mt">${rd.items.map((i) => `<div class="row" style="flex-wrap:nowrap"><span>${i.done ? '<b class="ok">✓</b>' : i.needed ? '<b class="bad">○</b>' : '<span class="muted">○</span>'}</span><span class="small">${esc(i.name)}<div class="tiny muted">${esc(i.note || "")}</div></span></div>`).join("")}</div>
    ${rd.missing.length ? `<p class="small mt"><b>Missing:</b> ${rd.missing.map(esc).join(", ")}</p>` : ""}<p class="tiny muted">${esc(rd.note)}</p></div>`;
  if (p) {
    p.approved = p.approved || {};
    const apr = (k) => `<button class="btn sm ${p.approved[k] ? "primary" : ""}" data-act="approve" data-id="${id}" data-k="${k}">${p.approved[k] ? "✓ Approved" : "Approve"}</button>`;
    const ta = (k, val, h) => `<textarea data-inp="pkgEdit" data-id="${id}" data-k="${k}" style="min-height:${h || 160}px">${esc(val)}</textarea>`;
    html += `<div class="tabs">${[["cover", "Cover letter"], ["msg", "Email and messages"], ["form", "Application form answers"], ["strategy", "Strategy"], ["interview", "Interview preparation"], ["check", "Apply checklist"]].map(([k, l]) => `<a class="${BT.tab === k ? "on" : ""}" data-act="btab" data-t="${k}">${l}</a>`).join("")}</div>`;
    if (BT.tab === "cover") html += `<div class="card"><div class="row between"><h2>Cover letter (editable)</h2><div class="row">${apr("coverLetter")}<button class="btn sm" data-act="dlCover" data-id="${id}">Download DOCX</button><button class="btn sm" data-act="printDoc" data-id="${id}" data-k="coverLetter">Print / save as PDF</button></div></div>${ta("coverLetter", p.coverLetter, 520)}<p class="tiny muted">Edits save automatically. Replace the bracketed sentence with a real reason; CareerOS will not invent one.</p></div>`;
    if (BT.tab === "msg") html += `<div class="grid g2">${[["applicationEmail", "Application email"], ["recruiterIntro", "Recruiter LinkedIn message"], ["followUp", "Application follow-up"], ["internshipInquiry", "Internship inquiry"], ["graduateInquiry", "Graduate opportunity inquiry"], ["referralRequest", "Referral request"]].map(([k, l]) => `<div class="card"><h2>${l}</h2>${ta("messages." + k, p.messages[k], 170)}<button class="btn sm mt" data-act="copy" data-id="${id}" data-k="messages.${k}">Copy</button></div>`).join("")}<div class="card"><p class="small">${esc(p.messages.note)}</p><div class="row mt">${apr("messages")}</div></div></div>`;
    if (BT.tab === "form") html += `<div class="card"><div class="row between"><h2>Suggested answers for common questions</h2>${apr("form")}</div>${p.form.map((f, i) => `<h3>${esc(f.q)} ${f.input ? '<span class="el YELLOW">YOUR INPUT REQUIRED</span>' : ""}</h3>${ta("form." + i, f.a, 90)}`).join("")}</div>`;
    if (BT.tab === "strategy") { const s = p.strategy; html += `<div class="grid g2"><div class="card"><h2>Approach</h2><p>${esc(s.approach)}</p><h3>Three strongest selling points</h3><ol class="small">${s.sellingPoints.map((x) => `<li>${esc(x)}</li>`).join("")}</ol><h3>Requirements to emphasise</h3>${s.emphasize.map((x) => `<span class="kw supported">${esc(x)}</span>`).join("") || "-"}<h3>Most relevant CV sections</h3><p class="small">${s.relevantSections.join(", ")}</p></div>
      <div class="card"><h2>Potential weaknesses</h2><ul class="small">${s.weaknesses.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><h3>Talking points</h3><ul class="small">${s.talkingPoints.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><h3>Prepare before applying</h3><ul class="small">${s.prepare.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></div>`; }
    if (BT.tab === "interview") { const iv = p.interview; html += `<div class="card"><div class="row between"><h2>Interview preparation</h2><button class="btn sm" data-act="dlInterview" data-id="${id}">Download DOCX</button></div><p class="tiny muted">${esc(iv.note)}</p>
      <h3>Company background</h3><ul class="small">${iv.company.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><h3>Role responsibilities (from the advert)</h3><ul class="small">${iv.responsibilities.map((x) => `<li>${esc(x)}</li>`).join("") || "<li>Not detected</li>"}</ul>
      <h3>Technical topics to revise</h3><ul class="small">${iv.technicalTopics.map((x) => `<li>${esc(x)}</li>`).join("") || "<li>No specific topics detected</li>"}</ul><h3>Questions based on the advert</h3><ul class="small">${iv.likelyQuestions.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><h3>General questions</h3><ul class="small">${iv.generalQuestions.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <h3>Questions to ask the interviewer</h3><ul class="small">${iv.questionsToAsk.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><h3>Your evidence for answers</h3>${iv.evidenceMap.map((e) => `<p class="small"><b>${esc(e.item)}</b><br>${e.use.map(esc).join("<br>")}</p>`).join("")}</div>`; }
    if (BT.tab === "check") html += `<div class="card"><h2>Application checklist</h2><ul class="chk">${p.checklist.map((x, i) => `<li><label><input type="checkbox" data-chg="chk" data-id="${id}" data-i="${i}" ${(p.done || {})[i] ? "checked" : ""}> ${esc(x)}</label></li>`).join("")}</ul>
      <div class="row mt"><a class="btn" href="${esc(j.applyUrl || j.source)}" target="_blank" rel="noopener">Open official application ↗</a><button class="btn primary" data-act="markApplied" data-id="${id}">I have submitted this application</button></div><p class="tiny muted">Only click after you have actually submitted. CareerOS never submits on your behalf.</p></div>`;
    html += `<div class="card mt"><div class="row between"><div><h2>Download everything</h2><p class="small muted">ZIP with tailored CV (DOCX), cover letter (DOCX), interview prep (DOCX), messages, form answers, strategy and checklist (Markdown).</p></div><button class="btn primary" data-act="dlPkg" data-id="${id}">Download application package (.zip)</button></div></div>`;
  }
  return { title: "Application Command Center", sub: j.title + " · " + j.employer, actions: `<a class="btn" href="#/optimize/${id}">← CV Optimizer</a><a class="btn" href="#/tracker">Tracker</a>`, html };
});
const BT = { tab: "cover" };
ACT.btab = (d) => { BT.tab = d.t; rerender(); };
ACT.approve = (d) => { const p = pkgFor(d.id); p.approved = p.approved || {}; p.approved[d.k] = !p.approved[d.k]; save(); rerender(); };
ACT.genPkg = (d) => {
  const j = jobById(d.id), c = C(j);
  const versions = S.cvVersions.filter((v) => v.jobId === d.id);
  const g = E.generatePackage(j, c.a, c.m, S.profile, companyFor(j.employer), { coverage: c.cov, today: Date.now() });
  const p = Object.assign({ id: uid("PKG"), jobId: d.id, created: TODAY(), cvVersionId: versions.length ? versions[versions.length - 1].id : "" }, g);
  S.packages = S.packages.filter((x) => x.jobId !== d.id); S.packages.push(p);
  const app = addToTracker(d.id); app.packageId = p.id; if (p.cvVersionId) app.cvVersionId = p.cvVersionId;
  logActivity("Application package generated: " + j.title);
  save(); rerender();
};
function pkgFor(id) { return S.packages.filter((x) => x.jobId === id).slice(-1)[0]; }
function setPath(o, path, v) { const k = path.split("."); let x = o; for (let i = 0; i < k.length - 1; i++) x = x[k[i]]; const last = k[k.length - 1]; if (Array.isArray(x) && x[last] && typeof x[last] === "object") x[last].a = v; else x[last] = v; }
function getPath(o, path) { const k = path.split("."); let x = o; for (const p of k) x = x[p]; return typeof x === "object" && x && "a" in x ? x.a : x; }
ACT.pkgEdit = (d, t) => { setPath(pkgFor(d.id), d.k, t.value); save(); };
ACT.copy = async (d) => { await navigator.clipboard.writeText(getPath(pkgFor(d.id), d.k)); toast("Copied"); };
ACT.chk = (d, t) => { const p = pkgFor(d.id); p.done = p.done || {}; p.done[d.i] = t.checked; save(); };
ACT.dlCover = async (d) => { const j = jobById(d.id); download("Cover_Letter_" + j.employer.replace(/\W+/g, "_") + ".docx", await makeDocx(pkgFor(d.id).coverLetter.split("\n"), { after: 60 })); };
function interviewParas(p) { const iv = p.interview; const out = [{ text: "Interview preparation", bold: true, size: 14 }, iv.note, ""]; const sec = (h, arr) => { out.push({ text: h, bold: true }); arr.forEach((x) => out.push("- " + x)); out.push(""); }; sec("Company background", iv.company); sec("Role responsibilities", iv.responsibilities); sec("Technical topics", iv.technicalTopics); sec("Questions based on the advert", iv.likelyQuestions); sec("General questions", iv.generalQuestions); sec("Questions to ask", iv.questionsToAsk); iv.evidenceMap.forEach((e) => { out.push({ text: e.item, bold: true }); e.use.forEach((u) => out.push("- " + u)); }); return out; }
ACT.dlInterview = async (d) => { const j = jobById(d.id); download("Interview_Prep_" + j.employer.replace(/\W+/g, "_") + ".docx", await makeDocx(interviewParas(pkgFor(d.id)))); };
ACT.printDoc = (d) => { if (HOOKS.noPrint) { toast("Printing is not available in this view. Use Download DOCX or Copy.", 5000); return; } const p = pkgFor(d.id); const w = window.open("", "_blank"); w.document.write(`<html><head><title>Document</title><style>body{font-family:Calibri,Arial,sans-serif;font-size:12pt;max-width:720px;margin:40px auto;white-space:pre-wrap;line-height:1.45}</style></head><body>${esc(getPath(p, d.k))}<script>setTimeout(()=>print(),300)<\/script></body></html>`); w.document.close(); };
ACT.dlPkg = async (d) => {
  const j = jobById(d.id), p = pkgFor(d.id), zip = new JSZip();
  const pend = ["coverLetter", "messages", "form"].filter((k) => !(p.approved || {})[k]);
  if (pend.length && !(await ask("Not yet approved: " + pend.map((k) => ({ coverLetter: "cover letter", messages: "email and messages", form: "form answers" }[k])).join(", ") + ". Export anyway?"))) return;
  const base = j.employer.replace(/\W+/g, "_") + "_" + E.cleanTitle(j.title).replace(/\W+/g, "_");
  const v = S.cvVersions.find((x) => x.id === p.cvVersionId);
  if (v) zip.file(v.name, b64ToBytes(v.bytesB64)); else zip.file("MASTER_CV_not_tailored.docx", b64ToBytes(S.master.docxB64));
  zip.file("Cover_Letter.docx", await makeDocx(p.coverLetter.split("\n"), { after: 60 }));
  zip.file("Interview_Preparation.docx", await makeDocx(interviewParas(p)));
  const md = (h, body) => "# " + h + "\n\n" + body + "\n";
  zip.file("Recruiter_Messages.md", md("Recruiter messages: " + j.title, Object.entries(p.messages).map(([k, v]) => "## " + k + "\n\n" + v).join("\n\n")));
  zip.file("Application_Form_Answers.md", md("Application form answers", p.form.map((f) => "## " + f.q + (f.input ? " (YOUR INPUT REQUIRED)" : "") + "\n\n" + f.a).join("\n\n")));
  const s = p.strategy;
  zip.file("Application_Strategy.md", md("Application strategy", "Approach: " + s.approach + "\n\n## Selling points\n" + s.sellingPoints.map((x) => "- " + x).join("\n") + "\n\n## Emphasise\n" + s.emphasize.map((x) => "- " + x).join("\n") + "\n\n## Weaknesses\n" + s.weaknesses.map((x) => "- " + x).join("\n") + "\n\n## Prepare\n" + s.prepare.map((x) => "- " + x).join("\n")));
  zip.file("Apply_Checklist.md", md("Checklist", p.checklist.map((x) => "- [ ] " + x).join("\n") + "\n\nOfficial advert: " + (j.applyUrl || j.source) + "\nJob ID: " + j.jobId));
  download("Application_Package_" + base + ".zip", await zip.generateAsync({ type: "blob" }));
};
ACT.markApplied = async (d) => {
  if (!await ask("Confirm: you have submitted this application yourself on the employer's site or portal?")) return;
  const a = addToTracker(d.id); a.status = "Applied"; a.appliedDate = TODAY(); a.history.push({ date: TODAY(), status: "Applied" });
  if (!a.followUp) { const f = new Date(); f.setDate(f.getDate() + 10); a.followUp = f.toISOString().slice(0, 10); }
  logActivity("Marked as applied (confirmed by you): " + jobById(d.id).title); save(); toast("Marked as Applied. Follow-up set for " + fmtDate(a.followUp)); go("#/tracker");
};

// ---------------------------------------------------------------- Tracker
const TR = { view: "table", month: null, status: "" };
const CHANNELS = ["LinkedIn Easy Apply", "Employer career portal", "Email to recruiter", "Referral", "Job board (Bayt, Indeed, GulfTalent)", "Program portal (Misk, HRDF, Jadarat)", "Career fair", "Other"];
route("tracker", () => {
  const apps = S.applications.filter((a) => !TR.status || a.status === TR.status);
  const now = TODAY();
  const overdue = S.applications.filter((a) => a.followUp && a.followUp < now && !["Rejected", "Accepted", "Withdrawn"].includes(a.status));
  const upcoming = S.applications.map((a) => ({ a, j: jobById(a.jobId) })).filter((x) => x.j && x.a.deadline && x.a.deadline >= now).sort((x, y) => x.a.deadline.localeCompare(y.a.deadline));
  let body;
  if (TR.view === "calendar") body = calendar();
  else body = apps.length ? `<div class="tablewrap" style="max-height:none"><table><thead><tr><th>Position</th><th>Eligibility</th><th class="num">Match</th><th class="num">Keyword cov.</th><th>Status</th><th>Channel</th><th>Applied</th><th>Deadline</th><th>Follow-up</th><th>Contact</th><th>CV / package</th><th>Notes</th><th></th></tr></thead><tbody>
    ${apps.map((a) => { const j = jobById(a.jobId) || (a.snapshot ? Object.assign({ jobId: a.jobId, location: '', source: '', tracks: [] }, a.snapshot) : null); if (!j) return ""; const c = jobById(a.jobId) ? C(j) : { el: { label: 'YELLOW' }, m: { total: '-' }, cov: null }; const v = S.cvVersions.find((x) => x.id === a.cvVersionId); const pk = S.packages.find((x) => x.id === a.packageId);
      return `<tr><td><a href="#/job/${j.jobId}"><b>${esc(j.title)}</b></a><div class="tiny muted">${esc(j.employer)} · ${esc(j.location)}</div><div class="tiny"><a href="${esc(j.applyUrl || j.source)}" target="_blank">Advert ↗</a></div></td>
      <td>${elPill(c.el.label)}</td><td class="num">${c.m.total}</td><td class="num">${v ? v.coverageAfter : c.cov ? c.cov.keywordCoverage : "-"}%</td>
      <td><select data-chg="appSet" data-id="${a.id}" data-k="status">${STATUSES.map((s) => `<option ${s === a.status ? "selected" : ""}>${s}</option>`).join("")}</select></td>
      <td><select data-chg="appSet" data-id="${a.id}" data-k="channel"><option value="">Not recorded</option>${CHANNELS.map((c) => `<option ${a.channel === c ? "selected" : ""}>${c}</option>`).join("")}</select></td>
      <td><input type="date" value="${esc(a.appliedDate)}" data-chg="appSet" data-id="${a.id}" data-k="appliedDate" style="width:132px"></td>
      <td><input type="date" value="${esc(a.deadline)}" data-chg="appSet" data-id="${a.id}" data-k="deadline" style="width:132px"></td>
      <td><input type="date" value="${esc(a.followUp)}" data-chg="appSet" data-id="${a.id}" data-k="followUp" style="width:132px">${a.followUp && a.followUp < now ? '<div class="tiny bad">Overdue</div>' : ""}</td>
      <td><input type="text" value="${esc(a.contact)}" data-chg="appSet" data-id="${a.id}" data-k="contact" placeholder="Name / email" style="width:130px"></td>
      <td class="small">${v ? `<a href="#" data-act="dlVersion" data-v="${v.id}">${esc(v.name.slice(0, 28))}…</a>` : '<span class="muted">No tailored CV</span>'}<br>${pk ? `<a href="#/builder/${j.jobId}">Package</a>` : '<span class="muted">No package</span>'}</td>
      <td><input type="text" value="${esc(a.notes)}" data-chg="appSet" data-id="${a.id}" data-k="notes" style="width:150px"></td>
      <td><button class="btn sm ghost" data-act="appDel" data-id="${a.id}" title="Remove from tracker">✕</button></td></tr>`; }).join("")}</tbody></table></div>`
    : `<div class="empty">No applications tracked yet. Save jobs from <a href="#/discover">Discover</a>.</div>`;
  const byStatus = STATUSES.map((s) => [s, S.applications.filter((a) => a.status === s).length]).filter((x) => x[1]);
  return {
    title: "Application Tracker", sub: S.applications.length + " tracked · statuses change only when you change them",
    actions: `<button class="btn ${TR.view === "table" ? "primary" : ""}" data-act="trView" data-v="table">Table</button><button class="btn ${TR.view === "calendar" ? "primary" : ""}" data-act="trView" data-v="calendar">Deadlines calendar</button><button class="btn" data-act="exportTracker">Export CSV</button>`,
    html: `<div class="grid g3 mb"><div class="card"><h2>Upcoming deadlines</h2>${upcoming.slice(0, 6).map((x) => `<div class="small"><b>${fmtDate(x.a.deadline)}</b> (${daysUntil(x.a.deadline)} d) · <a href="#/job/${x.j.jobId}">${esc(x.j.title)}</a></div>`).join("") || '<p class="small muted">None</p>'}</div>
      <div class="card"><h2>Overdue follow-ups</h2>${overdue.map((a) => { const j = jobById(a.jobId); return `<div class="small bad"><b>${fmtDate(a.followUp)}</b> · ${esc(j ? j.title : "")}</div>`; }).join("") || '<p class="small muted">None</p>'}</div>
      <div class="card"><h2>By status</h2><div class="row">${byStatus.map(([s, n]) => `<button class="btn sm ${TR.status === s ? "primary" : ""}" data-act="trStatus" data-s="${s}">${esc(s)} ${n}</button>`).join("") || '<span class="small muted">Empty</span>'}${TR.status ? '<button class="btn sm ghost" data-act="trStatus" data-s="">All</button>' : ""}</div></div></div>${body}`,
  };
});
ACT.trView = (d) => { TR.view = d.v; rerender(); };
ACT.trStatus = (d) => { TR.status = d.s; rerender(); };
ACT.appSet = async (d, t) => {
  const a = S.applications.find((x) => x.id === d.id);
  if (d.k === "status" && t.value === "Applied" && !await ask("Mark as Applied only if you have actually submitted the application. Continue?")) { t.value = a.status; return; }
  a[d.k] = t.value;
  if (d.k === "status") { a.history.push({ date: TODAY(), status: t.value }); if (t.value === "Applied" && !a.appliedDate) a.appliedDate = TODAY(); logActivity("Status → " + t.value + ": " + (jobById(a.jobId) || {}).title); }
  save(); if (d.k === "status" || d.k === "followUp") rerender();
};
ACT.appDel = async (d) => { if (!await ask("Remove this job from the tracker? The job stays in the database.")) return; S.applications = S.applications.filter((a) => a.id !== d.id); save(); rerender(); };
ACT.exportTracker = () => {
  const rows = [["Job ID", "Company", "Position", "Location", "Advert", "Eligibility", "Match", "Keyword coverage", "CV version", "Package", "Status", "Applied", "Deadline", "Follow-up", "Contact", "Notes"]];
  S.applications.forEach((a) => { const j = jobById(a.jobId); if (!j) return; const c = C(j); const v = S.cvVersions.find((x) => x.id === a.cvVersionId); rows.push([j.jobId, j.employer, j.title, j.location, j.applyUrl || j.source, c.el.label, c.m.total, v ? v.coverageAfter : c.cov ? c.cov.keywordCoverage : "", v ? v.name : "", a.packageId ? "Yes" : "No", a.status, a.appliedDate, a.deadline, a.followUp, a.contact, a.notes]); });
  download("CareerOS_Tracker_" + TODAY() + ".csv", "﻿" + rows.map((r) => r.map((x) => '"' + String(x == null ? "" : x).replace(/"/g, '""') + '"').join(",")).join("\n"), "text/csv");
};
function calendar() {
  const base = TR.month ? new Date(TR.month + "-01T00:00:00") : new Date(TODAY().slice(0, 7) + "-01T00:00:00");
  const y = base.getFullYear(), m = base.getMonth();
  const first = new Date(y, m, 1), start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
  const evs = {};
  const add = (d, o) => { if (d) (evs[d] = evs[d] || []).push(o); };
  S.applications.forEach((a) => { const j = jobById(a.jobId); if (!j) return; add(a.deadline, { cls: "dl", t: "Deadline: " + j.title, id: j.jobId }); add(a.followUp, { cls: "fu", t: "Follow up: " + j.title, id: j.jobId }); add(a.appliedDate, { cls: "", t: "Applied: " + j.title, id: j.jobId }); });
  S.jobs.forEach((j) => { if (j.deadline && !appFor(j.jobId)) add(j.deadline, { cls: "dl", t: "Deadline (not tracked): " + j.title, id: j.jobId }); });
  const ym = (dt) => dt.toISOString().slice(0, 7);
  const prev = new Date(y, m - 1, 15), next = new Date(y, m + 1, 15);
  let cells = "";
  for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    cells += `<div class="d ${d.getMonth() !== m ? "out" : ""} ${k === TODAY() ? "today" : ""}"><b>${d.getDate()}</b>${(evs[k] || []).map((e) => `<a class="ev ${e.cls}" href="#/job/${e.id}" title="${esc(e.t)}">${esc(e.t)}</a>`).join("")}</div>`; }
  return `<div class="card"><div class="row between mb"><button class="btn sm" data-act="calNav" data-m="${ym(prev)}">← Prev</button><h2 style="margin:0">${first.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h2><button class="btn sm" data-act="calNav" data-m="${ym(next)}">Next →</button></div>
    <div class="cal">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((x) => `<div class="dh">${x}</div>`).join("")}${cells}</div>
    <p class="tiny muted mt"><span class="ev dl" style="display:inline">Deadline</span> <span class="ev fu" style="display:inline">Follow-up</span> <span class="ev" style="display:inline">Applied</span></p></div>`;
}
ACT.calNav = (d) => { TR.month = d.m; rerender(); };
