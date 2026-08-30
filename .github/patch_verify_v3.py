from pathlib import Path
import re
import subprocess


def replace_once(path, old, new, label):
    p = Path(path)
    s = p.read_text()
    if old in s:
        s = s.replace(old, new, 1)
    elif new not in s:
        raise SystemExit(f'{label} anchor missing')
    p.write_text(s)

# Stage 01: no foreseeable human-only project fact/decision may be silently deferred.
p = Path('prompt-engine.js')
s = p.read_text()
s = s.replace("const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/28';", "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/29';")
old1 = 'Do not block Stage 01 merely because information will be needed by a later research, design, production, filing, verification, or execution stage. Record such later-needed information in UNKNOWN_INFORMATION and let the earliest stage that actually requires it resolve it.'
new1 = 'Classify every foreseeable unresolved issue before Stage 01 final JSON as BLOCKING_NOW, ASK_NOW_NONBLOCKING, or LATER_RESOLVABLE. Every genuinely human-only BLOCKING_NOW and ASK_NOW_NONBLOCKING issue MUST be asked now conversationally; ASK_NOW_NONBLOCKING may be answered unknown or deferred, but nonblocking never means the question may be skipped. Use LATER_RESOLVABLE only when the fact can be established from accessible supplied material, authorized research, or a later deterministic stage without human authority; do not ask the human for those.'
if old1 in s:
    s = s.replace(old1, new1, 1)
elif new1 not in s:
    raise SystemExit('Stage 01 issue-classification anchor missing')
old2 = 'Stage 01 does not require every fact needed to execute later stages.'
new2 = 'Stage 01 requires every foreseeable genuinely human-only fact or decision relevant to the requested outcome to be supplied, asked and answered, or asked and explicitly deferred before DATA_PROPOSAL; later stages may resolve only LATER_RESOLVABLE matters that do not require human authority.'
if old2 in s:
    s = s.replace(old2, new2, 1)
elif new2 not in s:
    raise SystemExit('Stage 01 exhaustive-human-authority anchor missing')
for forbidden in [old1, old2]:
    if forbidden in s:
        raise SystemExit('Stage 01 contradictory deferral rule remains')
if not all(token in s for token in ['BLOCKING_NOW', 'ASK_NOW_NONBLOCKING', 'LATER_RESOLVABLE', 'nonblocking never means the question may be skipped']):
    raise SystemExit('Stage 01 classification contract incomplete')
p.write_text(s)

# Stage 03: application gate requires explicit saturation, not just one record per source.
p = Path('workflow-engine.js')
s = p.read_text()
old = """    case 3:{
      requireAccepted();const sourceIds=all('sources').map(record=>recordId(record,'sources')),noSource=upper(project.stages[2]?.agentData?.SOURCE_APPLICABILITY_DETERMINATION)==='NO_APPLICABLE_EXTERNAL_SOURCE';
      if(!sourceIds.length&&!noSource)reasons.push('Stage 03 cannot proceed without a current Stage 02 source set or valid no-source determination.');
      if(sourceIds.length){requireCount('research',1);const researched=new Set(collection('research').map(record=>String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||''))),missing=sourceIds.filter(id=>!researched.has(id));if(missing.length)reasons.push(`Research is missing for source(s): ${missing.join(', ')}.`);}
      const requiredStatements=currentIntentStatements(project).filter(intentStatementRequiresRequirement),candidateLocations=new Set(collection('candidateRequirements').map(record=>String(recordValue(record,'SOURCE_LOCATION')||'').trim())),missingStatements=requiredStatements.map(record=>recordId(record,'intentStatements')).filter(id=>!candidateLocations.has(id));
      if(missingStatements.length)reasons.push(`Candidate requirement coverage is missing for canonical intent statement(s): ${missingStatements.join(', ')}.`);
      break;
    }"""
