from pathlib import Path
import hashlib
import re


def once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    p.write_text(text.replace(old, new, 1))


# prompt-engine.js: preserve current Stage 01 behavior and close only the
# placeholder-objective and supplied-file identity boundaries.
once('prompt-engine.js',
     "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/9';",
     "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/10';",
     'prompt engine version')

once('prompt-engine.js',
     '''}
const procedures={''',
     '''}
const HUMAN_INPUT_PLACEHOLDERS=Object.freeze(new Set(['','UNKNOWN','NONE','NOT APPLICABLE','UNASSIGNED','PENDING']));
function stageOneSuppliedFiles(state){return (state?.stages?.[1]?.authorizedFiles||[]).filter(Boolean).map(file=>({artifactId:String(file.artifactId||file.id||''),filename:String(file.name||file.filename||''),mediaType:String(file.type||file.mediaType||''),byteSize:Number(file.size??file.byteSize??0),sha256:String(file.sha256||''),availability:String(file.availability||'APPLICATION-VERIFIED BROWSER BYTES')}));}
function stageOneSuppliedFileManifest(state){const files=stageOneSuppliedFiles(state);return files.length?show(files):'NONE';}
const procedures={''',
     'prompt helper insertion')

once('prompt-engine.js',
     '''${humanInputBlock(j)}

CURRENT AGENT-NORMALIZED DELIVERABLE''',
     '''${humanInputBlock(j)}

${stage===1?`APPLICATION-VERIFIED SUPPLIED FILE MANIFEST — IDENTITIES ONLY
These are the exact files currently stored and hashed by the browser for Stage 01. The manifest proves browser custody and identity, not that the external agent received the bytes. When the agent must read a supplied file, attach the exact same file to the agent message and match its filename, byte size, and SHA-256. Do not ask the human to re-enter facts that the executing agent can read from those attached bytes.
${stageOneSuppliedFileManifest(state)}

`:''}CURRENT AGENT-NORMALIZED DELIVERABLE''',
     'Stage 01 supplied-file prompt manifest')

once('prompt-engine.js',
     '''if(stage===1&&!String(state?.job?.EXACT_USER_OBJECTIVE_VERBATIM||'').trim()){const error=new Error('Stage 01 needs one thing before an instruction can be generated: enter the verbatim job request in User Job Input and save it. Additional details may be clarified by the agent afterward.');error.code='MISSING_MINIMUM_HUMAN_INPUT';throw error;}''',
     '''if(stage===1&&HUMAN_INPUT_PLACEHOLDERS.has(String(state?.job?.EXACT_USER_OBJECTIVE_VERBATIM??'').trim().toUpperCase())){const error=new Error('Stage 01 needs one thing before an instruction can be generated: enter the real verbatim job request in User Job Input and save it. UNKNOWN, NONE, PENDING, and similar placeholders are not job requests. Additional details may be clarified by the agent afterward.');error.code='MISSING_MINIMUM_HUMAN_INPUT';throw error;}''',
     'minimum Stage 01 input guard')

once('prompt-engine.js',
     '''contextManifest={stage,operation,scope,verificationBatchPlan:batchPlan,readCollections:''',
     '''contextManifest={stage,operation,scope,suppliedFileManifest:stage===1?stageOneSuppliedFiles(state):[],verificationBatchPlan:batchPlan,readCollections:''',
     'Stage 01 context manifest file identity')

# response-ingestion.js: strict rejection with exact diagnostics for the two
# malformed response families observed in real use.
once('response-ingestion.js',
     '''const QUESTION_KEYS=Object.freeze(['temporaryKey','question','whyRequired','affectedStageFields','affectedRecords','answerType','allowedValues','blocking']);''',
     '''const QUESTION_KEYS=Object.freeze(['temporaryKey','question','whyRequired','affectedStageFields','affectedRecords','answerType','allowedValues','blocking']);
const QUESTION_PROPERTY_ALIASES=Object.freeze({requestKey:'temporaryKey',whyNeeded:'whyRequired',expectedAnswer:'answerType and allowedValues',expectedResponse:'answerType and allowedValues',required:'blocking',isRequired:'blocking',field:'affectedStageFields',type:'answerType'});''',
     'question alias map')

