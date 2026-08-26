from pathlib import Path
p=Path('verify-complete.mjs')
s=p.read_text()
replacements=[
("const p=project('JOB-STAGE24-EXACT');p.job.CURRENT_PRODUCT_ID='PRODUCT-24';p.stages[24].agentData.ATTACKS_EXECUTED=['CATEGORY-A','CATEGORY-B'];",
 "const p=project('JOB-STAGE24-EXACT');p.job.CURRENT_PRODUCT_ID='PRODUCT-24';p.stages[23].status='COMPLETE';p.stages[24].agentData.ATTACKS_EXECUTED=['CATEGORY-A','CATEGORY-B'];"),
("const p=project('JOB-ORDER');p.projectData.releaseRecords.push(record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-ORDER'));",
 "const p=project('JOB-ORDER');p.stages[27].status='COMPLETE';const releaseOrder=record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-ORDER');releaseOrder.scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.projectData.releaseRecords.push(releaseOrder);const artifactA=record('artifacts',21,{FILENAME:'a.bin',BYTE_SIZE:1,SHA256:'a',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},'A'),artifactB=record('artifacts',21,{FILENAME:'b.bin',BYTE_SIZE:2,SHA256:'b',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},'B');artifactA.scope={inputVersion:p.job.CURRENT_INPUT_VERSION};artifactB.scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.projectData.artifacts.push(artifactA,artifactB);"),
("p.projectData.releaseRecords.push(record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-TEST'));\n  const result=engine.verifyArtifactIdentity(p,[{artifactId:'A',name:'x.bin',size:3,sha256:'aaa'}],[{artifactId:'A',name:'x.bin',size:4,sha256:'bbb'}]);",
 "p.stages[27].status='COMPLETE';const releaseTest=record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-TEST');releaseTest.scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.projectData.releaseRecords.push(releaseTest);const canonicalA=record('artifacts',21,{FILENAME:'x.bin',BYTE_SIZE:3,SHA256:'aaa',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},'A');canonicalA.scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.projectData.artifacts.push(canonicalA);\n  const result=engine.verifyArtifactIdentity(p,[{artifactId:'A',name:'x.bin',size:3,sha256:'aaa'}],[{artifactId:'A',name:'x.bin',size:4,sha256:'bbb'}]);")
]
for old,new in replacements:
    if old not in s:
        raise SystemExit('Focused-proof fixture anchor missing: '+old[:80])
    s=s.replace(old,new,1)
p.write_text(s)
