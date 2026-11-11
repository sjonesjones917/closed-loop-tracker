// History root proofs (project-store.js, the one exception to "One-use
// retained computations, never a validation-success cache") are minted and used
// only in the storage worker. This owner runs the production store as the
// browser does: a page realm whose exportPackage/importPackage/writeProject/
// saveCheckpoint go through the production requestStoreWorker path to a
// storage-worker realm (project-store.js?storeWorker=1), both over one
// transaction-adapter database. In ONE proof-holding worker it applies each
// fault in place and requires the export's or import's outcome (code, message,
// issues, or the exact package bytes apart from exportedAt and the
// packageSha256 over it, or the imported project and History) to equal a fresh
// runtime's cold outcome over the same faulted store or bytes, including a
// validator change made after the first proof hit. It also requires that
// refused or tolerated versions never mint, that a reference proof always has
// its root's, that the normal write -> checkpoint flow proves every version,
// that the happy path really skips the decode of proven entries, that a
// same-session import uses Tier 2 proofs while a fresh-runtime import is cold
// and identical, that a lost or reloaded worker exports cold and correctly,
// that the page realm and worker-less runtimes hold no proofs, that the lazy
// first use reads no caller value across an await, that a command's watchdog
// runs only while it is the worker's current command, that an export whose
// final record may have committed reports an unconfirmed outcome, and pins the
// measured History watchdog. An import's preparation of its prior project
// re-binds the local active checkpoint to its proofs in the happy path and
// imports exactly as a fresh cold worker (stored rows included) under every
// local fault, realm change, future derivation or missing pair. Digests an
// import computes once are reused only within one synchronous span and equal
// fresh computations.
// Ledger and decode counts are observed by in-memory source instrumentation
// only; production files and exports are unchanged. Each intended fault runs
// only the sections that hold its oracle.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

const BUILD='HISTORY-PROOF-REUSE';
const PAGE_SCRIPT="const STORE_SCRIPT_URL=typeof document!=='undefined'?document.currentScript?.src:null;";
const LEDGER="const historyRootProofs=new Map(),historyPairProofs=new Map();";
const COLD_ROOT='({projectSha256:verifiedProjectSha256,workSha256:verifiedWorkSha256}=checkpointPairMatches(measuredPair,project)?measuredPair:historyProjectDigests(project));';
const SNAPSHOT_DECODE='const {payload,fileContents}=await readPackageJson(entry.blob,{spoolArtifacts:false}),{packageSha256,...body}=payload;';
const EXPORT_HIT='    historyProofUsed(operation,proof);\n    return {payload:';
const IMPORT_HIT='historyProofUsed(operation,proof);historyProofUsed(operation,pair);';
const RETAINED_HIT='historyProofUsed(local,proof);historyProofUsed(local,pair);';
const RECOVERY_DERIVED='if(currentDefinition&&unchangedVerifiedProject(staticIntegrity,project,staticIntegrity?.digest)){';
// The points of the prior's no-op preparation where a realm change is made
// mid-import: after its proofs were re-bound (or, cold, before its read) and
// after its verdict (proven, or read cold).
// The re-binding point is just before the verdict's last input and validator checks.
const RETAINED_REBOUND=['    const validators=new Set([proof.validators,pair.validators,'];
const RETAINED_COLD_READ='{const retained=await readRetainedCheckpoint(jobId,state.activeId,state,rootPreparation?.read);';
const RETAINED_VERDICT='rootPreparation.verifiedContinuation=rootPreparation.read.retainedRoot;}}catch(error){';
// The digests importPackage reuses within one synchronous span: where each
// is first computed and where it is reused.
const PACKAGE_DIGEST="if(body.recovery&&body.recovery.activeProjectSha256!==packageProjectDigest())throw storageError('Backup active project does not match its recovery version.','HISTORY_VERSION_MISMATCH');";
const PACKAGE_DIGEST_REUSE='viewRebased?null:packageProjectDigest());';
const ACTIVE_WORK='const activeWorkMatches=Boolean(importedActive)&&historyWorkSha256(importedActive.project)===historyWorkSha256(project);';
const ACTIVE_WORK_REUSE='?activeWorkMatches:historyWorkSha256(importedActive.project)===historyWorkSha256(project))){';
const EXPORT_ROUTE="  if(useStoreWorker())return requestStoreWorker('EXPORT_PACKAGE',[jobId,{passphrase,historyRecovery}]);\n";
// The measured watchdog (project-store.js HISTORY_WATCHDOG_MEASUREMENT),
// re-derived here from its stated arithmetic at the declared History limits.
export const HISTORY_WATCHDOG_PIN=Object.freeze({coldMsPerSnapshotMiB:3638,coldMsPerRestoredMiB:122,transportMsPerFileMiB:129,hostedSlowdown:2,maxCompressedProjectMiB:512,maxRestoredProjectMiB:32768,maxRetainedFileMiB:1024});
export const HISTORY_WATCHDOG_MS=Math.ceil(HISTORY_WATCHDOG_PIN.hostedSlowdown*(HISTORY_WATCHDOG_PIN.coldMsPerSnapshotMiB*HISTORY_WATCHDOG_PIN.maxCompressedProjectMiB+HISTORY_WATCHDOG_PIN.coldMsPerRestoredMiB*HISTORY_WATCHDOG_PIN.maxRestoredProjectMiB+HISTORY_WATCHDOG_PIN.transportMsPerFileMiB*HISTORY_WATCHDOG_PIN.maxRetainedFileMiB));
const replaceOnce=(source,before,after,label)=>{assert.equal(source.split(before).length,2,'HISTORY_PROOF_ANCHOR_ORACLE '+label);return source.replace(before,after);};
// The first of these anchors that the source holds, exactly once.
const insertBeforeFirst=(source,anchors,insert,label)=>{const anchor=anchors.find(text=>source.includes(text));assert.ok(anchor,'HISTORY_PROOF_ANCHOR_ORACLE '+label);return replaceOnce(source,anchor,insert+anchor,label);};
const sha=value=>createHash('sha256').update(value).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));

export const HISTORY_PROOF_SECTIONS=Object.freeze(['export','import','mid-operation','nested','permissive-writer','credential','watchdog','pair-descriptors','minting','realms','unconfirmed-export','input-capture','retained-checkpoint','digest-spans']);
// Implementation faults this owner must detect (each is an in-memory mutant),
// with the sections whose oracles detect it.
const fault=(sections,oracle,edits)=>({sections,oracle,apply:source=>edits.reduce((text,[before,after],index)=>replaceOnce(text,before,after,oracle+' fault edit '+index),source)});
export const HISTORY_PROOF_FAULTS=Object.freeze({
 // Export Tier 1.
 'skip-part-rehash':fault(['export'],'HISTORY_PROOF_EQUIVALENCE_ORACLE',[["    const file=await readFile(part.sha256),bytePrimitive=checkpointBytePrimitives(file?.blob);\n    if(!(file?.blob instanceof Blob)||file.blob.size!==part.byteSize||await historyBlobSha256(file.blob,verifiedByteDigests)!==part.sha256||!checkpointBytePrimitivesMatch(bytePrimitive))return false;","    const file=await readFile(part.sha256);if(!file)return false;"]]),
 'skip-descriptor-match':fault(['export'],'HISTORY_PROOF_EQUIVALENCE_ORACLE',[["  if(proof.schema!==HISTORY_SCHEMA||proof.id!==entry.id||proof.bodyJobId!==String(jobId)||proof.projectSha256!==entry.projectSha256||proof.parentId!==entry.parentId||proof.label!==entry.label||proof.createdAt!==entry.createdAt||proof.activeStage!==Number(entry.stage)||!proof.artifactsArray)return false;","  if(proof.schema!==HISTORY_SCHEMA||proof.id!==entry.id)return false;"]]),
 'skip-native-check':fault(['export'],'HISTORY_PROOF_EQUIVALENCE_ORACLE',[['function historyProofNativesUnchanged(natives){','function historyProofNativesUnchanged(natives){return Boolean(natives);']]),
 'skip-validator-check':fault(['export'],'HISTORY_PROOF_EQUIVALENCE_ORACLE',[['  if(!operation.validators.has(validators))operation.validators.set(validators,rootValidatorsUnchanged(validators));','  if(!operation.validators.has(validators))operation.validators.set(validators,true);'],['  for(const [validators,current] of operation.validators)if(current&&!rootValidatorsUnchanged(validators))return false;\n','']]),
 'export-in-page':fault(['export'],'HISTORY_PROOF_HIT_ORACLE',[[EXPORT_ROUTE,'']]),
 // The normal flow proves its view references at their commit.
 'unproven-view-checkpoint-reference':fault(['realms'],'HISTORY_PROOF_MINT_ORACLE',[['verifiedRead);if(HISTORY_ROOT_PROOFS)await proveCommittedReferences(jobId,prepared);return checkpointId;}','verifiedRead);return checkpointId;}']]),
 'unproven-root-checkpoint-reference':fault(['export'],'HISTORY_PROOF_MINT_ORACLE',[['    if(HISTORY_ROOT_PROOFS)await proveCommittedReferences(jobId,prepared);\n    return checkpointId;','    return checkpointId;']]),
 'unproven-write-reference':fault(['export'],'HISTORY_PROOF_MINT_ORACLE',[['      if(HISTORY_ROOT_PROOFS)await proveCommittedReferences(projectIdentity(next),prepared.options.preparedHistory);\n','']]),
 // Mid-operation rechecks.
 'drop-export-recheck':fault(['mid-operation'],'HISTORY_PROOF_MID_OPERATION_ORACLE',[['    if(proofs&&!historyProofOperationCurrent(proofs))return exportPackage(jobId,{passphrase,historyRecovery,operationId,[COLD_HISTORY_VERIFICATION]:true});','']]),
 'drop-import-recheck':fault(['mid-operation'],'HISTORY_PROOF_MID_OPERATION_ORACLE',[['  if(proofs&&!historyProofOperationCurrent(proofs))return importPackage(suppliedBlob,{operationId,passphrase,pendingBackupImport,[COLD_HISTORY_VERIFICATION]:true});','']]),
 // Import Tier 2.
 'import-skip-facts-match':fault(['import'],'HISTORY_PROOF_IMPORT_EQUIVALENCE_ORACLE',[['if(!proof?.viewChecked||!historyProofInputsCurrent(proof)||!historyProofFactsMatch(proof,jobId,entry)||','if(!proof?.viewChecked||!historyProofInputsCurrent(proof)||']]),
 'import-skip-artifact-rehash':fault(['import'],'HISTORY_PROOF_IMPORT_EQUIVALENCE_ORACLE',[['    for(let index=0;index<proof.artifactBytes.length;index+=2){const file=await readFile(','    for(let index=0;false;index+=2){const file=await readFile(']]),
 'import-skip-derived-carry-check':fault(['import'],'HISTORY_PROOF_TIER2_DERIVED_ORACLE',[['if(!validatedProjections.has(projectionKey)&&!(pair.derivedAt!==null&&Date.now()>=pair.derivedAt))return null;','if(false)return null;']]),
 'import-skip-pair-validators':fault(['import'],'HISTORY_PROOF_TIER2_PAIR_VALIDATORS_ORACLE',[['if(!pair||!historyProofInputsCurrent(pair)||!historyProofValidatorsCurrent(operation,pair.validators))return null;','if(!pair)return null;']]),
 'import-tier2-active-version':fault(['import'],'HISTORY_PROOF_TIER2_ACTIVE_ORACLE',[['}else if(proofs&&entry.id!==incoming.activeId&&(proven=','}else if(proofs&&(proven=']]),
 // Pair proofs keyed by normalized descriptors; refused versions keep proofs.
 'pair-normalized-key':fault(['pair-descriptors'],'HISTORY_PROOF_PAIR_DESCRIPTOR_ORACLE',[['const historyDescriptorRowsSha256=rows=>hash.sha256Value(rows.map(({blob,...descriptor})=>descriptor));','const historyDescriptorRowsSha256=rows=>historyArtifactsSha256(rows);']]),
 'keep-refused-proofs':fault(['pair-descriptors'],'HISTORY_PROOF_REFUSED_WITHDRAWN_ORACLE',[['    catch(error){withdrawHistoryProofs(jobId,entry,body);throw error;}','    catch(error){throw error;}']]),
 // Minting rules and the layers of the export check.
 'mint-legacy-tolerance':fault(['minting'],'HISTORY_PROOF_LEGACY_TOLERANCE_ORACLE',[['if(proofValidators&&recoveryBodyStaticIntegrity.get(project)?.project===project)proofBasis=','if(proofValidators)proofBasis=']]),
 'mint-reference-without-root':fault(['minting'],'HISTORY_PROOF_REFERENCE_ROOT_ORACLE',[["      if(!root||root.kind!=='root'||root.verifiedProjectSha256!==verifiedProjectSha256||root.verifiedWorkSha256!==verifiedWorkSha256)return;\n      validators=root.validators;","      validators=root?.validators||lastRootValidators;"]]),
 'facts-skip-project-reference':fault(['minting'],'HISTORY_PROOF_FACTS_LAYER_ORACLE',[["  if(proof.projectReferenceSha256!==hash.sha256Value(entry.projectReference||null)||Boolean(entry.projectReference)!==(proof.kind==='reference'))return false;\n",'']]),
 'export-reference-skip-root-binding':fault(['minting'],'HISTORY_PROOF_ROOT_BINDING_LAYER_ORACLE',[['      if(!base||!(base.project||base.proven)||base.snapshotSha256!==proof.rootSnapshotSha256||base.projectSha256!==entry.projectSha256||proof.workSha256&&proof.workSha256!==base.workSha256)return null;','      if(!base)return null;']]),
 'ledger-in-every-realm':fault(['realms'],'HISTORY_PROOF_REALM_ORACLE',[['const HISTORY_ROOT_PROOFS=STORE_WORKER&&!ARCHIVE_PARSER_WORKER;','const HISTORY_ROOT_PROOFS=true;']]),
 // Retained-version checks the other owners carry into proofs.
 'mint-certificate-unchecked':fault(['permissive-writer'],'HISTORY_PROOF_PERMISSIVE_WRITER_ORACLE',[['if(proofValidators&&digests.projectSha256===verifiedProjectSha256&&digests.workSha256===verifiedWorkSha256){assertProjectIntegrity(project,{verifyDerived:false});proofBasis','if(proofValidators){proofBasis']]),
 'ignore-proven-credential':fault(['credential'],'HISTORY_PROOF_CREDENTIAL_ORACLE',[['      if(proven)requiresEncryption=requiresEncryption||proven.credential;','      if(proven){}']]),
 // Worker transport: watchdogs, unconfirmed exports, captured inputs.
 'watchdog-armed-at-post':fault(['watchdog'],'HISTORY_PROOF_WATCHDOG_QUEUE_ORACLE',[['  const head=workerRequests.values().next().value;\n  if(!head||head.timer!==null)return;','  const head=[...workerRequests.values()].findLast(row=>row.timer===null);\n  if(!head)return;']]),
 'export-unconfirmed-claimed-unchanged':fault(['unconfirmed-export'],'HISTORY_PROOF_UNCONFIRMED_EXPORT_ORACLE',[['      if(receipt===undefined){pending.reject(Object.assign(error,{existingProjectsUnchanged:error?.existingProjectsUnchanged!==false}));return;}\n      await clearWorkerCommit(pending.operationId);pending.reject(Object.assign(error,{existingProjectsUnchanged:false}));','      pending.reject(Object.assign(error,{existingProjectsUnchanged:true}));']]),
 'export-receipt-unrecorded':fault(['unconfirmed-export'],'HISTORY_PROOF_UNCONFIRMED_EXPORT_ORACLE',[["value:exportRecord,updatedAt:now()});recordWorkerCommit(tx,operationId,project,project.projectSha256);await finished;return result;","value:exportRecord,updatedAt:now()});await finished;return result;"]]),
 'native-command-read-after-await':fault(['input-capture'],'HISTORY_PROOF_INPUT_CAPTURE_ORACLE',[[' assertNativeProductCommand(command);command=clone(command);if(pendingFirstUseRoot)await firstUsePendingWriteRoot();',' assertNativeProductCommand(command);await firstUsePendingWriteRoot();command=clone(command);']]),
 'write-first-use-unguarded':fault(['input-capture'],'HISTORY_PROOF_INPUT_CAPTURE_ORACLE',[["  if(useStoreWorker())return requestStoreWorker('WRITE_PROJECT',[project,options]);\n  if(pendingFirstUseRoot)await firstUsePendingWriteRoot();","  if(useStoreWorker())return requestStoreWorker('WRITE_PROJECT',[project,options]);\n  await firstUsePendingWriteRoot();"]]),
 // The prior's active checkpoint (provenRetainedCheckpoint).
 'retained-skip-derived-strict':fault(['retained-checkpoint'],'HISTORY_PROOF_RETAINED_EQUIVALENCE_ORACLE',[['||!historyProofValidatorsCurrent(local,pair.validators)||pair.derivedAt===null||!(Date.now()>=pair.derivedAt))return false;','||!historyProofValidatorsCurrent(local,pair.validators))return false;']]),
 'retained-without-pair':fault(['retained-checkpoint'],'HISTORY_PROOF_RETAINED_EQUIVALENCE_ORACLE',[['    const pair=historyPairProof(jobId,proof.projectSha256,proof.descriptorsSha256);\n    if(!pair||','    const pair=historyPairProof(jobId,proof.projectSha256,proof.descriptorsSha256)||{...proof,derivedAt:0};\n    if(!pair||']]),
 'retained-skip-snapshot-rehash':fault(['retained-checkpoint'],'HISTORY_PROOF_RETAINED_EQUIVALENCE_ORACLE',[['if(blob.size!==Number(item.byteSize)||saved.sha256!==item.sha256||await hash.sha256Bytes(blob)!==item.sha256)return false;','if(blob.size!==Number(item.byteSize)||saved.sha256!==item.sha256)return false;']]),
 'retained-skip-last-inputs':fault(['retained-checkpoint'],'HISTORY_PROOF_RETAINED_INPUTS_ORACLE',[['    if(!historyProofInputsCurrent(proof)||[...validators].some(capture=>!rootValidatorsUnchanged(capture)))return false;\n','']]),
 // Digests reused within one synchronous span (importPackage).
 'digest-work-reused-across-await':fault(['digest-spans'],'HISTORY_PROOF_DIGEST_SPAN_ORACLE',[['if(importedActive&&(activatedExisting?activeWorkMatches:','if(importedActive&&(true?activeWorkMatches:']])
});

