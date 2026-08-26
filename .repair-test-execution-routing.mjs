import fs from 'node:fs';
import {createHash} from 'node:crypto';

const read=f=>fs.readFileSync(f,'utf8');
const write=(f,s)=>fs.writeFileSync(f,s);
const once=(s,from,to,label)=>{const i=s.indexOf(from);if(i<0)throw new Error(`Missing patch anchor: ${label}`);if(s.indexOf(from,i+1)>=0)throw new Error(`Ambiguous patch anchor: ${label}`);return s.slice(0,i)+to+s.slice(i+from.length);};
const regexOnce=(s,re,to,label)=>{const matches=[...s.matchAll(new RegExp(re.source,re.flags.includes('g')?re.flags:re.flags+'g'))];if(matches.length!==1)throw new Error(`${label}: expected 1 match, found ${matches.length}`);return s.replace(re,to);};

// workflow-schema.js — add only execution routing metadata and one missing Stage 7 execution identity.
{
 let s=read('workflow-schema.js');
 s=once(s,
  "const RESPONSE_TYPES=Object.freeze(['DATA_PROPOSAL','HUMAN_INPUT_REQUIRED','BLOCKED','EXECUTION_FAILED']);",
  "const RESPONSE_TYPES=Object.freeze(['DATA_PROPOSAL','HUMAN_INPUT_REQUIRED','BLOCKED','EXECUTION_FAILED']);\nconst EXECUTION_MODES=Object.freeze(['EXTERNAL_AGENT_TOOL','INDEPENDENT_AGENT_REVIEW','HUMAN_INSPECTION','EXTERNAL_SYSTEM','APPLICATION_DETERMINISTIC','UNAVAILABLE']);\n// Stage-6 APPLICATION_DETERMINISTIC is reserved for explicitly implemented native job-test executors. Workflow integrity checks remain application derivations, not Stage-6 test executions.\nconst APPLICATION_NATIVE_TEST_CAPABILITIES=Object.freeze([]);",
  'execution mode constants');
 s=once(s,
  '      "EVIDENCE_TO_PRESERVE"\n    ],\n    "application": [\n      "TEST_ID",',
  '      "EVIDENCE_TO_PRESERVE",\n      "EXECUTION_MODE",\n      "REQUIRED_CAPABILITIES",\n      "ARTIFACT_REQUIRED"\n    ],\n    "application": [\n      "TEST_ID",',
  'test ownership routing');
 s=once(s,
  '      "EXPECTED_REJECTION",\n      "ACTUAL_RESULT",\n      "EVIDENCE"\n    ],\n    "application": [\n      "MUTATION_ID",',
  '      "EXPECTED_REJECTION",\n      "EVIDENCE",\n      "EXECUTION_MODE",\n      "REQUIRED_CAPABILITIES",\n      "ARTIFACT_REQUIRED"\n    ],\n    "application": [\n      "MUTATION_ID",\n      "ACTUAL_RESULT",',
  'failure-test definition ownership');
 // Stage 7 execution result is a distinct canonical identity. Insert before instructions ownership.
 s=once(s,
  '  "instructions": {',
  '  "failureTestExecutions": {\n    "human": [],\n    "humanDecision": [],\n    "agent": [\n      "EXECUTOR",\n      "TOOL_AND_VERSION",\n      "OBSERVED_RESULT",\n      "DETERMINATION",\n      "EVIDENCE"\n    ],\n    "application": [\n      "FAILURE_EXEC_ID",\n      "MUTATION_ID",\n      "REQ_ID"\n    ]\n  },\n  "instructions": {',
  'failure-test execution ownership');
 // Existing regression result-summary fields remain recognized for backward compatibility but are no longer agent authority.
 s=once(s,
  '      "DETECTION_METHOD",\n      "PRE_CORRECTION_RESULT",\n      "PRE_CORRECTION_EVIDENCE",\n      "CORRECTION",\n      "POST_CORRECTION_RESULT",\n      "POST_CORRECTION_EVIDENCE",\n      "PERMANENT_TEST_LOCATION",\n      "APPLICABILITY",\n      "RETIREMENT_AUTHORITY"\n    ],\n    "application": [\n      "REG_ID",',
  '      "DETECTION_METHOD",\n      "CORRECTION",\n      "PERMANENT_TEST_LOCATION",\n      "APPLICABILITY",\n      "RETIREMENT_AUTHORITY",\n      "EXECUTION_MODE",\n      "REQUIRED_CAPABILITIES",\n      "ARTIFACT_REQUIRED"\n    ],\n    "application": [\n      "REG_ID",\n      "PRE_CORRECTION_RESULT",\n      "PRE_CORRECTION_EVIDENCE",\n      "POST_CORRECTION_RESULT",\n      "POST_CORRECTION_EVIDENCE",',
  'regression definition/result authority');
 const oldOverride="  'TEST':Object.freeze({TEST_TYPE:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['DETERMINISTIC','MEANING','ADVERSARIAL']),nullable:false,normalizerKey:null,closedProperties:null})}),";
 const routeTypes="EXECUTION_MODE:Object.freeze({valueType:'STRING',enumValues:EXECUTION_MODES,nullable:false,normalizerKey:null,closedProperties:null}),REQUIRED_CAPABILITIES:Object.freeze({valueType:'STRING_ARRAY',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),ARTIFACT_REQUIRED:Object.freeze({valueType:'BOOLEAN',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})";
 s=once(s,oldOverride,
  `  'TEST':Object.freeze({TEST_TYPE:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['DETERMINISTIC','MEANING','ADVERSARIAL']),nullable:false,normalizerKey:null,closedProperties:null}),${routeTypes}}),\n  'MUTATION':Object.freeze({${routeTypes}}),\n  'MUTATION-EXEC':Object.freeze({DETERMINATION:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['SATISFIED','VIOLATED','UNDETERMINED']),nullable:false,normalizerKey:null,closedProperties:null})}),\n  'REG':Object.freeze({${routeTypes}}),`,
  'record execution type overrides');
 s=once(s,
  "    'TEST_ID','REQ_ID','TEST_TYPE','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','STATUS'\n  ],required:['TEST_TYPE','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','STATUS'],relationships:{REQ_ID:'requirements'}}),",
  "    'TEST_ID','REQ_ID','TEST_TYPE','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','EXECUTION_MODE','REQUIRED_CAPABILITIES','ARTIFACT_REQUIRED','STATUS'\n  ],required:['TEST_TYPE','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','EXECUTION_MODE','REQUIRED_CAPABILITIES','ARTIFACT_REQUIRED','STATUS'],relationships:{REQ_ID:'requirements'}}),",
  'test schema routing fields');
 s=once(s,
  "    'MUTATION_ID','REQ_ID','VIOLATION_MODE','FIXTURE','EXPECTED_REJECTION','ACTUAL_RESULT','VALIDATOR_DEFECT_ID','EVIDENCE'\n  ],required:['VIOLATION_MODE','FIXTURE','EXPECTED_REJECTION','EVIDENCE'],relationships:{REQ_ID:'requirements',VALIDATOR_DEFECT_ID:'defects'}}),",
  "    'MUTATION_ID','REQ_ID','VIOLATION_MODE','FIXTURE','EXPECTED_REJECTION','ACTUAL_RESULT','VALIDATOR_DEFECT_ID','EVIDENCE','EXECUTION_MODE','REQUIRED_CAPABILITIES','ARTIFACT_REQUIRED'\n  ],required:['VIOLATION_MODE','FIXTURE','EXPECTED_REJECTION','EVIDENCE','EXECUTION_MODE','REQUIRED_CAPABILITIES','ARTIFACT_REQUIRED'],relationships:{REQ_ID:'requirements',VALIDATOR_DEFECT_ID:'defects'}}),\n  failureTestExecutions:recordSchema({ownership:RECORD_OWNERSHIP.failureTestExecutions,commitPolicy:COLLECTION_POLICIES.APPEND_SCOPED,title:'Failure-test executions',idField:'FAILURE_EXEC_ID',prefix:'MUTATION-EXEC',stage:7,fields:[\n    'FAILURE_EXEC_ID','MUTATION_ID','REQ_ID','EXECUTOR','TOOL_AND_VERSION','OBSERVED_RESULT','DETERMINATION','EVIDENCE'\n  ],required:['EXECUTOR','TOOL_AND_VERSION','OBSERVED_RESULT','DETERMINATION','EVIDENCE'],relationships:{MUTATION_ID:'failureTests',REQ_ID:'requirements'}}),",
  'failure test execution schema');
 s=once(s,
  "    'REG_ID','DEFECT_ID','REQ_ID','FAILURE_FIXTURE','FIXTURE_IDENTITY_HASH','REPRODUCTION_PROCEDURE','DETECTION_METHOD','PRE_CORRECTION_RESULT',\n    'PRE_CORRECTION_EVIDENCE','CORRECTION','POST_CORRECTION_RESULT','POST_CORRECTION_EVIDENCE','PERMANENT_TEST_LOCATION','APPLICABILITY','ACTIVE_RETIRED_STATE','RETIREMENT_AUTHORITY'\n  ],required:['FAILURE_FIXTURE','REPRODUCTION_PROCEDURE','DETECTION_METHOD','PRE_CORRECTION_RESULT','PRE_CORRECTION_EVIDENCE','CORRECTION','PERMANENT_TEST_LOCATION','APPLICABILITY','ACTIVE_RETIRED_STATE'],relationships:{DEFECT_ID:'defects',REQ_ID:'requirements'}}),",
  "    'REG_ID','DEFECT_ID','REQ_ID','FAILURE_FIXTURE','FIXTURE_IDENTITY_HASH','REPRODUCTION_PROCEDURE','DETECTION_METHOD','PRE_CORRECTION_RESULT',\n    'PRE_CORRECTION_EVIDENCE','CORRECTION','POST_CORRECTION_RESULT','POST_CORRECTION_EVIDENCE','PERMANENT_TEST_LOCATION','APPLICABILITY','ACTIVE_RETIRED_STATE','RETIREMENT_AUTHORITY','EXECUTION_MODE','REQUIRED_CAPABILITIES','ARTIFACT_REQUIRED'\n  ],required:['FAILURE_FIXTURE','REPRODUCTION_PROCEDURE','DETECTION_METHOD','CORRECTION','PERMANENT_TEST_LOCATION','APPLICABILITY','ACTIVE_RETIRED_STATE','EXECUTION_MODE','REQUIRED_CAPABILITIES','ARTIFACT_REQUIRED'],relationships:{DEFECT_ID:'defects',REQ_ID:'requirements'}}),",
  'regression schema routing');
 s=once(s,"  7:['failureTests'],","  7:['failureTests','failureTestExecutions'],",'stage 7 writable collections');
 s=once(s,"7:['requirements','tests'],8:['requirements','tests','failureTests','requirementResolutions']","7:['requirements','tests'],8:['requirements','tests','failureTests','failureTestExecutions','requirementResolutions']",'stage 8 read context');
 s=once(s,
  '  PRODUCER,RESPONSE_SCHEMA,RESPONSE_TYPES,CONFLICT_POLICIES,',
  '  PRODUCER,RESPONSE_SCHEMA,RESPONSE_TYPES,EXECUTION_MODES,APPLICATION_NATIVE_TEST_CAPABILITIES,CONFLICT_POLICIES,',
  'schema exports');
 write('workflow-schema.js',s);
}

