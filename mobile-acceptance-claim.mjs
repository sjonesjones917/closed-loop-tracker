// Repository acceptance control, never part of the deployed application.
// The authorized controller creates one create-only challenge ref. CI only reads
// it, and only the designated workflow run and attempt may consume its proof.
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const MOBILE_CLAIM_REPOSITORY='sjonesjones917/closed-loop-tracker';
const schema='closed-loop-mobile-acceptance-claim/1';
const digest=value=>createHash('sha256').update(value,'utf8').digest('hex');
const requireClaim=(condition,message)=>{if(!condition)throw new Error('MOBILE_CHALLENGE_CLAIM: '+message);};
const positive=value=>typeof value==='string'&&/^[1-9][0-9]*$/.test(value);
const objectJson=(text,label)=>{let value;try{value=JSON.parse(text);}catch{throw new Error('MOBILE_CHALLENGE_CLAIM: '+label+' must be object JSON');}requireClaim(value&&typeof value==='object'&&!Array.isArray(value),label+' must be object JSON');return value;};

export function mobileClaimRef(challenge){
  requireClaim(typeof challenge==='string'&&/^[0-9a-fA-F]{32,}$/.test(challenge),'invalid challenge');
  return 'refs/tags/mobile-acceptance-challenge-'+challenge.toLowerCase();
}

function claimIdentity({targetJson,evidenceJson,repository,sourceCommit,runId,runAttempt}){
  requireClaim(typeof targetJson==='string'&&typeof evidenceJson==='string','exact input strings are required');
  const target=objectJson(targetJson,'target'),evidence=objectJson(evidenceJson,'evidence');
  requireClaim(repository===MOBILE_CLAIM_REPOSITORY,'wrong repository');
  requireClaim(/^[0-9a-f]{40}$/.test(sourceCommit||'')&&sourceCommit===target.sourceCommit&&sourceCommit===evidence.sourceCommit,'source commit differs');
  requireClaim(positive(String(runId))&&positive(String(runAttempt)),'run and attempt identities are required');
  requireClaim(typeof target.mobileAcceptanceTargetId==='string'&&target.mobileAcceptanceTargetId.length>0&&target.mobileAcceptanceTargetId===evidence.mobileAcceptanceTargetId,'target identity differs');
  requireClaim(typeof evidence.mobileAcceptanceEvidenceId==='string'&&evidence.mobileAcceptanceEvidenceId.length>0,'evidence identity is required');
  requireClaim(target.challenge===evidence.challenge,'challenge binding differs');
  mobileClaimRef(target.challenge);
  return {schema,repository,sourceCommit,runId:String(runId),runAttempt:String(runAttempt),challenge:target.challenge.toLowerCase(),targetId:target.mobileAcceptanceTargetId,evidenceId:evidence.mobileAcceptanceEvidenceId,targetSha256:digest(targetJson),evidenceSha256:digest(evidenceJson)};
}

export function validateMobileChallengeClaim(claim,input){
  const expected=claimIdentity(input);
  requireClaim(claim&&typeof claim==='object'&&!Array.isArray(claim),'durable claim is required');
  requireClaim(Object.keys(claim).length===Object.keys(expected).length,'claim field inventory differs');
  for(const [key,value]of Object.entries(expected))requireClaim(claim[key]===value,'claim differs at '+key);
  return claim;
}

function workflowBinding(run,input){
  requireClaim(run&&String(run.id)===String(input.runId)&&String(run.run_attempt)===String(input.runAttempt),'workflow run or attempt differs');
  requireClaim(run.event==='workflow_dispatch'&&run.head_branch==='main'&&run.head_sha===input.sourceCommit,'claim requires the exact main acceptance dispatch');
  requireClaim(run.path==='.github/workflows/pages.yml','wrong workflow');
  requireClaim(run.repository?.full_name===input.repository&&run.head_repository?.full_name===input.repository,'workflow repository differs');
}

export async function readMobileChallengeClaim(input,{api}={}){
  requireClaim(typeof api==='function','authenticated repository reader is required');
  const expected=claimIdentity(input),ref=mobileClaimRef(expected.challenge);
  const reference=await api('GET','git/ref/'+ref.slice(5));
  requireClaim(reference?.ref===ref&&reference.object?.type==='tag'&&/^[0-9a-f]{40}$/.test(reference.object.sha||''),'missing annotated challenge claim');
  const tag=await api('GET','git/tags/'+reference.object.sha);
  requireClaim(tag?.sha===reference.object.sha&&tag.tag===ref.slice(10)&&tag.object?.type==='commit'&&tag.object.sha===input.sourceCommit,'claim tag object differs');
  const claim=validateMobileChallengeClaim(objectJson(tag.message,'claim tag message'),input);
  return {ref,tagSha256:digest(tag.message),tagObjectSha:tag.sha,claim};
}

