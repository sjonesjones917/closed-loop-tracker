import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
globalThis.dispatchEvent=()=>{};
for(const name of ['workbook','hash','workflow-schema','test-runtime','workflow-engine','prompt-engine','response-ingestion'])vm.runInThisContext(fs.readFileSync(name+'.js','utf8'),{filename:name+'.js'});
const core=closedLoopCore,schema=closedLoopWorkflowSchema,engine=closedLoopWorkflowEngine;
let cases=0;
for(const origin of core.STAGES){
 // Independently traverse the registered prerequisite graph. These disposable
 // state-class fixtures test invalidation, not operator prerequisite progression.
 const affected=new Set();let changed=true;while(changed){changed=false;for(const stage of core.STAGES)if(!affected.has(stage.number)&&(schema.STAGE_PREREQUISITES[stage.number]||[]).some(prerequisite=>prerequisite===origin.number||affected.has(prerequisite))){affected.add(stage.number);changed=true;}}
 for(const kind of ['COMPLETED','PARTIAL','PENDING']){
  const p=core.createBlankState('DISPOSABLE-DEPENDENCIES-'+origin.number+'-'+kind);engine.ensureShape(p);
  for(const stage of core.STAGES){const s=p.stages[stage.number];s.responseDraft='Retained draft '+stage.number;if(kind==='COMPLETED'){s.status='COMPLETE';s.acceptedData={preserved:'Accepted content '+stage.number};s.acceptedResponseIds=['PRIOR-'+stage.number];}if(kind==='PENDING')p.projectData.generatedPrompts.push({instructionId:'PENDING-'+stage.number,stage:stage.number,operation:schema.STAGE_OPERATIONS[stage.number][0],scope:{},prompt:'Pending instruction '+stage.number});}
  const before=structuredClone(p);engine.invalidateDownstream(p,origin.number,'DEPENDENCY-CORRECTION','Controlled invalidation test');
  for(const stage of core.STAGES){const s=p.stages[stage.number];if(affected.has(stage.number)){assert.equal(s.invalidatedBy,'DEPENDENCY-CORRECTION','Incomplete dependent invalidation at '+stage.number);assert.equal(s.responseDraft,'','An affected draft survived invalidation.');assert.deepEqual(s.acceptedResponseIds,[]);assert(!p.projectData.generatedPrompts.some(record=>record.stage===stage.number&&!record.invalidatedBy),'An affected pending instruction survived.');}else{assert.equal(s.responseDraft,before.stages[stage.number].responseDraft,'Independent work was lost.');assert.deepEqual(s.acceptedData,before.stages[stage.number].acceptedData);}}
  cases++;
 }
}
console.log(JSON.stringify({dependencyInvalidation:'PASS',stages:core.STAGES.length,stateClasses:3,cases,expectation:'Transitive closure of the declared prerequisite graph',evidence:'Synthetic production-mechanism cases; not an operator journey'}));
