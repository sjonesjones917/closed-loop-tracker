import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {readStoreArchive} from './test-zip.mjs';
import {artifactFixtureId} from './test-artifact-fixtures.mjs';
import {createVerifierRuntime} from './verifier-runtime.mjs';

// Exercises the production exporter and actual ZIP bytes. The storage adapter
// is synthetic; this is not a browser, physical-device, or complete journey.
async function check(fault=null){
  const {core,engine,store,runtime,copy}=projectStoreRuntime({fault}),prompts=runtime.closedLoopPromptEngine;
  let project=core.createBlankState('HANDOFF-METADATA-BOUNDARY');engine.ensureShape(project);
  project.job.EXACT_USER_OBJECTIVE_VERBATIM='Produce an exact text file.';engine.recalculate(project);
  const futureId=engine.allocateId(project,'tests'),future=copy({id:futureId,stage:6,active:true,scope:{inputVersion:project.job.CURRENT_INPUT_VERSION},fields:{TEST_ID:futureId,PROCEDURE:'PRIVATE_SUBSEQUENT_STAGE_TEST_CONTENT'},source:'SYNTHETIC_PARTIAL_FUTURE_WORK'});
  engine.refreshRecordHashes(future,'tests');project.projectData.tests.push(future);
  const options=engine.preparePromptContext(project,1,{operation:'COMPLETE'}).options;
  const prompt=prompts.buildPromptRecord(1,project,options);project.projectData.generatedPrompts.push(prompt);
  project=await store.writeProject(project,{expectedProjectRevision:0});
  const before=JSON.stringify(await store.readProject(project.job.JOB_ID));
  for(const extra of [{testIds:[futureId]},{testIds:['PRIVATE_SUBSEQUENT_STAGE_TEST_ID']},{reviewerAliasContext:{canonicalId:'PRIVATE_SUBSEQUENT_STAGE_PRODUCT',alias:'PRIVATE_SUBSEQUENT_STAGE_ALIAS'}}]){
    await assert.rejects(store.createExecutionPackage({project,stage:1,operation:'COMPLETE',...extra}),error=>error.code==='EXECUTION_PACKAGE_CONTEXT_MISMATCH','METADATA_SCOPE_ORACLE: unprovided handoff metadata was exported');
    assert.equal(JSON.stringify(await store.readProject(project.job.JOB_ID)),before,'Rejected metadata changed the saved project');
  }
  const bundle=await store.createExecutionPackage({project,stage:1,operation:'COMPLETE'});
  const members=readStoreArchive(new Uint8Array(await bundle.blob.arrayBuffer()));
  const manifest=JSON.parse(new TextDecoder().decode(members.find(row=>row.canonicalPath==='manifest.json').bytes));
  assert.deepEqual(manifest.testIds,[]);assert.equal(manifest.reviewerAlias,null);
  assert(!members.some(row=>new TextDecoder().decode(row.bytes).includes('PRIVATE_SUBSEQUENT_STAGE')||new TextDecoder().decode(row.bytes).includes(futureId)),'METADATA_SCOPE_ORACLE: private metadata escaped in ZIP bytes');
  assert.equal(new TextDecoder().decode(members.find(row=>row.canonicalPath==='instruction.txt').bytes),prompt.prompt);
  assert.deepEqual(manifest.scope,JSON.parse(JSON.stringify(prompts.promptFileManifest(prompt).scope)));
}
async function checkUi(fault=null){
  let source=fs.readFileSync('app-core.js','utf8');
  if(fault){assert(source.includes(fault.before));source=source.replace(fault.before,fault.after);}
  const begin=source.indexOf('async function exportStageFiles('),end=source.indexOf('async function exportPromptContext(',begin);
  let downloads=0;
  const runtime=createVerifierRuntime({Set,Blob,Number,String,current:{job:{JOB_ID:'UI-SCOPE'},activeStage:12,revision:1},promptExport:async operation=>operation({instructionId:'CURRENT-INSTRUCTION',contextManifest:{readCollections:{tests:[{id:'ALLOWED'},{id:'NATIVE'}]}}}),withStorageActivity:async(_label,operation)=>operation(),promptOptions:()=>({operation:'VERIFY',scope:{runId:'CURRENT-RUN'}}),displayedStageAction:()=>({actionType:'AI_REVIEW'}),stagePlanItems:()=>[{testId:'ALLOWED',executionMode:'INDEPENDENT_AGENT_REVIEW',operatorAction:'SEND_TO_INDEPENDENT_REVIEWER'},{testId:'OUTSIDE_CURRENT_BATCH',executionMode:'INDEPENDENT_AGENT_REVIEW',operatorAction:'SEND_TO_INDEPENDENT_REVIEWER'},{testId:'NATIVE',executionMode:'APPLICATION_DETERMINISTIC',operatorAction:'SEND_TO_INDEPENDENT_REVIEWER'}],projectStore:{createExecutionPackage:async args=>{assert.deepEqual([...args.testIds],['ALLOWED'],'UI_TEST_SELECTION_ORACLE: stage export requested tests outside the saved handoff');return {blob:new Blob(['fixture']),filename:'stage.zip'};}},downloadBlob:()=>downloads++,recordInstructionExport:async()=>{},announce(){},render(){},requestAnimationFrame(){}});
  vm.runInContext(source.slice(begin,end)+';globalThis.invoke=exportStageFiles;',runtime);
  await runtime.invoke();assert.equal(downloads,1);
}

