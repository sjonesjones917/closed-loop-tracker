from pathlib import Path
p=Path('workflow-schema.js')
s=p.read_text()
marker='/* OPERATION REGISTRY COMPATIBILITY AUTHORITY /3 */'
if marker not in s:
    s += r'''
/* OPERATION REGISTRY COMPATIBILITY AUTHORITY /3 */
;(()=>{
'use strict';
const b=globalThis.closedLoopWorkflowSchema;if(!b?.STAGE_OPERATION_REGISTRY)throw new Error('Closed operation registry must exist before compatibility authority.');
const exact=Object.freeze({
'1:COMPLETE':[],'1:SEMANTIC_CHALLENGE':['semanticChallenges'],'1:RECONCILE_INTAKE':['semanticChallenges','semanticReviews'],
'2:COMPLETE':['sources','sourceConflicts','sourceSearchContracts'],'2:SEARCH_ADEQUACY_REVIEW':['semanticReviews'],'2:RECONCILE_SOURCE_SEARCH':['sourceSearchContracts','semanticReviews'],
'3:COMPLETE':['research','candidateRequirements'],'3:SEMANTIC_CHALLENGE':['semanticChallenges'],'3:RECONCILE_RESEARCH':['research','candidateRequirements','semanticReviews'],
'4:COMPLETE':['requirements','propositions'],'4:DISPOSITION_CHALLENGE':['semanticChallenges','semanticReviews'],'4:ATOMICITY_CHALLENGE':['semanticChallenges','semanticReviews'],'4:RECONCILE_REQUIREMENTS':['requirements','propositions','semanticReviews'],
'5:COMPLETE':['requirementResolutions','applicabilityRecords'],'5:SEMANTIC_REVIEW':['semanticReviews'],'5:RECONCILE_REQUIREMENT_SET':['requirementResolutions','applicabilityRecords','semanticReviews'],
'6:COMPLETE':['tests','proofExpressions','expectedVarianceContracts'],'6:PROOF_REVIEW':['semanticReviews'],'6:RECONCILE_VERIFICATION_SUITE':['tests','proofExpressions','expectedVarianceContracts','semanticReviews'],
'7:COMPLETE':['failureTests'],'7:EXECUTE_FAILURE_TEST':['failureTests','regressionExecutions'],
'8:COMPLETE':['instructions','instructionTraces'],'9:COMPLETE':['preflightRecords'],
'11:EXECUTE_RUN':['runs'],'12:VERIFY':['verification'],'13:COMPARE':['comparisons'],'14:ROOT_CAUSE':['defects','rootCauses'],'15:COMPLETE':['regressions'],'15:EXECUTE_REGRESSION':['regressionExecutions'],'16:CORRECT':['changes'],
'17:EXECUTE_RUN':['runs'],'17:VERIFY':['verification'],'17:COMPARE':['comparisons'],'17:ROOT_CAUSE':['defects','rootCauses'],'17:REGRESSION':['regressions','regressionExecutions'],'17:CORRECT':['changes'],
'19:EXECUTE_RUN':['runs'],'19:VERIFY':['verification'],'19:COMPARE':['comparisons'],'19:REGRESSION_VERIFY':['regressionExecutions'],
'21:COMPLETE':['products'],'22:EXECUTE_EXTERNAL_TEST':['observationRecords','evidenceRecords'],'23:COMPLETE':['meaningResults','observationRecords','evidenceRecords'],'24:COMPLETE':['adversarialResults','observationRecords','evidenceRecords'],'25:COMPLETE':['representationInspections'],'26:COMPLETE':['processAudits','productAudits'],'26:SEMANTIC_REVIEW':['semanticReviews'],'26:RECONCILE':['processAudits','productAudits','semanticReviews'],'27:ADVISORY_REVIEW':['releaseGateReviews'],'29:INVESTIGATE_MISSING_EVIDENCE':['evidenceInvestigations']
});
const iterationReads=Object.freeze({
'17:FREEZE':['changes','candidateFreezes','iterations','tests','regressions','regressionExecutions','instructions','requirements','artifacts'],
'17:EXECUTE_RUN':['candidateFreezes','iterations','runs','freshContexts'],
'17:VERIFY':['runs','requirements','tests','freshContexts','sources','evidenceRecords'],
'17:COMPARE':['verification','runs','requirements','tests'],
'17:ROOT_CAUSE':['defects','comparisons','verification','requirements','tests','instructions','instructionTraces','runs','candidateFreezes','failureTests','requirementResolutions','candidateRequirements','research','sources','sourceConflicts','artifacts','evidenceRecords'],
'17:REGRESSION':['defects','rootCauses','comparisons','verification','runs','requirements','tests','failureTests','instructions','candidateFreezes','artifacts','evidenceRecords','regressions','regressionExecutions'],
'17:CORRECT':['defects','rootCauses','regressions','regressionExecutions','comparisons','verification','runs','requirements','requirementResolutions','candidateRequirements','research','sources','instructions','instructionTraces','tests','failureTests','candidateFreezes','artifacts','evidenceRecords','changes'],
'19:CONFIRM_FREEZE':['convergenceRecords','candidateFreezes','iterations','requirements','tests','artifacts'],
'19:EXECUTE_RUN':['candidateFreezes','iterations','runs','freshContexts'],
'19:VERIFY':['runs','requirements','tests','freshContexts','sources','evidenceRecords'],
'19:COMPARE':['verification','runs','requirements','tests'],
'19:REGRESSION_VERIFY':['regressions','regressionExecutions','runs','tests','requirements','artifacts'],
'19:CONFIRM':['runs','verification','comparisons','tests','regressions','regressionExecutions','candidateFreezes','defects','blockers','evidenceRecords','requirements']
});
const external=(c)=>c.executorClass==='EXTERNAL_AGENT'||c.executorClass==='ROUTED';
const registry=Object.freeze(Object.fromEntries(Object.entries(b.STAGE_OPERATION_REGISTRY).map(([key,c])=>{
  const legacy=b.STAGE_CONTRACTS?.[Number(c.stage)]||{};
  const writable=Object.freeze(external(c)?[...(exact[key]||[])]:[]);
  const readable=Object.freeze([...(iterationReads[key]||legacy.readCollections||[])]);
  const allowedStageData=Object.freeze(external(c)?[...(legacy.allowedStageData||[])]:[]);
  const scopeRequirements=Object.freeze(Object.entries(c.scopeContract||{}).filter(([,kind])=>kind!=='APPLICATION_DERIVED').map(([name])=>name));
  return [key,Object.freeze({...c,readCollections:readable,requiredInputFamilies:readable,writableFamilies:writable,agentWritableCollections:writable,allowedStageData,scopeRequirements})];
})));
function operationContract(stage,operation){const key=`${Number(stage)}:${String(operation||'')}`;const c=registry[key];if(!c)throw new Error(`Unknown stage-operation ${key}`);return c;}
globalThis.closedLoopWorkflowSchema=Object.freeze({...b,STAGE_OPERATION_REGISTRY:registry,operationContract});
})();
'''
p.write_text(s)

