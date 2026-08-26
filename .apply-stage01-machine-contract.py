from pathlib import Path
import hashlib
import re


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    p.write_text(text.replace(old, new, 1))


def replace_between(path, start, end, replacement, label):
    p = Path(path)
    text = p.read_text()
    first = text.find(start)
    if first < 0:
        raise SystemExit(f"{label}: start anchor missing")
    last = text.find(end, first)
    if last < 0:
        raise SystemExit(f"{label}: end anchor missing")
    p.write_text(text[:first] + replacement + text[last:])


# prompt-engine.js: one machine-readable clarification path, exact auxiliary schemas,
# minimum Stage 01 intake, and exact supplied-file identity in the controlling prompt.
p = Path('prompt-engine.js')
s = p.read_text()
s = s.replace("const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/8';", "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/9';", 1)
helper_anchor = "}\nconst procedures={"
helper = """}
const HUMAN_INPUT_PLACEHOLDERS=Object.freeze(new Set(['','UNKNOWN','NONE','NOT APPLICABLE','UNASSIGNED','PENDING']));
function stageOneSuppliedFiles(state){return (state?.stages?.[1]?.authorizedFiles||[]).filter(Boolean).map(file=>({artifactId:String(file.artifactId||file.id||''),filename:String(file.name||file.filename||''),mediaType:String(file.type||file.mediaType||''),byteSize:Number(file.size??file.byteSize??0),sha256:String(file.sha256||''),availability:String(file.availability||'APPLICATION-VERIFIED BROWSER BYTES')}));}
function stageOneSuppliedFileManifest(state){const files=stageOneSuppliedFiles(state);return files.length?show(files):'NONE';}
function assertMinimumHumanIntake(stage,state){if(Number(stage)!==1)return;const objective=String(state?.job?.EXACT_USER_OBJECTIVE_VERBATIM??'').trim();if(HUMAN_INPUT_PLACEHOLDERS.has(objective.toUpperCase())){const error=new Error('Stage 01 cannot generate a controlling instruction until the human saves a verbatim job request. Enter one sentence describing the requested work in Project → What do you need? (required), then save User Job Input. Optional details may remain blank.');error.code='MISSING_MINIMUM_HUMAN_INTAKE';throw error;}}
const procedures={"""
if s.count(helper_anchor) != 1:
    raise SystemExit('prompt helper anchor mismatch')
s = s.replace(helper_anchor, helper, 1)
start = s.find("1:'Initialize only this current job")
end = s.find("\n2:'Build the complete source", start)
if start < 0 or end < 0:
    raise SystemExit('Stage 01 procedure anchors missing')
new_stage1 = """1:'Initialize only this current job from the exact authorized human input. Preserve the verbatim objective, requested deliverable, supplied-material boundary, format preferences, temporal or geographic scope, user-supplied authority, available tools, prohibitions, explicit requirements, assumptions, unresolved unknowns, and genuine human decisions needed to define the work. Stage 01 owns job definition and clarification only. Treat supplied files, links, references, and records as opaque authorized inputs here: identify their existence and intended role, but do not inspect, research, classify authority, derive requirements, design verification, produce the final deliverable, file, submit, manufacture, deploy, or perform later-stage work. First decide whether the current human-authority input is sufficient for one complete reliable Stage 01 proposal. If any material human-only fact, choice, constraint, deliverable boundary, jurisdiction, engineering parameter, filing fact, or scope decision is missing, ambiguous, vague, or inconsistent, return HUMAN_INPUT_REQUIRED immediately as the single strict JSON response for this turn. Do not ask questions as prose outside the response envelope and do not require a separate agent conversation. Include the smallest complete set of all currently knowable blocking questions, using the exact humanInputRequests member names and value types in the response contract. The application will render those questions as typed controls, version the answers, invalidate this prompt, and generate a replacement Stage 01 prompt containing the answers. Return DATA_PROPOSAL only when the current authorized input is sufficient without guessing. Normalize the intended deliverable and identify later capability needs without performing later work. Determine the intended artifact set and suitable formats; do not require the human to know specialist formats unless a genuine human decision is necessary. Distinguish future artifact-generation capability from downstream import, build, simulation, manufacturing, filing, deployment, or physical verification. Propose a specification substitute for later human confirmation only when the requested artifact itself cannot reliably be generated because required inputs, generation capability, or manageable scale are unavailable. The application owns JOB_ID and controlled input identity; do not assign them and do not create cross-job templates or instructions.',"""
s = s[:start] + new_stage1 + s[end:]
member_anchor = "function responseContractDescriptor(stage,operation){"
member_schema = """const RESPONSE_MEMBER_SCHEMAS=Object.freeze({
 humanInputRequest:{itemKeys:['temporaryKey','question','whyRequired','affectedStageFields','affectedRecords','answerType','allowedValues','blocking'],requiredKeys:['temporaryKey','question','whyRequired','affectedStageFields','affectedRecords','answerType','allowedValues','blocking'],fieldRules:{temporaryKey:'non-empty unique response-local STRING',question:'non-empty STRING',whyRequired:'non-empty STRING explaining why the current stage cannot proceed reliably',affectedStageFields:'STRING_ARRAY containing only current-stage field names; [] when no exact field applies',affectedRecords:'STRING_ARRAY containing only current-operation collection names; [] when no exact collection applies',answerType:'exact enum TEXT | LONG_TEXT | BOOLEAN | NUMBER | CHOICE | MULTI_CHOICE | DATE | FILE_REFERENCE',allowedValues:'STRING_ARRAY; non-empty unique strings only for CHOICE or MULTI_CHOICE, otherwise []',blocking:'BOOLEAN; HUMAN_INPUT_REQUIRED requires at least one true'}},
 evidence:{itemKeys:['temporaryKey','kind','description','authorityType','sourceRef','location','content','attachmentRef','notes'],requiredKeys:['temporaryKey','kind','description','location','content'],fieldRules:{temporaryKey:'non-empty unique response-local STRING',kind:'non-empty STRING',description:'non-empty STRING',authorityType:'optional STRING',sourceRef:'optional relationship reference with exactly one of tempKey or recordId',location:'non-empty STRING',content:'non-empty STRING',attachmentRef:'optional relationship reference with exactly one of tempKey or recordId',notes:'optional STRING'}},
 unresolved:{itemKeys:['temporaryKey','kind','description','whyBlocking','affectedStageFields','affectedRecords','blocking'],requiredKeys:['temporaryKey','kind','description','whyBlocking','affectedStageFields','affectedRecords','blocking'],fieldRules:{temporaryKey:'non-empty unique response-local STRING',kind:'exact controlled unresolved kind',description:'non-empty STRING',whyBlocking:'non-empty STRING',affectedStageFields:'STRING_ARRAY',affectedRecords:'STRING_ARRAY',blocking:'BOOLEAN'}},
 warning:{itemKeys:['code','message','path'],requiredKeys:['code','message','path'],fieldRules:{code:'non-empty STRING',message:'non-empty STRING',path:'non-empty JSON Pointer STRING'}},
 attachment:{itemKeys:['temporaryKey','filename','mediaType','byteSize','sha256','required'],requiredKeys:['temporaryKey','filename','mediaType','byteSize','sha256','required'],fieldRules:{temporaryKey:'non-empty unique response-local STRING',filename:'exact returned filename STRING',mediaType:'exact media type STRING',byteSize:'non-negative INTEGER from the claimed file',sha256:'64-character lowercase hexadecimal SHA-256 claim',required:'BOOLEAN'}},
 relationshipReference:{itemKeys:['tempKey','recordId'],rule:'Provide exactly one of tempKey or recordId.'}
});
function responseContractDescriptor(stage,operation){"""
if s.count(member_anchor) != 1:
    raise SystemExit('member schema anchor mismatch')
