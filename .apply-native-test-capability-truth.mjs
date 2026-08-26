import fs from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>fs.readFileSync(p,'utf8');
const write=(p,t)=>fs.writeFileSync(p,t);
function replaceOne(path,from,to){const text=read(path),a=text.indexOf(from),b=text.lastIndexOf(from);if(a<0)throw new Error(`${path}: anchor not found: ${from.slice(0,120)}`);if(a!==b)throw new Error(`${path}: anchor not unique: ${from.slice(0,120)}`);write(path,text.slice(0,a)+to+text.slice(a+from.length));}
function insertBefore(path,anchor,text){replaceOne(path,anchor,text+anchor);}

// The application must never advertise a per-test native executor that does not exist.
replaceOne('workflow-engine.js',
`const TEST_EXECUTION_ACTIONS=Object.freeze({
  APPLICATION_DETERMINISTIC:'No operator execution is required now. The application may execute only a native deterministic check it actually implements when the exact required inputs are available.',`,
`const APPLICATION_TEST_EXECUTORS=Object.freeze({});
function applicationTestCapabilities(){return Object.freeze(Object.keys(APPLICATION_TEST_EXECUTORS));}
const TEST_EXECUTION_ACTIONS=Object.freeze({
  APPLICATION_DETERMINISTIC:'No operator execution is required only when the exact REQUIRED_CAPABILITY names a registered application-native test executor. Otherwise request a corrected test definition; the browser must not pretend it can run the test.',`);
replaceOne('workflow-engine.js',
`    return {testId:recordId(test,'tests'),requirementId:testRequirementId(test),testType:upper(recordValue(test,'TEST_TYPE'))||'UNKNOWN',executionMode:mode,requiredCapability:String(recordValue(test,'REQUIRED_CAPABILITY')||'').trim(),artifactRequirements:String(recordValue(test,'ARTIFACT_REQUIREMENTS')||'').trim(),operatorAction:TEST_EXECUTION_ACTIONS[mode]||'Execution responsibility is not validly classified.'};`,
`    const requiredCapability=String(recordValue(test,'REQUIRED_CAPABILITY')||'').trim(),applicationExecutorSupported=mode!=='APPLICATION_DETERMINISTIC'||Object.prototype.hasOwnProperty.call(APPLICATION_TEST_EXECUTORS,requiredCapability);
    const operatorAction=mode==='APPLICATION_DETERMINISTIC'&&!applicationExecutorSupported?\`Request a corrected test definition. No application-native executor is registered for \${requiredCapability||'the declared capability'}; use the real capable execution mode or UNAVAILABLE.\`:(TEST_EXECUTION_ACTIONS[mode]||'Execution responsibility is not validly classified.');
    return {testId:recordId(test,'tests'),requirementId:testRequirementId(test),testType:upper(recordValue(test,'TEST_TYPE'))||'UNKNOWN',executionMode:mode,requiredCapability,artifactRequirements:String(recordValue(test,'ARTIFACT_REQUIREMENTS')||'').trim(),applicationExecutorSupported,operatorAction};`);
replaceOne('workflow-engine.js',
`  const incompleteTestIds=items.filter(item=>!TEST_EXECUTION_ACTIONS[item.executionMode]||!item.requiredCapability||!item.artifactRequirements).map(item=>item.testId);
  const unavailableTestIds=items.filter(item=>item.executionMode==='UNAVAILABLE').map(item=>item.testId);
  return {total:items.length,counts,incompleteTestIds,unavailableTestIds,items};`,
`  const incompleteTestIds=items.filter(item=>!TEST_EXECUTION_ACTIONS[item.executionMode]||!item.requiredCapability||!item.artifactRequirements).map(item=>item.testId);
  const unavailableTestIds=items.filter(item=>item.executionMode==='UNAVAILABLE').map(item=>item.testId);
  const unsupportedApplicationTestIds=items.filter(item=>item.executionMode==='APPLICATION_DETERMINISTIC'&&!item.applicationExecutorSupported).map(item=>item.testId);
  return {total:items.length,counts,incompleteTestIds,unavailableTestIds,unsupportedApplicationTestIds,items};`);
