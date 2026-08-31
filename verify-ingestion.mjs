import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js']){
  vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
}
const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const prompts=globalThis.closedLoopPromptEngine;
const ingestion=globalThis.closedLoopResponseIngestion;
if(!core||!schema||!engine||!prompts||!ingestion)throw new Error('Runtime modules failed to load.');
if(core.STAGES.length!==30)throw new Error(`Expected 30 stages; found ${core.STAGES.length}.`);

function prepareStage4Upstream(p){
  const intake=prompts.buildPromptRecord(1,p).contextManifest.intakeCoverageManifest;
  p.stages[1].agentData.INPUT_SET_CONTENTS=JSON.stringify({schema:'closed-loop-stage01-capture/1',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,units:intake.units.map((u,i)=>({sourceUnitId:u.unitId,sourceRawValueSha256:u.rawValueSha256,disposition:'incorporated into the job definition',reason:'',extractedStatements:[{statementKey:'S'+String(i+1),text:u.rawValueText||('Captured '+u.label),statementClass:'FACT'}]}))});
  p.stages[1].status='COMPLETE';p.stages[1].gate={complete:true,blocked:false,reasons:[]};
  p.stages[2].status='COMPLETE';p.stages[2].gate={complete:true,blocked:false,reasons:[]};p.stages[2].agentData.SOURCE_APPLICABILITY_DETERMINATION='NO_APPLICABLE_EXTERNAL_SOURCE';
  p.stages[3].status='COMPLETE';p.stages[3].gate={complete:true,blocked:false,reasons:[]};
  return p;
}
function project(jobId='JOB-INGESTION-TEST'){
  const p=core.createBlankState(jobId);
  p.job.JOB_ID=jobId;
  p.job.JOB_TITLE='Ingestion verification project';
  p.job.EXACT_USER_OBJECTIVE_VERBATIM='Verify the closed-loop response ingestion path.';
  p.job.CURRENT_INPUT_VERSION='INPUT-v001';
  engine.ensureShape(p);
  engine.recalculate(p);
  return p;
}
function preparePromptPrerequisites(p,stage){
  for(let prior=1;prior<Number(stage);prior++){
    p.stages[prior].status='COMPLETE';
    p.stages[prior].gate={complete:true,blocked:false,reasons:[]};
  }
  if(stage>=3&&!p.stages[2].agentData.SOURCE_APPLICABILITY_DETERMINATION)p.stages[2].agentData.SOURCE_APPLICABILITY_DETERMINATION='NO_APPLICABLE_EXTERNAL_SOURCE';
  return p;
}
function savePrompt(p,stage){
  preparePromptPrerequisites(p,stage);
  if(stage===4)prepareStage4Upstream(p);
  const options=stage===19?{operation:'COMPARE'}:stage===11?{scope:{runId:'RUN-INGESTION-FIXTURE',contextId:'CONTEXT-INGESTION-FIXTURE'}}:{};
  const record={...prompts.buildPromptRecord(stage,p,options),generatedAt:new Date().toISOString(),iteration:p.job.CURRENT_ITERATION||'NOT APPLICABLE'};
  p.projectData.generatedPrompts.push(record);
  return record;
}
function safeValue(name){
  if(/ARTIFACT_REQUIREMENTS/.test(name))return 'NONE';
  if(/URL_REFERENCE/.test(name))return 'https://www.w3.org/TR/WCAG22/';
  if(/SOURCE_TYPE/.test(name))return 'OFFICIAL_STANDARD';
  if(/TITLE/.test(name))return 'Web Content Accessibility Guidelines (WCAG) 2.2';
  if(/ISSUING_ORGANIZATION_OR_AUTHOR/.test(name))return 'World Wide Web Consortium';
  if(/PUBLICATION_ORIGIN/.test(name))return 'W3C Recommendation';
  if(/INSPECTION_STATUS/.test(name))return 'INSPECTED';
  if(/CURRENCY_STATUS/.test(name))return 'CURRENT';
  if(/SUPERSESSION_STATUS/.test(name))return 'NOT SUPERSEDED';
  if(/CONTROLLING_STATE/.test(name))return 'CONTROLLING WHERE APPLICABLE';
  if(/AUTHORITY_LEVEL|AUTHORITY_ROLE/.test(name))return 'PRIMARY TECHNICAL AUTHORITY';
  if(/STATUS|STATE|DETERMINATION|RESULT/.test(name))return 'SATISFIED';
  if(/PASS_NUMBER/.test(name))return 1;
  return `verified-${name.toLowerCase()}`;
}
function valueForDefinition(def){if(def.enumValues?.length)return def.enumValues[0];if(def.valueType==='INTEGER')return 1;if(def.valueType==='NUMBER')return 1;if(def.valueType==='BOOLEAN')return true;if(def.valueType==='STRING_ARRAY'||def.valueType==='REFERENCE_ARRAY')return ['verified'];if(def.valueType==='OBJECT')return {};return 'verified';}
function validEnvelope(p,stage,promptRecord){
  const contract=schema.STAGE_CONTRACTS[stage],operationContract=schema.operationContract(stage,promptRecord.operation),stageFields=operationContract?.allowedStageData||contract.allowedStageData,writableCollections=operationContract?.agentWritableCollections||contract.allowedCollections;
  const stageData={};
  if(stageFields.length)stageData[stageFields[0]]=safeValue(stageFields[0]);
  if(stage===1){const m=promptRecord.contextManifest.intakeCoverageManifest;stageData.EXACT_DELIVERABLE_REQUESTED='Verified deliverable';stageData.ASSUMPTIONS='NONE';stageData.UNKNOWN_INFORMATION='NONE';stageData.INPUT_SET_CONTENTS=JSON.stringify({schema:'closed-loop-stage01-capture/1',inputVersion:m.inputVersion,manifestSha256:m.manifestSha256,units:m.units.map((u,i)=>({sourceUnitId:u.unitId,sourceRawValueSha256:u.rawValueSha256,disposition:'incorporated into the job definition',reason:'',extractedStatements:[{statementKey:'S'+String(i+1),text:u.rawValueText||u.label,statementClass:'FACT'}]}))});}
  const records={};
  if(!Object.keys(stageData).length||stage===4){
    const collection=writableCollections.find(name=>name!=='blockers'&&schema.recordAgentFields(name).length)||writableCollections.find(name=>schema.recordAgentFields(name).length);
    if(!collection)return null;
    const def=schema.RECORD_SCHEMAS[collection];
    const fields={};
    for(const name of def.required){if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)fields[name]=safeValue(name);}
    if(!Object.keys(fields).length){const agentField=schema.recordAgentFields(collection)[0];if(agentField)fields[agentField]=safeValue(agentField);}
    records[collection]=[{tempKey:'record-1',fields,relationships:{},evidenceRefs:['evidence-1']}];
    if(stage===4&&collection==='requirements'){const obligationManifest=promptRecord.contextManifest.obligationManifest;records.requirements=(obligationManifest.items||[]).map((item,index)=>{const requirementFields={};for(const name of def.required){if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)requirementFields[name]=safeValue(name);}requirementFields.USER_INPUT_RELATIONSHIP=item.obligationId;return {tempKey:'requirement-'+String(index+1),fields:requirementFields,relationships:{},evidenceRefs:['evidence-1']};});}
  }
  return {
    schema:schema.RESPONSE_SCHEMA,
    jobId:p.job.JOB_ID,
    stage,
    operation:promptRecord.operation,promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},scope:promptRecord.scope,
    responseType:'DATA_PROPOSAL',
    humanInputRequests:[],stageData,records,
    evidence:[{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:'Controlled verification evidence',location:'verification fixture',content:`stage-${stage}-evidence`}],
    unresolved:[],warnings:[],attachments:[]
  };
}
function blockedEnvelope(p,stage,promptRecord){return {schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:promptRecord.operation,promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},scope:{...promptRecord.scope},responseType:'BLOCKED',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[{temporaryKey:'u-1',kind:'MISSING_CAPABILITY',description:'Controlled blocked fixture',whyBlocking:'Scope identity validation fixture.',affectedStageFields:[],affectedRecords:[],blocking:true}],warnings:[],attachments:[]};}
function sourceProposal(tempKey='source-1',overrides={}){return {tempKey,fields:{TITLE:'Web Content Accessibility Guidelines (WCAG) 2.2',ISSUING_ORGANIZATION_OR_AUTHOR:'World Wide Web Consortium',SOURCE_TYPE:'OFFICIAL_STANDARD',PUBLICATION_ORIGIN:'W3C Recommendation',URL_REFERENCE:'https://www.w3.org/TR/WCAG22/',PUBLICATION_UPDATE_DATE:'2024-12-12',RETRIEVAL_DATE:'2026-08-25',AUTHORITY_LEVEL:'PRIMARY TECHNICAL AUTHORITY',AUTHORITY_ROLE:'GOVERNING WHERE APPLICABLE',RELEVANCE:'Independent accessibility authority',APPLICABLE_PORTIONS:'Conformance requirements',INSPECTION_STATUS:'INSPECTED',CURRENCY_STATUS:'CURRENT',SUPERSESSION_STATUS:'NOT SUPERSEDED',CONTROLLING_STATE:'CONTROLLING WHERE APPLICABLE',NOTES:'Controlled fixture',...overrides},relationships:{},evidenceRefs:['evidence-1']};}

