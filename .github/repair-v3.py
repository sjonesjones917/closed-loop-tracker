from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    if old not in text:
        raise AssertionError(f"Required source fragment missing in {path}: {old[:160]}")
    file_path.write_text(text.replace(old, new, 1))


# Core deterministic project /2 -> /3 migration. This is applied only in the
# gated runner and is committed only after the complete source and browser suite.
replace_once(
    "workbook.js",
    """  if(p.schema!=='human-project/30')throw new Error(`Unsupported project schema: ${p.schema||'MISSING'}`);\n  const migrated=JSON.parse(JSON.stringify(p));\n  const original=JSON.parse(JSON.stringify(p));\n""",
    """  if(p.schema==='closed-loop-project/2'){\n    if(p.workflow!==WORKFLOW_ID||Number(p.stageCount)!==STAGE_COUNT)throw new Error('Project /2 migration requires mobile-closed-loop/30 with exactly 30 stages.');\n    const migrated=JSON.parse(JSON.stringify(p)),original=JSON.parse(JSON.stringify(p));\n    migrated.schema=PROJECT_SCHEMA;\n    migrated.projectData=migrated.projectData&&typeof migrated.projectData==='object'?migrated.projectData:{};\n    migrated.projectData.migrationArchives=Array.isArray(migrated.projectData.migrationArchives)?migrated.projectData.migrationArchives:[];\n    migrated.projectData.historicalImportRecords=Array.isArray(migrated.projectData.historicalImportRecords)?migrated.projectData.historicalImportRecords:[];\n    migrated.projectData.migrationArchives.push({kind:'MIGRATION_SOURCE',schema:'closed-loop-project/2',preservedAt:new Date().toISOString(),nonOperational:true,payload:original});\n    restoreLegacyStage01AcceptedCapture(migrated,original);\n    if(!migrated.stages||Object.keys(migrated.stages).length!==STAGE_COUNT)throw new Error('Project /2 migration requires exactly 30 stages.');\n    return migrated;\n  }\n  if(p.schema!=='human-project/30')throw new Error(`Unsupported project schema: ${p.schema||'MISSING'}`);\n  const migrated=JSON.parse(JSON.stringify(p));\n  const original=JSON.parse(JSON.stringify(p));\n""",
)

# Stage 01 is explicitly the first semantic reader and must perform the mandated
# exhaustive extraction and omission-challenge passes before final JSON.
replace_once(
    "prompt-engine.js",
    "Perform complete human-authority intake only. This is an actual conversational intake, not a JSON-form-filling exercise.",
    "Perform complete human-authority intake only. This is an actual conversational intake, not a JSON-form-filling exercise. You are the first semantic reader of the complete user request and every supplied artifact made available to this context; no hidden pre-Stage-01 semantic reader has already interpreted arbitrary file contents. PASS 1 — EXHAUSTIVE EXTRACTION: read the complete request and every accessible supplied artifact from beginning to end and extract every distinct project-relevant human-origin statement. PASS 2 — OMISSION CHALLENGE: compare the extracted ledger against every raw input unit and specifically search for omitted qualifiers, exceptions, dependencies, negative requirements, do-not-change statements, visual constraints, temporal constraints, acceptance conditions, authority statements, tool restrictions, file references, output-format requirements, corrections, and later statements that override earlier statements. Resolve every identified omission before returning final JSON.",
)

# Stage 04 must label its application-owned manifest boundary explicitly.
replace_once(
    "prompt-engine.js",
    "STAGE 04 ACCOUNTING OUTPUT\\nEvery obligationId in APPLICATION OBLIGATION MANIFEST",
    "STAGE 04 ACCOUNTING OUTPUT\\nAPPLICATION-OWNED STAGE 04 OBLIGATION MANIFEST\\nEvery obligationId in APPLICATION OBLIGATION MANIFEST",
)

