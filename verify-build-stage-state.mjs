import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const CONTROLLER_ID='closed-loop-monotonic-build-controller/2';
const PROOF_SCHEMA='closed-loop-build-stage-proof/1';
const SPEC_PATH='specification/closed-loop-reliability-controlling-implementation-specification.txt';
const STATE_PATH='verification/closed-loop-build-state.json';
const STATUS=new Set(['NOT_STARTED','IN_PROGRESS','WAITING_FOR_REQUIRED_ACTOR','PROVEN','REGRESSED']);
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const exactCommit=value=>/^[0-9a-f]{40}$/.test(String(value||''));
const exactDigest=value=>/^[0-9a-f]{64}$/.test(String(value||''));
const proofPath=stage=>`verification/build-stages/stage-${String(stage).padStart(2,'0')}-proof.json`;
const clone=value=>structuredClone(value);
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();

function isAncestor(ancestor,descendant){
  if(ancestor===descendant)return true;
  try{execFileSync('git',['merge-base','--is-ancestor',ancestor,descendant],{stdio:'ignore'});return true;}catch{return false;}
}

export function validateProof(proof,{specificationSha256,currentCommit,allowAncestor=true,expectedPrerequisiteDigests=[]}={}){
  assert(proof&&typeof proof==='object'&&!Array.isArray(proof),'Stage proof root must be an object.');
  assert(proof.schema===PROOF_SCHEMA,'Wrong stage proof schema.');
  assert(proof.controllerId===CONTROLLER_ID,'Wrong controller identity.');
  assert(Number.isInteger(proof.stage)&&proof.stage>=1&&proof.stage<=30,'Invalid proof stage.');
  assert(proof.specificationSha256===specificationSha256,'Stage proof specification digest mismatch.');
  assert(exactCommit(proof.specificationSourceCommit),'Invalid specification source commit.');
  assert(exactCommit(proof.startingMainCommit)&&exactCommit(proof.endingMainCommit),'Invalid stage commit binding.');
  assert(Array.isArray(proof.implementationCommitIds)&&proof.implementationCommitIds.length>0&&proof.implementationCommitIds.every(exactCommit),'Invalid implementation commit list.');
  assert(Array.isArray(proof.changedFiles),'Changed-file ledger is missing.');
  assert(Array.isArray(proof.normativeRequirementChanges),'Normative disposition-change ledger is missing.');
  assert(Array.isArray(proof.proofCommands)&&proof.proofCommands.length>0&&proof.proofCommands.every(item=>typeof item.command==='string'&&item.command.length>0&&Number.isInteger(item.exitCode)),'Proof commands are incomplete.');
  assert(proof.proofCommands.every(item=>item.exitCode===0),'A PROVEN stage contains a failed proof command.');
  assert(proof.proofArtifactDigests&&typeof proof.proofArtifactDigests==='object'&&!Array.isArray(proof.proofArtifactDigests),'Proof artifact digests are missing.');
  for(const [artifact,digest] of Object.entries(proof.proofArtifactDigests))assert(typeof artifact==='string'&&artifact&&exactDigest(digest),`Invalid proof artifact digest: ${artifact}`);
  assert(Array.isArray(proof.intentionalInvalidFixtures)&&proof.intentionalInvalidFixtures.length>0,'Intentional invalid fixtures are missing.');
  assert(proof.intentionalInvalidFixtures.every(item=>item&&typeof item.fixtureId==='string'&&item.fixtureId&&typeof item.expectedRejection==='string'&&item.expectedRejection),'Intentional invalid fixture contract is incomplete.');
  assert(Array.isArray(proof.earlierStageProofsReplayed)&&Array.isArray(proof.browserProofs)&&Array.isArray(proof.deployedProofs)&&Array.isArray(proof.externalActorProofs),'Required proof arrays are missing.');
  assert(Array.isArray(proof.unprovenItems)&&proof.unprovenItems.length===0,'A PROVEN stage cannot contain unproven items.');
  assert(Number.isInteger(proof.proofCountBefore)&&Number.isInteger(proof.proofCountAfter)&&proof.proofCountAfter>=proof.proofCountBefore,'Proof count ratchet failed.');
  assert(Number.isInteger(proof.conformantCountBefore)&&Number.isInteger(proof.conformantCountAfter)&&proof.conformantCountAfter>=proof.conformantCountBefore,'Conformant-count ratchet failed.');
  assert(proof.stageDisposition==='PROVEN','Stage disposition is not PROVEN.');
  assert(proof.nextStage===(proof.stage===30?null:proof.stage+1),'Next stage is not exactly one stage later.');
  assert(Array.isArray(proof.prerequisiteStageDigests),'Proof prerequisite digest ledger is missing.');
  assert(JSON.stringify(proof.prerequisiteStageDigests)===JSON.stringify(expectedPrerequisiteDigests),'Proof prerequisite digests do not match all earlier stage proofs.');
  if(currentCommit){
    assert(exactCommit(currentCommit),'Current commit is invalid.');
    assert(proof.endingMainCommit===currentCommit||(allowAncestor&&isAncestor(proof.endingMainCommit,currentCommit)),'Stage proof is not bound to the current canonical lineage.');
  }
  return true;
}

