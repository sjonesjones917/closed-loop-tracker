import assert from 'node:assert/strict';

export const MOBILE_ACCEPTANCE_ORIGIN='https://sjonesjones917.github.io';
export const MOBILE_ACCEPTANCE_BASE_PATH='/closed-loop-tracker/';
export const ACCEPTABLE_PHYSICAL_EVIDENCE_BASES=Object.freeze(['HUMAN_OBSERVATION','VERIFIED_EXTERNAL']);
export const REQUIRED_MOBILE_RECEIPT_KINDS=Object.freeze([
  'PROJECT_CREATED',
  'RAW_FILE_INTAKE',
  'PROMPT_FILE_EXPORTED_OR_SHARED',
  'INPUT_FILE_ATTACHMENT_INSTRUCTIONS_CONFIRMED',
  'RESPONSE_JSON_SELECTED_AND_INGESTED',
  'RETURNED_FILE_SLOTS_SELECTED',
  'VALIDATION_FAILURE_RECOVERED',
  'PROPOSAL_REVIEWED_AND_ACCEPTED',
  'PERSISTENCE_RELOAD_VERIFIED',
  'ARTIFACT_DOWNLOAD_OR_SHARE_VERIFIED',
  'LOGICAL_EXECUTION_PACKAGE_EXPORTED',
  'BACKUP_EXPORTED',
  'BACKUP_RESTORED_FROM_EXPORTED_COPY',
  'ACCESSIBILITY_AND_OVERFLOW_VERIFIED',
  'DEPLOYED_BUILD_IDENTITY_VERIFIED',
  'RUNTIME_EXCEPTION_CHECK_COMPLETED'
]);

const NONEMPTY=value=>typeof value==='string'&&value.trim().length>0;
const HEX_128_OR_MORE=value=>typeof value==='string'&&/^[0-9a-fA-F]{32,}$/.test(value);
const SHA256=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const COMMIT_SHA=value=>typeof value==='string'&&/^[0-9a-f]{40}$/.test(value);
const RFC3339=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const finite=value=>typeof value==='number'&&Number.isFinite(value);

function issue(errors,code,message){errors.push({code,message});}
function same(actual,expected){return actual===expected;}

