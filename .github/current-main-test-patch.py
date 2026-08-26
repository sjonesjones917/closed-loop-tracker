from pathlib import Path
vc=Path('verify-complete.mjs'); text=vc.read_text()
if 'stage5RequirementVersionIsolation:true' not in text:
    text += r'''

// Current-boundary regressions.
{
 const p=project('JOB-STAGE5-VERSION');p.job.CURRENT_REQUIREMENTS_VERSION='REQUIREMENTS-v001';p.projectData.requirementResolutions.push(record('requirementResolutions',5,{DEFECT_TYPE:'NONE',GOVERNING_EVIDENCE:'review',RESOLUTION:'No requirement change required.',CHANGED_REQUIREMENT_REFS:[],AFFECTED_DOWNSTREAM_WORK:'NONE',STATUS:'RESOLVED'},'RESOLUTION-STAGE5'));const result=engine.registerStageVersion(p,5,'CHANGE-STAGE5');assert(result===null&&p.job.CURRENT_REQUIREMENTS_VERSION==='REQUIREMENTS-v001','Stage 05 created a requirements version without a replacement requirement set.');
}
{
 const p=project('JOB-ITERATION-OP-SCOPE'),ops=['FREEZE','EXECUTE_RUN','VERIFY','COMPARE','ROOT_CAUSE','REGRESSION','CORRECT'];p.projectData.iterations.push(record('iterations',17,{CANDIDATE_ID:'CANDIDATE-OLD',STATUS:'FROZEN'},'ITERATION-OLD'));for(const op of ops)p.projectData.acceptedChanges.push({changeId:`CHANGE-OLD-${op}`,stage:17,status:'COMMITTED',responseType:'DATA_PROPOSAL',operation:op,scope:{iterationId:'ITERATION-OLD',candidateId:'CANDIDATE-OLD'}});const current=record('iterations',17,{CANDIDATE_ID:'CANDIDATE-NEW',STATUS:'FROZEN'},'ITERATION-NEW');current.scope={iterationId:'ITERATION-NEW',candidateId:'CANDIDATE-NEW'};p.projectData.iterations.push(current);const ev=engine.evaluateIteration(p,'ITERATION-NEW','CORRECTED');assert(ev.reasons.some(r=>/Required stage operations are missing/.test(r)),'A new Stage 17 iteration borrowed accepted operations from an older iteration.');
}
{
 const p=project('JOB-REGRESSION-SCOPE');p.job.CURRENT_ITERATION='ITERATION-NEW';const iteration=record('iterations',17,{CANDIDATE_ID:'CANDIDATE-NEW',STATUS:'FROZEN'},'ITERATION-NEW');iteration.scope={iterationId:'ITERATION-NEW',candidateId:'CANDIDATE-NEW'};p.projectData.iterations.push(iteration);const defect=record('defects',14,{SEVERITY:'CRITICAL',STATUS:'CONFIRMED'},'DEFECT-SCOPE');p.projectData.defects.push(defect);const reg=record('regressions',15,{DEFECT_ID:'DEFECT-SCOPE',ACTIVE_RETIRED_STATE:'ACTIVE'},'REG-SCOPE');p.projectData.regressions.push(reg);const old=record('regressionExecutions',17,{REG_ID:'REG-SCOPE',ITERATION_ID:'ITERATION-OLD',PHASE:'POST_CORRECTION',RESULT:'PASSED'},'REG-EXEC-OLD');old.scope={iterationId:'ITERATION-OLD',candidateId:'CANDIDATE-OLD'};p.projectData.regressionExecutions.push(old);assert(engine.unresolvedMaterialDefects(p).some(x=>engine.recordId(x,'defects')==='DEFECT-SCOPE'),'A stale regression success resolved a current material defect.');
}
{
 const p=project('JOB-IDENTITY-RECOVERY');p.projectData.releaseRecords.push(record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-IDENTITY-RECOVERY'));const audited=[{artifactId:'A',name:'a.bin',size:3,sha256:'aaa'}],bad=[{artifactId:'A',name:'a.bin',size:4,sha256:'bbb'}],good=[{artifactId:'A',name:'a.bin',size:3,sha256:'aaa'}];engine.verifyArtifactIdentity(p,audited,bad);const corrected=engine.verifyArtifactIdentity(p,audited,good);assert(engine.records(p,'artifactIdentities').length===1&&corrected.length===1&&p.release.authorization==='AUTHORIZED','A corrected Stage 28 comparison remained blocked by an older active mismatch.');const count=p.projectData.artifactIdentities.length,again=engine.verifyArtifactIdentity(p,audited,good);assert(p.projectData.artifactIdentities.length===count&&again[0].id===corrected[0].id,'Identical Stage 28 evidence created a duplicate comparison batch.');
}
console.log(JSON.stringify({stage5RequirementVersionIsolation:true,iterationOperationIsolation:true,currentRegressionClosure:true,stage28CurrentBatch:true},null,2));
'''
vc.write_text(text)
vb=Path('verify-browser-extra.mjs'); text=vb.read_text(); marker="  console.log('extra:support-controls');"
if 'extra:canonical-write-integrity' not in text:
    if marker not in text: raise SystemExit('support-controls marker missing')
    test=r'''  console.log('extra:canonical-write-integrity');
  const canonicalWrite=await evalValue(cdp,`(async()=>{const store=closedLoopProjectStore,jobId=${JSON.stringify(sharedJob)},before=(await store.readAll()).find(x=>x.job?.JOB_ID===jobId),revision=before.revision,candidate=structuredClone(before);candidate.stageCount=29;let code='';try{await store.writeProject(candidate,{expectedProjectRevision:revision});}catch(e){code=e.code||'';}const after=(await store.readAll()).find(x=>x.job?.JOB_ID===jobId);return {code,revisionSame:after.revision===revision,stageCount:after.stageCount};})()`);assert(canonicalWrite?.code==='PROJECT_INTEGRITY_FAILED'&&canonicalWrite.revisionSame&&canonicalWrite.stageCount===30,'Normal IndexedDB write accepted structurally invalid canonical state.');

'''
    text=text.replace(marker,test+marker,1)
vb.write_text(text)
