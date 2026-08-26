import fs from 'node:fs';
import {createHash} from 'node:crypto';

const changed=[];
function read(path){return fs.readFileSync(path,'utf8');}
function write(path,text){fs.writeFileSync(path,text);changed.push(path);}
function replaceOnce(path,from,to,label){
  const text=read(path);
  const count=text.split(from).length-1;
  if(count!==1)throw new Error(`${path}: expected exactly one ${label||'anchor'}, found ${count}`);
  write(path,text.replace(from,to));
}
function replaceRegexOnce(path,re,to,label){
  const text=read(path),matches=[...text.matchAll(new RegExp(re.source,re.flags.includes('g')?re.flags:re.flags+'g'))];
  if(matches.length!==1)throw new Error(`${path}: expected exactly one ${label||re}, found ${matches.length}`);
  write(path,text.replace(re,to));
}

// workbook.js — clarify that Stage 06 defines verification architecture, not universal executable code.
replaceOnce('workbook.js',
  "'BUILD THE VERIFICATION SUITE BEFORE WRITING THE PRODUCTION INSTRUCTION'",
  "'DEFINE THE VERIFICATION SUITE BEFORE WRITING THE PRODUCTION INSTRUCTION'",
  'Stage 06 title');
replaceOnce('workbook.js',
  "'Create at least one verification procedure for every mandatory requirement before production instructions are authored.'",
  "'Define how every mandatory requirement will be verified, who or what executes the test, which capabilities are required, and what evidence proves the result; create executable test artifacts only when they are the appropriate verification mechanism.'",
  'Stage 06 result');
replaceOnce('workbook.js',
  "6:['Every mandatory requirement has a ready test','Deterministic properties use deterministic tests','Mandatory test coverage equals 1.00 or stage is blocked','Test suite has a controlled identity']",
  "6:['Every mandatory requirement has a ready verification definition','Every test declares an execution mode and required capability','Executable test artifacts are exact-byte evidence when required','Mandatory test coverage equals 1.00 or stage is blocked','Test suite has a controlled identity']",
  'Stage 06 completion gate language');
replaceOnce('workbook.js',
  "'Prove that validators reject known-invalid cases.'",
  "'Define known-invalid fixtures and failure tests, then execute them only in an environment that actually has the required capability while preserving the observed result and evidence.'",
  'Stage 07 result');

// workflow-schema.js — add the minimum execution/handoff metadata to the existing tests record.
replaceOnce('workflow-schema.js',
`    "agent": [
      "TEST_TYPE",
      "INPUTS",
      "TOOLS",
      "PROCEDURE",
      "EXPECTED_RESULT",
      "FAILURE_CONDITION",
      "EVIDENCE_TO_PRESERVE"
    ],`,
`    "agent": [
      "TEST_TYPE",
      "EXECUTION_MODE",
      "REQUIRED_CAPABILITIES",
      "EXECUTABLE_ARTIFACT_REQUIRED",
      "INPUTS",
      "TOOLS",
      "PROCEDURE",
      "EXPECTED_RESULT",
      "FAILURE_CONDITION",
      "EVIDENCE_TO_PRESERVE"
    ],`,
  'tests ownership partition');
replaceOnce('workflow-schema.js',
  "'TEST':Object.freeze({TEST_TYPE:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['DETERMINISTIC','MEANING','ADVERSARIAL']),nullable:false,normalizerKey:null,closedProperties:null})}),",
  "'TEST':Object.freeze({TEST_TYPE:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['DETERMINISTIC','MEANING','ADVERSARIAL']),nullable:false,normalizerKey:null,closedProperties:null}),EXECUTION_MODE:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['EXTERNAL_AGENT_TOOL','INDEPENDENT_AGENT_REVIEW','HUMAN_INSPECTION','EXTERNAL_SYSTEM']),nullable:false,normalizerKey:null,closedProperties:null}),REQUIRED_CAPABILITIES:Object.freeze({valueType:'STRING_ARRAY',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),EXECUTABLE_ARTIFACT_REQUIRED:Object.freeze({valueType:'BOOLEAN',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})}),",
  'test field type overrides');
