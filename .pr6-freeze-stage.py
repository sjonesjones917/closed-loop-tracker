from pathlib import Path
p=Path('workflow-engine.js')
s=p.read_text()
s=s.replace("function freezeCandidate(project,{artifactIds=[],operatorLabel='HUMAN_OPERATOR',purpose='TEST_CANDIDATE'", "function freezeCandidate(project,{stage=10,artifactIds=[],operatorLabel='HUMAN_OPERATOR',purpose='TEST_CANDIDATE'",1)
s=s.replace("const iteration={id:iterationId,stage:10,createdAt", "const iteration={id:iterationId,stage:Number(stage),createdAt",1)
s=s.replace("const candidate={id:candidateId,stage:10,createdAt", "const candidate={id:candidateId,stage:Number(stage),createdAt",1)
s=s.replace("addHistory(project,'CANDIDATE_FROZEN',{stage:10,iterationId,candidateId", "addHistory(project,'CANDIDATE_FROZEN',{stage:Number(stage),iterationId,candidateId",1)
p.write_text(s)
