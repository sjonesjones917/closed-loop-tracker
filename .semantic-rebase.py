from pathlib import Path
import os
import subprocess

commit='3f5b20ae1b8565eb73b6f84f4399af36671448b4'
result=subprocess.run(['git','cherry-pick',commit])
if result.returncode:
    subprocess.run(['git','checkout','--ours','verify-ingestion.mjs'],check=True)
    p=Path('verify-ingestion.mjs')
    s=p.read_text()
    s += r'''

// Semantic response-type and reference validation must fail closed.
{
  const issues=[];
  ingestion.validateValue({valueType:'REFERENCE',nullable:false,enumValues:[]},123,'/ref',issues);
  if(!issues.some(x=>x.code==='WRONG_VALUE_TYPE'))throw new Error('Numeric scalar REFERENCE escaped type validation.');
  const arrayIssues=[];
  ingestion.validateValue({valueType:'REFERENCE_ARRAY',nullable:false,enumValues:[]},['REQ-1',2],'/refs',arrayIssues);
  if(!arrayIssues.some(x=>x.code==='WRONG_VALUE_TYPE'))throw new Error('Mixed REFERENCE_ARRAY escaped item validation.');
}
{
  const p=project('JOB-BLOCKED-SEMANTICS'),stage=1,pr={...prompts.buildPromptRecord(stage,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);
  const base={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,humanInputRequests:[],stageData:{},records:{},evidence:[],warnings:[],attachments:[]};
  const nonblocking={...base,responseType:'BLOCKED',unresolved:[{temporaryKey:'u1',kind:'MISSING_EVIDENCE',description:'Nonblocking observation',whyBlocking:'It is explicitly not blocking.',affectedStageFields:[],affectedRecords:[],blocking:false}]};
  const blocked=ingestion.prepare(p,{stage,text:JSON.stringify(nonblocking),promptRecord:pr});
  if(blocked.validation.valid||!blocked.validation.issues.some(x=>x.code==='MISSING_BLOCKING_UNRESOLVED'))throw new Error('BLOCKED without an actual blocker was accepted.');
  const mixed={...base,responseType:'DATA_PROPOSAL',stageData:{EXACT_DELIVERABLE_REQUESTED:'Self-contained specification'},evidence:[{temporaryKey:'e1',kind:'WORKFLOW_EVIDENCE',description:'Fixture',location:'test',content:'fixture'}],unresolved:[{temporaryKey:'u2',kind:'MISSING_EVIDENCE',description:'Blocking missing evidence',whyBlocking:'Cannot proceed reliably.',affectedStageFields:[],affectedRecords:[],blocking:true}]};
  const mixedResult=ingestion.prepare(p,{stage,text:JSON.stringify(mixed),promptRecord:pr});
  if(mixedResult.validation.valid||!mixedResult.validation.issues.some(x=>x.code==='MIXED_RESPONSE_TYPE'&&x.path==='/unresolved'))throw new Error('DATA_PROPOSAL with a blocking unresolved item was accepted.');
  const failed={...base,responseType:'EXECUTION_FAILED',humanInputRequests:[{temporaryKey:'q1',question:'Supply value?',whyRequired:'Needed after failure.',affectedStageFields:[],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:true}],unresolved:[{temporaryKey:'u3',kind:'EXECUTION_FAILURE',description:'Execution failed',whyBlocking:'Execution did not complete.',affectedStageFields:[],affectedRecords:[],blocking:true}]};
  const failedResult=ingestion.prepare(p,{stage,text:JSON.stringify(failed),promptRecord:pr});
  if(failedResult.validation.valid||!failedResult.validation.issues.some(x=>x.code==='MIXED_RESPONSE_TYPE'))throw new Error('EXECUTION_FAILED silently accepted human-input requests that commit would discard.');
}
'''
    p.write_text(s)
    subprocess.run(['git','add','prompt-engine.js','response-ingestion.js','verify-ingestion.mjs','verify-prompt-semantics.mjs'],check=True)
    env=os.environ.copy();env['GIT_EDITOR']='true'
    subprocess.run(['git','cherry-pick','--continue'],check=True,env=env)