Path('verify-operation-authority-compatibility.mjs').write_text(r'''import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';class Event{constructor(type){this.type=type}}const c={console,crypto:webcrypto,TextEncoder,TextDecoder,structuredClone,Uint8Array,ArrayBuffer,Date,Math,JSON,Set,Map,Event,dispatchEvent:()=>true};c.globalThis=c;vm.createContext(c);for(const f of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});const s=c.closedLoopWorkflowSchema;
for(const key of ['18:COMPLETE','22:RUN_NATIVE_TESTS','24:RUN_NATIVE_ATTACKS','25:FREEZE_DELIVERY_CANDIDATE','27:CALCULATE_RELEASE','29:CALCULATE_EVIDENCE_CHAINS','30:CALCULATE_TERMINAL']){const o=s.STAGE_OPERATION_REGISTRY[key];assert.deepEqual([...o.agentWritableCollections],[],`${key} must expose no agent-writable family`);assert.deepEqual([...o.allowedStageData],[],`${key} application command cannot accept agent stage data`);assert.equal(o.acceptsExternalResponse,false);}
assert.deepEqual([...s.operationContract(3,'COMPLETE').readCollections],['sources','sourceConflicts'],'Stage 03 must read current Stage 02 source records');
assert.deepEqual([...s.operationContract(19,'COMPARE').agentWritableCollections],['comparisons'],'Stage 19 COMPARE must not write runs or other iteration families');assert.deepEqual([...s.operationContract(19,'EXECUTE_RUN').agentWritableCollections],['runs']);assert.deepEqual([...s.operationContract(17,'VERIFY').agentWritableCollections],['verification']);assert.deepEqual([...s.operationContract(27,'ADVISORY_REVIEW').agentWritableCollections],['releaseGateReviews']);
assert.deepEqual([...s.operationContract(17,'EXECUTE_RUN').readCollections],['candidateFreezes','iterations','runs','freshContexts']);assert.ok(s.operationContract(17,'VERIFY').readCollections.includes('sources'));assert.ok(!s.operationContract(17,'EXECUTE_RUN').readCollections.includes('verification'));
const verify=s.operationContract(12,'VERIFY');assert.ok(verify.scopeRequirements.includes('runId'));assert.ok(verify.scopeRequirements.includes('requirementsVersion'));assert.ok(verify.scopeRequirements.includes('testSuiteVersion'));assert.equal(typeof c.closedLoopPromptEngine?.buildPromptRecord,'function');console.log('operation authority compatibility regression passed');
''')