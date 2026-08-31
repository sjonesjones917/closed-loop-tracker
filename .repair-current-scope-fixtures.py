from pathlib import Path

def reps(path,pairs):
 p=Path(path);s=p.read_text()
 for old,new,label in pairs:
  n=s.count(old)
  if n!=1:raise SystemExit(f'{label}: {n}')
  s=s.replace(old,new,1)
 p.write_text(s)
reps('verify-user-prompt-invariants.mjs',[
("p.projectData.sources=[{id:'SOURCE-000001',active:true,stage:2,fields:{TITLE:'Source sentinel'}}];","p.projectData.sources=[{id:'SOURCE-000001',active:true,stage:2,scope:{inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'},fields:{SOURCE_ID:'SOURCE-000001',TITLE:'Source sentinel'}}];",'source fixture'),
("p.projectData.research=[{id:'RESEARCH-000001',active:true,stage:3,fields:{SOURCE_ID:'SOURCE-000001',MANDATORY_STATEMENTS:'STAGE3-RESEARCH-SENTINEL mandatory detail',EXCEPTIONS:'STAGE3-EXCEPTION-SENTINEL'},relationships:{SOURCE_ID:'SOURCE-000001'}}];","p.projectData.research=[{id:'RESEARCH-000001',active:true,stage:3,scope:{inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'},fields:{RESEARCH_ID:'RESEARCH-000001',SOURCE_ID:'SOURCE-000001',MANDATORY_STATEMENTS:'STAGE3-RESEARCH-SENTINEL mandatory detail',EXCEPTIONS:'STAGE3-EXCEPTION-SENTINEL'},relationships:{SOURCE_ID:'SOURCE-000001'}}];",'research fixture'),
("p.projectData.candidateRequirements=[{id:'CANDIDATE-REQ-000001',active:true,stage:3,fields:{CANDIDATE_OBLIGATION:'STAGE3-CANDIDATE-SENTINEL external obligation',SOURCE_ID:'SOURCE-000001'},relationships:{SOURCE_ID:'SOURCE-000001'}}];","p.projectData.candidateRequirements=[{id:'CANDIDATE-REQ-000001',active:true,stage:3,scope:{inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'},fields:{CANDIDATE_REQ_ID:'CANDIDATE-REQ-000001',CANDIDATE_OBLIGATION:'STAGE3-CANDIDATE-SENTINEL external obligation',SOURCE_ID:'SOURCE-000001'},relationships:{SOURCE_ID:'SOURCE-000001'}}];",'candidate fixture')])
reps('verify-complete.mjs',[
("const p=project('JOB-ORDER');p.projectData.releaseRecords.push(record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-ORDER'));","const p=project('JOB-ORDER');const currentRelease=record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-ORDER');currentRelease.scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.projectData.releaseRecords.push(currentRelease);",'order release'),
("p.projectData.releaseRecords.push(record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-TEST'));","const acceptedRelease=record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-TEST');acceptedRelease.scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.projectData.releaseRecords.push(acceptedRelease);",'identity release'),
("const p=project('JOB-IDENTITY-RECOVERY');p.projectData.releaseRecords.push(record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-IDENTITY-RECOVERY'));","const p=project('JOB-IDENTITY-RECOVERY');const recoveryRelease=record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-IDENTITY-RECOVERY');recoveryRelease.scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.projectData.releaseRecords.push(recoveryRelease);",'recovery release')])
