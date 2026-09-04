import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const targetCommit=process.env.TARGET_COMMIT;
if(!/^[a-f0-9]{40}$/i.test(targetCommit||''))throw new Error('Exact TARGET_COMMIT required.');
const browser=process.env.BROWSER||'/usr/bin/google-chrome';
const canonicalUrl='https://sjonesjones917.github.io/closed-loop-tracker/';
const checks=[
 ['specification-governance','node',['verify-specification-governance.mjs'],300000],
 ['build-stage-ledger','node',['verify-build-stage-ledger.mjs'],300000],
 ['deployment-manifest','node',['verify-deployment-manifest.mjs'],300000],
 ['mobile-release-governance','node',['verify-mobile-release-governance.mjs'],300000],
 ['complete-repository-suite','node',['verify-complete.mjs'],900000],
 ['v3-definition-of-done','node',['verify-v3-definition-of-done.mjs'],600000],
 ['project-lifecycle','node',['verify-project-lifecycle.mjs'],600000],
 ['prompt-semantics','node',['verify-prompt-semantics.mjs'],600000],
 ['human-operator-walkthrough','node',['verify-human-stage-walkthrough.mjs'],600000],
 ['mobile-stage-action','node',['verify-mobile-stage-action.mjs'],600000],
 ['local-chromium','node',['verify-browser.mjs'],600000],
 ['local-chromium-extra','node',['verify-browser-extra.mjs'],600000],
 ['exact-live-deployment','node',['verify-live-deployment.mjs'],600000],
 ['deployed-chromium','node',['verify-deployed-browser.mjs'],600000]
];
const clip=s=>String(s||'').length>200000?String(s).slice(0,100000)+'\n...TRUNCATED...\n'+String(s).slice(-100000):String(s||'');
const results=[];let failed=false;
for(const [id,cmd,args,timeout] of checks){
 if(!fs.existsSync(args[0])){results.push({id,status:'MISSING_VERIFIER',path:args[0]});failed=true;continue;}
 const start=Date.now();
 const run=spawnSync(cmd,args,{encoding:'utf8',timeout,maxBuffer:128*1024*1024,env:{...process.env,BROWSER:browser,TARGET_COMMIT:targetCommit,EXPECTED_COMMIT:targetCommit,GITHUB_SHA:targetCommit,PAGE_URL:canonicalUrl,DEPLOYMENT_BASE_URL:canonicalUrl}});
 results.push({id,command:[cmd,...args].join(' '),exitCode:run.status,signal:run.signal,durationMs:Date.now()-start,stdout:clip(run.stdout),stderr:clip(run.stderr)});
 if(run.status!==0)failed=true;
}
const spec=fs.readFileSync('specification/closed-loop-reliability-controlling-implementation-specification.txt');
const report={schema:'closed-loop-current-main-evidence/1',controllerId:'closed-loop-repository-completion-controller/3',targetCommit,specification:{path:'specification/closed-loop-reliability-controlling-implementation-specification.txt',byteLength:spec.length,sha256:crypto.createHash('sha256').update(spec).digest('hex')},canonicalDeployment:{origin:'https://sjonesjones917.github.io',basePath:'/closed-loop-tracker/'},environment:{node:process.version,platform:process.platform,arch:process.arch,browser},results,allAgentExecutableChecksPassed:!failed,irreducibleEvidenceNotFabricated:[{class:'PHYSICAL_DEVICE',proposition:'Actual physical iPhone Safari acceptance bound to this exact deployed build'},{class:'HUMAN_AUTHORITY',proposition:'Any purpose-specific human decisions not already present in current canonical evidence'},{class:'EXTERNAL_SYSTEM',proposition:'Real independent external-agent contexts, external backup custody/restore, and destination transfer receipts where required'}],generatedAtDeviceTime:new Date().toISOString()};
fs.writeFileSync(process.env.REPORT_PATH||'/tmp/latest-main-evidence.json',JSON.stringify(report,null,2));
if(failed)process.exit(1);
