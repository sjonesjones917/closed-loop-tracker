from pathlib import Path

engine=Path('workflow-engine.js')
s=engine.read_text()
old="const INTAKE_ACCOUNTING_DISPOSITIONS=Object.freeze(['incorporated into the job definition','retained as context','unresolved human-only','later-resolvable','inapplicable with reason']);"
new="const INTAKE_ACCOUNTING_DISPOSITIONS=Object.freeze(['EXTRACTED_RELEVANT_INFORMATION','RETAINED_AS_CONTEXT','NO_PROJECT_RELEVANT_INFORMATION','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE','INACCESSIBLE_OR_BLOCKED']);"
if old not in s:
    raise SystemExit('Owning legacy Stage 01 disposition contract not found exactly.')
engine.write_text(s.replace(old,new))

prompt=Path('prompt-engine.js')
s=prompt.read_text()
old_enum='incorporated into the job definition|retained as context|unresolved human-only|later-resolvable|inapplicable with reason'
new_enum='EXTRACTED_RELEVANT_INFORMATION|RETAINED_AS_CONTEXT|NO_PROJECT_RELEVANT_INFORMATION|UNRESOLVED_HUMAN_AUTHORITY|LATER_RESOLVABLE|INACCESSIBLE_OR_BLOCKED'
if old_enum not in s:
    raise SystemExit('Legacy Stage 01 prompt disposition enumeration not found.')
prompt.write_text(s.replace(old_enum,new_enum))

fixture_map={
    "disposition:'incorporated into the job definition'":"disposition:'EXTRACTED_RELEVANT_INFORMATION'",
    'disposition:"incorporated into the job definition"':'disposition:"EXTRACTED_RELEVANT_INFORMATION"',
    "disposition:'retained as context'":"disposition:'RETAINED_AS_CONTEXT'",
    'disposition:"retained as context"':'disposition:"RETAINED_AS_CONTEXT"',
    "disposition:'unresolved human-only'":"disposition:'UNRESOLVED_HUMAN_AUTHORITY'",
    'disposition:"unresolved human-only"':'disposition:"UNRESOLVED_HUMAN_AUTHORITY"',
    "disposition:'later-resolvable'":"disposition:'LATER_RESOLVABLE'",
    'disposition:"later-resolvable"':'disposition:"LATER_RESOLVABLE"',
    "disposition:'inapplicable with reason'":"disposition:'NO_PROJECT_RELEVANT_INFORMATION'",
    'disposition:"inapplicable with reason"':'disposition:"NO_PROJECT_RELEVANT_INFORMATION"',
}
for p in Path('.').glob('verify-*.mjs'):
    text=p.read_text(); before=text
    for a,b in fixture_map.items():
        text=text.replace(a,b)
    if text!=before:
        p.write_text(text)

Path('verify-stage01-disposition-contract.mjs').write_text(r'''import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
globalThis.crypto=webcrypto;
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js']) vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine;
const required=['EXTRACTED_RELEVANT_INFORMATION','RETAINED_AS_CONTEXT','NO_PROJECT_RELEVANT_INFORMATION','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE','INACCESSIBLE_OR_BLOCKED'];
const legacy=['incorporated into the job definition','retained as context','unresolved human-only','later-resolvable','inapplicable with reason'];
const p=core.createBlankState('JOB-STAGE01-DISPOSITION-CONTRACT');
p.job.JOB_ID='JOB-STAGE01-DISPOSITION-CONTRACT';
p.job.EXACT_USER_OBJECTIVE_VERBATIM='Preserve every supplied human statement.';
p.job.CURRENT_INPUT_VERSION='INPUT-v001';
engine.ensureShape(p);engine.recalculate(p);
const manifest=engine.intakeCoverageManifest(p);
function capture(disposition){return {schema:'closed-loop-stage01-capture/1',inputVersion:manifest.inputVersion,manifestSha256:manifest.manifestSha256,units:manifest.units.map((unit,index)=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition,reason:'Fixture accounting.',extractedStatements:disposition==='EXTRACTED_RELEVANT_INFORMATION'?[{statementKey:`S${index}`,text:unit.rawValueText||unit.label||unit.unitId,statementClass:'CONTEXT'}]:[]}))};}
for(const disposition of required){
  const result=engine.evaluateIntakeAccounting(p,{capture:capture(disposition)});
  const invalid=(result.reasons||[]).some(reason=>/disposition/i.test(String(reason))&&/(invalid|unsupported|not allowed|unknown)/i.test(String(reason)));
  assert.equal(invalid,false,`Required closed disposition ${disposition} was rejected as a vocabulary value: ${result.reasons?.join('; ')}`);
}
for(const disposition of legacy){const result=engine.evaluateIntakeAccounting(p,{capture:capture(disposition)});assert.equal(result.complete,false,`Legacy disposition ${disposition} was accepted.`);}
assert.equal(engine.evaluateIntakeAccounting(p,{capture:capture('RETAINED_AS_CONTEXT')}).complete,true,'RETAINED_AS_CONTEXT must support complete accounting when all units are accounted for.');
assert.equal(engine.evaluateIntakeAccounting(p,{capture:capture('INACCESSIBLE_OR_BLOCKED')}).complete,false,'INACCESSIBLE_OR_BLOCKED must not close Stage 01 accounting.');
const prompt=prompts.buildPromptRecord(1,p,{operation:'COMPLETE'}).prompt;
for(const disposition of required)assert(prompt.includes(disposition),`Prompt omits required disposition ${disposition}.`);
const accountingBlock=prompt.split('STAGE 01 ACCOUNTING OUTPUT')[1]?.split('Every unitId')[0]||prompt;
for(const disposition of legacy)assert(!accountingBlock.includes(disposition),`Prompt still publishes legacy disposition ${disposition}.`);
const mutation=capture('RETAINED_AS_CONTEXT');
mutation.units[0].disposition='retained as context';
assert.equal(engine.evaluateIntakeAccounting(p,{capture:mutation}).complete,false,'Mutation restoring a legacy disposition was not detected.');
console.log(JSON.stringify({stage01DispositionContract:'PASS',closedValues:required.length,rejectedLegacyValues:legacy.length,blockingDispositionFailsClosed:true,mutationDetected:true}));
''')
