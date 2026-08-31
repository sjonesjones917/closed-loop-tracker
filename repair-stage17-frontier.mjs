import fs from 'node:fs';

function replaceOnce(source, oldText, newText, label) {
  const first = source.indexOf(oldText);
  if (first < 0) throw new Error(`Missing expected source for ${label}.`);
  if (source.indexOf(oldText, first + oldText.length) >= 0) throw new Error(`Expected unique source for ${label}.`);
  return source.slice(0, first) + newText + source.slice(first + oldText.length);
}

let engine = fs.readFileSync('workflow-engine.js', 'utf8');
engine = replaceOnce(
  engine,
  "  if(Number(stage)===19){const appIteration=records(project,'iterations').find(r=>Number(r.stage)===19&&isActiveRecord(r)&&upper(recordValue(r,'PURPOSE'))==='UNCHANGED_CONFIRMATION'&&(!scopeRule.iterationId||recordId(r,'iterations')===String(scopeRule.iterationId))&&(!scopeRule.candidateId||String(recordValue(r,'CANDIDATE_ID')||r.scope?.candidateId||'')===String(scopeRule.candidateId)));if(appIteration)out.add('CONFIRM_FREEZE');}",
  `  if(Number(stage)===17){
    const appIteration=records(project,'iterations').find(r=>Number(r.stage)===17&&isActiveRecord(r)&&(!scopeRule.iterationId||recordId(r,'iterations')===String(scopeRule.iterationId))&&(!scopeRule.candidateId||String(recordValue(r,'CANDIDATE_ID')||r.scope?.candidateId||'')===String(scopeRule.candidateId)));
    if(appIteration){
      out.add('FREEZE');
      if(out.has('COMPARE')){
        const iterationId=recordId(appIteration,'iterations'),scope=scopeForIteration(project,iterationId),matrix=verificationMatrix(project,iterationId),requirements=mandatoryRequirements(project,scope),comparisons=recordsForIteration(project,'comparisons',iterationId),defects=recordsForIteration(project,'defects',iterationId),comparisonByRequirement=new Map();
        for(const comparison of comparisons){const requirementIdValue=String(recordValue(comparison,'REQ_ID')||comparison.relationships?.REQ_ID||'');if(!comparisonByRequirement.has(requirementIdValue))comparisonByRequirement.set(requirementIdValue,[]);comparisonByRequirement.get(requirementIdValue).push(comparison);}
        const matrixSatisfied=matrix.expected.length>0&&!matrix.missing.length&&!matrix.duplicates.length&&!matrix.invalid.length&&matrix.verification.every(record=>effectiveDetermination('verification',record,testForResult(project,record),project)==='SATISFIED');
        const comparisonsSatisfied=requirements.length>0&&requirements.every(requirement=>{const requirementIdValue=requirementId(requirement),rows=comparisonByRequirement.get(requirementIdValue)||[],facts=comparisonFacts(project,requirementIdValue,iterationId);return rows.length===1&&facts.allSatisfied&&!facts.anyViolation&&!facts.anyUndetermined&&!truth(recordValue(rows[0],'CORRECTNESS_AFFECTING_VARIANCE'))&&adjudicationEmpty(recordValue(rows[0],'INCONCLUSIVE_TESTS'))&&adjudicationEmpty(recordValue(rows[0],'DEFECT_IDS'));});
        if(matrixSatisfied&&comparisonsSatisfied&&defects.length===0)out.add('ROOT_CAUSE');
        if(out.has('ROOT_CAUSE')&&out.has('REGRESSION')){const executions=currentRegressionExecutions(project,iterationId),regressions=activeRegressions(project),regressionsSatisfied=regressions.every(regression=>{const id=recordId(regression,'regressions'),matches=executions.filter(execution=>String(recordValue(execution,'REG_ID')||execution.relationships?.REG_ID||'')===id&&upper(recordValue(execution,'PHASE'))!=='PRE_CORRECTION');return matches.length===1&&effectiveRegressionDetermination(project,matches[0]).determination==='SATISFIED';});if(regressionsSatisfied)out.add('CORRECT');}
      }
    }
  }
  if(Number(stage)===19){const appIteration=records(project,'iterations').find(r=>Number(r.stage)===19&&isActiveRecord(r)&&upper(recordValue(r,'PURPOSE'))==='UNCHANGED_CONFIRMATION'&&(!scopeRule.iterationId||recordId(r,'iterations')===String(scopeRule.iterationId))&&(!scopeRule.candidateId||String(recordValue(r,'CANDIDATE_ID')||r.scope?.candidateId||'')===String(scopeRule.candidateId)));if(appIteration)out.add('CONFIRM_FREEZE');}`,
  'Stage 17 application-derived operations'
);
engine = replaceOnce(engine,
  "    case 12:{requireAccepted();const iteration=latestIteration(project,[10,17,19]);const m=verificationMatrix(project,recordId(iteration,'iterations'));",
  "    case 12:{requireAccepted();const iteration=latestIteration(project,[10]);const m=verificationMatrix(project,recordId(iteration,'iterations'));",
  'Stage 12 initial-iteration gate binding');
