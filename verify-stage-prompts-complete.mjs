import {createVerifierRuntime} from './verifier-runtime.mjs';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import vm from 'node:vm';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])createVerifierRuntime.loadScript(globalThis,fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine;
if(!core||!schema||!engine||!prompts)throw new Error('Prompt audit runtime failed to load.');
const p=core.createBlankState('JOB-PROMPT-CLOSURE');
Object.assign(p.job,{JOB_ID:'JOB-PROMPT-CLOSURE',JOB_TITLE:'Prompt closure fixture',EXACT_USER_OBJECTIVE_VERBATIM:'Prove every stage prompt has the data and instructions needed for exactly its job.',EXPLICIT_USER_REQUIREMENTS:'Never ask the human to repeat project information already supplied.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-v001',CURRENT_REQUIREMENTS_VERSION:'REQ-v001',CURRENT_TEST_SUITE_VERSION:'TEST-v001',CURRENT_INSTRUCTION_VERSION:'INST-v001',CURRENT_ITERATION:'ITER-001',CURRENT_BASELINE_ID:'BASE-001',CURRENT_PRODUCT_ID:'PROD-001'});
engine.ensureShape(p);engine.recalculate(p);
const intake=engine.intakeCoverageManifest(p);
const capture={schema:'closed-loop-stage01-capture/2',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,pass1Completed:true,pass2OmissionChallenge:{completed:true,checkedCategories:['QUALIFIERS','EXCEPTIONS','DEPENDENCIES','NEGATIVE_REQUIREMENTS','DO_NOT_CHANGE','VISUAL_CONSTRAINTS','TEMPORAL_CONSTRAINTS','ACCEPTANCE_CONDITIONS','AUTHORITY_STATEMENTS','TOOL_RESTRICTIONS','FILE_REFERENCES','OUTPUT_FORMAT_REQUIREMENTS','CORRECTIONS','LATER_OVERRIDES'],omissionsFound:[],omissionsResolved:true},units:intake.units.map((unit,index)=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:'RETAINED_AS_CONTEXT',reason:'Prompt closure fixture preserves current human authority.',extractedStatements:[{statementKey:`statement-${index+1}`,text:unit.rawValueText||unit.label||unit.unitId,statementClass:'CONTEXT'}]}))};
p.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'Prompt closure fixture deliverable.',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture)};
p.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE'};
p.stages[3].agentData={ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:'TRUE',SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:'TRUE',LATEST_PASS_NUMBER:2,NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:'FALSE'};
for(let stage=1;stage<30;stage++){p.stages[stage].status='COMPLETE';p.stages[stage].gate={complete:true,blocked:false,reasons:[]};}
if(!engine.evaluateIntakeAccounting(p).complete)throw new Error('Prompt closure fixture failed to establish current Stage 01 accounting.');

