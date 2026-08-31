from pathlib import Path
import json

prompt_path = Path('prompt-engine.js')
source = prompt_path.read_text()

old_version = "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/56';"
new_version = "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/57';"
if old_version not in source:
    raise SystemExit('Expected prompt-engine/56 version anchor was not found.')
source = source.replace(old_version, new_version, 1)

conversation_function = r'''function stageOneConversationBlock(state){
  const job=state?.job||{};
  const materials=parseSuppliedMaterials(job.SUPPLIED_MATERIALS_INVENTORY);
  const artifacts=safe(state?.projectData?.artifacts).filter(record=>workflow.isActiveRecord(record));
  const materialStatus=materials.map((material,index)=>{
    const exactReference=clean(material.label),normalized=exactReference.toLowerCase();
    const matches=artifacts.filter(record=>{const filename=clean(recordValue(record,'FILENAME')||record?.filename).toLowerCase();return filename&&(filename===normalized||normalized.includes(filename)||filename.includes(normalized));});
    const available=matches.find(record=>['AVAILABLE','VERIFIED','PRESENT','STORED'].includes(upper(recordValue(record,'AVAILABILITY')||record?.availability))&&clean(recordValue(record,'SHA256')||record?.sha256));
    return {materialNumber:index+1,exactHumanReference:exactReference,materialType:material.type,canonicalArtifactId:available?recordId(available,'artifacts'):null,canonicalFilename:available?String(recordValue(available,'FILENAME')||available?.filename||''):null,canonicalSha256:available?String(recordValue(available,'SHA256')||available?.sha256||''):null,applicationByteStatus:available?'VERIFIED_IN_BROWSER_LOCAL_CUSTODY':'NOT_ESTABLISHED',externalConversationByteStatus:'NOT_ASSUMED',requiredAgentBehavior:available?'If these exact bytes are not actually attached or otherwise readable in this conversation, ask the human to attach the exact file before continuing any intake that depends on its content.':'If this named material contains project intent, requirements, constraints, decisions, acceptance conditions, or deliverable information needed for Stage 01, ask the human to attach or provide it now. Do not ask the human to summarize the file instead.'};
  });
  return `STAGE 01 HUMAN CONVERSATION — THIS OCCURS BEFORE ANY FINAL JSON
You are speaking directly with the human who requested the project. You are not responding to an API, filling a form, or producing a report for a machine.
DO NOT return final JSON, a JSON skeleton, a job packet, or a proposed completion at the beginning of the conversation merely because a response schema appears later in this instruction.

REQUIRED INTERACTION SEQUENCE
1. Read the exact authorized User Job Input and the application intake manifest completely.
2. Determine what the human is trying to accomplish, what actual deliverable is intended, what acceptance conditions apply, and what supplied material the human says exists. Do not invent missing intent.
3. Deal with supplied material before finalizing intake. When the human says a file, attachment, link, packet, drawing, repository, record, or other material contains project information needed to define the job, you must actually receive and inspect that material. If it is not actually readable in this conversation, ask the human in plain language to attach or provide the exact named material now, explain briefly that its contents are needed for complete intake, then stop and wait. Do not infer substantive content from its filename, hash, or description. Do not emit final JSON while required Stage 01 material remains unavailable.
4. After required material is readable, inspect it deeply enough to extract every project-relevant human-authority fact, requirement, constraint, decision, prohibition, requested output, acceptance condition, material reference, and unresolved human-only issue needed to define the requested outcome. Do not turn that inspection into external research, requirement atomization, test design, production, filing, simulation, manufacturing, or verification.
5. Identify every foreseeable question that genuinely must be answered by the human. Ask BLOCKING_NOW and ASK_NOW_NONBLOCKING questions conversationally in concise ordinary language. Do not show internal schema, manifest, hash, field, enum, or JSON terminology to the human. ASK_NOW_NONBLOCKING permits the human to answer unknown or deferred; it does not permit you to skip the question. Do not ask questions that the supplied material, authorized research, or a later stage can resolve.
6. Continue the conversation after each human answer. Re-read the accumulated answers and supplied material, then ask any remaining genuinely human-only intake questions. Never ask the human to repeat information already supplied anywhere in the current conversation or current authorized project input.
7. Only after the objective, intended deliverable, input boundary, supplied-material intake, acceptance conditions, and all foreseeable ask-now human-only issues are complete may you choose the final response type and produce one final strict JSON object.
8. Use HUMAN_INPUT_REQUIRED only when a genuinely blocking human answer remains unavailable after the conversational attempt. Use DATA_PROPOSAL only when the intake is semantically complete. A schema-valid but incomplete, generic, skeletal, placeholder, or low-detail proposal is prohibited.

FINAL INTAKE QUALITY
EXACT_DELIVERABLE_REQUESTED must identify the actual requested outcome and deliverable with enough material detail for later stages to act without guessing. INPUT_SET_CONTENTS must preserve all project-relevant meaning from the human input, received supplied materials, and human answers so later stages never require the original intent to be supplied again. ASSUMPTIONS and UNKNOWN_INFORMATION must be specific, evidence-bound, and must not hide an unasked human-only issue.

NAMED SUPPLIED MATERIAL STATUS
${show(materialStatus.length?materialStatus:'NONE NAMED IN CURRENT USER JOB INPUT')}
Browser-local custody never proves that this external conversation received the bytes. If a required named material is not actually readable here, request it from the human before continuing.`;
}
'''
anchor = "function intakeCoverageManifest(state){return workflow.intakeCoverageManifest(state);}"
if anchor not in source:
    raise SystemExit('Stage 01 conversation insertion anchor was not found.')
