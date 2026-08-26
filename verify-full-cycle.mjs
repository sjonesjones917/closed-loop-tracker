import {
  assert,createProject,savePrompt,evidence,proposal,acceptResponse,assertStage,latestId,latestRecord,activeRecords,roundTrip,exactBytesArtifact,
  core,hash,schema,engine,ingestion
} from './test-fixtures.mjs';

const OP='VERIFICATION_OPERATOR';
let p=createProject('JOB-FULL-CYCLE');

function stageData(stage,overrides={}){
  const fields=schema.allowedAgentStageFields(stage);
  const out={};
  for(const name of fields.slice(0,1))out[name]=name.includes('COUNT')?1:name.includes('COMPLETED')||name.startsWith('NEW_')?false:`stage-${stage}-${name.toLowerCase()}`;
  return {...out,...overrides};
}
function normalizeStageData(stage,data){
  const out={};for(const [name,value] of Object.entries(data||{})){const def=schema.STAGE_FIELDS?.[stage]?.[name];if(def?.valueType==='STRING')out[name]=String(value);else if(def?.valueType==='INTEGER')out[name]=Math.trunc(Number(value));else if(def?.valueType==='NUMBER')out[name]=Number(value);else if(def?.valueType==='BOOLEAN')out[name]=Boolean(value);else out[name]=value;}return out;
}
function acceptStage(stage,{records={},stageData:sd=null,operation=null,runId=null,contextId=null,evidenceRecords=null}={}){
  const pr=savePrompt(p,stage,{operation,runId,contextId});
  const committed=acceptResponse(p,pr,{stageData:normalizeStageData(stage,sd??stageData(stage)),records,evidenceRecords});
  p=committed.project;return committed;
}
function rel(recordId){return {recordId};}
function id(collection){return latestId(p,collection);}
function rec(collection){return latestRecord(p,collection);}
function markCurrentContext(contextId,{externalId,contamination='NONE',usability='SATISFIED'}={}){
  const c=activeRecords(p,'freshContexts').find(x=>engine.recordId(x,'freshContexts')===contextId);assert(c,`Missing context ${contextId}`);
  c.fields.EXTERNAL_CONTEXT_IDENTIFIER=c.EXTERNAL_CONTEXT_IDENTIFIER=externalId||`external-${contextId}`;
  c.fields.TOOL_AVAILABILITY=c.TOOL_AVAILABILITY='AVAILABLE';
  c.fields.CONTAMINATION_STATUS=c.CONTAMINATION_STATUS=contamination;
  c.fields.EVIDENCE=c.EVIDENCE=`Controlled evidence for ${contextId}`;
  c.fields.USABILITY_DETERMINATION=c.USABILITY_DETERMINATION=usability;
}
function verificationRecords(iterationId,stage=12){
  const reqs=engine.mandatoryRequirements(p),tests=engine.recordsForCurrentScope(p,'tests'),runs=engine.recordsForCurrentScope(p,'runs').filter(r=>String(engine.recordValue(r,'ITERATION_ID'))===String(iterationId));
  const list=[];let n=0;
  for(const req of reqs){const reqId=engine.recordId(req,'requirements');for(const test of tests.filter(t=>String(engine.recordValue(t,'REQ_ID')||t.relationships?.REQ_ID||'')===reqId)){const testId=engine.recordId(test,'tests');for(const run of runs){n++;list.push(proposal('verification',{tempKey:`verify-${stage}-${n}`,fields:{VERIFIER:`independent-${n}`,VERIFIER_CONTEXT_ID:`VERIFIER-CONTEXT-${stage}-${n}`,INDEPENDENCE_STATUS:'INDEPENDENT',INPUTS:'Current canonical requirement, run, and test.',PROCEDURE:'Execute the canonical test independently.',EXPECTED_RESULT:'SATISFIED',OBSERVED_RESULT:'SATISFIED',EXACT_EVIDENCE:`Exact evidence ${stage}-${n}`,DETERMINATION:'SATISFIED'},relationships:{REQ_ID:rel(reqId),RUN_ID:rel(engine.recordId(run,'runs')),TEST_ID:rel(testId)}}));}}
  }
  return list;
}
function runBatch(stage,iterationId,candidateId,{operation=null}={}){
  const slots=engine.reserveRunBatch(p,{stage,iterationId,candidateId,count:10});
  slots.forEach((slot,i)=>markCurrentContext(slot.contextId,{externalId:`${stage}-fresh-context-${i+1}`}));
  for(const [i,slot] of slots.entries()){
    const pr=savePrompt(p,stage,{operation:operation||null,runId:slot.runId,contextId:slot.contextId});
    const r=proposal('runs',{targetId:slot.runId,fields:{FRESH_CONTEXT_RECORD:slot.contextId,CONTAMINATION_CHECK:'NONE',TOOL_CONFIGURATION:'CONTROLLED',EXECUTION_STATUS:'COMPLETED',COMPLETE_OUTPUT:`candidate-output-${stage}-${i+1}`},relationships:{}});
    p=acceptResponse(p,pr,{stageData:normalizeStageData(stage,stageData(stage)),records:{runs:[r]}}).project;
  }
  return slots;
}

