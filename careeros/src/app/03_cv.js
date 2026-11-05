/* Master CV management, PDF/DOCX import, ATS readability, CV optimizer. */
let pdfWorkerUrl = null;
async function pdfText(bytes) {
  if (!window.pdfjsLib) throw new Error("PDF engine not loaded");
  if (!pdfWorkerUrl) { pdfWorkerUrl = URL.createObjectURL(new Blob([document.getElementById("pdfworker").textContent], { type: "text/javascript" })); pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl; }
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
  const lines = []; let orderOk = true;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const rows = new Map();
    let prevY = null, streamSwaps = 0;
    for (const it of tc.items) {
      if (!it.str) continue;
      const y = Math.round(it.transform[5]);
      if (prevY != null && y > prevY + 2) streamSwaps++;
      prevY = y;
      const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push({ x: it.transform[4], s: it.str });
    }
    if (streamSwaps > 3) orderOk = false;
    [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, items]) => lines.push(items.sort((a, b) => a.x - b.x).map((i) => i.s).join(" ").replace(/\s+/g, " ").trim()));
  }
  return { text: lines.filter(Boolean).join("\n"), pages: doc.numPages, orderOk };
}

// ---------------------------------------------------------------- Master CV
route("cv", async () => {
  const M = S.master, mod = M.model;
  if (M.pdfB64 && !M.pdfText) { try { const r = await pdfText(b64ToBytes(M.pdfB64)); M.pdfText = r.text; M.pdfPages = r.pages; M.pdfOrderOk = r.orderOk; save(); } catch (e) { console.warn(e); } }
  const atsD = mod ? E.atsAssessDocx(mod) : null;
  const atsP = M.pdfText ? E.atsAssessPdfText(M.pdfText, { orderOk: M.pdfOrderOk }) : null;
  const atsTable = (r) => `<table><tbody>${r.checks.map((c) => `<tr><td style="width:24px">${c.result === "pass" ? '<b class="ok">✓</b>' : c.result === "warn" ? '<b class="warnc">!</b>' : '<b class="bad">✗</b>'}</td><td><b class="small">${esc(c.name)}</b><div class="tiny muted">${esc(c.detail)}</div></td></tr>`).join("")}</tbody></table><p class="tiny muted">${esc(r.note)}</p>`;
  return {
    title: "CV Studio", sub: "Master CV, career-track versions, ATS checks and exports",
    actions: `<label class="btn primary">Upload CV (DOCX or PDF)<input type="file" accept=".docx,.pdf" class="hide" data-chg="uploadCV"></label>`,
    html: `${!M.approved && M.source && /reconstruct/i.test(M.source) ? `<div class="flag high"><b>Your master DOCX was reconstructed by CareerOS.</b> Only PDF versions of your CV were found (workspace and Google Drive). To make tailoring possible, CareerOS rebuilt the 17 Oct 2026 PDF as an editable DOCX with the same page size, margins, fonts, sizes, rules, bullets and right-aligned dates. Text is copied verbatim. Compare it with your PDF below, then either approve it or upload your original DOCX.<div class="row mt"><button class="btn primary" data-act="approveMaster">Approve reconstructed DOCX as master</button><label class="btn">Upload my original DOCX<input type="file" accept=".docx" class="hide" data-chg="uploadCV"></label></div></div>` : ""}
    <div class="grid g3 mt">
      <div class="card"><h2>Current master</h2><table><tbody>
        <tr><th style="position:static">Editable master</th><td class="small">${esc(M.name || "None")}<div class="tiny muted">${esc(M.source || "")}</div></td></tr>
        <tr><th style="position:static">PDF reference</th><td class="small">${esc(M.pdfName || "None")}${M.pdfPages ? " · " + M.pdfPages + " page(s)" : ""}</td></tr>
        <tr><th style="position:static">Status</th><td class="small">${M.approved ? '<b class="ok">Approved by you</b>' : '<b class="warnc">Awaiting your approval</b>'}</td></tr>
        <tr><th style="position:static">Loaded</th><td class="small">${fmtDate(M.uploadedAt)}</td></tr></tbody></table>
        <div class="row mt">${M.docxB64 ? `<button class="btn sm" data-act="dlMaster" data-k="docx">Download master DOCX</button><button class="btn sm" data-act="masterPdf">Export master PDF</button>` : ""}${M.pdfB64 ? `<button class="btn sm" data-act="dlMaster" data-k="pdf">Download PDF</button>` : ""}</div></div>
      <div class="card"><h2>Format lock</h2>
        <label class="row" style="cursor:pointer"><input type="checkbox" ${S.settings.formatLock ? "checked" : ""} data-chg="formatLock"> <b>LOCK ORIGINAL CV FORMAT: ${S.settings.formatLock ? "ON" : "OFF"}</b></label>
        <p class="small">When ON, tailoring only rewrites words inside existing paragraphs and runs. Page size, margins, fonts, sizes, colours, headings, section order, bullets, spacing, indentation, tabs and hyperlinks are untouched. Removing a paragraph is only offered as a suggestion that you must accept.</p>
        <p class="small">Every job gets a new copy. The master is never overwritten; each export is checked against it.</p></div>
      <div class="card"><h2>Visual format integrity</h2>${mod ? `<table><tbody>
        <tr><td class="small">Page</td><td class="small">${mod.meta.pageWidthPt} × ${mod.meta.pageHeightPt} pt ${Math.abs(mod.meta.pageWidthPt - 595.3) < 2 ? "(A4)" : ""}</td></tr>
        <tr><td class="small">Margins</td><td class="small">${mod.meta.margins ? `T ${mod.meta.margins.top} · R ${mod.meta.margins.right} · B ${mod.meta.margins.bottom} · L ${mod.meta.margins.left} pt` : "-"}</td></tr>
        <tr><td class="small">Fonts</td><td class="small">${esc(mod.meta.fonts.join(", "))}</td></tr>
        <tr><td class="small">Paragraphs</td><td class="small">${mod.meta.paragraphCount} · sections: ${esc([...new Set(mod.paragraphs.filter((p) => p.isHeading).map((p) => p.text))].join(", "))}</td></tr>
        <tr><td class="small">Tables / text boxes / images</td><td class="small">${mod.meta.tables} / ${mod.meta.textboxes} / ${mod.meta.images}</td></tr>
        <tr><td class="small">Hyperlinks</td><td class="small">${mod.meta.hyperlinks}</td></tr></tbody></table>
        <p class="tiny muted">Visual integrity is about how the document looks. ATS readability (below) is about how software reads it. They are measured separately.</p>` : `<p class="muted">No DOCX master loaded.</p>`}</div>
    </div>
    <div class="grid g2 mt">
      <div class="card"><h2>ATS readability: master DOCX</h2>${atsD ? atsTable(atsD) : '<p class="muted">Upload a DOCX.</p>'}</div>
      <div class="card"><h2>ATS risk check: Greenhouse guidance</h2>${mod ? (() => { const g = E.atsGreenhouse(mod, M.docxB64 ? Math.round(M.docxB64.length * 0.75) : null); return atsTable(g) + `<p class="tiny"><a href="${g.source}" target="_blank" rel="noopener">Greenhouse: Unsuccessful resume parse</a></p>`; })() : ""}</div>
      <div class="card"><h2>ATS readability: PDF version (actual text extraction)</h2>${atsP ? atsTable(atsP) : '<p class="muted">No PDF loaded.</p>'}
        ${M.pdfText ? `<details><summary>Show text exactly as extracted from the PDF</summary><pre class="doc">${esc(M.pdfText)}</pre></details>` : ""}</div>
    </div>
    <div class="card mt"><div class="row between"><h2>Master CV content (read-only preview)</h2><span class="tiny muted">Preview approximates layout. The DOCX file is the source of truth.</span></div>${mod ? cvPreview(mod.paragraphs) : '<p class="muted">No DOCX master.</p>'}</div>
    <div class="card mt"><h2>Career-track CV versions</h2><p class="small">Five ready-to-tailor versions built from your master CV and your verified evidence. Each one is tuned to what the active adverts in that track ask for, and each change still needs your approval.</p>
      <div class="tablewrap" style="max-height:none"><table><thead><tr><th>Version</th><th class="num">Adverts used</th><th>Status</th><th></th></tr></thead><tbody>${trackTargetsList().map((t) => { const vs = S.cvVersions.filter((v) => v.jobId === t.jobId); const last = vs[vs.length - 1]; return `<tr><td><b class="small">${esc(t.title)}</b></td><td class="num">${t.basedOn}</td><td class="small">${last ? esc(last.name) + " · coverage " + last.coverageBefore + "% → " + last.coverageAfter + "%" : S.optim[t.jobId] ? "Suggestions under review" : "Not built yet"}</td><td><div class="row" style="gap:4px"><a class="btn sm primary" href="#/optimize/${t.jobId}">${last ? "Revise" : "Build"}</a>${last ? `<button class="btn sm" data-act="dlVersion" data-v="${last.id}">DOCX</button><button class="btn sm" data-act="pdfVersion" data-v="${last.id}">PDF</button><button class="btn sm" data-act="viewChanges" data-v="${last.id}">Changes</button>` : ""}</div></td></tr>`; }).join("")}</tbody></table></div></div>
    <div class="card mt"><h2>All tailored versions (${S.cvVersions.length})</h2>${versionsTable(S.cvVersions)}</div>
    <div class="card mt"><h2>Optional: simplified ATS version</h2><p class="small">Some portals parse plain single-column documents more reliably. This creates a separate, plain DOCX (Calibri 11, no tabs or rules) from the master text. It never replaces your locked original-format CV.</p><button class="btn" data-act="simpleDocx">Download simplified ATS DOCX</button></div>`,
  };
});
function cvPreview(paras, changed) {
  changed = changed || new Set();
  return `<div class="cvdoc">${paras.map((p) => {
    const t = p.text;
    if (!t.trim()) return "";
    const cls = (p.isHeading ? "h" : "") + (changed.has(p.i) ? " chg" : "");
    if (t.includes("\t") && !/^•\t/.test(t)) { const [a, ...b] = t.split("\t"); return `<p class="tabr ${cls}"><span>${esc(a)}</span><span>${esc(b.join(" "))}</span></p>`; }
    const center = p.section === "Header";
    return `<p class="${cls}" style="${center ? "text-align:center;" : ""}${p.i === 0 ? "font-size:18px;font-weight:700;" : ""}${/^•\t/.test(t) ? "padding-left:12px;text-indent:-9px;" : ""}${p.bold && !p.isHeading ? "font-weight:600;" : ""}">${esc(t.replace(/^•\t/, "• "))}</p>`;
  }).join("")}</div>`;
}
ACT.approveMaster = () => { S.master.approved = true; logActivity("Approved the master CV"); save(); rerender(); toast("Master CV approved"); };
ACT.formatLock = (d, t) => { S.settings.formatLock = t.checked; save(); rerender(); };
ACT.dlMaster = (d) => {
  if (d.k === "docx") download(S.master.name || "Master_CV.docx", b64ToBytes(S.master.docxB64), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  else download(S.master.pdfName || "Master_CV.pdf", b64ToBytes(S.master.pdfB64), "application/pdf");
};
ACT.uploadCV = async (d, t) => {
  const f = t.files[0]; if (!f) return;
  const bytes = new Uint8Array(await f.arrayBuffer());
  if (/\.docx$/i.test(f.name)) {
    let model;
    try { model = await E.readDocx(JSZip, bytes, DOMParser); } catch (e) { return toast("That DOCX could not be read: " + e.message, 6000); }
    if (S.master.docxB64 && !await ask("Replace the current master DOCX with " + f.name + "? Existing tailored versions keep their own copies.")) return;
    Object.assign(S.master, { kind: "docx", name: f.name, source: "Uploaded by you", docxB64: bytesToB64(bytes), uploadedAt: TODAY(), model, approved: true });
    model.freeLines = 0;
    S.optim = {}; invalidate();
    logActivity("Uploaded master CV " + f.name); save(); toast("Master DOCX loaded: " + model.paragraphs.length + " paragraphs"); rerender();
  } else if (/\.pdf$/i.test(f.name)) {
    const r = await pdfText(bytes);
    Object.assign(S.master, { pdfB64: bytesToB64(bytes), pdfName: f.name, pdfText: r.text, pdfPages: r.pages, pdfOrderOk: r.orderOk });
    logActivity("Uploaded PDF CV " + f.name); save();
    modal(`<h2>PDF loaded</h2><p class="small">${r.pages} page(s), ${r.text.length} characters of text extracted${r.text.length < 300 ? ", which suggests a scanned or image-based PDF" : ""}.</p>
      <p class="small">A PDF can be analysed (keywords, ATS readability), but CareerOS cannot edit a PDF in place and guarantee the layout stays identical. For format-preserving tailoring, upload the original DOCX of this CV. ${S.master.docxB64 ? "Your current DOCX master stays in use." : "Until then, the optimizer will list suggested wording changes for you to apply yourself."}</p><button class="btn primary" data-act="closeModal">OK</button>`);
    rerender();
  }
};
ACT.simpleDocx = async () => {
  const paras = S.master.model.paragraphs.map((p) => ({ text: p.text.replace(/^•\t/, "- ").replace(/\t/g, "  |  "), bold: p.isHeading || p.i === 0 }));
  download("Master_CV_ATS_simplified.docx", await makeDocx(paras, { font: "Calibri", size: 11 }));
};
/** Minimal clean DOCX writer (used for the simplified CV, cover letters and documents). */
async function makeDocx(paras, opt) {
  opt = opt || {};
  const font = opt.font || "Calibri", sz = (opt.size || 11) * 2;
  const x = (s) => esc(s).replace(/&#39;/g, "'");
  const body = paras.map((p) => {
    const text = typeof p === "string" ? p : p.text;
    const b = typeof p === "object" && p.bold ? "<w:b/>" : "";
    const big = typeof p === "object" && p.size ? `<w:sz w:val="${p.size * 2}"/>` : "";
    return `<w:p><w:pPr><w:spacing w:after="${opt.after != null ? opt.after : 80}"/></w:pPr><w:r><w:rPr>${b}${big}</w:rPr><w:t xml:space="preserve">${x(text)}</w:t></w:r></w:p>`;
  }).join("");
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="${sz}"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

// ---------------------------------------------------------------- CV Optimizer
function wordDiff(a, b) {
  const A = a.split(/(\s+)/), B = b.split(/(\s+)/);
  const n = A.length, m = B.length;
  if (n * m > 40000) return `<del>${esc(a)}</del> <ins>${esc(b)}</ins>`;
  const L = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  let i = 0, j = 0, out = "";
  while (i < n && j < m) {
    if (A[i] === B[j]) { out += esc(A[i]); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { out += `<del>${esc(A[i])}</del>`; i++; }
    else { out += `<ins>${esc(B[j])}</ins>`; j++; }
  }
  while (i < n) out += `<del>${esc(A[i++])}</del>`;
  while (j < m) out += `<ins>${esc(B[j++])}</ins>`;
  return out;
}
function optimState(jobId) { return S.optim[jobId]; }
function acceptedChanges(o) { return o.suggestions.filter((s) => ["accepted", "edited"].includes((o.decisions[s.id] || {}).status)).map((s) => ({ ...s, proposed: (o.decisions[s.id] || {}).text || s.proposed })); }
route("optimize", (id) => {
  if (!id) {
    const list = S.jobs.filter((j) => !isExpired(j) && ["GREEN", "YELLOW", "ORANGE"].includes(C(j).el.label)).sort((a, b) => C(b).m.total - C(a).m.total).slice(0, 40);
    return { title: "CV Optimizer", sub: "Choose a job to tailor your CV for",
      html: `<div class="grid g2"><div class="card"><h2>Pick a job</h2><table><tbody>${list.map((j) => `<tr><td><a href="#/optimize/${j.jobId}">${esc(j.title)}</a><div class="tiny muted">${esc(j.employer)}</div></td><td>${elPill(C(j).el.label)}</td><td class="num">${C(j).m.total}</td><td class="num">${C(j).cov ? C(j).cov.keywordCoverage + "%" : ""}</td></tr>`).join("")}</tbody></table></div>
        <div class="card"><h2>Tailored CV versions</h2>${versionsTable(S.cvVersions)}</div></div>` };
  }
  const j = jobById(id);
  if (!j) return { title: "Job not found", html: "" };
  const M = S.master;
  if (!M.model) return { title: "CV Optimizer", html: `<div class="flag high">No DOCX master CV is loaded. <a href="#/cv">Upload your DOCX</a>. With only a PDF, CareerOS can analyse but not edit with format preservation.</div>` };
  const c = C(j);
  const o = optimState(id);
  let html = j.isTrack ? `<div class="note mb">Career-track version: built from ${j.basedOn} active adverts in this track. It is a reusable starting point; tailor again for each job you apply to.</div><div class="row mb"><span class="pill">Master: ${esc(M.name)}</span><span class="pill">Format lock: ${S.settings.formatLock ? "ON" : "OFF"}</span></div>` : `<div class="row mb">${elPill(c.el.label, c.el.summary)}<span class="pill">Match ${c.m.total}/100</span><span class="pill">Master: ${esc(M.name)}</span><span class="pill">Format lock: ${S.settings.formatLock ? "ON" : "OFF"}</span>${!M.approved ? `<span class="pill" style="border-color:#f3dc9a">Master not yet approved</span>` : ""}</div>`;
  if (!j.isTrack && c.el.label === "RED") html += `<div class="flag high">Eligibility is RED for this job: ${esc((c.el.reasons.find((r) => r.level === "RED") || {}).msg || "")} You can still tailor a CV, but a mandatory requirement appears to exclude you.</div>`;
  if (!o) {
    html += `<div class="card"><h2>Current CV against this job</h2><div class="grid g3"><div class="tile"><div class="l">Keyword coverage</div><div class="v">${c.cov.keywordCoverage}%</div></div><div class="tile"><div class="l">Evidence coverage</div><div class="v">${c.cov.evidenceCoverage}%</div></div><div class="tile"><div class="l">Keywords to surface truthfully</div><div class="v">${c.cov.counts.supported + c.cov.counts.equivalent}</div></div></div>
      <p class="small mt">The optimizer reads the advert, your career profile and the master CV, then proposes changes. It only uses wording backed by evidence marked Verified or Confirmed. Nothing is applied until you accept it.</p>
      <button class="btn primary big" data-act="optimize" data-id="${id}">OPTIMIZE MY CV FOR THIS JOB</button></div>`;
    return { title: "CV Optimizer", sub: j.title + " · " + j.employer, html };
  }
  const acc = acceptedChanges(o);
  const newText = E.applySuggestionsToText(M.model, acc);
  const after = E.cvCoverage(c.a, newText, S.profile, { evidenceIndex: evidenceIndex() });
  const of = E.overflowEstimate(M.model, acc);
  const nPending = o.suggestions.filter((s) => !o.decisions[s.id]).length;
  html += `<div class="grid g4 mb">
    <div class="tile"><div class="l">Keyword coverage: before</div><div class="v">${c.cov.keywordCoverage}%</div></div>
    <div class="tile"><div class="l">Keyword coverage: with accepted changes</div><div class="v">${after.keywordCoverage}%</div><div class="d">${after.counts.exact + after.counts.equivalent} of ${after.total}</div></div>
    <div class="tile"><div class="l">Accepted / pending</div><div class="v">${acc.length} / ${nPending}</div><div class="d">${o.suggestions.length} suggestions</div></div>
    <div class="tile"><div class="l">Page overflow risk</div><div class="v ${of.risk === "high" ? "bad" : of.risk === "low" ? "warnc" : "ok"}" style="font-size:20px">${of.risk === "none" ? "None" : of.risk === "low" ? "Low" : "High"}</div><div class="d">Estimated ${of.delta >= 0 ? "+" : ""}${of.delta} line(s); about ${of.free} free</div></div></div>
  ${of.risk === "high" ? `<div class="flag high mb"><b>This set of changes will probably push the CV onto a second page</b> (estimated +${of.delta} line(s), about ${of.free} free). Reject some longer changes, or accept the suggested removal of a low-relevance block to make room. Check the page count after export.</div>` : ""}
  <div class="card"><div class="row between"><h2>Suggested changes</h2><div class="row"><button class="btn sm" data-act="acceptAll" data-id="${id}">Accept all non-removal</button><button class="btn sm" data-act="resetOpt" data-id="${id}">Restore original (reset all)</button><button class="btn sm" data-act="optimize" data-id="${id}">Regenerate</button></div></div>
  <p class="tiny muted">Green = added words, red = removed words. Accept, reject or edit each change. Edited text is checked for unsupported keywords.</p>
  <div class="tablewrap" style="max-height:none"><table class="cmp"><thead><tr><th style="width:12%">Type / section</th><th style="width:29%">Original CV</th><th style="width:29%">Suggested CV</th><th style="width:18%">Reason</th><th style="width:12%">Decision</th></tr></thead><tbody>
  ${o.suggestions.map((s) => { const dcs = o.decisions[s.id] || {}; const prop = dcs.text || s.proposed; return `<tr class="${dcs.status === "rejected" ? "chg-rejected" : dcs.status ? "chg-accepted" : ""}"><td class="small"><b>${esc(s.type)}</b><div class="tiny muted">${esc(s.section)}</div>${s.lineDelta > 0 ? `<div class="tiny warnc">+${s.lineDelta} line</div>` : ""}</td>
    <td class="orig">${esc(s.original.replace(/^•\t/, "• "))}</td><td>${s.op === "remove" ? "<del>(remove this paragraph)</del>" : wordDiff(s.original.replace(/^•\t/, "• "), prop.replace(/^•\t/, "• "))}${dcs.status === "edited" ? '<div class="tiny warnc">Edited by you</div>' : ""}</td>
    <td class="small">${esc(s.reason)}<div class="tiny muted">${esc(s.evidence)}</div></td>
    <td>${dcs.status ? `<div class="small"><b>${esc(dcs.status)}</b></div><button class="btn sm" data-act="decide" data-id="${id}" data-s="${s.id}" data-v="">Undo</button>` : `<div class="row" style="gap:4px"><button class="btn sm primary" data-act="decide" data-id="${id}" data-s="${s.id}" data-v="accepted">Accept</button><button class="btn sm" data-act="decide" data-id="${id}" data-s="${s.id}" data-v="rejected">Reject</button>${s.op === "remove" ? "" : `<button class="btn sm" data-act="editSug" data-id="${id}" data-s="${s.id}">Edit</button>`}</div>`}</td></tr>`; }).join("") || `<tr><td colspan="5" class="muted">No changes suggested: the CV already reflects what this advert asks for, as far as your evidence allows.</td></tr>`}
  </tbody></table></div></div>
  <div class="grid g2 mt"><div class="card"><h2>Keywords after accepted changes</h2>${after.rows.map((r) => `<span class="kw ${r.status}" title="${esc(r.note)}">${esc(r.jdForms[0])}</span>`).join("")}<p class="tiny muted mt">Unconfirmed and missing keywords stay out of the CV. To use one, add evidence in <a href="#/profile">My Career Profile</a> first.</p></div>
  <div class="card"><h2>Create the tailored copy</h2><p class="small">Applies the ${acc.length} accepted change(s) to a <b>new copy</b> of the master DOCX, keeps every run's formatting, then re-opens the result and checks it against the master.</p>
    <button class="btn primary big" data-act="makeVersion" data-id="${id}" ${acc.length ? "" : "disabled"}>Create tailored CV (DOCX)</button>
    <h3>Versions for this job</h3>${versionsTable(S.cvVersions.filter((v) => v.jobId === id))}</div></div>
  <div class="card mt"><h2>Preview with accepted changes</h2>${cvPreview(previewParas(M.model, acc), new Set(acc.map((a) => a.paragraph)))}</div>`;
  return { title: "CV Optimizer", sub: j.title + " · " + j.employer, actions: `<a class="btn" href="#/job/${id}">Job analysis</a><a class="btn primary" href="#/builder/${id}">Application Builder →</a>`, html };
});
function previewParas(model, acc) {
  const map = new Map(acc.map((a) => [a.paragraph, a]));
  return model.paragraphs.filter((p) => !(map.get(p.i) && map.get(p.i).op === "remove")).map((p) => (map.has(p.i) ? { ...p, text: map.get(p.i).proposed } : p));
}
function versionsTable(vs) {
  if (!vs.length) return `<p class="small muted">None yet.</p>`;
  return `<table><tbody>${vs.slice().reverse().map((v) => { const j = jobById(v.jobId); return `<tr><td class="small"><b>${esc(v.name)}</b><div class="tiny muted">${j ? esc(j.title + " · " + j.employer) : ""} · ${fmtDate(v.created)} · ${v.changes.length} change(s) · coverage ${v.coverageBefore}% → ${v.coverageAfter}%</div><div class="tiny ${v.integrity.ok ? "ok" : "bad"}">${esc(v.integrity.summary)}</div></td>
    <td><div class="row" style="gap:4px"><button class="btn sm" data-act="dlVersion" data-v="${v.id}">DOCX</button><button class="btn sm" data-act="pdfVersion" data-v="${v.id}">PDF</button><button class="btn sm" data-act="viewChanges" data-v="${v.id}">Changes</button></div></td></tr>`; }).join("")}</tbody></table>`;
}
ACT.optimize = (d) => {
  const j = jobById(d.id), c = C(j);
  const r = E.optimizeSuggestions(j, c.a, S.master.model, S.profile, { evidenceIndex: evidenceIndex() });
  S.optim[d.id] = { created: TODAY(), suggestions: r.suggestions, decisions: {} };
  logActivity("CV optimisation started for " + j.title + " (" + r.suggestions.length + " suggestions)");
  save(); rerender();
};
ACT.decide = (d) => { const o = S.optim[d.id]; if (d.v) o.decisions[d.s] = { status: d.v }; else delete o.decisions[d.s]; save(); rerender(); };
ACT.acceptAll = (d) => { const o = S.optim[d.id]; o.suggestions.forEach((s) => { if (!o.decisions[s.id] && s.op !== "remove" && s.type !== "Integrity") o.decisions[s.id] = { status: "accepted" }; }); save(); rerender(); toast("Accepted all wording changes. Integrity and removal suggestions still need individual decisions."); };
ACT.resetOpt = (d) => { S.optim[d.id].decisions = {}; save(); rerender(); };
ACT.editSug = (d) => {
  const o = S.optim[d.id], s = o.suggestions.find((x) => x.id === d.s);
  modal(`<h2>Edit suggested text</h2><p class="small muted">Original: ${esc(s.original.replace(/^•\t/, "• "))}</p><textarea id="sugText" style="min-height:110px">${esc(((o.decisions[s.id] || {}).text || s.proposed).replace(/^•\t/, ""))}</textarea>
    <div id="sugWarn" class="small mt"></div><div class="row mt"><button class="btn primary" data-act="saveSug" data-id="${d.id}" data-s="${s.id}">Save as edited</button><button class="btn" data-act="closeModal">Cancel</button></div>`);
};
ACT.saveSug = (d) => {
  const o = S.optim[d.id], s = o.suggestions.find((x) => x.id === d.s);
  let txt = document.getElementById("sugText").value.trim();
  if (/^•\t/.test(s.original)) txt = "•\t" + txt;
  const idx = evidenceIndex();
  const unsupported = E.findKeywords(txt).filter((k) => !E.findKeywords(s.original).some((x) => x.id === k.id) && !(idx[k.id] && idx[k.id].trusted.length));
  if (unsupported.length && !document.getElementById("sugWarn").dataset.shown) {
    document.getElementById("sugWarn").dataset.shown = "1";
    document.getElementById("sugWarn").innerHTML = `<div class="flag high">Your edit adds ${unsupported.map((k) => "<b>" + esc(k.term) + "</b>").join(", ")}, which your profile does not support with verified or confirmed evidence. Add the evidence to your profile first, or remove the term. Click Save again to keep it anyway.</div>`;
    return;
  }
  o.decisions[s.id] = { status: "edited", text: txt };
  save(); closeModal(); rerender();
};
ACT.makeVersion = async (d) => {
  const j = jobById(d.id), o = S.optim[d.id], acc = acceptedChanges(o);
  const ofc = E.overflowEstimate(S.master.model, acc);
  if (ofc.risk === "high" && !await ask("Estimated to exceed one page (+" + ofc.delta + " lines, about " + ofc.free + " free). Create the copy anyway? You can check the page count after export.")) return;
  if (!S.settings.formatLock && !await ask("Format lock is OFF. The tailored copy is still produced by editing text only. Continue?")) return;
  const masterBytes = b64ToBytes(S.master.docxB64);
  const masterHashBefore = await sha(masterBytes);
  const r = await E.applyChangesToDocx(JSZip, masterBytes, acc, DOMParser, XMLSerializer);
  const failed = r.log.filter((x) => !x.ok);
  // integrity: reopen and compare
  const re = await E.readDocx(JSZip, r.bytes, DOMParser);
  const expected = previewParas(S.master.model, acc.filter((a) => !failed.find((f) => f.id === a.id)));
  const mism = expected.filter((p, i) => !re.paragraphs[i] || re.paragraphs[i].text !== p.text).length + Math.abs(expected.length - re.paragraphs.length);
  const masterHashAfter = await sha(b64ToBytes(S.master.docxB64));
  const metaSame = JSON.stringify(re.meta.margins) === JSON.stringify(S.master.model.meta.margins) && re.meta.fonts.join() === S.master.model.meta.fonts.join() && re.meta.pageWidthPt === S.master.model.meta.pageWidthPt;
  const ok = !failed.length && !mism && masterHashBefore === masterHashAfter && metaSame;
  const cov = E.cvCoverage(C(j).a, re.text, S.profile, { evidenceIndex: evidenceIndex() });
  const n = S.cvVersions.filter((v) => v.jobId === d.id).length + 1;
  const safe = (s) => s.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  const v = { id: uid("CV"), jobId: d.id, isTrack: !!j.isTrack, name: j.isTrack ? "Saleh_Alsubaie_CV_TRACK_" + safe(j.title.replace(/ CV$/, "")) + "_v" + n + ".docx" : "Saleh_Alsubaie_CV_" + safe(j.employer) + "_" + safe(E.cleanTitle(j.title)) + "_v" + n + ".docx", created: TODAY(), changes: acc.map((a) => ({ id: a.id, type: a.type, section: a.section, paragraph: a.paragraph, original: a.original, proposed: a.proposed, op: a.op || "edit", reason: a.reason, evidence: a.evidence, coverageImpact: a.coverageImpact })), bytesB64: bytesToB64(r.bytes), coverageBefore: C(j).cov.keywordCoverage, coverageAfter: cov.keywordCoverage, overflow: E.overflowEstimate(S.master.model, acc),
    integrity: { ok, failed, mismatches: mism, masterUnchanged: masterHashBefore === masterHashAfter, layoutSame: metaSame, summary: ok ? "Integrity check passed: reopened, " + re.paragraphs.length + " paragraphs match, page setup and fonts identical, master unchanged." : "Integrity check found issues: " + (failed.length ? failed.length + " change(s) could not be applied (" + failed.map((f) => f.error).join("; ") + "). " : "") + (mism ? mism + " paragraph mismatch(es). " : "") + (!metaSame ? "Page setup differs. " : "") } };
  S.cvVersions.push(v);
  if (j.isTrack) { logActivity("Career-track CV created: " + v.name); save(); rerender(); toast(ok ? "Track CV created and verified" : "Created with warnings", 4000); return; }
  const app = addToTracker(d.id);
  app.cvVersionId = v.id; if (["Discovered", "Not reviewed", "Interested", "To apply"].includes(app.status)) { app.status = "CV prepared"; app.history.push({ date: TODAY(), status: "CV prepared" }); }
  logActivity("Tailored CV created: " + v.name);
  save(); rerender();
  toast(ok ? "Tailored CV created and verified" : "Created with warnings; see the integrity note", 4000);
};
async function sha(bytes) { const h = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
ACT.dlVersion = (d) => { const v = S.cvVersions.find((x) => x.id === d.v); download(v.name, b64ToBytes(v.bytesB64), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"); };
async function inAppPdf(bytes, name) {
  if (!window.CareerPDF || !window.jspdf) throw new Error("PDF engine not loaded");
  const r = await CareerPDF.docxToPdf(JSZip, bytes, DOMParser, window.jspdf.jsPDF, window.CAREEROS_PDF_FONTS);
  await download(name, new Blob([r.bytes], { type: "application/pdf" }));
  toast("PDF created in the app: " + r.pages + " page(s)" + (r.warnings.length ? ". " + r.warnings[0] : ""), 5000);
  return r;
}
ACT.masterPdf = async () => { await inAppPdf(b64ToBytes(S.master.docxB64), (S.master.name || "Master_CV.docx").replace(/\.docx$/i, ".pdf")); };
ACT.viewChanges = (d) => {
  const v = S.cvVersions.find((x) => x.id === d.v);
  modal(`<h2>Original vs tailored: ${esc(v.name)}</h2><p class="small muted">${v.changes.length} change(s) · keyword coverage ${v.coverageBefore}% → ${v.coverageAfter}% · ${esc(v.integrity.summary)}</p>
    <div class="tablewrap" style="max-height:60vh"><table class="cmp"><thead><tr><th>Section</th><th>Original wording</th><th>New wording</th><th>Reason and evidence</th><th class="num">Keyword impact</th></tr></thead><tbody>${v.changes.map((c) => `<tr><td class="small">${esc(c.type)}<div class="tiny muted">${esc(c.section || "")}</div></td><td class="orig">${esc(c.original.replace(/^•\t/, "• "))}</td><td>${c.op === "remove" ? "<del>(removed)</del>" : wordDiff(c.original.replace(/^•\t/, "• "), c.proposed.replace(/^•\t/, "• "))}</td><td class="tiny">${esc(c.reason || "")}<div class="muted">${esc(c.evidence || "")}</div></td><td class="num">${c.coverageImpact != null ? (c.coverageImpact > 0 ? "+" : "") + c.coverageImpact : "-"}</td></tr>`).join("")}</tbody></table></div>
    <div class="row mt"><button class="btn" data-act="closeModal">Close</button></div>`);
};
ACT.pdfVersion = async (d) => {
  const v = S.cvVersions.find((x) => x.id === d.v);
  try { await inAppPdf(b64ToBytes(v.bytesB64), v.name.replace(/\.docx$/, ".pdf")); return; } catch (e) { console.warn("in-app PDF failed, trying companion", e); }
  try {
    const r = await fetch(S.settings.companionUrl + "/docx2pdf", { method: "POST", body: b64ToBytes(v.bytesB64), headers: { "Content-Type": "application/octet-stream" } });
    if (!r.ok) throw new Error((await r.json()).error || "conversion failed");
    const pages = r.headers.get("X-Page-Count");
    download(v.name.replace(/\.docx$/, ".pdf"), await r.blob(), "application/pdf");
    toast("PDF exported by the local companion (LibreOffice)" + (pages ? ": " + pages + " page(s)" : ""), 4000);
    if (pages && parseInt(pages, 10) > 1) toast("Warning: the PDF has " + pages + " pages. Reject or shorten some changes.", 6000);
  } catch (e) {
    modal(`<h2>Export PDF</h2><p class="small">An exact-format PDF needs a real word processor. Choose one:</p><ol class="small"><li><b>Recommended:</b> download the DOCX, open it in Microsoft Word or LibreOffice, then File → Save as / Export as PDF. Install the free <i>Source Sans Pro</i> font first so the layout matches.</li><li>Run the optional companion (<code>python3 tools/careeros_server.py</code>) and click PDF again. It converts with LibreOffice and reports the page count.</li><li>Quick preview print (approximate layout, not for sending).</li></ol>
      <div class="row"><button class="btn primary" data-act="dlVersion" data-v="${v.id}">Download DOCX</button><button class="btn" data-act="printVersion" data-v="${v.id}">Approximate print preview</button><button class="btn" data-act="closeModal">Close</button></div>`);
  }
};
ACT.printVersion = async (d) => {
  if (HOOKS.noPrint) return toast("Printing is not available in this view. Download the DOCX and open it in Word or Pages.", 5000);
  const v = S.cvVersions.find((x) => x.id === d.v);
  const m = await E.readDocx(JSZip, b64ToBytes(v.bytesB64), DOMParser);
  const w = window.open("", "_blank");
  w.document.write(`<html><head><title>${esc(v.name)}</title><style>${document.getElementById("css").textContent} body{background:#fff}.cvdoc{border:0;box-shadow:none;max-width:none}</style></head><body>${cvPreview(m.paragraphs)}<script>setTimeout(()=>print(),300)<\/script></body></html>`);
  w.document.close();
};
