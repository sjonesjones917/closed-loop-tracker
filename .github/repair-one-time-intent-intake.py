from pathlib import Path
import re


def replace_once(path, old, new):
    p = Path(path)
    source = p.read_text()
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one exact match, found {count}: {old[:120]!r}")
    p.write_text(source.replace(old, new, 1))


def regex_once(path, pattern, replacement):
    p = Path(path)
    source = p.read_text()
    updated, count = re.subn(pattern, replacement, source, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{path}: expected one regex match, found {count}: {pattern}")
    p.write_text(updated)


replace_once(
    "workflow-schema.js",
    'const RECORD_OWNERSHIP=Object.freeze({\n  "sources": {',
    '''const RECORD_OWNERSHIP=Object.freeze({
  "intentStatements": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "SOURCE_MATERIAL",
      "SOURCE_LOCATION",
      "EXACT_STATEMENT",
      "STATEMENT_KIND",
      "REQUIREMENT_RELEVANCE",
      "NORMATIVE_FORCE",
      "DEPENDENCIES",
      "EXCEPTIONS",
      "CONFLICTS",
      "NOTES"
    ],
    "application": [
      "STATEMENT_ID",
      "STATUS"
    ]
  },
  "sources": {''',
)

replace_once(
    "workflow-schema.js",
    "const ADDITIONAL_RECORD_FIELD_TYPES=Object.freeze({\n  TEST:Object.freeze({",
    '''const ADDITIONAL_RECORD_FIELD_TYPES=Object.freeze({
  'INTENT-STATEMENT':Object.freeze({
    STATEMENT_ID:Object.freeze({valueType:'STRING',enumValues:[],nullable:false,normalizerKey:null,closedProperties:null}),
    SOURCE_MATERIAL:Object.freeze({valueType:'STRING',enumValues:[],nullable:false,normalizerKey:null,closedProperties:null}),
    SOURCE_LOCATION:Object.freeze({valueType:'STRING',enumValues:[],nullable:false,normalizerKey:null,closedProperties:null}),
    EXACT_STATEMENT:Object.freeze({valueType:'STRING',enumValues:[],nullable:false,normalizerKey:null,closedProperties:null}),
    STATEMENT_KIND:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['DELIVERABLE','REQUIREMENT','CONSTRAINT','PROHIBITION','ACCEPTANCE_CRITERION','DEPENDENCY','EXCEPTION','DEFINITION','FACT','ASSUMPTION','QUESTION','REFERENCE','OTHER']),nullable:false,normalizerKey:null,closedProperties:null}),
    REQUIREMENT_RELEVANCE:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['REQUIREMENT','CONTEXT_ONLY','EVIDENCE_ONLY','UNRESOLVED']),nullable:false,normalizerKey:null,closedProperties:null}),
    NORMATIVE_FORCE:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['MUST','MUST_NOT','SHOULD','MAY','FACTUAL','UNRESOLVED']),nullable:false,normalizerKey:null,closedProperties:null}),
    DEPENDENCIES:Object.freeze({valueType:'STRING',enumValues:[],nullable:false,normalizerKey:null,closedProperties:null}),
    EXCEPTIONS:Object.freeze({valueType:'STRING',enumValues:[],nullable:false,normalizerKey:null,closedProperties:null}),
    CONFLICTS:Object.freeze({valueType:'STRING',enumValues:[],nullable:false,normalizerKey:null,closedProperties:null}),
    NOTES:Object.freeze({valueType:'STRING',enumValues:[],nullable:false,normalizerKey:null,closedProperties:null}),
    STATUS:Object.freeze({valueType:'STRING',enumValues:[],nullable:false,normalizerKey:null,closedProperties:null})
  }),
  TEST:Object.freeze({''',
)

replace_once(
    "workflow-schema.js",
    "const RECORD_SCHEMAS=Object.freeze({\n  sources:recordSchema({",
    '''const RECORD_SCHEMAS=Object.freeze({
  intentStatements:recordSchema({ownership:RECORD_OWNERSHIP.intentStatements,commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,title:'Canonical one-time intent statements',idField:'STATEMENT_ID',prefix:'INTENT-STATEMENT',stage:1,fields:[
    'STATEMENT_ID','SOURCE_MATERIAL','SOURCE_LOCATION','EXACT_STATEMENT','STATEMENT_KIND','REQUIREMENT_RELEVANCE','NORMATIVE_FORCE','DEPENDENCIES','EXCEPTIONS','CONFLICTS','NOTES','STATUS'
  ],required:['SOURCE_MATERIAL','SOURCE_LOCATION','EXACT_STATEMENT','STATEMENT_KIND','REQUIREMENT_RELEVANCE','NORMATIVE_FORCE','DEPENDENCIES','EXCEPTIONS','CONFLICTS','STATUS']}),
  sources:recordSchema({''',
)
replace_once("workflow-schema.js", "  1:[],\n  2:", "  1:['intentStatements'],\n  2:")
replace_once(
    "workflow-schema.js",
    "const READ_COLLECTIONS=Object.freeze({1:[],2:[],3:['sources','sourceConflicts'],4:['research','candidateRequirements','sources'],",
    "const READ_COLLECTIONS=Object.freeze({1:[],2:[],3:['intentStatements','sources','sourceConflicts'],4:['intentStatements','research','candidateRequirements','sources'],",
)

replace_once(
    "workflow-engine.js",
    "const APPLICATION_INITIAL_FIELDS=Object.freeze({\n  requirements:Object.freeze({STATUS:'ACTIVE'}),",
    "const APPLICATION_INITIAL_FIELDS=Object.freeze({\n  intentStatements:Object.freeze({STATUS:'ACTIVE'}),requirements:Object.freeze({STATUS:'ACTIVE'}),",
)
replace_once(
    "workflow-engine.js",
    "const VERSION_SCOPE_KEY_BY_STAGE=Object.freeze({2:'sourceSetVersion',",
    "const VERSION_SCOPE_KEY_BY_STAGE=Object.freeze({1:'inputVersion',2:'sourceSetVersion',",
)
replace_once(
    "workflow-engine.js",
    "function confirmedDefects(project){",
    "function currentIntentStatements(project){return recordsForCurrentScope(project,'intentStatements');}\nfunction intentStatementRequiresRequirement(record){return upper(recordValue(record,'REQUIREMENT_RELEVANCE'))==='REQUIREMENT';}\nfunction confirmedDefects(project){",
)
replace_once(
    "workflow-engine.js",
    '''    case 1:{
      if(!String(project.job.EXACT_USER_OBJECTIVE_VERBATIM||'').trim())reasons.push('Verbatim User Job Input is required.');
      requireAccepted();
      const latest=changes.at(-1),confirmed=safe(project.projectData.stageConfirmations).some(item=>Number(item.stage)===1&&item.confirmed===true&&!item.invalidatedBy&&item.acceptedChangeId===latest?.changeId&&item.inputVersion===project.job.CURRENT_INPUT_VERSION);
      if(!confirmed)reasons.push('Human confirmation bound to the current accepted change and input version is required.');
      break;
    }''',
    '''    case 1:{
      if(!String(project.job.EXACT_USER_OBJECTIVE_VERBATIM||'').trim())reasons.push('Verbatim User Job Input is required.');
      requireAccepted();
      const statements=currentIntentStatements(project);
      if(!statements.length)reasons.push('Stage 01 requires a canonical intent-statement ledger; the original intent file may not be deferred to a later stage.');
      for(const statement of statements)for(const name of ['SOURCE_MATERIAL','SOURCE_LOCATION','EXACT_STATEMENT','STATEMENT_KIND','REQUIREMENT_RELEVANCE','NORMATIVE_FORCE'])if(!String(recordValue(statement,name)||'').trim())reasons.push(`${recordId(statement,'intentStatements')}: ${name} is missing.`);
      const latest=changes.at(-1),confirmed=safe(project.projectData.stageConfirmations).some(item=>Number(item.stage)===1&&item.confirmed===true&&!item.invalidatedBy&&item.acceptedChangeId===latest?.changeId&&item.inputVersion===project.job.CURRENT_INPUT_VERSION);
      if(!confirmed)reasons.push('Human confirmation bound to the current accepted change and input version is required.');
      break;
    }''',
)
replace_once(
    "workflow-engine.js",
    '''    case 3:{
      requireAccepted();const sourceIds=all('sources').map(record=>recordId(record,'sources')),noSource=upper(project.stages[2]?.agentData?.SOURCE_APPLICABILITY_DETERMINATION)==='NO_APPLICABLE_EXTERNAL_SOURCE';
      if(!sourceIds.length){if(!noSource)reasons.push('Stage 03 cannot proceed without a current Stage 02 source set or valid no-source determination.');break;}
      requireCount('research',1);const researched=new Set(collection('research').map(record=>String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||''))),missing=sourceIds.filter(id=>!researched.has(id));if(missing.length)reasons.push(`Research is missing for source(s): ${missing.join(', ')}.`);break;
    }''',
    '''    case 3:{
      requireAccepted();const sourceIds=all('sources').map(record=>recordId(record,'sources')),noSource=upper(project.stages[2]?.agentData?.SOURCE_APPLICABILITY_DETERMINATION)==='NO_APPLICABLE_EXTERNAL_SOURCE';
      if(!sourceIds.length&&!noSource)reasons.push('Stage 03 cannot proceed without a current Stage 02 source set or valid no-source determination.');
      if(sourceIds.length){requireCount('research',1);const researched=new Set(collection('research').map(record=>String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||''))),missing=sourceIds.filter(id=>!researched.has(id));if(missing.length)reasons.push(`Research is missing for source(s): ${missing.join(', ')}.`);}
      const requiredStatements=currentIntentStatements(project).filter(intentStatementRequiresRequirement),candidateLocations=new Set(collection('candidateRequirements').map(record=>String(recordValue(record,'SOURCE_LOCATION')||'').trim())),missingStatements=requiredStatements.map(record=>recordId(record,'intentStatements')).filter(id=>!candidateLocations.has(id));
      if(missingStatements.length)reasons.push(`Candidate requirement coverage is missing for canonical intent statement(s): ${missingStatements.join(', ')}.`);
      break;
    }''',
)
replace_once(
    "workflow-engine.js",
    '''    case 4:{
      requireAccepted();requireCount('requirements',1);
      for(const req of collection('requirements')){
        for(const name of schema.RECORD_SCHEMAS.requirements.required)if(!String(recordValue(req,name)||'').trim())reasons.push(`${recordId(req,'requirements')}: ${name} is missing.`);
        const sourceId=String(recordValue(req,'SOURCE_ID')||req.relationships?.SOURCE_ID||'').trim(),userRelationship=String(recordValue(req,'USER_INPUT_RELATIONSHIP')||'').trim();
        if(!sourceId&&!userRelationship)reasons.push(`${recordId(req,'requirements')}: requirement lacks source provenance or an explicit User Job Input relationship.`);
      }
      break;
    }''',
    '''    case 4:{
      requireAccepted();requireCount('requirements',1);
      const statements=currentIntentStatements(project),statementIds=new Set(statements.map(record=>recordId(record,'intentStatements'))),requiredStatementIds=statements.filter(intentStatementRequiresRequirement).map(record=>recordId(record,'intentStatements')),coveredIntentStatements=new Set();
      for(const req of collection('requirements')){
        for(const name of schema.RECORD_SCHEMAS.requirements.required)if(!String(recordValue(req,name)||'').trim())reasons.push(`${recordId(req,'requirements')}: ${name} is missing.`);
        const sourceId=String(recordValue(req,'SOURCE_ID')||req.relationships?.SOURCE_ID||'').trim(),userRelationship=String(recordValue(req,'USER_INPUT_RELATIONSHIP')||'').trim();
        if(userRelationship){if(!statementIds.has(userRelationship))reasons.push(`${recordId(req,'requirements')}: USER_INPUT_RELATIONSHIP must equal an active canonical STATEMENT_ID, not a generic User Job Input label.`);else coveredIntentStatements.add(userRelationship);}
        if(!sourceId&&!userRelationship)reasons.push(`${recordId(req,'requirements')}: requirement lacks source provenance or an exact canonical intent STATEMENT_ID.`);
      }
      const missingStatements=requiredStatementIds.filter(id=>!coveredIntentStatements.has(id));if(missingStatements.length)reasons.push(`Requirement coverage is missing for canonical intent statement(s): ${missingStatements.join(', ')}.`);
      break;
    }''',
)
regex_once(
    "workflow-engine.js",
    r"\n  if\(stage===4\)\{\n.*?\n  \}\n  for\(const item of items\)",
    "\n  if(stage>1)withhold.set('original Stage 01 intent file',{artifactIdOrCategory:'original Stage 01 intent file',reason:'One-time intake only. Later stages use the canonical intentStatements ledger and must not request, attach, resend, reopen, or rely on the original file.'});\n  for(const item of items)",
)
regex_once(
    "workflow-engine.js",
    r"if\(stage===4\)\{const handoff=executionHandoff\(project,\{stage:4,operation:'COMPLETE'\}\),materials=handoff\.conversationMaterials\.map\(item=>item\.label\);if\(materials\.length\)return 'Send the Stage 04 instruction with '\+materials\.join\(', '\)\+'\. The prompt does not include those materials\. When the agent finishes, paste its final JSON response here\.';\}",
    "if(stage===3||stage===4)return 'Use the current Stage '+String(stage).padStart(2,'0')+' instruction. It consumes the canonical Stage 01 intent-statement ledger. Do not attach, resend, reopen, or otherwise reuse the original intent file.';",
)
replace_once(
    "workflow-engine.js",
    "unresolvedHumanRequests,openBlockers,acceptedChanges,hasStageActivity,mandatoryRequirements,confirmedDefects,unresolvedMaterialDefects,",
    "unresolvedHumanRequests,openBlockers,acceptedChanges,hasStageActivity,mandatoryRequirements,currentIntentStatements,intentStatementRequiresRequirement,confirmedDefects,unresolvedMaterialDefects,",
)

replace_once("prompt-engine.js", "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/24';", "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/25';")
replace_once(
    "prompt-engine.js",
    "1:'Initialize only this current job from this current job’s exact user input.",
    "1:'ONE-TIME INTENT FILE INTAKE: The original intent file is authorized only in Stage 01. Read all of its actually available substantive content and emit one intentStatements record for every atomic statement, instruction, requirement, constraint, prohibition, acceptance criterion, dependency, exception, definition, fact, assumption, question, reference, and other meaning-bearing statement. Preserve the exact wording in EXACT_STATEMENT; identify the exact filename or material label in SOURCE_MATERIAL; identify the exact page, section, paragraph, table, cell, line, or other locator in SOURCE_LOCATION; classify STATEMENT_KIND, REQUIREMENT_RELEVANCE, and NORMATIVE_FORCE; preserve dependencies, exceptions, and conflicts explicitly. Split compound statements rather than compressing them. Do not summarize several statements into one record and do not omit statements because they appear repetitive, explanatory, non-normative, or inconvenient. Once the Stage 01 proposal is accepted, the original intent file must never be requested, attached, resent, reopened, or relied on by Stage 02 or any later stage; the canonical intentStatements ledger is the only downstream representation. Initialize only this current job from this current job’s exact user input.",
)
replace_once(
    "prompt-engine.js",
    "later stages inspect supplied project materials only when they need those materials for their substantive work.",
    "later stages consume the canonical intentStatements ledger and must not request or reopen the original Stage 01 intent file.",
)
replace_once(
    "prompt-engine.js",
    "Supplied project materials remain project input and are inspected later only when the stage performing substantive work actually needs them.",
    "Supplied project materials remain project input, but the original Stage 01 intent file is intake-only and is never inspected again after its canonical statement ledger is accepted.",
)
replace_once(
    "prompt-engine.js",
    "3:'Research only the current accepted Stage 02 independent external source set, source-by-source and pass-by-pass.",
    "3:'Research the current accepted Stage 02 independent external source set and the canonical Stage 01 intentStatements ledger, source-by-source and statement-by-statement. The original Stage 01 intent file is not an authorized input to this or any later stage and must never be requested, attached, resent, reopened, or relied on. For every active intent statement whose REQUIREMENT_RELEVANCE is REQUIREMENT, create at least one candidateRequirements record whose SOURCE_LOCATION is exactly that canonical STATEMENT_ID and whose CANDIDATE_OBLIGATION preserves the statement without weakening it. Research external sources source-by-source and pass-by-pass.",
)
regex_once(
    "prompt-engine.js",
    r"4:'Compile atomic requirement proposals.*?',\n5:'Resolve",
    "4:'Compile atomic requirement proposals only from the canonical Stage 01 intentStatements ledger, Stage 03 candidateRequirements, and legitimately applicable Stage 03 external-source research. The original Stage 01 intent file is prohibited input: never request it, attach it, resend it, reopen it, or rely on an earlier conversation that contains it. For every user-intent-derived requirement, set USER_INPUT_RELATIONSHIP to the exact active canonical STATEMENT_ID. Generic labels such as User Job Input are invalid. Every intent statement whose REQUIREMENT_RELEVANCE is REQUIREMENT must map to at least one atomic requirement; one statement may map to multiple atomic requirements when necessary, but no normative force, condition, exception, dependency, prohibition, or acceptance criterion may be weakened or dropped. Preserve external SOURCE_ID provenance separately when applicable. Each proposed requirement must state type, mandatory or optional status, applicability, dependencies, prohibitions, defined terms, observable satisfaction condition, intended verification method, expected evidence, failure condition, severity, and notes. The application assigns REQ_ID and controlled requirement-set identity after validated ingestion. Do not derive requirements from the target product or an existing implementation merely because that implementation contains a behavior.',\n5:'Resolve",
)
replace_once(
    "prompt-engine.js",
    "\n\nJOB CONTROL\n",
    "\n\n${stage===1?`ONE-TIME INTENT FILE RULE\\n- Use the original intent file now, in Stage 01 only, to create the complete canonical intentStatements ledger.\\n- Stage 01 may not complete without that ledger.\\n- Acceptance of the Stage 01 ledger ends authorization to use the original file.`:`ONE-TIME INTENT FILE RULE\\n- The original Stage 01 intent file is prohibited input for this stage.\\n- Never request, attach, resend, reopen, quote from, or depend on that file or an earlier conversation containing it.\\n- Use only the current canonical intentStatements records and their preserved source locations.`}\n\nJOB CONTROL\n",
)
replace_once(
    "prompt-engine.js",
    "When responseType is DATA_PROPOSAL, populate all four Stage 01 stageData strings and include at least one evidence object.",
    "When responseType is DATA_PROPOSAL, populate all four Stage 01 stageData strings, include at least one evidence object, and populate records.intentStatements with one complete record per atomic statement from every authorized human message and the original intent file.",
)
replace_once(
    "prompt-engine.js",
    "${stage===2?'- Stage 02 may contain only genuinely independent external sources appropriate to the job: governing/controlling authority where it exists, otherwise reputable direct evidence. Target-product and repository artifacts are implementation evidence, not independent external authority.\\n':''}${stage===3?'- Stage 03 may research only the accepted Stage 02 independent external source set.\\n':''}",
    "${stage===2?'- Stage 02 may contain only genuinely independent external sources appropriate to the job: governing/controlling authority where it exists, otherwise reputable direct evidence. Target-product and repository artifacts are implementation evidence, not independent external authority. The original Stage 01 intent file is not a Stage 02 input.\\n':''}${stage===3?'- Stage 03 researches the accepted Stage 02 independent external source set and the canonical Stage 01 intentStatements ledger. The original intent file is prohibited.\\n':''}",
)
replace_once(
    "prompt-engine.js",
    "- Browser-stored artifact bytes are not automatically accessible to an external agent. When a task needs files, make the exact bytes available to the actual executing/reviewing environment and preserve their canonical identity/evidence.",
    "- Browser-stored artifact bytes are not automatically accessible to an external agent. When a task needs files, make the exact bytes available to the actual executing/reviewing environment and preserve their canonical identity/evidence. This rule never authorizes reuse of the original Stage 01 intent file after Stage 01; later stages use the canonical intentStatements ledger.",
)
replace_once("prompt-engine.js", "contractVersion:'closed-loop-response-contract/2.4'", "contractVersion:'closed-loop-response-contract/2.5'")

replace_once(
    "response-ingestion.js",
    "  if(envelope.responseType==='HUMAN_INPUT_REQUIRED'){",
    '''  const canonicalIntentStatements=workflow.records(project,'intentStatements',{active:true});
  const canonicalIntentIds=new Set(canonicalIntentStatements.map(record=>workflow.recordId(record,'intentStatements')));
  const requiredIntentIds=canonicalIntentStatements.filter(record=>upper(workflow.recordValue(record,'REQUIREMENT_RELEVANCE'))==='REQUIREMENT').map(record=>workflow.recordId(record,'intentStatements'));
  if(envelope.responseType==='DATA_PROPOSAL'&&stageNumber===1){
    const proposed=safe(envelope.records?.intentStatements),seen=new Set();
    if(!proposed.length)issues.push(issue('MISSING_INTENT_STATEMENT_LEDGER','/records/intentStatements','Stage 01 DATA_PROPOSAL requires the complete canonical intent-statement ledger.'));
    proposed.forEach((record,index)=>{const fields=record?.fields||{},key=`${String(fields.SOURCE_MATERIAL||'').trim()}|${String(fields.SOURCE_LOCATION||'').trim()}|${String(fields.EXACT_STATEMENT||'').trim()}`;if(seen.has(key))issues.push(issue('DUPLICATE_INTENT_STATEMENT',`/records/intentStatements/${index}`,'Duplicate source material, location, and exact statement are not permitted.'));else seen.add(key);});
  }
  if(envelope.responseType==='DATA_PROPOSAL'&&stageNumber===3){
    const covered=new Set(safe(envelope.records?.candidateRequirements).map(record=>String(record?.fields?.SOURCE_LOCATION||'').trim()));
    const missing=requiredIntentIds.filter(id=>!covered.has(id));
    if(missing.length)issues.push(issue('MISSING_INTENT_STATEMENT_CANDIDATE','/records/candidateRequirements',`Candidate requirement coverage is missing for canonical intent statement(s): ${missing.join(', ')}.`));
  }
  if(envelope.responseType==='DATA_PROPOSAL'&&stageNumber===4){
    const proposed=safe(envelope.records?.requirements),covered=new Set();
    proposed.forEach((record,index)=>{const reference=String(record?.fields?.USER_INPUT_RELATIONSHIP||'').trim();if(!reference)return;if(!canonicalIntentIds.has(reference))issues.push(issue('INVALID_INTENT_STATEMENT_REFERENCE',`/records/requirements/${index}/fields/USER_INPUT_RELATIONSHIP','USER_INPUT_RELATIONSHIP must equal an active canonical STATEMENT_ID.'));else covered.add(reference);});
    const missing=requiredIntentIds.filter(id=>!covered.has(id));
    if(missing.length)issues.push(issue('MISSING_INTENT_STATEMENT_REQUIREMENT','/records/requirements',`Requirement coverage is missing for canonical intent statement(s): ${missing.join(', ')}.`));
  }

  if(envelope.responseType==='HUMAN_INPUT_REQUIRED'){''',
)

replace_once(
    "app-core.js",
    "?`Include the supplied project artifact(s) with the Stage 01 prompt if ChatGPT does not already have them in this chat: ${names}.`\n      :'Include the supplied project artifact(s) with the Stage 01 prompt if ChatGPT does not already have those files in this chat.';",
    "?`Attach the original intent file once, with the Stage 01 ChatGPT instruction: ${names}. After the Stage 01 statement ledger is accepted, never attach or resend that file again.`\n      :'Attach the original intent file once with the Stage 01 ChatGPT instruction. After the Stage 01 statement ledger is accepted, never attach or resend that file again.';",
)
replace_once(
    "app-core.js",
    "4:'The agent compiles the requirement specification from current human input, actually accessible supplied materials, and accepted external-source research. Keep the work in the external conversation that has the original material; no duplicate upload into this application is required.'",
    "4:'The agent compiles the requirement specification from the canonical Stage 01 intent statements, Stage 03 candidate requirements, and accepted external-source research. The original intent file is prohibited and must not be attached or resent.'",
)
regex_once(
    "app-core.js",
    r";if\(n===4\)\{const materials=safe\(engine\.executionHandoff\(current,\{stage:4,operation:selectedOperation\(4\)\}\)\.conversationMaterials\)\.map\(item=>String\(item\.label\|\|'\'\)\.trim\(\)\)\.filter\(Boolean\);if\(materials\.length\)return `<div class=\"notice\"><strong>Send the Stage 04 instruction with the required material\.</strong><br>Attach or provide with the instruction: \$\{esc\(materials\.join\(', '\)\)\}\. The prompt does not include those materials\. When the agent finishes, paste only its final JSON response here\.</div>`;\}",
    ";if(n===3||n===4)return `<div class=\"notice success\"><strong>Use canonical intent data only.</strong><br>The original Stage 01 intent file must not be attached, resent, reopened, or reused. This stage receives the accepted intentStatements ledger in its controlling instruction.</div>`;",
)
replace_once(
    "app-core.js",
    "Stage 01 is an intake conversation. Save any facts you already know here, then send the generated instruction to ChatGPT. The agent should use supplied files and ask only the remaining human-only questions in normal chat.",
    "Stage 01 is the one-time intent intake conversation. Save any facts you already know here, then send the generated instruction to ChatGPT with the original intent file attached once. The agent must extract every atomic statement into the canonical intentStatements ledger and ask only the remaining human-only questions in normal chat. After acceptance, never attach or resend the original file.",
)
replace_once(
    "app-core.js",
    "function artifactControlMarkup(n,locked){if(n===19)",
    '''function artifactControlMarkup(n,locked){if(n===1)return `<div class="panel"><h2 class="section-title">One-time intent file intake</h2><p class="section-intro">Attach the original intent file only in the Stage 01 ChatGPT conversation. The application accepts the resulting canonical intentStatements ledger; it does not require the original file for later stages.</p></div>`;if([2,3,4].includes(n))return `<div class="panel"><h2 class="section-title">Original intent file prohibited</h2><p class="section-intro">Do not select, attach, resend, reopen, or reuse the original Stage 01 intent file. This stage consumes the canonical intentStatements ledger.</p></div>`;if(n===19)''',
)
replace_once(
    "app-core.js",
    "async function registerStageFiles(fileList){const stage=current.activeStage,created=[];try{",
    "async function registerStageFiles(fileList){const stage=current.activeStage,created=[];try{if([2,3,4].includes(stage))throw new Error('The original Stage 01 intent file cannot be registered or reused in Stages 02 through 04; use the canonical intentStatements ledger.');",
)
replace_once("app-core.js", "['External sources',d.sources]", "['Canonical intent statements',d.intentStatements],['External sources',d.sources]")

replace_once(
    "workbook.js",
    "'Extract every material fact, requirement, restriction, exception, condition, dependency, recommendation, and evidentiary constraint from the accepted external source set while preserving each source role.'",
    "'Analyze every canonical Stage 01 intent statement and every accepted external source without reusing the original intent file, preserving each statement and source role.'",
)
replace_once(
    "workbook.js",
    "'Convert researched obligations into atomic, independently testable requirement records.'",
    "'Map every requirement-relevant canonical intent statement and researched external obligation into atomic, independently testable requirement records.'",
)
replace_once(
    "workbook.js",
    "1:['Exact user objective preserved verbatim','Every supplied item and material unknown recorded','Explicit requirements and assumptions separated','Complete input set has a controlled identity']",
    "1:['Exact user objective preserved verbatim','Every atomic statement from the original intent file is captured in the canonical intentStatements ledger','Explicit requirements and assumptions separated','Complete input set has a controlled identity and the original file is not needed later']",
)
replace_once(
    "workbook.js",
    "3:['Every current accepted Stage 02 source has a research record','User, format, medium, delivery, and dependency requirements were considered','Conflict, restriction, and exception pass complete','Latest complete pass found no new material requirement category']",
    "3:['Every current accepted Stage 02 source has a research record','Every requirement-relevant canonical intent statement has a candidate requirement','Conflict, restriction, and exception pass complete','Latest complete pass found no new material requirement category']",
)
replace_once(
    "workbook.js",
    "4:['Every mandatory obligation maps to an atomic requirement','Every requirement has observable satisfaction and failure conditions','Every external requirement traces to exact evidence','Requirement registry has a controlled identity']",
    "4:['Every requirement-relevant canonical intent statement maps to at least one atomic requirement','Every requirement has observable satisfaction and failure conditions','Every external requirement traces to exact evidence and every user-derived requirement traces to an exact STATEMENT_ID','Requirement registry has a controlled identity']",
)

replace_once(
    "verify-ingestion.mjs",
    "  const records={};\n  if(!Object.keys(stageData).length){",
    "  const records={};\n  if(stage===1)records.intentStatements=[{tempKey:'intent-statement-1',fields:{SOURCE_MATERIAL:'authorized human job input',SOURCE_LOCATION:'verbatim request',EXACT_STATEMENT:'Verify the closed-loop response ingestion path.',STATEMENT_KIND:'REQUIREMENT',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST',DEPENDENCIES:'NONE',EXCEPTIONS:'NONE',CONFLICTS:'NONE',NOTES:'Controlled Stage 01 fixture'},relationships:{},evidenceRefs:['evidence-1']}];\n  if(!Object.keys(stageData).length&&stage!==1){",
)
replace_once(
    "verify-full-cycle.mjs",
    "const s1=data(1,{stageData:{EXACT_DELIVERABLE_REQUESTED:'Verified deliverable',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:'Verbatim job input plus clarification.'}});",
    "const s1=data(1,{stageData:{EXACT_DELIVERABLE_REQUESTED:'Verified deliverable',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:'Verbatim job input plus clarification.'},records:{intentStatements:[recordProposal(schema,'intentStatements',{tempKey:'intent-statement',overrides:{SOURCE_MATERIAL:'authorized human job input',SOURCE_LOCATION:'verbatim request',EXACT_STATEMENT:'The deliverable must contain the required verified content.',STATEMENT_KIND:'REQUIREMENT',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST',DEPENDENCIES:'NONE',EXCEPTIONS:'NONE',CONFLICTS:'NONE',NOTES:'Full-cycle intent statement'}})]}});const intentStatementId=rid('intentStatements');",
)
replace_once(
    "verify-full-cycle.mjs",
    "data(3,{stageData:{EXCEPTIONS_AND_EDGE_CONDITIONS:'NONE',CONFLICTING_OR_INVALIDATING_MATERIAL:'NONE',RESEARCH_GAPS_AND_BLOCKERS:'NONE',SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:'TRUE',LATEST_PASS_NUMBER:'1',NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:'FALSE'}});",
    "data(3,{stageData:{EXCEPTIONS_AND_EDGE_CONDITIONS:'NONE',CONFLICTING_OR_INVALIDATING_MATERIAL:'NONE',RESEARCH_GAPS_AND_BLOCKERS:'NONE',SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:'TRUE',LATEST_PASS_NUMBER:'1',NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:'FALSE'},records:{candidateRequirements:[recordProposal(schema,'candidateRequirements',{tempKey:'candidate-intent',overrides:{SOURCE_LOCATION:intentStatementId,CANDIDATE_OBLIGATION:'The deliverable must contain the required verified content.',CLASSIFICATION:'USER_REQUIREMENT',APPLICABILITY:'APPLICABLE',DEPENDENCIES:'NONE',EVIDENCE:'Canonical intent statement'}})]}});",
)
replace_once("verify-full-cycle.mjs", "USER_INPUT_RELATIONSHIP:'User Job Input'", "USER_INPUT_RELATIONSHIP:intentStatementId")

Path("verify-one-time-intent-intake.mjs").write_text(r'''import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion;
const assert=(value,message)=>{if(!value)throw new Error(message);};
assert(schema.STAGE_CONTRACTS[1].agentWritableCollections.includes('intentStatements'),'Stage 01 cannot write canonical intent statements.');
assert(schema.STAGE_CONTRACTS[3].readCollections.includes('intentStatements'),'Stage 03 cannot read canonical intent statements.');
assert(schema.STAGE_CONTRACTS[4].readCollections.includes('intentStatements'),'Stage 04 cannot read canonical intent statements.');
const p=core.createBlankState('JOB-ONE-TIME-INTENT');
Object.assign(p.job,{JOB_TITLE:'One-time intent proof',EXACT_USER_OBJECTIVE_VERBATIM:'Build exactly what the intent file requires.',SUPPLIED_MATERIALS_INVENTORY:'intent.txt',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'NOT APPLICABLE'});
engine.ensureShape(p);
const scope={inputVersion:'INPUT-v001'};
function statement(id,location,text){return {id,stage:1,active:true,scope,fields:{STATEMENT_ID:id,SOURCE_MATERIAL:'intent.txt',SOURCE_LOCATION:location,EXACT_STATEMENT:text,STATEMENT_KIND:'REQUIREMENT',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST',DEPENDENCIES:'NONE',EXCEPTIONS:'NONE',CONFLICTS:'NONE',NOTES:'',STATUS:'ACTIVE'}};}
p.projectData.intentStatements.push(statement('INTENT-STATEMENT-000001','line 1','The product must preserve all intent statements.'),statement('INTENT-STATEMENT-000002','line 2','The original intent file must never be reused after intake.'));
const stage1=prompts.buildPromptRecord(1,p);
assert(stage1.prompt.includes('one intentStatements record for every atomic statement'),'Stage 01 prompt does not require exhaustive statement capture.');
assert(stage1.prompt.includes('Use the original intent file now, in Stage 01 only'),'Stage 01 prompt does not establish one-time use.');
for(const stage of [3,4]){
  const prompt=prompts.buildPromptRecord(stage,p);
  assert(prompt.prompt.includes('The original Stage 01 intent file is prohibited input for this stage.'),`Stage ${stage} does not prohibit original-file reuse.`);
  assert(!prompt.prompt.includes('Attach or provide the original material with the Stage 04 instruction.'),`Stage ${stage} still requests the original file.`);
  assert(!prompt.prompt.includes('Send the Stage 04 instruction with'),`Stage ${stage} still tells the operator to resend the file.`);
}
const handoff=engine.executionHandoff(p,{stage:4,operation:'COMPLETE'});
assert(handoff.conversationMaterials.length===0,'Stage 04 still creates an original-material resend list.');
assert(handoff.withhold.some(item=>item.artifactIdOrCategory==='original Stage 01 intent file'),'Stage 04 does not explicitly withhold the original intent file.');
assert(engine.operationalNextAction(p,4).includes('Do not attach, resend, reopen, or otherwise reuse the original intent file.'),'Stage 04 next action still permits file reuse.');
function evidence(){return [{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:'Canonical intent coverage proof',location:'verify-one-time-intent-intake.mjs',content:'controlled proof'}];}
function envelope(stage,prompt,records){return {schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:prompt.operation,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},scope:prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records,evidence:evidence(),unresolved:[],warnings:[],attachments:[]};}
function candidate(key,id){return {tempKey:key,fields:{SOURCE_LOCATION:id,CANDIDATE_OBLIGATION:'Preserve '+id,CLASSIFICATION:'USER_REQUIREMENT',APPLICABILITY:'APPLICABLE',DEPENDENCIES:'NONE',EVIDENCE:'Canonical statement '+id},relationships:{},evidenceRefs:['evidence-1']};}
function requirement(key,id){return {tempKey:key,fields:{OBLIGATION:'Implement '+id,REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',USER_INPUT_RELATIONSHIP:id,APPLICABILITY:'APPLICABLE',DEPENDENCIES:'NONE',PROHIBITIONS:'NONE',DEFINED_TERMS:'NONE',OBSERVABLE_SATISFACTION_CONDITION:'Observed satisfied',INTENDED_VERIFICATION_METHOD:'DETERMINISTIC',EXPECTED_EVIDENCE:'Verification evidence',FAILURE_CONDITION:'Requirement absent',SEVERITY:'MAJOR',NOTES:'NONE'},relationships:{},evidenceRefs:['evidence-1']};}
const p3={...prompts.buildPromptRecord(3,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(p3);
let prepared=ingestion.prepare(p,{stage:3,text:JSON.stringify(envelope(3,p3,{candidateRequirements:[candidate('candidate-1','INTENT-STATEMENT-000001')]})),promptRecord:p3});
assert(!prepared.validation.valid&&prepared.validation.issues.some(item=>item.code==='MISSING_INTENT_STATEMENT_CANDIDATE'),'Stage 03 accepted incomplete intent-statement coverage.');
prepared=ingestion.prepare(p,{stage:3,text:JSON.stringify(envelope(3,p3,{candidateRequirements:[candidate('candidate-1','INTENT-STATEMENT-000001'),candidate('candidate-2','INTENT-STATEMENT-000002')]})),promptRecord:p3});
assert(prepared.validation.valid,`Stage 03 complete canonical coverage was rejected: ${JSON.stringify(prepared.validation.issues)}`);
const p4={...prompts.buildPromptRecord(4,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(p4);
prepared=ingestion.prepare(p,{stage:4,text:JSON.stringify(envelope(4,p4,{requirements:[requirement('requirement-1','INTENT-STATEMENT-000001')]})),promptRecord:p4});
assert(!prepared.validation.valid&&prepared.validation.issues.some(item=>item.code==='MISSING_INTENT_STATEMENT_REQUIREMENT'),'Stage 04 accepted incomplete intent-statement coverage.');
const generic=requirement('requirement-generic','INTENT-STATEMENT-000001');generic.fields.USER_INPUT_RELATIONSHIP='User Job Input';
prepared=ingestion.prepare(p,{stage:4,text:JSON.stringify(envelope(4,p4,{requirements:[generic,requirement('requirement-2','INTENT-STATEMENT-000002')]})),promptRecord:p4});
assert(!prepared.validation.valid&&prepared.validation.issues.some(item=>item.code==='INVALID_INTENT_STATEMENT_REFERENCE'),'Stage 04 accepted a generic user-input label instead of an exact STATEMENT_ID.');
prepared=ingestion.prepare(p,{stage:4,text:JSON.stringify(envelope(4,p4,{requirements:[requirement('requirement-1','INTENT-STATEMENT-000001'),requirement('requirement-2','INTENT-STATEMENT-000002')]})),promptRecord:p4});
assert(prepared.validation.valid,`Stage 04 complete canonical coverage was rejected: ${JSON.stringify(prepared.validation.issues)}`);
console.log('verify-one-time-intent-intake: PASS');
''')

replace_once(
    ".github/workflows/pages.yml",
    "          node --check verify-prompt-semantics.mjs\n",
    "          node --check verify-prompt-semantics.mjs\n          node --check verify-one-time-intent-intake.mjs\n",
)
replace_once(
    ".github/workflows/pages.yml",
    "      - name: Prove one continuous 30-stage lifecycle\n        run: node verify-full-cycle.mjs\n",
    "      - name: Prove one continuous 30-stage lifecycle\n        run: node verify-full-cycle.mjs\n      - name: Prove the original intent file is used once only\n        run: node verify-one-time-intent-intake.mjs\n",
)
replace_once(
    ".github/workflows/pages.yml",
    "node verify-full-cycle.mjs && node verify-prompt-semantics.mjs",
    "node verify-full-cycle.mjs && node verify-one-time-intent-intake.mjs && node verify-prompt-semantics.mjs",
)

index = Path("index.html")
source = index.read_text()
source, count = re.subn(
    r'(<script\s+defer\s+src="[^"]+?\.js)\?v=[^"]+("\s*></script>)',
    r'\1?v=20260830-intent-once\2',
    source,
)
if count != 8:
    raise SystemExit(f"index.html: expected 8 versioned deferred scripts, updated {count}")
index.write_text(source)
