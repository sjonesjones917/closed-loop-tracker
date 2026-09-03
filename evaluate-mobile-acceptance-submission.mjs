import crypto from 'node:crypto';
import {verifyMobileAcceptanceEvidence} from './verify-mobile-acceptance-evidence.mjs';

export const MOBILE_ACCEPTANCE_ORIGIN='https://sjonesjones917.github.io';
export const MOBILE_ACCEPTANCE_BASE_PATH='/closed-loop-tracker/';

const NONEMPTY=value=>typeof value==='string'&&value.trim().length>0;
const blocked=(disposition,requiredAction,actor,details=[])=>({
  actualIPhoneSafariAcceptance:false,
  mobileAcceptanceResult:disposition,
  mobileAcceptanceTargetId:null,
  mobileAcceptanceEvidenceId:null,
  mobileAcceptanceEvidenceBasis:'NONE',
  mobileAcceptanceSourceCommit:null,
  mobileAcceptanceDeploymentManifestDigest:null,
  mobileAcceptanceOrigin:MOBILE_ACCEPTANCE_ORIGIN,
  mobileAcceptanceBasePath:MOBILE_ACCEPTANCE_BASE_PATH,
  mobileAcceptanceTestProjectId:null,
  mobileAcceptancePerformer:null,
  mobileAcceptanceIdentityAssurance:null,
  mobileAcceptancePhysicalDeviceAssertion:false,
  mobileAcceptanceIosVersion:null,
  mobileAcceptanceSafariUserAgent:null,
  mobileAcceptanceChallenge:null,
  mobileAcceptanceSubmitter:null,
  mobileAcceptanceBlockers:[{disposition,requiredAction,actor,controllingClauses:['45.1','45.2','46','49'],details}],
  physicalIPhoneJobResult:disposition
});
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

function parseJson(label,text){
  try{
    const value=JSON.parse(text);
    if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError(`${label} must be a JSON object.`);
    return value;
  }catch(error){
    throw new Error(`${label} is not valid object JSON: ${error.message}`);
  }
}

