import fs from 'node:fs';
import {createHash} from 'node:crypto';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
function once(text,from,to,label){
  const count=text.split(from).length-1;
  if(count!==1)throw new Error(`${label}: expected exactly one anchor, found ${count}`);
  return text.replace(from,to);
}
function regexOnce(text,re,to,label){
  const matches=[...text.matchAll(new RegExp(re.source,re.flags.includes('g')?re.flags:re.flags+'g'))];
  if(matches.length!==1)throw new Error(`${label}: expected exactly one regex anchor, found ${matches.length}`);
  return text.replace(re,to);
}

// 1) Complete the already-advertised TEST execution contract in the single schema.
{
  let s=read('workflow-schema.js');
  s=once(s,
    "const RESPONSE_TYPES=Object.freeze(['DATA_PROPOSAL','HUMAN_INPUT_REQUIRED','BLOCKED','EXECUTION_FAILED']);",
    "const RESPONSE_TYPES=Object.freeze(['DATA_PROPOSAL','HUMAN_INPUT_REQUIRED','BLOCKED','EXECUTION_FAILED']);\nconst TEST_EXECUTION_MODES=Object.freeze(['APPLICATION_DETERMINISTIC','EXTERNAL_AGENT_TOOL','INDEPENDENT_AGENT_REVIEW','HUMAN_INSPECTION','EXTERNAL_SYSTEM','UNAVAILABLE']);",
    'schema execution-mode enum');
  const oldOwnership=`  \"tests\": {\n    \"human\": [],\n    \"humanDecision\": [],\n    \"agent\": [\n      \"TEST_TYPE\",\n      \"INPUTS\",\n      \"TOOLS\",\n      \"PROCEDURE\",\n      \"EXPECTED_RESULT\",\n      \"FAILURE_CONDITION\",\n      \"EVIDENCE_TO_PRESERVE\"\n    ],\n    \"application\": [\n      \"TEST_ID\",\n      \"REQ_ID\",\n      \"STATUS\"\n    ]\n  },`;
  const newOwnership=`  \"tests\": {\n    \"human\": [],\n    \"humanDecision\": [],\n    \"agent\": [\n      \"TEST_TYPE\",\n      \"EXECUTION_MODE\",\n      \"REQUIRED_CAPABILITY\",\n      \"ARTIFACT_REQUIREMENTS\",\n      \"INPUTS\",\n      \"TOOLS\",\n      \"PROCEDURE\",\n      \"EXPECTED_RESULT\",\n      \"FAILURE_CONDITION\",\n      \"EVIDENCE_TO_PRESERVE\"\n    ],\n    \"application\": [\n      \"TEST_ID\",\n      \"REQ_ID\",\n      \"STATUS\"\n    ]\n  },`;
  s=once(s,oldOwnership,newOwnership,'tests ownership partition');
  s=regexOnce(s,/const RECORD_FIELD_TYPE_OVERRIDES=Object\.freeze\(\{/,
`const RECORD_FIELD_TYPE_OVERRIDES=Object.freeze({\n  'TEST':Object.freeze({\n    EXECUTION_MODE:Object.freeze({valueType:'STRING',enumValues:TEST_EXECUTION_MODES,nullable:false,normalizerKey:null,closedProperties:null}),\n    REQUIRED_CAPABILITY:Object.freeze({valueType:'STRING',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),\n    ARTIFACT_REQUIREMENTS:Object.freeze({valueType:'OBJECT',enumValues:Object.freeze([]),nullable:false,normalizerKey:'resolveTestArtifactRefs',closedProperties:Object.freeze(['required','attachmentRefs','description'])})\n  }),`, 'test field type overrides');
  const oldSchema=`  tests:recordSchema({ownership:RECORD_OWNERSHIP.tests,commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,title:'Verification tests',idField:'TEST_ID',prefix:'TEST',stage:6,fields:[\n    'TEST_ID','REQ_ID','TEST_TYPE','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','STATUS'\n  ],required:['TEST_TYPE','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','STATUS'],relationships:{REQ_ID:'requirements'}}),`;
  const newSchema=`  tests:recordSchema({ownership:RECORD_OWNERSHIP.tests,commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,title:'Verification tests',idField:'TEST_ID',prefix:'TEST',stage:6,fields:[\n    'TEST_ID','REQ_ID','TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','STATUS'\n  ],required:['TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','STATUS'],relationships:{REQ_ID:'requirements'}}),`;
  s=once(s,oldSchema,newSchema,'tests record schema');
  s=once(s,
    '  PRODUCER,RESPONSE_SCHEMA,RESPONSE_TYPES,CONFLICT_POLICIES,',
    '  PRODUCER,RESPONSE_SCHEMA,RESPONSE_TYPES,TEST_EXECUTION_MODES,CONFLICT_POLICIES,',
    'schema export');
  write('workflow-schema.js',s);
}

// 2) Make Stage 6 semantics say exactly what the canonical TEST now means.
{
  let s=read('workbook.js');
  s=once(s,
    "'Create at least one verification procedure for every mandatory requirement before production instructions are authored.'",
    "'Define the verification procedure, execution responsibility, required capability, exact artifact requirements, expected result, failure condition, and required evidence for every mandatory requirement before production instructions are authored; a test definition is not proof of execution.'",
    'Stage 6 result');
  s=once(s,
    "6:['Every mandatory requirement has a ready test','Deterministic properties use deterministic tests','Mandatory test coverage equals 1.00 or stage is blocked','Test suite has a controlled identity']",
    "6:['Every mandatory requirement has a ready test','Every test explicitly declares execution mode, required capability, artifact requirements, procedure, expected result, failure condition, and evidence','Every required returned test artifact is bound to exact application-verified bytes before Stage 6 completes','Deterministic properties use deterministic tests','Mandatory test coverage equals 1.00 or stage is blocked','Test suite has a controlled identity']",
    'Stage 6 completion gate');
  write('workbook.js',s);
}

// 3) Enforce the TEST artifact sub-contract in the existing single ingestion path and normalize attachment refs to canonical artifact IDs.
{
  let s=read('response-ingestion.js');
  const anchor='  const evidenceIndex=new Map();';
  const block=`  // TEST execution artifacts are response-local claims until exact supplied bytes resolve them to canonical artifact IDs.\n  for(const [index,record] of safe(envelope.records?.tests).entries()){\n    const path=\`/records/tests/\${index}/fields/ARTIFACT_REQUIREMENTS\`,requirements=record?.fields?.ARTIFACT_REQUIREMENTS;\n    if(!object(requirements)){issues.push(issue('INVALID_TEST_ARTIFACT_REQUIREMENTS',path,'ARTIFACT_REQUIREMENTS must be an object.'));continue;}\n    const refs=requirements.attachmentRefs;\n    if(typeof requirements.required!=='boolean')issues.push(issue('INVALID_TEST_ARTIFACT_REQUIREMENTS',\`\${path}/required\`,'required must be BOOLEAN.'));\n    if(!Array.isArray(refs))issues.push(issue('INVALID_TEST_ARTIFACT_REQUIREMENTS',\`\${path}/attachmentRefs\`,'attachmentRefs must be an array.'));\n    else {\n      if(refs.some(ref=>typeof ref!=='string'||!ref.trim()))issues.push(issue('INVALID_TEST_ARTIFACT_REQUIREMENTS',\`\${path}/attachmentRefs\`,'attachmentRefs must contain only non-empty strings.'));\n      if(new Set(refs).size!==refs.length)issues.push(issue('DUPLICATE_TEST_ARTIFACT_REFERENCE',\`\${path}/attachmentRefs\`,'attachmentRefs must be unique.'));\n      if(requirements.required&&refs.length===0)issues.push(issue('MISSING_REQUIRED_TEST_ARTIFACT',\`\${path}/attachmentRefs\`,'A required executable/input test artifact must identify at least one declared attachment or current canonical artifact.'));\n      for(const ref of refs){const key=String(ref),declared=attachmentIndex.has(key),canonical=workflow.records(project,'artifacts',{active:true}).some(item=>workflow.recordId(item,'artifacts')===key);if(!declared&&!canonical)issues.push(issue('UNRESOLVED_TEST_ARTIFACT',\`\${path}/attachmentRefs\`,\`Test artifact reference \${key} does not resolve to a declared attachment or current canonical artifact.\`));}\n    }\n    if(typeof requirements.description!=='string'||!requirements.description.trim())issues.push(issue('INVALID_TEST_ARTIFACT_REQUIREMENTS',\`\${path}/description\`,'description is required.'));\n  }\n\n`;
  s=once(s,anchor,block+anchor,'test artifact validation insertion');
  const fieldAnchor="      const fields={...workflow.applicationInitialFields(collection),...clone(proposed.fields||{})};";
  const fieldReplacement=`      const fields={...workflow.applicationInitialFields(collection),...clone(proposed.fields||{})};\n      if(collection==='tests'&&object(fields.ARTIFACT_REQUIREMENTS)){const artifactRequirements=clone(fields.ARTIFACT_REQUIREMENTS),currentArtifactIds=new Set(workflow.records(project,'artifacts',{active:true}).map(item=>workflow.recordId(item,'artifacts')));artifactRequirements.attachmentRefs=safe(artifactRequirements.attachmentRefs).map(ref=>tempToCanonical[String(ref)]?.id||(currentArtifactIds.has(String(ref))?String(ref):String(ref)));fields.ARTIFACT_REQUIREMENTS=artifactRequirements;if(String(fields.EXECUTION_MODE||'').trim().toUpperCase()==='UNAVAILABLE')fields.STATUS='BLOCKED';}`;
  s=once(s,fieldAnchor,fieldReplacement,'test artifact canonical resolution');
  write('response-ingestion.js',s);
}

// 4) Make the existing execution-plan/gate model inspect the structured artifact contract instead of stringifying it.
{
  let s=read('workflow-engine.js');
  const oldPlan=`const TEST_EXECUTION_ACTIONS=Object.freeze({\n  APPLICATION_DETERMINISTIC:'No operator execution is required now. The application may execute only a native deterministic check it actually implements when the exact required inputs are available.',\n  EXTERNAL_AGENT_TOOL:'Use the generated verification instruction in an external agent/tool environment that actually has the declared capability and exact required artifacts, then ingest its structured result and evidence.',\n  INDEPENDENT_AGENT_REVIEW:'Use a fresh independent reviewer context with the declared inputs and evidence; do not reuse the producing context as its own verifier.',\n  HUMAN_INSPECTION:'Perform only the irreducible human/domain inspection described by the test, preserve the observation/evidence, and make that evidence available to the verification step.',\n  EXTERNAL_SYSTEM:'Obtain the result from the declared specialized system, lab, machine, or software; preserve exact report/output evidence and any returned files.',\n  UNAVAILABLE:'The required capability is unavailable. Do not claim execution; this remains blocking until a valid capability or equivalent verification path exists.'\n});\nfunction testExecutionPlan(project){\n  ensureShape(project);\n  const items=recordsForCurrentScope(project,'tests').map(test=>{\n    const mode=upper(recordValue(test,'EXECUTION_MODE'))||'UNSPECIFIED';\n    return {testId:recordId(test,'tests'),requirementId:testRequirementId(test),testType:upper(recordValue(test,'TEST_TYPE'))||'UNKNOWN',executionMode:mode,requiredCapability:String(recordValue(test,'REQUIRED_CAPABILITY')||'').trim(),artifactRequirements:String(recordValue(test,'ARTIFACT_REQUIREMENTS')||'').trim(),operatorAction:TEST_EXECUTION_ACTIONS[mode]||'Execution responsibility is not validly classified.'};\n  });\n  const counts=Object.fromEntries(Object.keys(TEST_EXECUTION_ACTIONS).map(mode=>[mode,items.filter(item=>item.executionMode===mode).length]));\n  const incompleteTestIds=items.filter(item=>!TEST_EXECUTION_ACTIONS[item.executionMode]||!item.requiredCapability||!item.artifactRequirements).map(item=>item.testId);\n  const unavailableTestIds=items.filter(item=>item.executionMode==='UNAVAILABLE').map(item=>item.testId);\n  return {total:items.length,counts,incompleteTestIds,unavailableTestIds,items};\n}`;
  const newPlan=`const TEST_EXECUTION_ACTIONS=Object.freeze({\n  APPLICATION_DETERMINISTIC:'No operator execution is required for an application-native check. Use this mode only when the controlling prompt explicitly establishes that the application implements the exact deterministic check; never treat this browser as a universal test runner.',\n  EXTERNAL_AGENT_TOOL:'Use the generated verification instruction in an external agent/tool environment that actually has the declared capability and exact required artifacts, then ingest its structured result and evidence.',\n  INDEPENDENT_AGENT_REVIEW:'Use a fresh independent reviewer context with the declared inputs and evidence; do not reuse the producing context as its own verifier.',\n  HUMAN_INSPECTION:'Perform only the irreducible human/domain inspection described by the test, preserve the observation/evidence, and make that evidence available to the verification step.',\n  EXTERNAL_SYSTEM:'Obtain the result from the declared specialized system, lab, machine, or software; preserve exact report/output evidence and any returned files.',\n  UNAVAILABLE:'The required capability is unavailable. Do not claim execution; this remains blocking until a valid capability or equivalent verification path exists.'\n});\nfunction testExecutionPlan(project){\n  ensureShape(project);\n  const currentArtifacts=new Map(records(project,'artifacts').map(item=>[recordId(item,'artifacts'),item]));\n  const items=recordsForCurrentScope(project,'tests').map(test=>{\n    const mode=upper(recordValue(test,'EXECUTION_MODE'))||'UNSPECIFIED',artifactRequirements=recordValue(test,'ARTIFACT_REQUIREMENTS'),artifactObject=artifactRequirements&&typeof artifactRequirements==='object'&&!Array.isArray(artifactRequirements)?artifactRequirements:null,artifactIds=safe(artifactObject?.attachmentRefs).map(String),missingArtifactIds=artifactIds.filter(id=>!currentArtifacts.has(id)),unverifiedArtifactIds=artifactIds.filter(id=>{const artifact=currentArtifacts.get(id);return artifact&&upper(recordValue(artifact,'AVAILABILITY'))!=='BYTES_PERSISTED_AND_VERIFIED';});\n    return {testId:recordId(test,'tests'),requirementId:testRequirementId(test),testType:upper(recordValue(test,'TEST_TYPE'))||'UNKNOWN',executionMode:mode,requiredCapability:String(recordValue(test,'REQUIRED_CAPABILITY')||'').trim(),artifactRequirements:artifactObject,artifactIds,missingArtifactIds,unverifiedArtifactIds,operatorAction:TEST_EXECUTION_ACTIONS[mode]||'Execution responsibility is not validly classified.'};\n  });\n  const counts=Object.fromEntries(Object.keys(TEST_EXECUTION_ACTIONS).map(mode=>[mode,items.filter(item=>item.executionMode===mode).length]));\n  const incompleteTestIds=items.filter(item=>!TEST_EXECUTION_ACTIONS[item.executionMode]||!item.requiredCapability||!item.artifactRequirements||typeof item.artifactRequirements.required!=='boolean'||!String(item.artifactRequirements.description||'').trim()||(item.artifactRequirements.required&&!item.artifactIds.length)).map(item=>item.testId);\n  const unavailableTestIds=items.filter(item=>item.executionMode==='UNAVAILABLE').map(item=>item.testId);\n  const missingArtifactTestIds=items.filter(item=>item.missingArtifactIds.length||item.unverifiedArtifactIds.length).map(item=>item.testId);\n  return {total:items.length,counts,incompleteTestIds,unavailableTestIds,missingArtifactTestIds,items};\n}`;
  s=once(s,oldPlan,newPlan,'engine test execution plan');
  const oldGate=`      if(metrics.requirementCoverage!==1)reasons.push(\`Mandatory requirement-to-test coverage is \${(metrics.requirementCoverage*100).toFixed(2)}%, not 100%.\`);\n      break;`;
  const newGate=`      if(metrics.requirementCoverage!==1)reasons.push(\`Mandatory requirement-to-test coverage is \${(metrics.requirementCoverage*100).toFixed(2)}%, not 100%.\`);\n      const executionPlan=testExecutionPlan(project);\n      if(executionPlan.incompleteTestIds.length)reasons.push(\`Test execution responsibility is incomplete for: \${executionPlan.incompleteTestIds.join(', ')}.\`);\n      if(executionPlan.unavailableTestIds.length)reasons.push(\`Required execution capability is unavailable for: \${executionPlan.unavailableTestIds.join(', ')}.\`);\n      if(executionPlan.missingArtifactTestIds.length)reasons.push(\`Required test artifact bytes are missing or unverified for: \${executionPlan.missingArtifactTestIds.join(', ')}.\`);\n      break;`;
  s=once(s,oldGate,newGate,'Stage 6 execution gate');
  write('workflow-engine.js',s);
}

// 5) Keep the existing prompt layer, but make ARTIFACT_REQUIREMENTS match the structured parser contract and state browser/external access explicitly.
{
  let s=read('prompt-engine.js');
  s=once(s,
    'Use ARTIFACT_REQUIREMENTS = NONE when no separate executable/input artifact is required.',
    'Use ARTIFACT_REQUIREMENTS = {"required": false, "attachmentRefs": [], "description": "No separate executable/input artifact is required."} when no separate artifact is required. When artifacts are required, set required=true and list the exact response attachment temporaryKey values (or already-current canonical artifact IDs) in attachmentRefs.',
    'Stage 6 structured artifact contract');
  const rule='- Never claim that a web search, repository edit, build, test, CAD operation, simulation, CNC post-processing step, physical measurement, fabrication, filing, submission, or other external action occurred unless it actually occurred in the authorized execution context and evidence is available.';
  s=once(s,rule,
    '- Browser-local or application-stored artifact bytes are not automatically accessible to an external agent, reviewer, tool, lab, repository, CAD/CAM environment, or other execution context. Treat an artifact as externally accessible only when the controlling context actually supplies that exact artifact or independently proves access to its exact canonical identity.\n'+rule,
    'external artifact access rule');
  write('prompt-engine.js',s);
}

// 6) Keep schema-driven fixtures valid without hiding the new contract.
{
  let s=read('test-fixtures.mjs');
  s=once(s,
    "export function scalarFor(def,name,overrides={}){\n  if(Object.hasOwn(overrides,name))return overrides[name];",
    "export function scalarFor(def,name,overrides={}){\n  if(Object.hasOwn(overrides,name))return overrides[name];\n  if(name==='ARTIFACT_REQUIREMENTS')return {required:false,attachmentRefs:[],description:'No separate executable/input artifact is required.'};",
    'fixture artifact requirements');
  write('test-fixtures.mjs',s);
}

// 7) Keep the independent ingestion verifier's generic fixture compatible and add exact contract negatives.
{
  let s=read('verify-ingestion.mjs');
  s=once(s,
    "function safeValue(name){\n  if(/URL_REFERENCE/.test(name))return 'https://www.w3.org/TR/WCAG22/';",
    "function safeValue(name){\n  if(/ARTIFACT_REQUIREMENTS/.test(name))return {required:false,attachmentRefs:[],description:'No separate executable/input artifact is required.'};\n  if(/EXECUTION_MODE/.test(name))return 'EXTERNAL_AGENT_TOOL';\n  if(/REQUIRED_CAPABILITY/.test(name))return 'Controlled external verification capability';\n  if(/URL_REFERENCE/.test(name))return 'https://www.w3.org/TR/WCAG22/';",
    'ingestion generic fixture');
  const insertBefore='// Clarification loop: structured question -> accepted question record -> human answer -> INPUT version increments.';
  const checks=`// Stage 6 execution/artifact contract is strict, byte-bound, and fail-closed.\nnegativeAt('invalid test execution mode',6,(e)=>{e.records.tests[0].fields.EXECUTION_MODE='MAGIC_EXECUTOR';},'INVALID_ENUM');\nnegativeAt('malformed test artifact requirements',6,(e)=>{e.records.tests[0].fields.ARTIFACT_REQUIREMENTS={required:'yes',attachmentRefs:[],description:'bad'};},'INVALID_TEST_ARTIFACT_REQUIREMENTS');\nnegativeAt('missing required test artifact',6,(e)=>{e.records.tests[0].fields.ARTIFACT_REQUIREMENTS={required:true,attachmentRefs:[],description:'Executable fixture required.'};},'MISSING_REQUIRED_TEST_ARTIFACT');\nnegativeAt('unresolved test artifact',6,(e)=>{e.records.tests[0].fields.ARTIFACT_REQUIREMENTS={required:true,attachmentRefs:['missing-test-file'],description:'Executable fixture required.'};},'UNRESOLVED_TEST_ARTIFACT');\n\n`;
  s=once(s,insertBefore,checks+insertBefore,'ingestion execution-contract negatives');
  write('verify-ingestion.mjs',s);
}

// 8) The existing operator card already fits the visual system. Only make its structured artifact summary readable.
{
  let s=read('app-core.js');
  s=once(s,
    "const actionRows=Object.entries(plan.counts).filter(([,count])=>count).map(([mode,count])=>({mode:labels[mode]||mode,tests:count,nextAction:plan.items.find(item=>item.executionMode===mode)?.operatorAction||''}));",
    "const actionRows=Object.entries(plan.counts).filter(([,count])=>count).map(([mode,count])=>({mode:labels[mode]||mode,tests:count,nextAction:plan.items.find(item=>item.executionMode===mode)?.operatorAction||''}));",
    'operator action card remains intentionally unchanged');
  write('app-core.js',s);
}

// 9) Refresh the existing shared runtime cache identity; no new loader or shell.
{
  const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
  const gitBlobSha=file=>{const bytes=fs.readFileSync(file);return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');};
  const manifest=runtimeFiles.map(file=>`${file}:${gitBlobSha(file)}\n`).join('');
  const token=`runtime-${createHash('sha256').update(manifest).digest('hex').slice(0,16)}`;
  let html=read('index.html');
  html=html.replace(/(src=\"(?:workbook|hash|workflow-schema|workflow-engine|prompt-engine|response-ingestion|project-store|app-core)\.js\?v=)runtime-[a-f0-9]{16}(\")/g,`$1${token}$2`);
  if((html.match(new RegExp(token,'g'))||[]).length!==8)throw new Error(`Expected 8 runtime tokens for ${token}`);
  write('index.html',html);
}

console.log('Applied minimal test-execution contract completion.');
