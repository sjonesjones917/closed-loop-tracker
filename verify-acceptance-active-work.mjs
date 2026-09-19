import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
const cases=[],note=name=>cases.push({name,result:'PASS'});
const faultName=process.argv.find(arg=>arg.startsWith('--fault='))?.slice(8);
const faults={
 'audit-is-work':{file:'workflow-engine.js',id:'AUDIT-IS-WORK',before:"const families=new Set([...Object.keys(schema.RECORD_SCHEMAS),...Object.keys(DOWNSTREAM_WORK_COLLECTIONS)]);",after:"for(const row of safe(project.projectData.migrationArchives))if(Number(row.stage)>Number(stage))add(row.stage,'migrationArchives','');const families=new Set([...Object.keys(schema.RECORD_SCHEMAS),...Object.keys(DOWNSTREAM_WORK_COLLECTIONS)]);"},
 'blank-draft-is-work':{file:'workflow-engine.js',id:'BLANK-DRAFT-IS-WORK',before:"if(!text||text===core.stageTemplate(core.STAGES[Number(stage)-1]))return false;",after:"if(!text||text===core.stageTemplate(core.STAGES[Number(stage)-1]))return false;return true;"},
 'omit-pending-work':{file:'workflow-engine.js',id:'OMIT-PENDING-WORK',before:"if(collection==='responseProposals'&&row.status!=='PENDING_OPERATOR_REVIEW')continue;",after:"if(collection==='responseProposals')continue;"}
};
const r=projectStoreRuntime({fault:faults[faultName]}),{core,engine,prompts,ingestion,store,copy,runtime}=r;
const source=fs.readFileSync('app-core.js','utf8');
const extract=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b);};
const failures=[],observations=[];
Object.assign(runtime,{core,engine,prompts,ingestion,projectStore:store,schema:runtime.closedLoopWorkflowSchema,clone:copy,safe:engine.safe,views:['Overview','Project','Workflow','Records','Files','Release'],operationSelection:{},runSelection:{},replacementReview:null,responseActionFailure:null,projects:[],acceptanceSession:null,TAB_INSTANCE_ID:'SYNTHETIC-REPRODUCTION',withStorageActivity:async(_label,f)=>f(),unloadInactiveProjects:()=>{},mobileSessionCurrent:()=>false,recordMobileOperation:async()=>{},recordCommittedBoundary:async()=>{},render:()=>{},announce:message=>observations.push({announcement:message}),reportResponseFailure:(message,error)=>failures.push({message,error:String(error?.stack||error)}),reportActionFailure:error=>failures.push(String(error)),focusAfterAction:()=>{},reverifyReturnedFiles:async()=>{},$ :()=>({value:'SYNTHETIC',scrollIntoView(){},focus(){}}),document:{querySelectorAll:()=>[]}});
vm.runInContext(extract('const stageRecordText=','const label=')+extract('function blankStage(','function validateImport(')+extract('function acceptedContinuation(','const stageContinuationErrors=')+extract('function canonicalCurrentStage(','function currentNextAction('),runtime);
runtime.seed=copy(JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8')));
let p=vm.runInContext('importSeed(seed)',runtime);
p=await store.writeProject(p,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
runtime.current=p;runtime.projects=[p];
runtime.captureView=()=>copy({activeStage:runtime.current.activeStage,activeView:runtime.current.activeView,operationSelection:{},runSelection:{},pendingMutation:runtime.replacementReview?.next?{baseProjectSha256:runtime.current.projectSha256,next:runtime.replacementReview.next,impact:runtime.replacementReview.impact,expectedProjectRevision:runtime.replacementReview.expectedProjectRevision,acceptance:runtime.replacementReview.acceptance}:null});
runtime.captureCurrentView=async()=>store.saveCheckpoint(runtime.current.job.JOB_ID,{expectedProjectRevision:runtime.current.revision,view:runtime.captureView()});
runtime.pendingProposal=()=>runtime.current.projectData.responseProposals.filter(row=>row.stage===2&&row.status==='PENDING_OPERATOR_REVIEW').at(-1);
vm.runInContext(extract('async function persistReplacement(','async function save(')+extract('function humanAuthorityConfirmationValues(','async function rejectPendingProposal(')+extract('async function rejectPendingProposal(','async function addBlocker('),runtime);
async function savePrompt(){p=runtime.current;const draft=copy(p),prompt=prompts.reserveAndBuildPromptRecord(draft,2).prompt;await store.persistPromptContextFiles(prompt,draft);await runtime.persistReplacement(draft);return prompt;}
async function stage(text,prompt){p=runtime.current;const result=ingestion.prepare(p,{stage:2,text,promptRecord:prompt,expectedCommittedRevision:p.revision,transport:{authority:'AUTHORITATIVE_RESPONSE_FILE',packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce}});await runtime.persistReplacement(result.project,{operational:true});return result;}
let pr=await savePrompt();
await stage('{"schema":}',pr);
const next=copy(runtime.current),continuation=ingestion.prepareStageContinuation(next,{stage:2,owningTabInstance:'SYNTHETIC-REPRODUCTION'});await runtime.persistReplacement(next);pr=continuation.prompt;
const browserSource=fs.readFileSync('verify-browser.mjs','utf8');
const begin=browserSource.indexOf('const envelope='),end=browserSource.indexOf('\n const longEnvelope=',begin);
runtime.retained=runtime.current;runtime.promptRecord=pr;
const envelope=vm.runInContext(browserSource.slice(begin,end)+'\nenvelope;',runtime);
const longStart=browserSource.indexOf('const longEnvelope=',end),longEnd=browserSource.indexOf('\n await selectResponseFile',longStart);
const long=vm.runInContext(browserSource.slice(longStart,longEnd)+'\nlongEnvelope;',runtime);
let staged=await stage(JSON.stringify(long),pr);assert.equal(staged.validation.valid,true,JSON.stringify(staged.validation.issues));
await runtime.rejectPendingProposal(false);assert.equal(failures.length,0,JSON.stringify(failures));
pr=await savePrompt();
envelope.promptIdentity={instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature};envelope.packageId=pr.packageId;envelope.operationReservationId=pr.operationReservationId;envelope.challengeNonce=pr.challengeNonce;envelope.scope=pr.scope;
staged=await stage(JSON.stringify(envelope),pr);assert.equal(staged.validation.valid,true,JSON.stringify(staged.validation.issues));
const before=runtime.current;const candidate=ingestion.prepareAcceptanceCandidate(before,staged.proposal.proposalId,{operator:'SYNTHETIC'});const continued=ingestion.prepareStageContinuation(candidate.project,{stage:2,owningTabInstance:'SYNTHETIC-REPRODUCTION'});
assert.deepEqual(JSON.parse(JSON.stringify(candidate.acceptance.impact.affected)),[],'ACTIVE_WORK_IMPACT_ORACLE: initial acceptance must not require repeating audit archives or untouched legacy templates');
assert.equal(candidate.acceptance.impact.requiresConfirmation,false,'ACTIVE_WORK_IMPACT_ORACLE: no replacement or affected work means no second confirmation');
const archivedBefore=runtime.closedLoopHash.stableStringify(before.projectData.migrationArchives),checkpoint=(await store.historyList(before.job.JOB_ID)).activeId;
note('The retained-project path: malformed response, corrected prompt, rejected proposal, and valid initial response has no replacement impact');
await runtime.acceptPendingProposal();
assert.equal(runtime.replacementReview,null,'ACTIVE_WORK_IMPACT_ORACLE: initial acceptance must complete without an unnecessary replacement review');
assert.equal(failures.length,0,JSON.stringify(failures));
assert.equal(runtime.current.projectData.sources.length,1,'INITIAL_SOURCE_ACCEPTANCE: explicit acceptance of the valid initial response must commit exactly one source');
assert.equal(runtime.closedLoopHash.stableStringify(runtime.current.projectData.migrationArchives),archivedBefore);
const committed=copy(runtime.current);await runtime.acceptPendingProposal();assert.equal(runtime.current.projectSha256,committed.projectSha256);
note('Actual acceptance commits one source, preserves migration evidence, and repeated submission makes no second commit');
const restored=await store.restoreCheckpoint(before.job.JOB_ID,checkpoint,{expectedProjectRevision:runtime.current.revision});
assert.equal(restored.project.projectData.sources.length,0);assert.equal(ingestion.findProposal(restored.project,staged.proposal.proposalId).status,'PENDING_OPERATOR_REVIEW');assert.equal(runtime.closedLoopHash.stableStringify(restored.project.projectData.migrationArchives),archivedBefore);
note('Restoration returns the matching unaccepted proposal and exact migration evidence');
// Drafts are authored work, including partial values and unstructured notes.
// Unchanged legacy field names and titles do not make a blank template authored.
for(const definition of core.STAGES){
 const number=definition.number,template=core.stageTemplate(definition);
 assert.equal(engine.hasAuthoredStageDraft({draftRecord:template},number),false);
 assert.equal(engine.hasAuthoredStageDraft({draftRecord:`STAGE ${String(number).padStart(2,'0')} — Prior title\nLEGACY_FIELD: <<ENTER>>`},number),false,'ACTIVE_WORK_IMPACT_ORACLE: legacy template is not work');
 for(const text of [template.replace('<<ENTER>>','Actual draft'),template+'\nOperator note',JSON.stringify({note:'Actual draft'})])assert.equal(engine.hasAuthoredStageDraft({draftRecord:text},number),true,'AUTHORED_DRAFT_IMPACT_ORACLE: authored work must be protected');
}
note('Draft classification covers every stage, old templates, partial values, appended notes, and structured drafts');
// Use real generated pending work through the existing authoritative fixture.
const {stage04AcceptanceFixture,stage04AcceptanceEnvelope}=await import('./test-fixtures.mjs');
const later=stage04AcceptanceFixture(runtime,'ACTIVE-WORK-PENDING');
const pendingPrompt=prompts.reserveAndBuildPromptRecord(later,4).prompt;
const pendingEnvelope=stage04AcceptanceEnvelope(runtime,later,pendingPrompt);
const pending=ingestion.prepare(later,{stage:4,text:JSON.stringify(pendingEnvelope),promptRecord:pendingPrompt,transport:{authority:'AUTHORITATIVE_RESPONSE_FILE',packageId:pendingPrompt.packageId,operationReservationId:pendingPrompt.operationReservationId,challengeNonce:pendingPrompt.challengeNonce}});assert.equal(pending.validation.valid,true,JSON.stringify(pending.validation.issues));
const affected=engine.downstreamWorkImpact(pending.project,1);
assert.ok(affected.some(row=>row.stage===4&&row.work.some(work=>work.kind==='responseProposals'&&work.id===pending.proposal.proposalId)),'PENDING_WORK_IMPACT_ORACLE: a valid unaccepted downstream response must appear in confirmation');
const pendingArchive=JSON.stringify(pending.project.projectData.migrationArchives||[]);engine.invalidateDownstream(pending.project,1,'SYNTHETIC-UPSTREAM-CHANGE');
assert.equal(ingestion.findProposal(pending.project,pending.proposal.proposalId).status,'STALE');assert.equal(JSON.stringify(pending.project.projectData.migrationArchives||[]),pendingArchive);
note('Actual downstream prompt and pending proposal require confirmation and become stale on upstream replacement');
console.log(JSON.stringify({synthetic:true,actualBrowser:false,environment:'Actual retained-project import, response and UI owners with production workflow and lifecycle transaction adapter',cases},null,2));