// workbook.js — clarify the declaration, execution, and result chronology without changing stages.
{
 let s=read('workbook.js');
 s=once(s,
  "'Create at least one verification procedure for every mandatory requirement before production instructions are authored.'",
  "'Define at least one complete verification specification for every mandatory requirement, including execution responsibility, required capability, test-artifact need, expected result, failure condition, and evidence; executable artifacts are created only when they are the appropriate mechanism.'",
  'stage 6 result');
 s=once(s,
  "'Prove that validators reject known-invalid cases.'",
  "'Define known-invalid fixtures separately from their execution results, then prove rejection in an actually capable environment or remain blocked.'",
  'stage 7 result');
 s=once(s,
  "6:['Every mandatory requirement has a ready test','Deterministic properties use deterministic tests','Mandatory test coverage equals 1.00 or stage is blocked','Test suite has a controlled identity']",
  "6:['Every mandatory requirement has a routed ready test','Every ready test declares execution responsibility, required capability, and whether exact test-artifact bytes are required','Deterministic properties use deterministic tests','Mandatory test coverage equals 1.00 or stage is blocked','Test suite has a controlled identity']",
  'stage 6 gate language');
 s=once(s,
  "7:['Every active requirement has a failure analysis','Every applicable validator executed against invalid fixtures','No accepted invalid fixture remains without a validator defect','Failure fixtures are preserved']",
  "7:['Every active requirement has a failure-test definition','Every failure-test definition has a separate current execution result','Every applicable validator executed against invalid fixtures in a capable environment','No accepted invalid fixture remains without a validator defect','Failure fixtures and required artifact bytes are preserved']",
  'stage 7 gate language');
 write('workbook.js',s);
}

