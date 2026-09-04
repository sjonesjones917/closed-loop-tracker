import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const exactSourceCommit=process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(!/^[0-9a-f]{40}$/.test(exactSourceCommit))throw new Error('Exact current source commit is unavailable.');
process.env.SOURCE_COMMIT=exactSourceCommit;
await import('./verify-specification-governance.mjs');
await import('./verify-build-stage-ledger.mjs');
await import('./hash.js');
const hashAuthority=globalThis.closedLoopHash;
if(!hashAuthority||hashAuthority.canonicalizationVersion!=='closed-loop-canonical-json/1'||typeof hashAuthority.stableStringify!=='function'||typeof hashAuthority.sha256Value!=='function')throw new Error('Shared canonical hash authority is unavailable to deployment verification.');
const canonical=value=>hashAuthority.stableStringify(value);

const root=process.cwd();
const specificationPath=path.join(root,'specification/closed-loop-reliability-controlling-implementation-specification.txt');
const specificationManifestPath=path.join(root,'specification/closed-loop-specification-manifest.json');
const specificationBytes=fs.readFileSync(specificationPath);
const nodeSpecificationSha256=crypto.createHash('sha256').update(specificationBytes).digest('hex');
const independentSpecificationSha256=execFileSync('sha256sum',[specificationPath],{encoding:'utf8'}).trim().split(/\s+/)[0];
const independentSpecificationByteLength=Number(execFileSync('wc',['-c',specificationPath],{encoding:'utf8'}).trim().split(/\s+/)[0]);
if(nodeSpecificationSha256!==independentSpecificationSha256)throw new Error('Independent specification SHA-256 calculation disagrees with Node crypto.');
if(specificationBytes.length!==independentSpecificationByteLength)throw new Error('Independent specification byte-length calculation disagrees with Node byte custody.');
const generatedSpecificationManifest=JSON.parse(fs.readFileSync(specificationManifestPath,'utf8'));
if(generatedSpecificationManifest.sourceCommit!==exactSourceCommit)throw new Error('Generated specification manifest is not bound to the exact current source commit.');
if(generatedSpecificationManifest.sha256!==nodeSpecificationSha256||generatedSpecificationManifest.byteLength!==specificationBytes.length)throw new Error('Generated specification manifest is not bound to the independently verified exact specification bytes.');

