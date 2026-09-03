from pathlib import Path

# Canonical owner: workflow-engine.js
engine=Path('workflow-engine.js')
text=engine.read_text()
old="const INTAKE_ACCOUNTING_DISPOSITIONS=Object.freeze(['incorporated into the job definition','retained as context','unresolved human-only','later-resolvable','inapplicable with reason']);"
new="const INTAKE_ACCOUNTING_DISPOSITIONS=Object.freeze(['EXTRACTED_RELEVANT_INFORMATION','RETAINED_AS_CONTEXT','NO_PROJECT_RELEVANT_INFORMATION','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE','INACCESSIBLE_OR_BLOCKED']);"
if text.count(old)!=1: raise SystemExit(f'Unexpected Stage 01 disposition registry count: {text.count(old)}')
text=text.replace(old,new)
old_eval="const disposition=String(unit?.disposition||'').trim().toLowerCase();if(!INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition))reasons.push(`Stage 01 intake unit ${id} has an invalid disposition.`);if(disposition==='inapplicable with reason'&&!String(unit?.reason||'').trim())reasons.push(`Stage 01 intake unit ${id} requires an inapplicability reason.`);\n    const statements=safe(unit?.extractedStatements);if(disposition!=='inapplicable with reason'&&!statements.length)reasons.push(`Stage 01 intake unit ${id} contains no extracted human-authority statement.`);const statementKeys=new Set();let statementsValid=true;"
new_eval="const disposition=String(unit?.disposition||'').trim().toUpperCase();if(!INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition))reasons.push(`Stage 01 intake unit ${id} has an invalid disposition.`);const noStatementDisposition=['NO_PROJECT_RELEVANT_INFORMATION','INACCESSIBLE_OR_BLOCKED'].includes(disposition);if(noStatementDisposition&&!String(unit?.reason||'').trim())reasons.push(`Stage 01 intake unit ${id} requires a reason for ${disposition}.`);if(disposition==='INACCESSIBLE_OR_BLOCKED')reasons.push(`Stage 01 intake unit ${id} is inaccessible or blocked and cannot satisfy Stage 01 completion.`);\n    const statements=safe(unit?.extractedStatements);if(!noStatementDisposition&&!statements.length)reasons.push(`Stage 01 intake unit ${id} contains no extracted human-authority statement.`);const statementKeys=new Set();let statementsValid=true;"
if text.count(old_eval)!=1: raise SystemExit(f'Unexpected Stage 01 evaluator block count: {text.count(old_eval)}')
text=text.replace(old_eval,new_eval)
old_account="if(hashMatches&&INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition)&&statementsValid&&(disposition==='inapplicable with reason'?Boolean(String(unit?.reason||'').trim()):statements.length>0))accounted.add(id);"
new_account="if(hashMatches&&INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition)&&statementsValid&&(noStatementDisposition?Boolean(String(unit?.reason||'').trim()):statements.length>0))accounted.add(id);"
if text.count(old_account)!=1: raise SystemExit(f'Unexpected Stage 01 accounted rule count: {text.count(old_account)}')
text=text.replace(old_account,new_account)
old_export="version:'closed-loop-workflow-engine/1',STAGE_STATES,FORMAL_STATES,ALL_COLLECTIONS,ACTION_TYPES,"
new_export="version:'closed-loop-workflow-engine/1',STAGE_STATES,FORMAL_STATES,ALL_COLLECTIONS,ACTION_TYPES,INTAKE_ACCOUNTING_DISPOSITIONS,"
if text.count(old_export)!=1: raise SystemExit(f'Unexpected workflow export anchor count: {text.count(old_export)}')
text=text.replace(old_export,new_export)
engine.write_text(text)

# Prompt authority must command the exact closed values.
prompt=Path('prompt-engine.js')
ptext=prompt.read_text()
anchor='Classify every APPLICATION INTAKE MANIFEST unit exactly once.'
addition=' Classify each unit using exactly one of these closed disposition values: EXTRACTED_RELEVANT_INFORMATION, RETAINED_AS_CONTEXT, NO_PROJECT_RELEVANT_INFORMATION, UNRESOLVED_HUMAN_AUTHORITY, LATER_RESOLVABLE, or INACCESSIBLE_OR_BLOCKED. INACCESSIBLE_OR_BLOCKED means required semantic content could not be inspected; report the exact blocker and do not claim Stage 01 completion.'
if ptext.count(anchor)!=1: raise SystemExit(f'Unexpected Stage 01 prompt anchor count: {ptext.count(anchor)}')
ptext=ptext.replace(anchor,anchor+addition)
prompt.write_text(ptext)

