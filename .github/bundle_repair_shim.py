from pathlib import Path
import re
p=Path('.github/bundle_repair.py')
t=p.read_text()
old="""    if count is not None and found!=count:\n        raise SystemExit(f'guard failed: {path}: expected {count} occurrences, found {found}: {old[:120]!r}')\n    text=text.replace(old,new)\n"""
new="""    if count is not None and found<count:\n        raise SystemExit(f'guard failed: {path}: expected at least {count} occurrences, found {found}: {old[:120]!r}')\n    text=text.replace(old,new,count if count is not None else -1)\n"""
if old not in t: raise SystemExit('repair helper guard source not found')
t=t.replace(old,new,1)
t=t.replace("${show(j.EXACT_DELIVERABLE_REQUESTED)}\\n\\n${stage>1?`PERSISTED PROJECT INPUT", "${show(j.EXACT_DELIVERABLE_REQUESTED)}\\n\\n${stage>1?`ACCEPTED STAGE 01 JOB DEFINITION — CANONICAL INPUT, DO NOT ASK THE HUMAN TO RESEND IT")
pattern=r"# Call closure validator before result returned; anchor on warning count near end of validateEnvelope\.\nreplace\('response-ingestion\.js',[\s\S]*?,1\)\n\n# 8\. Execution package"
replacement="# Call closure validator before result returned; inserted by bundle_repair_shim.py after the base transform.\n\n# 8. Execution package"
t,n=re.subn(pattern,replacement,t,count=1)
if n!=1: raise SystemExit(f'ingestion obsolete-anchor removal mismatch: {n}')
p.write_text(t)
exec(compile(t,str(p),'exec'),{'__file__':str(p),'__name__':'__main__'})

wp=Path('workbook.js');w=wp.read_text()
old_stage1="'INPUT_SET_VERSION','INPUT_SET_CONTENTS','INPUT_SET_HASH_OR_MANIFEST','JOB_RECORD_STATUS','STATUS_EVIDENCE']"
new_stage1="'INPUT_SET_VERSION','INPUT_SET_CONTENTS','INTAKE_ACCOUNTING','INPUT_SET_HASH_OR_MANIFEST','JOB_RECORD_STATUS','STATUS_EVIDENCE']"
if w.count(old_stage1)!=1: raise SystemExit(f'Stage 1 field inventory guard mismatch: {w.count(old_stage1)}')
w=w.replace(old_stage1,new_stage1,1)
old_stage4="'OPTIONAL_REQUIREMENTS','BLOCKED_REQUIREMENTS','STAGE_DECISION','DECISION_EVIDENCE']"
new_stage4="'OPTIONAL_REQUIREMENTS','BLOCKED_REQUIREMENTS','OBLIGATION_ACCOUNTING','STAGE_DECISION','DECISION_EVIDENCE']"
if w.count(old_stage4)!=1: raise SystemExit(f'Stage 4 field inventory guard mismatch: {w.count(old_stage4)}')
w=w.replace(old_stage4,new_stage4,1)
wp.write_text(w)

sp=Path('workflow-schema.js');s=sp.read_text()
old_overrides="""const STAGE_FIELD_TYPE_OVERRIDES=Object.freeze({
  '1':Object.freeze({DESIRED_SOURCE_COUNT:Object.freeze({valueType:'INTEGER',enumValues:Object.freeze([]),nullable:true,normalizerKey:null,closedProperties:null})}),
  '2':Object.freeze({SOURCE_APPLICABILITY_DETERMINATION:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['APPLICABLE_SOURCES_ESTABLISHED','NO_APPLICABLE_EXTERNAL_SOURCE','UNDETERMINED']),nullable:false,normalizerKey:null,closedProperties:null})})
});"""
new_overrides="""const STAGE_FIELD_TYPE_OVERRIDES=Object.freeze({
  '1':Object.freeze({
    DESIRED_SOURCE_COUNT:Object.freeze({valueType:'INTEGER',enumValues:Object.freeze([]),nullable:true,normalizerKey:null,closedProperties:null}),
    INTAKE_ACCOUNTING:Object.freeze({valueType:'OBJECT',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:Object.freeze(['items'])})
  }),
  '2':Object.freeze({SOURCE_APPLICABILITY_DETERMINATION:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['APPLICABLE_SOURCES_ESTABLISHED','NO_APPLICABLE_EXTERNAL_SOURCE','UNDETERMINED']),nullable:false,normalizerKey:null,closedProperties:null})}),
  '4':Object.freeze({
    OBLIGATION_ACCOUNTING:Object.freeze({valueType:'OBJECT',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:Object.freeze(['items'])})
  })
});"""
if s.count(old_overrides)!=1: raise SystemExit(f'accounting type override guard mismatch: {s.count(old_overrides)}')
s=s.replace(old_overrides,new_overrides,1)
sp.write_text(s)

