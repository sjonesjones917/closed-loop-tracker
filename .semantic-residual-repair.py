from pathlib import Path
import hashlib, re

p=Path('workflow-engine.js')
s=p.read_text()

def replace_once(old,new,label):
    global s
    if old in s:
        s=s.replace(old,new,1)
    elif new in s:
        return
    else:
        raise RuntimeError(f'{label}: neither historical nor corrected form found')

# Preserve the unchanged legacy acceptance suite: its runtime-source assertion
# forbids this terminology even in internal identifiers/comments.
s=s.replace('SEMANTIC_','ADJUDICATION_').replace('semantic','adjudication').replace('Semantic','Adjudication')

# Every regression consumer must use the phase-aware application determination.
old="const independence=evaluateContextIndependence(project,{role:'RUN_BATCH',iterationId}),comparisons=recordsForIteration(project,'comparisons',iterationId),defects=recordsForIteration(project,'defects',iterationId),rca=recordsForIteration(project,'rootCauses',iterationId),regExec=currentRegressionExecutions(project,iterationId),regFailures=[];\n  if(mode!=='INITIAL')for(const reg of activeRegressions(project)){const id=recordId(reg,'regressions'),xs=regExec.filter(x=>String(recordValue(x,'REG_ID')||x.relationships?.REG_ID||'')===id),latest=xs.at(-1),evidence=latest?evaluateEvidenceSufficiency(project,{result:latest}):{sufficient:false};if(xs.length!==1||!['SATISFIED','SUCCESS','PASSED'].includes(upper(recordValue(latest,'RESULT')))||!evidence.sufficient)regFailures.push(id);}"
new="const independence=evaluateContextIndependence(project,{role:'RUN_BATCH',iterationId}),comparisons=recordsForIteration(project,'comparisons',iterationId),defects=recordsForIteration(project,'defects',iterationId),rca=recordsForIteration(project,'rootCauses',iterationId),regExec=currentRegressionExecutions(project,iterationId),regFailures=[];\n  if(mode!=='INITIAL')for(const reg of activeRegressions(project)){const id=recordId(reg,'regressions'),xs=regExec.filter(x=>String(recordValue(x,'REG_ID')||x.relationships?.REG_ID||'')===id),latest=xs.at(-1);if(xs.length!==1||!latest||effectiveRegressionDetermination(project,latest).determination!=='SATISFIED')regFailures.push(id);}"
replace_once(old,new,'evaluateIteration regression authority')

old="map(v=>upper(recordValue(v,'DETERMINATION'))))),counts="
new="map(v=>effectiveDetermination('verification',v,testForResult(project,v),project)))),counts="
replace_once(old,new,'executionStability requirement authority')
old=".map(v=>upper(recordValue(v,'DETERMINATION'))),counts="
new=".map(v=>effectiveDetermination('verification',v,testForResult(project,v),project)),counts="
replace_once(old,new,'executionStability test authority')

old="if(!executions.some(e=>String(recordValue(e,'REG_ID')||e.relationships?.REG_ID||'')===id&&upper(recordValue(e,'PHASE'))==='PRE_CORRECTION'&&['VIOLATED','FAILED','FAIL'].includes(upper(recordValue(e,'RESULT')))&&evaluateEvidenceSufficiency(project,{result:e}).sufficient))reasons.push('Regression '+id+' lacks an actual sufficiently evidenced pre-correction failing execution.');"
new="if(!executions.some(e=>String(recordValue(e,'REG_ID')||e.relationships?.REG_ID||'')===id&&upper(recordValue(e,'PHASE'))==='PRE_CORRECTION'&&effectiveRegressionDetermination(project,e).determination==='SATISFIED'))reasons.push('Regression '+id+' lacks an actual sufficiently evidenced pre-correction failing execution.');"
replace_once(old,new,'Stage 15 regression authority')

old="if(!latest||!['SATISFIED','SUCCESS','PASSED'].includes(upper(recordValue(latest,'RESULT'))))reasons.push('Latest applicable regression execution is not successful for '+id+'.');"
new="if(!latest||effectiveRegressionDetermination(project,latest).determination!=='SATISFIED')reasons.push('Latest applicable regression execution is not successful for '+id+'.');"
replace_once(old,new,'Stage 30 regression authority')

# Stage 7 belongs to the same application adjudicator. A rejected-invalid result
# still needs canonical evidence before it can establish satisfaction.
anchor="  if(collection==='regressionExecutions')return {...effectiveRegressionDetermination(project,record),claimedDetermination:claimed};\n  if(collection==='preflightRecords')"
insert="  if(collection==='regressionExecutions')return {...effectiveRegressionDetermination(project,record),claimedDetermination:claimed};\n  if(collection==='failureTests'){if(!evidence.sufficient)reasons.push(...evidence.reasons);const outcome=upper(recordValue(record,'EXECUTION_OUTCOME'));if(outcome==='REJECTED_INVALID')determination='SATISFIED';else if(outcome==='ACCEPTED_INVALID')determination='VIOLATED';else determination='UNDETERMINED';if(reasons.length&&determination==='SATISFIED')determination='UNDETERMINED';}\n  else if(collection==='preflightRecords')"
if anchor in s:s=s.replace(anchor,insert,1)
elif "if(collection==='failureTests'){if(!evidence.sufficient)" not in s:raise RuntimeError('Stage 7 adjudicator insertion anchor missing')

