import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {projectStoreRuntime,restoreArtifactFixture,hydrateRetainedPromptContexts} from './test-project-store-runtime.mjs';
import {gunzipSync} from 'node:zlib';

// Frozen pre-optimization replay algorithm. It shares the actual ownership and
// digest authorities with the current replay, but independently reconstructs
// every project through the original complete structured clone.
const reference=String.raw`
function originalJournalReplay(row,journal){
 if(!row||!journal)return row;
 const {sha256,...body}=journal;
 if(sha256!==hash.sha256Value(body)||body.schema!=='closed-loop-response-operations/1'||body.jobId!==String(row.jobId)||body.baseProjectSha256!==row.projectSha256||body.projectRevision!==Number(row.revision)||!Array.isArray(body.patches))throw storageError('Saved response operations do not match their canonical project.','OPERATIONAL_STATE_INTEGRITY_FAILED');
 const next=clone(row.project);
 for(const patch of body.patches){
  if(!Array.isArray(patch.path)||!patch.path.length||patch.path.some(key=>typeof key!=='string'||['__proto__','constructor','prototype'].includes(key)))throw storageError('Saved response operation has an invalid field path.','OPERATIONAL_STATE_INTEGRITY_FAILED');
  let target=next;for(const key of patch.path.slice(0,-1)){if(!target||typeof target!=='object'||!Object.hasOwn(target,key))throw storageError('Saved response operation has an unavailable parent.','OPERATIONAL_STATE_INTEGRITY_FAILED');target=target[key];}
  const key=patch.path.at(-1);if(patch.remove)delete target[key];else target[key]=clone(patch.value);
 }
 assertOperationalChange(row.project,next);
 if(projectSha256(next)!==body.projectSha256)throw storageError('Saved response operation contents are corrupt.','OPERATIONAL_STATE_INTEGRITY_FAILED');
 return {...row,project:next,projectSha256:body.projectSha256};
}
globalThis.__journalReplayControls={actual:applyOperationalJournal,original:originalJournalReplay};
`;

export function verifyOperationalJournalCopy(){
 const source=fs.readFileSync('project-store.js','utf8'),anchor='globalThis.closedLoopProjectStore=Object.freeze({STORAGE_IO_TIMEOUT_MS';
 assert.equal(source.split(anchor).length,2,'JOURNAL_COPY_SOURCE_ANCHOR_ORACLE');
 const r=projectStoreRuntime({sourceOverrides:{'project-store.js':source.replace(anchor,reference+'\n'+anchor)}}),h=r.runtime.closedLoopHash,owners=r.runtime.__journalReplayControls,cases=[];
 const base=()=>r.copy({revision:3,job:{JOB_ID:'JOURNAL-COPY',JOB_TITLE:'Retained objective',CURRENT_STAGE:'STAGE 01'},stages:{1:{status:'CURRENT',gate:{complete:false,reasons:['pending']}}},projectData:{operationReservations:[],rawResponses:[{rawResponseId:'RAW-KEPT',status:'ACCEPTED',completeRawResponse:'Retained exact response bytes',sha256:'retained-digest',promptInstructionId:'INSTRUCTION-KEPT',promptScope:{stage:1},transport:{source:'FILE'}}],responseProposals:[],outputReceipts:[],history:[{event:'accepted',retained:'history bytes'}],generatedOutputs:[{outputId:'OUTPUT-KEPT',text:'retained output'}],responseValidations:[{validationId:'VALIDATION-1',result:'PENDING',details:{notes:['first','second'],keep:{value:'retained'}}}]}});
 const validation=project=>project.projectData.responseValidations[0],path=(...tail)=>['projectData','responseValidations','0',...tail];
 const scenarios=[
  {id:'single-leaf',patches:[{path:path('result'),value:'VALID'}],change:p=>{validation(p).result='VALID';}},
  {id:'repeated-leaf',patches:[{path:path('result'),value:'CHECKING'},{path:path('result'),value:'VALID'}],change:p=>{validation(p).result='VALID';}},
  {id:'ancestor-then-child',patches:[{path:path('details'),value:{notes:['new'],keep:{value:'retained'}}},{path:path('details','notes','0'),value:'final'}],change:p=>{validation(p).details={notes:['final'],keep:{value:'retained'}};}},
  {id:'child-then-ancestor',patches:[{path:path('details','notes','0'),value:'temporary'},{path:path('details'),value:{notes:['final'],keep:{value:'retained'}}}],change:p=>{validation(p).details={notes:['final'],keep:{value:'retained'}};}},
  {id:'sibling-paths',patches:[{path:path('result'),value:'VALID'},{path:path('details','notes','1'),value:'changed'}],change:p=>{validation(p).result='VALID';validation(p).details.notes[1]='changed';}},
  {id:'remove-reinsert',patches:[{path:path('details'),remove:true},{path:path('details'),value:{notes:['restored'],keep:{value:'retained'}}}],change:p=>{validation(p).details={notes:['restored'],keep:{value:'retained'}};}},
  {id:'array-append',patches:[{path:path('details','notes','2'),value:'third'}],change:p=>{validation(p).details.notes.push('third');}},
  {id:'array-remove-shrink',patches:[{path:path('details','notes','1'),remove:true},{path:path('details','notes','length'),value:1}],change:p=>{validation(p).details.notes.length=1;}},
  {id:'shared-base-graph',setup:p=>{const shared=r.copy({note:'before'});validation(p).details={left:shared,right:shared};},patches:[{path:path('details','left','note'),value:'after'}],change:p=>{validation(p).details.left.note='after';}},
  {id:'shared-inserted-graph',makePatches:()=>{const shared={note:'before'};return [{path:path('details'),value:{left:shared,right:shared}},{path:path('details','left','note'),value:'after'}];},change:p=>{const shared=r.copy({note:'after'});validation(p).details={left:shared,right:shared};}},
  {id:'empty-path',patches:[{path:[],value:'invalid'}],error:'OPERATIONAL_STATE_INTEGRITY_FAILED'},
  {id:'forbidden-prototype-path',patches:[{path:['projectData','__proto__','injected'],value:true}],error:'OPERATIONAL_STATE_INTEGRITY_FAILED'},
  {id:'missing-parent-after-valid-patch',patches:[{path:path('result'),value:'VALID'},{path:path('missing','child'),value:true}],error:'OPERATIONAL_STATE_INTEGRITY_FAILED'},
  {id:'forbidden-canonical-change',patches:[{path:['job','JOB_TITLE'],value:'forbidden'}],error:'OPERATIONAL_OWNERSHIP_VIOLATION'},
  {id:'accepted-response-change',patches:[{path:['projectData','rawResponses','0','completeRawResponse'],value:'rewritten'}],error:'OPERATIONAL_OWNERSHIP_VIOLATION'},
  {id:'accepted-response-nested-scope-change',patches:[{path:['projectData','rawResponses','0','promptScope','stage'],value:2}],error:'OPERATIONAL_OWNERSHIP_VIOLATION'},
  {id:'accepted-response-same-length-string-change',setup:p=>{p.projectData.rawResponses[0].completeRawResponse='a'.repeat(65536);},patches:[{path:['projectData','rawResponses','0','completeRawResponse'],value:'a'.repeat(65535)+'b'}],error:'OPERATIONAL_OWNERSHIP_VIOLATION'},
  {id:'retained-history-removal',patches:[{path:['projectData','history','length'],value:0}],error:'OPERATIONAL_OWNERSHIP_VIOLATION'},
  {id:'journal-digest-tamper',patches:[],tamper:journal=>{journal.sha256='0'.repeat(64);},error:'OPERATIONAL_STATE_INTEGRITY_FAILED'},
  {id:'base-digest-tamper',patches:[],body:body=>{body.baseProjectSha256='0'.repeat(64);},error:'OPERATIONAL_STATE_INTEGRITY_FAILED'},
  {id:'result-digest-tamper-after-valid-patch',patches:[{path:path('result'),value:'VALID'}],change:p=>{validation(p).result='VALID';},body:body=>{body.projectSha256='0'.repeat(64);},error:'OPERATIONAL_STATE_INTEGRITY_FAILED'}
 ];
 for(const scenario of scenarios){
  let project=base();scenario.setup?.(project);project=r.copy(project);let expected=r.copy(project);scenario.change?.(expected);expected=r.copy(expected);
  const row=r.copy({jobId:project.job.JOB_ID,revision:3,project,projectSha256:h.sha256Value(project)}),patches=r.copy(scenario.makePatches?.()||scenario.patches),body=r.copy({schema:'closed-loop-response-operations/1',jobId:row.jobId,baseProjectSha256:row.projectSha256,projectRevision:row.revision,patches,projectSha256:h.sha256Value(expected)});
  scenario.body?.(body);const journal=r.copy({...body,sha256:h.sha256Value(body)});scenario.tamper?.(journal);
  const before=h.sha256Value(row),journalBefore=h.sha256Value(journal),observed=[];
  for(const [name,replay]of Object.entries(owners)){
   if(scenario.error){assert.throws(()=>replay(row,journal),error=>error.code===scenario.error,'JOURNAL_COPY_REJECTION_ORACLE '+scenario.id+' '+name);observed.push({name,error:scenario.error});}
   else{const result=replay(row,journal);assert.equal(h.stableStringify(result.project),h.stableStringify(expected),'JOURNAL_COPY_EQUIVALENCE_ORACLE '+scenario.id+' '+name);assert.equal(result.projectSha256,h.sha256Value(expected),'JOURNAL_COPY_RESULT_HASH_ORACLE '+scenario.id+' '+name);observed.push({name,projectSha256:result.projectSha256});}
   assert.equal(h.sha256Value(row),before,'JOURNAL_COPY_INPUT_ISOLATION_ORACLE '+scenario.id+' '+name);assert.equal(h.sha256Value(journal),journalBefore,'JOURNAL_COPY_PATCH_ISOLATION_ORACLE '+scenario.id+' '+name);
  }
  cases.push({caseId:scenario.id,observed});
 }
 // Mutating the supplied patch object after replay cannot alter returned data.
 const project=base(),expected=r.copy(project);validation(expected).details=r.copy({notes:['inserted'],keep:{value:'retained'}});
 const row=r.copy({jobId:project.job.JOB_ID,revision:3,project,projectSha256:h.sha256Value(project)}),body=r.copy({schema:'closed-loop-response-operations/1',jobId:row.jobId,baseProjectSha256:row.projectSha256,projectRevision:row.revision,patches:[{path:path('details'),value:validation(expected).details}],projectSha256:h.sha256Value(expected)}),journal=r.copy({...body,sha256:h.sha256Value(body)}),returned=owners.actual(row,journal);
 journal.patches[0].value.notes[0]='external mutation';assert.equal(validation(returned.project).details.notes[0],'inserted','JOURNAL_COPY_INSERTED_VALUE_ISOLATION_ORACLE');
 // Report a representative preserved-history replay, with no timing threshold
 // and no substitute for the full supervised owning verifier.
 const measured=base();for(let n=0;n<40;n++)measured.projectData.generatedOutputs.push(r.copy({outputId:'LARGE-'+n,text:'retained history bytes\n'.repeat(1000)}));
 const changed=r.copy(measured);validation(changed).result='VALID';const measuredRow=r.copy({jobId:measured.job.JOB_ID,revision:3,project:measured,projectSha256:h.sha256Value(measured)}),measuredBody=r.copy({schema:'closed-loop-response-operations/1',jobId:measuredRow.jobId,baseProjectSha256:measuredRow.projectSha256,projectRevision:3,patches:[{path:path('result'),value:'VALID'}],projectSha256:h.sha256Value(changed)}),measuredJournal=r.copy({...measuredBody,sha256:h.sha256Value(measuredBody)}),timings={};
 for(const [name,replay]of Object.entries(owners)){const start=performance.now(),result=replay(measuredRow,measuredJournal);timings[name]=Math.round(performance.now()-start);assert.equal(result.projectSha256,measuredBody.projectSha256,'JOURNAL_COPY_MEASURED_EQUIVALENCE_ORACLE');}
 return {result:'PASS',cases,insertedValueIsolated:true,workloadBytes:Buffer.byteLength(h.stableStringify(measured)),elapsedMs:timings};
}