// The native catalog is actor input, not a private application API an agent
// should rediscover. Verify its actual serialized handoff and selected stage.
function stage06CanonicalBindingPublicationOracle(runtime,project,expectedCatalog){
 const e=runtime.closedLoopWorkflowEngine,s=runtime.closedLoopWorkflowSchema,pr=runtime.closedLoopPromptEngine,h=runtime.closedLoopHash,observations=[];
 for(const operation of s.STAGE_CONTRACTS[6].operations){
  const registration=s.STAGE_OPERATION_REGISTRY[`6:${operation}`];
  if(registration.executorClass!=='EXTERNAL_AGENT'||registration.deferredSubjectFamily)continue;
  const state=e.clone(project),scope=Object.fromEntries(s.operationContract(6,operation).scopeRequirements.map(key=>[key,key.toUpperCase()+'-AUDIT'])),record=pr.buildPromptRecord(6,state,{operation,scope}),files=pr.materializePromptContextFiles(record,state),manifest=pr.promptFileManifest(record),envelopes=[];
  for(const match of record.prompt.matchAll(/BEGIN_UNTRUSTED_DATA_BLOCK\n([^\n]+)\nEND_UNTRUSTED_DATA_BLOCK/g))envelopes.push(JSON.parse(match[1]));
  for(const file of files){const content=JSON.parse(file.text);envelopes.push(...content.members);assert.equal(h.sha256Text(file.text),file.sha256,'STAGE06_CANONICAL_CATALOG_ORACLE: context bytes differ from manifest.');}
  const selected=envelopes.filter(item=>item.sourceIdentity==='stage06.availableCanonicalBindings');
  assert.equal(selected.length,1,'STAGE06_CANONICAL_CATALOG_ORACLE: publish exactly one complete current catalog.');
  const catalog=JSON.parse(selected[0].value),actualKeys=Object.keys(catalog).sort(),expectedKeys=Object.keys(expectedCatalog).sort();
  assert.deepEqual(actualKeys,expectedKeys,'STAGE06_CANONICAL_CATALOG_ORACLE: permitted selected-stage catalog entries differ.');
  for(const key of expectedKeys)for(const field of ['canonicalKey','value','valueSha256'])assert.equal(catalog[key][field],expectedCatalog[key][field],`STAGE06_CANONICAL_CATALOG_ORACLE: ${key}.${field} differs from the exact provided value.`);
  assert.equal(manifest.promptIdentity.bodySha256,record.bodySha256,'STAGE06_CANONICAL_CATALOG_ORACLE: manifest does not bind instruction.');
  observations.push({operation,keys:actualKeys,instructionSha256:record.bodySha256,contextSignature:record.contextSignature,contextFiles:files.length});
 }
 assert(observations.length>0,'STAGE06_CANONICAL_CATALOG_ORACLE: no external Stage06 operation was exercised.');
 return observations;
}
const stage06ExpectedCatalog=Object.fromEntries(['JOB_ID','CURRENT_INPUT_VERSION','CURRENT_SOURCE_SET_VERSION','CURRENT_REQUIREMENTS_VERSION','CURRENT_TEST_SUITE_VERSION'].map(field=>{
 const key='JOB.'+field,value=p.job[field];return [key,{canonicalKey:key,value,valueSha256:createHash('sha256').update(JSON.stringify(value)).digest('hex')}];
}));
const stage06CanonicalBindings=stage06CanonicalBindingPublicationOracle(globalThis,p,stage06ExpectedCatalog);
const stage06CatalogFault=projectStoreRuntime({fault:{id:'stage06-canonical-catalog-omission',file:'prompt-engine.js',before:'workflow.canonicalTestBindingCatalog(state)',after:'{}'}});
assert.throws(()=>stage06CanonicalBindingPublicationOracle(stage06CatalogFault.runtime,stage06CatalogFault.copy(p),stage06ExpectedCatalog),/STAGE06_CANONICAL_CATALOG_ORACLE: permitted selected-stage catalog entries differ/,'The catalog oracle must catch omitted bindings, not fixture initialization.');
// Catalog values are bound through the existing context transport fingerprint.
{
 const changed=engine.clone(p);changed.job.CURRENT_TEST_SUITE_VERSION='TEST-v002';
 const expected={...stage06ExpectedCatalog,'JOB.CURRENT_TEST_SUITE_VERSION':{canonicalKey:'JOB.CURRENT_TEST_SUITE_VERSION',value:'TEST-v002',valueSha256:createHash('sha256').update(JSON.stringify('TEST-v002')).digest('hex')}};
 const changedCatalog=stage06CanonicalBindingPublicationOracle(globalThis,changed,expected);
 for(const record of changedCatalog){const prior=stage06CanonicalBindings.find(row=>row.operation===record.operation);assert.notEqual(record.contextSignature,prior.contextSignature,'STAGE06_CANONICAL_CATALOG_ORACLE: changed binding retains old context identity.');assert.notEqual(record.instructionSha256,prior.instructionSha256,'STAGE06_CANONICAL_CATALOG_ORACLE: changed binding retains old instruction bytes.');}
}
// Reproduce a retained instruction from the known deficient /80 generation in
// the shared runtime. Version freshness must replace it through the real owner.
{
 const currentSource=fs.readFileSync('prompt-engine.js','utf8'),oldSource=currentSource.replace(/const PROMPT_ENGINE_VERSION='[^']+';/,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/80';").replace('workflow.canonicalTestBindingCatalog(state)','{}');
 const old=projectStoreRuntime({sourceOverrides:{'prompt-engine.js':oldSource}}),state=old.copy(p);state.activeStage=6;state.stages[6].status='NOT STARTED';state.stages[6].gate={complete:false,blocked:false,reasons:[]};
 const prior=old.prompts.reserveAndBuildPromptRecord(state,6,{operation:'COMPLETE'},{owningTabInstance:'STAGE06-CATALOG-REGRESSION'}).prompt;
 assert.equal(prior.promptEngineVersion,'closed-loop-prompt-engine/80','STAGE06_CATALOG_FRESHNESS_ORACLE: wrong historical setup.');
 // Raw capture is the real initial ingestion step. A saved continuation may
 // only be prepared once work is received or a retry is needed. Keep its exact
 // supplied bytes unvalidated; the freshness oracle does not claim acceptance.
 const captured=old.ingestion.captureRaw(state,{stage:6,text:'{',promptRecord:prior});
 assert.equal(captured.rawRecord.completeRawResponse,'{','STAGE06_CATALOG_FRESHNESS_ORACLE: capture did not preserve supplied bytes.');
 assert.equal(captured.project.projectData.acceptedChanges.length,state.projectData.acceptedChanges.length,'STAGE06_CATALOG_FRESHNESS_ORACLE: raw capture accepted work.');
 const current=projectStoreRuntime(),project=current.copy(captured.project),replacement=current.ingestion.prepareStageContinuation(project,{stage:6,owningTabInstance:'STAGE06-CATALOG-REGRESSION'});
 assert.equal(replacement?.created,true,'STAGE06_CATALOG_FRESHNESS_ORACLE: deficient same-scope saved instruction was reused.');
 assert.equal(replacement.prompt.promptEngineVersion,current.prompts.version,'STAGE06_CATALOG_FRESHNESS_ORACLE: replacement uses obsolete generation.');
 assert(project.projectData.generatedPrompts.find(row=>row.instructionId===prior.instructionId)?.invalidatedBy,'STAGE06_CATALOG_FRESHNESS_ORACLE: old deficient instruction remains active.');
 stage06CanonicalBindingPublicationOracle(current.runtime,project,stage06ExpectedCatalog);
}
if(process.argv.includes('--stage06-bindings-only')){console.log(JSON.stringify({stage06CanonicalBindings:'PASS',observations:stage06CanonicalBindings,catalogFaultDetected:true,changedCatalogIdentity:true,savedDeficientInstructionReplaced:true,basis:'MAINTAINED_SYNTHETIC_STAGE_CONTRACT_FIXTURE_REAL_PROMPT_AND_CONTINUATION_OWNERS'},null,2));process.exit(0);}

