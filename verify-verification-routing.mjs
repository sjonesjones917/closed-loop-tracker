import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {projectStoreRuntime,bindAcceptanceUi} from './test-project-store-runtime.mjs';
import {routingFixture,completedReport} from './test-verification-routing-fixtures.mjs';
import {scalarFor,recordProposal} from './test-fixtures.mjs';

// Isolated projects, real production routing/runtime/commands and storage owners.
// The shared transaction and DOM adapters do not claim a live-browser replay.
const r=projectStoreRuntime(),t=r.runtime,e=r.engine,h=t.closedLoopHash,rt=t.closedLoopTestRuntime;
Object.assign(t,{engine:e,core:r.core,schema:t.closedLoopWorkflowSchema});
vm.runInContext([routingFixture,completedReport].map(fn=>fn.toString()).join('\n'),t);
const checks=[];
const check=async(name,fn)=>{await fn();checks.push(name);};
const copy=r.copy;
const plan=(p,test)=>e.testExecutionPlan(p).items.find(row=>row.testId===test.id);
const execute=async({p,test,canonical})=>rt.execute(copy({spec:e.recordValue(test,'EXECUTABLE_SPEC'),canonicalBindings:{JOB:canonical},metadata:{testId:test.id,bindings:e.recordValue(test,'EXECUTABLE_INPUT_BINDINGS')}}));
const native=t.routingFixture();
await check('Canonical-only test validates, plans, executes, and records without a file',async()=>{
 assert.equal(rt.validateSpec(e.recordValue(native.test,'EXECUTABLE_SPEC'),e.recordValue(native.test,'EXECUTABLE_INPUT_BINDINGS')).valid,true);
 assert.equal(rt.supports(native.test),true);assert.equal(plan(native.p,native.test).executableNow,true);
 const result=await execute(native);assert.equal(result.determination,'SATISFIED');
 const saved=e.recordApplicationDeterministicResult(native.p,copy({testId:native.test.id,productId:native.product.id,runtimeResult:result,inputArtifacts:[]}));
 assert.equal(e.recordValue(saved,'APPLICATION_DETERMINATION'),'SATISFIED');
 assert.equal(JSON.parse(e.recordValue(native.p.projectData.evidenceRecords.at(-1),'APPLICATION_EVIDENCE_CONTENT')).inputCanonicalIdentities[0].valueSha256,native.canonical.valueSha256);
 assert.equal(native.p.projectData.observationRecords.at(-1).source,'APPLICATION_TEST_RUNTIME');
});
async function registerBytes(p,text,filename='evidence.json',lineage={}){
 const artifactId=e.allocateId(p,'artifacts'),blob=new Blob([text],{type:'application/json'}),sha256=await h.sha256Bytes(blob);
 const stored=await r.store.putArtifact({artifactId,jobId:p.job.JOB_ID,blob,filename,mediaType:blob.type,expectedSha256:sha256});
 e.registerArtifactBytes(p,copy({artifactId,filename,mediaType:blob.type,byteSize:blob.size,sha256,lineage}));return stored;
}
await check('Unrelated artifacts never change canonical-value resolution',async()=>{
 const f=t.routingFixture();await registerBytes(f.p,'a','unrelated-a.txt');await registerBytes(f.p,'b','unrelated-b.txt');
 assert.equal(plan(f.p,f.test).executableNow,true);assert.equal(plan(f.p,f.test).artifactIds.length,0);
});
for(const kind of ['missing-key','inherited-key','changed-value','wrong-hash'])await check(`Planner and execution both reject ${kind}`,()=>{
 const f=t.routingFixture(),binding=f.test.fields.EXECUTABLE_INPUT_BINDINGS.JOB;
 if(kind==='missing-key')binding.canonicalKey='JOB.UNKNOWN';else if(kind==='inherited-key')binding.canonicalKey='__proto__';else if(kind==='changed-value')f.p.job.JOB_ID+='-CHANGED';else binding.valueSha256='0'.repeat(64);
 assert.equal(plan(f.p,f.test).executableNow,false);assert.throws(()=>e.resolveTestInputBinding(f.p,f.test,'JOB',binding),/unavailable|stale/);
});
await check('Runtime rejects a changed value even when its wrapper repeats the old hash',async()=>{
 const f=t.routingFixture();f.canonical.value+='-CHANGED';await assert.rejects(()=>execute(f),error=>error.code==='CANONICAL_HASH_MISMATCH');
});
for(const kind of ['missing-receipt','wrong-key','wrong-hash','changed-project'])await check(`Result commit rejects ${kind} atomically`,async()=>{
 const f=t.routingFixture(),result=await execute(f);
 if(kind==='missing-receipt')delete result.inputCanonicalIdentities;else if(kind==='wrong-key')result.inputCanonicalIdentities[0].canonicalKey='JOB.CURRENT_PRODUCT_ID';else if(kind==='wrong-hash')result.inputCanonicalIdentities[0].valueSha256='0'.repeat(64);else f.p.job.JOB_ID+='-CHANGED';
 const before=h.sha256Value(f.p);assert.throws(()=>e.recordApplicationDeterministicResult(f.p,copy({testId:f.test.id,productId:f.product.id,runtimeResult:result,inputArtifacts:[]})),/canonical|stale/);assert.equal(h.sha256Value(f.p),before);
});
await check('Artifact inputs retain exact custody, ambiguity, and expected-hash checks',async()=>{
 const f=t.routingFixture(),file=await registerBytes(f.p,'one','input.json'),binding=copy({kind:'ARTIFACT',filename:file.filename,expectedSha256:file.sha256});
 assert.equal(e.resolveTestInputBinding(f.p,f.test,'FILE',binding).artifact.id,file.artifactId);
 binding.expectedSha256='0'.repeat(64);assert.throws(()=>e.resolveTestInputBinding(f.p,f.test,'FILE',binding),/stale/);delete binding.expectedSha256;
 await registerBytes(f.p,'two','input.json');assert.throws(()=>e.resolveTestInputBinding(f.p,f.test,'FILE',binding),/2 current artifacts/);
 binding.artifactId=file.artifactId;f.p.projectData.artifacts.find(row=>row.id===file.artifactId).fields.AVAILABILITY='MISSING';assert.throws(()=>e.resolveTestInputBinding(f.p,f.test,'FILE',binding),/verified/);
});
await check('Mixed canonical and file inputs run with the same resolver',async()=>{
 const f=t.routingFixture(),file=await registerBytes(f.p,'same','input.json');f.test.fields.EXECUTABLE_INPUT_BINDINGS.FILE=copy({kind:'ARTIFACT',artifactId:file.artifactId,expectedSha256:file.sha256});
 assert.equal(plan(f.p,f.test).executableNow,true);
 const payload=copy({spec:f.test.fields.EXECUTABLE_SPEC,artifacts:{FILE:{artifactId:file.artifactId,filename:file.filename,sha256:file.sha256}},canonicalBindings:{JOB:f.canonical},metadata:{testId:f.test.id,bindings:f.test.fields.EXECUTABLE_INPUT_BINDINGS}});payload.artifacts.FILE.bytes=new Uint8Array(await file.blob.arrayBuffer());const result=await rt.execute(payload);
 const saved=e.recordApplicationDeterministicResult(f.p,copy({testId:f.test.id,productId:f.product.id,runtimeResult:result,inputArtifacts:[{artifactId:file.artifactId,filename:file.filename,byteSize:file.blob.size,sha256:file.sha256}]}));assert.equal(saved.source,'APPLICATION_TEST_RUNTIME');
});
const external=t.routingFixture('EXTERNAL_AGENT_TOOL');
const report=t.completedReport(external.p,external.test);
async function registerReport(f,report,options={}){
 const reportText=JSON.stringify(report),file=await registerBytes(f.p,reportText);
 return e.registerExternalCapabilityEvidence(f.p,copy({reportText,artifactId:file.artifactId,operatorConfirmed:true,operatorLabel:'FIXTURE_OPERATOR',...options}));
}
await check('External tool names and uncompleted templates cannot establish readiness',()=>{
 external.p.job.AVAILABLE_TOOLS='CAD_TOOL';assert.equal(plan(external.p,external.test).capabilityReady,false);
 const template=e.externalCapabilityEvidenceTemplate(external.p,external.test.id);assert(Object.values(template.checks).every(check=>check.status==='UNKNOWN'));
 assert.throws(()=>e.validateExternalCapabilityEvidence(external.p,template),/required/);
});
await check('Retained evidence and genuine operator confirmation establish scoped readiness',async()=>{
 const record=await registerReport(external,report);assert.equal(e.recordValue(record,'CAPABILITY_READY'),true);assert.equal(plan(external.p,external.test).capabilityReady,true);
 assert.equal(external.p.projectData.humanDecisions.at(-1).source,'HUMAN_DECISION_COMMAND');
 assert.equal(e.recordValue(external.p.projectData.environmentManifests.at(-1),'EVIDENCE_BASES').epistemicBasis,'OPERATOR_CONFIRMED_EXTERNAL_CLAIM');
});
for(const key of ['authorization','permissions','inputs','route','evidence'])for(const value of ['FALSE','UNKNOWN'])await check(`${key}=${value} cannot unblock external verification`,async()=>{
 const f=t.routingFixture('EXTERNAL_SYSTEM'),report=t.completedReport(f.p,f.test);report.checks[key].status=value;
 await registerReport(f,report);assert.equal(plan(f.p,f.test).capabilityReady,false);
});
for(const kind of ['cross-project','changed-test','expired','future-observation','unknown-risk','empty-evidence','application-field'])await check(`Registration rejects ${kind} without committing authority`,async()=>{
 const f=t.routingFixture('EXTERNAL_AGENT_TOOL'),report=t.completedReport(f.p,f.test);
 if(kind==='cross-project')report.request.jobId='OTHER';else if(kind==='changed-test')f.test.fields.TEST_PROPOSITION_TEXT='Different target';else if(kind==='expired')report.validUntil=new Date(Date.now()-1000).toISOString();else if(kind==='future-observation')report.observedAt=new Date(Date.now()+60000).toISOString();else if(kind==='unknown-risk')report.action.riskClasses=copy(['UNKNOWN']);else if(kind==='empty-evidence')report.checks.route.evidence='';else report.CAPABILITY_READY=true;
 assert.throws(()=>e.validateExternalCapabilityEvidence(f.p,report),/stale|required|expiry|observation|risk|unrecognized/);assert.equal(f.p.projectData.externalCapabilities.length,0);
});
for(const kind of ['not-confirmed','missing-bytes','altered-bytes'])await check(`Registration rejects ${kind}`,async()=>{
 const f=t.routingFixture('EXTERNAL_SYSTEM'),report=t.completedReport(f.p,f.test),reportText=JSON.stringify(report),file=kind==='missing-bytes'?{artifactId:'MISSING'}:await registerBytes(f.p,reportText);
 const before=h.sha256Value(f.p);assert.throws(()=>e.registerExternalCapabilityEvidence(f.p,copy({reportText:reportText+(kind==='altered-bytes'?' ':''),artifactId:file.artifactId,operatorConfirmed:kind!=='not-confirmed',operatorLabel:'FIXTURE_OPERATOR'})),/authorize|verified/);assert.equal(h.sha256Value(f.p),before);
});
for(const kind of ['test-changed','scope-changed','bytes-unavailable','authorization-withdrawn','report-tampered'])await check(`Saved readiness is revoked when ${kind}`,()=>{
 const f={p:copy(external.p),test:external.test};
 if(kind==='test-changed')f.p.projectData.tests[0].fields.TEST_PROPOSITION_TEXT='Changed';else if(kind==='scope-changed')f.p.job.CURRENT_INPUT_VERSION='NEXT';else if(kind==='bytes-unavailable')f.p.projectData.artifacts[0].fields.AVAILABILITY='MISSING';else if(kind==='authorization-withdrawn')f.p.projectData.humanDecisions[0].active=false;else f.p.projectData.environmentManifests[0].fields.EXTERNAL_CLAIMS.environment='Other environment';
 assert.equal(e.evaluateCapabilityReadiness(f.p,'CAD_TOOL','EXTERNAL_AGENT_TOOL',f.p.projectData.tests[0]).ready,false);
});
await check('A newer failed observation supersedes the old successful observation',async()=>{
 const f={p:copy(external.p),test:external.test},report=t.completedReport(f.p,f.test);report.checks.permissions.status='FALSE';await registerReport(f,report);assert.equal(plan(f.p,f.test).capabilityReady,false);
});

