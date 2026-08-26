from pathlib import Path
p=Path('verify-complete.mjs')
s=p.read_text()
old="""  const p=project('JOB-ORDER');p.projectData.releaseRecords.push(record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-ORDER'));
  const audited=[{artifactId:'A',name:'a.bin',size:1,sha256:'a'},{artifactId:'B',name:'b.bin',size:2,sha256:'b'}];const delivery=[{artifactId:'B',name:'b.bin',size:2,sha256:'b'},{artifactId:'A',name:'a.bin',size:1,sha256:'a'}];
"""
new="""  const p=project('JOB-ORDER'),scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.stages[27].status='COMPLETE';const release=record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-ORDER');release.scope=scope;p.projectData.releaseRecords.push(release);const shaA='a'.repeat(64),shaB='b'.repeat(64),artifactA=record('artifacts',21,{FILENAME:'a.bin',BYTE_SIZE:1,SHA256:shaA,AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},'A'),artifactB=record('artifacts',21,{FILENAME:'b.bin',BYTE_SIZE:2,SHA256:shaB,AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},'B');artifactA.scope=scope;artifactB.scope=scope;p.projectData.artifacts.push(artifactA,artifactB);
  const audited=[{artifactId:'A',name:'a.bin',size:1,sha256:shaA},{artifactId:'B',name:'b.bin',size:2,sha256:shaB}];const delivery=[{artifactId:'B',name:'b.bin',size:2,sha256:shaB},{artifactId:'A',name:'a.bin',size:1,sha256:shaA}];
"""
if old not in s: raise SystemExit('Artifact order fixture anchor missing')
p.write_text(s.replace(old,new,1))
