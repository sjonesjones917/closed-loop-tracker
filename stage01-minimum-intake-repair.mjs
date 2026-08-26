import fs from 'node:fs';
import {createHash} from 'node:crypto';

const mustReplace=(text,search,replacement,label)=>{
  if(!text.includes(search))throw new Error(`Missing expected ${label}`);
  return text.replace(search,replacement);
};
const mustRegexReplace=(text,re,replacement,label)=>{
  const matches=text.match(re);
  if(!matches)throw new Error(`Missing expected ${label}`);
  return text.replace(re,replacement);
};

let prompt=fs.readFileSync('prompt-engine.js','utf8');
prompt=mustReplace(prompt,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/8';","const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/9';",'prompt engine version');

const helperAnchor=[
  'function humanInputBlock(job){',
  ' const definitions=schema.JOB_FIELDS||{};',
  " const names=Object.entries(definitions).filter(([,definition])=>definition?.producer==='HUMAN').map(([name])=>name);",
  " return names.length?names.map(name=>`${name}:\\n${show(job?.[name])}`).join('\\n\\n'):'NONE';",
  '}',
  ''
].join('\n');
const helperAddition=[
  "const missingStageOneObjective=state=>['','UNKNOWN','NONE','NOT APPLICABLE'].includes(String(state?.job?.EXACT_USER_OBJECTIVE_VERBATIM??'').trim().toUpperCase());",
  'function stageOneSuppliedFiles(state){',
  " const files=Array.isArray(state?.stages?.[1]?.authorizedFiles)?state.stages[1].authorizedFiles:[];",
  ' const seen=new Set();',
  " return files.map(file=>({artifactId:String(file?.artifactId||file?.id||''),filename:String(file?.name||file?.filename||''),mediaType:String(file?.type||file?.mediaType||''),byteSize:Number(file?.size??file?.byteSize??0),sha256:String(file?.sha256||'')})).filter(file=>file.artifactId&&file.filename&&!seen.has(file.artifactId)&&(seen.add(file.artifactId),true));",
  '}',
  'function assertStageOneMinimumIntake(stage,state){',
  ' if(stage!==1||!missingStageOneObjective(state))return;',
  " const error=new Error('Stage 01 requires the human verbatim job request before a controlling instruction can be generated. Enter the request in User Job Input, save it, then regenerate Stage 01.');",
  " error.code='MISSING_STAGE01_OBJECTIVE';",
  ' throw error;',
  '}',
  ''
].join('\n');
prompt=mustReplace(prompt,helperAnchor,helperAnchor+helperAddition,'Stage 01 intake helper anchor');

const stageOneProcedure="1:'Initialize only this current job from this current job’s exact human-authority input. Stage 01 owns job definition and clarification only. A complete Stage 01 result requires a coherent representation of what the human wants produced or accomplished, not every fact that later stages may need. Preserve the verbatim objective, normalize the intended deliverable at the level actually stated by the human, preserve explicit constraints and prohibitions, identify supplied materials without inspecting their contents, separate assumptions from unknowns, and identify later-needed facts without prematurely blocking the job. HUMAN_INPUT_REQUIRED is allowed only when a missing human choice prevents reliable definition of the objective or requested deliverable itself. Do not block Stage 01 merely because a later stage will need jurisdiction, filing route, inventorship, applicant/assignee facts, priority/continuity, disclosure history, external authority, source count, detailed engineering parameters, exact file formats, toolchain specifics, verification details, or production details. Record those nonblocking later-needed facts in UNKNOWN_INFORMATION and proceed. For a request such as “I need a patent application for my project,” with supplied invention materials, Stage 01 should normally define a patent-application drafting deliverable and preserve unresolved filing-specific facts for the stage that actually needs them; it should not demand a complete filing strategy before the job can be initialized. Treat human-supplied files, links, references, records, or other materials as opaque authorized inputs here: acknowledge their application-known identities only as needed to define the input set, but do not inventory their contents, classify, inspect, validate, research, rank, establish provenance for, or determine authority/currency/conflicts among them. A later source/material stage owns discovery, inventory, provenance, inspection, authority, currency, supersession, applicability, and conflicts. Determine suitable artifact categories and formats from the stated objective when that does not require a genuine human choice; do not require the human to know specialist formats in advance. The application already owns JOB_ID and controlled input identity; do not assign or invent them. Do not create or prescribe a reusable master job or prompt for unrelated jobs. Do not begin substantive external-source research, requirement derivation, verification design, production-instruction authoring, implementation, artifact production, filing, testing, simulation, manufacturing, or other downstream work.',\n2:'";
prompt=mustRegexReplace(prompt,/1:'Initialize only this current job[\s\S]*?',\n2:'/ ,stageOneProcedure,'Stage 01 procedure');

const newDomain=`STAGE 01 DOMAIN INTAKE ADAPTATION — DEFINE THE JOB, DEFER DOWNSTREAM FACTS
Use domain knowledge only to interpret the human’s requested outcome and the broad deliverable/artifact set. Domain knowledge must reduce human work, not front-load every fact that could matter later. Ask a Stage 01 clarification only when two materially different job definitions remain possible and the human must choose between them now. Otherwise preserve the unresolved fact in UNKNOWN_INFORMATION for the first later stage that actually needs it. Do not perform source discovery, source research, requirement derivation, verification design, production-instruction authoring, implementation, artifact production, filing, simulation, testing, manufacturing, or other later-stage work.
- PATENT / REGULATED FILING: a request for a patent application is sufficient to initialize a patent-application drafting job unless the human’s requested deliverable itself is ambiguous. Jurisdiction, filing route, inventorship, applicant/assignee identity, priority/continuity, disclosure history, filing deadlines, forms, declarations, and formal filing requirements are downstream facts unless the human explicitly made one of them part of the Stage 01 deliverable definition. Do not ask counsel-ready versus filing-ready merely because both are possible; preserve the broad requested patent-application deliverable and defer that refinement until a stage actually requires it or the human expressly asks for one.
- SOFTWARE / MULTI-FILE SYSTEM: identify only the requested system/deliverable and broad scope. Repository/file details, interfaces, platform constraints, and toolchain facts may remain later-stage unknowns unless they are necessary to distinguish the requested deliverable itself.
- BUILDING / ARCHITECTURE / AEC: identify only the requested project/deliverable and broad intended scope. Jurisdiction, adopted codes, occupancy details, discipline criteria, and permit facts are later-stage unknowns unless needed to distinguish what the human is asking Stage 01 to represent.
- PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE: identify only the intended part/system and requested artifact category. Detailed units, tolerances, materials, machine/controller parameters, manufacturing constraints, and verification methods are later-stage unknowns unless necessary to distinguish the requested deliverable itself.
- OTHER DOMAINS: apply the same rule: define the requested outcome now; defer domain facts until the stage that actually consumes them.
`;
prompt=mustRegexReplace(prompt,/STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY[\s\S]*?- OTHER DOMAINS: identify analogous human-supplied scope, deliverables, materials, constraints, decisions, and missing information needed to define the job\. Do not perform later-stage substantive work\.\n/,newDomain,'Stage 01 domain intake block');

const newClarification=`STAGE 01 CLARIFICATION EXPERIENCE
Stage 01 should complete with the minimum human effort needed to define the job. Distinguish blocking intake ambiguity from nonblocking downstream unknowns. Ask only when the objective or requested deliverable itself cannot be represented reliably without a human choice. Do not ask for facts merely because a patent filing, engineering design, software implementation, research task, or other later stage may eventually need them. Record nonblocking later-needed facts in UNKNOWN_INFORMATION and return DATA_PROPOSAL. Never guess a human fact; an unknown may be explicitly preserved without becoming a Stage 01 blocker. If a genuinely blocking Stage 01 ambiguity remains and this agent can converse with the human, ask the smallest concise plain-language question set first. After the human answers, instruct the human to record only those answers in the application’s User Job Input and regenerate Stage 01. If interactive questioning is unavailable, return HUMAN_INPUT_REQUIRED with the same structured questions.
`;
prompt=mustRegexReplace(prompt,/STAGE 01 CLARIFICATION EXPERIENCE\n[\s\S]*?HUMAN_INPUT_REQUIRED response envelope so the application can display and type-check the questions\.\n/,newClarification,'Stage 01 clarification block');

const suppliedAnchor='${humanInputBlock(j)}\n\nCURRENT AGENT-NORMALIZED DELIVERABLE';
const suppliedReplacement='${humanInputBlock(j)}\n\n${stage===1?`APPLICATION-VERIFIED SUPPLIED FILE IDENTITIES — OPAQUE INPUTS, DO NOT INSPECT HERE\\n${show(stageOneSuppliedFiles(state))}\\n`:``}\nCURRENT AGENT-NORMALIZED DELIVERABLE';
prompt=mustReplace(prompt,suppliedAnchor,suppliedReplacement,'Stage 01 supplied file prompt context');

const oldMissing='- Missing human-authority information requires HUMAN_INPUT_REQUIRED. Missing, stale, incomplete, or contradictory canonical application context requires BLOCKED with MISSING_APPLICATION_CONTEXT. Missing external authority or evidence requires BLOCKED with the appropriate unresolved kind. An unavailable required capability requires BLOCKED with MISSING_CAPABILITY, or EXECUTION_FAILED if an attempted execution failed.';
const newMissing="${stage===1?'- In Stage 01, missing human-authority information requires HUMAN_INPUT_REQUIRED only when it prevents reliable definition of the objective or requested deliverable itself. Otherwise preserve it in UNKNOWN_INFORMATION for later resolution.':'- Missing human-authority information requires HUMAN_INPUT_REQUIRED when the current stage genuinely cannot proceed without it.'} Missing, stale, incomplete, or contradictory canonical application context requires BLOCKED with MISSING_APPLICATION_CONTEXT. Missing external authority or evidence requires BLOCKED with the appropriate unresolved kind. An unavailable required capability requires BLOCKED with MISSING_CAPABILITY, or EXECUTION_FAILED if an attempted execution failed.";
prompt=mustReplace(prompt,oldMissing,newMissing,'stage-specific missing-human rule');

const buildAnchor='function buildPromptRecord(stageOrDefinition,state,options={}){\n const stage=Number(stageOrDefinition?.number||stageOrDefinition);if(!Number.isInteger(stage)||stage<1||stage>schema.STAGE_COUNT)throw new Error(`Stage must be 1 through ${schema.STAGE_COUNT}.`);';
const buildReplacement=buildAnchor+'assertStageOneMinimumIntake(stage,state);';
prompt=mustReplace(prompt,buildAnchor,buildReplacement,'Stage 01 minimum intake guard');

const manifestAnchor='latestValidationFailure:feedback.validationFailures};';
prompt=mustReplace(prompt,manifestAnchor,'latestValidationFailure:feedback.validationFailures,stageOneSuppliedFiles:stage===1?stageOneSuppliedFiles(state):[]};','Stage 01 file identity context signature');
fs.writeFileSync('prompt-engine.js',prompt);

let tests=fs.readFileSync('verify-prompt-semantics.mjs','utf8');
tests=mustReplace(tests,"if(!record.prompt.includes('STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY')||!record.prompt.includes('Do not perform source discovery, source research, requirement derivation, verification design, production-instruction authoring, implementation, artifact production'))issues.push('STAGE01_DOMAIN_INTAKE_BOUNDARY_MISSING');","if(!record.prompt.includes('STAGE 01 DOMAIN INTAKE ADAPTATION — DEFINE THE JOB, DEFER DOWNSTREAM FACTS')||!record.prompt.includes('Do not perform source discovery, source research, requirement derivation, verification design, production-instruction authoring, implementation, artifact production'))issues.push('STAGE01_DOMAIN_INTAKE_BOUNDARY_MISSING');",'Stage 01 semantic domain assertion');
tests=mustReplace(tests,"if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('ask only the necessary clarification questions in normal plain language first')||!record.prompt.includes('record those answers in the application’s User Job Input and regenerate this Stage 01 instruction')||!record.prompt.includes('Do not emit a DATA_PROPOSAL until that regenerated instruction contains the required human-authority facts')||!record.prompt.includes('HUMAN_INPUT_REQUIRED response envelope'))issues.push('STAGE01_HUMAN_FIRST_CLARIFICATION_MISSING');","if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('Distinguish blocking intake ambiguity from nonblocking downstream unknowns')||!record.prompt.includes('Record nonblocking later-needed facts in UNKNOWN_INFORMATION and return DATA_PROPOSAL')||!record.prompt.includes('record only those answers in the application’s User Job Input and regenerate Stage 01')||!record.prompt.includes('HUMAN_INPUT_REQUIRED with the same structured questions'))issues.push('STAGE01_HUMAN_FIRST_CLARIFICATION_MISSING');",'Stage 01 semantic clarification assertion');
tests=mustReplace(tests,"if(!record.prompt.includes('do not require the human to know those formats in advance')||!record.prompt.includes('absence of a downstream authoring, viewing, compiling, importing, simulation, manufacturing, filing, deployment, or other consuming system is not by itself a reason to downgrade an artifact to prose')||!record.prompt.includes('Only propose an implementation-ready'))issues.push('STAGE01_ARTIFACT_GENERATION_BOUNDARY_MISSING');","if(!record.prompt.includes('do not require the human to know specialist formats in advance')||!record.prompt.includes('requested artifact category')||!record.prompt.includes('Do not begin substantive external-source research'))issues.push('STAGE01_ARTIFACT_GENERATION_BOUNDARY_MISSING');",'Stage 01 semantic artifact assertion');
tests=mustReplace(tests,"if(!r.prompt.includes('STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY')||!/requested filing artifacts/.test(r.prompt)||!/supplied repository or file materials/.test(r.prompt)||!/human-supplied project location/.test(r.prompt)||!/supplied geometry\\/specifications/.test(r.prompt))throw new Error('Stage 01 specialist intake adaptation is missing.');","if(!r.prompt.includes('STAGE 01 DOMAIN INTAKE ADAPTATION — DEFINE THE JOB, DEFER DOWNSTREAM FACTS')||!/request for a patent application is sufficient to initialize/.test(r.prompt)||!/requested system\\/deliverable and broad scope/.test(r.prompt)||!/requested project\\/deliverable and broad intended scope/.test(r.prompt)||!/intended part\\/system and requested artifact category/.test(r.prompt))throw new Error('Stage 01 specialist intake adaptation is missing.');",'Stage 01 specialist domain assertion');

if(tests.includes('// stage01-minimum-human-work-regression-v1'))throw new Error('Stage 01 regression test already exists unexpectedly');
tests+=`
// stage01-minimum-human-work-regression-v1
{
 const p=baseProject();
 p.job.EXACT_USER_OBJECTIVE_VERBATIM='I need a patent application for my project.';
 p.job.SUPPLIED_MATERIALS_INVENTORY='';
 p.stages[1].authorizedFiles=[{artifactId:'ART-PATENT-DISCLOSURE',name:'invention-disclosure.zip',type:'application/zip',size:12345,sha256:'a'.repeat(64)}];
 const r=prompts.buildPromptRecord(1,p,{operation:'COMPLETE'});
 for(const token of ['I need a patent application for my project.','APPLICATION-VERIFIED SUPPLIED FILE IDENTITIES','invention-disclosure.zip','request for a patent application is sufficient to initialize','Record nonblocking later-needed facts in UNKNOWN_INFORMATION and return DATA_PROPOSAL'])if(!r.prompt.includes(token))throw new Error('Stage 01 patent minimum-intake regression missing: '+token);
 for(const forbidden of ['identify the governing jurisdiction or office, filing type, priority/continuity facts, applicant/inventor facts','Do not emit a DATA_PROPOSAL until that regenerated instruction contains the required human-authority facts','Missing human-authority information requires HUMAN_INPUT_REQUIRED.'])if(r.prompt.includes(forbidden))throw new Error('Stage 01 still front-loads downstream patent facts: '+forbidden);
 if(r.contextManifest.stageOneSuppliedFiles.length!==1||r.contextManifest.stageOneSuppliedFiles[0].artifactId!=='ART-PATENT-DISCLOSURE')throw new Error('Stage 01 verified supplied-file identity is not bound into prompt context.');
}
{
 const p=baseProject();p.job.EXACT_USER_OBJECTIVE_VERBATIM='';let error=null;try{prompts.buildPromptRecord(1,p,{operation:'COMPLETE'});}catch(e){error=e;}
 if(error?.code!=='MISSING_STAGE01_OBJECTIVE')throw new Error('Stage 01 controlling prompt can still be generated without the minimum verbatim job request.');
}
`;
fs.writeFileSync('verify-prompt-semantics.mjs',tests);

const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const gitBlobSha=file=>{const bytes=fs.readFileSync(file);return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');};
const runtimeManifest=runtimeFiles.map(file=>`${file}:${gitBlobSha(file)}\n`).join('');
const runtimeBuildIdentity=`runtime-${createHash('sha256').update(runtimeManifest).digest('hex').slice(0,16)}`;
let html=fs.readFileSync('index.html','utf8');
if(!/\?v=runtime-[a-f0-9]{16}/.test(html))throw new Error('Runtime build token not found in index.html');
html=html.replace(/\?v=runtime-[a-f0-9]{16}/g,`?v=${runtimeBuildIdentity}`);
fs.writeFileSync('index.html',html);
console.log(JSON.stringify({patched:true,runtimeBuildIdentity,promptEngineVersion:'closed-loop-prompt-engine/9'}));
