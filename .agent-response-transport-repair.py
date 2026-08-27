from pathlib import Path


def replace_once(path, old, new):
    p=Path(path); s=p.read_text()
    if old not in s:
        raise SystemExit(f'missing expected text in {path}: {old[:120]}')
    p.write_text(s.replace(old,new,1))

replace_once('workbook.js',
"'Every supplied item and material unknown recorded'",
"'Every top-level human-supplied input and every material unknown needed to define the job is recorded; internal package inventory remains Stage 02 work'")

replace_once('prompt-engine.js',
"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/10';",
"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/11';")
replace_once('prompt-engine.js',
"Use domain knowledge only to determine what the human is asking for, what supplied materials exist, what deliverable/artifact set is intended, what human-only facts or decisions are missing, and what capabilities may later be required.",
"Use domain knowledge only to determine what the human is asking for, what top-level supplied inputs exist, what deliverable/artifact set is intended, what human-only facts or decisions are missing, and what capabilities may later be required. Do not enumerate archive members, internal package files, or evidence subtrees merely to satisfy Stage 01; Stage 02 owns that inventory.")
replace_once('prompt-engine.js',
"This limited intake inspection is Stage 01 job-definition work, not later source/material inventory or authority research. Do not classify, validate, rank, establish provenance for, or determine authority/currency/conflicts among supplied materials here.",
"This limited intake inspection is Stage 01 job-definition work, not later source/material inventory or authority research. Treat an uploaded ZIP or package as one top-level supplied input at Stage 01; inspect internal content only enough to extract job-definition facts, and do not enumerate its member files or evidence tree here. Do not classify, validate, rank, establish provenance for, or determine authority/currency/conflicts among supplied materials here.")

