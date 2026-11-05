const fs=require('fs');const E=require('../src/engine.js');
const prof=JSON.parse(fs.readFileSync('../data/profile.json'));
const det=JSON.parse(fs.readFileSync('li_details.json'));
const today='2026-11-05';
function agoToDate(s){const m=(s||'').match(/(\d+)\s*(minute|hour|day|week|month)/i);if(!m)return '';const n=+m[1];const d=new Date(today);const u=m[2].toLowerCase();if(u==='day')d.setDate(d.getDate()-n);if(u==='week')d.setDate(d.getDate()-7*n);if(u==='month')d.setMonth(d.getMonth()-n);return d.toISOString().slice(0,10);}
const out=[];const seen=new Map();
for(const [id,d] of Object.entries(det)){
 if(d.error||!d.description) continue;
 const key=(d.title+'|'+d.company).toLowerCase().replace(/\s+/g,' ');
 const job={id:'LI-'+id,title:d.title,employer:d.company,location:d.location,country:'Saudi Arabia',type:d.criteria['Employment type']||'',seniority:d.criteria['Seniority level']||'',function:d.criteria['Job function']||'',industry:d.criteria['Industries']||'',
  published:d.date||agoToDate(d.posted_ago),postedAgo:d.posted_ago,applicants:d.applicants,description:d.description,source:d.url,applyUrl:d.url,status:d.closed?'Closed':'Open',verifiedDate:today,
  verification:'LinkedIn public job page fetched '+today+(d.closed?': shows no longer accepting applications':': no closed notice shown'),origin:'research_session',queries:d.queries};
 if(seen.has(key)){seen.get(key).duplicates=(seen.get(key).duplicates||[]).concat(job.source);continue;}
 seen.set(key,job);
 const a=E.analyzeJob(job);job.tracks=E.inferTracks(job,a);
 const el=E.evaluateEligibility(job,prof,a,today);const sc=E.scoreMatch(job,prof,a);
 job._el=el.label;job._score=sc.total;job._minY=a.constraints.minYears;job._nat=a.constraints.nationality;
 out.push(job);
}
fs.writeFileSync('li_jobs_scored.json',JSON.stringify(out,null,1));
const c={};out.forEach(j=>c[j._el]=(c[j._el]||0)+1);console.log(out.length,c);
out.sort((a,b)=>b._score-a._score).forEach(j=>console.log(j._el.padEnd(6),String(j._score).padStart(3),(j._minY??'-')+'y',j._nat.slice(0,2),'|',j.title.slice(0,55).padEnd(55),'|',j.employer.slice(0,28).padEnd(28),'|',j.location.slice(0,18),'|',j.tracks.join(','),'|',j.seniority.slice(0,10),j.published));