replaceOnce('workflow-schema.js',
`tests:recordSchema({ownership:RECORD_OWNERSHIP.tests,commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,title:'Verification tests',idField:'TEST_ID',prefix:'TEST',stage:6,fields:['TEST_ID','REQ_ID','TEST_TYPE','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','STATUS'],required:['TEST_TYPE','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','STATUS'],relationships:{REQ_ID:'requirements'}}),`,
`tests:recordSchema({ownership:RECORD_OWNERSHIP.tests,commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,title:'Verification tests',idField:'TEST_ID',prefix:'TEST',stage:6,fields:['TEST_ID','REQ_ID','TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITIES','EXECUTABLE_ARTIFACT_REQUIRED','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','STATUS'],required:['TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITIES','EXECUTABLE_ARTIFACT_REQUIRED','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','STATUS'],relationships:{REQ_ID:'requirements'}}),`,
  'tests record schema');

// prompt-engine.js — make execution responsibility and artifact access explicit without adding a runner.
replaceOnce('prompt-engine.js',
`6:'Build this job’s verification suite before any production instruction is authored. Every active mandatory requirement must have at least one valid proposed test. Use the strongest suitable method, including exact computation, programmatic checks, schema or structure checks, source comparison, rule-based verification, and independent human meaning/content review where deterministic checks cannot establish satisfaction. Define inputs, tools, procedure, expected result, failure condition, and evidence to preserve. The application assigns TEST_ID, controlled test-suite identity, and exact mandatory requirement-to-test coverage; do not assert those application-owned values.',`,
`6:'Define this job’s verification architecture before any production instruction is authored. A test definition is not necessarily an executable file. Every active mandatory requirement must have at least one valid proposed test that defines TEST_TYPE, EXECUTION_MODE, REQUIRED_CAPABILITIES, inputs, tools, procedure, expected result, failure condition, and evidence to preserve. EXECUTION_MODE must identify where the substantive test will actually run: EXTERNAL_AGENT_TOOL for a capable tool/repository/runtime agent, INDEPENDENT_AGENT_REVIEW for a fresh independent reviewer, HUMAN_INSPECTION for an irreducible human judgment, or EXTERNAL_SYSTEM for specialized software, laboratory, machine, metrology, filing, or other outside capability. Application-owned integrity calculations such as canonical hashes, byte identity, counts, schema/relationship/scope checks, matrix completeness, and release calculations remain application operations and must not be represented as externally executed tests. Create an executable test artifact only when that artifact is the appropriate verification mechanism. When an executable test artifact is actually produced, set EXECUTABLE_ARTIFACT_REQUIRED true, declare the exact returned file in attachments, and link it through the test evidenceRefs to evidence carrying attachmentRef; a filename or claimed hash without application-verified bytes is not an artifact. Otherwise set EXECUTABLE_ARTIFACT_REQUIRED false. If no credible execution path with the required capability can be identified, return BLOCKED with MISSING_CAPABILITY rather than inventing a test execution. The application assigns TEST_ID, controlled test-suite identity, and exact mandatory requirement-to-test coverage; do not assert those application-owned values.',`,
  'Stage 06 prompt procedure');
replaceOnce('prompt-engine.js',
`7:'Build this job’s failure and mutation test proposals to prove validators reject realistic invalid states. Include applicable missing inputs, invalid values, wrong versions, duplicate identifiers, contradictions, omitted required sections, prohibited material, corrupt references, malformed files, conflicting authority, unavailable tools, unsupported claims, injected source instructions, known-invalid artifacts, and other relevant mutations. Preserve fixture, expected rejection, actual observed result, validator defect where applicable, and evidence. The application owns canonical test identities, suite identity, lifecycle state, and derived coverage.',`,
`7:'Build this job’s failure and mutation test proposals to prove validators reject realistic invalid states. Include applicable missing inputs, invalid values, wrong versions, duplicate identifiers, contradictions, omitted required sections, prohibited material, corrupt references, malformed files, conflicting authority, unavailable tools, unsupported claims, injected source instructions, known-invalid artifacts, and other relevant mutations. Execute a fixture only when the current environment actually has the required capability and artifact access. Preserve fixture, expected rejection, actual observed result only when execution actually occurred, validator defect where applicable, and evidence. If required execution cannot occur, return the appropriate BLOCKED or EXECUTION_FAILED disposition instead of fabricating ACTUAL_RESULT. The application owns canonical test identities, suite identity, lifecycle state, and derived coverage.',`,
  'Stage 07 prompt procedure');