// Test-only observation (never a production export): the worker ledger, counts
// of cold root validations, snapshot decodes and proof hits, a hook on each
// hit, the package encoder (to re-encode edited backups), a shift of every
// pair proof's derivedAt (the worker's clock reading earlier than every
// derivation), and the module-private checks for layer tests.
export function observed(source){
 source=replaceOnce(source,LEDGER,LEDGER+`globalThis.__historyProofLedger={
  roots:()=>[...historyRootProofs.values()].flatMap(bucket=>[...bucket.values()]).map(proof=>({kind:proof.kind,jobId:proof.jobId,snapshotSha256:proof.snapshotSha256,id:proof.id,rootSnapshotSha256:proof.rootSnapshotSha256,verifiedProjectSha256:proof.verifiedProjectSha256,verifiedWorkSha256:proof.verifiedWorkSha256})),
  pairs:()=>[...historyPairProofs.values()].reduce((count,bucket)=>count+bucket.size,0),
  pairList:()=>[...historyPairProofs.values()].flatMap(bucket=>[...bucket.values()]).map(pair=>({projectSha256:pair.projectSha256,descriptorsSha256:pair.descriptorsSha256,derivedAt:pair.derivedAt})),
  dropPairs:()=>{for(const bucket of historyPairProofs.values())bucket.clear();},
  shiftPairDerivedAt:ms=>{for(const bucket of historyPairProofs.values())for(const [key,pair] of bucket)if(pair.derivedAt!==null)bucket.set(key,Object.freeze({...pair,derivedAt:pair.derivedAt+ms}));},
  internals:()=>({historyRootProof,historyProofFactsMatch,provenExportEntry,historyProofOperation,checkpointBytePrimitives,metaGet,snapshotKey}),
  save:()=>({roots:new Map([...historyRootProofs].map(([job,bucket])=>[job,new Map(bucket)])),pairs:new Map([...historyPairProofs].map(([job,bucket])=>[job,new Map(bucket)]))}),
  restore:saved=>{historyRootProofs.clear();for(const [job,bucket] of saved.roots)historyRootProofs.set(job,new Map(bucket));historyPairProofs.clear();for(const [job,bucket] of saved.pairs)historyPairProofs.set(job,new Map(bucket));}};
 globalThis.__compressPackage=(body,fileContents)=>compressPackage(body,fileContents);`,'ledger');
 source=replaceOnce(source,COLD_ROOT,'if(globalThis.__historyCounts)globalThis.__historyCounts.coldRoots++;'+COLD_ROOT,'cold-root');
 source=replaceOnce(source,SNAPSHOT_DECODE,'if(globalThis.__historyCounts)globalThis.__historyCounts.decodes++;'+SNAPSHOT_DECODE,'decode');
 source=replaceOnce(source,EXPORT_HIT,"    historyProofUsed(operation,proof);if(globalThis.__historyCounts)globalThis.__historyCounts.exportHits++;globalThis.__onProofHit?.('export');\n    return {payload:",'export-hit');
 source=replaceOnce(source,IMPORT_HIT,IMPORT_HIT+"if(globalThis.__historyCounts){globalThis.__historyCounts.importHits++;globalThis.__historyCounts.importHitIds.push(String(entry.id));}globalThis.__onProofHit?.('import');",'import-hit');
 source=insertBeforeFirst(source,RETAINED_REBOUND,"    globalThis.__onImportReuse?.('retained-rebound');\n",'retained-rebound');
 source=replaceOnce(source,RETAINED_HIT,RETAINED_HIT+"if(globalThis.__historyCounts)globalThis.__historyCounts.retainedHits++;",'retained-hit');
 source=replaceOnce(source,RETAINED_COLD_READ,"{globalThis.__onImportReuse?.('retained-rebound');const retained=await readRetainedCheckpoint(jobId,state.activeId,state,rootPreparation?.read);",'retained-cold-read');
 // Each reuse records whether it ran in the span of the computation and
 // whether a fresh computation at the reuse equals the reused value.
 source=replaceOnce(source,PACKAGE_DIGEST,PACKAGE_DIGEST+"if(packageProjectSha256!==null)globalThis.__digestSpan?.open('package-project');",'package-digest');
 source=replaceOnce(source,PACKAGE_DIGEST_REUSE,"viewRebased?null:(packageProjectSha256!==null&&globalThis.__digestSpan?.use('package-project',packageProjectSha256,()=>projectSha256(project)),packageProjectDigest()));",'package-digest-reuse');
 source=replaceOnce(source,ACTIVE_WORK,ACTIVE_WORK+"globalThis.__digestSpan?.open('active-work');",'active-work');
 source=replaceOnce(source,ACTIVE_WORK_REUSE,"?(globalThis.__digestSpan?.use('active-work',activeWorkMatches,()=>historyWorkSha256(importedActive.project)===historyWorkSha256(project)),activeWorkMatches):historyWorkSha256(importedActive.project)===historyWorkSha256(project))){",'active-work-reuse');
 source=replaceOnce(source,RETAINED_VERDICT,"rootPreparation.verifiedContinuation=rootPreparation.read.retainedRoot;}globalThis.__onImportReuse?.('retained-verdict');}catch(error){",'retained-verdict');
 // Test-only: a recovery-compatibility (derived) refusal of the versions a
 // predicate selects, raised where the derived check runs.
 source=replaceOnce(source,RECOVERY_DERIVED,"if(globalThis.__recoveryRefusal?.(project))throw Object.assign(storageError('Canonical project integrity validation failed: Injected recovery-compatibility refusal.','PROJECT_INTEGRITY_FAILED'),{issues:['Injected recovery-compatibility refusal.']});"+RECOVERY_DERIVED,'recovery-refusal');
 return source;
}
const counts=()=>({coldRoots:0,decodes:0,exportHits:0,importHits:0,importHitIds:[],retainedHits:0});
const workerEnvironment=name=>({__historyCounts:counts(),location:{search:`?v=${name}&storeWorker=1&storeContext=${name}-PAGE`},URLSearchParams,importScripts(){},addEventListener(){},postMessage(){}});

// Page realm + storage-worker realm(s) over ONE database. Every message is a
// copy made in the receiving realm, delivered asynchronously. A lost worker is
// replaced by a new worker realm (empty ledger); a reload is a new pair.
// onWorker (settable) is applied to each new worker realm after its store loads.
export function browser(source,database=null,{environment={},onWorker=null}={}){
 const workers=[];let page=null;
 class StoreWorker{
  constructor(url){
   const target=new URL(String(url));assert.equal(target.searchParams.get('storeWorker'),'1','HISTORY_PROOF_WORKER_ORACLE');assert.equal(target.searchParams.get('v'),BUILD,'HISTORY_PROOF_WORKER_ORACLE');
   const listeners=[],port=this;
   this.realm=projectStoreRuntime({sourceOverrides:{'project-store.js':source},environment:{...environment,__historyCounts:counts(),location:{search:`?v=${BUILD}&storeWorker=1&storeContext=${BUILD}-PAGE`},URLSearchParams,importScripts(){},addEventListener(type,listener){if(type==='message')listeners.push(listener);},postMessage(message){const data=page.copy(message);setTimeout(()=>port.onmessage?.({data}),0);}}});
   this.listeners=listeners;shareRows(this.realm,rows);workers.push(this);result.onWorker?.(this.realm);
  }
  postMessage(message){const data=this.realm.copy(message);setTimeout(()=>{for(const listener of this.listeners)listener({data});},0);}
  terminate(){this.terminated=true;}
 }
 page=projectStoreRuntime({sourceOverrides:{'project-store.js':replaceOnce(source,PAGE_SCRIPT,'const STORE_SCRIPT_URL=globalThis.__storeScriptUrl;','page-script')},environment:{...environment,__historyCounts:counts(),Worker:StoreWorker,__storeScriptUrl:`https://closed-loop.invalid/project-store.js?v=${BUILD}`}});
 const rows=database||page.rows;if(database)shareRows(page,rows);
 const worker=()=>workers.at(-1);
 const result={page,store:page.store,rows,workers,worker,onWorker,ledger:()=>worker()?.realm.runtime.__historyProofLedger.roots()||[],counts:()=>worker().realm.runtime.__historyCounts,
  resetCounts(){for(const entry of workers)entry.realm.runtime.__historyCounts=counts();page.runtime.__historyCounts=counts();},
  // The production lost-worker path: the page drops and terminates this
  // worker; the next command starts a new one.
  loseWorker(){worker().onerror({message:'Synthetic storage worker loss.'});}};
 return result;
}
function shareRows(realm,rows){realm.rows.get=name=>rows.get(name);realm.rows.set=(name,value)=>rows.set(name,value);}
const copyRows=(rows,realm)=>new Map([...rows].map(([name,data])=>[name,new Map([...data].map(([key,value])=>[key,realm.copy(value)]))]));
// A fresh runtime (no worker, no proofs) over a copy of the same rows.
function coldCopy(rows,source,environment={}){const cold=projectStoreRuntime({...(source?{sourceOverrides:{'project-store.js':source}}:{}),environment:{__historyCounts:counts(),...environment}});for(const [name,data]of rows)cold.rows.set(name,new Map([...data].map(([key,value])=>[key,cold.copy(value)])));return cold;}
async function packageDigest(blob){
 if(!(blob instanceof Blob))return {blob:false};
 if(blob.type!=='application/gzip')return {type:blob.type,byteSize:blob.size};
 const body=JSON.parse(gunzipSync(Buffer.from(await blob.arrayBuffer())).toString('utf8'));assert.equal(typeof body.exportedAt,'string');assert.match(body.packageSha256,/^[a-f0-9]{64}$/);
 delete body.exportedAt;delete body.packageSha256;return {type:blob.type,bodySha256:sha(JSON.stringify(body)),checkpoints:body.recovery?.entries?.length||0};
}
const failure=error=>({ok:false,code:error?.code??null,message:String(error?.message||error),issues:Array.isArray(error?.issues)?[...error.issues]:null});
async function exportOutcome(store,jobId,options={}){
 try{return {ok:true,...await packageDigest(await store.exportPackage(jobId,options))};}
 catch(error){return failure(error);}
}
async function storeFile(r,next,{stage,filename,text,commandId}){
 const blob=new Blob([text],{type:'text/plain'}),sha256=await r.runtime.closedLoopHash.sha256Bytes(blob),jobId=next.job.JOB_ID;
 const artifactId=r.engine.allocateId(next,'artifacts',r.copy({commandId,targetSlot:'',parentId:'',idempotencyKey:'FILE_INTAKE',payload:{stage,filename,mediaType:'text/plain',byteSize:blob.size,sha256,lineage:{}}}));
 const row=r.copy({artifactId,jobId,filename,mediaType:'text/plain',byteSize:blob.size,sha256,lineage:{stage,role:'STAGE_FILE',logicalPath:filename},createdAt:new Date().toISOString()});row.blob=blob;
 const stored=await r.store.putArtifact({...row,expectedSha256:sha256});
 r.engine.registerArtifactBytesBatch(next,r.copy([{stage,artifactId:stored.artifactId,filename:stored.filename,mediaType:stored.mediaType,byteSize:stored.byteSize,sha256:stored.sha256,lineage:stored.lineage}]));
 return stored;
}
const retainedText=n=>'Exact retained History title '+n+' '+'independent retained content '.repeat(300);
// A record array that grows with each write (over 64 KiB, so in several
// segments): its roots are segmented (/2), and every closed segment is shared
// with the next root.
const retainedRecords=n=>({records:Array.from({length:800+60*n},(_,i)=>({id:'HISTORY-PROOF-RECORD-'+i,text:'Exact retained record '+i+' '+'.'.repeat(i%41)}))});
const SEGMENTED='closed-loop-recovery-project-parts/2';
// Roots with retained parts, view references, a root superseded without a
// checkpoint (lazy first use) and 'Previous project' references (new files).
export async function fixture(b){
 const {store,page}=b;
 let p=await store.createProject({commandId:'HISTORY-PROOF-REUSE'});const jobId=p.job.JOB_ID;
 const view=(n,name='Workflow')=>page.copy({activeStage:1,activeView:name,drafts:{'#exact':{value:'Exact draft '+n}},scrollX:0,scrollY:n});
 const write=async(n,file=null)=>{const next=store.clone(p);next.job.JOB_TITLE=retainedText(n);next.vendorExtension=page.copy(retainedRecords(n));if(file)await storeFile(page,next,{stage:1,filename:file+'.txt',text:'Exact Stage 1 file '+file+'.\n',commandId:'HISTORY-PROOF-REUSE-'+file});p=await store.writeProject(next,{expectedProjectRevision:p.revision});};
 const save=async n=>store.saveCheckpoint(jobId,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,view:view(n),label:'Saved view'});
 await write(1,'first');await save(1);await save(2);
 await write(2);                       // superseded without a checkpoint
 await write(3,'second');await save(3);
 // A file stored outside a write: the next checkpoint pairs the active root
 // with the changed inventory ('Previous project').
 {const next=store.clone(p);await storeFile(page,next,{stage:1,filename:'third.txt',text:'Exact Stage 1 file third.\n',commandId:'HISTORY-PROOF-REUSE-third'});}
 await save(4);
 await write(4);await save(5);
 const state=await store.metaGet('recovery:'+jobId);
 assert.ok(state.entries.some(entry=>entry.projectReference)&&state.entries.filter(entry=>!entry.projectReference).length>=4,'HISTORY_PROOF_FIXTURE_ORACLE: roots and view references');
 assert.ok(state.entries.some(entry=>Object.hasOwn(entry,'projectPartsSha256')),'HISTORY_PROOF_FIXTURE_ORACLE: state-form roots with retained parts');
 assert.ok(state.entries.some(entry=>entry.label==='Previous project'),'HISTORY_PROOF_FIXTURE_ORACLE: a Previous project version');
 const schemas=state.entries.filter(entry=>!entry.projectReference).map(entry=>b.rows.get('meta').get('recovery:'+jobId+':snapshot:'+entry.id).value.projectParts?.schema);
 assert.ok(schemas.filter(schema=>schema===SEGMENTED).length>=4&&schemas.some(schema=>schema!==SEGMENTED),'HISTORY_PROOF_FIXTURE_ORACLE: segmented (/2) roots beside a /1 root');
 return {jobId,project:p,state};
}
// One root with retained parts, its checkpoint, and a view reference.
async function smallFixture(b){
 const {store,page}=b;let p=await store.createProject({commandId:'HISTORY-PROOF-REUSE-SMALL'});const jobId=p.job.JOB_ID,initial=p;
 const next=store.clone(p);next.job.JOB_TITLE=retainedText('small');p=await store.writeProject(next,{expectedProjectRevision:p.revision});
 for(const scrollY of [1,2])await store.saveCheckpoint(jobId,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,view:page.copy({activeStage:1,activeView:'Workflow',drafts:{},scrollX:0,scrollY}),label:'Saved view'});
 return {jobId,project:p,initial};
}
const historyOf=(rows,jobId)=>rows.get('meta').get('recovery:'+jobId).value;
const snapshotRow=(rows,jobId,id)=>rows.get('meta').get('recovery:'+jobId+':snapshot:'+id);
const fileRow=(rows,jobId,sha256)=>rows.get('meta').get('recovery:'+jobId+':bytes:'+sha256);
function corrupt(blob){return new Blob([new Uint8Array(blob.size).fill(0x58)],{type:blob.type});}
const ledgerKeys=b=>b.ledger().map(proof=>proof.snapshotSha256).sort();
// Every reference proof is anchored on its root's proof with the same digests.
function assertReferencesRooted(ledger,label){
 const roots=new Map(ledger.filter(proof=>proof.kind==='root').map(proof=>[proof.jobId+':'+proof.snapshotSha256,proof]));
 for(const proof of ledger.filter(proof=>proof.kind==='reference')){
  const root=roots.get(proof.jobId+':'+proof.rootSnapshotSha256);
  assert.ok(root&&root.verifiedProjectSha256===proof.verifiedProjectSha256&&root.verifiedWorkSha256===proof.verifiedWorkSha256,'HISTORY_PROOF_REFERENCE_ROOT_ORACLE '+label+': a reference proof without its root proof');
 }
}
// Realm changes shared by the export and import matrices: malicious swaps
// change only what an earlier version decodes to (or validates to), so a cold
// operation refuses while the current project still verifies.
const swaps={
 textEncoder:t=>{const original=t.TextEncoder.prototype.encode;t.TextEncoder.prototype.encode=function(text){return original.call(this,typeof text==='string'?text.replace('History title 1 ','History title 9 '):text);};return ()=>{t.TextEncoder.prototype.encode=original;};},
 hashBytes:t=>{const original=t.closedLoopHash;t.closedLoopHash=Object.freeze({...original,sha256Bytes:async bytes=>original.sha256Bytes(bytes)});return ()=>{t.closedLoopHash=original;};},
 jsonParse:t=>{const original=t.JSON.parse;t.JSON.parse=function(text,reviver){const value=original.call(this,text,reviver);if(value==='Starting project')return 'Swapped label';if(value&&typeof value==='object'&&value.schema==='closed-loop-recovery/1'&&value.label==='Starting project')value.label='Swapped label';return value;};return ()=>{t.JSON.parse=original;};},
 jsonParseBenign:t=>{const original=t.JSON.parse;t.JSON.parse=function(text,reviver){return original.call(this,text,reviver);};return ()=>{t.JSON.parse=original;};},
 decompression:t=>{const original=t.DecompressionStream;t.DecompressionStream=class{constructor(format){const inner=new original(format);this.writable=inner.writable;this.readable=inner.readable.pipeThrough(new TransformStream({transform(chunk,controller){const bytes=Buffer.from(chunk),at=bytes.indexOf('"label":"Starting project"');if(at>=0)bytes.write('"label":"Starting projecT"',at);controller.enqueue(new Uint8Array(bytes));}}));}};return ()=>{t.DecompressionStream=original;};},
 decompressionBenign:t=>{const original=t.DecompressionStream;t.DecompressionStream=class extends original{};return ()=>{t.DecompressionStream=original;};},
 blobArrayBuffer:t=>{const original=t.Blob.prototype.arrayBuffer;t.Blob.prototype.arrayBuffer=function(){return original.call(this);};return ()=>{t.Blob.prototype.arrayBuffer=original;};},
 engineProperty:t=>{const original=t.closedLoopWorkflowEngine;t.closedLoopWorkflowEngine=Object.freeze({...original,projectionVersionNote:'changed validator graph'});return ()=>{t.closedLoopWorkflowEngine=original;};},
 schemaRefusesEarly:t=>{const original=t.closedLoopWorkflowSchema,shape=original.projectShapeIssues;t.closedLoopWorkflowSchema=Object.freeze({...original,projectShapeIssues:(project,collections)=>Number(project?.revision)<4?['Injected schema definition refuses an earlier version.',...shape(project,collections)]:shape(project,collections)});return ()=>{t.closedLoopWorkflowSchema=original;};}
};