// workflow-engine.js — one generic routing view and fail-closed gates; no universal test runner.
{
 let s=read('workflow-engine.js');
 const anchor="function testRequirementId(record){return String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'');}\n";
 const addition=`function evidenceArtifactIds(project,record){const ids=[];for(const evidenceId of safe(record?.evidenceRefs)){const evidence=records(project,'evidenceRecords').find(item=>recordId(item,'evidenceRecords')===String(evidenceId));const artifactId=String(recordValue(evidence,'ATTACHMENT_ID')||'').trim();if(artifactId&&records(project,'artifacts').some(item=>recordId(item,'artifacts')===artifactId))ids.push(artifactId);}return [...new Set(ids)];}\nfunction testDefinitionReady(project,record){const mode=upper(recordValue(record,'EXECUTION_MODE')),capabilities=safe(recordValue(record,'REQUIRED_CAPABILITIES')),artifactRequired=recordValue(record,'ARTIFACT_REQUIRED')===true||upper(recordValue(record,'ARTIFACT_REQUIRED'))==='TRUE';if(!schema.EXECUTION_MODES.includes(mode)||mode==='UNAVAILABLE')return false;if(!capabilities.length)return false;if(mode==='APPLICATION_DETERMINISTIC'&&!capabilities.some(capability=>schema.APPLICATION_NATIVE_TEST_CAPABILITIES.includes(String(capability))))return false;if(artifactRequired&&!evidenceArtifactIds(project,record).length)return false;return true;}\nfunction testExecutionPlan(project,collection='tests',scopeRule=null){ensureShape(project);const source=scopeRule?recordsForScope(project,collection,scopeRule):recordsForCurrentScope(project,collection);return source.map(record=>{const mode=upper(recordValue(record,'EXECUTION_MODE'))||'UNCLASSIFIED',capabilities=safe(recordValue(record,'REQUIRED_CAPABILITIES')),artifactRequired=recordValue(record,'ARTIFACT_REQUIRED')===true||upper(recordValue(record,'ARTIFACT_REQUIRED'))==='TRUE',artifactIds=evidenceArtifactIds(project,record),ready=testDefinitionReady(project,record);let action;if(mode==='EXTERNAL_AGENT_TOOL')action='Run the generated verifier instruction in an agent/tool environment that actually has the listed capabilities and exact inputs.';else if(mode==='INDEPENDENT_AGENT_REVIEW')action='Use the generated verifier instruction in a fresh independent reviewer context.';else if(mode==='HUMAN_INSPECTION')action='Provide only the irreducible human inspection answer when the workflow asks for it.';else if(mode==='EXTERNAL_SYSTEM')action='Use the required external system/lab/machine and attach or reference the resulting canonical evidence.';else if(mode==='APPLICATION_DETERMINISTIC')action=ready?'No operator action: an explicitly supported application-native checker owns this test.':'No native executor is advertised for this test; reclassify it or provide a supported native capability.';else action='Blocked until an executable verification route exists.';if(artifactRequired&&!artifactIds.length)action='Attach the exact required test/fixture artifact bytes before this definition is ready.';return {collection,id:recordId(record,collection),requirementId:String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||''),mode,capabilities,artifactRequired,artifactIds,ready,action};});}\n`;
 s=once(s,anchor,anchor+addition,'routing helpers');
 s=once(s,
  "function applicableTests(project,requirement,scopeRule=null){const req=requirementId(requirement),source=scopeRule?recordsForScope(project,'tests',scopeRule):recordsForCurrentScope(project,'tests');return source.filter(test=>testRequirementId(test)===req&&!['RETIRED','BLOCKED','NOT READY'].includes(upper(recordValue(test,'STATUS')||'READY')));}",
  "function applicableTests(project,requirement,scopeRule=null){const req=requirementId(requirement),source=scopeRule?recordsForScope(project,'tests',scopeRule):recordsForCurrentScope(project,'tests');return source.filter(test=>testRequirementId(test)===req&&!['RETIRED','BLOCKED','NOT READY'].includes(upper(recordValue(test,'STATUS')||'READY'))&&testDefinitionReady(project,test));}",
  'applicable tests use routable definitions');
 s=once(s,
  "tests=iterationId?recordsForScope(project,'tests',scope):recordsForCurrentScope(project,'tests'),covered=new Set(tests.map(testRequirementId).filter(Boolean));",
  "tests=(iterationId?recordsForScope(project,'tests',scope):recordsForCurrentScope(project,'tests')).filter(test=>testDefinitionReady(project,test)),covered=new Set(tests.map(testRequirementId).filter(Boolean));",
  'coverage routable tests');
 s=once(s,
  "      if(metrics.requirementCoverage!==1)reasons.push(`Mandatory requirement-to-test coverage is ${(metrics.requirementCoverage*100).toFixed(2)}%, not 100%.`);\n      break;",
  "      if(metrics.requirementCoverage!==1)reasons.push(`Mandatory requirement-to-test coverage is ${(metrics.requirementCoverage*100).toFixed(2)}%, not 100%.`);\n      const routing=testExecutionPlan(project,'tests');for(const item of routing)if(!item.ready)reasons.push(`Test ${item.id||'UNASSIGNED'} is not execution-ready: ${item.action}`);\n      break;",
  'stage 6 routing gate');
 s=once(s,
  "      const reqs=mandatoryRequirements(project),covered=new Set(all('failureTests').map(testRequirementId));\n      const missing=reqs.filter(req=>!covered.has(requirementId(req))).map(requirementId);\n      if(missing.length)reasons.push(`Failure tests are missing for: ${missing.join(', ')}.`);\n      if(all('failureTests').some(record=>truth(recordValue(record,'ACTUAL_RESULT'))&&upper(recordValue(record,'EXPECTED_REJECTION')).includes('REJECT')))reasons.push('A known-invalid fixture was accepted.');",
  "      const reqs=mandatoryRequirements(project),definitions=all('failureTests'),covered=new Set(definitions.filter(record=>testDefinitionReady(project,record)).map(testRequirementId));\n      const missing=reqs.filter(req=>!covered.has(requirementId(req))).map(requirementId);\n      if(missing.length)reasons.push(`Routed failure-test definitions are missing for: ${missing.join(', ')}.`);\n      const executions=all('failureTestExecutions');for(const definition of definitions){const mutationId=recordId(definition,'failureTests'),expectedReq=testRequirementId(definition),matches=executions.filter(result=>String(recordValue(result,'MUTATION_ID')||result.relationships?.MUTATION_ID||'')===mutationId);if(!testDefinitionReady(project,definition))reasons.push(`Failure test ${mutationId} is not execution-ready.`);if(matches.length!==1)reasons.push(`Failure test ${mutationId} requires exactly one current execution result; found ${matches.length}.`);else{const result=matches[0],actualReq=String(recordValue(result,'REQ_ID')||result.relationships?.REQ_ID||'');if(actualReq!==expectedReq)reasons.push(`Failure execution ${recordId(result,'failureTestExecutions')} targets the wrong requirement.`);const determination=upper(recordValue(result,'DETERMINATION'));if(determination==='VIOLATED')reasons.push(`Known-invalid fixture ${mutationId} was accepted or otherwise violated the expected rejection.`);if(determination==='UNDETERMINED')reasons.push(`Failure execution ${recordId(result,'failureTestExecutions')} is UNDETERMINED.`);}}",
  'stage 7 separate execution gate');
 s=once(s,
  "case 15:{requireAccepted();const defects=confirmedDefects(project),regs=records(project,'regressions'),covered=new Map(regs.map(r=>[String(recordValue(r,'DEFECT_ID')||r.relationships?.DEFECT_ID||''),r]));",
  "case 15:{requireAccepted();const defects=confirmedDefects(project),regs=records(project,'regressions'),covered=new Map(regs.map(r=>[String(recordValue(r,'DEFECT_ID')||r.relationships?.DEFECT_ID||''),r]));for(const reg of regs)if(!testDefinitionReady(project,reg))reasons.push(`Regression ${recordId(reg,'regressions')} is not execution-ready.`);",
  'stage 15 regression routing');
 s=once(s,
  'currentScope,recordsForScope,recordsForCurrentScope,scopeForIteration,recordsForIteration,verificationMatrix,evaluateIteration,DERIVATIONS,coverageMetrics,convergenceMetrics,releaseMetrics,operationalMetrics,gate,deriveStageData,recalculate,invalidateDownstream,applicationInitialFields,',
  'currentScope,recordsForScope,recordsForCurrentScope,scopeForIteration,recordsForIteration,evidenceArtifactIds,testDefinitionReady,testExecutionPlan,verificationMatrix,evaluateIteration,DERIVATIONS,coverageMetrics,convergenceMetrics,releaseMetrics,operationalMetrics,gate,deriveStageData,recalculate,invalidateDownstream,applicationInitialFields,',
  'engine exports');
 write('workflow-engine.js',s);
}

