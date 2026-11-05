const fs=require('fs');const E=require('../src/engine.js');
const prof=JSON.parse(fs.readFileSync('../data/profile.json'));
const det=JSON.parse(fs.readFileSync('li_details.json'));
const today='2026-11-05';
const IRRELEVANT=/luxury collection|agricultur|anti-money|architecture\)|architectural|dimensional engineer|document controller|clerk|quantity surveyor|pims analyst|transformation success|ai tech|business leader|service representative|founding engineer|gulfmaid|nuts\)|graphic|designer trainee|talent acquisition|lawyer|legal|content|multimedia|rooms|food & beverage|f&b|people operations|credit operations|audit|accounting|databricks|data engineer|ai scientist|artificial intelligence intern|customer support|investment banking|financial markets|marketing|social media|recruit|\bhr\b|human resources|nurse|pharmac|teacher|chef|cashier|hotel|hospitality|ritz|front office|retail|store|barista|driver\b|secretary|receptionist|call center|lab technician|medical|clinical|cyber|software engineer|developer|frontend|backend|devops|site reliability|full[- ]stack|\bsre\b|it support|network engineer|data scientist|compliance|treasury|tax\b|payroll|supply chain intern|logistics quality|me logistic|exploration geologist|geologist|banking - large|bedaya|winnership|grad intern$|internship program- arabyads|internship program$|internship opportunity|webook|atheer|seara|lendo|nice one|electrical engineer \| fresh|telecommunication|elv|ict|low-voltage|power system engineer|healthcare pre-sales|pos automation|gis developer|storage & data|surveyor \(saudi|online surveyor|airport systems|lighting sales|tool management|agent engineer|sifi|amgen|blackrock|jefferies|ritz|panda retail company – savol|visa\b/i;
const KEEP_OVERRIDE=/JPMorgan|KPMG Graduate Internship/i;
function agoToDate(s){const m=(s||'').match(/(\d+)\s*(minute|hour|day|week|month)/i);if(!m)return '';const n=+m[1];const d=new Date(today);const u=m[2].toLowerCase();if(u==='day')d.setDate(d.getDate()-n);if(u==='week')d.setDate(d.getDate()-7*n);if(u==='month')d.setMonth(d.getMonth()-n);return d.toISOString().slice(0,10);}
const kept=[],excluded=[];const seen=new Map();
for(const [id,d] of Object.entries(det)){
 if(d.error||!d.description){excluded.push({id:'LI-'+id,title:d.title,employer:d.company,reason:'Listing page could not be read'});continue;}
 const job={id:'LI-'+id,title:d.title,employer:d.company,location:d.location,country:'Saudi Arabia',type:d.criteria['Employment type']||'',seniority:d.criteria['Seniority level']||'',jobFunction:d.criteria['Job function']||'',industry:d.criteria['Industries']||'',
  published:d.date||agoToDate(d.posted_ago),postedAgo:d.posted_ago,applicants:d.applicants,description:d.description,source:d.url,applyUrl:d.url,status:d.closed?'Closed':'Open',verifiedDate:today,
  verification:'LinkedIn public job page fetched '+today+(d.closed?' shows "No longer accepting applications"':'; no closed notice shown'),verificationLevel:'Aggregator listing (LinkedIn public page)',origin:'research_session',salary:'Not disclosed',deadline:''};
 const nk=x=>x.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').trim(); const key=nk(d.title).slice(0,42)+'|'+nk(d.company)+'|'+nk(d.location).slice(0,12);
 if(seen.has(key)){const o=seen.get(key);o.duplicates=(o.duplicates||[]).concat(job.source);excluded.push({id:job.id,title:job.title,employer:job.employer,reason:'Duplicate of '+o.id});continue;}
 seen.set(key,job);
 const a=E.analyzeJob(job);job.tracks=E.inferTracks(job,a);
 if((IRRELEVANT.test(job.title)&&!KEEP_OVERRIDE.test(job.title+job.employer))||!job.tracks.length&&!/engineer|intern|graduate|trainee|co-?op/i.test(job.title)){excluded.push({id:job.id,title:job.title,employer:job.employer,reason:'Not relevant to the ten career tracks',source:job.source});continue;}
 const el=E.evaluateEligibility(job,prof,a,today);const sc=E.scoreMatch(job,prof,a);
 if(sc.total<40){excluded.push({id:job.id,title:job.title,employer:job.employer,reason:'Low relevance (match '+sc.total+')',source:job.source});continue;}
 job._el=el.label;job._score=sc.total;job._c=a.constraints;
 kept.push(job);
}
fs.writeFileSync('curated_li.json',JSON.stringify(kept,null,1));fs.writeFileSync('excluded_li.json',JSON.stringify(excluded,null,1));
const c={};kept.forEach(j=>c[j._el]=(c[j._el]||0)+1);console.log('kept',kept.length,c,'excluded',excluded.length);
kept.sort((a,b)=>b._score-a._score).forEach(j=>console.log(j._el.padEnd(6),String(j._score).padStart(3),(j._c.minYears??'-')+'y',j._c.nationality.slice(0,2),'|',j.id,'|',j.title.slice(0,50).padEnd(50),'|',j.employer.slice(0,26).padEnd(26),'|',j.location.slice(0,14),'|',j.tracks.join(',')));
