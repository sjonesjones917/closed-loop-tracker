import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';

const siteRoot=path.resolve(process.argv[2]||'_site');
const sourceCommit=String(process.argv[3]||process.env.GITHUB_SHA||'');
const workflowRunIdentity=String(process.argv[4]||process.env.GITHUB_RUN_ID||'LOCAL');
const sourceRoot=path.resolve(process.env.CLOSED_LOOP_SOURCE_ROOT||'.');
const resourcePaths=[
  'index.html','workbook.js','hash.js','workflow-schema.js','test-runtime.js','test-worker.js',
  'workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js','TEST_PROJECT.json'
];
const runtimeScripts=resourcePaths.filter(file=>file.endsWith('.js')&&file!=='test-worker.js');
const allowedBeforeManifest=new Set([...resourcePaths,'.nojekyll','deployment-manifest.json']);
const deterministicGeneratedPaths=new Map([
  ['TEST_PROJECT.json',{generatorPath:'build-test-project.mjs',command:'node build-test-project.mjs'}]
]);
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const mediaType=file=>file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'application/octet-stream';
const walk=(root,prefix='')=>fs.readdirSync(root,{withFileTypes:true}).flatMap(entry=>{
  const relative=prefix?`${prefix}/${entry.name}`:entry.name;
  return entry.isDirectory()?walk(path.join(root,entry.name),relative):[relative];
});
const commandVersion=(candidates,args=['--version'])=>{
  for(const command of candidates){
    const result=spawnSync(command,args,{encoding:'utf8'});
    if(result.status===0){
      const output=String(result.stdout||result.stderr||'').trim().split(/\r?\n/)[0];
      if(output)return {command,version:output};
    }
  }
  return {command:null,version:'UNAVAILABLE'};
};
const git=(args,options={})=>spawnSync('git',['-C',sourceRoot,...args],options);
const observedCheckoutCommit=(()=>{
  const result=git(['rev-parse','HEAD'],{encoding:'utf8'});
  const value=result.status===0?String(result.stdout||'').trim():'';
  return /^[0-9a-f]{40}$/i.test(value)?value.toLowerCase():'UNAVAILABLE';
})();

