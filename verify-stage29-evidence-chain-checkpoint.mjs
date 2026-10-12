import {createVerifierRuntime} from './verifier-runtime.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {recordProposal,canonicalFixtureRecord} from './test-fixtures.mjs';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js']){
  createVerifierRuntime.loadScript(globalThis,fs.readFileSync(file,'utf8'),{filename:file});
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
const makeProject=({releaseId='REL-1',productId='PROD-1',baselineId='BASE-1',hashReviewId='HASH_REVIEW-'+ '7'.repeat(64),chainReleaseId='REL-1',status='COMPLETE',missingLinks=[]}={})=>{
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
  // The fixture isolates exact chain bindings. Supply the normative seven-field
  // non-run declaration through the existing fixture/schema owner so it is not
  // a malformed test that can bypass the required-result frontier.
  const declared=recordProposal(schema,'tests').fields,timing=Object.fromEntries(schema.TIMING_FIELDS.map(key=>[key,declared[key]]));
  const test=canonicalFixtureRecord({engine,schema},p,'tests',{REQ_ID:'REQ-1',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'APPLICATION_DETERMINISTIC',STATUS:'READY',...timing,EARLIEST_EXECUTABLE_STAGE:6,REQUIRED_BY_STAGE:29,PER_RUN_REQUIRED:false},{scope});
  const result=record('verification',{REQ_ID:'REQ-1',TEST_ID:engine.recordId(test,'tests'),DETERMINATION:'SATISFIED',EVIDENCE_ID:['EVID-1'],RESULT_ID:'RES-1'},'RES-1',scope);
  const identity=record('artifactIdentities',{IDENTITY_ID:'ART-1',ARTIFACT_ID:'ART-1',AUDITED_FILENAME:'artifact.bin',RELEASE_FILENAME:'artifact.bin',AUTHORIZATION:'AUTHORIZED',EXACT_HASH_MATCH:true,EXACT_SIZE_MATCH:true,RELEASE_BYTE_SIZE:10,AUDITED_SHA256:'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',PRE_DELIVERY_SHA256:'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210'},'ART-1',scope);
  identity.identityEvidenceSha256='7'.repeat(64);identity.scope={...scope,releaseId,deliveryCandidateSetId:'SET-1'};
  p.projectData.deliveryCandidateSets.push(record('deliveryCandidateSets',{STATUS:'FROZEN',ARTIFACT_IDS:['ART-1'],AUTHORIZED_FILENAMES:{'ART-1':'artifact.bin'}},'SET-1',scope));
  p.projectData.sources.push(source);
  p.projectData.requirements.push(requirement);
  p.projectData.instructions.push(instruction);
  p.projectData.instructionTraces.push(trace);
  p.projectData.products.push(product);
  p.projectData.releaseRecords.push(release);
  p.projectData.evidenceRecords.push(evidence);
  p.projectData.verification.push(result);
  p.projectData.artifactIdentities.push(identity);
  p.projectData.propositions.push(record('propositions',{REQUIREMENT_ID:'REQ-1',STATUS:'ACTIVE'},'PROP-1',scope));
  p.projectData.evidenceChains.push(record('evidenceChains',{REQ_ID:'REQ-1',STATUS:status,MISSING_LINKS:missingLinks,RELEASE_DECISION_ID:chainReleaseId,HASH_REVIEW_ID:hashReviewId,PRODUCT_ELEMENT:productId,BASELINE_ID:baselineId,TEST_ID:[engine.recordId(test,'tests')],EVIDENCE_ID:['EVID-1'],ARTIFACT_HASH_IDENTITY:['ART-1'],TEST_RESULT_ID:['RES-1']},'CHAIN-1',scope));
  return p;
};

// Empty and incomplete binding universes cannot obtain completion from missing data.
const emptyProject=core.createBlankState('DISPOSABLE-EMPTY-EVIDENCE-UNIVERSE');engine.ensureShape(emptyProject);
assert.equal(engine.currentEvidenceChainSet(emptyProject).complete,false,'An unreviewed empty mandatory universe must not pass Stage 29.');
assert.equal(engine.calculateEvidenceChains(emptyProject).complete,false,'The direct calculation must preserve the unknown empty universe.');
engine.recalculate(emptyProject);
assert.equal(emptyProject.stages[29].derivedData.MANDATORY_EVIDENCE_CHAIN_COVERAGE,null,'An unreviewed empty denominator must remain unknown, not 100%.');
for(const missing of ['RELEASE_DECISION_ID','HASH_REVIEW_ID','PRODUCT_ELEMENT','BASELINE_ID']){
 const project=makeProject(),chain=project.projectData.evidenceChains[0];delete chain[missing];delete chain.fields[missing];if(chain.relationships)delete chain.relationships[missing];
 const set=engine.currentEvidenceChainSet(project);project.job.CURRENT_EVIDENCE_CHAIN_VERSION=set.expectedVersion;
 assert.equal(engine.currentEvidenceChainSet(project).complete,false,'Missing '+missing+' must not satisfy current evidence closure.');
}
for(const dimension of ['inputVersion','requirementsVersion','testSuiteVersion','instructionVersion','productId','baselineId']){
 const project=makeProject();project.projectData.evidenceChains[0].scope={...scope,[dimension]:'HISTORICAL'};
 project.job.CURRENT_EVIDENCE_CHAIN_VERSION=engine.currentEvidenceChainSet(project).expectedVersion;
 assert.equal(engine.currentEvidenceChainSet(project).complete,false,'Historical '+dimension+' evidence was accepted.');
}

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

// Independent §34.1/§36.6 oracle: exact canonical records and registered set
// membership, with only the declared self-dependent/audit omissions. This does
// not use the production evidenceChainSetPreimage/hash construction path.
const evidenceHash=globalThis.closedLoopHash;
const oracleScope={...engine.currentScope(validProject)};delete oracleScope.projectRevision;delete oracleScope.evidenceChainVersion;
const oracleChains=structuredClone(engine.currentEvidenceChainSet(validProject).records);
for(const record of oracleChains){for(const key of ['recordSha256','sha256','contentSha256','createdAt','updatedAt','eventSequence','EVIDENCE_CHAIN_VERSION'])delete record[key];delete record.fields.EVIDENCE_CHAIN_VERSION;delete record.scope.evidenceChainVersion;delete record.scope.projectRevision;}
const compareBytes=(a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b));oracleChains.sort((a,b)=>compareBytes(evidenceHash.stableStringify(a.id),evidenceHash.stableStringify(b.id)));
const expectedSubject={jobId:String(validProject.job.JOB_ID),scope:oracleScope,requirementIds:['REQ-1'],chainRecords:oracleChains},expectedSetSha256=createHash('sha256').update(evidenceHash.stableStringify(expectedSubject),'utf8').digest('hex');
assert.equal(validResult.setHash,expectedSetSha256,'EXACT_CHAIN_SHA_ORACLE: the full SHA-256 must bind the independently reconstructed complete chain subject.');assert.equal(validResult.setHash.length,64);
const linkChanges=[];
for(const key of ['AUTHORITY_ID','INSTRUCTION_ID','EXECUTION_ID','TEST_ID','TEST_RESULT_ID','EVIDENCE_ID','ARTIFACT_HASH_IDENTITY']){
 const changed=structuredClone(validProject),record=changed.projectData.evidenceChains.find(row=>row.id===validResult.chainIds[0]),old=record.fields[key],value=Array.isArray(old)?[...old,'CONTROLLED_DIFFERENT_LINK']:String(old)+'-CONTROLLED_DIFFERENT_LINK';record.fields[key]=value;record[key]=value;engine.refreshRecordHashes(record,'evidenceChains');const actual=engine.currentEvidenceChainSet(changed);
 assert.notEqual(actual.setHash,expectedSetSha256,'EXACT_CHAIN_LINK_ORACLE: '+key+' must be part of the complete canonical subject.');assert.equal(actual.complete,false,'EXACT_CHAIN_LINK_ORACLE: previous version must become stale after '+key+' changes.');linkChanges.push(key);
}
const oldSummaryDigest=evidenceHash.sha256Value(engine.currentEvidenceChainSet(validProject).records.map(record=>({reqId:String(engine.recordValue(record,'REQ_ID')),chainId:record.id,status:String(engine.recordValue(record,'STATUS')),releaseId:String(engine.recordValue(record,'RELEASE_DECISION_ID')),productId:String(engine.recordValue(record,'PRODUCT_ELEMENT')),baselineId:String(engine.recordValue(record,'BASELINE_ID')),hashReviewId:String(engine.recordValue(record,'HASH_REVIEW_ID'))}))).slice(0,32),oldSummaryProject=structuredClone(validProject);oldSummaryProject.job.CURRENT_EVIDENCE_CHAIN_VERSION='EVIDENCE-CHAIN-'+oldSummaryDigest.toUpperCase();assert.equal(engine.currentEvidenceChainSet(oldSummaryProject).complete,false,'EXACT_CHAIN_SHA_ORACLE: the original truncated summary version must not establish current completion.');
const verificationObservations=[{checkId:'evidence-chain-full-canonical-sha256',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:3033','specification/closed-loop-reliability-controlling-implementation-specification.txt:3282-3236'],boundary:'actual Stage29 command/current-set/checkpoint owner',expected:{setSha256:expectedSetSha256,digestLength:64,materialLinksBound:linkChanges},observed:{setSha256:validResult.setHash,digestLength:validResult.setHash.length,materialLinksBound:linkChanges},passed:true},{checkId:'evidence-chain-old-summary-rejected',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:3033'],boundary:'actual current evidence-chain set gate',expected:{complete:false,digestLength:32},observed:{complete:engine.currentEvidenceChainSet(oldSummaryProject).complete,digestLength:oldSummaryDigest.length},violation:'truncated chain summary substitutes for full canonical chain',accepted:false,passed:true}];

