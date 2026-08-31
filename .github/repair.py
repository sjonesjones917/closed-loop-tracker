from pathlib import Path


def replace_exact(path, old, new, expected=1):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count == 0 and new in text:
        print(f"{path}: already corrected")
        return False
    if count != expected:
        raise SystemExit(f"{path}: expected {expected} exact sentinel(s), found {count}: {old[:120]!r}")
    p.write_text(text.replace(old, new))
    print(f"{path}: replaced {count} exact sentinel(s)")
    return True


# Stage 01: use only the controlling /3 accounting dispositions and fail closed on inaccessible material.
replace_exact(
    "workflow-engine.js",
    "const INTAKE_ACCOUNTING_DISPOSITIONS=Object.freeze(['incorporated into the job definition','retained as context','unresolved human-only','later-resolvable','inapplicable with reason']);",
    "const INTAKE_ACCOUNTING_DISPOSITIONS=Object.freeze(['EXTRACTED_RELEVANT_INFORMATION','RETAINED_AS_CONTEXT','NO_PROJECT_RELEVANT_INFORMATION','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE','INACCESSIBLE_OR_BLOCKED']);",
)
replace_exact(
    "workflow-engine.js",
    "const disposition=String(unit?.disposition||'').trim().toLowerCase();if(!INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition))reasons.push(`Stage 01 intake unit ${id} has an invalid disposition.`);if(disposition==='inapplicable with reason'&&!String(unit?.reason||'').trim())reasons.push(`Stage 01 intake unit ${id} requires an inapplicability reason.`);\n    const statements=safe(unit?.extractedStatements);if(disposition!=='inapplicable with reason'&&!statements.length)reasons.push(`Stage 01 intake unit ${id} contains no extracted human-authority statement.`);const statementKeys=new Set();let statementsValid=true;",
    "const disposition=String(unit?.disposition||'').trim().toUpperCase();if(!INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition))reasons.push(`Stage 01 intake unit ${id} has an invalid disposition.`);if(disposition==='INACCESSIBLE_OR_BLOCKED')reasons.push(`Stage 01 intake unit ${id} is inaccessible or blocked and cannot satisfy intake completion.`);\n    const statements=safe(unit?.extractedStatements),statementRequired=['EXTRACTED_RELEVANT_INFORMATION','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE'].includes(disposition);if(statementRequired&&!statements.length)reasons.push(`Stage 01 intake unit ${id} contains no extracted human-authority statement.`);const statementKeys=new Set();let statementsValid=true;",
)
replace_exact(
    "workflow-engine.js",
    "if(hashMatches&&INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition)&&statementsValid&&(disposition==='inapplicable with reason'?Boolean(String(unit?.reason||'').trim()):statements.length>0))accounted.add(id);",
    "if(hashMatches&&INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition)&&disposition!=='INACCESSIBLE_OR_BLOCKED'&&statementsValid&&(!statementRequired||statements.length>0))accounted.add(id);",
)

# Human inspection: accept canonical human-owned observation evidence, but never an agent assertion about human inspection.
replace_exact(
    "workflow-engine.js",
    "const human=humanEvidence.some(e=>e?.source==='HUMAN_OBSERVATION'&&String(e?.humanAuthority?.identityAssurance||'')==='SELF_ASSERTED'&&String(recordValue(e,'APPLICATION_EVIDENCE_CONTENT')||'').trim());",
    "const human=evidence.some(e=>(e?.source==='HUMAN_OBSERVATION'&&String(e?.humanAuthority?.identityAssurance||'')==='SELF_ASSERTED'&&String(recordValue(e,'APPLICATION_EVIDENCE_CONTENT')||'').trim())||(upper(recordValue(e,'AUTHORITY_TYPE'))==='HUMAN_OBSERVATION'&&String(recordValue(e,'CONTENT')||recordValue(e,'DESCRIPTION')||'').trim()));",
)

# Stage 04 must retain exact-byte controls without asking the user to rediscover already captured meaning.
replace_exact(
    "app-core.js",
    "const applicable=[1,10,17,20,21,25].includes(n)",
    "const applicable=[1,4,10,17,20,21,25].includes(n)",
)

# Proposal review must expose the current value explicitly.
replace_exact(
    "app-core.js",
    "field:c.canonicalField||c.canonicalRelationship||'',currentValue:(()=>{",
    "field:c.canonicalField||c.canonicalRelationship||'','Current value':(()=>{",
)