// Reuse only the completed prerequisite. Each case cold-loads isolated complete
// adapter stores and executes the real checkpoint or operational write boundary.
export function verifyOperationalReadProof(options={}){return verifyPrivateReadProof({...options,commands:['checkpoint','operational']});}
export async function verifyCanonicalReadProof(options={}){
 const sourceOverrides={...Object.fromEntries(['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'].map(file=>[file,fs.readFileSync(file,'utf8')])),...(options.sourceOverrides||{})};
 const result=await verifyPrivateReadProof({...options,sourceOverrides,commands:['canonical']}),extra=await verifyCanonicalPreparedProof({...options,sourceOverrides});result.cases.push(...extra);result.caseCount=result.cases.length;return result;
}
// The complete storage command below retains every corruption/no-overwrite
// check. Its decoder independently rejects bad bytes even if this earlier
// preparer hash is omitted. Exercise this exact private owner separately;
// this is a Node function boundary, never a corrupt-command admission claim.
async function verifyRetainedPartHashOwner(source,r,fixture,caseId){
 const begin='  async function retainValue(sha256,blob){',end='\n  const unusableRoots=',start=source.indexOf(begin),finish=source.indexOf(end,start);
 assert(start>=0&&finish>start&&source.indexOf(begin,start+1)<0,'PRIVATE_RETAINED_HASH_SOURCE_BOUNDARY_ORACLE');
 const body=source.slice(start,finish),historyKeyLine=source.match(/^const historyKey=.*;$/m)?.[0],historyFileKeyLine=source.match(/^const historyFileKey=.*;$/m)?.[0],storageErrorLine=source.match(/^const storageError=.*;$/m)?.[0];
 assert(historyKeyLine&&historyFileKeyLine&&storageErrorLine,'PRIVATE_RETAINED_HASH_DEPENDENCY_SOURCE_ORACLE');
 const create=new Function('hash','Blob','state','newFiles','retainedFiles','metaGet','verifiedValues','jobId',historyKeyLine+'\n'+historyFileKeyLine+'\n'+storageErrorLine+'\n'+body+'\nreturn retainValue;');
 assert.equal(fixture.originalBlob.size,fixture.byteSize,'PRIVATE_RETAINED_HASH_VALID_SIZE_ORACLE');assert.equal(await r.runtime.closedLoopHash.sha256Bytes(fixture.originalBlob),fixture.sha256,'PRIVATE_RETAINED_HASH_VALID_DIGEST_ORACLE');
 const controls=[];
 for(const name of ['valid','missing-blob','wrong-size','same-size-corrupt']){
  const row={sha256:fixture.sha256,...(name==='missing-blob'?{}:{blob:name==='valid'?fixture.originalBlob:name==='wrong-size'?new Blob(['X']):fixture.corruptBlob})};
  if(name==='wrong-size')assert.notEqual(row.blob.size,fixture.byteSize,'PRIVATE_RETAINED_HASH_WRONG_SIZE_PREREQUISITE');
  if(name==='same-size-corrupt'){assert.equal(row.blob.size,fixture.byteSize);assert.notEqual(await r.runtime.closedLoopHash.sha256Bytes(row.blob),fixture.sha256);}
  const state={files:{[fixture.sha256]:{byteSize:fixture.byteSize}}},values=new Set(),read=async key=>{assert.equal(key,'recovery:'+fixture.jobId+':bytes:'+fixture.sha256);return row;},owner=create(r.runtime.closedLoopHash,Blob,state,[],[],read,values,fixture.jobId);
  if(name==='valid'){await owner(fixture.sha256,null);assert.equal(values.has(fixture.sha256),true);controls.push({caseId:name,result:'PASS',accepted:true});}
  else{await assert.rejects(()=>owner(fixture.sha256,null),error=>error.code==='HISTORY_FILE_INTEGRITY_FAILED','PRIVATE_READ_REJECTION_ORACLE '+caseId+' private retainValue '+name);assert.equal(values.size,0);controls.push({caseId:name,result:'PASS',error:'HISTORY_FILE_INTEGRITY_FAILED'});}
 }
 return {caseId,boundary:'EXACT_PRIVATE_RETAIN_VALUE_NODE_FUNCTION',sourceSha256:createHash('sha256').update(source).digest('hex'),functionSha256:createHash('sha256').update(body).digest('hex'),actualCommandCorruptionRejected:true,actualCommandRowsPreserved:true,corruptCommandAdmissionClaimed:false,controls};
}
async function verifyPrivateReadProof({sourceOverrides={},fault=null,caseFilter=null,commands}={}){
 const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
 sourceOverrides={...Object.fromEntries(runtimeFiles.map(file=>[file,fs.readFileSync(file,'utf8')])),...sourceOverrides};
 if(fault==='digest-label-only'){const source=sourceOverrides['project-store.js']??fs.readFileSync('project-store.js','utf8'),anchor='!verifiedValuesEqual(verifiedRead.row,row)||!verifiedValuesEqual(verifiedRead.journal,journal)';assert.equal(source.split(anchor).length,2,'PRIVATE_READ_FAULT_ANCHOR_ORACLE');sourceOverrides={...sourceOverrides,'project-store.js':source.replace(anchor,'verifiedRead.row?.projectSha256!==row?.projectSha256||verifiedRead.journal?.value?.sha256!==journal?.value?.sha256')};}
 if(fault==='omit-retained-prompt-context-copy'){const source=sourceOverrides['project-store.js'],anchor='globalThis.closedLoopPromptEngine?.copyRetainedPromptContextFiles?.(candidate,next);';assert.equal(source.split(anchor).length,2,'CANONICAL_RETAINED_CONTEXT_FAULT_ANCHOR_ORACLE');sourceOverrides={...sourceOverrides,'project-store.js':source.replace(anchor,'')};}
 if(fault==='omit-retained-part-rehash'){const source=sourceOverrides['project-store.js']??fs.readFileSync('project-store.js','utf8'),anchor='await hash.sha256Bytes(retained.blob)!==sha256';assert.equal(source.split(anchor).length,2,'PRIVATE_READ_RETAINED_FAULT_ANCHOR_ORACLE');sourceOverrides={...sourceOverrides,'project-store.js':source.replace(anchor,'false')};}
 const {seed,project,text,copy}=await operationalProofSeed(sourceOverrides,{retainedContext:commands.includes('canonical')});
 const frozenRows=new Map([...seed.rows].map(([name,rows])=>[name,new Map([...rows].map(([key,row])=>[key,copy(row)]))])),jobId=project.job.JOB_ID,journalKey='responseOperations:'+jobId,results=[],retainedHashOwners=[];
 const scenarios=['valid-control','equivalent-alias-topology','same-digest-canonical-payload','same-digest-journal-payload','same-digest-alias-subbranch','cyclic-canonical-payload','concurrent-canonical','concurrent-journal','corrupt-retained-project-part'];
 for(const command of commands)for(const scenario of scenarios){
  if(caseFilter&&!caseFilter.includes(command+':'+scenario))continue;
  const r=projectStoreRuntime({sourceOverrides}),{runtime,store,engine,copy}=r;
  for(const [name,rows]of frozenRows)r.rows.set(name,new Map([...rows].map(([key,row])=>[key,copy(row)])));
  const current=await store.readProject(jobId),beforeRevision=current.revision,beforeHash=current.projectSha256,historyBefore=await store.historyList(jobId);
  const reservation=r.rows.get('projects').get(jobId).project.projectData.operationReservations.at(-1);assert.ok(reservation?.SCOPE&&reservation.fields.SCOPE===reservation.SCOPE,'PRIVATE_READ_CANONICAL_ALIAS_PREREQUISITE');
  let injected=false,expectedStorage=null,retainedPartFixture=null;
  const storageSnapshot=()=>new Map([...r.rows].map(([name,rows])=>[name,new Map([...rows].map(([key,row])=>[key,copy(row)]))]));
  if(scenario==='corrupt-retained-project-part'){
   const entry=historyBefore.entries.findLast(row=>row.projectSha256===beforeHash&&row.projectParts?.entries?.length),part=entry?.projectParts.entries.find(row=>row.path.includes('rawResponses')&&row.path.at(-1)==='completeRawResponse');assert.ok(part,'PRIVATE_READ_RETAINED_PART_PREREQUISITE');
   const row=r.rows.get('meta').get('recovery:'+jobId+':bytes:'+part.sha256);assert.ok(row?.value?.blob instanceof Blob,'PRIVATE_READ_RETAINED_PART_BYTES_PREREQUISITE');
   const originalBlob=row.value.blob;row.value.blob=new Blob(['X'.repeat(row.value.blob.size)]);retainedPartFixture={jobId,sha256:part.sha256,byteSize:part.byteSize,originalBlob,corruptBlob:row.value.blob};injected=true;expectedStorage=storageSnapshot();
  }
  const open=runtime.openStorageTransaction;let armed=scenario!=='valid-control'&&scenario!=='corrupt-retained-project-part';
  runtime.openStorageTransaction=async(names,mode)=>{
   const selected=Array.isArray(names)?names:[names];
   if(armed&&mode==='readwrite'&&selected.includes('projects')&&selected.includes('meta')){
    armed=false;injected=true;
    if(scenario==='same-digest-canonical-payload')r.rows.get('projects').get(jobId).project.job.JOB_TITLE='Different bytes under the unchanged stored digest';
    if(scenario==='equivalent-alias-topology'){const reservation=r.rows.get('projects').get(jobId).project.projectData.operationReservations.at(-1);reservation.fields.SCOPE=copy(reservation.SCOPE);assert.notEqual(reservation.fields.SCOPE,reservation.SCOPE,'PRIVATE_READ_ALIAS_TOPOLOGY_CHANGED');}
    if(scenario==='same-digest-alias-subbranch'){const reservation=r.rows.get('projects').get(jobId).project.projectData.operationReservations.at(-1);assert.ok(Object.hasOwn(reservation.SCOPE,'inputVersion'),'PRIVATE_READ_SCOPE_FIELD_PREREQUISITE');reservation.SCOPE.inputVersion=String(reservation.SCOPE.inputVersion)+'-CORRUPT';}
    if(scenario==='cyclic-canonical-payload'){const reservation=r.rows.get('projects').get(jobId).project.projectData.operationReservations.at(-1);reservation.fields.SCOPE=reservation.fields;}
    if(scenario==='same-digest-journal-payload'){const journal=r.rows.get('meta').get(journalKey).value,patch=journal.patches.find(row=>!row.remove);assert.ok(patch,'PRIVATE_READ_JOURNAL_PATCH_PREREQUISITE');patch.value=typeof patch.value==='string'?patch.value+' altered':{altered:true};}
    if(scenario==='concurrent-canonical'){const changed=copy(current);changed.job.JOB_TITLE='A legitimate concurrent project title';await store.writeProject(changed,{expectedProjectRevision:beforeRevision,expectedStateSha256:beforeHash});}
    if(scenario==='concurrent-journal'){const changed=copy(current);engine.addHistory(changed,'SYNTHETIC_CONCURRENT_RESPONSE_OBSERVATION',{synthetic:true});await store.writeProject(changed,{operational:true,expectedProjectRevision:beforeRevision,expectedStateSha256:beforeHash});}
    expectedStorage=storageSnapshot();
   }
   return open(names,mode);
  };
  if(command==='canonical')for(const prompt of current.projectData.generatedPrompts)r.prompts.retainPromptContextFiles(prompt,r.prompts.materializePromptContextFiles(prompt,current));const next=copy(current);r.prompts.copyRetainedPromptContextFiles(current,next);const retainedPromptContexts=command==='canonical'?current.projectData.generatedPrompts.map(prompt=>({instructionId:prompt.instructionId,files:copy(r.prompts.materializePromptContextFiles(prompt))})):[];engine.addHistory(next,'SYNTHETIC_PENDING_RESPONSE_OBSERVATION',{synthetic:true});
  const view=copy({activeStage:1,activeView:'Workflow',drafts:{'#response-note':{value:'Required changed view'}},scrollX:0,scrollY:17});
  const execute=()=>command==='checkpoint'?store.saveCheckpoint(jobId,{expectedProjectRevision:beforeRevision,expectedStateSha256:beforeHash,view}):store.writeProject(next,{operational:command==='operational',expectedProjectRevision:beforeRevision,expectedStateSha256:beforeHash,historyView:view});
  const code=scenario==='corrupt-retained-project-part'?'HISTORY_FILE_INTEGRITY_FAILED':'STALE_PROJECT_REVISION';
  if(scenario==='valid-control'||scenario==='equivalent-alias-topology'){
   const committed=await execute();if(command==='canonical'){assert.ok(retainedPromptContexts.some(row=>row.files.length),'CANONICAL_RETAINED_PROMPT_CONTEXT_PREREQUISITE');for(const expected of retainedPromptContexts){const prompt=committed.projectData.generatedPrompts.find(row=>row.instructionId===expected.instructionId);assert.deepEqual(copy(r.prompts.materializePromptContextFiles(prompt)),expected.files,'CANONICAL_RETAINED_PROMPT_CONTEXT_BYTES_ORACLE');}}const reloaded=await store.readProject(jobId),history=await store.historyList(jobId);assert.equal(reloaded.revision,beforeRevision+(command==='canonical'?1:0),'PRIVATE_READ_CONTROL_REVISION_ORACLE');assert.equal(reloaded.projectData.rawResponses.at(-1).completeRawResponse,text,'PRIVATE_READ_CONTROL_RAW_BYTES_ORACLE');assert.equal((await store.readHistoryView(jobId,history.activeId)).drafts['#response-note'].value,'Required changed view','PRIVATE_READ_CONTROL_CHANGED_VIEW_ORACLE');assert.ok(history.entries.length>historyBefore.entries.length,'PRIVATE_READ_CONTROL_HISTORY_ORACLE');
   if(scenario==='equivalent-alias-topology')assert.equal(injected,true,'PRIVATE_READ_ALIAS_CHANGE_REACHED_ORACLE');
   results.push({caseId:command+':'+scenario,result:'PASS',exactRawBytes:true,changedViewRetained:true,...(command==='canonical'?{retainedPromptContextBytes:true}:{}),...(scenario==='equivalent-alias-topology'?{aliasTopologyChanged:true}:{})});
  }else{
   await assert.rejects(execute,error=>error.code===code,'PRIVATE_READ_REJECTION_ORACLE '+command+':'+scenario);assert.equal(injected,true,'PRIVATE_READ_INJECTION_REACHED_ORACLE');assert.deepEqual(r.rows,expectedStorage,'PRIVATE_READ_NO_OVERWRITE_ORACLE '+command+':'+scenario);
   if(scenario==='corrupt-retained-project-part')retainedHashOwners.push(await verifyRetainedPartHashOwner(sourceOverrides['project-store.js'],r,retainedPartFixture,command+':'+scenario));
   results.push({caseId:command+':'+scenario,result:'PASS',error:code,injected:true,failedWritePreservedState:true});
  }
 }
 return {result:'PASS',sourceSha256:Object.fromEntries(runtimeFiles.map(file=>[file,createHash('sha256').update(sourceOverrides[file]).digest('hex')])),boundary:'Actual production store commands and recovery bytes in isolated Node transaction adapter; not IndexedDB/browser proof',prerequisite:'One production saved reservation and exact captured response; complete immutable stores cold-copied for each case',caseCount:results.length,cases:results,retainedHashOwners};
}

async function operationalProofSeed(sourceOverrides,{retainedContext=false}={}){
 const seed=projectStoreRuntime({sourceOverrides}),{core,engine,prompts,ingestion,store,copy}=seed,schema=seed.runtime.closedLoopWorkflowSchema;
 let project=core.createBlankState('PRIVATE-READ-PROOF');project.job.EXACT_USER_OBJECTIVE_VERBATIM='Keep exact recoverable response bytes and reject concurrent changes.'.repeat(retainedContext?1100:1);engine.ensureShape(project);engine.recalculate(project);
 project=await store.writeProject(project,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
 const reserved=copy(project),prompt=prompts.reserveAndBuildPromptRecord(reserved,1,{},{}).prompt;project=await store.writeProject(reserved,{expectedProjectRevision:project.revision});
 const envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:project.job.JOB_ID,stage:1,operation:prompt.operation,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},scope:prompt.scope,packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce,responseType:'BLOCKED',stageData:{},records:{},humanInputRequests:[],evidence:[],unresolved:[{temporaryKey:'blocked',kind:'MISSING_CAPABILITY',description:'Retained synthetic unavailability. '.repeat(180),whyBlocking:'External work is not available.',affectedStageFields:[],affectedRecords:[],blocking:true}],warnings:[],attachments:[]};
 const text=JSON.stringify(envelope),transport={packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce};
 const captured=ingestion.captureRaw(project,{stage:1,text,promptRecord:prompt,transport});project=await store.writeProject(captured.project,{operational:true,expectedProjectRevision:project.revision,expectedStateSha256:project.projectSha256});
 return {seed,project,text,copy};
}

