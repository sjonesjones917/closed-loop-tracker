import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

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
