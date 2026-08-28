import fs from 'node:fs';
import {createHash} from 'node:crypto';
let s=fs.readFileSync('workflow-engine.js','utf8');
const before=s;
s=s.replace('ds=determinations.map(x=>x.determination)','ds=determinations');
s=s.replace(".filter(x=>x.determination!=='SATISFIED')",".filter(x=>x!=='SATISFIED')");
s=s.replace(/semantic/gi,'adjudication');
function replaceFunction(name,body){
  const start=s.indexOf(`function ${name}(`);if(start<0)throw new Error(`Missing ${name}`);
  let brace=s.indexOf('{',start),depth=0,end=-1;
  for(let i=brace;i<s.length;i++){if(s[i]==='{')depth++;else if(s[i]==='}'&&--depth===0){end=i+1;break;}}
  if(end<0)throw new Error(`Unclosed ${name}`);
  s=s.slice(0,start)+body.trim()+s.slice(end);
}
replaceFunction('detectCurrentContradictions',String.raw`
function detectCurrentContradictions(project){
  const out=[],push=(type,key,details,severity='RELEASE_MATERIAL')=>out.push({type,key,details,severity}),adjudicationCollections=['verification','deterministicResults','meaningResults','adversarialResults','representationInspections','preflightRecords','confirmationRecords','processAudits','productAudits','regressionExecutions','products'];
  const evaluation=(collection,r)=>evaluateResultConsistency(collection,r,testForResult(project,r),project),supports=(e,state)=>e.determination===state||e.claimedDetermination===state;
  for(const collection of adjudicationCollections)for(const r of recordsForCurrentScope(project,collection)){const e=evaluation(collection,r),id=recordId(r,collection)||String(r.id||r.recordId||'UNKNOWN');if(e.claimedDetermination==='SATISFIED'&&e.determination!=='SATISFIED')push('CLAIMED_FAVORABLE_EFFECTIVE_CONFLICT',collection+':'+id,[e.claimedDetermination,e.determination,...e.reasons]);}
  const groups=new Map();for(const r of recordsForCurrentScope(project,'verification')){const key=verificationKey(r),e=evaluation('verification',r),state=e.determination==='UNDETERMINED'&&['SATISFIED','VIOLATED'].includes(e.claimedDetermination)?e.claimedDetermination:e.determination;if(!groups.has(key))groups.set(key,new Set());groups.get(key).add(state);}for(const [key,ds] of groups)if(ds.size>1)push('VERIFICATION_DETERMINATION_CONFLICT',key,[...ds]);
  const det=recordsForCurrentScope(project,'deterministicResults'),meaning=recordsForCurrentScope(project,'meaningResults'),adv=recordsForCurrentScope(project,'adversarialResults');
  for(const m of meaning){const req=resultRequirementId(project,m),me=evaluation('meaningResults',m);if(supports(me,'VIOLATED')&&det.some(d=>resultRequirementId(project,d)===req&&supports(evaluation('deterministicResults',d),'SATISFIED')))push('DETERMINISTIC_MEANING_CONFLICT',req,['DETERMINISTIC SATISFIED claim/effective state','MEANING VIOLATED claim/effective state']);if(supports(me,'SATISFIED')&&adv.some(a=>resultRequirementId(project,a)===req&&supports(evaluation('adversarialResults',a),'VIOLATED')))push('MEANING_ADVERSARIAL_CONFLICT',req,['MEANING SATISFIED claim/effective state','ADVERSARIAL VIOLATION claim/effective state']);}
  const artifacts=new Map();for(const a of recordsForCurrentScope(project,'artifacts')){const id=recordId(a,'artifacts'),sig=[recordValue(a,'VERSION'),recordValue(a,'BYTE_SIZE'),recordValue(a,'SHA256')].join('|');if(artifacts.has(id)&&artifacts.get(id)!==sig)push('ARTIFACT_IDENTITY_CONFLICT',id,[artifacts.get(id),sig]);else artifacts.set(id,sig);}
  const product=recordsForCurrentScope(project,'products').at(-1),baseline=recordsForCurrentScope(project,'baselines').at(-1);if(product&&baseline&&String(recordValue(product,'BASELINE_ID')||product.relationships?.BASELINE_ID||'')!==recordId(baseline,'baselines'))push('PRODUCT_BASELINE_CONFLICT',recordId(product,'products'),['Product baseline differs from current baseline.']);
  return out;
}
`);
if(s===before)throw new Error('Expected adjudication fixups were not found.');
fs.writeFileSync('workflow-engine.js',s);
const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const gitBlobSha=file=>{const bytes=fs.readFileSync(file);return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');};
const manifest=runtimeFiles.map(file=>`${file}:${gitBlobSha(file)}\n`).join('');
const token=`runtime-${createHash('sha256').update(manifest).digest('hex').slice(0,16)}`;
let html=fs.readFileSync('index.html','utf8');
for(const file of runtimeFiles)html=html.replace(new RegExp(`${file.replace('.','\\.')}\\?v=[^\"]+`,'g'),`${file}?v=${token}`);
fs.writeFileSync('index.html',html);
console.log(`adjudication fixups applied; ${token}`);
