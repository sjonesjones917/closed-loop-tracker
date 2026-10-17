import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
const {runtime,core,engine,store,copy}=projectStoreRuntime();
const source=fs.readFileSync('app-core.js','utf8');
const extract=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a);return source.slice(a,b);};
Object.assign(runtime,{core,engine,projectStore:store,schema:runtime.closedLoopWorkflowSchema,clone:copy,safe:engine.safe,views:['Overview','Project','Workflow','Records','Files','Release']});
vm.runInContext(extract('const stageRecordText=','const label=')+extract('function blankStage(','function validateImport('),runtime);
const seed=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
const imported=(raw=seed)=>{runtime.seed=copy(raw);return vm.runInContext('importSeed(seed)',runtime);};
const p=imported(),cases=[];
assert.equal(p.stages[1].status,'COMPLETE');assert.equal(p.job.CURRENT_STAGE,'STAGE 02');
const change=p.projectData.acceptedChanges.find(x=>x.stage===1),proposal=p.projectData.responseProposals.find(x=>x.proposalId===change.proposalId);
assert.equal(proposal.source,'DETERMINISTIC_MIGRATION');assert.equal(proposal.migrationSchema,'human-project/30');
assert.equal(change.scope.inputVersion,p.job.CURRENT_INPUT_VERSION);
assert.equal(proposal.migrationSourceSha256,runtime.closedLoopHash.sha256Value(copy(seed)));assert.equal(change.migrationSourceSha256,proposal.migrationSourceSha256);
for(const name of ['EXACT_DELIVERABLE_REQUESTED','ASSUMPTIONS','UNKNOWN_INFORMATION','INPUT_SET_CONTENTS']){
 assert(change.stageFields.includes(name));assert.equal(proposal.proposedStageData[name],p.stages[1].agentData[name]);assert.equal(proposal.proposedStageData[name],p.stages[1].acceptedData[name]);assert.equal(proposal.proposedStageData[name],p.job[name]);
}
assert.deepEqual(JSON.parse(JSON.stringify(p.projectData.migrationArchives.find(x=>x.kind==='ORIGINAL_IMPORT_PAYLOAD').payload)),seed);
assert.equal(p.projectData.rawResponses.length,0);assert.equal(p.projectData.responseValidations.length,0);
cases.push('retained historical values remain complete, scoped and explicitly migrated without fabricated raw response/validation');
for(const [label,mutate] of [
 ['missing scope',q=>{delete q.projectData.acceptedChanges[0].scope;}],
 ['stale input version',q=>{q.projectData.acceptedChanges[0].scope.inputVersion='INPUT-STALE';}],
 ['missing field contribution',q=>{q.projectData.acceptedChanges[0].stageFields=[];}],
 ['missing proposal',q=>{q.projectData.responseProposals=[];}],
 ['missing accepted field',q=>{delete q.projectData.responseProposals[0].proposedStageData.EXACT_DELIVERABLE_REQUESTED;}],
 ['changed agent value',q=>{q.stages[1].agentData.EXACT_DELIVERABLE_REQUESTED='changed';}],
 ['changed job value',q=>{q.job.EXACT_DELIVERABLE_REQUESTED='changed';}],
 ['invalidated acceptance',q=>{q.projectData.acceptedChanges[0].invalidatedBy='CONTROL';}]
]){const q=copy(p);mutate(q);engine.recalculate(q);assert.notEqual(q.stages[1].status,'COMPLETE',label);cases.push(label+' remains blocked');}
const unfinished=copy(seed);unfinished.stageRecords[1].status='NOT STARTED';const q=imported(unfinished);assert.equal(q.projectData.responseProposals.length,0);assert.equal(q.projectData.acceptedChanges.length,0);assert.equal(q.projectData.stageConfirmations.length,0);assert.notEqual(q.stages[1].status,'COMPLETE');cases.push('unfinished legacy record creates no acceptance');
for(const [label,mutate,field] of [
 ['missing deliverable',raw=>delete raw.userJobInput.deliverable,'EXACT_DELIVERABLE_REQUESTED'],
 ['missing assumptions',raw=>delete raw.assumptions,'ASSUMPTIONS'],
 ['missing unknowns',raw=>delete raw.unknowns,'UNKNOWN_INFORMATION']
]){const raw=copy(seed);mutate(raw);const project=imported(raw),proposal=project.projectData.responseProposals[0];assert(!Object.hasOwn(proposal.proposedStageData,field));assert(!project.projectData.acceptedChanges[0].stageFields.includes(field));assert.notEqual(project.stages[1].status,'COMPLETE');cases.push(label+' is not fabricated as an accepted default');}
const empty=copy(seed);empty.userJobInput.deliverable='';assert.notEqual(imported(empty).stages[1].status,'COMPLETE');cases.push('explicit empty deliverable remains incomplete');
const invalidated=copy(p);engine.invalidateStageForAuthorityChange(invalidated,{stage:1});assert.notEqual(invalidated.stages[1].status,'COMPLETE');assert.equal(engine.acceptedChanges(invalidated,1).length,0);assert.deepEqual(invalidated.projectData.migrationArchives,p.projectData.migrationArchives);cases.push('authority invalidation blocks while preserving archive');
const refined=copy(p);engine.invalidateAcceptedResponse(refined,{stage:1});assert.notEqual(refined.stages[1].status,'COMPLETE');assert.equal(engine.acceptedChanges(refined,1).length,0);assert.deepEqual(refined.projectData.migrationArchives,p.projectData.migrationArchives);cases.push('response refinement retires authority and preserves archives');
const saved=await store.writeProject(p,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});const read=await store.readProject(saved.job.JOB_ID);assert.equal(read.stages[1].status,'COMPLETE');assert.equal(read.job.CURRENT_STAGE,'STAGE 02');cases.push('storage round trip retains Stage01/02');
console.log(JSON.stringify({retainedStage01Projection:'PASS',cases},null,2));
