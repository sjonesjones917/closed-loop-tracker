import fs from 'node:fs';
import assert from 'node:assert/strict';
import {classifyControllerChange} from './classify-controller-change.mjs';

const state='verification/closed-loop-build-state.json';
assert.deepEqual(classifyControllerChange([state,'verification/build-stages/stage-03-proof.json']),{controllerProofOnly:true,stage:'03',paths:[state,'verification/build-stages/stage-03-proof.json'].sort()});
for(const fixture of [
  [state],
  [state,'verification/build-stages/stage-02-proof.json'],
  [state,'verification/build-stages/stage-29-proof.json'],
  [state,'verification/build-stages/stage-03-proof.json','workflow-schema.js'],
  ['verification/build-stages/stage-03-proof.json','workflow-schema.js']
])assert.equal(classifyControllerChange(fixture).controllerProofOnly,false,`Invalid proof-only fixture was accepted: ${fixture}`);
const mobile=fs.readFileSync('verify-mobile-acceptance-evidence.mjs','utf8');
assert.doesNotMatch(mobile,/git\s*['"]?,?\s*\[?['"]push['"]/,'The mobile-evidence verifier must not attempt a direct canonical-main push.');
assert.doesNotMatch(mobile,/HEAD:main/,'The mobile-evidence verifier must not bypass the authorized pull-request merge path.');
const preparer=fs.readFileSync('prepare-controller-stage-proof.mjs','utf8');
assert.match(preparer,/verify-controller-stage-bundle\.mjs/);
assert.match(preparer,/verify-build-stage-ledger\.mjs/);
const verifier=fs.readFileSync('verify-controller-proof-change.mjs','utf8');
assert.match(verifier,/CONTROLLER_BASE_COMMIT/);
assert.match(verifier,/deterministic stage proof regenerated from the exact base ledger/i);
console.log(JSON.stringify({controllerProofRouting:'PASS',validProofOnlyAccepted:true,invalidProofOnlyRejected:5,directMainPushes:0,authorizedPullRequestPath:true}));
