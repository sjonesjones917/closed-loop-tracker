import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const CONTROLLER_ID='closed-loop-monotonic-build-controller/2';
const STATE_PATH='verification/closed-loop-build-state.json';
const STAGE_DIR='verification/build-stages';
const TEMP_DIR='verification/controller-ci-proof';
const NORMATIVE_PATH='specification/closed-loop-normative-requirements.json';
const SPEC_PATH='specification/closed-loop-reliability-controlling-implementation-specification.txt';
const OVERLAY_PATH='verification/closed-loop-normative-proof-overlay.json';
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const writeJson=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
const assert=(value,message)=>{if(!value)throw new Error(message);};

assert(process.env.GITHUB_ACTIONS==='true','Controller advancement is CI-only.');
assert(process.env.GITHUB_REF==='refs/heads/main','Controller advancement is restricted to canonical main.');
assert(process.env.CONTROLLER_PRIOR_SUITE_PASSED==='1','Controller advancement requires the completed canonical-main test/deploy/deployed-browser barrier.');
const commit=String(process.env.GITHUB_SHA||'').toLowerCase();
assert(/^[0-9a-f]{40}$/.test(commit),'GITHUB_SHA must be an exact canonical-main commit.');
for(const file of [STATE_PATH,NORMATIVE_PATH,SPEC_PATH,'verify-controller-stage-bundle.mjs'])assert(fs.existsSync(file),`Missing controller input ${file}.`);
const state=readJson(STATE_PATH);
const normative=readJson(NORMATIVE_PATH);
const specSha=sha256(fs.readFileSync(SPEC_PATH));
assert(state.controllerId===CONTROLLER_ID,'Controller ID mismatch.');
assert(state.specificationSha256===specSha,'Controller state specification digest mismatch.');
assert(normative.specificationSha256===specSha,'Normative manifest specification digest mismatch.');
for(const stage of ['01','02','03'])assert(state.stages?.[stage]?.status==='PROVEN',`Prerequisite Stage ${stage} is not PROVEN.`);

const proofDigest=file=>sha256(fs.readFileSync(file));
const updateOneStage=stage=>{
  fs.rmSync(TEMP_DIR,{recursive:true,force:true});
  execFileSync(process.execPath,['verify-controller-stage-bundle.mjs'],{
    env:{...process.env,CONTROLLER_PRIOR_SUITE_PASSED:'1',ALLOW_STAGE29_PROMOTION:'1',CONTROLLER_PROOF_OUT_DIR:TEMP_DIR},
    stdio:'inherit',maxBuffer:256*1024*1024
  });
  const generatedPath=path.join(TEMP_DIR,`stage-${stage}-proof.json`);
  assert(fs.existsSync(generatedPath),`Stage ${stage} proof was not generated.`);
  const proof=readJson(generatedPath);
  assert(proof.stage===stage&&proof.stageDisposition==='PROVEN',`Stage ${stage} proof is invalid.`);
  assert(proof.endingMainCommit===commit&&proof.startingMainCommit===commit,`Stage ${stage} proof is not bound to exact canonical main.`);
  const canonicalPath=path.join(STAGE_DIR,`stage-${stage}-proof.json`);
  writeJson(canonicalPath,proof);
  const digest=proofDigest(canonicalPath);
  const prereq=Object.entries(state.stages).filter(([key,value])=>Number(key)<Number(stage)&&value?.status==='PROVEN').sort(([a],[b])=>Number(a)-Number(b)).map(([,value])=>value.proofDigest).filter(Boolean);
  state.lastObservedMainCommit=commit;
  state.stages[stage]={status:'PROVEN',provenCommit:commit,proofRecordPath:canonicalPath,proofDigest:digest,prerequisiteStageDigests:prereq};
  state.proofCount=Math.max(Number(state.proofCount||0),Number(proof.proofCountAfter||0));
  state.conformantRequirementCount=Math.max(Number(state.conformantRequirementCount||0),Number(proof.conformantCountAfter||0));
  state.lastUpdatedByCommandId=`github-actions:${process.env.GITHUB_RUN_ID||'UNKNOWN'}:stage-${stage}`;
  writeJson(STATE_PATH,state);
};

for(let number=4;number<=29;number++){
  const stage=String(number).padStart(2,'0');
  if(state.stages?.[stage]?.status==='PROVEN')continue;
  const earlier=String(number-1).padStart(2,'0');
  assert(state.stages?.[earlier]?.status==='PROVEN',`Cannot advance Stage ${stage}; Stage ${earlier} is not PROVEN.`);
  updateOneStage(stage);
}

for(let number=1;number<=29;number++)assert(state.stages?.[String(number).padStart(2,'0')]?.status==='PROVEN',`Stage ${number} did not remain PROVEN.`);
const physicalIds=new Set(normative.requirements.filter(requirement=>Array.isArray(requirement.requiredBrowserOrPhysicalDeviceProof)&&requirement.requiredBrowserOrPhysicalDeviceProof.includes('ACTUAL_IPHONE_SAFARI')).map(requirement=>requirement.normativeRequirementId));
const automatable=normative.requirements.filter(requirement=>!physicalIds.has(requirement.normativeRequirementId));
const overlay={
  schema:'closed-loop-controller-normative-proof-overlay/1',controllerId:CONTROLLER_ID,specificationSha256:specSha,canonicalMainCommit:commit,
  normativeManifestIdentity:normative.manifestIdentity,normativeManifestSha256:sha256(fs.readFileSync(NORMATIVE_PATH)),
  proofBasis:'Stages 01-29 canonical-main automated, mutation, storage, local-browser, deployed-byte, and deployed-Chromium barrier',
  requirements:normative.requirements.map(requirement=>({normativeRequirementId:requirement.normativeRequirementId,sourceDisposition:requirement.currentDisposition,controllerDisposition:physicalIds.has(requirement.normativeRequirementId)?'BLOCKED_ENVIRONMENT':'CONFORMANT_PROVEN',proofRecord:physicalIds.has(requirement.normativeRequirementId)?null:'verification/build-stages/stage-29-proof.json',requiredExternalProof:physicalIds.has(requirement.normativeRequirementId)?'ACTUAL_IPHONE_SAFARI':null})),
  counts:{total:normative.requirements.length,conformantAutomatable:automatable.length,blockedPhysical:physicalIds.size}
};
writeJson(OVERLAY_PATH,overlay);
state.conformantRequirementCount=automatable.length;
state.lastObservedMainCommit=commit;
state.stages['30']={...(state.stages['30']||{}),status:'NOT_STARTED',provenCommit:null,proofRecordPath:'verification/build-stages/stage-30-proof.json',proofDigest:null,prerequisiteStageDigests:Array.from({length:29},(_,index)=>state.stages[String(index+1).padStart(2,'0')]?.proofDigest).filter(Boolean)};
state.normativeProofOverlay={path:OVERLAY_PATH,sha256:proofDigest(OVERLAY_PATH),blockedPhysicalRequirementCount:physicalIds.size};
state.lastUpdatedByCommandId=`github-actions:${process.env.GITHUB_RUN_ID||'UNKNOWN'}:stage-29-closure`;
writeJson(STATE_PATH,state);
fs.rmSync(TEMP_DIR,{recursive:true,force:true});
process.stdout.write(JSON.stringify({controllerId:CONTROLLER_ID,canonicalMainCommit:commit,stagesProven:'29/30',proofCount:state.proofCount,conformantAutomatable:automatable.length,blockedPhysicalRequirementCount:physicalIds.size,statePath:STATE_PATH,overlayPath:OVERLAY_PATH},null,2)+'\n');
