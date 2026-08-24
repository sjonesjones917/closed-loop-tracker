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
for(const token of ['const recordSchemas=','function structuredRecords(','function addStructuredRecord(','function createUniqueJobId(','document.querySelectorAll(\'[data-add-record]\')'])if(!app.includes(token))throw new Error(`Canonical application is missing ${token}`);

if(!app.includes("19:['runs']")){
  const needle="17:['runs'],20:['baselines']";
  if(!app.includes(needle))throw new Error('Cannot locate the stage-to-record mapping.');
  app=app.replace(needle,"17:['runs'],19:['runs'],20:['baselines']");
}

if(!app.includes('function appendixDefault(')){
  const needle='function clearStructuredRecord(collection){document.querySelectorAll(`[data-record-collection="${collection}"]`).forEach(x=>x.value=\'\');}';
  const addition=`
function recordValue(record,key){return String(record?.[key]??record?.fields?.[key]??'').trim();}
function recordUpper(record,key){return recordValue(record,key).toUpperCase();}
function recordsAt(state,name,stage){return safe(state?.projectData?.[name]).filter(record=>Number(record?.stage||stage)===stage);}
function activeMandatoryRequirements(state){return safe(state?.projectData?.requirements).filter(record=>{const mandatory=recordUpper(record,'MANDATORY'),applicability=recordUpper(record,'APPLICABILITY'),status=recordUpper(record,'STATUS');return ['YES','TRUE','MANDATORY','REQUIRED'].includes(mandatory)&&!['NOT APPLICABLE','RETIRED','INACTIVE'].includes(applicability)&&!['RETIRED','INACTIVE'].includes(status);});}
function validateStructuredStageState(n,state=current){const issues=[],data=state?.projectData||{},requirements=activeMandatoryRequirements(state),tests=safe(data.tests);const linked=(record,key,id)=>recordValue(record,key)===id;const unique=(records,key)=>new Set(records.map(record=>recordValue(record,key)).filter(Boolean));
  if(n===2&&recordsAt(state,'sources',2).length<1)issues.push('Stage 02 requires at least one saved source record.');
  if(n===6){if(!requirements.length)issues.push('Stage 06 requires active mandatory requirement records before verification can be complete.');for(const req of requirements){const id=recordValue(req,'REQ_ID')||req.id;if(!tests.some(test=>linked(test,'REQ_ID',id)))issues.push(\`Stage 06 is missing a verification test for \${id}.\`);}}
  if(n===8){if(!requirements.length)issues.push('Stage 08 cannot begin production instruction approval without mandatory requirement records.');if(!tests.length)issues.push('Stage 08 cannot begin production instruction approval without verification tests.');}
  if([11,17,19].includes(n)){const runs=recordsAt(state,'runs',n);if(runs.length!==10)issues.push(\`Stage \${String(n).padStart(2,'0')} requires exactly 10 saved run records; found \${runs.length}.\`);if(unique(runs,'RUN_ID').size!==runs.length)issues.push('Every run must have a unique RUN_ID.');if(unique(runs,'CONTEXT_ID').size!==runs.length)issues.push('Every independent run must have a unique context identifier.');const packages=unique(runs,'PACKAGE_IDENTITY');if(runs.length&&packages.size!==1)issues.push('All ten runs must use one identical frozen package identity.');if(runs.some(run=>!recordValue(run,'OUTPUT_ID')||!recordValue(run,'OUTPUT_HASH')))issues.push('Every run must preserve its output identity and hash.');if(runs.some(run=>!['FALSE','NO','NONE','CLEAN','NOT CONTAMINATED'].includes(recordUpper(run,'CONTAMINATION_STATUS'))))issues.push('Every run must affirmatively establish an uncontaminated context.');}
  if(n===12){const stageFields=core.parseRecordFields(state?.stages?.[12]?.draftRecord||''),iteration=String(stageFields.ITERATION_ID||'').trim();const runs=recordsAt(state,'runs',11).filter(run=>!iteration||recordValue(run,'ITERATION_ID')===iteration),verification=recordsAt(state,'verification',12);for(const req of requirements){const reqId=recordValue(req,'REQ_ID')||req.id;for(const run of runs){const runId=recordValue(run,'RUN_ID')||run.id;if(!verification.some(v=>linked(v,'REQ_ID',reqId)&&linked(v,'RUN_ID',runId)))issues.push(\`Stage 12 is missing verification for \${reqId} × \${runId}.\`);}}if(runs.length!==10)issues.push('Stage 12 requires the verified iteration to contain exactly 10 run records.');if(verification.some(v=>['NO','FALSE'].includes(recordUpper(v,'INDEPENDENT'))))issues.push('Stage 12 contains a verification record that is not independent.');}
  if(n===13){const comparisons=recordsAt(state,'comparisons',13);for(const req of requirements){const reqId=recordValue(req,'REQ_ID')||req.id;if(!comparisons.some(c=>linked(c,'REQ_ID',reqId)))issues.push(\`Stage 13 is missing the cross-run comparison for \${reqId}.\`);}}
  if(n===15||n===30){const confirmed=safe(data.defects).filter(defect=>['CONFIRMED','OPEN','RESOLVED','CLOSED','CLOSED_VERIFIED'].includes(recordUpper(defect,'STATUS'))),regressions=safe(data.regressions);for(const defect of confirmed){const defectId=recordValue(defect,'DEFECT_ID')||defect.id;if(!regressions.some(reg=>linked(reg,'DEFECT_ID',defectId)))issues.push(\`Confirmed defect \${defectId} does not have a permanent regression record.\`);}}
  if(n===20&&recordsAt(state,'baselines',20).length<1)issues.push('Stage 20 requires a saved baseline record.');
  if(n===21&&recordsAt(state,'products',21).length<1)issues.push('Stage 21 requires a saved finished-product record.');
  if(n===27&&recordsAt(state,'releaseRecords',27).length<1)issues.push('Stage 27 requires a saved release-gate record.');
  if(n===28){const identities=recordsAt(state,'artifactIdentities',28);if(!identities.length)issues.push('Stage 28 requires saved artifact-identity records.');for(const identity of identities){if(recordUpper(identity,'HASH_MATCH')!=='TRUE'||recordUpper(identity,'SIZE_MATCH')!=='TRUE')issues.push(\`Artifact identity \${identity.id||recordValue(identity,'IDENTITY_ID')||'UNKNOWN'} does not affirmatively match audited bytes.\`);if(!['FALSE','NO','NONE'].includes(recordUpper(identity,'POST_AUDIT_MODIFICATION')))issues.push('Stage 28 cannot authorize an artifact with post-audit modification.');if(recordUpper(identity,'AUTHORIZATION')!=='AUTHORIZED')issues.push('Stage 28 requires explicit authorization for every delivery artifact.');}}
  if(n===29){const chains=recordsAt(state,'evidenceChains',29);for(const req of requirements){const reqId=recordValue(req,'REQ_ID')||req.id;if(!chains.some(chain=>linked(chain,'REQ_ID',reqId)&&['COMPLETE','SATISFIED','TRUE'].includes(recordUpper(chain,'STATUS'))))issues.push(\`Stage 29 is missing a complete evidence chain for \${reqId}.\`);}}
  return issues;
}
globalThis.closedLoopIntegrity={validateStructuredStageState};
function appendixDefault(k,f){const stage=\`STAGE \${String(current.activeStage).padStart(2,'0')}\`,role=core.STAGES[current.activeStage-1]?.role||'UNKNOWN',now=new Date().toISOString(),stageFields=n=>core.parseRecordFields(current.stages[n]?.draftRecord||''),s18=stageFields(18),s25=stageFields(25),s26=stageFields(26),s27=stageFields(27),s28=stageFields(28),s29=stageFields(29),lastProduct=safe(current.projectData.products).at(-1)||{};const common={JOB_ID:current.job.JOB_ID,STAGE:stage,ROLE:role,ITERATION_ID:current.job.CURRENT_ITERATION||'NOT APPLICABLE'};if(k==='A')return ({...common,RUN_ID:'NOT APPLICABLE',FROZEN_INPUT_VERSION:current.job.CURRENT_INPUT_VERSION||'UNKNOWN',FROZEN_SOURCE_SET_VERSION:current.job.CURRENT_SOURCE_SET_VERSION||'NOT APPLICABLE',FROZEN_REQUIREMENTS_VERSION:current.job.CURRENT_REQUIREMENTS_VERSION||'NOT APPLICABLE',FROZEN_INSTRUCTION_VERSION:current.job.CURRENT_INSTRUCTION_VERSION||'NOT APPLICABLE',FROZEN_TEST_SUITE_VERSION:current.job.CURRENT_TEST_SUITE_VERSION||'NOT APPLICABLE'}[f]||'');if(k==='B')return ({JOB_ID:current.job.JOB_ID,DATE_OPENED:now,STAGE_DISCOVERED:stage}[f]||'');if(k==='C')return ({JOB_ID:current.job.JOB_ID,DATE_AND_TIME:now,ITERATION_ID:current.job.CURRENT_ITERATION||'NOT APPLICABLE'}[f]||'');if(k==='D')return ({JOB_ID:current.job.JOB_ID,PRODUCT_ID:current.job.CURRENT_PRODUCT_ID||recordValue(lastProduct,'PRODUCT_ID')||'UNKNOWN',PRODUCT_VERSION:recordValue(lastProduct,'PRODUCT_VERSION')||'UNKNOWN',BASELINE_ID:current.job.CURRENT_BASELINE_ID||'UNKNOWN',RELEASE_GATE_ID:s27.RELEASE_GATE_ID||'UNKNOWN',RELEASE_GATE_STATE:s27.SELECTED_RELEASE_STATE||current.release.gateState||'UNKNOWN',PROCESS_REVIEW_VERSION_AND_DETERMINATION:s26.REVIEW_VERSION&&s26.PROCESS_CORRECTNESS_DETERMINATION?\`\${s26.REVIEW_VERSION} — \${s26.PROCESS_CORRECTNESS_DETERMINATION}\`:'',PRODUCT_REVIEW_VERSION_AND_DETERMINATION:s26.REVIEW_VERSION&&s26.PRODUCT_CORRECTNESS_DETERMINATION?\`\${s26.REVIEW_VERSION} — \${s26.PRODUCT_CORRECTNESS_DETERMINATION}\`:'',REPRESENTATION_REVIEW_VERSION_AND_DETERMINATION:s25.REPRESENTATION_REVIEW_VERSION&&s25.FINAL_REPRESENTATION_DETERMINATION?\`\${s25.REPRESENTATION_REVIEW_VERSION} — \${s25.FINAL_REPRESENTATION_DETERMINATION}\`:'',EVIDENCE_CHAIN_VERSION_AND_DETERMINATION:s29.EVIDENCE_CHAIN_VERSION&&s29.FINAL_EVIDENCE_CHAIN_DETERMINATION?\`\${s29.EVIDENCE_CHAIN_VERSION} — \${s29.FINAL_EVIDENCE_CHAIN_DETERMINATION}\`:'',HASH_REVIEW_ID_AND_DETERMINATION:s28.HASH_REVIEW_ID&&s28.DELIVERY_AUTHORIZATION?\`\${s28.HASH_REVIEW_ID} — \${s28.DELIVERY_AUTHORIZATION}\`:'',MANDATORY_REQUIREMENT_COVERAGE:s18.MANDATORY_REQUIREMENT_COVERAGE||'',MANDATORY_VERIFICATION_COVERAGE:s18.MANDATORY_VERIFICATION_COVERAGE||'',REGRESSION_TEST_SUCCESS:s18.REGRESSION_TEST_SUCCESS||'',CRITICAL_DEFECTS:s18.CRITICAL_DEFECTS||'',MAJOR_DEFECTS:s18.MAJOR_DEFECTS||'',MANDATORY_UNRESOLVED_UNKNOWNS:s18.MANDATORY_UNRESOLVED_UNKNOWNS||'',CORRECTNESS_AFFECTING_CONTRADICTIONS:s18.KNOWN_CORRECTNESS_AFFECTING_CONTRADICTIONS||'',CORRECTNESS_AFFECTING_AMBIGUITIES:s18.KNOWN_CORRECTNESS_AFFECTING_AMBIGUITIES||'',UNEXPLAINED_CORRECTNESS_AFFECTING_VARIANCE:s18.UNEXPLAINED_CORRECTNESS_AFFECTING_EXECUTION_VARIANCE||'',EXACT_AUTHORIZED_ARTIFACTS:s28.EXACT_AUTHORIZED_ARTIFACT_IDS||current.release.authorizedArtifactIds.join(', '),FINAL_RELEASE_STATUS:current.release.authorization==='AUTHORIZED'?'ACCEPTED':''}[f]||'');if(k==='F')return ({RECEIPT_ID:\`RECEIPT-\${Date.now()}\`,JOB_ID:current.job.JOB_ID,STAGE:stage,AGENT_ROLE:role,ITERATION_ID:current.job.CURRENT_ITERATION||'NOT APPLICABLE',RUN_ID:'NOT APPLICABLE',REQUEST_DATE_AND_TIME:'UNKNOWN',RESPONSE_DATE_AND_TIME:now,INPUT_VERSIONS:current.job.CURRENT_INPUT_VERSION||'UNKNOWN',SOURCE_SET_VERSION:current.job.CURRENT_SOURCE_SET_VERSION||'NOT APPLICABLE',REQUIREMENTS_VERSION:current.job.CURRENT_REQUIREMENTS_VERSION||'NOT APPLICABLE',INSTRUCTION_VERSION:current.job.CURRENT_INSTRUCTION_VERSION||'NOT APPLICABLE',TEST_SUITE_VERSION:current.job.CURRENT_TEST_SUITE_VERSION||'NOT APPLICABLE'}[f]||'');return '';}
function recordHistory(type,details={}){current.projectData.history.push({eventId:\`EVENT-\${Date.now()}-\${Math.random().toString(36).slice(2,7)}\`,createdAt:new Date().toISOString(),stage:current.activeStage,type,...details});}`;
  if(!app.includes(needle))throw new Error('Cannot locate structured-record helpers.');
  app=app.replace(needle,needle+addition);
}

