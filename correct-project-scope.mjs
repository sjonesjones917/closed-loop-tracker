import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const PUBLIC_NAME='Closed-Loop Agent Reliability';
const PROJECT_NAME='CLOSED-LOOP AGENT RELIABILITY APPLICATION — COMPLETE BUILD';
const OLD_PROJECT_NAME='REAL SELF-BUILD — CLOSED-LOOP RELIABILITY V13';
const OBJECTIVE="Build, verify, release, and deploy one phone-first, domain-general Closed-Loop Agent Reliability application that accepts an arbitrary user job and drives it through the exact 31-stage forward pipeline from lossless user intent through independent external research, external authority, atomic requirements, tests, production, independent verification, correction, acceptance, release-hash verification, and release, while keeping user job input, external research sources, and workflow-generated artifacts strictly separate and prohibiting circular authority.";
const OLD_OBJECTIVE="Create, verify, and release the Closed-Loop Agent Reliability v13 application itself by using the actual application UI from an empty project through every one of the 31 sequential operations. The released application must automatically load and display the exact project JSON exported through the app's visible Export this project control after this run; the project must not be hardcoded into the HTML.";
const DELIVERABLE="A working deployed Closed-Loop Agent Reliability web application at https://sjonesjones917.github.io/closed-loop-tracker/; the exact standalone UTF-8 release HTML; the exact project JSON exported through the application's visible Export this project control and automatically reloaded as a separate sidecar; and reproducible browser, process, audit, and SHA-256 evidence establishing the complete 31-stage workflow, the required independent execution and verification cycles, an ACCEPTED decision, and byte-identical release.";
const OLD_DELIVERABLE="The exact standalone HTML file app-v13.html, the exact UI-downloaded SELF_VERIFIED_PROJECT.json project export, and reproducible browser evidence showing 31/31 stages complete, 30 producer responses, 30 verifier responses, a real candidate defect and correction, an ACCEPTED decision, and exact audited/release hash identity.";
const INPUTS='The complete user-issued application build instruction; the existing repository implementation as an EXISTING_WORK_PRODUCT to be corrected only after independent requirements are established; the exact 31-stage names and order; GitHub Pages deployment at https://sjonesjones917.github.io/closed-loop-tracker/; browser automation; external research capability; visible project import/export controls; SHA-256; and reproducible evidence tooling.';
const OLD_INPUTS='Actual inputs: app-v11.html; build-v13-self.mjs; self-browser-e2e.mjs; self-e2e-agent.mjs; generated app-v13-candidate1.html; generated app-v13.html; system Chromium; SHA-256; GitHub Actions; visible app export and download controls.';
const CONSTRAINTS='Implement the complete domain-general application, not a repair-task tracker or a narrow self-test. Preserve exactly the 31 stage numbers, names, and order. Keep USER JOB INPUT, EXTERNAL RESEARCH SOURCES, and WORKFLOW-GENERATED ARTIFACTS separate. Never use the product, its code, tests, generated project state, candidates, or prior workflow conclusions as authority for its own requirements. Start real projects at 0/31, require actual completed responses, preserve independent producer/verifier execution, keep completed project state outside the HTML, remain phone-first, and release only exact accepted bytes after audit and hash equality. Do not invent a public application version merely because defects were corrected.';
const OLD_CONSTRAINTS='No hardcoded completed project. No skipped stage. Every required standard, producer, and verifier field must receive an actual completed external-process response. The first candidate must be tested with a real sidecar filename defect, corrected, rerun, confirmed unchanged, audited, and released only when exact hashes match.';
const PUBLISHED_PROJECT_META=`<meta name="closed-loop-published-project" content="${PROJECT_NAME}">`;

const args=new Set(process.argv.slice(2));
const generatedOnly=args.has('--generated-only');

