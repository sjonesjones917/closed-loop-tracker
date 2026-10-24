import {checkedVerifier,runVerifier,assertDetectedFault} from './verify-conformance-regressions.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import {runtimePaths,manifestName,foundationProofSteps,workflowGateProofSteps,fullTestSteps,digest,validateSite,assertLifecycleWorkflowCommand,assertPassedRun,assertReceipt,assertPassedDeploymentRun,assertDeployedReceipt,promoteSite,promoteExecutedProofs,executedProofFileHashes,sealSite} from './verified-site.mjs';
import {verificationCatalog} from './verification-evidence-catalog.mjs';

const root=process.cwd(),temporary=fs.mkdtempSync(path.join(root,'.verify-artifact-'));
const cases=[];
let completed=false;
async function rejects(name,operation,expected){await assert.rejects(async()=>await operation(),expected);cases.push(name);}
const cataloguedOwners=new Set(Object.keys(verificationCatalog));
const verifierSources=Object.fromEntries(fs.readdirSync(root).filter(file=>/^verify-[\w-]+\.mjs$/.test(file)).map(file=>[file,fs.readFileSync(path.join(root,file),'utf8')]));
function assertNoNestedCataloguedOwners(sources){
  const nested=[];
  for(const [file,source] of Object.entries(sources))for(const match of source.matchAll(/(?:^|\n)\s*import\s*['"]\.\/(verify-[\w-]+\.mjs)['"]|(?:^|\n)\s*await\s+import\(\s*['"]\.\/(verify-[\w-]+\.mjs)['"]\s*\)/g)){
    const owner=match[1]||match[2];if(cataloguedOwners.has(owner))nested.push({file,owner});
  }
  assert.deepEqual(nested,[],'CATALOG_OWNER_NESTING_ORACLE: a verifier side-effect import executes a separately catalogued owner without its own receipt.');
}
const repository='test-owner/test-repo',headSha='a'.repeat(40),workflowId=42;
const run={id:123,run_attempt:1,event:'pull_request',status:'completed',conclusion:'success',repository:{full_name:repository},head_repository:{full_name:repository},head_sha:headSha,workflow_id:workflowId,path:'.github/workflows/pages.yml'};
const jobs=[{name:'test',status:'completed',conclusion:'success',steps:fullTestSteps.map(name=>({name,status:'completed',conclusion:'success'}))},{name:'deferred-matrix',status:'completed',conclusion:'success',steps:['Execute complete deferred stage matrix','Preserve complete deferred matrix receipt'].map(name=>({name,status:'completed',conclusion:'success'}))}];
for(const group of ['core','creation','counterpart'])jobs.push({name:'conformance-'+group,status:'completed',conclusion:'success',steps:['Validate current authority receipts','Execute complete conformance group','Preserve complete conformance group report','Preserve conformance execution receipts'].map(name=>({name,status:'completed',conclusion:'success'}))});
for(const [name,steps]of [['foundation',foundationProofSteps],['workflow-gates',workflowGateProofSteps]])jobs.push({name,status:'completed',conclusion:'success',steps:steps.map(name=>({name,status:'completed',conclusion:'success'}))});
const bindings={repository,headSha,workflowId};
const clone=value=>structuredClone(value);
try{
  assertNoNestedCataloguedOwners(verifierSources);cases.push('catalogued-owners-not-nested');
  await rejects('nested-full-cycle-owner',()=>assertNoNestedCataloguedOwners({...verifierSources,'verify-corrected-iteration.mjs':verifierSources['verify-corrected-iteration.mjs']+"\nawait import('./verify-full-cycle.mjs');\n"}),/CATALOG_OWNER_NESTING_ORACLE/);
  assertPassedRun(run,jobs,bindings);cases.push('complete-passing-PR');
  for(const [name,change] of [
    ['incomplete-run',v=>{v.status='in_progress';v.conclusion=null;}],
    ['failed-run',v=>{v.conclusion='failure';}],
    ['cancelled-run',v=>{v.conclusion='cancelled';}],
    ['non-PR-run',v=>{v.event='push';}],
    ['wrong-head',v=>{v.head_sha='b'.repeat(40);}],
    ['wrong-repository',v=>{v.repository.full_name='someone/else';}],
    ['fork-run',v=>{v.head_repository.full_name='someone/else';}],
    ['wrong-workflow',v=>{v.workflow_id=999;}]
  ]){const altered=clone(run);change(altered);(await rejects(name,()=>assertPassedRun(altered,jobs,bindings),/verification|workflow/));}
  for(const conclusion of ['failure','skipped',null]){
    const altered=clone(jobs);altered[0].steps[3].conclusion=conclusion;
    (await rejects(`unpassed-required-step-${conclusion}`,()=>assertPassedRun(run,altered,bindings),/did not pass/));
  }
  (await rejects('missing-required-step',()=>assertPassedRun(run,[{...jobs[0],steps:jobs[0].steps.slice(1)},...jobs.slice(1)],bindings),/did not pass/));
  (await rejects('duplicate-test-job',()=>assertPassedRun(run,[...jobs,...jobs],bindings),/Required test job/));
  for(const group of ['core','creation','counterpart']){
    const name='conformance-'+group;
    await rejects('missing-'+name,()=>assertPassedRun(run,jobs.filter(job=>job.name!==name),bindings),/Required conformance group job/);
    for(const conclusion of ['failure','cancelled','skipped']){const altered=clone(jobs);altered.find(job=>job.name===name).conclusion=conclusion;await rejects('unpassed-'+name+'-'+conclusion,()=>assertPassedRun(run,altered,bindings),/Required conformance group job/);}
    for(const step of ['Validate current authority receipts','Execute complete conformance group','Preserve complete conformance group report','Preserve conformance execution receipts']){const altered=clone(jobs);altered.find(job=>job.name===name).steps=altered.find(job=>job.name===name).steps.filter(row=>row.name!==step);await rejects('missing-'+name+'-'+step,()=>assertPassedRun(run,altered,bindings),/Required conformance group execution or artifact/);}
  }
  (await rejects('missing-deferred-matrix-job',()=>assertPassedRun(run,[jobs[0]],bindings),/Required deferred matrix job/));
  for(const conclusion of ['failure','skipped',null]){
    const altered=clone(jobs);altered[1].conclusion=conclusion;
    (await rejects(`unpassed-deferred-matrix-${conclusion}`,()=>assertPassedRun(run,altered,bindings),/Required deferred matrix job/));
  }
  (await rejects('missing-deferred-matrix-step',()=>assertPassedRun(run,[jobs[0],{...jobs[1],steps:[]}],bindings),/Required complete deferred matrix/));
  (await rejects('missing-deferred-matrix-upload',()=>assertPassedRun(run,[jobs[0],{...jobs[1],steps:jobs[1].steps.slice(0,1)}],bindings),/Required complete deferred matrix/));

  for(const [name,requiredSteps]of [['foundation',foundationProofSteps],['workflow-gates',workflowGateProofSteps]]){
    await rejects('missing-'+name+'-job',()=>assertPassedRun(run,jobs.filter(job=>job.name!==name),bindings),new RegExp('Required '+name+' proof job'));
    for(const conclusion of ['failure','cancelled','skipped']){const altered=clone(jobs);altered.find(job=>job.name===name).conclusion=conclusion;await rejects('unpassed-'+name+'-'+conclusion,()=>assertPassedRun(run,altered,bindings),new RegExp('Required '+name+' proof job'));}
    for(const step of requiredSteps){const altered=clone(jobs);altered.find(job=>job.name===name).steps=altered.find(job=>job.name===name).steps.filter(row=>row.name!==step);await rejects('missing-'+name+'-'+step,()=>assertPassedRun(run,altered,bindings),new RegExp('Required '+name+' proof did not pass'));}
  }
  // Synthetic authenticated-bundle boundary controls. Runtime changes must
  // require fresh execution without copying even an earlier compatible proof.
  const proofSource=path.join(temporary,'synthetic-proofs'),proofTarget=path.join(temporary,'promoted-proofs');
  fs.mkdirSync(proofSource);
  const fingerprint={sourceInputsSha256:'a'.repeat(64),runtime:{node:process.version,platform:process.platform,architecture:process.arch}};
  const proofNames=['verify-synthetic-first.mjs.json','verify-synthetic-last.mjs.json'];
  const originals=proofNames.map((name,index)=>({synthetic:true,index,fingerprint:clone(fingerprint),receiptSha256:'original-synthetic-digest'}));
  const writeProofs=proofs=>proofs.forEach((proof,index)=>fs.writeFileSync(path.join(proofSource,proofNames[index]),JSON.stringify(proof)));
  const promotion={sourceCommit:'b'.repeat(40),verifiedSourceCommit:'c'.repeat(40)};
  const promoteProofs=proofFiles=>promoteExecutedProofs({sourceDirectory:proofSource,directory:proofTarget,proofFiles:proofFiles||executedProofFileHashes(proofSource),fingerprint,promotion});
  writeProofs(originals);
  assert.equal(promoteProofs(),true);
  for(const [index,name]of proofNames.entries()){
    const promoted=JSON.parse(fs.readFileSync(path.join(proofTarget,name),'utf8')),{receiptSha256,...unsigned}=promoted;
    assert.deepEqual(promoted.fingerprint,originals[index].fingerprint,'Promotion must preserve the original executed runtime.');
    assert.deepEqual(promoted.promotion,promotion);assert.equal(receiptSha256,digest(JSON.stringify(unsigned)));
  }
  fs.rmSync(proofTarget,{recursive:true});
  for(const field of ['node','platform','architecture']){
    const changed=clone(originals);changed[1].fingerprint.runtime[field]='different-runtime';writeProofs(changed);
    assert.equal(promoteProofs(),false,'Runtime drift must request a complete fresh run.');
    assert.equal(fs.existsSync(proofTarget),false,'A later incompatible proof must not leave partially promoted receipts.');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(proofSource,proofNames[1]),'utf8')),changed[1]);
    cases.push('changed-proof-'+field+'-requires-full-verification-before-copying');
  }
  const wrongSource=clone(originals);wrongSource[1].fingerprint.sourceInputsSha256='d'.repeat(64);writeProofs(wrongSource);
  await rejects('changed-proof-source-still-rejected',()=>promoteProofs(),/source inputs changed/);
  assert.equal(fs.existsSync(proofTarget),false);
  writeProofs(originals);const sealedProofFiles=executedProofFileHashes(proofSource);
  fs.appendFileSync(path.join(proofSource,proofNames[1]),' ');
  await rejects('changed-proof-bytes-still-rejected',()=>promoteProofs(sealedProofFiles),/file universe or bytes differs/);
  assert.equal(fs.existsSync(proofTarget),false);
  writeProofs(originals);fs.writeFileSync(path.join(proofSource,'unexpected.json'),'{}');
  await rejects('extra-proof-file-still-rejected',()=>promoteProofs(sealedProofFiles),/file universe or bytes differs/);
  assert.equal(fs.existsSync(proofTarget),false);

  const workspace=path.join(temporary,'workspace');fs.mkdirSync(path.join(workspace,'.github/workflows'),{recursive:true});
  for(const name of [...runtimePaths,'build-static-site.mjs','deployment-contract-identities.mjs','verifier-runtime.mjs','.github/workflows/pages.yml'])fs.copyFileSync(path.join(root,name),path.join(workspace,name));
  const git=(...args)=>execFileSync('git',args,{timeout:30000,killSignal:'SIGKILL',cwd:workspace,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git('init','-q');git('add','.');git('-c','user.name=Verification fixture','-c','user.email=fixture@example.invalid','commit','-qm','Tested source');
  const testedCommit=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}');
  const site=path.join(temporary,'site'),bundle=path.join(temporary,'bundle');
  (await checkedVerifier(process.execPath,['build-static-site.mjs','--out',site,'--source-commit',testedCommit,'--workflow-run','123'],{cwd:workspace,stdio:'pipe'}));
  const context={repository,event:'pull_request',commit:testedCommit,headSha,runId:'123',runAttempt:1};
  const receipt=(await sealSite({cwd:workspace,directory:site,bundleDirectory:bundle,context}));
  const manifest=validateSite(path.join(bundle,'site'));
  const receiptBindings={run,repository,headSha,sourceCommit:testedCommit,sourceTree:tree,workflowDigest:digest(fs.readFileSync(path.join(workspace,'.github/workflows/pages.yml')))};
  assertReceipt(receipt,manifest,receiptBindings);cases.push('sealed-reproducible-artifact');
  for(const [field,value] of [['runId','999'],['runAttempt',2],['sourceCommit','b'.repeat(40)],['sourceTree','b'.repeat(40)],['workflowFileSha256','0'.repeat(64)],['manifestDigest','0'.repeat(64)]]){
    (await rejects(`wrong-receipt-${field}`,()=>assertReceipt({...receipt,[field]:value},manifest,receiptBindings),/mismatch|differs|belong/));
  }
  const corrupt=path.join(temporary,'corrupt');fs.cpSync(site,corrupt,{recursive:true});
  fs.appendFileSync(path.join(corrupt,'app-core.js'),'\n/* changed */');
  (await rejects('changed-runtime-bytes',()=>validateSite(corrupt),/Changed verified runtime/));
  fs.copyFileSync(path.join(site,'app-core.js'),path.join(corrupt,'app-core.js'));
  fs.writeFileSync(path.join(corrupt,'unexpected.js'),'');
  (await rejects('unmanifested-file',()=>validateSite(corrupt),/unexpected/));fs.unlinkSync(path.join(corrupt,'unexpected.js'));
  fs.unlinkSync(path.join(corrupt,'.nojekyll'));
  (await rejects('missing-hidden-runtime-file',()=>validateSite(corrupt),/missing/));
  fs.copyFileSync(path.join(site,'.nojekyll'),path.join(corrupt,'.nojekyll'));
  const badManifest=clone(manifest);badManifest.sourceCommit='b'.repeat(40);fs.writeFileSync(path.join(corrupt,manifestName),JSON.stringify(badManifest));
  (await rejects('changed-manifest',()=>validateSite(corrupt),/manifest digest/));
  fs.copyFileSync(path.join(site,manifestName),path.join(corrupt,manifestName));
  fs.unlinkSync(path.join(corrupt,'app-core.js'));fs.symlinkSync(path.join(site,'app-core.js'),path.join(corrupt,'app-core.js'));
  (await rejects('symlink-runtime',()=>validateSite(corrupt),/regular files/));

  git('-c','user.name=Verification fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-qm','Merged identical source');
  const mainCommit=git('rev-parse','HEAD'),promoted=path.join(temporary,'promoted');
  assert.notEqual(mainCommit,testedCommit);assert.equal(git('rev-parse','HEAD^{tree}'),tree);
  (await promoteSite({cwd:workspace,verifiedDirectory:site,outputDirectory:promoted,commit:mainCommit,runId:'456'}));
  const promotedManifest=validateSite(promoted);
  for(const name of runtimePaths)assert.deepEqual(fs.readFileSync(path.join(site,name)),fs.readFileSync(path.join(promoted,name)));
  assert.equal(promotedManifest.sourceCommit,mainCommit);assert.equal(promotedManifest.workflowRunIdentity,'456');
  const expectedManifest=clone(manifest);expectedManifest.sourceCommit=mainCommit;expectedManifest.workflowRunIdentity='456';expectedManifest.manifestDigest=promotedManifest.manifestDigest;
  assert.deepEqual(promotedManifest,expectedManifest);cases.push('different-merge-commit-identical-runtime-only-provenance-changed');
  const mainBundle=path.join(temporary,'main-bundle');
  const mainReceipt=(await sealSite({cwd:workspace,directory:promoted,bundleDirectory:mainBundle,context:{...context,event:'push',commit:mainCommit,runId:'456',headSha:mainCommit,reusedFrom:{runId:'123',sourceTree:tree}}}));
  cases.push('promoted-main-artifact-reproducible');

  // Exercise the actual selection/reuse CLI against a recorded-shape GitHub
  // fixture. This never queries GitHub or starts a workflow.
  const responseFile=path.join(temporary,'api.json'),shim=path.join(temporary,'fetch-fixture.mjs'),eventFile=path.join(temporary,'event.json'),outputFile=path.join(temporary,'outputs');
  fs.writeFileSync(eventFile,'{}');
  fs.writeFileSync(shim,`import fs from 'node:fs';globalThis.fetch=async(value,options)=>{const u=new URL(value),responses=JSON.parse(fs.readFileSync(process.env.VERIFY_API_FIXTURE,'utf8'));if(u.origin==='https://sjonesjones917.github.io'&&u.pathname==='/closed-loop-tracker/closed-loop-deployment-manifest.json'){if(options?.redirect!=='error'||options?.cache!=='no-store')throw new Error('Deployed lookup lost its origin/cache boundary');return {ok:true,status:200,url:String(value),json:async()=>responses.deployedManifest};}if(u.origin!=='https://api.github.com')throw new Error('Unexpected API origin');if(!(u.pathname in responses))throw new Error('Unexpected API request: '+u.pathname);if(u.pathname.endsWith('/runs')&&u.searchParams.get('head_sha')!=='${headSha}')throw new Error('PR head filter missing');return {ok:true,status:200,json:async()=>responses[u.pathname]};};`);
  const prefix='/repos/'+repository;
  const responses={
    [prefix+'/actions/runs/456']:{workflow_id:workflowId},
    [prefix+'/commits/'+mainCommit+'/pulls']:[{number:7,merged_at:'2026-09-30T00:00:00Z',merge_commit_sha:mainCommit,base:{ref:'main',repo:{full_name:repository}},head:{sha:headSha,repo:{full_name:repository}}}],
    [prefix+'/actions/workflows/42/runs']:{workflow_runs:[run]},
    [prefix+'/actions/runs/123']:run,
    [prefix+'/actions/runs/123/attempts/1/jobs']:{jobs},
    [prefix+'/actions/runs/123/artifacts']:{artifacts:[{id:789,name:'verified-site-123-1',expired:false}]},
    [prefix+'/git/commits/'+testedCommit]:{sha:testedCommit,tree:{sha:tree},parents:[{sha:headSha}]}
  };
  const fixtureEnv={...process.env,GH_TOKEN:'synthetic-fixture-token',GITHUB_REPOSITORY:repository,GITHUB_SHA:mainCommit,GITHUB_RUN_ID:'456',GITHUB_RUN_ATTEMPT:'1',GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_PATH:eventFile,GITHUB_OUTPUT:outputFile,VERIFY_API_FIXTURE:responseFile};
  const runCLI=async mode=>(await checkedVerifier(process.execPath,['--import',shim,path.join(root,'verified-site.mjs'),mode],{cwd:workspace,env:fixtureEnv,stdio:'pipe',encoding:'utf8',evidenceDirectory:path.join(temporary,'cli-child-evidence')}));
  const writeResponses=()=>fs.writeFileSync(responseFile,JSON.stringify(responses));
  writeResponses();(await runCLI('select'));
  assert.match(fs.readFileSync(outputFile,'utf8'),/artifact_id=789/);
  fs.cpSync(bundle,path.join(workspace,'_verified-pr'),{recursive:true});
  (await runCLI('reuse'));assert.match(fs.readFileSync(outputFile,'utf8'),/reused=true/);
  for(const name of runtimePaths)assert.deepEqual(fs.readFileSync(path.join(workspace,'_site',name)),fs.readFileSync(path.join(site,name)));
  cases.push('main-selects-and-reuses-passing-artifact-through-actual-CLI-mocked-API');
  fs.writeFileSync(outputFile,'');responses[prefix+'/git/commits/'+testedCommit].tree.sha='b'.repeat(40);writeResponses();
  assert.match((await runCLI('reuse')),/Full verification is required/);assert.doesNotMatch(fs.readFileSync(outputFile,'utf8'),/reused=true/);
  cases.push('changed-merge-tree-falls-back-to-full-checks');
  responses[prefix+'/git/commits/'+testedCommit].tree.sha=tree;
  responses[prefix+'/actions/runs/123'].run_attempt=2;writeResponses();
  (await rejects('changed-run-attempt-during-download',async ()=>(await runCLI('reuse')),/attempt changed/));
  responses[prefix+'/actions/runs/123'].run_attempt=1;
  responses[prefix+'/actions/runs/123/artifacts'].artifacts[0].expired=true;writeResponses();fs.writeFileSync(outputFile,'');
  assert.match((await runCLI('select')),/No complete reusable PR artifact/);assert.equal(fs.existsSync(path.join(workspace,'.verified-candidate.json')),false);assert.equal(fs.readFileSync(outputFile,'utf8'),'');
  cases.push('expired-artifact-falls-back-to-full-checks');

  // A manual acceptance run observes a prior deployment. Rebuilding its
  // manifest with the new run ID changes its digest despite identical bytes.
  const dispatchSite=path.join(temporary,'fresh-dispatch-site');
  await promoteSite({cwd:workspace,verifiedDirectory:promoted,outputDirectory:dispatchSite,commit:mainCommit,runId:'789'});
  const freshDispatchManifest=validateSite(dispatchSite);
  assert.equal(freshDispatchManifest.buildIdentity,promotedManifest.buildIdentity);
  assert.deepEqual(freshDispatchManifest.runtimeResources,promotedManifest.runtimeResources);
  assert.notEqual(freshDispatchManifest.manifestDigest.digest,promotedManifest.manifestDigest.digest,'ACCEPTANCE_DISPATCH_FORMER_MANIFEST_ORACLE');
  cases.push('fresh-acceptance-build-reproduces-former-deployed-manifest-mismatch');
  const mainRun={...clone(run),id:456,event:'push',head_branch:'main',head_sha:mainCommit};
  const mainJobs=clone(jobs);
  mainJobs.find(job=>job.name==='test').steps.push({name:'Preserve verified site for merge and live verification',status:'completed',conclusion:'success'});
  for(const [name,steps]of [['Deploy exact verified bytes',['Deploy application']],['Verify deployed bytes and operator path',['Exact deployed-byte verification','Deployed Chromium operator path','Preserve current deployed browser assertion receipts']]])mainJobs.push({name,status:'completed',conclusion:'success',steps:steps.map(name=>({name,status:'completed',conclusion:'success'}))});
  const mainBindings={repository,commit:mainCommit,workflowId};
  assertPassedDeploymentRun(mainRun,mainJobs,mainBindings);
  for(const [name,change]of [['failed',v=>v.conclusion='failure'],['running',v=>v.status='in_progress'],['not-main',v=>v.head_branch='topic'],['not-push',v=>v.event='workflow_dispatch'],['wrong-source',v=>v.head_sha='b'.repeat(40)],['wrong-repository',v=>v.repository.full_name='another/repo'],['fork',v=>v.head_repository.full_name='another/repo'],['wrong-workflow',v=>v.workflow_id=999]]){
    const altered=clone(mainRun);change(altered);await rejects('dispatch-'+name+'-deployment',()=>assertPassedDeploymentRun(altered,mainJobs,mainBindings),/Deployed verification/);
  }
  for(const job of mainJobs){
    await rejects('dispatch-missing-'+job.name,()=>assertPassedDeploymentRun(mainRun,mainJobs.filter(row=>row!==job),mainBindings),/Required deployed proof job/);
    for(const conclusion of ['failure','skipped','cancelled']){const altered=clone(mainJobs);altered.find(row=>row.name===job.name).conclusion=conclusion;await rejects('dispatch-'+conclusion+'-'+job.name,()=>assertPassedDeploymentRun(mainRun,altered,mainBindings),/Required deployed proof job/);}
  }
  for(const [jobName,stepName]of [['test','Seal verified deployment artifact'],['Deploy exact verified bytes','Deploy application'],['Verify deployed bytes and operator path','Exact deployed-byte verification'],['Verify deployed bytes and operator path','Deployed Chromium operator path']]){
    const altered=clone(mainJobs);altered.find(row=>row.name===jobName).steps.find(row=>row.name===stepName).conclusion='skipped';await rejects('dispatch-skipped-'+stepName,()=>assertPassedDeploymentRun(mainRun,altered,mainBindings),/Required deployed proof step/);
  }
  const mainReceiptBindings={run:mainRun,repository,commit:mainCommit,sourceTree:tree,workflowDigest:receiptBindings.workflowDigest,manifestDigest:promotedManifest.manifestDigest.digest};
  assertDeployedReceipt(mainReceipt,promotedManifest,mainReceiptBindings);
  for(const [field,value]of [['event','workflow_dispatch'],['runId','789'],['runAttempt',2],['headSha',headSha],['sourceCommit',headSha],['sourceTree','b'.repeat(40)],['workflowFileSha256','0'.repeat(64)],['manifestDigest','0'.repeat(64)]])await rejects('dispatch-wrong-receipt-'+field,()=>assertDeployedReceipt({...mainReceipt,[field]:value},promotedManifest,mainReceiptBindings),/Deployed artifact|Deployed workflow/);
  await rejects('dispatch-fresh-manifest-substitution',()=>assertDeployedReceipt(mainReceipt,freshDispatchManifest,mainReceiptBindings),/Deployed manifest/);
  const acceptanceRun={...clone(mainRun),id:789,event:'workflow_dispatch',status:'in_progress',conclusion:null};
  responses[prefix+'/actions/runs/789']=acceptanceRun;
  responses[prefix+'/actions/runs/456']=mainRun;
  responses[prefix+'/actions/runs/456/attempts/1/jobs']={jobs:mainJobs};
  responses[prefix+'/actions/runs/456/artifacts']={artifacts:[{id:987,name:'verified-site-456-1',expired:false}]};
  responses.deployedManifest=promotedManifest;
  Object.assign(fixtureEnv,{GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_RUN_ID:'789'});
  for(const [name,change]of [['id',row=>row.id=999],['attempt',row=>row.run_attempt=2],['event',row=>row.event='push'],['branch',row=>row.head_branch='topic'],['source',row=>row.head_sha=headSha],['repository',row=>row.repository.full_name='another/repo'],['missing-repository',row=>delete row.repository],['head-repository',row=>row.head_repository.full_name='another/repo'],['path',row=>row.path='.github/workflows/other.yml'],['workflow-id',row=>row.workflow_id=null],['status',row=>row.status='completed'],['conclusion',row=>row.conclusion='failure']]){
    const altered=clone(acceptanceRun);change(altered);responses[prefix+'/actions/runs/789']=altered;writeResponses();await rejects('dispatch-current-api-'+name,()=>runCLI('select'),/Current acceptance dispatch/);
  }
  responses[prefix+'/actions/runs/789']=acceptanceRun;
  writeResponses();fs.writeFileSync(outputFile,'');
  await runCLI('select');assert.match(fs.readFileSync(outputFile,'utf8'),/artifact_id=987/);
  fs.rmSync(path.join(workspace,'_verified-pr'),{recursive:true});fs.cpSync(mainBundle,path.join(workspace,'_verified-pr'),{recursive:true});
  await runCLI('reuse');await runCLI('seal');
  assert.match(fs.readFileSync(outputFile,'utf8'),/artifact_name=verified-site-789-1/);
  const acceptanceManifest=validateSite(path.join(workspace,'_verified-site/site')),acceptanceReceipt=JSON.parse(fs.readFileSync(path.join(workspace,'_verified-site/receipt.json'),'utf8'));
  assert.deepEqual(acceptanceManifest,promotedManifest,'ACCEPTANCE_DISPATCH_EXACT_DEPLOYMENT_ORACLE');
  for(const name of [...runtimePaths,manifestName])assert.deepEqual(fs.readFileSync(path.join(workspace,'_verified-site/site',name)),fs.readFileSync(path.join(mainBundle,'site',name)));
  assert.equal(acceptanceReceipt.event,'workflow_dispatch');assert.equal(acceptanceReceipt.runId,'789');assert.equal(acceptanceReceipt.deployedFrom.runId,'456');assert.equal(acceptanceReceipt.deployedFrom.runAttempt,1);assert.equal(acceptanceReceipt.deployedFrom.manifestDigest,promotedManifest.manifestDigest.digest);
  assert.equal(acceptanceReceipt.deployedFrom.receiptSha256,digest(fs.readFileSync(path.join(mainBundle,'receipt.json'))));
  cases.push('dispatch-actual-CLI-preserves-deployed-manifest-and-separates-acceptance-run');
  responses[prefix+'/actions/runs/789']={...clone(acceptanceRun),run_attempt:2};writeResponses();await rejects('dispatch-current-attempt-changed-after-selection',()=>runCLI('reuse'),/Current acceptance dispatch run or attempt differs/);responses[prefix+'/actions/runs/789']=acceptanceRun;writeResponses();
  const savedReuse=fs.readFileSync(path.join(workspace,'.verified-reuse.json')),alteredReuse=JSON.parse(savedReuse);alteredReuse.deployedFrom.runAttempt=99;fs.writeFileSync(path.join(workspace,'.verified-reuse.json'),JSON.stringify(alteredReuse));await rejects('dispatch-handoff-attempt-must-match-original-receipt',()=>runCLI('seal'),/does not belong to the passing main attempt/);fs.writeFileSync(path.join(workspace,'.verified-reuse.json'),savedReuse);
  const priorProofEnvironment=Object.fromEntries(['CLOSED_LOOP_VERIFICATION_SOURCE_ROOT','CLOSED_LOOP_VERIFICATION_RECEIPTS'].map(name=>[name,fixtureEnv[name]]));
  Object.assign(fixtureEnv,{CLOSED_LOOP_VERIFICATION_SOURCE_ROOT:workspace,CLOSED_LOOP_VERIFICATION_RECEIPTS:path.join(workspace,'required-dispatch-proofs')});
  await rejects('dispatch-requires-complete-executed-proof-bundle',()=>runCLI('reuse'),/Deployed executed proof bundle is absent or changed/);
  for(const [name,value]of Object.entries(priorProofEnvironment))if(value===undefined)delete fixtureEnv[name];else fixtureEnv[name]=value;
  responses[prefix+'/actions/runs/456'].run_attempt=2;writeResponses();await rejects('dispatch-attempt-changed-after-download',()=>runCLI('reuse'),/attempt changed/);responses[prefix+'/actions/runs/456'].run_attempt=1;
  responses[prefix+'/actions/runs/456/artifacts'].artifacts[0].expired=true;writeResponses();await rejects('dispatch-expired-artifact-after-download',()=>runCLI('reuse'),/artifact changed or expired/);await rejects('dispatch-expired-artifact-cannot-rebuild-undeployed-manifest',()=>runCLI('select'),/exact deployed main proof artifact is unavailable/);responses[prefix+'/actions/runs/456/artifacts'].artifacts[0].expired=false;
  writeResponses();await runCLI('select');
  responses.deployedManifest=freshDispatchManifest;writeResponses();await rejects('dispatch-live-target-changed-after-download',()=>runCLI('reuse'),/Deployed target changed/);responses.deployedManifest=promotedManifest;writeResponses();
  const savedMainReceipt=fs.readFileSync(path.join(workspace,'_verified-pr/receipt.json'));
  fs.writeFileSync(path.join(workspace,'_verified-pr/receipt.json'),JSON.stringify({...mainReceipt,sourceTree:'b'.repeat(40)}));await rejects('dispatch-different-source-tree',()=>runCLI('reuse'),/source tree mismatch/);fs.writeFileSync(path.join(workspace,'_verified-pr/receipt.json'),savedMainReceipt);
  const wrongToolchain=path.join(temporary,'wrong-deployed-toolchain');fs.cpSync(promoted,wrongToolchain,{recursive:true});
  const wrongToolchainManifest=clone(promotedManifest);wrongToolchainManifest.dependencyAndToolchainManifestIdentity.node='v0.0.0';delete wrongToolchainManifest.manifestDigest;wrongToolchainManifest.manifestDigest={hashAlgorithm:'SHA-256',digest:globalThis.closedLoopHash.sha256Value(wrongToolchainManifest)};fs.writeFileSync(path.join(wrongToolchain,manifestName),JSON.stringify(wrongToolchainManifest,null,2)+'\n');
  await rejects('dispatch-different-build-toolchain',()=>promoteSite({cwd:workspace,verifiedDirectory:wrongToolchain,outputDirectory:dispatchSite,commit:mainCommit,runId:'456',preserveManifest:true}),/Deployed manifest changed/);
  fixtureEnv.GITHUB_REF='refs/heads/topic';await rejects('dispatch-non-main-ref',()=>runCLI('select'),/restricted to main/);fixtureEnv.GITHUB_REF='refs/heads/main';
  await runCLI('reuse');await runCLI('seal');assert.deepEqual(validateSite(path.join(workspace,'_verified-site/site')),promotedManifest);cases.push('dispatch-restored-exact-deployment-passes-after-refusals');

  fs.appendFileSync(path.join(workspace,'app-core.js'),'\n/* untested source */');
  (await rejects('dirty-source',async ()=>(await promoteSite({cwd:workspace,verifiedDirectory:site,outputDirectory:promoted,commit:mainCommit,runId:'456'})),/tracked source changes/));
  git('add','app-core.js');git('-c','user.name=Verification fixture','-c','user.email=fixture@example.invalid','commit','-qm','Changed main runtime');
  (await rejects('changed-merged-source',async ()=>(await promoteSite({cwd:workspace,verifiedDirectory:site,outputDirectory:promoted,commit:git('rev-parse','HEAD'),runId:'456'})),/differs/));
  assert.deepEqual(fs.readFileSync(path.join(promoted,'app-core.js')),fs.readFileSync(path.join(site,'app-core.js')),'Failed promotion must not overwrite the last intact artifact.');

  const workflow=fs.readFileSync('.github/workflows/pages.yml','utf8');
  const dispatchSelection="        id: candidate\n        if: (github.event_name == 'push' || github.event_name == 'workflow_dispatch') && github.ref == 'refs/heads/main'\n";
  assert.equal(workflow.split(dispatchSelection).length-1,5,'ACCEPTANCE_DISPATCH_PHASE_SELECTION_ORACLE');
  await rejects('dispatch-disabled-before-source-proof',()=>assertLifecycleWorkflowCommand(workflow.replace(dispatchSelection,"        id: candidate\n        if: github.event_name == 'push' && github.ref == 'refs/heads/main'\n")),/Main acceptance dispatch must authenticate/);
  const nodeVersions=[...workflow.matchAll(/^          node-version: '([^']+)'$/gm)].map(match=>match[1]);
  assert.equal(nodeVersions.length,7,'CI_RUNTIME_IDENTITY_ORACLE: every proof job must select Node explicitly.');
  assert(nodeVersions.every(version=>/^22\.\d+\.\d+$/.test(version)&&version===nodeVersions[0]),'CI_RUNTIME_IDENTITY_ORACLE: all proof jobs require the same exact supported Node version.');
  const deferredDiagnostics=workflow.match(/      - name: Preserve deferred matrix diagnostics\n([\s\S]*?)(?=\n      - name:|\n  [a-z])/);
  assert(deferredDiagnostics,'CI_DEFERRED_DIAGNOSTICS_ORACLE: deferred diagnostics upload is required.');
  assert.match(deferredDiagnostics[1],/path: \.ci-deferred-diagnostics\//);
  assert.match(deferredDiagnostics[1],/include-hidden-files: true/,'CI_DEFERRED_DIAGNOSTICS_ORACLE: the hidden diagnostic directory must be included.');
  cases.push('exact-runtime-and-visible-deferred-diagnostics');
  const testWorkflow=workflow.slice(workflow.indexOf('\n  test:'),workflow.indexOf('\n  deploy:'));
  assertLifecycleWorkflowCommand(workflow);
  const uploadSteps=[...workflow.matchAll(/^      - [\s\S]*?(?=^      - |^  [a-z][\w-]*:\n|(?![\s\S]))/gm)].map(match=>match[0]).filter(step=>/^        uses: actions\/upload-artifact@/m.test(step));
  assert.equal(uploadSteps.length,19,'CI_UPLOAD_PRELOAD_ORACLE: all maintained artifact upload actions must be covered.');
  for(const [index,step] of uploadSteps.entries()){
    const override="        env:\n          NODE_OPTIONS: ''\n";
    assert.equal(step.split(override).length,2,'CI_UPLOAD_PRELOAD_ORACLE: exact scoped action override required.');
    for(const [mutation,replacement] of [['missing',''],['inherited',"        env:\n          NODE_OPTIONS: --import ${{ github.workspace }}/verification-evidence-preload.mjs\n"]]){
      const changed=workflow.replace(step,step.replace(override,replacement));
      assert.notEqual(changed,workflow,'CI_UPLOAD_PRELOAD_ORACLE: mutation did not apply.');
      await rejects('upload-preload-'+index+'-'+mutation,()=>assertLifecycleWorkflowCommand(changed),/Artifact upload action must clear/);
    }
  }
  const jobPreload='      NODE_OPTIONS: --import ${{ github.workspace }}/verification-evidence-preload.mjs\n';
  assert.equal(workflow.split(jobPreload).length-1,6,'CI_UPLOAD_PRELOAD_ORACLE: six producer job preloads must remain.');
  await rejects('upload-fix-must-not-disable-job-preload',()=>assertLifecycleWorkflowCommand(workflow.replaceAll(jobPreload,"      NODE_OPTIONS: ''\n")),/repository producer job preload must remain enabled/);
  const producer='      - name: Syntax\n';
  assert.equal(workflow.split(producer).length,2);
  await rejects('upload-fix-must-not-disable-producer-step',()=>assertLifecycleWorkflowCommand(workflow.replace(producer,producer+"        env:\n          NODE_OPTIONS: ''\n")),/Repository producer step must retain/);
  cases.push('all-upload-preloads-isolated-with-producer-preloads-retained');
  const conformanceStart=workflow.indexOf('\n  conformance:\n'),conformanceEnd=workflow.indexOf('\n  test:\n'),conformanceWorkflow=workflow.slice(conformanceStart,conformanceEnd);
  for(const [name,before,after,diagnostic] of [
    ['missing-group','group: [core, creation, counterpart]','group: [core, creation]',/complete conformance group execution/],
    ['missing-execution','node verify-conformance-regressions.mjs --group=${{ matrix.group }} > /tmp/conformance-regressions.json','node missing-conformance.mjs',/complete conformance group execution/],
    ['missing-report','name: Preserve complete conformance group report','name: Missing group report',/complete conformance group execution/],
    ['missing-receipts','name: Preserve conformance execution receipts','name: Missing group receipts',/complete conformance group execution/],
    ['missing-handoff','node verify-conformance-handoff.mjs','node missing-handoff.mjs',/conformance group proof handoff/],
    ['missing-group-gate','      - name: Require successful conformance groups\n        run: test "${{ needs.conformance.result }}" = "success"\n','',/failed conformance group must fail/]
  ]){assert.equal(workflow.split(before).length,2,'CONFORMANCE_CI_FAULT_SETUP_ORACLE: '+name);await rejects('conformance-workflow-'+name,()=>assertLifecycleWorkflowCommand(workflow.replace(before,after)),diagnostic);}
  const ingestionExport='        run: node collect-verification-evidence.mjs --export-owner=verify-ingestion.mjs\n';
  const conformanceExport=mutate=>workflow.slice(0,conformanceStart)+mutate(conformanceWorkflow)+workflow.slice(conformanceEnd);
  for(const [name,mutate,diagnostic] of [
    ['missing-ingestion-prerequisite',text=>text.replace(ingestionExport,''),/current ingestion receipt must be transferred/],
    ['wrong-ingestion-group',text=>text.replace(ingestionExport,'        run: if [ "${{ matrix.group }}" = creation ]; then node collect-verification-evidence.mjs --export-owner=verify-ingestion.mjs; fi\n'),/current ingestion receipt must be transferred/],
    ['late-ingestion-prerequisite',text=>text.replace(ingestionExport,'').replace('      - name: Stage conformance group report\n',ingestionExport+'      - name: Stage conformance group report\n'),/current ingestion receipt must be produced before/],
    ['former-duplicate-producer',text=>text.replace(ingestionExport,'        run: |\n          node verify-ingestion.mjs\n'),/complete producer once/],
    ['partial-report-export',text=>text.replace(ingestionExport,ingestionExport.trimEnd()+' --report-marker=ingestion\n'),/current ingestion receipt must be transferred/],
    ['repeated-producer-after-export',text=>text.replace('          node verify-conformance-regressions.mjs','          node verify-ingestion.mjs\n          node verify-conformance-regressions.mjs'),/complete producer once/]
  ]){const changed=conformanceExport(mutate);assert.notEqual(changed,workflow,'INGESTION_REUSE_FAULT_SETUP_ORACLE: '+name);await rejects('conformance-workflow-'+name,()=>assertLifecycleWorkflowCommand(changed),diagnostic);}
  assertLifecycleWorkflowCommand(workflow);cases.push('ingestion-report-reuse-restored-workflow');
  for(const [name,from,to]of [
    ['deferred-before-foundation','    needs: foundation\n',''],
    ['workflow-before-deferred','    needs: [foundation, deferred-matrix]\n','    needs: foundation\n'],
    ['conformance-before-prompts','    needs: workflow-gates\n','    needs: foundation\n']
  ]){const changed=workflow.replace(from,to);assert.notEqual(changed,workflow);await rejects('phase-order-'+name,()=>assertLifecycleWorkflowCommand(changed),/proof phase dependencies/);}
  for(const [job,label]of [['foundation','foundation job'],['workflow-gates','workflow gate job']]){
    const guard='      - name: Require successful '+label+'\n        run: test "${{ needs.'+job+'.result }}" = "success"\n';
    await rejects('phase-missing-'+job+'-required-guard',()=>assertLifecycleWorkflowCommand(workflow.replace(guard,'')),new RegExp('failed '+job+' must fail'));
  }
  for(const [name,mutate,diagnostic]of [
    ['migration-before-registries',text=>text.replace('      - name: Contract-profile migration\n','      - name: EARLY MIGRATION\n').replace('      - name: Syntax\n','      - name: Contract-profile migration\n'),/foundation proof order/],
    ['final-collector-runs-producers',text=>text.replace('      - name: Collect current executed assertion evidence\n        run: node collect-verification-evidence.mjs\n','      - name: Collect current executed assertion evidence\n        run: node collect-verification-evidence.mjs --run-missing\n'),/final aggregation must not execute producers/]
  ]){const changed=mutate(workflow);assert.notEqual(changed,workflow);await rejects('phase-order-'+name,()=>assertLifecycleWorkflowCommand(changed),diagnostic);}
  for(const owner of ['verify-stage-contract-closure.mjs','verify-file-first-response.mjs','verify-response-authority-integrity.mjs','verify-returned-slot-authority.mjs']){
    const line='          node '+owner+'\n';
    assert.equal(workflow.split(line).length,2,'FOUNDATION_OWNER_SETUP_ORACLE: '+owner);
    for(const [kind,replacement]of [['missing',''],['duplicate',line+line]])await rejects('foundation-owner-'+kind+'-'+owner,()=>assertLifecycleWorkflowCommand(workflow.replace(line,replacement)),/foundation owner must execute once/);
  }
  for(const [owner,indent,diagnostic]of [['verify-stage-operation-registry.mjs','        run: ',/current registry receipt/],['verify-response-authority-integrity.mjs','          ',/current authority receipt/],['verify-returned-slot-authority.mjs','          ',/current authority receipt/]]){
    const line=indent+'node collect-verification-evidence.mjs --export-owner='+owner+'\n';
    assert.equal(workflow.split(line).length,2,'PREREQUISITE_RECEIPT_SETUP_ORACLE: '+owner);
    await rejects('phase-missing-current-receipt-'+owner,()=>assertLifecycleWorkflowCommand(workflow.replace(line,'')),diagnostic);
  }
  const routingLine='          node verify-verification-routing.mjs\n';
  for(const [name,mutate,diagnostic]of [
    ['routing-owner-after-collector',text=>text.replace(routingLine,'').replace('          timeout --signal=TERM --kill-after=10s 5m node verify-verification-routing-browser.mjs',routingLine+'          timeout --signal=TERM --kill-after=10s 5m node verify-verification-routing-browser.mjs'),/non-browser routing proof/],
    ['missing-prebrowser-collector',text=>text.replace('        run: node collect-verification-evidence.mjs\n',''),/final aggregation must not execute producers/]
  ]){const changed=mutate(workflow);assert.notEqual(changed,workflow);await rejects('phase-order-'+name,()=>assertLifecycleWorkflowCommand(changed),diagnostic);}
  for(const owner of ['verify-all-stage-prompts.mjs','verify-stage-context-boundary.mjs','verify-handoff-metadata-boundary.mjs','verify-handoff-disclosure.mjs','verify-stage-prompts-complete.mjs','verify-user-prompt-invariants.mjs']){
    const line='          node '+owner+'\n';
    assert.equal(workflow.split(line).length,2,'PROMPT_PHASE_SETUP_ORACLE: '+owner);
    for(const [name,mutate]of [
      ['former-stage04-placement',text=>text.replace(line,'').replace('          node verify-zero-loss-accounting.mjs\n','          node verify-zero-loss-accounting.mjs\n'+line)],
      ['missing',text=>text.replace(line,'')],
      ['duplicate',text=>text.replace(line,line+line)]
    ])await rejects('prompt-phase-'+name+'-'+owner,()=>assertLifecycleWorkflowCommand(mutate(workflow)),/broad prompt and disclosure proof must execute once after workflow gates/);
  }
  await rejects('stage04-obligation-owner-missing',()=>assertLifecycleWorkflowCommand(workflow.replace('          node verify-zero-loss-accounting.mjs\n','')),/Stage 04 obligation accounting proof/);
  const memoryLine='          node verify-proposal-acceptance-memory.mjs\n';
  for(const [name,mutate]of [
    ['former-registry-placement',text=>text.replace(memoryLine,'').replace('          node verify.mjs\n','          node verify.mjs\n'+memoryLine)],
    ['missing',text=>text.replace(memoryLine,'')],
    ['duplicate',text=>text.replace(memoryLine,memoryLine+memoryLine)]
  ])await rejects('acceptance-memory-phase-'+name,()=>assertLifecycleWorkflowCommand(mutate(workflow)),/acceptance memory proof must execute once/);
  const deferredBlock=workflow.slice(workflow.indexOf('\n  deferred-matrix:\n'),workflow.indexOf('\n  workflow-gates:\n'));
  for(const [name,alter,diagnostic] of [
    ['missing-job',text=>text.replace(deferredBlock,''),/deferred-matrix proof job/],
    ['missing-producer',text=>text.replace('node verify-due-stage-timing.mjs > /tmp/deferred-stage-matrix.json','node missing-deferred-matrix.mjs'),/complete deferred matrix execution/],
    ['missing-dependency',text=>text.replace('    needs: [foundation, deferred-matrix, workflow-gates, conformance]\n',''),/proof phase dependencies/],
    ['missing-receipt-validation',text=>text.replaceAll('name: Validate complete deferred matrix receipt','name: Skip deferred matrix validation'),/deferred matrix proof dependency/],
    ['skipped-required-test',text=>text.replace('    if: always()\n    permissions:\n','    if: always() && needs.deferred-matrix.result == \'success\'\n    permissions:\n'),/failed deferred matrix must fail the required test job/],
    ['missing-required-gate',text=>text.replace('      - name: Require successful deferred matrix job\n        run: test "${{ needs.deferred-matrix.result }}" = "success"\n',''),/failed deferred matrix must fail the required test job/]
  ]){const changed=alter(workflow);assert.notEqual(changed,workflow,`DEFERRED_MATRIX_CI_FAULT_SETUP_ORACLE: ${name}`);(await rejects(`deferred-matrix-${name}`,()=>assertLifecycleWorkflowCommand(changed),diagnostic));}
  const lifecycleLine='          node verify-project-lifecycle.mjs\n',definitionLine='          node verify-v3-definition-of-done.mjs\n';
  const externalLine='          node verify-external-result-determination.mjs\n',doneLine='          node verify-definition-of-done.mjs\n';
  const stage01Line='          node verify-stage01-intake-closure.mjs\n',preflightLine='          node verify-independent-preflight.mjs\n',receiptControlLine='          node verify-definition-of-done.mjs --owner-receipt-controls\n';
  for(const [name,alter] of [
    ['stage01-missing',text=>text.replace(stage01Line,'')],
    ['preflight-missing',text=>text.replace(preflightLine,'')],
    ['preflight-duplicate',text=>text.replace(preflightLine,preflightLine+preflightLine)],
    ['receipt-control-missing',text=>text.replace(receiptControlLine,'')],
    ['receipt-control-duplicate',text=>text.replace(receiptControlLine,receiptControlLine+receiptControlLine)],
    ['receipt-control-before-preflight',text=>text.replace(receiptControlLine,'').replace(preflightLine,receiptControlLine+preflightLine)],
    ['receipt-control-after-dod',text=>text.replace(receiptControlLine,'').replace(doneLine,doneLine+receiptControlLine)]
  ]){const changed=alter(workflow);assert.notEqual(changed,workflow,`DOD_RECEIPT_GATE_SETUP_ORACLE: ${name} mutation did not reach the Workflow gate.`);(await rejects(`dod-receipt-${name}`,()=>assertLifecycleWorkflowCommand(changed),/Stage 01\/09 direct owner receipts and DOD receipt controls/));}
  for(const [name,alter] of [
    ['missing',text=>text.replace(externalLine,'')],
    ['duplicate',text=>text.replace(externalLine,externalLine+externalLine)],
    ['reordered',text=>text.replace(externalLine,'').replace(doneLine,doneLine+externalLine)]
  ]){const changed=alter(workflow);assert.notEqual(changed,workflow,`EXTERNAL_RESULT_GATE_SETUP_ORACLE: ${name} mutation did not reach the Workflow gate.`);(await rejects(`external-result-${name}`,()=>assertLifecycleWorkflowCommand(changed),/external-result determination proof/));}
  for(const [name,alter] of [
    ['missing',text=>text.replace(lifecycleLine,'')],
    ['duplicate',text=>text.replace(lifecycleLine,lifecycleLine+lifecycleLine)],
    ['reordered',text=>text.replace(lifecycleLine+definitionLine,definitionLine+lifecycleLine)]
  ]){const changed=alter(workflow);assert.notEqual(changed,workflow,`LIFECYCLE_GATE_SETUP_ORACLE: ${name} mutation did not reach the Workflow gate.`);(await rejects(`lifecycle-${name}`,()=>assertLifecycleWorkflowCommand(changed),/lifecycle proof/));}
  const contractLine='          node verify-contract-closure.mjs\n',migrationLine='          node verify-v3-migration.mjs\n';
  const fullCycleLine='          node verify-full-cycle.mjs | tee /tmp/full-cycle-proof.json\n',terminalLine='          node verify-stage30-terminal-mobile-boundary.mjs\n';
  const promptHeading='      - name: Prompt semantics and leakage\n',fullHeading='      - name: Full cycle and terminal boundary\n';
  const promptAt=workflow.indexOf(promptHeading),fullAt=workflow.indexOf(fullHeading),sharedAt=workflow.indexOf('      - name: Stale project navigation and draft preservation\n');
  assert(promptAt>=0&&fullAt>promptAt&&sharedAt>fullAt,'CI_PROOF_ORDER_SETUP_ORACLE: required current proof steps are missing.');
  for(const [name,alter,diagnostic] of [
    ['contract-missing',text=>text.replace(contractLine,''),/authoritative registry proofs/],
    ['contract-duplicate',text=>text.replace(contractLine,contractLine+contractLine),/Contract-closure/],
    ['contract-after-migration',text=>text.replace(contractLine,'').replace(migrationLine,migrationLine+contractLine),/Contract-closure/],
    ['early-infrastructure',text=>text.replace('          node verify-data-route-closure.mjs\n','          node verify-data-route-closure.mjs\n          node verify-infrastructure-route-closure.mjs\n'),/Infrastructure route/],
    ['full-cycle-missing',text=>text.replace(fullCycleLine,''),/Full-cycle and Stage 30/],
    ['terminal-duplicate',text=>text.replace(terminalLine,terminalLine+terminalLine),/Full-cycle and Stage 30/],
    ['prompt-after-full-cycle',text=>{const next=text.indexOf('      - name:',promptAt+promptHeading.length),block=text.slice(promptAt,next);return text.slice(0,promptAt)+text.slice(next,sharedAt)+block+text.slice(sharedAt);},/specification order/]
  ]){const changed=alter(workflow);assert.notEqual(changed,workflow,`CI_PROOF_ORDER_SETUP_ORACLE: ${name} mutation did not apply.`);(await rejects(`proof-order-${name}`,()=>assertLifecycleWorkflowCommand(changed),diagnostic));}
  cases.push('workflow-proof-order-and-direct-owner-mutations');
  const quarantineOwnerLine='          node test-quarantine-ui-export-owner.mjs\n';
  const strictCollectionStep="      - name: Complete current non-browser assertion evidence\n        if: steps.reuse.outputs.reused != 'true'\n        run: node collect-verification-evidence.mjs\n\n";
  for(const [name,alter]of [
    ['missing',text=>text.replace(quarantineOwnerLine,'')],
    ['duplicate',text=>text.replace(quarantineOwnerLine,quarantineOwnerLine+quarantineOwnerLine)],
    ['before-conformance',text=>text.replace(quarantineOwnerLine,'').replace('        run: node verify-conformance-handoff.mjs\n','        run: |\n'+quarantineOwnerLine+'          node verify-conformance-handoff.mjs\n')],
    ['after-full-cycle',text=>text.replace(quarantineOwnerLine,'').replace(fullCycleLine,fullCycleLine+quarantineOwnerLine)],
    ['after-collection',text=>text.replace(quarantineOwnerLine,'').replace('      - name: Stale project navigation and draft preservation\n','      - name: Late quarantine owner\n        run: |\n'+quarantineOwnerLine+'      - name: Stale project navigation and draft preservation\n')],
    ['collection-before-full-cycle',text=>text.replace(strictCollectionStep,'').replace(fullHeading,strictCollectionStep+fullHeading)],
    ['focused-invocation',text=>text.replace(quarantineOwnerLine,'          node test-quarantine-ui-export-owner.mjs --focused\n')]
  ]){const changed=alter(workflow);assert.notEqual(changed,workflow,'QUARANTINE_OWNER_GATE_SETUP_ORACLE: '+name);await rejects('quarantine-owner-'+name,()=>assertLifecycleWorkflowCommand(changed),/quarantine UI export owner must execute once/);}
  assertLifecycleWorkflowCommand(workflow);cases.push('quarantine-owner-restored-workflow');
  assert.equal((workflow.match(/^          node build-test-project\.mjs$/gm)||[]).length,1,'CI_DUPLICATE_FIXTURE_ORACLE: retained fixture verification runs once');
  const conformancePosition=testWorkflow.indexOf('name: Validate complete conformance handoff');
  for(const name of ['Stale project navigation and draft preservation','Verification routing and capability evidence','Startup and scrolling at phone and desktop sizes','Acceptance viewport regression and targeted layout fault','Local Chromium operator path'])assert.ok(conformancePosition>=0&&testWorkflow.indexOf('name: '+name)>conformancePosition,'CI_PROOF_ORDER_ORACLE: non-browser proof precedes '+name);
  // Execute the early prompt entry point with the actual child-launch boundary
  // rejecting its former transitive browser call. The later browser gate still
  // owns the independently executable walkthrough and all its assertions.
  const proofGuard=path.join(temporary,'proof-order-guard.mjs');
  fs.writeFileSync(proofGuard,"import childProcess from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';const original=childProcess.spawn;childProcess.spawn=function(command,args,options){if(args?.some(value=>String(value).includes('verify-human-stage-walkthrough.mjs')))throw new Error('CI_TRANSITIVE_PROOF_ORDER_ORACLE: browser launched before non-browser proof');return original.call(this,command,args,options);};syncBuiltinESMExports();\n");
  const promptEntry=path.join(root,'verify-stage-prompts-complete.mjs'),promptControl=await runVerifier(process.execPath,['--import',proofGuard,promptEntry],{cwd:root});
  assert.equal(promptControl.status,0,'CI_TRANSITIVE_PROOF_ORDER_ORACLE: '+promptControl.stderr);
  const promptProof=JSON.parse(promptControl.stdout);assert.equal(promptProof.stagesChecked,30);assert.equal(promptProof.browserStageWalkthrough,false);
  const earlyBrowser=path.join(temporary,'early-browser.mjs');
  fs.writeFileSync(earlyBrowser,`await import(${JSON.stringify(pathToFileURL(promptEntry).href)});const {runVerifier}=await import(${JSON.stringify(pathToFileURL(path.join(root,'verify-conformance-regressions.mjs')).href)});await runVerifier(process.execPath,['verify-human-stage-walkthrough.mjs']);\n`);
  const violation=await runVerifier(process.execPath,['--import',proofGuard,earlyBrowser],{cwd:root});
  assertDetectedFault(violation,'CI_TRANSITIVE_PROOF_ORDER_ORACLE','early transitive browser launch');
  const browserStep=testWorkflow.slice(testWorkflow.indexOf('name: Local Chromium operator path'));
  assert.match(browserStep,/run_browser_verifier verify-human-stage-walkthrough\.mjs \|\| BROWSER_VERIFY_RESULT=1/,'The mandatory browser walkthrough must retain exit propagation in its later gate.');
  cases.push('non-browser-prompt-entry-rejects-transitive-browser-launch');
  // Exercise the actual shell functions, including pipefail. A connection
  // diagnostic from an earlier phase must not excuse a later assertion failure.
  const browserFunctions=[...workflow.matchAll(/^          run_browser_verifier\(\) \{\n[\s\S]*?^          \}/gm)].map(match=>match[0]);
  assert.equal(browserFunctions.length,3,'BROWSER_GATE_WIRING_ORACLE');
  const retryFixture=path.join(temporary,'retry-fixture');fs.mkdirSync(retryFixture);
  fs.writeFileSync(path.join(retryFixture,'failure.mjs'),"import fs from 'node:fs';const p='attempts';const n=fs.existsSync(p)?Number(fs.readFileSync(p,'utf8'))+1:1;fs.writeFileSync(p,String(n));if(n===1){console.error('Earlier diagnostic: ECONNREFUSED 127.0.0.1:9222');console.error('AssertionError: CONTROLLED_BROWSER_ASSERTION');process.exitCode=1;}else console.log('Would pass after retry');\n");
  fs.writeFileSync(path.join(retryFixture,'healthy.mjs'),"console.log('healthy browser-boundary control');\n");
  // This isolated fixture tests the unchanged shell failure/pipefail boundary.
  // The wrapper adapter executes the supplied failing/healthy child once; real
  // receipt parsing and source/scope validation have separate owning controls.
  fs.writeFileSync(path.join(retryFixture,'collect-verification-evidence.mjs'),"import {spawnSync} from 'node:child_process';const suite=process.argv.find(arg=>arg.startsWith('--browser-suite='))?.slice(16);const result=spawnSync(process.execPath,[suite],{stdio:'inherit'});process.exitCode=result.status??1;\n");
  const executeBrowserFunction=(source,fixture)=>spawnSync('bash',['-c','set -euo pipefail\n'+source.replaceAll('/tmp/','./')+'\nrun_browser_verifier '+fixture+' 2s'],{cwd:retryFixture,encoding:'utf8',timeout:5000,killSignal:'SIGKILL',env:{...process.env,CLOSED_LOOP_BROWSER_SCOPE:'LOCAL'}});
  for(const [index,source] of browserFunctions.entries()){
    fs.rmSync(path.join(retryFixture,'attempts'),{force:true});
    const failed=executeBrowserFunction(source,'failure.mjs');
    assert.equal(failed.error,undefined,'BROWSER_GATE_EXECUTION_ORACLE');
    assert.equal(failed.signal,null,'BROWSER_GATE_EXECUTION_ORACLE');
    assert.equal(failed.status,1,'BROWSER_GATE_FAILURE_ORACLE: an assertion must remain a failed gate');
    assert.equal(fs.readFileSync(path.join(retryFixture,'attempts'),'utf8'),'1','BROWSER_GATE_RETRY_ORACLE: no unclassified retry');
    assert.match(failed.stdout,/CONTROLLED_BROWSER_ASSERTION/,'BROWSER_GATE_RAW_FAILURE_ORACLE');
    const healthy=executeBrowserFunction(source,'healthy.mjs');assert.equal(healthy.status,0,healthy.stderr);
    const fault=source.replace(' | tee "$log"',' | tee "$log" || true');assert.notEqual(fault,source,'BROWSER_GATE_FAULT_ANCHOR_ORACLE');
    fs.rmSync(path.join(retryFixture,'attempts'),{force:true});
    const masked=executeBrowserFunction(fault,'failure.mjs');
    assert.throws(()=>assert.equal(masked.status,1,'BROWSER_GATE_FAILURE_ORACLE'),error=>error.code==='ERR_ASSERTION'&&error.message.startsWith('BROWSER_GATE_FAILURE_ORACLE'),'BROWSER_GATE_FAULT_DETECTION_ORACLE');
    cases.push('browser-gate-'+index+'-failure-retained-and-masking-fault-detected');
  }
  for(const name of [...foundationProofSteps,...workflowGateProofSteps,...fullTestSteps]){
    const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const step=workflow.match(new RegExp('^      - name: '+escaped+'\\n(?:(?!      - ).*(?:\\n|$))*','m'))?.[0];
    assert.ok(step,`Required gate missing from workflow: ${name}`);
    if(!['Require successful foundation job','Require successful workflow gate job','Require successful deferred matrix job','Require successful conformance groups','Verified artifact reuse checks','Collect current executed assertion evidence','Seal verified deployment artifact'].includes(name))assert.match(step,/if: steps\.reuse\.outputs\.reused != 'true'/,'Only proven reuse may skip a full check.');
    else assert.doesNotMatch(step,/^        if:/m,'The matrix gate, artifact contract, and final seal must always run.');
  }
  assert.ok(workflow.indexOf('name: Seal verified deployment artifact')>workflow.indexOf('name: Validate complete conformance handoff'));
  assert.ok(workflow.indexOf('name: Collect current executed assertion evidence')>workflow.indexOf('name: Validate complete conformance handoff'));
  assert.ok(workflow.indexOf('name: Seal verified deployment artifact')>workflow.indexOf('name: Collect current executed assertion evidence'));
  assert.match(workflow,/include-hidden-files: true/);
  assert.match(workflow,/name: \$\{\{ needs\.test\.outputs\.verified_artifact_name \}\}/,'Live verification must retain the successful test attempt artifact on job reruns.');
  assert.match(workflow,/VERIFIED_SITE_DIR: _verified-site\/site/);
  cases.push('all-original-gates-retained-before-artifact-publication');
  console.log(JSON.stringify({verifiedSiteReuse:'PASS',cases:cases.length,checks:cases,fullCIRun:false}));
  completed=true;
}finally{if(completed)fs.rmSync(temporary,{recursive:true,force:true});else process.stderr.write(JSON.stringify({verifiedSiteReuse:'FAIL',retainedFixtureDirectory:temporary,cliChildEvidenceDirectory:path.join(temporary,'cli-child-evidence')})+'\n');}
