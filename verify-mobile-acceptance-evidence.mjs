import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import fs from 'node:fs';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {constants as bufferConstants} from 'node:buffer';
import {gunzipSync} from 'node:zlib';

export const MOBILE_ACCEPTANCE_ORIGIN='https://sjonesjones917.github.io';
export const MOBILE_ACCEPTANCE_BASE_PATH='/closed-loop-tracker/';
export const ACCEPTABLE_PHYSICAL_EVIDENCE_BASES=Object.freeze(['HUMAN_OBSERVATION','VERIFIED_EXTERNAL']);
export const REQUIRED_MOBILE_RECEIPT_KINDS=Object.freeze([
  'PROJECT_CREATED',
  'RAW_FILE_INTAKE',
  'PROMPT_FILE_EXPORTED_OR_SHARED',
  'INPUT_FILE_ATTACHMENT_INSTRUCTIONS_CONFIRMED',
  'RESPONSE_JSON_SELECTED_AND_INGESTED',
  'RETURNED_FILE_SLOTS_SELECTED',
  'VALIDATION_FAILURE_RECOVERED',
  'PROPOSAL_REVIEWED_AND_ACCEPTED',
  'PERSISTENCE_RELOAD_VERIFIED',
  'ARTIFACT_DOWNLOAD_OR_SHARE_VERIFIED',
  'LOGICAL_EXECUTION_PACKAGE_EXPORTED',
  'BACKUP_EXPORTED',
  'BACKUP_RESTORED_FROM_EXPORTED_COPY',
  'ACCESSIBILITY_AND_OVERFLOW_VERIFIED',
  'DEPLOYED_BUILD_IDENTITY_VERIFIED',
  'RUNTIME_EXCEPTION_CHECK_COMPLETED'
]);
export const REQUIRED_MOBILE_CAPABILITY_PROBE_KEYS=Object.freeze([
  'FILE_EXPORT_OR_SHARE',
  'RESPONSE_FILE_SELECTION',
  'RETURNED_FILE_SLOT_SELECTION',
  'PERSISTENT_STORAGE_REQUEST',
  'LOGICAL_PACKAGE_EXPORT',
  'BACKUP_EXPORT_AND_RESTORE'
]);

const NONEMPTY=value=>typeof value==='string'&&value.trim().length>0;
const HEX_128_OR_MORE=value=>typeof value==='string'&&/^[0-9a-fA-F]{32,}$/.test(value);
const SHA256=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const COMMIT_SHA=value=>typeof value==='string'&&/^[0-9a-f]{40}$/.test(value);
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const STRICT_UTC_INSTANT=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function isClosedLoopUtcInstant(value){
  if(typeof value!=='string'||!STRICT_UTC_INSTANT.test(value))return false;
  const parsed=Date.parse(value);
  return Number.isFinite(parsed)&&new Date(parsed).toISOString()===value;
}

function issue(errors,code,message){errors.push({code,message});}
function same(actual,expected){return actual===expected;}
export const REQUIRED_MOBILE_EVIDENCE_ARTIFACTS=Object.freeze(['screenshotOrRecordingReferences','operationReceipts','runtimeFindings','exportedProjectDigest']);

