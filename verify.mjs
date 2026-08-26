import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);

const files=['index.html','app-core.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','workbook.js','TEST_PROJECT.json','AUTHORIZED_OPERATION_01.txt'];
for(const file of files)if(!fs.existsSync(file))throw new Error(`Missing ${file}`);
for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion,store=globalThis.closedLoopProjectStore;
if(!core||!schema||!engine||!prompts||!ingestion||!store)throw new Error('Responsible-layer runtime failed to load.');
const html=fs.readFileSync('index.html','utf8'),orderedScripts=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const scriptTags=[...html.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
if(scriptTags.length!==orderedScripts.length)throw new Error('Runtime scripts must be loaded directly and exactly once.');
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
const generated=[];
for(let stage=1;stage<=30;stage++){
 const p=blank(`JOB-PROMPT-${stage}`),record=prompts.buildPromptRecord(stage,p),text=record.prompt;
 generated.push(text);
 for(const token of [`JOB_ID: ${p.job.JOB_ID}`,'PROJECT-SCOPE BOUNDARY','STRICT RESPONSE CONTRACT','closed-loop-stage-response/2','PROMPT IDENTITY — ECHO EXACTLY'])if(!text.includes(token))throw new Error(`Stage ${stage} prompt missing ${token}.`);
 if(stage===2){
  if(!/independent external/i.test(text)||!/authoritative|official|primary|controlling|reputable/i.test(text))throw new Error('Stage 02 independent external-source authority rule missing.');
  if(!/target product|operating application|repository/i.test(text)||!/never|prohibit|cannot|must not/i.test(text))throw new Error('Stage 02 anti-circular source boundary missing.');
 }
 if(stage===3){
  if(!/Stage 02/i.test(text)||!/accepted|current/i.test(text)||!/source/i.test(text))throw new Error('Stage 03 current accepted source-set research boundary missing.');
  if(!/target product|operating application|repository/i.test(text)||!/authority/i.test(text))throw new Error('Stage 03 anti-circular research authority boundary missing.');
 }
}
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

// Practical-100 schema/ownership contract.
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
assert(core.PROJECT_SCHEMA==='closed-loop-project/2'&&core.WORKFLOW_ID==='mobile-closed-loop/30'&&core.STAGE_COUNT===30,'Project/workflow identities must be separated.');
assert(schema.RESPONSE_SCHEMA==='closed-loop-stage-response/2','Response schema /2 is required.');
for(const stage of core.STAGES){const p=stage.ownership;const union=[...p.human,...p.humanDecision,...p.agent,...p.application];assert(union.length===stage.fields.length&&new Set(union).size===stage.fields.length&&stage.fields.every(f=>union.includes(f)),`Stage ${stage.number} ownership must be a complete disjoint partition.`);for(const def of Object.values(schema.STAGE_FIELDS[stage.number])){assert(schema.VALUE_TYPES.includes(def.valueType),'Every stage field needs a valueType.');assert(Array.isArray(def.enumValues),'Every stage field needs enumValues.');assert(Object.hasOwn(def,'nullable')&&Object.hasOwn(def,'normalizerKey'),'Every stage field needs nullability and normalizer metadata.');}}
for(const [name,def] of Object.entries(schema.RECORD_SCHEMAS)){const p=def.ownership;const union=[...p.human,...p.humanDecision,...p.agent,...p.application];assert(union.length===def.fields.length&&new Set(union).size===def.fields.length&&def.fields.every(f=>union.includes(f)),`${name} ownership must be a complete disjoint partition.`);}

// Practical-100 PR5 persistence/UI boundaries.
{
 const storeSource=fs.readFileSync('project-store.js','utf8'),appSource=fs.readFileSync('app-core.js','utf8'),engineSource=fs.readFileSync('workflow-engine.js','utf8');
 for(const token of ["DB_NAME='closed-loop-reliability'","createObjectStore(PROJECTS","createObjectStore(ARTIFACTS","createObjectStore(META",'expectedProjectRevision','BroadcastChannel','putArtifact','exportPackage','importPackage','CompressionStream','projectSha256'])if(!storeSource.includes(token))throw new Error(`PR5 storage boundary missing ${token}.`);
 if(/\bprompt\s*\(/.test(appSource))throw new Error('Browser prompt() remains in app-core canonical actions.');
 if(/projectData\s*\[[^\]]+\]\s*\.push\s*\(/.test(appSource))throw new Error('Direct projectData collection push remains in app-core.');
 for(const command of ['createHumanBlocker','registerFreshContext','invalidateAcceptedResponse','recordHumanDecision','freezeCandidate','freezeBaseline','reserveRunBatch','registerArtifactBytes'])if(!engineSource.includes(`function ${command}`))throw new Error(`Engine command missing ${command}.`);
 if(!engineSource.includes('identityAssurance'))throw new Error('PR5 engine identity assurance metadata missing.');for(const token of ['SELF_ASSERTED','MULTI_CHOICE','FILE_REFERENCE','Proposal diff','retainedBytes:true'])if(!appSource.includes(token))throw new Error(`PR5 UI boundary missing ${token}.`);
}
