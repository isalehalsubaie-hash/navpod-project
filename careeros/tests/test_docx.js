const path=require('path'),fs=require('fs');
const B=path.join(__dirname,'../build/node_modules/');
const JSZip=require(B+'jszip');const {DOMParser,XMLSerializer}=require(B+'@xmldom/xmldom');
const E=require('../src/engine.js');
(async()=>{
 const bytes=fs.readFileSync(path.join(__dirname,'../master_cv/Saleh_Alsubaie_CV_MASTER.docx'));
 const m=await E.readDocx(JSZip,bytes,DOMParser);
 console.log('paras',m.paragraphs.length,'meta',JSON.stringify(m.meta));
 m.paragraphs.slice(0,12).forEach(p=>console.log(p.i,p.section,'|',JSON.stringify(p.text.slice(0,70))));
 console.log(E.atsAssessDocx(m).checks.map(c=>c.result+' '+c.name).join('\n'));
 const p=m.paragraphs.find(p=>/Reviewed 11\+/.test(p.text));
 const head=m.paragraphs.find(p=>/^UAV Engineering Intern/.test(p.text));
 const ch=[{id:'a',paragraph:p.i,original:p.text,proposed:p.text.replace('engineering drawings','MEP drawings').replace('firefighting','fire protection (firefighting)')},
   {id:'b',paragraph:head.i,original:head.text,proposed:head.text.replace('UAV Engineering Intern','UAV Engineering Intern (Summer)')}];
 const r=await E.applyChangesToDocx(JSZip,bytes,ch,DOMParser,XMLSerializer);
 console.log(r.log);
 fs.writeFileSync('/tmp/claude-0/-home-user-navpod-project/89ea125c-3579-5f97-8bf4-eaac24befc1c/scratchpad/tailored_test.docx',r.bytes);
 const m2=await E.readDocx(JSZip,r.bytes,DOMParser);
 console.log(m2.paragraphs[p.i].text); console.log(JSON.stringify(m2.paragraphs[head.i].text));
 const orig=fs.readFileSync(path.join(__dirname,'../master_cv/Saleh_Alsubaie_CV_MASTER.docx'));
 console.log('master unchanged', Buffer.compare(orig,bytes)===0);
})().catch(e=>{console.error(e);process.exit(1)});