// Stage 01 clarification -> typed answer -> regenerated prompt -> final proposal -> exact confirmation.
{
  const pr=savePrompt(p,1);
  const q={temporaryKey:'question-1',question:'Confirm the exact output bytes.',whyRequired:'The human controls the requested deliverable.',affectedStageFields:['EXACT_DELIVERABLE_REQUESTED'],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:true};
  p=acceptResponse(p,pr,{responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[q],stageData:{},records:{},evidenceRecords:[]}).project;
  engine.recalculate(p);assert(p.stages[1].status==='BLOCKED','Stage 01 did not block on the clarification.');
  const request=p.projectData.humanInputRequests.at(-1),oldPrompt=pr.instructionId;
  const answered=ingestion.answerHumanInput(p,{[request.requestId]:'The exact UTF-8/ASCII bytes must be Hello.'},{operator:OP});p=answered.project;
  const finalPrompt=p.projectData.generatedPrompts.find(x=>x.instructionId===answered.generatedPromptIds?.[0]);
  assert(finalPrompt?.prompt?.includes('The exact UTF-8/ASCII bytes must be Hello.'),'Answered clarification is absent from the regenerated prompt.');
  assert(p.projectData.generatedPrompts.find(x=>x.instructionId===oldPrompt)?.invalidatedBy,'Old Stage 01 prompt was not invalidated.');
  p=acceptResponse(p,finalPrompt,{stageData:{EXACT_DELIVERABLE_REQUESTED:'One text/plain artifact whose exact bytes are Hello.',ASSUMPTIONS:'None.',UNKNOWN_INFORMATION:'None.',INPUT_SET_CONTENTS:'Verbatim job request and answered clarification.'},records:{}}).project;
  const accepted=p.projectData.acceptedChanges.filter(x=>x.stage===1&&!x.invalidatedBy).at(-1);assert(accepted,'Final Stage 01 proposal missing.');
  engine.recordStageConfirmation(p,1,{operatorLabel:OP,acceptedChangeId:accepted.changeId,inputVersion:p.job.CURRENT_INPUT_VERSION,instructionId:finalPrompt.instructionId,contextSignature:finalPrompt.contextSignature});
  assertStage(p,1);
}

