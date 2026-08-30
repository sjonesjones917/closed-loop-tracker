const fs=require('fs');
const must=(condition,message)=>{if(!condition)throw new Error(message)};
let s=fs.readFileSync('workflow-schema.js','utf8');
const ownershipPattern=/("EXECUTABLE_KIND",\s*\n\s*)"EXECUTABLE_SPEC_VERSION",\s*\n(\s*"EXECUTABLE_SPEC")/;
must(ownershipPattern.test(s),'Tests ownership anchor for EXECUTABLE_SPEC_VERSION not found.');
s=s.replace(ownershipPattern,'$1$2');
const typeAnchor="EXECUTABLE_SPEC_VERSION:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),";
must(s.includes(typeAnchor),'Test IR spec-version type metadata anchor not found.');
s=s.replace(typeAnchor,typeAnchor+"\n    EXECUTABLE_SPEC_SHA256:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),");
fs.writeFileSync('workflow-schema.js',s);

let e=fs.readFileSync('workflow-engine.js','utf8');
const actionAnchor="  if(stage===16){const correction=stage16CorrectionPlan(project);";
must(e.includes(actionAnchor),'Structured operational action anchor not found.');
e=e.replace(actionAnchor,"  if(stage===4)return {...base,heading:'Compile the requirement specification from captured canonical input',explanation:'Use the accepted Stage 01 job definition and accepted Stage 03 findings already stored for this project. Do not ask the user to resend, retype, summarize, or reattach information already captured.',primaryButton:'Use current Stage 04 instruction'};\n"+actionAnchor);
fs.writeFileSync('workflow-engine.js',e);

let p=fs.readFileSync('prompt-engine.js','utf8');
p=p.replace(/\nFor PATENT \/ REGULATED FILING jobs,[\s\S]*?Do not turn researchable legal strategy into a human question\.\n/,'\n');
for(const forbidden of ['PATENT / REGULATED FILING','SOFTWARE / MULTI-FILE SYSTEM','BUILDING / ARCHITECTURE / AEC','PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'])must(!p.includes(forbidden),'Runtime prompt still contains project-subject branch: '+forbidden);
fs.writeFileSync('prompt-engine.js',p);

