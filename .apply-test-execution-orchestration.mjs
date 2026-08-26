import fs from 'node:fs';
import {createHash} from 'node:crypto';

const read=path=>fs.readFileSync(path,'utf8');
const write=(path,text)=>fs.writeFileSync(path,text);
function replaceOne(path,from,to){
  const text=read(path),first=text.indexOf(from),last=text.lastIndexOf(from);
  if(first<0)throw new Error(`${path}: required anchor not found: ${from.slice(0,100)}`);
  if(first!==last)throw new Error(`${path}: required anchor is not unique: ${from.slice(0,100)}`);
  write(path,text.slice(0,first)+to+text.slice(first+from.length));
}
function insertBefore(path,anchor,text){replaceOne(path,anchor,text+anchor);}

// Stage wording: define verification architecture; do not imply universal executable-code generation.
replaceOne('workbook.js',
  "'BUILD THE VERIFICATION SUITE BEFORE WRITING THE PRODUCTION INSTRUCTION'",
  "'DEFINE THE VERIFICATION SUITE BEFORE WRITING THE PRODUCTION INSTRUCTION'");
replaceOne('workbook.js',
  "'Create at least one verification procedure for every mandatory requirement before production instructions are authored.'",
  "'Define at least one verification procedure, execution responsibility, required capability, artifact requirement, and evidence requirement for every mandatory requirement before production instructions are authored.'");
replaceOne('workbook.js',
  "6:['Every mandatory requirement has a ready test','Deterministic properties use deterministic tests','Mandatory test coverage equals 1.00 or stage is blocked','Test suite has a controlled identity']",
  "6:['Every mandatory requirement has a ready test definition','Every test declares execution responsibility, required capability, artifact requirements, and evidence','Unavailable mandatory execution capability blocks completion','Mandatory test coverage equals 1.00 or stage is blocked','Test suite has a controlled identity']");

// Extend the existing TEST record only; no new collection or execution engine.
replaceOne('workflow-schema.js',
`  "tests": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "TEST_TYPE",
      "INPUTS",`,
`  "tests": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "TEST_TYPE",
      "EXECUTION_MODE",
      "REQUIRED_CAPABILITY",
      "ARTIFACT_REQUIREMENTS",
      "INPUTS",`);
replaceOne('workflow-schema.js',
`  'TEST':Object.freeze({TEST_TYPE:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['DETERMINISTIC','MEANING','ADVERSARIAL']),nullable:false,normalizerKey:null,closedProperties:null})}),`,
`  'TEST':Object.freeze({
    TEST_TYPE:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['DETERMINISTIC','MEANING','ADVERSARIAL']),nullable:false,normalizerKey:null,closedProperties:null}),
    EXECUTION_MODE:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['APPLICATION_DETERMINISTIC','EXTERNAL_AGENT_TOOL','INDEPENDENT_AGENT_REVIEW','HUMAN_INSPECTION','EXTERNAL_SYSTEM','UNAVAILABLE']),nullable:false,normalizerKey:null,closedProperties:null}),
    REQUIRED_CAPABILITY:Object.freeze({valueType:'STRING',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),
    ARTIFACT_REQUIREMENTS:Object.freeze({valueType:'STRING',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})
  }),`);
replaceOne('workflow-schema.js',
`  tests:recordSchema({ownership:RECORD_OWNERSHIP.tests,commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,title:'Verification tests',idField:'TEST_ID',prefix:'TEST',stage:6,fields:[
    'TEST_ID','REQ_ID','TEST_TYPE','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','STATUS'
  ],required:['TEST_TYPE','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','STATUS'],relationships:{REQ_ID:'requirements'}}),`,
`  tests:recordSchema({ownership:RECORD_OWNERSHIP.tests,commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,title:'Verification tests',idField:'TEST_ID',prefix:'TEST',stage:6,fields:[
    'TEST_ID','REQ_ID','TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','STATUS'
  ],required:['TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','STATUS'],relationships:{REQ_ID:'requirements'}}),`);

