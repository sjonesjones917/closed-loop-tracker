from pathlib import Path

engine=Path('workflow-engine.js')
s=engine.read_text()
old="const INTAKE_ACCOUNTING_DISPOSITIONS=Object.freeze(['incorporated into the job definition','retained as context','unresolved human-only','later-resolvable','inapplicable with reason']);"
new="const INTAKE_ACCOUNTING_DISPOSITIONS=Object.freeze(['EXTRACTED_RELEVANT_INFORMATION','RETAINED_AS_CONTEXT','NO_PROJECT_RELEVANT_INFORMATION','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE','INACCESSIBLE_OR_BLOCKED']);"
if old not in s: raise SystemExit('old Stage 01 disposition contract not found')
s=s.replace(old,new,1)
old_eval="    const disposition=String(unit?.disposition||'').trim().toLowerCase();if(!INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition))reasons.push(`Stage 01 intake unit ${id} has an invalid disposition.`);if(disposition==='inapplicable with reason'&&!String(unit?.reason||'').trim())reasons.push(`Stage 01 intake unit ${id} requires an inapplicability reason.`);\n    const statements=safe(unit?.extractedStatements);if(disposition!=='inapplicable with reason'&&!statements.length)reasons.push(`Stage 01 intake unit ${id} contains no extracted human-authority statement.`);const statementKeys=new Set();let statementsValid=true;\n"
new_eval="    const disposition=String(unit?.disposition||'').trim().toUpperCase();if(!INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition))reasons.push(`Stage 01 intake unit ${id} has an invalid disposition.`);if(disposition==='INACCESSIBLE_OR_BLOCKED')reasons.push(`Stage 01 intake unit ${id} is inaccessible or blocked and remains material until human authority removes it from scope through a new input version.`);\n    const statements=safe(unit?.extractedStatements),statementRequired=['EXTRACTED_RELEVANT_INFORMATION','RETAINED_AS_CONTEXT','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE'].includes(disposition);if(statementRequired&&!statements.length)reasons.push(`Stage 01 intake unit ${id} contains no extracted human-authority statement.`);const statementKeys=new Set();let statementsValid=true;\n"
if old_eval not in s: raise SystemExit('old Stage 01 evaluation block not found')
s=s.replace(old_eval,new_eval,1)
old_valid="if(hashMatches&&INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition)&&statementsValid&&(disposition==='inapplicable with reason'?Boolean(String(unit?.reason||'').trim()):statements.length>0))accounted.add(id);"
new_valid="if(hashMatches&&INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition)&&disposition!=='INACCESSIBLE_OR_BLOCKED'&&statementsValid&&(!statementRequired||statements.length>0))accounted.add(id);"
if old_valid not in s: raise SystemExit('old Stage 01 accounting acceptance expression not found')
s=s.replace(old_valid,new_valid,1)
engine.write_text(s)

prompt=Path('prompt-engine.js')
ps=prompt.read_text()
marker='Classify every APPLICATION INTAKE MANIFEST unit exactly once.'
replacement='Classify every APPLICATION INTAKE MANIFEST unit exactly once using only this closed disposition set: EXTRACTED_RELEVANT_INFORMATION, RETAINED_AS_CONTEXT, NO_PROJECT_RELEVANT_INFORMATION, UNRESOLVED_HUMAN_AUTHORITY, LATER_RESOLVABLE, or INACCESSIBLE_OR_BLOCKED. INACCESSIBLE_OR_BLOCKED is blocking unless human authority removes that material from scope through a new input version.'
if marker not in ps: raise SystemExit('Stage 01 prompt classification marker not found')
prompt.write_text(ps.replace(marker,replacement,1))

