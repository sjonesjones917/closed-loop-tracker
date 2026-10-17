import {createVerifierRuntime} from './verifier-runtime.mjs';
import {recordProposal,stage02AcceptanceFixture} from './test-fixtures.mjs';
import {deepStrictEqual} from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js']) createVerifierRuntime.loadScript(globalThis,fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const prompts=globalThis.closedLoopPromptEngine;
const ingestion=globalThis.closedLoopResponseIngestion;
const runtime={core,schema,engine,prompts,ingestion};
const assert=(v,m)=>{if(!v)throw new Error(m);};

function project(){
  let p=core.createBlankState('JOB-STAGE03-PROTOCOL');
  Object.assign(p.job,{JOB_ID:'JOB-STAGE03-PROTOCOL',JOB_TITLE:'Stage 03 protocol regression',EXACT_USER_OBJECTIVE_VERBATIM:'Research one controlled external source.',EXACT_DELIVERABLE_REQUESTED:'A complete source research result.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001'});
  engine.ensureShape(p);
  const source=recordProposal(schema,'sources',{tempKey:'controlled-source',overrides:{TITLE:'Controlled source',ISSUING_ORGANIZATION_OR_AUTHOR:'Independent synthetic fixture authority',SOURCE_TYPE:'OFFICIAL_STANDARD',PUBLICATION_ORIGIN:'Independent synthetic fixture publication',URL_REFERENCE:'https://example.invalid/stage03-controlled-source',AUTHORITY_LEVEL:'PRIMARY',AUTHORITY_ROLE:'GOVERNING',RELEVANCE:'Supplies the controlled Stage 03 source relationship.',APPLICABLE_PORTIONS:'Complete controlled source',INSPECTION_STATUS:'INSPECTED',CURRENCY_STATUS:'CURRENT',SUPERSESSION_STATUS:'NOT_SUPERSEDED',CONTROLLING_STATE:'CONTROLLING'}});
  p=stage02AcceptanceFixture(runtime,p.job.JOB_ID,{project:p,sources:[source]});
  const acceptedSources=engine.recordsForCurrentScope(p,'sources');
  assert(acceptedSources.length===1,'Stage 03 protocol fixture must retain exactly one current accepted source.');
  const sourceId=engine.recordId(acceptedSources[0],'sources');
  assert(typeof sourceId==='string'&&sourceId.length>0,'Stage 03 protocol fixture must use the application-issued source identity.');
  return {p,sourceId};
}
function savePrompt(p){const pr={...prompts.buildPromptRecord(3,p,engine.preparePromptContext(p,3,{operation:'COMPLETE'}).options),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);return pr;}
function envelope(p,pr,sourceId){return {schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage:3,operation:'COMPLETE',promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],humanAuthorityCandidates:[],stageData:{EXCEPTIONS_AND_EDGE_CONDITIONS:'NONE',CONFLICTING_OR_INVALIDATING_MATERIAL:'NONE',RESEARCH_GAPS_AND_BLOCKERS:'NONE',SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:true,LATEST_PASS_NUMBER:2,NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:false},records:{research:[{tempKey:'research-1',fields:{PASS_NUMBER:'2',EXACT_PORTION_EXAMINED:'Complete controlled source',FINDING_CLASSIFICATION:'SECOND_COMPLETE_PASS_SATURATED',SOURCE_EVIDENCE:'Controlled source evidence',SATURATION_STATUS:'SATURATED'},relationships:{SOURCE_ID:{recordId:sourceId}},evidenceRefs:['evidence-1']}]},evidence:[{temporaryKey:'evidence-1',kind:'SOURCE_RESEARCH',description:'Controlled source research evidence',authorityType:'EXTERNAL_SOURCE',sourceRef:{recordId:sourceId},location:'Controlled source',content:'Complete research evidence'}],unresolved:[],warnings:[],attachments:[]};}

