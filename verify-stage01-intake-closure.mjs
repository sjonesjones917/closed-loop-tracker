import {checkedVerifier} from './verify-conformance-regressions.mjs';
import {artifactFixtureId} from './test-artifact-fixtures.mjs';
import {recordProposal} from './test-fixtures.mjs';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {executionReports} from './verification-evidence.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])createVerifierRuntime.loadScript(globalThis,fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion,hash=globalThis.closedLoopHash;
const assert=(value,message)=>{if(!value)throw new Error(message);};

const p=core.createBlankState('JOB-STAGE01-CLOSURE');
Object.assign(p.job,{JOB_TITLE:'Intake closure',JOB_OWNER:'Operator',EXACT_USER_OBJECTIVE_VERBATIM:'Build the exact requested product.',SUPPLIED_MATERIALS_INVENTORY:'intent.txt',REQUIRED_OUTPUT_FORMAT:'Exact requested artifacts',PROHIBITED_ACTIONS:'Do not discard supplied intent.',EXPLICIT_USER_REQUIREMENTS:'Capture every supplied requirement exactly.',CURRENT_INPUT_VERSION:'INPUT-v001'});
engine.ensureShape(p);
engine.registerArtifactBytes(p,{stage:1,artifactId:artifactFixtureId(engine,p,'ARTIFACT-INTENT-001'),filename:'intent.txt',mediaType:'text/plain',byteSize:42,sha256:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',role:'HUMAN_INPUT'});
p.stages[1].authorizedFiles=[{artifactId:artifactFixtureId(engine,p,'ARTIFACT-INTENT-001')}];

const manifest=engine.intakeCoverageManifest(p);
assert(manifest.unitCount===manifest.units.length&&manifest.unitCount>0,'Stage 01 intake manifest is not a closed controlled-unit set.');
assert(JSON.stringify(manifest.units).includes(artifactFixtureId(engine,p,'ARTIFACT-INTENT-001')),'Stage 01 intake manifest does not bind the supplied artifact identity.');
const prompt={...prompts.buildPromptRecord(1,p,{operation:'COMPLETE'}),generatedAt:new Date().toISOString()};
p.projectData.generatedPrompts.push(prompt);
assert(prompt.contextManifest.intakeCoverageManifest.manifestSha256===manifest.manifestSha256,'Stage 01 prompt is not bound to the current application intake manifest.');
for(const unit of manifest.units)assert(prompt.prompt.includes(unit.unitId),`Prompt 01 omitted controlled input unit ${unit.unitId}.`);
assert(prompt.prompt.includes('INPUT_SET_CONTENTS must be a JSON STRING'),'Prompt 01 does not command the current closed Stage 01 accounting response.');
assert(prompt.prompt.includes('first semantic reader')||prompt.prompt.includes('FIRST SEMANTIC READER'),'Prompt 01 does not identify Stage 01 as the first semantic reader.');
assert(!prompt.prompt.includes('EXECUTABLE_KIND = CUSTOM_PIPELINE'),'Prompt still contains obsolete CUSTOM_PIPELINE instruction.');

const capture={schema:'closed-loop-stage01-capture/2',inputVersion:manifest.inputVersion,manifestSha256:manifest.manifestSha256,pass1Completed:true,pass2OmissionChallenge:{completed:true,checkedCategories:['QUALIFIERS','EXCEPTIONS','DEPENDENCIES','NEGATIVE_REQUIREMENTS','DO_NOT_CHANGE','VISUAL_CONSTRAINTS','TEMPORAL_CONSTRAINTS','ACCEPTANCE_CONDITIONS','AUTHORITY_STATEMENTS','TOOL_RESTRICTIONS','FILE_REFERENCES','OUTPUT_FORMAT_REQUIREMENTS','CORRECTIONS','LATER_OVERRIDES'],omissionsFound:[],omissionsResolved:true},units:manifest.units.map((unit,index)=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:'RETAINED_AS_CONTEXT',reason:'Preserved as current human-authority input.',externalInspectionClaimed:unit.kind==='SUPPLIED_MATERIAL'?true:undefined,extractedStatements:[{statementKey:`statement-${index+1}`,text:unit.rawValueText||unit.label||unit.unitId,statementClass:'CONTEXT',sourceLocation:unit.kind==='SUPPLIED_MATERIAL'?unit.sourceLocation:undefined}]}))};
assert(engine.evaluateIntakeAccounting(p,{capture:JSON.stringify(capture)}).complete,'Complete Stage 01 intake accounting did not close: '+JSON.stringify(engine.evaluateIntakeAccounting(p,{capture:JSON.stringify(capture)})));
const legacySchema=structuredClone(capture);legacySchema.schema='closed-loop-stage01-capture/1';
assert(!engine.evaluateIntakeAccounting(p,{capture:JSON.stringify(legacySchema)}).complete,'Stage 01 accepted a non-migrated legacy capture schema.');
const missingPassOne=structuredClone(capture);delete missingPassOne.pass1Completed;
assert(!engine.evaluateIntakeAccounting(p,{capture:JSON.stringify(missingPassOne)}).complete,'Stage 01 accepted a capture without exhaustive extraction Pass 1.');
const missingPassTwo=structuredClone(capture);delete missingPassTwo.pass2OmissionChallenge;
assert(!engine.evaluateIntakeAccounting(p,{capture:JSON.stringify(missingPassTwo)}).complete,'Stage 01 accepted a capture without omission-challenge Pass 2.');
const incompletePassTwo=structuredClone(capture);incompletePassTwo.pass2OmissionChallenge.checkedCategories=incompletePassTwo.pass2OmissionChallenge.checkedCategories.filter(value=>value!=='LATER_OVERRIDES');
assert(!engine.evaluateIntakeAccounting(p,{capture:JSON.stringify(incompletePassTwo)}).complete,'Stage 01 accepted an omission challenge that skipped a required category.');
const inspectionMissing=structuredClone(capture);const fileAccounting=inspectionMissing.units.find(unit=>manifest.units.find(source=>source.unitId===unit.sourceUnitId)?.kind==='SUPPLIED_MATERIAL');delete fileAccounting.externalInspectionClaimed;
assert(!engine.evaluateIntakeAccounting(p,{capture:JSON.stringify(inspectionMissing)}).complete,'Stage 01 accepted a required supplied file without EXTERNAL_INSPECTION_CLAIMED.');
const handoffMissing=structuredClone(p);handoffMissing.stages[1].authorizedFiles=[];const handoffManifest=engine.intakeCoverageManifest(handoffMissing);const handoffCapture={...capture,manifestSha256:handoffManifest.manifestSha256,pass1Completed:true,pass2OmissionChallenge:{completed:true,checkedCategories:['QUALIFIERS','EXCEPTIONS','DEPENDENCIES','NEGATIVE_REQUIREMENTS','DO_NOT_CHANGE','VISUAL_CONSTRAINTS','TEMPORAL_CONSTRAINTS','ACCEPTANCE_CONDITIONS','AUTHORITY_STATEMENTS','TOOL_RESTRICTIONS','FILE_REFERENCES','OUTPUT_FORMAT_REQUIREMENTS','CORRECTIONS','LATER_OVERRIDES'],omissionsFound:[],omissionsResolved:true},units:handoffManifest.units.map((source,index)=>({sourceUnitId:source.unitId,sourceRawValueSha256:source.rawValueSha256,disposition:'RETAINED_AS_CONTEXT',reason:'Preserved.',externalInspectionClaimed:source.kind==='SUPPLIED_MATERIAL'?true:undefined,extractedStatements:[{statementKey:`handoff-${index}`,text:source.rawValueText||source.label,statementClass:'CONTEXT',sourceLocation:source.kind==='SUPPLIED_MATERIAL'?source.sourceLocation:undefined}]}))};
assert(!engine.evaluateIntakeAccounting(handoffMissing,{capture:JSON.stringify(handoffCapture)}).complete,'Stage 01 accepted a required supplied file that was not INCLUDED_IN_HANDOFF.');
const incomplete=structuredClone(capture);incomplete.units.pop();
assert(!engine.evaluateIntakeAccounting(p,{capture:JSON.stringify(incomplete)}).complete,'Stage 01 accepted incomplete controlled-input accounting.');

