// Exact historical fixture transport only. No current atomic review or proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readAtomicEvidenceBytes} from './review-specification-coverage.mjs';
const capsulePath='verification/historical-normative-fixture-inputs-20261015.json.gz';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const expectedMembers=[{"id":"contextSource","sourceCommit":"7df5f46e9a7e54da09622387a978badb39916c09","sourcePath":"specification/closed-loop-reliability-controlling-implementation-specification.txt","sha256":"95a6a8b1f8857b35c47cb44874aee2bbada1ccfd2ee7aa9033d92fb39c8bda9d","byteLength":342110},{"id":"contextManifest","sourceCommit":"7df5f46e9a7e54da09622387a978badb39916c09","sourcePath":"specification/closed-loop-normative-requirements.json","sha256":"97b43f690b60219d67f498459439bce30416650b9f26c46c34a89b972a13929f","byteLength":10353215},{"id":"contextApplicabilityReview","sourceCommit":"7df5f46e9a7e54da09622387a978badb39916c09","sourcePath":"verification/normative-context-applicability-20261005.json","sha256":"7cd05ff0028578a1ca1c2560533519a602ce6a974c240ee11dbbd272524cf656","byteLength":271107},{"id":"proofManifest","sourceCommit":"722382ed28922c145d6023894824e8b4e493cab8","sourcePath":"specification/closed-loop-normative-requirements.json","sha256":"4b9947c1f5ca9ccf8bc8a149e4aabc76cac11f05e9d578c868c46b2c0f48bd08","byteLength":10714263},{"id":"proofSpecificationManifest","sourceCommit":"722382ed28922c145d6023894824e8b4e493cab8","sourcePath":"specification/closed-loop-specification-manifest.json","sha256":"c3cadf7d391c67dc4485ef2e561192d8de8600df71b127a89c6cb4358717103a","byteLength":269382},{"id":"proofGovernance","sourceCommit":"722382ed28922c145d6023894824e8b4e493cab8","sourcePath":"specification/requirement-evidence-bindings.json","sha256":"6a5b5325847abfeb87ab1461266f0f5da04ba5f18aa0523a8bbbdab4c80da43b","byteLength":1485}];
const exactKeys=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
export function validateHistoricalNormativeFixtureMembers(capsule){
  assert(exactKeys(capsule,['schema','members'])&&capsule.schema==='closed-loop-historical-normative-fixture-capsule/1'&&Array.isArray(capsule.members)&&capsule.members.length===expectedMembers.length,'HISTORICAL_NORMATIVE_CAPSULE_SCHEMA_ORACLE');
  const result=new Map();
  for(const [index,expected] of expectedMembers.entries()){
    const member=capsule.members[index];
    assert(exactKeys(member,[...Object.keys(expected),'base64'])&&Object.entries(expected).every(([key,value])=>member[key]===value),'HISTORICAL_NORMATIVE_CAPSULE_MEMBER_ORACLE: '+expected.id);
    assert(typeof member.base64==='string'&&member.base64.length===4*Math.ceil(expected.byteLength/3),'HISTORICAL_NORMATIVE_CAPSULE_ENCODING_ORACLE: '+expected.id);
    const bytes=Buffer.from(member.base64,'base64');
    assert(bytes.toString('base64')===member.base64&&bytes.length===expected.byteLength&&sha(bytes)===expected.sha256,'HISTORICAL_NORMATIVE_CAPSULE_BYTES_ORACLE: '+expected.id);
    result.set(expected.id,bytes);
  }
  return result;
}
export function readHistoricalNormativeFixtureInputs(cwd=process.cwd()){
  const bytes=fs.readFileSync(path.join(cwd,capsulePath));
  assert(bytes.length===3293541&&sha(bytes)==='e29fee331ab7a14ad902eef9fb3be14d571d82c046a5369a179b3ec01ecbadcf','HISTORICAL_NORMATIVE_CAPSULE_IDENTITY_ORACLE');
  // Bound the decoded carrier before JSON parsing; raw members have separate
  // immutable byte-size/digest pins. Paths in the carrier are never write targets.
  const decoded=gunzipSync(bytes,{maxOutputLength:29270437});
  assert.equal(decoded.length,29270437,'HISTORICAL_NORMATIVE_CAPSULE_SIZE_ORACLE');
  return validateHistoricalNormativeFixtureMembers(JSON.parse(decoded.toString('utf8')));
}

// The singleton proof consumer belongs to the pinned 722382ed source universe.
// Its logical specification path now contains the approved current continuation;
// transport the retained immutable base without treating it as current proof.
export function readHistoricalNormativeProofSource(cwd=process.cwd()){
  const bytes=readAtomicEvidenceBytes('verification/approved-v4-continuation-20261015/immutable-base/specification/closed-loop-reliability-controlling-implementation-specification.txt',cwd);
  assert.equal(sha(bytes),'8b17763e915b9475898dad5d44e83a1c9552025c699ec28d24a3d12b9b0cf883','NORMATIVE_PROOF_HISTORICAL_INPUT_ORACLE: specification/closed-loop-reliability-controlling-implementation-specification.txt');
  return bytes;
}
