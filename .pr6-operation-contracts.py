from pathlib import Path

# workflow-schema.js: add exact Stage 17/19 operation contracts and use them from operationContract().
p=Path('workflow-schema.js'); s=p.read_text()
old="""function operationContract(stage,operation){const operations=STAGE_OPERATIONS[stage]||['COMPLETE'];if(!operations.includes(operation))return null;return Object.freeze({operation,readCollections:Object.freeze(READ_COLLECTIONS[stage]||[]),agentWritableCollections:Object.freeze(STAGE_COLLECTIONS[stage]||[]),applicationCollections:Object.freeze(APPLICATION_COLLECTIONS[stage]||[]),humanActions:Object.freeze(HUMAN_ACTIONS[stage]||[]),scopeRequirements:Object.freeze(SCOPE_REQUIREMENTS[stage]||[])});}"""
base="['projectRevision','inputVersion','sourceSetVersion','requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId']"
new=f"""const OPERATION_CONTRACT_OVERRIDES=Object.freeze({{
  17:Object.freeze({{
    FREEZE:Object.freeze({{readCollections:Object.freeze(['changes','candidateFreezes','iterations','tests','regressions','regressionExecutions','artifacts']),agentWritableCollections:Object.freeze([]),scopeRequirements:Object.freeze({base})}}),
    EXECUTE_RUN:Object.freeze({{readCollections:Object.freeze(['changes','candidateFreezes','iterations','tests','regressions']),agentWritableCollections:Object.freeze(['runs']),scopeRequirements:Object.freeze([...{base},'runId','contextId'])}}),
    VERIFY:Object.freeze({{readCollections:Object.freeze(['runs','requirements','tests','freshContexts']),agentWritableCollections:Object.freeze(['verification']),scopeRequirements:Object.freeze([...{base},'runId','contextId'])}}),
    COMPARE:Object.freeze({{readCollections:Object.freeze(['verification','runs','requirements']),agentWritableCollections:Object.freeze(['comparisons']),scopeRequirements:Object.freeze({base})}}),
    ROOT_CAUSE:Object.freeze({{readCollections:Object.freeze(['defects','comparisons','verification','requirements']),agentWritableCollections:Object.freeze(['defects','rootCauses']),scopeRequirements:Object.freeze({base})}}),
    REGRESSION:Object.freeze({{readCollections:Object.freeze(['defects','rootCauses','regressions','regressionExecutions']),agentWritableCollections:Object.freeze(['regressions','regressionExecutions']),scopeRequirements:Object.freeze({base})}}),
    CORRECT:Object.freeze({{readCollections:Object.freeze(['defects','rootCauses','regressions','regressionExecutions','changes']),agentWritableCollections:Object.freeze(['changes']),scopeRequirements:Object.freeze({base})}})
  }}),
  19:Object.freeze({{
    CONFIRM_FREEZE:Object.freeze({{readCollections:Object.freeze(['convergenceRecords','candidateFreezes','iterations','tests','regressions','regressionExecutions','artifacts']),agentWritableCollections:Object.freeze([]),scopeRequirements:Object.freeze({base})}}),
    EXECUTE_RUN:Object.freeze({{readCollections:Object.freeze(['candidateFreezes','iterations','tests','regressions']),agentWritableCollections:Object.freeze(['runs']),scopeRequirements:Object.freeze([...{base},'runId','contextId'])}}),
    VERIFY:Object.freeze({{readCollections:Object.freeze(['runs','requirements','tests','freshContexts']),agentWritableCollections:Object.freeze(['verification']),scopeRequirements:Object.freeze([...{base},'runId','contextId'])}}),
    COMPARE:Object.freeze({{readCollections:Object.freeze(['verification','runs','requirements']),agentWritableCollections:Object.freeze(['comparisons']),scopeRequirements:Object.freeze({base})}}),
    REGRESSION_VERIFY:Object.freeze({{readCollections:Object.freeze(['regressions','regressionExecutions','runs']),agentWritableCollections:Object.freeze(['regressionExecutions']),scopeRequirements:Object.freeze({base})}}),
    CONFIRM:Object.freeze({{readCollections:Object.freeze(['convergenceRecords','candidateFreezes','iterations','verification','comparisons','regressionExecutions']),agentWritableCollections:Object.freeze(['confirmationRecords']),scopeRequirements:Object.freeze({base})}})
  }})
}});
function operationContract(stage,operation){{const operations=STAGE_OPERATIONS[stage]||['COMPLETE'];if(!operations.includes(operation))return null;const override=OPERATION_CONTRACT_OVERRIDES[stage]?.[operation]||null;return Object.freeze({{operation,readCollections:override?.readCollections||Object.freeze(READ_COLLECTIONS[stage]||[]),agentWritableCollections:override?.agentWritableCollections||Object.freeze(STAGE_COLLECTIONS[stage]||[]),applicationCollections:Object.freeze(APPLICATION_COLLECTIONS[stage]||[]),humanActions:Object.freeze(HUMAN_ACTIONS[stage]||[]),scopeRequirements:override?.scopeRequirements||Object.freeze(SCOPE_REQUIREMENTS[stage]||[])}});}}"""
assert old in s, 'operationContract block not found'
s=s.replace(old,new,1)
s=s.replace("STAGE_COUNT,VALUE_TYPES,COLLECTION_POLICIES,DEFAULT_RESOURCE_LIMITS,STAGE_OPERATIONS,READ_COLLECTIONS", "STAGE_COUNT,VALUE_TYPES,COLLECTION_POLICIES,DEFAULT_RESOURCE_LIMITS,STAGE_OPERATIONS,OPERATION_CONTRACT_OVERRIDES,READ_COLLECTIONS",1)
p.write_text(s)