// The optimization is private to consecutive commands in one store context.
// Cold copied fixtures alone cannot prove this boundary, so each isolated case
// executes a fresh operational commit before the command being asserted.
export async function verifyOperationalWarmProof({sourceOverrides={},caseFilter=null,fault=null}={}){
 const files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
 const frozen={...Object.fromEntries(files.map(file=>[file,fs.readFileSync(file,'utf8')])),...sourceOverrides},sourceSha256=Object.fromEntries(files.map(file=>[file,createHash('sha256').update(frozen[file]).digest('hex')]));
 let source=frozen['project-store.js'];const anchor='function applyOperationalJournal(row,journal,checkpointRead=null){';assert.equal(source.split(anchor).length,2,'WARM_PROOF_REPLAY_COUNTER_ANCHOR');source=source.replace(anchor,anchor+'globalThis.__warmColdReplays=(globalThis.__warmColdReplays||0)+1;');
 const custodyAnchor='async function observeProjectArtifactCustody(project){';assert.equal(source.split(custodyAnchor).length,2,'WARM_PROOF_CUSTODY_HOOK_ANCHOR');source=source.replace(custodyAnchor,custodyAnchor+'globalThis.__warmDuringCustody?.();');
 const privateReadAnchor='globalThis.closedLoopProjectStore=Object.freeze({STORAGE_IO_TIMEOUT_MS';assert.equal(source.split(privateReadAnchor).length,2,'WARM_PROOF_PRIVATE_READ_ANCHOR');source=source.replace(privateReadAnchor,'globalThis.__privateWarmRead=readProjectForTransaction;'+privateReadAnchor);
 const patchAnchor='// Prove the generated journal itself reconstructs the validated candidate.';assert.equal(source.split(patchAnchor).length,2,'WARM_PROOF_PATCH_GENERATION_ANCHOR');source=source.replace(patchAnchor,"if(globalThis.__warmCorruptGeneratedPatches)body.patches=[];\n    "+patchAnchor);
 if(fault==='omit-full-source-comparison'){const a='!verifiedValuesEqual(proof.row,row)||!verifiedValuesEqual(proof.journal,journal)';assert.equal(source.split(a).length,2,'WARM_PROOF_SOURCE_FAULT_ANCHOR');source=source.replace(a,'false');}
 if(fault==='omit-generated-replay-check'){const a='if(!verifiedValuesEqual(replayOperationalPatches(base.project,body.patches),next))';assert.equal(source.split(a).length,2,'WARM_PROOF_PATCH_FAULT_ANCHOR');source=source.replace(a,'if(false)');}
 if(fault==='reuse-returned-project'){const a='privateCommitted=copyVerifiedTree(committed),committedIntegrity=';assert.equal(source.split(a).length,2,'WARM_PROOF_PUBLIC_ALIAS_FAULT_ANCHOR');source=source.replace(a,'privateCommitted=committed,committedIntegrity=');}
 if(fault==='reuse-public-read'){const a='const committedRead=sourceProof&&sourceProof.readPurpose!==STARTUP_RECOVERY_CAPTURE?takeOperationalCommitRead(row,journal,sourceProof.readPurpose):null;if(!sourceProof||sourceProof.readPurpose===STARTUP_RECOVERY_CAPTURE)recentOperationalCommitRead=null;';assert.equal(source.split(a).length,2,'WARM_PROOF_COLD_FAULT_ANCHOR');source=source.replace(a,'const committedRead=takeOperationalCommitRead(row,journal);if(committedRead&&!sourceProof)return committedRead.project;');}
 const sources={...frozen,'project-store.js':source},{seed,project,text}=await operationalProofSeed(sources),jobId=project.job.JOB_ID,rows=new Map([...seed.rows].map(([name,map])=>[name,new Map([...map].map(([key,value])=>[key,seed.copy(value)]))])),cases=[];
 const scenarios=['valid-control','one-use-only','same-digest-canonical-payload','same-digest-journal-payload','returned-project-mutation','returned-project-mutation-during-custody','other-project','public-read-remains-cold','cold-reload-remains-cold','failed-write-before-commit','failed-write-during-journal','wrong-generated-patches','corrupt-retained-project-part'];
 for(const command of ['checkpoint','operational'])for(const scenario of scenarios){const caseId=command+':'+scenario;if(caseFilter&&!caseFilter.includes(caseId))continue;
  const r=projectStoreRuntime({sourceOverrides:sources}),{store,engine,copy,runtime}=r;for(const [name,map]of rows)r.rows.set(name,new Map([...map].map(([key,value])=>[key,copy(value)])));
  let current=await store.readProject(jobId),other=null;if(scenario==='other-project'){other=r.core.createBlankState('OTHER-WARM-PROOF');engine.ensureShape(other);engine.recalculate(other);other=await store.writeProject(other,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});}
  const warm=copy(current);engine.addHistory(warm,'SYNTHETIC_WARM_COMMIT',{scope:'warm command test only'});current=await store.writeProject(warm,{operational:true,expectedProjectRevision:current.revision,expectedStateSha256:current.projectSha256});const storedCurrent=copy(current),history=await store.historyList(jobId),beforeHash=current.projectSha256;
  const cold=()=>Number(runtime.__warmColdReplays||0),before=cold(),next=copy(storedCurrent);engine.addHistory(next,'SYNTHETIC_NEXT_COMMAND',{scope:'warm command test only'});const view=copy({activeStage:1,activeView:'Workflow',drafts:{'#response-note':{value:caseId}},scrollX:0,scrollY:19});
  const execute=()=>command==='checkpoint'?store.saveCheckpoint(jobId,{expectedProjectRevision:storedCurrent.revision,expectedStateSha256:beforeHash,view}):store.writeProject(next,{operational:true,expectedProjectRevision:storedCurrent.revision,expectedStateSha256:beforeHash,historyView:view});
  let expectedError=null,expectedCold=false,duringCustodyMutations=0;
  if(scenario==='same-digest-canonical-payload'){r.rows.get('projects').get(jobId).project.job.JOB_TITLE='Different canonical bytes';expectedError='PROJECT_HASH_MISMATCH';}
  if(scenario==='same-digest-journal-payload'){const patch=r.rows.get('meta').get('responseOperations:'+jobId).value.patches.find(p=>!p.remove);assert.ok(patch);patch.value={different:'journal bytes'};expectedError='OPERATIONAL_STATE_INTEGRITY_FAILED';}
  if(scenario==='returned-project-mutation')current.projectData.rawResponses.at(-1).completeRawResponse='Uncommitted caller corruption';
  if(scenario==='returned-project-mutation-during-custody')runtime.__warmDuringCustody=()=>{delete runtime.__warmDuringCustody;duringCustodyMutations++;current.projectData.rawResponses.at(-1).completeRawResponse='Caller mutation after proof consumption';};
  if(scenario==='other-project'){await store.saveCheckpoint(other.job.JOB_ID,{expectedProjectRevision:other.revision,expectedStateSha256:other.projectSha256,view:copy({...view,drafts:{}})});assert.ok(cold()>before,'WARM_PROOF_OTHER_PROJECT_COLD_ORACLE');expectedCold=true;}
  if(scenario==='public-read-remains-cold'){const read=await store.readProject(jobId);assert.equal(read.projectSha256,beforeHash);assert.ok(cold()>before,'WARM_PROOF_PUBLIC_COLD_ORACLE');expectedCold=true;}
  if(scenario==='cold-reload-remains-cold'){const fresh=projectStoreRuntime({sourceOverrides:sources});for(const [name,map]of r.rows)fresh.rows.set(name,new Map([...map].map(([key,value])=>[key,fresh.copy(value)])));const read=await fresh.store.readProject(jobId);assert.equal(read.projectSha256,beforeHash);assert.ok(fresh.runtime.__warmColdReplays>0,'WARM_PROOF_RELOAD_COLD_ORACLE');}
  if(scenario==='failed-write-before-commit'||scenario==='failed-write-during-journal'){const beforeRows=copy([...r.rows].map(([name,map])=>[name,[...map]]));runtime.__closedLoopStorageFault=scenario==='failed-write-before-commit'?'before-transaction-commit':'during-operational-write';await assert.rejects(()=>store.writeProject(next,{operational:true,expectedProjectRevision:storedCurrent.revision,expectedStateSha256:beforeHash}),e=>e.code==='INJECTED_STORAGE_FAILURE','WARM_PROOF_ABORT_ORACLE');delete runtime.__closedLoopStorageFault;assert.deepEqual(copy([...r.rows].map(([name,map])=>[name,[...map]])),beforeRows,'WARM_PROOF_ABORT_PRESERVES_ROWS_ORACLE');expectedCold=true;}
  if(scenario==='wrong-generated-patches'){const beforeRows=copy([...r.rows].map(([name,map])=>[name,[...map]]));runtime.__warmCorruptGeneratedPatches=true;await assert.rejects(()=>store.writeProject(next,{operational:true,expectedProjectRevision:storedCurrent.revision,expectedStateSha256:beforeHash}),e=>e.code==='OPERATIONAL_STATE_INTEGRITY_FAILED','WARM_PROOF_WRONG_PATCH_REJECTION_ORACLE');delete runtime.__warmCorruptGeneratedPatches;assert.deepEqual(copy([...r.rows].map(([name,map])=>[name,[...map]])),beforeRows,'WARM_PROOF_WRONG_PATCH_NO_COMMIT_ORACLE');expectedCold=true;}
  if(scenario==='corrupt-retained-project-part'){const part=history.entries.findLast(e=>e.projectSha256===beforeHash).projectParts.entries.find(e=>e.path.includes('rawResponses')&&e.path.at(-1)==='completeRawResponse');assert.ok(part);const row=r.rows.get('meta').get('recovery:'+jobId+':bytes:'+part.sha256);row.value.blob=new Blob(['X'.repeat(row.value.blob.size)]);expectedError='HISTORY_FILE_INTEGRITY_FAILED';}
  const coldBeforeCommand=cold();if(expectedError){await assert.rejects(execute,e=>e.code===expectedError,'WARM_PROOF_REJECTION_ORACLE '+caseId);if(scenario.includes('same-digest')){assert.ok(cold()>coldBeforeCommand||expectedError==='PROJECT_HASH_MISMATCH','WARM_PROOF_COLD_INTEGRITY_ROUTE_ORACLE');assert.ok((await store.listQuarantinedProjects()).some(row=>row.jobId===jobId),'WARM_PROOF_CORRUPT_ORIGINAL_RETAINED_ORACLE');}cases.push({caseId,result:'PASS',error:expectedError});continue;}
  const sharedAliasFault=fault==='reuse-returned-project'&&command==='operational'&&scenario==='returned-project-mutation-during-custody',beforeAliasFaultRows=sharedAliasFault?copy([...r.rows].map(([name,map])=>[name,[...map]])):null;
  try{await execute();}catch(error){
   if(scenario==='returned-project-mutation-during-custody'&&error.code==='OPERATIONAL_OWNERSHIP_VIOLATION')assert.fail('WARM_PROOF_RETURNED_ALIAS_ISOLATION_ORACLE '+caseId+': '+error.code);
   // The unchanged alias-isolation fault now meets the earlier custody boundary.
   // Only that exact fault, actual callback and refusal may name the old oracle.
   if(sharedAliasFault&&error.code==='STALE_PROJECT_REVISION'&&error.message==='Project or response data changed after verification. The newer state is preserved.'){
    assert.equal(duringCustodyMutations,1,'WARM_PROOF_SHARED_ALIAS_MUTATION_REACHED '+caseId);assert.equal(current.projectData.rawResponses.at(-1).completeRawResponse,'Caller mutation after proof consumption','WARM_PROOF_SHARED_ALIAS_CURRENT_VALUE '+caseId);assert.deepEqual(copy([...r.rows].map(([name,map])=>[name,[...map]])),beforeAliasFaultRows,'WARM_PROOF_SHARED_ALIAS_REFUSAL_PRESERVES_ROWS '+caseId);
    assert.fail('WARM_PROOF_RETURNED_ALIAS_ISOLATION_ORACLE '+caseId+': '+error.code);
   }
   throw error;
  }const commandReplays=cold()-coldBeforeCommand;if(expectedCold)assert.ok(commandReplays>0,'WARM_PROOF_FALLBACK_COLD_ORACLE '+caseId);else assert.equal(commandReplays,0,'WARM_PROOF_EXACT_REUSE_ORACLE '+caseId);
  if(scenario==='one-use-only'){const latest=command==='operational'?next:storedCurrent,hash=command==='operational'?r.rows.get('meta').get('responseOperations:'+jobId).value.projectSha256:beforeHash,first=cold();await store.saveCheckpoint(jobId,{expectedProjectRevision:latest.revision,expectedStateSha256:hash,view:copy({...view,scrollY:20})});assert.equal(cold(),first,'WARM_PROOF_NEW_COMMIT_REPLACES_SINGLE_PROOF_ORACLE');const once=cold();await runtime.__privateWarmRead(jobId);assert.equal(cold(),once,'WARM_PROOF_FIRST_PRIVATE_READ_REUSES_ORACLE');await runtime.__privateWarmRead(jobId);assert.ok(cold()>once,'WARM_PROOF_CONSUMED_ONCE_ORACLE');}
  const savedHistory=await store.historyList(jobId);let retainedView;try{retainedView=await store.readHistoryView(jobId,savedHistory.activeId);}catch(error){assert.fail('WARM_PROOF_RETAINED_CHECKPOINT_INTEGRITY_ORACLE '+caseId+': '+error.code);}assert.equal(retainedView.drafts['#response-note'].value,caseId,'WARM_PROOF_RETAINED_VIEW_ORACLE');
  const reloaded=await store.readProject(jobId);assert.equal(reloaded.projectData.rawResponses.at(-1).completeRawResponse,text,'WARM_PROOF_EXACT_RAW_RELOAD_ORACLE');assert.equal(reloaded.revision,storedCurrent.revision,'WARM_PROOF_CANONICAL_REVISION_ORACLE');cases.push({caseId,result:'PASS',commandColdReplays:commandReplays,exactRawBytes:true,failedWritePreserved:scenario.startsWith('failed-write')||scenario==='wrong-generated-patches'});
 }
 return {result:'PASS',sourceSha256,caseCount:cases.length,cases,boundary:'Consecutive real production store commands in isolated transaction-adapter contexts; no browser or IndexedDB claim',prerequisite:'One production saved/captured response prefix; isolated complete stores plus a fresh actual operational commit per warm case'};
}

async function verifyCanonicalPreparedProof({sourceOverrides,caseFilter=null,fault=null}){
 const cases=[],names=['prepared-candidate-mutation','unexpired-capability-control','expired-capability-at-commit','absent-prior-concurrent-create'];let expirySeed=null;
 for(const scenario of names){
  const caseId='canonical:'+scenario;if(caseFilter&&!caseFilter.includes(caseId))continue;
  let source=sourceOverrides['project-store.js'];
  const anchor='const prepared=await prepareProjectWrite(project,options);fault(\'before-project-transaction\');';assert.equal(source.split(anchor).length,2,'CANONICAL_PREPARED_INJECTION_OWNER');source=source.replace(anchor,"const prepared=await prepareProjectWrite(project,options);await globalThis.__canonicalPreparedInjection?.(prepared);fault('before-project-transaction');");
  if(fault==='omit-candidate-snapshot'){const guard='if(preparedProof&&!unchangedVerifiedProject(preparedProof.integrity,project,preparedProof.digest))';assert.equal(source.split(guard).length,2,'CANONICAL_PREPARED_FAULT_OWNER');source=source.replace(guard,'if(false)');}
  if(fault==='omit-current-derived'){const guard='const issues=derivedProjectIntegrityIssues(next);';assert.equal(source.split(guard).length,2,'CANONICAL_EXPIRY_FAULT_OWNER');source=source.replace(guard,'const issues=[];');}
  const sources={...sourceOverrides,'project-store.js':source};let r,current,expiresAt=null,clock;
  if(scenario==='absent-prior-concurrent-create'){r=projectStoreRuntime({sourceOverrides:sources});current=r.core.createBlankState('PRIVATE-ABSENT-PRIOR-PROOF');r.engine.ensureShape(current);r.engine.recalculate(current);current.revision=0;}else if(scenario==='prepared-candidate-mutation'){
   const seed=await operationalProofSeed(sources);r=seed.seed;current=seed.project;
  }else{
   // Reuse this exact retained synthetic producer cohort, including all artifact
   // and prompt-context bytes. No gate is set or stage prefix regenerated here.
   const carrier=JSON.parse(fs.readFileSync('verification/deferred-definition-compatibility-legacy-fixture-20261005.json','utf8')),decoded=Buffer.from(gunzipSync(Buffer.from(carrier.gzipBase64,'base64')));assert.equal(decoded.byteLength,carrier.decodedByteSize);assert.equal(createHash('sha256').update(decoded).digest('hex'),carrier.decodedSha256,'CANONICAL_EXPIRY_FIXTURE_IDENTITY');const cohort=JSON.parse(decoded.toString('utf8')).cohorts.failureTests,claims=cohort.project.projectData.environmentManifests.find(row=>row.source==='EXTERNAL_CAPABILITY_REGISTRATION').fields.EXTERNAL_CLAIMS;expiresAt=Date.parse(claims.validUntil);clock=Date.parse(claims.observedAt)+60000;
   class ObservationClock extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
   r=projectStoreRuntime({sourceOverrides:sources,environment:{Date:ObservationClock}});if(expirySeed){for(const[name,rows]of expirySeed.rows)r.rows.set(name,new Map([...rows].map(([key,value])=>[key,r.copy(value)])));current=await r.store.readProject(expirySeed.jobId);}else{await restoreArtifactFixture(r.store,cohort.artifacts);current=r.copy(cohort.project);await hydrateRetainedPromptContexts(r,current,cohort.contextFiles);current=await r.store.writeProject(current,{expectedProjectRevision:0,createOnly:true,incrementRevision:false});current=await r.store.readProject(current.job.JOB_ID);expirySeed={jobId:current.job.JOB_ID,rows:new Map([...r.rows].map(([name,rows])=>[name,new Map([...rows].map(([key,value])=>[key,r.copy(value)]))]))};}assert.equal(current.stages[2].gate.complete,true,'CANONICAL_EXPIRY_CONFORMING_PREFIX');assert.equal(r.engine.gate(current,2).complete,true,'CANONICAL_EXPIRY_CURRENT_POSITIVE');
  }
  const {store,engine,runtime,copy}=r,jobId=current.job.JOB_ID,before=new Map([...r.rows].map(([name,rows])=>[name,new Map([...rows].map(([key,value])=>[key,copy(value)]))])),next=copy(current);engine.addHistory(next,'SYNTHETIC_CANONICAL_PREPARED_PROOF',{synthetic:true});let injected=false,expectedRows=before;
  runtime.__canonicalPreparedInjection=async prepared=>{assert.equal(prepared.options.preparedHistory.state.activeProjectSha256.length,64,'CANONICAL_PREPARED_HISTORY_BOUND');injected=true;if(scenario==='absent-prior-concurrent-create'){delete runtime.__canonicalPreparedInjection;const concurrent=copy(current);concurrent.job.JOB_TITLE='Legitimate concurrently created revision-zero project';await store.writeProject(concurrent,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});expectedRows=new Map([...r.rows].map(([name,rows])=>[name,new Map([...rows].map(([key,value])=>[key,copy(value)]))]));}else if(scenario==='prepared-candidate-mutation')prepared.project.job.JOB_TITLE='Changed private candidate after its prepared History';else clock=scenario==='expired-capability-at-commit'?expiresAt+60000:expiresAt-1;};
  const execute=()=>store.writeProject(next,{expectedProjectRevision:current.revision,expectedStateSha256:current.projectSha256,...(scenario==='absent-prior-concurrent-create'?{incrementRevision:false}:{})});
  if(scenario==='unexpired-capability-control'){const saved=await execute();assert.equal(saved.revision,current.revision+1);assert.equal(engine.gate(saved,2).complete,true,'CANONICAL_UNEXPIRED_AUTHORITY_ORACLE');assert.equal((await store.readProject(jobId)).projectSha256,saved.projectSha256);cases.push({caseId,result:'PASS',injected:true,currentAuthorityRechecked:true,conformingWriteCommitted:true});}
  else{const expected=scenario==='expired-capability-at-commit'?'PROJECT_INTEGRITY_FAILED':'STALE_PROJECT_REVISION';await assert.rejects(execute,error=>error.code===expected&&(scenario!=='expired-capability-at-commit'||error.issues?.some(issue=>/derived|Stage 2|CURRENT_STAGE|CURRENT_STATE|NEXT_REQUIRED_ACTION|observations/.test(issue))),'CANONICAL_PREPARED_REJECTION_ORACLE '+caseId);assert.deepEqual(r.rows,expectedRows,'CANONICAL_PREPARED_NO_WRITE_ORACLE '+caseId);if(scenario==='expired-capability-at-commit')assert.equal(engine.gate(current,2).complete,false,'CANONICAL_EXPIRED_AUTHORITY_BLOCKED_ORACLE');cases.push({caseId,result:'PASS',error:expected,injected:true,failedWritePreservedState:true,...(scenario==='expired-capability-at-commit'?{expiredAuthorityBlocked:true}:scenario==='absent-prior-concurrent-create'?{concurrentCreationPreserved:true}:{preparedHistoryDidNotAuthorizeChangedCandidate:true})});}
  assert.equal(injected,true,'CANONICAL_PREPARED_INJECTION_REACHED');
 }
 return cases;
}

