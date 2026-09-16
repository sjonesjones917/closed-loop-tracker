import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

const {core,engine,prompts,store,copy}=projectStoreRuntime(),cases=[];
const note=name=>cases.push({name,result:'PASS'});
let project=core.createBlankState('EXECUTION-IDENTITY-REGRESSION');
engine.ensureShape(project);engine.recalculate(project);
project=await store.writeProject(project,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
const before=JSON.stringify(project),preview=prompts.buildPromptRecord(1,project);
assert.match(preview.instructionId,/^INSTRUCTION-[0-9a-v]{32}$/,'INSTRUCTION_ALLOCATION_ORACLE: generated instruction must use closed-loop-id/1');
assert.equal(JSON.stringify(project),before,'A preview must not reserve or mutate anything');
note('Instruction preview uses the canonical identity algorithm without mutating the project');
const candidate=copy(project),reserved=prompts.reserveAndBuildPromptRecord(candidate,1,{}, {owningTabInstance:'SYNTHETIC-IDENTITY-TEST'});
assert.match(reserved.prompt.packageId,/^PACKAGE-[0-9a-v]{32}$/,'PACKAGE_ALLOCATION_ORACLE: execution package must use closed-loop-id/1');
for(const id of [reserved.prompt.instructionId,reserved.prompt.packageId]){
 const receipt=candidate.projectData.allocationReceipts.find(row=>row.resultingId===id);
 assert.ok(receipt,'ALLOCATION_RECEIPT_ORACLE: authoritative prompt/package needs its retained allocation receipt');
 assert.equal(receipt.inputTuple.jobNamespace,project.job.JOB_ID);
 assert.equal(receipt.commandId,receipt.inputTuple.commandId);
}
project=await store.writeProject(candidate,{expectedProjectRevision:project.revision});
const checkpoint=(await store.historyList(project.job.JOB_ID)).activeId,receipts=copy(project.projectData.allocationReceipts);
note('Instruction, package, and reservation are committed with their allocation receipts');
const retry=copy(project),retried=engine.registerGeneratedPrompt(retry,reserved.prompt);
assert.equal(retried.instructionId,reserved.prompt.instructionId);
assert.deepEqual(retry.projectData.allocationReceipts,receipts);
note('Exact prompt registration retry neither reallocates identities nor appends receipts');
const changed=copy(project);changed.job.JOB_TITLE='Different continuation';project=await store.writeProject(changed,{expectedProjectRevision:project.revision});
project=(await store.restoreCheckpoint(project.job.JOB_ID,checkpoint,{expectedProjectRevision:project.revision})).project;
assert.deepEqual(project.projectData.allocationReceipts,receipts);
assert.equal(project.projectData.generatedPrompts.at(-1).instructionId,reserved.prompt.instructionId);
assert.equal(project.projectData.generatedPrompts.at(-1).packageId,reserved.prompt.packageId);
note('Restoration recovers the exact saved identities and receipts without reallocating');
console.log(JSON.stringify({synthetic:true,actualBrowser:false,environment:'Node production runtime with transactional test adapter',cases},null,2));
