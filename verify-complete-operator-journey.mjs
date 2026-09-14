import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createOperatorBrowser,digest} from './operator-browser-driver.mjs';
import {responseFixture,OBJECTIVE,OUTPUT,CANDIDATE} from './operator-journey-fixtures.mjs';
import {verifyCompletedStageProjection} from './stage-projection-verification.mjs';

globalThis.dispatchEvent=()=>true;
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const engine=globalThis.closedLoopWorkflowEngine,schema=globalThis.closedLoopWorkflowSchema,hash=globalThis.closedLoopHash;
const directory=path.resolve(process.env.OPERATOR_EVIDENCE_DIR||'operator-evidence'),browser=await createOperatorBrowser({directory});
const report={basis:'SYNTHETIC_EXTERNAL_COUNTERPART_WITH_ACTUAL_BROWSER_FILE_TRANSPORT',humanIndependenceEstablished:false,physicalDeviceAcceptance:false,stages:[],operations:[],failures:[],complete:false};
let snapshot,stage=1,sequence=0,rejected=false,reloaded=false;
async function saved(){snapshot=await browser.project();const {packageSha256,...body}=snapshot.package;assert.equal(hash.sha256Value(body),packageSha256,'Actual downloaded backup must verify against its package digest');return snapshot.project;}
async function ingest(request,{invalid=false}={}){
  const before=await saved(),count=before.projectData.acceptedChanges.length,bytes=Buffer.from(JSON.stringify(request)+'\n');
  await browser.selectFiles('#response-json-file',[{filename:'response.json',bytes}]);await browser.click('#process-response-file');
  if(invalid){const after=await saved();assert.equal(after.projectData.acceptedChanges.length,count,'Invalid response changed accepted work');assert.ok(after.projectData.responseValidations.some(row=>row.valid===false),'Invalid response did not preserve its rejection');return;}
  if(request.attachments.length){const slots=await browser.evaluate(`[...document.querySelectorAll('[data-returned-slot]')].map(node=>node.dataset.returnedSlot)`);assert.equal(slots.length,request.attachments.length);for(const slot of slots)await browser.selectFiles(`[data-returned-slot="${slot}"]`,[{filename:'result.txt',bytes:Buffer.from(OUTPUT)}]);await browser.click('#validate-returned-files');}
  if(!(await browser.exists('#accept-proposal')))throw new Error('Valid response did not expose proposal review: '+await browser.evaluate(`document.querySelector('#stage-workflow')?.innerText||document.body.innerText`));
  await browser.click('#accept-proposal');const after=await saved();assert.equal(after.projectData.acceptedChanges.length,count+1,'Accept did not commit exactly one response');assert.ok(after.projectData.rawResponses.some(row=>row.completeRawResponse===bytes.toString()),'The selected response bytes were not retained exactly');
  report.operations.push({stage,operation:request.operation,responseSha256:digest(bytes),acceptedChangeId:after.projectData.acceptedChanges.at(-1).changeId,revision:after.revision});
}
async function external(){
  const instruction=(await browser.download('#export-prompt-file'))[0],manifestFile=(await browser.download('#export-prompt-manifest'))[0],manifest=JSON.parse(manifestFile.bytes.toString());
  assert.equal(instruction.sha256,manifest.instruction.sha256);assert.equal(instruction.bytes.length,manifest.instruction.byteSize);
  const contextFiles=[];if(manifest.contextFiles.length){contextFiles.push(...await browser.download('#export-prompt-context'));for(const required of manifest.contextFiles){const actual=contextFiles.find(file=>file.filename===required.path||file.filename===required.filename);assert.ok(actual,`Missing actual exported context ${required.path||required.filename}`);assert.equal(actual.sha256,required.sha256);assert.equal(actual.bytes.length,required.byteSize);}}
  const p=await saved(),prompt=p.projectData.generatedPrompts.find(row=>row.instructionId===manifest.promptIdentity.instructionId);assert.ok(prompt);assert.equal(prompt.bodySha256,instruction.sha256);
  const request=responseFixture({schema,engine,project:p,prompt,contextFiles,instructionBytes:instruction.bytes});
  if(stage===21){request.attachments=[{temporaryKey:'finished-product',filename:'result.txt',mediaType:'text/plain',byteSize:Buffer.byteLength(OUTPUT),sha256:digest(Buffer.from(OUTPUT)),required:true}];request.evidence[0].attachmentRef={tempKey:'finished-product'};}
  if(!rejected){await ingest({...request,jobId:'WRONG-PROJECT'},{invalid:true});rejected=true;if(await browser.exists('#prepare-replacement-attempt'))await browser.click('#prepare-replacement-attempt');return;}
  await ingest(request);
}
try{
  await browser.click('#new-project');await browser.fill('[data-job="JOB_TITLE"]','Complete operator journey');await browser.fill('[data-job="EXACT_USER_OBJECTIVE_VERBATIM"]',OBJECTIVE);await browser.click('#save-job');await browser.click('[data-view="Workflow"]');await saved();
  for(stage=1;stage<=30;stage++){
    await browser.fill('#stage-picker',stage);const start=report.operations.length;
    for(let steps=0;steps<80;steps++){
      assert.ok(++sequence<=240,'Bound of 240 operator actions exceeded');const p=await saved(),gate=engine.gate(stage,p),action=engine.operationalNextAction(p,stage);
      if(gate.complete&&!(stage===30&&action.actionType!=='COMPLETE')){report.stages.push({stage,result:'PASS',projection:verifyCompletedStageProjection(p,stage,schema),view:await browser.inspect(stage),operations:report.operations.length-start});break;}
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
  }
  const before=await saved(),backup=snapshot.file;await browser.selectFiles('#import-file',[{filename:'journey.closed-loop.json.gz',bytes:backup.bytes}]);const restored=await saved();assert.equal(restored.job.JOB_ID,before.job.JOB_ID);assert.equal(restored.projectData.acceptedChanges.length,before.projectData.acceptedChanges.length);assert.ok(Array.from({length:30},(_,i)=>engine.gate(i+1,restored).complete).every(Boolean));report.backupRestore={selectedSha256:backup.sha256,stagesPreserved:30};
  assert.deepEqual(browser.exceptions(),[]);assert.equal(report.stages.length,30);report.complete=true;
}catch(error){report.failures.push({stage,sequence,message:error.stack});console.error(error);process.exitCode=1;try{await browser.inspect(stage);}catch{}}
finally{report.events=browser.events;fs.writeFileSync(path.join(directory,'journey.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({completeOperatorJourney:report.complete,stages:report.stages.length,operations:report.operations.length,failures:report.failures}));
