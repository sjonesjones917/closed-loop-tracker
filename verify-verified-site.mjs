import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {runtimePaths,manifestName,fullTestSteps,digest,validateSite,assertPassedRun,assertReceipt,promoteSite,sealSite} from './verified-site.mjs';

const root=process.cwd(),temporary=fs.mkdtempSync(path.join(root,'.verify-artifact-'));
const cases=[];
function rejects(name,operation,expected){assert.throws(operation,expected);cases.push(name);}
const repository='test-owner/test-repo',headSha='a'.repeat(40),workflowId=42;
const run={id:123,run_attempt:1,event:'pull_request',status:'completed',conclusion:'success',repository:{full_name:repository},head_repository:{full_name:repository},head_sha:headSha,workflow_id:workflowId,path:'.github/workflows/pages.yml'};
const jobs=[{name:'test',status:'completed',conclusion:'success',steps:fullTestSteps.map(name=>({name,status:'completed',conclusion:'success'}))}];
const bindings={repository,headSha,workflowId};
const clone=value=>structuredClone(value);
try{
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
  ]){const altered=clone(run);change(altered);rejects(name,()=>assertPassedRun(altered,jobs,bindings),/verification|workflow/);}
  for(const conclusion of ['failure','skipped',null]){
    const altered=clone(jobs);altered[0].steps[3].conclusion=conclusion;
    rejects(`unpassed-required-step-${conclusion}`,()=>assertPassedRun(run,altered,bindings),/did not pass/);
  }
  rejects('missing-required-step',()=>assertPassedRun(run,[{...jobs[0],steps:jobs[0].steps.slice(1)}],bindings),/did not pass/);
  rejects('duplicate-test-job',()=>assertPassedRun(run,[...jobs,...jobs],bindings),/Required test job/);

  const workspace=path.join(temporary,'workspace');fs.mkdirSync(path.join(workspace,'.github/workflows'),{recursive:true});
  for(const name of [...runtimePaths,'build-static-site.mjs','.github/workflows/pages.yml'])fs.copyFileSync(path.join(root,name),path.join(workspace,name));
  const git=(...args)=>execFileSync('git',args,{cwd:workspace,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git('init','-q');git('add','.');git('-c','user.name=Verification fixture','-c','user.email=fixture@example.invalid','commit','-qm','Tested source');
  const testedCommit=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}');
  const site=path.join(temporary,'site'),bundle=path.join(temporary,'bundle');
  execFileSync(process.execPath,['build-static-site.mjs','--out',site,'--source-commit',testedCommit,'--workflow-run','123'],{cwd:workspace,stdio:'pipe'});
  const context={repository,event:'pull_request',commit:testedCommit,headSha,runId:'123',runAttempt:1};
  const receipt=sealSite({cwd:workspace,directory:site,bundleDirectory:bundle,context});
  const manifest=validateSite(path.join(bundle,'site'));
  const receiptBindings={run,repository,headSha,sourceCommit:testedCommit,sourceTree:tree,workflowDigest:digest(fs.readFileSync(path.join(workspace,'.github/workflows/pages.yml')))};
  assertReceipt(receipt,manifest,receiptBindings);cases.push('sealed-reproducible-artifact');
  for(const [field,value] of [['runId','999'],['runAttempt',2],['sourceCommit','b'.repeat(40)],['sourceTree','b'.repeat(40)],['workflowFileSha256','0'.repeat(64)],['manifestDigest','0'.repeat(64)]]){
    rejects(`wrong-receipt-${field}`,()=>assertReceipt({...receipt,[field]:value},manifest,receiptBindings),/mismatch|differs|belong/);
  }
  const corrupt=path.join(temporary,'corrupt');fs.cpSync(site,corrupt,{recursive:true});
  fs.appendFileSync(path.join(corrupt,'app-core.js'),'\n/* changed */');
  rejects('changed-runtime-bytes',()=>validateSite(corrupt),/Changed verified runtime/);
  fs.copyFileSync(path.join(site,'app-core.js'),path.join(corrupt,'app-core.js'));
  fs.writeFileSync(path.join(corrupt,'unexpected.js'),'');
  rejects('unmanifested-file',()=>validateSite(corrupt),/unexpected/);fs.unlinkSync(path.join(corrupt,'unexpected.js'));
  fs.unlinkSync(path.join(corrupt,'.nojekyll'));
  rejects('missing-hidden-runtime-file',()=>validateSite(corrupt),/missing/);
  fs.copyFileSync(path.join(site,'.nojekyll'),path.join(corrupt,'.nojekyll'));
  const badManifest=clone(manifest);badManifest.sourceCommit='b'.repeat(40);fs.writeFileSync(path.join(corrupt,manifestName),JSON.stringify(badManifest));
  rejects('changed-manifest',()=>validateSite(corrupt),/manifest digest/);
  fs.copyFileSync(path.join(site,manifestName),path.join(corrupt,manifestName));
  fs.unlinkSync(path.join(corrupt,'app-core.js'));fs.symlinkSync(path.join(site,'app-core.js'),path.join(corrupt,'app-core.js'));
  rejects('symlink-runtime',()=>validateSite(corrupt),/regular files/);

  git('-c','user.name=Verification fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-qm','Merged identical source');
  const mainCommit=git('rev-parse','HEAD'),promoted=path.join(temporary,'promoted');
  assert.notEqual(mainCommit,testedCommit);assert.equal(git('rev-parse','HEAD^{tree}'),tree);
  promoteSite({cwd:workspace,verifiedDirectory:site,outputDirectory:promoted,commit:mainCommit,runId:'456'});
  const promotedManifest=validateSite(promoted);
  for(const name of runtimePaths)assert.deepEqual(fs.readFileSync(path.join(site,name)),fs.readFileSync(path.join(promoted,name)));
  assert.equal(promotedManifest.sourceCommit,mainCommit);assert.equal(promotedManifest.workflowRunIdentity,'456');
  const expectedManifest=clone(manifest);expectedManifest.sourceCommit=mainCommit;expectedManifest.workflowRunIdentity='456';expectedManifest.manifestDigest=promotedManifest.manifestDigest;
  assert.deepEqual(promotedManifest,expectedManifest);cases.push('different-merge-commit-identical-runtime-only-provenance-changed');
  sealSite({cwd:workspace,directory:promoted,bundleDirectory:path.join(temporary,'main-bundle'),context:{...context,event:'push',commit:mainCommit,runId:'456',headSha:mainCommit,reusedFrom:{runId:'123',sourceTree:tree}}});
  cases.push('promoted-main-artifact-reproducible');

  // Exercise the actual selection/reuse CLI against a recorded-shape GitHub
  // fixture. This never queries GitHub or starts a workflow.
  const responseFile=path.join(temporary,'api.json'),shim=path.join(temporary,'fetch-fixture.mjs'),eventFile=path.join(temporary,'event.json'),outputFile=path.join(temporary,'outputs');
  fs.writeFileSync(eventFile,'{}');
  fs.writeFileSync(shim,`import fs from 'node:fs';globalThis.fetch=async value=>{const u=new URL(value);if(u.origin!=='https://api.github.com')throw new Error('Unexpected API origin');const responses=JSON.parse(fs.readFileSync(process.env.VERIFY_API_FIXTURE,'utf8'));if(!(u.pathname in responses))throw new Error('Unexpected API request: '+u.pathname);if(u.pathname.endsWith('/runs')&&u.searchParams.get('head_sha')!=='${headSha}')throw new Error('PR head filter missing');return {ok:true,status:200,json:async()=>responses[u.pathname]};};`);
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
  const runCLI=mode=>execFileSync(process.execPath,['--import',shim,path.join(root,'verified-site.mjs'),mode],{cwd:workspace,env:fixtureEnv,stdio:'pipe',encoding:'utf8'});
  const writeResponses=()=>fs.writeFileSync(responseFile,JSON.stringify(responses));
  writeResponses();runCLI('select');
  assert.match(fs.readFileSync(outputFile,'utf8'),/artifact_id=789/);
  fs.cpSync(bundle,path.join(workspace,'_verified-pr'),{recursive:true});
  runCLI('reuse');assert.match(fs.readFileSync(outputFile,'utf8'),/reused=true/);
  for(const name of runtimePaths)assert.deepEqual(fs.readFileSync(path.join(workspace,'_site',name)),fs.readFileSync(path.join(site,name)));
  cases.push('main-selects-and-reuses-passing-artifact-through-actual-CLI-mocked-API');
  fs.writeFileSync(outputFile,'');responses[prefix+'/git/commits/'+testedCommit].tree.sha='b'.repeat(40);writeResponses();
  assert.match(runCLI('reuse'),/Full verification is required/);assert.doesNotMatch(fs.readFileSync(outputFile,'utf8'),/reused=true/);
  cases.push('changed-merge-tree-falls-back-to-full-checks');
  responses[prefix+'/git/commits/'+testedCommit].tree.sha=tree;
  responses[prefix+'/actions/runs/123'].run_attempt=2;writeResponses();
  rejects('changed-run-attempt-during-download',()=>runCLI('reuse'),/attempt changed/);
  responses[prefix+'/actions/runs/123'].run_attempt=1;
  responses[prefix+'/actions/runs/123/artifacts'].artifacts[0].expired=true;writeResponses();fs.writeFileSync(outputFile,'');
  assert.match(runCLI('select'),/No complete reusable PR artifact/);assert.equal(fs.existsSync(path.join(workspace,'.verified-candidate.json')),false);assert.equal(fs.readFileSync(outputFile,'utf8'),'');
  cases.push('expired-artifact-falls-back-to-full-checks');

  fs.appendFileSync(path.join(workspace,'app-core.js'),'\n/* untested source */');
  rejects('dirty-source',()=>promoteSite({cwd:workspace,verifiedDirectory:site,outputDirectory:promoted,commit:mainCommit,runId:'456'}),/tracked source changes/);
  git('add','app-core.js');git('-c','user.name=Verification fixture','-c','user.email=fixture@example.invalid','commit','-qm','Changed main runtime');
  rejects('changed-merged-source',()=>promoteSite({cwd:workspace,verifiedDirectory:site,outputDirectory:promoted,commit:git('rev-parse','HEAD'),runId:'456'}),/differs/);
  assert.deepEqual(fs.readFileSync(path.join(promoted,'app-core.js')),fs.readFileSync(path.join(site,'app-core.js')),'Failed promotion must not overwrite the last intact artifact.');

  const workflow=fs.readFileSync('.github/workflows/pages.yml','utf8');
  for(const name of fullTestSteps){
    const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const step=workflow.match(new RegExp('^      - name: '+escaped+'\\n(?:(?!      - ).*(?:\\n|$))*','m'))?.[0];
    assert.ok(step,`Required gate missing from workflow: ${name}`);
    if(!['Verified artifact reuse checks','Seal verified deployment artifact'].includes(name))assert.match(step,/if: steps\.reuse\.outputs\.reused != 'true'/,'Only proven reuse may skip a full check.');
    else assert.doesNotMatch(step,/^        if:/m,'The artifact contract and final seal must always run.');
  }
  assert.ok(workflow.indexOf('name: Seal verified deployment artifact')>workflow.indexOf('name: Shared production faults, bounded sequences, and executed observations'));
  assert.match(workflow,/include-hidden-files: true/);
  assert.match(workflow,/name: \$\{\{ needs\.test\.outputs\.verified_artifact_name \}\}/,'Live verification must retain the successful test attempt artifact on job reruns.');
  assert.match(workflow,/VERIFIED_SITE_DIR: _verified-site\/site/);
  cases.push('all-original-gates-retained-before-artifact-publication');
  console.log(JSON.stringify({verifiedSiteReuse:'PASS',cases:cases.length,checks:cases,fullCIRun:false}));
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