// The output is not a test fixture known at definition time. It is the exact
// accepted target-run artifact, and the exporter must not expose another run.
async function checkRunOutput(stage,fault=null){
 const r=projectStoreRuntime({fault}),{engine,core,store,prompts}=r,h=r.runtime.closedLoopHash,schema=r.runtime.closedLoopWorkflowSchema;
 let project=core.createBlankState('TARGET-RUN-FILES-'+stage);engine.ensureShape(project);
 Object.assign(project.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Inspect the exact target output file.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-v001',CURRENT_RESEARCH_VERSION:'RESEARCH-v001',CURRENT_REQUIREMENTS_VERSION:'REQ-v001',CURRENT_TEST_SUITE_VERSION:'TEST-v001',CURRENT_INSTRUCTION_VERSION:'INST-v001'});
 const retain=async(label,filename,bytes,ownerStage,role)=>{const artifactId=artifactFixtureId(engine,project,label);await store.putArtifact({jobId:project.job.JOB_ID,artifactId,filename,blob:new Blob([bytes]),mediaType:'application/octet-stream'});engine.registerArtifactBytes(project,{stage:ownerStage,artifactId,filename,byteSize:bytes.length,sha256:h.sha256Text(bytes),role});return artifactId;};
 const candidate=await retain('candidate','candidate.txt','candidate',10,'CANDIDATE_COMPONENT'),freezeStage=stage===12?10:17;
 const decision=engine.recordRegisteredHumanDecision(project,{stage:freezeStage,purpose:'CANDIDATE_COMPONENT_SELECTION',targetFamily:'artifacts',targetId:h.sha256Value([candidate]),value:[candidate]});
 const frozen=engine.freezeCandidate(project,{stage:freezeStage,artifactIds:[candidate],selectionDecisionId:engine.recordId(decision,'humanDecisions')});
 let iterationId=engine.recordId(frozen.iteration,'iterations');
 if(stage===19){project.stages[18].status='COMPLETE';iterationId=engine.recordId(engine.beginUnchangedConfirmationIteration(project,{candidateId:engine.recordId(frozen.candidate,'candidateFreezes')}),'iterations');}
 const runStage=stage===12?11:stage,slots=engine.reserveRunBatch(project,{stage:runStage,iterationId,count:10}),target=slots[0],other=slots[1],scope=engine.scopeForIteration(project,iterationId);
 const targetBytes='EXACT_TARGET_OUTPUT\n',otherBytes='PRIVATE_OTHER_RUN_OUTPUT\n';
 const targetArtifact=await retain('target-output','target-output.txt',targetBytes,runStage,'RUN_OUTPUT'),otherArtifact=await retain('other-output','other-output.txt',otherBytes,runStage,'RUN_OUTPUT');
 for(const [slot,artifactId]of[[target,targetArtifact],[other,otherArtifact]]){const run=engine.records(project,'runs').find(row=>engine.recordId(row,'runs')===slot.runId);run.fields.OUTPUT_ARTIFACT_IDENTITIES=run.OUTPUT_ARTIFACT_IDENTITIES=artifactId;run.fields.COMPLETE_OUTPUT=run.COMPLETE_OUTPUT='Read the returned output file.';engine.refreshRecordHashes(run,'runs');}
 for(const[family,identity,fields]of[['requirements','REQ-TARGET',{MANDATORY_OPTIONAL_STATUS:'MANDATORY',APPLICABILITY:'APPLICABLE',STATUS:'ACTIVE',OBLIGATION:'Target output conforms.'}],['tests','TEST-TARGET',{REQ_ID:'REQ-TARGET',TEST_TYPE:'MEANING',EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',REQUIRED_CAPABILITY:'INDEPENDENT_AGENT_REVIEW',ARTIFACT_REQUIREMENTS:'NONE',EVIDENCE_TO_PRESERVE:'Exact target bytes',STATUS:'READY',VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:12,REQUIRED_BY_STAGE:12,PER_RUN_REQUIRED:true,FINAL_PRODUCT_REQUIRED:false,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{type:'PHASE_TARGET'}}]]){const row=r.copy({id:identity,stage:family==='tests'?6:4,active:true,scope,fields:{...fields,[schema.RECORD_SCHEMAS[family].idField]:identity},...fields});engine.refreshRecordHashes(row,family);project.projectData[family].push(row);}
 for(let n=1;n<stage;n++){project.stages[n].status='COMPLETE';project.stages[n].gate=r.copy({complete:true,blocked:false,reasons:[]});}project.activeStage=stage;
 const options=engine.preparePromptContext(project,stage,{operation:'VERIFY',scope:{runId:target.runId}}).options,prompt=prompts.buildPromptRecord(stage,project,options);project.projectData.generatedPrompts.push(prompt);
 project=await store.writeProject(project,{expectedProjectRevision:0});
 const bundle=await store.createExecutionPackage({project,stage,operation:'VERIFY',runId:target.runId,testIds:['TEST-TARGET']}),members=readStoreArchive(new Uint8Array(await bundle.blob.arrayBuffer()));
 const manifest=JSON.parse(new TextDecoder().decode(members.find(row=>row.canonicalPath==='manifest.json').bytes)),identity=manifest.artifacts.find(row=>row.artifactId===targetArtifact);
 assert.ok(identity,'TARGET_OUTPUT_BYTES_ORACLE: exact target-run file omitted from exported handoff');
 assert.equal(identity.filename,'target-output.txt');assert.equal(identity.byteSize,Buffer.byteLength(targetBytes));assert.equal(identity.sha256,h.sha256Text(targetBytes));
 assert.ok(members.some(row=>Buffer.from(row.bytes).equals(Buffer.from(targetBytes))),'TARGET_OUTPUT_BYTES_ORACLE: target artifact bytes absent from actual ZIP');
 assert.ok(!manifest.artifacts.some(row=>row.artifactId===otherArtifact),'TARGET_OUTPUT_ISOLATION_ORACLE: other-run artifact exported');
 assert.ok(!members.some(row=>Buffer.from(row.bytes).includes(Buffer.from(otherBytes))||Buffer.from(row.bytes).includes(Buffer.from(otherArtifact))),'TARGET_OUTPUT_ISOLATION_ORACLE: other-run output entered actual ZIP');
 return {observationId:'TARGET-RUN-OUTPUT-HANDOFF-'+stage,stage,targetArtifactId:targetArtifact,targetFilename:identity.filename,targetByteSize:identity.byteSize,targetSha256:identity.sha256,actualZipBytesMatched:true,otherRunExcluded:true,result:'PASS'};
}
const targetRunOutputHandoffs=[];for(const stage of[12,17,19])targetRunOutputHandoffs.push(await checkRunOutput(stage));
const outputFault={id:'OMIT-CORRECTED-TARGET-OUTPUT',file:'workflow-engine.js',before:"if(stage===12||[17,19].includes(stage)&&op==='VERIFY'){",after:'if(stage===12){'};
await assert.rejects(checkRunOutput(17,outputFault),/TARGET_OUTPUT_BYTES_ORACLE/);await checkRunOutput(17);

await checkUi();
const uiFault={id:'BYPASS-UI-HANDOFF-TEST-SELECTION',before:'providedTestIds.has(String(item.testId))&&',after:''};
await assert.rejects(checkUi(uiFault),/UI_TEST_SELECTION_ORACLE/);await checkUi();
await check();
const faults=[
  {id:'BYPASS-EXPORTED-TEST-SCOPE',file:'project-store.js',before:'if(ids.some(id=>!permittedTestIds.has(id)))',after:'if(false)'},
  {id:'BYPASS-EXPORTED-ALIAS-SCOPE',file:'project-store.js',before:'if(providedAlias&&!promptAliases.some(entry=>hash.sha256Value(entry)===hash.sha256Value(providedAlias)))',after:'if(false)'}
];
for(const fault of faults){await assert.rejects(check(fault),/METADATA_SCOPE_ORACLE/);await check();}
console.log(JSON.stringify({handoffMetadataBoundary:'PASS',verificationObservations:targetRunOutputHandoffs.map(row=>({checkId:row.observationId,requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:3435','specification/closed-loop-reliability-controlling-implementation-specification.txt:3478','specification/closed-loop-reliability-controlling-implementation-specification.txt:3495'],boundary:'current target-run handoff -> actual exported ZIP bytes',expected:{filename:'target-output.txt',byteSize:20,sha256:'6da0c1babe83076b580fe8c3229be82a4554e161d2b23267cbf867c9a1f5bb33',otherRunExcluded:true},observed:{filename:row.targetFilename,byteSize:row.targetByteSize,sha256:row.targetSha256,otherRunExcluded:row.otherRunExcluded,actualZipBytesMatched:row.actualZipBytesMatched},passed:true})).concat([{checkId:outputFault.id,requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:3478'],boundary:'controlled former handoff -> target byte oracle',expected:{violationDetected:true},observed:{violationDetected:true,rejection:'TARGET_OUTPUT_BYTES_ORACLE'},violation:'MISSING_TARGET_RUN_OUTPUT',accepted:false,passed:true}]),synthetic:true,actualZipBytesInspected:true,targetRunOutputHandoffs,targetOutputFault:{id:outputFault.id,result:'DETECTED',restored:'PASS'},unknownTestIdsRejected:true,unprovidedAliasesRejected:true,savedProjectPreserved:true,unchangedInstructionBytes:true,uiRequestsOnlyProvidedExternalTests:true,uiFault:{id:uiFault.id,result:'DETECTED',restored:'PASS'},implementationFaults:faults.map(f=>({id:f.id,result:'DETECTED',restored:'PASS'}))},null,2));
