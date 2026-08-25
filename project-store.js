(()=>{
'use strict';

const STORE_KEY='closed-loop-reliability-projects-v4';
const LEGACY_KEYS=Object.freeze([
  'closed-loop-reliability-projects-v3',
  'closed-loop-reliability-projects-v2',
  'closed-loop-reliability-projects'
]);
const BACKUP_KEY=`${STORE_KEY}-preserved-backup`;
const TEMP_KEY=`${STORE_KEY}-transaction`;

const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const asList=value=>Array.isArray(value)?value:(value&&typeof value==='object'?[value]:[]);
const projectIdentity=project=>String(project?.job?.JOB_ID||project?.jobId||'').trim();

function fault(phase){
  const configured=globalThis.__closedLoopStorageFault;
  if(configured===phase||configured?.phase===phase){
    const error=new Error(`Injected storage failure at ${phase}.`);
    error.code='INJECTED_STORAGE_FAILURE';
    throw error;
  }
}

function parseStored(raw){
  if(!raw)return [];
  const parsed=JSON.parse(raw);
  return asList(parsed).filter(item=>item&&typeof item==='object');
}

function readAll(storage=globalThis.localStorage){
  if(!storage)return [];
  const projects=[];
  const seen=new Set();
  for(const key of [STORE_KEY,...LEGACY_KEYS,BACKUP_KEY]){
    let list=[];
    try{list=parseStored(storage.getItem(key));}catch(error){
      console.error(`Ignored malformed project storage at ${key}.`,error);
      continue;
    }
    for(const project of list){
      const identity=projectIdentity(project);
      const dedupe=identity||JSON.stringify(project);
      if(seen.has(dedupe))continue;
      seen.add(dedupe);
      projects.push(project);
    }
  }
  return projects;
}

function writeAll(projects,storage=globalThis.localStorage){
  if(!storage)throw new Error('Persistent browser storage is unavailable.');
  if(!Array.isArray(projects))throw new TypeError('Project storage payload must be an array.');
  const payload=JSON.stringify(projects);
  const prior=storage.getItem(STORE_KEY);
  if(prior===payload)return {changed:false,bytes:payload.length};
  let finalTouched=false;
  try{
    fault('before-temp-write');
    storage.setItem(TEMP_KEY,payload);
    fault('after-temp-write');
    if(storage.getItem(TEMP_KEY)!==payload)throw new Error('Transactional project payload verification failed.');

    if(prior!==null){
      try{storage.setItem(BACKUP_KEY,prior);}catch(error){
        // A stale backup may consume the quota needed to preserve the current value.
        try{storage.removeItem(BACKUP_KEY);storage.setItem(BACKUP_KEY,prior);}catch{
          throw new Error(`Current project state could not be backed up: ${error.message||error}`);
        }
      }
    }

    fault('before-final-write');
    finalTouched=true;
    storage.setItem(STORE_KEY,payload);
    fault('after-final-write');
    if(storage.getItem(STORE_KEY)!==payload)throw new Error('Committed project payload verification failed.');
    storage.removeItem(TEMP_KEY);
    return {changed:true,bytes:payload.length};
  }catch(error){
    try{
      if(finalTouched){
        if(prior===null)storage.removeItem(STORE_KEY);
        else storage.setItem(STORE_KEY,prior);
      }
    }catch(restoreError){
      error.restoreError=String(restoreError?.message||restoreError);
    }
    try{storage.removeItem(TEMP_KEY);}catch{}
    throw error;
  }
}

function replaceProject(projects,project,storage=globalThis.localStorage){
  const identity=projectIdentity(project);
  if(!identity)throw new Error('A project without a JOB_ID cannot be committed.');
  const next=clone(projects||[]);
  const index=next.findIndex(item=>projectIdentity(item)===identity);
  if(index<0)next.unshift(clone(project));
  else next[index]=clone(project);
  writeAll(next,storage);
  return next;
}

function transact(projects,jobId,mutator,storage=globalThis.localStorage){
  if(typeof mutator!=='function')throw new TypeError('Transaction mutator must be a function.');
  const next=clone(projects||[]);
  const index=next.findIndex(item=>projectIdentity(item)===String(jobId||''));
  if(index<0)throw new Error(`Project ${jobId||'UNKNOWN'} is not available for transaction.`);
  const before=clone(next[index]);
  const result=mutator(next[index],before);
  writeAll(next,storage);
  return {projects:next,project:next[index],result};
}

function removeProject(projects,jobId,storage=globalThis.localStorage){
  const next=clone(projects||[]).filter(project=>projectIdentity(project)!==String(jobId||''));
  writeAll(next,storage);
  return next;
}

function clearLegacy(storage=globalThis.localStorage){
  if(!storage)return;
  for(const key of LEGACY_KEYS)storage.removeItem(key);
}

globalThis.closedLoopProjectStore=Object.freeze({
  version:'closed-loop-project-store/1',
  STORE_KEY,LEGACY_KEYS,BACKUP_KEY,TEMP_KEY,
  clone,projectIdentity,readAll,writeAll,replaceProject,transact,removeProject,clearLegacy
});
})();
