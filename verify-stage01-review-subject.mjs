import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {readStoreArchive} from './test-zip.mjs';
import {acceptPrerequisite, authorizeFixtureHandoff, stage01AcceptanceFixture, stage04AcceptanceFixture, stage04AcceptanceEnvelope, recordProposal, evidence} from './test-fixtures.mjs';

// Sections 6.5A and 26.5: a Stage 01 challenger/reconciler receives the
// accepted intake it must examine. Stage 03's first independent pass is blind.
// The Stage 04 challenge is a conforming control for the same ZIP observation.
const r=projectStoreRuntime(),schema=r.runtime.closedLoopWorkflowSchema;
const runtime={...r,schema};

function dataMembers(archive){
  const member=path=>archive.find(row=>row.canonicalPath===path);
  const instruction=Buffer.from(member('instruction.txt').bytes).toString('utf8');
  const manifest=JSON.parse(Buffer.from(member('manifest.json').bytes).toString('utf8'));
  assert.equal(createHash('sha256').update(instruction).digest('hex'),manifest.promptIdentity.bodySha256,'The exported instruction differs from its manifest identity.');
  const data=[...instruction.matchAll(/BEGIN_UNTRUSTED_DATA_BLOCK\n([^\n]+)\nEND_UNTRUSTED_DATA_BLOCK/g)].map(match=>JSON.parse(match[1]));
  for(const identity of manifest.contextFiles||[]){
    const bytes=member(identity.path)?.bytes;
    assert(bytes,'A declared prompt context member is absent from the exported ZIP.');
    assert.equal(createHash('sha256').update(bytes).digest('hex'),identity.sha256,'The exported context member differs from its manifest identity.');
    data.push(...JSON.parse(Buffer.from(bytes).toString('utf8')).members);
  }
  return {manifest,instruction,data};
}

async function exportCurrent(project,stage,operation,{createOnly=false,confirmAffected=false}={}){
  if(createOnly)project=await r.store.writeProject(project,{createOnly:true,expectedProjectRevision:0,incrementRevision:false});
  const draft=r.copy(project),issued=r.prompts.reserveAndBuildPromptRecord(draft,stage,{operation}).prompt;
  const writeOptions={expectedProjectRevision:project.revision,expectedStateSha256:project.projectSha256};
  if(confirmAffected){
    let review;try{await r.store.writeProject(draft,writeOptions);}catch(error){assert.equal(error.code,'MUTATION_CONFIRMATION_REQUIRED','The stage revisit failed before affected-work review.');review=error.impact;}
    assert.equal(review?.requiresConfirmation,true,'The stage revisit did not surface its affected-work review.');
    project=await r.store.writeProject(draft,{...writeOptions,mutationConfirmation:review});
  }else project=await r.store.writeProject(draft,writeOptions);
  let prompt=project.projectData.generatedPrompts.find(row=>row.instructionId===issued.instructionId);
  await r.store.persistPromptContextFiles(prompt,project);
  ({project,prompt}=await authorizeFixtureHandoff(r,{project,prompt}));
  const archive=readStoreArchive(new Uint8Array(await (await r.store.createExecutionPackage({jobId:project.job.JOB_ID,stage,operation,instructionId:prompt.instructionId})).blob.arrayBuffer()));
  const exported=dataMembers(archive);
  assert.equal(exported.instruction,prompt.prompt,'The ZIP did not contain the saved current instruction.');
  return {project,prompt,archive,...exported};
}

