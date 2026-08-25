import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion,store=globalThis.closedLoopProjectStore;
if(!core||!schema||!engine||!prompts||!ingestion||!store)throw new Error('Responsible-layer modules failed to load.');
const assert=(value,message)=>{if(!value)throw new Error(message);};
const record=(collection,stage,fields={},id)=>{const def=schema.RECORD_SCHEMAS[collection],recordId=id||`${def.prefix}-TEST`;return {id:recordId,stage,active:true,fields:{...fields,[def.idField]:recordId},...fields,[def.idField]:recordId};};
function project(jobId='JOB-FINAL-VERIFY'){
  const p=core.createBlankState(jobId);p.job.JOB_ID=jobId;p.job.JOB_TITLE='Final verification fixture';p.job.EXACT_USER_OBJECTIVE_VERBATIM='Synthetic implementation-verification project only.';p.job.CURRENT_INPUT_VERSION='INPUT-v001';engine.ensureShape(p);engine.recalculate(p);return p;
}
function prompt(p,stage){const r={...prompts.buildPromptRecord(stage,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(r);return r;}

assert(JSON.stringify(engine.STAGE_STATES)===JSON.stringify(['NOT STARTED','IN PROGRESS','BLOCKED','READY','COMPLETE']),'Stage tracker states changed.');
assert(JSON.stringify(engine.FORMAL_STATES)===JSON.stringify(['UNKNOWN','NONE','NOT APPLICABLE','TRUE','FALSE','SATISFIED','VIOLATED','UNDETERMINED','ACCEPTED','REJECTED','BLOCKED']),'Formal states changed.');
assert(core.STAGES.length===30&&!core.STAGES[30],'Stage 31 exists.');

{
  const p=project('JOB-BAD-REL'),stage=3,pr=prompt(p,stage);
  const e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,promptIdentity:{instructionId:pr.instructionId,sha256:pr.sha256},responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{research:[{tempKey:'research-1',fields:{PASS_NUMBER:1,EXACT_PORTION_EXAMINED:'Controlled source portion',FINDING_CLASSIFICATION:'FACT',SOURCE_EVIDENCE:'Controlled evidence'},relationships:{SOURCE_ID:{recordId:'SOURCE-DOES-NOT-EXIST'}},evidenceRefs:['evidence-1']}]},evidence:[{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:'Relationship validation fixture',location:'synthetic test',content:'controlled'}],unresolved:[],warnings:[],attachments:[]};
  const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});
  assert(!prepared.validation.valid&&prepared.validation.issues.some(x=>x.code==='UNRESOLVED_RELATIONSHIP'),'Invalid relationship was not rejected.');
  assert(prepared.project.projectData.research.length===0&&prepared.project.projectData.acceptedChanges.length===0,'Invalid relationship partially mutated canonical state.');
}

{
  let p=project('JOB-HUMAN-GATE'),stage=1,pr=prompt(p,stage);
  const e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,promptIdentity:{instructionId:pr.instructionId,sha256:pr.sha256},responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'question-1',question:'Which jurisdiction controls this job?',whyRequired:'Jurisdiction is human-authority input.',affectedStageFields:['EXACT_DELIVERABLE_REQUESTED'],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:true}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};
  const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});assert(prepared.validation.valid,'Valid clarification envelope rejected.');
  p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'}).project;engine.recalculate(p);
  assert(engine.unresolvedHumanRequests(p,1).length===1,'Blocking human question was not discoverable by the gate.');const humanGate=engine.gate(1,p);assert(humanGate.blocked===true,`Stage 01 gate returned blocked=${humanGate.blocked} with an unresolved blocking question.`);engine.recalculate(p);assert(p.stages[1].status==='BLOCKED',`Blocking human question left Stage 01 in ${p.stages[1].status}, not BLOCKED.`);
  const request=p.projectData.humanInputRequests.at(-1),before=p.job.CURRENT_INPUT_VERSION;
  p=ingestion.answerHumanInput(p,{[request.requestId]:'United States'},{operator:'VERIFY'}).project;
  assert(engine.unresolvedHumanRequests(p,1).length===0&&p.job.CURRENT_INPUT_VERSION!==before,'Human answer did not resolve question and version User Job Input.');
}

