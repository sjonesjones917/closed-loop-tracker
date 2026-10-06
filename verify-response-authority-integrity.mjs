import {createVerifierRuntime} from './verifier-runtime.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {recordProposal,evidence,stage04AcceptanceFixture,stage04AcceptanceEnvelope} from './test-fixtures.mjs';

// Synthetic canonical contexts isolate the production response boundary. This
// runs the actual prompt generator, parser, validator, proposal and commit code;
// it is not evidence of a full external-agent or physical-device journey.
const schemaSourcePath=process.argv.find(value=>value.startsWith('--authority-schema-source='))?.slice('--authority-schema-source='.length);
const schemaSource=fs.readFileSync(schemaSourcePath||new URL('./workflow-schema.js',import.meta.url),'utf8');
const engineSourcePath=process.argv.find(value=>value.startsWith('--authority-engine-source='))?.slice('--authority-engine-source='.length);
const engineSource=fs.readFileSync(engineSourcePath||new URL('./workflow-engine.js',import.meta.url),'utf8');
globalThis.dispatchEvent=()=>{};
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])createVerifierRuntime.loadScript(globalThis,file==='workflow-schema.js'?schemaSource:file==='workflow-engine.js'?engineSource:fs.readFileSync(new URL(file,import.meta.url),'utf8'),{filename:file});
const {closedLoopCore:core,closedLoopWorkflowSchema:schema,closedLoopWorkflowEngine:engine,closedLoopPromptEngine:prompts,closedLoopResponseIngestion:ingestion,closedLoopHash:hash}=globalThis;
const results=[],closedFamilyObservations=[];
async function check(name,operation){try{await operation();results.push({name,result:'PASS'});}catch(error){results.push({name,result:'FAIL',message:String(error.stack||error)});}}
function blindFixture(stage){
 const project=core.createBlankState('RESPONSE-AUTHORITY-'+stage);engine.ensureShape(project);project.job.EXACT_USER_OBJECTIVE_VERBATIM='Preserve literal returned observations and their exact source provenance.';engine.recalculate(project);
 for(let prior=1;prior<stage;prior++){project.stages[prior].status='COMPLETE';project.stages[prior].gate={complete:true};}
 Object.assign(project.job,{CURRENT_BASELINE_ID:'BASELINE-INTEGRITY',CURRENT_PRODUCT_ID:'PRODUCT-INTEGRITY',CURRENT_PRODUCT_VERSION:'PRODUCT-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TESTS-v001'});
 for(const [family,id,fields,owner] of [['products','PRODUCT-INTEGRITY',{PRODUCT_ID:'PRODUCT-INTEGRITY',BASELINE_ID:'BASELINE-INTEGRITY',PRODUCT_VERSION:'PRODUCT-v001'},21],['baselines','BASELINE-INTEGRITY',{BASELINE_ID:'BASELINE-INTEGRITY'},20],['freshContexts','CONTEXT-INTEGRITY',{CONTEXT_ID:'CONTEXT-INTEGRITY'},stage]]){
  const row={id,active:true,stage:owner,fields,completionState:'COMPLETED',scope:{productId:'PRODUCT-INTEGRITY',baselineId:'BASELINE-INTEGRITY',productVersion:'PRODUCT-v001'}};engine.refreshRecordHashes(row,family);project.projectData[family].push(row);
 }
 const prompt=prompts.buildPromptRecord(stage,project,{operation:'COMPLETE',scope:{contextId:'CONTEXT-INTEGRITY'}});project.projectData.generatedPrompts.push(prompt);
 const manifest=prompts.promptFileManifest(prompt),alias=prompt.contextManifest.blindAliasMap.find(entry=>entry.kind==='PRODUCT_ID')?.alias;assert.ok(alias,'Production prompt did not issue the blind alias.');
 const family=stage===23?'meaningResults':'adversarialResults',field=stage===23?'OBSERVED_MEANING':'ACTUAL_RESULT';
 const envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:project.job.JOB_ID,stage,operation:prompt.operation,promptIdentity:manifest.promptIdentity,scope:manifest.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],humanAuthorityCandidates:[],stageData:{},records:{[family]:[recordProposal(schema,family,{tempKey:'result',overrides:{[field]:alias},relationships:{PRODUCT_ID:{recordId:alias}}})]},evidence:[{...evidence('literal'),description:alias,content:alias,location:alias,notes:alias}],unresolved:[],warnings:[{code:'LITERAL_OBSERVATION',message:alias,path:'/evidence/0/content'}],attachments:[]};
 return {project,prompt,envelope,alias,family,field};
}
function prepare(fixture,envelope=fixture.envelope){const text=JSON.stringify(envelope),prepared=ingestion.prepare(fixture.project,{stage:envelope.stage,promptRecord:fixture.prompt,text});assert.equal(prepared.validation.valid,true,JSON.stringify(prepared.validation.issues));assert.equal(prepared.rawRecord.completeRawResponse,text);assert.equal(prepared.rawRecord.sha256,hash.sha256Text(text));return prepared;}
function rejectClosedFamilyInput(fixture,kind,value){
 const envelope=structuredClone(fixture.envelope);
 if(kind==='record-family')envelope.records=JSON.parse(JSON.stringify({[value]:[{tempKey:'unknown-family',fields:{TITLE:'Undeclared family'},relationships:{},evidenceRefs:[]}]}));
 else envelope.humanAuthorityCandidates=[{temporaryKey:'candidate',label:'Malformed decision identity',value:false,authorityClass:'HUMAN',claimedConversationBasis:'Synthetic boundary input',externalResponsePointer:'/humanAuthorityCandidates/0',affectedStageFields:[],affectedRecords:[],targetFamily:value}];
 const text=JSON.stringify(envelope),captured=ingestion.captureRaw(fixture.project,{stage:envelope.stage,promptRecord:fixture.prompt,text}),prepared=ingestion.prepareCaptured(captured.project,{rawResponseId:captured.rawRecord.rawResponseId}),code=kind==='record-family'?'UNKNOWN_COLLECTION':'WRONG_VALUE_TYPE',path=kind==='record-family'?'/records/'+value:'/humanAuthorityCandidates/0/targetFamily';
 assert.equal(prepared.validation.valid,false);assert.equal(prepared.proposal,null);assert.ok(prepared.validation.issues.some(row=>row.code===code&&row.path===path),JSON.stringify(prepared.validation.issues));assert.equal(prepared.rawRecord.completeRawResponse,text);assert.equal(prepared.rawRecord.status,'VALIDATION_FAILED');assert.equal(prepared.project.projectData.acceptedChanges.length,fixture.project.projectData.acceptedChanges.length);
 closedFamilyObservations.push({stage:envelope.stage,blindAliases:fixture.prompt.contextManifest.blindAliasMap.length>0,kind,case:kind==='record-family'?value:Array.isArray(value)?'hostile-array':'hostile-object',code,rawPreserved:true,noProposal:true});
}
for(const stage of [23,24]){
 const fixture=blindFixture(stage),{alias,family,field}=fixture;
 for(const family of ['constructor','toString','__proto__'])await check(`Stage ${stage}: inherited record family ${family} is rejected before blind remapping`,()=>rejectClosedFamilyInput(fixture,'record-family',family));
 for(const value of [{toString:null,valueOf:null},[{toString:null,valueOf:null}]])await check(`Stage ${stage}: malformed ${Array.isArray(value)?'array':'object'} candidate family survives blind remapping for typed rejection`,()=>rejectClosedFamilyInput(fixture,'candidate-family',value));
 await check(`Stage ${stage}: literal canonical observation retains alias-looking text`,()=>{const prepared=prepare(fixture);assert.equal(prepared.proposal.canonicalRecords[family][0].fields[field],alias);});
 await check(`Stage ${stage}: typed relationship alone resolves the blind reference`,()=>{const prepared=prepare(fixture);assert.equal(prepared.proposal.canonicalRecords[family][0].relationships.PRODUCT_ID,'PRODUCT-INTEGRITY');assert.equal(prepared.proposal.envelope.scope.productId,'PRODUCT-INTEGRITY');assert.equal(prepared.proposal.envelope.records[family][0].relationships.PRODUCT_ID.recordId,'PRODUCT-INTEGRITY');});
 for(const key of ['description','content','location','notes'])await check(`Stage ${stage}: evidence ${key} is literal data`,()=>{const prepared=prepare(fixture);assert.equal(prepared.proposal.envelope.evidence[0][key],alias);});
 await check(`Stage ${stage}: warning messages are not reference slots`,()=>{assert.equal(prepare(fixture).proposal.warnings[0].message,alias);});
 await check(`Stage ${stage}: human-reported nested values cannot be rewritten`,()=>{const envelope=structuredClone(fixture.envelope);envelope.humanAuthorityCandidates=[{temporaryKey:'candidate',label:'Literal answer',value:{value:alias,list:[alias,{text:alias}]},authorityClass:'HUMAN',claimedConversationBasis:'A synthetic reported answer, not confirmed human authority.',externalResponsePointer:'/humanAuthorityCandidates/0/value',affectedStageFields:[],affectedRecords:[]}];assert.deepEqual(prepare(fixture,envelope).proposal.humanAuthorityCandidates[0].value,envelope.humanAuthorityCandidates[0].value);});
 await check(`Stage ${stage}: blocked reason is not changed to canonical identity`,()=>{const envelope=structuredClone(fixture.envelope);envelope.responseType='BLOCKED';envelope.records={};envelope.unresolved=[{temporaryKey:'blocker',kind:'MISSING_EVIDENCE',description:alias,whyBlocking:alias,affectedStageFields:[],affectedRecords:[],blocking:true}];const prepared=prepare(fixture,envelope);assert.equal(prepared.proposal.unresolved[0].description,alias);assert.equal(prepared.proposal.unresolved[0].whyBlocking,alias);});
 await check(`Stage ${stage}: temporary response keys are never canonicalized`,()=>{const envelope=structuredClone(fixture.envelope);envelope.records[family][0].tempKey=alias;assert.equal(prepare(fixture,envelope).proposal.canonicalRecords[family][0].temporaryKey,alias);});
 await check(`Stage ${stage}: unchanged observations have exact source hashes and no normalizer`,()=>{const prepared=prepare(fixture),pointer=`/records/${family}/0/fields/${field}`,entry=prepared.proposal.changes.find(row=>row.jsonPointer===pointer);assert.ok(entry);assert.equal(entry.rawValueHash,hash.sha256Value(alias));assert.equal(entry.normalizerUsed,null);assert.equal(entry.origin,'AGENT_VALUE');assert.equal(entry.normalizedValue,alias);});
 await check(`Stage ${stage}: reference provenance hashes the raw alias object`,()=>{const prepared=prepare(fixture),pointer=`/records/${family}/0/relationships/PRODUCT_ID`,entry=prepared.proposal.changes.find(row=>row.jsonPointer===pointer);assert.ok(entry);assert.equal(entry.rawValueHash,hash.sha256Value({recordId:alias}));assert.equal(entry.normalizedValue,'PRODUCT-INTEGRITY');assert.equal(entry.origin,'APPLICATION_RELATIONSHIP_RESOLUTION');});
 await check(`Stage ${stage}: accepted records and extraction manifest preserve literal meaning`,()=>{const prepared=prepare(fixture),committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'SYNTHETIC_BOUNDARY_TEST'});const record=committed.project.projectData[family].find(row=>row.sourceProposalId===prepared.proposal.proposalId);assert.equal(record.fields[field],alias);const mapping=committed.manifest.entries.find(row=>row.jsonPointer===`/records/${family}/0/fields/${field}`);assert.equal(mapping.rawValueHash,hash.sha256Value(alias));assert.equal(mapping.normalizedValue,alias);assert.equal(mapping.normalizerUsed,null);});
}
// Specification 16.1 and 38.1: proposition meaning is agent-authored, while
// proposition timing is application-owned, including after reload/restoration.
const timingAssignments={VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:12,REQUIRED_BY_STAGE:12,PER_RUN_REQUIRED:true,FINAL_PRODUCT_REQUIRED:false,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{type:'PHASE_TARGET'},TIMING_ENTRIES:[],TIMING_SCHEDULE_SHA256:'a'.repeat(64)};
const runtime={core,schema,engine,prompts,ingestion,hash};
function loadAuthorityRuntime(source,engineSource=fs.readFileSync(new URL('./workflow-engine.js',import.meta.url),'utf8')){
 const context=createVerifierRuntime({console,dispatchEvent(){},Event:function Event(type){this.type=type;}});
 for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])createVerifierRuntime.loadScript(context,file==='workflow-schema.js'?source:file==='workflow-engine.js'?engineSource:fs.readFileSync(new URL(file,import.meta.url),'utf8'),{filename:file});
 return {core:context.closedLoopCore,schema:context.closedLoopWorkflowSchema,engine:context.closedLoopWorkflowEngine,prompts:context.closedLoopPromptEngine,ingestion:context.closedLoopResponseIngestion,hash:context.closedLoopHash};
}
function timingFixture(api,label){
 const project=stage04AcceptanceFixture(api,label),options=api.engine.preparePromptContext(project,4,{operation:'COMPLETE'}).options,prompt=api.prompts.buildPromptRecord(4,project,options);project.projectData.generatedPrompts.push(prompt);
 return {project,prompt,envelope:stage04AcceptanceEnvelope(api,project,prompt)};
}
function prepareTiming(api,fixture,envelope=fixture.envelope){return api.ingestion.prepare(fixture.project,{stage:4,promptRecord:fixture.prompt,text:JSON.stringify(envelope)});}
function assertTimingRejected(api,fixture,field){
 const envelope=structuredClone(fixture.envelope);envelope.records.propositions[0].fields[field]=timingAssignments[field];
 const before=api.hash.sha256Value(fixture.project),prepared=prepareTiming(api,fixture,envelope),path='/records/propositions/0/fields/'+field;
 assert.equal(prepared.validation.valid,false,'An agent assigned application-owned proposition timing: '+field);
 assert.ok(prepared.validation.issues.some(issue=>['FIELD_OWNERSHIP_VIOLATION','UNKNOWN_RECORD_FIELD'].includes(issue.code)&&issue.path===path),JSON.stringify(prepared.validation.issues));
 assert.equal(api.hash.sha256Value(fixture.project),before,'Rejecting an invalid response changed accepted project state.');
 return {accepted:prepared.validation.valid,field,path,issues:JSON.parse(JSON.stringify(prepared.validation.issues.filter(issue=>issue.path===path))),acceptedStateUnchanged:api.hash.sha256Value(fixture.project)===before};
}
function assertOwnershipViews(api){
 const owners={AGENT:'agent',APPLICATION:'application',HUMAN:'human',HUMAN_DECISION:'humanDecision'};
 for(const [family,definition] of Object.entries(api.RECORD_SCHEMAS))for(const field of definition.fields){
  const expected=owners[definition.fieldDefinitions[field].producer];
  for(const partition of [definition.ownership,api.RECORD_OWNERSHIP[family],api.DURABLE_OBJECT_REGISTRY[family].producerPartitions])assert.deepEqual(Object.entries(partition||{}).filter(([,fields])=>fields.includes(field)).map(([owner])=>owner),[expected],family+'.'+field+' has inconsistent ownership.');
 }
}
function assertSavedTimingBlocked(api,project,field){
 const restored=JSON.parse(JSON.stringify(project)),raw=restored.projectData.rawResponses.map(record=>record.completeRawResponse),gate=api.engine.gate(4,restored);
 assert.ok(gate.reasons.some(reason=>reason.includes('propositions.'+field)&&/application-owned|unregistered-owned/.test(reason)),'Previously accepted agent timing was not identified as invalid current authority.');
 assert.equal(gate.complete,false);assert.deepEqual(restored.projectData.rawResponses.map(record=>record.completeRawResponse),raw,'Inspecting restored authority rewrote original evidence.');
}
function timingSourceWithAgentField(source,field=null){
 const shared=source.indexOf("for(const family of ['propositions','proofObligations'])RS[family]=extend(RS[family],"),start=shared>=0?shared:source.indexOf('RS.propositions=extend(RS.propositions,'),end=source.indexOf(';',start);
 assert.ok(start>=0&&end>start,'The proposition timing authority fault anchor is missing.');
 const original=source.slice(start,end+1).replace("for(const family of ['propositions','proofObligations'])RS[family]=extend(RS[family],",'RS.proofObligations=extend(RS.proofObligations,'),defs={...timingAssignments};
 const additions=Object.entries(defs).map(([name])=>`${JSON.stringify(name)}:{...(RS.propositions.fieldDefinitions[${JSON.stringify(name)}]||TIMING_FIELD_DEFS[${JSON.stringify(name)}]||{}),producer:${!field?"'AGENT'":JSON.stringify(name===field?'AGENT':'APPLICATION')},owner:${!field?"'agent'":JSON.stringify(name===field?'agent':'application')},...( ${JSON.stringify(name)}==='TIMING_ENTRIES'?{valueType:'OBJECT_ARRAY'}:{})}`).join(',');
 return source.slice(0,start)+original+`RS.propositions=extend(RS.propositions,{${additions}});`+source.slice(end+1);
}
const currentTiming=timingFixture(runtime,'PROPOSITION-TIMING-AUTHORITY');
for(const family of ['constructor','toString','__proto__'])await check(`Ordinary Stage 4: inherited record family ${family} is rejected`,()=>rejectClosedFamilyInput(currentTiming,'record-family',family));
for(const value of [{toString:null,valueOf:null},[{toString:null,valueOf:null}]])await check(`Ordinary Stage 4: malformed ${Array.isArray(value)?'array':'object'} candidate family is rejected`,()=>rejectClosedFamilyInput(currentTiming,'candidate-family',value));
await check('TIMING-SEMANTIC-CONTROL: permitted proposition meaning still validates and commits',()=>{
 const prepared=prepareTiming(runtime,currentTiming);assert.equal(prepared.validation.valid,true,JSON.stringify(prepared.validation.issues));
 const accepted=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'SYNTHETIC_AUTHORITY_TEST'}),record=engine.recordsForCurrentScope(accepted.project,'propositions')[0];
 assert.equal(engine.recordValue(record,'PROPOSITION_TEXT'),currentTiming.envelope.records.propositions[0].fields.PROPOSITION_TEXT);
});
const verificationObservations=[];
verificationObservations.push({checkId:'RESPONSE-CLOSED-FAMILY-BOUNDARY',boundary:'Actual production generated blind Stage23/24 and ordinary Stage4 instructions; exact JSON capture/prepare/diagnostic/raw preservation. Synthetic canonical prerequisites and legacy in-memory transport; no browser, staged file, storage reload or external-agent claim.',expected:{rejected:15,blindRejected:10,ordinaryRejected:5,rawPreserved:true,noProposal:true},observed:{rejected:closedFamilyObservations.length,blindRejected:closedFamilyObservations.filter(row=>row.blindAliases).length,ordinaryRejected:closedFamilyObservations.filter(row=>!row.blindAliases).length,rawPreserved:closedFamilyObservations.every(row=>row.rawPreserved),noProposal:closedFamilyObservations.every(row=>row.noProposal)},passed:closedFamilyObservations.length===15});
for(const field of Object.keys(timingAssignments))await check('TIMING-REJECT-'+field,()=>{const observed=assertTimingRejected(runtime,currentTiming,field);verificationObservations.push({checkId:'PRODUCER-TIMING-REJECT-'+field,requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:132'],boundary:'Production response ingestion rejects agent assignment of application-owned proposition timing',expected:{accepted:false,field,acceptedStateUnchanged:true},observed,passed:true,violation:'externalApplicationOwnedFieldMutation',accepted:false});});
await check('TIMING-PROMPT-CONTRACT: every proposition-writing operation excludes application-owned timing',()=>{
 const operations=Object.values(schema.STAGE_OPERATION_REGISTRY).filter(operation=>operation.acceptsExternalResponse&&operation.agentWritableCollections.includes('propositions'));assert.ok(operations.length);
 const actual=[];
 for(const operation of operations){const descriptor=prompts.responseContractDescriptor(operation.stage,operation.operation);for(const field of Object.keys(timingAssignments))assert.equal(Object.hasOwn(descriptor.records.propositions.agentFields,field),false,operation.operation+' disclosed '+field+' as agent-writable.');actual.push({stage:operation.stage,operation:operation.operation,applicationTimingFieldsAdvertisedAsAgentWritable:Object.keys(timingAssignments).filter(field=>Object.hasOwn(descriptor.records.propositions.agentFields,field))});}
 verificationObservations.push({checkId:'PRODUCER-TIMING-PROMPT-EXCLUDES-APPLICATION-FIELDS',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:735'],boundary:'Generated response contract descriptor for every external proposition-writing operation',expected:{applicationTimingFieldsAdvertisedAsAgentWritable:[]},observed:{operations:actual},passed:true});
});
await check('TIMING-REGISTRY-OWNER: all producer views preserve application authority',()=>{
 for(const field of ['TIMING_ENTRIES','TIMING_SCHEDULE_SHA256']){
  assert.equal(schema.RECORD_SCHEMAS.propositions.fieldDefinitions[field].producer,'APPLICATION');assert.equal(schema.FIELD_REGISTRY['RECORD.propositions.'+field].producer,'APPLICATION');
  for(const partition of [schema.RECORD_OWNERSHIP.propositions,schema.DURABLE_OBJECT_REGISTRY.propositions.producerPartitions]){assert.ok(partition.application.includes(field),field+' is missing from application ownership.');assert.equal(partition.agent.includes(field),false);}
 }
});
await check('RECORD-OWNERSHIP-CLOSURE: every declared field has exactly its declared owner in every exported view',()=>assertOwnershipViews(schema));
const legacyRuntime=loadAuthorityRuntime(timingSourceWithAgentField(schemaSource)),legacyFixture=timingFixture(legacyRuntime,'LEGACY-PROPOSITION-TIMING');
const historicalProjects=new Map();
for(const [field,value] of Object.entries(timingAssignments)){
 const envelope=structuredClone(legacyFixture.envelope);envelope.records.propositions[0].fields[field]=value;
 const prepared=prepareTiming(legacyRuntime,legacyFixture,envelope);assert.equal(prepared.validation.valid,true,'The otherwise-valid historical fixture did not reproduce the prior ownership defect: '+field+' '+JSON.stringify(prepared.validation.issues));
 await check('TIMING-PENDING-RESTORE-'+field,()=>{
  const restored=JSON.parse(JSON.stringify(prepared.project)),before=hash.sha256Value(restored);
  assert.throws(()=>ingestion.commit(restored,prepared.proposal.proposalId,{operator:'SYNTHETIC_AUTHORITY_TEST'}),error=>error.code==='STALE_PROPOSAL'&&error.issues?.some(issue=>['FIELD_OWNERSHIP_VIOLATION','UNKNOWN_RECORD_FIELD'].includes(issue.code)&&issue.path==='/records/propositions/0/fields/'+field),'A restored pending response bypassed the current producer contract.');
  assert.equal(hash.sha256Value(restored),before,'Rejected historical acceptance changed the recoverable project.');
 });
 const accepted=legacyRuntime.ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'SYNTHETIC_LEGACY_AUTHORITY'});historicalProjects.set(field,accepted.project);
 await check('TIMING-ACCEPTED-HISTORY-'+field,()=>assertSavedTimingBlocked(runtime,accepted.project,field));
}
await check('TIMING-CORRECTION: current prompt and confirmed semantic replacement restore valid authority',()=>{
 const project=JSON.parse(JSON.stringify(historicalProjects.get('VERIFICATION_PHASE'))),originalRaw=project.projectData.rawResponses.map(record=>record.completeRawResponse),options=engine.preparePromptContext(project,4,{operation:'COMPLETE'}).options,prompt=prompts.buildPromptRecord(4,project,options);project.projectData.generatedPrompts.push(prompt);
 assert.notEqual(prompt.contractSha256,legacyFixture.prompt.contractSha256,'A changed producer contract reused stale instructions.');
 const envelope=stage04AcceptanceEnvelope(runtime,project,prompt),prepared=prepareTiming(runtime,{project,prompt,envelope});assert.equal(prepared.validation.valid,true,JSON.stringify(prepared.validation.issues));
 const before=hash.sha256Value(prepared.project);assert.throws(()=>ingestion.commit(prepared.project,prepared.proposal.proposalId),error=>error.code==='REPLACEMENT_CONFIRMATION_REQUIRED');assert.equal(hash.sha256Value(prepared.project),before);
 const impact=ingestion.acceptanceImpact(prepared.project,prepared.proposal.proposalId),accepted=ingestion.commit(prepared.project,prepared.proposal.proposalId,{replacementConfirmation:impact,operator:'SYNTHETIC_AUTHORITY_TEST'});
 assert.equal(engine.gate(4,accepted.project).reasons.some(reason=>reason.includes('application-owned field')),false);
 assert.deepEqual(accepted.project.projectData.rawResponses.slice(0,originalRaw.length).map(record=>record.completeRawResponse),originalRaw);
});
const faults=[];
function detectedFault(name,oracle,run){let caught=null;try{run();}catch(error){caught=error;}assert.ok(caught&&oracle.test(caught.message),name+' did not fail for its intended invariant: '+(caught?.message||'PASS'));faults.push({name,result:'DETECTED',diagnostic:caught.message});}
if(results.every(row=>row.result==='PASS')){
 await check('TIMING-FAULT: one reopened agent field is detected',()=>{
  const faulty=loadAuthorityRuntime(timingSourceWithAgentField(schemaSource,'VERIFICATION_PHASE'),engineSource);
  detectedFault('agent-proposition-phase',/An agent assigned application-owned proposition timing/,()=>assertTimingRejected(faulty,timingFixture(faulty,'FAULT-PROPOSITION-PHASE'),'VERIFICATION_PHASE'));
 });
 await check('TIMING-FAULT: bypassed historical authority guard is detected',()=>{
  const anchor='  reasons.push(...acceptedResponseOwnershipIssues(project,stage));';assert.equal(engineSource.split(anchor).length,2,'Historical authority fault anchor missing.');
  const faulty=loadAuthorityRuntime(schemaSource,engineSource.replace(anchor,''));detectedFault('accepted-history-authority-bypass',/Previously accepted agent timing/,()=>assertSavedTimingBlocked(faulty,historicalProjects.get('VERIFICATION_PHASE'),'VERIFICATION_PHASE'));
 });
 await check('OWNERSHIP-FAULT: omitted derived ownership is detected',()=>{
  const faulty=loadAuthorityRuntime(schemaSource+`\n;(()=>{const s=globalThis.closedLoopWorkflowSchema,o=s.RECORD_OWNERSHIP;globalThis.closedLoopWorkflowSchema=Object.freeze({...s,RECORD_OWNERSHIP:Object.freeze({...o,propositions:Object.freeze({...o.propositions,application:Object.freeze(o.propositions.application.filter(name=>name!=='TIMING_ENTRIES'))})})});})();`,engineSource);
  detectedFault('derived-ownership-omission',/propositions.TIMING_ENTRIES has inconsistent ownership/,()=>assertOwnershipViews(faulty.schema));
 });
}
const report={responseAuthorityIntegrity:results.every(row=>row.result==='PASS')?'PASS':'FAIL',syntheticCanonicalContexts:true,productionPromptAndIngestion:true,schemaSha256:hash.sha256Text(schemaSource),engineSha256:hash.sha256Text(engineSource),cases:results.length,passed:results.filter(row=>row.result==='PASS').length,failed:results.filter(row=>row.result==='FAIL').length,results,faults,sourceFaults:'IN_MEMORY_ONLY',verificationObservations};
const reportPath=process.argv.find(value=>value.startsWith('--authority-report='))?.slice('--authority-report='.length);if(reportPath)fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));assert.equal(report.failed,0,`${report.failed} response authority regressions failed.`);
