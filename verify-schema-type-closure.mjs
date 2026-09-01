import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['hash.js','workbook.js','workflow-schema.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const schema=globalThis.closedLoopWorkflowSchema;
for(const [collection,definition] of Object.entries(schema.RECORD_SCHEMAS)){
  const currentScope=definition.fieldDefinitions?.CURRENT_SCOPE;
  if(currentScope)assert.equal(currentScope.valueType,'OBJECT',`${collection}.CURRENT_SCOPE must be OBJECT.`);
}
assert.equal(schema.RECORD_SCHEMAS.propositions.fieldDefinitions.CURRENT_SCOPE.valueType,'OBJECT');
assert.equal(schema.RECORD_SCHEMAS.propositionEquivalenceReviews.fieldDefinitions.CURRENT_SCOPE.valueType,'OBJECT');
assert.equal(schema.RECORD_SCHEMAS.backupRecords.fieldDefinitions.ARTIFACT_IDS.valueType,'REFERENCE_ARRAY');
assert.equal(schema.RECORD_SCHEMAS.backupRecords.relationships.ARTIFACT_IDS,'artifacts');

console.log(JSON.stringify({schemaTypeClosure:'PASS',allCurrentScopeFieldsObject:true,backupArtifactIdsReferenceArray:true,explicitRelationshipTypesTakePrecedence:true}));
