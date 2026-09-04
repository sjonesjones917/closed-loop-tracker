import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const CONTROLLER_ID='closed-loop-monotonic-build-controller/2';
const PROOF_SCHEMA='closed-loop-build-stage-proof/1';
const SPEC_PATH='specification/closed-loop-reliability-controlling-implementation-specification.txt';
const STATE_PATH='verification/closed-loop-build-state.json';
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const exactCommit=value=>/^[0-9a-f]{40}$/.test(String(value||''));
const clone=value=>structuredClone(value);

function validateProof(proof,{specificationSha256,currentCommit,allowDescendant=false}={}){
  assert(proof&&typeof proof==='object'&&!Array.isArray(proof),'Stage proof root must be an object.');
  assert(proof.schema===PROOF_SCHEMA,'Wrong stage proof schema.');
  assert(proof.controllerId===CONTROLLER_ID,'Wrong controller identity.');
  assert(Number.isInteger(proof.stage)&&proof.stage>=1&&proof.stage<=30,'Invalid proof stage.');
  assert(proof.specificationSha256===specificationSha256,'Stage proof specification digest mismatch.');
  assert(exactCommit(proof.specificationSourceCommit),'Invalid specification source commit.');
  assert(exactCommit(proof.startingMainCommit)&&exactCommit(proof.endingMainCommit),'Invalid stage commit binding.');
  assert(Array.isArray(proof.implementationCommitIds)&&proof.implementationCommitIds.length>0&&proof.implementationCommitIds.every(exactCommit),'Invalid implementation commit list.');
  assert(Array.isArray(proof.changedFiles)&&proof.changedFiles.length>0,'Changed-file ledger is empty.');
  assert(Array.isArray(proof.normativeRequirementChanges),'Normative disposition-change ledger is missing.');
  assert(Array.isArray(proof.proofCommands)&&proof.proofCommands.length>0&&proof.proofCommands.every(item=>typeof item.command==='string'&&item.command&&item.exitCode===0),'Proof commands must identify exact successful commands.');
  assert(proof.proofArtifactDigests&&typeof proof.proofArtifactDigests==='object','Proof artifact digests are missing.');
  assert(Array.isArray(proof.intentionalInvalidFixtures)&&proof.intentionalInvalidFixtures.length>0,'Intentional invalid fixtures are missing.');
  assert(Array.isArray(proof.earlierStageProofsReplayed)&&Array.isArray(proof.browserProofs)&&Array.isArray(proof.deployedProofs)&&Array.isArray(proof.externalActorProofs),'Required proof arrays are missing.');
  assert(Array.isArray(proof.unprovenItems)&&proof.unprovenItems.length===0,'A PROVEN stage cannot contain unproven items.');
  assert(Number.isInteger(proof.proofCountBefore)&&Number.isInteger(proof.proofCountAfter)&&proof.proofCountAfter>=proof.proofCountBefore,'Proof count ratchet failed.');
  assert(Number.isInteger(proof.conformantCountBefore)&&Number.isInteger(proof.conformantCountAfter)&&proof.conformantCountAfter>=proof.conformantCountBefore,'Conformant-count ratchet failed.');
  assert(proof.stageDisposition==='PROVEN','Stage disposition is not PROVEN.');
  assert(proof.nextStage===(proof.stage===30?null:proof.stage+1),'Next stage is not exactly one stage later.');
  if(currentCommit){
    assert(exactCommit(currentCommit),'Current commit is invalid.');
    if(proof.endingMainCommit!==currentCommit){
      assert(allowDescendant,'Stage proof does not bind the exact current commit.');
      execFileSync('git',['merge-base','--is-ancestor',proof.endingMainCommit,currentCommit]);
    }
  }
  return true;
}

