import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
const r=projectStoreRuntime(),{runtime,core,engine,prompts,ingestion,store,copy,rows}=r,cases=[];
const source=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8'),start=source.indexOf('async function persistReplacement('),end=source.indexOf('\nasync function save()',start);
Object.assign(runtime,{projectStore:store,clone:copy,captureCurrentView:async()=>{},captureView:()=>({}),withStorageActivity:(_label,fn)=>fn(),unloadInactiveProjects:()=>{},mobileSessionCurrent:()=>false,recordCommittedBoundary:async()=>{},render:()=>{}});vm.runInContext(source.slice(start,end)+'\nglobalThis.persist=persistReplacement;',runtime);
let p=core.createBlankState('UI-PERSISTENCE');p.job.EXACT_USER_OBJECTIVE_VERBATIM='Preserve the correct precondition revision.';engine.ensureShape(p);engine.recalculate(p);p=await store.writeProject(p,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});runtime.current=p;runtime.projects=copy([p]);
const draft=copy(p),reserved=prompts.reserveAndBuildPromptRecord(draft,1,{},{}).prompt;assert.equal(draft.revision,p.revision+1);
await assert.doesNotReject(async()=>{p=await runtime.persist(draft);},'RESERVATION_UI_COMMIT_ORACLE: the expected stored revision is the source revision, not the candidate revision');assert.equal(p.revision,reserved.reservationRevision);assert.equal((await store.readProject(p.job.JOB_ID)).projectData.generatedPrompts.at(-1).instructionId,reserved.instructionId);cases.push({name:'The real UI persistence owner commits a revision-advancing reservation against its source revision',result:'PASS'});
const stale=copy(p),independent=copy(p);independent.job.JOB_TITLE='Independent edit';const saved=await store.writeProject(independent,{expectedProjectRevision:p.revision});runtime.current=saved;runtime.projects=copy([saved]);stale.job.JOB_TITLE='Delayed stale edit';await assert.rejects(()=>runtime.persist(stale),error=>error.code==='STALE_PROJECT_REVISION');assert.equal((await store.readProject(p.job.JOB_ID)).job.JOB_TITLE,'Independent edit');cases.push({name:'A stale candidate cannot overwrite independent work even when the UI has loaded the newer revision',result:'PASS'});
// History display refresh follows the durable project transaction. A failure
// there cannot turn an acknowledged commit into a failed save or authorize
// deletion of an artifact now referenced by canonical state.
const recoveryReport={id:'operation-error',hidden:true,textContent:'',classes:new Set(),classList:{add(...names){names.forEach(name=>recoveryReport.classes.add(name));},remove(...names){names.forEach(name=>recoveryReport.classes.delete(name));}},setAttribute(){},append(){},scrollIntoView(){}};
runtime.$=selector=>selector==='#operation-error'?recoveryReport:null;
runtime.document={querySelectorAll:()=>[],createElement:()=>({})};
runtime.paintOperationStatus=()=>{};runtime.scheduleWorkflowActionInset=()=>{};
let bookkeepingFailures=0;runtime.recordCommittedBoundary=async()=>{bookkeepingFailures++;throw new Error('CONTROLLED_POST_COMMIT_HISTORY_REFRESH_FAILURE');};
const ordinary=copy(saved);ordinary.job.JOB_TITLE='Committed ordinary save';let ordinaryError=null;
try{await runtime.persist(ordinary);}catch(error){ordinaryError=error;}
const ordinaryStored=await store.readProject(saved.job.JOB_ID);
const ordinaryObservation={committed:ordinaryStored.job.JOB_TITLE==='Committed ordinary save',reportedFailure:Boolean(ordinaryError),warningVisible:!recoveryReport.hidden&&recoveryReport.classes.has('warn')};
cases.push({name:'Post-commit History refresh cannot report a committed ordinary save as failed',observation:ordinaryObservation});

