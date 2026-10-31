import json, hashlib, subprocess, pathlib, datetime, zoneinfo
root=pathlib.Path('/workspace/shared/clrt-management')
base='7df5f46e9a7e54da09622387a978badb39916c09'
statepath='verification/closed-loop-build-state.json'
state=json.loads((root/statepath).read_bytes()); previous=json.loads(subprocess.check_output(['git','show',base+':'+statepath],cwd=root))
m=state.pop('dotManagement')
assert state==previous, 'Existing ledger changed'
changes=subprocess.check_output(['git','diff','--name-only',base,'bb9264af'],cwd=root,text=True).splitlines()
assert changes==[statepath,'verification/dot-execution-instructions-20261014.txt'], changes
instr=(root/m['instructionPath']).read_bytes(); supplied=pathlib.Path('/workspace/shared/clrt-execution-part-a.txt').read_bytes()
assert instr==supplied
assert hashlib.sha256(instr).hexdigest()==m['instructionSha256']
spec=pathlib.Path('/workspace/shared/clrt-controlling-part-b.txt').read_bytes()
assert len(spec)==m['suppliedSpecification']['byteLength']==309482
assert hashlib.sha256(spec).hexdigest()==m['suppliedSpecification']['sha256']
repo_spec=(root/state['specificationPath']).read_bytes()
assert hashlib.sha256(repo_spec).hexdigest()==state['specificationSha256']==m['suppliedSpecification']['repositorySpecificationSha256']
assert len(repo_spec)==m['suppliedSpecification']['repositorySpecificationByteLength']
start=datetime.datetime.fromisoformat(m['projectStart'].replace('Z','+00:00')).astimezone(zoneinfo.ZoneInfo(m['timeZone']))
end=datetime.datetime.fromisoformat(m['targetFinish'].replace('Z','+00:00')).astimezone(zoneinfo.ZoneInfo(m['timeZone']))
assert end==start+datetime.timedelta(days=14)
assert len({t['id'] for t in m['tasks']})==len(m['tasks'])
assert all(t['state'] in m['taskStates'] for t in m['tasks'])
assert all(d in {t['id'] for t in m['tasks']} for t in m['tasks'] for d in t['dependencies'])
site=pathlib.Path('/workspace/shared/clrt-management-review-site'); manifest=json.loads((site/'closed-loop-deployment-manifest.json').read_bytes())
files=sorted(str(x.relative_to(site)) for x in site.rglob('*') if x.is_file())
assert len(files)==14
assert len(manifest['runtimeResources'])==13
assert not any(x.startswith(('verification/','specification/')) for x in files)
for path in site.rglob('*'):
 if path.is_file():
  payload=path.read_bytes()
  assert b'dotManagement' not in payload
  assert b'DOT MANAGEMENT, DELEGATION, AND DELIVERY CONTROL' not in payload
  assert b'dot-execution-instructions-20261014.txt' not in payload
obs=json.loads(pathlib.Path('/workspace/shared/clrt-live-byte-check.json').read_bytes())
assert obs['sourceCommit']==m['deploymentObservation']['sourceCommit']
assert len(obs['resources'])==m['deploymentObservation']['manifestedFileCount']==13
assert all(r['matchesManifest'] for r in obs['resources'])
assert hashlib.sha256(pathlib.Path('/workspace/shared/clrt-live-deployment-manifest.json').read_bytes()).hexdigest()==m['deploymentObservation']['manifestSha256']
ledger=json.loads(pathlib.Path('/workspace/shared/clrt-management-ledger-test.stdout').read_text())
assert ledger['ledgerVerified'] and ledger['doneStages']==0 and not ledger['applicationAcceptanceEstablished']
report={'result':'PASS','checks':['Existing ledger semantically identical after removal of dotManagement','Exactly two scoped changed paths','Instruction bytes and hash exactly match supplied Part A','Latest supplied Part B and historical repository source distinguished','Fourteen Chicago calendar days preserve kickoff','Unique task IDs, valid task states, known dependency IDs','Executed static build: 13 resources, no management or source text in 14 output files','Stored live-byte observation and manifest hash match ledger','Existing ledger test evidence is scoped and does not establish acceptance'],'projectStartChicago':start.isoformat(),'targetFinishChicago':end.isoformat(),'reviewedCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'buildIdentity':manifest['buildIdentity'],'limits':'No new live fetch, no new device evidence, no large suites, no full M06 completeness claim'}
print(json.dumps(report,indent=2))