// Governance target validation is shared by its producer and final consumer.
// Preparation bytes are produced by the application, not the external actor.
export function validateMobileAcceptanceTarget(target){
  const errors=[];
  if(!target||typeof target!=='object'||Array.isArray(target)){issue(errors,'TARGET_REQUIRED','Pinned mobile acceptance target is required.');return errors;}
  if(!NONEMPTY(target.mobileAcceptanceTargetId))issue(errors,'TARGET_ID_REQUIRED','mobileAcceptanceTargetId is required.');
  if(!NONEMPTY(target.preparationId))issue(errors,'TARGET_PREPARATION_ID_REQUIRED','preparationId is required.');
  if(target.physicalDeviceRequired!==true)issue(errors,'PHYSICAL_DEVICE_REQUIRED','The target must require a physical device.');
  if(!HEX_128_OR_MORE(target.challenge))issue(errors,'CHALLENGE_INVALID','Challenge must contain at least 128 bits encoded as hexadecimal.');
  if(!isClosedLoopUtcInstant(target.challengeIssuedAt)||!isClosedLoopUtcInstant(target.challengeExpiresAt))issue(errors,'CHALLENGE_TIME_INVALID','Challenge issue and expiry times must use canonical UTC instants.');
  if(isClosedLoopUtcInstant(target.challengeIssuedAt)&&isClosedLoopUtcInstant(target.challengeExpiresAt)&&Date.parse(target.challengeExpiresAt)<=Date.parse(target.challengeIssuedAt))issue(errors,'CHALLENGE_WINDOW_INVALID','Challenge expiry must be later than challenge issue time.');
  if(!COMMIT_SHA(target.sourceCommit))issue(errors,'TARGET_COMMIT_INVALID','Target sourceCommit must be an exact 40-character commit SHA.');
  if(!SHA256(target.deploymentManifestDigest))issue(errors,'TARGET_MANIFEST_DIGEST_INVALID','Target deploymentManifestDigest must be a SHA-256 digest.');
  if(target.origin!==MOBILE_ACCEPTANCE_ORIGIN)issue(errors,'TARGET_ORIGIN_INVALID','Target origin must be the canonical deployment origin.');
  if(target.basePath!==MOBILE_ACCEPTANCE_BASE_PATH)issue(errors,'TARGET_BASE_PATH_INVALID','Target basePath must be the canonical deployment base path.');
  for(const field of ['testProjectId','procedureVersion','performer','identityAssurance','buildIdentity'])if(!NONEMPTY(target[field]))issue(errors,'TARGET_FROZEN_FACT_REQUIRED',`Target ${field} is required before the acceptance run.`);
  for(const field of ['deviceModel','iosVersion','iosBuild','safariVersion','webkitBuild','safariUserAgent'])if(!NONEMPTY(target[field]))issue(errors,'TARGET_DEVICE_FACT_INVALID',`Target ${field} must be a non-empty pinned physical-device fact or permitted UNKNOWN.`);
  if(target.iosVersion==='UNKNOWN'||target.safariUserAgent==='UNKNOWN')issue(errors,'TARGET_MINIMUM_IDENTITY_REQUIRED','Target iosVersion and safariUserAgent must be reported observations, not UNKNOWN.');
  if(NONEMPTY(target.safariUserAgent)&&(!/(iPhone|iPod)/.test(target.safariUserAgent)||!/Safari\//.test(target.safariUserAgent)||/(CriOS|FxiOS|EdgiOS|OPiOS)/.test(target.safariUserAgent)))issue(errors,'TARGET_SAFARI_USER_AGENT_INVALID','Target safariUserAgent must identify Safari on the pinned iPhone.');
  if(!target.viewport||!finite(target.viewport?.width)||!finite(target.viewport?.height)||!finite(target.viewport?.devicePixelRatio)||target.viewport?.width<=0||target.viewport?.height<=0||target.viewport?.devicePixelRatio<=0)issue(errors,'TARGET_VIEWPORT_INVALID','Target viewport dimensions and device-pixel ratio are required.');
  const unavailable=target.unavailableEnvironmentFacts;
  if(!Array.isArray(unavailable)||unavailable.some(row=>!row||typeof row!=='object'||Array.isArray(row)||!NONEMPTY(row.fact)||!NONEMPTY(row.reason)||!NONEMPTY(row.evidenceBasis))||new Set((Array.isArray(unavailable)?unavailable:[]).map(row=>row?.fact)).size!==(Array.isArray(unavailable)?unavailable.length:0))issue(errors,'TARGET_UNAVAILABLE_FACTS_INVALID','unavailableEnvironmentFacts must contain unique fact, reason and actual evidenceBasis records.');
  if(Array.isArray(unavailable))for(const row of unavailable)if(row&&Object.hasOwn(target,row.fact)&&target[row.fact]!=='UNKNOWN')issue(errors,'TARGET_UNAVAILABLE_FACT_CONTRADICTED',`Target ${row.fact} is both reported known and declared unavailable.`);
  for(const field of ['deviceModel','iosBuild','safariVersion','webkitBuild'])if(target[field]==='UNKNOWN'&&!(Array.isArray(unavailable)&&unavailable.some(row=>row?.fact===field&&NONEMPTY(row.reason)&&NONEMPTY(row.evidenceBasis))))issue(errors,'TARGET_UNKNOWN_FACT_UNEXPLAINED',`Target ${field} is UNKNOWN without its recorded reason and epistemic basis.`);
  if(!Array.isArray(target.requiredEvidenceArtifacts)||target.requiredEvidenceArtifacts.length!==REQUIRED_MOBILE_EVIDENCE_ARTIFACTS.length||!REQUIRED_MOBILE_EVIDENCE_ARTIFACTS.every(field=>target.requiredEvidenceArtifacts.includes(field)))issue(errors,'TARGET_REQUIRED_EVIDENCE_INVALID','requiredEvidenceArtifacts must freeze the required screenshot/recording references, operation receipts, runtime findings and project export.');
  return errors;
}

let mobileProjectAuthority;
function projectAuthority(){
  if(mobileProjectAuthority)return mobileProjectAuthority;
  // Only trusted checkout owners are evaluated. This namespace has no database
  // or localStorage and cannot read or write an operator project.
  const root=new URL('.',import.meta.url),context=createVerifierRuntime({TextEncoder,TextDecoder,Blob,Response,CompressionStream,DecompressionStream,crypto:webcrypto,URL,URLSearchParams,structuredClone,setTimeout,clearTimeout,queueMicrotask,atob,btoa,console,navigator:{},localStorage:null,sessionStorage:null,dispatchEvent(){},Event:class Event{}},{codeGeneration:{strings:false,wasm:false}});
  for(const name of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])createVerifierRuntime.loadScript(context,fs.readFileSync(new URL(name,root),'utf8'),{filename:name,timeout:5000});
  mobileProjectAuthority={store:context.closedLoopProjectStore,schema:context.closedLoopWorkflowSchema,parse:createVerifierRuntime.loadScript(context,'JSON.parse')};
  return mobileProjectAuthority;
}
// This synchronous JSON consumer cannot construct a string beyond the Node
// platform ceiling. This is not the unrelated Test IR decompression limit.
// maxOutputLength prevents an unbounded gzip expansion before JSON parsing;
// it is a platform safety bound, not a claim of heap/capacity verification.
export function decodeMobileInitialPackage(base64,{maxOutputLength=bufferConstants.MAX_STRING_LENGTH,expectedByteSize,expectedSha256}={}){
  if(typeof base64!=='string'||base64.length>bufferConstants.MAX_STRING_LENGTH)throw new Error('Initial package base64 exceeds the synchronous consumer platform string limit.');
  const bytes=Buffer.from(base64,'base64');
  if(bytes.toString('base64')!==base64)throw new Error('Initial package base64 is not canonical.');
  if(expectedByteSize!==undefined&&bytes.length!==expectedByteSize||expectedSha256!==undefined&&createHash('sha256').update(bytes).digest('hex')!==expectedSha256)throw new Error('Initial package exact bytes do not match the frozen identity.');
  return {bytes,pkg:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(gunzipSync(bytes,{maxOutputLength})))};
}

