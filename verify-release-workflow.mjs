import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DEPLOYMENT_REBUILD_PERMITTED} from './deployment-contract.mjs';

assert.equal(DEPLOYMENT_REBUILD_PERMITTED,false,'The deployment contract must prohibit rebuilding after verification.');

const workflow=fs.readFileSync('.github/workflows/pages.yml','utf8');
const actionUses=[...workflow.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)\s*$/gm)].map(match=>match[1]);
assert(actionUses.length>0,'Release workflow has no recorded actions.');
for(const use of actionUses)assert.match(use,/@[a-f0-9]{40}$/i,`Release action is not pinned to an immutable commit: ${use}`);
const nodeVersions=[...workflow.matchAll(/node-version:\s*['"]([^'"]+)['"]/g)].map(match=>match[1]);
assert(nodeVersions.length>=3,'Every Node-based release job must pin its runtime.');
assert(nodeVersions.every(version=>/^\d+\.\d+\.\d+$/.test(version)),`Floating Node runtime found: ${nodeVersions.join(', ')}`);
assert.equal(new Set(nodeVersions).size,1,'Release jobs use mixed Node toolchain versions.');

const testBlock=workflow.match(/\n  test:\n([\s\S]*?)\n  deploy:\n/)?.[1]||'';
const deployBlock=workflow.match(/\n  deploy:\n([\s\S]*?)\n  verify-live:\n/)?.[1]||'';
const liveBlock=workflow.match(/\n  verify-live:\n([\s\S]*?)\n  publish-status:\n/)?.[1]||'';
const publishBlock=workflow.match(/\n  publish-status:\n([\s\S]*)$/)?.[1]||'';
assert(testBlock&&deployBlock&&liveBlock&&publishBlock,'Expected test/deploy/verify-live/publish-status job topology is missing.');
assert(testBlock.includes('verify-controlling-completion.mjs'),'Sections 53-70 controlling-completion proof is absent from the test job.');
const testFullCycleCommand='FULL_CYCLE_TERMINAL_REPORT_PATH="$terminal_report" node verify-full-cycle.mjs',testControllingCommand='FULL_CYCLE_TERMINAL_REPORT_PATH="$terminal_report" node verify-controlling-completion.mjs';
assert.equal((testBlock.match(/node verify-full-cycle\.mjs/g)||[]).length,1,'The test job must execute the expensive full cycle exactly once.');
assert(testBlock.includes(testFullCycleCommand)&&testBlock.includes(testControllingCommand),'The test job does not bind full-cycle production and controlling consumption to one terminal evidence report path.');
assert(testBlock.indexOf(testFullCycleCommand)<testBlock.indexOf(testControllingCommand),'The test job consumes terminal evidence before the full cycle emits it.');
for(const proof of ['verify-objective-attestation.mjs','verify-prompt-ingestion-boundaries.mjs','verify-semantic-review-contract.mjs','verify-semantic-review-ingestion.mjs','verify-stage6-package-ui.mjs','verify-terminal-delivery-lifecycle.mjs'])assert(testBlock.includes(proof),`Focused completion proof is absent from the test job: ${proof}`);
assert(testBlock.includes('build-static-site.mjs')&&testBlock.includes('CHECKED_BY_SECOND_CLEAN_MANIFEST_BUILD'),'The verified static artifact is not produced by the reproducibility-checked build path.');
assert(testBlock.includes('diff -rq .deployment-proof-a .deployment-proof-b'),'The release build lacks a second clean exact-byte comparison.');
assert(testBlock.includes('CLOSED_LOOP_VERIFY_PRODUCER_ENVIRONMENT=true'),'The producing build job does not verify its own recorded environment identity.');
assert(testBlock.includes('verify-deployment-manifest-negative.mjs'),'Deployment manifest mutation proof is absent.');
assert(testBlock.includes('verify-release-workflow.mjs'),'Release workflow self-verification is absent.');
assert(testBlock.includes('python3 -m http.server 4173 --directory _site'),'Local browser acceptance is not exercising the exact assembled deployment bytes.');
assert(testBlock.includes('CLOSED_LOOP_STATIC_ROOT="$PWD/_site"'),'Self-hosted walkthrough browser acceptance is not exercising the exact assembled deployment bytes.');
assert(testBlock.includes('PAGE_URL="http://127.0.0.1:4173/"'),'Local cached-profile acceptance is not bound to the assembled deployment origin.');
assert(testBlock.includes('verify-amendment-ui-browser.mjs'),'Local browser acceptance omits the controlling-completion operator path.');
assert(testBlock.includes('verify-cached-deployment-profile.mjs'),'Local browser acceptance omits the clean and pre-cached deployment-profile proof.');
assert(testBlock.indexOf('Local Chromium operator path')<testBlock.indexOf('actions/upload-pages-artifact@'),'The Pages artifact is uploaded before browser verification completes.');
assert(testBlock.includes('closed-loop-verified-site.tar')&&testBlock.includes('sha256sum closed-loop-verified-site.tar'),'The exact verified site bytes are not preserved with an independently checked archive digest.');
const finalArtifactReverification=testBlock.lastIndexOf('CLOSED_LOOP_VERIFY_PRODUCER_ENVIRONMENT=true node verify-deployment-manifest.mjs _site/deployment-manifest.json'),archiveCapture=testBlock.indexOf('tar --sort=name');
assert(finalArtifactReverification>=0&&archiveCapture>finalArtifactReverification,'The final site bytes are not reverified immediately before retention.');
assert(testBlock.includes('actions/upload-artifact@')&&testBlock.includes('closed-loop-verified-site-${{ github.sha }}-${{ github.run_id }}'),'The exact verified site archive is not independently retrievable by downstream proof jobs.');
assert(testBlock.includes('actions/upload-pages-artifact@'),'The verified artifact is not preserved by the producing test job.');

