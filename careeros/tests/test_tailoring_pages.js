/* For the top jobs, accept all wording suggestions, build the DOCX, render with LibreOffice, count pages,
   and check that untouched paragraphs, page setup and the master file are unchanged. */
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const B = path.join(__dirname, '../build/node_modules/'); const JSZip = require(B + 'jszip'); const { DOMParser, XMLSerializer } = require(B + '@xmldom/xmldom');
const E = require('../src/engine.js'); E.setFontWidths(require('../data/font_widths.json')); const P = require('../data/profile.json'); const J = require('../data/jobs.json');
const OUT = path.join(__dirname, 'out/pages'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const masterPath = path.join(__dirname, '../master_cv/Saleh_Alsubaie_CV_MASTER.docx');
  const masterBytes = fs.readFileSync(masterPath); const hash0 = require('crypto').createHash('sha256').update(masterBytes).digest('hex');
  const m = await E.readDocx(JSZip, masterBytes, DOMParser); m.freeLines = 0;
  const top = J.map((j) => ({ j, a: E.analyzeJob(j) })).map((x) => ({ ...x, el: E.evaluateEligibility(x.j, P, x.a, '2026-11-05'), s: E.scoreMatch(x.j, P, x.a).total }))
    .filter((x) => ['GREEN', 'YELLOW'].includes(x.el.label)).sort((a, b) => b.s - a.s).slice(0, 12);
  let fails = 0; const rows = [];
  for (const { j, a } of top) {
    const r = E.optimizeSuggestions(j, a, m, P);
    const acc = r.suggestions.filter((s) => s.op !== 'remove' && s.type !== 'Integrity');
    const est = E.overflowEstimate(m, acc);
    const out = await E.applyChangesToDocx(JSZip, masterBytes, acc, DOMParser, XMLSerializer);
    const f = path.join(OUT, j.jobId + '.docx'); fs.writeFileSync(f, out.bytes);
    execSync(`soffice --headless --convert-to pdf --outdir "${OUT}" "${f}"`, { stdio: 'ignore' });
    const pages = parseInt(execSync(`pdfinfo "${f.replace(/docx$/, 'pdf')}"`).toString().match(/Pages:\s+(\d+)/)[1], 10);
    const re = await E.readDocx(JSZip, out.bytes, DOMParser);
    const changed = new Set(acc.map((x) => x.paragraph));
    const untouchedOk = m.paragraphs.every((p, i) => changed.has(i) || re.paragraphs[i].text === p.text);
    const metaOk = JSON.stringify(re.meta.margins) === JSON.stringify(m.meta.margins) && re.meta.fonts.join() === m.meta.fonts.join() && re.meta.hyperlinks === m.meta.hyperlinks;
    let pagesWithRemoval = '';
    if (pages > 1) { const acc2 = r.suggestions.filter((s) => s.type !== 'Integrity'); const o2 = await E.applyChangesToDocx(JSZip, masterBytes, acc2, DOMParser, XMLSerializer); const f2 = path.join(OUT, j.jobId + '_with_removal.docx'); fs.writeFileSync(f2, o2.bytes); execSync(`soffice --headless --convert-to pdf --outdir "${OUT}" "${f2}"`, { stdio: 'ignore' }); pagesWithRemoval = parseInt(execSync(`pdfinfo "${f2.replace(/docx$/, 'pdf')}"`).toString().match(/Pages:\s+(\d+)/)[1], 10); }
    const predictionOk = (est.risk === 'high') === (pages > 1);
    const pass = predictionOk && untouchedOk && metaOk && out.log.every((x) => x.ok);
    if (!pass) fails++;
    rows.push({ job: j.jobId, title: j.title.slice(0, 34), changes: acc.length, estDelta: est.delta, risk: est.risk, pages, predictionOk, pagesWithRemoval, untouchedOk, metaOk, pass });
  }
  console.table(rows);
  const hash1 = require('crypto').createHash('sha256').update(fs.readFileSync(masterPath)).digest('hex');
  console.log('master unchanged:', hash0 === hash1, '| failures:', fails);
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ rows, masterUnchanged: hash0 === hash1 }, null, 1));
  process.exit(fails || hash0 !== hash1 ? 1 : 0);
})();
