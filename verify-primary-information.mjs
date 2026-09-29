import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const app=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8'),r=projectStoreRuntime();
const project=await r.store.createProject({commandId:'PRIMARY-OPERATOR-INFORMATION'});project.job.JOB_TITLE='Current project';
const nodes=Object.fromEntries(['current-project-summary','progress-label','progress-bar','project-picker','view-tabs'].map(id=>['#'+id,{textContent:'',innerHTML:'',style:{},dataset:{}}]));
Object.assign(r.runtime,{current:project,projects:[project],completion:()=>r.core.STAGES.filter(stage=>project.stages[stage.number].status==='COMPLETE').length,projectIsArchived:()=>false,projectDisplayName:p=>p.job.JOB_TITLE,esc:value=>String(value??''),$:id=>nodes[id]});
for(const prefix of ['const views=','function header('])vm.runInContext(app.split('\n').find(line=>line.startsWith(prefix)),r.runtime,{filename:'app-core.js:'+prefix});
vm.runInContext('header()',r.runtime);
const actual=nodes['#current-project-summary'].textContent;
console.log(JSON.stringify({sourceRevision:revision,requirement:'UX-011',expected:'The primary operator header identifies the project by its display name. Its internal JOB_ID remains accessible through advanced project details.',actualPrimaryHeader:actual,internalId:project.job.JOB_ID,browserEvidence:{runId:35452763649,artifactId:10587526007,path:'393x852/stage-01.png'}},null,2));
assert.equal(actual.includes(project.job.JOB_ID),false,'PRIMARY_INFORMATION_ORACLE: internal identifiers must stay behind details or advanced controls.');
assert.ok(actual.includes(project.job.JOB_TITLE),'The useful current project name must remain visible.');