// Workflow engine owns the operational interpretation of execution metadata.
insertBefore('workflow-engine.js','function operationalMetrics(project){',`const TEST_EXECUTION_ACTIONS=Object.freeze({
  APPLICATION_DETERMINISTIC:'No operator execution is required now. The application may execute only a native deterministic check it actually implements when the exact required inputs are available.',
  EXTERNAL_AGENT_TOOL:'Use the generated verification instruction in an external agent/tool environment that actually has the declared capability and exact required artifacts, then ingest its structured result and evidence.',
  INDEPENDENT_AGENT_REVIEW:'Use a fresh independent reviewer context with the declared inputs and evidence; do not reuse the producing context as its own verifier.',
  HUMAN_INSPECTION:'Perform only the irreducible human/domain inspection described by the test, preserve the observation/evidence, and make that evidence available to the verification step.',
  EXTERNAL_SYSTEM:'Obtain the result from the declared specialized system, lab, machine, or software; preserve exact report/output evidence and any returned files.',
  UNAVAILABLE:'The required capability is unavailable. Do not claim execution; this remains blocking until a valid capability or equivalent verification path exists.'
});
function testExecutionPlan(project){
  ensureShape(project);
  const items=recordsForCurrentScope(project,'tests').map(test=>{
    const mode=upper(recordValue(test,'EXECUTION_MODE'))||'UNSPECIFIED';
    return {testId:recordId(test,'tests'),requirementId:testRequirementId(test),testType:upper(recordValue(test,'TEST_TYPE'))||'UNKNOWN',executionMode:mode,requiredCapability:String(recordValue(test,'REQUIRED_CAPABILITY')||'').trim(),artifactRequirements:String(recordValue(test,'ARTIFACT_REQUIREMENTS')||'').trim(),operatorAction:TEST_EXECUTION_ACTIONS[mode]||'Execution responsibility is not validly classified.'};
  });
  const counts=Object.fromEntries(Object.keys(TEST_EXECUTION_ACTIONS).map(mode=>[mode,items.filter(item=>item.executionMode===mode).length]));
  const incompleteTestIds=items.filter(item=>!TEST_EXECUTION_ACTIONS[item.executionMode]||!item.requiredCapability||!item.artifactRequirements).map(item=>item.testId);
  const unavailableTestIds=items.filter(item=>item.executionMode==='UNAVAILABLE').map(item=>item.testId);
  return {total:items.length,counts,incompleteTestIds,unavailableTestIds,items};
}

`);
replaceOne('workflow-engine.js',
`    case 6:{
      requireAccepted();
      const metrics=coverageMetrics(project);
      if(metrics.mandatoryRequirementCount===0)reasons.push('No active mandatory requirements exist to cover.');
      if(metrics.requirementCoverage!==1)reasons.push(\`Mandatory requirement-to-test coverage is \${(metrics.requirementCoverage*100).toFixed(2)}%, not 100%.\`);
      break;
    }`,
`    case 6:{
      requireAccepted();
      const metrics=coverageMetrics(project),mandatoryIds=new Set(mandatoryRequirements(project).map(requirementId)),mandatoryTests=collection('tests').filter(test=>mandatoryIds.has(testRequirementId(test)));
      if(metrics.mandatoryRequirementCount===0)reasons.push('No active mandatory requirements exist to cover.');
      if(metrics.requirementCoverage!==1)reasons.push(\`Mandatory requirement-to-test coverage is \${(metrics.requirementCoverage*100).toFixed(2)}%, not 100%.\`);
      const incomplete=mandatoryTests.filter(test=>!TEST_EXECUTION_ACTIONS[upper(recordValue(test,'EXECUTION_MODE'))]||!String(recordValue(test,'REQUIRED_CAPABILITY')||'').trim()||!String(recordValue(test,'ARTIFACT_REQUIREMENTS')||'').trim());
      if(incomplete.length)reasons.push(\`\${incomplete.length} mandatory test definition(s) lack complete execution responsibility, capability, or artifact requirements.\`);
      const unavailable=mandatoryTests.filter(test=>upper(recordValue(test,'EXECUTION_MODE'))==='UNAVAILABLE');
      if(unavailable.length)reasons.push(\`\${unavailable.length} mandatory test definition(s) have unavailable execution capability and remain blocked.\`);
      break;
    }`);
replaceOne('workflow-engine.js',
  'verificationMatrix,evaluateIteration,DERIVATIONS,coverageMetrics,convergenceMetrics,releaseMetrics,operationalMetrics,gate,deriveStageData,recalculate,invalidateDownstream,applicationInitialFields,',
  'verificationMatrix,evaluateIteration,DERIVATIONS,coverageMetrics,convergenceMetrics,releaseMetrics,testExecutionPlan,operationalMetrics,gate,deriveStageData,recalculate,invalidateDownstream,applicationInitialFields,');

