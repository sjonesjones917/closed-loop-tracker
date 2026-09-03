import fs from 'node:fs';
import assert from 'node:assert/strict';
import {verifyMobileAcceptanceEvidence,REQUIRED_MOBILE_RECEIPT_KINDS} from './verify-mobile-acceptance-evidence.mjs';
import {runPublicationRegressions} from './verify-mobile-acceptance-publication.mjs';

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
  assert.match(workflow,/\.\.\.mobilePublication/,'The machine acceptance artifact must consume the verified physical-publication object rather than hard-code physical fields.');
  assert.match(workflow,/finalAcceptancePublication/,'The acceptance artifact must distinguish status publication from final acceptance publication.');
  assert.match(workflow,/id:\s*acceptance\b/,'The acceptance-report step must expose its gate result.');
  assert.match(workflow,/actual_iphone=\$\{report\.actualIPhoneSafariAcceptance\}/,'The report step must publish the physical-iPhone result through GITHUB_OUTPUT.');
  assert.match(workflow,/final_acceptance=\$\{report\.finalAcceptancePublication\}/,'The report step must publish final-acceptance eligibility through GITHUB_OUTPUT.');
  assert.match(workflow,/fs\.appendFileSync\(process\.env\.GITHUB_OUTPUT/,'The release decision must be passed from the exact generated report.');
  assert.match(workflow,/verify-mobile-acceptance-publication\.mjs/,'The workflow must execute the physical-evidence publication bridge.');
  assert.match(workflow,/mobile_acceptance_target_json/,'Authenticated workflow input for the pinned mobile target is missing.');
  assert.match(workflow,/mobile_acceptance_evidence_json/,'Authenticated workflow input for physical-device evidence is missing.');
  assert.match(workflow,/Finalize pinned actual-iPhone acceptance/,'The workflow must contain an executable finalization path for valid physical evidence.');

  const tagStep=workflow.match(/\n\s*- name: Create release tag[^\n]*\n(?<body>[\s\S]*?)(?=\n\s*- name:|\s*$)/);
  assert.ok(tagStep,'A release-tag step must exist.');
  assert.match(tagStep.groups.body,/^\s*if:\s*steps\.acceptance\.outputs\.final_acceptance\s*==\s*'true'/m,'The release-tag step must be conditionally gated by final acceptance.');
  assert.match(tagStep.groups.body,/git push origin "refs\/tags\/\$TAG"/,'The condition must govern the actual remote tag write.');

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

const safariUserAgent='Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1';
const target={
  mobileAcceptanceTargetId:'MOBILE-TARGET-001',
  physicalDeviceRequired:true,
  challenge:'0123456789abcdef0123456789abcdef',
  challengeIssuedAt:'2026-09-02T20:00:00.000Z',
  challengeExpiresAt:'2026-09-03T20:00:00.000Z',
  sourceCommit:'0123456789abcdef0123456789abcdef01234567',
  deploymentManifestDigest:'a'.repeat(64),
  origin:'https://sjonesjones917.github.io',
  basePath:'/closed-loop-tracker/',
  testProjectId:'JOB-MOBILE-001',
  procedureVersion:'actual-iphone-safari/1',
  iosVersion:'19.0',
  safariUserAgent,
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
  physicalDeviceAssertion:true,
  evidenceBasis:'HUMAN_OBSERVATION',
  performer:'authorized-operator',
  identityAssurance:'SELF_ASSERTED',
  iosVersion:target.iosVersion,
  safariUserAgent:target.safariUserAgent,
  viewport:{...target.viewport},
  operationReceipts:REQUIRED_MOBILE_RECEIPT_KINDS.map((kind,index)=>({kind,receiptId:`MR-${String(index+1).padStart(3,'0')}`,result:'PASS'})),
  runtimeFindings:{runtimeExceptions:0,unhandledRejections:0},
  measurements:{horizontalOverflowPx:0,minimumPrimaryTextPx:16,minimumSecondaryTextPx:14,minimumTouchTargetPx:44},
  exportedProjectDigest:'b'.repeat(64),
  screenshotOrRecordingReferences:['capture-001']
};
const expected={sourceCommit:target.sourceCommit,deploymentManifestDigest:target.deploymentManifestDigest,origin:target.origin,basePath:target.basePath,verificationTime:'2026-09-03T00:00:00.000Z'};
assert.equal(verifyMobileAcceptanceEvidence({target,evidence,expected}).accepted,true,'Complete pinned mobile evidence must validate.');
assert.equal(verifyMobileAcceptanceEvidence({target:{...target,iosVersion:''},evidence,expected}).accepted,false,'Target without pinned iOS version must be rejected.');
assert.equal(verifyMobileAcceptanceEvidence({target:{...target,safariUserAgent:''},evidence,expected}).accepted,false,'Target without pinned Safari identity must be rejected.');
assert.equal(verifyMobileAcceptanceEvidence({target,evidence:{...evidence,iosVersion:'18.7'},expected}).accepted,false,'Evidence from a changed iOS version must be rejected.');
assert.equal(verifyMobileAcceptanceEvidence({target,evidence:{...evidence,challenge:'f'.repeat(32)},expected}).accepted,false,'Mismatched challenge must be rejected.');
assert.equal(verifyMobileAcceptanceEvidence({target,evidence:{...evidence,safariUserAgent:evidence.safariUserAgent.replace('Safari/604.1','CriOS/140.0.0.0 Mobile/15E148 Safari/604.1')},expected}).accepted,false,'A substitute iOS browser must be rejected.');
assert.equal(verifyMobileAcceptanceEvidence({target,evidence:{...evidence,operationReceipts:evidence.operationReceipts.slice(1)},expected}).accepted,false,'Missing required physical operator-path evidence must be rejected.');
assert.equal(verifyMobileAcceptanceEvidence({target,evidence,expected,usedChallenges:[target.challenge]}).accepted,false,'A reused physical acceptance challenge must be rejected.');
assert.equal(verifyMobileAcceptanceEvidence({target,evidence,expected:{...expected,verificationTime:'2026-09-04T00:00:00.000Z'}}).accepted,false,'Expired physical acceptance evidence must be rejected.');

const publicationRegressions=runPublicationRegressions();
assert.equal(publicationRegressions.validEvidenceCanPublish,true,'Valid physical evidence must have a reachable publication path.');

const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');
assertWorkflowGovernance(workflow);
const unconditionalMutation=workflow.replace(/\n\s*if:\s*steps\.acceptance\.outputs\.final_acceptance\s*==\s*'true'/,'');
assert.throws(()=>assertWorkflowGovernance(unconditionalMutation),/conditionally gated/,'The regression must fail when release tagging becomes unconditional.');
const androidSubstitutionMutation=workflow.replace('actualIPhoneSafariAcceptance:false','actualAndroidChromeAcceptance:true');
assert.throws(()=>assertWorkflowGovernance(androidSubstitutionMutation),/Android acceptance/,'The regression must fail when Android is substituted for the required iPhone target.');
const missingPublicationBridgeMutation=workflow.replace(/verify-mobile-acceptance-publication\.mjs/g,'missing-mobile-publication-bridge.mjs');
assert.throws(()=>assertWorkflowGovernance(missingPublicationBridgeMutation),/publication bridge/,'The regression must fail when valid physical evidence has no executable publication bridge.');

console.log(JSON.stringify({
  mobileReleaseGovernance:'PASS',
  actualIPhoneRequiredForTag:true,
  deployedChromiumAloneInsufficient:true,
  androidSubstitutionRejected:true,
  missingEvidenceBlocks:true,
  selfAssertionRejected:true,
  canonicalOriginBound:true,
  exactTargetBindingVerified:true,
  pinnedIosAndSafariIdentityVerified:true,
  singleUseChallengeVerified:true,
  expiredChallengeRejected:true,
  substituteIosBrowserRejected:true,
  requiredOperatorPathReceiptCoverage:true,
  validEvidenceCanPublish:true,
  unconditionalTagMutationDetected:true,
  falseAcceptanceTagRegressionCovered:true
},null,2));