// Each export fault: apply in place (returning its undo), plus an optional
// realm change applied identically to the proof-holding worker and the cold runtime.
function exportFaultCases(jobId){
 const roots=rows=>historyOf(rows,jobId).entries.filter(entry=>!entry.projectReference),refs=rows=>historyOf(rows,jobId).entries.filter(entry=>entry.projectReference);
 const stateRoot=rows=>roots(rows).find(entry=>Object.hasOwn(entry,'projectPartsSha256'));
 const firstPart=rows=>snapshotRow(rows,jobId,stateRoot(rows).id).value.projectParts.entries[0];
 // A segment (not the first) of a segmented root's record array.
 const segmentedRoot=rows=>roots(rows).find(entry=>Object.hasOwn(entry,'projectPartsSha256')&&snapshotRow(rows,jobId,entry.id).value.projectParts.schema===SEGMENTED);
 const segment=rows=>snapshotRow(rows,jobId,segmentedRoot(rows).id).value.projectParts.entries.find(entry=>entry.segments&&entry.segments.length>1).segments[1];
 const edit=(select,field,value)=>rows=>{const entry=select(rows),before=Object.hasOwn(entry,field),prior=entry[field];entry[field]=typeof value==='function'?value(entry,rows):value;return ()=>{if(before)entry[field]=prior;else delete entry[field];};};
 const replaceBlob=(row)=>{const prior=row.value.blob;row.value.blob=corrupt(prior);return ()=>{row.value.blob=prior;};};
 const realm=apply=>({realm:apply});
 // Ordered so that each intended fault's detecting case comes early.
 return [
  ['validator-schema-definition',null,realm(swaps.schemaRefusesEarly)],
  ['swap-decompression-stream',null,realm(swaps.decompression)],
  ['snapshot-root-bytes',rows=>replaceBlob(snapshotRow(rows,jobId,stateRoot(rows).id))],
  ['snapshot-reference-bytes',rows=>replaceBlob(snapshotRow(rows,jobId,refs(rows)[0].id))],
  ['part-bytes',rows=>replaceBlob(fileRow(rows,jobId,firstPart(rows).sha256))],
  ['part-removed',rows=>{const key='recovery:'+jobId+':bytes:'+firstPart(rows).sha256,row=rows.get('meta').get(key);rows.get('meta').delete(key);return ()=>rows.get('meta').set(key,row);}],
  ['N1-state-form-digest',edit(stateRoot,'projectPartsSha256','f'.repeat(64))],
  ['N2-record-part-size',rows=>{const part=firstPart(rows),prior=part.byteSize;part.byteSize=prior+1;return ()=>{part.byteSize=prior;};}],
  ['N3-both-fields',rows=>{const entry=stateRoot(rows);entry.projectParts=structuredClone(snapshotRow(rows,jobId,entry.id).value.projectParts);return ()=>{delete entry.projectParts;};}],
  ['N3-reference-digest',edit(rows=>refs(rows)[0],'projectPartsSha256',(entry,rows)=>stateRoot(rows).projectPartsSha256)],
  ['N3-uppercase-digest',edit(stateRoot,'projectPartsSha256',entry=>entry.projectPartsSha256.toUpperCase())],
  ['N3-short-digest',edit(stateRoot,'projectPartsSha256',entry=>entry.projectPartsSha256.slice(1))],
  ['N4-unretained-part',rows=>{const state=historyOf(rows,jobId),part=firstPart(rows),files=state.files;state.files=Object.fromEntries(Object.entries(files).filter(([sha256])=>sha256!==part.sha256));state.retainedFileBytes-=files[part.sha256].byteSize;return ()=>{state.files=files;state.retainedFileBytes+=files[part.sha256].byteSize;};}],
  // A proven segmented root: its segments are re-hashed like parts.
  ['segment-bytes',rows=>replaceBlob(fileRow(rows,jobId,segment(rows).sha256))],
  ['segment-removed',rows=>{const key='recovery:'+jobId+':bytes:'+segment(rows).sha256,row=rows.get('meta').get(key);rows.get('meta').delete(key);return ()=>rows.get('meta').set(key,row);}],
  ['N2-record-segment-count',rows=>{const target=segment(rows),prior=target.count;target.count=prior+1;return ()=>{target.count=prior;};}],
  ['N4-unretained-segment',rows=>{const state=historyOf(rows,jobId),target=segment(rows),files=state.files;state.files=Object.fromEntries(Object.entries(files).filter(([sha256])=>sha256!==target.sha256));state.retainedFileBytes-=files[target.sha256].byteSize;return ()=>{state.files=files;state.retainedFileBytes+=files[target.sha256].byteSize;};}],
  // The declared canonical size binds the entry to its body like any field.
  ['entry-project-bytes',edit(stateRoot,'projectBytes',entry=>entry.projectBytes+1)],
  ['entry-parent',edit(rows=>roots(rows).at(-1),'parentId',(entry,rows)=>roots(rows)[0].id)],
  ['entry-label',edit(stateRoot,'label','Edited label')],
  ['entry-created-at',edit(stateRoot,'createdAt','2026-01-01T00:00:00.000Z')],
  ['entry-view-stage',edit(stateRoot,'stage',2)],
  ['entry-view-digest',edit(rows=>refs(rows)[0],'viewSha256','e'.repeat(64))],
  ['entry-project-reference',edit(rows=>refs(rows)[0],'projectReference',entry=>({...entry.projectReference,snapshotSha256:'d'.repeat(64)}))],
  ['entry-work-digest',edit(rows=>refs(rows)[0],'workSha256','c'.repeat(64))],
  ['record-label',rows=>{const row=snapshotRow(rows,jobId,stateRoot(rows).id).value,prior=row.label;row.label='Edited record label';return ()=>{row.label=prior;};}],
  ['record-parent',rows=>{const row=snapshotRow(rows,jobId,stateRoot(rows).id).value,prior=row.parentId;row.parentId=roots(rows).at(-1).id;return ()=>{row.parentId=prior;};}],
  ['stale-manifest-active',edit(rows=>historyOf(rows,jobId),'activeProjectSha256','b'.repeat(64))],
  ['stale-manifest-snapshot',edit(stateRoot,'sha256',(entry,rows)=>roots(rows).find(other=>other.id!==entry.id).sha256)],
  ['swap-text-encoder',null,realm(swaps.textEncoder)],
  ['swap-hash-sha256-bytes',null,realm(swaps.hashBytes)],
  ['swap-json-parse',null,realm(swaps.jsonParse)],
  ['swap-json-parse-benign',null,realm(swaps.jsonParseBenign)],
  ['swap-decompression-stream-benign',null,realm(swaps.decompressionBenign)],
  ['swap-blob-array-buffer',null,realm(swaps.blobArrayBuffer)],
  ['validator-engine-property',null,realm(swaps.engineProperty)],
  ['concurrent-generation-bump',null,{transaction:(rows)=>(names,mode)=>{if(mode==='readwrite'&&Array.isArray(names)&&names.length===2&&names.includes('projects')&&names.includes('meta')){const state=historyOf(rows,jobId);state.generation=Number(state.generation||0)+1;}}}]
 ];
}
// Applies one fault, exports in the proof-holding worker and in a fresh cold
// runtime over the same faulted rows, and returns both outcomes and counts.
async function compareExportFault(b,jobId,[id,apply,realm],source){
 const undo=apply?apply(b.rows):null,generation=historyOf(b.rows,jobId).generation;
 // Realm changes may touch natives shared by every realm of this process, so
 // each runtime's change is applied, used and undone in turn.
 const wrap=(runtime,rows)=>{if(!realm?.transaction)return null;const original=runtime.openStorageTransaction,hook=realm.transaction(rows);runtime.openStorageTransaction=async(names,mode)=>{hook(names,mode);return original(names,mode);};return ()=>{runtime.openStorageTransaction=original;};};
 const run=async(runtime,rows,store)=>{const undoRealm=realm?.realm?realm.realm(runtime):null,unwrap=wrap(runtime,rows);try{return await exportOutcome(store,jobId);}finally{unwrap?.();undoRealm?.();historyOf(rows,jobId).generation=generation;}};
 try{
  b.resetCounts();const before=ledgerKeys(b),proof=await run(b.worker().realm.runtime,b.rows,b.store),proofCounts={...b.counts()},after=ledgerKeys(b);
  const cold=coldCopy(b.rows,source),reference=await run(cold.runtime,cold.rows,cold.store);
  return {id,proof,reference,proofCounts,before,after};
 }finally{undo?.();}
}

