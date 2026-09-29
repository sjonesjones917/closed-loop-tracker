import fs from 'node:fs';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const CONTROLLER_ID='closed-loop-monotonic-build-controller/2';
const CONTROLLER_TITLE='CLOSED-LOOP RELIABILITY APPLICATION / MONOTONIC IMPLEMENTATION CONTROLLER';
const LEDGER_SCHEMA='closed-loop-monotonic-implementation-ledger/1';
const STATE_PATH='verification/closed-loop-build-state.json';
const SPEC_PATH='specification/closed-loop-reliability-controlling-implementation-specification.txt';
const SPEC_MANIFEST_PATH='specification/closed-loop-specification-manifest.json';
const VALID_STATUS=new Set(['NOT_STARTED','IN_PROGRESS','BLOCKED','DONE']);
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const stageKey=n=>String(n).padStart(2,'0');
const isSha=value=>typeof value==='string'&&/^[0-9a-f]{40}$/.test(value);
const arrays=['changedFiles','specificationSections','testsActuallyRun','browserEvidence','deploymentEvidence','deviceEvidence','regressions','openAcceptanceItems'];
let historyPrepared=false;

function repositoryFiles(){
  const files=[];
  const walk=dir=>{
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      if(entry.name==='.git'||entry.name==='node_modules')continue;
      const file=dir==='.'?entry.name:`${dir}/${entry.name}`;
      if(entry.isDirectory())walk(file);else files.push(file);
    }
  };
  walk('.');
  return files;
}
function validateSingleLedger(paths){
  const ledgers=paths.filter(path=>/(^|\/)closed-loop-build-state\.json$/.test(path));
  assert(ledgers.length===1&&ledgers[0]===STATE_PATH,`Exactly one controller ledger is permitted at ${STATE_PATH}; found ${ledgers.join(', ')||'NONE'}.`);
}

function proveAncestor(commit){
  if(process.env.GITHUB_ACTIONS!=='true')return true;
  if(!historyPrepared){
    const shallow=cp.execFileSync('git',['rev-parse','--is-shallow-repository'],{encoding:'utf8'}).trim()==='true';
    const args=shallow?['fetch','--no-tags','--unshallow','origin','main']:['fetch','--no-tags','origin','main'];
    const fetch=cp.spawnSync('git',args,{stdio:'ignore'});
    assert(fetch.status===0,'Unable to fetch canonical main history for ledger ancestry verification.');
    historyPrepared=true;
  }
  return cp.spawnSync('git',['merge-base','--is-ancestor',commit,'HEAD'],{stdio:'ignore'}).status===0;
}


const REPOSITORY='sjonesjones917/closed-loop-tracker';
const WORKFLOW_PATH='.github/workflows/pages.yml';
const runCache=new Map(),replayCache=new Map(),sourceCache=new Set();
const observedExecutions=[];
const successful=value=>value?.status==='completed'&&value.conclusion==='success';

async function githubJson(suffix){
  const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'};
  const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
  if(token)headers.Authorization=`Bearer ${token}`;
  // Fixed origin and repository: ledger content cannot select an endpoint or
  // redirect a credential. Missing credentials/coverage never fall back to PASS.
  const response=await fetch(`https://api.github.com/repos/${REPOSITORY}/${suffix}`,{
    headers,redirect:'error',signal:AbortSignal.timeout(20000)
  });
  assert(response.ok,`Execution evidence unavailable: GitHub HTTP ${response.status} for ${suffix}.`);
  return response.json();
}

function validateRunnerEvidence(run,jobs,runId,commit){
  assert(run?.id===runId&&run.repository?.full_name===REPOSITORY,'Execution evidence repository/run mismatch.');
  assert(run.head_repository?.full_name===REPOSITORY,'Execution evidence came from another source repository.');
  assert(run.head_sha===commit,'Execution evidence commit mismatch.');
  assert(run.path===WORKFLOW_PATH&&run.event==='push'&&run.head_branch==='main','Execution evidence is not the canonical main deployment workflow.');
  assert(Number.isSafeInteger(run.run_attempt)&&run.run_attempt>0&&successful(run),'Execution evidence run is not a completed success.');
  const required={
    'test':['Local Chromium operator path'],
    'Deploy exact verified bytes':['Deploy application'],
    'Verify deployed bytes and operator path':['Exact deployed-byte verification','Deployed Chromium operator path']
  };
  for(const [name,steps] of Object.entries(required)){
    const matches=jobs.filter(job=>job.name===name);
    assert(matches.length===1,`Execution evidence requires exactly one ${name} job.`);
    const job=matches[0];
    assert(job.run_id===runId&&job.run_attempt===run.run_attempt&&job.head_sha===commit&&successful(job),`Execution evidence job ${name} is failed, stale, or mismatched.`);
    assert(Array.isArray(job.steps),`Execution evidence job ${name} has no steps.`);
    assert(job.steps.every(step=>successful(step)||(step?.status==='completed'&&step.conclusion==='skipped')),`Execution evidence job ${name} contains a failed or unfinished step.`);
    for(const stepName of steps){
      const matched=job.steps.filter(step=>step.name===stepName);
      assert(matched.length===1&&successful(matched[0]),`Execution evidence step ${stepName} was not successfully executed.`);
    }
  }
  return {runId,runAttempt:run.run_attempt,commit,jobs:jobs.map(job=>job.id)};
}