function submit(project,prompt,content){
  const manifest=r.prompts.promptFileManifest(prompt);
  const envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:project.job.JOB_ID,stage:prompt.stage,operation:prompt.operation,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce,scope:manifest.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],humanAuthorityCandidates:[],stageData:{},records:{},evidence:[evidence('stage01-review-subject')],unresolved:[],warnings:[],attachments:[],...content};
  const text=JSON.stringify(envelope),transport={authority:'NONAUTHORITATIVE_TEXT_FALLBACK',materializedAsResponseFile:true,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce,promptIdentity:manifest.promptIdentity};
  const prepared=r.ingestion.prepare(project,{stage:prompt.stage,promptRecord:prompt,text,transport});
  assert.equal(prepared.validation.valid,true,JSON.stringify(prepared.validation.issues));
  const impact=r.ingestion.acceptanceImpact(prepared.project,prepared.proposal.proposalId);
  return r.ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'SYNTHETIC_FIXTURE_OPERATOR',replacementConfirmation:impact}).project;
}
async function persistAccepted(previous,next){
  const impact=r.store.mutationImpact(previous,next);
  return r.store.writeProject(next,{expectedProjectRevision:previous.revision,expectedStateSha256:previous.projectSha256,mutationConfirmation:impact});
}

// Conforming control: the exported Stage 04 review has the actual authored
// semantic requirement, independently read from the accepted project state.
let stage4=stage04AcceptanceFixture(runtime,'JOB-STAGE01-REVIEW-CONTROL');
const stage4Author=r.prompts.reserveAndBuildPromptRecord(stage4,4,{operation:'COMPLETE'}).prompt;
const stage4Envelope=stage04AcceptanceEnvelope(runtime,stage4,stage4Author);
const disposition=stage4Envelope.evidence.find(row=>row.kind==='OBLIGATION_DISPOSITION');
assert(disposition,'The Stage 04 control did not produce an authored disposition.');
disposition.content=JSON.stringify({...JSON.parse(disposition.content),disposition:'inapplicable',reason:'The author proposes this controlled context is outside requirement scope.'});
stage4=submit(stage4,stage4Author,stage4Envelope);
assert.equal(r.engine.operationalNextAction(stage4,4).operation,'DISPOSITION_CHALLENGE','The Stage 04 control did not reach its actual review operation.');
const stage4Export=await exportCurrent(stage4,4,'DISPOSITION_CHALLENGE',{createOnly:true});
const authoredRequirement=r.engine.recordsForCurrentScope(stage4Export.project,'requirements').find(row=>Number(row.stage)===4);
assert(authoredRequirement,'The Stage 04 control has no accepted authored requirement.');
const requirementCarrier=stage4Export.data.find(row=>row.sourceIdentity==='collection.requirements');
assert(requirementCarrier,'The exported Stage 04 control omitted its authored requirement carrier.');
const transportedRequirement=JSON.parse(requirementCarrier.value).records.find(row=>row.id===authoredRequirement.id);
assert.equal(transportedRequirement?.fields?.OBLIGATION,authoredRequirement.fields.OBLIGATION,'The Stage 04 control carrier changed the authored semantic target.');
assert.equal(stage4Export.prompt.promptEngineVersion,r.prompts.versionFor(4,'DISPOSITION_CHALLENGE'),'An unchanged Stage 04 packet was invalidated by the Stage 01 correction.');
const stage4Review=submit(stage4Export.project,stage4Export.prompt,{records:{semanticChallenges:[recordProposal(schema,'semanticChallenges',{tempKey:'stage04-control-review',overrides:{FINDINGS:'The exact authored disposition and governing requirement were available for review.',DISPOSITION:'ACCEPTED',REASONING:'Compared the exported requirement content and the bounded disposition against the controlled Stage 04 obligations.'}})]}});
assert(r.engine.acceptedChanges(stage4Review,4).some(row=>row.operation==='DISPOSITION_CHALLENGE'),'The unchanged Stage 04 packet could not be admitted and accepted.');

