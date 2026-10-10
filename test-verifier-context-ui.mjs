import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {projectStoreRuntime,bindAcceptanceUi} from './test-project-store-runtime.mjs';
import {deferredDefinitionRestorationFixture,authorizeFixtureHandoff} from './test-fixtures.mjs';
import {readStoreArchive} from './test-zip.mjs';
import {responseFixture} from './operator-journey-fixtures.mjs';

// The retained cohort establishes real Stage 11 prerequisites. Its historical
// wrong-run verifier evidence remains untouched and is not counted as valid.
// Only the original producer's faulty selection is simulated below; issuance,
// UI save, persistence, package bytes and response-file admission are real owners.
export async function verifyVerifierContextUi({sourceOverrides={},fault=null}={}){
 const r=projectStoreRuntime({sourceOverrides}),e=r.engine,i=r.ingestion,h=r.runtime.closedLoopHash,schema=r.runtime.closedLoopWorkflowSchema,cases=[];
 const source=sourceOverrides['app-core.js']??fs.readFileSync('app-core.js','utf8'),promptSource=sourceOverrides['prompt-engine.js']??fs.readFileSync('prompt-engine.js','utf8');
 const extract=name=>{const start=source.search(new RegExp('(?:async )?function '+name+'\\(')),ends=[source.indexOf('\nfunction ',start+1),source.indexOf('\nasync function ',start+1)].filter(x=>x>=0);assert(start>=0&&ends.length,'VERIFIER_UI_OWNER_SOURCE_REQUIRED: '+name);return source.slice(start,Math.min(...ends));};
 const {p:restored}=await deferredDefinitionRestorationFixture(r,{family:'regressions',filename:'verification/deferred-definition-compatibility-legacy-fixture-20261005.json'});restored.activeStage=12;restored.activeView='Workflow';
 assert.equal(e.gate(11,restored).complete,true,'VERIFIER_UI_REAL_STAGE11_PREREQUISITE_ORACLE');
 let p=await r.store.writeProject(restored,{createOnly:true,expectedProjectRevision:0,incrementRevision:false});
 const verification=e.recordsForIteration(p,'verification',p.job.CURRENT_ITERATION).filter(row=>Number(row.stage)===12),first=verification.find(row=>{const context=p.projectData.freshContexts.find(ctx=>ctx.id===e.recordValue(row,'VERIFIER_CONTEXT_ID'));return e.contextRunBinding(context,e.recordValue(row,'RUN_ID')).matches;}),other=verification.find(row=>e.recordValue(row,'RUN_ID')!==e.recordValue(first,'RUN_ID'));
 assert(first&&other,'VERIFIER_UI_TWO_RETAINED_RUNS_REQUIRED');
 const firstRunId=e.recordValue(first,'RUN_ID'),runId=e.recordValue(other,'RUN_ID'),wrongContextId=e.recordValue(first,'VERIFIER_CONTEXT_ID'),wrongContext=p.projectData.freshContexts.find(row=>row.id===wrongContextId);
 assert.equal(e.contextRunBinding(wrongContext,runId).mismatched,true,'VERIFIER_UI_LEGACY_WRONG_BINDING_REQUIRED');
 const originalProducer=r.prompts,wrongContextHash=h.sha256Value(wrongContext),retained=Object.fromEntries(['rawResponses','acceptedChanges','verification','responseProposals','responseValidations'].map(family=>[family,h.sha256Value(p.projectData[family])])),priorHistory=p.projectData.history.map(row=>h.sha256Value(row));
 // Documented equivalent of the pre-fix automatic selector: fields.RUN_ID was
 // NOT APPLICABLE, hiding its existing scope.runId and reusing run 1 for run 2.
 r.runtime.closedLoopWorkflowEngine=Object.freeze({...e,preparePromptContext(project,stage,options){return {project,options:{...options,scope:{...e.operationScope(project,stage,options.operation,options.scope||{},{reserveTargets:true}),contextId:wrongContextId}}};}});
 vm.runInContext(promptSource,r.runtime,{filename:'prompt-engine.js:wrong-run-selection-equivalent'});
 const legacyProducer=r.runtime.closedLoopPromptEngine,draft=r.copy(p),old=legacyProducer.reserveAndBuildPromptRecord(draft,12,{operation:'VERIFY',scope:{runId}}).prompt;
 p=await r.store.writeProject(draft,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
 r.runtime.closedLoopWorkflowEngine=e;r.runtime.closedLoopPromptEngine=originalProducer;
 const oldSaved=p.projectData.generatedPrompts.find(row=>row.instructionId===old.instructionId),oldBytes=oldSaved.prompt,oldHash=h.sha256Value(oldSaved);
 assert.equal(oldSaved.promptEngineVersion,originalProducer.versionFor(12,'VERIFY'),'VERIFIER_UI_NO_EPOCH_WORKAROUND_ORACLE');
 assert(originalProducer.promptTransportBinding(p,12,'VERIFY',oldSaved.instructionId,oldSaved.scope),'VERIFIER_UI_CURRENT_OLD_TRANSPORT_REQUIRED');
 const failures=bindAcceptanceUi(r,p,null);Object.assign(r.runtime,{schema,recordValue:e.recordValue,runSelection:{12:runId},selectedOperation:()=> 'VERIFY',externalAgentOperation:()=>true,operationExecutorClass:()=> 'EXTERNAL_AGENT'});
 const cloneStart=source.indexOf('clone=')+6,cloneEnd=source.indexOf(',esc=',cloneStart);assert(cloneStart>=6&&cloneEnd>cloneStart,'VERIFIER_UI_APP_CLONE_SOURCE_REQUIRED');r.runtime.clone=vm.runInContext('('+source.slice(cloneStart,cloneEnd)+')',r.runtime);assert.equal(r.runtime.clone(undefined),undefined);assert.equal(r.runtime.clone('plain value'),'plain value');assert.equal(JSON.stringify(r.runtime.clone({ordinary:['value']})),JSON.stringify({ordinary:['value']}));
 {const splitState=r.copy(p);splitState.job.EXACT_DELIVERABLE_REQUESTED='SYNTHETIC authorized split-context clone control. '.repeat(1600);const splitPrompt=originalProducer.buildPromptRecord(1,splitState,{operation:'COMPLETE'}),exactFiles=originalProducer.materializePromptContextFiles(splitPrompt);assert(exactFiles.length>0,'VERIFIER_UI_SPLIT_CONTEXT_CONTROL_REQUIRED');assert.throws(()=>originalProducer.materializePromptContextFiles(structuredClone(splitPrompt)),/Exact prompt context bytes are unavailable\./,'VERIFIER_UI_PLAIN_CLONE_COUNTEREXAMPLE_ORACLE');const cloned=r.runtime.clone({projectData:{generatedPrompts:[splitPrompt]}});assert.deepEqual(r.copy(originalProducer.materializePromptContextFiles(cloned.projectData.generatedPrompts[0])),r.copy(exactFiles),'VERIFIER_UI_EXACT_CONTEXT_CLONE_ORACLE');assert.equal(cloned.projectData.generatedPrompts[0].prompt,splitPrompt.prompt);}
 let owners=['reviewerOperation','currentReviewerContext','currentRunSlots','selectedRun','promptOptions','promptMatches','currentPromptEngineVersion','promptVersionCurrent','currentPromptRecord','savePromptRecord'].map(extract).join('\n');
 if(fault==='reuse-wrong-context'){
  const guard='return target?engine.currentVerificationContext(current,Number(n),target):null;';assert(owners.includes(guard));owners=owners.replace(guard,"return engine.records(current,'freshContexts').filter(row=>Number(row.stage)===Number(n)&&String(recordValue(row,'RUN_ID'))==='NOT APPLICABLE').at(-1)||null;");
 }
 if(fault==='trust-cached-context'){
  const guard=" if(record.operation==='VERIFY'&&schema.operationContract(Number(n),'VERIFY')?.scopeRequirements.includes('runId')&&!engine.currentVerificationContext(current,Number(n),record.scope?.runId,record.scope?.contextId))return false;";assert(owners.includes(guard));owners=owners.replace(guard,'');
 }
 if(fault==='omit-nonrun-binding'){const guard='&&!engine.contextRunBinding(r,null).known';assert(owners.includes(guard));owners=owners.replace(guard,'');}
 vm.runInContext(owners+'\nglobalThis.verifierUi={options:()=>promptOptions(12),current:()=>currentPromptRecord(12),save:()=>savePromptRecord(12),reviewer:n=>currentReviewerContext(n)};',r.runtime);
 const cleanStage9=r.runtime.verifierUi.reviewer(9);assert(cleanStage9,'VERIFIER_UI_NONRUN_CONTROL_REQUIRED');const observedCurrent=r.runtime.current,nonrunProbe=r.copy(observedCurrent);for(const context of nonrunProbe.projectData.freshContexts.filter(row=>Number(row.stage)===9))context.scope.runId=runId;r.runtime.current=nonrunProbe;assert.equal(r.runtime.verifierUi.reviewer(9),null,'VERIFIER_UI_NONRUN_CONTEXT_ORACLE');r.runtime.current=observedCurrent;assert.equal(r.runtime.verifierUi.reviewer(9).id,cleanStage9.id);cases.push({caseId:'nonrun-reviewer-binding-isolation',passed:true,cleanStage9Preserved:true,runBoundStage9Rejected:true,exactSplitContextClonePreserved:true});
 assert.equal(r.runtime.verifierUi.options().scope.contextId,undefined,'VERIFIER_UI_WRONG_SELECTION_ORACLE');
 assert.equal(r.runtime.verifierUi.current(),null,'VERIFIER_UI_WRONG_CACHE_ORACLE');
 const fresh=await r.runtime.verifierUi.save();p=r.runtime.current;
 assert.equal(failures.length,0);assert.notEqual(fresh.instructionId,old.instructionId);assert.notEqual(fresh.scope.contextId,wrongContextId);assert.equal(fresh.scope.runId,runId);
 const expectedCorrectionCell={requirementId:e.recordValue(other,'REQ_ID'),runId,testId:e.recordValue(other,'TEST_ID')};assert.deepEqual(r.copy(fresh.contextManifest.verificationBatchPlan.triples),r.copy([expectedCorrectionCell]),'VERIFIER_UI_INVALID_CELL_ASSIGNMENT_ORACLE');
 const freshContext=p.projectData.freshContexts.find(row=>row.id===fresh.scope.contextId);assert.equal(e.contextRunBinding(freshContext,runId).matches,true);assert.equal(h.sha256Value(p.projectData.freshContexts.find(row=>row.id===wrongContextId)),wrongContextHash,'VERIFIER_UI_OLD_CONTEXT_UNCHANGED_ORACLE');
 assert.equal(p.projectData.generatedPrompts.find(row=>row.instructionId===old.instructionId).prompt,oldBytes);assert.equal(h.sha256Value(p.projectData.generatedPrompts.find(row=>row.instructionId===old.instructionId)),oldHash,'VERIFIER_UI_OLD_ISSUANCE_UNCHANGED_ORACLE');
 for(const [family,sha]of Object.entries(retained))assert.equal(h.sha256Value(p.projectData[family]),sha,'VERIFIER_UI_RETAINED_WORK_ORACLE: '+family);
 assert.deepEqual(p.projectData.history.slice(0,priorHistory.length).map(row=>h.sha256Value(row)),priorHistory,'VERIFIER_UI_HISTORY_PREFIX_ORACLE');
 assert.equal(originalProducer.promptTransportBinding(p,12,'VERIFY',old.instructionId,old.scope),null,'VERIFIER_UI_OLD_TRANSPORT_STALE_ORACLE');
 cases.push({caseId:'saved-wrong-run-refresh',passed:true,oldPromptVersion:old.promptEngineVersion,newPromptVersion:fresh.promptEngineVersion,oldRawAndAcceptedWorkPreserved:true,oldContextUnchanged:true,oldTransportCurrent:false});
 const contextCount=p.projectData.freshContexts.length,promptCount=p.projectData.generatedPrompts.length,revision=p.revision;
 assert.equal(r.runtime.verifierUi.options().scope.contextId,fresh.scope.contextId,'VERIFIER_UI_CURRENT_SELECTION_ORACLE');assert.equal((await r.runtime.verifierUi.save()).instructionId,fresh.instructionId,'VERIFIER_UI_REPEAT_SAVE_ORACLE');assert.equal(r.runtime.current.revision,revision);assert.equal(r.runtime.current.projectData.freshContexts.length,contextCount);assert.equal(r.runtime.current.projectData.generatedPrompts.length,promptCount);
 r.runtime.runSelection[12]=firstRunId;assert.equal(r.runtime.verifierUi.options().scope.contextId,undefined,'VERIFIER_UI_PRIOR_CROSS_RUN_EXPOSURE_ORACLE');r.runtime.runSelection[12]=runId;
 cases.push({caseId:'current-own-run-reuse',passed:true,idempotentSave:true,historicalCrossRunContextExcludedFromFutureSelection:true});
 const authorized=await authorizeFixtureHandoff(r,{project:p,prompt:fresh});p=authorized.project;r.runtime.current=p;r.runtime.projects=r.copy([p]);
 const prompt=authorized.prompt,pkg=await r.store.createExecutionPackage(authorized.request),members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer())),get=path=>members.find(row=>row.canonicalPath===path),manifest=JSON.parse(Buffer.from(get('manifest.json').bytes).toString('utf8')),instructionBytes=Buffer.from(get('instruction.txt').bytes),contextFiles=members.filter(row=>row.canonicalPath.startsWith('context/')).map(row=>({...row,bytes:Buffer.from(row.bytes)}));
 assert.equal(instructionBytes.toString('utf8'),prompt.prompt,'VERIFIER_UI_EXACT_PACKAGED_INSTRUCTION_ORACLE');const runAlias=prompt.contextManifest.blindAliasMap.find(row=>row.kind==='RUN_ID'&&row.canonicalId===runId)?.alias||runId;assert.equal(manifest.scope.runId,runAlias,'VERIFIER_UI_SAVED_ALIAS_BINDING_ORACLE');assert.equal(manifest.scope.contextId,prompt.scope.contextId);
 const publicPrompt={...prompt,scope:manifest.scope},envelope=responseFixture({schema,engine:e,prompt:publicPrompt,manifest,contextFiles,instructionBytes});
 assert.equal(envelope.records.verification.length,1,'VERIFIER_UI_ONE_EXPORTED_RUN_ORACLE');assert.equal(envelope.records.verification[0].relationships.RUN_ID.recordId,manifest.scope.runId);assert.equal(envelope.records.verification[0].fields.VERIFIER_CONTEXT_ID,manifest.scope.contextId);
 // Independently inspect every exported data carrier, including split context
 // members. Other retained run outputs and reviewer IDs must not be supplied.
 const data=[];for(const file of contextFiles){const container=JSON.parse(file.bytes.toString('utf8'));for(const member of container.members||[])data.push(member);}
 for(const match of instructionBytes.toString('utf8').matchAll(/BEGIN_UNTRUSTED_DATA_BLOCK\s*([\s\S]*?)\s*END_UNTRUSTED_DATA_BLOCK/g))data.push(JSON.parse(match[1]));
 const runRows=data.filter(member=>member.sourceIdentity==='collection.runs').flatMap(member=>JSON.parse(member.value).records||[]);assert.equal(runRows.length,1,'VERIFIER_UI_EXPORTED_RUN_ISOLATION_ORACLE');assert.equal(e.recordId(runRows[0],'runs'),manifest.scope.runId);
 const otherRunIds=e.recordsForIteration(p,'runs',p.job.CURRENT_ITERATION).map(row=>e.recordId(row,'runs')).filter(id=>id!==runId),carriers=[instructionBytes.toString('utf8'),...contextFiles.map(file=>file.bytes.toString('utf8')),JSON.stringify(manifest)];
 for(const forbidden of [...otherRunIds,wrongContextId])assert.equal(carriers.some(text=>text.includes(forbidden)),false,'VERIFIER_UI_OTHER_RUN_CARRIER_ORACLE: '+forbidden);
 const priorReviewIds=['observationRecords','entailmentReviews'].flatMap(family=>e.records(p,family).filter(row=>Number(row.stage)===12).map(row=>e.recordId(row,family)));assert(priorReviewIds.length>0,'VERIFIER_UI_PRIOR_REVIEW_CARRIER_CONTROL_REQUIRED');for(const forbidden of priorReviewIds)assert.equal(carriers.some(text=>text.includes(forbidden)),false,'VERIFIER_UI_PRIOR_REVIEW_CARRIER_ORACLE: '+forbidden);
 const text=JSON.stringify(envelope),staged=await r.store.stageResponseFile({jobId:p.job.JOB_ID,stage:12,blob:new Blob([text],{type:'application/json'}),rawFilename:'response.json',mediaType:'application/json',promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce}),file=await r.store.readStagedResponseFile({jobId:p.job.JOB_ID,stagingId:staged.stagingId}),captured=i.captureRaw(p,{stage:12,text:new TextDecoder('utf-8',{fatal:true}).decode(file.bytes),promptRecord:prompt,transport:r.copy({authority:'AUTHORITATIVE_RESPONSE_FILE',stagingId:staged.stagingId,rawFilename:'response.json',mediaType:'application/json',status:file.status,sha256:file.sha256,byteSize:file.byteSize,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce})}),prepared=i.prepareCaptured(captured.project,{rawResponseId:captured.rawRecord.rawResponseId});
 assert.equal(prepared.validation.valid,true,'VERIFIER_UI_FILE_ADMISSION_ORACLE: '+JSON.stringify(prepared.validation.issues));assert.equal(prepared.proposal.status,'PENDING_OPERATOR_REVIEW');
 p=await r.store.writeProject(prepared.project,{operational:true,expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});const reloaded=await r.store.readProject(p.job.JOB_ID);
 assert.equal(i.findRaw(reloaded,captured.rawRecord.rawResponseId).completeRawResponse,text);assert.equal(i.findProposal(reloaded,prepared.proposal.proposalId).status,'PENDING_OPERATOR_REVIEW');assert.equal(h.sha256Value(reloaded.projectData.acceptedChanges),retained.acceptedChanges,'VERIFIER_UI_NO_AUTOMATIC_ACCEPTANCE_ORACLE');
 cases.push({caseId:'corrected-package-file-admission',passed:true,exportedRuns:1,otherRunCarrierLeaks:0,priorReviewerRecordLeaks:0,invalidRetainedCellAssigned:true,stagedFileAdmitted:true,persistedPendingProposal:true,automaticAcceptance:false});
 return {verifierContextUi:'PASS',cases,synthetic:true,actualBrowser:false,stageCompletionEstablished:false,boundary:'Actual extracted UI run selection/cache/save, real canonical persistence and exported instruction/context ZIP, actual staged response-file admission and proposal reload. Preserved retained prerequisite cohort; no new full journey or real external actor claim.'};
}