// response-ingestion.js — artifact-required definitions must point through canonical evidence to verified bytes; duplicate identity includes file set.
{
 let s=read('response-ingestion.js');
 const objectLine="const object=value=>value&&typeof value==='object'&&!Array.isArray(value);";
 s=once(s,objectLine,objectLine+"\nconst fileSetSha256=files=>hash.sha256Value(safe(files).map(file=>({artifactId:String(file?.artifactId||file?.id||''),filename:String(file?.name??file?.filename??''),mediaType:String(file?.type??file?.mediaType??''),byteSize:Number(file?.size??file?.byteSize??0),sha256:String(file?.sha256||'').toLowerCase()})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));",'file-set identity helper');
 const evidenceAnchor="    if(hasAgentData&&!safe(record.evidenceRefs).length)issues.push(issue('MISSING_PROVENANCE',`${path}/evidenceRefs`,'Agent-produced canonical record data requires at least one evidence reference.'));";
 const artifactRule="\n    if(['tests','failureTests','regressions'].includes(collection)&&record?.fields?.ARTIFACT_REQUIRED===true){const hasVerifiedArtifact=safe(record.evidenceRefs).some(ref=>{const evidence=evidenceIndex.get(String(ref))?.evidence,attachment=evidence?.attachmentRef;if(!attachment)return false;if(attachment.tempKey)return attachmentIndex.has(String(attachment.tempKey));if(attachment.recordId)return workflow.records(project,'artifacts',{active:true}).some(item=>workflow.recordId(item,'artifacts')===String(attachment.recordId));return false;});if(!hasVerifiedArtifact)issues.push(issue('MISSING_REQUIRED_TEST_ARTIFACT',`${path}/evidenceRefs`,'This test definition requires an exact artifact, but no referenced evidence resolves to application-verified artifact bytes.'));}";
 s=once(s,evidenceAnchor,evidenceAnchor+artifactRule,'required test artifact validation');
 s=once(s,
  "const priorCanonicalEnvelope=safe(project.projectData.rawResponses).find(record=>record.canonicalEnvelopeSha256===canonicalEnvelopeSha256&&Number(record.stage)===stageNumber&&(record.promptInstructionId||'')===(promptRecord?.instructionId||promptRecord?.promptId||''));",
  "const currentFileSet=fileSetSha256(suppliedFiles);const priorCanonicalEnvelope=safe(project.projectData.rawResponses).find(record=>record.canonicalEnvelopeSha256===canonicalEnvelopeSha256&&Number(record.stage)===stageNumber&&(record.promptInstructionId||'')===(promptRecord?.instructionId||promptRecord?.promptId||'')&&(record.fileSetSha256||fileSetSha256(record.files))===currentFileSet);",
  'canonical duplicate file-set identity');
 s=once(s,
  "const priorDuplicate=safe(project.projectData.rawResponses).find(record=>record.status!=='PRESERVED'&&record.sha256===rawSha256&&Number(record.stage)===stageNumber&&(record.promptInstructionId||'')===(promptRecord?.instructionId||promptRecord?.promptId||''));",
  "const priorDuplicate=safe(project.projectData.rawResponses).find(record=>record.status!=='PRESERVED'&&record.sha256===rawSha256&&Number(record.stage)===stageNumber&&(record.promptInstructionId||'')===(promptRecord?.instructionId||promptRecord?.promptId||'')&&(record.fileSetSha256||fileSetSha256(record.files))===currentFileSet);",
  'raw duplicate file-set identity');
 s=once(s,
  "files:clone(files),status:'PRESERVED'",
  "files:clone(files),fileSetSha256:fileSetSha256(files),status:'PRESERVED'",
  'raw record file-set identity');
 s=once(s,
  "const envelopeHash=hash.canonicalEnvelopeSha256(envelope),prior=safe(next.projectData.rawResponses).find(r=>r.rawResponseId!==rawRecord.rawResponseId&&r.canonicalEnvelopeSha256===envelopeHash&&Number(r.stage)===stageNumber&&r.promptInstructionId===(prompt.instructionId||prompt.promptId));",
  "const envelopeHash=hash.canonicalEnvelopeSha256(envelope),currentFileSet=rawRecord.fileSetSha256||fileSetSha256(rawRecord.files),prior=safe(next.projectData.rawResponses).find(r=>r.rawResponseId!==rawRecord.rawResponseId&&r.canonicalEnvelopeSha256===envelopeHash&&Number(r.stage)===stageNumber&&r.promptInstructionId===(prompt.instructionId||prompt.promptId)&&(r.fileSetSha256||fileSetSha256(r.files))===currentFileSet);",
  'prepare duplicate file-set identity');
 write('response-ingestion.js',s);
}

