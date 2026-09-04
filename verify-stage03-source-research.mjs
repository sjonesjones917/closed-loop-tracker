import fs from 'node:fs';
import vm from 'node:vm';

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const schema=globalThis.closedLoopWorkflowSchema;
const complete=schema.operationContract(3,'COMPLETE');
const challenge=schema.operationContract(3,'SEMANTIC_CHALLENGE');
const reconcile=schema.operationContract(3,'RECONCILE_RESEARCH');

assert(complete.agentWritableCollections.includes('research')&&complete.agentWritableCollections.includes('candidateRequirements'),'Stage 03 COMPLETE lost its canonical research outputs.');
assert(challenge.agentWritableCollections.includes('semanticChallenges'),'Stage 03 SEMANTIC_CHALLENGE does not write the durable semanticChallenges family.');
assert(!challenge.agentWritableCollections.includes('research')&&!challenge.agentWritableCollections.includes('candidateRequirements'),'Stage 03 independent omission challenge can overwrite the author extraction instead of remaining an independent challenge record.');
assert(challenge.readCollections.includes('sources'),'Stage 03 independent omission challenge does not receive the source set.');
assert(!challenge.readCollections.includes('research')&&!challenge.readCollections.includes('candidateRequirements'),'Stage 03 independent omission challenge receives the first extraction before its own extraction is complete.');
assert(reconcile.agentWritableCollections.includes('semanticReviews'),'Stage 03 RECONCILE_RESEARCH does not create the durable reconciliation review record.');
assert(reconcile.readCollections.includes('research')&&reconcile.readCollections.includes('candidateRequirements')&&reconcile.readCollections.includes('semanticChallenges'),'Stage 03 reconciliation does not receive both the author extraction and completed independent challenge.');

console.log(JSON.stringify({stage03SourceResearchOperationClosure:true}));