const evidence=[{temporaryKey:'evidence-1',kind:'INTAKE',description:'Stage 01 intake evidence',authorityType:'AGENT_CLAIM',location:'response',content:'Complete controlled-input accounting.'}];
const envelope=captureValue=>({schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage:1,operation:prompt.operation,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},scope:prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{EXACT_DELIVERABLE_REQUESTED:'Exact requested product',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(captureValue)},records:{},evidence,unresolved:[],warnings:[],attachments:[]});
let invalid=envelope(incomplete);let validation=ingestion.validateEnvelope(p,invalid,{stage:1,promptRecord:prompt,rawSha256:hash.sha256Value(invalid),files:[]});
assert(validation.issues.some(issue=>issue.code==='INCOMPLETE_INTAKE_ACCOUNTING'),'Stage 01 ingestion accepted incomplete intake accounting.');
let valid=envelope(capture);validation=ingestion.validateEnvelope(p,valid,{stage:1,promptRecord:prompt,rawSha256:hash.sha256Value(valid),files:[]});
assert(!validation.issues.some(issue=>issue.code==='INCOMPLETE_INTAKE_ACCOUNTING'),`Stage 01 ingestion rejected repaired intake accounting: ${JSON.stringify(validation.issues)}`);

// A valid partial proposal and human confirmation cannot define a missing
// deliverable. Exercise the actual accepted-state gate, not JSON spelling.
const deliverableCompletionCases=[];
const verificationObservations=[];
for(const [caseId,value,expectedComplete] of [['omitted',undefined,false],['empty','',false],['unknown','UNKNOWN',false],['defined','Exact requested product',true]]){
  const candidate=structuredClone(p),response=envelope(capture);
  if(value===undefined)delete response.stageData.EXACT_DELIVERABLE_REQUESTED;else response.stageData.EXACT_DELIVERABLE_REQUESTED=value;
  const prepared=ingestion.prepare(candidate,{stage:1,text:JSON.stringify(response),promptRecord:prompt});
  assert(prepared.validation.valid,`DELIVERABLE_GATE_SETUP_ORACLE: ${caseId}: ${JSON.stringify(prepared.validation.issues)}`);
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'INTAKE_DELIVERABLE_FIXTURE'}),project=committed.project;
  engine.recordStageConfirmation(project,1,true,'Current intent confirmed','INTAKE_DELIVERABLE_FIXTURE',{acceptedChangeId:committed.acceptedChange.changeId,inputVersion:project.job.CURRENT_INPUT_VERSION,instructionId:committed.acceptedChange.promptId,contextSignature:committed.acceptedChange.contextSignature,operatorLabel:'INTAKE_DELIVERABLE_FIXTURE'});
  const gate=engine.gate(1,project);
  assert(gate.complete===expectedComplete,`DELIVERABLE_COMPLETION_ORACLE: ${caseId}: ${JSON.stringify(gate)}`);
  if(!expectedComplete)assert(gate.reasons.some(reason=>reason.includes('intended deliverable')),`DELIVERABLE_REASON_ORACLE: ${caseId}: ${JSON.stringify(gate)}`);
  deliverableCompletionCases.push({observationId:'stage01.deliverable.'+caseId,expected:{complete:expectedComplete},actual:{complete:gate.complete,deliverable:project.job.EXACT_DELIVERABLE_REQUESTED||null,reasons:gate.reasons}});
  verificationObservations.push({checkId:'stage01.deliverable.'+caseId,requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:557'],boundary:'Actual accepted Stage01 proposal and current human confirmation completion gate',expected:{complete:expectedComplete},observed:{complete:gate.complete},passed:true,...(!expectedComplete?{violation:'STAGE01_UNDEFINED_INTENDED_DELIVERABLE',accepted:false}:{})});
}

// Stored UTF-8 text is mechanically available and must not collapse into a
// whole-file coverage assertion. Comments and line endings remain exact bytes.
const textProject=core.createBlankState('JOB-RAW-UNITIZATION');
Object.assign(textProject.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Preserve the complete supplied text.',CURRENT_INPUT_VERSION:'INPUT-v001'});engine.ensureShape(textProject);
const exactText='First requirement.\r\n# Comment remains supplied context.\nLast requirement.',textBytes=new TextEncoder().encode(exactText),textArtifactId=artifactFixtureId(engine,textProject,'raw-text');
const textMetadata={artifactId:textArtifactId,filename:'requirements.txt',mediaType:'text/plain',byteSize:textBytes.length,sha256:await hash.sha256Bytes(textBytes)};
engine.registerArtifactBytes(textProject,{stage:1,...textMetadata,role:'HUMAN_INPUT'});
textProject.stages[1].authorizedFiles=[{artifactId:textArtifactId}];
textProject.projectData.userEntered.suppliedArtifactText={[textArtifactId]:{...textMetadata,text:exactText}};
const textManifest=engine.intakeCoverageManifest(textProject),textUnits=textManifest.units.filter(unit=>unit.kind==='SUPPLIED_MATERIAL_CONTENT');
assert(textUnits.length===3,'RAW_UNITIZATION_ORACLE: available text lines were replaced by whole-file accounting.');
assert(textManifest.rawUnitizationVersion==='closed-loop-raw-units/1','RAW_UNITIZATION_VERSION_ORACLE');
assert(textUnits.map(unit=>unit.rawValueText).join('')===exactText,'RAW_UNITIZATION_BYTES_ORACLE: comments or line endings were lost.');
assert(textUnits.every(unit=>unit.artifactId===textArtifactId&&unit.sourceLocation.includes('#page=1&line=')),'RAW_UNITIZATION_LOCATION_ORACLE');
const textCapture={...structuredClone(capture),inputVersion:textManifest.inputVersion,manifestSha256:textManifest.manifestSha256,units:textManifest.units.map((unit,index)=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:'RETAINED_AS_CONTEXT',reason:'Preserved exactly.',externalInspectionClaimed:unit.kind==='SUPPLIED_MATERIAL'?true:undefined,extractedStatements:[{statementKey:'text-'+index,text:unit.rawValueText,statementClass:'CONTEXT',sourceLocation:unit.sourceLocation}]}))};
assert(engine.evaluateIntakeAccounting(textProject,{capture:textCapture}).complete,'RAW_UNITIZATION_ACCOUNTING_CONTROL_ORACLE');
const omittedLine=structuredClone(textCapture);omittedLine.units=omittedLine.units.filter(unit=>unit.sourceUnitId!==textUnits[1].unitId);
assert(engine.evaluateIntakeAccounting(textProject,{capture:omittedLine}).reasons.some(reason=>reason.includes('omitted controlled input unit '+textUnits[1].unitId)),'RAW_UNITIZATION_OMISSION_ORACLE');

