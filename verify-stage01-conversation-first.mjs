import fs from 'node:fs';
import vm from 'node:vm';

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine;
assert(core&&engine&&prompts,'Stage 01 prompt runtime failed to load.');

function project(materials){
  const state=core.createBlankState('JOB-STAGE01-CONVERSATION');
  Object.assign(state.job,{
    EXACT_USER_OBJECTIVE_VERBATIM:'Create the requested product. I have a project-intent file containing the detailed requirements and acceptance conditions.',
    EXACT_DELIVERABLE_REQUESTED:'',
    SUPPLIED_MATERIALS_INVENTORY:materials,
    EXPLICIT_USER_REQUIREMENTS:'Capture everything I supplied and do not make me provide it twice.',
    CURRENT_INPUT_VERSION:'INPUT-v001'
  });
  engine.ensureShape(state);
  engine.recalculate(state);
  return state;
}

const missing=prompts.buildPromptRecord(1,project('[{"filename":"project-intent.txt","type":"USER_INTENT_FILE"}]'),{operation:'COMPLETE'}).prompt;
for(const token of [
  'STAGE 01 HUMAN CONVERSATION — THIS OCCURS BEFORE ANY FINAL JSON',
  'DO NOT return final JSON',
  'ask the human in plain language to attach or provide the exact named material now',
  'then stop and wait',
  'project-intent.txt',
  'Do not infer substantive content from its filename, hash, or description',
  'Continue the conversation after each human answer',
  'A schema-valid but incomplete, generic, skeletal, placeholder, or low-detail proposal is prohibited',
  'EXACT_DELIVERABLE_REQUESTED must identify the actual requested outcome',
  'INPUT_SET_CONTENTS must preserve all project-relevant meaning'
])assert(missing.includes(token),`Stage 01 conversation-first prompt is missing: ${token}`);
assert(missing.indexOf('STAGE 01 HUMAN CONVERSATION')<missing.indexOf('STRICT RESPONSE CONTRACT'),'The machine response contract appears before the required Stage 01 human conversation protocol.');
assert(missing.indexOf('STAGE 01 HUMAN CONVERSATION')<missing.indexOf('STAGE 01 ACCOUNTING OUTPUT'),'Stage 01 accounting appears before the human interaction protocol.');

const availableState=project('[{"filename":"project-intent.txt","type":"USER_INTENT_FILE"}]');
availableState.projectData.artifacts.push({id:'ARTIFACT-000001',active:true,scope:{inputVersion:'INPUT-v001'},fields:{ARTIFACT_ID:'ARTIFACT-000001',FILENAME:'project-intent.txt',TYPE:'text/plain',SHA256:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',AVAILABILITY:'AVAILABLE'}});
const available=prompts.buildPromptRecord(1,availableState,{operation:'COMPLETE'}).prompt;
assert(available.includes('VERIFIED_IN_BROWSER_LOCAL_CUSTODY'),'Stage 01 prompt does not distinguish application custody from external-conversation access.');
assert(available.includes('externalConversationByteStatus')&&available.includes('NOT_ASSUMED'),'Stage 01 prompt falsely assumes browser-local bytes reached the external agent.');
assert(available.includes('If these exact bytes are not actually attached or otherwise readable in this conversation'),'Stage 01 prompt does not require explicit external-context file receipt.');

const none=prompts.buildPromptRecord(1,project('NONE'),{operation:'COMPLETE'}).prompt;
assert(none.includes('NONE NAMED IN CURRENT USER JOB INPUT'),'Stage 01 prompt invents a supplied file when none was named.');
assert(!none.includes('project-intent.txt'),'Stage 01 prompt leaked a material from another project.');

console.log(JSON.stringify({stage01ConversationFirst:true,requiredMaterialRequested:true,externalByteTransferNotAssumed:true,finalJsonDelayedUntilComplete:true,completeIntakeDetailRequired:true},null,2));