// Prompt semantics: distinguish definition, executable artifact, executor, and result.
replaceOne('prompt-engine.js',
`6:'Build this job’s verification suite before any production instruction is authored. Every active mandatory requirement must have at least one valid proposed test. Use the strongest suitable method, including exact computation, programmatic checks, schema or structure checks, source comparison, rule-based verification, and independent human meaning/content review where deterministic checks cannot establish satisfaction. Define inputs, tools, procedure, expected result, failure condition, and evidence to preserve. The application assigns TEST_ID, controlled test-suite identity, and exact mandatory requirement-to-test coverage; do not assert those application-owned values.',`,
`6:'Define this job’s verification suite before any production instruction is authored. A TEST record is a verification specification: it does not by itself prove that an executable test file exists or that any test has run. Every active mandatory requirement must have at least one valid proposed test. Use the strongest suitable method, including exact computation, programmatic checks, schema or structure checks, source comparison, rule-based verification, independent review, human inspection, or specialized external systems where appropriate. For every test define TEST_TYPE, EXECUTION_MODE, REQUIRED_CAPABILITY, ARTIFACT_REQUIREMENTS, inputs, tools, procedure, expected result, failure condition, and evidence to preserve. EXECUTION_MODE must be exactly one of APPLICATION_DETERMINISTIC, EXTERNAL_AGENT_TOOL, INDEPENDENT_AGENT_REVIEW, HUMAN_INSPECTION, EXTERNAL_SYSTEM, or UNAVAILABLE. APPLICATION_DETERMINISTIC is valid only for a native deterministic check the application actually implements; it does not make this static browser a universal compiler, script runner, CAD/CAE tool, lab, or machine controller. Create executable test artifacts only when an executable artifact is actually the appropriate verification mechanism. If you actually return a test fixture, script, model, report, or other file, declare it in attachments and return the exact file through the external environment so the operator can attach its bytes; a filename, claimed hash, or code block is not possession of a file. Use ARTIFACT_REQUIREMENTS = NONE when no separate executable/input artifact is required. If the required capability is unavailable and no valid equivalent path exists, use EXECUTION_MODE = UNAVAILABLE and do not pretend the test can run. The application assigns TEST_ID, controlled test-suite identity, and exact mandatory requirement-to-test coverage; do not assert those application-owned values.',`);
replaceOne('prompt-engine.js',
`12:'Verify each current execution independently. Execute only the currently missing REQ_ID × RUN_ID × TEST_ID triples listed by the application in VERIFICATION BATCH PLAN, in listed order. Preserve verifier and verifier-context identity, independence status, inputs, procedure, expected result, observed result, exact evidence, SATISFIED/VIOLATED/UNDETERMINED, defect reference where applicable, and reason for UNDETERMINED. If the complete listed batch would exceed the declared response byte limit, return the longest leading prefix that fits; never skip ahead, repeat an already-current triple, substitute wrong-version or wrong-iteration records, or self-validate. After accepted ingestion the application regenerates this stage from the newly missing set. The application reconciles the complete matrix mathematically and the stage cannot complete from a partial batch.',`,
`12:'Verify each current execution independently. Execute only the currently missing REQ_ID × RUN_ID × TEST_ID triples listed by the application in VERIFICATION BATCH PLAN, in listed order. Respect each test’s EXECUTION_MODE, REQUIRED_CAPABILITY, ARTIFACT_REQUIREMENTS, and actual artifact accessibility. Never substitute a different executor merely because it is convenient. APPLICATION_DETERMINISTIC means only a native application check that actually exists; an external verifier must not fabricate that execution. EXTERNAL_AGENT_TOOL requires the actual declared tool/access, INDEPENDENT_AGENT_REVIEW requires an independent reviewer, HUMAN_INSPECTION requires the specified human observation, and EXTERNAL_SYSTEM requires the specified external system/lab/machine evidence. If the required executor, capability, or exact artifact is unavailable, do not claim the test ran: preserve the triple as UNDETERMINED with the exact reason/evidence when the contract permits, or return the appropriate blocking/failure disposition. Preserve verifier and verifier-context identity, independence status, inputs, procedure, expected result, observed result, exact evidence, SATISFIED/VIOLATED/UNDETERMINED, defect reference where applicable, and reason for UNDETERMINED. If the complete listed batch would exceed the declared response byte limit, return the longest leading prefix that fits; never skip ahead, repeat an already-current triple, substitute wrong-version or wrong-iteration records, or self-validate. After accepted ingestion the application regenerates this stage from the newly missing set. The application reconciles the complete matrix mathematically and the stage cannot complete from a partial batch.',`);
replaceOne('prompt-engine.js',
`- Never claim that a web search, repository edit, build, test, CAD operation, simulation, CNC post-processing step, physical measurement, fabrication, filing, submission, or other external action occurred unless it actually occurred in the authorized execution context and evidence is available.`,
`- A verification definition, an executable/input test artifact, and a test execution result are three distinct things. Do not treat a procedure, filename, claimed hash, or embedded code block as proof that executable bytes exist or that execution occurred.
- Browser-stored artifact bytes are not automatically accessible to an external agent. When a task needs files, make the exact bytes available to the actual executing/reviewing environment and preserve their canonical identity/evidence.
- Never claim that a web search, repository edit, build, test, CAD operation, simulation, CNC post-processing step, physical measurement, fabrication, filing, submission, or other external action occurred unless it actually occurred in the authorized execution context and evidence is available.`);