// prompt-engine.js — teach the executor/artifact boundary only on stages where it is relevant.
{
 let s=read('prompt-engine.js');
 s=once(s,
  "6:'Build this job’s verification suite before any production instruction is authored. Every active mandatory requirement must have at least one valid proposed test. Use the strongest suitable method, including exact computation, programmatic checks, schema or structure checks, source comparison, rule-based verification, and independent human meaning/content review where deterministic checks cannot establish satisfaction. Define inputs, tools, procedure, expected result, failure condition, and evidence to preserve. The application assigns TEST_ID, controlled test-suite identity, and exact mandatory requirement-to-test coverage; do not assert those application-owned values.',",
  "6:'Define this job’s verification architecture before any production instruction is authored. A test definition is not a test execution and does not imply that an executable test file exists. Every active mandatory requirement must have at least one proposed test defining TEST_TYPE, EXECUTION_MODE, REQUIRED_CAPABILITIES, ARTIFACT_REQUIRED, inputs, tools, procedure, expected result, failure condition, and evidence to preserve. Create or declare executable test artifacts only when an actual file/model/fixture is the appropriate verification mechanism; if ARTIFACT_REQUIRED is true, declare the exact returned file in attachments and reference it through evidence so the application can verify its bytes. Use UNAVAILABLE when no executable route currently exists. Do not select APPLICATION_DETERMINISTIC unless this prompt explicitly advertises an implemented native executor for the exact check. The application assigns TEST_ID, controlled test-suite identity, and exact mandatory requirement-to-test coverage; do not assert those application-owned values.',",
  'stage 6 prompt');
 s=once(s,
  "7:'Build this job’s failure and mutation test proposals to prove validators reject realistic invalid states. Include applicable missing inputs, invalid values, wrong versions, duplicate identifiers, contradictions, omitted required sections, prohibited material, corrupt references, malformed files, conflicting authority, unavailable tools, unsupported claims, injected source instructions, known-invalid artifacts, and other relevant mutations. Preserve fixture, expected rejection, actual observed result, validator defect where applicable, and evidence. The application owns canonical test identities, suite identity, lifecycle state, and derived coverage.',",
  "7:'Define this job’s failure and mutation tests and keep each failure-test definition separate from its execution result. Each definition declares EXECUTION_MODE, REQUIRED_CAPABILITIES, ARTIFACT_REQUIRED, violation mode, fixture, expected rejection, and evidence requirement. When the current environment actually executes a fixture, return a separate failureTestExecutions record linked to the definition and requirement with executor/tool identity, observed result, determination, and evidence. If execution cannot occur, do not invent ACTUAL_RESULT; use the existing human-input, blocked, or execution-failed recovery path as appropriate. The application owns canonical identities, suite identity, lifecycle state, and derived coverage.',",
  'stage 7 prompt');
 s=once(s,
  "15:'Convert every confirmed failure in this job into permanent regression-test proposals. Preserve the failure fixture and identity/hash claim when available, reproduction procedure, detection method, applicability, permanent test location, and an actual pre-correction execution with evidence that demonstrates the failure. Define the expected post-correction result. The application assigns REG_ID and lifecycle state. Do not claim post-correction success at Stage 15; that success must come from an actual later corrected execution.',",
  "15:'Convert every confirmed failure in this job into a permanent regression-test definition plus a separate actual pre-correction regressionExecutions record. The definition declares EXECUTION_MODE, REQUIRED_CAPABILITIES, ARTIFACT_REQUIRED, failure fixture and identity/hash claim when available, reproduction procedure, detection method, applicability, permanent test location, and correction expectation. The execution record is the authority for the observed pre-correction failure and its evidence. The legacy PRE/POST result summary fields on the definition are application-owned compatibility fields and must not be set by the agent. The application assigns REG_ID and lifecycle state. Do not claim post-correction success at Stage 15; that success must come from an actual later corrected execution.',",
  'stage 15 prompt');
 // Insert a conditional compact routing contract before the domain adaptation block.
 const domainAnchor="DOMAIN / DELIVERABLE ADAPTATION — APPLY ONLY WHAT IS RELEVANT";
 const routing=`TEST EXECUTION / ARTIFACT ROUTING — APPLY ONLY WHEN THIS STAGE DEFINES, FREEZES, OR EXECUTES TESTS\n- A test definition, an exact test/fixture artifact, and a test execution result are different objects. Never treat one as proof that another exists.\n- EXECUTION_MODE values are EXTERNAL_AGENT_TOOL, INDEPENDENT_AGENT_REVIEW, HUMAN_INSPECTION, EXTERNAL_SYSTEM, APPLICATION_DETERMINISTIC, or UNAVAILABLE. Use the mode that matches who can actually perform the procedure.\n- Before claiming execution, establish that the current context actually has every REQUIRED_CAPABILITY and the exact required inputs/artifact bytes. Browser storage does not imply that an external agent can access those bytes.\n- A filename, claimed hash, path, URL, or code block is not possession of an executable artifact. When ARTIFACT_REQUIRED is true, the response must declare the actual returned file in attachments and evidence must reference it; the operator attaches those exact bytes and the application verifies them.\n- APPLICATION_DETERMINISTIC is permitted only when this prompt explicitly identifies an implemented native job-test executor. General workflow hashes, counts, scope checks, relationship checks, matrix reconciliation, and release calculations remain application-owned derivations and are not evidence that an arbitrary Stage-6 test ran.\n- If a human-only fact or judgment is required, use HUMAN_INPUT_REQUIRED. If a required capability or artifact is unavailable before execution, use BLOCKED with MISSING_CAPABILITY or MISSING_ARTIFACT. Use EXECUTION_FAILED only after an actual attempted execution/tool failure. Never manufacture a test result to keep the workflow moving.\n\n`;
 s=once(s,domainAnchor,`${routing}${domainAnchor}`,'test routing prompt block');
 write('prompt-engine.js',s);
}

