import fs from 'node:fs';

const path='rebuild-self-project.mjs';
let source=fs.readFileSync(path,'utf8');

function replaceOnce(label,oldText,newText){
  if(source.includes(newText))return false;
  const count=source.split(oldText).length-1;
  if(count!==1)throw new Error(`${label}: expected exactly one original occurrence, found ${count}.`);
  source=source.replace(oldText,newText);
  return true;
}

const replacements=[
  [
    'exact user objective',
    `  exactUserObjective:'Operate the Closed-Loop Agent Reliability application itself as a complete domain-general 31-stage project and prove, through the same current project model used for arbitrary user jobs, that it preserves user intent, researches independent external authority, compiles requirements and tests, supports human, agent, and human-agent-team work, executes and verifies independently, corrects confirmed defects, audits exact product bytes, exports the project, and releases only the accepted artifact.',`,
    `  exactUserObjective:'Build and deploy the complete phone-first, domain-general Closed-Loop Agent Reliability application defined by the corrected build instruction, with the exact 31-stage workflow, strict non-circular external research, complete structured project records, first-class human and agent work ownership, independent verification and correction, exact release hashing, and a retained completed project about the application itself that remains visible in Projects.',`
  ],
  [
    'exact deliverables',
    `  exactDeliverables:'A completed in-application self-verification project; the exact current standalone HTML application; the exact current-schema JSON project export retained separately from the HTML; structured sources, findings, requirements, tests, executions, verification matrices, correction records, audits, product bytes, hashes, decision, and release evidence; and deployment of the accepted HTML and JSON to the configured GitHub Pages project URL.',`,
    `  exactDeliverables:'The complete working Closed-Loop Agent Reliability application; a completed current-schema project inside the application that is about building the application and demonstrates the same 31-stage model used by every project; the exact standalone HTML and project JSON; the required structured research, requirements, tests, execution, verification, correction, audit, hash, decision, and release evidence; and deployment of the exact accepted HTML and JSON to the configured GitHub Pages project URL.',`
  ],
  [
    'requested actions',
    `  requestedActions:'Use the application as its own demonstration job: define the complete job, inventory independently accessed external sources, research applicable requirements, compile atomic requirements, resolve conflicts, build acceptance and mutation tests, author and preflight production instructions, freeze candidates, perform the required independent execution and verification sets, compare results, root-cause and correct confirmed defects at the responsible layer, confirm convergence unchanged, generate and inspect the exact product, audit process and product, decide acceptance, verify the release hash, export the project through the application model, and release the exact accepted artifacts to the configured URL.',`,
    `  requestedActions:'Build the application defined by the corrected complete build instruction; preserve the exact 31-stage order and the separation of user job input, independent external research sources, and workflow-generated artifacts; make human, agent, human-agent-team, tool, and organization ownership available throughout the application; keep the completed application-build project visible and operable through the same project model as every other project; verify the application with real rendered execution and independent evidence; export the completed project; and deploy only the exact accepted application and project JSON to the configured GitHub Pages URL.',`
  ],
  [
    'subject and target',
    `  subjectAndTarget:'The subject and target are the Closed-Loop Agent Reliability application and its retained current-schema self-verification project, evaluated as an operational phone-first, domain-general reliability system rather than as authority for their own requirements.',`,
    `  subjectAndTarget:'The subject is the Closed-Loop Agent Reliability application. The target is the complete working phone-first, domain-general application and its retained current-schema application-build project, without treating either artifact as external authority for its own requirements.',`
  ],
  [
    'retained project name',
    `name:'CLOSED-LOOP AGENT RELIABILITY APPLICATION — COMPLETE SELF-VERIFICATION'`,
    `name:'CLOSED-LOOP AGENT RELIABILITY APPLICATION — COMPLETE BUILD'`
  ],
  [
    'human stage ownership',
    `const stages=STAGE_NAMES.map((name,index)=>({number:index+1,name,status:'COMPLETE',assignedActorType:index===0?'HUMAN_AGENT_TEAM':index===29?'TOOL':'HUMAN_AGENT_TEAM',assignedActorName:index===29?'Exact-byte SHA-256 verifier':'Application operator and independent verifier',completionEvidence:stageEvidence[index],blocker:'',startedAt:stamp,completedAt:stamp,updatedAt:stamp}));`,
    `const stages=STAGE_NAMES.map((name,index)=>({number:index+1,name,status:'COMPLETE',assignedActorType:index===0?'HUMAN':index===29?'TOOL':index===26||index===27?'HUMAN':'HUMAN_AGENT_TEAM',assignedActorName:index===0?'User and application operator':index===29?'Exact-byte SHA-256 verifier':index===26||index===27?'Independent human auditor':'Application operator and independent verifier',completionEvidence:stageEvidence[index],blocker:'',startedAt:stamp,completedAt:stamp,updatedAt:stamp}));`
  ],
  [
    'migration description',
    `migrationNote:'Retained application project rebuilt as a native current-schema whole-application self-verification project with structured records and actual rendered execution evidence.'`,
    `migrationNote:'Retained application project rebuilt as a native current-schema whole-application build project with structured records and actual rendered execution evidence.'`
  ]
];

const changed=replacements.filter(([label,oldText,newText])=>replaceOnce(label,oldText,newText)).map(([label])=>label);

for(const required of [
  `exactUserObjective:'Build and deploy the complete phone-first, domain-general Closed-Loop Agent Reliability application`,
  `requestedActions:'Build the application defined by the corrected complete build instruction`,
  `name:'CLOSED-LOOP AGENT RELIABILITY APPLICATION — COMPLETE BUILD'`,
  `assignedActorType:index===0?'HUMAN'`
]){
  if(!source.includes(required))throw new Error(`Required corrected source text is missing: ${required}`);
}

fs.writeFileSync(path,source);
console.log(JSON.stringify({status:'PASS',path,changed,projectScope:'COMPLETE_APPLICATION_BUILD',stage1Owner:'HUMAN',humanAudits:true},null,2));
