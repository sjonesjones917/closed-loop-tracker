import fs from 'node:fs';

function replaceOnce(source,from,to,label){
  const count=source.split(from).length-1;
  if(count!==1)throw new Error(`${label}: expected exactly one source occurrence, found ${count}.`);
  return source.replace(from,to);
}

// 1. Fail closed in the one authoritative response-ingestion path whenever the
// closed operation contract forbids an external response envelope.
{
  const path='response-ingestion.js';
  let source=fs.readFileSync(path,'utf8');
  const marker="const expectedOperation=promptRecord?.operation||contract?.operations?.[0];const operationContract=schema.operationContract(stageNumber,expectedOperation);";
  const enforcement="if(operationContract?.responseEnvelopeAllowed===false)issues.push(issue('EXTERNAL_RESPONSE_NOT_ALLOWED','/operation',`Operation ${expectedOperation||'UNKNOWN'} does not accept an external response envelope.`));";
  if(!source.includes(enforcement))source=replaceOnce(source,marker,marker+enforcement,'response authority insertion');
  fs.writeFileSync(path,source);
}

// 2. Stage 19 CONFIRM is application-calculated. Its canonical confirmation
// record cannot retain an agent-owned substantive partition when external
// response envelopes are prohibited for that operation.
{
  const path='workflow-schema.js';
  let source=fs.readFileSync(path,'utf8');
  const oldBlock=`  "confirmationRecords": {\n    "human": [],\n    "humanDecision": [],\n    "agent": [\n      "ZERO_MATERIAL_CHANGES",\n      "VERSION_HASH_COMPARISON",\n      "TEN_NEW_CONTEXTS",\n      "COMPLETE_TEST_RESULTS",\n      "REGRESSION_RESULTS",\n      "COMPARISON_RESULTS",\n      "NEW_DEFECTS",\n      "NEW_REQUIREMENTS",\n      "NEW_FAILURE_CASES",\n      "NEW_VARIANCE",\n      "DETERMINATION",\n      "EVIDENCE"\n    ],\n    "application": [\n      "CONFIRMATION_ID",\n      "SOURCE_ITERATION_ID",\n      "CONFIRMATION_ITERATION_ID"\n    ]\n  },`;
  const newBlock=`  "confirmationRecords": {\n    "human": [],\n    "humanDecision": [],\n    "agent": [],\n    "application": [\n      "CONFIRMATION_ID",\n      "SOURCE_ITERATION_ID",\n      "CONFIRMATION_ITERATION_ID",\n      "ZERO_MATERIAL_CHANGES",\n      "VERSION_HASH_COMPARISON",\n      "TEN_NEW_CONTEXTS",\n      "COMPLETE_TEST_RESULTS",\n      "REGRESSION_RESULTS",\n      "COMPARISON_RESULTS",\n      "NEW_DEFECTS",\n      "NEW_REQUIREMENTS",\n      "NEW_FAILURE_CASES",\n      "NEW_VARIANCE",\n      "DETERMINATION",\n      "EVIDENCE"\n    ]\n  },`;
  if(source.includes(oldBlock))source=replaceOnce(source,oldBlock,newBlock,'confirmation ownership closure');
  else if(!source.includes('"confirmationRecords": {\n    "human": [],\n    "humanDecision": [],\n    "agent": [],'))throw new Error('confirmationRecords ownership block is neither old nor repaired form.');
  fs.writeFileSync(path,source);
}

