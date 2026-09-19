import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {readStoreArchive} from './test-zip.mjs';
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
await checkUi();
const uiFault={id:'BYPASS-UI-HANDOFF-TEST-SELECTION',before:'providedTestIds.has(String(item.testId))&&',after:''};
await assert.rejects(checkUi(uiFault),/UI_TEST_SELECTION_ORACLE/);await checkUi();
await check();
const faults=[
  {id:'BYPASS-EXPORTED-TEST-SCOPE',file:'project-store.js',before:'if(ids.some(id=>!permittedTestIds.has(id)))',after:'if(false)'},
  {id:'BYPASS-EXPORTED-ALIAS-SCOPE',file:'project-store.js',before:'if(providedAlias&&!promptAliases.some(entry=>hash.sha256Value(entry)===hash.sha256Value(providedAlias)))',after:'if(false)'}
];
for(const fault of faults){await assert.rejects(check(fault),/METADATA_SCOPE_ORACLE/);await check();}
console.log(JSON.stringify({handoffMetadataBoundary:'PASS',synthetic:true,actualZipBytesInspected:true,unknownTestIdsRejected:true,unprovidedAliasesRejected:true,savedProjectPreserved:true,unchangedInstructionBytes:true,uiRequestsOnlyProvidedExternalTests:true,uiFault:{id:uiFault.id,result:'DETECTED',restored:'PASS'},implementationFaults:faults.map(f=>({id:f.id,result:'DETECTED',restored:'PASS'}))},null,2));
