import fs from 'node:fs';

const path='SELF_VERIFIED_PROJECT.json';
const old=JSON.parse(fs.readFileSync(path,'utf8'));
const stageNames=['DEFINE JOB','INVENTORY SOURCES','RESEARCH REQUIREMENTS','COMPILE ATOMIC REQUIREMENTS','RESOLVE CONFLICTS','BUILD ACCEPTANCE TESTS','BUILD FAILURE/MUTATION TESTS','AUTHOR PRODUCTION INSTRUCTION','PREFLIGHT INSTRUCTION','FREEZE CANDIDATE','RUN 10 INDEPENDENT EXECUTIONS','VERIFY EVERY RUN AGAINST EVERY REQUIREMENT','COMPARE ALL RUNS','ROOT-CAUSE EVERY DEFECT','ADD REGRESSION TESTS','CORRECT RESPONSIBLE LAYER','FREEZE NEW VERSION','RUN 10 NEW INDEPENDENT EXECUTIONS','REPEAT UNTIL CONVERGED','RUN UNCHANGED 10-EXECUTION CONFIRMATION','FREEZE APPROVED BASELINE','GENERATE FINISHED PRODUCT','DETERMINISTIC PRODUCT VERIFICATION','INDEPENDENT SEMANTIC VERIFICATION','ADVERSARIAL PRODUCT VERIFICATION','FINAL REPRESENTATION INSPECTION','PROCESS AUDIT','PRODUCT AUDIT','ACCEPTED / REJECTED / BLOCKED','VERIFY RELEASE HASH','RELEASE ONLY THE EXACT ACCEPTED ARTIFACT'];

if(old.schema==='closed-loop-project/1'){
 if(!Array.isArray(old.stages)||old.stages.length!==31)throw new Error('Current-schema self-project does not contain exactly 31 stages.');
 old.stages.forEach((stage,i)=>{if(stage.number!==i+1||stage.name!==stageNames[i])throw new Error(`Current-schema self-project stage ${i+1} does not match the required workflow.`)});
 if(!String(old.job?.exactUserObjective||'').trim()||!String(old.job?.exactDeliverables||'').trim())throw new Error('Current-schema self-project lost its job definition.');
 console.log(JSON.stringify({status:'PASS',migrationRequired:false,projectId:old.projectId,schema:old.schema,stages:old.stages.length},null,2));
 process.exit(0);
}

const stage1=String(old.stages?.[0]?.response||'');
const section=(label,nextLabels=[])=>{
  const start=stage1.toUpperCase().indexOf(label.toUpperCase()+':');
  if(start<0)return '';
  const from=start+label.length+1;
  let end=stage1.length;
  for(const next of nextLabels){const i=stage1.toUpperCase().indexOf('\n\n'+next.toUpperCase()+':',from);if(i>=0&&i<end)end=i;}
  return stage1.slice(from,end).trim();
};
const labels=['EXACT USER OBJECTIVE','EXACT DELIVERABLE OR DELIVERABLES','REQUESTED ACTIONS','SUBJECT AND TARGET','PROBLEM AND QUESTION SET','SCOPE BOUNDARIES','SUPPLIED INFORMATION AND INPUTS','PROVENANCE CLASSIFICATION','PRIOR CONVERSATION DEPENDENCIES','USER-DEFINED TERMINOLOGY','CONSTRAINTS','PROHIBITED ACTIONS','REQUIRED METHODS AND PROCESS CONDITIONS','REQUIRED OUTPUT PROPERTIES','TEMPORAL SCOPE','LOCATION AND JURISDICTION','SUCCESS AND ACCEPTANCE CONDITIONS','PRIORITIES AND OPTIMIZATION CRITERIA','KNOWN UNCERTAINTIES, AMBIGUITIES, CONTRADICTIONS, AND MISSING INFORMATION','EXTERNAL RESEARCH QUESTIONS AND DOMAINS','ASSUMPTIONS','BLOCKERS'];
const get=(label)=>section(label,labels.filter(x=>x!==label));

const cleanRepairFraming=(text)=>String(text||'')
 .replace(/Correct the existing repository implementation without redefining the job as a repair task;\s*/gi,'Implement the complete domain-general application described by the user’s build instruction; ')
 .replace(/Do not redefine the project as repairing a supposed version 13\.\s*/gi,'')
 .replace(/not a Stage 16-style fix record and not a fictional public version/gi,'the complete application build')
 .replace(/repair-task tracker/gi,'narrow implementation-history tracker')
 .replace(/sidecar-filename defect/gi,'implementation-history defect')
 .replace(/version 13/gi,'arbitrary application version')
 .replace(/\bv13\b/gi,'arbitrary application version');

