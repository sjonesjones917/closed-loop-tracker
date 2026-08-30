import fs from 'node:fs';

const fail = message => { throw new Error(message); };
const replaceOnce = (text, search, replacement, label) => {
  const count = typeof search === 'string' ? text.split(search).length - 1 : [...text.matchAll(new RegExp(search.source, search.flags.includes('g') ? search.flags : search.flags + 'g'))].length;
  if (count !== 1) fail(`${label}: expected exactly one anchor, found ${count}`);
  return text.replace(search, replacement);
};

const accountingCode = String.raw`
const INTAKE_MANIFEST_SCHEMA='closed-loop-intake-manifest/1';
const INTAKE_CAPTURE_SCHEMA='closed-loop-intake-capture/1';
const OBLIGATION_MANIFEST_SCHEMA='closed-loop-obligation-manifest/1';
const INTAKE_DISPOSITIONS=Object.freeze(['INCORPORATED','RETAINED_CONTEXT','UNRESOLVED_HUMAN_ONLY','LATER_RESOLVABLE','INAPPLICABLE']);
const INTAKE_STATEMENT_CLASSES=Object.freeze(['FACT','FACT_AFFECTING_REQUIREMENTS','REQUIREMENT','CONSTRAINT','DECISION','PROHIBITION','REQUESTED_OUTPUT','ACCEPTANCE_CONDITION','MATERIAL_REFERENCE','UNRESOLVED_HUMAN_ONLY']);
const OBLIGATION_STATEMENT_CLASSES=new Set(['FACT_AFFECTING_REQUIREMENTS','REQUIREMENT','CONSTRAINT','DECISION','PROHIBITION','REQUESTED_OUTPUT','ACCEPTANCE_CONDITION','UNRESOLVED_HUMAN_ONLY']);
const OBLIGATION_NONREQUIREMENT_DISPOSITIONS=Object.freeze(['RETAINED_NONNORMATIVE_CONTEXT','INAPPLICABLE','BLOCKED']);
const accountingPresent=value=>value!==undefined&&value!==null&&(typeof value!=='string'||value.trim()!=='')&&(!Array.isArray(value)||value.length>0)&&(typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>0);
const accountingId=(prefix,payload)=>prefix+'-'+hash.sha256Value(payload).slice(0,24).toUpperCase();
const exactKeys=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key));
function stageOneControlledInputVersion(project){const accepted=acceptedChanges(project,1).at(-1);return String(accepted?.scope?.inputVersion||accepted?.inputVersion||project.job.CURRENT_INPUT_VERSION||'UNKNOWN');}
function suppliedMaterialEntries(raw){if(!accountingPresent(raw))return [];try{const parsed=typeof raw==='string'?JSON.parse(raw):raw;return (Array.isArray(parsed)?parsed:[parsed]).filter(accountingPresent);}catch{return String(raw).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);}}
function materialReference(value,index){if(value&&typeof value==='object'){for(const key of ['exactNameOrReference','filename','name','path','url','reference'])if(accountingPresent(value[key]))return String(value[key]);return 'SUPPLIED_MATERIAL_'+String(index+1);}return String(value);}
function intakeCoverageManifest(project){
  ensureShape(project);const inputVersion=stageOneControlledInputVersion(project),units=[],artifacts=records(project,'artifacts');
  const add=(kind,sourceLocation,rawValue,extra={})=>{if(!accountingPresent(rawValue))return;const rawValueSha256=hash.sha256Value(rawValue),sourceUnitId=accountingId('INPUT-UNIT',{jobId:project.job.JOB_ID,inputVersion,kind,sourceLocation,rawValueSha256});units.push({sourceUnitId,kind,sourceLocation,rawValue:clone(rawValue),rawValueSha256,...extra});};
  for(const [name,definition] of Object.entries(schema.JOB_FIELDS||{})){if(name==='SUPPLIED_MATERIALS_INVENTORY'||!['HUMAN','HUMAN_DECISION'].includes(definition?.producer))continue;add('USER_JOB_FIELD','job.'+name,project.job?.[name],{fieldName:name,label:name});}
  suppliedMaterialEntries(project.job?.SUPPLIED_MATERIALS_INVENTORY).forEach((item,index)=>{const reference=materialReference(item,index),base=reference.replaceAll('\\','/').split('/').pop(),matches=artifacts.filter(a=>String(recordValue(a,'FILENAME')||'')===reference||String(recordValue(a,'FILENAME')||'')===base),artifact=matches.length===1?matches[0]:null;add('SUPPLIED_MATERIAL','job.SUPPLIED_MATERIALS_INVENTORY['+index+']',item,{materialReference:reference,label:reference,artifactId:artifact?recordId(artifact,'artifacts'):null,artifactSha256:artifact?String(recordValue(artifact,'SHA256')||''):null,artifactAvailability:artifact?String(recordValue(artifact,'AVAILABILITY')||''):'NOT_IN_APPLICATION_CUSTODY'});});
  for(const answer of safe(project.projectData.humanInputAnswers).filter(x=>Number(x.stage)===1&&!x.invalidatedBy))add('STAGE_01_HUMAN_ANSWER','humanInputAnswers.'+(answer.answerId||answer.requestId),answer.answer,{answerId:answer.answerId||null,requestId:answer.requestId||null,question:answer.question||'',label:answer.question||answer.requestId||'STAGE_01_HUMAN_ANSWER'});
  const base={schema:INTAKE_MANIFEST_SCHEMA,jobId:String(project.job.JOB_ID||''),inputVersion,units,unitCount:units.length};return {...base,manifestSha256:hash.sha256Value(base)};
}
function parseIntakeCaptureValue(value){if(value&&typeof value==='object'&&!Array.isArray(value))return clone(value);if(typeof value!=='string'||!value.trim())return null;try{const parsed=JSON.parse(value);return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:null;}catch{return null;}}
function currentIntakeCaptureValue(project){return project.job?.INPUT_SET_CONTENTS??project.stages?.[1]?.agentData?.INPUT_SET_CONTENTS??project.stages?.[1]?.acceptedData?.INPUT_SET_CONTENTS??null;}
function evaluateIntakeCoverage(project,captureOverride){
  const manifest=intakeCoverageManifest(project),capture=parseIntakeCaptureValue(captureOverride===undefined?currentIntakeCaptureValue(project):captureOverride),errors=[],capturedById=new Map(),statements=[];
  if(!capture)return {manifest,capture:null,complete:false,coverage:0,missingUnitIds:manifest.units.map(x=>x.sourceUnitId),errors:['INPUT_SET_CONTENTS must be a closed structured intake capture; free-form summaries cannot prove complete accounting.'],statements};
  if(!exactKeys(capture,['schema','inputVersion','manifestSha256','units','conversationStatements']))errors.push('Intake capture contains an unknown root property.');
  if(capture.schema!==INTAKE_CAPTURE_SCHEMA)errors.push('Intake capture schema must be '+INTAKE_CAPTURE_SCHEMA+'.');
  if(String(capture.inputVersion||'')!==manifest.inputVersion)errors.push('Intake capture inputVersion does not match the controlled Stage 01 input version.');
  if(String(capture.manifestSha256||'')!==manifest.manifestSha256)errors.push('Intake capture manifestSha256 does not match the application intake manifest.');
  const rows=Array.isArray(capture.units)?capture.units:[];if(!Array.isArray(capture.units))errors.push('Intake capture units must be an array.');
  for(const row of rows){if(!exactKeys(row,['sourceUnitId','disposition','reason','extractedStatements']))errors.push('Intake unit accounting contains an unknown property.');const id=String(row?.sourceUnitId||'');if(!manifest.units.some(x=>x.sourceUnitId===id)){errors.push('Unknown intake source unit '+(id||'MISSING')+'.');continue;}if(capturedById.has(id)){errors.push('Duplicate intake source unit accounting for '+id+'.');continue;}capturedById.set(id,row);if(!INTAKE_DISPOSITIONS.includes(String(row?.disposition||'')))errors.push(id+': invalid intake disposition.');if(row?.disposition==='INAPPLICABLE'&&!String(row?.reason||'').trim())errors.push(id+': INAPPLICABLE requires a reason.');const extracted=Array.isArray(row?.extractedStatements)?row.extractedStatements:[];if(row?.disposition!=='INAPPLICABLE'&&!extracted.length)errors.push(id+': every applicable supplied unit must preserve at least one semantic statement.');const keys=new Set();for(const statement of extracted){if(!exactKeys(statement,['statementKey','text','statementClass']))errors.push(id+': extracted statement contains an unknown property.');const key=String(statement?.statementKey||''),text=String(statement?.text||'').trim(),statementClass=String(statement?.statementClass||'');if(!key||keys.has(key))errors.push(id+': statementKey must be present and unique within the source unit.');keys.add(key);if(!text)errors.push(id+'/'+(key||'MISSING')+': statement text is required.');if(!INTAKE_STATEMENT_CLASSES.includes(statementClass))errors.push(id+'/'+(key||'MISSING')+': invalid statementClass.');if(key&&text&&INTAKE_STATEMENT_CLASSES.includes(statementClass))statements.push({statementId:accountingId('INPUT-STMT',{sourceUnitId:id,statementKey:key,text,statementClass}),sourceUnitId:id,statementKey:key,text,statementClass,disposition:row.disposition,sourceLocation:manifest.units.find(x=>x.sourceUnitId===id)?.sourceLocation||''});}}
  const conversation=Array.isArray(capture.conversationStatements)?capture.conversationStatements:[];if(capture.conversationStatements!==undefined&&!Array.isArray(capture.conversationStatements))errors.push('conversationStatements must be an array when present.');const conversationKeys=new Set();for(const statement of conversation){if(!exactKeys(statement,['statementKey','question','text','statementClass','status']))errors.push('Conversation statement contains an unknown property.');const key=String(statement?.statementKey||''),text=String(statement?.text||'').trim(),statementClass=String(statement?.statementClass||''),status=String(statement?.status||'');if(!key||conversationKeys.has(key))errors.push('Conversation statement requires a unique statementKey.');conversationKeys.add(key);if(!text)errors.push((key||'MISSING')+': conversation statement text is required.');if(!INTAKE_STATEMENT_CLASSES.includes(statementClass))errors.push((key||'MISSING')+': invalid conversation statementClass.');if(!['ANSWERED','UNKNOWN','DEFERRED'].includes(status))errors.push((key||'MISSING')+': invalid conversation status.');if(key&&text&&INTAKE_STATEMENT_CLASSES.includes(statementClass))statements.push({statementId:accountingId('INPUT-STMT',{inputVersion:manifest.inputVersion,conversation:true,key,text,statementClass,status}),sourceUnitId:null,statementKey:key,text,statementClass,disposition:status==='ANSWERED'?'INCORPORATED':'UNRESOLVED_HUMAN_ONLY',sourceLocation:'STAGE_01_CONVERSATION'});}
  const missingUnitIds=manifest.units.filter(x=>!capturedById.has(x.sourceUnitId)).map(x=>x.sourceUnitId);for(const id of missingUnitIds)errors.push('Unaccounted intake source unit '+id+'.');const coverage=manifest.unitCount?capturedById.size/manifest.unitCount:1;return {manifest,capture,complete:errors.length===0&&coverage===1,coverage,missingUnitIds,errors:[...new Set(errors)],statements};
}
function obligationManifest(project){
  ensureShape(project);const intake=evaluateIntakeCoverage(project),items=[],seen=new Set(),inputVersion=String(project.job.CURRENT_INPUT_VERSION||'UNKNOWN'),sourceSetVersion=String(project.job.CURRENT_SOURCE_SET_VERSION||'NOT APPLICABLE');
  const add=(originKind,originId,text,provenance={},statementClass='REQUIREMENT')=>{const normalized=String(text??'').trim();if(!normalized)return;const obligationId=accountingId('OBLIGATION',{jobId:project.job.JOB_ID,inputVersion,sourceSetVersion,originKind,originId,normalized,statementClass});if(seen.has(obligationId))return;seen.add(obligationId);items.push({obligationId,originKind,originId,statementClass,text:normalized,provenance:clone(provenance),inputVersion,sourceSetVersion});};
  for(const statement of intake.statements)if(OBLIGATION_STATEMENT_CLASSES.has(statement.statementClass))add('HUMAN_AUTHORITY',statement.statementId,statement.text,{sourceUnitId:statement.sourceUnitId,sourceLocation:statement.sourceLocation,intakeManifestSha256:intake.manifest.manifestSha256},statement.statementClass);
  for(const answer of safe(project.projectData.humanInputAnswers).filter(x=>Number(x.stage)>1&&Number(x.stage)<=4&&!x.invalidatedBy))add('LATER_HUMAN_AUTHORITY',answer.answerId||answer.requestId,answer.answer,{requestId:answer.requestId,stage:answer.stage,inputVersion:answer.inputVersion||inputVersion},'DECISION');
  const deliverable=project.job.EXACT_DELIVERABLE_REQUESTED||project.stages?.[1]?.agentData?.EXACT_DELIVERABLE_REQUESTED;add('STAGE_01_JOB_DEFINITION','EXACT_DELIVERABLE_REQUESTED',deliverable,{acceptedStage:1},'REQUESTED_OUTPUT');
  const unknown=String(project.job.UNKNOWN_INFORMATION||project.stages?.[1]?.agentData?.UNKNOWN_INFORMATION||'').trim();if(unknown&&!['NONE','UNKNOWN','NOT APPLICABLE'].includes(upper(unknown)))add('STAGE_01_JOB_DEFINITION','UNKNOWN_INFORMATION',unknown,{acceptedStage:1},'UNRESOLVED_HUMAN_ONLY');
  for(const candidate of recordsForCurrentScope(project,'candidateRequirements'))add('STAGE_03_CANDIDATE',recordId(candidate,'candidateRequirements'),recordValue(candidate,'CANDIDATE_OBLIGATION'),{candidateRequirementId:recordId(candidate,'candidateRequirements'),sourceId:String(recordValue(candidate,'SOURCE_ID')||candidate.relationships?.SOURCE_ID||''),evidence:recordValue(candidate,'EVIDENCE')},'REQUIREMENT');
  const researchFields=['MANDATORY_STATEMENTS','RECOMMENDATIONS','OPTIONAL_PRACTICES','PROHIBITIONS','EXCEPTIONS','DEPENDENCIES','APPLICABILITY_FACTS','RESTRICTIONS','INVALIDATING_MATERIAL'];for(const research of recordsForCurrentScope(project,'research'))for(const field of researchFields){const value=recordValue(research,field),values=Array.isArray(value)?value:[value];values.filter(accountingPresent).forEach((text,index)=>add('STAGE_03_RESEARCH',recordId(research,'research')+':'+field+':'+index,text,{researchId:recordId(research,'research'),sourceId:String(recordValue(research,'SOURCE_ID')||research.relationships?.SOURCE_ID||''),field,sourceEvidence:recordValue(research,'SOURCE_EVIDENCE')},field==='RECOMMENDATIONS'||field==='OPTIONAL_PRACTICES'?'FACT_AFFECTING_REQUIREMENTS':'REQUIREMENT'));}
  const base={schema:OBLIGATION_MANIFEST_SCHEMA,jobId:String(project.job.JOB_ID||''),inputVersion,sourceSetVersion,intakeManifestSha256:intake.manifest.manifestSha256,intakeCaptureComplete:intake.complete,items,obligationCount:items.length};return {...base,manifestSha256:hash.sha256Value(base)};
}
function obligationIdsFromRelationship(value){return [...new Set((String(value??'').match(/OBLIGATION-[A-F0-9]{24}/gi)||[]).map(x=>x.toUpperCase()))];}
function parseObligationDispositionEvidence(item){const kind=String(recordValue(item,'KIND')||item?.kind||'').toUpperCase();if(kind!=='OBLIGATION_DISPOSITION')return null;const raw=recordValue(item,'CONTENT')??item?.content;let content=raw;if(typeof raw==='string')try{content=JSON.parse(raw);}catch{return {error:'OBLIGATION_DISPOSITION evidence content must be strict JSON.'};}if(!exactKeys(content,['obligationId','disposition','reason']))return {error:'OBLIGATION_DISPOSITION content must contain only obligationId, disposition, and reason.'};return {content};}
function evaluateObligationAccounting(project,{requirements=null,evidence=null}={}){
  const manifest=obligationManifest(project),reqs=requirements||recordsForCurrentScope(project,'requirements'),ev=evidence||records(project,'evidenceRecords'),mapping=new Map(),dispositions=new Map(),errors=[];
  for(const requirement of safe(reqs)){const relationship=recordValue(requirement,'USER_INPUT_RELATIONSHIP')??requirement?.fields?.USER_INPUT_RELATIONSHIP,ids=obligationIdsFromRelationship(relationship);if(!ids.length)errors.push('A Stage 04 requirement lacks an OBLIGATION manifest identity in USER_INPUT_RELATIONSHIP.');for(const id of ids){if(!manifest.items.some(x=>x.obligationId===id)){errors.push('Requirement references unknown obligation '+id+'.');continue;}if(!mapping.has(id))mapping.set(id,[]);mapping.get(id).push(requirement);}}
  for(const item of safe(ev)){const parsed=parseObligationDispositionEvidence(item);if(!parsed)continue;if(parsed.error){errors.push(parsed.error);continue;}const content=parsed.content,id=String(content.obligationId||'').toUpperCase(),disposition=String(content.disposition||'').toUpperCase(),reason=String(content.reason||'').trim();if(!manifest.items.some(x=>x.obligationId===id)){errors.push('Disposition references unknown obligation '+(id||'MISSING')+'.');continue;}if(dispositions.has(id)){errors.push('Duplicate non-requirement disposition for '+id+'.');continue;}if(!OBLIGATION_NONREQUIREMENT_DISPOSITIONS.includes(disposition))errors.push(id+': invalid non-requirement disposition.');if(!reason)errors.push(id+': non-requirement disposition requires a reason.');dispositions.set(id,{disposition,reason});}
  const missingObligationIds=[];for(const item of manifest.items){const mapped=mapping.has(item.obligationId),disposed=dispositions.has(item.obligationId);if(mapped&&disposed)errors.push(item.obligationId+' is both mapped to a requirement and given a non-requirement disposition.');if(!mapped&&!disposed)missingObligationIds.push(item.obligationId);}for(const id of missingObligationIds)errors.push('Unaccounted Stage 04 obligation '+id+'.');if(!manifest.intakeCaptureComplete)errors.push('Stage 04 cannot close because Stage 01 intake accounting is incomplete.');const blocked=[...dispositions].filter(([,x])=>x.disposition==='BLOCKED').map(([obligationId,value])=>({obligationId,...value})),coverage=manifest.obligationCount?(manifest.obligationCount-missingObligationIds.length)/manifest.obligationCount:1,closed=errors.length===0&&coverage===1;return {manifest,coverage,missingObligationIds,blocked,closed,complete:closed&&blocked.length===0,errors:[...new Set(errors)]};
}
`;