replaceOne('workflow-engine.js',
`      const unavailable=mandatoryTests.filter(test=>upper(recordValue(test,'EXECUTION_MODE'))==='UNAVAILABLE');
      if(unavailable.length)reasons.push(\`${unavailable.length} mandatory test definition(s) have unavailable execution capability and remain blocked.\`);`,
`      const unavailable=mandatoryTests.filter(test=>upper(recordValue(test,'EXECUTION_MODE'))==='UNAVAILABLE');
      if(unavailable.length)reasons.push(\`${unavailable.length} mandatory test definition(s) have unavailable execution capability and remain blocked.\`);
      const unsupportedApplication=mandatoryTests.filter(test=>upper(recordValue(test,'EXECUTION_MODE'))==='APPLICATION_DETERMINISTIC'&&!Object.prototype.hasOwnProperty.call(APPLICATION_TEST_EXECUTORS,String(recordValue(test,'REQUIRED_CAPABILITY')||'').trim()));
      if(unsupportedApplication.length)reasons.push(\`${unsupportedApplication.length} mandatory test definition(s) claim APPLICATION_DETERMINISTIC without a registered application-native executor.\`);`);
replaceOne('workflow-engine.js',
`verificationMatrix,evaluateIteration,DERIVATIONS,coverageMetrics,convergenceMetrics,releaseMetrics,testExecutionPlan,operationalMetrics,gate,deriveStageData,recalculate,invalidateDownstream,applicationInitialFields,`,
`verificationMatrix,evaluateIteration,DERIVATIONS,coverageMetrics,convergenceMetrics,releaseMetrics,applicationTestCapabilities,testExecutionPlan,operationalMetrics,gate,deriveStageData,recalculate,invalidateDownstream,applicationInitialFields,`);

