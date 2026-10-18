import {verifyReviewedProjectHandoffControls} from './verify-reviewed-project-handoff.mjs';
import {verifyBrowserObserverLifecycleControls} from './test-browser-observer-lifecycle.mjs';
import {verifyBrowserExtraAggregateControls} from './verify-browser-extra-aggregate.mjs';
import {performance} from 'node:perf_hooks';
import {auditCatalogExpectationRoundTrips} from './test-comparison-receipt-roundtrip.mjs';
import {runHistoricalContextLedger} from './historical-context-ledger-adapter.mjs';
import {atomicEvidenceReferences} from './review-specification-coverage.mjs';
import {verifyRetainedRootNativeEvidenceConsumers} from './test-retained-root-native-evidence.mjs';
import {verifyHumanCombinedNativeEvidenceConsumers} from './test-human-combined-native-evidence.mjs';
import {verifyHumanCombinedUiEvidenceConsumers} from './test-human-combined-ui-evidence.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {verifyDueEvidenceConsumers} from './test-due-evidence-consumers.mjs';
import {verifyDueVerificationScheduling,verifyCrossRunVerificationScheduling} from './test-due-verification-scheduling.mjs';
import {runVerifier,detectedFault,AGGREGATE_TIMEOUT_MS} from './verify-conformance-regressions.mjs';
import {evidenceFingerprint,createExecutionReceipt,validateExecutionReceipt,aggregateExecutedEvidence,readExecutedEvidence,readExecutionReceipt,observationsFromReports,sha} from './verification-evidence.mjs';
import {metricCatalog,verificationCatalog,browserVerificationCatalog} from './verification-evidence-catalog.mjs';
import {collectVerificationEvidence,executeEvidenceProducer} from './collect-verification-evidence.mjs';
import {assertWorkflowPreloadBoundaries} from './verified-site.mjs';

// Native process entry time includes module startup; historical setup and cleanup share this original owner budget.
const originalLedgerOwnerStartedAtUnixMs=performance.timeOrigin;
auditCatalogExpectationRoundTrips();
const COPY_ROOT_ORACLE='EXECUTED_EVIDENCE_COPY_ROOT_ORACLE';
const EXECUTED_EVIDENCE_SPLIT_REQUIREMENTS=Object.freeze({
  primaryAvailableBytes:268574720n,
  secondaryAvailableBytes:119607296n
});
const copyRootError=message=>new Error(COPY_ROOT_ORACLE+': '+message);
const availableBytes=target=>{const value=fs.statfsSync(target,{bigint:true});return value.bavail*value.bsize;};
const isWithin=(parent,target)=>target===parent||target.startsWith(parent+path.sep);
const attachCleanupErrors=(error,cleanupErrors)=>{
  if(!cleanupErrors.length||typeof error!=='object'||error===null)return;
  try{
    if(Array.isArray(error.cleanupErrors))error.cleanupErrors.push(...cleanupErrors);
    else Object.defineProperty(error,'cleanupErrors',{value:[...cleanupErrors],enumerable:false});
  }catch{/* Cleanup diagnostics are best-effort and never replace the original failure. */}
};

function validateExecutedEvidenceCopyBase(copyBase,{primaryRoot,sourceRoot=process.cwd(),requirements=EXECUTED_EVIDENCE_SPLIT_REQUIREMENTS}={}){
  if(typeof copyBase!=='string'||!copyBase||!path.isAbsolute(copyBase))throw copyRootError('CLOSED_LOOP_EXECUTED_EVIDENCE_COPY_BASE must be a nonempty absolute path');
  if(typeof primaryRoot!=='string'||!path.isAbsolute(primaryRoot))throw copyRootError('primary temporary root must be an absolute path');
  const normalizedBase=path.normalize(copyBase),normalizedPrimary=path.normalize(primaryRoot);
  let baseInfo,primaryInfo,realBase,realPrimary,realSource;
  try{
    baseInfo=fs.lstatSync(normalizedBase);primaryInfo=fs.lstatSync(normalizedPrimary);
    realBase=fs.realpathSync(normalizedBase);realPrimary=fs.realpathSync(normalizedPrimary);realSource=fs.realpathSync(sourceRoot);
  }catch(error){throw copyRootError('configured paths must already exist and resolve: '+error.code);}
  if(!baseInfo.isDirectory()||baseInfo.isSymbolicLink())throw copyRootError('CLOSED_LOOP_EXECUTED_EVIDENCE_COPY_BASE must be an ordinary directory, not a file or symbolic link');
  if(realBase!==normalizedBase)throw copyRootError('CLOSED_LOOP_EXECUTED_EVIDENCE_COPY_BASE must not use aliases or symbolic-link ancestors');
  if(!primaryInfo.isDirectory()||primaryInfo.isSymbolicLink()||realPrimary!==normalizedPrimary)throw copyRootError('primary temporary root must be an unaliased ordinary directory');
  if(isWithin(realSource,realBase))throw copyRootError('CLOSED_LOOP_EXECUTED_EVIDENCE_COPY_BASE must be outside the source repository');
  if(baseInfo.dev===primaryInfo.dev)throw copyRootError('CLOSED_LOOP_EXECUTED_EVIDENCE_COPY_BASE must be on a different filesystem from the primary temporary root');
  const primaryAvailable=availableBytes(realPrimary),secondaryAvailable=availableBytes(realBase);
  if(primaryAvailable<requirements.primaryAvailableBytes)throw copyRootError('insufficient primary temporary capacity: requires '+requirements.primaryAvailableBytes+' bytes, observed '+primaryAvailable);
  if(secondaryAvailable<requirements.secondaryAvailableBytes)throw copyRootError('insufficient secondary copy capacity: requires '+requirements.secondaryAvailableBytes+' bytes, observed '+secondaryAvailable);
  return {base:realBase,primaryRoot:realPrimary,sourceRoot:realSource,primaryDevice:primaryInfo.dev,secondaryDevice:baseInfo.dev,primaryAvailableBytes:primaryAvailable,secondaryAvailableBytes:secondaryAvailable};
}

function createExecutedEvidenceCopyRoot(copyBase,options){
  const validated=validateExecutedEvidenceCopyBase(copyBase,options);
  const secondaryRoot=fs.mkdtempSync(path.join(validated.base,'closed-loop-executed-evidence-copy-'));
  try{
    const info=fs.lstatSync(secondaryRoot),realRoot=fs.realpathSync(secondaryRoot);
    if(!info.isDirectory()||info.isSymbolicLink()||realRoot!==secondaryRoot||path.dirname(realRoot)!==validated.base||isWithin(validated.sourceRoot,realRoot)||info.dev!==validated.secondaryDevice)throw copyRootError('created secondary root violated directory, ancestry, source-isolation, or device invariants');
    return {...validated,secondaryRoot:realRoot};
  }catch(error){
    try{fs.rmSync(secondaryRoot,{recursive:true,force:true});}catch(cleanupError){attachCleanupErrors(error,[cleanupError]);}
    throw error;
  }
}

function validatePersistentChildEvidenceDirectory(value,{primaryRoot,sourceRoot=process.cwd()}={}){
  if(typeof value!=='string'||!value||!path.isAbsolute(value))throw copyRootError('split mode requires VERIFIER_CHILD_EVIDENCE_DIRECTORY to be a nonempty absolute persistent path');
  if(typeof primaryRoot!=='string'||!path.isAbsolute(primaryRoot))throw copyRootError('primary temporary root must be an absolute path');
  const normalized=path.normalize(value),normalizedPrimary=path.normalize(primaryRoot);
  let info,primaryInfo,realDirectory,realPrimary,realSource;
  try{
    info=fs.lstatSync(normalized);primaryInfo=fs.lstatSync(normalizedPrimary);
    realDirectory=fs.realpathSync(normalized);realPrimary=fs.realpathSync(normalizedPrimary);realSource=fs.realpathSync(sourceRoot);
  }catch(error){throw copyRootError('persistent child evidence and primary/source paths must already exist and resolve: '+error.code);}
  if(!info.isDirectory()||info.isSymbolicLink()||realDirectory!==normalized)throw copyRootError('VERIFIER_CHILD_EVIDENCE_DIRECTORY must be an existing unaliased ordinary directory');
  if(!primaryInfo.isDirectory()||primaryInfo.isSymbolicLink()||realPrimary!==normalizedPrimary)throw copyRootError('primary temporary root must be an unaliased ordinary directory');
  if(info.dev!==primaryInfo.dev)throw copyRootError('VERIFIER_CHILD_EVIDENCE_DIRECTORY must use the primary temporary filesystem');
  if(isWithin(realPrimary,realDirectory)||isWithin(realDirectory,realPrimary)||isWithin(realSource,realDirectory)||isWithin(realDirectory,realSource))throw copyRootError('VERIFIER_CHILD_EVIDENCE_DIRECTORY must be persistent and disjoint from temporary and source roots');
  try{fs.accessSync(realDirectory,fs.constants.R_OK|fs.constants.W_OK|fs.constants.X_OK);}catch(error){throw copyRootError('VERIFIER_CHILD_EVIDENCE_DIRECTORY must be readable, writable, and searchable: '+error.code);}
  return {directory:realDirectory,primaryDevice:primaryInfo.dev,evidenceDevice:info.dev};
}

async function verifyPersistentChildEvidenceRetention({primaryRoot,persistent}){
  const scratch=path.join(primaryRoot,'persistent-child-evidence-control');fs.mkdirSync(scratch);
  let expected,unexpected;
  try{
    expected=await runVerifier(process.execPath,['-e',"process.stderr.write('CONTROLLED_EXPECTED_CHILD_FAILURE\\n');process.exitCode=1"],{cwd:scratch,timeout:5000,maxBuffer:64*1024,env:{...process.env,NODE_OPTIONS:''}});
    unexpected=await runVerifier(process.execPath,['-e',"throw new Error('CONTROLLED_UNEXPECTED_CHILD_FAILURE')"],{cwd:scratch,timeout:5000,maxBuffer:64*1024,env:{...process.env,NODE_OPTIONS:''}});
  }finally{fs.rmSync(scratch,{recursive:true,force:true});}
  assert.equal(expected.status,1,'PERSISTENT_CHILD_EVIDENCE_ORACLE: controlled expected failure exit changed.');
  assert.equal(expected.stderr,'CONTROLLED_EXPECTED_CHILD_FAILURE\n','PERSISTENT_CHILD_EVIDENCE_ORACLE: expected raw stderr changed.');
  assert.equal(unexpected.status,1,'PERSISTENT_CHILD_EVIDENCE_ORACLE: controlled unexpected failure exit changed.');
  assert.match(unexpected.stderr,/CONTROLLED_UNEXPECTED_CHILD_FAILURE/,'PERSISTENT_CHILD_EVIDENCE_ORACLE: unexpected raw stderr disappeared.');
  for(const result of [expected,unexpected]){
    for(const file of [result.evidencePath,result.stdoutPath,result.stderrPath]){
      assert.equal(path.dirname(file),persistent.directory,'PERSISTENT_CHILD_EVIDENCE_ORACLE: raw child output escaped the caller-owned directory.');
      assert.equal(fs.existsSync(file),true,'PERSISTENT_CHILD_EVIDENCE_ORACLE: raw child output disappeared with temporary cleanup.');
    }
    assert.equal(JSON.parse(fs.readFileSync(result.evidencePath,'utf8')).stderr,result.stderr,'PERSISTENT_CHILD_EVIDENCE_ORACLE: persisted runner receipt lost raw stderr.');
    assert.equal(fs.readFileSync(result.stderrPath,'utf8'),result.stderr,'PERSISTENT_CHILD_EVIDENCE_ORACLE: persisted stderr file differs from the observed bytes.');
  }
  return {result:'PASS',boundedMaxOutputBytes:64*1024,retainedAfterPrimaryControlCleanup:true,expected:{status:expected.status,stderrSha256:sha(expected.stderr),evidencePath:expected.evidencePath,stderrPath:expected.stderrPath},unexpected:{status:unexpected.status,stderrSha256:sha(unexpected.stderr),evidencePath:unexpected.evidencePath,stderrPath:unexpected.stderrPath}};
}

function cleanupExecutedEvidenceRoots({primaryRoot,secondaryRoot,executionFailed=false,executionError,remove=fs.rmSync}){
  const cleanupErrors=[];
  for(const root of [secondaryRoot,primaryRoot])if(root)try{remove(root,{recursive:true,force:true});}catch(error){cleanupErrors.push(error);}
  if(executionFailed){
    attachCleanupErrors(executionError,cleanupErrors);
    throw executionError;
  }
  if(cleanupErrors.length)throw new AggregateError(cleanupErrors,COPY_ROOT_ORACLE+': temporary root cleanup failed');
}