s = s.replace(member_anchor, member_schema, 1)
return_start = s.find(" return {contractVersion:'closed-loop-response-contract/2.2'")
return_end_marker = "\n}\nfunction responseContract(stage,operation"
return_end = s.find(return_end_marker, return_start)
if return_start < 0 or return_end < 0:
    raise SystemExit('response contract return anchors missing')
new_return = """ return {contractVersion:'closed-loop-response-contract/2.3',schema:schema.RESPONSE_SCHEMA,stage,operation,responseTypes:[...schema.RESPONSE_TYPES],scopeRequirements:[...(op?.scopeRequirements||contract.scopeRequirements)],agentStageFields:[...stageFields],agentWritableCollections:[...writable],stageData,records,resourceLimits:{...contract.resourceLimits},envelope:{topLevelKeys:['schema','jobId','stage','operation','promptIdentity','scope','responseType','humanInputRequests','stageData','records','evidence','unresolved','warnings','attachments'],recordKeys:['tempKey','targetId','fields','relationships','evidenceRefs','notes'],memberSchemas:RESPONSE_MEMBER_SCHEMAS,recordIdentityRule:'Exactly one of tempKey or targetId; UPDATE_RESERVED uses targetId and new proposals use tempKey.',relationshipReferenceRule:'Exactly one of tempKey or recordId and target collection must match the declared relationship.',evidenceRule:'Evidence references must resolve completely; claimed source or attachment references may not resolve to UNKNOWN.',responseTypeRules:{DATA_PROPOSAL:'May contain permitted agent stageData, records, evidence, attachments, and nonblocking warnings; blocking humanInputRequests or unresolved items are prohibited.',HUMAN_INPUT_REQUIRED:'stageData and records must be empty; structured humanInputRequests carry the blocking questions and every item uses the exact humanInputRequest member schema.',BLOCKED:'stageData, records, and humanInputRequests must be empty; structured unresolved items carry the blocker.',EXECUTION_FAILED:'Canonical stageData is prohibited; structured failure information and evidence identify the failed current execution.'},attachmentRule:'Declared required attachments must match operator-supplied filename, byteSize, and application-computed SHA-256 before acceptance.'}};"""
s = s[:return_start] + new_return + s[return_end:]
input_anchor = "${humanInputBlock(j)}\n\nCURRENT AGENT-NORMALIZED DELIVERABLE"
input_replacement = "${humanInputBlock(j)}\n\n${stage===1?`APPLICATION-VERIFIED SUPPLIED FILE MANIFEST — IDENTITIES ONLY\nThese are the exact files the browser has stored and hashed for Stage 01. Their contents remain opaque at this stage. Browser-local bytes are not transferred to the external agent automatically; attach the exact same files to the agent message when the agent must use them.\n${stageOneSuppliedFileManifest(state)}\n\n`:''}CURRENT AGENT-NORMALIZED DELIVERABLE"
if s.count(input_anchor) != 1:
    raise SystemExit('Stage 01 file manifest anchor mismatch')