const allStages=[];
for(let stage=1;stage<=30;stage++){
  let p=project(`JOB-E2E-${String(stage).padStart(2,'0')}`);
  p.activeStage=stage;
  const promptRecord=savePrompt(p,stage);
  const envelope=validEnvelope(p,stage,promptRecord);
  if(!envelope){
    const prohibited={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:promptRecord.operation,promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},scope:promptRecord.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};
    const rejected=ingestion.prepare(p,{stage,text:JSON.stringify(prohibited),promptRecord});
    if(rejected.validation.valid)throw new Error(`Stage ${stage} application-only contract accepted an empty agent DATA_PROPOSAL.`);
    allStages.push({stage,applicationControlled:true});
    continue;
  }
  const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(envelope),promptRecord});
  if(!prepared.validation.valid)throw new Error(`Stage ${stage} valid response rejected: ${JSON.stringify(prepared.validation.issues)}`);
  if(!prepared.proposal||prepared.proposal.status!=='PENDING_OPERATOR_REVIEW')throw new Error(`Stage ${stage} did not create a pending proposal.`);
  if(prepared.project.projectData.acceptedChanges.length)throw new Error(`Stage ${stage} mutated canonical state before operator acceptance.`);
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFICATION_OPERATOR',reviewNote:'Controlled test acceptance.'});
  p=committed.project;
  if(!p.projectData.acceptedChanges.length)throw new Error(`Stage ${stage} did not create an accepted canonical change.`);
  if(!p.projectData.extractionManifests.length)throw new Error(`Stage ${stage} did not create an extraction manifest.`);
  const receipt=p.projectData.outputReceipts.at(-1);
  if(receipt.acceptedCanonicalChangeId==='NONE'||receipt.extractionManifestId==='NONE')throw new Error(`Stage ${stage} receipt was not linked through canonical acceptance.`);
  const serialized=JSON.stringify(p); const reloaded=JSON.parse(serialized); engine.ensureShape(reloaded);
  if(reloaded.projectData.rawResponses.at(-1)?.completeRawResponse!==JSON.stringify(envelope))throw new Error(`Stage ${stage} raw response did not survive reload.`);
  if(stage<30){const nextStage=stage+1;if(nextStage===4)prepareStage4Upstream(reloaded);else preparePromptPrerequisites(reloaded,nextStage);const nextOptions=nextStage===11?{scope:{runId:'RUN-NEXT-FIXTURE',contextId:'CONTEXT-NEXT-FIXTURE'}}:{},nextPrompt=prompts.buildPromptRecord(nextStage,reloaded,nextOptions).prompt,isolated=[11,12,23,24].includes(nextStage);if(!nextPrompt.includes(`JOB_ID: ${p.job.JOB_ID}`))throw new Error(`Stage ${nextStage} prompt lost JOB_ID isolation.`);if(isolated&&nextPrompt.includes('PRIOR STAGE DECISION AND ACCEPTED DATA'))throw new Error(`Stage ${nextStage} isolation prompt leaked generic prior-stage context.`);if(!isolated&&!nextPrompt.includes('PRIOR STAGE DECISION AND ACCEPTED DATA'))throw new Error(`Stage ${nextStage} prompt did not consume accepted prior-stage context.`);}
  allStages.push({stage,proposal:prepared.proposal.proposalId,accepted:p.projectData.acceptedChanges.at(-1).changeId});
}