# Stage 01 prompt: explicit first semantic reader and mandatory two-pass omission challenge.
replace_exact(
    "prompt-engine.js",
    '"1":"Perform complete human-authority intake only. This is an actual conversational intake, not a JSON-form-filling exercise.',
    '"1":"Perform complete human-authority intake only. You are the first semantic reader of the complete user request and every supplied file made available to you; do not assume another agent already extracted their meaning. This is an actual conversational intake, not a JSON-form-filling exercise. Exhaust the human-authority intake. Pass 1 — exhaustive extraction: read the complete request and every accessible supplied artifact from beginning to end and extract every distinct project-relevant human-origin statement. Pass 2 — omission challenge: compare the extracted ledger back against every raw input unit and search specifically for omitted qualifiers, exceptions, dependencies, negative requirements, do-not-change statements, visual constraints, temporal constraints, acceptance conditions, authority statements, tool restrictions, file references, output-format requirements, corrections, and later statements that override earlier statements; resolve every omission before final JSON. Project information already captured is reusable canonical context: never ask the human to repeat, retype, summarize, resend, reopen, or reattach it. ',
)
replace_exact(
    "prompt-engine.js",
    "Never ask the human to repeat available project facts or reattach the original Stage 01 intent file.",
    "never ask the user to repeat available project facts or reattach the original Stage 01 intent file.",
)

# Stage 04 prompt identity/context explicitly carries all current input/source/evidence classes used to build the obligation universe.
replace_exact(
    "prompt-engine.js",
    "contextManifest={stage,operation,scope,blindAliasMap:blindAliasMap.map(x=>({...x})),intakeCoverageManifest:stage===1?intakeCoverageManifest(state):null,obligationManifest:stage===4?obligationManifest(state):null,stage4ExhaustedInputs:stage===4?stage4ExhaustedInputs(state):null,verificationBatchPlan:batchPlan",
    "contextManifest={stage,operation,scope,blindAliasMap:blindAliasMap.map(x=>({...x})),intakeCoverageManifest:stage===1?intakeCoverageManifest(state):null,obligationManifest:stage===4?obligationManifest(state):null,stage4ExhaustedInputs:stage===4?stage4ExhaustedInputs(state):null,currentUserJobInput:stage===4?Object.fromEntries(Object.entries(schema.JOB_FIELDS||{}).filter(([,d])=>['HUMAN','HUMAN_DECISION'].includes(d?.producer)).map(([k])=>[k,state?.job?.[k]])):null,originalUserEntered:stage===4?JSON.parse(JSON.stringify(state?.projectData?.userEntered||{})):null,applicableSources:stage===4?workflow.recordsForCurrentScope(state,'sources').map(r=>({id:recordId(r,'sources'),fields:recordFields(r)})):null,applicableEvidence:stage===4?workflow.recordsForCurrentScope(state,'evidenceRecords').filter(r=>[2,3].includes(Number(r.stage))).map(r=>({id:recordId(r,'evidenceRecords'),fields:recordFields(r)})):null,verificationBatchPlan:batchPlan",
)

# Modernize Stage 01 fixtures to the controlling /3 disposition vocabulary.
for path, old, new in [
    ("verify-zero-loss-accounting.mjs", "disposition:'retained as context'", "disposition:'RETAINED_AS_CONTEXT'"),
    ("verify-one-time-intent-intake.mjs", "disposition:'incorporated into the job definition'", "disposition:'EXTRACTED_RELEVANT_INFORMATION'"),
]:
    replace_exact(path, old, new)

# Stage 01 closure regression must exercise the single canonical INPUT_SET_CONTENTS capture, not a parallel intent registry.
p = Path("verify-stage01-intake-closure.mjs")
s = p.read_text()
old = "const manifest=engine.stage01IntakeManifest(p);assert(manifest.entries.some(x=>x.sourceKind==='SUPPLIED_ARTIFACT'&&x.sourceIdentity==='ARTIFACT-INTENT-001'),'Stage 01 intake manifest does not bind supplied artifact identity.');"
new = "const manifest=engine.intakeCoverageManifest(p);assert(manifest.units.some(x=>x.artifactId==='ARTIFACT-INTENT-001'),'Stage 01 intake manifest does not bind supplied artifact identity.');"
if old in s:
    s = s.replace(old, new)