replaceOnce('prompt-engine.js',
`12:'Verify each current execution independently. Execute only the currently missing REQ_ID × RUN_ID × TEST_ID triples listed by the application in VERIFICATION BATCH PLAN, in listed order. Preserve verifier and verifier-context identity, independence status, inputs, procedure, expected result, observed result, exact evidence, SATISFIED/VIOLATED/UNDETERMINED, defect reference where applicable, and reason for UNDETERMINED. If the complete listed batch would exceed the declared response byte limit, return the longest leading prefix that fits; never skip ahead, repeat an already-current triple, substitute wrong-version or wrong-iteration records, or self-validate. After accepted ingestion the application regenerates this stage from the newly missing set. The application reconciles the complete matrix mathematically and the stage cannot complete from a partial batch.',`,
`12:'Verify each current execution independently. Execute only the currently missing REQ_ID × RUN_ID × TEST_ID triples listed by the application in VERIFICATION BATCH PLAN, in listed order. Follow each canonical test’s EXECUTION_MODE and REQUIRED_CAPABILITIES; do not substitute a different execution class merely because it is easier. Treat artifacts as available only when this exact verification context actually has access to their bytes or an authorized external system provides the controlled result. Preserve verifier and verifier-context identity, independence status, inputs, procedure, expected result, observed result, exact evidence, SATISFIED/VIOLATED/UNDETERMINED, defect reference where applicable, and reason for UNDETERMINED. If a listed test cannot be executed because its required capability or artifact is unavailable, report UNDETERMINED with the exact missing capability or artifact rather than inventing execution. If the complete listed batch would exceed the declared response byte limit, return the longest leading prefix that fits; never skip ahead, repeat an already-current triple, substitute wrong-version or wrong-iteration records, or self-validate. After accepted ingestion the application regenerates this stage from the newly missing set. The application reconciles the complete matrix mathematically and the stage cannot complete from a partial batch.',`,
  'Stage 12 prompt procedure');
replaceOnce('prompt-engine.js',
`22:'Perform the substantive deterministic verification work that is actually supported against the finished product and report procedures, expected results, actual observed results, evidence, and defects. Use specialized deterministic tools when the authorized execution context provides them. Objective artifact identities, byte sizes, cryptographic hashes, expected test-set completeness, counts, and final gate calculations are application-owned. Never claim an unexecuted deterministic check ran.',`,
`22:'Perform the substantive deterministic verification work that is actually supported against the finished product and report procedures, expected results, actual observed results, evidence, and defects. Respect each applicable test’s declared execution responsibility and required capabilities. Use specialized deterministic tools only when the authorized execution context actually provides them and has access to the exact product/test artifacts required. Objective artifact identities, byte sizes, cryptographic hashes, expected test-set completeness, counts, and final gate calculations are application-owned. Never claim an unexecuted deterministic check ran, and never treat an application-stored filename or metadata reference as proof that this external execution context received the file bytes.',`,
  'Stage 22 prompt procedure');
replaceOnce('prompt-engine.js',
`- PATENT / REGULATED FILING: identify the governing jurisdiction or office, filing type, priority/continuity facts, applicant/inventor facts, disclosure, claims, drawings, abstract, specification/formality requirements, and other filing-specific elements that materially affect the requested work. Use current official office rules, statutes, regulations, manuals, forms, and other controlling authority where applicable. Never invent inventorship, ownership, priority, dates, legal status, or filing facts; request missing human-only facts or decisions.`,
`- PATENT / REGULATED FILING: identify the governing jurisdiction or office, filing type, priority/continuity facts, applicant/inventor facts, disclosure, claims, drawings, abstract, specification/formality requirements, and other filing-specific elements that materially affect the requested work. Where the requested task calls for it, address prior-art/search scope, claim-support and antecedent-basis consistency, written-description/enablement support, drawing-reference consistency, dependency/claim-set structure, and filing-specific deadlines or formalities using the appropriate current authority. Use current official office rules, statutes, regulations, manuals, forms, and other controlling authority where applicable. Never invent inventorship, ownership, priority, dates, legal status, prior-art conclusions, or filing facts; request missing human-only facts or decisions.`,
  'patent domain adaptation');