let t=fs.readFileSync('verify-prompt-semantics.mjs','utf8');
t=t.replace(/\s*if\(!record\.prompt\.includes\('STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY'\)[\s\S]*?issues\.push\('STAGE01_DOMAIN_INTAKE_BOUNDARY_MISSING'\);/,'');
t=t.replace(/\s*if\(!record\.prompt\.includes\('MANDATORY STAGE 01 HUMAN-INTAKE GATE'\)[\s\S]*?issues\.push\('STAGE01_PROACTIVE_HUMAN_INTAKE_GATE_MISSING'\);/,'');
t=t.replace(/\s*if\(!record\.prompt\.includes\('do not require the human to know those formats in advance'\)[\s\S]*?issues\.push\('STAGE01_ARTIFACT_GENERATION_BOUNDARY_MISSING'\);/,'');
t=t.replace(/\s*else if\(!record\.prompt\.includes\('ARTIFACT GENERATION VS DOWNSTREAM EXECUTION'\)[\s\S]*?issues\.push\('ENVIRONMENT_LIMIT_RULE_MISSING'\);/,'');
const obsoleteSpecialist=" if(!r.prompt.includes('STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY')||!/supplied invention disclosure/.test(r.prompt)||!/supplied repository or file materials/.test(r.prompt)||!/human-supplied project location/.test(r.prompt)||!/supplied geometry\\/specifications/.test(r.prompt))throw new Error('Stage 01 specialist intake adaptation is missing.');";
must(t.includes(obsoleteSpecialist),'Obsolete Stage 01 specialist assertion not found.');
t=t.replace(obsoleteSpecialist," if(!r.prompt.includes('PROJECT-SUBJECT-NEUTRAL INTAKE SEMANTICS'))throw new Error('Stage 01 project-subject-neutral intake algorithm is missing.');\n for(const prohibited of ['PATENT / REGULATED FILING','SOFTWARE / MULTI-FILE SYSTEM','BUILDING / ARCHITECTURE / AEC','PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'])if(r.prompt.includes(prohibited))throw new Error('Stage 01 runtime prompt contains prohibited subject branch: '+prohibited);");
const practicalStart=t.indexOf('// stage01-practical-intake-regression-v1');
const practicalEnd=t.indexOf('// demonstrated-stage01-output-contract-regression-v2',practicalStart);
must(practicalStart>=0&&practicalEnd>practicalStart,'Stage 01 practical fixture block not found.');
const practical=`// stage01-practical-intake-regression-v2 — project-specific facts are fixture data, never runtime branches.
{
 const p=baseProject();
 p.job.EXACT_USER_OBJECTIVE_VERBATIM='I need a patent application for my project';
 p.job.SUPPLIED_MATERIALS_INVENTORY='MAINFRAME_INVENTION_DISCLOSURE.zip';
 const r=prompts.buildPromptRecord(1,p);
 const required=[
  'PROJECT-SUBJECT-NEUTRAL INTAKE SEMANTICS',
  'do not ask the human to re-enter facts that are already present in those materials',
  'Do not block Stage 01 merely because information will be needed by a later',
  'Stage 01 does not require every fact needed to execute later stages',
  'Stage 01 also owns proactive human intake: before finalizing Stage 01, collect the human-specific facts and decisions that are already foreseeable as necessary to achieve the requested outcome',
  'humanInputRequestContract','temporaryKey','whyRequired','affectedStageFields','answerType','allowedValues','Do not invent requestKey, required, whyNeeded, expectedAnswer',
  'I need a patent application for my project','MAINFRAME_INVENTION_DISCLOSURE.zip'
 ];
 for(const token of required)if(!r.prompt.includes(token))throw new Error('Stage 01 neutral intake/clarification contract missing: '+token);
 for(const prohibited of ['PATENT / REGULATED FILING','intended jurisdiction(s); filing-route/application-type preference','supplied invention disclosure'])if(r.prompt.includes(prohibited))throw new Error('Acceptance fixture leaked into runtime prompt: '+prohibited);
 if(r.prompt.includes('Treat any human-supplied files, links, references, records, or other materials as opaque authorized inputs'))throw new Error('Stage 01 still treats supplied human material as opaque instead of usable intake.');
}

`;
t=t.slice(0,practicalStart)+practical+t.slice(practicalEnd);
t=t.replace("if(prompts.version!=='closed-loop-prompt-engine/26')throw new Error('Persisted Stage 04 prompts were not invalidated after the canonical-input reuse repair.');","if(prompts.version!=='closed-loop-prompt-engine/28')throw new Error('Persisted prompts were not invalidated after the controlling prompt-engine repair.');");
const mutantBlock=/const mutants=\[[\s\S]*?\n\];\nfor\(const \[index,mutant\] of mutants\.entries\(\)\)\{const issues=semanticIssues\(mutant\);if\(!issues\.length\)throw new Error\(`Semantic contradiction mutation \$\{index\+1\} escaped detection\.`\);\}/;
must(mutantBlock.test(t),'Prompt semantic mutation block not found.');
t=t.replace(mutantBlock,`const mutants=[
  {...original,contextManifest:{...original.contextManifest,readCollections:{verification:[]}}},
  {...original,prompt:original.prompt.replace(\`OPERATION: \${original.operation}\`,'OPERATION: VERIFY')},
  {...original,prompt:original.prompt.replace('rejected data is not canonical','rejected data may be reused')},
  {...original,prompt:original.prompt.replace('HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE','HUMAN COLLABORATION MODE REMOVED')},
  {...original,promptEngineVersion:'closed-loop-prompt-engine/obsolete'},
  {...original,prompt:original.prompt.replace(\`INSTRUCTION_ID: \${original.instructionId}\`,'INSTRUCTION_ID: WRONG')},
  {...original,prompt:original.prompt.replace(\`BODY_SHA256: \${original.bodySha256}\`,'BODY_SHA256: WRONG')},
  {...original,prompt:original.prompt.replace('PROJECT-SUBJECT-NEUTRAL','PROJECT-SUBJECT-SPECIFIC')},
  {...original,prompt:original.prompt.replace('Never claim that a web search, repository edit, build, test, CAD operation, simulation, CNC post-processing step, physical measurement, fabrication, filing, submission, or other external action occurred unless it actually occurred','Assume external actions occurred when useful')}
];
for(const [index,mutant] of mutants.entries()){const issues=semanticIssues(mutant);if(!issues.length)throw new Error(\`Semantic contradiction mutation \${index+1} escaped detection.\`);}`);
fs.writeFileSync('verify-prompt-semantics.mjs',t);

for(const file of ['verify-test-runtime.mjs','verify-ingestion.mjs','verify-complete.mjs','verify-full-cycle.mjs','test-fixtures.mjs']){
  if(!fs.existsSync(file))continue;
  let x=fs.readFileSync(file,'utf8').replaceAll('CUSTOM_PIPELINE','TEST_IR');
  if(file==='verify-test-runtime.mjs')x=x.replace("const nextAction=String(engine.operationalNextAction(project,4)||'');","const nextAction=JSON.stringify(engine.operationalNextAction(project,4)||{});");
  fs.writeFileSync(file,x);
}
