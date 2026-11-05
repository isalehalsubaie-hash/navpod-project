/* Score every job with the same engine the app uses and write build/scored.json for the Excel/CSV/summary exports. */
const fs = require('fs'), path = require('path');
const E = require('../src/engine2.js'); E.setFontWidths(require('../data/font_widths.json'));
const P = require('../data/profile.json'), J = require('../data/jobs.json');
const B = path.join(__dirname, 'node_modules/'); const JSZip = require(B + 'jszip'); const { DOMParser } = require(B + '@xmldom/xmldom');
const TODAY = '2026-11-05';
(async () => {
  const m = await E.readDocx(JSZip, fs.readFileSync(path.join(__dirname, '../master_cv/Saleh_Alsubaie_CV_MASTER.docx')), DOMParser);
  const idx = E.profileEvidenceIndex(P);
  const out = J.map((j) => {
    const a = E.analyzeJob(j), el = E.evaluateEligibility(j, P, a, TODAY), s = E.scoreMatch(j, P, a, { evidenceIndex: idx }), cov = E.cvCoverage(a, m.text, P, { evidenceIndex: idx });
    return { ...j, description: j.description, eligibility: el.label, eligibilitySummary: el.summary, eligibilityReasons: el.reasons.filter((r) => r.level !== 'PASS').map((r) => r.level + ': ' + r.msg), match: s.total, careerValue: E.careerValue(j, a, P).total, factors: s.factors.map((f) => ({ label: f.label, points: f.points, weight: f.weight, why: f.why })), strategy: s.strategy, missing: s.missing, emphasize: s.emphasize, supporting: s.supportingExperience.map((x) => x.title),
      keywordCoverage: cov.keywordCoverage, evidenceCoverage: cov.evidenceCoverage, education: a.extracted.education.join('; ') || ({ mechanical: 'Mechanical Engineering', engineering: 'Engineering (any)', other_engineering: 'Other engineering discipline', business: 'Business/finance', unknown: 'Not stated' }[a.constraints.degree]),
      minYears: a.constraints.minYears, nationality: a.constraints.nationality, skills: a.keywords.filter((k) => k.cat !== 'soft').slice(0, 12).map((k) => k.term), expired: j.status === 'Closed' || (j.deadline && j.deadline < TODAY) };
  });
  fs.writeFileSync(path.join(__dirname, 'scored.json'), JSON.stringify(out, null, 1));
  const c = {}; out.forEach((j) => (c[j.eligibility] = (c[j.eligibility] || 0) + 1)); console.log(out.length, c);
})();
