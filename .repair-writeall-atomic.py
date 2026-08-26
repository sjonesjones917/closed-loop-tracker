from pathlib import Path

p=Path('project-store.js')
s=p.read_text()
old="""async function writeAllIndexed(projects){if(!Array.isArray(projects))throw new TypeError('Project storage payload must be an array.');const saved=[];for(const project of projects){const id=projectIdentity(project);if(!id)continue;const db=await openDatabase(),tx=db.transaction(PROJECTS,'readonly'),prior=await request(tx.objectStore(PROJECTS).get(id));await complete(tx);const incoming=clone(project);delete incoming.projectSha256;const digest=projectSha256(incoming);if(prior?.projectSha256===digest){incoming.revision=Number(prior.revision||0);incoming.projectSha256=digest;saved.push(incoming);}else saved.push(await writeProject(incoming,{expectedProjectRevision:Number(prior?.revision||0),incrementRevision:Boolean(prior)}));}return saved;}"""
new="""async function writeAllIndexed(projects){
  if(!Array.isArray(projects))throw new TypeError('Project storage payload must be an array.');
  const db=await openDatabase(),tx=db.transaction([PROJECTS,META],'readwrite'),store=tx.objectStore(PROJECTS),meta=tx.objectStore(META),prepared=[],seen=new Set();
  try{
    for(const project of projects){
      const id=projectIdentity(project);if(!id)continue;if(seen.has(id))throw storageError(`Project storage payload contains duplicate JOB_ID ${id}.`,'DUPLICATE_PROJECT_ID');seen.add(id);
      const incoming=clone(project),suppliedRevision=Number(incoming.revision||0);delete incoming.projectSha256;const prior=await request(store.get(id)),currentRevision=Number(prior?.revision||0),incomingDigest=projectSha256(incoming);
      if(prior?.projectSha256===incomingDigest){incoming.revision=currentRevision;incoming.projectSha256=incomingDigest;prepared.push({id,project:incoming,changed:false});continue;}
      if(prior&&suppliedRevision!==currentRevision){const e=new Error(`Project revision conflict for ${id}: expected ${suppliedRevision}, found ${currentRevision}.`);e.code='STALE_PROJECT_REVISION';throw e;}
      if(!prior&&suppliedRevision!==0){const e=new Error(`Project revision conflict for ${id}: incoming revision ${suppliedRevision} has no stored project.`);e.code='STALE_PROJECT_REVISION';throw e;}
      incoming.revision=prior?currentRevision+1:0;const digest=projectSha256(incoming);prepared.push({id,project:incoming,digest,changed:true});
    }
    const changed=prepared.filter(item=>item.changed);for(const item of changed){fault('during-project-write');store.put({jobId:item.id,revision:item.project.revision,project:item.project,projectSha256:item.digest,updatedAt:now()});item.project.projectSha256=item.digest;meta.put({key:'lastCommittedRevision',value:{jobId:item.id,revision:item.project.revision,projectSha256:item.digest},updatedAt:now()});}
    if(prepared[0])meta.put({key:'selectedProject',value:prepared[0].id,updatedAt:now()});fault('before-transaction-commit');await complete(tx);
    for(const item of changed)try{new BroadcastChannel('closed-loop-reliability').postMessage({type:'PROJECT_CHANGED',jobId:item.id,revision:item.project.revision});}catch{}
    return prepared.map(item=>item.project);
  }catch(error){try{tx.abort();}catch{}throw error;}
}"""
if old not in s: raise SystemExit('writeAllIndexed anchor missing')
p.write_text(s.replace(old,new,1))

p=Path('verify-browser-extra.mjs')
s=p.read_text()
marker="  console.log('extra:writeall-atomic-cas');"
if marker in s: raise SystemExit('writeAll regression already present')
anchor="  console.log('extra:storage-failure-rollback');\n"
insert=r'''  console.log('extra:writeall-atomic-cas');
  const writeAllAtomicCas=await evalValue(cdp,`(async()=>{const store=closedLoopProjectStore,aId='JOB-20260823144121',bId=${JSON.stringify(sharedJob)};let all=await store.readAll(),a=structuredClone(all.find(x=>x.job?.JOB_ID===aId)),staleB=structuredClone(all.find(x=>x.job?.JOB_ID===bId));if(!a||!staleB)return {missing:true};const aRevision=a.revision,bAdvanced=structuredClone(staleB);bAdvanced.writeAllCasMarker='ADVANCED';await store.writeProject(bAdvanced,{expectedProjectRevision:staleB.revision});a.writeAllAtomicMarker='MUST_NOT_COMMIT';staleB.writeAllCasMarker='STALE_OVERWRITE';let code='';try{await store.writeAll([a,staleB]);}catch(e){code=e.code||e.message||'';}all=await store.readAll();const aAfter=all.find(x=>x.job?.JOB_ID===aId),bAfter=all.find(x=>x.job?.JOB_ID===bId);return {missing:false,code,aRevisionSame:aAfter.revision===aRevision,aMarkerAbsent:aAfter.writeAllAtomicMarker===undefined,bAdvancedPreserved:bAfter.writeAllCasMarker==='ADVANCED'};})()`);
  assert(!writeAllAtomicCas?.missing&&writeAllAtomicCas.code==='STALE_PROJECT_REVISION'&&writeAllAtomicCas.aRevisionSame&&writeAllAtomicCas.aMarkerAbsent&&writeAllAtomicCas.bAdvancedPreserved,'writeAll did not reject stale input atomically across the full project batch.');

'''
if anchor not in s: raise SystemExit('browser storage rollback anchor missing')
s=s.replace(anchor,insert+anchor,1)
s=s.replace('transactionMutatorLifetime:true,runtimeErrors:0','transactionMutatorLifetime:true,writeAllAtomicCas:true,runtimeErrors:0',1)
p.write_text(s)
