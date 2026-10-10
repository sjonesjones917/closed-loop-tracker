import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';


const revision=execFileSync('git',['rev-parse','HEAD'],{timeout:30000,killSignal:'SIGKILL',encoding:'utf8'}).trim();
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

// The free-text inventory is optional. Actual retained input custody, rather
// than that text or an arbitrary view entry, must drive the one-time file hint.
const markupStart=app.indexOf('function artifactControlMarkup('),markupEnd=app.indexOf('function runBatchMarkup(',markupStart);
assert.ok(markupStart>=0&&markupEnd>markupStart,'Actual file-panel presentation owner is required.');
Object.assign(runtime,{safe:engine.safe,details:()=>'',displayedStageAction:()=>({expectedReturnFiles:[]}),currentStageProduct:()=>null});
vm.runInContext(app.slice(markupStart,markupEnd),runtime,{filename:'app-core.js:artifactControlMarkup'});
const guidance=project=>{runtime.current=project;return runtime.artifactControlMarkup(1,false);};
assert.equal(String(accepted.job.SUPPLIED_MATERIALS_INVENTORY||'').trim(),'');
assert.equal(engine.currentAuthorizedInputArtifacts(accepted).length,1);
assert.equal(engine.timingArtifactAvailability(accepted,id),'TRUE');
const retainedGuidance=guidance(accepted);
assert.doesNotMatch(retainedGuidance,/none is currently recorded as supplied project material/,'RETAINED_INTAKE_GUIDANCE_ORACLE: stored input must not be described as absent.');
assert.match(retainedGuidance,/1 supplied Stage 01 file is retained with verified bytes/,'RETAINED_INTAKE_GUIDANCE_ORACLE: actual registered bytes must be acknowledged without a manual inventory entry.');
assert.match(retainedGuidance,/Do not attach it again/,'RETAINED_INTAKE_ONCE_ORACLE');
const empty=r.core.createBlankState('JOB-EMPTY-INTAKE-GUIDANCE');engine.ensureShape(empty);
assert.match(guidance(empty),/No separate intent file is required/,'EMPTY_INTAKE_GUIDANCE_ORACLE');
assert.doesNotMatch(guidance(empty),/retained with verified bytes/,'EMPTY_INTAKE_GUIDANCE_ORACLE');
const metadataOnly=copy(empty);metadataOnly.stages[1].authorizedFiles=copy(accepted.stages[1].authorizedFiles);
assert.doesNotMatch(guidance(metadataOnly),/retained with verified bytes/,'METADATA_ONLY_INTAKE_GUIDANCE_ORACLE');
const declaredOnly=copy(empty);declaredOnly.job.SUPPLIED_MATERIALS_INVENTORY='declared-but-unselected.txt';
assert.match(guidance(declaredOnly),/attach each supplied Stage 01 input only once/,'DECLARED_INTAKE_GUIDANCE_ORACLE');
assert.doesNotMatch(guidance(declaredOnly),/retained with verified bytes/,'DECLARED_ONLY_INTAKE_GUIDANCE_ORACLE');
await store.deleteArtifact(id,accepted.job.JOB_ID);
assert.notEqual(engine.timingArtifactAvailability(accepted,id),'TRUE');
assert.doesNotMatch(guidance(accepted),/retained with verified bytes/,'MISSING_BYTE_INTAKE_GUIDANCE_ORACLE');
console.log(JSON.stringify({oneTimeFileGuidance:'PASS',actualRegisteredInput:true,optionalInventoryEmpty:true,emptyAndDeclaredAndMetadataOnlyControls:true,missingBytesNeverClaimedRetained:true}));