function validateState(state,{specificationSha256,currentCommit,allowDescendant=false}={}){
  assert(state&&typeof state==='object'&&!Array.isArray(state),'Build state root must be an object.');
  assert(state.controllerId===CONTROLLER_ID,'Build state controller identity mismatch.');
  assert(state.specificationSha256===specificationSha256,'Build state specification digest mismatch.');
  assert(exactCommit(state.specificationSourceCommit),'Invalid build-state specification source commit.');
  assert(exactCommit(state.lastObservedMainCommit),'Invalid build-state main commit.');
  assert(state.stages&&Object.keys(state.stages).length===30,'Build state must contain exactly 30 stages.');
  for(let stage=1;stage<=30;stage++){
    const key=String(stage).padStart(2,'0');
    const record=state.stages[key];
    assert(record,`Missing build stage ${key}.`);
    assert(['NOT_STARTED','IN_PROGRESS','WAITING_FOR_REQUIRED_ACTOR','PROVEN','REGRESSED'].includes(record.status),`Invalid status for stage ${key}.`);
    if(record.status==='PROVEN'){
      assert(exactCommit(record.provenCommit),`Stage ${key} has invalid proven commit.`);
      assert(typeof record.proofRecordPath==='string'&&record.proofRecordPath,`Stage ${key} proof path is missing.`);
      assert(/^[0-9a-f]{64}$/.test(String(record.proofDigest||'')),`Stage ${key} proof digest is missing.`);
    }else{
      assert(record.provenCommit===null&&record.proofRecordPath===null&&record.proofDigest===null,`Non-PROVEN stage ${key} carries authoritative proof data.`);
    }
    assert(Array.isArray(record.prerequisiteStageDigests),`Stage ${key} prerequisite digests are missing.`);
  }
  assert(Number.isInteger(state.proofCount)&&state.proofCount>=0,'Build-state proof count is invalid.');
  assert(Number.isInteger(state.conformantRequirementCount)&&state.conformantRequirementCount>=0,'Build-state conformant count is invalid.');
  assert(typeof state.lastUpdatedByCommandId==='string'&&state.lastUpdatedByCommandId,'Build-state command identity is missing.');
  if(currentCommit&&state.lastObservedMainCommit!==currentCommit){
    assert(allowDescendant,'Build state does not bind exact current main.');
    execFileSync('git',['merge-base','--is-ancestor',state.lastObservedMainCommit,currentCommit]);
  }
  return true;
}

