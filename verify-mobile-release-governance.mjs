import {syntheticMobileOperations,syntheticMobileTargetFacts} from './mobile-evidence-test-fixture.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {verifyMobileAcceptanceEvidence,REQUIRED_MOBILE_RECEIPT_KINDS,REQUIRED_MOBILE_CAPABILITY_PROBE_KEYS,isClosedLoopUtcInstant} from './verify-mobile-acceptance-evidence.mjs';
import {evaluateMobileAcceptanceSubmission} from './evaluate-mobile-acceptance-submission.mjs';
import {createMobileChallengeClaim,readMobileChallengeClaim,validateMobileChallengeClaim,mobileClaimRef} from './mobile-acceptance-claim.mjs';
import {createHash} from 'node:crypto';

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

export function assertRepositoryReadOnlyCI(workflow){
  assert.doesNotMatch(workflow,/permissions:\s*write-all|contents:\s*write/,'CI_READ_ONLY_PERMISSION_ORACLE: CI must not have repository write permission.');
  assert.doesNotMatch(workflow,/\bgit\s+push\b|github\.rest\.git\.(?:create|update|delete)|createOrUpdateFileContents/,'CI_READ_ONLY_REPOSITORY_ORACLE: CI publishes artifacts and status, not repository mutations.');
}

export function assertJobScopedCIPermissions(workflow){
  const readPermissions=(text,indent)=>{
    const block=new RegExp('^'+indent+'permissions:\\n((?:'+indent+'  [^\\n]+\\n)+)','m').exec(text)?.[1];
    return block?Object.fromEntries(block.trim().split('\n').map(line=>line.trim().split(/:\s*/))):null;
  };
  const defaults=readPermissions(workflow,'');
  assert.deepEqual(defaults,{contents:'read'},'CI_JOB_PERMISSION_ORACLE: default execution must only read repository contents.');
  const jobs=[...workflow.slice(workflow.indexOf('\njobs:\n')).matchAll(/^  ([a-z][a-z-]*):\n([\s\S]*?)(?=^  [a-z][a-z-]*:\n|(?![\s\S]))/gm)];
  const expected={foundation:{contents:'read',actions:'read','pull-requests':'read'},'deferred-matrix':{contents:'read',actions:'read','pull-requests':'read'},'workflow-gates':{contents:'read',actions:'read','pull-requests':'read'},conformance:{contents:'read',actions:'read','pull-requests':'read'},test:{contents:'read',actions:'read','pull-requests':'read'},deploy:{pages:'write','id-token':'write'},'verify-live':{contents:'read'},'publish-status':{contents:'read'}};
  assert.deepEqual(jobs.map(match=>match[1]).sort(),Object.keys(expected).sort(),'CI_JOB_PERMISSION_ORACLE: job permission inventory changed.');
  for(const [,name,body]of jobs)assert.deepEqual(readPermissions(body,'    ')||defaults,expected[name],'CI_JOB_PERMISSION_ORACLE: incorrect privileges for '+name);
}

