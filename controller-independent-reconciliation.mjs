import fs from 'node:fs';
import crypto from 'node:crypto';

const specPath='specification/closed-loop-reliability-controlling-implementation-specification.txt';
const manifestPath='specification/closed-loop-normative-requirements.json';
const text=fs.readFileSync(specPath,'utf8');
const lines=text.split('\n');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const norm=/\b(MUST(?:\s+NOT)?|SHALL(?:\s+NOT)?|REQUIRED|PROHIBITED|CANNOT|CAN NEVER|NEVER|ONLY|REJECT(?:ED|S)?|BLOCK(?:ED|S)?|FAILS? CLOSED|EXACTLY|AT LEAST|NO OTHER|IS INVALID|ARE INVALID)\b/i;
const heading=/^(?:Stage\s+\d+\b|\d+(?:\.\d+)*\.?\s+\S|[A-M]\.\s+\S|Phase\s+\d+\b)/;
let current='preamble';
const sectionByLine=[];
for(let i=0;i<lines.length;i++){const t=lines[i].trim();if(heading.test(t))current=t;sectionByLine[i+1]=current;}
const clean=s=>s.replace(/\s+/g,' ').trim();
const passA=[];
for(let i=0;i<lines.length;i++){
  const raw=lines[i],t=clean(raw.replace(/^[-*•]\s*/,''));
  if(!t||!norm.test(t))continue;
  for(const clause of t.split(/(?<=[.;:])\s+(?=[A-Z0-9"'`-])/).map(clean).filter(Boolean))if(norm.test(clause))passA.push({line:i+1,section:sectionByLine[i+1],text:clause,id:'A-'+sha(`${i+1}\n${clause}`).slice(0,20)});
}
const passB=[];
let paragraph=[],start=1;
const flush=()=>{if(!paragraph.length)return;const raw=paragraph.join('\n'),flat=clean(raw);if(norm.test(flat)){const units=raw.split(/\n|;\s+(?=[-A-Z0-9])/).map(x=>clean(x.replace(/^[-*•\d.)\s]+/,''))).filter(x=>x&&norm.test(x));for(const unit of units)passB.push({line:start,section:sectionByLine[start],text:unit,id:'B-'+sha(`${start}\n${unit}`).slice(0,20)});}paragraph=[];};
for(let i=0;i<=lines.length;i++){const t=i<lines.length?lines[i]:'';if(!t.trim()||heading.test(t.trim())){flush();start=i+2;}else{if(!paragraph.length)start=i+1;paragraph.push(t);}};
const entries=Array.isArray(manifest)?manifest:(manifest.requirements||manifest.entries||manifest.normativeRequirements||[]);
const loc=e=>String(e.controllingTextLocation||e.sourceLocation||e.location||e.specificationLocation||'');
const etext=e=>clean(String(e.controllingText||e.requirementText||e.text||e.normativeText||''));
const manifestLines=new Set();
for(const e of entries){const m=loc(e).match(/(?:line|L)\s*(\d+)/i);if(m)manifestLines.add(Number(m[1]));}
const covered=(unit)=>entries.some(e=>{const l=loc(e),t=etext(e);if(l&&new RegExp(`(?:line|L)\\s*${unit.line}(?:\\D|$)`,'i').test(l))return true;if(t&&unit.text.length>=20&&(t.includes(unit.text)||unit.text.includes(t)))return true;return false;});
const aUncovered=passA.filter(x=>!covered(x));
const bUncovered=passB.filter(x=>!covered(x));
const sections=[...new Set(sectionByLine.filter(Boolean))];
const nonnormative=manifest.nonnormativeSections||manifest.nonNormativeSections||manifest.sectionDispositions||[];
const sectionCovered=section=>entries.some(e=>loc(e).includes(section))||nonnormative.some(e=>String(e.section||e.location||'').includes(section)&&String(e.reason||'').trim());
const uncoveredSections=sections.filter(s=>!sectionCovered(s)&&[...passA,...passB].some(x=>x.section===s));
const normalizeForCompare=s=>clean(s).toLowerCase().replace(/[^a-z0-9]+/g,' ');
const near=(x,list)=>list.some(y=>{const a=new Set(normalizeForCompare(x.text).split(' ').filter(Boolean)),b=new Set(normalizeForCompare(y.text).split(' ').filter(Boolean));let n=0;for(const w of a)if(b.has(w))n++;return n/Math.max(1,Math.min(a.size,b.size))>=0.75;});
const onlyA=passA.filter(x=>!near(x,passB));
const onlyB=passB.filter(x=>!near(x,passA));
const report={schema:'closed-loop-independent-normative-reconciliation/1',specification:{path:specPath,byteLength:Buffer.byteLength(text),sha256:sha(text),lineCount:lines.length},manifest:{path:manifestPath,entryCount:entries.length,sha256:sha(fs.readFileSync(manifestPath))},passA:{method:'line-clause exhaustive normative-token extraction',count:passA.length,uncovered:aUncovered},passB:{method:'fresh paragraph and section omission challenge independent of pass A output',count:passB.length,uncovered:bUncovered},reconciliation:{onlyA,onlyB,uncoveredSections,materialDisagreement:aUncovered.length>0||bUncovered.length>0||uncoveredSections.length>0},generatedAtDeviceTime:new Date().toISOString()};
fs.writeFileSync(process.env.RECONCILIATION_REPORT||'/tmp/controller-independent-reconciliation.json',JSON.stringify(report,null,2));
if(report.reconciliation.materialDisagreement)process.exitCode=2;
