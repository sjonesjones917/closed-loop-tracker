import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import './hash.js';
import {
  BUILD_IDENTITY_PATH,
  BUILD_IDENTITY_DERIVATION_SCHEMA,
  BUILD_IDENTITY_PREFIX,
  BUILD_IDENTITY_SCHEMA,
  CANONICALIZATION_VERSION,
  DEPLOYMENT_CONTROL_PATHS,
  DEPLOYMENT_REBUILD_PERMITTED,
  DEPLOYMENT_RUNTIME_PATHS,
  DEPLOYMENT_SCHEMA,
  DEPLOYMENT_SOURCE_RUNTIME_PATHS,
  MAIN_RUNTIME_SCRIPT_PATHS,
  WORKER_DIGEST_PLACEHOLDER,
  WORKER_PROTOCOL_VERSION,
  mediaTypeFor
} from './deployment-contract.mjs';

const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
if(globalThis.closedLoopHash?.canonicalizationVersion!==CANONICALIZATION_VERSION)throw new Error('Deployment tooling is not using the registered canonical JSON authority.');
const canonical=value=>globalThis.closedLoopHash.stableStringify(value);
function git(sourceRoot,...args){
  try{return execFileSync('git',args,{cwd:sourceRoot,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}
  catch{return '';}
}
function workflowActions(workflowText){
  return [...workflowText.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)\s*$/gm)].map(match=>{
    const [action,revision='']=match[1].split('@');
    return {action,revision,pinnedToImmutableCommit:/^[a-f0-9]{40}$/i.test(revision)};
  });
}
function pretransformBuildIdentity(target){
  const resources=DEPLOYMENT_SOURCE_RUNTIME_PATHS.map(resourcePath=>{
    const bytes=fs.readFileSync(path.join(target,resourcePath));
    return {path:resourcePath,byteSize:bytes.length,hashAlgorithm:'SHA-256',digest:sha256(bytes)};
  });
  const input={
    schema:BUILD_IDENTITY_DERIVATION_SCHEMA,
    resources,
    transformations:['INJECT_CONTENT_DERIVED_RUNTIME_BUILD_ID/1','REPLACE_EXACT_DEPLOYMENT_WORKER_SHA256_PLACEHOLDER/1'],
    workerProtocolVersion:WORKER_PROTOCOL_VERSION
  };
  const digest=sha256(Buffer.from(canonical(input),'utf8'));
  return {input,digest,buildIdentity:`${BUILD_IDENTITY_PREFIX}${digest}`};
}
function replaceExact(text,needle,replacement,expectedCount,label){
  const count=text.split(needle).length-1;
  if(count!==expectedCount)throw new Error(`${label} must contain exactly ${expectedCount} controlled build-identity injection point${expectedCount===1?'':'s'}; found ${count}.`);
  return text.split(needle).join(replacement);
}
function injectRuntimeIdentities(target,sourceRoot){
  const workerPath=path.join(target,'test-worker.js');
  const runtimePath=path.join(target,'test-runtime.js');
  const appPath=path.join(target,'app-core.js');
  const indexPath=path.join(target,'index.html');
  const workerDigest=sha256(fs.readFileSync(workerPath));
  const derivation=pretransformBuildIdentity(target);
  const indexSource=fs.readFileSync(indexPath,'utf8');
  const sourceScripts=[...indexSource.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
  const sourceTokens=[...new Set(sourceScripts.map(value=>new URLSearchParams(value.split('?')[1]||'').get('v')))];
  if(sourceScripts.length!==MAIN_RUNTIME_SCRIPT_PATHS.length||sourceTokens.length!==1||!sourceTokens[0])throw new Error('Source HTML must provide one shared controlled build-identity seed for every runtime script.');
  const sourceBuildIdentity=sourceTokens[0];
  const runtimeSource=fs.readFileSync(runtimePath,'utf8');
  const appSource=fs.readFileSync(appPath,'utf8');
  const indexOutput=replaceExact(indexSource,sourceBuildIdentity,derivation.buildIdentity,MAIN_RUNTIME_SCRIPT_PATHS.length,'index.html');
  const appOutput=replaceExact(appSource,sourceBuildIdentity,derivation.buildIdentity,1,'app-core.js');
  const runtimeWithBuild=replaceExact(runtimeSource,sourceBuildIdentity,derivation.buildIdentity,1,'test-runtime.js');
  const workerOccurrences=runtimeWithBuild.split(WORKER_DIGEST_PLACEHOLDER).length-1;
  if(workerOccurrences!==1)throw new Error(`test-runtime.js must contain exactly one build-time worker digest placeholder; found ${workerOccurrences}.`);
  const runtimeOutput=runtimeWithBuild.replace(WORKER_DIGEST_PLACEHOLDER,workerDigest);
  fs.writeFileSync(indexPath,indexOutput);
  fs.writeFileSync(appPath,appOutput);
  fs.writeFileSync(runtimePath,runtimeOutput);
  const common={sourceBuildIdentity,injectedBuildIdentity:derivation.buildIdentity};
  return {
    buildIdentity:derivation.buildIdentity,
    derivation:{...derivation.input,hashAlgorithm:'SHA-256',digest:derivation.digest,buildIdentity:derivation.buildIdentity},
    workerDigest,
    generatedResources:[
      {path:'test-runtime.js',sourcePath:'test-runtime.js',transformation:'INJECT_RUNTIME_BUILD_AND_WORKER_IDENTITIES/1',sourceSha256:sha256(fs.readFileSync(path.join(sourceRoot,'test-runtime.js'))),...common,injectedTestWorkerSha256:workerDigest,outputSha256:sha256(Buffer.from(runtimeOutput,'utf8'))},
      {path:'index.html',sourcePath:'index.html',transformation:'INJECT_CONTENT_DERIVED_RUNTIME_BUILD_ID/1',sourceSha256:sha256(fs.readFileSync(path.join(sourceRoot,'index.html'))),...common,outputSha256:sha256(Buffer.from(indexOutput,'utf8'))},
      {path:'app-core.js',sourcePath:'app-core.js',transformation:'INJECT_CONTENT_DERIVED_RUNTIME_BUILD_ID/1',sourceSha256:sha256(fs.readFileSync(path.join(sourceRoot,'app-core.js'))),...common,outputSha256:sha256(Buffer.from(appOutput,'utf8'))}
    ]
  };
}

export function buildDeploymentManifest(targetInput,options={}){
  const sourceRoot=path.resolve(options.sourceRoot||path.dirname(fileURLToPath(import.meta.url)));
  const target=path.resolve(targetInput);
  const output=path.join(target,'deployment-manifest.json');
  if(target===sourceRoot)throw new Error('Deployment manifest generation must target an assembled site, not mutate source files.');
  for(const file of [...DEPLOYMENT_SOURCE_RUNTIME_PATHS,...DEPLOYMENT_CONTROL_PATHS])if(!fs.existsSync(path.join(target,file)))throw new Error(`Required deployment resource is missing: ${file}`);

  const injected=injectRuntimeIdentities(target,sourceRoot);
  const index=fs.readFileSync(path.join(target,'index.html'),'utf8');
  const scripts=[...index.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
  const scriptPaths=scripts.map(value=>value.split('?')[0]);
  if(JSON.stringify(scriptPaths)!==JSON.stringify(MAIN_RUNTIME_SCRIPT_PATHS))throw new Error('The HTML runtime script graph does not match the deployment contract.');
  const buildTokens=scripts.map(value=>new URLSearchParams(value.split('?')[1]||'').get('v'));
  if(buildTokens.some(token=>!token)||new Set(buildTokens).size!==1||buildTokens[0]!==injected.buildIdentity)throw new Error('The runtime graph does not have the exact content-derived shared build identity.');
  const csp=index.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)?.[1];
  if(!csp)throw new Error('The exact Content-Security-Policy was not found.');

  const workflowPath=path.resolve(sourceRoot,'.github/workflows/pages.yml');
  const workflowBytes=fs.readFileSync(workflowPath);
  const workflowText=workflowBytes.toString('utf8');
  const actions=workflowActions(workflowText);
  const sourceCommit=process.env.GITHUB_SHA||git(sourceRoot,'rev-parse','HEAD')||'UNKNOWN';
  const workflowRunIdentity=process.env.GITHUB_RUN_ID||'LOCAL_UNVERIFIED';
  const buildIdentityRecord={
    schema:BUILD_IDENTITY_SCHEMA,
    buildIdentity:buildTokens[0],
    testWorkerSha256:injected.workerDigest,
    workerProtocolVersion:WORKER_PROTOCOL_VERSION,
    sourceCommit,
    workflowRunIdentity,
    hashAlgorithm:'SHA-256'
  };
  const buildIdentityBytes=Buffer.from(JSON.stringify(buildIdentityRecord,null,2)+'\n','utf8');
  fs.writeFileSync(path.join(target,BUILD_IDENTITY_PATH),buildIdentityBytes);
  const generatedBuildIdentity={
    path:BUILD_IDENTITY_PATH,
    transformation:'GENERATE_CLOSED_LOOP_BUILD_IDENTITY/1',
    inputBuildIdentity:buildTokens[0],
    inputTestWorkerSha256:injected.workerDigest,
    inputSourceCommit:sourceCommit,
    inputWorkflowRunIdentity:workflowRunIdentity,
    outputSha256:sha256(buildIdentityBytes)
  };
  for(const file of DEPLOYMENT_RUNTIME_PATHS)if(!fs.existsSync(path.join(target,file)))throw new Error(`Generated deployment resource is missing: ${file}`);
  const resources=DEPLOYMENT_RUNTIME_PATHS.map(runtimePath=>{
    const bytes=fs.readFileSync(path.join(target,runtimePath));
    return {path:runtimePath,mediaType:mediaTypeFor(runtimePath),byteSize:bytes.length,hashAlgorithm:'SHA-256',digest:sha256(bytes),buildIdentity:buildTokens[0]};
  });
  const reproducibilityStatus=process.env.CLOSED_LOOP_REPRODUCIBILITY_STATUS||'NOT_EVALUATED_IN_THIS_MANIFEST';
  if(!['NOT_EVALUATED_IN_THIS_MANIFEST','CHECKED_BY_SECOND_CLEAN_MANIFEST_BUILD'].includes(reproducibilityStatus))throw new Error(`Unsupported reproducibility status: ${reproducibilityStatus}`);
  const manifest={
    schema:DEPLOYMENT_SCHEMA,
    sourceCommit,
    sourceRepository:process.env.GITHUB_REPOSITORY||'sjonesjones917/closed-loop-tracker',
    workflowRunIdentity,
    workflowRunAttempt:process.env.GITHUB_RUN_ATTEMPT||'LOCAL_UNVERIFIED',
    workflowIdentity:'mobile-closed-loop/30',
    buildIdentity:buildTokens[0],
    buildIdentityDerivation:injected.derivation,
    canonicalizationVersion:CANONICALIZATION_VERSION,
    runtimeResources:resources,
    rootEvidenceResource:{path:'deployment-manifest.json',role:'SELF_DESCRIBING_DEPLOYMENT_ROOT',verificationRule:'COMPARE_EXACT_LOCAL_AND_DEPLOYED_BYTES_AND_RECOMPUTE_OVERALL_MANIFEST_DIGEST'},
    excludedNonRuntimeStaticPaths:[
      {path:'.nojekyll',reason:'GitHub Pages control marker; it is deployed but is neither loaded nor executed by the application.'}
    ],
    deterministicGeneratedResources:[...injected.generatedResources,generatedBuildIdentity],
    csp:{exactValue:csp,hashAlgorithm:'SHA-256',digest:sha256(Buffer.from(csp,'utf8'))},
    dependencyAndToolchainManifest:{
      nodeRuntime:process.version,
      platform:process.platform,
      architecture:process.arch,
      workflowPath:'.github/workflows/pages.yml',
      workflowSha256:sha256(workflowBytes),
      githubActions:actions,
      allGithubActionsPinnedToImmutableCommits:actions.length>0&&actions.every(action=>action.pinnedToImmutableCommit),
      packageManagerStatus:'NO_PACKAGE_MANAGER_OR_THIRD_PARTY_RUNTIME_DEPENDENCIES'
    },
    buildCommand:`CLOSED_LOOP_REPRODUCIBILITY_STATUS=${reproducibilityStatus} node build-static-site.mjs $ISOLATED_DEPLOYMENT_TARGET`,
    buildTargetAlias:'$ISOLATED_DEPLOYMENT_TARGET',
    buildEnvironmentIdentity:{
      ci:process.env.CI==='true'?'GITHUB_ACTIONS':'LOCAL',
      runnerLabel:process.env.CI==='true'?'ubuntu-latest':'LOCAL_UNVERIFIED',
      runnerOs:process.env.RUNNER_OS||process.platform,
      runnerArchitecture:process.env.RUNNER_ARCH||process.arch,
      runnerImageOs:process.env.ImageOS||'UNREPORTED',
      runnerImageVersion:process.env.ImageVersion||'UNREPORTED',
      node:process.version,
      supplyChainLimitations:['HOSTED_RUNNER_PLATFORM_COMPROMISE_NOT_RULED_OUT','FLOATING_HOSTED_RUNNER_LABEL_WITH_EXACT_OBSERVED_IMAGE_RECORDED_WHEN_AVAILABLE']
    },
    artifactProvenance:{
      producerJob:'test',
      verifiedSiteRoot:'_site',
      pagesArtifactName:'github-pages',
      retainedVerificationArtifactName:`closed-loop-verified-site-${sourceCommit}-${workflowRunIdentity}`,
      retainedArchivePath:'closed-loop-verified-site.tar',
      retainedArchiveDigestPath:'closed-loop-verified-site.tar.sha256',
      deploymentConsumerJob:'deploy',
      verificationConsumerJobs:['verify-live','publish-status'],
      deploymentRebuildPermitted:DEPLOYMENT_REBUILD_PERMITTED,
      sourceCommit,
      sourceWorkflowSha256:sha256(workflowBytes)
    },
    reproducibilityStatus,
    reproducibilityEvidence:reproducibilityStatus==='CHECKED_BY_SECOND_CLEAN_MANIFEST_BUILD'?{cleanBuildCount:2,comparison:'RECURSIVE_EXACT_BYTE_COMPARISON',sameInputsRequired:true}:null,
    overallManifestDigest:''
  };
  const digestInput={...manifest};delete digestInput.overallManifestDigest;
  manifest.overallManifestDigest=sha256(Buffer.from(canonical(digestInput),'utf8'));
  fs.writeFileSync(output,JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}

const invokedPath=process.argv[1]&&path.resolve(process.argv[1]);
if(invokedPath===fileURLToPath(import.meta.url)){
  const target=process.argv[2];
  if(!target)throw new Error('Usage: node build-deployment-manifest.mjs <assembled-site-directory>');
  const manifest=buildDeploymentManifest(target);
  console.log(JSON.stringify({schema:manifest.schema,sourceCommit:manifest.sourceCommit,buildIdentity:manifest.buildIdentity,runtimeResources:manifest.runtimeResources.length,reproducibilityStatus:manifest.reproducibilityStatus,overallManifestDigest:manifest.overallManifestDigest,output:path.join(path.resolve(target),'deployment-manifest.json')},null,2));
}