export function assertWorkflowGovernance(workflow){
  assertRepositoryReadOnlyCI(workflow);
  assertJobScopedCIPermissions(workflow);
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
  assert.match(workflow,/const executedEvidence=await readReleaseExecutedEvidence\(/,'The acceptance job must validate raw physical inputs through the current release evidence owner.');
  assert.match(workflow,/const mobileAcceptance=executedEvidence\.externalMobileResult\|\|evaluateMobileAcceptanceSubmission\(executedEvidence\.externalMobile\|\|\{submitter:process\.env\.GITHUB_ACTOR\}\)/,'The machine acceptance artifact must consume the strict evaluator result from retained validated raw inputs.');
  assert.match(workflow,/\.\.\.mobileAcceptance/,'The complete accepted or blocked physical-device result must be projected into the machine acceptance artifact.');
  assert.doesNotMatch(workflow,/actualIPhoneSafariAcceptance:false/,'The workflow must not hard-code physical-iPhone acceptance to false after evaluating submitted evidence.');
  assert.match(workflow,/USED_MOBILE_CHALLENGES_JSON/,'The evaluator must read durable used-challenge markers.');
  assert.match(workflow,/git ls-remote --tags origin 'refs\/tags\/mobile-acceptance-challenge-\*'/,'Challenge reuse must be checked against repository markers.');
  assert.match(workflow,/authorized repository connection to recheck this exact acceptance report and its previously claimed challenge, then create the release tag/,'Publication must use the challenge claimed before acceptance.');
  assert.match(workflow,/mobileAcceptanceClaim:executedEvidence\.externalMobile\?\.challengeClaimReference\|\|null/,'The acceptance artifact must retain its validated durable claim identity.');

  const eligibilityStep=workflow.match(/\n\s*- name: Record release tag eligibility[^\n]*\n(?<body>[\s\S]*?)(?=\n\s*- name:|\s*$)/);
  assert.ok(eligibilityStep,'A release-tag eligibility status step must exist.');
  assert.match(eligibilityStep.groups.body,/^\s*if:\s*steps\.acceptance\.outputs\.final_acceptance\s*==\s*'true'/m,'Release eligibility must be conditionally gated by final acceptance.');
  assert.match(eligibilityStep.groups.body,/Release tag eligible/,'CI must report eligibility for the authorized repository connection.');

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

assert.equal(isClosedLoopUtcInstant('2026-09-03T00:00:00.000Z'),true,'Exact UTC instant syntax must be accepted.');
assert.equal(isClosedLoopUtcInstant('2026-09-03T00:00:00Z'),false,'Missing millisecond precision must be rejected.');
assert.equal(isClosedLoopUtcInstant('2026-09-03T00:00:00.000+00:00'),false,'Offset-bearing instants cannot masquerade as canonical UTC values.');
assert.equal(isClosedLoopUtcInstant('2026-02-30T00:00:00.000Z'),false,'Impossible calendar instants must be rejected.');

const target={
  ...syntheticMobileTargetFacts({performer:'authorized-operator'}),deviceModel:'UNKNOWN',iosVersion:'19.0',safariVersion:'19.0',safariUserAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1',
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
const capabilityProbe={
  probeId:'MOBILE-PROBE-001',
  result:'PASS',
  capabilities:Object.fromEntries(REQUIRED_MOBILE_CAPABILITY_PROBE_KEYS.map(key=>[key,true]))
};
const evidence={
  ...target,
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
  mobileCapabilityProbe:capabilityProbe,
  operationReceipts:REQUIRED_MOBILE_RECEIPT_KINDS.map((kind,index)=>({kind,receiptId:`MR-${String(index+1).padStart(3,'0')}`,result:'PASS'})),
  runtimeFindings:{runtimeExceptions:0,unhandledRejections:0},
  measurements:{horizontalOverflowPx:0,minimumPrimaryTextPx:16,minimumSecondaryTextPx:14,minimumTouchTargetPx:44},
  exportedProjectDigest:'b'.repeat(64),
  screenshotOrRecordingReferences:['capture-001']
};
Object.assign(evidence,syntheticMobileOperations(target));
const expected={sourceCommit:target.sourceCommit,deploymentManifestDigest:target.deploymentManifestDigest,origin:target.origin,basePath:target.basePath,verificationTime:'2026-09-03T00:00:00.000Z'};
assert.equal(verifyMobileAcceptanceEvidence({target,evidence,expected}).accepted,true,'Complete pinned mobile evidence must validate.');
assert.equal(verifyMobileAcceptanceEvidence({target,evidence:{...evidence,challenge:'f'.repeat(32)},expected}).accepted,false,'Mismatched challenge must be rejected.');
assert.equal(verifyMobileAcceptanceEvidence({target,evidence:{...evidence,safariUserAgent:evidence.safariUserAgent.replace('Safari/604.1','CriOS/140.0.0.0 Mobile/15E148 Safari/604.1')},expected}).accepted,false,'A substitute iOS browser must be rejected.');
assert.equal(verifyMobileAcceptanceEvidence({target,evidence:{...evidence,operationReceipts:evidence.operationReceipts.slice(1)},expected}).accepted,false,'Missing required physical operator-path evidence must be rejected.');
assert.equal(verifyMobileAcceptanceEvidence({target,evidence,expected,usedChallenges:[target.challenge]}).accepted,false,'A reused physical acceptance challenge must be rejected.');
assert.equal(verifyMobileAcceptanceEvidence({target,evidence,expected,usedChallenges:[target.challenge.toUpperCase()]}).accepted,false,'Challenge reuse must be case-insensitive.');
assert.equal(verifyMobileAcceptanceEvidence({target,evidence,expected:{...expected,verificationTime:'2026-09-04T00:00:00.000Z'}}).accepted,false,'Expired physical acceptance evidence must be rejected.');
assert.equal(verifyMobileAcceptanceEvidence({target:{...target,challengeIssuedAt:'2026-09-02T20:00:00Z'},evidence,expected}).accepted,false,'Noncanonical challenge time syntax must be rejected.');
assert.equal(verifyMobileAcceptanceEvidence({target,evidence:{...evidence,mobileCapabilityProbe:undefined},expected}).accepted,false,'Missing MOBILE_CAPABILITY_PROBE must block acceptance.');
const unavailableProbe={...capabilityProbe,capabilities:{...capabilityProbe.capabilities,RESPONSE_FILE_SELECTION:false},result:'BLOCKED'};
assert.equal(verifyMobileAcceptanceEvidence({target,evidence:{...evidence,mobileCapabilityProbe:unavailableProbe},expected}).accepted,false,'A missing required pinned-device capability must block acceptance.');
const unknownProbe={...capabilityProbe,capabilities:{...capabilityProbe.capabilities,PERSISTENT_STORAGE_REQUEST:null},result:'BLOCKED'};
assert.equal(verifyMobileAcceptanceEvidence({target,evidence:{...evidence,mobileCapabilityProbe:unknownProbe},expected}).accepted,false,'An UNKNOWN required pinned-device capability must block acceptance.');
const extraProbe={...capabilityProbe,capabilities:{...capabilityProbe.capabilities,UNREGISTERED_CAPABILITY:true}};
assert.equal(verifyMobileAcceptanceEvidence({target,evidence:{...evidence,mobileCapabilityProbe:extraProbe},expected}).accepted,false,'An unregistered capability probe key must fail closed.');

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

// The repository connection below is a synthetic API fixture. It models the
// GitHub create-ref contract, including an atomic conflict, not a device run.
const claimInput={targetJson:JSON.stringify(target),evidenceJson:JSON.stringify(evidence),repository:'sjonesjones917/closed-loop-tracker',sourceCommit:target.sourceCommit,runId:'123456',runAttempt:'1',submitter:'acceptance-controller'};
const claimRef=mobileClaimRef(target.challenge),claimObjects=new Map(),claimRefs=new Map(),claimCalls=[];
const claimApi=async(method,path,body)=>{
  claimCalls.push({method,path});
  if(method==='GET'&&path==='actions/runs/123456')return {id:123456,run_attempt:1,event:'workflow_dispatch',head_branch:'main',head_sha:target.sourceCommit,path:'.github/workflows/pages.yml',status:'in_progress',conclusion:null,repository:{full_name:claimInput.repository},head_repository:{full_name:claimInput.repository}};
  if(method==='POST'&&path==='git/tags'){const sha=createHash('sha1').update(JSON.stringify(body)).digest('hex');claimObjects.set(sha,{...body,sha,object:{type:body.type,sha:body.object}});return {sha};}
  if(method==='POST'&&path==='git/refs'){if(claimRefs.has(body.ref))throw new Error('HTTP 422: reference already exists');claimRefs.set(body.ref,{ref:body.ref,object:{type:'tag',sha:body.sha}});return claimRefs.get(body.ref);}
  if(method==='GET'&&path==='git/ref/'+claimRef.slice(5)){if(!claimRefs.has(claimRef))throw new Error('HTTP 404');return claimRefs.get(claimRef);}
  if(method==='GET'&&path.startsWith('git/tags/'))return claimObjects.get(path.slice('git/tags/'.length));
  throw new Error('Unexpected synthetic repository request '+method+' '+path);
};
const strictMobile=claim=>evaluateMobileAcceptanceSubmission({...claimInput,expected,requireChallengeClaim:true,challengeClaim:claim,acceptanceContext:{repository:claimInput.repository,runId:claimInput.runId,runAttempt:claimInput.runAttempt}});
assert.equal(strictMobile(null).actualIPhoneSafariAcceptance,false,'MOBILE_CLAIM_MISSING_ORACLE: unclaimed challenge cannot satisfy CI');
const parallelClaims=await Promise.allSettled([createMobileChallengeClaim(claimInput,{api:claimApi,expected}),createMobileChallengeClaim(claimInput,{api:claimApi,expected})]);
assert.equal(parallelClaims.filter(row=>row.status==='fulfilled').length,1,'MOBILE_CLAIM_ATOMIC_ORACLE: exactly one create-only claim succeeds');
assert.equal(parallelClaims.filter(row=>row.status==='rejected'&&/422/.test(row.reason.message)).length,1,'MOBILE_CLAIM_CONFLICT_ORACLE: second claim must conflict, never overwrite');
assert.equal(claimRefs.size,1);
const durableClaim=await readMobileChallengeClaim(claimInput,{api:claimApi});
assert.equal(strictMobile(durableClaim.claim).actualIPhoneSafariAcceptance,true,'MOBILE_CLAIM_VALID_ORACLE: designated exact input can progress');
const claimCases=[];
for(const [name,change]of [
 ['next-run',{runId:'123457'}],['next-attempt',{runAttempt:'2'}],['different-evidence-bytes',{evidenceJson:claimInput.evidenceJson+' '}],['different-target-bytes',{targetJson:claimInput.targetJson+' '}],['wrong-repository',{repository:'someone/else'}],['wrong-source',{sourceCommit:'f'.repeat(40)}]
]){
  await assert.rejects(()=>readMobileChallengeClaim({...claimInput,...change},{api:claimApi}),/MOBILE_CHALLENGE_CLAIM/,'MOBILE_CLAIM_REPLAY_ORACLE: '+name);
  claimCases.push(name);
}
for(const key of Object.keys(durableClaim.claim)){
  assert.throws(()=>validateMobileChallengeClaim({...durableClaim.claim,[key]:'CHANGED'},claimInput),/MOBILE_CHALLENGE_CLAIM/,'MOBILE_CLAIM_FIELD_ORACLE: '+key);
}
assert.throws(()=>validateMobileChallengeClaim({...durableClaim.claim,unregistered:true},claimInput),/field inventory/);
assert.equal(evaluateMobileAcceptanceSubmission({...claimInput,expected,requireChallengeClaim:true,challengeClaim:durableClaim.claim,acceptanceContext:{repository:claimInput.repository,runId:'123457',runAttempt:'1'}}).actualIPhoneSafariAcceptance,false,'MOBILE_CLAIM_SECOND_ACCEPTANCE_ORACLE: a second dispatch is rejected after the first claim');
assert(claimCalls.every(row=>['GET','POST'].includes(row.method)),'MOBILE_CLAIM_CREATE_ONLY_ORACLE');
assert.equal(claimRefs.get(claimRef).object.sha,durableClaim.tagObjectSha,'MOBILE_CLAIM_PRESERVED_ORACLE');
assert.equal(evaluateMobileAcceptanceSubmission({...claimInput,evidenceJson:claimInput.evidenceJson+' ',expected,requireChallengeClaim:true,challengeClaim:durableClaim.claim,acceptanceContext:{repository:claimInput.repository,runId:claimInput.runId,runAttempt:claimInput.runAttempt,evidenceJson:claimInput.evidenceJson}}).actualIPhoneSafariAcceptance,false,'MOBILE_CLAIM_CONTEXT_OVERRIDE_ORACLE: context cannot replace the actual submitted input bytes');
const workflowClaimCases=[];
for(const [name,change]of [['wrong-run',r=>r.id=123457],['wrong-attempt',r=>r.run_attempt=2],['wrong-event',r=>r.event='push'],['wrong-branch',r=>r.head_branch='topic'],['wrong-source',r=>r.head_sha='f'.repeat(40)],['wrong-workflow',r=>r.path='.github/workflows/other.yml'],['wrong-repository',r=>r.repository.full_name='another/repo'],['missing-repository',r=>delete r.repository],['foreign-head',r=>r.head_repository.full_name='another/repo'],['missing-head-repository',r=>delete r.head_repository],['completed-run',r=>r.status='completed'],['concluded-run',r=>r.conclusion='failure']]){let writes=0;const changedApi=async(method,path,body)=>{if(method!=='GET')writes++;const response=await claimApi(method,path,body);if(path==='actions/runs/123456'){const altered=structuredClone(response);change(altered);return altered;}return response;};await assert.rejects(()=>createMobileChallengeClaim(claimInput,{api:changedApi,expected}),/MOBILE_CHALLENGE_CLAIM/,'MOBILE_CLAIM_WORKFLOW_ORACLE: '+name);assert.equal(writes,0,'MOBILE_CLAIM_NO_PREMATURE_WRITE_ORACLE: '+name);workflowClaimCases.push(name);}

const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');
assertWorkflowGovernance(workflow);
const unconditionalMutation=workflow.replace(/\n\s*if:\s*steps\.acceptance\.outputs\.final_acceptance\s*==\s*'true'/,'');
assert.throws(()=>assertWorkflowGovernance(unconditionalMutation),/conditionally gated/,'The regression must fail when release tagging becomes unconditional.');
const repositoryMutationFaults=[];
for(const [fault,mutated,oracle] of [
  ['repository-write-permission',workflow.replace('contents: read','contents: write'),'CI_READ_ONLY_PERMISSION_ORACLE'],
  ['unconditional-remote-tag-write',workflow+'\n      - name: Forbidden mutation\n        run: git push origin refs/tags/forbidden\n','CI_READ_ONLY_REPOSITORY_ORACLE']
]){
  let rejection='';try{assertWorkflowGovernance(mutated);}catch(error){rejection=error.message;}
  assert.ok(rejection.includes(oracle),'Fault was not detected by its intended governance oracle: '+fault);
  assertWorkflowGovernance(workflow);repositoryMutationFaults.push({fault,oracle,result:'DETECTED',rejection,restored:'PASS'});
}
const jobPermissionFaults=[];
const replacePermissionAnchor=(text,before,after,fault)=>{
 assert.equal(text.split(before).length,2,'CI_PERMISSION_FAULT_ANCHOR_ORACLE: expected one exact anchor for '+fault);
 const mutated=text.replace(before,after);assert.notEqual(mutated,text,'CI_PERMISSION_FAULT_ANCHOR_ORACLE: mutation did not change '+fault);return mutated;
};
const mutateJobPermission=(name,before,after,fault)=>{
 const jobs=[...workflow.matchAll(new RegExp('^  '+name+':\\n[\\s\\S]*?(?=^  [a-z][a-z-]*:\\n|(?![\\s\\S]))','gm'))];
 assert.equal(jobs.length,1,'CI_PERMISSION_FAULT_ANCHOR_ORACLE: expected one job for '+fault);
 const job=jobs[0][0],permissions=/^    permissions:\n(?:      [^\n]+\n)+/m.exec(job)?.[0];
 assert.ok(permissions,'CI_PERMISSION_FAULT_ANCHOR_ORACLE: explicit permissions absent for '+fault);
 const changedPermissions=replacePermissionAnchor(permissions,before,after,fault);
 return replacePermissionAnchor(workflow,job,replacePermissionAnchor(job,permissions,changedPermissions,fault),fault);
};
const verificationPermissionFaults=[['foundation','foundation'],['matrix','deferred-matrix'],['workflow-gates','workflow-gates'],['conformance','conformance'],['test','test']].flatMap(([label,job])=>[
 [label+'-pages-write',mutateJobPermission(job,'      pull-requests: read\n','      pull-requests: read\n      pages: write\n',label+'-pages-write')],
 ['missing-'+label+'-artifact-read',mutateJobPermission(job,'      actions: read\n','','missing-'+label+'-artifact-read')]
]);
for(const [fault,mutated]of [
 ['former-inherited-writes',replacePermissionAnchor(workflow,'permissions:\n  contents: read\n','permissions:\n  contents: read\n  actions: read\n  pull-requests: read\n  pages: write\n  id-token: write\n  statuses: write\n','former-inherited-writes')],
 ...verificationPermissionFaults,
 ['missing-deployment-oidc',mutateJobPermission('deploy','      id-token: write\n','','missing-deployment-oidc')],
 ['missing-deployment-pages',mutateJobPermission('deploy','      pages: write\n','','missing-deployment-pages')],
 ['live-status-write',replacePermissionAnchor(workflow,'  verify-live:\n','  verify-live:\n    permissions:\n      contents: read\n      statuses: write\n','live-status-write')]
]){
 assert.throws(()=>assertJobScopedCIPermissions(mutated),/CI_JOB_PERMISSION_ORACLE/,'Job permission regression did not reach its intended oracle: '+fault);assertJobScopedCIPermissions(workflow);jobPermissionFaults.push({fault,result:'DETECTED',restored:'PASS'});
}
const hardCodedBlockMutation=workflow.replace('...mobileAcceptance,','...mobileAcceptance,actualIPhoneSafariAcceptance:false,');
assert.throws(()=>assertWorkflowGovernance(hardCodedBlockMutation),/hard-code/,'The regression must fail when valid physical evidence is made impossible to accept.');
const missingEvaluatorMutation=workflow.replace('const executedEvidence=await readReleaseExecutedEvidence(', 'const executedEvidence=await removedStrictPhysicalReader(');
assert.throws(()=>assertWorkflowGovernance(missingEvaluatorMutation),/raw physical inputs/,'The regression must fail when the workflow stops executing the evidence verifier.');

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
  durableChallengeClaim:{passed:true,concurrentClaimsAccepted:1,subsequentRunRejected:true,subsequentAttemptRejected:true,exactInputBytesRequired:true,negativeCases:claimCases,workflowBindingCases:workflowClaimCases,syntheticRepository:true,actualPhysicalDevice:false},
  challengeCaseNormalizationVerified:true,
  expiredChallengeRejected:true,
  canonicalTrustedTimeSyntaxEnforced:true,
  substituteIosBrowserRejected:true,
  mobileCapabilityProbeRequired:true,
  missingCapabilityBlocks:true,
  unknownCapabilityBlocks:true,
  unregisteredCapabilityRejected:true,
  requiredOperatorPathReceiptCoverage:true,
  authenticatedEvidenceBridgeAcceptsValidProof:true,
  absentEvidenceRemainsBlocked:true,
  partialSubmissionRejected:true,
  usedChallengeRejectedAcrossCaseVariants:true,
  workflowExecutesStrictEvidenceEvaluator:true,
  unconditionalTagMutationDetected:true,
  unconditionalEligibilityMutationDetected:true,
  repositoryReadOnlyCI:true,
  repositoryMutationFaults,
  jobScopedPermissions:true,
  jobPermissionFaults,
  falseAcceptanceTagRegressionCovered:true
},null,2));
