import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {stage04AcceptanceFixture} from './test-fixtures.mjs';

// A context-boundary fixture, not a claim of a complete operator journey.
globalThis.dispatchEvent=()=>{};
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js']){
  const source=process.env.BASELINE_COMMIT?execFileSync('git',['show',process.env.BASELINE_COMMIT+':'+file],{encoding:'utf8',maxBuffer:10*1024*1024}):fs.readFileSync(file,'utf8');
  vm.runInThisContext(source,{filename:file});
}
const core=closedLoopCore,schema=closedLoopWorkflowSchema,engine=closedLoopWorkflowEngine,prompts=closedLoopPromptEngine,ingestion=closedLoopResponseIngestion;
const project=stage04AcceptanceFixture({core,schema,engine,prompts,ingestion},'JOB-CONTEXT-BOUNDARY');
const failures=[];let pairs=0,operations=0;
for(const definition of core.STAGES){
  const stage=definition.number;
  for(const previous of core.STAGES.filter(item=>item.number<stage)){project.stages[previous.number].status='COMPLETE';project.stages[previous.number].gate={complete:true};}
  const later=core.STAGES.filter(item=>item.number>stage),candidate=structuredClone(project);
  for(const target of later){const marker=`PRIVATE_FUTURE_INFORMATION_${stage}_${target.number}`;candidate.projectData.evidenceRecords.push({id:`EVIDENCE-FUTURE-${target.number}`,stage:target.number,active:true,source:'HUMAN_OBSERVATION',fields:{EVIDENCE_ID:`EVIDENCE-FUTURE-${target.number}`,APPLICATION_EVIDENCE_CONTENT:marker},scope:engine.currentScope(candidate)});pairs++;}
  for(const operation of schema.STAGE_CONTRACTS[stage].operations){
    const registration=schema.STAGE_OPERATION_REGISTRY[`${stage}:${operation}`],scope=Object.fromEntries((schema.operationContract(stage,operation)?.scopeRequirements||[]).map(key=>[key,key.toUpperCase()+'-BOUNDARY']));
    if(registration.executorClass!=='EXTERNAL_AGENT')continue;
    const prompt=prompts.buildPromptRecord(stage,candidate,{operation,scope}),serialized=JSON.stringify(prompt);
    for(const target of later)if(serialized.includes(`PRIVATE_FUTURE_INFORMATION_${stage}_${target.number}`))failures.push({stage,operation,leakedStage:target.number});
    operations++;
  }
}
console.log(JSON.stringify({case:'all-stage-future-context-boundary',sourceRevision:process.env.BASELINE_COMMIT||'working tree',fixture:'synthetic context selection; prerequisite UI progression is verified separately',stagePairs:pairs,externalOperations:operations,failures},null,2));
if(failures.length)throw new Error(`Subsequent-stage information escaped in ${failures.length} stage/operation boundaries.`);