function validateMobilePreparation(errors,preparation,target,probe,receipts){
  if(!preparation||typeof preparation!=='object'||Array.isArray(preparation)){issue(errors,'MOBILE_PREPARATION_REQUIRED','The persisted application preparation record is required.');return;}
  if(preparation.schema!=='closed-loop-mobile-acceptance-preparation/1'||preparation.evidenceBasis!=='APPLICATION_OBSERVATION')issue(errors,'MOBILE_PREPARATION_INVALID','Preparation must be the application-recorded initial package and storage observations.');
  for(const field of ['preparationId','challenge','sourceCommit','deploymentManifestDigest','origin','basePath','testProjectId','procedureVersion','buildIdentity'])if(preparation[field]!==target[field])issue(errors,'MOBILE_PREPARATION_BINDING_MISMATCH',`Preparation ${field} differs from the frozen target.`);
  if(preparation.targetId!==target.mobileAcceptanceTargetId)issue(errors,'MOBILE_PREPARATION_BINDING_MISMATCH','Preparation targetId differs from the frozen target.');
  const recorded=preparation.recordedAt;
  if(!isClosedLoopUtcInstant(recorded)||Date.parse(recorded)<Date.parse(target.challengeIssuedAt)||Date.parse(recorded)>Date.parse(target.challengeExpiresAt))issue(errors,'MOBILE_PREPARATION_TIME_INVALID','Preparation must be recorded inside the target challenge window.');
  if(!isClosedLoopUtcInstant(probe?.recordedAt)||Date.parse(probe.recordedAt)<Date.parse(recorded))issue(errors,'MOBILE_PREPARATION_TIME_INVALID','The capability probe must follow the recorded initial preparation.');
  for(const receipt of receipts)if(!['PROJECT_CREATED','DEPLOYED_BUILD_IDENTITY_VERIFIED'].includes(receipt?.kind)&&isClosedLoopUtcInstant(receipt?.recordedAt)&&Date.parse(receipt.recordedAt)<Date.parse(recorded))issue(errors,'MOBILE_PREPARATION_TIME_INVALID','Substantive acceptance operations must follow preparation.');
  const initial=preparation.initialProjectPackage;
  try{
    if(!initial||initial.testProjectId!==target.testProjectId||initial.mediaType!=='application/gzip'||!Number.isSafeInteger(initial.byteSize)||initial.byteSize<=0||!SHA256(initial.sha256)||!NONEMPTY(initial.base64)||!isClosedLoopUtcInstant(initial.capturedAt)||Date.parse(initial.capturedAt)>Date.parse(recorded)||Date.parse(initial.capturedAt)<Date.parse(target.challengeIssuedAt))throw new Error('Initial package identity, encoding and capture time are required.');
    const {pkg}=decodeMobileInitialPackage(initial.base64,{expectedByteSize:initial.byteSize,expectedSha256:initial.sha256}),project=pkg?.project;
    if(pkg?.schema!=='closed-loop-project-package/1'||project?.job?.JOB_ID!==target.testProjectId||pkg?.packageManifest?.jobId!==target.testProjectId||project?.activeStage!==1||project?.job?.CURRENT_STAGE!=='STAGE 01'||!project?.projectData||typeof project.projectData!=='object'||Array.isArray(project.projectData)||['rawResponses','responseProposals','acceptedChanges','generatedPrompts','responseRecords','proposals'].some(family=>Object.hasOwn(project.projectData,family)&&(!Array.isArray(project.projectData[family])||project.projectData[family].length)))throw new Error('Initial package is not the pinned newly created project before acceptance work.');
    const authority=projectAuthority(),canonical=authority.parse(JSON.stringify(project)),integrity=authority.store.validateProjectIntegrity(canonical,{verifyDerived:false});
    if(!integrity.valid||pkg.projectSchema!==authority.schema.PROJECT_SCHEMA||pkg.workflow!==authority.schema.WORKFLOW_ID||pkg.packageManifest.projectSha256!==authority.store.projectSha256(canonical))throw new Error('Initial package canonical project integrity or project digest is invalid.');
  }catch(error){issue(errors,'MOBILE_INITIAL_PACKAGE_INVALID',error.message);}
  const storage=preparation.storageObservations;
  if(!storage||typeof storage!=='object'||Array.isArray(storage)||storage.evidenceBasis!=='APPLICATION_OBSERVATION'||!isClosedLoopUtcInstant(storage.recordedAt)||Date.parse(storage.recordedAt)>Date.parse(recorded)||Date.parse(storage.recordedAt)<Date.parse(target.challengeIssuedAt)){issue(errors,'MOBILE_STORAGE_OBSERVATIONS_INVALID','Application-observed storage facts and their time are required.');return;}
  for(const field of ['persistent','quotaBytes','usageBytes']){
    const value=storage[field],valid=field==='persistent'?typeof value==='boolean':finite(value)&&value>=0;
    if(!valid&&(value!=='UNKNOWN'||!NONEMPTY(storage.unavailableReasons?.[field])))issue(errors,'MOBILE_STORAGE_OBSERVATIONS_INVALID',`Storage ${field} requires its observed value or explicit UNKNOWN reason.`);
  }
}