// 1. Export Tier 1, from both proof-holding states: after the normal write ->
// checkpoint flow (which proves every root at its first use and every view
// reference at its commit), and after an export.
async function exportSection(context){
 const {source,production,emit,faultMode}=context;
 // An intended fault reruns only the first origin; the complete run covers both.
 for(const origin of faultMode?['write-checkpoint-flow']:['write-checkpoint-flow','after-export']){
  const b=browser(source),{jobId}=await fixture(b);
  if(origin==='after-export'){const first=await exportOutcome(b.store,jobId);assert.equal(first.ok,true,'HISTORY_PROOF_FIXTURE_ORACLE: the first export succeeds');}
  const entries=historyOf(b.rows,jobId).entries,ledger=b.ledger();
  assert.equal(ledger.filter(proof=>proof.kind==='root').length,entries.filter(entry=>!entry.projectReference).length,'HISTORY_PROOF_MINT_ORACLE '+origin+': every root is proven, including the root superseded without a checkpoint');
  assert.equal(ledger.length,entries.length,'HISTORY_PROOF_MINT_ORACLE '+origin+': every version is proven, view references at their checkpoint commit');
  assertReferencesRooted(ledger,origin);
  // Happy path: every proven entry skips its decode; bytes equal cold.
  b.resetCounts();const proven=await exportOutcome(b.store,jobId),hits={...b.counts()},cold=await exportOutcome(coldCopy(b.rows,production).store,jobId);
  assert.equal(proven.ok,true);assert.deepEqual(proven,cold,'HISTORY_PROOF_BYTES_ORACLE '+origin+': the proven export equals the cold export byte for byte apart from exportedAt');
  assert.equal(hits.coldRoots,0,'HISTORY_PROOF_HIT_ORACLE '+origin+': no proven root is validated again');
  assert.equal(hits.exportHits,entries.length,'HISTORY_PROOF_HIT_ORACLE '+origin+': every proven entry is a hit');
  assert.equal(hits.decodes,0,'HISTORY_PROOF_HIT_ORACLE '+origin+': no snapshot is decoded');
  emit('HISTORY-PROOF-HAPPY-'+origin,{entries:entries.length,proofs:ledger.length,exportHits:hits.exportHits,coldRoots:hits.coldRoots,decodes:hits.decodes,bytesEqualCold:true});
  for(const row of exportFaultCases(jobId)){
   const result=await compareExportFault(b,jobId,row,production);
   assert.deepEqual(result.proof,result.reference,'HISTORY_PROOF_EQUIVALENCE_ORACLE '+origin+' '+row[0]+': a proof-holding worker must export exactly as a fresh cold runtime');
   // Every version was proven before the fault: neither a refused nor a
   // re-verified export adds or loses a proof (re-verification re-mints the same keys).
   assert.deepEqual(result.after,result.before,'HISTORY_PROOF_REFUSED_NEVER_MINTS_ORACLE '+origin+' '+row[0]+': the ledger holds exactly the proofs it held before');
   emit('HISTORY-PROOF-FAULT-'+origin+'-'+row[0],{refused:!result.proof.ok,code:result.proof.code??null,coldFallback:result.proofCounts.decodes>0||result.proofCounts.coldRoots>0||!result.proof.ok});
  }
  assertReferencesRooted(b.ledger(),origin+' after the fault matrix');
  // The faults are undone: the same worker exports from its proofs again.
  b.resetCounts();const again=await exportOutcome(b.store,jobId);assert.deepEqual(again,proven,'HISTORY_PROOF_RESTORED_ORACLE '+origin);assert.equal(b.counts().coldRoots,0,'HISTORY_PROOF_RESTORED_ORACLE '+origin);
  // Export ran in the storage worker: the page realm never decoded History.
  assert.equal(b.page.runtime.__historyCounts.decodes,0,'HISTORY_PROOF_WORKER_ROUTING_ORACLE: export runs in the storage worker');
 }
}

// Backup editing for the import matrix: the gunzipped package body, each edit
// made on it, and the package re-encoded by the production encoder (so its
// packageSha256 is recomputed).
async function backupBody(blob){const body=JSON.parse(gunzipSync(Buffer.from(await blob.arrayBuffer())).toString('utf8'));delete body.packageSha256;return body;}
async function encodeBackup(realm,body){return (await realm.runtime.__compressPackage(realm.copy(body))).blob;}
async function snapshotMember(body,id){const member=body.artifacts.find(a=>a.archiveKind==='RECOVERY_SNAPSHOT'&&a.checkpointId===id);const snapshot=JSON.parse(gunzipSync(Buffer.from(member.base64,'base64')).toString('utf8'));delete snapshot.packageSha256;return {member,snapshot};}
async function setMemberBytes(realm,body,member,bytes,{filename=null,artifactId=null}={}){
 const old={artifactId:member.artifactId,sha256:member.sha256};const sha256=await realm.runtime.closedLoopHash.sha256Bytes(new Blob([bytes]));
 Object.assign(member,{sha256,byteSize:bytes.length,base64:Buffer.from(bytes).toString('base64'),...(filename?{filename}:{}),...(artifactId?{artifactId}:{})});
 const row=body.packageManifest.artifacts.find(a=>a.artifactId===old.artifactId);Object.assign(row,{artifactId:member.artifactId,filename:member.filename,byteSize:member.byteSize,sha256});
 return sha256;
}
function removeMember(body,predicate){const removed=body.artifacts.filter(predicate);body.artifacts=body.artifacts.filter(a=>!predicate(a));body.packageManifest.artifacts=body.packageManifest.artifacts.filter(a=>!removed.some(r=>r.artifactId===a.artifactId));body.packageManifest.artifactCount=body.artifacts.length;return removed;}
const activationWork=(b,project)=>{const activation=new Set(b.page.runtime.closedLoopWorkflowSchema.RECOVERY_SOURCE_REFERENCE_CONTRACT.activationFields);return JSON.stringify(Object.fromEntries(Object.entries(project).filter(([key])=>!activation.has(key)&&key!=='projectSha256')));};
// An import outcome: the refusal, or the imported work and the retained
// versions it holds (new versions are counted: their identities are random).
async function importOutcome(b,blob,jobId,ids){
 try{const project=await b.store.importPackage(blob),state=historyOf(b.rows,jobId);return {ok:true,revision:project.revision,work:activationWork(b,project),activeId:ids.includes(state.activeId)?state.activeId:'NEW-VERSION',versions:state.entries.length,retained:Array.from(state.entries,entry=>JSON.stringify(entry)).filter(text=>ids.some(id=>text.startsWith('{"id":'+JSON.stringify(id)+','))),stored:storedOutcome(b,jobId,ids)};}
 catch(error){return {...failure(error),stored:storedOutcome(b,jobId,ids)};}
}
// The stored state an import leaves: every project, artifact and metadata row
// (byte rows by key, size and record), with the values a fresh activation
// draws at random (its activation id, the activated project digest, a new
// version's id, time and snapshot bytes) replaced by their role, and the
// activated project checked against its own stored digest.
function storedOutcome(b,jobId,ids){
 const rows=b.rows,meta=rows.get('meta'),row=rows.get('projects').get(jobId),project=row?.project,state=meta.get('recovery:'+jobId)?.value;
 const activation=project?.historyActivationId??null,activated=row?.projectSha256??null,created=new Map((state?.entries||[]).filter(entry=>!ids.includes(entry.id)).map((entry,index)=>[entry.id,'NEW-VERSION-'+index]));
 const fresh=(state?.entries||[]).filter(entry=>created.has(entry.id));
 const replacer=(key,value)=>{
  if(value&&typeof value==='object'&&typeof value.arrayBuffer==='function'&&typeof value.size==='number')return {blobSize:value.size};
  if(['at','updatedAt','startedAt'].includes(key))return 'TIME';
  if(typeof value==='string'){if(activation&&value===activation)return 'ACTIVATION-ID';if(activated&&value===activated)return 'ACTIVATED-SHA256';if(created.has(value))return created.get(value);if(fresh.some(entry=>entry.sha256===value))return 'NEW-SNAPSHOT-SHA256';}
  return value;
 };
 const normal=value=>value===undefined?null:JSON.parse(JSON.stringify(value,replacer));
 const history=state?normal({...state,compressedProjectBytes:state.compressedProjectBytes-fresh.reduce((total,entry)=>total+entry.byteSize,0),entries:state.entries.map(entry=>created.has(entry.id)?{id:entry.id,parentId:entry.parentId,label:entry.label,stage:entry.stage,workSha256:entry.workSha256,viewSha256:entry.viewSha256,artifactManifestSha256:entry.artifactManifestSha256,projectReference:entry.projectReference||null}:entry)}):null;
 const metaRows=[...meta.keys()].sort().filter(key=>key!=='recovery:'+jobId&&![...created.keys()].some(id=>key.endsWith(':snapshot:'+id))).map(key=>[key,normal(meta.get(key)?.value)]);
 const artifacts=[...rows.get('artifacts').keys()].sort().map(key=>[key,normal(rows.get('artifacts').get(key))]);
 const projects=[...rows.get('projects').keys()].sort().map(key=>[key,normal(rows.get('projects').get(key))]);
 return {history,meta:metaRows,artifacts,projects,activatedDigestConsistent:row?row.projectSha256===b.store.projectSha256(b.page.copy(project)):null};
}

// 2. Import Tier 2 in the proof-holding worker after the minting export, each
// outcome compared with a fresh worker's cold import of the same bytes over a
// copy of the same store.
async function importSection(context){
 const {source,production,emit}=context;
 const b=browser(source),{jobId}=await fixture(b);let p=await b.store.readProject(jobId);
 // A file referenced only by earlier versions: retained, then removed.
 {const next=b.store.clone(p);await storeFile(b.page,next,{stage:1,filename:'retired.txt',text:'Exact Stage 1 file retired.\n',commandId:'HISTORY-PROOF-REUSE-retired'});}
 await b.store.saveCheckpoint(jobId,{expectedProjectRevision:p.revision,label:'Saved view',view:b.page.copy({activeStage:1,activeView:'Workflow',drafts:{},scrollX:0,scrollY:41})});
 const retired=(await b.store.listArtifacts(jobId)).find(row=>row.filename==='retired.txt');assert.ok(retired,'HISTORY_PROOF_IMPORT_FIXTURE_ORACLE: the retired file');
 await b.store.deleteArtifact(retired.artifactId,jobId);
 await b.store.saveCheckpoint(jobId,{expectedProjectRevision:p.revision,label:'Saved view',view:b.page.copy({activeStage:1,activeView:'Workflow',drafts:{},scrollX:0,scrollY:42})});
 assert.equal((await exportOutcome(b.store,jobId)).ok,true,'HISTORY_PROOF_IMPORT_FIXTURE_ORACLE: the minting export');
 const backup=await b.store.exportPackage(jobId),body=await backupBody(backup),recovery=body.recovery,ids=recovery.entries.map(entry=>entry.id),rootCount=recovery.entries.filter(entry=>!entry.projectReference).length;
 assert.ok(recovery.files[retired.sha256]&&body.artifacts.some(a=>a.archiveKind==='RECOVERY_BYTES'&&a.sha256===retired.sha256),'HISTORY_PROOF_IMPORT_FIXTURE_ORACLE: the retired file is a retained backup member');
 // Every case starts from this same proof-holding state: the store's rows and
 // the worker's ledger after the minting export (an import commits, and a
 // refused version withdraws its proofs).
 const ledgerOf=()=>b.worker().realm.runtime.__historyProofLedger,holding={rows:copyRows(b.rows,b.page),ledger:ledgerOf().save()};
 const reset=()=>{for(const [name,data] of holding.rows)b.rows.set(name,new Map([...data].map(([key,value])=>[key,b.page.copy(value)])));ledgerOf().restore(holding.ledger);};
 const compare=async(label,blob,{realm=null,restore=true}={})=>{
  if(restore)reset();
  const before=copyRows(b.rows,b.page),undo=realm?realm(b.worker().realm.runtime):null;
  try{
   b.resetCounts();const same=await importOutcome(b,blob,jobId,ids),sameCounts={...b.counts(),importHitIds:[...b.counts().importHitIds]};
   // The active version is always decoded: its value is the source reference.
   assert.ok(!sameCounts.importHitIds.includes(recovery.activeId),'HISTORY_PROOF_TIER2_ACTIVE_ORACLE '+label+': the active version took a Tier 2 hit');
   const fresh=browser(source,before,{onWorker:realm?runtime=>{realm(runtime.runtime);}:null});fresh.resetCounts();const other=await importOutcome(fresh,blob,jobId,ids),freshCounts={...fresh.counts()};
   assert.equal(fresh.workers.length,1,'HISTORY_PROOF_TIER2_ORACLE: the fresh import ran in its own new worker');
   assert.deepEqual(same,other,'HISTORY_PROOF_IMPORT_EQUIVALENCE_ORACLE '+label+': a proof-holding worker must import exactly as a fresh cold worker');
   return {same,sameCounts,freshCounts};
  }finally{undo?.();}
 };
 // Same-session import of the just-exported backup.
 const happy=await compare('same-session',backup);
 assert.equal(happy.same.ok,true,'HISTORY_PROOF_IMPORT_ORACLE: the same-session import succeeds');
 assert.ok(happy.sameCounts.importHits>0,'HISTORY_PROOF_TIER2_ORACLE: the same-session import uses Tier 2 proofs');
 // A fresh worker starts with no proofs; only versions it decodes cold in this
 // same import can be carried within it.
 assert.ok(happy.freshCounts.importHits<happy.sameCounts.importHits,'HISTORY_PROOF_TIER2_ORACLE: a fresh worker imports cold');
 assert.ok(happy.sameCounts.coldRoots<happy.freshCounts.coldRoots,'HISTORY_PROOF_TIER2_ORACLE: proven versions are not decoded again');
 emit('HISTORY-PROOF-IMPORT-TIER2',{importHits:happy.sameCounts.importHits,coldRoots:happy.sameCounts.coldRoots,freshColdRoots:happy.freshCounts.coldRoots,identical:true});
 // Byte and descriptor faults in the backup, packageSha256 recomputed.
 const target=recovery.entries.find(entry=>!entry.projectReference&&entry.id!==recovery.activeId&&entry.projectParts?.schema===SEGMENTED),reference=recovery.entries.find(entry=>entry.projectReference&&entry.id!==recovery.activeId);
 const edited=async edit=>{const copy=plain(body);await edit(copy);return encodeBackup(b.worker().realm,copy);};
 const editEntry=(id,field,value)=>copy=>{copy.recovery.entries.find(entry=>entry.id===id)[field]=value;};
 // The cases whose comparison detects an intended fault come first.
 const cases=[
  // Only earlier versions reference this file: a Tier 2 hit that skipped its
  // bytes would import what a cold import refuses.
  ['retired-file-removed',async copy=>{removeMember(copy,a=>a.archiveKind==='RECOVERY_BYTES'&&a.sha256===retired.sha256);copy.recovery.retainedFileBytes-=copy.recovery.files[retired.sha256].byteSize;delete copy.recovery.files[retired.sha256];}],
  ['manifest-label',editEntry(target.id,'label','Edited backup label')],
  ['manifest-created-at',editEntry(target.id,'createdAt','2026-01-01T00:00:00.000Z')],
  ['manifest-stage',editEntry(target.id,'stage',2)],
  ['manifest-reference-label',editEntry(reference.id,'label','Edited backup label')],
  ['manifest-reference-view-digest',editEntry(reference.id,'viewSha256','e'.repeat(64))],
  ['snapshot-member-bytes',async copy=>{const {member,snapshot}=await snapshotMember(copy,target.id);snapshot.view={...snapshot.view,scrollY:999};const bytes=Buffer.from(await (await encodeBackup(b.worker().realm,snapshot)).arrayBuffer());const entry=copy.recovery.entries.find(row=>row.id===target.id);copy.recovery.compressedProjectBytes+=bytes.length-entry.byteSize;entry.sha256=await setMemberBytes(b.worker().realm,copy,member,bytes);entry.byteSize=bytes.length;}],
  ['part-member-bytes',async copy=>{const entry=copy.recovery.entries.find(row=>row.id===target.id),part=entry.projectParts.entries[0],member=copy.artifacts.find(a=>a.archiveKind==='RECOVERY_BYTES'&&a.sha256===part.sha256),bytes=Buffer.concat([Buffer.from(member.base64,'base64'),Buffer.from(' ')]);const info=copy.recovery.files[part.sha256];delete copy.recovery.files[part.sha256];const sha256=await setMemberBytes(b.worker().realm,copy,member,bytes);member.filename=sha256+'.bin';member.artifactId='RECOVERY-BYTES-'+sha256;const row=copy.packageManifest.artifacts.find(a=>a.sha256===sha256);Object.assign(row,{artifactId:member.artifactId,filename:member.filename});copy.recovery.files[sha256]={...info,byteSize:bytes.length};copy.recovery.retainedFileBytes+=bytes.length-info.byteSize;part.sha256=sha256;part.byteSize=bytes.length;}],
  ['segment-member-bytes',async copy=>{const entry=copy.recovery.entries.find(row=>row.id===target.id),part=entry.projectParts.entries.find(row=>row.segments&&row.segments.length>1).segments[1],member=copy.artifacts.find(a=>a.archiveKind==='RECOVERY_BYTES'&&a.sha256===part.sha256),bytes=Buffer.concat([Buffer.from(member.base64,'base64'),Buffer.from(' ')]);const info=copy.recovery.files[part.sha256];delete copy.recovery.files[part.sha256];const sha256=await setMemberBytes(b.worker().realm,copy,member,bytes);member.filename=sha256+'.bin';member.artifactId='RECOVERY-BYTES-'+sha256;const row=copy.packageManifest.artifacts.find(a=>a.sha256===sha256);Object.assign(row,{artifactId:member.artifactId,filename:member.filename});copy.recovery.files[sha256]={...info,byteSize:bytes.length};copy.recovery.retainedFileBytes+=bytes.length-info.byteSize;part.sha256=sha256;part.byteSize=bytes.length;}],
 ];
 for(const [label,edit] of cases.slice(0,2)){
  const result=await compare(label,await edited(edit));
  emit('HISTORY-PROOF-IMPORT-FAULT-'+label,{refused:!result.same.ok,code:result.same.code??null,importHits:result.sameCounts.importHits});
 }
 // The worker's clock reads earlier than every pair's derivation: no derived
 // time is carried, so every root decodes cold (each root is its own pair).
 {
  reset();ledgerOf().shiftPairDerivedAt(3600000);
  const result=await compare('pair-derived-in-the-future',backup,{restore:false});
  assert.ok(result.sameCounts.coldRoots>=rootCount,'HISTORY_PROOF_TIER2_DERIVED_ORACLE: a pair derived in the future carried its derived check');
  emit('HISTORY-PROOF-IMPORT-PAIR-DERIVED-IN-THE-FUTURE',{coldRoots:result.sameCounts.coldRoots,roots:rootCount,importHits:result.sameCounts.importHits});
 }
 // Pairs minted under earlier validators: the root proofs are re-minted under
 // the changed (benign) validators by an export, the pairs are not, so every
 // root decodes cold.
 {
  reset();const undo=swaps.engineProperty(b.worker().realm.runtime);let result;
  try{assert.equal((await exportOutcome(b.store,jobId)).ok,true);result=await compare('pair-validators-earlier',backup,{restore:false,realm:runtime=>runtime===b.worker().realm.runtime?()=>{}:swaps.engineProperty(runtime)});}finally{undo();}
  assert.ok(result.sameCounts.coldRoots>=rootCount,'HISTORY_PROOF_TIER2_PAIR_VALIDATORS_ORACLE: a pair minted under earlier validators served Tier 2');
  emit('HISTORY-PROOF-IMPORT-PAIR-VALIDATORS-EARLIER',{coldRoots:result.sameCounts.coldRoots,roots:rootCount,importHits:result.sameCounts.importHits});
 }
 for(const [label,edit] of cases.slice(2)){
  const result=await compare(label,await edited(edit));
  emit('HISTORY-PROOF-IMPORT-FAULT-'+label,{refused:!result.same.ok,code:result.same.code??null,importHits:result.sameCounts.importHits});
 }
 // Realm changes applied to both workers before the import.
 for(const [label,realm] of [['schema-definition',swaps.schemaRefusesEarly],['json-parse',swaps.jsonParse],['decompression-stream',swaps.decompression],['engine-property',swaps.engineProperty]]){
  const result=await compare('swap-'+label,backup,{realm});
  emit('HISTORY-PROOF-IMPORT-FAULT-swap-'+label,{refused:!result.same.ok,code:result.same.code??null,importHits:result.sameCounts.importHits});
 }
 // Worker loss: proofs die with the worker; the next export is cold and correct.
 const starts=b.workers.length;b.loseWorker();b.resetCounts();
 const lost=await exportOutcome(b.store,jobId),lostCounts=b.counts(),reference2=await exportOutcome(coldCopy(b.rows,production).store,jobId);
 assert.equal(b.workers.length,starts+1,'HISTORY_PROOF_WORKER_LOSS_ORACLE: a new storage worker realm');
 assert.deepEqual(lost,reference2,'HISTORY_PROOF_WORKER_LOSS_ORACLE: the export after worker loss is correct');
 // A new worker realm holds a new, empty ledger: its export verifies cold
 // (proofs it mints from its own cold reads may serve later entries).
 assert.ok(lostCounts.coldRoots>0,'HISTORY_PROOF_WORKER_LOSS_ORACLE: the export after worker loss is cold');
 // Reload: a new page and worker over the same database.
 const reloaded=browser(source,b.rows);reloaded.resetCounts();const afterReload=await exportOutcome(reloaded.store,jobId);
 assert.deepEqual(afterReload,reference2,'HISTORY_PROOF_RELOAD_ORACLE');assert.ok(reloaded.counts().coldRoots>0,'HISTORY_PROOF_RELOAD_ORACLE: the first export after a reload is cold');
 emit('HISTORY-PROOF-WORKER-LOSS-AND-RELOAD',{lostColdRoots:lostCounts.coldRoots,reloadColdRoots:reloaded.counts().coldRoots,correct:true});
}

