import fs from 'node:fs';

function replaceOnce(path,oldText,newText,label){
  let source=fs.readFileSync(path,'utf8');
  const count=source.split(oldText).length-1;
  if(count===0&&source.includes(newText))return;
  if(count!==1)throw new Error(`${label}: expected exactly one repair marker, found ${count}.`);
  source=source.replace(oldText,newText);
  fs.writeFileSync(path,source);
}

// External envelopes are invalid for application, human-decision, and operator operations.
{
  const path='response-ingestion.js';
  const marker="const expectedOperation=promptRecord?.operation||contract?.operations?.[0];const operationContract=schema.operationContract(stageNumber,expectedOperation);if(String(envelope.operation||'')!==String(expectedOperation||''))issues.push(issue('WRONG_OPERATION','/operation',`Expected operation ${expectedOperation||'UNKNOWN'}.`));";
  const enforcement="if(operationContract?.responseEnvelopeAllowed===false)issues.push(issue('EXTERNAL_RESPONSE_NOT_ALLOWED','/operation',`Operation ${expectedOperation||'UNKNOWN'} is not an external-response operation and cannot accept an external response envelope.`));";
  let source=fs.readFileSync(path,'utf8');
  if(!source.includes(enforcement)){
    if((source.split(marker).length-1)!==1)throw new Error('response-ingestion operation marker is missing or ambiguous.');
    source=source.replace(marker,marker+enforcement);
    fs.writeFileSync(path,source);
  }
}

// Stage 15 owns pre-correction failure proof only; later execution owns correction success.
{
  const path='workflow-schema.js';
  let source=fs.readFileSync(path,'utf8');
  const extra='"POST_CORRECTION_SUCCESSES_PROVEN":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},';
  const count=source.split(extra).length-1;
  if(count>1)throw new Error(`Stage 15 extra field is ambiguous: ${count} occurrences.`);
  if(count===1){source=source.replace(extra,'');fs.writeFileSync(path,source);}
}

// Ingestion verification must not fabricate external responses for direct commands.
replaceOnce(
  'verify-ingestion.mjs',
  "function validEnvelope(p,stage,promptRecord){\n  const contract=schema.STAGE_CONTRACTS[stage],operationContract=schema.operationContract(stage,promptRecord.operation),stageFields=operationContract?.allowedStageData||contract.allowedStageData,writableCollections=operationContract?.agentWritableCollections||contract.allowedCollections;",
  "function validEnvelope(p,stage,promptRecord){\n  const contract=schema.STAGE_CONTRACTS[stage],operationContract=schema.operationContract(stage,promptRecord.operation);\n  if(operationContract?.responseEnvelopeAllowed===false)return null;\n  const stageFields=operationContract?.allowedStageData||contract.allowedStageData,writableCollections=operationContract?.agentWritableCollections||contract.allowedCollections;",
  'verify-ingestion application-command routing'
);

// Stage 19 CONFIRM is the application calculation itself; it cannot be a prerequisite of itself.
replaceOnce(
  'workflow-engine.js',
  "requiredOps=stage===17?['FREEZE','EXECUTE_RUN','VERIFY','COMPARE','ROOT_CAUSE','REGRESSION','CORRECT']:stage===19?['CONFIRM_FREEZE','EXECUTE_RUN','VERIFY','COMPARE','REGRESSION_VERIFY','CONFIRM']:[],reasons=[];",
  "requiredOps=stage===17?['FREEZE','EXECUTE_RUN','VERIFY','COMPARE','ROOT_CAUSE','REGRESSION','CORRECT']:stage===19?['CONFIRM_FREEZE','EXECUTE_RUN','VERIFY','COMPARE','REGRESSION_VERIFY']:[],reasons=[];",
  'Stage 19 non-self-referential prerequisites'
);

