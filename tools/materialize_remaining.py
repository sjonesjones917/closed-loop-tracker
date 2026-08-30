from pathlib import Path


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def require(condition, message):
    if not condition:
        raise SystemExit(message)


def replace_once(text, old, new, label):
    require(old in text, f"missing anchor: {label}")
    return text.replace(old, new, 1)


# This patch closes the remaining durable first-capture gap without changing the visual CSS shell.

# Test IR application authority.
t = read('workflow-schema.js')
old = '''      "EXECUTABLE_KIND",\n      "EXECUTABLE_SPEC_VERSION",\n      "EXECUTABLE_SPEC",\n      "EXECUTABLE_INPUT_BINDINGS"\n    ],\n    "application": [\n      "TEST_ID",\n      "REQ_ID",\n      "STATUS"\n    ]'''
new = '''      "EXECUTABLE_KIND",\n      "EXECUTABLE_SPEC",\n      "EXECUTABLE_INPUT_BINDINGS"\n    ],\n    "application": [\n      "TEST_ID",\n      "REQ_ID",\n      "STATUS",\n      "EXECUTABLE_SPEC_VERSION",\n      "EXECUTABLE_SPEC_SHA256"\n    ]'''
if old in t:
    t = t.replace(old, new, 1)
require('"EXECUTABLE_SPEC_VERSION"' in t and '"EXECUTABLE_SPEC_SHA256"' in t, 'Test IR application ownership not materialized')
write('workflow-schema.js', t)

# Durable Stage 01 intent-file content capture.
t = read('workflow-engine.js')
if "'intakeArtifactSnapshots'" not in t:
    anchor = "  'history','newJobResets','reviews','recoveredProjects','responseDispositions','executionFailures'"
    require(anchor in t, 'infrastructure collection anchor missing')
    t = t.replace(anchor, "  'history','newJobResets','reviews','recoveredProjects','responseDispositions','executionFailures','intakeArtifactSnapshots'", 1)

old_manifest = """  for(const artifact of records(project,'artifacts',{active:true}).filter(a=>String(recordValue(a,'ROLE')||recordValue(a,'role')||'').toUpperCase().includes('INPUT')||String(recordValue(a,'ROLE')||recordValue(a,'role')||'').toUpperCase().includes('INTENT'))){
    const artifactId=recordId(artifact,'artifacts'),value={artifactId,filename:recordValue(artifact,'FILENAME')||recordValue(artifact,'filename')||'',sha256:recordValue(artifact,'SHA256')||recordValue(artifact,'sha256')||'',availability:recordValue(artifact,'AVAILABILITY')||recordValue(artifact,'availability')||''},sourceLocation='artifact.'+artifactId,rawValueHash=hash.sha256Value(value);
    units.push({inputUnitId:manifestUnitId('INPUT-UNIT',{inputVersion,sourceLocation,rawValueHash}),sourceLocation,rawValueHash,value});
  }
  return {schema:'closed-loop-intake-manifest/1'"""
new_manifest = """  for(const snapshot of safe(project.projectData.intakeArtifactSnapshots).filter(x=>!x.invalidatedBy&&String(x.inputVersion||inputVersion)===inputVersion)){
    for(const unit of safe(snapshot.units)){const sourceLocation=String(unit.sourceLocation||('artifact.'+snapshot.artifactId)),value=unit.exactText,rawValueHash=String(unit.rawValueHash||hash.sha256Value(value));units.push({inputUnitId:manifestUnitId('INPUT-UNIT',{inputVersion,sourceLocation,rawValueHash}),sourceLocation,rawValueHash,value,artifactId:String(snapshot.artifactId||''),artifactSha256:String(snapshot.artifactSha256||''),capturedFromBytes:true});}
  }
  for(const artifact of records(project,'artifacts',{active:true}).filter(a=>String(recordValue(a,'ROLE')||recordValue(a,'role')||'').toUpperCase().includes('INPUT')||String(recordValue(a,'ROLE')||recordValue(a,'role')||'').toUpperCase().includes('INTENT'))){
    const artifactId=recordId(artifact,'artifacts');if(safe(project.projectData.intakeArtifactSnapshots).some(x=>String(x.artifactId)===artifactId&&!x.invalidatedBy))continue;const value={artifactId,filename:recordValue(artifact,'FILENAME')||recordValue(artifact,'filename')||'',sha256:recordValue(artifact,'SHA256')||recordValue(artifact,'sha256')||'',availability:recordValue(artifact,'AVAILABILITY')||recordValue(artifact,'availability')||''},sourceLocation='artifact.'+artifactId,rawValueHash=hash.sha256Value(value);
    units.push({inputUnitId:manifestUnitId('INPUT-UNIT',{inputVersion,sourceLocation,rawValueHash}),sourceLocation,rawValueHash,value});
  }
  return {schema:'closed-loop-intake-manifest/1'"""
if old_manifest in t:
    t = t.replace(old_manifest, new_manifest, 1)
require('capturedFromBytes:true' in t, 'Stage 01 manifest does not consume durable captured intent bytes')