export async function verifyCheckpointCanonicalProof({sourceOverrides={},fault=null,caseFilter=null}={}){
 const files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'],sources={...Object.fromEntries(files.map(file=>[file,fs.readFileSync(file,'utf8')])),...sourceOverrides};let source=sources['project-store.js'];
 const anchor='function applyOperationalJournal(row,journal,checkpointRead=null){';assert.equal(source.split(anchor).length,2);source=source.replace(anchor,anchor+'globalThis.__checkpointColdReplays=(globalThis.__checkpointColdReplays||0)+1;');
 if(fault==='omit-full-source-comparison'){const guard='!verifiedValuesEqual(proof.row,row)||!verifiedValuesEqual(proof.journal,journal)';assert.equal(source.split(guard).length,2);source=source.replace(guard,'false');}
 sources['project-store.js']=source;const seed=await operationalProofSeed(sources),frozen=new Map([...seed.seed.rows].map(([name,rows])=>[name,new Map([...rows].map(([key,value])=>[key,seed.copy(value)]))])),cases=[];
 for(const name of ['valid-control','same-digest-canonical-payload','same-digest-journal-payload','failed-checkpoint','concurrent-canonical','concurrent-journal','corrupt-retained-project-part']){
  if(caseFilter&&!caseFilter.includes(name))continue;const r=projectStoreRuntime({sourceOverrides:sources}),{store,engine,copy,runtime}=r;for(const[family,rows]of frozen)r.rows.set(family,new Map([...rows].map(([key,value])=>[key,copy(value)])));
  const p=await store.readProject(seed.project.job.JOB_ID),jobId=p.job.JOB_ID,view=copy({activeStage:1,activeView:'Workflow',drafts:{'#proof':{value:'Exact retained view'}},scrollX:0,scrollY:11}),beforeRows=copy([...r.rows].map(([name,rows])=>[name,[...rows]]));
  if(name==='failed-checkpoint'){runtime.__closedLoopStorageFault='during-history-write';await assert.rejects(()=>store.saveCheckpoint(jobId,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,view}),error=>error.code==='INJECTED_STORAGE_FAILURE');delete runtime.__closedLoopStorageFault;assert.deepEqual(copy([...r.rows].map(([name,rows])=>[name,[...rows]])),beforeRows,'CHECKPOINT_CANONICAL_ABORT_PRESERVES_ORACLE');}
  else await store.saveCheckpoint(jobId,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,view});
  let error=null;
  if(name==='same-digest-canonical-payload'){r.rows.get('projects').get(jobId).project.job.JOB_TITLE='Changed under unchanged digest';error='PROJECT_HASH_MISMATCH';}
  if(name==='same-digest-journal-payload'){r.rows.get('meta').get('responseOperations:'+jobId).value.patches.find(row=>!row.remove).value={corrupt:true};error='OPERATIONAL_STATE_INTEGRITY_FAILED';}
  if(name==='concurrent-canonical'||name==='concurrent-journal'){const concurrent=copy(p);engine.addHistory(concurrent,'SYNTHETIC_CONCURRENT_CHECKPOINT_CONTROL',{synthetic:true});await store.writeProject(concurrent,{operational:name==='concurrent-journal',expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});error='STALE_PROJECT_REVISION';}
  if(name==='corrupt-retained-project-part'){const history=await store.historyList(jobId),part=history.entries.findLast(e=>e.projectParts?.entries?.length).projectParts.entries.find(e=>e.path.includes('rawResponses'));assert.ok(part);const row=r.rows.get('meta').get('recovery:'+jobId+':bytes:'+part.sha256);row.value.blob=new Blob(['X'.repeat(row.value.blob.size)]);error='HISTORY_FILE_INTEGRITY_FAILED';}
  const before=Number(runtime.__checkpointColdReplays||0),next=copy(p);engine.addHistory(next,'SYNTHETIC_CHECKPOINT_CANONICAL_COMMIT',{synthetic:true});const execute=()=>store.writeProject(next,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,historyView:view});
  if(error){await assert.rejects(execute,e=>e.code===error,'CHECKPOINT_CANONICAL_REJECTION_ORACLE '+name);cases.push({caseId:name,result:'PASS',error});}
  else{const saved=await execute(),replays=Number(runtime.__checkpointColdReplays||0)-before;if(name==='valid-control')assert.equal(replays,0,'CHECKPOINT_CANONICAL_REUSE_ORACLE');else assert.ok(replays>0,'CHECKPOINT_CANONICAL_FAILED_NO_REUSE_ORACLE');assert.equal(saved.revision,p.revision+1);assert.equal((await store.readProject(jobId)).projectData.rawResponses.at(-1).completeRawResponse,seed.text);assert.equal((await store.readHistoryView(jobId)).drafts['#proof'].value,'Exact retained view');cases.push({caseId:name,result:'PASS',exactRawBytes:true,changedViewRetained:true,coldReplays:replays});}
 }
 return {result:'PASS',caseCount:cases.length,cases,boundary:'Actual successful/failed checkpoint then canonical write with real store CAS/History and isolated transaction adapter; no browser claim',sourceSha256:Object.fromEntries(files.map(file=>[file,createHash('sha256').update(sources[file]).digest('hex')]))};
}

// Canonical commits now provide the same one-use private source proof as the
// established operational/checkpoint owners. Every case makes a real canonical
// commit; the immutable prefix only prepares independent complete stores.
export async function verifyCanonicalCommitWarmProof({sourceOverrides={},fault=null,caseFilter=null}={}){
 const files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'],frozen={...Object.fromEntries(files.map(file=>[file,fs.readFileSync(file,'utf8')])),...sourceOverrides},sourceSha256=Object.fromEntries(files.map(file=>[file,createHash('sha256').update(frozen[file]).digest('hex')]));
 let source=frozen['project-store.js'];const replay='function applyOperationalJournal(row,journal,checkpointRead=null){',custody='async function observeProjectArtifactCustody(project){',expose='globalThis.closedLoopProjectStore=Object.freeze({STORAGE_IO_TIMEOUT_MS';
 for(const anchor of [replay,custody,expose])assert.equal(source.split(anchor).length,2,'CANONICAL_WARM_SOURCE_ANCHOR_ORACLE');
 source=source.replace(replay,replay+'globalThis.__canonicalWarmColdReplays=(globalThis.__canonicalWarmColdReplays||0)+1;').replace(custody,custody+'globalThis.__canonicalWarmDuringCustody?.();').replace(expose,'globalThis.__canonicalWarmRead=readProjectForTransaction;globalThis.__canonicalWarmProofExists=()=>Boolean(recentOperationalCommitRead);'+expose);
 if(fault==='omit-canonical-proof'){const anchor='if(committedRow){const privateCommitted=copyVerifiedTree(next),committedIntegrity=';assert.equal(source.split(anchor).length,2,'CANONICAL_WARM_PREBEHAVIOR_ANCHOR');source=source.replace(anchor,'if(false){const privateCommitted=copyVerifiedTree(next),committedIntegrity=');}
 const sources={...frozen,'project-store.js':source},seed=await operationalProofSeed(sources),snapshot=new Map([...seed.seed.rows].map(([name,rows])=>[name,new Map([...rows].map(([key,value])=>[key,seed.copy(value)]))])),jobId=seed.project.job.JOB_ID,cases=[];
 for(const name of ['valid-control','one-use-only','same-digest-canonical-payload','unexpected-journal','returned-project-mutation','returned-project-mutation-during-custody','public-read-remains-cold','cold-reload-remains-cold','failed-write-before-commit','failed-write-during-project-write']){
  if(caseFilter&&!caseFilter.includes(name))continue;
  const r=projectStoreRuntime({sourceOverrides:sources}),{store,engine,copy,runtime}=r;for(const[family,rows]of snapshot)r.rows.set(family,new Map([...rows].map(([key,value])=>[key,copy(value)])));
  let current=await store.readProject(jobId);const prior=copy(current),next=copy(current),view=copy({activeStage:1,activeView:'Workflow',drafts:{'#canonical-warm':{value:name}},scrollX:0,scrollY:7});engine.addHistory(next,'SYNTHETIC_CANONICAL_WARM_COMMIT',{synthetic:true});
  const cold=()=>Number(runtime.__canonicalWarmColdReplays||0),failure=name.startsWith('failed-write'),beforeRows=copy([...r.rows].map(([family,rows])=>[family,[...rows]]));
  if(failure){runtime.__closedLoopStorageFault=name==='failed-write-before-commit'?'before-transaction-commit':'during-project-write';await assert.rejects(()=>store.writeProject(next,{expectedProjectRevision:prior.revision,expectedStateSha256:prior.projectSha256}),error=>error.code==='INJECTED_STORAGE_FAILURE','CANONICAL_WARM_ABORT_ORACLE '+name);delete runtime.__closedLoopStorageFault;assert.deepEqual(copy([...r.rows].map(([family,rows])=>[family,[...rows]])),beforeRows,'CANONICAL_WARM_ABORT_PRESERVES_ROWS_ORACLE');assert.equal(runtime.__canonicalWarmProofExists(),false,'CANONICAL_WARM_ABORT_NEVER_MINTS_ORACLE');}
  else{current=await store.writeProject(next,{expectedProjectRevision:prior.revision,expectedStateSha256:prior.projectSha256});assert.equal(current.revision,prior.revision+1);assert.equal(r.rows.get('meta').has('responseOperations:'+jobId),false,'CANONICAL_WARM_JOURNAL_DELETED_ORACLE');}
  const stored=copy(current),beforeHash=stored.projectSha256;let expectedError=null,expectCold=failure;
  if(name==='same-digest-canonical-payload'){r.rows.get('projects').get(jobId).project.job.JOB_TITLE='Changed canonical payload under retained digest';expectedError='PROJECT_HASH_MISMATCH';}
  if(name==='unexpected-journal'){r.rows.get('meta').set('responseOperations:'+jobId,copy({key:'responseOperations:'+jobId,value:{schema:'closed-loop-response-operations/1',jobId,baseProjectSha256:beforeHash,projectRevision:stored.revision,patches:[],projectSha256:beforeHash,sha256:'0'.repeat(64)}}));expectedError='OPERATIONAL_STATE_INTEGRITY_FAILED';}
  if(name==='returned-project-mutation')current.projectData.rawResponses.at(-1).completeRawResponse='Caller change after canonical return';
  if(name==='returned-project-mutation-during-custody')runtime.__canonicalWarmDuringCustody=()=>{delete runtime.__canonicalWarmDuringCustody;current.projectData.rawResponses.at(-1).completeRawResponse='Caller change during custody await';};
  if(name==='public-read-remains-cold'){const before=cold();assert.equal((await store.readProject(jobId)).projectSha256,beforeHash);assert.ok(cold()>before,'CANONICAL_WARM_PUBLIC_COLD_ORACLE');expectCold=true;}
  if(name==='cold-reload-remains-cold'){const fresh=projectStoreRuntime({sourceOverrides:sources});for(const[family,rows]of r.rows)fresh.rows.set(family,new Map([...rows].map(([key,value])=>[key,fresh.copy(value)])));assert.equal((await fresh.store.readProject(jobId)).projectSha256,beforeHash);assert.ok(fresh.runtime.__canonicalWarmColdReplays>0,'CANONICAL_WARM_RELOAD_COLD_ORACLE');}
  if(name==='one-use-only'){const before=cold();await runtime.__canonicalWarmRead(jobId);assert.equal(cold(),before,'CANONICAL_WARM_FIRST_PRIVATE_READ_ORACLE');await runtime.__canonicalWarmRead(jobId);assert.ok(cold()>before,'CANONICAL_WARM_SINGLE_CONSUMPTION_ORACLE');expectCold=true;}
  const before=cold(),execute=()=>store.saveCheckpoint(jobId,{expectedProjectRevision:stored.revision,expectedStateSha256:beforeHash,view});
  if(expectedError){await assert.rejects(execute,error=>error.code===expectedError,'CANONICAL_WARM_REJECTION_ORACLE '+name);assert.ok((await store.listQuarantinedProjects()).some(row=>row.jobId===jobId),'CANONICAL_WARM_CORRUPT_SOURCE_RETAINED_ORACLE');cases.push({caseId:name,result:'PASS',error:expectedError});continue;}
  await execute();const replays=cold()-before;if(expectCold)assert.ok(replays>0,'CANONICAL_WARM_COLD_FALLBACK_ORACLE '+name);else assert.equal(replays,0,'CANONICAL_WARM_EXACT_REUSE_ORACLE '+name);
  assert.equal((await store.readProject(jobId)).projectData.rawResponses.at(-1).completeRawResponse,seed.text,'CANONICAL_WARM_EXACT_RAW_RELOAD_ORACLE');assert.equal((await store.readHistoryView(jobId)).drafts['#canonical-warm'].value,name,'CANONICAL_WARM_VIEW_PRESERVED_ORACLE');cases.push({caseId:name,result:'PASS',commandColdReplays:replays,exactRawBytes:true,failedWritePreserved:failure});
 }
 return {result:'PASS',sourceSha256,caseCount:cases.length,cases,boundary:'Actual canonical commit followed by checkpoint/read with complete isolated transaction-adapter stores; no browser or IndexedDB claim'};
}