async function resolveRunnerEvidence(runId,commit){
  const key=`${runId}:${commit}`;
  if(!runCache.has(key))runCache.set(key,(async()=>{
    const run=await githubJson(`actions/runs/${runId}`),jobs=[];
    assert(Number.isSafeInteger(run.run_attempt)&&run.run_attempt>0,'Execution evidence has no current attempt.');
    for(let page=1;;page++){
      assert(page<=100,'Execution evidence job pagination exceeded its bound.');
      const data=await githubJson(`actions/runs/${runId}/attempts/${run.run_attempt}/jobs?per_page=100&page=${page}`);
      assert(Array.isArray(data.jobs)&&Number.isSafeInteger(data.total_count)&&data.total_count>=0,'Execution evidence job list is malformed.');
      jobs.push(...data.jobs);
      if(jobs.length===data.total_count)break;
      assert(data.jobs.length>0&&jobs.length<data.total_count,'Execution evidence job list is incomplete or inconsistent.');
    }
    // Reject a rerun started while the evidence was being fetched.
    const latest=await githubJson(`actions/runs/${runId}`);
    assert(latest.run_attempt===run.run_attempt&&successful(latest),'Execution evidence changed during verification.');
    return validateRunnerEvidence(latest,jobs,runId,commit);
  })());
  return runCache.get(key);
}

function assertCurrentSource(commit){
  if(sourceCache.has(commit))return;
  const git=args=>{
    const result=cp.spawnSync('git',args,{encoding:'utf8'});
    assert(result.status===0,'Cannot bind DONE evidence to the current git source.');
    return result.stdout.trim();
  };
  const head=git(['rev-parse','HEAD']);
  assert(isSha(head),'Current source commit is unavailable.');
  // A subsequent ledger/proof-record commit need not invalidate the code it
  // describes. No executable, workflow, fixture, or specification is exempt.
  const evidenceOnly=file=>file===STATE_PATH||/^verification\/build-stages\/stage-\d{2}-proof\.json$/.test(file);
  const changed=[
    ...git(['diff','--name-only',commit,head,'--']).split('\n'),
    ...git(['diff','--name-only','HEAD','--']).split('\n'),
    ...git(['ls-files','--others','--exclude-standard']).split('\n')
  ].filter(Boolean);
  assert(changed.every(evidenceOnly),`DONE execution evidence is stale or the source is dirty: ${changed.filter(file=>!evidenceOnly(file)).join(', ')}.`);
  sourceCache.add(commit);
}

function commandScripts(command,registered){
  assert(typeof command==='string'&&command.trim(),'Execution claim has no command.');
  return command.split(' && ').map(part=>{
    const match=/^node ((?:verification\/)?verify(?:-[a-z0-9-]+)?\.mjs)$/.exec(part);
    assert(match&&registered.has(match[1]),`Unregistered or unsafe execution claim: ${part}.`);
    return match[1];
  });
}

function replayNodeScript(script,cwd=process.cwd(),timeout=600000){
  const file=path.resolve(cwd,script),root=fs.realpathSync(cwd)+path.sep;
  assert(fs.existsSync(file)&&fs.lstatSync(file).isFile()&&fs.realpathSync(file).startsWith(root),`Execution claim script is missing or not a regular repository file: ${script}.`);
  const execution=cp.spawnSync(process.execPath,[file],{cwd,encoding:'utf8',shell:false,timeout,maxBuffer:128*1024*1024});
  assert(!execution.error&&execution.signal===null&&execution.status===0,
    `Recorded PASS contradicted by replay: node ${script}; exit=${execution.status}; signal=${execution.signal}; ${(execution.stderr||execution.error?.message||'').slice(-2000)}`);
  return {command:`node ${script}`,exitCode:execution.status,stdoutSha256:sha256(execution.stdout||''),stderrSha256:sha256(execution.stderr||'')};
}

