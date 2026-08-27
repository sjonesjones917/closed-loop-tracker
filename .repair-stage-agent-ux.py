from pathlib import Path
import re, hashlib

# Minimal prompt repair: real Stage 01 prompt, conversation before machine JSON, all stages human-first.
p=Path('prompt-engine.js'); s=p.read_text()
s=s.replace("const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/13';","const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/14';",1)
# Stage 01 must generate a real agent instruction even before the form is filled.
s,n=re.subn(r"\n if\(stage===1&&!String\(state\?\.job\?\.EXACT_USER_OBJECTIVE_VERBATIM\|\|''\)\.trim\(\)\)\{const error=new Error\('Stage 01 needs one thing before an instruction can be generated: enter the verbatim job request in User Job Input and save it\. Additional details may be clarified by the agent afterward\.'\);error\.code='MISSING_MINIMUM_HUMAN_INPUT';throw error;\}\n","\n",s,count=1)
assert n==1, 'Stage 01 placeholder guard not found'
# Make the human interaction rule the first substantive instruction for every stage.
m=re.search(r"HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE\n.*?Keep human-facing explanations concise, complete, accurate, and action-oriented\.\n",s,re.S)
assert m, 'Human collaboration block not found'
block=m.group(0)
s=s[:m.start()]+s[m.end():]
block=block.replace('HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE\n','HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE\nDo not start by emitting JSON when a human-only answer is needed. Talk to the human first; JSON is the final handoff to the application, not the conversation.\n',1)
needle="return `COPY BLOCK — STAGE ${String(stage).padStart(2,'0')} — ${d.title}\n\n"
assert needle in s, 'Copy-block header not found'
s=s.replace(needle,needle+block+'\n',1)
# Remove the remaining Stage 01 machine-first contradiction; HUMAN_INPUT_REQUIRED is fallback only.
pat=r"\$\{stage===1\?`STAGE 01 CLARIFICATION EXPERIENCE\n.*?\n`:\'\'\}"
replacement="""${stage===1?`STAGE 01 CLARIFICATION EXPERIENCE
Before the final Stage 01 machine response, determine whether the human-authority input plus any supplied materials actually available in this executing context are sufficient for Stage 01. When a genuinely human-only fact or decision is needed, ask it conversationally first under HUMAN COLLABORATION MODE. Never ask the human to repeat information available in supplied materials, and do not ask for facts the agent can reliably determine from authorized tools, sources, or ordinary domain knowledge. Continue the normal chat until enough information is available or the human says the item is unknown or unavailable. Use HUMAN_INPUT_REQUIRED only as the final machine fallback when a genuinely blocking human answer remains unavailable or explicitly deferred after that conversation, or when interactive conversation is unavailable. In that fallback, include only the smallest set of still-unanswered blocking questions in humanInputRequests. Do not hide missing human information behind UNKNOWN, placeholders, empty strings, or guessed assumptions.
`:''}"""
s,n=re.subn(pat,replacement,s,count=1,flags=re.S); assert n==1, 'Stage 01 clarification block not replaced'
p.write_text(s)

