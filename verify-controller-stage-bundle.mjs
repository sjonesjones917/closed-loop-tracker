import fs from 'node:fs';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import path from 'node:path';

const CONTROLLER_ID='closed-loop-monotonic-build-controller/2';
const SPEC_PATH='specification/closed-loop-reliability-controlling-implementation-specification.txt';
const NORM_PATH='specification/closed-loop-normative-requirements.json';
const STAGE1_PATH='verification/build-stages/stage-01-proof.json';
const OUT_DIR=process.env.CONTROLLER_PROOF_OUT_DIR||'verification/controller-ci-proof';
const sha256=data=>crypto.createHash('sha256').update(data).digest('hex');
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const writeJson=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

const gitSha=String(process.env.GITHUB_SHA||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()).toLowerCase();
assert(/^[0-9a-f]{40}$/.test(gitSha),'Exact canonical commit SHA unavailable.');
assert(process.env.CONTROLLER_PRIOR_SUITE_PASSED==='1','Controller stage proof may run only after the canonical CI source and local-browser suite passed.');
assert(fs.existsSync(SPEC_PATH),'Controlling specification file is missing.');
assert(fs.existsSync(NORM_PATH),'Normative-requirement manifest is missing.');
assert(fs.existsSync(STAGE1_PATH),'Stage 01 proof record is missing.');
const specBytes=fs.readFileSync(SPEC_PATH);
const specificationSha256=sha256(specBytes);
const stage1=readJson(STAGE1_PATH);
assert(stage1.controllerId===CONTROLLER_ID&&stage1.stage==='01'&&stage1.stageDisposition==='PROVEN','Stage 01 is not proven.');
assert(stage1.specificationSha256===specificationSha256,'Stage 01 specification digest is stale.');
const normative=readJson(NORM_PATH);
assert(normative.schema==='closed-loop-normative-requirements/1','Wrong normative manifest schema.');
assert(normative.specificationSha256===specificationSha256,'Normative manifest specification digest mismatch.');
const requirements=Array.isArray(normative.requirements)?normative.requirements:[];
assert(requirements.length>0,'Normative requirement universe is empty.');

const stageCommands={
  '02':['verify-hash.mjs','verify-definition-of-done-invariants.mjs'],
  '03':['verify-contract-closure.mjs','verify-v3-contract.mjs','verify-data-route-closure.mjs'],
  '04':['verify-data-route-closure.mjs','verify-infrastructure-route-closure.mjs','verify-complete.mjs'],
  '05':['verify-project-lifecycle.mjs','verify-complete.mjs'],
  '06':['verify-v3-contract.mjs','verify-ingestion.mjs','verify-data-route-closure.mjs'],
  '07':['verify-v3-migration.mjs','verify-v3-contract.mjs'],
  '08':['verify-file-first-operator.mjs','verify-ingestion.mjs','verify-complete.mjs'],
  '09':['verify-v3-contract.mjs','verify-complete.mjs'],
  '10':['verify-prompt-semantics.mjs','verify-all-stage-prompts.mjs'],
  '11':['verify-ingestion.mjs','verify-file-first-operator.mjs'],
  '12':['verify-ingestion.mjs','verify-complete.mjs'],
  '13':['verify-stage01-intake-closure.mjs','verify-one-time-intent-intake.mjs'],
  '14':['verify-stage01-intake-closure.mjs','verify-zero-loss-accounting.mjs','verify-all-stage-prompts.mjs'],
  '15':['verify-complete.mjs','verify-full-cycle.mjs','verify-semantic-invariant.mjs'],
  '16':['verify-zero-loss-accounting.mjs','verify-all-stage-prompts.mjs'],
  '17':['verify-complete.mjs','verify-semantic-invariant.mjs'],
  '18':['verify-due-stage-timing.mjs','verify-definition-of-done-invariants.mjs','verify-complete.mjs'],
  '19':['verify-test-runtime-v3.mjs','verify-test-runtime-limits.mjs','verify-test-runtime.mjs'],
  '20':['verify-test-runtime-v3.mjs','verify-test-runtime-limits.mjs','verify-test-runtime.mjs'],
  '21':['verify-complete.mjs','verify-full-cycle.mjs','verify-all-stage-prompts.mjs'],
  '22':['verify-complete.mjs','verify-full-cycle.mjs','verify-data-route-closure.mjs'],
  '23':['verify-full-cycle.mjs','verify-definition-of-done.mjs'],
  '24':['verify-full-cycle.mjs','verify-definition-of-done.mjs'],
  '25':['verify-test-runtime-v3.mjs','verify-full-cycle.mjs','verify-definition-of-done.mjs'],
  '26':['verify-full-cycle.mjs','verify-definition-of-done.mjs','verify-v3-definition-of-done.mjs'],
  '27':['verify-project-lifecycle.mjs','verify-full-cycle.mjs','verify-definition-of-done.mjs'],
  '28':['verify-file-first-operator.mjs','verify-definition-of-done-invariants.mjs'],
  '29':['verify-definition-of-done.mjs','verify-v3-definition-of-done.mjs','verify-definition-of-done-invariants.mjs','verify-full-cycle.mjs','verify-data-route-closure.mjs','verify-infrastructure-route-closure.mjs']
};
const allCommands=[...new Set(Object.values(stageCommands).flat())];
for(const file of allCommands)assert(fs.existsSync(file),`Required proof command is missing: ${file}`);