s = s.replace(input_anchor, input_replacement, 1)
clarification_start = s.find("${stage===1?`STAGE 01 CLARIFICATION EXPERIENCE")
clarification_end = s.find("\n`:''}", clarification_start)
if clarification_start < 0 or clarification_end < 0:
    raise SystemExit('Stage 01 clarification block anchors missing')
clarification_end += len("\n`:''}")
new_clarification = """${stage===1?`STAGE 01 RESPONSE DECISION — ONE APPLICATION LOOP
Return exactly one strict JSON envelope on this turn. When human-only information is missing, use HUMAN_INPUT_REQUIRED now; do not ask questions in surrounding prose and do not start a separate clarification conversation. The application will preserve the response, display the typed questions, save the human answers, and generate the next Stage 01 instruction automatically. Ask together every currently knowable blocking question, but do not ask optional questions or repeat answered questions.
`:''}"""
s = s[:clarification_start] + new_clarification + s[clarification_end:]
decision_anchor = "\n\nMANDATORY RESPONSE RULES\n"
decision_block = """

RESPONSE TYPE DECISION — USE THE EXACT CONTRACT KEYS
- Missing human-authority information: return HUMAN_INPUT_REQUIRED now. Every humanInputRequests item must use exactly: temporaryKey, question, whyRequired, affectedStageFields, affectedRecords, answerType, allowedValues, blocking.
- Do not use aliases such as requestKey, whyNeeded, expectedAnswer, expectedResponse, required, isRequired, field, or type. They are invalid properties.
- Exact example of one correctly shaped request item; replace its content but preserve the keys and value types: {\"temporaryKey\":\"question-1\",\"question\":\"State the missing human fact.\",\"whyRequired\":\"Explain why the current stage cannot proceed reliably without it.\",\"affectedStageFields\":[],\"affectedRecords\":[],\"answerType\":\"TEXT\",\"allowedValues\":[],\"blocking\":true}
- Sufficient information: return DATA_PROPOSAL with only permitted agent-owned stageData/records and required evidence.
- Missing or contradictory canonical application context: return BLOCKED with structured unresolved items. An attempted tool or execution failure uses EXECUTION_FAILED.

MANDATORY RESPONSE RULES
"""
if s.count(decision_anchor) != 1:
    raise SystemExit('response decision anchor mismatch')
s = s.replace(decision_anchor, decision_block, 1)
quote_rule = "- Return exactly one JSON object and no Markdown fence, preamble, or trailing prose."
quote_replacement = quote_rule + "\n- Use only ASCII U+0022 double-quote characters as JSON key and string delimiters. Typographic smart quotes are invalid JSON. Escape any literal U+0022 character inside a string value as \\\"."
if s.count(quote_rule) != 1:
    raise SystemExit('ASCII JSON rule anchor mismatch')
s = s.replace(quote_rule, quote_replacement, 1)
build_anchor = " const stage=Number(stageOrDefinition?.number||stageOrDefinition);if(!Number.isInteger(stage)||stage<1||stage>schema.STAGE_COUNT)throw new Error(`Stage must be 1 through ${schema.STAGE_COUNT}.`);"
build_replacement = build_anchor + "\n assertMinimumHumanIntake(stage,state);"
if s.count(build_anchor) != 1:
    raise SystemExit('minimum intake build anchor mismatch')
s = s.replace(build_anchor, build_replacement, 1)
manifest_anchor = "contextManifest={stage,operation,scope,verificationBatchPlan:batchPlan,"
manifest_replacement = "contextManifest={stage,operation,scope,suppliedFileManifest:stage===1?stageOneSuppliedFiles(state):[],verificationBatchPlan:batchPlan,"
if s.count(manifest_anchor) != 1:
    raise SystemExit('context manifest anchor mismatch')
s = s.replace(manifest_anchor, manifest_replacement, 1)
p.write_text(s)

# response-ingestion.js: preserve strictness but classify the exact malformed outputs
# the user received and explain the valid question keys.
p = Path('response-ingestion.js')
s = p.read_text()
alias_anchor = "const QUESTION_KEYS=Object.freeze(['temporaryKey','question','whyRequired','affectedStageFields','affectedRecords','answerType','allowedValues','blocking']);"
alias_replacement = alias_anchor + "\nconst QUESTION_PROPERTY_ALIASES=Object.freeze({requestKey:'temporaryKey',whyNeeded:'whyRequired',expectedAnswer:'answerType and allowedValues',expectedResponse:'answerType and allowedValues',required:'blocking',isRequired:'blocking',field:'affectedStageFields',type:'answerType'});"
if s.count(alias_anchor) != 1:
    raise SystemExit('question alias anchor mismatch')