let stage1=stage01AcceptanceFixture(runtime,'JOB-STAGE01-REVIEW-SUBJECT');
const acceptedCapture=stage1.stages[1].agentData.INPUT_SET_CONTENTS;
let challenge=await exportCurrent(stage1,1,'SEMANTIC_CHALLENGE',{createOnly:true});
stage1=challenge.project;
const subjectFor=exported=>exported.data.find(row=>row.sourceIdentity==='context.stage1.acceptedAuthorProposal');
function assertAuthorSubject(exported,project){
  const subject=subjectFor(exported);
  assert(subject,'The actual exported Stage 01 '+exported.prompt.operation+' package omitted the current accepted author proposal.');
  const value=JSON.parse(subject.value),author=r.engine.acceptedChanges(project,1).filter(row=>['COMPLETE','RECONCILE_INTAKE'].includes(row.operation)).at(-1);
  assert.equal(value.acceptedChangeId,author.changeId,'The Stage 01 reviewer received a stale author identity.');
  assert.equal(value.inputVersion,project.job.CURRENT_INPUT_VERSION,'The Stage 01 reviewer received another input version.');
  assert.equal(value.stageData.INPUT_SET_CONTENTS,project.stages[1].agentData.INPUT_SET_CONTENTS,'The Stage 01 reviewer did not receive the complete current canonical capture.');
  assert.equal(value.stageData.EXACT_DELIVERABLE_REQUESTED,project.stages[1].agentData.EXACT_DELIVERABLE_REQUESTED,'The Stage 01 reviewer did not receive the authored deliverable.');
  return value;
}
assertAuthorSubject(challenge,stage1);
assert.equal(stage1.stages[1].agentData.INPUT_SET_CONTENTS,acceptedCapture,'The test setup changed accepted intake before review.');

stage1=submit(stage1,challenge.prompt,{records:{semanticChallenges:[recordProposal(schema,'semanticChallenges',{tempKey:'intake-omission',overrides:{FINDINGS:'The authored intake should explicitly retain the verified-content condition.',DISPOSITION:'REJECTED',REASONING:'The current human requirement requires a direct check against the accepted per-unit accounting.'}})]}});
stage1=await persistAccepted(challenge.project,stage1);
assert.equal(r.engine.gate(1,stage1).complete,false,'A rejected Stage 01 challenge falsely completed intake.');
assert.equal(stage1.job.NEXT_REQUIRED_ACTION.operation,'RECONCILE_INTAKE','The rejected Stage 01 challenge did not route to reconciliation.');
const reconcile=await exportCurrent(stage1,1,'RECONCILE_INTAKE');
stage1=reconcile.project;
assertAuthorSubject(reconcile,stage1);
const challengeCarrier=reconcile.data.find(row=>row.sourceIdentity==='collection.semanticChallenges');
assert(challengeCarrier,'The Stage 01 reconciliation package omitted the accepted challenge.');
assert(JSON.parse(challengeCarrier.value).records.some(row=>row.fields.DISPOSITION==='REJECTED'),'The Stage 01 reconciliation package omitted the substantive rejection.');
stage1=submit(stage1,reconcile.prompt,{stageData:r.copy(stage1.stages[1].agentData),records:{semanticReviews:[recordProposal(schema,'semanticReviews',{tempKey:'intake-reconciliation',overrides:{REVIEW_QUESTION:'Was the challenged intake condition resolved?',FINDING:'The exact verified-content condition remains in the retained current capture.',REASONING:'The original per-unit statement and complete current author capture were compared with the independent finding.',RESULT:'ACCEPTED'}})]}});
stage1=await persistAccepted(reconcile.project,stage1);
assert.equal(r.engine.gate(1,stage1).complete,false,'The Stage 01 reconciler approved its own correction.');
assert.equal(stage1.job.NEXT_REQUIRED_ACTION.operation,'SEMANTIC_CHALLENGE','The reconciled Stage 01 intake cannot receive its required fresh challenge.');
const finalChallenge=await exportCurrent(stage1,1,'SEMANTIC_CHALLENGE');
stage1=finalChallenge.project;
assertAuthorSubject(finalChallenge,stage1);
stage1=submit(stage1,finalChallenge.prompt,{records:{semanticChallenges:[recordProposal(schema,'semanticChallenges',{tempKey:'independent-intake-approval',overrides:{FINDINGS:'The reconciled intake retains the verified-content condition and accounts for every current input unit.',DISPOSITION:'ACCEPTED',REASONING:'Independent comparison of the current accepted capture, raw-input manifest, and corrected finding.'}})]}});
stage1=await persistAccepted(finalChallenge.project,stage1);
const finalChange=r.engine.acceptedChanges(stage1,1).at(-1);
r.engine.recordStageConfirmation(stage1,1,true,'The reviewed objective and deliverable match the represented current intent.','SYNTHETIC_FIXTURE_OPERATOR',{acceptedChangeId:finalChange.changeId,inputVersion:stage1.job.CURRENT_INPUT_VERSION});
r.engine.recalculate(stage1);
stage1=await persistAccepted(await r.store.readProject(stage1.job.JOB_ID),stage1);
assert.equal(r.engine.gate(1,stage1).complete,true,'Conforming corrected Stage 01 work cannot progress after the required independent review and human confirmation: '+r.engine.gate(1,stage1).reasons.join(' | '));
const reloaded=await r.store.readProject(stage1.job.JOB_ID);
assert.equal(reloaded.stages[1].agentData.INPUT_SET_CONTENTS,acceptedCapture,'Storage reload lost the complete accepted Stage 01 capture.');
assert.equal(r.engine.gate(1,reloaded).complete,true,'Storage reload lost the verified Stage 01 gate.');

