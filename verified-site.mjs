import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import './hash.js';

const hash=globalThis.closedLoopHash;
export const manifestName='closed-loop-deployment-manifest.json';
export const runtimePaths=['index.html','workbook.js','hash.js','workflow-schema.js','test-runtime.js','test-worker.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js','TEST_PROJECT.json','.nojekyll'];
export const fullTestSteps=[
  'Verified artifact reuse checks','Syntax','Verification routing and capability evidence','Startup and scrolling at phone and desktop sizes',
  'Acceptance viewport regression and targeted layout fault','Deployment manifest, build identity, and reproducibility',
  'Physical iPhone release-tag governance','Schema, ownership, and single-architecture proof',
  'Complete 30-stage canonical data-route closure','Migration and v3 contracts',
  'Stage 01 raw intake and semantic accounting','Stage 04 obligation accounting and prompt completeness',
  'Test IR validation, security, and deterministic runtime','Raw-first ingestion and negative cases',
  'Workflow, gates, and full cycle','Project lifecycle and application-owned controls','Prompt semantics and leakage',
  'Build static application for operator verification','Local Chromium operator path',
  'Shared production faults, bounded sequences, and executed observations','Seal verified deployment artifact'
];
export const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const requireValue=(condition,message)=>{if(!condition)throw new Error(message);};
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const writeJson=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
const artifactName=(run,attempt)=>`verified-site-${run}-${attempt}`;
const output=(name,value)=>{if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`${name}=${value}\n`);};

export function validateSite(directory){
  const names=fs.readdirSync(directory).sort();
  requireValue(JSON.stringify(names)===JSON.stringify([...runtimePaths,manifestName].sort()),'Verified artifact contains missing or unexpected files.');
  for(const name of names)requireValue(fs.lstatSync(path.join(directory,name)).isFile(),'Verified artifact must contain regular files only.');
  const manifest=readJson(path.join(directory,manifestName)),unsigned={...manifest};delete unsigned.manifestDigest;
  requireValue(manifest.schema==='closed-loop-deployment-manifest/1','Invalid deployment manifest schema.');
  requireValue(manifest.manifestDigest?.hashAlgorithm==='SHA-256'&&manifest.manifestDigest.digest===hash.sha256Value(unsigned),'Deployment manifest digest mismatch.');
  requireValue(manifest.canonicalOrigin==='https://sjonesjones917.github.io'&&manifest.canonicalHost==='sjonesjones917.github.io'&&manifest.canonicalBasePath==='/closed-loop-tracker/'&&manifest.deploymentEnvironment==='github-pages','Wrong deployment origin or environment.');
  requireValue(manifest.noCrossOriginRedirect===true&&manifest.permittedRuntimeOrigin==='SAME_ORIGIN_ONLY','Invalid deployment origin policy.');
  requireValue(Array.isArray(manifest.runtimeResources)&&JSON.stringify(manifest.runtimeResources.map(r=>r.path).sort())===JSON.stringify([...runtimePaths].sort()),'Incomplete or duplicate runtime resource graph.');
  for(const resource of manifest.runtimeResources){
    const bytes=fs.readFileSync(path.join(directory,resource.path));
    requireValue(resource.hashAlgorithm==='SHA-256'&&resource.digest===digest(bytes)&&resource.byteSize===bytes.length&&resource.buildIdentity===manifest.buildIdentity,`Changed verified runtime file: ${resource.path}`);
  }
  return manifest;
}

export function assertRuntimeEqual(first,second){
  const a=validateSite(first),b=validateSite(second);
  requireValue(a.buildIdentity===b.buildIdentity,'Merged runtime build identity differs from the tested artifact.');
  for(const name of runtimePaths)requireValue(fs.readFileSync(path.join(first,name)).equals(fs.readFileSync(path.join(second,name))),`Merged runtime bytes differ from the tested artifact: ${name}`);
}

