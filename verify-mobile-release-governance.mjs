import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyMobileAcceptanceEvidence,REQUIRED_MOBILE_RECEIPT_KINDS} from './verify-mobile-acceptance-evidence.mjs';
import {createMobileAcceptanceTarget,deploymentManifestDigest,verifyMobileAcceptanceSubmission} from './verify-mobile-acceptance-submission.mjs';

const WORKFLOW_PATH=new URL('./.github/workflows/pages.yml',import.meta.url);
const NONEMPTY=value=>typeof value==='string'&&value.trim().length>0;
const ACCEPTABLE_PHYSICAL_BASES=new Set(['HUMAN_OBSERVATION','VERIFIED_EXTERNAL']);
const SHA256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

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
  assert.match(workflow,/mobile_acceptance_target_json:/,'The one workflow must accept an authenticated pinned-target submission.');
  assert.match(workflow,/mobile_acceptance_evidence_json:/,'The one workflow must accept authenticated physical-device evidence.');
  assert.match(workflow,/MOBILE_ACCEPTANCE_MODE:\s*CREATE_TARGET/,'The workflow must create a pinned target/challenge against the exact deployed build.');
  assert.match(workflow,/verify-mobile-acceptance-submission\.mjs/,'The workflow must execute the physical-device evidence verifier rather than hardcode success.');
  assert.match(workflow,/mobile-challenge-/,'A successful physical-device proof must consume a persistent single-use challenge marker.');

  const tagStep=workflow.match(/\n\s*- name: Create release tag[^\n]*\n(?<body>[\s\S]*?)(?=\n\s*- name:|\s*$)/);
  assert.ok(tagStep,'A release-tag step must exist.');
  assert.match(tagStep.groups.body,/^\s*if:\s*steps\.acceptance\.outputs\.final_acceptance\s*==\s*'true'/m,'The push-path release-tag step must be conditionally gated by final acceptance.');
  assert.match(tagStep.groups.body,/git push origin "refs\/tags\/\$TAG"/,'The condition must govern the actual remote tag write.');

  const blockedStep=workflow.match(/\n\s*- name: Record blocked actual-iPhone acceptance[^\n]*\n(?<body>[\s\S]*?)(?=\n\s*- name:|\s*$)/);
  assert.ok(blockedStep,'A truthful blocked-status step must exist when physical proof is absent.');
  assert.match(blockedStep.groups.body,/if:\s*steps\.acceptance\.outputs\.final_acceptance\s*!=\s*'true'/,'The blocked-status step must be the complement of release eligibility.');
  assert.match(blockedStep.groups.body,/Release tag blocked/,'The blocked path must identify that no release tag was created.');

  const mobileJob=workflow.match(/\n\s*verify-mobile-acceptance:\n(?<body>[\s\S]*?)$/);
  assert.ok(mobileJob,'An authenticated mobile-acceptance verification job must exist in the single Pages workflow.');
  assert.match(mobileJob.groups.body,/needs:\s*test/,'Physical acceptance must follow the complete source/local proof job.');
  assert.match(mobileJob.groups.body,/verifyLiveDeploymentForMobile|verify-mobile-acceptance-submission\.mjs/,'Physical acceptance must bind live deployed bytes.');
  assert.match(mobileJob.groups.body,/verify-browser\.mjs/,'Deployed Chromium must be replayed before final physical acceptance publication.');
  assert.match(mobileJob.groups.body,/mobile-challenge-/,'Physical acceptance must make the challenge single-use across workflow runs.');
  assert.match(mobileJob.groups.body,/acceptance-\$\{GITHUB_SHA::12\}/,'The final tag must bind the exact accepted commit.');
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
  physicalDeviceAssertion:true,
  evidenceBasis:'HUMAN_OBSERVATION',
  performer:'authorized-operator',
  identityAssurance:'SELF_ASSERTED',
  iosVersion:'19.0',
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
assert.equal(verifyMobileAcceptanceEvidence({target,evidence:{...evidence,safariUserAgent:evidence.safariUserAgent.replace('Safari/604.1','CriOS/140.0.0.0 Mobile/15E148 Safari/604.1')},expected}).accepted,false,'A substitute iOS browser must be rejected.');
assert.equal(verifyMobileAcceptanceEvidence({target,evidence:{...evidence,operationReceipts:evidence.operationReceipts.slice(1)},expected}).accepted,false,'Missing required physical operator-path evidence must be rejected.');
assert.equal(verifyMobileAcceptanceEvidence({target,evidence,expected,usedChallenges:[target.challenge]}).accepted,false,'A reused physical acceptance challenge must be rejected.');
assert.equal(verifyMobileAcceptanceEvidence({target,evidence,expected:{...expected,verificationTime:'2026-09-04T00:00:00.000Z'}}).accepted,false,'Expired physical acceptance evidence must be rejected.');

