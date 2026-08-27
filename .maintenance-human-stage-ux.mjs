import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8');}
function write(path,text){fs.writeFileSync(path,text);}
function replaceOnce(text,search,replacement,label){
  const first=text.indexOf(search);
  const second=first<0?-1:text.indexOf(search,first+search.length);
  if(first<0)throw new Error(`${label}: expected source text was not found.`);
  if(second>=0)throw new Error(`${label}: expected source text was not unique.`);
  return text.slice(0,first)+replacement+text.slice(first+search.length);
}
function replaceRange(text,startToken,endToken,replacement,label){
  const start=text.indexOf(startToken);
  if(start<0)throw new Error(`${label}: start token was not found.`);
  if(text.indexOf(startToken,start+startToken.length)>=0)throw new Error(`${label}: start token was not unique.`);
  const end=text.indexOf(endToken,start+startToken.length);
  if(end<0)throw new Error(`${label}: end token was not found.`);
  return text.slice(0,start)+replacement+text.slice(end);
}

{
  const path='prompt-engine.js';
  let text=read(path);
  text=replaceOnce(text,
    "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/13';",
    "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/14';",
    'prompt engine version');

  const roleMarker="ROLE\nYou are the ${d.role}. Perform only Stage ${String(stage).padStart(2,'0')} for this single current project.\n\n";
  const earlyMode=[
    roleMarker.trimEnd(),
    '',
    'HUMAN INTERACTION MODE — CONVERSATION FIRST',
    'Work in two modes.',
    '- Conversation mode: If human-only information is needed, ask the smallest useful set of concise plain-language questions. Explain why only when that is not obvious. Do not put conversational questions in JSON.',
    '- Submission mode: When enough information is available for this stage, return the final strict JSON response only.',
    'A human reply continues this same stage and this same instruction. Do not require the human to generate or send a new app prompt merely because you asked a question.',
    '',
    ''
  ].join('\n');
  text=replaceOnce(text,roleMarker,earlyMode,'early human interaction mode');

  const stageOneStart="${stage===1?`STAGE 01 CLARIFICATION EXPERIENCE";
  const stageTwoStart="${stage===2?`STAGE 02 SOURCE DISCOVERY GUIDANCE";
  const stageOneReplacement=[
    "${stage===1?`STAGE 01 CLARIFICATION EXPERIENCE",
    'Before returning final Stage 01 JSON, use normal conversation to collect the human-specific facts and decisions already foreseeable as necessary to achieve the requested outcome, even when a later stage will use them. Ask only for facts or choices that must come from the human. Do not ask for common domain knowledge, facts already present in supplied materials or canonical context, or facts the agent can reliably obtain through authorized research or tools.',
    'If the human does not know or chooses to defer a later-needed item, record it in UNKNOWN_INFORMATION and continue Stage 01 when the objective, intended deliverable, and input boundary are still clear. A later-needed unknown is not by itself a Stage 01 blocker.',
    'Only when a human-only fact remains unavailable after conversation and Stage 01 cannot reliably identify the objective, intended deliverable, or input boundary without it, return HUMAN_INPUT_REQUIRED—not DATA_PROPOSAL—as the final machine response. Put only the still-unanswered blocking questions inside humanInputRequests using the exact question contract below. Do not use HUMAN_INPUT_REQUIRED as the first conversational turn, and do not encode ordinary chat questions in JSON. When the human supplies an answer in the same chat, continue this same Stage 01 instruction; a new app prompt is not required merely because clarification occurred.',
    'The application can display and type-check a final fallback HUMAN_INPUT_REQUIRED response when interactive conversation is unavailable or the human explicitly defers a genuinely blocking answer. Do not hide blocking human information behind UNKNOWN, placeholders, empty strings, or guessed assumptions.',
    "`:''}",
    '',
    ''
  ].join('\n');
  text=replaceRange(text,stageOneStart,stageTwoStart,stageOneReplacement, 'Stage 01 clarification experience');
  write(path,text);
}