# Minimal phone/operator UX repair.
p=Path('app-core.js'); a=p.read_text()
old="Start with one thing: save the verbatim job request. Add files or constraints you already have; everything else can be clarified later. If more human information is needed now, the agent must return one structured HUMAN_INPUT_REQUIRED response. Paste it once and the application will show the plain-language questions here, validate your answers, version them as User Job Input, and regenerate Stage 01."
new="Stage 01 is an intake conversation. Save any facts you already know here, then send the generated instruction to ChatGPT. The agent should use supplied files and ask only the remaining human-only questions in normal chat. Stay in ChatGPT until it returns the final JSON. HUMAN_INPUT_REQUIRED in this app is only a fallback when a required answer remains unavailable or deferred, or interactive conversation was unavailable."
assert old in a, 'Stage 01 intake UI text not found'; a=a.replace(old,new,1)
old="try{return globalThis.closedLoopPromptEngine.buildPromptRecord(n,preview,promptOptions(n)).prompt;}catch(error){if(error?.code==='MISSING_MINIMUM_HUMAN_INPUT')return `STAGE 01 NEEDS YOUR JOB REQUEST\\n\\n${error.message}`;if(error?.code==='MISSING_REQUIRED_PROMPT_SCOPE')"
new="try{return globalThis.closedLoopPromptEngine.buildPromptRecord(n,preview,promptOptions(n)).prompt;}catch(error){if(error?.code==='MISSING_REQUIRED_PROMPT_SCOPE')"
assert old in a, 'Stage 01 placeholder UI catch not found'; a=a.replace(old,new,1)
old='<div class="notice"><strong>Clarify before final JSON.</strong> If the external agent asks a question, answer it there, then record the answer in User Job Input and regenerate this instruction. Do not paste or accept a placeholder DATA_PROPOSAL just to discover what information is missing.</div>'
new='<div class="notice"><strong>Talk with the agent before final JSON.</strong> Answer needed questions in ChatGPT and stay there until the agent has enough information and returns the final JSON. Return to this app for that final JSON; use the app clarification controls only when an unresolved fallback question is explicitly shown here.</div>'
assert old in a, 'Stage 01 workflow notice not found'; a=a.replace(old,new,1)
a=a.replace('<div class="operator-step"><b>1</b><span>Send instruction</span></div><div class="operator-step"><b>2</b><span>Paste full response</span></div><div class="operator-step"><b>3</b><span>Parse and validate</span></div><div class="operator-step"><b>4</b><span>Review and accept</span></div>','<div class="operator-step"><b>1</b><span>Send instruction</span></div><div class="operator-step"><b>2</b><span>Answer agent questions</span></div><div class="operator-step"><b>3</b><span>Paste final JSON</span></div><div class="operator-step"><b>4</b><span>Validate and review</span></div>',1)
old='Paste the complete strict JSON response. Parse / validate preserves the raw response first, then validates it without changing canonical project records. If the response declares returned files, attach those exact files in Authorized files for this stage before parsing.'
new='Paste only the final strict JSON from ChatGPT after the conversation is complete. If ChatGPT is still asking you questions, answer them there instead of pasting that conversation here. Parse / validate preserves the raw response first, then validates it without changing canonical project records. If the final response declares returned files, attach those exact files in Authorized files for this stage before parsing.'
assert old in a, 'Returned response help not found'; a=a.replace(old,new,1)
assert "if(!p)return validationMarkup(n);" in a; a=a.replace("if(!p)return validationMarkup(n);","if(!p)return '';",1)
old='<div class="panel"><h2 class="section-title">Returned agent response</h2>'
new="${pendingProposal()?'':validationMarkup(n)}<div class=\"panel\"><h2 class=\"section-title\">Returned agent response</h2>"
assert old in a, 'Returned response panel not found'; a=a.replace(old,new,1)
p.write_text(a)

# Update semantic tests to enforce conversation-first behavior and reject the dead-end placeholder.
p=Path('verify-prompt-semantics.mjs'); v=p.read_text()
old="if(!record.prompt.includes('HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE')||!record.prompt.includes('ask the smallest useful set of plain-language questions conversationally')||!record.prompt.includes('Then produce the final JSON response only.')||!record.prompt.includes('Later research, source, requirement, verification, production, or audit stages may discover a new human-only fact or decision'))issues.push('HUMAN_COLLABORATION_MODE_MISSING');"
new=old+"\n  if(record.prompt.indexOf('HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE')>record.prompt.indexOf('\\nROLE\\n')||!record.prompt.includes('Do not start by emitting JSON when a human-only answer is needed'))issues.push('HUMAN_COLLABORATION_MODE_TOO_LATE');"
assert old in v; v=v.replace(old,new,1)
old="if(record.prompt.includes('Do not ask conversational questions outside the JSON response')||record.prompt.includes('Missing human-authority information requires HUMAN_INPUT_REQUIRED'))issues.push('MACHINE_FIRST_HUMAN_CLARIFICATION_CONTRADICTION');"
new="if(record.prompt.includes('Do not ask conversational questions outside the JSON response')||record.prompt.includes('Missing human-authority information requires HUMAN_INPUT_REQUIRED')||record.prompt.includes('return HUMAN_INPUT_REQUIRED—not DATA_PROPOSAL')||record.prompt.includes('STAGE 01 NEEDS YOUR JOB REQUEST'))issues.push('MACHINE_FIRST_HUMAN_CLARIFICATION_CONTRADICTION');"
assert old in v; v=v.replace(old,new,1)
old="if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('return HUMAN_INPUT_REQUIRED—not DATA_PROPOSAL')||!record.prompt.includes('Ask necessary human questions conversationally before the final JSON response')||!record.prompt.includes('display and type-check those questions')||!record.prompt.includes('generate a replacement Stage 01 instruction'))issues.push('STAGE01_STRUCTURED_CLARIFICATION_MISSING');"
new="if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('ask it conversationally first under HUMAN COLLABORATION MODE')||!record.prompt.includes('Use HUMAN_INPUT_REQUIRED only as the final machine fallback'))issues.push('STAGE01_CONVERSATION_FIRST_CLARIFICATION_MISSING');"
assert old in v; v=v.replace(old,new,1)
old="if(!ui.includes('Start with one thing: save the verbatim job request')||!ui.includes('one structured HUMAN_INPUT_REQUIRED response')||!ui.includes('validate your answers, version them as User Job Input, and regenerate Stage 01'))throw new Error('Stage 01 operator UI does not explain minimum intake and structured clarification.');"
new="if(!ui.includes('Stage 01 is an intake conversation')||!ui.includes('remaining human-only questions in normal chat')||!ui.includes('HUMAN_INPUT_REQUIRED in this app is only a fallback')||!ui.includes('Answer agent questions')||!ui.includes('Paste final JSON'))throw new Error('Stage 01 operator UI does not explain the human conversation and final JSON handoff.');"
assert old in v; v=v.replace(old,new,1)
start=v.index('// Stage 01 must not create a machine instruction before the minimum human objective exists.')
end=v.index('\nlet checked=0;',start)
newblock="""// Stage 01 must always create a real conversation-capable instruction, even before the objective is known.
{
 const empty=core.createBlankState('JOB-STAGE01-MINIMUM');engine.ensureShape(empty);const first=prompts.buildPromptRecord(1,empty,{operation:'COMPLETE'});if(!first.prompt.includes('COPY BLOCK — STAGE 01 — INITIALIZE THE JOB')||!first.prompt.includes('HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE')||!first.prompt.includes('Do not start by emitting JSON when a human-only answer is needed')||!first.prompt.includes('EXACT_USER_OBJECTIVE_VERBATIM:\nUNKNOWN'))throw new Error('Blank Stage 01 must generate a real conversation-first agent instruction.');
 const patent=baseProject();patent.job.EXACT_USER_OBJECTIVE_VERBATIM='I need a patent application for my project.';const record=prompts.buildPromptRecord(1,patent,{operation:'COMPLETE'});if(!record.prompt.includes('ASCII U+0022')||!record.prompt.includes('never use typographic/curly quotation marks'))throw new Error('Strict JSON quote syntax is not explicit.');
}
"""
v=v[:start]+newblock+v[end:]
p.write_text(v)