let engine = fs.readFileSync('workflow-engine.js','utf8');
if (!engine.includes("const INTAKE_MANIFEST_SCHEMA='closed-loop-intake-manifest/1'")) {
  engine = replaceOnce(engine,'function executionHandoff(',accountingCode+'\nfunction executionHandoff(','workflow-engine accounting insertion');
}
engine = replaceOnce(engine,
`    case 1:{
      if(!String(project.job.EXACT_USER_OBJECTIVE_VERBATIM||'').trim())reasons.push('Verbatim User Job Input is required.');
      requireAccepted();`,
`    case 1:{
      if(!String(project.job.EXACT_USER_OBJECTIVE_VERBATIM||'').trim())reasons.push('Verbatim User Job Input is required.');
      requireAccepted();
      const intake=evaluateIntakeCoverage(project);if(!intake.complete)reasons.push(...intake.errors.map(reason=>'Stage 01 intake accounting: '+reason));`,
'workflow-engine Stage 01 gate');
engine = replaceOnce(engine,
`    case 4:{
      requireAccepted();requireCount('requirements',1);`,
`    case 4:{
      requireAccepted();requireCount('requirements',1);const accounting=evaluateObligationAccounting(project);if(!accounting.closed)reasons.push(...accounting.errors.map(reason=>'Stage 04 obligation accounting: '+reason));if(accounting.blocked.length)reasons.push('Stage 04 contains blocked obligation dispositions: '+accounting.blocked.map(item=>item.obligationId).join(', ')+'.');`,
'workflow-engine Stage 04 gate');
engine = replaceOnce(engine,
"case 1:Object.assign(derived,{JOB_ID:project.job.JOB_ID,DATE_OPENED:project.job.DATE_OPENED,INPUT_SET_VERSION:project.job.CURRENT_INPUT_VERSION,INPUT_SET_HASH_OR_MANIFEST:project.job.INPUT_SET_HASH_OR_MANIFEST||'UNKNOWN',JOB_RECORD_STATUS:project.stages[1].status==='COMPLETE'?'READY':'NOT READY'});break;",
"case 1:{const intake=evaluateIntakeCoverage(project);Object.assign(derived,{JOB_ID:project.job.JOB_ID,DATE_OPENED:project.job.DATE_OPENED,INPUT_SET_VERSION:project.job.CURRENT_INPUT_VERSION,INPUT_SET_HASH_OR_MANIFEST:project.job.INPUT_SET_HASH_OR_MANIFEST||intake.manifest.manifestSha256,JOB_RECORD_STATUS:project.stages[1].status==='COMPLETE'?'READY':'NOT READY',INTAKE_COVERAGE_MANIFEST:intake.manifest,INTAKE_COVERAGE:intake.coverage,UNACCOUNTED_INPUT_UNITS:intake.missingUnitIds});break;}",
'workflow-engine Stage 01 derivation');
engine = replaceOnce(engine,
"case 4:Object.assign(derived,{REQUIREMENTS_VERSION:project.job.CURRENT_REQUIREMENTS_VERSION||'NOT APPLICABLE',TOTAL_REQUIREMENTS:recordsForCurrentScope(project,'requirements').length,MANDATORY_REQUIREMENTS:metrics.mandatoryRequirementCount});break;",
"case 4:{const accounting=evaluateObligationAccounting(project);Object.assign(derived,{REQUIREMENTS_VERSION:project.job.CURRENT_REQUIREMENTS_VERSION||'NOT APPLICABLE',TOTAL_REQUIREMENTS:recordsForCurrentScope(project,'requirements').length,MANDATORY_REQUIREMENTS:metrics.mandatoryRequirementCount,OBLIGATION_MANIFEST:accounting.manifest,OBLIGATION_ACCOUNTING_COVERAGE:accounting.coverage,UNACCOUNTED_OBLIGATIONS:accounting.missingObligationIds,BLOCKED_OBLIGATIONS:accounting.blocked.map(item=>item.obligationId)});break;}",
'workflow-engine Stage 04 derivation');
engine = replaceOnce(engine,
'currentScope,recordsForScope,recordsForCurrentScope,scopeForIteration,recordsForIteration,verificationMatrix,evaluateIteration,DERIVATIONS,coverageMetrics,convergenceMetrics,releaseMetrics,applicationTestCapabilities,capabilityAffirmativelyAvailable,testExecutionPlan,executionHandoff,',
'currentScope,recordsForScope,recordsForCurrentScope,scopeForIteration,recordsForIteration,verificationMatrix,evaluateIteration,DERIVATIONS,coverageMetrics,convergenceMetrics,releaseMetrics,intakeCoverageManifest,evaluateIntakeCoverage,obligationManifest,evaluateObligationAccounting,applicationTestCapabilities,capabilityAffirmativelyAvailable,testExecutionPlan,executionHandoff,',
'workflow-engine exports');
fs.writeFileSync('workflow-engine.js',engine);
console.log('patched workflow-engine.js');