export async function verifyStartupSelectedReadReuse({sourceOverrides={},caseFilter=null,fault=null}={}){
 const files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'],frozen={...Object.fromEntries(files.map(file=>[file,fs.readFileSync(file,'utf8')])),...sourceOverrides},sourceSha256=Object.fromEntries(files.map(file=>[file,createHash('sha256').update(frozen[file]).digest('hex')]));let source=frozen['project-store.js'];
 const coldAnchor='let computed;try{computed=await hash.sha256Chunks',expose='globalThis.closedLoopProjectStore=Object.freeze({STORAGE_IO_TIMEOUT_MS',projection=source.includes('async function refreshStoredProjectProjection(project,canonicalReadIntegrity=null){')?'async function refreshStoredProjectProjection(project,canonicalReadIntegrity=null){':'async function refreshStoredProjectProjection(project){';
 for(const anchor of [coldAnchor,expose,projection])assert.equal(source.split(anchor).length,2,'STARTUP_SELECTED_SOURCE_ANCHOR_ORACLE');
 source=source.replace(coldAnchor,"globalThis.__startupSelectedCold||={};globalThis.__startupSelectedCold[jobId]=(globalThis.__startupSelectedCold[jobId]||0)+1;"+coldAnchor).replace(expose,"globalThis.__startupSelectedPrivateRead=readProjectForTransaction;globalThis.__startupSelectedHasProof=()=>typeof STARTUP_REFRESH_READ!=='undefined'&&recentOperationalCommitRead?.requiredReadPurpose===STARTUP_REFRESH_READ;"+expose).replace(projection,projection+"globalThis.__startupSelectedProjectionCalls=(globalThis.__startupSelectedProjectionCalls||0)+1;");
 const writerFull='}else assertProjectIntegrity(next,{prior:prior?.project});';assert.equal(source.split(writerFull).length,2);source=source.replace(writerFull,'}else {globalThis.__startupMigrationWriterFull=(globalThis.__startupMigrationWriterFull||0)+1;assertProjectIntegrity(next,{prior:prior?.project});}');
 const migrationStart=source.indexOf('async function migrateJobPointerProjection('),migrationEnd=source.indexOf('async function readProject(',migrationStart);let migration=source.slice(migrationStart,migrationEnd);
 const beforeWrite="fault('before-project-transaction');const tx=";assert.equal(migration.split(beforeWrite).length,2);migration=migration.replace(beforeWrite,"if(globalThis.__startupMigrationBeforeWrite)await globalThis.__startupMigrationBeforeWrite(next);"+beforeWrite);
 if(fault==='repeat-migration-validation'){const proof=',[VERIFIED_CANONICAL_WRITE]:preparedProof';assert.equal(migration.split(proof).length,2,'STARTUP_MIGRATION_PROOF_FAULT_ANCHOR');migration=migration.replace(proof,'');}
 if(fault==='repeat-migration-digests'){const paired='const {projectSha256:digest,workSha256}=historyProjectDigests(next)',binding='verifiedDigests:[[next,digest,workSha256]]';assert.equal(migration.split(paired).length,2,'STARTUP_MIGRATION_DIGEST_FAULT_ANCHOR');assert.equal(migration.split(binding).length,2);migration=migration.replace(paired,'const digest=projectSha256(next)').replace(binding,'verifiedDigests:[[next,digest]]');}
 source=source.slice(0,migrationStart)+migration+source.slice(migrationEnd);
 const custody='async function observeProjectArtifactCustody(project){',full='function validateProjectIntegrity(project,',derived='function derivedProjectIntegrityIssues(project,';
 assert.equal(source.split(custody).length,2);source=source.replace(custody,custody+'if(globalThis.__startupSelectedDuringCustody)await globalThis.__startupSelectedDuringCustody(project);');
 source=source.replace('const issues=[],schemaApi=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine;','globalThis.__startupSelectedFull=(globalThis.__startupSelectedFull||0)+1;const issues=[],schemaApi=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine;');
 source=source.replace('const issues=[],engine=globalThis.closedLoopWorkflowEngine,schemaApi=globalThis.closedLoopWorkflowSchema;','globalThis.__startupSelectedDerived=(globalThis.__startupSelectedDerived||0)+1;const issues=[],engine=globalThis.closedLoopWorkflowEngine,schemaApi=globalThis.closedLoopWorkflowSchema;');
 if(fault==='repeat-cold-read'){const anchor='readProjectForTransaction(jobId,STARTUP_REFRESH_READ)';assert.equal(source.split(anchor).length,2);source=source.replace(anchor,'readProjectForTransaction(jobId)');}
 if(fault==='repeat-static-validation'){const anchor='currentDefinition&&unchangedVerifiedProject(canonicalReadIntegrity,project,expectedStateSha256)';assert.equal(source.split(anchor).length,2);source=source.replace(anchor,'false');}
 if(fault==='capture-after-custody'){const capture=' const canonicalReadIntegrity=readPurpose===STARTUP_REFRESH_READ&&sourceProof.current?verifiedProjectIntegrity(project,project.projectSha256):null;\n',custody='\n await observeProjectArtifactCustody(project);\n';assert.equal(source.split(capture).length,2);assert.equal(source.split(custody).length,2);source=source.replace(capture,'').replace(custody,custody+capture);}
 source=source.replace('function historyProjectDigests(project){','function historyProjectDigests(project){globalThis.__startupMigrationPairedDigests=(globalThis.__startupMigrationPairedDigests||0)+1;(globalThis.__startupMigrationDigestInputs||=[]).push({jobId:project.job.JOB_ID,revision:project.revision});').replace('function historyWorkSha256(project){','function historyWorkSha256(project){globalThis.__startupMigrationWorkDigests=(globalThis.__startupMigrationWorkDigests||0)+1;');
 const sources={...frozen,'project-store.js':source},base=projectStoreRuntime({sourceOverrides:sources}),p=await base.store.createProject({commandId:'SYNTHETIC-STARTUP-SELECTED'}),other=await base.store.createProject({commandId:'SYNTHETIC-STARTUP-OTHER'}),jobId=p.job.JOB_ID,otherId=other.job.JOB_ID;
 await base.store.metaPut('selectedProject',jobId);
 const snapshot=r=>new Map([...r.rows].map(([family,rows])=>[family,new Map([...rows].map(([key,value])=>[key,r.copy(value)]))])),prefix=snapshot(base),clonePrefix=()=>{const r=projectStoreRuntime({sourceOverrides:sources});for(const[family,rows]of prefix)r.rows.set(family,new Map([...rows].map(([key,value])=>[key,r.copy(value)])));return r;},cases=[];
 for(const name of ['boundaries-control','raw-recovery-control','default-public-cold','private-purpose-cold','nonselected-cold','same-digest-row-tamper','journal-tamper','concurrent-revision','current-custody-control','missing-current-bytes','invalid-current-projection','failed-recovery','migration','migration-public-control','migration-digest-control','migration-source-changed','migration-journal-changed','migration-candidate-changed','migration-candidate-owner-changed','migration-interrupted','no-selected','mutation-during-custody','definition-during-custody','derived-during-custody']){
  if(caseFilter&&!caseFilter.includes(name))continue;let r=clonePrefix(),current=p,target=jobId;const {store,engine,copy,runtime}=r;let staged=null,artifactId=null;
  if(name.startsWith('migration')){let legacy=r.core.createBlankState('SYNTHETIC-STARTUP-LEGACY-DEFAULTS');engine.ensureShape(legacy);for(const field of ['EXACT_DELIVERABLE_REQUESTED','ASSUMPTIONS','UNKNOWN_INFORMATION','INPUT_SET_CONTENTS'])legacy.job[field]='';engine.recalculate(legacy);current=await store.writeProject(legacy,{expectedProjectRevision:0,createOnly:true});target=current.job.JOB_ID;await store.metaPut('selectedProject',target);}
  if(name==='current-custody-control'||name==='missing-current-bytes'){
   current=await store.readProject(target);const input='Synthetic current supplied input',blob=new Blob([input],{type:'text/plain'}),filename='startup-input.txt';artifactId=engine.allocateId(current,'artifacts');const stored=await store.putArtifact({artifactId,jobId:target,filename,mediaType:blob.type,blob});engine.registerArtifactBytes(current,{stage:1,artifactId,filename,mediaType:blob.type,byteSize:blob.size,sha256:stored.sha256});current.stages[1].authorizedFiles.push(copy({artifactId,filename,sha256:stored.sha256,byteSize:blob.size,mediaType:blob.type}));current=await store.writeProject(current,{expectedProjectRevision:current.revision});current=await store.readProject(target);assert.equal(engine.timingArtifactAvailability(current,artifactId),'TRUE','STARTUP_SELECTED_CUSTODY_PRIMED_ORACLE');
  }
  if(name==='raw-recovery-control'||name==='failed-recovery'){staged=await store.stageResponseFile({jobId:target,stage:1,blob:new Blob(['{"synthetic":"retained raw bytes"}'],{type:'application/json'}),rawFilename:'response.json',mediaType:'application/json',promptIdentity:null,packageId:null,operationReservationId:null,challengeNonce:null});r.rows.get('meta').delete('responseStaging:'+target+':'+staged.stagingId);}
  if(name==='no-selected')await store.metaPut('selectedProject',null);
  // A cold ordinary read clears prior commit proof without activating the
  // intentional legacy constructor fixture before recovery sees it.
  if(!name.startsWith('migration'))await store.readProject(target);else await store.readProject(otherId);
  runtime.__startupSelectedCold={};const cold=()=>Number(runtime.__startupSelectedCold[target]||0);runtime.__startupSelectedProjectionCalls=0;runtime.__startupSelectedFull=0;
  runtime.__startupMigrationWriterFull=0;
  if(name==='migration-public-control'||name==='migration-digest-control'){
   runtime.__startupMigrationPairedDigests=0;runtime.__startupMigrationWorkDigests=0;runtime.__startupMigrationDigestInputs=[];
   const result=await store.readProject(target);assert.ok(result.revision>current.revision,'STARTUP_MIGRATION_PUBLIC_CONTROL_REVISION_ORACLE');assert.equal(store.validateProjectIntegrity(result).valid,true,'STARTUP_MIGRATION_PUBLIC_CONTROL_INTEGRITY_ORACLE');assert.equal(runtime.__startupMigrationWriterFull,0,'STARTUP_MIGRATION_VERIFIED_WRITE_REUSE_ORACLE');assert.ok(result.projectData.migrationArchives.some(row=>row.kind==='LEGACY_UNACCEPTED_AGENT_JOB_DEFAULTS'),'STARTUP_MIGRATION_ORIGINAL_DEFAULTS_ARCHIVED_ORACLE');if(name==='migration-digest-control'){
    const state=await store.historyList(target),entry=state.entries.find(row=>row.id===state.activeId),canonical=copy(result),work=copy(result);delete canonical.projectSha256;for(const key of ['projectSha256','projectHash','revision','historyActivationId','restoredCandidates','activeView','activeStage'])delete work[key];
    const independent=value=>createHash('sha256').update(runtime.closedLoopHash.stableStringify(value)).digest('hex');
    assert.equal(result.projectSha256,independent(canonical),'STARTUP_MIGRATION_CANONICAL_PREIMAGE_ORACLE');assert.equal(entry.workSha256,independent(work),'STARTUP_MIGRATION_WORK_PREIMAGE_ORACLE');
    // The retained active checkpoint is now verified before its view is
    // carried forward. Preserve the original one-traversal invariant for the
    // new canonical revision; separately account for its distinct source root.
    assert.equal(runtime.__startupMigrationDigestInputs.filter(row=>row.jobId===target&&row.revision===result.revision).length,1,'STARTUP_MIGRATION_SINGLE_DIGEST_TRAVERSAL_ORACLE');assert.equal(runtime.__startupMigrationWorkDigests,0,'STARTUP_MIGRATION_NO_REPEAT_WORK_DIGEST_ORACLE');
    assert.equal(runtime.__startupMigrationDigestInputs.filter(row=>row.jobId===target&&row.revision===current.revision).length,1,'STARTUP_MIGRATION_RETAINED_SOURCE_DIGEST_ORACLE');assert.equal(runtime.__startupMigrationPairedDigests,2,'STARTUP_MIGRATION_DISTINCT_SOURCE_AND_NEXT_DIGESTS_ORACLE');
    cases.push({caseId:name,result:'PASS',currentCanonicalValid:true,originalDefaultsArchived:true,normalPublicMigration:true,coldReads:cold(),pairedDigestTraversals:2,nextRevisionDigestTraversals:1,retainedSourceDigestTraversals:1,repeatedWorkDigests:0,independentCanonicalAndWorkPreimages:true});continue;
   }
   cases.push({caseId:name,result:'PASS',currentCanonicalValid:true,originalDefaultsArchived:true,normalPublicMigration:true,coldReads:cold()});continue;
  }
  if(name.startsWith('migration-')){
   const beforeProject=copy(r.rows.get('projects').get(target)),beforeHistory=copy(r.rows.get('meta').get('recovery:'+target)),beforeOwnerRows=name==='migration-candidate-owner-changed'?snapshot(r):null;let invoked=false;
   runtime.__startupMigrationBeforeWrite=async candidate=>{invoked=true;if(name==='migration-source-changed')r.rows.get('projects').get(target).project.job.JOB_TITLE='Concurrent source bytes';if(name==='migration-journal-changed')r.rows.get('meta').set('responseOperations:'+target,{key:'responseOperations:'+target,value:{changed:true}});if(name==='migration-candidate-changed')candidate.stageCount=29;if(name==='migration-candidate-owner-changed'){assert.notEqual(candidate.job.JOB_ID,otherId,'STARTUP_MIGRATION_DISTINCT_OWNER_PREREQUISITE');assert.ok(r.rows.get('projects').has(otherId),'STARTUP_MIGRATION_OTHER_OWNER_EXISTS_PREREQUISITE');candidate.job.JOB_ID=otherId;}if(name==='migration-interrupted')runtime.__closedLoopStorageFault='during-history-write';};
   const expected=name==='migration-interrupted'?'INJECTED_STORAGE_FAILURE':'STALE_PROJECT_REVISION';await assert.rejects(()=>store.readProject(target),error=>error.code===expected,'STARTUP_MIGRATION_REJECTION_ORACLE '+name);delete runtime.__closedLoopStorageFault;
   assert.equal(invoked,true,'STARTUP_MIGRATION_FAULT_REACHED_ORACLE');assert.equal(runtime.__startupSelectedHasProof(),false,'STARTUP_MIGRATION_FAILED_NO_PROOF_ORACLE');
   const expectedProject=copy(beforeProject);if(name==='migration-source-changed')expectedProject.project.job.JOB_TITLE='Concurrent source bytes';assert.deepEqual(r.rows.get('projects').get(target),expectedProject,'STARTUP_MIGRATION_FAILURE_PRESERVES_SOURCE_ORACLE');assert.deepEqual(r.rows.get('meta').get('recovery:'+target),beforeHistory,'STARTUP_MIGRATION_FAILURE_PRESERVES_HISTORY_ORACLE');
   if(beforeOwnerRows)assert.deepEqual(r.rows,beforeOwnerRows,'STARTUP_MIGRATION_WRONG_OWNER_PRESERVES_ALL_STORES_ORACLE');
   cases.push({caseId:name,result:'PASS',error:expected,faultReached:true,sourcePreserved:true,historyPreserved:true,coldReads:cold(),...(beforeOwnerRows?{changedCandidateIdentityRejected:true,allStoreFamiliesPreserved:true,noStartupReadProof:true,sourceRevision:beforeProject.revision,preparedRevision:beforeProject.revision+1,otherOwnerRevision:beforeOwnerRows.get('projects').get(otherId).revision}:{})});continue;
  }
  let recovery;if(name==='failed-recovery'){runtime.__closedLoopStorageFault='during-response-staging-recovery';await assert.rejects(()=>store.recoverResponseStaging(),e=>e.code==='INJECTED_STORAGE_FAILURE','STARTUP_SELECTED_FAILED_RECOVERY_ORACLE');delete runtime.__closedLoopStorageFault;assert.equal(runtime.__startupSelectedHasProof(),false,'STARTUP_SELECTED_FAILURE_NO_PROOF_ORACLE');}else recovery=await store.recoverResponseStaging();
  const recoveryFullValidationCalls=runtime.__startupSelectedFull,recoveryReads=cold();assert.ok(recoveryReads>=1,'STARTUP_SELECTED_REAL_RECOVERY_READ_ORACLE '+name);
  if(name==='raw-recovery-control')assert.equal(recovery.find(row=>row.stagingId===staged.stagingId)?.outcome,'METADATA_RECOVERED','STARTUP_SELECTED_RAW_LOOP_RECOVERED_ORACLE');
  if(name==='migration'){assert.equal(runtime.__startupMigrationWriterFull,0,'STARTUP_MIGRATION_VERIFIED_WRITE_REUSE_ORACLE');assert.ok(r.rows.get('projects').get(target).revision>current.revision,'STARTUP_SELECTED_REAL_MIGRATION_ORACLE');assert.equal(runtime.__startupSelectedHasProof(),false,'STARTUP_SELECTED_MIGRATION_NO_PROOF_ORACLE');}
  if(name==='no-selected')assert.equal(runtime.__startupSelectedHasProof(),false,'STARTUP_SELECTED_ABSENT_SELECTION_NO_PROOF_ORACLE');
  let expectedError=null;
  if(name==='same-digest-row-tamper'){r.rows.get('projects').get(target).project.job.JOB_TITLE='Changed canonical bytes';expectedError='PROJECT_HASH_MISMATCH';}
  if(name==='journal-tamper'){const row=r.rows.get('projects').get(target);r.rows.get('meta').set('responseOperations:'+target,copy({key:'responseOperations:'+target,value:{schema:'closed-loop-response-operations/1',jobId:target,baseProjectSha256:row.projectSha256,projectRevision:row.revision,patches:[],projectSha256:row.projectSha256,sha256:'0'.repeat(64)}}));expectedError='OPERATIONAL_STATE_INTEGRITY_FAILED';}
  if(name==='concurrent-revision'){const remote=projectStoreRuntime({sourceOverrides:sources});for(const[family,rows]of r.rows)remote.rows.set(family,new Map([...rows].map(([key,value])=>[key,remote.copy(value)])));const changed=await remote.store.readProject(target);changed.job.JOB_TITLE='Legitimate concurrent title';current=await remote.store.writeProject(changed,{expectedProjectRevision:changed.revision,expectedStateSha256:changed.projectSha256});for(const[family,rows]of remote.rows)r.rows.set(family,new Map([...rows].map(([key,value])=>[key,copy(value)])));}
  if(name==='missing-current-bytes'){r.rows.get('artifacts').delete(artifactId);expectedError='PACKAGE_ARTIFACT_CUSTODY_MISMATCH';}
  let custodyMutation=false;if(name.endsWith('-during-custody')){runtime.__startupSelectedDuringCustody=async project=>{delete runtime.__startupSelectedDuringCustody;custodyMutation=true;if(name==='mutation-during-custody')project.stageCount=29;if(name==='definition-during-custody')project.projectData.applicationProjection.receipt.derivationId='SYNTHETIC_UNREGISTERED_DEFINITION';if(name==='derived-during-custody')project.stages[1].gate.complete=true;};expectedError='PROJECT_INTEGRITY_FAILED';}
  if(name==='invalid-current-projection'){const row=r.rows.get('projects').get(target);row.project.stages[1].gate.complete=true;row.projectSha256=store.projectSha256(row.project);expectedError='PROJECT_INTEGRITY_FAILED';}
  const before=cold(),beforeStored=copy(r.rows.get('projects').get(target));runtime.__startupSelectedFull=0;runtime.__startupSelectedDerived=0;let result;
  if(name==='default-public-cold'){result=await store.readProject(target);assert.equal(cold(),before+1,'STARTUP_SELECTED_DEFAULT_PUBLIC_COLD_ORACLE');}
  else if(name==='private-purpose-cold'){result=(await runtime.__startupSelectedPrivateRead(target)).project;assert.equal(cold(),before+1,'STARTUP_SELECTED_WRONG_PURPOSE_COLD_ORACLE');}
  else if(name==='nonselected-cold'){const otherBefore=Number(runtime.__startupSelectedCold[otherId]||0),read=await store.readProject(otherId,{refreshProjection:true});assert.equal(read.job.JOB_ID,otherId);assert.equal(Number(runtime.__startupSelectedCold[otherId]),otherBefore+1,'STARTUP_SELECTED_OTHER_OWNER_COLD_ORACLE');result=await store.readProject(target,{refreshProjection:true});assert.equal(cold(),before+1,'STARTUP_SELECTED_WRONG_OWNER_CONSUMES_PROOF_ORACLE');}
  else if(expectedError){await assert.rejects(()=>store.readProject(target,{refreshProjection:true}),e=>e.code===expectedError,'STARTUP_SELECTED_REJECTION_ORACLE '+name);if(['same-digest-row-tamper','journal-tamper','invalid-current-projection'].includes(name))assert.ok(cold()>before,'STARTUP_SELECTED_CHANGED_SOURCE_COLD_ORACLE');else if(name!=='missing-current-bytes')assert.equal(cold(),before,'STARTUP_SELECTED_VALID_SOURCE_REUSE_ORACLE '+name);if(name.endsWith('-during-custody')){assert.equal(custodyMutation,true);assert.ok(runtime.__startupSelectedFull>0,'STARTUP_SELECTED_MUTATION_FULL_FALLBACK_ORACLE');}if(['same-digest-row-tamper','journal-tamper','invalid-current-projection'].includes(name))assert.ok((await store.listQuarantinedProjects()).some(row=>row.jobId===target),'STARTUP_SELECTED_CORRUPT_SOURCE_RETAINED_ORACLE');else assert.deepEqual(r.rows.get('projects').get(target),beforeStored,'STARTUP_SELECTED_REJECTION_PRESERVES_SOURCE_ORACLE');cases.push({caseId:name,result:'PASS',error:expectedError,recoveryColdReads:recoveryReads,fullValidationCalls:runtime.__startupSelectedFull,derivedValidationCalls:runtime.__startupSelectedDerived,...(name.endsWith('-during-custody')?{custodyMutation:true}:{})});continue;}
  else result=await store.readProject(target,{refreshProjection:true});
  assert.equal(result.job.JOB_ID,target);
  if(['boundaries-control','raw-recovery-control','current-custody-control'].includes(name)){assert.equal(recoveryReads,1);assert.equal(cold(),1,'STARTUP_SELECTED_SINGLE_COLD_ORACLE '+name);assert.ok(runtime.__startupSelectedProjectionCalls>0,'STARTUP_SELECTED_CURRENT_PROJECTION_ORACLE');if(name==='boundaries-control'){assert.equal(runtime.__startupSelectedFull,0,'STARTUP_SELECTED_STATIC_REUSE_ORACLE');assert.ok(runtime.__startupSelectedDerived>0,'STARTUP_SELECTED_DERIVED_STILL_CURRENT_ORACLE');}}
  if(['failed-recovery','migration','no-selected','concurrent-revision'].includes(name))assert.ok(cold()>before,'STARTUP_SELECTED_REQUIRED_FALLBACK_ORACLE '+name);
  if(name==='concurrent-revision'){assert.equal(result.revision,current.revision);assert.equal(result.projectSha256,current.projectSha256);assert.equal(result.job.JOB_TITLE,'Legitimate concurrent title');}
  if(artifactId){assert.equal(engine.timingArtifactAvailability(result,artifactId),name==='missing-current-bytes'?'UNKNOWN':'TRUE','STARTUP_SELECTED_CURRENT_CUSTODY_ORACLE');assert.ok(runtime.__startupSelectedProjectionCalls>0);}
  cases.push({caseId:name,result:'PASS',recoveryColdReads:recoveryReads,recoveryFullValidationCalls,...(name==='migration'?{verifiedMigrationWriteReused:runtime.__startupMigrationWriterFull===0}:{}),totalColdReads:cold(),fullValidationCalls:runtime.__startupSelectedFull,derivedValidationCalls:runtime.__startupSelectedDerived,currentProjectionChecked:runtime.__startupSelectedProjectionCalls>0,...(artifactId?{currentCustody:engine.timingArtifactAvailability(result,artifactId)}:{})});
 }
 return {result:'PASS',actualBrowser:false,sourceSha256,caseCount:cases.length,cases,boundary:'Production recovery, canonical reads, custody, migration and projection through isolated transaction adapter; no browser latency claim'};
}

