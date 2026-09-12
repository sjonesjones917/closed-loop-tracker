import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const assert=(value,message)=>{if(!value)throw new Error(message);};
const app=fs.readFileSync('app-core.js','utf8'),store=fs.readFileSync('project-store.js','utf8'),ingestion=fs.readFileSync('response-ingestion.js','utf8'),engineSource=fs.readFileSync('workflow-engine.js','utf8'),pages=fs.readFileSync('.github/workflows/pages.yml','utf8'),html=fs.readFileSync('index.html','utf8'),browserExtra=fs.readFileSync('verify-browser-extra.mjs','utf8');
for(const token of ['renameCurrentProject','duplicateCurrentProject','archiveCurrentProject','restoreArchivedProject','downloadProjectPackage','verifyStoredFilesNow','discardCurrentAttempt','prepareReplacementAttempt','reopenHumanBlocker'])assert(app.includes(token),`Missing lifecycle action ${token}.`);
for(const token of ['project-management','project-danger-zone','Start from copy','Create backup now','Verify stored files now','View exact evidence / provenance','Clear unsaved response','Discard pending attempt','Prepare replacement attempt'])assert(app.includes(token),`Missing lifecycle UI ${token}.`);
assert(!app.includes('dismissedProposalIds')&&ingestion.includes('function abandon(project,proposalId')&&ingestion.includes("'ABANDONED_RESPONSE'")&&app.includes('canonical accepted work changed: NO'),'Discarded pending attempts must be auditable without changing accepted canonical work.');
assert(store.includes('verifyProjectArtifacts')&&store.includes('MISSING_STORED_BLOB')&&store.includes('CANONICAL_BLOB_IDENTITY_MISMATCH'),'Stored-file verification must reconcile canonical artifact identities to actual Blob custody.');
assert(engineSource.includes('reconcileArtifactCustodyVerification')&&engineSource.includes("source:'APPLICATION'")&&engineSource.includes("project.release.authorization='NOT AUTHORIZED'"),'Artifact custody failure must be application-owned and revoke release authorization.');
assert(app.includes("integrity:verification?(verification.verified?'VERIFIED':'FAILED'):'NOT CHECKED'"),'Historical verification must never display current VERIFIED state without a current byte re-read.');
assert(store.includes("lastVerifiedExport:'+jobId")&&app.includes('projectStorage.lastBackup'),'Backup status must remain project-specific.');
for(const token of ['currentScopeSelectorCoverage:definition.currentScopeSelectorCoverage','exactReqRunTestCoverage:definition.exactReqRunTestCoverage','applicableCurrentRegressionSuccess:definition.applicableCurrentRegressionSuccess','mandatoryEvidenceChainStructuralCoverage:definition.mandatoryEvidenceChainCoverage','mandatoryEvidenceSufficiencyCoverage:v3.mandatoryEvidenceSufficiencyCoverage','releaseArtifactIdentityCoverage:definition.releaseArtifactIdentityCoverage'])assert(pages.includes(token),`Acceptance reduction lost required invariant mapping ${token}.`);
for(const token of ['unauthorizedFieldMutationsAccepted:definition.unauthorizedFieldMutationsAccepted','canonicalMutationsBeforeAcceptance:definition.canonicalMutationsBeforeAcceptance','partialCommitsAfterInjectedFailure:definition.partialCommitsAfterInjectedFailure','staleProposalsAccepted:definition.staleProposalsAccepted','crossProjectRelationshipsAccepted:definition.crossProjectRelationshipsAccepted','historicalScopeSatisfyingCurrentGates:definition.historicalScopeSatisfyingCurrentGates','unmatchedDeliveryFilesAuthorized:definition.unmatchedDeliveryFilesAuthorized','appendOnlyHistoryRewritesAccepted:definition.appendOnlyHistoryRewritesAccepted','unsupportedTestIrTreatedAsExecutable:v3.unsupportedTestIrTreatedAsExecutable','externalAssertionsOverridingApplicationProof:v3.externalAssertionsOverridingApplicationProof','nativeExecutionReceiptsFabricatedExternally:v3.nativeExecutionReceiptsFabricatedExternally','releaseAcceptedWithContradiction:v3.releaseAcceptedWithContradiction'])assert(pages.includes(token),`Acceptance reduction lost required zero-valued failure invariant mapping ${token}.`);
assert(app.includes('Reopened ${blockerId}: ${reason}'),'Reopen must append a new blocker instead of rewriting the resolved record.');
assert(store.includes("openTransaction([PROJECTS,ARTIFACTS,META],'readwrite')")&&store.includes('during-project-delete')&&store.includes('String(artifact.jobId)===jobId')&&store.includes("meta.get('projectUi')")&&store.includes('delete nextProjectUi[jobId]'),'Project deletion must remain one transaction over project/meta, lifecycle metadata, and owned artifact Blob rows.');
assert(html.includes('project-action-menu')&&html.includes('id="project-actions-toggle"')&&html.includes('aria-expanded="false"')&&html.includes('Project actions'),'Routine header actions must remain compact and explicitly operable.');
assert(browserExtra.includes("await click(cdp,'#project-actions-toggle')")&&browserExtra.includes("getAttribute('aria-expanded')==='true'")&&browserExtra.includes("getAttribute('aria-expanded')==='false'")&&browserExtra.includes("document.querySelector('.project-action-menu')?.open===true")&&browserExtra.includes("document.querySelector('.project-action-menu')?.open===false"),'Project actions opener must retain explicit behavioral browser proof for open/close state and aria-expanded synchronization.');
assert(html.includes('.header-actions{display:flex;flex-wrap:nowrap;overflow:visible;')&&!html.includes('.header-actions{display:flex;flex-wrap:nowrap;overflow-x:auto;'),'Mobile Project actions must not be clipped by the header action-strip overflow container.');
assert(!html.includes('Force Complete Stage')&&!html.includes('Override Release Gate')&&!html.includes('Mark Test Passed'),'Unsafe override controls must not exist.');

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
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

