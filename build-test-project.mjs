import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import './build-test-project-impl.mjs';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);

const required=['index.html','app-core.js','hash.js','workflow-schema.js','test-runtime.js','test-worker.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','workbook.js','TEST_PROJECT.json','verify.mjs','verify-live.mjs','verify-browser.mjs','verify-ingestion.mjs','verify-spec-grounded-route-oracle.mjs'];
for(const file of required)if(!fs.existsSync(file))throw new Error(`Missing ${file}`);
const retired=['authority-guard.js','integrity-guard.js','storage-reliability.js','prompt-display.js','experience.js','usability.js'];
for(const file of retired)if(fs.existsSync(file))throw new Error(`Obsolete runtime wrapper remains: ${file}`);
for(const file of fs.readdirSync('.'))if(/^\.repair-/.test(file))throw new Error(`One-time repair scaffolding remains: ${file}`);
if(fs.existsSync('.github/workflows'))for(const file of fs.readdirSync('.github/workflows'))if(/repair/i.test(file))throw new Error(`Temporary repair workflow remains: ${file}`);

const project=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
if(project.schema!=='human-project/30')throw new Error(`Unexpected project schema ${project.schema}`);
if(project.jobId!=='JOB-20260823144121'||project.title!=='Mobile Closed-Loop Agent Reliability Workbook')throw new Error('Authorized retained project identity is wrong.');
if(Object.keys(project.stageRecords||{}).length!==30)throw new Error('Retained project must contain exactly 30 stage records.');
if(project.stageRecords?.['1']?.status!=='COMPLETE'||project.currentStage!==2||project.currentState!=='READY')throw new Error('Retained project must preserve completed Stage 01 and current Stage 02 READY state.');
for(let n=2;n<=30;n++)if(project.stageRecords?.[String(n)]?.status!=='NOT STARTED')throw new Error(`Stage ${n} must remain NOT STARTED.`);
if(project.currentVersions?.sources!=='NOT APPLICABLE')throw new Error('Stage 02 source set must remain NOT APPLICABLE until substantive Stage 02 work occurs.');
for(const name of ['sources','sourceConflicts','research','candidateRequirements','requirements','tests','failureTests','preflightRecords','candidateFreezes','runs','verification','comparisons','defects','rootCauses','regressions','changes','baselines','products','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','releaseRecords','artifactIdentities','evidenceChains'])if((project.projectData?.[name]||project[name]||[]).length)throw new Error(`${name} contains fabricated downstream project data.`);

const html=fs.readFileSync('index.html','utf8'),app=fs.readFileSync('app-core.js','utf8'),prompts=fs.readFileSync('prompt-engine.js','utf8'),schema=fs.readFileSync('workflow-schema.js','utf8'),ingestion=fs.readFileSync('response-ingestion.js','utf8');
if((html.match(/<html\b/gi)||[]).length!==1)throw new Error('Exactly one application shell is required.');
const orderedScripts=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const scriptTags=[...html.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
if(scriptTags.length!==orderedScripts.length)throw new Error(`Expected ${orderedScripts.length} direct deferred runtime scripts; found ${scriptTags.length}.`);
const buildTokens=new Set();
orderedScripts.forEach((file,index)=>{const matches=scriptTags.filter(src=>src.split('?')[0]===file);if(matches.length!==1)throw new Error(`${file} must occur exactly once in index.html.`);if(scriptTags[index].split('?')[0]!==file)throw new Error(`Runtime script order is wrong at ${file}.`);const token=new URLSearchParams(scriptTags[index].split('?')[1]||'').get('v');if(!token)throw new Error(`${file} is missing the shared build token.`);buildTokens.add(token);});
if(buildTokens.size!==1)throw new Error('Runtime scripts do not use one shared build token.');
if(fs.existsSync('app.js')||/document\.write\s*\(/.test(html))throw new Error('Dynamic loader app.js/document.write remains.');
for(const retiredToken of ['authority-guard.js','integrity-guard.js','storage-reliability.js','prompt-display.js','experience.js','usability.js'])if(html.includes(retiredToken))throw new Error(`Obsolete runtime layer is still loaded: ${retiredToken}`);
for(const token of ['closed-loop-stage-response/3','PRODUCER','STAGE_CONTRACTS','sourceClassificationIssues','HUMAN_INTAKE_FIELDS'])if(!schema.includes(token))throw new Error(`Ownership/response schema control missing: ${token}`);
for(const token of ['strictParse','validateEnvelope','PENDING_OPERATOR_REVIEW','ACCEPTED_DATA_CHANGE','extractionManifests','answerHumanInput'])if(!ingestion.includes(token))throw new Error(`Transactional ingestion control missing: ${token}`);
for(const token of ['MANDATORY RESPONSE RULES','PROJECT-SCOPE BOUNDARY','independent external sources','EXTERNAL_CHAT_LAUNCHER','promptCanonicalPath'])if(!prompts.includes(token))throw new Error(`Canonical prompt contract missing: ${token}`);
for(const forbidden of ['PROMPT IDENTITY — ECHO EXACTLY','END COPY BLOCK — STAGE','END HASHED INSTRUCTION BODY'])if(prompts.includes(forbidden))throw new Error(`Authoritative prompt source still contains digest-dependent or clipboard wrapper: ${forbidden}`);
for(const token of ['Stage and validate response file','Proposed extracted changes','Accept response','Reject response','Request correction','Human-owned stage input','Application-derived job control'])if(!app.includes(token))throw new Error(`Human-facing ingestion UI missing: ${token}`);
if(/MutationObserver/.test(html+app+prompts+schema+ingestion))throw new Error('Patch-style MutationObserver behavior remains in the active application.');
const activeSource=html+app+prompts+schema+ingestion+fs.readFileSync('workflow-engine.js','utf8')+fs.readFileSync('project-store.js','utf8')+fs.readFileSync('workbook.js','utf8')+fs.readFileSync('test-runtime.js','utf8')+fs.readFileSync('test-worker.js','utf8');
if(/GEN-042|field status report|maintenance[- ]handoff/i.test(activeSource+JSON.stringify(project)))throw new Error('Unauthorized product interpretation remains active.');
if(/human-project\/31|31 operations|Stage 31|Operation 31/i.test(activeSource))throw new Error('A prohibited Stage/Operation 31 remains.');

for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
if(globalThis.closedLoopCore?.STAGES?.length!==30)throw new Error('Runtime workflow does not contain exactly 30 stages.');
if(globalThis.closedLoopWorkflowSchema?.RESPONSE_SCHEMA!=='closed-loop-stage-response/3')throw new Error('Runtime response schema is wrong.');

// Run the independent specification-side route ruler in a clean process so production declarations cannot serve as their own oracle.
execFileSync(process.execPath,['verify-spec-grounded-route-oracle.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['verify-stage03-source-research.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['verify-semantic-operation-boundaries.mjs'],{stdio:'inherit'});

console.log(JSON.stringify({singleApplicationShell:true,stages:30,retainedJobId:project.jobId,currentStage:2,stage1:'COMPLETE',downstreamFabricated:false,responseSchema:'closed-loop-stage-response/3',obsoleteRuntimeWrappers:false,specGroundedRouteOracle:true},null,2));