// 02 authority source.
acceptStage(2,{stageData:{AUTHORITY_HIERARCHY:'User authority controls requested bytes; external standards control browser/storage mechanics where applicable.',KNOWN_CONTROLLING_SOURCES_EXAMINED:'One independent external governing source inspected.'},records:{sources:[proposal('sources',{fields:{TITLE:'HTML Standard',ISSUING_ORGANIZATION_OR_AUTHOR:'WHATWG',SOURCE_TYPE:'OFFICIAL_STANDARD',PUBLICATION_ORIGIN:'WHATWG',URL_REFERENCE:'https://html.spec.whatwg.org/',AUTHORITY_LEVEL:'PRIMARY',AUTHORITY_ROLE:'GOVERNING',RELEVANCE:'Browser platform behavior.',APPLICABLE_PORTIONS:'Web platform storage and Blob behavior.',INSPECTION_STATUS:'INSPECTED',CURRENCY_STATUS:'CURRENT',SUPERSESSION_STATUS:'NOT SUPERSEDED',CONTROLLING_STATE:'CONTROLLING'}})]}});assertStage(p,2);
const sourceId=id('sources');
// 03 research.
acceptStage(3,{records:{research:[proposal('research',{fields:{PASS_NUMBER:'1',EXACT_PORTION_EXAMINED:'Relevant browser platform provisions.',FINDING_CLASSIFICATION:'AUTHORITATIVE',SOURCE_EVIDENCE:'Independent source inspected.'},relationships:{SOURCE_ID:rel(sourceId)}})]}});assertStage(p,3);
// 04 one mandatory atomic requirement.
acceptStage(4,{records:{requirements:[proposal('requirements',{fields:{OBLIGATION:'The released text artifact shall contain exactly the five ASCII bytes Hello.',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'Byte sequence equals 48 65 6c 6c 6f.',INTENDED_VERIFICATION_METHOD:'Exact byte comparison.',EXPECTED_EVIDENCE:'Stored artifact SHA-256 and byte comparison.',FAILURE_CONDITION:'Any missing, extra, reordered, or modified byte.',SEVERITY:'CRITICAL'},relationships:{SOURCE_ID:rel(sourceId)}})]}});assertStage(p,4);const reqId=id('requirements');
// 05 no requirement defect.
acceptStage(5,{stageData:{DUPLICATES_REMAINING:false}});assertStage(p,5);
// 06 exact test coverage.
acceptStage(6,{records:{tests:[proposal('tests',{fields:{TEST_TYPE:'DETERMINISTIC',INPUTS:'Stored product artifact bytes.',TOOLS:'Exact byte reader and SHA-256.',PROCEDURE:'Read exact bytes and compare with Hello.',EXPECTED_RESULT:'Exact bytes equal Hello.',FAILURE_CONDITION:'Any byte differs.',EVIDENCE_TO_PRESERVE:'Observed bytes, size, SHA-256.'},relationships:{REQ_ID:rel(reqId)}})]}});assertStage(p,6);const testId=id('tests');
// 07 actual invalid fixture rejected.
acceptStage(7,{records:{failureTests:[proposal('failureTests',{fields:{VIOLATION_MODE:'EXTRA_BYTE',FIXTURE:'Hello!',EXPECTED_REJECTION:'REJECT',EVIDENCE:'Controlled invalid fixture was rejected.'},relationships:{REQ_ID:rel(reqId)}})]}});assertStage(p,7);
// 08 instruction plus exact trace in same response.
{
  const instruction=proposal('instructions',{tempKey:'instruction-1',fields:{OBJECTIVE:'Produce exact Hello bytes.',AUTHORIZED_INPUTS:'Current canonical project inputs.',FAILURE_HANDLING:'Fail closed.',AUTHORITY_RULES:'Respect declared authority.',SCOPE:'Current job only.',PROHIBITIONS:'No invention.',DEFINED_TERMS:'Artifact means stored exact bytes.',ORDERED_PROCEDURE:'Produce, persist, hash, verify.',TOOL_REQUIREMENTS:'Exact byte and SHA-256 support.',OUTPUT_CONTRACT:'text/plain exact bytes Hello.',FACTUAL_STATE_HANDLING:'Undetermined facts block.',REJECTION_BLOCKING_RULES:'Any mismatch blocks.',COMPLETION_CONDITIONS:'Exact bytes verified.',REQUIREMENT_TRACEABILITY:reqId,INSTRUCTION_TEXT:'Create exactly the five bytes Hello and return them as the product artifact.'}});
  const trace=proposal('instructionTraces',{tempKey:'trace-1',fields:{INSTRUCTION_LOCATION:'Instruction body',IMPLEMENTED_BEHAVIOR:'Exact byte production.'},relationships:{REQ_ID:rel(reqId),INSTRUCTION_ID:{tempKey:'instruction-1'}}});
  acceptStage(8,{records:{instructions:[instruction],instructionTraces:[trace]}});assertStage(p,8);
}
const instructionId=id('instructions');
// 09 independent preflight.
acceptStage(9,{records:{preflightRecords:[proposal('preflightRecords',{fields:{CLAUSE:'Entire instruction',DETERMINATION:'SATISFIED',FINDINGS:'No material ambiguity or conflict.',EVIDENCE:'Independent review completed.'},relationships:{INSTRUCTION_ID:rel(instructionId)}})]}});assertStage(p,9);