function operationObserved(kind,o,target){
  if(!o||typeof o!=='object')return false;
  const file=value=>SHA256(value?.sha256)&&Number.isSafeInteger(value?.byteSize)&&value.byteSize>=0;
  if(['PROMPT_FILE_EXPORTED_OR_SHARED','INPUT_FILE_ATTACHMENT_INSTRUCTIONS_CONFIRMED','ARTIFACT_DOWNLOAD_OR_SHARE_VERIFIED','LOGICAL_EXECUTION_PACKAGE_EXPORTED'].includes(kind))return file(o)&&NONEMPTY(o.selectedFilename)&&o.verification==='EXPORTED_BYTES_SELECTED_AND_REHASHED';
  if(['BACKUP_EXPORTED','BACKUP_RESTORED_FROM_EXPORTED_COPY'].includes(kind))return file(o)&&SHA256(o.packageSha256)&&o.testProjectId===target.testProjectId&&o.verification==='SELECTED_EXPORTED_BYTES_IMPORTED_AND_VERIFIED';
  switch(kind){
    case 'PROJECT_CREATED':return o.createdProjectId===target.testProjectId&&Number.isSafeInteger(o.revision);
    case 'RAW_FILE_INTAKE':return o.stage===1&&Array.isArray(o.files)&&o.files.length>0&&o.files.every(x=>file(x)&&NONEMPTY(x.artifactId));
    case 'RESPONSE_JSON_SELECTED_AND_INGESTED':return file(o)&&NONEMPTY(o.rawResponseId)&&Number.isSafeInteger(o.stage);
    case 'RETURNED_FILE_SLOTS_SELECTED':return NONEMPTY(o.slotId)&&NONEMPTY(o.rawResponseId)&&NONEMPTY(o.artifactId)&&SHA256(o.sha256);
    case 'VALIDATION_FAILURE_RECOVERED':return o.valid===true&&NONEMPTY(o.rawResponseId)&&NONEMPTY(o.validationId)&&NONEMPTY(o.rejectedReceiptId)&&NONEMPTY(o.rejectedResponseId);
    case 'PROPOSAL_REVIEWED_AND_ACCEPTED':return NONEMPTY(o.proposalId)&&NONEMPTY(o.rawResponseId)&&Number.isSafeInteger(o.stage);
    case 'PERSISTENCE_RELOAD_VERIFIED':return SHA256(o.projectSha256)&&o.projectSha256===o.readBackProjectSha256&&NONEMPTY(o.tabId)&&NONEMPTY(o.reloadedTabId)&&o.tabId!==o.reloadedTabId&&Number.isSafeInteger(o.revision);
    case 'ACCESSIBILITY_AND_OVERFLOW_VERIFIED':return finite(o.horizontalOverflowPx)&&o.horizontalOverflowPx<=1&&o.minimumPrimaryTextPx>=16&&o.minimumSecondaryTextPx>=14&&o.minimumTouchTargetPx>=44&&NONEMPTY(o.focusTarget)&&NONEMPTY(o.liveRegion)&&NONEMPTY(o.liveAnnouncement);
    case 'DEPLOYED_BUILD_IDENTITY_VERIFIED':return NONEMPTY(o.buildIdentity)&&Array.isArray(o.resources)&&['app-core.js','test-runtime.js','test-worker.js','project-store.js'].every(path=>o.resources.some(r=>r.path===path&&file(r)));
    case 'RUNTIME_EXCEPTION_CHECK_COMPLETED':return o.runtimeExceptions===0&&o.unhandledRejections===0&&Array.isArray(o.observedTabs)&&o.observedTabs.length>0;
    default:return false;
  }
}