replaceOnce('prompt-engine.js',
`- Never claim that a web search, repository edit, build, test, CAD operation, simulation, CNC post-processing step, physical measurement, fabrication, filing, submission, or other external action occurred unless it actually occurred in the authorized execution context and evidence is available.`,
`- Browser-stored artifact bytes are not automatically available to this external agent. Treat an artifact as accessible only when the current prompt/context expressly supplies it or the execution environment independently has verified access to the exact bytes. A filename or agent-claimed hash is not a file, and metadata is not proof of tool access.
- Never claim that a web search, repository edit, build, test, CAD operation, simulation, CNC post-processing step, physical measurement, fabrication, filing, submission, or other external action occurred unless it actually occurred in the authorized execution context and evidence is available.`,
  'external artifact access rule');

// response-ingestion.js — if a test says it requires an executable artifact, require a verified attachment link through existing evidence.
replaceOnce('response-ingestion.js',
`    const hasAgentData=object(record?.fields)&&Object.keys(record.fields).some(name=>definition?.fieldDefinitions?.[name]?.provenanceRequired);
    if(hasAgentData&&!safe(record.evidenceRefs).length)issues.push(issue('MISSING_PROVENANCE',\`${path}/evidenceRefs\`,'Agent-produced canonical record data requires at least one evidence reference.'));
    if(object(record?.relationships))for(const [name,reference] of Object.entries(record.relationships)){`,
`    const hasAgentData=object(record?.fields)&&Object.keys(record.fields).some(name=>definition?.fieldDefinitions?.[name]?.provenanceRequired);
    if(hasAgentData&&!safe(record.evidenceRefs).length)issues.push(issue('MISSING_PROVENANCE',\`${path}/evidenceRefs\`,'Agent-produced canonical record data requires at least one evidence reference.'));
    if(collection==='tests'&&record?.fields?.EXECUTABLE_ARTIFACT_REQUIRED===true){
      const linkedEvidence=safe(record.evidenceRefs).map(ref=>evidenceIndex.get(String(ref))?.evidence).filter(Boolean);
      const hasVerifiedAttachment=linkedEvidence.some(evidence=>{const ref=evidence?.attachmentRef;if(ref?.tempKey)return attachmentIndex.has(String(ref.tempKey));if(ref?.recordId)return workflow.records(project,'artifacts',{active:true}).some(item=>workflow.recordId(item,'artifacts')===String(ref.recordId));return false;});
      if(!hasVerifiedAttachment)issues.push(issue('MISSING_TEST_ARTIFACT',\`${path}/evidenceRefs\`,'This test declares EXECUTABLE_ARTIFACT_REQUIRED=true but no linked evidence resolves to application-verified artifact bytes.'));
    }
    if(object(record?.relationships))for(const [name,reference] of Object.entries(record.relationships)){`,
  'test executable artifact enforcement');

