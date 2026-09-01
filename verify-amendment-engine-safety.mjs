import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,hash=globalThis.closedLoopHash;
const project=core.createBlankState('AMENDMENT-SAFETY');
project.job.EXACT_USER_OBJECTIVE_VERBATIM='Inspect every current input exactly once.';
engine.ensureShape(project);
engine.recalculate(project);
const scope={...engine.currentScope(project)};
const artifact={id:'ARTIFACT-INTAKE-1',stage:1,active:true,scope,source:'APPLICATION_ARTIFACT_INTAKE',fields:{ARTIFACT_ID:'ARTIFACT-INTAKE-1',FILENAME:'intent.txt',TYPE:'text/plain',VERSION:'1',BYTE_SIZE:6,SHA256:'a'.repeat(64),ROLE:'USER_INPUT',STORAGE_REFERENCE:'indexeddb:ARTIFACT-INTAKE-1',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED',NOTES:''}};
artifact.contentSha256=hash.contentRecordSha256(artifact,'ARTIFACT_ID');artifact.recordSha256=hash.recordSha256(artifact);artifact.sha256=artifact.recordSha256;project.projectData.artifacts.push(artifact);
const manifest=engine.intakeCoverageManifest(project);
const capture={schema:'closed-loop-stage01-capture/1',inputVersion:manifest.inputVersion,manifestSha256:manifest.manifestSha256,units:manifest.units.map((unit,index)=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:'EXTRACTED_RELEVANT_INFORMATION',reason:'Current controlled intake.',...(unit.kind==='SUPPLIED_MATERIAL'?{artifactInspection:{artifactId:unit.artifactId,artifactSha256:unit.artifactSha256,inspectedActualBytes:true}}:{}),extractedStatements:[{statementKey:`S-${index+1}`,text:unit.rawValueText||unit.label,statementClass:unit.kind==='SUPPLIED_MATERIAL'?'MATERIAL_REFERENCE':'REQUIREMENT',sourceLocations:[{kind:'OTHER',value:unit.sourceLocation}]}]}))};
assert.equal(engine.evaluateIntakeAccounting(project,{capture}).complete,true,'Exact current /3 intake capture was rejected.');
const legacy=structuredClone(capture);legacy.units[0].disposition='retained as context';assert.equal(engine.evaluateIntakeAccounting(project,{capture:legacy}).complete,false,'Legacy lowercase /2 intake disposition satisfied current /3 accounting.');
const noLocation=structuredClone(capture);delete noLocation.units[0].extractedStatements[0].sourceLocations;assert.equal(engine.evaluateIntakeAccounting(project,{capture:noLocation}).complete,false,'An extracted statement without sourceLocations satisfied current intake accounting.');
const wrongArtifact=structuredClone(capture),material=wrongArtifact.units.find(unit=>unit.artifactInspection);material.artifactInspection.artifactSha256='b'.repeat(64);assert.equal(engine.evaluateIntakeAccounting(project,{capture:wrongArtifact}).complete,false,'A supplied-material inspection with the wrong application hash satisfied current intake accounting.');

const unsafe=engine.evaluateProofExpression(project,'PROPOSITION-1',{type:'LEAF',testId:'TEST-1',arbitraryJavaScript:'return true'});assert.equal(unsafe.truthValue,'UNKNOWN');assert.match(unsafe.reason,/Unknown LEAF properties/);
assert.equal(engine.terminalPrerequisites(project).complete,false,'Empty Stage 27-30 records bypassed terminal delivery prerequisites.');
assert.throws(()=>engine.verifyArtifactIdentity(project,[{artifactId:'MISSING',filename:'x',size:1,sha256:'a'.repeat(64)}],[{artifactId:'MISSING',filename:'x',size:1,sha256:'a'.repeat(64)}]),/Stage 27|eligible/i);

const reservationProject=core.createBlankState('RESERVATION-BINDING');engine.ensureShape(reservationProject);engine.recalculate(reservationProject);const reservation=engine.reserveOperation(reservationProject,{stage:4,operation:'COMPLETE',targetSlot:'PRIMARY',scope:engine.currentScope(reservationProject),owningTabInstance:'TAB-A',payload:{manifest:'current'}}),reservationId=engine.recordId(reservation,'operationReservations'),promptScope={...engine.recordValue(reservation,'SCOPE'),projectRevision:Number(reservationProject.revision)+1},promptId='INSTRUCTION-RESERVATION-1';reservationProject.projectData.generatedPrompts.push({instructionId:promptId,promptId,stage:4,operation:'COMPLETE',scope:promptScope,scopeSha256:hash.sha256Value(promptScope),bodySha256:'1'.repeat(64),contractSha256:'2'.repeat(64),contextSignature:'3'.repeat(64)});const bound=engine.bindOperationReservation(reservationProject,{reservationId,promptId,packageId:null});assert.equal(engine.recordValue(bound,'PROMPT_ID'),promptId);assert.match(engine.recordValue(bound,'BINDING_RECEIPT_SHA256'),/^[a-f0-9]{64}$/);const receiptCount=reservationProject.projectData.commandReceipts.length;assert.equal(engine.bindOperationReservation(reservationProject,{reservationId,promptId,packageId:null}),bound);assert.equal(reservationProject.projectData.commandReceipts.length,receiptCount,'Exact binding retry created a duplicate receipt.');assert.throws(()=>engine.bindOperationReservation(reservationProject,{reservationId,promptId,packageId:'PACKAGE-NOT-ALLOWED'}),/packageId|package identity/i);
assert.throws(()=>engine.reserveOperation(core.createBlankState('PACKAGE-REQUIRED'),{stage:11,operation:'COMPLETE',targetSlot:'RUN-1'}),/package identity/i);

console.log(JSON.stringify({strictIntake:true,legacyDispositionRejected:true,artifactInspectionBound:true,proofAstClosed:true,terminalFailClosed:true,reservationBinding:true}));