// Stage 10: persist exact candidate input bytes, freeze candidate, then accept stage result.
const candidateArtifact=await exactBytesArtifact(p,{stage:10,artifactId:'ARTIFACT-CANDIDATE-HELLO',filename:'candidate.txt',bytes:'Hello'});
const frozen10=engine.freezeCandidate(p,{stage:10,artifactIds:[engine.recordId(candidateArtifact,'artifacts')],operatorLabel:OP});
acceptStage(10,{stageData:{HASHES_RECORDED_WHERE_PRACTICAL:true,CHANGES_ALLOWED_DURING_BATCH:false}});assertStage(p,10);
const iteration10=engine.recordId(frozen10.iteration,'iterations'),candidate10=engine.recordId(frozen10.candidate,'candidateFreezes');

// Stage 11: exactly ten reserved run/context slots completed through targetId ingestion.
runBatch(11,iteration10,candidate10);assertStage(p,11);
// Stage 12: exact REQ × RUN × TEST verification triples.
acceptStage(12,{records:{verification:verificationRecords(iteration10,12)},stageData:{RUNS:10}});assertStage(p,12);
// Stage 13: all-ten comparison plus one discovered defect to drive correction lifecycle.
acceptStage(13,{records:{comparisons:[proposal('comparisons',{fields:{RUN_DETERMINATIONS:'10/10 SATISFIED with one controlled metadata defect discovered outside byte result.',INTERPRETATION_VARIANCE:'NONE',OUTPUT_VARIANCE:'NONE',AUTHORIZED_VARIANCE:'NONE',INCONCLUSIVE_TESTS:'NONE',REPEATED_FAILURE_PATTERNS:'NONE',UNIQUE_FAILURES:'One controlled lifecycle metadata defect.',CORRECTNESS_AFFECTING_VARIANCE:'NONE',EVIDENCE:'All ten runs compared.'},relationships:{REQ_ID:rel(reqId)}})]}});assertStage(p,13);
// Stage 14: one confirmed defect and RCA in one response via temp relation.
{
  const defect=proposal('defects',{tempKey:'defect-1',fields:{OBSERVED_FAILURE:'Candidate metadata omitted a required controlled marker.',EXPECTED_CONDITION:'Candidate metadata includes the marker.',EVIDENCE:'Controlled defect evidence.',SEVERITY:'MAJOR'},relationships:{REQ_ID:rel(reqId)}});
  const rca=proposal('rootCauses',{tempKey:'rca-1',fields:{CATEGORY:'INSTRUCTION_IMPLEMENTATION',LAYER_TRACE:'Candidate metadata construction.',EARLIEST_DEFECTIVE_LAYER:'Candidate metadata construction.',ROOT_CAUSE:'Required marker was omitted by the responsible construction step.',EVIDENCE:'Controlled RCA evidence.',DOWNSTREAM_INVALIDATION:'Correct and rerun full iteration.'},relationships:{DEFECT_ID:{tempKey:'defect-1'}}});
  acceptStage(14,{records:{defects:[defect],rootCauses:[rca]}});assertStage(p,14);
}
const defectId=id('defects');
// Stage 15 permanent regression definition and pre-correction failing execution.
{
  const regression=proposal('regressions',{tempKey:'reg-1',fields:{FAILURE_FIXTURE:'Candidate lacking marker.',REPRODUCTION_PROCEDURE:'Inspect controlled marker.',DETECTION_METHOD:'Exact metadata assertion.',PRE_CORRECTION_RESULT:'FAILED',PRE_CORRECTION_EVIDENCE:'Marker absent.',CORRECTION:'Add marker.',POST_CORRECTION_RESULT:'PENDING',POST_CORRECTION_EVIDENCE:'PENDING',PERMANENT_TEST_LOCATION:'verify-full-cycle.mjs',APPLICABILITY:'ALL FUTURE CANDIDATES'},relationships:{DEFECT_ID:rel(defectId),REQ_ID:rel(reqId)}});
  const exec=proposal('regressionExecutions',{tempKey:'regexec-pre',fields:{PHASE:'PRE_CORRECTION',RESULT:'FAILED'},relationships:{REG_ID:{tempKey:'reg-1'},ITERATION_ID:rel(iteration10),CANDIDATE_ID:rel(candidate10)}});
  acceptStage(15,{records:{regressions:[regression],regressionExecutions:[exec]}});assertStage(p,15);
}
const regId=id('regressions');
// Stage 16 controlled correction.
acceptStage(16,{records:{changes:[proposal('changes',{fields:{TRIGGERING_DEFECT_IDS:defectId,ROOT_CAUSE_ANALYSIS:'Required marker omission.',RESPONSIBLE_LAYER:'Candidate metadata construction.',OLD_ARTIFACT_VERSION:'v1',EXACT_MODIFICATION:'Add required marker without changing Hello bytes.',NEW_ARTIFACT_VERSION:'v2',DOWNSTREAM_INVALIDATION:'Stages 17 onward rerun.',REQUIRED_RERUNS:'Full corrected ten-run iteration.',INSTRUCTION_CHANGE_DETERMINATION:'UNCHANGED',JUSTIFIED_UNCHANGED_ARTIFACTS:'Instruction and exact product bytes unchanged.',EVIDENCE:'Controlled correction record.'}})]}});assertStage(p,16);

