import fs from 'node:fs';

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const workflows=fs.readdirSync('.github/workflows').filter(name=>/\.ya?ml$/i.test(name));
assert(workflows.length===1&&workflows[0]==='pages.yml','Exactly one controlling Pages workflow must exist.');
const source=fs.readFileSync('.github/workflows/pages.yml','utf8');

for(const job of ['test','deploy','verify-live','publish-status'])assert(new RegExp(`^  ${job}:`,'m').test(source),`Required workflow job is missing: ${job}.`);
assert(/^    name: test$/m.test(source),'The merge-gating test job must retain the stable name "test".');
assert(source.includes('pull_request:')&&source.includes('branches: [main]'),'Pull requests to main are not covered by the test job.');
assert(source.includes("if: github.event_name == 'push' && github.ref == 'refs/heads/main'"),'Production jobs are not restricted to pushes on main.');
assert((source.match(/actions\/deploy-pages@v4/g)||[]).length===1,'The workflow must contain exactly one production deployment action.');
assert(!source.includes('path: .\n'),'The complete repository must not be uploaded as the Pages artifact.');
assert(source.includes('path: _site'),'The exact verified _site directory is not the Pages artifact.');
assert(!source.includes('AUTHORIZED_OPERATION_01.txt'),'The workflow references an obsolete generated instruction file.');

const requiredCommands=[
  'node verify-release-pipeline.mjs',
  'node verify-runtime-bundle-identity.mjs',
  'node verify-hash.mjs',
  'node verify-spec3-contract.mjs',
  'node verify-v3-contract.mjs',
  'node verify-v3-migration.mjs',
  'node verify-test-runtime.mjs',
  'node verify-test-runtime-v3.mjs',
  'node verify-test-runtime-limits.mjs',
  'node verify-ingestion.mjs',
  'node verify-zero-loss-accounting.mjs',
  'node verify-one-time-intent-intake.mjs',
  'node verify-stage01-intake-closure.mjs',
  'node verify.mjs',
  'node verify-complete.mjs',
  'node verify-project-lifecycle.mjs',
  'node verify-all-stage-prompts.mjs',
  'node verify-stage-prompts-complete.mjs',
  'node verify-prompt-semantics.mjs',
  'node verify-user-prompt-invariants.mjs',
  'node verify-semantic-invariant.mjs',
  'node verify-full-cycle.mjs',
  'node verify-definition-of-done.mjs',
  'node verify-v3-definition-of-done.mjs',
  'verify-human-stage-walkthrough.mjs',
  'verify-mobile-stage-action.mjs',
  'verify-browser.mjs',
  'verify-browser-extra.mjs'
];
for(const command of requiredCommands)assert(source.includes(command),`Required acceptance proof is absent from CI: ${command}.`);

const orderedSteps=[
  'Syntax and static architecture',
  'Schema ownership migration and Test IR',
  'Ingestion and zero-loss authority accounting',
  'Workflow gates and deterministic adjudication',
  'Prompt semantics and information isolation',
  'Full lifecycle and definition of done',
  'Local Chromium acceptance',
  'Build exact static Pages artifact'
];
let previous=-1;
for(const step of orderedSteps){
  const index=source.indexOf(`name: ${step}`);
  assert(index>previous,`Acceptance proof order is missing or incorrect at: ${step}.`);
  previous=index;
}
for(const proof of [
  'Verify exact deployed source identity',
  'Deployed Chromium acceptance',
  'Build final machine acceptance artifact',
  'Tag exact accepted commit',
  'Publish exact workflow status'
])assert(source.includes(`name: ${proof}`),`Release proof step is missing: ${proof}.`);
assert(source.includes('needs: [test, deploy]'),'Live verification is not bound to successful test and deployment jobs.');
assert(source.includes('needs: [test, deploy, verify-live]'),'Status publication is not bound to the complete proof chain.');
assert(source.includes('closed-loop-acceptance-${{ github.sha }}'),'The exact-commit acceptance artifact is not published.');
assert(source.includes('acceptance-${GITHUB_SHA:0:12}'),'The release tag is not bound to the exact accepted commit.');

console.log(JSON.stringify({
  singleControllingWorkflow:true,
  stableMergeGateJob:'test',
  pullRequestTesting:true,
  mainOnlyDeployment:true,
  productionDeploymentCount:1,
  fullDeterministicProofChain:true,
  localChromiumProof:true,
  exactDeployedByteProof:true,
  deployedChromiumProof:true,
  exactCommitAcceptanceArtifact:true,
  postProofReleaseTag:true
},null,2));