// An earlier review may be requested after later stages have already created
// their own versions. Its accepted finding still belongs to the review stage.
let revisitedStage1=stage04AcceptanceFixture(runtime,'JOB-REVISITED-STAGE01-REVIEW');
assert(revisitedStage1.job.CURRENT_SOURCE_SET_VERSION&&revisitedStage1.job.CURRENT_RESEARCH_VERSION,'The revisit fixture has no later stage versions to expose the scope fault.');
const revisitedChallenge=await exportCurrent(revisitedStage1,1,'SEMANTIC_CHALLENGE',{createOnly:true});
revisitedStage1=submit(revisitedChallenge.project,revisitedChallenge.prompt,{records:{semanticChallenges:[recordProposal(schema,'semanticChallenges',{tempKey:'revisited-intake-omission',overrides:{FINDINGS:'The accepted intake omits a governing condition.',DISPOSITION:'REJECTED',REASONING:'The current author proposal must be corrected against the exact input unit.'}})]}});
const revisitedFinding=r.engine.records(revisitedStage1,'semanticChallenges').find(row=>row.sourceProposalId===r.engine.acceptedChanges(revisitedStage1,1).at(-1)?.proposalId);
assert(revisitedFinding,'The later-stage revisit did not commit its independent Stage 01 finding.');
assert.equal(r.engine.operationalNextAction(revisitedStage1,1).operation,'RECONCILE_INTAKE','The later-stage Stage 01 finding did not reach reconciliation.');
const revisitedReconcile=await exportCurrent(revisitedStage1,1,'RECONCILE_INTAKE',{confirmAffected:true});
const revisitedChallengeCarrier=revisitedReconcile.data.find(row=>row.sourceIdentity==='collection.semanticChallenges');
assert(revisitedChallengeCarrier,'The Stage 01 reconciliation ZIP lost its accepted finding after later stage versions existed.');
const exportedRevisitedChallenge=JSON.parse(revisitedChallengeCarrier.value).records.find(row=>row.id===revisitedFinding.id);
assert.equal(exportedRevisitedChallenge?.fields.DISPOSITION,'REJECTED','The Stage 01 reconciliation ZIP omitted the exact rejected review target.');
assert.deepEqual(Object.keys(revisitedFinding.fields.SCOPE).sort(),Object.keys(r.engine.currentScope(revisitedChallenge.project)).sort(),'The Stage 01 review binding lost its canonical scope key shape.');
assert.equal(exportedRevisitedChallenge.fields.SCOPE.inputVersion,revisitedChallenge.prompt.scope.inputVersion,'The Stage 01 review binding lost its prompt-authorized input version.');
assert.equal(revisitedFinding.fields.SCOPE.sourceSetVersion,null,'The Stage 01 finding carried a Stage 02 source-set identity into its review-stage binding.');
assert.equal(revisitedFinding.fields.SCOPE.researchVersion,null,'The Stage 01 finding carried a Stage 03 research identity into its review-stage binding.');