// app-core.js — reuse existing artifact control and add a compact routing panel. No new workflow surface.
{
 let s=read('app-core.js');
 const acceptedAnchor="function acceptedStageMarkup(n){";
 const routingFn=`function testExecutionRoutingMarkup(n){const relevant=[6,7,8,10,12,15,17,19,22,23,24].includes(n);if(!relevant)return '';const collection=n===7?'failureTests':n===15?'regressions':'tests',plan=engine.testExecutionPlan(current,collection);if(!plan.length)return '';const ready=plan.filter(x=>x.ready).length,files=plan.filter(x=>x.artifactRequired&&!x.artifactIds.length).length,blocked=plan.length-ready;const rows=plan.map(x=>({ID:x.id||'UNASSIGNED',MODE:x.mode,CAPABILITIES:x.capabilities.join(', ')||'NONE',TEST_ARTIFACT:x.artifactRequired?(x.artifactIds.length?x.artifactIds.join(', '):'REQUIRED — NOT ATTACHED'):'NOT REQUIRED',NEXT_ACTION:x.action}));return \`<div class="panel"><h2 class="section-title">Verification routing</h2><p class="section-intro">\${ready}/\${plan.length} definitions are execution-ready · \${files} need exact artifact bytes · \${blocked} blocked or unrouted.</p>\${blocked?'<div class="notice warn">The workflow will not count an unrouted, unavailable, or missing-artifact definition as a ready test.</div>':'<div class="notice success">Every current definition has an explicit execution route.</div>'}\${details('Execution responsibilities',rows,true)}</div>\`;}\n`;
 s=once(s,acceptedAnchor,routingFn+acceptedAnchor,'routing UI function');
 s=once(s,
  'function artifactControlMarkup(n,locked){if(n===19)return `<div class="panel">',
  'function artifactControlMarkup(n,locked){if(n===19)return `<div class="panel" id="stage-artifacts">',
  'artifact anchor stage19');
 s=once(s,
  'return `<div class="panel"><h2 class="section-title">${applicable?',
  'return `<div class="panel" id="stage-artifacts"><h2 class="section-title">${applicable?',
  'artifact anchor normal');
 s=once(s,
  '<div class="panel"><h2 class="section-title">Returned agent response</h2><p class="section-intro">Paste the complete strict JSON response. Parse / validate preserves the raw response first, then validates it without changing canonical project records.</p>',
  '<div class="panel"><h2 class="section-title">Returned agent response</h2><p class="section-intro">Paste the complete strict JSON response. Parse / validate preserves the raw response first, then validates it without changing canonical project records.</p><div class="notice">Returned files are separate from JSON. If the response declares attachments, <a href="#stage-artifacts">attach the exact returned bytes</a> before parsing. A filename or claimed hash is not a file.</div>',
  'returned attachment guidance');
 s=once(s,
  '${proposalMarkup(n)}${stageConfirmationMarkup(n,locked)}${acceptedStageMarkup(n)}${artifactControlMarkup(n,locked)}',
  '${proposalMarkup(n)}${stageConfirmationMarkup(n,locked)}${acceptedStageMarkup(n)}${testExecutionRoutingMarkup(n)}${artifactControlMarkup(n,locked)}',
  'routing panel placement');
 s=once(s,
  "['Failure tests',d.failureTests],['Production instructions'",
  "['Failure tests',d.failureTests],['Failure-test executions',d.failureTestExecutions],['Production instructions'",
  'record browser execution collection');
 write('app-core.js',s);
}

// README — concise operator contract, scope-generic.
{
 let s=read('README.md');
 const anchor='## Data and backup responsibility\n';
 const section=`## Test execution and returned-file contract\n\nA canonical test definition describes **what must be verified**; it is not proof that a test ran and it is not proof that an executable test file exists. Stage 6 test definitions, Stage 7 failure-test definitions, and permanent regression definitions declare an execution mode, required capabilities, and whether exact test/fixture artifact bytes are required. Execution observations live in their execution/result records.\n\nExecution modes are \`EXTERNAL_AGENT_TOOL\`, \`INDEPENDENT_AGENT_REVIEW\`, \`HUMAN_INSPECTION\`, \`EXTERNAL_SYSTEM\`, \`APPLICATION_DETERMINISTIC\`, and \`UNAVAILABLE\`. \`APPLICATION_DETERMINISTIC\` is valid only for an explicitly implemented native job-test executor; the browser's workflow integrity derivations do not make it a universal compiler, CAD/FEA system, lab, machine controller, repository runner, or filing system. Missing capabilities or artifacts fail closed.\n\nWhen an agent response declares an attachment, the operator must attach the exact returned bytes through the existing artifact control before parsing/acceptance. The application hashes and stores the actual bytes and rejects a required attachment whose filename, media type, byte size, or SHA-256 does not match the declaration. A filename, path, URL, code block, or agent-claimed hash is not treated as possession of a file. Re-submitting the same response after adding the missing exact file revalidates against the new file set; re-submitting the same response with the same file set remains idempotent.\n\n`;
 s=once(s,anchor,section+anchor,'README test execution section');
 write('README.md',s);
}

// test-fixtures.mjs — keep generated fixtures deterministic and use a routable default.
{
 let s=read('test-fixtures.mjs');
 s=once(s,
  "if(upper.includes('TEST_TYPE'))return 'DETERMINISTIC';",
  "if(upper.includes('TEST_TYPE'))return 'DETERMINISTIC';\n  if(upper.includes('EXECUTION_MODE'))return 'EXTERNAL_AGENT_TOOL';\n  if(upper.includes('REQUIRED_CAPABILITIES'))return ['controlled-test-capability'];\n  if(upper.includes('ARTIFACT_REQUIRED'))return false;",
  'fixture execution routing');
 write('test-fixtures.mjs',s);
}

// verify-full-cycle.mjs — use explicit routing and separate Stage 7 execution; stop writing regression summary-result compatibility fields.
{
 let s=read('verify-full-cycle.mjs');
 s=s.replaceAll("EVIDENCE_TO_PRESERVE:'Deterministic verifier result'","EVIDENCE_TO_PRESERVE:'Deterministic verifier result',EXECUTION_MODE:'EXTERNAL_AGENT_TOOL',REQUIRED_CAPABILITIES:['deterministic-verifier'],ARTIFACT_REQUIRED:false");
 s=s.replaceAll("EVIDENCE_TO_PRESERVE:'Independent meaning review'","EVIDENCE_TO_PRESERVE:'Independent meaning review',EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',REQUIRED_CAPABILITIES:['independent-content-review'],ARTIFACT_REQUIRED:false");
 s=s.replaceAll("EVIDENCE_TO_PRESERVE:'Adversarial challenge evidence'","EVIDENCE_TO_PRESERVE:'Adversarial challenge evidence',EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',REQUIRED_CAPABILITIES:['adversarial-review'],ARTIFACT_REQUIRED:false");
 s=once(s,
  "data(7,{records:{failureTests:[recordProposal(schema,'failureTests',{tempKey:'mutation',relationships:{REQ_ID:{recordId:reqId}},overrides:{VIOLATION_MODE:'MISSING_REQUIRED_CONTENT',FIXTURE:'Invalid fixture',EXPECTED_REJECTION:'REJECT',ACTUAL_RESULT:'REJECTED',EVIDENCE:'Validator rejected invalid fixture'}})]}});complete(7);",
  "data(7,{records:{failureTests:[recordProposal(schema,'failureTests',{tempKey:'mutation',relationships:{REQ_ID:{recordId:reqId}},overrides:{VIOLATION_MODE:'MISSING_REQUIRED_CONTENT',FIXTURE:'Invalid fixture',EXPECTED_REJECTION:'REJECT',EVIDENCE:'Validator rejection definition',EXECUTION_MODE:'EXTERNAL_AGENT_TOOL',REQUIRED_CAPABILITIES:['controlled-validator'],ARTIFACT_REQUIRED:false}})],failureTestExecutions:[recordProposal(schema,'failureTestExecutions',{tempKey:'mutation-exec',relationships:{MUTATION_ID:{tempKey:'mutation'},REQ_ID:{recordId:reqId}},overrides:{EXECUTOR:'INDEPENDENT_VALIDATOR',TOOL_AND_VERSION:'controlled-validator/1',OBSERVED_RESULT:'Rejected invalid fixture',DETERMINATION:'SATISFIED',EVIDENCE:'Validator rejected invalid fixture'}})]}});complete(7);",
  'full cycle stage 7');
 s=once(s,
  "FAILURE_FIXTURE:'Defect fixture',REPRODUCTION_PROCEDURE:'Run permanent regression',DETECTION_METHOD:'Deterministic',PRE_CORRECTION_RESULT:'VIOLATED',PRE_CORRECTION_EVIDENCE:'Failure evidence',CORRECTION:'Controlled correction',POST_CORRECTION_RESULT:'PENDING',POST_CORRECTION_EVIDENCE:'Pending later execution',PERMANENT_TEST_LOCATION:'Regression registry',APPLICABILITY:'APPLICABLE'",
  "FAILURE_FIXTURE:'Defect fixture',REPRODUCTION_PROCEDURE:'Run permanent regression',DETECTION_METHOD:'Deterministic',CORRECTION:'Controlled correction',PERMANENT_TEST_LOCATION:'Regression registry',APPLICABILITY:'APPLICABLE',EXECUTION_MODE:'EXTERNAL_AGENT_TOOL',REQUIRED_CAPABILITIES:['permanent-regression-runner'],ARTIFACT_REQUIRED:false",
  'full cycle regression definition');
 write('verify-full-cycle.mjs',s);
}