// 3. A validator change made after the first proof hit, during the export or
// import: the operation's end recheck redoes it cold, so its outcome is the
// cold outcome under the same change.
async function midOperationSection(context){
 const {source,emit}=context;
 const b=browser(source),{jobId}=await fixture(b);
 assert.equal((await exportOutcome(b.store,jobId)).ok,true,'HISTORY_PROOF_MID_OPERATION_FIXTURE_ORACLE');
 const backup=await b.store.exportPackage(jobId),ids=(await backupBody(backup)).recovery.entries.map(entry=>entry.id);
 const once=runtime=>{let undo=null;runtime.__onProofHit=()=>{if(!undo)undo=swaps.schemaRefusesEarly(runtime);};return ()=>{delete runtime.__onProofHit;undo?.();};};
 {
  const worker=b.worker().realm.runtime,undo=once(worker);let proof;b.resetCounts();
  try{proof=await exportOutcome(b.store,jobId);}finally{undo();}
  const hits=b.counts().exportHits,cold=coldCopy(b.rows,source),undoCold=swaps.schemaRefusesEarly(cold.runtime);let reference;try{reference=await exportOutcome(cold.store,jobId);}finally{undoCold();}
  assert.ok(hits>0,'HISTORY_PROOF_MID_OPERATION_ORACLE export: the change follows a proof hit');
  assert.equal(reference.ok,false,'HISTORY_PROOF_MID_OPERATION_ORACLE export: the cold export under the change refuses');
  assert.deepEqual(proof,reference,'HISTORY_PROOF_MID_OPERATION_ORACLE export: a change after a proof hit yields the cold outcome');
  emit('HISTORY-PROOF-MID-EXPORT-VALIDATOR-CHANGE',{exportHits:hits,code:proof.code});
 }
 {
  const before=copyRows(b.rows,b.page),worker=b.worker().realm.runtime,undo=once(worker);let proof;b.resetCounts();
  try{proof=await importOutcome(b,backup,jobId,ids);}finally{undo();}
  const hits=b.counts().importHits,fresh=browser(source,before,{onWorker:runtime=>{swaps.schemaRefusesEarly(runtime.runtime);}}),reference=await importOutcome(fresh,backup,jobId,ids);
  assert.ok(hits>0,'HISTORY_PROOF_MID_OPERATION_ORACLE import: the change follows a Tier 2 hit');
  assert.equal(reference.ok,false,'HISTORY_PROOF_MID_OPERATION_ORACLE import: the cold import under the change refuses');
  assert.deepEqual(proof,reference,'HISTORY_PROOF_MID_OPERATION_ORACLE import: a change after a Tier 2 hit yields the cold outcome');
  emit('HISTORY-PROOF-MID-IMPORT-VALIDATOR-CHANGE',{importHits:hits,code:proof.code});
 }
}

// 4. verify-recoverable-history 191-199 in ONE proof-holding worker: a valid
// active version must not hide an incompatible earlier checkpoint.
async function nestedSection(context){
 const {source,emit}=context;
 const anchor='try{assertProjectIntegrity(row.project,{verifyDerived:false});}catch(error){if(!legacyJobPointerProjection(row.project,{verifyDerived:false})){await quarantine';
 const permissiveReader=replaceOnce(source,anchor,'try{assertProjectIntegrity(row.project,{verifyDerived:false,verifyProjection:false});}catch(error){if(!legacyJobPointerProjection(row.project,{verifyDerived:false})){await quarantine','legacy-reader');
 const b=browser(permissiveReader),{jobId,project}=await fixture(b);
 assert.equal((await exportOutcome(b.store,jobId)).ok,true,'HISTORY_PROOF_NESTED_FIXTURE_ORACLE');
 const saved=b.page.copy(b.rows.get('projects').get(jobId)),bad=b.page.copy(saved);bad.project.job.CURRENT_STAGE='STAGE 30';bad.projectSha256=b.store.projectSha256(bad.project);b.rows.get('projects').set(jobId,bad);
 const incompatible=await b.store.saveCheckpoint(jobId,{expectedProjectRevision:project.revision,label:'Older incompatible projection'});
 b.rows.get('projects').set(jobId,saved);
 await b.store.saveCheckpoint(jobId,{expectedProjectRevision:project.revision,label:'Compatible active version'});
 const refused=await exportOutcome(b.store,jobId),cold=await exportOutcome(coldCopy(b.rows,permissiveReader).store,jobId);
 assert.equal(refused.ok,false,'HISTORY_PROOF_NESTED_ORACLE: the proof-holding export refuses the incompatible retained checkpoint');
 assert.equal(refused.code,'PROJECT_INTEGRITY_FAILED','HISTORY_PROOF_NESTED_ORACLE');assert.ok(refused.issues.some(issue=>/Application projection receipt is invalid|CURRENT_STAGE/.test(issue)),'HISTORY_PROOF_NESTED_ORACLE: issues carried from the worker');
 assert.deepEqual(refused,cold,'HISTORY_PROOF_NESTED_ORACLE: identical to the cold export');
 const entry=historyOf(b.rows,jobId).entries.find(row=>row.id===incompatible);
 assert.ok(entry&&!b.ledger().some(proof=>proof.snapshotSha256===entry.sha256),'HISTORY_PROOF_REFUSED_NEVER_MINTS_ORACLE: the incompatible root has no proof');
 emit('HISTORY-PROOF-NESTED-INCOMPATIBLE',{code:refused.code,issueCount:refused.issues.length,minted:false});
}

// 5. A permissive writer (in-memory mutant) certifies a root that the cold
// check refuses: its certificate is byte-verified, but it never mints.
async function permissiveWriterSection(context){
 const {source,production,emit}=context;
 const validation='try{assertProjectIntegrity(next,{prior,verifyDerived:!commitDerives,requireCurrentProjection:true});}catch(error){if(commitDerives&&error?.code===\'PROJECT_INTEGRITY_FAILED\')assertProjectIntegrity(next,{prior});throw error;}';
 const derived="    const issues=derivedProjectIntegrityIssues(next);\n    if(issues.length)throw";
 const permissive=replaceOnce(replaceOnce(source,validation,'if(globalThis.__permissiveWriter){next.job.CURRENT_STAGE=\'STAGE 30\';}else{'+validation+'}','permissive-writer'),derived,"    const issues=derivedProjectIntegrityIssues(next);\n    if(issues.length&&!globalThis.__permissiveWriter)throw",'permissive-writer-derivation');
 const b=browser(permissive),{jobId}=await fixture(b);let p=await b.store.readProject(jobId);
 b.worker().realm.runtime.__permissiveWriter=true;
 const next=b.store.clone(p);next.job.JOB_TITLE=retainedText('permissive');p=await b.store.writeProject(next,{expectedProjectRevision:p.revision});
 b.worker().realm.runtime.__permissiveWriter=false;
 const root=historyOf(b.rows,jobId).entries.find(entry=>entry.id===historyOf(b.rows,jobId).activeId);
 let checkpoint=null;try{await b.store.saveCheckpoint(jobId,{expectedProjectRevision:p.revision,view:b.page.copy({activeStage:1,activeView:'Records',drafts:{},scrollX:0,scrollY:7})});checkpoint='SAVED';}catch(error){checkpoint=error.code;}
 const refused=await exportOutcome(b.store,jobId),cold=await exportOutcome(coldCopy(b.rows,production).store,jobId);
 assert.equal(b.ledger().some(proof=>proof.snapshotSha256===root.sha256),false,'HISTORY_PROOF_PERMISSIVE_WRITER_ORACLE: a certificate the cold check refuses never mints');
 assert.equal(refused.ok,false,'HISTORY_PROOF_PERMISSIVE_WRITER_ORACLE: the export refuses the permissively written root');
 assert.deepEqual(refused,cold,'HISTORY_PROOF_PERMISSIVE_WRITER_ORACLE: identical to the cold export');
 emit('HISTORY-PROOF-PERMISSIVE-WRITER',{checkpoint,code:refused.code,minted:false});
}

// 6. Credential material only a retained version carries still requires a
// backup password when that version is proven: its classification is the
// proof's, computed from the same bytes.
async function credentialSection(context){
 const {source,production,emit}=context;
 const b=browser(source),{jobId}=await fixture(b);let p=await b.store.readProject(jobId);
 await b.store.putArtifact({artifactId:'HISTORY-PROOF-SECRET',jobId,blob:new Blob(['Exact retained secret bytes.']),filename:'retained-secret.bin',lineage:b.page.copy({stage:1,DISCLOSURE_CLASSIFICATION:'CREDENTIAL_SECRET'})});
 await b.store.saveCheckpoint(jobId,{expectedProjectRevision:p.revision,label:'Saved view'});
 await b.store.deleteArtifact('HISTORY-PROOF-SECRET',jobId);
 const passphrase='history proof reuse passphrase',protectedExport=await b.store.exportPackage(jobId,{passphrase});
 assert.equal(protectedExport.type,'application/vnd.closed-loop.encrypted+json','HISTORY_PROOF_CREDENTIAL_FIXTURE_ORACLE: the retained secret requires protection');
 b.resetCounts();const refused=await exportOutcome(b.store,jobId),hits=b.counts().exportHits,cold=await exportOutcome(coldCopy(b.rows,production).store,jobId);
 assert.ok(hits>0,'HISTORY_PROOF_CREDENTIAL_ORACLE: the proven versions are hits');
 assert.equal(refused.code,'BACKUP_PASSPHRASE_REQUIRED','HISTORY_PROOF_CREDENTIAL_ORACLE: a proven retained secret still requires a backup password');
 assert.deepEqual(refused,cold,'HISTORY_PROOF_CREDENTIAL_ORACLE: identical to the cold export');
 emit('HISTORY-PROOF-RETAINED-CREDENTIAL',{code:refused.code,exportHits:hits});
}