// Generated instructions disclose the exact application-native capability registry and require canonical attachment evidence for returned test artifacts.
replaceOne('prompt-engine.js',
`6:'Define this job’s verification suite before any production instruction is authored. A TEST record is a verification specification: it does not by itself prove that an executable test file exists or that any test has run. Every active mandatory requirement must have at least one valid proposed test. Use the strongest suitable method, including exact computation, programmatic checks, schema or structure checks, source comparison, rule-based verification, independent review, human inspection, or specialized external systems where appropriate. For every test define TEST_TYPE, EXECUTION_MODE, REQUIRED_CAPABILITY, ARTIFACT_REQUIREMENTS, inputs, tools, procedure, expected result, failure condition, and evidence to preserve. EXECUTION_MODE must be exactly one of APPLICATION_DETERMINISTIC, EXTERNAL_AGENT_TOOL, INDEPENDENT_AGENT_REVIEW, HUMAN_INSPECTION, EXTERNAL_SYSTEM, or UNAVAILABLE. APPLICATION_DETERMINISTIC is valid only for a native deterministic check the application actually implements; it does not make this static browser a universal compiler, script runner, CAD/CAE tool, lab, or machine controller. Create executable test artifacts only when an executable artifact is actually the appropriate verification mechanism. If you actually return a test fixture, script, model, report, or other file, declare it in attachments and return the exact file through the external environment so the operator can attach its bytes; a filename, claimed hash, or code block is not possession of a file. Use ARTIFACT_REQUIREMENTS = NONE when no separate executable/input artifact is required. If the required capability is unavailable and no valid equivalent path exists, use EXECUTION_MODE = UNAVAILABLE and do not pretend the test can run. The application assigns TEST_ID, controlled test-suite identity, and exact mandatory requirement-to-test coverage; do not assert those application-owned values.',`,
`6:'Define this job’s verification suite before any production instruction is authored. A TEST record is a verification specification: it does not by itself prove that an executable test file exists or that any test has run. Every active mandatory requirement must have at least one valid proposed test. Use the strongest suitable method, including exact computation, programmatic checks, schema or structure checks, source comparison, rule-based verification, independent review, human inspection, or specialized external systems where appropriate. For every test define TEST_TYPE, EXECUTION_MODE, REQUIRED_CAPABILITY, ARTIFACT_REQUIREMENTS, inputs, tools, procedure, expected result, failure condition, and evidence to preserve. EXECUTION_MODE must be exactly one of APPLICATION_DETERMINISTIC, EXTERNAL_AGENT_TOOL, INDEPENDENT_AGENT_REVIEW, HUMAN_INSPECTION, EXTERNAL_SYSTEM, or UNAVAILABLE. APPLICATION_DETERMINISTIC is reserved for an exact REQUIRED_CAPABILITY listed in APPLICATION-NATIVE TEST CAPABILITIES in this controlling prompt. If that list is NONE, do not select APPLICATION_DETERMINISTIC; use the real capable executor or UNAVAILABLE. This static browser is not a universal compiler, script runner, CAD/CAE tool, lab, or machine controller. Create executable test artifacts only when an executable artifact is actually the appropriate verification mechanism. If you actually return a test fixture, script, model, report, or other file, declare it as a required attachment, create an evidence entry whose attachmentRef points to that attachment temporaryKey, and include that evidence temporaryKey in the corresponding TEST record evidenceRefs. Return the exact file through the external environment so the operator can attach its bytes; a filename, claimed hash, repository path, or code block is not possession of a file. This yields the canonical TEST -> EVIDENCE_ID -> ATTACHMENT_ID trace after validated ingestion. Use ARTIFACT_REQUIREMENTS = NONE when no separate executable/input artifact is required. If the required capability is unavailable and no valid equivalent path exists, use EXECUTION_MODE = UNAVAILABLE and do not pretend the test can run. The application assigns TEST_ID, controlled test-suite identity, and exact mandatory requirement-to-test coverage; do not assert those application-owned values.',`);
replaceOne('prompt-engine.js',
`AUTHORIZED BOUNDED CONTEXT FOR THIS STAGE
${contextFor(stage,state,operation,scope)}

STAGE-SPECIFIC TASK`,
`AUTHORIZED BOUNDED CONTEXT FOR THIS STAGE
${contextFor(stage,state,operation,scope)}

APPLICATION-NATIVE TEST CAPABILITIES
${workflow.applicationTestCapabilities().length?workflow.applicationTestCapabilities().join('\\n'):'NONE'}

STAGE-SPECIFIC TASK`);
replaceOne('prompt-engine.js',
`12:'Verify each current execution independently. Execute only the currently missing REQ_ID × RUN_ID × TEST_ID triples listed by the application in VERIFICATION BATCH PLAN, in listed order. Respect each test’s EXECUTION_MODE, REQUIRED_CAPABILITY, ARTIFACT_REQUIREMENTS, and actual artifact accessibility. Never substitute a different executor merely because it is convenient. APPLICATION_DETERMINISTIC means only a native application check that actually exists; an external verifier must not fabricate that execution.`,
`12:'Verify each current execution independently. Execute only the currently missing REQ_ID × RUN_ID × TEST_ID triples listed by the application in VERIFICATION BATCH PLAN, in listed order. Respect each test’s EXECUTION_MODE, REQUIRED_CAPABILITY, ARTIFACT_REQUIREMENTS, and actual artifact accessibility. Never substitute a different executor merely because it is convenient. APPLICATION_DETERMINISTIC is valid only for a capability explicitly listed in APPLICATION-NATIVE TEST CAPABILITIES; if none is registered, the test definition is invalid and must be corrected rather than externally fabricated. An external verifier must not fabricate application-native execution.`);

// Synthetic fixtures must not claim nonexistent native execution. They use a real external execution lane unless a test explicitly overrides it.
replaceOne('test-fixtures.mjs',
`export function scalarFor(def,name,overrides={}){
  if(Object.hasOwn(overrides,name))return overrides[name];
  if(def.enumValues?.length)return def.enumValues[0];`,
`export function scalarFor(def,name,overrides={}){
  if(Object.hasOwn(overrides,name))return overrides[name];
  if(String(name).toUpperCase()==='EXECUTION_MODE')return 'EXTERNAL_AGENT_TOOL';
  if(def.enumValues?.length)return def.enumValues[0];`);

