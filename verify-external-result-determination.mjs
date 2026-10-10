import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {routingFixture} from './test-verification-routing-fixtures.mjs';
import {recordProposal,evidence} from './test-fixtures.mjs';

// This fault is the exact former favorable fallback after the four external
// result branches. It is loaded in an isolated VM; repository source is intact.
const source=fs.readFileSync('workflow-engine.js','utf8');
const guard="  const completionPolicy=schema.EXTERNAL_RESULT_COMPLETION_POLICY;\n  if(completionPolicy.collections.includes(collection)&&determination===completionPolicy.completionValue&&claimed!==completionPolicy.completionValue){\n    determination=completionPolicy.unresolvedDisposition;\n    reasons.push(completionPolicy.determinationField+' must explicitly be '+completionPolicy.completionValue+' for a favorable external result; use '+completionPolicy.normalizedOutcomes.join(', ')+' to report the supported outcome.');\n  }\n";
assert.equal(source.split(guard).length,2,'The old favorable-fallback fault anchor must be exact.');
const faultSource=source.replace(guard,'');
const families={12:'verification',22:'deterministicResults',23:'meaningResults',24:'adversarialResults'};
const operations={12:'VERIFY',22:'EXECUTE_EXTERNAL_TEST',23:'COMPLETE',24:'COMPLETE'};
const stages=[12,22,23,24];
const admittedValues=['SATISFIED','VIOLATED','UNKNOWN','UNDETERMINED','PARTIAL','SUCCESS'];
const plain=value=>JSON.parse(JSON.stringify(value));

function runtime(fault=false){
  const r=projectStoreRuntime({sourceOverrides:fault?{'workflow-engine.js':faultSource}:{}});
  vm.runInContext(routingFixture.toString(),r.runtime);
  return r;
}
function add(r,p,family,fields,stage,scope=r.engine.currentScope(p)){
  const {engine:e}=r,s=r.runtime.closedLoopWorkflowSchema,id=e.allocateId(p,family),all={...fields,[s.RECORD_SCHEMAS[family].idField]:id};
  const row=r.copy({id,active:true,stage,scope,fields:all,...all,source:'SYNTHETIC_RESULT_POLICY_SETUP'});
  e.refreshRecordHashes(row,family);p.projectData[family].push(row);return row;
}
function assertPublished(r,stage,operation,prompt=null){
  const s=r.runtime.closedLoopWorkflowSchema,descriptor=r.prompts.responseContractDescriptor(stage,operation);
  assert.deepEqual(plain(descriptor.externalResultCompletionPolicy),plain(s.EXTERNAL_RESULT_COMPLETION_POLICY));
  assert.deepEqual(plain(descriptor.externalResultCompletionPolicy.normalizedOutcomes),['SATISFIED','VIOLATED','UNDETERMINED']);
  // Stage 12 VERIFY also carries independent-run context, whose /94 prompt
  // version takes precedence over the shared external-result /93 version.
  const expectedVersion=stage===12?'closed-loop-prompt-engine/94':'closed-loop-prompt-engine/93';
  assert.equal(r.prompts.versionFor(stage,operation),expectedVersion);
  if(prompt){
    assert.equal(prompt.promptEngineVersion,expectedVersion);
    assert(prompt.prompt.includes('"externalResultCompletionPolicy"')&&prompt.prompt.includes('PARTIAL')&&prompt.prompt.includes('cannot become effectively SATISFIED'));
    assert.equal(r.prompts.promptFileManifest(prompt).promptIdentity.contractSha256,prompt.contractSha256);
  }
}