assert(schema.STAGE_FIELDS[3].SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED.valueType==='BOOLEAN','Stage 03 second-pass completion must be BOOLEAN.');
assert(schema.STAGE_FIELDS[3].LATEST_PASS_NUMBER.valueType==='INTEGER','Stage 03 latest-pass number must be INTEGER.');
assert(schema.STAGE_FIELDS[3].NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS.valueType==='BOOLEAN','Stage 03 latest-pass new-material flag must be BOOLEAN.');
let {p,sourceId}=project(),pr=savePrompt(p);
// The emitted typed contract is authoritative. Its explanatory prose may change
// while the recordId/tempKey boundary and consumer behavior remain unchanged.
const descriptor=prompts.responseContractDescriptor(3,'COMPLETE');
function assertEmittedRelationshipContract(prompt,contract){
  assert(JSON.stringify(contract.envelope.relationshipReferenceKeys)===JSON.stringify(['tempKey','recordId']),'STAGE03_RELATIONSHIP_CONTRACT: relationship references must expose exactly tempKey and recordId.');
  const start='RESPONSE CONTRACT DEFINITIONS\n',end='\n\nEND HASHED INSTRUCTION BODY',first=prompt.indexOf(start),last=first<0?-1:prompt.indexOf(end,first+start.length);
  assert(first>=0&&last>first+start.length,'STAGE03_RELATIONSHIP_CONTRACT: the complete typed descriptor was not emitted to the agent.');
  let emitted;try{emitted=JSON.parse(prompt.slice(first+start.length,last));}catch{throw new Error('STAGE03_RELATIONSHIP_CONTRACT: the emitted typed descriptor is not valid JSON.');}
  try{deepStrictEqual(emitted,JSON.parse(JSON.stringify(contract)));}catch{throw new Error('STAGE03_RELATIONSHIP_CONTRACT: the emitted typed descriptor differs from its complete consumer contract.');}
}
assertEmittedRelationshipContract(pr.prompt,descriptor);
const missingDescriptor=pr.prompt.replace(/RESPONSE CONTRACT DEFINITIONS\n[\s\S]*?\n\nEND HASHED INSTRUCTION BODY/,'RESPONSE CONTRACT DEFINITIONS\n\nEND HASHED INSTRUCTION BODY');
let missingDescriptorRejected=false;
try{assertEmittedRelationshipContract(missingDescriptor,descriptor);}catch(error){missingDescriptorRejected=error.message.startsWith('STAGE03_RELATIONSHIP_CONTRACT:');}
assert(missingDescriptorRejected,'A prompt missing the real relationship descriptor passed the oracle.');
const changedProse=pr.prompt.replace('- Existing canonical application-provided record:','- Existing canonical record:');
assert(changedProse!==pr.prompt,'The prose control did not change the actual emitted instruction.');
assertEmittedRelationshipContract(changedProse,descriptor);
assert(pr.prompt.includes('SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED: BOOLEAN'),'Stage 03 prompt does not declare second-pass completion as BOOLEAN.');
assert(pr.prompt.includes('LATEST_PASS_NUMBER: INTEGER'),'Stage 03 prompt does not declare latest pass as INTEGER.');
assert(pr.prompt.includes('NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS: BOOLEAN'),'Stage 03 prompt does not declare new-material status as BOOLEAN.');
let good=envelope(p,pr,sourceId);
let prepared=ingestion.prepare(structuredClone(p),{stage:3,text:JSON.stringify(good),promptRecord:pr});
assert(prepared.validation.valid,`Canonical recordId relationship was rejected: ${JSON.stringify(prepared.validation.issues)}`);
let badRef=structuredClone(good);badRef.records.research[0].relationships.SOURCE_ID={targetId:sourceId};badRef.evidence[0].sourceRef={targetId:sourceId};
prepared=ingestion.prepare(structuredClone(p),{stage:3,text:JSON.stringify(badRef),promptRecord:pr});
assert(!prepared.validation.valid,'Nested targetId relationship alias was accepted.');
// Preflight may stop at the first closed-member error. Test each forbidden
// reference independently so one rejection cannot conceal the other boundary.
for(const [code,path,change]of [
 ['INVALID_RELATIONSHIP_REFERENCE','/records/research/0/relationships/SOURCE_ID',value=>{value.records.research[0].relationships.SOURCE_ID={targetId:sourceId};}],
 ['INVALID_EVIDENCE_SOURCE_REF','/evidence/0/sourceRef',value=>{value.evidence[0].sourceRef={targetId:sourceId};}]
]){
 const invalid=structuredClone(good);change(invalid);const text=JSON.stringify(invalid);
 prepared=ingestion.prepare(structuredClone(p),{stage:3,text,promptRecord:pr});
 assert(!prepared.validation.valid,`Nested targetId alias was accepted at ${path}.`);
 assert(prepared.validation.issues.some(i=>(i.code==='UNKNOWN_PROPERTY'&&i.path===path+'/targetId')||(i.code===code&&i.path===path)),`Nested targetId alias did not identify the invalid contracted ${path} reference: ${JSON.stringify(prepared.validation.issues)}`);
 assert(prepared.proposal===null&&prepared.rawRecord?.completeRawResponse===text&&prepared.rawRecord.status==='VALIDATION_FAILED',`Rejected ${path} alias must retain exact raw bytes without creating a proposal.`);
}
let badTypes=structuredClone(good);badTypes.stageData.SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED='YES — Evidence ref';badTypes.stageData.LATEST_PASS_NUMBER='3 — Evidence ref';badTypes.stageData.NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS='NO — Evidence ref';
prepared=ingestion.prepare(structuredClone(p),{stage:3,text:JSON.stringify(badTypes),promptRecord:pr});
assert(!prepared.validation.valid,'Prose-tainted Stage 03 gate values were accepted.');
assert(prepared.validation.issues.filter(i=>i.code==='WRONG_VALUE_TYPE'&&i.path.startsWith('/stageData/')).length>=3,`Typed Stage 03 gate rejection incomplete: ${JSON.stringify(prepared.validation.issues)}`);
prepared=ingestion.prepare(p,{stage:3,text:JSON.stringify(good),promptRecord:pr});
assert(prepared.validation.valid,'Correct Stage 03 response failed validation.');
p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'}).project;
const gate=engine.gate(3,p);
assert(gate.complete,`Correctly typed and related Stage 03 response did not complete the gate: ${JSON.stringify(gate.reasons)}`);p.stages[3].status='COMPLETE';p.stages[3].gate={complete:true,blocked:false,reasons:[]};
const legacyCanonical=structuredClone(p);legacyCanonical.stages[3].agentData.SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED='TRUE';legacyCanonical.stages[3].agentData.LATEST_PASS_NUMBER='2';legacyCanonical.stages[3].agentData.NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS='FALSE';const legacyGate=engine.gate(3,legacyCanonical);assert(legacyGate.complete,`Legacy stored Stage 03 clean scalar values no longer gate correctly: ${JSON.stringify(legacyGate.reasons)}`);
assert(schema.STAGE_FIELDS[3].ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED.producer===schema.PRODUCER.APPLICATION,'Stage 03 controlling-source coverage must remain APPLICATION-owned.');
assert(!schema.operationContract(3,'COMPLETE').allowedStageData.includes('ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED'),'Stage 03 COMPLETE must not permit the agent to write application-owned source coverage.');
const derivedStage3=engine.deriveStageData(p,3);assert(derivedStage3.ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED===true,'Application-derived Stage 03 source coverage did not reflect the complete current research relationship set.');
assert(engine.evaluateIntakeAccounting(p).complete,'Stage 03 protocol fixture must preserve complete Stage 01 accounting before Stage 04 transition.');
let stage4Built=false;try{const stage4=prompts.buildPromptRecord(4,p,{operation:'COMPLETE'});stage4Built=Boolean(stage4?.prompt);}catch(error){throw new Error(`A valid completed Stage 03 state could not generate Stage 04: ${error?.code||'ERROR'} ${error?.message||error}`);}assert(stage4Built,'Stage 04 prompt was not produced after valid Stage 03 completion.');
const incompleteCoverage=structuredClone(p);const currentResearch=engine.recordsForCurrentScope(incompleteCoverage,'research');assert(currentResearch.length>0,'Regression fixture has no Stage 03 research to invalidate.');currentResearch[0].invalidatedBy='REGRESSION-MISSING-COVERAGE';assert(engine.deriveStageData(incompleteCoverage,3).ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED===false,'Application-derived Stage 03 source coverage did not fail closed after current research was invalidated.');let coverageBlocked=false;try{prompts.buildPromptRecord(4,incompleteCoverage,{operation:'COMPLETE'});}catch(error){coverageBlocked=error?.code==='STAGE4_UPSTREAM_INCOMPLETE';}assert(coverageBlocked,'Stage 04 did not fail closed when current Stage 03 source coverage was made incomplete.');
console.log(JSON.stringify({stage03AgentProtocol:true,relationshipReferenceContract:true,nestedTargetIdRejected:true,recordIdAccepted:true,typedGateFields:true,gateComplete:true,legacyCanonicalCompatibility:true,applicationCoverageDerivation:true,stage04TransitionUsesApplicationCoverage:true,incompleteCoverageBlocksStage04:true,promptEngineVersion:pr.promptEngineVersion,verificationObservations:[{checkId:'stage03.emitted-relationship-contract',boundary:'final emitted Stage 03 prompt -> typed ingestion contract',expected:['tempKey','recordId'],observed:descriptor.envelope.relationshipReferenceKeys,passed:true,requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt#8']},{checkId:'stage03.missing-emitted-contract-rejected',boundary:'executed prompt contract oracle',expected:'REJECTED',observed:missingDescriptorRejected?'REJECTED':'ACCEPTED',passed:missingDescriptorRejected},{checkId:'stage03.canonical-recordId-accepted',boundary:'ingestion.prepare/commit -> Stage 03 gate',expected:true,observed:gate.complete,passed:gate.complete},{checkId:'stage03.nested-targetId-rejected',boundary:'typed relationship validator',expected:'REJECTED',observed:'REJECTED',passed:true,violation:'unregisteredFieldsOrStageOperationsAccepted',accepted:false}]},null,2));
