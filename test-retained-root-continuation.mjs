import fs from 'node:fs';
import assert from 'node:assert/strict';
import {historyValueEntries} from './test-history-part-files.mjs';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import vm from 'node:vm';

// Exact observers expose private proof mutation only in this isolated fixture.
// The production API has no proof/certificate option.
export async function verifyRetainedRootContinuation({fault=null,caseFilter=null}={}){
 const original=fs.readFileSync('project-store.js','utf8');let source=original;
 if(fault==='repeat-root-computations'){const before='const reuse=rootPreparation&&usableRootContinuation';assert.equal(source.split(before).length,2);source=source.replace(before,'const reuse=false&&rootPreparation&&usableRootContinuation');}
 if(fault==='skip-preparation-requalification'){const before='if(reuse&&decoded.project===reuse.project&&!rootQualified)throw storageError';assert.equal(source.split(before).length,2);source=source.replace(before,'if(false)throw storageError');}
 if(fault==='carry-write-derivation'){const before='validators,derivedVerified:false,derivedAt:0};';assert.equal(source.split(before).length,2);source=source.replace(before,'validators,derivedVerified:true,derivedAt:0};');}
 // A write's derivation carried without reproducing the custody it read, or
 // without its own derivation time.
 if(fault==='carry-unreproduced-write-derivation'){const before='&&writeDerivationReproduced(writeDerivation,rootArtifacts)){root.derivedVerified=true;';assert.equal(source.split(before).length,2,'RETAINED_ROOT_FAULT_ANCHOR_ORACLE '+fault);source=source.replace(before,'){root.derivedVerified=true;');}
 // A write that never carries its derivation repeats it at the next save.
 if(fault==='drop-write-derivation-binding'){const before='if(derivation&&derivation.validators===validators&&writeDerivationArtifactsRetained(derivation,encoded.body.artifacts))writeDerivations.set(root,derivation);';assert.equal(source.split(before).length,2,'RETAINED_ROOT_FAULT_ANCHOR_ORACLE '+fault);source=source.replace(before,'');}
 if(fault==='carry-write-derivation-without-clock'){const before='{root.derivedVerified=true;root.derivedAt=writeDerivation.at;}';assert.equal(source.split(before).length,2,'RETAINED_ROOT_FAULT_ANCHOR_ORACLE '+fault);source=source.replace(before,'{root.derivedVerified=true;root.derivedAt=0;}');}
 if(fault==='skip-no-append-validator-check'){const before='const staticCarried=body.project===proof.project&&Boolean(proof.validators)&&rootValidatorsUnchanged(proof.validators),',after='if(staticCarried&&!rootValidatorsUnchanged(proof.validators)){recoveryBodyStaticIntegrity.delete(saved.project);';assert.equal(source.split(before).length,2);assert.equal(source.split(after).length,2);source=source.replace(before,'const staticCarried=body.project===proof.project&&Boolean(proof.validators),').replace(after,'if(false){recoveryBodyStaticIntegrity.delete(saved.project);');}
 // Each intended fault below removes exactly one guard of the carried validation.
 const guardFaults={
  'drop-no-append-revalidation':['if(staticCarried&&!rootValidatorsUnchanged(proof.validators)){recoveryBodyStaticIntegrity.delete(saved.project);','if(false){recoveryBodyStaticIntegrity.delete(saved.project);'],
  'treat-tolerated-as-strict':['derivedStrict=strictlyCompatibleRoots.delete(root.project);}','derivedStrict=(strictlyCompatibleRoots.delete(root.project),true);}'],
  'drop-derived-clock-guard':['&&root.derivedVerified&&Date.now()>=root.derivedAt)',"&&root.derivedVerified)"],
  'drop-retained-clock-guard':['&&proof.derivedVerified===true&&Date.now()>=proof.derivedAt&&','&&proof.derivedVerified===true&&'],
  'drop-retained-manifest-match':['&&body.artifactManifestSha256===proof.descriptor.artifactManifestSha256;',';'],
  'drop-commit-revalidator-check':['staticVerified&&validators&&(carriedDerived||rootValidatorsUnchanged(validators))?validators:null','staticVerified&&validators?validators:null'],
  'drop-native-validator-globals':["const ROOT_VALIDATOR_NATIVE_GLOBALS=Object.freeze([","const ROOT_VALIDATOR_NATIVE_GLOBALS=Object.freeze([]||["]};
 // Trusting a write certificate's stored bytes without decoding them.
 guardFaults['trust-write-bytes']=['if(!unverifiedWriteRoots.has(proof))return true;','return true;'];
 guardFaults['encode-exposed-source']=['const canonical=privateSource&&!projectReference?copyVerifiedTree(exposedCanonical):exposedCanonical;','const canonical=exposedCanonical;'];
 guardFaults['drop-gate-digest-label']=['verifiedRead.project===project&&project.projectSha256===verifiedRead.digest&&verifiedRead.digest===root.projectSha256&&',''];
 guardFaults['public-continuation-decode']=['const holder=!verifiedByteDigests&&!validatedRoots.size&&!verifiedParts.size&&!importDigestHolders.has(verifiedParts)?{scope:null,attempted:Boolean(rootContinuation),privateRead:true}:null;','const holder=!rootContinuation&&!verifiedByteDigests&&!validatedRoots.size&&!verifiedParts.size&&!importDigestHolders.has(verifiedParts)?{scope:null,attempted:false,privateRead:true}:null;'];
 guardFaults['public-retained-decode']=['importDigestHolders.set(privateParts,{scope:null,attempted:true,privateRead:true});',''];
 guardFaults['swallow-write-check-errors']=['const decoded=await restoreHistoryProject({...body,project:copyVerifiedTree(body.project)},readFile,verifiedParts,verifiedByteDigests);','let decoded=null;try{decoded=await restoreHistoryProject({...body,project:copyVerifiedTree(body.project)},readFile,verifiedParts,verifiedByteDigests);}catch{}if(!decoded){rootCertificates.delete(proof);return false;}'];
 // A write derivation carried although its validators changed while it ran, or
 // before it ran, or although its subject requires retained run context.
 guardFaults['drop-write-derivation-validator-check']=['||!rootValidatorsUnchanged(validators))return null;',')return null;'];
 guardFaults['drop-write-derivation-prevalidator-check']=['const derivationValidators=preparedProof.validators&&rootValidatorsUnchanged(preparedProof.validators)?preparedProof.validators:null;','const derivationValidators=preparedProof.validators;'];
 guardFaults['carry-run-context-write-derivation']=['if((record.subject?.projectData?.generatedPrompts||[]).some(prompt=>globalThis.closedLoopPromptEngine.requiresRetainedRunContext(prompt)))return null;',''];
 guardFaults['drop-validator-internal-state']=['function rootValidatorInternalState(node){','function rootValidatorInternalState(node){return null;'];
 // A certified root's carried envelope used without the stored blob digest
 // check, the only check binding the root's stored bytes before that envelope
 // is used: the check skipped whenever an envelope is carried, or the carried
 // attempt moved above it.
 const rootByteCheck='  if(!entry?.blob||entry.blob.size!==Number(entry.byteSize)||(consumeCheckpointByteObservation(entry,rootBytes)||await historyBlobSha256(entry.blob,verifiedByteDigests))!==entry.sha256)throw',carriedAttempt='  const carried=certifiedRootEnvelope(entry,validatedRoots,inspection,rootContinuation);\n  if(carried)try{return await bindCheckpointBody(carried,true);}catch{/* Decode the stored bytes; their own outcome stands. */}\n';
 guardFaults['skip-carried-root-byte-check']=[rootByteCheck,'  if(!certifiedRootEnvelope(entry,validatedRoots,inspection,rootContinuation)&&(!entry?.blob||entry.blob.size!==Number(entry.byteSize)||(consumeCheckpointByteObservation(entry,rootBytes)||await historyBlobSha256(entry.blob,verifiedByteDigests))!==entry.sha256))throw'];
 if(fault==='carry-before-root-byte-check'){assert.equal(source.split(rootByteCheck).length,2,'RETAINED_ROOT_FAULT_ANCHOR_ORACLE '+fault);assert.equal(source.split(carriedAttempt).length,2,'RETAINED_ROOT_FAULT_ANCHOR_ORACLE '+fault);source=source.replace(carriedAttempt,'').replace(rootByteCheck,()=>carriedAttempt+rootByteCheck);}
 if(fault==='capture-write-validators-after-validation'){const before='const validatorsBefore=options[ROOT_CERTIFICATE_WRITE]===true?captureRootValidators(initialRootDigestPrimitives):null;',after='const writeValidators=validatorsBefore&&rootValidatorsUnchanged(validatorsBefore)?validatorsBefore:null;';assert.equal(source.split(before).length,2);assert.equal(source.split(after).length,2);source=source.replace(before,'const validatorsBefore=null;').replace(after,'const writeValidators=options[ROOT_CERTIFICATE_WRITE]===true?captureRootValidators(initialRootDigestPrimitives):null;');}
 if(fault==='capture-operational-validators-after-validation'){const before='const operationalBefore=options[ROOT_CERTIFICATE_WRITE]===true?captureRootValidators(initialRootDigestPrimitives):null;',after='const operationalValidators=operationalBefore&&rootValidatorsUnchanged(operationalBefore)?operationalBefore:null;';assert.equal(source.split(before).length,2);assert.equal(source.split(after).length,2);source=source.replace(before,'const operationalBefore=null;').replace(after,'const operationalValidators=options[ROOT_CERTIFICATE_WRITE]===true?captureRootValidators(initialRootDigestPrimitives):null;');}
 if(Object.hasOwn(guardFaults,fault)){const [before,after]=guardFaults[fault];assert.equal(source.split(before).length,2,'RETAINED_ROOT_FAULT_ANCHOR_ORACLE '+fault);source=source.replace(before,after);}
 if(fault==='trust-validator-identity'){const before='const carriedValidators=root.validators&&rootValidatorsUnchanged(root.validators)?root.validators:null';assert.equal(source.split(before).length,2);source=source.replace(before,'const carriedValidators=root.validators||null');}
 const anchors={restore:'async function restoreHistoryProject(body,readFile,verifiedParts=new Map(),verifiedByteDigests=null){',digest:'function historyProjectDigests(project){',static:'function assertProjectIntegrity(project,options){',derived:'function derivedProjectIntegrityIssues(project,{verifyCachedProjection=true,projectionObservedAt=null,verifyProjection=true}={}){'};
 for(const [name,anchor] of Object.entries(anchors)){assert.equal(source.split(anchor).length,2);source=source.replace(anchor,anchor+`globalThis.__rootCounts.${name}++;`+(name==='derived'?'globalThis.__duringDerived?.();':''));}
 // A hook holding the value a write's custody checks handed out, and the end of
 // each write's synchronous validation.
 const encodeLine='const contents=projectReference?null:await encodeHistoryProject(canonical,retainValue);';assert.equal(source.split(encodeLine).length,2);source=source.replace(encodeLine,'globalThis.__duringEncode?.(exposedCanonical);'+encodeLine+'globalThis.__afterEncode?.();');
 for(const anchor of ["}catch(error){if(commitDerives&&error?.code==='PROJECT_INTEGRITY_FAILED')assertProjectIntegrity(next,{prior});throw error;}",'operationalDerivation=withWriteDerivationRecord(next,()=>assertProjectIntegrity(next));']){assert.equal(source.split(anchor).length,2);source=source.replace(anchor,anchor+'globalThis.__afterWriteValidation?.();');}
 const retainedRead='const saved=await validateCheckpointArtifacts(jobId,body,sha=>metaGet(historyFileKey(jobId,sha)),null,null,null,certified);';assert.equal(source.split(retainedRead).length,2);source=source.replace(retainedRead,'globalThis.__duringRetainedRead?.();'+retainedRead);
 // A diagnostic tolerated derivation: it returns like the legacy and historical
 // tolerances do, without a strict pass.
 const strictDerivation='      const issues=derivedProjectIntegrityIssues(project);\n',tolerance='  }catch(error){\n    if(projectionActivationRequired(project)||legacyExpectedVarianceSources(project).length){';assert.equal(source.split(strictDerivation).length,2);assert.equal(source.split(tolerance).length,2);
 source=source.replace(strictDerivation,"      if(globalThis.__tolerateDerivation?.(project))throw Object.assign(new Error('Tolerated diagnostic derivation'),{code:'TOLERATED_DIAGNOSTIC_DERIVATION'});\n"+strictDerivation).replace(tolerance,"  }catch(error){if(error.code==='TOLERATED_DIAGNOSTIC_DERIVATION')return;\n    if(projectionActivationRequired(project)||legacyExpectedVarianceSources(project).length){");
 const exportAnchor='globalThis.closedLoopProjectStore=Object.freeze({STORAGE_IO_TIMEOUT_MS';assert.equal(source.split(exportAnchor).length,2);
 source=source.replace(exportAnchor,'globalThis.__rootProof=()=>recentOperationalCommitRead?.retainedRoot;globalThis.__rootPrivateRead=readProjectForTransaction;globalThis.__writeDerivationBinding=record=>writeDerivationBinding(record,captureRootValidators(initialRootDigestPrimitives));'+exportAnchor);
 // Counts decodes of a checkpoint envelope from its stored bytes.
 const envelopeDecode='  const {payload,fileContents}=await readPackageJson(entry.blob,{spoolArtifacts:false}),{packageSha256,...body}=payload;';assert.equal(source.split(envelopeDecode).length,2,'RETAINED_ROOT_ENVELOPE_DECODE_ANCHOR_ORACLE');source=source.replace(envelopeDecode,'  globalThis.__rootEnvelopeDecodes=(globalThis.__rootEnvelopeDecodes||0)+1;\n'+envelopeDecode);
 const commitAnchor='  const root=prepared.retainedRoot,primitive=root.primitive,';assert.equal(source.split(commitAnchor).length,2);source=source.replace(commitAnchor,'  globalThis.__beforeRootCommit?.(prepared.retainedRoot);\n'+commitAnchor);
 const qualify='      const rootQualified=';assert.equal(source.split(qualify).length,2);source=source.replace(qualify,'      globalThis.__mutateRootPreparation?.(decoded.project,project);\n'+qualify);
 const cases=[];
 for(const mode of ['valid-two-warm-views','wrong-work-proof','wrong-project-proof','wrong-root-descriptor','mutated-root-value','mutated-root-snapshot','changed-generator-dispatch','changed-encoder-dispatch','changed-validator-definition','changed-nested-definition','public-read-keeps-certificate','one-use-private-read','unchanged-view-keeps-certificate','unchanged-view-changed-validator','failed-save-cold-fallback','root-mutation-during-preparation','source-mutation-during-preparation','primitive-mutation-during-preparation','mutated-root-envelope','corrupt-root-after-certification','swapped-root-after-certification','corrupt-root-after-certification-session','swapped-root-after-certification-session','corrupt-root-after-certification-unchanged-view','swapped-root-after-certification-unchanged-view','wrong-root-descriptor-parts','mutated-candidate-parts-before-commit']){
  if(caseFilter&&!caseFilter.includes(mode))continue;
  const r=projectStoreRuntime({sourceOverrides:{'project-store.js':source},environment:{__rootCounts:{restore:0,digest:0,static:0,derived:0}},storageWorker:false});
  let p=await r.store.createProject({commandId:'PRIVATE-ROOT-'+mode});p.job.JOB_TITLE='Exact retained title '+'independent retained content '.repeat(300);r.engine.recalculate(p);p=await r.store.writeProject(p,{expectedProjectRevision:p.revision});await r.store.readProject(p.job.JOB_ID);
  const view=name=>r.copy({activeStage:1,activeView:name,drafts:{'#exact':{value:name+' exact draft'}},scrollX:0,scrollY:17});
  const save=name=>r.store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,view:view(name)});
  await save('Project');const proof=r.runtime.__rootProof();assert.ok(proof,'Cold successful commit mints private exact root computations');let before={...r.runtime.__rootCounts};
  if(mode==='wrong-work-proof')proof.workSha256='0'.repeat(64);
  if(mode==='wrong-project-proof')proof.projectSha256='0'.repeat(64);
  if(mode==='wrong-root-descriptor')proof.descriptor.label='Unrelated immutable root';
  // The certificate carries the record descriptor; the History state names its
  // parts by digest. Changed parts no longer match and the save decodes cold.
  if(mode==='wrong-root-descriptor-parts'){assert.ok(historyValueEntries(proof.descriptor.projectParts).length,'RETAINED_ROOT_RECORD_DESCRIPTOR_ORACLE');historyValueEntries(proof.descriptor.projectParts)[0].sha256='0'.repeat(64);}
  if(mode==='mutated-root-value')proof.project.job.JOB_TITLE='Caller mutation of private retained value';
  if(mode==='mutated-root-snapshot')proof.snapshot.job.JOB_TITLE='Changed private proof snapshot';
  // The carried envelope is never trusted over the stored bytes: a changed
  // copy is refused by its descriptor bindings and the bytes are decoded.
  if(mode==='mutated-root-envelope'){assert.ok(proof.body&&typeof proof.body==='object','RETAINED_ROOT_ENVELOPE_FIXTURE_ORACLE');proof.body.label='Changed carried envelope';}
  // A certified root whose bytes were already decoded and compared stays bound
  // to its stored bytes: a root blob corrupted or swapped after certification
  // is refused, nothing is written and no continuation is published. A changed
  // view is refused by append's own pre-check. A new session alone, or the
  // unchanged active view, appends nothing: its retained read reaches the root
  // through the certificate's carried envelope, which the stored blob digest
  // check alone binds to the root's stored bytes.
  const tamper=/^(corrupt|swapped)-root-after-certification(?:-(session|unchanged-view))?$/.exec(mode);
  if(tamper){
   const [,kind,noAppend]=tamper,meta=r.rows.get('meta'),prefix='recovery:'+p.job.JOB_ID+':snapshot:',entries=async()=>(await r.store.historyList(p.job.JOB_ID)).entries.length;
   const attempt=noAppend==='session'?sessionId=>r.store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,sessionId}):noAppend==='unchanged-view'?()=>save('Project'):()=>save('Workflow');
   // The same no-append save over intact bytes carries the certified root:
   // only the active checkpoint's envelope is decoded and the re-proven
   // certificate stays published.
   if(noAppend){
    const count=await entries(),decodes=r.runtime.__rootEnvelopeDecodes||0;await attempt('certified-root-control-session');
    assert.equal((r.runtime.__rootEnvelopeDecodes||0)-decodes,1,'RETAINED_ROOT_CERTIFIED_NO_APPEND_FIXTURE_ORACLE: the no-append read carries the certified root envelope');
    assert.equal(await entries(),count,'RETAINED_ROOT_CERTIFIED_NO_APPEND_FIXTURE_ORACLE: the no-append save appends nothing');assert.ok(r.runtime.__rootProof()?.descriptor?.id===proof.descriptor.id,'RETAINED_ROOT_CERTIFIED_NO_APPEND_FIXTURE_ORACLE: the certificate stays published');
   }
   const row=meta.get(prefix+proof.descriptor.id);
   assert.ok(row?.value?.blob instanceof Blob&&row.value.sha256===proof.descriptor.sha256&&!row.value.projectReference,'RETAINED_ROOT_CERTIFIED_TAMPER_TARGET_ORACLE');
   const other=kind==='swapped'?[...meta.entries()].find(([key,item])=>key.startsWith(prefix)&&key!==prefix+proof.descriptor.id&&item?.value?.blob instanceof Blob)?.[1]:null;
   if(kind==='swapped')assert.ok(other&&other.value.sha256!==row.value.sha256,'RETAINED_ROOT_CERTIFIED_SWAP_SOURCE_ORACLE');
   row.value.blob=other?other.value.blob:new Blob(['X'.repeat(row.value.blob.size)]);
   const snapshot=r.copy([...r.rows].map(([name,rows])=>[name,[...rows]]));
   await assert.rejects(()=>attempt('tampered-root-session'),e=>e.code==='HISTORY_SNAPSHOT_INTEGRITY_FAILED','RETAINED_ROOT_CERTIFIED_BYTES_ORACLE '+mode);
   assert.deepEqual(r.copy([...r.rows].map(([name,rows])=>[name,[...rows]])),snapshot,'Rejected save preserves exact state');assert.ok(r.runtime.__rootProof()===undefined,'Rejected save publishes no continuation');
   cases.push({mode,result:'PASS',error:'HISTORY_SNAPSHOT_INTEGRITY_FAILED',...(noAppend?{noAppend,carriedBeforeTamper:true}:{}),noCheckpointReturned:true,noProofPublished:true,exactStatePreserved:true});continue;
  }
  let dispatch,encoderDispatch;
  if(mode==='changed-generator-dispatch'){const proto=Object.getPrototypeOf(r.runtime.closedLoopHash.canonicalChunks(null));dispatch=Object.getOwnPropertyDescriptor(proto,'next');Object.defineProperty(proto,'next',{value:function(){return Object.getPrototypeOf(Object.getPrototypeOf(this)).next.call(this);},configurable:true});}
  if(mode==='changed-encoder-dispatch'){encoderDispatch=Object.getOwnPropertyDescriptor(r.runtime.TextEncoder.prototype,'encode');Object.defineProperty(r.runtime.TextEncoder.prototype,'encode',{...encoderDispatch,value:function(text){return encoderDispatch.value.call(this,text);}});}
  // A replaced validator definition keeps the certified bytes and digests but
  // returns the unchanged root to full static and derived validation.
  const originalEngine=r.runtime.closedLoopWorkflowEngine;
  if(mode==='changed-validator-definition')vm.runInContext('globalThis.closedLoopWorkflowEngine=Object.freeze({...globalThis.closedLoopWorkflowEngine});',r.runtime);
  // A changed nested definition entry without replacing any export.
  const nestedDefinition=mode==='changed-nested-definition'?vm.runInContext(`(()=>{const seen=new Set(),pending=[globalThis.closedLoopWorkflowSchema];while(pending.length){const value=pending.pop();if(!value||typeof value!=='object'||seen.has(value))continue;seen.add(value);if(value!==globalThis.closedLoopWorkflowSchema&&!Object.isFrozen(value)&&!Array.isArray(value)&&!(value instanceof Map))return value;for(const key of Reflect.ownKeys(value)){const descriptor=Object.getOwnPropertyDescriptor(value,key);if(Object.hasOwn(descriptor,'value'))pending.push(descriptor.value);}}return null;})()`,r.runtime):null;
  if(mode==='changed-nested-definition'){assert.ok(nestedDefinition,'RETAINED_ROOT_NESTED_DEFINITION_FIXTURE_ORACLE');nestedDefinition.__changedDefinitionControl=true;}
  // A public read returns fresh objects and consumes nothing; the certificate
  // survives it and the next view save stays warm.
  if(mode==='public-read-keeps-certificate'){const read=await r.store.readProject(p.job.JOB_ID);assert.equal(read.projectSha256,p.projectSha256);assert.ok(r.runtime.__rootProof(),'RETAINED_ROOT_PUBLIC_READ_KEEPS_CERTIFICATE_ORACLE');assert.ok(r.runtime.__rootCounts.static>before.static,'A public read still validates its fresh row statically');before={...r.runtime.__rootCounts};}
  if(mode==='one-use-private-read')await r.runtime.__rootPrivateRead(p.job.JOB_ID);
  // An identical view appends nothing and changes no certified root; the
  // re-proven certificate stays published and the next view save stays warm.
  if(mode==='unchanged-view-keeps-certificate'){await save('Project');assert.ok(r.runtime.__rootProof(),'RETAINED_ROOT_UNCHANGED_VIEW_KEEPS_CERTIFICATE_ORACLE');before={...r.runtime.__rootCounts};}
  // An identical view saved under a replaced validator definition validates the
  // certified root again instead of carrying its validation.
  if(mode==='unchanged-view-changed-validator'){const engine=r.runtime.closedLoopWorkflowEngine,start={...r.runtime.__rootCounts};vm.runInContext('globalThis.closedLoopWorkflowEngine=Object.freeze({...globalThis.closedLoopWorkflowEngine});',r.runtime);try{await save('Project');}finally{r.runtime.closedLoopWorkflowEngine=engine;}assert.ok(r.runtime.__rootCounts.static>start.static,'RETAINED_ROOT_VALIDATOR_ORACLE: an unchanged view under a replaced validator re-validates statically');assert.ok(r.runtime.__rootCounts.derived>start.derived,'RETAINED_ROOT_VALIDATOR_ORACLE: an unchanged view under a replaced validator re-validates the derivation');before={...r.runtime.__rootCounts};}
  if(mode==='failed-save-cold-fallback'){const snapshot=r.copy([...r.rows].map(([name,rows])=>[name,[...rows]]));r.runtime.__closedLoopStorageFault='during-history-write';await assert.rejects(()=>save('Workflow'),e=>e.code==='INJECTED_STORAGE_FAILURE');delete r.runtime.__closedLoopStorageFault;assert.deepEqual(r.copy([...r.rows].map(([name,rows])=>[name,[...rows]])),snapshot);assert.ok(r.runtime.__rootProof()===undefined,'Failed save publishes no continuation');}
  // A prepared root whose record parts change before its commit transaction is
  // refused by the stored-root comparison; nothing is written or published.
  if(mode==='mutated-candidate-parts-before-commit'){
   const snapshot=r.copy([...r.rows].map(([name,rows])=>[name,[...rows]]));let reached=false;
   r.runtime.__beforeRootCommit=root=>{reached=true;delete r.runtime.__beforeRootCommit;assert.ok(historyValueEntries(root.descriptor.projectParts).length,'RETAINED_ROOT_RECORD_DESCRIPTOR_ORACLE: the candidate carries the complete record descriptor');historyValueEntries(root.descriptor.projectParts)[0].byteSize++;};
   await assert.rejects(()=>save('Workflow'),e=>e.code==='HISTORY_SNAPSHOT_INTEGRITY_FAILED'&&e.message==='The retained root changed before checkpoint commit.','RETAINED_ROOT_CANDIDATE_PARTS_ORACLE');
   assert.equal(reached,true,'RETAINED_ROOT_CANDIDATE_PARTS_FIXTURE_ORACLE');assert.deepEqual(r.copy([...r.rows].map(([name,rows])=>[name,[...rows]])),snapshot);assert.ok(r.runtime.__rootProof()===undefined);
   cases.push({mode,result:'PASS',error:'HISTORY_SNAPSHOT_INTEGRITY_FAILED',noCheckpointReturned:true,noProofPublished:true,exactStatePreserved:true});continue;
  }
  if(mode.endsWith('during-preparation')){
   const snapshot=r.copy([...r.rows].map(([name,rows])=>[name,[...rows]]));let reached=false;
   r.runtime.__mutateRootPreparation=(root,sourceProject)=>{reached=true;delete r.runtime.__mutateRootPreparation;if(mode==='root-mutation-during-preparation')root.job.JOB_TITLE='Changed deferred root';if(mode==='source-mutation-during-preparation')sourceProject.job.JOB_TITLE='Changed current source';if(mode==='primitive-mutation-during-preparation')r.runtime.closedLoopHash.canonicalChunks.extra='changed during preparation';};
   await assert.rejects(()=>save('Workflow'),e=>e.code==='HISTORY_VERSION_MISMATCH','Deferred warm validation cannot escape into ordinary commit');delete r.runtime.closedLoopHash.canonicalChunks.extra;assert.equal(reached,true);assert.deepEqual(r.copy([...r.rows].map(([name,rows])=>[name,[...rows]])),snapshot);assert.ok(r.runtime.__rootProof()===undefined);cases.push({mode,result:'PASS',noCheckpointReturned:true,noProofPublished:true,exactStatePreserved:true});continue;
  }
  const envelopeDecodesBefore=r.runtime.__rootEnvelopeDecodes||0;
  const id=await save('Workflow'),after={...r.runtime.__rootCounts},difference=Object.fromEntries(Object.entries(after).map(([key,value])=>[key,value-before[key]]));
  const envelopeDecodes=(r.runtime.__rootEnvelopeDecodes||0)-envelopeDecodesBefore;
  if(mode==='valid-two-warm-views'||mode==='public-read-keeps-certificate'||mode==='unchanged-view-keeps-certificate'||mode==='mutated-root-envelope'){assert.equal(difference.restore,0,'RETAINED_ROOT_WARM_RESTORE_ORACLE');assert.equal(difference.digest,0,'RETAINED_ROOT_WARM_DIGEST_ORACLE');assert.equal(difference.static,0,'RETAINED_ROOT_WARM_STATIC_ORACLE');assert.equal(difference.derived,0,'RETAINED_ROOT_WARM_DERIVED_ORACLE');const start={...after};await save('Records');assert.equal(r.runtime.__rootCounts.restore,start.restore,'RETAINED_ROOT_WARM_RESTORE_ORACLE');assert.equal(r.runtime.__rootCounts.digest,start.digest,'RETAINED_ROOT_WARM_DIGEST_ORACLE');assert.equal(r.runtime.__rootCounts.static,start.static,'RETAINED_ROOT_WARM_STATIC_ORACLE');assert.equal(r.runtime.__rootCounts.derived,start.derived,'RETAINED_ROOT_WARM_DERIVED_ORACLE');assert.equal(envelopeDecodes,mode==='mutated-root-envelope'?1:0,'RETAINED_ROOT_WARM_ENVELOPE_ORACLE: a warm view save decodes the certified root envelope only when its carried copy disagrees');}
  else if(mode==='unchanged-view-changed-validator')assert.deepEqual(difference,{restore:0,digest:0,static:0,derived:0},'With the original definition restored, the certificate validated under it is carried again');
  else if(mode==='changed-validator-definition'||mode==='changed-nested-definition'){assert.equal(difference.restore,0,'RETAINED_ROOT_WARM_RESTORE_ORACLE');assert.equal(difference.digest,0,'RETAINED_ROOT_WARM_DIGEST_ORACLE');assert.ok(difference.static>=1,'RETAINED_ROOT_VALIDATOR_ORACLE: a replaced validator definition re-validates the certified root statically');assert.ok(difference.derived>=1,'RETAINED_ROOT_VALIDATOR_ORACLE: a replaced validator definition re-validates the certified root derivation');if(mode==='changed-nested-definition')delete nestedDefinition.__changedDefinitionControl;else r.runtime.closedLoopWorkflowEngine=originalEngine;}
  else {assert.ok(difference.restore>=1,'Invalid/consumed certificate uses independent cold reconstruction: '+mode);assert.ok(difference.digest>=1,'Invalid/consumed certificate measures both digests independently: '+mode);}
  if(mode==='changed-generator-dispatch'){const proto=Object.getPrototypeOf(r.runtime.closedLoopHash.canonicalChunks(null));if(dispatch)Object.defineProperty(proto,'next',dispatch);else delete proto.next;}
  if(mode==='changed-encoder-dispatch')Object.defineProperty(r.runtime.TextEncoder.prototype,'encode',encoderDispatch);
  assert.equal((await r.store.readHistoryView(p.job.JOB_ID,id)).drafts['#exact'].value,'Workflow exact draft');assert.equal((await r.store.readProject(p.job.JOB_ID)).job.JOB_TITLE,p.job.JOB_TITLE);
  if(mode==='mutated-root-envelope'){const state=await r.store.historyList(p.job.JOB_ID);assert.equal(state.entries.find(entry=>entry.id===proof.descriptor.id)?.label,proof.descriptor.label,'RETAINED_ROOT_ENVELOPE_STORED_LABEL_ORACLE');}
  cases.push({mode,result:'PASS',counts:difference,envelopeDecodes,exactDraftAndProjectPreserved:true});
 }
 // A canonical write certifies the value it validated and its static
 // validation. The next view save decodes the stored root bytes and compares
 // them with that value, rehashes the stored root, every part and every
 // artifact in its transaction. It carries the write's own strict derivation
 // only when every custody answer that derivation read is reproduced by the
 // root's byte-verified artifacts, under unchanged validators and no earlier
 // clock; otherwise it validates the derivation once.
 for(const mode of ['write-certificate-warm','write-certificate-corrupt-part','write-certificate-corrupt-root','write-certificate-changed-validator','write-certificate-encode-native-swap','write-certificate-custody-differs','write-certificate-clock-before-derivation','write-certificate-derivation-validator-swap','write-certificate-derivation-validator-preswap']){
  if(caseFilter&&!caseFilter.includes(mode))continue;
  // A realm clock (stable for the validator capture) whose construction inside
  // the write's root encode installs a one-shot JSON.stringify that changes one
  // inline string: a transient native swap no point check between validation
  // and commit can observe.
  const swap={armed:false,fired:0,realm:null};
  class EncodeClock extends Date{constructor(...args){super(...args);if(swap.armed&&new Error().stack.includes('encodeCheckpoint')){swap.armed=false;const json=swap.realm.JSON,original=json.stringify;json.stringify=function(value,...rest){if(value==='Exact written title'){json.stringify=original;swap.fired++;return original.call(this,'Exact swapped title',...rest);}return original.call(this,value,...rest);};}}}
  const swapped=mode==='write-certificate-encode-native-swap',clock={frozen:null};class WriteClock extends Date{static now(){return clock.frozen??super.now();}}
  const r=projectStoreRuntime({sourceOverrides:{'project-store.js':source},environment:{__rootCounts:{restore:0,digest:0,static:0,derived:0},...(swapped?{Date:EncodeClock}:mode==='write-certificate-clock-before-derivation'?{Date:WriteClock}:{})},storageWorker:false});swap.realm=r.runtime;
  let p=await r.store.createProject({commandId:'PRIVATE-WRITE-ROOT-'+mode});
  if(swapped){r.engine.recalculate(p);p=await r.store.writeProject(p,{expectedProjectRevision:p.revision});swap.armed=true;p.job.JOB_TITLE='Exact written title';p.job.EXACT_USER_OBJECTIVE_VERBATIM='Independent written content '.repeat(300);}
  else p.job.JOB_TITLE='Exact written title '+'independent written content '.repeat(300);
  // A stored file outside the project's current scope: the write observes no
  // custody for it, so its derivation reads UNKNOWN, while the root retains
  // its bytes and a checkpoint deriving under the root's artifacts reads TRUE.
  const selectedText='Exact file stored before the write.',selected=mode==='write-certificate-custody-differs'?r.copy({jobId:p.job.JOB_ID,artifactId:'WRITE-CUSTODY-SELECTION',filename:'selected.txt',byteSize:Buffer.byteLength(selectedText),sha256:createHash('sha256').update(selectedText).digest('hex')}):null;
  if(selected){await r.store.putArtifact({artifactId:selected.artifactId,jobId:p.job.JOB_ID,filename:selected.filename,mediaType:'text/plain',blob:new Blob([selectedText])});assert.equal(r.store.artifactCustodyState(selected),'TRUE','RETAINED_ROOT_WRITE_CUSTODY_FIXTURE_ORACLE');}
  let derivationAnswer=null;if(selected)r.runtime.__duringDerived=()=>{derivationAnswer=r.store.artifactCustodyState(selected);};
  // A validator definition replaced only while the write derives (restored
  // after the write), or replaced after the write's static validation by an
  // equivalent definition that restores itself while the derivation reads it:
  // either derivation ran under validators other than the root's.
  const writeEngine=r.runtime.closedLoopWorkflowEngine,validatorSwap={fired:0};
  if(mode==='write-certificate-derivation-validator-swap')r.runtime.__duringDerived=()=>{if(validatorSwap.fired++)return;r.runtime.closedLoopWorkflowEngine=Object.freeze({...writeEngine});};
  if(mode==='write-certificate-derivation-validator-preswap')r.runtime.__afterEncode=()=>{if(validatorSwap.fired++)return;r.runtime.closedLoopWorkflowEngine=Object.freeze({...writeEngine,compareApplicationProjection(...args){r.runtime.closedLoopWorkflowEngine=writeEngine;validatorSwap.restored=true;return writeEngine.compareApplicationProjection(...args);}});};
  r.engine.recalculate(p);try{p=await r.store.writeProject(p,{expectedProjectRevision:p.revision});}finally{delete r.runtime.__duringDerived;delete r.runtime.__afterEncode;r.runtime.closedLoopWorkflowEngine=writeEngine;}
  if(mode==='write-certificate-derivation-validator-swap')assert.equal(validatorSwap.fired>=1,true,'RETAINED_ROOT_WRITE_DERIVATION_VALIDATOR_FIXTURE_ORACLE');
  if(mode==='write-certificate-derivation-validator-preswap')assert.equal(validatorSwap.restored,true,'RETAINED_ROOT_WRITE_DERIVATION_VALIDATOR_FIXTURE_ORACLE: the replaced definition was read by the write derivation');
  if(selected){assert.equal(derivationAnswer,'UNKNOWN','RETAINED_ROOT_WRITE_CUSTODY_FIXTURE_ORACLE');const state=await r.store.historyList(p.job.JOB_ID),written=state.entries.find(entry=>entry.id===state.activeId);assert.ok(written&&!written.projectReference,'RETAINED_ROOT_WRITE_CUSTODY_FIXTURE_ORACLE');assert.ok((await r.store.listArtifacts(p.job.JOB_ID)).some(row=>row.artifactId===selected.artifactId),'RETAINED_ROOT_WRITE_CUSTODY_FIXTURE_ORACLE');}
  assert.equal((await r.store.readProject(p.job.JOB_ID)).projectSha256,p.projectSha256);assert.ok(r.runtime.__rootProof(),'RETAINED_ROOT_WRITE_CERTIFICATE_PUBLISHED_ORACLE');
  const view=name=>r.copy({activeStage:1,activeView:name,drafts:{'#exact':{value:name+' exact draft'}},scrollX:0,scrollY:17});
  const save=name=>r.store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,view:view(name)});
  const meta=r.rows.get('meta'),historyKey='recovery:'+p.job.JOB_ID,state=await r.store.historyList(p.job.JOB_ID),root=state.entries.find(entry=>entry.id===state.activeId);
  // The History state names the root's parts by digest; its record keeps them.
  const rootRecord=root&&meta.get(historyKey+':snapshot:'+root.id)?.value;
  assert.ok(root&&!root.projectReference&&rootRecord?.projectParts?.entries?.length,'RETAINED_ROOT_WRITE_FIXTURE_ORACLE');
  const before={...r.runtime.__rootCounts},rows=()=>r.copy([...r.rows].map(([name,map])=>[name,[...map]]));
  // The swap changed only the stored root bytes; the certified value is intact.
  // Decoding those bytes at the first use refuses them as a cold decode does.
  if(swapped){
   assert.equal(swap.fired,1,'RETAINED_ROOT_WRITE_SWAP_FIXTURE_ORACLE');const snapshot=rows();
   for(const name of ['Workflow','Records'])await assert.rejects(()=>save(name),e=>e.code==='PROJECT_INTEGRITY_FAILED','RETAINED_ROOT_WRITE_BYTES_ORACLE: a save after a write whose stored root bytes differ from its certified value is refused');
   assert.deepEqual(rows(),snapshot,'Rejected saves preserve exact state');await assert.rejects(()=>r.store.readHistoryView(p.job.JOB_ID,root.id),e=>e.code==='PROJECT_INTEGRITY_FAILED','The stored root is refused cold as well');
   cases.push({mode,result:'PASS',error:'PROJECT_INTEGRITY_FAILED',noCheckpointReturned:true,exactStatePreserved:true});continue;
  }
  if(mode==='write-certificate-corrupt-part'||mode==='write-certificate-corrupt-root'){
   const row=mode==='write-certificate-corrupt-part'?meta.get(historyKey+':bytes:'+rootRecord.projectParts.entries[0].sha256):meta.get(historyKey+':snapshot:'+root.id),expected=mode==='write-certificate-corrupt-part'?'HISTORY_FILE_INTEGRITY_FAILED':'HISTORY_SNAPSHOT_INTEGRITY_FAILED';
   assert.ok(row,'RETAINED_ROOT_WRITE_TAMPER_TARGET_ORACLE');row.value.blob=new Blob(['X'.repeat(row.value.blob.size)]);const snapshot=rows();
   await assert.rejects(()=>save('Workflow'),e=>e.code===expected,'RETAINED_ROOT_WRITE_CERTIFICATE_BYTES_ORACLE '+mode);assert.deepEqual(rows(),snapshot,'Rejected save preserves exact state');assert.ok(r.runtime.__rootProof()===undefined,'Rejected save publishes no proof');
   cases.push({mode,result:'PASS',error:expected,noCheckpointReturned:true,noProofPublished:true,exactStatePreserved:true});continue;
  }
  const originalEngine=r.runtime.closedLoopWorkflowEngine;if(mode==='write-certificate-changed-validator')vm.runInContext('globalThis.closedLoopWorkflowEngine=Object.freeze({...globalThis.closedLoopWorkflowEngine});',r.runtime);
  // A clock reading earlier than the write's derivation.
  if(mode==='write-certificate-clock-before-derivation')clock.frozen=Date.now()-3600000;
  try{await save('Project');}finally{clock.frozen=null;}const first=Object.fromEntries(Object.entries(r.runtime.__rootCounts).map(([key,value])=>[key,value-before[key]]));
  assert.equal(first.restore,1,'RETAINED_ROOT_WRITE_BYTES_DECODED_ORACLE: the first save after a write decodes its stored root bytes once');assert.equal(first.digest,0,'RETAINED_ROOT_WRITE_CERTIFICATE_DIGEST_ORACLE');
  if(mode==='write-certificate-warm')assert.equal(first.derived,0,"RETAINED_ROOT_WRITE_CERTIFICATE_DERIVATION_CARRIED_ORACLE: the first save after a write carries the write's own derivation when the root's artifacts reproduce the custody it read");
  else if(mode==='write-certificate-custody-differs')assert.equal(first.derived,1,'RETAINED_ROOT_WRITE_CERTIFICATE_DERIVATION_REPRODUCED_ORACLE: a write derivation whose custody answers the root does not reproduce is validated once');
  else if(mode==='write-certificate-clock-before-derivation')assert.equal(first.derived,1,'RETAINED_ROOT_WRITE_CERTIFICATE_CLOCK_ORACLE: a save before the write derivation time validates the derivation once');
  else if(mode==='write-certificate-derivation-validator-swap'||mode==='write-certificate-derivation-validator-preswap')assert.equal(first.derived,1,'RETAINED_ROOT_WRITE_DERIVATION_VALIDATOR_ORACLE: a write derivation run under validators other than the root\'s is validated once');
  else assert.equal(first.derived,1,'RETAINED_ROOT_WRITE_CERTIFICATE_DERIVED_ONCE_ORACLE: a replaced validator definition validates the written root derivation once');
  if(mode==='write-certificate-changed-validator'){assert.ok(first.static>=1,'RETAINED_ROOT_VALIDATOR_ORACLE: a replaced validator definition re-validates the written root statically');r.runtime.closedLoopWorkflowEngine=originalEngine;}
  else assert.equal(first.static,0,'RETAINED_ROOT_WRITE_CERTIFICATE_STATIC_CARRIED_ORACLE');
  const second={...r.runtime.__rootCounts},id=await save('Workflow'),next=Object.fromEntries(Object.entries(r.runtime.__rootCounts).map(([key,value])=>[key,value-second[key]]));
  if(mode==='write-certificate-warm')assert.deepEqual(next,{restore:0,digest:0,static:0,derived:0},'RETAINED_ROOT_WRITE_CERTIFICATE_WARM_ORACLE');
  assert.equal((await r.store.readHistoryView(p.job.JOB_ID,id)).drafts['#exact'].value,'Workflow exact draft');assert.equal((await r.store.readProject(p.job.JOB_ID)).job.JOB_TITLE,p.job.JOB_TITLE);
  cases.push({mode,result:'PASS',counts:first,nextCounts:next,exactDraftAndProjectPreserved:true});
 }
 // A write never carries a derivation whose subject holds a prompt requiring
 // retained run context: that context's retention state is observed outside
 // the custody answers a root can reproduce, so the root's first save derives.
 // The actual binding owner is asked directly under the store's own captured
 // validators and the actual prompt engine predicate.
 {const mode='write-derivation-retained-run-context';if(!caseFilter||caseFilter.includes(mode)){
  const r=projectStoreRuntime({sourceOverrides:{'project-store.js':source},environment:{__rootCounts:{restore:0,digest:0,static:0,derived:0}},storageWorker:false}),p=await r.store.createProject({commandId:'PRIVATE-RUN-CONTEXT-ROOT'});
  const legacy=r.copy({stage:11,operation:'EXECUTE_RUN',instructionId:'LEGACY-RUN-CONTEXT',promptEngineVersion:'closed-loop-prompt-engine/legacy-run-context',contextManifest:{promptContext:{attachments:[{path:'context/run.txt',filename:'run.txt',mediaType:'text/plain',sha256:'0'.repeat(64),byteSize:1}]}}});
  assert.equal(r.runtime.closedLoopPromptEngine.requiresRetainedRunContext(legacy),true,'RETAINED_ROOT_RUN_CONTEXT_FIXTURE_ORACLE');
  const derivation=subject=>({subject,answers:[],reproducible:true,strict:true}),ordinary=r.copy(p),withContext=r.copy(p);withContext.projectData.generatedPrompts=[...(withContext.projectData.generatedPrompts||[]),legacy];
  // Compare presence only: a binding holds the validator graph, which an
  // assertion message must never render.
  assert.equal(r.runtime.__writeDerivationBinding(derivation(ordinary))!==null,true,'RETAINED_ROOT_RUN_CONTEXT_FIXTURE_ORACLE: an ordinary strict derivation binds');
  assert.equal(r.runtime.__writeDerivationBinding(derivation(withContext))===null,true,'RETAINED_ROOT_WRITE_DERIVATION_RUN_CONTEXT_ORACLE: a derivation whose subject requires retained run context is never carried');
  cases.push({mode,result:'PASS',ordinaryBound:true,runContextBound:false});
 }}
 // Each guard of the carried validation, exercised by the one case that needs it.
 for(const mode of ['no-append-validator-during-read','tolerated-derivation-not-carried','clock-before-derivation','no-append-different-manifest','validator-swap-during-validation','changed-native-dependency']){
  if(caseFilter&&!caseFilter.includes(mode))continue;
  const clock={frozen:null};class ObservationClock extends Date{static now(){return clock.frozen??super.now();}}
  const r=projectStoreRuntime({sourceOverrides:{'project-store.js':source},environment:{__rootCounts:{restore:0,digest:0,static:0,derived:0},...(mode==='clock-before-derivation'?{Date:ObservationClock}:{})},storageWorker:false});
  let p=await r.store.createProject({commandId:'PRIVATE-GUARD-ROOT-'+mode});p.job.JOB_TITLE='Exact guarded title '+'independent guarded content '.repeat(300);r.engine.recalculate(p);
  // These guards act on the derivation of the written root's first save: the
  // write's derivation reads a custody identity (an accessor) that cannot be
  // asked again exactly, so the write carries no derivation to its root.
  const unaskable=Object.defineProperty(r.copy({jobId:p.job.JOB_ID,artifactId:'GUARD-UNASKABLE',byteSize:0,sha256:'0'.repeat(64)}),'filename',{get:()=>'unaskable.txt',enumerable:true});
  r.runtime.__duringDerived=()=>{r.store.artifactCustodyState(unaskable);};
  try{p=await r.store.writeProject(p,{expectedProjectRevision:p.revision});}finally{delete r.runtime.__duringDerived;}await r.store.readProject(p.job.JOB_ID);
  const view=name=>r.copy({activeStage:1,activeView:name,drafts:{'#exact':{value:name+' exact draft'}},scrollX:0,scrollY:17});
  const save=name=>r.store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,view:view(name)});
  const counted=async action=>{const start={...r.runtime.__rootCounts};await action();return Object.fromEntries(Object.entries(r.runtime.__rootCounts).map(([key,value])=>[key,value-start[key]]));};
  const replaceEngine=()=>vm.runInContext('globalThis.closedLoopWorkflowEngine=Object.freeze({...globalThis.closedLoopWorkflowEngine});',r.runtime),engine=r.runtime.closedLoopWorkflowEngine;
  const writtenRoot=r.runtime.__rootProof();assert.ok(writtenRoot,'RETAINED_ROOT_GUARD_FIXTURE_ORACLE');let reached=false;const observed={};
  // The test realm's own stack limit (not the store realm's validator Error).
  const inCommit=()=>{const limit=Error.stackTraceLimit;Error.stackTraceLimit=200;try{return new Error().stack.includes('commitRootCheckpoint');}finally{Error.stackTraceLimit=limit;}};
  // A strict derivation the commit tolerated instead is never carried.
  if(mode==='tolerated-derivation-not-carried')r.runtime.__tolerateDerivation=()=>{if(reached||!inCommit())return false;reached=true;return true;};
  // Validators replaced while the commit validates the derivation leave no
  // carried validation, even once the original definitions return.
  if(mode==='validator-swap-during-validation')r.runtime.__duringDerived=()=>{if(reached||!inCommit())return;reached=true;replaceEngine();};
  try{observed.first=await counted(()=>save('Project'));}finally{delete r.runtime.__duringDerived;delete r.runtime.__tolerateDerivation;r.runtime.closedLoopWorkflowEngine=engine;}
  if(mode==='tolerated-derivation-not-carried'||mode==='validator-swap-during-validation')assert.equal(reached,true,'RETAINED_ROOT_GUARD_HOOK_ORACLE '+mode);
  else assert.deepEqual(observed.first,{restore:1,digest:0,static:0,derived:1},'RETAINED_ROOT_GUARD_FIXTURE_ORACLE: the written root is decoded once and derived-validated once');
  if(mode==='tolerated-derivation-not-carried'){observed.next=await counted(()=>save('Workflow'));assert.ok(observed.next.derived>=1,'RETAINED_ROOT_TOLERATED_DERIVATION_ORACLE: a tolerated derivation is validated again');assert.equal(observed.next.static,0,'RETAINED_ROOT_TOLERATED_DERIVATION_ORACLE: static validation is still carried');}
  if(mode==='validator-swap-during-validation'){observed.next=await counted(()=>save('Workflow'));assert.ok(observed.next.static>=1,'RETAINED_ROOT_VALIDATION_SWAP_ORACLE: static validation is repeated');assert.ok(observed.next.derived>=1,'RETAINED_ROOT_VALIDATION_SWAP_ORACLE: derived validation is repeated');}
  // Validators replaced during an unchanged view's read are validated again
  // under the current definitions before the retained checkpoint is reused.
  if(mode==='no-append-validator-during-read'){
   r.runtime.__duringRetainedRead=()=>{if(reached)return;reached=true;replaceEngine();};
   try{observed.next=await counted(()=>save('Project'));}finally{delete r.runtime.__duringRetainedRead;r.runtime.closedLoopWorkflowEngine=engine;}
   assert.equal(reached,true,'RETAINED_ROOT_GUARD_HOOK_ORACLE '+mode);assert.ok(observed.next.static>=1,'RETAINED_ROOT_NO_APPEND_REVALIDATION_ORACLE: static validation is repeated');assert.ok(observed.next.derived>=1,'RETAINED_ROOT_NO_APPEND_REVALIDATION_ORACLE: derived validation is repeated');
  }
  // A derivation validated at a later clock reading is not carried backwards.
  if(mode==='clock-before-derivation'){
   observed.warm=await counted(()=>save('Records'));assert.deepEqual(observed.warm,{restore:0,digest:0,static:0,derived:0},'RETAINED_ROOT_GUARD_FIXTURE_ORACLE: the observation clock keeps carried validation');
   clock.frozen=r.runtime.__rootProof().derivedAt-1;
   try{observed.retained=await counted(()=>save('Records'));assert.ok(observed.retained.derived>=1,'RETAINED_ROOT_RETAINED_CLOCK_ORACLE: an unchanged view before the derivation time validates it again');
    observed.next=await counted(()=>save('Workflow'));assert.ok(observed.next.derived>=1,'RETAINED_ROOT_DERIVATION_CLOCK_ORACLE: a view before the derivation time validates it again');}
   finally{clock.frozen=null;}
   assert.equal(observed.retained.static+observed.next.static,0,'Static validation is not time dependent and stays carried');
  }
  // A retained checkpoint with another file inventory than its root validates
  // the root's derivation under that inventory.
  if(mode==='no-append-different-manifest'){
   await r.store.putArtifact({artifactId:'GUARD-SELECTION',jobId:p.job.JOB_ID,filename:'selected.txt',mediaType:'text/plain',blob:new Blob(['Exact guarded file selection.'])});
   observed.appended=await counted(()=>save('Workflow'));assert.equal(observed.appended.restore+observed.appended.digest,0,'RETAINED_ROOT_GUARD_FIXTURE_ORACLE: the root stays retained');
   const state=await r.store.historyList(p.job.JOB_ID),active=state.entries.find(entry=>entry.id===state.activeId);assert.notEqual(active.artifactManifestSha256,r.runtime.__rootProof().descriptor.artifactManifestSha256,'RETAINED_ROOT_GUARD_FIXTURE_ORACLE: distinct inventories');
   observed.next=await counted(()=>save('Workflow'));assert.equal((await r.store.historyList(p.job.JOB_ID)).entries.length,state.entries.length,'RETAINED_ROOT_GUARD_FIXTURE_ORACLE: unchanged view appends nothing');
   assert.ok(observed.next.derived>=1,'RETAINED_ROOT_MANIFEST_ORACLE: another inventory validates the derivation');assert.equal(observed.next.static,0,'RETAINED_ROOT_MANIFEST_ORACLE: static validation stays carried');
  }
  // A replaced native the validators call is a changed validator.
  if(mode==='changed-native-dependency'){
   vm.runInContext('globalThis.__originalBigInt=BigInt;globalThis.BigInt=new Proxy(BigInt,{});',r.runtime);
   try{observed.next=await counted(()=>save('Workflow'));}finally{vm.runInContext('globalThis.BigInt=globalThis.__originalBigInt;delete globalThis.__originalBigInt;',r.runtime);}
   assert.ok(observed.next.static>=1,'RETAINED_ROOT_NATIVE_VALIDATOR_ORACLE: static validation is repeated');assert.ok(observed.next.derived>=1,'RETAINED_ROOT_NATIVE_VALIDATOR_ORACLE: derived validation is repeated');
  }
  assert.equal(observed.next.restore+observed.next.digest,0,'RETAINED_ROOT_GUARD_FIXTURE_ORACLE: guards repeat validation, never reconstruction');
  const id=await save('Final');assert.equal((await r.store.readHistoryView(p.job.JOB_ID,id)).drafts['#exact'].value,'Final exact draft');assert.equal((await r.store.readProject(p.job.JOB_ID)).job.JOB_TITLE,p.job.JOB_TITLE);
  cases.push({mode,result:'PASS',counts:observed,exactDraftAndProjectPreserved:true});
 }
 // A write certificate's first check decodes privately and reports its own read
 // failures. A retained part's bytes swapped while the write encodes them
 // (through a stable realm crypto.randomUUID; the part's one canonical pass
 // gives both its bytes and its digest) cannot be masked by a clone swap
 // during the first decode, and a failing part read refuses with its own code
 // before any cold validation.
 for(const mode of ['write-certificate-decode-clone-swap','write-certificate-session-decode-clone-swap','write-certificate-transient-part-read']){
  if(caseFilter&&!caseFilter.includes(mode))continue;
  const control={armedDecode:false,decodeFired:0,realm:null},target='Independent written content '.repeat(300),swapped='Independent swapped content '.repeat(300);
  class DecodeClock extends Date{static now(){const realm=control.realm;if(control.armedDecode&&realm){const limit=Error.stackTraceLimit;Error.stackTraceLimit=200;const stack=new Error().stack;Error.stackTraceLimit=limit;if(stack.includes('restoreHistoryProject')){control.armedDecode=false;const original=realm.structuredClone;realm.structuredClone=function(value){if(value===swapped){realm.structuredClone=original;control.decodeFired++;return target;}return original(value);};}}return super.now();}}
  const swapping=mode!=='write-certificate-transient-part-read';
  const r=projectStoreRuntime({sourceOverrides:{'project-store.js':source},environment:{__rootCounts:{restore:0,digest:0,static:0,derived:0},...(swapping?{Date:DecodeClock}:{})},storageWorker:false});control.realm=r.runtime;
  let p=await r.store.createProject({commandId:'PRIVATE-WRITE-CHECK-'+mode});r.engine.recalculate(p);p=await r.store.writeProject(p,{expectedProjectRevision:p.revision});
  p.job.EXACT_USER_OBJECTIVE_VERBATIM=target;r.engine.recalculate(p);
  if(swapping)vm.runInContext(`(()=>{const c=globalThis.crypto,uuid=c.randomUUID;globalThis.__encodeSwaps=0;globalThis.__encodeArmed=false;
   const target=${JSON.stringify('Independent written content ')}.repeat(300),swapped=${JSON.stringify('Independent swapped content ')}.repeat(300);
   c.randomUUID=function randomUUID(){if(globalThis.__encodeArmed&&/encodeCheckpoint/.test(new Error().stack)){globalThis.__encodeArmed=false;const json=JSON,original=json.stringify;json.stringify=function stringify(value,...rest){if(value===target){globalThis.__encodeSwaps++;if(globalThis.__encodeSwaps===1)json.stringify=original;return original.call(this,swapped,...rest);}return original.call(this,value,...rest);};}return uuid.call(c);};})();`,r.runtime);
  if(swapping)r.runtime.__encodeArmed=true;
  p=await r.store.writeProject(p,{expectedProjectRevision:p.revision});
  const view=name=>r.copy({activeStage:1,activeView:name,drafts:{'#exact':{value:name+' exact draft'}},scrollX:0,scrollY:17});
  const rows=()=>r.copy([...r.rows].map(([name,map])=>[name,[...map]]));
  if(swapping){
   assert.equal(r.runtime.__encodeSwaps,1,'RETAINED_ROOT_DECODE_SWAP_FIXTURE_ORACLE');const snapshot=rows();control.armedDecode=true;
   const save=mode==='write-certificate-session-decode-clone-swap'?()=>r.store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,sessionId:'decode-swap-session'}):()=>r.store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,view:view('Workflow')});
   try{await assert.rejects(save,e=>e.code==='PROJECT_INTEGRITY_FAILED','RETAINED_ROOT_PRIVATE_DECODE_ORACLE: a clone swap during the first decode cannot mask stored bytes that differ from the certified value');}finally{control.armedDecode=false;}
   assert.equal(control.decodeFired,0,'RETAINED_ROOT_PRIVATE_DECODE_ORACLE: the first decode copies parts privately');assert.deepEqual(rows(),snapshot,'Rejected save preserves exact state');
   cases.push({mode,result:'PASS',error:'PROJECT_INTEGRITY_FAILED',exactStatePreserved:true});continue;
  }
  // A part read failing once inside the first check of an unchanged view.
  const open=r.runtime.openStorageTransaction;let armed=true,failed=0;
  r.runtime.openStorageTransaction=async(names,transactionMode)=>{const tx=await open(names,transactionMode),objectStore=tx.objectStore;tx.objectStore=name=>{const store=objectStore(name);if(name!=='meta')return store;const get=store.get;return {...store,get:key=>{if(armed&&String(key).includes(':bytes:')){armed=false;failed++;return {get result(){throw Object.assign(new Error('Injected transient part read failure.'),{code:'INJECTED_PART_READ_FAILURE'});}};}return get(key);}};};return tx;};
  const snapshot=rows(),start={...r.runtime.__rootCounts};
  try{await assert.rejects(()=>r.store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,sessionId:'transient-part-read'}),e=>e.code==='INJECTED_PART_READ_FAILURE','RETAINED_ROOT_WRITE_CHECK_ERROR_ORACLE: a failing part read refuses with its own code');}finally{r.runtime.openStorageTransaction=open;}
  const counts=Object.fromEntries(Object.entries(r.runtime.__rootCounts).map(([key,value])=>[key,value-start[key]]));
  assert.equal(failed,1,'RETAINED_ROOT_WRITE_CHECK_FIXTURE_ORACLE');assert.deepEqual({static:counts.static,derived:counts.derived},{static:0,derived:0},'RETAINED_ROOT_WRITE_CHECK_ERROR_ORACLE: no cold validation runs before refusing');assert.deepEqual(rows(),snapshot,'Rejected save preserves exact state');
  await r.store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,sessionId:'transient-part-read-retry'});
  cases.push({mode,result:'PASS',error:'INJECTED_PART_READ_FAILURE',counts,retrySucceeded:true});
 }
 // Guards of the write certificate and of the final commit gate.
 for(const mode of ['write-hook-mutation-during-encode','digest-label-during-commit','canonical-write-validator-swap','operational-write-validator-swap','changed-validator-internal-slot']){
  if(caseFilter&&!caseFilter.includes(mode))continue;
  const r=projectStoreRuntime({sourceOverrides:{'project-store.js':source},environment:{__rootCounts:{restore:0,digest:0,static:0,derived:0}},storageWorker:false});
  let p=await r.store.createProject({commandId:'PRIVATE-WRITE-GUARD-'+mode});p.job.JOB_TITLE='Exact guarded title '+'independent guarded content '.repeat(300);r.engine.recalculate(p);
  const view=name=>r.copy({activeStage:1,activeView:name,drafts:{'#exact':{value:name+' exact draft'}},scrollX:0,scrollY:17});
  const save=(name,operationId=undefined)=>r.store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,view:view(name),...(operationId?{operationId}:{})});
  const rows=()=>r.copy([...r.rows].map(([name,map])=>[name,[...map]]));const engine=r.runtime.closedLoopWorkflowEngine;
  const counted=async action=>{const start={...r.runtime.__rootCounts};await action();return Object.fromEntries(Object.entries(r.runtime.__rootCounts).map(([key,value])=>[key,value-start[key]]));};
  // A hook that received the exposed canonical value during the write's custody
  // checks changes it while the root is encoded and restores it afterwards. The
  // write encodes a private copy, so its stored root stays the validated value.
  if(mode==='write-hook-mutation-during-encode'){
   p=await r.store.writeProject(p,{expectedProjectRevision:p.revision});const next=r.copy(p);next.job.JOB_TITLE='Exact second title '+'independent guarded content '.repeat(300);r.engine.recalculate(next);
   let restore=null,reached=0;r.runtime.__duringEncode=exposed=>{if(restore||exposed?.job?.JOB_TITLE!==next.job.JOB_TITLE)return;reached++;const job=exposed.job,title=job.JOB_TITLE;job.JOB_TITLE='Hook changed title during encode';restore=()=>{job.JOB_TITLE=title;};};
   r.runtime.__afterEncode=()=>{if(restore){restore();restore=null;}};
   try{p=await r.store.writeProject(next,{expectedProjectRevision:p.revision});}finally{delete r.runtime.__duringEncode;delete r.runtime.__afterEncode;}
   assert.equal(reached,1,'RETAINED_ROOT_PRIVATE_ENCODE_FIXTURE_ORACLE');
   const state=await r.store.historyList(p.job.JOB_ID),root=state.entries.find(entry=>entry.id===state.activeId);
   let id;try{id=await save('Workflow');}catch(error){assert.fail('RETAINED_ROOT_PRIVATE_ENCODE_ORACLE: the write stored a root that its next save refuses: '+error.code);}
   try{await r.store.readHistoryView(p.job.JOB_ID,root.id);}catch(error){assert.fail('RETAINED_ROOT_PRIVATE_ENCODE_ORACLE: the stored root is refused cold: '+error.code);}
   assert.equal((await r.store.readProject(p.job.JOB_ID)).job.JOB_TITLE,next.job.JOB_TITLE);
   assert.equal((await r.store.readHistoryView(p.job.JOB_ID,id)).drafts['#exact'].value,'Workflow exact draft');
   cases.push({mode,result:'PASS',exactDraftAndProjectPreserved:true});continue;
  }
  p=await r.store.writeProject(p,{expectedProjectRevision:p.revision});await r.store.readProject(p.job.JOB_ID);
  // A project label changed inside the checkpoint transaction, after the
  // stored row matched it, cannot reach the commit or its storage receipt.
  if(mode==='digest-label-during-commit'){
   await save('Project');let retained=null,transactionOpen=false,mutated=null;
   const wrapped={};for(const [key,value] of Object.entries(engine))wrapped[key]=typeof value==='function'?function(...args){
    if(!retained&&key==='recordsForCurrentScope'&&args[1]==='artifacts'&&args[0]?.job?.JOB_ID===p.job.JOB_ID)retained=args[0];
    else if(retained&&transactionOpen&&!mutated&&args[0]!==retained){mutated=key;retained.projectSha256='0'.repeat(64);}
    return Reflect.apply(value,engine,args);}:value;
   r.runtime.closedLoopWorkflowEngine=Object.freeze(wrapped);const open=r.runtime.openStorageTransaction;
   r.runtime.openStorageTransaction=async(names,mode)=>{if(retained&&mode==='readwrite'&&Array.isArray(names)&&names.includes('artifacts'))transactionOpen=true;return open(names,mode);};
   const snapshot=rows();
   try{await assert.rejects(()=>save('Workflow','OP-GATE-DIGEST-LABEL'),e=>e.code==='HISTORY_VERSION_MISMATCH','RETAINED_ROOT_GATE_DIGEST_LABEL_ORACLE: a changed digest label refuses the commit');}
   finally{r.runtime.closedLoopWorkflowEngine=engine;r.runtime.openStorageTransaction=open;}
   assert.ok(mutated,'RETAINED_ROOT_GATE_DIGEST_LABEL_FIXTURE_ORACLE');assert.equal(r.rows.get('meta').get('storageOperation:OP-GATE-DIGEST-LABEL'),undefined,'RETAINED_ROOT_GATE_DIGEST_LABEL_ORACLE: no storage receipt');assert.deepEqual(rows(),snapshot,'Rejected save preserves exact state');
   cases.push({mode,result:'PASS',error:'HISTORY_VERSION_MISMATCH',noReceipt:true,exactStatePreserved:true});continue;
  }
  // A validator replaced at the end of a write's validation is not the
  // validator the write ran under: the write publishes no certificate, and
  // the next save validates under the current, refusing definition.
  if(mode==='canonical-write-validator-swap'||mode==='operational-write-validator-swap'){
   const next=r.copy(p);if(mode==='canonical-write-validator-swap'){next.job.JOB_TITLE='Exact swapped validator title '+'independent guarded content '.repeat(300);r.engine.recalculate(next);}else r.engine.addHistory(next,'SYNTHETIC_VALIDATOR_SWAP',{scope:'continuation'});
   let reached=false;r.runtime.__afterWriteValidation=()=>{if(reached)return;reached=true;vm.runInContext("globalThis.closedLoopWorkflowEngine=Object.freeze({...globalThis.closedLoopWorkflowEngine,validateApplicationProjection:()=>({valid:false,issues:[{code:'CONTROL_CURRENT_DEFINITION',message:'Independent current definition refusal'}]})});",r.runtime);};
   try{
    p=await r.store.writeProject(next,{...(mode==='operational-write-validator-swap'?{operational:true,expectedStateSha256:p.projectSha256}:{}),expectedProjectRevision:p.revision});
    assert.equal(reached,true,'RETAINED_ROOT_WRITE_VALIDATOR_FIXTURE_ORACLE');assert.ok(r.runtime.__rootProof()===undefined,'RETAINED_ROOT_WRITE_VALIDATOR_CAPTURE_ORACLE: a write whose validators changed during validation publishes no certificate');
    const snapshot=rows();await assert.rejects(()=>save('Workflow'),e=>e.code==='PROJECT_INTEGRITY_FAILED','RETAINED_ROOT_WRITE_VALIDATOR_CAPTURE_ORACLE: the next save validates under the current definition');assert.deepEqual(rows(),snapshot,'Rejected save preserves exact state');
   }finally{delete r.runtime.__afterWriteValidation;r.runtime.closedLoopWorkflowEngine=engine;}
   cases.push({mode,result:'PASS',error:'PROJECT_INTEGRITY_FAILED',noProofPublished:true,exactStatePreserved:true});continue;
  }
  // A validator's internal slot (a RegExp pattern recompiled in place, here to an
  // equivalent pattern) is part of its definition.
  if(mode==='changed-validator-internal-slot'){
   await save('Project');const pattern=r.runtime.closedLoopWorkflowSchema.TARGET_PRODUCT_REFERENCE_PATTERN,source=pattern.source,flags=pattern.flags;
   assert.ok(pattern instanceof r.runtime.RegExp||Object.prototype.toString.call(pattern)==='[object RegExp]','RETAINED_ROOT_INTERNAL_SLOT_FIXTURE_ORACLE');
   let counts;pattern.compile('(?:'+source+')',flags);try{counts=await counted(()=>save('Workflow'));}finally{pattern.compile(source,flags);}
   assert.ok(counts.static>=1,'RETAINED_ROOT_INTERNAL_SLOT_ORACLE: a recompiled validator pattern re-validates statically');assert.ok(counts.derived>=1,'RETAINED_ROOT_INTERNAL_SLOT_ORACLE: a recompiled validator pattern re-validates the derivation');
   const id=await save('Final');assert.equal((await r.store.readHistoryView(p.job.JOB_ID,id)).drafts['#exact'].value,'Final exact draft');
   cases.push({mode,result:'PASS',counts,exactDraftAndProjectPreserved:true});continue;
  }
 }
 return {status:'PASS',fault,cases,sourceSha256:createHash('sha256').update(original).digest('hex'),boundary:'Small actual production store through explicit transaction adapter; native transaction lifetime is verified separately'};
}
if(process.argv[1]?.endsWith('test-retained-root-continuation.mjs')){const start=performance.now();const result=await verifyRetainedRootContinuation();result.elapsedMs=performance.now()-start;const output=JSON.stringify(result,null,2)+'\n';if(process.env.RETAINED_ROOT_REPORT_PATH)fs.writeFileSync(process.env.RETAINED_ROOT_REPORT_PATH,output);console.log(output);}
