import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
let storeSource=fs.readFileSync('project-store.js','utf8');if(process.argv.includes('--fault=repeat-verified-project-hash')){const anchor='if(verifiedRead)digests.set(verifiedRead.project,verifiedRead.digest);';assert(storeSource.includes(anchor));storeSource=storeSource.replace(anchor,'');}
// Test-only access to the selected physical codec, not a new persistence API.
// Remove the observation global before exercising any storage action.
const codecAnchor='globalThis.closedLoopProjectStore=Object.freeze({STORAGE_IO_TIMEOUT_MS',codecProbe='globalThis.__historyCostPhysicalFixture={read:readPhysicalStoredSource,prepare:preparePhysicalRowPut,commit:commitPhysicalRowPut};\n';
assert.equal(storeSource.split(codecAnchor).length,2,'HISTORY_PHYSICAL_CODEC_UNIQUE_ANCHOR');assert.equal(storeSource.includes('__historyCostPhysicalFixture'),false);
const observedStoreSource=storeSource.replace(codecAnchor,codecProbe+codecAnchor);assert.equal(observedStoreSource.replace(codecProbe,''),storeSource,'HISTORY_PHYSICAL_CODEC_EXACT_REVERSE');storeSource=observedStoreSource;
const r=projectStoreRuntime({sourceOverrides:{'project-store.js':storeSource},fault:{file:'project-store.js',id:'COUNT_PROJECT_HASH_PASSES',before:'const projectSha256=project=>hash.sha256Value(canonicalProject(project));',after:'const projectSha256=project=>{globalThis.projectHashPasses=(globalThis.projectHashPasses||0)+1;return hash.sha256Value(canonicalProject(project));};'}}),{core,engine,store,runtime,copy}=r,large=process.argv.includes('--large'),records=large?600:32,charactersPerRecord=large?80000:4096;
const physicalFixture=runtime.__historyCostPhysicalFixture;delete runtime.__historyCostPhysicalFixture;assert.deepEqual(Object.keys(physicalFixture),['read','prepare','commit']);assert.equal(Object.hasOwn(runtime,'__historyCostPhysicalFixture'),false);

async function corruptStoredRawText(r,codec,jobId){
 const tx=await r.runtime.openStorageTransaction(['projects','meta'],'readwrite');
 try{
  const source=await codec.read(tx,'projects',jobId,'project'),row=source.logical,oldHash=row.projectSha256,oldRevision=row.revision,oldKeys=new Set(source.records.map(entry=>entry.key));
  const expected=r.copy(row);expected.project.projectData.rawResponses[0].rawText='CORRUPTED';
  const untouchedMeta=new Map([...r.rows.get('meta')].filter(([key])=>!oldKeys.has(key))),untouchedProjects=new Map([...r.rows.get('projects')].filter(([key])=>key!==jobId));
  // Keep the original expected digest: this must be logical data corruption,
  // not damaged framing, a valid rewrite, or a forced inline representation.
  row.project.projectData.rawResponses[0].rawText='CORRUPTED';
  const prepared=await codec.prepare(tx,row,'projects','project',source);
  assert.equal(prepared.packed,source.packed,'HISTORY_CORRUPTION_PRESERVES_REPRESENTATION');
  assert.equal(prepared.root.projectSha256,oldHash);assert.equal(prepared.root.revision,oldRevision);
  assert.equal(prepared.retainedOldParts,false,'HISTORY_FIXTURE_HAS_NO_SHARED_GENERATION');
  codec.commit(tx,prepared,row);tx.commit();
  const check=await r.runtime.openStorageTransaction(['projects','meta'],'readonly');
  let installed;try{installed=await codec.read(check,'projects',jobId,'project');check.commit();}catch(error){check.abort();throw error;}
  assert.equal(installed.packed,source.packed);assert.deepEqual(installed.logical,expected,'HISTORY_EXACT_INSTALLED_LOGICAL_CORRUPTION');
  assert.deepEqual(installed.root,prepared.root,'HISTORY_EXACT_INSTALLED_PHYSICAL_ROOT');
  assert.deepEqual(installed.records.map(entry=>entry.key),prepared.parts.map(part=>part.key),'HISTORY_EXACT_INSTALLED_PART_KEYS');
  for(let index=0;index<installed.records.length;index++)assert.deepEqual(installed.records[index].row,prepared.parts[index],'HISTORY_EXACT_INSTALLED_PHYSICAL_PART');
  for(const key of oldKeys)assert.equal(r.rows.get('meta').has(key),false,'HISTORY_OLD_PROJECT_GENERATION_REMOVED');
  for(const [key,value]of untouchedMeta)assert.equal(r.rows.get('meta').get(key),value,'HISTORY_UNRELATED_META_AND_JOURNAL_UNCHANGED');
  assert.equal(r.rows.get('meta').size,untouchedMeta.size+installed.records.length);
  for(const [key,value]of untouchedProjects)assert.equal(r.rows.get('projects').get(key),value,'HISTORY_UNRELATED_PROJECT_UNCHANGED');
  assert.equal(r.rows.get('projects').size,untouchedProjects.size+1);
 }catch(error){tx.abort();throw error;}
}

let p=core.createBlankState('HISTORY-VIEW-COST');engine.ensureShape(p);p.projectData.rawResponses=copy(Array.from({length:records},(_,i)=>({rawResponseId:'PRESSURE-'+i,stage:i%core.STAGES.length+1,status:'PRESERVED',rawText:'H'.repeat(charactersPerRecord)+'é🙂TAIL-'+i})));engine.recalculate(p);p=await store.writeProject(p,{expectedProjectRevision:0});
runtime.projectHashPasses=0;const start=performance.now(),id=await store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:p.revision,view:copy({activeStage:core.STAGES.at(-1).number,activeView:'Records',drafts:{note:{value:'Unaccepted view draft'}}})}),elapsedMs=performance.now()-start,hashPasses=runtime.projectHashPasses;
assert.equal(hashPasses,0,'HISTORY_HASH_PASS_ORACLE: an already verified immutable project body was canonically rehashed '+hashPasses+' times while preparing one view checkpoint');
const restored=await store.restoreCheckpoint(p.job.JOB_ID,id,{expectedProjectRevision:p.revision});assert.deepEqual(restored.project.projectData,p.projectData);assert.equal(restored.view.drafts.note.value,'Unaccepted view draft');
// The optimization cannot trust a caller-supplied digest or conceal corruption.
await corruptStoredRawText(r,physicalFixture,p.job.JOB_ID);await assert.rejects(()=>store.saveCheckpoint(p.job.JOB_ID),error=>error.code==='PROJECT_HASH_MISMATCH');
console.log(JSON.stringify({synthetic:true,actualBrowser:false,environment:'Node production persistence with lifecycle transaction adapter and hash-pass instrumentation',workload:{records,charactersPerRecord,rawCharacters:records*charactersPerRecord},viewCheckpoint:{projectHashPasses:hashPasses,elapsedMs},cases:[{name:'A verified read prepares an immutable view checkpoint without a duplicate whole-project hash and restores exact project data',result:'PASS'},{name:'Stored-data corruption still rejects checkpoint creation instead of trusting a cached or caller-supplied digest',result:'PASS'}]},null,2));
