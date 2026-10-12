import {createVerifierRuntime} from './verifier-runtime.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import {stage04AcceptanceFixture} from './test-fixtures.mjs';
import assert from 'node:assert/strict';
import {appMarkup,observeWorkflowMarkup,observeStagePurposeMarkup,assertWorkflowPresentation,assertStageExplanation} from './test-app-markup.mjs';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
createVerifierRuntime.loadScript(globalThis,fs.readFileSync('workbook.js','utf8'),{filename:'workbook.js'});

const core=globalThis.closedLoopCore;
assert(core,'workbook runtime did not load');

function stage(number){
  const value=core.STAGES[number-1];
  assert.equal(value?.number,number,`Stage ${number} missing`);
  return value;
}
function requireFields(number,names){
  const value=stage(number);
  for(const name of names){
    assert(value.fields.includes(name),`Stage ${number} is missing required field ${name}`);
    assert(value.ownership.application.includes(name),`Stage ${number} required application-owned field ${name} is not application-owned`);
  }
}
function assertOwnershipClosed(number){
  const value=stage(number);
  const partitions=['human','humanDecision','agent','application'].flatMap(key=>value.ownership[key]||[]);
  assert.equal(new Set(partitions).size,partitions.length,`Stage ${number} ownership partitions overlap`);
  assert.deepEqual([...new Set(partitions)].sort(),[...value.fields].sort(),`Stage ${number} ownership universe does not exactly cover its field contract`);
}

