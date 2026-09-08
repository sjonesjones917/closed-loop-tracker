// Repository-only transport. Authentication attributes the submission; it does not
// manufacture visual approval, screenshots, measurements, or comparison results.
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const commitSha=/^[0-9a-f]{40}$/;
export function resolveVisualBaselineSubmission({inputJson='',ledgerVisualBaseline=null,eventName,ref,submitter,commit}={}){
  if(typeof inputJson!=='string')throw new TypeError('Visual evidence input must be JSON text.');
  if(!inputJson.trim())return structuredClone(ledgerVisualBaseline);
  if(eventName!=='workflow_dispatch'||ref!=='refs/heads/main'||!nonempty(submitter)||!commitSha.test(commit||''))throw new Error('Visual evidence requires authenticated workflow dispatch on exact main.');
  let evidence;
  try{evidence=JSON.parse(inputJson);}catch{throw new Error('Visual evidence input is not valid JSON.');}
  if(!object(evidence))throw new Error('Visual evidence must be an object.');
  if(evidence.status!=='PROVEN'||!commitSha.test(evidence.sourceCommit||'')||evidence.comparedCommit!==commit||evidence.comparisonResult!=='PASS')throw new Error('Visual evidence must bind a passing comparison to the exact submitted commit.');
  if(!['APPROVED_PREDECESSOR','VISUAL_BASELINE_AUTHORIZATION'].includes(evidence.authority)||!nonempty(evidence.authorityRecordId))throw new Error('Visual evidence requires the actual approved-predecessor or human-authorization record identity.');
  if(!Array.isArray(evidence.evidenceReferences)||!evidence.evidenceReferences.length||evidence.evidenceReferences.some(value=>!nonempty(value)))throw new Error('Visual evidence must reference actual approval and before/after comparison artifacts.');
  // Retain supplied proof exactly; never fill in comparedCommit or infer approval.
  // Any caller-supplied submitter metadata is replaced by authenticated CI context.
  return {...evidence,submission:{method:'AUTHENTICATED_WORKFLOW_INPUT',submitter,commit,eventName,ref}};
}
