import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const write = (file, content) => fs.writeFileSync(file, content, 'utf8');

function replaceOnce(file, before, after, label) {
  const source = read(file);
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: expected source text was not found in ${file}.`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: expected exactly one source match in ${file}.`);
  write(file, source.slice(0, first) + after + source.slice(first + before.length));
}

replaceOnce(
  'prompt-engine.js',
  "PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/53'",
  "PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/54'",
  'prompt engine version'
);

replaceOnce(
  'prompt-engine.js',
  'HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE\\nAsk genuinely human-only questions conversationally in plain language before final JSON. Never ask the human to repeat information already present in authorized input, captured Stage 01 content, canonical context, or authorized research. humanInputRequests is only the structured fallback when a blocking human answer remains unavailable.\\n\\nROLE',
  'HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE\\nCONVERSATION PRECEDENCE — HUMAN EXPERIENCE IS PART OF EXECUTION\\n- When a value, file, or decision can only come from the human and is not already available, ask the human directly in concise plain language in this same chat. Do not emit final JSON in that turn.\\n- Continue the same conversation from the human answer. Ask only the next genuinely useful human-only question or compact related group; do not interrogate the human for facts available in supplied materials, common domain knowledge, canonical context, or authorized research/tools.\\n- When FILES YOU MUST RECEIVE or the human supplied-material inventory names a file whose bytes are not actually available in the executing conversation, ask the human to attach that exact file. Do not ask the human to describe, summarize, transcribe, or reconstruct it. Do not claim inspection and do not emit final JSON in that turn.\\n- humanInputRequests is NOT the normal conversation channel. It is the final structured fallback only when a blocking human answer remains unavailable or explicitly deferred after conversation, or interactive conversation is unavailable.\\n- If a later stage discovers a new genuinely human-only fact or decision, apply this same conversational rule at that stage before final JSON.\\n\\nDo not start by emitting JSON when a human answer or file transfer is needed. Talk to the human first; JSON is the final handoff to the application, not the conversation.\\n\\nROLE',
  'conversation precedence'
);

replaceOnce(
  'prompt-engine.js',
  'CURRENT AGENT-NORMALIZED DELIVERABLE\\n${show(job.EXACT_DELIVERABLE_REQUESTED)}\\n\\nSTAGE PROCEDURE',
  'CURRENT AGENT-NORMALIZED DELIVERABLE\\n${show(job.EXACT_DELIVERABLE_REQUESTED)}\\n\\n${stage===1?`NAMED SUPPLIED MATERIALS — VERIFY ACTUAL RECEIPT BEFORE FINAL JSON\\n${show(parseSuppliedMaterials(job.SUPPLIED_MATERIALS_INVENTORY))}\\nA material name, filename, application record, or hash is not the material bytes. First inspect the attachments actually available in this executing conversation. For each named material whose bytes are absent, ask the human in plain language to attach the exact item; do not ask for a summary or transcription and do not emit final JSON in that turn. If the human explicitly cannot provide or defers the item, record that unavailability honestly. Proceed without its bytes only when the objective, intended deliverable, and input boundary can still be defined without guessing substantive file contents; otherwise the missing material is a blocking human-input request.\\n\\n`:``}STAGE PROCEDURE',
  'named supplied-material receipt check'
);

replaceOnce(
  'prompt-engine.js',
  '${stage===1?`STAGE 01 ACCOUNTING OUTPUT\\n',
  '${stage===1?`STAGE 01 INTERACTION SEQUENCE — REQUIRED\\n1. Read the authorized user input and inspect which named files are actually attached in this conversation.\\n2. If a named required file is absent, ask the human to attach the exact file in normal language and stop the turn without JSON. Never infer its contents from its name.\\n3. After available files are received, inspect only enough to define the job and capture materially relevant human authority; do not perform later-stage research, requirement compilation, drafting, production, filing, simulation, manufacturing, or verification.\\n4. Ask every foreseeable genuinely human-only ask-now item conversationally. Distinguish BLOCKING_NOW from ASK_NOW_NONBLOCKING; unknown or deferred is an acceptable answer for a nonblocking item. Never silently place an unasked human-only item in UNKNOWN_INFORMATION.\\n5. For a patent-application job, when not already known, ask about intended jurisdiction; filing route or existing filing; inventor identity; ownership, assignment, or employment obligations; priority, continuity, and related applications; public disclosure, sale, offer, publication, demonstration, and dates; filing or business deadlines; government funding or joint research; intended endpoint; and additional human-controlled invention materials.\\n6. Only after the conversation and file-handoff steps are complete may you return one final JSON object. A skeleton, template, placeholder-only, or generic “input captured” DATA_PROPOSAL is prohibited. Every agent-owned Stage 01 field must contain the complete substantive job definition supported by the received authority, and every intake unit must preserve its complete controlled input meaning.\\n\\nSTAGE 01 ACCOUNTING OUTPUT\\n',
  'Stage 01 interaction sequence'
);

