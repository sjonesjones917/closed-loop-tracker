import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);

const files=['index.html','app.js','app-core.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','workbook.js','TEST_PROJECT.json','AUTHORIZED_OPERATION_01.txt'];
for(const file of files)if(!fs.existsSync(file))throw new Error(`Missing ${file}`);
for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion,store=globalThis.closedLoopProjectStore;
if(!core||!schema||!engine||!prompts||!ingestion||!store)throw new Error('Responsible-layer runtime failed to load.');
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
const generated=[];
for(let stage=1;stage<=30;stage++){const p=blank(`JOB-PROMPT-${stage}`);const record=prompts.buildPromptRecord(stage,p);generated.push(record.prompt);for(const token of [`JOB_ID: ${p.job.JOB_ID}`,'PROJECT-SCOPE BOUNDARY','STRICT RESPONSE CONTRACT','closed-loop-stage-response/1','PROMPT IDENTITY — ECHO EXACTLY'])if(!record.prompt.includes(token))throw new Error(`Stage ${stage} prompt missing ${token}.`);if(stage===2&&!record.prompt.includes('genuinely independent external governing sources'))throw new Error('Stage 02 non-circular authority rule missing.');if(stage===3&&!record.prompt.includes('Research only the legitimate Stage 02 external governing source set'))throw new Error('Stage 03 external-source research boundary missing.');}
if(new Set(generated).size!==30)throw new Error('Prompts are not stage-specific.');
const pa=prompts.buildPromptRecord(2,blank('JOB-A')).prompt,pb=prompts.buildPromptRecord(2,blank('JOB-B')).prompt;if(pa.includes('JOB-B')||pb.includes('JOB-A'))throw new Error('Cross-project prompt contamination detected.');

class MemoryStorage{constructor(seed={}){this.m=new Map(Object.entries(seed));}getItem(k){return this.m.has(k)?this.m.get(k):null;}setItem(k,v){this.m.set(k,String(v));}removeItem(k){this.m.delete(k);}clear(){this.m.clear();}}
const oldProject={job:{JOB_ID:'JOB-LEGITIMATE-USER',JOB_TITLE:'Legitimate user project'},unknownFutureField:{preserve:true}};
const storage=new MemoryStorage({'closed-loop-reliability-projects-v3':JSON.stringify([oldProject])});
const migrated=store.readAll(storage);if(migrated.length!==1||migrated[0].unknownFutureField?.preserve!==true)throw new Error('Legacy user project was not preserved losslessly.');
store.writeAll(migrated,storage);if(JSON.parse(storage.getItem(store.STORE_KEY))[0].unknownFutureField?.preserve!==true)throw new Error('Canonical store discarded an unknown project field.');
const prior=storage.getItem(store.STORE_KEY);globalThis.__closedLoopStorageFault='after-final-write';let failed=false;try{store.writeAll([{job:{JOB_ID:'JOB-OTHER'}}],storage);}catch{failed=true;}finally{delete globalThis.__closedLoopStorageFault;}if(!failed||storage.getItem(store.STORE_KEY)!==prior)throw new Error('Transactional storage failure did not roll back exactly.');
const replaced=store.replaceProject(migrated,{...oldProject,job:{...oldProject.job,JOB_TITLE:'Updated'}},storage);if(replaced.length!==1||replaced[0].job.JOB_TITLE!=='Updated')throw new Error('Stable JOB_ID reconciliation duplicated a project.');

const ingestionRun=spawnSync(process.execPath,['verify-ingestion.mjs'],{encoding:'utf8'});if(ingestionRun.status!==0)throw new Error(`verify-ingestion.mjs failed:\n${ingestionRun.stdout}\n${ingestionRun.stderr}`);
const active=files.filter(f=>f.endsWith('.js')||f.endsWith('.html')).map(f=>fs.readFileSync(f,'utf8')).join('\n');
if(/MutationObserver/.test(active))throw new Error('Patch-style MutationObserver remains active.');
if(/GEN-042|field status report|maintenance[- ]handoff/i.test(active+JSON.stringify(retained)))throw new Error('Unauthorized product content remains.');
const banned=new RegExp('se'+'mantic','i');if(banned.test(active))throw new Error('Prohibited normal application terminology remains.');
console.log(JSON.stringify({application:'single',stages:30,ownershipLedger:true,responseSchema:schema.RESPONSE_SCHEMA,allStagePromptsVerified:30,externalSourceNonCircularity:true,retainedProject:retained.jobId,retainedStage1:'COMPLETE',retainedCurrentStage:2,retainedDownstreamFabricated:false,legacyProjectPreservation:true,unknownFieldRoundTrip:true,transactionRollback:true,ingestionCycle:'30/30',negativeIngestion:true},null,2));
