import fs from 'node:fs';

const required=['index.html','app.js','workbook.js','TEST_PROJECT.json','AUTHORIZED_OPERATION_01.txt','verify.mjs'];
for(const file of required)if(!fs.existsSync(file))throw new Error(`Missing ${file}`);

const project=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
if(project.schema!=='human-project/30')throw new Error(`Unexpected project schema ${project.schema}`);
if(project.jobId!=='JOB-20260823144121'||project.title!=='Mobile Closed-Loop Agent Reliability Workbook')throw new Error('Authorized retained project identity is wrong.');
if(Object.keys(project.stageRecords||{}).length!==30)throw new Error('Retained project must contain exactly 30 stage records.');
if(project.stageRecords?.['1']?.status!=='COMPLETE'||project.currentStage!==2||project.currentState!=='READY')throw new Error('Retained project must preserve completed Stage 01 and current Stage 02 READY state.');
for(let n=2;n<=30;n++)if(project.stageRecords?.[String(n)]?.status!=='NOT STARTED')throw new Error(`Stage ${n} must remain NOT STARTED.`);

const appPath='app.js';
let app=fs.readFileSync(appPath,'utf8');
app=app.replace('async async function saveJob(', 'async function saveJob(');
app=app.replace('async function createUniqueJobId(', 'function createUniqueJobId(');

