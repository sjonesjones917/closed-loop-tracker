import {bindArtifactFixture,projectStoreRuntime,captureArtifactFixture,restoreArtifactFixture,bindAcceptanceUi,storageBroadcastNetwork,hydrateRetainedPromptContexts} from './test-project-store-runtime.mjs';
import {artifactFixtureId} from './test-artifact-fixtures.mjs';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import fs from 'node:fs';
import {readStoreArchive} from './test-zip.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {responseFixture,OBJECTIVE,OUTPUT,CANDIDATE,COUNTERPART_FAULT_CASES} from './operator-journey-fixtures.mjs';
import {registerFixtureSourceSearchCapability,recordProposal} from './test-fixtures.mjs';
globalThis.dispatchEvent=()=>true;
const injectedFault=process.env.CLRT_COUNTERPART_FAULT||null;
const diagnosticPrefixDir=process.env.CLRT_COUNTERPART_DIAGNOSTIC_PREFIX_DIR||null;
const diagnosticPrefixInput=process.env.CLRT_COUNTERPART_DIAGNOSTIC_PREFIX_INPUT||null;
assert(!diagnosticPrefixInput,'The checked-in diagnostic mode creates the complete Stage7 prefix from current inputs; resumption is a separate scratch-only verifier mode.');
assert(!(diagnosticPrefixDir&&injectedFault),'Diagnostic prefix generation and deliberate fault injection are separate verifier modes.');
const runtimeSources={};
const initialOwnerFaults=['reopened-initial-root-cause-by-later-defect','reopened-initial-regression-by-later-defect','reopened-initial-correction-by-later-defect'];
const counterpartFaults={
  'missing-source-search-registration':{skipSourceSearchRegistration:true},
  'missing-retained-prompt-context':{skipPromptContextCapture:true},
  'missing-candidate-bytes':{skipFixtureFile:'CANDIDATE-FILE'},
  'missing-product-bytes':{skipFixtureFile:'PRODUCT-FILE'},
  'fractional-stability':{from:'const snapshot=clone(stability),denominator=Number(snapshot.runCount||0);',to:'return stability; const snapshot=clone(stability),denominator=Number(snapshot.runCount||0);'},
  'missing-defect-gate':{from:'if(defectRequired&&!defectIds.length)',to:'if(false&&defectRequired&&!defectIds.length)'},
  'unrelated-defect-reason':{from:"' has prohibited variance or a violated result without a DEFECT_IDS handoff.'",to:"' has an unrelated prerequisite failure.'"},
  'reopened-initial-root-cause-by-later-defect':{from:'requireAccepted();const analysis=initialDefectAnalysis(project),defects=analysis.defects,analysed=new Set(analysis.rootCauses.map',to:'requireAccepted();const analysis=initialDefectAnalysis(project),defects=confirmedDefects(project),analysed=new Set(analysis.rootCauses.map'},
  'reopened-initial-regression-by-later-defect':{from:'case 15:{requireAccepted();const analysis=initialDefectAnalysis(project),defects=analysis.defects,regs=analysis.regressions',to:'case 15:{requireAccepted();const analysis=initialDefectAnalysis(project),defects=confirmedDefects(project),regs=analysis.regressions'},
  'reopened-initial-correction-by-later-defect':{from:'const analysis=initialDefectAnalysis(project),defects=analysis.defects,stageChanges=analysis.changes,coveredDefects=new Set();',to:'const analysis=initialDefectAnalysis(project),defects=confirmedDefects(project),stageChanges=analysis.changes,coveredDefects=new Set();'},
  'partial-verification-completes-operation':{from:"if(out.has('VERIFY')){const matrix=verificationMatrix(project,selectedIteration);",to:"if(false&&out.has('VERIFY')){const matrix=verificationMatrix(project,selectedIteration);"}
};
assert.deepEqual(Object.keys(counterpartFaults).sort(),COUNTERPART_FAULT_CASES.map(([fault])=>fault).sort(),'COUNTERPART_FAULT_POPULATION_ORACLE: every current injected fault must belong to the declared closed population.');
assert(!injectedFault||counterpartFaults[injectedFault],'COUNTERPART_FAULT_ID_ORACLE: unknown fault');
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js']){
  let source=fs.readFileSync(file,'utf8');
  if(file==='workflow-engine.js'&&injectedFault&&counterpartFaults[injectedFault].from){
    const fault=counterpartFaults[injectedFault];
    assert.equal(source.split(fault.from).length-1,1,'COUNTERPART_FAULT_ANCHOR_ORACLE: exactly one current owning condition is required');
    const mutated=source.replace(fault.from,fault.to);
    assert.notEqual(mutated,source,'COUNTERPART_FAULT_APPLIED_ORACLE: injection must change executable source');
    source=mutated;
  }
  runtimeSources[file]=source;
  createVerifierRuntime.loadScript(globalThis,source,{filename:file});
}
const byteStore=await bindArtifactFixture([]);
const engine=closedLoopWorkflowEngine,schema=closedLoopWorkflowSchema,prompts=closedLoopPromptEngine,ingestion=closedLoopResponseIngestion,hash=closedLoopHash;
let p=diagnosticPrefixInput?JSON.parse(fs.readFileSync(diagnosticPrefixInput,'utf8')).project:closedLoopCore.createBlankState('COUNTERPART-CONTRACT-PREFLIGHT');if(!diagnosticPrefixInput){p.job.JOB_TITLE='Complete operator journey';p.job.EXACT_USER_OBJECTIVE_VERBATIM=OBJECTIVE;}engine.ensureShape(p);engine.recalculate(p);
const value=engine.recordValue,id=engine.recordId,latest=family=>engine.recordsForCurrentScope(p,family).at(-1),cases=[],retainedContextFiles=new Map();
async function retainFixtureFile(label,filename,text){
  if(counterpartFaults[injectedFault]?.skipFixtureFile===label)return;
  await byteStore.putArtifact({jobId:p.job.JOB_ID,artifactId:artifactFixtureId(engine,p,label),filename,mediaType:'text/plain',blob:new Blob([text],{type:'text/plain'})});
}

