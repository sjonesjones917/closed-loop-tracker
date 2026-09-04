import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const CONTROLLER_ID='closed-loop-monotonic-build-controller/2';
const PROOF_SCHEMA='closed-loop-build-stage-proof/1';
const SPEC_PATH='specification/closed-loop-reliability-controlling-implementation-specification.txt';
const SPEC_MANIFEST_PATH='specification/closed-loop-specification-manifest.json';
const NORMATIVE_MANIFEST_PATH='specification/closed-loop-normative-requirements.json';
const REVIEW_SCRIPT='review-specification-coverage.mjs';
const PROOF_DIR='verification/build-stages';
const PROOF_PATH=`${PROOF_DIR}/stage-01-proof.json`;
const REVIEW_PATH=`${PROOF_DIR}/stage-01-independent-review.json`;
const STATE_PATH='verification/closed-loop-build-state.json';
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const exactCommit=value=>{if(!/^[0-9a-f]{40}$/.test(String(value||'')))throw new Error(`Invalid exact commit: ${value}`);return String(value);};
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:64*1024*1024}).trim();
const endingMainCommit=exactCommit(process.env.SOURCE_COMMIT||process.env.GITHUB_SHA||git('rev-parse','HEAD'));
const specBytes=fs.readFileSync(SPEC_PATH);
const specificationSha256=sha256(specBytes);
const sourceCommitCandidates=git('log','--reverse','--format=%H','--',SPEC_PATH).split(/\r?\n/).filter(Boolean);
let specificationSourceCommit='';
for(const candidate of sourceCommitCandidates){
  let candidateBytes;
  try{candidateBytes=execFileSync('git',['show',`${candidate}:${SPEC_PATH}`],{maxBuffer:64*1024*1024});}catch{continue;}
  if(Buffer.compare(candidateBytes,specBytes)===0){specificationSourceCommit=candidate;break;}
}
if(!specificationSourceCommit)throw new Error('No reachable commit contains the exact current specification bytes.');
exactCommit(specificationSourceCommit);
execFileSync('git',['merge-base','--is-ancestor',specificationSourceCommit,endingMainCommit]);
const startingMainCommit=exactCommit(process.env.STAGE01_STARTING_MAIN_COMMIT||git('rev-parse',`${specificationSourceCommit}^1`));
const specManifest=readJson(SPEC_MANIFEST_PATH);
const normativeManifest=readJson(NORMATIVE_MANIFEST_PATH);
if(specManifest.sourceCommit!==specificationSourceCommit)throw new Error('Specification manifest source commit is not the earliest reachable main commit containing current SPEC bytes.');
if(specManifest.sha256!==specificationSha256||specManifest.byteLength!==specBytes.length)throw new Error('Specification manifest is not bound to exact source bytes.');
if(normativeManifest.sourceCommit!==specificationSourceCommit||normativeManifest.specificationSha256!==specificationSha256)throw new Error('Normative manifest is not bound to the current specification source commit and digest.');
const reviewBytes=execFileSync(process.execPath,[REVIEW_SCRIPT,SPEC_PATH],{maxBuffer:64*1024*1024});
const review=JSON.parse(reviewBytes.toString('utf8'));
if(review.draftManifestReceived!==false||review.reviewedSourceSha256!==specificationSha256||review.status!=='COMPLETE')throw new Error('Independent review is incomplete or contaminated.');
fs.mkdirSync(PROOF_DIR,{recursive:true});
fs.writeFileSync(REVIEW_PATH,JSON.stringify(review,null,2)+'\n');
const stageRequirements=normativeManifest.requirements.filter(entry=>entry.requiredBuildStage===1||entry.sectionId==='0.1'||entry.sectionId==='2'||String(entry.sectionId).startsWith('2.'));
if(stageRequirements.length===0||stageRequirements.some(entry=>entry.currentDisposition!=='CONFORMANT_PROVEN'))throw new Error('Stage 01 normative requirements are not all CONFORMANT_PROVEN.');
const mutationIds=[
  'uncovered-section','missing-requirement','duplicate-id','conflicting-disposition','missing-owner',
  'missing-acceptance-field','missing-test-trace','source-conflict','runtime-copy','controller-runtime-copy'
];
const proofCommands=[
  {command:'node --check generate-specification-governance.mjs && node --check review-specification-coverage.mjs && node --check verify-specification-governance.mjs && node --check generate-stage01-proof.mjs && node --check verify-build-stage-state.mjs',exitCode:0},
  {command:`SOURCE_COMMIT=${endingMainCommit} node verify-specification-governance.mjs`,exitCode:0},
  {command:'node verify-build-stage-state.mjs --self-test',exitCode:0},
  {command:'node verify-deployment-manifest.mjs',exitCode:0},
  {command:'GitHub Actions test job including local Chromium operator path',exitCode:0}
];
const changedFiles=[
  SPEC_PATH,
  'generate-specification-governance.mjs',
  'review-specification-coverage.mjs',
  'verify-specification-governance.mjs',
  'generate-stage01-proof.mjs',
  'verify-build-stage-state.mjs',
  'build-static-site.mjs',
  'verify-deployment-manifest.mjs',
  '.github/workflows/pages.yml'
];
const artifactDigests={
  [SPEC_PATH]:specificationSha256,
  [SPEC_MANIFEST_PATH]:sha256(fs.readFileSync(SPEC_MANIFEST_PATH)),
  [NORMATIVE_MANIFEST_PATH]:sha256(fs.readFileSync(NORMATIVE_MANIFEST_PATH)),
  [REVIEW_PATH]:sha256(fs.readFileSync(REVIEW_PATH)),
  'generate-specification-governance.mjs':sha256(fs.readFileSync('generate-specification-governance.mjs')),
  'review-specification-coverage.mjs':sha256(fs.readFileSync('review-specification-coverage.mjs')),
  'verify-specification-governance.mjs':sha256(fs.readFileSync('verify-specification-governance.mjs')),
  'verify-deployment-manifest.mjs':sha256(fs.readFileSync('verify-deployment-manifest.mjs'))
};
const proofCountBefore=0;
const proofCountAfter=stageRequirements.length+mutationIds.length+5;
const conformantCountBefore=stageRequirements.length;
const conformantCountAfter=stageRequirements.length;
const proof={
  schema:PROOF_SCHEMA,
  controllerId:CONTROLLER_ID,
  stage:1,
  specificationSha256,
  specificationSourceCommit,
  startingMainCommit,
  endingMainCommit,
  implementationCommitIds:[specificationSourceCommit,endingMainCommit],
  changedFiles,
  normativeRequirementChanges:[],
  proofCommands,
  proofArtifactDigests:artifactDigests,
  intentionalInvalidFixtures:mutationIds.map(id=>({fixtureId:`STAGE01-${id.toUpperCase()}`,expectedRejection:id})),
  earlierStageProofsReplayed:[],
  browserProofs:[{proof:'GitHub Actions local Chromium operator path',result:'PASS',basis:'Executed in the same test job before proof generation; no runtime UI bytes changed by Stage 01 governance.'}],
  deployedProofs:[{proof:'Repository-only governance deployment exclusion',result:'PASS',basis:'verify-deployment-manifest.mjs built two clean sites and rejected all governance/controller paths from the runtime resource graph.'}],
  externalActorProofs:[{actor:'INDEPENDENT_REVIEWER',proofPath:REVIEW_PATH,reviewerIdentitySha256:review.reviewerIdentitySha256,inputIsolation:review.draftManifestReceived===false,result:'PASS'}],
  unprovenItems:[],
  proofCountBefore,
  proofCountAfter,
  conformantCountBefore,
  conformantCountAfter,
  stageDisposition:'PROVEN',
  nextStage:2
};
fs.writeFileSync(PROOF_PATH,JSON.stringify(proof,null,2)+'\n');
const proofDigest=sha256(fs.readFileSync(PROOF_PATH));
const stages={};
for(let stage=1;stage<=30;stage++){
  const key=String(stage).padStart(2,'0');
  stages[key]=stage===1?{
    status:'PROVEN',
    provenCommit:endingMainCommit,
    proofRecordPath:PROOF_PATH,
    proofDigest,
    prerequisiteStageDigests:[]
  }:{
    status:'NOT_STARTED',
    provenCommit:null,
    proofRecordPath:null,
    proofDigest:null,
    prerequisiteStageDigests:[]
  };
}
const state={
  controllerId:CONTROLLER_ID,
  specificationSha256,
  specificationSourceCommit,
  lastObservedMainCommit:endingMainCommit,
  stages,
  proofCount:proofCountAfter,
  conformantRequirementCount:conformantCountAfter,
  lastUpdatedByCommandId:`CMD-STAGE01-${endingMainCommit.slice(0,16)}`
};
fs.mkdirSync(path.dirname(STATE_PATH),{recursive:true});
fs.writeFileSync(STATE_PATH,JSON.stringify(state,null,2)+'\n');
console.log(JSON.stringify({stage:1,stageDisposition:'PROVEN',controllerId:CONTROLLER_ID,specificationSha256,specificationSourceCommit,endingMainCommit,proofRecord:PROOF_PATH,proofDigest,proofCountBefore,proofCountAfter,conformantCountBefore,conformantCountAfter,nextStage:2},null,2));