// workflow-engine.js — imported/historical tests lacking the new execution contract cannot silently satisfy Stage 06.
replaceOnce('workflow-engine.js',
`    case 6:{
      requireAccepted();
      const metrics=coverageMetrics(project);
      if(metrics.mandatoryRequirementCount===0)reasons.push('No active mandatory requirements exist to cover.');
      if(metrics.requirementCoverage!==1)reasons.push(\`Mandatory requirement-to-test coverage is \${(metrics.requirementCoverage*100).toFixed(2)}%, not 100%.\`);
      break;
    }`,
`    case 6:{
      requireAccepted();
      const metrics=coverageMetrics(project),currentTests=recordsForCurrentScope(project,'tests'),modeDef=schema.RECORD_SCHEMAS.tests.fieldDefinitions.EXECUTION_MODE;
      if(metrics.mandatoryRequirementCount===0)reasons.push('No active mandatory requirements exist to cover.');
      if(metrics.requirementCoverage!==1)reasons.push(\`Mandatory requirement-to-test coverage is \${(metrics.requirementCoverage*100).toFixed(2)}%, not 100%.\`);
      if(currentTests.some(test=>!modeDef.enumValues.includes(String(recordValue(test,'EXECUTION_MODE')||''))))reasons.push('Every current test must declare a valid execution mode.');
      if(currentTests.some(test=>!Array.isArray(recordValue(test,'REQUIRED_CAPABILITIES'))||recordValue(test,'REQUIRED_CAPABILITIES').length===0))reasons.push('Every current test must declare at least one required capability.');
      if(currentTests.some(test=>recordValue(test,'EXECUTABLE_ARTIFACT_REQUIRED')===true&&!safe(test.evidenceRefs).some(id=>records(project,'evidenceRecords').some(evidence=>recordId(evidence,'evidenceRecords')===String(id)&&String(recordValue(evidence,'ATTACHMENT_ID')||'').trim()&&!['UNKNOWN','NONE'].includes(upper(recordValue(evidence,'ATTACHMENT_ID')))))))reasons.push('Every test that requires an executable artifact must link to verified artifact bytes.');
      break;
    }`,
  'Stage 06 execution-contract gate');

// app-core.js — concise operator guidance, artifact jump, and preserve pasted response while returned files are attached.
replaceOnce('app-core.js',
`function workflow(){const n=current.activeStage,d=core.STAGES[n-1],s=current.stages[n],lock=stageLocked(n),locked=Boolean(lock)&&s.status!=='COMPLETE',savedPrompt=currentPromptRecord(n),prompt=savedPrompt?.prompt||currentStagePrompt(n),responseLocked=locked||s.status==='COMPLETE',promptIntro=savedPrompt?'This exact saved instruction is the controlling request. Its identity and strict response contract are embedded below.':'This is an unsaved preview. Save or copy it before sending it to an agent; only the committed instruction identity is controlling.';return`,
`function executionHandoffMarkup(n){const operation=selectedOperation(n),applies=[6,7,12,22,23,25].includes(n)||([17,19].includes(n)&&operation==='VERIFY');if(!applies)return '';const tests=safe(current.projectData.tests).filter(test=>test?.active!==false&&!test?.invalidatedBy),counts={};for(const test of tests){const mode=String(recordValue(test,'EXECUTION_MODE')||'').trim();if(mode)counts[mode]=(counts[mode]||0)+1;}const summary=Object.entries(counts).map(([mode,count])=>\`<span>\${esc(mode.replaceAll('_',' '))}: \${count}</span>\`).join('');const message=n===6?'Define the verification method and execution responsibility here. A test is a verification definition; it is an executable file only when that is the appropriate mechanism.':'Follow each test’s declared execution responsibility. Use only a context that actually has the required tools and exact artifacts; unavailable capability stays controlled and visible instead of becoming a guessed result.';return \`<div class="panel" id="execution-handoff"><h2 class="section-title">Verification handoff</h2><p class="section-intro">\${esc(message)}</p>\${summary?\`<div class="stage-action-strip">\${summary}</div>\`:''}</div>\`;}
function workflow(){const n=current.activeStage,d=core.STAGES[n-1],s=current.stages[n],lock=stageLocked(n),locked=Boolean(lock)&&s.status!=='COMPLETE',savedPrompt=currentPromptRecord(n),prompt=savedPrompt?.prompt||currentStagePrompt(n),responseLocked=locked||s.status==='COMPLETE',promptIntro=savedPrompt?'This exact saved instruction is the controlling request. Its identity and strict response contract are embedded below.':'This is an unsaved preview. Save or copy it before sending it to an agent; only the committed instruction identity is controlling.';return`,
  'verification handoff UI function');