// Stage 17 corrected candidate and full repeated cycle.
const correctedArtifact=await exactBytesArtifact(p,{stage:17,artifactId:'ARTIFACT-CORRECTED-HELLO',filename:'candidate.txt',bytes:'Hello'});
const frozen17=engine.freezeCandidate(p,{stage:17,artifactIds:[engine.recordId(correctedArtifact,'artifacts')],operatorLabel:OP,purpose:'CORRECTED'});
const iteration17=engine.recordId(frozen17.iteration,'iterations'),candidate17=engine.recordId(frozen17.candidate,'candidateFreezes');
// one FREEZE response to establish Stage 17 accepted DATA_PROPOSAL
acceptStage(17,{operation:'FREEZE',stageData:{NEW_FROZEN_VERSIONS:'v2'}});
runBatch(17,iteration17,candidate17,{operation:'EXECUTE_RUN'});
// operation VERIFY can write verification
acceptStage(17,{operation:'VERIFY',records:{verification:verificationRecords(iteration17,17)},stageData:{VERIFY_COMPLETED:true}});
acceptStage(17,{operation:'COMPARE',records:{comparisons:[proposal('comparisons',{tempKey:'comparison-17',fields:{RUN_DETERMINATIONS:'10/10 SATISFIED',INTERPRETATION_VARIANCE:'NONE',OUTPUT_VARIANCE:'NONE',AUTHORIZED_VARIANCE:'NONE',INCONCLUSIVE_TESTS:'NONE',REPEATED_FAILURE_PATTERNS:'NONE',UNIQUE_FAILURES:'NONE',CORRECTNESS_AFFECTING_VARIANCE:'NONE',EVIDENCE:'Corrected iteration all-ten comparison.'},relationships:{REQ_ID:rel(reqId)}})]},stageData:{COMPARE_COMPLETED:true}});
acceptStage(17,{operation:'REGRESSION',records:{regressionExecutions:[proposal('regressionExecutions',{tempKey:'regexec-post17',fields:{PHASE:'POST_CORRECTION',RESULT:'SATISFIED'},relationships:{REG_ID:rel(regId),ITERATION_ID:rel(iteration17),CANDIDATE_ID:rel(candidate17)}})]},stageData:{REGRESSION_TESTS_ADDED:true}});
acceptStage(17,{operation:'CORRECT',stageData:{CORRECTIONS_COMPLETED:true}});assertStage(p,17);