old="return {contractVersion:'closed-loop-response-contract/2.2',schema:schema.RESPONSE_SCHEMA,stage,operation,responseTypes:[...schema.RESPONSE_TYPES],scopeRequirements:[...(op?.scopeRequirements||contract.scopeRequirements)],agentStageFields:[...stageFields],agentWritableCollections:[...writable],stageData,records,resourceLimits:{...contract.resourceLimits},envelope:{topLevelKeys:['schema','jobId','stage','operation','promptIdentity','scope','responseType','humanInputRequests','stageData','records','evidence','unresolved','warnings','attachments'],recordKeys:['tempKey','targetId','fields','relationships','evidenceRefs','notes'],humanInputRequestContract:{exactKeys:['temporaryKey','question','whyRequired','affectedStageFields','affectedRecords','answerType','allowedValues','blocking'],requiredValues:{temporaryKey:'unique non-empty response-local string',question:'non-empty string',whyRequired:'non-empty string',affectedStageFields:'array of current-stage field names; use [] when none',affectedRecords:'array of current-operation collection names; use [] when none',answerType:'TEXT | LONG_TEXT | BOOLEAN | NUMBER | CHOICE | MULTI_CHOICE | DATE | FILE_REFERENCE',allowedValues:'array; non-empty unique strings only for CHOICE/MULTI_CHOICE, otherwise []',blocking:'BOOLEAN; HUMAN_INPUT_REQUIRED questions should be true unless genuinely nonblocking'}},recordIdentityRule:'Exactly one of tempKey or targetId; UPDATE_RESERVED uses targetId and new proposals use tempKey.',relationshipReferenceRule:'Exactly one of tempKey or recordId and target collection must match the declared relationship.',evidenceRule:'Evidence references must resolve completely; claimed source or attachment references may not resolve to UNKNOWN.',responseTypeRules:{DATA_PROPOSAL:'May contain permitted agent stageData, records, evidence, attachments, and nonblocking warnings; blocking humanInputRequests or unresolved items are prohibited.',HUMAN_INPUT_REQUIRED:'stageData and records must be empty; structured humanInputRequests carry the blocking questions and every question must follow humanInputRequestContract exactly.',BLOCKED:'stageData, records, and humanInputRequests must be empty; structured unresolved items carry the blocker.',EXECUTION_FAILED:'Canonical stageData is prohibited; structured failure information and evidence identify the failed current execution.'},attachmentRule:'Declared required attachments must match operator-supplied filename, byteSize, and application-computed SHA-256 before acceptance.'}};"
new="return {contractVersion:'closed-loop-response-contract/2.3',schema:schema.RESPONSE_SCHEMA,stage,operation,responseTypes:[...schema.RESPONSE_TYPES],scopeRequirements:[...(op?.scopeRequirements||contract.scopeRequirements)],agentStageFields:[...stageFields],agentWritableCollections:[...writable],stageData,records,resourceLimits:{...contract.resourceLimits},envelope:{topLevelKeys:['schema','jobId','stage','operation','promptIdentity','scope','responseType','humanInputRequests','stageData','records','evidence','unresolved','warnings','attachments'],recordKeys:['tempKey','targetId','fields','relationships','evidenceRefs','notes'],transportRule:'Return one JSON object either as raw JSON or inside exactly one JSON Markdown code fence. No prose may appear before or after the object. The application preserves the exact raw pasted bytes before transport normalization.',humanInputRequestContract:{exactKeys:['temporaryKey','question','whyRequired','affectedStageFields','affectedRecords','answerType','allowedValues','blocking'],requiredValues:{temporaryKey:'unique non-empty response-local string',question:'non-empty string',whyRequired:'non-empty string',affectedStageFields:'array of current-stage field names; use [] when none',affectedRecords:'array of current-operation collection names; use [] when none',answerType:'TEXT | LONG_TEXT | BOOLEAN | NUMBER | CHOICE | MULTI_CHOICE | DATE | FILE_REFERENCE',allowedValues:'array; non-empty unique strings only for CHOICE/MULTI_CHOICE, otherwise []',blocking:'BOOLEAN; HUMAN_INPUT_REQUIRED questions should be true unless genuinely nonblocking'}},evidenceContract:{exactKeys:['temporaryKey','kind','description','authorityType','sourceRef','location','content','attachmentRef','notes','supports'],requiredValues:{temporaryKey:'unique non-empty response-local string',kind:'non-empty string',description:'non-empty string',location:'non-empty string',content:'non-empty string',supports:'array of unique /stageData/FIELD JSON pointers covered by this evidence; use [] when this evidence supports records only'},optionalValues:{authorityType:'optional string',sourceRef:'optional relationship object containing exactly one of tempKey or recordId and resolving to sources',attachmentRef:'optional relationship object containing exactly one of tempKey or recordId and resolving to verified artifact bytes',notes:'optional string'}},unresolvedContract:{exactKeys:['temporaryKey','kind','description','whyBlocking','affectedStageFields','affectedRecords','blocking']},warningContract:{exactKeys:['code','message','path']},attachmentContract:{exactKeys:['temporaryKey','filename','mediaType','byteSize','sha256','required']},recordIdentityRule:'Exactly one of tempKey or targetId; UPDATE_RESERVED uses targetId and new proposals use tempKey.',relationshipReferenceRule:'Exactly one of tempKey or recordId and target collection must match the declared relationship.',evidenceRule:'Every provenance-required stageData field must be covered by at least one evidence.supports JSON pointer. Record provenance uses record.evidenceRefs. Claimed source or attachment references must resolve completely.',responseTypeRules:{DATA_PROPOSAL:'May contain permitted agent stageData, records, evidence, attachments, and nonblocking warnings; blocking humanInputRequests or unresolved items are prohibited.',HUMAN_INPUT_REQUIRED:'stageData and records must be empty; structured humanInputRequests carry the blocking questions and every question must follow humanInputRequestContract exactly.',BLOCKED:'stageData, records, and humanInputRequests must be empty; structured unresolved items carry the blocker.',EXECUTION_FAILED:'Canonical stageData is prohibited; structured failure information and evidence identify the failed current execution.'},attachmentRule:'Declared required attachments must match operator-supplied filename, byteSize, and application-computed SHA-256 before acceptance.'}};"
replace_once('prompt-engine.js',old,new)
replace_once('prompt-engine.js',
"- Return exactly one JSON object and no Markdown fence, preamble, conversational question, or trailing prose. Use valid JSON syntax with ASCII U+0022 double quotation marks for every JSON member name and string delimiter; never use typographic/curly quotation marks.",
"- Return exactly one JSON object, preferably inside exactly one fenced code block labeled json so copy/paste preserves machine characters. Raw JSON without a fence is also accepted. Do not add prose before or after the object. Use valid JSON syntax with ASCII U+0022 double quotation marks for JSON delimiters; never intentionally substitute typographic/curly quotation marks. The application preserves the exact raw response before any safe transport normalization.")
replace_once('prompt-engine.js',
"- Include evidence for every agent-produced canonical value that requires provenance.",
"- Include evidence for every agent-produced canonical value that requires provenance. Use only the exact evidenceContract keys. For provenance-required stageData, add the exact /stageData/FIELD pointer to evidence.supports. For record fields, use the record's evidenceRefs array; do not invent sourceType, sourceReference, locator, excerpt, or other evidence properties.")

