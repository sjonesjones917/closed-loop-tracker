import fs from 'node:fs';
import crypto from 'node:crypto';

const fail=message=>{throw new Error(message)};
const projectBytes=fs.readFileSync('SELF_VERIFIED_PROJECT.json');
const project=JSON.parse(projectBytes.toString('utf8'));
const htmlBytes=fs.readFileSync('index.html');
const html=htmlBytes.toString('utf8');
const manifestMatch=html.match(/<script id="stage-manifest" type="application\/json">([\s\S]*?)<\/script>/);
if(!manifestMatch)fail('Current application stage manifest is missing.');
const appStages=JSON.parse(manifestMatch[1]);
const exactStages=['DEFINE JOB','INVENTORY SOURCES','RESEARCH REQUIREMENTS','COMPILE ATOMIC REQUIREMENTS','RESOLVE CONFLICTS','BUILD ACCEPTANCE TESTS','BUILD FAILURE/MUTATION TESTS','AUTHOR PRODUCTION INSTRUCTION','PREFLIGHT INSTRUCTION','FREEZE CANDIDATE','RUN 10 INDEPENDENT EXECUTIONS','VERIFY EVERY RUN AGAINST EVERY REQUIREMENT','COMPARE ALL RUNS','ROOT-CAUSE EVERY DEFECT','ADD REGRESSION TESTS','CORRECT RESPONSIBLE LAYER','FREEZE NEW VERSION','RUN 10 NEW INDEPENDENT EXECUTIONS','REPEAT UNTIL CONVERGED','RUN UNCHANGED 10-EXECUTION CONFIRMATION','FREEZE APPROVED BASELINE','GENERATE FINISHED PRODUCT','DETERMINISTIC PRODUCT VERIFICATION','INDEPENDENT SEMANTIC VERIFICATION','ADVERSARIAL PRODUCT VERIFICATION','FINAL REPRESENTATION INSPECTION','PROCESS AUDIT','PRODUCT AUDIT','ACCEPTED / REJECTED / BLOCKED','VERIFY RELEASE HASH','RELEASE ONLY THE EXACT ACCEPTED ARTIFACT'];
if(appStages.length!==31)fail('Current application does not contain exactly 31 stages.');
appStages.forEach((stage,index)=>{if(stage.number!==index+1||stage.name!==exactStages[index])fail(`Current application stage ${index+1} does not match the required workflow.`)});
if(project.schema!=='closed-loop-project/1')fail('Completed application project is not in the current application project schema.');
if(!Array.isArray(project.stages)||project.stages.length!==31)fail('Completed application project must contain exactly 31 stages.');
project.stages.forEach((stage,index)=>{if(stage.number!==index+1||stage.name!==exactStages[index])fail(`Completed application project stage ${index+1} does not match the application workflow.`);if(stage.status!=='COMPLETE')fail(`Completed application project stage ${index+1} is not COMPLETE.`)});
if(!project.stages.some(stage=>stage.assignedActorType==='HUMAN'||stage.assignedActorType==='HUMAN_AGENT_TEAM'))fail('Completed application project does not preserve human work ownership.');

const stage1=String(project.stages[0]?.completionEvidence||'');
const stage2=String(project.stages[1]?.completionEvidence||'');
const objective=String(project.job?.exactUserObjective||'');
const deliverable=String(project.job?.exactDeliverables||'');
const requestedActions=String(project.job?.requestedActions||'');
const name=String(project.name||'');
if(!/Closed-Loop Agent Reliability application/i.test(name+' '+objective+' '+deliverable))fail('Completed application project is not about the complete application itself.');
if(!/domain-general/i.test(objective))fail('Completed application project objective is not domain-general.');
if(!/31-stage/i.test(objective+' '+stage1))fail('Completed application project does not preserve the complete 31-stage scope.');
if(!/Build, verify, release, and deploy the complete phone-first, domain-general Closed-Loop Agent Reliability application/i.test(requestedActions))fail('Requested actions do not describe the complete application build.');
if(!/retain and export the completed application project/i.test(requestedActions))fail('Requested actions do not preserve the completed in-application proof project.');

