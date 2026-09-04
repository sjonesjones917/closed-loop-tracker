import assert from 'node:assert/strict';

export const MOBILE_ACCEPTANCE_ORIGIN='https://sjonesjones917.github.io';
export const MOBILE_ACCEPTANCE_BASE_PATH='/closed-loop-tracker/';
export const ACCEPTABLE_PHYSICAL_EVIDENCE_BASES=Object.freeze(['HUMAN_OBSERVATION','VERIFIED_EXTERNAL']);
export const REQUIRED_MOBILE_RECEIPT_KINDS=Object.freeze([
  'MOBILE_CAPABILITY_PROBE_COMPLETED',
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
  'FOCUS_AND_LIVE_REGION_VERIFIED',
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
  if(!NONEMPTY(target.deviceHardwareClass))issue(errors,'TARGET_HARDWARE_CLASS_REQUIRED','The pinned iPhone hardware class is required.');
  if(!/^iPhone/i.test(target.deviceHardwareClass||''))issue(errors,'TARGET_HARDWARE_CLASS_INVALID','The pinned hardware class must identify an iPhone.');
  if(!NONEMPTY(target.iosVersion))issue(errors,'TARGET_IOS_VERSION_REQUIRED','The exact pinned iOS version is required.');
  if(!NONEMPTY(target.iosBuild))issue(errors,'TARGET_IOS_BUILD_REQUIRED','The exact pinned iOS build is required.');
  if(!NONEMPTY(target.safariVersion))issue(errors,'TARGET_SAFARI_VERSION_REQUIRED','The pinned Safari version is required.');
  if(!NONEMPTY(target.webKitBuildIdentity))issue(errors,'TARGET_WEBKIT_IDENTITY_REQUIRED','The pinned observable WebKit build identity is required.');
  if(!NONEMPTY(target.performer))issue(errors,'TARGET_PERFORMER_REQUIRED','The pinned performer identity is required.');
  if(!NONEMPTY(target.identityAssurance))issue(errors,'TARGET_IDENTITY_ASSURANCE_REQUIRED','The pinned performer identity assurance is required.');
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
    ['procedureVersion','EVIDENCE_PROCEDURE_MISMATCH'],
    ['deviceHardwareClass','EVIDENCE_HARDWARE_CLASS_MISMATCH'],
    ['iosVersion','EVIDENCE_IOS_VERSION_MISMATCH'],
    ['iosBuild','EVIDENCE_IOS_BUILD_MISMATCH'],
    ['safariVersion','EVIDENCE_SAFARI_VERSION_MISMATCH'],
    ['webKitBuildIdentity','EVIDENCE_WEBKIT_IDENTITY_MISMATCH'],
    ['performer','EVIDENCE_PERFORMER_MISMATCH'],
    ['identityAssurance','EVIDENCE_IDENTITY_ASSURANCE_MISMATCH']
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