new = """    case 3:{
      requireAccepted();const sourceIds=all('sources').map(record=>recordId(record,'sources')),noSource=upper(project.stages[2]?.agentData?.SOURCE_APPLICABILITY_DETERMINATION)==='NO_APPLICABLE_EXTERNAL_SOURCE';
      if(!sourceIds.length&&!noSource)reasons.push('Stage 03 cannot proceed without a current Stage 02 source set or valid no-source determination.');
      if(sourceIds.length){requireCount('research',1);const researched=new Set(collection('research').map(record=>String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||''))),missing=sourceIds.filter(id=>!researched.has(id));if(missing.length)reasons.push(`Research is missing for source(s): ${missing.join(', ')}.`);}
      const requiredStatements=currentIntentStatements(project).filter(intentStatementRequiresRequirement),candidateLocations=new Set(collection('candidateRequirements').map(record=>String(recordValue(record,'SOURCE_LOCATION')||'').trim())),missingStatements=requiredStatements.map(record=>recordId(record,'intentStatements')).filter(id=>!candidateLocations.has(id));
      if(missingStatements.length)reasons.push(`Candidate requirement coverage is missing for canonical intent statement(s): ${missingStatements.join(', ')}.`);
      const stage3Data=project.stages?.[3]?.agentData||{};
      if(!truth(stage3Data.SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED))reasons.push('Stage 03 requires the second conflict and exception pass to be complete.');
      if(numeric(stage3Data.LATEST_PASS_NUMBER)<2)reasons.push('Stage 03 requires at least two completed research passes before saturation can be established.');
      const latestNew=stage3Data.NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS;
      if(latestNew===undefined||latestNew===null||String(latestNew).trim()==='')reasons.push('Stage 03 latest-pass new-material determination is missing.');
      else if(!falsey(latestNew))reasons.push('Stage 03 is not saturated because the latest pass found a new material category.');
      break;
    }"""
if old in s:
    s = s.replace(old, new, 1)
elif new not in s:
    bad = "      if(!truth(stage3Data.ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED))reasons.push('Stage 03 has not established that all known controlling sources were examined.');\n"
    if bad in s:
        s = s.replace(bad, '', 1)
    elif 'Stage 03 requires the second conflict and exception pass to be complete.' not in s:
        raise SystemExit('Stage 03 gate anchor missing')

# Stage 03 application-owned completeness fields are derived from current records, never agent assertions.
old_case = "case 2:Object.assign(derived,{SOURCE_SET_VERSION:project.job.CURRENT_SOURCE_SET_VERSION||'NOT APPLICABLE',SOURCE_RECORDS:ids('sources'),SOURCE_CONFLICT_RECORDS:ids('sourceConflicts')});break;case 4:"
new_case = "case 2:Object.assign(derived,{SOURCE_SET_VERSION:project.job.CURRENT_SOURCE_SET_VERSION||'NOT APPLICABLE',SOURCE_RECORDS:ids('sources'),SOURCE_CONFLICT_RECORDS:ids('sourceConflicts')});break;case 3:{const sourceIds=recordsForCurrentScope(project,'sources').map(record=>recordId(record,'sources')),researched=new Set(recordsForCurrentScope(project,'research').map(record=>String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||''))),noSource=upper(project.stages[2]?.agentData?.SOURCE_APPLICABILITY_DETERMINATION)==='NO_APPLICABLE_EXTERNAL_SOURCE',allExamined=noSource||(sourceIds.length>0&&sourceIds.every(id=>researched.has(id)));Object.assign(derived,{RESEARCH_VERSION:project.job.CURRENT_RESEARCH_VERSION||'NOT APPLICABLE',SOURCE_RESEARCH_RECORDS:recordsForCurrentScope(project,'research').length,CANDIDATE_REQUIREMENT_RECORDS:recordsForCurrentScope(project,'candidateRequirements').length,ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:allExamined});break;}case 4:"
if old_case in s:
    s = s.replace(old_case, new_case, 1)
elif new_case not in s:
    raise SystemExit('Stage 03 derivation anchor missing')

