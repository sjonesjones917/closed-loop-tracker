from pathlib import Path
import re

engine = Path('workflow-engine.js')
text = engine.read_text()
replacements = [
("const INTAKE_ACCOUNTING_DISPOSITIONS=Object.freeze(['incorporated into the job definition','retained as context','unresolved human-only','later-resolvable','inapplicable with reason']);", "const INTAKE_ACCOUNTING_DISPOSITIONS=Object.freeze(['EXTRACTED_RELEVANT_INFORMATION','RETAINED_AS_CONTEXT','NO_PROJECT_RELEVANT_INFORMATION','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE','INACCESSIBLE_OR_BLOCKED']);"),
("const disposition=String(unit?.disposition||'').trim().toLowerCase();if(!INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition))reasons.push(`Stage 01 intake unit ${id} has an invalid disposition.`);if(disposition==='inapplicable with reason'&&!String(unit?.reason||'').trim())reasons.push(`Stage 01 intake unit ${id} requires an inapplicability reason.`);", "const disposition=String(unit?.disposition||'').trim().toUpperCase();if(!INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition))reasons.push(`Stage 01 intake unit ${id} has an invalid disposition.`);const noStatementDisposition=['NO_PROJECT_RELEVANT_INFORMATION','INACCESSIBLE_OR_BLOCKED'].includes(disposition);if(noStatementDisposition&&!String(unit?.reason||'').trim())reasons.push(`Stage 01 intake unit ${id} requires a reason for ${disposition}.`);if(disposition==='INACCESSIBLE_OR_BLOCKED')reasons.push(`Stage 01 intake unit ${id} is inaccessible or blocked and cannot satisfy Stage 01 completion.`);"),
("const statements=safe(unit?.extractedStatements);if(disposition!=='inapplicable with reason'&&!statements.length)reasons.push(`Stage 01 intake unit ${id} contains no extracted human-authority statement.`);const statementKeys=new Set();let statementsValid=true;", "const statements=safe(unit?.extractedStatements);if(!noStatementDisposition&&!statements.length)reasons.push(`Stage 01 intake unit ${id} contains no extracted human-authority statement.`);const statementKeys=new Set();let statementsValid=true;"),
("if(hashMatches&&INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition)&&statementsValid&&(disposition==='inapplicable with reason'?Boolean(String(unit?.reason||'').trim()):statements.length>0))accounted.add(id);", "if(hashMatches&&INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition)&&statementsValid&&(noStatementDisposition?Boolean(String(unit?.reason||'').trim()):statements.length>0))accounted.add(id);"),
("version:'closed-loop-workflow-engine/1',STAGE_STATES,FORMAL_STATES,ALL_COLLECTIONS,ACTION_TYPES,", "version:'closed-loop-workflow-engine/1',STAGE_STATES,FORMAL_STATES,ALL_COLLECTIONS,ACTION_TYPES,INTAKE_ACCOUNTING_DISPOSITIONS,")
]
for old,new in replacements:
    count=text.count(old)
    if count != 1:
        raise SystemExit(f'workflow-engine guard failed: expected one occurrence, found {count}: {old[:90]}')
    text=text.replace(old,new)
engine.write_text(text)

prompt=Path('prompt-engine.js')
ptext=prompt.read_text()
needle='Classify every APPLICATION INTAKE MANIFEST unit exactly once. INPUT_SET_CONTENTS'
insert=('Classify every APPLICATION INTAKE MANIFEST unit exactly once. Classify each unit using exactly one of these closed disposition values: '
        'EXTRACTED_RELEVANT_INFORMATION, RETAINED_AS_CONTEXT, NO_PROJECT_RELEVANT_INFORMATION, UNRESOLVED_HUMAN_AUTHORITY, LATER_RESOLVABLE, or INACCESSIBLE_OR_BLOCKED. '
        'INACCESSIBLE_OR_BLOCKED means the required semantic content could not be inspected; report the exact blocker and do not claim Stage 01 completion. INPUT_SET_CONTENTS')
if ptext.count(needle)!=1:
    raise SystemExit(f'prompt-engine guard failed: expected one Stage 01 classification sentence, found {ptext.count(needle)}')
prompt.write_text(ptext.replace(needle,insert))