// Persistent regressions for the two independently reproduced startup hook
// faults. These are genuine public recovery/read owners through the isolated
// transaction adapter, not native-browser or whole-clause execution evidence.
export async function verifyStartupRecoveryHookIsolation({sourceOverrides={},caseFilter=null,fault=null}={}){
 const files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'],frozen={...Object.fromEntries(files.map(file=>[file,fs.readFileSync(file,'utf8')])),...sourceOverrides},sourceSha256=Object.fromEntries(files.map(file=>[file,createHash('sha256').update(frozen[file]).digest('hex')]));let source=frozen['project-store.js'];
 if(fault){
  assert(['capture-after-context-hook','source-recovery-input-sync','source-recovery-input-queued'].includes(fault),'STARTUP_RECOVERY_HOOK_KNOWN_FAULT_ORACLE');
  const start='const readRecoveryProject=async owner=>{',end='\n };';assert.equal(source.split(start).length,2,'STARTUP_RECOVERY_HOOK_SOURCE_ANCHOR_ORACLE');const offset=source.indexOf(start),finish=source.indexOf(end,offset);assert(finish>offset,'STARTUP_RECOVERY_HOOK_SOURCE_END_ORACLE');let body=source.slice(offset,finish);
  const replace=(before,after)=>{assert.equal(body.split(before).length,2,'STARTUP_RECOVERY_HOOK_FAULT_ANCHOR_ORACLE '+fault);body=body.replace(before,after);};
  if(fault==='capture-after-context-hook'){
   replace('const privateProject=copyVerifiedTree(project),integrity=verifiedProjectIntegrity(privateProject,privateProject.projectSha256),recoveryProject=copyVerifiedTree(project);','const privateProject=copyVerifiedTree(project),recoveryProject=copyVerifiedTree(project);');
   const hook='globalThis.closedLoopPromptEngine?.copyRetainedPromptContextFiles?.(project,privateProject);';replace(hook,hook+'const integrity=verifiedProjectIntegrity(privateProject,privateProject.projectSha256);');
  }else replace('return recoveryProject;','return project;');
  source=source.slice(0,offset)+body+source.slice(finish);
 }
 const cases=[],names=['healthy-hook','target-mutation','source-sync','source-queued'];
 for(const caseId of names){
  if(caseFilter&&!caseFilter.includes(caseId))continue;
  const r=projectStoreRuntime({storageWorker:false,sourceOverrides:{...frozen,'project-store.js':source}});await r.store.ready;
  const project=await r.store.createProject({commandId:'SYNTHETIC-STARTUP-HOOK-'+caseId}),jobId=project.job.JOB_ID;await r.store.metaPut('selectedProject',jobId);
  const text='{"synthetic":"exact staged startup hook bytes"}',sourceInputSha256=createHash('sha256').update(text).digest('hex'),identity={instructionId:'SYNTHETIC-UNISSUED-PROMPT',bodySha256:'1'.repeat(64),contractSha256:'2'.repeat(64),contextSignature:'3'.repeat(64)};
  const staged=await r.store.stageResponseFile({jobId,stage:1,blob:new Blob([text],{type:'application/json'}),rawFilename:'startup-hook.json',mediaType:'application/json',promptIdentity:identity,packageId:'SYNTHETIC-PACKAGE',operationReservationId:'SYNTHETIC-RESERVATION',challengeNonce:'SYNTHETIC-NONCE'});
  assert.equal(staged.sha256,sourceInputSha256,'STARTUP_RECOVERY_HOOK_INPUT_HASH_ORACLE '+caseId);
  // Existing raw-recovery fixture pattern: delete only staging metadata while
  // retaining the exact original RAW archive and its identity/descriptor.
  assert(r.rows.get('meta').delete('responseStaging:'+jobId+':'+staged.stagingId),'STARTUP_RECOVERY_HOOK_STAGED_METADATA_ORACLE '+caseId);
  const before=await r.store.readProject(jobId);assert.equal(before.projectData.rawResponses.length,0,'STARTUP_RECOVERY_HOOK_UNRECORDED_FIXTURE_ORACLE '+caseId);
  const canonicalBefore=r.copy(r.rows.get('projects').get(jobId)),artifactsBefore=new Map([...r.rows.get('artifacts')].map(([key,value])=>[key,r.copy(value)])),original=r.runtime.closedLoopPromptEngine;let hookCalls=0,mutations=0;
  r.runtime.closedLoopPromptEngine=Object.freeze({...original,copyRetainedPromptContextFiles(from,to,...rest){
   const result=Reflect.apply(original.copyRetainedPromptContextFiles,original,[from,to,...rest]);
   if(from?.job?.JOB_ID===jobId&&from!==to&&from?.projectData?.rawResponses){
    hookCalls++;
    if(caseId==='target-mutation'){to.stages[1].responseDraft='SYNTHETIC-TARGET-HOOK-MUTATION';mutations++;}
    if(caseId==='source-sync'||caseId==='source-queued'){
     const inject=()=>{from.projectData.rawResponses.push(r.copy({jobId,stage:1,sha256:staged.sha256,completeRawResponse:text,promptInstructionId:identity.instructionId,promptBodySha256:identity.bodySha256,promptContractSha256:identity.contractSha256,promptContextSignature:identity.contextSignature,transport:{packageId:staged.packageId,operationReservationId:staged.operationReservationId,challengeNonce:staged.challengeNonce}}));mutations++;};
     if(caseId==='source-queued')queueMicrotask(inject);else inject();
    }
   }
   return result;
  }});
  let recovered;try{recovered=await r.store.recoverResponseStaging();}finally{r.runtime.closedLoopPromptEngine=original;}
  assert.equal(hookCalls,1,'STARTUP_RECOVERY_HOOK_COUNT_ORACLE '+caseId);assert.equal(mutations,caseId==='healthy-hook'?0:1,'STARTUP_RECOVERY_HOOK_MUTATION_EXECUTED_ORACLE '+caseId);
  const receipt=recovered.find(row=>row.stagingId===staged.stagingId),durable=(await r.store.listResponseStagingRecovery(jobId)).find(row=>row.stagingId===staged.stagingId);assert(receipt&&durable,'STARTUP_RECOVERY_HOOK_RECEIPTS_PRESENT_ORACLE '+caseId);
  const selected=await r.store.readProject(jobId,{refreshProjection:true});
  assert.equal(selected.stages[1].responseDraft,before.stages[1].responseDraft,'STARTUP_RECOVERY_HOOK_PROJECT_ORACLE '+caseId);
  assert.equal(selected.projectSha256,r.store.projectSha256(selected),'STARTUP_RECOVERY_HOOK_DIGEST_ORACLE '+caseId);
  assert.equal(selected.projectData.rawResponses.length,0,'STARTUP_RECOVERY_HOOK_CANONICAL_RAW_ORACLE '+caseId);
  for(const row of [receipt,durable]){assert.equal(row.outcome,'BLOCKED','STARTUP_RECOVERY_HOOK_RECEIPT_ORACLE '+caseId);assert.equal(row.code,'RESPONSE_STAGE_PROMPT_IDENTITY_MISMATCH','STARTUP_RECOVERY_HOOK_RECEIPT_CODE_ORACLE '+caseId);}
  const cold=await r.store.readProject(jobId);assert.equal(cold.projectSha256,r.store.projectSha256(cold),'STARTUP_RECOVERY_HOOK_COLD_DIGEST_ORACLE '+caseId);assert.equal(cold.projectSha256,selected.projectSha256,'STARTUP_RECOVERY_HOOK_COLD_PARITY_ORACLE '+caseId);assert.equal(cold.stages[1].responseDraft,before.stages[1].responseDraft,'STARTUP_RECOVERY_HOOK_COLD_DRAFT_ORACLE '+caseId);
  const archive=await r.store.getArtifact('RAW-'+staged.stagingId);assert(archive&&archive.jobId===jobId&&archive.sha256===sourceInputSha256,'STARTUP_RECOVERY_HOOK_ARCHIVE_IDENTITY_ORACLE '+caseId);assert.equal(await archive.blob.text(),text,'STARTUP_RECOVERY_HOOK_ARCHIVE_BYTES_ORACLE '+caseId);
  assert.deepEqual(r.rows.get('projects').get(jobId),canonicalBefore,'STARTUP_RECOVERY_HOOK_CANONICAL_ROW_ORACLE '+caseId);assert.deepEqual(r.rows.get('artifacts'),artifactsBefore,'STARTUP_RECOVERY_HOOK_ARTIFACT_ROWS_ORACLE '+caseId);
  cases.push({caseId,result:'PASS',hookCalls,mutations,returnedOutcome:receipt.outcome,returnedCode:receipt.code,durableOutcome:durable.outcome,durableCode:durable.code,canonicalRawResponseCount:selected.projectData.rawResponses.length,projectDigestAuthentic:true,returnedDraftMatchesPersisted:true,coldReadMatches:true,canonicalRowUnchanged:true,artifactRowsUnchanged:true,exactRawArchive:true,sourceInputSha256});
 }
 return {schema:'startup-recovery-hook-isolation/1',checkId:'store.startup-recovery-hook-isolation',result:'PASS',synthetic:true,actualBrowser:false,nativeIndexedDB:false,actualStorageAdapter:true,actualStorageWorker:false,fullClauseProof:false,sourceSha256,caseCount:cases.length,cases,boundary:'Public selected recovery and refreshed/cold reads through isolated transaction adapter; no native browser or whole-clause claim'};
}