let revisitedStage2=stage04AcceptanceFixture(runtime,'JOB-REVISITED-STAGE02-REVIEW');
const revisitedSearch=await exportCurrent(revisitedStage2,2,'SEARCH_ADEQUACY_REVIEW',{createOnly:true});
revisitedStage2=submit(revisitedSearch.project,revisitedSearch.prompt,{records:{semanticReviews:[recordProposal(schema,'semanticReviews',{tempKey:'revisited-search-finding',overrides:{REVIEW_QUESTION:'Was the current source search adequate?',FINDING:'A governing source category remains unresolved.',REASONING:'The current accepted search contract does not account for that category.',RESULT:'REJECTED'}})]}});
const revisitedSearchFinding=r.engine.records(revisitedStage2,'semanticReviews').find(row=>row.sourceProposalId===r.engine.acceptedChanges(revisitedStage2,2).at(-1)?.proposalId);
assert(revisitedSearchFinding,'The later-stage revisit did not commit its independent Stage 02 review.');
assert.equal(r.engine.operationalNextAction(revisitedStage2,2).operation,'RECONCILE_SOURCE_SEARCH','The later-stage Stage 02 finding did not reach reconciliation.');
const revisitedSearchReconcile=await exportCurrent(revisitedStage2,2,'RECONCILE_SOURCE_SEARCH',{confirmAffected:true});
const revisitedSearchCarrier=revisitedSearchReconcile.data.find(row=>row.sourceIdentity==='collection.semanticReviews');
assert(revisitedSearchCarrier,'The Stage 02 reconciliation ZIP lost its accepted review after later stage versions existed.');
const exportedRevisitedSearch=JSON.parse(revisitedSearchCarrier.value).records.find(row=>row.id===revisitedSearchFinding.id);
assert.equal(exportedRevisitedSearch?.fields.RESULT,'REJECTED','The Stage 02 reconciliation ZIP omitted the exact rejected review target.');
assert.deepEqual(Object.keys(revisitedSearchFinding.fields.SCOPE).sort(),Object.keys(r.engine.currentScope(revisitedSearch.project)).sort(),'The Stage 02 review binding lost its canonical scope key shape.');
assert.equal(exportedRevisitedSearch.fields.SCOPE.inputVersion,revisitedSearch.prompt.scope.inputVersion,'The Stage 02 review binding lost its prompt-authorized input version.');
assert.equal(exportedRevisitedSearch.fields.SCOPE.sourceSetVersion,revisitedSearch.prompt.scope.sourceSetVersion,'The Stage 02 review binding lost its prompt-authorized source set.');
assert.equal(revisitedSearchFinding.fields.SCOPE.researchVersion,null,'The Stage 02 review carried a Stage 03 research identity into its review-stage binding.');