const first=path.join(root,'.verify-deployment-a');
const second=path.join(root,'.verify-deployment-b');
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const build=out=>execFileSync(process.execPath,['build-static-site.mjs','--out',out,'--source-commit','TEST-COMMIT','--workflow-run','TEST-RUN'],{stdio:'pipe'});
const runtimeScriptSources=html=>[...html.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
function verifyRuntimeUrlBindings(html,manifest){
  const sources=runtimeScriptSources(html);
  if(sources.length!==9)throw new Error(`Expected nine runtime scripts; found ${sources.length}.`);
  for(const source of sources){const query=source.split('?')[1]||'',params=new URLSearchParams(query);if(params.get('v')!==manifest.buildIdentity)throw new Error(`Runtime script ${source} is not bound to the deployment build identity.`);}
  const runtimeSource=sources.find(source=>source.split('?')[0]==='test-runtime.js');
  if(!runtimeSource)throw new Error('test-runtime.js is absent from the runtime graph.');
  const runtimeParams=new URLSearchParams(runtimeSource.split('?')[1]||'');
  if(runtimeParams.get('workerSha256')!==manifest.testWorkerSha256)throw new Error('test-runtime.js URL does not bind the exact deployed test-worker.js SHA-256.');
  return true;
}
try{
  const buildSource=fs.readFileSync(path.join(root,'build-static-site.mjs'),'utf8');
  if(!buildSource.includes("await import('./hash.js')"))throw new Error('Deployment build does not load the shared hash.js authority.');
  if(!buildSource.includes("hashAuthority.canonicalizationVersion"))throw new Error('Deployment build does not bind canonicalization to the shared hash.js identity.');
  if(!buildSource.includes('hashAuthority.sha256Value(manifestWithoutDigest)'))throw new Error('Deployment manifest digest is not produced by the shared hash.js authority.');
  if(/const\s+assertUnicodeScalars\s*=|const\s+compareUnicodeScalarSequence\s*=|const\s+canonical\s*=\s*value\s*=>\s*\{/.test(buildSource))throw new Error('Deployment build contains a parallel canonical JSON implementation instead of using hash.js.');

  const bmp='\uE000',astral='\u{10000}';
  if(canonical({[bmp]:1,[astral]:2})!==`{"${bmp}":1,"${astral}":2}`)throw new Error('Shared deployment-manifest canonicalizer does not order object keys by unsigned Unicode scalar sequence.');
  if(canonical({'2':'two','10':'ten',a:'aye'})!=='{"10":"ten","2":"two","a":"aye"}')throw new Error('Shared deployment-manifest canonicalizer allows JavaScript integer-like key enumeration to override canonical scalar ordering.');
  let rejectedSurrogate=false;try{canonical({'\uD800':1});}catch{rejectedSurrogate=true;}if(!rejectedSurrogate)throw new Error('Shared deployment-manifest canonicalizer accepted an unpaired surrogate key.');
  build(first);build(second);
  const manifestBytesA=fs.readFileSync(path.join(first,'closed-loop-deployment-manifest.json'));
  const manifestBytesB=fs.readFileSync(path.join(second,'closed-loop-deployment-manifest.json'));
  if(!manifestBytesA.equals(manifestBytesB))throw new Error('Two clean builds did not produce the same deployment manifest.');
  const manifest=JSON.parse(manifestBytesA);
  if(manifest.schema!=='closed-loop-deployment-manifest/1')throw new Error('Wrong deployment manifest schema.');
  if(manifest.canonicalOrigin!=='https://sjonesjones917.github.io')throw new Error('Deployment manifest canonical origin is wrong.');
  if(manifest.canonicalHost!=='sjonesjones917.github.io')throw new Error('Deployment manifest canonical host is wrong.');
  if(manifest.canonicalBasePath!=='/closed-loop-tracker/')throw new Error('Deployment manifest canonical base path is wrong.');
  if(manifest.deploymentEnvironment!=='github-pages')throw new Error('Deployment environment identity is wrong.');
  if(manifest.noCrossOriginRedirect!==true||manifest.permittedRuntimeOrigin!=='SAME_ORIGIN_ONLY')throw new Error('Deployment origin/redirect policy is not closed.');
  if(manifest.workflowIdentity!=='mobile-closed-loop/30')throw new Error('Deployment manifest workflow identity is wrong.');
  if(manifest.projectSchema!=='closed-loop-project/3'||manifest.responseSchema!=='closed-loop-stage-response/3')throw new Error('Deployment manifest runtime schema identity is wrong.');
  if(manifest.testIrSchema!=='closed-loop-test-spec/1'||manifest.verificationPackageSchema!=='closed-loop-verification-package/1')throw new Error('Deployment manifest verification contract identity is wrong.');
  if(manifest.contractProfileId!=='closed-loop-completion-profile/1')throw new Error('Deployment manifest contract profile is missing or wrong.');
  if(manifest.testWorkerProtocolVersion!=='closed-loop-test-worker-protocol/1')throw new Error('Deployment manifest worker protocol identity is missing or wrong.');
  const withoutDigest={...manifest};delete withoutDigest.manifestDigest;
  if(manifest.manifestDigest?.hashAlgorithm!=='SHA-256'||manifest.manifestDigest?.digest!==hashAuthority.sha256Value(withoutDigest))throw new Error('Deployment manifest digest mismatch.');
  if(!Array.isArray(manifest.runtimeResources)||manifest.runtimeResources.length!==13)throw new Error('Deployment resource closure is incomplete.');
  const paths=new Set();
  for(const resource of manifest.runtimeResources){
    if(paths.has(resource.path))throw new Error(`Duplicate deployment path: ${resource.path}`);paths.add(resource.path);
    const bytes=fs.readFileSync(path.join(first,resource.path));
    if(resource.byteSize!==bytes.length||resource.hashAlgorithm!=='SHA-256'||resource.digest!==sha256(bytes))throw new Error(`Deployment digest mismatch: ${resource.path}`);
    if(resource.buildIdentity!==manifest.buildIdentity)throw new Error(`Mixed build identity: ${resource.path}`);
  }
  for(const prohibited of ['specification/closed-loop-reliability-controlling-implementation-specification.txt','specification/closed-loop-specification-manifest.json','specification/closed-loop-normative-requirements.json','generate-specification-governance.mjs','verify-specification-governance.mjs']){
    if(paths.has(prohibited)||fs.existsSync(path.join(first,prohibited)))throw new Error(`Repository-only governance content leaked into deployed runtime: ${prohibited}`);
  }
  const workerResource=manifest.runtimeResources.find(resource=>resource.path==='test-worker.js');
  if(!workerResource||manifest.testWorkerSha256!==workerResource.digest)throw new Error('Deployment manifest does not bind testWorkerSha256 to the exact deployed worker bytes.');
  const workerSource=fs.readFileSync(path.join(first,'test-worker.js'),'utf8');
  if(!workerSource.includes("const WORKER_PROTOCOL_VERSION='closed-loop-test-worker-protocol/1'"))throw new Error('Worker source is not bound to the declared worker protocol.');
  if(!workerSource.includes('workerProtocolVersion:WORKER_PROTOCOL_VERSION'))throw new Error('Worker success/failure results do not expose the worker protocol identity.');
  if(!workerSource.includes('testWorkerSha256:EXPECTED_WORKER_SHA256'))throw new Error('Worker results do not carry the manifest-bound worker-byte identity.');
  if(workerSource.includes('message.metadata?.testWorkerSha256'))throw new Error('Worker byte identity must not come from the execution caller.');
  if(!workerSource.includes('WORKER_DIGEST_IDENTITY_MISSING'))throw new Error('Deployed worker does not fail closed when its manifest-bound digest is missing.');
  if(!workerSource.includes('runtimeBuildIdentity:WORKER_BUILD_ID'))throw new Error('Worker results do not bind the runtime build identity to the exact worker URL build identity.');
  if(workerSource.includes('runtimeBuildIdentity:result.runtimeBuildIdentity||WORKER_BUILD_ID'))throw new Error('Worker results may not prefer an unmanifested runtime sentinel over the authoritative worker build identity.');
  if(!workerSource.includes('RUNTIME_BUILD_IDENTITY_MISMATCH'))throw new Error('Worker does not fail closed when a meaningful runtime build identity disagrees with the worker build identity.');
  const workerHashIndex=workerSource.indexOf('`hash.js${query}`');
  const workerRuntimeIndex=workerSource.indexOf('`test-runtime.js${query}`');
  if(workerHashIndex<0||workerRuntimeIndex<0||workerHashIndex>workerRuntimeIndex)throw new Error('Test IR worker must load hash.js before test-runtime.js so the shared canonical hash authority exists in the worker global.');
  const html=fs.readFileSync(path.join(first,'index.html'),'utf8');
  verifyRuntimeUrlBindings(html,manifest);
  if(!html.includes(`<meta name="closed-loop-build-identity" content="${manifest.buildIdentity}">`))throw new Error('Executed build identity meta is missing.');
  let missingWorkerDigestDetected=false;
  try{verifyRuntimeUrlBindings(html.replace(`&workerSha256=${manifest.testWorkerSha256}`,''),manifest);}catch(error){missingWorkerDigestDetected=/worker.*SHA-256/i.test(String(error.message));}
  if(!missingWorkerDigestDetected)throw new Error('Mutation proof failed: removing the worker digest from the deployed runtime URL was not detected.');
  let changedWorkerDigestDetected=false;
  const changedDigest=manifest.testWorkerSha256[0]==='0'?`1${manifest.testWorkerSha256.slice(1)}`:`0${manifest.testWorkerSha256.slice(1)}`;
  try{verifyRuntimeUrlBindings(html.replace(manifest.testWorkerSha256,changedDigest),manifest);}catch(error){changedWorkerDigestDetected=/worker.*SHA-256/i.test(String(error.message));}
  if(!changedWorkerDigestDetected)throw new Error('Mutation proof failed: changing the worker digest in the deployed runtime URL was not detected.');
  const active=manifest.runtimeResources.filter(item=>/\.(?:html|js)$/.test(item.path)).map(item=>fs.readFileSync(path.join(first,item.path),'utf8')).join('\n');
  if(/serviceWorker\s*\.\s*register|navigator\s*\.\s*serviceWorker/.test(active))throw new Error('An unmanifested controlling service worker is present.');
  if(!fs.readFileSync(path.join(first,'test-runtime.js'),'utf8').includes("url.search=new URL(source).search"))throw new Error('Worker does not inherit the runtime build and worker-byte identity.');
  console.log(JSON.stringify({deploymentManifest:'PASS',schema:manifest.schema,canonicalOrigin:manifest.canonicalOrigin,canonicalBasePath:manifest.canonicalBasePath,contractProfileId:manifest.contractProfileId,testWorkerProtocolVersion:manifest.testWorkerProtocolVersion,testWorkerSha256:manifest.testWorkerSha256,resources:manifest.runtimeResources.length,buildIdentity:manifest.buildIdentity,manifestDigest:manifest.manifestDigest.digest,reproducible:true,sharedCanonicalHashAuthority:true,canonicalUnicodeScalarOrdering:true,integerLikeKeyOrdering:true,unpairedSurrogateRejected:true,workerCanonicalHashDependency:true,workerResultBuildIdentityBound:true,workerResultByteIdentityBound:true,missingWorkerDigestMutationDetected:true,changedWorkerDigestMutationDetected:true,noControllingServiceWorker:true,repositoryGovernanceExcludedFromRuntime:true,exactSourceCommitBound:true,specificationByteLength:specificationBytes.length,specificationSha256:nodeSpecificationSha256,independentSpecificationSha256,independentSpecificationByteLength},null,2));
}finally{
  fs.rmSync(first,{recursive:true,force:true});fs.rmSync(second,{recursive:true,force:true});
}