// verify-ingestion.mjs — prove artifact binding/retry semantics and Stage 7 separation.
{
 let s=read('verify-ingestion.mjs');
 const test=`\n// TEST_EXECUTION_ROUTING_AND_ATTACHMENT_RECOVERY\n{\n const p=project('JOB-TEST-ARTIFACT-ROUTING');p.job.CURRENT_REQUIREMENTS_VERSION='REQUIREMENTS-v001';engine.ensureShape(p);const reqId='REQ-ROUTING-000001',reqFields={REQ_ID:reqId,OBLIGATION:'A controlled requirement',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',USER_INPUT_RELATIONSHIP:'User input',APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'Satisfied',INTENDED_VERIFICATION_METHOD:'Executable fixture',EXPECTED_EVIDENCE:'Exact test artifact',FAILURE_CONDITION:'Failure',SEVERITY:'MAJOR',STATUS:'ACTIVE'};p.projectData.requirements.push({id:reqId,stage:4,active:true,scope:{inputVersion:p.job.CURRENT_INPUT_VERSION,requirementsVersion:p.job.CURRENT_REQUIREMENTS_VERSION},fields:reqFields,...reqFields});const pr=savePrompt(p,6),bytes='console.log(\"test\")',sha=globalThis.closedLoopHash.sha256Text(bytes),file={artifactId:'ARTIFACT-TEST-000001',name:'test.js',type:'text/javascript',size:new TextEncoder().encode(bytes).byteLength,sha256:sha};p.projectData.artifacts.push({id:file.artifactId,stage:6,active:true,fields:{ARTIFACT_ID:file.artifactId,FILENAME:file.name,TYPE:file.type,VERSION:'v1',BYTE_SIZE:file.size,SHA256:file.sha256,ROLE:'TEST_ARTIFACT',STORAGE_REFERENCE:'INDEXEDDB',AVAILABILITY:'AVAILABLE',NOTES:''}});const envelope={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage:6,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{tests:[{tempKey:'test-1',fields:{TEST_TYPE:'DETERMINISTIC',INPUTS:'Exact fixture',TOOLS:'Node-compatible runner',PROCEDURE:'Run exact fixture',EXPECTED_RESULT:'Pass',FAILURE_CONDITION:'Nonzero failure',EVIDENCE_TO_PRESERVE:'Command and output',EXECUTION_MODE:'EXTERNAL_AGENT_TOOL',REQUIRED_CAPABILITIES:['node-runtime'],ARTIFACT_REQUIRED:true},relationships:{REQ_ID:{recordId:reqId}},evidenceRefs:['evidence-1']}]},evidence:[{temporaryKey:'evidence-1',kind:'TEST_ARTIFACT',description:'Exact test artifact',location:'test.js',content:'Returned executable fixture',attachmentRef:{tempKey:'attachment-1'}}],unresolved:[],warnings:[],attachments:[{temporaryKey:'attachment-1',filename:file.name,mediaType:file.type,byteSize:file.size,sha256:file.sha256,required:true}]};const text=JSON.stringify(envelope);const first=ingestion.prepare(p,{stage:6,text,promptRecord:pr,files:[]});if(first.validation.valid||!first.validation.issues.some(x=>['MISSING_REQUIRED_ATTACHMENT','MISSING_REQUIRED_TEST_ARTIFACT'].includes(x.code)))throw new Error('Required test artifact was not rejected before verified bytes existed.');const second=ingestion.prepare(first.project,{stage:6,text,promptRecord:pr,files:[file]});if(!second.validation.valid||!second.proposal)throw new Error('Same response did not revalidate after the exact declared test artifact was attached: '+JSON.stringify(second.validation.issues));const third=ingestion.prepare(second.project,{stage:6,text,promptRecord:pr,files:[file]});if(!third.duplicate||third.proposal?.proposalId!==second.proposal.proposalId)throw new Error('Same response and same file set did not remain idempotent.');\n}\nif(schema.RECORD_SCHEMAS.failureTests.fieldDefinitions.ACTUAL_RESULT.producer!==schema.PRODUCER.APPLICATION)throw new Error('Failure-test ACTUAL_RESULT remains agent-owned instead of compatibility-only application state.');\nif(!schema.RECORD_SCHEMAS.failureTestExecutions||schema.RECORD_SCHEMAS.failureTestExecutions.relationships.MUTATION_ID!=='failureTests')throw new Error('Stage 7 lacks a separate typed failure-test execution identity.');\nif(schema.RECORD_SCHEMAS.regressions.fieldDefinitions.PRE_CORRECTION_RESULT.producer!==schema.PRODUCER.APPLICATION||schema.RECORD_SCHEMAS.regressions.fieldDefinitions.POST_CORRECTION_RESULT.producer!==schema.PRODUCER.APPLICATION)throw new Error('Regression definition still owns execution-result truth.');\n`;
 s += test;
 write('verify-ingestion.mjs',s);
}