s = s.replace(alias_anchor, alias_replacement, 1)
parse_anchor = "  try{envelope=JSON.parse(trimmed);}catch(error){\n    const likelyTruncated="
parse_replacement = "  try{envelope=JSON.parse(trimmed);}catch(error){\n    if(/[“”]/u.test(trimmed))throw Object.assign(new Error('Response uses typographic smart quotes. Strict JSON requires ASCII U+0022 double quotes for keys and string delimiters. Return the same envelope again with valid JSON quoting.'),{code:'TYPOGRAPHIC_JSON_QUOTES',cause:error});\n    const likelyTruncated="
if s.count(parse_anchor) != 1:
    raise SystemExit('smart quote parse anchor mismatch')
s = s.replace(parse_anchor, parse_replacement, 1)
question_anchor = "    unknownKeys(request,QUESTION_KEYS,path,issues);\n    registerTemp(request.temporaryKey"
question_replacement = "    for(const [alias,replacement] of Object.entries(QUESTION_PROPERTY_ALIASES))if(Object.prototype.hasOwnProperty.call(request,alias))issues.push(issue('INVALID_QUESTION_PROPERTY_ALIAS',`${path}/${pointerEscape(alias)}`,`Question property ${alias} is invalid. Use ${replacement}.`));\n    unknownKeys(request,QUESTION_KEYS,path,issues);\n    registerTemp(request.temporaryKey"
if s.count(question_anchor) != 1:
    raise SystemExit('question alias validation anchor mismatch')
s = s.replace(question_anchor, question_replacement, 1)
p.write_text(s)

# app-core.js: do not let the operator send an empty Stage 01 prompt, put supplied
# files before the prompt, and make the application-owned clarification loop explicit.
p = Path('app-core.js')
s = p.read_text()
s = s.replace("['EXACT_USER_OBJECTIVE_VERBATIM','Verbatim job request','textarea']", "['EXACT_USER_OBJECTIVE_VERBATIM','What do you need? (required)','textarea']", 1)
helper_anchor = "function currentStagePrompt(n){"
helper = """const MINIMUM_INTAKE_PLACEHOLDERS=new Set(['','UNKNOWN','NONE','NOT APPLICABLE','UNASSIGNED','PENDING']);
function stageOneMinimumIntakeIssue(){const value=String(current?.job?.EXACT_USER_OBJECTIVE_VERBATIM??'').trim();return MINIMUM_INTAKE_PLACEHOLDERS.has(value.toUpperCase())?'Enter one sentence describing what you need in Project → What do you need? (required), then save User Job Input. Optional fields may remain blank.':'';}
function currentStagePrompt(n){"""
if s.count(helper_anchor) != 1:
    raise SystemExit('app minimum intake helper anchor mismatch')
s = s.replace(helper_anchor, helper, 1)
old_catch = "if(error?.code==='MISSING_REQUIRED_PROMPT_SCOPE')return `CONTROLLING INSTRUCTION UNAVAILABLE\\n\\n${error.message}\\n\\nReserve/select the exact execution lane shown for this stage, then save or copy the instruction.`;throw error;"
new_catch = "if(['MISSING_REQUIRED_PROMPT_SCOPE','MISSING_MINIMUM_HUMAN_INTAKE'].includes(error?.code))return `CONTROLLING INSTRUCTION NOT READY\\n\\n${error.message}`;throw error;"
if s.count(old_catch) != 1:
    raise SystemExit('currentStagePrompt catch anchor mismatch')
s = s.replace(old_catch, new_catch, 1)
old_human = "Supply the smallest genuine human-owned intake. If the agent needs more information, it should ask you concise plain-language questions before final JSON. Record those answers in User Job Input and regenerate Stage 01. If the agent instead returns HUMAN_INPUT_REQUIRED, paste it once and the application will render the typed questions here."
new_human = "Start with one sentence describing what you need. Optional details may remain blank. Send the Stage 01 instruction once; the agent must return either complete Stage 01 data or a valid HUMAN_INPUT_REQUIRED JSON envelope. After you accept a question set, the application renders typed questions here, versions your answers, and regenerates Stage 01 automatically. Do not manually rewrite the agent JSON or maintain a separate clarification conversation."
if s.count(old_human) != 1:
    raise SystemExit('Stage 01 human intake text anchor mismatch')
s = s.replace(old_human, new_human, 1)
validation_old = "<strong>Response rejected before canonical mutation.</strong><br>${safe(v.issues).map(x=>esc(`${x.code}: ${x.message}`)).join('<br>')}"
validation_new = "<strong>Response rejected before canonical mutation.</strong><br>The exact errors below are included in the next regenerated instruction. Save and copy that instruction to request a corrected response; do not manually repair agent data.<br>${safe(v.issues).map(x=>esc(`${x.code}: ${x.message}`)).join('<br>')}"
if s.count(validation_old) != 1:
    raise SystemExit('validation recovery text anchor mismatch')
s = s.replace(validation_old, validation_new, 1)
artifact_intro = "<p class=\"section-intro\">Actual selected bytes are stored in IndexedDB, hashed by the application, read back, and rehashed before becoming canonical artifact identities. If an agent response declares attachments, attach the exact returned files here before Parse / validate; a filename, hash claim, or code block is not file possession.</p>"
artifact_replacement = "<p class=\"section-intro\">${n===1?'Attach supplied input files before generating Stage 01. The application stores and hashes the exact bytes and lists their identities in the prompt. You must also attach the same bytes to the external agent because browser-local storage does not transfer files automatically.':'Actual selected bytes are stored in IndexedDB, hashed by the application, read back, and rehashed before becoming canonical artifact identities. If an agent response declares attachments, attach the exact returned files here before Parse / validate; a filename, hash claim, or code block is not file possession.'}</p>"
if s.count(artifact_intro) != 1:
    raise SystemExit('artifact intro anchor mismatch')
