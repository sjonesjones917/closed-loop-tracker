import fs from 'node:fs';
import vm from 'node:vm';

const assert=(value,message)=>{if(!value)throw new Error(message);};
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])
  vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const store=globalThis.closedLoopProjectStore;
const engine=globalThis.closedLoopWorkflowEngine;
const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const text=new TextEncoder();
const expectThrow=(fn,pattern,message)=>{let error=null;try{fn();}catch(value){error=value;}assert(error,message);if(pattern)assert(pattern.test(String(error.code||error.message||error)),`${message} Wrong rejection: ${error.code||error.message}`);return error;};

// closed-loop-filename/1: raw receipt is retained, canonical comparison is NFC
// and locale-independent, and every unsafe extraction target fails closed.
const decomposed=store.normalizeArtifactPath('folder/Cafe\u0301.txt');
const composed=store.normalizeArtifactPath('folder/Café.txt');
assert(decomposed.rawFilename==='folder/Cafe\u0301.txt','Raw filename was not preserved exactly.');
assert(decomposed.canonicalPath===composed.canonicalPath,'NFC-equivalent paths did not produce one canonical path.');
for(const unsafe of ['../escape.txt','/absolute.txt','C:\\absolute.txt','a//b.txt','a/./b.txt','a/../b.txt','CON','folder/NUL.txt','folder/trailing.','folder/file.txt:stream','folder/safe\u202Etxt.exe'])
  expectThrow(()=>store.normalizeArtifactPath(unsafe),/UNSAFE_ARTIFACT_PATH/,'Unsafe path was accepted: '+unsafe);
for(const pair of [
  [{artifactId:'A',filename:'File.txt'},{artifactId:'B',filename:'file.txt'}],
  [{artifactId:'A',filename:'Cafe\u0301.txt'},{artifactId:'B',filename:'Café.txt'}],
  [{artifactId:'A',filename:'straße.txt'},{artifactId:'B',filename:'STRASSE.txt'}],
  [{artifactId:'A',filename:'a.txt'},{artifactId:'B',filename:'а.txt'}]
])expectThrow(()=>store.assertNoArtifactPathCollisions(pair),/ARTIFACT_PATH_COLLISION/,'A canonical/case-fold/platform/confusable path collision was accepted.');

const cleanScan=store.scanArtifactForKnownSecrets(text.encode('ordinary project text'),'notes.txt');
assert(cleanScan.status==='NO_KNOWN_PATTERN_DETECTED_HEURISTIC_ONLY'&&cleanScan.completeAbsenceProven===false,'Clean secret scan was falsely represented as proof of no secrets.');
const secretScan=store.scanArtifactForKnownSecrets(text.encode('-----BEGIN PRIVATE KEY-----\nmaterial'),'.env');
assert(secretScan.status==='LEAKAGE_DETECTED'&&secretScan.findings.length>=1,'Known credential/secret material was not detected.');

// Every serialized non-artifact field crosses the same scanner/classifier.
// These regressions cover the three previously unguarded carriers directly.
for(const [name,payload] of [
  ['exact prompt',{instruction:{text:'Run this exact prompt with api_key=ABCDEFGHIJKLMNOP'}}],
  ['response contract',{responseContract:{metadata:'client_secret=ABCDEFGHIJKLMNOP'}}],
  ['test metadata',{tests:[{testId:'TEST-SECRET',fields:{notes:'password=ABCDEFGHIJKLMNOP'}}]}]
]){
  const classified=store.classifyOutboundPayload(payload,{componentId:`SECRET-${name.toUpperCase().replaceAll(' ','-')}`});
  assert(classified.classification==='CREDENTIAL_SECRET'&&classified.secretScanStatus==='LEAKAGE_DETECTED',`A credential embedded in ${name} was not prohibited.`);
}
const jsonCredential=store.classifyOutboundPayload({responseContract:{api_key:'ABCDEFGHIJKLMNOP'}},{componentId:'SECRET-JSON-FIELD'});
assert(jsonCredential.classification==='CREDENTIAL_SECRET'&&jsonCredential.secretScanStatus==='LEAKAGE_DETECTED','A JSON credential field escaped serialized-payload scanning.');
const cleanOutbound=store.classifyOutboundPayload({manifest:{handoff:{send:[],withhold:[],expectBack:[]}},instruction:{text:'ordinary prompt'},responseContract:{type:'object'},tests:[]});
assert(cleanOutbound.classification==='UNKNOWN'&&cleanOutbound.secretScanStatus==='NO_KNOWN_PATTERN_DETECTED_HEURISTIC_ONLY'&&cleanOutbound.scanCompleteAbsenceProven===false,'A clean non-artifact scan was falsely elevated to proof that the payload is public or secret-free.');

