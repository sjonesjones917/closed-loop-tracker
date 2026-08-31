import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const prompts=globalThis.closedLoopPromptEngine;
const ingestion=globalThis.closedLoopResponseIngestion;
const hash=globalThis.closedLoopHash;
const assert=(value,message)=>{if(!value)throw new Error(message);};

const project=core.createBlankState('JOB-STAGE01-CLOSURE');
Object.assign(project.job,{
  JOB_TITLE:'Intake closure',
  JOB_OWNER:'Operator',
  EXACT_USER_OBJECTIVE_VERBATIM:'Build the exact requested product from the complete supplied intent.',
  SUPPLIED_MATERIALS_INVENTORY:'intent.txt',
  REQUIRED_OUTPUT_FORMAT:'Exact requested artifacts',
  PROHIBITED_ACTIONS:'Do not discard supplied intent or make the user provide it twice.',
  EXPLICIT_USER_REQUIREMENTS:'Capture every supplied requirement exactly and preserve it for downstream reuse.',
  CURRENT_INPUT_VERSION:'INPUT-v001'
});
engine.ensureShape(project);
engine.registerArtifactBytes(project,{
  stage:1,
  artifactId:'ARTIFACT-INTENT-001',
  filename:'intent.txt',
  mediaType:'text/plain',
  byteSize:42,
  sha256:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  role:'HUMAN_INPUT'
});

const manifest=engine.intakeCoverageManifest(project);
assert(manifest.units.some(unit=>unit.kind==='SUPPLIED_MATERIAL'&&unit.artifactId==='ARTIFACT-INTENT-001'),'Stage 01 intake manifest does not bind the supplied artifact identity.');
assert(manifest.units.some(unit=>unit.sourceLocation==='job.EXACT_USER_OBJECTIVE_VERBATIM'),'Stage 01 intake manifest omitted the verbatim objective.');

const prompt={...prompts.buildPromptRecord(1,project,{operation:'COMPLETE'}),generatedAt:new Date().toISOString()};
project.projectData.generatedPrompts.push(prompt);
for(const unit of manifest.units)assert(prompt.prompt.includes(unit.unitId),`Stage 01 prompt omitted controlled input unit ${unit.unitId}.`);
assert(prompt.prompt.includes('STAGE 01 HUMAN CONVERSATION — THIS OCCURS BEFORE ANY FINAL JSON'),'Stage 01 prompt omitted the human conversation sequence.');
assert(prompt.prompt.indexOf('STAGE 01 HUMAN CONVERSATION')<prompt.prompt.indexOf('STRICT RESPONSE CONTRACT'),'Stage 01 machine contract appears before the human conversation.');
assert(prompt.prompt.includes('intent.txt')&&prompt.prompt.includes('ask the human in plain language to attach or provide the exact named material now'),'Stage 01 prompt does not request the named file when the external conversation lacks its bytes.');
assert(prompt.prompt.includes('Classify every APPLICATION INTAKE MANIFEST unit exactly once'),'Stage 01 prompt does not command exhaustive accounting.');
assert(prompt.prompt.includes('INPUT_SET_CONTENTS must preserve the complete durable meaning needed by later stages'),'Stage 01 prompt does not preserve intake for downstream reuse.');
assert(!Object.prototype.hasOwnProperty.call(schema.RECORD_SCHEMAS,'intentStatements'),'Stage 01 reintroduced a redundant second intent registry.');

const capture={
  schema:'closed-loop-stage01-capture/1',
  inputVersion:manifest.inputVersion,
  manifestSha256:manifest.manifestSha256,
  units:manifest.units.map((unit,index)=>({
    sourceUnitId:unit.unitId,
    sourceRawValueSha256:unit.rawValueSha256,
    disposition:'incorporated into the job definition',
    reason:'Captured once as current project authority.',
    extractedStatements:[{
      statementKey:`statement-${String(index+1).padStart(3,'0')}`,
      text:unit.rawValueText,
      statementClass:'REQUIREMENT'
    }]
  }))
};
const incomplete=structuredClone(capture);
incomplete.units.pop();
assert(!engine.evaluateIntakeAccounting(project,{capture:JSON.stringify(incomplete)}).complete,'Stage 01 accepted incomplete intake accounting.');
assert(engine.evaluateIntakeAccounting(project,{capture:JSON.stringify(capture)}).complete,'Stage 01 rejected complete intake accounting.');

const envelope=captured=>({
  schema:schema.RESPONSE_SCHEMA,
  jobId:project.job.JOB_ID,
  stage:1,
  operation:'COMPLETE',
  promptIdentity:{
    instructionId:prompt.instructionId,
    bodySha256:prompt.bodySha256,
    contractSha256:prompt.contractSha256,
    contextSignature:prompt.contextSignature
  },
  scope:prompt.scope,
  responseType:'DATA_PROPOSAL',
  humanInputRequests:[],
  stageData:{
    EXACT_DELIVERABLE_REQUESTED:'The exact requested product implementing the complete captured intent.',
    ASSUMPTIONS:'NONE',
    UNKNOWN_INFORMATION:'NONE',
    INPUT_SET_CONTENTS:JSON.stringify(captured)
  },
  records:{},
  evidence:[{
    temporaryKey:'evidence-1',
    kind:'INTAKE',
    description:'Stage 01 intake capture',
    authorityType:'AGENT_CLAIM',
    location:'response',
    content:'The structured capture accounts for every current input unit.'
  }],
  unresolved:[],
  warnings:[],
  attachments:[]
});

let validation=ingestion.validateEnvelope(project,envelope(incomplete),{stage:1,promptRecord:prompt,rawSha256:hash.sha256Value(envelope(incomplete)),files:[]});
assert(validation.issues.some(issue=>issue.code==='INCOMPLETE_INTAKE_ACCOUNTING'),'Ingestion accepted incomplete Stage 01 accounting.');
validation=ingestion.validateEnvelope(project,envelope(capture),{stage:1,promptRecord:prompt,rawSha256:hash.sha256Value(envelope(capture)),files:[]});
assert(!validation.issues.some(issue=>issue.code==='INCOMPLETE_INTAKE_ACCOUNTING'),'Ingestion rejected repaired Stage 01 accounting.');

console.log(JSON.stringify({
  stage01ConversationFirst:true,
  suppliedArtifactIdentityBound:true,
  canonicalCaptureOnly:true,
  incompleteAccountingRejected:true,
  completeAccountingAccepted:true,
  downstreamReuseRequired:true
},null,2));