// A no-op save may preserve the measured source identity only when its actual
// context-copy destination is still that value, including across persistence.
export async function verifyCanonicalNoopHookIsolation({sourceOverrides={},caseFilter=null,fault=null}={}){
 const files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'],frozen={...Object.fromEntries(files.map(file=>[file,fs.readFileSync(file,'utf8')])),...sourceOverrides},sourceSha256=Object.fromEntries(files.map(file=>[file,createHash('sha256').update(frozen[file]).digest('hex')]));let source=frozen['project-store.js'];
 if(fault){
  assert(['omit-target-value-binding','capture-after-prompt-persistence','omit-final-prepared-clone-check'].includes(fault),'CANONICAL_NOOP_HOOK_KNOWN_FAULT_ORACLE');
  const replace=(before,after)=>{assert.equal(source.split(before).length,2,'CANONICAL_NOOP_HOOK_FAULT_ANCHOR_ORACLE '+fault);source=source.replace(before,after);};
  if(fault==='omit-target-value-binding')replace("    if(!verifiedValuesEqual(canonicalProject(candidateProof.snapshot),canonicalProject(next)))throw storageError('The prepared project changed before commit. Prepare the current candidate again.','STALE_PROJECT_REVISION');\n",'');
  if(fault==='capture-after-prompt-persistence')replace('    const integrity=verifiedProjectIntegrity(next,candidateDigest);await persistProjectPromptFiles(next);','    await persistProjectPromptFiles(next);const integrity=verifiedProjectIntegrity(next,candidateDigest);');
  if(fault==='omit-final-prepared-clone-check')replace('if(skipUnchanged&&prior?.projectSha256===(preparedDigest||projectSha256(next))){if(preparedHistory)await commitHistory(tx,preparedHistory);assertPreparedClone();next.projectSha256=prior.projectSha256;','if(skipUnchanged&&prior?.projectSha256===(preparedDigest||projectSha256(next))){if(preparedHistory)await commitHistory(tx,preparedHistory);next.projectSha256=prior.projectSha256;');
 }
 const cases=[];
 for(const caseId of ['healthy-hook','target-sync','target-queued','final-prepared-clone']){
  if(caseFilter&&!caseFilter.includes(caseId))continue;
  const r=projectStoreRuntime({storageWorker:false,sourceOverrides:{...frozen,'project-store.js':source}});await r.store.ready;
  let current=await r.store.createProject({commandId:'SYNTHETIC-CANONICAL-NOOP-'+caseId});current=await r.store.readProject(current.job.JOB_ID);
  const input=r.copy(current),jobId=current.job.JOB_ID,title=current.job.JOB_TITLE,digest=current.projectSha256,prompt=r.runtime.closedLoopPromptEngine,before=r.copy([...r.rows].map(([name,map])=>[name,[...map]])),canonicalBefore=r.copy(r.rows.get('projects').get(jobId)),journalBefore=r.copy(r.rows.get('meta').get('responseOperations:'+jobId)),historyBefore=r.copy(r.rows.get('meta').get('recovery:'+jobId));
  let candidate=null,target=null,candidateCaptures=0,targetCalls=0,finalCloneCalls=0,mutations=0,returned=null,error=null;
  const mutate=project=>{project.job.JOB_TITLE='SYNTHETIC UNCOMMITTED NOOP TITLE';mutations++;};
  r.runtime.closedLoopPromptEngine=Object.freeze({...prompt,copyRetainedPromptContextFiles(from,to,...rest){
   const result=Reflect.apply(prompt.copyRetainedPromptContextFiles,prompt,[from,to,...rest]);
   if(from===input){candidate=to;candidateCaptures++;}
   else if(from===candidate&&!target){target=to;targetCalls++;if(caseId==='target-sync')mutate(to);if(caseId==='target-queued')queueMicrotask(()=>mutate(to));}
   else if(from===target){finalCloneCalls++;if(caseId==='final-prepared-clone')mutate(to);}
   return result;
  }});
  try{returned=await r.store.writeProject(input,{skipUnchanged:true,expectedProjectRevision:current.revision,expectedStateSha256:digest,historyView:r.copy({activeStage:1,activeView:'Workflow',drafts:{'#response-note':{value:caseId}},scrollX:0,scrollY:29})});}catch(caught){error=caught;}finally{r.runtime.closedLoopPromptEngine=prompt;}
  assert.equal(candidateCaptures,1,'CANONICAL_NOOP_HOOK_CANDIDATE_CAPTURE_ORACLE '+caseId);assert.equal(targetCalls,1,'CANONICAL_NOOP_HOOK_TARGET_COPY_ORACLE '+caseId);assert.equal(mutations,caseId==='healthy-hook'?0:1,'CANONICAL_NOOP_HOOK_MUTATION_REACHED_ORACLE '+caseId);
  assert.equal(input.job.JOB_TITLE,title,'CANONICAL_NOOP_HOOK_PUBLIC_INPUT_ORACLE '+caseId);assert.equal(candidate.job.JOB_TITLE,title,'CANONICAL_NOOP_HOOK_CANDIDATE_INPUT_ORACLE '+caseId);
  const rejected=caseId!=='healthy-hook';
  if(rejected){assert.equal(error?.code,'STALE_PROJECT_REVISION','CANONICAL_NOOP_HOOK_REJECTION_ORACLE '+caseId);assert.equal(returned,null,'CANONICAL_NOOP_HOOK_NO_BAD_RETURN_ORACLE '+caseId);assert.deepEqual(r.copy([...r.rows].map(([name,map])=>[name,[...map]])),before,'CANONICAL_NOOP_HOOK_DURABLE_ROLLBACK_ORACLE '+caseId);}
  else{assert.equal(error,null,'CANONICAL_NOOP_HOOK_HEALTHY_OWNER_ORACLE');assert.equal(returned?.projectSha256,r.store.projectSha256(returned),'CANONICAL_NOOP_HOOK_RETURNED_DIGEST_ORACLE');assert.equal(returned.projectSha256,digest);assert.equal(returned.job.JOB_TITLE,title);}
  assert.equal(finalCloneCalls,['healthy-hook','final-prepared-clone'].includes(caseId)?1:0,'CANONICAL_NOOP_HOOK_FINAL_CLONE_ORACLE '+caseId);
  assert.deepEqual(r.rows.get('projects').get(jobId),canonicalBefore,'CANONICAL_NOOP_HOOK_CANONICAL_ROW_ORACLE '+caseId);assert.deepEqual(r.rows.get('meta').get('responseOperations:'+jobId),journalBefore,'CANONICAL_NOOP_HOOK_JOURNAL_ORACLE '+caseId);
  const historyAfter=r.rows.get('meta').get('recovery:'+jobId);assert.equal(historyAfter.value.title,String(title||''),'CANONICAL_NOOP_HOOK_HISTORY_TITLE_ORACLE '+caseId);assert.equal(historyAfter.value.generation,historyBefore.value.generation+(rejected?0:1),'CANONICAL_NOOP_HOOK_HISTORY_GENERATION_ORACLE '+caseId);
  const cold=await r.store.readProject(jobId);assert.equal(cold.projectSha256,r.store.projectSha256(cold),'CANONICAL_NOOP_HOOK_COLD_DIGEST_ORACLE '+caseId);assert.equal(cold.projectSha256,digest);assert.equal(cold.job.JOB_TITLE,title);
  cases.push({caseId,result:'PASS',candidateCaptures,targetCalls,finalCloneCalls,mutations,rejected,errorCode:error?.code||null,noIncorrectReturnedValue:true,sourceInputUnchanged:true,canonicalRowUnchanged:true,journalRowUnchanged:true,historyTitleAuthentic:true,historyGenerationDelta:historyAfter.value.generation-historyBefore.value.generation,rejectionStoresUnchanged:rejected,coldReadAuthentic:true,sourceProjectSha256:digest});
 }
 return {schema:'canonical-noop-hook-isolation/1',checkId:'store.canonical-noop-hook-isolation',result:'PASS',synthetic:true,actualBrowser:false,nativeIndexedDB:false,actualStorageAdapter:true,actualStorageWorker:false,fullClauseProof:false,sourceSha256,caseCount:cases.length,cases,boundary:'Public canonical no-op save and exact durable History through isolated transaction adapter; no native browser or whole-clause claim'};
}

// The synthetic adapter completes its actual put before the retained hook
// target changes. Native completion coverage remains a separate owner.
export async function verifyCanonicalCompletionHookIsolation({sourceOverrides={},caseFilter=null,fault=null}={}){
 const files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'],frozen={...Object.fromEntries(files.map(file=>[file,fs.readFileSync(file,'utf8')])),...sourceOverrides},sourceSha256=Object.fromEntries(files.map(file=>[file,createHash('sha256').update(frozen[file]).digest('hex')]));let source=frozen['project-store.js'];
 if(fault==='omit-completion-return-binding'){assert.equal(source.split('assertCommittedReturn();').length,3,'CANONICAL_COMPLETION_HOOK_FAULT_ANCHOR');source=source.replaceAll('assertCommittedReturn();','');}
 else if(fault==='omit-context-source-return-binding'){const anchor='globalThis.closedLoopPromptEngine?.copyRetainedPromptContextFiles?.(next,privateCommitted);assertCommittedReturn();recentOperationalCommitRead=';assert.equal(source.split(anchor).length,2,'CANONICAL_COMPLETION_SOURCE_FAULT_ANCHOR');source=source.replace(anchor,'globalThis.closedLoopPromptEngine?.copyRetainedPromptContextFiles?.(next,privateCommitted);recentOperationalCommitRead=');}
 else assert.equal(fault,null,'CANONICAL_COMPLETION_KNOWN_FAULT_ORACLE');
 const cases=[],names=['revision-healthy','noop-healthy','revision-completion-mutation','noop-completion-mutation','warm-source-mutation','warm-target-mutation'];
 for(const caseId of names){
  if(caseFilter&&!caseFilter.includes(caseId))continue;
  const r=projectStoreRuntime({storageWorker:false,sourceOverrides:{...frozen,'project-store.js':source}});await r.store.ready;
  let current=await r.store.createProject({commandId:'SYNTHETIC-CANONICAL-COMPLETE-'+caseId});current=await r.store.readProject(current.job.JOB_ID);
  const noop=caseId.startsWith('noop-'),jobId=current.job.JOB_ID,input=r.copy(current),title=current.job.JOB_TITLE,prompt=r.runtime.closedLoopPromptEngine,open=r.runtime.openStorageTransaction;if(!noop)r.engine.addHistory(input,'SYNTHETIC_CANONICAL_COMPLETION_PREFIX',{synthetic:true});
  let candidate=null,preparedTarget=null,writerTarget=null,completionCalls=0,putCalls=0,warmHookCalls=0,mutations=0,completed=false,returned=null,error=null,durableAtCompletion=null;
  const mutate=project=>{project.job.JOB_TITLE='SYNTHETIC POSTCOMPLETION TITLE';mutations++;};
  r.runtime.closedLoopPromptEngine=Object.freeze({...prompt,copyRetainedPromptContextFiles(from,to,...rest){
   const result=Reflect.apply(prompt.copyRetainedPromptContextFiles,prompt,[from,to,...rest]);
   if(from===input)candidate=to;else if(from===candidate&&!preparedTarget)preparedTarget=to;else if(from===preparedTarget)writerTarget=to;
   if(completed){warmHookCalls++;if(caseId==='warm-source-mutation')mutate(from);if(caseId==='warm-target-mutation')mutate(to);}
   return result;
  }});
  r.runtime.openStorageTransaction=async(names,mode)=>{
   const tx=await Reflect.apply(open,r.runtime,[names,mode]),objectStore=tx.objectStore,commit=tx.commit;let actualPut=false;
   tx.objectStore=name=>{const store=Reflect.apply(objectStore,tx,[name]);if(name!=='projects')return store;const put=store.put;return {...store,put(row){if(!completed&&mode==='readwrite'&&row.jobId===jobId&&row.project){putCalls++;actualPut=true;assert.equal(row.project,writerTarget,'CANONICAL_COMPLETION_HOOK_ACTUAL_PUT_TARGET_ORACLE '+caseId);}return Reflect.apply(put,store,[row]);}};};
   tx.commit=()=>{const result=Reflect.apply(commit,tx,[]);if(!completed&&writerTarget&&mode==='readwrite'&&(noop||actualPut)){completed=true;completionCalls++;durableAtCompletion=r.copy(r.rows.get('projects').get(jobId));assert.equal(durableAtCompletion.project.job.JOB_TITLE,title);if(caseId.endsWith('completion-mutation'))mutate(writerTarget);}return result;};return tx;
  };
  try{returned=await r.store.writeProject(input,{skipUnchanged:noop,expectedProjectRevision:current.revision,expectedStateSha256:current.projectSha256,historyView:r.copy({activeStage:1,activeView:'Workflow',drafts:{'#response-note':{value:caseId}},scrollX:0,scrollY:31})});}catch(caught){error=caught;}finally{r.runtime.closedLoopPromptEngine=prompt;r.runtime.openStorageTransaction=open;}
  assert.equal(completionCalls,1,'CANONICAL_COMPLETION_HOOK_COMPLETION_ORACLE '+caseId);assert.equal(putCalls,noop?0:1,'CANONICAL_COMPLETION_HOOK_PUT_ORACLE '+caseId);assert(durableAtCompletion);assert.deepEqual(r.rows.get('projects').get(jobId),durableAtCompletion,'CANONICAL_COMPLETION_HOOK_DURABLE_ROW_ORACLE '+caseId);
  const rejected=caseId.endsWith('completion-mutation')||caseId==='warm-source-mutation';
  if(rejected){assert.equal(error?.code,'COMMITTED_PROJECT_UNAVAILABLE','CANONICAL_COMPLETION_HOOK_OUTCOME_ORACLE '+caseId);assert.equal(returned,null);assert.equal(error.committed,true,'CANONICAL_COMPLETION_HOOK_COMMITTED_FLAG_ORACLE');assert.equal(error.existingProjectsUnchanged,false,'CANONICAL_COMPLETION_HOOK_NO_ROLLBACK_CLAIM_ORACLE');assert.equal(error.jobId,jobId);assert.equal(error.revision,durableAtCompletion.revision);assert.equal(error.projectSha256,durableAtCompletion.projectSha256);assert.equal(error.cause?.code,'STALE_PROJECT_REVISION');}
  else{assert.equal(error,null,'CANONICAL_COMPLETION_HOOK_HEALTHY_OWNER_ORACLE '+caseId);assert(returned);assert.equal(returned.projectSha256,r.store.projectSha256(returned),'CANONICAL_COMPLETION_HOOK_RETURNED_DIGEST_ORACLE '+caseId);assert.equal(returned.projectSha256,durableAtCompletion.projectSha256);assert.equal(returned.job.JOB_TITLE,title);}
  assert.equal(mutations,caseId.endsWith('healthy')?0:1,'CANONICAL_COMPLETION_HOOK_MUTATION_EXECUTED_ORACLE '+caseId);assert.equal(warmHookCalls,noop||caseId==='revision-completion-mutation'?0:1,'CANONICAL_COMPLETION_HOOK_WARM_TRANSFER_COUNT_ORACLE '+caseId);
  const refreshed=await r.store.readProject(jobId,{refreshProjection:true}),cold=await r.store.readProject(jobId);for(const project of [refreshed,cold]){assert.equal(project.projectSha256,r.store.projectSha256(project),'CANONICAL_COMPLETION_HOOK_READ_DIGEST_ORACLE '+caseId);assert.equal(project.projectSha256,durableAtCompletion.projectSha256);assert.equal(project.job.JOB_TITLE,title);}
  cases.push({caseId,result:'PASS',putCalls,completionCalls,warmHookCalls,mutations,rejected,errorCode:error?.code||null,committedErrorFlagsCorrect:rejected,noIncorrectReturnedValue:true,trustedErrorIdentity:rejected,durableRowAuthentic:true,refreshedReadAuthentic:true,coldReadAuthentic:true,sourceProjectSha256:durableAtCompletion.projectSha256});
 }
 return {schema:'canonical-completion-hook-isolation/1',checkId:'store.canonical-completion-hook-isolation',result:'PASS',synthetic:true,actualBrowser:false,nativeIndexedDB:false,actualStorageAdapter:true,actualStorageWorker:false,fullClauseProof:false,sourceSha256,caseCount:cases.length,cases,boundary:'Public canonical save with actual synthetic transaction completion and refreshed/cold reads; no native browser or whole-clause claim'};
}