s = s.replace(artifact_intro, artifact_replacement, 1)
workflow_start = "promptIntro=savedPrompt?'This exact saved instruction is the controlling request. Its identity and strict response contract are embedded below.':'This is an unsaved preview. Save or copy it before sending it to an agent; only the committed instruction identity is controlling.';return"
workflow_replacement = "promptIntro=savedPrompt?'This exact saved instruction is the controlling request. Its identity and strict response contract are embedded below.':'This is an unsaved preview. Save or copy it before sending it to an agent; only the committed instruction identity is controlling.',minimumIntakeIssue=n===1?stageOneMinimumIntakeIssue():'',promptBlocked=locked||Boolean(minimumIntakeIssue);return"
if s.count(workflow_start) != 1:
    raise SystemExit('workflow variable anchor mismatch')
s = s.replace(workflow_start, workflow_replacement, 1)
old_notice = "${n===1?'<div class=\"notice\"><strong>Clarify before final JSON.</strong> If the external agent asks a question, answer it there, then record the answer in User Job Input and regenerate this instruction. Do not paste or accept a placeholder DATA_PROPOSAL just to discover what information is missing.</div>':''}"
new_notice = "${n===1?`<div class=\"notice${minimumIntakeIssue?' warn':''}\"><strong>${minimumIntakeIssue?'Stage 01 is not ready.':'Stage 01 uses structured clarification.'}</strong> ${esc(minimumIntakeIssue||'Send the instruction once. The agent must return either complete Stage 01 data or a valid HUMAN_INPUT_REQUIRED JSON response. Accept the question set, answer the typed controls here, and the application regenerates Stage 01 automatically. Do not conduct a separate clarification conversation or manually rewrite JSON.')}</div>`:''}"
if s.count(old_notice) != 1:
    raise SystemExit('Stage 01 notice anchor mismatch')
s = s.replace(old_notice, new_notice, 1)
early_anchor = "${humanStageMarkup(n,locked)}${clarificationMarkup(n,locked)}"
early_replacement = "${humanStageMarkup(n,locked)}${n===1?artifactControlMarkup(n,locked):''}${clarificationMarkup(n,locked)}"
if s.count(early_anchor) != 1:
    raise SystemExit('early Stage 01 artifact anchor mismatch')
s = s.replace(early_anchor, early_replacement, 1)
save_button = "<button id=\"save-prompt\"${locked?' disabled':''}>Save instruction</button>"
copy_button = "<button class=\"primary\" id=\"copy-prompt\"${locked?' disabled':''}>Save and copy instruction</button>"
if s.count(save_button) != 1 or s.count(copy_button) != 1:
    raise SystemExit('prompt button anchors mismatch')
s = s.replace(save_button, "<button id=\"save-prompt\"${promptBlocked?' disabled':''}>Save instruction</button>", 1)
s = s.replace(copy_button, "<button class=\"primary\" id=\"copy-prompt\"${promptBlocked?' disabled':''}>Save and copy instruction</button>", 1)
response_intro = "Paste the complete strict JSON response. Parse / validate preserves the raw response first, then validates it without changing canonical project records. If the response declares returned files, attach those exact files in Authorized files for this stage before parsing."
response_replacement = "Paste the complete strict JSON response using ASCII U+0022 double quotes. The prompt defines the exact allowed member names; aliases such as requestKey, whyNeeded, expectedAnswer, or required are rejected. Parse / validate preserves the raw response first, then validates it without changing canonical project records. If the response declares returned files, attach those exact files before parsing."
if s.count(response_intro) != 1:
    raise SystemExit('returned response guidance anchor mismatch')
s = s.replace(response_intro, response_replacement, 1)
late_artifact = "${artifactControlMarkup(n,locked)}${provenanceMarkup(n)}"
late_replacement = "${n===1?'':artifactControlMarkup(n,locked)}${provenanceMarkup(n)}"
if s.count(late_artifact) != 1:
    raise SystemExit('late artifact anchor mismatch')
s = s.replace(late_artifact, late_replacement, 1)
p.write_text(s)