{
  const path='workflow-engine.js';
  let source=fs.readFileSync(path,'utf8');
  if(!source.includes('function calculateUnchangedConfirmation(')){
    const anchor="function freezeBaseline(project,{artifactIds=[],operatorLabel='HUMAN_OPERATOR',authorization='AUTHORIZED'}={}){";
    if((source.split(anchor).length-1)!==1)throw new Error('Stage 19 calculation insertion marker is missing or ambiguous.');
    const fn=`function calculateUnchangedConfirmation(project,{operatorLabel='APPLICATION'}={}){\n  ensureShape(project);\n  const iteration=records(project,'iterations').find(r=>Number(r.stage)===19&&isActiveRecord(r)&&recordId(r,'iterations')===String(project.job.CURRENT_ITERATION||''));\n  if(!iteration)throw new Error('A current Stage 19 unchanged-confirmation iteration is required.');\n  const iterationId=recordId(iteration,'iterations'),sourceIterationId=String(recordValue(iteration,'PREVIOUS_ITERATION_ID')||'').trim();\n  if(!sourceIterationId)throw new Error('The unchanged-confirmation iteration must identify its source converged iteration.');\n  const existing=recordsForCurrentScope(project,'confirmationRecords').find(r=>String(recordValue(r,'CONFIRMATION_ITERATION_ID')||r.relationships?.CONFIRMATION_ITERATION_ID||'')===iterationId);\n  if(existing)return existing;\n  const ev=evaluateIteration(project,iterationId,'UNCHANGED_CONFIRMATION'),matrix=verificationMatrix(project,iterationId),candidateId=iterationCandidateId(project,iterationId),candidate=candidateId&&records(project,'candidateFreezes').find(r=>recordId(r,'candidateFreezes')===candidateId),sourceIteration=records(project,'iterations').find(r=>recordId(r,'iterations')===sourceIterationId),sourceCandidateId=sourceIteration?iterationCandidateId(project,sourceIterationId):'',sourceCandidate=sourceCandidateId&&records(project,'candidateFreezes').find(r=>recordId(r,'candidateFreezes')===sourceCandidateId);\n  const sameCandidate=Boolean(candidate&&sourceCandidate&&recordId(candidate,'candidateFreezes')===recordId(sourceCandidate,'candidateFreezes')&&hash.sha256Value(recordValue(candidate,'COMPONENT_HASHES')||{})===hash.sha256Value(recordValue(sourceCandidate,'COMPONENT_HASHES')||{}));\n  const activeRegs=activeRegressions(project),regExec=currentRegressionExecutions(project,iterationId),regressionSatisfied=activeRegs.every(reg=>{const id=recordId(reg,'regressions'),xs=regExec.filter(x=>String(recordValue(x,'REG_ID')||x.relationships?.REG_ID||'')===id&&upper(recordValue(x,'PHASE'))!=='PRE_CORRECTION');return xs.length===1&&effectiveRegressionDetermination(project,xs[0]).determination==='SATISFIED';});\n  const newDefects=confirmedDefects(project).filter(d=>String(d.scope?.iterationId||'')===iterationId),comparisons=recordsForIteration(project,'comparisons',iterationId),newVariance=comparisons.filter(r=>truth(recordValue(r,'CORRECTNESS_AFFECTING_VARIANCE'))&&!truth(recordValue(r,'AUTHORIZED_VARIANCE')));\n  const determination=ev.complete&&sameCandidate&&regressionSatisfied&&!newDefects.length&&!newVariance.length?'SATISFIED':'UNDETERMINED';\n  const fields={SOURCE_ITERATION_ID:sourceIterationId,CONFIRMATION_ITERATION_ID:iterationId,ZERO_MATERIAL_CHANGES:sameCandidate?'TRUE':'FALSE',VERSION_HASH_COMPARISON:hash.sha256Value({sourceCandidateId,currentCandidateId:candidateId,sourceHashes:recordValue(sourceCandidate,'COMPONENT_HASHES')||{},currentHashes:recordValue(candidate,'COMPONENT_HASHES')||{}}),TEN_NEW_CONTEXTS:ev.runs.length===10&&ev.independence?.determination==='APPLICATION_ESTABLISHED'?'TRUE':'FALSE',COMPLETE_TEST_RESULTS:matrix.expected.length>0&&!matrix.missing.length&&!matrix.duplicates.length&&!matrix.invalid.length?'TRUE':'FALSE',REGRESSION_RESULTS:regressionSatisfied?'TRUE':'FALSE',COMPARISON_RESULTS:comparisons.length?'TRUE':'FALSE',NEW_DEFECTS:newDefects.map(d=>recordId(d,'defects')),NEW_REQUIREMENTS:[],NEW_FAILURE_CASES:[],NEW_VARIANCE:newVariance.map(r=>recordId(r,'comparisons')),DETERMINATION:determination,EVIDENCE:hash.sha256Value({iterationId,sourceIterationId,ev:ev.reasons,sameCandidate,regressionSatisfied,newDefects:newDefects.map(d=>recordId(d,'defects')),newVariance:newVariance.map(r=>recordId(r,'comparisons'))})};\n  const record=commandRecord(project,'confirmationRecords',fields,{stage:19,source:'APPLICATION_DERIVATION',scope:{...currentScope(project),iterationId,candidateId}});\n  record.relationships={SOURCE_ITERATION_ID:sourceIterationId,CONFIRMATION_ITERATION_ID:iterationId};refreshRecordHashes(record,'confirmationRecords');addHistory(project,'UNCHANGED_CONFIRMATION_CALCULATED',{stage:19,confirmationId:recordId(record,'confirmationRecords'),iterationId,sourceIterationId,determination,operatorLabel});recalculate(project);return record;\n}\n`;
    source=source.replace(anchor,fn+anchor);
  }
  const exportOld='freezeCandidate,beginUnchangedConfirmationIteration,freezeBaseline,reserveProductExecution';
  const exportNew='freezeCandidate,beginUnchangedConfirmationIteration,calculateUnchangedConfirmation,freezeBaseline,reserveProductExecution';
  if(!source.includes(exportNew)){
    if((source.split(exportOld).length-1)!==1)throw new Error('Stage 19 calculation export marker is missing or ambiguous.');
    source=source.replace(exportOld,exportNew);
  }
  fs.writeFileSync(path,source);
}

// Permanent authority regression: enforce ingestion and exact Stage 15 field closure.
{
  const path='verify-operation-authority-closure.mjs';
  let test=fs.readFileSync(path,'utf8');
  const marker="const calculateRelease=schema.operationContract(27,'CALCULATE_RELEASE');\nassert.deepEqual([...calculateRelease.agentWritableCollections],[],'Stage 27 release calculation must not expose release records or reviews to the agent');\n";
  const assertion="assert.equal(Object.prototype.hasOwnProperty.call(schema.STAGE_FIELDS[15]||{},'POST_CORRECTION_SUCCESSES_PROVEN'),false,'Stage 15 must not expose post-correction success as a Stage 15 field; correction success belongs to a distinct later execution.');\n";
  if(!test.includes(assertion)){
    if((test.split(marker).length-1)!==1)throw new Error('Stage 15 regression insertion marker is missing or ambiguous.');
    test=test.replace(marker,marker+assertion);
  }
  fs.writeFileSync(path,test);
}