// 3. Provide the application-owned Stage 19 calculation. This is deliberately
// derived from the same current iteration, matrix, regression, comparison,
// defect, and candidate identities used by the gate; it does not ingest or
// synthesize agent authority.
{
  const path='workflow-engine.js';
  let source=fs.readFileSync(path,'utf8');
  if(!source.includes('function calculateUnchangedConfirmation(')){
    const marker='function releaseVerificationTrust(project,record){';
    const fn=`function calculateUnchangedConfirmation(project,{expectedRevision=project?.revision}={}){\n  ensureShape(project);\n  const currentRevision=Number(project?.revision||0);\n  if(Number(expectedRevision)!==currentRevision)throw new Error('Expected project revision is stale.');\n  const confirmationIteration=latestIteration(project,[19]);\n  const confirmationIterationId=recordId(confirmationIteration,'iterations');\n  if(!confirmationIterationId)throw new Error('Stage 19 confirmation iteration does not exist.');\n  const sourceIteration=latestIteration(project,[17]);\n  const sourceIterationId=recordId(sourceIteration,'iterations');\n  if(!sourceIterationId)throw new Error('Stage 19 requires a source converged iteration.');\n  const confirmationCandidateId=iterationCandidateId(project,confirmationIterationId);\n  const sourceCandidateId=iterationCandidateId(project,sourceIterationId);\n  const sourceCandidate=records(project,'candidateFreezes').find(r=>recordId(r,'candidateFreezes')===sourceCandidateId);\n  const confirmationCandidate=records(project,'candidateFreezes').find(r=>recordId(r,'candidateFreezes')===confirmationCandidateId);\n  const sourceHashes=recordValue(sourceCandidate,'COMPONENT_HASHES')||{};\n  const confirmationHashes=recordValue(confirmationCandidate,'COMPONENT_HASHES')||{};\n  const sameCandidate=Boolean(sourceCandidateId&&confirmationCandidateId&&sourceCandidateId===confirmationCandidateId);\n  const sameHashes=hash.sha256Value(sourceHashes)===hash.sha256Value(confirmationHashes);\n  const iterationEvaluation=evaluateIteration(project,confirmationIterationId,'UNCHANGED_CONFIRMATION');\n  const matrix=verificationMatrix(project,confirmationIterationId);\n  const independence=evaluateContextIndependence(project,{role:'RUN_BATCH',iterationId:confirmationIterationId});\n  const activeRegressions=records(project,'regressions').filter(r=>upper(recordValue(r,'ACTIVE_RETIRED_STATE')||'ACTIVE')!=='RETIRED');\n  const regressionExecutions=currentRegressionExecutions(project,confirmationIterationId).filter(r=>upper(recordValue(r,'PHASE'))!=='PRE_CORRECTION');\n  const successfulRegressionIds=new Set(regressionExecutions.filter(r=>effectiveRegressionDetermination(project,r).determination==='SATISFIED').map(r=>String(recordValue(r,'REG_ID')||r.relationships?.REG_ID||'')));\n  const comparisonRows=recordsForIteration(project,'comparisons',confirmationIterationId);\n  const newDefectIds=confirmedDefects(project).filter(d=>String(d.scope?.iterationId||'')===confirmationIterationId).map(d=>recordId(d,'defects'));\n  const existing=recordsForIteration(project,'confirmationRecords',confirmationIterationId);\n  if(existing.length>1)throw new Error('Stage 19 has multiple current confirmation records.');\n  const derivedProbe={fields:{CONFIRMATION_ITERATION_ID:confirmationIterationId},relationships:{CONFIRMATION_ITERATION_ID:confirmationIterationId},scope:scopeForIteration(project,confirmationIterationId)};\n  const determination=confirmationDetermination(project,derivedProbe);\n  const exactSatisfied=determination.determination==='SATISFIED'&&sameCandidate&&sameHashes&&independence.determination==='APPLICATION_ESTABLISHED';\n  const fields={\n    CONFIRMATION_ID:existing[0]?recordId(existing[0],'confirmationRecords'):allocateId(project,'confirmationRecords'),\n    SOURCE_ITERATION_ID:sourceIterationId,\n    CONFIRMATION_ITERATION_ID:confirmationIterationId,\n    ZERO_MATERIAL_CHANGES:sameCandidate&&sameHashes?'TRUE':'FALSE',\n    VERSION_HASH_COMPARISON:{sourceCandidateId,confirmationCandidateId,sourceHashes,confirmationHashes,identical:sameCandidate&&sameHashes},\n    TEN_NEW_CONTEXTS:{determination:independence.determination,reasons:independence.reasons||[]},\n    COMPLETE_TEST_RESULTS:{expected:matrix.expected.length,missing:matrix.missing,duplicates:matrix.duplicates,invalid:matrix.invalid||[],complete:matrix.expected.length>0&&!matrix.missing.length&&!matrix.duplicates.length&&!(matrix.invalid||[]).length},\n    REGRESSION_RESULTS:{required:activeRegressions.map(r=>recordId(r,'regressions')),successful:[...successfulRegressionIds]},\n    COMPARISON_RESULTS:{ids:comparisonRows.map(r=>recordId(r,'comparisons'))},\n    NEW_DEFECTS:newDefectIds,\n    NEW_REQUIREMENTS:[],\n    NEW_FAILURE_CASES:[],\n    NEW_VARIANCE:comparisonRows.filter(r=>adjudicationAdverse(recordValue(r,'CORRECTNESS_AFFECTING_VARIANCE'))&&!truth(recordValue(r,'AUTHORIZED_VARIANCE'))).map(r=>recordId(r,'comparisons')),\n    DETERMINATION:exactSatisfied?'SATISFIED':'UNDETERMINED',\n    EVIDENCE:[...new Set([...(iterationEvaluation.reasons||[]),...(determination.reasons||[]),...(independence.reasons||[])])]\n  };\n  const record=existing[0]||{id:fields.CONFIRMATION_ID,stage:19,fields:{},relationships:{},scope:scopeForIteration(project,confirmationIterationId),active:true};\n  record.id=fields.CONFIRMATION_ID;record.stage=19;record.fields=fields;record.relationships={SOURCE_ITERATION_ID:sourceIterationId,CONFIRMATION_ITERATION_ID:confirmationIterationId};record.scope=scopeForIteration(project,confirmationIterationId);record.producer='APPLICATION';record.active=true;refreshRecordHashes(record,'confirmationRecords');\n  if(!existing.length)project.projectData.confirmationRecords.push(record);\n  addHistory(project,'UNCHANGED_CONFIRMATION_CALCULATED',{confirmationId:fields.CONFIRMATION_ID,sourceIterationId,confirmationIterationId,determination:fields.DETERMINATION});\n  return record;\n}\n`;
    source=replaceOnce(source,marker,fn+marker,'Stage 19 application calculation insertion');
  }
  source=source.replace('case 19:{requireAccepted();const iteration=latestIteration(project,[19]);','case 19:{const iteration=latestIteration(project,[19]);');
  const exportMarker='coverageMetrics,convergenceMetrics,selectReleaseDisposition,releaseMetrics,';
  if(!source.includes('coverageMetrics,convergenceMetrics,calculateUnchangedConfirmation,selectReleaseDisposition,releaseMetrics,'))source=replaceOnce(source,exportMarker,'coverageMetrics,convergenceMetrics,calculateUnchangedConfirmation,selectReleaseDisposition,releaseMetrics,','Stage 19 application calculation export');
  fs.writeFileSync(path,source);
}

