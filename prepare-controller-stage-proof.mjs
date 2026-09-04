import fs from 'node:fs';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import path from 'node:path';

const CONTROLLER_ID='closed-loop-monotonic-build-controller/2';
const STATE_PATH='verification/closed-loop-build-state.json';
const PROOF_ROOT='verification/build-stages';
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const writeJson=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const orderedStages=Array.from({length:26},(_,index)=>String(index+3).padStart(2,'0'));

function arg(name){const index=process.argv.indexOf(name);return index>=0?process.argv[index+1]:null;}
const provenCommit=String(arg('--proven-commit')||process.env.CONTROLLER_PROVEN_COMMIT||'').toLowerCase();
const expectedStage=String(arg('--stage')||process.env.CONTROLLER_STAGE||'').padStart(2,'0');
assert(/^[0-9a-f]{40}$/.test(provenCommit),'--proven-commit must be an exact commit SHA.');
assert(orderedStages.includes(expectedStage),'--stage must identify Build Stage 03 through 28.');
const state=readJson(STATE_PATH);
assert(state.controllerId===CONTROLLER_ID,'Controller state identity mismatch.');
const earliest=orderedStages.find(stage=>state.stages?.[stage]?.status!=='PROVEN');
assert(earliest===expectedStage,`Requested Stage ${expectedStage} is not the earliest non-PROVEN stage (${earliest||'NONE'}).`);
const prior=String(Number(expectedStage)-1).padStart(2,'0');
assert(state.stages?.[prior]?.status==='PROVEN',`Prior Stage ${prior} is not PROVEN.`);
const outDir=fs.mkdtempSync(path.join(process.cwd(),'.controller-proof-'));
try{
  cp.execFileSync(process.execPath,['verify-controller-stage-bundle.mjs'],{
    env:{...process.env,GITHUB_ACTIONS:'false',GITHUB_SHA:provenCommit,GITHUB_RUN_ID:'CONTROLLER-PROOF',CONTROLLER_PRIOR_SUITE_PASSED:'1',CONTROLLER_STAGE_BUNDLE_ACTIVE:'1',CONTROLLER_PROOF_OUT_DIR:outDir},
    stdio:['ignore','pipe','pipe'],maxBuffer:256*1024*1024
  });
  const generatedPath=path.join(outDir,`stage-${expectedStage}-proof.json`);
  const proof=readJson(generatedPath);
  assert(proof.stage===expectedStage&&proof.endingMainCommit===provenCommit,'Generated proof binding mismatch.');
  const proofPath=`${PROOF_ROOT}/stage-${expectedStage}-proof.json`;
  writeJson(proofPath,proof);
  const proofDigest=sha256(fs.readFileSync(proofPath));
  const updated=structuredClone(state);
  updated.lastObservedMainCommit=provenCommit;
  updated.stages[expectedStage]={
    status:'PROVEN',
    provenCommit,
    proofRecordPath:proofPath,
    proofDigest,
    prerequisiteStageDigests:Object.entries(updated.stages).filter(([stage,value])=>Number(stage)<Number(expectedStage)&&value?.status==='PROVEN').map(([,value])=>value.proofDigest).filter(Boolean)
  };
  updated.proofCount=proof.proofCountAfter;
  updated.conformantRequirementCount=proof.conformantCountAfter;
  updated.lastUpdatedByCommandId=`CONTROLLER-STAGE-${expectedStage}-${provenCommit.slice(0,12)}`;
  writeJson(STATE_PATH,updated);
  cp.execFileSync(process.execPath,['verify-build-stage-ledger.mjs'],{env:{...process.env,GITHUB_ACTIONS:'false'},stdio:'inherit',maxBuffer:256*1024*1024});
  process.stdout.write(`${JSON.stringify({controllerStagePrepared:'PASS',stage:expectedStage,provenCommit,proofPath,proofDigest,proofCountAfter:updated.proofCount,conformantCountAfter:updated.conformantRequirementCount})}\n`);
}finally{
  fs.rmSync(outDir,{recursive:true,force:true});
}
