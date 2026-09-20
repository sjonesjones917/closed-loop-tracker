import fs from 'node:fs';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import assert from 'node:assert/strict';

// Execute actual rendering owners with the shared verifier runtime. This only
// checks markup boundaries; browser visibility and layout remain separate gates.
export function appMarkup(runtime,project,{view='Workflow',operations={},source=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8'),instructionEvidence=false}={}){
 const end=source.indexOf("$('#project-picker').onchange");
 assert.ok(end>0,'Actual application bootstrap boundary is required.');
 runtime.__markupProject=project;
 runtime.__markupOperations=operations;
 runtime.document={currentScript:null,querySelector:()=>null,querySelectorAll:()=>[]};
 runtime.window=runtime;
 runtime.addEventListener=()=>{};
 const render=view==='Files'?'files()':view==='Overview'?'overview()':'workflow()';
 const result=instructionEvidence?`const html=${render};return {html,instruction:currentPromptRecord(current.activeStage)?.prompt||currentStagePrompt(current.activeStage)};`:`return ${render};`;
 const body=source.slice(0,end)+`core=globalThis.closedLoopCore;schema=globalThis.closedLoopWorkflowSchema;engine=globalThis.closedLoopWorkflowEngine;ingestion=globalThis.closedLoopResponseIngestion;projectStore=globalThis.closedLoopProjectStore;current=__markupProject;projects=[current];Object.assign(operationSelection,__markupOperations);${result}})();`;
 return createVerifierRuntime.loadScript(runtime,body,{filename:'app-core.js:actual-rendering'});
}

const unescapeHtml=text=>text.replace(/&(amp|lt|gt|quot|#39);/g,(_match,key)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"})[key]);
export function observeWorkflowMarkup(html){
 return {previewTexts:[...html.matchAll(/<pre\b[^>]*\bid="generated-prompt"[^>]*>([\s\S]*?)<\/pre>/g)].map(match=>unescapeHtml(match[1])),viewText:unescapeHtml(html.replace(/<[^>]*>/g,'')),handoffControlCount:[...html.matchAll(/<button\b[^>]*\bid="(?:next-export-prompt-file|download-execution-package)"/g)].length,separateControlCount:[...html.matchAll(/<button\b[^>]*(?:\bdata-download-artifact=|\bid="(?:export-prompt-file|export-prompt-manifest|export-prompt-context|export-stage-files)")/g)].length};
}

// Serialize this observer into the real browser. It reads the DOM only; the
// same oracle below evaluates actual markup and actual browser observations.
export function observeWorkflowDOM(){
 const view=document.querySelector('#screen');
 return {previewTexts:[...view.querySelectorAll('#generated-prompt')].map(node=>node.textContent),viewText:view.textContent,handoffControlCount:view.querySelectorAll('#next-export-prompt-file,#download-execution-package').length,separateControlCount:view.querySelectorAll('[data-download-artifact],#export-prompt-file,#export-prompt-manifest,#export-prompt-context,#export-stage-files').length};
}

export function assertWorkflowPresentation(observation,{instruction,caseId='workflow'}={}){
 const {previewTexts,viewText,handoffControlCount,separateControlCount}=observation;
 assert.equal(previewTexts.length,1,'INSTRUCTION_ONCE_ORACLE: '+caseId+' must display one instruction preview.');
 const preview=previewTexts[0];assert.ok(preview.length>0,'INSTRUCTION_ONCE_ORACLE: '+caseId+' has an empty preview.');
 if(instruction!==undefined)assert.ok(String(instruction).startsWith(preview),'INSTRUCTION_ONCE_ORACLE: '+caseId+' repeats or changes its authoritative instruction.');
 const occurrences=viewText.split(preview).length-1;
 assert.equal(occurrences,1,'INSTRUCTION_ONCE_ORACLE: '+caseId+' repeats the instruction elsewhere in the view.');
 assert.ok(handoffControlCount<=1,'STAGE_HANDOFF_SINGLE_CONTROL_ORACLE: '+caseId+' repeats the stage handoff control.');
 assert.equal(separateControlCount,0,'STAGE_HANDOFF_NO_SEPARATE_ARTIFACT_CONTROLS: '+caseId+' retains a superseded per-artifact handoff control.');
 return {caseId,result:'PASS',previewCharacters:preview.length,instructionOccurrences:occurrences,handoffControlCount,separateControlCount,authoritativeInstructionCompared:instruction!==undefined};
}