function auditedTreePaths(commit){
  const result=git(['ls-tree','-r','--name-only',commit],{encoding:'utf8'});
  if(result.status!==0)throw new Error(`Unable to read audited source tree ${commit}: ${String(result.stderr||'').trim()}`);
  return String(result.stdout||'').split(/\r?\n/).filter(Boolean);
}
function isReleaseInputPath(file){
  return file==='.nojekyll'||file==='index.html'||file==='TEST_PROJECT.json'||
    file==='.github/workflows/pages.yml'||
    /^[^/]+\.(?:js|mjs)$/.test(file)||
    /^(?:package\.json|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(file);
}
function auditedBlob(commit,file){
  const result=git(['show',`${commit}:${file}`],{encoding:null,maxBuffer:64*1024*1024});
  if(result.status!==0)throw new Error(`Tracked release input is unavailable from audited commit ${commit}: ${file}`);
  return Buffer.from(result.stdout);
}
function currentReleaseInputCandidates(){
  const rootFiles=fs.readdirSync(sourceRoot,{withFileTypes:true})
    .filter(entry=>entry.isFile())
    .map(entry=>entry.name)
    .filter(isReleaseInputPath);
  const workflowRoot=path.join(sourceRoot,'.github','workflows');
  const workflowFiles=fs.existsSync(workflowRoot)?fs.readdirSync(workflowRoot,{withFileTypes:true})
    .filter(entry=>entry.isFile()&&/\.ya?ml$/i.test(entry.name))
    .map(entry=>`.github/workflows/${entry.name}`):[];
  return [...new Set([...rootFiles,...workflowFiles])].sort();
}
function verifyAuditedSourceBytes(commit){
  const treePaths=auditedTreePaths(commit),trackedReleaseInputs=treePaths.filter(isReleaseInputPath).sort();
  const trackedSet=new Set(trackedReleaseInputs);
  for(const file of currentReleaseInputCandidates())if(!trackedSet.has(file))throw new Error(`Untracked release input cannot be bound to audited commit ${commit}: ${file}`);
  for(const required of [...resourcePaths,'.nojekyll','build-deployment-manifest.mjs','build-test-project.mjs','verify-deployment-manifest.mjs','verify-live.mjs','verify-browser.mjs','verify-browser-extra.mjs','.github/workflows/pages.yml']){
    if(!trackedSet.has(required))throw new Error(`Required release input is not tracked by audited commit ${commit}: ${required}`);
  }
  const records=trackedReleaseInputs.map(file=>{
    const sourcePath=path.join(sourceRoot,file);
    if(!fs.existsSync(sourcePath)||!fs.statSync(sourcePath).isFile())throw new Error(`Tracked release input is missing from the checked-out workspace: ${file}`);
    const expected=auditedBlob(commit,file),actual=fs.readFileSync(sourcePath);
    if(!actual.equals(expected))throw new Error(`Checked-out release input does not match audited source commit ${commit}: ${file}`);
    const generated=deterministicGeneratedPaths.get(file)||null;
    if(generated&&!trackedSet.has(generated.generatorPath))throw new Error(`Deterministic generator is not tracked by audited commit ${commit}: ${generated.generatorPath}`);
    return {path:file,hashAlgorithm:'SHA-256',digest:digest(actual),byteSize:actual.byteLength,sourceDisposition:generated?'DETERMINISTIC_GENERATED_TRACKED_AND_BYTE_MATCHED':'TRACKED_BYTE_MATCH'};
  });
  for(const file of [...resourcePaths,'.nojekyll']){
    const output=fs.readFileSync(path.join(siteRoot,file)),source=fs.readFileSync(path.join(sourceRoot,file));
    if(!output.equals(source))throw new Error(`Deployment output does not match audited source input bytes: ${file}`);
  }
  return records;
}

if(!/^[0-9a-f]{40}$/i.test(sourceCommit))throw new Error('A complete 40-hex audited source commit is required for deployment-manifest generation.');
if(!workflowRunIdentity.trim())throw new Error('A workflow-run identity is required for deployment-manifest generation.');
if(observedCheckoutCommit!==sourceCommit.toLowerCase())throw new Error(`The checked-out source commit ${observedCheckoutCommit} does not match the audited deployment commit ${sourceCommit}.`);
for(const file of resourcePaths)if(!fs.existsSync(path.join(siteRoot,file)))throw new Error(`Deployment resource is missing: ${file}`);
for(const file of walk(siteRoot))if(!allowedBeforeManifest.has(file))throw new Error(`Unmanifested static resource is present before manifest generation: ${file}`);
const auditedSourceInputs=verifyAuditedSourceBytes(sourceCommit.toLowerCase());

/* closed-loop-canonical-json/1 has exactly one implementation. The deployed
   hash authority is loaded from the same bytes that the manifest identifies. */
vm.runInThisContext(fs.readFileSync(path.join(siteRoot,'hash.js'),'utf8'),{filename:path.join(siteRoot,'hash.js')});
const hashAuthority=globalThis.closedLoopHash;
if(!hashAuthority||hashAuthority.CANONICAL_JSON_VERSION!=='closed-loop-canonical-json/1'||typeof hashAuthority.stableStringify!=='function')throw new Error('The shared canonical JSON authority is unavailable.');
const canonical=value=>hashAuthority.stableStringify(value);

const resources=resourcePaths.map(file=>{
  const bytes=fs.readFileSync(path.join(siteRoot,file));
  return {path:file,mediaType:mediaType(file),byteSize:bytes.byteLength,hashAlgorithm:'SHA-256',digest:digest(bytes)};
});
const resourceByPath=new Map(resources.map(resource=>[resource.path,resource]));
const indexText=fs.readFileSync(path.join(siteRoot,'index.html'),'utf8');
const scriptUrls=[...indexText.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
if(scriptUrls.length!==runtimeScripts.length||scriptUrls.some((url,index)=>url.split('?')[0]!==runtimeScripts[index]))throw new Error('The deployed runtime script graph is incomplete or out of order.');
const tokens=scriptUrls.map(url=>new URLSearchParams(url.split('?')[1]||'').get('v'));
if(tokens.some(token=>!token)||new Set(tokens).size!==1)throw new Error('The deployed runtime graph must use one shared build identity.');
const buildIdentity=tokens[0];
for(const [file,pattern] of [
  ['hash.js',/const BUILD_IDENTITY='([^']+)'/],
  ['workflow-schema.js',/const BUILD_IDENTITY='([^']+)'/],
  ['test-runtime.js',/const RUNTIME_BUILD_ID='([^']+)'/],
  ['app-core.js',/const RUNTIME_BUILD_ID='([^']+)'/]
]){
  const source=fs.readFileSync(path.join(siteRoot,file),'utf8'),declared=source.match(pattern)?.[1];
  if(declared!==buildIdentity)throw new Error(`${file} does not declare the shared build identity ${buildIdentity}.`);
}
const runtimeSource=fs.readFileSync(path.join(siteRoot,'test-runtime.js'),'utf8');
const declaredWorkerDigest=runtimeSource.match(/const TEST_WORKER_SHA256='([a-f0-9]{64})'/i)?.[1]?.toLowerCase();
const actualWorkerDigest=resourceByPath.get('test-worker.js')?.digest;
if(!declaredWorkerDigest||declaredWorkerDigest!==actualWorkerDigest)throw new Error('test-runtime.js is not bound to the exact deployed test-worker.js bytes.');
const csp=indexText.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)?.[1];
if(!csp)throw new Error('The exact Content Security Policy is missing.');