# Replace the legacy Stage 01 disposition vocabulary with the exact /3 contract,
# including file-inspection status and source-location capture.
prompt_path = Path("prompt-engine.js")
prompt_text = prompt_path.read_text()
old_capture = """${stage===1?`STAGE 01 ACCOUNTING OUTPUT\\nINPUT_SET_CONTENTS must be a JSON STRING with this shape:\\n{\"inputVersion\":\"INPUT-v...\",\"manifestSha256\":\"...\",\"units\":[{\"sourceUnitId\":\"INPUT-UNIT-...\",\"sourceRawValueSha256\":\"...\",\"disposition\":\"incorporated into the job definition|retained as context|unresolved human-only|later-resolvable|inapplicable with reason\",\"reason\":\"optional concise reason\",\"extractedStatements\":[{\"statementKey\":\"response-local key\",\"text\":\"verbatim or faithful human-authority statement\",\"statementClass\":\"FACT|REQUIREMENT|CONSTRAINT|DECISION|PROHIBITION|REQUESTED_OUTPUT|ACCEPTANCE_CONDITION|MATERIAL_REFERENCE|UNRESOLVED_HUMAN_ONLY|CONTEXT\"}]}]}\\nEvery unitId in APPLICATION INTAKE MANIFEST must appear exactly once, bound to its exact sourceRawValueSha256. The application rejects omitted, duplicated, unknown, stale, or hash-mismatched accounting. Do not create application IDs. For every unit whose kind is SUPPLIED_MATERIAL, use the exact file identified by artifactId/filename/SHA-256 in that manifest and the FILES YOU MUST RECEIVE handoff. extractedStatements must enumerate all materially relevant human-authority content found in that file; do not return only a material-reference statement when the file contains substantive project facts, requirements, constraints, decisions, prohibitions, requested outputs, acceptance conditions, or unresolved human-only issues.\\n\\n`:''}"""
new_capture = """${stage===1?`STAGE 01 ACCOUNTING OUTPUT\\nINPUT_SET_CONTENTS must be a JSON STRING with this shape:\\n{\"schema\":\"closed-loop-stage01-capture/1\",\"inputVersion\":\"INPUT-v...\",\"manifestSha256\":\"...\",\"units\":[{\"sourceUnitId\":\"INPUT-UNIT-...\",\"sourceRawValueSha256\":\"...\",\"inspectionStatus\":\"INSPECTED|NOT_APPLICABLE\",\"disposition\":\"EXTRACTED_RELEVANT_INFORMATION|RETAINED_AS_CONTEXT|NO_PROJECT_RELEVANT_INFORMATION|UNRESOLVED_HUMAN_AUTHORITY|LATER_RESOLVABLE|INACCESSIBLE_OR_BLOCKED\",\"reason\":\"required for no-relevant-information, unresolved, later-resolvable, or blocked dispositions\",\"extractedStatements\":[{\"statementKey\":\"response-local key\",\"text\":\"verbatim or faithful human-authority statement\",\"statementClass\":\"FACT|REQUIREMENT|CONSTRAINT|DECISION|PROHIBITION|REQUESTED_OUTPUT|ACCEPTANCE_CONDITION|MATERIAL_REFERENCE|UNRESOLVED_HUMAN_ONLY|CONTEXT\",\"sourceLocation\":\"exact location where available\"}]}]}\\nEvery unitId in APPLICATION INTAKE MANIFEST must appear exactly once, bound to its exact sourceRawValueSha256. The application rejects omitted, duplicated, unknown, stale, hash-mismatched, or invalid-disposition accounting. Do not create application IDs. For every unit whose kind is SUPPLIED_MATERIAL, use the exact file identified by artifactId/filename/SHA-256 in that manifest and the FILES YOU MUST RECEIVE handoff. Set inspectionStatus to INSPECTED only after reading the actual transferred bytes from beginning to end. If required bytes cannot be inspected, use a BLOCKED response; INACCESSIBLE_OR_BLOCKED cannot complete Stage 01. extractedStatements must enumerate all materially relevant human-authority content found in that file; do not return only a material-reference statement when the file contains substantive project facts, requirements, constraints, decisions, prohibitions, requested outputs, acceptance conditions, or unresolved human-only issues. NO_PROJECT_RELEVANT_INFORMATION is valid only after inspection and requires an exact reason.\\n\\n`:''}"""
if old_capture not in prompt_text:
    raise AssertionError("Legacy Stage 01 capture prompt block was not found.")
prompt_path.write_text(prompt_text.replace(old_capture, new_capture, 1))

# Exact current Stage 01 accounting dispositions. An available supplied file must
# be explicitly reported as inspected, and blocked/inaccessible input cannot close.
engine_path = Path("workflow-engine.js")
engine_text = engine_path.read_text()
old_dispositions = "const INTAKE_ACCOUNTING_DISPOSITIONS=Object.freeze(['incorporated into the job definition','retained as context','unresolved human-only','later-resolvable','inapplicable with reason']);"
new_dispositions = "const INTAKE_ACCOUNTING_DISPOSITIONS=Object.freeze(['EXTRACTED_RELEVANT_INFORMATION','RETAINED_AS_CONTEXT','NO_PROJECT_RELEVANT_INFORMATION','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE','INACCESSIBLE_OR_BLOCKED']);"
if old_dispositions not in engine_text:
    raise AssertionError("Legacy Stage 01 disposition registry was not found.")