// Compact operator guidance, derived from the canonical test records.
insertBefore('app-core.js','function provenanceMarkup(n){',`function testExecutionGuidanceMarkup(n){
  const plan=engine.testExecutionPlan(current),verificationStage=n===6||[7,8,9,10,11,12,17,19,22,23,24,25].includes(n);
  if(!verificationStage||(!plan.total&&n!==6))return '';
  const labels={APPLICATION_DETERMINISTIC:'Application',EXTERNAL_AGENT_TOOL:'Agent/tool',INDEPENDENT_AGENT_REVIEW:'Independent review',HUMAN_INSPECTION:'Human inspection',EXTERNAL_SYSTEM:'External system',UNAVAILABLE:'Unavailable'};
  const summary=Object.entries(plan.counts).filter(([,count])=>count).map(([mode,count])=>\`<span>\${esc(labels[mode]||mode)}: <strong>\${count}</strong></span>\`).join('');
  const actionRows=Object.entries(plan.counts).filter(([,count])=>count).map(([mode,count])=>({mode:labels[mode]||mode,tests:count,nextAction:plan.items.find(item=>item.executionMode===mode)?.operatorAction||''}));
  const intro=n===6?'Stage 6 defines how each requirement will be verified. A test definition is not automatically executable code and does not mean a test has run.':'Execution responsibility comes from the accepted test definitions; use only the executor and capability actually declared for each test.';
  return \`<div class="panel"><h2 class="section-title">Verification execution</h2><p class="section-intro">\${esc(intro)}</p>\${summary?\`<div class="stage-action-strip">\${summary}</div>\`:''}\${plan.unavailableTestIds.length?\`<div class="notice warn">\${plan.unavailableTestIds.length} test\${plan.unavailableTestIds.length===1?' is':'s are'} blocked by unavailable capability. Do not claim execution until a valid capability or equivalent verification path exists.</div>\`:''}\${actionRows.length?details('Who performs the current tests',actionRows):'<div class="notice">For each test, the agent must declare the execution mode, required capability, artifact requirements, procedure, expected result, failure condition, and evidence.</div>'}</div>\`;
}
`);
replaceOne('app-core.js',
`<p class="section-intro">Actual selected bytes are stored in IndexedDB, hashed by the application, read back, and rehashed before becoming canonical artifact identities.</p>`,
`<p class="section-intro">Actual selected bytes are stored in IndexedDB, hashed by the application, read back, and rehashed before becoming canonical artifact identities. If an agent response declares attachments, attach the exact returned files here before Parse / validate; a filename, hash claim, or code block is not file possession.</p>`);
replaceOne('app-core.js',
  '${humanStageMarkup(n,locked)}${clarificationMarkup(n,locked)}${operationMarkup(n,locked)}${runBatchMarkup(n)}<div class="panel"><h2 class="section-title">Agent loop</h2>',
  '${humanStageMarkup(n,locked)}${clarificationMarkup(n,locked)}${operationMarkup(n,locked)}${runBatchMarkup(n)}${testExecutionGuidanceMarkup(n)}<div class="panel"><h2 class="section-title">Agent loop</h2>');
