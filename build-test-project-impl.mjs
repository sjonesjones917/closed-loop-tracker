import fs from 'node:fs';
import './verify-normative-governance-contract.mjs';

const project=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
if(project.jobId!=='JOB-20260823144121'||project.title!=='Mobile Closed-Loop Agent Reliability Workbook')throw new Error('Committed retained project is not the authorized project.');
if(project.currentStage!==2||project.currentState!=='READY'||project.stageRecords?.['1']?.status!=='COMPLETE')throw new Error('Committed retained project state is wrong.');
for(let n=2;n<=30;n++)if(project.stageRecords?.[String(n)]?.status!=='NOT STARTED')throw new Error(`Stage ${n} must remain NOT STARTED.`);

console.log('Committed retained project requires no source materialization.');
