import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['hash.js','workbook.js','workflow-schema.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const h=globalThis.closedLoopHash,core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema;
assert.equal(core.STAGE_COUNT,30);
assert.equal(core.STAGES.length,30);
assert.equal(schema.version,'closed-loop-workflow-schema/3');
assert.equal(h.canonicalizationVersion,'closed-loop-canonical-json/1');
assert.equal(h.hashAlgorithm,'SHA-256');

// closed-loop-canonical-json/1 edge cases and deterministic hash identity
assert.equal(h.stableStringify({b:2,a:1}),'{"a":1,"b":2}');
const bmp='\uE000',astral='\u{10000}';
assert.equal(h.stableStringify({[astral]:2,[bmp]:1}),`{"${bmp}":1,"${astral}":2}`,'keys must use unsigned Unicode scalar ordering, not UTF-16 or locale order');
for(const [label,make] of [
  ['negative zero',()=>({value:-0})],
  ['sparse array',()=>{const value=[];value.length=2;value[1]=1;return value;}],
  ['unpaired high surrogate',()=>({value:'\uD800'})],
  ['unpaired low surrogate',()=>({value:'\uDC00'})],
  ['unpaired key',()=>({['\uD800']:1})]
])assert.throws(()=>h.stableStringify(make()),TypeError,label);
assert.throws(()=>h.sha256Text('\uD800'),TypeError,'raw text hashing must not silently replace an unpaired surrogate');
assert.notEqual(h.sha256Text('a\r\nb'),h.sha256Text('a\nb'),'line endings must not be normalized');
assert.notEqual(h.sha256Text('\u00e9'),h.sha256Text('e\u0301'),'Unicode normalization must not be implicit');
const semanticDigest=h.digestIdentityForValue({b:2,a:1});
assert.deepEqual(semanticDigest,{hashAlgorithm:'SHA-256',digest:h.sha256Value({a:1,b:2}),canonicalByteLength:13,canonicalizationVersion:'closed-loop-canonical-json/1'});
assert.equal(h.selfDigestValue({a:1,digest:'first'},{digestField:'digest'}),h.selfDigestValue({digest:'second',a:1},{digestField:'digest'}),'self digest must omit its own field');
assert.throws(()=>h.selfDigestValue({a:1},{digestField:'digest',dependentDigestFields:['digest']}),TypeError);
assert.deepEqual(h.hashProfiles.contentRecord.includedPointers,['/fields/*','/relationships','/evidenceRefs']);
assert.deepEqual(h.hashProfiles.completeRecord.excludedRootMembers,['recordSha256','sha256']);

// Every Section 67 stage addition is statically owned, typed, and present in the exact 30-stage workbook.
for(let stage=1;stage<=30;stage++){
  const additions=core.CONTROLLING_COMPLETION_STAGE_FIELD_DEFINITIONS[stage];
  assert(additions&&Object.keys(additions).length>0,`Stage ${stage} has no Section 67 field additions.`);
  const workbookStage=core.STAGES[stage-1],partitions=core.STAGE_OWNERSHIP[stage];
  const union=[...partitions.human,...partitions.humanDecision,...partitions.agent,...partitions.application];
  assert.equal(union.length,workbookStage.fields.length,`Stage ${stage} ownership union has the wrong size.`);
  assert.equal(new Set(union).size,union.length,`Stage ${stage} ownership overlaps.`);
  for(const [name,definition] of Object.entries(additions)){
    assert(workbookStage.fields.includes(name),`Stage ${stage} omits ${name}.`);
    const owners=Object.entries(partitions).filter(([,names])=>names.includes(name));
    assert.equal(owners.length,1,`Stage ${stage} ${name} must have exactly one producer.`);
    assert.equal(owners[0][0],definition.owner,`Stage ${stage} ${name} producer drifted.`);
    const field=schema.STAGE_FIELDS[stage][name];
    assert(field,`Schema omits Stage ${stage} ${name}.`);
    assert.equal(typeof field.valueType,'string',`Stage ${stage} ${name} lacks closed type metadata.`);
    assert.equal(field.producer,{human:'HUMAN',humanDecision:'HUMAN_DECISION',agent:'AGENT',application:'APPLICATION'}[definition.owner]);
  }
}
for(const [stage,name] of [[1,'SEMANTIC_CHALLENGE_REQUIRED'],[4,'PROPOSITION_RECORDS'],[6,'PROOF_OBLIGATION_SET_ID'],[18,'UNKNOWN_ENTAILMENT_COUNT'],[27,'PRODUCT_RELEASE_ELIGIBILITY'],[28,'DELIVERY_AUTHORIZATION_EFFECTIVE'],[29,'JUSTIFICATION_CYCLE_COUNT'],[30,'DELIVERY_RECORD_HASH']])assert(core.STAGES[stage-1].fields.includes(name));
assert.equal(core.STAGES[5].humanChecklist.length,0,'Application proof gates must not become a routine human checklist.');
assert(core.STAGES[9].humanChecklist.length===1&&core.STAGES[19].humanChecklist.length===1&&core.STAGES[27].humanChecklist.length===1,'Only genuine candidate, baseline, and delivery decisions should be static human checklists.');

// All narrow amendment and independently authored review families, and every field in every family, have exhaustive disjoint ownership.
const amendmentFamilies=['propositions','propositionEquivalenceReviews','applicabilityRecords','proofExpressions','proofObligations','semanticCoverageReviews','sourceSearchAdequacyReviews','requirementCompilationChallengeReviews','observationRecords','entailmentReviews','environmentDependencies','operationReservations','deliveryRecords','deploymentManifests','disclosureAuthorizations'];
for(const family of amendmentFamilies){
  const record=schema.RECORD_SCHEMAS[family];assert(record,`Missing ${family}.`);
  const partitions=record.ownership,union=[...partitions.human,...partitions.humanDecision,...partitions.agent,...partitions.application];
  assert.equal(union.length,record.fields.length,`${family} ownership union size mismatch.`);
  assert.equal(new Set(union).size,union.length,`${family} ownership overlaps.`);
  for(const name of record.fields){
    const owners=Object.values(partitions).filter(names=>names.includes(name));
    assert.equal(owners.length,1,`${family}.${name} does not have exactly one producer.`);
    assert(record.fieldDefinitions[name],`${family}.${name} lacks field metadata.`);
    assert.equal(typeof record.fieldDefinitions[name].valueType,'string',`${family}.${name} lacks a closed value type.`);
    assert.equal(schema.RECORD_OWNERSHIP[family],record.ownership,`${family} exported ownership is stale.`);
  }
}
for(const [family,record] of Object.entries(schema.RECORD_SCHEMAS)){
  const partitions=record.ownership,union=[...partitions.human,...partitions.humanDecision,...partitions.agent,...partitions.application];
  assert.equal(union.length,record.fields.length,`${family} full-schema ownership union size mismatch.`);
  assert.equal(new Set(union).size,union.length,`${family} full-schema ownership overlaps.`);
  for(const name of record.fields)assert.equal(Object.values(partitions).filter(names=>names.includes(name)).length,1,`${family}.${name} does not have exactly one producer in the full target model.`);
  assert.equal(schema.RECORD_OWNERSHIP[family],record.ownership,`${family} RECORD_OWNERSHIP is stale after amendment fields.`);
}
for(const [family,field,producer] of [
  ['environmentDependencies','TARGET_PROPOSITION_IDS','APPLICATION'],
  ['proofObligations','PROOF_OBLIGATION_ID','APPLICATION'],
  ['observationRecords','EXTERNAL_OR_AGENT_OBSERVED_VALUE','AGENT'],
  ['observationRecords','HUMAN_OBSERVED_VALUE','HUMAN'],
  ['observationRecords','APPLICATION_OBSERVED_VALUE','APPLICATION'],
  ['deliveryRecords','DELIVERY_STATE','APPLICATION'],
  ['disclosureAuthorizations','DISCLOSURE_DECISION','HUMAN_DECISION'],
  ['disclosureAuthorizations','ARTIFACT_IDS','APPLICATION']
])assert.equal(schema.RECORD_SCHEMAS[family].fieldDefinitions[field].producer,producer,`${family}.${field} producer mismatch.`);
for(const family of ['propositions','propositionEquivalenceReviews','applicabilityRecords','proofObligations','entailmentReviews'])for(const dimension of ['TRUTH_VALUE','EPISTEMIC_BASIS','CURRENT_SCOPE_STATUS','FRESHNESS_STATUS','CONTRADICTION_STATUS'])assert(schema.RECORD_SCHEMAS[family].fields.includes(dimension),`${family} omits ${dimension}.`);
for(const field of ['TEST_PROPOSITION_TEXT','TARGET_PROPOSITION_IDS','TESTED_SCOPE','POSITIVE_RESULT_MEANING','NEGATIVE_RESULT_MEANING','SEMANTIC_COVERAGE_DISPOSITION','SEMANTIC_REVIEW_IDS','TEST_ROLE','RELEASE_BEARING','EXPECTED_VARIANCE_CONTRACT'])assert(schema.RECORD_SCHEMAS.tests.fields.includes(field),`tests omits ${field}.`);
assert(schema.RECORD_SCHEMAS.proofObligations.fields.includes('ACTIVATION_PROPOSITION_ID'));
assert.deepEqual(schema.RECORD_SCHEMAS.observationRecords.requiredByOrigin.HUMAN_OBSERVATION,['HUMAN_OBSERVED_VALUE','HUMAN_OBSERVED_LOCATION']);
assert.deepEqual(schema.RECORD_SCHEMAS.disclosureAuthorizations.required,['DISCLOSURE_DECISION','RECIPIENT_OR_PROVIDER','RECIPIENT_SUITABILITY_DECISION','PURPOSE_AND_LIMITS','DECISION_REASON']);
assert.equal(schema.RECORD_SCHEMAS.disclosureAuthorizations.commitPolicy,schema.COLLECTION_POLICIES.APPEND_SCOPED);

// Semantic suboperations exist, while operation-level write/read isolation prevents cross-run leakage.
assert.deepEqual(schema.STAGE_CONTRACTS[1].operations,['COMPLETE','SEMANTIC_CHALLENGE','RECONCILE_INTAKE']);
assert(schema.STAGE_CONTRACTS[4].operations.includes('DISPOSITION_CHALLENGE'));
assert(schema.STAGE_CONTRACTS[4].operations.includes('ATOMICITY_CHALLENGE'));
assert(schema.operationContract(1,'SEMANTIC_CHALLENGE'));
assert(!schema.operationContract(17,'FREEZE').agentWritableCollections.includes('observationRecords'));
assert(!schema.operationContract(17,'EXECUTE_RUN').readCollections.includes('observationRecords'));
assert(schema.operationContract(17,'VERIFY').agentWritableCollections.includes('observationRecords'));
assert(!schema.operationContract(19,'CONFIRM_FREEZE').agentWritableCollections.includes('observationRecords'));
assert(!schema.operationContract(19,'EXECUTE_RUN').readCollections.includes('entailmentReviews'));
assert(schema.operationContract(19,'VERIFY').agentWritableCollections.includes('entailmentReviews'));

// Closed acyclic proof-expression language and exact three-valued truth tables.
const leaf=id=>({op:'LEAF',testId:id});
assert(schema.validateProofExpression({op:'ALL_OF',children:[leaf('A'),leaf('B')]}).valid);
assert.equal(schema.evaluateProofExpression({op:'ALL_OF',children:[leaf('A'),leaf('B')]},({id})=>({A:'TRUE',B:'UNKNOWN'}[id])).truthValue,'UNKNOWN');
assert.equal(schema.evaluateProofExpression({op:'ALL_OF',children:[leaf('A'),leaf('B')]},({id})=>({A:'TRUE',B:'FALSE'}[id])).truthValue,'FALSE');
assert.equal(schema.evaluateProofExpression({op:'ANY_OF',children:[leaf('A'),leaf('B')]},({id})=>({A:'FALSE',B:'UNKNOWN'}[id])).truthValue,'UNKNOWN');
assert.equal(schema.evaluateProofExpression({op:'ANY_OF',children:[leaf('A'),leaf('B')]},({id})=>({A:'FALSE',B:'FALSE'}[id])).truthValue,'FALSE');
assert.equal(schema.evaluateProofExpression({op:'AT_LEAST_K',k:2,children:[leaf('A'),leaf('B'),leaf('C')]},({id})=>({A:'TRUE',B:'UNKNOWN',C:'FALSE'}[id])).truthValue,'UNKNOWN');
assert.equal(schema.evaluateProofExpression({op:'AT_LEAST_K',k:2,children:[leaf('A'),leaf('B'),leaf('C')]},({id})=>({A:'TRUE',B:'FALSE',C:'FALSE'}[id])).truthValue,'FALSE');
assert.equal(schema.evaluateProofExpression({op:'AT_LEAST_K',k:2,children:[leaf('A'),leaf('B'),leaf('C')]},({id})=>({A:'TRUE',B:'TRUE',C:'UNKNOWN'}[id])).truthValue,'TRUE');
assert(!schema.validateProofExpression({op:'ALL_OF',children:[]}).valid);
assert(!schema.validateProofExpression({op:'LEAF',testId:'A',artifactId:'B'}).valid);
assert(!schema.validateProofExpression({op:'LEAF',testId:'A',evil:true}).valid);
const cyclic={op:'ALL_OF',children:[]};cyclic.children.push(cyclic);assert(!schema.validateProofExpression(cyclic).valid);
assert.deepEqual(schema.normalizeProofExpression({type:'LEAF',testId:'A'}),{version:'closed-loop-proof-expression/1',op:'LEAF',testId:'A'});

// Stage 28 can establish identity independent of array order, but never final delivery authorization.
const digestA='a'.repeat(64),digestB='b'.repeat(64);
const audited=[{artifactId:'ART-1',authorizedFilename:'a.txt',name:'a.txt',sha256:digestA,size:3},{artifactId:'ART-2',authorizedFilename:'b.txt',name:'b.txt',sha256:digestB,size:4}];
const delivery=[{...audited[1]},{...audited[0]}];
const identity=core.compareArtifactSets(audited,delivery,'ACCEPTED');
assert.equal(identity.identityVerified,true);
assert.equal(identity.deliveryAuthorizationEffective,false);
assert.equal(identity.authorization,'NOT AUTHORIZED');
const duplicate=core.compareArtifactSets(audited,[delivery[0],delivery[0]],'ACCEPTED');assert.equal(duplicate.identityVerified,false);

// New projects and migrated /3 projects carry every amendment family in the one canonical store.
const blank=core.createBlankState('JOB-SCHEMA-HASH');
assert.equal(blank.job.DESIRED_SOURCE_COUNT,null);
for(const family of amendmentFamilies)assert(Array.isArray(blank.projectData[family]),`Blank project omits ${family}.`);
const migrated=schema.migrateProjectToCurrent({...blank,projectData:{}});
for(const family of amendmentFamilies)assert(Array.isArray(migrated.projectData[family]),`Migration omits ${family}.`);
const first=await core.immutableRevision([],{b:2,a:1}),retry=await core.immutableRevision([first.record],{a:1,b:2});
assert.equal(first.record.sha256,semanticDigest.digest);assert.equal(retry.changed,false);

const workbookSource=fs.readFileSync('workbook.js','utf8');
assert(!/function\s+rightRotate|0x428a2f98/.test(workbookSource),'workbook.js must delegate to the one hash authority.');

console.log(JSON.stringify({stageCount:30,section67Stages:30,amendmentFamilies:amendmentFamilies.length,ownershipClosure:true,canonicalEdgeCases:true,proofTruthTables:true,operationIsolation:true,stage28IdentityOnly:true,disclosureDecisionContract:true,migrationDefaults:true}));