// Actual UI handlers, including retained report bytes, the operator confirmation,
// canonical result recording and the production project compare-and-swap write.
const f=t.routingFixture('EXTERNAL_SYSTEM');
const initial=await r.store.writeProject(f.p,copy({expectedProjectRevision:0,createOnly:true,incrementRevision:false}));
bindAcceptanceUi(r,initial,null);
const controls=new Map();Object.assign(t,{$:selector=>controls.get(selector)||null,recordValue:e.recordValue,downloads:[],downloadBlob:(blob,filename)=>t.downloads.push({blob,filename}),esc:value=>String(value).replace(/[<>&"]/g,'_'),details:(_label,value)=>JSON.stringify(value),stagePlanItems:(stage,operation)=>e.stageTestExecutionPlan(t.current,{stage,operation}).items,reportActionFailure:error=>{throw error;}});
const source=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8'),extract=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start+a.length);assert(start>=0&&end>start);return source.slice(start,end);};
vm.runInContext('let detailSequence=0;const detailViews=new Map();'+extract('function details(','function noticeText(')+extract('function logicalFilePath(','async function registerStageFiles(')+extract('let capabilityEvidenceDraft=','function testExecutionGuidanceMarkup(')+extract('function nativeStage22Tests(','async function runNativeDeferredTest('),t);
await check('Readiness selection keeps internal identities in bindings and advanced details',()=>{
 const html=t.externalCapabilityMarkup(e.testExecutionPlan(t.current).items),options=[...html.matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)];
 assert.equal(options.length,1);assert.equal(options[0][1],f.test.id,'The selected request must retain its exact canonical test binding.');
 assert.ok(!options[0][2].includes(f.test.id)&&!options[0][2].includes(e.recordValue(f.test,'REQUIRED_CAPABILITY')),'CAPABILITY_GUIDANCE_ORACLE: primary selection must hide internal test and capability identifiers.');
 assert.match(options[0][2],/Evidence needed/,'The operator must still see the readiness state.');
});
await check('Operator report upload, confirmation, and save survive a production storage reload',async()=>{
 controls.set('#capability-test',{value:f.test.id});t.downloadCapabilityRequest();const template=JSON.parse(await t.downloads[0].blob.text());assert.equal(template.request.testId,f.test.id);
 const report=t.completedReport(t.current,f.test),file=new Blob([JSON.stringify(report)],{type:'application/json'});Object.defineProperty(file,'name',{value:'readiness.json'});
 await t.selectCapabilityEvidence(file);const html=t.externalCapabilityMarkup(e.testExecutionPlan(t.current).items);assert.match(html,/capability-confirm/);
 const review=html.match(/<strong>(Review[^<]*)<\/strong>/)?.[1];assert.ok(review&&!review.includes(f.test.id),'CAPABILITY_REVIEW_ORACLE: the authorization heading must identify the external test without exposing its internal ID.');
 assert.ok(!/<details\b[^>]*\bopen\b/.test(html),'CAPABILITY_DISCLOSURE_ORACLE: raw report and capability identifiers must start behind closed details.');
 for(const value of [report.environment,report.action.target,report.request.purpose,report.action.expectedEffect,report.action.maximumCost,report.validUntil])assert.ok(html.includes(t.esc(value)),'Required authorization context must remain visible.');
 assert.equal(vm.runInContext("[...detailViews.values()].find(row=>row.title==='Readiness evidence and action boundaries').value.request.testId",t),f.test.id,'Advanced evidence must retain the exact request identity.');
 await assert.rejects(()=>t.registerCapabilityEvidence(),/confirm/);
 controls.set('#capability-operator',{value:'UI_FIXTURE_OPERATOR'});controls.set('#capability-confirm',{checked:true});await t.registerCapabilityEvidence();
 const persisted=await r.store.readProject(t.current.job.JOB_ID);assert.equal(plan(persisted,f.test).capabilityReady,true);
 const record=persisted.projectData.externalCapabilities.at(-1),basis=JSON.parse(e.recordValue(record,'VERIFICATION_BASIS')),bytes=await r.store.getArtifact(basis.artifactId);assert.equal(await bytes.blob.text(),JSON.stringify(report));
});
await check('Stage 22 UI discovers, executes, and persists the canonical-only test',async()=>{
 const f=t.routingFixture();await registerBytes(f.p,'Completed product bytes','product.json',{productId:f.product.id});const initial=await r.store.writeProject(f.p,copy({expectedProjectRevision:0,createOnly:true,incrementRevision:false}));t.current=initial;t.projects=copy([initial]);
 assert.equal(t.nativeStage22Tests().length,1,JSON.stringify({activeStage:t.current.activeStage,productId:t.current.job.CURRENT_PRODUCT_ID,plan:e.testExecutionPlan(t.current),selection:e.finalProductTestSelection(t.current,22)}));const inputs=await t.nativeTestInputs(f.test,t.current);assert.equal(Object.keys(inputs.artifactPayload).length,0);assert.equal(inputs.canonicalPayload.JOB.value,t.current.job.JOB_ID);
 // executeTest runs via the existing isolated verifier worker in its own suite;
 // use actual runtime execution here, preserving the production UI call boundary.
 const worker=t.Worker;const {isolatedVerifierWorkerClass}=await import('./verifier-runtime.mjs');const NativeWorker=isolatedVerifierWorkerClass();t.Worker=class extends NativeWorker{set onmessage(handler){this.receive=handler;}get onmessage(){return event=>this.receive?.({data:copy(event.data)});}};
 try{await t.runNativeStage22Tests();}finally{t.Worker=worker;}
 const persisted=await r.store.readProject(t.current.job.JOB_ID);assert.equal(e.recordValue(persisted.projectData.deterministicResults.at(-1),'APPLICATION_DETERMINATION'),'SATISFIED');
});
// Reuse the existing Stage 06 response fixture and unchanged ingestion owners.
// This verifies canonical input import; the separately quoted import failure
// cannot be identified from an audit excerpt that omits its reproduction.
const ingestionSource=fs.readFileSync('verify-ingestion.mjs','utf8');t.prompts=r.prompts;
vm.runInContext([scalarFor,recordProposal].map(fn=>fn.toString()).join('\n')+ingestionSource.slice(ingestionSource.indexOf('function prepareStage4Upstream('),ingestionSource.indexOf('// Cross-field timing')),t);
await check('Canonical-value bindings survive response validation and commit',()=>{
 const result=vm.runInContext(`(()=>{
  const p=project('JOB-CANONICAL-IMPORT'),pr=saveAttachmentPrompt(p,6),envelope=validEnvelope(p,6,pr),entry=engine.canonicalTestBindingCatalog(p)['JOB.JOB_ID'];
  envelope.stageData={};envelope.records={tests:[recordProposal(schema,'tests',{tempKey:'canonical',overrides:{EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:'CLOSED_LOOP_TEST_IR',EXECUTABLE_KIND:'TEST_IR',EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/1',EXECUTABLE_INPUT_BINDINGS:{JOB:{kind:'CANONICAL_VALUE',canonicalKey:'JOB.JOB_ID',valueSha256:entry.valueSha256}},EXECUTABLE_SPEC:{version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'JOB'},{op:'ASSERT_EQ',value:p.job.JOB_ID}]},ARTIFACT_REQUIREMENTS:'NONE'}})]};
  const prepared=ingestion.prepare(p,{...returnedTransport(pr),stage:6,text:JSON.stringify(envelope),promptRecord:pr});if(!prepared.validation.valid)throw new Error(JSON.stringify(prepared.validation.issues));
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'SYNTHETIC_IMPORT_OPERATOR'}),test=committed.project.projectData.tests.at(-1);
  envelope.records.externalCapabilities=[{tempKey:'forged',fields:{CAPABILITY_CLAIM:'CAD_TOOL',AUTHORIZED:true,PERMISSIONS_READY:true,INPUTS_TRANSFERABLE:true,ROUTE_USABLE:true,EVIDENCE_OBTAINABLE:true},relationships:{},evidenceRefs:[]}];
  const forged=ingestion.prepare(p,{...returnedTransport(pr),stage:6,text:JSON.stringify(envelope),promptRecord:pr});
  return {binding:engine.recordValue(test,'EXECUTABLE_INPUT_BINDINGS').JOB,expectedSha256:entry.valueSha256,forgedValid:forged.validation.valid,forgedIssues:forged.validation.issues};
 })()`,t);
 assert.equal(result.binding.kind,'CANONICAL_VALUE');assert.equal(result.binding.valueSha256,result.expectedSha256);assert.equal(result.forgedValid,false);assert(result.forgedIssues.some(issue=>issue.path.includes('externalCapabilities')));
});
console.log(JSON.stringify({verificationRouting:'PASS',checks:checks.length,results:checks,basis:'ISOLATED_PRODUCTION_ROUTING_RUNTIME_UI_COMMANDS_AND_STORAGE_ADAPTER'}));
