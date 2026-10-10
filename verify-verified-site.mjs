import {checkedVerifier,runVerifier,assertDetectedFault} from './verify-conformance-regressions.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import {runtimePaths,manifestName,fullTestSteps,digest,validateSite,assertLifecycleWorkflowCommand,assertPassedRun,assertReceipt,promoteSite,promoteExecutedProofs,executedProofFileHashes,sealSite} from './verified-site.mjs';
import {verificationCatalog} from './verification-evidence-catalog.mjs';

const root=process.cwd(),temporary=fs.mkdtempSync(path.join(root,'.verify-artifact-'));
const cases=[];
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
  (await rejects('missing-required-step',()=>assertPassedRun(run,[{...jobs[0],steps:jobs[0].steps.slice(1)},jobs[1]],bindings),/did not pass/));
  (await rejects('duplicate-test-job',()=>assertPassedRun(run,[...jobs,...jobs],bindings),/Required test job/));
  (await rejects('missing-deferred-matrix-job',()=>assertPassedRun(run,[jobs[0]],bindings),/Required deferred matrix job/));
  for(const conclusion of ['failure','skipped',null]){
    const altered=clone(jobs);altered[1].conclusion=conclusion;
    (await rejects(`unpassed-deferred-matrix-${conclusion}`,()=>assertPassedRun(run,altered,bindings),/Required deferred matrix job/));
  }
  (await rejects('missing-deferred-matrix-step',()=>assertPassedRun(run,[jobs[0],{...jobs[1],steps:[]}],bindings),/Required complete deferred matrix/));
  (await rejects('missing-deferred-matrix-upload',()=>assertPassedRun(run,[jobs[0],{...jobs[1],steps:jobs[1].steps.slice(0,1)}],bindings),/Required complete deferred matrix/));

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
  for(const name of [...runtimePaths,'build-static-site.mjs','deployment-contract-identities.mjs','.github/workflows/pages.yml'])fs.copyFileSync(path.join(root,name),path.join(workspace,name));
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
  (await sealSite({cwd:workspace,directory:promoted,bundleDirectory:path.join(temporary,'main-bundle'),context:{...context,event:'push',commit:mainCommit,runId:'456',headSha:mainCommit,reusedFrom:{runId:'123',sourceTree:tree}}}));
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
  const runCLI=async mode=>(await checkedVerifier(process.execPath,['--import',shim,path.join(root,'verified-site.mjs'),mode],{cwd:workspace,env:fixtureEnv,stdio:'pipe',encoding:'utf8'}));
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

  fs.appendFileSync(path.join(workspace,'app-core.js'),'\n/* untested source */');
  (await rejects('dirty-source',async ()=>(await promoteSite({cwd:workspace,verifiedDirectory:site,outputDirectory:promoted,commit:mainCommit,runId:'456'})),/tracked source changes/));
  git('add','app-core.js');git('-c','user.name=Verification fixture','-c','user.email=fixture@example.invalid','commit','-qm','Changed main runtime');
  (await rejects('changed-merged-source',async ()=>(await promoteSite({cwd:workspace,verifiedDirectory:site,outputDirectory:promoted,commit:git('rev-parse','HEAD'),runId:'456'})),/differs/));
  assert.deepEqual(fs.readFileSync(path.join(promoted,'app-core.js')),fs.readFileSync(path.join(site,'app-core.js')),'Failed promotion must not overwrite the last intact artifact.');

  const workflow=fs.readFileSync('.github/workflows/pages.yml','utf8');
  const nodeVersions=[...workflow.matchAll(/^          node-version: '([^']+)'$/gm)].map(match=>match[1]);
  assert.equal(nodeVersions.length,4,'CI_RUNTIME_IDENTITY_ORACLE: every proof job must select Node explicitly.');
  assert(nodeVersions.every(version=>/^22\.\d+\.\d+$/.test(version)&&version===nodeVersions[0]),'CI_RUNTIME_IDENTITY_ORACLE: all proof jobs require the same exact supported Node version.');
  const deferredDiagnostics=workflow.match(/      - name: Preserve deferred matrix diagnostics\n([\s\S]*?)(?=\n      - name:|\n  [a-z])/);
  assert(deferredDiagnostics,'CI_DEFERRED_DIAGNOSTICS_ORACLE: deferred diagnostics upload is required.');
  assert.match(deferredDiagnostics[1],/path: \.ci-deferred-diagnostics\//);
  assert.match(deferredDiagnostics[1],/include-hidden-files: true/,'CI_DEFERRED_DIAGNOSTICS_ORACLE: the hidden diagnostic directory must be included.');
  cases.push('exact-runtime-and-visible-deferred-diagnostics');
  const testWorkflow=workflow.slice(workflow.indexOf('\n  test:'),workflow.indexOf('\n  deploy:'));
  assertLifecycleWorkflowCommand(workflow);
  const deferredBlock=workflow.slice(workflow.indexOf('\n  deferred-matrix:\n'),workflow.indexOf('\n  test:\n'));
  for(const [name,alter,diagnostic] of [
    ['missing-job',text=>text.replace(deferredBlock,''),/deferred matrix proof job/],
    ['missing-producer',text=>text.replace('node verify-due-stage-timing.mjs > /tmp/deferred-stage-matrix.json','node missing-deferred-matrix.mjs'),/complete deferred matrix execution/],
    ['missing-dependency',text=>text.replace('    needs: deferred-matrix\n',''),/deferred matrix proof dependency/],
    ['missing-receipt-validation',text=>text.replace('name: Validate complete deferred matrix receipt','name: Skip deferred matrix validation'),/deferred matrix proof dependency/],
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
  const promptAt=workflow.indexOf(promptHeading),fullAt=workflow.indexOf(fullHeading),sharedAt=workflow.indexOf('      - name: Shared production faults, bounded sequences, and executed observations\n');
  assert(promptAt>=0&&fullAt>promptAt&&sharedAt>fullAt,'CI_PROOF_ORDER_SETUP_ORACLE: required current proof steps are missing.');
  for(const [name,alter,diagnostic] of [
    ['contract-missing',text=>text.replace(contractLine,''),/Contract-closure/],
    ['contract-duplicate',text=>text.replace(contractLine,contractLine+contractLine),/Contract-closure/],
    ['contract-after-migration',text=>text.replace(contractLine+migrationLine,migrationLine+contractLine),/Contract-closure/],
    ['early-infrastructure',text=>text.replace('          node verify-data-route-closure.mjs\n','          node verify-data-route-closure.mjs\n          node verify-infrastructure-route-closure.mjs\n'),/Infrastructure route/],
    ['full-cycle-missing',text=>text.replace(fullCycleLine,''),/Full-cycle and Stage 30/],
    ['terminal-duplicate',text=>text.replace(terminalLine,terminalLine+terminalLine),/Full-cycle and Stage 30/],
    ['prompt-after-full-cycle',text=>text.slice(0,promptAt)+text.slice(fullAt,sharedAt)+text.slice(promptAt,fullAt)+text.slice(sharedAt),/specification order/]
  ]){const changed=alter(workflow);assert.notEqual(changed,workflow,`CI_PROOF_ORDER_SETUP_ORACLE: ${name} mutation did not apply.`);(await rejects(`proof-order-${name}`,()=>assertLifecycleWorkflowCommand(changed),diagnostic));}
  cases.push('workflow-proof-order-and-direct-owner-mutations');
  assert.equal((testWorkflow.match(/^          node build-test-project\.mjs$/gm)||[]).length,1,'CI_DUPLICATE_FIXTURE_ORACLE: retained fixture verification runs once');
  const conformancePosition=testWorkflow.indexOf('name: Shared production faults, bounded sequences, and executed observations');
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
  for(const name of fullTestSteps){
    const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const step=workflow.match(new RegExp('^      - name: '+escaped+'\\n(?:(?!      - ).*(?:\\n|$))*','m'))?.[0];
    assert.ok(step,`Required gate missing from workflow: ${name}`);
    if(!['Require successful deferred matrix job','Verified artifact reuse checks','Collect current executed assertion evidence','Seal verified deployment artifact'].includes(name))assert.match(step,/if: steps\.reuse\.outputs\.reused != 'true'/,'Only proven reuse may skip a full check.');
    else assert.doesNotMatch(step,/^        if:/m,'The matrix gate, artifact contract, and final seal must always run.');
  }
  assert.ok(workflow.indexOf('name: Seal verified deployment artifact')>workflow.indexOf('name: Shared production faults, bounded sequences, and executed observations'));
  assert.ok(workflow.indexOf('name: Collect current executed assertion evidence')>workflow.indexOf('name: Shared production faults, bounded sequences, and executed observations'));
  assert.ok(workflow.indexOf('name: Seal verified deployment artifact')>workflow.indexOf('name: Collect current executed assertion evidence'));
  assert.match(workflow,/include-hidden-files: true/);
  assert.match(workflow,/name: \$\{\{ needs\.test\.outputs\.verified_artifact_name \}\}/,'Live verification must retain the successful test attempt artifact on job reruns.');
  assert.match(workflow,/VERIFIED_SITE_DIR: _verified-site\/site/);
  cases.push('all-original-gates-retained-before-artifact-publication');
  console.log(JSON.stringify({verifiedSiteReuse:'PASS',cases:cases.length,checks:cases,fullCIRun:false}));
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
