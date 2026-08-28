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
old="const p=project('JOB-EVIDENCE-V2'),t=record('tests',6,{REQ_ID:'REQ-E',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'EXTERNAL_AGENT_TOOL',REQUIRED_CAPABILITY:'sha256',ARTIFACT_REQUIREMENTS:'exact bytes',EVIDENCE_TO_PRESERVE:'byte hash',STATUS:'READY'},'TEST-E'),r=record('deterministicResults',22,{TEST_ID:'TEST-E',ACTUAL_RESULT:'same',DETERMINATION:'SATISFIED',EVIDENCE:'agent says same'},'RESULT-E');"
new="const p=project('JOB-EVIDENCE-V2'),t=record('tests',6,{REQ_ID:'REQ-E',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'EXTERNAL_AGENT_TOOL',REQUIRED_CAPABILITY:'sha256',ARTIFACT_REQUIREMENTS:'exact bytes',EVIDENCE_TO_PRESERVE:'byte hash',STATUS:'READY'},'TEST-E'),r=record('deterministicResults',22,{TEST_ID:'TEST-E',EXECUTION_ID:'EXEC-E',CONTEXT_ID:'CTX-E',ACTUAL_RESULT:'same',DETERMINATION:'SATISFIED',EVIDENCE:'agent says same'},'RESULT-E');"
if s.count(old)!=1: raise SystemExit('objective result identity fixture anchor count='+str(s.count(old)))
s=s.replace(old,new,1)
old="e=record('evidenceRecords',22,{KIND:'TOOL_OUTPUT',DESCRIPTION:'hash',LOCATION:'tool',CONTENT:'sha256 output',ATTACHMENT_ID:'ART-E',STATUS:'PRESERVED'},'EVIDENCE-E');"
new="e=record('evidenceRecords',22,{KIND:'TOOL_OUTPUT',AUTHORITY_TYPE:'EXTERNAL_TOOL',DESCRIPTION:'hash',LOCATION:'tool',CONTENT:'sha256 output',ATTACHMENT_ID:'ART-E',STATUS:'PRESERVED'},'EVIDENCE-E');"
if s.count(old)!=1: raise SystemExit('objective evidence authority fixture anchor count='+str(s.count(old)))
s=s.replace(old,new,1)
p.write_text(s)
