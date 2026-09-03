import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verifyMobileAcceptanceEvidence} from './verify-mobile-acceptance-evidence.mjs';

export const CANONICAL_MOBILE_PAGE_URL='https://sjonesjones917.github.io/closed-loop-tracker/';

const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const safeInteger=value=>Number.isSafeInteger(value)&&!Object.is(value,-0);
const canonical=value=>{
  if(value===null)return 'null';
  if(typeof value==='boolean')return value?'true':'false';
  if(typeof value==='string')return JSON.stringify(value);
  if(typeof value==='number'){
    if(!safeInteger(value))throw new TypeError('Deployment-manifest canonical numbers must be safe integers.');
    return String(value);
  }
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value&&Object.getPrototypeOf(value)===Object.prototype){
    return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  throw new TypeError('Unsupported deployment-manifest value.');
};

export function deploymentManifestDigest(manifest){
  if(!manifest||typeof manifest!=='object'||Array.isArray(manifest))throw new TypeError('Deployment manifest must be an object.');
  const preimage={...manifest};
  delete preimage.manifestDigest;
  return sha256(Buffer.from(canonical(preimage),'utf8'));
}

function requiredString(value,name){
  if(typeof value!=='string'||!value.trim())throw new Error(`${name} is required.`);
  return value;
}

export function parseAuthenticatedJson(value,name){
  requiredString(value,name);
  let parsed;
  try{parsed=JSON.parse(value);}catch(error){throw new Error(`${name} is not valid JSON: ${error.message}`);}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error(`${name} must contain one JSON object.`);
  return parsed;
}

function validateManifestBinding({manifest,target,expectedCommit}){
  const errors=[];
  const add=(code,message)=>errors.push({code,message});
  if(manifest?.schema!=='closed-loop-deployment-manifest/1')add('DEPLOYMENT_MANIFEST_SCHEMA','Live deployment manifest schema is not closed-loop-deployment-manifest/1.');
  if(manifest?.sourceCommit!==expectedCommit)add('DEPLOYED_COMMIT_MISMATCH','Live deployment source commit does not equal the selected workflow commit.');
  if(target?.sourceCommit!==expectedCommit)add('TARGET_COMMIT_MISMATCH','Pinned mobile target source commit does not equal the selected workflow commit.');
  const computed=manifest&&deploymentManifestDigest(manifest);
  if(manifest?.manifestDigest?.hashAlgorithm!=='SHA-256'||manifest?.manifestDigest?.digest!==computed)add('DEPLOYMENT_MANIFEST_DIGEST_INVALID','Live deployment manifest digest does not verify from its canonical preimage.');
  if(target?.deploymentManifestDigest!==computed)add('TARGET_DEPLOYMENT_MANIFEST_MISMATCH','Pinned mobile target does not bind the exact live deployment manifest digest.');
  return {accepted:errors.length===0,errors,computedDigest:computed};
}

function validateResourcePath(base,resourcePath){
  if(typeof resourcePath!=='string'||!resourcePath||resourcePath.startsWith('/')||resourcePath.includes('\\'))throw new Error(`Unsafe deployment resource path: ${resourcePath}`);
  const url=new URL(resourcePath,base);
  const root=new URL(base);
  if(url.origin!==root.origin||!url.pathname.startsWith(root.pathname)||url.pathname.includes('/../'))throw new Error(`Deployment resource escaped canonical root: ${resourcePath}`);
  return url;
}

