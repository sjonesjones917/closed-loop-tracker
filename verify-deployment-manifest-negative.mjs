import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import './hash.js';
import {BUILD_IDENTITY_PATH,DEPLOYMENT_CONTROL_PATHS,DEPLOYMENT_RUNTIME_PATHS,DEPLOYMENT_SOURCE_RUNTIME_PATHS,WORKER_DIGEST_PLACEHOLDER} from './deployment-contract.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const temporaryParent=fs.existsSync(os.tmpdir())?os.tmpdir():path.dirname(root);
const tempRoot=fs.mkdtempSync(path.join(temporaryParent,'closed-loop-deployment-negative-'));
const sourceSnapshot=path.join(tempRoot,'source');
fs.mkdirSync(path.join(sourceSnapshot,'.github/workflows'),{recursive:true});
for(const file of [...DEPLOYMENT_SOURCE_RUNTIME_PATHS,...DEPLOYMENT_CONTROL_PATHS,'build-static-site.mjs','build-deployment-manifest.mjs','deployment-contract.mjs','verify-deployment-manifest.mjs']){
  fs.copyFileSync(path.join(root,file),path.join(sourceSnapshot,file));
}
fs.copyFileSync(path.join(root,'.github/workflows/pages.yml'),path.join(sourceSnapshot,'.github/workflows/pages.yml'));
const buildScript=path.join(sourceSnapshot,'build-static-site.mjs');
const verifyScript=path.join(sourceSnapshot,'verify-deployment-manifest.mjs');
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const canonical=value=>globalThis.closedLoopHash.stableStringify(value);
function rewriteManifest(target,mutate){const file=path.join(target,'deployment-manifest.json'),manifest=JSON.parse(fs.readFileSync(file,'utf8'));mutate(manifest);delete manifest.overallManifestDigest;manifest.overallManifestDigest=sha256(Buffer.from(canonical(manifest),'utf8'));fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');}
const environment={...process.env,GITHUB_SHA:'1'.repeat(40),GITHUB_RUN_ID:'DEPLOYMENT-MUTATION-PROOF',GITHUB_RUN_ATTEMPT:'1',GITHUB_REPOSITORY:'sjonesjones917/closed-loop-tracker',CI:'true',RUNNER_OS:'Linux'};
const build=target=>execFileSync(process.execPath,[buildScript,target],{cwd:root,encoding:'utf8',env:environment});
const verify=target=>spawnSync(process.execPath,[verifyScript,path.join(target,'deployment-manifest.json')],{cwd:root,encoding:'utf8',env:environment});
function fixture(name){const target=path.join(tempRoot,name);build(target);const result=verify(target);assert.equal(result.status,0,result.stderr||result.stdout);return target;}
function rejected(name,mutate){const target=fixture(name);mutate(target);const result=verify(target);assert.notEqual(result.status,0,`${name}: deployment mutation was accepted.`);return true;}

try{
  const left=fixture('repro-a'),right=fixture('repro-b');
  assert.equal(fs.readFileSync(path.join(left,'deployment-manifest.json'),'utf8'),fs.readFileSync(path.join(right,'deployment-manifest.json'),'utf8'),'Second clean build did not reproduce the deployment manifest.');
  const changedSource=path.join(tempRoot,'changed-source');
  fs.cpSync(sourceSnapshot,changedSource,{recursive:true});
  fs.appendFileSync(path.join(changedSource,'workbook.js'),'\n/* deployment identity mutation fixture */\n');
  const changedTarget=path.join(tempRoot,'changed-source-target');
  execFileSync(process.execPath,[path.join(changedSource,'build-static-site.mjs'),changedTarget],{cwd:changedSource,encoding:'utf8',env:environment});
  const originalBuildIdentity=JSON.parse(fs.readFileSync(path.join(left,'deployment-manifest.json'),'utf8')).buildIdentity;
  const changedBuildIdentity=JSON.parse(fs.readFileSync(path.join(changedTarget,'deployment-manifest.json'),'utf8')).buildIdentity;
  assert.notEqual(changedBuildIdentity,originalBuildIdentity,'Changed source runtime bytes reused the prior build/cache identity.');
  const mutations={
    changedWorker:rejected('changed-worker',target=>fs.appendFileSync(path.join(target,'test-worker.js'),'\n/* changed after manifest */\n')),
    mixedBuildIdentity:rejected('mixed-build',target=>{const file=path.join(target,'index.html'),text=fs.readFileSync(file,'utf8');fs.writeFileSync(file,text.replace(/(app-core\.js\?v=)[^"&]+/,'$1stale-build'));}),
    unmanifestedRuntime:rejected('unmanifested-runtime',target=>fs.writeFileSync(path.join(target,'unmanifested-runtime.js'),'globalThis.unmanifested=true;\n')),
    unmanifestedServiceWorker:rejected('service-worker',target=>fs.writeFileSync(path.join(target,'service-worker.js'),'self.addEventListener("fetch",()=>{});\n')),
    missingRuntime:rejected('missing-runtime',target=>fs.unlinkSync(path.join(target,'prompt-engine.js'))),
    missingBuildIdentity:rejected('missing-build-identity',target=>fs.unlinkSync(path.join(target,BUILD_IDENTITY_PATH))),
    forgedResourceDigest:rejected('resource-digest',target=>rewriteManifest(target,manifest=>{manifest.runtimeResources.find(item=>item.path==='app-core.js').digest='0'.repeat(64);})),
    omittedResource:rejected('omitted-resource',target=>rewriteManifest(target,manifest=>{manifest.runtimeResources=manifest.runtimeResources.filter(item=>item.path!=='test-worker.js');})),
    floatingAction:rejected('floating-action',target=>rewriteManifest(target,manifest=>{manifest.dependencyAndToolchainManifest.githubActions[0].revision='main';manifest.dependencyAndToolchainManifest.githubActions[0].pinnedToImmutableCommit=false;manifest.dependencyAndToolchainManifest.allGithubActionsPinnedToImmutableCommits=false;})),
    deploymentRebuildPermitted:rejected('deployment-rebuild-permitted',target=>rewriteManifest(target,manifest=>{manifest.artifactProvenance.deploymentRebuildPermitted=true;})),
    forgedArtifactHandoff:rejected('forged-artifact-handoff',target=>rewriteManifest(target,manifest=>{manifest.artifactProvenance.retainedVerificationArtifactName='different-artifact';})),
    forgedBuildIdentityDerivation:rejected('build-identity-derivation',target=>rewriteManifest(target,manifest=>{manifest.buildIdentityDerivation.digest='f'.repeat(64);})),
    forgedGeneratedProvenance:rejected('generated-provenance',target=>rewriteManifest(target,manifest=>{manifest.deterministicGeneratedResources[0].injectedTestWorkerSha256='f'.repeat(64);})),
    staleBuildIdentity:rejected('stale-build-identity',target=>{const identityPath=path.join(target,BUILD_IDENTITY_PATH),identity=JSON.parse(fs.readFileSync(identityPath,'utf8'));identity.buildIdentity='stale-build';const bytes=Buffer.from(JSON.stringify(identity,null,2)+'\n','utf8');fs.writeFileSync(identityPath,bytes);rewriteManifest(target,manifest=>{const digest=sha256(bytes),resource=manifest.runtimeResources.find(item=>item.path===BUILD_IDENTITY_PATH),generated=manifest.deterministicGeneratedResources.find(item=>item.path===BUILD_IDENTITY_PATH);resource.digest=digest;resource.byteSize=bytes.length;generated.outputSha256=digest;});}),
    unresolvedWorkerPlaceholder:rejected('worker-placeholder',target=>{const runtimePath=path.join(target,'test-runtime.js'),manifest=JSON.parse(fs.readFileSync(path.join(target,'deployment-manifest.json'),'utf8')),workerDigest=manifest.runtimeResources.find(item=>item.path==='test-worker.js').digest,text=fs.readFileSync(runtimePath,'utf8').replace(workerDigest,WORKER_DIGEST_PLACEHOLDER);fs.writeFileSync(runtimePath,text);rewriteManifest(target,current=>{const digest=sha256(Buffer.from(text,'utf8'));current.runtimeResources.find(item=>item.path==='test-runtime.js').digest=digest;current.runtimeResources.find(item=>item.path==='test-runtime.js').byteSize=Buffer.byteLength(text);current.deterministicGeneratedResources[0].outputSha256=digest;});}),
    changedCsp:rejected('changed-csp',target=>{const file=path.join(target,'index.html'),text=fs.readFileSync(file,'utf8');fs.writeFileSync(file,text.replace("worker-src 'self'","worker-src 'none'"));}),
    modifiedManifestDigest:rejected('manifest-digest',target=>{const file=path.join(target,'deployment-manifest.json'),manifest=JSON.parse(fs.readFileSync(file,'utf8'));manifest.overallManifestDigest='f'.repeat(64);fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');})
  };
  console.log(JSON.stringify({deploymentManifestMutationProof:'PASS',reproducibleBuild:true,contentChangeChangesBuildIdentity:true,runtimeResources:DEPLOYMENT_RUNTIME_PATHS.length,controlPaths:DEPLOYMENT_CONTROL_PATHS.length,mutationsDetected:Object.keys(mutations).length,...mutations},null,2));
}finally{
  fs.rmSync(tempRoot,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
