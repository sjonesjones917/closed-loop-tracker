import fs from 'node:fs';
import crypto from 'node:crypto';

const base=process.env.PAGE_URL;
if(!base)throw new Error('PAGE_URL is required');

const deployed=[
  'index.html',
  'workbook.js',
  'hash.js',
  'workflow-schema.js',
  'test-runtime.js',
  'test-worker.js',
  'workflow-engine.js',
  'prompt-engine.js',
  'response-ingestion.js',
  'project-store.js',
  'app-core.js',
  'TEST_PROJECT.json',
  '.nojekyll'
];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const compared=[];
for(const file of deployed){
  if(!fs.existsSync(file))throw new Error(`Local deployment input is missing: ${file}`);
  const url=new URL(file,base);
  url.searchParams.set('live',`${Date.now()}-${Math.random()}`);
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw new Error(`${file} returned ${response.status}`);
  const remote=Buffer.from(await response.arrayBuffer());
  const local=fs.readFileSync(file);
  if(!remote.equals(local))throw new Error(`${file} deployed bytes differ from verified source: local=${sha(local)} remote=${sha(remote)}`);
  compared.push({file,bytes:local.length,sha256:sha(local)});
}

const project=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
if(project.schema!=='human-project/30')throw new Error(`Unexpected retained import schema ${project.schema}.`);
if(project.jobId!=='JOB-20260823144121'||project.title!=='Mobile Closed-Loop Agent Reliability Workbook')throw new Error('Retained project identity mismatch.');
if(project.stageRecords?.['1']?.status!=='COMPLETE'||project.currentStage!==2||project.currentState!=='READY')throw new Error('Retained project Stage 01/Stage 02 state mismatch.');
for(let n=2;n<=30;n++)if(project.stageRecords?.[String(n)]?.status!=='NOT STARTED')throw new Error(`Retained Stage ${n} is falsely started.`);
if(project.currentVersions?.sources!=='NOT APPLICABLE')throw new Error('Retained Stage 02 source set was fabricated.');

const activeFiles=deployed.filter(file=>/\.(?:js|html)$/.test(file));
const active=activeFiles.map(file=>fs.readFileSync(file,'utf8')).join('\n');
if(/MutationObserver/.test(active))throw new Error('Obsolete patch-style runtime behavior is deployed.');
if(/GEN-042|field status report|maintenance[- ]handoff/i.test(active+JSON.stringify(project)))throw new Error('Unauthorized product content is deployed.');
if(/human-project\/31|Stage 31|Operation 31|31 operations/i.test(active))throw new Error('Prohibited Stage/Operation 31 is deployed.');
for(const token of ['closed-loop-project/3','closed-loop-stage-response/3','closed-loop-test-spec/1','PENDING_OPERATOR_REVIEW','ACCEPTED_DATA_CHANGE'])if(!active.includes(token))throw new Error(`Current deployed runtime contract is missing ${token}.`);

const html=fs.readFileSync('index.html','utf8');
const expected=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const src=[...html.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
if(src.length!==expected.length)throw new Error(`Expected ${expected.length} direct deployed runtime scripts; found ${src.length}.`);
const tokens=new Set();
expected.forEach((file,index)=>{
  if(src[index]?.split('?')[0]!==file)throw new Error(`Deployed runtime order mismatch at ${file}.`);
  const token=new URLSearchParams(src[index].split('?')[1]||'').get('v');
  if(!token)throw new Error(`${file} lacks the deployed build token.`);
  tokens.add(token);
});
if(tokens.size!==1)throw new Error('Deployed runtime scripts use mixed build tokens.');
const buildToken=[...tokens][0];
const runtimeSource=fs.readFileSync('test-runtime.js','utf8');
if(!runtimeSource.includes('const RUNTIME_SCRIPT_URL=')||!runtimeSource.includes('url.search=new URL(RUNTIME_SCRIPT_URL).search'))throw new Error('Deployed worker URL does not preserve the loaded runtime build identity.');

console.log(JSON.stringify({
  liveSourceIdentity:true,
  exactByteComparison:true,
  filesCompared:compared.length,
  retainedJobId:project.jobId,
  currentStage:2,
  stage1:'COMPLETE',
  workflow:'mobile-closed-loop/30',
  projectSchema:'closed-loop-project/3',
  responseSchema:'closed-loop-stage-response/3',
  testIrSchema:'closed-loop-test-spec/1',
  buildToken,
  oneApplication:true
},null,2));
