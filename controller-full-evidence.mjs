import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const targetCommit = process.env.TARGET_COMMIT;
if (!/^[a-f0-9]{40}$/i.test(targetCommit || '')) throw new Error('TARGET_COMMIT must be an exact commit.');
const browser = process.env.BROWSER || '/usr/bin/google-chrome';
const commands = [
  ['specification-governance','node',['verify-specification-governance.mjs'],false],
  ['build-stage-ledger','node',['verify-build-stage-ledger.mjs'],false],
  ['deployment-manifest','node',['verify-deployment-manifest.mjs'],false],
  ['mobile-release-governance','node',['verify-mobile-release-governance.mjs'],false],
  ['test-project-build','node',['build-test-project.mjs'],false],
  ['source-suite','node',['verify.mjs'],false],
  ['data-route-closure','node',['verify-data-route-closure.mjs'],false],
  ['infrastructure-route-closure','node',['verify-infrastructure-route-closure.mjs'],false],
  ['v3-migration','node',['verify-v3-migration.mjs'],false],
  ['v3-contract','node',['verify-v3-contract.mjs'],false],
  ['spec3-contract','node',['verify-spec3-contract.mjs'],false],
  ['stage01-intake','node',['verify-stage01-intake-closure.mjs'],false],
  ['one-time-intake','node',['verify-one-time-intent-intake.mjs'],false],
  ['zero-loss-accounting','node',['verify-zero-loss-accounting.mjs'],false],
  ['all-stage-prompts','node',['verify-all-stage-prompts.mjs'],false],
  ['stage-prompts-complete','node',['verify-stage-prompts-complete.mjs'],false],
  ['user-prompt-invariants','node',['verify-user-prompt-invariants.mjs'],false],
  ['test-runtime-v3','node',['verify-test-runtime-v3.mjs'],false],
  ['test-runtime-limits','node',['verify-test-runtime-limits.mjs'],false],
  ['test-runtime','node',['verify-test-runtime.mjs'],false],
  ['canonical-hash','node',['verify-hash.mjs'],false],
  ['ingestion','node',['verify-ingestion.mjs'],false],
  ['complete-suite','node',['verify-complete.mjs'],false],
  ['definition-of-done','node',['verify-definition-of-done.mjs'],false],
  ['v3-definition-of-done','node',['verify-v3-definition-of-done.mjs'],false],
  ['project-lifecycle','node',['verify-project-lifecycle.mjs'],false],
  ['prompt-semantics','node',['verify-prompt-semantics.mjs'],false],
  ['semantic-invariant','node',['verify-semantic-invariant.mjs'],false],
  ['human-stage-walkthrough','node',['verify-human-stage-walkthrough.mjs'],true],
  ['mobile-stage-action','node',['verify-mobile-stage-action.mjs'],true],
  ['browser','node',['verify-browser.mjs'],true],
  ['browser-extra','node',['verify-browser-extra.mjs'],true]
];
const results = [];
let failed = false;
for (const [id,command,args,needsBrowser] of commands) {
  if (!fs.existsSync(args[0])) {
    results.push({id,command:[command,...args].join(' '),status:'NOT_PRESENT'});
    failed = true;
    continue;
  }
  const started = new Date().toISOString();
  const run = spawnSync(command,args,{encoding:'utf8',timeout:needsBrowser?420000:300000,maxBuffer:64*1024*1024,env:{...process.env,BROWSER:browser,EXPECTED_COMMIT:targetCommit,GITHUB_SHA:targetCommit}});
  results.push({id,command:[command,...args].join(' '),started,ended:new Date().toISOString(),exitCode:run.status,signal:run.signal,stdout:run.stdout,stderr:run.stderr});
  if (run.status !== 0) failed = true;
}
const report = {
  schema:'closed-loop-agent-executable-evidence/1',
  controllerId:'closed-loop-repository-completion-controller/3',
  targetCommit,
  specificationPath:'specification/closed-loop-reliability-controlling-implementation-specification.txt',
  specificationByteLength:fs.statSync('specification/closed-loop-reliability-controlling-implementation-specification.txt').size,
  generatedAtDeviceTime:new Date().toISOString(),
  environment:{node:process.version,platform:process.platform,arch:process.arch,browser},
  results,
  allExecutedCommandsPassed:!failed,
  externalProofNotManufactured:['ACTUAL_PHYSICAL_IPHONE_SAFARI_OBSERVATION','REAL_EXTERNAL_AGENT_CONTEXTS','EXTERNAL_BACKUP_CUSTODY_AND_RESTORE','DESTINATION_TRANSFER_EVIDENCE']
};
fs.writeFileSync(process.env.REPORT_PATH || '/tmp/controller-full-evidence.json',JSON.stringify(report,null,2));
if (failed) process.exit(1);
