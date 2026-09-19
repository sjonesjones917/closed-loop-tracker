import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const app=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8'),r=projectStoreRuntime(),{runtime,store,engine,copy}=r;
let source=await store.createProject({commandId:'SOURCE-FOR-COPY-REPRODUCTION'});
if(process.argv.includes('--explicit-optional-null')){
 source.job.DESIRED_SOURCE_COUNT=null;
 source=await store.writeProject(source,{expectedProjectRevision:source.revision});
}
Object.assign(runtime,{current:source,projects:[source],core:r.core,engine,projectStore:store,clone:copy,projectUi:{},projectDisplayName:p=>p.job.JOB_TITLE||'Source',withStorageActivity:async(_,fn)=>fn(),saveProjectUi:async()=>{},refreshProjectStorage:async()=>{},announce(){},render(){}});
vm.runInContext(app.split('\n').find(line=>line.startsWith('const views=')),runtime,{filename:'app-core.js:views'});
for(const name of ['blankStage','ensureState','createUniqueJobId']){
 const line=app.split('\n').find(line=>line.startsWith('function '+name+'('));assert.ok(line);vm.runInContext(line,runtime,{filename:'app-core.js:'+name});
}
vm.runInContext(app.split('\n').find(line=>line.startsWith('const jobFields=')),runtime,{filename:'app-core.js:jobFields'});
vm.runInContext(app.slice(app.indexOf('async function persistNewProject('),app.indexOf('async function persistReplacement(')),runtime,{filename:'app-core.js:persistNewProject'});
vm.runInContext(app.slice(app.indexOf('async function duplicateCurrentProject('),app.indexOf('function selectStageContinuation('))+'\nglobalThis.copyProject=duplicateCurrentProject;',runtime,{filename:'app-core.js:duplicateCurrentProject'});
await runtime.copyProject({commandId:'COPY-OPERATOR-COMMAND'});
const copied=await store.readProject(runtime.current.job.JOB_ID);
console.log(JSON.stringify({sourceRevision:revision,operation:'Actual Start from copy handler and durable creation owner',expected:'A copied project uses the canonical JOB allocator and a durable source-bound clone command receipt; retry returns the same clone.',sourceJobId:source.job.JOB_ID,copyJobId:copied.job.JOB_ID,projectAllocationReceipts:copied.projectData.allocationReceipts.filter(row=>row.collection==='projects')},null,2));
assert.match(copied.job.JOB_ID,/^JOB-[0-9a-v]{32}$/,'CANONICAL_COPY_IDENTITY_ORACLE: copying must share the authoritative project allocator.');
assert.equal(copied.projectData.allocationReceipts.filter(row=>row.collection==='projects').length,1,'CANONICAL_COPY_RECEIPT_ORACLE: creation must commit its authoritative allocation receipt.');