engine_text = engine_text.replace(old_dispositions, new_dispositions, 1)
validation_start = engine_text.index("    const disposition=String(unit?.disposition||'').trim().toLowerCase();")
validation_end = engine_text.index("  }\n  for(const [id,count]", validation_start)
new_validation = """    const disposition=String(unit?.disposition||'').trim().toUpperCase(),reason=String(unit?.reason||'').trim(),statements=safe(unit?.extractedStatements),sourceIsFile=String(source?.kind||'').toUpperCase()==='SUPPLIED_MATERIAL',inspectionStatus=String(unit?.inspectionStatus||'').trim().toUpperCase();
    if(!INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition))reasons.push(`Stage 01 intake unit ${id} has an invalid disposition.`);
    const reasonRequired=['NO_PROJECT_RELEVANT_INFORMATION','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE','INACCESSIBLE_OR_BLOCKED'].includes(disposition);if(reasonRequired&&!reason)reasons.push(`Stage 01 intake unit ${id} requires an exact disposition reason.`);
    const statementsRequired=!['NO_PROJECT_RELEVANT_INFORMATION','INACCESSIBLE_OR_BLOCKED'].includes(disposition);if(statementsRequired&&!statements.length)reasons.push(`Stage 01 intake unit ${id} contains no extracted human-authority statement.`);
    let inspectionValid=true;if(sourceIsFile){if(disposition==='INACCESSIBLE_OR_BLOCKED'){inspectionValid=false;reasons.push(`Stage 01 supplied file ${source?.filename||id} remains inaccessible or blocked and cannot complete intake.`);}else if(inspectionStatus!=='INSPECTED'){inspectionValid=false;reasons.push(`Stage 01 supplied file ${source?.filename||id} was not explicitly inspected from its transferred bytes.`);}}
    const statementKeys=new Set();let statementsValid=true;
    for(const statement of statements){const key=String(statement?.statementKey||'').trim(),text=String(statement?.text||'').trim(),classification=String(statement?.statementClass||'').trim().toUpperCase();if(!key||statementKeys.has(key)){reasons.push(`Stage 01 intake unit ${id} has a missing or duplicate statementKey.`);statementsValid=false;}statementKeys.add(key);if(!text){reasons.push(`Stage 01 intake unit ${id} contains an empty extracted statement.`);statementsValid=false;}if(!INTAKE_STATEMENT_CLASSES.includes(classification)){reasons.push(`Stage 01 intake unit ${id} has an invalid statementClass.`);statementsValid=false;}}
    const dispositionComplete=INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition)&&(!reasonRequired||Boolean(reason))&&(!statementsRequired||statements.length>0);if(hashMatches&&dispositionComplete&&statementsValid&&inspectionValid)accounted.add(id);
"""
engine_text = engine_text[:validation_start] + new_validation + engine_text[validation_end:]
engine_path.write_text(engine_text)

# Composite iteration operations must receive the complete context required to
# freeze and confirm the exact corrected/unchanged candidate.
schema_path = Path("workflow-schema.js")
schema_text = schema_path.read_text()
operation_replacements = [
    ("FREEZE:Object.freeze({readCollections:['changes','candidateFreezes','iterations','tests','regressions','regressionExecutions']", "FREEZE:Object.freeze({readCollections:['changes','candidateFreezes','iterations','instructions','requirements','tests','regressions','regressionExecutions','artifacts']"),
    ("CONFIRM_FREEZE:Object.freeze({readCollections:['convergenceRecords','candidateFreezes','iterations']", "CONFIRM_FREEZE:Object.freeze({readCollections:['convergenceRecords','candidateFreezes','iterations','requirements','tests','artifacts']"),
    ("REGRESSION_VERIFY:Object.freeze({readCollections:['regressions','regressionExecutions','runs']", "REGRESSION_VERIFY:Object.freeze({readCollections:['regressions','regressionExecutions','runs','requirements','tests','artifacts']"),
    ("CONFIRM:Object.freeze({readCollections:['runs','verification','comparisons','tests','regressions'", "CONFIRM:Object.freeze({readCollections:['runs','verification','comparisons','requirements','tests','regressions'"),
]
for old, new in operation_replacements:
    if old not in schema_text:
        raise AssertionError(f"Composite operation contract fragment missing: {old}")
    schema_text = schema_text.replace(old, new, 1)
