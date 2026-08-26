import fs from 'node:fs';

const responsePath='response-ingestion.js';
let response=fs.readFileSync(responsePath,'utf8');
const needle="next.projectData.blockers.push({id,stage,active:true,fields,...fields,contentSha256:hash.contentRecordSha256({fields},'BLOCKER_ID'),recordSha256:hash.recordSha256({fields}),source:'APPLICATION_DISPOSITION',rawResponseId:proposal.rawResponseId});";
const replacement="const blocker={id,stage,active:true,fields,...fields,source:'APPLICATION_DISPOSITION',rawResponseId:proposal.rawResponseId};blocker.contentSha256=hash.contentRecordSha256(blocker,'BLOCKER_ID');blocker.recordSha256=hash.recordSha256(blocker);blocker.sha256=blocker.recordSha256;next.projectData.blockers.push(blocker);";
if(!response.includes(needle))throw new Error('Expected blocker hash construction site was not found exactly once.');
if(response.split(needle).length!==2)throw new Error('Blocker hash construction site is ambiguous.');
response=response.replace(needle,replacement);
fs.writeFileSync(responsePath,response);

const verifyPath='verify-ingestion.mjs';
let verify=fs.readFileSync(verifyPath,'utf8');
const marker='// Accepted BLOCKED canonical blockers must carry a hash of the complete stored record.';
if(!verify.includes(marker))verify += `\n\n${marker}\n{\n  let p=project('JOB-BLOCKER-RECORD-HASH'),stage=2,pr=savePrompt(p,stage);\n  const blocked={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'BLOCKED',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[{temporaryKey:'blocked-1',kind:'MISSING_APPLICATION_CONTEXT',description:'Required application context is unavailable.',whyBlocking:'The current stage cannot proceed reliably.',affectedStageFields:[],affectedRecords:[],blocking:true}],warnings:[],attachments:[]};\n  const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(blocked),promptRecord:pr});\n  if(!prepared.validation.valid)throw new Error('Blocked-response regression fixture is invalid: '+JSON.stringify(prepared.validation.issues));\n  p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'}).project;\n  const blocker=p.projectData.blockers.at(-1),expected=globalThis.closedLoopHash.recordSha256(blocker);\n  if(!blocker||blocker.recordSha256!==expected||blocker.sha256!==expected)throw new Error('Accepted BLOCKED canonical blocker does not carry a recomputable complete-record hash.');\n}\n`;
fs.writeFileSync(verifyPath,verify);

for(const path of ['repair-blocker-record-hash.mjs','.github/workflows/repair-blocker-record-hash.yml'])if(fs.existsSync(path))fs.rmSync(path);
