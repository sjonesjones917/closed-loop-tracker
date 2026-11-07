// Stage 07 generated-instruction regression. The agent-facing completion
// instruction must preserve the governing contract: every applicable requirement
// has failure analysis; every EXECUTABLE_NOW fixture was executed in isolated
// disposable state; every target-dependent fixture has a valid future trigger and
// required-by stage; expected and actual rejection agree; accepted invalid fixtures
// have validator defects. A deferred fixture becomes due no earlier than the first
// stage where its target exists and is never represented as executed before actual
// execution. Executability is application-derived from the declared timing contract
// (undeclared timing is immediate), never from an agent label. The runtime gate
// (failureTestTimingState; the accepted-invalid block until the corrected validator
// actually rejects the preserved fixture) is already correct; this test binds the
// generated text to the same contract and proves its own detection power with
// canary mutations. Independent literal consumer fixture only; it never reads the
// specification file.
import {stage04AcceptanceFixture} from './test-fixtures.mjs';
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const HEADER='STAGE COMPLETION BOUNDARY — DO NOT STOP EARLY\n';
const sentences=text=>String(text).split(/(?<=[.;])\s+/).map(s=>s.trim()).filter(Boolean);
const EXECUTE=/\b(?:run|runs|running|execute|executes|executed|executing)\b/i,UNIVERSAL=/\b(?:every|all|each)\b/i,FIXTURE=/\bfixtures?\b/i;
// A declaration alone never defers: forbid text that makes declared timing a reason to skip or postpone execution.
const declarationDefersExecution=sentence=>/declared timing contract[^.;]{0,120}(?:never|not|is not|isn't) (?:executed|run|execute)/i.test(sentence)||/(?:never|not) (?:executed|run)[^.;]{0,80}even (?:when|if|though)[^.;]{0,60}target[^.;]{0,40}(?:exists|already|available|TRUE)/i.test(sentence)||/executable now unless it declares/i.test(sentence)||/(?:declares|declaring|declared)[^.;]{0,60}timing[^.;]{0,80}(?:defers?|postpones?|excuses?|waives?)[^.;]{0,40}execution/i.test(sentence)||/(?:defer|postpone|skip)[^.;]{0,60}(?:because|since|when)[^.;]{0,40}(?:declares|declared|declaration)/i.test(sentence);
const demandText=sentence=>String(sentence).replace(/(?:never |not )?(?:be )?(?:represented|claimed|reported) as executed/gi,'');
const universalExecutionDemand=sentence=>{const demand=demandText(sentence);return EXECUTE.test(demand)&&UNIVERSAL.test(demand)&&FIXTURE.test(demand)&&!/EXECUTABLE_NOW/.test(demand);};
// Sentence-level rules. Every rule must hold for the real completion block and the
// canaries below must each violate at least one rule.
function completionContractIssues(block){
  const issues=[],parts=sentences(block);
  for(const sentence of parts){
    if(universalExecutionDemand(sentence))issues.push('universal execution demand without EXECUTABLE_NOW qualification: '+sentence.slice(0,120));
    if(/(?:labels?|timing|deferral|target-dependent|trigger)[^.;]{0,80}(?:informational|never excuses?|does not excuse|do not excuse|irrelevant|regardless|may be ignored|can be ignored)/i.test(sentence)||/(?:ignore|disregard)[^.;]{0,40}(?:timing|labels?|deferral|trigger)/i.test(sentence))issues.push('deferral or timing dismissed: '+sentence.slice(0,120));
    if(/\brejection\b/i.test(sentence)&&/(?:may|can|might|could) differ|differ(?:s|ing|ent)? from|need not (?:match|agree)|does not (?:have to|need to) (?:match|agree)/i.test(sentence))issues.push('rejection disagreement tolerated: '+sentence.slice(0,120));
    if(/\brejection\b/i.test(sentence)&&/\bcompar(?:e|ed|ing|ison)\b/i.test(sentence)&&!/\bagree\b/i.test(sentence))issues.push('rejection merely compared, agreement not required: '+sentence.slice(0,120));
    if(/mismatch[^.;]{0,60}(?:acceptable|allowed|permitted|tolerated|complete)/i.test(sentence))issues.push('mismatch tolerated: '+sentence.slice(0,120));
    if(/accepted[- ]invalid/i.test(sentence)&&/(?:is complete|completes?\b|counts? as complete|satisf|sufficient|enough|even if never rejected|no longer blocks?)/i.test(sentence)&&!/\bblocked\b/i.test(sentence))issues.push('accepted invalid fixture treated as completable: '+sentence.slice(0,120));
    if(/even if never rejected/i.test(sentence))issues.push('acceptance without actual rejection tolerated: '+sentence.slice(0,120));
    if(/(?:once|when|after|as soon as) (?:its|the|a) (?:validator )?defect is linked/i.test(sentence)&&!/\bblocked\b/i.test(sentence))issues.push('linked defect presented as completion: '+sentence.slice(0,120));
    if(/\bmark (?:each|every|all) fixtures?[^.;]{0,40}(?:EXECUTABLE_NOW|target-dependent)/i.test(sentence)||/\blabel(?:s|led|ling)? (?:each|every|all|it|them)[^.;]{0,30}(?:EXECUTABLE_NOW|target-dependent)/i.test(sentence))issues.push('agent label presented as deciding executability: '+sentence.slice(0,120));
    if(/represented as executed before (?:its|the) target exists/i.test(sentence))issues.push('wrong representation boundary (must be before actual execution): '+sentence.slice(0,120));
  }
  const required=[[/every applicable requirement has failure analysis/i,'failure analysis for every applicable requirement'],[/EXECUTABLE_NOW fixture[^.;]{0,80}(?:was )?(?:actually )?executed[^.;]{0,120}isolated disposable state/i,'EXECUTABLE_NOW execution in isolated disposable state'],[/expected and actual rejection agree/i,'expected and actual rejection agree'],[/target-dependent fixture/i,'target-dependent fixture'],[/EARLIEST_EXECUTABLE_STAGE/,'EARLIEST_EXECUTABLE_STAGE'],[/REQUIRED_BY_STAGE/,'REQUIRED_BY_STAGE'],[/TARGET_AVAILABILITY_CONDITION[^.;]{0,60}accepted proof expression/i,'TARGET_AVAILABILITY_CONDITION naming an accepted proof expression'],[/reviewed binding and compatibility/i,'reviewed binding and compatibility'],[/never represented as executed before actual execution/i,'never represented as executed before actual execution'],[/application-derived[^.;]{0,80}not from an agent label/i,'application-derived executability, not an agent label'],[/without a declared timing contract is executable now/i,'undeclared timing is executable now'],[/accepted-invalid fixture is linked to a validator defect/i,'accepted-invalid fixture linked to a validator defect'],[/(?:mismatch[^.;]{0,80}|accepted invalid fixture[^.;]{0,80})keeps Stage 07 blocked even with a linked validator defect until the corrected validator actually rejects the preserved fixture/i,'mismatch or accepted invalid fixture stays blocked until the corrected validator actually rejects the preserved fixture'],[/Fixture creation alone is never completion/i,'fixture creation alone is never completion']];
  for(const [pattern,label] of required)if(!pattern.test(block))issues.push('missing required contract element: '+label);
  return issues;
}
export function stage07CompletionBlock(promptText){
  const start=promptText.indexOf(HEADER);assert(start>=0,'Stage 07 prompt lacks the STAGE COMPLETION BOUNDARY header.');
  const bodyStart=start+HEADER.length,end=promptText.indexOf('\n\n',bodyStart);assert(end>bodyStart,'Stage 07 completion block is not delimited.');
  const block=promptText.slice(bodyStart,end);
  assert(block.length>200&&block.length<4000&&!block.includes('\n'),`Stage 07 completion block has unexpected shape (${block.length} bytes).`);
  return block;
}
function stage07State({core,schema,engine,prompts,ingestion}){
  const state=core.createBlankState('JOB-STAGE07-DEFERRAL');
  Object.assign(state.job,{EXACT_USER_OBJECTIVE_VERBATIM:'STAGE07-DEFERRAL-SENTINEL: build exactly the requested project.',EXPLICIT_USER_REQUIREMENTS:'Reject malformed input.',SUPPLIED_MATERIALS_INVENTORY:'NONE',CURRENT_INPUT_VERSION:'INPUT-STAGE07',CURRENT_SOURCE_SET_VERSION:'SOURCE-STAGE07',CURRENT_RESEARCH_VERSION:'RESEARCH-STAGE07',CURRENT_REQUIREMENTS_VERSION:'REQ-STAGE07',CURRENT_TEST_SUITE_VERSION:'TEST-STAGE07'});
  engine.ensureShape(state);engine.recalculate(state);
  const intake=prompts.intakeCoverageManifest(state);
  state.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'DELIVERABLE-SENTINEL',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify({schema:'closed-loop-stage01-capture/2',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,pass1Completed:true,pass2OmissionChallenge:{completed:true,checkedCategories:['QUALIFIERS','EXCEPTIONS','DEPENDENCIES','NEGATIVE_REQUIREMENTS','DO_NOT_CHANGE','VISUAL_CONSTRAINTS','TEMPORAL_CONSTRAINTS','ACCEPTANCE_CONDITIONS','AUTHORITY_STATEMENTS','TOOL_RESTRICTIONS','FILE_REFERENCES','OUTPUT_FORMAT_REQUIREMENTS','CORRECTIONS','LATER_OVERRIDES'],omissionsFound:[],omissionsResolved:true},units:intake.units.map((u,i)=>({sourceUnitId:u.unitId,sourceRawValueSha256:u.rawValueSha256,disposition:'EXTRACTED_RELEVANT_INFORMATION',reason:'',extractedStatements:[{statementKey:'S'+i,text:u.rawValueText||('captured '+u.label),statementClass:'CONTEXT'}]}))})};
  Object.assign(state,stage04AcceptanceFixture({core,schema,engine,prompts,ingestion},state.job.JOB_ID,{project:state,stageData:state.stages[1].agentData}));
  for(let s=1;s<7;s++){state.stages[s].status='COMPLETE';state.stages[s].gate={complete:true};}
  return state;
}
// Canary mutations (reviewer-supplied M3-M5 plus deferral stripping, the two superseded
// directive texts, and agent-label phrasing). Each must be rejected by the contract.
export const STAGE07_CANARIES=Object.freeze({
  'M2-deferral-stripped':block=>sentences(block).filter(s=>!/target-dependent|EXECUTABLE_NOW|timing/i.test(s)).join(' ')+' Complete only after every applicable failure fixture was actually executed through a capable route.',
  'M3-labels-informational':block=>block+' Run every fixture; the labels are informational and timing never excuses running now.',
  'M4-rejection-may-differ':block=>block+' Actual rejection may differ from expected rejection.',
  'M5-linked-defect-completes':block=>block+' An accepted invalid fixture is complete once its defect is linked, even if never rejected.',
  'M6-superseded-directive-v1':()=>'Complete only after every applicable requirement has failure analysis, every EXECUTABLE_NOW fixture was actually executed through a capable route in isolated disposable state with expected rejection compared against actual rejection and sufficient evidence preserved, every target-dependent fixture carries a valid timing/trigger contract and REQUIRED_BY_STAGE instead of a claimed execution, and every accepted-invalid fixture is linked to a validator defect. Fixture creation alone is never completion, and a deferred fixture is never represented as executed before its target exists.',
  'M7-original-e16b31db-directive':()=>'Complete only after every applicable failure fixture was actually executed through a capable route, expected rejection is compared with actual rejection, sufficient evidence is preserved, and every accepted-invalid fixture is linked to a validator defect. Fixture creation alone is never completion.',
  'M8-agent-label-decides':block=>block+' Mark each fixture EXECUTABLE_NOW or target-dependent.'
});
export const STAGE07_PROCEDURE_CANARIES=Object.freeze({
  'X4-declared-never-executed':text=>text+' A fixture with a declared timing contract is never executed at Stage 07, even when its target already exists.',
  'V2-declaration-defers':text=>text.replace(/A fixture without a declared timing contract is executable now\. A fixture with a valid declared timing contract \([^)]*\) is executable now as soon as[^.;]*; a declaration alone never defers execution\./,'A fixture is executable now unless it declares a valid complete timing contract (EARLIEST_EXECUTABLE_STAGE, REQUIRED_BY_STAGE and a TARGET_AVAILABILITY_CONDITION naming an accepted proof expression) with reviewed binding and compatibility.')
});
function procedureIssues(text){const issues=[];for(const sentence of sentences(text)){if(universalExecutionDemand(sentence))issues.push('universal demand');if(declarationDefersExecution(sentence))issues.push('declaration defers');}if(!/declaration alone never defers execution/i.test(text))issues.push('missing never-defers rule');return issues;}
export function verifyStage07DeferralInstructions(runtime){
  const {core,schema,engine,prompts}=runtime;
  assert(core&&schema&&engine&&prompts,'Stage 07 deferral regression: prompt runtime is not loaded.');
  const operations=schema.STAGE_CONTRACTS[7].operations;
  assert(operations.includes('COMPLETE')&&operations.includes('EXECUTE_FAILURE_TEST'),'Stage 07 operation set changed; the regression must be re-derived.');
  const state=stage07State(runtime),scope=Object.fromEntries((schema.operationContract(7,'COMPLETE')?.scopeRequirements||[]).map(key=>[key,key.toUpperCase()+'-AUDIT']));
  const text=prompts.buildPromptRecord(7,state,{operation:'COMPLETE',scope}).prompt;
  assert(text.includes('STAGE PROCEDURE'),'Stage 07 COMPLETE prompt lost its procedure section.');
  // 1. The exact generated completion block (header to the next blank line only).
  const block=stage07CompletionBlock(text),issues=completionContractIssues(block);
  assert(issues.length===0,'Stage 07 COMPLETE completion block violates the governing contract: '+issues.join(' | '));
  // 2. Detection power: every canary mutation of that block must be rejected.
  const canaryResults={};
  for(const [name,mutate] of Object.entries(STAGE07_CANARIES)){const found=completionContractIssues(mutate(block));assert(found.length>0,`Canary ${name} was NOT detected by the completion contract.`);canaryResults[name]=found.length;}
  // 3. Published stage procedure text and the operation-independent fallback.
  for(const [label,procedure] of [['Stage 07 published procedure',String(prompts.procedures[7]||'')],['Stage 07 COMPLETE procedure',prompts.procedureFor(7,'COMPLETE')]]){
    assert(procedure.length>120,`${label} is not substantive.`);
    for(const sentence of sentences(procedure)){
      assert(!universalExecutionDemand(sentence),`${label} demands execution of every fixture without EXECUTABLE_NOW qualification: ${sentence.slice(0,120)}`);
      assert(!/(?:labels?|timing|deferral|target-dependent)[^.;]{0,80}(?:informational|never excuses?|irrelevant|regardless)/i.test(sentence),`${label} dismisses deferral: ${sentence.slice(0,120)}`);
      assert(!(/\brejection\b/i.test(sentence)&&/(?:may|can|might|could) differ|differ(?:s|ing|ent)? from/i.test(sentence)),`${label} tolerates rejection disagreement: ${sentence.slice(0,120)}`);
      assert(!/represented as executed before (?:its|the) target exists/i.test(sentence),`${label} uses the wrong representation boundary.`);
      assert(!declarationDefersExecution(sentence),`${label} lets a timing declaration alone defer or skip execution: ${sentence.slice(0,140)}`);
    }
    if(label==='Stage 07 published procedure')assert(/declaration alone never defers execution/i.test(procedure)&&/executable now as soon as[^.;]{0,160}EARLIEST_EXECUTABLE_STAGE[^.;]{0,160}target availability is TRUE[^.;]{0,80}including before its REQUIRED_BY_STAGE/i.test(procedure)&&/without a declared timing contract is executable now/i.test(procedure),`${label} lacks the declared-but-executable-now rule (earliest stage reached and target TRUE, before REQUIRED_BY_STAGE).`);
    assert(/executable[- ]now|EXECUTABLE_NOW/i.test(procedure)&&/target-dependent/i.test(procedure),`${label} lacks the executable-now versus target-dependent distinction.`);
  }
  const published=String(prompts.procedures[7]||'');
  assert(/expected and actual rejection must agree/i.test(published)&&/remains blocked, even with a linked defect, until the corrected validator actually rejects the preserved fixture/i.test(published)&&/not from an agent label/i.test(published)&&/never represented as executed before actual execution/i.test(published),'Stage 07 published procedure lacks agreement, accepted-invalid block, application-derived executability or the actual-execution representation boundary.');
  // 3b. Procedure canaries: the reviewer's X4 text and the rejected v2 sentence must be detected.
  const procedureCanaryResults={};
  for(const [name,mutate] of Object.entries(STAGE07_PROCEDURE_CANARIES)){const mutated=mutate(published);assert(mutated!==published,`Procedure canary ${name} did not alter the text.`);const found=procedureIssues(mutated);assert(found.length>0,`Procedure canary ${name} was NOT detected.`);procedureCanaryResults[name]=found.length;}
  assert(procedureIssues(published).length===0,'Stage 07 published procedure violates the declaration rules: '+procedureIssues(published).join(' | '));
  // 3c. Concrete gate semantics (unchanged runtime): a VALID declared timing contract with
  // EARLIEST_EXECUTABLE_STAGE 7, REQUIRED_BY_STAGE 15 and a TRUE target at Stage 07 is
  // executable now at Stage 07 (not yet due, not blocking); before its earliest stage it is
  // not executable; when its target does not exist it is not executable. A declaration
  // alone never defers execution.
  const declaredTiming={VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:7,REQUIRED_BY_STAGE:15,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:false,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{type:'PHASE_TARGET'}};
  assert(schema.validateVerificationTiming(declaredTiming,{subjectFamily:'failureTests'}).valid,'Fixture timing declaration is not valid under the schema contract.');
  const declaredState=structuredClone(state),declaredRecord={id:'MUT-DECLARED-TARGET-PRESENT',stage:7,active:true,scope:{...engine.currentScope(declaredState)},fields:{MUTATION_ID:'MUT-DECLARED-TARGET-PRESENT',...declaredTiming},...declaredTiming,MUTATION_ID:'MUT-DECLARED-TARGET-PRESENT'};
  declaredState.projectData.failureTests=[...(declaredState.projectData.failureTests||[]),declaredRecord];
  const present=engine.failureTestTimingState(declaredState,declaredRecord,7);
  assert(present.valid===true&&present.deferred===true&&present.targetAvailability==='TRUE',`Declared fixture with present target did not evaluate as valid/deferred/TRUE: ${JSON.stringify({valid:present.valid,deferred:present.deferred,target:present.targetAvailability,reasons:present.reasons})}`);
  assert(present.executableNow===true&&present.dueNow===false&&present.blocking===false,`Declared fixture (earliest 7, required-by 15, target TRUE) must be executable now at Stage 07 and not yet due: ${JSON.stringify({executableNow:present.executableNow,dueNow:present.dueNow,blocking:present.blocking})}`);
  const beforeEarliest=engine.failureTestTimingState(declaredState,declaredRecord,6);
  assert(beforeEarliest.executableNow===false&&beforeEarliest.blocking===false,'Declared fixture became executable before its EARLIEST_EXECUTABLE_STAGE.');
  const absentTarget=engine.failureTestTimingState(state,declaredRecord,7);
  assert(absentTarget.executableNow===false&&absentTarget.targetAvailability!=='TRUE',`Declared fixture without an existing target must not be executable now: ${JSON.stringify({executableNow:absentTarget.executableNow,target:absentTarget.targetAvailability})}`);
  // 4. The isolated execution operation keeps its single-fixture contract unchanged.
  const execute=prompts.procedureFor(7,'EXECUTE_FAILURE_TEST');
  assert(/execute only the exact application-selected failure fixture/i.test(execute)&&/isolated disposable state/i.test(execute),'EXECUTE_FAILURE_TEST procedure changed its single-fixture isolated contract.');
  // 5. Runtime gate semantics unchanged: undeclared timing is executable now; a
  // declared timing contract is evaluated as deferred.
  const immediate=engine.failureTestTimingState(state,{id:'MUT-IMMEDIATE',stage:7,fields:{}},7);
  assert(immediate.valid===true&&immediate.executableNow===true&&immediate.deferred===false,'Undeclared fixture timing is no longer executable-now.');
  const declared=engine.failureTestTimingState(state,{id:'MUT-DEFERRED',stage:7,fields:{VERIFICATION_PHASE:schema.VERIFICATION_PHASE_VALUES[0]}},7);
  assert(declared.deferred===true,'A declared timing contract is no longer evaluated as a deferred fixture.');
  return {stage07DeferralInstructionsPreserved:true,completionBlockBytes:new TextEncoder().encode(block).length,canariesRejected:canaryResults,procedureCanariesRejected:procedureCanaryResults,declaredTargetPresentExecutableNowAtStage07:present.executableNow,operations:[...operations]};
}
if(import.meta.url===`file://${process.argv[1]}`){
  const fs=await import('node:fs');const {createVerifierRuntime}=await import('./verifier-runtime.mjs');
  globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
  for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])createVerifierRuntime.loadScript(globalThis,fs.readFileSync(file,'utf8'),{filename:file});
  console.log(JSON.stringify(verifyStage07DeferralInstructions({core:globalThis.closedLoopCore,schema:globalThis.closedLoopWorkflowSchema,engine:globalThis.closedLoopWorkflowEngine,prompts:globalThis.closedLoopPromptEngine,ingestion:globalThis.closedLoopResponseIngestion}),null,2));
}