fixture_map={
    'incorporated into the job definition':'EXTRACTED_RELEVANT_INFORMATION',
    'retained as context':'RETAINED_AS_CONTEXT',
    'unresolved human-only':'UNRESOLVED_HUMAN_AUTHORITY',
    'later-resolvable':'LATER_RESOLVABLE'
}
changed=0
for path in Path('.').glob('*.mjs'):
    body=path.read_text()
    original=body
    for old,new in fixture_map.items():
        body=re.sub(r"(disposition\s*:\s*['\"])"+re.escape(old)+r"(['\"])",lambda m:m.group(1)+new+m.group(2),body,flags=re.I)
    body=re.sub(r"(disposition\s*:\s*['\"])inapplicable with reason(['\"])",lambda m:m.group(1)+'NO_PROJECT_RELEVANT_INFORMATION'+m.group(2),body,flags=re.I)
    if body!=original:
        path.write_text(body);changed+=1
if changed < 5:
    raise SystemExit(f'fixture guard failed: expected at least five fixture files to change, got {changed}')

reg=Path('verify-stage01-disposition-contract.mjs')
reg.write_text("""import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const e=globalThis.closedLoopWorkflowEngine,c=globalThis.closedLoopCore,p=globalThis.closedLoopPromptEngine;
const exact=['EXTRACTED_RELEVANT_INFORMATION','RETAINED_AS_CONTEXT','NO_PROJECT_RELEVANT_INFORMATION','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE','INACCESSIBLE_OR_BLOCKED'];assert.deepEqual([...e.INTAKE_ACCOUNTING_DISPOSITIONS],exact);
const x=c.createBlankState('JOB-STAGE01-DISPOSITIONS');Object.assign(x.job,{JOB_TITLE:'Stage 01 disposition contract',JOB_OWNER:'Operator',EXACT_USER_OBJECTIVE_VERBATIM:'Account every raw input unit.',EXPLICIT_USER_REQUIREMENTS:'Inaccessible required material must block completion.',SUPPLIED_MATERIALS_INVENTORY:'NONE',CURRENT_INPUT_VERSION:'INPUT-v001'});x.projectData.userEntered={constraint:'Do not omit raw input.'};e.ensureShape(x);const m=e.intakeCoverageManifest(x);
const base={schema:'closed-loop-stage01-capture/1',inputVersion:m.inputVersion,manifestSha256:m.manifestSha256,units:m.units.map((u,i)=>({sourceUnitId:u.unitId,sourceRawValueSha256:u.rawValueSha256,disposition:'RETAINED_AS_CONTEXT',reason:'Retained.',extractedStatements:[{statementKey:`S${i}`,text:u.rawValueText||u.label||u.unitId,statementClass:'CONTEXT'}]}))};assert.equal(e.evaluateIntakeAccounting(x,{capture:JSON.stringify(base)}).complete,true);
const n=structuredClone(base);n.units[0]={...n.units[0],disposition:'NO_PROJECT_RELEVANT_INFORMATION',reason:'No project-relevant information.',extractedStatements:[]};assert.equal(e.evaluateIntakeAccounting(x,{capture:JSON.stringify(n)}).complete,true);
const b=structuredClone(base);b.units[0]={...b.units[0],disposition:'INACCESSIBLE_OR_BLOCKED',reason:'Cannot inspect semantic content.',extractedStatements:[]};const br=e.evaluateIntakeAccounting(x,{capture:JSON.stringify(b)});assert.equal(br.complete,false);assert(br.reasons.some(r=>/inaccessible or blocked/i.test(r)));
const l=structuredClone(base);l.units[0].disposition='retained as context';assert.equal(e.evaluateIntakeAccounting(x,{capture:JSON.stringify(l)}).complete,false);
const text=p.buildPromptRecord(1,x,{operation:'COMPLETE'}).prompt;for(const v of exact)assert(text.includes(v));assert(/INACCESSIBLE_OR_BLOCKED means .*do not claim Stage 01 completion/i.test(text));console.log(JSON.stringify({stage01DispositionContract:'PASS'}));
""")

pages=Path('.github/workflows/pages.yml')
y=pages.read_text()
needle='          node verify-stage01-intake-closure.mjs\n          node verify-one-time-intent-intake.mjs'
replacement='          node verify-stage01-intake-closure.mjs\n          node verify-stage01-disposition-contract.mjs\n          node verify-one-time-intent-intake.mjs'
if y.count(needle)!=1:
    raise SystemExit(f'pages workflow guard failed: expected one Stage 01 test block, found {y.count(needle)}')
pages.write_text(y.replace(needle,replacement))
