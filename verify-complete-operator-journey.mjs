import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {createOperatorBrowser,digest} from './operator-browser-driver.mjs';
import {responseFixture,OBJECTIVE,OUTPUT,CANDIDATE} from './operator-journey-fixtures.mjs';
import {verifyCompletedStageProjection} from './stage-projection-verification.mjs';

globalThis.dispatchEvent=()=>true;
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const engine=globalThis.closedLoopWorkflowEngine,schema=globalThis.closedLoopWorkflowSchema,hash=globalThis.closedLoopHash;
const directory=path.resolve(process.env.OPERATOR_EVIDENCE_DIR||'operator-evidence'),browser=await createOperatorBrowser({directory});
const report={basis:'SYNTHETIC_EXTERNAL_COUNTERPART_WITH_ACTUAL_BROWSER_FILE_TRANSPORT',humanIndependenceEstablished:false,physicalDeviceAcceptance:false,stages:[],operations:[],failures:[],complete:false};
let snapshot,stage=1,sequence=0,rejected=false,reloaded=false,recoveryExercised=false;
async function saved(){snapshot=await browser.project();const {packageSha256,...body}=snapshot.package;assert.equal(hash.sha256Value(body),packageSha256,'Actual downloaded backup must verify against its package digest');return snapshot.project;}
async function ingest(request,{invalid=false,accept=true}={}){
  const before=await saved(),count=before.projectData.acceptedChanges.length,bytes=Buffer.from(JSON.stringify(request)+'\n');
  await browser.selectFiles('#response-json-file',[{filename:'response.json',bytes}]);await browser.click('#process-response-file');
  if(invalid){const after=await saved();assert.equal(after.projectData.acceptedChanges.length,count,'Invalid response changed accepted work');assert.ok(after.projectData.responseValidations.some(row=>row.valid===false),'Invalid response did not preserve its rejection');return;}
  if(request.attachments.length){const slots=await browser.evaluate(`[...document.querySelectorAll('[data-returned-slot]')].map(node=>node.dataset.returnedSlot)`);assert.equal(slots.length,request.attachments.length);for(const slot of slots)await browser.selectFiles(`[data-returned-slot="${slot}"]`,[{filename:'result.txt',bytes:Buffer.from(OUTPUT)}]);await browser.click('#validate-returned-files');}
  if(!(await browser.exists('#accept-proposal')))throw new Error('Valid response did not expose proposal review: '+await browser.evaluate(`document.querySelector('#stage-workflow')?.innerText||document.body.innerText`));
  if(!accept)return;
  await browser.click('#accept-proposal');const after=await saved();assert.equal(after.projectData.acceptedChanges.length,count+1,'Accept did not commit exactly one response');assert.ok(after.projectData.rawResponses.some(row=>row.completeRawResponse===bytes.toString()),'The selected response bytes were not retained exactly');
  report.operations.push({stage,operation:request.operation,responseSha256:digest(bytes),acceptedChangeId:after.projectData.acceptedChanges.at(-1).changeId,revision:after.revision});
}
async function external({accept=true}={}){
  const [bundleFile]=await browser.download('#export-stage-files'),bundle=JSON.parse(gunzipSync(bundleFile.bytes).toString('utf8')),{packageSha256,...body}=bundle;
  assert.equal(hash.sha256Value(body),packageSha256,'Stage handoff package digest differs from downloaded bytes');
  const manifest=bundle.promptFileManifest,instruction={bytes:Buffer.from(bundle.instruction.text),sha256:digest(Buffer.from(bundle.instruction.text))};
  assert.equal(instruction.sha256,manifest.instruction.sha256);assert.equal(instruction.bytes.length,manifest.instruction.byteSize);
  const contextFiles=bundle.contextFiles.map(file=>({filename:file.path||file.filename,bytes:Buffer.from(file.text),sha256:digest(Buffer.from(file.text))}));
  for(const required of manifest.contextFiles){const actual=contextFiles.find(file=>file.filename===required.path||file.filename===required.filename);assert.ok(actual,'Missing bundled context file');assert.equal(actual.sha256,required.sha256);assert.equal(actual.bytes.length,required.byteSize);}
  for(const required of bundle.manifest.handoff.send){const actual=bundle.artifacts.find(file=>file.artifactId===required.artifactId);assert(actual,'Missing required artifact in consolidated handoff');const bytes=Buffer.from(actual.base64,'base64');assert.equal(digest(bytes),required.sha256);assert.equal(bytes.length,required.byteSize);}
  const p=await saved(),prompt=p.projectData.generatedPrompts.find(row=>row.instructionId===manifest.promptIdentity.instructionId);assert.ok(prompt);assert.equal(prompt.bodySha256,instruction.sha256);
  const request=responseFixture({schema,engine,prompt,manifest,contextFiles,instructionBytes:instruction.bytes,omitTerminalLF:stage===11&&!report.operations.some(row=>row.stage===11)});
  if(stage===21){request.attachments=[{temporaryKey:'finished-product',filename:'result.txt',mediaType:'text/plain',byteSize:Buffer.byteLength(OUTPUT),sha256:digest(Buffer.from(OUTPUT)),required:true}];request.evidence[0].attachmentRef={tempKey:'finished-product'};}
  if(!rejected){await ingest({...request,jobId:'WRONG-PROJECT'},{invalid:true});rejected=true;if(await browser.exists('#prepare-replacement-attempt'))await browser.click('#prepare-replacement-attempt');return;}
  await ingest(request,{accept});return {request,prompt,manifest,instruction,contextFiles,bundleFile};
}
const version=()=>browser.evaluate('history.state?.versionId');
async function assertStages(numbers,complete){const p=await saved();for(const n of numbers)assert.equal(engine.gate(n,p).complete,complete,`Saved-version Stage ${n} completion differs`);return p;}
async function replacementRecovery({targetStage,completedStages,operation}){
  const completed=await saved(),originalCount=completed.projectData.acceptedChanges.length;
  const affected=completedStages.filter(number=>number>targetStage),restoreVersion=await version();
  await browser.fill('#stage-picker',targetStage);stage=targetStage;
  if(await browser.exists('#operation-picker'))await browser.fill('#operation-picker',operation);
  if(await browser.exists('#prepare-replacement-attempt'))await browser.click('#prepare-replacement-attempt');
  await assertStages(completedStages,true);
  const handoff=await external({accept:false});
  const handoffBundle=JSON.parse(gunzipSync(handoff.bundleFile.bytes).toString('utf8')),agentBytes=[JSON.stringify(handoffBundle),...handoffBundle.artifacts.map(file=>Buffer.from(file.base64,'base64').toString('utf8'))].join('\n');
  for(const [family,records] of Object.entries(completed.projectData))if(Array.isArray(records))for(const record of records.filter(row=>Number(row.stage)>targetStage)){
    const id=engine.recordId(record,family);if(id&&id!=='UNKNOWN')assert(!agentBytes.includes('"'+id+'"'),`Stage ${targetStage} handoff contains later-stage identity ${id}`);
  }
  await browser.click('#accept-proposal');assert(await browser.exists('#replacement-confirmation'));
  const confirmation=await browser.evaluate(`document.querySelector('#replacement-confirmation').innerText`);assert.match(confirmation,/restore/i);
  await browser.click('#keep-current-progress');assert.equal((await assertStages(completedStages,true)).projectData.acceptedChanges.length,originalCount);
  await browser.click('#accept-proposal');await browser.reload();assert.equal((await assertStages(completedStages,true)).projectData.acceptedChanges.length,originalCount);
  assert(!(await browser.exists('#replacement-confirmation')),'Reload accepted an unanswered confirmation');
  await browser.click('#accept-proposal');const pendingVersion=await version();await browser.click('#accept-replacement');
  const replacementVersion=await version();await assertStages(affected,false);
  // The number of traversals comes from the observed versions, not a stage jump.
  const destinations=[pendingVersion,replacementVersion,pendingVersion,replacementVersion];
  for(const destination of destinations){
    const original=destination===pendingVersion;
    await browser.click(original?'#undo-project':'#redo-project');await browser.waitForSavedVersion(destination);
    const restored=await assertStages(original?completedStages:affected,original);
    if(original){assert.equal(restored.projectData.acceptedChanges.length,originalCount,'Undo reaccepted a candidate');for(const number of completedStages)assert.deepEqual(engine.acceptedChanges(restored,number).map(row=>row.changeId),engine.acceptedChanges(completed,number).map(row=>row.changeId));}
  }
  await browser.click('#undo-project');await browser.waitForSavedVersion(pendingVersion);await browser.fill('#stage-picker',targetStage);
  if(await browser.exists('#operation-picker'))await browser.fill('#operation-picker',operation);
  await browser.click('#prepare-replacement-attempt');await external({accept:false});await browser.click('#accept-proposal');await browser.click('#accept-replacement');
  const alternateVersion=await version();assert.notEqual(alternateVersion,replacementVersion);
  await browser.fill('#saved-version-picker',replacementVersion);await browser.click('#restore-saved-version');await browser.waitForSavedVersion(replacementVersion);await assertStages(affected,false);
  assert((await saved(),snapshot.package.savedHistory.index.versionIds).includes(alternateVersion),'History discarded the alternative continuation');
  report.recovery={targetStage,operation,completedStages,affectedStages:affected,confirmation,cancelledWithoutLostProgress:true,unansweredReloadPreserved:true,visitedVersions:destinations,originalDownstreamRestored:true,alternateContinuationRetained:true,restoreVersion,replacementVersion,alternateVersion};
  // Resume through the production next-operation rule, including any new
  // confirmation needed at the replaced stage. No fixed rework range is assumed.
  stage=Number(String((await saved()).job.CURRENT_STAGE).match(/\d+/)?.[0]||targetStage)-1;recoveryExercised=true;
}
function recoveryChoices(project){
  const completedStages=Array.from({length:schema.STAGE_COUNT},(_,index)=>index+1).filter(number=>engine.gate(number,project).complete);
  return completedStages.flatMap(number=>engine.acceptedChanges(project,number)).filter(change=>{
    const contract=schema.operationContract(Number(change.stage),change.operation);
    return contract?.acceptsExternalResponse&&completedStages.includes(Number(change.stage))&&contract.agentWritableCollections.every(family=>schema.RECORD_SCHEMAS[family]?.commitPolicy!=='UPDATE_RESERVED');
  }).map(change=>({targetStage:Number(change.stage),operation:change.operation,completedStages}));
}

