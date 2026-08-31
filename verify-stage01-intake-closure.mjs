import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion,hash=globalThis.closedLoopHash;
const assert=(value,message)=>{if(!value)throw new Error(message);};

const p=core.createBlankState('JOB-STAGE01-CLOSURE');
Object.assign(p.job,{
  JOB_TITLE:'Intake closure',
  JOB_OWNER:'Operator',
  EXACT_USER_OBJECTIVE_VERBATIM:'Build the exact requested product.',
  SUPPLIED_MATERIALS_INVENTORY:'intent.txt',
  REQUIRED_OUTPUT_FORMAT:'Exact requested artifacts',
  PROHIBITED_ACTIONS:'Do not discard supplied intent.',
  EXPLICIT_USER_REQUIREMENTS:'Capture every supplied requirement exactly.',
  CURRENT_INPUT_VERSION:'INPUT-v001'
});
engine.ensureShape(p);
engine.registerArtifactBytes(p,{stage:1,artifactId:'ARTIFACT-INTENT-001',filename:'intent.txt',mediaType:'text/plain',byteSize:42,sha256:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',role:'HUMAN_INPUT'});
p.stages[1].authorizedFiles.push({artifactId:'ARTIFACT-INTENT-001',name:'intent.txt',type:'text/plain',size:42,sha256:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',stage:'STAGE 01',role:'HUMAN_INPUT',retainedBytes:true});

const manifest=engine.intakeCoverageManifest(p);
assert(manifest.unitCount===manifest.units.length&&manifest.unitCount>0,'Stage 01 intake manifest is not closed and countable.');
const artifactUnit=manifest.units.find(unit=>JSON.stringify(unit).includes('ARTIFACT-INTENT-001'));
assert(artifactUnit,'Stage 01 intake manifest does not bind the supplied artifact identity.');

const prompt={...prompts.buildPromptRecord(1,p,{operation:'COMPLETE'}),generatedAt:new Date().toISOString()};
p.projectData.generatedPrompts.push(prompt);
for(const unit of manifest.units)assert(prompt.prompt.includes(unit.unitId),`Prompt 01 omitted ${unit.unitId}.`);
assert(prompt.prompt.includes('ARTIFACT-INTENT-001')&&prompt.prompt.includes('intent.txt'),'Prompt 01 does not identify the exact stored artifact for transfer.');
assert(JSON.stringify(prompt.contextManifest.executionHandoff||{}).includes('ARTIFACT-INTENT-001'),'Stage 01 execution handoff is not bound to the stored artifact identity.');
assert(!prompt.prompt.includes('EXECUTABLE_KIND = CUSTOM_PIPELINE'),'Prompt still contains obsolete CUSTOM_PIPELINE instruction.');

const captureFrom=units=>({
  schema:'closed-loop-stage01-capture/1',
  inputVersion:manifest.inputVersion,
  manifestSha256:manifest.manifestSha256,
  units:units.map((unit,index)=>({
    sourceUnitId:unit.unitId,
    sourceRawValueSha256:unit.rawValueSha256,
    disposition:'extracted relevant information',
    reason:'Inspected and preserved for downstream reuse.',
    extractedStatements:[{
      statementKey:`statement-${String(index+1).padStart(3,'0')}`,
      text:unit.rawValueText||`Inspected ${unit.unitId}`,
      statementClass:'FACT'
    }]
  }))
});
const completeCapture=captureFrom(manifest.units);
assert(engine.evaluateIntakeAccounting(p,{capture:JSON.stringify(completeCapture)}).complete,'Complete Stage 01 intake accounting did not close.');
const missingArtifactCapture=captureFrom(manifest.units.filter(unit=>unit.unitId!==artifactUnit.unitId));
assert(!engine.evaluateIntakeAccounting(p,{capture:JSON.stringify(missingArtifactCapture)}).complete,'Stage 01 accepted intake accounting that omitted the supplied artifact unit.');

const envelope=capture=>({
  schema:schema.RESPONSE_SCHEMA,
  jobId:p.job.JOB_ID,
  stage:1,
  operation:prompt.operation,
  promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},
  scope:prompt.scope,
  responseType:'DATA_PROPOSAL',
  humanInputRequests:[],
  stageData:{EXACT_DELIVERABLE_REQUESTED:'Exact requested product',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture)},
  records:{},
  evidence:[{temporaryKey:'evidence-1',kind:'INTAKE',description:'Stage 01 semantic intake evidence',authorityType:'AGENT_CLAIM',location:'Stage 01 response',content:'Complete semantic intake'}],
  unresolved:[],warnings:[],attachments:[]
});
let validation=ingestion.validateEnvelope(p,envelope(missingArtifactCapture),{stage:1,promptRecord:prompt,rawSha256:hash.sha256Value(envelope(missingArtifactCapture)),files:[]});
assert(validation.issues.some(issue=>issue.code==='INCOMPLETE_INTAKE_ACCOUNTING'),'Stage 01 ingestion accepted a response that omitted the supplied artifact unit.');
validation=ingestion.validateEnvelope(p,envelope(completeCapture),{stage:1,promptRecord:prompt,rawSha256:hash.sha256Value(envelope(completeCapture)),files:[]});
assert(!validation.issues.some(issue=>issue.code==='INCOMPLETE_INTAKE_ACCOUNTING'),'Stage 01 ingestion rejected complete current intake accounting.');

console.log(JSON.stringify({stage01IntakeClosure:'PASS',rawUnits:manifest.unitCount,artifactBound:true,artifactHandoff:true,omittedArtifactRejected:true}));