export function evaluateMobileAcceptanceSubmission({targetJson='',evidenceJson='',expected={},usedChallenges=[],submitter=null}={}){
  const hasTarget=NONEMPTY(targetJson);
  const hasEvidence=NONEMPTY(evidenceJson);
  if(!hasTarget&&!hasEvidence){
    return blocked(
      'BLOCKED_ENVIRONMENT',
      'Create a pinned mobile acceptance target and single-use challenge, execute the complete physical-iPhone Safari operator path against the exact deployed commit and manifest, then submit the target JSON and mobile-acceptance-evidence JSON through the authenticated workflow-dispatch inputs.',
      'Authorized physical-iPhone performer and repository acceptance controller'
    );
  }
  if(hasTarget!==hasEvidence){
    return blocked(
      'BLOCKED',
      'Submit both the pinned mobile acceptance target JSON and the matching mobile acceptance evidence JSON in the same authenticated workflow dispatch.',
      'Repository acceptance controller',
      ['TARGET_AND_EVIDENCE_MUST_BE_PAIRED']
    );
  }
  if(!NONEMPTY(submitter)){
    return blocked(
      'BLOCKED',
      'Submit physical-device evidence through an authenticated workflow context that records the submitter identity.',
      'Repository acceptance controller',
      ['AUTHENTICATED_SUBMITTER_REQUIRED']
    );
  }

  let target;
  let evidence;
  try{
    target=parseJson('Mobile acceptance target',targetJson);
    evidence=parseJson('Mobile acceptance evidence',evidenceJson);
  }catch(error){
    return blocked('BLOCKED','Correct the malformed mobile acceptance submission and rerun the authenticated workflow dispatch.','Repository acceptance controller',[error.message]);
  }

  const usedNormalized=new Set((Array.isArray(usedChallenges)?usedChallenges:[]).filter(NONEMPTY).map(value=>value.toLowerCase()));
  const verifierUsed=NONEMPTY(target.challenge)&&usedNormalized.has(target.challenge.toLowerCase())?[target.challenge]:[];
  const verification=verifyMobileAcceptanceEvidence({target,evidence,expected,usedChallenges:verifierUsed});
  if(!verification.accepted){
    return {
      ...blocked(
        verification.status==='REJECTED'?'REJECTED':'BLOCKED',
        'Correct the mobile acceptance target or evidence so every exact binding, physical-device observation, required operator-path receipt, freshness condition, and single-use challenge check passes, then rerun the authenticated workflow dispatch.',
        'Authorized physical-iPhone performer and repository acceptance controller',
        verification.errors||[]
      ),
      mobileAcceptanceTargetId:target.mobileAcceptanceTargetId||null,
      mobileAcceptanceEvidenceId:evidence.mobileAcceptanceEvidenceId||null,
      mobileAcceptanceEvidenceBasis:evidence.evidenceBasis||'NONE',
      mobileAcceptanceSourceCommit:evidence.sourceCommit||target.sourceCommit||null,
      mobileAcceptanceDeploymentManifestDigest:evidence.deploymentManifestDigest||target.deploymentManifestDigest||null,
      mobileAcceptanceTestProjectId:evidence.testProjectId||target.testProjectId||null,
      mobileAcceptancePerformer:target.performer||evidence.performer||null,
      mobileAcceptanceIdentityAssurance:target.identityAssurance||evidence.identityAssurance||null,
      mobileAcceptancePhysicalDeviceAssertion:evidence.physicalDeviceAssertion===true,
      mobileAcceptanceIosVersion:target.iosVersion||evidence.iosVersion||null,
      mobileAcceptanceSafariUserAgent:target.safariUserAgent||evidence.safariUserAgent||null,
      mobileAcceptanceChallenge:target.challenge||null,
      mobileAcceptanceSubmitter:submitter
    };
  }

  return {
    actualIPhoneSafariAcceptance:true,
    mobileAcceptanceResult:'ACCEPTED',
    mobileAcceptanceTargetId:target.mobileAcceptanceTargetId,
    mobileAcceptanceEvidenceId:evidence.mobileAcceptanceEvidenceId,
    mobileAcceptanceEvidenceBasis:evidence.evidenceBasis,
    mobileAcceptanceSourceCommit:evidence.sourceCommit,
    mobileAcceptanceDeploymentManifestDigest:evidence.deploymentManifestDigest,
    mobileAcceptanceOrigin:evidence.origin,
    mobileAcceptanceBasePath:evidence.basePath,
    mobileAcceptanceTestProjectId:evidence.testProjectId,
    mobileAcceptancePerformer:verification.performer,
    mobileAcceptanceIdentityAssurance:verification.identityAssurance,
    mobileAcceptancePhysicalDeviceAssertion:true,
    mobileAcceptanceIosVersion:verification.iosVersion,
    mobileAcceptanceSafariUserAgent:verification.safariUserAgent,
    mobileAcceptanceChallenge:target.challenge,
    mobileAcceptanceSubmitter:submitter,
    mobileAcceptanceBlockers:[],
    physicalIPhoneJobResult:'success'
  };
}