let prompt = fs.readFileSync('prompt-engine.js','utf8');
prompt = replaceOnce(prompt,/const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine\/\d+';/,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/27';",'prompt version');
const procedureLines=prompt.split('\n');
const stage1Index=procedureLines.findIndex(line=>line.startsWith("1:'"));
const stage4Index=procedureLines.findIndex(line=>line.startsWith("4:'"));
if(stage1Index<0||stage4Index<0)fail('prompt stage procedure anchors missing');
procedureLines[stage1Index]="1:'Perform complete human-authority intake only. The application has enumerated every current controlled human-input unit in APPLICATION INTAKE MANIFEST. Account for every supplied unit exactly once and preserve every materially relevant fact, requirement, constraint, decision, prohibition, requested output, acceptance condition, material reference, and unresolved human-only issue. INPUT_SET_CONTENTS must be one JSON string using schema closed-loop-intake-capture/1 with exact root keys schema, inputVersion, manifestSha256, units, and optional conversationStatements. units must contain exactly one entry for every manifest unit, with exact keys sourceUnitId, disposition, reason, extractedStatements. Allowed dispositions are INCORPORATED, RETAINED_CONTEXT, UNRESOLVED_HUMAN_ONLY, LATER_RESOLVABLE, INAPPLICABLE. extractedStatements entries use exact keys statementKey, text, statementClass. Allowed statement classes are FACT, FACT_AFFECTING_REQUIREMENTS, REQUIREMENT, CONSTRAINT, DECISION, PROHIBITION, REQUESTED_OUTPUT, ACCEPTANCE_CONDITION, MATERIAL_REFERENCE, UNRESOLVED_HUMAN_ONLY. Conversation answers obtained after this prompt belong in conversationStatements with exact keys statementKey, question, text, statementClass, status; status is ANSWERED, UNKNOWN, or DEFERRED. Ask genuinely human-only questions conversationally before final JSON. The accepted capture is the durable meaning-preserving handoff to every later stage: never ask the human to attach, resend, retype, or summarize project information already supplied and captured. Do not perform source research, requirement atomization, test design, production, filing, simulation, manufacturing, or product verification.',";
procedureLines[stage4Index]="4:'Compile atomic requirement proposals only from APPLICATION OBLIGATION MANIFEST. That manifest is the complete application-generated input universe from current User Job Input, the accepted Stage 01 semantic capture, accepted Stage 01 job definition, and Stage 03 research. Do not rediscover an unspecified input universe and do not ask the human to attach, resend, retype, or summarize the original intent material again. For every obligationId, either map it to one or more proposed requirements by placing the exact obligationId in USER_INPUT_RELATIONSHIP, or provide exactly one evidence item with kind OBLIGATION_DISPOSITION and content equal to strict JSON containing only obligationId, disposition, and reason. Non-requirement dispositions are RETAINED_NONNORMATIVE_CONTEXT, INAPPLICABLE, or BLOCKED. An obligation cannot be both mapped and disposed. No obligation may disappear. Every proposed requirement must reference at least one obligation identity, remain independently testable where possible, preserve source identity/location where applicable, and define observable satisfaction, failure, evidence, applicability, dependencies, prohibitions, and severity. The application assigns requirement IDs, versions, hashes, scope, counts, and accounting coverage. If the application manifest is incomplete, return BLOCKED and identify the earlier-stage defect; do not request the same human material again.',";
prompt=procedureLines.join('\n');
prompt=replaceOnce(prompt,
`function contextFor(stage,state,operation,scope={}){
 const parts=[];`,
`function contextFor(stage,state,operation,scope={}){
 const parts=[];
 if(stage===1)parts.push('APPLICATION INTAKE MANIFEST\\n'+show(workflow.intakeCoverageManifest(state)));
 if(stage===4)parts.push('APPLICATION OBLIGATION MANIFEST\\n'+show(workflow.obligationManifest(state)));`,
'prompt context accounting manifests');
prompt=replaceOnce(prompt,
'contextManifest={stage,operation,scope,verificationBatchPlan:batchPlan,executionHandoff:promptHandoff,readCollections:',
'contextManifest={stage,operation,scope,intakeCoverageManifest:stage===1?workflow.intakeCoverageManifest(state):null,obligationManifest:stage===4?workflow.obligationManifest(state):null,verificationBatchPlan:batchPlan,executionHandoff:promptHandoff,readCollections:',
'prompt identity manifest binding');
fs.writeFileSync('prompt-engine.js',prompt);
console.log('patched prompt-engine.js');

let ingestion=fs.readFileSync('response-ingestion.js','utf8');
const semanticValidation=String.raw`  if(envelope.responseType==='DATA_PROPOSAL'&&stageNumber===1){
    const accounting=workflow.evaluateIntakeCoverage(project,envelope.stageData?.INPUT_SET_CONTENTS);
    for(const message of accounting.errors)issues.push(issue('INCOMPLETE_INTAKE_ACCOUNTING','/stageData/INPUT_SET_CONTENTS',message));
  }
  if(envelope.responseType==='DATA_PROPOSAL'&&stageNumber===4){
    const accounting=workflow.evaluateObligationAccounting(project,{requirements:safe(envelope.records?.requirements),evidence:safe(envelope.evidence)});
    for(const message of accounting.errors)issues.push(issue('INCOMPLETE_OBLIGATION_ACCOUNTING','/records/requirements',message));
  }
`;
if(!ingestion.includes('INCOMPLETE_INTAKE_ACCOUNTING')) ingestion=replaceOnce(ingestion,'  const canonicalEnvelopeSha256=hash.canonicalEnvelopeSha256(envelope);',semanticValidation+'\n  const canonicalEnvelopeSha256=hash.canonicalEnvelopeSha256(envelope);','response-ingestion accounting validation');
fs.writeFileSync('response-ingestion.js',ingestion);
console.log('patched response-ingestion.js');

let full=fs.readFileSync('verify-full-cycle.mjs','utf8');
full=replaceOnce(full,
"const s1=data(1,{stageData:{EXACT_DELIVERABLE_REQUESTED:'Verified deliverable',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:'Verbatim job input plus clarification.'}});",
"const intakeManifest=engine.intakeCoverageManifest(p),intakeCapture={schema:'closed-loop-intake-capture/1',inputVersion:intakeManifest.inputVersion,manifestSha256:intakeManifest.manifestSha256,units:intakeManifest.units.map((unit,index)=>({sourceUnitId:unit.sourceUnitId,disposition:'INCORPORATED',reason:'',extractedStatements:[{statementKey:'full-cycle-'+(index+1),text:String(unit.label||unit.sourceLocation),statementClass:unit.fieldName==='EXACT_USER_OBJECTIVE_VERBATIM'?'REQUESTED_OUTPUT':unit.fieldName==='EXPLICIT_USER_REQUIREMENTS'?'REQUIREMENT':unit.kind==='SUPPLIED_MATERIAL'?'MATERIAL_REFERENCE':'FACT'}]})),conversationStatements:[]};const s1=data(1,{stageData:{EXACT_DELIVERABLE_REQUESTED:'Verified deliverable',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(intakeCapture)}});",
'verify-full-cycle Stage 01 fixture');
full=replaceOnce(full,
"data(4,{records:{requirements:[recordProposal(schema,'requirements',{tempKey:'req',overrides:{OBLIGATION:'The deliverable must contain the required verified content.',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',USER_INPUT_RELATIONSHIP:'User Job Input',APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'Required content is present.',INTENDED_VERIFICATION_METHOD:'DETERMINISTIC_AND_INDEPENDENT_CONTENT_REVIEW',EXPECTED_EVIDENCE:'Canonical verification evidence',FAILURE_CONDITION:'Required content absent',SEVERITY:'MAJOR'}})]}});",
"const stage4Obligations=engine.obligationManifest(p).items,stage4Relationship=stage4Obligations.map(item=>item.obligationId).join(' ');data(4,{records:{requirements:[recordProposal(schema,'requirements',{tempKey:'req',overrides:{OBLIGATION:'The deliverable must satisfy every current application-enumerated obligation.',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',USER_INPUT_RELATIONSHIP:stage4Relationship,APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'Required content is present.',INTENDED_VERIFICATION_METHOD:'DETERMINISTIC_AND_INDEPENDENT_CONTENT_REVIEW',EXPECTED_EVIDENCE:'Canonical verification evidence',FAILURE_CONDITION:'Required content absent',SEVERITY:'MAJOR'}})]}});",
'verify-full-cycle Stage 04 fixture');
fs.writeFileSync('verify-full-cycle.mjs',full);
console.log('patched verify-full-cycle.mjs');

let vi=fs.readFileSync('verify-ingestion.mjs','utf8');
const start=vi.indexOf('function validEnvelope(p,stage,promptRecord){');
const end=vi.indexOf('function blockedEnvelope(',start);
if(start<0||end<0)fail('verify-ingestion validEnvelope anchors missing');
const validEnvelopeReplacement=String.raw`function fixtureIntakeCapture(p){const manifest=engine.intakeCoverageManifest(p);return {schema:'closed-loop-intake-capture/1',inputVersion:manifest.inputVersion,manifestSha256:manifest.manifestSha256,units:manifest.units.map((unit,index)=>({sourceUnitId:unit.sourceUnitId,disposition:'INCORPORATED',reason:'',extractedStatements:[{statementKey:'ingestion-'+(index+1),text:String(unit.label||unit.sourceLocation),statementClass:unit.fieldName==='EXACT_USER_OBJECTIVE_VERBATIM'?'REQUESTED_OUTPUT':unit.fieldName==='EXPLICIT_USER_REQUIREMENTS'?'REQUIREMENT':unit.kind==='SUPPLIED_MATERIAL'?'MATERIAL_REFERENCE':'FACT'}]})),conversationStatements:[]};}
function installStageOneCapture(p){const capture=fixtureIntakeCapture(p);p.job.INPUT_SET_CONTENTS=JSON.stringify(capture);p.job.EXACT_DELIVERABLE_REQUESTED='Verified deliverable';p.job.ASSUMPTIONS='NONE';p.job.UNKNOWN_INFORMATION='NONE';p.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'Verified deliverable',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture)};p.stages[1].acceptedData={...p.stages[1].agentData};return capture;}
function validEnvelope(p,stage,promptRecord){
  const contract=schema.STAGE_CONTRACTS[stage],operationContract=schema.operationContract(stage,promptRecord.operation),stageFields=operationContract?.allowedStageData||contract.allowedStageData,writableCollections=operationContract?.agentWritableCollections||contract.allowedCollections;
  const stageData={},records={};
  if(stage===1){const capture=fixtureIntakeCapture(p);Object.assign(stageData,{EXACT_DELIVERABLE_REQUESTED:'Verified deliverable',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture)});}
  else if(stage===4){const obligations=engine.obligationManifest(p).items,def=schema.RECORD_SCHEMAS.requirements,fields={};for(const name of def.required)if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)fields[name]=safeValue(name);fields.OBLIGATION='All enumerated fixture obligations are preserved.';fields.USER_INPUT_RELATIONSHIP=obligations.map(x=>x.obligationId).join(' ');fields.APPLICABILITY='APPLICABLE';records.requirements=[{tempKey:'record-1',fields,relationships:{},evidenceRefs:['evidence-1']}];}
  else {if(stageFields.length)stageData[stageFields[0]]=safeValue(stageFields[0]);if(!Object.keys(stageData).length){const collection=writableCollections.find(name=>name!=='blockers'&&schema.recordAgentFields(name).length)||writableCollections.find(name=>schema.recordAgentFields(name).length);if(!collection)return null;const def=schema.RECORD_SCHEMAS[collection],fields={};for(const name of def.required)if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)fields[name]=safeValue(name);if(!Object.keys(fields).length){const agentField=schema.recordAgentFields(collection)[0];if(agentField)fields[agentField]=safeValue(agentField);}records[collection]=[{tempKey:'record-1',fields,relationships:{},evidenceRefs:['evidence-1']}];}}
  return {schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:promptRecord.operation,promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},scope:promptRecord.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData,records,evidence:[{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:'Controlled verification evidence',location:'verification fixture',content:'stage-'+stage+'-evidence'}],unresolved:[],warnings:[],attachments:[]};
}
`;
vi=vi.slice(0,start)+validEnvelopeReplacement+vi.slice(end);
const stageLoopAnchor="  p.activeStage=stage;\n  const promptRecord=savePrompt(p,stage);";
if(vi.includes(stageLoopAnchor))vi=vi.replace(stageLoopAnchor,"  p.activeStage=stage;\n  if(stage===4)installStageOneCapture(p);\n  const promptRecord=savePrompt(p,stage);");
else console.log('verify-ingestion stage loop anchor not found; standalone validEnvelope still patched');
fs.writeFileSync('verify-ingestion.mjs',vi);
console.log('patched verify-ingestion.mjs');

const focused=String.raw`import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion;
let p=core.createBlankState('JOB-CLOSED-ACCOUNTING');
Object.assign(p.job,{JOB_TITLE:'Closed accounting fixture',EXACT_USER_OBJECTIVE_VERBATIM:'Build a controlled product.',SUPPLIED_MATERIALS_INVENTORY:JSON.stringify([{type:'FILE',exactNameOrReference:'intent.pdf'}]),EXPLICIT_USER_REQUIREMENTS:'Never ask for project-relevant information twice.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'NOT APPLICABLE'});
engine.ensureShape(p);engine.recalculate(p);
const manifest=engine.intakeCoverageManifest(p);
assert.ok(manifest.units.length>=3);
const captureFor=units=>({schema:'closed-loop-intake-capture/1',inputVersion:manifest.inputVersion,manifestSha256:manifest.manifestSha256,units:units.map((unit,index)=>({sourceUnitId:unit.sourceUnitId,disposition:'INCORPORATED',reason:'',extractedStatements:[{statementKey:'s-'+(index+1),text:unit.kind==='SUPPLIED_MATERIAL'?'The supplied intent contains controlling human project authority.':String(unit.rawValue),statementClass:unit.fieldName==='EXACT_USER_OBJECTIVE_VERBATIM'?'REQUESTED_OUTPUT':unit.fieldName==='EXPLICIT_USER_REQUIREMENTS'?'REQUIREMENT':unit.kind==='SUPPLIED_MATERIAL'?'MATERIAL_REFERENCE':'FACT'}]})),conversationStatements:[]});
const prompt1=prompts.buildPromptRecord(1,p);
const env1=capture=>({schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage:1,operation:prompt1.operation,promptIdentity:{instructionId:prompt1.instructionId,bodySha256:prompt1.bodySha256,contractSha256:prompt1.contractSha256,contextSignature:prompt1.contextSignature},scope:prompt1.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{EXACT_DELIVERABLE_REQUESTED:'Controlled product',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture)},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]});
let x=ingestion.prepare(p,{stage:1,text:JSON.stringify(env1(captureFor(manifest.units.slice(1)))),promptRecord:prompt1});
assert.equal(x.validation.valid,false);assert.ok(x.validation.issues.some(i=>i.code==='INCOMPLETE_INTAKE_ACCOUNTING'));
x=ingestion.prepare(p,{stage:1,text:JSON.stringify(env1(captureFor(manifest.units))),promptRecord:prompt1});
assert.equal(x.validation.valid,true,JSON.stringify(x.validation.issues));
p=ingestion.commit(x.project,x.proposal.proposalId,{operator:'TEST'}).project;
assert.equal(engine.evaluateIntakeCoverage(p).complete,true);
const prompt4=prompts.buildPromptRecord(4,p),obligations=engine.obligationManifest(p).items;
assert.ok(prompt4.prompt.includes('APPLICATION OBLIGATION MANIFEST'));assert.ok(obligations.length>0);
const handoff=engine.executionHandoff(p,{stage:4,operation:'COMPLETE'});assert.equal(handoff.send.length,0);assert.ok(!/FILES YOU MUST RECEIVE[\s\S]*intent\.pdf/i.test(prompt4.prompt));
const requirement=ids=>({tempKey:'req-1',fields:{OBLIGATION:'All mapped obligations are preserved.',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',SOURCE_LOCATION:'APPLICATION OBLIGATION MANIFEST',SOURCE_AUTHORITY:'HUMAN',USER_INPUT_RELATIONSHIP:ids.join(' '),APPLICABILITY:'APPLICABLE',DEPENDENCIES:'NONE',PROHIBITIONS:'NONE',DEFINED_TERMS:'NONE',OBSERVABLE_SATISFACTION_CONDITION:'All mapped obligations are satisfied.',INTENDED_VERIFICATION_METHOD:'DETERMINISTIC_AND_INDEPENDENT_CONTENT_REVIEW',EXPECTED_EVIDENCE:'Current sufficient evidence',FAILURE_CONDITION:'A mapped obligation is not satisfied.',SEVERITY:'MAJOR',NOTES:''},relationships:{},evidenceRefs:['evidence-1']});
const env4=ids=>({schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage:4,operation:prompt4.operation,promptIdentity:{instructionId:prompt4.instructionId,bodySha256:prompt4.bodySha256,contractSha256:prompt4.contractSha256,contextSignature:prompt4.contextSignature},scope:prompt4.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{requirements:[requirement(ids)]},evidence:[{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:'fixture',location:'fixture',content:'fixture'}],unresolved:[],warnings:[],attachments:[]});
const ids=obligations.map(o=>o.obligationId);
x=ingestion.prepare(p,{stage:4,text:JSON.stringify(env4(ids.slice(1))),promptRecord:prompt4});assert.equal(x.validation.valid,false);assert.ok(x.validation.issues.some(i=>i.code==='INCOMPLETE_OBLIGATION_ACCOUNTING'));
x=ingestion.prepare(p,{stage:4,text:JSON.stringify(env4(ids)),promptRecord:prompt4});assert.equal(x.validation.valid,true,JSON.stringify(x.validation.issues));
assert.equal(engine.evaluateObligationAccounting(p,{requirements:env4(ids).records.requirements,evidence:env4(ids).evidence}).closed,true);
const html=fs.readFileSync('index.html','utf8');assert.ok(html.includes('.prompt{height:clamp(260px,45vh,520px);max-height:80vh'));assert.ok(html.includes('.expandable-prompt{max-height:280px}'));
console.log(JSON.stringify({stage01ControlledInputAccounting:1,stage04ObligationAccounting:1,repeatedIntentAttachmentRequired:false,visualBaselinePreserved:true},null,2));
`;
fs.writeFileSync('verify-stage01-stage04-accounting.mjs',focused);
console.log('created focused accounting regression');

let pages=fs.readFileSync('.github/workflows/pages.yml','utf8');
if(!pages.includes('verify-stage01-stage04-accounting.mjs')){
  pages=replaceOnce(pages,'          node --check verify-test-runtime.mjs\n','          node --check verify-test-runtime.mjs\n          node --check verify-stage01-stage04-accounting.mjs\n','CI syntax insertion');
  pages=replaceOnce(pages,'          node verify-complete.mjs\n','          node verify-complete.mjs\n          node verify-stage01-stage04-accounting.mjs\n','CI test insertion');
  pages=replaceOnce(pages,'node verify-ingestion.mjs && node verify-complete.mjs && node verify-full-cycle.mjs','node verify-ingestion.mjs && node verify-complete.mjs && node verify-stage01-stage04-accounting.mjs && node verify-full-cycle.mjs','deploy test insertion');
}
fs.writeFileSync('.github/workflows/pages.yml',pages);
console.log('patched pages workflow');
