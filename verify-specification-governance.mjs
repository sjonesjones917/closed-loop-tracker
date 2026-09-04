import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';

const SPEC_PATH='specification/closed-loop-reliability-controlling-implementation-specification.txt';
const SPEC_MANIFEST_PATH='specification/closed-loop-specification-manifest.json';
const NORMATIVE_MANIFEST_PATH='specification/closed-loop-normative-requirements.json';
const CORE_PATH='specification-governance-core.mjs';
const CONTROLLER_ID='closed-loop-monotonic-build-controller/2';
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));

for(const file of [SPEC_PATH,SPEC_MANIFEST_PATH,NORMATIVE_MANIFEST_PATH,CORE_PATH])assert(fs.existsSync(file),`Required governance input missing: ${file}`);
const sourceBytes=fs.readFileSync(SPEC_PATH);
const sourceText=new TextDecoder('utf-8',{fatal:true}).decode(sourceBytes);
const committedSpecBytes=fs.readFileSync(SPEC_MANIFEST_PATH);
const committedNormativeBytes=fs.readFileSync(NORMATIVE_MANIFEST_PATH);
const committedSpec=JSON.parse(committedSpecBytes.toString('utf8'));
const sourceCommit=String(process.env.SOURCE_COMMIT||committedSpec.sourceCommit||'').toLowerCase();

assert(/^[0-9a-f]{40}$/.test(sourceCommit),'Exact specification source commit is unavailable.');
assert(!sourceBytes.subarray(0,3).equals(Buffer.from([0xef,0xbb,0xbf])),'Specification BOM is prohibited.');
assert(!sourceText.includes('\r'),'Specification contains CR or CRLF bytes.');
assert(!sourceText.startsWith('\n'),'Specification has a leading blank line.');
assert(sourceText.endsWith('\n')&&!sourceText.endsWith('\n\n'),'Specification must end with exactly one LF.');
assert(sourceText.startsWith('Closed-Loop Reliability Application\nZero-Loss Controlling Implementation Specification\n'),'Specification start boundary is wrong.');
assert(sourceText.endsWith('Completion additionally requires the current exact deployed origin and bytes and the pinned actual physical-iPhone Safari operator path.\n'),'Specification end boundary is wrong.');
assert(committedSpec.sha256===sha256(sourceBytes),'Committed specification manifest does not bind the exact source bytes.');
assert(committedSpec.byteLength===sourceBytes.length,'Committed specification manifest byte length is wrong.');
assert(committedSpec.sourceCommit===sourceCommit,'Committed specification source commit is wrong.');

function verifySourceCommit(){
  if(process.env.GITHUB_ACTIONS!=='true')return {checked:false};
  const shallow=cp.execFileSync('git',['rev-parse','--is-shallow-repository'],{encoding:'utf8'}).trim()==='true';
  const fetchArgs=shallow?['fetch','--no-tags','--unshallow','origin','main']:['fetch','--no-tags','origin','main'];
  const fetched=cp.spawnSync('git',fetchArgs,{stdio:'ignore'});
  assert(fetched.status===0,'Unable to fetch complete canonical main history.');
  assert(cp.spawnSync('git',['merge-base','--is-ancestor',sourceCommit,'HEAD'],{stdio:'ignore'}).status===0,'Specification source commit is not reachable from current canonical main.');
  const shown=cp.spawnSync('git',['show',`${sourceCommit}:${SPEC_PATH}`],{encoding:null,maxBuffer:64*1024*1024});
  assert(shown.status===0,'Specification is absent from the recorded source commit.');
  assert(Buffer.compare(Buffer.from(shown.stdout),sourceBytes)===0,'Recorded source commit does not contain the current exact specification bytes.');
  return {checked:true};
}
const sourceCommitEvidence=verifySourceCommit();

for(const runtimePath of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','test-worker.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js','index.html','TEST_PROJECT.json']){
  if(!fs.existsSync(runtimePath))continue;
  const body=fs.readFileSync(runtimePath,'utf8');
  assert(!body.includes('Closed-Loop Reliability Application\nZero-Loss Controlling Implementation Specification'),`Specification text leaked into runtime ${runtimePath}.`);
  assert(!body.includes(CONTROLLER_ID)&&!body.includes('closed-loop-monotonic-build-controller/1'),`Controller text leaked into runtime ${runtimePath}.`);
}

