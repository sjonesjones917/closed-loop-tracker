import {createVerifierRuntime} from './verifier-runtime.mjs';
import {stage02AcceptanceFixture,acceptPrerequisite,recordProposal} from './test-fixtures.mjs';
import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])createVerifierRuntime.loadScript(globalThis,fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const prompts=globalThis.closedLoopPromptEngine;
const ingestion=globalThis.closedLoopResponseIngestion;
const runtime={core,schema,engine,prompts,ingestion};
const assert=(value,message)=>{if(!value)throw new Error(message);};

// Stage 01 captures project authority once through the application-owned intake manifest and the
// accepted INPUT_SET_CONTENTS capture. It must not invent a second canonical intent registry.
assert(schema.STAGE_CONTRACTS[1].allowedStageData.includes('INPUT_SET_CONTENTS'),'Stage 01 cannot submit the durable intake capture.');
assert(!Object.prototype.hasOwnProperty.call(schema.RECORD_SCHEMAS,'intentStatements'),'A redundant intentStatements canonical registry was introduced.');

let project=core.createBlankState('JOB-ONE-TIME-INTENT');
Object.assign(project.job,{
  JOB_TITLE:'One-time intent proof',
  JOB_OWNER:'Human operator',
  EXACT_USER_OBJECTIVE_VERBATIM:'Build exactly what the intent file requires and never make the user supply the same project information twice.',
  SUPPLIED_MATERIALS_INVENTORY:'intent.txt',
  REQUIRED_OUTPUT_FORMAT:'Working application',
  EXPLICIT_USER_REQUIREMENTS:'Preserve every supplied project requirement. Stage 04 must reuse the complete Stage 01 and Stage 03 results.',
  PROHIBITED_ACTIONS:'Do not ask the user to reattach, restate, summarize, or retype captured project information.',
  CURRENT_INPUT_VERSION:'INPUT-v001',
  CURRENT_RESEARCH_VERSION:'RESEARCH-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001',DESIRED_SOURCE_COUNT:1
});
project.projectData.userEntered={
  productConstraint:'The prompt box must retain its established dimensions.',
  acceptance:{oneTimeSupply:'Project information is supplied once and remains available to every later stage.'}
};
engine.ensureShape(project);

const intake=engine.intakeCoverageManifest(project);
assert(intake.unitCount>=8,'The intake manifest did not enumerate the complete human-authority input.');
assert(intake.units.some(unit=>unit.sourceLocation==='job.EXACT_USER_OBJECTIVE_VERBATIM'),'The exact objective was omitted from the intake manifest.');
assert(intake.units.some(unit=>unit.sourceLocation.includes('projectData.userEntered.productConstraint')),'Original user-entered project data was omitted from the intake manifest.');
assert(intake.units.some(unit=>unit.sourceLocation.includes('projectData.userEntered.acceptance.oneTimeSupply')),'Nested user-entered acceptance data was omitted from the intake manifest.');

const capture={
  schema:'closed-loop-stage01-capture/2',
  inputVersion:intake.inputVersion,
  manifestSha256:intake.manifestSha256,pass1Completed:true,pass2OmissionChallenge:{completed:true,checkedCategories:['QUALIFIERS','EXCEPTIONS','DEPENDENCIES','NEGATIVE_REQUIREMENTS','DO_NOT_CHANGE','VISUAL_CONSTRAINTS','TEMPORAL_CONSTRAINTS','ACCEPTANCE_CONDITIONS','AUTHORITY_STATEMENTS','TOOL_RESTRICTIONS','FILE_REFERENCES','OUTPUT_FORMAT_REQUIREMENTS','CORRECTIONS','LATER_OVERRIDES'],omissionsFound:[],omissionsResolved:true},
  units:intake.units.map((unit,index)=>({
    sourceUnitId:unit.unitId,
    sourceRawValueSha256:unit.rawValueSha256,
    disposition:'EXTRACTED_RELEVANT_INFORMATION',
    reason:'Preserved once as controlling project authority for downstream reuse.',
    extractedStatements:[{
      statementKey:`statement-${String(index+1).padStart(3,'0')}`,
      text:unit.rawValueText,
      statementClass:'REQUIREMENT'
    }]
  }))
};
assert(engine.evaluateIntakeAccounting(project,{capture:JSON.stringify(capture)}).complete,'Complete one-time Stage 01 intake accounting did not close.');
const incompleteCapture=structuredClone(capture);
incompleteCapture.units.pop();
assert(!engine.evaluateIntakeAccounting(project,{capture:JSON.stringify(incompleteCapture)}).complete,'Stage 01 accepted an intake capture that forgot supplied project information.');
const inputVersionBeforeStage1Acceptance=project.job.CURRENT_INPUT_VERSION;
assert(engine.registerStageVersion(project,1,'CHANGE-STAGE1-INTERPRETATION')===null,'Stage 01 agent acceptance created a second input-version artifact.');
assert(project.job.CURRENT_INPUT_VERSION===inputVersionBeforeStage1Acceptance,'Stage 01 agent acceptance changed the User Job Input version and invalidated the one-time intake capture.');

const acceptedStage1Data={
  EXACT_DELIVERABLE_REQUESTED:'A working application conforming to every captured project requirement.',
  ASSUMPTIONS:'NONE',
  UNKNOWN_INFORMATION:'NONE',
  INPUT_SET_CONTENTS:JSON.stringify(capture)
};

// Inspect the pre-acceptance instruction while the intake manifest above is the
// exact application-generated authority. The accepted route below uses the same
// bytes through reservation, response ingestion, operator acceptance and the
// application-owned Stage 1 confirmation.
const stage1Prompt=prompts.buildPromptRecord(1,project,{operation:'COMPLETE'});
assert(stage1Prompt.prompt.includes('The user supplies project information once'),'Stage 01 does not instruct the agent to capture project information once.');
assert(stage1Prompt.prompt.includes('Classify every APPLICATION INTAKE MANIFEST unit exactly once'),'Stage 01 does not require exhaustive application-accounted intake.');
assert(stage1Prompt.prompt.includes('INPUT_SET_CONTENTS must preserve the complete durable meaning needed by later stages'),'Stage 01 does not require a durable downstream capture.');
assert(stage1Prompt.contextManifest.intakeCoverageManifest.manifestSha256===intake.manifestSha256,'Stage 01 prompt is not bound to the current intake manifest.');

const sourceProposal=(tempKey,title)=>recordProposal(schema,'sources',{tempKey,overrides:{
  TITLE:title,
  ISSUING_ORGANIZATION_OR_AUTHOR:'Independent synthetic fixture authority',
  SOURCE_TYPE:'PUBLIC_WEBSITE',
  PUBLICATION_ORIGIN:'Independent authority fixture publication',
  URL_REFERENCE:`https://example.invalid/${tempKey}`,
  AUTHORITY_LEVEL:'Controlling within the synthetic fixture',
  AUTHORITY_ROLE:'Governing synthetic condition',
  RELEVANCE:'Supplies the declared external fixture obligation.',
  APPLICABLE_PORTIONS:'Complete controlled source',
  INSPECTION_STATUS:'INSPECTED',
  CURRENCY_STATUS:'CURRENT',
  SUPERSESSION_STATUS:'NOT_SUPERSEDED',
  CONTROLLING_STATE:'CONTROLLING'
}});
project=stage02AcceptanceFixture(runtime,project.job.JOB_ID,{project,stageData:acceptedStage1Data,sources:[
  sourceProposal('source-one','Controlling external source'),
  sourceProposal('source-two','Second discovered controlling source')
]});
const acceptedSources=engine.recordsForCurrentScope(project,'sources');
assert(acceptedSources.length===2,'The legitimate Stage 02 route did not accept both discovered sources.');
const sourceByTitle=new Map(acceptedSources.map(row=>[engine.recordValue(row,'TITLE'),engine.recordId(row,'sources')]));
const sourceOneId=sourceByTitle.get('Controlling external source'),sourceTwoId=sourceByTitle.get('Second discovered controlling source');
assert(sourceOneId&&sourceTwoId&&sourceOneId!==sourceTwoId,'Application-issued source identities are incomplete or duplicated.');
assert(project.job.DESIRED_SOURCE_COUNT===1,'Stage 02 acceptance changed the human source-count preference.');

const researchProposal=(tempKey,sourceId,{mandatory,recommendations='NONE',prohibitions='NONE'}={})=>recordProposal(schema,'research',{tempKey,relationships:{SOURCE_ID:{recordId:sourceId}},overrides:{
  PASS_NUMBER:'2',
  EXACT_PORTION_EXAMINED:'Complete applicable source',
  MANDATORY_STATEMENTS:mandatory,
  RECOMMENDATIONS:recommendations,
  OPTIONAL_PRACTICES:'NONE',EXAMPLES:'NONE',EXPLANATORY_MATERIAL:'NONE',
  PROHIBITIONS:prohibitions,EXCEPTIONS:'NONE',DEPENDENCIES:'NONE',
  APPLICABILITY_FACTS:'Applies to this project.',RESTRICTIONS:'NONE',INVALIDATING_MATERIAL:'NONE',
  FINDING_CLASSIFICATION:'SECOND_COMPLETE_PASS_SATURATED',SOURCE_EVIDENCE:`${sourceId} complete review`,SATURATION_STATUS:'SATURATED'
}});
project=acceptPrerequisite(runtime,project,3,{stageData:{
  SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:true,
  LATEST_PASS_NUMBER:2,
  NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:false,
  RESEARCH_GAPS_AND_BLOCKERS:'NONE',
  EXCEPTIONS_AND_EDGE_CONDITIONS:'NONE',
  CONFLICTING_OR_INVALIDATING_MATERIAL:'NONE'
},records:{
  research:[
    researchProposal('research-one',sourceOneId,{mandatory:'External mandatory obligation retained from Stage 03.',recommendations:'External recommendation retained from Stage 03.',prohibitions:'External prohibition retained from Stage 03.'}),
    researchProposal('research-two',sourceTwoId,{mandatory:'Second discovered source obligation.'})
  ],
  candidateRequirements:[recordProposal(schema,'candidateRequirements',{tempKey:'candidate-one',relationships:{SOURCE_ID:{recordId:sourceOneId}},overrides:{
    SOURCE_LOCATION:'Applicable section',CANDIDATE_OBLIGATION:'Candidate external obligation retained from Stage 03.',CLASSIFICATION:'MANDATORY',APPLICABILITY:'APPLICABLE',DEPENDENCIES:'NONE',EVIDENCE:sourceOneId
  }})]
}}).project;
for(const stage of [1,2,3])assert(engine.gate(stage,project).complete,`Legitimate prerequisite Stage ${stage} did not complete: ${engine.gate(stage,project).reasons.join(' | ')}`);
assert(engine.recordsForCurrentScope(project,'research').length===2,'The legitimate Stage 03 route did not accept both source reviews.');
assert(engine.recordsForCurrentScope(project,'candidateRequirements').length===1,'The legitimate Stage 03 route did not accept its candidate requirement.');

const stage3Prompt=prompts.buildPromptRecord(3,project,{operation:'COMPLETE'});
assert(stage3Prompt.prompt.includes(project.job.EXACT_USER_OBJECTIVE_VERBATIM),'Stage 03 did not receive the current human objective.');
assert(stage3Prompt.prompt.includes(project.stages[1].agentData.EXACT_DELIVERABLE_REQUESTED),'Stage 03 did not receive the accepted Stage 01 deliverable definition.');
assert(/never ask the (?:human|user) to repeat available project facts/i.test(stage3Prompt.prompt),'Stage 03 permits repeated project-data entry.');
assert(!stage3Prompt.prompt.includes('Attach or provide the original material with the Stage 04 instruction.'),'Stage 03 still tells the operator to resend the original intent file.');
assert((stage3Prompt.contextManifest.readCollections.sources||[]).some(item=>item.id===sourceOneId),'Stage 03 prompt omitted the current source identity.');

const obligations=engine.obligationManifest(project);
const obligationText=obligations.items.map(item=>item.text);
for(const required of [
  'The prompt box must retain its established dimensions.',
  'Project information is supplied once and remains available to every later stage.',
  'External mandatory obligation retained from Stage 03.',
  'External recommendation retained from Stage 03.',
  'External prohibition retained from Stage 03.',
  'Candidate external obligation retained from Stage 03.',
  'Second discovered source obligation.'
])assert(obligationText.includes(required),`Stage 04 obligation universe omitted: ${required}`);

const stage4Prompt=prompts.buildPromptRecord(4,project,{operation:'COMPLETE'});
const exhausted=stage4Prompt.contextManifest.stage4ExhaustedInputs;
assert(exhausted.stage01AcceptedCapture.units.length===intake.unitCount,'Stage 04 did not receive every accepted Stage 01 intake unit.');
assert(exhausted.stage03Research.length===2,'Stage 04 did not receive the complete current Stage 03 research set.');
assert(exhausted.stage03CandidateRequirements.length===1,'Stage 04 did not receive the current Stage 03 candidate obligations.');
assert(stage4Prompt.contextManifest.obligationManifest.manifestSha256===obligations.manifestSha256,'Stage 04 prompt is not bound to the current obligation manifest.');
assert(stage4Prompt.prompt.includes('Do not ask the user to attach, restate, summarize, retype, or otherwise resupply any project information already captured.'),'Stage 04 permits repeated project-data entry.');
assert(stage4Prompt.prompt.includes('Do not attach or resend the original intent file.'),'Stage 04 does not prohibit repeat intent-file transfer.');
assert(stage4Prompt.prompt.includes('The prompt box must retain its established dimensions.'),'Stage 04 prompt omitted captured Stage 01 project detail.');
assert(stage4Prompt.prompt.includes('External mandatory obligation retained from Stage 03.'),'Stage 04 prompt omitted Stage 03 research detail.');
assert(stage4Prompt.contextManifest.executionHandoff.send.length===0,'Stage 04 generated a repeat file-transfer handoff.');
assert(stage4Prompt.contextManifest.executionHandoff.withhold.length===0,'Stage 04 turned the original intent file into a later transfer item.');

// A human source-count preference is never a quota. Both sources above were
// accepted through the same Stage 02 route while DESIRED_SOURCE_COUNT remained
// one. Removing only the second source's current accepted research must block
// Stage 04; the untouched complete project is the repair control.
const sourceCountControl=structuredClone(project);
const secondResearch=engine.recordsForCurrentScope(sourceCountControl,'research').find(row=>row.relationships?.SOURCE_ID===sourceTwoId);
assert(secondResearch,'The second discovered source lost its accepted research relationship.');
secondResearch.invalidatedBy='CONTROL-MISSING-SECOND-SOURCE-RESEARCH';
let sourceCountBlocked=false;
try{prompts.buildPromptRecord(4,sourceCountControl,{operation:'COMPLETE'});}catch(error){sourceCountBlocked=error?.code==='STAGE4_UPSTREAM_INCOMPLETE'&&/has not researched every current Stage 02 source/.test(error.message);}
assert(sourceCountBlocked,'DESIRED_SOURCE_COUNT excluded a discovered controlling source from required research coverage.');
assert(stage4Prompt.contextManifest.stage4ExhaustedInputs.stage03Research.length===2,'Complete accepted research for both discovered sources did not restore Stage 04 prompt generation.');
assert(project.job.DESIRED_SOURCE_COUNT===1&&engine.recordsForCurrentScope(project,'sources').length===2,'DESIRED_SOURCE_COUNT control did not retain its independent one-versus-two premise.');

// Independently reject a deliberate Stage 04 instruction regression that asks
// for accepted intent again. This checks behavior, not only current wording.
const repeatedRequest=/(?:^|[\n.!?]\s*)(?:you must |please )?ask the (?:user|human|operator) to (?:attach|resend|restate|summarize|retype|resupply|re-enter) (?:accepted |already captured )?(?:project information|intent|intent file)/i;
assert(!repeatedRequest.test(stage4Prompt.prompt),'Current Stage 04 prompt asks for accepted intent again.');
const promptSource=fs.readFileSync('prompt-engine.js','utf8'),repeatAnchor='Do not request, reopen, attach, resend, restate, summarize, or retype the original intent file or any project information already represented there.';
assert(promptSource.split(repeatAnchor).length===2,'ONE_TIME_INTENT_REPEAT_MUTANT_ANCHOR');
const mutantPromptSource=promptSource.replace(repeatAnchor,'Ask the user to retype accepted project information.');
const mutantRuntime=createVerifierRuntime({Event:class Event{constructor(type){this.type=type;}},dispatchEvent:()=>true});
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])createVerifierRuntime.loadScript(mutantRuntime,fs.readFileSync(file,'utf8'),{filename:file});
createVerifierRuntime.loadScript(mutantRuntime,mutantPromptSource,{filename:'prompt-engine.js:repeated-intent-mutant'});
const repeatedMutantPrompt=mutantRuntime.closedLoopPromptEngine.buildPromptRecord(4,mutantRuntime.structuredClone(project),{operation:'COMPLETE'});
assert(repeatedRequest.test(repeatedMutantPrompt.prompt),'Deliberate repeated-intent request mutation escaped the independent prompt oracle.');

const completeRecords=obligations.items.map((item,index)=>({tempKey:`requirement-${index+1}`,fields:{USER_INPUT_RELATIONSHIP:item.obligationId}}));
assert(engine.evaluateObligationAccounting(project,{envelope:{records:{requirements:completeRecords},evidence:[]}}).complete,'Complete Stage 04 obligation accounting did not close.');
assert(!engine.evaluateObligationAccounting(project,{envelope:{records:{requirements:completeRecords.slice(0,-1)},evidence:[]}}).complete,'Stage 04 accepted a result that forgot a captured obligation.');

console.log(JSON.stringify({
  oneTimeIntentCapture:true,
  intakeManifestComplete:true,
  stage03ReceivesCurrentProjectAuthority:true,
  stage04ReceivesAllStage01AndStage03Data:true,
  noRepeatIntentTransfer:true,
  incompleteDownstreamAccountingRejected:true,
  desiredSourceCountDoesNotExcludeDiscoveredSource:true,
  repeatedStage04IntentRequestMutantDetected:true
}));
