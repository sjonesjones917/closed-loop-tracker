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
const storageRead=value=>{if(value===undefined)return undefined;const {blob,...fields}=value,copy=parseStorageJson(JSON.stringify(fields));if(blob)copy.blob=blob;return copy;};
storageRuntime.openStorageTransaction=async(names,mode)=>{
  const selected=Array.isArray(names)?names:[names],pending=new Map(selected.map(name=>[name,new Map(storageRows.get(name)||[])]));
  return {objectStore:name=>({get:key=>{storageAccess.push({kind:'get',name,key});return {result:storageRead(pending.get(name).get(key))};},getAll:()=>{storageAccess.push({kind:'getAll',name});return {result:[...pending.get(name).values()].map(storageRead)};},count:()=>({result:pending.get(name).size}),put:row=>{storageAccess.push({kind:'put',name,key:row.jobId||row.key||row.artifactId});pending.get(name).set(name==='projects'?row.jobId:name==='artifacts'?row.artifactId:row.key,structuredClone(row));},delete:key=>pending.get(name).delete(key)}),commit(){if(mode==='readwrite')for(const [name,rows] of pending)storageRows.set(name,rows);},abort(){}};
};
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInContext(fs.readFileSync(file,'utf8'),storageRuntime,{filename:file});
const storageSource=store
  .replace(/const request=req=>[^\n]+/, 'const request=req=>Promise.resolve(req.result);')
  .replace(/const complete=tx=>[^\n]+/, 'const complete=async tx=>tx.commit();')
  .replace(/async function openTransaction\([\s\S]*?\n}\n/, 'async function openTransaction(stores,mode="readonly"){return openStorageTransaction(stores,mode);}\n');
vm.runInContext(storageSource,storageRuntime);
vm.runInContext(`globalThis.core=closedLoopCore;globalThis.engine=closedLoopWorkflowEngine;globalThis.schema=closedLoopWorkflowSchema;globalThis.projectStore=closedLoopProjectStore;globalThis.clone=value=>JSON.parse(JSON.stringify(value));globalThis.safe=value=>Array.isArray(value)?value:[];globalThis.views=['Overview','Project','Workflow'];globalThis.projects=[];globalThis.current=null;globalThis.projectUi={};globalThis.jobFields=[['JOB_TITLE'],['EXACT_USER_OBJECTIVE_VERBATIM']];globalThis.announce=()=>{};globalThis.render=()=>{};globalThis.refreshProjectStorage=async()=>{};globalThis.failures=[];globalThis.reportActionFailure=message=>failures.push(String(message));globalThis.elements={};globalThis.$=selector=>elements[selector]??=( {click(){}} );`,storageRuntime);
const appFunction=name=>{
  const match=new RegExp(`(?:async )?function ${name}\\(`).exec(app);if(!match)return '';
  const start=match.index,rest=app.slice(start),next=/\n(?:async )?function \w+\(/.exec(rest);
  return next?rest.slice(0,next.index):rest.slice(0,rest.indexOf('\n'));
};
for(const name of ['blankStage','ensureState','projectDisplayName','saveProjectUi','persistAll','persistNewProject','persistReplacement','save','createUniqueJobId','addNew','duplicateCurrentProject','archiveCurrentProject']){const source=appFunction(name);if(source)vm.runInContext(source,storageRuntime);}
vm.runInContext(`globalThis.projectUiEntry=id=>projectUi[id]||{};globalThis.projectIsArchived=p=>Boolean(projectUiEntry(p.job.JOB_ID).archivedAt);globalThis.projectDisplayName=p=>p.job.JOB_TITLE||p.job.JOB_ID;globalThis.normalize=p=>ensureState(p);globalThis.makeStored=async id=>{const p=ensureState(core.createBlankState(id));return projectStore.writeProject(p,{expectedProjectRevision:0});};`,storageRuntime);
const lifecycleFailures=[];
async function storageRegression(name,run){try{await run();console.log(JSON.stringify({storageRegression:name,passed:true}));}catch(error){lifecycleFailures.push({name,message:error.message});console.log(JSON.stringify({storageRegression:name,passed:false,message:error.message}));}}
for(const action of ['addNew','duplicateCurrentProject','archiveCurrentProject'])await storageRegression(`${action}:preserve-newer-project`,async()=>{
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
await storageRegression('startup:retained-refresh-keeps-snapshot-revision',async()=>{
  vm.runInContext(appFunction('importSeed'),storageRuntime);
  vm.runInContext(app.split('\n').find(line=>line.startsWith('async function load(){')),storageRuntime);
  await vm.runInContext(`(async()=>{const p=ensureState(core.createBlankState('RETAINED-CONCURRENT'));p.isRetainedTestProject=true;p.retainedSpecRevision='old';await projectStore.writeProject(p,{expectedProjectRevision:0});globalThis.nextRetained=clone(p);nextRetained.retainedSpecRevision='new';globalThis.loadAcceptanceSession=async()=>{};globalThis.refreshProjectStorage=async()=>{};globalThis.fetch=async()=>{const newer=await projectStore.readProject(p.job.JOB_ID);newer.newerWork='PRESERVE DURING FETCH';await projectStore.writeProject(newer,{expectedProjectRevision:newer.revision});return {ok:true,json:async()=>nextRetained};};})()`,storageRuntime);
  await vm.runInContext('load()',storageRuntime);
  const after=await storageRuntime.projectStore.readProject('RETAINED-CONCURRENT');
  assert(after.newerWork==='PRESERVE DURING FETCH','Startup read a fresh revision and used it to overwrite intervening retained-project work.');
});
assert(lifecycleFailures.length===0,JSON.stringify(lifecycleFailures,null,2));
console.log(JSON.stringify({projectLifecycleControls:true,compactHeader:true,mobileProjectActionsVisible:true,dangerHiddenByDefault:true,transactionalDeleteRetained:true,lifecycleMetadataDeleteAtomic:true,durableAttemptAbandonment:true,canonicalBlobReverification:true,applicationCustodyBlocking:true,custodyFailureRecoveryBehavior:true,staleDeliveryAuthorizationNotResurrected:true,perProjectBackupState:true,zeroLossAcceptanceReduction:true,queuedHandoffFilesPreserved:true,exportNavigationGuard:true,completeExportIdentityAfterNavigation:true,serializedCompletePackages:true,completeExportFailureRecovery:true,unsafeOverrides:0}));
