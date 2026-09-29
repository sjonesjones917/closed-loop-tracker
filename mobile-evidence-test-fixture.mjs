// Synthetic validator inputs only. These declarations are never device evidence.
// Each observation spells out the independent acceptance contract being tested.
export function syntheticMobileOperations(target){
 const buildIdentity='build-sha256-'+ 'f'.repeat(64),file={sha256:'b'.repeat(64),byteSize:32,filename:'fixture.txt',selectedFilename:'fixture.txt',verification:'EXPORTED_BYTES_SELECTED_AND_REHASHED'};
 const backup={...file,packageSha256:'c'.repeat(64),testProjectId:target.testProjectId,restoredRevision:4,verification:'SELECTED_EXPORTED_BYTES_IMPORTED_AND_VERIFIED'};
 const observation={
  PROJECT_CREATED:{createdProjectId:target.testProjectId,revision:0},
  RAW_FILE_INTAKE:{stage:1,files:[{...file,artifactId:'FIXTURE-ARTIFACT'}]},
  PROMPT_FILE_EXPORTED_OR_SHARED:{...file},
  INPUT_FILE_ATTACHMENT_INSTRUCTIONS_CONFIRMED:{...file},
  RESPONSE_JSON_SELECTED_AND_INGESTED:{...file,rawResponseId:'FIXTURE-RAW',stage:1},
  RETURNED_FILE_SLOTS_SELECTED:{slotId:'FIXTURE-SLOT',rawResponseId:'FIXTURE-RAW',artifactId:'FIXTURE-ARTIFACT',sha256:file.sha256},
  VALIDATION_FAILURE_RECOVERED:{rawResponseId:'FIXTURE-CORRECTED',validationId:'FIXTURE-VALIDATION',rejectedReceiptId:'FIXTURE-REJECTION',rejectedResponseId:'FIXTURE-REJECTED',valid:true},
  PROPOSAL_REVIEWED_AND_ACCEPTED:{proposalId:'FIXTURE-PROPOSAL',rawResponseId:'FIXTURE-CORRECTED',stage:1},
  PERSISTENCE_RELOAD_VERIFIED:{projectSha256:'d'.repeat(64),readBackProjectSha256:'d'.repeat(64),tabId:'BEFORE',reloadedTabId:'AFTER',revision:3},
  ARTIFACT_DOWNLOAD_OR_SHARE_VERIFIED:{...file},
  LOGICAL_EXECUTION_PACKAGE_EXPORTED:{...file},
  BACKUP_EXPORTED:{...backup},
  BACKUP_RESTORED_FROM_EXPORTED_COPY:{...backup},
  ACCESSIBILITY_AND_OVERFLOW_VERIFIED:{horizontalOverflowPx:0,minimumPrimaryTextPx:16,minimumSecondaryTextPx:14,minimumTouchTargetPx:44,focusTarget:'PANEL',liveRegion:'STATUS',liveAnnouncement:'ACTUAL DOM TEXT'},
  DEPLOYED_BUILD_IDENTITY_VERIFIED:{buildIdentity,resources:['app-core.js','test-runtime.js','test-worker.js','project-store.js'].map(path=>({path,sha256:file.sha256,byteSize:32}))},
  RUNTIME_EXCEPTION_CHECK_COMPLETED:{runtimeExceptions:0,unhandledRejections:0,observedTabs:['FIXTURE-TAB']}
 };
 const binding=Object.fromEntries(['challenge','sourceCommit','deploymentManifestDigest','origin','basePath','testProjectId','procedureVersion'].map(key=>[key,target[key]]));
 return {buildIdentity,operationReceipts:Object.entries(observation).map(([kind,value],i)=>({kind,receiptId:'SYNTHETIC-'+i,result:'PASS',...binding,targetId:target.mobileAcceptanceTargetId,buildIdentity,evidenceBasis:'APPLICATION_OBSERVATION',recordedAt:target.challengeIssuedAt,observation:value})),mobileCapabilityProbe:{...binding,targetId:target.mobileAcceptanceTargetId,probeId:'SYNTHETIC-PROBE',result:'PASS',evidenceBasis:'APPLICATION_OBSERVATION',capabilities:{FILE_EXPORT_OR_SHARE:true,RESPONSE_FILE_SELECTION:true,RETURNED_FILE_SLOT_SELECTION:true,PERSISTENT_STORAGE_REQUEST:true,LOGICAL_PACKAGE_EXPORT:true,BACKUP_EXPORT_AND_RESTORE:true},observations:{selectedMembers:{RESPONSE:{...file},RETURNED:{...file},MANIFEST:{...file}},persistenceRequest:{completed:true,persistent:false},backupRestore:backup}}};
}