// 7. The measured, finite History watchdog: EXPORT_PACKAGE and IMPORT_PACKAGE
// use it; every other command keeps the 600000 ms storage watchdog. The worker
// runs commands one at a time, so each bound starts only when its command
// becomes the current one; a command queued behind a long export is not timed
// while it waits. A fired watchdog rejects with the worker-loss code and names
// its command; without a receipt the export claims unchanged projects.
async function watchdogSection(context){
 const {production,emit}=context;
 const page=()=>{
  const delays=[],timers=[],workers=[];
  class QueueWorker{constructor(){this.posted=[];workers.push(this);}postMessage(message){this.posted.push(message);}terminate(){this.terminated=true;}}
  const r=projectStoreRuntime({sourceOverrides:{'project-store.js':replaceOnce(production,PAGE_SCRIPT,'const STORE_SCRIPT_URL=globalThis.__storeScriptUrl;','watchdog-page')},environment:{Worker:QueueWorker,__storeScriptUrl:`https://closed-loop.invalid/project-store.js?v=${BUILD}`,
   setTimeout:(callback,delay)=>{if(delay>=600000){delays.push(delay);const handle={watchdog:timers.length,callback,cleared:false};timers.push(handle);return handle;}return setTimeout(callback,delay);},
   clearTimeout:handle=>{if(handle&&typeof handle==='object'&&Object.hasOwn(handle,'watchdog')){handle.cleared=true;return;}clearTimeout(handle);}}});
  const reply=(index,error={code:'HISTORY_PROOF_SYNTHETIC_REFUSAL',message:'Synthetic refusal.'})=>{const worker=workers[0],message=worker.posted[index];worker.onmessage({data:{operationId:message.operationId,buildIdentity:message.buildIdentity,ok:false,error}});};
  return {r,delays,timers,workers,reply};
 };
 const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
 {
  const {r,delays,timers,workers,reply}=page();
  assert.equal(r.store.STORAGE_WORKER_HISTORY_TIMEOUT_MS,HISTORY_WATCHDOG_MS,'HISTORY_PROOF_WATCHDOG_PIN_ORACLE: the exported bound equals its stated arithmetic');
  assert.ok(Number.isFinite(HISTORY_WATCHDOG_MS)&&HISTORY_WATCHDOG_MS>r.store.STORAGE_WORKER_TIMEOUT_MS,'HISTORY_PROOF_WATCHDOG_PIN_ORACLE: finite and above the command watchdog');
  const exported=r.store.exportPackage('JOB-WATCHDOG',{});await tick();
  const written=r.store.writeProject({job:{JOB_ID:'JOB-WATCHDOG'}});await tick();
  const imported=r.store.importPackage(new Blob(['{}']));await tick();
  assert.deepEqual(workers[0].posted.map(message=>message.method),['EXPORT_PACKAGE','WRITE_PROJECT','IMPORT_PACKAGE'],'HISTORY_PROOF_WATCHDOG_ORACLE: one worker, posting order');
  assert.deepEqual(delays,[HISTORY_WATCHDOG_MS],'HISTORY_PROOF_WATCHDOG_QUEUE_ORACLE: only the current command is timed; queued commands wait untimed');
  reply(0);await assert.rejects(exported,error=>error.code==='HISTORY_PROOF_SYNTHETIC_REFUSAL'&&error.existingProjectsUnchanged===true,'HISTORY_PROOF_WATCHDOG_ORACLE: the export refusal keeps its code');await tick();
  assert.deepEqual(delays,[HISTORY_WATCHDOG_MS,r.store.STORAGE_WORKER_TIMEOUT_MS],'HISTORY_PROOF_WATCHDOG_QUEUE_ORACLE: the next command is timed once it is current, with its own bound');
  assert.equal(timers[0].cleared,true,'HISTORY_PROOF_WATCHDOG_ORACLE: a settled command clears its watchdog');
  reply(1);await assert.rejects(written,error=>error.code==='HISTORY_PROOF_SYNTHETIC_REFUSAL');await tick();
  assert.deepEqual(delays,[HISTORY_WATCHDOG_MS,r.store.STORAGE_WORKER_TIMEOUT_MS,HISTORY_WATCHDOG_MS],'HISTORY_PROOF_WATCHDOG_QUEUE_ORACLE: per-command bounds in order');
  timers[2].callback();
  await assert.rejects(imported,error=>error.code==='STORAGE_WORKER_STOPPED'&&error.message===`Storage worker did not return IMPORT_PACKAGE within ${HISTORY_WATCHDOG_MS} ms. Its durable commit receipt is being checked before retry is permitted.`&&error.existingProjectsUnchanged===true,'HISTORY_PROOF_WATCHDOG_ORACLE: a fired watchdog names its command');
  assert.equal(workers[0].terminated,true,'HISTORY_PROOF_WATCHDOG_ORACLE: the timed-out worker is terminated');
 }
 {
  const {r,timers}=page();const exported=r.store.exportPackage('JOB-WATCHDOG',{});await tick();timers[0].callback();
  await assert.rejects(exported,error=>error.code==='STORAGE_WORKER_STOPPED'&&error.message===`Storage worker did not return EXPORT_PACKAGE within ${HISTORY_WATCHDOG_MS} ms. Its durable commit receipt is being checked before retry is permitted.`&&error.existingProjectsUnchanged===true,'HISTORY_PROOF_WATCHDOG_ORACLE: a fired export watchdog without a committed receipt claims unchanged projects');
 }
 emit('HISTORY-PROOF-WATCHDOG',{historyTimeoutMs:HISTORY_WATCHDOG_MS,commandTimeoutMs:STORAGE_WORKER_TIMEOUT_FOR_REPORT(production),queuedCommandsUntimed:true});
}
const STORAGE_WORKER_TIMEOUT_FOR_REPORT=source=>Number(/const STORAGE_WORKER_TIMEOUT_MS=(\d+)/.exec(source)?.[1]);

// 8. Pair proofs carry custody and source checks of exact descriptor rows. A
// legacy project's UTF-16LE original source has mediaType
// 'application/octet-stream', the normalized default; a crafted version B
// equal to A but with that descriptor's mediaType removed has A's normalized
// descriptors and is refused cold (SOURCE_ARCHIVE_INTEGRITY_FAILED).
async function pairDescriptorSection(context){
 const {source,emit}=context;
 const permissiveCustody=replaceOnce(source,"if(row?.mediaType!==source.mediaType||lineage?.schema!==ORIGINAL_SOURCE_SCHEMA","if((!globalThis.__permissiveCustody&&row?.mediaType!==source.mediaType)||lineage?.schema!==ORIGINAL_SOURCE_SCHEMA",'permissive-custody');
 const worker=(name,rows,code=source)=>{const realm=projectStoreRuntime({sourceOverrides:{'project-store.js':code},environment:workerEnvironment(name)});if(rows)for(const [family,data] of rows)realm.rows.set(family,new Map([...data].map(([key,value])=>[key,realm.copy(value)])));return realm;};
 const outcome=async promise=>{try{const value=await promise;return {ok:true,revision:value?.revision??null};}catch(error){return failure(error);}};
 // A legacy localStorage project migrates with its UTF-16LE original source.
 const legacyRuntime=projectStoreRuntime({sourceOverrides:{'project-store.js':source}});
 const legacy=plain(legacyRuntime.core.createBlankState('JOB-HISTORY-PROOF-PAIR'));legacy.schema='closed-loop-project/2';delete legacy.job.CONTRACT_PROFILE_ID;
 legacyRuntime.runtime.localStorage.setItem(legacyRuntime.store.LEGACY_KEYS[0],JSON.stringify(legacy));
 const migrated=(await legacyRuntime.store.readAll()).find(project=>project.job.JOB_ID==='JOB-HISTORY-PROOF-PAIR'),jobId=migrated.job.JOB_ID;
 const sources=(migrated.projectData.migrationArchives||[]).filter(row=>row.kind==='ORIGINAL_PROJECT_SOURCE');
 assert.ok(sources.some(row=>row.mediaType==='application/octet-stream'),'HISTORY_PROOF_PAIR_FIXTURE_ORACLE: a UTF-16LE original source');
 // One write and one checkpoint in a storage worker, then the minting export.
 const w=worker('PAIR-W',legacyRuntime.rows);await w.store.ready;
 {let p=await w.store.readProject(jobId);const next=w.store.clone(p);next.job.JOB_TITLE='Pair descriptor title '+'retained content '.repeat(300);p=await w.store.writeProject(next,{expectedProjectRevision:p.revision});
  await w.store.saveCheckpoint(jobId,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,view:w.copy({activeStage:1,activeView:'Workflow',drafts:{},scrollX:0,scrollY:3}),label:'Saved view'});}
 const backup=await w.store.exportPackage(jobId);assert.equal(backup.type,'application/gzip');
 const pre=copyRows(w.rows,w);
 // B: A's root snapshot with a new identity, A as parent, and the original
 // source descriptor's mediaType removed.
 const body=await backupBody(backup),recovery=body.recovery,active=recovery.entries.find(entry=>entry.id===recovery.activeId),rootA=active.projectReference?recovery.entries.find(entry=>entry.id===active.projectReference.checkpointId):active;
 const craft=async keepMediaType=>{
  const copy=plain(body),{member,snapshot}=await snapshotMember(copy,rootA.id),idB=randomUUID();snapshot.id=idB;snapshot.parentId=rootA.id;snapshot.label='Crafted copy';
  const row=snapshot.artifacts.find(descriptor=>sources.some(source=>source.artifactId===descriptor.artifactId));assert.ok(row,'HISTORY_PROOF_PAIR_FIXTURE_ORACLE: the source is in the checkpoint inventory');if(!keepMediaType)delete row.mediaType;
  const encoded=await w.runtime.__compressPackage(w.copy(snapshot)),bytes=Buffer.from(await encoded.blob.arrayBuffer()),shaB=await w.runtime.closedLoopHash.sha256Bytes(encoded.blob);
  copy.recovery.entries.push({...plain(rootA),id:idB,parentId:rootA.id,label:'Crafted copy',sha256:shaB,byteSize:bytes.length});copy.recovery.compressedProjectBytes+=bytes.length;
  const memberB={...plain(member),artifactId:'RECOVERY-SNAPSHOT-'+idB,filename:idB+'.checkpoint.gz',checkpointId:idB,byteSize:bytes.length,sha256:shaB,base64:bytes.toString('base64')};copy.artifacts.push(memberB);
  copy.packageManifest.artifacts.push({artifactId:memberB.artifactId,filename:memberB.filename,mediaType:memberB.mediaType,byteSize:memberB.byteSize,sha256:memberB.sha256});copy.packageManifest.artifactCount=copy.artifacts.length;
  return {blob:(await w.runtime.__compressPackage(w.copy(copy))).blob,idB,shaB};
 };
 const crafted=await craft(false),kept=await craft(true);
 // Controls: the unmodified backup and the crafted copy with mediaType kept import.
 assert.equal((await outcome(worker('PAIR-CONTROL-1',pre).store.importPackage(backup))).ok,true,'HISTORY_PROOF_PAIR_FIXTURE_ORACLE: the unmodified backup imports');
 assert.equal((await outcome(worker('PAIR-CONTROL-2',pre).store.importPackage(kept.blob))).ok,true,'HISTORY_PROOF_PAIR_FIXTURE_ORACLE: the crafted copy with its mediaType imports');
 const fresh=await outcome(worker('PAIR-FRESH',pre).store.importPackage(crafted.blob));
 assert.equal(fresh.code,'SOURCE_ARCHIVE_INTEGRITY_FAILED','HISTORY_PROOF_PAIR_FIXTURE_ORACLE: a fresh worker refuses B');
 // (a) Refused import, then a same-session retry of the same bytes.
 const first=await outcome(w.store.importPackage(crafted.blob));
 assert.deepEqual(first,fresh,'HISTORY_PROOF_PAIR_DESCRIPTOR_ORACLE: the first import refuses as a fresh worker does');
 assert.equal(w.runtime.__historyProofLedger.roots().some(proof=>proof.snapshotSha256===crafted.shaB),false,'HISTORY_PROOF_REFUSED_WITHDRAWN_ORACLE: a version its own artifact checks refused keeps no proof');
 w.runtime.__historyCounts=counts();const retry=await outcome(w.store.importPackage(crafted.blob));
 assert.deepEqual(retry,fresh,'HISTORY_PROOF_PAIR_DESCRIPTOR_ORACLE: a same-session retry refuses as a fresh worker does');
 assert.equal(historyOf(w.rows,jobId).entries.some(entry=>entry.id===crafted.idB),false,'HISTORY_PROOF_PAIR_DESCRIPTOR_ORACLE: the refused version is not committed');
 // (b) B already retained locally (written by a permissive importer mutant),
 // proven by an export (which runs no artifact checks), then a same-session
 // import of that export: B's proof must not borrow A's pair.
 const permissive=worker('PAIR-PERMISSIVE',pre,permissiveCustody);permissive.runtime.__permissiveCustody=true;
 assert.equal((await outcome(permissive.store.importPackage(crafted.blob))).ok,true,'HISTORY_PROOF_PAIR_FIXTURE_ORACLE: the permissive importer retains B');
 const retained=copyRows(permissive.rows,permissive),holder=worker('PAIR-HOLDER',retained);
 const exported=await holder.store.exportPackage(jobId);assert.ok(holder.runtime.__historyProofLedger.roots().some(proof=>proof.snapshotSha256===crafted.shaB),'HISTORY_PROOF_PAIR_FIXTURE_ORACLE: the export proves B');
 const holderPre=copyRows(holder.rows,holder),sameSession=await outcome(holder.store.importPackage(exported)),freshRetained=await outcome(worker('PAIR-FRESH-RETAINED',holderPre).store.importPackage(exported));
 assert.equal(freshRetained.ok,false,'HISTORY_PROOF_PAIR_FIXTURE_ORACLE: a fresh worker refuses the retained B');
 assert.deepEqual(sameSession,freshRetained,'HISTORY_PROOF_PAIR_DESCRIPTOR_ORACLE: a proven version with other descriptor rows must not use another version\'s pair');
 emit('HISTORY-PROOF-PAIR-DESCRIPTORS',{refused:fresh.code,retry:retry.code,retainedRefused:freshRetained.code,withdrawn:true});
}