async function deployedExpected(){
  const sourceCommit=process.env.GITHUB_SHA||'';
  if(!/^[0-9a-f]{40}$/.test(sourceCommit))throw new Error('GITHUB_SHA must identify the exact deployed commit.');
  const cacheKey=encodeURIComponent(process.env.GITHUB_RUN_ID||Date.now());
  const manifestUrl=`${MOBILE_ACCEPTANCE_ORIGIN}${MOBILE_ACCEPTANCE_BASE_PATH}closed-loop-deployment-manifest.json?acceptance_run=${cacheKey}`;
  const response=await fetch(manifestUrl,{cache:'no-store',redirect:'error'});
  if(!response.ok)throw new Error(`Unable to retrieve deployed manifest: HTTP ${response.status}.`);
  const finalManifestUrl=new URL(response.url);
  if(finalManifestUrl.origin!==MOBILE_ACCEPTANCE_ORIGIN||finalManifestUrl.pathname!==`${MOBILE_ACCEPTANCE_BASE_PATH}closed-loop-deployment-manifest.json`)throw new Error('Deployed manifest was retrieved from an unauthorized origin or path.');
  const manifest=await response.json();
  if(manifest?.schema!=='closed-loop-deployment-manifest/1')throw new Error('Deployed manifest schema is invalid.');
  if(manifest?.sourceCommit!==sourceCommit)throw new Error('Deployed manifest source commit does not match GITHUB_SHA.');
  const digest=manifest?.manifestDigest?.digest;
  if(!/^[0-9a-f]{64}$/.test(digest||''))throw new Error('Deployed manifest digest is missing or invalid.');
  if(!Array.isArray(manifest.runtimeResources)||manifest.runtimeResources.length===0)throw new Error('Deployed manifest runtime resource set is empty.');
  const seen=new Set();
  for(const resource of manifest.runtimeResources){
    if(!resource||typeof resource.path!=='string'||seen.has(resource.path))throw new Error('Deployed manifest contains an invalid or duplicate runtime path.');
    seen.add(resource.path);
    if(resource.path.startsWith('/')||resource.path.includes('..')||resource.path.includes('\\'))throw new Error(`Unsafe deployed resource path: ${resource.path}`);
    if(!Number.isSafeInteger(resource.byteSize)||resource.byteSize<0||!/^[0-9a-f]{64}$/.test(resource.digest||''))throw new Error(`Invalid deployed resource identity: ${resource.path}`);
    const resourceUrl=`${MOBILE_ACCEPTANCE_ORIGIN}${MOBILE_ACCEPTANCE_BASE_PATH}${resource.path}?acceptance_run=${cacheKey}`;
    const resourceResponse=await fetch(resourceUrl,{cache:'no-store',redirect:'error'});
    if(!resourceResponse.ok)throw new Error(`Unable to retrieve deployed resource ${resource.path}: HTTP ${resourceResponse.status}.`);
    const finalUrl=new URL(resourceResponse.url);
    if(finalUrl.origin!==MOBILE_ACCEPTANCE_ORIGIN||finalUrl.pathname!==`${MOBILE_ACCEPTANCE_BASE_PATH}${resource.path}`)throw new Error(`Deployed resource escaped the canonical origin or base path: ${resource.path}`);
    const bytes=Buffer.from(await resourceResponse.arrayBuffer());
    if(bytes.length!==resource.byteSize)throw new Error(`Deployed resource byte length mismatch: ${resource.path}`);
    if(sha256(bytes)!==resource.digest)throw new Error(`Deployed resource digest mismatch: ${resource.path}`);
  }
  return {
    sourceCommit,
    deploymentManifestDigest:digest,
    origin:MOBILE_ACCEPTANCE_ORIGIN,
    basePath:MOBILE_ACCEPTANCE_BASE_PATH,
    verificationTime:new Date().toISOString()
  };
}

async function main(){
  const targetJson=process.env.MOBILE_ACCEPTANCE_TARGET_JSON||'';
  const evidenceJson=process.env.MOBILE_ACCEPTANCE_EVIDENCE_JSON||'';
  let expected={};
  if(NONEMPTY(targetJson)||NONEMPTY(evidenceJson))expected=await deployedExpected();
  let usedChallenges=[];
  if(NONEMPTY(process.env.USED_MOBILE_CHALLENGES_JSON||'')){
    const parsed=JSON.parse(process.env.USED_MOBILE_CHALLENGES_JSON);
    if(!Array.isArray(parsed)||parsed.some(value=>typeof value!=='string'))throw new Error('USED_MOBILE_CHALLENGES_JSON must be a JSON string array.');
    usedChallenges=parsed;
  }
  const result=evaluateMobileAcceptanceSubmission({
    targetJson,
    evidenceJson,
    expected,
    usedChallenges,
    submitter:process.env.GITHUB_ACTOR||null
  });
  process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
}

if(import.meta.url===new URL(`file://${process.argv[1]}`).href){
  main().catch(error=>{
    process.stderr.write(`${error.stack||error.message}\n`);
    process.exitCode=1;
  });
}