replaceOnce(
  'prompt-engine.js',
  'MANDATORY RESPONSE RULES\\n- Never claim unavailable capability or missing bytes as a pass.',
  'FINAL MACHINE HANDOFF — ONLY AFTER CONVERSATION AND STAGE WORK ARE COMPLETE\\nThe contract below is for the single final application-ingestion response. It must not replace, abbreviate, or suppress the human conversation and required file handoff.\\n\\nMANDATORY RESPONSE RULES\\n- Never claim unavailable capability or missing bytes as a pass.',
  'final handoff boundary'
);

const accountingLine = "    if(hashMatches&&INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition)&&statementsValid&&(disposition==='inapplicable with reason'?Boolean(String(unit?.reason||'').trim()):statements.length>0))accounted.add(id);";
const accountingReplacement = `    const normalizedSourceText=String(source.rawValueText??'').replace(/\\s+/g,' ').trim();
    const normalizedStatements=statements.map(statement=>String(statement?.text??'').replace(/\\s+/g,' ').trim()).filter(Boolean);
    if(source.kind!=='SUPPLIED_MATERIAL'&&disposition!=='inapplicable with reason'&&normalizedSourceText&&!normalizedStatements.some(text=>text.includes(normalizedSourceText))){reasons.push(\`Stage 01 intake unit \${id} does not preserve the complete controlled human input text.\`);statementsValid=false;}
    if(source.kind==='SUPPLIED_MATERIAL'){
      const materialAvailable=['AVAILABLE','VERIFIED','PRESENT','STORED','PERSISTED'].includes(upper(source.availability));
      const substantiveClasses=new Set(['FACT','REQUIREMENT','CONSTRAINT','DECISION','PROHIBITION','REQUESTED_OUTPUT','ACCEPTANCE_CONDITION','UNRESOLVED_HUMAN_ONLY']);
      const substantiveStatements=statements.filter(statement=>{
        const text=String(statement?.text??'').replace(/\\s+/g,' ').trim();
        const classification=upper(statement?.statementClass);
        return substantiveClasses.has(classification)&&text.length>=12&&text!==normalizedSourceText&&text!==String(source.filename||'').trim()&&text!==String(source.artifactId||'').trim()&&text!==String(source.artifactSha256||'').trim();
      });
      if(!materialAvailable&&disposition==='incorporated into the job definition'){reasons.push(\`Stage 01 intake unit \${id} claims incorporation of supplied material whose bytes are unavailable.\`);statementsValid=false;}
      if(materialAvailable&&disposition==='incorporated into the job definition'&&!substantiveStatements.length){reasons.push(\`Stage 01 intake unit \${id} claims supplied-material incorporation without a substantive extracted human-authority statement.\`);statementsValid=false;}
      if(materialAvailable&&disposition==='retained as context'&&!substantiveStatements.length&&!String(unit?.reason||'').trim()){reasons.push(\`Stage 01 intake unit \${id} retained an inspected supplied material as context without stating why no substantive human-authority statement was captured.\`);statementsValid=false;}
    }
${accountingLine}`;
replaceOnce('workflow-engine.js', accountingLine, accountingReplacement, 'Stage 01 semantic intake validation');

