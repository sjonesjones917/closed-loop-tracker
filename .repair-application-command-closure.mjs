import fs from 'node:fs';

function replaceOnce(path,oldText,newText,label){
  let source=fs.readFileSync(path,'utf8');
  if(source.includes(newText))return;
  const count=source.split(oldText).length-1;
  if(count!==1)throw new Error(`${label}: expected one marker, found ${count}.`);
  fs.writeFileSync(path,source.replace(oldText,newText));
}

// Stage 18 and Stage 19 calculated records are application-owned.
{
  const path='workflow-schema.js';
  let source=fs.readFileSync(path,'utf8');
  const old=`  "convergenceRecords": {\n    "human": [],\n    "humanDecision": [],\n    "agent": [\n      "FAILED_CONDITIONS",\n      "RETURN_STAGES",\n      "EVIDENCE"\n    ],\n    "application": [\n      "CONVERGENCE_ID",\n      "ITERATION_ID",\n      "REQUIREMENT_COVERAGE",\n      "VERIFICATION_COVERAGE",\n      "REGRESSION_SUCCESS",\n      "CRITICAL_DEFECT_COUNT",\n      "MAJOR_DEFECT_COUNT",\n      "MANDATORY_UNRESOLVED_UNKNOWN_COUNT",\n      "CORRECTNESS_AFFECTING_CONTRADICTION_COUNT",\n      "CORRECTNESS_AFFECTING_AMBIGUITY_COUNT",\n      "UNEXPLAINED_CORRECTNESS_AFFECTING_VARIANCE_COUNT",\n      "CONVERGED"\n    ]\n  },\n  "confirmationRecords": {\n    "human": [],\n    "humanDecision": [],\n    "agent": [\n      "ZERO_MATERIAL_CHANGES",\n      "VERSION_HASH_COMPARISON",\n      "TEN_NEW_CONTEXTS",\n      "COMPLETE_TEST_RESULTS",\n      "REGRESSION_RESULTS",\n      "COMPARISON_RESULTS",\n      "NEW_DEFECTS",\n      "NEW_REQUIREMENTS",\n      "NEW_FAILURE_CASES",\n      "NEW_VARIANCE",\n      "DETERMINATION",\n      "EVIDENCE"\n    ],\n    "application": [\n      "CONFIRMATION_ID",\n      "SOURCE_ITERATION_ID",\n      "CONFIRMATION_ITERATION_ID"\n    ]\n  },`;
  const next=`  "convergenceRecords": {\n    "human": [],\n    "humanDecision": [],\n    "agent": [],\n    "application": [\n      "CONVERGENCE_ID",\n      "ITERATION_ID",\n      "REQUIREMENT_COVERAGE",\n      "VERIFICATION_COVERAGE",\n      "REGRESSION_SUCCESS",\n      "CRITICAL_DEFECT_COUNT",\n      "MAJOR_DEFECT_COUNT",\n      "MANDATORY_UNRESOLVED_UNKNOWN_COUNT",\n      "CORRECTNESS_AFFECTING_CONTRADICTION_COUNT",\n      "CORRECTNESS_AFFECTING_AMBIGUITY_COUNT",\n      "UNEXPLAINED_CORRECTNESS_AFFECTING_VARIANCE_COUNT",\n      "CONVERGED",\n      "FAILED_CONDITIONS",\n      "RETURN_STAGES",\n      "EVIDENCE"\n    ]\n  },\n  "confirmationRecords": {\n    "human": [],\n    "humanDecision": [],\n    "agent": [],\n    "application": [\n      "CONFIRMATION_ID",\n      "SOURCE_ITERATION_ID",\n      "CONFIRMATION_ITERATION_ID",\n      "ZERO_MATERIAL_CHANGES",\n      "VERSION_HASH_COMPARISON",\n      "TEN_NEW_CONTEXTS",\n      "COMPLETE_TEST_RESULTS",\n      "REGRESSION_RESULTS",\n      "COMPARISON_RESULTS",\n      "NEW_DEFECTS",\n      "NEW_REQUIREMENTS",\n      "NEW_FAILURE_CASES",\n      "NEW_VARIANCE",\n      "DETERMINATION",\n      "EVIDENCE"\n    ]\n  },`;
  if(!source.includes(next)){
    if((source.split(old).length-1)!==1)throw new Error('Application-calculated ownership block is missing or ambiguous.');
    source=source.replace(old,next);fs.writeFileSync(path,source);
  }
}

