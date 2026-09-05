import crypto from 'node:crypto';

export const MOBILE_ACCEPTANCE_ORIGIN='https://sjonesjones917.github.io';
export const MOBILE_ACCEPTANCE_BASE_PATH='/closed-loop-tracker/';
const SHA256=/^[0-9a-f]{64}$/;
const COMMIT=/^[0-9a-f]{40}$/;
const UTC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MIN_LIFETIME_SECONDS=60;
const MAX_LIFETIME_SECONDS=24*60*60;

function required(value,name){
  if(typeof value!=='string'||!value.trim())throw new TypeError(`${name} is required.`);
  return value;
}
function instant(value,name){
  if(!UTC.test(value)||new Date(value).toISOString()!==value)throw new TypeError(`${name} must be a canonical UTC RFC3339 instant.`);
  return value;
}

export function createMobileAcceptanceTarget(input={}){
  const {
    sourceCommit,deploymentManifestDigest,origin,basePath,testProjectId,procedureVersion,
    viewport,deviceModel,iosVersion,safariVersion,safariUserAgent,
    challengeLifetimeSeconds=3600,issuedAt=new Date().toISOString()
  }=input;
  if(!COMMIT.test(sourceCommit||''))throw new TypeError('sourceCommit must be an exact 40-character commit SHA.');
  if(!SHA256.test(deploymentManifestDigest||''))throw new TypeError('deploymentManifestDigest must be a SHA-256 digest.');
  if(origin!==MOBILE_ACCEPTANCE_ORIGIN)throw new TypeError('origin must be the canonical deployment origin.');
  if(basePath!==MOBILE_ACCEPTANCE_BASE_PATH)throw new TypeError('basePath must be the canonical deployment base path.');
  required(testProjectId,'testProjectId'); required(procedureVersion,'procedureVersion');
  if(!viewport||!Number.isFinite(viewport.width)||!Number.isFinite(viewport.height)||!Number.isFinite(viewport.devicePixelRatio)||viewport.width<=0||viewport.height<=0||viewport.devicePixelRatio<=0)throw new TypeError('viewport width, height, and devicePixelRatio are required.');
  required(deviceModel,'deviceModel'); required(iosVersion,'iosVersion'); required(safariVersion,'safariVersion'); required(safariUserAgent,'safariUserAgent');
  if(!Number.isSafeInteger(challengeLifetimeSeconds)||challengeLifetimeSeconds<MIN_LIFETIME_SECONDS||challengeLifetimeSeconds>MAX_LIFETIME_SECONDS)throw new RangeError(`challengeLifetimeSeconds must be between ${MIN_LIFETIME_SECONDS} and ${MAX_LIFETIME_SECONDS}.`);
  instant(issuedAt,'issuedAt');
  const expiresAt=new Date(Date.parse(issuedAt)+challengeLifetimeSeconds*1000).toISOString();
  const challenge=crypto.randomBytes(32).toString('hex');
  return {
    schema:'closed-loop-mobile-acceptance-target/1',
    mobileAcceptanceTargetId:`MOBILE-TARGET-${crypto.randomBytes(12).toString('hex')}`,
    physicalDeviceRequired:true,challenge,challengeIssuedAt:issuedAt,challengeExpiresAt:expiresAt,
    sourceCommit,deploymentManifestDigest,origin,basePath,testProjectId,procedureVersion,
    viewport:{width:viewport.width,height:viewport.height,devicePixelRatio:viewport.devicePixelRatio},
    deviceModel,iosVersion,safariVersion,safariUserAgent
  };
}

if(import.meta.url===new URL(`file://${process.argv[1]}`).href){
  try{
    const target=createMobileAcceptanceTarget(JSON.parse(process.env.MOBILE_ACCEPTANCE_TARGET_INPUT||'{}'));
    process.stdout.write(`${JSON.stringify(target,null,2)}\n`);
  }catch(error){process.stderr.write(`${error.message}\n`);process.exitCode=1;}
}
