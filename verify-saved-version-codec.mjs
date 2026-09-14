import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
globalThis.dispatchEvent=()=>true;
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const store=closedLoopProjectStore,engine=closedLoopWorkflowEngine,hash=closedLoopHash;
const original=closedLoopCore.createBlankState('DISPOSABLE-HISTORY-CODEC');engine.ensureShape(original);engine.recalculate(original);
const stages=Object.keys(original.stages).map(Number);
for(const stage of stages)original.stages[stage].draft=`Stage ${stage} unsaved review text\nWith its exact final line.\n`;
const first=store.encodeSavedVersion(original,{description:'Session started',createdAt:'2026-09-14T00:00:00.000Z'}),source=hash.stableStringify(first);
assert.deepEqual(store.decodeSavedVersion(first.version,first.chunks),original);
const cases=[{caseId:'complete-project-and-draft-round-trip',result:'PASS'}];
for(const [caseId,change] of [
  ['missing-chunk',copy=>copy.chunks.splice(0,1)],
  ['changed-chunk',copy=>{copy.chunks[0].value='Different retained content';}],
  ['wrong-project',copy=>{copy.version.jobId='OTHER';}],
  ...stages.flatMap((stage,index)=>[false,true].map(rehash=>[`${rehash?'incompatible-mix':'changed-reference'}-stage-${stage}`,copy=>{copy.version.stages[stage]=copy.version.stages[stages[(index+1)%stages.length]];if(rehash){const {snapshotSha256,...body}=copy.version;copy.version.snapshotSha256=hash.sha256Value(body);}}]))
]){
  const invalid=structuredClone(first);change(invalid);
  assert.throws(()=>store.decodeSavedVersion(invalid.version,invalid.chunks,{jobId:original.job.JOB_ID}),/saved|version|project|reconstruct/i,caseId);
  assert.equal(hash.stableStringify(first),source,'A failed reconstruction modified retained history');
  assert.deepEqual(store.decodeSavedVersion(first.version,first.chunks),original);
  cases.push({caseId,rejectionAndRecovery:'PASS',result:'PASS'});
}
const alternate=structuredClone(original);alternate.job.JOB_TITLE='A different continuation';alternate.revision++;
const second=store.encodeSavedVersion(alternate,{parentVersionId:first.version.versionId,createdAt:'2026-09-14T00:00:01.000Z'}),parts=new Map(first.chunks.map(chunk=>[chunk.sha256,chunk]));
for(const chunk of second.chunks)parts.set(chunk.sha256,chunk);
assert(parts.size<first.chunks.length+second.chunks.length,'Unchanged canonical chunks should be shared');
assert.deepEqual(store.decodeSavedVersion(first.version,[...parts.values()]),original);
assert.deepEqual(store.decodeSavedVersion(second.version,[...parts.values()]),alternate);
assert.equal(hash.stableStringify(first),source,'A later continuation mutated the retained starting version');
cases.push({caseId:'independent-continuations-share-only-immutable-data',result:'PASS'});
console.log(JSON.stringify({savedVersionCodec:'PASS',cases,limits:store.HISTORY_LIMITS,scope:'Canonical codec only; browser transactions and operator navigation require separate execution.'}));
