from pathlib import Path


def r(p): return Path(p).read_text()
def w(p,t): Path(p).write_text(t)
def req(c,m):
    if not c: raise SystemExit(m)

# schema ownership
p='workflow-schema.js'; t=r(p)
old='''      "EXECUTABLE_KIND",\n      "EXECUTABLE_SPEC_VERSION",\n      "EXECUTABLE_SPEC",\n      "EXECUTABLE_INPUT_BINDINGS"\n    ],\n    "application": [\n      "TEST_ID",\n      "REQ_ID",\n      "STATUS"\n    ]'''
new='''      "EXECUTABLE_KIND",\n      "EXECUTABLE_SPEC",\n      "EXECUTABLE_INPUT_BINDINGS"\n    ],\n    "application": [\n      "TEST_ID",\n      "REQ_ID",\n      "STATUS",\n      "EXECUTABLE_SPEC_VERSION",\n      "EXECUTABLE_SPEC_SHA256"\n    ]'''
if old in t: t=t.replace(old,new,1)
req('"EXECUTABLE_SPEC_SHA256"' in t,'schema ownership patch failed'); w(p,t)

# engine durable snapshots
p='workflow-engine.js'; t=r(p)
if "'intakeArtifactSnapshots'" not in t:
    a="  'history','newJobResets','reviews','recoveredProjects','responseDispositions','executionFailures'"
    req(a in t,'infra anchor missing'); t=t.replace(a,a[:-1]+",'intakeArtifactSnapshots'",1)
old="""  for(const artifact of records(project,'artifacts',{active:true}).filter(a=>String(recordValue(a,'ROLE')||recordValue(a,'role')||'').toUpperCase().includes('INPUT')||String(recordValue(a,'ROLE')||recordValue(a,'role')||'').toUpperCase().includes('INTENT'))){
    const artifactId=recordId(artifact,'artifacts'),value={artifactId,filename:recordValue(artifact,'FILENAME')||recordValue(artifact,'filename')||'',sha256:recordValue(artifact,'SHA256')||recordValue(artifact,'sha256')||'',availability:recordValue(artifact,'AVAILABILITY')||recordValue(artifact,'availability')||''},sourceLocation='artifact.'+artifactId,rawValueHash=hash.sha256Value(value);
    units.push({inputUnitId:manifestUnitId('INPUT-UNIT',{inputVersion,sourceLocation,rawValueHash}),sourceLocation,rawValueHash,value});
  }
  return {schema:'closed-loop-intake-manifest/1'"""
new="""  for(const snapshot of safe(project.projectData.intakeArtifactSnapshots).filter(x=>!x.invalidatedBy&&String(x.inputVersion||inputVersion)===inputVersion)){
    for(const unit of safe(snapshot.units)){const sourceLocation=String(unit.sourceLocation||('artifact.'+snapshot.artifactId)),value=unit.exactText,rawValueHash=String(unit.rawValueHash||hash.sha256Value(value));units.push({inputUnitId:manifestUnitId('INPUT-UNIT',{inputVersion,sourceLocation,rawValueHash}),sourceLocation,rawValueHash,value,artifactId:String(snapshot.artifactId||''),artifactSha256:String(snapshot.artifactSha256||''),capturedFromBytes:true});}
  }
  for(const artifact of records(project,'artifacts',{active:true}).filter(a=>String(recordValue(a,'ROLE')||recordValue(a,'role')||'').toUpperCase().includes('INPUT')||String(recordValue(a,'ROLE')||recordValue(a,'role')||'').toUpperCase().includes('INTENT'))){
    const artifactId=recordId(artifact,'artifacts');if(safe(project.projectData.intakeArtifactSnapshots).some(x=>String(x.artifactId)===artifactId&&!x.invalidatedBy))continue;const value={artifactId,filename:recordValue(artifact,'FILENAME')||recordValue(artifact,'filename')||'',sha256:recordValue(artifact,'SHA256')||recordValue(artifact,'sha256')||'',availability:recordValue(artifact,'AVAILABILITY')||recordValue(artifact,'availability')||''},sourceLocation='artifact.'+artifactId,rawValueHash=hash.sha256Value(value);
    units.push({inputUnitId:manifestUnitId('INPUT-UNIT',{inputVersion,sourceLocation,rawValueHash}),sourceLocation,rawValueHash,value});
  }
  return {schema:'closed-loop-intake-manifest/1'"""
