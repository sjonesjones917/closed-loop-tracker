import assert from 'node:assert/strict';import {projectStoreRuntime,restoreArtifactFixture,hydrateRetainedPromptContexts} from './test-project-store-runtime.mjs';import {deferredReviewedPrerequisiteFixture,currentRetainedFixtureProject} from './test-fixtures.mjs';import {authorizeSyntheticHandoff} from './test-handoff-authorization.mjs';import {readStoreArchive} from './test-zip.mjs';
export async function verifyBlindHandoffDisclosure({sourceOverrides={}}={}){
const r=projectStoreRuntime({sourceOverrides}),prefix=deferredReviewedPrerequisiteFixture(r,'nativeStage15'),instant=prefix.archivedFixtureClockUtc;assert(instant);r.runtime.Date=class extends Date{constructor(...args){super(...(args.length?args:[instant]));}static now(){return Date.parse(instant);}};await restoreArtifactFixture(r.store,prefix.artifacts);let p=currentRetainedFixtureProject(r,prefix.project);await hydrateRetainedPromptContexts(r,p,prefix.contextFiles||[]);p=await r.store.writeProject(p,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});for(let n=1;n<=12;n++)assert.equal(r.engine.gate(n,p).complete,true,'Retained genuine precursor '+n);
// This archived fixture already accepted COMPARE. Replaying its old command
// after fresh-store fixture seeding correctly finds an expired receipt; that
// is not a new operator request and must not become a valid package.
const unchanged=r.copy(p),before={revision:p.revision,raw:JSON.stringify(p.projectData.rawResponses),accepted:JSON.stringify(p.projectData.acceptedChanges),history:JSON.stringify(p.projectData.history)},oldPromptIds=new Set(p.projectData.generatedPrompts.map(row=>row.instructionId)),oldReservations=r.engine.records(p,'operationReservations').map(row=>({id:r.engine.recordId(row,'operationReservations'),status:r.engine.recordValue(row,'STATUS')}));
assert(oldReservations.some(row=>row.status==='EXPIRED_BY_SCOPE'),'BLIND_RETAINED_REPLAY_SETUP_ORACLE');
assert.throws(()=>r.prompts.reserveAndBuildPromptRecord(unchanged,13,{operation:'COMPARE'}),error=>error.message==='The authoritative external instruction was not atomically bound to its application-owned reservation transaction.','BLIND_RETAINED_REPLAY_REJECTION_ORACLE');
assert.equal(p.revision,before.revision);assert.equal(JSON.stringify(p.projectData.history),before.history,'BLIND_REPLAY_PRESERVES_SOURCE_ORACLE');
// Model the existing Refine accepted result action (app-core.js) using its
// owning history command and exact accepted subject. This is synthetic
// operator continuation, not a History restore or a real human observation.
const change=r.engine.acceptedChanges(p,13).filter(row=>row.operation==='COMPARE').at(-1);assert(change,'BLIND_ACCEPTED_REFINEMENT_SETUP_ORACLE');
const reason='Recheck the synthetic comparison for omitted disagreements while preserving blinded run identities.';
r.engine.addHistory(p,'REPLACEMENT_REQUESTED',{stage:13,operation:'COMPARE',scope:r.copy(change.scope||{}),rawResponseId:change.rawResponseId,promptId:change.promptId||null,reason});
const request=p.projectData.history.at(-1),revision=p.revision,prompt=r.prompts.reserveAndBuildPromptRecord(p,13,{operation:'COMPARE'}).prompt;
assert(!oldPromptIds.has(prompt.instructionId),'BLIND_REFINEMENT_FRESH_INSTRUCTION_ORACLE');
assert(prompt.transportBindingRequired,'BLIND_REFINEMENT_TRANSPORT_BINDING_ORACLE');assert.equal(prompt.scope.projectRevision,revision+1);
assert(prompt.contextManifest.acceptedResultRefinements.some(row=>row.eventId===request.eventId&&row.reason===reason&&row.rawResponseId===change.rawResponseId),'BLIND_REFINEMENT_CONTEXT_ORACLE');
p=await r.store.writeProject(p,{expectedProjectRevision:revision});
assert.equal(p.revision,prompt.scope.projectRevision,'BLIND_REFINEMENT_SAVED_REVISION_ORACLE');
const reservation=r.engine.records(p,'operationReservations').find(row=>r.engine.recordId(row,'operationReservations')===prompt.operationReservationId);assert(reservation,'BLIND_REFINEMENT_RESERVATION_ORACLE');assert.equal(r.engine.recordValue(reservation,'STATUS'),'RESERVED');assert.equal(Number(r.engine.recordValue(reservation,'RESERVATION_REVISION')),p.revision);
assert.equal(JSON.stringify(p.projectData.rawResponses),before.raw,'BLIND_REFINEMENT_PRESERVES_RAW_ORACLE');assert.equal(JSON.stringify(p.projectData.acceptedChanges),before.accepted,'BLIND_REFINEMENT_PRESERVES_ACCEPTED_ORACLE');
assert.equal(JSON.stringify(p.projectData.history.slice(0,JSON.parse(before.history).length)),before.history,'BLIND_REFINEMENT_PRESERVES_HISTORY_ORACLE');
for(const prior of oldReservations)assert.equal(r.engine.recordValue(r.engine.records(p,'operationReservations').find(row=>r.engine.recordId(row,'operationReservations')===prior.id),'STATUS'),prior.status,'BLIND_REFINEMENT_PRESERVES_PRIOR_RESERVATION_ORACLE');
for(let n=1;n<=12;n++)assert.equal(r.engine.gate(n,p).complete,true,'Refinement retains genuine precursor '+n);
assert(prompt.contextManifest.blindAliasMap.length>0,'Actual blind mapping required');
const allowed=await authorizeSyntheticHandoff(r,{project:p,prompt}),pkg=await r.store.createExecutionPackage(allowed.request),members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer()));for(const member of members){const text=new TextDecoder().decode(member.bytes);assert(!text.includes('blindAliasMap'));for(const alias of prompt.contextManifest.blindAliasMap)assert(!text.includes(alias.canonicalId),'private canonical identity in '+member.canonicalPath);}
const out={synthetic:true,actualBrowser:false,archivedFixtureClockUtc:instant,earlierCompleteFlagsForced:false,stage:13,operation:'COMPARE',retainedReplayRejected:true,syntheticAcceptedRefinement:true,acceptedHistoryPreserved:true,freshInstructionId:prompt.instructionId,reservationId:prompt.operationReservationId,reservationRevision:prompt.scope.projectRevision,aliasCount:prompt.contextManifest.blindAliasMap.length,exactCurrentAuthorizationAllowed:allowed.review.authorization.allowed,actualZipMembers:members.map(m=>m.canonicalPath),privateCanonicalAliasesExcluded:true,result:'PASS'};return out;
}