# verify-prompt-semantics.mjs: make schema discoverability and the one-loop semantics
# first-class acceptance conditions.
p = Path('verify-prompt-semantics.mjs')
s = p.read_text()
old_stage1 = """  if(record.stage===1){
    if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('ask only the necessary clarification questions in normal plain language first')||!record.prompt.includes('record those answers in the application’s User Job Input and regenerate this Stage 01 instruction')||!record.prompt.includes('Do not emit a DATA_PROPOSAL until that regenerated instruction contains the required human-authority facts')||!record.prompt.includes('HUMAN_INPUT_REQUIRED response envelope'))issues.push('STAGE01_HUMAN_FIRST_CLARIFICATION_MISSING');
    if(!record.prompt.includes('do not require the human to know those formats in advance')||!record.prompt.includes('absence of a downstream authoring, viewing, compiling, importing, simulation, manufacturing, filing, deployment, or other consuming system is not by itself a reason to downgrade an artifact to prose')||!record.prompt.includes('Only propose an implementation-ready'))issues.push('STAGE01_ARTIFACT_GENERATION_BOUNDARY_MISSING');
  }
"""
new_stage1 = """  if(record.stage===1){
    if(!record.prompt.includes('STAGE 01 RESPONSE DECISION — ONE APPLICATION LOOP')||!record.prompt.includes('return HUMAN_INPUT_REQUIRED immediately as the single strict JSON response')||!record.prompt.includes('do not require a separate agent conversation')||!record.prompt.includes('application will render those questions as typed controls'))issues.push('STAGE01_APPLICATION_CLARIFICATION_LOOP_MISSING');
    if(record.prompt.includes('ask only the necessary clarification questions in normal plain language first')||record.prompt.includes('record those answers in the application’s User Job Input and regenerate this Stage 01 instruction'))issues.push('STAGE01_SIDE_CONVERSATION_CONTRADICTION');
    if(!record.prompt.includes('do not require the human to know specialist formats')||!record.prompt.includes('Distinguish future artifact-generation capability from downstream import, build, simulation, manufacturing, filing, deployment, or physical verification')||!record.prompt.includes('Propose a specification substitute'))issues.push('STAGE01_ARTIFACT_GENERATION_BOUNDARY_MISSING');
  }
"""
if s.count(old_stage1) != 1:
    raise SystemExit('semantic Stage 01 block mismatch')
s = s.replace(old_stage1, new_stage1, 1)
descriptor_anchor = "  if(!arraysEqual(descriptor.scopeRequirements||[],op?.scopeRequirements||[]))issues.push('SCOPE_CONTRADICTION');"
descriptor_extra = descriptor_anchor + "\n  const questionSchema=descriptor.envelope?.memberSchemas?.humanInputRequest,expectedQuestionKeys=['temporaryKey','question','whyRequired','affectedStageFields','affectedRecords','answerType','allowedValues','blocking'];if(!questionSchema||!arraysEqual(questionSchema.itemKeys||[],expectedQuestionKeys)||!arraysEqual(questionSchema.requiredKeys||[],expectedQuestionKeys))issues.push('HUMAN_INPUT_REQUEST_SCHEMA_NOT_EXACT');\n  if(!record.prompt.includes('temporaryKey, question, whyRequired, affectedStageFields, affectedRecords, answerType, allowedValues, blocking')||!record.prompt.includes('requestKey, whyNeeded, expectedAnswer')||!record.prompt.includes('ASCII U+0022'))issues.push('MACHINE_RESPONSE_GUIDANCE_MISSING');"
if s.count(descriptor_anchor) != 1:
    raise SystemExit('descriptor semantic anchor mismatch')
s = s.replace(descriptor_anchor, descriptor_extra, 1)
old_ui = "if(!ui.includes('Clarify before final JSON.')||!ui.includes('record the answer in User Job Input and regenerate this instruction')||!ui.includes('If the agent instead returns HUMAN_INPUT_REQUIRED'))throw new Error('Stage 01 operator UI does not explain human-first clarification and structured fallback.');"
new_ui = "if(!ui.includes('Stage 01 uses structured clarification.')||!ui.includes('application renders typed questions here')||!ui.includes('Do not conduct a separate clarification conversation')||!ui.includes('What do you need? (required)'))throw new Error('Stage 01 operator UI does not explain the single application-owned clarification loop or minimum intake.');"
if s.count(old_ui) != 1:
    raise SystemExit('semantic UI assertion anchor mismatch')
s = s.replace(old_ui, new_ui, 1)
s = s.replace("closed-loop-response-contract/2.2", "closed-loop-response-contract/2.3")
contract_envelope_old = "if(!descriptor.envelope?.responseTypeRules?.DATA_PROPOSAL||!descriptor.envelope?.recordIdentityRule||!descriptor.envelope?.attachmentRule)throw new Error('Envelope identity/disposition/attachment semantics are not bound into the response contract.');"
contract_envelope_new = "if(!descriptor.envelope?.responseTypeRules?.DATA_PROPOSAL||!descriptor.envelope?.recordIdentityRule||!descriptor.envelope?.attachmentRule||!descriptor.envelope?.memberSchemas?.humanInputRequest||!descriptor.envelope?.memberSchemas?.evidence||!descriptor.envelope?.memberSchemas?.unresolved)throw new Error('Envelope identity/disposition/auxiliary-member/attachment semantics are not bound into the response contract.');"
if s.count(contract_envelope_old) != 1:
    raise SystemExit('contract member schema test anchor mismatch')
