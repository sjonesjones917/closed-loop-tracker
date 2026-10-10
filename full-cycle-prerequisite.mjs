import assert from 'node:assert/strict';

const timingMatrixGuard="if(!timingFault&&(!process.argv.includes('--timing-only')||process.argv.includes('--timing-fault-matrix'))){";

// A disposable healthy prerequisite must traverse the real lifecycle, but it
// does not own the lifecycle's separately required timing-fault matrix. Keep
// the default verifier unchanged; only the generated prerequisite source uses
// this exact, guarded transformation. It cannot issue a full-cycle receipt.
export function healthyFullCyclePrerequisiteSource(source){
  assert.equal(source.split(timingMatrixGuard).length-1,1,'HEALTHY_LIFECYCLE_PREREQUISITE_ANCHOR_ORACLE: exactly one timing-matrix dispatch is required.');
  return source.replace(timingMatrixGuard,'if(false){ // Healthy prerequisite only; the full-cycle owner executes every timing fault.');
}