export function assertPassedRun(run,jobs,{repository,headSha,workflowId}){
  requireValue(run.event==='pull_request'&&run.status==='completed'&&run.conclusion==='success','PR verification is not successfully completed.');
  requireValue(run.repository?.full_name===repository&&run.head_repository?.full_name===repository&&run.head_sha===headSha,'PR verification repository or head mismatch.');
  requireValue(run.workflow_id===workflowId&&run.path==='.github/workflows/pages.yml','PR verification used a different workflow.');
  const tests=jobs.filter(job=>job.name==='test');
  requireValue(tests.length===1&&tests[0].status==='completed'&&tests[0].conclusion==='success','Required test job has not passed.');
  for(const name of fullTestSteps){
    const steps=tests[0].steps.filter(step=>step.name===name);
    requireValue(steps.length===1&&steps[0].status==='completed'&&steps[0].conclusion==='success',`Required PR verification did not pass: ${name}`);
  }
}

export function assertReceipt(receipt,manifest,{run,repository,headSha,sourceCommit,sourceTree,workflowDigest}){
  requireValue(receipt.schema==='closed-loop-verified-site/1'&&receipt.repository===repository,'Verified artifact receipt identity mismatch.');
  requireValue(String(receipt.runId)===String(run.id)&&Number(receipt.runAttempt)===run.run_attempt&&receipt.headSha===headSha&&receipt.event==='pull_request','Verified artifact receipt does not belong to the passing PR attempt.');
  requireValue(receipt.sourceCommit===sourceCommit&&receipt.sourceTree===sourceTree,'Verified artifact source tree mismatch.');
  requireValue(manifest.sourceCommit===sourceCommit&&String(manifest.workflowRunIdentity)===String(run.id),'Artifact manifest does not belong to the passing PR run.');
  requireValue(manifest.workflowFileSha256===workflowDigest&&receipt.workflowFileSha256===workflowDigest,'Verified workflow differs from the merged workflow.');
  requireValue(receipt.manifestDigest===manifest.manifestDigest.digest&&receipt.buildIdentity===manifest.buildIdentity,'Verified artifact receipt manifest mismatch.');
}

function assertCleanSource(cwd){
  const changes=git(cwd,'diff','--name-only','HEAD','--').split('\n').filter(Boolean);
  requireValue(changes.every(name=>name==='TEST_PROJECT.json'),'Verification left tracked source changes outside the generated retained fixture.');
}

function build(cwd,directory,commit,run){
  execFileSync(process.execPath,['build-static-site.mjs','--out',directory,'--source-commit',commit,'--workflow-run',String(run)],{cwd,stdio:'pipe'});
}

export function promoteSite({cwd,verifiedDirectory,outputDirectory,commit,runId}){
  // Only the deterministic retained fixture is generated by the tests. All
  // other runtime input must come from the matching, checked-out main tree.
  validateSite(verifiedDirectory);
  assertCleanSource(cwd);
  const fixture=path.join(cwd,'TEST_PROJECT.json'),originalFixture=fs.readFileSync(fixture);
  const rebuilt=fs.mkdtempSync(path.join(cwd,'.verified-rebuild-'));
  let promoted=false;
  try{
    fs.copyFileSync(path.join(verifiedDirectory,'TEST_PROJECT.json'),fixture);
    build(cwd,rebuilt,commit,runId);
    assertRuntimeEqual(verifiedDirectory,rebuilt);
    fs.rmSync(outputDirectory,{recursive:true,force:true});
    fs.cpSync(verifiedDirectory,outputDirectory,{recursive:true});
    // Preserve every tested runtime byte. Only deployment provenance changes:
    // main commit/run identity, declared toolchain, and the manifest digest.
    fs.copyFileSync(path.join(rebuilt,manifestName),path.join(outputDirectory,manifestName));
    validateSite(outputDirectory);
    promoted=true;
  }finally{
    if(!promoted)fs.writeFileSync(fixture,originalFixture);
    fs.rmSync(rebuilt,{recursive:true,force:true});
  }
}

