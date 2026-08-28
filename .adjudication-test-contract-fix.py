from pathlib import Path

p=Path('verify-complete.mjs')
s=p.read_text()
start='// Exact unchanged-confirmed candidate artifact identity controls Stage 20 baseline bytes.\n'
end='// Current-boundary regressions.\n'
i=s.find(start); j=s.find(end,i)
if i<0 or j<0: raise RuntimeError('Stage 20 regression block anchors missing')
replacement="""// Exact unchanged-confirmed candidate artifact identity is a pure application fact;
// baseline mutation separately requires application-established Stage 19 confirmation.
{
  const p=project('JOB-BASELINE-EXACT-CANDIDATE');
  const shaA='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',shaB='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const a=record('artifacts',17,{FILENAME:'confirmed.bin',TYPE:'application/octet-stream',BYTE_SIZE:10,SHA256:shaA,STORAGE_REFERENCE:'indexeddb:ARTIFACT-CONFIRMED',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},'ARTIFACT-CONFIRMED');
  const b=record('artifacts',20,{FILENAME:'different.bin',TYPE:'application/octet-stream',BYTE_SIZE:10,SHA256:shaB,STORAGE_REFERENCE:'indexeddb:ARTIFACT-DIFFERENT',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},'ARTIFACT-DIFFERENT');
  p.projectData.artifacts.push(a,b);
  const candidate=record('candidateFreezes',17,{ITERATION_ID:'ITERATION-CORRECTED',COMPONENT_MANIFEST:[{artifactId:'ARTIFACT-CONFIRMED',filename:'confirmed.bin',byteSize:10,sha256:shaA,storageReference:'indexeddb:ARTIFACT-CONFIRMED'}],COMPONENT_HASHES:{'ARTIFACT-CONFIRMED':shaA},STATUS:'FROZEN'},'CANDIDATE-CONFIRMED');
  p.projectData.candidateFreezes.push(candidate);
  const iteration=record('iterations',19,{CANDIDATE_ID:'CANDIDATE-CONFIRMED',PURPOSE:'UNCHANGED_CONFIRMATION',STATUS:'FROZEN'},'ITERATION-CONFIRM');
  p.projectData.iterations.push(iteration);p.job.CURRENT_ITERATION='ITERATION-CONFIRM';
  const scope={...engine.currentScope(p),iterationId:'ITERATION-CONFIRM',candidateId:'CANDIDATE-CONFIRMED'};candidate.scope={...scope,iterationId:'ITERATION-CORRECTED'};iteration.scope=scope;a.scope=scope;b.scope=scope;
  const confirmation=record('confirmationRecords',19,{ITERATION_ID:'ITERATION-CONFIRM',CANDIDATE_ID:'CANDIDATE-CONFIRMED',DETERMINATION:'SATISFIED'},'CONFIRM-EXACT-CANDIDATE');confirmation.scope=scope;p.projectData.confirmationRecords.push(confirmation);
  let rejected=false;try{engine.validateBaselineCandidateArtifacts(p,{artifactIds:['ARTIFACT-DIFFERENT']});}catch(error){rejected=/exact artifact set/i.test(String(error.message));}
  assert(rejected,'Stage 20 exact-candidate validator accepted a different artifact set.');
  const selection=engine.validateBaselineCandidateArtifacts(p);assert(JSON.stringify(selection.candidateArtifactIds)===JSON.stringify(['ARTIFACT-CONFIRMED']),'Stage 20 did not derive exact artifacts from the unchanged-confirmation candidate manifest.');
  let claimBlocked=false;try{engine.freezeBaseline(p,{operatorLabel:'VERIFY'});}catch(error){claimBlocked=/application-established successful unchanged confirmation/i.test(String(error.message));}
  assert(claimBlocked,'Stage 20 accepted an externally asserted unchanged-confirmation conclusion.');
}


"""
s=s[:i]+replacement+s[j:]
p.write_text(s)