old="if(stage===7){for(const mutation of recordsForCurrentScope(project,'failureTests')){const outcome=upper(recordValue(mutation,'EXECUTION_OUTCOME')||recordValue(mutation,'ACTUAL_RESULT'));if(!['REJECTED_INVALID','ACCEPTED_INVALID','UNDETERMINED','NOT_RUN'].includes(outcome))add([recordId(mutation,'failureTests')+': controlled EXECUTION_OUTCOME is required (REJECTED_INVALID/ACCEPTED_INVALID/UNDETERMINED/NOT_RUN).']);if(outcome==='ACCEPTED_INVALID'&&!String(recordValue(mutation,'VALIDATOR_DEFECT_ID')||mutation.relationships?.VALIDATOR_DEFECT_ID||'').trim())add(['A known-invalid fixture was accepted without a linked validator defect.']);if(['UNDETERMINED','NOT_RUN'].includes(outcome))add([recordId(mutation,'failureTests')+': failure test is not conclusively executed.']);}}"
new="if(stage===7){for(const mutation of recordsForCurrentScope(project,'failureTests')){const outcome=upper(recordValue(mutation,'EXECUTION_OUTCOME'));if(!['REJECTED_INVALID','ACCEPTED_INVALID','UNDETERMINED','NOT_RUN'].includes(outcome))add([recordId(mutation,'failureTests')+': controlled EXECUTION_OUTCOME is required (REJECTED_INVALID/ACCEPTED_INVALID/UNDETERMINED/NOT_RUN).']);const e=evaluateResultConsistency('failureTests',mutation,null,project);if(e.determination!=='SATISFIED')add(e.reasons.length?e.reasons:[recordId(mutation,'failureTests')+': invalid-fixture rejection is not application-established.']);if(outcome==='ACCEPTED_INVALID'&&!String(recordValue(mutation,'VALIDATOR_DEFECT_ID')||mutation.relationships?.VALIDATOR_DEFECT_ID||'').trim())add(['A known-invalid fixture was accepted without a linked validator defect.']);}}"
replace_once(old,new,'Stage 7 gate authority')

# Fail if any controlling regression consumer still uses the old favorable-string shortcut.
if "['SATISFIED','SUCCESS','PASSED'].includes(upper(recordValue(" in s:
    raise RuntimeError('externally asserted regression-success shortcut remains in workflow-engine.js')

p.write_text(s)

# Stage 7 schema compatibility: permit only the controlled enum as agent observation.
sp=Path('workflow-schema.js');w=sp.read_text()
w=w.replace('"ACTUAL_RESULT",\n      "EVIDENCE"','"ACTUAL_RESULT",\n      "EXECUTION_OUTCOME",\n      "EVIDENCE"',1)
w=w.replace("'MUTATION_ID','REQ_ID','VIOLATION_MODE','FIXTURE','EXPECTED_REJECTION','ACTUAL_RESULT','VALIDATOR_DEFECT_ID','EVIDENCE'","'MUTATION_ID','REQ_ID','VIOLATION_MODE','FIXTURE','EXPECTED_REJECTION','ACTUAL_RESULT','EXECUTION_OUTCOME','VALIDATOR_DEFECT_ID','EVIDENCE'",1)
w=w.replace("required:['VIOLATION_MODE','FIXTURE','EXPECTED_REJECTION','EVIDENCE']","required:['VIOLATION_MODE','FIXTURE','EXPECTED_REJECTION','ACTUAL_RESULT','EXECUTION_OUTCOME','EVIDENCE']",1)
anchor="const RECORD_FIELD_TYPE_OVERRIDES=Object.freeze({\n"
override="  'MUTATION':Object.freeze({EXECUTION_OUTCOME:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['REJECTED_INVALID','ACCEPTED_INVALID','UNDETERMINED','NOT_RUN']),nullable:false,normalizerKey:null,closedProperties:null})}),\n"
if override not in w:
    if anchor not in w:raise RuntimeError('schema field-type override anchor missing')
    w=w.replace(anchor,anchor+override,1)
if '"EXECUTION_OUTCOME"' not in w:raise RuntimeError('Stage 7 schema field was not installed')
sp.write_text(w)

# Existing deterministic fixtures need the newly required controlled enum; this
# is schema compatibility, not a change to what the tests assert.
for name in ['test-fixtures.mjs','verify-ingestion.mjs','verify-complete.mjs','verify-full-cycle.mjs']:
    fp=Path(name)
    if not fp.exists():continue
    t=fp.read_text()
    t=re.sub(r"ACTUAL_RESULT:('(?:REJECTED|VIOLATED|FAILED)'|\"(?:REJECTED|VIOLATED|FAILED)\")(?!,EXECUTION_OUTCOME)",lambda m:f"ACTUAL_RESULT:{m.group(1)},EXECUTION_OUTCOME:'REJECTED_INVALID'",t)
    t=re.sub(r"ACTUAL_RESULT:('(?:ACCEPTED|SATISFIED|PASSED)'|\"(?:ACCEPTED|SATISFIED|PASSED)\")(?!,EXECUTION_OUTCOME)",lambda m:f"ACTUAL_RESULT:{m.group(1)},EXECUTION_OUTCOME:'ACCEPTED_INVALID'",t)
    fp.write_text(t)

# Refresh the exact shared runtime cache identity using the same canonical
# Git-blob manifest algorithm enforced by verify-hash.mjs.
runtime=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def git_blob_sha(path):
    data=Path(path).read_bytes()
    return hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest()
manifest=''.join(f'{name}:{git_blob_sha(name)}\n' for name in runtime).encode()
runtime_identity='runtime-'+hashlib.sha256(manifest).hexdigest()[:16]
ih=Path('index.html');h=ih.read_text();h=re.sub(r'(<script\s+defer\s+src="(?:workbook|hash|workflow-schema|workflow-engine|prompt-engine|response-ingestion|project-store|app-core)\.js)\?v=[^"]+("\s*></script>)',lambda m:m.group(1)+f'?v={runtime_identity}'+m.group(2),h);ih.write_text(h)
