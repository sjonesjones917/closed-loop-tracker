import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion,hash=globalThis.closedLoopHash;
const assert=(value,message)=>{if(!value)throw new Error(message);};
function activatePrompt(project,stage,operation='COMPLETE'){
  const context=engine.registerFreshContext(project,{stage,externalContextIdentifier:`STAGE01-CLOSURE-${stage}-${operation}`,operatorLabel:'STAGE01_CLOSURE_VERIFIER',purpose:'GENERAL'}),contextId=engine.recordId(context,'freshContexts'),scope=prompts.scopeFor(stage,{...project,revision:Number(project.revision||0)+1},{contextId}),prepared=engine.prepareCurrentOperationReservation(project,{stage,operation,contextId,scope,owningTabInstance:'STAGE01_CLOSURE_VERIFIER'}),preview=engine.clone(project);
  preview.revision=prepared.expectedRevision;
  const record={...prompts.buildPromptRecord(stage,preview,{operation,scope:prepared.scope,operationReservation:prepared}),generatedAt:new Date().toISOString()};
  engine.registerGeneratedPrompt(project,record);engine.reserveOperation(project,{preparedReservation:prepared,promptId:record.instructionId});project.revision=prepared.expectedRevision;engine.recalculate(project);return record;
}

const p=core.createBlankState('JOB-STAGE01-CLOSURE');
Object.assign(p.job,{JOB_TITLE:'Intake closure',JOB_OWNER:'Operator',EXACT_USER_OBJECTIVE_VERBATIM:'Build the exact requested product.',SUPPLIED_MATERIALS_INVENTORY:'intent.txt',REQUIRED_OUTPUT_FORMAT:'Exact requested artifacts',PROHIBITED_ACTIONS:'Do not discard supplied intent.',EXPLICIT_USER_REQUIREMENTS:'Capture every supplied requirement exactly.',CURRENT_INPUT_VERSION:'INPUT-v001'});
engine.ensureShape(p);
engine.registerArtifactBytes(p,{stage:1,artifactId:'ARTIFACT-INTENT-001',filename:'intent.txt',mediaType:'text/plain',byteSize:42,sha256:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',role:'HUMAN_INPUT'});

const manifest=engine.intakeCoverageManifest(p);
assert(manifest.unitCount===manifest.units.length&&manifest.unitCount>0,'Stage 01 intake manifest is not a closed controlled-unit set.');
assert(JSON.stringify(manifest.units).includes('ARTIFACT-INTENT-001'),'Stage 01 intake manifest does not bind the supplied artifact identity.');
const prompt=activatePrompt(p,1);
assert(prompt.contextManifest.intakeCoverageManifest.manifestSha256===manifest.manifestSha256,'Stage 01 prompt is not bound to the current application intake manifest.');
for(const unit of manifest.units)assert(prompt.prompt.includes(unit.unitId),`Prompt 01 omitted controlled input unit ${unit.unitId}.`);
assert(prompt.prompt.includes('INPUT_SET_CONTENTS must be a JSON STRING'),'Prompt 01 does not command the current closed Stage 01 accounting response.');
assert(prompt.prompt.includes('first semantic reader')||prompt.prompt.includes('FIRST SEMANTIC READER'),'Prompt 01 does not identify Stage 01 as the first semantic reader.');
assert(!prompt.prompt.includes('EXECUTABLE_KIND = CUSTOM_PIPELINE'),'Prompt still contains obsolete CUSTOM_PIPELINE instruction.');

const capture={schema:'closed-loop-stage01-capture/1',inputVersion:manifest.inputVersion,manifestSha256:manifest.manifestSha256,units:manifest.units.map((unit,index)=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:'retained as context',reason:'Preserved as current human-authority input.',extractedStatements:[{statementKey:`statement-${index+1}`,text:unit.rawValueText||unit.label||unit.unitId,statementClass:'CONTEXT'}]}))};
assert(engine.evaluateIntakeAccounting(p,{capture:JSON.stringify(capture)}).complete,'Complete Stage 01 intake accounting did not close.');
const incomplete=structuredClone(capture);incomplete.units.pop();
assert(!engine.evaluateIntakeAccounting(p,{capture:JSON.stringify(incomplete)}).complete,'Stage 01 accepted incomplete controlled-input accounting.');

const evidence=[{temporaryKey:'evidence-1',kind:'INTAKE',description:'Stage 01 intake evidence',authorityType:'AGENT_CLAIM',location:'response',content:'Complete controlled-input accounting.'}];
const envelope=captureValue=>({schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage:1,operation:prompt.operation,packageId:prompt.operationBinding.packageId||null,operationReservationId:prompt.operationBinding.operationReservationId,challengeNonce:prompt.operationBinding.challengeNonce,targetSlot:prompt.operationBinding.targetSlot,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},scope:prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{EXACT_DELIVERABLE_REQUESTED:'Exact requested product',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(captureValue)},records:{},evidence,unresolved:[],warnings:[],attachments:[]});
let invalid=envelope(incomplete);let validation=ingestion.validateEnvelope(p,invalid,{stage:1,promptRecord:prompt,rawSha256:hash.sha256Value(invalid),files:[]});
assert(validation.issues.some(issue=>issue.code==='INCOMPLETE_INTAKE_ACCOUNTING'),'Stage 01 ingestion accepted incomplete intake accounting.');
let valid=envelope(capture);validation=ingestion.validateEnvelope(p,valid,{stage:1,promptRecord:prompt,rawSha256:hash.sha256Value(valid),files:[]});
assert(!validation.issues.some(issue=>issue.code==='INCOMPLETE_INTAKE_ACCOUNTING'),`Stage 01 ingestion rejected repaired intake accounting: ${JSON.stringify(validation.issues)}`);

console.log(JSON.stringify({stage01IntakeClosure:true,artifactIdentityBound:true,currentManifestBound:true,incompleteAccountingRejected:true}));