app=app.replace("const raw=placeholder(parsed[f])?'':(parsed[f]||'');const long=/EVIDENCE|FILES|ARTIFACT|REASON|ATTEMPT|RESOLUTION|CHANGE|INVALID|RERUN|VERSION|HASH|INPUT|OUTPUT|DEFECT|BLOCKER|RECORD|LOCATION|PROCEDURE/i.test(f)","const raw=placeholder(parsed[f])?'':(parsed[f]||appendixDefault(k,f)||'');const long=/EVIDENCE|FILES|ARTIFACT|REASON|ATTEMPT|RESOLUTION|CHANGE|INVALID|RERUN|VERSION|HASH|INPUT|OUTPUT|DEFECT|BLOCKER|RECORD|LOCATION|PROCEDURE/i.test(f)");

if(!app.includes('structuredIssues=validateStructuredStageState')){
  const needle='const check=core.validateStageDraft(d,s,current);';
  const replacement="const check=core.validateStageDraft(d,s,current),structuredIssues=validateStructuredStageState(n,current);if(s.decision==='READY TO PROCEED'&&structuredIssues.length){check.issues.push(...structuredIssues);check.valid=false;}";
  if(!app.includes(needle))throw new Error('Cannot locate structured stage validation gate.');
  app=app.replace(needle,replacement);
}