const requiredReads={
  4:['sourceConflicts'],5:['sources','candidateRequirements'],6:['sources','research'],8:['sources','sourceConflicts'],9:['failureTests','requirementResolutions','sources','sourceConflicts'],10:['artifacts'],13:['tests'],14:['requirements','tests','instructions','runs','research','sources','artifacts','evidenceRecords'],15:['requirements','tests','runs','verification','artifacts','evidenceRecords'],16:['requirements','tests','instructions','runs','artifacts','evidenceRecords'],18:['requirements','tests','rootCauses','changes'],20:['artifacts'],21:['instructions','artifacts'],23:['research','evidenceRecords'],24:['sources','research','evidenceRecords','artifacts'],26:['requirements','tests','instructions','runs','verification','regressionExecutions','confirmationRecords','evidenceRecords'],27:['products','baselines','confirmationRecords','regressions','evidenceRecords'],29:['adversarialResults','representationInspections','regressions','regressionExecutions','processAudits','productAudits','evidenceChains'],30:['requirements','evidenceRecords']
};
const semantic={
  1:['BLOCKING_NOW','ASK_NOW_NONBLOCKING','LATER_RESOLVABLE','every application-enumerated input unit must be classified exactly once'],
  2:['until no new applicable controlling or correctness-relevant external source category is found','Do not stop at the first plausible source'],
  3:['every current accepted Stage 02 source has current research coverage','distinct conflict/exception/saturation pass'],
  4:['APPLICATION-OWNED STAGE 04 OBLIGATION MANIFEST','Every obligationId'],
  5:['Resolve the current job’s requirement set exhaustively','repeat the review against the resulting requirement set'],
  6:['closed-loop-test-spec/1','TEST_IR','how a defective product could falsely appear compliant'],
  7:['Fixture definition is not execution','actual observed result','evidence sufficient to prove the rejection behavior'],
  8:['production instruction only from the resolved current requirement set and verification architecture','requirement traceability'],
  9:['re-review the entire current instruction from the beginning','Do not execute target production during preflight'],
  10:['human selects authorized canonical components','Do not assign candidate identity'],
  11:['this prompt authorizes exactly one reserved RUN_ID and CONTEXT_ID','do not perform another run'],
  12:['REQ_ID × RUN_ID × TEST_ID','Never substitute a different executor'],
  13:['Compare all ten executions','Never discard a run'],
  14:['tracing backward through product/output, execution, instruction, requirement, research, source, user input','tool/configuration, artifact, and audit/evidence','earliest defective layer'],
  15:['actual pre-correction regression execution','Do not claim post-correction success at Stage 15'],
  16:['responsible earliest defective layer','Never overwrite a controlled version in place'],
  18:['application calculates mandatory requirement coverage','Do not set or override those application-derived values'],
  20:['human authorizes the baseline','Do not assign baseline identity'],
  21:['Produce the job’s approved deliverable','Generate the complete approved deliverable'],
  22:['Never claim an unexecuted deterministic check ran'],
  23:['independent meaning/content verification','source evidence where applicable'],
  24:['Perform adversarial verification','Do not claim attacks that were not actually executed'],
  25:['Inspect the exact final delivered representation and package'],
  26:['process evidence and product evidence as two separate propositions'],
  27:['Do not set a release state','application evaluates the complete current evidence'],
  28:['application performs the authoritative immediate pre-release byte comparison'],
  29:['complete evidence graph for every mandatory requirement','Do not fabricate a link'],
  30:['append-only defect and regression history','Do not rewrite history']
};
let promptsChecked=0,conditionalRejections=0;
for(let stage=1;stage<=30;stage++){
  const contract=schema.STAGE_CONTRACTS[stage];
  for(const operation of contract.operations){
    const op=schema.operationContract(stage,operation);
    for(const needed of requiredReads[stage]||[])if(!op.readCollections.includes(needed))throw new Error(`Stage ${stage} ${operation} missing required read collection ${needed}.`);
    const scope=Object.fromEntries(op.scopeRequirements.map(key=>[key,key.toUpperCase()+'-AUDIT']));
    const reg=schema.STAGE_OPERATION_REGISTRY[`${stage}:${operation}`];
    if(reg?.executorClass!=='EXTERNAL_AGENT'){
      let blocked=false;try{prompts.buildPromptRecord(stage,p,{operation,scope});}catch(error){blocked=error?.code==='NON_EXTERNAL_OPERATION';}
      if(!blocked)throw new Error(`Stage ${stage} ${operation} is ${reg?.executorClass||'non-external'} but generated an external-agent prompt.`);
      continue;
    }
    if(reg.deferredSubjectFamily){let rejected=false;try{prompts.buildPromptRecord(stage,p,{operation,scope});}catch(error){rejected=error?.code==='DEFERRED_EXECUTION_UNAVAILABLE';}if(!rejected)throw new Error('Unbound conditional operation generated a handoff: '+stage+'/'+operation);conditionalRejections++;continue;}
    const prompt=prompts.buildPromptRecord(stage,p,{operation,scope}).prompt;
    promptsChecked++;
    for(const common of ['PROJECT DATA EXECUTION RULE — MANDATORY','Project-relevant information supplied by the human is supplied once','Never ask the human to repeat, retype, summarize, resend, reopen, or reattach project information already present','STRICT RESPONSE CONTRACT'])if(!prompt.includes(common))throw new Error(`Stage ${stage} ${operation} missing common prompt invariant: ${common}`);
    if(stage>1&&!prompt.includes('The original Stage 01 intent file is prohibited input for this stage.'))throw new Error(`Stage ${stage} ${operation} can regress to re-requesting original intent.`);
    if(prompt.includes('CUSTOM_PIPELINE'))throw new Error(`Stage ${stage} ${operation} still exposes prohibited CUSTOM_PIPELINE.`);
    for(const phrase of semantic[stage]||[])if(!prompt.toLowerCase().includes(String(phrase).toLowerCase()))throw new Error(`Stage ${stage} ${operation} missing stage-semantic instruction: ${phrase}`);
    if((stage===17||stage===19)&&!prompt.includes(`CURRENT DECLARED OPERATION: ${operation}`))throw new Error(`Stage ${stage} ${operation} lacks exact operation-specific instruction.`);
  }
}
const opNeed={
  '17:FREEZE':['instructions','requirements','artifacts'],'17:COMPARE':['tests'],'17:ROOT_CAUSE':['instructions','requirements','tests','runs'],'17:REGRESSION':['tests','runs','verification','artifacts'],'17:CORRECT':['instructions','requirements','tests','runs','artifacts'],
  '19:CONFIRM_FREEZE':['requirements','tests','artifacts'],'19:COMPARE':['tests'],'19:REGRESSION_VERIFY':['tests','requirements','artifacts'],'19:CONFIRM':['requirements','tests','regressions','defects','blockers']
};
for(const [key,needed] of Object.entries(opNeed)){const [stage,operation]=key.split(':');const c=schema.operationContract(Number(stage),operation);for(const x of needed)if(!c.readCollections.includes(x))throw new Error(`${key} missing ${x}.`);}
for(const [stage,forbidden] of [[11,['verification','comparisons','rootCauses','changes']],[12,['comparisons','rootCauses','changes']],[23,['deterministicResults','adversarialResults']],[24,['deterministicResults','meaningResults']]]){
  const c=schema.operationContract(stage,schema.STAGE_CONTRACTS[stage].operations[0]);for(const x of forbidden)if(c.readCollections.includes(x))throw new Error(`Stage ${stage} leaks forbidden ${x} through its declared read contract.`);
}
// Actual emitted instructions/context files, not collection names, prove28.3/28.4.
function independentReviewContextOracle(runtime){
 const c=runtime.closedLoopCore,e=runtime.closedLoopWorkflowEngine,s=runtime.closedLoopWorkflowSchema,pr=runtime.closedLoopPromptEngine,observations=[];
 for(const stage of [23,24]){
  const state=c.createBlankState('FINAL-REVIEW-ISOLATION-'+stage);e.ensureShape(state);for(let n=1;n<stage;n++){state.stages[n].status='COMPLETE';state.stages[n].gate={complete:true,reasons:[],blocked:false};}Object.assign(state.job,{CURRENT_BASELINE_ID:'BASELINE-ISOLATION',CURRENT_PRODUCT_ID:'PRODUCT-ISOLATION',CURRENT_PRODUCT_VERSION:'PRODUCT-v001',CURRENT_REQUIREMENTS_VERSION:'REQS-ISOLATION',CURRENT_TEST_SUITE_VERSION:'TESTS-ISOLATION'});
  const scope={baselineId:'BASELINE-ISOLATION',productId:'PRODUCT-ISOLATION',productVersion:'PRODUCT-v001',requirementsVersion:'REQS-ISOLATION',testSuiteVersion:'TESTS-ISOLATION'},row=(family,id,stage,fields)=>({id,stage,active:true,scope:{...scope},fields:{[s.RECORD_SCHEMAS[family].idField]:id,...fields},...fields});
  state.projectData.baselines.push(row('baselines','BASELINE-ISOLATION',20,{STATUS:'FROZEN'}));state.projectData.products.push({...row('products','PRODUCT-ISOLATION',21,{PRODUCT_VERSION:'PRODUCT-v001',BASELINE_ID:'BASELINE-ISOLATION',STATUS:'COMPLETED',GENERATED_ARTIFACT_INVENTORY:[]}),completionState:'COMPLETED'});
  state.projectData.sources.push(row('sources','SOURCE-ISOLATION',2,{TITLE:'Governing source'}));state.projectData.requirements.push(row('requirements','REQ-ISOLATION',4,{SOURCE_ID:'SOURCE-ISOLATION',OBLIGATION:'AUTHORIZED_REQUIREMENT_CONTENT',STATUS:'ACTIVE'}));
  state.projectData.evidenceRecords.push(row('evidenceRecords','SOURCE-EVIDENCE-ISOLATION',3,{SOURCE_ID:'SOURCE-ISOLATION',KIND:'SOURCE_EXCERPT',CONTENT:'AUTHORIZED_SOURCE_CONTENT'+'.'.repeat(70000),STATUS:'CURRENT'}));
  state.projectData.evidenceRecords.push(row('evidenceRecords','GENERATOR-EVIDENCE-ISOLATION',21,{KIND:'AGENT_CLAIM',CONTENT:'FORBIDDEN_GENERATOR_CONTENT',STATUS:'CURRENT'}));
  state.projectData.evidenceRecords.push({...row('evidenceRecords','NATIVE-EVIDENCE-ISOLATION',22,{APPLICATION_EVIDENCE_KIND:'APPLICATION_DETERMINISTIC_EXECUTION',APPLICATION_EVIDENCE_CONTENT:'FORBIDDEN_VERIFIER_EVIDENCE',STATUS:'CURRENT'}),source:'APPLICATION_TEST_RUNTIME'});
  state.projectData.observationRecords.push({...row('observationRecords','NATIVE-OBSERVATION-ISOLATION',22,{APPLICATION_OBSERVED_VALUE:'FORBIDDEN_VERIFIER_OBSERVATION',OBSERVATION_ORIGIN:'NATIVE_APPLICATION_OBSERVATION',EPISTEMIC_BASIS:'APPLICATION_OBSERVED',FRESHNESS_STATUS:'CURRENT'}),source:'APPLICATION_TEST_RUNTIME'});
  state.projectData.generatedPrompts.push({instructionId:'FAILED-RUN-INSTRUCTION',stage:11,operation:'EXECUTE_RUN',scope:{runId:'FAILED-RUN'},operationReservationId:'FAILED-RUN-RESERVATION'});state.projectData.rawResponses.push({rawResponseId:'FAILED-RUN-RAW',stage:11,promptInstructionId:'FAILED-RUN-INSTRUCTION',promptScope:{runId:'FAILED-RUN'},runId:'FAILED-RUN',status:'VALIDATION_FAILED',transport:{operationReservationId:'FAILED-RUN-RESERVATION'},completeRawResponse:'Superseded failed run bytes'});state.projectData.runs.push(row('runs','FAILED-RUN',11,{EXECUTION_STATUS:'EXECUTION_FAILED'}));state.projectData.evidenceRecords.push({...row('evidenceRecords','FAILED-RUN-SOURCE-EVIDENCE',11,{SOURCE_ID:'SOURCE-ISOLATION',KIND:'SOURCE_EXCERPT',CONTENT:'FORBIDDEN_FAILED_RUN_CONTENT',STATUS:'CURRENT'}),rawResponseId:'FAILED-RUN-RAW'});
  state.projectData.propositions.push(row('propositions','PROPOSITION-ISOLATION',4,{REQUIREMENT_ID:'REQ-ISOLATION',PROPOSITION_TEXT:'AUTHORIZED_PROPOSITION_INPUT',STATUS:'FORBIDDEN_DERIVED_PASS_SUMMARY'}));
  const prepared=e.preparePromptContext(state,stage,{operation:'COMPLETE',scope}),record=pr.buildPromptRecord(stage,state,prepared.options),files=pr.materializePromptContextFiles(record,state),output=[record.prompt,...files.map(file=>file.text)].join('\n');
  for(const marker of ['FORBIDDEN_GENERATOR_CONTENT','FORBIDDEN_VERIFIER_EVIDENCE','FORBIDDEN_VERIFIER_OBSERVATION','FORBIDDEN_DERIVED_PASS_SUMMARY','FORBIDDEN_FAILED_RUN_CONTENT'])assert.equal(output.includes(marker),false,'FINAL_REVIEW_CONTEXT_ORACLE: Stage'+stage+' embeds '+marker);
  for(const marker of ['AUTHORIZED_REQUIREMENT_CONTENT','AUTHORIZED_SOURCE_CONTENT','AUTHORIZED_PROPOSITION_INPUT'])assert.equal(output.includes(marker),true,'FINAL_REVIEW_CONTEXT_ORACLE: Stage'+stage+' lost '+marker);
  assert(files.length>0,'FINAL_REVIEW_CONTEXT_ORACLE: Large authorized source must exercise actual externalized context.');observations.push({stage,forbiddenContentAbsent:true,authorizedSourcePresent:true,externalizedContextFiles:files.length});
 }
 return observations;
}
const independentReviewContext=independentReviewContextOracle(globalThis);
const contextFault=projectStoreRuntime({fault:{id:'secondary-provenance-filter-bypass',file:'prompt-engine.js',before:"const number=Number(stage);if(family==='rawResponses'",after:"return {allowed:true,record,reason:'Controlled old unprojected context equivalent.'};const number=Number(stage);if(family==='rawResponses'"}});
vm.runInContext('globalThis.assert=assert;',Object.assign(contextFault.runtime,{assert}));
assert.throws(()=>vm.runInContext(`(${independentReviewContextOracle.toString()})(globalThis)`,contextFault.runtime),/FINAL_REVIEW_CONTEXT_ORACLE: Stage23 embeds FORBIDDEN_GENERATOR_CONTENT/,'The context guard must reject the original secondary-family leak rather than fail setup.');

console.log(JSON.stringify({promptsChecked,conditionalRejections,stagesChecked:30,compositeOperationChecks:Object.keys(opNeed).length,customPipelineOccurrences:0,oneTimeHumanInputInvariant:true,stage06CanonicalBindings,catalogFaultDetected:true,changedCatalogIdentity:true,savedDeficientInstructionReplaced:true,independentReviewContext,verificationObservations:independentReviewContext.map(item=>({checkId:'blind-stage'+item.stage+'-secondary-context-projection',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:'+(item.stage===23?'2499-2509':'2511-2521')],boundary:'actual emitted actor instruction and all materialized context files',expected:{stage:item.stage,forbiddenContentAbsent:true,authorizedSourcePresent:true,externalizedContextFiles:1},observed:item,passed:true})),browserStageWalkthrough:false},null,2));
