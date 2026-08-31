from pathlib import Path
p=Path('verify-data-route-closure.mjs');s=p.read_text()
old="""const collectionSentinels={};
for(const [collection,recordSchema] of Object.entries(schema.RECORD_SCHEMAS)){
  const currentId=`ROUTE-${collection}-CURRENT`;
  const staleId=`ROUTE-${collection}-STALE`;
  const agentField=Object.values(recordSchema.fieldDefinitions).find(def=>def.producer===schema.PRODUCER.AGENT)?.name;
  const fields={[recordSchema.idField]:currentId};
  const staleFields={[recordSchema.idField]:staleId};
  if(agentField){fields[agentField]=`CURRENT-SENTINEL-${collection}`;staleFields[agentField]=`STALE-SENTINEL-${collection}`;}
  const current={stage:recordSchema.stage||1,fields,scope:versionScopeFor(collection),active:true,validity:'CURRENT'};
  const stale={stage:recordSchema.stage||1,fields:staleFields,scope:staleScopeFor(collection),active:true,validity:'CURRENT'};
  state.projectData[collection]=[stale,current];
  collectionSentinels[collection]={currentId,staleId,currentText:`CURRENT-SENTINEL-${collection}`,staleText:`STALE-SENTINEL-${collection}`};
  const selected=engine.recordsForCurrentScope(state,collection);
  assert(selected.some(record=>engine.recordId(record,collection)===currentId),`${collection}: current-scope selector omitted current record.`);
  assert(!selected.some(record=>engine.recordId(record,collection)===staleId),`${collection}: current-scope selector admitted stale record.`);
}
"""
new="""const collectionSentinels={};
for(const collection of Object.keys(schema.RECORD_SCHEMAS))collectionSentinels[collection]={currentId:`ROUTE-${collection}-CURRENT`,staleId:`ROUTE-${collection}-STALE`,currentText:`CURRENT-SENTINEL-${collection}`,staleText:`STALE-SENTINEL-${collection}`};
const fixtureValue=(definition,stale=false)=>{
  const suffix=stale?'STALE':'CURRENT';
  if(definition.enumValues?.length)return definition.enumValues[0];
  switch(definition.valueType){
    case 'BOOLEAN':return false;
    case 'INTEGER':return 0;
    case 'NUMBER':return 0;
    case 'STRING_ARRAY':return [`${suffix}-VALUE`];
    case 'REFERENCE_ARRAY':{const target=definition.referenceTarget||definition.relationshipTarget;return target&&collectionSentinels[target]?[stale?collectionSentinels[target].staleId:collectionSentinels[target].currentId]:[];}
    case 'OBJECT_ARRAY':return [];
    case 'OBJECT':return {};
    case 'REFERENCE':{const target=definition.referenceTarget||definition.relationshipTarget;return target&&collectionSentinels[target]?(stale?collectionSentinels[target].staleId:collectionSentinels[target].currentId):`${suffix}-REFERENCE`;}
    default:return `${suffix}-VALUE`;
  }
};
for(const [collection,recordSchema] of Object.entries(schema.RECORD_SCHEMAS)){
  const {currentId,staleId,currentText,staleText}=collectionSentinels[collection];
  const fields={},staleFields={};
  for(const [name,definition] of Object.entries(recordSchema.fieldDefinitions||{})){fields[name]=fixtureValue(definition,false);staleFields[name]=fixtureValue(definition,true);}
  fields[recordSchema.idField]=currentId;staleFields[recordSchema.idField]=staleId;
  const agentField=Object.values(recordSchema.fieldDefinitions).find(def=>def.producer===schema.PRODUCER.AGENT)?.name;
  if(agentField){fields[agentField]=currentText;staleFields[agentField]=staleText;}
  const relationships=Object.fromEntries(Object.entries(recordSchema.relationships||{}).map(([name,target])=>[name,collectionSentinels[target]?.currentId||`ROUTE-${target}-CURRENT`]));
  const staleRelationships=Object.fromEntries(Object.entries(recordSchema.relationships||{}).map(([name,target])=>[name,collectionSentinels[target]?.staleId||`ROUTE-${target}-STALE`]));
  const current={id:currentId,stage:recordSchema.stage||1,fields,relationships,scope:versionScopeFor(collection),active:true,validity:'CURRENT'};
  const stale={id:staleId,stage:recordSchema.stage||1,fields:staleFields,relationships:staleRelationships,scope:staleScopeFor(collection),active:true,validity:'CURRENT'};
  state.projectData[collection]=[stale,current];
  const selected=engine.recordsForCurrentScope(state,collection);
  assert(selected.some(record=>engine.recordId(record,collection)===currentId),`${collection}: current-scope selector omitted current record.`);
  assert(!selected.some(record=>engine.recordId(record,collection)===staleId),`${collection}: current-scope selector admitted stale record.`);
}
"""
if s.count(old)!=1:raise SystemExit('route sentinel')
s=s.replace(old,new,1)
anchor="""  assert(!selected.some(record=>engine.recordId(record,collection)===staleId),`${collection}: current-scope selector admitted stale record.`);
}

const forbiddenReads="""
insert="""  assert(!selected.some(record=>engine.recordId(record,collection)===staleId),`${collection}: current-scope selector admitted stale record.`);
}

const routedIntake=prompts.intakeCoverageManifest(state);
state.stages[1].agentData.INPUT_SET_CONTENTS=JSON.stringify({schema:'closed-loop-stage01-capture/1',inputVersion:routedIntake.inputVersion,manifestSha256:routedIntake.manifestSha256,units:routedIntake.units.map((u,i)=>({sourceUnitId:u.unitId,sourceRawValueSha256:u.rawValueSha256,disposition:'retained as context',reason:'route closure fixture',extractedStatements:[{statementKey:`R${i+1}`,text:u.rawValueText||u.label||u.unitId,statementClass:'CONTEXT'}]}))});

const forbiddenReads="""
if s.count(anchor)!=1:raise SystemExit('route intake')
s=s.replace(anchor,insert,1)
s=s.replace('let operationsChecked=0,readEdgesChecked=0','let operationsChecked=0,promptRoutesChecked=0,readEdgesChecked=0',1)
oldp="""    let record;
    try{record=prompts.buildPromptRecord(stage,state,{operation,scope});}catch{record=null;}
    if(record){"""
newp="""    const record=prompts.buildPromptRecord(stage,state,{operation,scope});
    assert(record,`Stage ${stage} ${operation}: prompt record must build.`);
    promptRoutesChecked++;
    {"""
if s.count(oldp)!=1:raise SystemExit('prompt swallowing')
s=s.replace(oldp,newp,1)
s=s.replace('  operationsChecked,\n  canonicalFamilies','  operationsChecked,\n  promptRoutesChecked,\n  allOperationPromptsBuilt:promptRoutesChecked===operationsChecked,\n  canonicalFamilies',1)
p.write_text(s)
