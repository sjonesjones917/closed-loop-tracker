import fs from 'node:fs';
const path='workflow-engine.js';
let source=fs.readFileSync(path,'utf8');
const before="const VERSION_SCOPE_KEY_BY_STAGE=Object.freeze({2:'sourceSetVersion',4:'requirementsVersion',5:'requirementsVersion',6:'testSuiteVersion',8:'instructionVersion'});\nfunction stampCurrentVersionMembership(project,stage,version){const key=VERSION_SCOPE_KEY_BY_STAGE[stage];if(!key||!version)return;const collections=stage===5?[...new Set(['requirements',...versionCollections(stage)])]:versionCollections(stage);for(const collection of collections)for(const record of records(project,collection)){record.scope={...(record.scope||{}),[key]:version};refreshRecordHashes(record,collection);}}";
const after="const VERSION_SCOPE_KEY_BY_STAGE=Object.freeze({2:'sourceSetVersion',3:'researchVersion',4:'requirementsVersion',5:'requirementsVersion',6:'testSuiteVersion',8:'instructionVersion'});\nconst VERSION_MEMBERSHIP_COLLECTIONS_BY_STAGE=Object.freeze({\n  3:Object.freeze(['research','candidateRequirements']),\n  4:Object.freeze(['requirements','propositions']),\n  5:Object.freeze(['requirements','requirementResolutions','applicabilityRecords']),\n  6:Object.freeze(['tests','proofExpressions']),\n  8:Object.freeze(['instructions','instructionTraces'])\n});\nfunction stampCurrentVersionMembership(project,stage,version){const key=VERSION_SCOPE_KEY_BY_STAGE[stage];if(!key||!version)return;const declared=VERSION_MEMBERSHIP_COLLECTIONS_BY_STAGE[stage]||versionCollections(stage),collections=[...new Set([...versionCollections(stage),...declared])].filter(collection=>schema.RECORD_SCHEMAS[collection]);for(const collection of collections)for(const record of records(project,collection)){record.scope={...(record.scope||{}),[key]:version};refreshRecordHashes(record,collection);}}";
if(!source.includes(before))throw new Error('Expected version membership implementation not found.');
source=source.replace(before,after);
fs.writeFileSync(path,source);

const testPath='verify-stage-operation-scope-matrix.mjs';
let test=fs.readFileSync(testPath,'utf8');
const marker="console.log(JSON.stringify({stageOperationScopeMatrix:'PASS',stages:30}));";
if(!test.includes(marker))throw new Error('Scope matrix test marker not found.');
const regression="const engineSource=fs.readFileSync('workflow-engine.js','utf8');for(const token of [\"3:'researchVersion'\",\"4:'requirementsVersion'\",\"['requirements','propositions']\",\"['research','candidateRequirements']\",\"['tests','proofExpressions']\"])assert(engineSource.includes(token),`version membership closure missing ${token}`);";
test=test.replace(marker,regression+marker);
fs.writeFileSync(testPath,test);