async function verifyExecutionClaims(entry){
  assert(entry.testsActuallyRun.length>0,`Stage ${entry.stage} is DONE without execution references.`);
  const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');
  // This is only an allowlist of literal canonical CI commands, not a YAML
  // execution interpreter. Each allowed command is actually replayed below.
  const registered=new Set([...workflow.matchAll(/^\s+node ((?:verification\/)?verify(?:-[a-z0-9-]+)?\.mjs)(?=\s|$)/gm)].map(match=>match[1]));
  // These import this checker and cannot be used as their own evidence.
  registered.delete('verify-build-stage-ledger.mjs');
  registered.delete('verify-deployment-manifest.mjs');
  const scripts=new Set(),runIds=new Set();
  for(const claim of entry.testsActuallyRun){
    assert(claim&&claim.result==='PASS'&&claim.exitCode===0,`Stage ${entry.stage} contains a failed or malformed execution claim.`);
    for(const script of commandScripts(claim.command,registered))scripts.add(script);
    assert(Number.isSafeInteger(claim.runId)&&claim.runId>0,`Stage ${entry.stage} execution claim has no resolvable GitHub run ID.`);
    if(claim.evidence!==undefined)assert(claim.evidence===`https://github.com/${REPOSITORY}/actions/runs/${claim.runId}`,'A ledger-supplied evidence file is not execution authority.');
    runIds.add(claim.runId);
  }
  assertCurrentSource(entry.endCommit);
  for(const runId of runIds)await resolveRunnerEvidence(runId,entry.endCommit);
  for(const script of scripts){
    const key=`${entry.endCommit}:${script}`;
    if(!replayCache.has(key))replayCache.set(key,replayNodeScript(script));
    observedExecutions.push({stage:entry.stage,commit:entry.endCommit,runIds:[...runIds],...replayCache.get(key)});
  }
  // Reject source changes made by a verifier as well as changes made before it.
  sourceCache.delete(entry.endCommit);
  assertCurrentSource(entry.endCommit);
}