replaceOne('app-core.js',
`<div class="panel"><h2 class="section-title">Returned agent response</h2><p class="section-intro">Paste the complete strict JSON response. Parse / validate preserves the raw response first, then validates it without changing canonical project records.</p>`,
`<div class="panel"><h2 class="section-title">Returned agent response</h2><p class="section-intro">Paste the complete strict JSON response. Parse / validate preserves the raw response first, then validates it without changing canonical project records. If the response declares returned files, attach those exact files in Authorized files for this stage before parsing.</p>`);

// Focused semantic regression proof.
replaceOne('verify-prompt-semantics.mjs',
`  if(record.stage===2){
    if(!record.prompt.includes('DESIRED OR SUGGESTED SOURCE COUNT'))issues.push('SOURCE_COUNT_MISSING');`,
`  if(record.stage===6){
    for(const mode of ['APPLICATION_DETERMINISTIC','EXTERNAL_AGENT_TOOL','INDEPENDENT_AGENT_REVIEW','HUMAN_INSPECTION','EXTERNAL_SYSTEM','UNAVAILABLE'])if(!record.prompt.includes(mode))issues.push(\`TEST_EXECUTION_MODE_MISSING_\${mode}\`);
    if(!record.prompt.includes('A TEST record is a verification specification')||!record.prompt.includes('a filename, claimed hash, or code block is not possession of a file'))issues.push('TEST_DEFINITION_ARTIFACT_BOUNDARY_MISSING');
  }
  if(record.stage===12&&(!record.prompt.includes('Respect each test’s EXECUTION_MODE')||!record.prompt.includes('do not claim the test ran')))issues.push('TEST_EXECUTION_RESPONSIBILITY_MISSING');
  if(record.stage===2){
    if(!record.prompt.includes('DESIRED OR SUGGESTED SOURCE COUNT'))issues.push('SOURCE_COUNT_MISSING');`);
insertBefore('verify-prompt-semantics.mjs','let checked=0;',`{
 const test=schema.RECORD_SCHEMAS.tests;
 for(const field of ['EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS'])if(!test.fields.includes(field)||!test.required.includes(field)||test.fieldDefinitions[field]?.producer!==schema.PRODUCER.AGENT)throw new Error(\`TEST execution contract is missing agent field \${field}.\`);
 const modes=test.fieldDefinitions.EXECUTION_MODE.enumValues;
 const expected=['APPLICATION_DETERMINISTIC','EXTERNAL_AGENT_TOOL','INDEPENDENT_AGENT_REVIEW','HUMAN_INSPECTION','EXTERNAL_SYSTEM','UNAVAILABLE'];
 if(JSON.stringify(modes)!==JSON.stringify(expected))throw new Error(\`TEST execution modes changed: \${JSON.stringify(modes)}\`);
 if(core.STAGES[5].title!=='DEFINE THE VERIFICATION SUITE BEFORE WRITING THE PRODUCTION INSTRUCTION')throw new Error('Stage 06 still implies executable test construction rather than verification definition.');
 const ui=fs.readFileSync('app-core.js','utf8');
 if(!ui.includes('Verification execution')||!ui.includes('a filename, hash claim, or code block is not file possession')||!ui.includes('Who performs the current tests'))throw new Error('Operator UI does not explain test execution responsibility and returned-file transfer.');
}
`);
replaceOne('verify-prompt-semantics.mjs',
`console.log(JSON.stringify({promptSemanticContradictions:true,stageOperationsChecked:checked,mutationCasesRejected:mutants.length,stage2SourceCount:true,insufficiencyRecovery:true,operationIsolation:true,applicationOwnership:true,specialistDomains:['patent','software-multifile','physical-engineering-cad-cam-cnc-additive']},null,2));`,
`console.log(JSON.stringify({promptSemanticContradictions:true,stageOperationsChecked:checked,mutationCasesRejected:mutants.length,stage2SourceCount:true,testExecutionOrchestration:true,insufficiencyRecovery:true,operationIsolation:true,applicationOwnership:true,specialistDomains:['patent','software-multifile','physical-engineering-cad-cam-cnc-additive']},null,2));`);