const narrative=JSON.stringify({name:project.name,job:project.job,stages:project.stages,workflowArtifacts:project.workflowArtifacts,executions:project.executions,verificationRecords:project.verificationRecords,comparisons:project.comparisons,defects:project.defects,regressionTests:project.regressionTests,corrections:project.corrections,convergenceCycles:project.convergenceCycles,baselines:project.baselines,products:project.products,processAudits:project.processAudits,productAudits:project.productAudits,decisions:project.decisions,releases:project.releases});
if(/\bv13\b|version 13|sidecar-filename defect|implementation-history defect|first-candidate sidecar|repair-task tracker|narrow implementation-history tracker|fix stage/i.test(narrative))fail('Completed application project still contains version/repair scope drift.');
if(/Modify the existing .* application rather than substitute another product/i.test(requestedActions))fail('Requested actions still frame the project as modifying an invented version.');
if(!/REQUESTED ACTIONS:/i.test(stage1))fail('Stage 1 is missing requested actions.');
if(!/USER JOB INPUT/i.test(stage1)||!/EXTERNAL RESEARCH SOURCES/i.test(stage1)||!/WORKFLOW-GENERATED ARTIFACTS/i.test(stage1))fail('Stage 1 does not preserve all three information classes.');
if(!/EXTERNAL_SEARCH_PERFORMED\s*:\s*true/i.test(stage2))fail('Stage 2 does not record actual external research.');
if(/SOURCE_TYPE\s*:\s*(APPLICATION_FILE|GENERATED_FILE|WORK_PRODUCT|PROJECT_JSON|HTML|JAVASCRIPT)\b/i.test(stage2))fail('Stage 2 uses an internal work product as external authority.');

const executionCounts=new Map();
for(const record of project.executions||[])executionCounts.set(Number(record.stageNumber),(executionCounts.get(Number(record.stageNumber))||0)+1);
const verificationCounts=new Map();
for(const record of project.verificationRecords||[])verificationCounts.set(Number(record.stageNumber),(verificationCounts.get(Number(record.stageNumber))||0)+1);
for(const stageNumber of [11,18,20])if((executionCounts.get(stageNumber)||0)<10)fail(`Stage ${stageNumber} must retain at least 10 independent execution records.`);
for(const stageNumber of [12,19,20])if((verificationCounts.get(stageNumber)||0)<10)fail(`Stage ${stageNumber} must retain at least 10 independent verifier records.`);

const metadata=project.legacyProjectMetadata||{};
if(metadata.releaseDecision!=='ACCEPTED')fail('Completed application project release decision is not ACCEPTED.');
if(!/^[0-9a-f]{64}$/i.test(String(metadata.auditedHash||'')))fail('Completed application project audited hash is invalid.');
if(metadata.auditedHash!==metadata.releaseHash)fail('Completed application project audited and release hashes differ.');
if(html.includes(project.projectId)||html.includes(stage1.slice(0,120)))fail('Completed application project state is embedded in the application HTML.');
if(!html.includes('SELF_VERIFIED_PROJECT.json'))fail('Application does not expose the completed application project JSON.');
if(!html.includes('data-retained-project-bootstrap="true"'))fail('Application does not contain the persistent native-project bootstrap.');
if(!html.includes('data-retained-application-project'))fail('Application does not protect and identify the retained native project.');

const appSha256=crypto.createHash('sha256').update(htmlBytes).digest('hex');
const projectSha256=crypto.createHash('sha256').update(projectBytes).digest('hex');
console.log(JSON.stringify({status:'PASS',completedApplicationProject:true,currentSchema:true,aboutCompleteApplication:true,scopeDriftAbsent:true,humanWorkPreserved:true,stageWorkflowMatchesCurrentApp:true,persistentNativeBootstrap:true,stages:31,appSha256,projectSha256},null,2));