try{
  await browser.click('#new-project');await browser.fill('[data-job="JOB_TITLE"]','Complete operator journey');await browser.fill('[data-job="EXACT_USER_OBJECTIVE_VERBATIM"]',OBJECTIVE);await browser.click('#save-job');await browser.click('[data-view="Workflow"]');await saved();
  for(stage=1;stage<=schema.STAGE_COUNT;stage++){
    await browser.fill('#stage-picker',stage);const start=report.operations.length;
    for(let steps=0;steps<80;steps++){
      assert.ok(++sequence<=schema.STAGE_COUNT*80*2,'Two complete progression passes exceeded the declared per-stage action bound');const p=await saved(),gate=engine.gate(stage,p),action=engine.operationalNextAction(p,stage);
      if(gate.complete&&!(stage===30&&action.actionType!=='COMPLETE')){await browser.fill('#stage-picker',stage);report.stages=report.stages.filter(row=>row.stage!==stage);report.stages.push({stage,result:'PASS',projection:verifyCompletedStageProjection(p,stage,schema),view:await browser.inspect(stage),operations:report.operations.length-start});break;}
      console.log(JSON.stringify({operatorStage:stage,action:action.actionType,operation:action.operation,reasons:gate.reasons}));
      if(stage===28&&!engine.recordValue(engine.recordsForCurrentScope(p,'artifactIdentities').at(-1),'EXACT_HASH_MATCH')){await browser.click('[data-view="Release"]');await browser.selectFiles('#audited-files',[{filename:'result.txt',bytes:Buffer.from(OUTPUT)}]);await browser.click('#hash-audited');await browser.selectFiles('#release-files',[{filename:'result.txt',bytes:Buffer.from(OUTPUT)}]);await browser.click('#hash-release');await browser.click('#compare-release');await browser.click('[data-view="Workflow"]');await browser.fill('#stage-picker',stage);continue;}
      if(action.actionType==='CAPTURE_DELIVERY_INTENT'){for(const [key,value]of Object.entries({recipient:'Disposable CI operator',destination:'Disposable CI download directory',purpose:'Retrieve the tested literal file',channel:'BROWSER_DOWNLOAD',disclosure:'SYNTHETIC_PUBLIC',count:'1'}))await browser.fill('#delivery-intent-'+key,value);await browser.click('#capture-delivery-intent');continue;}
      if(action.actionType==='RECORD_DELIVERY_EVIDENCE'){await browser.fill('#delivery-observed-outcome','RECEIVED');await browser.fill('#delivery-observation','Synthetic operator opened the actual downloaded result.txt and compared all nine bytes.');await browser.fill('#delivery-evidence-location','Actual Chromium download event and filesystem byte comparison in this test.');if(await browser.exists('#delivery-observer'))await browser.fill('#delivery-observer','SYNTHETIC_OPERATOR');await browser.click('#record-delivery-evidence');continue;}
      if(action.actionType==='EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS'){const files=await browser.download('#export-authorized-artifacts');assert.equal(files.length,1);assert.equal(files[0].filename,'result.txt');assert.deepEqual(files[0].bytes,Buffer.from(OUTPUT));report.finalArtifact={filename:files[0].filename,sha256:files[0].sha256,byteSize:files[0].bytes.length};continue;}
      if(action.actionType==='EXPORT_PRE_DELIVERY_CHECKPOINT'){const [file]=await browser.download('#export-pre-delivery-checkpoint');report.preDeliveryBackup={sha256:file.sha256,byteSize:file.bytes.length};continue;}
      const controls={CONFIRM_STAGE_ONE_INTENT:'#confirm-stage-one',FREEZE_CANDIDATE:'#freeze-candidate',RESERVE_RUN_BATCH:'#reserve-run-batch',BEGIN_UNCHANGED_CONFIRMATION:'#begin-unchanged-confirmation',FREEZE_BASELINE:'#freeze-baseline',RESERVE_PRODUCT_EXECUTION:'#reserve-product-execution',FREEZE_DELIVERY_CANDIDATE:'#freeze-delivery-candidate',RUN_APP_TESTS:'#run-native-tests',CALCULATE_CONVERGENCE:'#calculate-stage18-convergence',CALCULATE_UNCHANGED_CONFIRMATION:'#calculate-stage19-confirmation',CALCULATE_RELEASE:'#calculate-stage27-release',BUILD_EVIDENCE_CHAINS:'#build-evidence-chains',CALCULATE_TERMINAL:'#calculate-stage30-terminal'};
      if(controls[action.actionType]){if(action.actionType==='FREEZE_CANDIDATE'){assert.equal(engine.recordValue(engine.recordsForCurrentScope(p,'instructions').at(-1),'INSTRUCTION_TEXT'),CANDIDATE);await browser.selectFiles('#stage-files',[{filename:'production-instruction.txt',bytes:Buffer.from(CANDIDATE)}]);}await browser.click(controls[action.actionType]);report.operations.push({stage,command:action.actionType});}
      else if(['EXTERNAL_AGENT_TOOL','AI_REVIEW','EXTERNAL_SYSTEM','CONTINUE_AGENT_CONVERSATION','SELECT_RESPONSE_JSON_FILE'].includes(action.actionType))await external();
      else throw new Error(`Stage ${stage} has no progressing operator action: ${JSON.stringify(action)}`);
      if(stage===5&&!reloaded){const before=await saved();await browser.reload();const after=await saved();assert.equal(hash.sha256Value(after),hash.sha256Value(before));reloaded=true;await browser.click('[data-view="Workflow"]');await browser.fill('#stage-picker',stage);}
    }
    assert.ok(report.stages.some(row=>row.stage===stage),`Stage ${stage} did not finish within 80 actions`);
    if(!recoveryExercised&&stage===schema.STAGE_COUNT){const choices=recoveryChoices(await saved());assert(choices.length,'The completed journey has no repeatable accepted external operation');await replacementRecovery(choices.sort((a,b)=>a.targetStage-b.targetStage||a.operation.localeCompare(b.operation))[0]);}
  }
  const before=await saved(),backup=snapshot.file,exportedPackage=snapshot.package;await browser.click('#restore-session-start');assert.equal(engine.gate(1,await saved()).complete,false,'Backup test did not leave the completed version before restoration');await browser.selectFiles('#import-file',[{filename:'journey.closed-loop.json.gz',bytes:backup.bytes}]);const restored=await saved();assert.equal(restored.job.JOB_ID,before.job.JOB_ID);assert.deepEqual(restored.projectData.acceptedChanges,before.projectData.acceptedChanges,'Backup restoration changed acceptance decisions');assert.deepEqual(restored.projectData.rawResponses,before.projectData.rawResponses,'Backup restoration changed original responses');assert.ok(Array.from({length:schema.STAGE_COUNT},(_,i)=>engine.gate(i+1,restored).complete).every(Boolean));
  for(const [collection,key] of [['versions','versionId'],['chunks','sha256']])for(const expected of exportedPackage.savedHistory[collection]){const actual=snapshot.package.savedHistory[collection].find(row=>row[key]===expected[key]);assert.deepEqual(actual,expected,`Restored history ${collection} member ${expected[key]} differs from exported bytes`);}
  for(const expected of exportedPackage.artifacts){const actual=snapshot.package.artifacts.find(row=>row.artifactId===expected.artifactId);assert(actual,'Restored backup lost an artifact');assert.deepEqual(Buffer.from(actual.base64,'base64'),Buffer.from(expected.base64,'base64'),'Restored artifact bytes differ from the exported backup');}
  report.backupRestore={selectedSha256:backup.sha256,stagesPreserved:schema.STAGE_COUNT,acceptedChangesCompared:before.projectData.acceptedChanges.length,rawResponsesCompared:before.projectData.rawResponses.length,savedVersionsCompared:exportedPackage.savedHistory.versions.length,savedChunksCompared:exportedPackage.savedHistory.chunks.length,artifactBytesCompared:exportedPackage.artifacts.length};
  const finalVersion=await version();await browser.click('#restore-session-start');const startProject=await saved();assert.equal(engine.gate(1,startProject).complete,false,'Session start did not restore its initial project data');
  await browser.fill('#saved-version-picker',finalVersion);await browser.click('#restore-saved-version');await browser.waitForSavedVersion(finalVersion);await assertStages(Array.from({length:30},(_,i)=>i+1),true);
  report.recovery.sessionStartRestored=true;report.recovery.retainedVersions=snapshot.package.savedHistory.index.versionIds.length;report.recovery.retainedViews=snapshot.package.savedHistory.views.length;
  assert.deepEqual(browser.exceptions(),[]);assert.equal(report.stages.length,30);report.complete=true;
}catch(error){report.failures.push({stage,sequence,message:error.stack});console.error(error);process.exitCode=1;try{await browser.inspect(stage);}catch{}}
finally{report.events=browser.events;fs.writeFileSync(path.join(directory,'journey.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({completeOperatorJourney:report.complete,stages:report.stages.length,operations:report.operations.length,failures:report.failures}));
