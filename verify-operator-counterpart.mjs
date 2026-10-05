import {bindArtifactFixture,projectStoreRuntime as baseProjectStoreRuntime,captureArtifactFixture,restoreArtifactFixture,bindAcceptanceUi,storageBroadcastNetwork,hydrateRetainedPromptContexts} from './test-project-store-runtime.mjs';
import {artifactFixtureId} from './test-artifact-fixtures.mjs';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import fs from 'node:fs';
import {readStoreArchive} from './test-zip.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {responseFixture,OBJECTIVE,OUTPUT,CANDIDATE,COUNTERPART_FAULT_CASES} from './operator-journey-fixtures.mjs';
import {registerFixtureSourceSearchCapability,recordProposal,deferredDefinitionResponseFixture,deferredFailureExecutionResponseFixture} from './test-fixtures.mjs';
globalThis.dispatchEvent=()=>true;
const injectedFault=process.env.CLRT_COUNTERPART_FAULT||null;
const diagnosticPrefixDir=process.env.CLRT_COUNTERPART_DIAGNOSTIC_PREFIX_DIR||null;
const diagnosticPrefixInput=process.env.CLRT_COUNTERPART_DIAGNOSTIC_PREFIX_INPUT||null;
assert(!diagnosticPrefixInput||diagnosticPrefixDir,'A retained diagnostic precursor is usable only by the declared isolated diagnostic setup mode.');
assert(!(diagnosticPrefixDir&&injectedFault),'Diagnostic prefix generation and deliberate fault injection are separate verifier modes.');
if(process.argv.includes('--stage17-selector-only')){console.log(JSON.stringify(stage17DeferredReceiptSelectorControls()));process.exit(0);}

// Retained synthetic prerequisite fixtures are replayed only at their explicitly
// recorded instant. The ordinary operator journey always uses the actual clock;
// no retained capability report or canonical timestamp is rewritten for replay.
const diagnosticRecovered=diagnosticPrefixInput?JSON.parse(fs.readFileSync(diagnosticPrefixInput,'utf8')):null;
const diagnosticUsesArchivedClock=Boolean(diagnosticRecovered&&Object.hasOwn(diagnosticRecovered,'archivedFixtureClockUtc'));
const archivedFixtureClockUtc=diagnosticUsesArchivedClock?diagnosticRecovered.archivedFixtureClockUtc:null;
let DiagnosticFixtureDate=null;
if(diagnosticUsesArchivedClock){
  assert.equal(diagnosticRecovered.synthetic,true,'DIAGNOSTIC_ARCHIVED_CLOCK_SYNTHETIC_ORACLE');
  assert.equal(diagnosticRecovered.actualBrowser,false,'DIAGNOSTIC_ARCHIVED_CLOCK_BROWSER_ORACLE');
  assert.equal(diagnosticRecovered.earlierCompleteFlagsForced,false,'DIAGNOSTIC_ARCHIVED_CLOCK_GATES_ORACLE');
  assert.equal(typeof archivedFixtureClockUtc,'string','DIAGNOSTIC_ARCHIVED_CLOCK_TIMESTAMP_ORACLE');
  assert.equal(new Date(archivedFixtureClockUtc).toISOString(),archivedFixtureClockUtc,'DIAGNOSTIC_ARCHIVED_CLOCK_TIMESTAMP_ORACLE');
  const NativeDate=Date;
  DiagnosticFixtureDate=class extends NativeDate {constructor(...args){super(...(args.length?args:[archivedFixtureClockUtc]));}static now(){return NativeDate.parse(archivedFixtureClockUtc);}};
  globalThis.Date=DiagnosticFixtureDate;
}
const diagnosticClockMetadata=diagnosticUsesArchivedClock?{archivedFixtureClockUtc,clockBasis:'EXPLICIT_RECORDED_SYNTHETIC_FIXTURE_INSTANT; canonical reports and timestamps retained; not current browser or external evidence'}:{};
function projectStoreRuntime(options={}){return baseProjectStoreRuntime({...options,environment:{...options.environment,...(DiagnosticFixtureDate?{Date:DiagnosticFixtureDate}:{})}});}

const runtimeSources={};
const initialOwnerFaults=['reopened-initial-root-cause-by-later-defect','reopened-initial-regression-by-later-defect','reopened-initial-correction-by-later-defect'];
const counterpartFaults={
  'missing-source-search-registration':{skipSourceSearchRegistration:true},
  'missing-retained-prompt-context':{skipPromptContextCapture:true},
  'missing-candidate-bytes':{skipFixtureFile:'CANDIDATE-FILE'},
  'missing-product-bytes':{skipFixtureFile:'PRODUCT-FILE'},
  'fractional-stability':{from:'const snapshot=clone(stability),denominator=Number(snapshot.runCount||0);',to:'return stability; const snapshot=clone(stability),denominator=Number(snapshot.runCount||0);'},
  'missing-defect-gate':{from:'if(defectRequired&&!defectIds.length)',to:'if(false&&defectRequired&&!defectIds.length)'},
  'unrelated-defect-reason':{from:"' has prohibited variance or a violated result without a DEFECT_IDS handoff.'",to:"' has an unrelated prerequisite failure.'"},
  'reopened-initial-root-cause-by-later-defect':{from:'requireAccepted();const analysis=initialDefectAnalysis(project),defects=analysis.defects,analysed=new Set(analysis.rootCauses.map',to:'requireAccepted();const analysis=initialDefectAnalysis(project),defects=confirmedDefects(project),analysed=new Set(analysis.rootCauses.map'},
  'reopened-initial-regression-by-later-defect':{from:'case 15:{requireAccepted();const analysis=initialDefectAnalysis(project),defects=analysis.defects,regs=analysis.regressions',to:'case 15:{requireAccepted();const analysis=initialDefectAnalysis(project),defects=confirmedDefects(project),regs=analysis.regressions'},
  'reopened-initial-correction-by-later-defect':{from:'const analysis=initialDefectAnalysis(project),defects=analysis.defects,stageChanges=analysis.changes,coveredDefects=new Set();',to:'const analysis=initialDefectAnalysis(project),defects=confirmedDefects(project),stageChanges=analysis.changes,coveredDefects=new Set();'},
  'partial-verification-completes-operation':{from:"if(out.has('VERIFY')){const matrix=verificationMatrix(project,selectedIteration);",to:"if(false&&out.has('VERIFY')){const matrix=verificationMatrix(project,selectedIteration);"}
};
assert.deepEqual(Object.keys(counterpartFaults).sort(),COUNTERPART_FAULT_CASES.map(([fault])=>fault).sort(),'COUNTERPART_FAULT_POPULATION_ORACLE: every current injected fault must belong to the declared closed population.');
assert(!injectedFault||counterpartFaults[injectedFault],'COUNTERPART_FAULT_ID_ORACLE: unknown fault');
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js']){
  let source=fs.readFileSync(file,'utf8');
  if(file==='workflow-engine.js'&&injectedFault&&counterpartFaults[injectedFault].from){
    const fault=counterpartFaults[injectedFault];
    assert.equal(source.split(fault.from).length-1,1,'COUNTERPART_FAULT_ANCHOR_ORACLE: exactly one current owning condition is required');
    const mutated=source.replace(fault.from,fault.to);
    assert.notEqual(mutated,source,'COUNTERPART_FAULT_APPLIED_ORACLE: injection must change executable source');
    source=mutated;
  }
  runtimeSources[file]=source;
  createVerifierRuntime.loadScript(globalThis,source,{filename:file});
}
const byteStore=await bindArtifactFixture([]);
const engine=closedLoopWorkflowEngine,schema=closedLoopWorkflowSchema,prompts=closedLoopPromptEngine,ingestion=closedLoopResponseIngestion,hash=closedLoopHash;
let p=diagnosticRecovered?diagnosticRecovered.project:closedLoopCore.createBlankState('COUNTERPART-CONTRACT-PREFLIGHT');if(!diagnosticPrefixInput){p.job.JOB_TITLE='Complete operator journey';p.job.EXACT_USER_OBJECTIVE_VERBATIM=OBJECTIVE;}engine.ensureShape(p);if(!diagnosticPrefixInput)engine.recalculate(p);
const value=engine.recordValue,id=engine.recordId,latest=family=>engine.recordsForCurrentScope(p,family).at(-1),cases=[],retainedContextFiles=new Map();
async function retainFixtureFile(label,filename,text){
  if(counterpartFaults[injectedFault]?.skipFixtureFile===label)return;
  await byteStore.putArtifact({jobId:p.job.JOB_ID,artifactId:artifactFixtureId(engine,p,label),filename,mediaType:'text/plain',blob:new Blob([text],{type:'text/plain'})});
}