if(!app.includes("['Release control',current.release]")){
  const needle="['Release records',d.releaseRecords]";
  if(!app.includes(needle))throw new Error('Cannot locate release records group.');
  app=app.replace(needle,"['Release control',current.release],['Release records',d.releaseRecords]");
}

if(!app.includes('filenamesIdentical')){
  const needle="const r=core.compareArtifactSets(current.release.auditedDraft,current.release.releaseDraft,current.release.gateState);r.createdAt=new Date().toISOString();current.release.comparisons.push(r);current.release.authorization=r.authorization;current.release.authorizedArtifactIds=r.authorization==='AUTHORIZED'?r.comparisons.map(x=>x.artifactId):[];save();render();";
  const replacement="const r=core.compareArtifactSets(current.release.auditedDraft,current.release.releaseDraft,current.release.gateState);r.createdAt=new Date().toISOString();r.filenamesIdentical=r.comparisons.every(x=>x.auditedFile===x.releaseFile);if(r.authorization==='AUTHORIZED'&&!r.filenamesIdentical){r.authorization='NOT AUTHORIZED';r.reason='Delivery filenames must exactly match the audited filenames.';}current.release.comparisons.push(r);current.release.authorization=r.authorization;current.release.authorizedArtifactIds=r.authorization==='AUTHORIZED'?r.comparisons.map(x=>x.artifactId):[];recordHistory('RELEASE_IDENTITY_COMPARED',{authorization:r.authorization,filenamesIdentical:r.filenamesIdentical});save();render();";
  if(!app.includes(needle))throw new Error('Cannot locate release identity comparison.');
  app=app.replace(needle,replacement);
}

