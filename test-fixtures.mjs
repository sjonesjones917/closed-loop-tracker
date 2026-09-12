export function scalarFor(def,name,overrides={}){
  if(Object.hasOwn(overrides,name))return overrides[name];
  if(String(name).toUpperCase()==='EXECUTION_MODE')return 'EXTERNAL_AGENT_TOOL';
  if(def.enumValues?.length)return def.enumValues[0];
  if(def.valueType==='BOOLEAN')return true;
  if(def.valueType==='INTEGER')return 1;
  if(def.valueType==='NUMBER')return 1;
  if(def.valueType==='STRING_ARRAY'||def.valueType==='REFERENCE_ARRAY')return ['fixture'];
  if(def.valueType==='OBJECT')return {};
  const upper=String(name).toUpperCase();
  if(upper.includes('ARTIFACT_REQUIREMENTS'))return 'NONE';
  if(upper.includes('DETERMINATION'))return 'SATISFIED';
  if(upper.includes('INDEPENDENCE'))return 'INDEPENDENT';
  if(upper.includes('CONTAMINATION'))return 'NONE';
  if(upper.includes('SEVERITY'))return 'MINOR';
  if(upper.includes('STATUS'))return 'ACTIVE';
  if(upper.includes('APPLICABILITY'))return 'APPLICABLE';
  if(upper.includes('MANDATORY_OPTIONAL'))return 'MANDATORY';
  if(upper.includes('TEST_TYPE'))return 'DETERMINISTIC';
  if(upper.includes('EXPECTED_REJECTION'))return 'REJECT';
  if(upper.includes('ACTUAL_RESULT'))return 'SATISFIED';
  return `fixture-${String(name).toLowerCase()}`;
}
export function recordProposal(schema,collection,{tempKey,targetId,relationships={},overrides={},evidenceRef='evidence-1'}={}){
  const def=schema.RECORD_SCHEMAS[collection],fields=collection==='tests'?{VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:12,REQUIRED_BY_STAGE:12,PER_RUN_REQUIRED:true,FINAL_PRODUCT_REQUIRED:false,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{currentCandidate:true}}:{};
  for(const name of def.required){const fd=def.fieldDefinitions[name];if(fd?.producer===schema.PRODUCER.AGENT)fields[name]=scalarFor(fd,name,overrides);}
  for(const [name,value] of Object.entries(overrides))if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)fields[name]=value;
  return {tempKey:targetId?undefined:(tempKey||`${collection}-1`),targetId:targetId||undefined,fields,relationships,evidenceRefs:evidenceRef?[evidenceRef]:[]};
}
export function evidence(label='fixture'){return {temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:`${label} evidence`,location:'verify-full-cycle.mjs',content:`controlled ${label} evidence`};}