export function sealSite({cwd,directory,bundleDirectory,context}){
  assertCleanSource(cwd);
  const manifest=validateSite(directory);
  requireValue(manifest.sourceCommit===context.commit&&String(manifest.workflowRunIdentity)===String(context.runId),'Site does not belong to this verification run.');
  const rebuilt=fs.mkdtempSync(path.join(cwd,'.verified-seal-'));
  try{
    build(cwd,rebuilt,context.commit,context.runId);
    assertRuntimeEqual(directory,rebuilt);
    requireValue(fs.readFileSync(path.join(directory,manifestName)).equals(fs.readFileSync(path.join(rebuilt,manifestName))),'Verified deployment manifest is not reproducible.');
  }finally{fs.rmSync(rebuilt,{recursive:true,force:true});}
  fs.rmSync(bundleDirectory,{recursive:true,force:true});
  fs.mkdirSync(bundleDirectory,{recursive:true});
  fs.cpSync(directory,path.join(bundleDirectory,'site'),{recursive:true});
  const receipt={schema:'closed-loop-verified-site/1',repository:context.repository,event:context.event,
    sourceCommit:context.commit,sourceTree:git(cwd,'rev-parse','HEAD^{tree}'),headSha:context.headSha,
    runId:String(context.runId),runAttempt:context.runAttempt,workflowFileSha256:manifest.workflowFileSha256,
    manifestDigest:manifest.manifestDigest.digest,buildIdentity:manifest.buildIdentity,
    ...(context.reusedFrom?{reusedFrom:context.reusedFrom}:{})};
  writeJson(path.join(bundleDirectory,'receipt.json'),receipt);
  return receipt;
}

function context(){
  const env=process.env,event=env.GITHUB_EVENT_PATH?readJson(env.GITHUB_EVENT_PATH):{};
  requireValue(/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY||'')&&/^[0-9a-f]{40}$/.test(env.GITHUB_SHA||'')&&/^\d+$/.test(env.GITHUB_RUN_ID||''),'GitHub verification context is unavailable.');
  requireValue(git(process.cwd(),'rev-parse','HEAD')===env.GITHUB_SHA,'Checkout does not match the workflow commit.');
  return {repository:env.GITHUB_REPOSITORY,commit:env.GITHUB_SHA,runId:env.GITHUB_RUN_ID,
    runAttempt:Number(env.GITHUB_RUN_ATTEMPT||1),event:env.GITHUB_EVENT_NAME,ref:env.GITHUB_REF,
    headSha:event.pull_request?.head?.sha||env.GITHUB_SHA};
}

async function api(context,suffix){
  requireValue(process.env.GH_TOKEN,'GitHub Actions read token is unavailable.');
  const response=await fetch(`https://api.github.com/repos/${context.repository}/${suffix}`,{headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(30000)});
  requireValue(response.ok,`GitHub verification lookup failed (${response.status}).`);
  return response.json();
}

async function selectCandidate(c){
  requireValue(c.event==='push'&&c.ref==='refs/heads/main','Verification reuse is restricted to a main push.');
  fs.rmSync('.verified-candidate.json',{force:true});
  const current=await api(c,`actions/runs/${c.runId}`);
  const prs=(await api(c,`commits/${c.commit}/pulls?per_page=100`)).filter(pr=>pr.merged_at&&pr.merge_commit_sha===c.commit&&pr.base.ref==='main'&&pr.base.repo.full_name===c.repository&&pr.head.repo?.full_name===c.repository);
  for(const pr of prs){
    const runs=(await api(c,`actions/workflows/${current.workflow_id}/runs?event=pull_request&status=success&head_sha=${pr.head.sha}&per_page=100`)).workflow_runs;
    for(const run of runs){
      const jobs=(await api(c,`actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`)).jobs;
      try{assertPassedRun(run,jobs,{repository:c.repository,headSha:pr.head.sha,workflowId:current.workflow_id});}catch{continue;}
      const artifacts=(await api(c,`actions/runs/${run.id}/artifacts?per_page=100`)).artifacts;
      const artifact=artifacts.find(item=>item.name===artifactName(run.id,run.run_attempt)&&!item.expired);
      if(!artifact)continue;
      writeJson('.verified-candidate.json',{runId:run.id,runAttempt:run.run_attempt,headSha:pr.head.sha,workflowId:current.workflow_id,artifactId:artifact.id,artifactName:artifact.name,prNumber:pr.number});
      output('run_id',run.id);output('artifact_id',artifact.id);
      console.log(`Found complete verification for PR #${pr.number}, run ${run.id}. Source and byte equality are still required.`);
      return;
    }
  }
  console.log('No complete reusable PR artifact found. This source requires the full verification job.');
}

