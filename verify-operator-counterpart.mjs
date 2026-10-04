import {bindArtifactFixture,projectStoreRuntime,captureArtifactFixture,restoreArtifactFixture,bindAcceptanceUi,storageBroadcastNetwork,hydrateRetainedPromptContexts} from './test-project-store-runtime.mjs';
import {artifactFixtureId} from './test-artifact-fixtures.mjs';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {responseFixture,OBJECTIVE,OUTPUT,CANDIDATE,COUNTERPART_FAULT_CASES} from './operator-journey-fixtures.mjs';
import {registerFixtureSourceSearchCapability} from './test-fixtures.mjs';
globalThis.dispatchEvent=()=>true;
const injectedFault=process.env.CLRT_COUNTERPART_FAULT||null;
const counterpartFaults={
  'missing-source-search-registration':{skipSourceSearchRegistration:true},
  'missing-retained-prompt-context':{skipPromptContextCapture:true},
  'missing-candidate-bytes':{skipFixtureFile:'CANDIDATE-FILE'},
  'missing-product-bytes':{skipFixtureFile:'PRODUCT-FILE'},
  'fractional-stability':{from:'const snapshot=clone(stability),denominator=Number(snapshot.runCount||0);',to:'return stability; const snapshot=clone(stability),denominator=Number(snapshot.runCount||0);'},
  'missing-defect-gate':{from:'if(defectRequired&&!defectIds.length)',to:'if(false&&defectRequired&&!defectIds.length)'},
  'unrelated-defect-reason':{from:"' has prohibited variance or a violated result without a DEFECT_IDS handoff.'",to:"' has an unrelated prerequisite failure.'"},
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
  createVerifierRuntime.loadScript(globalThis,source,{filename:file});
}
const byteStore=await bindArtifactFixture([]);
const engine=closedLoopWorkflowEngine,schema=closedLoopWorkflowSchema,prompts=closedLoopPromptEngine,ingestion=closedLoopResponseIngestion,hash=closedLoopHash;
let p=closedLoopCore.createBlankState('COUNTERPART-CONTRACT-PREFLIGHT');p.job.JOB_TITLE='Complete operator journey';p.job.EXACT_USER_OBJECTIVE_VERBATIM=OBJECTIVE;engine.ensureShape(p);engine.recalculate(p);
const value=engine.recordValue,id=engine.recordId,latest=family=>engine.recordsForCurrentScope(p,family).at(-1),cases=[],retainedContextFiles=new Map();
async function retainFixtureFile(label,filename,text){
  if(counterpartFaults[injectedFault]?.skipFixtureFile===label)return;
  await byteStore.putArtifact({jobId:p.job.JOB_ID,artifactId:artifactFixtureId(engine,p,label),filename,mediaType:'text/plain',blob:new Blob([text],{type:'text/plain'})});
}
// Fixture preflight only. Actual interface and file transport acceptance remains
// the separate verify-complete-operator-journey.mjs browser execution.
const stageLimit=Number(process.env.CLRT_COUNTERPART_STAGE_LIMIT||30);
assert(Number.isInteger(stageLimit)&&stageLimit>=1&&stageLimit<=30);
for(let stage=1;stage<=stageLimit;stage++){
  for(let step=0;step<80;step++){
    const action=engine.operationalNextAction(p,stage);if(engine.gate(stage,p).complete&&(stage!==30||action.actionType==='COMPLETE'))break;
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
      const {prompt}=prompts.reserveAndBuildPromptRecord(p,stage,{operation:action.operation||schema.STAGE_CONTRACTS[stage].operations[0]});if(!counterpartFaults[injectedFault]?.skipPromptContextCapture)for(const file of prompts.materializePromptContextFiles(prompt,p))retainedContextFiles.set(file.sha256,file);const request=responseFixture({schema,engine,prompt,manifest:prompts.promptFileManifest(prompt),instructionBytes:Buffer.from(prompt.prompt),omitTerminalLF:stage===11&&!cases.some(row=>row.stage===11)}),files=[];
      if(stage===21){const slot=prompts.promptFileManifest(prompt).attachmentSlots.find(item=>item.role==='FINISHED_PRODUCT'&&item.required);assert.ok(slot,'Stage 21 must issue its required finished-product slot.');request.attachments=[{attachmentSlotId:slot.attachmentSlotId,role:slot.role,temporaryKey:'product-file',filename:'result.txt',mediaType:'text/plain',byteSize:Buffer.byteLength(OUTPUT),sha256:hash.sha256Text(OUTPUT),required:true}];request.evidence[0].attachmentRef={tempKey:'product-file'};await retainFixtureFile('PRODUCT-FILE','result.txt',OUTPUT);files.push({artifactId:artifactFixtureId(engine,p,'PRODUCT-FILE'),name:'result.txt',type:'text/plain',size:Buffer.byteLength(OUTPUT),sha256:hash.sha256Text(OUTPUT),attachmentSlotId:ingestion.attachmentSlotPlan(p,request,prompt)[0].attachmentSlotId});}
      const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(request),promptRecord:prompt,files,transport:{packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce}});assert.equal(prepared.validation.valid,true,JSON.stringify(prepared.validation.issues));p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'SYNTHETIC'}).project;cases.push({stage,operation:prompt.operation,result:'PASS'});
      if(prompt.operation==='VERIFY'){const scope=prompt.scope,iterationId=scope.iterationId||scope.confirmationIterationId,runs=engine.records(p,'runs').filter(row=>String(engine.recordValue(row,'ITERATION_ID')||row.scope?.iterationId||'')===iterationId),verified=new Set(engine.records(p,'verification').filter(row=>(row.scope?.iterationId||row.scope?.confirmationIterationId)===iterationId).map(row=>String(engine.recordValue(row,'RUN_ID')||''))),remaining=runs.filter(row=>!verified.has(id(row,'runs')));if(remaining.length)assert.equal(engine.operationalNextAction(p,stage).operation,'VERIFY','ITERATION_PARTIAL_VERIFY_ORACLE: every bound run must be verified before the workflow advances');}

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
  if(stage===22){
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
console.log(JSON.stringify({counterpartContracts:'PASS',stages:stageLimit,cases,sourceCommit:process.env.GITHUB_SHA||null,injectedFault,actualBrowserJourney:false,externalOutputs:'SYNTHETIC',persistenceCheckedAfterEveryOperation:true}));