export function validateState(state,{specificationSha256,currentCommit,verifyArtifacts=true}={}){
  assert(state&&typeof state==='object'&&!Array.isArray(state),'Build state root must be an object.');
  assert(state.controllerId===CONTROLLER_ID,'Build state controller identity mismatch.');
  assert(state.specificationSha256===specificationSha256,'Build state specification digest mismatch.');
  assert(exactCommit(state.specificationSourceCommit),'Invalid build-state specification source commit.');
  assert(exactCommit(state.lastObservedMainCommit),'Invalid build-state main commit.');
  if(currentCommit)assert(state.lastObservedMainCommit===currentCommit||isAncestor(state.lastObservedMainCommit,currentCommit),'Build state is not on the current canonical lineage.');
  assert(state.stages&&typeof state.stages==='object'&&Object.keys(state.stages).length===30,'Build state must contain exactly 30 stages.');
  let firstNonProven=null;
  let previousProofCount=0;
  let previousConformantCount=0;
  const priorDigests=[];
  for(let stage=1;stage<=30;stage++){
    const key=String(stage).padStart(2,'0');
    const record=state.stages[key];
    assert(record&&typeof record==='object',`Missing build stage ${key}.`);
    assert(STATUS.has(record.status),`Invalid status for stage ${key}.`);
    assert(record.proofRecordPath===proofPath(stage),`Stage ${key} has the wrong proof path.`);
    assert(Array.isArray(record.prerequisiteStageDigests),`Stage ${key} prerequisite digests are missing.`);
    if(record.status==='PROVEN'){
      assert(firstNonProven===null,`Stage ${key} is PROVEN after an earlier non-PROVEN stage.`);
      assert(exactCommit(record.provenCommit),`Stage ${key} has invalid proven commit.`);
      assert(exactDigest(record.proofDigest),`Stage ${key} proof digest is missing.`);
      assert(JSON.stringify(record.prerequisiteStageDigests)===JSON.stringify(priorDigests),`Stage ${key} prerequisite digests are incomplete or out of order.`);
      if(verifyArtifacts){
        assert(fs.existsSync(record.proofRecordPath),`Stage ${key} proof record is missing.`);
        const bytes=fs.readFileSync(record.proofRecordPath);
        assert(sha256(bytes)===record.proofDigest,`Stage ${key} proof digest mismatch.`);
        const proof=JSON.parse(bytes.toString('utf8'));
        assert(proof.stage===stage,`Stage ${key} proof file contains a different stage.`);
        validateProof(proof,{specificationSha256,currentCommit:record.provenCommit,expectedPrerequisiteDigests:priorDigests});
        for(const [artifact,digest] of Object.entries(proof.proofArtifactDigests)){
          assert(fs.existsSync(artifact),`Stage ${key} proof artifact is missing: ${artifact}`);
          assert(sha256(fs.readFileSync(artifact))===digest,`Stage ${key} proof artifact digest mismatch: ${artifact}`);
        }
        assert(proof.proofCountBefore===previousProofCount,`Stage ${key} proof count does not continue the ratchet.`);
        assert(proof.conformantCountBefore===previousConformantCount,`Stage ${key} conformant count does not continue the ratchet.`);
        previousProofCount=proof.proofCountAfter;
        previousConformantCount=proof.conformantCountAfter;
      }
      priorDigests.push(record.proofDigest);
    }else{
      if(firstNonProven===null)firstNonProven=key;
      assert(record.provenCommit===null,`Non-PROVEN stage ${key} carries a proven commit.`);
      assert(record.proofDigest===null,`Non-PROVEN stage ${key} carries a proof digest.`);
      assert(record.prerequisiteStageDigests.length===0||JSON.stringify(record.prerequisiteStageDigests)===JSON.stringify(priorDigests),`Stage ${key} carries invalid prerequisite digests.`);
    }
  }
  assert(Number.isInteger(state.proofCount)&&state.proofCount>=0,'Build-state proof count is invalid.');
  assert(Number.isInteger(state.conformantRequirementCount)&&state.conformantRequirementCount>=0,'Build-state conformant count is invalid.');
  if(verifyArtifacts){
    assert(state.proofCount===previousProofCount,'Build-state proof count does not equal the last proven stage.');
    assert(state.conformantRequirementCount===previousConformantCount,'Build-state conformant count does not equal the last proven stage.');
  }
  assert(typeof state.lastUpdatedByCommandId==='string'&&state.lastUpdatedByCommandId,'Build-state command identity is missing.');
  return {firstNonProvenStage:firstNonProven,proofCount:state.proofCount,conformantRequirementCount:state.conformantRequirementCount};
}

