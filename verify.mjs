import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);

const files=['index.html','app-core.js','hash.js','workflow-schema.js','test-runtime.js','test-worker.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','workbook.js','TEST_PROJECT.json'];
for(const file of files)if(!fs.existsSync(file))throw new Error(`Missing ${file}`);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion,store=globalThis.closedLoopProjectStore;
if(!core||!schema||!engine||!prompts||!ingestion||!store)throw new Error('Responsible-layer runtime failed to load.');

const html=fs.readFileSync('index.html','utf8');
const orderedScripts=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const scriptTags=[...html.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
if(scriptTags.length!==orderedScripts.length)throw new Error('Runtime scripts must be loaded directly and exactly once.');
const tokens=new Set();
orderedScripts.forEach((file,index)=>{
  if(scriptTags[index]?.split('?')[0]!==file)throw new Error(`Runtime script order mismatch at ${file}.`);
  if(scriptTags.filter(src=>src.split('?')[0]===file).length!==1)throw new Error(`${file} is not unique.`);
  const token=new URLSearchParams(scriptTags[index].split('?')[1]||'').get('v');
  if(!token)throw new Error(`${file} lacks a build token.`);
  tokens.add(token);
});
if(tokens.size!==1)throw new Error('Runtime scripts use mixed build tokens.');
if(fs.existsSync('app.js')||/document\.write\s*\(/.test(html))throw new Error('Dynamic runtime injection remains.');
for(const file of fs.readdirSync('.'))if(/^\.repair-/.test(file))throw new Error(`Repair scaffolding remains: ${file}`);

const expected=['Initialize the Job','Build the Source Inventory','Research the Requirements','Compile the Requirement Specification','Resolve the Requirement Set','Build the Verification Suite Before Writing the Production Instruction','Build Failure Tests','Author the Production Instruction','Preflight the Production Instruction','Freeze the Test Candidate','Run Ten Independent Executions','Verify Each Execution Independently','Compare the Ten Executions','Root-Cause Every Defect','Convert Every Confirmed Failure Into a Regression Test','Correct the Root Cause','Re-Run the Complete Ten-Execution Iteration','Continue Until Convergence','Run an Unchanged Confirmation Iteration','Freeze the Production Baseline','Generate the Finished Product','Run Deterministic Verification on the Finished Product','Run Independent Meaning-Based Verification','Run Adversarial Verification','Inspect the Final Representation','Reconcile Process and Product Evidence','Apply the Release Gate','Verify Artifact Identity Before Release','Preserve the Complete Evidence Chain','Preserve Failures Permanently'];
if(core.STAGES.length!==30)throw new Error(`Expected exactly 30 stages; found ${core.STAGES.length}.`);
for(let i=0;i<30;i++)if(core.STAGES[i].title.toUpperCase()!==expected[i].toUpperCase())throw new Error(`Stage ${i+1} title/order mismatch: ${core.STAGES[i].title}`);
if(core.PROJECT_SCHEMA!=='closed-loop-project/3'||core.WORKFLOW_ID!=='mobile-closed-loop/30'||core.STAGE_COUNT!==30)throw new Error('Project/workflow identities are wrong.');
if(schema.RESPONSE_SCHEMA!=='closed-loop-stage-response/3')throw new Error('Response schema /3 is required.');

function checkMeta(name,def){for(const key of ['producer','editable','requiredAtStage','derivation','responsePath','authority','conflictPolicy','provenanceRequired'])if(!Object.hasOwn(def,key))throw new Error(`${name} ownership metadata missing ${key}.`);}
for(const [name,def] of Object.entries(schema.JOB_FIELDS))checkMeta(`job.${name}`,def);
for(const [stage,defs] of Object.entries(schema.STAGE_FIELDS))for(const [name,def] of Object.entries(defs))checkMeta(`stage${stage}.${name}`,def);
for(const [collection,record] of Object.entries(schema.RECORD_SCHEMAS)){
  for(const [name,def] of Object.entries(record.fieldDefinitions||{}))checkMeta(`${collection}.${name}`,def);
  const p=record.ownership,union=[...p.human,...p.humanDecision,...p.agent,...p.application];
  if(union.length!==record.fields.length||new Set(union).size!==record.fields.length||!record.fields.every(field=>union.includes(field)))throw new Error(`${collection} ownership must be a complete disjoint partition.`);
}
for(const stage of core.STAGES){const p=stage.ownership,union=[...p.human,...p.humanDecision,...p.agent,...p.application];if(union.length!==stage.fields.length||new Set(union).size!==stage.fields.length||!stage.fields.every(field=>union.includes(field)))throw new Error(`Stage ${stage.number} ownership must be a complete disjoint partition.`);}
for(let stage=1;stage<=30;stage++){const c=schema.STAGE_CONTRACTS[stage];if(!c||c.responseSchema!==schema.RESPONSE_SCHEMA)throw new Error(`Stage ${stage} lacks the shared response contract.`);for(const collection of c.allowedCollections)if(!schema.RECORD_SCHEMAS[collection])throw new Error(`Stage ${stage} references unknown collection ${collection}.`);}

const badSource={TITLE:'Current application repository',ISSUING_ORGANIZATION_OR_AUTHOR:'Project repository',SOURCE_TYPE:'repository source code',URL_REFERENCE:'https://github.com/sjonesjones917/closed-loop-tracker'};
if(!schema.sourceClassificationIssues(badSource).length)throw new Error('Target-product/repository artifact was accepted as independent external authority.');
const goodSource={TITLE:'Web Content Accessibility Guidelines (WCAG) 2.2',ISSUING_ORGANIZATION_OR_AUTHOR:'World Wide Web Consortium',SOURCE_TYPE:'OFFICIAL_STANDARD',URL_REFERENCE:'https://www.w3.org/TR/WCAG22/'};
if(schema.sourceClassificationIssues(goodSource).length)throw new Error('Legitimate independent external source classification was rejected.');

const retained=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
if(retained.jobId!=='JOB-20260823144121'||retained.title!=='Mobile Closed-Loop Agent Reliability Workbook'||retained.currentStage!==2||retained.currentState!=='READY')throw new Error('Retained project identity/state mismatch.');
if(retained.stageRecords['1'].status!=='COMPLETE')throw new Error('Retained Stage 01 is not COMPLETE.');
for(let n=2;n<=30;n++)if(retained.stageRecords[String(n)].status!=='NOT STARTED')throw new Error(`Retained Stage ${n} is falsely started/completed.`);
for(const name of ['sources','sourceConflicts','research','candidateRequirements','requirements','tests','failureTests','preflightRecords','candidateFreezes','runs','verification','comparisons','defects','rootCauses','regressions','changes','baselines','products','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','releaseRecords','artifactIdentities','evidenceChains'])if((retained.projectData?.[name]||retained[name]||[]).length)throw new Error(`Retained ${name} contains fabricated downstream data.`);
const retainedStage1Output=retained.generatedOutputs?.[0]?.output;
if(!retainedStage1Output||retained.stageRecords?.['1']?.output!==retainedStage1Output)throw new Error('Retained Stage 01 output history is internally inconsistent.');
if(retained.generatedPrompts?.length!==1||retained.outputReceipts?.length!==1)throw new Error('Actual Stage 01 instruction/output receipt history was not preserved.');

class MemoryStorage{constructor(seed={}){this.m=new Map(Object.entries(seed));}getItem(k){return this.m.has(k)?this.m.get(k):null;}setItem(k,v){this.m.set(k,String(v));}removeItem(k){this.m.delete(k);}clear(){this.m.clear();}}
const oldProject={job:{JOB_ID:'JOB-LEGITIMATE-USER',JOB_TITLE:'Legitimate user project'},unknownFutureField:{preserve:true}};
const storage=new MemoryStorage({'closed-loop-reliability-projects-v3':JSON.stringify([oldProject])});
const migrated=store.readAll(storage);
if(migrated.length!==1||migrated[0].unknownFutureField?.preserve!==true)throw new Error('Legacy user project was not preserved losslessly.');
const malformedLegacyKey='closed-loop-reliability-projects-v3',malformedLegacy='{\"broken\":',malformedStorage=new MemoryStorage({[malformedLegacyKey]:malformedLegacy});let malformedRejected=false;
try{store.readAll(malformedStorage);}catch(error){malformedRejected=error.code==='LEGACY_MIGRATION_PARSE_FAILED';}
if(!malformedRejected||malformedStorage.getItem(malformedLegacyKey)!==malformedLegacy)throw new Error('Malformed legacy storage was not rejected fail-closed with original bytes preserved.');
store.writeAll(migrated,storage);
if(JSON.parse(storage.getItem(store.STORE_KEY))[0].unknownFutureField?.preserve!==true)throw new Error('Canonical store discarded an unknown project field.');
const prior=storage.getItem(store.STORE_KEY);globalThis.__closedLoopStorageFault='after-final-write';let failed=false;
try{store.writeAll([{job:{JOB_ID:'JOB-OTHER'}}],storage);}catch{failed=true;}finally{delete globalThis.__closedLoopStorageFault;}
if(!failed||storage.getItem(store.STORE_KEY)!==prior)throw new Error('Transactional storage failure did not roll back exactly.');

const ingestionRun=spawnSync(process.execPath,['verify-ingestion.mjs'],{encoding:'utf8'});
if(ingestionRun.status!==0)throw new Error(`verify-ingestion.mjs failed:\n${ingestionRun.stdout}\n${ingestionRun.stderr}`);

const appSource=fs.readFileSync('app-core.js','utf8'),storeSource=fs.readFileSync('project-store.js','utf8'),engineSource=fs.readFileSync('workflow-engine.js','utf8');
if(/\bprompt\s*\(/.test(appSource))throw new Error('Browser prompt() remains in app-core canonical actions.');
if(/projectData\s*\[[^\]]+\]\s*\.push\s*\(/.test(appSource))throw new Error('Direct projectData collection push remains in app-core.');
for(const command of ['createHumanBlocker','registerFreshContext','invalidateAcceptedResponse','recordHumanDecision','freezeCandidate','freezeBaseline','reserveRunBatch','registerArtifactBytes'])if(!engineSource.includes(`function ${command}`))throw new Error(`Engine command missing ${command}.`);
for(const token of ["DB_NAME='closed-loop-reliability'",'expectedProjectRevision','BroadcastChannel','putArtifact','exportPackage','importPackage','CompressionStream','projectSha256'])if(!storeSource.includes(token))throw new Error(`Storage boundary missing ${token}.`);
if(/MutationObserver/.test(files.filter(f=>f.endsWith('.js')||f.endsWith('.html')).map(f=>fs.readFileSync(f,'utf8')).join('\n')))throw new Error('Patch-style MutationObserver remains active.');

const legacy=core.createBlankState('JOB-MIGRATION-LEGACY');legacy.schema='human-project/30';delete legacy.workflow;delete legacy.stageCount;legacy.projectData.stageRecords={1:{status:'COMPLETE',record:'legacy'}};const migratedLegacy=core.migrateState(legacy);
if(migratedLegacy.schema!==core.PROJECT_SCHEMA||migratedLegacy.workflow!==core.WORKFLOW_ID||migratedLegacy.stageCount!==30)throw new Error('Legacy schema migration did not establish current identities.');
if(migratedLegacy.projectData.stageRecords)throw new Error('Legacy stageRecords remained operational after migration.');
if(!migratedLegacy.projectData.historicalImportRecords?.some(x=>x.kind==='LEGACY_STAGE_RECORDS'))throw new Error('Legacy stageRecords were not preserved as history.');

const definition=schema.RECORD_SCHEMAS.regressions,execution=schema.RECORD_SCHEMAS.regressionExecutions;
for(const field of ['PRE_CORRECTION_RESULT','PRE_CORRECTION_EVIDENCE','POST_CORRECTION_RESULT','POST_CORRECTION_EVIDENCE']){
  if(definition.fieldDefinitions[field]?.producer!==schema.PRODUCER.APPLICATION)throw new Error(`Regression definition ${field} must be application-owned compatibility metadata.`);
  if(definition.required.includes(field))throw new Error(`Regression definition must not require ${field}; execution truth belongs to regressionExecutions.`);
}
if(execution.fieldDefinitions.PHASE?.producer!==schema.PRODUCER.AGENT||execution.fieldDefinitions.RESULT?.producer!==schema.PRODUCER.AGENT)throw new Error('Regression execution PHASE/RESULT authority is wrong.');

console.log(JSON.stringify({application:'single',stages:30,ownershipLedger:true,responseSchema:schema.RESPONSE_SCHEMA,externalSourceNonCircularity:true,retainedProject:retained.jobId,retainedStage1:'COMPLETE',retainedCurrentStage:2,legacyProjectPreservation:true,transactionRollback:true,ingestionCycle:'30/30',negativeIngestion:true},null,2));
