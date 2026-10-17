import assert from 'node:assert/strict';

// Only the existing file-pressure VM uses these I/O substitutions. Export,
// canonical encoding, actual byte hashing and the final CAS owner stay intact.
export function exportFixtureStoreSource(source){
 const replace=(pattern,replacement,label)=>{const matches=source.match(new RegExp(pattern.source,'g'));assert.equal(matches?.length,1,'EXPORT_FIXTURE_IO_ANCHOR '+label);source=source.replace(pattern,replacement);};
 replace(/const request=req=>[^\n]+/,'const request=req=>Promise.resolve(req.result);','request');
 replace(/const complete=tx=>[^\n]+/,'const complete=tx=>tx.finished;','completion');
 replace(/async function openTransaction\([\s\S]*?\n}\n/,'async function openTransaction(stores,mode="readonly"){return openStorageTransaction(stores,mode);}\n','openTransaction');
 return source;
}

export function installExportFixtureStorage(runtime){
 const project=runtime.fixtureProject,jobId=String(project.job.JOB_ID),copy=runtime.structuredClone;
 assert.equal(project.revision,0,'EXPORT_FIXTURE_CANONICAL_REVISION_ORACLE');
 const rows=new Map([['projects',new Map([[jobId,{jobId,project:copy(project),revision:0,projectSha256:runtime.closedLoopProjectStore.projectSha256(project)}]])],['artifacts',new Map()],['meta',new Map()]]);
 const control={rows,transactions:[],beforeOpen:null,failPut:null};
 runtime.openStorageTransaction=async(names,mode)=>{
  const stores=Array.isArray(names)?names:[names];control.beforeOpen?.(stores,mode);
  const pending=new Map(stores.map(name=>[name,new Map([...rows.get(name)].map(([key,value])=>[key,copy(value)]))]));
  let aborted=false,resolve,reject;const finished=new Promise((yes,no)=>{resolve=yes;reject=no;});finished.catch(()=>{});
  const record={stores:[...stores],mode,gets:[],puts:[],completed:false,aborted:false};control.transactions.push(record);
  const tx={finished,objectStore(name){return {get(key){record.gets.push({name,key});return {result:copy(pending.get(name).get(key))};},put(row){record.puts.push({name,key:row.key||row.jobId||row.artifactId});if(control.failPut?.(name,row))throw Object.assign(new Error('Controlled export fixture write failure'),{code:'CONTROLLED_EXPORT_WRITE_FAILURE'});pending.get(name).set(name==='projects'?row.jobId:name==='artifacts'?row.artifactId:row.key,copy(row));}};},abort(){aborted=true;record.aborted=true;}};
  // The export owner requests completion before its reads. Commit staged
  // writes at the end of that turn, instead of eagerly publishing on complete().
  setTimeout(()=>{if(aborted){reject(Object.assign(new Error('Controlled fixture transaction aborted'),{code:'CONTROLLED_TRANSACTION_ABORT'}));return;}if(mode==='readwrite')for(const [name,data]of pending)rows.set(name,data);record.completed=true;resolve();},0);
  return tx;
 };
 return control;
}

export async function verifyExportFixtureFailures(runtime,control){
 const store=runtime.closedLoopProjectStore,jobId=runtime.fixtureProject.job.JOB_ID,empty=runtime.fixtureArtifacts[0],badSha=empty.sha256;
 // The owning fixture already deliberately corrupted this empty member.
 // Restore its independently known SHA only for the final-transaction controls.
 empty.sha256='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
 const initialRow=runtime.structuredClone(control.rows.get('projects').get(jobId)),cases=[];
 try{
  const valid=control.transactions.at(-1);assert.ok(valid?.completed&&valid.mode==='readwrite','EXPORT_FIXTURE_ACTUAL_COMPLETE_ORACLE');assert.ok(valid.gets.some(x=>x.name==='projects'&&x.key===jobId)&&valid.gets.some(x=>x.name==='meta'&&x.key==='recovery:'+jobId),'EXPORT_FIXTURE_FRESH_FINAL_ROWS_ORACLE');assert.equal(valid.puts.length,2,'EXPORT_FIXTURE_BOTH_EXPORT_MARKERS_ORACLE');cases.push({name:'valid-final-cas-and-completed-marker-transaction',status:'PASS'});
  for(const kind of['project-revision','history-generation','second-marker-write']){
   let expectedState;
   const state=()=>JSON.stringify([...control.rows].map(([name,rows])=>[name,[...rows]]));
   control.beforeOpen=(_names,mode)=>{if(mode!=='readwrite')return;if(kind==='project-revision'){const row=control.rows.get('projects').get(jobId);row.revision=1;row.project.revision=1;}if(kind==='history-generation')control.rows.get('meta').set('recovery:'+jobId,{key:'recovery:'+jobId,value:{generation:1}});expectedState=state();};
   control.failPut=(name,row)=>kind==='second-marker-write'&&name==='meta'&&row.key==='lastVerifiedExport:'+jobId;
   await assert.rejects(()=>store.exportPackage(jobId),error=>error.code===(kind==='second-marker-write'?'CONTROLLED_EXPORT_WRITE_FAILURE':'STALE_PROJECT_REVISION'),'EXPORT_FIXTURE_INTENDED_FAILURE_ORACLE '+kind);
   assert.equal(state(),expectedState,'EXPORT_FIXTURE_EXACT_LAST_VALID_STATE_ORACLE');assert.equal(control.transactions.at(-1).aborted,true,'EXPORT_FIXTURE_ABORT_BEFORE_PUBLICATION_ORACLE');
   if(kind==='project-revision')assert.equal(control.rows.get('projects').get(jobId).revision,1,'EXPORT_FIXTURE_CONCURRENT_PROJECT_PRESERVED_ORACLE');if(kind==='history-generation')assert.equal(control.rows.get('meta').get('recovery:'+jobId).value.generation,1,'EXPORT_FIXTURE_CONCURRENT_HISTORY_PRESERVED_ORACLE');
   cases.push({name:kind,status:'PASS'});control.rows.get('projects').set(jobId,runtime.structuredClone(initialRow));control.rows.get('meta').delete('recovery:'+jobId);control.beforeOpen=null;control.failPut=null;
  }
 }finally{control.beforeOpen=null;control.failPut=null;empty.sha256=badSha;}
 return {scope:'Map transaction adapter only; original actual export/hash/compression/CAS functions, not native IndexedDB lifetime proof',cases};
}