// Specification 6.5A uses strict greater-than boundaries in bytes and units.
const fileChallengeCases=[];
const challengeCases=[
  {id:'files-20',count:20,required:false},
  {id:'files-21',count:21,required:true},
  {id:'text-bytes-at',count:1,byteSize:1048576,required:false},
  {id:'text-bytes-over',count:1,byteSize:1048577,required:true},
  {id:'stored-code-text-over',count:1,byteSize:1048577,storedText:true,extension:'.py',mediaType:'application/octet-stream',required:true},
  {id:'aggregate-bytes-at',count:5,byteSize:1048576,mediaType:'application/octet-stream',required:false},
  {id:'aggregate-bytes-over',count:5,byteSize:1048576,extraByte:true,mediaType:'application/octet-stream',required:true},
  {id:'pages-at',count:1,pages:100,required:false},
  {id:'pages-over',count:1,pages:101,required:true},
  {id:'aggregate-pages-over',count:2,pages:51,required:true},
  {id:'raw-units-at',count:0,rawUnits:500,required:false},
  {id:'raw-units-over',count:0,rawUnits:501,required:true}
];
for(const testCase of challengeCases){
  const {id,count,required}=testCase;
  let project=core.createBlankState('JOB-FILE-CHALLENGE-'+id);
  Object.assign(project.job,{JOB_TITLE:'File-count challenge',EXACT_USER_OBJECTIVE_VERBATIM:'Produce a checklist.',EXPLICIT_USER_REQUIREMENTS:'Preserve the supplied statements.',CURRENT_INPUT_VERSION:'INPUT-v001'});
  engine.ensureShape(project);
  const members=[];
  for(let index=0;index<count;index++){
    const text=testCase.storedText?'a'.repeat(testCase.byteSize):testCase.pages?Array.from({length:testCase.pages},(_,page)=>'File '+index+', page '+(page+1)).join('\f'):'Statement '+index,bytes=new TextEncoder().encode(text),artifactId=artifactFixtureId(engine,project,'count-'+index);
    members.push({stage:1,artifactId,filename:'input-'+index+(testCase.extension||(testCase.mediaType?'.bin':'.txt')),mediaType:testCase.mediaType||'text/plain',byteSize:testCase.byteSize===undefined?bytes.length:testCase.byteSize+(testCase.extraByte&&index===0?1:0),sha256:await hash.sha256Bytes(bytes),role:'HUMAN_INPUT'});
    if(testCase.pages||testCase.storedText){project.projectData.userEntered.suppliedArtifactText??={};project.projectData.userEntered.suppliedArtifactText[artifactId]={...members.at(-1),text};}
  }
  engine.registerArtifactBytesBatch(project,members);
  project.stages[1].authorizedFiles=members.map(({artifactId})=>({artifactId}));
  if(testCase.rawUnits){
    const baseUnits=engine.intakeCoverageManifest(project).unitCount;
    project.projectData.userEntered.thresholdStatements=Array.from({length:testCase.rawUnits-baseUnits},(_,index)=>'Raw statement '+index);
    assert(engine.intakeCoverageManifest(project).unitCount===testCase.rawUnits,'CHALLENGE_UNIT_SETUP_ORACLE: '+id);
  }
  const current=engine.intakeCoverageManifest(project),accounting={...structuredClone(capture),inputVersion:current.inputVersion,manifestSha256:current.manifestSha256,units:current.units.map((unit,index)=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:'RETAINED_AS_CONTEXT',reason:'Preserve supplied statements.',externalInspectionClaimed:unit.kind==='SUPPLIED_MATERIAL'?true:undefined,extractedStatements:[{statementKey:'count-'+index,text:testCase.storedText&&unit.kind==='SUPPLIED_MATERIAL_CONTENT'?'The source file contains exactly 1,048,577 ASCII a characters.':unit.rawValueText,statementClass:'CONTEXT',sourceLocation:unit.sourceLocation}]}))};
  assert(engine.evaluateIntakeAccounting(project,{capture:accounting}).complete,'FILE_CHALLENGE_SETUP_ORACLE: complete accounting is required before checking the challenge gate.');
  const preparedContext=engine.preparePromptContext(project,1,{operation:'COMPLETE'}),instruction=prompts.buildPromptRecord(1,project,preparedContext.options);
  project.projectData.generatedPrompts.push(instruction);
  const response={...envelope(accounting),jobId:project.job.JOB_ID,operation:instruction.operation,promptIdentity:{instructionId:instruction.instructionId,bodySha256:instruction.bodySha256,contractSha256:instruction.contractSha256,contextSignature:instruction.contextSignature},scope:instruction.scope};
  const prepared=ingestion.prepare(project,{stage:1,text:JSON.stringify(response),promptRecord:instruction});
  assert(prepared.validation.valid,'FILE_CHALLENGE_SETUP_ORACLE: '+JSON.stringify(prepared.validation.issues));
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'COUNT_BOUNDARY_FIXTURE'});project=committed.project;
  engine.recordStageConfirmation(project,1,true,'The represented intake matches the supplied intent.','COUNT_BOUNDARY_FIXTURE',{acceptedChangeId:committed.acceptedChange.changeId,inputVersion:project.job.CURRENT_INPUT_VERSION,instructionId:instruction.instructionId,contextSignature:instruction.contextSignature});
  const gate=engine.gate(1,project);
  assert(gate.complete===!required,'FILE_CHALLENGE_THRESHOLD_ORACLE: '+id+': '+JSON.stringify(gate));
  if(required){
    assert(gate.reasons.some(reason=>reason.includes('SEMANTIC_CHALLENGE')),'FILE_CHALLENGE_REASON_ORACLE');
    assert(engine.operationalNextAction(project,1).operation==='SEMANTIC_CHALLENGE','FILE_CHALLENGE_NEXT_ACTION_ORACLE');
    const continuation=ingestion.prepareStageContinuation(project,{stage:1});
    assert(continuation?.prompt.operation==='SEMANTIC_CHALLENGE','FILE_CHALLENGE_CONTINUATION_ORACLE');
    assert(continuation.prompt.contextManifest.semanticReviewBinding.bindingStatus==='BOUND','FILE_CHALLENGE_INDEPENDENCE_ORACLE');
    project=continuation.project||project;
    const challenge=continuation.prompt,review={...response,promptIdentity:{instructionId:challenge.instructionId,bodySha256:challenge.bodySha256,contractSha256:challenge.contractSha256,contextSignature:challenge.contextSignature},operation:challenge.operation,scope:challenge.scope,stageData:{},records:{semanticChallenges:[recordProposal(schema,'semanticChallenges',{tempKey:'count-review',overrides:{FINDINGS:'Every supplied statement is represented.',DISPOSITION:'ACCEPTED',REASONING:'An independent context compared the intake to the supplied files.'}})]}};
    Object.assign(review,{packageId:challenge.packageId,operationReservationId:challenge.operationReservationId,challengeNonce:challenge.challengeNonce});
    const transport={authority:'NONAUTHORITATIVE_TEXT_FALLBACK',materializedAsResponseFile:true,packageId:challenge.packageId,operationReservationId:challenge.operationReservationId,challengeNonce:challenge.challengeNonce,promptIdentity:review.promptIdentity};
    const reviewed=ingestion.prepare(project,{stage:1,text:JSON.stringify(review),promptRecord:challenge,transport});
    assert(reviewed.validation.valid,'FILE_CHALLENGE_REVIEW_SETUP_ORACLE: '+JSON.stringify(reviewed.validation.issues));
    const acceptedReview=ingestion.commit(reviewed.project,reviewed.proposal.proposalId,{operator:'COUNT_BOUNDARY_FIXTURE',replacementConfirmation:ingestion.acceptanceImpact(reviewed.project,reviewed.proposal.proposalId)});project=acceptedReview.project;
    engine.recordStageConfirmation(project,1,true,'The reviewed intake matches the supplied intent.','COUNT_BOUNDARY_FIXTURE',{acceptedChangeId:acceptedReview.acceptedChange.changeId,inputVersion:project.job.CURRENT_INPUT_VERSION});
    assert(engine.gate(1,project).complete,'FILE_CHALLENGE_COMPLETION_ORACLE: a current accepted independent review must close the challenge.');
  }
  fileChallengeCases.push({id,count,required,complete:gate.complete,result:'PASS'});
}
function selectHumanAuthorityReports(reports){
  const save=reports.filter(row=>Object.hasOwn(row,'humanStageSave'));
  const authority=reports.filter(row=>Object.hasOwn(row,'humanAuthorityRoundTrip'));
  assert(reports.length===2&&save.length===1&&authority.length===1,'HUMAN_AUTHORITY_REPORT_ORACLE: expected one stage-save and one authority report.');
  return {save:save[0],authority:authority[0]};
}
const humanAuthorityReports=executionReports(await checkedVerifier(process.execPath,['verify-human-authority-roundtrip.mjs'],{encoding:'utf8'}));
const {save:humanStageSave,authority:humanAuthorityRoundTrip}=selectHumanAuthorityReports(humanAuthorityReports);
for(const [name,reports] of [
  ['missing-authority',humanAuthorityReports.filter(row=>row!==humanAuthorityRoundTrip)],
  ['duplicate-authority',[...humanAuthorityReports,humanAuthorityRoundTrip]],
  ['missing-stage-save',humanAuthorityReports.filter(row=>row!==humanStageSave)]
]){let rejected=false;try{selectHumanAuthorityReports(reports);}catch(error){rejected=error.message.includes('HUMAN_AUTHORITY_REPORT_ORACLE');}assert(rejected,'HUMAN_AUTHORITY_REPORT_MUTATION_ORACLE: '+name+' was accepted.');}
assert(humanStageSave.humanStageSave==='PASS'&&humanStageSave.actualStoreAndReload===true&&humanAuthorityRoundTrip.humanAuthorityRoundTrip==='PASS'&&humanAuthorityRoundTrip.atomicCoAcceptanceStable===true&&humanAuthorityRoundTrip.unrelatedMutationFailsClosed===true&&humanAuthorityRoundTrip.returnedAttachmentNotRawInput===true,'Integrated Stage 01 human-authority regression did not report every repaired-path proof.');
console.log(JSON.stringify({stage01IntakeClosure:true,verificationObservations,artifactIdentityBound:true,currentManifestBound:true,incompleteAccountingRejected:true,missingInspectionClaimRejected:true,missingHandoffRejected:true,legacyCaptureRejected:true,missingPassOneRejected:true,missingPassTwoRejected:true,incompleteChallengeCategoriesRejected:true,humanAuthorityRoundTripIntegrated:true,fileChallengeCases,deliverableCompletionCases}));
