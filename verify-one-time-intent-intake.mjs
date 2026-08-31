import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=closedLoopCore,engine=closedLoopWorkflowEngine,prompts=closedLoopPromptEngine;
const check=(value,message)=>{if(!value)throw new Error(message);};

const project=core.createBlankState('JOB-ONE-TIME-INTAKE');
Object.assign(project.job,{
  JOB_ID:'JOB-ONE-TIME-INTAKE',
  EXACT_USER_OBJECTIVE_VERBATIM:'Create the finished product from the supplied intent without asking me to repeat it.',
  SUPPLIED_MATERIALS_INVENTORY:'intent.txt',
  REQUIRED_OUTPUT_FORMAT:'Finished product',
  EXPLICIT_USER_REQUIREMENTS:'The prompt box must retain its established dimensions. Project information is supplied once and remains available to every later stage.',
  CURRENT_INPUT_VERSION:'INPUT-v001',
  CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001',
  CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',
  CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001',
  CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-v001'
});
engine.ensureShape(project);
engine.recalculate(project);

const stage1Prompt=prompts.buildPromptRecord(1,project,{operation:'COMPLETE'});
const intake=stage1Prompt.contextManifest.intakeCoverageManifest;
check(intake.unitCount>0,'Stage 01 intake manifest is empty.');
check(stage1Prompt.prompt.includes('first semantic reader'),'Stage 01 does not identify the agent as the first semantic reader.');
check(stage1Prompt.prompt.includes('Pass 1 — exhaustive extraction'),'Stage 01 exhaustive extraction pass is missing.');
check(stage1Prompt.prompt.includes('Pass 2 — omission challenge'),'Stage 01 omission-challenge pass is missing.');
check(stage1Prompt.prompt.includes('FILES YOU MUST RECEIVE'),'Stage 01 exact file handoff is missing.');
check(stage1Prompt.prompt.includes('intent.txt'),'Stage 01 handoff does not identify the supplied file.');

project.stages[1].agentData={
  EXACT_DELIVERABLE_REQUESTED:'The requested finished product.',
  ASSUMPTIONS:'NONE',
  UNKNOWN_INFORMATION:'NONE',
  INPUT_SET_CONTENTS:JSON.stringify({
    schema:'closed-loop-stage01-capture/1',
    inputVersion:intake.inputVersion,
    manifestSha256:intake.manifestSha256,
    units:intake.units.map((unit,index)=>({
      sourceUnitId:unit.unitId,
      sourceRawValueSha256:unit.rawValueSha256,
      disposition:'incorporated into the job definition',
      reason:'Captured once for downstream reuse.',
      extractedStatements:[{
        statementKey:`S-${index+1}`,
        text:index===0?'The prompt box must retain its established dimensions.':(unit.rawValueText||`Captured ${unit.label}`),
        statementClass:index===0?'CONSTRAINT':'FACT'
      }]
    }))
  })
};
project.stages[1].status='COMPLETE';
project.stages[1].gate={complete:true,blocked:false,reasons:[]};

