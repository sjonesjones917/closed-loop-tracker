import fs from 'node:fs';

const path='app-core.js';
let source=fs.readFileSync(path,'utf8');
const replacements=[
  [
    "function normalize(p){try{if(p?.stages)return ensureState(core.migrateState(p));return importSeed(p);}catch(error){const r=ensureState(core.createBlankState(p?.job?.JOB_ID||p?.jobId));r.job.JOB_TITLE=p?.title||p?.job?.JOB_TITLE||'Recovered project';r.job.CURRENT_STATE='BLOCKED';r.projectData.recoveredProjects=[{reason:String(error.message||error),quarantinedOriginalProject:clone(p),operational:false}];return r;}}",
    "function normalize(p){try{if(p?.stages){const currentSchema=p.schema===core.PROJECT_SCHEMA&&p.workflow===core.WORKFLOW_ID&&Number(p.stageCount)===core.STAGE_COUNT,legacyNested=Boolean(p.projectData?.fullProject&&Object.keys(p.projectData.fullProject).length),legacyStageRecords=Boolean(p.projectData?.stageRecords&&Object.keys(p.projectData.stageRecords).length);return ensureState(currentSchema&&!legacyNested&&!legacyStageRecords?p:core.migrateState(p));}return importSeed(p);}catch(error){const r=ensureState(core.createBlankState(p?.job?.JOB_ID||p?.jobId));r.job.JOB_TITLE=p?.title||p?.job?.JOB_TITLE||'Recovered project';r.job.CURRENT_STATE='BLOCKED';r.projectData.recoveredProjects=[{reason:String(error.message||error),quarantinedOriginalProject:clone(p),operational:false}];return r;}}"
  ],
  [
    "function currentStagePrompt(n){const saved=currentPromptRecord(n);if(saved?.prompt)return saved.prompt;const preview=clone(current);preview.revision=Number(current.revision||0)+1;try{return globalThis.closedLoopPromptEngine.buildPromptRecord(n,preview,promptOptions(n)).prompt;}",
    "function currentStagePrompt(n){const saved=currentPromptRecord(n);if(saved?.prompt)return saved.prompt;const preview={...current,revision:Number(current.revision||0)+1};try{return globalThis.closedLoopPromptEngine.buildPromptRecord(n,preview,promptOptions(n)).prompt;}"
  ],
  [
    "let test=importSeed(await res.json()),i=projects.findIndex(p=>p.isRetainedTestProject||p.job.JOB_ID===test.job.JOB_ID);if(i>=0){const stored=projects[i];projects.splice(i,1);if(stored.retainedSpecRevision&&stored.retainedSpecRevision===test.retainedSpecRevision)test=stored;else needsPersist=true;}else needsPersist=true;projects.unshift(test);",
    "const seed=await res.json(),i=projects.findIndex(p=>p.isRetainedTestProject||p.job.JOB_ID===seed.jobId);let test;if(i>=0){const stored=projects[i];projects.splice(i,1);if(stored.retainedSpecRevision&&stored.retainedSpecRevision===seed.specRevision)test=stored;else{test=importSeed(seed);needsPersist=true;}}else{test=importSeed(seed);needsPersist=true;}projects.unshift(test);"
  ]
];
for(const [before,after] of replacements){
  const count=source.split(before).length-1;
  if(count===0 && source.includes(after))continue;
  if(count!==1)throw new Error(`Expected exactly one hot-path source match; found ${count}.`);
  source=source.replace(before,after);
}
fs.writeFileSync(path,source);
