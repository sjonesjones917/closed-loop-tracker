import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
// Synthetic validator inputs only. These declarations are never device evidence.
// Each observation spells out the independent acceptance contract being tested.
export function syntheticMobileTargetFacts({performer='SYNTHETIC-PERFORMER',buildIdentity='build-sha256-'+ 'f'.repeat(64),deviceModel='UNKNOWN'}={}){
 return {performer,identityAssurance:'SELF_ASSERTED',buildIdentity,preparationId:'SYNTHETIC-PREPARATION',iosBuild:'UNKNOWN',webkitBuild:'UNKNOWN',requiredEvidenceArtifacts:['screenshotOrRecordingReferences','operationReceipts','runtimeFindings','exportedProjectDigest'],unavailableEnvironmentFacts:[...(deviceModel==='UNKNOWN'?['deviceModel']:[]),'iosBuild','webkitBuild'].map(fact=>({fact,reason:'Synthetic fixture records the unavailable fact honestly.',evidenceBasis:'HUMAN_OBSERVATION'}))};
}
let initialProjectRuntime;
export function syntheticMobileOperations(target){
 const buildIdentity=target.buildIdentity||'build-sha256-'+ 'f'.repeat(64),file={sha256:'b'.repeat(64),byteSize:32,filename:'fixture.txt',selectedFilename:'fixture.txt',verification:'EXPORTED_BYTES_SELECTED_AND_REHASHED'};
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
 initialProjectRuntime||=projectStoreRuntime();
 const initialProject=initialProjectRuntime.core.createBlankState(target.testProjectId);initialProjectRuntime.engine.ensureShape(initialProject);initialProjectRuntime.engine.recalculate(initialProject);
 const initialBytes=gzipSync(Buffer.from(JSON.stringify({schema:'closed-loop-project-package/1',projectSchema:initialProject.schema,workflow:initialProject.workflow,project:initialProject,packageManifest:{jobId:target.testProjectId,projectSha256:initialProjectRuntime.store.projectSha256(initialProject)}})));
 const preparation={schema:'closed-loop-mobile-acceptance-preparation/1',...binding,preparationId:target.preparationId,targetId:target.mobileAcceptanceTargetId,buildIdentity,recordedAt:target.challengeIssuedAt,evidenceBasis:'APPLICATION_OBSERVATION',initialProjectPackage:{testProjectId:target.testProjectId,mediaType:'application/gzip',base64:initialBytes.toString('base64'),sha256:createHash('sha256').update(initialBytes).digest('hex'),byteSize:initialBytes.length,capturedAt:target.challengeIssuedAt},storageObservations:{persistent:false,quotaBytes:1024,usageBytes:0,recordedAt:target.challengeIssuedAt,evidenceBasis:'APPLICATION_OBSERVATION',unavailableReasons:{}}};
 return {buildIdentity,preparation,operationReceipts:Object.entries(observation).map(([kind,value],i)=>({kind,receiptId:'SYNTHETIC-'+i,result:'PASS',...binding,targetId:target.mobileAcceptanceTargetId,buildIdentity,evidenceBasis:'APPLICATION_OBSERVATION',recordedAt:target.challengeIssuedAt,observation:value})),mobileCapabilityProbe:{...binding,targetId:target.mobileAcceptanceTargetId,probeId:'SYNTHETIC-PROBE',recordedAt:target.challengeIssuedAt,result:'PASS',evidenceBasis:'APPLICATION_OBSERVATION',capabilities:{FILE_EXPORT_OR_SHARE:true,RESPONSE_FILE_SELECTION:true,RETURNED_FILE_SLOT_SELECTION:true,PERSISTENT_STORAGE_REQUEST:true,LOGICAL_PACKAGE_EXPORT:true,BACKUP_EXPORT_AND_RESTORE:true},observations:{selectedMembers:{RESPONSE:{...file},RETURNED:{...file},MANIFEST:{...file}},persistenceRequest:{completed:true,persistent:false},backupRestore:backup}}};
}