replaceOnce('app-core.js',
`${'${humanStageMarkup(n,locked)}${clarificationMarkup(n,locked)}${operationMarkup(n,locked)}${runBatchMarkup(n)}'}<div class="panel"><h2 class="section-title">Agent loop</h2>`,
`${'${humanStageMarkup(n,locked)}${clarificationMarkup(n,locked)}${operationMarkup(n,locked)}${runBatchMarkup(n)}${executionHandoffMarkup(n)}'}<div class="panel"><h2 class="section-title">Agent loop</h2>`,
  'handoff panel placement');
replaceOnce('app-core.js',
`<div class="stage-output-hint"><span>Complete JSON only — no Markdown wrapper.</span><span>\${s.responseDraft?\`\${s.responseDraft.length.toLocaleString()} characters pasted\`:'No response pasted yet'}</span></div><div class="button-row"><button class="primary" id="parse-output"\${responseLocked?' disabled':''}>Parse / validate response</button></div>`,
`<div class="stage-output-hint"><span>Complete JSON only — no Markdown wrapper.</span><span>\${s.responseDraft?\`\${s.responseDraft.length.toLocaleString()} characters pasted\`:'No response pasted yet'}</span></div><div class="button-row"><button class="primary" id="parse-output"\${responseLocked?' disabled':''}>Parse / validate response</button><button id="jump-stage-files" type="button"\${locked?' disabled':''}>Returned files? Attach exact bytes</button></div><p class="section-intro">If the response declares required attachments, attach the exact returned files before parsing. The application verifies their bytes; a filename or claimed hash is not enough.</p>`,
  'returned file operator guidance');
replaceOnce('app-core.js',
`return \`<div class="panel"><h2 class="section-title">\${applicable?'Artifact control':'Authorized files for this stage'}</h2>`,
`return \`<div class="panel" id="stage-artifact-control" tabindex="-1"><h2 class="section-title">\${applicable?'Artifact control':'Files for this stage'}</h2>`,
  'artifact panel identity and heading');
replaceOnce('app-core.js',
`async function registerStageFiles(fileList){const stage=current.activeStage,created=[];try{`,
`async function registerStageFiles(fileList){const stage=current.activeStage,created=[],responseDraft=$('#stage-output')?.value;try{`,
  'artifact upload draft capture');
replaceOnce('app-core.js',
`for(const file of fileList)created.push(await storeArtifactFile(file,stage,productId?{productId}:{}));const next=clone(current);for(const item of created){`,
`for(const file of fileList)created.push(await storeArtifactFile(file,stage,productId?{productId}:{}));const next=clone(current);if(typeof responseDraft==='string')next.stages[stage].responseDraft=responseDraft;for(const item of created){`,
  'artifact upload draft preservation');
replaceOnce('app-core.js',
`if($('#stage-files'))$('#stage-files').onchange=e=>registerStageFiles(Array.from(e.target.files||[]));`,
`if($('#jump-stage-files'))$('#jump-stage-files').onclick=()=>{const panel=$('#stage-artifact-control');panel?.scrollIntoView({behavior:'smooth',block:'start'});panel?.focus();};if($('#stage-files'))$('#stage-files').onchange=e=>registerStageFiles(Array.from(e.target.files||[]));`,
  'artifact jump wiring');

// Shared fixture defaults: executable artifact is opt-in; execution mode/capability remain schema-driven.
replaceOnce('test-fixtures.mjs',
`  if(def.enumValues?.length)return def.enumValues[0];
  if(def.valueType==='BOOLEAN')return true;`,
`  if(def.enumValues?.length)return def.enumValues[0];
  if(String(name).toUpperCase()==='EXECUTABLE_ARTIFACT_REQUIRED')return false;
  if(def.valueType==='BOOLEAN')return true;`,
  'fixture executable artifact default');

// Prompt semantic acceptance: execution responsibility, artifact access, and stronger patent drafting semantics are first-class.
replaceOnce('verify-prompt-semantics.mjs',
`  if(!record.prompt.includes('PATENT / REGULATED FILING'))issues.push('PATENT_DOMAIN_RULE_MISSING');`,
`  if(!record.prompt.includes('PATENT / REGULATED FILING')||!record.prompt.includes('prior-art/search scope')||!record.prompt.includes('claim-support and antecedent-basis consistency')||!record.prompt.includes('written-description/enablement support'))issues.push('PATENT_DOMAIN_RULE_MISSING');`,
  'patent semantic assertion');