function validateCapabilityProbe(errors,probe,target){
  if(!probe||typeof probe!=='object'||Array.isArray(probe)){
    issue(errors,'MOBILE_CAPABILITY_PROBE_REQUIRED','A recorded MOBILE_CAPABILITY_PROBE is required before the physical acceptance run.');
    return;
  }
  if(!NONEMPTY(probe.probeId))issue(errors,'MOBILE_CAPABILITY_PROBE_ID_REQUIRED','MOBILE_CAPABILITY_PROBE must have an application-recorded probeId.');
  if(probe.result!=='PASS')issue(errors,'MOBILE_CAPABILITY_PROBE_BLOCKED','MOBILE_CAPABILITY_PROBE must be PASS; a missing, false, or unknown required capability blocks physical acceptance.');
  const capabilities=probe.capabilities;
  if(!capabilities||typeof capabilities!=='object'||Array.isArray(capabilities)){
    issue(errors,'MOBILE_CAPABILITY_PROBE_CAPABILITIES_REQUIRED','MOBILE_CAPABILITY_PROBE capabilities are required.');
    return;
  }
  const keys=Object.keys(capabilities);
  for(const key of keys){if(!REQUIRED_MOBILE_CAPABILITY_PROBE_KEYS.includes(key))issue(errors,'MOBILE_CAPABILITY_PROBE_UNKNOWN_CAPABILITY',`Unknown MOBILE_CAPABILITY_PROBE capability ${key}.`);}
  for(const key of REQUIRED_MOBILE_CAPABILITY_PROBE_KEYS){
    if(capabilities[key]!==true)issue(errors,'MOBILE_CAPABILITY_PROBE_CAPABILITY_UNAVAILABLE',`Required mobile capability ${key} is not affirmatively available.`);
  }
  if(probe.evidenceBasis!=='APPLICATION_OBSERVATION'||!probe.observations)issue(errors,'MOBILE_CAPABILITY_OBSERVATIONS_REQUIRED','API availability and declared success do not establish executed capability operations.');
  for(const field of ['challenge','sourceCommit','deploymentManifestDigest','origin','basePath','testProjectId','procedureVersion'])if(probe[field]!==target[field])issue(errors,'MOBILE_CAPABILITY_BINDING_MISMATCH',`Capability probe ${field} differs from the pinned target.`);
  if(probe.targetId!==target.mobileAcceptanceTargetId)issue(errors,'MOBILE_CAPABILITY_BINDING_MISMATCH','Capability probe target identity differs.');
  const observed=probe.observations||{},members=observed.selectedMembers||{};
  for(const role of ['RESPONSE','RETURNED','MANIFEST'])if(!SHA256(members[role]?.sha256)||!NONEMPTY(members[role]?.selectedFilename)||!Number.isSafeInteger(members[role]?.byteSize)||members[role].byteSize<0)issue(errors,'MOBILE_CAPABILITY_FILE_OBSERVATION_REQUIRED',`Selected exported ${role} member bytes were not recorded.`);
  if(observed.persistenceRequest?.completed!==true)issue(errors,'MOBILE_CAPABILITY_STORAGE_OBSERVATION_REQUIRED','The actual persistent-storage request result is required.');
  if(!SHA256(observed.backupRestore?.sha256)||!SHA256(observed.backupRestore?.packageSha256)||observed.backupRestore?.testProjectId!==target.testProjectId||observed.backupRestore?.verification!=='SELECTED_EXPORTED_BYTES_IMPORTED_AND_VERIFIED')issue(errors,'MOBILE_CAPABILITY_BACKUP_OBSERVATION_REQUIRED','An actual import of selected exported backup bytes is required.');
}