// Operator guidance must expose unsupported application-native claims as a correction, not as "no action required".
replaceOne('app-core.js',
`  return \`<div class="panel"><h2 class="section-title">Verification execution</h2><p class="section-intro">${esc(intro)}</p>${summary?\`<div class="stage-action-strip">${summary}</div>\`:''}${plan.unavailableTestIds.length?\`<div class="notice warn">${plan.unavailableTestIds.length} test${plan.unavailableTestIds.length===1?' is':'s are'} blocked by unavailable capability. Do not claim execution until a valid capability or equivalent verification path exists.</div>\`:''}${actionRows.length?details('Who performs the current tests',actionRows):'<div class="notice">For each test, the agent must declare the execution mode, required capability, artifact requirements, procedure, expected result, failure condition, and evidence.</div>'}</div>\`;`,
`  return \`<div class="panel"><h2 class="section-title">Verification execution</h2><p class="section-intro">${esc(intro)}</p>${summary?\`<div class="stage-action-strip">${summary}</div>\`:''}${plan.unavailableTestIds.length?\`<div class="notice warn">${plan.unavailableTestIds.length} test${plan.unavailableTestIds.length===1?' is':'s are'} blocked by unavailable capability. Do not claim execution until a valid capability or equivalent verification path exists.</div>\`:''}${plan.unsupportedApplicationTestIds.length?\`<div class="notice danger">${plan.unsupportedApplicationTestIds.length} test${plan.unsupportedApplicationTestIds.length===1?' claims':'s claim'} application-native execution without a registered executor. Request a corrected Stage 6 test definition; do not run or accept a substitute execution.</div>\`:''}${actionRows.length?details('Who performs the current tests',actionRows):'<div class="notice">For each test, the agent must declare the execution mode, required capability, artifact requirements, procedure, expected result, failure condition, and evidence.</div>'}</div>\`;`);

// Semantic and gate regressions close both false-native-executor and canonical test-artifact linkage instructions.
replaceOne('verify-prompt-semantics.mjs',
`    if(!record.prompt.includes('A TEST record is a verification specification')||!record.prompt.includes('a filename, claimed hash, or code block is not possession of a file'))issues.push('TEST_DEFINITION_ARTIFACT_BOUNDARY_MISSING');`,
`    if(!record.prompt.includes('A TEST record is a verification specification')||!record.prompt.includes('a filename, claimed hash, repository path, or code block is not possession of a file'))issues.push('TEST_DEFINITION_ARTIFACT_BOUNDARY_MISSING');
    if(!record.prompt.includes('APPLICATION-NATIVE TEST CAPABILITIES\\nNONE')||!record.prompt.includes('do not select APPLICATION_DETERMINISTIC'))issues.push('UNREGISTERED_APPLICATION_EXECUTOR_NOT_BLOCKED');
    if(!record.prompt.includes('TEST -> EVIDENCE_ID -> ATTACHMENT_ID')||!record.prompt.includes('attachmentRef')||!record.prompt.includes('evidenceRefs'))issues.push('TEST_ARTIFACT_CANONICAL_LINK_MISSING');`);