replaceOnce('verify-prompt-semantics.mjs',
`  if(!record.prompt.includes('Never claim that a web search, repository edit, build, test, CAD operation, simulation, CNC post-processing step, physical measurement, fabrication, filing, submission, or other external action occurred unless it actually occurred'))issues.push('EXTERNAL_ACTION_HONESTY_RULE_MISSING');`,
`  if(!record.prompt.includes('Browser-stored artifact bytes are not automatically available to this external agent')||!record.prompt.includes('A filename or agent-claimed hash is not a file'))issues.push('ARTIFACT_ACCESS_BOUNDARY_MISSING');
  if(!record.prompt.includes('Never claim that a web search, repository edit, build, test, CAD operation, simulation, CNC post-processing step, physical measurement, fabrication, filing, submission, or other external action occurred unless it actually occurred'))issues.push('EXTERNAL_ACTION_HONESTY_RULE_MISSING');
  if(record.stage===6){if(!record.prompt.includes('A test definition is not necessarily an executable file')||!['EXTERNAL_AGENT_TOOL','INDEPENDENT_AGENT_REVIEW','HUMAN_INSPECTION','EXTERNAL_SYSTEM'].every(mode=>record.prompt.includes(mode))||!record.prompt.includes('EXECUTABLE_ARTIFACT_REQUIRED'))issues.push('TEST_EXECUTION_CONTRACT_MISSING');}
  if(record.stage===12&&!record.prompt.includes('Follow each canonical test’s EXECUTION_MODE and REQUIRED_CAPABILITIES'))issues.push('VERIFIER_EXECUTION_RESPONSIBILITY_MISSING');
  if(record.stage===22&&!record.prompt.includes('Respect each applicable test’s declared execution responsibility and required capabilities'))issues.push('PRODUCT_TEST_EXECUTION_RESPONSIBILITY_MISSING');`,
  'execution handoff semantic assertions');

// Ingestion acceptance for the new Stage 06 fields and the executable-artifact linkage rule.
const ingestionMarker='const negative=(name,mutate,expectedCode)=>negativeAt(name,2,mutate,expectedCode);';
replaceOnce('verify-ingestion.mjs',ingestionMarker,
`function stage6ExecutionEnvelope(p,promptRecord,overrides={}){return {schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage:6,operation:promptRecord.operation,promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},scope:promptRecord.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{tests:[{tempKey:'test-1',fields:{TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'EXTERNAL_AGENT_TOOL',REQUIRED_CAPABILITIES:['Node.js runtime'],EXECUTABLE_ARTIFACT_REQUIRED:false,INPUTS:'Controlled fixture',TOOLS:'Node.js',PROCEDURE:'Execute the controlled verification procedure.',EXPECTED_RESULT:'Controlled success',FAILURE_CONDITION:'Observed result differs',EVIDENCE_TO_PRESERVE:'Command and output',...overrides},relationships:{},evidenceRefs:['evidence-1']}]},evidence:[{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:'Stage 06 execution-contract evidence',location:'verify-ingestion.mjs',content:'controlled test definition'}],unresolved:[],warnings:[],attachments:[]};}
{
  const p=project('JOB-STAGE6-EXECUTION-CONTRACT'),pr=savePrompt(p,6),good=stage6ExecutionEnvelope(p,pr);
  const accepted=ingestion.prepare(p,{stage:6,text:JSON.stringify(good),promptRecord:pr});if(!accepted.validation.valid)throw new Error(\`Stage 06 execution-contract fixture rejected: \${JSON.stringify(accepted.validation.issues)}\`);
  const missingMode=stage6ExecutionEnvelope(p,pr);delete missingMode.records.tests[0].fields.EXECUTION_MODE;let result=ingestion.prepare(p,{stage:6,text:JSON.stringify(missingMode),promptRecord:pr});if(result.validation.valid)throw new Error('Stage 06 accepted a test with no execution mode.');negativeCount++;
  const invalidMode=stage6ExecutionEnvelope(p,pr,{EXECUTION_MODE:'BROWSER_MAGIC'});result=ingestion.prepare(p,{stage:6,text:JSON.stringify(invalidMode),promptRecord:pr});if(result.validation.valid||!result.validation.issues.some(x=>x.code==='INVALID_ENUM_VALUE'))throw new Error('Stage 06 accepted an invalid execution mode.');negativeCount++;
  const missingArtifact=stage6ExecutionEnvelope(p,pr,{EXECUTABLE_ARTIFACT_REQUIRED:true});result=ingestion.prepare(p,{stage:6,text:JSON.stringify(missingArtifact),promptRecord:pr});if(result.validation.valid||!result.validation.issues.some(x=>x.code==='MISSING_TEST_ARTIFACT'))throw new Error('Stage 06 accepted an executable test artifact claim without verified bytes.');negativeCount++;
}
${ingestionMarker}`,
  'Stage 06 ingestion contract tests');