elif new not in s:
    raise SystemExit("verify-stage01-intake-closure.mjs: intake API sentinel missing")
old = "for(const entry of manifest.entries)assert(prompt.prompt.includes(entry.inputId),`Prompt 01 omitted ${entry.inputId}.`);assert(prompt.prompt.includes('stageData.INTAKE_ACCOUNTING'),'Prompt 01 does not command closed intake accounting.');"
new = "for(const entry of manifest.units)assert(prompt.prompt.includes(entry.unitId),`Prompt 01 omitted ${entry.unitId}.`);assert(prompt.prompt.includes('INPUT_SET_CONTENTS'),'Prompt 01 does not command closed intake accounting.');"
if old in s:
    s = s.replace(old, new)
elif new not in s:
    raise SystemExit("verify-stage01-intake-closure.mjs: prompt accounting sentinel missing")
start = "const evidence=[{temporaryKey:'evidence-1'"
end = "console.log('verify-stage01-intake-closure: PASS');"
a = s.find(start)
b = s.find(end)
if a < 0 or b < 0 or b <= a:
    raise SystemExit("verify-stage01-intake-closure.mjs: replacement range missing")
replacement = """const evidence=[{temporaryKey:'evidence-1',kind:'HUMAN_INPUT',description:'Stage 01 intake evidence',authorityType:'HUMAN',location:'AUTHORIZED USER JOB INPUT',content:'Controlled human input'}];
const capture=units=>({schema:'closed-loop-stage01-capture/1',inputVersion:manifest.inputVersion,manifestSha256:manifest.manifestSha256,units:units.map(entry=>({sourceUnitId:entry.unitId,sourceRawValueSha256:entry.rawValueSha256,disposition:'RETAINED_AS_CONTEXT',reason:'Preserved current human authority.',extractedStatements:[]}))});
const envelope=units=>({schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage:1,operation:prompt.operation,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},scope:prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{EXACT_DELIVERABLE_REQUESTED:'Exact requested product',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture(units))},records:{},evidence,unresolved:[],warnings:[],attachments:[]});
let prepared=ingestion.prepare(p,{stage:1,text:JSON.stringify(envelope(manifest.units.slice(0,-1))),promptRecord:prompt});assert(!prepared.validation.valid&&prepared.validation.issues.some(x=>x.code==='INCOMPLETE_INTAKE_ACCOUNTING'),'Stage 01 accepted incomplete intake accounting.');prepared=ingestion.prepare(p,{stage:1,text:JSON.stringify(envelope(manifest.units)),promptRecord:prompt});assert(prepared.validation.valid,`Stage 01 complete intake closure rejected: ${JSON.stringify(prepared.validation.issues)}`);"""
s = s[:a] + replacement + s[b:]
p.write_text(s)

# /3 fixture uses the engine's actual single intake and obligation authorities.
p = Path("verify-spec3-contract.mjs")
s = p.read_text()
s = s.replace("engine.stage01IntakeManifest(p)", "engine.intakeCoverageManifest(p)")
s = s.replace("engine.stage04ObligationManifest(p)", "engine.obligationManifest(p)")
s = s.replace("intake.entries.length", "intake.units.length")
p.write_text(s)

# Scoped Stage 11 refinement fixture must bind itself to the Stage 10 candidate freeze it created.
p = Path("verify-complete.mjs")
s = p.read_text()
old = "const frozen=engine.freezeCandidate(p,{stage:10,artifactIds:['ARTIFACT-REFINE'],operatorLabel:'VERIFY'}),iterationId=engine.recordId(frozen.iteration,'iterations'),candidateId=engine.recordId(frozen.candidate,'candidateFreezes');\n const slots=engine.reserveRunBatch"
new = "const frozen=engine.freezeCandidate(p,{stage:10,artifactIds:['ARTIFACT-REFINE'],operatorLabel:'VERIFY'}),iterationId=engine.recordId(frozen.iteration,'iterations'),candidateId=engine.recordId(frozen.candidate,'candidateFreezes');p.stages[10].status='COMPLETE';p.stages[10].gate={complete:true};\n const slots=engine.reserveRunBatch"
if old in s:
    s = s.replace(old, new)
elif new not in s:
    raise SystemExit("verify-complete.mjs: Stage 11 prerequisite sentinel missing")
p.write_text(s)