rp=Path('response-ingestion.js');r=rp.read_text()
anchor="  return {valid:issues.every(item=>item.severity!=='ERROR'),issues,errorCount:issues.filter(item=>item.severity==='ERROR').length,warningCount:issues.filter(item=>item.severity==='WARNING').length,checkedAt:now(),responseSchema:envelope.schema,responseType:envelope.responseType,temporaryRecordIndex:responseRecordIndex,temporaryEvidenceIndex:evidenceIndex,temporaryAttachmentIndex:attachmentIndex,canonicalEnvelopeSha256};"
replacement="  validateAccountingClosure(project,envelope,stageNumber,issues);\n"+anchor
if r.count(anchor)!=1: raise SystemExit(f'validateEnvelope accounting insertion anchor mismatch: {r.count(anchor)}')
rp.write_text(r.replace(anchor,replacement,1))

wp=Path('test-worker.js')
w=wp.read_text();bad="\\'use strict\\';"
if w.startswith(bad): w="'use strict';"+w[len(bad):]
elif not w.startswith("'use strict';"): raise SystemExit('generated test-worker.js has an unexpected opener')
wp.write_text(w)

sp=Path('project-store.js');s=sp.read_text()
old_decl="if(!project||typeof project!=='object')throw new Error('A canonical project is required for an execution package.');const engine=globalThis.closedLoopWorkflowEngine,jobId=projectIdentity(project),ids="
new_decl="if(!project||typeof project!=='object')throw new Error('A canonical project is required for an execution package.');jobId=jobId||projectIdentity(project);const engine=globalThis.closedLoopWorkflowEngine,ids="
if s.count(old_decl)!=1: raise SystemExit(f'generated project-store.js job identity guard mismatch: {s.count(old_decl)}')
sp.write_text(s.replace(old_decl,new_decl,1))

pp=Path('prompt-engine.js');ps=pp.read_text()
if '${accountingPromptBlock(stage,project)}' not in ps: raise SystemExit('prompt accounting state binding anchor missing')
pp.write_text(ps.replace('${accountingPromptBlock(stage,project)}','${accountingPromptBlock(stage,state)}',1))

vp=Path('verify-bundle-v3.mjs');v=vp.read_text();old_assert="assert.equal(core.STAGES.length,30);assert.equal(core.STAGES[15].name,'CORRECT THE ROOT CAUSE');";new_assert="assert.equal(core.STAGES.length,30);assert.equal(core.STAGES[15].title,'CORRECT THE ROOT CAUSE');"
if old_assert not in v: raise SystemExit('v3 stage-title proof anchor missing')
vp.write_text(v.replace(old_assert,new_assert,1))
for name in ['verify.mjs','verify-complete.mjs','verify-definition-of-done.mjs','verify-prompt-semantics.mjs','verify-ingestion.mjs']:
    fp=Path(name)
    if fp.exists(): fp.write_text(fp.read_text().replace('Revise the Responsible Layer','Correct the Root Cause').replace('REVISE THE RESPONSIBLE LAYER','CORRECT THE ROOT CAUSE'))

ip=Path('verify-ingestion.mjs');iv=ip.read_text()
anchor="  if(stageFields.length)stageData[stageFields[0]]=safeValue(stageFields[0]);\n  const records={};"
replacement="  if(stageFields.length)stageData[stageFields[0]]=safeValue(stageFields[0]);\n  if(stage===1){const m=engine.currentIntakeCoverageManifest(p);stageData.INTAKE_ACCOUNTING={items:m.units.map(u=>({unitId:u.unitId,disposition:'INCORPORATED'}))};}\n  if(stage===4){const m=engine.currentObligationManifest(p);stageData.OBLIGATION_ACCOUNTING={items:m.items.map(o=>({obligationId:o.obligationId,disposition:'RETAINED_CONTEXT'}))};}\n  const records={};"
if iv.count(anchor)!=1: raise SystemExit(f'ingestion fixture accounting anchor mismatch: {iv.count(anchor)}')
iv=iv.replace(anchor,replacement,1)
smart_old="  e.stageData={EXACT_DELIVERABLE_REQUESTED:'Patent application draft',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'Later filing-route facts',INPUT_SET_CONTENTS:'Human request and invention-packet.zip'};"
smart_new="  e.stageData={EXACT_DELIVERABLE_REQUESTED:'Patent application draft',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'Later filing-route facts',INPUT_SET_CONTENTS:'Human request and invention-packet.zip',INTAKE_ACCOUNTING:{items:engine.currentIntakeCoverageManifest(p).units.map(u=>({unitId:u.unitId,disposition:'INCORPORATED'}))}};"
if iv.count(smart_old)!=1: raise SystemExit(f'smart-quote intake accounting fixture mismatch: {iv.count(smart_old)}')
iv=iv.replace(smart_old,smart_new,1)
old_count="  if(stageEntries.length!==4||stageEntries.some(x=>!Array.isArray(x.evidenceIds)||x.evidenceIds.length===0))throw new Error('StageData provenance is not linked to canonical response evidence.');"
new_count="  if(stageEntries.length!==5||stageEntries.some(x=>!Array.isArray(x.evidenceIds)||x.evidenceIds.length===0))throw new Error('StageData provenance is not linked to canonical response evidence.');"
if iv.count(old_count)!=1: raise SystemExit(f'smart-quote provenance count fixture mismatch: {iv.count(old_count)}')
iv=iv.replace(old_count,new_count,1)
ip.write_text(iv)