insertBefore('verify-prompt-semantics.mjs','let checked=0;',`{
 const fixture=fs.readFileSync('test-fixtures.mjs','utf8');
 if(!fixture.includes("EXECUTION_MODE')return 'EXTERNAL_AGENT_TOOL'"))throw new Error('Synthetic fixtures still default to a nonexistent application-native executor.');
 if(workflow.applicationTestCapabilities().length!==0)throw new Error('A native test capability was registered without a proven application executor test in this patch.');
 const ui=fs.readFileSync('app-core.js','utf8');
 if(!ui.includes('application-native execution without a registered executor'))throw new Error('Operator UI does not fail unsupported application-native test claims closed.');
}
`);
insertBefore('verify-complete.mjs','// Invalid canonical relationship is rejected before mutation.',`// APPLICATION_DETERMINISTIC cannot satisfy Stage 06 unless an actual application-native executor is registered.
{
  assert(engine.applicationTestCapabilities().length===0,'Unexpected application-native executor registration.');
  const p=project('JOB-NATIVE-EXECUTOR-TRUTH');
  Object.assign(p.job,{CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001'});
  const scope={inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001'};
  p.projectData.requirements.push({id:'REQ-NATIVE-1',stage:4,active:true,scope,fields:{REQ_ID:'REQ-NATIVE-1',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'}});
  p.projectData.tests.push({id:'TEST-NATIVE-1',stage:6,active:true,scope:{...scope,testSuiteVersion:'TEST-SUITE-v001'},fields:{TEST_ID:'TEST-NATIVE-1',REQ_ID:'REQ-NATIVE-1',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:'NONEXISTENT_NATIVE_EXECUTOR',ARTIFACT_REQUIREMENTS:'NONE',INPUTS:'canonical input',TOOLS:'application',PROCEDURE:'native check',EXPECTED_RESULT:'satisfied',FAILURE_CONDITION:'not satisfied',EVIDENCE_TO_PRESERVE:'derived evidence',STATUS:'READY'},relationships:{REQ_ID:'REQ-NATIVE-1'}});
  const plan=engine.testExecutionPlan(p);
  assert(plan.unsupportedApplicationTestIds.includes('TEST-NATIVE-1'),'Execution plan did not identify unsupported application-native test execution.');
  const g=engine.gate(6,p);
  assert(g.reasons.some(reason=>reason.includes('without a registered application-native executor')),'Stage 06 accepted an APPLICATION_DETERMINISTIC test with no actual executor.');
}

`);

replaceOne('README.md',
`The static browser is authoritative only for deterministic operations it actually implements. Tool-dependent checks run in the capable external environment; independent reviews use an independent context; irreducible inspections remain human/reviewer work; specialized systems/labs provide their own execution evidence. A test definition, executable/input artifact, and execution result are distinct records of reality.`,
`The static browser is authoritative only for deterministic operations it actually implements. APPLICATION_DETERMINISTIC is accepted only when the controlling prompt lists an exact registered application-native test capability; the current registry is intentionally empty until a per-test executor is implemented and proven, so the mode cannot be used as a fictional shortcut. Tool-dependent checks run in the capable external environment; independent reviews use an independent context; irreducible inspections remain human/reviewer work; specialized systems/labs provide their own execution evidence. A test definition, executable/input artifact, and execution result are distinct records of reality.`);
replaceOne('README.md',
`When an external agent returns an actual file, its response declares the attachment and the operator attaches the exact returned bytes in the stage file control before parsing. The application then verifies the actual filename/media type/byte size/SHA-256 and stores the Blob. A filename, hash claim, repository path, or code block alone never counts as possession of a file, and browser-local bytes are not assumed to be accessible to an external agent.`,
`When an external agent returns an actual test file, its response declares the required attachment, creates evidence whose attachmentRef names that response-local attachment, and references that evidence from the TEST record. The operator attaches the exact returned bytes in the stage file control before parsing. The application then verifies the actual filename/media type/byte size/SHA-256, stores the Blob, and canonicalizes the TEST -> EVIDENCE_ID -> ATTACHMENT_ID trace. A filename, hash claim, repository path, or code block alone never counts as possession of a file, and browser-local bytes are not assumed to be accessible to an external agent.`);

const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const gitBlobSha=file=>{const bytes=fs.readFileSync(file);return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');};
const runtimeManifest=runtimeFiles.map(file=>`${file}:${gitBlobSha(file)}\n`).join('');
const runtimeBuildIdentity=`runtime-${createHash('sha256').update(runtimeManifest).digest('hex').slice(0,16)}`;
let html=read('index.html');const tokens=[...html.matchAll(/\?v=runtime-[0-9a-f]{16}/g)].length;if(tokens!==runtimeFiles.length)throw new Error(`Expected ${runtimeFiles.length} runtime tokens, found ${tokens}.`);html=html.replace(/\?v=runtime-[0-9a-f]{16}/g,`?v=${runtimeBuildIdentity}`);write('index.html',html);
console.log(JSON.stringify({patched:true,runtimeBuildIdentity},null,2));
