import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/pages.yml','utf8');
const assert=(value,message)=>{if(!value)throw new Error(message);};
function job(id){
  const marker=`\n  ${id}:\n`,start=workflow.indexOf(marker);
  assert(start>=0,`Missing ${id} job.`);
  const bodyStart=start+marker.length,next=workflow.slice(bodyStart).search(/\n  [a-zA-Z][a-zA-Z0-9-]*:\n/);
  return next<0?workflow.slice(bodyStart):workflow.slice(bodyStart,bodyStart+next);
}

for(const match of workflow.matchAll(/^\s*-?\s*uses:\s*([^@\s]+)@([^\s]+)\s*$/gm)){
  assert(/^[a-f0-9]{40}$/.test(match[2]),`Workflow action is not pinned to an immutable commit: ${match[1]}@${match[2]}`);
}

const test=job('test'),deploy=job('deploy'),live=job('verify-live');
const artifactName='closed-loop-site-${{ github.sha }}';
for(const token of ['node verify-single-runtime-authority.mjs','node build-deployment-manifest.mjs _site','node verify-deployment-manifest.mjs _site','diff -r --no-dereference _site _site-rebuild','python3 -m http.server 4173 --directory _site','actions/upload-artifact@',`name: ${artifactName}`])assert(test.includes(token),`Test job lacks exact build-artifact control: ${token}`);
for(const token of ['actions/download-artifact@',`name: ${artifactName}`,'path: _site','actions/upload-pages-artifact@','actions/deploy-pages@'])assert(deploy.includes(token),`Deploy job lacks exact artifact handoff: ${token}`);
assert(deploy.indexOf('actions/download-artifact@')<deploy.indexOf('actions/upload-pages-artifact@'),'Deploy job does not download the verified artifact before creating the Pages artifact.');
for(const forbidden of ['actions/checkout@','actions/setup-node@','build-test-project.mjs','build-deployment-manifest.mjs','cp index.html','Rebuild'])assert(!deploy.includes(forbidden),`Deploy job rebuilds or substitutes verified bytes: ${forbidden}`);
for(const token of ['actions/download-artifact@',`name: ${artifactName}`,'node verify-deployment-manifest.mjs _site','node verify-live.mjs','run_browser_verifier verify-browser-extra.mjs'])assert(live.includes(token),`Live verification job lacks exact artifact evidence: ${token}`);
for(const forbidden of ['build-test-project.mjs','build-deployment-manifest.mjs','cp index.html','Rebuild'])assert(!live.includes(forbidden),`Live verification reconstructs expected bytes instead of using the verified artifact: ${forbidden}`);

const builder=fs.readFileSync('build-deployment-manifest.mjs','utf8'),manifestVerifier=fs.readFileSync('verify-deployment-manifest.mjs','utf8'),liveVerifier=fs.readFileSync('verify-live.mjs','utf8'),browserVerifier=fs.readFileSync('verify-browser-extra.mjs','utf8');
for(const source of [builder,manifestVerifier]){
  assert(source.includes("vm.runInContext")&&source.includes("closedLoopHash")&&source.includes("sha256Value"),'Deployment manifest digest does not use the shared hash.js canonicalizer.');
  assert(!/const\s+canonical\s*=/.test(source),'Deployment tooling defines a second canonical serializer.');
}
for(const token of ['remoteManifestBytes.equals(localManifestBytes)','deploymentManifest.runtimeResources','remote.equals(local)','workflowRunIdentity'])assert(liveVerifier.includes(token),`Live byte verification lacks ${token}.`);
for(const token of ['Network.clearBrowserCache','Storage.clearDataForOrigin','Page.reload','ignoreCache:false','navigator.serviceWorker?.controller','getRegistrations','Debugger.getScriptSource','runtimeWorkerDigest','workerHandshake'])assert(browserVerifier.includes(token),`Executed-build browser proof lacks ${token}.`);
assert(manifestVerifier.includes('TEST_WORKER_SHA256')&&manifestVerifier.includes('worker.digest'),'Deployment manifest does not bind the runtime to exact worker bytes.');

console.log(JSON.stringify({deploymentPipelineVerification:'PASS',exactArtifactHandoff:true,rebuildInDeploy:false,rebuildInLiveVerification:false,pinnedActions:true,sharedCanonicalizer:true,cleanAndWarmBrowserProof:true}));
