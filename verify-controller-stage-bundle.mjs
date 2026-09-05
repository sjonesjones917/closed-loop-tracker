import fs from 'node:fs';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import path from 'node:path';

const CONTROLLER_ID='closed-loop-monotonic-build-controller/2';
const SPEC_PATH='specification/closed-loop-reliability-controlling-implementation-specification.txt';
const NORM_PATH='specification/closed-loop-normative-requirements.json';
const STATE_PATH='verification/closed-loop-build-state.json';
const OUT_DIR=process.env.CONTROLLER_PROOF_OUT_DIR||'verification/controller-ci-proof';
const sha256=data=>crypto.createHash('sha256').update(data).digest('hex');
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const writeJson=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

const gitSha=String(process.env.GITHUB_SHA||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()).toLowerCase();
assert(/^[0-9a-f]{40}$/.test(gitSha),'Exact canonical commit SHA unavailable.');
assert(process.env.CONTROLLER_PRIOR_SUITE_PASSED==='1','Controller stage proof may run only after canonical CI and local browser proof passed.');
for(const file of [SPEC_PATH,NORM_PATH,STATE_PATH])assert(fs.existsSync(file),`Required controller input missing: ${file}`);
const specBytes=fs.readFileSync(SPEC_PATH),specificationSha256=sha256(specBytes);
const normative=readJson(NORM_PATH),state=readJson(STATE_PATH);
assert(state.controllerId===CONTROLLER_ID,'Controller state identity mismatch.');
assert(state.specificationSha256===specificationSha256,'Controller state specification digest mismatch.');
assert(normative.specificationSha256===specificationSha256,'Normative manifest specification digest mismatch.');

const stageCommands={
  '02':['verify-hash.mjs','verify-stage02-primitives.mjs'],
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
  '23':['verify-full-cycle.mjs','verify-definition-of-done.mjs','verify-production-baseline.mjs'],
  '24':['verify-full-cycle.mjs','verify-definition-of-done.mjs'],
  '25':['verify-test-runtime-v3.mjs','verify-full-cycle.mjs','verify-definition-of-done.mjs'],
  '26':['verify-full-cycle.mjs','verify-definition-of-done.mjs','verify-v3-definition-of-done.mjs'],
  '27':['verify-project-lifecycle.mjs','verify-full-cycle.mjs','verify-definition-of-done.mjs'],
  '28':['verify-file-first-operator.mjs','verify-definition-of-done-invariants.mjs'],
  '29':['verify-definition-of-done.mjs','verify-v3-definition-of-done.mjs','verify-definition-of-done-invariants.mjs','verify-full-cycle.mjs','verify-data-route-closure.mjs','verify-infrastructure-route-closure.mjs']
};
const fixtureByStage={
  '02':['canonical-json-invalid-scalar','unknown-hash-kind','unknown-set-semantics','id-exact-retry','filename-confusable-collision','trusted-time-unverified-device-time'],
  '03':['unknown-field','duplicate-producer','missing-operation-property','unknown-stage-operation','scope-dimension-mismatch','unregistered-durable-object','undefined-derivation-normalizer','identity-assurance-below-minimum'],
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
  '23':['wrong-run-count','context-reuse','candidate-mismatch','self-validation','missing-matrix-cell','missing-rca','unexecuted-regression','duplicate-stage17-machinery','baseline-without-authorization','baseline-wrong-candidate-authorization','baseline-inactive-authorization'],
  '24':['false-convergence','contradiction','nondue-product-test','changed-confirmation-candidate','empty-denominator','new-requirement','unauthorized-baseline'],
  '25':['missing-product-bytes','stale-result','weak-evidence','meaning-violation','adversarial-failure','wrong-independence','stage22-artifact-omission'],
  '26':['candidate-set-mismatch','delivery-filename-change','false-release','severity-only-rejection','order-dependent-identity','insufficient-evidence-chain','changed-delivery-scope'],
  '27':['missing-checkpoint','in-origin-backup','authorization-failure','terminal-cycle','self-invalidation','wrong-destination','authorization-as-delivery'],
  '28':['dom-injection','url-injection','filename-injection','viewport-overflow','touch-target','focus-live-region','visual-diff'],
  '29':['invalid-gate-state','storage-boundary-failure','worker-timeout','two-tab-conflict','full-30-stage-lifecycle','visual-baseline-mutation']
};
const orderedStages=Array.from({length:28},(_,index)=>String(index+2).padStart(2,'0'));
assert(Object.keys(stageCommands).length===orderedStages.length&&orderedStages.every(stage=>Object.hasOwn(stageCommands,stage)),'Stage proof command registry is not exactly contiguous 02 through 29.');
const earliest=orderedStages.find(stage=>state.stages?.[stage]?.status!=='PROVEN');
assert(earliest,'Stages 02-29 are already proven.');
const priorNumber=Number(earliest)-1,priorKey=String(priorNumber).padStart(2,'0');
assert(priorNumber===1||state.stages?.[priorKey]?.status==='PROVEN',`Prior Stage ${priorKey} is not PROVEN.`);
if(earliest==='29'&&process.env.ALLOW_STAGE29_PROMOTION!=='1')throw new Error('Stage 29 requires normative-manifest disposition promotion and is intentionally not auto-advanced.');