{
  const path='workflow-engine.js';
  let source=fs.readFileSync(path,'utf8');
  replaceOnce(path,"    case 18:{\n      requireAccepted();const metrics=convergenceMetrics(project);\n      if(!metrics.converged)reasons.push('All convergence conditions are not simultaneously satisfied.');\n      break;\n    }","    case 18:{\n      const metrics=convergenceMetrics(project),convergence=collection('convergenceRecords');\n      if(convergence.length!==1)reasons.push('Exactly one current application-calculated convergence record is required.');\n      if(convergence.length===1&&!truth(recordValue(convergence[0],'CONVERGED')))reasons.push('The current convergence record is not affirmatively converged.');\n      if(!metrics.converged)reasons.push('All convergence conditions are not simultaneously satisfied.');\n      break;\n    }",'Stage 18 gate');
  source=fs.readFileSync(path,'utf8');
  if(!source.includes('function calculateConvergence(project')){
    const anchor="function calculateUnchangedConfirmation(project,{operatorLabel='APPLICATION'}={}){";
    if((source.split(anchor).length-1)!==1)throw new Error('Stage 18 command insertion marker missing.');
    const fn=`function calculateConvergence(project,{operatorLabel='APPLICATION'}={}){\n  ensureShape(project);\n  const iteration=latestIteration(project,[17]),iterationId=recordId(iteration,'iterations');\n  if(!iterationId)throw new Error('A current completed Stage 17 iteration is required before convergence can be calculated.');\n  const metrics=convergenceMetrics(project),fingerprint=hash.sha256Value(metrics);\n  const existing=recordsForCurrentScope(project,'convergenceRecords').find(r=>String(recordValue(r,'ITERATION_ID')||r.relationships?.ITERATION_ID||'')===iterationId&&r.convergenceFingerprint===fingerprint);\n  if(existing)return existing;\n  for(const prior of recordsForCurrentScope(project,'convergenceRecords')){prior.active=false;prior.validity='SUPERSEDED';prior.invalidatedBy='CONVERGENCE-'+fingerprint;refreshRecordHashes(prior,'convergenceRecords');}\n  const failed=[];\n  if(metrics.requirementCoverage!==1)failed.push('MANDATORY_REQUIREMENT_COVERAGE');if(metrics.verificationCoverage!==1)failed.push('MANDATORY_VERIFICATION_COVERAGE');if(metrics.regressionSuccess!==1)failed.push('REGRESSION_TEST_SUCCESS');if(metrics.criticalDefects)failed.push('CRITICAL_DEFECTS');if(metrics.majorDefects)failed.push('MAJOR_DEFECTS');if(metrics.mandatoryUnresolvedUnknowns)failed.push('MANDATORY_UNRESOLVED_UNKNOWNS');if(metrics.contradictions)failed.push('KNOWN_CORRECTNESS_AFFECTING_CONTRADICTIONS');if(metrics.ambiguities)failed.push('KNOWN_CORRECTNESS_AFFECTING_AMBIGUITIES');if(metrics.unexplainedVariance)failed.push('UNEXPLAINED_CORRECTNESS_AFFECTING_EXECUTION_VARIANCE');\n  const fields={ITERATION_ID:iterationId,REQUIREMENT_COVERAGE:metrics.requirementCoverage,VERIFICATION_COVERAGE:metrics.verificationCoverage,REGRESSION_SUCCESS:metrics.regressionSuccess,CRITICAL_DEFECT_COUNT:metrics.criticalDefects,MAJOR_DEFECT_COUNT:metrics.majorDefects,MANDATORY_UNRESOLVED_UNKNOWN_COUNT:metrics.mandatoryUnresolvedUnknowns,CORRECTNESS_AFFECTING_CONTRADICTION_COUNT:metrics.contradictions,CORRECTNESS_AFFECTING_AMBIGUITY_COUNT:metrics.ambiguities,UNEXPLAINED_CORRECTNESS_AFFECTING_VARIANCE_COUNT:metrics.unexplainedVariance,CONVERGED:metrics.converged?'TRUE':'FALSE',FAILED_CONDITIONS:failed.length?failed.join(', '):'NONE',RETURN_STAGES:failed.length?'DERIVED FROM EACH FAILED CONDITION':'NONE',EVIDENCE:fingerprint};\n  const record=commandRecord(project,'convergenceRecords',fields,{stage:18,source:'APPLICATION_DERIVATION',scope:{...currentScope(project),iterationId}});record.relationships={ITERATION_ID:iterationId};record.convergenceFingerprint=fingerprint;refreshRecordHashes(record,'convergenceRecords');addHistory(project,'CONVERGENCE_CALCULATED',{stage:18,convergenceId:recordId(record,'convergenceRecords'),iterationId,converged:metrics.converged,operatorLabel});recalculate(project);return record;\n}\n`;
    source=source.replace(anchor,fn+anchor);fs.writeFileSync(path,source);
  }
  source=fs.readFileSync(path,'utf8');
  const oldTypes="NEW_DEFECTS:newDefects.map(d=>recordId(d,'defects')),NEW_REQUIREMENTS:[],NEW_FAILURE_CASES:[],NEW_VARIANCE:newVariance.map(r=>recordId(r,'comparisons'))";
  const newTypes="NEW_DEFECTS:newDefects.length?newDefects.map(d=>recordId(d,'defects')).join(', '):'NONE',NEW_REQUIREMENTS:'NONE',NEW_FAILURE_CASES:'NONE',NEW_VARIANCE:newVariance.length?newVariance.map(r=>recordId(r,'comparisons')).join(', '):'NONE'";
  if(source.includes(oldTypes)){source=source.replace(oldTypes,newTypes);fs.writeFileSync(path,source);}
  source=fs.readFileSync(path,'utf8');
  if(!source.includes('beginUnchangedConfirmationIteration,calculateConvergence,calculateUnchangedConfirmation')){
    const old='beginUnchangedConfirmationIteration,calculateUnchangedConfirmation';
    if((source.split(old).length-1)!==1)throw new Error('Engine export marker missing.');
    source=source.replace(old,'beginUnchangedConfirmationIteration,calculateConvergence,calculateUnchangedConfirmation');fs.writeFileSync(path,source);
  }
  replaceOnce(path,'case 20:{requireAccepted();const confirmations=','case 20:{const confirmations=','Stage 20 gate authority');
  replaceOnce(path,'case 27:{requireAccepted();const r=','case 27:{const r=','Stage 27 gate authority');
  replaceOnce(path,'case 30:{requireAccepted();const defects=','case 30:{const defects=','Stage 30 gate authority');
}

