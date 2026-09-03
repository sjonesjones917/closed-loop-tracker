import fs from 'node:fs';

const path='verify-full-cycle.mjs';
let source=fs.readFileSync(path,'utf8');
const pattern=/function verifyBatch\(stage,operation,slots\)\{[\s\S]*?\}\nverifyBatch\(12,'VERIFY',initialSlots\);/;
if(!pattern.test(source))throw new Error('verifyBatch fixture block not found exactly once.');
const replacement=`function verifyBatch(stage,operation,slots){
  let verifierNumber=0;
  for(const {runId} of slots){
    verifierNumber+=1;
    engine.registerFreshContext(p,{stage,externalContextIdentifier:\`VERIFY-CONTEXT-\${stage}-\${operation}-\${verifierNumber}\`,operatorLabel:'FULL_CYCLE',purpose:'REVIEWER'});
    const verifierContextId=rid('freshContexts'),verification=[],observationRecords=[],entailmentReviews=[];
    for(const test of stage6Tests){
      const currentTestId=engine.recordId(test,'tests'),testType=engine.recordValue(test,'TEST_TYPE'),key=\`\${runId}-\${currentTestId}\`;
      verification.push(recordProposal(schema,'verification',{tempKey:\`verify-\${key}\`,relationships:{REQ_ID:{recordId:reqId},RUN_ID:{recordId:runId},TEST_ID:{recordId:currentTestId}},overrides:{VERIFIER:'INDEPENDENT_VERIFIER',VERIFIER_CONTEXT_ID:verifierContextId,INDEPENDENCE_STATUS:'INDEPENDENT',INPUTS:'Canonical run output',PROCEDURE:\`Execute \${testType} test\`,EXPECTED_RESULT:'SATISFIED',OBSERVED_RESULT:'SATISFIED',EXACT_EVIDENCE:\`Evidence \${key}\`,DETERMINATION:'SATISFIED'}}));
      observationRecords.push(recordProposal(schema,'observationRecords',{tempKey:\`obs-\${key}\`,relationships:{SUBJECT_ID:{recordId:currentTestId}},overrides:{EXTERNAL_OR_AGENT_OBSERVED_VALUE:\`SATISFIED observation \${key}\`}}));
      entailmentReviews.push(recordProposal(schema,'entailmentReviews',{tempKey:\`entail-\${key}\`,relationships:{OBSERVATION_ID:{tempKey:\`obs-\${key}\`},TARGET_PROPOSITION_ID:{recordId:propId}},overrides:{ENTAILMENT_FINDING:'ESTABLISHES',REASONING:'The current independent observation establishes the tested proposition.'}}));
    }
    data(stage,{operation,scope:{runId},records:{verification,observationRecords,entailmentReviews}});
  }
}
verifyBatch(12,'VERIFY',initialSlots);`;
source=source.replace(pattern,replacement);
fs.writeFileSync(path,source);
console.log('Repaired Stage 12 full-cycle fixture to one run-bound response per run.');
