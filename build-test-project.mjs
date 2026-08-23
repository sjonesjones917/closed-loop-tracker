import fs from 'node:fs';

const path='TEST_PROJECT.json';
if(!fs.existsSync(path)) throw new Error('Missing TEST_PROJECT.json');
const project=JSON.parse(fs.readFileSync(path,'utf8'));

if(project.schema!=='human-project/30') throw new Error(`Unexpected project schema ${project.schema}`);
if(project.jobId!=='JOB-20260823144121') throw new Error('Retained test project JOB_ID is wrong.');
if(project.title!=='Mobile Closed-Loop Agent Reliability Workbook') throw new Error('Retained test project title is wrong.');
if(project.currentStage!==2||project.currentState!=='READY') throw new Error('Retained test project must preserve completed Operation 01 and be ready for Operation 02.');
if(Object.keys(project.stageRecords||{}).length!==30) throw new Error('Retained test project must contain exactly 30 stage records.');
if(project.stageRecords?.['1']?.status!=='COMPLETE') throw new Error('Operation 01 must be preserved as complete.');
for(let n=2;n<=30;n++) if(project.stageRecords?.[String(n)]?.status!=='NOT STARTED') throw new Error(`Stage ${n} must remain not started in the retained Operation 01 project.`);
if((project.generatedPrompts||[]).length!==1||(project.generatedOutputs||[]).length!==1||(project.outputReceipts||[]).length!==1) throw new Error('Retained project must preserve the one instruction, one completed output, and one receipt that actually exist after Operation 01.');
const operation01=project.stageRecords['1'].output;
if(typeof operation01!=='string'||!operation01.includes('OPERATION 01 — DEFINE JOB')) throw new Error('Authorized Operation 01 output is missing.');
if(!operation01.includes('Proceed to Operation 02 — Build the Source Inventory.')) throw new Error('Operation 01 next action is missing.');
project.generatedOutputs[0].output=operation01;
if((project.runRecords||[]).length!==0||(project.verificationRecords||[]).length!==0) throw new Error('Later execution evidence must not be fabricated before those stages run.');
if((project.requirements||[]).length!==0||(project.tests||[]).length!==0) throw new Error('Requirements and tests must not be fabricated before their workflow stages run.');
if(/GEN-042|field status report|maintenance[- ]handoff/i.test(JSON.stringify(project))) throw new Error('Unrelated generator test-project content remains.');
fs.writeFileSync(path,JSON.stringify(project,null,2)+'\n');
console.log(`preserved authorized retained project: ${project.jobId} · ${project.title}`);