if(!app.includes("retainedBytes:false")){
  const needle="async function hashFile(file){return {name:file.name,size:file.size,sha256:await core.sha256Bytes(await file.arrayBuffer()),inspected:true,addedAt:new Date().toISOString()};}";
  const replacement="async function hashFile(file){const stage=current?.activeStage||null;return {artifactId:crypto.randomUUID?.()||`FILE-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,name:file.name,type:file.type||'UNKNOWN',size:file.size,sha256:await core.sha256Bytes(await file.arrayBuffer()),stage:stage?`STAGE ${String(stage).padStart(2,'0')}`:'NOT APPLICABLE',role:stage?core.STAGES[stage-1]?.role||'UNKNOWN':'NOT APPLICABLE',retainedBytes:false,availability:'File bytes are not stored by this browser application; metadata and SHA-256 are retained.',inspected:true,addedAt:new Date().toISOString()};}";
  if(!app.includes(needle))throw new Error('Cannot locate file identity helper.');
  app=app.replace(needle,replacement);
}

if(!app.includes("recordHistory('INSTRUCTION_SAVED'"))app=app.replace('d.generatedPrompts.push(record);','d.generatedPrompts.push(record);recordHistory(\'INSTRUCTION_SAVED\',{recordId:record.promptId,stage:n});');
if(!app.includes("recordHistory('OUTPUT_SAVED'"))app=app.replace('d.generatedOutputs.push(output);','d.generatedOutputs.push(output);recordHistory(\'OUTPUT_SAVED\',{recordId:id,stage:n,sha256:hash});');
if(!app.includes("recordHistory('SUPPORTING_RECORD_SAVED'"))app=app.replace('a.records.push(record);','a.records.push(record);recordHistory(\'SUPPORTING_RECORD_SAVED\',{appendix:k,recordId:id});');
if(!app.includes("recordHistory('STAGE_DECISION_SAVED'"))app=app.replace("await preserveStage(n,$('#generated-prompt').textContent);save();render();","await preserveStage(n,$('#generated-prompt').textContent);recordHistory('STAGE_DECISION_SAVED',{stage:n,decision:s.decision,status:s.status});save();render();");

