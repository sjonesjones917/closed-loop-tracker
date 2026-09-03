import fs from 'node:fs';

const schemaPath='workflow-schema.js';
const workflowPath='.github/workflows/pages.yml';
const marker='/* CLOSED OPERATION AUTHORITY REGISTRY */';
let source=fs.readFileSync(schemaPath,'utf8');
if(!source.includes(marker)){
  source+=String.raw`

${marker}
;(()=>{
'use strict';
const s0=globalThis.closedLoopWorkflowSchema;
if(!s0)throw new Error('closedLoopWorkflowSchema must exist before operation-authority closure.');

const APPLICATION_COMMAND_KEYS=Object.freeze([
  '10:FREEZE','17:FREEZE','18:COMPLETE','19:CONFIRM_FREEZE','19:CONFIRM','20:FREEZE_BASELINE',
  '22:RUN_NATIVE_TESTS','24:RUN_NATIVE_ATTACKS','25:FREEZE_DELIVERY_CANDIDATE',
  '27:CALCULATE_RELEASE','28:VERIFY_IDENTITY','29:CALCULATE_EVIDENCE_CHAINS','30:CALCULATE_TERMINAL'
]);
const ROUTED_EXECUTION_KEYS=Object.freeze(['7:EXECUTE_FAILURE_TEST','15:EXECUTE_REGRESSION','19:REGRESSION_VERIFY']);
const HUMAN_DECISION_OPERATION_KEYS=Object.freeze(['28:CAPTURE_DELIVERY_INTENT']);
const OPERATOR_ACTION_KEYS=Object.freeze(['30:EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS','30:RECORD_DELIVERY_EVIDENCE']);
const applicationCommands=new Set(APPLICATION_COMMAND_KEYS);
const routedExecutions=new Set(ROUTED_EXECUTION_KEYS);
const humanDecisionOperations=new Set(HUMAN_DECISION_OPERATION_KEYS);
const operatorActions=new Set(OPERATOR_ACTION_KEYS);
const opKey=(stage,operation)=>\`\${Number(stage)}:\${String(operation)}\`;

const EXTERNAL_AGENT_WRITES=Object.freeze({
  '1:COMPLETE':Object.freeze([]),
  '1:SEMANTIC_CHALLENGE':Object.freeze([]),
  '1:RECONCILE_INTAKE':Object.freeze([]),
  '2:COMPLETE':Object.freeze(['sources','sourceConflicts']),
  '2:SEARCH_ADEQUACY_REVIEW':Object.freeze([]),
  '2:RECONCILE_SOURCE_SEARCH':Object.freeze(['sources','sourceConflicts']),
  '3:COMPLETE':Object.freeze(['research','candidateRequirements']),
  '3:SEMANTIC_CHALLENGE':Object.freeze([]),
  '3:RECONCILE_RESEARCH':Object.freeze(['research','candidateRequirements']),
  '4:COMPLETE':Object.freeze(['requirements','propositions']),
  '4:DISPOSITION_CHALLENGE':Object.freeze([]),
  '4:ATOMICITY_CHALLENGE':Object.freeze([]),
  '4:RECONCILE_REQUIREMENTS':Object.freeze(['requirements','propositions']),
  '5:COMPLETE':Object.freeze(['requirementResolutions','applicabilityRecords']),
  '5:SEMANTIC_REVIEW':Object.freeze([]),
  '5:RECONCILE_REQUIREMENT_SET':Object.freeze(['requirementResolutions','applicabilityRecords']),
  '6:COMPLETE':Object.freeze(['tests','proofExpressions']),
  '6:PROOF_REVIEW':Object.freeze([]),
  '6:RECONCILE_VERIFICATION_SUITE':Object.freeze(['tests','proofExpressions']),
  '7:COMPLETE':Object.freeze(['failureTests']),
  '8:COMPLETE':Object.freeze(['instructions','instructionTraces']),
  '9:COMPLETE':Object.freeze(['preflightRecords']),
  '11:EXECUTE_RUN':Object.freeze(['runs']),
  '12:VERIFY':Object.freeze(['verification','observationRecords','entailmentReviews']),
  '13:COMPARE':Object.freeze(['comparisons']),
  '14:ROOT_CAUSE':Object.freeze(['defects','rootCauses']),
  '15:COMPLETE':Object.freeze(['regressions']),
  '16:CORRECT':Object.freeze(['changes']),
  '17:EXECUTE_RUN':Object.freeze(['runs']),
  '17:VERIFY':Object.freeze(['verification','observationRecords','entailmentReviews']),
  '17:COMPARE':Object.freeze(['comparisons']),
  '17:ROOT_CAUSE':Object.freeze(['defects','rootCauses']),
  '17:REGRESSION':Object.freeze(['regressions','regressionExecutions']),
  '17:CORRECT':Object.freeze(['changes']),
  '19:EXECUTE_RUN':Object.freeze(['runs']),
  '19:VERIFY':Object.freeze(['verification','observationRecords','entailmentReviews']),
  '19:COMPARE':Object.freeze(['comparisons']),
  '21:COMPLETE':Object.freeze(['products']),
  '22:EXECUTE_EXTERNAL_TEST':Object.freeze(['observationRecords','entailmentReviews','evidenceRecords']),
  '23:COMPLETE':Object.freeze(['meaningResults','observationRecords','entailmentReviews']),
  '24:COMPLETE':Object.freeze(['adversarialResults','observationRecords','entailmentReviews']),
  '25:COMPLETE':Object.freeze(['representationInspections','observationRecords','entailmentReviews']),
  '26:COMPLETE':Object.freeze(['processAudits','productAudits']),
  '26:SEMANTIC_REVIEW':Object.freeze([]),
  '26:RECONCILE':Object.freeze(['processAudits','productAudits']),
  '27:ADVISORY_REVIEW':Object.freeze(['releaseGateReviews']),
  '29:INVESTIGATE_MISSING_EVIDENCE':Object.freeze(['evidenceInvestigations','observationRecords','entailmentReviews'])
});

const scopeClass=value=>Object.freeze(Object.fromEntries((value||[]).map(name=>[name,'INPUT_CURRENT'])));
const STAGE_OPERATION_SCOPE_MATRIX=Object.freeze(Object.fromEntries(
  Object.entries(s0.STAGE_OPERATIONS).flatMap(([stage,operations])=>operations.map(operation=>{
    const base=s0.operationContract(Number(stage),operation);
    return [opKey(stage,operation),Object.freeze({
      universal:Object.freeze(['jobId','stage','operation','projectRevision','contractProfileId','instructionOrCommandIdentity','scopeHash']),
      dimensions:Object.freeze([...(base?.scopeRequirements||[])]),
      classification:scopeClass(base?.scopeRequirements||[])
    })];
  }))
));

function classifyOperation(stage,operation,base){
  const key=opKey(stage,operation);
  if(applicationCommands.has(key))return Object.freeze({executorClass:'APPLICATION',responseEnvelopeAllowed:false,acceptanceMode:'DIRECT_APPLICATION_COMMIT',agentWritableCollections:Object.freeze([])});
  if(humanDecisionOperations.has(key))return Object.freeze({executorClass:'HUMAN_DECISION',responseEnvelopeAllowed:false,acceptanceMode:'HUMAN_DECISION_COMMAND',agentWritableCollections:Object.freeze([])});
  if(operatorActions.has(key))return Object.freeze({executorClass:'OPERATOR',responseEnvelopeAllowed:false,acceptanceMode:'OPERATOR_ACTION',agentWritableCollections:Object.freeze([])});
  if(routedExecutions.has(key))return Object.freeze({executorClass:'ROUTED_APPLICATION_OR_EXTERNAL_AGENT',responseEnvelopeAllowed:'ROUTE_DEPENDENT',acceptanceMode:'ROUTE_DEPENDENT',agentWritableCollections:Object.freeze([...(base?.agentWritableCollections||[])])});
  return Object.freeze({executorClass:'EXTERNAL_AGENT',responseEnvelopeAllowed:true,acceptanceMode:'HUMAN_ACCEPTANCE_REQUIRED',agentWritableCollections:Object.freeze([...(EXTERNAL_AGENT_WRITES[key]||base?.agentWritableCollections||[])])});
}

const STAGE_OPERATION_REGISTRY=Object.freeze(Object.fromEntries(
  Object.entries(s0.STAGE_OPERATIONS).flatMap(([stage,operations])=>operations.map(operation=>{
    const numericStage=Number(stage),base=s0.operationContract(numericStage,operation);
    if(!base)throw new Error(\`Undefined operation contract for \${stage}:\${operation}.\`);
    const authority=classifyOperation(numericStage,operation,base);
    return [opKey(stage,operation),Object.freeze({
      ...base,
      stage:numericStage,
      operation,
      executorClass:authority.executorClass,
      responseEnvelopeAllowed:authority.responseEnvelopeAllowed,
      acceptanceMode:authority.acceptanceMode,
      agentWritableCollections:authority.agentWritableCollections,
      requiredScope:STAGE_OPERATION_SCOPE_MATRIX[opKey(stage,operation)]
    })];
  }))
));

function closedOperationContract(stage,operation){return STAGE_OPERATION_REGISTRY[opKey(stage,operation)]||null;}

globalThis.closedLoopWorkflowSchema=Object.freeze({
  ...s0,
  APPLICATION_COMMAND_KEYS,
  ROUTED_EXECUTION_KEYS,
  HUMAN_DECISION_OPERATION_KEYS,
  OPERATOR_ACTION_KEYS,
  STAGE_OPERATION_REGISTRY,
  STAGE_OPERATION_SCOPE_MATRIX,
  operationContract:closedOperationContract
});
})();
`;
  fs.writeFileSync(schemaPath,source);
}

let workflow=fs.readFileSync(workflowPath,'utf8');
const proof='          node verify-operation-authority-closure.mjs\n';
if(!workflow.includes(proof)){
  const anchor='          node verify-spec3-contract.mjs\n';
  if(!workflow.includes(anchor))throw new Error('Unable to locate v3 contract proof anchor in pages workflow.');
  workflow=workflow.replace(anchor,anchor+proof);
  fs.writeFileSync(workflowPath,workflow);
}

fs.rmSync('.github/workflows/one-time-operation-authority.yml',{force:true});
fs.rmSync('.repair-operation-authority.mjs',{force:true});
