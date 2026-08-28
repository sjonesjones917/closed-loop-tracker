from pathlib import Path
p=Path('verify-complete.mjs')
s=p.read_text()
old="const p=project('JOB-RELIABILITY-V2');p.job.CURRENT_REQUIREMENTS_VERSION='REQUIREMENTS-v001';p.job.CURRENT_TEST_SUITE_VERSION='TEST-SUITE-v001';const scope=engine.currentScope(p);"
new="const p=project('JOB-RELIABILITY-V2');p.job.CURRENT_REQUIREMENTS_VERSION='REQUIREMENTS-v001';p.job.CURRENT_TEST_SUITE_VERSION='TEST-SUITE-v001';p.job.AVAILABLE_TOOLS='CAP-EXTERNAL_AGENT_TOOL\\nCAP-EXTERNAL_SYSTEM';const scope=engine.currentScope(p);"
if s.count(old)!=1: raise SystemExit('routing fixture anchor count='+str(s.count(old)))
s=s.replace(old,new,1)
old="const unavailable=plan.items.find(x=>x.executionMode==='UNAVAILABLE');assert(!unavailable.executableNow&&unavailable.blockingReason,'UNAVAILABLE test did not fail closed.');"
new="const unavailable=plan.items.find(x=>x.executionMode==='UNAVAILABLE');assert(!unavailable.executableNow&&unavailable.blockingReason,'UNAVAILABLE test did not fail closed.');p.job.AVAILABLE_TOOLS='CAP-EXTERNAL_SYSTEM';const missingCapability=engine.testExecutionPlan(p).items.find(x=>x.executionMode==='EXTERNAL_AGENT_TOOL');assert(!missingCapability.executableNow&&missingCapability.operatorAction==='BLOCKED'&&/capability/i.test(missingCapability.blockingReason||''),'Missing affirmative external-tool capability did not block execution.');"
if s.count(old)!=1: raise SystemExit('missing-capability fixture anchor count='+str(s.count(old)))
s=s.replace(old,new,1)
p.write_text(s)