// Genuine public private-read owners must never certify custody-mutated values.
export async function verifyPrivateReadCustodyHookIsolation({sourceOverrides={},caseFilter=null,fault:injectedFault=null}={}){
 const files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'],frozen={...Object.fromEntries(files.map(file=>[file,fs.readFileSync(file,'utf8')])),...sourceOverrides},sourceSha256=Object.fromEntries(files.map(file=>[file,createHash('sha256').update(frozen[file]).digest('hex')]));let source=frozen['project-store.js'];
 if(injectedFault==='capture-after-custody'){
  const anchor=' const integrity=verifiedProjectIntegrity(project,project.projectSha256);\n await observeProjectArtifactCustody(project);';assert.equal(source.split(anchor).length,2,'CUSTODY_HOOK_CAPTURE_FAULT_ANCHOR');source=source.replace(anchor,' await observeProjectArtifactCustody(project);\n const integrity=verifiedProjectIntegrity(project,project.projectSha256);');
 }else if(injectedFault==='omit-startup-value-binding'){assert.equal(source.split('assertCanonicalRead();').length,3,'CUSTODY_HOOK_STARTUP_FAULT_ANCHOR');source=source.replaceAll('assertCanonicalRead();','');}
 else assert.equal(injectedFault,null,'CUSTODY_HOOK_KNOWN_FAULT_ORACLE');
 const cases=[];
for(const owner of ['checkpoint','operational-no-op','canonical-skip-unchanged','startup-refresh'])for(const fault of ['healthy','sync-value','queued-value','digest-label','custody-throws',...(owner==='startup-refresh'?['projection-consistent-draft']:[])]){
 const caseId=owner+':'+fault;if(caseFilter&&!caseFilter.includes(caseId))continue;const r=projectStoreRuntime({storageWorker:false,sourceOverrides:{...frozen,'project-store.js':source}});await r.store.ready;
 let current=await r.store.createProject({commandId:'SYNTHETIC-CUSTODY-CAPTURE-'+caseId});
 const pending=r.copy(current);r.engine.addHistory(pending,'SYNTHETIC_CUSTODY_CAPTURE_PREFIX',{synthetic:true});
 current=await r.store.writeProject(pending,{operational:true,expectedProjectRevision:current.revision,expectedStateSha256:current.projectSha256});
 const input=r.copy(current),jobId=current.job.JOB_ID,digest=current.projectSha256,draft=current.stages[1].responseDraft,engine=r.runtime.closedLoopWorkflowEngine;
 const before=r.copy([...r.rows].map(([name,map])=>[name,[...map]])),canonicalBefore=r.copy(r.rows.get('projects').get(jobId)),journalBefore=r.copy(r.rows.get('meta').get('responseOperations:'+jobId));
 const quarantineBefore=r.copy([...r.rows.get('meta')].filter(([key])=>key.startsWith('quarantine:'))),artifactsBefore=r.copy([...r.rows.get('artifacts')]),historyBefore=r.copy(r.rows.get('meta').get('recovery:'+jobId));
 let armed=true,hookCalls=0,mutationCalls=0,projectionRebuilds=0,transientValidationPassed=false,returned=null,error=null;const sentinel=new Error('SYNTHETIC_CUSTODY_ERROR_IDENTITY');
 const mutate=project=>{mutationCalls++;if(fault==='digest-label')project.projectSha256='0'.repeat(64);else project.stages[1].responseDraft='SYNTHETIC-CUSTODY-CAPTURE-MUTATION';
  if(fault==='projection-consistent-draft'){
   Reflect.apply(engine.recalculate,engine,[project]);projectionRebuilds++;
   const checked=r.store.validateProjectIntegrity(project);assert.equal(checked.valid,true,'CUSTODY_HOOK_TRANSIENT_FULL_VALIDATION '+caseId+': '+JSON.stringify(checked.issues));
   assert.equal(project.projectSha256,digest,'CUSTODY_HOOK_ORIGINAL_DIGEST_LABEL '+caseId);transientValidationPassed=true;
  }
 };
 r.runtime.closedLoopWorkflowEngine=Object.freeze({...engine,recordsForCurrentScope(project,collection,...rest){
  const result=Reflect.apply(engine.recordsForCurrentScope,engine,[project,collection,...rest]);
  if(armed&&project?.job?.JOB_ID===jobId&&collection==='artifacts'){
   armed=false;hookCalls++;
   if(fault==='custody-throws')throw sentinel;
   if(fault==='queued-value')queueMicrotask(()=>mutate(project));
   else if(fault==='sync-value'||fault==='digest-label'||fault==='projection-consistent-draft')mutate(project);
  }
  return result;
 }});
 const view=r.copy({activeStage:1,activeView:'Workflow',drafts:{'#response-note':{value:caseId}},scrollX:0,scrollY:17});
 try{
  returned=owner==='startup-refresh'?await r.store.readProject(jobId,{refreshProjection:true}):owner==='checkpoint'?await r.store.saveCheckpoint(jobId,{expectedProjectRevision:current.revision,expectedStateSha256:digest,view}):await r.store.writeProject(input,{operational:owner==='operational-no-op',skipUnchanged:owner==='canonical-skip-unchanged',expectedProjectRevision:current.revision,expectedStateSha256:digest,historyView:view});
 }catch(caught){error=caught;}finally{r.runtime.closedLoopWorkflowEngine=engine;}
 assert.equal(hookCalls,1,'CUSTODY_CAPTURE_ACTUAL_OBSERVER_ONCE '+caseId);
 if(fault==='projection-consistent-draft'){
  assert.equal(projectionRebuilds,1,'CUSTODY_HOOK_REAL_PROJECTION_REBUILD '+caseId);assert.equal(transientValidationPassed,true,'CUSTODY_HOOK_VALIDATED_TRANSIENT_CANDIDATE '+caseId);
  // Only a proven stale-label return, not an unrelated error, detects this fault.
  if(injectedFault==='omit-startup-value-binding'&&(error?.code!=='PROJECT_INTEGRITY_FAILED'||returned!==null)){
   assert.equal(error,null,'CUSTODY_HOOK_OMISSION_RETURN_ERROR '+caseId);assert(returned,'CUSTODY_HOOK_OMISSION_RETURN_PRESENT '+caseId);assert.equal(returned.projectSha256,digest,'CUSTODY_HOOK_OMISSION_ORIGINAL_LABEL '+caseId);assert.notEqual(r.store.projectSha256(returned),digest,'CUSTODY_HOOK_OMISSION_ACTUAL_DIGEST_MISMATCH '+caseId);assert.equal(returned.stages[1].responseDraft,'SYNTHETIC-CUSTODY-CAPTURE-MUTATION','CUSTODY_HOOK_OMISSION_CHANGED_DRAFT '+caseId);
   assert.deepEqual(r.copy([...r.rows].map(([name,map])=>[name,[...map]])),before,'CUSTODY_HOOK_OMISSION_DURABLE_STORES_UNCHANGED '+caseId);
   const authentic=await r.store.readProject(jobId);assert.equal(authentic.projectSha256,digest,'CUSTODY_HOOK_OMISSION_COLD_LABEL '+caseId);assert.equal(r.store.projectSha256(authentic),digest,'CUSTODY_HOOK_OMISSION_COLD_DIGEST '+caseId);assert.equal(authentic.stages[1].responseDraft,draft,'CUSTODY_HOOK_OMISSION_COLD_DRAFT '+caseId);
   assert.fail('CUSTODY_HOOK_REJECTION_ORACLE '+caseId);
  }
  assert(Array.isArray(error?.issues),'CUSTODY_HOOK_EXACT_VALUE_BINDING_ISSUES '+caseId);assert.equal(error.issues.length,1,'CUSTODY_HOOK_EXACT_VALUE_BINDING_ISSUE_COUNT '+caseId);assert.equal(error.issues[0],'Project changed during custody observation.','CUSTODY_HOOK_EXACT_VALUE_BINDING_OWNER '+caseId);
 }
 if(owner==='startup-refresh'&&fault==='sync-value')assert(error?.issues?.some(issue=>String(issue).includes('STALE_DERIVATION_RECEIPT')&&String(issue).includes('canonicalInputSha256')),'CUSTODY_HOOK_INDEPENDENT_PROJECTION_DEFENSE '+caseId);

 if(fault==='healthy'){
  assert.equal(error,null,'CUSTODY_CAPTURE_HEALTHY_OWNER_ORACLE '+caseId);assert(returned,'CUSTODY_CAPTURE_HEALTHY_RETURN_ORACLE '+caseId);
  if(owner!=='checkpoint'){assert.equal(returned.projectSha256,r.store.projectSha256(returned),'CUSTODY_CAPTURE_HEALTHY_RETURN_DIGEST '+caseId);assert.equal(returned.projectSha256,digest);assert.equal(returned.stages[1].responseDraft,draft);}
 }else{
  if(fault==='custody-throws')assert.equal(error,sentinel,'CUSTODY_CAPTURE_ORIGINAL_ERROR_IDENTITY '+caseId);
  else{assert.equal(mutationCalls,1,'CUSTODY_CAPTURE_MUTATION_REACHED '+caseId);assert.equal(error?.code,owner==='startup-refresh'?'PROJECT_INTEGRITY_FAILED':'STALE_PROJECT_REVISION','CUSTODY_HOOK_REJECTION_ORACLE '+caseId);}
  assert.equal(returned,null,'CUSTODY_CAPTURE_NO_UNTRUSTED_RETURN '+caseId);
  assert.deepEqual(r.copy([...r.rows].map(([name,map])=>[name,[...map]])),before,'CUSTODY_CAPTURE_ALL_DURABLE_STORES_UNCHANGED '+caseId);
 }
 assert.deepEqual(r.rows.get('projects').get(jobId),canonicalBefore,'CUSTODY_CAPTURE_CANONICAL_ROW_ORACLE '+caseId);assert.deepEqual(r.rows.get('meta').get('responseOperations:'+jobId),journalBefore,'CUSTODY_CAPTURE_JOURNAL_ORACLE '+caseId);
 const historyAfter=r.rows.get('meta').get('recovery:'+jobId),historyDelta=fault==='healthy'&&['checkpoint','canonical-skip-unchanged'].includes(owner)?1:0;assert.equal(historyAfter.value.generation,historyBefore.value.generation+historyDelta,'CUSTODY_HOOK_HISTORY_ORACLE '+caseId);assert.deepEqual(r.copy([...r.rows.get('artifacts')]),artifactsBefore,'CUSTODY_HOOK_ARTIFACT_ROWS_ORACLE '+caseId);assert.deepEqual(r.copy([...r.rows.get('meta')].filter(([key])=>key.startsWith('quarantine:'))),quarantineBefore,'CUSTODY_HOOK_NO_FALSE_QUARANTINE_ORACLE '+caseId);
 const refreshed=await r.store.readProject(jobId,{refreshProjection:true}),cold=await r.store.readProject(jobId);
 for(const [kind,project]of [['refreshed',refreshed],['cold',cold]]){assert(project,'CUSTODY_CAPTURE_AUTHENTIC_READ '+caseId+' '+kind);assert.equal(project.projectSha256,r.store.projectSha256(project),'CUSTODY_CAPTURE_FRESH_DIGEST '+caseId+' '+kind);assert.equal(project.projectSha256,digest);assert.equal(project.stages[1].responseDraft,draft);}
 cases.push({caseId,result:'PASS',hookCalls,mutationCalls,errorCode:error?.code||null,exactCustodyError:fault==='custody-throws',rejected:fault!=='healthy',rejectionStoresUnchanged:fault!=='healthy',canonicalAndJournalRowsUnchanged:true,artifactRowsUnchanged:true,quarantineUnchanged:true,historyGenerationDelta:historyDelta,authenticRefreshedAndColdReads:true,sourceProjectSha256:digest,...(fault==='projection-consistent-draft'?{projectionRebuilds,transientValidationPassed,originalDigestLabelRetained:true}:{}),...(owner==='startup-refresh'&&fault==='sync-value'?{independentProjectionReceiptRejected:true}:{})});
}
 return {schema:'private-read-custody-hook-isolation/1',checkId:'store.private-read-custody-hook-isolation',result:'PASS',synthetic:true,actualBrowser:false,nativeIndexedDB:false,actualStorageAdapter:true,actualStorageWorker:false,fullClauseProof:false,sourceSha256,caseCount:cases.length,cases,boundary:'Public checkpoint, operational no-op, canonical no-op and startup reads through isolated transaction adapter; no native browser or whole-clause claim'};
}
