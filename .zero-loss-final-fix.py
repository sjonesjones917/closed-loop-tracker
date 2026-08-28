from pathlib import Path


def replace_once(path, old, new):
    p=Path(path)
    text=p.read_text()
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{path}: expected exactly one anchor, found {count}: {old[:120]!r}')
    p.write_text(text.replace(old,new,1))

engine='workflow-engine.js'

# Release-critical run batches must be application-established, not merely externally supported.
replace_once(engine,
"if(runs.length!==10)reasons.push('Exactly ten current runs are required.');if(!['APPLICATION_ESTABLISHED','EXTERNALLY_SUPPORTED'].includes(independence.determination))reasons.push(...(independence.reasons.length?independence.reasons:['Ten current runs are not independently established.']));",
"if(runs.length!==10)reasons.push('Exactly ten current runs are required.');if(independence.determination!=='APPLICATION_ESTABLISHED')reasons.push(...(independence.reasons.length?independence.reasons:['Ten current runs are not application-established as independent.']));")

# Stage 29 must require effective satisfaction, sufficient canonical evidence, accepted release, and authorized exact delivery identity.
old="for(const r of results)for(const id of evidenceReferences(r))evidenceIds.add(id);if(!sourceId)missing.push('AUTHORITY');if(!trace)missing.push('INSTRUCTION_TRACE');if(!instruction)missing.push('INSTRUCTION');if(!productId)missing.push('PRODUCT');if(productId&&!executionId)missing.push('EXECUTION');for(const test of tests){const tid=recordId(test,'tests'),testResults=results.filter(r=>String(recordValue(r,'TEST_ID')||r.relationships?.TEST_ID||'')===tid);if(!testResults.length)missing.push('TEST_RESULT:'+tid);else for(const result of testResults)if(!evaluateEvidenceSufficiency(project,{requirement,test,result}).sufficient)missing.push('INSUFFICIENT_EVIDENCE:'+tid);}if(!tests.length)missing.push('TEST');if(!evidenceIds.size)missing.push('CANONICAL_EVIDENCE');if(!release)missing.push('RELEASE_DECISION');if(upper(recordValue(release,'DETERMINATION'))==='ACCEPTED'&&!identities.length)missing.push('DELIVERY_ARTIFACT_IDENTITY');"
new="for(const r of results)for(const id of evidenceReferences(r))evidenceIds.add(id);if(!sourceId)missing.push('AUTHORITY');if(!trace)missing.push('INSTRUCTION_TRACE');if(!instruction)missing.push('INSTRUCTION');if(!productId)missing.push('PRODUCT');if(productId&&!executionId)missing.push('EXECUTION');for(const test of tests){const tid=recordId(test,'tests'),testResults=results.filter(r=>String(recordValue(r,'TEST_ID')||r.relationships?.TEST_ID||'')===tid);if(!testResults.length)missing.push('TEST_RESULT:'+tid);else for(const result of testResults){const collection=['verification','deterministicResults','meaningResults','adversarialResults'].find(name=>recordsForCurrentScope(project,name).includes(result))||'verification',effective=effectiveDetermination(collection,result,test,project),contract=evaluateEvidenceContract(test,result,null,project);if(effective!=='SATISFIED')missing.push('NON_SATISFIED_EFFECTIVE_RESULT:'+tid);if(!contract.sufficient)missing.push('INSUFFICIENT_EVIDENCE:'+tid);}}if(!tests.length)missing.push('TEST');if(!evidenceIds.size)missing.push('CANONICAL_EVIDENCE');if(!release)missing.push('RELEASE_DECISION');else if(upper(recordValue(release,'DETERMINATION'))!=='ACCEPTED')missing.push('RELEASE_NOT_ACCEPTED');const authorizedIdentities=identities.filter(r=>upper(recordValue(r,'AUTHORIZATION'))==='AUTHORIZED'&&truth(recordValue(r,'EXACT_HASH_MATCH'))&&truth(recordValue(r,'EXACT_SIZE_MATCH')));if(!identities.length||authorizedIdentities.length!==identities.length)missing.push('DELIVERY_ARTIFACT_IDENTITY');"
replace_once(engine,old,new)