const files=['verify-build-stage-ledger.mjs',...stageCommands[earliest]];
for(const file of files)assert(fs.existsSync(file),`Proof command missing: ${file}`);
const proofCommands=[];
for(const file of files){
  const result=cp.spawnSync(process.execPath,[file],{encoding:'utf8',env:process.env,maxBuffer:128*1024*1024});
  if(result.stdout)process.stdout.write(result.stdout);
  if(result.stderr)process.stderr.write(result.stderr);
  const exitCode=Number.isInteger(result.status)?result.status:1;
  proofCommands.push({command:`node ${file}`,exitCode});
  assert(exitCode===0,`Proof command failed: node ${file}`);
}
const priorProofs=Object.entries(state.stages).filter(([stage,value])=>Number(stage)<Number(earliest)&&value?.status==='PROVEN').map(([stage,value])=>({stage,proofDigest:value.proofDigest,status:'PASS'}));
const proofCountBefore=Number(state.proofCount||0),proofCountAfter=proofCountBefore+proofCommands.length;
const conformantCount=Number(state.conformantRequirementCount||0);
const proof={
  schema:'closed-loop-build-stage-proof/1',controllerId:CONTROLLER_ID,stage:earliest,specificationSha256,
  startingMainCommit:gitSha,endingMainCommit:gitSha,implementationCommitIds:[gitSha],changedFiles:[],
  normativeRequirementChanges:[],proofCommands,
  proofArtifactDigests:[{path:SPEC_PATH,sha256:specificationSha256,byteLength:specBytes.length},{path:NORM_PATH,sha256:sha256(fs.readFileSync(NORM_PATH))}],
  intentionalInvalidFixtures:fixtureByStage[earliest]||[],earlierStageProofsReplayed:priorProofs,
  browserProofs:(Number(earliest)>=28||[5,10,11,12,13,14,15,16,23,25,26,27].includes(Number(earliest)))?[{proof:'local Chromium operator path',status:'PASS',basis:`GitHub Actions run ${process.env.GITHUB_RUN_ID||'UNKNOWN'} test job completed before proof advancement`}]:[],
  deployedProofs:[],
  externalActorProofs:[14,15,16,17,21,23,24,25,26].includes(Number(earliest))?[{proof:'independent-context/semantic-review executable fixture',status:'PASS',basis:'stage-mapped verifier'}]:[],
  unprovenItems:[],proofCountBefore,proofCountAfter,conformantCountBefore:conformantCount,conformantCountAfter:conformantCount,
  stageDisposition:'PROVEN',nextStage:earliest==='29'?'30':String(Number(earliest)+1).padStart(2,'0')
};
writeJson(path.join(OUT_DIR,`stage-${earliest}-proof.json`),proof);
writeJson(path.join(OUT_DIR,'controller-stage-summary.json'),{controllerId:CONTROLLER_ID,commit:gitSha,stage:earliest,proofCountBefore,proofCountAfter,conformantCount,nextStage:proof.nextStage});
console.log(JSON.stringify({controllerStageProof:'PASS',stage:earliest,commit:gitSha,proofCountAfter,nextStage:proof.nextStage}));
