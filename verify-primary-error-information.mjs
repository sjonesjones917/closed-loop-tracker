import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const r=projectStoreRuntime(),a=await r.store.createProject({commandId:'PRIMARY-ERROR-A'}),b=await r.store.createProject({commandId:'PRIMARY-ERROR-B'});
const artifactId=r.engine.allocateId(a,'artifacts',r.copy({commandId:'PRIMARY-ERROR-FILE',payload:{filename:'input.txt'}}));
await r.store.putArtifact({artifactId,jobId:a.job.JOB_ID,blob:new Blob(['Input bytes']),filename:'input.txt',mediaType:'text/plain'});
let error;
try{await r.store.putArtifact({artifactId,jobId:b.job.JOB_ID,blob:new Blob(['Input bytes']),filename:'input.txt',mediaType:'text/plain'});}catch(caught){error=caught;}
assert.equal(error?.code,'CROSS_PROJECT_ARTIFACT_ID_COLLISION','The underlying ownership rejection remains required.');
const report={diagnosticMarkup:'',insertAdjacentHTML(_position,html){this.diagnosticMarkup+=html;},textContent:'',className:'',hidden:true,classList:{add(){}},setAttribute(){},scrollIntoView(){},focus(){}},announcements=[];
Object.assign(r.runtime,{$:selector=>selector==='#operation-error'?report:null,announce:message=>announcements.push(message),operatorActionInFlight:null,error,actionFocusTarget:null});
const app=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8'),start=app.indexOf('let actionFailureNotice='),end=app.indexOf('const storageActivities=',start);
vm.runInContext(app.slice(start,end),r.runtime,{filename:'app-core.js:reportActionFailure'});
vm.runInContext('reportActionFailure(error)',r.runtime);
console.log(JSON.stringify({sourceRevision:revision,requirement:'UX-011',environment:'Node shared verifier runtime; actual artifact store and error presentation owner',expected:'The actionable error remains visible while its internal artifact identity and diagnostic explanation are available behind details.',actualPrimaryError:report.textContent,actualAnnouncement:announcements,internalArtifactId:artifactId,rejectedOwnershipCode:error.code},null,2));
assert.equal(report.hidden,false,'The actionable error must remain visible.');
assert.equal(report.textContent.includes(artifactId),false,'PRIMARY_ERROR_INFORMATION_ORACLE: internal identities must stay behind details in failure and recovery feedback.');

assert.ok(report.diagnosticMarkup.includes('<details')&&!report.diagnosticMarkup.includes('<details open'), 'Error diagnostics must be in a closed disclosure.');
assert.ok(report.diagnosticMarkup.includes(artifactId), 'Exact diagnostic identity must remain accessible.');
assert.ok(announcements.every(message=>!message.includes(artifactId)), 'Live announcements must use the same public message.');
