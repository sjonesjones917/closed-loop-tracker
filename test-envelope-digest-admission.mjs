import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {createStageOneIngestionFixture as seed,stageOneResponseEnvelope} from './test-ingestion-context-reference.mjs';

const CURRENT='7d9084fe26f5fe47ba07b3e2034135b4ade3a9bbcb999949e960c5039f7f098d';
const REFERENCE='c8614699dbd3959213212de72b4a97564c71331c2f7445ad412f0bd5c612451e';
const HASH='7ce77c9cacf09d2ff1accb09464a76bb3a1ca40844dcc132778977f63620b549';
const ADMITTED='const envelopeDigestScope=envelope&&rawText.length>=4096?hash.createCanonicalDigestScope(envelope):null;';
const FORMER='const envelopeDigestScope=envelope?hash.createCanonicalDigestScope(envelope):null;';
const sha=value=>createHash('sha256').update(value).digest('hex');
function once(source,before,after){assert.equal(source.split(before).length,2,'ENVELOPE_MEMO_FAULT_ANCHOR');return source.replace(before,after);}
const faults=[
 {fault:'admit-small-memo',oracle:'ENVELOPE_MEMO_FACTORY_ADMISSION_ORACLE',before:ADMITTED,after:FORMER},
 {fault:'omit-scope-wrapper',oracle:'ENVELOPE_MEMO_WRAPPER_ORACLE',before:'hash.withCanonicalDigestScope(envelopeDigestScope,()=>{result=callback();});',after:'if(envelopeDigestScope===null)result=callback();else hash.withCanonicalDigestScope(envelopeDigestScope,()=>{result=callback();});'},
 {fault:'omit-disposal',oracle:'ENVELOPE_MEMO_DISPOSAL_ORACLE',before:'finally{hash.disposeCanonicalDigestScope(envelopeDigestScope);}',after:'finally{}'}
];
async function exercise(fault=null){
 const current=fs.readFileSync('response-ingestion.js','utf8');
 assert.equal(sha(current),CURRENT,'ENVELOPE_MEMO_CURRENT_SOURCE');
 assert.equal(sha(fs.readFileSync('hash.js')),HASH,'ENVELOPE_MEMO_HASH_SOURCE');
 const base=once(current,ADMITTED,FORMER);assert.equal(sha(base),REFERENCE,'ENVELOPE_MEMO_REFERENCE_SOURCE');
 const injected=faults.find(row=>row.fault===fault);assert(!fault||injected,'ENVELOPE_MEMO_KNOWN_FAULT');
 const candidate=injected?once(current,injected.before,injected.after):current;
const fixed=Date.now();class FixedDate extends Date{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}}
const r=projectStoreRuntime({environment:{Date:FixedDate}}),f=await seed(r),h=r.runtime.closedLoopHash;
const plain=value=>JSON.parse(JSON.stringify(value));
const transport=r.copy({packageId:f.prompt.packageId,operationReservationId:f.prompt.operationReservationId,challengeNonce:f.prompt.challengeNonce});
const valid=stageOneResponseEnvelope(r,f.p,f.prompt),blocked=plain(valid);
Object.assign(blocked,{responseType:'BLOCKED',stageData:{},records:{},evidence:[],humanInputRequests:[],humanAuthorityCandidates:[],unresolved:[{temporaryKey:'memo-boundary',kind:'MISSING_APPLICATION_CONTEXT',description:'Synthetic unresolved filing context.',whyBlocking:'The requested filing cannot proceed without that context.',affectedStageFields:[],affectedRecords:[],blocking:true}],warnings:[],attachments:[]});
const compact=JSON.stringify(blocked);assert(compact.length<=2774,'ENVELOPE_MEMO_SMALL_FIXTURE_DOES_NOT_FIT');
const large=plain(valid);large.stageData.INPUT_SET_CONTENTS+=' '.repeat(65536);
const texts=new Map([...[2774,2775,2776,4095,4096,4097].map(length=>[String(length),compact+' '.repeat(length-compact.length)]),['large',JSON.stringify(large)],['invalid',JSON.stringify({...blocked,unknownDiagnosticKey:true})],['malformed','{"x":']]);
// Real canonical payload growth, not just whitespace outside the JSON value.
for(const length of [2775,4095,4096,4097,8192,16384]){
 const value=plain(blocked);value.unresolved[0].description+='X'.repeat(length-compact.length);
 const text=JSON.stringify(value);assert.equal(text.length,length);
 const canonical=h.stableStringify(r.copy(value));assert(canonical.includes(value.unresolved[0].description));
 texts.set('payload-'+length,text);
}
const originalProject=h.stableStringify(f.p),observations=[];
function load(source,hash=h){r.runtime.closedLoopHash=hash;try{vm.runInContext(source,r.runtime,{filename:'response-ingestion.js'});return r.runtime.closedLoopResponseIngestion;}finally{r.runtime.closedLoopHash=h;}}
function args(text){return {stage:1,text,promptRecord:f.prompt,transport};}
function captured(text){const ingestion=load(base);return ingestion.captureRaw(f.p,args(text));}
function runCaptured(source,input,{observe=false,throwHash=false}={}){
 const log={factory:0,wrappers:[],dispose:[]},sentinel={diagnosticHashFailure:true},probe=r.copy({owner:'outer-diagnostic-probe'}),outer=h.createCanonicalDigestScope(probe);assert(outer,'ENVELOPE_MEMO_OUTER_SCOPE_INELIGIBLE');
 const wrapped=observe?{...h,createCanonicalDigestScope(value){log.factory++;return h.createCanonicalDigestScope(value);},withCanonicalDigestScope(scope,callback){log.wrappers.push(scope===null);return h.withCanonicalDigestScope(scope,()=>{h.sha256Value(probe);return callback();});},disposeCanonicalDigestScope(scope){log.dispose.push(scope===null);return h.disposeCanonicalDigestScope(scope);},canonicalEnvelopeSha256(value){if(throwHash)throw sentinel;return h.canonicalEnvelopeSha256(value);}}:h;
 const ingestion=load(source,wrapped),before=h.stableStringify(input.project);let result,error;
 try{h.withCanonicalDigestScope(outer,()=>{h.sha256Value(probe);const warmed=h.canonicalDigestScopeStats(outer);assert.equal(warmed.entries,1,'ENVELOPE_MEMO_OUTER_PROBE_NOT_CACHED');const beforeHits=warmed.hits;try{result=ingestion.prepareCaptured(input.project,{rawResponseId:input.rawRecord.rawResponseId,promptRecord:f.prompt});}catch(caught){error=caught;}assert.equal(h.canonicalDigestScopeStats(outer).hits,beforeHits,'ENVELOPE_MEMO_AMBIENT_SCOPE_NOT_CLEARED');h.sha256Value(probe);assert.equal(h.canonicalDigestScopeStats(outer).hits,beforeHits+1,'ENVELOPE_MEMO_AMBIENT_SCOPE_NOT_RESTORED');});}
 finally{h.disposeCanonicalDigestScope(outer);r.runtime.closedLoopHash=h;}
 assert.equal(h.stableStringify(input.project),before,'ENVELOPE_MEMO_INPUT_MUTATED');
 if(throwHash)assert.equal(error,sentinel,'ENVELOPE_MEMO_EXACT_HASH_ERROR');else if(error)throw error;
 return {value:result??null,result,log};
}
for(const [label,text]of texts){
 const input=captured(text),a=runCaptured(base,input,{observe:true}),b=runCaptured(candidate,input,{observe:true});
 assert.deepEqual(b.value,a.value,'ENVELOPE_MEMO_COMPLETE_RESULT_PARITY '+label);
 if(!['invalid','malformed'].includes(label)){
  assert.equal(a.result.validation.valid,true,'ENVELOPE_MEMO_VALID_FIXTURE '+label+' '+JSON.stringify(a.result.validation.issues));
  assert.equal(a.log.wrappers.length,4);assert.equal(b.log.wrappers.length,4,'ENVELOPE_MEMO_WRAPPER_ORACLE');
  assert.equal(a.log.factory,1);assert.equal(b.log.factory,text.length>=4096?1:0,'ENVELOPE_MEMO_FACTORY_ADMISSION_ORACLE');
  assert.deepEqual(b.log.wrappers,Array(4).fill(text.length<4096));assert.deepEqual(b.log.dispose,[text.length<4096],'ENVELOPE_MEMO_DISPOSAL_ORACLE');
 }else assert.equal(a.result.validation.valid,false);
 observations.push({case:label,rawTextCodeUnits:text.length,deepResultValueParity:true,callerUnchanged:true,baseline:a.log,candidate:b.log});
}
for(const label of ['2775','2776','4095','4096']){const input=captured(texts.get(label));for(const [variant,source]of [['base',base],['candidate',candidate]]){const result=runCaptured(source,input,{observe:true,throwHash:true});assert.equal(result.log.wrappers.length,1);assert.equal(result.log.dispose.length,1);observations.push({case:'exact-error-'+label,variant,exactError:true,ambientRestored:true,disposed:true});}}
// Actual duplicate and already-pending routes, not manually manufactured receipts.
{const input=captured(texts.get('2775')),first=runCaptured(base,input).result,ingestion=load(base),retry=ingestion.captureRaw(first.project,args(texts.get('2775'))),a=runCaptured(base,retry),b=runCaptured(candidate,retry);assert.equal(a.result.duplicate,true);assert.deepEqual(b.value,a.value);observations.push({case:'genuine-duplicate',deepResultValueParity:true});const original={project:first.project,rawRecord:first.rawRecord};const x=runCaptured(base,original),y=runCaptured(candidate,original);assert.equal(x.result.idempotent,true);assert.deepEqual(y.value,x.value);observations.push({case:'genuine-idempotent',deepResultValueParity:true});}
// Fresh parsed-envelope mutation and changed-primitive fallback on a warmed
// genuine scope. These are new controls, not the unrecovered historical eight.
function mutatedOrFallback(source,input,mode){
 const before=h.stableStringify(input.project),nativeObject=vm.runInContext('Object',r.runtime),nativeKeys=nativeObject.keys;
 assert(source===base||source===candidate,'ENVELOPE_MEMO_NEGATIVE_VARIANT');assert.equal(typeof input.rawRecord.completeRawResponse,'string');
 const scopeExpected=source===base||input.rawRecord.completeRawResponse.length>=4096;
 let scope=null,factoryCalls=0,calls=0,keysCalls=0,firstDigest=null,observed=null;
 const wrapped={...h,createCanonicalDigestScope(value){factoryCalls++;scope=h.createCanonicalDigestScope(value);return scope;},canonicalEnvelopeSha256(value){
  calls++;
  if(calls!==2){const digest=h.canonicalEnvelopeSha256(value);if(calls===1)firstDigest=digest;return digest;}
  assert.equal(factoryCalls,scopeExpected?1:0,'ENVELOPE_MEMO_NEGATIVE_FACTORY_ADMISSION');
  assert.equal(scope!==null,scopeExpected,'ENVELOPE_MEMO_NEGATIVE_SCOPE_ADMISSION');
  const stats=scope?h.canonicalDigestScopeStats(scope):null;
  if(scope)assert(stats.entries>=1,'ENVELOPE_MEMO_MUTATION_SCOPE_NOT_WARM');
  if(mode==='mutation')value.unresolved[0].description+=' ACTUAL_PARSED_VALUE_MUTATION';
  else nativeObject.keys=function(...args){keysCalls++;return Reflect.apply(nativeKeys,this,args);};
  const expected=h.withCanonicalDigestScope(null,()=>h.canonicalEnvelopeSha256(value));
  const actual=h.canonicalEnvelopeSha256(value);
  assert.equal(actual,expected,'ENVELOPE_MEMO_FRESH_MUTATED_OR_FALLBACK_DIGEST');
  if(mode==='mutation')assert.notEqual(actual,firstDigest,'ENVELOPE_MEMO_MUTATION_NOT_EFFECTIVE');
  if(scope)assert.equal(h.canonicalDigestScopeStats(scope).hits,stats.hits,'ENVELOPE_MEMO_CHANGED_VALUE_OR_PRIMITIVE_REUSED');
  observed={mode,coldDigestMatched:true,warmedScope:!!scope,cacheHitRejected:scope?true:null};return actual;
 }};
 const ingestion=load(source,wrapped);let result;
 try{result=ingestion.prepareCaptured(input.project,{rawResponseId:input.rawRecord.rawResponseId,promptRecord:f.prompt});}
 finally{nativeObject.keys=nativeKeys;r.runtime.closedLoopHash=h;}
 assert(observed&&calls>=2,'ENVELOPE_MEMO_REAL_SECOND_HASH_SEAM');
 if(mode==='primitive')assert(keysCalls>0,'ENVELOPE_MEMO_REPLACED_KEYS_NOT_EXERCISED');
 assert.equal(h.stableStringify(input.project),before,'ENVELOPE_MEMO_MUTATION_CALLER_CHANGED');
 assert.equal(result.validation.valid,true,'ENVELOPE_MEMO_MUTATION_FIXTURE_INVALID');
 return {result,observed};
}
for(const label of ['payload-4095','payload-4096'])for(const mode of ['mutation','primitive']){
 const input=captured(texts.get(label)),a=mutatedOrFallback(base,input,mode),b=mutatedOrFallback(candidate,input,mode);
 assert.deepEqual(b.result,a.result,'ENVELOPE_MEMO_MUTATION_FALLBACK_RESULT_PARITY');
 observations.push({case:mode+'-'+label,deepResultValueParity:true,callerUnchanged:true,baseline:a.observed,candidate:b.observed});
}
assert.equal(h.stableStringify(f.p),originalProject);
// Factory invocation is optional below the admission floor. On an admitted
// path its original synchronous exception must retain identity.
for(const label of ['4095','4096']){
 const input=captured(texts.get(label)),before=h.stableStringify(input.project);
 for(const [variant,source]of [['base',base],['candidate',candidate]]){
  const sentinel={factoryFailure:true};let count=0,error=null,result=null;
  const ingestion=load(source,{...h,createCanonicalDigestScope(){count++;throw sentinel;}});
  try{result=ingestion.prepareCaptured(input.project,{rawResponseId:input.rawRecord.rawResponseId,promptRecord:f.prompt});}catch(caught){error=caught;}
  finally{r.runtime.closedLoopHash=h;}
  const expected=variant==='base'||Number(label)>=4096;
  assert.equal(count,expected?1:0,'ENVELOPE_MEMO_FACTORY_ERROR_ADMISSION');
  if(expected)assert.equal(error,sentinel,'ENVELOPE_MEMO_FACTORY_ERROR_IDENTITY');else{assert.equal(error,null);assert.equal(result.validation.valid,true);}
  assert.equal(h.stableStringify(input.project),before,'ENVELOPE_MEMO_FACTORY_ERROR_CALLER');
 }
 observations.push({case:'factory-error-'+label});
}
 const cases=observations.map(row=>({caseId:row.case+(row.variant?':'+row.variant:''),result:'PASS'}));
 assert.equal(cases.length,31,'ENVELOPE_MEMO_EXACT_POPULATION');assert.equal(new Set(cases.map(row=>row.caseId)).size,31,'ENVELOPE_MEMO_UNIQUE_POPULATION');
 assert.equal(sha(fs.readFileSync('response-ingestion.js')),CURRENT);assert.equal(sha(fs.readFileSync('hash.js')),HASH);
 return cases;
}

export async function verifyEnvelopeDigestAdmission(){
 const cases=await exercise(),detected=[];
 for(const row of faults){
  await assert.rejects(()=>exercise(row.fault),error=>error?.code==='ERR_ASSERTION'&&error.message.includes(row.oracle),'ENVELOPE_MEMO_SPECIFIC_FAULT '+row.fault);
  detected.push({fault:row.fault,oracle:row.oracle,detected:true});
 }
 return {schema:'envelope-digest-admission/1',checkId:'ingestion.envelope-digest-admission',result:'PASS',synthetic:true,actualBrowser:false,actualStorageAdapter:true,actualStorageWorker:false,fullClauseProof:false,thresholdCodeUnits:4096,sourceSha256:{'response-ingestion.js':CURRENT,'hash.js':HASH,'test-envelope-digest-admission.mjs':sha(fs.readFileSync(new URL(import.meta.url)))},referenceSourceSha256:REFERENCE,caseCount:cases.length,cases,faults:detected,aliasTopologyProven:false,historicalEightControls:'UNKNOWN',performanceClaim:false,optionalFactoryObservationEquivalent:false};
}