# response-ingestion.js: validate operation-specific scope and writable collections.
p=Path('response-ingestion.js'); s=p.read_text()
old="""  const expectedOperation=promptRecord?.operation||contract?.operations?.[0];if(String(envelope.operation||'')!==String(expectedOperation||''))issues.push(issue('WRONG_OPERATION','/operation',`Expected operation ${expectedOperation||'UNKNOWN'}.`));
  if(!object(envelope.scope))issues.push(issue('INVALID_SCOPE','/scope','scope must be an object.'));else{unknownKeys(envelope.scope,['projectRevision','inputVersion','sourceSetVersion','requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId','runId','contextId','baselineId','productId'],'/scope',issues);const expected=currentScope(project,promptRecord);for(const key of contract?.scopeRequirements||[])if(JSON.stringify(envelope.scope[key]??null)!==JSON.stringify(expected[key]??null))issues.push(issue('STALE_SCOPE',`/scope/${key}`,`Scope ${key} does not match the controlling prompt.`));}"""
new="""  const expectedOperation=promptRecord?.operation||contract?.operations?.[0];if(String(envelope.operation||'')!==String(expectedOperation||''))issues.push(issue('WRONG_OPERATION','/operation',`Expected operation ${expectedOperation||'UNKNOWN'}.`));
  const operationRules=schema.operationContract(stageNumber,expectedOperation)||contract;
  if(!object(envelope.scope))issues.push(issue('INVALID_SCOPE','/scope','scope must be an object.'));else{unknownKeys(envelope.scope,['projectRevision','inputVersion','sourceSetVersion','requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId','runId','contextId','baselineId','productId'],'/scope',issues);const expected=currentScope(project,promptRecord);for(const key of operationRules?.scopeRequirements||[])if(JSON.stringify(envelope.scope[key]??null)!==JSON.stringify(expected[key]??null))issues.push(issue('STALE_SCOPE',`/scope/${key}`,`Scope ${key} does not match the controlling prompt.`));}"""
assert old in s, 'ingestion scope block not found'; s=s.replace(old,new,1)
old="const allowedCollections=new Set(contract?.agentWritableCollections||contract?.allowedCollections||[]);"
new="const allowedCollections=new Set(operationRules?.agentWritableCollections||contract?.agentWritableCollections||contract?.allowedCollections||[]);"
assert old in s; s=s.replace(old,new,1)
p.write_text(s)