const validJson=store.sniffArtifactFormat(text.encode('{"count":10}'),'result.json','application/json');
assert(validJson.detectedFormat==='JSON'&&validJson.polyglotStatus==='CLEAR_FOR_REGISTERED_SNIFFER','A valid exact JSON interpretation was not recorded.');
const misleading=store.sniffArtifactFormat(text.encode('%PDF-1.7\n'),'result.json','application/json');
assert(misleading.polyglotStatus==='MISMATCHED_OR_AMBIGUOUS','A misleading extension/media interpretation was accepted.');
const unsafeXml=store.sniffArtifactFormat(text.encode('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><x>&e;</x>'),'result.xml','application/xml');
assert(unsafeXml.polyglotStatus==='MISMATCHED_OR_AMBIGUOUS','Unsafe XML declarations were accepted as a clear format interpretation.');

// Disclosure authority is one integrated workflow-engine operation. Unknown or
// restricted material requires an exact current human decision. Credential
// material is never authorizable, and changing an identity invalidates it.
const project=core.createBlankState('JOB-DISCLOSURE-SECURITY');
engine.ensureShape(project);
engine.registerArtifactBytes(project,{artifactId:'ARTIFACT-UNKNOWN',filename:'inputs/unknown.txt',byteSize:1,sha256:'a'.repeat(64),disclosureClassification:'UNKNOWN'});
let disclosure=engine.currentDisclosureAuthorization(project,{stage:1,operation:'COMPLETE',artifactIds:['ARTIFACT-UNKNOWN']});
assert(disclosure.required&&!disclosure.authorized&&!disclosure.prohibited,'UNKNOWN material did not fail closed before a human disclosure decision.');
const authorization=engine.recordDisclosureAuthorization(project,{stage:1,operation:'COMPLETE',artifactIds:['ARTIFACT-UNKNOWN'],recipientOrProvider:'Independent reviewer A',recipientSuitabilityConfirmed:true});
assert(engine.recordValue(authorization,'RECIPIENT_OR_PROVIDER')==='Independent reviewer A','Disclosure decision lost the exact recipient/provider.');
disclosure=engine.currentDisclosureAuthorization(project,{stage:1,operation:'COMPLETE',artifactIds:['ARTIFACT-UNKNOWN']});
assert(disclosure.authorized,'An exact current human disclosure decision was not recognized.');
assert(!engine.currentDisclosureAuthorization(project,{stage:2,operation:'COMPLETE',artifactIds:['ARTIFACT-UNKNOWN']}).authorized,'A disclosure decision was reused for another stage.');
const artifact=engine.records(project,'artifacts').find(record=>engine.recordId(record,'artifacts')==='ARTIFACT-UNKNOWN');artifact.fields.SHA256=artifact.SHA256='b'.repeat(64);engine.refreshRecordHashes(artifact,'artifacts');
assert(!engine.currentDisclosureAuthorization(project,{stage:1,operation:'COMPLETE',artifactIds:['ARTIFACT-UNKNOWN']}).authorized,'A disclosure decision survived changed artifact bytes.');
engine.registerArtifactBytes(project,{artifactId:'ARTIFACT-SECRET',filename:'inputs/.env',byteSize:1,sha256:'c'.repeat(64),disclosureClassification:'CREDENTIAL_SECRET',secretScanStatus:'LEAKAGE_DETECTED',secretScanFindings:[{kind:'HIGH_RISK_FILENAME'}]});
const prohibited=engine.currentDisclosureAuthorization(project,{stage:1,operation:'COMPLETE',artifactIds:['ARTIFACT-SECRET']});
assert(prohibited.prohibited&&!prohibited.authorized,'Credential/secret material was not absolutely prohibited.');
expectThrow(()=>engine.recordDisclosureAuthorization(project,{stage:1,artifactIds:['ARTIFACT-SECRET'],recipientOrProvider:'Anyone',recipientSuitabilityConfirmed:true}),/cannot be authorized/i,'A human decision overrode the credential/secret prohibition.');
let outboundDisclosure=engine.currentDisclosureAuthorization(project,{stage:3,operation:'COMPLETE',outboundComponents:[cleanOutbound]});
assert(outboundDisclosure.required&&!outboundDisclosure.authorized&&!outboundDisclosure.prohibited,'UNKNOWN serialized non-artifact material did not fail closed before authorization.');
const outboundAuthorization=engine.recordDisclosureAuthorization(project,{stage:3,operation:'COMPLETE',outboundComponents:[cleanOutbound],recipientOrProvider:'Independent reviewer B',recipientSuitabilityConfirmed:true});
outboundDisclosure=engine.currentDisclosureAuthorization(project,{stage:3,operation:'COMPLETE',outboundComponents:[cleanOutbound]});
assert(outboundDisclosure.authorized&&engine.recordValue(outboundAuthorization,'OUTBOUND_ALLOWLIST_SHA256')===outboundDisclosure.binding.outboundAllowlistSha256,'The exact serialized non-artifact allowlist authorization was not recognized.');
const changedOutbound=store.classifyOutboundPayload({manifest:{handoff:{send:['changed'],withhold:[],expectBack:[]}},instruction:{text:'ordinary prompt'},responseContract:{type:'object'},tests:[]});
assert(!engine.currentDisclosureAuthorization(project,{stage:3,operation:'COMPLETE',outboundComponents:[changedOutbound]}).authorized,'A non-artifact disclosure authorization survived changed serialized payload bytes.');
for(const [name,payload] of [['prompt',{instruction:{text:'api_key=ABCDEFGHIJKLMNOP'}}],['contract',{responseContract:{metadata:'client_secret=ABCDEFGHIJKLMNOP'}}],['test',{tests:[{metadata:'password=ABCDEFGHIJKLMNOP'}]}]]){
  const component=store.classifyOutboundPayload(payload,{componentId:`PROHIBITED-${name.toUpperCase()}`}),status=engine.currentDisclosureAuthorization(project,{stage:4,operation:'COMPLETE',outboundComponents:[component]});
  assert(status.prohibited&&!status.authorized,`Credential material in ${name} was not absolutely prohibited by the disclosure engine.`);
}
assert(store.validateProjectIntegrity(project,{verifyDerived:false}).valid,'Disclosure records violate canonical schema/ownership integrity.');
assert(schema.RECORD_SCHEMAS.disclosureAuthorizations.ownership.humanDecision.includes('RECIPIENT_SUITABILITY_CONFIRMED'),'Recipient suitability is not a HUMAN_DECISION field.');
for(const field of ['OUTBOUND_COMPONENT_IDENTITIES_AND_HASHES','OUTBOUND_COMPONENT_CLASSIFICATIONS','OUTBOUND_COMPONENT_SECRET_SCAN_STATUS','OUTBOUND_ALLOWLIST_SHA256'])assert(schema.RECORD_SCHEMAS.disclosureAuthorizations.ownership.application.includes(field),`Disclosure schema is missing application-owned ${field}.`);