const workflowPath=path.join(sourceRoot,'.github/workflows/pages.yml');
if(!fs.existsSync(workflowPath))throw new Error('The release workflow is required for source-to-build provenance.');
const workflowText=fs.readFileSync(workflowPath,'utf8');
const actionIdentities=[...workflowText.matchAll(/^\s*-?\s*uses:\s*([^\s]+)\s*$/gm)].map(match=>match[1]);
if(!actionIdentities.length||actionIdentities.some(identity=>!/@[0-9a-f]{40}$/i.test(identity)))throw new Error('Every release-critical GitHub Action must be pinned by immutable commit SHA.');
const nodeSelections=[...workflowText.matchAll(/node-version:\s*['"]?([^'"\s]+)['"]?/g)].map(match=>match[1]);
if(!nodeSelections.length||nodeSelections.some(value=>!/^\d+\.\d+\.\d+$/.test(value))||new Set(nodeSelections).size!==1)throw new Error('Every release job must select the same exact Node.js version.');
const nodeSelection=nodeSelections[0];
const runnerSelections=[...workflowText.matchAll(/runs-on:\s*([^\s]+)/g)].map(match=>match[1]);
if(!runnerSelections.length||runnerSelections.some(value=>!/^ubuntu-\d+\.\d+$/.test(value))||new Set(runnerSelections).size!==1)throw new Error('Every runner family must be the same explicit version; mutable "latest" labels are prohibited.');
const runnerSelection=runnerSelections[0];
if(process.env.GITHUB_ACTIONS==='true'&&process.version.replace(/^v/,'')!==nodeSelection)throw new Error(`The observed Node.js ${process.version} does not match the exact selected version ${nodeSelection}.`);
const actionRecords=actionIdentities.map(identity=>{
  const [repository,commitSha]=identity.split('@');
  return {repository,commitSha,immutableCommitPin:true};
});
const dependencyFiles=['package.json','package-lock.json','npm-shrinkwrap.json','pnpm-lock.yaml','yarn.lock'].filter(file=>fs.existsSync(path.join(sourceRoot,file)));
const dependencyManifest={
  packageManager:dependencyFiles.some(file=>file!=='package.json')?'DECLARED_BY_LOCKFILE':dependencyFiles.length?'PACKAGE_MANIFEST_WITHOUT_LOCKFILE':'NONE',
  lockfiles:dependencyFiles.filter(file=>file!=='package.json').map(file=>({path:file,hashAlgorithm:'SHA-256',digest:digest(fs.readFileSync(path.join(sourceRoot,file)))})),
  packageManifests:dependencyFiles.filter(file=>file==='package.json').map(file=>({path:file,hashAlgorithm:'SHA-256',digest:digest(fs.readFileSync(path.join(sourceRoot,file)))})),
  runtimeThirdPartyPackages:[],
  status:dependencyFiles.some(file=>file!=='package.json')?'LOCKFILE_IDENTITIES_RECORDED':dependencyFiles.length?'UNLOCKED_PACKAGE_MANIFEST_RECORDED':'NO_PACKAGE_MANAGER_DEPENDENCIES'
};
const toolchainManifest={
  node:{selectedVersion:nodeSelection,selectedVersions:nodeSelections,observedVersion:process.version,observedMatchesSelection:process.version.replace(/^v/,'')===nodeSelection},
  runner:{selectedFamily:runnerSelection,selectedFamilies:runnerSelections,observedOS:process.env.RUNNER_OS||process.platform,observedImageOS:process.env.ImageOS||'UNAVAILABLE',observedImageVersion:process.env.ImageVersion||'UNAVAILABLE',immutability:'NOT_IMMUTABLY_PINNED'},
  browser:commandVersion(['google-chrome','chromium','chrome']),
  python:commandVersion(['python3','python']),
  git:commandVersion(['git']),
  copyTool:commandVersion(['cp']),
  architecture:process.arch,
  evidenceBasis:'APPLICATION_OBSERVED_DURING_BUILD'
};
const dependencyManifestIdentity=digest(Buffer.from(canonical(dependencyManifest),'utf8'));
const toolchainManifestIdentity=digest(Buffer.from(canonical(toolchainManifest),'utf8'));
const buildScriptPath=path.join(sourceRoot,'build-deployment-manifest.mjs');
const generatedInputRecords=[...deterministicGeneratedPaths].map(([generatedPath,details])=>({
  generatedPath,
  generatorPath:details.generatorPath,
  command:details.command,
  generatorHashAlgorithm:'SHA-256',
  generatorDigest:digest(fs.readFileSync(path.join(sourceRoot,details.generatorPath))),
  generatedDigest:digest(fs.readFileSync(path.join(sourceRoot,generatedPath))),
  status:'TRACKED_GENERATOR_AND_OUTPUT_MATCH_AUDITED_COMMIT'
}));
const workflowDigest=digest(fs.readFileSync(workflowPath));
const buildScriptDigest=digest(fs.readFileSync(buildScriptPath));
const buildCommand='node build-test-project.mjs; rm -rf <site>; mkdir <site>; cp index.html workbook.js hash.js workflow-schema.js test-runtime.js test-worker.js workflow-engine.js prompt-engine.js response-ingestion.js project-store.js app-core.js TEST_PROJECT.json .nojekyll <site>/; node build-deployment-manifest.mjs <site> <source-commit> <workflow-run-id>';
const manifest={
  schema:'closed-loop-deployment-manifest/1',
  sourceCommit,
  workflowRunIdentity,
  workflowRunAttempt:String(process.env.GITHUB_RUN_ATTEMPT||'UNAVAILABLE'),
  buildIdentity,
  canonicalizationVersion:hashAuthority.CANONICAL_JSON_VERSION,
  buildCommand,
  buildScript:{path:'build-deployment-manifest.mjs',hashAlgorithm:'SHA-256',digest:buildScriptDigest},
  buildEnvironmentIdentity:toolchainManifestIdentity,
  dependencyManifestIdentity,
  toolchainManifestIdentity,
  dependencyManifest,
  toolchainManifest,
  supplyChain:{
    githubActions:actionRecords,
    everyActionCommitPinned:true,
    nodeSelectionExact:true,
    runnerImagePinning:'OBSERVED_MUTABLE_PROVIDER_IMAGE',
    limitations:['GitHub-hosted runner images and the CI platform are not independently authenticated or immutably pinned by this application.']
  },
  workflow:{path:'.github/workflows/pages.yml',hashAlgorithm:'SHA-256',digest:workflowDigest},
  contentSecurityPolicy:csp,
  cspSha256:digest(Buffer.from(csp,'utf8')),
  serviceWorkerPolicy:'NO_CONTROLLING_SERVICE_WORKER',
  runtimeGraph:{scripts:scriptUrls,worker:`test-worker.js?v=${encodeURIComponent(buildIdentity)}`,workerSha256:actualWorkerDigest},
  resources,
  nonRuntimeStaticPaths:['.nojekyll','deployment-manifest.json'],
  sourceToBuildProvenance:{auditedSourceCommit:sourceCommit,observedCheckoutCommit,checkoutMatchesAuditedSourceCommit:observedCheckoutCommit===sourceCommit.toLowerCase(),allTrackedReleaseInputBytesMatchAuditedCommit:true,auditedSourceInputs,deterministicGeneratedInputs:generatedInputRecords,workflowDigest,buildScriptDigest,deployedArtifactMustComeFromVerifiedSiteArtifact:true,evidenceBasis:'APPLICATION_OBSERVED_EXACT_GIT_BLOB_AND_OUTPUT_BYTE_COMPARISON'},
  reproducibilityStatus:'PENDING_SECOND_CLEAN_BUILD_COMPARISON',
  deploymentManifestDigest:null
};
const manifestDigestInput={...manifest};
delete manifestDigestInput.deploymentManifestDigest;
manifest.deploymentManifestDigest=digest(Buffer.from(canonical(manifestDigestInput),'utf8'));
fs.writeFileSync(path.join(siteRoot,'deployment-manifest.json'),`${JSON.stringify(manifest,null,2)}\n`);
console.log(JSON.stringify({deploymentManifest:'PASS',resources:resources.length,buildIdentity:manifest.buildIdentity,workerSha256:actualWorkerDigest,toolchainManifestIdentity,dependencyManifestIdentity,runnerImagePinning:manifest.supplyChain.runnerImagePinning,digest:manifest.deploymentManifestDigest}));
