import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {verifyMobileAcceptanceEvidence,REQUIRED_MOBILE_RECEIPT_KINDS} from './verify-mobile-acceptance-evidence.mjs';

export const CANONICAL_ORIGIN='https://sjonesjones917.github.io';
export const CANONICAL_BASE_PATH='/closed-loop-tracker/';

const NONEMPTY=value=>typeof value==='string'&&value.trim().length>0;
const BLOCKER={
  disposition:'BLOCKED_ENVIRONMENT',
  requiredAction:'Create a pinned MOBILE_ACCEPTANCE_TARGET_ID and single-use challenge, execute the complete physical-iPhone Safari operator path against the exact deployed commit and manifest, then submit the target and mobile-acceptance-evidence.json through the authenticated acceptance workflow.',
  actor:'Authorized physical-iPhone performer and repository acceptance controller',
  controllingClauses:['45.1','45.2','46','49']
};

export function mobilePublicationStatus({target=null,evidence=null,deploymentManifest=null,sourceCommit=null,verificationTime=null,usedChallenges=[]}={}){
  const blocked=(reason,errors=[])=>({
    actualIPhoneSafariAcceptance:false,
    mobileAcceptanceResult:'BLOCKED_ENVIRONMENT',
    mobileAcceptanceTargetId:target?.mobileAcceptanceTargetId||null,
    mobileAcceptanceEvidenceId:evidence?.mobileAcceptanceEvidenceId||null,
    mobileAcceptanceEvidenceBasis:evidence?.evidenceBasis||'NONE',
    mobileAcceptanceSourceCommit:target?.sourceCommit||null,
    mobileAcceptanceDeploymentManifestDigest:target?.deploymentManifestDigest||null,
    mobileAcceptanceOrigin:target?.origin||CANONICAL_ORIGIN,
    mobileAcceptanceBasePath:target?.basePath||CANONICAL_BASE_PATH,
    mobileAcceptanceTestProjectId:target?.testProjectId||null,
    mobileAcceptancePerformer:evidence?.performer||null,
    mobileAcceptancePhysicalDeviceAssertion:evidence?.physicalDeviceAssertion===true,
    finalAcceptancePublication:false,
    releaseTagEligible:false,
    mobileAcceptanceBlockers:[{...BLOCKER,reason,errors}],
    nextProofStep:'Pinned actual-iPhone Safari acceptance for the exact deployed commit and deployment manifest.'
  });

  if(!target&&!evidence)return blocked('No authenticated physical-iPhone target/evidence submission was supplied.');
  if(!target||!evidence)return blocked('Both the pinned target and the physical-device evidence are required together.');
  if(!deploymentManifest||deploymentManifest.schema!=='closed-loop-deployment-manifest/1')return blocked('The exact deployed manifest is unavailable or invalid.');
  if(!NONEMPTY(sourceCommit)||deploymentManifest.sourceCommit!==sourceCommit)return blocked('The deployed manifest is not bound to the exact source commit.');
  const digest=deploymentManifest.manifestDigest?.digest;
  if(!NONEMPTY(digest))return blocked('The deployed manifest digest is unavailable.');

  const result=verifyMobileAcceptanceEvidence({
    target,
    evidence,
    expected:{
      sourceCommit,
      deploymentManifestDigest:digest,
      origin:CANONICAL_ORIGIN,
      basePath:CANONICAL_BASE_PATH,
      verificationTime:verificationTime||new Date().toISOString()
    },
    usedChallenges
  });
  if(!result.accepted)return blocked('Submitted physical-device evidence failed closed verification.',result.errors);

  return {
    actualIPhoneSafariAcceptance:true,
    mobileAcceptanceResult:'ACCEPTED',
    mobileAcceptanceTargetId:result.targetId,
    mobileAcceptanceEvidenceId:result.evidenceId,
    mobileAcceptanceEvidenceBasis:result.evidenceBasis,
    mobileAcceptanceSourceCommit:result.sourceCommit,
    mobileAcceptanceDeploymentManifestDigest:result.deploymentManifestDigest,
    mobileAcceptanceOrigin:result.origin,
    mobileAcceptanceBasePath:result.basePath,
    mobileAcceptanceTestProjectId:result.testProjectId,
    mobileAcceptancePerformer:result.performer,
    mobileAcceptancePhysicalDeviceAssertion:result.physicalDeviceAssertion,
    mobileAcceptanceIosVersion:result.iosVersion,
    mobileAcceptanceSafariUserAgent:result.safariUserAgent,
    finalAcceptancePublication:true,
    releaseTagEligible:true,
    mobileAcceptanceBlockers:[],
    nextProofStep:'Final acceptance publication and release tagging are eligible for this exact commit.'
  };
}

export async function fetchAndVerifyDeployment(url=`${CANONICAL_ORIGIN}${CANONICAL_BASE_PATH}closed-loop-deployment-manifest.json`){
  const response=await fetch(`${url}?acceptance=${Date.now()}`,{cache:'no-store',redirect:'error'});
  if(!response.ok)throw new Error(`Deployment manifest fetch failed with HTTP ${response.status}.`);
  const deploymentManifest=await response.json();
  if(deploymentManifest.schema!=='closed-loop-deployment-manifest/1')throw new Error('Unexpected deployment manifest schema.');
  const root=new URL(CANONICAL_BASE_PATH,CANONICAL_ORIGIN);
  for(const resource of deploymentManifest.runtimeResources||[]){
    const r=await fetch(new URL(`${resource.path}?acceptance=${Date.now()}-${Math.random()}`,root),{cache:'no-store',redirect:'error'});
    if(!r.ok)throw new Error(`Deployment resource ${resource.path} returned HTTP ${r.status}.`);
    const bytes=Buffer.from(await r.arrayBuffer());
    const digest=crypto.createHash('sha256').update(bytes).digest('hex');
    if(bytes.length!==resource.byteSize||digest!==resource.digest)throw new Error(`Deployment resource identity mismatch for ${resource.path}.`);
  }
  return deploymentManifest;
}