once('response-ingestion.js',
     '''  try{envelope=JSON.parse(trimmed);}catch(error){
    const likelyTruncated=''',
     '''  try{envelope=JSON.parse(trimmed);}catch(error){
    const smartDelimiter=/(?:^|[{,]\\s*)[“”][^“”\\r\\n]+[“”]\\s*:|:\\s*[“”]/u.test(trimmed);if(smartDelimiter)throw Object.assign(new Error('Response uses typographic smart quotes as JSON delimiters. Strict JSON requires ASCII U+0022 double quotes around every member name and string value. Return the same response again with valid JSON quoting.'),{code:'TYPOGRAPHIC_JSON_QUOTES',cause:error});
    const likelyTruncated=''',
     'smart-quote parse classification')

once('response-ingestion.js',
     '''    unknownKeys(request,QUESTION_KEYS,path,issues);
    registerTemp(request.temporaryKey''',
     '''    for(const [alias,replacement] of Object.entries(QUESTION_PROPERTY_ALIASES))if(Object.prototype.hasOwnProperty.call(request,alias))issues.push(issue('INVALID_QUESTION_PROPERTY_ALIAS',`${path}/${pointerEscape(alias)}`,`Question property ${alias} is invalid. Use ${replacement}.`));
    unknownKeys(request,QUESTION_KEYS,path,issues);
    registerTemp(request.temporaryKey''',
     'question alias diagnostics')

# app-core.js: make the one-loop flow visually true, block send controls for
# placeholder input, and put input-file custody before the instruction.
once('app-core.js',
     "['EXACT_USER_OBJECTIVE_VERBATIM','Verbatim job request','textarea']",
     "['EXACT_USER_OBJECTIVE_VERBATIM','What do you need? (required)','textarea']",
     'objective label')

once('app-core.js',
     '''function currentStagePrompt(n){''',
     '''const MINIMUM_INTAKE_PLACEHOLDERS=new Set(['','UNKNOWN','NONE','NOT APPLICABLE','UNASSIGNED','PENDING']);
function stageOneMinimumIntakeIssue(){const value=String(current?.job?.EXACT_USER_OBJECTIVE_VERBATIM??'').trim();return MINIMUM_INTAKE_PLACEHOLDERS.has(value.toUpperCase())?'Enter the real job request in Project → What do you need? (required), then save User Job Input. Optional details may remain blank.':'';}
function currentStagePrompt(n){''',
     'minimum intake UI helper')

once('app-core.js',
     '''<strong>Response rejected before canonical mutation.</strong><br>${safe(v.issues).map(x=>esc(`${x.code}: ${x.message}`)).join('<br>')}''',
     '''<strong>Response rejected before canonical mutation.</strong><br>The raw response was preserved. Correct the exact errors below or save/copy the newly regenerated instruction so the agent can return a complete replacement; do not manually invent missing canonical data.<br>${safe(v.issues).map(x=>esc(`${x.code}: ${x.message}`)).join('<br>')}''',
     'validation recovery guidance')

once('app-core.js',
     '''<p class="section-intro">Actual selected bytes are stored in IndexedDB, hashed by the application, read back, and rehashed before becoming canonical artifact identities. If an agent response declares attachments, attach the exact returned files here before Parse / validate; a filename, hash claim, or code block is not file possession.</p>''',
     '''<p class="section-intro">${n===1?'Attach supplied input files before saving the Stage 01 instruction. The application stores and hashes the exact bytes and places their identities in the prompt. Browser storage does not transfer bytes to an external agent, so attach the same files to the agent message when the agent must inspect them.':'Actual selected bytes are stored in IndexedDB, hashed by the application, read back, and rehashed before becoming canonical artifact identities. If an agent response declares attachments, attach the exact returned files here before Parse / validate; a filename, hash claim, or code block is not file possession.'}</p>''',
     'Stage 01 file-transfer guidance')