# Stability diagnostics must count application-effective verification outcomes.
text=Path(engine).read_text()
needle=".map(v=>upper(recordValue(v,'DETERMINATION')))"
count=text.count(needle)
if count!=2:
    raise SystemExit(f'workflow-engine.js: expected 2 raw stability determination maps, found {count}')
Path(engine).write_text(text.replace(needle,".map(v=>effectiveDetermination('verification',v,testForResult(project,v),project))"))

# Stage 29 explanation must explain effective truth and evidence sufficiency, not mere record existence.
old="function evidenceChainExplanation(project,chain){const req=String(recordValue(chain,'REQ_ID')||chain.relationships?.REQ_ID||''),tests=safe(recordValue(chain,'TEST_ID')),results=safe(recordValue(chain,'TEST_RESULT_ID')),evidence=safe(recordValue(chain,'EVIDENCE_ID')),identities=safe(recordValue(chain,'ARTIFACT_HASH_IDENTITY')),support=[];for(const t of tests)support.push(t+' applies to '+req);for(const r of results)support.push(r+' is a current test result for '+req);for(const e of evidence)support.push(e+' supports a current result');for(const id of identities){const record=records(project,'artifactIdentities').find(x=>recordId(x,'artifactIdentities')===id);if(record)support.push(id+' proves audited/delivery identity: '+String(recordValue(record,'PRE_DELIVERY_SHA256')||'UNKNOWN'));}return {proposition:'Delivered artifact satisfies '+req,support,unresolved:safe(recordValue(chain,'MISSING_LINKS'))};}"
new="function evidenceChainExplanation(project,chain){const req=String(recordValue(chain,'REQ_ID')||chain.relationships?.REQ_ID||''),tests=safe(recordValue(chain,'TEST_ID')),results=safe(recordValue(chain,'TEST_RESULT_ID')),evidence=safe(recordValue(chain,'EVIDENCE_ID')),identities=safe(recordValue(chain,'ARTIFACT_HASH_IDENTITY')),support=[],unresolved=[...safe(recordValue(chain,'MISSING_LINKS'))],resultCollections=['verification','deterministicResults','meaningResults','adversarialResults'];for(const t of tests)support.push(t+' applies to '+req);for(const id of results){let hit=null;for(const collection of resultCollections){const record=recordsForCurrentScope(project,collection).find(r=>recordId(r,collection)===String(id));if(record){hit={collection,record};break;}}if(!hit){unresolved.push('CURRENT_RESULT:'+id);continue;}const test=testForResult(project,hit.record),effective=effectiveDetermination(hit.collection,hit.record,test,project),contract=evaluateEvidenceContract(test,hit.record,null,project);support.push('Effective determination for '+id+' is '+effective);if(contract.sufficient)support.push((contract.evidenceIds||[]).join(', ')+' structurally satisfies the evidence contract for '+id);else unresolved.push('INSUFFICIENT_EVIDENCE:'+id);if(effective!=='SATISFIED')unresolved.push('NON_SATISFIED_EFFECTIVE_RESULT:'+id);}for(const e of evidence)support.push(e+' is canonical evidence linked to the current proposition');for(const id of identities){const record=recordsForCurrentScope(project,'artifactIdentities').find(x=>recordId(x,'artifactIdentities')===id);if(record&&upper(recordValue(record,'AUTHORIZATION'))==='AUTHORIZED'&&truth(recordValue(record,'EXACT_HASH_MATCH'))&&truth(recordValue(record,'EXACT_SIZE_MATCH')))support.push(id+' proves audited delivery bytes match: '+String(recordValue(record,'PRE_DELIVERY_SHA256')||'UNKNOWN'));else unresolved.push('UNAUTHORIZED_ARTIFACT_IDENTITY:'+id);}return {proposition:'Delivered artifact satisfies '+req,support,unresolved:[...new Set(unresolved)]};}"
replace_once(engine,old,new)

