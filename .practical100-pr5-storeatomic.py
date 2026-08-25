from pathlib import Path
import re
p=Path('project-store.js');s=p.read_text()
old="const verified=await getArtifact(artifactId);if(!verified||verified.byteSize!==byteSize||await hash.sha256Bytes(await verified.blob.arrayBuffer())!==sha256)throw new Error('Artifact byte read-back verification failed.');return verified;"
new="const verified=await getArtifact(artifactId);if(!verified||verified.byteSize!==byteSize||await hash.sha256Bytes(await verified.blob.arrayBuffer())!==sha256){const cleanup=await openDatabase(),cleanupTx=cleanup.transaction(ARTIFACTS,'readwrite');cleanupTx.objectStore(ARTIFACTS).delete(String(artifactId));await complete(cleanupTx);throw new Error('Artifact byte read-back verification failed; the unverified artifact was removed.');}return verified;"
assert old in s
s=s.replace(old,new,1)

# Add an explicit package manifest and preserve the existing compressed JSON format.
old="const body={schema:'closed-loop-project-package/1',projectSchema:project.schema,workflow:project.workflow,responseSchema:globalThis.closedLoopWorkflowSchema?.RESPONSE_SCHEMA,project:canonicalProject(project),artifacts:artifactEntries,exportedAt:now()};"
new="const exportedProject=canonicalProject(project),packageManifest={jobId,projectSha256:projectSha256(exportedProject),artifactCount:artifactEntries.length,artifacts:artifactEntries.map(a=>({artifactId:a.artifactId,filename:a.filename,mediaType:a.mediaType,byteSize:a.byteSize,sha256:a.sha256}))},body={schema:'closed-loop-project-package/1',projectSchema:project.schema,workflow:project.workflow,responseSchema:globalThis.closedLoopWorkflowSchema?.RESPONSE_SCHEMA,project:exportedProject,artifacts:artifactEntries,packageManifest,exportedAt:now()};"
assert old in s
s=s.replace(old,new,1)

# Verify all bytes first, then activate project and artifacts in one IndexedDB transaction.
match=re.search(r"async function importPackage\(blob\)\{.*?\}\n\nasync function storageHealth",s,re.S)
assert match
replacement=r'''async function importPackage(blob){
  const compressed=new Uint8Array(await blob.arrayBuffer()),json=new TextDecoder().decode(await decompressBytes(compressed)),payload=JSON.parse(json),{packageSha256,...body}=payload;
  if(hash.sha256Value(body)!==packageSha256)throw Object.assign(new Error('Project package hash mismatch.'),{existingProjectsUnchanged:true});
  if(body.schema!=='closed-loop-project-package/1')throw Object.assign(new Error('Unsupported project package schema.'),{existingProjectsUnchanged:true});
  const schemaApi=globalThis.closedLoopWorkflowSchema,project=clone(body.project),id=projectIdentity(project);
  if(project?.schema!=='closed-loop-project/2'||project?.workflow!=='mobile-closed-loop/30'||Number(project?.stageCount)!==30||Object.keys(project?.stages||{}).length!==30)throw Object.assign(new Error('Imported project identity or stage count is invalid.'),{existingProjectsUnchanged:true});
  if(body.projectSchema!==project.schema||body.workflow!==project.workflow||body.responseSchema!==schemaApi?.RESPONSE_SCHEMA)throw Object.assign(new Error('Package schema manifest does not match the embedded project.'),{existingProjectsUnchanged:true});
  if(!id)throw Object.assign(new Error('Imported project has no JOB_ID.'),{existingProjectsUnchanged:true});
  const verifiedArtifacts=[];
  for(const a of body.artifacts||[]){const bytes=base64ToBytes(a.base64);if(bytes.byteLength!==Number(a.byteSize))throw Object.assign(new Error(`Artifact ${a.artifactId} byte size mismatch.`),{existingProjectsUnchanged:true});const digest=await hash.sha256Bytes(bytes);if(digest!==a.sha256)throw Object.assign(new Error(`Artifact ${a.artifactId} hash mismatch.`),{existingProjectsUnchanged:true});verifiedArtifacts.push({...clone(a),blob:new Blob([bytes],{type:a.mediaType||'application/octet-stream'})});}
  const manifest=body.packageManifest||{};if(manifest.jobId!==id||Number(manifest.artifactCount)!==verifiedArtifacts.length||manifest.projectSha256!==projectSha256(project))throw Object.assign(new Error('Package manifest does not reconcile with the embedded project and artifacts.'),{existingProjectsUnchanged:true});
  const manifestById=new Map((manifest.artifacts||[]).map(a=>[String(a.artifactId),a]));for(const a of verifiedArtifacts){const m=manifestById.get(String(a.artifactId));if(!m||m.sha256!==a.sha256||Number(m.byteSize)!==Number(a.byteSize)||m.filename!==a.filename)throw Object.assign(new Error(`Package manifest mismatch for artifact ${a.artifactId}.`),{existingProjectsUnchanged:true});}
  const db=await openDatabase();fault('before-import-transaction');const tx=db.transaction([PROJECTS,ARTIFACTS,META],'readwrite'),projects=tx.objectStore(PROJECTS),artifacts=tx.objectStore(ARTIFACTS),meta=tx.objectStore(META);
  try{const prior=await request(projects.get(id)),currentRevision=Number(prior?.revision||0),next=clone(project);next.revision=currentRevision+1;delete next.projectSha256;const digest=projectSha256(next);fault('during-import-project-write');projects.put({jobId:id,revision:next.revision,project:next,projectSha256:digest,updatedAt:now()});for(const a of verifiedArtifacts){fault('during-import-artifact-write');artifacts.put({artifactId:String(a.artifactId),jobId:id,blob:a.blob,filename:String(a.filename),mediaType:String(a.mediaType||'application/octet-stream'),byteSize:Number(a.byteSize),sha256:String(a.sha256),lineage:clone(a.lineage||{}),createdAt:a.createdAt||now()});}meta.put({key:'selectedProject',value:id,updatedAt:now()});meta.put({key:'lastCommittedRevision',value:{jobId:id,revision:next.revision,projectSha256:digest},updatedAt:now()});meta.put({key:'lastVerifiedImport',value:{jobId:id,packageSha256,artifactCount:verifiedArtifacts.length,at:now()},updatedAt:now()});fault('before-import-commit');await complete(tx);next.projectSha256=digest;try{new BroadcastChannel('closed-loop-reliability').postMessage({type:'PROJECT_CHANGED',jobId:id,revision:next.revision});}catch{}return next;}catch(error){try{tx.abort();}catch{}throw Object.assign(error,{existingProjectsUnchanged:true});}
}

async function storageHealth'''
s=s[:match.start()]+replacement+s[match.end():]
p.write_text(s)