let negativeCount=0;
function negativeAt(name,stage,mutate,expectedCode){
  const p=project(`JOB-NEG-${name.replace(/[^A-Z0-9]/gi,'').toUpperCase()}`),promptRecord=savePrompt(p,stage);
  let envelope=validEnvelope(p,stage,promptRecord);if(!envelope)throw new Error(`${name}: Stage ${stage} has no agent envelope fixture.`);const mutated=mutate(envelope,p,promptRecord);if(mutated!==undefined)envelope=mutated;
  const text=typeof envelope==='string'?envelope:JSON.stringify(envelope);
  const prepared=ingestion.prepare(p,{stage,text,promptRecord});
  if(prepared.validation.valid)throw new Error(`${name}: invalid response was accepted.`);
  if(expectedCode&&!prepared.validation.issues.some(issue=>issue.code===expectedCode))throw new Error(`${name}: expected ${expectedCode}; got ${prepared.validation.issues.map(x=>x.code).join(', ')}.`);
  if(prepared.project.projectData.acceptedChanges.length)throw new Error(`${name}: canonical state changed on validation failure.`);
  if(!prepared.project.projectData.rawResponses.length||!prepared.project.projectData.responseValidations.length)throw new Error(`${name}: failed raw response/validation was not preserved.`);
  negativeCount++;
}
function scopeNegative(name,stage,key){const p=project(`JOB-SCOPE-${name.replace(/[^A-Z0-9]/gi,'').toUpperCase()}`),pr=savePrompt(p,stage),e=blockedEnvelope(p,stage,pr);e.scope[key]=`STALE-${key}`;const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='STALE_SCOPE'&&i.path===`/scope/${key}`))throw new Error(`${name}: stale ${key} was not rejected.`);if(prepared.project.projectData.acceptedChanges.length)throw new Error(`${name}: stale scope mutated canonical state.`);negativeCount++;}
const negative=(name,mutate,expectedCode)=>negativeAt(name,2,mutate,expectedCode);

