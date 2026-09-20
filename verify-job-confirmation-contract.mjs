import fs from 'node:fs';
import crypto from 'node:crypto';
import {responseFixture,OBJECTIVE} from './operator-journey-fixtures.mjs';
import {execFileSync} from 'node:child_process';
import {createVerifierRuntime} from './verifier-runtime.mjs';
const c=createVerifierRuntime({dispatchEvent(){},Event:class{}});
let schemaSource=fs.readFileSync('workflow-schema.js','utf8');
const requestedFault=process.argv.find(x=>x.startsWith('--fault='))?.slice(8);
const faults={blockers:["name==='CURRENT_BLOCKERS'?'STRING_ARRAY'","name==='CURRENT_BLOCKERS'?'STRING'"],action:["name==='NEXT_REQUIRED_ACTION'?'OBJECT'","name==='NEXT_REQUIRED_ACTION'?'STRING'"],intake:["if(AGENT_JOB_FIELDS.includes(name))return field(name,PRODUCER.AGENT,{requiredAtStage:1,valueType:'STRING'});","if(AGENT_JOB_FIELDS.includes(name))return field(name,PRODUCER.AGENT,{requiredAtStage:1,valueType:name==='INPUT_SET_CONTENTS'?'OBJECT':'STRING'});"],confirmation:["confirmationRecords:recordSchema({ownership:RECORD_OWNERSHIP.confirmationRecords,commitPolicy:COLLECTION_POLICIES.APPEND_SCOPED","confirmationRecords:recordSchema({ownership:RECORD_OWNERSHIP.confirmationRecords,commitPolicy:COLLECTION_POLICIES.APPLICATION_DERIVED"]};
if(requestedFault){const [before,after]=faults[requestedFault]||[];if(!before||schemaSource.split(before).length!==2)throw new Error('Missing unique contract fault anchor');schemaSource=schemaSource.replace(before,after);}
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])createVerifierRuntime.loadScript(c,file==='workflow-schema.js'?schemaSource:fs.readFileSync(file,'utf8'),{filename:file});
const schema=c.closedLoopWorkflowSchema,spec=fs.readFileSync('specification/closed-loop-reliability-controlling-implementation-specification.txt','utf8');
const chapter=spec.slice(spec.indexOf('15. Canonical Job fields'),spec.indexOf('16. Stage-data separation'));
const expected=[...chapter.matchAll(/^- ([A-Z][A-Z0-9_]*) — (HUMAN_DECISION|HUMAN|APPLICATION|AGENT); ([^;]+); Editable: (Yes|No); Nullable: (Yes|No); Required stage: (\d+|—); Authority: (.+)$/gm)];
if(!expected.length)throw new Error('The controlling Job field table was not parsed.');
const cases=expected.map(([text,name,producer,type,editable,nullable,required])=>{const d=schema.JOB_FIELDS[name],types={String:'STRING',Integer:'INTEGER'},want={producer,editable:editable==='Yes',nullable:nullable==='Yes',requiredAtStage:required==='—'?null:Number(required)},observed=d?Object.fromEntries(Object.keys(want).map(k=>[k,d[k]])):null,metadataMatches=JSON.stringify(want)===JSON.stringify(observed),typeMatches=types[type]?d?.valueType===types[type]:d?.valueType!=='STRING';return {caseId:'JOB-FIELD-'+name,sourceText:text,expected:{...want,type},actual:d||null,status:metadataMatches&&typeMatches?'PASS':'FAIL'};});
cases.push({caseId:'CONFIRMATION-APPEND-CONTRACT',expected:'Specification section 38 requires APPEND_SCOPED independently of application-owned fields.',actual:{recordPolicy:schema.RECORD_SCHEMAS.confirmationRecords.commitPolicy,durablePolicy:schema.DURABLE_OBJECT_REGISTRY.confirmationRecords.policy},status:schema.RECORD_SCHEMAS.confirmationRecords.commitPolicy==='APPEND_SCOPED'&&schema.DURABLE_OBJECT_REGISTRY.confirmationRecords.policy==='APPEND_SCOPED'?'PASS':'FAIL'});
const ingestion=fs.readFileSync('response-ingestion.js','utf8'),start=ingestion.indexOf('function validateValue('),end=ingestion.indexOf('\nfunction ',start+1);
c.schema=schema;c.hash=c.closedLoopHash;
createVerifierRuntime.loadScript(c,ingestion.slice(ingestion.indexOf('const object=value=>'),ingestion.indexOf('const unknownKeys='))+ingestion.slice(start,end),{filename:'response-ingestion.js#typed-value-owner'});
const project=c.closedLoopCore.createBlankState('JOB-DECLARED-TYPE-PROOF');c.closedLoopWorkflowEngine.recalculate(project);
for(const name of ['CURRENT_BLOCKERS','NEXT_REQUIRED_ACTION']){
 const value=project.job[name],validIssues=[],invalidIssues=[];c.validateValue(schema.JOB_FIELDS[name],value,'/job/'+name,validIssues);c.validateValue(schema.JOB_FIELDS[name],'unstructured prose','/job/'+name,invalidIssues);
 cases.push({caseId:'JOB-TYPED-DERIVATION-'+name,expected:'The declared field contract accepts the structured value produced by its application authority and rejects unstructured prose.',actual:{value,validIssues,invalidIssues},status:validIssues.length===0&&invalidIssues.some(x=>x.code==='WRONG_VALUE_TYPE')?'PASS':'FAIL'});
}
project.job.EXACT_USER_OBJECTIVE_VERBATIM=OBJECTIVE;c.closedLoopWorkflowEngine.recalculate(project);
const {prompt}=c.closedLoopPromptEngine.reserveAndBuildPromptRecord(project,1,{operation:'COMPLETE'}),response=responseFixture({schema,engine:c.closedLoopWorkflowEngine,prompt,manifest:c.closedLoopPromptEngine.promptFileManifest(prompt),instructionBytes:Buffer.from(prompt.prompt)}),intake=response.stageData.INPUT_SET_CONTENTS,stageIssues=[],jobIssues=[];
const prepared=c.closedLoopResponseIngestion.prepare(project,{stage:1,text:JSON.stringify(response),promptRecord:prompt,transport:{packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce}});
if(!prepared.validation.valid)throw new Error(JSON.stringify(prepared.validation.issues));
const committed=c.closedLoopResponseIngestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'SYNTHETIC_JOB_CONTRACT'}),acceptedIntake=committed.project.job.INPUT_SET_CONTENTS;
c.validateValue(schema.STAGE_FIELDS[1].INPUT_SET_CONTENTS,intake,'/stageData/INPUT_SET_CONTENTS',stageIssues);c.validateValue(schema.JOB_FIELDS.INPUT_SET_CONTENTS,acceptedIntake,'/job/INPUT_SET_CONTENTS',jobIssues);
cases.push({caseId:'JOB-INTAKE-PROJECTION',expected:'The Job projection accepts the exact intake value accepted by the Stage 1 field contract, without changing its bytes or producer.',actual:{fixture:'Authoritative responseFixture from generated Stage 1 instruction bytes',type:typeof intake,acceptedProjectionMatches:acceptedIntake===intake,acceptedChangeId:committed.acceptedChange.changeId,sha256:crypto.createHash('sha256').update(intake).digest('hex'),stageIssues,jobIssues},status:acceptedIntake===intake&&stageIssues.length===0&&jobIssues.length===0?'PASS':'FAIL'});
console.log(JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),specificationSha256:crypto.createHash('sha256').update(spec).digest('hex'),basis:'INDEPENDENT_SPECIFICATION_TABLE_AND_EXECUTED_PRODUCTION_TYPED_VALIDATOR',synthetic:true,actualBrowser:false,cases},null,2));
if(cases.some(x=>x.status==='FAIL')){process.stderr.write('JOB_CONTRACT_ORACLE: '+cases.filter(x=>x.status==='FAIL').map(x=>x.caseId).join(', ')+'\n');process.exitCode=1;}