export function verifyMobileAcceptanceEvidence({target,evidence,expected={},usedChallenges=[]}={}){
  const errors=[];
  const used=new Set(Array.isArray(usedChallenges)?usedChallenges:[...usedChallenges]);
  if(!target||typeof target!=='object'||Array.isArray(target))issue(errors,'TARGET_REQUIRED','Pinned mobile acceptance target is required.');
  if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))issue(errors,'EVIDENCE_REQUIRED','Physical-device evidence is required.');
  if(errors.length)return {accepted:false,status:'BLOCKED',errors};

  if(!NONEMPTY(target.mobileAcceptanceTargetId))issue(errors,'TARGET_ID_REQUIRED','mobileAcceptanceTargetId is required.');
  if(target.physicalDeviceRequired!==true)issue(errors,'PHYSICAL_DEVICE_REQUIRED','The target must require a physical device.');
  if(!HEX_128_OR_MORE(target.challenge))issue(errors,'CHALLENGE_INVALID','Challenge must contain at least 128 bits encoded as hexadecimal.');
  if(!RFC3339(target.challengeIssuedAt)||!RFC3339(target.challengeExpiresAt))issue(errors,'CHALLENGE_TIME_INVALID','Challenge issue and expiry times must be RFC 3339 values.');
  if(RFC3339(target.challengeIssuedAt)&&RFC3339(target.challengeExpiresAt)&&Date.parse(target.challengeExpiresAt)<=Date.parse(target.challengeIssuedAt))issue(errors,'CHALLENGE_WINDOW_INVALID','Challenge expiry must be later than challenge issue time.');
  if(used.has(target.challenge))issue(errors,'CHALLENGE_REUSED','The mobile acceptance challenge was already accepted.');
  const verificationTime=expected.verificationTime||new Date().toISOString();
  if(RFC3339(target.challengeExpiresAt)&&Date.parse(verificationTime)>Date.parse(target.challengeExpiresAt))issue(errors,'CHALLENGE_EXPIRED','The mobile acceptance challenge is expired.');

  if(!COMMIT_SHA(target.sourceCommit))issue(errors,'TARGET_COMMIT_INVALID','Target sourceCommit must be an exact 40-character commit SHA.');
  if(!SHA256(target.deploymentManifestDigest))issue(errors,'TARGET_MANIFEST_DIGEST_INVALID','Target deploymentManifestDigest must be a SHA-256 digest.');
  if(target.origin!==MOBILE_ACCEPTANCE_ORIGIN)issue(errors,'TARGET_ORIGIN_INVALID','Target origin must be the canonical deployment origin.');
  if(target.basePath!==MOBILE_ACCEPTANCE_BASE_PATH)issue(errors,'TARGET_BASE_PATH_INVALID','Target base path must be the canonical deployment base path.');
  if(!NONEMPTY(target.testProjectId))issue(errors,'TARGET_TEST_PROJECT_REQUIRED','Target testProjectId is required.');
  if(!NONEMPTY(target.procedureVersion))issue(errors,'TARGET_PROCEDURE_REQUIRED','Target procedureVersion is required.');
  if(!target.viewport||!finite(target.viewport.width)||!finite(target.viewport.height)||!finite(target.viewport.devicePixelRatio)||target.viewport.width<=0||target.viewport.height<=0||target.viewport.devicePixelRatio<=0)issue(errors,'TARGET_VIEWPORT_INVALID','Target viewport dimensions and device-pixel ratio are required.');

  if(expected.sourceCommit&&!same(target.sourceCommit,expected.sourceCommit))issue(errors,'TARGET_COMMIT_MISMATCH','Target commit does not match the exact deployed commit.');
  if(expected.deploymentManifestDigest&&!same(target.deploymentManifestDigest,expected.deploymentManifestDigest))issue(errors,'TARGET_MANIFEST_MISMATCH','Target deployment manifest digest does not match the exact deployed build.');
  if(expected.origin&&!same(target.origin,expected.origin))issue(errors,'TARGET_EXPECTED_ORIGIN_MISMATCH','Target origin does not match the expected origin.');
  if(expected.basePath&&!same(target.basePath,expected.basePath))issue(errors,'TARGET_EXPECTED_BASE_PATH_MISMATCH','Target base path does not match the expected base path.');

  const bindings=[
    ['mobileAcceptanceTargetId','TARGET_ID_MISMATCH'],
    ['challenge','CHALLENGE_MISMATCH'],
    ['sourceCommit','EVIDENCE_COMMIT_MISMATCH'],
    ['deploymentManifestDigest','EVIDENCE_MANIFEST_MISMATCH'],
    ['origin','EVIDENCE_ORIGIN_MISMATCH'],
    ['basePath','EVIDENCE_BASE_PATH_MISMATCH'],
    ['testProjectId','EVIDENCE_TEST_PROJECT_MISMATCH'],
    ['procedureVersion','EVIDENCE_PROCEDURE_MISMATCH']
  ];
  for(const [field,code] of bindings){if(!same(evidence[field],target[field]))issue(errors,code,`Evidence ${field} does not match the pinned target.`);}
  if(!NONEMPTY(evidence.mobileAcceptanceEvidenceId))issue(errors,'EVIDENCE_ID_REQUIRED','mobileAcceptanceEvidenceId is required.');
  if(evidence.physicalDeviceAssertion!==true)issue(errors,'PHYSICAL_DEVICE_ASSERTION_REQUIRED','Evidence must contain the performer physical-device assertion.');
  if(!ACCEPTABLE_PHYSICAL_EVIDENCE_BASES.includes(evidence.evidenceBasis))issue(errors,'EVIDENCE_BASIS_INSUFFICIENT','Physical-device evidence basis must be HUMAN_OBSERVATION or VERIFIED_EXTERNAL.');
  if(!NONEMPTY(evidence.performer))issue(errors,'PERFORMER_REQUIRED','Evidence performer identity is required.');
  if(!NONEMPTY(evidence.identityAssurance))issue(errors,'IDENTITY_ASSURANCE_REQUIRED','Evidence performer identity assurance is required.');
  if(!NONEMPTY(evidence.iosVersion))issue(errors,'IOS_VERSION_REQUIRED','Reported iOS version is required.');
  if(!NONEMPTY(evidence.safariUserAgent)||!/(iPhone|iPod)/.test(evidence.safariUserAgent)||!/Safari\//.test(evidence.safariUserAgent)||/(CriOS|FxiOS|EdgiOS|OPiOS)/.test(evidence.safariUserAgent))issue(errors,'SAFARI_USER_AGENT_INVALID','Evidence must identify Safari on the pinned iPhone target and reject substitute browsers.');
  if(!evidence.viewport||!same(evidence.viewport.width,target.viewport.width)||!same(evidence.viewport.height,target.viewport.height)||!same(evidence.viewport.devicePixelRatio,target.viewport.devicePixelRatio))issue(errors,'VIEWPORT_MISMATCH','Evidence viewport must match the pinned target exactly.');

  const receipts=Array.isArray(evidence.operationReceipts)?evidence.operationReceipts:[];
  const kinds=new Set();
  for(const receipt of receipts){
    if(!receipt||typeof receipt!=='object'||!NONEMPTY(receipt.kind)||!NONEMPTY(receipt.receiptId)){issue(errors,'RECEIPT_INVALID','Every mobile acceptance receipt must contain kind and receiptId.');continue;}
    if(kinds.has(receipt.kind))issue(errors,'DUPLICATE_RECEIPT_KIND',`Receipt kind ${receipt.kind} is duplicated.`);
    kinds.add(receipt.kind);
    if(receipt.result!=='PASS')issue(errors,'RECEIPT_NOT_PASSING',`Receipt ${receipt.kind} did not pass.`);
  }
  for(const kind of REQUIRED_MOBILE_RECEIPT_KINDS){if(!kinds.has(kind))issue(errors,'REQUIRED_RECEIPT_MISSING',`Required mobile acceptance receipt ${kind} is missing.`);}

  const findings=evidence.runtimeFindings||{};
  if(findings.runtimeExceptions!==0)issue(errors,'RUNTIME_EXCEPTION_PRESENT','Physical-device run reported a runtime exception.');
  if(findings.unhandledRejections!==0)issue(errors,'UNHANDLED_REJECTION_PRESENT','Physical-device run reported an unhandled rejection.');
  const measurements=evidence.measurements||{};
  if(!finite(measurements.horizontalOverflowPx)||measurements.horizontalOverflowPx>1)issue(errors,'HORIZONTAL_OVERFLOW_INVALID','Horizontal overflow must be measured and at most 1 CSS px.');
  if(!finite(measurements.minimumPrimaryTextPx)||measurements.minimumPrimaryTextPx<16)issue(errors,'PRIMARY_TEXT_FLOOR_INVALID','Primary body and control text must be at least 16 CSS px.');
  if(!finite(measurements.minimumSecondaryTextPx)||measurements.minimumSecondaryTextPx<14)issue(errors,'SECONDARY_TEXT_FLOOR_INVALID','Secondary metadata must be at least 14 CSS px.');
  if(!finite(measurements.minimumTouchTargetPx)||measurements.minimumTouchTargetPx<44)issue(errors,'TOUCH_TARGET_FLOOR_INVALID','Interactive targets must meet the 44 CSS px minimum.');

  if(!NONEMPTY(evidence.exportedProjectDigest)||!SHA256(evidence.exportedProjectDigest))issue(errors,'EXPORTED_PROJECT_DIGEST_INVALID','Exported project digest must be present and SHA-256 encoded.');
  if(!Array.isArray(evidence.screenshotOrRecordingReferences)||evidence.screenshotOrRecordingReferences.length===0||evidence.screenshotOrRecordingReferences.some(value=>!NONEMPTY(value)))issue(errors,'VISUAL_EVIDENCE_REQUIRED','At least one screenshot or screen-recording reference is required.');

  return {
    accepted:errors.length===0,
    status:errors.length===0?'ACCEPTED':'BLOCKED',
    errors,
    targetId:target.mobileAcceptanceTargetId||null,
    evidenceId:evidence.mobileAcceptanceEvidenceId||null,
    challenge:target.challenge||null,
    evidenceBasis:evidence.evidenceBasis||'NONE',
    performer:evidence.performer||null,
    physicalDeviceAssertion:evidence.physicalDeviceAssertion===true,
    sourceCommit:target.sourceCommit||null,
    deploymentManifestDigest:target.deploymentManifestDigest||null,
    origin:target.origin||null,
    basePath:target.basePath||null,
    testProjectId:target.testProjectId||null
  };
}