// Stage 12 shares the production adjudication owner. This focused synthetic
// fixture establishes a distinct run/verifier and canonical sufficient evidence;
// its prior-stage freeze is not a real accepted ten-run journey.
function perRunCase(fault){
  const r=runtime(fault),e=r.engine,s=r.runtime.closedLoopWorkflowSchema,f=r.runtime.routingFixture('INDEPENDENT_AGENT_REVIEW'),p=f.p;
  Object.assign(f.test.fields,{TEST_TYPE:'DETERMINISTIC',VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:12,REQUIRED_BY_STAGE:12,PER_RUN_REQUIRED:true,FINAL_PRODUCT_REQUIRED:false,EXPECTED_RESULT:'SATISFIED',ARTIFACT_REQUIREMENTS:'NONE'});
  Object.assign(f.test,f.test.fields);e.refreshRecordHashes(f.test,'tests');
  const iteration=add(r,p,'iterations',{STATUS:'ACTIVE'},10),generator=e.registerFreshContext(p,{stage:11,externalContextIdentifier:'SYNTHETIC-RUN-GENERATOR',purpose:'GENERAL'});
  const run=add(r,p,'runs',{ITERATION_ID:iteration.id,CONTEXT_ID:generator.id,EXECUTION_STATUS:'COMPLETED',CONTAMINATION_CHECK:'NONE'},11);
  const verifier=e.registerFreshContext(p,{stage:12,externalContextIdentifier:'SYNTHETIC-INDEPENDENT-VERIFIER',purpose:'REVIEWER'});
  verifier.fields.RUN_ID=verifier.RUN_ID=run.id;e.refreshRecordHashes(verifier,'freshContexts');
  const proof=add(r,p,'evidenceRecords',{KIND:'REVIEW_NOTE',AUTHORITY_TYPE:'INDEPENDENT_REVIEWER',CONTENT:'Synthetic observed verification result',STATUS:'PRESERVED'},12);
  const result=add(r,p,'verification',{REQ_ID:p.projectData.requirements[0].id,RUN_ID:run.id,TEST_ID:f.test.id,VERIFIER_CONTEXT_ID:verifier.id,EXPECTED_RESULT:'SATISFIED',OBSERVED_RESULT:'SATISFIED',DETERMINATION:'SATISFIED',EXACT_EVIDENCE:'Synthetic independently observed result'},12);
  result.evidenceRefs=[proof.id];e.refreshRecordHashes(result,'verification');
  assertPublished(r,12,operations[12]);
  return {boundary:'ADJUDICATION_WITH_SYNTHETIC_CANONICAL_EVIDENCE',evaluate(value){
    result.fields.DETERMINATION=result.DETERMINATION=value;e.refreshRecordHashes(result,'verification');
    const decision=e.evaluateResultConsistency('verification',result,f.test,p);
    assert.equal(decision.evidence.sufficient,true,JSON.stringify(decision.reasons));
    return {actual:value,effective:decision.determination,reasons:decision.reasons,gateReasons:e.gate(12,p).reasons};
  }};
}