const appFunction=name=>{const match=new RegExp(`(?:async )?function ${name}\\(`).exec(source);assert.ok(match,`Missing production UI owner ${name}`);const rest=source.slice(match.index),next=/\n(?:async )?function \w+\(/.exec(rest);return next?rest.slice(0,next.index):rest;};
const artifactIdFor=source.split('\n').find(line=>line.startsWith('const artifactIdFor='));assert.ok(artifactIdFor);
Object.assign(runtime,{core,engine,schema:runtime.closedLoopWorkflowSchema,safe:engine.safe,announce:()=>{},render:()=>{},recordMobileOperation:async()=>{},failures:[]});
runtime.reportActionFailure=error=>runtime.failures.push(String(error?.message||error));
vm.runInContext(artifactIdFor+'\n'+['logicalFilePath','storeArtifactFile','registerStageFiles'].map(appFunction).join('\n')+'\nglobalThis.intake=registerStageFiles;',runtime);
const intakeProject=async jobId=>{let project=core.createBlankState(jobId);engine.ensureShape(project);engine.recalculate(project);project=await store.writeProject(project,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});runtime.current=project;runtime.projects=[project];runtime.failures=[];return project;};
const inputFile=name=>{const blob=new Blob(['Exact retained input bytes é🙂'],{type:'text/plain'});Object.defineProperty(blob,'name',{value:name});return blob;};
const faultProject=await intakeProject('UI-POST-COMMIT-FILE');await runtime.intake([inputFile('fault.txt')]);
const faultRow=rows.get('projects').get(faultProject.job.JOB_ID)?.project,linkedId=faultRow?.projectData?.artifacts?.at(-1)?.id;
const faultObservation={canonicalLink:linkedId||null,bytesPresent:Boolean(linkedId&&await store.getArtifact(linkedId)),reportedFailure:runtime.failures.length>0};
cases.push({name:'Post-commit History refresh cannot remove committed Stage 01 input bytes',observation:faultObservation});
runtime.paintOperationStatus=()=>{throw new Error('CONTROLLED_NOTICE_WIDGET_FAILURE');};
recoveryReport.hidden=true;recoveryReport.classes.clear();
const widgetProject=await intakeProject('UI-POST-COMMIT-WIDGET');
const widgetFaultCandidate=copy(widgetProject);widgetFaultCandidate.job.JOB_TITLE='Committed despite broken warning widget';
let widgetError=null;try{await runtime.persist(widgetFaultCandidate);}catch(error){widgetError=error;}
const widgetObservation={committed:(await store.readProject(widgetProject.job.JOB_ID)).job.JOB_TITLE==='Committed despite broken warning widget',reportedFailure:Boolean(widgetError),warningVisible:!recoveryReport.hidden&&recoveryReport.classes.has('warn')};
runtime.paintOperationStatus=()=>{};
cases.push({name:'A warning-widget failure cannot change a committed transaction result',observation:widgetObservation});
// This synthetic slot isolates UI cleanup after a returned-file mapping commit.
// It does not establish a valid issued slot or proposal acceptance. The real
// slot-contract path remains covered by verify-returned-slot-authority.mjs.
vm.runInContext(appFunction('selectReturnedSlotFile')+'\nglobalThis.mapReturnedFile=selectReturnedSlotFile;',runtime);
runtime.ingestion={...ingestion,findRaw:(project,id)=>project.projectData.rawResponses.find(row=>row.rawResponseId===id),bindAttachmentSlots:(project,{rawResponseId,files})=>{const next=copy(project);next.projectData.rawResponses.find(row=>row.rawResponseId===rawResponseId).files=files;return {project:next};}};
runtime.pendingReturnedResponse=()=>runtime.current.projectData.rawResponses.at(-1);
runtime.reportResponseFailure=(message,error)=>runtime.failures.push(message+' '+String(error?.message||error));
let returned=core.createBlankState('UI-POST-COMMIT-RETURNED');engine.ensureShape(returned);returned.projectData.rawResponses.push(copy({rawResponseId:'RAW-RETURNED',stage:1,status:'PRESERVED',files:[]}));engine.recalculate(returned);
returned=await store.writeProject(returned,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});runtime.current=returned;runtime.projects=[returned];runtime.failures=[];
await runtime.mapReturnedFile('ISSUED-SLOT-1',inputFile('returned.txt'));
const returnedRaw=(await store.readProject(returned.job.JOB_ID))?.projectData?.rawResponses?.at(-1),returnedId=returnedRaw?.files?.[0]?.artifactId;
const returnedObservation={slotBound:returnedRaw?.files?.[0]?.attachmentSlotId==='ISSUED-SLOT-1',bytesPresent:Boolean(returnedId&&await store.getArtifact(returnedId)),reportedFailure:runtime.failures.length>0};
cases.push({name:'Post-commit History refresh cannot remove committed returned-slot bytes',observation:returnedObservation});
const noopBoundaryProject=await intakeProject('UI-NOOP-BOUNDARY');recoveryReport.hidden=true;recoveryReport.classes.clear();
let noopBoundaryError=null;try{await runtime.persist(copy(noopBoundaryProject),{operational:true});}catch(error){noopBoundaryError=error;}
const noopBoundaryStored=await store.readProject(noopBoundaryProject.job.JOB_ID);
const noopBoundaryObservation={unchangedRevision:noopBoundaryStored.revision===noopBoundaryProject.revision,sameHash:noopBoundaryStored.projectSha256===noopBoundaryProject.projectSha256,noOperationalJournal:!rows.get('meta').has('responseOperations:'+noopBoundaryProject.job.JOB_ID),reportedFailure:Boolean(noopBoundaryError),warningVisible:!recoveryReport.hidden&&recoveryReport.classes.has('warn'),claimedProjectSave:/project save completed|project change saved|project was saved/i.test(recoveryReport.textContent),reportedUnchanged:/project contents are unchanged/i.test(recoveryReport.textContent)};
cases.push({name:'No-op operational return with History fault reports unchanged project contents',observation:noopBoundaryObservation});
runtime.recordCommittedBoundary=async()=>{};recoveryReport.hidden=true;recoveryReport.classes.clear();
const controlProject=await intakeProject('UI-POST-COMMIT-CONTROL');await runtime.intake([inputFile('control.txt')]);
const controlRow=rows.get('projects').get(controlProject.job.JOB_ID)?.project,controlId=controlRow?.projectData?.artifacts?.at(-1)?.id;
assert.ok(controlId&&await store.getArtifact(controlId),'POST_COMMIT_FILE_CUSTODY_CONTROL: valid Stage 01 intake did not retain its canonical bytes.');
assert.equal(runtime.failures.length,0,'POST_COMMIT_FILE_CUSTODY_CONTROL: valid Stage 01 intake reported failure.');
cases.push({name:'Valid Stage 01 intake retains a canonical artifact and actual Blob bytes',result:'PASS'});
// The operator wrapper performs another view capture after its action returns.
// That later failure is outside the acknowledged canonical transaction.
vm.runInContext('var operatorActionInFlight=null,historyRestoreController=null,historyRestoreTail=null,actionFocusTarget=null,history={state:null};'+(source.includes('function confirmedCurrentActionCommit(')?appFunction('confirmedCurrentActionCommit'):'')+appFunction('runOperatorAction')+'\nglobalThis.runOperator=runOperatorAction;',runtime);
const finalCaptureProject=await intakeProject('UI-POST-COMMIT-FINAL-CAPTURE'),operatorFailures=[],operatorOutcomes=[];
Object.assign(runtime,{requestAnimationFrame:callback=>callback(),operationClock:()=>Date.now(),OPERATION_LOADING_THRESHOLD_MS:1500,paintOperatorAction:()=>{},recordOperationLatency:(_kind,_label,_startedAt,outcome)=>operatorOutcomes.push(outcome),focusAfterAction:()=>{}});
runtime.reportActionFailure=error=>{operatorFailures.push(String(error?.message||error));if(runtime.operatorActionInFlight)runtime.operatorActionInFlight.failed=true;};
let finalCaptureCalls=0;runtime.captureCurrentView=async()=>{if(++finalCaptureCalls===2)throw new Error('CONTROLLED_FINAL_VIEW_CAPTURE_FAILURE');};
const finalCaptureCandidate=copy(finalCaptureProject);finalCaptureCandidate.job.JOB_TITLE='Committed before final view failure';recoveryReport.hidden=true;recoveryReport.classes.clear();
await runtime.runOperator('Saving project',()=>runtime.persist(finalCaptureCandidate));
const finalCaptureObservation={committed:(await store.readProject(finalCaptureProject.job.JOB_ID)).job.JOB_TITLE==='Committed before final view failure',reportedFailure:operatorFailures.length>0,warningVisible:!recoveryReport.hidden&&recoveryReport.classes.has('warn'),outcome:operatorOutcomes.at(-1)};
cases.push({name:'Final view-capture failure retains a known committed operator result',observation:finalCaptureObservation});
runtime.captureCurrentView=async()=>{};recoveryReport.hidden=true;recoveryReport.classes.clear();operatorFailures.length=0;
const finalCaptureControl=copy(runtime.current);finalCaptureControl.job.JOB_TITLE='Valid final view capture';
await runtime.runOperator('Saving project',()=>runtime.persist(finalCaptureControl));
assert.equal((await store.readProject(finalCaptureProject.job.JOB_ID)).job.JOB_TITLE,'Valid final view capture');
assert.equal(operatorFailures.length,0);assert.equal(operatorOutcomes.at(-1),'COMPLETED');
cases.push({name:'Normal final view capture keeps the successful operator result',result:'PASS'});
runtime.captureCurrentView=async()=>{throw new Error('CONTROLLED_UNCOMMITTED_VIEW_FAILURE');};recoveryReport.hidden=true;recoveryReport.classes.clear();operatorFailures.length=0;
await runtime.runOperator('No canonical change',async()=>{});
assert.equal(operatorFailures.length,1,'UNCOMMITTED_FINAL_CAPTURE_ORACLE: an uncommitted view failure was presented as success.');
assert.equal(operatorOutcomes.at(-1),'FAILED','UNCOMMITTED_FINAL_CAPTURE_ORACLE: an uncommitted view failure was marked as a known commit.');
assert.equal(recoveryReport.hidden,true,'UNCOMMITTED_FINAL_CAPTURE_ORACLE: a false committed warning was shown.');
cases.push({name:'Uncommitted final view failure remains a failure',result:'PASS'});
// A later UI failure cannot erase the known slot-binding transaction. Load the
// production failure reporters so the operator-facing message is checked after
// their normal render path, rather than asserting only a mocked catch argument.
vm.runInContext(source.slice(source.indexOf('let actionFailureNotice=null;'),source.indexOf('const storageActivities=new Map();'))+appFunction('reportResponseFailure'),runtime);
runtime.captureCurrentView=async()=>{};
const mappedProject=async jobId=>{let project=core.createBlankState(jobId);engine.ensureShape(project);project.projectData.rawResponses.push(copy({rawResponseId:'RAW-RETURNED',stage:1,status:'PRESERVED',files:[]}));engine.recalculate(project);project=await store.writeProject(project,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});runtime.current=project;runtime.projects=[project];return project;};
const mappedFaultProject=await mappedProject('UI-POST-COMMIT-SLOT-RENDER');let slotRenderCalls=0,renderedResponseMessage='';
runtime.render=()=>{if(++slotRenderCalls===1)throw new Error('Controlled slot display failure');renderedResponseMessage=runtime.responseActionFailure?.message||'';};
await runtime.runOperator('Mapping returned file',()=>runtime.mapReturnedFile('ISSUED-SLOT-1',inputFile('render-fault.txt')));
const mappedFaultRaw=(await store.readProject(mappedFaultProject.job.JOB_ID)).projectData.rawResponses.at(-1),mappedFaultId=mappedFaultRaw.files?.[0]?.artifactId;
const mappedFaultObservation={slotBound:mappedFaultRaw.files?.[0]?.attachmentSlotId==='ISSUED-SLOT-1',bytesPresent:Boolean(mappedFaultId&&await store.getArtifact(mappedFaultId)),reportedSaved:renderedResponseMessage.includes('was saved'),reportedIncomplete:renderedResponseMessage.includes('did not finish'),claimedUnchanged:/unchanged/i.test(renderedResponseMessage),outcome:operatorOutcomes.at(-1)};
cases.push({name:'Post-commit returned-slot display failure reports saved mapping and unfinished action',observation:mappedFaultObservation});
const mappedControlProject=await mappedProject('UI-POST-COMMIT-SLOT-CONTROL');runtime.render=()=>{};runtime.responseActionFailure=null;
await runtime.runOperator('Mapping returned file',()=>runtime.mapReturnedFile('ISSUED-SLOT-1',inputFile('control-returned.txt')));
const mappedControlRaw=(await store.readProject(mappedControlProject.job.JOB_ID)).projectData.rawResponses.at(-1),mappedControlId=mappedControlRaw.files?.[0]?.artifactId;
assert.ok(mappedControlId&&await store.getArtifact(mappedControlId),'POST_COMMIT_SLOT_CONTROL: valid returned-slot UI mapping lost bytes.');
assert.equal(runtime.responseActionFailure,null,'POST_COMMIT_SLOT_CONTROL: valid returned-slot UI mapping reported failure.');
assert.equal(operatorOutcomes.at(-1),'COMPLETED','POST_COMMIT_SLOT_CONTROL: valid mapping did not complete.');
cases.push({name:'Valid returned-slot mapping completes and retains actual Blob bytes',result:'PASS'});
const postActionProject=await intakeProject('UI-POST-COMMIT-LATER-STEP');const postActionCandidate=copy(postActionProject);postActionCandidate.job.JOB_TITLE='Saved before later step';recoveryReport.hidden=true;recoveryReport.classes.clear();
await runtime.runOperator('Save then refresh',async()=>{await runtime.persist(postActionCandidate);throw new Error('Later view step failed');});
const postActionObservation={committed:(await store.readProject(postActionProject.job.JOB_ID)).job.JOB_TITLE==='Saved before later step',reportedSaved:recoveryReport.textContent.includes('was saved'),reportedIncomplete:recoveryReport.textContent.includes('did not finish'),outcome:operatorOutcomes.at(-1)};
cases.push({name:'Generic post-commit action failure reports partial result',observation:postActionObservation});
const preActionProject=await intakeProject('UI-PRE-COMMIT-FAILURE');recoveryReport.hidden=true;recoveryReport.classes.clear();
await runtime.runOperator('Fail before save',async()=>{throw new Error('Before save failed');});
const preActionObservation={unchanged:(await store.readProject(preActionProject.job.JOB_ID)).job.JOB_TITLE===preActionProject.job.JOB_TITLE,reportedSaved:recoveryReport.textContent.includes('was saved'),outcome:operatorOutcomes.at(-1)};
cases.push({name:'Pre-commit action error does not claim a saved change',observation:preActionObservation});
const sameHashProject=await intakeProject('UI-OPERATIONAL-SAME-HASH');const initialOperationalSha=sameHashProject.projectSha256;recoveryReport.hidden=true;recoveryReport.classes.clear();
await runtime.runOperator('Save operational view',async()=>{await runtime.persist(copy(runtime.current),{operational:true});throw new Error('Later operational view step failed');});
const sameHashStored=await store.readProject(sameHashProject.job.JOB_ID);
const sameHashObservation={unchangedRevision:sameHashStored.revision===sameHashProject.revision,sameHash:sameHashStored.projectSha256===initialOperationalSha,noOperationalJournal:!rows.get('meta').has('responseOperations:'+sameHashProject.job.JOB_ID),reportedSaved:recoveryReport.textContent.includes('was saved'),outcome:operatorOutcomes.at(-1)};
cases.push({name:'No-op operational write does not become a confirmed project change',observation:sameHashObservation});
const uncertainProject=await intakeProject('UI-UNCERTAIN-COMMIT');recoveryReport.hidden=true;recoveryReport.classes.clear();
await runtime.runOperator('Uncertain transaction',async()=>{throw Object.assign(new Error('Transaction result unavailable'),{existingProjectsUnchanged:false});});
const uncertainObservation={unchanged:(await store.readProject(uncertainProject.job.JOB_ID)).projectSha256===uncertainProject.projectSha256,reportedUnknown:recoveryReport.textContent.includes('needs verification'),reportedSaved:recoveryReport.textContent.includes('was saved'),outcome:operatorOutcomes.at(-1)};
cases.push({name:'Unacknowledged transaction outcome retains unknown-state recovery',observation:uncertainObservation});
if(process.env.APP_SOURCE)console.log(JSON.stringify({preFixObservations:cases.slice(-5)}));
assert.equal(bookkeepingFailures,5,'POST_COMMIT_FILE_CUSTODY_SETUP: expected controlled post-commit failures did not reach every owning path.');
assert.deepEqual(ordinaryObservation,{committed:true,reportedFailure:false,warningVisible:true},'ORDINARY_POST_COMMIT_RESULT_ORACLE: committed save reported failure or hid recovery warning.');
assert.ok(faultObservation.canonicalLink&&faultObservation.bytesPresent&&!faultObservation.reportedFailure,'POST_COMMIT_FILE_CUSTODY_ORACLE: a committed Stage 01 artifact lost bytes or reported storage failure.');
assert.deepEqual(widgetObservation,{committed:true,reportedFailure:false,warningVisible:true},'POST_COMMIT_NOTICE_WIDGET_ORACLE: a warning-widget error changed the reported committed outcome.');
assert.ok(returnedObservation.slotBound&&returnedObservation.bytesPresent&&!returnedObservation.reportedFailure,'POST_COMMIT_RETURNED_SLOT_ORACLE: a committed returned file lost bytes or reported failure.');
assert.deepEqual(noopBoundaryObservation,{unchangedRevision:true,sameHash:true,noOperationalJournal:true,reportedFailure:false,warningVisible:true,claimedProjectSave:false,reportedUnchanged:true},'NO_OP_BOUNDARY_REPORT_ORACLE: no-op History fault falsely claimed a saved canonical project change.');
assert.deepEqual(finalCaptureObservation,{committed:true,reportedFailure:false,warningVisible:true,outcome:'COMMITTED_VIEW_CAPTURE_FAILED'},'POST_COMMIT_FINAL_CAPTURE_ORACLE: final view-capture failure erased the known committed result or diagnostic.');
assert.deepEqual(mappedFaultObservation,{slotBound:true,bytesPresent:true,reportedSaved:true,reportedIncomplete:true,claimedUnchanged:false,outcome:'FAILED'},'POST_COMMIT_SLOT_MESSAGE_ORACLE: committed returned-slot mapping was presented as unchanged or complete.');
assert.deepEqual(postActionObservation,{committed:true,reportedSaved:true,reportedIncomplete:true,outcome:'FAILED'},'POST_COMMIT_PARTIAL_ACTION_ORACLE: acknowledged save was presented as unknown or complete after a later failure.');
assert.deepEqual(preActionObservation,{unchanged:true,reportedSaved:false,outcome:'FAILED'},'PRE_COMMIT_ACTION_CONTROL: failed pre-commit action falsely claimed saved data.');
assert.deepEqual(sameHashObservation,{unchangedRevision:true,sameHash:true,noOperationalJournal:true,reportedSaved:false,outcome:'FAILED'},'NO_OP_COMMIT_ORACLE: an unchanged operational return falsely claimed a saved project change.');
assert.deepEqual(uncertainObservation,{unchanged:true,reportedUnknown:true,reportedSaved:false,outcome:'FAILED'},'UNKNOWN_COMMIT_CONTROL: unacknowledged transaction outcome falsely claimed a save.');
console.log(JSON.stringify({synthetic:true,actualBrowser:false,environment:'Actual app persistence function and production store with lifecycle transaction adapter',cases},null,2));