# Canonical Test IR contract: TEST_IR is the only executable declarative kind and
# the application owns the schema version written into accepted test records.
p_schema = Path('workflow-schema.js')
ws = p_schema.read_text()
ws = ws.replace("executableKinds:Object.freeze(['NONE','CUSTOM_PIPELINE'])", "executableKinds:Object.freeze(['NONE','TEST_IR'])")
old_owner = (
    '      "EXECUTABLE_KIND",\n'
    '      "EXECUTABLE_SPEC_VERSION",\n'
    '      "EXECUTABLE_SPEC",\n'
    '      "EXECUTABLE_INPUT_BINDINGS"\n'
    '    ],\n'
    '    "application": [\n'
    '      "TEST_ID",\n'
    '      "REQ_ID",\n'
    '      "STATUS"'
)
new_owner = (
    '      "EXECUTABLE_KIND",\n'
    '      "EXECUTABLE_SPEC",\n'
    '      "EXECUTABLE_INPUT_BINDINGS"\n'
    '    ],\n'
    '    "application": [\n'
    '      "TEST_ID",\n'
    '      "REQ_ID",\n'
    '      "STATUS",\n'
    '      "EXECUTABLE_SPEC_VERSION"'
)
if old_owner in ws:
    ws = ws.replace(old_owner, new_owner, 1)
elif new_owner not in ws:
    raise SystemExit('Test IR ownership anchor missing')
ws = ws.replace("toUpperCase()!=='CUSTOM_PIPELINE')issues.push('EXECUTABLE_KIND must be CUSTOM_PIPELINE.')", "toUpperCase()!=='TEST_IR')issues.push('EXECUTABLE_KIND must be TEST_IR.')")
p_schema.write_text(ws)

# Application initializes the immutable current Test IR version on canonical TEST records.
old_init = "tests:Object.freeze({STATUS:'READY'})"
new_init = "tests:Object.freeze({STATUS:'READY',EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/1'})"
if old_init in s:
    s = s.replace(old_init, new_init, 1)
elif new_init not in s:
    raise SystemExit('TEST application initialization anchor missing')
p.write_text(s)

# Stage 06 tells the agent which version it targets, but does not tell it to write an application-owned field.
p = Path('prompt-engine.js')
s = p.read_text()
old_instr = 'If yes, you MUST use EXECUTION_MODE = APPLICATION_DETERMINISTIC, REQUIRED_CAPABILITY = ${schema.TEST_IR.capability}, EXECUTABLE_KIND = TEST_IR, EXECUTABLE_SPEC_VERSION = ${schema.TEST_IR.version}, and provide EXECUTABLE_SPEC plus EXECUTABLE_INPUT_BINDINGS.'
new_instr = 'If yes, you MUST use EXECUTION_MODE = APPLICATION_DETERMINISTIC, REQUIRED_CAPABILITY = ${schema.TEST_IR.capability}, EXECUTABLE_KIND = TEST_IR, and provide EXECUTABLE_SPEC plus EXECUTABLE_INPUT_BINDINGS targeting Test IR version ${schema.TEST_IR.version}. The application owns EXECUTABLE_SPEC_VERSION and will stamp that version after validation; do not write or override it.'
if old_instr in s:
    s = s.replace(old_instr, new_instr, 1)
elif new_instr not in s:
    raise SystemExit('Stage 06 Test IR ownership wording anchor missing')
p.write_text(s)

# Restore the complete CSS from the known pre-regression visual baseline. Keep current markup/runtime/CSP.
baseline = subprocess.run(['git', 'show', '7db322163404461bc1bded245f9ec8b8d9af6985:index.html'], check=True, capture_output=True, text=True).stdout
current = Path('index.html').read_text()
bm = re.search(r'<style>[\s\S]*?</style>', baseline)
cm = re.search(r'<style>[\s\S]*?</style>', current)
if not bm or not cm:
    raise SystemExit('style block missing')
current = current[:cm.start()] + bm.group(0) + current[cm.end():]
Path('index.html').write_text(current)
if '.expandable-prompt{height:auto;max-height:clamp(280px,42vh,440px)}' not in current:
    raise SystemExit('pre-regression prompt visual baseline not restored')
if '.expandable-prompt{height:280px;max-height:280px}' in current:
    raise SystemExit('fixed prompt-height regression remains')