// 9. Minting rules. A root accepted only through the legacy job-pointer
// tolerance never mints, nor does a view reference of an unproven root; each
// layer of the export check of a proven reference is tested on its own.
async function mintingSection(context){
 const {source,emit}=context;
 const MARK='Exact retained History title 1 ';
 // Test-only: in this realm a root titled MARK fails the strict static check
 // (an injected schema issue) and passes only through a forced legacy tolerance.
 const tolerant=replaceOnce(source,'function legacyJobPointerProjection(project,{verifyDerived=true,verifyProjection=true}={}){','function legacyJobPointerProjection(project,options){if(globalThis.__legacyTolerated?.(project))return {repairs:[]};return legacyJobPointerProjectionStrict(project,options);}\nfunction legacyJobPointerProjectionStrict(project,{verifyDerived=true,verifyProjection=true}={}){','legacy-tolerance');
 const marked=project=>String(project?.job?.JOB_TITLE||'').startsWith(MARK);
 const install=runtime=>{runtime.__legacyTolerated=marked;const original=runtime.closedLoopWorkflowSchema,shape=original.projectShapeIssues;runtime.closedLoopWorkflowSchema=Object.freeze({...original,projectShapeIssues:(project,collections)=>marked(project)?['Injected strict refusal of a tolerated legacy root.',...shape(project,collections)]:shape(project,collections)});return ()=>{runtime.closedLoopWorkflowSchema=original;delete runtime.__legacyTolerated;};};
 const b=browser(tolerant),{jobId}=await fixture(b);
 // A new worker (empty ledger) in which the change holds from its start.
 b.onWorker=realm=>{install(realm.runtime);};b.loseWorker();
 const proven=await exportOutcome(b.store,jobId),cold=coldCopy(b.rows,tolerant),undo=install(cold.runtime);let reference;try{reference=await exportOutcome(cold.store,jobId);}finally{undo();}
 assert.equal(proven.ok,true,'HISTORY_PROOF_LEGACY_TOLERANCE_FIXTURE_ORACLE: the tolerated root exports');assert.deepEqual(proven,reference,'HISTORY_PROOF_LEGACY_TOLERANCE_ORACLE: identical to the cold export');
 const state=historyOf(b.rows,jobId),ledger=b.ledger(),unproven=state.entries.filter(entry=>!entry.projectReference&&!ledger.some(proof=>proof.snapshotSha256===entry.sha256)),toleratedRoot=unproven[0];
 assert.equal(unproven.length,1,'HISTORY_PROOF_LEGACY_TOLERANCE_ORACLE: exactly the root accepted only through the legacy job-pointer tolerance stays unproven');
 assert.ok(state.entries.some(entry=>entry.projectReference?.checkpointId===toleratedRoot.id),'HISTORY_PROOF_LEGACY_TOLERANCE_FIXTURE_ORACLE: the tolerated root has view references');
 assertReferencesRooted(b.ledger(),'tolerated root');
 assert.equal(b.ledger().some(proof=>proof.kind==='reference'&&proof.rootSnapshotSha256===toleratedRoot.sha256),false,'HISTORY_PROOF_REFERENCE_ROOT_ORACLE: a reference of an unproven root minted');
 // Layers of the export check of a proven view reference, each on its own.
 {
  // Every value handed to the worker's checks is that realm's own copy.
  const realm=b.worker().realm.runtime,own=value=>b.worker().realm.copy(value),I=realm.__historyProofLedger.internals(),ref=own(state.entries.find(entry=>entry.projectReference&&entry.projectReference.checkpointId!==toleratedRoot.id)),root=own(state.entries.find(entry=>entry.id===ref.projectReference.checkpointId));
  const proof=I.historyRootProof(jobId,ref.sha256),rootProof=I.historyRootProof(jobId,root.sha256);assert.ok(proof&&rootProof,'HISTORY_PROOF_LAYER_FIXTURE_ORACLE');
  assert.equal(I.historyProofFactsMatch(proof,jobId,ref),true,'HISTORY_PROOF_LAYER_FIXTURE_ORACLE: the proven reference matches its entry');
  const other=state.entries.find(entry=>!entry.projectReference&&entry.id!==root.id&&entry.projectSha256===ref.projectSha256)||state.entries.find(entry=>!entry.projectReference&&entry.id!==root.id);
  for(const [label,changed] of [['other-root',{...ref,projectReference:{...ref.projectReference,checkpointId:other.id,snapshotSha256:other.sha256}}],['dropped-reference',(({projectReference,...rest})=>rest)(ref)]])
   assert.equal(I.historyProofFactsMatch(proof,jobId,own(changed)),false,'HISTORY_PROOF_FACTS_LAYER_ORACLE '+label+': a changed project reference still matched the proof');
  const saved=await I.metaGet(I.snapshotKey(jobId,ref.id)),base=snapshotSha256=>new Map([[root.id,{snapshotSha256,proven:true,projectSha256:rootProof.verifiedProjectSha256,workSha256:rootProof.verifiedWorkSha256}]]);
  const bound=await I.provenExportEntry(jobId,ref,saved,base(root.sha256),I.checkpointBytePrimitives(saved.blob),I.historyProofOperation(),new Map());
  assert.ok(bound,'HISTORY_PROOF_LAYER_FIXTURE_ORACLE: the reference is proven against its verified root');
  const unbound=await I.provenExportEntry(jobId,ref,saved,base('a'.repeat(64)),I.checkpointBytePrimitives(saved.blob),I.historyProofOperation(),new Map());
  assert.equal(unbound,null,'HISTORY_PROOF_ROOT_BINDING_LAYER_ORACLE: a reference proof was used against a root verified as other bytes');
 }
 emit('HISTORY-PROOF-MINTING-RULES',{toleratedRootMinted:false,referenceOfUnprovenRootMinted:false,layers:['project-reference','root-binding']});
}

// 10. The page realm and runtimes without a storage worker never hold proofs.
async function realmsSection(context){
 const {source,emit}=context;
 const b=browser(source),{jobId,initial}=await smallFixture(b);
 assert.equal((await exportOutcome(b.store,jobId)).ok,true);
 // A page-realm History decode (not a worker command).
 assert.ok(await b.page.store.readHistoryView(jobId),'HISTORY_PROOF_REALM_FIXTURE_ORACLE: a page-realm History read');
 assert.equal(b.page.runtime.__historyProofLedger.roots().length,0,'HISTORY_PROOF_REALM_ORACLE: the page realm holds no proofs');
 const cold=coldCopy(b.rows,source);
 assert.equal((await exportOutcome(cold.store,jobId)).ok,true);cold.runtime.__historyCounts=counts();assert.equal((await exportOutcome(cold.store,jobId)).ok,true);
 assert.equal(cold.runtime.__historyProofLedger.roots().length,0,'HISTORY_PROOF_REALM_ORACLE: a runtime without a storage worker holds no proofs');
 assert.equal(cold.runtime.__historyCounts.exportHits,0,'HISTORY_PROOF_REALM_ORACLE: its second export takes no proof hit');
 assert.ok(cold.runtime.__historyCounts.decodes>0,'HISTORY_PROOF_REALM_ORACLE: its second export decodes cold');
 // A reload (a new worker, empty ledger), then a stale tab's view checkpoint
 // against its earlier source version (no write certificate): its commit reads
 // that source root cold (proving it) and the committed view reference gains
 // its proof against that root.
 b.loseWorker();
 const id=await b.store.saveCheckpoint(jobId,{expectedProjectRevision:initial.revision,expectedStateSha256:initial.projectSha256,view:b.page.copy({activeStage:1,activeView:'Records',drafts:{},scrollX:0,scrollY:77}),label:'Saved view'});
 const state=historyOf(b.rows,jobId),saved=state.entries.find(entry=>entry.id===id),reloaded=b.ledger();
 assert.ok(saved?.projectReference,'HISTORY_PROOF_REALM_FIXTURE_ORACLE: the view checkpoint is a reference');
 assert.ok(reloaded.some(proof=>proof.kind==='root'&&proof.snapshotSha256===saved.projectReference.snapshotSha256),'HISTORY_PROOF_MINT_ORACLE reload: the first checkpoint after a reload proves its root');
 assert.ok(reloaded.some(proof=>proof.kind==='reference'&&proof.snapshotSha256===saved.sha256),'HISTORY_PROOF_MINT_ORACLE reload: a view reference committed without a write certificate gains its proof');
 assertReferencesRooted(reloaded,'reload');
 emit('HISTORY-PROOF-REALMS',{pageProofs:0,adapterProofs:0,adapterSecondExportDecodes:cold.runtime.__historyCounts.decodes,reloadedCheckpointProven:true});
}

// 11. An export's only write is its final verified-export record. When that
// record may have committed (a missing acknowledgement, a worker lost after
// it), the outcome is unconfirmed exactly as in the page realm; a worker lost
// before it leaves projects unchanged.
async function unconfirmedExportSection(context){
 const {source,emit}=context;
 const COMMIT="recordWorkerCommit(tx,operationId,project,project.projectSha256);await finished;return result;";
 let hooked=replaceOnce(source,"exportRecord.protectionProfile=passphrase?ENCRYPTED_EXPORT_PROFILE.schema:'UNENCRYPTED';","exportRecord.protectionProfile=passphrase?ENCRYPTED_EXPORT_PROFILE.schema:'UNENCRYPTED';if(globalThis.__exportBeforeCommit)await globalThis.__exportBeforeCommit();",'export-before-commit');
 hooked=hooked.split(COMMIT).length===2?replaceOnce(hooked,COMMIT,"recordWorkerCommit(tx,operationId,project,project.projectSha256);await finished;if(globalThis.__exportAfterCommit)await globalThis.__exportAfterCommit();return result;",'export-after-commit'):replaceOnce(hooked,"value:exportRecord,updatedAt:now()});await finished;return result;","value:exportRecord,updatedAt:now()});await finished;if(globalThis.__exportAfterCommit)await globalThis.__exportAfterCommit();return result;",'export-after-commit');
 const deadline=()=>{throw Object.assign(new Error('Storage transaction did not return within 30000 ms. Reload and verify the saved project before retrying.'),{code:'STORAGE_TRANSACTION_TIMEOUT',existingProjectsUnchanged:false});};
 const exported=key=>b=>b.rows.get('meta').get('lastVerifiedExport:'+key)?.value?.at??null;
 const receipts=b=>[...b.rows.get('meta').keys()].filter(key=>key.startsWith('storageOperation:'));
 const scenario=async(routing,hooks)=>{
  const b=browser(routing==='page'?replaceOnce(hooked,EXPORT_ROUTE,'','page-routing'):hooked),{jobId}=await smallFixture(b);
  for(const realm of [b.page.runtime,...b.workers.map(worker=>worker.realm.runtime)])Object.assign(realm,hooks.realm||{});
  const prior=exported(jobId)(b);let done=false;const pending=b.store.exportPackage(jobId).then(()=>({ok:true}),error=>({ok:false,code:error.code,message:error.message,existingProjectsUnchanged:error.existingProjectsUnchanged})).finally(()=>{done=true;});
  if(hooks.lose){for(let wait=0;wait<500&&!hooks.lose.ready(b,jobId,prior);wait++)await new Promise(resolve=>setTimeout(resolve,10));assert.equal(done,false);b.loseWorker();}
  const result=await pending;await new Promise(resolve=>setTimeout(resolve,20));
  return {result,written:exported(jobId)(b)!==prior,receipts:receipts(b).length};
 };
 const committed=(b,jobId,prior)=>exported(jobId)(b)!==prior;
 const page=await scenario('page',{realm:{__exportAfterCommit:deadline}}),worker=await scenario('worker',{realm:{__exportAfterCommit:deadline}});
 assert.equal(page.result.existingProjectsUnchanged,false,'HISTORY_PROOF_UNCONFIRMED_EXPORT_FIXTURE_ORACLE: the page-realm export reports a missing acknowledgement as unconfirmed');
 assert.deepEqual(worker.result,page.result,'HISTORY_PROOF_UNCONFIRMED_EXPORT_ORACLE: a missing acknowledgement of the final record is unconfirmed, as in the page realm');
 assert.equal(worker.written,true);assert.equal(worker.receipts,0,'HISTORY_PROOF_UNCONFIRMED_EXPORT_ORACLE: the recovered receipt is cleared');
 const lostAfter=await scenario('worker',{realm:{__exportAfterCommit:()=>new Promise(()=>{})},lose:{ready:committed}});
 assert.equal(lostAfter.written,true);
 assert.deepEqual(lostAfter.result,{ok:false,code:'STORAGE_WORKER_STOPPED',message:'Synthetic storage worker loss.',existingProjectsUnchanged:false},'HISTORY_PROOF_UNCONFIRMED_EXPORT_ORACLE: a worker lost after the final record committed is unconfirmed');
 assert.equal(lostAfter.receipts,0,'HISTORY_PROOF_UNCONFIRMED_EXPORT_ORACLE: the recovered receipt is cleared');
 let reachedCommit=false;
 const lostBefore=await scenario('worker',{realm:{__exportBeforeCommit:()=>{reachedCommit=true;return new Promise(()=>{});}},lose:{ready:()=>reachedCommit}});
 assert.equal(lostBefore.written,false);
 assert.deepEqual(lostBefore.result,{ok:false,code:'STORAGE_WORKER_STOPPED',message:'Synthetic storage worker loss.',existingProjectsUnchanged:true},'HISTORY_PROOF_UNCONFIRMED_EXPORT_ORACLE: a worker lost before the final record leaves projects unchanged');
 emit('HISTORY-PROOF-UNCONFIRMED-EXPORT',{deadlineAfterCommit:worker.result.existingProjectsUnchanged,lostAfterCommit:lostAfter.result.existingProjectsUnchanged,lostBeforeCommit:lostBefore.result.existingProjectsUnchanged});
}

