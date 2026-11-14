import {createVerifierRuntime} from './verifier-runtime.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js'])createVerifierRuntime.loadScript(globalThis,fs.readFileSync(file,'utf8'),{filename:file});
const schema=globalThis.closedLoopWorkflowSchema;
assert.ok(schema,'workflow-schema.js did not load.');

// Permanent regression: closed stage-operation membership and exact initial EXECUTE_RUN semantics must remain aligned.
const ordinaryExpected=Object.freeze({
  1:['COMPLETE','SEMANTIC_CHALLENGE','RECONCILE_INTAKE'],
  2:['COMPLETE','SEARCH_ADEQUACY_REVIEW','RECONCILE_SOURCE_SEARCH'],
  3:['COMPLETE','SEMANTIC_CHALLENGE','RECONCILE_RESEARCH'],
  4:['COMPLETE','DISPOSITION_CHALLENGE','ATOMICITY_CHALLENGE','RECONCILE_REQUIREMENTS'],
  5:['COMPLETE','SEMANTIC_REVIEW','RECONCILE_REQUIREMENT_SET'],
  6:['COMPLETE','PROOF_REVIEW','RECONCILE_VERIFICATION_SUITE'],
  7:['COMPLETE','EXECUTE_FAILURE_TEST'],
  8:['COMPLETE'],
  9:['COMPLETE'],
  10:['FREEZE'],
  11:['EXECUTE_RUN'],
  12:['VERIFY'],
  13:['COMPARE'],
  14:['ROOT_CAUSE'],
  15:['COMPLETE','EXECUTE_REGRESSION'],
  16:['CORRECT'],
  17:['FREEZE','EXECUTE_RUN','VERIFY','COMPARE','ROOT_CAUSE','REGRESSION','CORRECT'],
  18:['COMPLETE'],
  19:['CONFIRM_FREEZE','EXECUTE_RUN','VERIFY','COMPARE','REGRESSION_VERIFY','CONFIRM'],
  20:['FREEZE_BASELINE'],
  21:['COMPLETE'],
  22:['RUN_NATIVE_TESTS','EXECUTE_EXTERNAL_TEST'],
  23:['COMPLETE'],
  24:['RUN_NATIVE_ATTACKS','COMPLETE'],
  25:['FREEZE_DELIVERY_CANDIDATE','COMPLETE'],
  26:['COMPLETE','SEMANTIC_REVIEW','RECONCILE'],
  27:['CALCULATE_RELEASE','ADVISORY_REVIEW'],
  28:['VERIFY_IDENTITY','CAPTURE_DELIVERY_INTENT'],
  29:['CALCULATE_EVIDENCE_CHAINS','INVESTIGATE_MISSING_EVIDENCE'],
  30:['CALCULATE_TERMINAL','EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS','RECORD_DELIVERY_EVIDENCE']
});