p=Path('response-ingestion.js'); s=p.read_text()
s=s.replace("const EVIDENCE_KEYS=Object.freeze(['temporaryKey','kind','description','authorityType','sourceRef','location','content','attachmentRef','notes']);","const EVIDENCE_KEYS=Object.freeze(['temporaryKey','kind','description','authorityType','sourceRef','location','content','attachmentRef','notes','supports']);",1)
old="""function strictParse(text,{limits=schema.DEFAULT_RESOURCE_LIMITS}={}){
  const raw=String(text??'');
  const trimmed=raw.trim();
  if(!trimmed)throw Object.assign(new Error('Returned output is empty.'),{code:'EMPTY_RESPONSE'});
  if(byteLength(raw)>limits.maxRawResponseBytes)throw Object.assign(new Error('Returned output exceeds the stage byte limit.'),{code:'OVERSIZED_RESPONSE'});
  try{scanJsonAmbiguity(trimmed,limits.maxJsonDepth);}catch(error){if(error.code)throw error;}
  if(trimmed.startsWith('```')||trimmed.endsWith('```'))throw Object.assign(new Error('The response must be one JSON object without a Markdown code fence.'),{code:'NON_JSON_WRAPPER'});
  let envelope;
  try{envelope=JSON.parse(trimmed);}catch(error){
    const likelyTruncated=!trimmed.endsWith('}')||((trimmed.match(/{/g)||[]).length!==(trimmed.match(/}/g)||[]).length);
    throw Object.assign(new Error(`Response JSON could not be parsed: ${error.message}`),{code:likelyTruncated?'TRUNCATED_RESPONSE':'MALFORMED_JSON',cause:error});
  }
  if(!object(envelope))throw Object.assign(new Error('The response root must be one JSON object.'),{code:'INVALID_ROOT'});
  return envelope;
}
"""
new="""function unwrapJsonTransport(trimmed){
  if(!trimmed.startsWith('```')&&!trimmed.endsWith('```'))return trimmed;
  const match=trimmed.match(/^```(?:json)?[ \\t]*\\r?\\n([\\s\\S]*?)\\r?\\n```$/i);
  if(!match)throw Object.assign(new Error('Use exactly one JSON code fence with no prose before or after it.'),{code:'NON_JSON_WRAPPER'});
  return match[1].trim();
}
function normalizeTypographicJsonTransport(candidate){
  let out='',inSmart=false;
  for(let i=0;i<candidate.length;i++){
    const c=candidate[i];
    if(!inSmart&&c==='“'){out+='"';inSmart=true;continue;}
    if(inSmart&&c==='”'){out+='"';inSmart=false;continue;}
    if(!inSmart&&c==='”')throw Object.assign(new Error('Unmatched typographic JSON quote.'),{code:'MALFORMED_JSON'});
    if(inSmart&&c==='"'){out+='\\\\"';continue;}
    out+=c;
  }
  if(inSmart)throw Object.assign(new Error('Unterminated typographic JSON string.'),{code:'TRUNCATED_RESPONSE'});
  return out;
}
function parseCandidate(candidate,limits){scanJsonAmbiguity(candidate,limits.maxJsonDepth);return JSON.parse(candidate);}
function strictParse(text,{limits=schema.DEFAULT_RESOURCE_LIMITS}={}){
  const raw=String(text??'');
  const trimmed=raw.trim();
  if(!trimmed)throw Object.assign(new Error('Returned output is empty.'),{code:'EMPTY_RESPONSE'});
  if(byteLength(raw)>limits.maxRawResponseBytes)throw Object.assign(new Error('Returned output exceeds the stage byte limit.'),{code:'OVERSIZED_RESPONSE'});
  const candidate=unwrapJsonTransport(trimmed);
  let envelope,firstError;
  try{envelope=parseCandidate(candidate,limits);}catch(error){firstError=error;if(['DUPLICATE_JSON_MEMBER','EXCESSIVE_JSON_DEPTH'].includes(error.code))throw error;}
  if(!envelope&&/[“”]/.test(candidate)){
    try{envelope=parseCandidate(normalizeTypographicJsonTransport(candidate),limits);}catch(error){if(error.code)throw error;firstError=error;}
  }
  if(!envelope){
    const likelyTruncated=!candidate.endsWith('}')||((candidate.match(/{/g)||[]).length!==(candidate.match(/}/g)||[]).length);
    throw Object.assign(new Error(`Response JSON could not be parsed: ${firstError?.message||'invalid JSON'}`),{code:likelyTruncated?'TRUNCATED_RESPONSE':'MALFORMED_JSON',cause:firstError});
  }
  if(!object(envelope))throw Object.assign(new Error('The response root must be one JSON object.'),{code:'INVALID_ROOT'});
  return envelope;
}
"""
if old not in s: raise SystemExit('strictParse block not found')
s=s.replace(old,new,1)
old2="""    for(const name of ['kind','description','location','content'])if(!String(evidence[name]??'').trim())issues.push(issue('MISSING_EVIDENCE_FIELD',`${path}/${name}`,`${name} is required.`));
"""
new2="""    for(const name of ['kind','description','location','content'])if(!String(evidence[name]??'').trim())issues.push(issue('MISSING_EVIDENCE_FIELD',`${path}/${name}`,`${name} is required.`));
    if(evidence.supports===undefined)issues.push(issue('MISSING_EVIDENCE_SUPPORTS',`${path}/supports`,'supports is required; use [] when this evidence supports records only.'));else if(!Array.isArray(evidence.supports)||evidence.supports.some(value=>typeof value!=='string'||!value.trim())||new Set(evidence.supports).size!==evidence.supports.length)issues.push(issue('INVALID_EVIDENCE_SUPPORTS',`${path}/supports`,'supports must be an array of unique non-empty stageData JSON pointers.'));else for(const pointer of evidence.supports){const match=String(pointer).match(/^\\/stageData\\/([^/]+)$/),field=match?.[1];if(!field||!allowedStageData.has(field))issues.push(issue('INVALID_EVIDENCE_SUPPORT_POINTER',`${path}/supports`,`Evidence support pointer ${pointer} is not a permitted current-stage stageData field.`));}
"""
if old2 not in s: raise SystemExit('evidence validation anchor not found')
s=s.replace(old2,new2,1)
anchor="""  if(object(envelope.records))for(const [collection,list] of Object.entries(envelope.records))if(Array.isArray(list))list.forEach((record,index)=>{
"""
insert="""  for(const field of allowedStageData){const definition=schema.STAGE_FIELDS[stageNumber]?.[field];if(definition?.provenanceRequired&&Object.prototype.hasOwnProperty.call(envelope.stageData||{},field)){const pointer=`/stageData/${field}`,covered=[...evidenceIndex.values()].some(entry=>safe(entry.evidence?.supports).includes(pointer));if(!covered)issues.push(issue('MISSING_STAGE_DATA_PROVENANCE',pointer,`Agent-produced stageData ${field} requires at least one evidence.supports reference to ${pointer}.`));}}

  if(object(envelope.records))for(const [collection,list] of Object.entries(envelope.records))if(Array.isArray(list))list.forEach((record,index)=>{
"""
if anchor not in s: raise SystemExit('stage provenance anchor not found')
s=s.replace(anchor,insert,1)
p.write_text(s)