// Advance through real response acceptance to the first proposition-producing stage.
export function stage04AcceptanceFixture(runtime,jobId='JOB-BROWSER-PROOF-PERSISTENCE'){
  const {core,schema,engine,prompts,ingestion}=runtime;
  let p=core.createBlankState(jobId);
  Object.assign(p.job,{JOB_TITLE:'Response acceptance persistence',EXACT_USER_OBJECTIVE_VERBATIM:'Produce a verified checklist.',EXPLICIT_USER_REQUIREMENTS:'The checklist must contain the required verified content.',CURRENT_INPUT_VERSION:'INPUT-v001'});
  engine.ensureShape(p);engine.recalculate(p);
  function accept(stage,stageData){
    const pr=prompts.buildPromptRecord(stage,p,{operation:'COMPLETE'});p.projectData.generatedPrompts.push(pr);
    const envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData,records:{},evidence:[evidence(`stage-${stage}`)],unresolved:[],warnings:[],attachments:[]};
    const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(envelope),promptRecord:pr});
    if(!prepared.validation.valid)throw new Error(JSON.stringify(prepared.validation.issues));
    const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'BROWSER_FIXTURE'});p=committed.project;return committed;
  }
  const manifest=engine.intakeCoverageManifest(p),capture={schema:'closed-loop-stage01-capture/2',inputVersion:manifest.inputVersion,manifestSha256:manifest.manifestSha256,pass1Completed:true,pass2OmissionChallenge:{completed:true,checkedCategories:['QUALIFIERS','EXCEPTIONS','DEPENDENCIES','NEGATIVE_REQUIREMENTS','DO_NOT_CHANGE','VISUAL_CONSTRAINTS','TEMPORAL_CONSTRAINTS','ACCEPTANCE_CONDITIONS','AUTHORITY_STATEMENTS','TOOL_RESTRICTIONS','FILE_REFERENCES','OUTPUT_FORMAT_REQUIREMENTS','CORRECTIONS','LATER_OVERRIDES'],omissionsFound:[],omissionsResolved:true},units:manifest.units.map((u,i)=>({sourceUnitId:u.unitId,sourceRawValueSha256:u.rawValueSha256,disposition:'EXTRACTED_RELEVANT_INFORMATION',reason:'Preserved for downstream reuse.',extractedStatements:[{statementKey:`s-${i}`,text:u.rawValueText,statementClass:'REQUIREMENT'}]}))};
  const first=accept(1,{EXACT_DELIVERABLE_REQUESTED:'Verified checklist',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture)});
  engine.recordStageConfirmation(p,1,true,'Intent confirmed','BROWSER_FIXTURE',{acceptedChangeId:first.acceptedChange.changeId,inputVersion:p.job.CURRENT_INPUT_VERSION,instructionId:first.acceptedChange.promptId,contextSignature:first.acceptedChange.contextSignature,operatorLabel:'BROWSER_FIXTURE'});
  accept(2,{AUTHORITY_HIERARCHY:'No external authority applies.',SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE',KNOWN_CONTROLLING_SOURCES_EXAMINED:'Evidence-supported search found no applicable external governing source.'});
  accept(3,{EXCEPTIONS_AND_EDGE_CONDITIONS:'NONE',CONFLICTING_OR_INVALIDATING_MATERIAL:'NONE',RESEARCH_GAPS_AND_BLOCKERS:'NONE',SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:true,LATEST_PASS_NUMBER:1,NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:false});
  for(let n=1;n<=3;n++)if(!engine.gate(n,p).complete)throw new Error(`Fixture prerequisite ${n}: ${engine.gate(n,p).reasons.join(' | ')}`);
  p.activeStage=4;p.activeView='Workflow';return p;
}

export function stage04AcceptanceEnvelope(runtime,p,pr){
  const {schema,engine}=runtime,manifest=engine.obligationManifest(p),target=manifest.items.find(item=>item.text==='The checklist must contain the required verified content.');
  if(!target)throw new Error('The fixture lost its exact human requirement.');
  const records={requirements:[recordProposal(schema,'requirements',{tempKey:'req',overrides:{OBLIGATION:target.text,REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',USER_INPUT_RELATIONSHIP:target.obligationId,APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'Required content is present.',INTENDED_VERIFICATION_METHOD:'DETERMINISTIC_AND_INDEPENDENT_CONTENT_REVIEW',EXPECTED_EVIDENCE:'Canonical verification evidence',FAILURE_CONDITION:'Required content absent',SEVERITY:'MAJOR'}})],propositions:[recordProposal(schema,'propositions',{tempKey:'prop',relationships:{REQUIREMENT_ID:{tempKey:'req'}},overrides:{PROPOSITION_TEXT:target.text,SUBJECT_AND_SCOPE_DESCRIPTION:'The current checklist and requirement scope.',SATISFACTION_MEANING:'The required verified content is present.',FAILURE_MEANING:'The required verified content is absent.'}})]};
  const stageEvidence=[evidence('stage-4'),...manifest.items.filter(item=>item.obligationId!==target.obligationId).map((item,i)=>({temporaryKey:`context-${i}`,kind:'OBLIGATION_DISPOSITION',description:'Preserved fixture context',authorityType:'AGENT_CLAIM',location:'Stage 04 obligation accounting',content:JSON.stringify({obligationId:item.obligationId,disposition:'retained nonnormative context',reason:'Preserved descriptive context for this checklist fixture.'})}))];
  return {schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage:4,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},...(pr.transportBindingRequired?{packageId:pr.packageId,operationReservationId:pr.operationReservationId,challengeNonce:pr.challengeNonce}:{}),scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records,evidence:stageEvidence,unresolved:[],warnings:[],attachments:[]};
}

// Isolated downstream fixtures supply their authored prerequisites directly.
// Import the review through production ingestion so those fixtures cannot use
// a bare author/raw ID as proof authority. The full-cycle test also authors the
// complete suite through production ingestion and checks every prerequisite.
export function reviewProofFixture(runtime,project){
 const {engine,prompts,ingestion,schema}=runtime;
 const priorStages=engine.clone(project.stages),author=engine.preparePromptContext(project,6,{operation:'COMPLETE'}),authorPrompt=prompts.buildPromptRecord(6,project,author.options);
 project.projectData.generatedPrompts.push(authorPrompt);
 project.projectData.acceptedChanges.push({changeId:'FIXTURE-AUTHORED-PROOF',stage:6,status:'COMMITTED',responseType:'DATA_PROPOSAL',operation:'COMPLETE',promptId:authorPrompt.instructionId,scope:authorPrompt.scope,source:'CONTROLLED_DOWNSTREAM_PREREQUISITE_FIXTURE'});
 const prepared=engine.preparePromptContext(project,6,{operation:'PROOF_REVIEW'}),prompt=prompts.buildPromptRecord(6,project,prepared.options);project.projectData.generatedPrompts.push(prompt);
 const envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:project.job.JOB_ID,stage:6,operation:'PROOF_REVIEW',promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},scope:prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{semanticReviews:[recordProposal(schema,'semanticReviews',{tempKey:'fixture-proof-review',overrides:{REVIEW_QUESTION:'Does the controlled prerequisite proof suffice?',FINDING:'The observation-backed proposition requires accepted current evidence of the exact proposition.',REASONING:'Every current required test and expression is included; no alternate weaker branch is permitted.',RESULT:'ACCEPTED'}})]},evidence:[evidence('downstream-fixture-proof-review')],unresolved:[],warnings:[],attachments:[]};
 const proposal=ingestion.prepare(project,{stage:6,text:JSON.stringify(envelope),promptRecord:prompt});if(!proposal.validation.valid)throw new Error('Fixture proof review failed intake: '+JSON.stringify(proposal.validation.issues));
 Object.assign(project,ingestion.commit(proposal.project,proposal.proposal.proposalId,{operator:'DOWNSTREAM_FIXTURE'}).project);
 // These focused tests retain their explicit, already-controlled prerequisites.
 project.stages=priorStages;
}