once('app-core.js',
     '''responseLocked=locked||s.status==='COMPLETE',promptIntro=savedPrompt?'This exact saved instruction is the controlling request. Its identity and strict response contract are embedded below.':'This is an unsaved preview. Save or copy it before sending it to an agent; only the committed instruction identity is controlling.';return''',
     '''minimumIntakeIssue=n===1?stageOneMinimumIntakeIssue():'',promptBlocked=locked||Boolean(minimumIntakeIssue),responseLocked=locked||s.status==='COMPLETE'||Boolean(minimumIntakeIssue),promptIntro=savedPrompt?'This exact saved instruction is the controlling request. Its identity and strict response contract are embedded below.':'This is an unsaved preview. Save or copy it before sending it to an agent; only the committed instruction identity is controlling.';return''',
     'workflow minimum intake state')

once('app-core.js',
     '''${n===1?'<div class="notice"><strong>Clarify before final JSON.</strong> If the external agent asks a question, answer it there, then record the answer in User Job Input and regenerate this instruction. Do not paste or accept a placeholder DATA_PROPOSAL just to discover what information is missing.</div>':''}''',
     '''${n===1?`<div class="notice${minimumIntakeIssue?' warn':''}"><strong>${minimumIntakeIssue?'Stage 01 is not ready.':'Stage 01 uses one structured application loop.'}</strong> ${esc(minimumIntakeIssue||'Send the instruction once. The agent must return either a complete Stage 01 DATA_PROPOSAL or one valid HUMAN_INPUT_REQUIRED JSON response. Accept any question set and answer the typed controls here; the application versions the answers and regenerates Stage 01 automatically. Do not conduct a separate clarification conversation or manually rewrite JSON.')}</div>`:''}''',
     'Stage 01 one-loop notice')

once('app-core.js',
     '''${humanStageMarkup(n,locked)}${clarificationMarkup(n,locked)}''',
     '''${humanStageMarkup(n,locked)}${n===1?artifactControlMarkup(n,locked):''}${clarificationMarkup(n,locked)}''',
     'early Stage 01 file control')

once('app-core.js',
     '''<button id="save-prompt"${locked?' disabled':''}>Save instruction</button>''',
     '''<button id="save-prompt"${promptBlocked?' disabled':''}>Save instruction</button>''',
     'save prompt disabled state')

once('app-core.js',
     '''<button class="primary" id="copy-prompt"${locked?' disabled':''}>Save and copy instruction</button>''',
     '''<button class="primary" id="copy-prompt"${promptBlocked?' disabled':''}>Save and copy instruction</button>''',
     'copy prompt disabled state')

once('app-core.js',
     '''Paste the complete strict JSON response. Parse / validate preserves the raw response first, then validates it without changing canonical project records. If the response declares returned files, attach those exact files in Authorized files for this stage before parsing.''',
     '''Paste the complete strict JSON response using ordinary ASCII double quotes. The instruction defines the exact allowed question properties; aliases such as requestKey, whyNeeded, expectedAnswer, or required are rejected. Parse / validate preserves the raw response first, then validates without changing canonical project records. If the response declares returned files, attach those exact files before parsing.''',
     'returned response guidance')

once('app-core.js',
     '''${artifactControlMarkup(n,locked)}${provenanceMarkup(n)}''',
     '''${n===1?'':artifactControlMarkup(n,locked)}${provenanceMarkup(n)}''',
     'remove duplicate late Stage 01 file control')