export function verifyMobileAcceptanceEvidence({target,evidence,expected={},usedChallenges=[]}={}){
  const errors=[];
  const used=new Set((Array.isArray(usedChallenges)?usedChallenges:[...usedChallenges]).filter(NONEMPTY).map(value=>value.toLowerCase()));
  if(!target||typeof target!=='object'||Array.isArray(target))issue(errors,'TARGET_REQUIRED','Pinned mobile acceptance target is required.');
  if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))issue(errors,'EVIDENCE_REQUIRED','Physical-device evidence is required.');
  if(errors.length)return {accepted:false,status:'BLOCKED',errors};

  errors.push(...validateMobileAcceptanceTarget(target));
  if(HEX_128_OR_MORE(target.challenge)&&used.has(target.challenge.toLowerCase()))issue(errors,'CHALLENGE_REUSED','The mobile acceptance challenge was already accepted.');
  const verificationTime=expected.verificationTime||new Date().toISOString();
  if(!isClosedLoopUtcInstant(verificationTime))issue(errors,'VERIFICATION_TIME_INVALID','Verification time must use the closed UTC instant contract.');
  if(isClosedLoopUtcInstant(target.challengeExpiresAt)&&isClosedLoopUtcInstant(verificationTime)&&Date.parse(verificationTime)>Date.parse(target.challengeExpiresAt))issue(errors,'CHALLENGE_EXPIRED','The mobile acceptance challenge is expired.');

  if(expected.sourceCommit&&!same(target.sourceCommit,expected.sourceCommit))issue(errors,'TARGET_COMMIT_MISMATCH','Target commit does not match the exact deployed commit.');
  if(expected.deploymentManifestDigest&&!same(target.deploymentManifestDigest,expected.deploymentManifestDigest))issue(errors,'TARGET_MANIFEST_MISMATCH','Target deployment manifest digest does not match the exact deployed build.');
  if(expected.origin&&!same(target.origin,expected.origin))issue(errors,'TARGET_EXPECTED_ORIGIN_MISMATCH','Target origin does not match the expected origin.');
  if(expected.basePath&&!same(target.basePath,expected.basePath))issue(errors,'TARGET_EXPECTED_BASE_PATH_MISMATCH','Target base path does not match the expected base path.');

  const bindings=[
    ['mobileAcceptanceTargetId','TARGET_ID_MISMATCH'],
    ['challenge','CHALLENGE_MISMATCH'],
    ['sourceCommit','EVIDENCE_COMMIT_MISMATCH'],
    ['deploymentManifestDigest','EVIDENCE_MANIFEST_MISMATCH'],
    ['origin','EVIDENCE_ORIGIN_MISMATCH'],
    ['basePath','EVIDENCE_BASE_PATH_MISMATCH'],
    ['testProjectId','EVIDENCE_TEST_PROJECT_MISMATCH'],
    ['procedureVersion','EVIDENCE_PROCEDURE_MISMATCH']
  ];
  for(const [field,code] of bindings){if(!same(evidence[field],target[field]))issue(errors,code,`Evidence ${field} does not match the pinned target.`);}
  for(const field of ['deviceModel','iosVersion','iosBuild','safariVersion','webkitBuild','safariUserAgent'])if(target[field]!==undefined&&evidence[field]!==target[field])issue(errors,'EVIDENCE_DEVICE_FACT_MISMATCH',`Evidence ${field} does not match the pinned target.`);
  if(!NONEMPTY(evidence.mobileAcceptanceEvidenceId))issue(errors,'EVIDENCE_ID_REQUIRED','mobileAcceptanceEvidenceId is required.');
  if(evidence.physicalDeviceAssertion!==true)issue(errors,'PHYSICAL_DEVICE_ASSERTION_REQUIRED','Evidence must contain the performer physical-device assertion.');
  if(!ACCEPTABLE_PHYSICAL_EVIDENCE_BASES.includes(evidence.evidenceBasis))issue(errors,'EVIDENCE_BASIS_INSUFFICIENT','Physical-device evidence basis must be HUMAN_OBSERVATION or VERIFIED_EXTERNAL.');
  // No physical-device attestation verifier is registered in this runtime.
  // A submitted label or contract name cannot establish verified authority.
  if(evidence.evidenceBasis==='VERIFIED_EXTERNAL')issue(errors,'MOBILE_ATTESTATION_UNVERIFIED','Verified external physical-device evidence requires a registered attestation-verification contract.');
  for(const field of ['performer','identityAssurance','buildIdentity'])if(evidence[field]!==target[field])issue(errors,'EVIDENCE_FROZEN_FACT_MISMATCH',`Evidence ${field} differs from the frozen target.`);
  if(!NONEMPTY(evidence.performer))issue(errors,'PERFORMER_REQUIRED','Evidence performer identity is required.');
  if(!NONEMPTY(evidence.identityAssurance))issue(errors,'IDENTITY_ASSURANCE_REQUIRED','Evidence performer identity assurance is required.');
  if(!NONEMPTY(evidence.iosVersion))issue(errors,'IOS_VERSION_REQUIRED','Reported iOS version is required.');
  if(!NONEMPTY(evidence.safariUserAgent)||!/(iPhone|iPod)/.test(evidence.safariUserAgent)||!/Safari\//.test(evidence.safariUserAgent)||/(CriOS|FxiOS|EdgiOS|OPiOS)/.test(evidence.safariUserAgent))issue(errors,'SAFARI_USER_AGENT_INVALID','Evidence must identify Safari on the pinned iPhone target and reject substitute browsers.');
  if(!evidence.viewport||!same(evidence.viewport.width,target.viewport?.width)||!same(evidence.viewport.height,target.viewport?.height)||!same(evidence.viewport.devicePixelRatio,target.viewport?.devicePixelRatio))issue(errors,'VIEWPORT_MISMATCH','Evidence viewport must match the pinned target exactly.');

  validateCapabilityProbe(errors,evidence.mobileCapabilityProbe,target);
  if(!NONEMPTY(evidence.buildIdentity))issue(errors,'EVIDENCE_BUILD_IDENTITY_REQUIRED','The application running build identity is required.');
  if(expected.buildIdentity&&evidence.buildIdentity!==expected.buildIdentity)issue(errors,'EVIDENCE_BUILD_IDENTITY_MISMATCH','The running build identity differs from the deployed build.');

  const receipts=Array.isArray(evidence.operationReceipts)?evidence.operationReceipts:[];
  validateMobilePreparation(errors,evidence.preparation,target,evidence.mobileCapabilityProbe,receipts);
  const kinds=new Set();
  for(const receipt of receipts){
    if(!receipt||typeof receipt!=='object'||!NONEMPTY(receipt.kind)||!NONEMPTY(receipt.receiptId)){issue(errors,'RECEIPT_INVALID','Every mobile acceptance receipt must contain kind and receiptId.');continue;}
    if(kinds.has(receipt.kind))issue(errors,'DUPLICATE_RECEIPT_KIND',`Receipt kind ${receipt.kind} is duplicated.`);
    kinds.add(receipt.kind);
    if(receipt.result!=='PASS')issue(errors,'RECEIPT_NOT_PASSING',`Receipt ${receipt.kind} did not pass.`);
    for(const field of ['challenge','sourceCommit','deploymentManifestDigest','origin','basePath','testProjectId','procedureVersion'])if(receipt[field]!==target[field])issue(errors,'RECEIPT_BINDING_MISMATCH',`Receipt ${receipt.kind} ${field} differs from the pinned target.`);
    if(receipt.targetId!==target.mobileAcceptanceTargetId||receipt.buildIdentity!==evidence.buildIdentity)issue(errors,'RECEIPT_BINDING_MISMATCH',`Receipt ${receipt.kind} target or build identity differs.`);
    if(receipt.evidenceBasis!=='APPLICATION_OBSERVATION'||!receipt.observation||typeof receipt.observation!=='object'||Array.isArray(receipt.observation)||!Object.keys(receipt.observation).length)issue(errors,'RECEIPT_OBSERVATION_REQUIRED',`Receipt ${receipt.kind} requires executed-operation evidence; a success flag is insufficient.`);
    else if(!operationObserved(receipt.kind,receipt.observation,target))issue(errors,'RECEIPT_OPERATION_EVIDENCE_INVALID',`Receipt ${receipt.kind} lacks the required operation-specific observation.`);
    if(receipt.kind==='DEPLOYED_BUILD_IDENTITY_VERIFIED'&&receipt.observation){
      const observed=receipt.observation,resources=observed.resources;
      if(observed.buildIdentity!==evidence.buildIdentity||(expected.runtimeResources&&(!Array.isArray(resources)||resources.length!==expected.runtimeResources.length||!expected.runtimeResources.every(resource=>resources.some(actual=>actual.path===resource.path&&actual.byteSize===resource.byteSize&&actual.sha256===resource.digest)))))issue(errors,'RECEIPT_DEPLOYMENT_MISMATCH','Observed build or resource identities differ from the deployed build.');
    }
    if(!isClosedLoopUtcInstant(receipt.recordedAt))issue(errors,'RECEIPT_TIME_INVALID',`Receipt ${receipt.kind} requires its observed UTC time.`);
  }
  for(const kind of REQUIRED_MOBILE_RECEIPT_KINDS){if(!kinds.has(kind))issue(errors,'REQUIRED_RECEIPT_MISSING',`Required mobile acceptance receipt ${kind} is missing.`);}

  const findings=evidence.runtimeFindings||{};
  if(findings.runtimeExceptions!==0)issue(errors,'RUNTIME_EXCEPTION_PRESENT','Physical-device run reported a runtime exception.');
  if(findings.unhandledRejections!==0)issue(errors,'UNHANDLED_REJECTION_PRESENT','Physical-device run reported an unhandled rejection.');
  const measurements=evidence.measurements||{};
  if(!finite(measurements.horizontalOverflowPx)||measurements.horizontalOverflowPx>1)issue(errors,'HORIZONTAL_OVERFLOW_INVALID','Horizontal overflow must be measured and at most 1 CSS px.');
  if(!finite(measurements.minimumPrimaryTextPx)||measurements.minimumPrimaryTextPx<16)issue(errors,'PRIMARY_TEXT_FLOOR_INVALID','Primary body and control text must be at least 16 CSS px.');
  if(!finite(measurements.minimumSecondaryTextPx)||measurements.minimumSecondaryTextPx<14)issue(errors,'SECONDARY_TEXT_FLOOR_INVALID','Secondary metadata must be at least 14 CSS px.');
  if(!finite(measurements.minimumTouchTargetPx)||measurements.minimumTouchTargetPx<44)issue(errors,'TOUCH_TARGET_FLOOR_INVALID','Interactive targets must meet the 44 CSS px minimum.');

  if(!NONEMPTY(evidence.exportedProjectDigest)||!SHA256(evidence.exportedProjectDigest))issue(errors,'EXPORTED_PROJECT_DIGEST_INVALID','Exported project digest must be present and SHA-256 encoded.');
  if(evidence.exportedProjectDigest!==receipts.find(r=>r.kind==='BACKUP_RESTORED_FROM_EXPORTED_COPY')?.observation?.sha256)issue(errors,'EXPORTED_PROJECT_RECEIPT_MISMATCH','The exported project digest must match the selected exported backup bytes that were restored.');
  if(!Array.isArray(evidence.screenshotOrRecordingReferences)||evidence.screenshotOrRecordingReferences.length===0||evidence.screenshotOrRecordingReferences.some(value=>!NONEMPTY(value)))issue(errors,'VISUAL_EVIDENCE_REQUIRED','At least one screenshot or screen-recording reference is required.');

  return {
    accepted:errors.length===0,
    status:errors.length===0?'ACCEPTED':'BLOCKED',
    errors,
    targetId:target.mobileAcceptanceTargetId||null,
    evidenceId:evidence.mobileAcceptanceEvidenceId||null,
    challenge:target.challenge||null,
    evidenceBasis:evidence.evidenceBasis||'NONE',
    performer:evidence.performer||null,
    physicalDeviceAssertion:evidence.physicalDeviceAssertion===true,
    sourceCommit:target.sourceCommit||null,
    deploymentManifestDigest:target.deploymentManifestDigest||null,
    origin:target.origin||null,
    basePath:target.basePath||null,
    testProjectId:target.testProjectId||null,
    mobileCapabilityProbeId:evidence.mobileCapabilityProbe?.probeId||null
  };
}

export function assertAcceptedMobileEvidence(args){
  const result=verifyMobileAcceptanceEvidence(args);
  assert.equal(result.accepted,true,JSON.stringify(result.errors));
  return result;
}