function selfTest(){
  const commit='1'.repeat(40),spec='2'.repeat(64),proof={schema:PROOF_SCHEMA,controllerId:CONTROLLER_ID,stage:1,specificationSha256:spec,specificationSourceCommit:commit,startingMainCommit:commit,endingMainCommit:commit,implementationCommitIds:[commit],changedFiles:['x'],normativeRequirementChanges:[],proofCommands:[{command:'x',exitCode:0}],proofArtifactDigests:{x:'3'.repeat(64)},intentionalInvalidFixtures:[{fixtureId:'bad',expectedRejection:'reject'}],earlierStageProofsReplayed:[],browserProofs:[],deployedProofs:[],externalActorProofs:[],unprovenItems:[],proofCountBefore:0,proofCountAfter:1,conformantCountBefore:0,conformantCountAfter:1,stageDisposition:'PROVEN',nextStage:2};
  const stages={};for(let i=1;i<=30;i++){const k=String(i).padStart(2,'0');stages[k]=i===1?{status:'PROVEN',provenCommit:commit,proofRecordPath:'verification/build-stages/stage-01-proof.json',proofDigest:'4'.repeat(64),prerequisiteStageDigests:[]}:{status:'NOT_STARTED',provenCommit:null,proofRecordPath:null,proofDigest:null,prerequisiteStageDigests:[]};}
  const state={controllerId:CONTROLLER_ID,specificationSha256:spec,specificationSourceCommit:commit,lastObservedMainCommit:commit,stages,proofCount:1,conformantRequirementCount:1,lastUpdatedByCommandId:'CMD'};
  validateProof(proof,{specificationSha256:spec,currentCommit:commit});validateState(state,{specificationSha256:spec,currentCommit:commit});
  const mutations=[
    ['wrong-controller',p=>p.controllerId='bad',/controller/i],
    ['stale-spec',p=>p.specificationSha256='0'.repeat(64),/specification digest/i],
    ['proof-ratchet',p=>p.proofCountAfter=-1,/Proof count ratchet/i],
    ['conformant-ratchet',p=>p.conformantCountAfter=-1,/Conformant-count ratchet/i],
    ['unproven-item',p=>p.unprovenItems.push('x'),/unproven items/i],
    ['failed-command',p=>p.proofCommands[0].exitCode=1,/successful commands/i]
  ];
  for(const [name,edit,pattern] of mutations){const invalid=clone(proof);edit(invalid);let error;try{validateProof(invalid,{specificationSha256:spec,currentCommit:commit});}catch(value){error=value;}assert(error&&pattern.test(String(error.message)),`${name} proof mutation was not rejected for the correct reason.`);}
  const stateMutations=[
    ['missing-stage',s=>delete s.stages['30'],/exactly 30 stages/i],
    ['proven-without-proof',s=>s.stages['01'].proofRecordPath='',/proof path/i],
    ['not-started-with-proof',s=>{s.stages['02'].proofDigest='4'.repeat(64);},/Non-PROVEN stage/i],
    ['wrong-state-controller',s=>s.controllerId='bad',/controller identity/i]
  ];
  for(const [name,edit,pattern] of stateMutations){const invalid=clone(state);edit(invalid);let error;try{validateState(invalid,{specificationSha256:spec,currentCommit:commit});}catch(value){error=value;}assert(error&&pattern.test(String(error.message)),`${name} build-state mutation was not rejected for the correct reason.`);}
  console.log(JSON.stringify({buildStageStateSelfTest:'PASS',proofMutations:mutations.length,stateMutations:stateMutations.length,totalMutations:mutations.length+stateMutations.length},null,2));
}

if(process.argv.includes('--self-test')){
  selfTest();
}else{
  const requiredIndex=process.argv.indexOf('--require-stage');
  const requiredStage=requiredIndex>=0?Number(process.argv[requiredIndex+1]):1;
  assert(Number.isInteger(requiredStage)&&requiredStage>=1&&requiredStage<=30,'Invalid required stage.');
  const specDigest=sha256(fs.readFileSync(SPEC_PATH));
  const currentCommit=process.env.SOURCE_COMMIT||process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const state=JSON.parse(fs.readFileSync(STATE_PATH,'utf8'));
  validateState(state,{specificationSha256:specDigest,currentCommit});
  for(let stage=1;stage<=requiredStage;stage++){
    const key=String(stage).padStart(2,'0');
    const record=state.stages[key];
    assert(record.status==='PROVEN',`Required stage ${key} is not PROVEN.`);
    const bytes=fs.readFileSync(record.proofRecordPath);
    assert(sha256(bytes)===record.proofDigest,`Stage ${key} proof digest mismatch.`);
    const proof=JSON.parse(bytes.toString('utf8'));
    validateProof(proof,{specificationSha256:specDigest,currentCommit:record.provenCommit});
    for(const [artifact,digest] of Object.entries(proof.proofArtifactDigests)){
      assert(fs.existsSync(artifact),`Proof artifact is missing: ${artifact}`);
      assert(sha256(fs.readFileSync(artifact))===digest,`Proof artifact digest mismatch: ${artifact}`);
    }
  }
  const firstIncomplete=Object.entries(state.stages).find(([,value])=>value.status!=='PROVEN')?.[0]||null;
  console.log(JSON.stringify({buildStageState:'PASS',controllerId:CONTROLLER_ID,requiredStage,currentCommit,specificationSha256:specDigest,firstIncompleteStage:firstIncomplete,proofCount:state.proofCount,conformantRequirementCount:state.conformantRequirementCount},null,2));
}
