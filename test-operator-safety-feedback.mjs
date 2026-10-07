import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {createStageOneIngestionFixture,stageOneResponseEnvelope} from './test-ingestion-context-reference.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
function bindUI(r,source,project){
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{id:id.slice(1),textContent:'',innerHTML:'',hidden:false,className:'',isConnected:true,classList:{add(){}},setAttribute(){},querySelectorAll:()=>[],querySelector:()=>null,replaceChildren(){this.innerHTML='';},insertAdjacentHTML(_where,value){this.innerHTML+=value;},focus(){},append(){}});return nodes.get(id);};
 Object.assign(r.runtime,{__safetyProject:project,document:{currentScript:null,querySelector:node,querySelectorAll:()=>[],createElement:()=>({})},window:{scrollX:0,scrollY:0,scrollTo(){}},requestAnimationFrame:fn=>queueMicrotask(fn)});
 const end=source.indexOf('globalThis.closedLoopAppReady=false;');assert(end>0);
 vm.runInContext(source.slice(0,end)+`core=closedLoopCore;schema=closedLoopWorkflowSchema;engine=closedLoopWorkflowEngine;ingestion=closedLoopResponseIngestion;projectStore=closedLoopProjectStore;current=__safetyProject;projects=[current];render=()=>{};focusAfterAction=()=>{};paintOperationStatus=()=>{};scheduleWorkflowActionInset=()=>{};
 globalThis.safetyUI={select:p=>{current=p;},slots:returnedFileSlotsMarkup,validation:validationMarkup,proposal:proposalMarkup,release,field,details,renderDetail,present:presentPreparedResponse,report:reportActionFailure};})();`,r.runtime,{filename:'app-core.js:operator-safety-feedback'});
 return {ui:r.runtime.safetyUI,nodes,node};
}
// These fixtures exercise actual owners and real generated response bindings.
// DOM stand-ins expose generated markup/live text; they do not prove browser
// layout, screen-reader speech, real external performance, or physical devices.
export async function verifyOperatorSafetyFeedback({appSource=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8'),promptSource=fs.readFileSync(process.env.PROMPT_SOURCE||'prompt-engine.js','utf8')}={}){
 const names=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'],sourceOverrides=Object.fromEntries(names.map(file=>[file,fs.readFileSync(file,'utf8')])),cases=[];
 sourceOverrides['prompt-engine.js']=promptSource;
 {
  const r=projectStoreRuntime({sourceOverrides}),f=await createStageOneIngestionFixture(r),slot=f.manifest.attachmentSlots.find(row=>row.role==='SUPPORTING_EVIDENCE');assert(slot);
  const bytes=Buffer.from('Exact required returned evidence.'),envelope=stageOneResponseEnvelope(r,f.p,f.prompt);envelope.attachments=[{temporaryKey:'support',attachmentSlotId:slot.attachmentSlotId,role:slot.role,filename:'exact-evidence.txt',mediaType:'text/plain',byteSize:bytes.length,sha256:sha(bytes),required:true}];envelope.evidence[0].attachmentRef={tempKey:'support'};
  const text=JSON.stringify(envelope),staged=await r.store.stageResponseFile({jobId:f.p.job.JOB_ID,stage:1,blob:new Blob([text],{type:'application/json'}),rawFilename:'response.json',mediaType:'application/json',promptIdentity:f.manifest.promptIdentity,packageId:f.manifest.packageId,operationReservationId:f.manifest.operationReservationId,challengeNonce:f.manifest.challengeNonce}),raw=r.ingestion.captureRaw(f.p,{stage:1,text,promptRecord:f.prompt,transport:{...staged,authority:'AUTHORITATIVE_RESPONSE_FILE'}}),prepared=r.ingestion.prepareCaptured(raw.project,{rawResponseId:raw.rawRecord.rawResponseId});
  assert.equal(prepared.validation.valid,false);assert(prepared.validation.issues.some(row=>row.code==='MISSING_REQUIRED_ATTACHMENT'),'MISSING_ATTACHMENT_INTENDED_BOUNDARY_ORACLE');
  const {ui,node}=bindUI(r,appSource,prepared.project),slots=ui.slots(),validation=ui.validation(1);assert(slots.includes('exact-evidence.txt ('+bytes.length+' bytes)'),'EXPECTED_RETURNED_FILE_DISPLAY_ORACLE');assert(slots.includes('data-returned-slot="'+slot.attachmentSlotId+'"'));assert.match(slots,/required/);assert.match(slots,/No file selected/);assert.match(validation,/Returned files need correction/,'MISSING_ATTACHMENT_VISIBLE_ORACLE');assert.doesNotMatch(ui.proposal(1),/id="accept-proposal"/,'MISSING_ATTACHMENT_NOT_ACCEPTABLE_ORACLE');
  ui.present(prepared,null);assert.match(node('#app-live-status').textContent,/Returned file validation failed/,'ATTACHMENT_LIVE_REGION_ORACLE');assert.match(node('#app-live-status').textContent,/exact-evidence\.txt/,'ATTACHMENT_LIVE_REGION_EXACT_FILE_ORACLE');
  cases.push({caseId:'UI-EXACT-RETURNED-FILE-AND-MISSING-EVIDENCE',result:'PASS',issuedSlot:true,actualMissingAttachmentValidation:true,acceptanceAbsent:true});
 }
 {
  const r=projectStoreRuntime({sourceOverrides}),p=r.core.createBlankState('SYNTHETIC-RELEASE-VISUAL'),scope=r.engine.currentScope(p),release={id:'SYNTHETIC-RELEASE',stage:27,active:true,scope,fields:{RELEASE_ID:'SYNTHETIC-RELEASE',DETERMINATION:'ACCEPTED'}},blocker={id:'SYNTHETIC-BLOCKER',stage:27,active:true,scope,fields:{BLOCKER_ID:'SYNTHETIC-BLOCKER',STATUS:'OPEN',WHY_WORK_CANNOT_CONTINUE:'Release proof remains missing.',DOWNSTREAM_WORK_STOPPED:'STAGE 27'}};p.projectData.releaseRecords.push(r.copy(release));p.projectData.blockers.push(r.copy(blocker));
  assert(r.engine.detectCurrentContradictions(p).some(row=>row.type==='ACCEPTED_RELEASE_WITH_BLOCKER'),'RELEASE_RENDER_CONTRADICTION_SETUP_ORACLE');const {ui}=bindUI(r,appSource,p),html=ui.release(),status=html.match(/<span class="status [^"]*">([^<]*)<\/span>/)?.[1];assert(status,'RELEASE_RENDER_STATUS_PRESENT_ORACLE');assert.notEqual(status,'ACCEPTED','RELEASE_RENDER_CONTRADICTION_ORACLE');assert.doesNotMatch(html,/<span class="status (?:complete|success|accepted)">/,'RELEASE_RENDER_CONTRADICTION_ORACLE');
  cases.push({caseId:'UI-CONTRADICTORY-RELEASE-IS-NOT-ACCEPTED',result:'PASS',actualContradiction:true,renderedDetermination:status,fixtureLimit:'Populated synthetic canonical records for false-acceptance counterexample; no assertion of a complete conforming release.'});
 }
 {
  const r=projectStoreRuntime({sourceOverrides}),p=r.core.createBlankState('SYNTHETIC-UNTRUSTED-DISPLAY'),{ui}=bindUI(r,appSource,p),vectors=['<script>globalThis.__unsafe=true</script>','"><img src=x onerror="globalThis.__unsafe=true">','<a href="javascript:globalThis.__unsafe=true">open</a>','<a href="data:text/html,unsafe">open</a>','<a href="file:///private">open</a>','<a href="https://unexpected.invalid/" target="_blank">open</a>','<style>body{background:red!important}</style>','" style="background:url(https://unexpected.invalid/)" onclick="unsafe()'];
  for(const value of vectors){const html=ui.field('Imported extension value',value);assert.doesNotMatch(html,/<script|<img|<a\b|<style|<[^>]+\s(?:onclick|onerror|style|href)=/i,'UNTRUSTED_LITERAL_RENDER_ORACLE');assert(html.includes('&lt;')||html.includes('&quot;'),'UNTRUSTED_LITERAL_RENDER_ORACLE');const details=ui.details('Preserved imported text',value,true),id=details.match(/data-detail-id="(\d+)"/)[1],body={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null,replaceChildren(){this.innerHTML='';}},node={dataset:{detailId:id},querySelector:()=>body};ui.renderDetail(node);assert.doesNotMatch(body.innerHTML,/<script|<img|<a\b|<style|<[^>]+\s(?:onclick|onerror|style|href)=/i,'UNTRUSTED_DISCLOSURE_RENDER_ORACLE');}
  for(const value of ['../secret.txt','folder/../../secret.txt','/absolute.txt','bad\u0000name.txt','bad\u202ename.txt'])assert.throws(()=>r.runtime.closedLoopHash.normalizeFilename(value,{allowPath:true}),/UNSAFE_FILENAME/,'UNSAFE_FILENAME_PRESENTATION_BOUNDARY_ORACLE');assert.equal(r.runtime.closedLoopHash.normalizeFilename('safe-report.txt').canonicalPath,'safe-report.txt');
  cases.push({caseId:'UI-UNTRUSTED-MARKUP-URL-ATTRIBUTE-CSS-AS-TEXT',result:'PASS',vectors:vectors.length,lazyDisclosureExercised:true,unsafeFilenameControls:5,externalNavigation:'Application renders untrusted URLs as text; no navigable external URL feature is exercised or fabricated.'});
 }
 {
  // Expose the actual prompt binding owner without changing its logic. This
  // isolates the independence boundary; it does not bypass an upstream gate
  // and pretend that a complete Stage 26 handoff was executed.
  const anchor='globalThis.closedLoopPromptEngine=Object.freeze(';assert.equal(promptSource.split(anchor).length,2);
  const exposed=promptSource.replace(anchor,'globalThis.__semanticBindingForTest=buildSemanticReviewBinding;'+anchor),r=projectStoreRuntime({sourceOverrides:{...sourceOverrides,'prompt-engine.js':exposed}}),p=r.core.createBlankState('SYNTHETIC-INDEPENDENCE-UI');r.engine.ensureShape(p);
  const reviewer={id:'CONTEXT-REVIEWER',stage:26,active:true,source:'HUMAN_REVIEWER_CONTEXT',fields:{CONTEXT_ID:'CONTEXT-REVIEWER',EXTERNAL_CONTEXT_IDENTIFIER:'SHARED-CONTEXT',CONTAMINATION_STATUS:'NONE'}},author={id:'CONTEXT-AUTHOR',stage:26,active:true,source:'APPLICATION',fields:{CONTEXT_ID:'CONTEXT-AUTHOR',EXTERNAL_CONTEXT_IDENTIFIER:'SHARED-CONTEXT',CONTAMINATION_STATUS:'NONE'}};
  p.projectData.freshContexts.push(r.copy(reviewer),r.copy(author));p.projectData.acceptedChanges.push(r.copy({changeId:'CHANGE-AUTHOR',stage:26,status:'COMMITTED',responseType:'DATA_PROPOSAL',operation:'COMPLETE',promptId:'INSTRUCTION-AUTHOR',rawResponseId:'RESPONSE-AUTHOR'}));p.projectData.generatedPrompts.push(r.copy({instructionId:'INSTRUCTION-AUTHOR',operationReservationId:'RESERVATION-AUTHOR',contextManifest:{semanticReviewBinding:{authorContextId:'CONTEXT-AUTHOR'}}}));
  const {ui,node}=bindUI(r,appSource,p),binding=()=>r.runtime.__semanticBindingForTest(26,p,'SEMANTIC_REVIEW',r.copy({reviewerContextId:'CONTEXT-REVIEWER'}));
  const checkFailure=()=>{let error;try{binding();}catch(value){error=value;}assert(error,'INDEPENDENCE_BLOCKED_BINDING_ORACLE');ui.report(error);assert.match(node('#app-live-status').textContent,/Independent review is blocked/,'INDEPENDENCE_LIVE_REGION_ORACLE');assert.match(node('#app-live-status').textContent,/author or fresh-reviewer preparation/,'INDEPENDENCE_RECOVERY_GUIDANCE_ORACLE');assert.doesNotMatch(node('#app-live-status').textContent,/CHANGE-AUTHOR|CONTEXT-AUTHOR/,'INDEPENDENCE_PUBLIC_ID_PRIVACY_ORACLE');assert.equal(error.code,'SEMANTIC_REVIEW_INDEPENDENCE_NOT_ESTABLISHED','INDEPENDENCE_TYPED_ERROR_ORACLE');assert(node('#operation-error').innerHTML.includes(error.message),'INDEPENDENCE_TECHNICAL_DETAILS_RETAINED_ORACLE');return error;};
  const reused=checkFailure();assert.match(reused.message,/not independently established from author CHANGE-AUTHOR/);
  p.projectData.freshContexts[0].fields.EXTERNAL_CONTEXT_IDENTIFIER='DISTINCT-REVIEWER-CONTEXT';const control=binding();assert.equal(control.bindingStatus,'BOUND','INDEPENDENCE_VALID_CONTROL_ORACLE');assert.equal(control.reviewerContextId,'CONTEXT-REVIEWER');assert.equal(control.authorContextId,'CONTEXT-AUTHOR');
  p.projectData.acceptedChanges[0].rawResponseId='';const unknown=checkFailure();assert.match(unknown.message,/lacks its actual operation reservation or raw response provenance/,'INDEPENDENCE_UNKNOWN_PROVENANCE_ORACLE');
  cases.push({caseId:'UI-INDEPENDENCE-BLOCKER-TYPED-AND-ACTIONABLE',result:'PASS',reusedExternalContextRejected:true,distinctRegisteredContextAccepted:true,missingAuthorProvenanceBlocked:true,technicalDetailsPreserved:true,boundary:'Actual prompt binding, independence evaluator and UI error reporter; synthetic provenance isolates the boundary, not a full Stage 26 or external-agent journey.'});
 }
 return {schema:'closed-loop-operator-safety-feedback-check/1',passed:true,synthetic:true,actualBrowser:false,sourceSha256:{...Object.fromEntries(names.map(file=>[file,sha(sourceOverrides[file])])),'app-core.js':sha(appSource),'test-operator-safety-feedback.mjs':sha(fs.readFileSync(import.meta.filename))},cases};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 let appSource=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8'),promptSource=fs.readFileSync(process.env.PROMPT_SOURCE||'prompt-engine.js','utf8');const fault=process.argv.find(arg=>arg.startsWith('--fault='))?.slice(8);
 if(fault==='generic-attachment-feedback'){const before='const attachmentIssues=safe(prepared.validation?.issues).filter(';assert.equal(appSource.split(before).length,2);appSource=appSource.replace(before,'const attachmentIssues=[].filter(');}
 else if(fault==='trust-release-label'){const before='function release(){const metrics=engine.releaseMetrics(current);';assert.equal(appSource.split(before).length,2);appSource=appSource.replace(before,"function release(){const metrics={...engine.releaseMetrics(current),determination:'ACCEPTED'};");}
 else if(fault==='untyped-independence-error'){const before="error.code='SEMANTIC_REVIEW_INDEPENDENCE_NOT_ESTABLISHED';";assert.equal(promptSource.split(before).length,2);promptSource=promptSource.replace(before,'');}
 else assert.equal(fault,undefined);
 console.log(JSON.stringify(await verifyOperatorSafetyFeedback({appSource,promptSource}),null,2));
}