if old in t: t=t.replace(old,new,1)
req('capturedFromBytes:true' in t,'manifest byte capture patch failed')
if 'function registerIntakeArtifactSnapshot(project' not in t:
    a="function registerArtifactBytes(project,{stage=project.activeStage,artifactId,filename,mediaType,byteSize,sha256,lineage={},role='STAGE_ARTIFACT'}={}){"
    req(a in t,'registerArtifactBytes anchor missing')
    h="""function registerIntakeArtifactSnapshot(project,{artifactId,artifactSha256,filename,mediaType,text}={}){
  ensureShape(project);const id=String(artifactId||''),sha=String(artifactSha256||'').toLowerCase(),exact=String(text??'');if(!id||!/^[a-f0-9]{64}$/.test(sha))throw new Error('Verified Stage 01 artifact identity is required before capturing intent text.');const artifact=records(project,'artifacts').find(x=>recordId(x,'artifacts')===id&&String(recordValue(x,'SHA256')||'').toLowerCase()===sha);if(!artifact)throw new Error('Stage 01 intent snapshot must bind to current verified canonical artifact bytes.');const existing=safe(project.projectData.intakeArtifactSnapshots).find(x=>String(x.artifactId)===id&&!x.invalidatedBy);if(existing){if(String(existing.artifactSha256)!==sha||String(existing.fullTextSha256)!==hash.sha256Value(exact))throw new Error('A captured intent artifact cannot be rebound to different content.');return existing;}const units=[];for(const [index,exactText] of exact.replace(/\\r\\n?/g,'\\n').split('\\n').entries()){if(!exactText.trim())continue;units.push({sourceLocation:`artifact.${id}:line:${index+1}`,lineNumber:index+1,exactText,rawValueHash:hash.sha256Value(exactText)});}const snapshot={snapshotId:allocateInfrastructureId(project,'INTAKE-SNAPSHOT','intakeArtifactSnapshots'),artifactId:id,artifactSha256:sha,filename:String(filename||recordValue(artifact,'FILENAME')||id),mediaType:String(mediaType||recordValue(artifact,'TYPE')||'text/plain'),inputVersion:String(project.job.CURRENT_INPUT_VERSION||'UNVERSIONED'),fullTextSha256:hash.sha256Value(exact),unitCount:units.length,units,createdAt:now(),active:true};project.projectData.intakeArtifactSnapshots.push(snapshot);addHistory(project,'INTAKE_ARTIFACT_CAPTURED',{snapshotId:snapshot.snapshotId,artifactId:id,artifactSha256:sha,inputVersion:snapshot.inputVersion,unitCount:units.length,fullTextSha256:snapshot.fullTextSha256});recalculate(project);return snapshot;
}
"""
    t=t.replace(a,h+a,1)
if 'registerIntakeArtifactSnapshot,' not in t:
    a='reserveRunBatch,registerArtifactBytes,'
    req(a in t,'engine export anchor missing'); t=t.replace(a,'reserveRunBatch,registerIntakeArtifactSnapshot,registerArtifactBytes,',1)
req('function registerIntakeArtifactSnapshot(project' in t and 'registerIntakeArtifactSnapshot,registerArtifactBytes' in t,'snapshot command/export failed'); w(p,t)

