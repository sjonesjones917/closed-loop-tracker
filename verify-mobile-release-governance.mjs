import fs from 'node:fs';
import assert from 'node:assert/strict';

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
  assert.match(workflow,/actualIPhoneSafariAcceptance/,'The acceptance artifact must publish actual-iPhone Safari status.');
  assert.match(workflow,/mobileAcceptanceResult/,'The acceptance artifact must publish the physical-device result.');
  assert.match(workflow,/mobileAcceptanceTargetId/,'The acceptance artifact must publish the pinned target identity.');
  assert.match(workflow,/mobileAcceptanceEvidenceId/,'The acceptance artifact must publish the evidence identity.');
  assert.match(workflow,/mobileAcceptanceEvidenceBasis/,'The acceptance artifact must publish the actual evidence basis.');
  assert.match(workflow,/finalAcceptancePublication/,'The acceptance artifact must distinguish status publication from final acceptance publication.');
  assert.match(workflow,/id:\s*acceptance\b/,'The acceptance-report step must expose its gate result.');
  assert.match(workflow,/actual_iphone=\$\{report\.actualIPhoneSafariAcceptance\}/,'The report step must publish the physical-iPhone result through GITHUB_OUTPUT.');
  assert.match(workflow,/final_acceptance=\$\{report\.finalAcceptancePublication\}/,'The report step must publish final-acceptance eligibility through GITHUB_OUTPUT.');
  assert.match(workflow,/fs\.appendFileSync\(process\.env\.GITHUB_OUTPUT/,'The release decision must be passed from the exact generated report.');

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

const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');
assertWorkflowGovernance(workflow);
const unconditionalMutation=workflow.replace(/\n\s*if:\s*steps\.acceptance\.outputs\.final_acceptance\s*==\s*'true'/,'');
assert.throws(()=>assertWorkflowGovernance(unconditionalMutation),/conditionally gated/,'The regression must fail when release tagging becomes unconditional.');
const androidSubstitutionMutation=workflow.replace('actualIPhoneSafariAcceptance:false','actualAndroidChromeAcceptance:true');
assert.throws(()=>assertWorkflowGovernance(androidSubstitutionMutation),/Android acceptance/,'The regression must fail when Android is substituted for the required iPhone target.');

console.log(JSON.stringify({
  mobileReleaseGovernance:'PASS',
  actualIPhoneRequiredForTag:true,
  deployedChromiumAloneInsufficient:true,
  androidSubstitutionRejected:true,
  missingEvidenceBlocks:true,
  selfAssertionRejected:true,
  canonicalOriginBound:true,
  unconditionalTagMutationDetected:true,
  falseAcceptanceTagRegressionCovered:true
},null,2));
