import fs from 'node:fs';
import assert from 'node:assert/strict';
import {verifyMobileAcceptanceEvidence,REQUIRED_MOBILE_RECEIPT_KINDS} from './verify-mobile-acceptance-evidence.mjs';
import {evaluateMobileAcceptanceSubmission} from './evaluate-mobile-acceptance-submission.mjs';

const WORKFLOW_PATH=new URL('./.github/workflows/pages.yml',import.meta.url);
const NONEMPTY=value=>typeof value==='string'&&value.trim().length>0;
const ACCEPTABLE_PHYSICAL_BASES=new Set(['HUMAN_OBSERVATION','VERIFIED_EXTERNAL']);

export function releaseTagEligibility(status){
  return Boolean(
    status&&
    status.actualIPhoneSafariAcceptance===true&&
    status.mobileAcceptanceResult==='ACCEPTED'&&
    NONEMPTY(status.mobileAcceptanceTargetId)&&
    NONEMPTY(status.mobileAcceptanceEvidenceId)&&
    ACCEPTABLE_PHYSICAL_BASES.has(status.mobileAcceptanceEvidenceBasis)&&
    NONEMPTY(status.mobileAcceptanceSourceCommit)&&
    NONEMPTY(status.mobileAcceptanceDeploymentManifestDigest)&&
    status.mobileAcceptanceOrigin==='https://sjonesjones917.github.io'&&
    status.mobileAcceptanceBasePath==='/closed-loop-tracker/'&&
    NONEMPTY(status.mobileAcceptanceTestProjectId)&&
    NONEMPTY(status.mobileAcceptancePerformer)&&
    status.mobileAcceptancePhysicalDeviceAssertion===true
  );
}

