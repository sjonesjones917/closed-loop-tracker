import fs from 'node:fs';
const f='verify-full-cycle.mjs';
let s=fs.readFileSync(f,'utf8');
const old1="const s1=data(1,{stageData:{EXACT_DELIVERABLE_REQUESTED:'Verified deliverable',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:'Verbatim job input plus clarification.'}});";
if(s.includes(old1))s=s.replace(old1,"const s1=data(1,{stageData:{EXACT_DELIVERABLE_REQUESTED:'Verified deliverable',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE'}});");
const dataPrefix="function data(stage,{operation,stageData={},records={},scope={}}={}){const pr=prompt(stage,operation,scope);if(!Object.keys(stageData).length&&!Object.keys(records).length){const f=schema.STAGE_CONTRACTS[stage].allowedStageData[0];if(f)stageData[f]=schema.STAGE_FIELDS[stage][f].valueType==='BOOLEAN'?true:`fixture-${f.toLowerCase()}`;}";
if(!s.includes('FULL-CYCLE-INTAKE-')){
 if(!s.includes(dataPrefix))throw new Error('Full-cycle data() prefix missing');
 s=s.replace(dataPrefix,dataPrefix+"if(stage===1){const intake=pr.contextManifest?.intakeCoverageManifest;if(!intake?.units)throw new Error('Stage 01 full-cycle prompt lacks intake manifest.');stageData={...stageData,INPUT_SET_CONTENTS:JSON.stringify({units:intake.units.map((u,i)=>({sourceUnitId:u.unitId,disposition:'incorporated into the job definition',extractedStatements:[{statementKey:'FULL-CYCLE-INTAKE-'+String(i+1),text:u.sourceLocation?.startsWith('job.')?String(p.job?.[u.sourceLocation.slice(4)]??u.label):String(u.label),statementClass:u.label==='EXACT_USER_OBJECTIVE_VERBATIM'?'REQUIREMENT':'FACT'}]}))})};}");
}
const old3="data(3,{stageData:{EXCEPTIONS_AND_EDGE_CONDITIONS:'NONE',CONFLICTING_OR_INVALIDATING_MATERIAL:'NONE',RESEARCH_GAPS_AND_BLOCKERS:'NONE',SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:'TRUE',LATEST_PASS_NUMBER:'1',NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:'FALSE'}});complete(3);";
if(s.includes(old3))s=s.replace(old3,"data(3,{stageData:{EXCEPTIONS_AND_EDGE_CONDITIONS:'NONE',CONFLICTING_OR_INVALIDATING_MATERIAL:'NONE',RESEARCH_GAPS_AND_BLOCKERS:'NONE'}});complete(3);");
const dataNeedle="const e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData,records,evidence:[evidence(`stage-${stage}-${pr.operation}`)],unresolved:[],warnings:[],attachments:[]};";
if(s.includes(dataNeedle)){
 const repl="const accountingEvidence=stage===4?(pr.contextManifest?.obligationManifest?.items||[]).map((item,i)=>({temporaryKey:'full-obligation-'+String(i+1),kind:'OBLIGATION_DISPOSITION',description:'Full-cycle Stage 04 obligation accounting',authorityType:'AGENT_CLAIM',sourceRef:'FULL_CYCLE',location:'Stage 04 synthetic fixture',content:JSON.stringify({obligationId:item.obligationId,disposition:'retained nonnormative context',reason:'Synthetic lifecycle fixture closes the enumerated obligation without inventing additional production semantics.'}),attachmentRef:null,notes:'fixture'})):[];const e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData,records,evidence:[evidence(`stage-${stage}-${pr.operation}`),...accountingEvidence],unresolved:[],warnings:[],attachments:[]};";
 s=s.replace(dataNeedle,repl);
}
if(!s.includes('FULL-CYCLE-INTAKE-'))throw new Error('Exact-prompt Stage 01 intake fixture missing');
if(!s.includes("kind:'OBLIGATION_DISPOSITION'"))throw new Error('Full-cycle Stage 04 closed accounting evidence missing');
fs.writeFileSync(f,s);
fs.unlinkSync(new URL(import.meta.url));
console.log('Full-cycle Stage 01 response bound to exact prompt manifest; Stage 03/04 accounting aligned.');