// Stage 18 deterministic convergence from latest corrected iteration.
acceptStage(18,{stageData:{REGRESSION_TEST_SUCCESS:1}});assertStage(p,18);

// Stage 19 unchanged confirmation freezes the same exact component bytes through the application, then uses ten new contexts.
const frozen19=engine.freezeCandidate(p,{stage:19,artifactIds:[engine.recordId(correctedArtifact,'artifacts')],operatorLabel:OP,purpose:'UNCHANGED_CONFIRMATION'});
const iteration19=engine.recordId(frozen19.iteration,'iterations'),candidate19=engine.recordId(frozen19.candidate,'candidateFreezes');
acceptStage(19,{operation:'CONFIRM_FREEZE',stageData:{COMPLETE_TEST_SUITE_RUN:true}});
runBatch(19,iteration19,candidate19,{operation:'EXECUTE_RUN'});
acceptStage(19,{operation:'VERIFY',records:{verification:verificationRecords(iteration19,19)},stageData:{COMPLETE_TEST_SUITE_RUN:true}});
acceptStage(19,{operation:'COMPARE',records:{comparisons:[proposal('comparisons',{tempKey:'comparison-19',fields:{RUN_DETERMINATIONS:'10/10 SATISFIED',INTERPRETATION_VARIANCE:'NONE',OUTPUT_VARIANCE:'NONE',AUTHORIZED_VARIANCE:'NONE',INCONCLUSIVE_TESTS:'NONE',REPEATED_FAILURE_PATTERNS:'NONE',UNIQUE_FAILURES:'NONE',CORRECTNESS_AFFECTING_VARIANCE:'NONE',EVIDENCE:'Unchanged confirmation comparison.'},relationships:{REQ_ID:rel(reqId)}})]},stageData:{CROSS_RUN_COMPARISON_COMPLETED:true}});
acceptStage(19,{operation:'REGRESSION_VERIFY',records:{regressionExecutions:[proposal('regressionExecutions',{tempKey:'regexec-post19',fields:{PHASE:'UNCHANGED_CONFIRMATION',RESULT:'SATISFIED'},relationships:{REG_ID:rel(regId),ITERATION_ID:rel(iteration19),CANDIDATE_ID:rel(candidate19)}})]},stageData:{CONFIRMATION_ACCEPTANCE_CRITERIA_SATISFIED:true}});
acceptStage(19,{operation:'CONFIRM',records:{confirmationRecords:[proposal('confirmationRecords',{fields:{ZERO_MATERIAL_CHANGES:'TRUE',VERSION_HASH_COMPARISON:'IDENTICAL',TEN_NEW_CONTEXTS:'TRUE',COMPLETE_TEST_RESULTS:'SATISFIED',REGRESSION_RESULTS:'SATISFIED',COMPARISON_RESULTS:'SATISFIED',NEW_DEFECTS:'NONE',NEW_REQUIREMENTS:'NONE',NEW_FAILURE_CASES:'NONE',NEW_VARIANCE:'NONE',DETERMINATION:'SATISFIED',EVIDENCE:'Complete unchanged confirmation evidence.'},relationships:{SOURCE_ITERATION_ID:rel(iteration17),CONFIRMATION_ITERATION_ID:rel(iteration19)}})]}});assertStage(p,19);

// Stage 20 baseline is human-authorized and application-frozen from exact bytes.
engine.freezeBaseline(p,{artifactIds:[engine.recordId(correctedArtifact,'artifacts')],operatorLabel:OP,authorization:'AUTHORIZED'});
acceptStage(20,{stageData:{BASELINE_PACKAGE_SEPARATED_FROM_WORKING_FILES:true}});assertStage(p,20);
const baselineId=id('baselines');