# Browser acceptance: blank Stage 01 must be a real prompt, human loop must be visible, and validation status must be above the replacement response box.
p=Path('verify-browser.mjs'); b=p.read_text()
old="for(const token of ['Independent external sources only.','closed-loop-stage-response/2','PROMPT IDENTITY','Parse / validate response','Send instruction','Paste full response','Review and accept','Expand preview','exact controlling copy block','Complete JSON only'])"
new="for(const token of ['Independent external sources only.','closed-loop-stage-response/2','PROMPT IDENTITY','Parse / validate response','Send instruction','Answer agent questions','Paste final JSON','Validate and review','Expand preview','exact controlling copy block','Complete JSON only'])"
assert old in b; b=b.replace(old,new,1)
old="await openStage(cdp,1);text=(await snapshot(cdp)).text;for(const token of ['Start with one thing: save the verbatim job request','one structured HUMAN_INPUT_REQUIRED response','STAGE 01 NEEDS YOUR JOB REQUEST'])assert(text.includes(token),`Stage 01 clarification experience missing ${token}.`);assert(!text.includes('plain-language questions before final JSON'),'Stage 01 UI still advertises the contradictory conversational-before-JSON path.');"
new="await openStage(cdp,1);text=(await snapshot(cdp)).text;for(const token of ['Stage 01 is an intake conversation','remaining human-only questions in normal chat','COPY BLOCK — STAGE 01 — INITIALIZE THE JOB','HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE','Answer agent questions','Paste final JSON'])assert(text.includes(token),`Stage 01 human conversation experience missing ${token}.`);assert(!text.includes('STAGE 01 NEEDS YOUR JOB REQUEST'),'Stage 01 still renders the dead-end placeholder instead of a real agent prompt.');"
assert old in b; b=b.replace(old,new,1)
old="await fill(cdp,'#stage-output','{\"schema\":}');await click(cdp,'#parse-output');await waitExpr(cdp,`document.body.innerText.includes('Response rejected before canonical mutation.')`);retained=await activeProject(cdp);"
new="await fill(cdp,'#stage-output','{\"schema\":}');await click(cdp,'#parse-output');await waitExpr(cdp,`document.body.innerText.includes('Response rejected before canonical mutation.')`);assert(await evalValue(cdp,`(()=>{const v=document.querySelector('#validation-report'),o=document.querySelector('#stage-output');return Boolean(v&&o&&(v.compareDocumentPosition(o)&Node.DOCUMENT_POSITION_FOLLOWING));})()`),'Validation status must appear before the response box so a phone user can see what the currently rejected response means.');retained=await activeProject(cdp);"
assert old in b; b=b.replace(old,new,1)
p.write_text(b)

# Refresh deterministic browser cache identity for changed runtime modules.
p=Path('index.html'); h=p.read_text(); files=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']; manifest=''
for f in files:
 bb=Path(f).read_bytes(); blob=hashlib.sha1(b'blob '+str(len(bb)).encode()+b'\0'+bb).hexdigest(); manifest+=f'{f}:{blob}\n'
token='runtime-'+hashlib.sha256(manifest.encode()).hexdigest()[:16]
h,n=re.subn(r'(<script\s+defer\s+src="(?:workbook|hash|workflow-schema|workflow-engine|prompt-engine|response-ingestion|project-store|app-core)\.js\?v=)[^"]+("\s*></script>)',lambda m:m.group(1)+token+m.group(2),h)
assert n==8, f'Expected 8 runtime script tags, found {n}'
p.write_text(h)
