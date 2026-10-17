import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(process.argv[2]||'.');process.chdir(root);
const {runVerifier,detectedFault}=await import(pathToFileURL(path.join(root,'verify-conformance-regressions.mjs')));
const {verificationCatalog}=await import(pathToFileURL(path.join(root,'verification-evidence-catalog.mjs')));
const {sha}=await import(pathToFileURL(path.join(root,'verification-evidence.mjs')));
const {assertWorkflowPreloadBoundaries,assertLifecycleWorkflowCommand}=await import(pathToFileURL(path.join(root,'verified-site.mjs')));
async function verifyColdUploadBootstrap(workflow,directory,bootstrapNode=process.env.CLOSED_LOOP_ACTION_NODE||process.execPath){
  const actions=assertWorkflowPreloadBoundaries(workflow);
  assert.equal(actions.length,18,'COLD_UPLOAD_ORACLE: the maintained upload action population changed.');
  assert(actions.every(row=>row.nodeOptions===''),'COLD_UPLOAD_ORACLE: upload environments must share the empty Node options.');
  const workspace=path.join(directory,'cold-upload');fs.mkdirSync(workspace);
  const inherited=actions.find(row=>row.job==='test')?.inheritedNodeOptions;
  assert(inherited,'COLD_UPLOAD_ORACLE: failed prerequisite job must retain its repository producer preload.');
  const missingPreload=path.join(workspace,'verification-evidence-preload.mjs'),marker=path.join(workspace,'cleanup-body-reached.json');
  const action=`const fs=require('node:fs');if(fs.existsSync('verification-evidence-preload.mjs'))throw new Error('COLD_WORKSPACE_ORACLE');fs.writeFileSync('cleanup-body-reached.json','true');console.log(JSON.stringify({cleanupBodyExecuted:true,repositoryInitiallyAbsent:true,runtime:process.version}));`;
  // One actual Node failure/control pair covers the identical empty environment
  // of all upload actions; the table retains every workflow job/step identity.
  const before=await runVerifier(bootstrapNode,['-e',action],{cwd:workspace,env:{...process.env,NODE_OPTIONS:inherited.replaceAll('${{ github.workspace }}',workspace)}});
  assert.equal(before.status,1,'COLD_UPLOAD_ORACLE: former inherited preload must fail before the cleanup action body.');
  assert.match(before.stderr,/ERR_MODULE_NOT_FOUND/);assert(before.stderr.includes(missingPreload));
  assert.equal(fs.existsSync(marker),false,'COLD_UPLOAD_ORACLE: defective preload unexpectedly reached cleanup.');
  const after=await runVerifier(bootstrapNode,['-e',action],{cwd:workspace,env:{...process.env,NODE_OPTIONS:actions[0].nodeOptions}});
  assert.equal(after.status,0,'COLD_UPLOAD_ORACLE: scoped upload environment must bootstrap without repository files: '+after.stderr);
  const report=JSON.parse(after.stdout);assert.equal(report.cleanupBodyExecuted,true);assert.equal(report.repositoryInitiallyAbsent,true);
  assert.equal(fs.readFileSync(marker,'utf8'),'true');assert.equal(fs.existsSync(missingPreload),false);
  return {result:'PASS',actions,actionRuntime:report.runtime,formerInheritedExit:before.status,formerCleanupBodyExecuted:false,cleanupExit:after.status,cleanupBodyExecuted:true,repositoryInitiallyAbsent:true,sharedEnvironmentGroups:1,nodeInvocations:2,actualArtifactUpload:false};
}

const owner=fs.readFileSync('verify-executed-evidence.mjs','utf8');
const start=owner.indexOf('async function verifyColdUploadBootstrap('),end=owner.indexOf('\nconst ownershipSuites=',start);
assert.equal(owner.slice(start,end).trim(),verifyColdUploadBootstrap.toString().trim(),'COLD_UPLOAD_EXTRACTED_OWNER_BODY_ORACLE');
const visibilityStart=owner.indexOf('async function verifyPreloadFailureVisibility('),visibilityEnd=owner.indexOf('async function verifyColdUploadBootstrap(',visibilityStart);
assert(visibilityStart>=0&&visibilityEnd>visibilityStart,'PRELOAD_VISIBILITY_EXTRACTED_OWNER_SETUP_ORACLE');
const verifyPreloadFailureVisibility=Function('fs','path','assert','pathToFileURL','runVerifier','verificationCatalog','sha','detectedFault','return ('+owner.slice(visibilityStart,visibilityEnd).trim()+')')(fs,path,assert,pathToFileURL,runVerifier,verificationCatalog,sha,detectedFault);
const workflow=fs.readFileSync('.github/workflows/pages.yml','utf8'),cases=[];
async function rejects(name,operation,expected){await assert.rejects(async()=>await operation(),expected);cases.push(name);}
assertLifecycleWorkflowCommand(workflow);
  const uploadSteps=[...workflow.matchAll(/^      - [\s\S]*?(?=^      - |^  [a-z][\w-]*:\n|(?![\s\S]))/gm)].map(match=>match[0]).filter(step=>/^        uses: actions\/upload-artifact@/m.test(step));
  assert.equal(uploadSteps.length,18,'CI_UPLOAD_PRELOAD_ORACLE: all maintained artifact upload actions must be covered.');
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

