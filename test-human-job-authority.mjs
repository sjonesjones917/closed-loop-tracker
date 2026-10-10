import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {authorizeSyntheticHandoff} from './test-handoff-authorization.mjs';
import {HUMAN_JOB_CONTROL_VALUES} from './test-human-job-controls.mjs';

const fields=Object.keys(HUMAN_JOB_CONTROL_VALUES);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const observedHumanState=p=>({job:Object.fromEntries(fields.map(f=>[f,p.job[f]])),inputVersions:p.projectData.inputVersions,userEntered:p.projectData.userEntered,humanDecisions:p.projectData.humanDecisions,humanInputAnswers:p.projectData.humanInputAnswers,humanAuthorityConfirmations:p.projectData.humanAuthorityConfirmations,stageHumanData:p.stages[1].humanData,acceptedChanges:p.projectData.acceptedChanges});
async function fixture(){
 const r=projectStoreRuntime();let p=await r.store.createProject({commandId:'SYNTHETIC-JOB-HUMAN-AUTHORITY'});
 const controls=Object.entries(HUMAN_JOB_CONTROL_VALUES).map(([field,value])=>({dataset:{job:field},type:field==='DESIRED_SOURCE_COUNT'?'number':'text',value:String(value),setCustomValidity(){},focus(){},reportValidity(){}}));
 Object.assign(r.runtime,{current:p,engine:r.engine,clone:r.copy,document:{querySelector:()=>controls.find(x=>x.dataset.job==='DESIRED_SOURCE_COUNT'),querySelectorAll:()=>controls},$:()=>null,announce(){},render(){},focusAfterAction(){},requestAnimationFrame:fn=>fn(),canonicalCurrentStage:()=>1,persistReplacement:async next=>{p=await r.store.writeProject(next,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});r.runtime.current=p;}});
 const app=fs.readFileSync('app-core.js','utf8'),start=app.indexOf('async function saveJob('),end=app.indexOf('\n',start);assert.ok(start>=0&&end>start);
 vm.runInContext(app.slice(start,end)+'\nglobalThis.saveHumanJobFixture=saveJob;',r.runtime,{filename:'app-core.js:actual-saveJob'});await r.runtime.saveHumanJobFixture();
 assert.deepEqual(JSON.parse(JSON.stringify(Object.fromEntries(fields.map(f=>[f,p.job[f]])))),HUMAN_JOB_CONTROL_VALUES,'HUMAN_JOB_AUTHORITY_SETUP_ORACLE');
 const next=r.copy(p),issued=r.prompts.reserveAndBuildPromptRecord(next,1,{operation:'COMPLETE'},{owningTabInstance:'SYNTHETIC-JOB-AUTHORITY'}).prompt;
 p=await r.store.writeProject(next,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});let prompt=p.projectData.generatedPrompts.find(x=>x.instructionId===issued.instructionId);({project:p,prompt}=await authorizeSyntheticHandoff(r,{project:p,prompt}));return {r,p,prompt};
}
function baseEnvelope(r,p,prompt){const m=r.prompts.promptFileManifest(prompt);return {schema:'closed-loop-stage-response/3',contractProfileId:'closed-loop-completion-profile/1',jobId:p.job.JOB_ID,stage:1,operation:'COMPLETE',promptIdentity:m.promptIdentity,packageId:m.packageId,operationReservationId:m.operationReservationId,challengeNonce:m.challengeNonce,scope:m.scope,responseType:'BLOCKED',humanInputRequests:[],humanAuthorityCandidates:[],stageData:{},records:{},evidence:[],unresolved:[{temporaryKey:'capability-unavailable',kind:'MISSING_CAPABILITY',description:'The required external observation is unavailable in this isolated synthetic case.',whyBlocking:'No required external observation has occurred.',affectedStageFields:[],affectedRecords:[],blocking:true}],warnings:[],attachments:[]};}
async function prepareFile(f,envelope){
 const {r,p,prompt}=f,m=r.prompts.promptFileManifest(prompt),text=JSON.stringify(envelope),identity={promptIdentity:m.promptIdentity,packageId:m.packageId,operationReservationId:m.operationReservationId,challengeNonce:m.challengeNonce};
 const staged=await r.store.stageResponseFile({jobId:p.job.JOB_ID,stage:1,blob:new Blob([text],{type:'application/json'}),rawFilename:'response.json',mediaType:'application/json',...identity});const file=await r.store.readStagedResponseFile({jobId:p.job.JOB_ID,stagingId:staged.stagingId});assert.equal(file.sha256,digest(text));
 const captured=r.ingestion.captureRaw(p,{stage:1,text,promptRecord:prompt,transport:r.copy({...identity,authority:'AUTHORITATIVE_RESPONSE_FILE',stagingId:staged.stagingId,status:file.status,sha256:file.sha256,byteSize:file.byteSize})});
 const prepared=r.ingestion.prepareCaptured(captured.project,{rawResponseId:captured.rawRecord.rawResponseId,promptRecord:prompt,expectedCommittedRevision:p.revision});assert.equal(prepared.rawRecord.completeRawResponse,text,'HUMAN_JOB_AUTHORITY_RAW_BYTES_ORACLE');return prepared;
}
export async function verifyHumanJobAuthority(){
 const f=await fixture(),{r,p,prompt}=f,base=baseEnvelope(r,p,prompt),before=JSON.parse(JSON.stringify(observedHumanState(p)));const control=await prepareFile(f,base);
 assert.equal(control.validation.valid,true,'HUMAN_JOB_AUTHORITY_CONFORMING_BLOCKER_ORACLE: '+JSON.stringify(control.validation.issues));assert.deepEqual(JSON.parse(JSON.stringify(observedHumanState(control.project))),before);
 const cases=[];
 for(const field of fields){
  // Stage1 exposes these canonical human values only as protected context.
  const envelope=structuredClone(base);envelope.stageData[field]=HUMAN_JOB_CONTROL_VALUES[field];const out=await prepareFile(f,envelope);
  assert.equal(out.validation.valid,false,'HUMAN_JOB_AGENT_OVERWRITE_ORACLE: '+field);assert.equal(out.proposal,null);
  assert.ok(out.validation.issues.some(x=>x.code==='FIELD_OWNERSHIP_VIOLATION'&&x.path==='/stageData/'+field),'HUMAN_JOB_AGENT_OWNER_DIAGNOSTIC_ORACLE: '+field+': '+JSON.stringify(out.validation.issues));
  assert.equal(out.validation.issues.some(x=>x.code==='WRONG_VALUE_TYPE'),false,'HUMAN_JOB_AGENT_OWNER_TYPED_CONTROL_ORACLE: '+field);
  assert.deepEqual(JSON.parse(JSON.stringify(observedHumanState(out.project))),before,'HUMAN_JOB_AGENT_PRESERVATION_ORACLE: '+field);
  cases.push({field,surface:'stageData',code:'FIELD_OWNERSHIP_VIOLATION',humanStatePreserved:true});
  // The response envelope has no writable /job surface at all.
  const injected=structuredClone(base);injected.job={[field]:HUMAN_JOB_CONTROL_VALUES[field]};const root=await prepareFile(f,injected);
  assert.equal(root.validation.valid,false);assert.equal(root.proposal,null);assert.ok(root.validation.issues.some(x=>x.code==='UNKNOWN_PROPERTY'&&x.path==='/job'),'HUMAN_JOB_ROOT_INJECTION_ORACLE: '+field);
  assert.deepEqual(JSON.parse(JSON.stringify(observedHumanState(root.project))),before,'HUMAN_JOB_ROOT_PRESERVATION_ORACLE: '+field);cases.push({field,surface:'job',code:'UNKNOWN_PROPERTY',humanStatePreserved:true});
 }
 assert.equal(cases.length,22);assert.equal(new Set(cases.map(x=>x.field+':'+x.surface)).size,22);
 assert.equal((await r.store.readProject(p.job.JOB_ID)).projectSha256,p.projectSha256,'HUMAN_JOB_SOURCE_PROJECT_UNCHANGED_ORACLE');
 const repaired=await prepareFile(f,base);assert.equal(repaired.validation.valid,true,'HUMAN_JOB_REMOVE_ONLY_FORBIDDEN_FIELDS_CONTROL');
 return {humanJobAuthority:true,checkId:'human-job-input.authority',fields:[...fields],negativeCases:cases,conformingControls:2,stageReadCapturePrepare:true,sourceStoreUnchanged:true,synthetic:true,actualBrowser:false,passed:true,boundary:'Exact response Blob staging/read/raw capture/prepare on current saved authorized Stage1 prompt; human Job baseline established through actual saveJob with synthetic DOM and transaction adapter. Invalid candidates are not saved or accepted. This is admission protection, not an accepted-response commit or full browser path.'};
}