{
  const path='app-core.js';
  let text=read(path);
  const oldNotice="${n===1?'<div class=\"notice\"><strong>Clarify before final JSON.</strong> If the external agent asks a question, answer it there, then record the answer in User Job Input and regenerate this instruction. Do not paste or accept a placeholder DATA_PROPOSAL just to discover what information is missing.</div>':''}";
  const newNotice="${n===1?'<div class=\"notice\"><strong>Talk first; paste JSON last.</strong> Send this instruction to ChatGPT and answer any concise questions there. Stay in the same chat. When the agent has enough information, paste only its final JSON below. Do not copy conversational questions into this app or regenerate the instruction merely because the agent asked a question.</div>':''}";
  text=replaceOnce(text,oldNotice,newNotice,'Stage 01 operator notice');

  const oldLoop='<div class="operator-step"><b>1</b><span>Send instruction</span></div><div class="operator-step"><b>2</b><span>Paste full response</span></div><div class="operator-step"><b>3</b><span>Parse and validate</span></div><div class="operator-step"><b>4</b><span>Review and accept</span></div>';
  const newLoop='<div class="operator-step"><b>1</b><span>Send instruction</span></div><div class="operator-step"><b>2</b><span>Answer agent questions</span></div><div class="operator-step"><b>3</b><span>Paste final JSON</span></div><div class="operator-step"><b>4</b><span>Validate, review, accept</span></div>';
  text=replaceOnce(text,oldLoop,newLoop,'four-step agent loop');

  const parseBinding="if($('#parse-output'))$('#parse-output').onclick=prepareStageResponse;";
  const dirtyBinding=[
    "if($('#stage-output'))$('#stage-output').oninput=()=>{",
    "  const report=$('#validation-report');",
    '  if(report){',
    "    report.classList.remove('danger');",
    "    report.classList.add('warn');",
    "    report.innerHTML='<strong>Replacement not evaluated.</strong><br>The response text changed after the prior validation. Tap Parse / validate response to check this replacement. The earlier rejected response remains only in the audit record.';",
    '  }',
    '};',
    parseBinding
  ].join('\n');
  text=replaceOnce(text,parseBinding,dirtyBinding,'replacement validation state');
  write(path,text);
}

{
  const path='index.html';
  let text=read(path);
  text=replaceOnce(text,
    '<li><strong>Copy or send the current instruction to ChatGPT.</strong> Keep using the same chat for that stage.</li>',
    '<li><strong>Copy or send the current instruction to ChatGPT.</strong> Keep using the same chat for the entire stage; one stage may take several messages.</li>',
    'help step one');
  text=replaceOnce(text,
    '<li><strong>Answer the agent normally.</strong> If it needs information only you can provide, it should ask short plain-language questions. Do not paste those questions into this app.</li>',
    '<li><strong>Answer the agent normally.</strong> If it needs information only you can provide, it should ask short plain-language questions. Do not paste those questions into this app or regenerate the instruction merely because the agent asked a question.</li>',
    'help step two');
  const oldToken='runtime-6e61c99da4e764b5';
  const newToken='runtime-a7f92c6d14b8e301';
  const tokenCount=text.split(oldToken).length-1;
  if(tokenCount!==8)throw new Error(`runtime cache token: expected 8 occurrences; found ${tokenCount}.`);
  text=text.split(oldToken).join(newToken);
  write(path,text);
}

