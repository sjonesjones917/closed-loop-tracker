import fs from 'node:fs';
import assert from 'node:assert/strict';

// Repository-only oracle: enumerate the required fields from Section 37,
// independently of workbook.js and the schema that is being checked.
const specification=fs.readFileSync('specification/closed-loop-reliability-controlling-implementation-specification.txt','utf8');
const section=specification.split('37. Exact 30-stage workflow and prompt obligations\n')[1].split('\n38. Canonical record families')[0];
const expected=new Map([...section.matchAll(/Stage (\d+) —[^\n]*\n(.*?)(?=\nStage \d+ —|$)/gs)].map(match=>[
  Number(match[1]),match[2].match(/\nFields:\n([^\n]+)/)[1].replace(/\.$/,'').split(',').map(name=>name.trim())
]));
assert.equal(expected.size,30,'The specification oracle must cover every stage.');

function typeMatches(value,definition){
  if(value===null)return definition.nullable===true;
  switch(definition.valueType){
    case 'STRING':case 'REFERENCE':return typeof value==='string';
    case 'BOOLEAN':return typeof value==='boolean';
    case 'INTEGER':return Number.isSafeInteger(value);
    case 'NUMBER':return typeof value==='number'&&Number.isFinite(value);
    case 'STRING_ARRAY':case 'REFERENCE_ARRAY':return Array.isArray(value)&&value.every(item=>typeof item==='string');
    case 'OBJECT_ARRAY':return Array.isArray(value)&&value.every(item=>item!==null&&typeof item==='object'&&!Array.isArray(item));
    case 'OBJECT':return value!==null&&typeof value==='object'&&!Array.isArray(value);
    default:throw new Error('Unexamined stage value type: '+definition.valueType);
  }
}

export function verifyStageFieldInventory(schema){
  for(const [stage,names] of expected)for(const name of names){
    assert(schema.STAGE_FIELDS[stage]?.[name],`Section 37 Stage ${stage} field ${name} is absent from the authoritative contract.`);
    assert(schema.FIELD_REGISTRY[`STAGE.${stage}.${name}`],`Stage ${stage} field ${name} is absent from the shared registry.`);
  }
}

export function verifyCompletedStageProjection(project,stage,schema){
  const fields=schema.STAGE_FIELDS[stage],projection=project.stages[stage].derivedData,checked=[];
  for(const name of expected.get(stage)){
    const definition=fields[name];
    if(definition.producer!=='APPLICATION')continue;
    assert(Object.hasOwn(projection,name),`Completed Stage ${stage} has no application-derived ${name}.`);
    assert(typeMatches(projection[name],definition),`Completed Stage ${stage} ${name} violates ${definition.valueType}: ${JSON.stringify(projection[name])}`);
    if(definition.enumValues.length)assert(definition.enumValues.includes(projection[name]),`Stage ${stage} ${name} is outside its closed enum.`);
    checked.push(name);
  }
  if(stage===10)assert.equal(projection.ALL_FROZEN_COMPONENT_BYTES_HASHED,true);
  if(stage===25)assert.equal(projection.DELIVERY_CANDIDATE_SET_ID,project.job.CURRENT_DELIVERY_CANDIDATE_SET_ID);
  if(stage===28){
    assert.match(projection.HASH_REVIEW_ID,/^HASH_REVIEW-[A-F0-9]{64}$/);
    assert.equal(projection.HASH_REVIEW_ID,project.job.CURRENT_HASH_REVIEW_ID);
    assert.equal(projection.HASH_ALGORITHM,'SHA-256');
    assert.equal(projection.TOTAL_EXACT_HASH_MATCHES,projection.TOTAL_ARTIFACTS_REQUIRED_FOR_RELEASE);
    assert.equal(projection.TOTAL_HASH_MISMATCHES,0);
    assert.equal(projection.TOTAL_UNKNOWN_HASH_COMPARISONS,0);
  }
  if(stage===29){
    assert.equal(projection.HASH_REVIEW_ID,project.job.CURRENT_HASH_REVIEW_ID);
    assert.equal(projection.MANDATORY_EVIDENCE_CHAIN_COVERAGE,1);
    assert.equal(projection.MANDATORY_REQUIREMENT_EVIDENCE_CHAIN_RECORDS.length,projection.TOTAL_MANDATORY_REQUIREMENTS);
  }
  return {caseId:`completed-stage-${String(stage).padStart(2,'0')}-projection`,stage,result:'PASS',checkedFields:checked};
}