# app first-capture path and Stage 04 wording
p='app-core.js'; t=r(p)
old="""async function storeArtifactFile(file,stage=current.activeStage,lineage={}){const artifactId=artifactIdFor(),filename=logicalFilePath(file),blob=file.slice(0,file.size,file.type||'application/octet-stream'),stored=await projectStore.putArtifact({artifactId,jobId:current.job.JOB_ID,blob,filename,mediaType:file.type||'application/octet-stream',lineage:{stage,role:core.STAGES[stage-1]?.role||'UNKNOWN',logicalPath:filename,...lineage}});return {stored,view:{artifactId,name:stored.filename,type:stored.mediaType,size:stored.byteSize,sha256:stored.sha256,stage:`STAGE ${String(stage).padStart(2,'0')}`,role:core.STAGES[stage-1]?.role||'UNKNOWN',retainedBytes:true,availability:'IndexedDB Blob bytes persisted and rehashed on read-back.',addedAt:new Date().toISOString()}};}"""
new="""async function storeArtifactFile(file,stage=current.activeStage,lineage={}){const artifactId=artifactIdFor(),filename=logicalFilePath(file),blob=file.slice(0,file.size,file.type||'application/octet-stream'),stored=await projectStore.putArtifact({artifactId,jobId:current.job.JOB_ID,blob,filename,mediaType:file.type||'application/octet-stream',lineage:{stage,role:core.STAGES[stage-1]?.role||'UNKNOWN',logicalPath:filename,...lineage}});let intakeText=null;if(Number(stage)===1){const textual=/^(text\\/|application\\/(json|xml|csv)(?:$|;))/i.test(String(file.type||''))||/\\.(txt|md|json|csv|xml|yaml|yml|log)$/i.test(filename);if(textual){intakeText=new TextDecoder('utf-8',{fatal:true}).decode(await blob.arrayBuffer());}}return {stored,intakeText,view:{artifactId,name:stored.filename,type:stored.mediaType,size:stored.byteSize,sha256:stored.sha256,stage:`STAGE ${String(stage).padStart(2,'0')}`,role:core.STAGES[stage-1]?.role||'UNKNOWN',retainedBytes:true,availability:'IndexedDB Blob bytes persisted and rehashed on read-back.',addedAt:new Date().toISOString()}};}"""
if old in t: t=t.replace(old,new,1)
req("new TextDecoder('utf-8',{fatal:true})" in t,'app decode patch failed')
old="for(const item of created){const stored=item.stored;engine.registerArtifactBytes(next,{stage,artifactId:stored.artifactId,filename:stored.filename,mediaType:stored.mediaType,byteSize:stored.byteSize,sha256:stored.sha256,lineage:stored.lineage});next.stages[stage].authorizedFiles.push(item.view);}await persistReplacement(next);"
new="for(const item of created){const stored=item.stored;engine.registerArtifactBytes(next,{stage,artifactId:stored.artifactId,filename:stored.filename,mediaType:stored.mediaType,byteSize:stored.byteSize,sha256:stored.sha256,lineage:stored.lineage,role:Number(stage)===1?'INPUT_INTENT_ARTIFACT':'STAGE_ARTIFACT'});if(Number(stage)===1&&item.intakeText!==null)engine.registerIntakeArtifactSnapshot(next,{artifactId:stored.artifactId,artifactSha256:stored.sha256,filename:stored.filename,mediaType:stored.mediaType,text:item.intakeText});next.stages[stage].authorizedFiles.push(item.view);}await persistReplacement(next);"
if old in t: t=t.replace(old,new,1)
req("role:Number(stage)===1?'INPUT_INTENT_ARTIFACT':'STAGE_ARTIFACT'" in t,'app register snapshot patch failed')
wrong="4:'The agent compiles the requirement specification from current human input, actually accessible supplied materials, and accepted external-source research. Keep the work in the external conversation that has the original material; no duplicate upload into this application is required.'"
right="4:'The agent compiles the requirement specification from the complete application-captured User Job Input, accepted Stage 01 job definition, accessible supplied-material obligations, and accepted Stage 03 research already carried in the current instruction. Do not reattach, resend, retype, restate, reconstruct, or summarize project information already captured. If prior-stage accounting is incomplete, return to the responsible earlier stage; never make the user supply the same information again.'"
if wrong in t: t=t.replace(wrong,right,1)
req('Do not reattach, resend, retype, restate, reconstruct, or summarize project information already captured.' in t,'Stage 04 wording patch failed'); w(p,t)

# regression and CI
p='verify-intent-capture.mjs'; t=r(p)
a="a(p.includes('APPLICATION INTAKE COVERAGE MANIFEST — ACCOUNT FOR EVERY ID'),'Stage 01 manifest absent');\n"
ins="""a(e.includes('function registerIntakeArtifactSnapshot(project'),'Stage 01 byte-content snapshot command missing');
a(e.includes("'intakeArtifactSnapshots'"),'durable intake artifact snapshot storage missing');
a(app.includes("new TextDecoder('utf-8',{fatal:true})"),'Stage 01 does not decode textual intent bytes exactly once');
a(app.includes("role:Number(stage)===1?'INPUT_INTENT_ARTIFACT':'STAGE_ARTIFACT'"),'Stage 01 intent artifact role is not preserved');
a(app.includes('Do not reattach, resend, retype, restate, reconstruct, or summarize project information already captured.'),'Stage 04 operator text does not enforce capture-once reuse');
a(s.includes('"EXECUTABLE_SPEC_VERSION",\\n      "EXECUTABLE_SPEC_SHA256"'),'Test IR version/hash are not application-owned');
"""
if ins.splitlines()[0] not in t: req(a in t,'regression anchor missing'); t=t.replace(a,ins+a,1)
w(p,t)
p='.github/workflows/pages.yml'; t=r(p)
if 'node verify-intent-capture.mjs' not in t:
    a='      - name: Verify generic deterministic Test IR runtime\n'; req(a in t,'pages anchor missing'); t=t.replace(a,"      - name: Verify exhaustive one-time intent capture and Stage 04 reuse\n        run: node verify-intent-capture.mjs\n"+a,1)
w(p,t)
print('capture-once v2 materialized')