project.projectData.sources=[{
  id:'SOURCE-000001',stage:2,active:true,
  scope:{inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'},
  fields:{SOURCE_ID:'SOURCE-000001',TITLE:'Independent governing source',ISSUING_ORGANIZATION_OR_AUTHOR:'Independent authority',SOURCE_TYPE:'OFFICIAL_STANDARD',URL_REFERENCE:'https://example.invalid/source',CURRENT_VERSION:'CURRENT',APPLICABLE_YN:'YES',APPLICABILITY_SCOPE:'Project',CONTROLLING_WEIGHT:'CONTROLLING',INSPECTED_YN:'YES',INSPECTION_EVIDENCE:'Inspected',LOCAL_COPY_HASH:'NONE',SOURCE_SET_VERSION:'SOURCE-SET-v001'},
  relationships:{},evidenceRefs:[]
}];
project.projectData.research=[{
  id:'RESEARCH-000001',stage:3,active:true,
  scope:{inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'},
  fields:{
    RESEARCH_ID:'RESEARCH-000001',SOURCE_ID:'SOURCE-000001',PASS_NUMBER:2,
    EXACT_PORTION_EXAMINED:'Complete applicable source',
    MANDATORY_STATEMENTS:'External mandatory obligation retained from Stage 03.',
    RECOMMENDATIONS:'External recommendation retained from Stage 03.',
    OPTIONAL_PRACTICES:'NONE',EXAMPLES:'NONE',EXPLANATORY_MATERIAL:'NONE',
    PROHIBITIONS:'External prohibition retained from Stage 03.',EXCEPTIONS:'NONE',
    DEPENDENCIES:'NONE',APPLICABILITY_FACTS:'Applies to this project.',RESTRICTIONS:'NONE',
    INVALIDATING_MATERIAL:'NONE',FINDING_CLASSIFICATION:'COMPLETE',SOURCE_EVIDENCE:'SOURCE-000001 complete review',SATURATION_STATUS:'SATURATED'
  },
  relationships:{SOURCE_ID:'SOURCE-000001'},evidenceRefs:[]
}];
project.projectData.candidateRequirements=[{
  id:'CANDIDATE-REQ-000001',stage:3,active:true,
  scope:{inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'},
  fields:{CANDIDATE_REQ_ID:'CANDIDATE-REQ-000001',SOURCE_ID:'SOURCE-000001',SOURCE_LOCATION:'Applicable section',CANDIDATE_OBLIGATION:'Candidate external obligation retained from Stage 03.',CLASSIFICATION:'MANDATORY',APPLICABILITY:'APPLICABLE',DEPENDENCIES:'NONE',EVIDENCE:'SOURCE-000001'},
  relationships:{SOURCE_ID:'SOURCE-000001'},evidenceRefs:[]
}];
project.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'APPLICABLE',KNOWN_CONTROLLING_SOURCES_EXAMINED:'TRUE',UNRESOLVED_CONTROLLING_CONFLICTS:'NONE'};
project.stages[2].status='COMPLETE';
project.stages[2].gate={complete:true,blocked:false,reasons:[]};
project.stages[3].agentData={
  ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:'TRUE',
  SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:'TRUE',
  LATEST_PASS_NUMBER:2,
  NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:'FALSE',
  RESEARCH_GAPS_AND_BLOCKERS:'NONE'
};
project.stages[3].status='COMPLETE';
project.stages[3].gate={complete:true,blocked:false,reasons:[]};

const stage3Prompt=prompts.buildPromptRecord(3,project,{operation:'COMPLETE'});
check(stage3Prompt.prompt.includes(project.job.EXACT_USER_OBJECTIVE_VERBATIM),'Stage 03 did not receive the current human objective.');
check(stage3Prompt.prompt.includes(project.stages[1].agentData.EXACT_DELIVERABLE_REQUESTED),'Stage 03 did not receive the accepted Stage 01 deliverable definition.');
check(/never ask the human to repeat available project facts/i.test(stage3Prompt.prompt),'Stage 03 permits repeated project-data entry.');
check(!stage3Prompt.prompt.includes('Attach or provide the original material with the Stage 04 instruction.'),'Stage 03 still tells the operator to resend the original intent file.');
check((stage3Prompt.contextManifest.readCollections.sources||[]).some(item=>item.id==='SOURCE-000001'),'Stage 03 prompt omitted the current source identity.');

const obligations=engine.obligationManifest(project);
const obligationText=obligations.items.map(item=>item.text);
for(const required of [
  'The prompt box must retain its established dimensions.',
  'Project information is supplied once and remains available to every later stage.',
  'External mandatory obligation retained from Stage 03.',
  'External recommendation retained from Stage 03.',
  'External prohibition retained from Stage 03.',
  'Candidate external obligation retained from Stage 03.'
])check(obligationText.includes(required),`Stage 04 obligation universe omitted: ${required}`);

const stage4Prompt=prompts.buildPromptRecord(4,project,{operation:'COMPLETE'});
const exhausted=stage4Prompt.contextManifest.stage4ExhaustedInputs;
check(exhausted.stage01AcceptedCapture.units.length===intake.unitCount,'Stage 04 did not receive every accepted Stage 01 intake unit.');
check(exhausted.stage03Research.length===1,'Stage 04 did not receive the complete current Stage 03 research set.');
check(exhausted.stage03CandidateRequirements.length===1,'Stage 04 did not receive the current Stage 03 candidate obligations.');
check(stage4Prompt.contextManifest.obligationManifest.manifestSha256===obligations.manifestSha256,'Stage 04 prompt is not bound to the current obligation manifest.');
check(stage4Prompt.prompt.includes('Do not ask the user to attach, restate, summarize, retype, or otherwise resupply any project information already captured.'),'Stage 04 permits repeated project-data entry.');
check(!stage4Prompt.prompt.includes('Attach or provide the original material'),'Stage 04 still tells the operator to resend the original intent file.');

console.log(JSON.stringify({
  oneTimeIntentIntake:'PASS',
  stage01InputUnits:intake.unitCount,
  stage03ReusesAcceptedIntake:true,
  stage04Obligations:obligations.items.length,
  stage04ReusesStage01AndStage03:true
}));