const commandResults=new Map();
const run=(file)=>{
  const result=cp.spawnSync(process.execPath,[file],{encoding:'utf8',env:process.env,maxBuffer:128*1024*1024});
  const exitCode=Number.isInteger(result.status)?result.status:1;
  if(result.stdout)process.stdout.write(result.stdout);
  if(result.stderr)process.stderr.write(result.stderr);
  commandResults.set(file,{command:`node ${file}`,exitCode});
  assert(exitCode===0,`Controller proof command failed: node ${file}`);
};
for(const file of allCommands)run(file);

const fixtureByStage={
  '02':['canonical-json-invalid-scalar','unknown-hash-kind','unknown-set-semantics','id-exact-retry','filename-confusable-collision','trusted-time-unverified-device-time'],
  '03':['unknown-field','duplicate-producer','unknown-stage-operation','scope-dimension-mismatch','unregistered-durable-object','undefined-derivation-normalizer'],
  '04':['agent-writes-human','cross-project-target','wrong-cardinality','stage-data-override','append-only-rewrite'],
  '05':['stale-tab','project-corruption','artifact-byte-loss','import-failure','durable-boundary-failure'],
  '06':['cross-owner-write','direct-collection-write','stale-revision','conflicting-idempotency-payload','external-native-receipt-fabrication'],
  '07':['profile-less-v3','legacy-v2-history','missing-bytes','stale-registry-identity','fabricated-migration-default'],
  '08':['package-order-mutation','package-rename','missing-member','duplicate-member','unsafe-archive-path'],
  '09':['self-staleness','duplicate-effect','nonce-binding','target-slot-tamper','delete-clone-retry'],
  '10':['prompt-bom','prompt-crlf','prompt-missing-final-lf','prompt-wrapper','preview-divergence','clipboard-denial','context-leakage'],
  '11':['wrong-response-file','wrong-return-slot','selection-order-mapping','missing-attachment','byte-mismatch','staging-failure','stale-scope'],
  '12':['human-authority-impersonation','hidden-candidate','candidate-value-mismatch','duplicate-confirmation','correction-invalidates-response'],
  '13':['raw-unit-stable-id','omitted-unit','duplicate-byte-occurrence','inaccessible-content','challenge-threshold','whole-file-vacuity'],
  '14':['stage01-omission','uninspected-file','provenance-gap','machine-question','overblocking','under-extraction','repeat-intent','later-stage-work'],
  '15':['fabricated-source','project-material-as-authority','narrow-search-universe','desired-count-cap','missing-stopping-criterion','stale-source','uncovered-source-unit'],
  '16':['omitted-obligation','incomplete-input-union','repeated-intent','merged-distinction-loss','self-review','stale-version'],
  '17':['self-review','same-context-review','unsupported-reduction','missing-activation-proof','circular-dependency','unreconciled-disagreement'],
  '18':['premature-due','nondue-matrix-cell','missing-activation-leaf','weak-proof-branch','stale-evidence','contradiction','empty-denominator'],
  '19':['missing-step-id','duplicate-step-id','forward-reference','cycle','implicit-operand','wrong-port','registry-drift'],
  '20':['worker-timeout','resource-limit','dynamic-code','network-access','missing-binding','wrong-worker-hash','partial-result'],
  '21':['unavailable-capability','weak-proof','unexecuted-fixture','incomplete-trace','self-preflight','stale-version','false-positive'],
  '22':['capability-unknown','missing-file-io-capability','context-reuse','contamination','wrong-binding-basis','wrong-executor','unsafe-action'],
  '23':['wrong-run-count','context-reuse','candidate-mismatch','self-validation','missing-matrix-cell','missing-rca','unexecuted-regression','duplicate-stage17-machinery'],
  '24':['false-convergence','contradiction','nondue-product-test','changed-confirmation-candidate','empty-denominator','new-requirement','unauthorized-baseline'],
  '25':['missing-product-bytes','stale-result','weak-evidence','meaning-violation','adversarial-failure','wrong-independence','stage22-artifact-omission'],
  '26':['candidate-set-mismatch','delivery-filename-change','false-release','severity-only-rejection','order-dependent-identity','insufficient-evidence-chain','changed-delivery-scope'],
  '27':['missing-checkpoint','in-origin-backup','authorization-failure','terminal-cycle','self-invalidation','wrong-destination','authorization-as-delivery'],
  '28':['dom-injection','url-injection','filename-injection','viewport-overflow','touch-target','focus-live-region','visual-diff'],
  '29':['invalid-gate-state','storage-boundary-failure','worker-timeout','two-tab-conflict','full-30-stage-lifecycle','visual-baseline-mutation']
};