export async function createMobileChallengeClaim(input,{api,expected}={}){
  requireClaim(typeof api==='function','authorized repository connection is required');
  const claim=claimIdentity(input),ref=mobileClaimRef(claim.challenge);
  requireClaim(expected?.sourceCommit===input.sourceCommit,'verified deployed source is required');
  const {evaluateMobileAcceptanceSubmission}=await import('./evaluate-mobile-acceptance-submission.mjs');
  const checked=evaluateMobileAcceptanceSubmission({targetJson:input.targetJson,evidenceJson:input.evidenceJson,expected,submitter:input.submitter});
  requireClaim(checked.mobileAcceptanceResult==='ACCEPTED','raw target and evidence have not passed their existing verifier');
  const run=await api('GET','actions/runs/'+claim.runId);workflowBinding(run,input);
  requireClaim(['queued','in_progress','waiting','pending','requested'].includes(run.status)&&run.conclusion==null,'designated acceptance run is no longer active');
  // Creating an annotated object alone grants no authority. The create-only
  // ref operation is the durable atomic claim; an existing ref must fail.
  const tag=await api('POST','git/tags',{tag:ref.slice(10),message:JSON.stringify(claim),object:claim.sourceCommit,type:'commit'});
  requireClaim(/^[0-9a-f]{40}$/.test(tag?.sha||''),'repository did not return a tag object');
  await api('POST','git/refs',{ref,sha:tag.sha});
  return readMobileChallengeClaim(input,{api});
}

export function githubClaimApi({repository=MOBILE_CLAIM_REPOSITORY,token=process.env.GH_TOKEN}={}){
  requireClaim(repository===MOBILE_CLAIM_REPOSITORY&&typeof token==='string'&&token.length>0,'authenticated GitHub connection is unavailable');
  return async(method,suffix,body)=>{
    requireClaim(['GET','POST'].includes(method)&&/^(?:git\/(?:ref\/tags\/mobile-acceptance-challenge-[0-9a-f]+|tags(?:\/[0-9a-f]{40})?|refs)|actions\/runs\/[1-9][0-9]*)$/.test(suffix),'unregistered repository operation');
    const response=await fetch('https://api.github.com/repos/'+repository+'/'+suffix,{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000),redirect:'error'});
    requireClaim(response.ok,'GitHub '+method+' '+suffix+' failed with HTTP '+response.status+'; no update or automatic retry is permitted');
    return response.json();
  };
}

export async function readCurrentMobileChallengeClaim({targetJson,evidenceJson,sourceCommit=process.env.GITHUB_SHA,repository=process.env.GITHUB_REPOSITORY,runId=process.env.GITHUB_RUN_ID,runAttempt=process.env.GITHUB_RUN_ATTEMPT}={}){
  requireClaim(process.env.GITHUB_EVENT_NAME==='workflow_dispatch'&&process.env.GITHUB_REF==='refs/heads/main','claim consumption requires the main acceptance dispatch');
  const input={targetJson,evidenceJson,sourceCommit,repository,runId,runAttempt};
  return readMobileChallengeClaim(input,{api:githubClaimApi({repository})});
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const action=process.argv[2];
  try{
    requireClaim(action==='claim'&&process.argv.length===3,'only the explicit external-controller claim command is supported');
    requireClaim(process.env.GITHUB_ACTIONS!=='true','CI is read-only and must never create the claim');
    const input={targetJson:process.env.MOBILE_ACCEPTANCE_TARGET_JSON||'',evidenceJson:process.env.MOBILE_ACCEPTANCE_EVIDENCE_JSON||'',repository:MOBILE_CLAIM_REPOSITORY,sourceCommit:process.env.MOBILE_ACCEPTANCE_SOURCE_COMMIT,runId:process.env.MOBILE_ACCEPTANCE_RUN_ID,runAttempt:process.env.MOBILE_ACCEPTANCE_RUN_ATTEMPT,submitter:process.env.MOBILE_ACCEPTANCE_SUBMITTER};
    requireClaim(typeof input.submitter==='string'&&input.submitter.trim().length>0,'recorded submitter is required');
    // deployedExpected uses the same exact deployed-resource verifier as CI.
    const {deployedExpected}=await import('./evaluate-mobile-acceptance-submission.mjs');
    const previousSha=process.env.GITHUB_SHA;process.env.GITHUB_SHA=input.sourceCommit;
    let expected;try{expected=await deployedExpected();}finally{if(previousSha===undefined)delete process.env.GITHUB_SHA;else process.env.GITHUB_SHA=previousSha;}
    const result=await createMobileChallengeClaim(input,{api:githubClaimApi(),expected});
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
  }catch(error){process.stderr.write(String(error.stack||error)+'\n');process.exitCode=1;}
}
