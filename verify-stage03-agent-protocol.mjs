import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js']) vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const prompts=globalThis.closedLoopPromptEngine;
const ingestion=globalThis.closedLoopResponseIngestion;
const assert=(v,m)=>{if(!v)throw new Error(m);};

function prepareStage1(p){
  const intake=prompts.buildPromptRecord(1,p).contextManifest.intakeCoverageManifest;
  p.stages[1].agentData.INPUT_SET_CONTENTS=JSON.stringify({schema:'closed-loop-stage01-capture/2',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,pass1Completed:true,pass2OmissionChallenge:{completed:true,checkedCategories:['QUALIFIERS','EXCEPTIONS','DEPENDENCIES','NEGATIVE_REQUIREMENTS','DO_NOT_CHANGE','VISUAL_CONSTRAINTS','TEMPORAL_CONSTRAINTS','ACCEPTANCE_CONDITIONS','AUTHORITY_STATEMENTS','TOOL_RESTRICTIONS','FILE_REFERENCES','OUTPUT_FORMAT_REQUIREMENTS','CORRECTIONS','LATER_OVERRIDES'],omissionsFound:[],omissionsResolved:true},units:intake.units.map((u,i)=>({sourceUnitId:u.unitId,sourceRawValueSha256:u.rawValueSha256,disposition:'EXTRACTED_RELEVANT_INFORMATION',reason:'',extractedStatements:[{statementKey:'S'+(i+1),text:u.rawValueText||u.label||'Captured input',statementClass:'FACT'}]}))});
  p.stages[1].status='COMPLETE';p.stages[1].gate={complete:true,blocked:false,reasons:[]};
}
function project(){
  const p=core.createBlankState('JOB-STAGE03-PROTOCOL');
  Object.assign(p.job,{JOB_ID:'JOB-STAGE03-PROTOCOL',JOB_TITLE:'Stage 03 protocol regression',EXACT_USER_OBJECTIVE_VERBATIM:'Research one controlled external source.',EXACT_DELIVERABLE_REQUESTED:'A complete source research result.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001'});
  engine.ensureShape(p);prepareStage1(p);
  p.stages[2].agentData.SOURCE_APPLICABILITY_DETERMINATION='APPLICABLE_SOURCES_ESTABLISHED';p.stages[2].status='COMPLETE';p.stages[2].gate={complete:true,blocked:false,reasons:[]};
  p.projectData.sources=[{id:'SOURCE-000001',recordId:'SOURCE-000001',active:true,stage:2,scope:{inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'},fields:{SOURCE_ID:'SOURCE-000001',TITLE:'Controlled source',SOURCE_TYPE:'OFFICIAL_STANDARD',AUTHORITY_LEVEL:'PRIMARY',AUTHORITY_ROLE:'GOVERNING',CONTROLLING_STATE:'CONTROLLING'}}];
  return p;
}
function savePrompt(p){const pr={...prompts.buildPromptRecord(3,p,{operation:'COMPLETE'}),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);return pr;}
function envelope(p,pr){return {schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage:3,operation:'COMPLETE',promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],humanAuthorityCandidates:[],stageData:{EXCEPTIONS_AND_EDGE_CONDITIONS:'NONE',CONFLICTING_OR_INVALIDATING_MATERIAL:'NONE',RESEARCH_GAPS_AND_BLOCKERS:'NONE',SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:true,LATEST_PASS_NUMBER:2,NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:false},records:{research:[{tempKey:'research-1',fields:{PASS_NUMBER:'2',EXACT_PORTION_EXAMINED:'Complete controlled source',FINDING_CLASSIFICATION:'SECOND_COMPLETE_PASS_SATURATED',SOURCE_EVIDENCE:'Controlled source evidence',SATURATION_STATUS:'SATURATED'},relationships:{SOURCE_ID:{recordId:'SOURCE-000001'}},evidenceRefs:['evidence-1']}]},evidence:[{temporaryKey:'evidence-1',kind:'SOURCE_RESEARCH',description:'Controlled source research evidence',authorityType:'EXTERNAL_SOURCE',sourceRef:{recordId:'SOURCE-000001'},location:'Controlled source',content:'Complete research evidence'}],unresolved:[],warnings:[],attachments:[]};}

assert(schema.STAGE_FIELDS[3].SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED.valueType==='BOOLEAN','Stage 03 second-pass completion must be BOOLEAN.');
assert(schema.STAGE_FIELDS[3].LATEST_PASS_NUMBER.valueType==='INTEGER','Stage 03 latest-pass number must be INTEGER.');
assert(schema.STAGE_FIELDS[3].NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS.valueType==='BOOLEAN','Stage 03 latest-pass new-material flag must be BOOLEAN.');
let p=project(),pr=savePrompt(p);
for(const token of ['relationshipReferenceKeys','Use recordId for an existing canonical application-provided record','Never use targetId inside a relationship reference','RELATIONSHIP REFERENCE OBJECTS — REQUIRED SHAPE'])assert(pr.prompt.includes(token),`Stage 03 prompt omits relationship-reference contract: ${token}`);
assert(pr.prompt.includes('SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED: BOOLEAN'),'Stage 03 prompt does not declare second-pass completion as BOOLEAN.');
assert(pr.prompt.includes('LATEST_PASS_NUMBER: INTEGER'),'Stage 03 prompt does not declare latest pass as INTEGER.');
assert(pr.prompt.includes('NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS: BOOLEAN'),'Stage 03 prompt does not declare new-material status as BOOLEAN.');
let good=envelope(p,pr);
let prepared=ingestion.prepare(structuredClone(p),{stage:3,text:JSON.stringify(good),promptRecord:pr});
assert(prepared.validation.valid,`Canonical recordId relationship was rejected: ${JSON.stringify(prepared.validation.issues)}`);
let badRef=structuredClone(good);badRef.records.research[0].relationships.SOURCE_ID={targetId:'SOURCE-000001'};badRef.evidence[0].sourceRef={targetId:'SOURCE-000001'};
prepared=ingestion.prepare(structuredClone(p),{stage:3,text:JSON.stringify(badRef),promptRecord:pr});
assert(!prepared.validation.valid,'Nested targetId relationship alias was accepted.');
assert(prepared.validation.issues.some(i=>i.code==='UNKNOWN_PROPERTY'&&i.path.endsWith('/targetId')),'Nested targetId rejection did not identify the unknown relationship key.');
assert(prepared.validation.issues.some(i=>['INVALID_RELATIONSHIP_REFERENCE','INVALID_EVIDENCE_SOURCE_REF'].includes(i.code)),'Nested targetId rejection did not enforce recordId/tempKey relationship shape.');
let badTypes=structuredClone(good);badTypes.stageData.SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED='YES — Evidence ref';badTypes.stageData.LATEST_PASS_NUMBER='3 — Evidence ref';badTypes.stageData.NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS='NO — Evidence ref';
prepared=ingestion.prepare(structuredClone(p),{stage:3,text:JSON.stringify(badTypes),promptRecord:pr});
assert(!prepared.validation.valid,'Prose-tainted Stage 03 gate values were accepted.');
assert(prepared.validation.issues.filter(i=>i.code==='WRONG_VALUE_TYPE'&&i.path.startsWith('/stageData/')).length>=3,`Typed Stage 03 gate rejection incomplete: ${JSON.stringify(prepared.validation.issues)}`);
prepared=ingestion.prepare(p,{stage:3,text:JSON.stringify(good),promptRecord:pr});
assert(prepared.validation.valid,'Correct Stage 03 response failed validation.');
p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'}).project;
p.stages[2].status='COMPLETE';p.stages[2].gate={complete:true,blocked:false,reasons:[]};
const gate=engine.gate(3,p);
assert(gate.complete,`Correctly typed and related Stage 03 response did not complete the gate: ${JSON.stringify(gate.reasons)}`);
const legacyCanonical=structuredClone(p);legacyCanonical.stages[3].agentData.SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED='TRUE';legacyCanonical.stages[3].agentData.LATEST_PASS_NUMBER='2';legacyCanonical.stages[3].agentData.NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS='FALSE';const legacyGate=engine.gate(3,legacyCanonical);assert(legacyGate.complete,`Legacy stored Stage 03 clean scalar values no longer gate correctly: ${JSON.stringify(legacyGate.reasons)}`);console.log(JSON.stringify({stage03AgentProtocol:true,relationshipReferenceContract:true,nestedTargetIdRejected:true,recordIdAccepted:true,typedGateFields:true,gateComplete:true,legacyCanonicalCompatibility:true,promptEngineVersion:pr.promptEngineVersion},null,2));
