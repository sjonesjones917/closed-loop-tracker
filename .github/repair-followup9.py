from pathlib import Path

path = Path('verify-full-cycle.mjs')
text = path.read_text()
old = "engine.registerArtifactBytes(p,{stage:10,artifactId:'ARTIFACT-CANDIDATE',filename:'candidate.bin',mediaType:'application/octet-stream',byteSize:candidateBytes.byteLength,sha256:candidateSha});data(10,{stageData:{HASHES_RECORDED_WHERE_PRACTICAL:'TRUE',CHANGES_ALLOWED_DURING_BATCH:'NONE'}});engine.freezeCandidate(p,{stage:10,artifactIds:['ARTIFACT-CANDIDATE'],operatorLabel:'FULL_CYCLE'});"
new = "engine.registerArtifactBytes(p,{stage:10,artifactId:'ARTIFACT-CANDIDATE',filename:'candidate.bin',mediaType:'application/octet-stream',byteSize:candidateBytes.byteLength,sha256:candidateSha});data(10,{});engine.freezeCandidate(p,{stage:10,artifactIds:['ARTIFACT-CANDIDATE'],operatorLabel:'FULL_CYCLE'});"
if old not in text:
    raise AssertionError('Full-cycle Stage 10 application-owned fixture writes were not found.')
path.write_text(text.replace(old,new,1))
print('Full-cycle Stage 10 no longer submits application-owned freeze/hash fields through external response ingestion.')