const storeSource=fs.readFileSync('project-store.js','utf8');
const appSource=fs.readFileSync('app-core.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const importStart=storeSource.indexOf('async function importPackage'),importEnd=storeSource.indexOf('async function createExecutionPackage',importStart),importSource=storeSource.slice(importStart,importEnd);
const packageStart=storeSource.indexOf('async function createExecutionPackage'),packageEnd=storeSource.indexOf('async function storageHealth',packageStart),packageSource=storeSource.slice(packageStart,packageEnd);
for(const token of ['plan.send','assertNoArtifactPathCollisions','classifyOutboundPayload','nonArtifactPayload={manifest,instruction,responseContract,tests,packageSha256}','currentDisclosureAuthorization','outboundComponents','CREDENTIAL_SECRET_EXTERNAL_TRANSFER_PROHIBITED','EXECUTION_PACKAGE_DISCLOSURE_BINDING_MISMATCH','secretScanLimit','payload={...packageBody,packageSha256}'])assert(packageSource.includes(token),'Execution-package allowlist/disclosure control is missing '+token+'.');
assert(!packageSource.includes('listArtifacts(canonicalJobId)'),'Execution package enumerates the complete project store instead of the derived handoff allowlist.');
for(const token of ['stageDerivedArtifact','relationship:\'DERIVED_FROM\'','sourceArtifactPreserved:true','BLOCKED_PENDING_ACCEPTED_SEMANTIC_REVIEW','DERIVED_ARTIFACT_PROPOSITION_EFFECT_UNKNOWN'])assert(storeSource.includes(token),'Regression 217 derived/redacted artifact custody is missing '+token+'.');
for(const token of ['maxPackageCompressedBytes','decompressBytes','scanJsonResourceLimits','scanJsonAmbiguity','validateMaterializedImportLimits','maxArtifactCount','maxArtifactBytes','storageCapacityPreflight'])assert(importSource.includes(token),'Import pre-activation limits are missing '+token+'.');
assert(importSource.indexOf('maxPackageCompressedBytes')<importSource.indexOf('decompressBytes')&&importSource.indexOf('scanJsonResourceLimits')<importSource.indexOf('JSON.parse(json)'),'Import does not apply compressed/expanded/structural limits before materialization.');
assert(importSource.indexOf('validateMaterializedImportLimits(project,packageArtifacts)')<importSource.indexOf('assertProjectIntegrity(project)'),'Hostile-import limits are not enforced before expensive project integrity validation.');
for(const token of ['PROJECT_PACKAGE_MANIFEST_ARTIFACT_KEYS','SINGLE_GZIP_JSON; EMBEDDED ARTIFACT ARCHIVES ARE STORED AS BYTES AND NEVER EXPANDED','bytesToBase64(bytes)!==a.base64','IMPORT_MANIFEST_MISMATCH'])assert(storeSource.includes(token),'Regressions 236-239 package/archive interpretation is missing '+token+'.');
for(const token of ["['RESTORE','CLONE']",'RESTORE_PROJECT_CONFLICT','buildImportedClone'])assert(importSource.includes(token),'Explicit RESTORE/CLONE semantics are missing '+token+'.');
for(const token of ['CLONE_SOURCE_SNAPSHOT','artifactIdMap','activeStateCarriedForward:false','existingProjectsUnchanged'])assert(storeSource.includes(token),'Clone lineage/remapping semantics are missing '+token+'.');
assert(!/projects\.delete\(|artifacts\.delete\(/.test(importSource),'Import silently deletes/overwrites active project or artifact state.');
for(const token of ['PENDING_BYTES','HASHED_AND_REVERIFIED','READY_FOR_PROMOTION','ORPHAN_STAGED_BYTES','ORPHAN_CANONICAL_BYTES','METADATA_WITHOUT_BYTES','INTERRUPTED_PROMOTION','STALE_STAGING_RESERVATION'])assert(storeSource.includes(token),'Atomic artifact recovery is missing '+token+'.');
for(const token of ["projects.delete(jobId)","artifacts.delete(artifact.artifactId)","lastVerifiedExport:'+jobId",'PROJECT_DELETE_REPLACEMENT_MISSING'])assert(storeSource.includes(token),'Regression 266 complete-project destruction is missing '+token+'.');
for(const token of ['closed-loop-backup-policy/1','closed-loop-checkpoint/1','SELF_CONSISTENCY_ONLY','UNENCRYPTED_SENSITIVE_EXPORT_ACKNOWLEDGEMENT_REQUIRED','browserLocalCopyIsDisasterRecoveryBackup:false'])assert(storeSource.includes(token),'Backup/checkpoint honesty is missing '+token+'.');
assert(storeSource.match(/globalThis\.closedLoopProjectStore=Object\.freeze/g)?.length===1,'Project store is reassigned by a post-export wrapper.');
const integratedEngineExport=storeSource; // keep a named source for the architecture assertions below
void integratedEngineExport;
const engineSource=fs.readFileSync('workflow-engine.js','utf8'),lastIntegrated=engineSource.lastIndexOf('globalThis.closedLoopWorkflowEngine=engine;');
assert(lastIntegrated>=0&&!engineSource.slice(lastIntegrated+'globalThis.closedLoopWorkflowEngine=engine;'.length).includes('closedLoopWorkflowEngine='),'Workflow engine is reassigned after its integrated completion export.');
assert(html.includes('id="import-mode"')&&html.includes('value="RESTORE"')&&html.includes('value="CLONE"'),'Visible import path does not require explicit RESTORE versus CLONE mode.');
assert(html.includes('id="unencrypted-export-ack"')&&appSource.includes('unencryptedSensitiveExportAcknowledged'),'Sensitive unencrypted export lacks explicit operator acknowledgment.');
for(const token of ['id="authorize-disclosure"','id="disclosure-recipient"','id="disclosure-suitability"','External transfer prohibited'])assert(appSource.includes(token),'Visible one-action disclosure control is missing '+token+'.');

console.log(JSON.stringify({
  filenameContract:true,
  disclosureFailClosed:true,
  secretScanHonest:true,
  formatIdentity:true,
  packageAllowlist:true,
  importPreActivationLimits:true,
  restoreCloneExplicit:true,
  stagedAtomicRecovery:true,
  backupCheckpointPolicy:true,
  singleStoreAuthority:true
}));