# verify-prompt-semantics.mjs: exact residual invariants.
once('verify-prompt-semantics.mjs',
     '''const empty=core.createBlankState('JOB-STAGE01-MINIMUM');engine.ensureShape(empty);let error=null;try{prompts.buildPromptRecord(1,empty,{operation:'COMPLETE'});}catch(caught){error=caught;}if(error?.code!=='MISSING_MINIMUM_HUMAN_INPUT')throw new Error('Stage 01 still creates an UNKNOWN-objective instruction.');''',
     '''const empty=core.createBlankState('JOB-STAGE01-MINIMUM');engine.ensureShape(empty);let error=null;try{prompts.buildPromptRecord(1,empty,{operation:'COMPLETE'});}catch(caught){error=caught;}if(error?.code!=='MISSING_MINIMUM_HUMAN_INPUT')throw new Error('Stage 01 still creates a missing-objective instruction.');empty.job.EXACT_USER_OBJECTIVE_VERBATIM='UNKNOWN';error=null;try{prompts.buildPromptRecord(1,empty,{operation:'COMPLETE'});}catch(caught){error=caught;}if(error?.code!=='MISSING_MINIMUM_HUMAN_INPUT')throw new Error('Stage 01 still treats UNKNOWN as a real job request.');''',
     'UNKNOWN minimum intake semantic test')

once('verify-prompt-semantics.mjs',
     ''' if(r.prompt.includes('Treat any human-supplied files, links, references, records, or other materials as opaque authorized inputs'))throw new Error('Stage 01 still treats supplied human material as opaque instead of usable intake.');
}''',
     ''' if(r.prompt.includes('Treat any human-supplied files, links, references, records, or other materials as opaque authorized inputs'))throw new Error('Stage 01 still treats supplied human material as opaque instead of usable intake.');
 p.stages[1].authorizedFiles=[{artifactId:'ARTIFACT-INPUT-1',name:'MAINFRAME_INVENTION_DISCLOSURE.zip',type:'application/zip',size:48203,sha256:'a'.repeat(64),availability:'BYTES_PERSISTED_AND_VERIFIED'}];
 const withFile=prompts.buildPromptRecord(1,p);
 if(!withFile.prompt.includes('APPLICATION-VERIFIED SUPPLIED FILE MANIFEST')||!withFile.prompt.includes('MAINFRAME_INVENTION_DISCLOSURE.zip')||!withFile.prompt.includes('ARTIFACT-INPUT-1')||!withFile.contextManifest.suppliedFileManifest?.length)throw new Error('Stage 01 does not bind verified supplied-file identity into the prompt and context signature.');
}''',
     'supplied-file semantic test')

once('verify-prompt-semantics.mjs',
     '''if(!ui.includes('Start with one thing: save the verbatim job request')||!ui.includes('one structured HUMAN_INPUT_REQUIRED response')||!ui.includes('validate your answers, version them as User Job Input, and regenerate Stage 01'))throw new Error('Stage 01 operator UI does not explain minimum intake and structured clarification.');''',
     '''if(!ui.includes('Start with one thing: save the verbatim job request')||!ui.includes('Stage 01 uses one structured application loop.')||!ui.includes('application versions the answers and regenerates Stage 01 automatically')||!ui.includes('What do you need? (required)'))throw new Error('Stage 01 operator UI does not explain the single structured clarification loop and minimum intake.');if(ui.includes('If the external agent asks a question, answer it there'))throw new Error('Stage 01 UI still directs a conflicting side conversation.');''',
     'Stage 01 UI semantic test')