function finalStageCase(stage,fault){
  const r=runtime(fault),e=r.engine,s=r.runtime.closedLoopWorkflowSchema,f=r.runtime.routingFixture('INDEPENDENT_AGENT_REVIEW'),p=f.p,family=families[stage],operation=operations[stage],hash=r.runtime.closedLoopHash;
  p.activeStage=stage;
  const phase={22:'FINAL_PRODUCT_DETERMINISTIC',23:'FINAL_PRODUCT_MEANING',24:'FINAL_PRODUCT_ADVERSARIAL'}[stage];
  for(const [key,value] of Object.entries({TEST_TYPE:{22:'DETERMINISTIC',23:'MEANING',24:'ADVERSARIAL'}[stage],VERIFICATION_PHASE:phase,EARLIEST_EXECUTABLE_STAGE:stage,REQUIRED_BY_STAGE:stage,EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',REQUIRED_CAPABILITY:'independent test review',EXPECTED_RESULT:'PASS'})){f.test.fields[key]=f.test[key]=value;}
  e.refreshRecordHashes(f.test,'tests');
  p.job.CURRENT_REQUIREMENTS_VERSION='REQUIREMENTS-v001';p.job.CURRENT_TEST_SUITE_VERSION='TEST-SUITE-v001';
  for(const [row,kind] of [[p.projectData.requirements[0],'requirements'],[f.test,'tests'],[f.product,'products']]){row.scope.requirementsVersion='REQUIREMENTS-v001';row.scope.testSuiteVersion='TEST-SUITE-v001';e.refreshRecordHashes(row,kind);}
  const baseline=add(r,p,'baselines',{STATUS:'APPROVED'},20);p.job.CURRENT_BASELINE_ID=baseline.id;
  f.product.fields.BASELINE_ID=f.product.BASELINE_ID=baseline.id;f.product.relationships=r.copy({BASELINE_ID:baseline.id});e.refreshRecordHashes(f.product,'products');
  const producer=e.registerFreshContext(p,{stage:21,externalContextIdentifier:'SYNTHETIC-PRODUCT-PRODUCER',purpose:'GENERAL'});
  f.product.fields.PRODUCTION_CONTEXT_ID=f.product.PRODUCTION_CONTEXT_ID=producer.id;f.product.relationships=r.copy({BASELINE_ID:baseline.id,PRODUCTION_CONTEXT_ID:producer.id});e.refreshRecordHashes(f.product,'products');
  const blob=new Blob(['Synthetic exact finished product'],{type:'text/plain'}),artifactId=e.allocateId(p,'artifacts');
  return (async()=>{
    const sha=await hash.sha256Bytes(blob);
    await r.store.putArtifact({artifactId,jobId:p.job.JOB_ID,blob,filename:'product.txt',mediaType:blob.type,expectedSha256:sha});
    e.registerArtifactBytes(p,{stage:21,artifactId,filename:'product.txt',mediaType:blob.type,byteSize:blob.size,sha256:sha,role:'FINISHED_PRODUCT',lineage:r.copy({productId:f.product.id})});
    f.product.fields.GENERATED_ARTIFACT_INVENTORY=f.product.GENERATED_ARTIFACT_INVENTORY=r.copy([artifactId]);e.refreshRecordHashes(f.product,'products');
    add(r,p,'propositions',{REQUIREMENT_ID:p.projectData.requirements[0].id,PROPOSITION_TEXT:'Synthetic exact product content is present.',STATUS:'CURRENT'},4,{...e.currentScope(p),productId:null});
    let reviewer=null;if(stage!==22)reviewer=e.registerFreshContext(p,{stage,externalContextIdentifier:`SYNTHETIC-STAGE${stage}-REVIEWER`,purpose:'REVIEWER'});
    for(let n=1;n<stage;n++){p.stages[n].status='COMPLETE';p.stages[n].gate=r.copy({complete:true,blocked:false,reasons:[]});}
    assert(e.finalProductTestSelection(p,stage).tests.some(row=>row.id===f.test.id),'The test must be due at the target stage.');
    assert.equal(r.store.artifactCustodyState({jobId:p.job.JOB_ID,artifactId,filename:'product.txt',byteSize:blob.size,sha256:sha}),'TRUE');
    const prompt=r.prompts.reserveAndBuildPromptRecord(p,stage,{operation,scope:reviewer?{contextId:reviewer.id}:{}}).prompt;
    assertPublished(r,stage,operation,prompt);
    const response=value=>{
      const shared={PRODUCT_ID:{recordId:f.product.id},TEST_ID:{recordId:f.test.id}},required={
        22:{TOOL_AND_VERSION:'Synthetic independent reviewer',PROCEDURE:'Compare exact synthetic product',EXPECTED_RESULT:'PASS',ACTUAL_RESULT:'PASS',DETERMINATION:value,EVIDENCE:'Synthetic observed product pass'},
        23:{PRODUCT_LOCATION:'product.txt',EXTERNAL_SOURCE_EVIDENCE:'Current controlling test',REQUIRED_MEANING:'PASS',OBSERVED_MEANING:'PASS',EVIDENCE_BASED_COMPARISON:'SATISFIED',DETERMINATION:value},
        24:{ATTACK:'Synthetic adversarial check',METHOD:'Inspect exact product',EXPECTED_BEHAVIOR:'No material defect',ACTUAL_RESULT:'NO MATERIAL ADVERSARIAL DEFECT FOUND',DETERMINATION:value,SEVERITY:'MINOR',EVIDENCE:'Synthetic observed product pass'}
      }[stage],relationships=stage===23?{...shared,REQ_ID:{recordId:p.projectData.requirements[0].id}}:shared;
      const row=recordProposal(s,family,{tempKey:'result',relationships,overrides:required});
      return {schema:s.RESPONSE_SCHEMA,contractProfileId:s.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage,operation,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce,scope:prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{[family]:[row]},evidence:[evidence(`stage${stage}-negative-state-control`)],unresolved:[],warnings:[],attachments:[]};
    };
    return {boundary:'EXPORTED_PROMPT_PREPARE_COMMIT_GATE',stage,p,prompt,r,response,admissionControls(){
      const transport={authority:'AUTHORITATIVE_RESPONSE_FILE',packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce};
      const missing=response('SATISFIED');delete missing.records[family][0].fields.DETERMINATION;
      const wrong=response('SATISFIED');wrong.records[family][0].fields.DETERMINATION={unsupported:'object'};
      for(const [name,envelope] of [['missing',missing],['wrong-type',wrong]]){
        const prepared=r.ingestion.prepare(p,{stage,text:JSON.stringify(envelope),promptRecord:prompt,transport});
        assert.equal(prepared.validation.valid,false,`Stage ${stage}: ${name} DETERMINATION must be rejected before proposal.`);
        assert(prepared.validation.issues.some(issue=>String(issue.path||'').includes('DETERMINATION')),`Stage ${stage}: ${name} must fail at the intended field.`);
      }
      return ['missing','wrong-type'];
    },evaluate(value){
      const envelope=response(value),prepared=r.ingestion.prepare(p,{stage,text:JSON.stringify(envelope),promptRecord:prompt,transport:{authority:'AUTHORITATIVE_RESPONSE_FILE',packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce}});
      assert.equal(prepared.validation.valid,true,JSON.stringify(prepared.validation.issues));
      const committed=r.ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'SYNTHETIC_OPERATOR'}).project,row=e.recordsForCurrentScope(committed,family).at(-1);
      assert(row,'Accepted external result must reach canonical records.');assert.equal(e.recordValue(row,'DETERMINATION'),value,'Accepted raw determination must be preserved.');
      const decision=e.evaluateResultConsistency(family,row,f.test,committed),gate=e.gate(stage,committed);
      assert.equal(decision.evidence.sufficient,true,JSON.stringify(decision.reasons));
      return {actual:value,effective:decision.determination,reasons:decision.reasons,gateReasons:gate.reasons,gateComplete:gate.complete};
    }};
  })();
}


async function stalePackageControl(control){
  const {r,p,prompt,response,stage}=control,old=r.copy(prompt);old.promptEngineVersion='closed-loop-prompt-engine/90';
  const stale=r.copy(p),index=stale.projectData.generatedPrompts.findIndex(row=>row.instructionId===prompt.instructionId);
  assert(index>=0,'The exported prompt must be retained before testing freshness.');stale.projectData.generatedPrompts[index]=old;
  const envelope=response('SATISFIED'),attempt=r.ingestion.prepare(stale,{stage,text:JSON.stringify(envelope),promptRecord:old,transport:{authority:'AUTHORITATIVE_RESPONSE_FILE',packageId:old.packageId,operationReservationId:old.operationReservationId,challengeNonce:old.challengeNonce}});
  assert.equal(attempt.validation.valid,false,'A prior /90 instruction must not admit a new external result.');
  assert(attempt.validation.issues.some(issue=>issue.code==='STALE_PROMPT_ENGINE_VERSION'),'The old package must receive an explicit regenerate route.');
  const fresh=r.prompts.reserveAndBuildPromptRecord(stale,stage,{operation:operations[stage]}).prompt;
  assertPublished(r,stage,operations[stage],fresh);
  assert.notEqual(fresh.instructionId,old.instructionId,'Regeneration must produce a fresh instruction identity.');
  return {staleVersion:old.promptEngineVersion,staleCode:'STALE_PROMPT_ENGINE_VERSION',freshVersion:fresh.promptEngineVersion,freshInstructionId: fresh.instructionId};
}

const observations=[];
for(const stage of stages){
  const current=stage===12?perRunCase(false):await finalStageCase(stage,false);
  const old=stage===12?perRunCase(true):await finalStageCase(stage,true);
  const admissionNegatives=stage===12?[]:current.admissionControls();
  const control=current.evaluate('SATISFIED'),priorControl=old.evaluate('SATISFIED');
  assert.equal(control.effective,'SATISFIED',`Stage ${stage}: conforming supported result must progress through adjudication: ${JSON.stringify(control)}`);
  assert.equal(priorControl.effective,'SATISFIED',`Stage ${stage}: old control must reach the target, not an unrelated failure: ${JSON.stringify(priorControl)}`);
  const negatives=[];
  for(const value of admittedValues.slice(1)){
    const result=current.evaluate(value),expected=value==='VIOLATED'?'VIOLATED':'UNDETERMINED';
    assert.equal(result.effective,expected,`Stage ${stage}: ${value} cannot become a favorable determination.`);
    if(value!=='VIOLATED')assert(result.reasons.some(reason=>reason.includes('DETERMINATION must explicitly be SATISFIED')),`Stage ${stage}: ${value} needs actionable producer feedback.`);
    if(stage!==12&&value!=='VIOLATED')assert(result.gateReasons.some(reason=>reason.includes('DETERMINATION must explicitly be SATISFIED')),`Stage ${stage}: ${value} must reach the stage gate.`);
    negatives.push({value,effective:result.effective});
  }
  const former=old.evaluate('UNKNOWN');
  assert.equal(former.effective,'SATISFIED',`Stage ${stage}: former fallback must reproduce the intended false-positive target.`);
  observations.push({stage,family:families[stage],boundary:current.boundary,conforming:'SATISFIED',negative:negatives,admissionNegatives,formerUnknown:'SATISFIED',currentUnknown:'UNDETERMINED',evidenceSufficient:true,producerDescriptorPublished:true});
  if(stage===22)observations.push({stage,caseId:'stale-external-result-prompt-recovery',...(await stalePackageControl(current))});
}
console.log(JSON.stringify({schema:'closed-loop-external-result-determination-regression/1',observations}));
