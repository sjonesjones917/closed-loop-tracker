(()=>{
'use strict';

const upper=value=>String(value??'').trim().toUpperCase();
const safe=value=>Array.isArray(value)?value:[];
const fields=record=>record?.fields&&typeof record.fields==='object'?record.fields:record||{};
const value=(record,key)=>fields(record)?.[key]??record?.[key];
const text=value=>String(value??'').trim();
const favorable=value=>['SATISFIED','PASSED','PASS','SUCCESS','SUCCEEDED','COMPLETE','COMPLETED','CONFIRMED','ACCEPTED','AUTHORIZED'].includes(upper(value));
const violated=value=>['VIOLATED','FAILED','FAIL','REJECTED','REJECTED_INVALID','INVALID','ERROR','EXECUTION_FAILED'].includes(upper(value));
const unknown=value=>['','UNKNOWN','UNDETERMINED','BLOCKED','NOT RUN','NOT_RUN','UNAVAILABLE','PENDING','UNASSIGNED'].includes(upper(value));
const none=value=>['','NONE','NO','FALSE','0','NOT APPLICABLE','N/A','CLEAN','UNCHANGED','NO CHANGE','NO CHANGES','NO VARIANCE','NO DEFECTS','NO FAILURES','NO BLOCKERS','NONE RECORDED'].includes(upper(value));
const material=value=>{if(Array.isArray(value))return value.some(material);if(value&&typeof value==='object')return Object.values(value).some(material);const v=upper(value);return Boolean(v)&&!none(v)&&!['SATISFIED','PASS','PASSED','SUCCESS','SUCCEEDED','TRUE','YES','MATCH','MATCHED','IDENTICAL','COMPLETE','COMPLETED','AUTHORIZED','ACCEPTED','EXPECTED REJECTION OBSERVED','REJECTED_INVALID'].includes(v);};
const affirmative=value=>['TRUE','YES','PRESENT','DETECTED','OCCURRED','OCCURS','VIOLATED','FAILED','FAIL','MISMATCH','MISMATCHED','UNAUTHORIZED'].includes(upper(value));
const negative=value=>['FALSE','NO','NONE','0','NOT APPLICABLE','N/A','CLEAN','MATCH','MATCHED','IDENTICAL','SATISFIED','PASS','PASSED','SUCCESS','SUCCEEDED'].includes(upper(value));
const failureObservation=value=>{const v=upper(value);return ['FAILED','FAIL','VIOLATED','REJECTED','ERROR','EXECUTION_FAILED','ACCEPTED_INVALID'].includes(v)||/\b(?:FAIL(?:ED|URE)?|VIOLAT(?:ED|ION)|ERROR|INVALID\s+(?:WAS\s+)?ACCEPTED|UNAUTHORIZED|MISMATCH|DEFECT|BLOCKER)\b/.test(v)&&!/\b(?:NO|NONE|ZERO|WITHOUT)\s+(?:FAIL|VIOLATION|ERROR|UNAUTHORIZED|MISMATCH|DEFECT|BLOCKER)/.test(v);};
const successObservation=value=>{const v=upper(value);return ['SATISFIED','PASSED','PASS','SUCCESS','SUCCEEDED','REJECTED_INVALID','EXPECTED REJECTION OBSERVED','MATCH','MATCHED','IDENTICAL'].includes(v);};

function evidenceContract({test,result,evidence=[],artifacts=[],currentScope={}}={}){
  const reasons=[],mode=upper(value(test,'EXECUTION_MODE')),type=upper(value(test,'TEST_TYPE')),artifactRequirements=text(value(test,'ARTIFACT_REQUIREMENTS')),testText=[type,mode,artifactRequirements,value(test,'INPUTS'),value(test,'TOOLS'),value(test,'PROCEDURE'),value(test,'EXPECTED_RESULT'),value(test,'FAILURE_CONDITION'),value(test,'EVIDENCE_TO_PRESERVE')].join(' '),byteRequired=Boolean(artifactRequirements&&!['NONE','NOT APPLICABLE','N/A'].includes(upper(artifactRequirements)))||/\b(?:SHA-?256|HASH|BYTE(?:S|[- ]IDENTITY)?|CRYPTOGRAPHIC IDENTITY)\b/i.test(testText),verified=artifacts.filter(a=>upper(value(a,'AVAILABILITY'))==='BYTES_PERSISTED_AND_VERIFIED'&&/^[a-f0-9]{64}$/i.test(text(value(a,'SHA256')))&&Number.isFinite(Number(value(a,'BYTE_SIZE')))),hasEvidence=evidence.length>0||Boolean(text(value(result,'EXACT_EVIDENCE')||value(result,'EVIDENCE')||value(result,'PROCESS_EVIDENCE')||value(result,'PRODUCT_EVIDENCE')));
  if(mode==='UNAVAILABLE')reasons.push('UNAVAILABLE execution cannot establish satisfaction.');
  if(!hasEvidence)reasons.push('No attributable evidence is present.');
  if(byteRequired&&!verified.length)reasons.push('Application-verified bytes and SHA-256 are required.');
  if(mode==='HUMAN_INSPECTION'&&!evidence.some(e=>/HUMAN/.test(upper(value(e,'AUTHORITY_TYPE')||value(e,'KIND')))))reasons.push('Actual human observation evidence is required.');
  if(mode==='EXTERNAL_SYSTEM'&&!evidence.some(e=>/SYSTEM|LAB|MACHINE|EXTERNAL/.test(upper(value(e,'AUTHORITY_TYPE')||value(e,'KIND')))))reasons.push('Evidence attributable to the required external system is required.');
  if(mode==='EXTERNAL_AGENT_TOOL'){
    if(!text(value(test,'REQUIRED_CAPABILITY')))reasons.push('Required tool/capability identity is missing.');
    if(!text(value(result,'OBSERVED_RESULT')||value(result,'ACTUAL_RESULT')))reasons.push('Actual observed execution result is missing.');
  }
  if(type==='MEANING'||Object.prototype.hasOwnProperty.call(fields(result),'OBSERVED_MEANING'))for(const key of ['PRODUCT_LOCATION','REQUIRED_MEANING','OBSERVED_MEANING','EVIDENCE_BASED_COMPARISON'])if(!text(value(result,key)))reasons.push('Meaning evidence is missing '+key+'.');
  return {sufficient:reasons.length===0,reasons,verifiedArtifactIds:verified.map(a=>text(value(a,'ARTIFACT_ID')||a.id)).filter(Boolean),currentScope};
}

function resultConsistency({collection,record,test,evidenceContractResult=null,contextIndependence=null,canonical={}}={}){
  const reasons=[],claimed=upper(value(record,'DETERMINATION')||value(record,'PROCESS_DETERMINATION')||value(record,'PRODUCT_DETERMINATION')||value(record,'RESULT')||value(record,'STATUS'));
  const fail=(reason)=>reasons.push(reason);
  if(['verification','deterministicResults','adversarialResults'].includes(collection)&&failureObservation(value(record,'OBSERVED_RESULT')||value(record,'ACTUAL_RESULT'))&&favorable(claimed))fail('Failure observation conflicts with favorable claimed determination.');
  if(collection==='preflightRecords'){
    const bad=['MULTIPLE_INTERPRETATIONS','UNDEFINED_OBJECTS','UNSUPPLIED_DEPENDENCIES','INTERNAL_CONFLICTS','UNAVAILABLE_CAPABILITIES'].some(k=>material(value(record,k)))||negative(value(record,'OBJECTIVELY_VERIFIABLE'))||negative(value(record,'RESPONSIBLE_OPERATION_ASSIGNED'))||negative(value(record,'ORDER_CLEAR'))||negative(value(record,'FAILURE_BEHAVIOR_DEFINED'))||material(value(record,'FINDINGS'));
    if(bad&&favorable(claimed))fail('Unresolved material preflight defect conflicts with favorable determination.');
  }
  if(collection==='failureTests'){
    const actual=upper(value(record,'EXECUTION_OUTCOME')||value(record,'ACTUAL_RESULT'));
    if(actual==='ACCEPTED_INVALID'&&!text(value(record,'VALIDATOR_DEFECT_ID')||record?.relationships?.VALIDATOR_DEFECT_ID))fail('Invalid fixture was accepted without a linked validator defect.');
    if(['NOT_RUN','UNDETERMINED','UNKNOWN',''].includes(actual))fail('Failure fixture execution is not established.');
  }
  if(collection==='regressionExecutions'){
    const phase=upper(value(record,'PHASE')),actual=upper(value(record,'RESULT'));
    if(phase==='PRE_CORRECTION'&&!violated(actual))fail('Pre-correction regression execution did not reproduce the failure.');
    if(phase!=='PRE_CORRECTION'&&!successObservation(actual))fail('Post-correction regression execution did not demonstrate success.');
  }
  if(collection==='confirmationRecords'){
    const changed=!['TRUE','YES','ZERO','NONE','NO CHANGES'].includes(upper(value(record,'ZERO_MATERIAL_CHANGES')))||material(value(record,'NEW_DEFECTS'))||material(value(record,'NEW_REQUIREMENTS'))||material(value(record,'NEW_FAILURE_CASES'))||material(value(record,'NEW_VARIANCE'));
    if(changed&&favorable(claimed))fail('Change, new defect, new requirement, failure case, or variance conflicts with unchanged-confirmation success.');
  }
  if(collection==='products'){
    if(material(value(record,'FAILURES')))fail('Production execution reports material failures.');
    if(material(value(record,'DEVIATIONS'))&&!canonical.authorizedDeviation)fail('Production execution reports unresolved material or unauthorized deviations.');
  }
  if(collection==='meaningResults'){
    if(!text(value(record,'PRODUCT_LOCATION'))||!text(value(record,'REQUIRED_MEANING'))||!text(value(record,'OBSERVED_MEANING'))||!text(value(record,'EVIDENCE_BASED_COMPARISON')))fail('Meaning proposition lacks required comparison facts.');
    if(failureObservation(value(record,'EVIDENCE_BASED_COMPARISON'))&&favorable(claimed))fail('Meaning comparison conflicts with favorable determination.');
  }
  if(collection==='representationInspections'&&material(value(record,'OBSERVATIONS'))&&failureObservation(value(record,'OBSERVATIONS'))&&favorable(claimed))fail('Material representation defect conflicts with favorable determination.');
  if(collection==='processAudits'){
    if(material(value(record,'APPROVED_INPUTS_VS_ACTUAL'))&&failureObservation(value(record,'APPROVED_INPUTS_VS_ACTUAL')))fail('Approved inputs do not match actual inputs.');
    if(material(value(record,'APPROVED_INSTRUCTION_VS_ACTUAL'))&&failureObservation(value(record,'APPROVED_INSTRUCTION_VS_ACTUAL')))fail('Approved instruction does not match actual instruction.');
    if(material(value(record,'APPROVED_TOOLS_VS_ACTUAL'))&&failureObservation(value(record,'APPROVED_TOOLS_VS_ACTUAL')))fail('Approved tools do not match actual tools.');
    if(material(value(record,'REQUIRED_TESTS_VS_EXECUTED'))&&failureObservation(value(record,'REQUIRED_TESTS_VS_EXECUTED')))fail('Required tests were not executed as approved.');
    if(affirmative(value(record,'UNAUTHORIZED_MODIFICATION')))fail('Unauthorized modification occurred.');
    if(failureObservation(value(record,'CHAIN_OF_CUSTODY')))fail('Chain of custody is broken.');
    if(material(value(record,'PROCESS_DEFECTS')))fail('Material process defects remain.');
    if(material(value(record,'BLOCKERS')))fail('Process blockers remain.');
  }
  if(collection==='productAudits'){
    if(material(value(record,'PRODUCT_DEFECTS')))fail('Product defects remain.');
    if(material(value(record,'BLOCKERS')))fail('Product blockers remain.');
    if(Number(value(record,'CRITICAL_DEFECTS')||0)>0||Number(value(record,'MAJOR_DEFECTS')||0)>0||Number(value(record,'MANDATORY_UNKNOWNS')||0)>0)fail('Product audit canonical counts contain release-blocking facts.');
    if(failureObservation(value(record,'VALIDATOR_RESULTS'))||failureObservation(value(record,'MEANING_VERIFICATION_RESULTS')))fail('Product audit reports failed mandatory verification.');
  }
  if(evidenceContractResult&&!evidenceContractResult.sufficient&&favorable(claimed))fail('Favorable claim lacks structurally sufficient evidence.');
  if(contextIndependence&&contextIndependence.required&&contextIndependence.determination!=='APPLICATION_ESTABLISHED'&&favorable(claimed))fail('Release-critical independence is not application-established.');
  return {consistent:reasons.length===0,reasons,claimed};
}

function effectiveDetermination(args={}){
  const consistency=resultConsistency(args),claimed=consistency.claimed;
  if(!consistency.consistent){const hard=consistency.reasons.some(r=>/failure|violat|unauthorized|defect|mismatch|broken|accepted without|did not reproduce/i.test(r));return {determination:hard?'VIOLATED':'UNDETERMINED',claimed,reasons:consistency.reasons};}
  if(violated(claimed))return {determination:'VIOLATED',claimed,reasons:[]};
  if(unknown(claimed))return {determination:'UNDETERMINED',claimed,reasons:[]};
  if(favorable(claimed))return {determination:'SATISFIED',claimed,reasons:[]};
  return {determination:'UNDETERMINED',claimed,reasons:['Claimed conclusion is not a controlled favorable or failure state.']};
}

function traceIntegrity({kind,record,canonical={}}={}){
  const reasons=[];
  if(kind==='RCA'){
    for(const key of ['DEFECT_ID','LAYER_TRACE','EARLIEST_DEFECTIVE_LAYER','ROOT_CAUSE','EVIDENCE','DOWNSTREAM_INVALIDATION'])if(!text(value(record,key)||record?.relationships?.[key]))reasons.push('RCA missing '+key+'.');
    if(canonical.defectId&&text(value(record,'DEFECT_ID')||record?.relationships?.DEFECT_ID)!==canonical.defectId)reasons.push('RCA defect identity does not match the current defect.');
  }
  if(kind==='CHANGE'){
    for(const key of ['TRIGGERING_DEFECT_IDS','RESPONSIBLE_LAYER','EXACT_MODIFICATION','NEW_ARTIFACT_VERSION','DOWNSTREAM_INVALIDATION','REQUIRED_RERUNS'])if(!text(value(record,key)))reasons.push('Change trace missing '+key+'.');
    if(canonical.earliestDefectiveLayer&&upper(value(record,'RESPONSIBLE_LAYER'))!==upper(canonical.earliestDefectiveLayer)&&!canonical.controlledOverride)reasons.push('Changed responsible layer does not match RCA earliest defective layer.');
    if(text(value(record,'OLD_ARTIFACT_VERSION'))&&text(value(record,'OLD_ARTIFACT_VERSION'))===text(value(record,'NEW_ARTIFACT_VERSION')))reasons.push('Artifact version may not be modified in place.');
  }
  return {valid:reasons.length===0,reasons};
}

globalThis.closedLoopSemanticAdjudication=Object.freeze({evidenceContract,resultConsistency,effectiveDetermination,traceIntegrity,favorable,violated,unknown,failureObservation,material});
})();
