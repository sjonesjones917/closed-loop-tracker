import fs from 'node:fs';
import crypto from 'node:crypto';
import cp from 'node:child_process';

const CONTROLLER_ID='closed-loop-monotonic-build-controller/2';
const PROOF_SCHEMA='closed-loop-build-stage-proof/1';
const STATE_PATH='verification/closed-loop-build-state.json';
const SPEC_MANIFEST_PATH='specification/closed-loop-specification-manifest.json';
const NORMATIVE_PATH='specification/closed-loop-normative-requirements.json';
const VALID_STATUS=new Set(['NOT_STARTED','IN_PROGRESS','WAITING_FOR_REQUIRED_ACTOR','PROVEN','REGRESSED']);
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const readJson=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const stageKey=n=>String(n).padStart(2,'0');

function proveAncestor(commit){
  if(process.env.GITHUB_ACTIONS!=='true')return true;
  if(cp.spawnSync('git',['cat-file','-e',`${commit}^{commit}`],{stdio:'ignore'}).status!==0){
    const fetch=cp.spawnSync('git',['fetch','--no-tags','--depth=64','origin',commit],{stdio:'ignore'});
    assert(fetch.status===0,`Unable to fetch proven commit ${commit} for ancestry verification.`);
  }
  return cp.spawnSync('git',['merge-base','--is-ancestor',commit,'HEAD'],{stdio:'ignore'}).status===0;
}

function validateLedger(state,{mutateProofDigest=false,mutateSkip=false,mutateCounts=false,mutateSpec=false}={}){
  const specManifest=readJson(SPEC_MANIFEST_PATH);
  const normative=readJson(NORMATIVE_PATH);
  const s=structuredClone(state);
  if(mutateSpec)s.specificationSha256='0'.repeat(64);
  if(mutateSkip){s.stages['01'].status='NOT_STARTED';s.stages['02'].status='PROVEN';s.stages['02'].proofRecordPath='verification/build-stages/stage-02-proof.json';s.stages['02'].proofDigest='0'.repeat(64);}
  if(mutateCounts)s.proofCount=-1;
  assert(s.controllerId===CONTROLLER_ID,'Build-state controller identity mismatch.');
  assert(s.specificationSha256===specManifest.sha256,'Build-state specification digest mismatch.');
  assert(s.specificationSourceCommit===specManifest.sourceCommit,'Build-state specification source commit mismatch.');
  assert(s.stages&&typeof s.stages==='object','Build-state stages map missing.');
  let seenNonProven=false;
  let latestProofCount=0;
  let latestConformantCount=0;
  const priorDigests=[];
  for(let n=1;n<=30;n++){
    const key=stageKey(n),entry=s.stages[key];
    assert(entry&&VALID_STATUS.has(entry.status),`Stage ${key} has invalid or missing status.`);
    if(entry.status!=='PROVEN')seenNonProven=true;
    if(entry.status==='PROVEN'){
      assert(!seenNonProven,`Stage ${key} is PROVEN after an earlier non-PROVEN stage.`);
      const expectedPath=`verification/build-stages/stage-${key}-proof.json`;
      assert(entry.proofRecordPath===expectedPath,`Stage ${key} proof path mismatch.`);
      assert(fs.existsSync(expectedPath),`Stage ${key} proof record missing.`);
      const proofBytes=fs.readFileSync(expectedPath),proof=JSON.parse(proofBytes.toString('utf8'));
      const actualDigest=sha256(proofBytes),recordedDigest=(mutateProofDigest&&n===1)?'f'.repeat(64):entry.proofDigest;
      assert(recordedDigest===actualDigest,`Stage ${key} proof digest mismatch.`);
      assert(proof.schema===PROOF_SCHEMA&&proof.controllerId===CONTROLLER_ID,`Stage ${key} proof schema/controller mismatch.`);
      assert(String(proof.stage).padStart(2,'0')===key,`Stage ${key} proof stage identity mismatch.`);
      assert(proof.specificationSha256===s.specificationSha256,`Stage ${key} proof specification digest mismatch.`);
      assert(proof.stageDisposition==='PROVEN',`Stage ${key} proof disposition is not PROVEN.`);
      assert(Array.isArray(proof.unprovenItems)&&proof.unprovenItems.length===0,`Stage ${key} has unproven items.`);
      assert(Number.isInteger(proof.proofCountBefore)&&Number.isInteger(proof.proofCountAfter)&&proof.proofCountAfter>=proof.proofCountBefore,`Stage ${key} proof count regressed.`);
      assert(Number.isInteger(proof.conformantCountBefore)&&Number.isInteger(proof.conformantCountAfter)&&proof.conformantCountAfter>=proof.conformantCountBefore,`Stage ${key} conformant count regressed.`);
      if(n>1){
        assert(proof.proofCountBefore>=latestProofCount,`Stage ${key} proof count is below prior proven stage.`);
        assert(proof.conformantCountBefore>=latestConformantCount,`Stage ${key} conformant count is below prior proven stage.`);
      }
      assert(Array.isArray(entry.prerequisiteStageDigests),`Stage ${key} prerequisite proof digests missing.`);
      for(const digest of entry.prerequisiteStageDigests)assert(priorDigests.includes(digest),`Stage ${key} references an unknown prerequisite proof digest.`);
      assert(entry.provenCommit===proof.endingMainCommit,`Stage ${key} proven commit differs from proof ending commit.`);
      assert(/^[0-9a-f]{40}$/.test(entry.provenCommit),`Stage ${key} proven commit is invalid.`);
      assert(proveAncestor(entry.provenCommit),`Stage ${key} proven commit is not reachable from current HEAD.`);
      priorDigests.push(actualDigest);
      latestProofCount=proof.proofCountAfter;
      latestConformantCount=proof.conformantCountAfter;
    }
  }
  assert(Number.isInteger(s.proofCount)&&s.proofCount===latestProofCount,'Build-state proofCount does not equal latest proven proof count.');
  assert(Number.isInteger(s.conformantRequirementCount)&&s.conformantRequirementCount===latestConformantCount,'Build-state conformantRequirementCount does not equal latest proven conformant count.');
  const manifestConformant=Array.isArray(normative.requirements)?normative.requirements.filter(r=>r.currentDisposition==='CONFORMANT_PROVEN').length:0;
  assert(manifestConformant>=latestConformantCount,'Normative manifest has fewer CONFORMANT_PROVEN entries than the build ledger claims.');
  return {provenStages:priorDigests.length,proofCount:latestProofCount,conformantCount:latestConformantCount,manifestConformant};
}

const state=readJson(STATE_PATH);
const result=validateLedger(state);
for(const [fixture,mutation] of [
  ['proof-digest-mismatch',{mutateProofDigest:true}],
  ['skipped-stage',{mutateSkip:true}],
  ['count-regression',{mutateCounts:true}],
  ['specification-digest-mismatch',{mutateSpec:true}]
]){
  let rejected=false;
  try{validateLedger(state,mutation);}catch{rejected=true;}
  assert(rejected,`Intentional invalid fixture ${fixture} was not rejected.`);
}
console.log(JSON.stringify({...result,ledgerVerified:true,intentionalInvalidFixturesRejected:4}));