// Sections 14.6/37 declare ordinary operations. Approved Section 32.4A
// adds conditional reuse strictly after the independently fixed owners 7/15.
const expected=Object.fromEntries(Object.entries(ordinaryExpected).map(([stage,operations])=>[stage,[...operations]]));
for(const [operation,family,owner]of [['EXECUTE_FAILURE_TEST','failureTests',7],['EXECUTE_REGRESSION','regressions',15]]){
  assert.equal(schema.RECORD_SCHEMAS[family].stage,owner,`${family} definition ownership drifted.`);
  for(let stage=owner+1;stage<=30;stage++)expected[stage].push(operation);
}
assert.equal(Object.values(expected).reduce((count,operations)=>count+operations.length,0),104,'Independent closed operation population drifted.');
assert.deepEqual(Object.keys(schema.STAGE_OPERATION_REGISTRY).sort(),Object.entries(expected).flatMap(([stage,operations])=>operations.map(operation=>`${stage}:${operation}`)).sort(),'Actual registry has missing or extra stage-operation keys.');
const verificationObservations=[];
assert.deepEqual(schema.STAGE_OPERATIONS,expected,'Stage-operation set is not the closed controlling set.');
for(let stage=1;stage<=30;stage++){
  assert.deepEqual(schema.STAGE_CONTRACTS[stage].operations,expected[stage],`Stage ${stage} contract operations drifted.`);
  for(const operation of expected[stage])assert.ok(schema.operationContract(stage,operation),`Missing operation contract for Stage ${stage} ${operation}.`);
  const registered=Object.keys(schema.STAGE_OPERATION_REGISTRY).filter(key=>key.startsWith(`${stage}:`)).map(key=>key.slice(key.indexOf(':')+1)).sort();
  assert.deepEqual(registered,[...expected[stage]].sort(),`Stage ${stage} registry membership drifted.`);
  if(stage>=2)verificationObservations.push({checkId:`stage-registry.stage${String(stage).padStart(2,'0')}.exact-membership`,stage,boundary:'Loaded canonical schema stage-operation registry and stage contract declarations compared with independently literal specification lists.',scopeLimit:'Exact declaration membership only, including approved conditional reuse after owners7/15. Does not establish operation execution, admission, gates or external-agent behavior.',expected:{ordinaryOperations:[...ordinaryExpected[stage]],conditionalOperations:expected[stage].slice(ordinaryExpected[stage].length),allOperations:[...expected[stage]]},observed:{stageOperations:[...schema.STAGE_OPERATIONS[stage]],stageContractOperations:[...schema.STAGE_CONTRACTS[stage].operations],registeredOperations:registered},passed:true});
}
for(const [stage,invalid] of [[10,'COMPLETE'],[11,'COMPLETE'],[12,'COMPLETE'],[22,'COMPLETE'],[27,'COMPLETE'],[30,'COMPLETE']])assert.equal(schema.operationContract(stage,invalid),null,`Stage ${stage} illegally accepts ${invalid}.`);

// Controlling-spec executor boundary: these operations are application/human/operator actions and must never
// produce an external-agent prompt. Every other closed operation is external-agent work.
const nonExternal=Object.freeze({
  '10:FREEZE':'APPLICATION',
  '17:FREEZE':'APPLICATION',
  '18:COMPLETE':'APPLICATION',
  '19:CONFIRM_FREEZE':'APPLICATION',
  '19:CONFIRM':'APPLICATION',
  '20:FREEZE_BASELINE':'APPLICATION',
  '22:RUN_NATIVE_TESTS':'APPLICATION',
  '24:RUN_NATIVE_ATTACKS':'APPLICATION',
  '25:FREEZE_DELIVERY_CANDIDATE':'APPLICATION',
  '27:CALCULATE_RELEASE':'APPLICATION',
  '28:VERIFY_IDENTITY':'APPLICATION',
  '28:CAPTURE_DELIVERY_INTENT':'HUMAN_DECISION',
  '29:CALCULATE_EVIDENCE_CHAINS':'APPLICATION',
  '30:CALCULATE_TERMINAL':'APPLICATION',
  '30:EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS':'OPERATOR_ACTION',
  '30:RECORD_DELIVERY_EVIDENCE':'OPERATOR_ACTION'
});
let externalOperations=0;
for(let stage=1;stage<=30;stage++)for(const operation of expected[stage]){
  const key=`${stage}:${operation}`,registration=schema.STAGE_OPERATION_REGISTRY[key];
  assert.ok(registration,`Missing executor registration for ${key}.`);
  const expectedExecutor=nonExternal[key]||'EXTERNAL_AGENT';
  assert.equal(registration.executorClass,expectedExecutor,`${key} executor drifted from the controlling operation boundary.`);
  if(expectedExecutor==='EXTERNAL_AGENT')externalOperations++;
}