if(!app.includes('const blockingRecord=openBlockers().find(')){
  const needle='const check=core.validateStageDraft(d,s,current);';
  const replacement="const blockingRecord=openBlockers().find(x=>{const bStage=Number(String(x.stageDiscovered||x.STAGE_DISCOVERED||x.fields?.STAGE_DISCOVERED||'').match(/\\d+/)?.[0]||0);return !bStage||bStage<=n;});if(blockingRecord&&s.decision==='READY TO PROCEED'){s.status='BLOCKED';current.job.CURRENT_STAGE=`STAGE ${String(n).padStart(2,'0')}`;current.job.CURRENT_STATE='BLOCKED';current.job.NEXT_REQUIRED_ACTION=`Resolve blocker ${blockingRecord.blockerId||blockingRecord.BLOCKER_ID||blockingRecord.id||blockingRecord.fields?.BLOCKER_ID||'UNKNOWN'} before continuing.`;const m=$('#stage-message');m.className='notice warn';m.innerHTML='<strong>Stage blocked.</strong><br>An open mandatory blocker must be resolved before advancement.';save();header();return;}const check=core.validateStageDraft(d,s,current);";
  if(!app.includes(needle))throw new Error('Cannot locate stage validation gate.');
  app=app.replace(needle,replacement);
}

for(const token of ["19:['runs']",'function validateStructuredStageState(','globalThis.closedLoopIntegrity=','function appendixDefault(','structuredIssues=validateStructuredStageState','filenamesIdentical','retainedBytes:false',"['Release control',current.release]","recordHistory('STAGE_DECISION_SAVED'"])if(!app.includes(token))throw new Error(`Materialized application is missing ${token}`);
fs.writeFileSync(appPath,app);

const html=fs.readFileSync('index.html','utf8');
if(!/<link\s+rel=["']icon["']/i.test(html))throw new Error('Application icon is missing.');
console.log('Retained project verified; canonical structured application, record-linked gates, release identity, and blocker controls are materialized.');
