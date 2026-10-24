import assert from 'node:assert/strict';

const timingMatrixGuard="if(!timingFault&&(!process.argv.includes('--timing-only')||process.argv.includes('--timing-fault-matrix'))){";
const recoveryMatrixDispatch='if([3,12,19,26,27,29,30].includes(stage))verifyRecoveryCompatibility(stage);';
const comparisonMatrixDispatch='if([13,17,19].includes(stage))verifyIterationComparisonGate(stage);';
const continuationGuard=String.raw`if(!p.stages[stage].gate.complete&&Number(String(p.job.CURRENT_STAGE).match(/\d+/)?.[0])===stage&&['EXTERNAL_AGENT_TOOL','AI_REVIEW','SELECT_RESPONSE_JSON_FILE'].includes(p.job.NEXT_REQUIRED_ACTION.actionType)){`;
const prerequisiteTransforms=[
  [timingMatrixGuard,'if(false){ // Healthy prerequisite only; the full-cycle owner executes every timing fault.','timing-matrix'],
  [recoveryMatrixDispatch,'/* The full-cycle owner executes every recovery fault. */','recovery-matrix'],
  [comparisonMatrixDispatch,'/* The full-cycle owner executes every comparison fault. */','comparison-matrix'],
  ...[13,17,19].map(stage=>[`verifyComparisonReplacement(${stage});`,'/* The full-cycle owner verifies comparison replacement and retry. */','comparison-replacement-'+stage]),
  ['assertIndependentRefinement(p,stage,changes,changes[0].rawResponseId);','/* The full-cycle owner verifies independent refinement isolation. */','independent-refinement'],
  [continuationGuard,'if(false){ /* The full-cycle owner verifies the discarded continuation clone. */','continuation-control']
];

// A disposable healthy prerequisite must traverse the real lifecycle, but it
// does not own the lifecycle's separately required auxiliary controls. Keep
// the default verifier unchanged; only the generated prerequisite source uses
// this exact, guarded transformation. It cannot issue a full-cycle receipt.
export function healthyFullCyclePrerequisiteSource(source){
  for(const [anchor,,label] of prerequisiteTransforms)assert.equal(source.split(anchor).length-1,1,'HEALTHY_LIFECYCLE_PREREQUISITE_ANCHOR_ORACLE: exactly one '+label+' dispatch is required.');
  for(const [anchor,replacement] of prerequisiteTransforms)source=source.replace(anchor,replacement);
  return source;
}
