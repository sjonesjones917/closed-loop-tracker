import fs from 'node:fs';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {classifyControllerChange} from './classify-controller-change.mjs';

const CONTROLLER_ID='closed-loop-monotonic-build-controller/2';
const STATE_PATH='verification/closed-loop-build-state.json';
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const git=(args,options={})=>cp.execFileSync('git',args,{encoding:'utf8',...options}).trim();
const base=String(process.env.CONTROLLER_BASE_COMMIT||'').toLowerCase();
assert.match(base,/^[0-9a-f]{40}$/,'CONTROLLER_BASE_COMMIT must identify the exact current main base commit.');
assert.equal(cp.spawnSync('git',['merge-base','--is-ancestor',base,'HEAD']).status,0,'Proof base commit is not an ancestor of the PR head.');
const changed=git(['diff','--name-only',base,'HEAD']).split(/\r?\n/).filter(Boolean);
const classification=classifyControllerChange(changed);
assert.equal(classification.controllerProofOnly,true,`Change is not an exact controller proof-only change: ${changed.join(', ')}`);
const stage=classification.stage;
const proofPath=`verification/build-stages/stage-${stage}-proof.json`;
const baseState=JSON.parse(git(['show',`${base}:${STATE_PATH}`]));
const currentState=readJson(STATE_PATH);
assert.equal(baseState.controllerId,CONTROLLER_ID);
assert.equal(currentState.controllerId,CONTROLLER_ID);
const ordered=Array.from({length:26},(_,index)=>String(index+3).padStart(2,'0'));
const earliest=ordered.find(key=>baseState.stages?.[key]?.status!=='PROVEN');
assert.equal(stage,earliest,'Proof file is not for the earliest non-PROVEN stage in canonical main.');
for(const key of Object.keys(baseState.stages)){
  if(key===stage)continue;
  assert.deepEqual(currentState.stages[key],baseState.stages[key],`Stage ${key} changed in a proof-only promotion.`);
}
assert.equal(baseState.stages[stage].status,'NOT_STARTED',`Stage ${stage} was not NOT_STARTED on the exact base commit.`);
assert.equal(currentState.stages[stage].status,'PROVEN',`Stage ${stage} was not promoted to PROVEN.`);
assert.equal(currentState.lastObservedMainCommit=base,'Ledger lastObservedMainCommit must bind the proven base commit.');
assert.equal(currentState.conformantRequirementCount,baseState.conformantRequirementCount,'Stages 03-28 cannot alter normative conformant count.');
assert.ok(currentState.proofCount>=baseState.proofCount,'Proof count regressed.');
const proofBytes=fs.readFileSync(proofPath),proof=JSON.parse(proofBytes.toString('utf8'));
assert.equal(proof.controllerId,CONTROLLER_ID);
assert.equal(proof.stage,stage);
assert.equal(proof.endingMainCommit,base);
assert.equal(currentState.stages[stage].provenCommit,base);
assert.equal(currentState.stages[stage].proofRecordPath,proofPath);
assert.equal(currentState.stages[stage].proofDigest,sha256(proofBytes));
assert.equal(proof.proofCountBefore,baseState.proofCount);
assert.equal(proof.proofCountAfter,currentState.proofCount);
assert.equal(proof.conformantCountBefore,baseState.conformantRequirementCount);
assert.equal(proof.conformantCountAfter,currentState.conformantRequirementCount);
assert.deepEqual(proof.unprovenItems,[]);
assert.equal(proof.stageDisposition,'PROVEN');

const temp=fs.mkdtempSync(path.join(os.tmpdir(),`controller-proof-${stage}-`));
try{
  fs.cpSync(process.cwd(),temp,{recursive:true,filter:source=>!source.includes(`${path.sep}.git${path.sep}`)&&!source.endsWith(`${path.sep}.git`)});
  fs.writeFileSync(path.join(temp,STATE_PATH),git(['show',`${base}:${STATE_PATH}`])+'\n');
  const outDir=path.join(temp,'verification','expected-controller-proof');
  cp.execFileSync(process.execPath,['verify-controller-stage-bundle.mjs'],{
    cwd:temp,
    env:{...process.env,GITHUB_ACTIONS:'false',GITHUB_SHA:base,GITHUB_RUN_ID:'CONTROLLER-PROOF',CONTROLLER_PRIOR_SUITE_PASSED:'1',CONTROLLER_STAGE_BUNDLE_ACTIVE:'1',CONTROLLER_PROOF_OUT_DIR:outDir},
    stdio:['ignore','pipe','pipe'],maxBuffer:256*1024*1024
  });
  const expected=readJson(path.join(outDir,`stage-${stage}-proof.json`));
  assert.deepEqual(proof,expected,'Committed proof differs from deterministic stage proof regenerated from the exact base ledger and current implementation.');
}finally{
  fs.rmSync(temp,{recursive:true,force:true});
}
cp.execFileSync(process.execPath,['verify-build-stage-ledger.mjs'],{stdio:'inherit',maxBuffer:256*1024*1024});
console.log(JSON.stringify({controllerProofChange:'PASS',stage,provenCommit:base,changedFiles:changed,proofDigest:sha256(proofBytes)}));