// Execute the production export coordinator with a slow persistence boundary.
// Rapid requests for different handoff files must all complete without overlap.
const delivered=[],exportErrors=[];let activeSaves=0,maxActiveSaves=0;
const exportRuntime=vm.createContext({current:{activeStage:3,job:{JOB_ID:'EXPORT-QUEUE'}},setTimeout,announce:()=>{},reportActionFailure:error=>exportErrors.push(String(error.message||error)),alert:message=>{throw new Error('Unexpected native popup: '+message);},savePromptRecord:async stage=>{activeSaves++;maxActiveSaves=Math.max(maxActiveSaves,activeSaves);await new Promise(resolve=>setTimeout(resolve,10));activeSaves--;return {stage,instructionId:'SAME-CONTROLLING-INSTRUCTION'};}});
vm.runInContext(app.slice(app.indexOf('let promptExportInFlight='),app.indexOf('async function exportPromptContext()'))+'\nglobalThis.exportRequest=promptExport;',exportRuntime);
await Promise.all(['manifest','instruction','context'].map(name=>exportRuntime.exportRequest(record=>{delivered.push({name,instructionId:record.instructionId});})));
assert(delivered.map(x=>x.name).join(',')==='manifest,instruction,context',`Rapid handoff requests were lost or reordered: ${JSON.stringify(delivered)}`);
assert(maxActiveSaves===1&&exportErrors.length===0,'Handoff exports overlapped persistence or raised an unexpected error.');
const blocked=exportRuntime.exportRequest(()=>delivered.push({name:'wrong-stage'}));
exportRuntime.current.activeStage=4;await blocked;
assert(delivered.length===3&&exportErrors.length===1,'Changing stage during export downloaded a file for the wrong selection.');
await exportRuntime.exportRequest(()=>delivered.push({name:'after-navigation'}));
assert(delivered.at(-1).name==='after-navigation','An interrupted export left subsequent handoff requests stuck.');
// Run the actual complete-export/backup handler against delayed storage. Navigation
// must not rename another project's bytes; large package assemblies must serialize.
const packageDownloads=[],packageRequests=[];let activePackages=0,maxActivePackages=0,rejectNextPackage=false;
const packageRuntime=vm.createContext({current:{job:{JOB_ID:'PACKAGE-A'}},setTimeout,announce:()=>{},render:()=>{},refreshProjectStorage:async()=>{},document:{createElement:()=>({click(){packageDownloads.push({filename:this.download,href:this.href});}})},URL:{createObjectURL:blob=>`blob:${blob.jobId}`,revokeObjectURL:()=>{}},projectStore:{storageHealth:async()=>({}),exportPackage:async jobId=>{packageRequests.push(jobId);activePackages++;maxActivePackages=Math.max(maxActivePackages,activePackages);await new Promise(resolve=>setTimeout(resolve,10));activePackages--;if(rejectNextPackage){rejectNextPackage=false;throw new Error('CONTROLLED_PACKAGE_EXPORT_FAILURE');}return {jobId};}}});
const packageStart=app.indexOf('let projectPackageExportInFlight=')>=0?app.indexOf('let projectPackageExportInFlight='):app.indexOf('async function downloadProjectPackage(');
vm.runInContext(app.slice(packageStart,app.indexOf('async function verifyStoredFilesNow()',packageStart))+'\nglobalThis.exportCompletePackage=downloadProjectPackage;',packageRuntime);
const originalExport=packageRuntime.exportCompletePackage();packageRuntime.current={job:{JOB_ID:'PACKAGE-B'}};const otherBackup=packageRuntime.exportCompletePackage('backup');packageRuntime.current={job:{JOB_ID:'PACKAGE-C'}};
await Promise.all([originalExport,otherBackup]);
assert(packageDownloads.map(x=>x.filename).join(',')==='PACKAGE-A.closed-loop.json.gz,PACKAGE-B.backup.closed-loop.json.gz',`Project navigation renamed exported bytes: ${JSON.stringify(packageDownloads)}`);
assert(packageDownloads.map(x=>x.href).join(',')==='blob:PACKAGE-A,blob:PACKAGE-B'&&packageRequests.join(',')==='PACKAGE-A,PACKAGE-B','Complete export used bytes from the wrong project.');
assert(maxActivePackages===1,'Large complete export and backup packages were assembled concurrently.');
rejectNextPackage=true;const failedPackage=packageRuntime.exportCompletePackage().then(()=>false,error=>error.message==='CONTROLLED_PACKAGE_EXPORT_FAILURE'),recoveredPackage=packageRuntime.exportCompletePackage('backup');assert(await failedPackage,'Controlled export failure was lost.');await recoveredPackage;
assert(packageDownloads.at(-1).filename==='PACKAGE-C.backup.closed-loop.json.gz','Failed complete export left later backup requests stuck.');
// Exercise the complete production package encoder with only the storage
// boundary replaced. The browser suite supplies real IndexedDB coverage.
const filePackageRuntime=vm.createContext({Blob,Uint8Array,ArrayBuffer,TextEncoder,TextDecoder,ReadableStream,CompressionStream,Response,crypto:globalThis.crypto,structuredClone,btoa,atob,setTimeout});
vm.runInContext(fs.readFileSync('hash.js','utf8'),filePackageRuntime);
vm.runInContext(store.replace('globalThis.closedLoopProjectStore=', 'readProject=async()=>fixtureProject;listArtifacts=async()=>fixtureArtifacts;metaPut=async()=>{};globalThis.closedLoopProjectStore='),filePackageRuntime);
vm.runInContext(`globalThis.closedLoopWorkflowSchema={RESPONSE_SCHEMA:'closed-loop-stage-response/3'};globalThis.fixtureProject={schema:'closed-loop-project/3',workflow:'mobile-closed-loop/30',job:{JOB_ID:'FILE-PRESSURE'},projectData:{rawResponses:[{rawText:'preserve exact history tail é🙂'}]}};globalThis.fixtureArtifacts=[];`,filePackageRuntime);
const artifactSizes=[0,1,2,3,65535,65536,65537,196607];
for(let i=0;i<artifactSizes.length;i++){
  const bytes=Uint8Array.from({length:artifactSizes[i]},(_,j)=>(j*137+i)%256),sha256=createHash('sha256').update(bytes).digest('hex');
  filePackageRuntime.fixtureBlob=new Blob([bytes]);
  vm.runInContext(`fixtureArtifacts.push({artifactId:'FILE-${i}',jobId:'FILE-PRESSURE',filename:'file-${i}.bin',mediaType:'application/octet-stream',byteSize:${bytes.length},sha256:'${sha256}',lineage:{},createdAt:'2026-09-11T00:00:00.000Z',blob:fixtureBlob});`,filePackageRuntime);
}
let maxPackageRead=0,maxBase64Input=0;
const nativeBlobRead=Blob.prototype.arrayBuffer;
filePackageRuntime.btoa=text=>{maxBase64Input=Math.max(maxBase64Input,text.length);return btoa(text);};
let exportedFiles;
try{
  Blob.prototype.arrayBuffer=function(){maxPackageRead=Math.max(maxPackageRead,this.size);return nativeBlobRead.call(this);};
  exportedFiles=await filePackageRuntime.closedLoopProjectStore.exportPackage('FILE-PRESSURE');
}finally{Blob.prototype.arrayBuffer=nativeBlobRead;}
assert(maxPackageRead<=65536,`Complete export allocated a ${maxPackageRead}-byte artifact buffer.`);
assert(maxBase64Input<=65536,`Complete export encoded ${maxBase64Input} bytes as one base64 string.`);
const exportedPayload=JSON.parse(await new Response(exportedFiles.stream().pipeThrough(new DecompressionStream('gzip'))).text());
const {packageSha256:filePackageSha256,...filePackageBody}=exportedPayload;
assert(createHash('sha256').update(globalThis.closedLoopHash.stableStringify(filePackageBody)).digest('hex')===filePackageSha256,'Streamed package digest differs from the independent crypto oracle.');
assert(exportedPayload.artifacts.length===artifactSizes.length,'Complete export dropped artifact members.');
for(let i=0;i<artifactSizes.length;i++){
  const row=exportedPayload.artifacts[i],bytes=Buffer.from(row.base64,'base64');
  assert(bytes.length===artifactSizes[i]&&bytes.every((value,j)=>value===(j*137+i)%256),`Complete export changed file ${i}, including its tail.`);
}
vm.runInContext(`fixtureArtifacts[0].sha256='0'.repeat(64)`,filePackageRuntime);
let damagedFileRejected=false;try{await filePackageRuntime.closedLoopProjectStore.exportPackage('FILE-PRESSURE');}catch(error){damagedFileRejected=error.code==='ARTIFACT_INTEGRITY_MISMATCH';}
assert(damagedFileRejected,'Bounded file export accepted corrupted stored bytes.');
// Exercise the other production package schema, including streamed UTF-8 JSON
// strings with multi-byte characters and escapes spanning file-read boundaries.
filePackageRuntime.fixtureContextBlob=new Blob(['é🙂\\\n\t"'.repeat(20000),'CONTEXT-FINAL-TAIL']);
filePackageRuntime.fixtureContextSha=await globalThis.closedLoopHash.sha256Bytes(filePackageRuntime.fixtureContextBlob);
vm.runInContext(`
  const hash=closedLoopHash,contextIdentity={path:'context.json',filename:'context.json',mediaType:'application/json',byteSize:fixtureContextBlob.size,sha256:fixtureContextSha};
  const prompt={stage:4,operation:'COMPLETE',promptEngineVersion:'FIXTURE',instructionId:'PROMPT-FILES',prompt:'instruction\\n',scope:{},contextManifest:{promptContext:{attachments:[contextIdentity]}}};
  prompt.bodySha256=prompt.fullTextSha256=hash.sha256Text(prompt.prompt);prompt.contractSha256=hash.sha256Value({});fixtureProject.projectData.generatedPrompts=[prompt];
  globalThis.fixtureContextRow={artifactId:'PROMPT-CONTEXT-'+hash.sha256Value({jobId:'FILE-PRESSURE',sha256:fixtureContextSha}),jobId:'FILE-PRESSURE',blob:fixtureContextBlob,sha256:fixtureContextSha,byteSize:fixtureContextBlob.size};
  globalThis.closedLoopPromptEngine={version:'FIXTURE',responseContractDescriptor:()=>({}),promptFileManifest:()=>({contextFiles:[contextIdentity],promptIdentity:{instructionId:prompt.instructionId}})};
  globalThis.closedLoopWorkflowEngine={executionHandoff:()=>({send:[{artifactId:'FILE-6'}]}),records:(_p,family)=>family==='artifacts'?[{id:'FILE-6',SHA256:fixtureArtifacts[6].sha256,BYTE_SIZE:fixtureArtifacts[6].byteSize,FILENAME:fixtureArtifacts[6].filename}]:[],recordId:r=>r.id,recordValue:(r,key)=>r[key],isActiveRecord:()=>true};
`,filePackageRuntime);
// Re-evaluate the same store with only its I/O substituted for immutable rows.
filePackageRuntime.structuredClone=undefined; // Preserve the isolated realm's plain-object prototypes.
vm.runInContext(store.replace('globalThis.closedLoopProjectStore=', 'getArtifact=async id=>[...fixtureArtifacts,fixtureContextRow].find(row=>row.artifactId===id);globalThis.closedLoopProjectStore='),filePackageRuntime);
maxPackageRead=0;maxBase64Input=0;
let executionPackage;
try{
  Blob.prototype.arrayBuffer=function(){maxPackageRead=Math.max(maxPackageRead,this.size);return nativeBlobRead.call(this);};
  executionPackage=await vm.runInContext("closedLoopProjectStore.createExecutionPackage({project:fixtureProject,stage:4,operation:'COMPLETE'})",filePackageRuntime);
}finally{Blob.prototype.arrayBuffer=nativeBlobRead;}
assert(maxPackageRead<=65536&&maxBase64Input<=65536,'Execution-package export buffered a complete artifact/context file.');
const executionPayload=JSON.parse(await new Response(executionPackage.blob.stream().pipeThrough(new DecompressionStream('gzip'))).text());
const {packageSha256:executionSha,...executionBody}=executionPayload;
assert(executionPayload.contextFiles[0].text===await filePackageRuntime.fixtureContextBlob.text(),'Execution-package context escaping or UTF-8 boundary changed exact content.');
assert(createHash('sha256').update(globalThis.closedLoopHash.stableStringify(executionBody)).digest('hex')===executionSha,'Execution-package digest changed.');
assert(executionPayload.artifacts[0].base64===exportedPayload.artifacts[6].base64,'Execution package changed artifact bytes.');
const decoderRuntime=vm.createContext({Blob,Uint8Array,atob});
vm.runInContext(store.slice(store.indexOf('const base64ToBytes='),store.indexOf('async function compressBytes('))+'\nglobalThis.decodeFile=base64ToBlob;',decoderRuntime);
for(const row of exportedPayload.artifacts){
  const wrapped=row.base64.replace(/.{73}/g,'$&\n\t '),decoded=await decoderRuntime.decodeFile(wrapped).arrayBuffer();
  assert(Buffer.from(decoded).equals(Buffer.from(row.base64,'base64')),'Bounded restore changed base64 whitespace or final padding semantics.');
}
for(const invalid of ['Zg==YQ==','!AAA','A','AA=A']){let rejected=false;try{decoderRuntime.decodeFile(invalid);}catch{rejected=true;}assert(rejected,`Invalid artifact base64 was accepted: ${invalid}`);}
// The real Files view and proposal view must not eagerly build all accumulated
// download controls or resolve every diff row before a detail page is opened.
const viewRuntime=vm.createContext({engine,current:core.createBlankState('VIEW-PRESSURE'),safe:value=>Array.isArray(value)?value:[],esc:value=>String(value??''),label:value=>String(value),proposalVersionCurrent:()=>true});
vm.runInContext(app.slice(app.indexOf('const detailViews='),app.indexOf('function completion(')),viewRuntime);
vm.runInContext(app.slice(app.indexOf('function files(){'),app.indexOf('function release(){')),viewRuntime);
vm.runInContext(`for(let i=0;i<600;i++)current.projectData.artifacts.push({id:'FILE-'+i,active:true,fields:{ARTIFACT_ID:'FILE-'+i,FILENAME:'file-'+i+'.bin',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED',SHA256:'a'.repeat(64)}});globalThis.fileView=files();`,viewRuntime);
assert((viewRuntime.fileView.match(/data-download-artifact=/g)||[]).length<=20,'The Files view rendered every accumulated artifact download control.');
vm.runInContext(`globalThis.filePages=[...detailViews.values()].filter(entry=>entry.kind==='markup'&&entry.title==='Stored files');`,viewRuntime);
assert(viewRuntime.filePages.length===1,'Large file lists need a paged download surface.');
const fileIds=[];
for(let offset=0;offset<600;offset+=20){const html=viewRuntime.filePages[0].value(offset);fileIds.push(...[...html.matchAll(/data-download-artifact="([^"]+)"/g)].map(match=>match[1]));}
assert(fileIds.length===600&&new Set(fileIds).size===600&&fileIds.at(-1)==='FILE-599','File pagination lost or duplicated a downloadable artifact.');
let diffLookups=0;
viewRuntime.engine={...engine,records:(...args)=>{diffLookups++;return engine.records(...args);}};
vm.runInContext(`globalThis.pendingProposal=()=>({changes:Array.from({length:600},(_,i)=>({canonicalCollection:'requirements',canonicalRecordId:'REQ-'+i,canonicalField:'OBLIGATION',normalizedValue:'proposal-'+i})),envelope:{stageData:{}},humanAuthorityCandidates:[]});`,viewRuntime);
vm.runInContext(app.slice(app.indexOf('function proposalMarkup('),app.indexOf('function stageConfirmationMarkup(')),viewRuntime);
vm.runInContext('proposalMarkup(4)',viewRuntime);
assert(diffLookups<=20,`Closed proposal details resolved ${diffLookups} records before disclosure.`);
let evidenceLookups=0,regressionLookups=0;
const accumulatedViewRows=Array.from({length:600},(_,i)=>({id:'VIEW-'+i}));
viewRuntime.engine={...engine,records:(_p,family)=>{if(family==='regressionExecutions'){regressionLookups++;return [];}return accumulatedViewRows;},evidenceChainExplanation:(_p,chain)=>{evidenceLookups++;return {id:chain.id};}};
vm.runInContext(app.slice(app.indexOf('function evidenceExplanationMarkup('),app.indexOf('function rootCauseCorrectionMarkup(')),viewRuntime);
vm.runInContext(app.slice(app.indexOf('function regressionLifecycleMarkup('),app.indexOf('function contradictionMarkup(')),viewRuntime);
vm.runInContext('evidenceExplanationMarkup(29);regressionLifecycleMarkup(15)',viewRuntime);
assert(evidenceLookups<=20&&regressionLookups<=20,`Deferred stage views eagerly computed ${evidenceLookups} evidence explanations and ${regressionLookups} regression histories.`);
console.log(JSON.stringify({projectLifecycleControls:true,compactHeader:true,mobileProjectActionsVisible:true,dangerHiddenByDefault:true,transactionalDeleteRetained:true,lifecycleMetadataDeleteAtomic:true,durableAttemptAbandonment:true,canonicalBlobReverification:true,applicationCustodyBlocking:true,custodyFailureRecoveryBehavior:true,staleDeliveryAuthorizationNotResurrected:true,perProjectBackupState:true,zeroLossAcceptanceReduction:true,queuedHandoffFilesPreserved:true,exportNavigationGuard:true,completeExportIdentityAfterNavigation:true,serializedCompletePackages:true,completeExportFailureRecovery:true,unsafeOverrides:0}));