s = s.replace(contract_envelope_old, contract_envelope_new, 1)
insert_anchor = "const p=baseProject();\nconst original=prompts.buildPromptRecord(17,p,{operation:'EXECUTE_RUN'"
insert = """{
 const missing=baseProject();missing.job.EXACT_USER_OBJECTIVE_VERBATIM='UNKNOWN';let code='';try{prompts.buildPromptRecord(1,missing,{operation:'COMPLETE'});}catch(error){code=error.code;}if(code!=='MISSING_MINIMUM_HUMAN_INTAKE')throw new Error('Stage 01 generated a prompt without a saved verbatim job request.');
 const supplied=baseProject();supplied.job.EXACT_USER_OBJECTIVE_VERBATIM='Prepare a patent application from the supplied invention disclosure.';supplied.stages[1].authorizedFiles=[{artifactId:'ARTIFACT-INPUT-1',name:'invention-disclosure.zip',type:'application/zip',size:1234,sha256:'a'.repeat(64),availability:'IndexedDB Blob bytes persisted and rehashed on read-back.'}];const record=prompts.buildPromptRecord(1,supplied,{operation:'COMPLETE'});if(!record.prompt.includes('APPLICATION-VERIFIED SUPPLIED FILE MANIFEST')||!record.prompt.includes('invention-disclosure.zip')||!record.prompt.includes('ARTIFACT-INPUT-1')||!record.contextManifest.suppliedFileManifest?.length)throw new Error('Stage 01 does not bind application-verified supplied-file identity into the prompt/context signature.');
}

const p=baseProject();
const original=prompts.buildPromptRecord(17,p,{operation:'EXECUTE_RUN'"""
if s.count(insert_anchor) != 1:
    raise SystemExit('minimum intake semantic test insertion anchor mismatch')
s = s.replace(insert_anchor, insert, 1)
p.write_text(s)

# verify-ingestion.mjs: reproduce both malformed agent responses and the valid patent
# clarification equivalent, including smart-quote classification.
p = Path('verify-ingestion.mjs')
s = p.read_text()
anchor = "// HUMAN_INPUT_REQUIRED must contain actual blocking human-authority work."
case = """// Human-input response shape is exact: plausible aliases are rejected with actionable diagnostics.
{
 const p=project('JOB-PATENT-ALIAS-QUESTION'),stage=1,promptRecord=savePrompt(p,stage);
 const envelope={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:promptRecord.operation,promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},scope:promptRecord.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{requestKey:'HIR-01',question:'Which patent filing route is required?',whyNeeded:'The filing route changes the deliverable.',expectedAnswer:'Choose a filing route.',required:true}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};
 const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(envelope),promptRecord});
 if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='INVALID_QUESTION_PROPERTY_ALIAS'&&i.message.includes('temporaryKey'))||!prepared.validation.issues.some(i=>i.message.includes('whyRequired')))throw new Error(`Alias-shaped patent clarification did not produce exact correction diagnostics: ${JSON.stringify(prepared.validation.issues)}`);
 if(prepared.project.projectData.acceptedChanges.length)throw new Error('Alias-shaped clarification mutated canonical state.');negativeCount++;
}
// Typographic quote delimiters are reported explicitly without changing canonical state.
{
 const p=project('JOB-PATENT-SMART-QUOTES'),stage=1,promptRecord=savePrompt(p,stage),valid={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:promptRecord.operation,promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},scope:promptRecord.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'question-1',question:'Which patent filing route is required?',whyRequired:'The filing route is a human decision.',affectedStageFields:[],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:true}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]},smart=JSON.stringify(valid).replaceAll('"','“');
 const prepared=ingestion.prepare(p,{stage,text:smart,promptRecord});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='TYPOGRAPHIC_JSON_QUOTES'))throw new Error(`Smart-quote JSON was not classified precisely: ${JSON.stringify(prepared.validation.issues)}`);if(prepared.project.projectData.acceptedChanges.length)throw new Error('Smart-quote response mutated canonical state.');negativeCount++;
}
// The exact patent clarification shape accepted by the application is executable end to end.
{
 const p=project('JOB-PATENT-VALID-QUESTION'),stage=1,promptRecord=savePrompt(p,stage),envelope={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:promptRecord.operation,promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},scope:promptRecord.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'question-filing-route',question:'Which patent filing route should this job target?',whyRequired:'The filing route changes the required application artifacts and formalities.',affectedStageFields:[],affectedRecords:[],answerType:'CHOICE',allowedValues:['U.S. provisional utility application','U.S. nonprovisional utility application','PCT international application','Other'],blocking:true},{temporaryKey:'question-inventors',question:'Who are the believed inventors?',whyRequired:'Inventorship is a human-controlled legal fact and cannot be invented.',affectedStageFields:[],affectedRecords:[],answerType:'LONG_TEXT',allowedValues:[],blocking:true}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};
 const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(envelope),promptRecord});if(!prepared.validation.valid)throw new Error(`Exact patent clarification shape was rejected: ${JSON.stringify(prepared.validation.issues)}`);const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'});if(committed.project.projectData.humanInputRequests.filter(x=>x.status==='OPEN').length!==2||committed.project.projectData.acceptedChanges.length)throw new Error('Patent clarification did not create exactly two control questions without an accepted data change.');
}

"""
if s.count(anchor) != 1:
    raise SystemExit('ingestion patent clarification insertion anchor mismatch')
s = s.replace(anchor, case + anchor, 1)
p.write_text(s)

