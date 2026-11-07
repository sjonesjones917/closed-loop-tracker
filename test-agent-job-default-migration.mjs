import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

// Literal Section 15 obligations. The fixture recreates the old constructor's
// four empty defaults; it does not claim that any agent supplied those values.
const fields=['EXACT_DELIVERABLE_REQUESTED','ASSUMPTIONS','UNKNOWN_INFORMATION','INPUT_SET_CONTENTS'];
const kind='LEGACY_UNACCEPTED_AGENT_JOB_DEFAULTS';
const archives=p=>(p.projectData.migrationArchives||[]).filter(row=>row.kind===kind);
const plain=value=>JSON.parse(JSON.stringify(value));
function historicalProject(r,id){
 const p=r.core.createBlankState(id);r.engine.ensureShape(p);
 for(const field of fields)p.job[field]='';
 p.unknownDefaultMigrationExtension=r.copy({exact:'Preserve unknown 📁',nested:[false,0,null]});
 r.engine.recalculate(p);return p;
}
async function seed(r,p){return r.store.writeProject(p,{expectedProjectRevision:0,createOnly:true});}
function absent(p,oracle){for(const field of fields)assert.equal(Object.hasOwn(p.job,field),false,oracle+': '+field);}
function defaults(p,oracle){for(const field of fields)assert.equal(p.job[field],'',oracle+': '+field);}
function preserved(r,old,p){
 absent(p,'AGENT_DEFAULT_MIGRATION_ABSENCE_ORACLE');
 assert.deepEqual(plain(p.unknownDefaultMigrationExtension),plain(old.unknownDefaultMigrationExtension),'AGENT_DEFAULT_MIGRATION_EXTENSION_ORACLE');
 assert.equal(archives(p).length,1,'AGENT_DEFAULT_MIGRATION_ARCHIVE_ONCE_ORACLE');
 assert.equal(archives(p)[0].operational,false);
 assert.deepEqual(plain(archives(p)[0].payload),{job:Object.fromEntries(fields.map(field=>[field,'']))},'AGENT_DEFAULT_MIGRATION_REMOVED_VALUES_ORACLE');
 assert.equal(r.engine.gate(1,p).complete,false,'AGENT_DEFAULT_MIGRATION_NO_COMPLETION_ORACLE');
 assert.equal(JSON.stringify(r.engine.stageContext(p,1)).includes(kind),false,'AGENT_DEFAULT_MIGRATION_CONTEXT_ISOLATION_ORACLE');
}
export async function verifyAgentJobDefaultMigration({sourceOverrides={}}={}){
 const files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];sourceOverrides=Object.fromEntries(files.map(file=>[file,sourceOverrides[file]??fs.readFileSync(file,'utf8')]));const sourceSha256=Object.fromEntries(files.map(file=>[file,createHash('sha256').update(sourceOverrides[file]).digest('hex')])),cases=[];
 const r=projectStoreRuntime({sourceOverrides}),old=await seed(r,historicalProject(r,'JOB-LEGACY-AGENT-DEFAULTS'));
 const originalHistory=await r.store.historyList(old.job.JOB_ID),checkpointId=originalHistory.activeId,originalCheckpoint=r.copy(r.rows.get('meta').get('recovery:'+old.job.JOB_ID+':snapshot:'+checkpointId));
 defaults(old,'AGENT_DEFAULT_MIGRATION_HISTORICAL_FIXTURE_ORACLE');
 let p=await r.store.readProject(old.job.JOB_ID);preserved(r,old,p);assert.equal(p.revision,old.revision+1);assert.equal(archives(p)[0].sourceProjectSha256,old.projectSha256,'AGENT_DEFAULT_MIGRATION_SOURCE_IDENTITY_ORACLE');
 const readAgain=await r.store.readProject(old.job.JOB_ID);assert.equal(readAgain.projectSha256,p.projectSha256);assert.equal(readAgain.revision,p.revision);assert.deepEqual(r.rows.get('meta').get('recovery:'+old.job.JOB_ID+':snapshot:'+checkpointId),originalCheckpoint,'AGENT_DEFAULT_MIGRATION_ORIGINAL_HISTORY_ORACLE');
 cases.push('stored-unaccepted-defaults-archived','repeat-read-idempotent','original-checkpoint-preserved','unknown-extension-preserved','nonoperational-archive-withheld');
 const restored=(await r.store.restoreCheckpoint(old.job.JOB_ID,checkpointId,{expectedProjectRevision:p.revision})).project;preserved(r,old,restored);assert.equal((await r.store.readProject(old.job.JOB_ID)).projectSha256,restored.projectSha256);cases.push('old-history-activation-repaired');
 const backup=await r.store.exportPackage(old.job.JOB_ID),destination=projectStoreRuntime({sourceOverrides}),imported=await destination.store.importPackage(backup);preserved(destination,old,imported);cases.push('repaired-backup-import-reload');
 // Build an old package using the same production exporter with just the
 // compatibility recognizer disabled: a documented pre-repair equivalent.
 const currentStore=sourceOverrides['project-store.js']??fs.readFileSync('project-store.js','utf8'),anchor='function unacceptedAgentJobDefaults(project){';
 assert(currentStore.includes(anchor),'AGENT_DEFAULT_MIGRATION_FAULT_ANCHOR');
 const oldRuntime=projectStoreRuntime({sourceOverrides:{...sourceOverrides,'project-store.js':currentStore.replace(anchor,anchor+'return [];')}}),oldForPackage=await seed(oldRuntime,historicalProject(oldRuntime,'JOB-LEGACY-AGENT-PACKAGE'));
 const oldBackup=await oldRuntime.store.exportPackage(oldForPackage.job.JOB_ID),incoming=projectStoreRuntime({sourceOverrides}),activated=await incoming.store.importPackage(oldBackup);preserved(incoming,oldForPackage,activated);
 const history=await incoming.store.historyList(activated.job.JOB_ID),source=Object.values(history.sourceArchives||{}).find(row=>row.parser?.identity==='closed-loop-project-package-json-reader');assert(source,'AGENT_DEFAULT_MIGRATION_IMPORT_SOURCE_ORACLE');
 const sourceFile=await incoming.store.readOriginalSourceArchive(activated.job.JOB_ID,source.sha256),exact=JSON.parse(await sourceFile.blob.text());defaults(exact,'AGENT_DEFAULT_MIGRATION_RAW_SOURCE_ORACLE');assert.deepEqual(plain(exact.unknownDefaultMigrationExtension),plain(oldForPackage.unknownDefaultMigrationExtension));
 assert.equal((await incoming.store.readProject(activated.job.JOB_ID)).projectSha256,activated.projectSha256);cases.push('old-package-activation-repaired','original-package-source-retained');
 const legacy=projectStoreRuntime({sourceOverrides}),legacyProject=historicalProject(legacy,'JOB-LEGACY-AGENT-LOCAL'),text=JSON.stringify(legacyProject),key=legacy.store.LEGACY_KEYS[0];legacy.runtime.localStorage.setItem(key,text);
 const migrated=(await legacy.store.readAll()).find(row=>row.job.JOB_ID===legacyProject.job.JOB_ID);assert(migrated);preserved(legacy,legacyProject,migrated);const originals=(await legacy.store.listArtifacts(migrated.job.JOB_ID)).filter(row=>row.lineage?.originalProjectSource);assert.equal(originals.length,1);assert.equal(Buffer.from(await originals[0].blob.arrayBuffer()).toString('utf16le'),text,'AGENT_DEFAULT_MIGRATION_LEGACY_EXACT_BYTES_ORACLE');cases.push('local-storage-source-migrated-losslessly');
 for(const mode of ['nonempty','accepted-empty','partial-signature']){
  const c=projectStoreRuntime({sourceOverrides}),candidate=historicalProject(c,'JOB-DEFAULT-CONTROL-'+mode);
  if(mode==='nonempty')candidate.job.ASSUMPTIONS='An existing substantive value.';
  if(mode==='accepted-empty'){candidate.stages[1].agentData.ASSUMPTIONS='';candidate.stages[1].acceptedData.ASSUMPTIONS='';c.engine.addHistory(candidate,'CANONICAL_RESPONSE_COMMITTED',{stage:1,rawResponseId:'SYNTHETIC-RETAINED-ACCEPTANCE'});}
  if(mode==='partial-signature')delete candidate.job.UNKNOWN_INFORMATION;
  const saved=await seed(c,candidate),read=await c.store.readProject(saved.job.JOB_ID);assert.deepEqual(plain(read.job),plain(saved.job),'AGENT_DEFAULT_MIGRATION_AUTHORITY_PRESERVED_ORACLE: '+mode);assert.equal(archives(read).length,0);assert.equal(read.revision,saved.revision);cases.push(mode+'-preserved');
 }
 const failure=projectStoreRuntime({sourceOverrides}),before=await seed(failure,historicalProject(failure,'JOB-DEFAULT-ATOMIC')),snapshot=[...failure.rows].map(([name,rows])=>[name,[...rows]]);failure.runtime.__closedLoopStorageFault='before-transaction-commit';await assert.rejects(failure.store.readProject(before.job.JOB_ID),error=>error.code==='INJECTED_STORAGE_FAILURE','AGENT_DEFAULT_MIGRATION_ATOMIC_ORACLE');assert.deepEqual([...failure.rows].map(([name,rows])=>[name,[...rows]]),snapshot,'AGENT_DEFAULT_MIGRATION_ATOMIC_ORACLE');delete failure.runtime.__closedLoopStorageFault;preserved(failure,before,await failure.store.readProject(before.job.JOB_ID));cases.push('failed-migration-atomic','retry-after-storage-failure');
 const concurrent=projectStoreRuntime({sourceOverrides}),concurrentBefore=await seed(concurrent,historicalProject(concurrent,'JOB-DEFAULT-CONCURRENT')),open=concurrent.runtime.openStorageTransaction;let concurrentRow=null;
 concurrent.runtime.openStorageTransaction=async(names,mode)=>{if(mode==='readwrite'&&!concurrentRow){concurrentRow=concurrent.copy(concurrent.rows.get('projects').get(concurrentBefore.job.JOB_ID));concurrentRow.project.job.JOB_TITLE='Concurrent operator title';concurrentRow.project.revision++;concurrentRow.revision++;concurrentRow.projectSha256=concurrent.store.projectSha256(concurrentRow.project);concurrent.rows.get('projects').set(concurrentRow.jobId,concurrentRow);}return open(names,mode);};
 await assert.rejects(concurrent.store.readProject(concurrentBefore.job.JOB_ID),error=>error.code==='STALE_PROJECT_REVISION','AGENT_DEFAULT_MIGRATION_CONCURRENT_ORACLE');assert.deepEqual(concurrent.rows.get('projects').get(concurrentBefore.job.JOB_ID),concurrentRow);defaults(concurrentRow.project,'AGENT_DEFAULT_MIGRATION_CONCURRENT_ORACLE');cases.push('concurrent-newer-work-preserved');
 const corrupt=projectStoreRuntime({sourceOverrides}),corruptBefore=await seed(corrupt,historicalProject(corrupt,'JOB-DEFAULT-CORRUPT'));corrupt.rows.get('projects').get(corruptBefore.job.JOB_ID).project.job.ASSUMPTIONS='Unhashed change';await assert.rejects(corrupt.store.readProject(corruptBefore.job.JOB_ID),error=>error.code==='PROJECT_HASH_MISMATCH','AGENT_DEFAULT_MIGRATION_CORRUPT_SOURCE_ORACLE');cases.push('corrupt-source-quarantined-not-repaired');
 return {agentJobDefaultMigration:'PASS',synthetic:true,actualBrowser:false,boundary:'Production read, legacy migration, checkpoint activation, export/import and atomic transaction owner through isolated adapter; synthetic historical constructor and retained-acceptance controls.',sourceSha256,cases};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const fault=process.argv.find(arg=>arg.startsWith('--fault='))?.slice(8),sourceOverrides={};
 if(fault){let source=fs.readFileSync('project-store.js','utf8');const replacements={
  'defaults-retained':['function unacceptedAgentJobDefaults(project){','function unacceptedAgentJobDefaults(project){return [];'],
  'accepted-values-erased':[
   "  if(!fields.length||!fields.every(name=>Object.hasOwn(project.job,name)&&project.job[name]===''&&!Object.hasOwn(stage.agentData||{},name)&&!Object.hasOwn(stage.acceptedData||{},name)))return [];",
   "  if(!fields.length||!fields.every(name=>Object.hasOwn(project.job,name)&&project.job[name]===''))return [];"
  ]
 };const replacement=replacements[fault];assert(replacement&&source.includes(replacement[0]),'Unknown default migration fault');source=source.replace(...replacement);if(fault==='accepted-values-erased')source=source.replace(/  if\(\(data.acceptedChanges\|\|\[\]\)\.some\(change=>Number\(change.stage\)===1\)[^\n]+return \[\];/,'');sourceOverrides['project-store.js']=source;}
 console.log(JSON.stringify(await verifyAgentJobDefaultMigration({sourceOverrides})));
}
