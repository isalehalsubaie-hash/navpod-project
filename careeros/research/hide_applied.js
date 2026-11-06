/* Drop jobs the user already applied to from data/jobs.json. The list lives in research/applied_private.json,
   which is git-ignored, so the published seed never records which applications were made. */
const fs = require('fs'), path = require('path');
const f = path.join(__dirname, 'applied_private.json');
if (!fs.existsSync(f)) { console.log('no applied_private.json, nothing hidden'); process.exit(0); }
const ids = new Set(JSON.parse(fs.readFileSync(f)).ids);
const p = path.join(__dirname, '../data/jobs.json');
const jobs = JSON.parse(fs.readFileSync(p));
const keep = jobs.filter((j) => !ids.has(j.id));
fs.writeFileSync(p, JSON.stringify(keep, null, 1));
console.log('hidden', jobs.length - keep.length, 'of', jobs.length, '->', keep.length);