# Capability availability must be affirmative for external tools/systems.
anchor="function testExecutionPlan(project){"
helper="""function capabilityAffirmativelyAvailable(project,requiredCapability,mode){
  const capability=upper(requiredCapability);if(!capability)return false;
  if(mode==='APPLICATION_DETERMINISTIC')return Object.prototype.hasOwnProperty.call(APPLICATION_TEST_EXECUTORS,requiredCapability);
  if(['INDEPENDENT_AGENT_REVIEW','HUMAN_INSPECTION'].includes(mode))return true;
  if(mode==='UNAVAILABLE')return false;
  const declarations=[project?.job?.AVAILABLE_TOOLS,...recordsForCurrentScope(project,'freshContexts').map(record=>recordValue(record,'TOOL_AVAILABILITY'))],negative=/\b(?:UNAVAILABLE|NOT AVAILABLE|NO ACCESS|MISSING|ABSENT|UNKNOWN)\b/;
  return declarations.some(value=>{const text=upper(typeof value==='string'?value:JSON.stringify(value??''));return text.includes(capability)&&!negative.test(text);});
}
"""
replace_once(engine,anchor,helper+anchor)
old="applicationExecutorSupported=mode!=='APPLICATION_DETERMINISTIC'||Object.prototype.hasOwnProperty.call(APPLICATION_TEST_EXECUTORS,requiredCapability),validMode=Object.prototype.hasOwnProperty.call(TEST_EXECUTION_ACTIONS,mode),capabilityReady=Boolean(requiredCapability)&&mode!=='UNAVAILABLE'&&(mode!=='APPLICATION_DETERMINISTIC'||applicationExecutorSupported),executableNow=validMode&&capabilityReady&&artifactReady,blockingReason=!validMode?'Execution mode is not validly classified.':!requiredCapability?'Required capability is missing.':mode==='UNAVAILABLE'?'Required capability is explicitly unavailable.':mode==='APPLICATION_DETERMINISTIC'&&!applicationExecutorSupported?'No application-native executor is registered for '+requiredCapability+'.':!artifactReady?'Required exact artifact bytes are missing or no longer verified.':null"
new="applicationExecutorSupported=mode!=='APPLICATION_DETERMINISTIC'||Object.prototype.hasOwnProperty.call(APPLICATION_TEST_EXECUTORS,requiredCapability),validMode=Object.prototype.hasOwnProperty.call(TEST_EXECUTION_ACTIONS,mode),capabilityReady=capabilityAffirmativelyAvailable(project,requiredCapability,mode),executableNow=validMode&&capabilityReady&&artifactReady,blockingReason=!validMode?'Execution mode is not validly classified.':!requiredCapability?'Required capability is missing.':mode==='UNAVAILABLE'?'Required capability is explicitly unavailable.':mode==='APPLICATION_DETERMINISTIC'&&!applicationExecutorSupported?'No application-native executor is registered for '+requiredCapability+'.':!capabilityReady?'Required capability '+requiredCapability+' is not affirmatively available in current canonical state.':!artifactReady?'Required exact artifact bytes are missing or no longer verified.':null"
replace_once(engine,old,new)
replace_once(engine,"applicationExecutorSupported,operatorAction,operatorActionText:","applicationExecutorSupported,capabilityReady,operatorAction,operatorActionText:")