replace_once('app-core.js',
"Paste the complete strict JSON response. Parse / validate preserves the raw response first, then validates it without changing canonical project records.",
"Paste the complete structured response as raw JSON or one JSON code block. Parse / validate preserves the exact raw response first, safely removes only the permitted transport wrapper or typographic delimiter corruption, then validates without changing canonical project records.")
replace_once('app-core.js',
"<span>Complete JSON only — no Markdown wrapper.</span><span>${s.responseDraft?`${s.responseDraft.length.toLocaleString()} characters pasted`:'No response pasted yet'}</span>",
"<span>Raw JSON or one json code block; no surrounding prose.</span><span id=\"stage-output-count\">${s.responseDraft?`${s.responseDraft.length.toLocaleString()} characters pasted`:'No response pasted yet'}</span>")
replace_once('app-core.js',
"if($('#parse-output'))$('#parse-output').onclick=prepareStageResponse;",
"if($('#stage-output'))$('#stage-output').oninput=e=>{const count=$('#stage-output-count');if(count)count.textContent=e.target.value?`${e.target.value.length.toLocaleString()} characters pasted · not yet parsed`:'No response pasted yet';const report=$('#validation-report');if(report){report.classList.remove('danger');report.classList.add('warn');report.innerHTML='<strong>Response changed since the previous validation.</strong><br>The previous error remains preserved in Records but does not describe the edited text. Parse / validate again to evaluate this response.';}};if($('#parse-output'))$('#parse-output').onclick=prepareStageResponse;")