source = source.replace(anchor, conversation_function + anchor, 1)

stage_one_procedure = """Perform complete human-authority intake only, through the required human conversation before final JSON. Begin by understanding the exact request and identifying the actual intended deliverable, acceptance conditions, supplied materials, and input boundary. Do not return a machine response merely because the response contract is present. If the human identified a file or other material whose contents are needed to define the project, explicitly ask the human to attach or provide that exact material when it is not actually readable in the current conversation, stop and wait for it, then inspect the actual contents before continuing. Never substitute a filename, hash, user-written summary, generic placeholder, or guessed contents for the material itself. Ask every foreseeable genuinely human-only BLOCKING_NOW and ASK_NOW_NONBLOCKING question conversationally, allow unknown or deferred answers for nonblocking questions, and continue the conversation until no ask-now human-only issue remains. Do not ask for information already present in the current human input, received material, prior answers, or other authorized current project context. Classify research-resolvable and later-stage matters as LATER_RESOLVABLE rather than asking the human. Preserve every materially relevant fact, requirement, constraint, decision, prohibition, requested output, acceptance condition, material reference, and unresolved human-only issue. Account for every application-enumerated intake unit exactly once. INPUT_SET_CONTENTS must be detailed enough to carry the complete captured project meaning into later stages so the original intent and Stage 01 materials are never requested again. Return HUMAN_INPUT_REQUIRED only after conversationally attempting to obtain a genuinely blocking human answer. Return DATA_PROPOSAL only after complete semantic intake; never return skeletal, generic, placeholder, or zero-detail JSON. Stage 01 must not perform external source research, requirement atomization, test design, production, filing, simulation, manufacturing, or product verification."""
start_marker = 'const stageSpecial=Object.freeze({"1":'
start = source.find(start_marker)
if start < 0:
    raise SystemExit('stageSpecial Stage 01 start marker was not found.')
value_start = start + len(start_marker)
value_end = source.find(',"2":', value_start)
if value_end < 0:
    raise SystemExit('stageSpecial Stage 02 boundary was not found.')
source = source[:value_start] + json.dumps(stage_one_procedure, ensure_ascii=False) + source[value_end:]