// Section 17.12 closes proposal acceptance for the 88 DATA_PROPOSAL operations.
// DIRECT_COMMAND is the current implementation marker for the separate 16-entry
// application/human-decision/operator boundary; it is not a third proposal mode.
const PROPOSAL_ACCEPTANCE_MODES=Object.freeze(['HUMAN_ACCEPTANCE_REQUIRED','VALIDATED_AUTO_COMMIT']);
const DIRECT_COMMAND_MARKER='DIRECT_COMMAND';
// Independently enumerated from the Section 14.6 owning operations, the
// Section 32.4A Stage07 owning writer, and the Section38 replacement policies.
const expectedReplacementKeys=Object.freeze([
  '2:COMPLETE','2:RECONCILE_SOURCE_SEARCH',
  '3:COMPLETE','3:RECONCILE_RESEARCH',
  '4:COMPLETE','4:RECONCILE_REQUIREMENTS',
  '5:COMPLETE','5:RECONCILE_REQUIREMENT_SET',
  '6:COMPLETE','6:RECONCILE_VERIFICATION_SUITE',
  '7:COMPLETE','7:EXECUTE_FAILURE_TEST',
  '8:COMPLETE','9:COMPLETE',
  '26:COMPLETE','26:RECONCILE'
]);
function verifyAcceptanceModes(subject=schema){
  const dataProposalKeys=[],replacementKeys=[],directCommandKeys=[],autoCommitKeys=[];
  for(const [key,registration] of Object.entries(subject.STAGE_OPERATION_REGISTRY)){
    const producesDataProposal=registration.responseTypes.includes('DATA_PROPOSAL');
    if(producesDataProposal){
      dataProposalKeys.push(key);
      assert.ok(Object.hasOwn(registration,'acceptanceMode'),`ACCEPTANCE_MODE_EXACTLY_ONE_ORACLE: ${key} omits acceptanceMode.`);
      assert.ok(PROPOSAL_ACCEPTANCE_MODES.includes(registration.acceptanceMode),`ACCEPTANCE_MODE_CLOSED_VALUE_ORACLE: ${key} has an undeclared proposal acceptance mode.`);
      assert.equal(subject.operationContract(registration.stage,registration.operation)?.acceptanceMode,registration.acceptanceMode,`ACCEPTANCE_MODE_VERSION_BINDING_ORACLE: ${key} published contract differs from its registered mode.`);
      assert.equal(registration.executorClass,'EXTERNAL_AGENT',`DATA_PROPOSAL_EXECUTOR_ORACLE: ${key} must use the external response route.`);
      assert.equal(registration.acceptsExternalResponse,true,`DATA_PROPOSAL_RESPONSE_ROUTE_ORACLE: ${key} must accept the registered external response.`);
      assert.equal(registration.acceptanceMode,'HUMAN_ACCEPTANCE_REQUIRED',`DATA_PROPOSAL_HUMAN_REVIEW_ORACLE: ${key} may not commit without explicit operator review.`);
      if(registration.agentWritableCollections.some(family=>subject.RECORD_SCHEMAS[family]?.commitPolicy==='REPLACE_CURRENT_STAGE_SET'))replacementKeys.push(key);
    }else{
      directCommandKeys.push(key);
      assert.equal(registration.acceptsExternalResponse,false,`DIRECT_COMMAND_EXTERNAL_RESPONSE_ORACLE: ${key} may not accept an external response.`);
      assert.deepEqual([...registration.responseTypes],[],`DIRECT_COMMAND_RESPONSE_TYPE_ORACLE: ${key} may not declare DATA_PROPOSAL or another response type.`);
      assert.equal(registration.acceptanceMode,DIRECT_COMMAND_MARKER,`DIRECT_COMMAND_MODE_ORACLE: ${key} must remain on its implementation command marker.`);
      assert.equal(subject.operationContract(registration.stage,registration.operation)?.acceptanceMode,DIRECT_COMMAND_MARKER,`DIRECT_COMMAND_VERSION_BINDING_ORACLE: ${key} published contract differs from its implementation command marker.`);
    }
    if(registration.acceptanceMode==='VALIDATED_AUTO_COMMIT')autoCommitKeys.push(key);
  }
  assert.deepEqual(dataProposalKeys.sort(),Object.entries(expected).flatMap(([stage,operations])=>operations.map(operation=>`${stage}:${operation}`)).filter(key=>!Object.hasOwn(nonExternal,key)).sort(),'DATA_PROPOSAL_ACCEPTANCE_POPULATION_ORACLE: exact external operation population.');
  assert.deepEqual(directCommandKeys.sort(),Object.keys(nonExternal).sort(),'DIRECT_COMMAND_ACCEPTANCE_POPULATION_ORACLE: exact non-external operation population.');
  assert.equal(dataProposalKeys.length,88,'DATA_PROPOSAL_ACCEPTANCE_POPULATION_ORACLE: exact current count.');
  assert.equal(directCommandKeys.length,16,'DIRECT_COMMAND_ACCEPTANCE_POPULATION_ORACLE: exact current count.');
  assert.deepEqual(autoCommitKeys,[],'VALIDATED_AUTO_COMMIT_ELIGIBILITY_ORACLE: the current profile declares no exclusive agent-owned auto-commit slot.');
  for(const key of ['1:COMPLETE','1:RECONCILE_INTAKE'])assert.ok(dataProposalKeys.includes(key),`STAGE01_HUMAN_ACCEPTANCE_ORACLE: ${key} must remain human-reviewed.`);
  assert.deepEqual(replacementKeys.sort(),[...expectedReplacementKeys].sort(),'REPLACE_CURRENT_STAGE_SET_ACCEPTANCE_ORACLE: exact independently enumerated replacement-writing operation population.');
  assert.equal(replacementKeys.length,16,'REPLACE_CURRENT_STAGE_SET_ACCEPTANCE_ORACLE: exact current count.');
  for(const key of replacementKeys)assert.equal(subject.STAGE_OPERATION_REGISTRY[key].acceptanceMode,'HUMAN_ACCEPTANCE_REQUIRED',`REPLACE_CURRENT_STAGE_SET_ACCEPTANCE_ORACLE: ${key} must remain human-reviewed.`);
  return {allowedProposalModes:[...PROPOSAL_ACCEPTANCE_MODES],directCommandMarker:DIRECT_COMMAND_MARKER,dataProposalOperations:dataProposalKeys.length,directCommandOperations:directCommandKeys.length,validatedAutoCommitOperations:autoCommitKeys.length,replacementDataProposalOperations:replacementKeys.length,stage01Operations:['1:COMPLETE','1:RECONCILE_INTAKE']};
}
const acceptanceModeControls=verifyAcceptanceModes();
for(const [name,key,change,oracle,preservePublishedContract=false] of [
  ['missing-mode','1:COMPLETE',row=>{delete row.acceptanceMode;},'ACCEPTANCE_MODE_EXACTLY_ONE_ORACLE'],
  ['undeclared-mode','1:COMPLETE',row=>{row.acceptanceMode='UNDECLARED';},'ACCEPTANCE_MODE_CLOSED_VALUE_ORACLE'],
  ['version-binding-mismatch','1:COMPLETE',row=>{row.acceptanceMode='VALIDATED_AUTO_COMMIT';},'ACCEPTANCE_MODE_VERSION_BINDING_ORACLE',true],
  ['data-proposal-auto-commit','1:RECONCILE_INTAKE',row=>{row.acceptanceMode='VALIDATED_AUTO_COMMIT';},'DATA_PROPOSAL_HUMAN_REVIEW_ORACLE'],
  ['replacement-auto-commit','2:COMPLETE',row=>{row.acceptanceMode='VALIDATED_AUTO_COMMIT';},'DATA_PROPOSAL_HUMAN_REVIEW_ORACLE'],
  ['direct-command-human-mode','29:CALCULATE_EVIDENCE_CHAINS',row=>{row.acceptanceMode='HUMAN_ACCEPTANCE_REQUIRED';},'DIRECT_COMMAND_MODE_ORACLE']
]){
  const registry=Object.fromEntries(Object.entries(schema.STAGE_OPERATION_REGISTRY).map(([entryKey,row])=>[entryKey,{...row}]));change(registry[key]);
  const mutant={...schema,STAGE_OPERATION_REGISTRY:registry,operationContract(stage,operation){return preservePublishedContract?schema.operationContract(stage,operation):registry[`${stage}:${operation}`]||null;}};
  assert.throws(()=>verifyAcceptanceModes(mutant),error=>error?.code==='ERR_ASSERTION'&&error.message.includes(oracle),`ACCEPTANCE_MODE_MUTATION_ORACLE: ${name} escaped its intended assertion.`);
}

