import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,hash=globalThis.closedLoopHash,schema=globalThis.closedLoopWorkflowSchema;
const project=core.createBlankState('SOURCE-SEARCH-EVIDENCE-BINDING');engine.ensureShape(project);
const currentScope=engine.currentScope(project);
const contract={SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE',SEARCH_UNIVERSE:'The bounded current fixture authority universe.',SEARCH_PROCEDURE:'Inspect every source admitted to the declared universe.',SEARCH_LOCATIONS:'Fixture authority registry.',SEARCH_QUERIES_OR_STRATEGIES:'Check the current governing-source classes.',SEARCH_CUTOFF:'Current input version.',SEARCH_LIMITATIONS:'No universal-absence claim.',SEARCH_EXECUTION_EVIDENCE:'EVIDENCE-FABRICATED; RECEIPT-FABRICATED',DISCOVERY_RISK:'NONMATERIAL'};
project.stages[2].agentData={...contract};

function acceptedOperation(operation,sequence,{rawResponseId,proposalId,contextId,evidenceIds=[]}={}){
  const changeId=`CHANGE-2-${operation}-${sequence}`,scope={...currentScope,contextId},change={changeId,rawResponseId,proposalId,jobId:project.job.JOB_ID,stage:2,responseType:'DATA_PROPOSAL',status:'COMMITTED',operation,scope,eventSequence:sequence,canonicalRecordIds:[...evidenceIds],stageFields:['SEARCH_EXECUTION_EVIDENCE','DISCOVERY_RISK']};
  project.projectData.acceptedChanges.push(change);project.projectData.responseProposals.push({proposalId,rawResponseId,stage:2,status:'ACCEPTED',envelope:{operation,scope},proposedStageData:{SEARCH_EXECUTION_EVIDENCE:contract.SEARCH_EXECUTION_EVIDENCE,DISCOVERY_RISK:'NONMATERIAL'},evidence:[]});return change;
}
function evidence(id,temporaryKey,change){
  const fields={EVIDENCE_ID:id,KIND:'SEARCH_EXECUTION',DESCRIPTION:'Current bounded-search evidence.',AUTHORITY_TYPE:'AGENT_CLAIM',SOURCE_ID:'',LOCATION:'Fixture authority registry',CONTENT:'The bounded procedure was executed.',ATTACHMENT_ID:'',SHA256:hash.sha256Text(id),STATUS:'PRESERVED'},record={id,stage:2,active:true,scope:{...currentScope},fields,...fields,source:'AGENT_RESPONSE',rawResponseId:change.rawResponseId,sourceProposalId:change.proposalId,temporaryKey,jobId:project.job.JOB_ID};engine.refreshRecordHashes(record,'evidenceRecords');project.projectData.evidenceRecords.push(record);change.canonicalRecordIds.push(id);const proposal=project.projectData.responseProposals.find(item=>item.proposalId===change.proposalId);proposal.evidence.push({id,temporaryKey,fields});return record;
}

const compiler=acceptedOperation('COMPLETE',1,{rawResponseId:'RAW-SEARCH',proposalId:'PROPOSAL-SEARCH',contextId:'CONTEXT-SEARCH'}),searchEvidence=evidence('EVIDENCE-SEARCH','search-execution',compiler);
const review=acceptedOperation('SEARCH_ADEQUACY_REVIEW',2,{rawResponseId:'RAW-REVIEW',proposalId:'PROPOSAL-REVIEW',contextId:'CONTEXT-INDEPENDENT-REVIEW'});evidence('EVIDENCE-REVIEW','review-evidence',review);
const reviewReceipt={receiptId:'RECEIPT-REVIEW',jobId:project.job.JOB_ID,stage:2,inputIdentities:[project.job.CURRENT_INPUT_VERSION],sourceSetVersion:project.job.CURRENT_SOURCE_SET_VERSION||'NOT APPLICABLE',acceptedCanonicalChangeId:review.changeId,completionState:'ACCEPTED_DATA_CHANGE'};project.projectData.outputReceipts.push(reviewReceipt);

let status=engine.evaluateSourceSearchClosure(project);assert.equal(status.complete,false,'Fabricated SEARCH_EXECUTION_EVIDENCE identifiers closed the bounded source-search gate.');assert(status.reasons.some(reason=>/resolves to 0 current canonical evidence or receipt records/.test(reason)));

contract.SEARCH_EXECUTION_EVIDENCE='EVIDENCE-SEARCH; RECEIPT-REVIEW';project.stages[2].agentData.SEARCH_EXECUTION_EVIDENCE=contract.SEARCH_EXECUTION_EVIDENCE;project.projectData.responseProposals.find(item=>item.proposalId===review.proposalId).proposedStageData.SEARCH_EXECUTION_EVIDENCE=contract.SEARCH_EXECUTION_EVIDENCE;
status=engine.evaluateSourceSearchClosure(project);assert.equal(status.complete,true,`Current bounded-search evidence and independent-review receipt did not close Stage 02: ${status.reasons.join(' | ')}`);

searchEvidence.scope={...searchEvidence.scope,inputVersion:'INPUT-STALE'};status=engine.evaluateSourceSearchClosure(project);assert.equal(status.complete,false,'Wrong-scope search evidence satisfied Stage 02.');assert(status.reasons.some(reason=>/stale or outside current project scope/.test(reason)));searchEvidence.scope={...currentScope};
searchEvidence.jobId='ANOTHER-PROJECT';status=engine.evaluateSourceSearchClosure(project);assert.equal(status.complete,false,'Cross-project search evidence satisfied Stage 02.');assert(status.reasons.some(reason=>/belongs to another project/.test(reason)));searchEvidence.jobId=project.job.JOB_ID;
searchEvidence.active=false;status=engine.evaluateSourceSearchClosure(project);assert.equal(status.complete,false,'Stale invalidated search evidence satisfied Stage 02.');searchEvidence.active=true;
reviewReceipt.jobId='ANOTHER-PROJECT';status=engine.evaluateSourceSearchClosure(project);assert.equal(status.complete,false,'A cross-project search-adequacy receipt satisfied Stage 02.');reviewReceipt.jobId=project.job.JOB_ID;
status=engine.evaluateSourceSearchClosure(project);assert.equal(status.complete,true,'Repairing the exact current evidence and receipt bindings did not restore bounded search closure.');

console.log(JSON.stringify({fabricatedEvidenceRejected:true,missingEvidenceRejected:true,staleEvidenceRejected:true,wrongScopeEvidenceRejected:true,crossProjectEvidenceRejected:true,currentCanonicalEvidenceAccepted:true,currentCanonicalReceiptAccepted:true,noApplicableSourceRulesPreserved:true}));
