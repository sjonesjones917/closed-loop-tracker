import fs from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s);
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw new Error(`${label}: expected 1 anchor, found ${n}`);return s.replace(a,b);}

// The first pass intentionally stops before the engine. Remove its temporary duplicate TEST override
// and upgrade the pre-existing TEST override, preserving the already-proven TEST_TYPE enum.
{
 let s=read('workflow-schema.js');
 const duplicate=`  'TEST':Object.freeze({\n    EXECUTION_MODE:Object.freeze({valueType:'STRING',enumValues:TEST_EXECUTION_MODES,nullable:false,normalizerKey:null,closedProperties:null}),\n    REQUIRED_CAPABILITY:Object.freeze({valueType:'STRING',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),\n    ARTIFACT_REQUIREMENTS:Object.freeze({valueType:'OBJECT',enumValues:Object.freeze([]),nullable:false,normalizerKey:'resolveTestArtifactRefs',closedProperties:Object.freeze(['required','attachmentRefs','description'])})\n  }),\n`;
 s=once(s,duplicate,'','remove duplicate TEST override');
 s=once(s,
  "ARTIFACT_REQUIREMENTS:Object.freeze({valueType:'STRING',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})",
  "ARTIFACT_REQUIREMENTS:Object.freeze({valueType:'OBJECT',enumValues:Object.freeze([]),nullable:false,normalizerKey:'resolveTestArtifactRefs',closedProperties:Object.freeze(['required','attachmentRefs','description'])})",
  'structured TEST artifact requirements');
 write('workflow-schema.js',s);
}

// Update the existing execution plan without inventing a second engine or persistent readiness state.
{
 let s=read('workflow-engine.js');
 const start=s.indexOf('const TEST_EXECUTION_ACTIONS=Object.freeze({');
 const end=s.indexOf('\n\nfunction operationalMetrics',start);
 if(start<0||end<0)throw new Error('test execution plan block not found');
 const replacement=`const TEST_EXECUTION_ACTIONS=Object.freeze({\n  APPLICATION_DETERMINISTIC:'No operator execution is required for an application-native check. Use this mode only when the controlling verification architecture identifies an exact deterministic check that this application actually implements; never treat this browser as a universal test runner.',\n  EXTERNAL_AGENT_TOOL:'Use the generated verification instruction in an external agent/tool environment that actually has the declared capability and exact required artifacts, then ingest its structured result and evidence.',\n  INDEPENDENT_AGENT_REVIEW:'Use a fresh independent reviewer context with the declared inputs and evidence; do not reuse the producing context as its own verifier.',\n  HUMAN_INSPECTION:'Perform only the irreducible human/domain inspection described by the test, preserve the observation/evidence, and make that evidence available to the verification step.',\n  EXTERNAL_SYSTEM:'Obtain the result from the declared specialized system, lab, machine, or software; preserve exact report/output evidence and any returned files.',\n  UNAVAILABLE:'The required capability is unavailable. Do not claim execution; this remains blocking until a valid capability or equivalent verification path exists.'\n});\nfunction testExecutionPlan(project){\n  ensureShape(project);\n  const currentArtifacts=new Map(records(project,'artifacts').map(item=>[recordId(item,'artifacts'),item]));\n  const items=recordsForCurrentScope(project,'tests').map(test=>{\n    const mode=upper(recordValue(test,'EXECUTION_MODE'))||'UNSPECIFIED',raw=recordValue(test,'ARTIFACT_REQUIREMENTS'),artifactRequirements=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:null,artifactIds=safe(artifactRequirements?.attachmentRefs).map(String),missingArtifactIds=artifactIds.filter(id=>!currentArtifacts.has(id)),unverifiedArtifactIds=artifactIds.filter(id=>{const artifact=currentArtifacts.get(id);return artifact&&upper(recordValue(artifact,'AVAILABILITY'))!=='BYTES_PERSISTED_AND_VERIFIED';});\n    return {testId:recordId(test,'tests'),requirementId:testRequirementId(test),testType:upper(recordValue(test,'TEST_TYPE'))||'UNKNOWN',executionMode:mode,requiredCapability:String(recordValue(test,'REQUIRED_CAPABILITY')||'').trim(),artifactRequirements,artifactIds,missingArtifactIds,unverifiedArtifactIds,operatorAction:TEST_EXECUTION_ACTIONS[mode]||'Execution responsibility is not validly classified.'};\n  });\n  const counts=Object.fromEntries(Object.keys(TEST_EXECUTION_ACTIONS).map(mode=>[mode,items.filter(item=>item.executionMode===mode).length]));\n  const incompleteTestIds=items.filter(item=>!TEST_EXECUTION_ACTIONS[item.executionMode]||!item.requiredCapability||!item.artifactRequirements||typeof item.artifactRequirements.required!=='boolean'||!String(item.artifactRequirements.description||'').trim()||(item.artifactRequirements.required&&!item.artifactIds.length)).map(item=>item.testId);\n  const unavailableTestIds=items.filter(item=>item.executionMode==='UNAVAILABLE').map(item=>item.testId);\n  const missingArtifactTestIds=items.filter(item=>item.missingArtifactIds.length||item.unverifiedArtifactIds.length).map(item=>item.testId);\n  return {total:items.length,counts,incompleteTestIds,unavailableTestIds,missingArtifactTestIds,items};\n}`;
 s=s.slice(0,start)+replacement+s.slice(end);
 const gateNeedle="      if(metrics.requirementCoverage!==1)reasons.push(`Mandatory requirement-to-test coverage is ${(metrics.requirementCoverage*100).toFixed(2)}%, not 100%.`);\n      break;";
 const gateReplace="      if(metrics.requirementCoverage!==1)reasons.push(`Mandatory requirement-to-test coverage is ${(metrics.requirementCoverage*100).toFixed(2)}%, not 100%.`);\n      const executionPlan=testExecutionPlan(project);\n      if(executionPlan.incompleteTestIds.length)reasons.push(`Test execution responsibility is incomplete for: ${executionPlan.incompleteTestIds.join(', ')}.`);\n      if(executionPlan.unavailableTestIds.length)reasons.push(`Required execution capability is unavailable for: ${executionPlan.unavailableTestIds.join(', ')}.`);\n      if(executionPlan.missingArtifactTestIds.length)reasons.push(`Required test artifact bytes are missing or unverified for: ${executionPlan.missingArtifactTestIds.join(', ')}.`);\n      break;";
 s=once(s,gateNeedle,gateReplace,'Stage 6 execution gate');
 write('workflow-engine.js',s);
}