export function parseAuthenticatedJson(value,label){
  if(!NONEMPTY(value))return null;
  try{return JSON.parse(value);}catch(error){throw new Error(`${label} is not valid JSON: ${error.message}`);}
}

function fixture(){
  const sourceCommit='0123456789abcdef0123456789abcdef01234567';
  const deploymentManifestDigest='a'.repeat(64);
  const safariUserAgent='Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1';
  const target={
    mobileAcceptanceTargetId:'MOBILE-TARGET-001',physicalDeviceRequired:true,
    challenge:'0123456789abcdef0123456789abcdef',challengeIssuedAt:'2026-09-02T20:00:00.000Z',challengeExpiresAt:'2026-09-03T20:00:00.000Z',
    sourceCommit,deploymentManifestDigest,origin:CANONICAL_ORIGIN,basePath:CANONICAL_BASE_PATH,testProjectId:'JOB-MOBILE-001',procedureVersion:'actual-iphone-safari/1',
    iosVersion:'19.0',safariUserAgent,viewport:{width:393,height:852,devicePixelRatio:3}
  };
  const evidence={
    mobileAcceptanceEvidenceId:'MOBILE-EVIDENCE-001',mobileAcceptanceTargetId:target.mobileAcceptanceTargetId,challenge:target.challenge,sourceCommit,deploymentManifestDigest,
    origin:target.origin,basePath:target.basePath,testProjectId:target.testProjectId,procedureVersion:target.procedureVersion,physicalDeviceAssertion:true,evidenceBasis:'HUMAN_OBSERVATION',
    performer:'authorized-operator',identityAssurance:'SELF_ASSERTED',iosVersion:target.iosVersion,safariUserAgent:target.safariUserAgent,
    viewport:{...target.viewport},operationReceipts:REQUIRED_MOBILE_RECEIPT_KINDS.map((kind,index)=>({kind,receiptId:`MR-${index+1}`,result:'PASS'})),
    runtimeFindings:{runtimeExceptions:0,unhandledRejections:0},measurements:{horizontalOverflowPx:0,minimumPrimaryTextPx:16,minimumSecondaryTextPx:14,minimumTouchTargetPx:44},
    exportedProjectDigest:'b'.repeat(64),screenshotOrRecordingReferences:['capture-001']
  };
  const deploymentManifest={schema:'closed-loop-deployment-manifest/1',sourceCommit,manifestDigest:{hashAlgorithm:'SHA-256',digest:deploymentManifestDigest},runtimeResources:[]};
  return {target,evidence,deploymentManifest,sourceCommit};
}

export function runPublicationRegressions(){
  const f=fixture();
  assert.equal(mobilePublicationStatus({deploymentManifest:f.deploymentManifest,sourceCommit:f.sourceCommit}).finalAcceptancePublication,false,'Missing physical evidence must remain blocked.');
  const accepted=mobilePublicationStatus({...f,verificationTime:'2026-09-03T00:00:00.000Z'});
  assert.equal(accepted.actualIPhoneSafariAcceptance,true,'Valid pinned physical evidence must be able to transition acceptance.');
  assert.equal(accepted.finalAcceptancePublication,true,'Valid pinned physical evidence must make final publication eligible.');
  assert.equal(accepted.releaseTagEligible,true,'Valid pinned physical evidence must make the exact commit tag-eligible.');
  assert.equal(mobilePublicationStatus({...f,target:{...f.target,sourceCommit:'f'.repeat(40)},verificationTime:'2026-09-03T00:00:00.000Z'}).finalAcceptancePublication,false,'Wrong-commit target must fail closed.');
  assert.equal(mobilePublicationStatus({...f,evidence:{...f.evidence,evidenceBasis:'SELF_ASSERTED'},verificationTime:'2026-09-03T00:00:00.000Z'}).finalAcceptancePublication,false,'Self-asserted physical evidence must fail closed.');
  assert.equal(mobilePublicationStatus({...f,evidence:{...f.evidence,iosVersion:'18.7'},verificationTime:'2026-09-03T00:00:00.000Z'}).finalAcceptancePublication,false,'Changed iOS version must stale the pinned physical target.');
  return {mobileAcceptancePublication:'PASS',missingEvidenceBlocked:true,validEvidenceCanPublish:true,wrongCommitRejected:true,selfAssertionRejected:true,pinnedIosMismatchRejected:true};
}

if(import.meta.url===`file://${process.argv[1]}`){
  if(process.argv.includes('--self-test'))console.log(JSON.stringify(runPublicationRegressions(),null,2));
  else {
    const target=parseAuthenticatedJson(process.env.MOBILE_ACCEPTANCE_TARGET_JSON,'MOBILE_ACCEPTANCE_TARGET_JSON');
    const evidence=parseAuthenticatedJson(process.env.MOBILE_ACCEPTANCE_EVIDENCE_JSON,'MOBILE_ACCEPTANCE_EVIDENCE_JSON');
    let deploymentManifest=null;
    try{deploymentManifest=await fetchAndVerifyDeployment(process.env.DEPLOYMENT_MANIFEST_URL);}catch(error){
      if(target||evidence)throw error;
    }
    const status=mobilePublicationStatus({target,evidence,deploymentManifest,sourceCommit:process.env.GITHUB_SHA||null});
    console.log(JSON.stringify(status,null,2));
  }
}
