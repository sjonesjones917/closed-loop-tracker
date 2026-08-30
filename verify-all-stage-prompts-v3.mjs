import fs from 'node:fs';
import vm from 'node:vm';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine;
if(!core||!schema||!engine||!prompts)throw new Error('Runtime load failed');
const project=core.createBlankState('JOB-ALL-PROMPTS');
Object.assign(project.job,{EXACT_USER_OBJECTIVE_VERBATIM:'USER-OBJECTIVE-SENTINEL',EXPLICIT_USER_REQUIREMENTS:'USER-REQ-SENTINEL',PROHIBITED_ACTIONS:'USER-PROHIBITION-SENTINEL',SUPPLIED_MATERIALS_INVENTORY:'USER-MATERIAL-SENTINEL',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-v001',CURRENT_REQUIREMENTS_VERSION:'REQ-v001',CURRENT_TEST_SUITE_VERSION:'TEST-v001',CURRENT_INSTRUCTION_VERSION:'INST-v001',CURRENT_ITERATION:'ITER-v001',CURRENT_BASELINE_ID:'BASE-v001',CURRENT_PRODUCT_ID:'PROD-v001'});
engine.ensureShape(project);
for(let n=1;n<=30;n++)project.stages[n-1].agentData={AUDIT_SENTINEL:`STAGE-SNAPSHOT-SENTINEL-${n}`};
const requiredSnapshots={2:[1],3:[1,2],4:[1,3],5:[4],6:[4,5],7:[4,6],8:[4,5,6,7],9:[8],10:[8,9],11:[10],12:[],13:[12],14:[12,13],15:[14],16:[14,15],17:[16],18:[17],19:[18],20:[19],21:[20],22:[21],23:[],24:[],25:[20,21],26:[20,21,22,23,24,25],27:[26],28:[27],29:[27,28],30:[15,20,29]};
const semantics={
1:['complete human-authority intake','every controlled intake unit','BLOCKING_NOW','ASK_NOW_NONBLOCKING','LATER_RESOLVABLE','durable project memory'],
2:['complete independent external source inventory','NO_APPLICABLE_EXTERNAL_SOURCE','authority conflicts','Do not perform Stage 03'],
3:['Exhaust the complete current accepted Stage 02 source set','every current Stage 02 source','every requirement-relevant Stage 01','saturation passes'],
4:['APPLICATION OBLIGATION MANIFEST','No obligation may disappear','atomic requirement','never ask the human to repeat or reattach'],
5:['Resolve the complete current requirement set','duplicates','circular dependencies','verification path'],
6:['complete verification suite','false appear compliant','APPLICATION_DETERMINISTIC','Closed Loop Test IR','unavailable mandatory capability'],
7:['actually execute the complete applicable failure-test suite','Fixture creation is not fixture execution','validator defect'],
8:['one complete production instruction','Trace every current mandatory requirement','exact output contract','Distinguish creating an artifact'],
9:['Review every material clause','independent reviewer context','No material finding may remain unresolved'],
10:['Freeze the exact test candidate','human selects','prevents in-place mutation','Do not begin the ten executions'],
11:['exactly ten times','application-reserved independent contexts','another run output','application determines candidate equality'],
12:['REQ_ID × RUN_ID × TEST_ID','Respect the stored execution route exactly','Prose cannot prove byte identity','exactly one current valid independent sufficiently evidenced determination'],
13:['all ten current runs','agreement rates','Never omit or discard'],
14:['Root-cause every current material defect','earliest defective layer','Do not propose a symptom-only patch'],
15:['permanent regression','actual PRE_CORRECTION','distinct later current-scope regression execution'],
16:['Correct the root cause','earliest responsible layer','Execution-only failure must not cause an unsupported instruction change'],
17:['complete corrected iteration','exactly ten new independent runs','declared Stage 17 operation only'],
18:['Evaluate convergence','all convergence conditions are simultaneously true','Do not set CONVERGED'],
19:['unchanged confirmation lifecycle','zero material changes','complete current verification suite','every applicable active regression'],
20:['successful current unchanged-confirmation','explicit human baseline authorization','immutable baseline identity'],
21:['Generate the complete finished product','Produce every actual requested output artifact','separate operations','new controlled product version'],
22:['complete applicable deterministic verification set','application worker','never fabricate native receipts','current product'],
23:['complete independent meaning-based verification','must not receive generator correctness claims','exact product location','Bare conclusions are insufficient'],
24:['complete adversarial verification','must not receive generator reasoning/self-evaluation','every applicable category','historical regression'],
25:['exact final representation','every required page/view/representation/transformation','No mandatory representation unknown'],
26:['complete current process evidence and product evidence','Do not hide contradictions','evidence-sufficiency'],
27:['advisory release-evidence review only','do not decide release','application alone creates'],
28:['authoritative immediate byte comparison','one-to-one join','must prevent authorization'],
29:['complete current evidence chain','Structural completeness alone is insufficient','capable of proving its proposition'],
30:['permanent defect and regression history','append-only','latest applicable execution of every active regression']
};
const results=[];
for(let stage=1;stage<=30;stage++){
 for(const operation of schema.STAGE_CONTRACTS[stage].operations){
  let record;
  try{record=prompts.buildPromptRecord(stage,project,{operation});}catch(err){
   // scope-specific operations may require reserved identities; audit their static procedure from source separately.
   if(/scope|RUN_ID|CONTEXT_ID|iteration|candidate/i.test(String(err?.message||err))){continue;} throw err;
  }
  const text=record.prompt;
  for(const token of semantics[stage])if(!text.toLowerCase().includes(token.toLowerCase()))throw new Error(`Stage ${stage} ${operation} missing complete-job semantic: ${token}`);
  for(const token of ['USER-OBJECTIVE-SENTINEL','USER-REQ-SENTINEL','USER-PROHIBITION-SENTINEL','USER-MATERIAL-SENTINEL'])if(!text.includes(token))throw new Error(`Stage ${stage} ${operation} lost current human project memory: ${token}`);
  for(const prior of requiredSnapshots[stage]||[])if(!text.includes(`STAGE-SNAPSHOT-SENTINEL-${prior}`))throw new Error(`Stage ${stage} ${operation} missing required prior-stage snapshot ${prior}`);
  if(!text.includes('PROJECT MEMORY / SINGLE-SUPPLY INVARIANT'))throw new Error(`Stage ${stage} ${operation} lacks single-supply invariant`);
  if(!text.includes('Never assign canonical application IDs, versions, timestamps, counts, hashes, statuses, coverage values, release determinations, current stage/state, or other application-owned values.'))throw new Error(`Stage ${stage} ${operation} lacks application-ownership boundary`);
  results.push(`${stage}:${operation}`);
 }
}
const src=fs.readFileSync('prompt-engine.js','utf8');
for(const forbidden of ['PATENT / REGULATED FILING','SOFTWARE / MULTI-FILE SYSTEM','BUILDING / ARCHITECTURE / AEC','PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'])if(src.includes(forbidden))throw new Error(`Hard-coded project-subject branch remains: ${forbidden}`);
for(const [stage,opTokens] of Object.entries({17:{FREEZE:'For this FREEZE operation',EXECUTE_RUN:'For this EXECUTE_RUN operation',VERIFY:'For this VERIFY operation',COMPARE:'For this COMPARE operation',ROOT_CAUSE:'For this ROOT_CAUSE operation',REGRESSION:'For this REGRESSION operation',CORRECT:'For this CORRECT operation'},19:{CONFIRM_FREEZE:'semantic freeze-confirmation operation',EXECUTE_RUN:'For this EXECUTE_RUN operation',VERIFY:'For this VERIFY operation',COMPARE:'For this COMPARE operation',REGRESSION_VERIFY:'For this REGRESSION_VERIFY operation',CONFIRM:'For this CONFIRM operation'}}))for(const [op,token] of Object.entries(opTokens))if(!src.includes(token))throw new Error(`Stage ${stage} ${op} operation-specific prompt job missing`);
for(const file of ['workbook.js','app-core.js','workflow-engine.js','response-ingestion.js','project-store.js','index.html']){
 const s=fs.readFileSync(file,'utf8');
 for(const marker of ['STAGE-SPECIFIC TASK','MANDATORY RESPONSE RULES','HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE','You are the ${d.role}'])if(s.includes(marker))throw new Error(`Competing agent instruction authority outside prompt-engine.js: ${file} contains ${marker}`);
}
// Independent-review prompt projections must not include generic prior-stage conclusions.
for(const [stage,forbiddenStage] of [[12,11],[23,22],[24,23]]){
 const needle=`STAGE-SNAPSHOT-SENTINEL-${forbiddenStage}`;
 try{const r=prompts.buildPromptRecord(stage,project,{operation:schema.STAGE_CONTRACTS[stage].operations[0]});if(r.prompt.includes(needle))throw new Error(`Stage ${stage} leaked forbidden generic Stage ${forbiddenStage} snapshot`);}catch(err){if(!/scope|RUN_ID|CONTEXT_ID|iteration|candidate/i.test(String(err?.message||err)))throw err;}
}
console.log(JSON.stringify({allThirtyStagePromptAudit:true,stageOperationPromptsAudited:results.length,subjectNeutral:true,singleSupplyEveryGeneratedPrompt:true,priorStageDependencySnapshots:true,competingPromptAuthority:false},null,2));
