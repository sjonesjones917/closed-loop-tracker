import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
const {runtime,core,engine,store,copy}=projectStoreRuntime(),schema=runtime.closedLoopWorkflowSchema;
const source=fs.readFileSync('app-core.js','utf8');
const extract=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert(start>=0&&end>start);return source.slice(start,end);};
Object.assign(runtime,{core,engine,projectStore:store,schema,clone:copy,safe:engine.safe,views:['Overview','Project','Workflow','Records','Files','Release']});
vm.runInContext(extract('const stageRecordText=','const label=')+extract('function blankStage(','function validateImport('),runtime);
const seed=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8')),cases=[];
function imported(raw=seed){runtime.seed=copy(raw);return vm.runInContext('importSeed(seed)',runtime);}
function nongating(p,label){
 assert.equal(p.projectData.contractProfileMigration.status,'LEGACY_NON_GATING',label);
 assert.equal(p.projectData.contractProfileMigration.semanticProofMigrated,false,label);
 assert.equal(schema.validateContractProfile(p).valid,false,label);
 assert.notEqual(p.stages[1].status,'COMPLETE',label);assert.equal(engine.gate(2,p).complete,false,label);
 assert.equal(engine.acceptedChanges(p,1).length,0,label);
 assert.equal(p.projectData.responseProposals.filter(x=>x.stage===1&&x.status==='ACCEPTED').length,0,label);
 assert.equal(p.projectData.stageConfirmations.filter(x=>x.stage===1&&x.confirmed&&!x.invalidatedBy).length,0,label);
 cases.push(label);
}
const p=imported();nongating(p,'legacy COMPLETE and retained output do not create current authority');
assert.equal(p.job.EXACT_USER_OBJECTIVE_VERBATIM,seed.userJobInput.objective);
assert.deepEqual(JSON.parse(JSON.stringify(p.projectData.migrationArchives.find(x=>x.kind==='ORIGINAL_IMPORT_PAYLOAD').payload)),seed);
assert.equal(p.projectData.migrationArchives.find(x=>x.kind==='LEGACY_STAGE_RECORD'&&x.stage===1).payload.status,'COMPLETE');
assert.equal(p.projectData.generatedOutputs.find(x=>x.outputId==='OPERATION-01-OUTPUT').output,seed.generatedOutputs.find(x=>x.outputId==='OPERATION-01-OUTPUT').output);
for(const name of schema.AGENT_JOB_FIELDS){assert(!Object.hasOwn(p.job,name));assert(!Object.hasOwn(p.stages[1].agentData,name));}
cases.push('historical bytes and human inputs preserved without agent-owned projection');
const noOutput=copy(seed);noOutput.generatedOutputs=[];nongating(imported(noOutput),'COMPLETE status alone cannot gate');
const noComplete=copy(seed);noComplete.stageRecords[1].status='NOT STARTED';nongating(imported(noComplete),'retained output alone cannot gate');
const claimed=copy(p);claimed.stages[1].status='COMPLETE';claimed.stages[1].agentData=copy({EXACT_DELIVERABLE_REQUESTED:seed.userJobInput.deliverable,ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify({schema:'closed-loop-stage01-capture/2',inputVersion:claimed.job.CURRENT_INPUT_VERSION,units:[]})});engine.recalculate(claimed);nongating(claimed,'synthesized capture and status cannot replace current acceptance');
const recalculated=copy(p);engine.recalculate(recalculated);nongating(recalculated,'recalculation preserves historical non-gating state');
const saved=await store.writeProject(p,{expectedProjectRevision:0,incrementRevision:false,createOnly:true}),loaded=await store.readProject(saved.job.JOB_ID);nongating(loaded,'storage reload preserves historical non-gating state');
assert.deepEqual(loaded.projectData.migrationArchives,p.projectData.migrationArchives);
console.log(JSON.stringify({retainedLegacyBoundary:'PASS',cases,sourceRule:'specification §13 lines1002–1010; historical evidence is not current authority'},null,2));