async function verifyLifecycleWrapperOrdering(directory){
 const before="// Run the complete lifecycle suite with its explicit host and production dependencies.\nimport './verify-project-lifecycle-full.mjs';\nimport './verify-workflow-focus.mjs';\n",expected="// Run the complete lifecycle suite with its explicit host and production dependencies.\n// The lifecycle owner temporarily observes the host Blob prototype. Wait for\n// it to restore that observer before sibling focus fixtures hash their Blobs.\nawait import('./verify-project-lifecycle-full.mjs');\nawait import('./verify-workflow-focus.mjs');\n";
 const candidate=fs.readFileSync('verify-project-lifecycle.mjs','utf8');
 assert.equal(candidate,expected,'LIFECYCLE_WRAPPER_EXACT_SOURCE_ORACLE');
 const wrapperDirectory=path.join(directory,'wrapper-order');fs.mkdirSync(wrapperDirectory);
 const owner="globalThis.__lifecycleObserverActive=true;globalThis.__lifecycleOrder=['owner-start'];await new Promise(resolve=>setTimeout(resolve,30));globalThis.__lifecycleObserverActive=false;globalThis.__lifecycleOrder.push('owner-restored');\n";
 const focus="import assert from 'node:assert/strict';assert.equal(globalThis.__lifecycleObserverActive,false,'LIFECYCLE_WRAPPER_FOREIGN_OBSERVER_OVERLAP_ORACLE');globalThis.__lifecycleOrder.push('focus-start');console.log(JSON.stringify({observerActiveAtFocus:false,order:globalThis.__lifecycleOrder}));\n";
 fs.writeFileSync(path.join(wrapperDirectory,'verify-project-lifecycle-full.mjs'),owner);fs.writeFileSync(path.join(wrapperDirectory,'verify-workflow-focus.mjs'),focus);
 const run=async(source,name)=>{const target=path.join(wrapperDirectory,name+'.mjs');fs.writeFileSync(target,source);return runVerifier(process.execPath,[target],{cwd:wrapperDirectory,env:{...process.env,NODE_OPTIONS:'',CLOSED_LOOP_VERIFICATION_RECEIPTS:''}});};
 const former=await run(before,'former-static');assert.equal(former.status,1,'LIFECYCLE_WRAPPER_STATIC_NEGATIVE_EXIT_ORACLE');assert.match(former.stderr,/LIFECYCLE_WRAPPER_FOREIGN_OBSERVER_OVERLAP_ORACLE/);
 const ordered=await run(candidate,'candidate-ordered');assert.equal(ordered.status,0,'LIFECYCLE_WRAPPER_ORDERED_EXIT_ORACLE: '+ordered.stderr);const result=JSON.parse(ordered.stdout);assert.equal(result.observerActiveAtFocus,false);assert.deepEqual(result.order,['owner-start','owner-restored','focus-start'],'LIFECYCLE_WRAPPER_ACTUAL_ORDER_ORACLE');
 const reversed=candidate.replace("await import('./verify-project-lifecycle-full.mjs');\nawait import('./verify-workflow-focus.mjs');","await import('./verify-workflow-focus.mjs');\nawait import('./verify-project-lifecycle-full.mjs');");assert.notEqual(reversed,candidate,'LIFECYCLE_WRAPPER_ORDER_MUTATION_SETUP_ORACLE');const wrong=await run(reversed,'reversed-order');assert.equal(wrong.status,1,'LIFECYCLE_WRAPPER_REVERSED_EXIT_ORACLE');assert.match(wrong.stderr,/LIFECYCLE_WRAPPER_FOREIGN_OBSERVER_OVERLAP_ORACLE/);
 return {scope:'Native Node ESM exact wrapper bytes with isolated observer/focus modules; no application/full wrapper execution',runtime:process.version,sourceSha256:createHash('sha256').update(candidate).digest('hex'),beforeSha256:createHash('sha256').update(before).digest('hex'),formerStaticRejected:true,orderedCandidatePassed:true,reversedOrderRejected:true,observerActiveAtFocus:result.observerActiveAtFocus,order:result.order};
}

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-upload-preflight-'));
try{const preloadFailureVisibilityControl=await verifyPreloadFailureVisibility(directory);const lifecycleWrapperOrdering=await verifyLifecycleWrapperOrdering(directory);const coldUploadControl=await verifyColdUploadBootstrap(workflow,directory);console.log(JSON.stringify({scope:'CI uploader isolation + exact lifecycle wrapper native ESM ordering controls; no artifact upload/full application producer',runtime:process.version,cases,coldUploadControl,lifecycleWrapperOrdering,preloadFailureVisibilityControl,sourceHashes:Object.fromEntries(['.github/workflows/pages.yml','verified-site.mjs','verify-verified-site.mjs','verify-executed-evidence.mjs'].map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]))},null,2));}finally{fs.rmSync(directory,{recursive:true,force:true});}
