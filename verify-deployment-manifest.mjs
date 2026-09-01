import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';

const root=path.resolve(process.argv[2]||'_site'),manifestPath=path.join(root,'deployment-manifest.json');
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const declaration=(source,name)=>source.match(new RegExp(`const\\s+${name}\\s*=\\s*['\"]([^'\"]+)['\"]`))?.[1]||'';
const assert=(value,message)=>{if(!value)throw new Error(message);};
const safePath=value=>typeof value==='string'&&value.length>0&&!value.includes('\\')&&!value.startsWith('/')&&!value.split('/').some(segment=>!segment||segment==='.'||segment==='..');

const manifestBytes=fs.readFileSync(manifestPath),manifest=JSON.parse(manifestBytes.toString('utf8'));
const hashContext=vm.createContext({TextEncoder,crypto:crypto.webcrypto,Blob});
vm.runInContext(fs.readFileSync(path.join(root,'hash.js'),'utf8'),hashContext,{filename:path.join(root,'hash.js')});
const canonicalHash=hashContext.closedLoopHash;
assert(canonicalHash?.canonicalizationVersion==='closed-loop-canonical-json/1','The deployed hash.js does not provide closed-loop-canonical-json/1.');
assert(manifest.schema==='closed-loop-deployment-manifest/1','Wrong deployment-manifest schema.');
assert(manifest.canonicalizationVersion==='closed-loop-canonical-json/1','Wrong deployment-manifest canonicalization contract.');
assert(manifest.resourceSetPolicy==='CLOSED_ALLOWLIST','The deployment manifest does not declare a closed resource allowlist.');
assert(manifest.manifestPath==='deployment-manifest.json','The deployment manifest path is not canonical.');
assert(/^[a-f0-9]{64}$/.test(manifest.manifestDigest||''),'Invalid deployment manifest digest encoding.');
const digestInput={...manifest};delete digestInput.manifestDigest;
const recomputed=canonicalHash.sha256Value(digestInput);
assert(recomputed===manifest.manifestDigest,'Deployment manifest digest mismatch.');

const listed=new Map();
for(const resource of manifest.runtimeResources||[]){
  assert(safePath(resource.path),`Unsafe deployment resource path ${String(resource.path)}.`);
  assert(!listed.has(resource.path),`Duplicate deployment resource ${resource.path}.`);
  assert(resource.hashAlgorithm==='SHA-256'&&/^[a-f0-9]{64}$/.test(resource.digest||''),`Invalid digest contract for ${resource.path}.`);
  const diskPath=path.join(root,...resource.path.split('/'));
  const stat=fs.lstatSync(diskPath);
  assert(stat.isFile()&&!stat.isSymbolicLink(),`Deployment resource is not a regular file: ${resource.path}.`);
  const bytes=fs.readFileSync(diskPath);
  assert(bytes.byteLength===resource.byteSize&&sha256(bytes)===resource.digest,`Deployment resource identity mismatch for ${resource.path}.`);
  listed.set(resource.path,resource);
}
const actual=fs.readdirSync(root,{withFileTypes:true});
for(const entry of actual)assert(entry.isFile()&&!entry.isSymbolicLink(),`Unexpected non-file deployment entry ${entry.name}.`);
const actualNames=actual.map(entry=>entry.name).filter(name=>name!=='deployment-manifest.json').sort(),expected=[...listed.keys()].sort();
assert(JSON.stringify(actualNames)===JSON.stringify(expected),'Unmanifested or missing deployed resource detected.');

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const csp=html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)?.[1]||'';
assert(csp===manifest.csp?.value,'Manifest CSP does not match index.html.');
assert(manifest.csp?.hashAlgorithm==='SHA-256'&&manifest.csp?.digest===sha256(Buffer.from(csp,'utf8')),'Manifest CSP digest mismatch.');
assert(!/<script(?![^>]*\bsrc=)/i.test(html),'Inline script exists in the deployment artifact.');
assert(manifest.serviceWorkerPolicy==='NO_CONTROLLING_SERVICE_WORKER','Deployment manifest does not prohibit a controlling service worker.');

