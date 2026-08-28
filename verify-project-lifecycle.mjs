import fs from 'node:fs';
import vm from 'node:vm';
const assert=(value,message)=>{if(!value)throw new Error(message);};
const app=fs.readFileSync('app-core.js','utf8'),store=fs.readFileSync('project-store.js','utf8'),ingestion=fs.readFileSync('response-ingestion.js','utf8'),engineSource=fs.readFileSync('workflow-engine.js','utf8'),pages=fs.readFileSync('.github/workflows/pages.yml','utf8'),html=fs.readFileSync('index.html','utf8');
for(const token of ['renameCurrentProject','duplicateCurrentProject','archiveCurrentProject','restoreArchivedProject','downloadProjectPackage','verifyStoredFilesNow','discardCurrentAttempt','prepareReplacementAttempt','reopenHumanBlocker'])assert(app.includes(token),`Missing lifecycle action ${token}.`);
for(const token of ['project-management','project-danger-zone','Start from copy','Create backup now','Verify stored files now','View exact evidence / provenance','Clear unsaved response','Discard pending attempt','Prepare replacement attempt'])assert(app.includes(token),`Missing lifecycle UI ${token}.`);
assert(!app.includes('dismissedProposalIds')&&ingestion.includes('function abandon(project,proposalId')&&ingestion.includes("'ABANDONED_RESPONSE'")&&app.includes('canonical accepted work changed: NO'),'Discarded pending attempts must be auditable without changing accepted canonical work.');
assert(store.includes('verifyProjectArtifacts')&&store.includes('MISSING_STORED_BLOB')&&store.includes('CANONICAL_BLOB_IDENTITY_MISMATCH'),'Stored-file verification must reconcile canonical artifact identities to actual Blob custody.');
assert(engineSource.includes('reconcileArtifactCustodyVerification')&&engineSource.includes("source:'APPLICATION'")&&engineSource.includes("project.release.authorization='NOT AUTHORIZED'"),'Artifact custody failure must be application-owned and revoke release authorization.');
assert(app.includes("integrity:verification?(verification.verified?'VERIFIED':'FAILED'):'NOT CHECKED'"),'Historical verification must never display current VERIFIED state without a current byte re-read.');
assert(store.includes("lastVerifiedExport:'+jobId")&&app.includes('projectStorage.lastBackup'),'Backup status must remain project-specific.');
for(const token of ['currentScopeSelectorCoverage','exactReqRunTestCoverage','applicableCurrentRegressionSuccess','mandatoryEvidenceChainCoverage','releaseArtifactIdentityCoverage','favorableAgentVerdictsOverridingContradictoryObservations','externallySupportedUnestablishedIndependenceTreatedAsProven'])assert(pages.includes(token),`Acceptance reduction lost required invariant ${token}.`);
assert(app.includes('Reopened ${blockerId}: ${reason}'),'Reopen must append a new blocker instead of rewriting the resolved record.');
assert(store.includes("openTransaction([PROJECTS,ARTIFACTS,META],'readwrite')")&&store.includes('during-project-delete')&&store.includes('String(artifact.jobId)===jobId')&&store.includes("meta.get('projectUi')")&&store.includes('delete nextProjectUi[jobId]'),'Project deletion must remain one transaction over project/meta, lifecycle metadata, and owned artifact Blob rows.');
assert(html.includes('project-action-menu')&&html.includes('Project actions'),'Routine header actions must remain compact.');
assert(html.includes('.header-actions{display:flex;flex-wrap:nowrap;overflow:visible;')&&!html.includes('.header-actions{display:flex;flex-wrap:nowrap;overflow-x:auto;'),'Mobile Project actions must not be clipped by the header action-strip overflow container.');
assert(!html.includes('Force Complete Stage')&&!html.includes('Override Release Gate')&&!html.includes('Mark Test Passed'),'Unsafe override controls must not exist.');