function selfTest(){
  const commit='1'.repeat(40),spec='2'.repeat(64),digest='3'.repeat(64);
  const proof={schema:PROOF_SCHEMA,controllerId:CONTROLLER_ID,stage:1,specificationSha256:spec,specificationSourceCommit:commit,startingMainCommit:commit,endingMainCommit:commit,implementationCommitIds:[commit],changedFiles:['x'],normativeRequirementChanges:[],proofCommands:[{command:'x',exitCode:0}],proofArtifactDigests:{x:digest},intentionalInvalidFixtures:[{fixtureId:'bad',expectedRejection:'reject'}],earlierStageProofsReplayed:[],browserProofs:[],deployedProofs:[],externalActorProofs:[],unprovenItems:[],proofCountBefore:0,proofCountAfter:1,conformantCountBefore:0,conformantCountAfter:1,stageDisposition:'PROVEN',nextStage:2,prerequisiteStageDigests:[]};
  validateProof(proof,{specificationSha256:spec,currentCommit:commit,expectedPrerequisiteDigests:[]});
  const mutations=[['wrong-controller',p=>p.controllerId='bad',/controller/i],['stale-spec',p=>p.specificationSha256='0'.repeat(64),/specification digest/i],['proof-ratchet',p=>p.proofCountAfter=-1,/Proof count ratchet/i],['conformant-ratchet',p=>p.conformantCountAfter=-1,/Conformant-count ratchet/i],['unproven-item',p=>p.unprovenItems.push('x'),/unproven items/i],['failed-command',p=>p.proofCommands[0].exitCode=1,/failed proof command/i],['missing-fixture',p=>p.intentionalInvalidFixtures=[],/invalid fixtures/i],['wrong-prerequisite',p=>p.prerequisiteStageDigests=['4'.repeat(64)],/prerequisite/i]];
  for(const [name,edit,pattern] of mutations){const invalid=clone(proof);edit(invalid);let error;try{validateProof(invalid,{specificationSha256:spec,currentCommit:commit,expectedPrerequisiteDigests:[]});}catch(value){error=value;}assert(error&&pattern.test(String(error.message)),`${name} proof mutation was not rejected for the correct reason: ${error?.message||'accepted'}`);}
  const stages={};for(let i=1;i<=30;i++){const key=String(i).padStart(2,'0');stages[key]={status:'NOT_STARTED',provenCommit:null,proofRecordPath:proofPath(i),proofDigest:null,prerequisiteStageDigests:[]};}
  const state={controllerId:CONTROLLER_ID,specificationSha256:spec,specificationSourceCommit:commit,lastObservedMainCommit:commit,stages,proofCount:0,conformantRequirementCount:0,lastUpdatedByCommandId:'CMD'};
  validateState(state,{specificationSha256:spec,currentCommit:commit,verifyArtifacts:false});
  const stateMutations=[['missing-stage',s=>delete s.stages['30'],/exactly 30 stages/i],['not-started-with-proof',s=>s.stages['02'].proofDigest='4'.repeat(64),/proof digest/i],['wrong-state-controller',s=>s.controllerId='bad',/controller identity/i],['wrong-path',s=>s.stages['01'].proofRecordPath='x',/wrong proof path/i]];
  for(const [name,edit,pattern] of stateMutations){const invalid=clone(state);edit(invalid);let error;try{validateState(invalid,{specificationSha256:spec,currentCommit:commit,verifyArtifacts:false});}catch(value){error=value;}assert(error&&pattern.test(String(error.message)),`${name} build-state mutation was not rejected for the correct reason: ${error?.message||'accepted'}`);}
  console.log(JSON.stringify({buildStageStateSelfTest:'PASS',proofMutations:mutations.length,stateMutations:stateMutations.length,totalMutations:mutations.length+stateMutations.length},null,2));
}

if(process.argv.includes('--self-test'))selfTest();else{
  const specDigest=sha256(fs.readFileSync(SPEC_PATH));
  const currentCommit=process.env.GITHUB_SHA||process.env.SOURCE_COMMIT||git('rev-parse','HEAD');
  const state=JSON.parse(fs.readFileSync(STATE_PATH,'utf8'));
  const result=validateState(state,{specificationSha256:specDigest,currentCommit,verifyArtifacts:true});
  const requiredIndex=process.argv.indexOf('--require-stage');
  if(requiredIndex>=0){const requiredStage=Number(process.argv[requiredIndex+1]);assert(Number.isInteger(requiredStage)&&requiredStage>=1&&requiredStage<=30,'Invalid required stage.');for(let stage=1;stage<=requiredStage;stage++)assert(state.stages[String(stage).padStart(2,'0')].status==='PROVEN',`Required stage ${String(stage).padStart(2,'0')} is not PROVEN.`);}
  console.log(JSON.stringify({buildStageState:'PASS',controllerId:CONTROLLER_ID,currentCommit,specificationSha256:specDigest,...result},null,2));
}