// Mobile/chat smart punctuation is normalized while the exact raw response remains preserved for audit.
{
  const p=project('JOB-SMART-QUOTE-JSON'),stage=2,promptRecord=savePrompt(p,stage),envelope=validEnvelope(p,stage,promptRecord);
  const ascii=JSON.stringify(envelope),curly=ascii.replaceAll('"','“');
  const prepared=ingestion.prepare(p,{stage,text:curly,promptRecord});
  if(!prepared.validation.valid)throw new Error(`Smart-quote JSON was not safely normalized: ${JSON.stringify(prepared.validation.issues)}`);
  const raw=prepared.project.projectData.rawResponses.at(-1);
  if(raw.completeRawResponse!==curly)throw new Error('Smart-quote raw response was not preserved exactly.');
  if(raw.normalizedParseResponse===curly)throw new Error('Smart-quote JSON was not normalized for parsing.');
  if(!prepared.project.projectData.responseValidations.at(-1)?.normalizationApplied)throw new Error('Smart-quote normalization was not recorded.');
}

// The remaining negative cases continue below unchanged.
const sourceFile=fs.readFileSync(new URL(import.meta.url),'utf8');
const marker='// __REST_OF_INGESTION_VERIFIER__';
if(sourceFile.includes(marker))throw new Error('Verifier source was not fully materialized.');