# Permanent regression: source semantics, engine saturation, closed Stage 04, exact Test IR ownership, exact visual rollback.
Path('verify-stage01-stage03-stage04-closure.mjs').write_text(r'''import fs from 'node:fs';
const must=(c,m)=>{if(!c)throw new Error(m)};
const w=fs.readFileSync('workbook.js','utf8');
const p=fs.readFileSync('prompt-engine.js','utf8');
const e=fs.readFileSync('workflow-engine.js','utf8');
const s=fs.readFileSync('workflow-schema.js','utf8');
const h=fs.readFileSync('index.html','utf8');
must(w.includes("closed-loop-project/3"),'project schema is not /3');
must(s.includes("closed-loop-stage-response/3"),'response schema is not /3');
must(w.includes('CORRECT THE ROOT CAUSE'),'Stage 16 visible title not corrected');
must(p.includes('EXHAUSTIVE HUMAN-AUTHORITY INTAKE IS REQUIRED'),'Stage 01 is not explicitly exhaustive');
for(const token of ['BLOCKING_NOW','ASK_NOW_NONBLOCKING','LATER_RESOLVABLE','nonblocking never means the question may be skipped'])must(p.includes(token),`Stage 01 classification missing ${token}`);
must(!p.includes('Stage 01 does not require every fact needed to execute later stages.'),'Stage 01 still permits human-authority escape');
must(!p.includes('Record such later-needed information in UNKNOWN_INFORMATION and let the earliest stage that actually requires it resolve it.'),'Stage 01 still silently defers foreseeable human-only information');
must(p.includes('EXHAUSTIVE STAGE 03 RESEARCH IS REQUIRED'),'Stage 03 is not explicitly exhaustive');
for(const token of ['SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED','LATEST_PASS_NUMBER','NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS','Stage 03 is not saturated because the latest pass found a new material category.','ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:allExamined'])must(e.includes(token),`Stage 03 gate/derivation missing ${token}`);
must(!e.includes("truth(stage3Data.ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED)"),'Stage 03 still trusts agent assertion for application-owned source completeness');
must(p.includes('STAGE 04 IS A CLOSED COMPILATION STEP'),'Stage 04 is not closed over upstream state');
must(p.includes('Stage 04 prompt generation blocked: current Stage 01'),'Stage 04 does not hard-block incomplete Stage 01');
must(p.includes('Stage 04 prompt generation blocked: current Stage 03'),'Stage 04 does not hard-block incomplete Stage 03');
must(p.includes('Never ask the human to retype it, re-explain it, resend it, or re-attach'),'no-repeat rule missing');
must(e.includes('CURRENT_USER_JOB_INPUT')&&e.includes('STAGE_01_JOB_DEFINITION')&&e.includes('STAGE_03_ACCEPTED_DATA'),'Stage 04 obligation universe omits required upstream classes');
must(!p.includes('EXECUTABLE_KIND = CUSTOM_PIPELINE'),'CUSTOM_PIPELINE still exposed in prompt');
must(!s.includes("executableKinds:Object.freeze(['NONE','CUSTOM_PIPELINE'])"),'CUSTOM_PIPELINE still exposed in schema');
must(s.includes("executableKinds:Object.freeze(['NONE','TEST_IR'])"),'TEST_IR canonical kind missing');
must(p.includes('EXECUTABLE_KIND = TEST_IR'),'TEST_IR authoring instruction missing');
must(p.includes('application owns EXECUTABLE_SPEC_VERSION'),'Stage 06 does not identify application-owned Test IR version');
const order=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const src=[...h.matchAll(/<script\s+defer\s+src="([^\"]+)"/g)].map(x=>x[1].split('?')[0]);
must(order.every((x,i)=>src[i]===x),'runtime script order is not controlling order');
must(h.includes('.expandable-prompt{height:auto;max-height:clamp(280px,42vh,440px)}'),'pre-regression prompt visual baseline not restored');
must(!h.includes('.expandable-prompt{height:280px;max-height:280px}'),'fixed prompt-height visual regression remains');
must(!/stage-output\{[^}]*min-height:88px/.test(h),'prohibited 88px mobile prompt/response size override returned');
console.log('verify-stage01-stage03-stage04-closure: PASS');
''')

print('final semantic/visual/authority patch materialized')