engine = replaceOnce(engine,
  "      requireAccepted();const reqs=mandatoryRequirements(project),compared=new Set(collection('comparisons').map(record=>String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'')));",
  "      requireAccepted();const iteration=latestIteration(project,[10]),iterationId=recordId(iteration,'iterations'),scope=scopeForIteration(project,iterationId),reqs=mandatoryRequirements(project,scope),compared=new Set(recordsForIteration(project,'comparisons',iterationId).map(record=>String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'')));",
  'Stage 13 initial-iteration comparison gate');
engine = replaceOnce(engine,
  "  if(stage===13){const iteration=latestIteration(project,[10,17,19]),iterationId=recordId(iteration,'iterations');",
  "  if(stage===13){const iteration=latestIteration(project,[10]),iterationId=recordId(iteration,'iterations');",
  'Stage 13 invariant initial-iteration binding');
engine = replaceOnce(engine,
  "case 12:{const iteration=latestIteration(project,[10,17,19]),iterationId=recordId(iteration,'iterations'),matrix=verificationMatrix(project,iterationId)",
  "case 12:{const iteration=latestIteration(project,[10]),iterationId=recordId(iteration,'iterations'),matrix=verificationMatrix(project,iterationId)",
  'Stage 12 derived-data initial-iteration binding');
engine = replaceOnce(engine,
  "case 13:{const it=latestIteration(project,[10,17,19]),iterationId=recordId(it,'iterations')",
  "case 13:{const it=latestIteration(project,[10]),iterationId=recordId(it,'iterations')",
  'Stage 13 derived-data initial-iteration binding');
engine = replaceOnce(engine,
  "  project.job.CURRENT_ITERATION=iterationId;if(freezeStage===17){const freezeChange=[...acceptedChanges(project,17)].reverse().find(change=>String(change.operation||'')==='FREEZE'&&!change.applicationScopeBinding);if(freezeChange)freezeChange.applicationScopeBinding={iterationId,candidateId};}addHistory(project,'CANDIDATE_FROZEN'",
  "  project.job.CURRENT_ITERATION=iterationId;addHistory(project,'CANDIDATE_FROZEN'",
  'remove external Stage 17 freeze binding');
fs.writeFileSync('workflow-engine.js', engine);

let schema = fs.readFileSync('workflow-schema.js', 'utf8');
schema = replaceOnce(schema,
  "agentWritableCollections:[],allowedStageData:['NEW_FROZEN_VERSIONS','OLD_CONVERSATIONS_CONTINUED']}),EXECUTE_RUN:",
  "agentWritableCollections:[],allowedStageData:[]}),EXECUTE_RUN:",
  'Stage 17 FREEZE writable contract');
schema = replaceOnce(schema,
  "agentWritableCollections:['defects','rootCauses'],allowedStageData:['ROOT_CAUSE_COMPLETED']}),REGRESSION:",
  "agentWritableCollections:['defects','rootCauses'],allowedStageData:[]}),REGRESSION:",
  'Stage 17 ROOT_CAUSE writable contract');
schema = replaceOnce(schema,
  "agentWritableCollections:['changes'],allowedStageData:['CORRECTIONS_COMPLETED']})}),19:",
  "agentWritableCollections:['changes'],allowedStageData:[]})}),19:",
  'Stage 17 CORRECT writable contract');
fs.writeFileSync('workflow-schema.js', schema);

let fullCycle = fs.readFileSync('verify-full-cycle.mjs', 'utf8');
fullCycle = replaceOnce(fullCycle,
  "data(17,{operation:'FREEZE'});engine.freezeCandidate",
  "engine.freezeCandidate",
  'remove external Stage 17 FREEZE proposal');
fullCycle = replaceOnce(fullCycle,
  ");data(17,{operation:'ROOT_CAUSE'});data(17,{operation:'CORRECT'});complete(17);",
  ");complete(17);",
  'remove empty no-defect Stage 17 proposals');
fs.writeFileSync('verify-full-cycle.mjs', fullCycle);

console.log(JSON.stringify({stage17FrontierRepair:'APPLIED',files:['workflow-engine.js','workflow-schema.js','verify-full-cycle.mjs']}));
