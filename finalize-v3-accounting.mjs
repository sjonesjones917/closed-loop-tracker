import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const write=(path,value)=>fs.writeFileSync(path,value);
const replaceOnce=(text,pattern,replacement,label)=>{
  const next=text.replace(pattern,replacement);
  if(next===text)throw new Error(`Patch anchor not found: ${label}`);
  return next;
};
const removeBlock=(text,pattern,label)=>replaceOnce(text,pattern,'',label);

const accountingCode=String.raw`
const INTAKE_MANIFEST_SCHEMA='closed-loop-intake-manifest/1';
const INTAKE_CAPTURE_SCHEMA='closed-loop-intake-capture/1';
const OBLIGATION_MANIFEST_SCHEMA='closed-loop-obligation-manifest/1';
const INTAKE_DISPOSITIONS=Object.freeze(['INCORPORATED','RETAINED_CONTEXT','UNRESOLVED_HUMAN_ONLY','LATER_RESOLVABLE','INAPPLICABLE']);
const INTAKE_STATEMENT_CLASSES=Object.freeze(['FACT','FACT_AFFECTING_REQUIREMENTS','REQUIREMENT','CONSTRAINT','DECISION','PROHIBITION','REQUESTED_OUTPUT','ACCEPTANCE_CONDITION','MATERIAL_REFERENCE','UNRESOLVED_HUMAN_ONLY']);
const CONVERSATION_STATUSES=Object.freeze(['ANSWERED','UNKNOWN','DEFERRED']);
const OBLIGATION_NONREQUIREMENT_DISPOSITIONS=Object.freeze(['RETAINED_NONNORMATIVE_CONTEXT','INAPPLICABLE','BLOCKED']);
const accountingId=(prefix,payload)=>prefix+'-'+hash.sha256Value(payload).slice(0,24).toUpperCase();
const meaningfulAuthorityValue=value=>value!==undefined&&value!==null&&String(typeof value==='string'?value:JSON.stringify(value)).trim()&&!['UNKNOWN','NONE','NOT APPLICABLE','UNASSIGNED','PENDING'].includes(upper(typeof value==='string'?value:JSON.stringify(value)));
const accountingKeys=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.keys(value).filter(key=>!allowed.includes(key)):['<NOT_OBJECT>'];
function intakeCoverageManifest(project){
  ensureShape(project);
  const job=project.job||{},inputVersion=String(job.CURRENT_INPUT_VERSION||'UNKNOWN'),units=[],add=(kind,sourceLocation,label,value,extra={})=>{
    if(!meaningfulAuthorityValue(value))return;
    const rawValueSha256=hash.sha256Value(value),unitId=accountingId('INPUT-UNIT',{jobId:job.JOB_ID,inputVersion,kind,sourceLocation,rawValueSha256});
    units.push({unitId,kind,sourceLocation,label:String(label||sourceLocation),rawValueSha256,inputVersion,...clone(extra)});
  };
  for(const [name,definition] of Object.entries(schema.JOB_FIELDS||{})){
    if(!['HUMAN','HUMAN_DECISION'].includes(String(definition?.producer||''))||name==='SUPPLIED_MATERIALS_INVENTORY')continue;
    add(definition.producer==='HUMAN_DECISION'?'HUMAN_DECISION':'JOB_FIELD','job.'+name,name,job[name]);
  }
  const artifacts=records(project,'artifacts').filter(isActiveRecord),basename=value=>String(value||'').trim().replaceAll('\\','/').split('/').pop().toLowerCase();
  for(const reference of suppliedMaterialReferences(project)){
    const matches=artifacts.filter(artifact=>basename(recordValue(artifact,'FILENAME'))===basename(reference.label)),artifact=matches.length===1?matches[0]:null;
    add('SUPPLIED_MATERIAL','job.SUPPLIED_MATERIALS_INVENTORY',reference.label,reference,{materialType:reference.type,transferMode:reference.transferMode,artifactId:artifact?recordId(artifact,'artifacts'):null,artifactSha256:artifact?String(recordValue(artifact,'SHA256')||''):null,artifactAvailability:artifact?String(recordValue(artifact,'AVAILABILITY')||''):null});
  }
  for(const answer of safe(project.projectData?.humanInputAnswers).filter(item=>Number(item.stage||1)===1&&String(item.inputVersion||inputVersion)===inputVersion&&!item.invalidatedBy)){
    add('HUMAN_ANSWER','projectData.humanInputAnswers/'+String(answer.answerId||answer.requestId||'UNKNOWN'),answer.question||answer.requestId||'Human answer',answer.answer,{answerId:answer.answerId||null,requestId:answer.requestId||null,answerType:answer.answerType||'UNKNOWN'});
  }
  units.sort((a,b)=>a.unitId.localeCompare(b.unitId));
  const base={schema:INTAKE_MANIFEST_SCHEMA,jobId:String(job.JOB_ID||'UNKNOWN'),inputVersion,units,unitCount:units.length};
  return {...base,manifestSha256:hash.sha256Value(base)};
}
function parseIntakeCaptureValue(value){
  if(value&&typeof value==='object'&&!Array.isArray(value))return clone(value);
  if(typeof value!=='string'||!value.trim())return null;
  try{const parsed=JSON.parse(value);return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:null;}catch{return null;}
}
function evaluateIntakeCoverage(project,captureOverride){
  const manifest=intakeCoverageManifest(project),source=captureOverride!==undefined?captureOverride:(project.stages?.[1]?.agentData?.INPUT_SET_CONTENTS??project.stages?.[1]?.acceptedData?.INPUT_SET_CONTENTS),capture=parseIntakeCaptureValue(source),errors=[],normalizedUnits=[],normalizedConversation=[];
  if(!capture)return {manifest,capture:null,coverage:0,accountedUnitIds:[],missingUnitIds:manifest.units.map(unit=>unit.unitId),unknownUnitIds:[],errors:['INPUT_SET_CONTENTS is not a valid structured intake capture.'],capturedStatements:[],complete:false};
  const rootUnknown=accountingKeys(capture,['schema','inputVersion','manifestSha256','units','conversationStatements']);if(rootUnknown.length)errors.push('Unknown intake-capture root properties: '+rootUnknown.join(', ')+'.');
  if(capture.schema!==INTAKE_CAPTURE_SCHEMA)errors.push('Intake capture schema must be '+INTAKE_CAPTURE_SCHEMA+'.');
  if(String(capture.inputVersion||'')!==manifest.inputVersion)errors.push('Intake capture inputVersion does not match the current controlled input version.');
  if(String(capture.manifestSha256||'')!==manifest.manifestSha256)errors.push('Intake capture manifestSha256 does not match the controlling intake manifest.');
  if(!Array.isArray(capture.units))errors.push('Intake capture units must be an array.');
  if(capture.conversationStatements!==undefined&&!Array.isArray(capture.conversationStatements))errors.push('conversationStatements must be an array when present.');
  const expected=new Set(manifest.units.map(unit=>unit.unitId)),seen=new Set(),unknownUnitIds=[];
  for(const [index,unit] of safe(capture.units).entries()){
    const unknown=accountingKeys(unit,['sourceUnitId','disposition','reason','extractedStatements']);if(unknown.length)errors.push('units['+index+'] has unknown properties: '+unknown.join(', ')+'.');
    const sourceUnitId=String(unit?.sourceUnitId||''),disposition=upper(unit?.disposition),reason=String(unit?.reason||'').trim();
    if(!sourceUnitId)errors.push('units['+index+'] is missing sourceUnitId.');
    if(seen.has(sourceUnitId))errors.push('Duplicate intake sourceUnitId '+sourceUnitId+'.');seen.add(sourceUnitId);
    if(sourceUnitId&&!expected.has(sourceUnitId))unknownUnitIds.push(sourceUnitId);
    if(!INTAKE_DISPOSITIONS.includes(disposition))errors.push(sourceUnitId+': invalid disposition '+String(unit?.disposition||'MISSING')+'.');
    if(disposition==='INAPPLICABLE'&&!reason)errors.push(sourceUnitId+': INAPPLICABLE requires a reason.');
    if(!Array.isArray(unit?.extractedStatements))errors.push(sourceUnitId+': extractedStatements must be an array.');
    if(disposition&&disposition!=='INAPPLICABLE'&&Array.isArray(unit?.extractedStatements)&&!unit.extractedStatements.length)errors.push(sourceUnitId+': materially relevant statements were not captured.');
    const statementKeys=new Set(),statements=[];
    for(const [statementIndex,statement] of safe(unit?.extractedStatements).entries()){
      const statementUnknown=accountingKeys(statement,['statementKey','text','statementClass']);if(statementUnknown.length)errors.push(sourceUnitId+'.extractedStatements['+statementIndex+'] has unknown properties: '+statementUnknown.join(', ')+'.');
      const statementKey=String(statement?.statementKey||'').trim(),text=String(statement?.text||'').trim(),statementClass=upper(statement?.statementClass);
      if(!statementKey)errors.push(sourceUnitId+': statementKey is required.');if(statementKeys.has(statementKey))errors.push(sourceUnitId+': duplicate statementKey '+statementKey+'.');statementKeys.add(statementKey);
      if(!text)errors.push(sourceUnitId+': statement text is required.');if(!INTAKE_STATEMENT_CLASSES.includes(statementClass))errors.push(sourceUnitId+': invalid statementClass '+String(statement?.statementClass||'MISSING')+'.');
      if(statementKey&&text&&INTAKE_STATEMENT_CLASSES.includes(statementClass))statements.push({statementId:accountingId('INPUT-STATEMENT',{sourceUnitId,statementKey,text,statementClass}),sourceUnitId,statementKey,text,statementClass,disposition});
    }
    normalizedUnits.push({sourceUnitId,disposition,reason,extractedStatements:statements});
  }
  const conversationKeys=new Set();
  for(const [index,statement] of safe(capture.conversationStatements).entries()){
    const unknown=accountingKeys(statement,['statementKey','question','text','statementClass','status']);if(unknown.length)errors.push('conversationStatements['+index+'] has unknown properties: '+unknown.join(', ')+'.');
    const statementKey=String(statement?.statementKey||'').trim(),question=String(statement?.question||'').trim(),text=String(statement?.text||'').trim(),statementClass=upper(statement?.statementClass),status=upper(statement?.status);
    if(!statementKey)errors.push('conversationStatements['+index+'] is missing statementKey.');if(conversationKeys.has(statementKey))errors.push('Duplicate conversation statementKey '+statementKey+'.');conversationKeys.add(statementKey);
    if(!question)errors.push(statementKey+': the human question is required.');if(!text)errors.push(statementKey+': the human answer or explicit UNKNOWN/DEFERRED value is required.');if(!INTAKE_STATEMENT_CLASSES.includes(statementClass))errors.push(statementKey+': invalid statementClass.');if(!CONVERSATION_STATUSES.includes(status))errors.push(statementKey+': status must be ANSWERED, UNKNOWN, or DEFERRED.');
    if(statementKey&&question&&text&&INTAKE_STATEMENT_CLASSES.includes(statementClass)&&CONVERSATION_STATUSES.includes(status))normalizedConversation.push({statementId:accountingId('INPUT-STATEMENT',{inputVersion:manifest.inputVersion,statementKey,question,text,statementClass,status}),sourceUnitId:null,statementKey,question,text,statementClass,status,disposition:status==='ANSWERED'?'INCORPORATED':'UNRESOLVED_HUMAN_ONLY'});
  }
  const accountedUnitIds=[...seen].filter(id=>expected.has(id)),missingUnitIds=manifest.units.map(unit=>unit.unitId).filter(id=>!seen.has(id)),coverage=manifest.unitCount?accountedUnitIds.length/manifest.unitCount:0;
  if(missingUnitIds.length)errors.push('Unaccounted intake units: '+missingUnitIds.join(', ')+'.');if(unknownUnitIds.length)errors.push('Unknown intake unit identities: '+unknownUnitIds.join(', ')+'.');
  return {manifest,capture,coverage,accountedUnitIds,missingUnitIds,unknownUnitIds,errors,capturedStatements:[...normalizedUnits.flatMap(unit=>unit.extractedStatements),...normalizedConversation],normalizedUnits,normalizedConversation,complete:errors.length===0&&coverage===1};
}
function obligationFragments(value){
  if(value===undefined||value===null)return [];
  if(Array.isArray(value))return value.flatMap(obligationFragments);
  if(typeof value==='object')return [JSON.stringify(value)];
  const text=String(value).trim();if(!text||['NONE','UNKNOWN','NOT APPLICABLE'].includes(upper(text)))return [];
  return text.split(/\r?\n/).map(line=>line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/,'').trim()).filter(Boolean);
}
function obligationManifest(project){
  ensureShape(project);
  const job=project.job||{},inputVersion=String(job.CURRENT_INPUT_VERSION||'UNKNOWN'),sourceSetVersion=String(job.CURRENT_SOURCE_SET_VERSION||'NOT APPLICABLE'),intake=evaluateIntakeCoverage(project),items=[],seen=new Set(),add=(text,origin,provenance,sourceIdentity=null)=>{
    const clean=String(text||'').trim();if(!clean)return;
    const obligationId=accountingId('OBLIGATION',{jobId:job.JOB_ID,inputVersion,sourceSetVersion,origin,provenance,text:clean});if(seen.has(obligationId))return;seen.add(obligationId);items.push({obligationId,text:clean,origin,provenance:clone(provenance),sourceIdentity});
  };
  const obligationClasses=new Set(['FACT_AFFECTING_REQUIREMENTS','REQUIREMENT','CONSTRAINT','DECISION','PROHIBITION','REQUESTED_OUTPUT','ACCEPTANCE_CONDITION','UNRESOLVED_HUMAN_ONLY']);
  for(const statement of intake.capturedStatements||[]){if(!obligationClasses.has(statement.statementClass)||statement.disposition==='INAPPLICABLE'||statement.disposition==='RETAINED_CONTEXT')continue;add(statement.text,'STAGE01_CAPTURED_HUMAN_AUTHORITY',{statementId:statement.statementId,sourceUnitId:statement.sourceUnitId,statementKey:statement.statementKey,inputVersion,status:statement.status||null});}
  for(const text of obligationFragments(project.stages?.[1]?.agentData?.EXACT_DELIVERABLE_REQUESTED||job.EXACT_DELIVERABLE_REQUESTED))add(text,'STAGE01_JOB_DEFINITION',{field:'EXACT_DELIVERABLE_REQUESTED',inputVersion});
  for(const text of obligationFragments(project.stages?.[1]?.agentData?.UNKNOWN_INFORMATION||job.UNKNOWN_INFORMATION))add(text,'STAGE01_UNRESOLVED_HUMAN_AUTHORITY',{field:'UNKNOWN_INFORMATION',inputVersion});
  for(const candidate of recordsForCurrentScope(project,'candidateRequirements')){const text=String(recordValue(candidate,'CANDIDATE_OBLIGATION')||'').trim();if(!text)continue;const candidateRequirementId=recordId(candidate,'candidateRequirements'),sourceId=String(recordValue(candidate,'SOURCE_ID')||candidate.relationships?.SOURCE_ID||'').trim()||null;add(text,'STAGE03_CANDIDATE_REQUIREMENT',{candidateRequirementId,recordSha256:candidate.recordSha256||candidate.sha256||null,sourceId,sourceSetVersion},sourceId);}
  const researchFields=['MANDATORY_STATEMENTS','RECOMMENDATIONS','OPTIONAL_PRACTICES','PROHIBITIONS','EXCEPTIONS','DEPENDENCIES','APPLICABILITY_FACTS','RESTRICTIONS','INVALIDATING_MATERIAL'];
  for(const research of recordsForCurrentScope(project,'research')){const researchId=recordId(research,'research'),sourceId=String(recordValue(research,'SOURCE_ID')||research.relationships?.SOURCE_ID||'').trim()||null;for(const field of researchFields)for(const [index,text] of obligationFragments(recordValue(research,field)).entries())add(text,'STAGE03_SOURCE_RESEARCH',{researchId,field,index,recordSha256:research.recordSha256||research.sha256||null,sourceId,sourceSetVersion},sourceId);}
  items.sort((a,b)=>a.obligationId.localeCompare(b.obligationId));
  const base={schema:OBLIGATION_MANIFEST_SCHEMA,jobId:String(job.JOB_ID||'UNKNOWN'),inputVersion,sourceSetVersion,intakeManifestSha256:intake.manifest.manifestSha256,intakeCaptureComplete:intake.complete,items,obligationCount:items.length};
  return {...base,manifestSha256:hash.sha256Value(base)};
}
const obligationIdsFromValue=value=>[...new Set((String(value||'').match(/OBLIGATION-[A-F0-9]{24}/g)||[]))];
function parseObligationDispositionEvidence(item,index,errors){
  const kind=upper(item?.kind??item?.KIND??item?.fields?.KIND);if(kind!=='OBLIGATION_DISPOSITION')return null;
  const raw=item?.content??item?.CONTENT??item?.fields?.CONTENT;let value=raw;if(typeof raw==='string')try{value=JSON.parse(raw);}catch{errors.push('OBLIGATION_DISPOSITION evidence '+index+' content is not valid JSON.');return null;}
  const unknown=accountingKeys(value,['obligationId','disposition','reason']);if(unknown.length){errors.push('OBLIGATION_DISPOSITION evidence '+index+' has unknown properties: '+unknown.join(', ')+'.');return null;}
  const obligationId=String(value?.obligationId||''),disposition=upper(value?.disposition),reason=String(value?.reason||'').trim();if(!obligationId)errors.push('OBLIGATION_DISPOSITION evidence '+index+' is missing obligationId.');if(!OBLIGATION_NONREQUIREMENT_DISPOSITIONS.includes(disposition))errors.push(obligationId+': invalid non-requirement disposition.');if(!reason)errors.push(obligationId+': non-requirement disposition requires a reason.');return obligationId&&OBLIGATION_NONREQUIREMENT_DISPOSITIONS.includes(disposition)&&reason?{obligationId,disposition,reason}:null;
}
function evaluateObligationAccounting(project,options={}){
  const manifest=obligationManifest(project),requirements=options.requirements!==undefined?safe(options.requirements):recordsForCurrentScope(project,'requirements'),evidence=options.evidence!==undefined?safe(options.evidence):recordsForCurrentScope(project,'evidenceRecords').filter(item=>Number(item.stage)===4),expected=new Set(manifest.items.map(item=>item.obligationId)),mapped=new Map(),dispositions=new Map(),errors=[],unmappedRequirementIndexes=[];
  for(const [index,requirement] of requirements.entries()){
    const fields=requirement?.fields&&typeof requirement.fields==='object'?requirement.fields:requirement||{},ids=obligationIdsFromValue(fields.USER_INPUT_RELATIONSHIP??requirement.USER_INPUT_RELATIONSHIP);
    if(!ids.length){unmappedRequirementIndexes.push(index);errors.push('Requirement '+index+' does not reference an obligation-manifest identity.');continue;}
    for(const id of ids){if(!expected.has(id))errors.push('Requirement '+index+' references unknown obligation '+id+'.');if(!mapped.has(id))mapped.set(id,[]);mapped.get(id).push(index);}
  }
  for(const [index,item] of evidence.entries()){
    const disposition=parseObligationDispositionEvidence(item,index,errors);if(!disposition)continue;
    if(!expected.has(disposition.obligationId))errors.push('Disposition references unknown obligation '+disposition.obligationId+'.');if(dispositions.has(disposition.obligationId))errors.push('Duplicate disposition for '+disposition.obligationId+'.');dispositions.set(disposition.obligationId,disposition);
  }
  for(const id of expected)if(mapped.has(id)&&dispositions.has(id))errors.push(id+' is both mapped to a requirement and given a non-requirement disposition.');
  const accounted=[...expected].filter(id=>mapped.has(id)||dispositions.has(id)),missingObligationIds=[...expected].filter(id=>!mapped.has(id)&&!dispositions.has(id)),blocked=[...dispositions.values()].filter(item=>item.disposition==='BLOCKED');if(missingObligationIds.length)errors.push('Unaccounted obligations: '+missingObligationIds.join(', ')+'.');if(!manifest.intakeCaptureComplete)errors.push('Stage 01 intake capture is not complete for the current input version.');
  const coverage=manifest.obligationCount?accounted.length/manifest.obligationCount:0,closed=errors.length===0&&coverage===1;
  return {manifest,coverage,accountedObligationIds:accounted,missingObligationIds,unmappedRequirementIndexes,blocked,errors,closed,complete:closed&&blocked.length===0};
}
`;