// Section14.7 gives the ordinary Stage10/12/29 lists. Stage10 FREEZE
// reserves its created iteration/candidate; Section26.2 and the immutable
// reference exception in14.7 bind Stage12's existing run and fresh verifier.
// These independent literals do not derive expected scopes from the registry.
const ordinaryScopes=Object.freeze([
  {key:'10:FREEZE',dimensions:{requirementsVersion:'INPUT_CURRENT',testSuiteVersion:'INPUT_CURRENT',instructionVersion:'INPUT_CURRENT',iterationId:'TARGET_RESERVED',candidateId:'TARGET_RESERVED'}},
  {key:'12:VERIFY',dimensions:{iterationId:'INPUT_CURRENT',candidateId:'INPUT_CURRENT',runId:'IMMUTABLE_REFERENCE',requirementsVersion:'INPUT_CURRENT',testSuiteVersion:'INPUT_CURRENT',contextId:'IMMUTABLE_REFERENCE'}},
  {key:'29:CALCULATE_EVIDENCE_CHAINS',dimensions:{baselineId:'INPUT_CURRENT',productId:'INPUT_CURRENT',productVersion:'INPUT_CURRENT',deliveryCandidateSetId:'INPUT_CURRENT',releaseId:'INPUT_CURRENT',hashReviewId:'INPUT_CURRENT'}},
  {key:'29:INVESTIGATE_MISSING_EVIDENCE',dimensions:{baselineId:'INPUT_CURRENT',productId:'INPUT_CURRENT',productVersion:'INPUT_CURRENT',deliveryCandidateSetId:'INPUT_CURRENT',releaseId:'INPUT_CURRENT',hashReviewId:'INPUT_CURRENT'}}
]);

