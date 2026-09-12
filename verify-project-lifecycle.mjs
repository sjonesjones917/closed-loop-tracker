import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const assert=(value,message)=>{if(!value)throw new Error(message);};
const app=fs.readFileSync('app-core.js','utf8'),store=fs.readFileSync('project-store.js','utf8'),ingestion=fs.readFileSync('response-ingestion.js','utf8'),engineSource=fs.readFileSync('workflow-engine.js','utf8'),pages=fs.readFileSync('.github/workflows/pages.yml','utf8'),html=fs.readFileSync('index.html','utf8'),browserExtra=fs.readFileSync('verify-browser-extra.mjs','utf8');
// Replay the real database-open owner while an older tab keeps the upgrade
// pending. A second caller must receive the known blocked error, not queue an
// open request that cannot report its own blocked event until the first ends.
{
  const requests=[];let closed=0;
  const runtime=vm.createContext({indexedDB:{open(){const request={};requests.push(request);return request;}}});
  vm.runInContext("const DB_NAME='closed-loop-reliability',DB_VERSION=2;"+store.slice(store.indexOf('let databasePromise=null;'),store.indexOf('function parseLegacy('))+';globalThis.open=openDatabase;',runtime);
  const first=runtime.open().catch(error=>error);requests[0].onblocked();assert((await first).code==='INDEXEDDB_BLOCKED','Blocked upgrade did not report its cause.');
  const retry=runtime.open().catch(error=>error);assert(requests.length===1,'Blocked upgrade queued another open request and left startup waiting behind the original lock.');
  assert((await retry).code==='INDEXEDDB_BLOCKED','Subsequent startup work lost the known blocked-upgrade error.');
  requests[0].result={close(){closed++;}};requests[0].onsuccess();
  const resumed=runtime.open();assert(requests.length===2&&closed===1,'Closing the old tab did not release the rejected upgrade connection for a fresh open.');
  const available={close(){closed++;}};requests[1].result=available;requests[1].onsuccess();assert(await resumed===available,'Database could not reopen after the blocked request completed.');
  console.log(JSON.stringify({storageRegression:'database:blocked-upgrade-does-not-queue-startup',passed:true}));
}
{
  const status={textContent:'Storage status loading…'},announcements=[];
  const runtime=vm.createContext({closedLoopCore:{},load:async()=>{throw Object.assign(new Error('IndexedDB upgrade is blocked by another tab.'),{code:'INDEXEDDB_BLOCKED'});},console:{error(){}},announce:message=>announcements.push(message),$:selector=>selector==='#storage-status'?status:null});
  vm.runInContext(app.slice(app.indexOf('globalThis.closedLoopAppReady=false;'),app.indexOf('// Long-section navigation belongs'))+';globalThis.start=startClosedLoopApp;',runtime);
  await runtime.start();assert(runtime.closedLoopAppReady===false&&/blocked/i.test(runtime.closedLoopAppError),'Blocked startup was incorrectly marked ready.');
  assert(/close.*tabs.*reload/i.test(status.textContent)&&announcements.includes(status.textContent),'Blocked startup did not show an actionable recovery message in the existing status area.');
  console.log(JSON.stringify({storageRegression:'database:blocked-upgrade-visible-recovery',passed:true}));
}
for(const token of ['renameCurrentProject','duplicateCurrentProject','materializeProject','unloadInactiveProjects','archiveCurrentProject','restoreArchivedProject','downloadProjectPackage','verifyStoredFilesNow','discardCurrentAttempt','prepareReplacementAttempt','reopenHumanBlocker'])assert(app.includes(token),`Missing lifecycle action ${token}.`);
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
const packageRuntime=vm.createContext({withStorageActivity:async(_label,operation)=>operation(),current:{job:{JOB_ID:'PACKAGE-A'}},setTimeout,announce:()=>{},render:()=>{},refreshProjectStorage:async()=>{},document:{createElement:()=>({click(){packageDownloads.push({filename:this.download,href:this.href});}})},URL:{createObjectURL:blob=>`blob:${blob.jobId}`,revokeObjectURL:()=>{}},projectStore:{storageHealth:async()=>({}),exportPackage:async jobId=>{packageRequests.push(jobId);activePackages++;maxActivePackages=Math.max(maxActivePackages,activePackages);await new Promise(resolve=>setTimeout(resolve,10));activePackages--;if(rejectNextPackage){rejectNextPackage=false;throw new Error('CONTROLLED_PACKAGE_EXPORT_FAILURE');}return {jobId};}}});
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
for(const invalid of ['Zg==YQ==','!AAA','A','AA=A',null,0,{},[]]){let rejected=false;try{decoderRuntime.decodeFile(invalid);}catch{rejected=true;}assert(rejected,`Invalid artifact base64 was accepted: ${invalid}`);}
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