// 4. Strengthen the permanent regression with executable ingestion proof and
// ownership proof. The test remains after this one-time repair script is deleted.
{
  const testPath='verify-operation-authority-closure.mjs';
  let test=fs.readFileSync(testPath,'utf8');
  if(!test.includes("for(const file of ['test-runtime.js','workflow-engine.js','response-ingestion.js'])")){
    const runtimeMarker='const schema=globalThis.closedLoopWorkflowSchema;';
    const executable=`for(const file of ['test-runtime.js','workflow-engine.js','response-ingestion.js']){\n  vm.runInThisContext(fs.readFileSync(new URL(\`./\${file}\`,import.meta.url),'utf8'),{filename:file});\n}\nconst state=globalThis.closedLoopCore.createBlankState('JOB-AUTHORITY-REJECTION');\nstate.job.CONTRACT_PROFILE_ID='closed-loop-completion-profile/1';\nconst forbiddenEnvelope={schema:'closed-loop-stage-response/3',contractProfileId:'closed-loop-completion-profile/1',jobId:state.job.JOB_ID,stage:18,operation:'COMPLETE',promptIdentity:{instructionId:'INSTRUCTION-AUTHORITY',bodySha256:'0'.repeat(64),contractSha256:'1'.repeat(64),contextSignature:'2'.repeat(64)},scope:{},responseType:'DATA_PROPOSAL',humanInputRequests:[],humanAuthorityCandidates:[],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};\nconst forbiddenPrompt={stage:18,operation:'COMPLETE',instructionId:'INSTRUCTION-AUTHORITY',bodySha256:'0'.repeat(64),contractSha256:'1'.repeat(64),contextSignature:'2'.repeat(64),scope:{},promptEngineVersion:null};\nconst forbiddenValidation=globalThis.closedLoopResponseIngestion.validateEnvelope(state,forbiddenEnvelope,{stage:18,promptRecord:forbiddenPrompt,rawSha256:'3'.repeat(64),files:[]});\nassert.ok(forbiddenValidation.issues.some(item=>item.code==='EXTERNAL_RESPONSE_NOT_ALLOWED'),'Stage 18 COMPLETE external response envelope must be rejected by executable ingestion validation');\nconst confirmationOwnership=schema.RECORD_OWNERSHIP.confirmationRecords;\nassert.deepEqual([...confirmationOwnership.agent],[],'Stage 19 confirmation canonical fields must not remain agent-owned');\nfor(const field of ['ZERO_MATERIAL_CHANGES','VERSION_HASH_COMPARISON','TEN_NEW_CONTEXTS','COMPLETE_TEST_RESULTS','REGRESSION_RESULTS','COMPARISON_RESULTS','NEW_DEFECTS','NEW_REQUIREMENTS','NEW_FAILURE_CASES','NEW_VARIANCE','DETERMINATION','EVIDENCE'])assert.ok(confirmationOwnership.application.includes(field),\`Stage 19 confirmation field \${field} must be application-owned\`);\n\n`;
    test=replaceOnce(test,runtimeMarker,executable+runtimeMarker,'executable authority regression insertion');
  }
  fs.writeFileSync(testPath,test);
}