if 'function registerIntakeArtifactSnapshot(project' not in t:
    anchor = "function registerArtifactBytes(project,{stage=project.activeStage,artifactId,filename,mediaType,byteSize,sha256,lineage={},role='STAGE_ARTIFACT'}={}){"
    require(anchor in t, 'artifact register anchor missing')
    helper = """function registerIntakeArtifactSnapshot(project,{artifactId,artifactSha256,filename,mediaType,text}={}){
  ensureShape(project);const id=String(artifactId||''),sha=String(artifactSha256||'').toLowerCase(),exact=String(text??'');if(!id||!/^[a-f0-9]{64}$/.test(sha))throw new Error('Verified Stage 01 artifact identity is required before capturing intent text.');const artifact=records(project,'artifacts').find(r=>recordId(r,'artifacts')===id&&String(recordValue(r,'SHA256')||'').toLowerCase()===sha);if(!artifact)throw new Error('Stage 01 intent snapshot must bind to current verified canonical artifact bytes.');const existing=safe(project.projectData.intakeArtifactSnapshots).find(x=>String(x.artifactId)===id&&!x.invalidatedBy);if(existing){if(String(existing.artifactSha256)!==sha||String(existing.fullTextSha256)!==hash.sha256Value(exact))throw new Error('A captured intent artifact cannot be rebound to different content.');return existing;}const lines=exact.replace(/\\r\\n?/g,'\\n').split('\\n'),units=[];for(let index=0;index<lines.length;index++){const exactText=lines[index];if(!exactText.trim())continue;units.push({sourceLocation:`artifact.${id}:line:${index+1}`,lineNumber:index+1,exactText,rawValueHash:hash.sha256Value(exactText)});}const snapshot={snapshotId:allocateInfrastructureId(project,'INTAKE-SNAPSHOT','intakeArtifactSnapshots'),artifactId:id,artifactSha256:sha,filename:String(filename||recordValue(artifact,'FILENAME')||id),mediaType:String(mediaType||recordValue(artifact,'TYPE')||'text/plain'),inputVersion:String(project.job.CURRENT_INPUT_VERSION||'UNVERSIONED'),fullTextSha256:hash.sha256Value(exact),unitCount:units.length,units,createdAt:now(),active:true};project.projectData.intakeArtifactSnapshots.push(snapshot);addHistory(project,'INTAKE_ARTIFACT_CAPTURED',{snapshotId:snapshot.snapshotId,artifactId:id,artifactSha256:sha,inputVersion:snapshot.inputVersion,unitCount:units.length,fullTextSha256:snapshot.fullTextSha256});recalculate(project);return snapshot;
}
"""
    t = t.replace(anchor, helper + anchor, 1)

if 'registerIntakeArtifactSnapshot,' not in t:
    export_anchor = 'registerFreshContext,reserveRunBatch,registerArtifactBytes,'
    require(export_anchor in t, 'engine command export anchor missing')
    t = t.replace(export_anchor, 'registerFreshContext,reserveRunBatch,registerIntakeArtifactSnapshot,registerArtifactBytes,', 1)
require('function registerIntakeArtifactSnapshot(project' in t, 'Stage 01 durable snapshot command missing')
write('workflow-engine.js', t)

# Capture textual Stage 01 artifact bytes exactly once at intake and persist them into project state.
t = read('app-core.js')
old_store = """async function storeArtifactFile(file,stage=current.activeStage,lineage={}){const artifactId=artifactIdFor(),filename=logicalFilePath(file),blob=file.slice(0,file.size,file.type||'application/octet-stream'),stored=await projectStore.putArtifact({artifactId,jobId:current.job.JOB_ID,blob,filename,mediaType:file.type||'application/octet-stream',lineage:{stage,role:core.STAGES[stage-1]?.role||'UNKNOWN',logicalPath:filename,...lineage}});return {stored,view:{artifactId,name:stored.filename,type:stored.mediaType,size:stored.byteSize,sha256:stored.sha256,stage:`STAGE ${String(stage).padStart(2,'0')}`,role:core.STAGES[stage-1]?.role||'UNKNOWN',retainedBytes:true,availability:'IndexedDB Blob bytes persisted and rehashed on read-back.',addedAt:new Date().toISOString()}};}"""
new_store = """async function storeArtifactFile(file,stage=current.activeStage,lineage={}){const artifactId=artifactIdFor(),filename=logicalFilePath(file),blob=file.slice(0,file.size,file.type||'application/octet-stream'),stored=await projectStore.putArtifact({artifactId,jobId:current.job.JOB_ID,blob,filename,mediaType:file.type||'application/octet-stream',lineage:{stage,role:core.STAGES[stage-1]?.role||'UNKNOWN',logicalPath:filename,...lineage}});let intakeText=null;if(Number(stage)===1){const textual=/^(text\\/|application\\/(json|xml|csv)(?:$|;))/i.test(String(file.type||''))||/\\.(txt|md|json|csv|xml|yaml|yml|log)$/i.test(filename);if(textual){try{intakeText=new TextDecoder('utf-8',{fatal:true}).decode(await blob.arrayBuffer());}catch(error){throw new Error(`Stage 01 intent file ${filename} is declared textual but is not valid UTF-8: ${error.message||error}`);}}}return {stored,intakeText,view:{artifactId,name:stored.filename,type:stored.mediaType,size:stored.byteSize,sha256:stored.sha256,stage:`STAGE ${String(stage).padStart(2,'0')}`,role:core.STAGES[stage-1]?.role||'UNKNOWN',retainedBytes:true,availability:'IndexedDB Blob bytes persisted and rehashed on read-back.',addedAt:new Date().toISOString()}};}"""
if old_store in t:
    t = t.replace(old_store, new_store, 1)