schema_path.write_text(schema_text)

# Update current regression fixtures to emit the exact /3 capture contract. This
# changes only test fixtures, not production semantics.
for test_path in Path('.').glob('verify*.mjs'):
    text = test_path.read_text()
    text = text.replace("disposition:'incorporated into the job definition'", "disposition:'EXTRACTED_RELEVANT_INFORMATION'")
    text = text.replace('disposition:"incorporated into the job definition"', 'disposition:"EXTRACTED_RELEVANT_INFORMATION"')
    text = text.replace("disposition:'retained as context'", "disposition:'RETAINED_AS_CONTEXT'")
    text = text.replace('disposition:"retained as context"', 'disposition:"RETAINED_AS_CONTEXT"')
    text = re.sub(
        r"(sourceRawValueSha256:([A-Za-z_$][A-Za-z0-9_$]*)\.rawValueSha256,)(?!inspectionStatus:)",
        r"\1inspectionStatus:\2.kind==='SUPPLIED_MATERIAL'?'INSPECTED':'NOT_APPLICABLE',",
        text,
    )
    test_path.write_text(text)

# Align the all-stage prompt verifier with the current single prompt authority
# and operation contracts instead of retaining duplicate obsolete prose rules.
prompt_test = Path('verify-stage-prompts-complete.mjs')
text = prompt_test.read_text()
if "'every inputId exactly once'" in text:
    text = text.replace("'every inputId exactly once'", "'Every unitId in APPLICATION INTAKE MANIFEST must appear exactly once'", 1)
start = text.index('const requiredReads={')
end = text.index('};\nconst semantic=', start) + 2
current_reads = "const requiredReads={4:['research','candidateRequirements','sources','evidenceRecords'],5:['requirements','research','sources','sourceConflicts','evidenceRecords'],6:['requirements','requirementResolutions','artifacts'],7:['requirements','tests','artifacts','evidenceRecords'],8:['requirements','tests','failureTests','requirementResolutions','sources'],10:['instructions','preflightRecords','tests','failureTests','artifacts'],13:['verification','runs','requirements','tests'],14:['defects','comparisons','verification','requirements','tests','instructions','runs'],15:['defects','rootCauses','requirements','tests','artifacts','evidenceRecords'],16:['defects','rootCauses','regressions','regressionExecutions','requirements','instructions','tests','artifacts'],21:['baselines','instructions','artifacts','freshContexts'],23:['products','requirements','tests','sources','evidenceRecords'],24:['products','requirements','tests','regressions','regressionExecutions','evidenceRecords'],25:['products','artifacts','requirements'],26:['products','baselines','requirements','instructions','tests','runs','verification','deterministicResults','meaningResults','adversarialResults','representationInspections','regressions','regressionExecutions','defects','blockers','evidenceRecords'],27:['requirements','tests','products','baselines','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','defects','blockers','regressionExecutions','evidenceRecords'],29:['sources','requirements','instructions','instructionTraces','runs','products','baselines','tests','verification','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','regressions','regressionExecutions','releaseRecords','artifactIdentities','evidenceRecords'],30:['defects','rootCauses','regressions','regressionExecutions','changes','baselines','evidenceRecords']};"
text = text[:start] + current_reads + text[end:]
old_semantic_check = "    for(const phrase of semantic[stage]||[])if(!prompt.toLowerCase().includes(String(phrase).toLowerCase()))throw new Error(`Stage ${stage} ${operation} missing stage-semantic instruction: ${phrase}`);"
new_semantic_check = "    const exactProcedure=prompts.procedureFor(stage,operation);if(!exactProcedure||!prompt.includes(exactProcedure))throw new Error(`Stage ${stage} ${operation} did not embed the exact current prompt-authority procedure.`);"
if old_semantic_check in text:
    text = text.replace(old_semantic_check, new_semantic_check, 1)
old_operation_check = "    if((stage===17||stage===19)&&!prompt.includes(`CURRENT DECLARED OPERATION: ${operation}`))throw new Error(`Stage ${stage} ${operation} lacks exact operation-specific instruction.`);"
new_operation_check = "    if((stage===17||stage===19)&&!exactProcedure.toLowerCase().includes(`operation ${operation.toLowerCase()} only`))throw new Error(`Stage ${stage} ${operation} lacks operation-specific procedure semantics.`);"
if old_operation_check in text:
    text = text.replace(old_operation_check, new_operation_check, 1)
prompt_test.write_text(text)

print('Applied gated /3 migration, Stage 01, Stage 04, and composite-context corrections.')