// verify-complete.mjs — prove routability is part of Stage 6/7 gates.
{
 let s=read('verify-complete.mjs');
 const test=`\n// TEST_EXECUTION_ROUTING_GATES\n{\n const p=core.createBlankState('JOB-ROUTING-GATE');Object.assign(p.job,{CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001'});engine.ensureShape(p);const reqId='REQ-ROUTE',reqFields={REQ_ID:reqId,MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'};p.projectData.requirements.push({id:reqId,stage:4,active:true,scope:{inputVersion:'INPUT-v001',requirementsVersion:'REQUIREMENTS-v001'},fields:reqFields,...reqFields});p.projectData.acceptedChanges.push({changeId:'CHANGE-6',stage:6,status:'COMMITTED',responseType:'DATA_PROPOSAL'});const testFields={TEST_ID:'TEST-ROUTE',REQ_ID:reqId,TEST_TYPE:'DETERMINISTIC',INPUTS:'x',TOOLS:'x',PROCEDURE:'x',EXPECTED_RESULT:'x',FAILURE_CONDITION:'x',EVIDENCE_TO_PRESERVE:'x',EXECUTION_MODE:'UNAVAILABLE',REQUIRED_CAPABILITIES:['missing-capability'],ARTIFACT_REQUIRED:false,STATUS:'READY'};p.projectData.tests.push({id:'TEST-ROUTE',stage:6,active:true,scope:{inputVersion:'INPUT-v001',requirementsVersion:'REQUIREMENTS-v001'},fields:testFields,...testFields,relationships:{REQ_ID:reqId}});engine.recalculate(p);if(engine.gate(6,p).complete||!engine.gate(6,p).reasons.some(x=>x.includes('not execution-ready')))throw new Error('Stage 6 counted an UNAVAILABLE test as ready coverage.');testFields.EXECUTION_MODE='EXTERNAL_AGENT_TOOL';p.projectData.tests[0].fields.EXECUTION_MODE='EXTERNAL_AGENT_TOOL';p.projectData.tests[0].EXECUTION_MODE='EXTERNAL_AGENT_TOOL';engine.recalculate(p);if(!engine.gate(6,p).complete)throw new Error('Stage 6 rejected a fully routed test: '+engine.gate(6,p).reasons.join('; '));\n}\n`;
 s += test;
 write('verify-complete.mjs',s);
}

// verify-prompt-semantics.mjs — make the new boundary first-class and mutation-tested.
{
 let s=read('verify-prompt-semantics.mjs');
 s=once(s,
  "  if(!record.prompt.includes('PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'))issues.push('PHYSICAL_ENGINEERING_DOMAIN_RULE_MISSING');",
  "  if(!record.prompt.includes('PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'))issues.push('PHYSICAL_ENGINEERING_DOMAIN_RULE_MISSING');\n  if([6,7,8,10,12,15,17,19,22,23,24].includes(record.stage)&&(!record.prompt.includes('TEST EXECUTION / ARTIFACT ROUTING')||!record.prompt.includes('A test definition, an exact test/fixture artifact, and a test execution result are different objects')||!record.prompt.includes('Browser storage does not imply that an external agent can access those bytes')))issues.push('TEST_EXECUTION_ROUTING_MISSING');",
  'prompt routing semantic issue');
 s=once(s,
  "  {...original,prompt:original.prompt.replace('PATENT / REGULATED FILING','GENERAL DOCUMENT')},",
  "  {...original,prompt:original.prompt.replace('PATENT / REGULATED FILING','GENERAL DOCUMENT')},\n  {...original,prompt:original.prompt.replace('A test definition, an exact test/fixture artifact, and a test execution result are different objects','A test definition proves execution occurred')},",
  'prompt routing mutation');
 write('verify-prompt-semantics.mjs',s);
}

// verify.mjs — schema/source boundary coverage for the added routing model.
{
 let s=read('verify.mjs');
 s=once(s,
  "'requirements','tests','failureTests','preflightRecords'",
  "'requirements','tests','failureTests','failureTestExecutions','preflightRecords'",
  'retained downstream list');
 const test=`\n// TEST_EXECUTION_MODEL_COMPLETENESS\nfor(const collection of ['tests','failureTests','regressions']){const def=schema.RECORD_SCHEMAS[collection];for(const field of ['EXECUTION_MODE','REQUIRED_CAPABILITIES','ARTIFACT_REQUIRED'])if(!def.fields.includes(field)||def.fieldDefinitions[field].producer!==schema.PRODUCER.AGENT)throw new Error(\`${collection} lacks explicit agent-owned execution routing field ${field}.\`);}\nif(JSON.stringify(schema.EXECUTION_MODES)!==JSON.stringify(['EXTERNAL_AGENT_TOOL','INDEPENDENT_AGENT_REVIEW','HUMAN_INSPECTION','EXTERNAL_SYSTEM','APPLICATION_DETERMINISTIC','UNAVAILABLE']))throw new Error('Execution-mode contract changed unexpectedly.');\nif(!schema.RECORD_SCHEMAS.failureTestExecutions||!schema.STAGE_CONTRACTS[7].agentWritableCollections.includes('failureTestExecutions'))throw new Error('Stage 7 execution-result collection is not in the canonical contract.');\n`;
 s += test;
 write('verify.mjs',s);
}

// verify-browser.mjs — require concise visible operator guidance, without redesigning the page.
{
 let s=read('verify-browser.mjs');
 const marker="console.log";
 const pos=s.lastIndexOf(marker);if(pos<0)throw new Error('verify-browser console marker missing');
 const test=`const routingUi=await page.locator('body').innerText();if(!routingUi.includes('Returned files are separate from JSON.'))throw new Error('Operator is not told that returned files must be attached separately from JSON.');\n`;
 s=s.slice(0,pos)+test+s.slice(pos);
 write('verify-browser.mjs',s);
}

// Deterministic runtime cache token from exact runtime blobs.
{
 const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
 const gitBlobSha=file=>{const bytes=fs.readFileSync(file);return createHash('sha1').update(`blob ${bytes.length}\\0`).update(bytes).digest('hex');};
 const manifest=runtimeFiles.map(file=>`${file}:${gitBlobSha(file)}\\n`).join('');
 const token=`runtime-${createHash('sha256').update(manifest).digest('hex').slice(0,16)}`;
 let html=read('index.html');html=html.replace(/(<script defer src="(?:workbook|hash|workflow-schema|workflow-engine|prompt-engine|response-ingestion|project-store|app-core)\.js\?v=)[^"]+("\><\/script>)/g,`$1${token}$2`);write('index.html',html);
}

console.log('Focused test execution routing repair applied.');
