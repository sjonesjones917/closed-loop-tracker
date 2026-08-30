import fs from 'node:fs';
const file='spec-v3-followup.mjs';
let s=fs.readFileSync(file,'utf8');
s=s.replace("async function createExecutionPackage({project,jobId=null,stage,operation='COMPLETE',testIds=[],productId=null,runId=null,reviewerAliasContext=null}={}){","async function createExecutionPackage({project,jobId:requestedJobId=null,stage,operation='COMPLETE',testIds=[],productId=null,runId=null,reviewerAliasContext=null}={}){");
s=s.replace("if(jobId&&String(jobId)!==canonicalJobId)","if(requestedJobId&&String(requestedJobId)!==canonicalJobId)");
fs.writeFileSync(file,s);