// Keep the production storage/handlers intact and substitute only transaction
// I/O. Real IndexedDB versions of these regressions run in browser-extra.
const storageRows=new Map(),storageAccess=[];
const storageRuntime=vm.createContext({Blob,Uint8Array,ArrayBuffer,TextEncoder,TextDecoder,ReadableStream,CompressionStream,DecompressionStream,Response,crypto:globalThis.crypto,btoa,atob,setTimeout,console,Event:globalThis.Event,dispatchEvent:()=>true});
const parseStorageJson=vm.runInContext('(text)=>JSON.parse(text)',storageRuntime);
const storageRead=(value,parseJson=parseStorageJson)=>{if(value===undefined)return undefined;const blobs=[],copy=parseJson(JSON.stringify(value,(_key,item)=>item instanceof Blob?{__storageBlob:blobs.push(item)-1}:item));const restore=item=>{if(item&&typeof item==='object'){if(Object.keys(item).length===1&&Number.isInteger(item.__storageBlob))return blobs[item.__storageBlob];for(const key of Object.keys(item))item[key]=restore(item[key]);}return item;};return restore(copy);};
storageRuntime.openStorageTransaction=async(names,mode)=>{
  const selected=Array.isArray(names)?names:[names],pending=new Map(selected.map(name=>[name,new Map(storageRows.get(name)||[])]));
  storageAccess.push({kind:'transaction',names:selected,mode});
  return {objectStore:name=>({get:key=>{storageAccess.push({kind:'get',name,key});return {result:storageRead(pending.get(name).get(key))};},getAll:()=>{storageAccess.push({kind:'getAll',name});return {result:[...pending.get(name).values()].map(row=>storageRead(row))};},index:indexName=>({openKeyCursor:()=>{storageAccess.push({kind:'indexKeys',name,indexName});const keys=[...pending.get(name).values()].map(row=>row[indexName]).filter(Boolean).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));const req={};let i=0;const advance=()=>{req.result=i<keys.length?{key:keys[i++],continue:()=>queueMicrotask(advance)}:null;req.onsuccess?.();};queueMicrotask(advance);return req;},getAll:key=>{storageAccess.push({kind:'indexGetAll',name,indexName,key});return {result:[...pending.get(name).values()].filter(row=>String(row[indexName])===String(key)).map(row=>storageRead(row))};}}),count:()=>({result:pending.get(name).size}),put:row=>{storageAccess.push({kind:'put',name,key:row.jobId||row.key||row.artifactId});pending.get(name).set(name==='projects'?row.jobId:name==='artifacts'?row.artifactId:row.key,structuredClone(row));},delete:key=>pending.get(name).delete(key)}),commit(){if(mode==='readwrite')for(const [name,rows] of pending)storageRows.set(name,rows);},abort(){}};
};
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInContext(fs.readFileSync(file,'utf8'),storageRuntime,{filename:file});
const storageSource=store.replace('globalThis.closedLoopProjectStore=','globalThis.decodePackageForTest=readPackageJson;globalThis.packageChunksForTest=packageJsonChunks;globalThis.closedLoopProjectStore=')
  .replace(/const request=req=>[^\n]+/, 'const request=req=>Promise.resolve(req.result);')
  .replace(/const complete=tx=>[^\n]+/, 'const complete=async tx=>tx.commit();')
  .replace(/async function openTransaction\([\s\S]*?\n}\n/, 'async function openTransaction(stores,mode="readonly"){return openStorageTransaction(stores,mode);}\n');