# verify-browser.mjs: prove the exact operator failure that was reported.
p = Path('verify-browser.mjs')
s = p.read_text()
old = """ await openStage(cdp,1);text=(await snapshot(cdp)).text;for(const token of ['Clarify before final JSON.','plain-language questions before final JSON','record the answer in User Job Input and regenerate this instruction','HUMAN_INPUT_REQUIRED'])assert(text.includes(token),`Stage 01 clarification experience missing ${token}.`);
 await click(cdp,'[data-view=\"Project\"]');text=(await snapshot(cdp)).text;for(const token of ['Output format (optional)','You do not need to know the final file format in advance','A specification substitute requires human confirmation'])assert(text.includes(token),`Project intake artifact-generation guidance missing ${token}.`);
"""
new = """ await openStage(cdp,1);text=(await snapshot(cdp)).text;assert(text.includes('CONTROLLING INSTRUCTION NOT READY')&&text.includes('What do you need? (required)'),'Stage 01 exposed a sendable prompt without a verbatim job request.');assert(await evalValue(cdp,`document.querySelector('#save-prompt')?.disabled&&document.querySelector('#copy-prompt')?.disabled`),'Stage 01 prompt controls remain enabled without minimum human intake.');
 await click(cdp,'[data-view=\"Project\"]');text=(await snapshot(cdp)).text;for(const token of ['What do you need? (required)','Output format (optional)','You do not need to know the final file format in advance','A specification substitute requires human confirmation'])assert(text.includes(token),`Project intake guidance missing ${token}.`);await fill(cdp,'[data-job=\"EXACT_USER_OBJECTIVE_VERBATIM\"]','I need a patent application for my project based on the supplied invention disclosure.');await click(cdp,'#save-job');await openStage(cdp,1);text=(await snapshot(cdp)).text;for(const token of ['Stage 01 uses structured clarification.','HUMAN_INPUT_REQUIRED','temporaryKey, question, whyRequired, affectedStageFields, affectedRecords, answerType, allowedValues, blocking','ASCII U+0022'])assert(text.includes(token),`Stage 01 machine clarification contract missing ${token}.`);
 await evalValue(cdp,`(()=>{const input=document.querySelector('#stage-files'),dt=new DataTransfer();dt.items.add(new File(['patent invention disclosure'],'invention-disclosure.txt',{type:'text/plain'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);await waitExpr(cdp,`document.body.innerText.includes('invention-disclosure.txt')`,20000);text=(await snapshot(cdp)).text;assert(text.includes('APPLICATION-VERIFIED SUPPLIED FILE MANIFEST')&&text.includes('invention-disclosure.txt'),'Stage 01 prompt did not bind the supplied file identity.');
 await click(cdp,'#save-prompt');let patentProject=await activeProject(cdp),stageOnePrompt=patentProject.projectData.generatedPrompts.filter(x=>Number(x.stage)===1&&!x.invalidatedBy).at(-1);assert(stageOnePrompt?.prompt.includes('I need a patent application for my project'),'Stage 01 prompt omitted the saved verbatim objective.');const patentClarification={schema:'closed-loop-stage-response/2',jobId:patentProject.job.JOB_ID,stage:1,operation:stageOnePrompt.operation||'COMPLETE',promptIdentity:{instructionId:stageOnePrompt.instructionId,bodySha256:stageOnePrompt.bodySha256||stageOnePrompt.sha256,contractSha256:stageOnePrompt.contractSha256,contextSignature:stageOnePrompt.contextSignature},scope:stageOnePrompt.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'question-filing-route',question:'Which patent filing route should this job target?',whyRequired:'The filing route changes the required application artifacts and formalities.',affectedStageFields:[],affectedRecords:[],answerType:'CHOICE',allowedValues:['U.S. provisional utility application','U.S. nonprovisional utility application','PCT international application','Other'],blocking:true},{temporaryKey:'question-inventors',question:'Who are the believed inventors?',whyRequired:'Inventorship is a human-controlled legal fact and cannot be invented.',affectedStageFields:[],affectedRecords:[],answerType:'LONG_TEXT',allowedValues:[],blocking:true}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};await fill(cdp,'#stage-output',JSON.stringify(patentClarification));await click(cdp,'#parse-output');await waitExpr(cdp,`document.body.innerText.includes('Proposed extracted changes')`);await click(cdp,'#accept-proposal');await waitExpr(cdp,`document.body.innerText.includes('Human clarification required')&&document.body.innerText.includes('Which patent filing route should this job target?')`);assert(await evalValue(cdp,`document.querySelector('select[data-human-answer]')?.tagName==='SELECT'&&document.querySelector('textarea[data-human-answer]')?.tagName==='TEXTAREA'`),'Patent clarification questions were not rendered as typed controls.');await evalValue(cdp,`(()=>{const select=document.querySelector('select[data-human-answer]'),area=document.querySelector('textarea[data-human-answer]');select.value='U.S. provisional utility application';area.value='Stephen Jones';select.dispatchEvent(new Event('change',{bubbles:true}));area.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);await click(cdp,'#save-human-answers');await waitExpr(cdp,`!document.body.innerText.includes('Human clarification required')`);patentProject=await activeProject(cdp);const regenerated=patentProject.projectData.generatedPrompts.filter(x=>Number(x.stage)===1&&!x.invalidatedBy).at(-1);assert(regenerated&&regenerated.instructionId!==stageOnePrompt.instructionId&&regenerated.prompt.includes('U.S. provisional utility application')&&regenerated.prompt.includes('Stephen Jones'),'Typed patent answers did not regenerate a new Stage 01 prompt containing the exact human authority.');
"""
if s.count(old) != 1:
    raise SystemExit('browser Stage 01 acceptance anchor mismatch')
s = s.replace(old, new, 1)
p.write_text(s)

# Recompute the one shared runtime identity after the runtime-source changes.
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