// Optional synthetic fixture mode emits legitimate accepted prefixes for the
// existing deferred-operation verifier. It does not change runtime behavior.
const diagnosticPrefixFiles=[];
const sourceFingerprints=Object.fromEntries(['workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','test-fixtures.mjs','operator-journey-fixtures.mjs','app-core.js'].map(file=>[file,hash.sha256Text(fs.readFileSync(file,'utf8'))]));
sourceFingerprints['verify-operator-counterpart.mjs']=hash.sha256Text(fs.readFileSync(import.meta.filename,'utf8'));
if(diagnosticPrefixInput){
  const recovered=JSON.parse(fs.readFileSync(diagnosticPrefixInput,'utf8'));
  assert.equal(engine.gate(7,p).complete,true,'DIAGNOSTIC_PREFIX_RECOVERY_ORACLE: input must be a legitimate completed Stage7 prefix');
  await restoreArtifactFixture(byteStore,recovered.artifacts);
  for(const file of recovered.contextFiles||[])retainedContextFiles.set(file.sha256,file);
}
function exportedDiagnosticRows(args,family){
  const blocks=[];
  for(const file of args.contextFiles||[])for(const block of JSON.parse(Buffer.from(file.bytes).toString('utf8')).members||[])blocks.push(block);
  for(const match of args.instructionBytes.toString('utf8').matchAll(/BEGIN_UNTRUSTED_DATA_BLOCK\s*([\s\S]*?)\s*END_UNTRUSTED_DATA_BLOCK/g))blocks.push(JSON.parse(match[1]));
  const block=blocks.find(row=>row.sourceIdentity==='collection.'+family);return block?JSON.parse(block.value).records:[];
}
function diagnosticActor(args){
  const response=responseFixture(args);
  if(!diagnosticPrefixDir)return response;
  const rows=family=>exportedDiagnosticRows(args,family),stage=Number(args.prompt.stage),operation=args.prompt.operation;
  // A negative-only diagnostic is not the mandatory positive per-run/final
  // product proposition. Select the actual declared target from exported rows.
  if(operation==='VERIFY'){
    const test=rows('tests').find(row=>value(row,'VERIFICATION_PHASE')==='PREPRODUCT_ITERATION'&&value(row,'TEST_ROLE')!=='NEGATIVE_ONLY'&&value(row,'PER_RUN_REQUIRED')===true);
    assert(test,'DIAGNOSTIC_VERIFY_TARGET_ORACLE');const testId=id(test,'tests');
    for(const row of response.records.verification||[])row.relationships.TEST_ID={recordId:testId};
    for(const row of response.records.observationRecords||[])row.relationships.SUBJECT_ID={recordId:testId};
  }
  if(stage===24&&operation==='COMPLETE'){
    const test=rows('tests').find(row=>value(row,'TEST_TYPE')==='ADVERSARIAL'&&value(row,'FINAL_PRODUCT_REQUIRED')===true);
    assert(test,'DIAGNOSTIC_ADVERSARIAL_TARGET_ORACLE');for(const row of response.records.adversarialResults||[])if(row.relationships?.TEST_ID)row.relationships.TEST_ID={recordId:id(test,'tests')};
  }
  if(stage===6&&operation==='COMPLETE'){
    const specimen=response.records.tests[0],future=structuredClone(specimen);future.tempKey='conditional-literal-rejection';
    Object.assign(future.fields,{TEST_TYPE:'ADVERSARIAL',TEST_ROLE:'NEGATIVE_ONLY',TEST_PROPOSITION_TEXT:'The deliberately malformed eight-byte output must fail exact comparison with VERIFIED plus LF.',TESTED_SCOPE:'Disposable clone of the current literal-output fixture only.',POSITIVE_RESULT_MEANING:'The invalid eight-byte fixture is rejected; the conforming nine-byte control matches.',NEGATIVE_RESULT_MEANING:'The invalid fixture is accepted or a conforming control is rejected.',EXPECTED_RESULT:'REJECT',VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:8,REQUIRED_BY_STAGE:30,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:false,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{type:'PHASE_TARGET'}});
    response.records.tests.unshift(future);
  }
  if(stage===7&&operation==='COMPLETE'||stage===15&&operation==='COMPLETE'){
    const test=rows('tests').find(row=>value(row,'TEST_ROLE')==='NEGATIVE_ONLY');assert(test,'DIAGNOSTIC_ACCEPTED_TEST_ORACLE');
    const req=rows('requirements').find(row=>id(row,'requirements')===String(value(test,'REQ_ID')));assert(req,'DIAGNOSTIC_TYPED_REQUIREMENT_ORACLE');
    const relationships={REQ_ID:{recordId:id(req,'requirements')},EXECUTION_TEST_ID:{recordId:id(test,'tests')}};
    if(stage===7)response.records.failureTests.push(recordProposal(schema,'failureTests',{tempKey:'conditional-future-failure',overrides:{VIOLATION_MODE:'MISSING_REQUIRED_TERMINAL_LF',FIXTURE:'VERIFIED',EXPECTED_REJECTION:'REJECT',ACTUAL_RESULT:'NOT_RUN',EXECUTION_OUTCOME:'NOT_RUN',VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:8,REQUIRED_BY_STAGE:30,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:false,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{type:'PHASE_TARGET'},EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',REQUIRED_CAPABILITY:'INDEPENDENT_AGENT_REVIEW'},relationships}));
    else{
      const defect=rows('defects').find(row=>String(value(row,'REQ_ID'))===id(req,'requirements'));assert(defect,'DIAGNOSTIC_OBSERVED_INITIAL_DEFECT_ORACLE');
      relationships.DEFECT_ID={recordId:id(defect,'defects')};
      response.records.regressions.unshift(recordProposal(schema,'regressions',{tempKey:'conditional-future-regression',overrides:{FAILURE_FIXTURE:'VERIFIED',REPRODUCTION_PROCEDURE:'Execute the supplied diagnostic comparison against the preserved accepted eight-byte failed output.',DETECTION_METHOD:'Actual disposable complete-byte comparison',CORRECTION:'Preserve the required terminal LF.',PERMANENT_TEST_LOCATION:'Synthetic current regression registry',APPLICABILITY:'APPLICABLE',VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:16,REQUIRED_BY_STAGE:30,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:false,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{type:'PHASE_TARGET'},EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',REQUIRED_CAPABILITY:'INDEPENDENT_AGENT_REVIEW'},relationships}));
    }
  }
  return response;
}
async function diagnosticPackage(stage,operation){
  const r=projectStoreRuntime({sourceOverrides:runtimeSources});
  await restoreArtifactFixture(r.store,await captureArtifactFixture(byteStore,p.job.JOB_ID));
  const state=r.copy(p);await hydrateRetainedPromptContexts(r,state,[...retainedContextFiles.values()]);
  let saved=await r.store.writeProject(state,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
  const draft=r.copy(saved),prompt=r.prompts.reserveAndBuildPromptRecord(draft,stage,{operation}).prompt;
  const materialized=r.prompts.materializePromptContextFiles(prompt,draft);for(const file of materialized)retainedContextFiles.set(file.sha256,structuredClone(file));
  const impact=r.store.mutationImpact(saved,draft);saved=await r.store.writeProject(draft,{expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256,...(impact.requiresConfirmation?{mutationConfirmation:impact}:{})});
  const pkg=await r.store.createExecutionPackage({jobId:saved.job.JOB_ID,stage:prompt.stage,operation:prompt.operation,instructionId:prompt.instructionId}),members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer())),member=path=>{const row=members.find(row=>row.canonicalPath===path);assert(row,'DIAGNOSTIC_PACKAGE_MEMBER_ORACLE '+path);return Buffer.from(row.bytes);};
  const manifest=JSON.parse(member('manifest.json').toString('utf8')),instructionBytes=member('instruction.txt');assert.equal(instructionBytes.toString('utf8'),prompt.prompt);
  const contextFiles=manifest.contextFiles.map(file=>{const bytes=member(file.path);assert.equal(bytes.length,file.byteSize);assert.equal(hash.sha256Text(bytes.toString('utf8')),file.sha256);return {filename:file.path,bytes};});
  assert.equal(manifest.operationReservationId,prompt.operationReservationId);assert.equal(manifest.challengeNonce,prompt.challengeNonce);
  console.error(JSON.stringify({phase:'diagnostic-definition-actual-package',stage:prompt.stage,operation:prompt.operation,packageId:manifest.packageId,instructionId:prompt.instructionId}));
  p=structuredClone(await r.store.readProject(saved.job.JOB_ID));
  return {schema,engine,prompt:structuredClone(prompt),manifest,instructionBytes,contextFiles};
}
async function emitDiagnosticPrefix(stage){
  if(!diagnosticPrefixDir)return;
  const number=Number(stage);assert(number>=8&&number<=30);for(let prior=1;prior<number;prior++)assert.equal(engine.gate(prior,p).complete,true,'DIAGNOSTIC_PREFIX_PREREQUISITE_ORACLE '+prior+' -> '+number);
  fs.mkdirSync(diagnosticPrefixDir,{recursive:true});const file=diagnosticPrefixDir+'/prefix-stage'+String(number).padStart(2,'0')+'.json';if(diagnosticPrefixFiles.includes(file))return;
  const r=projectStoreRuntime({sourceOverrides:runtimeSources});await restoreArtifactFixture(r.store,await captureArtifactFixture(byteStore,p.job.JOB_ID));const state=r.copy(p);state.activeStage=number;await hydrateRetainedPromptContexts(r,state,[...retainedContextFiles.values()]);
  await r.store.writeProject(state,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});const saved=await r.store.readProject(state.job.JOB_ID);assert.equal(r.store.validateProjectIntegrity(saved).valid,true);
  const failure=engine.records(p,'failureTests').find(row=>String(value(row,'EXECUTION_TEST_ID')||'').trim()),regression=engine.records(p,'regressions').find(row=>String(value(row,'EXECUTION_TEST_ID')||'').trim());assert(failure,'DIAGNOSTIC_PREFIX_FAILURE_DEFINITION_ORACLE');
  fs.writeFileSync(file,JSON.stringify({schema:'closed-loop-counterpart-diagnostic-prefix/1',sourceCommit:process.env.GITHUB_SHA||null,sourceFingerprints,entryStage:number,completedPriorStages:number-1,project:saved,artifacts:await captureArtifactFixture(r.store,saved.job.JOB_ID),contextFiles:[...retainedContextFiles.values()],definitionId:id(failure,'failureTests'),testId:value(failure,'EXECUTION_TEST_ID'),regressionId:regression?id(regression,'regressions'):null,synthetic:true,actualBrowser:false,earlierCompleteFlagsForced:false}));
  diagnosticPrefixFiles.push(file);console.error(JSON.stringify({phase:'diagnostic-prefix-stored-read-emitted',entryStage:number,file,projectSha256:saved.projectSha256,definitionId:id(failure,'failureTests'),regressionId:regression?id(regression,'regressions'):null}));
}
function diagnosticOrdinaryAction(stage){
  const external=operation=>{assert.equal(schema.STAGE_OPERATION_REGISTRY[stage+':'+operation]?.executorClass,'EXTERNAL_AGENT','DIAGNOSTIC_ORDINARY_REGISTRY_ORACLE');return {actionType:'EXTERNAL_AGENT_TOOL',operation,explicitOrdinarySelection:true};},native=actionType=>({actionType,explicitNativeControl:true});
  if([8,9,14,15,16,23,24,25].includes(stage))return external(({14:'ROOT_CAUSE',16:'CORRECT'})[stage]||schema.STAGE_CONTRACTS[stage].operations[0]);
  if(stage===10)return native('FREEZE_CANDIDATE');if(stage===11)return external('EXECUTE_RUN');if(stage===12)return external('VERIFY');if(stage===13)return external('COMPARE');
  if(stage===17||stage===19){
    const iteration=engine.records(p,'iterations').filter(row=>Number(row.stage)===stage).at(-1);if(!iteration)return native(stage===17?'FREEZE_CANDIDATE':'BEGIN_UNCHANGED_CONFIRMATION');const iterationId=id(iteration,'iterations'),runs=engine.recordsForIteration(p,'runs',iterationId);if(!runs.length)return native('RESERVE_RUN_BATCH');
    const accepted=engine.acceptedChanges(p,stage).filter(row=>String(row.scope?.iterationId||'')===iterationId),done=new Set(accepted.filter(row=>row.operation==='EXECUTE_RUN').map(row=>row.scope?.runId));if(runs.some(row=>!done.has(id(row,'runs'))))return external('EXECUTE_RUN');
    const operations=engine.acceptedOperationSet(p,stage,{iterationId}),sequence=stage===17?['VERIFY','COMPARE','ROOT_CAUSE','REGRESSION','CORRECT']:['VERIFY','COMPARE','REGRESSION_VERIFY'],operation=sequence.find(operation=>!operations.has(operation));if(operation)return external(operation);
    if(stage===19)return native('CALCULATE_UNCHANGED_CONFIRMATION');throw new Error('DIAGNOSTIC_ORDINARY_NEGATIVE_GATE: completed operations do not establish Stage17 completion '+JSON.stringify(engine.gate(stage,p).reasons));
  }
  if(stage===18)return native('CALCULATE_CONVERGENCE');if(stage===20)return native('FREEZE_BASELINE');
  if(stage===21){if(!engine.records(p,'freshContexts').some(row=>Number(row.stage)===21))return native('REGISTER_PRODUCTION_CONTEXT');if(!engine.records(p,'products').length)return native('RESERVE_PRODUCT_EXECUTION');return external(schema.STAGE_CONTRACTS[stage].operations[0]);}
  if(stage===22)return native('RUN_APP_TESTS');
  if(stage===26){const policy=schema.SEMANTIC_STAGE_OPERATIONS[stage],author=engine.acceptedChanges(p,stage).filter(row=>policy.authorOperations.includes(row.operation)).at(-1);return external(author?policy.reviewOperations[0]:policy.authorOperations[0]);}
  if(stage===27)return native('CALCULATE_RELEASE');if(stage===28)return native('FREEZE_DELIVERY_CANDIDATE');if(stage===29)return native('BUILD_EVIDENCE_CHAINS');throw new Error('No ordinary fixture control for Stage '+stage);
}

// Fixture preflight only. Actual interface and file transport acceptance remains
// the separate verify-complete-operator-journey.mjs browser execution.
const stageLimit=Number(process.env.CLRT_COUNTERPART_STAGE_LIMIT||(diagnosticPrefixDir?7:30));
assert(Number.isInteger(stageLimit)&&stageLimit>=1&&stageLimit<=30);
assert(!diagnosticPrefixDir||stageLimit===7,'The checked-in diagnostic mode emits exactly the verified Stage7 prefix; ordinary verification still supports all30 stages.');
// SCRATCH DRAFT ONLY. Intended insertion in existing verify-operator-counterpart.mjs.
// Existing COMPLETE controls remain intact. All inputs below come from the
// legitimate main lifecycle immediately before Stage07 / Stage15 admission.
async function verifyOwningStageExecution(stage, operation) {
  assert([7,15].includes(stage));
  assert.equal(engine.gate(stage-1,p).complete,true,
    'OWNER_EXECUTION_PREREQUISITE_ORACLE: actual accepted upstream work is required');
  assert.equal(schema.STAGE_OPERATION_REGISTRY[stage+':'+operation].deferredSubjectFamily,null,
    'Owner-stage execution is not a later-stage deferred definition receipt');
  const original=hash.sha256Value(p), artifacts=await captureArtifactFixture(byteStore,p.job.JOB_ID);
  const originalContexts=[...retainedContextFiles.values()];
  for(const variant of ['definition-only','executed-control']) {
    const r=projectStoreRuntime({sourceOverrides:runtimeSources}),{store,copy}=r,e=r.engine,pr=r.prompts,i=r.ingestion,s=r.runtime.closedLoopWorkflowSchema;
    await restoreArtifactFixture(store,artifacts);
    const input=copy(p);input.activeStage=stage;e.recalculate(input);
    await hydrateRetainedPromptContexts(r,input,originalContexts);
    let saved=await store.writeProject(input,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
    const draft=copy(saved),reserved=pr.reserveAndBuildPromptRecord(draft,stage,{operation}).prompt;
    saved=await store.writeProject(draft,{expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});
    const prompt=saved.projectData.generatedPrompts.find(row=>row.instructionId===reserved.instructionId);
    assert(prompt,'OWNER_EXECUTION_INSTRUCTION_ORACLE: saved current instruction is missing');
    const pkg=await store.createExecutionPackage({jobId:saved.job.JOB_ID,stage,operation,instructionId:prompt.instructionId});
    const members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer()));
    const member=path=>{const row=members.find(row=>row.canonicalPath===path);assert(row,'Missing exact exported member '+path);return Buffer.from(row.bytes);};
    const manifest=JSON.parse(member('manifest.json').toString('utf8')),instructionBytes=member('instruction.txt');
    assert.equal(instructionBytes.toString('utf8'),prompt.prompt);
    assert.equal(manifest.operation,operation);assert.equal(manifest.stage,stage);
    assert.equal(manifest.promptIdentity.instructionId,prompt.instructionId);
    assert.equal(manifest.operationReservationId,prompt.operationReservationId);
    assert.equal(manifest.packageId,prompt.packageId);assert.equal(manifest.challengeNonce,prompt.challengeNonce);
    const contextFiles=manifest.contextFiles.map(file=>{
      const bytes=member(file.path);assert.equal(bytes.length,file.byteSize);assert.equal(hash.sha256Text(bytes.toString('utf8')),file.sha256);
      return {filename:file.path,bytes};
    });
    // These two current fixtures are inline exact-text comparisons. They do
    // not claim that absent optional attachments or other files were received.
    assert(!manifest.attachmentSlots.some(slot=>slot.required&&slot.role!=='STRUCTURED_RESPONSE'),
      'OWNER_EXECUTION_OUTPUT_FILE_ORACLE: a required returned file needs its actual bytes');
    const envelope=responseFixture({schema:s,engine:e,prompt,manifest,contextFiles,instructionBytes});
    assert.equal(envelope.operation,operation);assert.deepEqual(envelope.scope,manifest.scope);
    const observedFixture=stage===7?envelope.records.failureTests[0].fields.FIXTURE:envelope.records.regressions[0].fields.FAILURE_FIXTURE;
    const expectedBytes=Buffer.from(OUTPUT,'utf8'),fixtureBytes=Buffer.from(observedFixture,'utf8');
    const conforming=bytes=>Buffer.from(bytes).equals(expectedBytes);
    assert.equal(conforming(expectedBytes),true,'The conforming comparison control must pass');
    assert.equal(conforming(fixtureBytes),false,'The preserved missing-LF fixture must actually violate the literal requirement');
    if(stage===7) {
      // Closed outcome comes from the published contract and Section32.2,
      // while the expected gate result is independently fixed by execution.
      assert(instructionBytes.toString('utf8').includes('REJECTED_INVALID'));
      envelope.records.failureTests[0].fields.EXECUTION_OUTCOME=variant==='definition-only'?'NOT_RUN':'REJECTED_INVALID';
      envelope.records.failureTests[0].fields.ACTUAL_RESULT=variant==='definition-only'?'NOT_RUN':'REJECTED';
    } else if(variant==='definition-only') {
      // Valid definition alone is admissible but must not complete Stage15.
      envelope.records.regressionExecutions=[];
    }
    envelope.evidence[0].content=JSON.stringify({synthetic:true,stage,operation,variant,
      expectedUtf8Base64:expectedBytes.toString('base64'),fixtureUtf8Base64:fixtureBytes.toString('base64'),
      executionAsserted:variant==='executed-control',
      observation:variant==='executed-control'?'Executed a disposable exact-byte comparison; invalid fixture differs from required bytes.':'Definition-only control; this response asserts no execution.',
      independence:'No real external actor, human independence or physical-device observation asserted.'});
    const text=JSON.stringify(envelope),staged=await store.stageResponseFile({jobId:saved.job.JOB_ID,stage,
      blob:new Blob([text],{type:'application/json'}),rawFilename:'response.json',mediaType:'application/json',
      promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce});
    const file=await store.readStagedResponseFile({jobId:saved.job.JOB_ID,stagingId:staged.stagingId});
    assert.equal(new TextDecoder('utf-8',{fatal:true}).decode(file.bytes),text);
    const captured=i.captureRaw(saved,{stage,text,promptRecord:prompt,transport:{authority:'AUTHORITATIVE_RESPONSE_FILE',
      stagingId:staged.stagingId,rawFilename:'response.json',mediaType:'application/json',status:file.status,
      sha256:file.sha256,byteSize:file.byteSize,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,
      operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce}});
    saved=await store.writeProject(captured.project,{operational:true,expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});
    const prepared=i.prepareCaptured(saved,{rawResponseId:captured.rawRecord.rawResponseId});
    assert.equal(prepared.validation.valid,true,'OWNER_EXECUTION_ADMISSION_ORACLE: '+JSON.stringify(prepared.validation.issues));
    assert.equal(prepared.proposal.status,'PENDING_OPERATOR_REVIEW');
    assert.equal(prepared.project.projectData.acceptedChanges.length,input.projectData.acceptedChanges.length,'Preparation accepted work early');
    saved=await store.writeProject(prepared.project,{operational:true,expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});
    const committed=i.commit(saved,prepared.proposal.proposalId,{operator:'SYNTHETIC_OWNER_EXECUTION_CONTROL'});
    const impact=store.mutationImpact(saved,committed.project);
    saved=await store.writeProject(committed.project,{expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256,...(impact.requiresConfirmation?{mutationConfirmation:impact}:{})});
    const reloaded=await store.readProject(saved.job.JOB_ID),accepted=e.acceptedChanges(reloaded,stage).find(row=>row.proposalId===prepared.proposal.proposalId);
    assert.equal(accepted.operation,operation);assert.equal(i.findRaw(reloaded,captured.rawRecord.rawResponseId).completeRawResponse,text);
    assert.equal(store.validateProjectIntegrity(reloaded).valid,true);
    const gate=e.gate(stage,reloaded),expectedComplete=variant==='executed-control';
    assert.equal(gate.complete,expectedComplete,'OWNER_EXECUTION_GATE_ORACLE: '+stage+':'+operation+' '+variant+' '+JSON.stringify(gate.reasons));
    if(!expectedComplete)assert(gate.reasons.some(reason=>stage===7?/failure test is not conclusively executed/.test(reason):/pre-correction failing execution/.test(reason)),
      'OWNER_EXECUTION_NEGATIVE_REASON_ORACLE: incompleteness must concern the omitted execution');
    const duplicate=i.commit(reloaded,prepared.proposal.proposalId,{operator:'SYNTHETIC_OWNER_EXECUTION_CONTROL'});
    assert.equal(duplicate.idempotent,true);assert.equal(duplicate.project.projectData.acceptedChanges.length,reloaded.projectData.acceptedChanges.length);
    assert.equal(hash.sha256Value(p),original,'OWNER_EXECUTION_ISOLATION_ORACLE: disposable cases changed the main lifecycle');
    cases.push({caseId:'owner-execution-'+stage+'-'+variant,stage,operation,result:'PASS',synthetic:true,actualBrowser:false,
      observedBoundary:'saved package bytes -> staged response bytes -> prepareCaptured -> operator commit -> production store/readback -> actual stage gate',
      expectedComplete,actualComplete:gate.complete,canonicalIdsApplicationAssigned:true,mainLifecycleUnchanged:true});
  }
}

// Initial analysis belongs to its active Stage10 subject; later defects must
// remain adverse in their own iteration without reopening completed owners.
function verifyInitialAnalysisOwners(r,saved){
  const {engine:e,prompts:pr,copy}=r,v=e.recordValue,rid=e.recordId,initial=e.records(saved,'iterations').filter(row=>Number(row.stage)===10).at(-1),initialId=rid(initial,'iterations');
  assert(initialId,'STAGE17_INITIAL_OWNER_ORACLE: active initial iteration required');
  for(const stage of [14,15,16])assert.equal(e.gate(stage,saved).complete,true,'STAGE17_INITIAL_OWNER_ORACLE: Stage '+stage+' must retain its legitimate initial subject');
  assert.equal(saved.job.CURRENT_STAGE,'STAGE 17','STAGE17_INITIAL_OWNER_ORACLE: canonical current stage must stay17');
  assert.equal(e.gate(17,saved).complete,false);assert.equal(e.operationalNextAction(saved,17).operation,'ROOT_CAUSE');
  const initialRows=family=>e.recordsForIteration(saved,family,initialId),defectIds=new Set(initialRows('defects').map(row=>rid(row,'defects'))),regIds=new Set(initialRows('regressions').map(row=>rid(row,'regressions')));
  assert(defectIds.size&&regIds.size,'STAGE17_INITIAL_OWNER_CONTROL: original observed defect and permanent definition required');
  for(const [caseId,family,remove,stage,reason] of [
    ['initial-rca-still-required','rootCauses',row=>defectIds.has(String(v(row,'DEFECT_ID'))),14,/Root-cause|RCA/],
    ['initial-pre-correction-execution-still-required','regressionExecutions',row=>regIds.has(String(v(row,'REG_ID')))&&String(v(row,'PHASE'))==='PRE_CORRECTION',15,/pre-correction failing execution/],
    ['initial-changeset-still-required','changes',row=>Number(row.stage)===16,16,/correction is missing|changeset trace/]
  ]){
    const project=copy(saved),before=project.projectData[family].length;project.projectData[family]=project.projectData[family].filter(row=>!remove(row));assert(project.projectData[family].length<before);e.recalculate(project);
    const gate=e.gate(stage,project);assert.equal(gate.complete,false,'STAGE17_INITIAL_PREREQUISITE_ORACLE '+caseId);assert(gate.reasons.some(value=>reason.test(value)),'STAGE17_INITIAL_PREREQUISITE_REASON_ORACLE '+caseId+': '+JSON.stringify(gate.reasons));
    assert.throws(()=>pr.reserveAndBuildPromptRecord(project,17,{operation:'ROOT_CAUSE'}),error=>error?.code==='UPSTREAM_STAGE_INCOMPLETE'&&error.upstreamStage===16,'STAGE17_INITIAL_PREREQUISITE_ORACLE: admission cannot bypass missing initial proof');
    cases.push({caseId,stage,operation:'ROOT_CAUSE',result:'PASS',synthetic:true,actualBrowser:false,observedBoundary:'disposable missing-initial-proof counterexample -> actual gate/recalculation -> unchanged prompt prerequisite guard',stageComplete:false});
  }
  const changed=copy(saved),field='EXACT_USER_OBJECTIVE_VERBATIM';
  // The existing synthetic counterpart starts with an unversioned input payload.
  // Record that exact baseline through the real command before changing it.
  if(!changed.projectData.inputVersions.length)e.recordHumanInputVersion(changed,[],'SYNTHETIC_OPERATOR');
  changed.job[field]+=' Synthetic controlled upstream input change.';const input=e.recordHumanInputVersion(changed,[field],'SYNTHETIC_OPERATOR');e.recalculate(changed);
  assert(input.inputVersionId);assert.equal(e.records(changed,'iterations').filter(row=>[10,17].includes(Number(row.stage))).length,0,'STAGE17_CANONICAL_INVALIDATION_ORACLE: changed authoritative input must invalidate active initial/corrected iterations');
  assert(changed.projectData.iterations.some(row=>row.invalidatedBy));assert.equal(e.gate(1,changed).complete,false);assert.equal(e.gate(17,changed).complete,false);
  assert.throws(()=>pr.reserveAndBuildPromptRecord(changed,17,{operation:'ROOT_CAUSE'}),error=>error?.code==='UPSTREAM_STAGE_INCOMPLETE');
  const current17=e.records(saved,'iterations').filter(row=>Number(row.stage)===17).at(-1),laterDefect=e.recordsForIteration(saved,'defects',rid(current17,'iterations')).at(-1);assert(laterDefect);
  for(const options of [{},{allScopes:true}])assert(e.confirmedDefects(saved,options).some(row=>rid(row,'defects')===rid(laterDefect,'defects')),'STAGE17_LATER_DEFECT_RETENTION_ORACLE');
  assert.equal(e.convergenceSnapshot(saved).converged,false);assert.equal(e.gate(18,saved).complete,false);assert.equal(e.gate(19,saved).complete,false);
  cases.push({caseId:'stage17-initial-owner-and-real-upstream-invalidation',stage:17,operation:'ROOT_CAUSE',result:'PASS',synthetic:true,actualBrowser:false,initialIterationId:initialId,laterDefectId:rid(laterDefect,'defects'),currentStage:saved.job.CURRENT_STAGE,inputVersionId:input.inputVersionId,observedBoundary:'actual persisted failed prefix -> initial/later gates and global defect selection; real input-version command -> canonical downstream invalidation'});
}
function verifyPermanentRegressionOwners(r,saved){
  const e=r.engine,rid=e.recordId,initial=e.records(saved,'iterations').filter(row=>Number(row.stage)===10).at(-1),initialIds=e.recordsForIteration(saved,'regressions',rid(initial,'iterations')).map(row=>rid(row,'regressions')),laterIds=e.records(saved,'regressions').filter(row=>Number(row.stage)===17).map(row=>rid(row,'regressions'));
  assert(initialIds.length&&laterIds.length);const initialSelection=e.regressionExecutionSelection(saved,15),corrected=e.regressionExecutionSelection(saved,17),confirmation=e.regressionExecutionSelection(saved,19,{iterationId:e.currentScope(saved).iterationId});
  for(const id of initialIds)assert(initialSelection.registered.some(row=>rid(row,'regressions')===id),'STAGE15_REGRESSION_OWNER_ORACLE: original permanent definition omitted');
  for(const id of laterIds){assert(!initialSelection.registered.some(row=>rid(row,'regressions')===id),'STAGE15_REGRESSION_OWNER_ORACLE: later definition reopened initial stage');assert(corrected.registered.some(row=>rid(row,'regressions')===id));assert(confirmation.registered.some(row=>rid(row,'regressions')===id));}
  for(const stage of [14,15,16])assert.equal(e.gate(stage,saved).complete,true,'STAGE15_REGRESSION_OWNER_ORACLE: later permanent regression must not reopen initial owner');
  assert.equal(e.gate(17,saved).complete,false);
  cases.push({caseId:'stage15-original-and-stage17-19-complete-permanent-regression-selection',stage:17,operation:'REGRESSION',result:'PASS',synthetic:true,actualBrowser:false,initialIds,laterIds,observedBoundary:'actual admitted permanent17 regression -> Stage15 historical selection and current17/19 registered permanent selection -> initial/later gates'});
}

// A disposable Stage17 branch establishes real failed-run data before asking
// the exact ROOT_CAUSE / CORRECT actors for a proposal. The main journey stays
// unchanged and still supplies the separate clean corrected-iteration control.
async function verifyStage17FailureCorrection() {
  const stage=17,original=hash.sha256Value(p),originalInstruction=hash.sha256Value(engine.records(p,'instructions'));
  assert.equal(engine.gate(16,p).complete,true,'STAGE17_UPSTREAM_ORACLE: accepted Stage16 correction is required');
  const r=projectStoreRuntime({sourceOverrides:runtimeSources}),{store,copy}=r,e=r.engine,pr=r.prompts,i=r.ingestion,s=r.runtime.closedLoopWorkflowSchema;
  await restoreArtifactFixture(store,await captureArtifactFixture(byteStore,p.job.JOB_ID));
  const fork=copy(p);fork.activeStage=17;e.recalculate(fork);
  await hydrateRetainedPromptContexts(r,fork,[...retainedContextFiles.values()]);
  let saved=await store.writeProject(fork,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
  const v=e.recordValue,rid=(record,family)=>e.recordId(record,family),proof=[];
  const persist=async project=>{const impact=store.mutationImpact(saved,project);saved=await store.writeProject(project,{expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256,...(impact.requiresConfirmation?{mutationConfirmation:impact}:{})});};
  const command=async mutate=>{const project=copy(saved);const result=mutate(project);await persist(project);return result;};
  const freeze=async()=>command(project=>{
    const artifactId=artifactFixtureId(e,project,'CANDIDATE-FILE'),artifact=e.records(project,'artifacts').find(row=>rid(row,'artifacts')===artifactId);
    assert(artifact,'STAGE17_COMPONENT_ORACLE: current verified candidate bytes are required');
    const artifactIds=[artifactId],decision=e.recordRegisteredHumanDecision(project,{stage,purpose:'CANDIDATE_COMPONENT_SELECTION',targetFamily:'artifacts',targetId:hash.sha256Value(artifactIds),value:artifactIds,operatorLabel:'SYNTHETIC_STAGE17_OPERATOR'});
    return e.freezeCandidate(project,{stage,artifactIds,selectionDecisionId:rid(decision,'humanDecisions'),operatorLabel:'SYNTHETIC_STAGE17_OPERATOR'});
  });
  async function admit(operation,makeResponse=null,{omitTerminalLF=false}={}) {
    console.error(JSON.stringify({phase:'stage17-admit-start',stage,operation}));
    const draft=copy(saved),reserved=pr.reserveAndBuildPromptRecord(draft,stage,{operation}).prompt;
    await persist(draft);
    const prompt=saved.projectData.generatedPrompts.find(row=>row.instructionId===reserved.instructionId);
    const pkg=await store.createExecutionPackage({jobId:saved.job.JOB_ID,stage,operation,instructionId:prompt.instructionId});
    const members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer()));
    const member=path=>{const row=members.find(item=>item.canonicalPath===path);assert(row,'Missing exported member '+path);return Buffer.from(row.bytes);};
    const manifest=JSON.parse(member('manifest.json').toString('utf8')),instructionBytes=member('instruction.txt');
    assert.equal(instructionBytes.toString('utf8'),prompt.prompt);
    assert.equal(manifest.stage,stage);assert.equal(manifest.operation,operation);
    for(const key of ['packageId','operationReservationId','challengeNonce'])assert.equal(manifest[key],prompt[key]);
    assert.equal(manifest.promptIdentity.instructionId,prompt.instructionId);
    const contextFiles=manifest.contextFiles.map(file=>{const bytes=member(file.path);assert.equal(bytes.length,file.byteSize);assert.equal(hash.sha256Text(bytes.toString('utf8')),file.sha256);return {filename:file.path,bytes};});
    assert(!manifest.attachmentSlots.some(slot=>slot.required&&slot.role!=='STRUCTURED_RESPONSE'),'STAGE17_RETURN_BYTES_ORACLE: required files must have actual bytes');
    const actors={schema:s,engine:e,prompt,manifest,contextFiles,instructionBytes,omitTerminalLF};
    const exported=[];
    for(const file of contextFiles)for(const block of JSON.parse(file.bytes.toString('utf8')).members||[])exported.push(block);
    for(const match of instructionBytes.toString('utf8').matchAll(/BEGIN_UNTRUSTED_DATA_BLOCK\s*([\s\S]*?)\s*END_UNTRUSTED_DATA_BLOCK/g))exported.push(JSON.parse(match[1]));
    const rows=family=>{const block=exported.find(item=>item.sourceIdentity==='collection.'+family);return block?JSON.parse(block.value).records:[];};
    const latest=family=>rows(family).at(-1),reference=(row,family)=>{assert(row,'Missing exported '+family);return {recordId:rid(row,family)};};
    const template=JSON.parse(instructionBytes.toString('utf8').split('\nSTRICT RESPONSE CONTRACT\n').at(-1).split('\n\nEND COPY BLOCK')[0]);
    const base=()=>({schema:s.RESPONSE_SCHEMA,contractProfileId:s.CONTRACT_PROFILE_ID,jobId:template.jobId,stage,operation,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce,scope:manifest.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{},evidence:[{temporaryKey:'evidence-1',kind:'SYNTHETIC_OPERATOR_JOURNEY',description:'Actual synthetic Stage17 '+operation+' comparison/control',authorityType:'AGENT_CLAIM',location:'verify-operator-counterpart.mjs',content:'Synthetic local fixture only. No real human, external-system execution or physical-device observation asserted.'}],unresolved:[],warnings:[],attachments:[]});
    const envelope=makeResponse?makeResponse({base,rows,latest,reference,manifest,prompt,instructionBytes}):responseFixture(actors);
    const text=JSON.stringify(envelope),staged=await store.stageResponseFile({jobId:saved.job.JOB_ID,stage,blob:new Blob([text],{type:'application/json'}),rawFilename:'response.json',mediaType:'application/json',promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce});
    const file=await store.readStagedResponseFile({jobId:saved.job.JOB_ID,stagingId:staged.stagingId});
    assert.equal(new TextDecoder('utf-8',{fatal:true}).decode(file.bytes),text);
    const before=saved.projectData.acceptedChanges.length,captured=i.captureRaw(saved,{stage,text,promptRecord:prompt,transport:{authority:'AUTHORITATIVE_RESPONSE_FILE',stagingId:staged.stagingId,rawFilename:'response.json',mediaType:'application/json',status:file.status,sha256:file.sha256,byteSize:file.byteSize,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce}});
    saved=await store.writeProject(captured.project,{operational:true,expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});
    const prepared=i.prepareCaptured(saved,{rawResponseId:captured.rawRecord.rawResponseId});
    assert.equal(prepared.validation.valid,true,'STAGE17_ADMISSION_ORACLE '+operation+': '+JSON.stringify(prepared.validation.issues));
    assert.equal(prepared.proposal.status,'PENDING_OPERATOR_REVIEW');assert.equal(prepared.project.projectData.acceptedChanges.length,before);
    saved=await store.writeProject(prepared.project,{operational:true,expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});
    const committed=i.commit(saved,prepared.proposal.proposalId,{operator:'SYNTHETIC_STAGE17_OPERATOR'});await persist(committed.project);
    saved=await store.readProject(saved.job.JOB_ID);
    assert.equal(store.validateProjectIntegrity(saved).valid,true);
    const accepted=e.acceptedChanges(saved,stage).find(row=>row.proposalId===prepared.proposal.proposalId);
    assert.equal(accepted.operation,operation);assert.equal(i.findRaw(saved,captured.rawRecord.rawResponseId).completeRawResponse,text);
    const duplicate=i.commit(saved,prepared.proposal.proposalId,{operator:'SYNTHETIC_STAGE17_OPERATOR'});assert.equal(duplicate.idempotent,true);
    const item={operation,rawResponseId:captured.rawRecord.rawResponseId,proposalId:prepared.proposal.proposalId,acceptedChangeId:accepted.changeId,scope:accepted.scope,rawResponseSha256:file.sha256};proof.push(item);
    console.error(JSON.stringify({phase:'stage17-admit-complete',stage,...item}));
    return item;
  }
  // Setup uses the existing counterpart admission path, without duplicating
  // every setup operation's already-covered file staging/persistence boundary.
  // ROOT_CAUSE / REGRESSION / CORRECT below retain the full ZIP/file/store path.
  const setupContexts=new Map([...retainedContextFiles.entries()]);
  async function establishSetup(operation,{omitTerminalLF=false}={}) {
    console.error(JSON.stringify({phase:'stage17-setup-start',stage,operation}));
    const draft=copy(saved),prompt=pr.reserveAndBuildPromptRecord(draft,stage,{operation}).prompt;
    const contextFiles=pr.materializePromptContextFiles(prompt,draft);
    for(const file of contextFiles)setupContexts.set(file.sha256,file);
    const manifest=pr.promptFileManifest(prompt),envelope=responseFixture({schema:s,engine:e,prompt,manifest,instructionBytes:Buffer.from(prompt.prompt),contextFiles:contextFiles.map(file=>({filename:file.filename,bytes:Buffer.from(file.text)})),omitTerminalLF});
    const text=JSON.stringify(envelope),before=draft.projectData.acceptedChanges.length;
    const prepared=i.prepare(draft,{stage,text,promptRecord:prompt,transport:{packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce}});
    assert.equal(prepared.validation.valid,true,'STAGE17_SETUP_ADMISSION_ORACLE '+operation+': '+JSON.stringify(prepared.validation.issues));
    assert.equal(prepared.proposal.status,'PENDING_OPERATOR_REVIEW');assert.equal(prepared.project.projectData.acceptedChanges.length,before);
    const committed=i.commit(prepared.project,prepared.proposal.proposalId,{operator:'SYNTHETIC_STAGE17_OPERATOR'});saved=committed.project;
    const accepted=e.acceptedChanges(saved,stage).find(row=>row.proposalId===prepared.proposal.proposalId);
    assert.equal(accepted.operation,operation);
    proof.push({operation,rawResponseId:accepted.rawResponseId,proposalId:prepared.proposal.proposalId,acceptedChangeId:accepted.changeId,scope:accepted.scope,observedBoundary:'production reservation/generated context -> prepare -> operator commit; setup prefix persisted together after comparison'});
    console.error(JSON.stringify({phase:'stage17-setup-complete',stage,operation,rawResponseId:accepted.rawResponseId}));
  }
  assert.equal(e.operationalNextAction(saved,stage).actionType,'FREEZE_CANDIDATE');
  const first=await freeze(),iterationId=rid(first.iteration,'iterations'),candidateId=rid(first.candidate,'candidateFreezes');
  assert.equal(e.evaluateCorrectedIterationLineage(saved,iterationId).valid,true);
  const runs=await command(project=>e.reserveRunBatch(project,{stage}));
  assert.equal(runs.length,10);assert.equal(new Set(runs.map(row=>row.runId)).size,10);assert.equal(new Set(runs.map(row=>row.contextId)).size,10);
  const setupPersistenceBase=copy(saved);
  for(let index=0;index<10;index++) {const action=e.operationalNextAction(saved,stage);assert.equal(action.operation,'EXECUTE_RUN');await establishSetup('EXECUTE_RUN',{omitTerminalLF:index===0});}
  for(let index=0;index<10;index++) {assert.equal(e.operationalNextAction(saved,stage).operation,'VERIFY');await establishSetup('VERIFY');}
  assert.equal(e.operationalNextAction(saved,stage).operation,'COMPARE');await establishSetup('COMPARE');
  await hydrateRetainedPromptContexts(r,saved,[...setupContexts.values()]);
  {const impact=store.mutationImpact(setupPersistenceBase,saved);saved=await store.writeProject(saved,{expectedProjectRevision:setupPersistenceBase.revision,expectedStateSha256:setupPersistenceBase.projectSha256,...(impact.requiresConfirmation?{mutationConfirmation:impact}:{})});}
  saved=await store.readProject(saved.job.JOB_ID);assert.equal(store.validateProjectIntegrity(saved).valid,true);
  console.error(JSON.stringify({phase:'stage17-legitimate-failed-prefix-stored',stage,setupReceipts:proof.length}));
  verifyInitialAnalysisOwners(r,saved);
  const failedRun=e.records(saved,'runs').find(row=>row.scope?.iterationId===iterationId&&v(row,'COMPLETE_OUTPUT')==='VERIFIED');
  const defect=e.records(saved,'defects').find(row=>row.scope?.iterationId===iterationId&&String(v(row,'RUN_ID'))===rid(failedRun,'runs'));
  assert(failedRun&&defect,'STAGE17_OBSERVED_DEFECT_ORACLE: actual accepted bad run, verification and comparison must produce the linked defect');
  const defectId=rid(defect,'defects'),runId=rid(failedRun,'runs'),failingBytes=Buffer.from(v(failedRun,'COMPLETE_OUTPUT'),'utf8');
  assert.equal(failingBytes.equals(Buffer.from(OUTPUT)),false);assert.equal(Buffer.from(OUTPUT).equals(Buffer.from('VERIFIED\n')),true);
  assert.equal(e.gate(stage,saved).complete,false);
  assert.equal(e.operationalNextAction(saved,stage).operation,'ROOT_CAUSE');
  const rca=await admit('ROOT_CAUSE',({base,rows,reference})=>{
    const response=base(),d=rows('defects').find(row=>rid(row,'defects')===defectId);assert(d,'The RCA actor must receive its exact current defect');
    assert(rows('runs').some(row=>rid(row,'runs')===runId),'The RCA actor must receive its exact failed run');
    response.records.rootCauses=[recordProposal(s,'rootCauses',{tempKey:'stage17-transport-root-cause',relationships:{DEFECT_ID:reference(d,'defects')},overrides:{CATEGORY:'EXECUTION',LAYER_TRACE:'Explicit terminal-LF requirement -> unchanged correct instruction -> synthetic executor omitted LF -> actual verifier refuted the output.',EARLIEST_DEFECTIVE_LAYER:'EXECUTION',ROOT_CAUSE:'The deliberately defective synthetic executor returned eight bytes, omitting terminal LF.',EVIDENCE:'Accepted run '+runId+' and its actual verification/comparison preserve the missing byte.',DOWNSTREAM_INVALIDATION:'Preserve failed iteration and re-execute a distinct corrected iteration.'}})];return response;
  });
  assert.equal(e.gate(stage,saved).complete,false,'STAGE17_RCA_NEGATIVE_GATE_ORACLE: admitting supported RCA cannot repair the failed runs');
  assert.equal(e.operationalNextAction(saved,stage).operation,'REGRESSION');
  await admit('REGRESSION',({base,rows,reference,manifest})=>{
    const response=base(),d=rows('defects').find(row=>rid(row,'defects')===defectId),req=rows('requirements').find(row=>rid(row,'requirements')===String(v(d,'REQ_ID')));
    assert(d&&req,'Regression actor needs the typed current defect/requirement');
    assert.equal(failingBytes.equals(Buffer.from(OUTPUT)),false,'STAGE17_PRE_CORRECTION_EXECUTION_ORACLE: actual negative byte comparison is required');
    const rec=(family,key,fields,relationships)=>recordProposal(s,family,{tempKey:key,overrides:fields,relationships});
    response.records.regressions=[rec('regressions','stage17-permanent-lf',{FAILURE_FIXTURE:failingBytes.toString('utf8'),REPRODUCTION_PROCEDURE:'Compare the accepted eight-byte output with the required nine-byte VERIFIED + LF output.',DETECTION_METHOD:'Disposable exact-byte equality comparison',CORRECTION:'Preserve complete synthetic executor output including terminal LF.',PERMANENT_TEST_LOCATION:'Current permanent regression registry',APPLICABILITY:'APPLICABLE',EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',REQUIRED_CAPABILITY:'INDEPENDENT_AGENT_REVIEW'},{DEFECT_ID:reference(d,'defects'),REQ_ID:reference(req,'requirements')})];
    const refs={ITERATION_ID:{recordId:manifest.scope.iterationId},CANDIDATE_ID:{recordId:manifest.scope.candidateId}};
    response.records.regressionExecutions=[rec('regressionExecutions','stage17-new-pre-correction',{PHASE:'PRE_CORRECTION',RESULT:'VIOLATED'},{...refs,REG_ID:{tempKey:'stage17-permanent-lf'}})];
    // The current candidate follows the prior Stage16 correction yet actually
    // failed. Retain adverse current-candidate executions, including the newly
    // installed regression, rather than relabeling them as successful.
    for(const [index,reg] of rows('regressions').entries()) {
      assert.equal(Buffer.from(v(reg,'FAILURE_FIXTURE')).equals(Buffer.from(OUTPUT)),false);
      response.records.regressionExecutions.push(rec('regressionExecutions','stage17-prior-current-'+index,{PHASE:'POST_CORRECTION',RESULT:'VIOLATED'},{...refs,REG_ID:reference(reg,'regressions')}));
    }
    response.records.regressionExecutions.push(rec('regressionExecutions','stage17-new-current',{PHASE:'POST_CORRECTION',RESULT:'VIOLATED'},{...refs,REG_ID:{tempKey:'stage17-permanent-lf'}}));
    response.evidence[0].content=JSON.stringify({synthetic:true,actualComparisonExecuted:true,expectedUtf8Base64:Buffer.from(OUTPUT).toString('base64'),observedUtf8Base64:failingBytes.toString('base64'),equal:false,iterationId:manifest.scope.iterationId,candidateId:manifest.scope.candidateId,realExternalActor:false});return response;
  });
  verifyPermanentRegressionOwners(r,saved);
  assert.equal(e.gate(stage,saved).complete,false);assert.equal(e.operationalNextAction(saved,stage).operation,'CORRECT');
  const correction=await admit('CORRECT',({base,rows})=>{
    const response=base(),d=rows('defects').find(row=>rid(row,'defects')===defectId),cause=rows('rootCauses').find(row=>String(v(row,'DEFECT_ID'))===defectId);
    assert(d&&cause,'Correction actor must receive the exact current defect and admitted RCA');
    response.records.changes=[recordProposal(s,'changes',{tempKey:'stage17-execution-preserves-lf',overrides:{TRIGGERING_DEFECT_IDS:rid(d,'defects'),ROOT_CAUSE_ANALYSIS:v(cause,'ROOT_CAUSE'),RESPONSIBLE_LAYER:'EXECUTION',OLD_ARTIFACT_VERSION:'Synthetic Stage17 executor with omitted LF',EXACT_MODIFICATION:'Use the conforming synthetic output construction VERIFIED followed by one LF; preserve the correct frozen instruction.',NEW_ARTIFACT_VERSION:'Synthetic Stage17 executor preserving LF',DOWNSTREAM_INVALIDATION:'Preserve failed current iteration; create and re-execute a distinct corrected iteration and all dependent reviews.',REQUIRED_RERUNS:'Ten new corrected runs and current complete verification, comparison, and regression execution.',INSTRUCTION_CHANGE_DETERMINATION:'UNCHANGED',REQUIRED_REPEATED_PREFLIGHT:'NOT REQUIRED',JUSTIFIED_UNCHANGED_ARTIFACTS:'The accepted frozen instruction already requires the correct exact LF.',EVIDENCE:'The disposable positive comparison produced the exact nine required bytes; failed current run evidence remains preserved.'}})];return response;
  });
  assert.equal(e.gate(stage,saved).complete,false,'STAGE17_CORRECTION_NEGATIVE_GATE_ORACLE: accepted execution correction cannot complete a failed iteration');
  assert.equal(hash.sha256Value(structuredClone(e.records(saved,'instructions'))),originalInstruction,'STAGE17_INSTRUCTION_PRESERVATION_ORACLE');
  assert.equal(e.operationalNextAction(saved,stage).actionType,'FREEZE_CANDIDATE');
  const failedScope={iterationId,candidateId},rawBefore=proof.map(row=>({rawResponseId:row.rawResponseId,sha256:i.findRaw(saved,row.rawResponseId).sha256,bytes:i.findRaw(saved,row.rawResponseId).completeRawResponse}));
  const next=await freeze(),nextIterationId=rid(next.iteration,'iterations'),nextCandidateId=rid(next.candidate,'candidateFreezes'),change=e.records(saved,'changes').find(row=>row.sourceProposalId===correction.proposalId)||e.records(saved,'changes').at(-1);
  assert.notEqual(nextIterationId,iterationId);assert.notEqual(nextCandidateId,candidateId);
  assert.equal(v(next.iteration,'PREVIOUS_ITERATION_ID'),iterationId);assert.equal(v(next.iteration,'CHANGESET_ID'),rid(change,'changes'));
  assert.equal(e.evaluateCorrectedIterationLineage(saved,nextIterationId).valid,true);
  const nextRuns=await command(project=>e.reserveRunBatch(project,{stage}));
  assert.equal(nextRuns.length,10);assert(nextRuns.every(row=>!runs.some(old=>old.runId===row.runId||old.contextId===row.contextId)));
  assert.equal(e.records(saved,'runs').filter(row=>row.scope?.iterationId===nextIterationId&&v(row,'EXECUTION_STATUS')==='COMPLETED').length,0);
  assert.equal(e.gate(stage,saved).complete,false,'STAGE17_EMPTY_BATCH_NEGATIVE_GATE_ORACLE: fresh empty batch cannot inherit old success/failure counts');
  assert.equal(e.operationalNextAction(saved,stage).operation,'EXECUTE_RUN');
  for(const raw of rawBefore)assert.equal(i.findRaw(saved,raw.rawResponseId).completeRawResponse,raw.bytes,'STAGE17_HISTORY_RETENTION_ORACLE');
  assert.equal(store.validateProjectIntegrity(await store.readProject(saved.job.JOB_ID)).valid,true);
  assert.equal(hash.sha256Value(p),original,'STAGE17_DISPOSABLE_ISOLATION_ORACLE');
  cases.push({caseId:'stage17-failed-iteration-root-cause-correction-fresh-freeze',stage,operations:['ROOT_CAUSE','CORRECT'],result:'PASS',synthetic:true,actualBrowser:false,oldScope:failedScope,newScope:{iterationId:nextIterationId,candidateId:nextCandidateId},defectId,rootCauseReceipt:rca,correctionReceipt:correction,allReceipts:proof,acceptedFailedIterationStillIncomplete:true,instructionPreserved:true,newEmptyBatchIncomplete:true,priorRawBytesPreserved:true,mainLifecycleUnchanged:true,observedBoundary:'actual accepted failed ten-run prefix -> actual ZIP/staged response -> prepare/operator commit -> metadata store/readback -> adverse gate -> fresh application-owned freeze/batch'});
}

for(let stage=diagnosticPrefixInput?Number(JSON.parse(fs.readFileSync(diagnosticPrefixInput,'utf8')).entryStage):1;stage<=stageLimit;stage++){
  if(diagnosticPrefixDir&&stage>=8)await emitDiagnosticPrefix(stage);
  if(stage===7&&!injectedFault&&!diagnosticPrefixDir)await verifyOwningStageExecution(stage,'EXECUTE_FAILURE_TEST');
  if(stage===15&&!injectedFault&&!diagnosticPrefixDir)await verifyOwningStageExecution(stage,'EXECUTE_REGRESSION');
  if(stage===17&&!diagnosticPrefixDir&&(!injectedFault||initialOwnerFaults.includes(injectedFault)))await verifyStage17FailureCorrection();
  for(let step=0;step<80;step++){
    let action=engine.operationalNextAction(p,stage);if(engine.gate(stage,p).complete&&(stage!==30||action.actionType==='COMPLETE'))break;
    if(diagnosticPrefixDir&&schema.deferredExecutionFamily(stage,action.operation))action=diagnosticOrdinaryAction(stage);
    if(process.env.CLRT_COUNTERPART_PROGRESS)console.error(JSON.stringify({counterpartStage:stage,action:action.actionType,operation:action.operation}));
    if(stage===28&&!latest('artifactIdentities')){const row={artifactId:artifactFixtureId(engine,p,'PRODUCT-FILE'),name:'result.txt',size:Buffer.byteLength(OUTPUT),sha256:hash.sha256Text(OUTPUT),byteVerificationReceipt:{source:'APPLICATION_BYTE_REHASH',receiptId:'SYNTHETIC-BYTE-COMPARISON',artifactId:artifactFixtureId(engine,p,'PRODUCT-FILE'),byteSize:Buffer.byteLength(OUTPUT),sha256:hash.sha256Text(OUTPUT)}};engine.verifyArtifactIdentity(p,[row],[row]);}
    else if(action.actionType==='CONFIRM_STAGE_ONE_INTENT'){const change=engine.acceptedChanges(p,1).at(-1);engine.recordStageConfirmation(p,1,true,'Synthetic confirmation','SYNTHETIC',{acceptedChangeId:change.changeId,inputVersion:p.job.CURRENT_INPUT_VERSION});}
    else if(action.actionType==='FREEZE_CANDIDATE'){await retainFixtureFile('CANDIDATE-FILE','production-instruction.txt',CANDIDATE);if(!engine.records(p,'artifacts',{active:false}).some(row=>engine.recordId(row,'artifacts')===artifactFixtureId(engine,p,'CANDIDATE-FILE')))engine.registerArtifactBytes(p,{stage,artifactId:artifactFixtureId(engine,p,'CANDIDATE-FILE'),filename:'production-instruction.txt',mediaType:'text/plain',byteSize:Buffer.byteLength(CANDIDATE),sha256:hash.sha256Text(CANDIDATE)});const decision=engine.recordRegisteredHumanDecision(p,{stage,purpose:'CANDIDATE_COMPONENT_SELECTION',targetFamily:'artifacts',targetId:hash.sha256Value([artifactFixtureId(engine,p,'CANDIDATE-FILE')]),value:[artifactFixtureId(engine,p,'CANDIDATE-FILE')],operatorLabel:'SYNTHETIC'});engine.freezeCandidate(p,{stage,artifactIds:[artifactFixtureId(engine,p,'CANDIDATE-FILE')],selectionDecisionId:id(decision,'humanDecisions')});}
    else if(action.actionType==='REGISTER_SOURCE_SEARCH_CAPABILITY'){
      const contract=latest('sourceSearchContracts');
      assert.ok(contract,'COUNTERPART_SOURCE_SEARCH_CAPABILITY_ORACLE: the preceding accepted response must provide the current search contract.');
      assert.equal(engine.sourceSearchCapabilityState(p,contract).complete,false,'COUNTERPART_SOURCE_SEARCH_CAPABILITY_ORACLE: the action must correspond to a missing current capability registration.');
      assert.equal(engine.gate(stage,p).complete,false,'COUNTERPART_SOURCE_SEARCH_CAPABILITY_ORACLE: accepting the search response alone must not complete Stage 2.');
      if(!counterpartFaults[injectedFault]?.skipSourceSearchRegistration)registerFixtureSourceSearchCapability({engine},p);
      const current=latest('sourceSearchContracts'),state=engine.sourceSearchCapabilityState(p,current);
      assert.equal(state.complete,true,'COUNTERPART_SOURCE_SEARCH_CAPABILITY_ORACLE: '+state.reasons.join(' '));
      assert.equal(engine.gate(stage,p).complete,false,'COUNTERPART_SOURCE_SEARCH_CAPABILITY_ORACLE: capability registration must not bypass independent adequacy review.');
      assert.equal(engine.operationalNextAction(p,stage).operation,'SEARCH_ADEQUACY_REVIEW','COUNTERPART_SOURCE_SEARCH_CAPABILITY_ORACLE: the accepted bounded search must proceed to its independently bound review.');
      cases.push({stage,caseId:'source-search-capability-before-independent-review',result:'PASS',evidenceBasis:'SYNTHETIC_OPERATOR_CONFIRMED_EXTERNAL_CLAIM'});
    }
    else if(action.actionType==='RESERVE_RUN_BATCH')engine.reserveRunBatch(p,{stage});
    else if(action.actionType==='BEGIN_UNCHANGED_CONFIRMATION')engine.beginUnchangedConfirmationIteration(p,{candidateId:id(latest('candidateFreezes'),'candidateFreezes')});
    else if(action.actionType==='CALCULATE_CONVERGENCE')engine.recordConvergence(p);
    else if(action.actionType==='CALCULATE_UNCHANGED_CONFIRMATION')engine.recordUnchangedConfirmation(p);
    else if(action.actionType==='FREEZE_BASELINE'){const iteration=latest('iterations'),candidateId=value(iteration,'CANDIDATE_ID'),decision=engine.recordRegisteredHumanDecision(p,{stage,purpose:'BASELINE_AUTHORIZATION',targetFamily:'candidateFreezes',targetId:candidateId,value:'AUTHORIZED',operatorLabel:'SYNTHETIC'});engine.freezeBaseline(p,{artifactIds:[],authorizationDecisionId:id(decision,'humanDecisions')});}
    else if(action.actionType==='REGISTER_PRODUCTION_CONTEXT')engine.registerFreshContext(p,{stage,identifier:'SYNTHETIC_PRODUCTION'});
    else if(action.actionType==='RESERVE_PRODUCT_EXECUTION')engine.reserveProductExecution(p);
    else if(action.actionType==='RUN_APP_TESTS'){for(const test of engine.finalProductTestSelection(p,22).tests){const testId=id(test,'tests'),result=await closedLoopTestRuntime.execute({spec:value(test,'EXECUTABLE_SPEC'),artifacts:{PRODUCT:{artifactId:artifactFixtureId(engine,p,'PRODUCT-FILE'),filename:'result.txt',bytes:Buffer.from(OUTPUT)}},metadata:{testId,bindings:value(test,'EXECUTABLE_INPUT_BINDINGS')}});engine.recordApplicationDeterministicResult(p,{testId,productId:id(latest('products'),'products'),runtimeResult:result,inputArtifacts:[{artifactId:artifactFixtureId(engine,p,'PRODUCT-FILE'),filename:'result.txt',byteSize:Buffer.byteLength(OUTPUT),sha256:hash.sha256Text(OUTPUT)}]});}}
    else if(action.actionType==='FREEZE_DELIVERY_CANDIDATE'){const artifactIds=[artifactFixtureId(engine,p,'PRODUCT-FILE')],decision=engine.recordRegisteredHumanDecision(p,{stage,purpose:'CANDIDATE_COMPONENT_SELECTION',targetFamily:'artifacts',targetId:hash.sha256Value(artifactIds),value:artifactIds,operatorLabel:'SYNTHETIC'});engine.freezeDeliveryCandidate(p,{artifactIds,selectionDecisionId:id(decision,'humanDecisions')});}
    else if(action.actionType==='CALCULATE_RELEASE')engine.recordReleaseDetermination(p);
    else if(action.actionType==='CAPTURE_DELIVERY_INTENT')engine.captureDeliveryIntent(p,{value:{authorized:true,deliveryCandidateSetId:id(latest('deliveryCandidateSets'),'deliveryCandidateSets'),releaseId:id(latest('releaseRecords'),'releaseRecords'),artifactIds:[artifactFixtureId(engine,p,'PRODUCT-FILE')],authorizedFilenames:{[artifactFixtureId(engine,p,'PRODUCT-FILE')]:'result.txt'},recipientOrClass:'Synthetic operator',destination:'Synthetic directory',transferPurpose:'Fixture preflight',transferChannel:'BROWSER_DOWNLOAD',disclosureClassification:'PUBLIC',disclosureAuthorization:true,permittedTransferCount:1},operatorLabel:'SYNTHETIC'});
    else if(action.actionType==='BUILD_EVIDENCE_CHAINS')engine.calculateEvidenceChains(p);
    else if(action.actionType==='EXPORT_PRE_DELIVERY_CHECKPOINT'){const c=engine.createPreDeliveryCheckpoint(p,{packageId:'SYNTHETIC-PACKAGE',packageSha256:'a'.repeat(64)});engine.recordCheckpointExportAction(p,{checkpointId:id(c,'backupCheckpoints'),packageSha256:'a'.repeat(64),filename:'synthetic.gz'});}
    else if(action.actionType==='CALCULATE_TERMINAL')engine.calculateTerminal(p);
    else if(action.actionType==='EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS')engine.recordDeliveryAttempt(p,{deliveryId:id(latest('deliveryRecords'),'deliveryRecords'),result:'SUCCEEDED'});
    else if(action.actionType==='RECORD_DELIVERY_EVIDENCE')engine.recordDeliveryEvidence(p,{attemptId:id(latest('deliveryAttempts'),'deliveryAttempts'),outcome:'RECEIVED',observation:'Synthetic receipt for fixture contract preflight only.',operatorLabel:'SYNTHETIC'});
    else if(['SELECT_RESPONSE_JSON_FILE','AI_REVIEW','EXTERNAL_AGENT_TOOL','CONTINUE_AGENT_CONVERSATION','EXTERNAL_SYSTEM'].includes(action.actionType)){
      let actorInputs,prompt;
      if(diagnosticPrefixDir&&[6,7,15].includes(stage)){
        actorInputs=await diagnosticPackage(stage,action.operation||schema.STAGE_CONTRACTS[stage].operations[0]);prompt=actorInputs.prompt;
      }else{
        ({prompt}=prompts.reserveAndBuildPromptRecord(p,stage,{operation:action.operation||schema.STAGE_CONTRACTS[stage].operations[0]}));const materialized=prompts.materializePromptContextFiles(prompt,p);if(!counterpartFaults[injectedFault]?.skipPromptContextCapture)for(const file of materialized)retainedContextFiles.set(file.sha256,file);
        actorInputs={schema,engine,prompt,manifest:prompts.promptFileManifest(prompt),instructionBytes:Buffer.from(prompt.prompt),contextFiles:materialized.map(file=>({filename:file.filename,bytes:Buffer.from(file.text)}))};
      }
      const request=diagnosticActor({...actorInputs,omitTerminalLF:stage===11&&!cases.some(row=>row.stage===11)}),files=[];
      if(stage===21){const slot=prompts.promptFileManifest(prompt).attachmentSlots.find(item=>item.role==='FINISHED_PRODUCT'&&item.required);assert.ok(slot,'Stage 21 must issue its required finished-product slot.');request.attachments=[{attachmentSlotId:slot.attachmentSlotId,role:slot.role,temporaryKey:'product-file',filename:'result.txt',mediaType:'text/plain',byteSize:Buffer.byteLength(OUTPUT),sha256:hash.sha256Text(OUTPUT),required:true}];request.evidence[0].attachmentRef={tempKey:'product-file'};await retainFixtureFile('PRODUCT-FILE','result.txt',OUTPUT);files.push({artifactId:artifactFixtureId(engine,p,'PRODUCT-FILE'),name:'result.txt',type:'text/plain',size:Buffer.byteLength(OUTPUT),sha256:hash.sha256Text(OUTPUT),attachmentSlotId:ingestion.attachmentSlotPlan(p,request,prompt)[0].attachmentSlotId});}
      const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(request),promptRecord:prompt,files,transport:{packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce}});assert.equal(prepared.validation.valid,true,JSON.stringify(prepared.validation.issues));p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'SYNTHETIC'}).project;cases.push({stage,operation:prompt.operation,result:'PASS'});
      if(prompt.operation==='VERIFY'){const scope=prompt.scope,iterationId=scope.iterationId||scope.confirmationIterationId,runs=engine.records(p,'runs').filter(row=>String(engine.recordValue(row,'ITERATION_ID')||row.scope?.iterationId||'')===iterationId),verified=new Set(engine.records(p,'verification').filter(row=>(row.scope?.iterationId||row.scope?.confirmationIterationId)===iterationId).map(row=>String(engine.recordValue(row,'RUN_ID')||''))),remaining=runs.filter(row=>!verified.has(id(row,'runs')));if(remaining.length)assert.equal((diagnosticPrefixDir?diagnosticOrdinaryAction(stage):engine.operationalNextAction(p,stage)).operation,'VERIFY','ITERATION_PARTIAL_VERIFY_ORACLE: every bound run must be verified before the workflow advances');}

    }else throw new Error('No progressing fixture command: '+JSON.stringify(action));
    engine.recalculate(p);
    for(const artifact of engine.records(p,'artifacts')){
      if(value(artifact,'AVAILABILITY')!=='BYTES_PERSISTED_AND_VERIFIED')continue;
      const identity={jobId:p.job.JOB_ID,artifactId:id(artifact,'artifacts'),filename:value(artifact,'FILENAME'),byteSize:value(artifact,'BYTE_SIZE'),sha256:value(artifact,'SHA256')};
      assert.equal(globalThis.closedLoopProjectStore?.artifactCustodyState?.(identity),'TRUE','COUNTERPART_RETAINED_ARTIFACT_CUSTODY_ORACLE: every retained artifact marked stored and verified must have matching actual bytes. '+JSON.stringify({stage,action:action.actionType,identity,source:artifact.source,storage:value(artifact,'STORAGE_REFERENCE')}));
      const stored=await byteStore.getArtifact(identity.artifactId,{jobId:identity.jobId});
      assert(stored&&stored.byteSize===identity.byteSize&&await hash.sha256Bytes(stored.blob)===identity.sha256,'COUNTERPART_RETAINED_ARTIFACT_CUSTODY_ORACLE: the stored byte length and digest must match the canonical artifact.');
    }
    assert.doesNotThrow(()=>hash.sha256Value(p),`Stage ${stage} ${action.actionType} must remain persistable after every operation`);
  }
  assert.equal(engine.gate(stage,p).complete,true,JSON.stringify({stage,reasons:engine.gate(stage,p).reasons}));
  if(stage===22&&!diagnosticPrefixDir){
    // First response after application-owned verification, using the same
    // durable staging and acceptance controls as the browser journey. The
    // small actual files come from preceding fixture operations, not metadata.
    const network=storageBroadcastNetwork(),r=projectStoreRuntime({environment:{BroadcastChannel:network.Channel}}),{runtime,store,copy}=r;
    await restoreArtifactFixture(store,await captureArtifactFixture(byteStore,p.job.JOB_ID));
    const input=copy(p);await hydrateRetainedPromptContexts(r,input,[...retainedContextFiles.values()]);
    await store.writeProject(input,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
    const saved=await store.readProject(p.job.JOB_ID);saved.activeStage=stage+1;saved.activeView='Workflow';
    const failures=bindAcceptanceUi(r,saved,'NONE'),ui=fs.readFileSync('app-core.js','utf8');
    const extract=(start,end)=>{const a=ui.indexOf(start),b=ui.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,'Actual response control owner must exist.');return ui.slice(a,b);};
    Object.assign(runtime,{recordValue:r.engine.recordValue,schema:runtime.closedLoopWorkflowSchema,recordMobileValidation:async()=>{},saveRequiredContinuation:async()=>null,selectStageContinuation:()=>{}});
    vm.runInContext(extract('function canonicalCurrentStage(','function displayedStageAction(')+extract('function stageOperations(','// A saved response may be inspected independently.')+extract('async function savePromptRecord(','function promptTransportFilename(')+extract('async function prepareStageResponseFile(','async function prepareStageResponseFallback('),runtime);
    await runtime.savePromptRecord(saved.activeStage);
    const prompt=runtime.currentPromptRecord(saved.activeStage),request=responseFixture({schema:runtime.schema,engine:r.engine,prompt,manifest:r.prompts.promptFileManifest(prompt),instructionBytes:Buffer.from(prompt.prompt)});
    runtime.responseAttemptPrompt=()=>prompt;runtime.responsePromptRecord=()=>prompt;runtime.proposalVersionCurrent=()=>false;
    const acceptedBefore=runtime.current.projectData.acceptedChanges.length,file=new Blob([JSON.stringify(request)],{type:'application/json'});Object.defineProperty(file,'name',{value:'response.json'});
    await runtime.prepareStageResponseFile(file);network.flush();
    console.error(JSON.stringify({caseId:'first-response-after-native-verification',failureCodes:failures.map(e=>e.code||e.message),affected:runtime.replacementReview?.impact?.affected||[],priorStageStatus:runtime.current.stages[stage].status}));
    assert.equal(Boolean(runtime.replacementReview),false,'INITIAL_RESPONSE_PRESERVES_PROGRESS_ORACLE: first response staging must not request replacement or invalidate completed prerequisites.');
    assert.equal(failures.length,0,'INITIAL_RESPONSE_PRESERVES_PROGRESS_ORACLE: '+failures.map(e=>e.message).join('|'));
    assert.equal(runtime.current.projectData.acceptedChanges.length,acceptedBefore,'INITIAL_RESPONSE_PRESERVES_PROGRESS_ORACLE: validation alone cannot accept work.');
    assert.equal(runtime.current.stages[stage].status,'COMPLETE','INITIAL_RESPONSE_PRESERVES_PROGRESS_ORACLE: completed verification must remain complete.');
    const proposal=runtime.current.projectData.responseProposals.find(row=>row.stage===saved.activeStage&&row.status==='PENDING_OPERATOR_REVIEW');
    assert.ok(proposal,'INITIAL_RESPONSE_PRESERVES_PROGRESS_ORACLE: valid response must reach proposal review.');
    const acceptFailures=bindAcceptanceUi(r,runtime.current,proposal.proposalId);await runtime.accept();network.flush();
    assert.equal(acceptFailures.length,0,'INITIAL_RESPONSE_ACCEPTANCE_ORACLE: '+acceptFailures.map(e=>e.message).join('|'));
    assert.equal(Boolean(runtime.replacementReview),false,'INITIAL_RESPONSE_ACCEPTANCE_ORACLE: initial acceptance must preserve its prerequisites.');
    const reloaded=await store.readProject(p.job.JOB_ID);
    assert.equal(reloaded.projectData.acceptedChanges.length,acceptedBefore+1,'INITIAL_RESPONSE_ACCEPTANCE_ORACLE: one explicit acceptance must commit once.');
    assert.equal(r.engine.gate(stage,reloaded).complete,true,'INITIAL_RESPONSE_ACCEPTANCE_ORACLE: durable acceptance must preserve verified prerequisites.');
    p=structuredClone(reloaded);cases.push({stage:saved.activeStage,operation:prompt.operation,caseId:'first-response-after-native-verification',result:'PASS'});
  }
  if(stage===13){
    const invalid=engine.clone(p);invalid.projectData.defects=[];
    const rejected=engine.gate(13,invalid);
    assert.equal(rejected.complete,false,'An observed initial violation without an evidence-linked defect must be rejected');
    const comparison=engine.evaluateCrossRunComparison(invalid),missing=Object.values(comparison.comparisonAnalysis).filter(row=>row.defectRequired&&!row.defectIds.length);
    assert(missing.length>0,'COUNTERPART_MISSING_DEFECT_FIXTURE_ORACLE: the otherwise valid comparison must require its removed defect');
    assert(missing.every(row=>rejected.reasons.some(reason=>reason.includes(row.comparisonId)&&reason.includes('DEFECT_IDS')&&/without|missing/i.test(reason))),
      'COUNTERPART_DEFECT_REASON_ORACLE: rejection must identify the missing defect handoff for the affected comparison; '+JSON.stringify(rejected.reasons));
    assert.equal(engine.gate(13,p).complete,true,'The otherwise valid comparison must progress when its defect is restored');
    assert.equal(engine.gate(11,p).complete,true,'Recording a failure must preserve the completed initial run batch');
    cases.push({stage:13,caseId:'initial-violation-defect-rejection-and-correction',rejectionReasons:rejected.reasons,result:'PASS'});
  }
}
if(diagnosticPrefixDir&&stageLimit>=7&&stageLimit<30)await emitDiagnosticPrefix(stageLimit+1);
console.log(JSON.stringify(diagnosticPrefixDir?{counterpartDiagnosticPrefixes:'EMITTED',completedPriorStages:stageLimit,prefixFiles:diagnosticPrefixFiles,sourceCommit:process.env.GITHUB_SHA||null,sourceFingerprints,synthetic:true,actualBrowserJourney:false}:{counterpartContracts:'PASS',stages:stageLimit,cases,sourceCommit:process.env.GITHUB_SHA||null,injectedFault,actualBrowserJourney:false,externalOutputs:'SYNTHETIC',persistenceCheckedAfterEveryOperation:true}));