vm.runInContext(storageSource,storageRuntime);
vm.runInContext(`globalThis.core=closedLoopCore;globalThis.engine=closedLoopWorkflowEngine;globalThis.schema=closedLoopWorkflowSchema;globalThis.projectStore=closedLoopProjectStore;globalThis.withStorageActivity=async(_label,operation)=>operation();globalThis.clone=value=>JSON.parse(JSON.stringify(value));globalThis.safe=value=>Array.isArray(value)?value:[];globalThis.views=['Overview','Project','Workflow'];globalThis.projects=[];globalThis.current=null;globalThis.projectUi={};globalThis.jobFields=[['JOB_TITLE'],['EXACT_USER_OBJECTIVE_VERBATIM']];globalThis.announce=()=>{};globalThis.render=()=>{};globalThis.refreshProjectStorage=async()=>{};globalThis.failures=[];globalThis.reportActionFailure=message=>failures.push(String(message));globalThis.elements={};globalThis.$=selector=>elements[selector]??=( {click(){}} );`,storageRuntime);
const appFunction=name=>{
  const match=new RegExp(`(?:async )?function ${name}\\(`).exec(app);if(!match)return '';
  const start=match.index,rest=app.slice(start),next=/\n(?:async )?function \w+\(/.exec(rest);
  return next?rest.slice(0,next.index):rest.slice(0,rest.indexOf('\n'));
};
for(const name of ['blankStage','ensureState','projectDisplayName','saveProjectUi','persistAll','persistNewProject','persistReplacement','save','createUniqueJobId','addNew','duplicateCurrentProject','materializeProject','unloadInactiveProjects','archiveCurrentProject']){const source=appFunction(name);if(source)vm.runInContext(source,storageRuntime);}
vm.runInContext(`globalThis.projectUiEntry=id=>projectUi[id]||{};globalThis.projectIsArchived=p=>Boolean(projectUiEntry(p.job.JOB_ID).archivedAt);globalThis.projectDisplayName=p=>p.job.JOB_TITLE||p.job.JOB_ID;globalThis.normalize=p=>ensureState(p);globalThis.makeStored=async id=>{const p=ensureState(core.createBlankState(id));return projectStore.writeProject(p,{expectedProjectRevision:0});};`,storageRuntime);
const lifecycleFailures=[];
async function storageRegression(name,run){try{await run();console.log(JSON.stringify({storageRegression:name,passed:true}));}catch(error){lifecycleFailures.push({name,message:error.message});console.log(JSON.stringify({storageRegression:name,passed:false,message:error.message}));}}
// Save real generated instructions whose immutable context bytes are shared.
// The storage operation, including canonical validation/CAS, stays in production.
await storageRegression('prompt-context:shared-identities-one-read-snapshot',async()=>{
  await vm.runInContext(`(async()=>{
    globalThis.contextProject=await makeStored('CONTEXT-READ-PRESSURE');
    contextProject.job.EXACT_USER_OBJECTIVE_VERBATIM='Preserve every context byte. '.repeat(3000)+'é🙂 FINAL CONTEXT TAIL';
    for(let index=0;index<64;index++)contextProject.projectData.generatedPrompts.push(closedLoopPromptEngine.buildPromptRecord(1,contextProject,{operation:'COMPLETE',scope:{projectRevision:index+1}}));
    await projectStore.persistPromptContextFiles(contextProject.projectData.generatedPrompts[0],contextProject);
  })()`,storageRuntime);
  const p=storageRuntime.contextProject,identities=p.projectData.generatedPrompts.flatMap(record=>record.contextManifest.promptContext.attachments);
  assert(identities.length===64&&new Set(identities.map(file=>file.sha256)).size===1,'Real prompt fixture does not share one exact context file.');
  const before=JSON.stringify(p.projectData.generatedPrompts);storageAccess.length=0;
  const saved=await storageRuntime.projectStore.writeProject(p,{expectedProjectRevision:p.revision,selectProject:false});
  const gets=storageAccess.filter(x=>x.kind==='get'&&x.name==='artifacts'),transactions=storageAccess.filter(x=>x.kind==='transaction'&&x.mode==='readonly'&&x.names.includes('artifacts'));
  console.log(JSON.stringify({promptContextReadPressure:{prompts:64,uniqueFiles:1,artifactReads:gets.length,readonlyTransactions:transactions.length}}));
  assert(JSON.stringify(saved.projectData.generatedPrompts)===before,'Context read optimization changed preserved instructions or manifests.');
  assert(gets.length===1&&transactions.length===1,`One shared context file required ${gets.length} reads in ${transactions.length} readonly transactions.`);
});
await storageRegression('prompt-context:distinct-identities-bounded-snapshot',async()=>{
  const hash=globalThis.closedLoopHash,jobId='CONTEXT-DISTINCT-PRESSURE',rows=storageRows.get('artifacts'),identities=[];
  for(let i=0;i<129;i++){
    const text='Distinct context '+i+' é🙂',sha256=hash.sha256Text(text),blob=new Blob([text]),artifactId='PROMPT-CONTEXT-'+hash.sha256Value({jobId,sha256});
    const file={path:'context-'+i+'.json',filename:'context-'+i+'.json',mediaType:'application/json',byteSize:blob.size,sha256};identities.push(file);
    rows.set(artifactId,{artifactId,jobId,blob,...file});
  }
  storageRuntime.distinctContextRecord=storageRead({contextManifest:{promptContext:{attachments:[...identities,...identities]}}});
  storageAccess.length=0;
  await storageRuntime.projectStore.persistPromptContextFiles(storageRuntime.distinctContextRecord,{job:{JOB_ID:jobId}});
  const gets=storageAccess.filter(x=>x.kind==='get'&&x.name==='artifacts'),transactions=storageAccess.filter(x=>x.kind==='transaction'&&x.mode==='readonly'&&x.names.includes('artifacts'));
  console.log(JSON.stringify({promptContextDistinctPressure:{references:258,uniqueFiles:129,artifactReads:gets.length,readonlyTransactions:transactions.length}}));
  assert(gets.length===129&&transactions.length===1,`Distinct context verification used ${gets.length} reads and ${transactions.length} transactions.`);
});
for(const mismatch of ['owner','digest','size','contradictory-reference'])await storageRegression('prompt-context:fresh-verification-'+mismatch,async()=>{
  const project=await storageRuntime.projectStore.readProject('CONTEXT-READ-PRESSURE'),before=project.projectSha256,rows=storageRows.get('artifacts');
  const row=[...rows.values()].find(row=>row.jobId===project.job.JOB_ID),changed={...row};
  if(mismatch==='owner')changed.jobId='ANOTHER-PROJECT';
  if(mismatch==='digest')changed.sha256='0'.repeat(64);
  if(mismatch==='size')changed.byteSize++;
  if(mismatch==='contradictory-reference')project.projectData.generatedPrompts.at(-1).contextManifest.promptContext.attachments[0].byteSize++;
  rows.set(row.artifactId,changed);storageAccess.length=0;let error;
  try{await storageRuntime.projectStore.writeProject(project,{expectedProjectRevision:project.revision});}catch(e){error=e;}finally{rows.set(row.artifactId,row);}
  assert(error?.code==='PROMPT_CONTEXT_INTEGRITY_FAILED',`A later save reused stale context verification after ${mismatch} changed.`);
  assert(!storageAccess.some(x=>x.kind==='put'&&x.name==='projects'),'Failed context verification reached a canonical project write.');
  assert((await storageRuntime.projectStore.readProject(project.job.JOB_ID)).projectSha256===before,'Context mismatch changed the stored project.');
});
await storageRegression('prompt-context:materialize-shared-missing-bytes-once',async()=>{
  const project=await storageRuntime.projectStore.readProject('CONTEXT-READ-PRESSURE'),rows=storageRows.get('artifacts'),row=[...rows.values()].find(row=>row.jobId===project.job.JOB_ID);
  rows.delete(row.artifactId);let materializations=0;const promptEngine=storageRuntime.closedLoopPromptEngine;
  storageRuntime.closedLoopPromptEngine={...promptEngine,materializePromptContextFiles(...args){materializations++;return promptEngine.materializePromptContextFiles(...args);}};
  storageAccess.length=0;
  try{await storageRuntime.projectStore.writeProject(project,{expectedProjectRevision:project.revision});}finally{storageRuntime.closedLoopPromptEngine=promptEngine;}
  const reads=storageAccess.filter(x=>x.kind==='get'&&x.name==='artifacts'),writes=storageAccess.filter(x=>x.kind==='put'&&x.name==='artifacts'),restored=await storageRuntime.projectStore.getArtifact(row.artifactId);
  assert(materializations===1&&writes.length===1&&reads.length===3,`Shared missing context was materialized ${materializations} times, written ${writes.length} times and read ${reads.length} times.`);
  assert(restored.sha256===row.sha256&&await restored.blob.text()===await row.blob.text(),'Context reconstruction changed exact historical bytes.');
});
await storageRegression('prompt-context:missing-history-cannot-use-current-content',async()=>{
  const project=await storageRuntime.projectStore.readProject('CONTEXT-READ-PRESSURE'),before=project.projectSha256,rows=storageRows.get('artifacts'),row=[...rows.values()].find(row=>row.jobId===project.job.JOB_ID);
  rows.delete(row.artifactId);project.job.EXACT_USER_OBJECTIVE_VERBATIM='Different current objective. '.repeat(3000);let error;
  try{await storageRuntime.projectStore.writeProject(project,{expectedProjectRevision:project.revision});}catch(e){error=e;}finally{rows.set(row.artifactId,row);}
  assert(/Prompt context has changed/.test(error?.message),'Missing historical context was silently replaced with current content.');
  assert((await storageRuntime.projectStore.readProject(project.job.JOB_ID)).projectSha256===before,'Unrecoverable historical context changed the saved project.');
});
await storageRegression('prompt-context:historical-eligibility-and-backup-custody',async()=>{
  const project=await storageRuntime.makeStored('CONTEXT-HISTORICAL'),source=storageRuntime.contextProject.projectData.generatedPrompts[0];
  project.projectData.generatedPrompts=storageRead([{...source,invalidatedBy:'LATER-INSTRUCTION'},{...source,instructionId:'PRIOR-ENGINE-INSTRUCTION',promptEngineVersion:'PRIOR-ENGINE'}]);
  storageAccess.length=0;const saved=await storageRuntime.projectStore.writeProject(project,{expectedProjectRevision:project.revision});
  assert(!storageAccess.some(x=>x.kind==='get'&&x.name==='artifacts'),'Ordinary save changed which historical prompt records require reconstruction.');
  let error;try{await storageRuntime.projectStore.exportPackage(saved.job.JOB_ID);}catch(e){error=e;}
  assert(error?.code==='PACKAGE_ARTIFACT_CUSTODY_MISMATCH','Complete backup stopped requiring invalidated/older-engine historical context bytes.');
});
// File intake must retain its original project, revision, stage and byte owner
// through every asynchronous boundary. Only the database I/O is substituted.
vm.runInContext(app.match(/^const artifactIdFor=.*$/m)[0],storageRuntime);
for(const name of ['logicalFilePath','storeArtifactFile','registerStageFiles'])vm.runInContext(appFunction(name),storageRuntime);
for(const boundary of ['first-file','second-file','first-text','second-text'])for(const change of ['project','stage','revision','second-file-failure'])await storageRegression(`file-intake:${boundary}:${change}`,async()=>{
  let reached,release;const entered=new Promise(resolve=>reached=resolve),held=new Promise(resolve=>release=resolve);
  storageRuntime.intakeBoundary=async name=>{if(name===boundary){reached();await held;}};
  storageRuntime.intakeFailure=change==='second-file-failure';
  await vm.runInContext(`(async()=>{
    globalThis.intakeA=await makeStored('INTAKE-A-'+${JSON.stringify(boundary+'-'+change)});
    globalThis.intakeB=await makeStored('INTAKE-B-'+${JSON.stringify(boundary+'-'+change)});
    projects=[intakeA,intakeB];current=intakeA;failures=[];
    await projectStore.metaPut('selectedProject',intakeA.job.JOB_ID);
    globalThis.intakeFiles=['first','second'].map(name=>{const file=new Blob([name+' exact bytes é🙂'],{type:'text/plain'});Object.defineProperty(file,'name',{value:name+'.txt'});file.text=async()=>{await intakeBoundary(name+'-text');if(intakeFailure&&name==='second')throw new Error('CONTROLLED_SECOND_FILE_FAILURE');return Blob.prototype.text.call(file);};return file;});
    globalThis.originalPutArtifact=projectStore.putArtifact;
    projectStore={...projectStore,putArtifact:async options=>{await intakeBoundary(options.filename.replace('.txt','')+'-file');return originalPutArtifact(options);}};
  })()`,storageRuntime);
  const pending=vm.runInContext('registerStageFiles(intakeFiles)',storageRuntime);await Promise.race([entered,pending.then(()=>{throw new Error('File intake finished before the intended async boundary: '+storageRuntime.failures.join(' | '));})]);
  await vm.runInContext(change==='revision'?`(async()=>{const newer=clone(intakeA);newer.newerWork='PRESERVE';await projectStore.writeProject(newer,{expectedProjectRevision:newer.revision});})()`:
    change==='stage'?`current.activeStage=2;current.activeView='Records';`:
    `current=intakeB;awaitSelection=projectStore.metaPut('selectedProject',intakeB.job.JOB_ID);`,storageRuntime);
  if(storageRuntime.awaitSelection)await storageRuntime.awaitSelection;
  release();await pending;storageRuntime.projectStore.putArtifact=storageRuntime.originalPutArtifact;
  const a=await storageRuntime.projectStore.readProject(storageRuntime.intakeA.job.JOB_ID),b=await storageRuntime.projectStore.readProject(storageRuntime.intakeB.job.JOB_ID);
  assert(b.projectData.artifacts.length===0&&b.revision===storageRuntime.intakeB.revision,'File intake changed the other project.');
  const failed=change==='revision'||change==='second-file-failure';
  assert(a.projectData.artifacts.length===(failed?0:2),'File intake lost its original owner or partially registered a batch.');
  const rows=await storageRuntime.projectStore.listArtifacts(a.job.JOB_ID);
  assert(rows.length===(failed?0:2),'File intake left uncommitted bytes behind or deleted committed bytes.');
  assert((await storageRuntime.projectStore.listArtifacts(b.job.JOB_ID)).length===0,'File intake stored bytes under the newly selected project.');
  if(change==='revision')assert(a.newerWork==='PRESERVE','File intake overwrote an intervening revision.');
  if(change==='project'||change==='second-file-failure'){assert(storageRuntime.current.job.JOB_ID===b.job.JOB_ID,'Completing background file intake replaced the selected project.');assert(await storageRuntime.projectStore.metaGet('selectedProject')===b.job.JOB_ID,'File intake replaced the durable project selection.');}
  if(change==='stage')assert(storageRuntime.current.activeStage===2&&storageRuntime.current.activeView==='Records','File intake replaced the selected stage/view.');
  if(!failed)for(const row of rows){const canonical=a.projectData.artifacts.find(item=>item.id===row.artifactId);assert(canonical?.stage===1&&a.stages[1].authorizedFiles.some(item=>item.artifactId===row.artifactId),'File intake lost its original stage.');assert(a.projectData.userEntered.suppliedArtifactText[row.artifactId].text===await row.blob.text(),'File intake changed supplied source text.');}
});
await storageRegression('file-intake:post-commit-render-failure-keeps-bytes',async()=>{
  await vm.runInContext(`(async()=>{current=await makeStored('INTAKE-RENDER');projects=[current];intakeFailure=false;intakeBoundary=async()=>{};render=()=>{throw new Error('CONTROLLED_RENDER_FAILURE');};})()`,storageRuntime);
  try{await vm.runInContext('registerStageFiles(intakeFiles)',storageRuntime);}catch(error){assert(error.message==='CONTROLLED_RENDER_FAILURE','Unexpected post-commit failure.');}
  storageRuntime.render=()=>{};
  const saved=await storageRuntime.projectStore.readProject('INTAKE-RENDER');
  assert(saved.projectData.artifacts.length===2&&(await storageRuntime.projectStore.listArtifacts('INTAKE-RENDER')).length===2,'A display failure removed committed canonical file bytes.');
});
await storageRegression('storage-refresh:navigation-cannot-replace-totals',async()=>{
  vm.runInContext(appFunction('refreshProjectStorage'),storageRuntime);
  await vm.runInContext(`(async()=>{globalThis.refreshA=await makeStored('REFRESH-A');globalThis.refreshB=await makeStored('REFRESH-B');current=refreshA;projectStorage={artifactCount:72,byteSize:1200};})()`,storageRuntime);
  let reached,release;const entered=new Promise(resolve=>reached=resolve),held=new Promise(resolve=>release=resolve),original=storageRuntime.projectStore.listArtifacts;
  storageRuntime.projectStore.listArtifacts=async id=>{reached();await held;return original(id);};
  const pending=vm.runInContext('refreshProjectStorage()',storageRuntime);await entered;storageRuntime.current=storageRuntime.refreshB;release();await pending;
  storageRuntime.projectStore.listArtifacts=original;
  assert(storageRuntime.projectStorage.artifactCount===72,'A completed refresh replaced another project\'s displayed file totals.');
  storageRuntime.refreshProjectStorage=async()=>{};
});
for(const action of ['addNew','duplicateCurrentProject','materializeProject','unloadInactiveProjects','archiveCurrentProject'])await storageRegression(`${action}:preserve-newer-project`,async()=>{
  await vm.runInContext(`(async()=>{projects=[await makeStored('STALE-${action}')];current=projects[0];const newer=clone(current);newer.newerWork='PRESERVE';await projectStore.writeProject(newer,{expectedProjectRevision:newer.revision});})()`,storageRuntime);
  storageAccess.length=0;await vm.runInContext(`${action}()`,storageRuntime);
  const unrelated=storageAccess.filter(x=>x.name==='projects'&&x.key===`STALE-${action}`);
  const after=await storageRuntime.projectStore.readProject(`STALE-${action}`);
  assert(after.newerWork==='PRESERVE',`${action} overwrote newer saved work from its stale project list.`);
  assert(unrelated.length===0,`${action} read or rewrote an unrelated project ${unrelated.length} times.`);
});
await storageRegression('bulk-write:stale-revision-atomic',async()=>{
  await vm.runInContext(`(async()=>{globalThis.bulkStale=await makeStored('BULK-STALE');const newer=clone(bulkStale);newer.newerWork='PRESERVE';await projectStore.writeProject(newer,{expectedProjectRevision:newer.revision});globalThis.bulkNew=ensureState(core.createBlankState('BULK-MUST-ROLL-BACK'));})()`,storageRuntime);
  let rejected=false;try{await vm.runInContext('projectStore.writeAll([bulkNew,bulkStale])',storageRuntime);}catch(error){rejected=error.code==='STALE_PROJECT_REVISION';}
  assert(rejected,'Bulk persistence replaced the caller revision with the current database revision.');
  assert(!await storageRuntime.projectStore.readProject('BULK-MUST-ROLL-BACK'),'A rejected bulk write partially committed a preceding project.');
  assert((await storageRuntime.projectStore.readProject('BULK-STALE')).newerWork==='PRESERVE','Bulk conflict overwrote newer work.');
});
await storageRegression('create-only:existing-zero-revision',async()=>{
  await vm.runInContext(`(async()=>{const p=ensureState(core.createBlankState('CREATE-COLLISION'));p.newerWork='PRESERVE';await projectStore.writeProject(p,{expectedProjectRevision:0,incrementRevision:false});})()`,storageRuntime);
  let rejected=false;try{await vm.runInContext(`projectStore.writeProject(ensureState(core.createBlankState('CREATE-COLLISION')),{expectedProjectRevision:0,createOnly:true})`,storageRuntime);}catch(error){rejected=error.code==='PROJECT_ALREADY_EXISTS';}
  assert(rejected&&(await storageRuntime.projectStore.readProject('CREATE-COLLISION')).newerWork==='PRESERVE','Creating a project reused an existing revision-zero identity.');
});
await storageRegression('backup:required-canonical-bytes',async()=>{
  await vm.runInContext(`(async()=>{let p=await makeStored('BACKUP-CLOSURE');const row=await projectStore.putArtifact({artifactId:'BACKUP-FILE',jobId:p.job.JOB_ID,filename:'required.txt',blob:new Blob(['required bytes'])});engine.registerArtifactBytes(p,{stage:1,artifactId:row.artifactId,filename:row.filename,byteSize:row.byteSize,sha256:row.sha256,mediaType:row.mediaType,lineage:row.lineage});globalThis.backupProject=await projectStore.writeProject(p,{expectedProjectRevision:p.revision});globalThis.goodBackup=await projectStore.exportPackage(p.job.JOB_ID);await projectStore.deleteArtifact(row.artifactId,p.job.JOB_ID);})()`,storageRuntime);
  const previous=await storageRuntime.projectStore.metaGet('lastVerifiedExport:BACKUP-CLOSURE');
  let rejected=false;try{await storageRuntime.projectStore.exportPackage('BACKUP-CLOSURE');}catch(error){rejected=error.code==='PACKAGE_ARTIFACT_CUSTODY_MISMATCH';}
  assert(rejected,'A verified export was created despite missing canonical artifact bytes.');
  assert(JSON.stringify(await storageRuntime.projectStore.metaGet('lastVerifiedExport:BACKUP-CLOSURE'))===JSON.stringify(previous),'Failed export replaced the last successful backup evidence.');
});

await storageRegression('response-size:reject-before-full-read-preserve-raw',async()=>{
  const originalRead=Blob.prototype.arrayBuffer;let largestRead=0,staged,error;
  try{
    Blob.prototype.arrayBuffer=function(){largestRead=Math.max(largestRead,this.size);return originalRead.call(this);};
    staged=await storageRuntime.projectStore.stageResponseFile({jobId:'OVERSIZE-OWNER',stage:1,blob:new Blob(['x'.repeat(1048577)]),rawFilename:'oversized.json'});
    try{await storageRuntime.projectStore.readStagedResponseFile({jobId:'OVERSIZE-OWNER',stagingId:staged.stagingId});}catch(e){error=e;}
  }finally{Blob.prototype.arrayBuffer=originalRead;}
  assert(error?.code==='OVERSIZED_RESPONSE','Oversized response reached full-file materialization.');
  assert(largestRead<=65536,`Oversized response allocated a ${largestRead}-byte read buffer.`);
  const kept=await storageRuntime.projectStore.metaGet(staged.storageKey);
  assert(kept.blob.size===1048577&&kept.sha256===staged.sha256&&kept.rejection?.code==='OVERSIZED_RESPONSE','Oversize rejection lost original bytes, ownership or its failure receipt.');
});
await storageRegression('import:incremental-package-decoding',async()=>{
  const originalText=Response.prototype.text;let fullTextReads=0,error;
  try{Response.prototype.text=function(){fullTextReads++;return originalText.call(this);};storageRuntime.__closedLoopStorageFault='before-import-transaction';await storageRuntime.projectStore.importPackage(storageRuntime.goodBackup);}catch(e){error=e;}finally{Response.prototype.text=originalText;delete storageRuntime.__closedLoopStorageFault;}
  assert(error?.code==='INJECTED_STORAGE_FAILURE','Incremental import did not finish the real package/project/artifact verification path.');
  assert(fullTextReads===0,'Import materialized the entire decompressed package text.');
});
await storageRegression('import:json-semantics-and-adversarial-streams',async()=>{
  const compress=text=>new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
  const documents=[JSON.stringify({project:{text:('x'.repeat(16377)+'é🙂"\\\n').repeat(8)},artifacts:[{base64:'YWJj\n'.repeat(16384)}]}),' {"__proto__":{"keep":"data"},"project":{"x":1,"x":2},"artifacts":[{"base64":"bad","base64":"YWJj\\n"}]} ', '{"artifacts":[{"base64":"YWJj","base64":null}],"extra":-0,"n":1.2e3}', '[null,true,false,0,-1,"escape\\uD83D\\uDE42","slashes\\\\\\/end"]'];
  for(const text of documents){const {payload,fileContents}=await storageRuntime.decodePackageForTest(await compress(text));for(const row of payload?.artifacts||[]){const source=fileContents.get(row);if(source)row.base64=await source.blob.text();}assert(JSON.stringify(payload)===JSON.stringify(JSON.parse(text)),'Incremental package JSON changed string, duplicate-key, number, or object semantics.');}
  const canonicalText='{"artifacts":[{"base64":"Y\\u0057Jj\\n"}],"project":{"raw":"preserve é🙂\\n\\t\\\\\\\""}}',decoded=await storageRuntime.decodePackageForTest(await compress(canonicalText));
  const chunks=[];for await(const chunk of storageRuntime.packageChunksForTest(decoded.payload,decoded.fileContents))chunks.push(chunk);
  assert(createHash('sha256').update(chunks.join('')).digest('hex')===createHash('sha256').update(globalThis.closedLoopHash.stableStringify(JSON.parse(canonicalText))).digest('hex'),'Spooling changed the canonical package hash preimage.');
  for(const text of ['','{','[1,]','{"a":1,}','{"a" 1}','{"a":01}','{"a":tru}','{"a":"bad\\q"}','{"a":"bad\\u12Z4"}','{"a":"raw\nnewline"}','{}{}','[1 2]','[1}\n','{"a":1}\u000b']){let rejected=false;try{await storageRuntime.decodePackageForTest(await compress(text));}catch{rejected=true;}assert(rejected,'Malformed incremental JSON was accepted: '+JSON.stringify(text));}
  const valid=JSON.parse(await new Response(storageRuntime.goodBackup.stream().pipeThrough(new DecompressionStream('gzip'))).text());
  for(const mutate of [p=>p.packageSha256='0'.repeat(64),p=>{p.artifacts[0].base64+='=';},p=>{p.artifacts[0].base64='AA==AAAA';}]){
    const candidate=structuredClone(valid);mutate(candidate);if(candidate.packageSha256!=='0'.repeat(64)){const {packageSha256,...body}=candidate;candidate.packageSha256=globalThis.closedLoopHash.sha256Value(body);}
    const before=await storageRuntime.projectStore.readProject(valid.project.job.JOB_ID);let rejected=false;try{await storageRuntime.projectStore.importPackage(await compress(JSON.stringify(candidate)));}catch{rejected=true;}const after=await storageRuntime.projectStore.readProject(before.job.JOB_ID);assert(rejected&&after.projectSha256===before.projectSha256,'Late hash/padding failure changed an existing project.');
  }
});
await storageRegression('artifact-queries:project-local-without-store-scan',async()=>{
  storageAccess.length=0;await storageRuntime.projectStore.listArtifacts('BACKUP-CLOSURE');
  assert(!storageAccess.some(row=>row.name==='artifacts'&&row.kind==='getAll'),'Project file listing scanned unrelated artifact rows.');
  storageAccess.length=0;await storageRuntime.projectStore.importPackage(storageRuntime.goodBackup);
  assert(!storageAccess.some(row=>row.name==='artifacts'&&row.kind==='getAll'),'Package collision/cleanup scanned unrelated artifact rows.');
  await vm.runInContext(`(async()=>{globalThis.deleteQueryProject=await makeStored('DELETE-QUERY');})()`,storageRuntime);
  storageAccess.length=0;await storageRuntime.projectStore.removeProject('DELETE-QUERY');
  assert(!storageAccess.some(row=>row.name==='artifacts'&&row.kind==='getAll'),'Deleting one project scanned unrelated artifact rows.');
});
const importStart=app.indexOf("$('#import-file').onchange="),importEnd=app.indexOf('\nglobalThis.closedLoopAppReady',importStart);
await storageRegression('backup:required-prompt-context',async()=>{
  await vm.runInContext(`(async()=>{let p=await makeStored('BACKUP-CONTEXT');p.job.EXACT_USER_OBJECTIVE_VERBATIM='Required context content. '.repeat(4000);const prompt=closedLoopPromptEngine.buildPromptRecord(1,p,{operation:'COMPLETE'});p.projectData.generatedPrompts.push(prompt);p=await projectStore.writeProject(p,{expectedProjectRevision:p.revision});const rows=await projectStore.listArtifacts(p.job.JOB_ID),context=rows.find(row=>row.lineage?.kind==='PROMPT_CONTEXT');if(!context)throw new Error('The real instruction did not materialize its context fixture.');await projectStore.exportPackage(p.job.JOB_ID);await projectStore.deleteArtifact(context.artifactId,p.job.JOB_ID);})()`,storageRuntime);
  let rejected=false;try{await storageRuntime.projectStore.exportPackage('BACKUP-CONTEXT');}catch(error){rejected=error.code==='PACKAGE_ARTIFACT_CUSTODY_MISMATCH';}
  assert(rejected,'Complete export omitted the exact context file required by a saved instruction.');
  const report=await storageRuntime.projectStore.verifyProjectArtifacts('BACKUP-CONTEXT');
  assert(!report.verified&&report.artifacts.some(row=>row.issue==='MISSING_STORED_BLOB'),'Stored-file verification ignored missing saved instruction context bytes.');
});
assert(importStart>=0&&importEnd>importStart,'Production import handler is missing.');
vm.runInContext(app.slice(importStart,importEnd),storageRuntime);
await storageRegression('import:post-commit-refresh-failure',async()=>{
  await vm.runInContext(`globalThis.projects=[backupProject];globalThis.current=backupProject;globalThis.failures=[];globalThis.refreshProjectStorage=async()=>{throw new Error('CONTROLLED_REFRESH_FAILURE');};`,storageRuntime);
  storageAccess.length=0;await storageRuntime.elements['#import-file'].onchange({target:{files:[storageRuntime.goodBackup],value:'selected'}});
  assert(!storageAccess.some(x=>x.name==='projects'&&x.kind==='getAll'),'Import reloaded every unrelated project after committing.');
  const committed=await storageRuntime.projectStore.readProject('BACKUP-CLOSURE');
  assert(committed.revision>storageRuntime.backupProject.revision,'The import did not reach its real commit boundary.');
  assert(storageRuntime.current.revision===committed.revision&&storageRuntime.projects[0].revision===committed.revision,'Refresh failure restored stale in-memory state after a successful import.');
  assert(storageRuntime.failures.some(x=>/imported|saved/i.test(x)&&/refresh/i.test(x))&&!storageRuntime.failures.some(x=>/unchanged|without changing|rejected/i.test(x)),`Post-commit failure falsely reported a rollback: ${storageRuntime.failures.join(' | ')}`);
});
await storageRegression('import:pre-commit-failure-preserves-state',async()=>{
  const before=storageRuntime.current,ids=storageRuntime.projects;
  storageRuntime.failures.length=0;
  await storageRuntime.elements['#import-file'].onchange({target:{files:[new Blob(['invalid package'])],value:'selected'}});
  assert(storageRuntime.current===before&&storageRuntime.projects===ids,'Rejected import replaced existing in-memory projects.');
  assert(storageRuntime.failures.some(x=>/without changing existing projects/i.test(x)),'Pre-commit import failure lost its accurate rejection message.');
});
await storageRegression('delete:verified-selection-before-async-refresh',async()=>{
  vm.runInContext(appFunction('deleteCurrentProject'),storageRuntime);vm.runInContext(appFunction('syncDeleteProjectControl'),storageRuntime);
  await vm.runInContext(`(async()=>{globalThis.deletingUi=await makeStored('DELETE-UI-A');globalThis.replacementUi=await makeStored('DELETE-UI-B');projects=[deletingUi,replacementUi];current=deletingUi;elements['#delete-project-confirmation']={value:deletingUi.job.JOB_ID};elements['#delete-project']={disabled:false};globalThis.refreshProjectStorage=async()=>{};})()`,storageRuntime);
  let entered,release;const reached=new Promise(resolve=>entered=resolve),held=new Promise(resolve=>release=resolve),baseStore=storageRuntime.projectStore;
  storageRuntime.projectStore={...baseStore,listProjectSummaries:async()=>{entered();await held;return baseStore.listProjectSummaries();}};
  const deletion=storageRuntime.deleteCurrentProject();await reached;const selectedAfterCommit=storageRuntime.current;
  vm.runInContext(`current.activeView='Workflow';current.activeStage=2;`,storageRuntime);release();await deletion;storageRuntime.projectStore=baseStore;
  assert(selectedAfterCommit.job.JOB_ID==='DELETE-UI-B'&&selectedAfterCommit.stages[1],'Deletion exposed an unloaded/deleted project while refreshing its view.');
  assert(storageRuntime.current.activeView==='Workflow'&&storageRuntime.current.activeStage===2,'Post-delete refresh reset navigation that happened after commit.');
});
await storageRegression('startup:retained-refresh-keeps-snapshot-revision',async()=>{
  vm.runInContext(appFunction('importSeed'),storageRuntime);vm.runInContext(appFunction('retainedProjectForBuild'),storageRuntime);
  vm.runInContext(app.split('\n').find(line=>line.startsWith('async function load(){')),storageRuntime);
  await vm.runInContext(`(async()=>{const p=ensureState(core.createBlankState('RETAINED-CONCURRENT'));p.isRetainedTestProject=true;p.retainedSpecRevision='old';await projectStore.writeProject(p,{expectedProjectRevision:0});globalThis.nextRetained=clone(p);nextRetained.retainedSpecRevision='new';globalThis.loadAcceptanceSession=async()=>{};globalThis.refreshProjectStorage=async()=>{};globalThis.fetch=async()=>{const newer=await projectStore.readProject(p.job.JOB_ID);newer.newerWork='PRESERVE DURING FETCH';await projectStore.writeProject(newer,{expectedProjectRevision:newer.revision});return {ok:true,json:async()=>nextRetained};};})()`,storageRuntime);
  await vm.runInContext('load()',storageRuntime);
  const after=await storageRuntime.projectStore.readProject('RETAINED-CONCURRENT');
  assert(after.newerWork==='PRESERVE DURING FETCH','Startup read a fresh revision and used it to overwrite intervening retained-project work.');
});

await storageRegression('startup:unchanged-build-reuses-retained-project',async()=>{
  await vm.runInContext(`(async()=>{globalThis.RUNTIME_BUILD_ID='BUILD-RETAINED-CACHE';globalThis.retainedFetches=0;const retained=await projectStore.readProject('RETAINED-CONCURRENT');globalThis.fetch=async()=>{retainedFetches++;return {ok:true,json:async()=>retained};};await projectStore.metaPut('retainedProjectSuppressed',false);})()`,storageRuntime);
  await vm.runInContext('load();',storageRuntime);await vm.runInContext('load();',storageRuntime);
  assert(storageRuntime.retainedFetches===1,'Unchanged build fetched and rebuilt its bundled project on every startup.');
  storageRuntime.RUNTIME_BUILD_ID='BUILD-RETAINED-CHANGED';await vm.runInContext('load();',storageRuntime);
  assert(storageRuntime.retainedFetches===2,'Changed build failed to check the bundled project.');
});
await storageRegression('startup:picker-projection-and-selected-only',async()=>{
  for(const count of [1,10,50]){
    for(let i=0;i<count;i++)if(!storageRows.get('projects')?.has('PICKER-'+i))await vm.runInContext(`makeStored('PICKER-${i}')`,storageRuntime);
    await vm.runInContext(`projectStore.metaPut('retainedProjectSuppressed',true)`,storageRuntime);
    await vm.runInContext(`projectStore.metaPut('selectedProject','PICKER-0')`,storageRuntime);
    const unrelated=storageRows.get('projects').get('PICKER-'+(count-1));if(count>1)unrelated.project.projectData.rawResponses.push({rawText:'unrelated archived history '.repeat(10000)});
    storageAccess.length=0;
    await vm.runInContext('load()',storageRuntime);
    assert(!storageAccess.some(row=>row.name==='projects'&&row.kind==='getAll'),'Startup loaded every canonical project row.');
    assert(storageAccess.filter(row=>row.name==='projects'&&row.kind==='get').every(row=>row.key==='PICKER-0'),'Startup opened an unrelated project before the selected view.');
    assert(storageRuntime.current.job.JOB_ID==='PICKER-0'&&storageRuntime.current.stages[1],'Startup failed to open the selected verified project.');
  }
  let error;try{await storageRuntime.projectStore.readProject('PICKER-49');}catch(e){error=e;}
  assert(error?.code==='PROJECT_HASH_MISMATCH','Opening a corrupt unloaded project bypassed integrity verification.');
  assert(!storageRows.get('projects').has('PICKER-49')&&[...storageRows.get('meta').keys()].some(key=>key.startsWith('quarantine:PICKER-49:')),'Opening a corrupt unloaded project did not preserve it in quarantine.');
});

// Execute both contexts of the same production owner and simulate a lost worker
// acknowledgement after its real transaction logic commits to the test database.
let dropWorkerReply=false,workerExecutions=0;
class StoreWorkerFixture{
  constructor(url){
    this.stopped=false;let listener;
    const worker=vm.createContext({Blob,Uint8Array,ArrayBuffer,DataView,TextEncoder,TextDecoder,ReadableStream,CompressionStream,DecompressionStream,Response,URL,URLSearchParams,crypto:globalThis.crypto,btoa,atob,setTimeout,console,Event:globalThis.Event,dispatchEvent:()=>true,location:new URL(url),openStorageTransaction:storageRuntime.openStorageTransaction,addEventListener:(type,callback)=>{if(type==='message')listener=callback;},postMessage:message=>{if(this.stopped)return;if(dropWorkerReply){dropWorkerReply=false;this.onerror?.({message:'CONTROLLED_LOST_COMMITTED_REPLY'});}else this.onmessage?.({data:storageRead(message)});}});
    const parseWorkerJson=vm.runInContext('text=>JSON.parse(text)',worker);
    worker.workerRead=value=>storageRead(value,parseWorkerJson);
    worker.importScripts=(...urls)=>{for(const url of urls){const file=String(url).split('?')[0];vm.runInContext(fs.readFileSync(file,'utf8'),worker,{filename:file});}};
    vm.runInContext(storageSource.replace('Promise.resolve(req.result)','Promise.resolve(workerRead(req.result))'),worker);
    this.deliver=message=>listener({data:storageRead(message,parseWorkerJson)});
  }
  postMessage(message){workerExecutions++;this.deliver(message);}
  terminate(){this.stopped=true;}
}
storageRuntime.document={currentScript:{src:'https://example.test/project-store.js?v=WORKER-REGRESSION'}};storageRuntime.URL=URL;storageRuntime.URLSearchParams=URLSearchParams;storageRuntime.Worker=StoreWorkerFixture;
vm.runInContext(storageSource,storageRuntime);storageRuntime.projectStore=storageRuntime.closedLoopProjectStore;
await storageRegression('storage-worker:same-authorities-and-cas',async()=>{
  const before=workerExecutions;const p=await vm.runInContext(`makeStored('WORKER-CAS')`,storageRuntime);
  assert(workerExecutions===before+1,'Canonical save did not dispatch to the same store in its worker context.');
  const saved=await storageRuntime.projectStore.readProject(p.job.JOB_ID);assert(saved.projectSha256===p.projectSha256&&saved.revision===p.revision,'Worker changed canonical digest or revision.');
  let error;try{await storageRuntime.projectStore.writeProject(p,{expectedProjectRevision:p.revision-1});}catch(e){error=e;}
  assert(error?.code==='STALE_PROJECT_REVISION'&&error.existingProjectsUnchanged===true,'Worker lost the revision-conflict rejection.');
});
await storageRegression('storage-worker:commit-survives-lost-reply',async()=>{
  dropWorkerReply=true;const p=await vm.runInContext(`makeStored('WORKER-LOST-REPLY')`,storageRuntime);
  const saved=await storageRuntime.projectStore.readProject(p.job.JOB_ID);
  assert(saved.revision===p.revision&&saved.projectSha256===p.projectSha256,'Lost worker reply was treated as rollback or repeated the committed mutation.');
});
await storageRegression('storage-worker:atomic-abort-and-import-recovery',async()=>{
  storageRuntime.__closedLoopStorageFault='before-transaction-commit';let error;
  try{await vm.runInContext(`makeStored('WORKER-ABORT')`,storageRuntime);}catch(e){error=e;}finally{delete storageRuntime.__closedLoopStorageFault;}
  assert(error?.code==='INJECTED_STORAGE_FAILURE'&&!(await storageRuntime.projectStore.readProject('WORKER-ABORT')),'Worker acknowledged a partially committed save.');
  dropWorkerReply=true;const restored=await storageRuntime.projectStore.importPackage(storageRuntime.goodBackup);
  assert(restored.job.JOB_ID==='BACKUP-CLOSURE'&&(await storageRuntime.projectStore.getArtifact('BACKUP-FILE')),'Worker lost a committed import and its bytes after response failure.');
});
assert(lifecycleFailures.length===0,JSON.stringify(lifecycleFailures,null,2));
console.log(JSON.stringify({projectLifecycleControls:true,compactHeader:true,mobileProjectActionsVisible:true,dangerHiddenByDefault:true,transactionalDeleteRetained:true,lifecycleMetadataDeleteAtomic:true,durableAttemptAbandonment:true,canonicalBlobReverification:true,applicationCustodyBlocking:true,custodyFailureRecoveryBehavior:true,staleDeliveryAuthorizationNotResurrected:true,perProjectBackupState:true,zeroLossAcceptanceReduction:true,queuedHandoffFilesPreserved:true,exportNavigationGuard:true,completeExportIdentityAfterNavigation:true,serializedCompletePackages:true,completeExportFailureRecovery:true,unsafeOverrides:0}));