function verifyExecutedEvidenceCopyRootControls({primaryRoot,splitLayout,configuredCopyBase,sourceRoot=process.cwd()}){
  const root=path.join(primaryRoot,'copy-root-controls');fs.mkdirSync(root);
  const prefix='closed-loop-executed-evidence-copy-';
  const prefixEntries=base=>fs.readdirSync(base).filter(name=>name.startsWith(prefix)).sort();
  const canonicalPrimary=fs.realpathSync(primaryRoot),beforeSame=prefixEntries(canonicalPrimary);
  assert.throws(()=>createExecutedEvidenceCopyRoot(canonicalPrimary,{primaryRoot:canonicalPrimary,sourceRoot}),/must be on a different filesystem/,'COPY_ROOT_CONTROL_ORACLE: same-device copy base was admitted.');
  assert.deepEqual(prefixEntries(canonicalPrimary),beforeSame,'COPY_ROOT_CONTROL_ORACLE: same-device rejection created a secondary parent.');
  const alias=['/var/run','/var/lock','/bin','/sbin','/lib'].find(candidate=>{try{return fs.lstatSync(candidate).isSymbolicLink();}catch{return false;}});
  let symlinkAliasRejection='UNAVAILABLE_NO_SYSTEM_SYMLINK';
  if(alias){assert.throws(()=>validateExecutedEvidenceCopyBase(alias,{primaryRoot,sourceRoot}),/ordinary directory|aliases or symbolic-link ancestors/,'COPY_ROOT_CONTROL_ORACLE: symbolic-link copy base was admitted.');symlinkAliasRejection='PASS_READ_ONLY_'+alias;}
  let lowCapacityRefusal='DEFERRED_UNTIL_CONFIGURED_SPLIT_RUN';
  if(splitLayout){
    const beforeLow=prefixEntries(splitLayout.secondaryRoot);
    assert.throws(()=>createExecutedEvidenceCopyRoot(splitLayout.secondaryRoot,{primaryRoot,sourceRoot,requirements:{primaryAvailableBytes:1n,secondaryAvailableBytes:2n**63n}}),/insufficient secondary copy capacity/,'COPY_ROOT_CONTROL_ORACLE: insufficient secondary capacity was admitted.');
    assert.deepEqual(prefixEntries(splitLayout.secondaryRoot),beforeLow,'COPY_ROOT_CONTROL_ORACLE: low-capacity rejection created a secondary parent.');
    lowCapacityRefusal='PASS';
  }
  const makeRoots=name=>{const primary=path.join(root,name+'-primary'),secondary=path.join(root,name+'-secondary');fs.mkdirSync(primary);fs.mkdirSync(secondary);return {primary,secondary};};
  const success=makeRoots('success'),successCalls=[];
  cleanupExecutedEvidenceRoots({primaryRoot:success.primary,secondaryRoot:success.secondary,remove:(target,options)=>{successCalls.push(target);fs.rmSync(target,options);}});
  assert.deepEqual(successCalls,[success.secondary,success.primary],'COPY_ROOT_CONTROL_ORACLE: success cleanup order changed.');
  const failureRoots=makeRoots('failure'),failure=Object.assign(new Error('CONTROLLED_COPY_ROOT_FAILURE'),{cleanupErrors:[new Error('CONTROLLED_INNER_CLEANUP_FAILURE')]}),failureCalls=[];let observedFailure;
  try{cleanupExecutedEvidenceRoots({primaryRoot:failureRoots.primary,secondaryRoot:failureRoots.secondary,executionFailed:true,executionError:failure,remove:(target,options)=>{failureCalls.push(target);if(target===failureRoots.secondary)throw new Error('CONTROLLED_OUTER_CLEANUP_FAILURE');fs.rmSync(target,options);}});}catch(error){observedFailure=error;}
  assert.equal(observedFailure,failure,'COPY_ROOT_CONTROL_ORACLE: cleanup replaced the original execution failure.');
  assert.deepEqual(failureCalls,[failureRoots.secondary,failureRoots.primary],'COPY_ROOT_CONTROL_ORACLE: a secondary cleanup failure skipped primary cleanup.');
  assert.deepEqual(failure.cleanupErrors.map(error=>error.message),['CONTROLLED_INNER_CLEANUP_FAILURE','CONTROLLED_OUTER_CLEANUP_FAILURE'],'COPY_ROOT_CONTROL_ORACLE: nested cleanup failures were lost or reordered.');
  fs.rmSync(failureRoots.secondary,{recursive:true,force:true});
  const cancellationRoots=makeRoots('cancellation'),cancellation=Object.assign(new Error('CONTROLLED_COPY_ROOT_ABORT'),{name:'AbortError',code:'ABORT_ERR'});let observedCancellation;
  try{cleanupExecutedEvidenceRoots({primaryRoot:cancellationRoots.primary,secondaryRoot:cancellationRoots.secondary,executionFailed:true,executionError:cancellation});}catch(error){observedCancellation=error;}
  assert.equal(observedCancellation,cancellation,'COPY_ROOT_CONTROL_ORACLE: cancellation identity changed during cleanup.');
  assert(!fs.existsSync(cancellationRoots.primary)&&!fs.existsSync(cancellationRoots.secondary),'COPY_ROOT_CONTROL_ORACLE: cancellation left a temporary root.');
  const frozenRoots=makeRoots('frozen'),frozen=Object.freeze(new Error('CONTROLLED_FROZEN_FAILURE'));let observedFrozen;
  try{cleanupExecutedEvidenceRoots({primaryRoot:frozenRoots.primary,secondaryRoot:frozenRoots.secondary,executionFailed:true,executionError:frozen,remove:(target,options)=>{if(target===frozenRoots.secondary)throw new Error('CONTROLLED_FROZEN_CLEANUP_FAILURE');fs.rmSync(target,options);}});}catch(error){observedFrozen=error;}
  assert.equal(observedFrozen,frozen,'COPY_ROOT_CONTROL_ORACLE: diagnostic attachment replaced a frozen original failure.');fs.rmSync(frozenRoots.secondary,{recursive:true,force:true});
  const falsyRoots=makeRoots('falsy');let falsyCaught=false,falsyObserved;
  try{cleanupExecutedEvidenceRoots({primaryRoot:falsyRoots.primary,secondaryRoot:falsyRoots.secondary,executionFailed:true,executionError:0});}catch(error){falsyCaught=true;falsyObserved=error;}
  assert.equal(falsyCaught,true,'COPY_ROOT_CONTROL_ORACLE: a falsy thrown value was swallowed.');assert.equal(falsyObserved,0,'COPY_ROOT_CONTROL_ORACLE: a falsy thrown value changed identity.');
  fs.rmSync(root,{recursive:true,force:true});
  return {result:'PASS',sameDeviceRejectedBeforeCreate:true,symlinkAliasRejection,lowCapacityRefusal,successCleanupOrder:['secondary','primary'],failureCleanupOrder:['secondary','primary'],originalFailurePreserved:true,preexistingCleanupErrorsMerged:true,cancellationIdentityPreserved:true,frozenFailurePreserved:true,falsyFailurePreserved:true,configuredSplit:!!splitLayout,placement:null};
}

