from pathlib import Path
p=Path('verify-complete.mjs')
s=p.read_text()
replacements=[
("""  const p=project('JOB-ORDER');p.projectData.releaseRecords.push(record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-ORDER'));
  const audited=[{artifactId:'A',name:'a.bin',size:1,sha256:'a'},{artifactId:'B',name:'b.bin',size:2,sha256:'b'}];const delivery=[{artifactId:'B',name:'b.bin',size:2,sha256:'b'},{artifactId:'A',name:'a.bin',size:1,sha256:'a'}];
""",
"""  const p=project('JOB-ORDER'),scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.stages[27].status='COMPLETE';const release=record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-ORDER');release.scope=scope;p.projectData.releaseRecords.push(release);const shaA='a'.repeat(64),shaB='b'.repeat(64),artifactA=record('artifacts',21,{FILENAME:'a.bin',BYTE_SIZE:1,SHA256:shaA,AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},'A'),artifactB=record('artifacts',21,{FILENAME:'b.bin',BYTE_SIZE:2,SHA256:shaB,AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},'B');artifactA.scope=scope;artifactB.scope=scope;p.projectData.artifacts.push(artifactA,artifactB);
  const audited=[{artifactId:'A',name:'a.bin',size:1,sha256:shaA},{artifactId:'B',name:'b.bin',size:2,sha256:shaB}];const delivery=[{artifactId:'B',name:'b.bin',size:2,sha256:shaB},{artifactId:'A',name:'a.bin',size:1,sha256:shaA}];
"""),
("""  p.projectData.releaseRecords.push(record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-TEST'));
  const result=engine.verifyArtifactIdentity(p,[{artifactId:'A',name:'x.bin',size:3,sha256:'aaa'}],[{artifactId:'A',name:'x.bin',size:4,sha256:'bbb'}]);
""",
"""  const scope={inputVersion:p.job.CURRENT_INPUT_VERSION},release=record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-TEST'),sha='a'.repeat(64),canonical=record('artifacts',21,{FILENAME:'x.bin',BYTE_SIZE:3,SHA256:sha,AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},'A');p.stages[27].status='COMPLETE';release.scope=scope;canonical.scope=scope;p.projectData.releaseRecords.push(release);p.projectData.artifacts.push(canonical);
  const result=engine.verifyArtifactIdentity(p,[{artifactId:'A',name:'x.bin',size:3,sha256:sha}],[{artifactId:'A',name:'x.bin',size:4,sha256:'b'.repeat(64)}]);
"""),
("""  const p=project('JOB-CHAIN');p.projectData.requirements.push(record('requirements',4,{OBLIGATION:'Synthetic mandatory requirement',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',USER_INPUT_RELATIONSHIP:'User Job Input',APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'observable',INTENDED_VERIFICATION_METHOD:'deterministic',EXPECTED_EVIDENCE:'evidence',FAILURE_CONDITION:'missing',SEVERITY:'MAJOR',STATUS:'ACTIVE'},'REQ-TEST'));
""",
"""  const p=project('JOB-CHAIN'),req=record('requirements',4,{OBLIGATION:'Synthetic mandatory requirement',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',USER_INPUT_RELATIONSHIP:'User Job Input',APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'observable',INTENDED_VERIFICATION_METHOD:'deterministic',EXPECTED_EVIDENCE:'evidence',FAILURE_CONDITION:'missing',SEVERITY:'MAJOR',STATUS:'ACTIVE'},'REQ-TEST');req.scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.projectData.requirements.push(req);
""")
]
for old,new in replacements:
    if old not in s: raise SystemExit('Residual fixture anchor missing: '+old[:90])
    s=s.replace(old,new,1)
p.write_text(s)