# Existing synthetic fixtures were authored against the obsolete canonical enum.
# Update disposition literals only; leave prose and the focused legacy-rejection assertion untouched.
fixture_map={
    'incorporated into the job definition':'EXTRACTED_RELEVANT_INFORMATION',
    'retained as context':'RETAINED_AS_CONTEXT',
    'unresolved human-only':'UNRESOLVED_HUMAN_AUTHORITY',
    'later-resolvable':'LATER_RESOLVABLE',
    'inapplicable with reason':'NO_PROJECT_RELEVANT_INFORMATION',
}
for path in Path('.').glob('verify-*.mjs'):
    t=path.read_text()
    original=t
    for retired,current in fixture_map.items():
        t=t.replace(f"disposition:'{retired}'",f"disposition:'{current}'")
        t=t.replace(f'disposition:"{retired}"',f'disposition:"{current}"')
    if t!=original:path.write_text(t)

# Permanent focused regression. Use the same non-DOM module surface as the existing Stage 01 closure test.
reg=Path('verify-stage01-disposition-contract.mjs')
reg.write_text("""import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';\nglobalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);\nfor(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});\nconst e=globalThis.closedLoopWorkflowEngine,c=globalThis.closedLoopCore,p=globalThis.closedLoopPromptEngine;\nconst exact=['EXTRACTED_RELEVANT_INFORMATION','RETAINED_AS_CONTEXT','NO_PROJECT_RELEVANT_INFORMATION','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE','INACCESSIBLE_OR_BLOCKED'];assert.deepEqual([...e.INTAKE_ACCOUNTING_DISPOSITIONS],exact);\nconst x=c.createBlankState('JOB-STAGE01-DISPOSITIONS-R2');Object.assign(x.job,{JOB_TITLE:'Stage 01 disposition contract',JOB_OWNER:'Operator',EXACT_USER_OBJECTIVE_VERBATIM:'Account every raw input unit.',EXPLICIT_USER_REQUIREMENTS:'Inaccessible required material must block completion.',SUPPLIED_MATERIALS_INVENTORY:'NONE',CURRENT_INPUT_VERSION:'INPUT-v001'});x.projectData.userEntered={constraint:'Do not omit raw input.'};e.ensureShape(x);const m=e.intakeCoverageManifest(x);\nconst base={schema:'closed-loop-stage01-capture/1',inputVersion:m.inputVersion,manifestSha256:m.manifestSha256,units:m.units.map((u,i)=>({sourceUnitId:u.unitId,sourceRawValueSha256:u.rawValueSha256,disposition:'RETAINED_AS_CONTEXT',reason:'Retained.',extractedStatements:[{statementKey:`S${i}`,text:u.rawValueText||u.label||u.unitId,statementClass:'CONTEXT'}]}))};assert.equal(e.evaluateIntakeAccounting(x,{capture:JSON.stringify(base)}).complete,true);\nconst n=structuredClone(base);n.units[0]={...n.units[0],disposition:'NO_PROJECT_RELEVANT_INFORMATION',reason:'No project-relevant information.',extractedStatements:[]};assert.equal(e.evaluateIntakeAccounting(x,{capture:JSON.stringify(n)}).complete,true);\nconst b=structuredClone(base);b.units[0]={...b.units[0],disposition:'INACCESSIBLE_OR_BLOCKED',reason:'Cannot inspect semantic content.',extractedStatements:[]};const br=e.evaluateIntakeAccounting(x,{capture:JSON.stringify(b)});assert.equal(br.complete,false);assert(br.reasons.some(r=>/inaccessible or blocked/i.test(r)));\nconst legacy=structuredClone(base);legacy.units[0].disposition='retained as context';assert.equal(e.evaluateIntakeAccounting(x,{capture:JSON.stringify(legacy)}).complete,false);\nconst promptText=p.buildPromptRecord(1,x,{operation:'COMPLETE'}).prompt;for(const value of exact)assert(promptText.includes(value));assert(/INACCESSIBLE_OR_BLOCKED means .*do not claim Stage 01 completion/i.test(promptText));console.log(JSON.stringify({stage01DispositionContract:'PASS'}));\n""")