async function verifyPreloadFailureVisibility(directory,{preloadFile=path.resolve('verification-evidence-preload.mjs')}={}){
  const root=path.join(directory,'preload-visibility');fs.mkdirSync(root);
  const registered='verify-semantic-review-acceptance.mjs',unregistered='preload-unregistered-control.mjs';
  assert(verificationCatalog[registered],'PRELOAD_VISIBILITY_SETUP_ORACLE: the normal catalogue must own the registered control.');
  assert(!verificationCatalog[unregistered],'PRELOAD_VISIBILITY_SETUP_ORACLE: the raw child must remain unregistered.');
  const bytes=fs.readFileSync(preloadFile,'utf8'),cases=[];
  const run=async(name,body,{registeredChild=false,observer=preloadFile,nested=false}={})=>{
    const folder=path.join(root,name);fs.mkdirSync(folder);
    const file=path.join(folder,registeredChild?registered:unregistered);fs.writeFileSync(file,body);
    const result=await runVerifier(process.execPath,['--import',observer,file],{cwd:process.cwd(),evidenceDirectory:path.join(root,'runner-records'),timeout:5000,maxBuffer:4*1024*1024,env:{...process.env,GITHUB_ACTIONS:'true',NODE_OPTIONS:'',CLOSED_LOOP_VERIFICATION_RECEIPTS:'',CLOSED_LOOP_FAILURE_ANNOTATION_OWNER:nested?'1':''}});
    assert.equal(result.signal,null,'PRELOAD_VISIBILITY_CHILD_SIGNAL_ORACLE');assert.equal(result.error,null,'PRELOAD_VISIBILITY_CHILD_ERROR_ORACLE');assert.equal(result.reason,null,'PRELOAD_VISIBILITY_CHILD_REASON_ORACLE');
    return result;
  };
  const raw=await run('raw-child',"process.stdout.write('EXACT_STDOUT\\n');process.stderr.write('controlled child failure\\n');process.exitCode=3;");
  assert.equal(raw.status,3,'PRELOAD_RAW_CHILD_EXIT_ORACLE');assert.equal(raw.stdout,'EXACT_STDOUT\n','PRELOAD_RAW_CHILD_STDOUT_ORACLE');assert.equal(raw.stderr,'controlled child failure\n','PRELOAD_RAW_CHILD_STDERR_ORACLE');
  cases.push({caseId:'unregistered-exact-stderr',result:'PASS'});
  const oracle='CONTROLLED_ASSERTION_ORACLE',fault=await run('raw-oracle',"process.stderr.write('CONTROLLED_ASSERTION_ORACLE: controlled failed case\\n');process.exitCode=1;");
  assert.equal(fault.stderr,oracle+': controlled failed case\n','PRELOAD_RAW_ORACLE_STDERR_ORACLE');assert.equal(detectedFault(fault,oracle),true,'PRELOAD_RAW_FAULT_DETECTION_ORACLE');cases.push({caseId:'unregistered-terminal-oracle',result:'PASS'});
  const normal=await run('normal-failure',"process.stdout.write('EXACT_STDOUT\\n');process.stderr.write('CONTROLLED_REQUIRED_FAILURE\\n');process.exitCode=3;",{registeredChild:true});
  assert.equal(normal.status,3,'PRELOAD_NORMAL_EXIT_ORACLE');assert.equal(normal.stdout,'EXACT_STDOUT\n','PRELOAD_NORMAL_STDOUT_ORACLE');assert(normal.stderr.startsWith('CONTROLLED_REQUIRED_FAILURE\n'),'PRELOAD_NORMAL_RAW_PREFIX_ORACLE');assert.equal((normal.stderr.match(/::error title=/g)||[]).length,1,'PRELOAD_NORMAL_ANNOTATION_ORACLE');assert(normal.stderr.includes('exit 3::'),'PRELOAD_NORMAL_ANNOTATION_EXIT_ORACLE');cases.push({caseId:'registered-normal-annotation-output-exit',result:'PASS'});
  // A registered descendant is still an intentional child, not another owner
  // of the top-level hosted annotation. Keep its exact stderr oracle intact.
  const nested=await run('nested-registered-oracle',"process.stdout.write('EXACT_NESTED_STDOUT\\n');process.stderr.write('CONTROLLED_ASSERTION_ORACLE: nested failed case\\n');process.exitCode=1;",{registeredChild:true,nested:true});
  assert.equal(nested.status,1,'PRELOAD_NESTED_EXIT_ORACLE');assert.equal(nested.stdout,'EXACT_NESTED_STDOUT\n','PRELOAD_NESTED_STDOUT_ORACLE');assert.equal(nested.stderr,'CONTROLLED_ASSERTION_ORACLE: nested failed case\n','PRELOAD_NESTED_EXACT_STDERR_ORACLE');assert.equal(detectedFault(nested,oracle),true,'PRELOAD_NESTED_FAULT_DETECTION_ORACLE');cases.push({caseId:'registered-nested-exact-stderr',result:'PASS'});
  // Instrument only a disposable full-module copy to observe private retained
  // bytes; the actual visibility and write wrappers remain byte-for-byte intact.
  const anchor="\nif(failureVisibility){\n  process.on('exit',code=>{";
  assert.equal(bytes.split(anchor).length,2,'PRELOAD_TAIL_HOOK_SETUP_ORACLE: one final annotation listener is required.');
  const statsFile=path.join(root,'tail-stats.json');
  const hook="\nprocess.on('exit',()=>fs.writeFileSync("+JSON.stringify(statsFile)+",JSON.stringify({bytes:failureTailBytes,storedBytes:failureTail.reduce((sum,row)=>sum+row.length,0),largestEntry:Math.max(0,...failureTail.map(row=>row.length)),largestBacking:Math.max(0,...failureTail.map(row=>row.buffer.byteLength)),smallTail:failureTailBytes<=128?Buffer.concat(failureTail).toString('utf8'):null})));\n";
  const isolated=path.join(root,'instrumented-preload.mjs'),rebase=specifier=>JSON.stringify(pathToFileURL(path.resolve(path.dirname(preloadFile),specifier)).href);
  const isolatedBytes=bytes.replace(/(from |import\()'(\.\/[^']+)'/g,(_match,prefix,specifier)=>prefix+rebase(specifier)).replace(anchor,hook+anchor);fs.writeFileSync(isolated,isolatedBytes);
  const mutation=await run('buffer-reuse',"const value=Buffer.from('ORIGINAL_WRITTEN_BUFFER');process.stderr.write(value,()=>{value.fill(90);process.exitCode=9;});",{registeredChild:true,observer:isolated});
  assert.equal(mutation.status,9);assert(mutation.stderr.startsWith('ORIGINAL_WRITTEN_BUFFER'),'PRELOAD_BUFFER_RAW_OUTPUT_ORACLE');assert.equal(JSON.parse(fs.readFileSync(statsFile,'utf8')).smallTail,'ORIGINAL_WRITTEN_BUFFER','PRELOAD_BUFFER_OWNERSHIP_ORACLE');cases.push({caseId:'registered-buffer-reuse-owned-snapshot',result:'PASS'});
  for(const [name,body] of [['huge-buffer',"process.stderr.write(Buffer.alloc(1024*1024,88));"],['huge-string',"process.stderr.write('X'.repeat(1024*1024));"]]){
    const huge=await run(name,body+'process.exitCode=7;',{registeredChild:true,observer:isolated});assert.equal(huge.status,7);
    const stats=JSON.parse(fs.readFileSync(statsFile,'utf8'));assert.equal(stats.bytes,8192,'PRELOAD_TAIL_BOUND_ORACLE');assert.equal(stats.storedBytes,8192,'PRELOAD_TAIL_STORAGE_ORACLE');assert(stats.largestEntry<=8192&&stats.largestBacking<=8192,'PRELOAD_TAIL_BACKING_BOUND_ORACLE');cases.push({caseId:'registered-'+name+'-tail-bound',result:'PASS',retainedBytes:stats.bytes,largestBacking:stats.largestBacking});
  }
  // Receipt eligibility is a separate boundary from stderr visibility. Exercise an
  // actual registered default owner, then prove both diagnostic suffix families
  // are ineligible without weakening receipt validation.
  const faultGuard='&&!injectedFault';
  assert.equal(bytes.split(faultGuard).length,2,'PRELOAD_RECEIPT_GUARD_POPULATION_ORACLE');
  const receiptPreload=path.join(root,'receipt-preload.mjs'),formerReceiptPreload=path.join(root,'receipt-preload-former.mjs');
  fs.writeFileSync(receiptPreload,bytes.replace(/(from |import\()'(\.\/[^']+)'/g,(_match,prefix,specifier)=>prefix+rebase(specifier)));
  fs.writeFileSync(formerReceiptPreload,bytes.replace(faultGuard,'').replace(/(from |import\()'(\.\/[^']+)'/g,(_match,prefix,specifier)=>prefix+rebase(specifier)));
  const receiptOwner='verify-hash.mjs',receiptOwnerPath=path.resolve(receiptOwner);
  assert(verificationCatalog[receiptOwner],'PRELOAD_RECEIPT_REGISTERED_OWNER_ORACLE');
  const receiptEnvironment=()=>Object.fromEntries(Object.entries(process.env).filter(([name])=>!/(?:_FAULT|_SOURCE)$/.test(name)));
  const runReceiptOwner=async(name,observer,receiptDirectory,extra={})=>{
    const result=await runVerifier(process.execPath,['--import',observer,receiptOwnerPath],{cwd:process.cwd(),evidenceDirectory:path.join(root,'receipt-runner-records'),timeout:15000,maxBuffer:4*1024*1024,env:{...receiptEnvironment(),GITHUB_ACTIONS:'false',NODE_OPTIONS:'',CLOSED_LOOP_VERIFICATION_RECEIPTS:receiptDirectory,CLOSED_LOOP_VERIFICATION_SOURCE_ROOT:process.cwd(),...extra}});
    assert.equal(result.signal,null,name+': signal');assert.equal(result.error,null,name+': error');assert.equal(result.reason,null,name+': reason');assert.equal(result.status,0,name+': exit '+result.stderr);return result;
  };
  const formerDirectory=path.join(root,'receipt-former-source');
  await runReceiptOwner('former-source',formerReceiptPreload,formerDirectory,{PRELOAD_RECEIPT_SOURCE:'diagnostic'});
  const formerReceipt=readExecutionReceipt(formerDirectory,receiptOwner,evidenceFingerprint(process.cwd()));
  assert.equal(formerReceipt?.complete,true,'PRELOAD_RECEIPT_FORMER_SOURCE_CREATE_ORACLE');
  const validDirectory=path.join(root,'receipt-valid');
  await runReceiptOwner('default-positive',receiptPreload,validDirectory);
  const validFile=path.join(validDirectory,receiptOwner+'.json'),validBytes=fs.readFileSync(validFile),fingerprint=evidenceFingerprint(process.cwd());
  const validReceipt=readExecutionReceipt(validDirectory,receiptOwner,fingerprint);
  assert.equal(validReceipt?.complete,true,'PRELOAD_RECEIPT_POSITIVE_ORACLE');
  assert.deepEqual(validReceipt.command,[process.execPath,receiptOwnerPath],'PRELOAD_RECEIPT_DEFAULT_COMMAND_ORACLE');
  await runReceiptOwner('source-diagnostic',receiptPreload,validDirectory,{PRELOAD_RECEIPT_SOURCE:'diagnostic'});
  assert.deepEqual(fs.readFileSync(validFile),validBytes,'PRELOAD_RECEIPT_SOURCE_OVERWRITE_ORACLE');
  assert.equal(readExecutionReceipt(validDirectory,receiptOwner,fingerprint).receiptSha256,validReceipt.receiptSha256,'PRELOAD_RECEIPT_SOURCE_VALIDITY_ORACLE');
  const faultDirectory=path.join(root,'receipt-fault');
  await runReceiptOwner('fault-diagnostic',receiptPreload,faultDirectory,{PRELOAD_RECEIPT_FAULT:'1'});
  assert.equal(fs.existsSync(path.join(faultDirectory,receiptOwner+'.json')),false,'PRELOAD_RECEIPT_FAULT_CREATE_ORACLE');
  const corruptDirectory=path.join(root,'receipt-corrupt');fs.mkdirSync(corruptDirectory);
  const corruptReceipt=JSON.parse(validBytes);corruptReceipt.stdoutSha256=(corruptReceipt.stdoutSha256[0]==='0'?'1':'0')+corruptReceipt.stdoutSha256.slice(1);
  fs.writeFileSync(path.join(corruptDirectory,receiptOwner+'.json'),JSON.stringify(corruptReceipt,null,2)+'\n');
  assert.throws(()=>readExecutionReceipt(corruptDirectory,receiptOwner,fingerprint),/receipt content digest mismatch/,'PRELOAD_RECEIPT_CORRUPT_REJECTION_ORACLE');
  const incompleteDirectory=path.join(root,'receipt-incomplete');fs.mkdirSync(incompleteDirectory);
  const incompleteReceipt={...JSON.parse(validBytes),complete:false,exitCode:1,outcome:'FAIL',reason:'controlled focused negative'};delete incompleteReceipt.receiptSha256;incompleteReceipt.receiptSha256=sha(incompleteReceipt);
  fs.writeFileSync(path.join(incompleteDirectory,receiptOwner+'.json'),JSON.stringify(incompleteReceipt,null,2)+'\n');
  assert.throws(()=>readExecutionReceipt(incompleteDirectory,receiptOwner,fingerprint),/failed\/incomplete receipt/,'PRELOAD_RECEIPT_INCOMPLETE_REJECTION_ORACLE');
  const receiptEligibility={schema:'closed-loop-preload-receipt-eligibility-control/1',suite:receiptOwner,actualRegisteredProducer:true,positiveDefaultReceiptValid:true,defaultInvocation:true,sourceOverrideFormerlyCreatedEligibleReceipt:true,sourceOverrideOwnerPassed:true,sourceOverrideReceiptUnchanged:true,faultOverrideOwnerPassed:true,faultOverrideCreatedReceipt:false,corruptReceiptRejected:true,incompleteReceiptRejected:true,diagnosticReceiptEligible:false,candidatePreloadSourceSha256:sha(bytes)};
  return {result:'PASS',cases,receiptEligibility,sourceSha256:sha(bytes),normalCatalogue:true,actualPreloadModule:true,receiptsDisabled:true,tailHookScope:'Unique exit snapshot in disposable complete-module copy; only relative import URLs rebased. Visibility children disable receipts; the separate actual registered default-owner control validates receipt eligibility.'};
}

async function verifyColdUploadBootstrap(workflow,directory,bootstrapNode=process.env.CLOSED_LOOP_ACTION_NODE||process.execPath){
  const actions=assertWorkflowPreloadBoundaries(workflow);
  assert.equal(actions.length,18,'COLD_UPLOAD_ORACLE: the maintained upload action population changed.');
  assert(actions.every(row=>row.nodeOptions===''),'COLD_UPLOAD_ORACLE: upload environments must share the empty Node options.');
  const workspace=path.join(directory,'cold-upload');fs.mkdirSync(workspace);
  const inherited=actions.find(row=>row.job==='test')?.inheritedNodeOptions;
  assert(inherited,'COLD_UPLOAD_ORACLE: failed prerequisite job must retain its repository producer preload.');
  const missingPreload=path.join(workspace,'verification-evidence-preload.mjs'),marker=path.join(workspace,'cleanup-body-reached.json');
  const action=`const fs=require('node:fs');if(fs.existsSync('verification-evidence-preload.mjs'))throw new Error('COLD_WORKSPACE_ORACLE');fs.writeFileSync('cleanup-body-reached.json','true');console.log(JSON.stringify({cleanupBodyExecuted:true,repositoryInitiallyAbsent:true,runtime:process.version}));`;
  // One actual Node failure/control pair covers the identical empty environment
  // of all upload actions; the table retains every workflow job/step identity.
  const before=await runVerifier(bootstrapNode,['-e',action],{cwd:workspace,env:{...process.env,NODE_OPTIONS:inherited.replaceAll('${{ github.workspace }}',workspace)}});
  assert.equal(before.status,1,'COLD_UPLOAD_ORACLE: former inherited preload must fail before the cleanup action body.');
  assert.match(before.stderr,/ERR_MODULE_NOT_FOUND/);assert(before.stderr.includes(missingPreload));
  assert.equal(fs.existsSync(marker),false,'COLD_UPLOAD_ORACLE: defective preload unexpectedly reached cleanup.');
  const after=await runVerifier(bootstrapNode,['-e',action],{cwd:workspace,env:{...process.env,NODE_OPTIONS:actions[0].nodeOptions}});
  assert.equal(after.status,0,'COLD_UPLOAD_ORACLE: scoped upload environment must bootstrap without repository files: '+after.stderr);
  const report=JSON.parse(after.stdout);assert.equal(report.cleanupBodyExecuted,true);assert.equal(report.repositoryInitiallyAbsent,true);
  assert.equal(fs.readFileSync(marker,'utf8'),'true');assert.equal(fs.existsSync(missingPreload),false);
  return {result:'PASS',actions,actionRuntime:report.runtime,formerInheritedExit:before.status,formerCleanupBodyExecuted:false,cleanupExit:after.status,cleanupBodyExecuted:true,repositoryInitiallyAbsent:true,sharedEnvironmentGroups:1,nodeInvocations:2,actualArtifactUpload:false};
}

const ownershipSuites=['verify-ingestion.mjs','verify-response-authority-integrity.mjs','verify-returned-slot-authority.mjs'];
async function ownershipReceiptSource(owner,{currentReceiptDirectory=process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS,readReceipt=readExecutionReceipt,run=executeEvidenceProducer,fallbackDirectory,evidenceDirectory}={}){
  if(currentReceiptDirectory){
    const receipt=readReceipt(currentReceiptDirectory,owner);
    if(!receipt)throw new Error('EXECUTED_EVIDENCE_ORACLE: current ownership receipt is missing for '+owner+'; run '+owner+' before this consumer.');
    return receipt;
  }
  return run(owner,{directory:fallbackDirectory,evidenceDirectory,timeout:owner==='verify-ingestion.mjs'?AGGREGATE_TIMEOUT_MS:undefined});
}
async function verifyOwnershipReceiptRouting(load=ownershipReceiptSource){
  const cases=[];
  for(const owner of ownershipSuites){
    const receipt={suite:owner,reports:[{syntheticOwnershipRouting:true,exactReport:{preserved:[1,2,3]}}]},currentReceiptDirectory='SYNTHETIC_CURRENT_RECEIPTS';
    let calls=0,reads=0;
    const options={currentReceiptDirectory,readReceipt:(directory,suite)=>{reads++;assert.equal(directory,currentReceiptDirectory);assert.equal(suite,owner);return receipt;},run:async()=>{calls++;throw new Error('OWNERSHIP_RECEIPT_REUSE_ORACLE: current owner started again.');}};
    assert.equal(await load(owner,options),receipt,'OWNERSHIP_RECEIPT_COMPLETE_REPORT_ORACLE');assert.equal(calls,0);assert.equal(reads,1);
    await assert.rejects(()=>load(owner,{...options,readReceipt:()=>null}),/current ownership receipt is missing/,'OWNERSHIP_RECEIPT_MISSING_ORACLE');assert.equal(calls,0);
    for(const reason of ['stale source/specification/catalog/runtime receipt','receipt content digest mismatch','failed/incomplete receipt']){
      const failure=new Error('EXECUTED_EVIDENCE_ORACLE: '+reason);
      await assert.rejects(()=>load(owner,{...options,readReceipt:()=>{throw failure;}}),error=>error===failure,'OWNERSHIP_RECEIPT_INVALID_ORACLE');assert.equal(calls,0);
    }
    const fallback=await load(owner,{currentReceiptDirectory:null,fallbackDirectory:'SYNTHETIC_PRIVATE_RECEIPTS',evidenceDirectory:'SYNTHETIC_RUNNER',run:async(suite,options)=>{
      calls++;assert.equal(suite,owner);assert.deepEqual(options,{directory:'SYNTHETIC_PRIVATE_RECEIPTS',evidenceDirectory:'SYNTHETIC_RUNNER',timeout:owner==='verify-ingestion.mjs'?AGGREGATE_TIMEOUT_MS:undefined});return receipt;
    }});
    assert.equal(fallback,receipt);assert.equal(calls,1);
    cases.push({owner,currentReceiptExtraInvocations:0,standaloneAbsentInvocations:1,completeReportPreserved:true,missingCurrentRejected:true,invalidCurrentRejectedWithoutFallback:true});
  }
  return {syntheticRoutingControls:true,receiptAuthenticationClaimed:false,cases};
}

function verifyDeclaredInputPathPolicy(fixture,fingerprint=evidenceFingerprint){
  const required={'verify-cross-run-comparison.mjs':'verification/stage19-precomparison-prerequisite-20261010.json.gz','verify-acceptance-active-work.mjs':'TEST_PROJECT.json','verify-final-acceptance.mjs':'verification-assertion-bindings.json'},baseline=fingerprint(fixture);
  for(const [owner,file]of Object.entries(required)){
    assert(verificationCatalog[owner]?.sourceInputs?.includes(file),'DECLARED_INPUT_PATH_ORACLE: the consuming owner must declare '+file);
    assert(Object.hasOwn(baseline.inputSha256,file),'DECLARED_INPUT_PATH_ORACLE: the exact declared fixture path must be admitted: '+file);
  }
  // Exact authoritative JSON is already an input regardless of tracking;
  // declaring the consuming owner must preserve byte identity and confinement.
  const bindingsFile='verification-assertion-bindings.json',bindingsTarget=path.join(fixture,bindingsFile),bindingsBytes=fs.readFileSync(bindingsTarget),bindingsDigest=bytes=>createHash('sha256').update(bytes).digest('hex');
  assert.equal(baseline.inputSha256[bindingsFile],bindingsDigest(bindingsBytes),'DECLARED_INPUT_PATH_ORACLE: authoritative bindings bytes must be fingerprinted exactly');
  try{
    fs.appendFileSync(bindingsTarget,'\n');const changed=fingerprint(fixture);
    assert.equal(changed.inputSha256[bindingsFile],bindingsDigest(fs.readFileSync(bindingsTarget)),'DECLARED_INPUT_PATH_ORACLE: changed authoritative bindings digest was not exact');
    assert.notEqual(changed.sourceInputsSha256,baseline.sourceInputsSha256,'DECLARED_INPUT_PATH_ORACLE: changed authoritative JSON retained source identity');
  }finally{fs.writeFileSync(bindingsTarget,bindingsBytes);}
  const bindingsOutside=fixture+'-bindings-path-escape';fs.mkdirSync(bindingsOutside);
  try{
    const escaped=path.join(bindingsOutside,bindingsFile);fs.writeFileSync(escaped,bindingsBytes);fs.unlinkSync(bindingsTarget);fs.symlinkSync(escaped,bindingsTarget);
    assert.throws(()=>fingerprint(fixture),/declared governance or verifier input is outside the first-party source root/,'DECLARED_INPUT_PATH_ORACLE: authoritative JSON symlink escaped the source root');
  }finally{fs.rmSync(bindingsTarget,{force:true});fs.writeFileSync(bindingsTarget,bindingsBytes);fs.rmSync(bindingsOutside,{recursive:true,force:true});}
  try{fs.unlinkSync(bindingsTarget);assert.throws(()=>fingerprint(fixture),/ENOENT/,'DECLARED_INPUT_PATH_ORACLE: missing declared authoritative JSON disappeared');}
  finally{fs.writeFileSync(bindingsTarget,bindingsBytes);}
  const bindingsOwner=verificationCatalog['verify-final-acceptance.mjs'],bindingInputs=bindingsOwner.sourceInputs;
  try{for(const alias of ['verification/../verification-assertion-bindings.json','../verification-assertion-bindings.json',path.resolve(fixture,bindingsFile),['verification','..','verification-assertion-bindings.json'].join(String.fromCharCode(92))]){
    bindingsOwner.sourceInputs=[...bindingInputs,alias];assert.throws(()=>fingerprint(fixture),/declared governance or verifier input must be an exact first-party verification path/,'DECLARED_INPUT_PATH_ORACLE: authoritative JSON alias escaped exact path policy: '+alias);
  }}finally{bindingsOwner.sourceInputs=bindingInputs;}
  const seed=path.join(fixture,'TEST_PROJECT.json'),seedBytes=fs.readFileSync(seed),catalogues=[...Object.values(verificationCatalog),...Object.values(browserVerificationCatalog)],saved=catalogues.map(owner=>[owner,owner.sourceInputs]);
  try{
    for(const [owner,inputs]of saved)if(inputs)owner.sourceInputs=inputs.filter(file=>file!=='TEST_PROJECT.json');
    const implicit=fingerprint(fixture);
    assert(!Object.hasOwn(implicit.inputSha256,'TEST_PROJECT.json'),'DECLARED_INPUT_PATH_ORACLE: the undeclared generated seed must remain excluded');
    fs.appendFileSync(seed,'\n');
    assert.equal(fingerprint(fixture).sourceInputsSha256,implicit.sourceInputsSha256,'DECLARED_INPUT_PATH_ORACLE: undeclared generated seed bytes must not change source identity');
  }finally{fs.writeFileSync(seed,seedBytes);for(const [owner,inputs]of saved)if(inputs===undefined)delete owner.sourceInputs;else owner.sourceInputs=inputs;}
  const owner=verificationCatalog['verify-acceptance-active-work.mjs'],inputs=owner.sourceInputs;
  try{
    for(const file of ['verification/../TEST_PROJECT.json','UNKNOWN_PROJECT.json','TEST_PROJECT.json.gz','verification/fixture.zip','verification-assertion-bindings.json.gz']){
      const target=path.join(fixture,file),temporary=file!=='verification/../TEST_PROJECT.json';
      if(temporary){assert(!fs.existsSync(target),'DECLARED_INPUT_PATH_ORACLE: private negative path collides with a fixture');fs.writeFileSync(target,'{}\n');}
      try{owner.sourceInputs=[...inputs,file];assert.throws(()=>fingerprint(fixture),/declared governance or verifier input must be an exact first-party verification path/,'DECLARED_INPUT_PATH_ORACLE: invalid declared path admitted: '+file);}
      finally{owner.sourceInputs=inputs;if(temporary)fs.unlinkSync(target);}
    }
  }finally{owner.sourceInputs=inputs;}
  // A sibling shares the fixture's text prefix but remains outside its root.
  const outside=fixture+'-path-escape';fs.mkdirSync(outside);
  try{
    const escaped=path.join(outside,'TEST_PROJECT.json');fs.writeFileSync(escaped,seedBytes);fs.unlinkSync(seed);fs.symlinkSync(escaped,seed);
    assert.throws(()=>fingerprint(fixture),/declared governance or verifier input is outside the first-party source root/,'DECLARED_INPUT_PATH_ORACLE: symlink escaped the source root');
  }finally{fs.rmSync(seed,{force:true});fs.writeFileSync(seed,seedBytes);fs.rmSync(outside,{recursive:true,force:true});}
  assert.equal(fingerprint(fixture).sourceInputsSha256,baseline.sourceInputsSha256,'DECLARED_INPUT_PATH_ORACLE: path controls must restore the original source identity');
}

// This exercises the real preload producer, not a YAML presence or mocked
// successful suite. The unchanged Stage 03 verifier first runs all its actual
// prompt/parser/validator/commit/transition assertions in every control.
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-executed-evidence-'));
const configuredCopyBase=Object.hasOwn(process.env,'CLOSED_LOOP_EXECUTED_EVIDENCE_COPY_BASE')?process.env.CLOSED_LOOP_EXECUTED_EVIDENCE_COPY_BASE:undefined;
let splitLayout=null,persistentChildEvidence=null,executionFailed=false,executionError;
const inheritedChildEvidenceDirectory=process.env.VERIFIER_CHILD_EVIDENCE_DIRECTORY;
try{
if(configuredCopyBase!==undefined){
  persistentChildEvidence=validatePersistentChildEvidenceDirectory(inheritedChildEvidenceDirectory,{primaryRoot:directory,sourceRoot:process.cwd()});
  splitLayout=createExecutedEvidenceCopyRoot(configuredCopyBase,{primaryRoot:directory,sourceRoot:process.cwd()});
}
const splitRootControl=verifyExecutedEvidenceCopyRootControls({primaryRoot:directory,splitLayout,configuredCopyBase});
if(splitLayout)splitRootControl.persistentChildEvidence=await verifyPersistentChildEvidenceRetention({primaryRoot:directory,persistent:persistentChildEvidence});
const suite='verify-stage03-agent-protocol.mjs',ownerPath=path.resolve(suite),ownerBytes=fs.readFileSync(ownerPath,'utf8');
const expectedOwnerImports=['./test-fixtures.mjs','./verifier-runtime.mjs'];
const expectedOwnerHelperInputs=['test-fixtures.mjs','test-handoff-authorization.mjs','test-project-store-runtime.mjs','test-zip.mjs'];
const relativeOwnerImports=bytes=>[...bytes.matchAll(/from '(\.\/[^']+)'/g)].map(match=>match[1]).sort();
function assertStage03ChildImportClosure(bytes=ownerBytes,inputs=verificationCatalog[suite]?.sourceInputs||[]){
  assert.deepEqual(relativeOwnerImports(bytes),expectedOwnerImports,'STAGE03_CHILD_IMPORT_CLOSURE_ORACLE: Stage 03 owner relative imports changed.');
  assert.deepEqual([...inputs].sort(),expectedOwnerHelperInputs,'STAGE03_CHILD_IMPORT_CLOSURE_ORACLE: Stage 03 declared helper closure changed.');
}
const rebaseOwnerImports=bytes=>bytes.replace(/from '(\.\/[^']+)'/g,(_match,specifier)=>'from '+JSON.stringify(pathToFileURL(path.resolve(path.dirname(ownerPath),specifier)).href));
function assertRebasedStage03Child(bytes){assert.deepEqual(relativeOwnerImports(bytes),[],'STAGE03_CHILD_IMPORT_CLOSURE_ORACLE: an isolated Stage 03 child retained a relative import.');}
assertStage03ChildImportClosure();
const source=rebaseOwnerImports(ownerBytes);assertRebasedStage03Child(source);
assert.throws(()=>assertStage03ChildImportClosure(ownerBytes.replace(/^import .* from '\.\/test-fixtures\.mjs';\n/m,''),verificationCatalog[suite].sourceInputs),/Stage 03 owner relative imports changed/,'STAGE03_CHILD_IMPORT_CLOSURE_ORACLE: a missing direct fixture import escaped detection.');
assert.throws(()=>assertStage03ChildImportClosure(ownerBytes,verificationCatalog[suite].sourceInputs.filter(file=>file!=='test-project-store-runtime.mjs')),/Stage 03 declared helper closure changed/,'STAGE03_CHILD_IMPORT_CLOSURE_ORACLE: an incomplete transitive helper declaration escaped detection.');
assert.throws(()=>assertRebasedStage03Child(ownerBytes),/retained a relative import/,'STAGE03_CHILD_IMPORT_CLOSURE_ORACLE: an unrebased isolated child escaped detection.');
const stage03ChildConstructionControl={result:'PASS',owner:suite,directRelativeImports:expectedOwnerImports,declaredHelperInputs:expectedOwnerHelperInputs,allIsolatedImportsRebased:true,counterexamplesDetected:['missing-direct-fixture-import','missing-transitive-helper-input','unrebased-isolated-child']};
const preload=path.resolve('verification-evidence-preload.mjs');
const producerControls=[];
const deferredCatalogConsumerControl=verifyDueEvidenceConsumers();
const governanceDeclaration='specification/requirement-evidence-bindings.json';
const currentGovernance=JSON.parse(fs.readFileSync(governanceDeclaration,'utf8'));
// Preserve the legacy mutable-Markdown receipt regression on its exact archived
// governance input. Current insertion custody is tested separately below.
const legacyGovernanceBytes=fs.readFileSync('verification/normative-context-legacy-governance-7df5f46e.json');
assert.equal(legacyGovernanceBytes.length,112646,'GOVERNANCE_LEGACY_FIXTURE_SIZE_ORACLE');
assert.equal(sha(legacyGovernanceBytes),'9c4631c86ccd2d8234f23469ffc7e11374bcda51eb4bb1f27c1f4a97ade7b72e','GOVERNANCE_LEGACY_FIXTURE_DIGEST_ORACLE');
const governance=JSON.parse(legacyGovernanceBytes);
assert.equal(governance.atomicExtraction,undefined,'GOVERNANCE_LEGACY_FIXTURE_ORACLE');
assert(governance.approvedAmendments.some(row=>row.approvedProposalPath?.endsWith('.md')&&row.sourceReviewPath),'GOVERNANCE_LEGACY_MARKDOWN_FIXTURE_ORACLE');
const fullCoverageReviewInputs=(JSON.parse(fs.readFileSync('verification-assertion-bindings.json','utf8')).bindings||[]).flatMap(binding=>binding.fullCoverage?.review?.path?[binding.fullCoverage.review.path]:[]);
const governedApprovalInputs=[...new Set([...fullCoverageReviewInputs,...(governance.contextApplicabilityReview?[governance.contextApplicabilityReview.path]:[]),...(governance.approvedAmendments||[]).flatMap(amendment=>[amendment.sourceReviewPath,amendment.approvedProposalPath]),...(governance.independentSourceReview?[governance.independentSourceReview.sourceReviewPath,governance.independentSourceReview.reconciliationPath]:[])])].sort();
const declaredVerifierInputs=[...new Set([...Object.values(verificationCatalog),...Object.values(browserVerificationCatalog)].flatMap(suite=>suite.sourceInputs||[]))].sort();
const activeFixtureInputs=declaredVerifierInputs.filter(file=>file.startsWith('verification/')),activeHelperInputs=declaredVerifierInputs.filter(file=>!file.startsWith('verification/'));
const stage15AuthorFixtureInput='verification/stage15-author-prerequisite-20261012.json.gz',stage15AuthorFixtureOwner='verify-stage01-agent-contract-alignment.mjs';
const stage15AuthorFixtureDeclarations=Object.entries(verificationCatalog).flatMap(([owner,definition])=>(definition.sourceInputs||[]).filter(file=>file===stage15AuthorFixtureInput).map(file=>[owner,file]));
function assertStage15AuthorFixtureDeclarations(rows){assert.deepEqual(rows,[[stage15AuthorFixtureOwner,stage15AuthorFixtureInput]],'FIXTURE_INPUT_ORACLE: Stage 15 author fixture must have exactly one declaration at its actual owner.');}
assertStage15AuthorFixtureDeclarations(stage15AuthorFixtureDeclarations);
assert.throws(()=>assertStage15AuthorFixtureDeclarations([]),/Stage 15 author fixture/,'FIXTURE_INPUT_ORACLE: a missing Stage 15 author fixture declaration escaped detection.');
assert.throws(()=>assertStage15AuthorFixtureDeclarations([...stage15AuthorFixtureDeclarations,...stage15AuthorFixtureDeclarations]),/Stage 15 author fixture/,'FIXTURE_INPUT_ORACLE: a duplicate Stage 15 author fixture declaration escaped detection.');
assert.throws(()=>assertStage15AuthorFixtureDeclarations([[stage15AuthorFixtureOwner,'verification/unknown-stage15-author-fixture.json.gz']]),/Stage 15 author fixture/,'FIXTURE_INPUT_ORACLE: a wrong Stage 15 author fixture path escaped detection.');
assert.throws(()=>assertStage15AuthorFixtureDeclarations([['verify-project-activation.mjs',stage15AuthorFixtureInput]]),/Stage 15 author fixture/,'FIXTURE_INPUT_ORACLE: a Stage 15 author fixture declared by the wrong owner escaped detection.');
const scopedClarificationFixtureInput='verification/project-projection15-scoped-clarification-fixture.json.gz',scopedClarificationFixtureOwner='verify-contract-closure.mjs';
const scopedClarificationFixtureDeclarations=Object.entries(verificationCatalog).flatMap(([owner,definition])=>(definition.sourceInputs||[]).filter(file=>file===scopedClarificationFixtureInput).map(file=>[owner,file]));
function assertScopedClarificationFixtureDeclarations(rows){assert.deepEqual(rows,[[scopedClarificationFixtureOwner,scopedClarificationFixtureInput]],'FIXTURE_INPUT_ORACLE: scoped clarification fixture must have exactly one declaration at its actual owner.');}
assertScopedClarificationFixtureDeclarations(scopedClarificationFixtureDeclarations);
assert.throws(()=>assertScopedClarificationFixtureDeclarations([]),/scoped clarification fixture/,'FIXTURE_INPUT_ORACLE: a missing scoped clarification fixture declaration escaped detection.');
assert.throws(()=>assertScopedClarificationFixtureDeclarations([...scopedClarificationFixtureDeclarations,...scopedClarificationFixtureDeclarations]),/scoped clarification fixture/,'FIXTURE_INPUT_ORACLE: a duplicate scoped clarification fixture declaration escaped detection.');
assert.throws(()=>assertScopedClarificationFixtureDeclarations([[scopedClarificationFixtureOwner,'verification/unknown-scoped-clarification-fixture.json.gz']]),/scoped clarification fixture/,'FIXTURE_INPUT_ORACLE: a wrong scoped clarification fixture path escaped detection.');
assert.throws(()=>assertScopedClarificationFixtureDeclarations([['verify-project-activation.mjs',scopedClarificationFixtureInput]]),/scoped clarification fixture/,'FIXTURE_INPUT_ORACLE: a scoped clarification fixture declared by the wrong owner escaped detection.');
const historicalBindingFixtureInput='verification/historical-assertion-bindings-8b17763e-20261015.json',historicalBindingFixtureOwner='verify-final-acceptance.mjs';
const historicalBindingFixtureDeclarations=Object.entries(verificationCatalog).flatMap(([owner,definition])=>(definition.sourceInputs||[]).filter(file=>file===historicalBindingFixtureInput).map(file=>[owner,file]));
function assertHistoricalBindingFixtureDeclarations(rows){assert.deepEqual(rows,[[historicalBindingFixtureOwner,historicalBindingFixtureInput]],'FIXTURE_INPUT_ORACLE: historical binding fixture must have exactly one declaration at its actual owner.');}
assertHistoricalBindingFixtureDeclarations(historicalBindingFixtureDeclarations);
assert.throws(()=>assertHistoricalBindingFixtureDeclarations([]),/historical binding fixture/,'FIXTURE_INPUT_ORACLE: a missing historical binding fixture declaration escaped detection.');
assert.throws(()=>assertHistoricalBindingFixtureDeclarations([...historicalBindingFixtureDeclarations,...historicalBindingFixtureDeclarations]),/historical binding fixture/,'FIXTURE_INPUT_ORACLE: a duplicate historical binding fixture declaration escaped detection.');
assert.throws(()=>assertHistoricalBindingFixtureDeclarations([[historicalBindingFixtureOwner,'verification/unknown-historical-binding-fixture.json']]),/historical binding fixture/,'FIXTURE_INPUT_ORACLE: a wrong historical binding fixture path escaped detection.');
assert.throws(()=>assertHistoricalBindingFixtureDeclarations([['verify-project-activation.mjs',historicalBindingFixtureInput]]),/historical binding fixture/,'FIXTURE_INPUT_ORACLE: a historical binding fixture declared by the wrong owner escaped detection.');
const expectedActiveFixtureInputs=[
  'verification/accepted-run-stage10-prerequisite-20261007.json',
  'verification/approved-deferred-compatibility-proposal-20261005.md',
  'verification/deferred-definition-compatibility-legacy-fixture-20261005.json',
  'verification/deferred-definition-current-prerequisite-fixture-20261007.json',
  'verification/deferred-definition-current-prerequisite-fixture-20261016.json',
  'verification/handoff-producer88-runtime-owner-fixture-20261011.json.gz',
  'verification/handoff-producer88-source-fixture-20261005.json',
  'verification/handoff-producer89-source-fixture-20261005.json',
  'verification/historical-assertion-bindings-8b17763e-20261015.json',
  'verification/historical-context-assertion-inputs-7df-20261015.json.gz',
  'verification/historical-normative-fixture-inputs-20261015.json.gz',
  'verification/historical-source-relocation-crosswalk-20261014.json',
  'verification/independent-source-reconciliation-20261005.json',
  'verification/independent-source-reconciliation-20261014.json',
  'verification/independent-source-review-20261005.json',
  'verification/independent-source-review-20261014.json',
  'verification/manifest-stage01-legacy-writer-20261011.json.gz',
  'verification/normative-context-legacy-governance-7df5f46e.json',
  'verification/project-projection15-scoped-clarification-fixture.json.gz',
  'verification/project-projection5-activation-fixture.json',
  'verification/projection7-iteration4-activation-prerequisite-20261014.json.gz',
  'verification/source-applicability-legacy4-20261011.json.gz',
  'verification/stage01-retained-capture-legacy-fixture-20261005.json',
  'verification/stage15-author-prerequisite-20261012.json.gz',
  'verification/stage19-precomparison-prerequisite-20261010.json.gz',
  'verification/verifier-context-ui-prerequisite-20261018.json'
];
function assertActiveFixtureInputs(paths){assert.deepEqual(paths,expectedActiveFixtureInputs,'FIXTURE_INPUT_ORACLE: active fixture source paths differ from the independently declared current producer inputs.');}
assertActiveFixtureInputs(activeFixtureInputs);
const fixtureCatalogMutations=[];
for(const file of expectedActiveFixtureInputs){
  assert.throws(()=>assertActiveFixtureInputs(activeFixtureInputs.filter(path=>path!==file)),/FIXTURE_INPUT_ORACLE/,'Omitting '+file+' must not preserve the declared source population.');
  fixtureCatalogMutations.push({file,mutation:'missing-path',result:'DETECTED'});
}
assert.throws(()=>assertActiveFixtureInputs([...activeFixtureInputs.slice(0,-1),'verification/unknown-fixture.json']),/FIXTURE_INPUT_ORACLE/,'A changed fixture path must not preserve the declared source population.');
fixtureCatalogMutations.push({file:'verification/unknown-fixture.json',mutation:'changed-path',result:'DETECTED'});
const producerFixtureInputs=['index.html','.nojekyll','normative-manifest-storage.mjs','approved-source-continuation.mjs','review-specification-coverage.mjs','verify-stage03-agent-protocol.mjs','verifier-runtime.mjs','workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','verification-evidence-preload.mjs','verification-evidence.mjs','browser-extra-aggregate.mjs','deployment-contract-identities.mjs','browser-execution-evidence.mjs','evaluate-mobile-acceptance-submission.mjs','verify-mobile-acceptance-evidence.mjs','verification-evidence-catalog.mjs','verification-negative-populations.json','verification-assertion-bindings.json','specification/closed-loop-reliability-controlling-implementation-specification.txt',governanceDeclaration,...governedApprovalInputs,...declaredVerifierInputs];
function assertStage03ChildCopyPopulation(inputs){for(const file of expectedOwnerHelperInputs)assert(inputs.includes(file),'STAGE03_CHILD_IMPORT_CLOSURE_ORACLE: copied Stage 03 child helper missing: '+file);}
assertStage03ChildCopyPopulation(producerFixtureInputs);
assert.throws(()=>assertStage03ChildCopyPopulation(producerFixtureInputs.filter(file=>file!=='test-zip.mjs')),/copied Stage 03 child helper missing/,'STAGE03_CHILD_IMPORT_CLOSURE_ORACLE: an incomplete copied helper population escaped detection.');
stage03ChildConstructionControl.copiedHelperPopulation=true;
stage03ChildConstructionControl.counterexamplesDetected.push('missing-copied-helper-input');
  const reviewedProjectHandoffControl=await verifyReviewedProjectHandoffControls();
  const reviewedHandoffAdmission=verificationCatalog['verify-executed-evidence.mjs'].checks.find(row=>row.id==='receipts.reviewed-project-handoff');
  assert.equal(reviewedHandoffAdmission.condition(reviewedProjectHandoffControl),true,'REVIEWED_HANDOFF_CATALOG_ORACLE: actual control population missing');
  for(let index=0;index<reviewedProjectHandoffControl.cases.length;index++){const incomplete=structuredClone(reviewedProjectHandoffControl);incomplete.cases[index].pass=false;assert.equal(reviewedHandoffAdmission.condition(incomplete),false,'REVIEWED_HANDOFF_CATALOG_ORACLE: failed named control admitted');}
  for(const mutate of [value=>value.actualBrowser=true,value=>value.synthetic=false,value=>value.contract.viewEquality='STAGE_ONLY',value=>value.totals.passing--,value=>value.totals.failing++,value=>value.cases.pop(),value=>value.cases.push(value.cases[0]),value=>value.cases.reverse(),value=>value.cases[0].expectedOutcome='REJECT',value=>delete value.populations,value=>value.helperSha256='',value=>value.controlsSha256='',value=>value.hashAuthoritySha256='',value=>delete value.wrapperControls,value=>value.wrapperControls.temporaryFixtureRootCleaned=false,value=>value.wrapperControls.cases.pop(),value=>value.wrapperControls.cases.push(value.wrapperControls.cases[0]),value=>value.wrapperControls.cases[0].pass=false,value=>value.wrapperControls.cases[0].detail.originalDescriptorRestored=false,value=>value.wrapperControls.cases[1].detail.originalErrorPreserved=false,value=>value.wrapperControls.controlsSha256='0'.repeat(64),value=>value.wrapperControls.setupThrowFixtureSha256='0'.repeat(64),value=>value.wrapperControls.totals.failing++,value=>value.wrapperControls.actualBrowser=true,value=>value.wrapperControls.populations.WRAPPER_HASH_SETUP_FAILURE_RESTORATION.reverse(),value=>value.wrapperControls.cases[0].child.error={code:'ETIMEDOUT'},value=>value.wrapperControls.cases[0].child.signal='SIGKILL',value=>value.wrapperControls.cases[0].child.exitCode=1,value=>value.wrapperControls.cases[0].child.timeoutMs=6000,value=>value.wrapperControls.cases[0].child.maxBuffer=2097152]){const incomplete=structuredClone(reviewedProjectHandoffControl);mutate(incomplete);assert.equal(reviewedHandoffAdmission.condition(incomplete),false,'REVIEWED_HANDOFF_CATALOG_ORACLE: incomplete or weakened control population admitted');}
  const browserObserverLifecycleControl=await verifyBrowserObserverLifecycleControls();
  const observerLifecycleAdmission=verificationCatalog['verify-executed-evidence.mjs'].checks.find(row=>row.id==='receipts.browser-observer-lifecycle');
  assert.equal(observerLifecycleAdmission.condition(browserObserverLifecycleControl),true,'OBSERVER_LIFECYCLE_CATALOG_ORACLE: actual control population missing');
  for(const mutate of [value=>value.actualBrowser=true,value=>value.applicationExecuted=true,value=>value.socketOpened=true,value=>value.browserReceiptWritten=true,value=>value.mode='baseline',value=>value.retirementPolicy='CONDITIONAL_RETIREMENT',value=>value.sourceUnchanged=false,value=>value.observerSourceSha256='',value=>delete value.shimChecks,value=>value.shimChecks.actualFixtureFailureRestoresAllGlobals=false,value=>value.shimChecks.loggingSemantics.parsedCaptureExact=false,value=>value.shimChecks.rejectionSemantics.returnAndThrowPreserved=false,value=>value.cases.pop(),value=>value.cases.push(value.cases[0]),value=>value.cases.reverse(),value=>value.cases[0].actual='reject',value=>value.cases[2].expected='resolve',value=>value.cases[2].actual='resolve',value=>value.cases[0].conforms=false,value=>value.cases[0].parsedLogging=false,value=>value.cases[0].commandErrorMetadata=true,value=>value.cases.find(row=>row.commandErrorMetadata===true).commandErrorMetadata=false]){const incomplete=structuredClone(browserObserverLifecycleControl);mutate(incomplete);assert.equal(observerLifecycleAdmission.condition(incomplete),false,'OBSERVER_LIFECYCLE_CATALOG_ORACLE: incomplete or weakened control population admitted');}

  const browserExtraAggregateControl=await verifyBrowserExtraAggregateControls();
  const aggregateAdmission=verificationCatalog['verify-executed-evidence.mjs'].checks.find(row=>row.id==='receipts.browser-extra-four-lane-aggregate');
  assert.equal(aggregateAdmission.condition(browserExtraAggregateControl),true,'BROWSER_EXTRA_AGGREGATE_CATALOG_ORACLE: actual control population missing');
  for(const mutate of [value=>value.actualBrowser=true,value=>value.eligibleReceiptCreated=true,value=>value.cases.pop(),value=>value.cases.push(value.cases[0]),value=>value.processCases.pop(),value=>value.processCases.push(value.processCases[0]),value=>delete value.socketProofs,value=>value.socketProofs.pop(),value=>value.socketProofs.push(value.socketProofs[0]),value=>value.socketProofs[0].exchange='unexchanged',value=>value.socketProofs[0].bytes++,value=>value.socketProofs[0].evidenceDirectoryBytes=100,value=>value.socketProofs[0].socketPath='/tmp/other/SingletonSocket',value=>value.socketProofs[0].laneId='lane4',value=>value.socketProofs[0].unexpected=true,value=>value.socketProofs[1].socketPath=value.socketProofs[0].socketPath]){const incomplete=structuredClone(browserExtraAggregateControl);mutate(incomplete);assert.equal(aggregateAdmission.condition(incomplete),false,'BROWSER_EXTRA_AGGREGATE_CATALOG_ORACLE: incomplete control population admitted');}
  const preloadFailureVisibilityControl=await verifyPreloadFailureVisibility(directory);
  const retainedRootNativeEvidenceControl=verifyRetainedRootNativeEvidenceConsumers({directory:path.join(directory,'native-evidence-controls')});
  const humanCombinedNativeEvidenceControl=verifyHumanCombinedNativeEvidenceConsumers({directory:path.join(directory,'human-native-evidence-controls')});
  const humanCombinedUiEvidenceControl=verifyHumanCombinedUiEvidenceConsumers({directory:path.join(directory,'human-ui-evidence-controls')});
  const ownershipReceiptRoutingControl=await verifyOwnershipReceiptRouting();
  await assert.rejects(()=>verifyOwnershipReceiptRouting((owner,options)=>options.run(owner,{})),/OWNERSHIP_RECEIPT_REUSE_ORACLE/,'OWNERSHIP_RECEIPT_FORMER_DUPLICATION_ORACLE');
  ownershipReceiptRoutingControl.formerDuplicateOwnerRejected=true;
  const dueSchedulingControl=await verifyDueVerificationScheduling(path.join(directory,'due-scheduling'));
  const crossRunSchedulingControl=await verifyCrossRunVerificationScheduling(path.join(directory,'cross-run-scheduling'));
  // Project the maintained workflow's actual job and initial checkout step
  // environments, then exercise Node's real preload boundary on a cold
  // workspace. No repository preload may run before its checkout exists.
  const workflow=fs.readFileSync('.github/workflows/pages.yml','utf8'),coldCheckoutCases=[];
  const bootstrapNode=process.env.CLOSED_LOOP_ACTION_NODE||process.execPath;
  const coldUploadControl=await verifyColdUploadBootstrap(workflow,directory,bootstrapNode);
  const scalar=value=>value==='\'\''?'':value.startsWith('"')?JSON.parse(value):value;
  for(const job of ['test','publish-status']){
    const start=workflow.indexOf('\n  '+job+':\n');assert(start>=0,'COLD_CHECKOUT_ORACLE: instrumented workflow job missing.');
    const tail=workflow.slice(start+1),next=/\n  [a-z][\w-]*:\n/.exec(tail),block=next?tail.slice(0,next.index):tail;
    const jobEnv=block.split('\n    env:\n')[1]?.split(/\n    [a-z][\w-]*:/)[0],jobOptions=/^      NODE_OPTIONS: (.*)$/m.exec(jobEnv||'')?.[1];
    const checkout=/^      - uses: actions\/checkout@[^\n]+\n([\s\S]*?)(?=^      - |(?![\s\S]))/m.exec(block)?.[1];
    assert(jobOptions&&checkout!==undefined,'COLD_CHECKOUT_ORACLE: actual workflow environment/checkout projection unavailable.');
    const override=/^          NODE_OPTIONS: (.*)$/m.exec(checkout)?.[1];
    const workspace=path.join(directory,'cold-checkout-'+job);fs.mkdirSync(workspace);
    const inherited=scalar(jobOptions).replaceAll('${{ github.workspace }}',workspace),effective=override===undefined?inherited:scalar(override);
    const action=`const fs=require('node:fs');if(fs.existsSync('verification-evidence-preload.mjs'))throw new Error('COLD_WORKSPACE_ORACLE');fs.writeFileSync('checkout-body-reached.json','true');console.log(JSON.stringify({actionBodyExecuted:true,repositoryInitiallyAbsent:true,runtime:process.version}));`;
    const before=await runVerifier(bootstrapNode,['-e',action],{cwd:workspace,env:{...process.env,NODE_OPTIONS:inherited}});
    assert.equal(before.status,1,'COLD_CHECKOUT_ORACLE: former inherited preload did not reject the missing repository module.');
    assert.match(before.stderr,/ERR_MODULE_NOT_FOUND/);assert(before.stderr.includes(path.join(workspace,'verification-evidence-preload.mjs')));assert.equal(fs.existsSync(path.join(workspace,'checkout-body-reached.json')),false,'COLD_CHECKOUT_ORACLE: defective preload reached the action body.');
    const after=await runVerifier(bootstrapNode,['-e',action],{cwd:workspace,env:{...process.env,NODE_OPTIONS:effective}});
    assert.equal(after.status,0,'COLD_CHECKOUT_ORACLE: actual checkout environment rejected a cold workspace.');
    const actionReport=JSON.parse(after.stdout);assert.equal(actionReport.actionBodyExecuted,true);
    for(const file of producerFixtureInputs){fs.mkdirSync(path.dirname(path.join(workspace,file)),{recursive:true});fs.copyFileSync(file,path.join(workspace,file));}
    fs.writeFileSync(path.join(workspace,governanceDeclaration),legacyGovernanceBytes);
    execFileSync('git',['init','--quiet'],{cwd:workspace});execFileSync('git',['add','.'],{cwd:workspace});execFileSync('git',['-c','user.name=Cold checkout fixture','-c','user.email=fixture@localhost','commit','--quiet','-m','Checked-out real producer fixture'],{cwd:workspace});
    const receiptDirectory=path.join(workspace,'receipts');
    // No explicit --import: the workflow's unchanged post-checkout job options
    // must actually record the required verifier receipt, rather than relying
    // on the collector's separate explicit preload to conceal lost wiring.
    const producer=await runVerifier(process.execPath,[path.join(workspace,suite)],{cwd:workspace,env:{...process.env,NODE_OPTIONS:inherited,CLOSED_LOOP_VERIFICATION_SOURCE_ROOT:workspace,CLOSED_LOOP_VERIFICATION_RECEIPTS:receiptDirectory}});
    assert.equal(producer.status,0,'COLD_CHECKOUT_ORACLE: checked-out required producer did not pass: '+producer.stderr);
    const receipt=JSON.parse(fs.readFileSync(path.join(receiptDirectory,suite+'.json'),'utf8'));validateExecutionReceipt(receipt,suite,evidenceFingerprint(workspace));
    assert(receipt.observations.some(row=>row.checkId==='stage03.canonical-recordId-accepted'&&row.passed));
    coldCheckoutCases.push({job,actionRuntime:actionReport.runtime,formerInheritedExit:before.status,formerActionBodyExecuted:false,checkoutExit:after.status,checkoutBodyExecuted:true,postCheckoutProducerRuntime:receipt.fingerprint.runtime.node,postCheckoutProducerExit:producer.status,jobPreloadCreatedCurrentReceipt:true,producerFileSha256:receipt.producerFileSha256,stdoutSha256:receipt.stdoutSha256,stderrSha256:receipt.stderrSha256,receiptSha256:receipt.receiptSha256});
  }
  const syntaxDirectory=path.join(directory,'syntax-only'),syntaxReceipts=path.join(syntaxDirectory,'receipts');fs.mkdirSync(syntaxDirectory);
  const syntaxEnvironment={...process.env,CLOSED_LOOP_VERIFICATION_RECEIPTS:syntaxReceipts,NODE_OPTIONS:`${process.env.NODE_OPTIONS||''} --import ${preload}`.trim()};
  const syntaxGood=await runVerifier(process.execPath,['--check',path.resolve(suite)],{env:syntaxEnvironment});
  assert.equal(syntaxGood.status,0,'A valid syntax-only invocation was treated as an executed assertion producer.');
  assert.equal(fs.existsSync(path.join(syntaxReceipts,suite+'.json')),false,'Syntax-only inspection fabricated a suite execution receipt.');
  const invalidSyntaxFile=path.join(syntaxDirectory,suite);fs.writeFileSync(invalidSyntaxFile,'const controlledSyntaxViolation = ;\n');
  const syntaxBad=await runVerifier(process.execPath,['--check',invalidSyntaxFile],{env:syntaxEnvironment});
  assert.equal(syntaxBad.status,1,'The preload masked an actual Node syntax failure.');assert.match(syntaxBad.stderr,/SyntaxError/);
  assert.equal(fs.existsSync(path.join(syntaxReceipts,suite+'.json')),false,'A parser failure became an executed suite receipt.');
  const syntaxPopulationCases=[{caseId:'conforming-syntax-without-execution',expectedExit:0,observedExit:syntaxGood.status,executionReceiptCreated:false},{caseId:'controlled-parser-failure',expectedExit:1,observedExit:syntaxBad.status,executionReceiptCreated:false}];
  async function run(name,text){
    const caseDirectory=path.join(directory,name);fs.mkdirSync(caseDirectory);const file=name==='conforming'?path.resolve(suite):path.join(caseDirectory,suite);if(name!=='conforming')fs.writeFileSync(file,text);
    const receipts=path.join(caseDirectory,'receipts');
    const result=await runVerifier(process.execPath,['--import',preload,file],{encoding:'utf8',env:{...process.env,CLOSED_LOOP_VERIFICATION_RECEIPTS:receipts}});
    const receipt=JSON.parse(fs.readFileSync(path.join(receipts,suite+'.json'),'utf8'));
    return {result,receipt};
  }
  const good=await run('conforming',source);
  assert.equal(good.result.status,0,'Conforming actual Stage 03 producer failed before receipt controls.');
  validateExecutionReceipt(good.receipt,suite,evidenceFingerprint());
  assert(good.receipt.observations.some(row=>row.checkId==='stage03.canonical-recordId-accepted'&&row.observed===true));
  // A real current producer receipt must remain unusable after any pinned
  // custody defect. These bytes must fail before a replacement fingerprint
  // exists; the legacy mutable-proposal test below has different semantics.
  const currentCustodyRoot=path.join(directory,'current-insertion-custody');
  const currentCustodyCases=[];
  execFileSync('git',['worktree','add','--detach','--quiet',currentCustodyRoot,'HEAD']);
  try{
    const originalFingerprint=evidenceFingerprint();
    for(const [file,digest]of Object.entries(originalFingerprint.inputSha256)){
      const target=path.join(currentCustodyRoot,file);
      if(!fs.existsSync(target)||sha(fs.readFileSync(target))!==digest){fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(file,target);}
    }
    assert.deepEqual(evidenceFingerprint(currentCustodyRoot),originalFingerprint,'CURRENT_CUSTODY_MATCHING_SOURCE_ORACLE');
    validateExecutionReceipt(good.receipt,suite,evidenceFingerprint(currentCustodyRoot));
    const refs=atomicEvidenceReferences(currentGovernance.atomicExtraction);
    assert(refs.length>0,'CURRENT_CUSTODY_DEPENDENCY_POPULATION_ORACLE');
    const dependency=refs.find(ref=>ref.path!==currentGovernance.atomicExtraction.continuation.path);
    assert(dependency,'CURRENT_CUSTODY_DEPENDENCY_ORACLE');
    const target=path.join(currentCustodyRoot,dependency.path),bytes=fs.readFileSync(target);
    for(const kind of ['changed-bytes','missing-file']){
      try{
        if(kind==='changed-bytes')fs.appendFileSync(target,'\n');else fs.unlinkSync(target);
        assert.throws(()=>validateExecutionReceipt(good.receipt,suite,evidenceFingerprint(currentCustodyRoot)),error=>error.code===(kind==='missing-file'?'ENOENT':'INSERTION_PRODUCTION_HASH'),'CURRENT_CUSTODY_REFUSAL_ORACLE: '+kind);
      }finally{fs.writeFileSync(target,bytes);}
      validateExecutionReceipt(good.receipt,suite,evidenceFingerprint(currentCustodyRoot));
      currentCustodyCases.push({caseId:kind,result:'DETECTED',exactRestorationAdmitsOriginalReceipt:true});
    }
    const declarationTarget=path.join(currentCustodyRoot,governanceDeclaration),declarationBytes=fs.readFileSync(declarationTarget);
    try{
      const bad=JSON.parse(declarationBytes);bad.atomicExtraction.continuation.sha256='0'.repeat(64);fs.writeFileSync(declarationTarget,JSON.stringify(bad));
      assert.throws(()=>validateExecutionReceipt(good.receipt,suite,evidenceFingerprint(currentCustodyRoot)),error=>error.code==='INSERTION_PRODUCTION_HASH','CURRENT_CUSTODY_DESCRIPTOR_REFUSAL_ORACLE');
    }finally{fs.writeFileSync(declarationTarget,declarationBytes);}
    validateExecutionReceipt(good.receipt,suite,evidenceFingerprint(currentCustodyRoot));
    currentCustodyCases.push({caseId:'descriptor-hash',result:'DETECTED',exactRestorationAdmitsOriginalReceipt:true});
  }finally{execFileSync('git',['worktree','remove','--force',currentCustodyRoot]);}
  const currentInsertionCustodyControl={result:'PASS',actualCurrentProducerReceiptReused:true,dependencyCount:atomicEvidenceReferences(currentGovernance.atomicExtraction).length,cases:currentCustodyCases,scope:'Current insertion custody rejects invalid pinned bytes before fingerprint/receipt admission; separate archived mutable-Markdown controls do not establish current application acceptance.'};

  // Real inherited descendant output bypasses the producer's stdout.write
  // capture. Keep it in runner diagnostics without reparsing it as the parent's
  // JSON report or replacing the parent's actual stderr with an empty string.
  const fixture=path.join(splitLayout?.secondaryRoot||directory,'collector-own-output');fs.mkdirSync(fixture);
  for(const file of producerFixtureInputs){
    fs.mkdirSync(path.dirname(path.join(fixture,file)),{recursive:true});fs.copyFileSync(file,path.join(fixture,file));
  }
  fs.writeFileSync(path.join(fixture,governanceDeclaration),legacyGovernanceBytes);
  const nestedProgress='COLLECTOR_INHERITED_CHILD_PROGRESS\n';
  // These exact plain diagnostic lines contaminated the completed production
  // report stream. Keep the JSON-only contract and capture their actual bytes
  // on stderr, including when the producer imports other verifier modules.
  const producerProgress='verify-root-cause-correction: PASS\nverify-corrected-iteration: PASS\nverify-test-runtime-dag: PASS\n';
  const ownDiagnostic='COLLECTOR_OWN_DIAGNOSTIC\n'+producerProgress;
  const fixtureSource=fs.readFileSync(suite,'utf8')+`\nif(process.env.NODE_OPTIONS!=='--no-warnings')throw new Error('COLLECTOR_RUNTIME_OPTIONS_ORACLE');\nprocess.emitWarning('COLLECTOR_WARNING_MUST_BE_SUPPRESSED');\n(await import('node:child_process')).execFileSync(process.execPath,['-e',${JSON.stringify('process.stdout.write('+JSON.stringify(nestedProgress)+')')}],{stdio:'inherit'});\nprocess.stderr.write(${JSON.stringify(ownDiagnostic)});\n`;
  fs.writeFileSync(path.join(fixture,suite),fixtureSource);
  execFileSync('git',['init','--quiet'],{cwd:fixture});execFileSync('git',['add','.'],{cwd:fixture});execFileSync('git',['-c','user.name=Executed evidence fixture','-c','user.email=fixture@localhost','commit','--quiet','-m','Controlled actual producer output'],{cwd:fixture});
  const collectorDirectory=splitLayout?path.join(directory,'collector-own-output-receipts'):path.join(fixture,'receipts');
  const runnerDirectory=splitLayout?path.join(directory,'collector-own-output-runner'):path.join(fixture,'runner');
  if(splitLayout){
    assert.equal(path.dirname(fixture),splitLayout.secondaryRoot,'COPY_ROOT_PLACEMENT_ORACLE: collector source/Git fixture did not use the secondary unique root.');
    assert.equal(path.dirname(collectorDirectory),directory,'COPY_ROOT_PLACEMENT_ORACLE: collector receipts left the primary root.');
    assert.equal(path.dirname(runnerDirectory),directory,'COPY_ROOT_PLACEMENT_ORACLE: collector runner output left the primary root.');
    assert.equal(process.env.VERIFIER_CHILD_EVIDENCE_DIRECTORY,persistentChildEvidence.directory,'COPY_ROOT_PLACEMENT_ORACLE: caller-owned persistent child output setting changed.');
    assert.equal(persistentChildEvidence.evidenceDevice,splitLayout.primaryDevice,'COPY_ROOT_PLACEMENT_ORACLE: persistent child evidence left the primary filesystem.');
  }else{
    assert.equal(fixture,path.join(directory,'collector-own-output'),'COPY_ROOT_PLACEMENT_ORACLE: default collector fixture path changed.');
    assert.equal(collectorDirectory,path.join(fixture,'receipts'),'COPY_ROOT_PLACEMENT_ORACLE: default collector receipt path changed.');
    assert.equal(runnerDirectory,path.join(fixture,'runner'),'COPY_ROOT_PLACEMENT_ORACLE: default collector runner path changed.');
    assert.equal(process.env.VERIFIER_CHILD_EVIDENCE_DIRECTORY,inheritedChildEvidenceDirectory,'COPY_ROOT_PLACEMENT_ORACLE: default inherited child output setting changed.');
  }
  splitRootControl.placement={fixture:splitLayout?'SECONDARY_UNIQUE_ROOT':'PRIMARY_ROOT_CURRENT_PATH',collectorReceipts:splitLayout?'PRIMARY_ROOT':'CURRENT_FIXTURE_PATH',runnerEvidence:splitLayout?'PRIMARY_ROOT':'CURRENT_FIXTURE_PATH',inheritedChildEvidence:splitLayout?'CALLER_PERSISTENT_PRIMARY_FILESYSTEM':'INHERITED_UNCHANGED'};
  const ownReceipt=await executeEvidenceProducer(suite,{directory:collectorDirectory,cwd:fixture,evidenceDirectory:runnerDirectory,environment:{...process.env,NODE_OPTIONS:'--no-warnings'}});
  const callerEvidence=fs.readdirSync(runnerDirectory).filter(file=>file.endsWith('.json')).map(file=>JSON.parse(fs.readFileSync(path.join(runnerDirectory,file),'utf8'))).find(row=>Array.isArray(row.command)&&row.command.includes(path.join(fixture,suite)));
  assert(callerEvidence,'COLLECTOR_DIAGNOSTIC_ORACLE: real child runner evidence missing.');
  assert.equal(callerEvidence.exitCode,0);assert.equal(callerEvidence.stderr,ownDiagnostic,'COLLECTOR_RUNTIME_OPTIONS_ORACLE: ordinary NODE_OPTIONS was replaced or actual stderr was lost.');
  assert(callerEvidence.stdout.includes(nestedProgress),'COLLECTOR_DIAGNOSTIC_ORACLE: inherited descendant output did not reach the actual runner.');
  assert.notEqual(ownReceipt.stdoutSha256,sha(callerEvidence.stdout),'COLLECTOR_OWN_OUTPUT_ORACLE: merged descendant output replaced the parent-owned report.');
  assert.equal(ownReceipt.stderrSha256,sha(ownDiagnostic),'COLLECTOR_STDERR_ORACLE: actual parent diagnostics were reconstructed as empty stderr.');
  assert.throws(()=>createExecutionReceipt(suite,{...callerEvidence,command:[process.execPath,path.join(fixture,suite)],stdout:callerEvidence.stdout,stderr:''},{cwd:fixture}),/JSON/,'COLLECTOR_OWN_OUTPUT_ORACLE: former merged-output reconstruction did not reject the controlled non-JSON descendant.');
  const persistedOwnReceipt=JSON.parse(fs.readFileSync(path.join(collectorDirectory,suite+'.json'),'utf8'));
  assert.deepEqual(ownReceipt,persistedOwnReceipt,'COLLECTOR_OWN_OUTPUT_ORACLE: collector rewrote the child-owned receipt.');
  const collectorOwnOutputControl={caseId:'run-missing-owned-report-and-diagnostics',result:'PASS',actualStage03AssertionsExecuted:true,preloadInNodeOptions:false,ordinaryRuntimeOptionsPreserved:true,inheritedChildOutputInRunner:true,inheritedOutputExcludedFromOwnReport:true,producerProgressOnStderr:true,producerProgressBytes:Buffer.byteLength(producerProgress),actualStderrSha256:ownReceipt.stderrSha256,persistedChildReceiptRetained:true,formerReconstructionRejected:true};
  const governanceSourceCases=[],activeFixtureSourceCases=[],activeHelperSourceCases=[],governanceBaseline=evidenceFingerprint(fixture);
  verifyDeclaredInputPathPolicy(fixture);
  assert(governedApprovalInputs.length>=2,'GOVERNANCE_INPUT_ORACLE: active approved proposal/review pair is missing.');
  for(const file of new Set([...governedApprovalInputs,...declaredVerifierInputs])){
    const target=path.join(fixture,file),bytes=fs.readFileSync(target);
    assert.equal(governanceBaseline.inputSha256[file],sha(bytes),'GOVERNANCE_INPUT_ORACLE: actual declared governance bytes are absent from execution identity.');
    fs.appendFileSync(target,'\n');
    const changed=evidenceFingerprint(fixture);
    assert.notEqual(changed.sourceInputsSha256,governanceBaseline.sourceInputsSha256,'GOVERNANCE_INPUT_ORACLE: changed active governance bytes retained the source fingerprint.');
    assert.throws(()=>validateExecutionReceipt(persistedOwnReceipt,suite,changed),/stale source\/specification\/catalog\/runtime receipt/,'GOVERNANCE_INPUT_ORACLE: stale actual producer receipt survived changed governance bytes.');
    fs.writeFileSync(target,bytes);
    validateExecutionReceipt(persistedOwnReceipt,suite,evidenceFingerprint(fixture));
    fs.unlinkSync(target);
    assert.throws(()=>evidenceFingerprint(fixture),/ENOENT/,'GOVERNANCE_INPUT_ORACLE: missing active governance bytes silently disappeared.');
    fs.writeFileSync(target,bytes);
    // Remove only the new active files from Git's index. The declaration still
    // makes their real bytes authoritative before an eventual candidate commit.
    execFileSync('git',['rm','--cached','--quiet',file],{cwd:fixture});
    assert.equal(evidenceFingerprint(fixture).inputSha256[file],sha(bytes),'GOVERNANCE_INPUT_ORACLE: untracked declared governance bytes lost execution identity.');
    fs.appendFileSync(target,'\n');
    const untrackedChanged=evidenceFingerprint(fixture);
    assert.throws(()=>validateExecutionReceipt(persistedOwnReceipt,suite,untrackedChanged),/stale source\/specification\/catalog\/runtime receipt/,'GOVERNANCE_INPUT_ORACLE: untracked governance mutation retained stale actual evidence.');
    fs.writeFileSync(target,bytes);
    execFileSync('git',['add',file],{cwd:fixture});
    validateExecutionReceipt(persistedOwnReceipt,suite,evidenceFingerprint(fixture));
    const sourceCase={file,actualByteHashBound:true,changedBytesRejectActualReceipt:true,missingBytesFailHonestly:true,untrackedBytesBound:true,untrackedMutationRejectsActualReceipt:true,exactRestoreAdmitsActualReceipt:true};
    // One executed byte/refusal control may support multiple declared input populations.
    if(governedApprovalInputs.includes(file))governanceSourceCases.push({...sourceCase});
    if(activeFixtureInputs.includes(file))activeFixtureSourceCases.push({...sourceCase});
    if(activeHelperInputs.includes(file))activeHelperSourceCases.push({...sourceCase});
  }
  const proposalPath=governedApprovalInputs.find(file=>file.endsWith('.md'));
  assert(proposalPath,'GOVERNANCE_INPUT_ORACLE: exact approved Markdown proposal is absent.');
  const proposalTarget=path.join(fixture,proposalPath),proposalBytes=fs.readFileSync(proposalTarget);
  const formerFingerprint=fingerprint=>{const copy=structuredClone(fingerprint);delete copy.inputSha256[proposalPath];copy.sourceInputsSha256=sha(copy.inputSha256);return copy;};
  const beforeEquivalent=formerFingerprint(evidenceFingerprint(fixture));
  fs.appendFileSync(proposalTarget,'\n');
  assert.equal(formerFingerprint(evidenceFingerprint(fixture)).sourceInputsSha256,beforeEquivalent.sourceInputsSha256,'GOVERNANCE_INPUT_ORACLE: prior Markdown-omitting fingerprint did not reproduce stale identity.');
  fs.writeFileSync(proposalTarget,proposalBytes);
  assertActiveFixtureInputs(activeFixtureInputs);
  const legacyFixturePath='verification/deferred-definition-compatibility-legacy-fixture-20261005.json',legacyFixtureTarget=path.join(fixture,legacyFixturePath),legacyFixtureBytes=fs.readFileSync(legacyFixtureTarget);
  const formerUntrackedFixtureFingerprint=fingerprint=>{const copy=structuredClone(fingerprint);delete copy.inputSha256[legacyFixturePath];copy.sourceInputsSha256=sha(copy.inputSha256);return copy;};
  execFileSync('git',['rm','--cached','--quiet',legacyFixturePath],{cwd:fixture});
  const priorUntrackedFixtureEquivalent=formerUntrackedFixtureFingerprint(evidenceFingerprint(fixture));
  fs.appendFileSync(legacyFixtureTarget,'\n');
  assert.equal(formerUntrackedFixtureFingerprint(evidenceFingerprint(fixture)).sourceInputsSha256,priorUntrackedFixtureEquivalent.sourceInputsSha256,'FIXTURE_INPUT_ORACLE: former untracked-fixture omission did not reproduce stale identity.');
  fs.writeFileSync(legacyFixtureTarget,legacyFixtureBytes);execFileSync('git',['add',legacyFixturePath],{cwd:fixture});validateExecutionReceipt(persistedOwnReceipt,suite,evidenceFingerprint(fixture));
  const activeHelperFingerprintControl={result:'PASS',boundary:'Exact registered first-party assertion helper bytes in the existing receipt fingerprint and freshness validator',actualProducerReceiptReused:true,declaredSourcePaths:activeHelperInputs,sourceCases:activeHelperSourceCases};
  const activeFixtureFingerprintControl={result:'PASS',boundary:'Existing actual Stage03 producer receipt and production source fingerprint/receipt consumer; isolated Git/filesystem, no added child',actualProducerReceiptReused:true,declaredSourcePaths:activeFixtureInputs,sourceCases:activeFixtureSourceCases,fixtureCatalogMutations,formerUntrackedFixtureOmissionReproduced:true};
  const governanceFingerprintControl={result:'PASS',legacyGovernanceFixture:'7df5f46e9a7e54da09622387a978badb39916c09',currentInsertionCustodyControl,boundary:'Actual current Stage03 receipt under pinned insertion custody, plus separate exact archived legacy governance fixture receipt under mutable-Markdown controls; no application acceptance claim',declaredSourcePaths:governedApprovalInputs,actualProducerReceiptReused:true,formerMarkdownOmissionReproduced:true,sourceCases:governanceSourceCases};
  for(const [name,text,diagnostic] of [
    ['producer-progress-on-stdout',source+`\nprocess.stdout.write(${JSON.stringify(producerProgress)});\n`,'Unexpected non-whitespace character after JSON'],
    ['foreign-failed-observation',source+`\nconsole.log(JSON.stringify({foreignImportedReport:true,verificationObservations:[{checkId:'foreign.failed-assertion',boundary:'controlled imported report',expected:true,observed:false,passed:false}]}));\n`,'failed or missing required assertion foreign.failed-assertion'],
    ['foreign-duplicate-observation',source+`\nconsole.log(JSON.stringify({foreignImportedReport:true,verificationObservations:[{checkId:'foreign.duplicate-assertion',boundary:'controlled imported report',expected:true,observed:true,passed:true},{checkId:'foreign.duplicate-assertion',boundary:'controlled imported report',expected:true,observed:true,passed:true}]}));\n`,'duplicate emitted assertion foreign.duplicate-assertion'],
    ['foreign-malformed-observation',source+`\nconsole.log(JSON.stringify({foreignImportedReport:true,verificationObservations:[{checkId:'foreign.malformed-assertion',expected:true,observed:true,passed:true}]}));\n`,'malformed emitted assertion observation'],
    ['missing-required-observation',source.replace('stage03AgentProtocol:true','stage03AgentProtocol:false'),'failed or missing required assertion'],
    ['duplicate-report',source+"\nconsole.log(JSON.stringify({stage03AgentProtocol:true}));\n",'expected exactly one report marker'],
    ['duplicate-observation',source.replace("verificationObservations:[","verificationObservations:[{checkId:'stage03.protocol',boundary:'controlled duplicate',expected:true,observed:true,passed:true},"),'duplicate emitted assertion'],
    ['failed-producer',source+"\nthrow new Error('CONTROLLED_NONZERO_CHILD');\n",'producer exit/output bound failed']
  ]){
    const {result,receipt}=await run(name,text);
    assert.equal(result.status,1,`${name} must fail the actual producer command.`);
    assert.equal(receipt.complete,false,`${name} produced a successful receipt.`);
    assert.match(receipt.reason,new RegExp(diagnostic),`${name} failed for the wrong mechanism.`);
    assert.throws(()=>validateExecutionReceipt(receipt,suite,evidenceFingerprint()),/EXECUTED_EVIDENCE_ORACLE/);
    producerControls.push({caseId:name,expectedExit:1,observedExit:result.status,expectedDiagnostic:diagnostic,observedDiagnostic:receipt.reason,accepted:false,result:'DETECTED'});
  }
  for(const [name,mutate] of [
    ['stale-source',receipt=>{receipt.fingerprint.sourceInputsSha256='0'.repeat(64);}],
    ['stale-specification',receipt=>{receipt.fingerprint.specificationSha256='0'.repeat(64);}],
    ['wrong-revision',receipt=>{receipt.fingerprint.sourceCommit='0'.repeat(40);}],
    ['wrong-runtime',receipt=>{receipt.fingerprint.runtime.node='v0.0.0';}],
    ['changed-observation',receipt=>{receipt.observations[0].passed=false;}]
  ]){
    const receipt=structuredClone(good.receipt);mutate(receipt);delete receipt.receiptSha256;receipt.receiptSha256=sha(receipt);
    assert.throws(()=>validateExecutionReceipt(receipt,suite,evidenceFingerprint()),/EXECUTED_EVIDENCE_ORACLE/);producerControls.push({caseId:name,accepted:false,result:'DETECTED'});
  }
  await assert.rejects(collectVerificationEvidence({directory:path.join(directory,'empty'),runMissing:false}),/missing required current receipt/);
  producerControls.push({caseId:'missing-current-producer-receipt',accepted:false,result:'DETECTED'});
  // These original linkage/ownership controls belong to the exact retained 7df source context.
  // They are not current 3e assertions, a default-suite receipt, or full-clause proof.
  // Keep historical receipts and stderr outside both owned temporary roots.
  // The adapter still joins its children and removes its owned source fixture.
  const historicalLedgerEvidenceDirectory=path.join(persistentChildEvidence?.directory||path.dirname(directory),path.basename(directory)+'-historical-context-ledger');
  const historicalLedgerParentFingerprint=evidenceFingerprint();
  const historicalLedgerReport=await runHistoricalContextLedger({sourceRoot:process.cwd(),expectedCommit:historicalLedgerParentFingerprint.sourceCommit,expectedTree:historicalLedgerParentFingerprint.sourceTree,evidenceDirectory:historicalLedgerEvidenceDirectory,originalOwnerStartedAtUnixMs:originalLedgerOwnerStartedAtUnixMs});
  const {normativeRegistryLinkageControl,observationOwnershipControl}=historicalLedgerReport;
  producerControls.push(...historicalLedgerReport.producerControls);
  const historicalLedgerSourceClosure=JSON.parse(fs.readFileSync(path.join(historicalLedgerEvidenceDirectory,'post-execution-source-closure.json'),'utf8'));
  const historicalLedgerCleanup=JSON.parse(fs.readFileSync(path.join(historicalLedgerEvidenceDirectory,'cleanup.json'),'utf8'));
  assert.equal(historicalLedgerSourceClosure.valid,true,'HISTORICAL_LEDGER_PARENT_SOURCE_CLOSURE_ORACLE');
  assert.equal(historicalLedgerSourceClosure.checkedBeforeCleanup,true,'HISTORICAL_LEDGER_PARENT_SOURCE_CLOSURE_ORACLE');
  assert.equal(historicalLedgerCleanup.ownedFixtureAbsent,true,'HISTORICAL_LEDGER_PARENT_CLEANUP_ORACLE');
  assert.equal(historicalLedgerCleanup.allWorkerChildrenJoinedBeforeCleanup,true,'HISTORICAL_LEDGER_PARENT_CLEANUP_ORACLE');
  const historicalContextLedgerControl={result:'PASS',report:historicalLedgerReport,parentFingerprint:historicalLedgerParentFingerprint,sourceClosure:historicalLedgerSourceClosure,cleanup:historicalLedgerCleanup,originalOwnerStartedAtUnixMs:originalLedgerOwnerStartedAtUnixMs,deadlineUnixMs:originalLedgerOwnerStartedAtUnixMs+1200000,finishedAtUnixMs:Date.now()};
  assert(historicalContextLedgerControl.finishedAtUnixMs<=historicalContextLedgerControl.deadlineUnixMs,'HISTORICAL_LEDGER_ORIGINAL_OWNER_DEADLINE_ORACLE');
  const ownReport={executedEvidenceProtection:'PASS',reviewedProjectHandoffControl,browserObserverLifecycleControl,browserExtraAggregateControl,historicalContextLedgerControl,splitRootControl,preloadFailureVisibilityControl,retainedRootNativeEvidenceControl,humanCombinedNativeEvidenceControl,humanCombinedUiEvidenceControl,ownershipReceiptRoutingControl,deferredCatalogConsumerControl,dueSchedulingControl,crossRunSchedulingControl,stage03ChildConstructionControl,coldCheckoutCases,coldUploadControl,producerViolationsRejected:producerControls.every(row=>row.result==='DETECTED'),syntaxChecksDoNotClaimExecution:true,syntaxPopulationCases,collectorOwnOutputControl,governanceFingerprintControl,governanceFingerprintInputs:true,activeFixtureFingerprintControl,activeHelperFingerprintControl,activeFixtureFingerprintInputs:true,normativeRegistryLinkageControl,observationOwnershipControl,emptyUniverseRejected:true,controlledProducerPopulation:producerControls,actualConformingStage03AssertionsExecuted:true,missingEvidenceRemainsUnknown:true,verificationObservations:[{checkId:'evidence.real-producer-controls',boundary:'actual Node exit/preload -> receipt consumer',expected:'ALL_CONTROLS_REJECTED_FOR_NAMED_REASON',observed:producerControls,passed:true,requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt#49']},{checkId:'APPROVED-GOVERNANCE-SOURCE-BYTES',boundary:governanceFingerprintControl.boundary,expected:{actualGovernanceByteHashBound:true,changedBytesRejectActualReceipt:true,missingBytesFailHonestly:true,untrackedBytesBound:true,untrackedMutationRejectsActualReceipt:true,exactRestoreAdmitsActualReceipt:true,formerMarkdownOmissionReproduced:true},observed:{actualGovernanceByteHashBound:governanceSourceCases.every(row=>row.actualByteHashBound),changedBytesRejectActualReceipt:governanceSourceCases.every(row=>row.changedBytesRejectActualReceipt),missingBytesFailHonestly:governanceSourceCases.every(row=>row.missingBytesFailHonestly),untrackedBytesBound:governanceSourceCases.every(row=>row.untrackedBytesBound),untrackedMutationRejectsActualReceipt:governanceSourceCases.every(row=>row.untrackedMutationRejectsActualReceipt),exactRestoreAdmitsActualReceipt:governanceSourceCases.every(row=>row.exactRestoreAdmitsActualReceipt),formerMarkdownOmissionReproduced:true},passed:true,requirementRefs:[96]}]};
  const ownPreloadCheck='receipts.preload-failure-visibility';
  assert.equal(observationsFromReports('verify-executed-evidence.mjs',[ownReport]).find(row=>row.checkId===ownPreloadCheck)?.passed,true,'PRELOAD_RECEIPT_OBSERVATION_ORACLE: actual preload receipt eligibility population was not admitted.');
  for(const variant of ['wrong-value','missing-field','extra-field']){
    const incomplete=structuredClone(ownReport),control=incomplete.preloadFailureVisibilityControl.receiptEligibility;
    if(variant==='wrong-value')control.sourceOverrideReceiptUnchanged=false;
    else if(variant==='missing-field')delete control.corruptReceiptRejected;
    else control.unrelatedSuccess=true;
    assert.equal(observationsFromReports('verify-executed-evidence.mjs',[incomplete]).find(row=>row.checkId===ownPreloadCheck)?.passed,false,'PRELOAD_RECEIPT_OBSERVATION_ORACLE: '+variant+' was silently admitted.');
  }
  const ownGovernanceCheck='receipts.approved-governance-input-observation';
  assert.equal(observationsFromReports('verify-executed-evidence.mjs',[ownReport]).find(row=>row.checkId===ownGovernanceCheck)?.passed,true,'GOVERNANCE_INPUT_OBSERVATION_ORACLE: actual owner population was not admitted.');
  for(const variant of ['omitted','wrong-value','missing-field','extra-field']){
    const incomplete=structuredClone(ownReport),detail=incomplete.verificationObservations.find(row=>row.checkId==='APPROVED-GOVERNANCE-SOURCE-BYTES');
    if(variant==='omitted')incomplete.verificationObservations=incomplete.verificationObservations.filter(row=>row!==detail);
    else if(variant==='wrong-value')detail.observed.changedBytesRejectActualReceipt=false;
    else if(variant==='missing-field')delete detail.observed.untrackedBytesBound;
    else detail.observed.unrelatedSuccess=true;
    assert.equal(observationsFromReports('verify-executed-evidence.mjs',[incomplete]).find(row=>row.checkId===ownGovernanceCheck)?.passed,false,'GOVERNANCE_INPUT_OBSERVATION_ORACLE: '+variant+' was silently admitted.');
    producerControls.push({caseId:'required-governance-observation-'+variant,accepted:false,result:'DETECTED'});
  }
  const ownFixtureCheck='receipts.active-fixture-inputs';
  assert.equal(observationsFromReports('verify-executed-evidence.mjs',[ownReport]).find(row=>row.checkId===ownFixtureCheck)?.passed,true,'FIXTURE_INPUT_OBSERVATION_ORACLE: actual current fixture-byte controls were not admitted.');
  for(const variant of ['wrong-value','missing-case','extra-case']){
    const incomplete=structuredClone(ownReport),control=incomplete.activeFixtureFingerprintControl;
    if(variant==='wrong-value')control.sourceCases[0].untrackedMutationRejectsActualReceipt=false;
    else if(variant==='missing-case')control.sourceCases=[];
    else control.sourceCases.push(structuredClone(control.sourceCases[0]));
    assert.equal(observationsFromReports('verify-executed-evidence.mjs',[incomplete]).find(row=>row.checkId===ownFixtureCheck)?.passed,false,'FIXTURE_INPUT_OBSERVATION_ORACLE: '+variant+' was silently admitted.');
    producerControls.push({caseId:'required-active-fixture-input-'+variant,accepted:false,result:'DETECTED'});
  }
  const noFixtureMarker=structuredClone(ownReport);delete noFixtureMarker.activeFixtureFingerprintInputs;
  assert.throws(()=>observationsFromReports('verify-executed-evidence.mjs',[noFixtureMarker]),/expected exactly one report marker activeFixtureFingerprintInputs/,'FIXTURE_INPUT_OBSERVATION_ORACLE: the required input owner marker disappeared.');
  console.log(JSON.stringify(ownReport));
}catch(error){executionFailed=true;executionError=error;
}finally{
  if(splitLayout){
    if(inheritedChildEvidenceDirectory===undefined)delete process.env.VERIFIER_CHILD_EVIDENCE_DIRECTORY;
    else process.env.VERIFIER_CHILD_EVIDENCE_DIRECTORY=inheritedChildEvidenceDirectory;
  }
  if(configuredCopyBase===undefined){
    fs.rmSync(directory,{recursive:true,force:true});
    if(executionFailed)throw executionError;
  }else cleanupExecutedEvidenceRoots({primaryRoot:directory,secondaryRoot:splitLayout?.secondaryRoot,executionFailed,executionError});
}
