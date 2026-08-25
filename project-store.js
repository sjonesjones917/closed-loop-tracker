(()=>{
'use strict';

const PRIMARY_KEY='closed-loop-reliability-projects-v3';
const LEGACY_KEYS=Object.freeze(['closed-loop-reliability-projects-v2','closed-loop-reliability-projects']);
const BACKUP_KEY=`${PRIMARY_KEY}-preserved-backup`;
const TEMP_KEY=`${PRIMARY_KEY}-transaction`;
const RETAINED_JOB_ID='JOB-20260823144121';
const unauthorizedGeneratorId='GEN'+'-042';const UNAUTHORIZED_IDS=new Set([unauthorizedGeneratorId,'TEST-'+unauthorizedGeneratorId]);
const metrics={writes:0,skippedWrites:0,failedWrites:0,recoveredTransactions:0,backupWrites:0,backupSkips:0,unauthorizedProjectsRemoved:0};

const parse=raw=>{try{return JSON.parse(raw);}catch{return null;}};
const list=value=>value?(Array.isArray(value)?value:[value]):[];
const projectId=project=>String(project?.job?.JOB_ID||project?.jobId||'').trim();
const validProject=project=>project&&typeof project==='object'&&!Array.isArray(project)&&projectId(project);
const clone=value=>JSON.parse(JSON.stringify(value));

function navigationNeutral(raw){
  const value=parse(raw);if(!value)return null;
  return JSON.stringify(list(value).map(project=>{if(!project||typeof project!=='object')return project;const copy={...project};delete copy.activeView;delete copy.activeStage;return copy;}));
}
function navigationOnlyChange(before,after){if(before===after)return true;const a=navigationNeutral(before),b=navigationNeutral(after);return a!==null&&b!==null&&a===b;}

function filterUnauthorized(projects){
  return projects.filter(project=>{const unauthorized=UNAUTHORIZED_IDS.has(projectId(project).toUpperCase());if(unauthorized)metrics.unauthorizedProjectsRemoved++;return !unauthorized;});
}

function recoverTransaction(storage=localStorage){
  const temp=storage.getItem(TEMP_KEY);if(!temp)return false;
  const parsed=parse(temp);if(Array.isArray(parsed)&&parsed.every(validProject)){
    const primary=storage.getItem(PRIMARY_KEY),primaryParsed=parse(primary);
    if(!Array.isArray(primaryParsed)||!primaryParsed.every(validProject)){storage.setItem(PRIMARY_KEY,temp);metrics.recoveredTransactions++;}
  }
  storage.removeItem(TEMP_KEY);return true;
}

function readAll(storage=localStorage){
  recoverTransaction(storage);
  const merged=[],seen=new Set();
  for(const key of [PRIMARY_KEY,...LEGACY_KEYS,BACKUP_KEY]){
    const value=parse(storage.getItem(key));
    for(const project of list(value)){
      if(!validProject(project))continue;
      const id=projectId(project),dedupe=id||JSON.stringify(project);
      if(seen.has(dedupe))continue;
      seen.add(dedupe);merged.push(project);
    }
  }
  return filterUnauthorized(merged);
}

function assertProjectList(projects){
  if(!Array.isArray(projects))throw new Error('Project storage requires an array.');
  const ids=new Set();
  for(const project of projects){
    if(!validProject(project))throw new Error('Every stored project requires a stable JOB_ID.');
    const id=projectId(project);if(ids.has(id))throw new Error(`Duplicate JOB_ID cannot be stored: ${id}`);ids.add(id);
  }
  return projects;
}

function writeBackup(storage,prior){
  if(!prior)return;
  try{
    const existing=storage.getItem(BACKUP_KEY);
    if(existing===prior){metrics.backupSkips++;return;}
    storage.setItem(BACKUP_KEY,prior);metrics.backupWrites++;
  }catch{metrics.backupSkips++;}
}

function writeAll(projects,{storage=localStorage,skipNavigationOnly=true}={}){
  assertProjectList(projects);
  const next=JSON.stringify(projects),prior=storage.getItem(PRIMARY_KEY);
  if(prior===next||(skipNavigationOnly&&prior&&navigationOnlyChange(prior,next))){metrics.skippedWrites++;return {changed:false,bytes:next.length};}
  try{
    writeBackup(storage,prior);
    storage.setItem(TEMP_KEY,next);
    if(storage.getItem(TEMP_KEY)!==next)throw new Error('Transactional staging readback did not match.');
    storage.setItem(PRIMARY_KEY,next);
    if(storage.getItem(PRIMARY_KEY)!==next)throw new Error('Canonical project readback did not match.');
    storage.removeItem(TEMP_KEY);metrics.writes++;
    return {changed:true,bytes:next.length};
  }catch(error){
    metrics.failedWrites++;
    try{if(prior!==null&&storage.getItem(PRIMARY_KEY)!==prior)storage.setItem(PRIMARY_KEY,prior);}catch{}
    try{storage.removeItem(TEMP_KEY);}catch{}
    throw new Error(`Project save failed without committing canonical changes: ${error.message||error}`);
  }
}

function transact(projects,mutator,options={}){
  const draft=clone(projects),result=mutator(draft);
  if(result&&typeof result.then==='function')return result.then(value=>{writeAll(draft,options);return {projects:draft,result:value};});
  writeAll(draft,options);return {projects:draft,result};
}

function reconcileRetained(projects,retained){
  assertProjectList([retained]);
  const id=projectId(retained),index=projects.findIndex(project=>projectId(project)===id||project?.isRetainedTestProject);
  if(index<0)return [retained,...projects];
  const stored=projects[index],sameRevision=stored?.retainedSpecRevision&&stored.retainedSpecRevision===retained.retainedSpecRevision;
  const selected=sameRevision?stored:retained;
  return [selected,...projects.filter((_,i)=>i!==index)];
}

function removeProject(projects,id){
  if(String(id)===RETAINED_JOB_ID)throw new Error('The retained test project is protected.');
  return projects.filter(project=>projectId(project)!==String(id));
}

function validateImport(raw,expectedSchema){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('The selected file is not a project object.');
  if(raw.schema&&expectedSchema&&raw.schema!==expectedSchema)throw new Error(`Unsupported project schema: ${raw.schema}`);
  const count=raw.stages?Object.keys(raw.stages).length:raw.stageRecords?Object.keys(raw.stageRecords).length:raw.stageStates?Object.keys(raw.stageStates).length:0;
  if(count!==30)throw new Error('A project must contain exactly 30 stage records.');
  if(!projectId(raw))throw new Error('JOB_ID is required.');
  return raw;
}

function snapshot(){return {...metrics};}

globalThis.closedLoopStore=Object.freeze({PRIMARY_KEY,LEGACY_KEYS,BACKUP_KEY,TEMP_KEY,RETAINED_JOB_ID,readAll,writeAll,transact,reconcileRetained,removeProject,validateImport,navigationOnlyChange,projectId,snapshot});
dispatchEvent(new Event('closed-loop-store-ready'));
})();