// Stage 21 fresh production context, reserved product identity, agent completion, actual product bytes.
const prodContext=engine.registerFreshContext(p,{stage:21,externalContextIdentifier:'production-fresh-context',operatorLabel:OP});prodContext.fields.CONTAMINATION_STATUS=prodContext.CONTAMINATION_STATUS='NONE';prodContext.fields.USABILITY_DETERMINATION=prodContext.USABILITY_DETERMINATION='SATISFIED';prodContext.fields.TOOL_AVAILABILITY=prodContext.TOOL_AVAILABILITY='AVAILABLE';
const reservedProduct=engine.reserveProductExecution(p,{operatorLabel:OP});
{
  const pr=savePrompt(p,21);
  const target=proposal('products',{targetId:engine.recordId(reservedProduct,'products'),fields:{BASELINE_MATERIALS:engine.recordId(correctedArtifact,'artifacts'),EXECUTION_TIMESTAMPS:new Date().toISOString(),TOOL_CONFIGURATION:'CONTROLLED',DEVIATIONS:'NONE',FAILURES:'NONE',GENERATED_ARTIFACT_INVENTORY:'release.txt'}});
  p=acceptResponse(p,pr,{stageData:normalizeStageData(21,{FRESH_CONTEXT:true}),records:{products:[target]}}).project;
}
const productId=id('products');
const productArtifact=await exactBytesArtifact(p,{stage:21,artifactId:'ARTIFACT-PRODUCT-HELLO',filename:'release.txt',bytes:'Hello',role:'PRODUCT'});assertStage(p,21);

