import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {projectStoreRuntime,storedArtifactBody} from './test-project-store-runtime.mjs';
import {artifactFixtureId} from './test-artifact-fixtures.mjs';

// Synthetic transaction-adapter evidence for the real storage/cache boundary.
// This does not claim an independent agent execution or browser verification.
export async function verifyPromptContextStorage({sourceOverrides={},fault=null}={}){
 const paths=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'],sources=Object.fromEntries(paths.map(path=>[path,sourceOverrides[path]??fs.readFileSync(path,'utf8')])),cases=[];
 if(fault==='omit-hydration'){
  const anchor=' await hydrateLegacyRunPromptContexts(project);';assert.equal(sources['project-store.js'].split(anchor).length,2,'PROMPT_CONTEXT_STORAGE_FAULT_ANCHOR');sources['project-store.js']=sources['project-store.js'].replace(anchor,' // Fault: omit receiving-side exact context hydration.');
 }
 if(fault==='omit-ingestion-cache-transfer'){const anchor='globalThis.closedLoopPromptEngine?.copyRetainedPromptContextFiles?.(project,copied);';assert.equal(sources['response-ingestion.js'].split(anchor).length,2,'PROMPT_CONTEXT_INGESTION_FAULT_ANCHOR');sources['response-ingestion.js']=sources['response-ingestion.js'].replace(anchor,'');}
 function cold(source){const target=projectStoreRuntime({sourceOverrides:sources});for(const [name,rows]of source.rows)target.rows.set(name,new Map([...rows].map(([key,value])=>[key,target.copy(value)])));return target;}
 function contextReads(r,{fail=false}={}){const open=r.runtime.openStorageTransaction,reads=[];r.runtime.openStorageTransaction=async(...args)=>{const tx=await open(...args),objectStore=tx.objectStore;tx.objectStore=name=>{const store=objectStore(name);if(name!=='artifacts')return store;return {...store,get:key=>{if(String(key).startsWith('PROMPT-CONTEXT-')){reads.push(key);if(fail)throw Object.assign(new Error('Synthetic exact context read failure.'),{code:'SYNTHETIC_CONTEXT_IO_FAILED'});}return store.get(key);}};};return tx;};return reads;}
 async function fixture({currentProducer=false}={}){
  const r=projectStoreRuntime({sourceOverrides:sources}),{store,engine}=r,hash=r.runtime.closedLoopHash;let project=await store.createProject({commandId:'SYNTHETIC-PROMPT-CONTEXT-STORAGE'});const storedRevision=project.revision;
  project.job.EXACT_USER_OBJECTIVE_VERBATIM='Preserve the original run context. '+('SYNTHETIC_CONTEXT_TEXT '.repeat(5000));
  const blob=new Blob(['SYNTHETIC candidate bytes']),artifactId=artifactFixtureId(engine,project,'PROMPT-CONTEXT-CANDIDATE'),stored=await store.putArtifact({artifactId,jobId:project.job.JOB_ID,blob,filename:'candidate.txt',mediaType:'text/plain'});
  engine.registerArtifactBytes(project,{stage:10,artifactId,filename:'candidate.txt',mediaType:'text/plain',byteSize:blob.size,sha256:stored.sha256});
  const decision=engine.recordRegisteredHumanDecision(project,{stage:10,purpose:'CANDIDATE_COMPONENT_SELECTION',targetFamily:'artifacts',targetId:hash.sha256Value(r.copy([artifactId])),value:[artifactId],operatorLabel:'SYNTHETIC'}),frozen=engine.freezeCandidate(project,{stage:10,artifactIds:[artifactId],selectionDecisionId:engine.recordId(decision,'humanDecisions'),operatorLabel:'SYNTHETIC'}),candidateId=engine.recordId(frozen.candidate,'candidateFreezes'),iterationId=engine.recordId(frozen.iteration,'iterations'),slots=engine.reserveRunBatch(project,{stage:11,iterationId,candidateId,count:10});
  const producerSource=sources['prompt-engine.js'],role='const runRole=independentRunContextRole(number,operation);',tag='...(independentRunContextRole(stage,operation)?{independentRunContextVersion:INDEPENDENT_RUN_CONTEXT_VERSION}:{}),',version="const INDEPENDENT_RUN_PROMPT_VERSION='closed-loop-prompt-engine/94';";
  // Only generation prerequisites are synthetic setup. The production writer
  // recalculates them before persistence; no prior-stage completion is tested.
  for(let stage=1;stage<=10;stage++){project.stages[stage].status='COMPLETE';project.stages[stage].gate=r.copy({complete:true,blocked:false,reasons:[]});}
  if(!currentProducer){for(const anchor of [role,tag,version])assert.equal(producerSource.split(anchor).length,2,'PROMPT_CONTEXT_STORAGE_LEGACY_FIXTURE_ANCHOR');vm.runInContext(producerSource.replace(role,'const runRole=null;').replace(tag,'').replace(version,"const INDEPENDENT_RUN_PROMPT_VERSION='closed-loop-prompt-engine/93';"),r.runtime,{filename:'prompt-engine.js:documented-prior-producer-equivalent'});}
  const producer=r.runtime.closedLoopPromptEngine,firstContext=engine.preparePromptContext(project,11,{operation:'EXECUTE_RUN',scope:{runId:slots[0].runId,contextId:slots[0].contextId}}),prompt=producer.reserveAndBuildPromptRecord(project,11,firstContext.options).prompt,files=producer.materializePromptContextFiles(prompt,project);
  assert(files.length>0,'PROMPT_CONTEXT_STORAGE_EXTERNALIZATION_SETUP');await store.persistPromptContextFiles(prompt,project);
  const secondContext=engine.preparePromptContext(project,11,{operation:'EXECUTE_RUN',scope:{runId:slots[1].runId,contextId:slots[1].contextId}}),second=producer.reserveAndBuildPromptRecord(project,11,secondContext.options).prompt;await store.persistPromptContextFiles(second,project);
  // Persist under the original producer, then cold-load under the corrected
  // reader. The saved manifest/body/source files are never edited to fake an epoch.
  project=await store.writeProject(project,{expectedProjectRevision:storedRevision});
  const identities=files.map(({text,...identity})=>identity),sourceText=Object.fromEntries(files.map(file=>[file.path,file.text]));
  return {r,project,promptId:prompt.instructionId,identities,sourceText};
 }
 const f=await fixture(),fresh=cold(f.r),jobId=f.project.job.JOB_ID,reads=contextReads(fresh),storedProjectBefore=JSON.stringify(fresh.rows.get('projects').get(jobId)),historyBefore=JSON.stringify(fresh.rows.get('meta').get('recovery:'+jobId)),loaded=await fresh.store.readProject(jobId),savedPrompt=loaded.projectData.generatedPrompts.find(row=>row.instructionId===f.promptId);
 assert.equal(fresh.prompts.runPromptContextIsolation(loaded,savedPrompt).determination,'CURRENT','PROMPT_CONTEXT_STORAGE_COLD_READ_ORACLE');
 const retained=fresh.prompts.materializePromptContextFiles(savedPrompt);for(const file of retained){assert.equal(file.text,f.sourceText[file.path],'PROMPT_CONTEXT_STORAGE_EXACT_BYTES_ORACLE');assert.equal(createHash('sha256').update(file.text,'utf8').digest('hex'),file.sha256);}
 assert.equal(JSON.stringify(fresh.rows.get('projects').get(jobId)),storedProjectBefore,'PROMPT_CONTEXT_STORAGE_READ_ONLY_PROJECT_ORACLE');assert.equal(JSON.stringify(fresh.rows.get('meta').get('recovery:'+jobId)),historyBefore,'PROMPT_CONTEXT_STORAGE_READ_ONLY_HISTORY_ORACLE');
 const attachments=loaded.projectData.generatedPrompts.flatMap(row=>row.contextManifest?.promptContext?.attachments||[]),uniqueContexts=new Set(attachments.map(file=>file.sha256));assert.equal(reads.length,uniqueContexts.size,'PROMPT_CONTEXT_STORAGE_READ_ONCE_PER_CONTEXT_ORACLE');
 assert.equal(fresh.prompts.runPromptContextIsolation(fresh.engine.clone(loaded),fresh.engine.clone(savedPrompt)).determination,'CURRENT','PROMPT_CONTEXT_STORAGE_ENGINE_CLONE_ORACLE');cases.push('cold-read-exact-legacy-context');
 const sourceProjectJson=JSON.stringify(loaded),captured=fresh.ingestion.captureRaw(loaded,{stage:11,text:'{',promptRecord:savedPrompt}),capturedPrompt=captured.project.projectData.generatedPrompts.find(row=>row.instructionId===f.promptId);assert.equal(fresh.prompts.runPromptContextIsolation(captured.project,capturedPrompt).determination,'CURRENT','PROMPT_CONTEXT_INGESTION_CAPTURE_CACHE_ORACLE');assert.equal(fresh.prompts.materializePromptContextFiles(capturedPrompt)[0].text,f.sourceText[f.identities[0].path],'PROMPT_CONTEXT_INGESTION_CAPTURE_BYTES_ORACLE');assert.equal(JSON.stringify(loaded),sourceProjectJson,'PROMPT_CONTEXT_INGESTION_SOURCE_UNCHANGED_ORACLE');const rejected=fresh.ingestion.prepareCaptured(captured.project,{rawResponseId:captured.rawRecord.rawResponseId,promptRecord:capturedPrompt}),rejectedPrompt=rejected.project.projectData.generatedPrompts.find(row=>row.instructionId===f.promptId);assert.equal(rejected.validation.valid,false,'PROMPT_CONTEXT_INGESTION_MALFORMED_CONTROL_ORACLE');assert.equal(rejected.rawRecord.completeRawResponse,'{','PROMPT_CONTEXT_INGESTION_RAW_PRESERVED_ORACLE');assert.equal(fresh.prompts.runPromptContextIsolation(rejected.project,rejectedPrompt).determination,'CURRENT','PROMPT_CONTEXT_INGESTION_PREPARE_CACHE_ORACLE');assert.equal(fresh.prompts.materializePromptContextFiles(rejectedPrompt)[0].text,f.sourceText[f.identities[0].path],'PROMPT_CONTEXT_INGESTION_PREPARE_BYTES_ORACLE');cases.push('ingestion-capture-and-rejected-response-preserve-exact-context');

 const first=f.identities[0],artifactId='PROMPT-CONTEXT-'+fresh.runtime.closedLoopHash.sha256Value(fresh.copy({jobId,sha256:first.sha256}));
 for(const [name,damage]of [
  ['missing',(r)=>r.rows.get('artifacts').delete(artifactId)],
  ['same-size-corrupt',(r)=>{const body=storedArtifactBody(r,artifactId);body.blob=new Blob([new Uint8Array(body.blob.size)]);}],
  ['foreign-project',(r)=>{r.rows.get('artifacts').get(artifactId).jobId='FOREIGN-SYNTHETIC-JOB';}]
 ]){
  const r=cold(f.r);damage(r);const before=JSON.stringify(r.rows.get('projects').get(jobId)),project=await r.store.readProject(jobId),prompt=project.projectData.generatedPrompts.find(row=>row.instructionId===f.promptId);
  assert.equal(r.prompts.runPromptContextIsolation(project,prompt).determination,'UNKNOWN','PROMPT_CONTEXT_STORAGE_UNAVAILABLE_ORACLE:'+name);assert.equal(JSON.stringify(r.rows.get('projects').get(jobId)),before,'PROMPT_CONTEXT_STORAGE_UNAVAILABLE_PRESERVES_PROJECT_ORACLE');cases.push(name+'-remains-unknown');
 }
 const io=cold(f.r);contextReads(io,{fail:true});await assert.rejects(io.store.readProject(jobId),error=>error.code==='SYNTHETIC_CONTEXT_IO_FAILED','PROMPT_CONTEXT_STORAGE_IO_FAILURE_ORACLE');cases.push('context-io-failure-propagates');
 const importedRuntime=projectStoreRuntime({sourceOverrides:sources}),backup=await fresh.store.exportPackage(jobId),imported=await importedRuntime.store.importPackage(backup),importedPrompt=imported.projectData.generatedPrompts.find(row=>row.instructionId===f.promptId);
 assert.equal(importedRuntime.prompts.runPromptContextIsolation(imported,importedPrompt).determination,'CURRENT','PROMPT_CONTEXT_STORAGE_IMPORT_ORACLE');assert.equal(importedRuntime.prompts.materializePromptContextFiles(importedPrompt)[0].text,f.sourceText[first.path],'PROMPT_CONTEXT_STORAGE_IMPORT_BYTES_ORACLE');cases.push('backup-import-receiving-context');
 const history=await fresh.store.historyList(jobId),restored=await fresh.store.restoreCheckpoint(jobId,history.activeId,{expectedProjectRevision:loaded.revision}),restoredPrompt=restored.project.projectData.generatedPrompts.find(row=>row.instructionId===f.promptId);
 assert.equal(fresh.prompts.runPromptContextIsolation(restored.project,restoredPrompt).determination,'CURRENT','PROMPT_CONTEXT_STORAGE_RESTORE_ORACLE');assert.equal(fresh.prompts.materializePromptContextFiles(restoredPrompt)[0].text,f.sourceText[first.path],'PROMPT_CONTEXT_STORAGE_RESTORE_BYTES_ORACLE');cases.push('history-restore-receiving-context');
 const modern=await fixture({currentProducer:true}),modernCold=cold(modern.r),modernId=modern.project.job.JOB_ID;for(const [id,row]of modernCold.rows.get('artifacts'))if(row.lineage?.kind==='PROMPT_CONTEXT')modernCold.rows.get('artifacts').delete(id);
 const modernReads=contextReads(modernCold),modernRead=await modernCold.store.readProject(modernId),modernPrompt=modernRead.projectData.generatedPrompts.find(row=>row.instructionId===modern.promptId);assert.equal(modernCold.prompts.runPromptContextIsolation(modernRead,modernPrompt).determination,'CURRENT','PROMPT_CONTEXT_STORAGE_CURRENT_PRODUCER_CONTROL');assert.equal(modernReads.length,0,'PROMPT_CONTEXT_STORAGE_CURRENT_PRODUCER_NO_READ_ORACLE');cases.push('current-producer-needs-no-legacy-read');
 return {schema:'closed-loop-prompt-context-storage/1',passed:true,synthetic:true,actualBrowser:false,generationPrerequisitesSynthetic:true,cases,sourceSha256:Object.fromEntries(Object.entries(sources).map(([path,source])=>[path,createHash('sha256').update(source).digest('hex')]))};
}
