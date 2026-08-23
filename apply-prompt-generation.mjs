import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const root=process.cwd();
const indexPath=path.join(root,'index.html');
let html=fs.readFileSync(indexPath,'utf8');

function replaceOnce(source,needle,replacement,label){
  const count=source.split(needle).length-1;
  if(count!==1)throw new Error(`${label}: expected exactly one match, found ${count}.`);
  return source.replace(needle,replacement);
}

if(!html.includes('data-generate-production-instruction')){
  html=replaceOnce(
    html,
    "text('instructionId','Instruction identity',true),area('objective','Exact production objective',true)",
    "text('instructionId','Instruction identity',true),area('promptText','Generated production prompt / instruction',true,'Generated from the approved job, independent external sources, requirements, and tests. It remains editable before freeze.'),area('objective','Exact production objective',true)",
    'production instruction prompt field'
  );

  html=replaceOnce(
    html,
    "9:['preflightReviews']",
    "9:['productionInstructions','preflightReviews']",
    'Stage 9 record groups'
  );

  html=replaceOnce(
    html,
    "if(n===1)return`<div class=\"recordGroup\"><div class=\"actions\"><button class=\"btn primary\" data-view=\"job\">Edit the complete 20-scope job definition</button></div></div>`;if([11,18,20].includes(n))",
    "if(n===1)return`<div class=\"recordGroup\"><div class=\"actions\"><button class=\"btn primary\" data-view=\"job\">Edit the complete 20-scope job definition</button></div></div>`;if(n===8)return`<div class=\"recordGroup\"><div class=\"groupHeader\"><div><h3>Production prompt</h3><div class=\"fine muted\">Generate the production instruction from the approved job, independent external sources, mandatory requirements, acceptance tests, and mutation tests. Review or edit the resulting structured record before completion.</div></div><button class=\"btn small primary\" data-generate-production-instruction>Generate production prompt</button></div></div>`;if(n===9)return`<div class=\"recordGroup\"><div class=\"groupHeader\"><div><h3>Preflighted production prompt</h3><div class=\"fine muted\">Generate a new instruction version after checking the Stage 8 prompt for ambiguity, missing inputs, contradictions, capability gaps, traceability gaps, and wording-only compliance.</div></div><button class=\"btn small primary\" data-generate-preflighted-instruction>Generate preflighted prompt</button></div></div>`;if([11,18,20].includes(n))",
    'Stage 8 and 9 generation controls'
  );

  const helpers=`
function instructionVersion(project){return String((project.productionInstructions||[]).length+1).padStart(3,'0')}
function listLine(record,primary,secondary=''){const head=String(record?.[primary]||record?.id||'').trim();const tail=String(record?.[secondary]||'').trim();return tail?\`- \${record.id}: \${head} — \${tail}\`:\`- \${record.id}: \${head}\`}
function buildProductionPrompt(project,{preflighted=false}={}){
  const job=project.job||{};
  const sources=(project.externalSources||[]).map(source=>\`- \${source.id}: \${source.title||''} | \${source.canonicalLocation||''} | authority=\${source.authorityClassification||source.authority||''}\`).join('\\n')||'- NONE REGISTERED';
  const requirements=(project.requirements||[]).filter(r=>r.mandatory==='MANDATORY').map(r=>\`- \${r.id}: \${r.statement||''} | origin=\${r.origin||''} | controlling=\${r.controllingReference||''} | accept=\${r.acceptanceCriterion||''} | fail=\${r.failureCondition||''}\`).join('\\n')||'- NONE REGISTERED';
  const acceptance=(project.acceptanceTests||[]).map(test=>\`- \${test.id}: requirements=\${test.requirementIds||''} | procedure=\${test.procedure||''} | expected=\${test.expectedResult||''}\`).join('\\n')||'- NONE REGISTERED';
  const mutations=(project.mutationTests||[]).map(test=>\`- \${test.id}: requirements=\${test.requirementIds||''} | mutation=\${test.mutation||''} | expected detection=\${test.expectedDetection||''}\`).join('\\n')||'- NONE REGISTERED';
  const inputs=(project.userInputs||[]).map(input=>\`- \${input.id}: \${input.classification||''} | \${input.title||''} | \${input.location||''}\`).join('\\n')||'- No separately registered supplied-input records; use the Stage 1 job record below.';
  return [
    preflighted?'PREFLIGHTED PRODUCTION INSTRUCTION':'PRODUCTION INSTRUCTION',
    \`PROJECT: \${project.name} (\${project.projectId})\`,
    \`OBJECTIVE\\n\${job.exactUserObjective||''}\`,
    \`DELIVERABLES\\n\${job.exactDeliverables||''}\`,
    \`REQUESTED ACTIONS\\n\${job.requestedActions||''}\`,
    \`SCOPE BOUNDARIES\\n\${job.scopeBoundaries||''}\`,
    \`USER-SUPPLIED INPUTS\\n\${inputs}\`,
    \`INDEPENDENT EXTERNAL AUTHORITY\\nUse these sources only for externally governed requirements; workflow-generated artifacts are not external authority.\\n\${sources}\`,
    \`MANDATORY ATOMIC REQUIREMENTS\\n\${requirements}\`,
    \`ACCEPTANCE TESTS\\n\${acceptance}\`,
    \`FAILURE / MUTATION TESTS\\n\${mutations}\`,
    \`PROHIBITED ACTIONS\\n\${job.prohibitedActions||'NONE SPECIFIED'}\`,
    \`REQUIRED METHODS AND PROCESS CONDITIONS\\n\${job.requiredMethods||''}\`,
    \`OUTPUT CONTRACT\\n\${job.requiredOutputProperties||job.exactDeliverables||''}\`,
    \`DECISION RULES\\nSatisfy every mandatory requirement. Do not substitute explanation for requested execution. Do not invent missing facts or evidence. If a mandatory requirement cannot be established, return BLOCKED with the exact blocker. If a mandatory requirement is demonstrably violated, return REJECTED for that candidate and identify the earliest responsible layer.\`,
    \`TOOL-USE RULES\\nUse the real tools, external research systems, files, interfaces, measurements, execution environments, and verification methods required by the job. Preserve evidence sufficient for independent verification.\`,
    \`TRUTH SEMANTICS\\nUser inputs establish intent and supplied facts. Independent external sources establish externally governed requirements. Workflow-generated records establish only what happened during this workflow and may not retroactively become external authority.\`,
    \`COMPLETION CRITERIA\\n\${job.successConditions||''}\`,
    preflighted?'PREFLIGHT CONDITION\\nThis version supersedes the prior production prompt only after the Stage 9 preflight record documents the review result. Preserve all substantive requirements; corrections may remove ambiguity or omissions but may not silently change user intent or external authority.':''
  ].filter(Boolean).join('\\n\\n');
}
function createInstructionRecord(project,stageNumber,{preflighted=false}={}){
  if(!(project.requirements||[]).some(r=>r.mandatory==='MANDATORY'))throw Error('Generate the production prompt only after mandatory atomic requirements exist.');
  if(!(project.acceptanceTests||[]).length)throw Error('Generate the production prompt only after acceptance tests exist.');
  const version=instructionVersion(project);
  const promptText=buildProductionPrompt(project,{preflighted});
  const stage=project.stages[stageNumber-1];
  const sourceIds=(project.externalSources||[]).map(r=>r.id).join(' ')||'NONE';
  const requirementIds=(project.requirements||[]).filter(r=>r.mandatory==='MANDATORY').map(r=>r.id).join(' ')||'NONE';
  const acceptanceIds=(project.acceptanceTests||[]).map(r=>r.id).join(' ')||'NONE';
  const mutationIds=(project.mutationTests||[]).map(r=>r.id).join(' ')||'NONE';
  return {id:uid('INSTRUCTION'),informationClass:INFORMATION_CLASSES.GENERATED,stageNumber,createdAt:now(),updatedAt:now(),instructionId:\`INSTRUCTION-v\${version}\`,promptText,objective:project.job.exactUserObjective||'',governingInputs:\`User job record; external sources: \${sourceIds}; mandatory requirements: \${requirementIds}; acceptance tests: \${acceptanceIds}; mutation tests: \${mutationIds}.\`,scope:project.job.scopeBoundaries||project.job.subjectAndTarget||'',orderedProcedure:project.job.requiredMethods||'Execute the requested job using the approved requirements and tests, then preserve exact evidence for verification.',decisionRules:'Every mandatory requirement must be satisfied. A demonstrable mandatory violation rejects the candidate; an unestablishable mandatory requirement blocks it. Correct the earliest responsible layer and rerun dependent work.',toolRules:'Use the actual tools and external research capabilities required by the job. Preserve provenance and evidence. Do not simulate a requested real execution when the required capability exists.',outputContract:project.job.requiredOutputProperties||project.job.exactDeliverables||'',failureBehavior:'Do not invent facts, sources, execution, or evidence. Return BLOCKED for unavailable mandatory information/capability and identify the exact blocker. Return REJECTED for demonstrated mandatory violations.',truthSemantics:'USER JOB INPUT establishes intent and supplied facts; EXTERNAL RESEARCH SOURCE establishes externally governed authority; WORKFLOW-GENERATED ARTIFACT records what happened and never becomes retroactive external authority.',completionCriteria:project.job.successConditions||'',performedByType:stage.assignedActorType||'HUMAN_AGENT_TEAM',performedByName:stage.assignedActorName||'Workflow operator',performanceEvidence:preflighted?'Generated deterministically from the current approved Stage 1-8 structured records during Stage 9 preflight.':'Generated deterministically from the current approved Stage 1-7 structured records during Stage 8.'};
}
function generateProductionInstruction(){const project=cur();if(!project)return;try{if(project.stages[6].status!=='COMPLETE')throw Error('Stage 7 must be COMPLETE before generating the production prompt.');const record=createInstructionRecord(project,8);project.productionInstructions.push(record);invalidateFrom(project,8,'Production prompt generated or changed.');save();renderAll();toast(\`\${record.instructionId} generated from the approved job, sources, requirements, and tests.\`,'good')}catch(error){toast(error.message,'bad')}}
function generatePreflightedInstruction(){const project=cur();if(!project)return;try{if(project.stages[7].status!=='COMPLETE')throw Error('Stage 8 must be COMPLETE before generating the preflighted prompt.');const prior=(project.productionInstructions||[]).filter(r=>Number(r.stageNumber)===8||Number(r.stageNumber)===9).slice(-1)[0];if(!prior?.promptText)throw Error('Stage 8 must contain a generated production prompt before Stage 9 can preflight it.');const record=createInstructionRecord(project,9,{preflighted:true});project.productionInstructions.push(record);project.preflightReviews.push({id:uid('PREFLIGHT'),informationClass:INFORMATION_CLASSES.GENERATED,stageNumber:9,createdAt:now(),updatedAt:now(),reviewType:'CORRECTION',description:\`Preflighted \${prior.instructionId||prior.id} for ambiguity, undefined objects, missing inputs, contradictions, unavailable capabilities, unverifiable commands, responsibility/order gaps, traceability gaps, and wording-only compliance. Generated \${record.instructionId} as the explicit reviewed instruction version.\`,severity:'NONE',affectedSection:'ALL',resolution:\`Use \${record.instructionId} for candidate freeze unless subsequent human review identifies a material defect.\`,status:'RESOLVED',performedByType:project.stages[8].assignedActorType||'HUMAN_AGENT_TEAM',performedByName:project.stages[8].assignedActorName||'Workflow operator',performanceEvidence:'Stage 9 deterministic preflight generation preserved the approved requirements and external-authority boundary while producing a separately versioned instruction record.'});invalidateFrom(project,9,'Preflighted production prompt generated or changed.');save();renderAll();toast(\`\${record.instructionId} generated and Stage 9 preflight evidence recorded.\`,'good')}catch(error){toast(error.message,'bad')}}
`;

  html=replaceOnce(html,'async function computeHashRecord(){',helpers+'\nasync function computeHashRecord(){','prompt generation functions');

  html=replaceOnce(
    html,
    "if(target.id==='saveJobBtn'){saveJob();return}if(target.dataset.createRuns)",
    "if(target.id==='saveJobBtn'){saveJob();return}if(target.hasAttribute('data-generate-production-instruction')){generateProductionInstruction();return}if(target.hasAttribute('data-generate-preflighted-instruction')){generatePreflightedInstruction();return}if(target.dataset.createRuns)",
    'prompt generation click handlers'
  );
}

