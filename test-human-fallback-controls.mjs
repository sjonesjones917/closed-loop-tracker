import {downloadSyntheticHandoff} from './test-browser-handoff-authorization.mjs';
import assert from 'node:assert/strict';
import {readStoreArchive} from './test-zip.mjs';
import {HUMAN_FALLBACK_CASES,humanFallbackResponse,humanFallbackAnswers} from './test-human-fallback-fixture.mjs';

// Actual operator/file path with explicitly synthetic human answers. This does
// not establish that a real human supplied the recorded fixture information.
export async function verifyHumanFallbackControls(browser,record){
 await browser.click('#new-project');
 await browser.fill('[data-job="JOB_TITLE"]','Synthetic eight-format human fallback controls');
 await browser.fill('[data-job="EXACT_USER_OBJECTIVE_VERBATIM"]','Prepare a field inventory using the human preferences supplied through the fallback controls.');
 await browser.click('#save-job');await browser.click('[data-view="Workflow"]');await browser.fill('#stage-picker',1);
 const supplied=Buffer.from('Synthetic visual reference bytes for fallback control verification.\n');
 await browser.selectFiles('#stage-files',[{filename:'fallback-reference.txt',bytes:supplied}]);
 const before=await browser.readProject(),artifact=before.projectData.artifacts.find(row=>row.fields?.FILENAME==='fallback-reference.txt');
 assert.ok(artifact?.fields?.ARTIFACT_ID,'FALLBACK_CONTROL_FILE_CUSTODY_ORACLE');
 const [download]=await downloadSyntheticHandoff(browser,'#next-export-prompt-file',{syntheticProject:true}),entries=readStoreArchive(download.bytes),manifest=JSON.parse(Buffer.from(entries.find(row=>row.canonicalPath==='manifest.json').bytes).toString());
 const response=Buffer.from(JSON.stringify(humanFallbackResponse(manifest))+'\n');
 await browser.selectFiles('#response-json-file',[{filename:'response.json',bytes:response}]);await browser.click('#process-response-file');
 const proposalState=await browser.readProject(),proposal=proposalState.projectData.responseProposals.at(-1),validation=proposalState.projectData.responseValidations.find(row=>row.validationId===proposal?.validationId);
 assert.equal(validation?.valid,true,'FALLBACK_CONTROL_RESPONSE_ADMISSION_ORACLE: '+JSON.stringify(validation?.issues));assert.equal(proposal?.status,'PENDING_OPERATOR_REVIEW');
 assert.equal(proposalState.projectData.rawResponses.at(-1).completeRawResponse,response.toString());await browser.click('#accept-proposal');
 const requested=await browser.readWorkflow([1]);assert.equal(requested.workflow[0].gate.complete,false);assert.equal(requested.project.projectData.acceptedChanges.length,0);
 const requests=HUMAN_FALLBACK_CASES.map(specimen=>{const request=requested.project.projectData.humanInputRequests.find(row=>row.question===specimen.question);assert.ok(request?.requestId);assert.equal(request.answerType,specimen.answerType);return {specimen,request};}),answers=humanFallbackAnswers(artifact.fields.ARTIFACT_ID);
 const observations=await browser.evaluate(`Array.from(document.querySelectorAll('[data-human-answer]')).map(node=>({requestId:node.dataset.humanAnswer,id:node.id,tagName:node.tagName,type:node.type,multiple:node.multiple===true,rendered:Boolean(node.getClientRects().length),disabled:node.disabled===true,labels:Array.from(node.labels||[]).map(label=>label.textContent.trim()),options:node.options?Array.from(node.options).map(option=>option.value):null}))`);
 for(const {specimen,request}of requests){
  const observed=observations.find(row=>row.requestId===request.requestId);assert.ok(observed,'FALLBACK_CONTROL_PRESENT_ORACLE: '+specimen.answerType);assert.ok(observed.rendered&&!observed.disabled,'FALLBACK_CONTROL_USABLE_ORACLE: '+specimen.answerType);
  assert.deepEqual(observed.labels,[specimen.question],'FALLBACK_CONTROL_ACCESSIBLE_NAME_ORACLE: '+specimen.answerType);
  const expected={TEXT:['INPUT','text'],LONG_TEXT:['TEXTAREA','textarea'],BOOLEAN:['SELECT','select-one'],NUMBER:['INPUT','number'],CHOICE:['SELECT','select-one'],MULTI_CHOICE:['SELECT','select-multiple'],DATE:['INPUT','date'],FILE_REFERENCE:['SELECT','select-one']}[specimen.answerType];
  assert.deepEqual([observed.tagName,observed.type],expected,'FALLBACK_CONTROL_TYPE_ORACLE: '+specimen.answerType);
  if(['CHOICE','MULTI_CHOICE'].includes(specimen.answerType))assert.deepEqual(observed.options.filter(Boolean),specimen.allowedValues);
  const selector='[data-human-answer="'+request.requestId+'"]',answer=answers[specimen.key];
  if(specimen.answerType==='MULTI_CHOICE'){
   const selected=await browser.evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});for(const option of node.options)option.selected=${JSON.stringify(answer)}.includes(option.value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));return Array.from(node.selectedOptions).map(option=>option.value);})()`);assert.deepEqual(selected,answer);await browser.settle();
  }else await browser.fill(selector,String(answer));
 }
 await browser.click('#save-human-answers');if(await browser.exists('#accept-replacement'))await browser.click('#accept-replacement');
 const saved=await browser.readWorkflow([1]);assert.notEqual(saved.project.job.CURRENT_INPUT_VERSION,requested.project.job.CURRENT_INPUT_VERSION);assert.equal(saved.workflow[0].gate.complete,false);assert.equal(saved.project.projectData.acceptedChanges.length,0);
 for(const {specimen,request}of requests){const answer=saved.project.projectData.humanInputAnswers.find(row=>row.requestId===request.requestId);assert.ok(answer,'FALLBACK_CONTROL_SAVE_ORACLE: '+specimen.answerType);assert.deepEqual(answer.answer,answers[specimen.key]);}
 await browser.reload();const reloaded=await browser.readWorkflow([1]);assert.equal(reloaded.workflow[0].gate.complete,false);
 for(const {specimen,request}of requests){const answer=reloaded.project.projectData.humanInputAnswers.find(row=>row.requestId===request.requestId);assert.ok(answer);assert.deepEqual(answer.answer,answers[specimen.key]);record('human fallback '+specimen.answerType+' control saves and reloads typed answer',{answerType:specimen.answerType,accessibleQuestion:true,nativeControl:true,typedAnswerPreserved:true,actualResponseFile:true,stageCompleted:false,syntheticHumanInformation:true});}
 assert.equal(reloaded.project.projectData.rawResponses.at(-1).completeRawResponse,response.toString());return {observations,requestCount:requests.length};
}
