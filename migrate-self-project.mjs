import fs from 'node:fs';

const path='SELF_VERIFIED_PROJECT.json';
const project=JSON.parse(fs.readFileSync(path,'utf8'));
const stageNames=['DEFINE JOB','INVENTORY SOURCES','RESEARCH REQUIREMENTS','COMPILE ATOMIC REQUIREMENTS','RESOLVE CONFLICTS','BUILD ACCEPTANCE TESTS','BUILD FAILURE/MUTATION TESTS','AUTHOR PRODUCTION INSTRUCTION','PREFLIGHT INSTRUCTION','FREEZE CANDIDATE','RUN 10 INDEPENDENT EXECUTIONS','VERIFY EVERY RUN AGAINST EVERY REQUIREMENT','COMPARE ALL RUNS','ROOT-CAUSE EVERY DEFECT','ADD REGRESSION TESTS','CORRECT RESPONSIBLE LAYER','FREEZE NEW VERSION','RUN 10 NEW INDEPENDENT EXECUTIONS','REPEAT UNTIL CONVERGED','RUN UNCHANGED 10-EXECUTION CONFIRMATION','FREEZE APPROVED BASELINE','GENERATE FINISHED PRODUCT','DETERMINISTIC PRODUCT VERIFICATION','INDEPENDENT SEMANTIC VERIFICATION','ADVERSARIAL PRODUCT VERIFICATION','FINAL REPRESENTATION INSPECTION','PROCESS AUDIT','PRODUCT AUDIT','ACCEPTED / REJECTED / BLOCKED','VERIFY RELEASE HASH','RELEASE ONLY THE EXACT ACCEPTED ARTIFACT'];

if(project.schema!=='closed-loop-project/1'){
  throw new Error('Legacy retained-project prose is not rewritten into the current schema. Run rebuild-self-project.mjs to create native structured project records through the current application model.');
}
if(!project.projectId||!String(project.name||'').trim())throw new Error('Current-schema retained project identity is incomplete.');
if(!Array.isArray(project.stages)||project.stages.length!==31)throw new Error('Current-schema retained project does not contain exactly 31 stages.');
project.stages.forEach((stage,index)=>{
  if(stage.number!==index+1||stage.name!==stageNames[index])throw new Error(`Current-schema retained project stage ${index+1} does not match the required workflow.`);
});
const requiredCollections=['userInputs','externalSources','researchCoverage','findings','requirements','acceptanceTests','mutationTests','productionInstructions','preflightReviews','candidates','executions','verificationRecords','comparisons','defects','regressionTests','corrections','convergenceCycles','baselines','products','deterministicChecks','semanticChecks','adversarialChecks','representationInspections','processAudits','productAudits','decisions','hashVerifications','releases','workflowArtifacts'];
for(const name of requiredCollections)if(!Array.isArray(project[name]))throw new Error(`Current-schema retained project is missing native ${name} records.`);
console.log(JSON.stringify({status:'PASS',migrationRequired:false,mutated:false,projectId:project.projectId,schema:project.schema,stages:project.stages.length,nativeStructuredCollections:requiredCollections.length},null,2));
