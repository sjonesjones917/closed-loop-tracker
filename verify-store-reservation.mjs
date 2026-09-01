import fs from 'node:fs';
import vm from 'node:vm';

const assert=(value,message)=>{if(!value)throw new Error(message);};
const store=fs.readFileSync('project-store.js','utf8');
const app=fs.readFileSync('app-core.js','utf8');

function declarations(source){
  const starts=[...source.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map(match=>({name:match[1],index:match.index}));
  return starts.map((entry,index)=>({name:entry.name,source:source.slice(entry.index,starts[index+1]?.index??source.length)}));
}

const storeFunctions=declarations(store),appFunctions=declarations(app);
const functionByName=(functions,name)=>functions.find(item=>item.name===name)?.source||'';
const functionMatching=(functions,predicate)=>functions.find(item=>predicate(item.source,item.name));

// Artifact bytes must move through the complete staged lifecycle in the one
// existing artifact store. Merely defining the labels is insufficient: the
// stage, promotion, and recovery paths must consume them.
for(const status of ['PENDING_BYTES','HASHED_AND_REVERIFIED','READY_FOR_PROMOTION','CANONICAL'])
  assert(store.includes(status),`Artifact staged lifecycle is missing ${status}.`);

const stageArtifact=functionMatching(storeFunctions,(body,name)=>
  /stage|put/i.test(name)&&
  body.includes('PENDING_BYTES')&&
  body.includes('HASHED_AND_REVERIFIED')&&
  body.includes('READY_FOR_PROMOTION')&&
  /sha256Bytes/.test(body)&&
  /arrayBuffer/.test(body));
assert(stageArtifact,'No artifact-staging function persists, reads back, rehashes, and advances bytes to READY_FOR_PROMOTION.');

const promoteArtifacts=functionMatching(storeFunctions,(body,name)=>
  /promot/i.test(name)&&
  body.includes('READY_FOR_PROMOTION')&&
  body.includes('CANONICAL')&&
  /openTransaction\(\[PROJECTS,ARTIFACTS(?:,META)?\],'readwrite'\)/.test(body)&&
  /expectedProjectRevision|EXPECTED_REVISION/.test(body));
assert(promoteArtifacts,'Artifact promotion must atomically compare the project revision and commit project metadata with exact staged bytes.');

const reconcileArtifacts=functionMatching(storeFunctions,(body,name)=>
  /reconcil|recover/i.test(name)&&
  /ORPHAN[^'"`]*STAG/i.test(body)&&
  /ORPHAN[^'"`]*CANON/i.test(body)&&
  /METADATA[^'"`]*WITHOUT[^'"`]*BYTES/i.test(body)&&
  /INTERRUPTED[^'"`]*PROMOTION/i.test(body)&&
  /STALE[^'"`]*STAG[^'"`]*RESERVATION/i.test(body));
assert(reconcileArtifacts,'Startup artifact reconciliation must classify orphan staged bytes, orphan canonical bytes, metadata without bytes, interrupted promotions, and stale staging reservations.');
for(const token of ['reconcileArtifactCustodyVerification','AVAILABILITY','UNAVAILABLE','projects.put','updatedProjects'])
  assert(reconcileArtifacts.source.includes(token),`Startup artifact reconciliation does not make missing canonical custody fail closed through ${token}.`);

const storeExport=store.slice(store.indexOf('globalThis.closedLoopProjectStore=Object.freeze'));
for(const fn of [stageArtifact,promoteArtifacts,reconcileArtifacts])
  assert(storeExport.includes(fn.name),`Project store does not export ${fn.name}.`);

const readyStart=store.indexOf('const ready=');
assert(readyStart>=0,'Project store startup readiness path is missing.');
const readySource=store.slice(readyStart,store.indexOf('globalThis.closedLoopProjectStore=Object.freeze',readyStart));
assert(readySource.includes(`${reconcileArtifacts.name}(`),'Project-store startup does not reconcile staged/canonical artifact custody.');

const registerStageFiles=functionByName(appFunctions,'registerStageFiles');
assert(registerStageFiles,'Application artifact registration function is missing.');
assert(registerStageFiles.includes(`projectStore.${stageArtifact.name}(`),'Visible file intake does not use staged artifact custody.');
assert(registerStageFiles.includes(`projectStore.${promoteArtifacts.name}(`),'Visible file intake does not atomically promote staged bytes with canonical metadata.');
assert(!registerStageFiles.includes('projectStore.putArtifact('),'Visible file intake still writes directly to canonical artifact custody.');

const load=functionByName(appFunctions,'load');
assert(load,'Application startup function is missing.');
assert(load.includes('await projectStore.ready'),'Application startup does not await the project-store recovery boundary.');
assert(load.indexOf('await projectStore.ready')<load.indexOf('projectStore.readAll('),'Project-store recovery must finish before projects are activated from storage.');

// A verification package is never free-floating. It is derived from the one
// current canonical ACTIVE reservation and echoes all replay-resistant binding
// values into its manifest.
const createPackage=functionByName(storeFunctions,'createExecutionPackage');
assert(createPackage,'Project store execution-package builder is missing.');
for(const token of ['operationReservations','ACTIVE','EXPECTED_REVISION','CHALLENGE_NONCE','BINDING_RECEIPT_ID','BINDING_RECEIPT_SHA256','PROMPT_BODY_SHA256','PROMPT_CONTRACT_SHA256','PROMPT_CONTEXT_SIGNATURE','PROMPT_SCOPE_HASH'])
  assert(createPackage.includes(token),`Execution-package validation is not bound to reservation ${token}.`);
for(const token of ['PACKAGE_ID','OPERATION_RESERVATION_ID','challengeNonce','currentProjectRevision','scopeHash','promptIdentity','contextSignature','reservationBindingReceiptId','reservationBindingReceiptSha256'])
  assert(createPackage.includes(token),`Execution-package manifest is missing ${token}.`);
assert(/operationReservationId|reservationId/.test(createPackage),'Execution-package construction does not require an explicit reservation identity.');
assert(/isActiveRecord|active\s*!==\s*false/.test(createPackage),'Execution-package construction does not reject inactive reservation records.');
assert(/scopeHash/.test(createPackage)&&/sha256Value/.test(createPackage),'Execution-package scope is not hash-bound.');
assert(/sha256Value\(binding\)/.test(createPackage),'Execution-package construction does not recompute the reservation binding receipt.');
assert(/responseContractDescriptor\(normalizedStage,normalizedOperation,promptReservationBinding\)/.test(createPackage),'Execution package does not carry the exact bound response contract used by the prompt.');

const savePrompt=functionByName(appFunctions,'savePromptRecord');
assert(savePrompt,'Visible prompt-save action is missing.');
for(const token of ['engine.reserveOperation(','buildPromptRecord(','engine.registerGeneratedPrompt(','engine.bindOperationReservation(','persistReplacement('])
  assert(savePrompt.includes(token),`Reservation-bound prompt commit is missing ${token}.`);
const reservePromptIndex=savePrompt.indexOf('engine.reserveOperation('),finalPromptIndex=savePrompt.lastIndexOf('buildPromptRecord('),registerPromptIndex=savePrompt.indexOf('engine.registerGeneratedPrompt('),bindPromptIndex=savePrompt.indexOf('engine.bindOperationReservation('),persistPromptIndex=savePrompt.indexOf('persistReplacement(');
assert(reservePromptIndex<finalPromptIndex&&finalPromptIndex<registerPromptIndex&&registerPromptIndex<bindPromptIndex&&bindPromptIndex<persistPromptIndex,'Prompt save must reserve, build the final bound prompt, register, bind, and persist in one ordered CAS commit.');
assert(savePrompt.includes('operationReservation:operationReservationId'),'Final prompt construction does not consume the exact canonical reservation.');

const downloadPackage=functionByName(appFunctions,'downloadExecutionPackage');
assert(downloadPackage,'Visible execution-package action is missing.');
for(const token of ['reservationBoundToPrompt(','projectStore.createExecutionPackage('])
  assert(downloadPackage.includes(token),`Execution-package UI path is missing ${token}.`);
assert(!downloadPackage.includes('engine.reserveOperation(')&&!downloadPackage.includes('persistReplacement('),'Package download must consume the already committed prompt reservation, not create later unbound state.');
assert(/packageId(?:\s*:|\s*[,}])/.test(downloadPackage),'The UI does not allocate and bind PACKAGE_ID before reservation persistence.');
assert(/(?:operationReservationId|reservationId)(?:\s*:|\s*[,}])/.test(downloadPackage),'The UI does not pass the persisted reservation identity into package creation.');
assert(!app.includes('downloadReservedExecutionPackage')&&!/^\s*downloadExecutionPackage\s*=/m.test(app),'The visible package control must use one integrated reservation-only package builder, not a runtime reassignment.');
assert(app.includes('CONTROLLING INSTRUCTION NOT YET RESERVED')&&app.includes('No response to an unbound preview can be accepted.'),'The UI can expose an unbound prompt preview as an actionable instruction.');
const currentStagePrompt=functionByName(appFunctions,'currentStagePrompt'),currentPromptRecord=functionByName(appFunctions,'currentPromptRecord');
assert(currentStagePrompt?.includes('CONTROLLING INSTRUCTION NOT YET RESERVED')&&currentStagePrompt.includes("if(!/^COPY BLOCK\\b/.test(text))return text"),'The visible prompt path may expose a generated preview before proving a current persisted prompt/reservation receipt exists.');
assert(currentPromptRecord?.includes('promptReservationBindingValid(record,item)')&&!/^\s*currentPromptRecord\s*=/m.test(app),'Current prompt selection must be implemented once and require the reservation binding receipt.');
for(const reassignment of ['release=releaseV3','saveJob=async function','stagePurposeMarkup=stagePurposeMarkupV3'])assert(!app.includes(reassignment),`UI behavior is monkey-patched at runtime: ${reassignment}.`);
const promptBindingValidator=functionByName(appFunctions,'promptReservationBindingValid');
assert(promptBindingValidator?.includes('BINDING_RECEIPT_SHA256')&&promptBindingValidator.includes('sha256Value(binding)'),'The visible prompt path does not recompute the exact reservation binding receipt before display, copy, or package download.');
const saveHumanAnswers=functionByName(appFunctions,'saveHumanAnswers');
assert(saveHumanAnswers?.includes('replacementPromptTargets')&&saveHumanAnswers.includes('savePromptRecord('),'Human clarification does not reserve and persist the exact replacement prompt target after the new input version commits.');
assert(saveHumanAnswers.indexOf('persistReplacement(result.project)')<saveHumanAnswers.indexOf('savePromptRecord('),'Human clarification must commit the answered input version before reserving its replacement prompt.');
assert(!/^(?:release|currentPromptRecord|downloadExecutionPackage|saveJob|currentStagePrompt|stagePurposeMarkup)\s*=/m.test(app),'UI behavior is replaced by a runtime monkey patch instead of one integrated implementation.');

// Exercise the application-owned reservation semantics without a browser.
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','project-store.js'])
  vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,promptEngine=globalThis.closedLoopPromptEngine,projectStore=globalThis.closedLoopProjectStore,hash=globalThis.closedLoopHash;
const project=core.createBlankState('JOB-STORE-RESERVATION');
engine.ensureShape(project);
project.revision=7;
const reservationInput={stage:1,operation:'COMPLETE',targetSlot:'STAGE-01-COMPLETE',packageId:null,promptId:'PROMPT-STORE-001',owningTabInstance:'TAB-A',payload:{tests:['TEST-001']}};
const reservation=engine.reserveOperation(project,reservationInput);
assert(String(engine.recordValue(reservation,'STATUS'))==='ACTIVE','New operation reservation is not ACTIVE.');
assert(String(engine.recordValue(reservation,'PACKAGE_ID')||'')==='','A no-package operation acquired an unauthorized package identity.');
assert(Number(engine.recordValue(reservation,'EXPECTED_REVISION'))===7,'Reservation lost its expected project revision.');
assert(/^[0-9a-f]{32}$/i.test(String(engine.recordValue(reservation,'CHALLENGE_NONCE'))),'Reservation nonce is not at least 128 random bits.');
const retry=engine.reserveOperation(project,reservationInput);
assert(engine.recordId(retry,'operationReservations')===engine.recordId(reservation,'operationReservations'),'Exact reservation retry created duplicate canonical state.');
let duplicateBlocked=false;
try{engine.reserveOperation(project,{...reservationInput,payload:{tests:['TEST-002']}});}catch{duplicateBlocked=true;}
assert(duplicateBlocked,'A second authoritative reservation was created for the same operation slot.');
engine.markOrphanedReservations(project,'TAB-B');
assert(String(engine.recordValue(reservation,'STATUS'))==='ORPHANED','A crashed-tab reservation was not made visibly orphaned.');

const boundProject=core.createBlankState('JOB-BOUND-PROMPT');
engine.ensureShape(boundProject);boundProject.revision=4;
const unboundState=structuredClone(boundProject);unboundState.revision=5;
const unboundPrompt=promptEngine.buildPromptRecord(1,unboundState,{operation:'COMPLETE'});
assert(!unboundPrompt.operationReservationBound,'The deterministic allocation preview was unexpectedly treated as a bound prompt.');
const promptReservation=engine.reserveOperation(boundProject,{stage:1,operation:'COMPLETE',targetSlot:'STAGE-01:COMPLETE:DEFAULT',packageId:null,promptId:'',scope:unboundPrompt.scope,owningTabInstance:'TAB-PROMPT',payload:{purpose:'BOUND_EXTERNAL_OPERATION'}}),promptReservationId=engine.recordId(promptReservation,'operationReservations');
const boundState=structuredClone(boundProject);boundState.revision=5;
const boundPrompt=promptEngine.buildPromptRecord(1,boundState,{operation:'COMPLETE',operationReservation:promptReservationId});
assert(boundPrompt.operationReservationBound,'Final prompt is not marked reservation-bound.');
assert(boundPrompt.prompt.includes(promptReservationId)&&boundPrompt.prompt.includes(String(engine.recordValue(promptReservation,'CHALLENGE_NONCE'))),'Final prompt does not contain the exact reservation identity and nonce.');
engine.registerGeneratedPrompt(boundProject,boundPrompt);
engine.bindOperationReservation(boundProject,{reservationId:promptReservationId,promptId:boundPrompt.instructionId,packageId:null});
assert(Boolean(engine.recordValue(promptReservation,'BINDING_RECEIPT_ID')),'Bound prompt reservation has no binding receipt.');
assert(String(engine.recordValue(promptReservation,'PROMPT_BODY_SHA256'))===boundPrompt.bodySha256,'Reservation is not bound to the exact prompt body hash.');

// A lane-bound external package must retain run/reviewer scope during binding;
// generic project scope cannot erase or reject the lane identities.
const packageProject=core.createBlankState('JOB-BOUND-PACKAGE');
engine.ensureShape(packageProject);packageProject.revision=2;packageProject.job.CURRENT_PRODUCT_ID='PRODUCT-PACKAGE-001';
const packageContext=engine.registerFreshContext(packageProject,{stage:23,externalContextIdentifier:'EXTERNAL-CONTEXT-PACKAGE-001',purpose:'REVIEWER'}),packageContextId=engine.recordId(packageContext,'freshContexts');
const packagePreview=structuredClone(packageProject);packagePreview.revision=3;
const packageScope=promptEngine.scopeFor(23,packagePreview,{contextId:packageContextId,productId:'PRODUCT-PACKAGE-001'}),packageReservation=engine.reserveOperation(packageProject,{stage:23,operation:'COMPLETE',targetSlot:'STAGE-23:COMPLETE:PACKAGE',packageId:'PACKAGE-BOUND-001',promptId:'',scope:packageScope,owningTabInstance:'TAB-PACKAGE',payload:{purpose:'BOUND_EXTERNAL_OPERATION'}}),packageReservationId=engine.recordId(packageReservation,'operationReservations'),packageBinding={packageId:'PACKAGE-BOUND-001',operationReservationId:packageReservationId,challengeNonce:String(engine.recordValue(packageReservation,'CHALLENGE_NONCE')),expectedRevision:2,reservedScope:packageScope,scopeHash:hash.sha256Value(packageScope),targetSlot:'STAGE-23:COMPLETE:PACKAGE',promptId:''},packageDescriptor=promptEngine.responseContractDescriptor(23,'COMPLETE',packageBinding),packageBody='BOUND PACKAGE PROMPT',packageInstructionId='INSTRUCTION-BOUND-PACKAGE-001',packagePrompt={instructionId:packageInstructionId,promptId:packageInstructionId,promptEngineVersion:promptEngine.version,stage:23,operation:'COMPLETE',operationReservationBound:true,operationReservation:packageBinding,bodySha256:hash.sha256Text(packageBody),sha256:hash.sha256Text(packageBody),contractSha256:hash.sha256Value(packageDescriptor),contextSignature:hash.sha256Value({packageScope,packageBinding}),contextManifest:{blindAliasMap:[]},scope:packageScope,scopeSha256:hash.sha256Value(packageScope),prompt:packageBody,fullTextSha256:hash.sha256Text(packageBody)};
engine.registerGeneratedPrompt(packageProject,packagePrompt);
engine.bindOperationReservation(packageProject,{reservationId:packageReservationId,promptId:packageInstructionId,packageId:'PACKAGE-BOUND-001'});
packageProject.revision=3;
const packageDisclosure=await projectStore.createExecutionPackage({project:packageProject,stage:23,operation:'COMPLETE',testIds:[],productId:'PRODUCT-PACKAGE-001',instructionId:packageInstructionId,operationReservationId:packageReservationId,packageId:'PACKAGE-BOUND-001',disclosureOnly:true});
assert(packageDisclosure.disclosure.required&&!packageDisclosure.disclosure.authorized&&!packageDisclosure.disclosure.prohibited,'Serialized non-artifact package material did not require an exact disclosure decision.');
engine.recordDisclosureAuthorization(packageProject,{stage:23,operation:'COMPLETE',artifactIds:packageDisclosure.artifactIds,outboundComponents:packageDisclosure.outboundComponents,recipientOrProvider:'Controlled package reviewer',recipientSuitabilityConfirmed:true,operatorLabel:'RESERVATION_TEST'});
const builtPackage=await projectStore.createExecutionPackage({project:packageProject,stage:23,operation:'COMPLETE',testIds:[],productId:'PRODUCT-PACKAGE-001',instructionId:packageInstructionId,operationReservationId:packageReservationId,packageId:'PACKAGE-BOUND-001'});
assert(builtPackage.manifest.PACKAGE_ID==='PACKAGE-BOUND-001'&&builtPackage.manifest.OPERATION_RESERVATION_ID===packageReservationId,'Execution package lost its canonical reservation identities.');
assert(builtPackage.manifest.reservationBindingReceiptSha256===String(engine.recordValue(packageReservation,'BINDING_RECEIPT_SHA256')),'Execution package did not preserve the exact prompt-binding receipt.');
assert(builtPackage.disclosureAuthorizationId&&builtPackage.outboundAllowlistSha256===String(engine.recordValue(engine.records(packageProject,'disclosureAuthorizations').at(-1),'OUTBOUND_ALLOWLIST_SHA256')),'Execution package did not retain the exact unified outbound allowlist authorization receipt.');
const repeatedPackage=await projectStore.createExecutionPackage({project:packageProject,stage:23,operation:'COMPLETE',testIds:[],productId:'PRODUCT-PACKAGE-001',instructionId:packageInstructionId,operationReservationId:packageReservationId,packageId:'PACKAGE-BOUND-001'});
assert(repeatedPackage.packageSha256===builtPackage.packageSha256,'An exact execution-package retry produced different canonical package content.');
assert(await hash.sha256Bytes(await repeatedPackage.blob.arrayBuffer())===await hash.sha256Bytes(await builtPackage.blob.arrayBuffer()),'An exact execution-package retry produced different compressed bytes.');
for(const [name,overrides] of [['wrong package identity',{packageId:'PACKAGE-WRONG'}],['wrong reservation identity',{operationReservationId:'OPERATION-RESERVATION-WRONG'}]]){let rejected=false;try{await projectStore.createExecutionPackage({project:packageProject,stage:23,operation:'COMPLETE',testIds:[],productId:'PRODUCT-PACKAGE-001',instructionId:packageInstructionId,operationReservationId:packageReservationId,packageId:'PACKAGE-BOUND-001',...overrides});}catch{rejected=true;}assert(rejected,`Execution package accepted ${name}.`);}
const stalePackageProject=structuredClone(packageProject);stalePackageProject.revision=4;let staleRevisionRejected=false;try{await projectStore.createExecutionPackage({project:stalePackageProject,stage:23,operation:'COMPLETE',testIds:[],productId:'PRODUCT-PACKAGE-001',instructionId:packageInstructionId,operationReservationId:packageReservationId,packageId:'PACKAGE-BOUND-001'});}catch{staleRevisionRejected=true;}assert(staleRevisionRejected,'Execution package accepted a stale reservation revision.');

assert(app.includes("announce('user job input saved')"),'Successful User Job Input save is not announced through the live region.');
assert(app.includes('artifact identity verified; delivery remains unauthorized until Stage 30'),'Stage 28 success is still announced as final delivery authorization.');

console.log(JSON.stringify({
  stagedArtifactLifecycle:true,
  startupArtifactReconciliation:true,
  atomicArtifactPromotion:true,
  reservationBoundPackage:true,
  reservationPersistedBeforePackage:true,
  reservationNonceBits:128,
  duplicateAuthoritativeReservations:0
}));