// A saved /90 Stage 01 review packet lacked the target. Preserve its exact
// bytes and accepted author work, reject its stale response, and replace only
// this operation's unsubmitted reservation. Stage 04 remains on /90.
const currentProducer=r.prompts,promptSource=fs.readFileSync('prompt-engine.js','utf8');
const carrier="  if(stage===1&&schema.SEMANTIC_STAGE_OPERATIONS[1].reviewOperations.concat(schema.SEMANTIC_STAGE_OPERATIONS[1].reconcileOperation).includes(operation))add('CURRENT ACCEPTED STAGE 01 AUTHOR PROPOSAL — REVIEW TARGET, NOT HUMAN AUTHORITY',stage01AcceptedAuthorProposal(state),'context.stage1.acceptedAuthorProposal');";
assert(promptSource.includes(carrier),'The Stage 01 carrier fault cannot reach its owning code.');
const oldSource=promptSource.replace("const SCOPED_REVIEW_PROMPT_VERSION='closed-loop-prompt-engine/91';","const SCOPED_REVIEW_PROMPT_VERSION='closed-loop-prompt-engine/90';").replace(carrier,'');
vm.runInContext(oldSource,r.runtime,{filename:'prompt-engine.js:controlled-stage01-review-omission'});
r.prompts=r.runtime.closedLoopPromptEngine;
const oldFixture={...r,schema},oldInitial=stage01AcceptanceFixture(oldFixture,'JOB-STAGE01-OLD-REVIEW'),oldExport=await exportCurrent(oldInitial,1,'SEMANTIC_CHALLENGE',{createOnly:true});
assert.equal(oldExport.prompt.promptEngineVersion,'closed-loop-prompt-engine/90','The cached Stage 01 fault did not create an old-generation packet.');
assert.equal(subjectFor(oldExport),undefined,'The controlled old packet unexpectedly contained the accepted author content.');
const preservedAuthor=r.runtime.closedLoopHash.sha256Value(oldExport.project.projectData.acceptedChanges),oldBytes=oldExport.prompt.prompt;
r.runtime.closedLoopPromptEngine=currentProducer;r.prompts=currentProducer;
assert.equal(r.prompts.versionFor(4,'DISPOSITION_CHALLENGE'),stage4Export.prompt.promptEngineVersion,'Unchanged Stage 04 packets were globally invalidated.');
await assert.rejects(()=>r.store.createExecutionPackage({jobId:oldExport.project.job.JOB_ID,stage:1,operation:'SEMANTIC_CHALLENGE',instructionId:oldExport.prompt.instructionId}),error=>error.code==='EXECUTION_PACKAGE_CURRENT_PROMPT_REQUIRED','The old Stage 01 review ZIP remained exportable after its contract changed.');
const oldEnvelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:oldExport.project.job.JOB_ID,stage:1,operation:'SEMANTIC_CHALLENGE',promptIdentity:r.prompts.promptFileManifest(oldExport.prompt).promptIdentity,packageId:oldExport.prompt.packageId,operationReservationId:oldExport.prompt.operationReservationId,challengeNonce:oldExport.prompt.challengeNonce,scope:oldExport.prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],humanAuthorityCandidates:[],stageData:{},records:{semanticChallenges:[recordProposal(schema,'semanticChallenges',{tempKey:'old-blind-review',overrides:{FINDINGS:'The omitted author proposal cannot be reviewed.',DISPOSITION:'UNKNOWN',REASONING:'The exported packet lacks the accepted Stage 01 author capture.'}})]},evidence:[evidence('old-blind-review')],unresolved:[],warnings:[],attachments:[]};
const oldValidation=r.ingestion.validateEnvelope(oldExport.project,r.copy(JSON.parse(JSON.stringify(oldEnvelope))),{stage:1,promptRecord:oldExport.prompt,rawSha256:r.runtime.closedLoopHash.sha256Text(JSON.stringify(oldEnvelope))});
assert.equal(oldValidation.valid,false,'The old Stage 01 review response was admitted after its producer contract changed.');
assert(oldValidation.issues.some(row=>row.code==='STALE_PROMPT_ENGINE_VERSION'),'The intended old Stage 01 review freshness guard did not reject the response: '+JSON.stringify(oldValidation.issues));
const refreshedDraft=r.copy(oldExport.project),refreshed=r.prompts.reserveAndBuildPromptRecord(refreshedDraft,1,{operation:'SEMANTIC_CHALLENGE'}).prompt;
assert.equal(refreshed.promptEngineVersion,'closed-loop-prompt-engine/91','The Stage 01 review replacement retained the deficient epoch.');
assert.notEqual(refreshed.instructionId,oldExport.prompt.instructionId,'The old Stage 01 review instruction identity was reused.');
assert.equal(refreshedDraft.projectData.generatedPrompts.find(row=>row.instructionId===oldExport.prompt.instructionId).prompt,oldBytes,'The old exported instruction bytes were rewritten.');
assert.equal(r.runtime.closedLoopHash.sha256Value(refreshedDraft.projectData.acceptedChanges),preservedAuthor,'Refreshing the reviewer altered accepted author work.');
assert.equal(r.store.mutationImpact(oldExport.project,refreshedDraft).requiresConfirmation,false,'Refreshing only an unsubmitted deficient review required an unrelated author correction confirmation.');
const refreshedSaved=await r.store.writeProject(refreshedDraft,{expectedProjectRevision:oldExport.project.revision,expectedStateSha256:oldExport.project.projectSha256});
const authorizedFresh=await authorizeFixtureHandoff(r,{project:refreshedSaved,prompt:refreshedSaved.projectData.generatedPrompts.find(row=>row.instructionId===refreshed.instructionId)});
const freshArchive=readStoreArchive(new Uint8Array(await (await r.store.createExecutionPackage({jobId:authorizedFresh.project.job.JOB_ID,stage:1,operation:'SEMANTIC_CHALLENGE',instructionId:authorizedFresh.prompt.instructionId})).blob.arrayBuffer()));
assertAuthorSubject({prompt:authorizedFresh.prompt,...dataMembers(freshArchive)},authorizedFresh.project);
const appSource=fs.readFileSync('app-core.js','utf8'),versionStart=appSource.indexOf('function currentPromptEngineVersion('),versionEnd=appSource.indexOf('function currentPromptRecord(',versionStart);
assert(versionStart>=0&&versionEnd>versionStart,'The actual UI prompt-version selection owner is unavailable.');
vm.runInContext(appSource.slice(versionStart,versionEnd)+'\nglobalThis.uiScopedPromptVersion={promptVersionCurrent,proposalVersionCurrent};',r.runtime,{filename:'app-core.js:scoped-prompt-version'});
assert.equal(r.runtime.uiScopedPromptVersion.promptVersionCurrent(oldExport.prompt),false,'The UI still treats the deficient /90 Stage 01 review as current.');
assert.equal(r.runtime.uiScopedPromptVersion.promptVersionCurrent(authorizedFresh.prompt),true,'The UI cannot select the corrected /91 Stage 01 review.');
assert.equal(r.runtime.uiScopedPromptVersion.promptVersionCurrent(stage4Export.prompt),true,'The UI invalidated an unaffected Stage 04 /90 review.');
assert.equal(r.runtime.uiScopedPromptVersion.proposalVersionCurrent({stage:1,envelope:{operation:'SEMANTIC_CHALLENGE'},preconditions:{promptEngineVersion:oldExport.prompt.promptEngineVersion}}),false,'The UI still treats an old Stage 01 review proposal as current.');
assert.equal(r.runtime.uiScopedPromptVersion.proposalVersionCurrent({stage:4,envelope:{operation:'DISPOSITION_CHALLENGE'},preconditions:{promptEngineVersion:stage4Export.prompt.promptEngineVersion}}),true,'The UI invalidated an unaffected Stage 04 proposal.');