async function reuseCandidate(c){
  requireValue(c.event==='push'&&c.ref==='refs/heads/main','Verification reuse is restricted to a main push.');
  const candidate=readJson('.verified-candidate.json');
  // Recheck the server state after downloading, including the exact attempt.
  const run=await api(c,`actions/runs/${candidate.runId}`);
  requireValue(run.run_attempt===candidate.runAttempt,'PR verification attempt changed during artifact retrieval.');
  const jobs=(await api(c,`actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`)).jobs;
  assertPassedRun(run,jobs,{repository:c.repository,headSha:candidate.headSha,workflowId:candidate.workflowId});
  const receipt=readJson('_verified-pr/receipt.json'),manifest=validateSite('_verified-pr/site');
  requireValue(/^[0-9a-f]{40}$/.test(receipt.sourceCommit||''),'Invalid tested source commit.');
  const source=await api(c,`git/commits/${receipt.sourceCommit}`);
  requireValue(source.sha===candidate.headSha||source.parents.some(parent=>parent.sha===candidate.headSha),'Tested source is not the selected PR head or its merge.');
  const mainTree=git(process.cwd(),'rev-parse','HEAD^{tree}');
  if(source.tree.sha!==mainTree){
    console.log('The merged tree differs from the tested PR tree. Full verification is required for the changed source.');
    return;
  }
  assertReceipt(receipt,manifest,{run,repository:c.repository,headSha:candidate.headSha,sourceCommit:source.sha,sourceTree:source.tree.sha,workflowDigest:digest(fs.readFileSync('.github/workflows/pages.yml'))});
  promoteSite({cwd:process.cwd(),verifiedDirectory:path.resolve('_verified-pr/site'),outputDirectory:path.resolve('_site'),commit:c.commit,runId:c.runId});
  writeJson('.verified-reuse.json',{...candidate,testedCommit:source.sha,sourceTree:mainTree,manifestDigest:manifest.manifestDigest.digest});
  output('reused','true');
  output('run_id',run.id);output('tested_commit',source.sha);
  console.log(`Reused successful PR #${candidate.prNumber}, run ${run.id}: identical Git tree and all ${runtimePaths.length} runtime files. Only deployment manifest provenance was rebound to main.`);
}

async function main(){
  const c=context();
  switch(process.argv[2]){
    case 'select':return selectCandidate(c);
    case 'reuse':return reuseCandidate(c);
    case 'seal':{
      if(fs.existsSync('.verified-reuse.json'))c.reusedFrom=readJson('.verified-reuse.json');
      const receipt=sealSite({cwd:process.cwd(),directory:path.resolve('_site'),bundleDirectory:path.resolve('_verified-site'),context:c});
      output('artifact_name',artifactName(c.runId,c.runAttempt));
      console.log(JSON.stringify({sealed:true,sourceCommit:receipt.sourceCommit,sourceTree:receipt.sourceTree,reusedFrom:receipt.reusedFrom||null}));return;
    }
    default:throw new Error('Expected select, reuse, or seal.');
  }
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)await main();