// Align the existing prompt with the structured field and state external artifact accessibility explicitly.
{
 let s=read('prompt-engine.js');
 s=once(s,
  'Use ARTIFACT_REQUIREMENTS = NONE when no separate executable/input artifact is required.',
  'Use ARTIFACT_REQUIREMENTS = {"required": false, "attachmentRefs": [], "description": "No separate executable/input artifact is required."} when no separate executable/input artifact is required. When artifacts are required, set required=true and list the exact response attachment temporaryKey values (or already-current canonical artifact IDs) in attachmentRefs.',
  'Stage 6 artifact shape');
 const honesty='- Never claim that a web search, repository edit, build, test, CAD operation, simulation, CNC post-processing step, physical measurement, fabrication, filing, submission, or other external action occurred unless it actually occurred in the authorized execution context and evidence is available.';
 s=once(s,honesty,
  '- Browser-local or application-stored artifact bytes are not automatically accessible to an external agent, reviewer, tool, lab, repository, CAD/CAM environment, or other execution context. Treat an artifact as externally accessible only when that exact execution context actually received it or independently proves access to the exact canonical artifact identity.\n'+honesty,
  'external artifact accessibility');
 write('prompt-engine.js',s);
}

{
 let s=read('test-fixtures.mjs');
 s=once(s,"  if(Object.hasOwn(overrides,name))return overrides[name];","  if(Object.hasOwn(overrides,name))return overrides[name];\n  if(name==='ARTIFACT_REQUIREMENTS')return {required:false,attachmentRefs:[],description:'No separate executable/input artifact is required.'};",'fixture artifact shape');
 write('test-fixtures.mjs',s);
}

{
 let s=read('verify-ingestion.mjs');
 s=once(s,"function safeValue(name){\n  if(/URL_REFERENCE/.test(name))return 'https://www.w3.org/TR/WCAG22/';","function safeValue(name){\n  if(/ARTIFACT_REQUIREMENTS/.test(name))return {required:false,attachmentRefs:[],description:'No separate executable/input artifact is required.'};\n  if(/EXECUTION_MODE/.test(name))return 'EXTERNAL_AGENT_TOOL';\n  if(/REQUIRED_CAPABILITY/.test(name))return 'Controlled external verification capability';\n  if(/URL_REFERENCE/.test(name))return 'https://www.w3.org/TR/WCAG22/';",'ingestion generic test fixture');
 const marker='// Clarification loop: structured question -> accepted question record -> human answer -> INPUT version increments.';
 const cases=`// Test execution/artifact contract rejects ambiguity before canonical mutation.\nnegativeAt('invalid test execution mode',6,(e)=>{e.records.tests[0].fields.EXECUTION_MODE='MAGIC_EXECUTOR';},'INVALID_ENUM');\nnegativeAt('malformed test artifact requirements',6,(e)=>{e.records.tests[0].fields.ARTIFACT_REQUIREMENTS={required:'yes',attachmentRefs:[],description:'bad'};},'INVALID_TEST_ARTIFACT_REQUIREMENTS');\nnegativeAt('missing required test artifact',6,(e)=>{e.records.tests[0].fields.ARTIFACT_REQUIREMENTS={required:true,attachmentRefs:[],description:'Executable fixture required.'};},'MISSING_REQUIRED_TEST_ARTIFACT');\nnegativeAt('unresolved test artifact',6,(e)=>{e.records.tests[0].fields.ARTIFACT_REQUIREMENTS={required:true,attachmentRefs:['missing-test-file'],description:'Executable fixture required.'};},'UNRESOLVED_TEST_ARTIFACT');\n\n`;
 s=once(s,marker,cases+marker,'ingestion execution negatives');
 write('verify-ingestion.mjs',s);
}

// Refresh the one existing runtime identity; no loader or architecture change.
{
 const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
 const gitBlobSha=file=>{const bytes=fs.readFileSync(file);return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');};
 const manifest=runtimeFiles.map(file=>`${file}:${gitBlobSha(file)}\n`).join('');
 const token=`runtime-${createHash('sha256').update(manifest).digest('hex').slice(0,16)}`;
 let html=read('index.html');html=html.replace(/(src=\"(?:workbook|hash|workflow-schema|workflow-engine|prompt-engine|response-ingestion|project-store|app-core)\.js\?v=)runtime-[a-f0-9]{16}(\")/g,`$1${token}$2`);
 if((html.match(new RegExp(token,'g'))||[]).length!==8)throw new Error('runtime token refresh failed');write('index.html',html);
}
console.log('Finished exact test-execution contract patch.');
