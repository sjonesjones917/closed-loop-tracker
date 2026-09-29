import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {responseFixture,OBJECTIVE} from './operator-journey-fixtures.mjs';
const r=projectStoreRuntime(),{core,engine,prompts,ingestion,store,copy,runtime}=r,schema=runtime.closedLoopWorkflowSchema,cases=[],note=name=>cases.push({name,result:'PASS'});
let p=await store.createProject({commandId:'REQUIRED-SCOPE-PROJECT'}),draft=copy(p);draft.job.EXACT_USER_OBJECTIVE_VERBATIM=OBJECTIVE;engine.recordHumanInputVersion(draft,['EXACT_USER_OBJECTIVE_VERBATIM']);p=await store.writeProject(draft,{expectedProjectRevision:p.revision});
draft=copy(p);const prompt=prompts.reserveAndBuildPromptRecord(draft,1).prompt;p=await store.writeProject(draft,{expectedProjectRevision:p.revision});
const envelope=responseFixture({schema,engine,prompt,manifest:prompts.promptFileManifest(prompt),instructionBytes:Buffer.from(prompt.prompt)}),prepared=ingestion.prepare(p,{stage:1,text:JSON.stringify(envelope),promptRecord:prompt,expectedCommittedRevision:p.revision,transport:{authority:'AUTHORITATIVE_RESPONSE_FILE',packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce}});assert.equal(prepared.validation.valid,true,JSON.stringify(prepared.validation.issues));p=await store.writeProject(prepared.project,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,operational:true});p=await store.writeProject(ingestion.commit(p,prepared.proposal.proposalId).project,{expectedProjectRevision:p.revision});
draft=copy(p);engine.recordStageConfirmation(draft,1,true,'Synthetic operator confirms the literal requested file.','SYNTHETIC',{acceptedChangeId:engine.acceptedChanges(draft,1).at(-1).changeId,inputVersion:draft.job.CURRENT_INPUT_VERSION});p=await store.writeProject(draft,{expectedProjectRevision:p.revision});assert.equal(engine.gate(1,p).complete,true);


const owningStage=core.STAGES.find(stage=>stage.number>core.STAGES[0].number),operation=schema.STAGE_CONTRACTS[owningStage.number].operations[0];draft=copy(p);const next=prompts.reserveAndBuildPromptRecord(draft,owningStage.number,{operation}).prompt;
const required=schema.STAGE_OPERATION_SCOPE_MATRIX[`${owningStage.number}:${operation}`].requiredDimensions;
for(const dimension of required)assert.ok(next.scope[dimension]!=null&&String(next.scope[dimension]).trim()&&!['UNKNOWN','PENDING','UNASSIGNED','NOT APPLICABLE'].includes(String(next.scope[dimension]).toUpperCase()),'REQUIRED_RESERVED_SCOPE_ORACLE: '+dimension+' must have an application-reserved identity before the instruction is exported');
const reservation=engine.records(draft,'operationReservations').find(row=>engine.recordId(row,'operationReservations')===next.operationReservationId);assert.deepEqual(copy(engine.recordValue(reservation,'SCOPE')),copy(next.scope));
assert.equal(p.job.CURRENT_SOURCE_SET_VERSION,null,'Preparing the next stage must not make its reserved output current');
note('A new external operation reserves every required identity before handoff without accepting its target');
const hash=runtime.closedLoopHash,bound=copy(next.scope),before=hash.sha256Value(draft);
for(const dimension of required){
 const missing=copy(bound);delete missing[dimension];assert.throws(()=>engine.assertOperationScope(draft,owningStage.number,operation,missing),error=>error.code==='MISSING_REQUIRED_SCOPE'&&error.dimensions.includes(dimension),'OPERATION_SCOPE_ORACLE: missing '+dimension+' was not rejected');
 assert.doesNotThrow(()=>engine.assertOperationScope(draft,owningStage.number,operation,bound));
}
for(const [name,changed,code] of [
 ['unregistered dimension',{...bound,unregisteredFutureVersion:'UNAUTHORIZED'},'EXTRA_OPERATION_SCOPE'],
 ['stale input',{...bound,inputVersion:'STALE-INPUT'},'STALE_SCOPE'],
 ['unreserved output',{...bound,sourceSetVersion:'UNRESERVED-OUTPUT'},'UNRESERVED_SCOPE_TARGET']
]){assert.throws(()=>engine.assertOperationScope(draft,owningStage.number,operation,copy(changed)),error=>error.code===code,'OPERATION_SCOPE_ORACLE: '+name+' was not rejected');assert.doesNotThrow(()=>engine.assertOperationScope(draft,owningStage.number,operation,bound));note(name+' rejects for its specific scope violation; removing it passes');}
assert.equal(hash.sha256Value(draft),before,'Scope rejection changed the project or reservation');
p=await store.writeProject(draft,{expectedProjectRevision:p.revision});
const response=responseFixture({schema,engine,prompt:next,manifest:prompts.promptFileManifest(next),instructionBytes:Buffer.from(next.prompt)}),ingested=ingestion.prepare(p,{stage:next.stage,text:JSON.stringify(response),promptRecord:next,expectedCommittedRevision:p.revision,transport:{authority:'AUTHORITATIVE_RESPONSE_FILE',packageId:next.packageId,operationReservationId:next.operationReservationId,challengeNonce:next.challengeNonce}});
assert.equal(ingested.validation.valid,true,JSON.stringify(ingested.validation.issues));p=await store.writeProject(ingested.project,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,operational:true});p=await store.writeProject(ingestion.commit(p,ingested.proposal.proposalId).project,{expectedProjectRevision:p.revision});
assert.equal(p.job.CURRENT_SOURCE_SET_VERSION,bound.sourceSetVersion,'Acceptance did not activate the exact reserved output version');
assert.throws(()=>engine.assertOperationScope(p,next.stage,next.operation,bound),error=>error.code==='UNRESERVED_SCOPE_TARGET','OPERATION_SCOPE_ORACLE: an accepted target was reusable as a new reservation');
const acceptedBefore=copy(engine.acceptedChanges(p,next.stage));draft=copy(p);const repeat=prompts.reserveAndBuildPromptRecord(draft,next.stage,{operation:next.operation}).prompt;
assert.notEqual(repeat.scope.sourceSetVersion,bound.sourceSetVersion,'OPERATION_SCOPE_ORACLE: repeated authoring reused an accepted output identity');assert.equal(draft.job.CURRENT_SOURCE_SET_VERSION,bound.sourceSetVersion);assert.deepEqual(copy(engine.acceptedChanges(draft,next.stage)),acceptedBefore);
assert.doesNotThrow(()=>engine.assertOperationScope(draft,next.stage,next.operation,repeat.scope));
const retry=prompts.reserveAndBuildPromptRecord(draft,next.stage,{operation:next.operation}).prompt;assert.equal(retry.instructionId,repeat.instructionId);assert.equal(retry.scope.sourceSetVersion,repeat.scope.sourceSetVersion);
note('Accepted targets cannot be reused; repeated authoring allocates a new target and exact retry retains that reservation without replacing accepted work');
console.log(JSON.stringify({synthetic:true,actualBrowser:false,scope:'Executed authoring boundary with actual prerequisite acceptance; this does not claim all 66 operations are verified',stage:owningStage.number,operation,required,cases},null,2));