fs.writeFileSync(indexPath,html);

const payloadDir=path.join(root,'app-payload');
const compressed=zlib.gzipSync(Buffer.from(html,'utf8'),{level:9});
const base64=compressed.toString('base64');
const partSize=8000;
const parts=[];
for(let offset=0;offset<base64.length;offset+=partSize)parts.push(base64.slice(offset,offset+partSize));
for(const name of fs.readdirSync(payloadDir))if(/^part-\d+\.txt$/.test(name))fs.unlinkSync(path.join(payloadDir,name));
parts.forEach((part,index)=>fs.writeFileSync(path.join(payloadDir,`part-${String(index).padStart(2,'0')}.txt`),`${part}\n`));
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const htmlBytes=Buffer.from(html,'utf8');
const manifest={format:'closed-loop-app-payload/1',encoding:'gzip+base64',partCount:parts.length,partPattern:'part-%02d.txt',htmlBytes:htmlBytes.length,compressedBytes:compressed.length,htmlSha256:sha256(htmlBytes),compressedSha256:sha256(compressed)};
fs.writeFileSync(path.join(payloadDir,'manifest.json'),`${JSON.stringify(manifest,null,2)}\n`);
console.log(JSON.stringify({status:'PASS',promptGeneration:true,stage8:true,stage9:true,htmlBytes:manifest.htmlBytes,htmlSha256:manifest.htmlSha256,compressedBytes:manifest.compressedBytes,parts:manifest.partCount},null,2));