// Browser acceptance: guidance is visible and attaching returned files does not erase a pasted response draft.
replaceOnce('verify-browser.mjs',
` // Return retained project to Stage 02 and verify strict prompt contract.
 await openStage(cdp,2);`,
` // Stage 06 must explain verification orchestration without implying every test is code.
 await openStage(cdp,6);let stage6Text=(await snapshot(cdp)).text;for(const token of ['Verification handoff','A test is a verification definition','executable file only when','Returned files? Attach exact bytes','Files for this stage'])assert(stage6Text.includes(token),\`Stage 06 operator guidance missing \${token}.\`);
 // Return retained project to Stage 02 and verify strict prompt contract.
 await openStage(cdp,2);`,
  'Stage 06 browser guidance test');
replaceOnce('verify-browser.mjs',
` await click(cdp,'#save-prompt');
 retained=await activeProject(cdp);let promptRecord=retained.projectData.generatedPrompts.filter(x=>Number(x.stage)===2).at(-1);assert(promptRecord?.instructionId&&promptRecord?.sha256,'Saved prompt identity missing.');
 // Malformed response preserves raw/validation and does not mutate canonical sources.`,
` await click(cdp,'#save-prompt');
 retained=await activeProject(cdp);let promptRecord=retained.projectData.generatedPrompts.filter(x=>Number(x.stage)===2).at(-1);assert(promptRecord?.instructionId&&promptRecord?.sha256,'Saved prompt identity missing.');
 // Returned files may be attached after reading the response; upload/re-render must preserve the pasted response draft.
 const preservedDraft='{"draft":"preserve-across-returned-file-attachment"}';await fill(cdp,'#stage-output',preservedDraft);await evalValue(cdp,\`(()=>{const input=document.querySelector('#stage-files'),dt=new DataTransfer();dt.items.add(new File(['returned-file-bytes'],'returned-evidence.txt',{type:'text/plain'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true})()\`);await waitExpr(cdp,\`document.querySelector('#stage-output')?.value===\${JSON.stringify(preservedDraft)}\`,20000);await fill(cdp,'#stage-output','');
 // Malformed response preserves raw/validation and does not mutate canonical sources.`,
  'returned-file draft preservation browser test');

// Recompute the shared runtime cache identity after all runtime edits.
const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const gitBlobSha=file=>{const bytes=fs.readFileSync(file);return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');};
const manifest=runtimeFiles.map(file=>`${file}:${gitBlobSha(file)}\n`).join('');
const token=`runtime-${createHash('sha256').update(manifest).digest('hex').slice(0,16)}`;
const html=read('index.html'),nextHtml=html.replace(/\?v=runtime-[a-f0-9]{16}/g,`?v=${token}`);
if(nextHtml===html)throw new Error('index.html runtime token anchor was not found.');
if((nextHtml.match(new RegExp(`\\?v=${token}`,'g'))||[]).length!==8)throw new Error('index.html did not receive one shared runtime token for all eight scripts.');
write('index.html',nextHtml);

console.log(JSON.stringify({patched:true,changed:[...new Set(changed)],runtimeBuildIdentity:token},null,2));