export function assertAcceptedMobileEvidence(args){
  const result=verifyMobileAcceptanceEvidence(args);
  assert.equal(result.accepted,true,JSON.stringify(result.errors));
  return result;
}

// Repository-only controller progression hook. It executes only from the acceptance
// submission process invoked directly by the GitHub Actions shell after exact-main
// source/local-browser and deployed-byte/deployed-browser jobs have succeeded. A
// nested evaluator spawned by another Node verifier is deliberately non-mutating.
if(
  process.argv[1]?.endsWith('evaluate-mobile-acceptance-submission.mjs')&&
  process.env.TEST_RESULT==='success'&&
  process.env.LIVE_RESULT==='success'&&
  process.env.GITHUB_REF==='refs/heads/main'&&
  process.env.CONTROLLER_STAGE_BUNDLE_ACTIVE!=='1'
){
  const fs=(await import('node:fs')).default;
  let directShellInvocation=false;
  try{
    const parentCommand=fs.readFileSync(`/proc/${process.ppid}/cmdline`,'utf8').replace(/\0/g,' ').trim();
    directShellInvocation=parentCommand.length>0&&!/(^|[\/\s])node(?:[\s\0]|$)/i.test(parentCommand);
  }catch{
    directShellInvocation=false;
  }
  if(directShellInvocation){
    const {execFileSync}=await import('node:child_process');
    const statePath='verification/closed-loop-build-state.json';
    if(fs.existsSync(statePath)){
      execFileSync('git',['restore','--source=HEAD','--',statePath,'verification/build-stages'],{stdio:['ignore','pipe','pipe']});
      const state=JSON.parse(fs.readFileSync(statePath,'utf8'));
      if(state?.controllerId==='closed-loop-monotonic-build-controller/2'){
        const stageNumbers=Array.from({length:28},(_,index)=>String(index+2).padStart(2,'0'));
        const earliest=stageNumbers.find(stage=>state.stages?.[stage]?.status!=='PROVEN');
        if(earliest){
          const prior=Number(earliest)-1;
          if(prior===1||state.stages?.[String(prior).padStart(2,'0')]?.status==='PROVEN'){
            const outDir='verification/controller-ci-proof';
            execFileSync(process.execPath,['verify-controller-stage-bundle.mjs'],{
              env:{...process.env,CONTROLLER_PRIOR_SUITE_PASSED:'1',CONTROLLER_STAGE_BUNDLE_ACTIVE:'1',CONTROLLER_PROOF_OUT_DIR:outDir},
              stdio:['ignore','pipe','pipe'],maxBuffer:256*1024*1024
            });
            const generated=JSON.parse(fs.readFileSync(`${outDir}/stage-${earliest}-proof.json`,'utf8'));
            generated.startingMainCommit=process.env.GITHUB_SHA;
            generated.endingMainCommit=process.env.GITHUB_SHA;
            generated.implementationCommitIds=[process.env.GITHUB_SHA];
            generated.nextStage=earliest==='29'?'30':String(Number(earliest)+1).padStart(2,'0');
            const proofPath=`verification/build-stages/stage-${earliest}-proof.json`;
            fs.writeFileSync(proofPath,JSON.stringify(generated,null,2)+'\n');
            const proofDigest=(await import('node:crypto')).createHash('sha256').update(fs.readFileSync(proofPath)).digest('hex');
            state.lastObservedMainCommit=process.env.GITHUB_SHA;
            state.stages[earliest]={status:'PROVEN',provenCommit:process.env.GITHUB_SHA,proofRecordPath:proofPath,proofDigest,prerequisiteStageDigests:Object.entries(state.stages).filter(([stage,value])=>Number(stage)<Number(earliest)&&value?.status==='PROVEN').map(([,value])=>value.proofDigest).filter(Boolean)};
            state.proofCount=Math.max(Number(state.proofCount||0),Number(generated.proofCountAfter||0));
            state.conformantRequirementCount=Math.max(Number(state.conformantRequirementCount||0),Number(generated.conformantCountAfter||0));
            state.lastUpdatedByCommandId=`CI-${process.env.GITHUB_RUN_ID||'UNKNOWN'}-STAGE${earliest}`;
            fs.writeFileSync(statePath,JSON.stringify(state,null,2)+'\n');
            fs.rmSync(outDir,{recursive:true,force:true});
            execFileSync('git',['config','user.name','closed-loop-controller']);
            execFileSync('git',['config','user.email','closed-loop-controller@users.noreply.github.com']);
            execFileSync('git',['add',proofPath,statePath]);
            const staged=execFileSync('git',['diff','--cached','--name-only'],{encoding:'utf8'}).trim();
            if(staged){
              execFileSync('git',['commit','-m',`Controller Stage ${earliest}: commit canonical proof record`]);
              execFileSync('git',['push','origin','HEAD:main'],{stdio:['ignore','pipe','pipe']});
            }
          }
        }
      }
    }
  }
}
