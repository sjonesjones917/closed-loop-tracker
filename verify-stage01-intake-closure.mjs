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
const assert=(value,message)=>{if(!value)throw new Error(message);};

assert(!Object.prototype.hasOwnProperty.call(schema.RECORD_SCHEMAS,'intentStatements'),'Stage 01 must not create a parallel semantic-intake registry.');

const project=core.createBlankState('JOB-STAGE01-CLOSURE');
Object.assign(project.job,{
  JOB_TITLE:'Intake closure',
  JOB_OWNER:'Operator',
  EXACT_USER_OBJECTIVE_VERBATIM:'Build the exact requested product.',
  SUPPLIED_MATERIALS_INVENTORY:'intent.txt',
  REQUIRED_OUTPUT_FORMAT:'Exact requested artifacts',
  PROHIBITED_ACTIONS:'Do not discard supplied intent.',
  EXPLICIT_USER_REQUIREMENTS:'Capture every supplied requirement exactly.',
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
assert(manifest.schema==='closed-loop-intake-manifest/1','Stage 01 uses the wrong application intake-manifest contract.');
assert(manifest.unitCount===manifest.units.length&&manifest.unitCount>0,'Stage 01 intake manifest count is not exact.');
const fileUnit=manifest.units.find(unit=>unit.kind==='SUPPLIED_MATERIAL'&&unit.artifactId==='ARTIFACT-INTENT-001');
assert(fileUnit,'Stage 01 intake manifest does not bind the supplied artifact identity.');
assert(fileUnit.filename==='intent.txt','Stage 01 intake manifest lost the exact supplied filename.');
assert(fileUnit.artifactSha256==='a'.repeat(64),'Stage 01 intake manifest lost the application-computed artifact hash.');
assert(fileUnit.availability==='BYTES_PERSISTED_AND_VERIFIED','Stage 01 intake manifest does not state verified byte availability.');

const promptRecord={...prompts.buildPromptRecord(1,project,{operation:'COMPLETE'}),generatedAt:new Date().toISOString()};
project.projectData.generatedPrompts.push(promptRecord);
for(const unit of manifest.units)assert(promptRecord.prompt.includes(unit.unitId),`Stage 01 prompt omitted controlled input unit ${unit.unitId}.`);
for(const required of [
  'first semantic reader',
  'PASS 1 — EXHAUSTIVE EXTRACTION',
  'PASS 2 — OMISSION CHALLENGE',
  'FILES YOU MUST RECEIVE',
  'ARTIFACT-INTENT-001',
  'intent.txt',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'EXTRACTED_RELEVANT_INFORMATION',
  'RETAINED_AS_CONTEXT',
  'NO_PROJECT_RELEVANT_INFORMATION',
  'UNRESOLVED_HUMAN_AUTHORITY',
  'LATER_RESOLVABLE',
  'INACCESSIBLE_OR_BLOCKED'
])assert(promptRecord.prompt.includes(required),`Stage 01 prompt omitted controlling requirement: ${required}`);
assert(!promptRecord.prompt.includes('CUSTOM_PIPELINE'),'Stage 01 prompt still contains the prohibited CUSTOM_PIPELINE runtime concept.');

const captureFor=units=>({
  schema:'closed-loop-stage01-capture/1',
  inputVersion:manifest.inputVersion,
  manifestSha256:manifest.manifestSha256,
  units:units.map((unit,index)=>({
    sourceUnitId:unit.unitId,
    sourceRawValueSha256:unit.rawValueSha256,
    inspectionStatus:unit.kind==='SUPPLIED_MATERIAL'?'INSPECTED':'NOT_APPLICABLE',
    disposition:'EXTRACTED_RELEVANT_INFORMATION',
    reason:'',
    extractedStatements:[{
      statementKey:`STATEMENT-${String(index+1).padStart(3,'0')}`,
      text:unit.kind==='SUPPLIED_MATERIAL'?'The supplied intent file requires the exact requested product.':unit.rawValueText,
      statementClass:unit.kind==='SUPPLIED_MATERIAL'?'REQUIREMENT':'CONTEXT',
      sourceLocation:unit.kind==='SUPPLIED_MATERIAL'?'intent.txt:complete file':unit.sourceLocation
    }]
  }))
});
const envelopeFor=capture=>({
  schema:schema.RESPONSE_SCHEMA,
  jobId:project.job.JOB_ID,
  stage:1,
  operation:promptRecord.operation,
  promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},
  scope:promptRecord.scope,
  responseType:'DATA_PROPOSAL',
  humanInputRequests:[],
  stageData:{
    EXACT_DELIVERABLE_REQUESTED:'Exact requested product',
    ASSUMPTIONS:'NONE',
    UNKNOWN_INFORMATION:'NONE',
    INPUT_SET_CONTENTS:JSON.stringify(capture)
  },
  records:{},
  evidence:[{temporaryKey:'evidence-1',kind:'STAGE01_INTAKE',description:'Complete Stage 01 extraction and omission challenge.',location:'Stage 01 response',content:'Every application intake unit was inspected or read, mapped, and omission-challenged.'}],
  unresolved:[],warnings:[],attachments:[]
});

const completeCapture=captureFor(manifest.units);
const missingCapture=structuredClone(completeCapture);missingCapture.units.pop();
let prepared=ingestion.prepare(project,{stage:1,text:JSON.stringify(envelopeFor(missingCapture)),promptRecord});
assert(!prepared.validation.valid&&prepared.validation.issues.some(issue=>issue.code==='INCOMPLETE_INTAKE_ACCOUNTING'),'Stage 01 accepted incomplete raw-input accounting.');
assert(prepared.project.projectData.acceptedChanges.length===0,'Incomplete Stage 01 accounting partially mutated canonical state.');

const uninspectedCapture=structuredClone(completeCapture);
const uninspectedUnit=uninspectedCapture.units.find(unit=>unit.sourceUnitId===fileUnit.unitId);
uninspectedUnit.inspectionStatus='NOT_INSPECTED';
prepared=ingestion.prepare(project,{stage:1,text:JSON.stringify(envelopeFor(uninspectedCapture)),promptRecord});
assert(!prepared.validation.valid&&prepared.validation.issues.some(issue=>issue.code==='INCOMPLETE_INTAKE_ACCOUNTING'&&/inspect/i.test(issue.message)),'Stage 01 accepted an available supplied file that was not inspected.');
assert(prepared.project.projectData.acceptedChanges.length===0,'Uninspected Stage 01 file partially mutated canonical state.');

prepared=ingestion.prepare(project,{stage:1,text:JSON.stringify(envelopeFor(completeCapture)),promptRecord});
assert(prepared.validation.valid,`Stage 01 complete intake closure was rejected: ${JSON.stringify(prepared.validation.issues)}`);
assert(prepared.proposal?.status==='PENDING_OPERATOR_REVIEW','Valid Stage 01 intake did not create a pending review proposal.');
assert(prepared.project.projectData.acceptedChanges.length===0,'Stage 01 mutated canonical state before operator acceptance.');

const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'STAGE01-REGRESSION-OPERATOR',reviewNote:'Accepted only after complete first-reader intake accounting.'}).project;
assert(committed.projectData.acceptedChanges.length===1,'Accepted Stage 01 intake did not create exactly one canonical change.');
assert(engine.evaluateIntakeAccounting(committed).complete,'Accepted Stage 01 intake is not complete after canonical commit.');
const reloaded=JSON.parse(JSON.stringify(committed));engine.ensureShape(reloaded);
assert(engine.evaluateIntakeAccounting(reloaded).complete,'Accepted Stage 01 intake did not survive reload.');
assert(reloaded.projectData.rawResponses.at(-1)?.completeRawResponse===JSON.stringify(envelopeFor(completeCapture)),'Exact Stage 01 raw response did not survive reload.');

console.log(JSON.stringify({
  currentIntakeManifest:true,
  firstSemanticReader:true,
  twoPassOmissionChallenge:true,
  exactFileHandoff:true,
  exactDispositionContract:true,
  incompleteAccountingRejected:true,
  uninspectedFileRejected:true,
  noPartialMutation:true,
  acceptedCapturePersists:true,
  noParallelIntentRegistry:true
}));