export async function verifyLiveDeploymentForMobile({target,expectedCommit,pageUrl=CANONICAL_MOBILE_PAGE_URL,fetchImpl=fetch}={}){
  requiredString(expectedCommit,'expectedCommit');
  const base=new URL(pageUrl);
  if(base.href!==CANONICAL_MOBILE_PAGE_URL)throw new Error(`Mobile acceptance must verify ${CANONICAL_MOBILE_PAGE_URL}.`);
  const manifestUrl=new URL(`closed-loop-deployment-manifest.json?mobile=${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,base);
  const response=await fetchImpl(manifestUrl,{cache:'no-store',redirect:'manual'});
  if(response.status<200||response.status>=300)throw new Error(`Deployment manifest returned HTTP ${response.status}.`);
  const responseUrl=new URL(response.url||manifestUrl.href);
  if(responseUrl.origin!==base.origin||responseUrl.pathname!==new URL('closed-loop-deployment-manifest.json',base).pathname)throw new Error('Deployment manifest resolved outside the canonical origin/base path.');
  const manifestBytes=Buffer.from(await response.arrayBuffer());
  let manifest;
  try{manifest=JSON.parse(manifestBytes.toString('utf8'));}catch(error){throw new Error(`Live deployment manifest is invalid JSON: ${error.message}`);}
  const binding=validateManifestBinding({manifest,target,expectedCommit});
  if(!binding.accepted)throw new Error(JSON.stringify(binding.errors));
  if(!Array.isArray(manifest.runtimeResources)||manifest.runtimeResources.length===0)throw new Error('Deployment manifest has no runtime resources.');
  const seen=new Set();
  for(const resource of manifest.runtimeResources){
    if(!resource||typeof resource!=='object')throw new Error('Deployment resource entry is invalid.');
    if(seen.has(resource.path))throw new Error(`Duplicate deployment resource path: ${resource.path}`);
    seen.add(resource.path);
    if(resource.hashAlgorithm!=='SHA-256'||typeof resource.digest!=='string'||!/^[0-9a-f]{64}$/.test(resource.digest))throw new Error(`Invalid deployment resource digest contract: ${resource.path}`);
    const url=validateResourcePath(base,resource.path);
    url.searchParams.set('mobile',`${Date.now()}-${crypto.randomBytes(8).toString('hex')}`);
    const fileResponse=await fetchImpl(url,{cache:'no-store',redirect:'manual'});
    if(fileResponse.status<200||fileResponse.status>=300)throw new Error(`${resource.path} returned HTTP ${fileResponse.status}.`);
    const finalUrl=new URL(fileResponse.url||url.href);
    if(finalUrl.origin!==base.origin||finalUrl.pathname!==validateResourcePath(base,resource.path).pathname)throw new Error(`${resource.path} redirected or changed origin/path.`);
    const bytes=Buffer.from(await fileResponse.arrayBuffer());
    if(bytes.length!==resource.byteSize)throw new Error(`${resource.path} byte length differs from deployment manifest.`);
    if(sha256(bytes)!==resource.digest)throw new Error(`${resource.path} bytes differ from deployment manifest digest.`);
  }
  return {manifest,manifestDigest:binding.computedDigest,filesCompared:seen.size,sourceCommit:manifest.sourceCommit,buildIdentity:manifest.buildIdentity};
}

export async function verifyMobileAcceptanceSubmission({target,evidence,expectedCommit,pageUrl=CANONICAL_MOBILE_PAGE_URL,usedChallenges=[],verificationTime,fetchImpl=fetch}={}){
  const live=await verifyLiveDeploymentForMobile({target,expectedCommit,pageUrl,fetchImpl});
  const result=verifyMobileAcceptanceEvidence({
    target,
    evidence,
    expected:{
      sourceCommit:expectedCommit,
      deploymentManifestDigest:live.manifestDigest,
      origin:'https://sjonesjones917.github.io',
      basePath:'/closed-loop-tracker/',
      verificationTime:verificationTime||new Date().toISOString()
    },
    usedChallenges
  });
  if(!result.accepted)return {accepted:false,status:'BLOCKED',errors:result.errors,live};
  return {
    accepted:true,
    status:'ACCEPTED',
    errors:[],
    live,
    challengeDigest:sha256(Buffer.from(target.challenge,'utf8')),
    acceptance:{
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
      mobileAcceptancePerformer:evidence.performer,
      mobileAcceptancePhysicalDeviceAssertion:evidence.physicalDeviceAssertion===true,
      finalAcceptancePublication:true,
      releaseTagEligible:true,
      mobileAcceptanceBlockers:[],
      jobResults:{physicalIPhone:'ACCEPTED'},
      nextProofStep:'Final acceptance publication and release tag.'
    }
  };
}

async function main(){
  const target=parseAuthenticatedJson(process.env.MOBILE_ACCEPTANCE_TARGET_JSON,'MOBILE_ACCEPTANCE_TARGET_JSON');
  const evidence=parseAuthenticatedJson(process.env.MOBILE_ACCEPTANCE_EVIDENCE_JSON,'MOBILE_ACCEPTANCE_EVIDENCE_JSON');
  const usedChallenges=process.env.USED_MOBILE_CHALLENGES_JSON?JSON.parse(process.env.USED_MOBILE_CHALLENGES_JSON):[];
  if(!Array.isArray(usedChallenges))throw new Error('USED_MOBILE_CHALLENGES_JSON must be a JSON array.');
  const result=await verifyMobileAcceptanceSubmission({
    target,
    evidence,
    expectedCommit:process.env.GITHUB_SHA,
    pageUrl:process.env.PAGE_URL||CANONICAL_MOBILE_PAGE_URL,
    usedChallenges
  });
  if(!result.accepted){
    console.error(JSON.stringify(result,null,2));
    process.exitCode=1;
    return;
  }
  console.log(JSON.stringify(result,null,2));
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])await main();
