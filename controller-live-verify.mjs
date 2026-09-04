import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const target = process.env.TARGET_COMMIT;
if (!/^[a-f0-9]{40}$/i.test(target || '')) throw new Error('TARGET_COMMIT must be an exact commit SHA.');
const commands = [
  ['node',['verify-deployment-manifest.mjs']],
  ['node',['verify-live-deployment.mjs']],
  ['node',['verify-deployed-browser.mjs']]
];
const results = [];
for (const [command,args] of commands) {
  const run = spawnSync(command,args,{encoding:'utf8',env:{...process.env,EXPECTED_COMMIT:target,GITHUB_SHA:target,PAGE_URL:'https://sjonesjones917.github.io/closed-loop-tracker/',DEPLOYMENT_BASE_URL:'https://sjonesjones917.github.io/closed-loop-tracker/'},timeout:300000});
  results.push({command:[command,...args].join(' '),status:run.status,signal:run.signal,stdout:run.stdout,stderr:run.stderr});
  if (run.status !== 0) {
    fs.writeFileSync('controller-live-verification-result.json',JSON.stringify({targetCommit:target,canonicalOrigin:'https://sjonesjones917.github.io',basePath:'/closed-loop-tracker/',results},null,2));
    process.exit(run.status || 1);
  }
}
fs.writeFileSync('controller-live-verification-result.json',JSON.stringify({targetCommit:target,canonicalOrigin:'https://sjonesjones917.github.io',basePath:'/closed-loop-tracker/',verifiedAtDeviceTime:new Date().toISOString(),results},null,2));
