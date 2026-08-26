import fs from 'node:fs';

function replaceOnce(text,from,to,label){
  const count=text.split(from).length-1;
  if(count!==1)throw new Error(`${label}: expected exactly one match; found ${count}.`);
  return text.replace(from,to);
}

let engine=fs.readFileSync('workflow-engine.js','utf8');
engine=replaceOnce(
  engine,
  "function testRequirementId(record){return String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'');}\nfunction runIterationId(record)",
  "function testRequirementId(record){return String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'');}\nfunction resultRequirementId(project,record){const direct=String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'').trim();if(direct)return direct;const testId=String(recordValue(record,'TEST_ID')||record.relationships?.TEST_ID||'').trim();if(!testId)return '';const test=records(project,'tests').find(item=>recordId(item,'tests')===testId);return test?testRequirementId(test):'';}\nfunction runIterationId(record)",
  'insert result-to-requirement resolver'
);
engine=replaceOnce(
  engine,
  "const results=[...deterministic,...meaning].filter(r=>String(recordValue(r,'REQ_ID')||r.relationships?.REQ_ID||'')===id);",
  "const results=[...deterministic,...meaning].filter(r=>resultRequirementId(project,r)===id);",
  'release requirement aggregation'
);
engine=replaceOnce(
  engine,
  "const results=[...recordsForCurrentScope(project,'verification'),...recordsForCurrentScope(project,'deterministicResults'),...recordsForCurrentScope(project,'meaningResults')].filter(r=>String(recordValue(r,'REQ_ID')||r.relationships?.REQ_ID||'')===reqId);",
  "const results=[...recordsForCurrentScope(project,'verification'),...recordsForCurrentScope(project,'deterministicResults'),...recordsForCurrentScope(project,'meaningResults')].filter(r=>resultRequirementId(project,r)===reqId);",
  'evidence-chain result aggregation'
);
fs.writeFileSync('workflow-engine.js',engine);

let schema=fs.readFileSync('workflow-schema.js','utf8');
const override="const RECORD_FIELD_TYPE_OVERRIDES=Object.freeze({CHAIN:Object.freeze({ARTIFACT_HASH_IDENTITY:Object.freeze({valueType:'REFERENCE_ARRAY',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),EVIDENCE_ID:Object.freeze({valueType:'STRING_ARRAY',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),MISSING_LINKS:Object.freeze({valueType:'STRING_ARRAY',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),TEST_ID:Object.freeze({valueType:'REFERENCE_ARRAY',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),TEST_RESULT_ID:Object.freeze({valueType:'STRING_ARRAY',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})})});\n";
schema=replaceOnce(schema,'function ownerFromPartition(partition,name,label){',override+'function ownerFromPartition(partition,name,label){','insert record field type overrides');
schema=replaceOnce(schema,"const producer=ownerFromPartition(ownership,name,title),type=EXPLICIT_RECORD_FIELD_TYPES[prefix]?.[name];","const producer=ownerFromPartition(ownership,name,title),type=RECORD_FIELD_TYPE_OVERRIDES[prefix]?.[name]||EXPLICIT_RECORD_FIELD_TYPES[prefix]?.[name];",'apply record field type overrides');
fs.writeFileSync('workflow-schema.js',schema);