replacements={
 "disposition:'incorporated into the job definition'":"disposition:'EXTRACTED_RELEVANT_INFORMATION'",
 'disposition:"incorporated into the job definition"':'disposition:"EXTRACTED_RELEVANT_INFORMATION"',
 "disposition:'retained as context'":"disposition:'RETAINED_AS_CONTEXT'",
 'disposition:"retained as context"':'disposition:"RETAINED_AS_CONTEXT"',
 "disposition:'unresolved human-only'":"disposition:'UNRESOLVED_HUMAN_AUTHORITY'",
 'disposition:"unresolved human-only"':'disposition:"UNRESOLVED_HUMAN_AUTHORITY"',
 "disposition:'later-resolvable'":"disposition:'LATER_RESOLVABLE'",
 'disposition:"later-resolvable"':'disposition:"LATER_RESOLVABLE"',
 "disposition:'inapplicable with reason'":"disposition:'NO_PROJECT_RELEVANT_INFORMATION'",
 'disposition:"inapplicable with reason"':'disposition:"NO_PROJECT_RELEVANT_INFORMATION"'
}
for f in Path('.').glob('verify*.mjs'):
 text=f.read_text(); changed=False
 for a,b in replacements.items():
  if a in text: text=text.replace(a,b); changed=True
 if changed: f.write_text(text)

Path('verify-stage01-controlling-dispositions.mjs').write_text(r'''import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const f of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(f,'utf8'),{filename:f});
const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine;
const make=()=>{const p=core.createBlankState('JOB-STAGE01-DISPOSITIONS');p.job.JOB_ID='JOB-STAGE01-DISPOSITIONS';p.job.EXACT_USER_OBJECTIVE_VERBATIM='Preserve the complete controlling request.';p.job.CURRENT_INPUT_VERSION='INPUT-v001';engine.ensureShape(p);engine.recalculate(p);return p;};
const capture=(p,disposition,statements=true)=>{const m=engine.intakeCoverageManifest(p);return {schema:'closed-loop-stage01-capture/1',inputVersion:m.inputVersion,manifestSha256:m.manifestSha256,units:m.units.map((u,i)=>({sourceUnitId:u.unitId,sourceRawValueSha256:u.rawValueSha256,disposition,reason:'fixture',extractedStatements:statements?[{statementKey:`S${i}`,text:u.rawValueText||'retained context',statementClass:'CONTEXT'}]:[]}))};};
{
 const p=make(),r=engine.evaluateIntakeAccounting(p,{capture:capture(p,'incorporated into the job definition')});
 assert.equal(r.complete,false,'Legacy implementation-chosen disposition must be rejected.');
 assert(r.reasons.some(x=>/invalid disposition/i.test(x)),'Legacy disposition rejection reason missing.');
}
for(const disposition of ['EXTRACTED_RELEVANT_INFORMATION','RETAINED_AS_CONTEXT','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE']){
 const p=make(),r=engine.evaluateIntakeAccounting(p,{capture:capture(p,disposition,true)});assert.equal(r.complete,true,`${disposition} should be valid with traced statements.`);
}
{
 const p=make(),r=engine.evaluateIntakeAccounting(p,{capture:capture(p,'NO_PROJECT_RELEVANT_INFORMATION',false)});assert.equal(r.complete,true,'NO_PROJECT_RELEVANT_INFORMATION must account for a unit without fabricating a semantic statement.');
}
{
 const p=make(),r=engine.evaluateIntakeAccounting(p,{capture:capture(p,'INACCESSIBLE_OR_BLOCKED',false)});assert.equal(r.complete,false,'INACCESSIBLE_OR_BLOCKED must fail Stage 01 closed.');assert(r.reasons.some(x=>/removes it from scope through a new input version/i.test(x)),'Blocked material must state the required human scope-removal path.');
}
{
 const p=make(),pr=prompts.buildPromptRecord(1,p);for(const d of ['EXTRACTED_RELEVANT_INFORMATION','RETAINED_AS_CONTEXT','NO_PROJECT_RELEVANT_INFORMATION','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE','INACCESSIBLE_OR_BLOCKED'])assert(pr.prompt.includes(d),`Stage 01 prompt omitted controlling disposition ${d}.`);
}
console.log(JSON.stringify({stage01ControllingDispositionContract:'PASS'}));
''')
v=Path('verify-complete.mjs').read_text()
if "verify-stage01-controlling-dispositions.mjs" not in v:v += "\nawait import('./verify-stage01-controlling-dispositions.mjs');\n"
Path('verify-complete.mjs').write_text(v)
