import fs from 'node:fs';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import assert from 'node:assert/strict';

// Execute actual rendering owners with the shared verifier runtime. This only
// checks markup boundaries; browser visibility and layout remain separate gates.
export function appMarkup(runtime,project,{view='Workflow',operations={},source=fs.readFileSync('app-core.js','utf8')}={}){
 const end=source.indexOf("$('#project-picker').onchange");
 assert.ok(end>0,'Actual application bootstrap boundary is required.');
 runtime.__markupProject=project;
 runtime.__markupOperations=operations;
 runtime.document={currentScript:null,querySelector:()=>null,querySelectorAll:()=>[]};
 runtime.window=runtime;
 runtime.addEventListener=()=>{};
 const body=source.slice(0,end)+`core=globalThis.closedLoopCore;schema=globalThis.closedLoopWorkflowSchema;engine=globalThis.closedLoopWorkflowEngine;ingestion=globalThis.closedLoopResponseIngestion;projectStore=globalThis.closedLoopProjectStore;current=__markupProject;projects=[current];Object.assign(operationSelection,__markupOperations);return ${view==='Files'?'files()':view==='Overview'?'overview()':'workflow()'};})();`;
 return createVerifierRuntime.loadScript(runtime,body,{filename:'app-core.js:actual-rendering'});
}
