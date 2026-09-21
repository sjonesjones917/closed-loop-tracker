import {createVerifierRuntime} from './verifier-runtime.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {stage04AcceptanceFixture,stage04AcceptanceEnvelope,recordProposal,evidence} from './test-fixtures.mjs';

const intakeFault=process.argv.find(arg=>arg.startsWith('--fault='))?.slice(8)||null;
if(intakeFault)assert.ok(['raw-json-copy','validation-json-copy'].includes(intakeFault),'Unknown intake allocation fault');

// Run in a bounded heap so another whole-project JSON round trip cannot hide
// behind the much larger memory allowance of a developer workstation.
if(!process.argv.includes('--bounded-heap')){
  const result=spawnSync(process.execPath,['--max-old-space-size=512','--expose-gc',import.meta.filename,'--bounded-heap',...(intakeFault?['--fault='+intakeFault]:[])],{encoding:'utf8',timeout:120000});
  assert.equal(result.status,0,`Large proposal acceptance failed:\n${result.stdout}\n${result.stderr}`);
  process.stdout.write(result.stdout);
  if(!intakeFault)for(const fault of ['raw-json-copy','validation-json-copy']){
    const broken=spawnSync(process.execPath,['--max-old-space-size=512','--expose-gc',import.meta.filename,'--bounded-heap','--fault='+fault],{encoding:'utf8',timeout:120000});
    assert.notEqual(broken.status,0,'Intake allocation fault went undetected: '+fault);
    assert.match(broken.stderr,/INTAKE_HISTORY_ALLOCATION_ORACLE/,'The intake fault failed for an unrelated reason');
    console.log(JSON.stringify({caseId:'INTAKE-PRESERVED-HISTORY-BOUNDARY',fault,result:'DETECTED',sourceMutation:false,command:['node','--max-old-space-size=512','--expose-gc','verify-proposal-acceptance-memory.mjs','--bounded-heap','--fault='+fault],exitCode:broken.status,stdout:broken.stdout,stderr:broken.stderr}));
  }
}else{
  globalThis.dispatchEvent=()=>true;
  for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js']){
    let source=fs.readFileSync(file,'utf8');
    if(file==='response-ingestion.js'&&intakeFault){
      const owner=intakeFault==='raw-json-copy'?'captureRaw':'prepareCaptured',start=source.indexOf('function '+owner+'('),end=source.indexOf('\nfunction ',start+1),body=source.slice(start,end),before="const next=typeof structuredClone==='function'?structuredClone(project):clone(project);";
      assert.equal(body.split(before).length-1,1,'The intake fault must resolve to exactly one owning copy boundary');
      source=source.slice(0,start)+body.replace(before,'const next=clone(project);')+source.slice(end);
    }
    createVerifierRuntime.loadScript(globalThis,source,{filename:file});
  }
  const core=closedLoopCore,schema=closedLoopWorkflowSchema,engine=closedLoopWorkflowEngine,prompts=closedLoopPromptEngine,ingestion=closedLoopResponseIngestion,hash=closedLoopHash;
  const runtime={core,schema,engine,prompts,ingestion};
  let project=stage04AcceptanceFixture(runtime,'JOB-LARGE-STAGE5-REGRESSION');
  function stageResponse(stage,content){
    const operation=stage===5&&project.projectData.applicabilityRecords.length?'SEMANTIC_REVIEW':'COMPLETE';
    const prompt=prompts.reserveAndBuildPromptRecord(project,stage,{operation}).prompt;
    const envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:project.job.JOB_ID,stage,operation:prompt.operation,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce,scope:prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{},evidence:[evidence('acceptance-memory')],unresolved:[],warnings:[],attachments:[],...content(prompt)};
    const prepared=ingestion.prepare(project,{stage,promptRecord:prompt,text:JSON.stringify(envelope),transport:{authority:'NONAUTHORITATIVE_TEXT_FALLBACK',materializedAsResponseFile:true,packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce,promptIdentity:envelope.promptIdentity}});
    assert.equal(prepared.validation.valid,true,JSON.stringify(prepared.validation.issues));
    project=prepared.project;return prepared.proposal;
  }
  let proposal=stageResponse(4,prompt=>stage04AcceptanceEnvelope(runtime,project,prompt));
  project=ingestion.commit(project,proposal.proposalId).project;
  const propositionId=engine.recordId(engine.recordsForCurrentScope(project,'propositions')[0],'propositions');
  proposal=stageResponse(5,()=>({stageData:{DUPLICATES_REMAINING:'NONE',IMPOSSIBLE_COMBINATIONS:'NONE',UNDEFINED_TERMS:'NONE',CIRCULAR_DEPENDENCIES:'NONE',UNSUPPORTED_REQUIREMENTS:'NONE',APPLICABILITY_UNDETERMINED:'NONE',REQUIREMENTS_WITHOUT_VERIFICATION_PATH:'NONE'},records:{applicabilityRecords:[recordProposal(schema,'applicabilityRecords',{tempKey:'applicability',relationships:{SUBJECT_ID:{recordId:propositionId}},overrides:{PROPOSED_APPLICABILITY:'APPLICABLE',REASONING:'The checklist requirement applies.'}})]}}));
  project=ingestion.commit(project,proposal.proposalId).project;
  proposal=stageResponse(5,()=>({records:{semanticReviews:Array.from({length:249},(_,index)=>recordProposal(schema,'semanticReviews',{tempKey:`review-${index}`,overrides:{REVIEW_QUESTION:`Independent check ${index}`,FINDING:`Check ${index} preserves the requirement.`,REASONING:`Independent check ${index}: ${'preserved scope; '.repeat(80)}`,RESULT:'ACCEPTED'}}))}}));

  // Model accumulated preserved responses without adding any gating authority.
  // Distinct two-byte strings prevent string sharing from hiding copy costs.
  const history=Array.from({length:120},(_,index)=>({rawResponseId:`HISTORICAL-${index}`,stage:2,status:'PRESERVED',completeRawResponse:`${index}:`+String.fromCharCode(0x400+index).repeat(512*1024)}));
  project.projectData.rawResponses.push(...history);
  proposal=null;
  globalThis.gc();
  const proposalId=project.projectData.responseProposals.at(-1).proposalId;
  const before=hash.sha256Value(project);
  // Raw-first intake must leave the complete retained project untouched without
  // allocating an encoded copy of that entire history just to copy its objects.
  // This is the same bounded-heap workload as acceptance, including exact tails.
  const intakePrompt=project.projectData.generatedPrompts.at(-1);
  const intakeText='{"deliberatelyIncomplete":"unaccepted intake pressure"}';
  const nativeStringify=JSON.stringify;
  let projectRoundTrips=0,admitted=null,checked=null,admissionMs,validationMs;
  JSON.stringify=function(value,...args){
    if(value?.job?.JOB_ID===project.job.JOB_ID&&value?.projectData?.rawResponses?.length>=history.length){projectRoundTrips++;throw new Error('INTAKE_HISTORY_ALLOCATION_ORACLE: admission or validation attempted to encode the complete retained project');}
    return nativeStringify.call(JSON,value,...args);
  };
  try{
    const intakeStart=performance.now();
    admitted=ingestion.captureRaw(project,{stage:5,text:intakeText,promptRecord:intakePrompt});
    admissionMs=performance.now()-intakeStart;
    const validationStart=performance.now();
    checked=ingestion.prepareCaptured(admitted.project,{rawResponseId:admitted.rawRecord.rawResponseId});
    validationMs=performance.now()-validationStart;
  }finally{JSON.stringify=nativeStringify;}
  assert.equal(projectRoundTrips,0,'INTAKE_HISTORY_ALLOCATION_ORACLE: raw admission or validation encoded the whole retained project');
  assert(admissionMs<60000&&validationMs<60000,'INTAKE_HISTORY_DEADLINE_ORACLE: intake did not terminate within the supported bound');
  assert.equal(checked.validation.valid,false,'INTAKE_HISTORY_REJECTION_ORACLE: the deliberate invalid response was accepted');
  assert.equal(checked.rawRecord.completeRawResponse,intakeText);
  assert.equal(hash.sha256Value(project),before,'INTAKE_HISTORY_ISOLATION_ORACLE: intake changed its source project');
  assert.deepEqual(checked.project.projectData.rawResponses.slice(-121,-1),history,'INTAKE_HISTORY_BYTES_ORACLE: intake changed retained response bytes');
  checked.project.job.JOB_TITLE='Uncommitted intake candidate';
  checked.project.projectData.rawResponses.at(-2).completeRawResponse='Uncommitted historical mutation';
  assert.equal(hash.sha256Value(project),before,'INTAKE_HISTORY_ISOLATION_ORACLE: the candidate shares mutable retained objects with its source');
  assert.notEqual(admitted.project.projectData.rawResponses.at(-2).completeRawResponse,'Uncommitted historical mutation','INTAKE_HISTORY_ISOLATION_ORACLE: validation shares mutable history with its source');
  console.log(JSON.stringify({caseId:'INTAKE-PRESERVED-HISTORY-BOUNDARY',result:'PASS',synthetic:true,actualBrowser:false,heapLimitMiB:512,historyRecords:history.length,historyCharacters:history.reduce((total,row)=>total+row.completeRawResponse.length,0),projectRoundTrips,admissionMs,validationMs,deadlineMs:60000}));
  admitted=null;checked=null;globalThis.gc();

  const start=performance.now();
  let result=ingestion.commit(project,proposalId);
  assert.equal(result.project.projectData.responseProposals.at(-1).status,'ACCEPTED');
  assert.equal(hash.sha256Value(project),before,'Acceptance modified its input before persistence.');
  assert.equal(result.project.projectData.semanticReviews.filter(record=>record.sourceProposalId===proposalId).length,249);
  assert.equal(result.project.stages[5].status,'COMPLETE','The accepted independent review did not unlock Stage 6.');
  assert.equal(result.project.stages[6].gate.complete,false,'Accepting a review fabricated a verification suite.');
  assert.equal(prompts.buildPromptRecord(6,result.project,{operation:'COMPLETE'}).stage,6,'Stage 6 instruction generation failed.');
  assert.deepEqual(result.project.projectData.rawResponses.slice(-120),history,'Historical bytes changed.');
  const integrity=closedLoopProjectStore.validateProjectIntegrity(result.project,{verifyDerived:false});
  assert.equal(integrity.valid,true,JSON.stringify(integrity.issues));
  const acceptedChangeId=result.acceptedChange.changeId;
  // Release the candidate before the negative and retry checks; a real failed
  // transaction also discards its candidate rather than retaining every run.
  result=null;globalThis.gc();

  const originalRevision=project.revision;project.revision++;
  assert.throws(()=>ingestion.commit(project,proposalId),error=>error.code==='STALE_PROPOSAL');
  project.revision=originalRevision;globalThis.gc();
  assert.equal(hash.sha256Value(project),before,'Stale rejection modified canonical data.');
  const raw=ingestion.findRaw(project,project.projectData.responseProposals.at(-1).rawResponseId);
  project.projectData.rawResponses.push({...raw,rawResponseId:'DISTINCT-DUPLICATE'});
  assert.throws(()=>ingestion.commit(project,proposalId),error=>error.issues?.some(issue=>issue.code==='DUPLICATE_RESPONSE'));
  project.projectData.rawResponses.pop();globalThis.gc();
  assert.equal(hash.sha256Value(project),before,'Duplicate rejection modified canonical data.');
  console.log(JSON.stringify({proposalAcceptanceMemory:'PASS',heapLimitMiB:512,historicalPayloadMiB:120,reviewRecords:249,acceptedChangeId,originalUnchanged:true,staleAndDuplicateRejected:true,stage6Unlocked:true,elapsedMs:Math.round(performance.now()-start)}));
}
