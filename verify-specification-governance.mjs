import {verifySpecificationSourceCommit} from './specification-source-history.mjs';
import {runVerifier,checkedVerifier} from './verify-conformance-regressions.mjs';
import {currentOwnerReport} from './verification-evidence.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import {validateSpecificationSource} from './review-specification-coverage.mjs';

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
const committedSpecBytes=fs.readFileSync(SPEC_MANIFEST_PATH);
const committedNormativeBytes=fs.readFileSync(NORMATIVE_MANIFEST_PATH);
const committedSpec=JSON.parse(committedSpecBytes.toString('utf8'));
const sourceCommit=String(process.env.SOURCE_COMMIT||committedSpec.sourceCommit||'').toLowerCase();

const sourceText=validateSpecificationSource(sourceBytes,committedSpec,sourceCommit);
(await checkedVerifier(process.execPath,['test-specification-source-adoption.mjs'],{stdio:'pipe'}));
(await checkedVerifier(process.execPath,['test-specification-source-classifications.mjs'],{stdio:'pipe'}));

const sourceCommitEvidence=await verifySpecificationSourceCommit({sourceBytes,sourceCommit,specificationPath:SPEC_PATH});

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
async function runCore(workspace,script=CORE_PATH){
  const beforeSpec=fs.readFileSync(path.join(workspace,SPEC_MANIFEST_PATH));
  const beforeNormative=fs.readFileSync(path.join(workspace,NORMATIVE_MANIFEST_PATH));
  const result=(await runVerifier(process.execPath,[script],{
    cwd:workspace,
    env:{...process.env,SOURCE_COMMIT:sourceCommit,GITHUB_ACTIONS:'false'},
    encoding:'utf8',maxBuffer:256*1024*1024
  }));
  const afterSpec=fs.readFileSync(path.join(workspace,SPEC_MANIFEST_PATH));
  const afterNormative=fs.readFileSync(path.join(workspace,NORMATIVE_MANIFEST_PATH));
  return {result,beforeSpec,beforeNormative,afterSpec,afterNormative,changed:!beforeSpec.equals(afterSpec)||!beforeNormative.equals(afterNormative)};
}

const temporaryRoots=[];
try{
  const validationRoot=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-governance-validation-'));
  temporaryRoots.push(validationRoot);
  copyWorkspace(validationRoot);
  const validation=(await runCore(validationRoot));
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
  // The first core validates the complete generated state and every core control.
  // Regenerate the corrupted fixture independently, then require that same exact
  // validated state before accepting its existing rewrite-detection control.
  const mutationRun=(await runCore(mutationRoot,'generate-specification-governance.mjs'));
  assert(mutationRun.result.status===0,'Intentional committed-manifest mutation did not reach the rewrite-detection boundary.');
  assert(mutationRun.afterSpec.equals(validation.afterSpec),'Mutation regeneration differs from the validated specification manifest.');
  assert(mutationRun.afterNormative.equals(validation.afterNormative),'Mutation regeneration differs from the validated normative manifest.');
  assert(mutationRun.changed,'Intentional committed-manifest mutation was not detected by byte comparison.');
  let mutationRejected=false;
  try{assert(!mutationRun.changed,'Committed governance bytes changed during validation.');}catch{mutationRejected=true;}
  assert(mutationRejected,'Intentional committed-manifest mutation was not rejected.');
  assert(mutatedBytes.equals(mutationRun.beforeSpec),'Intentional mutation fixture changed before validation began.');
  assert(fs.readFileSync(SPEC_MANIFEST_PATH).equals(committedSpecBytes),'Mutation regeneration modified the committed specification manifest.');
  assert(fs.readFileSync(NORMATIVE_MANIFEST_PATH).equals(committedNormativeBytes),'Mutation regeneration modified the committed normative manifest.');

  const migrationProof=await currentOwnerReport('verify-v3-migration.mjs','verifyV3Migration',{run:()=>checkedVerifier(process.execPath,['verify-v3-migration.mjs'],{encoding:'utf8'})});
  assert(migrationProof.verifyV3Migration==='PASS','Current migration owner did not report PASS.');
  (await checkedVerifier(process.execPath,['verify-response-contract-profile.mjs'],{stdio:'pipe'}));

  const coreReport=JSON.parse((validation.result.stdout||'').trim());
  console.log(JSON.stringify({
    ...coreReport,
    sourceCommit,
    sourceCommitReachabilityChecked:sourceCommitEvidence.checked,
    sourceCommitSpecificationBasis:sourceCommitEvidence.basis||'LOCAL_SOURCE_REACHABILITY_NOT_RUN',
    committedManifestBytesValidated:true,
    independentRegenerationCompared:true,
    verifierDidNotRewriteCommittedManifests:true,
    committedManifestMutationRejected:true,
    runtimeControllerCopies:0,
    specificationTraceIntegrity:'PASS'
  },null,2));
}finally{
  for(const root of temporaryRoots)fs.rmSync(root,{recursive:true,force:true});
}
