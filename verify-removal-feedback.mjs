import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
const source=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8');
const {runtime,core}=projectStoreRuntime();
Object.assign(runtime,{URL,URLSearchParams,document:{currentScript:null,querySelector:()=>({}),querySelectorAll:()=>[]}});
vm.runInContext(source.slice(0,source.indexOf('globalThis.closedLoopAppReady=false;'))+`core=closedLoopCore;schema=closedLoopWorkflowSchema;engine=closedLoopWorkflowEngine;globalThis.renderRemoval=project=>{current=project;projects=[project];detailViews.clear();return projectManagementMarkup();};})();`,runtime,{filename:'app-core.js'});
const project=core.createBlankState('REMOVAL-FEEDBACK-DISPOSABLE');
const markup=runtime.renderRemoval(project);
const button=markup.match(/<button\b[^>]*id="delete-project"[^>]*>([\s\S]*?)<\/button>/)?.[1]||'';
const report={schema:'closed-loop-removal-feedback/1',productionSourceSha256:createHash('sha256').update(source).digest('hex'),basis:'Executed authored production renderer in Node VM; not a browser or physical-device result',expected:'A removal action must not claim permanent erasure when its saved versions and files remain restorable.',actual:{button,historyExplanation:markup.includes('Its saved versions and files remain available to restore in History.')},cases:[],complete:false};
try{
 assert.ok(button,'Missing removal control');
 assert.doesNotMatch(button,/permanent|irreversible|erase/i,'REMOVAL_RECOVERY_TRUTH_ORACLE: the action falsely describes retained data as permanently erased');
 assert.match(button,/remove/i,'The action must identify removal rather than unexplained destruction');
 assert.ok(report.actual.historyExplanation,'The operator cannot tell where recovery remains available');
 report.cases.push({caseId:'RECOVERABLE-REMOVAL-LABEL',status:'PASS'});report.complete=true;
}catch(error){report.failure=String(error.stack||error);process.exitCode=1;}
finally{console.log(JSON.stringify(report,null,2));}