async function validateLedger(state,mutation=null){
  const specManifest=readJson(SPEC_MANIFEST_PATH);
  const specBytes=fs.readFileSync(SPEC_PATH);
  const s=structuredClone(state);
  if(mutation==='specification-digest-mismatch')s.specificationSha256='0'.repeat(64);
  if(mutation==='invalid-status')s.stages['01'].status='PROVEN';
  if(mutation==='skipped-stage'){
    s.stages['01'].status='NOT_STARTED';
    s.stages['01'].startCommit=null;
    s.stages['02'].status='DONE';
    s.stages['02'].startCommit=s.startingMainCommit;
    s.stages['02'].endCommit=s.startingMainCommit;
    s.stages['02'].testsActuallyRun=[{command:'intentional-invalid',result:'PASS',exitCode:0,evidence:'fixture'}];
    s.stages['02'].directEvidenceReviewed=true;
  }
  if(mutation==='false-done-open-item'){
    s.stages['01'].status='DONE';
    s.stages['01'].endCommit=s.startingMainCommit;
    s.stages['01'].testsActuallyRun=[{command:'intentional-invalid',result:'PASS',exitCode:0,evidence:'fixture'}];
    s.stages['01'].openAcceptanceItems=['still open'];
    s.stages['01'].directEvidenceReviewed=true;
  }
  if(mutation==='done-without-execution'){
    s.stages['01'].status='DONE';
    s.stages['01'].endCommit=s.startingMainCommit;
    s.stages['01'].testsActuallyRun=[];
    s.stages['01'].openAcceptanceItems=[];
    s.stages['01'].directEvidenceReviewed=true;
  }

  if(mutation==='claimed-pass-without-run'){
    const entry=s.stages['01'];entry.status='DONE';entry.startCommit=s.startingMainCommit;entry.endCommit=s.startingMainCommit;
    entry.testsActuallyRun=[{command:'node verify-ingestion.mjs',result:'PASS',exitCode:0}];
    entry.openAcceptanceItems=[];entry.directEvidenceReviewed=true;
  }
  if(mutation==='fabricated-all-done'){
    for(const entry of Object.values(s.stages)){
      entry.status='DONE';entry.startCommit=s.startingMainCommit;entry.endCommit=s.startingMainCommit;
      entry.testsActuallyRun=[{command:'node THIS_FILE_DOES_NOT_EXIST.mjs',result:'PASS',exitCode:0,evidence:'THIS_EVIDENCE_DOES_NOT_EXIST.json'}];
      entry.browserEvidence=[];entry.deploymentEvidence=[];entry.deviceEvidence=[];
      entry.openAcceptanceItems=[];entry.directEvidenceReviewed=true;
    }
    s.currentStage='NONE';s.openAcceptanceItems=[];
  }

  assert(s.schema===LEDGER_SCHEMA,'Build-state ledger schema mismatch.');
  assert(s.controllerId===CONTROLLER_ID,'Build-state controller identity mismatch.');
  assert(s.controllerTitle===CONTROLLER_TITLE,'Build-state controller title mismatch.');
  assert(s.repository==='sjonesjones917/closed-loop-tracker','Build-state repository identity mismatch.');
  assert(s.specificationPath===SPEC_PATH,'Build-state specification path mismatch.');
  assert(s.specificationSha256===sha256(specBytes),'Build-state specification digest mismatch.');
  assert(s.specificationSha256===specManifest.sha256,'Build-state specification manifest mismatch.');
  assert(s.specificationByteLength===specBytes.length&&s.specificationByteLength===specManifest.byteLength,'Build-state specification byte length mismatch.');
  assert(s.specificationSourceCommit===specManifest.sourceCommit,'Build-state specification source commit mismatch.');
  assert(isSha(s.specificationSourceCommit)&&proveAncestor(s.specificationSourceCommit),'Build-state specification source commit is not reachable from current HEAD.');
  assert(isSha(s.startingMainCommit),'Build-state starting main commit is invalid.');
  assert(isSha(s.lastObservedMainCommit),'Build-state last observed main commit is invalid.');
  assert(s.stages&&typeof s.stages==='object'&&!Array.isArray(s.stages),'Build-state stages map missing.');

  let earliestNonDone=null;
  let seenNonDone=false;
  let doneCount=0;
  for(let n=1;n<=30;n++){
    const key=stageKey(n),entry=s.stages[key];
    assert(entry&&typeof entry==='object',`Stage ${key} ledger entry is missing.`);
    assert(entry.stage===key,`Stage ${key} identity mismatch.`);
    assert(typeof entry.name==='string'&&entry.name.trim(),`Stage ${key} name is missing.`);
    assert(VALID_STATUS.has(entry.status),`Stage ${key} has invalid status.`);
    for(const field of arrays)assert(Array.isArray(entry[field]),`Stage ${key} ${field} must be an array.`);
    if(entry.status!=='DONE'){
      seenNonDone=true;
      earliestNonDone??=key;
    }else{
      assert(!seenNonDone,`Stage ${key} is DONE after an earlier incomplete stage.`);
      assert(isSha(entry.startCommit)&&isSha(entry.endCommit),`Stage ${key} DONE commit binding is incomplete.`);
      assert(entry.openAcceptanceItems.length===0,`Stage ${key} is DONE with open acceptance items.`);
      // A ledger entry is a claim, not an execution receipt. Resolve the CI run
      // and replay its registered commands; never execute ledger text in a shell.
      await verifyExecutionClaims(entry);
      assert(entry.directEvidenceReviewed===true,`Stage ${key} lacks its review attestation.`);
      assert(proveAncestor(entry.endCommit),`Stage ${key} ending commit is not reachable from current HEAD.`);
      doneCount++;
    }
    if(entry.status==='NOT_STARTED'){
      assert(entry.startCommit===null&&entry.endCommit===null,`Stage ${key} NOT_STARTED must not claim commit completion.`);
    }
    if(entry.status==='IN_PROGRESS'||entry.status==='BLOCKED'){
      assert(isSha(entry.startCommit),`Stage ${key} ${entry.status} startCommit is invalid.`);
      assert(entry.endCommit===null,`Stage ${key} ${entry.status} cannot claim an ending commit.`);
    }
  }
  const expectedCurrent=earliestNonDone||'NONE';
  assert(s.currentStage===expectedCurrent,'Build-state currentStage is not the earliest incomplete stage.');
  assert(Array.isArray(s.openAcceptanceItems),'Build-state openAcceptanceItems must be an array.');
  if(doneCount===30)assert(s.openAcceptanceItems.length===0,'Completed controller ledger has global open acceptance items.');
  return {doneStages:doneCount,currentStage:expectedCurrent,specificationSha256:s.specificationSha256,specificationSourceCommit:s.specificationSourceCommit};
}