if(!app.includes('const recordSchemas=')){
  const recordUi=[
"const recordSchemas={",
"sources:{title:'Source records',id:'SOURCE_ID',fields:['SOURCE_ID','TYPE','ORIGIN','REFERENCE','VERSION','DATE','AUTHORITY_LEVEL','AUTHORITY_ROLE','RELEVANT_PORTIONS','INSPECTION_STATE','CURRENCY_STATE','CONTROLLING_STATUS','SHA256','NOTES']},",
"sourceConflicts:{title:'Source conflicts',id:'CONFLICT_ID',fields:['CONFLICT_ID','SOURCE_A','SOURCE_B','AUTHORITY_RULE','RESOLUTION','AFFECTED_WORK','STATUS','EVIDENCE']},",
"research:{title:'Research records',id:'RESEARCH_ID',fields:['RESEARCH_ID','SOURCE_ID','PASS','PORTIONS_EXAMINED','MANDATORY_STATEMENTS','RECOMMENDATIONS','PROHIBITIONS','EXCEPTIONS','DEPENDENCIES','APPLICABILITY_FACTS','INVALIDATING_MATERIAL','EVIDENCE']},",
"candidateRequirements:{title:'Candidate requirements',id:'CANDIDATE_REQ_ID',fields:['CANDIDATE_REQ_ID','SOURCE_ID','SOURCE_LOCATION','CANDIDATE_OBLIGATION','APPLICABILITY','EVIDENCE','STATUS']},",
"requirements:{title:'Requirement records',id:'REQ_ID',fields:['REQ_ID','OBLIGATION','TYPE','MANDATORY','SOURCE_ID','SOURCE_LOCATION','AUTHORITY','APPLICABILITY','DEPENDENCIES','PROHIBITIONS','DEFINED_TERMS','SATISFACTION_CONDITION','VERIFICATION_METHOD','EXPECTED_EVIDENCE','FAILURE_CONDITION','SEVERITY','STATUS','NOTES']},",
"tests:{title:'Verification tests',id:'TEST_ID',fields:['TEST_ID','REQ_ID','TYPE','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE','STATUS']},",
"failureTests:{title:'Failure tests',id:'MUTATION_ID',fields:['MUTATION_ID','REQ_ID','VIOLATION_MODE','FIXTURE','EXPECTED_REJECTION','ACTUAL_RESULT','VALIDATOR_DEFECT_ID','EVIDENCE']},",
"preflightRecords:{title:'Instruction review records',id:'REVIEW_ID',fields:['REVIEW_ID','INSTRUCTION_VERSION','CLAUSE','INTERPRETATION_RISK','UNDEFINED_OBJECT','UNSUPPLIED_DEPENDENCY','INTERNAL_CONFLICT','UNAVAILABLE_CAPABILITY','VERIFIABLE','RESPONSIBLE_OPERATION','ORDER_CLEAR','FAILURE_BEHAVIOR_DEFINED','TRACEABILITY','DETERMINATION','EVIDENCE']},",
"candidateFreezes:{title:'Candidate freeze records',id:'CANDIDATE_ID',fields:['CANDIDATE_ID','ITERATION_ID','COMPONENT_MANIFEST','COMPONENT_VERSIONS','HASHES','TOOL_CONFIGURATION','SETTINGS_PERMISSIONS_LIMITATIONS','IMMUTABLE_LOCATIONS','DISTRIBUTION_BY_ROLE','BATCH_CHANGE_RULE','EVIDENCE']},",
"runs:{title:'Execution runs',id:'RUN_ID',fields:['RUN_ID','ITERATION_ID','CONTEXT_ID','STARTED_AT','ENDED_AT','PACKAGE_IDENTITY','CONTAMINATION_STATUS','TOOL_CONFIGURATION','STATUS','OUTPUT_ID','OUTPUT_HASH','TOOL_FAILURES','NOTES']},",
"verification:{title:'Run verification records',id:'VERIFICATION_ID',fields:['VERIFICATION_ID','REQ_ID','RUN_ID','TEST_ID','RESULT','VERIFIER','INDEPENDENT','INPUTS','PROCEDURE','EXPECTED_RESULT','OBSERVED_RESULT','EVIDENCE','DEFECT_ID','UNDETERMINED_REASON']},",
"comparisons:{title:'Cross-run comparisons',id:'COMPARISON_ID',fields:['COMPARISON_ID','REQ_ID','RUN_RESULTS','ALL_TEN_SATISFIED','ANY_VIOLATION','ANY_UNDETERMINED','INTERPRETATION_VARIANCE','OUTPUT_VARIANCE','VARIANCE_AUTHORIZED','REPEATED_FAILURES','UNIQUE_FAILURES','CORRECTNESS_AFFECTING_VARIANCE','DEFECT_IDS','EVIDENCE']},",
"defects:{title:'Defect records',id:'DEFECT_ID',fields:['DEFECT_ID','REQ_ID','RUN_ID','PRODUCT_ID','OBSERVED_FAILURE','EXPECTED_CONDITION','SEVERITY','STATUS','EVIDENCE']},",
"rootCauses:{title:'Root-cause records',id:'RCA_ID',fields:['RCA_ID','DEFECT_ID','CATEGORY','EARLIEST_DEFECTIVE_LAYER','ROOT_CAUSE','EVIDENCE','DOWNSTREAM_INVALIDATION']},",
"regressions:{title:'Regression tests',id:'REG_ID',fields:['REG_ID','DEFECT_ID','REQ_ID','FIXTURE','FIXTURE_HASH','REPRODUCTION_PROCEDURE','DETECTION_METHOD','EXPECTED_RESPONSE','TEST_ID','TEST_SUITE_VERSION','PRE_CORRECTION_RESULT','POST_CORRECTION_RESULT','APPLICABILITY','STATUS','EVIDENCE']},",
"changes:{title:'Change and invalidation records',id:'CHANGE_ID',fields:['CHANGE_ID','TRIGGER','RESPONSIBLE_LAYER','OLD_IDENTITY','NEW_IDENTITY','EXACT_CHANGE','REASON','DOWNSTREAM_INVALIDATION','TESTS_TO_RERUN','ITERATIONS_TO_RERUN','AUDITS_TO_RERUN','RELEASE_GATE_IMPACT','HASH_IMPACT','REVALIDATION_STATUS']},",
"baselines:{title:'Baseline records',id:'BASELINE_ID',fields:['BASELINE_ID','CONFIRMATION_ITERATION','APPROVED_VERSIONS','HASHES','IMMUTABLE_ARTIFACTS','AUTHORIZED_RECIPIENT_ROLES','STORAGE','STATUS','EVIDENCE']},",
"products:{title:'Product records',id:'PRODUCT_ID',fields:['PRODUCT_ID','PRODUCT_VERSION','BASELINE_ID','EXECUTION_ID','CONTEXT_ID','BASELINE_MATERIALS','STARTED_AT','ENDED_AT','TOOL_CONFIGURATION','DEVIATIONS','FAILURES','OUTPUT_ARTIFACTS','STATUS']},",
"deterministicResults:{title:'Deterministic product verification',id:'RESULT_ID',fields:['RESULT_ID','PRODUCT_ID','PRODUCT_HASH','TEST_ID','TOOL_VERSION','PROCEDURE','EXPECTED_RESULT','ACTUAL_RESULT','DETERMINATION','EVIDENCE','DEFECT_ID']},",
"meaningResults:{title:'Independent meaning review',id:'REVIEW_ID',fields:['REVIEW_ID','REQ_ID','PRODUCT_LOCATION','SOURCE_EVIDENCE','OBSERVED_MEANING','REQUIRED_MEANING','DETERMINATION','EVIDENCE','DEFECT_ID','UNDETERMINED_REASON']},",
"adversarialResults:{title:'Adversarial review records',id:'ATTACK_ID',fields:['ATTACK_ID','ATTACK_METHOD','TARGET','EXPECTED_BEHAVIOR','ACTUAL_RESULT','DETERMINATION','DEFECT_ID','SEVERITY','EVIDENCE']},",
"representationInspections:{title:'Representation inspection records',id:'INSPECTION_ID',fields:['INSPECTION_ID','ARTIFACT_ID','FILENAME','VERSION','BYTE_SIZE','SHA256','TRANSFORMATION_CHAIN','VIEW_OR_PAGE','OBSERVATIONS','DEFECT_ID','EVIDENCE']},",
"processAudits:{title:'Process audit records',id:'PROCESS_AUDIT_ID',fields:['PROCESS_AUDIT_ID','APPROVED_VS_ACTUAL_INPUTS','APPROVED_VS_ACTUAL_INSTRUCTION','APPROVED_VS_ACTUAL_TOOLS','REQUIRED_TESTS','UNAUTHORIZED_MODIFICATION','AUTHORIZED_CHANGES','CHAIN_OF_CUSTODY','DEFECTS','BLOCKERS','DETERMINATION','EVIDENCE']},",
"productAudits:{title:'Product audit records',id:'PRODUCT_AUDIT_ID',fields:['PRODUCT_AUDIT_ID','MANDATORY_REQUIREMENT_COUNT','AFFIRMATIVE_EVIDENCE_COUNT','MANDATORY_TEST_COUNT','TEST_RESULTS','MEANING_REVIEW_RESULTS','CRITICAL_DEFECTS','MAJOR_DEFECTS','MANDATORY_UNKNOWNS','DEFECTS','BLOCKERS','DETERMINATION','EVIDENCE']},",
"releaseRecords:{title:'Release records',id:'RELEASE_ID',fields:['RELEASE_ID','PRODUCT_ID','BASELINE_ID','STATE','MANDATORY_REQUIREMENTS','AFFIRMATIVE_EVIDENCE','VIOLATED_REQUIREMENTS','UNDETERMINED_REQUIREMENTS','VALIDATORS','FAILED_VALIDATORS','CRITICAL_DEFECTS','MAJOR_DEFECTS','BLOCKERS','DECISION_RULE','EVIDENCE']},",
"artifactIdentities:{title:'Artifact identity records',id:'IDENTITY_ID',fields:['IDENTITY_ID','ARTIFACT_ID','AUDITED_FILENAME','AUDITED_VERSION','AUDITED_PATH','AUDITED_SIZE','AUDITED_SHA256','RELEASE_FILENAME','RELEASE_VERSION','RELEASE_PATH','RELEASE_SIZE','RELEASE_SHA256','HASH_MATCH','SIZE_MATCH','POST_AUDIT_MODIFICATION','AUTHORIZATION']},",
"evidenceChains:{title:'Evidence-chain records',id:'CHAIN_ID',fields:['CHAIN_ID','REQ_ID','SOURCE_ID','INSTRUCTION_ID','EXECUTION_ID','PRODUCT_ELEMENT','TEST_ID','TEST_RESULT_ID','EVIDENCE_ID','RELEASE_DECISION_ID','ARTIFACT_HASH_IDENTITY','STATUS']}",
"};",
"const stageCollections={2:['sources','sourceConflicts'],3:['research','candidateRequirements'],4:['requirements'],6:['tests'],7:['failureTests'],9:['preflightRecords'],10:['candidateFreezes'],11:['runs'],12:['verification'],13:['comparisons'],14:['defects','rootCauses'],15:['regressions'],16:['changes'],17:['runs'],20:['baselines'],21:['products'],22:['deterministicResults'],23:['meaningResults'],24:['adversarialResults'],25:['representationInspections'],26:['processAudits','productAudits'],27:['releaseRecords'],28:['artifactIdentities'],29:['evidenceChains'],30:['defects','regressions']};",
"function recordInputMarkup(collection,cfg,locked){return `<div class=\"grid-2 structured-record-form\">${cfg.fields.map(f=>{const long=/EVIDENCE|NOTES|OBLIGATION|PROCEDURE|INPUTS|TOOLS|RESULT|FAILURE|SOURCE|DEPEND|PROHIB|TERMS|CONDITION|FIXTURE|CONFIGURATION|MANIFEST|HASHES|VARIANCE|CHANGE|INVALIDATION|AUDIT|MATERIAL|OBSERV|MEANING|CHAIN|BLOCKER/i.test(f);return `<div class=\"field${long?' full':''}\"><label>${esc(label(f))}</label>${long?`<textarea data-record-collection=\"${collection}\" data-record-field=\"${esc(f)}\"${locked?' disabled':''}></textarea>`:`<input data-record-collection=\"${collection}\" data-record-field=\"${esc(f)}\"${locked?' disabled':''}>`}</div>`;}).join('')}</div>`;}",
"function structuredRecords(n,locked){return (stageCollections[n]||[]).map(collection=>{const cfg=recordSchemas[collection],saved=safe(current.projectData[collection]).filter(x=>Number(x.stage||n)===n);return `<details class=\"record-card\"><summary>${esc(cfg.title)}<span>${saved.length} saved</span></summary><div class=\"record-body\"><p class=\"section-intro\">Add each record separately so identities, relationships, evidence, and history remain inspectable.</p>${recordInputMarkup(collection,cfg,locked)}<div class=\"button-row\"><button data-add-record=\"${collection}\"${locked?' disabled':''}>Add record</button><button data-clear-record=\"${collection}\"${locked?' disabled':''}>Clear draft</button></div>${saved.length?details('Saved records',saved):''}</div></details>`;}).join('');}",
"async function addStructuredRecord(collection){const cfg=recordSchemas[collection],nodes=[...document.querySelectorAll(`[data-record-collection=\"${collection}\"]`)],fields=Object.fromEntries(nodes.map(x=>[x.dataset.recordField,x.value.trim()]));if(!fields[cfg.id]){alert(cfg.id+' is required.');return;}if(safe(current.projectData[collection]).some(x=>String(x.id||x[cfg.id]||x.fields?.[cfg.id])===fields[cfg.id])){alert(cfg.id+' already exists. Saved records are append-only; use a new identity or a controlled change record.');return;}const createdAt=new Date().toISOString(),record={id:fields[cfg.id],stage:current.activeStage,createdAt,fields,...fields};record.sha256=await core.sha256Text(JSON.stringify(record.fields));current.projectData[collection].push(record);current.projectData.history.push({eventId:'EVENT-'+Date.now(),createdAt,stage:current.activeStage,type:'RECORD_ADDED',recordType:collection,recordId:record.id});save();render();}",
"function clearStructuredRecord(collection){document.querySelectorAll(`[data-record-collection=\"${collection}\"]`).forEach(x=>x.value='');}"
  ].join('\n');
  const marker='function appendixFieldsMarkup';
  const at=app.indexOf(marker);
  if(at<0)throw new Error('Cannot locate structured record insertion point.');
  app=app.slice(0,at)+recordUi+'\n'+app.slice(at);
}

