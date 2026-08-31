import fs from 'node:fs';
import crypto from 'node:crypto';

const base=process.env.PAGE_URL;
if(!base)throw new Error('PAGE_URL is required');

const deployed=[
  'index.html','app-core.js','hash.js','workflow-schema.js','test-runtime.js','test-worker.js',
  'workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','workbook.js','TEST_PROJECT.json'
];
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
for(const file of deployed){
  if(!fs.existsSync(file))throw new Error(`Verified source file is missing locally: ${file}`);
  const response=await fetch(new URL(`${file}?live=${Date.now()}-${Math.random()}`,base),{cache:'no-store'});
  if(!response.ok)throw new Error(`${file} returned ${response.status}`);
  const remote=await response.text();
  const local=fs.readFileSync(file,'utf8');
  if(remote!==local)throw new Error(`${file} deployed bytes differ from verified source: local=${sha(local)} remote=${sha(remote)}`);
}

const active=deployed.filter(file=>/\.(?:js|html)$/.test(file)).map(file=>fs.readFileSync(file,'utf8')).join('\n');
if(/MutationObserver/.test(active))throw new Error('Obsolete patch-style runtime behavior is deployed.');
if(/human-project\/31|Stage 31|Operation 31|31 operations/i.test(active))throw new Error('Prohibited Stage/Operation 31 is deployed.');
for(const required of [
  "const WORKFLOW_ID='mobile-closed-loop/30'",
  "const PROJECT_SCHEMA='closed-loop-project/3'",
  "const RESPONSE_SCHEMA='closed-loop-stage-response/3'",
  'closed-loop-test-spec/1',
  'closed-loop-verification-package/1',
  'CORRECT THE ROOT CAUSE'
])if(!active.includes(required))throw new Error(`Required deployed contract marker is missing: ${required}`);

const html=fs.readFileSync('index.html','utf8');
const expectedOrder=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const scripts=[...html.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
if(scripts.length!==expectedOrder.length)throw new Error(`Expected ${expectedOrder.length} directly loaded runtime scripts; found ${scripts.length}.`);
const buildTokens=new Set();
for(let index=0;index<expectedOrder.length;index++){
  const [path,query='']=scripts[index].split('?');
  if(path!==expectedOrder[index])throw new Error(`Runtime load order mismatch at ${expectedOrder[index]}.`);
  const token=new URLSearchParams(query).get('v');
  if(!token)throw new Error(`${path} is missing the shared build/cache identity.`);
  buildTokens.add(token);
}
if(buildTokens.size!==1)throw new Error('Runtime scripts do not share one build/cache identity.');

console.log(JSON.stringify({
  liveSourceIdentity:true,
  filesCompared:deployed.length,
  workflow:'mobile-closed-loop/30',
  projectSchema:'closed-loop-project/3',
  responseSchema:'closed-loop-stage-response/3',
  testIrSchema:'closed-loop-test-spec/1',
  verificationPackageSchema:'closed-loop-verification-package/1',
  oneApplication:true,
  sharedBuildIdentity:[...buildTokens][0]
},null,2));
