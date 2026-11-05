/* CareerOS DOCX to PDF renderer.
   Reads the DOCX's own layout (page size, margins, style defaults, paragraph spacing, line spacing,
   indents, tab stops, alignment, bottom borders, run bold/italic/size/colour, hyperlinks) and draws it
   with jsPDF. Source Sans Pro (embedded, SIL Open Font License) is used when the document asks for it;
   other fonts fall back to Helvetica and are reported. Designed for text CVs: tables, images and text
   boxes are reported as unsupported instead of being drawn wrongly. Works in the browser and in Node. */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.CareerPDF = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const kids = (n, local) => (n ? Array.from(n.childNodes).filter((c) => c.nodeType === 1 && c.localName === local && c.namespaceURI === W) : []);
  const kid = (n, local) => kids(n, local)[0] || null;
  const att = (n, a) => (n ? n.getAttributeNS(W, a) || n.getAttribute("w:" + a) || "" : "");
  const num = (n, a, d) => { const v = att(n, a); return v === "" ? d : parseFloat(v); };
  const onOff = (n) => n && !/^(0|false|off)$/i.test(att(n, "val"));

  function readRPr(rPr, base) {
    const o = Object.assign({}, base);
    if (!rPr) return o;
    const b = kid(rPr, "b"); if (b) o.bold = onOff(b);
    const i = kid(rPr, "i"); if (i) o.italic = onOff(i);
    const sz = kid(rPr, "sz"); if (sz) o.size = num(sz, "val", o.size * 2) / 2;
    const c = kid(rPr, "color"); if (c && /^[0-9A-Fa-f]{6}$/.test(att(c, "val"))) o.color = att(c, "val");
    const f = kid(rPr, "rFonts"); if (f && att(f, "ascii")) o.font = att(f, "ascii");
    const u = kid(rPr, "u"); if (u) o.underline = att(u, "val") && att(u, "val") !== "none";
    const caps = kid(rPr, "caps"); if (caps) o.caps = onOff(caps);
    return o;
  }
  function readPPr(pPr, base) {
    const o = JSON.parse(JSON.stringify(base));
    if (!pPr) return o;
    const sp = kid(pPr, "spacing");
    if (sp) {
      if (att(sp, "before")) o.before = num(sp, "before", 0) / 20;
      if (att(sp, "after")) o.after = num(sp, "after", 0) / 20;
      if (att(sp, "line")) { o.line = num(sp, "line", 240); o.lineRule = att(sp, "lineRule") || "auto"; }
    }
    const ind = kid(pPr, "ind");
    if (ind) {
      if (att(ind, "left") || att(ind, "start")) o.left = num(ind, att(ind, "left") ? "left" : "start", 0) / 20;
      if (att(ind, "right") || att(ind, "end")) o.right = num(ind, att(ind, "right") ? "right" : "end", 0) / 20;
      if (att(ind, "hanging")) o.first = -num(ind, "hanging", 0) / 20;
      if (att(ind, "firstLine")) o.first = num(ind, "firstLine", 0) / 20;
    }
    const jc = kid(pPr, "jc"); if (jc) o.align = att(jc, "val");
    const tabs = kid(pPr, "tabs");
    if (tabs) for (const t of kids(tabs, "tab")) { if (att(t, "val") === "clear") continue; o.tabs.push({ pos: num(t, "pos", 0) / 20, val: att(t, "val") || "left" }); }
    const bdr = kid(pPr, "pBdr");
    if (bdr) { const bt = kid(bdr, "bottom"); if (bt && att(bt, "val") !== "nil") o.borderBottom = { size: num(bt, "sz", 4) / 8, space: num(bt, "space", 1), color: /^[0-9A-Fa-f]{6}$/.test(att(bt, "color")) ? att(bt, "color") : "000000" }; }
    return o;
  }

  async function parse(JSZip, bytes, DOMParserImpl) {
    const zip = await JSZip.loadAsync(bytes);
    const P = (x) => new DOMParserImpl().parseFromString(x, "application/xml");
    const doc = P(await zip.file("word/document.xml").async("string"));
    const styles = zip.file("word/styles.xml") ? P(await zip.file("word/styles.xml").async("string")) : null;
    const settings = zip.file("word/settings.xml") ? P(await zip.file("word/settings.xml").async("string")) : null;
    const rels = {};
    if (zip.file("word/_rels/document.xml.rels")) {
      const rx = P(await zip.file("word/_rels/document.xml.rels").async("string"));
      for (const r of Array.from(rx.getElementsByTagName("Relationship"))) rels[r.getAttribute("Id")] = r.getAttribute("Target");
    }
    let defR = { size: 10, bold: false, italic: false, color: "000000", font: "Calibri" };
    let defP = { before: 0, after: 0, line: 240, lineRule: "auto", left: 0, right: 0, first: 0, align: "left", tabs: [], borderBottom: null };
    const styleMap = {};
    if (styles) {
      const dd = styles.getElementsByTagNameNS(W, "docDefaults")[0];
      if (dd) { const rd = dd.getElementsByTagNameNS(W, "rPr")[0]; defR = readRPr(rd, defR); const pd = dd.getElementsByTagNameNS(W, "pPr")[0]; defP = readPPr(pd, defP); }
      for (const s of Array.from(styles.getElementsByTagNameNS(W, "style"))) styleMap[att(s, "styleId")] = s;
    }
    const resolveStyle = (id, seen) => {
      const s = styleMap[id]; seen = seen || new Set();
      if (!s || seen.has(id)) return { r: defR, p: defP };
      seen.add(id);
      const based = kid(s, "basedOn");
      const base = based ? resolveStyle(att(based, "val"), seen) : { r: defR, p: defP };
      return { r: readRPr(kid(s, "rPr"), base.r), p: readPPr(kid(s, "pPr"), base.p) };
    };
    const normal = styleMap.Normal ? resolveStyle("Normal") : { r: defR, p: defP };
    let defaultTab = 36;
    if (settings) { const dt = settings.getElementsByTagNameNS(W, "defaultTabStop")[0]; if (dt) defaultTab = num(dt, "val", 720) / 20; }
    const body = doc.getElementsByTagNameNS(W, "body")[0];
    const sect = body.getElementsByTagNameNS(W, "sectPr");
    const sp = sect[sect.length - 1];
    const pg = kid(sp, "pgSz"), mar = kid(sp, "pgMar");
    const page = { w: num(pg, "w", 11906) / 20, h: num(pg, "h", 16838) / 20, top: num(mar, "top", 1440) / 20, bottom: num(mar, "bottom", 1440) / 20, left: num(mar, "left", 1440) / 20, right: num(mar, "right", 1440) / 20 };
    const warnings = [];
    if (body.getElementsByTagNameNS(W, "tbl").length) warnings.push("Tables are not rendered by the in-app PDF export; use Word for this document.");
    if (body.getElementsByTagNameNS(W, "drawing").length) warnings.push("Images and shapes are not rendered by the in-app PDF export.");
    const paras = [];
    for (const p of kids(body, "p")) {
      const pPr = kid(p, "pPr");
      const ps = pPr && kid(pPr, "pStyle") ? resolveStyle(att(kid(pPr, "pStyle"), "val")) : normal;
      const pp = readPPr(pPr, ps.p);
      const pr = readRPr(pPr ? kid(pPr, "rPr") : null, ps.r);
      const runs = [];
      const walkRun = (r, link) => {
        const rPr = kid(r, "rPr");
        const cs = rPr && kid(rPr, "rStyle") ? resolveStyle(att(kid(rPr, "rStyle"), "val")).r : ps.r;
        const st = readRPr(rPr, cs);
        for (const c of Array.from(r.childNodes)) {
          if (c.nodeType !== 1) continue;
          if (c.localName === "t") runs.push({ text: c.textContent, st, link });
          else if (c.localName === "tab") runs.push({ tab: true, st, link });
          else if (c.localName === "br" || c.localName === "cr") runs.push({ br: true, st });
        }
      };
      for (const c of Array.from(p.childNodes)) {
        if (c.nodeType !== 1) continue;
        if (c.localName === "r") walkRun(c, null);
        else if (c.localName === "hyperlink") { const id = c.getAttributeNS(R_NS, "id") || c.getAttribute("r:id"); for (const r of kids(c, "r")) walkRun(r, rels[id] || null); }
      }
      paras.push({ pp, pr, runs });
    }
    return { page, paras, defaultTab, warnings };
  }

  /** fonts: { r, b, i, bi } base64 TTF strings for Source Sans Pro. Returns { bytes, pages, warnings }. */
  async function render(model, jsPDF, fonts) {
    const { page, paras, defaultTab } = model;
    const warnings = model.warnings.slice();
    const pdf = new jsPDF({ unit: "pt", format: [page.w, page.h], compress: true });
    const have = !!(fonts && fonts.r);
    if (have) {
      const add = (file, b64, style) => { pdf.addFileToVFS(file, b64); pdf.addFont(file, "SSP", style); };
      add("SSP-Regular.ttf", fonts.r, "normal"); add("SSP-Bold.ttf", fonts.b || fonts.r, "bold"); add("SSP-It.ttf", fonts.i || fonts.r, "italic"); add("SSP-BoldIt.ttf", fonts.bi || fonts.b || fonts.r, "bolditalic");
    }
    const seenFonts = new Set();
    const setFont = (st) => {
      const family = have && /source\s*sans/i.test(st.font || "") ? "SSP" : "helvetica";
      if (family === "helvetica") seenFonts.add(st.font);
      pdf.setFont(family, st.bold && st.italic ? "bolditalic" : st.bold ? "bold" : st.italic ? "italic" : "normal");
      pdf.setFontSize(st.size);
      pdf.setTextColor("#" + (st.color || "000000"));
    };
    const width = (s, st) => { setFont(st); return pdf.getTextWidth(s); };
    const contentW = page.w - page.left - page.right;
    let y = page.top, pageNo = 1, prevAfter = 0;
    const newPage = () => { pdf.addPage([page.w, page.h]); pageNo++; y = page.top; };
    for (const para of paras) {
      const pp = para.pp;
      // spacing between paragraphs: Word uses the larger of after(prev) and before(this) only with "contextual"; default adds both
      y += pp.before;
      const maxSize = Math.max(para.pr.size, ...para.runs.filter((r) => r.st).map((r) => r.st.size));
      const natural = maxSize * 1.257;
      const lineH = pp.lineRule === "exact" ? pp.line / 20 : pp.lineRule === "atLeast" ? Math.max(pp.line / 20, natural) : natural * (pp.line / 240);
      // tokens
      const toks = [];
      for (const r of para.runs) {
        if (r.tab) { toks.push({ tab: true, st: r.st }); continue; }
        if (r.br) { toks.push({ br: true }); continue; }
        const txt = r.st.caps ? r.text.toUpperCase() : r.text;
        const parts = txt.split(/(\s+)/);
        for (const pt of parts) if (pt) toks.push({ text: pt, space: /^\s+$/.test(pt), st: r.st, link: r.link });
      }
      // build lines
      const lines = [];
      let line = { items: [], first: true };
      const leftOf = (l) => page.left + pp.left + (l.first ? pp.first : 0);
      const maxX = page.left + contentW - pp.right;
      let x = leftOf(line);
      const tabStops = pp.tabs.slice().sort((a, b) => a.pos - b.pos);
      const pushLine = () => { lines.push(line); line = { items: [], first: false }; x = leftOf(line); };
      for (let k = 0; k < toks.length; k++) {
        const t = toks[k];
        if (t.br) { pushLine(); continue; }
        if (t.tab) {
          const rel = x - page.left;
          let stop = tabStops.find((s) => s.pos > rel + 0.01);
          if (!stop) stop = { pos: Math.ceil((rel + 0.01) / defaultTab) * defaultTab, val: "left" };
          if (stop.val === "right" || stop.val === "end") {
            // right-align the text up to the next tab or end of paragraph
            let j = k + 1, segW = 0; while (j < toks.length && !toks[j].tab && !toks[j].br) { segW += width(toks[j].text, toks[j].st); j++; }
            x = Math.max(x, page.left + stop.pos - segW);
          } else if (stop.val === "center") {
            let j = k + 1, segW = 0; while (j < toks.length && !toks[j].tab && !toks[j].br) { segW += width(toks[j].text, toks[j].st); j++; }
            x = Math.max(x, page.left + stop.pos - segW / 2);
          } else x = Math.max(x, page.left + stop.pos);
          continue;
        }
        const w = width(t.text, t.st);
        if (t.space) { if (line.items.length) { line.items.push({ x, w, text: t.text, st: t.st, space: true }); x += w; } continue; }
        if (x + w > maxX + 0.5 && line.items.some((i) => !i.space)) {
          // try a break after a hyphen inside the word
          const hy = t.text.lastIndexOf("-", t.text.length - 2);
          if (hy > 0) { const a = t.text.slice(0, hy + 1); const wa = width(a, t.st); if (x + wa <= maxX + 0.5) { line.items.push({ x, w: wa, text: a, st: t.st, link: t.link }); pushLine(); const b = t.text.slice(hy + 1); const wb = width(b, t.st); line.items.push({ x, w: wb, text: b, st: t.st, link: t.link }); x += wb; continue; } }
          while (line.items.length && line.items[line.items.length - 1].space) line.items.pop();
          pushLine();
        }
        line.items.push({ x, w, text: t.text, st: t.st, link: t.link }); x += w;
      }
      lines.push(line);
      if (!toks.length) lines[0].empty = true;
      // alignment
      for (const l of lines) {
        while (l.items.length && l.items[l.items.length - 1].space) l.items.pop();
        if (!l.items.length || !(pp.align === "center" || pp.align === "right" || pp.align === "end")) continue;
        const start = l.items[0].x, end = l.items[l.items.length - 1].x + l.items[l.items.length - 1].w;
        const avail = maxX - leftOf(l);
        const shift = pp.align === "center" ? (avail - (end - start)) / 2 - (start - leftOf(l)) : maxX - end;
        for (const it of l.items) it.x += shift;
      }
      // draw
      for (const l of lines) {
        if (y + lineH > page.h - page.bottom + 0.5) newPage();
        const baseline = y + (pp.lineRule === "exact" ? lineH * 0.78 : lineH * 0.78);
        for (const it of l.items) {
          if (it.space) continue;
          setFont(it.st);
          pdf.text(it.text, it.x, baseline);
          if (it.link) pdf.link(it.x, baseline - it.st.size * 0.8, it.w, it.st.size, { url: it.link });
          if (it.st.underline) { pdf.setLineWidth(0.4); pdf.line(it.x, baseline + 1, it.x + it.w, baseline + 1); }
        }
        y += lineH;
      }
      if (pp.borderBottom) {
        const by = y + pp.borderBottom.space;
        pdf.setDrawColor("#" + pp.borderBottom.color); pdf.setLineWidth(pp.borderBottom.size);
        pdf.line(page.left + pp.left, by, page.left + contentW - pp.right, by);
        y += pp.borderBottom.space + pp.borderBottom.size;
      }
      y += pp.after;
      prevAfter = pp.after;
    }
    for (const f of seenFonts) if (f) warnings.push("Font '" + f + "' is not embedded in CareerOS; Helvetica was used instead in the PDF.");
    const out = pdf.output("arraybuffer");
    return { bytes: new Uint8Array(out), pages: pageNo, warnings };
  }
  async function docxToPdf(JSZip, bytes, DOMParserImpl, jsPDF, fonts) {
    const model = await parse(JSZip, bytes, DOMParserImpl);
    return render(model, jsPDF, fonts);
  }
  return { parse, render, docxToPdf };
});
