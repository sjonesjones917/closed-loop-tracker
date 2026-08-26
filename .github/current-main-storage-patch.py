from pathlib import Path
import re
p=Path('project-store.js'); text=p.read_text()
pattern=r"async function readAllIndexed\(\)\{.*?\}\nfunction readAll\(storage\)"
replacement="""async function readAllIndexed(){await migrateLegacy();const db=await openDatabase(),tx=db.transaction(PROJECTS,'readonly'),rows=await request(tx.objectStore(PROJECTS).getAll());await complete(tx);const valid=[];for(const row of rows){const actual=projectSha256(row.project);if(actual!==row.projectSha256){await quarantine(row,'PROJECT_HASH_MISMATCH');continue;}const project=clone(row.project);project.revision=Number(row.revision||project.revision||0);if(project.schema===globalThis.closedLoopWorkflowSchema?.PROJECT_SCHEMA){const integrity=validateProjectIntegrity(project,{verifyDerived:false});if(!integrity.valid){await quarantine(row,'PROJECT_CANONICAL_INTEGRITY_FAILED: '+integrity.issues.join(' | '));continue;}}project.projectSha256=row.projectSha256;valid.push(project);}return valid;}
function readAll(storage)"""
text,count=re.subn(pattern,replacement,text,count=1,flags=re.S)
if count!=1: raise SystemExit('IndexedDB read pattern mismatch')
pattern=r"async function writeProject\(project,\{expectedProjectRevision=null,incrementRevision=true\}=\{\}\)\{.*?\n\}\n\nasync function writeAllIndexed"
replacement="""async function writeProject(project,{expectedProjectRevision=null,incrementRevision=true}={}){
  const id=projectIdentity(project);if(!id)throw new Error('A project without a JOB_ID cannot be committed.');const db=await openDatabase();fault('before-project-transaction');const tx=db.transaction([PROJECTS,META],'readwrite');const store=tx.objectStore(PROJECTS);try{const prior=await request(store.get(id));const currentRevision=Number(prior?.revision||0);if(expectedProjectRevision!==null&&Number(expectedProjectRevision)!==currentRevision){const e=new Error(`Project revision conflict for ${id}: expected ${expectedProjectRevision}, found ${currentRevision}.`);e.code='STALE_PROJECT_REVISION';throw e;}const next=clone(project);next.revision=incrementRevision?currentRevision+1:currentRevision;delete next.projectSha256;const engine=globalThis.closedLoopWorkflowEngine;engine?.ensureShape?.(next);engine?.recalculate?.(next);assertProjectIntegrity(next);const digest=projectSha256(next);fault('during-project-write');store.put({jobId:id,revision:next.revision,project:next,projectSha256:digest,updatedAt:now()});tx.objectStore(META).put({key:'selectedProject',value:id,updatedAt:now()});tx.objectStore(META).put({key:'lastCommittedRevision',value:{jobId:id,revision:next.revision,projectSha256:digest},updatedAt:now()});fault('before-transaction-commit');await complete(tx);next.projectSha256=digest;try{new BroadcastChannel('closed-loop-reliability').postMessage({type:'PROJECT_CHANGED',jobId:id,revision:next.revision});}catch{}return next;}catch(error){try{tx.abort();}catch{}throw error;}
}

async function writeAllIndexed"""
text,count=re.subn(pattern,replacement,text,count=1,flags=re.S)
if count!=1: raise SystemExit('IndexedDB write pattern mismatch')
old="engine?.ensureShape?.(next);engine?.recalculate?.(next);next.revision=expected+1;const digest=projectSha256(next);"
new="engine?.ensureShape?.(next);engine?.recalculate?.(next);next.revision=expected+1;assertProjectIntegrity(next);const digest=projectSha256(next);"
if text.count(old)!=1: raise SystemExit('Transaction integrity pattern mismatch')
text=text.replace(old,new,1)
p.write_text(text)
p=Path('app-core.js'); text=p.read_text();old="artifacts:'artifacts',reviews:'reviews',history:'history'};";new="artifacts:'artifacts',reviews:'reviews'};"
if text.count(old)!=1: raise SystemExit('Legacy history mapping pattern mismatch')
p.write_text(text.replace(old,new,1))
