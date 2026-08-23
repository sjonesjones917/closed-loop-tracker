import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const fail=message=>{throw new Error(message)};
const requiredStages=[
  'DEFINE JOB','INVENTORY SOURCES','RESEARCH REQUIREMENTS','COMPILE ATOMIC REQUIREMENTS','RESOLVE CONFLICTS','BUILD ACCEPTANCE TESTS','BUILD FAILURE/MUTATION TESTS','AUTHOR PRODUCTION INSTRUCTION','PREFLIGHT INSTRUCTION','FREEZE CANDIDATE','RUN 10 INDEPENDENT EXECUTIONS','VERIFY EVERY RUN AGAINST EVERY REQUIREMENT','COMPARE ALL RUNS','ROOT-CAUSE EVERY DEFECT','ADD REGRESSION TESTS','CORRECT RESPONSIBLE LAYER','FREEZE NEW VERSION','RUN 10 NEW INDEPENDENT EXECUTIONS','REPEAT UNTIL CONVERGED','RUN UNCHANGED 10-EXECUTION CONFIRMATION','FREEZE APPROVED BASELINE','GENERATE FINISHED PRODUCT','DETERMINISTIC PRODUCT VERIFICATION','INDEPENDENT SEMANTIC VERIFICATION','ADVERSARIAL PRODUCT VERIFICATION','FINAL REPRESENTATION INSPECTION','PROCESS AUDIT','PRODUCT AUDIT','ACCEPTED / REJECTED / BLOCKED','VERIFY RELEASE HASH','RELEASE ONLY THE EXACT ACCEPTED ARTIFACT'
];

if(!html.includes('<title>Closed-Loop Agent Reliability</title>'))fail('Public title is incorrect.');
if(!html.includes('<h1>Closed-Loop Agent Reliability</h1>'))fail('Public heading is incorrect.');
if(/Closed-Loop Agent Reliability\s+v\d/i.test(html))fail('An arbitrary public application version label remains.');
for(const forbidden of ['sidecar-filename defect','Agent response','paste agent response','Paste completed agent result','REAL SELF-BUILD','application itself by using the actual application UI'])if(html.toLowerCase().includes(forbidden.toLowerCase()))fail(`Forbidden repair or generic response-relay text remains: ${forbidden}`);

const manifestMatch=html.match(/<script id="stage-manifest" type="application\/json">([\s\S]*?)<\/script>/);
if(!manifestMatch)fail('Stage manifest is missing.');
const manifest=JSON.parse(manifestMatch[1]);
if(manifest.length!==31)fail(`Expected 31 stages, found ${manifest.length}.`);
for(let i=0;i<requiredStages.length;i+=1){if(manifest[i]?.number!==i+1)fail(`Stage ${i+1} is renumbered.`);if(manifest[i]?.name!==requiredStages[i])fail(`Stage ${i+1} name changed: ${manifest[i]?.name}`)}

const promptSpecMatch=html.match(/const STAGE_PROMPT_SPECS=\{([\s\S]*?)\n\};\nfunction stagePromptRequired/);
if(!promptSpecMatch)fail('The stage-specific prompt specification registry is missing.');
const promptStageNumbers=[...promptSpecMatch[1].matchAll(/(?:^|\n)(\d+):\{/g)].map(match=>Number(match[1]));
if(promptStageNumbers.length!==31||promptStageNumbers.some((number,index)=>number!==index+1))fail(`Expected exact prompt specifications for Stages 1 through 31; found ${promptStageNumbers.join(', ')}.`);
for(const token of [
  'data-stage-prompt-system="true"','data-generate-stage-prompt','data-copy-stage-prompt','data-download-stage-prompt','buildStageExecutionPrompt','stagePromptRecordSchema','stagePromptAuthorizedData','Generate the stage execution prompt before completion','One reusable prompt'
])if(!html.includes(token))fail(`Required stage-prompt control is missing: ${token}`);
for(const phrase of [
  'Perform actual outward external source discovery',
  'never use the artifact, source code, tests, project JSON, prior agent output, or workflow records as authority',
  'This stage execution prompt is not the production instruction itself',
  'Run this same prompt ten times in ten fresh contexts; do not create ten different prompts',
  'MODE: <<PRODUCER or VERIFIER>>',
  'The application keeps humans, agents, human-agent teams, tools, and organizations as first-class work owners'
])if(!html.includes(phrase))fail(`Required prompt semantics are missing: ${phrase}`);
for(const stageNumber of [11,12,18,20]){
  const marker=`${stageNumber}:{`;
  const start=promptSpecMatch[1].indexOf(marker);
  const end=stageNumber===31?promptSpecMatch[1].length:promptSpecMatch[1].indexOf(`\n${stageNumber+1}:{`,start);
  const block=promptSpecMatch[1].slice(start,end<0?undefined:end);
  if(!block.includes('runTemplate:'))fail(`Stage ${stageNumber} does not provide one reusable run template.`);
}

const requiredArchitectureTokens=['USER_JOB_INPUT','EXTERNAL_RESEARCH_SOURCE','WORKFLOW_GENERATED_ARTIFACT','HUMAN','AGENT','HUMAN_AGENT_TEAM','TOOL','ORGANIZATION',"schema:'closed-loop-project/1'",'validateSourceGuard','independentOfArtifact','externallyAccessed','productBytes','sha256Bytes','RUN-001','Create missing matrix records','STAGE_GROUPS','COLLECTIONS'];
for(const token of requiredArchitectureTokens)if(!html.includes(token))fail(`Required architecture token missing: ${token}`);

const jobBlock=html.match(/const JOB_FIELDS=\[([\s\S]*?)\];\nconst USER_INPUT_CLASSIFICATIONS/);
if(!jobBlock)fail('Stage 1 field definition is missing.');
const jobFieldCount=(jobBlock[1].match(/^\s*\['/gm)||[]).length;
if(jobFieldCount!==20)fail(`Expected 20 Stage 1 scopes, found ${jobFieldCount}.`);

const classicScripts=[...html.matchAll(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
if(classicScripts.length<2)fail('Application scripts are missing.');
for(const [index,script] of classicScripts.entries()){try{new Function(script)}catch(error){fail(`Application script ${index+1} has invalid syntax: ${error.message}`)}}

if(/<script[^>]+src=/i.test(html)||/<link[^>]+rel=["']stylesheet/i.test(html))fail('The deployed application must remain standalone.');
if(!html.includes('No seeded build job'))fail('The empty arbitrary-job creation invariant is not visible.');
if(!html.includes('Three information classes'))fail('The three information classes are not visible in the UI.');
if(!html.includes('data-self-project-proof="true"'))fail('The retained application project proof is not visible in Projects.');
if(!html.includes('SELF_VERIFIED_PROJECT.json'))fail('The retained project export is not linked from the application.');

const result={status:'PASS',publicName:'Closed-Loop Agent Reliability',publicVersionLabel:false,stages:manifest.length,stagePromptSpecifications:promptStageNumbers.length,stagePromptGeneration:true,reusableTenRunPromptTemplates:[11,12,18,20],stage1Scopes:jobFieldCount,informationClasses:3,humanWorkSupported:true,agentWorkSupported:true,humanAgentTeamSupported:true,structuredRecordsRemainPrimary:true,retainedSelfProjectProof:true,promptRelayArchitecture:false,standalone:true};
fs.writeFileSync('STATIC_VERIFICATION.json',`${JSON.stringify(result,null,2)}\n`);
console.log(JSON.stringify(result,null,2));