// Independent literal from controlling §37 Stage01, source line3384.
// Role labels do not establish actor authority, intake adequacy or stage completion.
const expectedStage01Role='Job-control analyst';
function assertStage01Role(value){
 for(const key of ['declaration','contract','prompt'])assert.equal(value[key],expectedStage01Role,'STAGE01_LITERAL_ROLE_ORACLE: '+key);
 const published=value.instruction.split('\n').filter(line=>line.startsWith('You are the '));
 assert.deepEqual(published,['You are the Job-control analyst. Perform only this stage and operation for JOB_ID JOB-STAGE01-LITERAL-ROLE.'],'STAGE01_PUBLISHED_ROLE_ORACLE');
}
for(const file of ['hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])createVerifierRuntime.loadScript(globalThis,fs.readFileSync(file,'utf8'),{filename:file});
const roleProject=core.createBlankState('JOB-STAGE01-LITERAL-ROLE');
Object.assign(roleProject.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Preserve the supplied job objective.',CURRENT_INPUT_VERSION:'INPUT-v001'});
closedLoopWorkflowEngine.ensureShape(roleProject);closedLoopWorkflowEngine.recalculate(roleProject);
const rolePrompt=closedLoopPromptEngine.buildPromptRecord(1,roleProject,{operation:'COMPLETE'});
const roleCarrier={declaration:stage(1).role,contract:closedLoopWorkflowSchema.STAGE_CONTRACTS[1].role,prompt:rolePrompt.role,instruction:rolePrompt.prompt};
assertStage01Role(roleCarrier);
const roleNegativeCases=[];
for(const key of ['declaration','contract','prompt'])for(const value of [undefined,'Source-authority analyst']){
 assert.throws(()=>assertStage01Role({...roleCarrier,[key]:value}),/STAGE01_LITERAL_ROLE_ORACLE/);roleNegativeCases.push(key+':'+(value===undefined?'missing':'wrong-role'));
}
for(const [name,instruction]of [['missing-role',roleCarrier.instruction.replace('You are the Job-control analyst.','Role omitted.')],['wrong-role',roleCarrier.instruction.replace('You are the Job-control analyst.','You are the Source-authority analyst.')]]){
 assert.throws(()=>assertStage01Role({...roleCarrier,instruction}),/STAGE01_PUBLISHED_ROLE_ORACLE/);roleNegativeCases.push('instruction:'+name);
}

// BEGIN BOUNDED STAGE DECLARATION SUPPLEMENT
// Independently literal §37 role labels. Synthetic prerequisite status permits
// rendering only; it does not prove intake, stage gates, executions or completion.
const expectedStageRoles=[{"stage":2,"role":"Source-authority analyst","requirementId":"NREQ-427f0fb0dd0c2264bbd7b69842eba179","sourceLine":3395},{"stage":3,"role":"Requirements-research analyst","requirementId":"NREQ-f519a715c4ce0b702fcf4f432a2f3e24","sourceLine":3405},{"stage":4,"role":"Requirement-specification engineer","requirementId":"NREQ-cecb8ce5bce13cbdb99027efa0fc1af0","sourceLine":3414},{"stage":5,"role":"Requirement-resolution reviewer","requirementId":"NREQ-4c47880c9ca5429f400dc34ceae3043e","sourceLine":3424},{"stage":6,"role":"Verification architect","requirementId":"NREQ-fa538df94482d0550096ae456a4acc4d","sourceLine":3432},{"stage":7,"role":"Adversarial test designer","requirementId":"NREQ-86fafbed2d6b79f634e7ee47e980d54b","sourceLine":3449},{"stage":8,"role":"Production-instruction engineer","requirementId":"NREQ-aa2a1d8c7c45e9c7f0bbea28fd9eb266","sourceLine":3458},{"stage":9,"role":"Independent preflight reviewer","requirementId":"NREQ-8c80bba7955aae714b1a5a1cf2398020","sourceLine":3467},{"stage":10,"role":"Configuration-control reviewer","requirementId":"NREQ-efb9653c51f466d131fe2fe2099fa9bc","sourceLine":3477},{"stage":11,"role":"Independent production execution agent","requirementId":"NREQ-cdae1d95803c975e2b5817dcbc1acf43","sourceLine":3487},{"stage":12,"role":"Independent run verifier","requirementId":"NREQ-12dbcde7c6fb615b0ff78d471aaa3d08","sourceLine":3497},{"stage":13,"role":"Cross-run comparison analyst","requirementId":"NREQ-bf4a2a2724397b7b5b06bf5a05bd94f3","sourceLine":3506},{"stage":14,"role":"Root-cause analyst","requirementId":"NREQ-f150e202fa4bae8ca5b9785736cf1b24","sourceLine":3515},{"stage":15,"role":"Regression-test engineer","requirementId":"NREQ-0eb47ae8de2bfae12b06d84e3bc6de03","sourceLine":3523},{"stage":16,"role":"Change-control engineer","requirementId":"NREQ-fd0607224eb3b5176911a403d86e4034","sourceLine":3531},{"stage":17,"role":"New-iteration controller","requirementId":"NREQ-527722a8c538d094388563d1a6c01b52","sourceLine":3540},{"stage":18,"role":"Convergence reviewer","requirementId":"NREQ-420c6b157ecd757f6a0cb77463de308e","sourceLine":3548},{"stage":19,"role":"Unchanged-confirmation reviewer","requirementId":"NREQ-e4dac8e0912ddd4d1f86523d9d1560f9","sourceLine":3556},{"stage":20,"role":"Baseline configuration controller","requirementId":"NREQ-bbed713638d67f007309164b5a07a81c","sourceLine":3565},{"stage":21,"role":"Final production execution agent","requirementId":"NREQ-a3f44049c6c9f372f83fecd7e9841b0a","sourceLine":3574},{"stage":22,"role":"Deterministic product verifier","requirementId":"NREQ-6199ac43aaadd4bbdee5e7bdd1ac6421","sourceLine":3583},{"stage":23,"role":"Independent meaning evaluator","requirementId":"NREQ-49557d149933baccaf81eb90eb5e1717","sourceLine":3593},{"stage":24,"role":"Independent adversarial reviewer","requirementId":"NREQ-3fb148fc485595ad314466ee24e86991","sourceLine":3602},{"stage":25,"role":"Final-representation inspector","requirementId":"NREQ-21e6acd689da49ef5794ed7b0da45b40","sourceLine":3610},{"stage":26,"role":"Release-evidence reconciler","requirementId":"NREQ-8906f0d0b1cf7cf54cb4323ed2569940","sourceLine":3619},{"stage":27,"role":"Release-gate reviewer","requirementId":"NREQ-a8cbcf1c749752d55c4731222628be6f","sourceLine":3627},{"stage":28,"role":"Artifact-identity reviewer","requirementId":"NREQ-604c2ea233a5b328c6cd6e33c6d681db","sourceLine":3637},{"stage":29,"role":"Traceability evidence custodian","requirementId":"NREQ-38628cafed872262a9b8d9144f0da01f","sourceLine":3645}];
function assertDeclaredStageRole(value,expected,{published=false}={}){
 for(const key of ['declaration','contract',...(published?['prompt']:[])])assert.equal(value[key],expected,'STAGE_LITERAL_ROLE_ORACLE: '+key);
 if(published)assert.deepEqual(value.instruction.split('\n').filter(line=>line.startsWith('You are the ')),[`You are the ${expected}. Perform only this stage and operation for JOB_ID JOB-STAGE-DECLARATIONS.`],'STAGE_PUBLISHED_ROLE_ORACLE');
}
const declarationProject=core.createBlankState('JOB-STAGE-DECLARATIONS');
Object.assign(declarationProject.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Preserve the supplied job objective.',CURRENT_INPUT_VERSION:'INPUT-DECLARATIONS',CURRENT_SOURCE_SET_VERSION:'SOURCE-DECLARATIONS',CURRENT_RESEARCH_VERSION:'RESEARCH-DECLARATIONS',CURRENT_REQUIREMENTS_VERSION:'REQ-DECLARATIONS',CURRENT_TEST_SUITE_VERSION:'TEST-DECLARATIONS',CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-DECLARATIONS'});
closedLoopWorkflowEngine.ensureShape(declarationProject);closedLoopWorkflowEngine.recalculate(declarationProject);
// Reuse the existing accepted Stage01 -> authored Stage02 -> capability ->
// independent search review -> Stage03 prerequisite helper. No upstream gate
// is fabricated; synthetic later-stage status permits declaration rendering only.
const acceptedDeclarationPrefix=stage04AcceptanceFixture({core,schema:closedLoopWorkflowSchema,engine:closedLoopWorkflowEngine,prompts:closedLoopPromptEngine,ingestion:closedLoopResponseIngestion},declarationProject.job.JOB_ID,{project:declarationProject});
Object.assign(declarationProject,acceptedDeclarationPrefix);
assert.equal(closedLoopWorkflowEngine.sourceApplicabilityState(declarationProject).determination,'NO_APPLICABLE_EXTERNAL_SOURCE','STAGE_DECLARATION_ACCEPTED_SOURCE_PREFIX_ORACLE');
assert.equal(closedLoopWorkflowEngine.gate(1,declarationProject).complete,true,'STAGE_DECLARATION_ACCEPTED_INTAKE_PREFIX_ORACLE');
assert.equal(closedLoopWorkflowEngine.gate(2,declarationProject).complete,true,'STAGE_DECLARATION_ACCEPTED_SOURCE_PREFIX_ORACLE');
assert.equal(closedLoopWorkflowEngine.gate(3,declarationProject).complete,true,'STAGE_DECLARATION_ACCEPTED_RESEARCH_PREFIX_ORACLE');
for(let number=1;number<=29;number++){declarationProject.stages[number].status='COMPLETE';declarationProject.stages[number].gate={complete:true};}
function declarationPrompt(number,operation){
 const scope=Object.fromEntries((closedLoopWorkflowSchema.operationContract(number,operation).scopeRequirements||[]).map(key=>[key,key.toUpperCase()+'-DECLARATION']));
 return closedLoopPromptEngine.buildPromptRecord(number,declarationProject,{operation,scope});
}
const declarationRoles=[],declarationPrompts=new Map();
for(const expected of expectedStageRoles){
 const {stage:number,role}=expected;
 const operation=closedLoopWorkflowSchema.STAGE_CONTRACTS[number].operations.find(operation=>{const entry=closedLoopWorkflowSchema.STAGE_OPERATION_REGISTRY[`${number}:${operation}`];return entry.executorClass==='EXTERNAL_AGENT'&&!entry.deferredSubjectFamily;});
 const record=operation?declarationPrompt(number,operation):null;if(record)declarationPrompts.set(number,record);
 const carrier={declaration:stage(number).role,contract:closedLoopWorkflowSchema.STAGE_CONTRACTS[number].role,...(record?{prompt:record.role,instruction:record.prompt}:{})};
 assertDeclaredStageRole(carrier,role,{published:Boolean(record)});
 const negatives=[];
 for(const key of ['declaration','contract',...(record?['prompt']:[])])for(const value of [undefined,'Wrong-stage actor']){
  assert.throws(()=>assertDeclaredStageRole({...carrier,[key]:value},role,{published:Boolean(record)}),/STAGE_LITERAL_ROLE_ORACLE/);negatives.push(key+':'+(value===undefined?'missing':'wrong-role'));
 }
 if(record)for(const [name,instruction]of [['missing-role',record.prompt.replace(`You are the ${role}.`,'Role omitted.')],['wrong-role',record.prompt.replace(`You are the ${role}.`,'You are the Wrong-stage actor.')]]){
  assert.throws(()=>assertDeclaredStageRole({...carrier,instruction},role,{published:true}),/STAGE_PUBLISHED_ROLE_ORACLE/);negatives.push('instruction:'+name);
 }
 declarationRoles.push({...expected,observed:carrier.declaration,contractRole:carrier.contract,publishedRole:record?.role||null,operation:operation||null,negativeCases:negatives,passed:true});
}
function controllingProcedure(record){
 const start=record.prompt.indexOf('\nSTAGE PROCEDURE\n'),end=record.prompt.indexOf('\nSTAGE COMPLETION BOUNDARY',start);
 assert(start>=0&&end>start,'DECLARATION_PROCEDURE_BOUNDARY_ORACLE');return record.prompt.slice(start+17,end).trim();
}
// Three independent prompt meanings from §37 lines3442,3443,3534. Restrict the
// oracle to the controlling procedure, excluding transported project data.
function assertFaithfulTestIrFirst(text){
 const decision=text.search(/(?:For every (?:current applicable mandatory proposition|mandatory requirement)), (?:decide whether it is faithfully expressible in the published Test IR|first determine whether its proposition can be faithfully represented in Test IR);/i),construction=text.search(/(?:create the required proof expression|then create the proof expression)/i);
 assert(decision>=0&&construction>decision,'STAGE06_FAITHFUL_TEST_IR_FIRST_ORACLE');
 assert(!/(?:skip|omit) (?:the )?(?:faithful|representability)|build tests before (?:checking|determining)/i.test(text),'STAGE06_FAITHFUL_TEST_IR_FIRST_ORACLE');
}
function assertFalsePositiveAnalysis(text){assert(/\bperform false-positive analysis\b/i.test(text)&&!/(?:skip|omit|do not perform) false-positive analysis/i.test(text),'STAGE06_FALSE_POSITIVE_ANALYSIS_ORACLE');}
function assertNoHumanLayerQuestion(text){assert(/Do not ask the user to determine (?:the responsible|the) layer\./i.test(text)&&!/(?:^|[.!?]\s+)(?:Ask|Have) the (?:user|human) (?:to )?(?:choose|identify|determine)[^.]*layer/i.test(text),'STAGE16_NO_HUMAN_LAYER_QUESTION_ORACLE');}
const declarationPromptObligations=[];
const promptMeanings=[
 {id:'NREQ-d2aa6c1021f4d78478919d484b1ae853',line:3442,stage:6,oracle:assertFaithfulTestIrFirst,expected:'For every mandatory requirement, determine faithful Test IR representability before constructing its proof.',paraphrase:'For every mandatory requirement, first determine whether its proposition can be faithfully represented in Test IR; then create the proof expression;',contradiction:' Build tests before determining representability.'},
 {id:'NREQ-a96b0068a391e24691be806831c2ad94',line:3443,stage:6,oracle:assertFalsePositiveAnalysis,expected:'Perform false-positive analysis.',paraphrase:'For every mandatory requirement, perform false-positive analysis.',contradiction:' Skip false-positive analysis.'},
 {id:'NREQ-2eadf7aa431600ec6d4f1092a60b7c05',line:3534,stage:16,oracle:assertNoHumanLayerQuestion,expected:'Do not ask the user to determine the layer.',paraphrase:'Correct the known root cause. Do not ask the user to determine the layer.',contradiction:' Ask the user to determine the layer.'}
];
for(const meaning of promptMeanings){
 const text=controllingProcedure(declarationPrompts.get(meaning.stage));meaning.oracle(text);meaning.oracle(meaning.paraphrase);
 for(const invalid of ['', 'Perform unrelated stage work.',text+meaning.contradiction])assert.throws(()=>meaning.oracle(invalid),/STAGE(?:06|16)_/);
 declarationPromptObligations.push({requirementId:meaning.id,sourceLine:meaning.line,stage:meaning.stage,expected:meaning.expected,observed:text,paraphraseAccepted:true,negativeCases:['missing','wrong-meaning','contradictory-guidance'],passed:true});
}
// Actual primary markup from the existing presentation owning helper. These
// isolated declaration fixtures exercise rendering, not stage completion.
for(const file of ['response-ingestion.js','project-store.js'])createVerifierRuntime.loadScript(globalThis,fs.readFileSync(file,'utf8'),{filename:file});
const explanationProject=core.createBlankState('JOB-STAGE-EXPLANATIONS');Object.assign(explanationProject.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Preserve the supplied job objective.',CURRENT_INPUT_VERSION:'INPUT-EXPLANATIONS'});closedLoopWorkflowEngine.ensureShape(explanationProject);closedLoopWorkflowEngine.recalculate(explanationProject);
const declarationExplanationCases=[],declarationAppSource=fs.readFileSync('app-core.js','utf8');
for(const number of [6,7,10,11,12,15,17,19,21,22,23,24,25,26,27,29]){
 const project=closedLoopWorkflowEngine.clone(explanationProject);project.activeStage=number;
 const rendered=appMarkup(globalThis,project,{source:declarationAppSource,instructionEvidence:true});
 const observation=observeWorkflowMarkup(rendered.html),result=assertWorkflowPresentation(observation,{instruction:rendered.instruction,caseId:`selected-stage-${number}-DECLARATION`});
 const purpose=rendered.html.match(/<div class="notice"><strong>This stage<\/strong><br>[\s\S]*?<\/div>/)[0];
 for(const hidden of [`<details>${purpose}</details>`,`<div hidden>${purpose}</div>`])assert.throws(()=>assertStageExplanation(observeStagePurposeMarkup(hidden),number),/STAGE_EXPLANATION_SINGLE_VISIBLE_ORACLE/);
 assert.throws(()=>assertStageExplanation(observeStagePurposeMarkup(purpose+purpose),number),/STAGE_EXPLANATION_SINGLE_VISIBLE_ORACLE/);
 declarationExplanationCases.push({...result.stageExplanation,extraNegativeCases:['hidden-details','hidden-attribute','duplicate-visible']});
}
const declarationSupplementObservations=[
 {checkId:'stage-contract.stage02-29.roles-and-prompt-obligations',requirementRefs:[...expectedStageRoles.map(row=>row.requirementId),...promptMeanings.map(row=>row.id)],boundary:'28 independently literal workbook/contracts;24 actual ordinary external role publications;3 separately identified Stage06/16 controlling procedure meanings',scopeLimit:'Role labels/publication and three prompt obligations only. Synthetic prerequisites do not establish actor authority, gates, execution, actor compliance or full-stage/operator conformance.',expected:{roles:expectedStageRoles,promptObligations:promptMeanings.map(row=>({id:row.id,expected:row.expected}))},observed:{roles:declarationRoles,promptObligations:declarationPromptObligations},passed:true},
 {checkId:'stage-contract.stage-explanation-core-meanings',requirementRefs:declarationExplanationCases.map(row=>row.requirementId),boundary:'16 actual rendered primary This-stage explanations with specification literal/valid paraphrase controls and missing/wrong/contradictory/hidden/duplicate negatives',scopeLimit:'16 rendered explanation core meanings only; Stage17/25 operation context is separate. No proof of execution, CSS/browser visibility, frozen-set identity or complete-stage/operator conformance.',expected:declarationExplanationCases.map(row=>({requirementId:row.requirementId,stage:row.stage,expected:row.expected})),observed:declarationExplanationCases,passed:true}
];
// END BOUNDED STAGE DECLARATION SUPPLEMENT

requireFields(10,['ALL_FROZEN_COMPONENT_BYTES_HASHED']);
assert(!stage(10).fields.includes('HASHES_RECORDED_WHERE_PRACTICAL'),'Stage 10 retains obsolete best-effort hashing field');

requireFields(25,['DELIVERY_CANDIDATE_SET_ID']);
requireFields(28,['DELIVERY_CANDIDATE_SET_ID']);
requireFields(30,['PRE_DELIVERY_CHECKPOINT_ID','DELIVERY_ID','DELIVERY_STATE','DELIVERY_RECORD_HASH','DELIVERY_ATTEMPT_RECORDS']);
assert.equal(stage(30).title,'PRESERVE FAILURES PERMANENTLY AND CLOSE DELIVERY');
assert.equal(stage(30).role,'Permanent defect-registry and terminal-delivery custodian');
const verificationObservations=[
  ...declarationSupplementObservations,
  {checkId:'stage-contract.stage01.literal-role',requirementRefs:['NREQ-00589ac7ea403394eff5f3f58cd27738','specification/closed-loop-reliability-controlling-implementation-specification.txt:3384'],stage:1,boundary:'Loaded workbook -> Stage01 contract -> actual COMPLETE prompt record and published ROLE instruction',scopeLimit:'Exact Stage01 role literal and publication only; no role authority, intake semantics, acceptance, browser or full-stage completion claim.',expected:expectedStage01Role,observed:stage(1).role,publishedRole:rolePrompt.role,negativeCases:roleNegativeCases,passed:true},
  {checkId:'stage-contract.stage30.stage-name',stage:30,boundary:'Loaded workbook stage declaration',scopeLimit:'Exact Stage30 title only; no workflow completion or delivery claim.',expected:'PRESERVE FAILURES PERMANENTLY AND CLOSE DELIVERY',observed:stage(30).title,passed:true},
  {checkId:'stage-contract.stage30.role',stage:30,boundary:'Loaded workbook stage declaration',scopeLimit:'Exact Stage30 role declaration only; no custodian behavior or delivery claim.',expected:'Permanent defect-registry and terminal-delivery custodian',observed:stage(30).role,passed:true}
];

for(const number of [10,25,28,30])assertOwnershipClosed(number);

console.log(JSON.stringify({stageContractClosure:'PASS',stages:[10,25,28,30],verificationObservations},null,2));
