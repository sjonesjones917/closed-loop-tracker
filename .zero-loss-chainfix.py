from pathlib import Path

path = Path('workflow-engine.js')
text = path.read_text()
old = "tests=applicableTests(project,requirement),results=[...recordsForCurrentScope(project,'verification'),...recordsForCurrentScope(project,'deterministicResults'),...recordsForCurrentScope(project,'meaningResults'),...recordsForCurrentScope(project,'adversarialResults')].filter(r=>resultRequirementId(project,r)===reqId),evidenceIds=new Set(),missing=[];"
new = "tests=applicableTests(project,requirement),verificationResults=recordsForCurrentScope(project,'verification'),deterministicResults=recordsForCurrentScope(project,'deterministicResults'),meaningResults=recordsForCurrentScope(project,'meaningResults'),adversarialResults=recordsForCurrentScope(project,'adversarialResults'),results=[...verificationResults,...deterministicResults,...meaningResults,...adversarialResults].filter(r=>resultRequirementId(project,r)===reqId),evidenceIds=new Set(),missing=[];"
if text.count(old) != 1:
    raise SystemExit(f'evidence-chain result source target mismatch: {text.count(old)}')
text = text.replace(old, new, 1)
old = "const collection=Number(result.stage)===12?'verification':Number(result.stage)===22?'deterministicResults':Number(result.stage)===23?'meaningResults':Number(result.stage)===24?'adversarialResults':null;"
new = "const collection=verificationResults.includes(result)?'verification':deterministicResults.includes(result)?'deterministicResults':meaningResults.includes(result)?'meaningResults':adversarialResults.includes(result)?'adversarialResults':null;"
if text.count(old) != 1:
    raise SystemExit(f'evidence-chain collection identity target mismatch: {text.count(old)}')
path.write_text(text.replace(old, new, 1))