// workflow-schema.js: human-decision ownership and static Test IR authority.
{
  const path='workflow-schema.js';let text=read(path);
  text=replaceOnce(text,/const HUMAN_JOB_FIELDS=Object\.freeze\(\[\n\s*'JOB_TITLE','JOB_OWNER','EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY',/,
`const HUMAN_DECISION_JOB_FIELDS=Object.freeze(['JOB_TITLE','JOB_OWNER']);\nconst HUMAN_JOB_FIELDS=Object.freeze([\n  'EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY',`,'human-decision job fields');
  text=replaceOnce(text,/function jobFieldDefinition\(name\)\{\n\s*if\(APPLICATION_JOB_FIELDS\.includes\(name\)\)/,
`function jobFieldDefinition(name){\n  if(HUMAN_DECISION_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN_DECISION,{provenanceRequired:false,nullable:true});\n  if(APPLICATION_JOB_FIELDS.includes(name))`,'jobFieldDefinition human decision');
  text=replaceOnce(text,/\[\.\.\.new Set\(\[\.\.\.HUMAN_JOB_FIELDS,\.\.\.APPLICATION_JOB_FIELDS,\.\.\.AGENT_JOB_FIELDS\]\)\]/,
`[...new Set([...HUMAN_DECISION_JOB_FIELDS,...HUMAN_JOB_FIELDS,...APPLICATION_JOB_FIELDS,...AGENT_JOB_FIELDS])]`,'job field union');
  text=text.replace(`      "EXECUTABLE_KIND",\n      "EXECUTABLE_SPEC_VERSION",\n      "EXECUTABLE_SPEC",`,`      "EXECUTABLE_KIND",\n      "EXECUTABLE_SPEC",`);
  text=text.replace(`      "TEST_ID",\n      "REQ_ID",\n      "STATUS"\n    ]\n  },`,`      "TEST_ID",\n      "REQ_ID",\n      "STATUS",\n      "EXECUTABLE_SPEC_VERSION",\n      "EXECUTABLE_SPEC_SHA256"\n    ]\n  },`);
  text=text.replace(`EXECUTABLE_INPUT_BINDINGS:Object.freeze({valueType:VALUE_TYPES.OBJECT,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null})`,`EXECUTABLE_INPUT_BINDINGS:Object.freeze({valueType:VALUE_TYPES.OBJECT,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),\n    EXECUTABLE_SPEC_SHA256:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null})`);
  text=text.replace(`'EXECUTABLE_SPEC','EXECUTABLE_INPUT_BINDINGS','INPUTS'`,`'EXECUTABLE_SPEC','EXECUTABLE_INPUT_BINDINGS','EXECUTABLE_SPEC_SHA256','INPUTS'`);
  text=text.replace(`version:'closed-loop-workflow-schema/2'`,`version:'closed-loop-workflow-schema/3'`);
  text=text.replace(`JOB_FIELDS,HUMAN_JOB_FIELDS,APPLICATION_JOB_FIELDS,AGENT_JOB_FIELDS,HUMAN_INTAKE_FIELDS,`,`JOB_FIELDS,HUMAN_DECISION_JOB_FIELDS,HUMAN_JOB_FIELDS,APPLICATION_JOB_FIELDS,AGENT_JOB_FIELDS,HUMAN_INTAKE_FIELDS,`);
  write(path,text);
}

// workflow-engine.js: application-owned Stage 01 and Stage 04 closure and no repeated intent-file handoff.
{
  const path='workflow-engine.js';let text=read(path);
  if(!text.includes("const INTAKE_MANIFEST_SCHEMA='closed-loop-intake-manifest/1'"))text=replaceOnce(text,'function executionHandoff(project,{stage,operation,testIds=null,runIds=null}={}){',accountingCode+'\nfunction executionHandoff(project,{stage,operation,testIds=null,runIds=null}={}){','accounting helper insertion');
  text=replaceOnce(text,/\n  if\(stage===4\)\{[\s\S]*?\n  \}\n  for\(const item of items\)/,'\n  for(const item of items)','remove Stage 04 repeated file handoff');
  text=replaceOnce(text,/\n  if\(stage===4\)\{const handoff=executionHandoff\(project,\{stage:4,operation:'COMPLETE'\}\),materials=handoff\.conversationMaterials\.map\(item=>item\.label\);if\(materials\.length\)return actionEnvelope\(project,stage,\{actionType:'CONTINUE_AGENT_CONVERSATION',[\s\S]*?\}\);\}/,
`\n  if(stage===4){const intake=evaluateIntakeCoverage(project);if(!intake.complete)return actionEnvelope(project,stage,{actionType:'BLOCKED',heading:'Complete the Stage 01 semantic capture once',explanation:'The current input version has not been completely captured into the application-owned intake manifest. Return to Stage 01 and complete that capture. Do not keep attaching the original intent file to later stages.',blockingReason:intake.errors.join(' '),newPromptRequired:true});return actionEnvelope(project,stage,{actionType:'PASTE_FINAL_JSON',heading:'Compile requirements from the captured obligation manifest',explanation:'The Stage 04 prompt contains the complete application-generated obligation universe from current human authority, the accepted Stage 01 capture, and Stage 03 research. Do not attach the original intent file again. Return one final JSON response that accounts for every obligation identity.',primaryButton:'Paste final JSON'});}`,'replace Stage 04 next action');
  text=replaceOnce(text,/case 1:\{\n\s*if\(!String\(project\.job\.EXACT_USER_OBJECTIVE_VERBATIM\|\|''\)\.trim\(\)\)reasons\.push\('Verbatim User Job Input is required\.'\);\n\s*requireAccepted\(\);/,
`case 1:{\n      if(!String(project.job.EXACT_USER_OBJECTIVE_VERBATIM||'').trim())reasons.push('Verbatim User Job Input is required.');\n      requireAccepted();const intake=evaluateIntakeCoverage(project);if(!intake.complete)reasons.push(...intake.errors.map(reason=>'Stage 01 intake accounting: '+reason));`,'Stage 01 gate accounting');
  text=replaceOnce(text,/case 4:\{\n\s*requireAccepted\(\);requireCount\('requirements',1\);/,
`case 4:{\n      requireAccepted();requireCount('requirements',1);const accounting=evaluateObligationAccounting(project);if(!accounting.closed)reasons.push(...accounting.errors.map(reason=>'Stage 04 obligation accounting: '+reason));if(accounting.blocked.length)reasons.push('Stage 04 contains blocked obligation dispositions: '+accounting.blocked.map(item=>item.obligationId).join(', ')+'.');`,'Stage 04 gate accounting');
  text=text.replace(`case 1:Object.assign(derived,{JOB_ID:project.job.JOB_ID,DATE_OPENED:project.job.DATE_OPENED,INPUT_SET_VERSION:project.job.CURRENT_INPUT_VERSION,INPUT_SET_HASH_OR_MANIFEST:project.job.INPUT_SET_HASH_OR_MANIFEST||'UNKNOWN',JOB_RECORD_STATUS:project.stages[1].status==='COMPLETE'?'READY':'NOT READY'});break;`,
`case 1:{const intake=evaluateIntakeCoverage(project);Object.assign(derived,{JOB_ID:project.job.JOB_ID,DATE_OPENED:project.job.DATE_OPENED,INPUT_SET_VERSION:project.job.CURRENT_INPUT_VERSION,INPUT_SET_HASH_OR_MANIFEST:project.job.INPUT_SET_HASH_OR_MANIFEST||intake.manifest.manifestSha256,JOB_RECORD_STATUS:project.stages[1].status==='COMPLETE'?'READY':'NOT READY',INTAKE_COVERAGE_MANIFEST:intake.manifest,INTAKE_COVERAGE:intake.coverage,UNACCOUNTED_INPUT_UNITS:intake.missingUnitIds});break;}`);
  text=text.replace(`case 4:Object.assign(derived,{REQUIREMENTS_VERSION:project.job.CURRENT_REQUIREMENTS_VERSION||'NOT APPLICABLE',TOTAL_REQUIREMENTS:recordsForCurrentScope(project,'requirements').length,MANDATORY_REQUIREMENTS:metrics.mandatoryRequirementCount});break;`,
`case 4:{const accounting=evaluateObligationAccounting(project);Object.assign(derived,{REQUIREMENTS_VERSION:project.job.CURRENT_REQUIREMENTS_VERSION||'NOT APPLICABLE',TOTAL_REQUIREMENTS:recordsForCurrentScope(project,'requirements').length,MANDATORY_REQUIREMENTS:metrics.mandatoryRequirementCount,OBLIGATION_MANIFEST:accounting.manifest,OBLIGATION_ACCOUNTING_COVERAGE:accounting.coverage,UNACCOUNTED_OBLIGATIONS:accounting.missingObligationIds,BLOCKED_OBLIGATIONS:accounting.blocked.map(item=>item.obligationId)});break;}`);
  text=replaceOnce(text,`currentScope,recordsForScope,recordsForCurrentScope,scopeForIteration,recordsForIteration,verificationMatrix,evaluateIteration,DERIVATIONS,coverageMetrics,convergenceMetrics,releaseMetrics,applicationTestCapabilities,capabilityAffirmativelyAvailable,testExecutionPlan,executionHandoff,`,
`currentScope,recordsForScope,recordsForCurrentScope,scopeForIteration,recordsForIteration,verificationMatrix,evaluateIteration,DERIVATIONS,coverageMetrics,convergenceMetrics,releaseMetrics,intakeCoverageManifest,evaluateIntakeCoverage,obligationManifest,evaluateObligationAccounting,applicationTestCapabilities,capabilityAffirmativelyAvailable,testExecutionPlan,executionHandoff,`,'engine accounting exports');
  write(path,text);
}

// prompt-engine.js: identity-complete intake and Stage 04 manifest, no original intent-file repetition.
{
  const path='prompt-engine.js';let text=read(path);
  text=text.replace(`const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/24';`,`const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/31';`);
  text=text.replace(`filter(([,definition])=>definition?.producer==='HUMAN')`,`filter(([,definition])=>['HUMAN','HUMAN_DECISION'].includes(definition?.producer))`);
  const lines=text.split('\n');
  lines[lines.findIndex(line=>line.startsWith("1:'"))]=`1:'Perform complete human-authority intake only. The application has enumerated every current controlled human-input unit in APPLICATION INTAKE MANIFEST. Classify every supplied unit exactly once and preserve every materially relevant fact, requirement, constraint, decision, prohibition, requested output, acceptance condition, material reference, and unresolved human-only issue. INPUT_SET_CONTENTS must be one JSON string using schema closed-loop-intake-capture/1 with exact root keys schema, inputVersion, manifestSha256, units, and optional conversationStatements. units must contain exactly one entry for every manifest unit, with exact keys sourceUnitId, disposition, reason, extractedStatements. Allowed dispositions are INCORPORATED, RETAINED_CONTEXT, UNRESOLVED_HUMAN_ONLY, LATER_RESOLVABLE, INAPPLICABLE. extractedStatements entries use exact keys statementKey, text, statementClass and the declared statement classes in this instruction. Conversation answers obtained after this prompt belong in conversationStatements with exact keys statementKey, question, text, statementClass, status; status is ANSWERED, UNKNOWN, or DEFERRED. Ask genuinely human-only questions conversationally before final JSON. The accepted capture is the durable meaning-preserving handoff to every later stage, so the original intent file must not be repeatedly requested. Do not perform source research, requirement atomization, test design, production, filing, simulation, manufacturing, or product verification.',`;
  lines[lines.findIndex(line=>line.startsWith("4:'"))]=`4:'Compile atomic requirement proposals only from APPLICATION OBLIGATION MANIFEST. That manifest is the complete application-generated input universe from current User Job Input, the accepted Stage 01 semantic capture, accepted Stage 01 job definition, and Stage 03 research. Do not rediscover an unspecified input universe and do not ask the human to attach the original intent file again. For every obligationId, either map it to one or more proposed requirements by placing the exact obligationId in USER_INPUT_RELATIONSHIP, or provide exactly one evidence item with kind OBLIGATION_DISPOSITION and content equal to strict JSON containing only obligationId, disposition, and reason. Non-requirement dispositions are RETAINED_NONNORMATIVE_CONTEXT, INAPPLICABLE, or BLOCKED. An obligation cannot be both mapped and disposed. No obligation may disappear. Every proposed requirement must reference at least one obligation identity, remain independently testable where possible, preserve source identity/location where applicable, and define observable satisfaction, failure, evidence, applicability, dependencies, prohibitions, and severity. The application assigns requirement IDs, versions, hashes, scope, counts, and accounting coverage.',`;
  text=lines.join('\n');
  text=replaceOnce(text,`function contextFor(stage,state,operation,scope={}){\n const parts=[];`,
`function contextFor(stage,state,operation,scope={}){\n const parts=[];\n if(stage===1)parts.push('APPLICATION INTAKE MANIFEST\\n'+show(workflow.intakeCoverageManifest(state)));\n if(stage===4)parts.push('APPLICATION OBLIGATION MANIFEST\\n'+show(workflow.obligationManifest(state)));`,'prompt accounting context');
  text=replaceOnce(text,`contextManifest={stage,operation,scope,verificationBatchPlan:batchPlan,executionHandoff:promptHandoff,readCollections:`,
`contextManifest={stage,operation,scope,intakeCoverageManifest:stage===1?workflow.intakeCoverageManifest(state):null,obligationManifest:stage===4?workflow.obligationManifest(state):null,verificationBatchPlan:batchPlan,executionHandoff:promptHandoff,readCollections:`,'prompt context signature accounting');
  text=text.replace(`contractVersion:'closed-loop-response-contract/2.4'`,`contractVersion:'closed-loop-response-contract/3.1'`);
  write(path,text);
}

// response-ingestion.js: fail closed on omitted Stage 01 units and Stage 04 obligations.
{
  const path='response-ingestion.js';let text=read(path);
  const insertion=String.raw`
  if(envelope.responseType==='DATA_PROPOSAL'&&stageNumber===1){
    const accounting=workflow.evaluateIntakeCoverage(project,envelope.stageData?.INPUT_SET_CONTENTS);
    for(const message of accounting.errors)issues.push(issue('INCOMPLETE_INTAKE_ACCOUNTING','/stageData/INPUT_SET_CONTENTS',message));
  }
  if(envelope.responseType==='DATA_PROPOSAL'&&stageNumber===4){
    const accounting=workflow.evaluateObligationAccounting(project,{requirements:safe(envelope.records?.requirements),evidence:safe(envelope.evidence)});
    for(const message of accounting.errors)issues.push(issue('INCOMPLETE_OBLIGATION_ACCOUNTING','/records/requirements',message));
  }
`;
  if(!text.includes('INCOMPLETE_INTAKE_ACCOUNTING'))text=replaceOnce(text,'  const canonicalEnvelopeSha256=hash.canonicalEnvelopeSha256(envelope);',insertion+'\n  const canonicalEnvelopeSha256=hash.canonicalEnvelopeSha256(envelope);','ingestion accounting validators');
  write(path,text);
}

// app-core.js: explain one-time capture and remove the Stage 04 repeat-attachment mode.
{
  const path='app-core.js';let text=read(path);
  text=text.replace(`4:'The agent compiles the requirement specification from current human input, actually accessible supplied materials, and accepted external-source research. Keep the work in the external conversation that has the original material; no duplicate upload into this application is required.'`,`4:'The application captured the controlling human intent and supplied-material meaning during Stage 01. Stage 04 compiles the application-generated obligation manifest with accepted Stage 03 research. Do not attach the original intent file again.'`);
  text=text.replace(`Confirm only that the accepted Stage 01 representation matches the objective and deliverable you intend.`,`Confirm that the accepted Stage 01 representation and captured human-authority facts accurately reflect your intended outcome. This is one concise confirmation, not a line-by-line reconstruction audit.`);
  text=text.replace(/if\(n===4\)\{const materials=safe\(engine\.executionHandoff\(current,\{stage:4,operation:selectedOperation\(4\)\}\)\.conversationMaterials\)[\s\S]*?\}\s*return `<div class="notice"><strong>The agent should now return one final JSON response\.<\/strong>/,
`if(n===4)return \`<div class="notice"><strong>The agent should now return one final JSON response.</strong><br>The complete captured obligation manifest is in the current prompt. Do not attach the original intent file again. Paste only the final JSON below.</div>\`;return \`<div class="notice"><strong>The agent should now return one final JSON response.</strong>`);
  write(path,text);
}

// Replace obsolete tests with actual omission-detection coverage.
{
  const path='verify-complete.mjs';let text=read(path);
  text=replaceOnce(text,/\n\/\/ stage04-stage-prompt-material-regression-v3[\s\S]*?console\.log\(JSON\.stringify\(\{stage04PromptMaterialHandoff:true\}\)\);/,
`\n// Stage 04 consumes the captured obligation manifest and never requests the original intent file again.\n{\n  const p=project('JOB-STAGE04-CAPTURED-INTENT');\n  p.job.EXACT_USER_OBJECTIVE_VERBATIM='Create the requested controlled product.';p.job.CURRENT_INPUT_VERSION='INPUT-v001';\n  const intake=engine.intakeCoverageManifest(p),capture={schema:'closed-loop-intake-capture/1',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,units:intake.units.map((unit,index)=>({sourceUnitId:unit.unitId,disposition:'INCORPORATED',reason:'',extractedStatements:[{statementKey:'statement-'+(index+1),text:unit.label==='EXACT_USER_OBJECTIVE_VERBATIM'?p.job.EXACT_USER_OBJECTIVE_VERBATIM:String(unit.label),statementClass:unit.label==='EXACT_USER_OBJECTIVE_VERBATIM'?'REQUESTED_OUTPUT':'FACT'}]})),conversationStatements:[]};\n  p.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'Controlled product',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture)};\n  const obligations=engine.obligationManifest(p),handoff=engine.executionHandoff(p,{stage:4,operation:'COMPLETE'}),next=engine.operationalNextAction(p,4);\n  assert(obligations.obligationCount>0,'Stage 04 obligation manifest was empty.');assert(handoff.conversationMaterials.length===0&&handoff.send.length===0,'Stage 04 still asks the operator to resend the original intent file.');assert(next.explanation.includes('Do not attach the original intent file again'),'Stage 04 next action does not explain that captured intent is reused.');\n}\nconsole.log(JSON.stringify({stage04CapturedIntentReuse:true}));`,'replace obsolete Stage 04 handoff test');
  write(path,text);
}

const focusedTest=String.raw`import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion,schema=globalThis.closedLoopWorkflowSchema;
let p=core.createBlankState('JOB-INTAKE-ACCOUNTING');Object.assign(p.job,{JOB_TITLE:'Accounting fixture',EXACT_USER_OBJECTIVE_VERBATIM:'Create a product that preserves an audit log.',SUPPLIED_MATERIALS_INVENTORY:JSON.stringify([{type:'MESSAGE',exactNameOrReference:'The product must reject unaudited changes.'}]),CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001'});engine.ensureShape(p);engine.recalculate(p);
const intake=engine.intakeCoverageManifest(p);assert(intake.unitCount>=3,'Application did not enumerate all controlled human-input units.');
const captureFor=units=>({schema:'closed-loop-intake-capture/1',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,units:units.map((unit,index)=>({sourceUnitId:unit.unitId,disposition:unit.label==='JOB_TITLE'?'RETAINED_CONTEXT':'INCORPORATED',reason:'',extractedStatements:[{statementKey:'s-'+(index+1),text:unit.label==='EXACT_USER_OBJECTIVE_VERBATIM'?p.job.EXACT_USER_OBJECTIVE_VERBATIM:unit.label==='The product must reject unaudited changes.'?unit.label:String(unit.label),statementClass:unit.label==='EXACT_USER_OBJECTIVE_VERBATIM'?'REQUESTED_OUTPUT':unit.label==='The product must reject unaudited changes.'?'REQUIREMENT':'FACT'}]})),conversationStatements:[{statementKey:'conversation-1',question:'What delivery condition matters?',text:'The final product must be reviewable by the owner.',statementClass:'ACCEPTANCE_CONDITION',status:'ANSWERED'}]});
const prompt1=prompts.buildPromptRecord(1,p),envelope=(capture)=>({schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage:1,operation:prompt1.operation,promptIdentity:{instructionId:prompt1.instructionId,bodySha256:prompt1.bodySha256,contractSha256:prompt1.contractSha256,contextSignature:prompt1.contextSignature},scope:prompt1.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{EXACT_DELIVERABLE_REQUESTED:'A controlled product with auditable change history.',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture)},records:{},evidence:[{temporaryKey:'e1',kind:'HUMAN_INPUT',description:'Stage 01 human authority',location:'current conversation and supplied input',content:'Captured current human authority'}],unresolved:[],warnings:[],attachments:[]});
let prepared=ingestion.prepare(p,{stage:1,text:JSON.stringify(envelope(captureFor(intake.units.slice(0,-1)))),promptRecord:prompt1});assert(!prepared.validation.valid&&prepared.validation.issues.some(issue=>issue.code==='INCOMPLETE_INTAKE_ACCOUNTING'),'Omitted Stage 01 input unit was accepted.');
prepared=ingestion.prepare(p,{stage:1,text:JSON.stringify(envelope(captureFor(intake.units))),promptRecord:prompt1});assert(prepared.validation.valid,JSON.stringify(prepared.validation.issues));p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'ACCOUNTING_TEST'}).project;engine.recordStageConfirmation(p,1,true,'Captured human authority confirmed','ACCOUNTING_TEST',{acceptedChangeId:p.projectData.acceptedChanges.at(-1).changeId,inputVersion:p.job.CURRENT_INPUT_VERSION,instructionId:prompt1.instructionId,contextSignature:prompt1.contextSignature,operatorLabel:'ACCOUNTING_TEST'});engine.recalculate(p);assert(engine.evaluateIntakeCoverage(p).complete&&engine.evaluateIntakeCoverage(p).coverage===1,'Complete Stage 01 capture did not close accounting.');
p.projectData.candidateRequirements.push({id:'CANDIDATE-REQ-ACCOUNTING',recordId:'CANDIDATE-REQ-ACCOUNTING',stage:3,active:true,scope:engine.currentScope(p),fields:{CANDIDATE_REQ_ID:'CANDIDATE-REQ-ACCOUNTING',CANDIDATE_OBLIGATION:'The product must retain objective evidence.',SOURCE_LOCATION:'fixture',CLASSIFICATION:'MANDATORY',APPLICABILITY:'APPLICABLE',DEPENDENCIES:'NONE',EVIDENCE:'fixture',STATUS:'ACTIVE'},CANDIDATE_REQ_ID:'CANDIDATE-REQ-ACCOUNTING',CANDIDATE_OBLIGATION:'The product must retain objective evidence.',SOURCE_LOCATION:'fixture',CLASSIFICATION:'MANDATORY',APPLICABILITY:'APPLICABLE',DEPENDENCIES:'NONE',EVIDENCE:'fixture',STATUS:'ACTIVE'});
const obligations=engine.obligationManifest(p);assert(obligations.obligationCount>=4,'Stage 04 did not build the complete obligation universe.');const prompt4=prompts.buildPromptRecord(4,p);assert(prompt4.prompt.includes('APPLICATION OBLIGATION MANIFEST')&&prompt4.prompt.includes(obligations.items[0].obligationId),'Stage 04 prompt omitted the application obligation manifest.');assert(!/attach or provide the original material with the Stage 04 instruction/i.test(prompt4.prompt),'Stage 04 prompt still requires the original intent file.');const handoff=engine.executionHandoff(p,{stage:4,operation:'COMPLETE'});assert(handoff.conversationMaterials.length===0&&handoff.send.length===0,'Stage 04 still derives an original-intent-file handoff.');
const requirementFor=(item,index)=>({tempKey:'req-'+index,fields:{OBLIGATION:item.text,REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',SOURCE_LOCATION:'manifest '+item.obligationId,SOURCE_AUTHORITY:item.origin,USER_INPUT_RELATIONSHIP:item.obligationId,APPLICABILITY:'APPLICABLE',DEPENDENCIES:'NONE',PROHIBITIONS:'NONE',DEFINED_TERMS:'NONE',OBSERVABLE_SATISFACTION_CONDITION:'The obligation is demonstrably satisfied.',INTENDED_VERIFICATION_METHOD:'DETERMINISTIC_OR_INDEPENDENT',EXPECTED_EVIDENCE:'Current sufficient evidence',FAILURE_CONDITION:'The obligation is not satisfied.',SEVERITY:'MAJOR',NOTES:''},relationships:{},evidenceRefs:['e4']});
const envelope4=items=>({schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage:4,operation:prompt4.operation,promptIdentity:{instructionId:prompt4.instructionId,bodySha256:prompt4.bodySha256,contractSha256:prompt4.contractSha256,contextSignature:prompt4.contextSignature},scope:prompt4.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{DEFINED_TERM_GAPS:'NONE',CONDITIONAL_REQUIREMENTS:'NONE',OPTIONAL_REQUIREMENTS:'NONE',BLOCKED_REQUIREMENTS:'NONE'},records:{requirements:items.map(requirementFor)},evidence:[{temporaryKey:'e4',kind:'REQUIREMENT_DERIVATION',description:'Obligation accounting fixture',location:'APPLICATION OBLIGATION MANIFEST',content:'Every requirement maps to an exact obligation identity.'}],unresolved:[],warnings:[],attachments:[]});
prepared=ingestion.prepare(p,{stage:4,text:JSON.stringify(envelope4(obligations.items.slice(0,-1))),promptRecord:prompt4});assert(!prepared.validation.valid&&prepared.validation.issues.some(issue=>issue.code==='INCOMPLETE_OBLIGATION_ACCOUNTING'),'Omitted Stage 04 obligation was accepted.');prepared=ingestion.prepare(p,{stage:4,text:JSON.stringify(envelope4(obligations.items)),promptRecord:prompt4});assert(prepared.validation.valid,JSON.stringify(prepared.validation.issues));const accounting=engine.evaluateObligationAccounting(p,{requirements:envelope4(obligations.items).records.requirements,evidence:envelope4(obligations.items).evidence});assert(accounting.closed&&accounting.coverage===1,'Complete Stage 04 accounting did not close.');
const oldContext=prompt4.contextSignature;p.job.EXACT_USER_OBJECTIVE_VERBATIM+=' Updated.';p.job.CURRENT_INPUT_VERSION='INPUT-v002';engine.recalculate(p);const newPrompt=prompts.buildPromptRecord(4,p);assert(newPrompt.contextSignature!==oldContext,'Changed human authority did not invalidate the Stage 04 context signature.');
console.log(JSON.stringify({stage01IntakeCoverage:1,stage04ObligationCoverage:1,originalIntentFileReattachmentRequired:false,incompleteIntakeRejected:true,incompleteObligationAccountingRejected:true,changedInputInvalidatesPrompt:true},null,2));
`;
write('verify-intake-obligation-accounting.mjs',focusedTest);

// Make the real accounting proof part of every pre-deploy proof sequence.
{
  const path='.github/workflows/pages.yml';let text=read(path);
  text=text.replace(`node verify-v3-migration.mjs\n`,`node verify-v3-migration.mjs\n          node verify-intake-obligation-accounting.mjs\n`);
  text=text.replace(`node verify-v3-definition-of-done.mjs\n`,`node verify-v3-definition-of-done.mjs\n          node verify-intake-obligation-accounting.mjs\n`);
  write(path,text);
}

// Replace the superficial v3 accounting declaration with proof tied to the executable verifier.
{
  const path='verify-v3-definition-of-done.mjs';let text=read(path);
  if(!text.includes('verify-intake-obligation-accounting.mjs')){
    text=text.replace(`const limitTests=read('./verify-test-runtime-limits.mjs');`,`const limitTests=read('./verify-test-runtime-limits.mjs'),accountingTests=read('./verify-intake-obligation-accounting.mjs');`);
    text=text.replace(`const stage01Source=engine+prompt+ingestion+ingestionTests;`,`const stage01Source=engine+prompt+ingestion+ingestionTests+accountingTests;`);
    text=text.replace(`const stage04Source=engine+prompt+ingestion+ingestionTests;`,`const stage04Source=engine+prompt+ingestion+ingestionTests+accountingTests;`);
    text=text.replace(`assert.match(engine,/evaluateEvidenceSufficiency/);`,`assert.match(engine,/intakeCoverageManifest/);assert.match(engine,/evaluateIntakeCoverage/);assert.match(engine,/obligationManifest/);assert.match(engine,/evaluateObligationAccounting/);assert.match(accountingTests,/INCOMPLETE_INTAKE_ACCOUNTING/);assert.match(accountingTests,/INCOMPLETE_OBLIGATION_ACCOUNTING/);assert.match(engine,/evaluateEvidenceSufficiency/);`);
  }
  write(path,text);
}

console.log(JSON.stringify({patched:true,files:['workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','app-core.js','verify-complete.mjs','verify-intake-obligation-accounting.mjs','verify-v3-definition-of-done.mjs','.github/workflows/pages.yml']},null,2));