# Stage 13 and Stages 18/19 expose concise application-derived stability/comparison summaries.
replace_once(engine,
"case 12:Object.assign(derived,{ACTIVE_MANDATORY_REQUIREMENTS:metrics.mandatoryRequirementCount,RUNS:metrics.iterationRunCount,EXPECTED_MANDATORY_RECORDS:metrics.expectedVerificationCount,ACTUAL_MANDATORY_RECORDS:metrics.actualVerificationTripleCount,MISSING_RECORDS:metrics.missingVerificationTriples.length,VERIFICATION_COVERAGE:metrics.verificationCoverage});break;case 18:",
"case 12:Object.assign(derived,{ACTIVE_MANDATORY_REQUIREMENTS:metrics.mandatoryRequirementCount,RUNS:metrics.iterationRunCount,EXPECTED_MANDATORY_RECORDS:metrics.expectedVerificationCount,ACTUAL_MANDATORY_RECORDS:metrics.actualVerificationTripleCount,MISSING_RECORDS:metrics.missingVerificationTriples.length,VERIFICATION_COVERAGE:metrics.verificationCoverage});break;case 13:{const it=latestIteration(project,[10,17,19]),iterationId=recordId(it,'iterations'),scope=iterationId?scopeForIteration(project,iterationId):currentScope(project),facts={};for(const req of mandatoryRequirements(project,scope)){const f=comparisonFacts(project,requirementId(req),iterationId);facts[requirementId(req)]={RUN_DETERMINATIONS:f.runDeterminations,ALL_TEN_SATISFIED:f.allSatisfied,ANY_VIOLATION:f.anyViolation,ANY_UNDETERMINED:f.anyUndetermined,SATISFIED_COUNT:f.determinations.filter(x=>x==='SATISFIED').length,VIOLATED_COUNT:f.determinations.filter(x=>x==='VIOLATED').length,UNDETERMINED_COUNT:f.determinations.filter(x=>!['SATISFIED','VIOLATED'].includes(x)).length};}Object.assign(derived,{APPLICATION_DERIVED_COMPARISON_FACTS:facts,STABILITY_SUMMARY:iterationId?executionStability(project,iterationId):null});break;}case 18:")
replace_once(engine,"UNEXPLAINED_CORRECTNESS_AFFECTING_EXECUTION_VARIANCE:convergence.unexplainedVariance,ALL_CONDITIONS_SIMULTANEOUSLY_TRUE:convergence.converged});break;case 27:","UNEXPLAINED_CORRECTNESS_AFFECTING_EXECUTION_VARIANCE:convergence.unexplainedVariance,ALL_CONDITIONS_SIMULTANEOUSLY_TRUE:convergence.converged,STABILITY_SUMMARY:convergence.iterationId?executionStability(project,convergence.iterationId):null});break;case 27:")
replace_once(engine,"ITERATION_COMPLETE:ev.complete,ITERATION_REASONS:ev.reasons});break;}case 12:","ITERATION_COMPLETE:ev.complete,ITERATION_REASONS:ev.reasons,STABILITY_SUMMARY:stage===19?ev.stability:null});break;}case 12:")

# Export the availability evaluator for direct regression proof.
replace_once(engine,"releaseMetrics,applicationTestCapabilities,testExecutionPlan,executionHandoff,","releaseMetrics,applicationTestCapabilities,capabilityAffirmativelyAvailable,testExecutionPlan,executionHandoff,")

