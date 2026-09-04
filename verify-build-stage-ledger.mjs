import fs from 'node:fs';
import crypto from 'node:crypto';
import cp from 'node:child_process';

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

function validateLedger(state,mutation=null){
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
      const executed=entry.testsActuallyRun.filter(test=>test&&test.result==='PASS'&&test.exitCode===0&&typeof test.command==='string'&&test.command.trim());
      assert(executed.length>0,`Stage ${key} is DONE without directly executed passing evidence.`);
      assert(entry.directEvidenceReviewed===true,`Stage ${key} is DONE without direct evidence review.`);
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
const result=validateLedger(state);
for(const fixture of ['specification-digest-mismatch','invalid-status','skipped-stage','false-done-open-item','done-without-execution']){
  let rejected=false;
  try{validateLedger(state,fixture);}catch{rejected=true;}
  assert(rejected,`Intentional invalid ledger fixture ${fixture} was not rejected.`);
}
console.log(JSON.stringify({...result,ledgerVerified:true,statusContract:[...VALID_STATUS],intentionalInvalidFixturesRejected:6,singleControllerLedger:true}));