{
  const path='verify-full-cycle.mjs';
  let source=fs.readFileSync(path,'utf8');
  source=source.replace("data(18,{stageData:{RETURN_STAGE_FOR_EACH_FAILURE:'NONE'}});complete(18);","engine.calculateConvergence(p,{operatorLabel:'FULL_CYCLE'});complete(18);");
  const old19="data(19,{operation:'CONFIRM',records:{confirmationRecords:[recordProposal(schema,'confirmationRecords',{tempKey:'confirm',relationships:{SOURCE_ITERATION_ID:{recordId:iter17},CONFIRMATION_ITERATION_ID:{recordId:iter19}},overrides:{ZERO_MATERIAL_CHANGES:'TRUE',VERSION_HASH_COMPARISON:'MATCH',TEN_NEW_CONTEXTS:'TRUE',COMPLETE_TEST_RESULTS:'SATISFIED',REGRESSION_RESULTS:'SATISFIED',COMPARISON_RESULTS:'SATISFIED',NEW_DEFECTS:'NONE',NEW_REQUIREMENTS:'NONE',NEW_FAILURE_CASES:'NONE',NEW_VARIANCE:'NONE',DETERMINATION:'SATISFIED',EVIDENCE:'Unchanged confirmation evidence'}})]}});complete(19);";
  source=source.replace(old19,"engine.calculateUnchangedConfirmation(p,{operatorLabel:'FULL_CYCLE'});complete(19);");
  source=source.replace("data(20,{stageData:{BASELINE_PACKAGE_SEPARATED_FROM_WORKING_FILES:'TRUE'}});engine.freezeBaseline","engine.freezeBaseline");
  source=source.replace("data(29,{stageData:{EVIDENCE_REPOSITORY_LOCATION:'Canonical project',REPRODUCTION_INSTRUCTIONS:'Follow IDs',CONTROLLING_EVIDENCE:'Canonical evidence'}});engine.constructEvidenceChains(p);","engine.constructEvidenceChains(p);");
  source=source.replace("data(30,{stageData:{REGISTRY_STORAGE_LOCATION:'Canonical project',REGISTRY_RETENTION_RULE:'APPEND_ONLY',REGISTRY_HASH_OR_INTEGRITY_EVIDENCE:'Canonical hashes',CONTROLLING_EVIDENCE:'Permanent history'}});complete(30);","engine.recalculate(p);complete(30);");
  fs.writeFileSync(path,source);
}

{
  const path='verify-operation-authority-closure.mjs';let source=fs.readFileSync(path,'utf8');
  const marker="assert.equal(typeof globalThis.closedLoopWorkflowEngine?.calculateUnchangedConfirmation,'function','Stage 19 CONFIRM must execute through an application-owned calculation path');";
  const extra="\nassert.equal(typeof globalThis.closedLoopWorkflowEngine?.calculateConvergence,'function','Stage 18 COMPLETE must execute through an application-owned convergence calculation path');\nfor(const collection of ['convergenceRecords','confirmationRecords'])assert.deepEqual(schema.RECORD_OWNERSHIP[collection].agent,[],collection+' must not expose application-calculated state to agent ownership');";
  if(!source.includes('calculateConvergence')){if((source.split(marker).length-1)!==1)throw new Error('Authority regression marker missing.');source=source.replace(marker,marker+extra);fs.writeFileSync(path,source);}
}