# Update routing fixture so positive external routes have affirmative capability evidence; add explicit unproven-capability negative proof.
complete='verify-complete.mjs'
replace_once(complete,
"const p=project('JOB-RELIABILITY-V2');p.job.CURRENT_REQUIREMENTS_VERSION='REQUIREMENTS-v001';p.job.CURRENT_TEST_SUITE_VERSION='TEST-SUITE-v001';const scope=engine.currentScope(p);",
"const p=project('JOB-RELIABILITY-V2');p.job.CURRENT_REQUIREMENTS_VERSION='REQUIREMENTS-v001';p.job.CURRENT_TEST_SUITE_VERSION='TEST-SUITE-v001';p.job.AVAILABLE_TOOLS='CAP-EXTERNAL_AGENT_TOOL; CAP-EXTERNAL_SYSTEM';const scope=engine.currentScope(p);")
replace_once(complete,
"const unavailable=plan.items.find(x=>x.executionMode==='UNAVAILABLE');assert(!unavailable.executableNow&&unavailable.blockingReason,'UNAVAILABLE test did not fail closed.');",
"const unavailable=plan.items.find(x=>x.executionMode==='UNAVAILABLE');assert(!unavailable.executableNow&&unavailable.blockingReason,'UNAVAILABLE test did not fail closed.');const missing=record('tests',6,{REQ_ID:'REQ-V2',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'EXTERNAL_AGENT_TOOL',REQUIRED_CAPABILITY:'CAP-NOT-PRESENT',ARTIFACT_REQUIREMENTS:'NONE',EVIDENCE_TO_PRESERVE:'objective evidence',STATUS:'READY'},'TEST-MISSING-CAPABILITY');missing.scope={...scope};p.projectData.tests.push(missing);const missingPlan=engine.testExecutionPlan(p).items.find(x=>x.testId==='TEST-MISSING-CAPABILITY');assert(!missingPlan.executableNow&&missingPlan.operatorAction==='BLOCKED'&&/not affirmatively available/i.test(missingPlan.blockingReason),'Unproven external capability did not fail closed.');")

# Strengthen the semantic invariant suite with lifetime guards for the remaining reductions.
semantic='verify-semantic-invariant.mjs'
append="""

// Capability names are not capability availability. External tool/system execution requires affirmative canonical availability.
{
 const q=core.createBlankState('JOB-CAPABILITY-AFFIRMATION');engine.ensureShape(q);q.job.CURRENT_INPUT_VERSION='INPUT-v001';q.job.CURRENT_REQUIREMENTS_VERSION='REQUIREMENTS-v001';q.job.CURRENT_TEST_SUITE_VERSION='TEST-SUITE-v001';const s=engine.currentScope(q);q.projectData.requirements.push({id:'REQ-CAP',stage:4,active:true,scope:s,fields:{REQ_ID:'REQ-CAP',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'}});q.projectData.tests.push({id:'TEST-CAP',stage:6,active:true,scope:s,fields:{TEST_ID:'TEST-CAP',REQ_ID:'REQ-CAP',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'EXTERNAL_AGENT_TOOL',REQUIRED_CAPABILITY:'SOLIDWORKS_IMPORT',ARTIFACT_REQUIREMENTS:'NONE',EVIDENCE_TO_PRESERVE:'import report',STATUS:'READY'},relationships:{REQ_ID:'REQ-CAP'}});let plan=engine.testExecutionPlan(q).items[0];assert(!plan.executableNow&&plan.operatorAction==='BLOCKED','Capability name alone established external tool availability');q.job.AVAILABLE_TOOLS='SOLIDWORKS_IMPORT';plan=engine.testExecutionPlan(q).items[0];assert(plan.executableNow&&plan.operatorAction==='SEND_TO_TOOL_AGENT','Affirmatively available external capability did not restore routing');
}

const strengthenedSource=fs.readFileSync('workflow-engine.js','utf8');
assert(strengthenedSource.includes("NON_SATISFIED_EFFECTIVE_RESULT:"),'Stage 29 does not require effective result satisfaction');
assert(strengthenedSource.includes("RELEASE_NOT_ACCEPTED"),'Stage 29 does not require an accepted current release');
assert(strengthenedSource.includes("UNAUTHORIZED_ARTIFACT_IDENTITY:"),'Stage 29 explanation does not fail closed on unauthorized delivery identity');
assert(!strengthenedSource.includes("map(v=>upper(recordValue(v,'DETERMINATION')))"),'Stability diagnostics still consume submitted determinations');
console.log(JSON.stringify({affirmativeCapabilityAvailability:true,epistemicEvidenceChains:true,effectiveStability:true}));
"""
p=Path(semantic)
t=p.read_text()
if 'affirmativeCapabilityAvailability:true' not in t:
    p.write_text(t+append)

print('zero-loss-final-fix applied')
