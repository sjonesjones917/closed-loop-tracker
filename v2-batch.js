(function(global){
"use strict";
const C=global.CLV2,{STAGE_NAMES,STAGE_INSTRUCTIONS,MANDATORY_RULES,ENUMS,pad,authoritativeJobRecord,productionInstruction,candidateFreeze,parseBool}=C;
function buildIndependentRunPrompt(j,kind,runId){
  const freeze=candidateFreeze(j,kind),instruction=productionInstruction(j);
  return `CLOSED-LOOP INDEPENDENT TEST EXECUTION

RUN_ID: ${runId}
BATCH: ${kind.toUpperCase()}

FROZEN CANDIDATE
${freeze}

PRODUCTION INSTRUCTION TO EXECUTE
${instruction}

BASELINE JOB INPUT REQUIRED BY THE PRODUCTION INSTRUCTION
${authoritativeJobRecord(j)}

EXECUTE NOW
Execute the production instruction now in this fresh context. Produce the complete candidate output it requires. Use only the frozen candidate versions and permitted tools/sources. Do not inspect, infer, request, or use any other run's output, reviewer comments, prior failure explanations, or proposed corrections. Return the complete candidate output, not an explanation of how to create it.`;
}
function createRunBatch(j,kind,n){const arr=j.runs[kind];if(arr.length)return arr;for(let i=1;i<=10;i++){const runId="RUN-"+pad(i);arr.push({runId,status:"NOT_STARTED",prompt:buildIndependentRunPrompt(j,kind,runId),output:"",verified:false,verification:""})}return arr}
function saveRunOutput(j,kind,index,output){const r=j.runs[kind][index];r.output=output;r.status=output.trim()?"COMPLETE":"FAILED";return r}
function validateRunBatch(j,kind){const arr=j.runs[kind];return {ok:arr.length===10&&arr.every(r=>r.status==="COMPLETE"),count:arr.filter(r=>r.status==="COMPLETE").length}}
function buildVerificationPrompt(j,kind,run){return `CLOSED-LOOP INDEPENDENT RUN VERIFICATION

RUN_ID: ${run.runId}
BATCH: ${kind.toUpperCase()}

REQUIREMENT SPECIFICATION
${j.stages[3]?.result||"UNKNOWN"}

VERIFICATION SUITE
${j.stages[5]?.result||"UNKNOWN"}

RELEVANT SOURCE EVIDENCE
${j.stages[1]?.result||"UNKNOWN"}

RUN OUTPUT TO VERIFY
${run.output}

WORK TO PERFORM NOW
${STAGE_INSTRUCTIONS[12]}

REQUIRED RESPONSE
For every mandatory requirement, return:
REQ_ID:
RUN_ID: ${run.runId}
RESULT: SATISFIED | VIOLATED | UNDETERMINED
TEST_ID:
EVIDENCE:
DEFECT_ID: [blank if none]

Run deterministic validators independently. Run semantic evaluation independently. Run adversarial evaluation independently where applicable. Do not ask the generating execution to certify itself. Do not return unsupported pass/fail conclusions.`}
function createVerificationPrompts(j,kind="candidate"){return j.runs[kind].map(r=>({runId:r.runId,prompt:buildVerificationPrompt(j,kind,r)}))}
function saveVerification(j,kind,index,text){const r=j.runs[kind][index];r.verification=text;r.verified=!!text.trim()&&!/\bRESULT\s*:\s*(VIOLATED|UNDETERMINED)\b/i.test(text);return r}
function validateVerificationBatch(j,kind){const arr=j.runs[kind];return {ok:arr.length===10&&arr.every(r=>r.verified),count:arr.filter(r=>r.verified).length}}
function markBatchStage(j,n,kind){const s=j.stages[n-1],v=validateRunBatch(j,kind);s.result=`${kind.toUpperCase()} RUN BATCH: ${v.count}/10 complete`;s.validated=v.ok;s.status=v.ok?"COMPLETE":"FAILED";if(v.ok&&j.currentStage===n)j.currentStage=n+1;return v}
function markVerificationStage(j,n,kind){const s=j.stages[n-1],v=validateVerificationBatch(j,kind);s.result=`${kind.toUpperCase()} VERIFICATION BATCH: ${v.count}/10 verified`;s.validated=v.ok;s.status=v.ok?"COMPLETE":"FAILED";if(v.ok&&j.currentStage===n)j.currentStage=n+1;return v}
function completeRerunIteration(j,comparison,rootCause,regressions,correction){
  if(!j.iterationWorkspace.freeze || parseBool(j.iterationWorkspace.freeze,"FREEZE_COMPLETE")!=="TRUE") return {ok:false,reason:"The corrected iteration has not been frozen before rerunning."};
  const runs=validateRunBatch(j,"rerun"),ver=validateVerificationBatch(j,"rerun");
  if(!runs.ok)return {ok:false,reason:`Only ${runs.count}/10 rerun executions are complete.`};
  if(!ver.ok)return {ok:false,reason:`Only ${ver.count}/10 rerun executions have affirmative independent verification.`};
  if(!comparison.trim())return {ok:false,reason:"The rerun comparison has not been completed."};
  const defects=/DEFECT_REQUIRED\s*:\s*TRUE|\bVIOLATED\b|\bUNDETERMINED\b/i.test(comparison);
  if(defects){if(!rootCause.trim())return {ok:false,reason:"Rerun comparison found a defect, but root-cause analysis is missing."};if(!regressions.trim())return {ok:false,reason:"Confirmed rerun defect has no regression-test record."};if(!correction.trim())return {ok:false,reason:"Confirmed rerun defect has no responsible-layer correction."};return {ok:false,loop:true,reason:"Defects were corrected. Freeze the corrected versions and run another fresh ten-execution cycle before convergence."}}
  const s=j.stages[16];s.result=`RERUN EXECUTIONS: 10/10\nRERUN VERIFICATIONS: 10/10\n\nCOMPARISON\n${comparison}\n\nROOT CAUSE\n${rootCause||"NO_CONFIRMED_DEFECTS"}\n\nREGRESSION TESTS\n${regressions||"NO_NEW_REGRESSION_TESTS_REQUIRED"}\n\nCORRECTION\n${correction||"NO_RESPONSIBLE_LAYER_CORRECTION_REQUIRED"}`;s.status="COMPLETE";s.validated=true;if(j.currentStage===17)j.currentStage=18;return {ok:true};
}
function resetRerunCycle(j){j.iteration=(j.iteration||1)+1;if(!j.iterationHistory)j.iterationHistory=[];j.iterationHistory.push(JSON.parse(JSON.stringify({iteration:j.iteration-1,runs:j.runs.rerun,workspace:j.iterationWorkspace})));j.runs.rerun=[];j.iterationWorkspace={freeze:"",rerunVerification:[],comparison:"",rootCause:"",regressions:"",correction:""};j.stages[16].status="IN_PROGRESS";j.stages[16].validated=false}
function completeConfirmationIteration(j,summary){const runs=validateRunBatch(j,"confirmation"),ver=validateVerificationBatch(j,"confirmation");if(!runs.ok)return {ok:false,reason:`Only ${runs.count}/10 confirmation executions are complete.`};if(!ver.ok)return {ok:false,reason:`Only ${ver.count}/10 confirmation executions have affirmative independent verification.`};if(parseBool(summary,"NEW_CRITICAL_OR_MAJOR_DEFECT")!=="FALSE")return {ok:false,reason:"Confirmation does not establish zero new critical/major defects."};if(parseBool(summary,"NEW_REQUIREMENT_DISCOVERED")!=="FALSE")return {ok:false,reason:"Confirmation discovered a new requirement; return to requirement research."};if(parseBool(summary,"MUTATION_DETECTION_FAILURE")!=="FALSE")return {ok:false,reason:"Confirmation reports a validator mutation-detection failure."};if(parseBool(summary,"CONFIRMATION_ACCEPTANCE_CRITERIA_SATISFIED")!=="TRUE")return {ok:false,reason:"Confirmation acceptance criteria are not established."};const s=j.stages[18];s.result=`CONFIRMATION EXECUTIONS: 10/10\nCONFIRMATION VERIFICATIONS: 10/10\n\n${summary}`;s.status="COMPLETE";s.validated=true;if(j.currentStage===19)j.currentStage=20;return {ok:true}}
function exportState(j){return JSON.stringify(j,null,2)}
const API={...C,createRunBatch,saveRunOutput,validateRunBatch,createVerificationPrompts,saveVerification,validateVerificationBatch,markBatchStage,markVerificationStage,completeRerunIteration,resetRerunCycle,completeConfirmationIteration,exportState};if(typeof module!=="undefined"&&module.exports)module.exports=API;global.ClosedLoopCore=API;
})(typeof window!=="undefined"?window:globalThis);
