import fs from 'node:fs';
const path='workflow-engine.js';
let source=fs.readFileSync(path,'utf8');
const replace=(from,to,label)=>{
  if(source.includes(to)) return;
  if(!source.includes(from)) throw new Error(`Expected source for ${label} not found.`);
  source=source.replace(from,to);
};
replace(
  "const presentKeys=new Set([...grouped.entries()].filter(([,items])=>items.length===1).map(([key])=>key)),missing=expected.filter(key=>!presentKeys.has(key)||duplicates.includes(key));\n  return {iterationId:String(iterationId||''),requirements,tests,runs,expected,expectedCount:expected.length,actual:valid,actualCount:valid.length,missing,duplicates,invalid,valid,satisfied,violated,undetermined,selfValidated,coverage:expected.length?valid.length/expected.length:0,complete:expected.length>0&&!missing.length&&!duplicates.length&&!invalid.length&&valid.length===expected.length};",
  "const counts=new Map([...grouped.entries()].map(([key,items])=>[key,items.length])),presentKeys=new Set([...grouped.entries()].filter(([,items])=>items.length===1).map(([key])=>key)),missing=expected.filter(key=>!presentKeys.has(key)||duplicates.includes(key));\n  return {iterationId:String(iterationId||''),requirements,tests,runs,expected,expectedCount:expected.length,counts,actual:valid,actualCount:valid.length,missing,duplicates,invalid,valid,satisfied,violated,undetermined,selfValidated,coverage:expected.length?valid.length/expected.length:0,complete:expected.length>0&&!missing.length&&!duplicates.length&&!invalid.length&&valid.length===expected.length};",
  'verificationMatrix counts contract'
);
replace(
  "if(testType==='MEANING'||Number(result?.stage)===23){requiredEvidenceClasses.push('MEANING_COMPARISON');",
  "if(Number(result?.stage)===23||String(recordValue(result,'MEANING_REVIEW_ID')||'').trim()){requiredEvidenceClasses.push('MEANING_COMPARISON');",
  'Stage 23 meaning evidence predicate'
);
replace(
  "const requiredOperations=normalizedPurpose==='CONFIRMATION'?['EXECUTE_RUN','VERIFY','COMPARE','REGRESSION_VERIFY','CONFIRM']:['FREEZE','EXECUTE_RUN','VERIFY','COMPARE','ROOT_CAUSE','REGRESSION','CORRECT'],stage=normalizedPurpose==='CONFIRMATION'?19:17,currentOperations=new Set(acceptedChanges(project,stage).filter(change=>String(change.scope?.iterationId||'')===id).map(change=>change.operation||'COMPLETE')),missingOperations=requiredOperations.filter(operation=>!currentOperations.has(operation));",
  "const requiredOperations=normalizedPurpose==='CONFIRMATION'?['EXECUTE_RUN','VERIFY','COMPARE','REGRESSION_VERIFY','CONFIRM']:['EXECUTE_RUN','VERIFY','COMPARE','ROOT_CAUSE','REGRESSION','CORRECT'],stage=normalizedPurpose==='CONFIRMATION'?19:17,currentOperations=new Set(acceptedChanges(project,stage).filter(change=>String(change.scope?.iterationId||'')===id).map(change=>change.operation||'COMPLETE')),missingOperations=requiredOperations.filter(operation=>!currentOperations.has(operation));",
  'Stage 17 application-owned freeze proof'
);
replace(
  "if(matches.length!==1)reasons.push(`${testId} requires exactly one current independent meaning result.`);",
  "if(matches.length!==1)reasons.push(`Meaning review for test ${testId} requires exactly one current independent result.`);",
  'Stage 23 missing-result diagnostic'
);
replace(
  "case 24:{const tests=(recordsForCurrentScope(project,'tests').length?recordsForCurrentScope(project,'tests'):records(project,'tests')).filter(item=>upper(recordValue(item,'TEST_TYPE'))==='ADVERSARIAL'),results=records(project,'adversarialResults');for(const test of tests){const testId=recordId(test,'tests'),matches=results.filter(item=>String(recordValue(item,'TEST_ID')||item.relationships?.TEST_ID||'')===testId);if(matches.length!==1)reasons.push(`${testId} requires exactly one current adversarial result.`);else{const result=matches[0],requirement=records(project,'requirements').find(item=>requirementId(item)===testRequirementId(test));if(upper(recordValue(result,'DETERMINATION'))!=='SATISFIED')reasons.push(`${testId} adversarial determination is not SATISFIED.`);if(!evaluateEvidenceSufficiency(project,{requirement,test,result}).sufficient)reasons.push(`${testId} lacks evidence sufficient for the adversarial proposition.`);}}break;}",
  "case 24:{const tests=(recordsForCurrentScope(project,'tests').length?recordsForCurrentScope(project,'tests'):records(project,'tests')).filter(item=>upper(recordValue(item,'TEST_TYPE'))==='ADVERSARIAL'),results=records(project,'adversarialResults');for(const test of tests){const testId=recordId(test,'tests'),matches=results.filter(item=>String(recordValue(item,'TEST_ID')||item.relationships?.TEST_ID||'')===testId);if(matches.length!==1)reasons.push(`${testId} requires exactly one current adversarial result.`);else{const result=matches[0],requirement=records(project,'requirements').find(item=>requirementId(item)===testRequirementId(test));if(upper(recordValue(result,'DETERMINATION'))!=='SATISFIED')reasons.push(`${testId} adversarial determination is not SATISFIED.`);if(!evaluateEvidenceSufficiency(project,{requirement,test,result}).sufficient)reasons.push(`${testId} lacks evidence sufficient for the adversarial proposition.`);}}const activeRegressions=records(project,'regressions').filter(item=>upper(recordValue(item,'ACTIVE_RETIRED_STATE')||'ACTIVE')!=='RETIRED');for(const regression of activeRegressions){const regId=recordId(regression,'regressions'),matches=results.filter(item=>String(recordValue(item,'REG_ID')||item.relationships?.REG_ID||'')===regId);if(matches.length!==1)reasons.push(`Active permanent regression ${regId} requires exactly one current adversarial challenge.`);else if(upper(recordValue(matches[0],'DETERMINATION'))!=='SATISFIED')reasons.push(`Active permanent regression ${regId} adversarial challenge is not SATISFIED.`);}break;}",
  'Stage 24 active permanent regression challenge'
);
replace(
  "recordValue(result,'PRE_CORRECTION_EVIDENCE'),recordValue(result,'POST_CORRECTION_EVIDENCE')].filter",
  "recordValue(result,'PRE_CORRECTION_EVIDENCE'),recordValue(result,'POST_CORRECTION_EVIDENCE'),recordValue(result,'PRODUCT_LOCATION'),recordValue(result,'EXTERNAL_SOURCE_EVIDENCE'),recordValue(result,'REQUIRED_MEANING'),recordValue(result,'OBSERVED_MEANING'),recordValue(result,'EVIDENCE_BASED_COMPARISON')].filter",
  'Stage 23 schema-native direct evidence'
);
replace(
  "if(mode==='EXTERNAL_AGENT_TOOL'){requiredEvidenceClasses.push('TOOL_EXECUTION_RESULT');if(!String(recordValue(result,'TOOL_AND_VERSION')||recordValue(result,'VERIFIER')||'').trim())reasons.push('Tool execution evidence lacks tool/verifier identity.');if(!String(recordValue(result,'ACTUAL_RESULT')||recordValue(result,'OBSERVED_RESULT')||'').trim())reasons.push('Tool execution evidence lacks an actual observed result.');}",
  "if(mode==='EXTERNAL_AGENT_TOOL'){requiredEvidenceClasses.push('TOOL_EXECUTION_RESULT');const executorIdentity=String(recordValue(result,'TOOL_AND_VERSION')||recordValue(result,'VERIFIER')||recordValue(test,'TOOLS')||recordValue(test,'REQUIRED_CAPABILITY')||'').trim(),observedExecution=String(recordValue(result,'ACTUAL_RESULT')||recordValue(result,'OBSERVED_RESULT')||recordValue(result,'OBSERVED_MEANING')||recordValue(result,'EVIDENCE_BASED_COMPARISON')||'').trim();if(!executorIdentity)reasons.push('Tool execution evidence lacks tool/verifier or declared capability identity.');if(!observedExecution)reasons.push('Tool execution evidence lacks an actual observed result.');}",
  'schema-compatible external-agent execution evidence'
);
replace(
  "case 25:{const artifacts=records(project,'artifacts'),inspections=records(project,'representationInspections');for(const artifact of artifacts){const id=recordId(artifact,'artifacts'),matches=inspections.filter(item=>String(recordValue(item,'ARTIFACT_ID')||item.relationships?.ARTIFACT_ID||'')===id);if(matches.length!==1)reasons.push(`${id} requires exactly one current representation inspection.`);else if(upper(recordValue(matches[0],'DETERMINATION'))!=='SATISFIED'||!evaluateEvidenceSufficiency(project,{result:matches[0]}).sufficient)reasons.push(`${id} representation inspection is not evidence-sufficient and SATISFIED.`);}break;}",
  "case 25:{const product=(recordsForCurrentScope(project,'products').length?recordsForCurrentScope(project,'products'):records(project,'products')).at(-1),artifactIds=safe(recordValue(product,'GENERATED_ARTIFACT_INVENTORY')).map(String),artifacts=artifactIds.map(id=>records(project,'artifacts').find(item=>recordId(item,'artifacts')===id)).filter(Boolean),inspections=records(project,'representationInspections');if(!artifactIds.length)reasons.push('Current product has no generated delivery artifacts to inspect.');for(const artifact of artifacts){const id=recordId(artifact,'artifacts'),matches=inspections.filter(item=>String(recordValue(item,'ARTIFACT_ID')||item.relationships?.ARTIFACT_ID||'')===id);if(matches.length!==1)reasons.push(`${id} requires exactly one current representation inspection.`);else if(upper(recordValue(matches[0],'DETERMINATION'))!=='SATISFIED'||!evaluateEvidenceSufficiency(project,{result:matches[0]}).sufficient)reasons.push(`${id} representation inspection is not evidence-sufficient and SATISFIED.`);}break;}",
  'Stage 25 current delivery-artifact selector'
);
replace(
  "function recordReleaseDetermination(project){ensureShape(project);const metrics=releaseMetrics(project);const releaseEvidenceSha256=hash.sha256Value({metrics,inputReferences:metrics.inputReferences});",
  "function recordReleaseDetermination(project){ensureShape(project);const metrics=releaseMetrics(project);const releaseEvidenceSha256=hash.sha256Value(metrics);",
  'canonical release evidence hashing without undefined optional members'
);
fs.writeFileSync(path,source);
console.log('Applied consolidated reliability compatibility repairs.');