// Stage 22 deterministic product result.
acceptStage(22,{records:{deterministicResults:[proposal('deterministicResults',{fields:{TOOL_AND_VERSION:'Exact byte comparator/1',PROCEDURE:'Compare stored bytes to Hello.',EXPECTED_RESULT:'SATISFIED',ACTUAL_RESULT:'SATISFIED',DETERMINATION:'SATISFIED',EVIDENCE:'Exact bytes and hash verified.'},relationships:{PRODUCT_ID:rel(productId),TEST_ID:rel(testId)}})]}});assertStage(p,22);
// Stage 23 independent meaning review.
acceptStage(23,{records:{meaningResults:[proposal('meaningResults',{fields:{PRODUCT_LOCATION:'release.txt',EXTERNAL_SOURCE_EVIDENCE:'Current canonical authority and user requirement.',REQUIRED_MEANING:'The artifact represents exactly Hello.',OBSERVED_MEANING:'Hello',EVIDENCE_BASED_COMPARISON:'Exact match.',DETERMINATION:'SATISFIED'},relationships:{REQ_ID:rel(reqId),PRODUCT_ID:rel(productId)}})]}});assertStage(p,23);
// Stage 24 adversarial result.
acceptStage(24,{records:{adversarialResults:[proposal('adversarialResults',{fields:{ATTACK:'Add one byte',METHOD:'Controlled mutation',EXPECTED_BEHAVIOR:'Mismatch rejected',ACTUAL_RESULT:'Rejected',DETERMINATION:'SATISFIED',SEVERITY:'CRITICAL',EVIDENCE:'Mutation rejected.'},relationships:{PRODUCT_ID:rel(productId)}})]}});assertStage(p,24);
// Stage 25 artifact inspection: application stamps ARTIFACT_ID.
acceptStage(25,{records:{representationInspections:[proposal('representationInspections',{fields:{REQUIRED_BY_TRACE:reqId,TRANSFORMATION_CHAIN:'No transformation.',TRANSFORMATION_TOOLS_VERSIONS:'None.',RENDERING_OPENING_EVIDENCE:'Opened as text/plain.',OBSERVATIONS:'Exact Hello content.',DETERMINATION:'SATISFIED',EVIDENCE:'Stored product bytes inspected.'},relationships:{ARTIFACT_ID:rel(engine.recordId(productArtifact,'artifacts'))}})]}});assertStage(p,25);
// Stage 26 two audits.
acceptStage(26,{records:{processAudits:[proposal('processAudits',{fields:{APPROVED_INPUTS_VS_ACTUAL:'MATCH',APPROVED_INSTRUCTION_VS_ACTUAL:'MATCH',APPROVED_TOOLS_VS_ACTUAL:'MATCH',REQUIRED_TESTS_VS_EXECUTED:'MATCH',UNAUTHORIZED_MODIFICATION:'NONE',AUTHORIZED_CHANGES:'CONTROLLED',CHAIN_OF_CUSTODY:'COMPLETE',PROCESS_DEFECTS:'NONE',BLOCKERS:'NONE',PROCESS_DETERMINATION:'SATISFIED',PROCESS_EVIDENCE:'Complete process audit.'}})],productAudits:[proposal('productAudits',{tempKey:'product-audit-1',fields:{VALIDATOR_RESULTS:'SATISFIED',MEANING_VERIFICATION_RESULTS:'SATISFIED',PRODUCT_DEFECTS:'NONE',BLOCKERS:'NONE',PRODUCT_DETERMINATION:'SATISFIED',PRODUCT_EVIDENCE:'Complete product audit.'}})]}});assertStage(p,26);
// Stage 27 agent reviews evidence, application owns release decision.
acceptStage(27,{records:{releaseGateReviews:[proposal('releaseGateReviews',{fields:{OBSERVED_BLOCKERS:'NONE',OBSERVED_VIOLATIONS:'NONE',OBSERVED_MISSING_EVIDENCE:'NONE',CONTROLLING_RULE_ANALYSIS:'All current canonical release conditions satisfied.',EVIDENCE:'Complete release evidence.'},relationships:{PRODUCT_ID:rel(productId),BASELINE_ID:rel(baselineId)}})]}});
engine.recordReleaseDetermination(p);assertStage(p,27);const releaseId=id('releaseRecords');assert(engine.recordValue(rec('releaseRecords'),'DETERMINATION')==='ACCEPTED','Release was not ACCEPTED.');
// Stage 28 one-to-one byte identity, deliberately reordered independent lists (one artifact here still identity based).
const artifactId=engine.recordId(productArtifact,'artifacts'),sha=engine.recordValue(productArtifact,'SHA256'),size=engine.recordValue(productArtifact,'BYTE_SIZE');
engine.verifyArtifactIdentity(p,[{artifactId,name:'release.txt',size,sha256:sha,version:'PRODUCT-v001'}],[{artifactId,name:'release.txt',size,sha256:sha,version:'PRODUCT-v001'}]);assertStage(p,28);
// Stage 29 application constructs complete canonical evidence graph.
const chains=engine.constructEvidenceChains(p);assertStage(p,29);
// Stage 30 append-only permanent history gets a final accepted proposal and successful latest regression execution already exists.
acceptStage(30,{stageData:{REGISTRY_STORAGE_LOCATION:'Canonical project history'}});assertStage(p,30);

// Reload and deterministic final integrity checks.
p=roundTrip(p);for(let stage=1;stage<=30;stage++)assertStage(p,stage);
assert(p.projectData.rawResponses.length>0,'No raw responses preserved.');
assert(p.projectData.extractionManifests.length>0,'No extraction manifests preserved.');
assert(p.release.authorization==='AUTHORIZED','Final delivery authorization missing.');
assert(engine.recordValue(rec('releaseRecords'),'DETERMINATION')==='ACCEPTED','Final release determination changed after reload.');

console.log(JSON.stringify({fullCycle:true,stagesCompleted:30,jobId:p.job.JOB_ID,rawResponses:p.projectData.rawResponses.length,acceptedDataChanges:p.projectData.acceptedChanges.length,release:'ACCEPTED',deliveryAuthorization:p.release.authorization,artifactRoundTrip:true},null,2));