// Optional synthetic fixture mode emits legitimate accepted prefixes for the
// existing deferred-operation verifier. It does not change runtime behavior.
const diagnosticPrefixFiles=[];
const sourceFingerprints=Object.fromEntries(['workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','test-fixtures.mjs','operator-journey-fixtures.mjs','app-core.js'].map(file=>[file,hash.sha256Text(fs.readFileSync(file,'utf8'))]));
sourceFingerprints['verify-operator-counterpart.mjs']=hash.sha256Text(fs.readFileSync(import.meta.filename,'utf8'));
if(diagnosticPrefixInput){
  const recovered=diagnosticRecovered;
  assert.equal(recovered.synthetic,true);assert.equal(recovered.earlierCompleteFlagsForced,false);assert([7,8,15,17].includes(recovered.entryStage),'DIAGNOSTIC_PREFIX_RECOVERY_ORACLE: unsupported predecessor boundary');if(recovered.entryStage===17)assert.equal(recovered.authorBoundary,'ENTRY_STAGE17_AFTER_ACCEPTED_STAGE16','DIAGNOSTIC_PREFIX_RECOVERY_ORACLE: only the exact retained entry checkpoint can resume this setup');
  await restoreArtifactFixture(byteStore,recovered.artifacts);
  // Restored byte observations are prerequisites for the unchanged gate oracles.
  engine.recalculate(p);for(let prior=1;prior<recovered.entryStage;prior++)assert.equal(engine.gate(prior,p).complete,true,'DIAGNOSTIC_PREFIX_RECOVERY_ORACLE: retained predecessor must actually complete '+prior);
  for(const file of recovered.contextFiles||[])retainedContextFiles.set(file.sha256,file);
}
function exportedDiagnosticRows(args,family){
  const blocks=[];
  for(const file of args.contextFiles||[])for(const block of JSON.parse(Buffer.from(file.bytes).toString('utf8')).members||[])blocks.push(block);
  for(const match of args.instructionBytes.toString('utf8').matchAll(/BEGIN_UNTRUSTED_DATA_BLOCK\s*([\s\S]*?)\s*END_UNTRUSTED_DATA_BLOCK/g))blocks.push(JSON.parse(match[1]));
  const block=blocks.find(row=>row.sourceIdentity==='collection.'+family);return block?JSON.parse(block.value).records:[];
}
function compatibilityNativeIr(family){
 const legacy={version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'FIXTURE'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'COMPARE',value:OUTPUT,operator:'NE'},{op:'ASSERT_EQ',value:true},...(family==='regressions'?[{op:'LOAD_ARTIFACT',binding:'TARGET'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'ASSERT_EQ',value:OUTPUT}]:[])]};
 const normalized=closedLoopTestRuntime.normalizeSpec(legacy),withoutFixture=structuredClone(normalized);withoutFixture.steps=withoutFixture.steps.slice(3);withoutFixture.steps[0].inputs.left={literal:'VERIFIED'};
 assert.equal(closedLoopTestRuntime.validateSpec(withoutFixture,family==='regressions'?{TARGET:{kind:'ARTIFACT',source:'CURRENT_PRODUCT',filename:'result.txt'}}:{}).valid,true,'Published native literal/predicate form must validate; no guessed port names.');return withoutFixture;
}
function compatibilityFutureTest(specimen,family,mode){
 const future=structuredClone(specimen);future.tempKey='compat-'+(mode==='APPLICATION_DETERMINISTIC'?'native':'external')+'-'+family;const regression=family==='regressions';
 Object.assign(future.fields,{TEST_TYPE:'ADVERSARIAL',TEST_ROLE:'NEGATIVE_ONLY',TEST_PROPOSITION_TEXT:regression?'The exact eight-byte VERIFIED fixture preserves the missing-LF defect; the same reviewed complete-content predicate distinguishes a defective eight-byte target from a distinct corrected nine-byte target.':'The exact eight-byte VERIFIED negative fixture is rejected for differing from the nine-byte required literal.',TESTED_SCOPE:regression?'Preserved exact negative literal plus the legitimately future current result.txt target under the published product phase/input contract.':'Only the exact preserved eight-byte negative literal and nine-byte expected control, scheduled at the declared future product phase.',POSITIVE_RESULT_MEANING:regression?'The preserved negative literal differs from the requirement and the current distinct corrected target is exactly VERIFIED followed by LF.':'The preserved eight-byte invalid literal differs from nine-byte VERIFIED followed by LF and is rejected.',NEGATIVE_RESULT_MEANING:regression?'The current target still omits LF or otherwise differs; PRE_CORRECTION is VIOLATED, POST_CORRECTION requires a distinct corrected target and SATISFIED.':'The invalid eight-byte literal is accepted or the conforming nine-byte control is rejected.',INPUTS:regression?'Preserved exact literal VERIFIED (8UTF8bytes) and the future current product result.txt (actual target bytes only when that phase is due).':'Preserved exact literal VERIFIED (8UTF8bytes) and exact expected VERIFIED followed by LF (9UTF8bytes).',PROCEDURE:regression?'First compare the preserved eight-byte literal with nine-byte VERIFIED followed by LF and require difference. Then compare all bytes of the actual current target with the nine-byte value; the original defective target fails and a distinct corrected target succeeds.':'Compare the complete preserved eight-byte literal with nine-byte VERIFIED followed by LF, require inequality, and retain the exact input/predicate/observation. No future target or execution is claimed now.',EXPECTED_RESULT:regression?'SATISFIED only for the reviewed exact corrected-target predicate; the original eight-byte target must yield VIOLATED.':'SATISFIED means actual rejection of the exact eight-byte invalid fixture, not affirmative product completion.',FAILURE_CONDITION:'A missing, added or changed byte, or an observation that does not establish the declared outcome meaning.',EVIDENCE_TO_PRESERVE:'Exact preserved negative literal, reviewed predicate/input contract, actual due target identity/bytes, current scope and separately observed outcome; no future execution receipt at definition admission.',VERIFICATION_PHASE:'FINAL_PRODUCT_ADVERSARIAL',EARLIEST_EXECUTABLE_STAGE:24,REQUIRED_BY_STAGE:24,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:true,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{type:'PHASE_TARGET'},EXECUTION_MODE:mode,REQUIRED_CAPABILITY:mode==='APPLICATION_DETERMINISTIC'?'CLOSED_LOOP_TEST_IR':'INDEPENDENT_AGENT_REVIEW',TOOLS:mode==='APPLICATION_DETERMINISTIC'?'Application registered Test IR literal/byte primitives':'Supported independent complete-content comparison'});
 if(mode==='APPLICATION_DETERMINISTIC')Object.assign(future.fields,{EXECUTABLE_KIND:'TEST_IR',EXECUTABLE_INPUT_BINDINGS:regression?{TARGET:{kind:'ARTIFACT',source:'CURRENT_PRODUCT',filename:'result.txt'}}:{},EXECUTABLE_SPEC:compatibilityNativeIr(family)});return future;
}
function diagnosticActor(args){
  const response=responseFixture(args);
  if(!diagnosticPrefixDir)return response;
  const rows=family=>exportedDiagnosticRows(args,family),stage=Number(args.prompt.stage),operation=args.prompt.operation;
  // A negative-only diagnostic is not the mandatory positive per-run/final
  // product proposition. Select the actual declared target from exported rows.
  if(operation==='VERIFY'){
    const test=rows('tests').find(row=>value(row,'VERIFICATION_PHASE')==='PREPRODUCT_ITERATION'&&value(row,'TEST_ROLE')!=='NEGATIVE_ONLY'&&value(row,'PER_RUN_REQUIRED')===true);
    assert(test,'DIAGNOSTIC_VERIFY_TARGET_ORACLE');const testId=id(test,'tests');
    for(const row of response.records.verification||[])row.relationships.TEST_ID={recordId:testId};
    for(const row of response.records.observationRecords||[])row.relationships.SUBJECT_ID={recordId:testId};
  }
  if(stage===24&&operation==='COMPLETE'){
    const test=rows('tests').find(row=>value(row,'TEST_TYPE')==='ADVERSARIAL'&&value(row,'FINAL_PRODUCT_REQUIRED')===true);
    assert(test,'DIAGNOSTIC_ADVERSARIAL_TARGET_ORACLE');for(const row of response.records.adversarialResults||[])if(row.relationships?.TEST_ID)row.relationships.TEST_ID={recordId:id(test,'tests')};
  }
  if(stage===6&&operation==='COMPLETE'){
    const specimen=response.records.tests[0],future=structuredClone(specimen);future.tempKey='conditional-literal-rejection';
    Object.assign(future.fields,{TEST_TYPE:'ADVERSARIAL',TEST_ROLE:'NEGATIVE_ONLY',TEST_PROPOSITION_TEXT:'The deliberately malformed eight-byte output must fail exact comparison with VERIFIED plus LF.',TESTED_SCOPE:'Disposable clone of the current literal-output fixture only.',POSITIVE_RESULT_MEANING:'The invalid eight-byte fixture is rejected; the conforming nine-byte control matches.',NEGATIVE_RESULT_MEANING:'The invalid fixture is accepted or a conforming control is rejected.',EXPECTED_RESULT:'REJECT',VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:8,REQUIRED_BY_STAGE:30,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:false,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{type:'PHASE_TARGET'}});
    response.records.tests.unshift(future);
    for(const family of ['failureTests','regressions'])for(const mode of ['APPLICATION_DETERMINISTIC','INDEPENDENT_AGENT_REVIEW'])response.records.tests.push(compatibilityFutureTest(specimen,family,mode));
    const capacity=compatibilityFutureTest(specimen,'regressions','INDEPENDENT_AGENT_REVIEW');capacity.tempKey='compat-capacity-regressions';Object.assign(capacity.fields,{TEST_PROPOSITION_TEXT:'The complete preserved199900character ASCII X negative fixture differs from the nine-byte required target; the same complete-content predicate rejects a defective target and accepts only a distinct corrected nine-byte target.',TESTED_SCOPE:'The exact preserved negative199900character literal of ASCII X and the legitimately future current result.txt target; no truncation or future execution now.',POSITIVE_RESULT_MEANING:'The complete199900character negative literal is unequal to VERIFIED followed by LF; the current distinct corrected target is exactly that required nine-byte value.',NEGATIVE_RESULT_MEANING:'The complete negative literal is accepted, evidence is truncated, or the actual target differs from the required nine-byte value.',INPUTS:'The complete preserved199900character ASCII X literal (all characters retained), the nine-byte expected VERIFIED followed by LF, and the actual current product result.txt when legitimately due.',PROCEDURE:'Compare all199900 ASCII X characters of the exact preserved negative literal with VERIFIED followed by LF; require inequality. Apply the same complete-content predicate to the actual due target: any different target fails, and only a distinct corrected nine-byte target succeeds.',EXPECTED_RESULT:'SATISFIED requires the exact negative fixture rejection and the distinct corrected target equality; a defective target is VIOLATED.',EVIDENCE_TO_PRESERVE:'The complete199900character negative literal, reviewed complete-content predicate/input contract, exact actual due target identity and bytes, and attributable separate outcome accounts; no truncated evidence or future execution receipt.'});response.records.tests.push(capacity);
  }
  if(stage===7&&operation==='COMPLETE'||stage===15&&operation==='COMPLETE'){
    const currentTests=rows('tests'),externalNegative=row=>value(row,'TEST_ROLE')==='NEGATIVE_ONLY'&&value(row,'EXECUTION_MODE')==='INDEPENDENT_AGENT_REVIEW';
    const test=stage===7?(currentTests.find(row=>externalNegative(row)&&value(row,'VERIFICATION_PHASE')==='PREPRODUCT_ITERATION'&&Number(value(row,'EARLIEST_EXECUTABLE_STAGE'))===8&&Number(value(row,'REQUIRED_BY_STAGE'))===30)||currentTests.find(row=>externalNegative(row)&&value(row,'TEST_PROPOSITION_TEXT')==='The exact eight-byte VERIFIED negative fixture is rejected for differing from the nine-byte required literal.')):currentTests.find(row=>externalNegative(row)&&value(row,'VERIFICATION_PHASE')==='FINAL_PRODUCT_ADVERSARIAL'&&value(row,'TEST_PROPOSITION_TEXT')==='The exact eight-byte VERIFIED fixture preserves the missing-LF defect; the same reviewed complete-content predicate distinguishes a defective eight-byte target from a distinct corrected nine-byte target.');assert(test,'DIAGNOSTIC_ACCEPTED_TEST_ORACLE');
    const req=rows('requirements').find(row=>id(row,'requirements')===String(value(test,'REQ_ID')));assert(req,'DIAGNOSTIC_TYPED_REQUIREMENT_ORACLE');
    const relationships={REQ_ID:{recordId:id(req,'requirements')},EXECUTION_TEST_ID:{recordId:id(test,'tests')}};
    const family=stage===7?'failureTests':'regressions';let definition,defect=null;
    if(stage===7)definition=recordProposal(schema,'failureTests',{tempKey:'conditional-future-failure',overrides:{VIOLATION_MODE:'MISSING_REQUIRED_TERMINAL_LF',FIXTURE:'VERIFIED',EXPECTED_REJECTION:'REJECT',ACTUAL_RESULT:'NOT_RUN',EXECUTION_OUTCOME:'NOT_RUN',...Object.fromEntries(schema.TIMING_FIELDS.map(name=>[name,value(test,name)])),EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',REQUIRED_CAPABILITY:'INDEPENDENT_AGENT_REVIEW'},relationships});
    else{
      defect=rows('defects').find(row=>String(value(row,'REQ_ID'))===id(req,'requirements'));assert(defect,'DIAGNOSTIC_OBSERVED_INITIAL_DEFECT_ORACLE');
      assert(Array.isArray(defect.evidenceRefs)&&defect.evidenceRefs.length>0,'DIAGNOSTIC_PUBLISHED_DEFECT_SUPPORT_ORACLE: the actual exported governing defect must provide its required evidence identities');const providedEvidence=new Set(rows('evidenceRecords').map(row=>id(row,'evidenceRecords')));assert(defect.evidenceRefs.every(ref=>providedEvidence.has(ref))&&defect.unavailableEvidenceRefCount===0,'DIAGNOSTIC_PUBLISHED_DEFECT_SUPPORT_ORACLE: all required defect support must be in the actual authorized exported evidence cohort');
      relationships.DEFECT_ID={recordId:id(defect,'defects')};
      definition=recordProposal(schema,'regressions',{tempKey:'conditional-future-regression',overrides:{FAILURE_FIXTURE:'VERIFIED',REPRODUCTION_PROCEDURE:'Execute the supplied diagnostic comparison against the preserved accepted eight-byte failed output.',DETECTION_METHOD:'Actual disposable complete-byte comparison',CORRECTION:'Preserve the required terminal LF.',PERMANENT_TEST_LOCATION:'Synthetic current regression registry',APPLICABILITY:'APPLICABLE',...Object.fromEntries(schema.TIMING_FIELDS.map(name=>[name,value(test,name)])),EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',REQUIRED_CAPABILITY:'INDEPENDENT_AGENT_REVIEW'},relationships});
    }
    // This synthetic author reads the actual published profile and preserves
    // the exact missing-LF negative case. It does not establish future execution.
    const authored=deferredDefinitionResponseFixture({schema,engine,prompts},{job:{JOB_ID:args.manifest.jobId}},args.prompt,{family,tempKey:definition.tempKey,fields:definition.fields,relationships,fixtureValue:'VERIFIED',...(defect?{defectId:id(defect,'defects'),defectEvidenceIds:defect.evidenceRefs||[]}:{})});
    response.records[family][stage===7?'push':'unshift'](authored.records[family][0]);response.evidence.push(...authored.evidence);
  }
  return response;
}
async function diagnosticPackage(stage,operation){
  const r=projectStoreRuntime({sourceOverrides:runtimeSources});
  await restoreArtifactFixture(r.store,await captureArtifactFixture(byteStore,p.job.JOB_ID));
  const state=r.copy(p);await hydrateRetainedPromptContexts(r,state,[...retainedContextFiles.values()]);
  let saved=await r.store.writeProject(state,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
  const draft=r.copy(saved),prompt=r.prompts.reserveAndBuildPromptRecord(draft,stage,{operation}).prompt;
  const materialized=r.prompts.materializePromptContextFiles(prompt,draft);for(const file of materialized)retainedContextFiles.set(file.sha256,structuredClone(file));
  const impact=r.store.mutationImpact(saved,draft);saved=await r.store.writeProject(draft,{expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256,...(impact.requiresConfirmation?{mutationConfirmation:impact}:{})});
  const pkg=await r.store.createExecutionPackage({jobId:saved.job.JOB_ID,stage:prompt.stage,operation:prompt.operation,instructionId:prompt.instructionId}),members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer())),member=path=>{const row=members.find(row=>row.canonicalPath===path);assert(row,'DIAGNOSTIC_PACKAGE_MEMBER_ORACLE '+path);return Buffer.from(row.bytes);};
  const manifest=JSON.parse(member('manifest.json').toString('utf8')),instructionBytes=member('instruction.txt');assert.equal(instructionBytes.toString('utf8'),prompt.prompt);
  const contextFiles=manifest.contextFiles.map(file=>{const bytes=member(file.path);assert.equal(bytes.length,file.byteSize);assert.equal(hash.sha256Text(bytes.toString('utf8')),file.sha256);return {filename:file.path,bytes};});
  assert.equal(manifest.operationReservationId,prompt.operationReservationId);assert.equal(manifest.challengeNonce,prompt.challengeNonce);
  console.error(JSON.stringify({phase:'diagnostic-definition-actual-package',stage:prompt.stage,operation:prompt.operation,packageId:manifest.packageId,instructionId:prompt.instructionId}));
  p=structuredClone(await r.store.readProject(saved.job.JOB_ID));
  return {schema,engine,prompt:structuredClone(prompt),manifest,instructionBytes,contextFiles,storageRuntime:r};
}
async function emitDiagnosticPrefix(stage){
  if(!diagnosticPrefixDir)return;
  const number=Number(stage);assert([7,8,15].includes(number));for(let prior=1;prior<number;prior++)assert.equal(engine.gate(prior,p).complete,true,'DIAGNOSTIC_PREFIX_PREREQUISITE_ORACLE '+prior+' -> '+number);
  fs.mkdirSync(diagnosticPrefixDir,{recursive:true});const file=diagnosticPrefixDir+'/prefix-stage'+String(number).padStart(2,'0')+'.json';if(diagnosticPrefixFiles.includes(file))return;
  const r=projectStoreRuntime({sourceOverrides:runtimeSources});await restoreArtifactFixture(r.store,await captureArtifactFixture(byteStore,p.job.JOB_ID));const state=r.copy(p);state.activeStage=number;await hydrateRetainedPromptContexts(r,state,[...retainedContextFiles.values()]);
  await r.store.writeProject(state,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});const saved=await r.store.readProject(state.job.JOB_ID);assert.equal(r.store.validateProjectIntegrity(saved).valid,true);
  const failure=engine.records(p,'failureTests').find(row=>String(value(row,'EXECUTION_TEST_ID')||'').trim()),regression=engine.records(p,'regressions').find(row=>String(value(row,'EXECUTION_TEST_ID')||'').trim());if(number>=8)assert(failure,'DIAGNOSTIC_PREFIX_FAILURE_DEFINITION_ORACLE');
  fs.writeFileSync(file,JSON.stringify({schema:'closed-loop-counterpart-diagnostic-prefix/1',...diagnosticClockMetadata,sourceCommit:process.env.GITHUB_SHA||null,sourceFingerprints,entryStage:number,completedPriorStages:number-1,project:saved,artifacts:await captureArtifactFixture(r.store,saved.job.JOB_ID),contextFiles:[...retainedContextFiles.values()],definitionId:failure?id(failure,'failureTests'):null,testId:failure?value(failure,'EXECUTION_TEST_ID'):null,regressionId:regression?id(regression,'regressions'):null,synthetic:true,actualBrowser:false,earlierCompleteFlagsForced:false}));
  diagnosticPrefixFiles.push(file);console.error(JSON.stringify({phase:'diagnostic-prefix-stored-read-emitted',entryStage:number,file,projectSha256:saved.projectSha256,definitionId:failure?id(failure,'failureTests'):null,regressionId:regression?id(regression,'regressions'):null}));
}
function diagnosticOrdinaryAction(stage){
  const external=operation=>{assert.equal(schema.STAGE_OPERATION_REGISTRY[stage+':'+operation]?.executorClass,'EXTERNAL_AGENT','DIAGNOSTIC_ORDINARY_REGISTRY_ORACLE');return {actionType:'EXTERNAL_AGENT_TOOL',operation,explicitOrdinarySelection:true};},native=actionType=>({actionType,explicitNativeControl:true});
  if([8,9,14,15,16,23,24,25].includes(stage))return external(({14:'ROOT_CAUSE',16:'CORRECT'})[stage]||schema.STAGE_CONTRACTS[stage].operations[0]);
  if(stage===10)return native('FREEZE_CANDIDATE');if(stage===11)return external('EXECUTE_RUN');if(stage===12)return external('VERIFY');if(stage===13)return external('COMPARE');
  if(stage===17||stage===19){
    const iteration=engine.records(p,'iterations').filter(row=>Number(row.stage)===stage).at(-1);if(!iteration)return native(stage===17?'FREEZE_CANDIDATE':'BEGIN_UNCHANGED_CONFIRMATION');const iterationId=id(iteration,'iterations'),runs=engine.recordsForIteration(p,'runs',iterationId);if(!runs.length)return native('RESERVE_RUN_BATCH');
    const accepted=engine.acceptedChanges(p,stage).filter(row=>String(row.scope?.iterationId||'')===iterationId),done=new Set(accepted.filter(row=>row.operation==='EXECUTE_RUN').map(row=>row.scope?.runId));if(runs.some(row=>!done.has(id(row,'runs'))))return external('EXECUTE_RUN');
    const operations=engine.acceptedOperationSet(p,stage,{iterationId}),sequence=stage===17?['VERIFY','COMPARE','ROOT_CAUSE','REGRESSION','CORRECT']:['VERIFY','COMPARE','REGRESSION_VERIFY'],operation=sequence.find(operation=>!operations.has(operation));if(operation)return external(operation);
    if(stage===19)return native('CALCULATE_UNCHANGED_CONFIRMATION');throw new Error('DIAGNOSTIC_ORDINARY_NEGATIVE_GATE: completed operations do not establish Stage17 completion '+JSON.stringify(engine.gate(stage,p).reasons));
  }
  if(stage===18)return native('CALCULATE_CONVERGENCE');if(stage===20)return native('FREEZE_BASELINE');
  if(stage===21){if(!engine.records(p,'freshContexts').some(row=>Number(row.stage)===21))return native('REGISTER_PRODUCTION_CONTEXT');if(!engine.records(p,'products').length)return native('RESERVE_PRODUCT_EXECUTION');return external(schema.STAGE_CONTRACTS[stage].operations[0]);}
  if(stage===22)return native('RUN_APP_TESTS');
  if(stage===26){const policy=schema.SEMANTIC_STAGE_OPERATIONS[stage],author=engine.acceptedChanges(p,stage).filter(row=>policy.authorOperations.includes(row.operation)).at(-1);return external(author?policy.reviewOperations[0]:policy.authorOperations[0]);}
  if(stage===27)return native('CALCULATE_RELEASE');if(stage===28)return native('FREEZE_DELIVERY_CANDIDATE');if(stage===29)return native('BUILD_EVIDENCE_CHAINS');throw new Error('No ordinary fixture control for Stage '+stage);
}

// Fixture preflight only. Actual interface and file transport acceptance remains
// the separate verify-complete-operator-journey.mjs browser execution.
const stageLimit=Number(process.env.CLRT_COUNTERPART_STAGE_LIMIT||(diagnosticPrefixDir?7:30));
assert(Number.isInteger(stageLimit)&&stageLimit>=1&&stageLimit<=30);
assert(!diagnosticPrefixDir||[6,7,14,16].includes(stageLimit),'Diagnostic mode is bounded to the legitimate Stage6/7/14/16 precursors; ordinary verification still supports all30 stages.');
// Isolated synthetic owning-operation controls use the existing accepted
// lifecycle precursor and actual package/file/acceptance/storage boundaries.
// Existing COMPLETE controls remain intact. All inputs below come from the
// legitimate main lifecycle immediately before Stage07 / Stage15 admission.
async function verifyOwningStageExecution(stage, operation) {
  assert([7,15].includes(stage));
  assert.equal(engine.gate(stage-1,p).complete,true,
    'OWNER_EXECUTION_PREREQUISITE_ORACLE: actual accepted upstream work is required');
  assert.equal(schema.STAGE_OPERATION_REGISTRY[stage+':'+operation].deferredSubjectFamily,null,
    'Owner-stage execution is not a later-stage deferred definition receipt');
  const original=hash.sha256Value(p), artifacts=await captureArtifactFixture(byteStore,p.job.JOB_ID);
  const originalContexts=[...retainedContextFiles.values()];
  for(const variant of ['definition-only','executed-control']) {
    const r=projectStoreRuntime({sourceOverrides:runtimeSources}),{store,copy}=r,e=r.engine,pr=r.prompts,i=r.ingestion,s=r.runtime.closedLoopWorkflowSchema;
    await restoreArtifactFixture(store,artifacts);
    const input=copy(p);input.activeStage=stage;e.recalculate(input);
    await hydrateRetainedPromptContexts(r,input,originalContexts);
    let saved=await store.writeProject(input,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
    const draft=copy(saved),reserved=pr.reserveAndBuildPromptRecord(draft,stage,{operation}).prompt;
    saved=await store.writeProject(draft,{expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});
    const prompt=saved.projectData.generatedPrompts.find(row=>row.instructionId===reserved.instructionId);
    assert(prompt,'OWNER_EXECUTION_INSTRUCTION_ORACLE: saved current instruction is missing');
    const pkg=await store.createExecutionPackage({jobId:saved.job.JOB_ID,stage,operation,instructionId:prompt.instructionId});
    const members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer()));
    const member=path=>{const row=members.find(row=>row.canonicalPath===path);assert(row,'Missing exact exported member '+path);return Buffer.from(row.bytes);};
    const manifest=JSON.parse(member('manifest.json').toString('utf8')),instructionBytes=member('instruction.txt');
    assert.equal(instructionBytes.toString('utf8'),prompt.prompt);
    assert.equal(manifest.operation,operation);assert.equal(manifest.stage,stage);
    assert.equal(manifest.promptIdentity.instructionId,prompt.instructionId);
    assert.equal(manifest.operationReservationId,prompt.operationReservationId);
    assert.equal(manifest.packageId,prompt.packageId);assert.equal(manifest.challengeNonce,prompt.challengeNonce);
    const contextFiles=manifest.contextFiles.map(file=>{
      const bytes=member(file.path);assert.equal(bytes.length,file.byteSize);assert.equal(hash.sha256Text(bytes.toString('utf8')),file.sha256);
      return {filename:file.path,bytes};
    });
    // These two current fixtures are inline exact-text comparisons. They do
    // not claim that absent optional attachments or other files were received.
    assert(!manifest.attachmentSlots.some(slot=>slot.required&&slot.role!=='STRUCTURED_RESPONSE'),
      'OWNER_EXECUTION_OUTPUT_FILE_ORACLE: a required returned file needs its actual bytes');
    const envelope=responseFixture({schema:s,engine:e,prompt,manifest,contextFiles,instructionBytes});
    assert.equal(envelope.operation,operation);assert.deepEqual(envelope.scope,manifest.scope);
    const observedFixture=stage===7?envelope.records.failureTests[0].fields.FIXTURE:envelope.records.regressions[0].fields.FAILURE_FIXTURE;
    const expectedBytes=Buffer.from(OUTPUT,'utf8'),fixtureBytes=Buffer.from(observedFixture,'utf8');
    const conforming=bytes=>Buffer.from(bytes).equals(expectedBytes);
    assert.equal(conforming(expectedBytes),true,'The conforming comparison control must pass');
    assert.equal(conforming(fixtureBytes),false,'The preserved missing-LF fixture must actually violate the literal requirement');
    if(stage===7) {
      // Closed outcome comes from the published contract and Section32.2,
      // while the expected gate result is independently fixed by execution.
      assert(instructionBytes.toString('utf8').includes('REJECTED_INVALID'));
      envelope.records.failureTests[0].fields.EXECUTION_OUTCOME=variant==='definition-only'?'NOT_RUN':'REJECTED_INVALID';
      envelope.records.failureTests[0].fields.ACTUAL_RESULT=variant==='definition-only'?'NOT_RUN':'REJECTED';
    } else if(variant==='definition-only') {
      // Valid definition alone is admissible but must not complete Stage15.
      envelope.records.regressionExecutions=[];
    }
    envelope.evidence[0].content=JSON.stringify({synthetic:true,stage,operation,variant,
      expectedUtf8Base64:expectedBytes.toString('base64'),fixtureUtf8Base64:fixtureBytes.toString('base64'),
      executionAsserted:variant==='executed-control',
      observation:variant==='executed-control'?'Executed a disposable exact-byte comparison; invalid fixture differs from required bytes.':'Definition-only control; this response asserts no execution.',
      independence:'No real external actor, human independence or physical-device observation asserted.'});
    const text=JSON.stringify(envelope),staged=await store.stageResponseFile({jobId:saved.job.JOB_ID,stage,
      blob:new Blob([text],{type:'application/json'}),rawFilename:'response.json',mediaType:'application/json',
      promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce});
    const file=await store.readStagedResponseFile({jobId:saved.job.JOB_ID,stagingId:staged.stagingId});
    assert.equal(new TextDecoder('utf-8',{fatal:true}).decode(file.bytes),text);
    const captured=i.captureRaw(saved,{stage,text,promptRecord:prompt,transport:{authority:'AUTHORITATIVE_RESPONSE_FILE',
      stagingId:staged.stagingId,rawFilename:'response.json',mediaType:'application/json',status:file.status,
      sha256:file.sha256,byteSize:file.byteSize,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,
      operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce}});
    saved=await store.writeProject(captured.project,{operational:true,expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});
    const prepared=i.prepareCaptured(saved,{rawResponseId:captured.rawRecord.rawResponseId});
    assert.equal(prepared.validation.valid,true,'OWNER_EXECUTION_ADMISSION_ORACLE: '+JSON.stringify(prepared.validation.issues));
    assert.equal(prepared.proposal.status,'PENDING_OPERATOR_REVIEW');
    assert.equal(prepared.project.projectData.acceptedChanges.length,input.projectData.acceptedChanges.length,'Preparation accepted work early');
    saved=await store.writeProject(prepared.project,{operational:true,expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});
    const committed=i.commit(saved,prepared.proposal.proposalId,{operator:'SYNTHETIC_OWNER_EXECUTION_CONTROL'});
    const impact=store.mutationImpact(saved,committed.project);
    saved=await store.writeProject(committed.project,{expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256,...(impact.requiresConfirmation?{mutationConfirmation:impact}:{})});
    const reloaded=await store.readProject(saved.job.JOB_ID),accepted=e.acceptedChanges(reloaded,stage).find(row=>row.proposalId===prepared.proposal.proposalId);
    assert.equal(accepted.operation,operation);assert.equal(i.findRaw(reloaded,captured.rawRecord.rawResponseId).completeRawResponse,text);
    assert.equal(store.validateProjectIntegrity(reloaded).valid,true);
    const gate=e.gate(stage,reloaded),expectedComplete=variant==='executed-control';
    assert.equal(gate.complete,expectedComplete,'OWNER_EXECUTION_GATE_ORACLE: '+stage+':'+operation+' '+variant+' '+JSON.stringify(gate.reasons));
    if(!expectedComplete)assert(gate.reasons.some(reason=>stage===7?/failure test is not conclusively executed/.test(reason):/pre-correction failing execution/.test(reason)),
      'OWNER_EXECUTION_NEGATIVE_REASON_ORACLE: incompleteness must concern the omitted execution');
    const duplicate=i.commit(reloaded,prepared.proposal.proposalId,{operator:'SYNTHETIC_OWNER_EXECUTION_CONTROL'});
    assert.equal(duplicate.idempotent,true);assert.equal(duplicate.project.projectData.acceptedChanges.length,reloaded.projectData.acceptedChanges.length);
    assert.equal(hash.sha256Value(p),original,'OWNER_EXECUTION_ISOLATION_ORACLE: disposable cases changed the main lifecycle');
    cases.push({caseId:'owner-execution-'+stage+'-'+variant,stage,operation,result:'PASS',synthetic:true,actualBrowser:false,
      observedBoundary:'saved package bytes -> staged response bytes -> prepareCaptured -> operator commit -> production store/readback -> actual stage gate',
      expectedComplete,actualComplete:gate.complete,canonicalIdsApplicationAssigned:true,mainLifecycleUnchanged:true});
  }
}

// Initial analysis belongs to its active Stage10 subject; later defects must
// remain adverse in their own iteration without reopening completed owners.
function verifyInitialAnalysisOwners(r,saved){
  const {engine:e,prompts:pr,copy}=r,v=e.recordValue,rid=e.recordId,initial=e.records(saved,'iterations').filter(row=>Number(row.stage)===10).at(-1),initialId=rid(initial,'iterations');
  assert(initialId,'STAGE17_INITIAL_OWNER_ORACLE: active initial iteration required');
  for(const stage of [14,15,16])assert.equal(e.gate(stage,saved).complete,true,'STAGE17_INITIAL_OWNER_ORACLE: Stage '+stage+' must retain its legitimate initial subject');
  assert.equal(saved.job.CURRENT_STAGE,'STAGE 17','STAGE17_INITIAL_OWNER_ORACLE: canonical current stage must stay17');
  assert.equal(e.gate(17,saved).complete,false);assert.equal(e.operationalNextAction(saved,17).operation,'ROOT_CAUSE');
  const initialRows=family=>e.recordsForIteration(saved,family,initialId),defectIds=new Set(initialRows('defects').map(row=>rid(row,'defects'))),regIds=new Set(initialRows('regressions').map(row=>rid(row,'regressions')));
  assert(defectIds.size&&regIds.size,'STAGE17_INITIAL_OWNER_CONTROL: original observed defect and permanent definition required');
  for(const [caseId,family,remove,stage,reason] of [
    ['initial-rca-still-required','rootCauses',row=>defectIds.has(String(v(row,'DEFECT_ID'))),14,/Root-cause|RCA/],
    ['initial-pre-correction-execution-still-required','regressionExecutions',row=>regIds.has(String(v(row,'REG_ID')))&&String(v(row,'PHASE'))==='PRE_CORRECTION',15,/pre-correction failing execution/],
    ['initial-changeset-still-required','changes',row=>Number(row.stage)===16,16,/correction is missing|changeset trace/]
  ]){
    const project=copy(saved),before=project.projectData[family].length;project.projectData[family]=project.projectData[family].filter(row=>!remove(row));assert(project.projectData[family].length<before);e.recalculate(project);
    const gate=e.gate(stage,project);assert.equal(gate.complete,false,'STAGE17_INITIAL_PREREQUISITE_ORACLE '+caseId);assert(gate.reasons.some(value=>reason.test(value)),'STAGE17_INITIAL_PREREQUISITE_REASON_ORACLE '+caseId+': '+JSON.stringify(gate.reasons));
    assert.throws(()=>pr.reserveAndBuildPromptRecord(project,17,{operation:'ROOT_CAUSE'}),error=>error?.code==='UPSTREAM_STAGE_INCOMPLETE'&&error.upstreamStage===16,'STAGE17_INITIAL_PREREQUISITE_ORACLE: admission cannot bypass missing initial proof');
    cases.push({caseId,stage,operation:'ROOT_CAUSE',result:'PASS',synthetic:true,actualBrowser:false,observedBoundary:'disposable missing-initial-proof counterexample -> actual gate/recalculation -> unchanged prompt prerequisite guard',stageComplete:false});
  }
  const changed=copy(saved),field='EXACT_USER_OBJECTIVE_VERBATIM';
  // The existing synthetic counterpart starts with an unversioned input payload.
  // Record that exact baseline through the real command before changing it.
  if(!changed.projectData.inputVersions.length)e.recordHumanInputVersion(changed,[],'SYNTHETIC_OPERATOR');
  changed.job[field]+=' Synthetic controlled upstream input change.';const input=e.recordHumanInputVersion(changed,[field],'SYNTHETIC_OPERATOR');e.recalculate(changed);
  assert(input.inputVersionId);assert.equal(e.records(changed,'iterations').filter(row=>[10,17].includes(Number(row.stage))).length,0,'STAGE17_CANONICAL_INVALIDATION_ORACLE: changed authoritative input must invalidate active initial/corrected iterations');
  assert(changed.projectData.iterations.some(row=>row.invalidatedBy));assert.equal(e.gate(1,changed).complete,false);assert.equal(e.gate(17,changed).complete,false);
  assert.throws(()=>pr.reserveAndBuildPromptRecord(changed,17,{operation:'ROOT_CAUSE'}),error=>error?.code==='UPSTREAM_STAGE_INCOMPLETE');
  const current17=e.records(saved,'iterations').filter(row=>Number(row.stage)===17).at(-1),laterDefect=e.recordsForIteration(saved,'defects',rid(current17,'iterations')).at(-1);assert(laterDefect);
  for(const options of [{},{allScopes:true}])assert(e.confirmedDefects(saved,options).some(row=>rid(row,'defects')===rid(laterDefect,'defects')),'STAGE17_LATER_DEFECT_RETENTION_ORACLE');
  assert.equal(e.convergenceSnapshot(saved).converged,false);assert.equal(e.gate(18,saved).complete,false);assert.equal(e.gate(19,saved).complete,false);
  cases.push({caseId:'stage17-initial-owner-and-real-upstream-invalidation',stage:17,operation:'ROOT_CAUSE',result:'PASS',synthetic:true,actualBrowser:false,initialIterationId:initialId,laterDefectId:rid(laterDefect,'defects'),currentStage:saved.job.CURRENT_STAGE,inputVersionId:input.inputVersionId,observedBoundary:'actual persisted failed prefix -> initial/later gates and global defect selection; real input-version command -> canonical downstream invalidation'});
}
function verifyPermanentRegressionOwners(r,saved){
  const e=r.engine,rid=e.recordId,initial=e.records(saved,'iterations').filter(row=>Number(row.stage)===10).at(-1),initialIds=e.recordsForIteration(saved,'regressions',rid(initial,'iterations')).map(row=>rid(row,'regressions')),laterIds=e.records(saved,'regressions').filter(row=>Number(row.stage)===17).map(row=>rid(row,'regressions'));
  assert(initialIds.length&&laterIds.length);const initialSelection=e.regressionExecutionSelection(saved,15),corrected=e.regressionExecutionSelection(saved,17),confirmation=e.regressionExecutionSelection(saved,19,{iterationId:e.currentScope(saved).iterationId});
  for(const id of initialIds)assert(initialSelection.registered.some(row=>rid(row,'regressions')===id),'STAGE15_REGRESSION_OWNER_ORACLE: original permanent definition omitted');
  for(const id of laterIds){assert(!initialSelection.registered.some(row=>rid(row,'regressions')===id),'STAGE15_REGRESSION_OWNER_ORACLE: later definition reopened initial stage');assert(corrected.registered.some(row=>rid(row,'regressions')===id));assert(confirmation.registered.some(row=>rid(row,'regressions')===id));}
  for(const stage of [14,15,16])assert.equal(e.gate(stage,saved).complete,true,'STAGE15_REGRESSION_OWNER_ORACLE: later permanent regression must not reopen initial owner');
  assert.equal(e.gate(17,saved).complete,false);
  cases.push({caseId:'stage15-original-and-stage17-19-complete-permanent-regression-selection',stage:17,operation:'REGRESSION',result:'PASS',synthetic:true,actualBrowser:false,initialIds,laterIds,observedBoundary:'actual admitted permanent17 regression -> Stage15 historical selection and current17/19 registered permanent selection -> initial/later gates'});
}

function stage17DeferredReceiptSelection(e,project,{subjectId=null,requireCompleted=false}={}){
  const stage=17,items=e.deferredExecutionPlan(project,stage,{operation:'EXECUTE_FAILURE_TEST'}).items;
  const selected=items.find(item=>{
    if(item.family!=='failureTests'||subjectId!==null&&item.subjectId!==subjectId)return false;
    const definition=e.records(project,'failureTests').find(row=>e.recordId(row,'failureTests')===item.subjectId),earliest=e.recordValue(definition,'EARLIEST_EXECUTABLE_STAGE');
    return e.recordValue(definition,'VERIFICATION_PHASE')==='PREPRODUCT_ITERATION'&&e.recordValue(definition,'PER_RUN_REQUIRED')===false&&Number.isInteger(earliest)&&earliest<=stage;
  })||null;
  if(requireCompleted)assert(selected?.completed,'STAGE17_RECEIPT_PRECURSOR_ORACLE: an actually accepted conditional receipt for the selected subject is required');
  return selected;
}
function stage17DeferredReceiptSelectorControls(select=stage17DeferredReceiptSelection){
  // These are verifier-selection values, never manufactured application state,
  // completed stage gates, accepted receipts, freeze or reservation evidence.
  const e={deferredExecutionPlan:p=>({items:p.items}),records:p=>p.definitions,recordId:row=>row?.id,recordValue:(row,key)=>row?.[key]},other={subjectId:'OTHER-COMPLETED-PER-RUN',family:'failureTests',completed:true},eligible={subjectId:'ELIGIBLE-NON-PER-RUN',family:'failureTests',completed:true},definitions=[{id:other.subjectId,VERIFICATION_PHASE:'PREPRODUCT_ITERATION',PER_RUN_REQUIRED:true,EARLIEST_EXECUTABLE_STAGE:11},{id:eligible.subjectId,VERIFICATION_PHASE:'PREPRODUCT_ITERATION',PER_RUN_REQUIRED:false,EARLIEST_EXECUTABLE_STAGE:8}],mixed={items:[other,eligible],definitions};
  assert.equal(select(e,mixed)?.subjectId,'ELIGIBLE-NON-PER-RUN','STAGE17_MIXED_RECEIPT_SELECTION_ORACLE');
  assert.equal(select(e,mixed,{subjectId:'ELIGIBLE-NON-PER-RUN',requireCompleted:true})?.subjectId,'ELIGIBLE-NON-PER-RUN','STAGE17_EXACT_SELECTED_RECEIPT_ORACLE');
  assert.equal(select(e,{items:[eligible],definitions:[definitions[1]]},{requireCompleted:true})?.subjectId,'ELIGIBLE-NON-PER-RUN','STAGE17_SINGLE_RECEIPT_SELECTION_ORACLE');
  assert.throws(()=>select(e,{items:[other,{...eligible,completed:false}],definitions},{subjectId:'ELIGIBLE-NON-PER-RUN',requireCompleted:true}),error=>error.code==='ERR_ASSERTION'&&error.message.includes('STAGE17_RECEIPT_PRECURSOR_ORACLE'),'STAGE17_MISSING_SELECTED_RECEIPT_ORACLE');
  assert.equal(select(e,{items:[eligible],definitions:[{...definitions[1],EARLIEST_EXECUTABLE_STAGE:24}]}),null,'STAGE17_FUTURE_RECEIPT_SELECTION_ORACLE');
  return {caseId:'stage17-deferred-receipt-selector',result:'PASS',mixedCohort:true,exactSelectedSubject:true,originalSingleControl:true,missingCompletedSelectedReceiptRejected:true,future24NotApplicable:true,boundary:'Verifier selection helper only; actual accepted receipt/freeze/reservation behavior requires its separate mandatory default control.'};
}

async function stage17DeferredReceiptControl(r,initial,sourceOverrides,subjectId){
  const e=r.engine,h=r.runtime.closedLoopHash,stage=17,operation='EXECUTE_FAILURE_TEST',copy=r.copy;
  const itemFor=project=>e.deferredExecutionPlan(project,stage,{operation}).items.find(item=>item.subjectId===subjectId);
  const initialItem=stage17DeferredReceiptSelection(e,initial,{subjectId,requireCompleted:true});
  const subject=e.records(initial,'failureTests').find(row=>e.recordId(row,'failureTests')===subjectId);
  assert.equal(e.recordValue(subject,'VERIFICATION_PHASE'),'PREPRODUCT_ITERATION');assert.equal(e.recordValue(subject,'PER_RUN_REQUIRED'),false);
  assert(!initialItem.binding.targetIdentities.some(row=>['candidateFreezes','iterations','runs'].includes(row.family)),'STAGE17_RECEIPT_NON_RUN_TARGET_ORACLE');
  const receipt=e.records(initial,'regressionExecutions').find(row=>initialItem.receipts.includes(e.recordId(row,'regressionExecutions')));
  assert(receipt,'STAGE17_RECEIPT_CANONICAL_PRECURSOR_ORACLE');
  const receiptId=e.recordId(receipt,'regressionExecutions'),receiptBytes=h.stableStringify(receipt),definitionBytes=h.stableStringify(subject),observation=e.deferredReceiptObservationIdentity(initial,receipt),raw=initial.projectData.rawResponses.find(row=>row.rawResponseId===receipt.rawResponseId);
  assert(observation);assert(raw);const rawBytes=raw.completeRawResponse,phases=[];
  const reportReference=e.deferredReceiptAttachmentState(initial,receipt);assert.equal(reportReference.allowed,true,'STAGE17_RECEIPT_INITIAL_BYTE_CUSTODY_ORACLE');
  const reportFile=await r.store.getArtifact(reportReference.attachmentId,{jobId:initial.job.JOB_ID});assert(reportFile);
  // A documented old-comparator equivalent removes only the normalization
  // which accidentally treated ambient candidate/iteration IDs as material.
  const engineSource=sourceOverrides['workflow-engine.js']||fs.readFileSync('workflow-engine.js','utf8'),normalization='return {...target,compatibilityBinding:{...target.compatibilityBinding,scope:materialScope}};';
  assert.equal(engineSource.split(normalization).length,2,'STAGE17_RECEIPT_OLD_COMPARATOR_FAULT_ANCHOR_ORACLE');
  const prior=projectStoreRuntime({sourceOverrides:{...sourceOverrides,'workflow-engine.js':engineSource.replace(normalization,'return target;')}});
  await restoreArtifactFixture(prior.store,await captureArtifactFixture(r.store,initial.job.JOB_ID));
  assert.equal(prior.engine.deferredReceiptMatches(prior.copy(initial),prior.copy(receipt),prior.copy(initialItem.binding)),true,'STAGE17_RECEIPT_OLD_COMPARATOR_CONFORMING_CONTROL_ORACLE');
  return {
    async observe(project,phase){
      const reloaded=await r.store.readProject(project.job.JOB_ID),item=itemFor(reloaded),current=e.records(reloaded,'regressionExecutions').find(row=>e.recordId(row,'regressionExecutions')===receiptId);
      assert.equal(reloaded.projectSha256,project.projectSha256,'STAGE17_RECEIPT_OBSERVATION_MUST_NOT_WRITE_ORACLE');
      assert(item);assert.equal(item.completed,true,'STAGE17_RECEIPT_FREEZE_RESERVATION_ORACLE: '+phase);
      assert.deepEqual(Array.from(item.receipts),[receiptId],'STAGE17_RECEIPT_NO_REPEATED_EXECUTION_ORACLE: '+phase);
      assert.equal(h.stableStringify(current),receiptBytes);assert.equal(h.stableStringify(e.records(reloaded,'failureTests').find(row=>e.recordId(row,'failureTests')===subjectId)),definitionBytes);
      assert.equal(reloaded.projectData.rawResponses.find(row=>row.rawResponseId===raw.rawResponseId).completeRawResponse,rawBytes);
      assert.equal(e.deferredReceiptObservationIdentity(reloaded,current),observation,'STAGE17_RECEIPT_STABLE_OBSERVATION_IDENTITY_ORACLE');
      assert.equal(e.deferredReceiptAttachmentState(reloaded,current).allowed,true,'STAGE17_RECEIPT_RELOAD_CUSTODY_ORACLE');
      assert.equal(prior.engine.deferredReceiptMatches(prior.copy(reloaded),prior.copy(current),prior.copy(item.binding)),false,'STAGE17_RECEIPT_OLD_COMPARATOR_COUNTEREXAMPLE_ORACLE: '+phase);
      phases.push({phase,completed:true,receiptId,rawPreserved:true,definitionPreserved:true,byteCustodyReobserved:true,oldComparatorWouldRepeat:true});
    },
    async finish(project,runs){
      const item=itemFor(project),current=e.records(project,'regressionExecutions').find(row=>e.recordId(row,'regressionExecutions')===receiptId),idempotent=copy(project),before=h.sha256Value(idempotent);
      assert.deepEqual(Array.from(e.reserveRunBatch(idempotent,{stage}),row=>({...row})),Array.from(runs,row=>({...row})),'STAGE17_RECEIPT_IDEMPOTENT_BATCH_ORACLE');assert.equal(h.sha256Value(idempotent),before,'STAGE17_RECEIPT_IDEMPOTENT_BATCH_STATE_ORACLE');
      const changedBindings=[['subject',binding=>binding.subjectSha256='0'.repeat(64)],['fixture',binding=>binding.fixtureSha256='0'.repeat(64)],['test',binding=>binding.testSha256='0'.repeat(64)],['input-version',binding=>binding.scope.inputVersion='SYNTHETIC_CHANGED_MATERIAL_INPUT'],['instruction-version',binding=>binding.compatibilityBinding.scope.instructionVersion='SYNTHETIC_CHANGED_MATERIAL_INSTRUCTION'],['activation',binding=>binding.compatibilityBinding.historyActivationId='SYNTHETIC_CHANGED_ACTIVATION']];
      for(const [name,mutate]of changedBindings){const binding=copy(item.binding);mutate(binding);assert.equal(e.deferredReceiptMatches(project,current,binding),false,'STAGE17_RECEIPT_MATERIAL_CHANGE_ORACLE: '+name);}
      const head=project.projectSha256;
      await r.store.deleteArtifact(reportFile.artifactId,project.job.JOB_ID);
      try{
        const missing=await r.store.readProject(project.job.JOB_ID),missingReceipt=e.records(missing,'regressionExecutions').find(row=>e.recordId(row,'regressionExecutions')===receiptId);
        assert.equal(e.deferredReceiptAttachmentState(missing,missingReceipt).allowed,false,'STAGE17_RECEIPT_MISSING_BYTES_AUTHORITY_ORACLE');assert.equal(itemFor(missing).completed,false,'STAGE17_RECEIPT_MISSING_BYTES_BLOCK_ORACLE');assert.equal(missing.projectSha256,head);assert.equal(h.stableStringify(missingReceipt),receiptBytes);
      }finally{await r.store.putArtifact({...reportFile,expectedSha256:reportFile.sha256});}
      const restored=await r.store.readProject(project.job.JOB_ID);assert.equal(itemFor(restored).completed,true,'STAGE17_RECEIPT_RESTORED_BYTES_PROGRESS_ORACLE');assert.equal(restored.projectSha256,head);
      const result={operation:'EXECUTE_FAILURE_TEST',caseId:'stage17-deferred-receipt-freeze-reservation',requirementRefs:[1331,1502,1503,2884,2923].map(line=>'specification/closed-loop-reliability-controlling-implementation-specification.txt:'+line),subjectId,receiptId,phases,idempotentBatch:true,materialBindingNegatives:changedBindings.map(([name])=>name),missingBytesBlocked:true,restoredBytesProgress:true,canonicalStateUnchangedByNegatives:true,observedBoundary:'Actual accepted file/returned report -> real Stage17 freeze -> real ten-slot reservation -> store/readback; old-comparator and material-binding helpers are explicitly isolated counterfactuals.',synthetic:true,actualBrowser:false};
      assert.deepEqual(phases.map(row=>row.phase),['after-freeze','after-run-reservation']);
      console.error(JSON.stringify({phase:'stage17-receipt-freeze-controls',...result}));return result;
    }
  };
}

// A disposable Stage17 branch establishes real failed-run data before asking
// the exact ROOT_CAUSE / CORRECT actors for a proposal. The main journey stays
// unchanged and still supplies the separate clean corrected-iteration control.
async function verifyStage17FailureCorrection() {
  const stage=17,original=hash.sha256Value(p),originalInstruction=hash.sha256Value(engine.records(p,'instructions'));
  assert.equal(engine.gate(16,p).complete,true,'STAGE17_UPSTREAM_ORACLE: accepted Stage16 correction is required');
  const r=projectStoreRuntime({sourceOverrides:runtimeSources}),{store,copy}=r,e=r.engine,pr=r.prompts,i=r.ingestion,s=r.runtime.closedLoopWorkflowSchema;
  await restoreArtifactFixture(store,await captureArtifactFixture(byteStore,p.job.JOB_ID));
  const fork=copy(p);fork.activeStage=17;e.recalculate(fork);
  await hydrateRetainedPromptContexts(r,fork,[...retainedContextFiles.values()]);
  let saved=await store.writeProject(fork,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
  if(diagnosticPrefixDir){
    // Retain accepted Stage15/16 work before a disposable setup assumption.
    // This is an entry checkpoint, distinct from the later failed-RCA boundary.
    for(let prior=1;prior<=16;prior++)assert.equal(e.gate(prior,saved).complete,true,'DIAGNOSTIC_STAGE17_ENTRY_PREDECESSOR_ORACLE: '+prior);
    const file=diagnosticPrefixDir+'/prefix-stage17-entry.json';fs.writeFileSync(file,JSON.stringify({schema:'closed-loop-counterpart-diagnostic-prefix/1',...diagnosticClockMetadata,sourceFingerprints,entryStage:17,authorBoundary:'ENTRY_STAGE17_AFTER_ACCEPTED_STAGE16',completedPriorStages:16,project:saved,artifacts:await captureArtifactFixture(store,saved.job.JOB_ID),contextFiles:[...retainedContextFiles.values()],synthetic:true,actualBrowser:false,earlierCompleteFlagsForced:false}));diagnosticPrefixFiles.push(file);
    console.error(JSON.stringify({phase:'diagnostic-stage17-entry-retained',file,projectSha256:saved.projectSha256,nextAction:e.operationalNextAction(saved,stage)}));
  }
  const v=e.recordValue,rid=(record,family)=>e.recordId(record,family),proof=[];let deferredReceiptRegression=null;
  let checkpointSequence=0;
  const retainSetupCheckpoint=async phase=>{if(!diagnosticPrefixDir)return;const file=diagnosticPrefixDir+'/checkpoint-stage17-last-accepted.json',temporary=file+'.tmp',plan=e.deferredExecutionPlan(saved,stage),checkpoint={schema:'closed-loop-counterpart-diagnostic-prefix/1',...diagnosticClockMetadata,sourceFingerprints,entryStage:17,authorBoundary:'ENTRY_STAGE17_AFTER_ACCEPTED_STAGE16',completedPriorStages:16,lastAcceptedSetupPhase:phase,project:saved,artifacts:await captureArtifactFixture(store,saved.job.JOB_ID),contextFiles:[...retainedContextFiles.values(),...setupContexts.values()],setupReceipts:proof,bindingDiagnostics:plan.items.map(item=>({family:item.family,subjectId:item.subjectId,completed:item.completed,receipts:item.receipts,compatibility:item.compatibility,binding:item.binding,targetIdentities:item.targetIdentities,scope:item.scope})),synthetic:true,actualBrowser:false,earlierCompleteFlagsForced:false};fs.writeFileSync(temporary,JSON.stringify(checkpoint));fs.renameSync(temporary,file);const numbered=diagnosticPrefixDir+'/checkpoint-stage17-'+String(++checkpointSequence).padStart(2,'0')+'-'+phase+'.json';fs.copyFileSync(file,numbered);console.error(JSON.stringify({phase:'stage17-durable-acceptance-checkpoint',operation:phase,file:numbered,projectSha256:saved.projectSha256,nextAction:e.operationalNextAction(saved,stage)}));};
  const persist=async project=>{const impact=store.mutationImpact(saved,project);saved=await store.writeProject(project,{expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256,...(impact.requiresConfirmation?{mutationConfirmation:impact}:{})});};
  const command=async(mutate,phase='APPLICATION_COMMAND')=>{const project=copy(saved);const result=mutate(project);await persist(project);await retainSetupCheckpoint(phase);return result;};
  const freeze=async()=>command(project=>{
    const artifactId=artifactFixtureId(e,project,'CANDIDATE-FILE'),artifact=e.records(project,'artifacts').find(row=>rid(row,'artifacts')===artifactId);
    assert(artifact,'STAGE17_COMPONENT_ORACLE: current verified candidate bytes are required');
    const artifactIds=[artifactId],decision=e.recordRegisteredHumanDecision(project,{stage,purpose:'CANDIDATE_COMPONENT_SELECTION',targetFamily:'artifacts',targetId:hash.sha256Value(artifactIds),value:artifactIds,operatorLabel:'SYNTHETIC_STAGE17_OPERATOR'});
    return e.freezeCandidate(project,{stage,artifactIds,selectionDecisionId:rid(decision,'humanDecisions'),operatorLabel:'SYNTHETIC_STAGE17_OPERATOR'});
  },'FREEZE_CANDIDATE');
  async function admit(operation,makeResponse=null,{omitTerminalLF=false}={}) {
    console.error(JSON.stringify({phase:'stage17-admit-start',stage,operation}));
    const draft=copy(saved),reserved=pr.reserveAndBuildPromptRecord(draft,stage,{operation}).prompt;
    await persist(draft);
    const prompt=saved.projectData.generatedPrompts.find(row=>row.instructionId===reserved.instructionId);
    const pkg=await store.createExecutionPackage({jobId:saved.job.JOB_ID,stage,operation,instructionId:prompt.instructionId});
    const members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer()));
    const member=path=>{const row=members.find(item=>item.canonicalPath===path);assert(row,'Missing exported member '+path);return Buffer.from(row.bytes);};
    const manifest=JSON.parse(member('manifest.json').toString('utf8')),instructionBytes=member('instruction.txt');
    assert.equal(instructionBytes.toString('utf8'),prompt.prompt);
    assert.equal(manifest.stage,stage);assert.equal(manifest.operation,operation);
    for(const key of ['packageId','operationReservationId','challengeNonce'])assert.equal(manifest[key],prompt[key]);
    assert.equal(manifest.promptIdentity.instructionId,prompt.instructionId);
    const contextFiles=manifest.contextFiles.map(file=>{const bytes=member(file.path);assert.equal(bytes.length,file.byteSize);assert.equal(hash.sha256Text(bytes.toString('utf8')),file.sha256);return {filename:file.path,bytes};});
    assert(!manifest.attachmentSlots.some(slot=>slot.required&&slot.role!=='STRUCTURED_RESPONSE'),'STAGE17_RETURN_BYTES_ORACLE: required files must have actual bytes');
    const actors={schema:s,engine:e,prompt,manifest,contextFiles,instructionBytes,omitTerminalLF};
    const exported=[];
    for(const file of contextFiles)for(const block of JSON.parse(file.bytes.toString('utf8')).members||[])exported.push(block);
    for(const match of instructionBytes.toString('utf8').matchAll(/BEGIN_UNTRUSTED_DATA_BLOCK\s*([\s\S]*?)\s*END_UNTRUSTED_DATA_BLOCK/g))exported.push(JSON.parse(match[1]));
    const rows=family=>{const block=exported.find(item=>item.sourceIdentity==='collection.'+family);return block?JSON.parse(block.value).records:[];};
    const latest=family=>rows(family).at(-1),reference=(row,family)=>{assert(row,'Missing exported '+family);return {recordId:rid(row,family)};};
    const template=JSON.parse(instructionBytes.toString('utf8').split('\nSTRICT RESPONSE CONTRACT\n').at(-1).split('\n\nEND COPY BLOCK')[0]);
    const base=()=>({schema:s.RESPONSE_SCHEMA,contractProfileId:s.CONTRACT_PROFILE_ID,jobId:template.jobId,stage,operation,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce,scope:manifest.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{},evidence:[{temporaryKey:'evidence-1',kind:'SYNTHETIC_OPERATOR_JOURNEY',description:'Actual synthetic Stage17 '+operation+' comparison/control',authorityType:'AGENT_CLAIM',location:'verify-operator-counterpart.mjs',content:'Synthetic local fixture only. No real human, external-system execution or physical-device observation asserted.'}],unresolved:[],warnings:[],attachments:[]});
    const authored=makeResponse?await makeResponse({base,rows,latest,reference,manifest,prompt,instructionBytes}):responseFixture(actors),envelope=authored.envelope||authored,received=copy(saved),files=[];
    for(const returned of authored.returnedAttachments||[]){const descriptor=envelope.attachments.find(row=>row.temporaryKey===returned.temporaryKey);assert(descriptor,'STAGE17_RETURNED_EVIDENCE_SLOT_ORACLE');assert(i.attachmentSlotPlan(received,copy(envelope),prompt).some(row=>row.attachmentSlotId===descriptor.attachmentSlotId));const artifactId=e.allocateId(received,'artifacts',copy({targetSlot:descriptor.attachmentSlotId,payload:{stage,filename:descriptor.filename,mediaType:descriptor.mediaType,byteSize:descriptor.byteSize,sha256:descriptor.sha256}})),blob=new Blob([returned.bytes],{type:descriptor.mediaType}),stored=await store.putArtifact({artifactId,jobId:saved.job.JOB_ID,blob,filename:descriptor.filename,mediaType:descriptor.mediaType,expectedSha256:descriptor.sha256});assert.equal(stored.byteSize,descriptor.byteSize);assert.equal(Buffer.from(await (await store.getArtifact(artifactId,{jobId:saved.job.JOB_ID})).blob.arrayBuffer()).equals(Buffer.from(returned.bytes)),true,'STAGE17_RETURNED_EVIDENCE_BYTES_ORACLE');files.push({artifactId,name:stored.filename,type:stored.mediaType,size:stored.byteSize,sha256:stored.sha256,attachmentSlotId:descriptor.attachmentSlotId});}
    for(const file of contextFiles)setupContexts.set(hash.sha256Text(file.bytes.toString('utf8')),{filename:file.filename,text:file.bytes.toString('utf8'),sha256:hash.sha256Text(file.bytes.toString('utf8')),byteSize:file.bytes.length});
    const text=JSON.stringify(envelope),staged=await store.stageResponseFile({jobId:saved.job.JOB_ID,stage,blob:new Blob([text],{type:'application/json'}),rawFilename:'response.json',mediaType:'application/json',promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce});
    const file=await store.readStagedResponseFile({jobId:saved.job.JOB_ID,stagingId:staged.stagingId});
    assert.equal(new TextDecoder('utf-8',{fatal:true}).decode(file.bytes),text);
    const before=saved.projectData.acceptedChanges.length,captured=i.captureRaw(received,{stage,text,promptRecord:prompt,files,transport:{authority:'AUTHORITATIVE_RESPONSE_FILE',stagingId:staged.stagingId,rawFilename:'response.json',mediaType:'application/json',status:file.status,sha256:file.sha256,byteSize:file.byteSize,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce}});
    saved=await store.writeProject(captured.project,{operational:true,expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});
    const prepared=i.prepareCaptured(saved,{rawResponseId:captured.rawRecord.rawResponseId});
    assert.equal(prepared.validation.valid,true,'STAGE17_ADMISSION_ORACLE '+operation+': '+JSON.stringify(prepared.validation.issues));
    assert.equal(prepared.proposal.status,'PENDING_OPERATOR_REVIEW');assert.equal(prepared.project.projectData.acceptedChanges.length,before);
    saved=await store.writeProject(prepared.project,{operational:true,expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});
    const committed=i.commit(saved,prepared.proposal.proposalId,{operator:'SYNTHETIC_STAGE17_OPERATOR'});await persist(committed.project);
    saved=await store.readProject(saved.job.JOB_ID);
    assert.equal(store.validateProjectIntegrity(saved).valid,true);
    const accepted=e.acceptedChanges(saved,stage).find(row=>row.proposalId===prepared.proposal.proposalId);
    assert.equal(accepted.operation,operation);assert.equal(i.findRaw(saved,captured.rawRecord.rawResponseId).completeRawResponse,text);
    const duplicate=i.commit(saved,prepared.proposal.proposalId,{operator:'SYNTHETIC_STAGE17_OPERATOR'});assert.equal(duplicate.idempotent,true);
    const item={operation,rawResponseId:captured.rawRecord.rawResponseId,proposalId:prepared.proposal.proposalId,acceptedChangeId:accepted.changeId,scope:accepted.scope,rawResponseSha256:file.sha256};proof.push(item);
    console.error(JSON.stringify({phase:'stage17-admit-complete',stage,...item}));
    await retainSetupCheckpoint(operation);
    return item;
  }
  // Setup uses the existing counterpart admission path, without duplicating
  // every setup operation's already-covered file staging/persistence boundary.
  // ROOT_CAUSE / REGRESSION / CORRECT below retain the full ZIP/file/store path.
  const setupContexts=new Map([...retainedContextFiles.entries()]);
  async function establishSetup(operation,{omitTerminalLF=false}={}) {
    console.error(JSON.stringify({phase:'stage17-setup-start',stage,operation}));
    const draft=copy(saved),prompt=pr.reserveAndBuildPromptRecord(draft,stage,{operation}).prompt;
    const contextFiles=pr.materializePromptContextFiles(prompt,draft);
    for(const file of contextFiles)setupContexts.set(file.sha256,file);
    const manifest=pr.promptFileManifest(prompt),envelope=responseFixture({schema:s,engine:e,prompt,manifest,instructionBytes:Buffer.from(prompt.prompt),contextFiles:contextFiles.map(file=>({filename:file.filename,bytes:Buffer.from(file.text)})),omitTerminalLF});
    const text=JSON.stringify(envelope),before=draft.projectData.acceptedChanges.length;
    const prepared=i.prepare(draft,{stage,text,promptRecord:prompt,transport:{packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce}});
    assert.equal(prepared.validation.valid,true,'STAGE17_SETUP_ADMISSION_ORACLE '+operation+': '+JSON.stringify(prepared.validation.issues));
    assert.equal(prepared.proposal.status,'PENDING_OPERATOR_REVIEW');assert.equal(prepared.project.projectData.acceptedChanges.length,before);
    const committed=i.commit(prepared.project,prepared.proposal.proposalId,{operator:'SYNTHETIC_STAGE17_OPERATOR'});saved=committed.project;
    const accepted=e.acceptedChanges(saved,stage).find(row=>row.proposalId===prepared.proposal.proposalId);
    assert.equal(accepted.operation,operation);
    proof.push({operation,rawResponseId:accepted.rawResponseId,proposalId:prepared.proposal.proposalId,acceptedChangeId:accepted.changeId,scope:accepted.scope,observedBoundary:'production reservation/generated context -> prepare -> operator commit; setup prefix persisted together after comparison'});
    console.error(JSON.stringify({phase:'stage17-setup-complete',stage,operation,rawResponseId:accepted.rawResponseId}));
  }
  const entryAction=e.operationalNextAction(saved,stage);
  if(diagnosticPrefixDir&&entryAction.operation==='EXECUTE_FAILURE_TEST'){
    assert.equal(entryAction.actionType,'EXTERNAL_AGENT_TOOL');const definition=e.records(saved,'failureTests').find(row=>rid(row,'failureTests')===entryAction.deferredSubjectId),definitionBytes=JSON.stringify(definition);
    await admit(entryAction.operation,({manifest,prompt})=>deferredFailureExecutionResponseFixture({schema:s,hash:r.runtime.closedLoopHash},manifest,prompt.contextManifest.deferredExecutionBinding,{isolationIdentity:'synthetic-stage17-original-eight-byte-fixture'}));
    assert.equal(JSON.stringify(e.records(saved,'failureTests').find(row=>row.id===definition.id)),definitionBytes,'STAGE17_CONDITIONAL_DEFINITION_PRESERVATION_ORACLE');assert.equal(e.deferredExecutionPlan(saved,stage,{operation:entryAction.operation}).items.find(row=>row.subjectId===definition.id).completed,true,'STAGE17_CONDITIONAL_RETURNED_RECEIPT_ORACLE');
  }
  // The default due-stage verifier generates this legitimate diagnostic
  // predecessor. Keep the accepted conditional receipt across the real freeze
  // and ten-slot reservation, rather than manufacturing completed stages.
  const scheduledReceiptControl=diagnosticPrefixDir&&stage17DeferredReceiptSelection(e,saved);
  const receiptControl=scheduledReceiptControl?await stage17DeferredReceiptControl(r,saved,runtimeSources,scheduledReceiptControl.subjectId):null;
  const retainedIteration=diagnosticPrefixInput&&e.records(saved,'iterations').find(row=>Number(row.stage)===stage&&rid(row,'iterations')===e.currentScope(saved).iterationId),retainedCandidate=retainedIteration&&e.records(saved,'candidateFreezes').find(row=>rid(row,'candidateFreezes')===String(v(retainedIteration,'CANDIDATE_ID')||retainedIteration.scope?.candidateId||''));
  let first;if(retainedIteration){assert(retainedCandidate,'STAGE17_RETAINED_CANDIDATE_ORACLE');first={iteration:retainedIteration,candidate:retainedCandidate};}else{assert.equal(e.operationalNextAction(saved,stage).actionType,'FREEZE_CANDIDATE','STAGE17_ENTRY_ACTION_ORACLE: '+JSON.stringify(e.operationalNextAction(saved,stage)));first=await freeze();}
  if(receiptControl)await receiptControl.observe(saved,'after-freeze');
  const iterationId=rid(first.iteration,'iterations'),candidateId=rid(first.candidate,'candidateFreezes');
  assert.equal(e.evaluateCorrectedIterationLineage(saved,iterationId).valid,true);
  const retainedRuns=diagnosticPrefixInput?e.recordsForIteration(saved,'runs',iterationId):[],runs=retainedRuns.length?retainedRuns.map(row=>({runId:rid(row,'runs'),contextId:String(v(row,'CONTEXT_ID'))})):await command(project=>e.reserveRunBatch(project,{stage}),'RESERVE_RUN_BATCH');
  assert.equal(runs.length,10);assert.equal(new Set(runs.map(row=>row.runId)).size,10);assert.equal(new Set(runs.map(row=>row.contextId)).size,10);
  if(receiptControl){await receiptControl.observe(saved,'after-run-reservation');deferredReceiptRegression=await receiptControl.finish(saved,runs);}
  const setupPersistenceBase=copy(saved);
  for(let index=0;index<10;index++) {const action=e.operationalNextAction(saved,stage);assert.equal(action.operation,'EXECUTE_RUN');await establishSetup('EXECUTE_RUN',{omitTerminalLF:index===0});}
  for(let index=0;index<10;index++) {assert.equal(e.operationalNextAction(saved,stage).operation,'VERIFY');await establishSetup('VERIFY');}
  assert.equal(e.operationalNextAction(saved,stage).operation,'COMPARE');await establishSetup('COMPARE');
  await hydrateRetainedPromptContexts(r,saved,[...setupContexts.values()]);
  {const impact=store.mutationImpact(setupPersistenceBase,saved);saved=await store.writeProject(saved,{expectedProjectRevision:setupPersistenceBase.revision,expectedStateSha256:setupPersistenceBase.projectSha256,...(impact.requiresConfirmation?{mutationConfirmation:impact}:{})});}
  saved=await store.readProject(saved.job.JOB_ID);assert.equal(store.validateProjectIntegrity(saved).valid,true);
  console.error(JSON.stringify({phase:'stage17-legitimate-failed-prefix-stored',stage,setupReceipts:proof.length}));
  await retainSetupCheckpoint('COMPARE');
  verifyInitialAnalysisOwners(r,saved);
  const failedRun=e.records(saved,'runs').find(row=>row.scope?.iterationId===iterationId&&v(row,'COMPLETE_OUTPUT')==='VERIFIED');
  const defect=e.records(saved,'defects').find(row=>row.scope?.iterationId===iterationId&&String(v(row,'RUN_ID'))===rid(failedRun,'runs'));
  assert(failedRun&&defect,'STAGE17_OBSERVED_DEFECT_ORACLE: actual accepted bad run, verification and comparison must produce the linked defect');
  const defectId=rid(defect,'defects'),runId=rid(failedRun,'runs'),failingBytes=Buffer.from(v(failedRun,'COMPLETE_OUTPUT'),'utf8');
  assert.equal(failingBytes.equals(Buffer.from(OUTPUT)),false);assert.equal(Buffer.from(OUTPUT).equals(Buffer.from('VERIFIED\n')),true);
  assert.equal(e.gate(stage,saved).complete,false);
  assert.equal(e.operationalNextAction(saved,stage).operation,'ROOT_CAUSE');
  const rca=await admit('ROOT_CAUSE',({base,rows,reference})=>{
    const response=base(),d=rows('defects').find(row=>rid(row,'defects')===defectId);assert(d,'The RCA actor must receive its exact current defect');
    assert(rows('runs').some(row=>rid(row,'runs')===runId),'The RCA actor must receive its exact failed run');
    response.records.rootCauses=[recordProposal(s,'rootCauses',{tempKey:'stage17-transport-root-cause',relationships:{DEFECT_ID:reference(d,'defects')},overrides:{CATEGORY:'EXECUTION',LAYER_TRACE:'Explicit terminal-LF requirement -> unchanged correct instruction -> synthetic executor omitted LF -> actual verifier refuted the output.',EARLIEST_DEFECTIVE_LAYER:'EXECUTION',ROOT_CAUSE:'The deliberately defective synthetic executor returned eight bytes, omitting terminal LF.',EVIDENCE:'Accepted run '+runId+' and its actual verification/comparison preserve the missing byte.',DOWNSTREAM_INVALIDATION:'Preserve failed iteration and re-execute a distinct corrected iteration.'}})];return response;
  });
  assert.equal(e.gate(stage,saved).complete,false,'STAGE17_RCA_NEGATIVE_GATE_ORACLE: admitting supported RCA cannot repair the failed runs');
  assert.equal(e.operationalNextAction(saved,stage).operation,'REGRESSION');
  if(diagnosticPrefixDir){
    // A genuinely failed disposable iteration supplies the existing REGRESSION
    // author boundary. No main-journey stage or completion flag is altered.
    for(let prior=1;prior<=16;prior++)assert.equal(e.gate(prior,saved).complete,true,'DIAGNOSTIC_STAGE17_AUTHOR_PREDECESSOR_ORACLE: '+prior);
    fs.mkdirSync(diagnosticPrefixDir,{recursive:true});const file=diagnosticPrefixDir+'/prefix-stage17.json';
    fs.writeFileSync(file,JSON.stringify({schema:'closed-loop-counterpart-diagnostic-prefix/1',...diagnosticClockMetadata,sourceFingerprints,entryStage:17,operation:'REGRESSION',authorBoundary:'ACTUAL_FAILED_ITERATION_WITH_ACCEPTED_ROOT_CAUSE',completedPriorStages:16,project:saved,artifacts:await captureArtifactFixture(store,saved.job.JOB_ID),contextFiles:[...setupContexts.values()],currentIterationId:iterationId,currentCandidateId:candidateId,currentDefectId:defectId,rootCauseReceipt:rca,setupReceipts:proof,deferredReceiptRegression,synthetic:true,actualBrowser:false,earlierCompleteFlagsForced:false}));
    diagnosticPrefixFiles.push(file);assert.equal(hash.sha256Value(p),original,'STAGE17_DISPOSABLE_ISOLATION_ORACLE');return;
  }
  await admit('REGRESSION',({base,rows,reference,manifest})=>{
    const response=base(),d=rows('defects').find(row=>rid(row,'defects')===defectId),req=rows('requirements').find(row=>rid(row,'requirements')===String(v(d,'REQ_ID')));
    assert(d&&req,'Regression actor needs the typed current defect/requirement');
    assert.equal(failingBytes.equals(Buffer.from(OUTPUT)),false,'STAGE17_PRE_CORRECTION_EXECUTION_ORACLE: actual negative byte comparison is required');
    const rec=(family,key,fields,relationships)=>recordProposal(s,family,{tempKey:key,overrides:fields,relationships});
    response.records.regressions=[rec('regressions','stage17-permanent-lf',{FAILURE_FIXTURE:failingBytes.toString('utf8'),REPRODUCTION_PROCEDURE:'Compare the accepted eight-byte output with the required nine-byte VERIFIED + LF output.',DETECTION_METHOD:'Disposable exact-byte equality comparison',CORRECTION:'Preserve complete synthetic executor output including terminal LF.',PERMANENT_TEST_LOCATION:'Current permanent regression registry',APPLICABILITY:'APPLICABLE',EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',REQUIRED_CAPABILITY:'INDEPENDENT_AGENT_REVIEW'},{DEFECT_ID:reference(d,'defects'),REQ_ID:reference(req,'requirements')})];
    const refs={ITERATION_ID:{recordId:manifest.scope.iterationId},CANDIDATE_ID:{recordId:manifest.scope.candidateId}};
    response.records.regressionExecutions=[rec('regressionExecutions','stage17-new-pre-correction',{PHASE:'PRE_CORRECTION',RESULT:'VIOLATED'},{...refs,REG_ID:{tempKey:'stage17-permanent-lf'}})];
    // The current candidate follows the prior Stage16 correction yet actually
    // failed. Retain adverse current-candidate executions, including the newly
    // installed regression, rather than relabeling them as successful.
    for(const [index,reg] of rows('regressions').entries()) {
      assert.equal(Buffer.from(v(reg,'FAILURE_FIXTURE')).equals(Buffer.from(OUTPUT)),false);
      response.records.regressionExecutions.push(rec('regressionExecutions','stage17-prior-current-'+index,{PHASE:'POST_CORRECTION',RESULT:'VIOLATED'},{...refs,REG_ID:reference(reg,'regressions')}));
    }
    response.records.regressionExecutions.push(rec('regressionExecutions','stage17-new-current',{PHASE:'POST_CORRECTION',RESULT:'VIOLATED'},{...refs,REG_ID:{tempKey:'stage17-permanent-lf'}}));
    response.evidence[0].content=JSON.stringify({synthetic:true,actualComparisonExecuted:true,expectedUtf8Base64:Buffer.from(OUTPUT).toString('base64'),observedUtf8Base64:failingBytes.toString('base64'),equal:false,iterationId:manifest.scope.iterationId,candidateId:manifest.scope.candidateId,realExternalActor:false});return response;
  });
  verifyPermanentRegressionOwners(r,saved);
  assert.equal(e.gate(stage,saved).complete,false);assert.equal(e.operationalNextAction(saved,stage).operation,'CORRECT');
  const correction=await admit('CORRECT',({base,rows})=>{
    const response=base(),d=rows('defects').find(row=>rid(row,'defects')===defectId),cause=rows('rootCauses').find(row=>String(v(row,'DEFECT_ID'))===defectId);
    assert(d&&cause,'Correction actor must receive the exact current defect and admitted RCA');
    response.records.changes=[recordProposal(s,'changes',{tempKey:'stage17-execution-preserves-lf',overrides:{TRIGGERING_DEFECT_IDS:rid(d,'defects'),ROOT_CAUSE_ANALYSIS:v(cause,'ROOT_CAUSE'),RESPONSIBLE_LAYER:'EXECUTION',OLD_ARTIFACT_VERSION:'Synthetic Stage17 executor with omitted LF',EXACT_MODIFICATION:'Use the conforming synthetic output construction VERIFIED followed by one LF; preserve the correct frozen instruction.',NEW_ARTIFACT_VERSION:'Synthetic Stage17 executor preserving LF',DOWNSTREAM_INVALIDATION:'Preserve failed current iteration; create and re-execute a distinct corrected iteration and all dependent reviews.',REQUIRED_RERUNS:'Ten new corrected runs and current complete verification, comparison, and regression execution.',INSTRUCTION_CHANGE_DETERMINATION:'UNCHANGED',REQUIRED_REPEATED_PREFLIGHT:'NOT REQUIRED',JUSTIFIED_UNCHANGED_ARTIFACTS:'The accepted frozen instruction already requires the correct exact LF.',EVIDENCE:'The disposable positive comparison produced the exact nine required bytes; failed current run evidence remains preserved.'}})];return response;
  });
  assert.equal(e.gate(stage,saved).complete,false,'STAGE17_CORRECTION_NEGATIVE_GATE_ORACLE: accepted execution correction cannot complete a failed iteration');
  assert.equal(hash.sha256Value(structuredClone(e.records(saved,'instructions'))),originalInstruction,'STAGE17_INSTRUCTION_PRESERVATION_ORACLE');
  assert.equal(e.operationalNextAction(saved,stage).actionType,'FREEZE_CANDIDATE');
  const failedScope={iterationId,candidateId},rawBefore=proof.map(row=>({rawResponseId:row.rawResponseId,sha256:i.findRaw(saved,row.rawResponseId).sha256,bytes:i.findRaw(saved,row.rawResponseId).completeRawResponse}));
  const next=await freeze(),nextIterationId=rid(next.iteration,'iterations'),nextCandidateId=rid(next.candidate,'candidateFreezes'),change=e.records(saved,'changes').find(row=>row.sourceProposalId===correction.proposalId)||e.records(saved,'changes').at(-1);
  assert.notEqual(nextIterationId,iterationId);assert.notEqual(nextCandidateId,candidateId);
  assert.equal(v(next.iteration,'PREVIOUS_ITERATION_ID'),iterationId);assert.equal(v(next.iteration,'CHANGESET_ID'),rid(change,'changes'));
  assert.equal(e.evaluateCorrectedIterationLineage(saved,nextIterationId).valid,true);
  const nextRuns=await command(project=>e.reserveRunBatch(project,{stage}),'RESERVE_RUN_BATCH');
  assert.equal(nextRuns.length,10);assert(nextRuns.every(row=>!runs.some(old=>old.runId===row.runId||old.contextId===row.contextId)));
  assert.equal(e.records(saved,'runs').filter(row=>row.scope?.iterationId===nextIterationId&&v(row,'EXECUTION_STATUS')==='COMPLETED').length,0);
  assert.equal(e.gate(stage,saved).complete,false,'STAGE17_EMPTY_BATCH_NEGATIVE_GATE_ORACLE: fresh empty batch cannot inherit old success/failure counts');
  assert.equal(e.operationalNextAction(saved,stage).operation,'EXECUTE_RUN');
  for(const raw of rawBefore)assert.equal(i.findRaw(saved,raw.rawResponseId).completeRawResponse,raw.bytes,'STAGE17_HISTORY_RETENTION_ORACLE');
  assert.equal(store.validateProjectIntegrity(await store.readProject(saved.job.JOB_ID)).valid,true);
  assert.equal(hash.sha256Value(p),original,'STAGE17_DISPOSABLE_ISOLATION_ORACLE');
  cases.push({caseId:'stage17-failed-iteration-root-cause-correction-fresh-freeze',stage,operations:['ROOT_CAUSE','CORRECT'],result:'PASS',synthetic:true,actualBrowser:false,oldScope:failedScope,newScope:{iterationId:nextIterationId,candidateId:nextCandidateId},defectId,rootCauseReceipt:rca,correctionReceipt:correction,allReceipts:proof,acceptedFailedIterationStillIncomplete:true,instructionPreserved:true,newEmptyBatchIncomplete:true,priorRawBytesPreserved:true,mainLifecycleUnchanged:true,observedBoundary:'actual accepted failed ten-run prefix -> actual ZIP/staged response -> prepare/operator commit -> metadata store/readback -> adverse gate -> fresh application-owned freeze/batch'});
}

cases.push(stage17DeferredReceiptSelectorControls());
for(let stage=diagnosticRecovered?Number(diagnosticRecovered.entryStage):1;stage<=stageLimit;stage++){
  if(diagnosticPrefixDir&&[7,8,15].includes(stage))await emitDiagnosticPrefix(stage);
  if(stage===7&&!injectedFault&&!diagnosticPrefixDir)await verifyOwningStageExecution(stage,'EXECUTE_FAILURE_TEST');
  if(stage===15&&!injectedFault&&!diagnosticPrefixDir)await verifyOwningStageExecution(stage,'EXECUTE_REGRESSION');
  if(stage===17&&!diagnosticPrefixDir&&(!injectedFault||initialOwnerFaults.includes(injectedFault)))await verifyStage17FailureCorrection();
  for(let step=0;step<80;step++){
    let action=engine.operationalNextAction(p,stage);if(engine.gate(stage,p).complete&&(stage!==30||action.actionType==='COMPLETE'))break;
    if(diagnosticPrefixDir&&schema.deferredExecutionFamily(stage,action.operation))action=diagnosticOrdinaryAction(stage);
    if(process.env.CLRT_COUNTERPART_PROGRESS)console.error(JSON.stringify({counterpartStage:stage,action:action.actionType,operation:action.operation}));
    if(stage===28&&!latest('artifactIdentities')){const row={artifactId:artifactFixtureId(engine,p,'PRODUCT-FILE'),name:'result.txt',size:Buffer.byteLength(OUTPUT),sha256:hash.sha256Text(OUTPUT),byteVerificationReceipt:{source:'APPLICATION_BYTE_REHASH',receiptId:'SYNTHETIC-BYTE-COMPARISON',artifactId:artifactFixtureId(engine,p,'PRODUCT-FILE'),byteSize:Buffer.byteLength(OUTPUT),sha256:hash.sha256Text(OUTPUT)}};engine.verifyArtifactIdentity(p,[row],[row]);}
    else if(action.actionType==='CONFIRM_STAGE_ONE_INTENT'){const change=engine.acceptedChanges(p,1).at(-1);engine.recordStageConfirmation(p,1,true,'Synthetic confirmation','SYNTHETIC',{acceptedChangeId:change.changeId,inputVersion:p.job.CURRENT_INPUT_VERSION});}
    else if(action.actionType==='FREEZE_CANDIDATE'){await retainFixtureFile('CANDIDATE-FILE','production-instruction.txt',CANDIDATE);if(!engine.records(p,'artifacts',{active:false}).some(row=>engine.recordId(row,'artifacts')===artifactFixtureId(engine,p,'CANDIDATE-FILE')))engine.registerArtifactBytes(p,{stage,artifactId:artifactFixtureId(engine,p,'CANDIDATE-FILE'),filename:'production-instruction.txt',mediaType:'text/plain',byteSize:Buffer.byteLength(CANDIDATE),sha256:hash.sha256Text(CANDIDATE)});const decision=engine.recordRegisteredHumanDecision(p,{stage,purpose:'CANDIDATE_COMPONENT_SELECTION',targetFamily:'artifacts',targetId:hash.sha256Value([artifactFixtureId(engine,p,'CANDIDATE-FILE')]),value:[artifactFixtureId(engine,p,'CANDIDATE-FILE')],operatorLabel:'SYNTHETIC'});engine.freezeCandidate(p,{stage,artifactIds:[artifactFixtureId(engine,p,'CANDIDATE-FILE')],selectionDecisionId:id(decision,'humanDecisions')});}
    else if(action.actionType==='REGISTER_SOURCE_SEARCH_CAPABILITY'){
      const contract=latest('sourceSearchContracts');
      assert.ok(contract,'COUNTERPART_SOURCE_SEARCH_CAPABILITY_ORACLE: the preceding accepted response must provide the current search contract.');
      assert.equal(engine.sourceSearchCapabilityState(p,contract).complete,false,'COUNTERPART_SOURCE_SEARCH_CAPABILITY_ORACLE: the action must correspond to a missing current capability registration.');
      assert.equal(engine.gate(stage,p).complete,false,'COUNTERPART_SOURCE_SEARCH_CAPABILITY_ORACLE: accepting the search response alone must not complete Stage 2.');
      if(!counterpartFaults[injectedFault]?.skipSourceSearchRegistration)registerFixtureSourceSearchCapability({engine},p);
      const current=latest('sourceSearchContracts'),state=engine.sourceSearchCapabilityState(p,current);
      assert.equal(state.complete,true,'COUNTERPART_SOURCE_SEARCH_CAPABILITY_ORACLE: '+state.reasons.join(' '));
      assert.equal(engine.gate(stage,p).complete,false,'COUNTERPART_SOURCE_SEARCH_CAPABILITY_ORACLE: capability registration must not bypass independent adequacy review.');
      assert.equal(engine.operationalNextAction(p,stage).operation,'SEARCH_ADEQUACY_REVIEW','COUNTERPART_SOURCE_SEARCH_CAPABILITY_ORACLE: the accepted bounded search must proceed to its independently bound review.');
      cases.push({stage,caseId:'source-search-capability-before-independent-review',result:'PASS',evidenceBasis:'SYNTHETIC_OPERATOR_CONFIRMED_EXTERNAL_CLAIM'});
    }
    else if(action.actionType==='RESERVE_RUN_BATCH')engine.reserveRunBatch(p,{stage});
    else if(action.actionType==='BEGIN_UNCHANGED_CONFIRMATION')engine.beginUnchangedConfirmationIteration(p,{candidateId:id(latest('candidateFreezes'),'candidateFreezes')});
    else if(action.actionType==='CALCULATE_CONVERGENCE')engine.recordConvergence(p);
    else if(action.actionType==='CALCULATE_UNCHANGED_CONFIRMATION')engine.recordUnchangedConfirmation(p);
    else if(action.actionType==='FREEZE_BASELINE'){const iteration=latest('iterations'),candidateId=value(iteration,'CANDIDATE_ID'),decision=engine.recordRegisteredHumanDecision(p,{stage,purpose:'BASELINE_AUTHORIZATION',targetFamily:'candidateFreezes',targetId:candidateId,value:'AUTHORIZED',operatorLabel:'SYNTHETIC'});engine.freezeBaseline(p,{artifactIds:[],authorizationDecisionId:id(decision,'humanDecisions')});}
    else if(action.actionType==='REGISTER_PRODUCTION_CONTEXT')engine.registerFreshContext(p,{stage,identifier:'SYNTHETIC_PRODUCTION'});
    else if(action.actionType==='RESERVE_PRODUCT_EXECUTION')engine.reserveProductExecution(p);
    else if(action.actionType==='RUN_APP_TESTS'){for(const test of engine.finalProductTestSelection(p,22).tests){const testId=id(test,'tests'),result=await closedLoopTestRuntime.execute({spec:value(test,'EXECUTABLE_SPEC'),artifacts:{PRODUCT:{artifactId:artifactFixtureId(engine,p,'PRODUCT-FILE'),filename:'result.txt',bytes:Buffer.from(OUTPUT)}},metadata:{testId,bindings:value(test,'EXECUTABLE_INPUT_BINDINGS')}});engine.recordApplicationDeterministicResult(p,{testId,productId:id(latest('products'),'products'),runtimeResult:result,inputArtifacts:[{artifactId:artifactFixtureId(engine,p,'PRODUCT-FILE'),filename:'result.txt',byteSize:Buffer.byteLength(OUTPUT),sha256:hash.sha256Text(OUTPUT)}]});}}
    else if(action.actionType==='FREEZE_DELIVERY_CANDIDATE'){const artifactIds=[artifactFixtureId(engine,p,'PRODUCT-FILE')],decision=engine.recordRegisteredHumanDecision(p,{stage,purpose:'CANDIDATE_COMPONENT_SELECTION',targetFamily:'artifacts',targetId:hash.sha256Value(artifactIds),value:artifactIds,operatorLabel:'SYNTHETIC'});engine.freezeDeliveryCandidate(p,{artifactIds,selectionDecisionId:id(decision,'humanDecisions')});}
    else if(action.actionType==='CALCULATE_RELEASE')engine.recordReleaseDetermination(p);
    else if(action.actionType==='CAPTURE_DELIVERY_INTENT')engine.captureDeliveryIntent(p,{value:{authorized:true,deliveryCandidateSetId:id(latest('deliveryCandidateSets'),'deliveryCandidateSets'),releaseId:id(latest('releaseRecords'),'releaseRecords'),artifactIds:[artifactFixtureId(engine,p,'PRODUCT-FILE')],authorizedFilenames:{[artifactFixtureId(engine,p,'PRODUCT-FILE')]:'result.txt'},recipientOrClass:'Synthetic operator',destination:'Synthetic directory',transferPurpose:'Fixture preflight',transferChannel:'BROWSER_DOWNLOAD',disclosureClassification:'PUBLIC',disclosureAuthorization:true,permittedTransferCount:1},operatorLabel:'SYNTHETIC'});
    else if(action.actionType==='BUILD_EVIDENCE_CHAINS')engine.calculateEvidenceChains(p);
    else if(action.actionType==='EXPORT_PRE_DELIVERY_CHECKPOINT'){const c=engine.createPreDeliveryCheckpoint(p,{packageId:'SYNTHETIC-PACKAGE',packageSha256:'a'.repeat(64)});engine.recordCheckpointExportAction(p,{checkpointId:id(c,'backupCheckpoints'),packageSha256:'a'.repeat(64),filename:'synthetic.gz'});}
    else if(action.actionType==='CALCULATE_TERMINAL')engine.calculateTerminal(p);
    else if(action.actionType==='EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS')engine.recordDeliveryAttempt(p,{deliveryId:id(latest('deliveryRecords'),'deliveryRecords'),result:'SUCCEEDED'});
    else if(action.actionType==='RECORD_DELIVERY_EVIDENCE')engine.recordDeliveryEvidence(p,{attemptId:id(latest('deliveryAttempts'),'deliveryAttempts'),outcome:'RECEIVED',observation:'Synthetic receipt for fixture contract preflight only.',operatorLabel:'SYNTHETIC'});
    else if(['SELECT_RESPONSE_JSON_FILE','AI_REVIEW','EXTERNAL_AGENT_TOOL','CONTINUE_AGENT_CONVERSATION','EXTERNAL_SYSTEM'].includes(action.actionType)){
      let actorInputs,prompt;
      if(diagnosticPrefixDir){
        actorInputs=await diagnosticPackage(stage,action.operation||schema.STAGE_CONTRACTS[stage].operations[0]);prompt=actorInputs.prompt;
      }else{
        ({prompt}=prompts.reserveAndBuildPromptRecord(p,stage,{operation:action.operation||schema.STAGE_CONTRACTS[stage].operations[0]}));const materialized=prompts.materializePromptContextFiles(prompt,p);if(!counterpartFaults[injectedFault]?.skipPromptContextCapture)for(const file of materialized)retainedContextFiles.set(file.sha256,file);
        actorInputs={schema,engine,prompt,manifest:prompts.promptFileManifest(prompt),instructionBytes:Buffer.from(prompt.prompt),contextFiles:materialized.map(file=>({filename:file.filename,bytes:Buffer.from(file.text)}))};
      }
      const request=diagnosticActor({...actorInputs,omitTerminalLF:stage===11&&!cases.some(row=>row.stage===11)}),files=[];
      if(stage===21){const slot=prompts.promptFileManifest(prompt).attachmentSlots.find(item=>item.role==='FINISHED_PRODUCT'&&item.required);assert.ok(slot,'Stage 21 must issue its required finished-product slot.');request.attachments=[{attachmentSlotId:slot.attachmentSlotId,role:slot.role,temporaryKey:'product-file',filename:'result.txt',mediaType:'text/plain',byteSize:Buffer.byteLength(OUTPUT),sha256:hash.sha256Text(OUTPUT),required:true}];request.evidence[0].attachmentRef={tempKey:'product-file'};await retainFixtureFile('PRODUCT-FILE','result.txt',OUTPUT);files.push({artifactId:artifactFixtureId(engine,p,'PRODUCT-FILE'),name:'result.txt',type:'text/plain',size:Buffer.byteLength(OUTPUT),sha256:hash.sha256Text(OUTPUT),attachmentSlotId:ingestion.attachmentSlotPlan(p,request,prompt)[0].attachmentSlotId});}
      let prepared;
      if(diagnosticPrefixDir){
        // Exact diagnostic precursor bytes pass through the normal file-first
        // staging/capture/validation/acceptance path before snapshot reuse.
        const r=actorInputs.storageRuntime,store=r.store,i=r.ingestion,manifest=actorInputs.manifest,text=JSON.stringify(request),baseline=await store.readProject(p.job.JOB_ID);
        const staged=await store.stageResponseFile({jobId:p.job.JOB_ID,stage,blob:new Blob([text],{type:'application/json'}),rawFilename:'response.json',mediaType:'application/json',promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce}),received=await store.readStagedResponseFile({jobId:p.job.JOB_ID,stagingId:staged.stagingId});
        assert.equal(new TextDecoder('utf-8',{fatal:true}).decode(received.bytes),text);
        const captured=i.captureRaw(baseline,{stage,text,promptRecord:r.copy(prompt),files:r.copy(files),transport:r.copy({authority:'AUTHORITATIVE_RESPONSE_FILE',stagingId:staged.stagingId,rawFilename:'response.json',mediaType:'application/json',status:received.status,sha256:received.sha256,byteSize:received.byteSize,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce})});
        let saved=await store.writeProject(captured.project,{operational:true,expectedProjectRevision:baseline.revision,expectedStateSha256:baseline.projectSha256});prepared=i.prepareCaptured(saved,{rawResponseId:captured.rawRecord.rawResponseId});saved=await store.writeProject(prepared.project,{operational:true,expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});
        assert.equal(prepared.validation.valid,true,JSON.stringify(prepared.validation.issues));const acceptance=i.acceptanceImpact(saved,prepared.proposal.proposalId),committed=i.commit(saved,prepared.proposal.proposalId,{operator:'SYNTHETIC_PREFIX_OPERATOR',replacementConfirmation:acceptance}),impact=store.mutationImpact(saved,committed.project);
        saved=await store.writeProject(committed.project,{expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256,...(impact.requiresConfirmation?{mutationConfirmation:impact}:{})});p=structuredClone(await store.readProject(saved.job.JOB_ID));await restoreArtifactFixture(byteStore,await captureArtifactFixture(store,p.job.JOB_ID));
        cases.push({stage,operation:prompt.operation,result:'PASS',boundary:'ACTUAL_ZIP_AUTHORITATIVE_BLOB_RAW_PREPARE_EXPLICIT_SYNTHETIC_OPERATOR_TRANSACTION_ADAPTER_READBACK',rawResponseId:captured.rawRecord.rawResponseId,responseSha256:received.sha256});
      }else{
        prepared=ingestion.prepare(p,{stage,text:JSON.stringify(request),promptRecord:prompt,files,transport:{packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce}});
      // Returned products require actual byte custody before a proposal exists.
      // This owning rejection precedes the retained-artifact checks after commit.
      if(stage===21)assert.equal(prepared.validation.issues.some(issue=>issue.code==='RETURNED_ARTIFACT_BYTES_UNVERIFIED'),false,'COUNTERPART_RETURNED_ARTIFACT_CUSTODY_ORACLE: '+JSON.stringify(prepared.validation.issues));
      assert.equal(prepared.validation.valid,true,JSON.stringify(prepared.validation.issues));p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'SYNTHETIC'}).project;cases.push({stage,operation:prompt.operation,result:'PASS'});
      }
      if(prompt.operation==='VERIFY'){const scope=prompt.scope,iterationId=scope.iterationId||scope.confirmationIterationId,runs=engine.records(p,'runs').filter(row=>String(engine.recordValue(row,'ITERATION_ID')||row.scope?.iterationId||'')===iterationId),verified=new Set(engine.records(p,'verification').filter(row=>(row.scope?.iterationId||row.scope?.confirmationIterationId)===iterationId).map(row=>String(engine.recordValue(row,'RUN_ID')||''))),remaining=runs.filter(row=>!verified.has(id(row,'runs')));if(remaining.length)assert.equal((diagnosticPrefixDir?diagnosticOrdinaryAction(stage):engine.operationalNextAction(p,stage)).operation,'VERIFY','ITERATION_PARTIAL_VERIFY_ORACLE: every bound run must be verified before the workflow advances');}

    }else throw new Error('No progressing fixture command: '+JSON.stringify(action));
    engine.recalculate(p);
    for(const artifact of engine.records(p,'artifacts')){
      if(value(artifact,'AVAILABILITY')!=='BYTES_PERSISTED_AND_VERIFIED')continue;
      const identity={jobId:p.job.JOB_ID,artifactId:id(artifact,'artifacts'),filename:value(artifact,'FILENAME'),byteSize:value(artifact,'BYTE_SIZE'),sha256:value(artifact,'SHA256')};
      assert.equal(globalThis.closedLoopProjectStore?.artifactCustodyState?.(identity),'TRUE','COUNTERPART_RETAINED_ARTIFACT_CUSTODY_ORACLE: every retained artifact marked stored and verified must have matching actual bytes. '+JSON.stringify({stage,action:action.actionType,identity,source:artifact.source,storage:value(artifact,'STORAGE_REFERENCE')}));
      const stored=await byteStore.getArtifact(identity.artifactId,{jobId:identity.jobId});
      assert(stored&&stored.byteSize===identity.byteSize&&await hash.sha256Bytes(stored.blob)===identity.sha256,'COUNTERPART_RETAINED_ARTIFACT_CUSTODY_ORACLE: the stored byte length and digest must match the canonical artifact.');
    }
    assert.doesNotThrow(()=>hash.sha256Value(p),`Stage ${stage} ${action.actionType} must remain persistable after every operation`);
  }
  assert.equal(engine.gate(stage,p).complete,true,JSON.stringify({stage,reasons:engine.gate(stage,p).reasons}));
  if(stage===22&&!diagnosticPrefixDir){
    // First response after application-owned verification, using the same
    // durable staging and acceptance controls as the browser journey. The
    // small actual files come from preceding fixture operations, not metadata.
    const network=storageBroadcastNetwork(),r=projectStoreRuntime({environment:{BroadcastChannel:network.Channel}}),{runtime,store,copy}=r;
    await restoreArtifactFixture(store,await captureArtifactFixture(byteStore,p.job.JOB_ID));
    const input=copy(p);await hydrateRetainedPromptContexts(r,input,[...retainedContextFiles.values()]);
    await store.writeProject(input,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
    const saved=await store.readProject(p.job.JOB_ID);saved.activeStage=stage+1;saved.activeView='Workflow';
    const failures=bindAcceptanceUi(r,saved,'NONE'),ui=fs.readFileSync('app-core.js','utf8');
    const extract=(start,end)=>{const a=ui.indexOf(start),b=ui.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,'Actual response control owner must exist.');return ui.slice(a,b);};
    Object.assign(runtime,{recordValue:r.engine.recordValue,schema:runtime.closedLoopWorkflowSchema,recordMobileValidation:async()=>{},saveRequiredContinuation:async()=>null,selectStageContinuation:()=>{}});
    vm.runInContext(extract('function canonicalCurrentStage(','function displayedStageAction(')+extract('function stageOperations(','// A saved response may be inspected independently.')+extract('async function savePromptRecord(','function promptTransportFilename(')+extract('async function prepareStageResponseFile(','async function prepareStageResponseFallback('),runtime);
    await runtime.savePromptRecord(saved.activeStage);
    const prompt=runtime.currentPromptRecord(saved.activeStage),request=responseFixture({schema:runtime.schema,engine:r.engine,prompt,manifest:r.prompts.promptFileManifest(prompt),instructionBytes:Buffer.from(prompt.prompt)});
    runtime.responseAttemptPrompt=()=>prompt;runtime.responsePromptRecord=()=>prompt;runtime.proposalVersionCurrent=()=>false;
    const acceptedBefore=runtime.current.projectData.acceptedChanges.length,file=new Blob([JSON.stringify(request)],{type:'application/json'});Object.defineProperty(file,'name',{value:'response.json'});
    await runtime.prepareStageResponseFile(file);network.flush();
    console.error(JSON.stringify({caseId:'first-response-after-native-verification',failureCodes:failures.map(e=>e.code||e.message),affected:runtime.replacementReview?.impact?.affected||[],priorStageStatus:runtime.current.stages[stage].status}));
    assert.equal(Boolean(runtime.replacementReview),false,'INITIAL_RESPONSE_PRESERVES_PROGRESS_ORACLE: first response staging must not request replacement or invalidate completed prerequisites.');
    assert.equal(failures.length,0,'INITIAL_RESPONSE_PRESERVES_PROGRESS_ORACLE: '+failures.map(e=>e.message).join('|'));
    assert.equal(runtime.current.projectData.acceptedChanges.length,acceptedBefore,'INITIAL_RESPONSE_PRESERVES_PROGRESS_ORACLE: validation alone cannot accept work.');
    assert.equal(runtime.current.stages[stage].status,'COMPLETE','INITIAL_RESPONSE_PRESERVES_PROGRESS_ORACLE: completed verification must remain complete.');
    const proposal=runtime.current.projectData.responseProposals.find(row=>row.stage===saved.activeStage&&row.status==='PENDING_OPERATOR_REVIEW');
    assert.ok(proposal,'INITIAL_RESPONSE_PRESERVES_PROGRESS_ORACLE: valid response must reach proposal review.');
    const acceptFailures=bindAcceptanceUi(r,runtime.current,proposal.proposalId);await runtime.accept();network.flush();
    assert.equal(acceptFailures.length,0,'INITIAL_RESPONSE_ACCEPTANCE_ORACLE: '+acceptFailures.map(e=>e.message).join('|'));
    assert.equal(Boolean(runtime.replacementReview),false,'INITIAL_RESPONSE_ACCEPTANCE_ORACLE: initial acceptance must preserve its prerequisites.');
    const reloaded=await store.readProject(p.job.JOB_ID);
    assert.equal(reloaded.projectData.acceptedChanges.length,acceptedBefore+1,'INITIAL_RESPONSE_ACCEPTANCE_ORACLE: one explicit acceptance must commit once.');
    assert.equal(r.engine.gate(stage,reloaded).complete,true,'INITIAL_RESPONSE_ACCEPTANCE_ORACLE: durable acceptance must preserve verified prerequisites.');
    p=structuredClone(reloaded);cases.push({stage:saved.activeStage,operation:prompt.operation,caseId:'first-response-after-native-verification',result:'PASS'});
  }
  if(stage===13){
    const invalid=engine.clone(p);invalid.projectData.defects=[];
    const rejected=engine.gate(13,invalid);
    assert.equal(rejected.complete,false,'An observed initial violation without an evidence-linked defect must be rejected');
    const comparison=engine.evaluateCrossRunComparison(invalid),missing=Object.values(comparison.comparisonAnalysis).filter(row=>row.defectRequired&&!row.defectIds.length);
    assert(missing.length>0,'COUNTERPART_MISSING_DEFECT_FIXTURE_ORACLE: the otherwise valid comparison must require its removed defect');
    assert(missing.every(row=>rejected.reasons.some(reason=>reason.includes(row.comparisonId)&&reason.includes('DEFECT_IDS')&&/without|missing/i.test(reason))),
      'COUNTERPART_DEFECT_REASON_ORACLE: rejection must identify the missing defect handoff for the affected comparison; '+JSON.stringify(rejected.reasons));
    assert.equal(engine.gate(13,p).complete,true,'The otherwise valid comparison must progress when its defect is restored');
    assert.equal(engine.gate(11,p).complete,true,'Recording a failure must preserve the completed initial run batch');
    cases.push({stage:13,caseId:'initial-violation-defect-rejection-and-correction',rejectionReasons:rejected.reasons,result:'PASS'});
  }
}
if(diagnosticPrefixDir&&[6,7,14].includes(stageLimit))await emitDiagnosticPrefix(stageLimit+1);
if(diagnosticPrefixDir&&stageLimit===16)await verifyStage17FailureCorrection();
console.log(JSON.stringify(diagnosticPrefixDir?{counterpartDiagnosticPrefixes:'EMITTED',...diagnosticClockMetadata,completedPriorStages:stageLimit,prefixFiles:diagnosticPrefixFiles,sourceCommit:process.env.GITHUB_SHA||null,sourceFingerprints,synthetic:true,actualBrowserJourney:false}:{counterpartContracts:'PASS',stages:stageLimit,cases,sourceCommit:process.env.GITHUB_SHA||null,injectedFault,actualBrowserJourney:false,externalOutputs:'SYNTHETIC',persistenceCheckedAfterEveryOperation:true}));