{
  const path='verify-prompt-semantics.mjs';
  let text=read(path);
  const collaborationCheck="  if(!record.prompt.includes('HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE')||!record.prompt.includes('ask the smallest useful set of plain-language questions conversationally')||!record.prompt.includes('Then produce the final JSON response only.')||!record.prompt.includes('Later research, source, requirement, verification, production, or audit stages may discover a new human-only fact or decision'))issues.push('HUMAN_COLLABORATION_MODE_MISSING');";
  const collaborationReplacement=[
    collaborationCheck,
    "  if(!record.prompt.includes('HUMAN INTERACTION MODE — CONVERSATION FIRST')||!record.prompt.includes('Conversation mode: If human-only information is needed')||!record.prompt.includes('Submission mode: When enough information is available')||!record.prompt.includes('A human reply continues this same stage and this same instruction')||!record.prompt.includes('Do not require the human to generate or send a new app prompt'))issues.push('EARLY_HUMAN_INTERACTION_MODE_MISSING');"
  ].join('\n');
  text=replaceOnce(text,collaborationCheck,collaborationReplacement,'early interaction semantic check');

  const oldContradiction="  if(record.prompt.includes('Do not ask conversational questions outside the JSON response')||record.prompt.includes('Missing human-authority information requires HUMAN_INPUT_REQUIRED'))issues.push('MACHINE_FIRST_HUMAN_CLARIFICATION_CONTRADICTION');";
  const newContradiction="  if(record.prompt.includes('Do not ask conversational questions outside the JSON response')||record.prompt.includes('Missing human-authority information requires HUMAN_INPUT_REQUIRED')||record.prompt.includes('Ask for clarification only when an irreducible human fact or decision is needed now'))issues.push('MACHINE_FIRST_HUMAN_CLARIFICATION_CONTRADICTION');";
  text=replaceOnce(text,oldContradiction,newContradiction,'machine-first contradiction guard');

  const oldStageOne="    if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('return HUMAN_INPUT_REQUIRED—not DATA_PROPOSAL')||!record.prompt.includes('Ask necessary human questions conversationally before the final JSON response')||!record.prompt.includes('display and type-check those questions')||!record.prompt.includes('generate a replacement Stage 01 instruction'))issues.push('STAGE01_STRUCTURED_CLARIFICATION_MISSING');";
  const newStageOne="    if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('facts and decisions already foreseeable as necessary')||!record.prompt.includes('A later-needed unknown is not by itself a Stage 01 blocker')||!record.prompt.includes('return HUMAN_INPUT_REQUIRED—not DATA_PROPOSAL')||!record.prompt.includes('Do not use HUMAN_INPUT_REQUIRED as the first conversational turn')||!record.prompt.includes('a new app prompt is not required merely because clarification occurred'))issues.push('STAGE01_STRUCTURED_CLARIFICATION_MISSING');";
  text=replaceOnce(text,oldStageOne,newStageOne,'Stage 01 semantic check');

  const oldUi=" if(!ui.includes('Start with one thing: save the verbatim job request')||!ui.includes('one structured HUMAN_INPUT_REQUIRED response')||!ui.includes('validate your answers, version them as User Job Input, and regenerate Stage 01'))throw new Error('Stage 01 operator UI does not explain minimum intake and structured clarification.');";
  const newUi=" if(!ui.includes('Talk first; paste JSON last.')||!ui.includes('Answer agent questions')||!ui.includes('Paste final JSON')||!ui.includes('Do not copy conversational questions into this app'))throw new Error('Stage 01 operator UI does not explain the human conversation before final JSON.');\n if(!ui.includes('Replacement not evaluated.')||!ui.includes('changed after the prior validation'))throw new Error('The response UI does not distinguish edited replacement text from the prior validation result.');";
  text=replaceOnce(text,oldUi,newUi,'Stage 01 UI semantic check');
  write(path,text);
}

{
  const path='verify-ingestion.mjs';
  let text=read(path);
  const insertionPoint="const negative=(name,mutate,expectedCode)=>negativeAt(name,2,mutate,expectedCode);\n";
  const smartQuoteTest=[
    insertionPoint.trimEnd(),
    '',
    '// Smart punctuation from mobile/chat copy-paste is normalized without weakening the strict envelope contract.',
    '{',
    "  const p=project('JOB-SMART-QUOTE-JSON'),stage=2,promptRecord=savePrompt(p,stage),envelope=validEnvelope(p,stage,promptRecord);",
    "  envelope.evidence[0].content='He said \"keep the exact words\".';",
    '  const canonical=JSON.stringify(envelope);',
    "  let smart='',inString=false;",
    '  for(let i=0;i<canonical.length;i++){',
    '    const c=canonical[i];',
    "    if(!inString&&c==='\"'){smart+='“';inString=true;continue;}",
    '    if(inString){',
    "      if(c==='\\\\'&&canonical[i+1]==='\"'){smart+='\"';i++;continue;}",
    "      if(c==='\"'){smart+='”';inString=false;continue;}",
    '    }',
    '    smart+=c;',
    '  }',
    '  const prepared=ingestion.prepare(p,{stage,text:smart,promptRecord});',
    "  if(!prepared.validation.valid)throw new Error(`Smart-quoted mobile JSON was not normalized: ${JSON.stringify(prepared.validation.issues)}`);",
    "  if(prepared.project.projectData.acceptedChanges.length)throw new Error('Smart-quoted response changed canonical state before operator acceptance.');",
    '}',
    ''
  ].join('\n');
  text=replaceOnce(text,insertionPoint,smartQuoteTest,'smart quote ingestion regression');
  write(path,text);
}

for(const [path,required] of [
  ['prompt-engine.js',["closed-loop-prompt-engine/14",'HUMAN INTERACTION MODE — CONVERSATION FIRST','A later-needed unknown is not by itself a Stage 01 blocker']],
  ['app-core.js',['Talk first; paste JSON last.','Answer agent questions','Replacement not evaluated.']],
  ['index.html',['one stage may take several messages','runtime-a7f92c6d14b8e301']],
  ['verify-prompt-semantics.mjs',['EARLY_HUMAN_INTERACTION_MODE_MISSING','human conversation before final JSON']],
  ['verify-ingestion.mjs',['JOB-SMART-QUOTE-JSON','Smart-quoted mobile JSON was not normalized']]
]){
  const text=read(path);
  for(const token of required)if(!text.includes(token))throw new Error(`${path}: required repaired token missing: ${token}`);
}