// Behavioral regression: once the application establishes that canonical artifact custody is broken,
// release identity must fail closed. Repair may resolve the custody blocker, but may never resurrect
// the stale Stage 28 authorization or invalidated release evidence.
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine;
const custody=core.createBlankState('JOB-LIFECYCLE-CUSTODY');engine.ensureShape(custody);custody.activeStage=28;custody.release.authorization='AUTHORIZED';custody.release.authorizedArtifactIds=['ARTIFACT-CUSTODY-1'];
const scope=engine.currentScope(custody);
const staleRecords=[
  ['artifactIdentities','IDENTITY-CUSTODY-1',{ARTIFACT_IDENTITY_ID:'IDENTITY-CUSTODY-1'}],
  ['evidenceChains','CHAIN-CUSTODY-1',{EVIDENCE_CHAIN_ID:'CHAIN-CUSTODY-1'}],
  ['releaseRecords','RELEASE-CUSTODY-1',{RELEASE_ID:'RELEASE-CUSTODY-1',DETERMINATION:'ACCEPTED'}]
];
for(const [collection,id,fields] of staleRecords)custody.projectData[collection].push({id,stage:28,active:true,scope:{...scope},fields:{...fields},...fields});
const failedReport={jobId:custody.job.JOB_ID,verified:false,artifactCount:1,at:'2026-08-28T19:55:00.000Z',artifacts:[{artifactId:'ARTIFACT-CUSTODY-1',verified:false,issue:'CANONICAL_BLOB_IDENTITY_MISMATCH'}]};
const failed=engine.reconcileArtifactCustodyVerification(custody,{report:failedReport,stage:28});
assert(failed.verified===false&&failed.blockerId,'Custody failure did not create an application blocker.');
const blockers=engine.records(custody,'blockers',{active:false}).filter(record=>record.applicationBlockerKind==='ARTIFACT_CUSTODY');
assert(blockers.length===1&&blockers[0].source==='APPLICATION','Custody blocker is not uniquely application-owned.');
assert(custody.release.authorization==='NOT AUTHORIZED'&&custody.release.authorizedArtifactIds.length===0,'Custody failure did not revoke delivery authorization.');
for(const [collection,id] of staleRecords){const record=engine.records(custody,collection,{active:false}).find(item=>engine.recordId(item,collection)===id);assert(record&&record.active===false&&record.validity==='INVALIDATED'&&record.invalidatedBy===failed.blockerId,`${collection} remained authoritative after custody failure.`);}
let humanOverrideRejected=false;try{engine.resolveHumanBlocker(custody,{blockerId:failed.blockerId,resolutionEvidence:'operator claim'});}catch{humanOverrideRejected=true;}assert(humanOverrideRejected,'Human blocker control resolved an application-owned custody blocker.');
const duplicate=engine.reconcileArtifactCustodyVerification(custody,{report:failedReport,stage:28});assert(duplicate.blockerId===failed.blockerId&&engine.records(custody,'blockers',{active:false}).filter(record=>record.applicationBlockerKind==='ARTIFACT_CUSTODY').length===1,'Repeated custody failure duplicated the canonical blocker.');
const repaired=engine.reconcileArtifactCustodyVerification(custody,{report:{jobId:custody.job.JOB_ID,verified:true,artifactCount:1,at:'2026-08-28T19:56:00.000Z',artifacts:[{artifactId:'ARTIFACT-CUSTODY-1',verified:true,issue:null}]},stage:28});
assert(repaired.verified===true&&repaired.resolvedBlockerIds.includes(failed.blockerId),'Successful application re-verification did not resolve the custody blocker.');
assert(String(engine.recordValue(blockers[0],'STATUS')).toUpperCase()==='RESOLVED'&&blockers[0].resolvedBy==='APPLICATION','Custody blocker was not application-resolved after byte identity was restored.');
assert(custody.release.authorization==='NOT AUTHORIZED'&&custody.release.authorizedArtifactIds.length===0,'Successful re-verification resurrected stale delivery authorization.');
for(const [collection,id] of staleRecords){const record=engine.records(custody,collection,{active:false}).find(item=>engine.recordId(item,collection)===id);assert(record&&record.active===false&&record.validity==='INVALIDATED',`${collection} was resurrected after custody repair.`);}
assert(custody.projectData.history.some(event=>event.type==='APPLICATION_ARTIFACT_CUSTODY_BLOCKED')&&custody.projectData.history.some(event=>event.type==='APPLICATION_ARTIFACT_CUSTODY_RESTORED'),'Custody failure/recovery history is incomplete.');

console.log(JSON.stringify({projectLifecycleControls:true,compactHeader:true,mobileProjectActionsVisible:true,dangerHiddenByDefault:true,transactionalDeleteRetained:true,lifecycleMetadataDeleteAtomic:true,durableAttemptAbandonment:true,canonicalBlobReverification:true,applicationCustodyBlocking:true,custodyFailureRecoveryBehavior:true,staleDeliveryAuthorizationNotResurrected:true,perProjectBackupState:true,zeroLossAcceptanceReduction:true,unsafeOverrides:0}));