function writeIfChanged(file,next){
  const current=fs.readFileSync(file,'utf8');
  if(current!==next)fs.writeFileSync(file,next);
}
function replaceSupported(text,oldValue,newValue,label){
  if(text.includes(oldValue))return text.replaceAll(oldValue,newValue);
  if(text.includes(newValue))return text;
  throw new Error(`${label} anchor missing`);
}
function patchBuilderOriginParser(){
  const file='build-v13-self.mjs';
  let s=fs.readFileSync(file,'utf8');
  const oldPattern='/(?:^|\\\\n)\\\\s*ORIGIN\\\\s*[:=]\\\\s*([A-Z_]+)/gim';
  const correctedPattern='/\\\\bORIGIN\\\\s*[:=]\\\\s*([A-Z_]+)/gim';
  if(s.includes(oldPattern))s=s.replaceAll(oldPattern,correctedPattern);
  const correctedCount=s.split(correctedPattern).length-1;
  if(correctedCount<2)throw new Error(`build-v13-self.mjs origin parser correction incomplete: found ${correctedCount}, expected at least 2`);
  writeIfChanged(file,s);
}
function patchGenerated(file){
  if(!fs.existsSync(file))return;
  let s=fs.readFileSync(file,'utf8');
  s=s.replaceAll('<title>Closed-Loop Reliability v13</title>','<title>Closed-Loop Reliability</title>');
  s=s.replaceAll('<h1>Closed-Loop Agent Reliability v13</h1>','<h1>Closed-Loop Agent Reliability</h1>');
  s=s.replaceAll(OLD_PROJECT_NAME,PROJECT_NAME);
  if(!s.includes(PROJECT_NAME)){
    if(!s.includes('</head>'))throw new Error(`${file} head closing tag missing`);
    s=s.replace('</head>',`${PUBLISHED_PROJECT_META}\n</head>`);
  }
  writeIfChanged(file,s);
}
function patchReadme(){
  const file='README.md';
  if(!fs.existsSync(file))return;
  let s=fs.readFileSync(file,'utf8');
  s=s.replaceAll('Closed-Loop Agent Reliability v13','Closed-Loop Agent Reliability');
  s=s.replaceAll('- Keeps the application identity at v13; correcting an implementation defect does not create an arbitrary new application version.','- Exposes no arbitrary public application version; workflow candidate identifiers are provenance records only.');
  writeIfChanged(file,s);
}
function patchBrowser(){
  const file='self-browser-e2e.mjs';
  let s=fs.readFileSync(file,'utf8');
  s=replaceSupported(s,OLD_OBJECTIVE,OBJECTIVE,'browser objective');
  s=replaceSupported(s,OLD_DELIVERABLE,DELIVERABLE,'browser deliverable');
  s=replaceSupported(s,OLD_INPUTS,INPUTS,'browser inputs');
  s=replaceSupported(s,OLD_CONSTRAINTS,CONSTRAINTS,'browser constraints');
  s=s.replaceAll(OLD_PROJECT_NAME,PROJECT_NAME);
  s=s.replaceAll('/REAL SELF-BUILD/','/CLOSED-LOOP AGENT RELIABILITY APPLICATION/');
  writeIfChanged(file,s);
}
function patchAgentBase(){
  const file='self-e2e-agent-base.mjs';
  let s=fs.readFileSync(file,'utf8');
  s=replaceSupported(s,OLD_OBJECTIVE,OBJECTIVE,'agent objective');
  s=replaceSupported(s,OLD_DELIVERABLE,DELIVERABLE,'agent deliverable');
  s=s.replaceAll('Closed-Loop Agent Reliability v13','Closed-Loop Agent Reliability');
  s=s.replaceAll('phone-first v13 app','phone-first domain-general Closed-Loop Agent Reliability application');
  s=s.replaceAll('exact v13 production package','approved production package');
  s=s.replaceAll('the v13 production package','the production package');
  s=s.replaceAll('build a standalone phone-first v13 app','build a standalone phone-first domain-general Closed-Loop Agent Reliability application');
  writeIfChanged(file,s);
}
function patchRunner(){
  const file='run-v13-self-e2e.mjs';
  let s=fs.readFileSync(file,'utf8');
  const anchor="const replayPatch=spawnSync(process.execPath,['v13-state-replay.mjs'],{encoding:'utf8',stdio:'inherit'});\nif(replayPatch.status!==0)process.exit(replayPatch.status??1);";
  const addition=`${anchor}\nconst scopeCorrection=spawnSync(process.execPath,['correct-project-scope.mjs','--generated-only'],{encoding:'utf8',stdio:'inherit'});\nif(scopeCorrection.status!==0)process.exit(scopeCorrection.status??1);`;
  if(!s.includes('const scopeCorrection=spawnSync')){
    if(!s.includes(anchor))throw new Error('run wrapper scope-correction anchor missing');
    s=s.replace(anchor,addition);
  }
  s=s.replaceAll(OLD_PROJECT_NAME,PROJECT_NAME);
  s=s.replaceAll('The existing v13 app does not permanently use SELF_VERIFIED_PROJECT.json for its visible self-project export.','The application does not permanently use SELF_VERIFIED_PROJECT.json for the visible complete-build project export.');
  writeIfChanged(file,s);
}

patchBuilderOriginParser();
if(!generatedOnly){
  patchBrowser();
  patchRunner();
}
patchAgentBase();
patchReadme();
for(const file of ['app-v13-candidate1.html','app-v13.html','index.html'])patchGenerated(file);

const syntaxFiles=generatedOnly?['self-e2e-agent-base.mjs']:['self-browser-e2e.mjs','self-e2e-agent-base.mjs','run-v13-self-e2e.mjs'];
for(const file of syntaxFiles){
  if(fs.existsSync(file)){
    const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    if(result.status!==0)throw new Error(`${file} syntax failure: ${result.stderr||result.stdout}`);
  }
}
console.log(JSON.stringify({status:'PROJECT_SCOPE_CORRECTED',publicName:PUBLIC_NAME,projectName:PROJECT_NAME,generatedOnly,publicVersionLabelRemoved:true,objectiveScope:'DOMAIN_GENERAL_COMPLETE_APPLICATION_BUILD',agentBaseReappliedAfterBuild:true,publishedProjectMetadata:true,originParserMatchesAnywhere:true,selfBuildWrapperProjectIdentityCorrected:true}));