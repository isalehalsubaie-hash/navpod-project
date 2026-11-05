/* Renders DOCX files to PDF with the in-app renderer (Node build of jsPDF) and reports page counts. */
const fs = require('fs'), path = require('path');
const B = path.join(__dirname, '../build/node_modules/'); const JSZip = require(B + 'jszip'); const { DOMParser } = require(B + '@xmldom/xmldom');
const { jsPDF } = require(B + 'jspdf'); const R = require('../src/pdfrender.js');
const F = (n) => fs.readFileSync(path.join(__dirname, '../vendor/fonts/SSP-' + n + '.ttf')).toString('base64');
const fonts = { r: F('Regular'), b: F('Bold'), i: F('It'), bi: F('BoldIt') };
(async () => {
  const files = process.argv.slice(3); const out = process.argv[2];
  for (const f of files) {
    const r = await R.docxToPdf(JSZip, fs.readFileSync(f), DOMParser, jsPDF, fonts);
    const o = path.join(out, path.basename(f).replace(/\.docx$/, '.inapp.pdf')); fs.writeFileSync(o, r.bytes);
    console.log(path.basename(f), 'pages', r.pages, r.warnings.length ? 'warnings: ' + r.warnings.join(' | ') : '');
  }
})().catch((e) => { console.error(e); process.exit(1); });