if(!app.includes('${structuredRecords(n,locked)}')){
  const old='${stageFieldsMarkup(d,s,locked)}<div class="field"><label>Attach exact authorized files</label>';
  const next='${stageFieldsMarkup(d,s,locked)}${structuredRecords(n,locked)}<div class="field"><label>Attach exact authorized files</label>';
  if(!app.includes(old))throw new Error('Cannot locate stage information renderer.');
  app=app.replace(old,next);
}
if(!app.includes("document.querySelectorAll('[data-add-record]')")){
  const old="document.querySelectorAll('[data-save-appendix]').forEach(b=>b.onclick=()=>saveAppendix(b.dataset.saveAppendix));";
  const next=old+"document.querySelectorAll('[data-add-record]').forEach(b=>b.onclick=()=>addStructuredRecord(b.dataset.addRecord));document.querySelectorAll('[data-clear-record]').forEach(b=>b.onclick=()=>clearStructuredRecord(b.dataset.clearRecord));";
  if(!app.includes(old))throw new Error('Cannot locate supporting-record wiring.');
  app=app.replace(old,next);
}
fs.writeFileSync(appPath,app);

const htmlPath='index.html';
let html=fs.readFileSync(htmlPath,'utf8');
const icon=`<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%23161616'/%3E%3Cpath d='M8 16h16M16 8v16' stroke='white' stroke-width='3'/%3E%3C/svg%3E">`;
if(!/<link\s+rel=["']icon["']/i.test(html)){
  const marker='<title>Closed-Loop Reliability</title>';
  if(!html.includes(marker))throw new Error('Cannot locate application title for favicon insertion.');
  html=html.replace(marker,`${marker}\n${icon}`);
  fs.writeFileSync(htmlPath,html);
}

console.log('Retained project verified; stable application source and structured repeating workflow records are materialized.');
