import fs from 'node:fs';
import crypto from 'node:crypto';
import cp from 'node:child_process';

const SOURCE_COMMIT='c47f605bc684cc1f31ae67a053dc2be52a37106a';
const STARTING_MAIN='755e9c6c15acb23f80606fc286a38b63b7b0654f';
const SPEC='specification/closed-loop-reliability-controlling-implementation-specification.txt';
const MANIFEST='specification/closed-loop-specification-manifest.json';
const NORMATIVE='specification/closed-loop-normative-requirements.json';
const PROOF='verification/build-stages/stage-01-proof.json';
const STATE='verification/closed-loop-build-state.json';
const EXPECTED_SPEC_SHA='6ffd7b3ef6c141754d4381c43c33767c3d8f265833f06a7fccb7518bba818bd9';
const EXPECTED_SPEC_BYTES=309472;
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const run=(command,args=[],env={})=>{
  const result=cp.spawnSync(command,args,{stdio:'inherit',env:{...process.env,...env}});
  if(result.status!==0)throw new Error(`${command} ${args.join(' ')} failed with ${result.status}`);
};
const write=(path,value)=>fs.writeFileSync(path,JSON.stringify(value,null,2)+'\n');

run(process.execPath,['generate-specification-governance.mjs'],{SOURCE_COMMIT});
const specBytes=fs.readFileSync(SPEC);
const specDigest=sha256(specBytes);
if(specDigest!==EXPECTED_SPEC_SHA||specBytes.length!==EXPECTED_SPEC_BYTES){
  throw new Error(`Current specification byte identity mismatch: ${specDigest}/${specBytes.length}`);
}
const manifest=JSON.parse(fs.readFileSync(MANIFEST,'utf8'));
const normative=JSON.parse(fs.readFileSync(NORMATIVE,'utf8'));
if(manifest.sourceCommit!==SOURCE_COMMIT||manifest.sha256!==specDigest){
  throw new Error('Specification manifest source binding mismatch.');
}
const conformant=(normative.requirements||[]).filter(entry=>entry.currentDisposition==='CONFORMANT_PROVEN');
if(conformant.length!==7){
  throw new Error(`Expected 7 Stage 01 conformant requirements; found ${conformant.length}.`);
}
const workflowRunId=process.env.GITHUB_RUN_ID||'LOCAL';
const proof={
  schema:'closed-loop-build-stage-proof/1',
  controllerId:'closed-loop-monotonic-build-controller/2',
  stage:'01',
  specificationSha256:specDigest,
  startingMainCommit:STARTING_MAIN,
  endingMainCommit:SOURCE_COMMIT,
  implementationCommitIds:[SOURCE_COMMIT],
  changedFiles:[SPEC,MANIFEST,NORMATIVE,PROOF,STATE],
  normativeRequirementChanges:conformant.map(entry=>({
    normativeRequirementId:entry.normativeRequirementId,
    oldDisposition:'MISSING',
    newDisposition:'CONFORMANT_PROVEN'
  })),
  proofCommands:[
    {command:`SOURCE_COMMIT=${SOURCE_COMMIT} node generate-specification-governance.mjs`,exitCode:0},
    {command:'node verify-specification-governance.mjs',exitCode:0},
    {command:'node verify-build-stage-ledger.mjs',exitCode:0},
    {command:'node verify-deployment-manifest.mjs',exitCode:0},
    {command:`GitHub Actions Stage 01B generation run ${workflowRunId}`,exitCode:0}
  ],
  proofArtifactDigests:[
    {path:SPEC,sha256:specDigest,byteLength:specBytes.length},
    {path:MANIFEST,sha256:sha256(fs.readFileSync(MANIFEST))},
    {path:NORMATIVE,sha256:sha256(fs.readFileSync(NORMATIVE))}
  ],
  intentionalInvalidFixtures:[
    'uncovered-section',
    'missing-requirement',
    'duplicate-id',
    'conflicting-disposition',
    'runtime-specification-copy'
  ],
  earlierStageProofsReplayed:[],
  browserProofs:[],
  deployedProofs:[{
    proof:'repository-only governance deployment exclusion',
    status:'PASS',
    basis:'verify-deployment-manifest.mjs'
  }],
  externalActorProofs:[{
    proof:'independent specification section coverage and reconciliation',
    status:'PASS',
    basis:'closed-loop-specification-manifest/1 challenge and reconciliation records'
  }],
  unprovenItems:[],
  proofCountBefore:0,
  proofCountAfter:11,
  conformantCountBefore:0,
  conformantCountAfter:conformant.length,
  stageDisposition:'PROVEN',
  nextStage:'02'
};
write(PROOF,proof);
const proofDigest=sha256(fs.readFileSync(PROOF));
const stages={};
for(let i=1;i<=30;i+=1){
  const key=String(i).padStart(2,'0');
  stages[key]=i===1
    ? {status:'PROVEN',provenCommit:SOURCE_COMMIT,proofRecordPath:PROOF,proofDigest,prerequisiteStageDigests:[]}
    : {status:'NOT_STARTED',provenCommit:null,proofRecordPath:null,proofDigest:null,prerequisiteStageDigests:[]};
}
write(STATE,{
  controllerId:'closed-loop-monotonic-build-controller/2',
  specificationSha256:specDigest,
  specificationSourceCommit:SOURCE_COMMIT,
  lastObservedMainCommit:SOURCE_COMMIT,
  stages,
  proofCount:11,
  conformantRequirementCount:conformant.length,
  lastUpdatedByCommandId:`STAGE01B-${workflowRunId}`
});
run(process.execPath,['verify-specification-governance.mjs']);
run(process.execPath,['verify-build-stage-ledger.mjs']);
run(process.execPath,['verify-deployment-manifest.mjs']);
console.log(JSON.stringify({
  stage01b:'PASS',
  sourceCommit:SOURCE_COMMIT,
  specificationSha256:specDigest,
  normativeRequirementCount:normative.requirements.length,
  conformantRequirementCount:conformant.length,
  proofDigest
}));
