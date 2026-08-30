import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion;
if(!core||!schema||!engine||!prompts||!ingestion)throw new Error('Runtime modules failed to load.');

const inventory=JSON.stringify([{type:'FILE',exactNameOrReference:'intent.pdf'}]);
const makeProject=id=>{const p=core.createBlankState(id);Object.assign(p.job,{JOB_ID:id,JOB_TITLE:'Stage 04 intent reuse regression',EXACT_USER_OBJECTIVE_VERBATIM:'Build the requested product from the supplied intent.',SUPPLIED_MATERIALS_INVENTORY:inventory,CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001'});engine.ensureShape(p);engine.recalculate(p);return p;};
const savePrompt=(p,stage)=>{const record={...prompts.buildPromptRecord(stage,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(record);return record;};
const envelope=(p,prompt,inputSetContents)=>({schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage:1,operation:prompt.operation,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},scope:prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{EXACT_DELIVERABLE_REQUESTED:'The product defined by the supplied intent.',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:inputSetContents},records:{},evidence:[{temporaryKey:'evidence-1',kind:'HUMAN_INPUT',description:'Human input supporting the Stage 01 definition',authorityType:'HUMAN',location:'AUTHORIZED USER JOB INPUT',content:'The supplied intent and its project requirements were inspected.'}],unresolved:[],warnings:[],attachments:[]});

assert.equal(schema.assessStage1MaterialCapture({SUPPLIED_MATERIALS_INVENTORY:''},{INPUT_SET_CONTENTS:''}).sufficient,true);
assert.equal(schema.assessStage1MaterialCapture({SUPPLIED_MATERIALS_INVENTORY:inventory},{INPUT_SET_CONTENTS:'intent.pdf'}).sufficient,false);
const semanticCapture='intent.pdf states that the product must retain every project requirement supplied by the user and must never request the same project input again.';
assert.equal(schema.assessStage1MaterialCapture({SUPPLIED_MATERIALS_INVENTORY:inventory},{INPUT_SET_CONTENTS:semanticCapture}).sufficient,true);

const bad=makeProject('JOB-STAGE04-BAD-CAPTURE'),badPrompt=savePrompt(bad,1),badPrepared=ingestion.prepare(bad,{stage:1,text:JSON.stringify(envelope(bad,badPrompt,'intent.pdf')),promptRecord:badPrompt});
assert.equal(badPrepared.validation.valid,false);
assert.ok(badPrepared.validation.issues.some(item=>item.code==='INCOMPLETE_STAGE01_MATERIAL_CAPTURE'));
assert.equal(badPrepared.project.projectData.acceptedChanges.length,0);
assert.equal(badPrepared.project.job.INPUT_SET_CONTENTS,'');

const good=makeProject('JOB-STAGE04-GOOD-CAPTURE'),goodPrompt=savePrompt(good,1),goodPrepared=ingestion.prepare(good,{stage:1,text:JSON.stringify(envelope(good,goodPrompt,semanticCapture)),promptRecord:goodPrompt});
assert.equal(goodPrepared.validation.valid,true,JSON.stringify(goodPrepared.validation.issues));
const committed=ingestion.commit(goodPrepared.project,goodPrepared.proposal.proposalId,{operator:'REGRESSION_TEST',reviewNote:'Semantic capture accepted.'}).project;
assert.equal(committed.job.INPUT_SET_CONTENTS,semanticCapture);
const stage4Prompt=prompts.buildPromptRecord(4,committed).prompt;
assert.match(stage4Prompt,/ACCEPTED STAGE 01 JOB DEFINITION — CANONICAL INPUT, DO NOT ASK THE HUMAN TO RESEND IT/i);
assert.match(stage4Prompt,/must never request the same project input again/i);
assert.match(stage4Prompt,/Do not ask the human to attach, resend, retype, or summarize the original intent file/i);
const handoff=engine.executionHandoff(committed,{stage:4,operation:'COMPLETE'});
assert.deepEqual(handoff.send,[]);
assert.deepEqual(handoff.conversationMaterials,[]);

const legacy=makeProject('JOB-STAGE04-LEGACY-CAPTURE');legacy.job.INPUT_SET_CONTENTS='intent.pdf';legacy.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'Legacy product',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:'intent.pdf'};legacy.stages[1].acceptedData={...legacy.stages[1].agentData};legacy.projectData.acceptedChanges.push({changeId:'CHANGE-STAGE01-LEGACY',stage:1,status:'COMMITTED',responseType:'DATA_PROPOSAL'});legacy.stages[1].acceptedDataChangeIds=['CHANGE-STAGE01-LEGACY'];legacy.projectData.stageConfirmations.push({confirmationId:'CONFIRM-STAGE01-LEGACY',stage:1,confirmed:true,acceptedChangeId:'CHANGE-STAGE01-LEGACY',inputVersion:'INPUT-v001'});legacy.activeStage=4;engine.recalculate(legacy);
assert.notEqual(legacy.stages[1].status,'COMPLETE');
assert.equal(legacy.activeStage,1);
assert.ok(legacy.stages[1].gate.reasons.some(reason=>/filename\/reference-only capture cannot feed Stage 04/i.test(reason)));
const correction=engine.operationalNextAction(legacy,1);
assert.match(correction,/Continue the original Stage 01 conversation/i);
assert.match(correction,/do not attach the material to the application again/i);
assert.match(correction,/do not ask the human to retype or summarize it/i);

console.log(JSON.stringify({stage1ReferenceOnlyRejected:true,canonicalMutationOnRejectedCapture:false,stage4PromptReusesSemanticCapture:true,stage4RequiresIntentReattachment:false,legacyProjectRoutedToStage1Correction:true,promptEngineVersion:prompts.version,responseIngestionVersion:ingestion.version},null,2));