function assertOrdinaryScope(schema,{key,dimensions}){
  const scope=schema.STAGE_OPERATION_SCOPE_MATRIX[key],registration=schema.STAGE_OPERATION_REGISTRY[key],required=Object.keys(dimensions);
  assert.ok(scope&&registration,`ORDINARY_SCOPE_ORACLE ${key}: missing declaration.`);
  assert.deepEqual([...scope.requiredDimensions].sort(),[...required].sort(),`ORDINARY_SCOPE_ORACLE ${key}: full required dimensions.`);
  assert.deepEqual({...scope.dimensions},dimensions,`ORDINARY_SCOPE_ORACLE ${key}: exact dimension classes.`);
  assert.equal(scope.prohibitedExtraDimensions,true,`ORDINARY_SCOPE_ORACLE ${key}: extra dimensions must remain prohibited.`);
  assert.equal(registration.scope,scope,`ORDINARY_SCOPE_ORACLE ${key}: registration must reference its matrix entry.`);
  assert.deepEqual([...registration.scopeRequirements].sort(),[...required].sort(),`ORDINARY_SCOPE_ORACLE ${key}: registered required dimensions.`);
  const [stage,operation]=key.split(':');
  assert.deepEqual([...schema.operationContract(Number(stage),operation).scopeRequirements].sort(),[...required].sort(),`ORDINARY_SCOPE_ORACLE ${key}: published contract required dimensions.`);
}

function changedScope(schema,key,change){
  const scope=JSON.parse(JSON.stringify(schema.STAGE_OPERATION_SCOPE_MATRIX[key]));change(scope);
  return {...schema,STAGE_OPERATION_SCOPE_MATRIX:{...schema.STAGE_OPERATION_SCOPE_MATRIX,[key]:scope},STAGE_OPERATION_REGISTRY:{...schema.STAGE_OPERATION_REGISTRY,[key]:{...schema.STAGE_OPERATION_REGISTRY[key],scope,scopeRequirements:[...scope.requiredDimensions]}}};
}

