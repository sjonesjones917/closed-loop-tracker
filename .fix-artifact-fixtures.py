from pathlib import Path
p=Path('verify-complete.mjs')
s=p.read_text()
old="const p=project('JOB-ORDER');p.stages[27].status='COMPLETE';const rel=record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-ORDER');rel.scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.projectData.releaseRecords.push(rel);"
new="const p=project('JOB-ORDER');p.stages[27].status='COMPLETE';const rel=record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-ORDER');rel.scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.projectData.releaseRecords.push(rel);const aa=record('artifacts',21,{FILENAME:'a.bin',BYTE_SIZE:1,SHA256:'a',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},'A'),ab=record('artifacts',21,{FILENAME:'b.bin',BYTE_SIZE:2,SHA256:'b',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},'B');aa.scope={inputVersion:p.job.CURRENT_INPUT_VERSION};ab.scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.projectData.artifacts.push(aa,ab);"
if old not in s: raise SystemExit('JOB-ORDER canonical artifact fixture anchor missing')
s=s.replace(old,new,1)
old="p.stages[27].status='COMPLETE';const rel=record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-TEST');rel.scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.projectData.releaseRecords.push(rel);"
new="p.stages[27].status='COMPLETE';const rel=record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-TEST');rel.scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.projectData.releaseRecords.push(rel);const artifact=record('artifacts',21,{FILENAME:'x.bin',BYTE_SIZE:3,SHA256:'aaa',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},'A');artifact.scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.projectData.artifacts.push(artifact);"
if old not in s: raise SystemExit('JOB-IDENTITY canonical artifact fixture anchor missing')
s=s.replace(old,new,1)
p.write_text(s)
