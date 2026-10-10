import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {projectStoreRuntime,bindAcceptanceUi,bindHandoffReviewUiState} from './test-project-store-runtime.mjs';
import {routingFixture,completedReport} from './test-verification-routing-fixtures.mjs';
import {scalarFor,recordProposal,canonicalFixtureRecord,reviewApplicabilityFixture,reviewProofFixture,evidence,acceptPrerequisite,stage01AcceptanceFixture,boundedSearchProposal,registerFixtureSourceSearchCapability,stage04AcceptanceFixture} from './test-fixtures.mjs';

// Isolated projects, real production routing/runtime/commands and storage owners.
// The shared transaction and DOM adapters do not claim a live-browser replay.
const r=projectStoreRuntime(),t=r.runtime,e=r.engine,h=t.closedLoopHash,rt=t.closedLoopTestRuntime;
Object.assign(t,{engine:e,core:r.core,schema:t.closedLoopWorkflowSchema});
vm.runInContext([routingFixture,completedReport].map(fn=>fn.toString()).join('\n'),t);
const checks=[];
const verificationObservations=[];
const nativeProductControlsOnly=process.argv.includes('--native-product-controls-only');
const check=async(name,fn)=>{if(nativeProductControlsOnly&&!/^Stage (22|24) UI /.test(name))return;await fn();checks.push(name);};
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
await check('Section23 execution-route vocabulary and readiness',async()=>{
 // These distinct vocabularies are literal Section23 contracts. In particular,
 // EXTERNAL_AGENT is an operation executor, not an executionRoute value.
 const tuples=[
  ['APPLICATION_DETERMINISTIC','APPLICATION','APPLICATION','RUN_IN_APP',true],
  ['EXTERNAL_AGENT_TOOL','EXTERNAL_AGENT_TOOL','EXTERNAL_AGENT_TOOL','SEND_TO_TOOL_AGENT',true],
  ['INDEPENDENT_AGENT_REVIEW','INDEPENDENT_AI','INDEPENDENT_REVIEWER','SEND_TO_INDEPENDENT_REVIEWER',true],
  ['HUMAN_INSPECTION','HUMAN','HUMAN','HUMAN_INSPECTION',true],
  ['EXTERNAL_SYSTEM','EXTERNAL_SYSTEM','EXTERNAL_SYSTEM','USE_EXTERNAL_SYSTEM',true],
  ['UNAVAILABLE','BLOCKED','UNAVAILABLE','BLOCKED',false]
 ],observations=[];let capabilityBlockedControls=0;
 for(const [mode,route,executor,action,ready]of tuples){
  const f=t.routingFixture(mode);
  if(['EXTERNAL_AGENT_TOOL','EXTERNAL_SYSTEM'].includes(mode)){
   const missing=plan(f.p,f.test);
   assert.equal(missing.operatorAction,'BLOCKED','EXECUTION_ROUTE_CONTROL_ORACLE: missing capability must already block the operator.');
   assert.equal(missing.executionRoute,'BLOCKED','EXECUTION_ROUTE_READINESS_ORACLE: missing capability cannot publish an executable route.');
   capabilityBlockedControls++;
   await registerReport(f,t.completedReport(f.p,f.test));
  }
  const item=plan(f.p,f.test);
  assert.equal(item.executableNow,ready,'EXECUTION_ROUTE_READINESS_ORACLE: '+mode);
  assert.equal(item.executionRoute,route,'EXECUTION_ROUTE_VOCABULARY_ORACLE: '+mode);
  assert.equal(item.executorClass,executor,'EXECUTION_ROUTE_EXECUTOR_ORACLE: '+mode);
  assert.equal(item.operatorAction,action,'EXECUTION_ROUTE_ACTION_ORACLE: '+mode);
  observations.push({mode,executionRoute:item.executionRoute,executorClass:item.executorClass,operatorAction:item.operatorAction,executableNow:item.executableNow});
 }
 const unbound=t.routingFixture();unbound.test.fields.EXECUTABLE_INPUT_BINDINGS.JOB.canonicalKey='JOB.UNAVAILABLE_BOUND_VALUE';
 const blocked=plan(unbound.p,unbound.test);assert.equal(blocked.operatorAction,'BLOCKED');assert.equal(blocked.executionRoute,'BLOCKED','EXECUTION_ROUTE_READINESS_ORACLE: unavailable native input must have a blocked route.');
 verificationObservations.push({checkId:'routing.specification-route-vocabulary',expected:{modes:6,capabilityBlockedControls:2,nativeBindingBlockedControls:1},observed:{modes:observations.length,capabilityBlockedControls,nativeBindingBlockedControls:Number(blocked.executionRoute==='BLOCKED')},cases:observations,passed:true,synthetic:true,actualExternalCapability:false,actualBrowser:false});
});
// Controlled upstream canonical data isolates Stage06 readiness; proof and
// applicability approvals still pass through the production ingestion owner.
function stage06DesignFixture(mode){
 const schema=t.closedLoopWorkflowSchema,p=r.core.createBlankState('JOB-STAGE06-'+mode),runtime={engine:e,schema,prompts:r.prompts,ingestion:r.ingestion};
 Object.assign(p.job,{JOB_TITLE:'Future product test design',EXACT_USER_OBJECTIVE_VERBATIM:'Produce the required deliverable.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001',CURRENT_RESEARCH_VERSION:'RESEARCH-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001'});e.ensureShape(p);p.activeStage=6;
 for(let stage=1;stage<=5;stage++){p.stages[stage].status='COMPLETE';p.stages[stage].gate={complete:true,blocked:false,reasons:[]};}
 const scope={...e.currentScope(p),instructionVersion:null},req=canonicalFixtureRecord(runtime,p,'requirements',{...recordProposal(schema,'requirements').fields,MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE',OBLIGATION:'The delivered product contains required content.'},{scope});
 const prop=canonicalFixtureRecord(runtime,p,'propositions',{...recordProposal(schema,'propositions').fields,REQUIREMENT_ID:req.id,PROPOSITION_TEXT:'The delivered product contains required content.',STATUS:'CURRENT'},{scope,relationships:{REQUIREMENT_ID:req.id}});
 canonicalFixtureRecord(runtime,p,'applicabilityRecords',{...recordProposal(schema,'applicabilityRecords').fields,SUBJECT_ID:prop.id,PROPOSED_APPLICABILITY:'APPLICABLE'},{scope,relationships:{SUBJECT_ID:prop.id}});reviewApplicabilityFixture(runtime,p);
 Object.assign(p.job,{CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001'});
 const native=mode==='APPLICATION_DETERMINISTIC',test=canonicalFixtureRecord(runtime,p,'tests',{...recordProposal(schema,'tests').fields,REQ_ID:req.id,TARGET_PROPOSITION_IDS:[prop.id],EXECUTION_MODE:mode,REQUIRED_CAPABILITY:native?'CLOSED_LOOP_TEST_IR':'CAD_TOOL',EXECUTABLE_KIND:native?'TEST_IR':'NONE',EXECUTABLE_SPEC_VERSION:native?'closed-loop-test-spec/1':'NONE',EXECUTABLE_SPEC:native?{version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'FILE'},{op:'ASSERT_EQ',value:'Required content'}]}:{},EXECUTABLE_INPUT_BINDINGS:native?{FILE:{kind:'ARTIFACT',filename:'future.txt'}}:{},ARTIFACT_REQUIREMENTS:native?'Final product future.txt':'NONE',VERIFICATION_PHASE:'FINAL_PRODUCT_DETERMINISTIC',EARLIEST_EXECUTABLE_STAGE:22,REQUIRED_BY_STAGE:22,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:true,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{type:'PHASE_TARGET'}},{scope,relationships:{REQ_ID:req.id}});
 const node={type:'LEAF',testId:test.id,requiredDisposition:'SATISFIED',truthExtraction:'ACCEPTED_ENTAILMENT',evidenceClasses:['OBSERVATION_RECORD','ACCEPTED_ENTAILMENT'],scopeBinding:'CURRENT'};
 canonicalFixtureRecord(runtime,p,'proofExpressions',{TARGET_PROPOSITION_ID:prop.id,PROPOSED_EXPRESSION:node,NORMALIZED_EXPRESSION:node,SEMANTIC_RATIONALE:'Execution awaits the completed final product; the route and evidence remain required.'},{scope,relationships:{TARGET_PROPOSITION_ID:prop.id}});reviewProofFixture(runtime,p);
 return {p,test};
}
for(const mode of ['EXTERNAL_SYSTEM','EXTERNAL_AGENT_TOOL'])await check('Stage06 requires current scoped readiness for '+mode,async()=>{
 const f=stage06DesignFixture(mode);f.p.job.AVAILABLE_TOOLS='CAD_TOOL';
 const unavailable=e.gate(6,f.p);assert.equal(plan(f.p,f.test).capabilityReady,false);
 assert.equal(unavailable.complete,false,'STAGE06_CAPABILITY_COMPLETION_ORACLE: '+mode+' completed without current capability authority.');
 assert(unavailable.reasons.some(reason=>reason.includes('capability readiness')),'Stage06 does not explain its missing capability-readiness prerequisite.');
 verificationObservations.push({checkId:'stage06.capability.'+mode+'.unknown',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:2189','specification/closed-loop-reliability-controlling-implementation-specification.txt:2193'],boundary:'Stage06 required external route completion gate',expected:{complete:false,capabilityReady:false},observed:{complete:unavailable.complete,capabilityReady:plan(f.p,f.test).capabilityReady},passed:true,violation:'STAGE06_REQUIRED_EXTERNAL_CAPABILITY_UNKNOWN',accepted:false});
 await registerReport(f,t.completedReport(f.p,f.test));
 // Registration recalculates the controlled project; retain this fixture's
 // disclosed upstream prerequisites while evaluating the real Stage06 gate.
 for(let stage=1;stage<=5;stage++){f.p.stages[stage].status='COMPLETE';f.p.stages[stage].gate={complete:true,blocked:false,reasons:[]};}
 const ready=e.gate(6,f.p);assert.equal(plan(f.p,f.test).capabilityReady,true);assert.equal(ready.complete,true,JSON.stringify(ready));
 assert.equal(e.testDueState(f.p,f.test,6).executableNow,false,'Future product execution became due at Stage06.');
 verificationObservations.push({checkId:'stage06.capability.'+mode+'.ready',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:2176'],boundary:'Stage06 retained scoped external readiness with deferred future target',expected:{complete:true,capabilityReady:true,executionDue:false},observed:{complete:ready.complete,capabilityReady:plan(f.p,f.test).capabilityReady,executionDue:e.testDueState(f.p,f.test,6).executableNow},passed:true});
});
for(const mode of ['INDEPENDENT_AGENT_REVIEW','APPLICATION_DETERMINISTIC'])await check('Stage06 design preserves future-target timing for '+mode,()=>{
 const f=stage06DesignFixture(mode),actual=e.gate(6,f.p),route=plan(f.p,f.test),due=e.testDueState(f.p,f.test,6);
 assert.equal(actual.complete,true,'STAGE06_FUTURE_TARGET_DESIGN_ORACLE: '+mode+' '+JSON.stringify(actual));assert.equal(route.capabilityReady,true);assert.equal(due.executableNow,false);assert.equal(Boolean(f.p.job.CURRENT_PRODUCT_ID),false);
 if(mode==='APPLICATION_DETERMINISTIC')assert.equal(route.artifactReady,false,'Native future-artifact fixture unexpectedly acquired product bytes.');
 verificationObservations.push({checkId:'stage06.future-target.'+mode,requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:2176'],boundary:'Stage06 design gate before final product and artifact existence',expected:{complete:true,capabilityReady:true,executionDue:false},observed:{complete:actual.complete,capabilityReady:route.capabilityReady,executionDue:due.executableNow},passed:true});
});
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
bindHandoffReviewUiState(t,{source});Object.assign(t,{runSelection:{},selectedOperation:()=> 'COMPLETE'});
async function authorizeCapabilityDisclosure(targetId){
 const review=await r.store.prepareCapabilityRequestReview({project:t.current,targetId});assert.equal(review.authorization.blocked,false);
 await assert.rejects(()=>r.store.readAuthorizedCapabilityRequest({project:t.current,targetId}),error=>error.code==='HANDOFF_AUTHORIZATION_REQUIRED','CAPABILITY_REQUEST_DISCLOSURE_REQUIRED_ORACLE');
 const next=copy(t.current);e.recordHandoffAuthorization(next,{capabilityRequest:copy(review.capabilityRequest),members:copy(review.members),scan:copy(review.scan),purpose:'DISCLOSURE_AUTHORIZATION',recipient:'Synthetic readiness respondent',provider:'Isolated verification fixture',suitabilityBasis:'Only the controlled synthetic readiness inquiry is disclosed.',operatorLabel:'SYNTHETIC_FIXTURE_OPERATOR',confirmed:true});
 await t.persistReplacement(next,{expectedProjectRevision:t.current.revision});
}
vm.runInContext('let detailSequence=0;const detailViews=new Map();'+extract('function details(','function noticeText(')+extract('function logicalFilePath(','async function registerStageFiles(')+extract('let capabilityEvidenceDraft=','function testExecutionGuidanceMarkup(')+extract('function nativeStage22Tests(','async function runNativeDeferredTest('),t);
await check('Readiness selection keeps internal identities in bindings and advanced details',()=>{
 const html=t.externalCapabilityMarkup(e.testExecutionPlan(t.current).items),options=[...html.matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)];
 assert.equal(options.length,1);assert.equal(options[0][1],f.test.id,'The selected request must retain its exact canonical test binding.');
 assert.ok(!options[0][2].includes(f.test.id)&&!options[0][2].includes(e.recordValue(f.test,'REQUIRED_CAPABILITY')),'CAPABILITY_GUIDANCE_ORACLE: primary selection must hide internal test and capability identifiers.');
 assert.match(options[0][2],/Evidence needed/,'The operator must still see the readiness state.');
});
await check('Operator report upload, confirmation, and save survive a production storage reload',async()=>{
 controls.set('#capability-test',{value:f.test.id});await authorizeCapabilityDisclosure(f.test.id);await t.downloadCapabilityRequest();const request=JSON.parse(await t.downloads[0].blob.text()),template=request.reportTemplate;assert.equal(template.request.testId,f.test.id);assert(Object.values(template.checks).every(check=>check.status==='UNKNOWN'));
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
await check('A blocked capability is announced after actual report selection and confirmation',async()=>{
 const announcement=controls.get('#app-live-status')||{textContent:''};controls.set('#app-live-status',announcement);
 const priorAnnounce=t.announce,announceStart=source.indexOf('function announce('),announceEnd=source.indexOf('\nconst recordValue=',announceStart+1);
 assert(announceStart>=0&&announceEnd>announceStart);t.actionFailureNotice=null;vm.runInContext(source.slice(announceStart,announceEnd),t);
 try{
  const report=t.completedReport(t.current,f.test);report.checks.permissions.status='FALSE';
  const text=JSON.stringify(report),file=new Blob([text],{type:'application/json'});Object.defineProperty(file,'name',{value:'blocked-readiness.json'});
  await t.selectCapabilityEvidence(file);controls.set('#capability-operator',{value:'UI_FIXTURE_OPERATOR'});controls.set('#capability-confirm',{checked:true});
  await assert.rejects(()=>t.registerCapabilityEvidence(),error=>error.code==='MUTATION_REVIEW_SHOWN','CAPABILITY_REVOCATION_REVIEW_REQUIRED_ORACLE');assert(t.replacementReview?.next);await t.confirm();
  const persisted=await r.store.readProject(t.current.job.JOB_ID);assert.equal(plan(persisted,f.test).capabilityReady,false,'CAPABILITY_BLOCKED_LIVE_REGION_STATE_ORACLE');
  const record=persisted.projectData.externalCapabilities.at(-1),basis=JSON.parse(e.recordValue(record,'VERIFICATION_BASIS'));assert.equal(await (await r.store.getArtifact(basis.artifactId)).blob.text(),text);
  assert.match(announcement.textContent,/unresolved readiness checks still block execution/,'CAPABILITY_BLOCKED_LIVE_REGION_ORACLE');
 }finally{t.announce=priorAnnounce;}
});
await check('Stage02 file-first capability registration retains the actual report before independent adequacy review',async()=>{
 const searchRuntime={core:r.core,schema:t.closedLoopWorkflowSchema,engine:e,prompts:t.closedLoopPromptEngine,ingestion:t.closedLoopResponseIngestion},project=acceptPrerequisite(searchRuntime,stage01AcceptanceFixture(searchRuntime,'JOB-UI-SOURCE-SEARCH'),2,{stageData:{AUTHORITY_HIERARCHY:'No external authority applies to the controlled fixture.',SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE',KNOWN_CONTROLLING_SOURCES_EXAMINED:'The bounded closed fixture search found no applicable external source.'},records:{sourceSearchContracts:[boundedSearchProposal(searchRuntime.schema)]}}).project;project.activeStage=2;
 const initial=await r.store.writeProject(project,copy({expectedProjectRevision:0,createOnly:true,incrementRevision:false}));bindAcceptanceUi(r,initial,null);t.$=selector=>controls.get(selector)||null;
 const contract=e.recordsForCurrentScope(t.current,'sourceSearchContracts').at(-1),id=e.recordId(contract,'sourceSearchContracts');controls.set('#capability-test',{value:id});
 await authorizeCapabilityDisclosure(id);await t.downloadCapabilityRequest();const request=JSON.parse(await t.downloads.at(-1).blob.text()).reportTemplate;assert.equal(request.request.targetFamily,'sourceSearchContracts');assert.equal(request.request.sourceSearchContractId,id);assert.equal(Object.hasOwn(request.request,'testId'),false,'SOURCE_SEARCH_TYPED_TARGET_ORACLE: search must never invent a test.');
 const report=copy(registerFixtureSourceSearchCapability(searchRuntime,t.current,{register:false}));report.request=request.request;
 const text=JSON.stringify(report),file=new Blob([text],{type:'application/json'});Object.defineProperty(file,'name',{value:'search-readiness.json'});
 await t.selectCapabilityEvidence(file);controls.set('#capability-operator',{value:'UI_SEARCH_OPERATOR'});controls.set('#capability-confirm',{checked:true});await t.registerCapabilityEvidence();
 const saved=await r.store.readProject(t.current.job.JOB_ID),current=e.recordsForCurrentScope(saved,'sourceSearchContracts').at(-1),capability=e.recordsForCurrentScope(saved,'externalCapabilities').find(row=>e.recordId(row,'externalCapabilities')===e.recordValue(current,'SEARCH_PERFORMER_CAPABILITY_ID')),basis=JSON.parse(e.recordValue(capability,'VERIFICATION_BASIS')),bytes=await r.store.getArtifact(basis.artifactId);
 assert.equal(await bytes.blob.text(),text,'SOURCE_SEARCH_FILE_CUSTODY_ORACLE: retained report bytes must be exact');assert.equal(basis.retention,'VERIFIED_REPORT_ARTIFACT');assert.equal(e.sourceSearchCapabilityState(saved,current).complete,true);
 assert.equal(e.gate(2,saved).complete,false,'SOURCE_SEARCH_INDEPENDENT_REVIEW_ORACLE: capability registration must not waive the required adequacy review.');assert.equal(e.operationalNextAction(saved,2).operation,'SEARCH_ADEQUACY_REVIEW');
 const env=e.recordsForCurrentScope(saved,'environmentManifests').find(row=>e.recordId(row,'environmentManifests')===e.recordValue(capability,'ENVIRONMENT_MANIFEST_ID'));assert.equal(e.recordValue(env,'EVIDENCE_BASES').epistemicBasis,'OPERATOR_CONFIRMED_EXTERNAL_CLAIM');
 verificationObservations.push({checkId:'stage02.search-capability.file-first',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:606'],boundary:'Actual Stage02 request/file selection/store readback/operator authorization and current adequacy gate',expected:{targetFamily:'sourceSearchContracts',inventedTest:false,exactReportBytes:true,capabilityReady:true,oldReviewComplete:false,basis:'OPERATOR_CONFIRMED_EXTERNAL_CLAIM'},observed:{targetFamily:report.request.targetFamily,inventedTest:Object.hasOwn(report.request,'testId'),exactReportBytes:await bytes.blob.text()===text,capabilityReady:e.sourceSearchCapabilityState(saved,current).complete,oldReviewComplete:e.gate(2,saved).complete,basis:e.recordValue(env,'EVIDENCE_BASES').epistemicBasis},passed:true});
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
const nativeProductObservations=[];
await check('Stage 22 UI executes every ready native test once and excludes future or external work',async()=>{
 const runner=extract('async function runNativeProductTests(','async function runNativeDeferredTest('),firstOnly=runner.replace('const items=nativeProductTests(stage);','const items=nativeProductTests(stage).slice(0,1);');
 assert.notEqual(firstOnly,runner,'NATIVE_STAGE22_BATCH_FAULT_ANCHOR_ORACLE');
 const observations=[];
 for(const fault of [true,false]){
  const f=t.routingFixture(),definition=copy(f.test);
  const add=(label,changes)=>{const row=copy(definition),id=e.allocateId(f.p,'tests');row.id=row.recordId=id;row.fields.TEST_ID=row.TEST_ID=id;row.source='SYNTHETIC_NATIVE_BATCH_ROUTING_FIXTURE';for(const [key,value]of Object.entries(changes)){row.fields[key]=copy(value);row[key]=copy(value);}e.refreshRecordHashes(row,'tests');f.p.projectData.tests.push(row);return row;};
  const refuted=add('refuted',{EXECUTABLE_SPEC:{version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'JOB'},{op:'ASSERT_EQ',value:'CONTROLLED_DIFFERENT_PROJECT_ID'}]}});
  const future=add('future',{TEST_TYPE:'ADVERSARIAL',VERIFICATION_PHASE:'FINAL_PRODUCT_ADVERSARIAL',EARLIEST_EXECUTABLE_STAGE:24,REQUIRED_BY_STAGE:24});
  const external=add('external',{EXECUTION_MODE:'EXTERNAL_AGENT_TOOL',REQUIRED_CAPABILITY:'SYNTHETIC_UNAVAILABLE_EXTERNAL_TOOL',EXECUTABLE_KIND:'NONE',EXECUTABLE_SPEC_VERSION:'NONE',EXECUTABLE_SPEC:{},EXECUTABLE_INPUT_BINDINGS:{}});
  const expected=[{testId:f.test.id,determination:'SATISFIED'},{testId:refuted.id,determination:'VIOLATED'}].sort((a,b)=>a.testId.localeCompare(b.testId));
  await registerBytes(f.p,'Actual product bytes for the bounded multi-test routing fixture','product.json',{productId:f.product.id});
  const initial=await r.store.writeProject(f.p,copy({expectedProjectRevision:0,createOnly:true,incrementRevision:false}));t.current=initial;t.projects=copy([initial]);
  const selected=t.nativeStage22Tests().map(row=>row.testId).sort();assert.deepEqual(copy(selected),copy(expected.map(row=>row.testId).sort()),'NATIVE_STAGE22_READY_SET_ORACLE');
  assert(!selected.includes(future.id)&&!selected.includes(external.id),'NATIVE_STAGE22_NON_NATIVE_OR_FUTURE_ORACLE');
  const worker=t.Worker;const {isolatedVerifierWorkerClass}=await import('./verifier-runtime.mjs');const NativeWorker=isolatedVerifierWorkerClass();t.Worker=class extends NativeWorker{set onmessage(handler){this.receive=handler;}get onmessage(){return event=>this.receive?.({data:copy(event.data)});}};
  try{vm.runInContext(fault?firstOnly:runner,t);await t.runNativeProductTests(22);}finally{t.Worker=worker;vm.runInContext(runner,t);}
  const saved=await r.store.readProject(t.current.job.JOB_ID),observed=saved.projectData.deterministicResults.map(row=>({testId:String(e.recordValue(row,'TEST_ID')),determination:e.recordValue(row,'APPLICATION_DETERMINATION')})).sort((a,b)=>a.testId.localeCompare(b.testId));
  if(fault){assert.equal(observed.length,1,'NATIVE_STAGE22_BATCH_FAULT_SETUP_ORACLE');assert.throws(()=>assert.deepEqual(copy(observed),copy(expected),'NATIVE_STAGE22_ALL_READY_RESULTS_ORACLE'),/NATIVE_STAGE22_ALL_READY_RESULTS_ORACLE/);observations.push({caseId:'first-ready-only-controlled-fault',caughtAt:'NATIVE_STAGE22_ALL_READY_RESULTS_ORACLE',persistedResults:observed.length});continue;}
  assert.deepEqual(copy(observed),copy(expected),'NATIVE_STAGE22_ALL_READY_RESULTS_ORACLE');
  assert.equal(saved.projectData.adversarialResults.length,0,'NATIVE_STAGE22_FUTURE_RESULT_ORACLE');
  for(const row of saved.projectData.deterministicResults){assert.equal(row.stage,22);assert.equal(row.source,'APPLICATION_TEST_RUNTIME');}
  assert.equal(t.nativeStage22Tests().length,0,'NATIVE_STAGE22_ALREADY_EXECUTED_ORACLE');const before=h.sha256Value(saved);await t.runNativeProductTests(22);const repeated=await r.store.readProject(saved.job.JOB_ID);assert.equal(h.sha256Value(repeated),before,'NATIVE_STAGE22_RETRY_DUPLICATION_ORACLE');
  observations.push({caseId:'all-ready-native-results',expected,observed,futureTestId:future.id,externalTestId:external.id,noDuplicateRetry:true});
 }
 nativeProductObservations.push({checkId:'native-stage22-all-ready-batch',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:3586'],boundary:'Actual extracted UI runner -> isolated Test IR Worker -> application result recorder -> production transaction adapter store/read -> exact retry',expected:{readyNativeCount:2,outcomes:['SATISFIED','VIOLATED'],futureResults:0,externalResults:0,duplicateRetry:false,firstOnlyFaultDetected:true},observed:{readyNativeCount:2,outcomes:['SATISFIED','VIOLATED'],futureResults:0,externalResults:0,duplicateRetry:false,firstOnlyFaultDetected:true},cases:observations,passed:true,scopeLimit:'Explicit canonical routing fixture; no forced completed gates, prior-stage journey, actual browser, external tool or physical observation claimed.'});
});
await check('Stage 24 UI executes actual adversarial Test IR and owns only Stage 24 results and observations',async()=>{
 for(const outcome of ['SATISFIED','VIOLATED']){
  const f=t.routingFixture();f.p.activeStage=24;
  for(const [key,value]of Object.entries({TEST_TYPE:'ADVERSARIAL',VERIFICATION_PHASE:'FINAL_PRODUCT_ADVERSARIAL',EARLIEST_EXECUTABLE_STAGE:24,REQUIRED_BY_STAGE:24})) {f.test.fields[key]=value;f.test[key]=value;}
  if(outcome==='VIOLATED'){f.test.fields.EXECUTABLE_SPEC.steps[1].value='CONTROLLED_DIFFERENT_PROJECT_ID';f.test.EXECUTABLE_SPEC=f.test.fields.EXECUTABLE_SPEC;}
  e.refreshRecordHashes(f.test,'tests');await registerBytes(f.p,'Actual final product bytes','product.json',{productId:f.product.id});
  const initial=await r.store.writeProject(f.p,copy({expectedProjectRevision:0,createOnly:true,incrementRevision:false}));t.current=initial;t.projects=copy([initial]);
  assert.equal(t.nativeProductTests(24).length,1,'NATIVE_STAGE24_ROUTE_ORACLE: the declared native adversarial operation must have one runnable test.');
  const worker=t.Worker;const {isolatedVerifierWorkerClass}=await import('./verifier-runtime.mjs');const NativeWorker=isolatedVerifierWorkerClass();t.Worker=class extends NativeWorker{set onmessage(handler){this.receive=handler;}get onmessage(){return event=>this.receive?.({data:copy(event.data)});}};
  try{
   if(outcome==='SATISFIED'){
    const runner=extract('async function runNativeProductTests(','async function runNativeDeferredTest('),fault=runner.replace("  if(!schema.NATIVE_PRODUCT_RESULT_CONTRACTS[stage]","  if(stage!==22)return;\n  if(!schema.NATIVE_PRODUCT_RESULT_CONTRACTS[stage]");assert.notEqual(fault,runner,'The controlled original Stage22-only UI dispatch must bind to its execution owner.');
    vm.runInContext(fault,t);await t.runNativeProductTests(24);const rejected=await r.store.readProject(t.current.job.JOB_ID);assert.throws(()=>assert(rejected.projectData.adversarialResults.length,'NATIVE_STAGE24_RESULT_ORACLE: missing persisted adversarial result'),/NATIVE_STAGE24_RESULT_ORACLE/,'Original Stage22-only dispatch must fail the final result oracle for its intended reason.');vm.runInContext(runner,t);
   }
   await t.runNativeProductTests(24);
  }finally{t.Worker=worker;}
  const saved=await r.store.readProject(t.current.job.JOB_ID),result=saved.projectData.adversarialResults.at(-1),observation=saved.projectData.observationRecords.at(-1),binding=JSON.parse(e.recordValue(observation,'RAW_OR_NATIVE_PROVENANCE'));
  assert(result,'NATIVE_STAGE24_RESULT_ORACLE: the UI must persist an actual adversarial result.');assert.equal(result.stage,24);assert.equal(e.recordValue(result,'APPLICATION_DETERMINATION'),outcome);assert.equal(e.effectiveDetermination('adversarialResults',result,f.test,saved),outcome);const gate=e.gate(24,saved);assert.equal(gate.reasons.some(reason=>/Adversarial reviewer independence is not established|accepted response is required|Adversarial verification found/.test(reason)),outcome==='VIOLATED','NATIVE_STAGE24_GATE_ORACLE: native results must use their actual outcome and current application provenance.');
  assert.equal(saved.projectData.deterministicResults.length,0);assert.equal(observation.stage,24);assert.equal(binding.stage,24);assert.equal(binding.resultCollection,'adversarialResults');assert.equal(binding.resultId,result.id);
  let currentProofStatus=null,changedTestProofStatus=null;if(outcome==='VIOLATED'){const proofSubject=copy({id:'SYNTHETIC-NATIVE-PROOF-CONSUMER'}),consumer=copy({id:'SYNTHETIC-NATIVE-ENTAILMENT',stage:24,active:true,scope:e.currentScope(saved),fields:{TARGET_PROPOSITION_ID:proofSubject.id,OBSERVATION_ID:observation.id,ACCEPTED_STATUS:'ACCEPTED',ACCEPTED_RELATION:'REFUTES'}});saved.projectData.entailmentReviews.push(consumer);currentProofStatus=e.propositionState(saved,proofSubject).status;assert.equal(currentProofStatus,'VIOLATED');const altered=copy(saved);altered.projectData.tests[0].fields.EXECUTABLE_SPEC.steps[1].value='A_CHANGED_TEST';altered.projectData.tests[0].EXECUTABLE_SPEC=altered.projectData.tests[0].fields.EXECUTABLE_SPEC;e.refreshRecordHashes(altered.projectData.tests[0],'tests');changedTestProofStatus=e.propositionState(altered,proofSubject).status;assert.equal(changedTestProofStatus,'UNDETERMINED','NATIVE_STAGE24_CURRENTNESS_ORACLE: changed executable semantics must revoke proof consumer authority.');}
  nativeProductObservations.push({checkId:'native-stage24-'+outcome.toLowerCase(),requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:3603'],boundary:'actual UI runner → isolated Test IR worker → application result/proof observation → project storage reload',expected:{stage:24,resultCollection:'adversarialResults',determination:outcome,deterministicResultCount:0,currentProofStatus:outcome==='VIOLATED'?'VIOLATED':null,changedTestProofStatus:outcome==='VIOLATED'?'UNDETERMINED':null},observed:{stage:result.stage,resultCollection:binding.resultCollection,determination:e.recordValue(result,'APPLICATION_DETERMINATION'),deterministicResultCount:saved.projectData.deterministicResults.length,currentProofStatus,changedTestProofStatus},passed:true,...(outcome==='VIOLATED'?{violation:'exact project identity assertion',accepted:false}:{})});
 }
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
console.log(JSON.stringify({verificationRouting:'PASS',focusedNativeProductControls:nativeProductControlsOnly,verificationObservations:[...verificationObservations,...nativeProductObservations],checks:checks.length,results:checks,basis:'ISOLATED_PRODUCTION_ROUTING_RUNTIME_UI_COMMANDS_AND_STORAGE_ADAPTER'}));