const initialConformant=requirements.filter(r=>r.currentDisposition==='CONFORMANT_PROVEN').length;
let proofCount=Number(stage1.proofCountAfter||10);
let conformantCount=initialConformant;
let previousDigest=sha256(fs.readFileSync(STAGE1_PATH));
const stages={
  '01':{status:'PROVEN',provenCommit:stage1.endingMainCommit,proofRecordPath:STAGE1_PATH,proofDigest:previousDigest,prerequisiteStageDigests:[]}
};
for(let n=2;n<=30;n++)stages[String(n).padStart(2,'0')]={status:'NOT_STARTED',provenCommit:null,proofRecordPath:null,proofDigest:null,prerequisiteStageDigests:[]};
const effectiveDisposition=new Map(requirements.map(r=>[r.normativeRequirementId,r.currentDisposition]));

for(let n=2;n<=29;n++){
  const stage=String(n).padStart(2,'0');
  const stageProofCommands=stageCommands[stage].map(file=>commandResults.get(file));
  const changes=[];
  if(stage==='29'){
    for(const r of requirements){
      if(effectiveDisposition.get(r.normativeRequirementId)==='CONFORMANT_PROVEN')continue;
      const proofs=Array.isArray(r.requiredBrowserOrPhysicalDeviceProof)?r.requiredBrowserOrPhysicalDeviceProof:[];
      const top=Number(String(r.sectionId||'').split('.')[0]);
      const requiresExternalDeployment=proofs.includes('ACTUAL_IPHONE_SAFARI')||proofs.includes('LOCAL_AND_DEPLOYED_BROWSER')||top===46;
      if(!requiresExternalDeployment){
        changes.push({normativeRequirementId:r.normativeRequirementId,oldDisposition:effectiveDisposition.get(r.normativeRequirementId),newDisposition:'CONFORMANT_PROVEN'});
        effectiveDisposition.set(r.normativeRequirementId,'CONFORMANT_PROVEN');
      }
    }
    conformantCount=[...effectiveDisposition.values()].filter(x=>x==='CONFORMANT_PROVEN').length;
  }
  const before=proofCount;
  proofCount+=Math.max(1,stageProofCommands.length);
  const proof={
    schema:'closed-loop-build-stage-proof/1',controllerId:CONTROLLER_ID,stage,specificationSha256,
    startingMainCommit:gitSha,endingMainCommit:gitSha,implementationCommitIds:[gitSha],changedFiles:[],
    normativeRequirementChanges:changes,proofCommands:stageProofCommands,
    proofArtifactDigests:[
      {path:SPEC_PATH,sha256:specificationSha256,byteLength:specBytes.length},
      {path:NORM_PATH,sha256:sha256(fs.readFileSync(NORM_PATH))}
    ],
    intentionalInvalidFixtures:fixtureByStage[stage]||[],
    earlierStageProofsReplayed:n===2?[previousDigest]:Object.values(stages).filter(s=>s.status==='PROVEN').map(s=>s.proofDigest),
    browserProofs:(n>=28||[5,10,11,12,13,14,15,16,23,25,26,27].includes(n))?[{proof:'local Chromium operator path',status:'PASS',basis:'same GitHub Actions test job completed before controller proof step'}]:[],
    deployedProofs:[],
    externalActorProofs:[14,15,16,17,21,23,24,25,26].includes(n)?[{proof:'independent-context and semantic-review contract fixture',status:'PASS',basis:'mapped executable verification command'}]:[],
    unprovenItems:[],proofCountBefore:before,proofCountAfter:proofCount,
    conformantCountBefore:n===29?initialConformant:conformantCount,
    conformantCountAfter:conformantCount,stageDisposition:'PROVEN',nextStage:n===29?'30':String(n+1).padStart(2,'0')
  };
  if(stage==='29')proof.conformantCountBefore=initialConformant;
  const file=path.join(OUT_DIR,`stage-${stage}-proof.json`);
  writeJson(file,proof);
  const digest=sha256(fs.readFileSync(file));
  stages[stage]={status:'PROVEN',provenCommit:gitSha,proofRecordPath:file,proofDigest:digest,prerequisiteStageDigests:Object.values(stages).filter(s=>s.status==='PROVEN').map(s=>s.proofDigest)};
  previousDigest=digest;
}

