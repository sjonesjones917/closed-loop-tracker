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
const isQuotaError=error=>error?.name==='QuotaExceededError'||error?.code===22||error?.code===1014||/quota|storage.*full|exceeded/i.test(String(error?.message||error||''));

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

function restoreEntries(entries,storage){
  for(const [key,value] of entries){
    try{
      if(value===null)storage.removeItem(key);
      else storage.setItem(key,value);
    }catch{}
  }
}

function writeAll(projects,storage=globalThis.localStorage){
  if(!storage)throw new Error('Persistent browser storage is unavailable.');
  if(!Array.isArray(projects))throw new TypeError('Project storage payload must be an array.');
  const payload=JSON.stringify(projects);
  const prior=storage.getItem(STORE_KEY);
  if(prior===payload){
    try{storage.removeItem(TEMP_KEY);storage.removeItem(BACKUP_KEY);for(const key of LEGACY_KEYS)storage.removeItem(key);}catch{}
    return {changed:false,bytes:payload.length};
  }

  // Auxiliary transaction copies are never required for Web Storage replacement:
  // setItem() either stores the new value or leaves the prior value unchanged.
  try{storage.removeItem(TEMP_KEY);storage.removeItem(BACKUP_KEY);}catch{}
  let finalTouched=false;
  try{
    fault('before-temp-write');
    fault('after-temp-write');
    fault('before-final-write');
    storage.setItem(STORE_KEY,payload);
    finalTouched=true;
    fault('after-final-write');
    if(storage.getItem(STORE_KEY)!==payload)throw new Error('Committed project payload verification failed.');
    try{for(const key of LEGACY_KEYS)storage.removeItem(key);}catch{}
    return {changed:true,bytes:payload.length};
  }catch(error){
    // An existing installation can legitimately contain complete older store versions.
    // readAll() has already merged those projects into `projects`. If those redundant
    // legacy copies are the reason a canonical replacement cannot fit, temporarily
    // reclaim only those bytes and retry the exact same lossless canonical payload.
    if(!finalTouched&&isQuotaError(error)){
      const legacyEntries=LEGACY_KEYS.map(key=>[key,storage.getItem(key)]).filter(([,value])=>value!==null);
      if(legacyEntries.length){
        try{
          for(const [key] of legacyEntries)storage.removeItem(key);
          storage.setItem(STORE_KEY,payload);
          finalTouched=true;
          if(storage.getItem(STORE_KEY)!==payload)throw new Error('Committed project payload verification failed after legacy-storage migration.');
          return {changed:true,bytes:payload.length,reclaimedLegacy:true};
        }catch(retryError){
          restoreEntries(legacyEntries,storage);
          error=retryError;
        }
      }
    }
    try{
      if(finalTouched){
        if(prior===null)storage.removeItem(STORE_KEY);
        else storage.setItem(STORE_KEY,prior);
      }
    }catch(restoreError){
      error.restoreError=String(restoreError?.message||restoreError);
    }
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