// Section37 Stage29 construction is separate from validating a preseeded
// chain. The literal expected identities come from makeProject's declared
// fixture, not the construction function under test. No completion is implied.
{
 const unbuilt=makeProject();unbuilt.projectData.evidenceChains=[];
 const decoy=structuredClone(unbuilt.projectData.instructions[0]);decoy.id=decoy.INSTRUCTION_ID=decoy.fields.INSTRUCTION_ID='INSTR-UNTRACED-DECOY';engine.refreshRecordHashes(decoy,'instructions');unbuilt.projectData.instructions.push(decoy);
 assert.equal(unbuilt.projectData.evidenceChains.length,0,'STAGE29_CONSTRUCTION_EMPTY_START_ORACLE');
 const result=engine.calculateEvidenceChains(unbuilt),created=engine.recordsForCurrentScope(unbuilt,'evidenceChains').find(row=>engine.recordValue(row,'REQ_ID')==='REQ-1');
 assert(created,'STAGE29_APPLICATION_CONSTRUCTION_ORACLE: no current chain was constructed');
 const expected={stage:29,source:'APPLICATION_DERIVATION',derivationKey:'stage29.evidenceChains',requirementId:'REQ-1',authorityId:'SRC-1',instructionId:'INSTR-1',executionId:'EXEC-1',productId:'PROD-1'};
 const observed={stage:created.stage,source:created.source,derivationKey:created.derivationKey,requirementId:engine.recordValue(created,'REQ_ID'),authorityId:engine.recordValue(created,'AUTHORITY_ID'),instructionId:engine.recordValue(created,'INSTRUCTION_ID'),executionId:engine.recordValue(created,'EXECUTION_ID'),productId:engine.recordValue(created,'PRODUCT_ELEMENT')};
 assert.deepEqual(observed,expected,'STAGE29_APPLICATION_CONSTRUCTION_ORACLE');assert.notEqual(observed.executionId,observed.productId,'STAGE29_DISTINCT_EXECUTION_PRODUCT_ORACLE');assert(result.chainIds.includes(created.id),'STAGE29_CONSTRUCTION_RETURN_ORACLE');
 verificationObservations.push({checkId:'stage29.application-construction-from-empty',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:3648'],boundary:'Actual CALCULATE_EVIDENCE_CHAINS command from zero chain records -> application canonical chain creation',expected,observed,passed:true,scopeLimit:'Explicit synthetic canonical source/requirement/trace/product/result fixture; no prior-stage completion or physical/external action claimed; structural chain creation does not imply sufficient evidence or completed Stage29.'});
}

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
const exportEvidence=record('evidenceRecords',{APPLICATION_EVIDENCE_KIND:'BACKUP_EXPORT_ACTION_COMPLETED',APPLICATION_EVIDENCE_CONTENT:JSON.stringify({checkpointId:checkpoint.CHECKPOINT_ID,packageId:checkpoint.PACKAGE_ID,packageSha256:checkpoint.PACKAGE_SHA256}),SHA256:'9999999999999999999999999999999999999999999999999999999999999999',STATUS:'CURRENT'},'EVID-EXPORT-1',{...scope,releaseId:'REL-1',hashReviewId:'HASH_REVIEW-'+ '7'.repeat(64),evidenceChainVersion:checkpointProject.job.CURRENT_EVIDENCE_CHAIN_VERSION});
exportEvidence.source='OPERATOR_ACTION';
checkpointProject.projectData.evidenceRecords.push(exportEvidence);
const exported=engine.recordPreDeliveryCheckpointExport(checkpointProject,{checkpointId:checkpoint.CHECKPOINT_ID,exportEvidenceIds:['EVID-EXPORT-1']});
assert.equal(exported.CUSTODY_STATE,'BACKUP_EXPORT_ACTION_COMPLETED','The terminal checkpoint must transition through a bound actual export-custody action.');
assert.equal(engine.currentPreDeliveryCheckpoint(checkpointProject)?.CUSTODY_STATE,'BACKUP_EXPORT_ACTION_COMPLETED','Only a current exactly-bound export-custody state can satisfy the terminal gate.');

// §35.9 / §41 item207: rank evidence-supported custody, never copied labels.
// These disposable records exercise evidence admissibility only; no actual
// external destination, disaster-recovery copy or exported-byte restore is claimed.
const custodyMaturityCases=[];
const custodyCheck=(name,run)=>{try{run();custodyMaturityCases.push({name,passed:true});}catch(error){custodyMaturityCases.push({name,passed:false,message:error.message});}};
const setCustodyField=(row,key,value)=>{row.fields[key]=value;row[key]=value;};
const copiedCustody=(p,state)=>{
 const row=structuredClone(exported);row.id='CHECKPOINT-MATURITY';setCustodyField(row,'CHECKPOINT_ID',row.id);setCustodyField(row,'CUSTODY_STATE',state);engine.refreshRecordHashes(row,'backupCheckpoints');p.projectData.backupCheckpoints.push(row);return row;
};
const observedCustody=(p,row,state)=>{
 const id='EVID-MATURITY',body={checkpointId:checkpoint.CHECKPOINT_ID,packageId:checkpoint.PACKAGE_ID,packageSha256:checkpoint.PACKAGE_SHA256};
 const evidence=structuredClone(exportEvidence);evidence.id=id;setCustodyField(evidence,'EVIDENCE_ID',id);setCustodyField(evidence,'APPLICATION_EVIDENCE_KIND',state);setCustodyField(evidence,'APPLICATION_EVIDENCE_CONTENT',JSON.stringify(body));engine.refreshRecordHashes(evidence,'evidenceRecords');p.projectData.evidenceRecords.push(evidence);
 setCustodyField(row,state==='RESTORE_TESTED_FROM_EXPORTED_COPY'?'RESTORE_EVIDENCE_IDS':'EXTERNAL_EVIDENCE_IDS',state==='RESTORE_TESTED_FROM_EXPORTED_COPY'?[id]:['EVID-EXPORT-1',id]);return evidence;
};
const selectedId=p=>engine.recordId(engine.currentPreDeliveryCheckpoint(p),'backupCheckpoints');
const exportId=engine.recordId(exported,'backupCheckpoints');
custodyCheck('evidence-backed export satisfies the terminal minimum',()=>assert.equal(selectedId(structuredClone(checkpointProject)),exportId));
for(const state of ['EXTERNAL_COPY_CONFIRMED','RESTORE_TESTED_FROM_EXPORTED_COPY']){
 for(const [name,mutate] of [
  ['absent evidence',(p,row)=>{setCustodyField(row,'EXTERNAL_EVIDENCE_IDS',[]);setCustodyField(row,'RESTORE_EVIDENCE_IDS',[]);}],
  ['nonexistent evidence',(p,row)=>{setCustodyField(row,'EXTERNAL_EVIDENCE_IDS',['EVID-MISSING']);setCustodyField(row,'RESTORE_EVIDENCE_IDS',['EVID-MISSING']);}],
  ['export-only wrong-level evidence',()=>{}],
  ['generic in-origin test-output evidence',(p,row)=>{setCustodyField(row,'EXTERNAL_EVIDENCE_IDS',['EVID-1']);setCustodyField(row,'RESTORE_EVIDENCE_IDS',['EVID-1']);}]
 ])custodyCheck(state+' rejects '+name,()=>{const p=structuredClone(checkpointProject),row=copiedCustody(p,state);mutate(p,row);engine.refreshRecordHashes(row,'backupCheckpoints');assert.equal(selectedId(p),exportId,'Unsupported '+state+' must not outrank evidence-backed export-completed.');assert.equal(engine.recordId(engine.terminalPrerequisites(p).preDeliveryCheckpoint,'backupCheckpoints'),exportId,'Terminal consumer must preserve the actual export minimum.');});
 custodyCheck(state+' admission remains unavailable without a registered observational producer',()=>{const p=structuredClone(checkpointProject),row=copiedCustody(p,state);observedCustody(p,row,state);engine.refreshRecordHashes(row,'backupCheckpoints');assert.equal(selectedId(p),exportId);});
 for(const [name,mutate] of [
  ['wrong kind',r=>setCustodyField(r,'APPLICATION_EVIDENCE_KIND','TEST_OUTPUT')],
  ['wrong provenance',r=>{r.source='APPLICATION_TEST_RUNTIME';}],
  ['inactive evidence',r=>{r.active=false;}],
  ['invalidated evidence',r=>{r.invalidatedBy='CONTROLLED-CORRECTION';}],
  ['superseded evidence',r=>setCustodyField(r,'STATUS','SUPERSEDED')],
  ['missing scope',r=>{r.scope={};}],
  ['changed scope',r=>{r.scope.productId='PROD-OTHER';}],
  ['malformed body',r=>setCustodyField(r,'APPLICATION_EVIDENCE_CONTENT','{')],
  ...['checkpointId','packageId','packageSha256'].map(key=>['wrong '+key,r=>{const body=JSON.parse(r.fields.APPLICATION_EVIDENCE_CONTENT);body[key]='CONTROLLED-UNRELATED';setCustodyField(r,'APPLICATION_EVIDENCE_CONTENT',JSON.stringify(body));}])
 ])custodyCheck(state+' rejects '+name,()=>{const p=structuredClone(checkpointProject),row=copiedCustody(p,state),evidence=observedCustody(p,row,state);mutate(evidence);engine.refreshRecordHashes(evidence,'evidenceRecords');engine.refreshRecordHashes(row,'backupCheckpoints');assert.equal(selectedId(p),exportId);});
 custodyCheck(state+' cannot replace export evidence with maturity evidence alone',()=>{const p=structuredClone(checkpointProject),row=copiedCustody(p,state);observedCustody(p,row,state);setCustodyField(row,'EXTERNAL_EVIDENCE_IDS',state==='EXTERNAL_COPY_CONFIRMED'?['EVID-MATURITY']:[]);engine.refreshRecordHashes(row,'backupCheckpoints');assert.equal(selectedId(p),exportId);});
 custodyCheck(state+' stale checkpoint cannot hide current export',()=>{const p=structuredClone(checkpointProject),row=copiedCustody(p,state);observedCustody(p,row,state);row.scope={...row.scope,releaseId:'REL-OTHER'};setCustodyField(row,'SCOPE',row.scope);engine.refreshRecordHashes(row,'backupCheckpoints');assert.equal(selectedId(p),exportId);});
}
for(const [name,mutate] of [
 ['removed export evidence',p=>{p.projectData.evidenceRecords=p.projectData.evidenceRecords.filter(r=>r.id!=='EVID-EXPORT-1');}],
 ['wrong export kind',p=>setCustodyField(p.projectData.evidenceRecords.find(r=>r.id==='EVID-EXPORT-1'),'APPLICATION_EVIDENCE_KIND','TEST_OUTPUT')],
 ['inactive export evidence',p=>{p.projectData.evidenceRecords.find(r=>r.id==='EVID-EXPORT-1').active=false;}],
 ['stale export evidence',p=>{p.projectData.evidenceRecords.find(r=>r.id==='EVID-EXPORT-1').scope={...exportEvidence.scope,productId:'PROD-OTHER'};}],
 ['generated-only checkpoint',p=>{p.projectData.backupCheckpoints=p.projectData.backupCheckpoints.filter(r=>r.id!==exportId);}]
])custodyCheck(name+' blocks the terminal minimum',()=>{const p=structuredClone(checkpointProject);mutate(p);assert.equal(engine.currentPreDeliveryCheckpoint(p),null);assert.equal(engine.terminalPrerequisites(p).preDeliveryCheckpoint,null);});
verificationObservations.push({checkId:'backup-custody-evidence-supported-maturity',requirementRefs:['NREQ-a855fdffbf43ae80dc0d26784d1e8980','NREQ-f7d22bdd8375c681a04c18d4c237b459'],boundary:'Actual checkpoint creation/export/selection -> terminalPrerequisites checkpoint field',cases:custodyMaturityCases,passed:custodyMaturityCases.every(row=>row.passed),scopeLimit:'Disposable Node canonical records, synthetic operator observations; no full Stage29/terminal completion, actual external-copy fact, physical-device or exported-byte restore maturity.'});
console.log(JSON.stringify({custodyMaturityCases}));
assert(custodyMaturityCases.every(row=>row.passed),'Evidence-supported custody maturity controls must all pass.');

// Actual existing application observation route; future delivery outputs must
// not stale the preauthorization minimum. Custody-only fixture never authorizes.
{
const checkpointProject=core.createBlankState('DISPOSABLE-CUSTODY-ONLY');engine.ensureShape(checkpointProject);
Object.assign(checkpointProject.job,{JOB_ID:'JOB-CUSTODY-ONLY',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-v001',CURRENT_REQUIREMENTS_VERSION:'REQ-v001',CURRENT_TEST_SUITE_VERSION:'TEST-v001',CURRENT_INSTRUCTION_VERSION:'INSTR-v001',CURRENT_ITERATION:'ITER-1',CURRENT_CANDIDATE_ID:'CAND-1',CURRENT_BASELINE_ID:'BASE-1',CURRENT_PRODUCT_ID:'PROD-1',CURRENT_PRODUCT_VERSION:'1.0.0',CURRENT_DELIVERY_CANDIDATE_SET_ID:'SET-1',CURRENT_RELEASE_ID:'REL-1',CURRENT_HASH_REVIEW_ID:'HASH_REVIEW-'+ '7'.repeat(64),CURRENT_EVIDENCE_CHAIN_VERSION:'EVIDENCE-CHAIN-CUSTODY-ONLY'});
assert.equal(engine.currentEvidenceChainSet(checkpointProject).complete,false,'This is a custody-only fixture, never Stage29 completion.');
const checkpoint=engine.createPreDeliveryCheckpoint(checkpointProject,{packageId:'PKG-1',packageSha256:'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',artifactManifestSha256:'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'});
assert.equal(checkpoint.CUSTODY_STATE,'BACKUP_PACKAGE_GENERATED');assert.equal(engine.currentPreDeliveryCheckpoint(checkpointProject),null);

const exported=engine.recordCheckpointExportAction(checkpointProject,{checkpointId:checkpoint.CHECKPOINT_ID,packageSha256:checkpoint.PACKAGE_SHA256,filename:'JOB-CUSTODY-ONLY.pre-delivery.closed-loop.json.gz'});
const eid=engine.recordValue(exported,'EXTERNAL_EVIDENCE_IDS')[0],witness=checkpointProject.projectData.evidenceRecords.find(row=>engine.recordId(row,'evidenceRecords')===eid),observation=JSON.parse(engine.recordValue(witness,'APPLICATION_EVIDENCE_CONTENT'));
const results=[],run=(name,fn)=>{try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,message:error.message});}};
const selectedId=p=>engine.recordId(engine.currentPreDeliveryCheckpoint(p),'backupCheckpoints'),exportId=engine.recordId(exported,'backupCheckpoints'),beforeScope=engine.currentScope(checkpointProject);
run('actual export writer records exact operator observation without external-copy claim',()=>{assert.equal(witness.source,'OPERATOR_ACTION');assert.equal(engine.recordValue(witness,'APPLICATION_EVIDENCE_KIND'),'BACKUP_EXPORT_ACTION_COMPLETED');assert.deepEqual(observation,{checkpointId:checkpoint.CHECKPOINT_ID,packageId:checkpoint.PACKAGE_ID,packageSha256:checkpoint.PACKAGE_SHA256,filename:'JOB-CUSTODY-ONLY.pre-delivery.closed-loop.json.gz',observedAction:'BROWSER_DOWNLOAD_ACTION_COMPLETED',externalCopyConfirmed:false});assert.equal(selectedId(checkpointProject),exportId);});
run('current scope excludes future delivery output and project revision',()=>{assert(!Object.hasOwn(beforeScope,'deliveryId'));assert(!Object.hasOwn(beforeScope,'projectRevision'));assert.equal(checkpointProject.job.CURRENT_DELIVERY_ID,null);});
const p=structuredClone(checkpointProject);
run('actual blocked terminal output preserves prerequisite scope and export checkpoint',()=>{const rev=p.revision;const terminal=engine.calculateTerminal(p,{expectedRevision:rev});assert.equal(engine.recordValue(terminal,'DELIVERY_STATE'),'BLOCKED','Custody fixture must never authorize delivery');assert.equal(p.job.CURRENT_DELIVERY_ID,engine.recordId(terminal,'deliveryRecords'));assert(p.job.CURRENT_DELIVERY_ID);assert.equal(p.revision,rev+1);assert.deepEqual(engine.currentScope(p),beforeScope);assert.equal(selectedId(p),exportId);assert.equal(engine.recordId(engine.terminalPrerequisites(p).preDeliveryCheckpoint,'backupCheckpoints'),exportId);});
run('actual terminal retry preserves its preauthorization export witness',()=>{const previous=p.job.CURRENT_DELIVERY_ID,rows=p.projectData.deliveryRecords.length,retry=engine.calculateTerminal(p,{expectedRevision:p.revision});assert.equal(engine.recordId(retry,'deliveryRecords'),previous);assert.equal(p.projectData.deliveryRecords.length,rows);assert.equal(selectedId(p),exportId);});
for(const state of ['EXTERNAL_COPY_CONFIRMED','RESTORE_TESTED_FROM_EXPORTED_COPY']){
 for(const relabelWitness of [false,true])run(state+(relabelWitness?' cannot turn native export-only observation into maturity by relabeling kind':' copied unsupported label retains lower actual export'),()=>{const p=structuredClone(checkpointProject),row=structuredClone(exported);row.id='CHECK-MATURITY-COPY';row.fields.CHECKPOINT_ID=row.CHECKPOINT_ID=row.id;row.fields.CUSTODY_STATE=row.CUSTODY_STATE=state;if(relabelWitness){const e=structuredClone(witness);e.id='NATIVE-EXPORT-RELABEL';e.fields.EVIDENCE_ID=e.EVIDENCE_ID=e.id;e.fields.APPLICATION_EVIDENCE_KIND=e.APPLICATION_EVIDENCE_KIND=state;engine.refreshRecordHashes(e,'evidenceRecords');p.projectData.evidenceRecords.push(e);if(state==='EXTERNAL_COPY_CONFIRMED')row.fields.EXTERNAL_EVIDENCE_IDS=row.EXTERNAL_EVIDENCE_IDS=[eid,e.id];else row.fields.RESTORE_EVIDENCE_IDS=row.RESTORE_EVIDENCE_IDS=[e.id];}engine.refreshRecordHashes(row,'backupCheckpoints');p.projectData.backupCheckpoints.push(row);assert.equal(selectedId(p),exportId);});
}

for(const [name,mutate] of [
 ['wrong evidence source',r=>{r.source='APPLICATION_TEST_RUNTIME';}],
 ['wrong evidence kind',r=>{r.fields.APPLICATION_EVIDENCE_KIND=r.APPLICATION_EVIDENCE_KIND='TEST_OUTPUT';}],
 ['inactive evidence',r=>{r.active=false;}],
 ['invalidated evidence',r=>{r.invalidatedBy='CONTROLLED-CORRECTION';}],
 ['superseded evidence',r=>{r.fields.STATUS=r.STATUS='SUPERSEDED';}],
 ['unknown evidence state',r=>{r.fields.STATUS=r.STATUS='UNKNOWN';}],
 ['missing evidence scope',r=>{r.scope={};}],
 ...Object.keys(beforeScope).filter(key=>beforeScope[key]!==null).map(key=>['changed evidence scope '+key,r=>{r.scope={...r.scope,[key]:'CONTROLLED-UNRELATED'};}]),
 ...['checkpointId','packageId','packageSha256'].map(key=>['changed witness '+key,r=>{const body=JSON.parse(engine.recordValue(r,'APPLICATION_EVIDENCE_CONTENT'));body[key]='CONTROLLED-UNRELATED';r.fields.APPLICATION_EVIDENCE_CONTENT=r.APPLICATION_EVIDENCE_CONTENT=JSON.stringify(body);}])
])run('native minimum rejects '+name,()=>{const p=structuredClone(checkpointProject),r=p.projectData.evidenceRecords.find(row=>engine.recordId(row,'evidenceRecords')===eid);mutate(r);engine.refreshRecordHashes(r,'evidenceRecords');assert.equal(engine.currentPreDeliveryCheckpoint(p),null);});
console.log(JSON.stringify({scope:beforeScope,witness:{id:eid,source:witness.source,kind:engine.recordValue(witness,'APPLICATION_EVIDENCE_KIND'),content:observation},results},null,2));assert(results.every(r=>r.passed));
verificationObservations.push({checkId:'backup-export-native-observation-scope-output-boundary',requirementRefs:['NREQ-a855fdffbf43ae80dc0d26784d1e8980','NREQ-f7d22bdd8375c681a04c18d4c237b459'],boundary:'recordCheckpointExportAction -> currentPreDeliveryCheckpoint -> actual blocked terminal output/retry',cases:results,passed:results.every(row=>row.passed),scopeLimit:'Existing observation writer under disposable Node fixture; no browser download or external-copy/restore maturity performed.'});
}

console.log(JSON.stringify({stage29ApplicationCommand:true,stage29CurrentSetValidated:true,stage29IdempotentRetry:true,preDeliveryCheckpointExportCustody:true,staleAndWeakEvidenceRejected:true,nonexistentExportEvidenceRejected:true,genericExportEvidenceRejected:true,fabricatedCheckpointRejected:true,terminalRejectsFabricatedCheckpoint:true,verificationObservations}));