assert.match(workflow,/\n  deploy:\n[\s\S]*?needs:\s*test\n/,'Deployment does not depend on the verified build job.');
assert(!/actions\/checkout@|actions\/setup-node@|build-static-site|build-test-project|upload-pages-artifact/.test(deployBlock),'Deploy job rebuilds or replaces the exact verified Pages artifact.');
assert(deployBlock.includes('actions/configure-pages@')&&deployBlock.includes('actions/deploy-pages@'),'Deploy job does not consume the retained Pages artifact through the pinned Pages actions.');

assert.match(workflow,/\n  verify-live:\n[\s\S]*?needs:\s*\[test, deploy\]\n/,'Live proof does not depend on both exact build and deployment.');
for(const proof of ['verify-live.mjs','verify-deployed-resource-graph.mjs','verify-deployment-manifest.mjs'])assert(liveBlock.includes(proof),`Live proof omits ${proof}.`);
assert(liveBlock.includes('verify-amendment-ui-browser.mjs'),'Deployed browser acceptance omits the controlling-completion operator path.');
assert(liveBlock.includes('verify-cached-deployment-profile.mjs'),'Deployed browser acceptance omits the clean and pre-cached deployment-profile proof.');
assert(liveBlock.includes('actions/download-artifact@')&&liveBlock.includes('closed-loop-verified-site-${{ github.sha }}-${{ github.run_id }}'),'Live proof does not retrieve the exact artifact produced by the verified build job.');
assert(liveBlock.includes('sha256sum -c closed-loop-verified-site.tar.sha256'),'Live proof does not reverify the retained artifact archive before use.');
assert(!/build-static-site|build-test-project/.test(liveBlock),'Live proof rebuilds instead of consuming the exact verified artifact.');

assert.match(workflow,/\n  publish-status:\n[\s\S]*?needs:\s*\[test, deploy, verify-live\]\n/,'Machine acceptance can publish before deployed operator-path proof completes.');
for(const proof of ['verify-controlling-completion.mjs','verify-deployment-manifest.mjs','verify-deployment-manifest-negative.mjs','verify-release-workflow.mjs','verify-live.mjs','verify-deployed-resource-graph.mjs','verify-cached-deployment-profile.mjs'])assert(publishBlock.includes(proof),`Machine acceptance report does not execute/include ${proof}.`);
assert.equal((publishBlock.match(/node verify-full-cycle\.mjs/g)||[]).length,1,'The publish-status job must execute the expensive full cycle exactly once.');
assert(publishBlock.includes(testFullCycleCommand)&&publishBlock.includes(testControllingCommand),'Machine acceptance does not bind full-cycle production and controlling consumption to one terminal evidence report path.');
assert(publishBlock.indexOf(testFullCycleCommand)<publishBlock.indexOf(testControllingCommand),'Machine acceptance consumes terminal evidence before the full cycle emits it.');
assert(publishBlock.includes('fullCycleTerminalEvidence')&&publishBlock.includes('full-cycle-terminal-evidence.json'),'Machine acceptance does not preserve the exact hash-bound terminal evidence report.');
for(const proof of ['verify-objective-attestation.mjs','verify-prompt-ingestion-boundaries.mjs','verify-semantic-review-contract.mjs','verify-semantic-review-ingestion.mjs','verify-stage6-package-ui.mjs','verify-terminal-delivery-lifecycle.mjs'])assert(publishBlock.includes(proof),`Machine acceptance omits focused completion proof ${proof}.`);
assert(publishBlock.includes('actions/download-artifact@')&&publishBlock.includes('sha256sum -c closed-loop-verified-site.tar.sha256'),'Machine acceptance does not consume and reverify the exact retained deployment artifact.');
assert(!publishBlock.includes('build-static-site.mjs _site'),'Machine acceptance rebuilds the deployment artifact instead of consuming the retained bytes.');
assert(publishBlock.includes('deploymentRebuildPermitted:false'),'Machine acceptance omits the explicit no-rebuild source-to-deployment provenance conclusion.');
assert(publishBlock.includes('HOSTED_PLATFORM_COMPROMISE_NOT_RULED_OUT'),'Machine acceptance overstates hosted-platform supply-chain assurance.');
assert(publishBlock.includes('actualAndroidChromeAcceptance:false'),'Machine acceptance improperly implies actual Android Chrome proof.');
assert(publishBlock.includes('fullProductionMaturity:false'),'Machine acceptance improperly implies universal production maturity.');
assert(!/uses:\s*[^\s]+@(main|master|v\d+(?:\.\d+)*)\b/i.test(workflow),'Floating action revision remains in the release workflow.');

console.log(JSON.stringify({
  releaseWorkflow:'PASS',
  immutableActionPins:actionUses.length,
  nodeToolchainVersion:nodeVersions[0],
  exactVerifiedArtifactDeployment:true,
  downstreamArtifactRebuilds:0,
  exactVerifiedArtifactRetrievedByLiveProof:true,
  deploymentRebuildPermitted:DEPLOYMENT_REBUILD_PERMITTED,
  deploymentRebuilds:0,
  secondCleanBuildComparison:true,
  sourceToBuildProvenance:true,
  controllingCompletionInAcceptance:true,
  singleFullCycleTerminalEvidenceBinding:true,
  deploymentManifestInAcceptance:true,
  liveResourceGraphInAcceptance:true,
  cachedDeploymentProfileInAcceptance:true,
  unsupportedProductionClaims:0
},null,2));