const scriptUrls=[...html.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
const graphScripts=manifest.runtimeGraph?.scripts||[];
assert(JSON.stringify(scriptUrls)===JSON.stringify(graphScripts.map(script=>script.url)),'The executable script graph differs from the deployment manifest.');
const tokens=new Set();
for(const script of graphScripts){
  assert(listed.has(script.path),`Executable script ${script.path} is not a manifested resource.`);
  const url=new URL(script.url,'https://deployment.invalid/');
  assert(url.pathname.slice(1)===script.path,`Executable URL does not resolve to ${script.path}.`);
  assert([...url.searchParams.keys()].every(key=>key==='v')&&url.searchParams.get('v')===manifest.buildIdentity,`Mixed or missing build token for ${script.path}.`);
  assert(script.buildIdentity===manifest.buildIdentity,'Mixed executable build identity in the deployment graph.');
  assert(script.digest===listed.get(script.path).digest,`Executable graph digest mismatch for ${script.path}.`);
  tokens.add(url.searchParams.get('v'));
}
assert(tokens.size===1&&tokens.has(manifest.buildIdentity),'The executable graph does not have exactly one shared build token.');

const worker=manifest.runtimeGraph?.worker;
assert(worker&&worker.path==='test-worker.js'&&listed.has(worker.path),'The exact worker entry is missing from the deployment graph.');
assert(worker.digest===listed.get(worker.path).digest,'Worker graph digest does not match the manifested worker bytes.');
const workerUrl=new URL(worker.url,'https://deployment.invalid/');
assert(workerUrl.pathname==='/test-worker.js'&&workerUrl.searchParams.get('v')===manifest.buildIdentity,'Worker URL does not carry the shared build identity.');
const appSource=fs.readFileSync(path.join(root,'app-core.js'),'utf8'),runtimeSource=fs.readFileSync(path.join(root,'test-runtime.js'),'utf8'),workerSource=fs.readFileSync(path.join(root,'test-worker.js'),'utf8');
for(const [name,source] of [['app-core.js',appSource],['test-runtime.js',runtimeSource],['test-worker.js',workerSource]])assert(declaration(source,'RUNTIME_BUILD_ID')===manifest.buildIdentity,`${name} reports a mixed build identity.`);
assert(declaration(runtimeSource,'WORKER_PROTOCOL_VERSION')===worker.workerProtocolVersion&&declaration(workerSource,'WORKER_PROTOCOL_VERSION')===worker.workerProtocolVersion,'Worker protocol identity mismatch.');
assert(declaration(runtimeSource,'TEST_WORKER_SHA256')===worker.digest,'The runtime is not bound to the exact worker bytes.');
assert(manifest.workflowDefinition?.path==='.github/workflows/pages.yml'&&manifest.workflowDefinition?.hashAlgorithm==='SHA-256','Deployment manifest lacks the pinned workflow definition identity.');
assert(fs.existsSync(manifest.workflowDefinition.path)&&sha256(fs.readFileSync(manifest.workflowDefinition.path))===manifest.workflowDefinition.digest,'Deployment manifest workflow digest differs from the verified workflow source.');

if(process.env.GITHUB_SHA)assert(manifest.sourceCommit===process.env.GITHUB_SHA,'Deployment artifact is not bound to the current source commit.');
if(process.env.GITHUB_RUN_ID)assert(manifest.workflowRunIdentity===process.env.GITHUB_RUN_ID,'Deployment artifact is not bound to the current workflow run.');
console.log(JSON.stringify({deploymentManifestVerification:'PASS',resources:listed.size,executedScripts:graphScripts.length,buildIdentity:manifest.buildIdentity,workerDigest:worker.digest,manifestDigest:manifest.manifestDigest}));
