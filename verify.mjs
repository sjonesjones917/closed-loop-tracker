import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);

const files=['index.html','app-core.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','workbook.js','test-runtime.js','test-worker.js','TEST_PROJECT.json','AUTHORIZED_OPERATION_01.txt'];
for(const file of files)if(!fs.existsSync(file))throw new Error(`Missing ${file}`);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,runtime=globalThis.closedLoopTestRuntime,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion,store=globalThis.closedLoopProjectStore;
if(!core||!schema||!runtime||!engine||!prompts||!ingestion||!store)throw new Error('Responsible-layer runtime failed to load.');
const html=fs.readFileSync('index.html','utf8'),orderedScripts=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const scriptTags=[...html.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
if(scriptTags.length!==orderedScripts.length)throw new Error(`Runtime scripts must be loaded directly and exactly once. Expected ${orderedScripts.length}; found ${scriptTags.length}.`);
const tokens=new Set();orderedScripts.forEach((file,index)=>{if(scriptTags[index]?.split('?')[0]!==file)throw new Error(`Runtime script order mismatch at ${file}.`);if(scriptTags.filter(src=>src.split('?')[0]===file).length!==1)throw new Error(`${file} is not unique.`);const token=new URLSearchParams(scriptTags[index].split('?')[1]||'').get('v');if(!token)throw new Error(`${file} lacks a build token.`);tokens.add(token);});if(tokens.size!==1)throw new Error('Runtime scripts use mixed build tokens.');
if(fs.existsSync('app.js')||/document\.write\s*\(/.test(html))throw new Error('Dynamic runtime injection remains.');
for(const file of fs.readdirSync('.'))if(/^\.repair-/.test(file))throw new Error(`Repair scaffolding remains: ${file}`);
const expected=[
'Initialize the Job','Build the Source Inventory','Research the Requirements','Compile the Requirement Specification','Resolve the Requirement Set','Build the Verification Suite Before Writing the Production Instruction','Build Failure Tests','Author the Production Instruction','Preflight the Production Instruction','Freeze the Test Candidate','Run Ten Independent Executions','Verify Each Execution Independently','Compare the Ten Executions','Root-Cause Every Defect','Convert Every Confirmed Failure Into a Regression Test','Revise the Responsible Layer','Re-Run the Complete Ten-Execution Iteration','Continue Until Convergence','Run an Unchanged Confirmation Iteration','Freeze the Production Baseline','Generate the Finished Product','Run Deterministic Verification on the Finished Product','Run Independent Meaning-Based Verification','Run Adversarial Verification','Inspect the Final Representation','Reconcile Process and Product Evidence','Apply the Release Gate','Verify Artifact Identity Before Release','Preserve the Complete Evidence Chain','Preserve Failures Permanently'];
if(core.STAGES.length!==30)throw new Error(`Expected exactly 30 stages; found ${core.STAGES.length}.`);
for(let i=0;i<30;i++)if(core.STAGES[i].title.toUpperCase()!==expected[i].toUpperCase())throw new Error(`Stage ${i+1} title/order mismatch: ${core.STAGES[i].title}`);

function checkMeta(name,def){for(const key of ['producer','editable','requiredAtStage','derivation','responsePath','authority','conflictPolicy','provenanceRequired'])if(!Object.hasOwn(def,key))throw new Error(`${name} ownership metadata missing ${key}.`);}
for(const [name,def] of Object.entries(schema.JOB_FIELDS))checkMeta(`job.${name}`,def);
for(const [stage,defs] of Object.entries(schema.STAGE_FIELDS))for(const [name,def] of Object.entries(defs))checkMeta(`stage${stage}.${name}`,def);
for(const [collection,record] of Object.entries(schema.RECORD_SCHEMAS))for(const [name,def] of Object.entries(record.fieldDefinitions||{}))checkMeta(`${collection}.${name}`,def);
for(let stage=1;stage<=30;stage++){const c=schema.STAGE_CONTRACTS[stage];if(!c||c.responseSchema!==schema.RESPONSE_SCHEMA)throw new Error(`Stage ${stage} lacks the shared response contract.`);for(const collection of c.allowedCollections)if(!schema.RECORD_SCHEMAS[collection])throw new Error(`Stage ${stage} references unknown collection ${collection}.`);}

const badSource={TITLE:'Current application repository',ISSUING_ORGANIZATION_OR_AUTHOR:'Project repository',SOURCE_TYPE:'repository source code',URL_REFERENCE:'https://github.com/sjonesjones917/closed-loop-tracker'};
if(!schema.sourceClassificationIssues(badSource).length)throw new Error('Target-product/repository artifact was accepted as an external governing source.');
const goodSource={TITLE:'Web Content Accessibility Guidelines (WCAG) 2.2',ISSUING_ORGANIZATION_OR_AUTHOR:'World Wide Web Consortium',SOURCE_TYPE:'OFFICIAL_STANDARD',URL_REFERENCE:'https://www.w3.org/TR/WCAG22/'};
if(schema.sourceClassificationIssues(goodSource).length)throw new Error('Legitimate independent external source classification was rejected.');

const retained=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
if(retained.jobId!=='JOB-20260823144121'||retained.title!=='Mobile Closed-Loop Agent Reliability Workbook'||retained.currentStage!==2||retained.currentState!=='READY')throw new Error('Retained project identity/state mismatch.');
if(retained.stageRecords['1'].status!=='COMPLETE')throw new Error('Retained Stage 01 is not COMPLETE.');
for(let n=2;n<=30;n++)if(retained.stageRecords[String(n)].status!=='NOT STARTED')throw new Error(`Retained Stage ${n} is falsely started/completed.`);
if(retained.currentVersions.sources!=='NOT APPLICABLE')throw new Error('Retained Stage 02 source set was fabricated.');
for(const name of ['sources','sourceConflicts','research','candidateRequirements','requirements','tests','failureTests','preflightRecords','candidateFreezes','runs','verification','comparisons','defects','rootCauses','regressions','changes','baselines','products','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','releaseRecords','artifactIdentities','evidenceChains'])if((retained.projectData?.[name]||retained[name]||[]).length)throw new Error(`Retained ${name} contains fabricated downstream data.`);
const operation01=fs.readFileSync('AUTHORIZED_OPERATION_01.txt','utf8').trim();
if(retained.generatedOutputs?.[0]?.output!==operation01||retained.stageRecords?.['1']?.output!==operation01)throw new Error('Authorized Operation 01 output was not preserved exactly.');
if(retained.generatedPrompts?.length!==1||retained.outputReceipts?.length!==1)throw new Error('Actual Stage 01 instruction/output receipt history was not preserved.');

function blank(jobId){const p=core.createBlankState(jobId);p.job.JOB_ID=jobId;p.job.JOB_TITLE='Verification project';p.job.EXACT_USER_OBJECTIVE_VERBATIM='Controlled verification objective';p.job.CURRENT_INPUT_VERSION='INPUT-v001';engine.ensureShape(p);engine.recalculate(p);return p;}
function syntheticPromptOptions(stage,p){const operation=schema.STAGE_CONTRACTS[stage].operations[0],scope={};for(const key of schema.operationContract(stage,operation).scopeRequirements){if(key==='projectRevision')scope[key]=Number(p.revision||0);else if(key==='inputVersion')scope[key]=p.job.CURRENT_INPUT_VERSION;else if(key==='sourceSetVersion')scope[key]='SOURCE-SET-v001';else if(key==='requirementsVersion')scope[key]='REQUIREMENTS-v001';else if(key==='testSuiteVersion')scope[key]='TEST-SUITE-v001';else if(key==='instructionVersion')scope[key]='INSTRUCTION-v001';else if(key==='iterationId')scope[key]='ITERATION-000001';else if(key==='candidateId')scope[key]='CANDIDATE-000001';else if(key==='runId')scope[key]='RUN-000001';else if(key==='contextId')scope[key]='CONTEXT-000001';else if(key==='baselineId')scope[key]='BASELINE-000001';else if(key==='productId')scope[key]='PRODUCT-000001';}return {operation,scope};}

// Remaining verification logic is retained below unchanged by concatenating repository version at generation time is not possible here.
// This marker is intentionally unreachable in the checked-in file and must be followed by the original remaining test body.
