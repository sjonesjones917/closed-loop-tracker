const fs=require('fs');
const must=(condition,message)=>{if(!condition)throw new Error(message)};
let s=fs.readFileSync('workflow-schema.js','utf8');
// EXECUTABLE_SPEC_VERSION is APPLICATION-owned. Remove only its agent-partition occurrence.
const ownershipPattern=/("EXECUTABLE_KIND",\s*\n\s*)"EXECUTABLE_SPEC_VERSION",\s*\n(\s*"EXECUTABLE_SPEC")/;
must(ownershipPattern.test(s),'Tests ownership anchor for EXECUTABLE_SPEC_VERSION not found.');
s=s.replace(ownershipPattern,'$1$2');
// The application-computed normalized Test IR hash is a declared string field.
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
// Project-specific examples are acceptance fixtures, never runtime prompt branches.
p=p.replace(/\nFor PATENT \/ REGULATED FILING jobs,[\s\S]*?Do not turn researchable legal strategy into a human question\.\n/,'\n');
for(const forbidden of ['PATENT / REGULATED FILING','SOFTWARE / MULTI-FILE SYSTEM','BUILDING / ARCHITECTURE / AEC','PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'])must(!p.includes(forbidden),'Runtime prompt still contains project-subject branch: '+forbidden);
fs.writeFileSync('prompt-engine.js',p);

let t=fs.readFileSync('verify-prompt-semantics.mjs','utf8');
// Remove old runtime-domain expectations. Project-specific behavior belongs in fixtures, not prompt labels.
t=t.replace(/\s*if\(!record\.prompt\.includes\('STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY'\)[\s\S]*?issues\.push\('STAGE01_DOMAIN_INTAKE_BOUNDARY_MISSING'\);/,'');
t=t.replace(/\s*if\(!record\.prompt\.includes\('MANDATORY STAGE 01 HUMAN-INTAKE GATE'\)[\s\S]*?issues\.push\('STAGE01_PROACTIVE_HUMAN_INTAKE_GATE_MISSING'\);/,'');
t=t.replace(/\s*if\(!record\.prompt\.includes\('do not require the human to know those formats in advance'\)[\s\S]*?issues\.push\('STAGE01_ARTIFACT_GENERATION_BOUNDARY_MISSING'\);/,'');
t=t.replace(/\s*else if\(!record\.prompt\.includes\('ARTIFACT GENERATION VS DOWNSTREAM EXECUTION'\)[\s\S]*?issues\.push\('ENVIRONMENT_LIMIT_RULE_MISSING'\);/,'');
fs.writeFileSync('verify-prompt-semantics.mjs',t);

// Runtime tests use the controlling executable kind and understand structured next action.
for(const file of ['verify-test-runtime.mjs','verify-ingestion.mjs','verify-complete.mjs','verify-full-cycle.mjs','test-fixtures.mjs']){
  if(!fs.existsSync(file))continue;
  let x=fs.readFileSync(file,'utf8').replaceAll('CUSTOM_PIPELINE','TEST_IR');
  if(file==='verify-test-runtime.mjs')x=x.replace("const nextAction=String(engine.operationalNextAction(project,4)||'');","const nextAction=JSON.stringify(engine.operationalNextAction(project,4)||{});");
  fs.writeFileSync(file,x);
}