const deployedBytes=Buffer.from('verified deployed runtime bytes','utf8');
const manifest={
  schema:'closed-loop-deployment-manifest/1',
  sourceCommit:target.sourceCommit,
  workflowRunIdentity:'1001',
  buildIdentity:'build-test',
  runtimeResources:[{path:'app-core.js',mediaType:'text/javascript; charset=utf-8',byteSize:deployedBytes.length,hashAlgorithm:'SHA-256',digest:SHA256(deployedBytes),buildIdentity:'build-test'}],
  manifestDigest:null
};
manifest.manifestDigest={hashAlgorithm:'SHA-256',digest:deploymentManifestDigest(manifest)};
const responseFor=(url,bytes)=>({status:200,url:String(url),arrayBuffer:async()=>Uint8Array.from(bytes).buffer});
const fakeFetch=async url=>{
  const parsed=new URL(url);
  if(parsed.pathname.endsWith('/closed-loop-deployment-manifest.json'))return responseFor(url,Buffer.from(JSON.stringify(manifest),'utf8'));
  if(parsed.pathname.endsWith('/app-core.js'))return responseFor(url,deployedBytes);
  return {status:404,url:String(url),arrayBuffer:async()=>new ArrayBuffer(0)};
};
const generatedTarget=await createMobileAcceptanceTarget({expectedCommit:target.sourceCommit,testProjectId:target.testProjectId,viewport:target.viewport,fetchImpl:fakeFetch,now:new Date('2026-09-02T20:00:00.000Z')});
assert.equal(generatedTarget.sourceCommit,target.sourceCommit,'Generated target must bind the exact deployed commit.');
assert.equal(generatedTarget.deploymentManifestDigest,manifest.manifestDigest.digest,'Generated target must bind the recomputed live manifest digest.');
assert.match(generatedTarget.challenge,/^[0-9a-f]{32}$/,'Generated target challenge must contain 128 random bits encoded as hex.');
const generatedEvidence={...evidence,mobileAcceptanceTargetId:generatedTarget.mobileAcceptanceTargetId,challenge:generatedTarget.challenge,sourceCommit:generatedTarget.sourceCommit,deploymentManifestDigest:generatedTarget.deploymentManifestDigest,origin:generatedTarget.origin,basePath:generatedTarget.basePath,testProjectId:generatedTarget.testProjectId,procedureVersion:generatedTarget.procedureVersion,viewport:{...generatedTarget.viewport}};
const submission=await verifyMobileAcceptanceSubmission({target:generatedTarget,evidence:generatedEvidence,expectedCommit:target.sourceCommit,fetchImpl:fakeFetch,verificationTime:'2026-09-03T00:00:00.000Z'});
assert.equal(submission.accepted,true,'Valid authenticated physical evidence must be executable through the live-deployment gate.');
assert.equal(releaseTagEligibility(submission.acceptance),true,'The executable acceptance result must satisfy release-tag eligibility.');
const mutatedFetch=async url=>{
  const parsed=new URL(url);
  if(parsed.pathname.endsWith('/closed-loop-deployment-manifest.json'))return responseFor(url,Buffer.from(JSON.stringify(manifest),'utf8'));
  if(parsed.pathname.endsWith('/app-core.js'))return responseFor(url,Buffer.from('modified bytes','utf8'));
  return {status:404,url:String(url),arrayBuffer:async()=>new ArrayBuffer(0)};
};
await assert.rejects(()=>verifyMobileAcceptanceSubmission({target:generatedTarget,evidence:generatedEvidence,expectedCommit:target.sourceCommit,fetchImpl:mutatedFetch,verificationTime:'2026-09-03T00:00:00.000Z'}),/byte length differs|bytes differ/,'Changed deployed bytes must reject physical acceptance before tagging.');

const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');
assertWorkflowGovernance(workflow);
const unconditionalMutation=workflow.replace(/\n\s*if:\s*steps\.acceptance\.outputs\.final_acceptance\s*==\s*'true'/,'');
assert.throws(()=>assertWorkflowGovernance(unconditionalMutation),/conditionally gated/,'The regression must fail when release tagging becomes unconditional.');
const androidSubstitutionMutation=workflow.replace('actualIPhoneSafariAcceptance:false','actualAndroidChromeAcceptance:true');
assert.throws(()=>assertWorkflowGovernance(androidSubstitutionMutation),/Android acceptance/,'The regression must fail when Android is substituted for the required iPhone target.');
const disconnectedSubmissionMutation=workflow.replace(/\n\s*verify-mobile-acceptance:[\s\S]*$/,'\n');
assert.throws(()=>assertWorkflowGovernance(disconnectedSubmissionMutation),/verification job/,'The regression must fail when valid physical evidence has no executable CI path.');

console.log(JSON.stringify({
  mobileReleaseGovernance:'PASS',
  actualIPhoneRequiredForTag:true,
  deployedChromiumAloneInsufficient:true,
  androidSubstitutionRejected:true,
  missingEvidenceBlocks:true,
  selfAssertionRejected:true,
  canonicalOriginBound:true,
  exactTargetBindingVerified:true,
  singleUseChallengeVerified:true,
  expiredChallengeRejected:true,
  substituteIosBrowserRejected:true,
  requiredOperatorPathReceiptCoverage:true,
  executableTargetGenerationVerified:true,
  executableEvidenceSubmissionVerified:true,
  liveByteMutationRejected:true,
  disconnectedEvidencePathMutationDetected:true,
  unconditionalTagMutationDetected:true,
  falseAcceptanceTagRegressionCovered:true
},null,2));