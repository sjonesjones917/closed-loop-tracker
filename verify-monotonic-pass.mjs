import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const prompt=read('./prompt-engine.js');
const engine=read('./workflow-engine.js');
const app=read('./app-core.js');
const runtime=read('./test-runtime.js');
const ingestionVerifier=read('./verify-ingestion.mjs');
const index=read('./index.html');
const workflow=read('./.github/workflows/pages.yml');
const live=read('./verify-live.mjs');
const workflowFiles=fs.readdirSync(new URL('./.github/workflows/',import.meta.url)).filter(name=>/\.ya?ml$/i.test(name));

assert.deepEqual(workflowFiles,['pages.yml'],'One-time repair workflows must be removed before the candidate can be accepted.');
assert.ok(app.includes('Independent external sources only.'),'Stage 02 operator UI must state the independent-external-source boundary explicitly.');
assert.ok(prompt.includes('Research only the current accepted Stage 02 independent external source set'),'Stage 03 prompt must bind research to the complete current accepted Stage 02 source set.');
assert.ok(prompt.includes('Resolve the current job’s requirement set exhaustively'),'Stage 05 prompt must require exhaustive resolution of the current requirement set.');

assert.match(prompt,/originalUserEntered\s*:\s*state\?\.projectData\?\.userEntered\s*\|\|\s*\{\}/,'Stage 04 context must retain current User Job Input.');
assert.ok(prompt.includes('if(stage===4)assertStage4UpstreamExhausted(state);assertPromptPrerequisites(stage,state);'),'Stage 04 exhaustion must be checked before generic prompt prerequisites.');
assert.match(prompt,/never ask the user to repeat available project facts/i,'Prompts must prohibit repeated user-intent transcription in ordinary operator language.');

assert.match(ingestionVerifier,/name==='TEST_TYPE'\)return '(?:DETERMINISTIC|MEANING|ADVERSARIAL)'/,'Stage 06 ingestion fixture must use a valid TEST_TYPE enum.');
assert.match(ingestionVerifier,/name==='EXECUTION_MODE'\)return '(?:APPLICATION_DETERMINISTIC|EXTERNAL_AGENT_TOOL|INDEPENDENT_AGENT_REVIEW|HUMAN_INSPECTION|EXTERNAL_SYSTEM|UNAVAILABLE)'/,'Stage 06 ingestion fixture must use a valid EXECUTION_MODE enum.');

assert.match(engine,/missingBoundArtifacts\s*=\s*executionPlan\.items\.filter/,'Stage 06 must block mandatory tests whose exact bound artifact bytes are unavailable.');
assert.ok(engine.includes('plans=testExecutionPlan(project).items.filter('),'Evidence evaluation must consume the single execution-plan item set.');
assert.match(engine,/HUMAN_OBSERVATION'[\s\S]{0,220}HUMAN_INSPECTION/,'Human inspection evidence must recognize the registered human evidence authorities.');

assert.ok(!index.includes('.expandable-prompt{height:280px;'),'The approved prompt box must not be forced to a fixed height.');
assert.ok(index.includes('.expandable-prompt{max-height:280px}'),'The approved prompt preview maximum height must remain present.');
assert.match(app,/proposal diff shows the current value beside the proposed value/i,'Proposal review must explicitly expose current and proposed values.');

const appBuild=app.match(/RUNTIME_BUILD_ID='([^']+)'/)?.[1];
const runtimeBuild=runtime.match(/RUNTIME_BUILD_ID='([^']+)'/)?.[1];
assert.ok(appBuild,'app-core.js must declare the runtime build identity.');
assert.equal(runtimeBuild,appBuild,'test-runtime.js and app-core.js must share one runtime build identity.');
const scriptSources=[...index.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
assert.equal(scriptSources.length,9,'Exactly nine runtime scripts must be loaded directly.');
const scriptBuilds=new Set(scriptSources.map(source=>new URLSearchParams(source.split('?')[1]||'').get('v')));
assert.deepEqual([...scriptBuilds],[appBuild],'Every runtime script URL must use the shared runtime build identity.');

for(const required of [
  'node verify-v3-migration.mjs',
  'node verify-one-time-intent-intake.mjs',
  'node verify-zero-loss-accounting.mjs',
  'node verify-test-runtime-v3.mjs',
  'node verify-test-runtime-limits.mjs',
  'node verify-ingestion.mjs',
  'node verify-complete.mjs',
  'node verify-full-cycle.mjs',
  'verify-browser.mjs',
  'verify-browser-extra.mjs',
  'node verify-live.mjs',
  'actions/upload-artifact@v4',
  'Create release tag only after deployed proof'
])assert.ok(workflow.includes(required),`Controlling workflow is missing required proof: ${required}`);
assert.match(workflow,/if:\s*github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/,'Deployment must be limited to main pushes.');
assert.ok(workflow.includes('git diff --exit-code -- TEST_PROJECT.json'),'Generated test state must equal the committed canonical fixture.');
assert.match(workflow,/publish-status:[\s\S]*needs:\s*\[test, deploy, verify-live\]/,'Acceptance publication must depend on source proof, deployment, and deployed live proof.');
assert.ok(workflow.includes('test "$TEST_RESULT" = success'),'Acceptance publication must fail closed unless the test job succeeded.');
assert.ok(workflow.includes('test "$DEPLOY_RESULT" = success'),'Acceptance publication must fail closed unless deployment succeeded.');
assert.ok(workflow.includes('test "$LIVE_RESULT" = success'),'Acceptance publication must fail closed unless deployed live verification succeeded.');

for(const required of ['closed-loop-project/3','closed-loop-stage-response/3','closed-loop-test-spec/1','closed-loop-verification-package/1','exactDeployedBytes:true'])assert.ok(live.includes(required),`Live verifier is missing ${required}.`);
assert.ok(!live.includes("responseSchema:'closed-loop-stage-response/2'"),'Live verification must not certify the obsolete /2 response contract.');

console.log(JSON.stringify({
  monotonicCandidateRegression:true,
  oneTimeRepairWorkflowsRemoved:true,
  stage02OperatorBoundaryPreserved:true,
  stage03SourceBoundaryPreserved:true,
  stage04CurrentInputPreserved:true,
  stage05ExhaustiveResolutionPreserved:true,
  stage06FixtureEnumsPreserved:true,
  missingByteGatePreserved:true,
  humanEvidenceAuthorityPreserved:true,
  promptBoxBaselinePreserved:true,
  oneRuntimeBuildIdentity:true,
  controllingDeploymentProofPreserved:true,
  acceptancePublicationFailClosed:true,
  liveV3ByteVerificationPreserved:true
},null,2));