from pathlib import Path
import re, hashlib

engine_path=Path('workflow-engine.js')
text=engine_path.read_text()
pattern=r"function freezeBaseline\(project,\{artifactIds=\[\],operatorLabel='HUMAN_OPERATOR',authorization='AUTHORIZED'\}=\{\}\)\{.*?\n\}(?=\nfunction reserveProductExecution)"
replacement="""function freezeBaseline(project,{artifactIds=[],operatorLabel='HUMAN_OPERATOR',authorization='AUTHORIZED'}={}){
  ensureShape(project);const confirmation=recordsForCurrentScope(project,'confirmationRecords').filter(r=>upper(recordValue(r,'DETERMINATION'))==='SATISFIED').at(-1);if(!confirmation)throw new Error('A current successful unchanged confirmation is required before baseline freeze.');const currentIteration=records(project,'iterations').find(r=>recordId(r,'iterations')===String(project.job.CURRENT_ITERATION||'')&&isActiveRecord(r));if(!currentIteration||Number(currentIteration.stage)!==19)throw new Error('The current unchanged-confirmation iteration is required before baseline freeze.');const currentCandidateId=iterationCandidateId(project,recordId(currentIteration,'iterations')),currentCandidate=records(project,'candidateFreezes').find(r=>recordId(r,'candidateFreezes')===currentCandidateId&&isActiveRecord(r));if(!currentCandidate||!candidateComponentIdentity(project,currentCandidateId))throw new Error('The unchanged-confirmation iteration does not resolve to an active frozen candidate.');const manifest=safe(recordValue(currentCandidate,'COMPONENT_MANIFEST')),candidateArtifactIds=manifest.map(item=>String(item?.artifactId||'')).filter(Boolean);if(!candidateArtifactIds.length||candidateArtifactIds.length!==manifest.length||new Set(candidateArtifactIds).size!==candidateArtifactIds.length)throw new Error('The confirmed candidate manifest does not contain one unique canonical artifact identity for every component.');const requested=[...new Set(safe(artifactIds).map(String))];if(requested.length&&hash.sha256Value([...requested].sort())!==hash.sha256Value([...candidateArtifactIds].sort()))throw new Error('Baseline authorization must use the exact artifact set from the unchanged-confirmed frozen candidate.');const artifacts=selectedArtifacts(project,candidateArtifactIds),byId=new Map(artifacts.map(a=>[recordId(a,'artifacts'),a]));for(const item of manifest){const artifact=byId.get(String(item.artifactId));if(!artifact||String(recordValue(artifact,'FILENAME'))!==String(item.filename)||Number(recordValue(artifact,'BYTE_SIZE'))!==Number(item.byteSize)||String(recordValue(artifact,'SHA256')).toLowerCase()!==String(item.sha256||'').toLowerCase())throw new Error(`Confirmed candidate artifact ${item.artifactId||'UNKNOWN'} no longer matches its frozen filename, byte size, and SHA-256.`);}const baselineId=allocateId(project,'baselines'),createdAt=now(),approvedVersions={inputVersion:project.job.CURRENT_INPUT_VERSION,sourceSetVersion:project.job.CURRENT_SOURCE_SET_VERSION,requirementsVersion:project.job.CURRENT_REQUIREMENTS_VERSION,testSuiteVersion:project.job.CURRENT_TEST_SUITE_VERSION,instructionVersion:project.job.CURRENT_INSTRUCTION_VERSION,iterationId:recordId(currentIteration,'iterations'),candidateId:currentCandidateId,hashes:Object.fromEntries(artifacts.map(a=>[recordId(a,'artifacts'),recordValue(a,'SHA256')]))};const fields={BASELINE_ID:baselineId,SUPPORTING_CONFIRMATION_ID:recordId(confirmation,'confirmationRecords'),APPROVED_VERSIONS:approvedVersions,IMMUTABLE_ARTIFACT_RECORDS:artifacts.map(a=>recordId(a,'artifacts')),HASHES:approvedVersions.hashes,HUMAN_AUTHORIZATION:authorization,AUTHORIZED_RECIPIENT_ROLES:'CURRENT AUTHORIZED ROLES',CONTROLLED_STORAGE:'INDEXEDDB VERIFIED BYTES',STATUS:'FROZEN',EVIDENCE:hash.sha256Value({approvedVersions,operatorLabel})};const record={id:baselineId,stage:20,createdAt,active:true,scope:{...currentScope(project),baselineId},fields,...fields,source:'APPLICATION_DERIVATION'};record.contentSha256=hash.contentRecordSha256(record,'BASELINE_ID');record.recordSha256=hash.recordSha256(record);record.sha256=record.recordSha256;project.projectData.baselines.push(record);project.job.CURRENT_BASELINE_ID=baselineId;addHistory(project,'BASELINE_FROZEN',{stage:20,baselineId,artifactIds:fields.IMMUTABLE_ARTIFACT_RECORDS,iterationId:approvedVersions.iterationId,candidateId:approvedVersions.candidateId,operatorLabel,identityAssurance:'SELF_ASSERTED'});recalculate(project);return record;
}"""
new_text,count=re.subn(pattern,replacement,text,flags=re.S)
if count!=1: raise SystemExit(f'freezeBaseline replacement count={count}')
engine_path.write_text(new_text)

verify=Path('verify-complete.mjs')
vt=verify.read_text()
marker='// Exact unchanged-confirmed candidate artifact identity controls Stage 20 baseline bytes.'
if marker not in vt:
    vt += r'''

// Exact unchanged-confirmed candidate artifact identity controls Stage 20 baseline bytes.
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
  let rejected=false;try{engine.freezeBaseline(p,{artifactIds:['ARTIFACT-DIFFERENT'],operatorLabel:'VERIFY'});}catch(error){rejected=/exact artifact set/i.test(String(error.message));}
  assert(rejected,'Stage 20 accepted a baseline artifact set different from the unchanged-confirmed candidate.');
  const baseline=engine.freezeBaseline(p,{operatorLabel:'VERIFY'});assert(JSON.stringify(engine.recordValue(baseline,'IMMUTABLE_ARTIFACT_RECORDS'))===JSON.stringify(['ARTIFACT-CONFIRMED']),'Stage 20 did not derive baseline artifacts from the unchanged-confirmed candidate manifest.');assert(engine.recordValue(baseline,'APPROVED_VERSIONS').candidateId==='CANDIDATE-CONFIRMED'&&engine.recordValue(baseline,'APPROVED_VERSIONS').iterationId==='ITERATION-CONFIRM','Stage 20 baseline lost the exact unchanged-confirmation candidate/iteration identity.');
}
'''
    verify.write_text(vt)

runtime=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def blob_sha(path):
    data=Path(path).read_bytes(); return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
manifest=''.join(f'{f}:{blob_sha(f)}\n' for f in runtime).encode()
token='runtime-'+hashlib.sha256(manifest).hexdigest()[:16]
html=Path('index.html').read_text()
html=re.sub(r'runtime-[a-f0-9]{16}',token,html)
Path('index.html').write_text(html)
print(token)
