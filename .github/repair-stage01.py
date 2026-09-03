from pathlib import Path


def replace_exact(path, old, new, expected=1):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != expected:
        raise SystemExit(f'{path}: expected {expected} occurrences, found {count}: {old[:100]!r}')
    p.write_text(text.replace(old, new), encoding='utf-8', newline='\n')


replace_exact(
    'workflow-engine.js',
    "const INTAKE_ACCOUNTING_DISPOSITIONS=Object.freeze(['incorporated into the job definition','retained as context','unresolved human-only','later-resolvable','inapplicable with reason']);",
    "const INTAKE_ACCOUNTING_DISPOSITIONS=Object.freeze(['EXTRACTED_RELEVANT_INFORMATION','RETAINED_AS_CONTEXT','NO_PROJECT_RELEVANT_INFORMATION','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE','INACCESSIBLE_OR_BLOCKED']);",
)
replace_exact(
    'workflow-engine.js',
    "    const disposition=String(unit?.disposition||'').trim().toLowerCase();if(!INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition))reasons.push(`Stage 01 intake unit ${id} has an invalid disposition.`);if(disposition==='inapplicable with reason'&&!String(unit?.reason||'').trim())reasons.push(`Stage 01 intake unit ${id} requires an inapplicability reason.`);\n    const statements=safe(unit?.extractedStatements);if(disposition!=='inapplicable with reason'&&!statements.length)reasons.push(`Stage 01 intake unit ${id} contains no extracted human-authority statement.`);const statementKeys=new Set();let statementsValid=true;",
    "    const disposition=String(unit?.disposition||'').trim();if(!INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition))reasons.push(`Stage 01 intake unit ${id} has an invalid disposition.`);const noStatementDisposition=['NO_PROJECT_RELEVANT_INFORMATION','INACCESSIBLE_OR_BLOCKED'].includes(disposition);if(noStatementDisposition&&!String(unit?.reason||'').trim())reasons.push(`Stage 01 intake unit ${id} requires a reason for ${disposition}.`);if(disposition==='INACCESSIBLE_OR_BLOCKED')reasons.push(`Stage 01 intake unit ${id} is inaccessible or blocked and cannot satisfy Stage 01 completion.`);\n    const statements=safe(unit?.extractedStatements);if(!noStatementDisposition&&!statements.length)reasons.push(`Stage 01 intake unit ${id} contains no extracted human-authority statement.`);const statementKeys=new Set();let statementsValid=true;",
)
replace_exact(
    'workflow-engine.js',
    "    if(hashMatches&&INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition)&&statementsValid&&(disposition==='inapplicable with reason'?Boolean(String(unit?.reason||'').trim()):statements.length>0))accounted.add(id);",
    "    if(hashMatches&&INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition)&&statementsValid&&(noStatementDisposition?Boolean(String(unit?.reason||'').trim()):statements.length>0))accounted.add(id);",
)
replace_exact(
    'workflow-engine.js',
    "  version:'closed-loop-workflow-engine/1',STAGE_STATES,FORMAL_STATES,ALL_COLLECTIONS,ACTION_TYPES,",
    "  version:'closed-loop-workflow-engine/1',STAGE_STATES,FORMAL_STATES,ALL_COLLECTIONS,ACTION_TYPES,INTAKE_ACCOUNTING_DISPOSITIONS,",
)
replace_exact(
    'prompt-engine.js',
    'Classify every APPLICATION INTAKE MANIFEST unit exactly once. INPUT_SET_CONTENTS must preserve',
    'Classify every APPLICATION INTAKE MANIFEST unit exactly once. Classify each unit using exactly one of these closed disposition values: EXTRACTED_RELEVANT_INFORMATION, RETAINED_AS_CONTEXT, NO_PROJECT_RELEVANT_INFORMATION, UNRESOLVED_HUMAN_AUTHORITY, LATER_RESOLVABLE, or INACCESSIBLE_OR_BLOCKED. INACCESSIBLE_OR_BLOCKED means required semantic content could not be inspected; report the exact blocker and do not claim Stage 01 completion. INPUT_SET_CONTENTS must preserve',
)

