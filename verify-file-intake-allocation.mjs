import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';


const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const app=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8');
const r=projectStoreRuntime(),{runtime,store,engine,copy}=r;
const source=await store.createProject({commandId:'AUTHORIZE-IDENTITY-REPRODUCTION'});
source.job.JOB_TITLE='Source project';
Object.assign(runtime,{current:source,engine:r.engine,core:r.core,projectStore:store,clone:copy,announce(){},render(){},recordMobileOperation:async()=>{},reportActionFailure(error){throw typeof error==='string'?new Error(error):error;},persistReplacement:async next=>{runtime.current=await store.writeProject(next,{expectedProjectRevision:runtime.current.revision});}});
vm.runInContext(app.slice(app.indexOf('const artifactIdFor='),app.indexOf('async function digestFile('))+'\nglobalThis.register=registerStageFiles;',runtime,{filename:'app-core.js:file-intake-authority'});
const file=new File(['Published external source bytes'],'source.txt',{type:'text/plain'});
await runtime.register([file]);
const accepted=await store.readProject(source.job.JOB_ID);
const artifacts=engine.records(accepted,'artifacts');
assert.equal(artifacts.length,1,'Fixture must reach actual file intake and its durable canonical record.');
const id=engine.recordId(artifacts[0],'artifacts'),prefix=runtime.closedLoopWorkflowSchema.RECORD_SCHEMAS.artifacts.prefix;
console.log(JSON.stringify({sourceRevision:revision,operation:'Actual registerStageFiles handler, durable byte storage and canonical metadata commit',expected:'Every canonical artifact identity is allocated under closed-loop-id/1 and has a matching authoritative receipt in the same committed version.',actualArtifactId:id,requiredPattern:`^${prefix}-[0-9a-v]{32}$`,allocationReceipts:accepted.projectData.allocationReceipts.filter(row=>row.resultingId===id)},null,2));
assert.match(id,new RegExp(`^${prefix}-[0-9a-v]{32}$`),'CANONICAL_INTAKE_IDENTITY_ORACLE: file intake must use the registered canonical artifact allocator.');
assert.equal(accepted.projectData.allocationReceipts.filter(row=>row.resultingId===id).length,1,'CANONICAL_INTAKE_RECEIPT_ORACLE: committed artifact identity has one authoritative allocation receipt.');
