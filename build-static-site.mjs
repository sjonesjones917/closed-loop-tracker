import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

await import('./hash.js');
const hashAuthority=globalThis.closedLoopHash;
if(!hashAuthority||hashAuthority.canonicalizationVersion!=='closed-loop-canonical-json/1'||typeof hashAuthority.stableStringify!=='function'||typeof hashAuthority.sha256Value!=='function')throw new Error('The shared closed-loop-canonical-json/1 authority from hash.js is unavailable.');

const args=process.argv.slice(2);
const valueOf=(name,fallback)=>{const index=args.indexOf(name);return index>=0&&args[index+1]?args[index+1]:fallback;};
const outDir=path.resolve(valueOf('--out','_site'));
const sourceCommit=valueOf('--source-commit',process.env.GITHUB_SHA||'LOCAL_UNCOMMITTED');
const workflowRunIdentity=valueOf('--workflow-run',process.env.GITHUB_RUN_ID||'LOCAL');
const canonicalizationVersion=hashAuthority.canonicalizationVersion;
const hashAlgorithm='SHA-256';
const workflowIdentity='mobile-closed-loop/30';
const projectSchema='closed-loop-project/3';
const responseSchema='closed-loop-stage-response/3';
const testIrSchema='closed-loop-test-spec/1';
const verificationPackageSchema='closed-loop-verification-package/1';
const contractProfileId='closed-loop-completion-profile/1';
const testWorkerProtocolVersion='closed-loop-test-worker-protocol/1';
const canonicalOrigin='https://sjonesjones917.github.io';
const canonicalHost='sjonesjones917.github.io';
const canonicalBasePath='/closed-loop-tracker/';
const deploymentEnvironment='github-pages';
const runtimeOrder=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const deployedSources=['index.html',...runtimeOrder.slice(0,4),'test-worker.js',...runtimeOrder.slice(4),'TEST_PROJECT.json','.nojekyll'];
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const sourceTestWorkerSha256=sha256(fs.readFileSync('test-worker.js'));
const mediaType=file=>file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.json')?'application/json':file==='.nojekyll'?'application/octet-stream':'application/octet-stream';

for(const file of deployedSources)if(!fs.existsSync(file))throw new Error(`Missing deployment source: ${file}`);
const sourceBundle=deployedSources.map(file=>{
  let bytes=fs.readFileSync(file);
  if(file==='index.html')bytes=Buffer.from(bytes.toString('utf8').replace(/\?v=[^"']+/g,'?v=__CLOSED_LOOP_BUILD_ID__'),'utf8');
  return Buffer.concat([Buffer.from(`${file}\0${bytes.length}\0`,'utf8'),bytes]);
});
const bundleDigest=sha256(Buffer.concat(sourceBundle));
const buildIdentity=`build-sha256-${bundleDigest}`;

fs.rmSync(outDir,{recursive:true,force:true});
fs.mkdirSync(outDir,{recursive:true});
for(const file of deployedSources){
  let bytes=fs.readFileSync(file);
  if(file==='index.html'){
    let html=bytes.toString('utf8').replace(/\?v=[^"']+/g,`?v=${buildIdentity}`);
    html=html.replace(`test-runtime.js?v=${buildIdentity}`,`test-runtime.js?v=${buildIdentity}&workerSha256=${sourceTestWorkerSha256}`);
    const meta=`<meta name="closed-loop-build-identity" content="${buildIdentity}">`;
    html=html.replace(/<meta name="theme-color"[^>]*>/,match=>`${match}\n${meta}`);
    bytes=Buffer.from(html,'utf8');
  }
  fs.writeFileSync(path.join(outDir,file),bytes);
}

const runtimeResources=deployedSources.map(file=>{const bytes=fs.readFileSync(path.join(outDir,file));return {path:file,mediaType:mediaType(file),byteSize:bytes.length,hashAlgorithm,digest:sha256(bytes),buildIdentity};});
const testWorkerResource=runtimeResources.find(resource=>resource.path==='test-worker.js');
if(!testWorkerResource)throw new Error('test-worker.js is missing from the deployment resource graph.');
if(testWorkerResource.digest!==sourceTestWorkerSha256)throw new Error('Built test-worker.js bytes differ from the worker digest bound into the runtime URL.');
const csp=fs.readFileSync(path.join(outDir,'index.html'),'utf8').match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1];
if(!csp)throw new Error('CSP was not found in built index.html.');
const manifest={
  schema:'closed-loop-deployment-manifest/1',
  canonicalOrigin,
  canonicalHost,
  canonicalBasePath,
  deploymentEnvironment,
  noCrossOriginRedirect:true,
  permittedRuntimeOrigin:'SAME_ORIGIN_ONLY',
  workflowIdentity,
  projectSchema,
  responseSchema,
  testIrSchema,
  verificationPackageSchema,
  contractProfileId,
  testWorkerProtocolVersion,
  testWorkerSha256:testWorkerResource.digest,
  sourceCommit,
  workflowRunIdentity,
  buildIdentity,
  canonicalizationVersion,
  runtimeResources,
  nonruntimeExcludedPaths:[
    {path:'closed-loop-deployment-manifest.json',reason:'Self-describing deployment evidence; its digest is the overall manifest digest with manifestDigest omitted.'},
    {path:'specification/closed-loop-reliability-controlling-implementation-specification.txt',reason:'Repository-only controlling implementation specification; prohibited from runtime deployment.'},
    {path:'specification/closed-loop-specification-manifest.json',reason:'Repository-only specification governance evidence; prohibited from runtime deployment.'},
    {path:'specification/closed-loop-normative-requirements.json',reason:'Repository-only normative-requirement governance evidence; prohibited from runtime deployment.'},
    {path:'generate-specification-governance.mjs',reason:'Repository-only governance generator.'},
    {path:'review-specification-coverage.mjs',reason:'Repository-only independent governance reviewer.'},
    {path:'verify-specification-governance.mjs',reason:'Repository-only governance verifier.'},
    {path:'generate-stage01-proof.mjs',reason:'Repository-only build-stage proof generator.'},
    {path:'verify-build-stage-state.mjs',reason:'Repository-only build-state verifier.'},
    {path:'verification/',reason:'Repository-only controller build-state and proof records.'}
  ],
  cspExactValue:csp,
  cspSha256:sha256(Buffer.from(csp,'utf8')),
  dependencyAndToolchainManifestIdentity:{node:process.version,platform:process.platform,architecture:process.arch,lockfile:'NOT_APPLICABLE_NO_PACKAGES'},
  buildCommand:'node build-static-site.mjs --out <output> --source-commit <commit> --workflow-run <run>',
  buildEnvironmentIdentity:{kind:'STATIC_NODE_BUILD',localeIndependent:true,timezoneIndependent:true},
  workflowFileSha256:sha256(fs.readFileSync('.github/workflows/pages.yml')),
  reproducibilityStatus:'DETERMINISTIC_FOR_IDENTICAL_DECLARED_INPUTS',
  manifestDigest:null
};
const manifestWithoutDigest={...manifest};delete manifestWithoutDigest.manifestDigest;
manifest.manifestDigest={hashAlgorithm,digest:hashAuthority.sha256Value(manifestWithoutDigest)};
fs.writeFileSync(path.join(outDir,'closed-loop-deployment-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({schema:manifest.schema,sourceCommit,workflowRunIdentity,buildIdentity,resources:runtimeResources.length,manifestDigest:manifest.manifestDigest.digest,outDir},null,2));
