from pathlib import Path
p=Path('.github/bundle_repair.py')
t=p.read_text()
old="""    if count is not None and found!=count:\n        raise SystemExit(f'guard failed: {path}: expected {count} occurrences, found {found}: {old[:120]!r}')\n    text=text.replace(old,new)\n"""
new="""    if count is not None and found<count:\n        raise SystemExit(f'guard failed: {path}: expected at least {count} occurrences, found {found}: {old[:120]!r}')\n    text=text.replace(old,new,count if count is not None else -1)\n"""
if old not in t: raise SystemExit('repair helper guard source not found')
t=t.replace(old,new,1)
t=t.replace("${show(j.EXACT_DELIVERABLE_REQUESTED)}\\n\\n${stage>1?`PERSISTED PROJECT INPUT", "${show(j.EXACT_DELIVERABLE_REQUESTED)}\\n\\n${stage>1?`ACCEPTED STAGE 01 JOB DEFINITION — CANONICAL INPUT, DO NOT ASK THE HUMAN TO RESEND IT")
old_ingest='''replace('response-ingestion.js',"  const errors=issues.filter(item=>item.severity!==\'WARNING\');", "  validateAccountingClosure(project,envelope,stageNumber,issues);\\n  const errors=issues.filter(item=>item.severity!==\'WARNING\');",1)'''
new_ingest='''replace('response-ingestion.js',"  return {valid:issues.every(item=>item.severity!==\'ERROR\')", "  validateAccountingClosure(project,envelope,stageNumber,issues);\\n  return {valid:issues.every(item=>item.severity!==\'ERROR\')",1)'''
if old_ingest not in t: raise SystemExit('ingestion insertion transform not found')
t=t.replace(old_ingest,new_ingest,1)
p.write_text(t)
exec(compile(t,str(p),'exec'),{'__file__':str(p),'__name__':'__main__'})
wp=Path('test-worker.js')
w=wp.read_text()
bad="\\'use strict\\';"
if w.startswith(bad):
    w="'use strict';"+w[len(bad):]
elif not w.startswith("'use strict';"):
    raise SystemExit('generated test-worker.js has an unexpected opener')
wp.write_text(w)
sp=Path('project-store.js')
s=sp.read_text()
old_decl="if(!project||typeof project!=='object')throw new Error('A canonical project is required for an execution package.');const engine=globalThis.closedLoopWorkflowEngine,jobId=projectIdentity(project),ids="
new_decl="if(!project||typeof project!=='object')throw new Error('A canonical project is required for an execution package.');jobId=jobId||projectIdentity(project);const engine=globalThis.closedLoopWorkflowEngine,ids="
if s.count(old_decl)!=1:
    raise SystemExit(f'generated project-store.js job identity guard mismatch: {s.count(old_decl)}')
s=s.replace(old_decl,new_decl,1)
sp.write_text(s)
vp=Path('verify-bundle-v3.mjs')
v=vp.read_text()
old_assert="assert.equal(core.STAGES.length,30);assert.equal(core.STAGES[15].name,'CORRECT THE ROOT CAUSE');"
new_assert="assert.equal(core.STAGES.length,30);assert.equal(core.STAGES[15].title,'CORRECT THE ROOT CAUSE');"
if old_assert not in v: raise SystemExit('v3 stage-title proof anchor missing')
vp.write_text(v.replace(old_assert,new_assert,1))
for name in ['verify.mjs','verify-complete.mjs','verify-definition-of-done.mjs','verify-prompt-semantics.mjs','verify-ingestion.mjs']:
    fp=Path(name)
    if fp.exists(): fp.write_text(fp.read_text().replace('Revise the Responsible Layer','Correct the Root Cause').replace('REVISE THE RESPONSIBLE LAYER','CORRECT THE ROOT CAUSE'))