{
  const p=project('JOB-GATES');
  assert(!engine.gate(8,p).complete&&engine.gate(8,p).reasons.some(r=>/Stage 7|verification|accepted/i.test(r)),'Stage 08 can complete without prerequisite evidence.');
  for(let i=0;i<9;i++)p.projectData.runs.push(record('runs',11,{CONTEXT_ID:`CTX-${i}`,CONTAMINATION_CHECK:'NONE',CANDIDATE_ID:'CANDIDATE-X',COMPLETE_OUTPUT:'output'},`RUN-${i}`));
  assert(engine.gate(11,p).reasons.some(r=>/Exactly 10 independent runs/i.test(r)),'Stage 11 does not enforce exactly ten runs.');
  assert(!engine.gate(12,p).complete&&engine.gate(12,p).reasons.some(r=>/ten runs|coverage/i.test(r)),'Stage 12 verification matrix gate is bypassable.');
  assert(engine.convergenceMetrics(p).converged===false,'Run count/empty state incorrectly establishes convergence.');
  assert(!engine.gate(20,p).complete&&engine.gate(20,p).reasons.some(r=>/unchanged confirmation/i.test(r)),'Stage 20 does not require unchanged confirmation.');
}

{
  const p=project('JOB-INVALIDATION');
  p.stages[2].status='COMPLETE';p.stages[2].acceptedResponseIds=['RAW-1'];p.stages[3].status='COMPLETE';p.stages[3].acceptedResponseIds=['RAW-2'];
  const src=record('sources',2,{TITLE:'Synthetic independent source',ISSUING_ORGANIZATION_OR_AUTHOR:'Authority',SOURCE_TYPE:'OFFICIAL_STANDARD',PUBLICATION_ORIGIN:'Authority',URL_REFERENCE:'https://example.invalid/source',AUTHORITY_LEVEL:'PRIMARY',AUTHORITY_ROLE:'GOVERNING',RELEVANCE:'fixture',APPLICABLE_PORTIONS:'fixture',INSPECTION_STATUS:'INSPECTED',CURRENCY_STATUS:'CURRENT',SUPERSESSION_STATUS:'NOT SUPERSEDED',CONTROLLING_STATE:'CONTROLLING'},'SOURCE-TEST');
  const res=record('research',3,{PASS_NUMBER:1,EXACT_PORTION_EXAMINED:'portion',FINDING_CLASSIFICATION:'FACT',SOURCE_EVIDENCE:'evidence'},'RESEARCH-TEST');
  p.projectData.sources.push(src);p.projectData.research.push(res);p.release.authorization='AUTHORIZED';p.release.authorizedArtifactIds=['FILE-1'];
  engine.invalidateDownstream(p,1,'CHANGESET-VERIFY','Controlled upstream correction');
  assert(src.active===false&&src.invalidatedBy==='CHANGESET-VERIFY'&&res.active===false&&res.invalidatedBy==='CHANGESET-VERIFY','Dependent records were not invalidated.');
  assert(p.release.authorization==='NOT AUTHORIZED'&&p.release.authorizedArtifactIds.length===0,'Upstream invalidation did not revoke release authorization.');
}

