import fs from 'node:fs';
function replaceOnce(source,from,to,label){const n=source.split(from).length-1;if(n!==1)throw new Error(`${label}: expected 1 occurrence, found ${n}`);return source.replace(from,to);}

{
  const path='workflow-engine.js';
  let s=fs.readFileSync(path,'utf8');
  if(!s.includes('function recordConvergenceDetermination(')){
    const marker='function recordUnchangedConfirmationDetermination(project,{sourceIterationId,confirmationIterationId}={}){';
    const fn=`function recordConvergenceDetermination(project){\n  ensureShape(project);\n  const metrics=convergenceMetrics(project);\n  const iterationId=String(metrics.iterationId||recordId(latestIteration(project,[17]),'iterations')||'').trim();\n  if(!iterationId)throw new Error('Stage 18 requires a current completed corrected iteration.');\n  const fingerprint=hash.sha256Value({iterationId,metrics});\n  const existing=records(project,'convergenceRecords').find(r=>r.convergenceFingerprint===fingerprint&&isActiveRecord(r));\n  if(existing)return existing;\n  for(const prior of records(project,'convergenceRecords',{active:false}).filter(r=>isActiveRecord(r))){prior.active=false;prior.validity='SUPERSEDED';prior.invalidatedBy='CONVERGENCE-DEPENDENCIES-CHANGED';refreshRecordHashes(prior,'convergenceRecords');}\n  const fields={\n    CONVERGENCE_ID:'',\n    ITERATION_ID:iterationId,\n    REQUIREMENT_COVERAGE:metrics.requirementCoverage,\n    VERIFICATION_COVERAGE:metrics.verificationCoverage,\n    REGRESSION_SUCCESS:metrics.regressionSuccess,\n    CRITICAL_DEFECT_COUNT:metrics.criticalDefects,\n    MAJOR_DEFECT_COUNT:metrics.majorDefects,\n    MANDATORY_UNRESOLVED_UNKNOWN_COUNT:metrics.mandatoryUnresolvedUnknowns,\n    CORRECTNESS_AFFECTING_CONTRADICTION_COUNT:metrics.contradictions,\n    CORRECTNESS_AFFECTING_AMBIGUITY_COUNT:metrics.ambiguities,\n    UNEXPLAINED_CORRECTNESS_AFFECTING_VARIANCE_COUNT:metrics.unexplainedVariance,\n    CONVERGED:Boolean(metrics.converged)\n  };\n  const record=commandRecord(project,'convergenceRecords',fields,{stage:18,source:'APPLICATION_DERIVATION',scope:scopeForIteration(project,iterationId)});\n  record.fields.CONVERGENCE_ID=record.id;record.CONVERGENCE_ID=record.id;record.convergenceFingerprint=fingerprint;record.derivationKey='stage18.convergence';refreshRecordHashes(record,'convergenceRecords');\n  addHistory(project,'CONVERGENCE_CALCULATED',{recordId:record.id,iterationId,converged:Boolean(metrics.converged),fingerprint});\n  recalculate(project);\n  return record;\n}\n\n`;
    s=replaceOnce(s,marker,fn+marker,'insert Stage 18 application calculation');
  }
  s=replaceOnce(s,"case 18:{\n      requireAccepted();const metrics=convergenceMetrics(project);","case 18:{\n      const metrics=convergenceMetrics(project),convergenceRows=recordsForCurrentScope(project,'convergenceRecords');\n      if(convergenceRows.length!==1)reasons.push('Exactly one current application-derived convergence determination is required.');",'Stage 18 gate authority');
  s=s.replace('case 19:{requireAccepted();const iteration=latestIteration(project,[19]);','case 19:{const iteration=latestIteration(project,[19]);');
  s=s.replace('case 20:{requireAccepted();const confirmations=','case 20:{const confirmations=');
  s=s.replace('case 30:{requireAccepted();const defects=','case 30:{const defects=');
  const exportNeedle='recordHumanInputVersion,recordStageConfirmation,recordUnchangedConfirmationDetermination,recordReleaseDetermination,';
  if(!s.includes('recordHumanInputVersion,recordStageConfirmation,recordConvergenceDetermination,recordUnchangedConfirmationDetermination,recordReleaseDetermination,'))s=replaceOnce(s,exportNeedle,'recordHumanInputVersion,recordStageConfirmation,recordConvergenceDetermination,recordUnchangedConfirmationDetermination,recordReleaseDetermination,','export Stage 18 application calculation');
  fs.writeFileSync(path,s);
}

{
  const path='verify-full-cycle.mjs';let s=fs.readFileSync(path,'utf8');
  s=s.replace("data(18,{stageData:{RETURN_STAGE_FOR_EACH_FAILURE:'NONE'}});complete(18);","const convergenceRecord=engine.recordConvergenceDetermination(p);assert(engine.recordValue(convergenceRecord,'CONVERGED')===true,'Stage 18 application convergence calculation did not derive convergence');complete(18);");
  s=s.replace("data(20,{stageData:{BASELINE_PACKAGE_SEPARATED_FROM_WORKING_FILES:'TRUE'}});engine.freezeBaseline(p,{artifactIds:['ARTIFACT-CANDIDATE'],operatorLabel:'FULL_CYCLE'});","engine.freezeBaseline(p,{artifactIds:['ARTIFACT-CANDIDATE'],operatorLabel:'FULL_CYCLE'});");
  s=s.replace("data(29,{stageData:{EVIDENCE_REPOSITORY_LOCATION:'Canonical project',REPRODUCTION_INSTRUCTIONS:'Follow IDs',CONTROLLING_EVIDENCE:'Canonical evidence'}});engine.constructEvidenceChains(p);","engine.constructEvidenceChains(p);");
  s=s.replace("data(30,{stageData:{REGISTRY_STORAGE_LOCATION:'Canonical project',REGISTRY_RETENTION_RULE:'APPEND_ONLY',REGISTRY_HASH_OR_INTEGRITY_EVIDENCE:'Canonical hashes',CONTROLLING_EVIDENCE:'Permanent history'}});complete(30);","complete(30);");
  for(const forbidden of ['data(18,','data(20,','data(29,','data(30,'])if(s.includes(forbidden))throw new Error(`Full-cycle fixture still contains forbidden non-agent transport: ${forbidden}`);
  fs.writeFileSync(path,s);
}

{
  const path='verify-operation-authority-closure.mjs';let s=fs.readFileSync(path,'utf8');
  const marker="const calculateRelease=schema.operationContract(27,'CALCULATE_RELEASE');";
  const proof=`for(const [stage,operation] of [[18,'COMPLETE'],[19,'CONFIRM'],[20,'FREEZE_BASELINE'],[30,'CALCULATE_TERMINAL']]){\n  const contract=schema.operationContract(stage,operation);\n  assert.equal(contract.responseEnvelopeAllowed,false,\`Stage \${stage} \${operation} must reject external response envelopes\`);\n}\nassert.equal(typeof globalThis.closedLoopWorkflowEngine.recordConvergenceDetermination,'function','Stage 18 COMPLETE must have an application-owned convergence command');\n\n`;
  if(!s.includes("Stage 18 COMPLETE must have an application-owned convergence command"))s=replaceOnce(s,marker,proof+marker,'application-command regression insertion');
  fs.writeFileSync(path,s);
}