# verify-ingestion.mjs: reproduce the exact invalid response families.
p = Path('verify-ingestion.mjs')
s = p.read_text()
marker = '// HUMAN_INPUT_REQUIRED must contain actual blocking human-authority work.'
addition = '''// Plausible but undeclared question aliases fail closed with exact correction guidance.
{
 const p=project('JOB-PATENT-QUESTION-ALIASES'),stage=1,promptRecord=savePrompt(p,stage),envelope={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:promptRecord.operation,promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},scope:promptRecord.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{requestKey:'HIR-01',question:'Which patent filing route is required?',whyNeeded:'The route changes filing formalities.',expectedAnswer:'Choose a route.',required:true}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};
 const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(envelope),promptRecord});
 if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='INVALID_QUESTION_PROPERTY_ALIAS'&&i.message.includes('temporaryKey'))||!prepared.validation.issues.some(i=>i.code==='INVALID_QUESTION_PROPERTY_ALIAS'&&i.message.includes('whyRequired'))||!prepared.validation.issues.some(i=>i.code==='INVALID_QUESTION_PROPERTY_ALIAS'&&i.message.includes('blocking')))throw new Error(`Question aliases did not produce exact correction diagnostics: ${JSON.stringify(prepared.validation.issues)}`);
 if(prepared.project.projectData.acceptedChanges.length)throw new Error('Alias-shaped clarification mutated canonical state.');negativeCount++;
}
// Typographic JSON delimiters are classified precisely and preserved without mutation.
{
 const p=project('JOB-PATENT-SMART-QUOTES'),stage=1,promptRecord=savePrompt(p,stage),envelope={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:promptRecord.operation,promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},scope:promptRecord.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'question-1',question:'Which genuinely blocking human decision is missing?',whyRequired:'The job cannot be defined without it.',affectedStageFields:[],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:true}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]},smart=JSON.stringify(envelope).replaceAll('"','“');
 const prepared=ingestion.prepare(p,{stage,text:smart,promptRecord});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='TYPOGRAPHIC_JSON_QUOTES'))throw new Error(`Smart-quote response was not classified precisely: ${JSON.stringify(prepared.validation.issues)}`);if(prepared.project.projectData.acceptedChanges.length)throw new Error('Smart-quote response mutated canonical state.');negativeCount++;
}

'''
if s.count(marker) != 1:
    raise SystemExit(f'ingestion insertion marker count={s.count(marker)}')
p.write_text(s.replace(marker, addition + marker, 1))

# verify-browser.mjs: update the existing new-job assertion and insert the exact
# patent Stage 01 acceptance cycle before the existing import test.
once('verify-browser.mjs',
     ''' await openStage(cdp,1);text=(await snapshot(cdp)).text;for(const token of ['Start with one thing: save the verbatim job request','one structured HUMAN_INPUT_REQUIRED response','STAGE 01 NEEDS YOUR JOB REQUEST'])assert(text.includes(token),`Stage 01 clarification experience missing ${token}.`);assert(!text.includes('plain-language questions before final JSON'),'Stage 01 UI still advertises the contradictory conversational-before-JSON path.');
 await click(cdp,'[data-view="Project"]');text=(await snapshot(cdp)).text;for(const token of ['Output format (optional)','You do not need to know the final file format in advance','A specification substitute requires human confirmation'])assert(text.includes(token),`Project intake artifact-generation guidance missing ${token}.`);''',
     ''' await openStage(cdp,1);text=(await snapshot(cdp)).text;for(const token of ['Start with one thing: save the verbatim job request','Stage 01 is not ready.','STAGE 01 NEEDS YOUR JOB REQUEST'])assert(text.includes(token),`Stage 01 minimum-intake experience missing ${token}.`);assert(await evalValue(cdp,`document.querySelector('#save-prompt')?.disabled&&document.querySelector('#copy-prompt')?.disabled`),'Stage 01 exposes send controls before a real job request exists.');assert(!text.includes('If the external agent asks a question, answer it there'),'Stage 01 UI still advertises a conflicting side conversation.');
 await click(cdp,'[data-view="Project"]');text=(await snapshot(cdp)).text;for(const token of ['What do you need? (required)','Output format (optional)','You do not need to know the final file format in advance','A specification substitute requires human confirmation'])assert(text.includes(token),`Project intake guidance missing ${token}.`);''',
     'browser minimum intake assertion')