# prompt-engine.js: operation-specific context, displayed writable collections, body, and manifest.
p=Path('prompt-engine.js'); s=p.read_text()
s=s.replace("function contextFor(stage,state){", "function contextFor(stage,state,readCollections=null){",1)
s=s.replace("for(const collection of contextCollections[stage]||[])parts.push", "for(const collection of readCollections||contextCollections[stage]||[])parts.push",1)
old="const contract=schema.STAGE_CONTRACTS[stage];const writable=contract.agentWritableCollections;"
new="const contract=schema.STAGE_CONTRACTS[stage],op=schema.operationContract(stage,operation);const writable=op?.agentWritableCollections||contract.agentWritableCollections;"
assert old in s; s=s.replace(old,new,1)
s=s.replace("function body(stage,state){", "function body(stage,state,operation){",1)
old=""" const contract=schema.STAGE_CONTRACTS[stage];
 const fields=contract.allowedStageData.length?contract.allowedStageData.map(x=>`- ${x}`).join('\\n'):'- No agent-owned stageData fields; use permitted records/evidence only.';
 const collections=contract.agentWritableCollections.length?contract.agentWritableCollections.map(c=>`- ${c}: ${schema.recordAgentFields(c).join(', ')||'no agent-owned fields'}`).join('\\n'):'- NONE';"""
new=""" const contract=schema.STAGE_CONTRACTS[stage],op=schema.operationContract(stage,operation)||contract;
 const fields=contract.allowedStageData.length?contract.allowedStageData.map(x=>`- ${x}`).join('\\n'):'- No agent-owned stageData fields; use permitted records/evidence only.';
 const collections=op.agentWritableCollections.length?op.agentWritableCollections.map(c=>`- ${c}: ${schema.recordAgentFields(c).join(', ')||'no agent-owned fields'}`).join('\\n'):'- NONE';"""
assert old in s; s=s.replace(old,new,1)
s=s.replace("${contextFor(stage,state)}", "${contextFor(stage,state,op.readCollections)}",1)
old=""" const scope=scopeFor(stage,state,options.scope||{}),contextManifest={stage,operation,scope,readCollections:Object.fromEntries((schema.STAGE_CONTRACTS[stage].readCollections||[]).map(collection=>[collection,(state?.projectData?.[collection]||[]).filter(x=>x?.active!==false&&!x?.invalidatedBy).map(record=>({id:recordId(record,collection),scope:record.scope||{},contentSha256:record.contentSha256||record.sha256||hash.sha256Value(record.fields||record)}))])),answeredHumanClarifications:"""
new=""" const opContract=schema.operationContract(stage,operation)||schema.STAGE_CONTRACTS[stage];
 const scope=scopeFor(stage,state,options.scope||{}),contextManifest={stage,operation,scope,readCollections:Object.fromEntries((opContract.readCollections||[]).map(collection=>[collection,(state?.projectData?.[collection]||[]).filter(x=>x?.active!==false&&!x?.invalidatedBy).map(record=>({id:recordId(record,collection),scope:record.scope||{},contentSha256:record.contentSha256||record.sha256||hash.sha256Value(record.fields||record)}))])),answeredHumanClarifications:"""
assert old in s, 'prompt manifest prefix not found'; s=s.replace(old,new,1)
s=s.replace("bodyText=body(stage,state)", "bodyText=body(stage,state,operation)",1)
p.write_text(s)

# Strengthen semantic proof with exact writable collection expectations for repeated operations.
p=Path('verify-prompt-semantics.mjs'); s=p.read_text()
needle="""let checked=0;
for(let stage=1;stage<=30;stage++){"""
insert="""const exactOperationWrites={
  '17:FREEZE':[],'17:EXECUTE_RUN':['runs'],'17:VERIFY':['verification'],'17:COMPARE':['comparisons'],'17:ROOT_CAUSE':['defects','rootCauses'],'17:REGRESSION':['regressions','regressionExecutions'],'17:CORRECT':['changes'],
  '19:CONFIRM_FREEZE':[],'19:EXECUTE_RUN':['runs'],'19:VERIFY':['verification'],'19:COMPARE':['comparisons'],'19:REGRESSION_VERIFY':['regressionExecutions'],'19:CONFIRM':['confirmationRecords']
};
for(const [key,expected] of Object.entries(exactOperationWrites)){const [stage,operation]=key.split(':');const actual=schema.operationContract(Number(stage),operation)?.agentWritableCollections||[];if(!arraysEqual(actual,expected))throw new Error(`${key} writable collections contradict the required operation contract.`);}

let checked=0;
for(let stage=1;stage<=30;stage++){"""
assert needle in s; s=s.replace(needle,insert,1)
p.write_text(s)