// 12. The lazy first use is awaited only where proofs are minted (the worker,
// whose arguments are its own copies). Elsewhere a caller's change made right
// after the call is never read: the command and the canonical project are
// captured synchronously, as before the first use existed.
async function inputCaptureSection(context){
 const {source,emit}=context;
 const outcome=async promise=>{try{const value=await promise;return {ok:true,revision:value?.revision??null,title:value?.job?.JOB_TITLE??null};}catch(error){return failure(error);}};
 const native=async mutate=>{
  const r=projectStoreRuntime({sourceOverrides:{'project-store.js':source}}),p=await r.store.createProject({commandId:'HISTORY-PROOF-CAPTURE'});
  const command=r.copy({jobId:p.job.JOB_ID,stage:22,results:[{testId:'HISTORY-PROOF-CAPTURE-TEST',runtimeResult:{},inputArtifacts:[]}],expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
  const pending=r.store.commitNativeProductResults(command);mutate?.(command);return outcome(pending);
 };
 const unchanged=await native();
 for(const [label,mutate] of [['stage',command=>{command.stage=7;}],['revision',command=>{command.expectedProjectRevision+=5;}]])
  assert.deepEqual(await native(mutate),unchanged,'HISTORY_PROOF_INPUT_CAPTURE_ORACLE native '+label+': a change made after the call was read');
 const r=projectStoreRuntime({sourceOverrides:{'project-store.js':source}}),p=await r.store.createProject({commandId:'HISTORY-PROOF-CAPTURE-WRITE'}),next=r.store.clone(p);
 next.job.JOB_TITLE='Captured History proof title';const pending=r.store.writeProject(next,{expectedProjectRevision:p.revision});next.job.JOB_TITLE='Changed after the call';
 const written=await outcome(pending);
 assert.equal(written.title,'Captured History proof title','HISTORY_PROOF_INPUT_CAPTURE_ORACLE write: a change made after the call was read');
 emit('HISTORY-PROOF-INPUT-CAPTURE',{nativeOutcome:unchanged.code||'OK',writeCaptured:true});
}

// 13. The prior's active checkpoint (provenRetainedCheckpoint): an import
// prepares its prior project, whose no-op preparation proves the local active
// checkpoint restorable. In a proof-holding worker that checkpoint is re-bound
// to its proofs instead of read cold. Each fault in the local store after the
// proofs exist, each realm change before the import or right after that
// re-binding, and a recovery-compatibility refusal of a local version the
// backup does not hold (its pair derived in the future, or no pair) imports
// exactly as a fresh worker's cold import over the same rows.
export const RETAINED_FAULT_CASES=Object.freeze(['local-active-snapshot-bytes','local-root-snapshot-bytes','local-root-part-bytes','local-root-part-removed','local-root-segment-bytes','local-checkpoint-file-bytes','local-checkpoint-file-removed','local-record-label','local-manifest-stage']);
export const RETAINED_REALM_CASES=Object.freeze(['text-encoder','hash-sha256-bytes','json-parse','decompression-stream','blob-array-buffer','engine-property','schema-definition']);
async function retainedCheckpointSection(context){
 const {source,emit}=context;
 const b=browser(source),{jobId}=await fixture(b);
 assert.equal((await exportOutcome(b.store,jobId)).ok,true,'HISTORY_PROOF_RETAINED_FIXTURE_ORACLE: the minting export');
 const backup=await b.store.exportPackage(jobId),ids=(await backupBody(backup)).recovery.entries.map(entry=>entry.id);
 const ledgerOf=()=>b.worker().realm.runtime.__historyProofLedger;
 const hold=()=>({rows:copyRows(b.rows,b.page),ledger:ledgerOf().save()});
 const resetTo=held=>{for(const [name,data] of held.rows)b.rows.set(name,new Map([...data].map(([key,value])=>[key,b.page.copy(value)])));ledgerOf().restore(held.ledger);};
 // fault: an in-place edit of the rows; realm: a change applied to both
 // workers before the import; at: a change made at the same point of the
 // prior's preparation in both workers (proven in one, cold in the other).
 const compare=async(label,held,{fault=null,realm=null,at=null,ledger=null,blob=backup}={})=>{
  resetTo(held);fault?.(b.rows);ledger?.(ledgerOf());
  // Natives may be shared by every realm of this process: each runtime's
  // change is applied, used and undone in turn.
  const before=copyRows(b.rows,b.page),undos=[],apply=runtime=>{
   if(realm)undos.push(realm(runtime));
   if(at){let applied=false;runtime.__onImportReuse=point=>{if(point===at.point&&!applied){applied=true;undos.push(at.change(runtime));}};undos.push(()=>{delete runtime.__onImportReuse;});}
  };
  const undoAll=()=>{for(const undo of undos.splice(0).reverse())undo?.();};
  b.resetCounts();let same;
  try{apply(b.worker().realm.runtime);same=await importOutcome(b,blob,jobId,ids);}finally{undoAll();}
  const sameCounts={...b.counts()};let other;
  try{const fresh=browser(source,before,{onWorker:realm||at?runtime=>apply(runtime.runtime):null});other=await importOutcome(fresh,blob,jobId,ids);}finally{undoAll();}
  assert.deepEqual(same,other,'HISTORY_PROOF_RETAINED_EQUIVALENCE_ORACLE '+label+': a proof-holding worker must import exactly as a fresh cold worker');
  return {same,sameCounts};
 };
 const holding=hold();
 const happy=await compare('same-session',holding);
 assert.equal(happy.same.ok,true,'HISTORY_PROOF_RETAINED_FIXTURE_ORACLE: the same-session import succeeds');
 assert.ok(happy.same.stored.activatedDigestConsistent,'HISTORY_PROOF_RETAINED_EQUIVALENCE_ORACLE: the activated project matches its stored digest');
 assert.equal(happy.sameCounts.retainedHits,1,'HISTORY_PROOF_RETAINED_HIT_ORACLE: the prior\'s active checkpoint is re-bound to its proofs, not read cold');
 emit('HISTORY-PROOF-RETAINED-HAPPY',{retainedHits:happy.sameCounts.retainedHits,importHits:happy.sameCounts.importHits,identical:true});
 // A local version the backup does not hold: a later write and its view
 // checkpoint. A recovery-compatibility refusal of it is raised only by its
 // cold read; with its pair derived in the future, or without a pair, the
 // import must read it cold and refuse.
 let p=await b.store.readProject(jobId);{const next=b.store.clone(p);next.job.JOB_TITLE=retainedText('local only');next.vendorExtension=b.page.copy(retainedRecords(9));p=await b.store.writeProject(next,{expectedProjectRevision:p.revision});}
 await b.store.saveCheckpoint(jobId,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,view:b.page.copy({activeStage:1,activeView:'Workflow',drafts:{},scrollX:0,scrollY:91}),label:'Saved view'});
 const localOnly=hold(),LOCAL_MARK='Exact retained History title local only ';
 const refuseLocal=runtime=>{runtime.__recoveryRefusal=project=>String(project?.job?.JOB_TITLE||'').startsWith(LOCAL_MARK);return ()=>{delete runtime.__recoveryRefusal;};};
 const local=await compare('local-only',localOnly);
 assert.equal(local.same.ok,true,'HISTORY_PROOF_RETAINED_FIXTURE_ORACLE: the older backup imports over the later local version');
 assert.equal(local.sameCounts.retainedHits,1,'HISTORY_PROOF_RETAINED_HIT_ORACLE: the later local checkpoint is re-bound to its proofs');
 emit('HISTORY-PROOF-RETAINED-LOCAL-ONLY',{retainedHits:local.sameCounts.retainedHits,identical:true});
 const carried=await compare('local-only-derived-in-the-future',localOnly,{realm:refuseLocal,ledger:ledger=>ledger.shiftPairDerivedAt(3600000)});
 assert.equal(carried.same.code,'HISTORY_VERSION_INCOMPATIBLE','HISTORY_PROOF_RETAINED_DERIVED_ORACLE: a pair derived in the future carried its derived check');
 assert.equal(carried.sameCounts.retainedHits,0,'HISTORY_PROOF_RETAINED_DERIVED_ORACLE: a pair derived in the future was used');
 emit('HISTORY-PROOF-RETAINED-DERIVED-IN-THE-FUTURE',{refused:!carried.same.ok,code:carried.same.code??null,retainedHits:carried.sameCounts.retainedHits});
 const unpaired=await compare('local-only-without-pair',localOnly,{realm:refuseLocal,ledger:ledger=>ledger.dropPairs()});
 assert.equal(unpaired.same.code,'HISTORY_VERSION_INCOMPATIBLE','HISTORY_PROOF_RETAINED_PAIR_ORACLE: a checkpoint without a pair was re-bound');
 assert.equal(unpaired.sameCounts.retainedHits,0,'HISTORY_PROOF_RETAINED_PAIR_ORACLE: a checkpoint without a pair was re-bound');
 emit('HISTORY-PROOF-RETAINED-WITHOUT-PAIR',{refused:!unpaired.same.ok,code:unpaired.same.code??null,retainedHits:unpaired.sameCounts.retainedHits});
 // Local faults after the proofs exist, in the state before that later write.
 resetTo(holding);
 const state=rows=>historyOf(rows,jobId),active=rows=>state(rows).entries.find(entry=>entry.id===state(rows).activeId);
 const root=rows=>{const entry=active(rows);return entry.projectReference?state(rows).entries.find(row=>row.id===entry.projectReference.checkpointId):entry;};
 const rootRecord=rows=>snapshotRow(rows,jobId,root(rows).id).value;
 const firstPart=rows=>rootRecord(rows).projectParts.entries.find(entry=>!entry.segments);
 const segment=rows=>rootRecord(rows).projectParts.entries.find(entry=>entry.segments&&entry.segments.length>1).segments[1];
 const replaceBlob=row=>{row.value.blob=corrupt(row.value.blob);};
 const removeRow=key=>rows=>{rows.get('meta').delete(key(rows));};
 const fileSha=async rows=>{const blob=snapshotRow(rows,jobId,active(rows).id).value.blob,snapshot=JSON.parse(gunzipSync(Buffer.from(await blob.arrayBuffer())).toString('utf8'));return snapshot.artifacts[0].sha256;};
 const checkpointFile=await fileSha(b.rows);
 assert.ok(root(b.rows).id!==active(b.rows).id&&Object.hasOwn(root(b.rows),'projectPartsSha256'),'HISTORY_PROOF_RETAINED_FIXTURE_ORACLE: the active checkpoint is a view reference to a state-form root');
 assert.ok(fileRow(b.rows,jobId,checkpointFile),'HISTORY_PROOF_RETAINED_FIXTURE_ORACLE: the active checkpoint\'s file is a retained History file');
 const faults={
  'local-active-snapshot-bytes':rows=>replaceBlob(snapshotRow(rows,jobId,active(rows).id)),
  'local-root-snapshot-bytes':rows=>replaceBlob(snapshotRow(rows,jobId,root(rows).id)),
  'local-root-part-bytes':rows=>replaceBlob(fileRow(rows,jobId,firstPart(rows).sha256)),
  'local-root-part-removed':removeRow(rows=>'recovery:'+jobId+':bytes:'+firstPart(rows).sha256),
  'local-root-segment-bytes':rows=>replaceBlob(fileRow(rows,jobId,segment(rows).sha256)),
  'local-checkpoint-file-bytes':rows=>replaceBlob(fileRow(rows,jobId,checkpointFile)),
  'local-checkpoint-file-removed':removeRow(()=>'recovery:'+jobId+':bytes:'+checkpointFile),
  'local-record-label':rows=>{snapshotRow(rows,jobId,active(rows).id).value.label='Edited local record label';},
  'local-manifest-stage':rows=>{active(rows).stage=2;}
 };
 assert.deepEqual(Object.keys(faults),[...RETAINED_FAULT_CASES]);
 for(const [label,fault] of Object.entries(faults)){
  const result=await compare(label,holding,{fault});
  emit('HISTORY-PROOF-RETAINED-FAULT-'+label,{refused:!result.same.ok,code:result.same.code??null,retainedHits:result.sameCounts.retainedHits});
 }
 // Realm changes before the import, and right after the re-binding.
 const realms={'text-encoder':swaps.textEncoder,'hash-sha256-bytes':swaps.hashBytes,'json-parse':swaps.jsonParse,'decompression-stream':swaps.decompression,'blob-array-buffer':swaps.blobArrayBuffer,'engine-property':swaps.engineProperty,'schema-definition':swaps.schemaRefusesEarly};
 assert.deepEqual(Object.keys(realms),[...RETAINED_REALM_CASES]);
 for(const [label,realm] of Object.entries(realms)){
  const before=await compare('before-'+label,holding,{realm});
  assert.equal(before.sameCounts.retainedHits,0,'HISTORY_PROOF_RETAINED_INPUTS_ORACLE before-'+label+': a changed input re-bound the checkpoint');
  emit('HISTORY-PROOF-RETAINED-REALM-before-'+label,{refused:!before.same.ok,code:before.same.code??null,retainedHits:before.sameCounts.retainedHits});
  // Natives or validators changed after the re-binding are seen by the
  // verdict's last check.
  const rebound=await compare('rebound-'+label,holding,{at:{point:'retained-rebound',change:realm}});
  assert.equal(rebound.sameCounts.retainedHits,0,'HISTORY_PROOF_RETAINED_INPUTS_ORACLE rebound-'+label+': an input changed after the re-binding was not seen');
  emit('HISTORY-PROOF-RETAINED-REALM-rebound-'+label,{refused:!rebound.same.ok,code:rebound.same.code??null,retainedHits:rebound.sameCounts.retainedHits});
  const used=await compare('used-'+label,holding,{at:{point:'retained-verdict',change:realm}});
  assert.equal(used.sameCounts.retainedHits,1,'HISTORY_PROOF_RETAINED_FIXTURE_ORACLE used-'+label+': the change follows the re-binding');
  emit('HISTORY-PROOF-RETAINED-REALM-used-'+label,{refused:!used.same.ok,code:used.same.code??null,retainedHits:used.sameCounts.retainedHits});
 }
}

// 14. Digests importPackage computes once and reuses (P3): the package
// project's digest (recovery check, then bindRestoredCandidates) and the
// active version's work comparison (activation, then its source reference).
// Each reuse runs in the synchronous span of its computation, never across an
// await (a microtask queued at the computation has not run), and equals a
// fresh computation at the reuse. After a new version's preparation (an
// await) the work comparison is computed again, not reused.
function digestSpans(runtime){
 const spans=new Map(),uses=[];
 runtime.__digestSpan={open(name){const span={closed:false};queueMicrotask(()=>{span.closed=true;});spans.set(name,span);},use(name,used,fresh){const span=spans.get(name);uses.push({name,sameTurn:Boolean(span)&&!span.closed,equal:Object.is(used,fresh())});}};
 return {uses,undo:()=>{delete runtime.__digestSpan;}};
}
async function digestSpansSection(context){
 const {source,emit}=context;
 const b=browser(source),{jobId}=await fixture(b);
 assert.equal((await exportOutcome(b.store,jobId)).ok,true,'HISTORY_PROOF_DIGEST_SPAN_FIXTURE_ORACLE: the minting export');
 const spanImport=async(label,blob,expected)=>{
  const ids=(await backupBody(blob)).recovery.entries.map(entry=>entry.id),before=copyRows(b.rows,b.page),spans=digestSpans(b.worker().realm.runtime);let same;
  try{same=await importOutcome(b,blob,jobId,ids);}finally{spans.undo();}
  const other=await importOutcome(browser(source,before),blob,jobId,ids);
  assert.deepEqual(same,other,'HISTORY_PROOF_DIGEST_SPAN_EQUIVALENCE_ORACLE '+label+': the import differs from a fresh cold import');
  assert.equal(same.ok,true,'HISTORY_PROOF_DIGEST_SPAN_FIXTURE_ORACLE '+label);
  for(const use of spans.uses){
   assert.equal(use.sameTurn,true,'HISTORY_PROOF_DIGEST_SPAN_ORACLE '+label+' '+use.name+': a digest was reused across an await');
   assert.equal(use.equal,true,'HISTORY_PROOF_DIGEST_SPAN_ORACLE '+label+' '+use.name+': a reused digest differs from a fresh computation');
  }
  const count=name=>spans.uses.filter(use=>use.name===name).length;
  assert.deepEqual({packageProject:count('package-project'),activeWork:count('active-work')},expected,'HISTORY_PROOF_DIGEST_SPAN_REUSE_ORACLE '+label+': the digests reused');
  emit('HISTORY-PROOF-DIGEST-SPAN-'+label,{packageProjectReuses:count('package-project'),activeWorkReuses:count('active-work'),sameTurn:true,equal:true});
 };
 // The backup's active version is the package project: it is activated.
 await spanImport('activated',await b.store.exportPackage(jobId),{packageProject:1,activeWork:1});
 // A file stored after the last checkpoint: the package's files differ from
 // its active version's, so the import prepares a new version (an await).
 {let p=await b.store.readProject(jobId);const next=b.store.clone(p);await storeFile(b.page,next,{stage:1,filename:'span.txt',text:'Exact Stage 1 file span.\n',commandId:'HISTORY-PROOF-REUSE-span'});}
 await spanImport('new-version',await b.store.exportPackage(jobId),{packageProject:1,activeWork:0});
}

const SECTION_RUNNERS=Object.freeze({'export':exportSection,'import':importSection,'mid-operation':midOperationSection,'nested':nestedSection,'permissive-writer':permissiveWriterSection,'credential':credentialSection,'watchdog':watchdogSection,'pair-descriptors':pairDescriptorSection,'minting':mintingSection,'realms':realmsSection,'unconfirmed-export':unconfirmedExportSection,'input-capture':inputCaptureSection,'retained-checkpoint':retainedCheckpointSection,'digest-spans':digestSpansSection});
assert.deepEqual(Object.keys(SECTION_RUNNERS),[...HISTORY_PROOF_SECTIONS]);

export async function verifyHistoryProofReuse({fault=null,sections=null}={}){
 let production=fs.readFileSync('project-store.js','utf8');
 if(fault){assert.ok(HISTORY_PROOF_FAULTS[fault],'Unknown history proof fault: '+fault);production=HISTORY_PROOF_FAULTS[fault].apply(production);}
 const selected=sections||(fault?HISTORY_PROOF_FAULTS[fault].sections:HISTORY_PROOF_SECTIONS);
 const source=observed(production),cases=[],emit=(caseId,details={})=>cases.push({caseId,result:'PASS',...details}),timings={};
 for(const name of selected){const started=performance.now();await SECTION_RUNNERS[name]({source,production,emit,faultMode:Boolean(fault)});timings[name]=Math.round(performance.now()-started);}
 return {result:'PASS',synthetic:true,actualBrowser:false,transactionAdapter:true,storageWorkerRealm:true,productionSourceSha256:sha(fs.readFileSync('project-store.js','utf8')),watchdogMs:HISTORY_WATCHDOG_MS,sections:[...selected],sectionMs:timings,caseCount:cases.length,cases};
}

if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
 const requested=process.argv.find(arg=>arg.startsWith('--fault='))?.slice(8)||null;
 if(requested){await verifyHistoryProofReuse({fault:requested});console.log(JSON.stringify({fault:requested,detected:false}));process.exitCode=1;}
 else{
  const result=await verifyHistoryProofReuse(),faults=[];
  // Each intended fault reruns only the sections holding its oracle.
  for(const [name,{oracle,sections}]of Object.entries(HISTORY_PROOF_FAULTS)){
   // A fault whose edit no longer applies is never counted as detected.
   await assert.rejects(()=>verifyHistoryProofReuse({fault:name}),error=>error?.code==='ERR_ASSERTION'&&String(error.message).includes(oracle)&&!String(error.message).includes('HISTORY_PROOF_ANCHOR_ORACLE'),'HISTORY_PROOF_INTENDED_FAULT_ORACLE '+name);
   faults.push({fault:name,detected:true,oracle,sections:[...sections]});
  }
  console.log(JSON.stringify({historyProofReuse:{...result,faults}},null,1));
 }
}
