import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js']){
  vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
}
const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
assert(core&&schema&&engine,'Stage 29 verifier requires production runtime modules.');
assert.equal(schema.operationContract(29,'CALCULATE_EVIDENCE_CHAINS')?.executorClass,'APPLICATION','Stage 29 calculation must remain application-owned.');
assert.equal(schema.operationContract(29,'CALCULATE_EVIDENCE_CHAINS')?.retryRule,'IDEMPOTENT_COMMAND','Stage 29 calculation must use the closed idempotent command contract.');
assert.equal(schema.operationContract(29,'CALCULATE_EVIDENCE_CHAINS')?.acceptsExternalResponse,false,'Stage 29 application calculation must reject external response envelopes.');
assert.equal(schema.operationContract(29,'CALCULATE_EVIDENCE_CHAINS')?.acceptanceMode,'DIRECT_COMMAND','Stage 29 application calculation must commit directly without proposal approval.');
assert.equal(typeof engine.calculateEvidenceChains,'function','Production runtime must expose the Stage 29 CALCULATE_EVIDENCE_CHAINS application command rather than direct collection mutation.');
assert.equal(typeof engine.createPreDeliveryCheckpoint,'function','Production runtime must expose a real pre-delivery checkpoint creation path.');
assert.equal(typeof engine.recordPreDeliveryCheckpointExport,'function','Production runtime must record the real backup export custody transition instead of accepting manually fabricated checkpoint records.');

