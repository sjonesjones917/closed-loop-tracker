from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
REPAIR_SHA = 'f6773ab9b380d7bbc5ab71d752701b40d8632b2b'
PR508 = '69add6a0548eeb89cb0b6e666147008edef7662d'


def run(*args):
    subprocess.run(args, cwd=ROOT, check=True)


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')


def once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


run('git', 'config', 'user.name', 'github-actions[bot]')
run('git', 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com')
resolved = subprocess.check_output(['git','rev-parse','origin/tmp/verified-v3-source-f677'], cwd=ROOT, text=True).strip()
if resolved != REPAIR_SHA:
    raise RuntimeError(f'Immutable repair ref changed: {resolved}')
run('git', 'revert', '-m', '1', '--no-edit', PR508)
run('git', 'cherry-pick', REPAIR_SHA)

# Engine: Stage 04 cannot be generated or completed until Stage 01 human authority
# and Stage 03 source research are both exhausted. The same readiness helper is
# consumed by the gate and prompt engine.
p = 'workflow-engine.js'
s = read(p)
anchor = 'function gate(stage,project){'
helpers = r'''function stage01Exhausted(project){
  ensureShape(project);
  if(project.stages?.[1]?.status!=='COMPLETE')return false;
  const manifest=safe(project.projectData.intakeCoverageManifests).filter(m=>!m.invalidatedBy&&String(m.inputVersion)===String(project.job.CURRENT_INPUT_VERSION)).at(-1);
  if(!manifest||!safe(manifest.requiredUnitIds).length)return false;
  const text=String(project.stages?.[1]?.agentData?.INPUT_SET_CONTENTS||project.job.INPUT_SET_CONTENTS||'');
  const lines=text.split(/\r?\n/);
  if(!manifest.requiredUnitIds.every(id=>{const line=lines.find(x=>x.includes(id))||'';return Boolean(line)&&INTAKE_DISPOSITIONS.some(d=>line.includes(d));}))return false;
  return unresolvedHumanRequests(project,1).length===0;
}
function stage03Exhausted(project){
  ensureShape(project);
  if(project.stages?.[3]?.status!=='COMPLETE')return false;
  const noSource=upper(project.stages?.[2]?.agentData?.SOURCE_APPLICABILITY_DETERMINATION)==='NO_APPLICABLE_EXTERNAL_SOURCE';
  if(noSource)return true;
  const sources=recordsForCurrentScope(project,'sources');
  if(!sources.length)return false;
  const research=recordsForCurrentScope(project,'research');
  const covered=new Set(research.map(r=>String(recordValue(r,'SOURCE_ID')||r.relationships?.SOURCE_ID||'')));
  if(!sources.every(src=>covered.has(recordId(src,'sources'))))return false;
  const data=project.stages?.[3]?.agentData||{};
  if(!truth(data.ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED))return false;
  if(!truth(data.SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED))return false;
  if(numeric(data.LATEST_PASS_NUMBER)<2)return false;
  if(!falsey(data.NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS))return false;
  return true;
}
function stage04InputReadiness(project){
  const reasons=[];
  if(!stage01Exhausted(project))reasons.push('Stage 01 human-authority intake is not exhausted and closed.');
  if(!stage03Exhausted(project))reasons.push('Stage 03 source research is not exhausted and closed.');
  if(reasons.length)return {ready:false,reasons,intakeManifestId:null,obligationManifestId:null};
  const intake=currentIntakeCoverageManifest(project),obligations=currentObligationManifest(project);
  if(!safe(intake?.requiredUnitIds).length)reasons.push('The current Stage 01 intake manifest is empty.');
  if(!safe(obligations?.requiredObligationIds).length)reasons.push('The current Stage 04 obligation universe is empty.');
  return {ready:reasons.length===0,reasons,intakeManifestId:intake?.manifestId||null,obligationManifestId:obligations?.manifestId||null};
}
'''
s = once(s, anchor, helpers + anchor, 'shared gate helper insertion')
old = """    case 3:{
      requireAccepted();const sourceIds=all('sources').map(record=>recordId(record,'sources')),noSource=upper(project.stages[2]?.agentData?.SOURCE_APPLICABILITY_DETERMINATION)==='NO_APPLICABLE_EXTERNAL_SOURCE';
      if(!sourceIds.length){if(!noSource)reasons.push('Stage 03 cannot proceed without a current Stage 02 source set or valid no-source determination.');break;}
      requireCount('research',1);const researched=new Set(collection('research').map(record=>String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||''))),missing=sourceIds.filter(id=>!researched.has(id));if(missing.length)reasons.push(`Research is missing for source(s): ${missing.join(', ')}.`);break;
    }
    case 4:{
      requireAccepted();requireCount('requirements',1);
"""
new = """    case 3:{
      requireAccepted();const sourceIds=recordsForCurrentScope(project,'sources').map(record=>recordId(record,'sources')),noSource=upper(project.stages[2]?.agentData?.SOURCE_APPLICABILITY_DETERMINATION)==='NO_APPLICABLE_EXTERNAL_SOURCE';
      if(!sourceIds.length){if(!noSource)reasons.push('Stage 03 cannot proceed without a current Stage 02 source set or valid no-source determination.');break;}
      requireCount('research',1);const researched=new Set(recordsForCurrentScope(project,'research').map(record=>String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||''))),missing=sourceIds.filter(id=>!researched.has(id));if(missing.length)reasons.push(`Research is missing for source(s): ${missing.join(', ')}.`);
      const researchData=project.stages[3]?.agentData||{};if(!truth(researchData.ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED))reasons.push('Stage 03 has not established that all known controlling sources were examined.');if(!truth(researchData.SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED))reasons.push('Stage 03 second conflict and exception pass is incomplete.');if(numeric(researchData.LATEST_PASS_NUMBER)<2)reasons.push('Stage 03 requires at least the completed second conflict and exception pass.');if(!falsey(researchData.NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS))reasons.push('Stage 03 is not exhausted because the latest pass found a new material category.');break;
    }
    case 4:{
      const readiness=stage04InputReadiness(project);if(!readiness.ready)reasons.push(...readiness.reasons);
      requireAccepted();requireCount('requirements',1);
"""
s = once(s, old, new, 'Stage 03/04 gate block')
export_anchor = 'currentScope,recordsForScope,recordsForCurrentScope,scopeForIteration,recordsForIteration,verificationMatrix'
s = once(s, export_anchor, 'stage01Exhausted,stage03Exhausted,stage04InputReadiness,' + export_anchor, 'engine exports')
write(p, s)

# Prompt authority: Stage 01 must run an exhaustive human-authority question closure
# pass; Stage 04 prompt generation itself fails closed unless the shared readiness
# helper proves Stage 01 and Stage 03 exhausted.
p = 'prompt-engine.js'
s = read(p)
old = 'Stage 01 also owns proactive human intake: before finalizing Stage 01, collect the human-specific facts and decisions that are already foreseeable as necessary to achieve the requested outcome, even when a later stage will use them.'
new = 'Stage 01 owns exhaustive human-authority intake: before finalizing Stage 01, identify and capture every human-supplied fact, requirement, constraint, decision, prohibition, requested output, acceptance condition, material reference, and unresolved human-only issue relevant to the requested outcome. Then perform an explicit human-authority question-closure pass: derive every foreseeable project-specific fact or decision that must come from the human from the actual request, accessible supplied materials, and current canonical context. Ask every still-unknown BLOCKING_NOW and ASK_NOW_NONBLOCKING item conversationally before final JSON; nonblocking means the human may answer unknown or deferred, not that you may skip asking it. Never silently place an unasked human-only issue into UNKNOWN_INFORMATION.'
s = once(s, old, new, 'Stage 01 exhaustive prompt')
old = "function buildPromptRecord(stageOrDefinition,state,options={}){\n const stage=Number(stageOrDefinition?.number||stageOrDefinition);if(!Number.isInteger(stage)||stage<1||stage>schema.STAGE_COUNT)throw new Error(`Stage must be 1 through ${schema.STAGE_COUNT}.`);"
new = "function buildPromptRecord(stageOrDefinition,state,options={}){\n const stage=Number(stageOrDefinition?.number||stageOrDefinition);if(!Number.isInteger(stage)||stage<1||stage>schema.STAGE_COUNT)throw new Error(`Stage must be 1 through ${schema.STAGE_COUNT}.`);\n if(stage===4){const readiness=workflow.stage04InputReadiness(state);if(!readiness.ready)throw new Error('Stage 04 prompt generation is blocked until Stage 01 human-authority intake and Stage 03 source research are exhausted: '+readiness.reasons.join(' '));}"
s = once(s, old, new, 'Stage 04 prompt readiness')
write(p, s)

# Correct the v3 Test IR metadata types and stamp application-owned Test IR version/hash.
p = 'workflow-schema.js'
s = read(p)
for old, new in [
    ('valueType:VALUE_TYPES.ENUM', "valueType:'STRING'"),
    ('valueType:VALUE_TYPES.STRING_ARRAY', "valueType:'STRING_ARRAY'"),
    ('valueType:VALUE_TYPES.STRING', "valueType:'STRING'"),
    ('valueType:VALUE_TYPES.OBJECT', "valueType:'OBJECT'"),
]:
    s = s.replace(old, new)
old = "if(get('EXECUTABLE_SPEC_VERSION')!==TEST_IR.version)issues.push(`EXECUTABLE_SPEC_VERSION must be ${TEST_IR.version}.`);"
if old in s:
    s = s.replace(old, "if(get('EXECUTABLE_SPEC_VERSION')!=null&&get('EXECUTABLE_SPEC_VERSION')!==TEST_IR.version)issues.push(`EXECUTABLE_SPEC_VERSION must be ${TEST_IR.version}.`);", 1)
write(p, s)

p = 'response-ingestion.js'
s = read(p)
anchor = "  for(const [collection,items] of Object.entries(canonicalRecords))for(const record of items){const def=schema.RECORD_SCHEMAS[collection];record.contentSha256=hash.contentRecordSha256(record,def.idField);record.recordSha256=hash.recordSha256(record);record.sha256=record.recordSha256;}"
insertion = "  for(const record of canonicalRecords.tests||[]){record.fields=record.fields||{};record.fields.EXECUTABLE_SPEC_VERSION=schema.TEST_IR.version;record.fields.EXECUTABLE_SPEC_SHA256=String(record.fields.EXECUTABLE_KIND||'').toUpperCase()==='TEST_IR'?hash.sha256Value(record.fields.EXECUTABLE_SPEC):null;record.EXECUTABLE_SPEC_VERSION=record.fields.EXECUTABLE_SPEC_VERSION;record.EXECUTABLE_SPEC_SHA256=record.fields.EXECUTABLE_SPEC_SHA256;}\n"
s = once(s, anchor, insertion + anchor, 'Test IR application stamp')
write(p, s)

# Restore prompt geometry without redesigning other visuals; load Test IR at the
# specified dependency point and permit only same-origin workers.
p = 'index.html'
s = read(p)
s = s.replace("connect-src 'self'; object-src 'none';", "connect-src 'self'; worker-src 'self'; object-src 'none';")
s = s.replace('.expandable-prompt{max-height:280px}', '.expandable-prompt{max-height:80vh}')
m = re.search(r'<script defer src="workflow-schema\.js\?v=([^"]+)"></script>', s)
if not m:
    raise RuntimeError('workflow-schema build token missing')
token = m.group(1)
schema_script = f'<script defer src="workflow-schema.js?v={token}"></script>'
runtime_script = f'<script defer src="test-runtime.js?v={token}"></script>'
if runtime_script not in s:
    s = once(s, schema_script, schema_script + '\n' + runtime_script, 'Test IR script order')
write(p, s)

# Proofs must pass before the source commit is published.
for f in ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','test-worker.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js','verify-capture-once.mjs']:
    run('node', '--check', f)
subprocess.run(['node','--input-type=module','-e',"globalThis.Event=class Event{constructor(type){this.type=type}};globalThis.dispatchEvent=()=>true;await import('./verify-capture-once.mjs')"], cwd=ROOT, check=True)

checks = {
    'workflow-schema.js': ['closed-loop-stage-response/3', "executableKinds:Object.freeze(['NONE','TEST_IR'])"],
    'workbook.js': ['closed-loop-project/3'],
    'workflow-engine.js': ['function stage01Exhausted', 'function stage03Exhausted', 'function stage04InputReadiness'],
    'prompt-engine.js': ['human-authority question-closure pass', 'Stage 04 prompt generation is blocked until Stage 01 human-authority intake and Stage 03 source research are exhausted', 'complete current canonical input union'],
    'index.html': ["worker-src 'self'", 'src="test-runtime.js?v='],
}
for path, needles in checks.items():
    text = read(path)
    for needle in needles:
        if needle not in text:
            raise RuntimeError(f'{path}: missing proof needle {needle}')
if 'CUSTOM_PIPELINE' in read('workflow-schema.js') or 'CUSTOM_PIPELINE' in read('test-runtime.js'):
    raise RuntimeError('CUSTOM_PIPELINE remains in v3 Test IR runtime/schema')

# Only production + permanent regression files are committed. Repair machinery is
# deliberately excluded and will be deleted after integration.
run('git','add','workbook.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js','index.html','verify-capture-once.mjs')
run('git','diff','--cached','--check')
run('git','commit','-m','Exhaust Stage 1 and Stage 3 before Stage 4')