// Gate regression: a mandatory test with no available executor cannot satisfy Stage 06.
insertBefore('verify-complete.mjs','// Invalid canonical relationship is rejected before mutation.',`// Verification definitions explicitly separate execution responsibility and unavailable capability fails closed.
{
  const def=schema.RECORD_SCHEMAS.tests;
  for(const field of ['EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS'])assert(def.required.includes(field)&&def.fieldDefinitions[field]?.producer===schema.PRODUCER.AGENT,\`Missing required TEST execution field \${field}.\`);
  const p=project('JOB-TEST-EXECUTION');
  Object.assign(p.job,{CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001'});
  const scope={inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001'};
  p.projectData.requirements.push({id:'REQ-EXEC-1',stage:4,active:true,scope,fields:{REQ_ID:'REQ-EXEC-1',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'}});
  p.projectData.tests.push({id:'TEST-EXEC-1',stage:6,active:true,scope:{...scope,testSuiteVersion:'TEST-SUITE-v001'},fields:{TEST_ID:'TEST-EXEC-1',REQ_ID:'REQ-EXEC-1',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'UNAVAILABLE',REQUIRED_CAPABILITY:'specialized-capability-not-present',ARTIFACT_REQUIREMENTS:'NONE',INPUTS:'controlled input',TOOLS:'specialized system',PROCEDURE:'execute controlled verification',EXPECTED_RESULT:'satisfied',FAILURE_CONDITION:'required result not established',EVIDENCE_TO_PRESERVE:'execution evidence',STATUS:'READY'},relationships:{REQ_ID:'REQ-EXEC-1'}});
  const plan=engine.testExecutionPlan(p);
  assert(plan.total===1&&plan.unavailableTestIds.includes('TEST-EXEC-1'),'Execution plan did not identify unavailable mandatory capability.');
  const g=engine.gate(6,p);
  assert(g.reasons.some(reason=>reason.includes('unavailable execution capability')),'Stage 06 did not fail closed on unavailable mandatory execution capability.');
}

`);

// README: concise operator/engineering contract, no UI duplication.
insertBefore('README.md','## Data and backup responsibility',`## Verification execution and returned files

A canonical `TEST` is a verification definition, not proof that a script/file exists and not proof that execution occurred. Each test declares an execution mode (`APPLICATION_DETERMINISTIC`, `EXTERNAL_AGENT_TOOL`, `INDEPENDENT_AGENT_REVIEW`, `HUMAN_INSPECTION`, `EXTERNAL_SYSTEM`, or `UNAVAILABLE`), the required capability, any required artifacts, its procedure, expected result, failure condition, and evidence to preserve. `UNAVAILABLE` remains blocking for a mandatory test until a valid capability or equivalent verification path exists.

The static browser is authoritative only for deterministic operations it actually implements. Tool-dependent checks run in the capable external environment; independent reviews use an independent context; irreducible inspections remain human/reviewer work; specialized systems/labs provide their own execution evidence. A test definition, executable/input artifact, and execution result are distinct records of reality.

When an external agent returns an actual file, its response declares the attachment and the operator attaches the exact returned bytes in the stage file control before parsing. The application then verifies the actual filename/media type/byte size/SHA-256 and stores the Blob. A filename, hash claim, repository path, or code block alone never counts as possession of a file, and browser-local bytes are not assumed to be accessible to an external agent.

`);

// Refresh the one shared runtime cache identity after runtime-source edits.
const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const gitBlobSha=file=>{const bytes=fs.readFileSync(file);return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');};
const runtimeManifest=runtimeFiles.map(file=>`${file}:${gitBlobSha(file)}\n`).join('');
const runtimeBuildIdentity=`runtime-${createHash('sha256').update(runtimeManifest).digest('hex').slice(0,16)}`;
let html=read('index.html');
const before=[...html.matchAll(/\?v=runtime-[0-9a-f]{16}/g)].length;
if(before!==runtimeFiles.length)throw new Error(`index.html: expected ${runtimeFiles.length} runtime cache tokens, found ${before}.`);
html=html.replace(/\?v=runtime-[0-9a-f]{16}/g,`?v=${runtimeBuildIdentity}`);
write('index.html',html);

console.log(JSON.stringify({patched:true,runtimeBuildIdentity,files:['workbook.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','app-core.js','verify-prompt-semantics.mjs','verify-complete.mjs','README.md','index.html']},null,2));