export function assertWorkflowGovernance(workflow){
  assert.doesNotMatch(workflow,/actualAndroidChromeAcceptance/,'Android acceptance must not substitute for the pinned actual-iPhone requirement.');
  assert.match(workflow,/actualIPhoneSafariAcceptance/,'The acceptance calculation must consume actual-iPhone Safari status.');
  assert.match(workflow,/mobileAcceptanceResult/,'The acceptance calculation must consume the physical-device result.');
  assert.match(workflow,/finalAcceptancePublication/,'The acceptance artifact must distinguish status publication from final acceptance publication.');
  assert.match(workflow,/id:\s*acceptance\b/,'The acceptance-report step must expose its gate result.');
  assert.match(workflow,/actual_iphone=\$\{report\.actualIPhoneSafariAcceptance\}/,'The report step must publish the physical-iPhone result through GITHUB_OUTPUT.');
  assert.match(workflow,/final_acceptance=\$\{report\.finalAcceptancePublication\}/,'The report step must publish final-acceptance eligibility through GITHUB_OUTPUT.');
  assert.match(workflow,/fs\.appendFileSync\(process\.env\.GITHUB_OUTPUT/,'The release decision must be passed from the exact generated report.');
  assert.match(workflow,/mobile_acceptance_target_json:/,'Authenticated workflow dispatch must accept the pinned mobile target JSON.');
  assert.match(workflow,/mobile_acceptance_evidence_json:/,'Authenticated workflow dispatch must accept physical mobile evidence JSON.');
  assert.match(workflow,/node evaluate-mobile-acceptance-submission\.mjs > \/tmp\/mobile-acceptance\.json/,'The acceptance job must execute the strict mobile-evidence evaluator.');
  assert.match(workflow,/const mobileAcceptance=JSON\.parse\(fs\.readFileSync\('\/tmp\/mobile-acceptance\.json','utf8'\)\)/,'The machine acceptance artifact must consume the evaluator result.');
  assert.match(workflow,/\.\.\.mobileAcceptance/,'The complete accepted or blocked physical-device result must be projected into the machine acceptance artifact.');
  assert.doesNotMatch(workflow,/actualIPhoneSafariAcceptance:false/,'The workflow must not hard-code physical-iPhone acceptance to false after evaluating submitted evidence.');
  assert.match(workflow,/mobile-acceptance-challenge-\$CHALLENGE/,'Accepted challenges must be durably marked as used.');
  assert.match(workflow,/refs\/tags\/\$CHALLENGE_TAG/,'The used-challenge marker must be written as a repository tag.');

  const tagStep=workflow.match(/\n\s*- name: Create release tag[^\n]*\n(?<body>[\s\S]*?)(?=\n\s*- name:|\s*$)/);
  assert.ok(tagStep,'A release-tag step must exist.');
  assert.match(tagStep.groups.body,/^\s*if:\s*steps\.acceptance\.outputs\.final_acceptance\s*==\s*'true'/m,'The release-tag step must be conditionally gated by final acceptance.');
  assert.match(tagStep.groups.body,/git push origin/,'The condition must govern the actual remote tag write.');

  const blockedStep=workflow.match(/\n\s*- name: Record blocked actual-iPhone acceptance[^\n]*\n(?<body>[\s\S]*?)(?=\n\s*- name:|\s*$)/);
  assert.ok(blockedStep,'A truthful blocked-status step must exist when physical proof is absent.');
  assert.match(blockedStep.groups.body,/if:\s*steps\.acceptance\.outputs\.final_acceptance\s*!=\s*'true'/,'The blocked-status step must be the complement of release eligibility.');
  assert.match(blockedStep.groups.body,/Release tag blocked/,'The blocked path must identify that no release tag was created.');

  return true;
}

const completePhysicalEvidence={
  actualIPhoneSafariAcceptance:true,
  mobileAcceptanceResult:'ACCEPTED',
  mobileAcceptanceTargetId:'MOBILE-TARGET-001',
  mobileAcceptanceEvidenceId:'MOBILE-EVIDENCE-001',
  mobileAcceptanceEvidenceBasis:'HUMAN_OBSERVATION',
  mobileAcceptanceSourceCommit:'0123456789abcdef0123456789abcdef01234567',
  mobileAcceptanceDeploymentManifestDigest:'a'.repeat(64),
  mobileAcceptanceOrigin:'https://sjonesjones917.github.io',
  mobileAcceptanceBasePath:'/closed-loop-tracker/',
  mobileAcceptanceTestProjectId:'JOB-MOBILE-001',
  mobileAcceptancePerformer:'authorized-operator',
  mobileAcceptancePhysicalDeviceAssertion:true
};

assert.equal(releaseTagEligibility(completePhysicalEvidence),true,'Complete pinned physical-iPhone evidence must be eligible.');
assert.equal(releaseTagEligibility({...completePhysicalEvidence,actualIPhoneSafariAcceptance:false}),false,'A deployed Chromium pass cannot substitute for physical-iPhone acceptance.');
assert.equal(releaseTagEligibility({...completePhysicalEvidence,mobileAcceptanceResult:'BLOCKED'}),false,'A blocked physical-device result cannot authorize a tag.');
assert.equal(releaseTagEligibility({...completePhysicalEvidence,mobileAcceptanceEvidenceId:null}),false,'Missing physical evidence must block tagging.');
assert.equal(releaseTagEligibility({...completePhysicalEvidence,mobileAcceptanceEvidenceBasis:'SELF_ASSERTED'}),false,'Self-asserted evidence cannot satisfy the pinned physical-device gate.');
assert.equal(releaseTagEligibility({...completePhysicalEvidence,mobileAcceptanceOrigin:'https://example.invalid'}),false,'A different origin cannot satisfy the canonical deployment identity.');
assert.equal(releaseTagEligibility({...completePhysicalEvidence,actualAndroidChromeAcceptance:true,actualIPhoneSafariAcceptance:false}),false,'Android acceptance cannot satisfy the iPhone requirement.');

const target={
  mobileAcceptanceTargetId:'MOBILE-TARGET-001',
  physicalDeviceRequired:true,
  deviceHardwareClass:'iPhone physical test device',
  iosVersion:'19.0',
  iosBuild:'23A000',
  safariVersion:'19.0',
  webKitBuildIdentity:'605.1.15',
  performer:'authorized-operator',
  identityAssurance:'SELF_ASSERTED',
  challenge:'0123456789abcdef0123456789abcdef',
  challengeIssuedAt:'2026-09-02T20:00:00.000Z',
  challengeExpiresAt:'2026-09-03T20:00:00.000Z',
  sourceCommit:'0123456789abcdef0123456789abcdef01234567',
  deploymentManifestDigest:'a'.repeat(64),
  origin:'https://sjonesjones917.github.io',
  basePath:'/closed-loop-tracker/',
  testProjectId:'JOB-MOBILE-001',
  procedureVersion:'actual-iphone-safari/1',
  viewport:{width:393,height:852,devicePixelRatio:3}
};
const evidence={
  mobileAcceptanceEvidenceId:'MOBILE-EVIDENCE-001',
  mobileAcceptanceTargetId:target.mobileAcceptanceTargetId,
  challenge:target.challenge,
  sourceCommit:target.sourceCommit,
  deploymentManifestDigest:target.deploymentManifestDigest,
  origin:target.origin,
  basePath:target.basePath,
  testProjectId:target.testProjectId,
  procedureVersion:target.procedureVersion,
  deviceHardwareClass:target.deviceHardwareClass,
  iosVersion:target.iosVersion,
  iosBuild:target.iosBuild,
  safariVersion:target.safariVersion,
  webKitBuildIdentity:target.webKitBuildIdentity,
  physicalDeviceAssertion:true,
  evidenceBasis:'HUMAN_OBSERVATION',
  performer:target.performer,
  identityAssurance:target.identityAssurance,
  safariUserAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1',
  viewport:{...target.viewport},
  operationReceipts:REQUIRED_MOBILE_RECEIPT_KINDS.map((kind,index)=>({kind,receiptId:`MR-${String(index+1).padStart(3,'0')}`,result:'PASS'})),
  runtimeFindings:{runtimeExceptions:0,unhandledRejections:0},
  measurements:{horizontalOverflowPx:0,minimumPrimaryTextPx:16,minimumSecondaryTextPx:14,minimumTouchTargetPx:44},
  exportedProjectDigest:'b'.repeat(64),
  screenshotOrRecordingReferences:['capture-001']
};
const expected={sourceCommit:target.sourceCommit,deploymentManifestDigest:target.deploymentManifestDigest,origin:target.origin,basePath:target.basePath,verificationTime:'2026-09-03T00:00:00.000Z'};
assert.equal(verifyMobileAcceptanceEvidence({target,evidence,expected}).accepted,true,'Complete pinned mobile evidence must validate.');
assert.equal(verifyMobileAcceptanceEvidence({target,evidence:{...evidence,challenge:'f'.repeat(32)},expected}).accepted,false,'Mismatched challenge must be rejected.');
assert.equal(verifyMobileAcceptanceEvidence({target,evidence:{...evidence,deviceHardwareClass:'iPad'},expected}).accepted,false,'A different hardware class must be rejected.');
assert.equal(verifyMobileAcceptanceEvidence({target,evidence:{...evidence,iosBuild:'DIFFERENT'},expected}).accepted,false,'A changed iOS build must be rejected.');
assert.equal(verifyMobileAcceptanceEvidence({target,evidence:{...evidence,safariUserAgent:evidence.safariUserAgent.replace('Safari/604.1','CriOS/140.0.0.0 Mobile/15E148 Safari/604.1')},expected}).accepted,false,'A substitute iOS browser must be rejected.');
assert.equal(verifyMobileAcceptanceEvidence({target,evidence:{...evidence,operationReceipts:evidence.operationReceipts.slice(1)},expected}).accepted,false,'Missing required physical operator-path evidence must be rejected.');
assert.equal(verifyMobileAcceptanceEvidence({target,evidence,expected,usedChallenges:[target.challenge]}).accepted,false,'A reused physical acceptance challenge must be rejected.');
assert.equal(verifyMobileAcceptanceEvidence({target,evidence,expected:{...expected,verificationTime:'2026-09-04T00:00:00.000Z'}}).accepted,false,'Expired physical acceptance evidence must be rejected.');

const noSubmission=evaluateMobileAcceptanceSubmission();
assert.equal(noSubmission.actualIPhoneSafariAcceptance,false,'No physical evidence submission must remain blocked.');
assert.equal(noSubmission.mobileAcceptanceResult,'BLOCKED_ENVIRONMENT','No physical evidence submission must report an environment blocker.');
const acceptedSubmission=evaluateMobileAcceptanceSubmission({targetJson:JSON.stringify(target),evidenceJson:JSON.stringify(evidence),expected,submitter:'acceptance-controller'});
assert.equal(acceptedSubmission.actualIPhoneSafariAcceptance,true,'Valid authenticated physical evidence must be capable of satisfying the acceptance bridge.');
assert.equal(acceptedSubmission.mobileAcceptanceResult,'ACCEPTED','Valid authenticated physical evidence must publish ACCEPTED.');
assert.equal(acceptedSubmission.mobileAcceptanceSubmitter,'acceptance-controller','The authenticated submitter must be retained.');
const reusedSubmission=evaluateMobileAcceptanceSubmission({targetJson:JSON.stringify(target),evidenceJson:JSON.stringify(evidence),expected,usedChallenges:[target.challenge.toUpperCase()]});
assert.equal(reusedSubmission.actualIPhoneSafariAcceptance,false,'A previously used challenge must not satisfy acceptance.');
assert.equal(reusedSubmission.mobileAcceptanceResult,'BLOCKED','Challenge reuse must fail closed.');
const partialSubmission=evaluateMobileAcceptanceSubmission({targetJson:JSON.stringify(target),evidenceJson:''});
assert.equal(partialSubmission.mobileAcceptanceResult,'BLOCKED','Target and evidence must be submitted together.');

const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');
assertWorkflowGovernance(workflow);
const unconditionalMutation=workflow.replace(/\n\s*if:\s*steps\.acceptance\.outputs\.final_acceptance\s*==\s*'true'/,'');
assert.throws(()=>assertWorkflowGovernance(unconditionalMutation),/conditionally gated/,'The regression must fail when release tagging becomes unconditional.');
const hardCodedBlockMutation=workflow.replace('...mobileAcceptance,','...mobileAcceptance,actualIPhoneSafariAcceptance:false,');
assert.throws(()=>assertWorkflowGovernance(hardCodedBlockMutation),/hard-code/,'The regression must fail when valid physical evidence is made impossible to accept.');
const missingEvaluatorMutation=workflow.replace('node evaluate-mobile-acceptance-submission.mjs > /tmp/mobile-acceptance.json','true');
assert.throws(()=>assertWorkflowGovernance(missingEvaluatorMutation),/strict mobile-evidence evaluator/,'The regression must fail when the workflow stops executing the evidence verifier.');

console.log(JSON.stringify({
  mobileReleaseGovernance:'PASS',
  actualIPhoneRequiredForTag:true,
  deployedChromiumAloneInsufficient:true,
  androidSubstitutionRejected:true,
  missingEvidenceBlocks:true,
  selfAssertionRejected:true,
  canonicalOriginBound:true,
  exactTargetBindingVerified:true,
  pinnedHardwareClassVerified:true,
  pinnedIosBuildVerified:true,
  pinnedSafariAndWebKitVerified:true,
  singleUseChallengeVerified:true,
  expiredChallengeRejected:true,
  substituteIosBrowserRejected:true,
  requiredOperatorPathReceiptCoverage:true,
  authenticatedEvidenceBridgeAcceptsValidProof:true,
  absentEvidenceRemainsBlocked:true,
  partialSubmissionRejected:true,
  usedChallengeRejectedAcrossCaseVariants:true,
  workflowExecutesStrictEvidenceEvaluator:true,
  unconditionalTagMutationDetected:true,
  falseAcceptanceTagRegressionCovered:true
},null,2));