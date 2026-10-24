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
 const result=instructionEvidence?`const html=${render};return {html,instruction:currentPromptRecord(current.activeStage)?.prompt||currentStagePrompt(current.activeStage),selectedOperation:selectedOperation(current.activeStage),displayedOperation:displayedStageAction(current.activeStage).operation};`:`return ${render};`;
 const body=source.slice(0,end)+`core=globalThis.closedLoopCore;schema=globalThis.closedLoopWorkflowSchema;engine=globalThis.closedLoopWorkflowEngine;ingestion=globalThis.closedLoopResponseIngestion;projectStore=globalThis.closedLoopProjectStore;current=__markupProject;projects=[current];Object.assign(operationSelection,__markupOperations);${result}})();`;
 return createVerifierRuntime.loadScript(runtime,body,{filename:'app-core.js:actual-rendering'});
}

const unescapeHtml=text=>text.replace(/&(amp|lt|gt|quot|#39);/g,(_match,key)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"})[key]);
export function observeWorkflowMarkup(html){
 return {stagePurposeTexts:observeStagePurposeMarkup(html),previewTexts:[...html.matchAll(/<pre\b[^>]*\bid="generated-prompt"[^>]*>([\s\S]*?)<\/pre>/g)].map(match=>unescapeHtml(match[1])),viewText:unescapeHtml(html.replace(/<[^>]*>/g,'')),handoffControlCount:[...html.matchAll(/<button\b[^>]*\bid="(?:next-export-prompt-file|download-execution-package)"/g)].length,separateControlCount:[...html.matchAll(/<button\b[^>]*(?:\bdata-download-artifact=|\bid="(?:export-prompt-file|export-prompt-manifest|export-prompt-context|export-stage-files)")/g)].length};
}

// BEGIN BOUNDED STAGE EXPLANATION SUPPLEMENT
// Independent §37 meanings, including valid paraphrases and explicit contradictions.
// Role labels, actor execution, CSS/browser visibility and complete journeys remain
// separate. Stages17/25 also require their controlling operation context; this oracle
// covers the rendered explanation's core meaning, not all execution/freeze evidence.
const expectedStageExplanations={
 6:{requirementId:"NREQ-24e6069a277ef302124bf0ad269f477a",sourceLine:3434,expected:"AI is creating tests now. No tests are executed yet.",required:[/(?:AI|agent).*creat.*tests/i,/(?:No tests are executed|definition is not execution|tests have not (?:run|been executed))/i],forbidden:/Tests (?:have already run|are already complete)|tests are executed now/i,paraphrase:"AI creates the verification tests; these tests have not run.",contradiction:"Tests have already run."},
 7:{requirementId:"NREQ-804783f8a5edc1e25d4e4b8a0761310d",sourceLine:3451,expected:"Invalid examples are being created and checked to prove that validators catch errors.",required:[/Invalid examples/i,/(?:creat|build)/i,/(?:checked|check)/i,/(?:validators? catch errors|validator.*reject|rejection.*validator)/i],forbidden:/accept (?:all )?invalid examples|invalid examples are not checked/i,paraphrase:"Invalid examples are created and checked; a validator must reject them.",contradiction:"Accept invalid examples."},
 10:{requirementId:"NREQ-27273749a1bfb5e53140b70e3a8d245a",sourceLine:3479,expected:"Select the exact files that make up this candidate.",required:[/Select/i,/exact.*files/i,/candidate/i],forbidden:/files need not be exact|select approximate files/i,paraphrase:"Select the exact files for this candidate.",contradiction:"Select approximate files."},
 11:{requirementId:"NREQ-5fb114a9f3df0d4a47e7d40cc130d253",sourceLine:3489,expected:"The candidate will be executed ten times independently.",required:[/candidate/i,/(?:ten|10) times/i,/independent/i],forbidden:/reuse (?:one|the same) context|once is sufficient/i,paraphrase:"Execute the candidate ten times in independent contexts.",contradiction:"Reuse one context."},
 12:{requirementId:"NREQ-321537d0e19dda97945429537926ebbc",sourceLine:3499,expected:"Each run is now being checked against the stored tests.",required:[/Each run/i,/check/i,/stored tests/i],forbidden:/skip (?:the )?stored tests|self-verification is sufficient/i,paraphrase:"Check each run against the stored tests.",contradiction:"Skip the stored tests."},
 15:{requirementId:"NREQ-77fc05bed2f6e7b6e683de1c2b102051",sourceLine:3525,expected:"Every confirmed defect becomes a permanent regression test.",required:[/Every confirmed defect/i,/permanent regression(?: test)?/i],forbidden:/regressions? (?:may|can) be discarded|discard permanent regressions/i,paraphrase:"Every confirmed defect requires a permanent regression test.",contradiction:"Discard permanent regressions."},
 17:{requirementId:"NREQ-1ca1a99e86f24cb2690fc4663009c497",sourceLine:3542,expected:"The corrected candidate is rerun against all applicable tests.",required:[/corrected candidate/i,/rerun/i,/(?:all applicable tests|complete ten-execution verification loop)/i],forbidden:/skip applicable tests|rerun only selected tests/i,paraphrase:"Rerun the corrected candidate against all applicable tests.",contradiction:"Skip applicable tests."},
 19:{requirementId:"NREQ-b8ff460c90ce9c09f2fd2e4093918c64",sourceLine:3558,expected:"The unchanged final candidate is rerun to confirm stability.",required:[/unchanged final candidate/i,/rerun/i,/(?:confirm|check) stability/i],forbidden:/change the candidate before confirmation|a changed candidate confirms stability/i,paraphrase:"Rerun the unchanged final candidate to confirm stability.",contradiction:"Change the candidate before confirmation."},
 21:{requirementId:"NREQ-cb1734917ab51fda9d64f86f7f247925",sourceLine:3576,expected:"The approved final product is being created. These exact output bytes become the product under test.",required:[/approved final product/i,/(?:creat|generat)/i,/exact.*(?:output )?bytes.*product under test/i],forbidden:/use edited bytes instead|test substitute bytes/i,paraphrase:"Create the approved final product; its exact output bytes become the product under test.",contradiction:"Test substitute bytes."},
 22:{requirementId:"NREQ-62a7ed51e5192a6b11be2850b098da98",sourceLine:3585,expected:"The application is running all mechanical tests against the final product.",required:[/(?:final product|finished-product bytes)/i,/(?:mechanical|deterministic) test/i,/(?:running all|checked.*each|each.*check)/i],forbidden:/pretend tests ran|invent a successful execution/i,paraphrase:"Each deterministic test checks the exact finished-product bytes through its declared executor.",contradiction:"Pretend tests ran."},
 23:{requirementId:"NREQ-b3b8074e42901ec598fe77099a811e63",sourceLine:3595,expected:"Some requirements require independent interpretation. An independent AI reviewer will check them.",required:[/requirements?/i,/(?:interpretation|meaning judgment)/i,/independent.*review/i],forbidden:/the generator may self-review|prior conclusions establish meaning/i,paraphrase:"An independent reviewer checks requirements needing meaning judgment.",contradiction:"The generator may self-review."},
 24:{requirementId:"NREQ-f5fbc421f0da0d6b66826b29ce420104",sourceLine:3604,expected:"The finished product is being deliberately challenged for failures and regressions.",required:[/finished product/i,/deliberately challenge(?:d)?/i,/failures and regressions/i],forbidden:/do not challenge the finished product|ignore regressions/i,paraphrase:"Deliberately challenge the finished product for failures and regressions.",contradiction:"Ignore regressions."},
 25:{requirementId:"NREQ-045d929fc50b7d6fbd16480328112227",sourceLine:3613,expected:"The exact frozen delivery-candidate set is being opened and visually or package inspected.",required:[/exact/i,/(?:delivery-candidate set|delivery files)/i,/(?:visually|rendered|package)/i,/inspect/i],forbidden:/inspect a different set|unfrozen files are sufficient/i,paraphrase:"Inspect the exact frozen delivery-candidate set visually and as a package.",contradiction:"Inspect a different set."},
 26:{requirementId:"NREQ-25e91e450e724c8ac9d5b51a43867b67",sourceLine:3621,expected:"The application is reconciling process evidence with product evidence.",required:[/process evidence/i,/product evidence/i,/reconcil/i],forbidden:/process evidence replaces product evidence|ignore product evidence/i,paraphrase:"Reconcile process evidence with product evidence.",contradiction:"Ignore product evidence."},
 27:{requirementId:"NREQ-57334ead2bc052e40b1c21436c935c28",sourceLine:3629,expected:"The application is calculating whether release is allowed.",required:[/application/i,/calculat/i,/release.*allowed/i],forbidden:/the (?:agent|operator) sets release|human sets release/i,paraphrase:"The application calculates whether release is allowed.",contradiction:"The operator sets release."},
 29:{requirementId:"NREQ-831250724c9d58362ca4ecfd50d4fe89",sourceLine:3647,expected:"The application is proving every mandatory requirement has a complete evidence chain.",required:[/application/i,/(?:every|all) mandatory requirement/i,/evidence chain/i,/(?:complete|proves|proving)/i],forbidden:/incomplete chains are sufficient|ignore mandatory requirements/i,paraphrase:"The application proves every mandatory requirement has a complete evidence chain.",contradiction:"Incomplete chains are sufficient."}
};
export function observeStagePurposeMarkup(html){
 const texts=[];
 for(const match of html.matchAll(/<div class="notice"><strong>This stage<\/strong><br>([\s\S]*?)<\/div>/g)){
  const stack=[];
  for(const tag of html.slice(0,match.index).matchAll(/<\/?([a-z][a-z0-9:-]*)\b[^>]*>/gi)){
   const name=tag[1].toLowerCase();
   if(tag[0].startsWith('</')){const index=stack.map(row=>row.name).lastIndexOf(name);if(index>=0)stack.splice(index);}
   else if(!['input','br','hr','img','meta','link'].includes(name))stack.push({name,hidden:['script','style'].includes(name)||name==='details'&&!/\bopen(?:\s|=|>)/i.test(tag[0])||/\shidden(?:\s|=|>)/i.test(tag[0])||/\bid=["']generated-prompt["']/i.test(tag[0])});
  }
  if(!stack.some(row=>row.hidden))texts.push(unescapeHtml(match[1].replace(/<[^>]*>/g,' ')).trim());
 }
 return texts;
}
export function assertStageExplanation(texts,number){
 const expected=expectedStageExplanations[number];if(!expected)return null;
 assert.equal(texts?.length,1,'STAGE_EXPLANATION_SINGLE_VISIBLE_ORACLE: '+number);
 const text=texts[0];
 assert.ok(expected.required.every(pattern=>pattern.test(text))&&!expected.forbidden.test(text),'STAGE_EXPLANATION_MEANING_ORACLE: '+number);
 return {requirementId:expected.requirementId,sourceLine:expected.sourceLine,stage:number,expected:expected.expected,observed:text,scope:'Rendered primary This-stage explanation core meaning; no execution, browser/CSS visibility or complete-stage claim.',passed:true};
}
function checkedStageExplanation(texts,number){
 const observation=assertStageExplanation(texts,number);if(!observation)return null;
 const expected=expectedStageExplanations[number];
 // Verbatim source and an independently written paraphrase both remain valid.
 assertStageExplanation([expected.expected],number);assertStageExplanation([expected.paraphrase],number);
 for(const invalid of [[],['Perform unrelated stage work.'],[texts[0]+' '+expected.contradiction]])assert.throws(()=>assertStageExplanation(invalid,number),/STAGE_EXPLANATION_(?:SINGLE_VISIBLE|MEANING)_ORACLE/);
 return {...observation,sourceLiteralAccepted:true,paraphraseAccepted:true,negativeCases:['missing-visible-explanation','wrong-meaning','contradictory-guidance']};
}
// END BOUNDED STAGE EXPLANATION SUPPLEMENT

// Serialize this observer into the real browser. It reads the DOM only; the
// same oracle below evaluates actual markup and actual browser observations.
export function observeWorkflowDOM(){
 const view=document.querySelector('#screen');
 return {stagePurposeTexts:[...view.querySelectorAll('.notice')].filter(node=>node.firstElementChild?.textContent==='This stage'&&!node.closest('[hidden],details:not([open]),#generated-prompt')).map(node=>node.textContent.replace(/^This stage/,'').trim()),previewTexts:[...view.querySelectorAll('#generated-prompt')].map(node=>node.textContent),viewText:view.textContent,handoffControlCount:view.querySelectorAll('#next-export-prompt-file,#download-execution-package').length,separateControlCount:view.querySelectorAll('[data-download-artifact],#export-prompt-file,#export-prompt-manifest,#export-prompt-context,#export-stage-files').length};
}

export function assertWorkflowPresentation(observation,{instruction,caseId='workflow'}={}){
 const {previewTexts,viewText,handoffControlCount,separateControlCount}=observation;
 const selectedStage=caseId.match(/^selected-stage-(\d+)-/);
 const stageExplanation=selectedStage?checkedStageExplanation(observation.stagePurposeTexts,Number(selectedStage[1])):null;
 assert.equal(previewTexts.length,1,'INSTRUCTION_ONCE_ORACLE: '+caseId+' must display one instruction preview.');
 const preview=previewTexts[0];assert.ok(preview.length>0,'INSTRUCTION_ONCE_ORACLE: '+caseId+' has an empty preview.');
 if(instruction!==undefined)assert.ok(String(instruction).startsWith(preview),'INSTRUCTION_ONCE_ORACLE: '+caseId+' repeats or changes its authoritative instruction.');
 const occurrences=viewText.split(preview).length-1;
 assert.equal(occurrences,1,'INSTRUCTION_ONCE_ORACLE: '+caseId+' repeats the instruction elsewhere in the view.');
 assert.ok(handoffControlCount<=1,'STAGE_HANDOFF_SINGLE_CONTROL_ORACLE: '+caseId+' repeats the stage handoff control.');
 assert.equal(separateControlCount,0,'STAGE_HANDOFF_NO_SEPARATE_ARTIFACT_CONTROLS: '+caseId+' retains a superseded per-artifact handoff control.');
 return {caseId,result:'PASS',...(stageExplanation?{stageExplanation}:{}),previewCharacters:preview.length,instructionOccurrences:occurrences,handoffControlCount,separateControlCount,authoritativeInstructionCompared:instruction!==undefined};
}