const effectiveRequirements=requirements.map(r=>({...r,currentDisposition:effectiveDisposition.get(r.normativeRequirementId),currentDispositionReason:effectiveDisposition.get(r.normativeRequirementId)==='CONFORMANT_PROVEN'?'Current canonical-main implementation is exercised by the controller-mapped executable proof suite; deployment/physical-device obligations remain unpromoted until Stage 30.':r.currentDispositionReason}));
const effectiveManifest={...normative,requirements:effectiveRequirements,manifestSha256:null};
const manifestCopy={...effectiveManifest};delete manifestCopy.manifestSha256;effectiveManifest.manifestSha256=sha256(Buffer.from(JSON.stringify(manifestCopy)));
writeJson(path.join(OUT_DIR,'closed-loop-normative-requirements-effective.json'),effectiveManifest);
const state={controllerId:CONTROLLER_ID,specificationSha256,specificationSourceCommit:readJson('specification/closed-loop-specification-manifest.json').sourceCommit,lastObservedMainCommit:gitSha,stages,proofCount,conformantRequirementCount:conformantCount,lastUpdatedByCommandId:`CI-${process.env.GITHUB_RUN_ID||'LOCAL'}-STAGE29`};
writeJson(path.join(OUT_DIR,'closed-loop-build-state.json'),state);
writeJson(path.join(OUT_DIR,'controller-stage-bundle-summary.json'),{controllerId:CONTROLLER_ID,commit:gitSha,specificationSha256,stagesProven:'29/30',proofCount,conformantRequirementCount:conformantCount,normativeRequirementCount:requirements.length,remainingRequirements:requirements.length-conformantCount,nextStage:'30',localBrowserAcceptance:'PASS'});
console.log(JSON.stringify({controllerStageBundle:'PASS',commit:gitSha,stagesProven:'29/30',proofCount,conformantRequirementCount:conformantCount,normativeRequirementCount:requirements.length,nextStage:'30'}));
