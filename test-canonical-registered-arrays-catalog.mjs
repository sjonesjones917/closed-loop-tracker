import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verificationCatalog,negativePopulationCatalog} from './verification-evidence-catalog.mjs';
import {observationsFromReports} from './verification-evidence.mjs';

// Independent consumer fixture. It never runs the application or creates an
// eligible receipt, and it does not import a producer result or its constants.
export function verifyCanonicalRegisteredArrayCatalogConsumers(){
  const owner=verificationCatalog['verify-hash.mjs'],check=owner.checks.find(row=>row.id==='canonical.registered-array-preimages');
  assert(check,'REGISTERED_ARRAY_CATALOG_CHECK_ORACLE');
  const digest=text=>createHash('sha256').update(text,'utf8').digest('hex');
  const original='{"chainRecords":[{"id":"10","value":"ten"},{"id":"2","steps":["z","a","z"],"value":"two"},{"id":"","value":"bmp"},{"id":"𐀀","value":"astral"}],"jobId":"JOB-ARRAY","requirementIds":["REQ-B","REQ-A","REQ-B"],"scope":{}}';
  const permuted='{"chainRecords":[{"id":"10","value":"ten"},{"id":"2","steps":["z","a","z"],"value":"two"},{"id":"","value":"bmp"},{"id":"𐀀","value":"astral"}],"jobId":"JOB-ARRAY","requirementIds":["REQ-A","REQ-B","REQ-B"],"scope":{}}';
  const nestedPermuted='{"chainRecords":[{"id":"10","value":"ten"},{"id":"2","steps":["a","z","z"],"value":"two"},{"id":"","value":"bmp"},{"id":"𐀀","value":"astral"}],"jobId":"JOB-ARRAY","requirementIds":["REQ-B","REQ-A","REQ-B"],"scope":{}}';
  const caseIds=['paired-original','ordinary-array-permuted','registered-set-permuted','nested-ordinary-array-permuted','restored-after-refusals'];
  const refusals=[
    ['missing-identity-declaration','Set semantics for /missing require an element identity key.'],
    ['empty-identity-declaration','Set semantics for /empty require an element identity key.'],
    ['wrong-duplicate-rule','Set semantics for /duplicates must use the controlling duplicate and sort rules.'],
    ['wrong-sort-rule','Set semantics for /sort must use the controlling duplicate and sort rules.'],
    ['duplicate-pointer-declaration','Set semantics for /chainRecords are already registered.'],
    ['relative-pointer-declaration','Set pointer must be an absolute JSON pointer.'],
    ['duplicate-element-identity','Duplicate set element identity at /chainRecords.'],
    ['missing-element-identity','Set element at /chainRecords lacks identity key id.'],
    ['nonarray-set-value','Registered set pointer /chainRecords must resolve to an array.']
  ];
  const faults=[['unregistered-array-sorted','REGISTERED_ARRAY_ORDER_ORACLE: paired-original'],['registered-set-reversed','REGISTERED_SET_ORDER_ORACLE: paired-original']];
  const fixture={sha256Vectors:true,registeredArrayContracts:{
    schema:'closed-loop-registered-array-observations/1',checkId:'canonical.registered-array-preimages',passed:true,synthetic:true,actualBrowser:false,fullClauseConformanceEstablished:false,
    boundary:'Actual EVIDENCE_CHAIN_SET/1 schema registration and hash APIs with independent literals, ordered requirementIds, registered chainRecords and intended owning faults. Synthetic records; no scope/terminal lifecycle, browser or full-clause conformance claim.',
    cases:caseIds.map(caseId=>{const text=caseId==='ordinary-array-permuted'?permuted:caseId==='nested-ordinary-array-permuted'?nestedPermuted:original,sha256=digest(text);return {caseId,expectedPreimage:text,observedPreimage:text,expectedSha256:sha256,observedSha256:sha256,subjectUnchanged:true,registryUnchanged:true,passed:true};}),
    rejections:refusals.map(([caseId,message])=>({caseId,errorName:'TypeError',expectedMessage:message,observedMessage:message,subjectUnchanged:true,registryUnchanged:true,passed:true})),caseCount:5,rejectionCount:9,
    faults:faults.map(([fault,oracle])=>({fault,code:'REGISTERED_ARRAY_CONTRACT_ASSERTION',oracle,detected:true,restored:true,restoredSha256:digest(original)})),faultCount:2
  }};
  const cases=[],admit=report=>check.condition(report?.registeredArrayContracts,report);
  assert.equal(admit(fixture),true,'REGISTERED_ARRAY_CATALOG_VALID_ORACLE');cases.push('valid-control');
  const reject=(name,alter)=>{
    const changed=structuredClone(fixture);alter(changed);
    assert.equal(admit(changed),false,'REGISTERED_ARRAY_CATALOG_REFUSAL_ORACLE: '+name);
    assert.equal(admit(fixture),true,'REGISTERED_ARRAY_CATALOG_RESTORED_ORACLE: '+name);cases.push(name);
  };
  for(const [name,alter]of [
    ['missing-group',r=>delete r.registeredArrayContracts],
    ['wrong-schema',r=>r.registeredArrayContracts.schema='OTHER'],
    ['wrong-check',r=>r.registeredArrayContracts.checkId='OTHER'],
    ['false-pass',r=>r.registeredArrayContracts.passed=false],
    ['nonsynthetic-overclaim',r=>r.registeredArrayContracts.synthetic=false],
    ['browser-overclaim',r=>r.registeredArrayContracts.actualBrowser=true],
    ['whole-clause-overclaim',r=>r.registeredArrayContracts.fullClauseConformanceEstablished=true],
    ['wrong-boundary',r=>r.registeredArrayContracts.boundary='All scope and terminal lifecycle behavior proven'],
    ['unknown-group-field',r=>r.registeredArrayContracts.ordinaryReceiptEligible=true],
    ['wrong-case-count',r=>r.registeredArrayContracts.caseCount=4],
    ['wrong-rejection-count',r=>r.registeredArrayContracts.rejectionCount=8],
    ['wrong-fault-count',r=>r.registeredArrayContracts.faultCount=1],
    ['wrong-owner',r=>{delete r.sha256Vectors;r.finalAcceptanceGate=true;}],
    ['false-owner',r=>r.sha256Vectors=false],
    ['duplicate-case',r=>r.registeredArrayContracts.cases[1]=r.registeredArrayContracts.cases[0]],
    ['duplicate-rejection',r=>r.registeredArrayContracts.rejections[1]=r.registeredArrayContracts.rejections[0]],
    ['duplicate-fault',r=>r.registeredArrayContracts.faults[1]=r.registeredArrayContracts.faults[0]]
  ])reject(name,alter);
  for(const id of caseIds){
    const row=r=>r.registeredArrayContracts.cases.find(value=>value.caseId===id);
    reject('missing-case:'+id,r=>r.registeredArrayContracts.cases=r.registeredArrayContracts.cases.filter(value=>value.caseId!==id));
    reject('false-case:'+id,r=>row(r).passed=false);
    reject('wrong-preimage:'+id,r=>row(r).observedPreimage='{}');
    reject('wrong-digest:'+id,r=>row(r).observedSha256='0'.repeat(64));
    reject('coherent-wrong-expectation:'+id,r=>{const target=row(r);target.expectedPreimage=target.observedPreimage='{}';target.expectedSha256=target.observedSha256=digest('{}');});
    reject('mutated-subject:'+id,r=>row(r).subjectUnchanged=false);
    reject('mutated-registry:'+id,r=>row(r).registryUnchanged=false);
  }
  for(const [id]of refusals){
    const row=r=>r.registeredArrayContracts.rejections.find(value=>value.caseId===id);
    reject('missing-refusal:'+id,r=>r.registeredArrayContracts.rejections=r.registeredArrayContracts.rejections.filter(value=>value.caseId!==id));
    reject('wrong-message:'+id,r=>row(r).observedMessage='Unrelated setup failure');
    reject('wrong-error-type:'+id,r=>row(r).errorName='Error');
    reject('false-refusal:'+id,r=>row(r).passed=false);
    reject('mutated-refusal-subject:'+id,r=>row(r).subjectUnchanged=false);
    reject('mutated-refusal-registry:'+id,r=>row(r).registryUnchanged=false);
  }
  for(const [id]of faults){
    const row=r=>r.registeredArrayContracts.faults.find(value=>value.fault===id);
    reject('missing-fault:'+id,r=>r.registeredArrayContracts.faults=r.registeredArrayContracts.faults.filter(value=>value.fault!==id));
    reject('wrong-oracle:'+id,r=>row(r).oracle='Unrelated failure printed the expected source line');
    reject('wrong-assertion-code:'+id,r=>row(r).code='UNRELATED_SETUP_FAILURE');
    reject('undetected-fault:'+id,r=>row(r).detected=false);
    reject('unrestored-fault:'+id,r=>row(r).restored=false);
    reject('wrong-restored-digest:'+id,r=>row(r).restoredSha256='0'.repeat(64));
  }
  const originalChecks=owner.checks,originalPopulation=negativePopulationCatalog['verify-hash.mjs'];
  try{
    owner.checks=[check];delete negativePopulationCatalog['verify-hash.mjs'];
    assert.equal(observationsFromReports('verify-hash.mjs',[fixture])[0].passed,true);cases.push('selector-valid');
    for(const [name,reports]of [['missing',[]],['duplicate',[fixture,structuredClone(fixture)]],['wrong-owner',[{wrongOwner:fixture}]],['focused-helper',[fixture.registeredArrayContracts]]]){
      assert.throws(()=>observationsFromReports('verify-hash.mjs',reports),/expected exactly one report marker/,'REGISTERED_ARRAY_CATALOG_SELECTOR_ORACLE: '+name);cases.push('selector-'+name);
    }
  }finally{owner.checks=originalChecks;if(originalPopulation===undefined)delete negativePopulationCatalog['verify-hash.mjs'];else negativePopulationCatalog['verify-hash.mjs']=originalPopulation;}
  const finalOwner=verificationCatalog['verify-final-acceptance.mjs'];
  const inputOracle=(producer,consumer)=>{
    assert(producer.includes('test-canonical-registered-arrays.mjs'),'REGISTERED_ARRAY_SOURCE_INPUT_ORACLE: producer');
    assert(consumer.includes('test-canonical-registered-arrays-catalog.mjs'),'REGISTERED_ARRAY_SOURCE_INPUT_ORACLE: consumer');
  };
  inputOracle(owner.sourceInputs,finalOwner.sourceInputs);cases.push('source-inputs-valid');
  assert.throws(()=>inputOracle(owner.sourceInputs.filter(file=>file!=='test-canonical-registered-arrays.mjs'),finalOwner.sourceInputs),/REGISTERED_ARRAY_SOURCE_INPUT_ORACLE: producer/);cases.push('source-input-missing-producer');
  assert.throws(()=>inputOracle(owner.sourceInputs,finalOwner.sourceInputs.filter(file=>file!=='test-canonical-registered-arrays-catalog.mjs')),/REGISTERED_ARRAY_SOURCE_INPUT_ORACLE: consumer/);cases.push('source-input-missing-consumer');
  assert.equal(admit(fixture),true);cases.push('restored-control');
  return {passed:true,cases,caseCount:cases.length,consumerOnly:true,syntheticReportFixture:true,actualProducerExecuted:false,eligibleReceiptCreated:false,actualBrowser:false,fullClauseConformanceEstablished:false};
}
