from pathlib import Path

engine_path=Path('workflow-engine.js')
engine=engine_path.read_text()
old="case 10:requireAccepted();requireCount('iterations',1);requireCount('candidateFreezes',1);break;"
new="case 10:requireCount('iterations',1);requireCount('candidateFreezes',1);break;"
if old not in engine:
    raise AssertionError('Stage 10 obsolete accepted-agent gate was not found.')
engine_path.write_text(engine.replace(old,new,1))

cycle_path=Path('verify-full-cycle.mjs')
cycle=cycle_path.read_text()
old_cycle="engine.registerArtifactBytes(p,{stage:10,artifactId:'ARTIFACT-CANDIDATE',filename:'candidate.bin',mediaType:'application/octet-stream',byteSize:candidateBytes.byteLength,sha256:candidateSha});data(10,{});engine.freezeCandidate(p,{stage:10,artifactIds:['ARTIFACT-CANDIDATE'],operatorLabel:'FULL_CYCLE'});"
new_cycle="engine.registerArtifactBytes(p,{stage:10,artifactId:'ARTIFACT-CANDIDATE',filename:'candidate.bin',mediaType:'application/octet-stream',byteSize:candidateBytes.byteLength,sha256:candidateSha});engine.freezeCandidate(p,{stage:10,artifactIds:['ARTIFACT-CANDIDATE'],operatorLabel:'FULL_CYCLE'});"
if old_cycle not in cycle:
    raise AssertionError('Full-cycle Stage 10 empty external proposal was not found.')
cycle_path.write_text(cycle.replace(old_cycle,new_cycle,1))
print('Stage 10 completion is now driven by the human-selected, application-frozen candidate rather than an impossible empty external-agent proposal.')