const files=repositoryFiles();
validateSingleLedger(files);
let duplicateLedgerRejected=false;
try{validateSingleLedger([...files,'implementation/closed-loop-build-state.json']);}catch{duplicateLedgerRejected=true;}
assert(duplicateLedgerRejected,'Intentional invalid ledger fixture duplicate-controller-ledger was not rejected.');

const state=readJson(STATE_PATH);
const result=await validateLedger(state);
for(const fixture of ['specification-digest-mismatch','invalid-status','skipped-stage','false-done-open-item','done-without-execution','fabricated-all-done','claimed-pass-without-run']){
  let rejected=false;
  try{await validateLedger(state,fixture);}catch{rejected=true;}
  assert(rejected,`Intentional invalid ledger fixture ${fixture} was not rejected.`);
}
// The positive runner fixture tests metadata validation only, not application
// completion. The process tests below really execute both a passing and a
// failing child; synthetic records cannot override the observed exit status.
const fixtureCommit='a'.repeat(40),fixtureRun={id:1,repository:{full_name:REPOSITORY},head_repository:{full_name:REPOSITORY},head_sha:fixtureCommit,path:WORKFLOW_PATH,event:'push',head_branch:'main',run_attempt:1,status:'completed',conclusion:'success'};
const fixtureJobs=[
  ['test',['Local Chromium operator path']],
  ['Deploy exact verified bytes',['Deploy application']],
  ['Verify deployed bytes and operator path',['Exact deployed-byte verification','Deployed Chromium operator path']]
].map(([name,steps],index)=>({id:index+1,run_id:1,run_attempt:1,head_sha:fixtureCommit,name,status:'completed',conclusion:'success',steps:steps.map(name=>({name,status:'completed',conclusion:'success'}))}));
validateRunnerEvidence(fixtureRun,fixtureJobs,1,fixtureCommit);
const mutations=[
  ['wrong-repository',(run)=>{run.repository.full_name='other/repository';}],
  ['wrong-source-repository',(run)=>{run.head_repository.full_name='other/repository';}],
  ['wrong-commit',(run)=>{run.head_sha='b'.repeat(40);}],
  ['wrong-workflow',(run)=>{run.path='.github/workflows/other.yml';}],
  ['pr-not-deployment',(run)=>{run.event='pull_request';}],
  ['failed-run',(run)=>{run.conclusion='failure';}],
  ['unfinished-run',(run)=>{run.status='in_progress';}],
  ['wrong-job-run',(_,jobs)=>{jobs[0].run_id=2;}],
  ['stale-attempt',(_,jobs)=>{jobs[0].run_attempt=2;}],
  ['wrong-job-commit',(_,jobs)=>{jobs[0].head_sha='b'.repeat(40);}],
  ['failed-job',(_,jobs)=>{jobs[0].conclusion='failure';}],
  ['missing-deployment',(_,jobs)=>{jobs.splice(1,1);}],
  ['duplicate-job',(_,jobs)=>{jobs.push(structuredClone(jobs[0]));}],
  ['skipped-browser',(_,jobs)=>{jobs[0].steps[0].conclusion='skipped';}],
  ['missing-byte-verification',(_,jobs)=>{jobs[2].steps.shift();}],
  ['unfinished-step-masked-by-job',(_,jobs)=>{jobs[0].steps.push({name:'unfinished test',status:'in_progress',conclusion:null});}],
  ['failed-step-masked-by-job',(_,jobs)=>{jobs[0].steps.push({name:'failed test',status:'completed',conclusion:'failure'});}]
];
for(const [name,mutate] of mutations){
  const run=structuredClone(fixtureRun),jobs=structuredClone(fixtureJobs);mutate(run,jobs);
  let rejected=false;try{validateRunnerEvidence(run,jobs,1,fixtureCommit);}catch{rejected=true;}
  assert(rejected,`Runner evidence regression not detected: ${name}.`);
}
const commandAllowlist=new Set(['verify-ingestion.mjs']);
assert(commandScripts('node verify-ingestion.mjs',commandAllowlist).length===1,'Valid registered command rejected.');
for(const command of ['node THIS_FILE_DOES_NOT_EXIST.mjs','node verify-ingestion.mjs; true','node verify-ingestion.mjs || true','node ../verify-ingestion.mjs','node -e "process.exit(0)"']){
  let rejected=false;try{commandScripts(command,commandAllowlist);}catch{rejected=true;}
  assert(rejected,`Unsafe/unregistered command was accepted: ${command}.`);
}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ledger-execution-regression-'));
try{
  // Use JSON-safe source text so the child really exits 0/1, not a syntax error.
  fs.writeFileSync(path.join(temp,'verify-pass.mjs'),'console.log("observed success");\n');
  fs.writeFileSync(path.join(temp,'verify-fail.mjs'),'console.error("deliberate regression failure");process.exit(1);\n');
  const passed=replayNodeScript('verify-pass.mjs',temp);
  assert(passed.exitCode===0&&passed.stdoutSha256===sha256('observed success\n'),'Actual passing process result was not retained.');
  let rejected=false;try{replayNodeScript('verify-fail.mjs',temp);}catch(error){rejected=error.message.includes('exit=1')&&error.message.includes('deliberate regression failure');}
  assert(rejected,'A recorded PASS masked a real failing child process.');
  rejected=false;try{replayNodeScript('verify-missing.mjs',temp);}catch(error){rejected=error.message.includes('missing or not a regular');}
  assert(rejected,'Missing execution script did not fail closed.');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
const sourceTemp=fs.mkdtempSync(path.join(os.tmpdir(),'ledger-source-regression-'));
const originalCwd=process.cwd();
let sourceBindingNegativeCases=0;
try{
  const git=args=>cp.execFileSync('git',args,{cwd:sourceTemp,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git(['init','--initial-branch=main']);
  fs.writeFileSync(path.join(sourceTemp,'verify-fixture.mjs'),'// original verification fixture\n');
  git(['add','.']);
  git(['-c','user.name=Ledger verification fixture','-c','user.email=fixture@example.invalid','commit','-m','Local source binding fixture']);
  const commit=git(['rev-parse','HEAD']);
  process.chdir(sourceTemp);sourceCache.clear();assertCurrentSource(commit);
  const rejectedSource=(name,change,restore)=>{
    change();sourceCache.clear();let rejected=false;
    try{assertCurrentSource(commit);}catch(error){rejected=error.message.includes('stale or the source is dirty');}
    restore();assert(rejected,`Source binding regression was not rejected: ${name}.`);sourceBindingNegativeCases++;
  };
  rejectedSource('dirty verifier',()=>fs.appendFileSync('verify-fixture.mjs','// changed\n'),()=>git(['restore','verify-fixture.mjs']));
  rejectedSource('untracked executable',()=>fs.writeFileSync('verify-untracked.mjs','process.exit(0);\n'),()=>fs.unlinkSync('verify-untracked.mjs'));
  fs.mkdirSync('verification/build-stages',{recursive:true});
  fs.writeFileSync(STATE_PATH,'{}\n');fs.writeFileSync('verification/build-stages/stage-01-proof.json','{}\n');
  sourceCache.clear();assertCurrentSource(commit);
  rejectedSource('executable in evidence directory',()=>fs.writeFileSync('verification/build-stages/verify-untracked.mjs','process.exit(0);\n'),()=>fs.unlinkSync('verification/build-stages/verify-untracked.mjs'));
  fs.appendFileSync('verify-fixture.mjs','// a new committed implementation\n');
  git(['add','.']);git(['-c','user.name=Ledger verification fixture','-c','user.email=fixture@example.invalid','commit','-m','Changed local implementation']);
  sourceCache.clear();let rejected=false;
  try{assertCurrentSource(commit);}catch(error){rejected=error.message.includes('stale or the source is dirty');}
  assert(rejected,'Stale execution commit accepted after the implementation changed.');sourceBindingNegativeCases++;
}finally{process.chdir(originalCwd);sourceCache.clear();fs.rmSync(sourceTemp,{recursive:true,force:true});}
console.log(JSON.stringify({...result,ledgerVerified:true,statusContract:[...VALID_STATUS],intentionalInvalidFixturesRejected:8,singleControllerLedger:true,runnerEvidenceNegativeCases:mutations.length,unsafeCommandsRejected:5,sourceBindingNegativeCases,actualPassingAndFailingProcessesExercised:true,observedExecutions,reviewAttestationIsIndependentProof:false,applicationAcceptanceEstablished:false}));
