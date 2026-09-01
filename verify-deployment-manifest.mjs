import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

vm.runInThisContext(fs.readFileSync('hash.js','utf8'),{filename:'hash.js'});
const canonical=globalThis.closedLoopHash;
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const expectedRuntime=[
  'index.html','workbook.js','hash.js','workflow-schema.js','test-runtime.js','test-worker.js',
  'workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js','TEST_PROJECT.json'
];
const expectedScripts=expectedRuntime.filter(file=>file.endsWith('.js')&&file!=='test-worker.js');
const suppliedRoot=process.argv[2]?path.resolve(process.argv[2]):null;
const expectedRun=String(process.argv[4]||'verification-run-1');
const temporaryRoots=[];
let mutationCases=0;
let cleanCommittedTreeVerified=false;
let dirtyRuntimeSourceRejected=false;
let dirtyGeneratedOutputRejected=false;
const releaseInputPattern=file=>file==='.nojekyll'||file==='index.html'||file==='TEST_PROJECT.json'||/^[^/]+\.(?:js|mjs)$/.test(file)||/^(?:package\.json|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(file);

function copyReleaseSource(from,to){
  fs.mkdirSync(to,{recursive:true});
  for(const entry of fs.readdirSync(from,{withFileTypes:true}))if(entry.isFile()&&releaseInputPattern(entry.name))fs.copyFileSync(path.join(from,entry.name),path.join(to,entry.name));
  fs.mkdirSync(path.join(to,'.github','workflows'),{recursive:true});
  fs.copyFileSync(path.join(from,'.github','workflows','pages.yml'),path.join(to,'.github','workflows','pages.yml'));
}
function cleanSourceRepository(from=process.cwd(),mutateBeforeCommit=null){
  const root=fs.mkdtempSync(path.resolve('..','.closed-loop-source-fixture-'));
  temporaryRoots.push(root);
  copyReleaseSource(from,root);
  if(typeof mutateBeforeCommit==='function')mutateBeforeCommit(root);
  execFileSync('git',['init','-q'],{cwd:root,stdio:'pipe'});
  execFileSync('git',['config','user.name','closed-loop-verifier'],{cwd:root,stdio:'pipe'});
  execFileSync('git',['config','user.email','closed-loop-verifier@example.invalid'],{cwd:root,stdio:'pipe'});
  execFileSync('git',['add','.'],{cwd:root,stdio:'pipe'});
  execFileSync('git',['commit','-q','-m','Audited source fixture'],{cwd:root,stdio:'pipe'});
  const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  return {root,commit};
}

const sourceFixture=suppliedRoot?{root:process.cwd(),commit:String(process.argv[3]||process.env.GITHUB_SHA||'')} : cleanSourceRepository();
const sourceRoot=path.resolve(sourceFixture.root);
const expectedCommit=sourceFixture.commit;
const sourcePath=file=>path.join(sourceRoot,file);

function fixtureRoot(from=sourceRoot){
  const root=fs.mkdtempSync(path.resolve('..','.closed-loop-deployment-fixtures-'));
  temporaryRoots.push(root);
  for(const file of expectedRuntime)fs.copyFileSync(path.join(from,file),path.join(root,file));
  fs.copyFileSync(path.join(from,'.nojekyll'),path.join(root,'.nojekyll'));
  return root;
}
function build(root,commit=expectedCommit,run=expectedRun,from=sourceRoot){
  return execFileSync(process.execPath,[path.join(from,'build-deployment-manifest.mjs'),root,commit,run],{cwd:from,env:{...process.env,CLOSED_LOOP_SOURCE_ROOT:from},stdio:'pipe'});
}
function workflowSupplyChain(text){
  const uses=[...text.matchAll(/^\s*-?\s*uses:\s*([^\s]+)\s*$/gm)].map(match=>match[1]);
  assert(uses.length>=5,'Release CI must explicitly identify its actions.');
  for(const identity of uses)assert(/@[0-9a-f]{40}$/i.test(identity),`Release-critical action is not pinned by immutable commit SHA: ${identity}`);
  const nodeSelections=[...text.matchAll(/node-version:\s*['"]?([^'"\s]+)['"]?/g)].map(match=>match[1]);
  assert(nodeSelections.length&&nodeSelections.every(value=>/^\d+\.\d+\.\d+$/.test(value))&&new Set(nodeSelections).size===1,'Every release Node.js selection must be the same exact version, not a floating or mixed version.');
  const runners=[...text.matchAll(/runs-on:\s*([^\s]+)/g)].map(match=>match[1]);
  assert(runners.length&&runners.every(value=>/^ubuntu-\d+\.\d+$/.test(value))&&new Set(runners).size===1,'Release runner families must use one explicit version and must not use a mutable latest label.');
  return {uses,node:nodeSelections[0],nodeSelections,runners};
}
function assertNoServiceWorker(source){
  assert(!/(?:navigator\.)?serviceWorker\.register\s*\(/.test(source),'A controlling service worker is present in the runtime graph.');
}
function assertClosedContentSecurityPolicy(index){
  const content=index.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=(["'])(.*?)\1\s*>/i)?.[2];
  assert(content,'The static shell must declare one Content-Security-Policy meta value.');
  const directives=new Map(content.split(';').map(value=>value.trim()).filter(Boolean).map(value=>{const [name,...sources]=value.split(/\s+/);return [name,sources];}));
  const exact={
    'default-src':["'self'"],
    'script-src':["'self'"],
    'style-src':["'self'","'unsafe-inline'"],
    'img-src':["'self'",'data:','blob:'],
    'connect-src':["'self'"],
    'worker-src':["'self'"],
    'font-src':["'self'"],
    'media-src':["'none'"],
    'frame-src':["'none'"],
    'object-src':["'none'"],
    'base-uri':["'none'"],
    'form-action':["'none'"]
  };
  assert.deepEqual([...directives.keys()].sort(),Object.keys(exact).sort(),'CSP contains a missing, extra, or inherited-capability directive.');
  for(const [name,sources] of Object.entries(exact))assert.deepEqual(directives.get(name),sources,`CSP directive ${name} is broader than the closed deployment contract.`);
  assert(!content.includes("'unsafe-eval'")&&!content.includes('https:')&&!content.includes('http:')&&!content.includes('*'),'CSP permits arbitrary evaluation, remote origins, or wildcards.');
  return content;
}
function assertWorkerBinding(runtimeSource,workerBytes){
  const declared=runtimeSource.match(/const TEST_WORKER_SHA256='([a-f0-9]{64})'/i)?.[1]?.toLowerCase();
  const actual=sha256(workerBytes);
  assert(declared&&declared===actual,`The runtime worker identity ${declared||'MISSING'} does not match actual test-worker.js bytes ${actual}.`);
  return actual;
}
function manifestDigest(manifest){
  const {deploymentManifestDigest,...digestInput}=manifest;
  return sha256(Buffer.from(canonical.stableStringify(digestInput),'utf8'));
}
function validate(root,commit,run){
  const manifestPath=path.join(root,'deployment-manifest.json');
  assert(fs.existsSync(manifestPath),'Manifest builder must create deployment-manifest.json.');
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  assert.equal(manifest.schema,'closed-loop-deployment-manifest/1');
  assert.equal(manifest.sourceCommit,commit);
  assert.equal(manifest.workflowRunIdentity,run);
  assert.equal(manifest.workflowRunAttempt,String(process.env.GITHUB_RUN_ATTEMPT||'UNAVAILABLE'));
  assert.equal(manifest.canonicalizationVersion,'closed-loop-canonical-json/1');
  assert.equal(manifest.serviceWorkerPolicy,'NO_CONTROLLING_SERVICE_WORKER');
  assert.equal(manifest.resources.length,expectedRuntime.length);
  assert.deepEqual(manifest.resources.map(item=>item.path).sort(),[...expectedRuntime].sort());
  assert.equal(manifest.deploymentManifestDigest,manifestDigest(manifest),'Manifest self-digest must use the shared canonical JSON contract and omit its own digest.');
  assert.equal(manifest.dependencyManifestIdentity,sha256(Buffer.from(canonical.stableStringify(manifest.dependencyManifest),'utf8')),'Dependency-manifest identity is invalid.');
  assert.equal(manifest.toolchainManifestIdentity,sha256(Buffer.from(canonical.stableStringify(manifest.toolchainManifest),'utf8')),'Toolchain-manifest identity is invalid.');
  assert.equal(manifest.buildEnvironmentIdentity,manifest.toolchainManifestIdentity);
  assert.equal(manifest.toolchainManifest?.node?.selectedVersion,supplyNodeSelection(sourcePath('.github/workflows/pages.yml')));
  if(process.env.GITHUB_ACTIONS==='true')assert.equal(manifest.toolchainManifest.node.observedMatchesSelection,true,'CI must observe the exact selected Node.js toolchain.');
  assert.equal(manifest.cspSha256,sha256(Buffer.from(manifest.contentSecurityPolicy,'utf8')));
  assert.equal(manifest.supplyChain?.everyActionCommitPinned,true);
  assert.equal(manifest.supplyChain?.nodeSelectionExact,true);
  assert.equal(manifest.supplyChain?.runnerImagePinning,'OBSERVED_MUTABLE_PROVIDER_IMAGE');
  assert(Array.isArray(manifest.supplyChain?.limitations)&&manifest.supplyChain.limitations.some(value=>/not independently authenticated|not.*immutably pinned/i.test(value)),'Mutable provider-runner limitations must be reported honestly.');
  assert.equal(manifest.reproducibilityStatus,'PENDING_SECOND_CLEAN_BUILD_COMPARISON');

  for(const resource of manifest.resources){
    const bytes=fs.readFileSync(path.join(root,resource.path));
    assert.equal(resource.hashAlgorithm,'SHA-256');
    assert.equal(resource.byteSize,bytes.byteLength,`${resource.path} byte length must match the manifest.`);
    assert.equal(resource.digest,sha256(bytes),`${resource.path} deployed bytes must match the manifest.`);
    assert(resource.mediaType,`${resource.path} must have a declared media type.`);
  }
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const scriptUrls=[...index.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
  assert.equal(scriptUrls.length,expectedScripts.length);
  assert.deepEqual(scriptUrls.map(url=>url.split('?')[0]),expectedScripts);
  const buildTokens=scriptUrls.map(url=>new URLSearchParams(url.split('?')[1]||'').get('v'));
  assert(buildTokens.every(Boolean),'Every runtime script must carry a build identity.');
  assert.equal(new Set(buildTokens).size,1,'Mixed runtime build identities are prohibited.');
  assert.equal(manifest.buildIdentity,buildTokens[0]);
  assert.deepEqual(manifest.runtimeGraph?.scripts,scriptUrls);
  assert.equal(manifest.runtimeGraph?.worker,`test-worker.js?v=${encodeURIComponent(manifest.buildIdentity)}`);
  assert.equal(manifest.contentSecurityPolicy,assertClosedContentSecurityPolicy(index),'Manifest CSP must be the exact closed shell policy.');
  const allRuntimeSource=manifest.resources.filter(resource=>/\.(?:js|html)$/.test(resource.path)).map(resource=>fs.readFileSync(path.join(root,resource.path),'utf8')).join('\n');
  assertNoServiceWorker(allRuntimeSource);
  const actualWorkerSha256=assertWorkerBinding(fs.readFileSync(path.join(root,'test-runtime.js'),'utf8'),fs.readFileSync(path.join(root,'test-worker.js')));
  assert.equal(manifest.runtimeGraph?.workerSha256,actualWorkerSha256);
  assert.equal(manifest.resources.find(item=>item.path==='test-worker.js')?.digest,actualWorkerSha256);
  const runtimeSource=fs.readFileSync(path.join(root,'test-runtime.js'),'utf8');
  assert(/test-worker\.js/.test(runtimeSource),'The worker entry must be explicit.');
  assert(/url\.search\s*=/.test(runtimeSource)||/buildIdentity|runtimeBuildIdentity/.test(runtimeSource),'The worker URL must bind the shared build identity.');

  const workflow=fs.readFileSync(sourcePath('.github/workflows/pages.yml'),'utf8');
  const supply=workflowSupplyChain(workflow);
  assert.equal(manifest.workflow?.digest,sha256(Buffer.from(workflow)));
  assert.equal(manifest.buildScript?.digest,sha256(fs.readFileSync(sourcePath('build-deployment-manifest.mjs'))));
  assert.equal(manifest.sourceToBuildProvenance?.auditedSourceCommit,commit);
  assert.equal(manifest.sourceToBuildProvenance?.observedCheckoutCommit,commit);
  assert.equal(manifest.sourceToBuildProvenance?.allTrackedReleaseInputBytesMatchAuditedCommit,true);
  assert.equal(manifest.sourceToBuildProvenance?.evidenceBasis,'APPLICATION_OBSERVED_EXACT_GIT_BLOB_AND_OUTPUT_BYTE_COMPARISON');
  assert.equal(manifest.sourceToBuildProvenance?.deployedArtifactMustComeFromVerifiedSiteArtifact,true);
  assert.equal(manifest.sourceToBuildProvenance?.checkoutMatchesAuditedSourceCommit,true);
  const auditedInputs=manifest.sourceToBuildProvenance?.auditedSourceInputs||[];
  assert(auditedInputs.length>expectedRuntime.length&&auditedInputs.every(item=>item.path&&item.hashAlgorithm==='SHA-256'&&/^[a-f0-9]{64}$/.test(item.digest)&&item.byteSize>=0),'Audited release-input byte inventory is incomplete.');
  for(const item of auditedInputs){
    const blob=execFileSync('git',['show',`${commit}:${item.path}`],{cwd:sourceRoot,stdio:'pipe'});
    assert.equal(item.digest,sha256(blob),`Audited input ${item.path} is not bound to the exact commit blob.`);
    assert.equal(item.byteSize,blob.byteLength,`Audited input ${item.path} has the wrong byte length.`);
  }
  const generated=manifest.sourceToBuildProvenance?.deterministicGeneratedInputs||[];
  assert.equal(generated.length,1,'Exactly one deterministic generated deployment input must be declared.');
  assert.equal(generated[0].generatedPath,'TEST_PROJECT.json');
  assert.equal(generated[0].generatorPath,'build-test-project.mjs');
  assert.equal(generated[0].status,'TRACKED_GENERATOR_AND_OUTPUT_MATCH_AUDITED_COMMIT');
  assert.equal(generated[0].generatorDigest,sha256(fs.readFileSync(sourcePath('build-test-project.mjs'))));
  assert.equal(generated[0].generatedDigest,sha256(fs.readFileSync(sourcePath('TEST_PROJECT.json'))));
  assert.equal(manifest.supplyChain.githubActions.length,supply.uses.length);
  assert(workflow.includes('node build-deployment-manifest.mjs _site "$GITHUB_SHA" "$GITHUB_RUN_ID"'));
  assert(workflow.includes('node verify-live.mjs'),'Deployed-byte verification must run after deployment.');
  assert(workflow.includes('needs: [test, deploy]'),'Live verification must depend on both source tests and deployment.');
  assert(workflow.includes('verified-site-${{ github.sha }}'),'The exact verified site artifact must flow from build to live verification.');
  for(const token of ['BROWSER_PROOF_PATH=verify-browser-proof.json','verify-browser-proof.json','browserProof.workerSha256'])assert(workflow.includes(token),`The deployed browser/toolchain proof must preserve ${token}.`);
  const liveVerifier=fs.readFileSync(sourcePath('verify-live.mjs'),'utf8');
  for(const token of ['deployment-manifest.json','deploymentManifestDigest','sourceCommit','REPRODUCIBILITY_SITE_ROOT','APPLICATION_OBSERVED_EXACT_GIT_BLOB_AND_OUTPUT_BYTE_COMPARISON','APPLICATION_OBSERVED_SEPARATE_WORKFLOW_JOB_SECOND_CLEAN_OUTPUT_BUILD','reproducibilityEnvironmentComparison'])assert(liveVerifier.includes(token),`verify-live.mjs must verify ${token}.`);
  assert(!liveVerifier.includes('APPLICATION_OBSERVED_SAME_RUNNER_SECOND_CLEAN_OUTPUT_BUILD'),'A separate CI job must not be represented as the same runner instance.');
  assert(/cache\s*:\s*['"]no-store['"]/.test(liveVerifier),'verify-live.mjs must bypass ordinary HTTP caches when retrieving deployed bytes.');
  const browserVerifier=fs.readFileSync(sourcePath('verify-browser-extra.mjs'),'utf8');
  for(const token of ['executeNativeWorkerAndVerifyGraph','Network.responseReceived','persistent-cached-profile','getRegistrations','testWorkerSha256'])assert(browserVerifier.includes(token),`Browser acceptance must prove ${token}.`);
  return {manifest,pinnedActions:supply.uses.length,workerSha256:actualWorkerSha256};
}

function supplyNodeSelection(workflowPath){
  const workflow=fs.readFileSync(workflowPath,'utf8');
  return workflowSupplyChain(workflow).node;
}

try{
  const root=suppliedRoot||fixtureRoot();
  if(!suppliedRoot)build(root);
  const result=validate(root,expectedCommit,expectedRun);
  cleanCommittedTreeVerified=true;

  const workerMutationSource=cleanSourceRepository(sourceRoot,root=>fs.appendFileSync(path.join(root,'test-worker.js'),'\n/* changed worker */\n'));
  const workerMutationRoot=fixtureRoot(workerMutationSource.root);
  assert.throws(()=>build(workerMutationRoot,workerMutationSource.commit,expectedRun,workerMutationSource.root),/not bound to the exact deployed test-worker\.js bytes/i);
  mutationCases++;
  assert.throws(()=>assertNoServiceWorker(`${fs.readFileSync(path.join(root,'app-core.js'),'utf8')}\nnavigator.serviceWorker.register('stale-worker.js');`),/controlling service worker/i);
  mutationCases++;
  const currentIndex=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.throws(()=>assertClosedContentSecurityPolicy(currentIndex.replace("default-src 'self'","default-src 'self' data: blob:")),/default-src is broader/i);
  mutationCases++;
  const workflow=fs.readFileSync(sourcePath('.github/workflows/pages.yml'),'utf8');
  assert.throws(()=>workflowSupplyChain(workflow.replace(/node-version:\s*['"][^'"]+['"]/,"node-version: '22'")),/Node\.js selection/i);
  mutationCases++;
  assert.throws(()=>workflowSupplyChain(workflow.replace(/runs-on:\s*ubuntu-\d+\.\d+/, 'runs-on: ubuntu-latest')),/runner families/i);
  mutationCases++;
  assert.throws(()=>workflowSupplyChain(workflow.replace(/uses:\s*([^@\s]+)@[0-9a-f]{40}/i,'uses: $1@main')),/not pinned/i);
  mutationCases++;
  const alteredManifest=structuredClone(result.manifest);alteredManifest.resources[0].digest='0'.repeat(64);
  assert.notEqual(alteredManifest.deploymentManifestDigest,manifestDigest(alteredManifest),'A modified resource digest must invalidate the manifest self-digest.');
  mutationCases++;

  const extraRoot=fixtureRoot();fs.writeFileSync(path.join(extraRoot,'rogue-runtime.js'),'globalThis.rogueRuntime=true;\n');
  assert.throws(()=>build(extraRoot),/Unmanifested static resource/i);
  mutationCases++;
  const mixedSource=cleanSourceRepository(sourceRoot,root=>{
    const indexPath=path.join(root,'index.html'),mixedIndex=fs.readFileSync(indexPath,'utf8').replace(/(workbook\.js\?v=)[^"']+/,'$1stale-build');
    fs.writeFileSync(indexPath,mixedIndex);
  });
  const mixedRoot=fixtureRoot(mixedSource.root);
  assert.throws(()=>build(mixedRoot,mixedSource.commit,expectedRun,mixedSource.root),/shared build identity|does not declare the shared build identity/i);
  mutationCases++;

  const dirtySource=cleanSourceRepository(sourceRoot),dirtyRuntime=path.join(dirtySource.root,'workflow-engine.js');
  fs.appendFileSync(dirtyRuntime,'\n/* uncommitted runtime mutation */\n');
  const dirtyOutputRoot=fixtureRoot(dirtySource.root);
  assert.throws(()=>build(dirtyOutputRoot,dirtySource.commit,expectedRun,dirtySource.root),/Checked-out release input does not match audited source commit.*workflow-engine\.js/i);
  dirtyRuntimeSourceRejected=true;
  mutationCases++;

  const dirtyGeneratedSource=cleanSourceRepository(sourceRoot),dirtyGeneratedPath=path.join(dirtyGeneratedSource.root,'TEST_PROJECT.json');
  fs.appendFileSync(dirtyGeneratedPath,'\n');
  const dirtyGeneratedRoot=fixtureRoot(dirtyGeneratedSource.root);
  assert.throws(()=>build(dirtyGeneratedRoot,dirtyGeneratedSource.commit,expectedRun,dirtyGeneratedSource.root),/Checked-out release input does not match audited source commit.*TEST_PROJECT\.json/i);
  dirtyGeneratedOutputRejected=true;
  mutationCases++;

  console.log(JSON.stringify({
    verifier:'closed-loop-deployment-manifest-verification/1',
    status:'PASS',
    sourceCommit:result.manifest.sourceCommit,
    buildIdentity:result.manifest.buildIdentity,
    resourceCount:result.manifest.resources.length,
    pinnedActions:result.pinnedActions,
    workerSha256:result.workerSha256,
    toolchainManifestIdentity:result.manifest.toolchainManifestIdentity,
    dependencyManifestIdentity:result.manifest.dependencyManifestIdentity,
    runnerImagePinning:result.manifest.supplyChain.runnerImagePinning,
    cleanCommittedTreeVerified,
    dirtyRuntimeSourceRejected,
    dirtyGeneratedOutputRejected,
    mutationCases,
    deploymentManifestDigest:result.manifest.deploymentManifestDigest
  },null,2));
}finally{
  for(const root of temporaryRoots)fs.rmSync(root,{recursive:true,force:true});
}