let full=fs.readFileSync('verify-full-cycle.mjs','utf8');
full=replaceOnce(
  full,
  "const assert=(v,m)=>{if(!v)throw new Error(m)};let p=core.createBlankState('JOB-FULL-CYCLE');",
  "const assert=(v,m)=>{if(!v)throw new Error(m)};assert(schema.RECORD_SCHEMAS.evidenceChains.fieldDefinitions.TEST_ID.valueType==='REFERENCE_ARRAY','Evidence-chain TEST_ID must be plural.');assert(schema.RECORD_SCHEMAS.evidenceChains.fieldDefinitions.ARTIFACT_HASH_IDENTITY.valueType==='REFERENCE_ARRAY','Evidence-chain artifact identities must be plural.');assert(schema.RECORD_SCHEMAS.evidenceChains.fieldDefinitions.TEST_RESULT_ID.valueType==='STRING_ARRAY','Evidence-chain result identities must be plural.');assert(schema.RECORD_SCHEMAS.evidenceChains.fieldDefinitions.EVIDENCE_ID.valueType==='STRING_ARRAY','Evidence-chain evidence identities must be plural.');assert(schema.RECORD_SCHEMAS.evidenceChains.fieldDefinitions.MISSING_LINKS.valueType==='STRING_ARRAY','Evidence-chain missing links must be plural.');let p=core.createBlankState('JOB-FULL-CYCLE');",
  'evidence-chain cardinality regression'
);
full=replaceOnce(
  full,
  "data(22,{records:{deterministicResults:[recordProposal(schema,'deterministicResults',{tempKey:'det',relationships:{PRODUCT_ID:{recordId:productId},TEST_ID:{recordId:testId}},overrides:{TOOL_AND_VERSION:'Fixture verifier 1',PROCEDURE:'Execute deterministic test',EXPECTED_RESULT:'SATISFIED',ACTUAL_RESULT:'SATISFIED',DETERMINATION:'SATISFIED',EVIDENCE:'Deterministic evidence'}})]}});complete(22);",
  "data(22,{records:{deterministicResults:[recordProposal(schema,'deterministicResults',{tempKey:'det',relationships:{PRODUCT_ID:{recordId:productId},TEST_ID:{recordId:testId}},overrides:{TOOL_AND_VERSION:'Fixture verifier 1',PROCEDURE:'Execute deterministic test',EXPECTED_RESULT:'SATISFIED',ACTUAL_RESULT:'SATISFIED',DETERMINATION:'SATISFIED',EVIDENCE:'Deterministic evidence'}})]}});const deterministicResultId=rid('deterministicResults');complete(22);",
  'capture deterministic result identity'
);
full=replaceOnce(
  full,
  "const release=engine.recordReleaseDetermination(p);assert(engine.recordValue(release,'DETERMINATION')==='ACCEPTED',`Release ${engine.recordValue(release,'DETERMINATION')}`);complete(27);",
  "const release=engine.recordReleaseDetermination(p);assert(engine.recordValue(release,'DETERMINATION')==='ACCEPTED',`Release ${engine.recordValue(release,'DETERMINATION')}`);const deterministicOnly=engine.clone(p),deterministicOnlyRequirement=deterministicOnly.projectData.requirements.find(r=>engine.recordId(r,'requirements')===reqId);for(const result of deterministicOnly.projectData.meaningResults){result.active=false;result.invalidatedBy='CONTROLLED-DETERMINISTIC-ONLY';}deterministicOnlyRequirement.fields.INTENDED_VERIFICATION_METHOD='DETERMINISTIC';deterministicOnlyRequirement.INTENDED_VERIFICATION_METHOD='DETERMINISTIC';const deterministicOnlyMetrics=engine.releaseMetrics(deterministicOnly);assert(deterministicOnlyMetrics.determination==='ACCEPTED'&&deterministicOnlyMetrics.satisfied===1&&deterministicOnlyMetrics.undetermined===0,'Release aggregation ignored deterministic TEST_ID -> REQ_ID evidence.');complete(27);",
  'deterministic-only release aggregation regression'
);
full=replaceOnce(
  full,
  "data(29,{stageData:{EVIDENCE_REPOSITORY_LOCATION:'Canonical project',REPRODUCTION_INSTRUCTIONS:'Follow IDs',CONTROLLING_EVIDENCE:'Canonical evidence'}});engine.constructEvidenceChains(p);complete(29);",
  "data(29,{stageData:{EVIDENCE_REPOSITORY_LOCATION:'Canonical project',REPRODUCTION_INSTRUCTIONS:'Follow IDs',CONTROLLING_EVIDENCE:'Canonical evidence'}});engine.constructEvidenceChains(p);const evidenceChain=engine.recordsForCurrentScope(p,'evidenceChains').find(r=>String(engine.recordValue(r,'REQ_ID'))===reqId);assert(Array.isArray(engine.recordValue(evidenceChain,'TEST_ID'))&&engine.recordValue(evidenceChain,'TEST_ID').includes(testId),'Evidence chain did not preserve the plural applicable test set.');assert(Array.isArray(engine.recordValue(evidenceChain,'TEST_RESULT_ID'))&&engine.recordValue(evidenceChain,'TEST_RESULT_ID').includes(deterministicResultId),'Evidence chain ignored deterministic TEST_ID -> REQ_ID evidence.');complete(29);",
  'evidence-chain deterministic relationship regression'
);
fs.writeFileSync('verify-full-cycle.mjs',full);

console.log(JSON.stringify({patched:['workflow-engine.js','workflow-schema.js','verify-full-cycle.mjs'],semanticFixes:['result requirement traversal','evidence-chain plural cardinality']},null,2));
