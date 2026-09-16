import fs from 'node:fs';
import vm from 'node:vm';
import cp from 'node:child_process';
import assert from 'node:assert/strict';
import {stage04AcceptanceFixture,stage04AcceptanceEnvelope} from './test-fixtures.mjs';
globalThis.dispatchEvent=()=>{};
for(const file of ['workbook','hash','workflow-schema','test-runtime','workflow-engine','prompt-engine','response-ingestion']){
 let source=fs.readFileSync(file+'.js','utf8');if(file==='response-ingestion'&&process.env.CLOSED_LOOP_PROPOSAL_PLAN_FAULT==='1'){const anchor='assertProposalPlan(project,proposal,latest,raw);';assert.ok(source.includes(anchor));source=source.replace(anchor,'/* Deliberate disposable precommit fault. */');}vm.runInThisContext(source,{filename:file+'.js'});
}
const runtime={core:closedLoopCore,schema:closedLoopWorkflowSchema,engine:closedLoopWorkflowEngine,prompts:closedLoopPromptEngine,ingestion:closedLoopResponseIngestion}, {engine,prompts,ingestion}=runtime;
const project=stage04AcceptanceFixture(runtime,'DISPOSABLE-PROPOSAL-PLAN'),prompt=prompts.buildPromptRecord(4,project,engine.preparePromptContext(project,4,{operation:'COMPLETE'}).options);project.projectData.generatedPrompts.push(prompt);
const envelope=stage04AcceptanceEnvelope(runtime,project,prompt),prepared=ingestion.prepare(project,{stage:4,text:JSON.stringify(envelope),promptRecord:prompt});assert.equal(prepared.validation.valid,true,JSON.stringify(prepared.validation.issues));
const clean=ingestion.commit(prepared.project,prepared.proposal.proposalId);assert.equal(clean.acceptedChange.status,'COMMITTED');
const cases=[];
for(const [name,mutate] of [
 ['agent-field',p=>{p.canonicalRecords.requirements[0].fields.OBLIGATION='Changed after response validation';p.canonicalRecords.requirements[0].OBLIGATION='Changed after response validation';}],
 ['application-owned-stage-field',p=>{p.proposedStageData.JOB_RECORD_STATUS='COMPLETE';}],
 ['relationship',p=>{p.canonicalRecords.propositions[0].relationships.REQUIREMENT_ID='UNRELATED-REQUIREMENT';}],
 ['provenance',p=>{p.changes[0].jsonPointer='/not-the-validated-source';}],
 ['evidence-content',p=>{p.evidence[0].fields.CONTENT='Unvalidated evidence';p.evidence[0].CONTENT='Unvalidated evidence';}],
 ['allocation-identity',p=>{p.tempToCanonical.req.id='REQ-NOT-ALLOCATED-FOR-RESPONSE';p.canonicalRecords.requirements[0].id=p.tempToCanonical.req.id;}],
 ['otherwise-valid-envelope',p=>{p.envelope.records.requirements[0].fields.OBSERVABLE_SATISFACTION_CONDITION='Changed response not present in preserved bytes';}]
]){
 const altered=engine.clone(prepared.project),proposal=altered.projectData.responseProposals.find(p=>p.proposalId===prepared.proposal.proposalId);mutate(proposal);const before=JSON.stringify(altered);
 assert.throws(()=>ingestion.commit(altered,proposal.proposalId),error=>error.code==='PROPOSAL_PLAN_MISMATCH'||error.code==='PROPOSAL_RESPONSE_MISMATCH',`PROPOSAL_PLAN_ORACLE: ${name} changed accepted work without matching the validated response`);
 assert.equal(JSON.stringify(altered),before,'Rejected candidate mutated project state');
 assert.equal(ingestion.commit(prepared.project,prepared.proposal.proposalId).acceptedChange.status,'COMMITTED','Removing the violation did not restore acceptance');cases.push({name,rejected:true,repairedAccepted:true});
}
if(process.env.CLOSED_LOOP_PROPOSAL_PLAN_FAULT!=='1'){
 const fault=cp.spawnSync(process.execPath,[import.meta.filename],{encoding:'utf8',env:{...process.env,CLOSED_LOOP_PROPOSAL_PLAN_FAULT:'1'},maxBuffer:8*1024*1024});assert.notEqual(fault.status,0,'Bypassed precommit comparison escaped detection');assert.match(fault.stderr,/PROPOSAL_PLAN_ORACLE/,'Fault failed for an unrelated reason');cases.push({name:'bypassed-precommit-implementation',detected:true});
}
console.log(JSON.stringify({proposalPlanIntegrity:'PASS',synthetic:true,environment:'Production workflow and ingestion with synthetic Stage 01–04 prerequisites; no browser or external-actor claim',cases},null,2));