{
  const p=project('JOB-IDENTITY');let threw=false;try{engine.verifyArtifactIdentity(p,[{artifactId:'A',name:'x.bin',size:3,sha256:'aaa'}],[{artifactId:'A',name:'x.bin',size:3,sha256:'aaa'}]);}catch{threw=true;}assert(threw,'Stage 28 ran before an ACCEPTED Stage 27 determination.');
  p.projectData.releaseRecords.push(record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-TEST'));
  const result=engine.verifyArtifactIdentity(p,[{artifactId:'A',name:'x.bin',size:3,sha256:'aaa'}],[{artifactId:'A',name:'x.bin',size:4,sha256:'bbb'}]);
  assert(result.length===1&&result[0].AUTHORIZATION==='NOT AUTHORIZED'&&p.release.authorization==='NOT AUTHORIZED','Mismatched release bytes were authorized.');
}

{
  const p=project('JOB-CHAIN');p.projectData.requirements.push(record('requirements',4,{OBLIGATION:'Synthetic mandatory requirement',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',USER_INPUT_RELATIONSHIP:'User Job Input',APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'observable',INTENDED_VERIFICATION_METHOD:'deterministic',EXPECTED_EVIDENCE:'evidence',FAILURE_CONDITION:'missing',SEVERITY:'MAJOR',STATUS:'ACTIVE'},'REQ-TEST'));
  const chains=engine.constructEvidenceChains(p);assert(chains.length===1&&chains[0].STATUS==='INCOMPLETE'&&chains[0].MISSING_LINKS.length>0,'Missing evidence links were fabricated as complete.');
}

{
  class MemoryStorage{constructor(){this.m=new Map();}getItem(k){return this.m.has(k)?this.m.get(k):null;}setItem(k,v){this.m.set(k,String(v));}removeItem(k){this.m.delete(k);}}
  const storage=new MemoryStorage(),priorProject=project('JOB-STORAGE'),prior=[priorProject];store.writeAll(prior,storage);const priorBytes=storage.getItem(store.STORE_KEY);
  const changed=JSON.parse(JSON.stringify(priorProject));changed.projectData.acceptedChanges.push({changeId:'ACCEPTED-TEST',stage:2,status:'COMMITTED'});
  globalThis.__closedLoopStorageFault='after-final-write';let failed=false;try{store.writeAll([changed],storage);}catch{failed=true;}finally{delete globalThis.__closedLoopStorageFault;}
  assert(failed&&storage.getItem(store.STORE_KEY)===priorBytes,'Storage failure during accepted-state persistence did not roll back exact prior state.');
}

// A quota-limited browser must not require duplicate full-payload transaction copies.
{
  class QuotaStorage{
    constructor(limit){this.limit=limit;this.m=new Map();}
    getItem(k){return this.m.has(k)?this.m.get(k):null;}
    removeItem(k){this.m.delete(k);}
    setItem(k,v){v=String(v);const next=new Map(this.m);next.set(k,v);const bytes=[...next].reduce((n,[key,value])=>n+key.length+value.length,0);if(bytes>this.limit){const e=new Error('The quota has been exceeded.');e.name='QuotaExceededError';throw e;}this.m=next;}
  }
  const initial=[project('JOB-MOBILE-QUOTA')],payload=JSON.stringify(initial),storage=new QuotaStorage(payload.length+store.STORE_KEY.length+512);
  store.writeAll(initial,storage);
  const changed=JSON.parse(JSON.stringify(initial));changed[0].job.JOB_TITLE='Quota-safe update';
  store.writeAll(changed,storage);
  assert(JSON.parse(storage.getItem(store.STORE_KEY))[0].job.JOB_TITLE==='Quota-safe update','Quota-safe canonical replacement failed.');
  assert(storage.getItem(store.TEMP_KEY)===null&&storage.getItem(store.BACKUP_KEY)===null,'Full-payload transaction copies remain in persistent storage.');
}

console.log(JSON.stringify({finalRequirementRegression:true,formalStates:true,noStage31:true,invalidRelationshipRejected:true,humanQuestionGate:true,stage8PrerequisiteGate:true,tenRunGate:true,verificationMatrixGate:true,convergenceStrict:true,unchangedConfirmationGate:true,downstreamInvalidation:true,preReleaseIdentityBlocked:true,identityMismatchBlocked:true,evidenceChainNoFabrication:true,acceptedStateStorageRollback:true,mobileQuotaSafePersistence:true},null,2));