// Section 8.4 requires the first independent Stage 03 extraction to be blind
// to the accepted author result. Check every exported carrier, not a template.
const stage3Marker='STAGE03-ACCEPTED-AUTHOR-ONLY-MARKER';
let stage3=stage04AcceptanceFixture(runtime,'JOB-STAGE03-BLIND-REVIEW');
stage3=acceptPrerequisite(runtime,stage3,3,{stageData:{...stage3.stages[3].agentData,EXCEPTIONS_AND_EDGE_CONDITIONS:stage3Marker}}).project;
assert.equal(r.engine.gate(3,stage3).complete,true,'The Stage 03 blind control has no accepted author result.');
const stage3Export=await exportCurrent(stage3,3,'SEMANTIC_CHALLENGE',{createOnly:true});
assert.equal(stage3Export.prompt.promptEngineVersion,r.prompts.versionFor(3,'SEMANTIC_CHALLENGE'),'The corrected Stage 03 blind instruction used a stale generation.');
assert.equal(stage3Export.prompt.contextManifest.semanticReviewBinding.bindingStatus,'BOUND','The Stage 03 blind review was not bound to an accepted author.');
assert.equal(stage3Export.prompt.contextManifest.readCollections.research,undefined,"The Stage 03 first independent pass received the author's research collection.");
assert.equal(stage3Export.prompt.contextManifest.readCollections.candidateRequirements,undefined,"The Stage 03 first independent pass received the author's candidate requirements.");
assert(stage3Export.archive.every(row=>!Buffer.from(row.bytes).toString('utf8').includes(stage3Marker)),'The Stage 03 accepted author conclusion leaked through an exported carrier.');
assert.match(stage3Export.instruction,/first independent extraction does not receive the author's Stage 03 research or candidate requirements/,'The Stage 03 actor was instructed to compare withheld author material.');

// The browser verifier waits for the saved current prompt. Its old global
// version comparison falsely timed out on the Stage 01/03 scoped review epoch.
let stage2=stage01AcceptanceFixture(runtime,'JOB-STAGE02-BROWSER-SELECTOR');
stage2=await r.store.writeProject(stage2,{createOnly:true,expectedProjectRevision:0,incrementRevision:false});
const stage2Draft=r.copy(stage2),stage2Prompt=r.prompts.reserveAndBuildPromptRecord(stage2Draft,2,{operation:'COMPLETE'}).prompt;
stage2=await r.store.writeProject(stage2Draft,{expectedProjectRevision:stage2.revision,expectedStateSha256:stage2.projectSha256});
const selectorAnchor='record.promptEngineVersion===(closedLoopPromptEngine.versionFor?.(record.stage,record.operation)||closedLoopPromptEngine.version)';
const operationAnchor="record.operation===document.querySelector('#operation-picker')?.value&&";
for(const filename of ['verify-browser.mjs','verify-browser-extra.mjs']){
  const source=fs.readFileSync(filename,'utf8'),match=source.match(/async function waitForSavedPrompt\(cdp\)\{\s*await waitExpr\(cdp,`([^`]+)`\);/);
  assert(match,filename+' lost its actual saved-prompt wait predicate.');
  assert(match[1].includes(selectorAnchor),filename+' retained the global-only version check.');
  assert(match[1].includes(operationAnchor),filename+' omitted the selected operation from the saved-prompt wait.');
  const evaluate=(expression,project,stage,operation)=>createVerifierRuntime.loadScript(createVerifierRuntime({document:{querySelector:selector=>selector==='#current-project-summary'?{dataset:{projectId:project.job.JOB_ID}}:selector==='#stage-picker'?{value:String(stage)}:selector==='#operation-picker'?{value:operation}:null},closedLoopProjectStore:{readProject:async()=>project},closedLoopPromptEngine:r.prompts}),expression);
  assert.equal(await evaluate(match[1],challenge.project,1,'SEMANTIC_CHALLENGE'),true,filename+' falsely rejects the saved Stage 01 /91 review prompt.');
  assert.equal(await evaluate(match[1],stage2,2,'COMPLETE'),true,filename+' falsely rejects the saved Stage 02 /90 prompt.');
  assert.equal(await evaluate(match[1],challenge.project,1,'RECONCILE_INTAKE'),false,filename+' matched another current prompt in the selected stage.');
  assert.equal(await evaluate(match[1].replace(operationAnchor,''),challenge.project,1,'RECONCILE_INTAKE'),true,filename+' missing-operation fault did not reproduce the false match.');
  assert.equal(await evaluate(match[1].replace(selectorAnchor,'record.promptEngineVersion===closedLoopPromptEngine.version'),challenge.project,1,'SEMANTIC_CHALLENGE'),false,filename+' global-version fault did not reproduce the Stage 01 selector failure.');
  assert.equal(stage2Prompt.promptEngineVersion,'closed-loop-prompt-engine/90','The Stage 02 control did not retain the unchanged prompt epoch.');
}
console.log(JSON.stringify({stage01ReviewSubject:'PASS',stage04Control:'PASS',stage03BlindCarrier:'PASS',browserSavedPromptSelectors:'PASS',exportedOperations:['SEMANTIC_CHALLENGE','RECONCILE_INTAKE','SEMANTIC_CHALLENGE'],acceptedChallengeAndReconciliation:true,gateAfterReload:true,oldStage01PacketRejectedAndReplaced:true,unaffectedStage04PacketRetained:true,syntheticExternalActor:true,realHumanOrAgentActionEstablished:false}));
