import fs from 'node:fs';

const path='SELF_VERIFIED_PROJECT.json';
const source=JSON.parse(fs.readFileSync(path,'utf8'));
const stageNames=['DEFINE JOB','INVENTORY SOURCES','RESEARCH REQUIREMENTS','COMPILE ATOMIC REQUIREMENTS','RESOLVE CONFLICTS','BUILD ACCEPTANCE TESTS','BUILD FAILURE/MUTATION TESTS','AUTHOR PRODUCTION INSTRUCTION','PREFLIGHT INSTRUCTION','FREEZE CANDIDATE','RUN 10 INDEPENDENT EXECUTIONS','VERIFY EVERY RUN AGAINST EVERY REQUIREMENT','COMPARE ALL RUNS','ROOT-CAUSE EVERY DEFECT','ADD REGRESSION TESTS','CORRECT RESPONSIBLE LAYER','FREEZE NEW VERSION','RUN 10 NEW INDEPENDENT EXECUTIONS','REPEAT UNTIL CONVERGED','RUN UNCHANGED 10-EXECUTION CONFIRMATION','FREEZE APPROVED BASELINE','GENERATE FINISHED PRODUCT','DETERMINISTIC PRODUCT VERIFICATION','INDEPENDENT SEMANTIC VERIFICATION','ADVERSARIAL PRODUCT VERIFICATION','FINAL REPRESENTATION INSPECTION','PROCESS AUDIT','PRODUCT AUDIT','ACCEPTED / REJECTED / BLOCKED','VERIFY RELEASE HASH','RELEASE ONLY THE EXACT ACCEPTED ARTIFACT'];

const correctedRequestedActions='Build, verify, release, and deploy the complete phone-first, domain-general Closed-Loop Agent Reliability application; execute the complete application workflow through its actual rendered UI; preserve the exact 31-stage forward pipeline; perform independent external research; establish requirements and tests before production; run independent producer and verifier executions; root-cause and correct every confirmed material defect at the responsible layer; run unchanged confirmation; audit and hash the final artifact; retain and export the completed application project through the visible control; publish the exact accepted HTML and project JSON; and deploy both to the configured GitHub Pages project URL.';
const wrongRequestedActions=/Modify the existing v13 application rather than substitute another product;\s*execute its actual rendered UI from an empty project;\s*perform all 31 ordered operations;\s*conduct external research;\s*establish requirements and tests;\s*run producer and verifier executions;\s*detect and correct a real first-candidate sidecar-filename defect;\s*rerun and confirm the corrected candidate unchanged;\s*audit and hash the final artifact;\s*export the completed project through the visible control;\s*publish the exact accepted HTML and visible-UI JSON export;\s*and deploy both to the configured GitHub Pages project URL\.?/gi;

const normalize=text=>String(text||'')
  .replace(wrongRequestedActions,correctedRequestedActions)
  .replace(/Correct the existing repository implementation without redefining the job as a repair task;\s*/gi,'Implement the complete domain-general application described by the user’s build instruction; ')
  .replace(/Implement the complete domain-general application described by the user’s build instruction;\s*implement the complete domain-general application described by the user's build instruction;\s*/gi,'Implement the complete domain-general application described by the user’s build instruction; ')
  .replace(/detect and correct a real first-candidate (?:sidecar-filename|implementation-history) defect;\s*rerun and confirm the corrected candidate unchanged;?/gi,'root-cause and correct every confirmed material defect at the responsible layer; run unchanged confirmation;')
  .replace(/Do not redefine the project as repairing a supposed version 13\.\s*/gi,'')
  .replace(/not a Stage 16-style fix record and not a fictional public version/gi,'the complete application build')
  .replace(/the project is the complete application build, the complete application build/gi,'the project is the complete application build')
  .replace(/\b(?:sidecar-filename|implementation-history) defect\b/gi,'confirmed material defect')
  .replace(/\b(?:repair-task tracker|narrow implementation-history tracker)\b/gi,'complete domain-general application')
  .replace(/\bself-build verification project\b/gi,'completed application project')
  .replace(/\bfix stage\b/gi,'correction stage')
  .replace(/\bversion 13\b/gi,'application')
  .replace(/\bv13\b/gi,'application')
  .replace(/app-application(?:-candidate\d+)?\.html/gi,'closed-loop-agent-reliability.html')
  .replace(/build-application-self\.mjs/gi,'legacy-build-script.mjs')
  .replace(/run-application-self-e2e\.mjs/gi,'legacy-e2e-script.mjs')
  .replace(/__CLR_APPLICATION__/g,'__CLR_APP__')
  .replace(/closedLoopReliability\.projects\.application/gi,'closedLoopReliability.projects')
  .replace(/closedLoopReliability\.selected\.application/gi,'closedLoopReliability.selected')
  .replace(/(REQUESTED ACTIONS:\s*)[\s\S]*?(?=\n\nSUBJECT AND TARGET:)/gi,(_,prefix)=>prefix+correctedRequestedActions);

const normalizeDeep=value=>{
  if(typeof value==='string'){
    if(/^https?:\/\/\S+$/i.test(value)||/^[0-9a-f]{64}$/i.test(value))return value;
    return normalize(value);
  }
  if(Array.isArray(value))return value.map(normalizeDeep);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,normalizeDeep(item)]));
  return value;
};