p = Path('verify-browser.mjs')
s = p.read_text()
marker = ' // Malformed import does not destroy projects.'
addition = ''' // Real patent-intake Stage 01: one objective + supplied file -> usable DATA_PROPOSAL without premature filing questions.
 await fill(cdp,'[data-job="EXACT_USER_OBJECTIVE_VERBATIM"]','I need a patent application for my project.');await click(cdp,'#save-job');await openStage(cdp,1);text=(await snapshot(cdp)).text;for(const token of ['Stage 01 uses one structured application loop.','Do not require jurisdiction, filing route, inventorship, ownership, priority/continuity','temporaryKey, question, whyRequired, affectedStageFields, affectedRecords, answerType, allowedValues, blocking'])assert(text.includes(token),`Stage 01 patent intake prompt/UI missing ${token}.`);
 await evalValue(cdp,`(()=>{const input=document.querySelector('#stage-files'),dt=new DataTransfer();dt.items.add(new File(['patent invention disclosure'],'MAINFRAME_INVENTION_DISCLOSURE.zip',{type:'application/zip'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);await waitExpr(cdp,`document.body.innerText.includes('MAINFRAME_INVENTION_DISCLOSURE.zip')`,20000);text=(await snapshot(cdp)).text;assert(text.includes('APPLICATION-VERIFIED SUPPLIED FILE MANIFEST')&&text.includes('MAINFRAME_INVENTION_DISCLOSURE.zip'),'Stage 01 prompt did not bind the supplied invention-disclosure identity.');
 await click(cdp,'#save-prompt');let patent=await activeProject(cdp),stageOnePrompt=patent.projectData.generatedPrompts.filter(x=>Number(x.stage)===1&&!x.invalidatedBy).at(-1);assert(stageOnePrompt?.prompt.includes('I need a patent application for my project.'),'Stage 01 prompt omitted the verbatim patent request.');const stageOneEnvelope={schema:'closed-loop-stage-response/2',jobId:patent.job.JOB_ID,stage:1,operation:stageOnePrompt.operation||'COMPLETE',promptIdentity:{instructionId:stageOnePrompt.instructionId,bodySha256:stageOnePrompt.bodySha256||stageOnePrompt.sha256,contractSha256:stageOnePrompt.contractSha256,contextSignature:stageOnePrompt.contextSignature},scope:stageOnePrompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{EXACT_DELIVERABLE_REQUESTED:'A complete patent-application drafting package based on the supplied invention disclosure; later stages will resolve jurisdiction-specific filing facts when first required.',ASSUMPTIONS:'No inventorship, ownership, priority, disclosure, jurisdiction, filing route, or filing-status fact is assumed.',UNKNOWN_INFORMATION:'Jurisdiction-specific filing facts and legal-authority details remain unresolved for the earliest later stage that requires them.',INPUT_SET_CONTENTS:'The verbatim patent-application request plus the application-verified supplied invention-disclosure file identity.'},records:{},evidence:[{temporaryKey:'stage-one-evidence',kind:'HUMAN_INPUT',description:'Stage 01 job-definition evidence',location:'Authorized User Job Input and supplied-file manifest',content:'The human requested a patent application for the project and supplied an invention-disclosure file.'}],unresolved:[],warnings:[],attachments:[]};await fill(cdp,'#stage-output',JSON.stringify(stageOneEnvelope));await click(cdp,'#parse-output');await waitExpr(cdp,`document.body.innerText.includes('Proposed extracted changes')`);await click(cdp,'#accept-proposal');await waitExpr(cdp,`document.body.innerText.includes('A complete patent-application drafting package')`);patent=await activeProject(cdp);assert(patent.projectData.acceptedChanges.some(x=>Number(x.stage)===1&&!x.invalidatedBy),'Patent Stage 01 DATA_PROPOSAL was not accepted.');
'''
if s.count(marker) != 1:
    raise SystemExit(f'browser patent insertion marker count={s.count(marker)}')
p.write_text(s.replace(marker, addition + marker, 1))

# Refresh the one shared runtime identity after runtime-source changes.
runtime = ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def git_blob(path):
    data = Path(path).read_bytes()
    return hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()
manifest = ''.join(f'{name}:{git_blob(name)}\n' for name in runtime).encode()
token = 'runtime-' + hashlib.sha256(manifest).hexdigest()[:16]
p = Path('index.html')
html = p.read_text()
html, count = re.subn(r'(src="(?:workbook|hash|workflow-schema|workflow-engine|prompt-engine|response-ingestion|project-store|app-core)\.js\?v=)runtime-[a-f0-9]{16}(\")', rf'\g<1>{token}\2', html)
if count != 8:
    raise SystemExit(f'expected 8 runtime token replacements, found {count}')
p.write_text(html)