const scope={inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-v001',requirementsVersion:'REQ-v001',testSuiteVersion:'TEST-v001',instructionVersion:'INSTR-v001',iterationId:'ITER-1',candidateId:'CAND-1',baselineId:'BASE-1',productId:'PROD-1',productVersion:'1.0.0',deliveryCandidateSetId:'SET-1'};
const record=(family,fields,id,sc=scope)=>{const def=schema.RECORD_SCHEMAS[family]; return {id,active:true,fields:{...fields,[def.idField]:id},...fields,[def.idField]:id,scope:sc};};
const makeProject=({releaseId='REL-1',productId='PROD-1',baselineId='BASE-1',hashReviewId='HASH-1',chainReleaseId='REL-1',status='COMPLETE',missingLinks=[]}={})=>{
  const p=core.createBlankState('VERIFY-STAGE29');
  engine.ensureShape(p);
  Object.assign(p.job,{JOB_ID:'JOB-STAGE29',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-v001',CURRENT_REQUIREMENTS_VERSION:'REQ-v001',CURRENT_TEST_SUITE_VERSION:'TEST-v001',CURRENT_INSTRUCTION_VERSION:'INSTR-v001',CURRENT_ITERATION:'ITER-1',CURRENT_CANDIDATE_ID:'CAND-1',CURRENT_BASELINE_ID:baselineId,CURRENT_PRODUCT_ID:productId,CURRENT_PRODUCT_VERSION:'1.0.0',CURRENT_DELIVERY_CANDIDATE_SET_ID:'SET-1',CURRENT_RELEASE_ID:releaseId,CURRENT_HASH_REVIEW_ID:hashReviewId,CURRENT_EVIDENCE_CHAIN_VERSION:null});
  const requirement=record('requirements',{REQ_ID:'REQ-1',SOURCE_ID:'SRC-1',USER_INPUT_RELATIONSHIP:'CURRENT_USER_INPUT',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'},'REQ-1',scope);
  const source=record('sources',{SOURCE_ID:'SRC-1',SOURCE_TYPE:'APPLICATION',STATUS:'CURRENT',AUTHORITY_LEVEL:'AUTHORITATIVE'},'SRC-1',scope);
  const product=record('products',{PRODUCT_ID:productId,PRODUCT_VERSION:'1.0.0',BASELINE_ID:baselineId,EXECUTION_ID:'EXEC-1',STATUS:'COMPLETED'},'PROD-1',scope);
  const release=record('releaseRecords',{RELEASE_ID:releaseId,PRODUCT_ID:productId,BASELINE_ID:baselineId,HASH_REVIEW_ID:hashReviewId,DETERMINATION:'ACCEPTED',CONTROLLING_EVIDENCE:'EVIDENCE-REL-1'},'REL-1',scope);
  const evidence=record('evidenceRecords',{APPLICATION_EVIDENCE_KIND:'TEST_OUTPUT',APPLICATION_EVIDENCE_CONTENT:'Evidence for requirement REQ-1 is complete and bound to the current release/product/baseline.',SHA256:'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',STATUS:'CURRENT'},'EVID-1',scope);
  evidence.source='APPLICATION_TEST_RUNTIME';
  const instruction=record('instructions',{INSTRUCTION_ID:'INSTR-1',STATUS:'CURRENT',INSTRUCTION_TEXT:'Execute the Stage 29 requirement evidence validation.'},'INSTR-1',scope);
  const trace=record('instructionTraces',{TRACE_ID:'TRACE-1',REQ_ID:'REQ-1',INSTRUCTION_ID:'INSTR-1',INSTRUCTION_LOCATION:'stage-29.evidence-chain',IMPLEMENTED_BEHAVIOR:'Required evidence-chain validation',EVIDENCE_ID:'EVID-1',STATUS:'CURRENT'},'TRACE-1',scope);
  const test=record('tests',{REQ_ID:'REQ-1',TEST_ID:'TEST-1',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'APPLICATION_DETERMINISTIC',STATUS:'READY'},'TEST-1',scope);
  const result=record('verification',{REQ_ID:'REQ-1',TEST_ID:'TEST-1',DETERMINATION:'SATISFIED',EVIDENCE_ID:['EVID-1'],RESULT_ID:'RES-1'},'RES-1',scope);
  const identity=record('artifactIdentities',{IDENTITY_ID:'ART-1',ARTIFACT_ID:'ART-1',AUDITED_FILENAME:'artifact.bin',RELEASE_FILENAME:'artifact.bin',AUTHORIZATION:'AUTHORIZED',EXACT_HASH_MATCH:true,EXACT_SIZE_MATCH:true,RELEASE_BYTE_SIZE:10,PRE_DELIVERY_SHA256:'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210'},'ART-1',scope);
  p.projectData.sources.push(source);
  p.projectData.requirements.push(requirement);
  p.projectData.instructions.push(instruction);
  p.projectData.instructionTraces.push(trace);
  p.projectData.products.push(product);
  p.projectData.releaseRecords.push(release);
  p.projectData.evidenceRecords.push(evidence);
  p.projectData.tests.push(test);
  p.projectData.verification.push(result);
  p.projectData.artifactIdentities.push(identity);
  p.projectData.propositions.push(record('propositions',{REQUIREMENT_ID:'REQ-1',STATUS:'ACTIVE'},'PROP-1',scope));
  p.projectData.evidenceChains.push(record('evidenceChains',{REQ_ID:'REQ-1',STATUS:status,MISSING_LINKS:missingLinks,RELEASE_DECISION_ID:chainReleaseId,HASH_REVIEW_ID:hashReviewId,PRODUCT_ELEMENT:productId,BASELINE_ID:baselineId,TEST_ID:['TEST-1'],EVIDENCE_ID:['EVID-1'],ARTIFACT_HASH_IDENTITY:['ART-1'],TEST_RESULT_ID:['RES-1']},'CHAIN-1',scope));
  return p;
};

const validProject=makeProject();
const validSet=engine.currentEvidenceChainSet(validProject);
assert.equal(validSet.requirementIds.includes('REQ-1'),true,'A mandatory requirement must be present in the current scope.');
validProject.job.CURRENT_EVIDENCE_CHAIN_VERSION=validSet.expectedVersion;
assert.equal(engine.currentEvidenceChainSet(validProject).complete,true,'The exact current product, release, baseline, and hash-review binding should complete the Stage 29 set.');
const validResult=engine.calculateEvidenceChains(validProject);
assert.equal(validResult.complete,true,'The application command must compute a complete current evidence-chain set.');
assert.equal(validResult.version,validProject.job.CURRENT_EVIDENCE_CHAIN_VERSION,'The current version must match the authoritative calculated set.');
assert.equal(validProject.projectData.commandReceipts.length,1,'The command must be logged as a single idempotent receipt.');
const idempotentRetry=engine.calculateEvidenceChains(validProject);
assert.equal(idempotentRetry.version,validResult.version,'Idempotent retry must return the same current evidence-chain version.');
assert.equal(validProject.projectData.commandReceipts.length,1,'An idempotent retry must not duplicate the authoritative evidence-chain receipt.');

const staleProject=makeProject({releaseId:'REL-2',chainReleaseId:'REL-1'});
const staleSet=engine.currentEvidenceChainSet(staleProject);
assert.equal(staleSet.complete,false,'Releasing a stale evidence chain must reopen Stage 29.');
assert.ok(staleSet.unknown.includes('REQ-1'),'A stale release binding must leave the requirement in the unknown set.');

const weakProject=makeProject({missingLinks:['MISSING-EVIDENCE-LINK']});
const weakSet=engine.currentEvidenceChainSet(weakProject);
assert.equal(weakSet.complete,false,'Weak or missing evidence links must leave the chain incomplete.');
assert.ok(weakSet.unknown.includes('REQ-1')||weakSet.missing.includes('REQ-1'),'Weak evidence must be rejected as incomplete.');

// Invalid checkpoint evidence must be rejected through the real production transition.
const nonexistentEvidenceProject=makeProject();
engine.calculateEvidenceChains(nonexistentEvidenceProject);
const nonexistentCheckpoint=engine.createPreDeliveryCheckpoint(nonexistentEvidenceProject,{packageId:'PKG-NONE',packageSha256:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',artifactManifestSha256:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'});
const nonexistentCount=nonexistentEvidenceProject.projectData.backupCheckpoints.length;
assert.throws(()=>engine.recordPreDeliveryCheckpointExport(nonexistentEvidenceProject,{checkpointId:nonexistentCheckpoint.CHECKPOINT_ID,exportEvidenceIds:['EVID-NOT-EXIST']}),/evidence|export|custody/i,'A nonexistent evidence ID must not manufacture BACKUP_EXPORT_ACTION_COMPLETED.');
assert.equal(nonexistentEvidenceProject.projectData.backupCheckpoints.length,nonexistentCount,'Rejected export evidence must not mutate checkpoint state.');

const genericEvidenceProject=makeProject();
engine.calculateEvidenceChains(genericEvidenceProject);
const genericCheckpoint=engine.createPreDeliveryCheckpoint(genericEvidenceProject,{packageId:'PKG-GENERIC',packageSha256:'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',artifactManifestSha256:'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'});
const genericCount=genericEvidenceProject.projectData.backupCheckpoints.length;
assert.throws(()=>engine.recordPreDeliveryCheckpointExport(genericEvidenceProject,{checkpointId:genericCheckpoint.CHECKPOINT_ID,exportEvidenceIds:['EVID-1']}),/evidence|export|custody/i,'Generic application test-output evidence must not prove a backup export action.');
assert.equal(genericEvidenceProject.projectData.backupCheckpoints.length,genericCount,'Rejected generic evidence must not mutate checkpoint state.');

const fabricatedProject=makeProject();
engine.calculateEvidenceChains(fabricatedProject);
fabricatedProject.projectData.backupCheckpoints.push(record('backupCheckpoints',{CHECKPOINT_ID:'CHECK-FAB',PACKAGE_ID:'PKG-FAB',PACKAGE_SHA256:'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',CUSTODY_STATE:'BACKUP_EXPORT_ACTION_COMPLETED',EXTERNAL_EVIDENCE_IDS:['EVID-1'],STATUS:'CURRENT'},'CHECK-FAB',{}));
assert.equal(engine.currentPreDeliveryCheckpoint(fabricatedProject),null,'A manually fabricated exported checkpoint with missing current scope bindings must not satisfy the terminal prerequisite.');
const fabricatedTerminal=engine.terminalPrerequisites(fabricatedProject);
assert.equal(fabricatedTerminal.preDeliveryCheckpoint,null,'Terminal prerequisites must not expose a manually fabricated exported checkpoint as current.');
assert.ok(fabricatedTerminal.reasons.some(reason=>reason.includes('BACKUP_EXPORT_ACTION_COMPLETED')),'Terminal prerequisites must preserve the pre-delivery checkpoint blocker when exported custody is fabricated.');

const checkpointProject=makeProject();
const calculated=engine.calculateEvidenceChains(checkpointProject);
assert.equal(calculated.complete,true,'Checkpoint proof requires the exact current evidence-chain calculation first.');
const checkpoint=engine.createPreDeliveryCheckpoint(checkpointProject,{packageId:'PKG-1',packageSha256:'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',artifactManifestSha256:'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'});
assert.equal(checkpoint.CUSTODY_STATE,'BACKUP_PACKAGE_GENERATED','The real checkpoint creation path must begin as generated package custody.');
assert.equal(engine.currentPreDeliveryCheckpoint(checkpointProject),null,'Generated-only backup custody must not satisfy the terminal pre-delivery gate.');
const exportEvidence=record('evidenceRecords',{APPLICATION_EVIDENCE_KIND:'BACKUP_EXPORT_ACTION_COMPLETED',APPLICATION_EVIDENCE_CONTENT:JSON.stringify({checkpointId:checkpoint.CHECKPOINT_ID,packageId:checkpoint.PACKAGE_ID,packageSha256:checkpoint.PACKAGE_SHA256}),SHA256:'9999999999999999999999999999999999999999999999999999999999999999',STATUS:'CURRENT'},'EVID-EXPORT-1',{...scope,releaseId:'REL-1',hashReviewId:'HASH-1',evidenceChainVersion:checkpointProject.job.CURRENT_EVIDENCE_CHAIN_VERSION});
exportEvidence.source='OPERATOR_ACTION';
checkpointProject.projectData.evidenceRecords.push(exportEvidence);
const exported=engine.recordPreDeliveryCheckpointExport(checkpointProject,{checkpointId:checkpoint.CHECKPOINT_ID,exportEvidenceIds:['EVID-EXPORT-1']});
assert.equal(exported.CUSTODY_STATE,'BACKUP_EXPORT_ACTION_COMPLETED','The terminal checkpoint must transition through a bound actual export-custody action.');
assert.equal(engine.currentPreDeliveryCheckpoint(checkpointProject)?.CUSTODY_STATE,'BACKUP_EXPORT_ACTION_COMPLETED','Only a current exactly-bound export-custody state can satisfy the terminal gate.');

console.log(JSON.stringify({stage29ApplicationCommand:true,stage29CurrentSetValidated:true,stage29IdempotentRetry:true,preDeliveryCheckpointExportCustody:true,staleAndWeakEvidenceRejected:true,nonexistentExportEvidenceRejected:true,genericExportEvidenceRejected:true,fabricatedCheckpointRejected:true,terminalRejectsFabricatedCheckpoint:true}));