replacements = {
    "disposition:'incorporated into the job definition'": "disposition:'EXTRACTED_RELEVANT_INFORMATION'",
    "disposition:'retained as context'": "disposition:'RETAINED_AS_CONTEXT'",
}
fixtures = [
    'verify-all-stage-prompts.mjs', 'verify-browser.mjs', 'verify-complete.mjs', 'verify-data-route-closure.mjs',
    'verify-full-cycle.mjs', 'verify-human-stage-walkthrough.mjs', 'verify-ingestion.mjs', 'verify-one-time-intent-intake.mjs',
    'verify-spec-grounded-route-oracle.mjs', 'verify-spec3-contract.mjs', 'verify-stage-prompts-complete.mjs',
    'verify-stage01-intake-closure.mjs', 'verify-test-runtime.mjs', 'verify-user-prompt-invariants.mjs',
    'verify-zero-loss-accounting.mjs', 'verify.mjs',
]
for name in fixtures:
    p = Path(name)
    text = p.read_text(encoding='utf-8')
    changed = text
    for old, new in replacements.items():
        changed = changed.replace(old, new)
    if changed != text:
        p.write_text(changed, encoding='utf-8', newline='\n')

regression = """import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const e=globalThis.closedLoopWorkflowEngine,c=globalThis.closedLoopCore,p=globalThis.closedLoopPromptEngine;
const exact=['EXTRACTED_RELEVANT_INFORMATION','RETAINED_AS_CONTEXT','NO_PROJECT_RELEVANT_INFORMATION','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE','INACCESSIBLE_OR_BLOCKED'];assert.deepEqual([...e.INTAKE_ACCOUNTING_DISPOSITIONS],exact);
const x=c.createBlankState('JOB-STAGE01-DISPOSITIONS-R3');Object.assign(x.job,{JOB_TITLE:'Stage 01 disposition contract',JOB_OWNER:'Operator',EXACT_USER_OBJECTIVE_VERBATIM:'Account every raw input unit.',EXPLICIT_USER_REQUIREMENTS:'Inaccessible required material must block completion.',SUPPLIED_MATERIALS_INVENTORY:'NONE',CURRENT_INPUT_VERSION:'INPUT-v001'});x.projectData.userEntered={constraint:'Do not omit raw input.'};e.ensureShape(x);const m=e.intakeCoverageManifest(x);
const base={schema:'closed-loop-stage01-capture/1',inputVersion:m.inputVersion,manifestSha256:m.manifestSha256,units:m.units.map((u,i)=>({sourceUnitId:u.unitId,sourceRawValueSha256:u.rawValueSha256,disposition:'RETAINED_AS_CONTEXT',reason:'Retained.',extractedStatements:[{statementKey:`S${i}`,text:u.rawValueText||u.label||u.unitId,statementClass:'CONTEXT'}]}))};assert.equal(e.evaluateIntakeAccounting(x,{capture:JSON.stringify(base)}).complete,true);
const n=structuredClone(base);n.units[0]={...n.units[0],disposition:'NO_PROJECT_RELEVANT_INFORMATION',reason:'No project-relevant information.',extractedStatements:[]};assert.equal(e.evaluateIntakeAccounting(x,{capture:JSON.stringify(n)}).complete,true);
const b=structuredClone(base);b.units[0]={...b.units[0],disposition:'INACCESSIBLE_OR_BLOCKED',reason:'Cannot inspect semantic content.',extractedStatements:[]};const br=e.evaluateIntakeAccounting(x,{capture:JSON.stringify(b)});assert.equal(br.complete,false);assert(br.reasons.some(r=>/inaccessible or blocked/i.test(r)));
for(const legacyValue of ['retained as context','RETAINED AS CONTEXT','inapplicable with reason','extracted_relevant_information']){const legacy=structuredClone(base);legacy.units[0].disposition=legacyValue;assert.equal(e.evaluateIntakeAccounting(x,{capture:JSON.stringify(legacy)}).complete,false,`legacy/free-form disposition was accepted: ${legacyValue}`);}
const promptText=p.buildPromptRecord(1,x,{operation:'COMPLETE'}).prompt;for(const value of exact)assert(promptText.includes(value));assert(/INACCESSIBLE_OR_BLOCKED means .*do not claim Stage 01 completion/i.test(promptText));console.log(JSON.stringify({stage01DispositionContract:'PASS'}));
"""
Path('verify-stage01-disposition-contract.mjs').write_text(regression, encoding='utf-8', newline='\n')

pages = Path('.github/workflows/pages.yml')
text = pages.read_text(encoding='utf-8')
marker = 'node verify-stage01-intake-closure.mjs'
if 'node verify-stage01-disposition-contract.mjs' not in text:
    if marker not in text:
        raise SystemExit('pages.yml Stage 01 marker not found')
    pages.write_text(text.replace(marker, marker + '\n          node verify-stage01-disposition-contract.mjs', 1), encoding='utf-8', newline='\n')
