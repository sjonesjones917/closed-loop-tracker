from pathlib import Path


def rep(path, old, new, count=1):
    p=Path(path); s=p.read_text(); n=s.count(old)
    if n < count: raise SystemExit(f'{path}: expected at least {count}, found {n}: {old[:140]!r}')
    p.write_text(s.replace(old,new,count))

# Stage 01 human intake: only the verbatim request is universally required; source-count guidance is numeric when provided.
rep('workflow-schema.js',
"  if(HUMAN_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN,{requiredAtStage:1,provenanceRequired:false});",
"  if(HUMAN_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN,{requiredAtStage:name==='EXACT_USER_OBJECTIVE_VERBATIM'?1:null,provenanceRequired:false,valueType:name==='DESIRED_SOURCE_COUNT'?'INTEGER':'STRING',nullable:name!=='EXACT_USER_OBJECTIVE_VERBATIM'});")

# The copyable response envelope must never contain values that a valid response is forbidden to return.
p=Path('prompt-engine.js'); s=p.read_text()
old="""function responseContract(stage,operation,instructionId,bodySha256,contractSha256,contextSignature,scope){
 const contract=schema.STAGE_CONTRACTS[stage],op=schema.operationContract(stage,operation);const writable=op?.agentWritableCollections||contract.agentWritableCollections;
 const recordShape=Object.fromEntries(writable.map(collection=>[collection,[{tempKey:'response-local-key',targetId:(schema.RECORD_SCHEMAS[collection]?.commitPolicy==='UPDATE_RESERVED'?(scope.runId||scope.productId||'<application-reserved-target-id>'):null),fields:Object.fromEntries(schema.recordAgentFields(collection).map(name=>[name,'<value>'])),relationships:{},evidenceRefs:['evidence-1']}]]));
 return JSON.stringify({schema:schema.RESPONSE_SCHEMA,jobId:'<exact current JOB_ID>',stage,operation,promptIdentity:{instructionId,bodySha256,contractSha256,contextSignature},scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:Object.fromEntries(contract.allowedStageData.map(name=>[name,'<value>'])),records:recordShape,evidence:[{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:'Exact evidence supporting proposed values',location:'<source/output location>',content:'<exact evidence or faithful excerpt>'}],unresolved:[],warnings:[],attachments:[]},null,2);
}"""
new="""function responseContract(stage,operation,instructionId,bodySha256,contractSha256,contextSignature,scope,jobId){
 return JSON.stringify({schema:schema.RESPONSE_SCHEMA,jobId:String(jobId||''),stage,operation,promptIdentity:{instructionId,bodySha256,contractSha256,contextSignature},scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]},null,2);
}"""
if s.count(old)!=1: raise SystemExit(f'prompt-engine.js responseContract implementation shape changed: {s.count(old)}')
s=s.replace(old,new,1)
s=s.replace("const fields=contract.allowedStageData.length?contract.allowedStageData.map(x=>`- ${x}`).join('\\n'):'- No agent-owned stageData fields; use permitted records/evidence only.';",
"const fields=contract.allowedStageData.length?contract.allowedStageData.map(x=>{const def=schema.STAGE_FIELDS[stage][x];return `- ${x}: ${def.valueType}${def.enumValues?.length?` enum(${def.enumValues.join(' | ')})`:''}${def.nullable?' nullable':''}`;}).join('\\n'):'- No agent-owned stageData fields; use permitted records/evidence only.';",1)
s=s.replace("const collections=writable.length?writable.map(c=>`- ${c}: ${schema.recordAgentFields(c).join(', ')||'no agent-owned fields'}`).join('\\n'):'- NONE';",
"const collections=writable.length?writable.map(c=>`- ${c}: ${schema.recordAgentFields(c).map(name=>{const def=schema.RECORD_SCHEMAS[c].fieldDefinitions[name];return `${name} (${def.valueType}${def.enumValues?.length?`; ${def.enumValues.join(' | ')}`:''}${def.nullable?'; nullable':''})`;}).join(', ')||'no agent-owned fields'}`).join('\\n'):'- NONE';",1)
oldcall='${responseContract(stage,operation,instructionId,bodySha256,contractSha256,contextSignature,scope)}'
newcall='${responseContract(stage,operation,instructionId,bodySha256,contractSha256,contextSignature,scope,state?.job?.JOB_ID)}'
if s.count(oldcall)!=1: raise SystemExit(f'prompt-engine responseContract call count {s.count(oldcall)}')
s=s.replace(oldcall,newcall,1)
p.write_text(s)

# Semantic acceptance should prove the copyable contract is safe to follow literally.
p=Path('verify-prompt-semantics.mjs'); s=p.read_text(); marker='// Exact copyable response-contract invariants.'
if marker not in s:
    s += r'''

// Exact copyable response-contract invariants.
{
 const p=baseProject();p.job.JOB_ID='JOB-EXACT-CONTRACT-001';
 const built=prompts.buildPromptRecord(2,p),text=built.prompt;
 if(!text.includes('"jobId": "JOB-EXACT-CONTRACT-001"'))throw new Error('Copyable response contract does not contain the exact current JOB_ID.');
 for(const token of ['<value>','<exact current JOB_ID>','<application-reserved-target-id>','<source/output location>','<exact evidence or faithful excerpt>'])if(text.includes(token))throw new Error(`Copyable response contract contains invalid placeholder ${token}.`);
 const marker='STRICT RESPONSE CONTRACT\n',end='\n\nEND COPY BLOCK';const start=text.indexOf(marker);if(start<0)throw new Error('Strict response contract block is missing.');
 const raw=text.slice(start+marker.length,text.indexOf(end,start));const envelope=JSON.parse(raw);
 if(Object.keys(envelope.stageData||{}).length||Object.keys(envelope.records||{}).length||(envelope.evidence||[]).length)throw new Error('Copyable response skeleton fabricates proposal data or evidence.');
 if(!/PERMITTED AGENT-OWNED STAGE DATA[\s\S]*: (STRING|INTEGER|NUMBER|BOOLEAN|STRING_ARRAY|REFERENCE|REFERENCE_ARRAY|OBJECT)/.test(text))throw new Error('Prompt does not state agent stage-field value types outside the response skeleton.');
}
{
 const d=schema.JOB_FIELDS;
 if(d.EXACT_USER_OBJECTIVE_VERBATIM.requiredAtStage!==1||d.EXACT_USER_OBJECTIVE_VERBATIM.nullable)throw new Error('Verbatim job request is not the required Stage 01 human intake.');
 for(const name of schema.HUMAN_JOB_FIELDS.filter(x=>x!=='EXACT_USER_OBJECTIVE_VERBATIM'))if(d[name].requiredAtStage===1)throw new Error(`Optional human intake field ${name} is still universally required at Stage 01.`);
 if(d.DESIRED_SOURCE_COUNT.valueType!=='INTEGER'||!d.DESIRED_SOURCE_COUNT.nullable)throw new Error('Desired source count is not optional integer guidance.');
}
'''
    p.write_text(s)
