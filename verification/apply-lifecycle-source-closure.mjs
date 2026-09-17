import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const transient=['.github/workflows/publish-lifecycle-1242.yml','verification/apply-lifecycle-source-closure.mjs','verification/lifecycle-source-closure-payload.json'];
const payload=JSON.parse(fs.readFileSync(transient[2],'utf8'));
assert.equal(payload.baseHead,'7df7add251fa87c40d87f92eb5641f10a5161a26');
assert.equal(process.env.GITHUB_REPOSITORY,'sjonesjones917/closed-loop-tracker');
assert.equal(process.env.GITHUB_REF,'refs/heads/repair/complete-conformance-continuation-20260914');
const delta=execFileSync('git',['diff','--name-only',payload.baseHead,'HEAD'],{encoding:'utf8'}).trim().split('\n').sort();
assert.deepEqual(delta,[...transient].sort(),'The publication commit must contain only the reviewed transport files. Preserve independent work.');
const specification='specification/closed-loop-reliability-controlling-implementation-specification.txt';
assert.equal(sha(fs.readFileSync(specification)),payload.specificationSha256,'The controlling text must remain unchanged.');
const allowed=new Set(['verify-project-lifecycle.mjs','verify-project-lifecycle-full.mjs','verification/current-task-requirement-register.json']);
const prepared=[];
for(const change of payload.repairs){
  assert(allowed.delete(change.path),'Unexpected or duplicate repair target');
  let bytes=fs.readFileSync(change.path);assert.equal(sha(bytes),change.before,change.path+': source changed; preserve independent work');
  let boundary=bytes.length;
  for(const edit of [...change.edits].reverse()){
    assert(Number.isSafeInteger(edit.offset)&&Number.isSafeInteger(edit.deleteBytes)&&edit.offset>=0&&edit.deleteBytes>=0&&edit.offset+edit.deleteBytes<=boundary,'Invalid or overlapping byte edit');
    bytes=Buffer.concat([bytes.subarray(0,edit.offset),Buffer.from(edit.insert,'utf8'),bytes.subarray(edit.offset+edit.deleteBytes)]);boundary=edit.offset;
  }
  assert.equal(sha(bytes),change.after,change.path+': bytes differ from the locally executed correction');prepared.push({...change,bytes});
}
assert.equal(allowed.size,0,'The complete repair set is required');
const register=prepared.find(x=>x.path.endsWith('current-task-requirement-register.json'));
const previous=JSON.parse(fs.readFileSync(register.path,'utf8')),next=JSON.parse(register.bytes);
assert.deepEqual(next.rows.slice(0,-1),previous.rows,'Existing register rows must not be removed or relabeled');
assert.equal(next.rows.at(-1).requirementId,'HARNESS-LIFECYCLE-SOURCE-CLOSURE');assert.equal(next.rows.at(-1).status,'UNVERIFIED');
for(const change of prepared)fs.writeFileSync(change.path,change.bytes);
for(const path of transient)fs.unlinkSync(path);
assert.equal(sha(fs.readFileSync('.github/workflows/pages.yml')),'57a388ba1c833a3d4844aec0658f16b9e617d0701a881fb969339195da6627a6','Required CI gates must remain byte-for-byte unchanged');
console.log(JSON.stringify({schema:'closed-loop-lifecycle-source-repair/1',baseHead:payload.baseHead,specificationSha256:payload.specificationSha256,contractTextModified:false,mandatoryCiModified:false,temporaryPublisherRemoved:true,changes:prepared.map(({path,before,after})=>({path,before,after})),registerRows:next.rows.length,completeCandidateVerificationRequired:true},null,2));