write('verify-stage01-user-experience.mjs', `import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const engine=globalThis.closedLoopWorkflowEngine;
const prompts=globalThis.closedLoopPromptEngine;
const assert=(value,message)=>{if(!value)throw new Error(message);};

const project=core.createBlankState('JOB-STAGE01-UX');
Object.assign(project.job,{
  JOB_TITLE:'Stage 01 conversation proof',
  JOB_OWNER:'Human operator',
  EXACT_USER_OBJECTIVE_VERBATIM:'Build the complete phone-first closed-loop application described by my supplied intent file. Preserve every requirement and do not guess missing human decisions.',
  SUPPLIED_MATERIALS_INVENTORY:'intent.txt',
  REQUIRED_OUTPUT_FORMAT:'Working application and exact requested artifacts',
  PROHIBITED_ACTIONS:'Do not replace the conversation with schema output. Do not infer file contents from a filename.',
  EXPLICIT_USER_REQUIREMENTS:'Request the named file when it is not actually attached, complete human intake, then return final JSON only after the conversation.',
  CURRENT_INPUT_VERSION:'INPUT-v001'
});
engine.ensureShape(project);

const firstPrompt=prompts.buildPromptRecord(1,project,{operation:'COMPLETE'}).prompt;
for(const required of [
  'CONVERSATION PRECEDENCE — HUMAN EXPERIENCE IS PART OF EXECUTION',
  'Do not emit final JSON in that turn.',
  'JSON is the final handoff to the application, not the conversation.',
  'NAMED SUPPLIED MATERIALS — VERIFY ACTUAL RECEIPT BEFORE FINAL JSON',
  'intent.txt',
  'ask the human in plain language to attach the exact item',
  'STAGE 01 INTERACTION SEQUENCE — REQUIRED',
  'A skeleton, template, placeholder-only, or generic “input captured” DATA_PROPOSAL is prohibited.',
  'For a patent-application job',
  'FINAL MACHINE HANDOFF — ONLY AFTER CONVERSATION AND STAGE WORK ARE COMPLETE'
])assert(firstPrompt.includes(required),\`Stage 01 prompt omitted required user-experience behavior: \${required}\`);
assert(firstPrompt.indexOf('CONVERSATION PRECEDENCE')<firstPrompt.indexOf('STRICT RESPONSE CONTRACT'),'Machine contract appears before conversation precedence.');

engine.registerArtifactBytes(project,{stage:1,artifactId:'ARTIFACT-INTENT-001',filename:'intent.txt',mediaType:'text/plain',byteSize:128,sha256:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',role:'HUMAN_INPUT'});
const manifest=engine.intakeCoverageManifest(project);
assert(manifest.units.some(unit=>unit.kind==='SUPPLIED_MATERIAL'&&unit.filename==='intent.txt'),'Supplied file was not represented in Stage 01 intake manifest.');

const sparse={schema:'closed-loop-stage01-capture/1',inputVersion:manifest.inputVersion,manifestSha256:manifest.manifestSha256,units:manifest.units.map((unit,index)=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:'incorporated into the job definition',reason:'',extractedStatements:[{statementKey:\`sparse-\${index+1}\`,text:'Input captured.',statementClass:'CONTEXT'}]}))};
const sparseResult=engine.evaluateIntakeAccounting(project,{capture:sparse});
assert(!sparseResult.complete,'Stage 01 accepted a generic placeholder-only intake.');
assert(sparseResult.reasons.some(reason=>reason.includes('complete controlled human input text')),'Sparse human input was not rejected for zero-loss failure.');
assert(sparseResult.reasons.some(reason=>reason.includes('without a substantive extracted human-authority statement')),'Sparse supplied-file intake was not rejected.');

const complete={schema:'closed-loop-stage01-capture/1',inputVersion:manifest.inputVersion,manifestSha256:manifest.manifestSha256,units:manifest.units.map((unit,index)=>({
  sourceUnitId:unit.unitId,
  sourceRawValueSha256:unit.rawValueSha256,
  disposition:'incorporated into the job definition',
  reason:'',
  extractedStatements:[{statementKey:\`complete-\${index+1}\`,text:unit.kind==='SUPPLIED_MATERIAL'?'The supplied intent file requires the complete phone-first closed-loop application and preservation of every stated project requirement.':unit.rawValueText,statementClass:unit.kind==='SUPPLIED_MATERIAL'?'REQUIREMENT':'FACT'}]
}))};
const completeResult=engine.evaluateIntakeAccounting(project,{capture:complete});
assert(completeResult.complete,\`Complete Stage 01 intake was rejected: \${JSON.stringify(completeResult.reasons)}\`);

const omitted=structuredClone(complete);omitted.units.pop();
assert(!engine.evaluateIntakeAccounting(project,{capture:omitted}).complete,'Stage 01 accepted an omitted controlled input unit.');

console.log(JSON.stringify({conversationPrecedence:true,namedFileRequest:true,noEarlyJson:true,patentAskNow:true,sparseIntakeRejected:true,completeIntakeAccepted:true}));
`);

write('verify-stage01-intake-closure.mjs', `import './verify-stage01-user-experience.mjs';
`);

replaceOnce(
  '.github/workflows/pages.yml',
  '          for file in workbook.js hash.js workflow-schema.js test-runtime.js test-worker.js workflow-engine.js prompt-engine.js response-ingestion.js project-store.js app-core.js; do\\n            node --check "$file"\\n          done',
  '          for file in workbook.js hash.js workflow-schema.js test-runtime.js test-worker.js workflow-engine.js prompt-engine.js response-ingestion.js project-store.js app-core.js; do\\n            node --check "$file"\\n          done\\n          node verify-stage01-user-experience.mjs\\n          node verify-one-time-intent-intake.mjs\\n          node verify-prompt-semantics.mjs\\n          node verify-user-prompt-invariants.mjs',
  'behavioral CI commands'
);

console.log('Stage 01 user-experience repair applied.');