body_anchor = "return `COPY BLOCK — STAGE ${String(stage).padStart(2,'0')} — ${definition.title}\\n\\n${projectDataExecutionRule(stage)}"
body_replacement = "return `COPY BLOCK — STAGE ${String(stage).padStart(2,'0')} — ${definition.title}\\n\\n${stage===1?stageOneConversationBlock(state)+'\\n\\n':''}${projectDataExecutionRule(stage)}"
if body_anchor not in source:
    raise SystemExit('Prompt body ordering anchor was not found.')
source = source.replace(body_anchor, body_replacement, 1)

completion_marker = "const STAGE_COMPLETION_DIRECTIVES=Object.freeze({\n1:"
completion_start = source.find(completion_marker)
if completion_start < 0:
    raise SystemExit('Stage completion Stage 01 marker was not found.')
completion_value_start = completion_start + len(completion_marker)
completion_value_end = source.find(',\n2:', completion_value_start)
if completion_value_end < 0:
    raise SystemExit('Stage completion Stage 02 boundary was not found.')
stage_one_completion = "Do not choose a final machine response until the human-facing conversation is complete: the objective and actual intended deliverable are defined; every named supplied material needed for intake was explicitly requested when absent, actually received, and inspected; every controlled input unit is accounted for; every foreseeable genuinely human-only issue is already supplied, asked and answered, or asked and explicitly deferred; all project-relevant meaning is preserved in durable Stage 01 capture; and no later-stage substantive work was performed. A generic, skeletal, placeholder, or low-detail DATA_PROPOSAL is incomplete."
source = source[:completion_value_start] + json.dumps(stage_one_completion, ensure_ascii=False) + source[completion_value_end:]

rule_start = source.find("if(stage===1)lines.push('")
rule_end_token = ");if(stage===3)"
if rule_start < 0:
    raise SystemExit('Stage 01 project-data rule marker was not found.')
rule_end = source.find(rule_end_token, rule_start)
if rule_end < 0:
    raise SystemExit('Stage 03 project-data rule boundary was not found.')
stage_one_rule = "if(stage===1)lines.push('Stage 01 is conversation-first. Do not emit final JSON before the human conversation, required supplied-material request and inspection, and complete human-only clarification are finished. If a named material needed for intake is not actually readable in the external conversation, ask the human to attach it and wait. Every application-enumerated input unit must be classified exactly once, every materially relevant human-authority statement must be preserved, and every foreseeable genuinely human-only BLOCKING_NOW or ASK_NOW_NONBLOCKING issue must be asked before final Stage 01 JSON unless already answered. Never silently move an unasked human-only issue into UNKNOWN_INFORMATION and never return a generic or skeletal proposal.');"
source = source[:rule_start] + stage_one_rule + source[rule_end + 2:]

prompt_path.write_text(source)

verification = r'''import fs from 'node:fs';
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
'''
Path('verify-stage01-conversation-first.mjs').write_text(verification)

workflow_path = Path('.github/workflows/pages.yml')
workflow = workflow_path.read_text()
syntax_anchor = 'verify-one-time-intent-intake.mjs verify-stage01-intake-closure.mjs \\\n'
if syntax_anchor not in workflow:
    raise SystemExit('Pages syntax-list anchor was not found.')
workflow = workflow.replace(syntax_anchor, 'verify-one-time-intent-intake.mjs verify-stage01-intake-closure.mjs verify-stage01-conversation-first.mjs \\\n', 1)
run_anchor = '          node verify-stage01-intake-closure.mjs\n'
if run_anchor not in workflow:
    raise SystemExit('Pages Stage 01 run anchor was not found.')
workflow = workflow.replace(run_anchor, run_anchor + '          node verify-stage01-conversation-first.mjs\n', 1)
workflow_path.write_text(workflow)

live_path = Path('verify-live.mjs')
live = live_path.read_text()
live = live.replace(",'AUTHORIZED_OPERATION_01.txt'", '', 1)
live = live.replace("closed-loop-stage-response/2", "closed-loop-stage-response/3")
live_path.write_text(live)
