import {artifactFixtureId} from './test-artifact-fixtures.mjs';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {responseFixture,OBJECTIVE,OUTPUT,CANDIDATE} from './operator-journey-fixtures.mjs';
globalThis.dispatchEvent=()=>true;
const injectedFault=process.env.CLRT_COUNTERPART_FAULT||null;
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js']){let source=fs.readFileSync(file,'utf8');if(file==='workflow-engine.js'&&injectedFault==='fractional-stability')source=source.replace('const snapshot=clone(stability),denominator=Number(snapshot.runCount||0);','return stability; const snapshot=clone(stability),denominator=Number(snapshot.runCount||0);');if(file==='workflow-engine.js'&&injectedFault==='missing-defect-gate')source=source.replace('if(facts.anyViolation&&!recordsForIteration','if(false&&facts.anyViolation&&!recordsForIteration');if(file==='workflow-engine.js'&&injectedFault==='partial-verification-completes-operation'){const before="if(out.has('VERIFY')){const matrix=verificationMatrix(project,selectedIteration);";assert(source.includes(before),'Partial verification fault anchor is missing');source=source.replace(before,"if(false&&out.has('VERIFY')){const matrix=verificationMatrix(project,selectedIteration);");}createVerifierRuntime.loadScript(globalThis,source,{filename:file});}
const engine=closedLoopWorkflowEngine,schema=closedLoopWorkflowSchema,prompts=closedLoopPromptEngine,ingestion=closedLoopResponseIngestion,hash=closedLoopHash;
let p=closedLoopCore.createBlankState('COUNTERPART-CONTRACT-PREFLIGHT');p.job.JOB_TITLE='Complete operator journey';p.job.EXACT_USER_OBJECTIVE_VERBATIM=OBJECTIVE;engine.ensureShape(p);engine.recalculate(p);
const value=engine.recordValue,id=engine.recordId,latest=family=>engine.recordsForCurrentScope(p,family).at(-1),cases=[];
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
    else if(action.actionType==='FREEZE_CANDIDATE'){if(!engine.records(p,'artifacts',{active:false}).some(row=>engine.recordId(row,'artifacts')===artifactFixtureId(engine,p,'CANDIDATE-FILE')))engine.registerArtifactBytes(p,{stage,artifactId:artifactFixtureId(engine,p,'CANDIDATE-FILE'),filename:'production-instruction.txt',mediaType:'text/plain',byteSize:Buffer.byteLength(CANDIDATE),sha256:hash.sha256Text(CANDIDATE)});const decision=engine.recordRegisteredHumanDecision(p,{stage,purpose:'CANDIDATE_COMPONENT_SELECTION',targetFamily:'artifacts',targetId:hash.sha256Value([artifactFixtureId(engine,p,'CANDIDATE-FILE')]),value:[artifactFixtureId(engine,p,'CANDIDATE-FILE')],operatorLabel:'SYNTHETIC'});engine.freezeCandidate(p,{stage,artifactIds:[artifactFixtureId(engine,p,'CANDIDATE-FILE')],selectionDecisionId:id(decision,'humanDecisions')});}
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
      const {prompt}=prompts.reserveAndBuildPromptRecord(p,stage,{operation:action.operation||schema.STAGE_CONTRACTS[stage].operations[0]});const request=responseFixture({schema,engine,prompt,manifest:prompts.promptFileManifest(prompt),instructionBytes:Buffer.from(prompt.prompt),omitTerminalLF:stage===11&&!cases.some(row=>row.stage===11)}),files=[];
      if(stage===21){const slot=prompts.promptFileManifest(prompt).attachmentSlots.find(item=>item.role==='FINISHED_PRODUCT'&&item.required);assert.ok(slot,'Stage 21 must issue its required finished-product slot.');request.attachments=[{attachmentSlotId:slot.attachmentSlotId,role:slot.role,temporaryKey:'product-file',filename:'result.txt',mediaType:'text/plain',byteSize:Buffer.byteLength(OUTPUT),sha256:hash.sha256Text(OUTPUT),required:true}];request.evidence[0].attachmentRef={tempKey:'product-file'};files.push({artifactId:artifactFixtureId(engine,p,'PRODUCT-FILE'),name:'result.txt',type:'text/plain',size:Buffer.byteLength(OUTPUT),sha256:hash.sha256Text(OUTPUT),attachmentSlotId:ingestion.attachmentSlotPlan(p,request,prompt)[0].attachmentSlotId});}
      const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(request),promptRecord:prompt,files,transport:{packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce}});assert.equal(prepared.validation.valid,true,JSON.stringify(prepared.validation.issues));p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'SYNTHETIC'}).project;cases.push({stage,operation:prompt.operation,result:'PASS'});
      if(prompt.operation==='VERIFY'){const scope=prompt.scope,iterationId=scope.iterationId||scope.confirmationIterationId,runs=engine.records(p,'runs').filter(row=>String(engine.recordValue(row,'ITERATION_ID')||row.scope?.iterationId||'')===iterationId),verified=new Set(engine.records(p,'verification').filter(row=>(row.scope?.iterationId||row.scope?.confirmationIterationId)===iterationId).map(row=>String(engine.recordValue(row,'RUN_ID')||''))),remaining=runs.filter(row=>!verified.has(id(row,'runs')));if(remaining.length)assert.equal(engine.operationalNextAction(p,stage).operation,'VERIFY','ITERATION_PARTIAL_VERIFY_ORACLE: every bound run must be verified before the workflow advances');}

    }else throw new Error('No progressing fixture command: '+JSON.stringify(action));
    engine.recalculate(p);
    assert.doesNotThrow(()=>hash.sha256Value(p),`Stage ${stage} ${action.actionType} must remain persistable after every operation`);
  }
  assert.equal(engine.gate(stage,p).complete,true,JSON.stringify({stage,reasons:engine.gate(stage,p).reasons}));
  if(stage===13){
    const invalid=engine.clone(p);invalid.projectData.defects=[];
    const rejected=engine.gate(13,invalid);
    assert.equal(rejected.complete,false,'An observed initial violation without an evidence-linked defect must be rejected');
    assert(rejected.reasons.some(reason=>reason.includes('current evidence-linked defect')),'Rejection must identify the missing defect, not an unrelated gate');
    assert.equal(engine.gate(13,p).complete,true,'The otherwise valid comparison must progress when its defect is restored');
    assert.equal(engine.gate(11,p).complete,true,'Recording a failure must preserve the completed initial run batch');
    cases.push({stage:13,caseId:'initial-violation-defect-rejection-and-correction',rejectionReasons:rejected.reasons,result:'PASS'});
  }
}
console.log(JSON.stringify({counterpartContracts:'PASS',stages:stageLimit,cases,sourceCommit:process.env.GITHUB_SHA||null,injectedFault,actualBrowserJourney:false,externalOutputs:'SYNTHETIC',persistenceCheckedAfterEveryOperation:true}));
