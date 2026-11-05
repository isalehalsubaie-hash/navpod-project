const fs=require('fs');const J=JSON.parse(fs.readFileSync('curated_li.json'));
const ids=process.argv.slice(2);
for(const j of J.filter(j=>ids.length?ids.includes(j.id):j._el!=='RED'&&j._score>=55).sort((a,b)=>b._score-a._score)){
 const lines=j.description.split('\n').filter(l=>/saudi|national|year|experience|degree|bachelor|graduat|student|gpa|deadline|apply by|closing|duration|month|salary|sar|intern|coop|co-op|tamheer|female|male|license|sce|location/i.test(l)).map(l=>l.trim().slice(0,170)).slice(0,9);
 console.log('\n##',j.id,j._el,j._score,'|',j.title,'|',j.employer,'|',j.location,'|',j.type,'|',j.seniority,'|',j.published,'|',j.applicants);
 lines.forEach(l=>console.log('  -',l));
}