function verifyStageOperationScopes(schema){
  const cases=[];
  for(const expected of ordinaryScopes){
    const {key,dimensions}=expected,first=Object.keys(dimensions)[0];
    assertOrdinaryScope(schema,expected);
    cases.push({name:`${key}:conforming`,status:'PASS',expectedDimensions:{...dimensions},observedDimensions:{...schema.STAGE_OPERATION_SCOPE_MATRIX[key].dimensions}});
    const faults=[
      ['missing-dimension',scope=>{scope.requiredDimensions=scope.requiredDimensions.filter(name=>name!==first);delete scope.dimensions[first];}],
      ['extra-dimension',scope=>{scope.requiredDimensions.push('unregisteredScope');scope.dimensions.unregisteredScope='INPUT_CURRENT';}],
      ['changed-dimension',scope=>{scope.requiredDimensions=scope.requiredDimensions.map(name=>name===first?'unregisteredScope':name);scope.dimensions.unregisteredScope=scope.dimensions[first];delete scope.dimensions[first];}]
    ];
    // Preserve independently required allocation/reference classes, including
    // both immutable identities in VERIFY, not just array membership.
    const classFields=key==='10:FREEZE'?['iterationId','candidateId']:key==='12:VERIFY'?['runId','contextId']:['hashReviewId'];
    for(const field of classFields)faults.push([`changed-class-${field}`,scope=>{scope.dimensions[field]=dimensions[field]==='INPUT_CURRENT'?'TARGET_RESERVED':'INPUT_CURRENT';}]);
    for(const [name,change]of faults){
      const mutant=changedScope(schema,key,change);
      assert.throws(()=>assertOrdinaryScope(mutant,expected),error=>error?.code==='ERR_ASSERTION'&&error.message.includes(`ORDINARY_SCOPE_ORACLE ${key}:`),`${key}: ${name} must fail at the intended scope declaration assertion.`);
      cases.push({name:`${key}:${name}`,status:'PASS',expected:'INTENDED_SCOPE_ASSERTION_REJECTION'});
    }
  }
  // Section14.7 closes membership and classes, not declaration-array order.
  // Reverse a private copy, including the published contract, without rewriting
  // the application's arrays or their serialized representation.
  const orderExpected=ordinaryScopes.find(row=>row.key==='12:VERIFY');
  const originalScope=JSON.stringify(schema.STAGE_OPERATION_SCOPE_MATRIX['12:VERIFY']);
  const reordered=changedScope(schema,'12:VERIFY',scope=>{scope.requiredDimensions.reverse();scope.dimensions=Object.fromEntries(Object.entries(scope.dimensions).reverse());});
  reordered.operationContract=(stage,operation)=>{const contract=schema.operationContract(stage,operation);return stage===12&&operation==='VERIFY'?{...contract,scopeRequirements:[...contract.scopeRequirements].reverse()}:contract;};
  assertOrdinaryScope(reordered,orderExpected);
  assert.equal(JSON.stringify(schema.STAGE_OPERATION_SCOPE_MATRIX['12:VERIFY']),originalScope,'ORDINARY_SCOPE_ORACLE: order control changed the original declaration.');
  cases.push({name:'12:VERIFY:order-equivalent-conforming',status:'PASS',expected:'SAME_MEMBERS_AND_CLASSES_ACCEPTED',originalDeclarationUnchanged:true});
  return {scope:'Ordinary Stage10/12/29 declaration lists and dimension classes only; isolated exported-schema mutations. No command, response admission, persistence, conditional-execution scope or operator-journey claim.',cases};
}

const ordinaryScopeControls=verifyStageOperationScopes(schema);
console.log(JSON.stringify({stageOperationRegistry:'PASS',acceptanceModeControls,stages:30,operations:Object.values(expected).reduce((n,v)=>n+v.length,0),externalOperations,nonExternalOperations:Object.keys(nonExternal).length,verificationObservations,ordinaryScopeControls},null,2));