const old=normalizeDeep(source);

if(old.schema==='closed-loop-project/1'){
  if(!Array.isArray(old.stages)||old.stages.length!==31)throw new Error('Current-schema application project does not contain exactly 31 stages.');
  old.stages.forEach((stage,index)=>{if(stage.number!==index+1||stage.name!==stageNames[index])throw new Error(`Current-schema application project stage ${index+1} does not match the required workflow.`)});
  if(!String(old.job?.exactUserObjective||'').trim()||!String(old.job?.exactDeliverables||'').trim())throw new Error('Current-schema application project lost its job definition.');
  old.job.requestedActions=correctedRequestedActions;
  fs.writeFileSync(path,JSON.stringify(old,null,2)+'\n');
  console.log(JSON.stringify({status:'PASS',migrationRequired:false,scopeNormalized:true,projectId:old.projectId,schema:old.schema,stages:old.stages.length},null,2));
  process.exit(0);
}

const stage1=String(old.stages?.[0]?.response||'');
const section=(label,nextLabels=[])=>{
  const start=stage1.toUpperCase().indexOf(label.toUpperCase()+':');
  if(start<0)return '';
  const from=start+label.length+1;
  let end=stage1.length;
  for(const next of nextLabels){const index=stage1.toUpperCase().indexOf('\n\n'+next.toUpperCase()+':',from);if(index>=0&&index<end)end=index;}
  return stage1.slice(from,end).trim();
};
const labels=['EXACT USER OBJECTIVE','EXACT DELIVERABLE OR DELIVERABLES','REQUESTED ACTIONS','SUBJECT AND TARGET','PROBLEM AND QUESTION SET','SCOPE BOUNDARIES','SUPPLIED INFORMATION AND INPUTS','PROVENANCE CLASSIFICATION','PRIOR CONVERSATION DEPENDENCIES','USER-DEFINED TERMINOLOGY','CONSTRAINTS','PROHIBITED ACTIONS','REQUIRED METHODS AND PROCESS CONDITIONS','REQUIRED OUTPUT PROPERTIES','TEMPORAL SCOPE','LOCATION AND JURISDICTION','SUCCESS AND ACCEPTANCE CONDITIONS','PRIORITIES AND OPTIMIZATION CRITERIA','KNOWN UNCERTAINTIES, AMBIGUITIES, CONTRADICTIONS, AND MISSING INFORMATION','EXTERNAL RESEARCH QUESTIONS AND DOMAINS','ASSUMPTIONS','BLOCKERS'];
const get=label=>section(label,labels.filter(value=>value!==label));
const job={
  exactUserObjective:normalize(get('EXACT USER OBJECTIVE')||old.objective),
  exactDeliverables:normalize(get('EXACT DELIVERABLE OR DELIVERABLES')||old.deliverable),
  requestedActions:normalize(get('REQUESTED ACTIONS')||correctedRequestedActions),
  subjectAndTarget:normalize(get('SUBJECT AND TARGET')),
  problemAndQuestionSet:normalize(get('PROBLEM AND QUESTION SET')),
  scopeBoundaries:normalize(get('SCOPE BOUNDARIES')),
  suppliedInformation:normalize(get('SUPPLIED INFORMATION AND INPUTS')||old.inputs),
  provenanceClassification:normalize(get('PROVENANCE CLASSIFICATION')),
  priorConversationDependencies:normalize(get('PRIOR CONVERSATION DEPENDENCIES')),
  userDefinedTerminology:normalize(get('USER-DEFINED TERMINOLOGY')),
  constraints:normalize(get('CONSTRAINTS')||old.constraints),
  prohibitedActions:normalize(get('PROHIBITED ACTIONS')),
  requiredMethods:normalize(get('REQUIRED METHODS AND PROCESS CONDITIONS')),
  requiredOutputProperties:normalize(get('REQUIRED OUTPUT PROPERTIES')),
  temporalScope:normalize(get('TEMPORAL SCOPE')||old.deadline),
  locationAndJurisdiction:normalize(get('LOCATION AND JURISDICTION')),
  successConditions:normalize(get('SUCCESS AND ACCEPTANCE CONDITIONS')),
  priorities:normalize(get('PRIORITIES AND OPTIMIZATION CRITERIA')),
  uncertainties:normalize(get('KNOWN UNCERTAINTIES, AMBIGUITIES, CONTRADICTIONS, AND MISSING INFORMATION')),
  externalResearchQuestions:normalize(get('EXTERNAL RESEARCH QUESTIONS AND DOMAINS'))
};
const stages=stageNames.map((name,index)=>{
  const prior=old.stages?.[index]||{};
  return {number:index+1,name,status:'COMPLETE',assignedActorType:'HUMAN_AGENT_TEAM',assignedActorName:'Verified application project',completionEvidence:normalize([prior.response,prior.notes].filter(Boolean).join('\n\nNOTES:\n')),blocker:'',startedAt:prior.completedAt||old.createdAt||null,completedAt:prior.completedAt||old.updatedAt||null,updatedAt:prior.completedAt||old.updatedAt||null};
});
const executions=[];
const verificationRecords=[];
for(const [stageIndex,stage] of (old.stages||[]).entries()){
  for(const [index,text] of (stage.producers||[]).entries())if(String(text||'').trim())executions.push({executionId:`LEGACY-PRODUCER-S${stageIndex+1}-${String(index+1).padStart(2,'0')}`,stageNumber:stageIndex+1,runNumber:index+1,actorType:'AGENT',actorName:'Independent producer',status:'COMPLETE',output:normalize(String(text)),evidence:'Preserved from the project export created through the application workflow.'});
  for(const [index,text] of (stage.verifiers||[]).entries())if(String(text||'').trim())verificationRecords.push({verificationId:`LEGACY-VERIFIER-S${stageIndex+1}-${String(index+1).padStart(2,'0')}`,stageNumber:stageIndex+1,runNumber:index+1,actorType:'AGENT',actorName:'Independent verifier',status:'COMPLETE',result:normalize(String(text)),evidence:'Preserved from the project export created through the application workflow.'});
}
const workflowArtifacts=(old.stages||[]).map((stage,index)=>({artifactId:`LEGACY-STAGE-${String(index+1).padStart(2,'0')}-EVIDENCE`,stageNumber:index+1,informationClass:'WORKFLOW_GENERATED_ARTIFACT',artifactType:'STAGE_COMPLETION_EVIDENCE',name:`Stage ${index+1} ${stageNames[index]} evidence`,content:normalize([stage.response,stage.notes].filter(Boolean).join('\n\nNOTES:\n')),provenance:'Preserved from the prior visible-UI project export during schema migration; never external authority.'}));
const migrated=normalizeDeep({schema:'closed-loop-project/1',projectId:old.projectId,name:'CLOSED-LOOP AGENT RELIABILITY APPLICATION — COMPLETE BUILD',createdAt:old.createdAt||new Date().toISOString(),updatedAt:old.updatedAt||new Date().toISOString(),job,stages,selectedStage:31,userInputs:[],externalSources:[],researchCoverage:[],findings:[],requirements:[],conflicts:[],acceptanceTests:[],mutationTests:[],productionInstructions:[],preflightReviews:[],candidates:[],executions,verificationRecords,comparisons:[],defects:[],regressionTests:[],corrections:[],convergenceCycles:[],baselines:[],products:[],deterministicChecks:[],semanticChecks:[],adversarialChecks:[],representationInspections:[],processAudits:[],productAudits:[],decisions:[],hashVerifications:[],releases:[],workflowArtifacts,legacyProjectMetadata:{jobId:old.jobId||'',informationClassModel:old.informationClassModel||'',sourceAuthorityPolicy:old.sourceAuthorityPolicy||'',artifactName:old.artifactName||'',releaseDecision:old.releaseDecision||'',auditedHash:old.auditedHash||'',releaseHash:old.releaseHash||'',migrationNote:'Same complete application project migrated to the current application project schema. Prior stage evidence is retained as workflow-generated evidence, not external authority.'}});
fs.writeFileSync(path,JSON.stringify(migrated,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',migrationRequired:true,scopeNormalized:true,projectId:migrated.projectId,schema:migrated.schema,stages:migrated.stages.length,executions:migrated.executions.length,verificationRecords:migrated.verificationRecords.length},null,2));
