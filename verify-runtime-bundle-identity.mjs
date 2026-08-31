import fs from 'node:fs';
import crypto from 'node:crypto';

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const externalRuntimeFiles=[
  'workbook.js',
  'hash.js',
  'workflow-schema.js',
  'test-runtime.js',
  'workflow-engine.js',
  'prompt-engine.js',
  'response-ingestion.js',
  'project-store.js',
  'app-core.js'
];
const completeRuntimeGraph=['index.html',...externalRuntimeFiles,'test-worker.js'];
const tokenPattern=/runtime-[a-z0-9-]+/gi;
const placeholder='__RUNTIME_BUILD_ID__';
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const normalize=(filename,source)=>`${filename}\0${source.replace(tokenPattern,placeholder)}`;

for(const filename of completeRuntimeGraph)assert(fs.existsSync(filename),`Runtime graph file is missing: ${filename}`);
const graphIdentitySha256=sha256(completeRuntimeGraph.map(filename=>normalize(filename,fs.readFileSync(filename,'utf8'))).join('\0'));
const expectedBuildId=`runtime-${graphIdentitySha256.slice(0,24)}`;

const html=fs.readFileSync('index.html','utf8');
const scriptSources=[...html.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
assert(scriptSources.length===externalRuntimeFiles.length,`Expected ${externalRuntimeFiles.length} deferred runtime scripts; found ${scriptSources.length}.`);
const scriptTokens=[];
externalRuntimeFiles.forEach((filename,index)=>{
  const source=scriptSources[index]||'';
  const [path,query='']=source.split('?');
  assert(path===filename,`Runtime script order mismatch at ${index+1}: expected ${filename}; found ${path||'NONE'}.`);
  assert(scriptSources.filter(item=>item.split('?')[0]===filename).length===1,`${filename} is not loaded exactly once.`);
  const token=new URLSearchParams(query).get('v');
  assert(token,`${filename} has no cache identity.`);
  scriptTokens.push(token);
});

const buildIdFrom=filename=>{
  const source=fs.readFileSync(filename,'utf8');
  const match=source.match(/const RUNTIME_BUILD_ID='([^']+)'/);
  assert(match,`${filename} does not declare RUNTIME_BUILD_ID.`);
  return match[1];
};
const declaredBuildIds=[...scriptTokens,buildIdFrom('test-runtime.js'),buildIdFrom('app-core.js')];
assert(new Set(declaredBuildIds).size===1,`The runtime graph uses mixed cache identities: ${[...new Set(declaredBuildIds)].join(', ')}.`);
assert(declaredBuildIds[0]===expectedBuildId,`Runtime cache identity is stale. Expected ${expectedBuildId}; found ${declaredBuildIds[0]}.`);

const runtimeSource=fs.readFileSync('test-runtime.js','utf8');
const workerSource=fs.readFileSync('test-worker.js','utf8');
assert(runtimeSource.includes("if(source)url.search=new URL(source).search;"),'The worker URL does not inherit the controlling runtime cache identity.');
assert(workerSource.includes("const query=self.location?.search||'';"),'The worker does not preserve the controlling query identity.');
assert(workerSource.includes('importScripts(`test-runtime.js${query}`);'),'The worker does not load the exact cache-bound Test IR runtime.');

console.log(JSON.stringify({
  runtimeBundleIdentity:true,
  graphIdentitySha256,
  buildId:expectedBuildId,
  directlyLoadedRuntimeFiles:externalRuntimeFiles.length,
  workerBootstrapBound:true,
  mixedBuildIdentities:0,
  staleBuildIdentities:0
},null,2));