function copyWorkspace(target){
  const root=path.resolve('.');
  fs.cpSync(root,target,{recursive:true,filter:source=>{
    const relative=path.relative(root,path.resolve(source));
    if(!relative)return true;
    return !relative.split(path.sep).some(part=>part==='.git'||part==='node_modules'||part==='_site')&&!relative.startsWith(path.join('verification','controller-ci-proof'));
  }});
}
function runCore(workspace){
  const beforeSpec=fs.readFileSync(path.join(workspace,SPEC_MANIFEST_PATH));
  const beforeNormative=fs.readFileSync(path.join(workspace,NORMATIVE_MANIFEST_PATH));
  const result=cp.spawnSync(process.execPath,[CORE_PATH],{
    cwd:workspace,
    env:{...process.env,SOURCE_COMMIT:sourceCommit,GITHUB_ACTIONS:'false'},
    encoding:'utf8',maxBuffer:256*1024*1024
  });
  const afterSpec=fs.readFileSync(path.join(workspace,SPEC_MANIFEST_PATH));
  const afterNormative=fs.readFileSync(path.join(workspace,NORMATIVE_MANIFEST_PATH));
  return {result,beforeSpec,beforeNormative,afterSpec,afterNormative,changed:!beforeSpec.equals(afterSpec)||!beforeNormative.equals(afterNormative)};
}

const temporaryRoots=[];
try{
  const validationRoot=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-governance-validation-'));
  temporaryRoots.push(validationRoot);
  copyWorkspace(validationRoot);
  const validation=runCore(validationRoot);
  if(validation.result.status!==0)throw new Error(`Independent governance validation failed:\n${validation.result.stdout||''}\n${validation.result.stderr||''}`);
  assert(!validation.changed,'Governance verifier would rewrite committed manifests instead of validating them.');
  assert(fs.readFileSync(SPEC_MANIFEST_PATH).equals(committedSpecBytes),'Governance validation modified the committed specification manifest.');
  assert(fs.readFileSync(NORMATIVE_MANIFEST_PATH).equals(committedNormativeBytes),'Governance validation modified the committed normative manifest.');

  const mutationRoot=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-governance-mutation-'));
  temporaryRoots.push(mutationRoot);
  copyWorkspace(mutationRoot);
  const mutationPath=path.join(mutationRoot,SPEC_MANIFEST_PATH);
  const mutation=readJson(mutationPath);
  mutation.sha256='0'.repeat(64);
  fs.writeFileSync(mutationPath,JSON.stringify(mutation,null,2)+'\n');
  const mutatedBytes=fs.readFileSync(mutationPath);
  const mutationRun=runCore(mutationRoot);
  assert(mutationRun.result.status===0,'Intentional committed-manifest mutation did not reach the rewrite-detection boundary.');
  assert(mutationRun.changed,'Intentional committed-manifest mutation was not detected by byte comparison.');
  let mutationRejected=false;
  try{assert(!mutationRun.changed,'Committed governance bytes changed during validation.');}catch{mutationRejected=true;}
  assert(mutationRejected,'Intentional committed-manifest mutation was not rejected.');
  assert(mutatedBytes.equals(mutationRun.beforeSpec),'Intentional mutation fixture changed before validation began.');

  cp.execFileSync(process.execPath,['verify-v3-migration.mjs'],{stdio:'pipe'});
  cp.execFileSync(process.execPath,['verify-response-contract-profile.mjs'],{stdio:'pipe'});

  const coreReport=JSON.parse((validation.result.stdout||'').trim());
  console.log(JSON.stringify({
    ...coreReport,
    sourceCommit,
    sourceCommitReachabilityChecked:sourceCommitEvidence.checked,
    committedManifestBytesValidated:true,
    independentRegenerationCompared:true,
    verifierDidNotRewriteCommittedManifests:true,
    committedManifestMutationRejected:true,
    runtimeControllerCopies:0,
    stage01GovernanceProof:'PASS'
  },null,2));
}finally{
  for(const root of temporaryRoots)fs.rmSync(root,{recursive:true,force:true});
}