require("new TextDecoder('utf-8',{fatal:true})" in t, 'Stage 01 does not decode textual intent bytes')

old_loop = "for(const item of created){const stored=item.stored;engine.registerArtifactBytes(next,{stage,artifactId:stored.artifactId,filename:stored.filename,mediaType:stored.mediaType,byteSize:stored.byteSize,sha256:stored.sha256,lineage:stored.lineage});next.stages[stage].authorizedFiles.push(item.view);}await persistReplacement(next);"
new_loop = "for(const item of created){const stored=item.stored;engine.registerArtifactBytes(next,{stage,artifactId:stored.artifactId,filename:stored.filename,mediaType:stored.mediaType,byteSize:stored.byteSize,sha256:stored.sha256,lineage:stored.lineage,role:Number(stage)===1?'INPUT_INTENT_ARTIFACT':'STAGE_ARTIFACT'});if(Number(stage)===1&&item.intakeText!==null)engine.registerIntakeArtifactSnapshot(next,{artifactId:stored.artifactId,artifactSha256:stored.sha256,filename:stored.filename,mediaType:stored.mediaType,text:item.intakeText});next.stages[stage].authorizedFiles.push(item.view);}await persistReplacement(next);"
if old_loop in t:
    t = t.replace(old_loop, new_loop, 1)
require("role:Number(stage)===1?'INPUT_INTENT_ARTIFACT':'STAGE_ARTIFACT'" in t, 'Stage 01 intent artifact role/capture path missing')

# Correct Stage 04 operator explanation: the application, not an external conversation, owns captured reusable memory.
wrong = "4:'The agent compiles the requirement specification from current human input, actually accessible supplied materials, and accepted external-source research. Keep the work in the external conversation that has the original material; no duplicate upload into this application is required.'"
right = "4:'The agent compiles the requirement specification from the complete application-captured User Job Input, accepted Stage 01 job definition, accessible supplied-material obligations, and accepted Stage 03 research already carried in the current instruction. Do not reattach, resend, retype, restate, reconstruct, or summarize project information already captured. If prior-stage accounting is incomplete, return to the responsible earlier stage; never make the user supply the same information again.'"
if wrong in t:
    t = t.replace(wrong, right, 1)
require('Do not reattach, resend, retype, restate, reconstruct, or summarize project information already captured.' in t, 'Stage 04 UI still implies external-conversation memory instead of application capture')
write('app-core.js', t)

# Regression assertions.
t = read('verify-intent-capture.mjs')
anchor = "a(p.includes('APPLICATION INTAKE COVERAGE MANIFEST — ACCOUNT FOR EVERY ID'),'Stage 01 manifest absent');\n"
insert = """a(e.includes('function registerIntakeArtifactSnapshot(project'),'Stage 01 byte-content snapshot command missing');
a(e.includes("'intakeArtifactSnapshots'"),'durable intake artifact snapshot storage missing');
a(app.includes("new TextDecoder('utf-8',{fatal:true})"),'Stage 01 does not decode textual intent bytes exactly once');
a(app.includes("role:Number(stage)===1?'INPUT_INTENT_ARTIFACT':'STAGE_ARTIFACT'"),'Stage 01 intent artifact role is not preserved');
a(app.includes('Do not reattach, resend, retype, restate, reconstruct, or summarize project information already captured.'),'Stage 04 operator text does not enforce capture-once reuse');
a(s.includes('"EXECUTABLE_SPEC_VERSION",\\n      "EXECUTABLE_SPEC_SHA256"'),'Test IR version/hash are not application-owned');
"""
if insert.splitlines()[0] not in t:
    require(anchor in t, 'intent regression insertion anchor missing')
    t = t.replace(anchor, insert + anchor, 1)
write('verify-intent-capture.mjs', t)

# CI must run the capture-once regression before deployment.
t = read('.github/workflows/pages.yml')
if 'node verify-intent-capture.mjs' not in t:
    anchor = '      - name: Verify generic deterministic Test IR runtime\n'
    require(anchor in t, 'Pages test insertion anchor missing')
    t = t.replace(anchor, "      - name: Verify exhaustive one-time intent capture and Stage 04 reuse\n        run: node verify-intent-capture.mjs\n" + anchor, 1)
write('.github/workflows/pages.yml', t)

print('remaining capture-once corrections materialized')