p=Path('verify-ingestion.mjs'); s=p.read_text()
s=s.replace("evidence:[{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:'Controlled verification evidence',location:'verification fixture',content:`stage-${stage}-evidence`}],","evidence:[{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:'Controlled verification evidence',location:'verification fixture',content:`stage-${stage}-evidence`,supports:Object.keys(stageData).map(name=>`/stageData/${name}`)}],",1)
old_test="negative('markdown wrapped',(e)=>'```json\\n'+JSON.stringify(e)+'\\n```','NON_JSON_WRAPPER');"
smart_js="{const p=project('JOB-SMART-JSON'),pr=savePrompt(p,2),e=validEnvelope(p,2,pr),ascii=JSON.stringify(e);let opening=true;const smart=ascii.replace(/\\\"/g,()=>String.fromCodePoint((opening=!opening)?0x201d:0x201c));const prepared=ingestion.prepare(p,{stage:2,text:smart,promptRecord:pr});if(!prepared.validation.valid)throw new Error(`Typographic JSON transport was not normalized: ${prepared.validation.issues.map(x=>x.code).join(', ')}`);negativeCount++;}"
replacement="{const p=project('JOB-FENCED-JSON'),pr=savePrompt(p,2),e=validEnvelope(p,2,pr),prepared=ingestion.prepare(p,{stage:2,text:'```json\\n'+JSON.stringify(e)+'\\n```',promptRecord:pr});if(!prepared.validation.valid)throw new Error(`Exact JSON fence was rejected: ${prepared.validation.issues.map(x=>x.code).join(', ')}`);negativeCount++;}\n"+smart_js+"\nnegative('prose wrapped JSON',(e)=>'Here is the JSON:\\n```json\\n'+JSON.stringify(e)+'\\n```','NON_JSON_WRAPPER');"
if old_test not in s: raise SystemExit('markdown wrapper test anchor not found')
s=s.replace(old_test,replacement,1)
marker="negative('missing evidence',(e)=>{e.evidence=[];},'MISSING_PROVENANCE');"
replacement2="negativeAt('missing stageData provenance',1,(e)=>{e.evidence.forEach(x=>x.supports=[]);},'MISSING_STAGE_DATA_PROVENANCE');\n"+marker
if marker not in s: raise SystemExit('missing evidence test anchor not found')
s=s.replace(marker,replacement2,1)
p.write_text(s)

p=Path('verify-prompt-semantics.mjs'); s=p.read_text()
s += """

// response-transport-and-stage01-package-boundary-v1
{
 const p=baseProject();p.job.EXACT_USER_OBJECTIVE_VERBATIM='Turn the supplied ZIP packet into a patent application.';p.job.SUPPLIED_MATERIALS_INVENTORY='packet.zip';const r=prompts.buildPromptRecord(1,p);
 for(const token of ['closed-loop-response-contract/2.3','evidenceContract','supports','/stageData/FIELD','exactly one fenced code block labeled json','Treat an uploaded ZIP or package as one top-level supplied input at Stage 01','do not enumerate its member files or evidence tree here'])if(!r.prompt.includes(token))throw new Error('Response transport/evidence/Stage 01 package boundary missing: '+token);
 if(r.prompt.includes('Complete JSON only — no Markdown wrapper'))throw new Error('Obsolete brittle transport instruction remains.');
}
"""
p.write_text(s)
