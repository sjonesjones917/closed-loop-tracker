import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';

const root=path.resolve(process.argv[2]||'_site');
const manifestName='deployment-manifest.json';
const scriptOrder=[
  'workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js',
  'prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'
];
const expectedPaths=[
  'index.html',...scriptOrder.slice(0,4),'test-worker.js',...scriptOrder.slice(4),
  'TEST_PROJECT.json','.nojekyll'
];
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const mediaType=file=>file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.json')?'application/json; charset=utf-8':'application/octet-stream';
const declaration=(source,name)=>source.match(new RegExp(`const\\s+${name}\\s*=\\s*['\"]([^'\"]+)['\"]`))?.[1]||'';
if(!fs.existsSync(root)||!fs.statSync(root).isDirectory())throw new Error(`Deployment root does not exist: ${root}`);
const hashContext=vm.createContext({TextEncoder,crypto:crypto.webcrypto,Blob});
vm.runInContext(fs.readFileSync(path.join(root,'hash.js'),'utf8'),hashContext,{filename:path.join(root,'hash.js')});
const canonicalHash=hashContext.closedLoopHash;
if(canonicalHash?.canonicalizationVersion!=='closed-loop-canonical-json/1')throw new Error('The deployed hash.js does not provide closed-loop-canonical-json/1.');

const actual=fs.readdirSync(root,{withFileTypes:true}).filter(entry=>entry.name!==manifestName);
for(const entry of actual)if(!entry.isFile()||entry.isSymbolicLink())throw new Error(`Deployment resource must be a regular root-level file: ${entry.name}`);
const actualNames=actual.map(entry=>entry.name).sort(),expected=[...expectedPaths].sort();
if(JSON.stringify(actualNames)!==JSON.stringify(expected))throw new Error(`Deployment resource set is not closed. Expected ${expected.join(', ')}; found ${actualNames.join(', ')}.`);

const resources=expectedPaths.map(resourcePath=>{
  const bytes=fs.readFileSync(path.join(root,resourcePath));
  return {path:resourcePath,mediaType:mediaType(resourcePath),byteSize:bytes.byteLength,hashAlgorithm:'SHA-256',digest:sha256(bytes)};
});
const resourceByPath=new Map(resources.map(resource=>[resource.path,resource]));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const csp=html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)?.[1];
if(!csp)throw new Error('The deployed HTML does not contain the exact CSP value.');
if(/script-src[^;]*(?:'unsafe-inline'|'unsafe-eval'|'sha256-)/.test(csp))throw new Error('The deployed CSP permits inline or dynamic script execution.');
if(!/worker-src\s+'self'(?:\s*;|\s*$)/.test(csp))throw new Error('The deployed CSP does not restrict workers to same-origin resources.');
if(/<script(?![^>]*\bsrc=)/i.test(html))throw new Error('The deployed HTML contains an inline script.');

const scriptUrls=[...html.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
if(scriptUrls.length!==scriptOrder.length)throw new Error(`Expected ${scriptOrder.length} external runtime scripts; found ${scriptUrls.length}.`);
const buildTokens=new Set();
scriptUrls.forEach((source,index)=>{
  const url=new URL(source,'https://deployment.invalid/');
  const relativePath=url.pathname.slice(1);
  if(relativePath!==scriptOrder[index])throw new Error(`Wrong deployed script order at ${scriptOrder[index]}.`);
  if([...url.searchParams.keys()].some(key=>key!=='v')||!url.searchParams.get('v'))throw new Error(`${relativePath} must use only the shared v build token.`);
  buildTokens.add(url.searchParams.get('v'));
});
if(buildTokens.size!==1)throw new Error('The deployed runtime graph does not use one shared build identity.');
const buildIdentity=[...buildTokens][0];
if(!/^[A-Za-z0-9._-]+$/.test(buildIdentity))throw new Error('The shared build identity contains unsupported characters.');

const appSource=fs.readFileSync(path.join(root,'app-core.js'),'utf8');
const runtimeSource=fs.readFileSync(path.join(root,'test-runtime.js'),'utf8');
const workerSource=fs.readFileSync(path.join(root,'test-worker.js'),'utf8');
for(const [file,source] of [['app-core.js',appSource],['test-runtime.js',runtimeSource],['test-worker.js',workerSource]]){
  if(declaration(source,'RUNTIME_BUILD_ID')!==buildIdentity)throw new Error(`${file} does not report the shared build identity ${buildIdentity}.`);
}
const workerProtocolVersion=declaration(workerSource,'WORKER_PROTOCOL_VERSION');
if(!workerProtocolVersion||declaration(runtimeSource,'WORKER_PROTOCOL_VERSION')!==workerProtocolVersion)throw new Error('The page runtime and worker do not report one worker protocol identity.');
const workerDigest=resourceByPath.get('test-worker.js').digest;
if(declaration(runtimeSource,'TEST_WORKER_SHA256')!==workerDigest)throw new Error(`test-runtime.js does not bind the exact deployed test-worker.js bytes (${workerDigest}).`);

const workflowPath='.github/workflows/pages.yml';
if(!fs.existsSync(workflowPath))throw new Error(`Deployment workflow is unavailable: ${workflowPath}`);
const workflowBytes=fs.readFileSync(workflowPath);
const base={
  schema:'closed-loop-deployment-manifest/1',
  sourceCommit:process.env.SOURCE_COMMIT||process.env.GITHUB_SHA||'LOCAL_UNVERIFIED',
  workflowRunIdentity:process.env.WORKFLOW_RUN_ID||process.env.GITHUB_RUN_ID||'LOCAL_UNVERIFIED',
  buildIdentity,
  canonicalizationVersion:'closed-loop-canonical-json/1',
  resourceSetPolicy:'CLOSED_ALLOWLIST',
  manifestPath:manifestName,
  runtimeResources:resources,
  runtimeGraph:{
    entrypoint:'index.html',
    scripts:scriptUrls.map((url,index)=>({path:scriptOrder[index],url,buildIdentity,digest:resourceByPath.get(scriptOrder[index]).digest})),
    worker:{path:'test-worker.js',url:`test-worker.js?v=${encodeURIComponent(buildIdentity)}`,buildIdentity,workerProtocolVersion,digest:workerDigest,imports:[{path:'test-runtime.js',url:`test-runtime.js?v=${encodeURIComponent(buildIdentity)}`,digest:resourceByPath.get('test-runtime.js').digest}]}
  },
  csp:{value:csp,hashAlgorithm:'SHA-256',digest:sha256(Buffer.from(csp,'utf8'))},
  workflowDefinition:{path:workflowPath,hashAlgorithm:'SHA-256',digest:sha256(workflowBytes)},
  dependencyAndToolchainManifest:{node:process.version,platform:process.platform,architecture:process.arch,packageLockPresent:fs.existsSync('package-lock.json')},
  buildCommand:'node build-test-project.mjs; copy closed deployment resource allowlist; node build-deployment-manifest.mjs _site',
  buildEnvironmentIdentity:process.env.BUILD_ENVIRONMENT_IDENTITY||`${process.platform}-${process.arch}-${process.version}`,
  serviceWorkerPolicy:'NO_CONTROLLING_SERVICE_WORKER',
  manifestDigest:''
};
const digestInput={...base};delete digestInput.manifestDigest;
base.manifestDigest=canonicalHash.sha256Value(digestInput);
fs.writeFileSync(path.join(root,manifestName),JSON.stringify(base,null,2)+'\n');
console.log(JSON.stringify({deploymentManifest:'PASS',path:path.join(root,manifestName),resources:resources.length,buildIdentity,workerDigest,manifestDigest:base.manifestDigest}));
