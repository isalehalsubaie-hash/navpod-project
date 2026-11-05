const fs=require('fs');const E=require('../src/engine.js');
const prof=JSON.parse(fs.readFileSync('../data/profile.json'));
const cur=JSON.parse(fs.readFileSync('curated_li.json'));const ov=JSON.parse(fs.readFileSync('overrides.json'));
const exLI=JSON.parse(fs.readFileSync('excluded_li.json'));
const det=JSON.parse(fs.readFileSync('li_details.json'));
const today='2026-11-05';
const noEm=s=>typeof s==='string'?s.replace(/—/g,' - '):s;
// add defence listings fetched later that are not in curated
const curIds=new Set(cur.map(j=>j.id));
const defIds=Object.keys(JSON.parse(fs.readFileSync('li_def2.json')));
for(const k of defIds){const d=det[k];if(!d||!d.description||curIds.has('LI-'+k))continue;
 cur.push({id:'LI-'+k,title:d.title,employer:d.company,location:d.location,country:'Saudi Arabia',type:d.criteria['Employment type']||'',seniority:d.criteria['Seniority level']||'',jobFunction:d.criteria['Job function']||'',industry:d.criteria['Industries']||'',published:d.date,postedAgo:d.posted_ago,applicants:d.applicants,description:d.description,source:d.url,applyUrl:d.url,status:d.closed?'Closed':'Open',verifiedDate:today,verification:'LinkedIn public job page fetched '+today+(d.closed?' shows "No longer accepting applications"':'; no closed notice shown'),verificationLevel:'Aggregator listing (LinkedIn public page)',origin:'research_session',salary:'Not disclosed',deadline:''});}
const jobs=[],excluded=[...exLI.map(e=>({...e,category:'Excluded'}))];
for(const j0 of cur){
 const o=ov[j0.id]||{};
 const j={...j0};delete j._el;delete j._score;delete j._c;
 if(o.exclude){excluded.push({id:j.id,title:j.title,employer:j.employer,reason:o.exclude,source:j.source,category:'Excluded'});continue;}
 Object.assign(j,o);
 for(const k of Object.keys(j)) j[k]=noEm(j[k]);
 const a=E.analyzeJob(j);
 if(!o.tracks) j.tracks=E.inferTracks(j,a);
 if(!j.tracks.length) j.tracks=['ME'];
 const el=E.evaluateEligibility(j,prof,a,today);const sc=E.scoreMatch(j,prof,a);
 if(j.status==='Closed'){excluded.push({id:j.id,title:j.title,employer:j.employer,reason:'Closed: '+j.verification,source:j.source,category:'Expired'});continue;}
 if(sc.total<38){excluded.push({id:j.id,title:j.title,employer:j.employer,reason:'Low relevance (match '+sc.total+')',source:j.source,category:'Excluded'});continue;}
 j._eligibility=el.label;j._match=sc.total;
 jobs.push(j);
}
// manual program records
const manual=JSON.parse(fs.readFileSync('manual_records.json'));
for(const m of manual.active){m.origin='research_session';jobs.push(m);}
for(const m of manual.historical){excluded.push({...m,category:m.category||'Expired'});}
// assign CareerOS ids
jobs.sort((a,b)=>(b._match||0)-(a._match||0));
// keep previously published IDs stable; new jobs get the next numbers
let prev={};try{for(const j of JSON.parse(fs.readFileSync('../data/jobs.json')))prev[j.id]=j.jobId;}catch(e){}
let next=Math.max(0,...Object.values(prev).map(x=>parseInt(String(x).slice(3),10)||0))+1;
const pass1=new Set(Object.keys(prev));
jobs.forEach(j=>{ if(prev[j.id]) j.jobId=prev[j.id]; else { j.jobId='CO-'+String(next++).padStart(4,'0'); j.researchPass=2; } j.firstSeen=j.firstSeen||'2026-11-05'; });
fs.writeFileSync('../data/jobs.json',JSON.stringify(jobs.map(j=>{const c={...j};delete c._eligibility;delete c._match;return c;}),null,1));
fs.writeFileSync('../data/excluded.json',JSON.stringify(excluded,null,1));
const c={};jobs.forEach(j=>c[j._eligibility]=(c[j._eligibility]||0)+1);
console.log('jobs',jobs.length,c,'excluded',excluded.length);
jobs.slice(0,40).forEach(j=>console.log(j.jobId,j._eligibility,j._match,'|',j.title.slice(0,50),'|',j.employer.slice(0,25),'|',j.tracks.join(',')));