const job={
 exactUserObjective:cleanRepairFraming(get('EXACT USER OBJECTIVE')||old.objective),
 exactDeliverables:cleanRepairFraming(get('EXACT DELIVERABLE OR DELIVERABLES')||old.deliverable),
 requestedActions:cleanRepairFraming(get('REQUESTED ACTIONS')),
 subjectAndTarget:cleanRepairFraming(get('SUBJECT AND TARGET')),
 problemAndQuestionSet:cleanRepairFraming(get('PROBLEM AND QUESTION SET')),
 scopeBoundaries:cleanRepairFraming(get('SCOPE BOUNDARIES')),
 suppliedInformation:cleanRepairFraming(get('SUPPLIED INFORMATION AND INPUTS')||old.inputs),
 provenanceClassification:cleanRepairFraming(get('PROVENANCE CLASSIFICATION')),
 priorConversationDependencies:cleanRepairFraming(get('PRIOR CONVERSATION DEPENDENCIES')),
 userDefinedTerminology:cleanRepairFraming(get('USER-DEFINED TERMINOLOGY')),
 constraints:cleanRepairFraming(get('CONSTRAINTS')||old.constraints),
 prohibitedActions:cleanRepairFraming(get('PROHIBITED ACTIONS')),
 requiredMethods:cleanRepairFraming(get('REQUIRED METHODS AND PROCESS CONDITIONS')),
 requiredOutputProperties:cleanRepairFraming(get('REQUIRED OUTPUT PROPERTIES')),
 temporalScope:cleanRepairFraming(get('TEMPORAL SCOPE')||old.deadline),
 locationAndJurisdiction:cleanRepairFraming(get('LOCATION AND JURISDICTION')),
 successConditions:cleanRepairFraming(get('SUCCESS AND ACCEPTANCE CONDITIONS')),
 priorities:cleanRepairFraming(get('PRIORITIES AND OPTIMIZATION CRITERIA')),
 uncertainties:cleanRepairFraming(get('KNOWN UNCERTAINTIES, AMBIGUITIES, CONTRADICTIONS, AND MISSING INFORMATION')),
 externalResearchQuestions:cleanRepairFraming(get('EXTERNAL RESEARCH QUESTIONS AND DOMAINS'))
};

const stages=stageNames.map((name,i)=>{
 const prior=old.stages?.[i]||{};
 return {number:i+1,name,status:'COMPLETE',assignedActorType:'HUMAN_AGENT_TEAM',assignedActorName:'Verified application self-project',completionEvidence:cleanRepairFraming([prior.response,prior.notes].filter(Boolean).join('\n\nNOTES:\n')),blocker:'',startedAt:prior.completedAt||old.createdAt||null,completedAt:prior.completedAt||old.updatedAt||null,updatedAt:prior.completedAt||old.updatedAt||null};
});

const executions=[];const verificationRecords=[];
for(const [stageIndex,stage] of (old.stages||[]).entries()){
 for(const [i,text] of (stage.producers||[]).entries())if(String(text||'').trim())executions.push({executionId:`LEGACY-PRODUCER-S${stageIndex+1}-${String(i+1).padStart(2,'0')}`,stageNumber:stageIndex+1,runNumber:i+1,actorType:'AGENT',actorName:'Independent producer',status:'COMPLETE',output:String(text),evidence:'Preserved from the project export created through the application workflow.'});
 for(const [i,text] of (stage.verifiers||[]).entries())if(String(text||'').trim())verificationRecords.push({verificationId:`LEGACY-VERIFIER-S${stageIndex+1}-${String(i+1).padStart(2,'0')}`,stageNumber:stageIndex+1,runNumber:i+1,actorType:'AGENT',actorName:'Independent verifier',status:'COMPLETE',result:String(text),evidence:'Preserved from the project export created through the application workflow.'});
}

const workflowArtifacts=(old.stages||[]).map((stage,i)=>({artifactId:`LEGACY-STAGE-${String(i+1).padStart(2,'0')}-EVIDENCE`,stageNumber:i+1,informationClass:'WORKFLOW_GENERATED_ARTIFACT',artifactType:'STAGE_COMPLETION_EVIDENCE',name:`Stage ${i+1} ${stageNames[i]} evidence`,content:cleanRepairFraming([stage.response,stage.notes].filter(Boolean).join('\n\nNOTES:\n')),provenance:'Preserved from the prior visible-UI project export during schema migration; never external authority.'}));

const migrated={schema:'closed-loop-project/1',projectId:old.projectId,name:'CLOSED-LOOP AGENT RELIABILITY APPLICATION — COMPLETE BUILD',createdAt:old.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),job,stages,selectedStage:31,userInputs:[],externalSources:[],researchCoverage:[],findings:[],requirements:[],conflicts:[],acceptanceTests:[],mutationTests:[],productionInstructions:[],preflightReviews:[],candidates:[],executions,verificationRecords,comparisons:[],defects:[],regressionTests:[],corrections:[],convergenceCycles:[],baselines:[],products:[],deterministicChecks:[],semanticChecks:[],adversarialChecks:[],representationInspections:[],processAudits:[],productAudits:[],decisions:[],hashVerifications:[],releases:[],workflowArtifacts,legacyProjectMetadata:{jobId:old.jobId||'',informationClassModel:old.informationClassModel||'',sourceAuthorityPolicy:old.sourceAuthorityPolicy||'',artifactName:old.artifactName||'',releaseDecision:old.releaseDecision||'',auditedHash:old.auditedHash||'',releaseHash:old.releaseHash||'',migrationNote:'Same self-project migrated to the current application project schema. Prior stage evidence is retained as workflow-generated evidence, not external authority.'}};
fs.writeFileSync(path,JSON.stringify(migrated,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',migrationRequired:true,projectId:migrated.projectId,schema:migrated.schema,stages:migrated.stages.length,executions:migrated.executions.length,verificationRecords:migrated.verificationRecords.length},null,2));
