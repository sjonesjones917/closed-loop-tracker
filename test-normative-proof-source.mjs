// Historical transport/refusal controls only; never current application proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readHistoricalNormativeProofSource} from './historical-normative-fixture-inputs.mjs';
import {evidenceFingerprint,validateExecutionReceipt,sha,SPECIFICATION_PATH} from './verification-evidence.mjs';
const archive='verification/approved-v4-continuation-20261015/immutable-base/'+SPECIFICATION_PATH;
const historicalSha='8b17763e915b9475898dad5d44e83a1c9552025c699ec28d24a3d12b9b0cf883';
export function verifyHistoricalNormativeProofSource(fixture){
  const root=process.cwd(),current=fs.readFileSync(SPECIFICATION_PATH),historical=readHistoricalNormativeProofSource(root),fingerprint=evidenceFingerprint();
  assert.equal(sha(historical),historicalSha);
  assert.equal(fingerprint.inputSha256[archive],historicalSha,'HISTORICAL_PROOF_ARCHIVE_FINGERPRINT_ORACLE');
  assert.equal(fingerprint.specificationSha256,sha(current),'HISTORICAL_PROOF_CURRENT_SOURCE_ORACLE');
  assert.notEqual(sha(current),historicalSha,'HISTORICAL_PROOF_DISTINCT_SOURCE_ORACLE');
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'historical-proof-source-controls-')),target=path.join(temporary,archive),cases=[];
  try{
    // The current logical source exists, but cannot replace a missing archive.
    fs.mkdirSync(path.dirname(path.join(temporary,SPECIFICATION_PATH)),{recursive:true});fs.writeFileSync(path.join(temporary,SPECIFICATION_PATH),current);
    assert.throws(()=>readHistoricalNormativeProofSource(temporary),error=>error.code==='ENOENT');cases.push('missing-archive-no-current-fallback');
    fs.mkdirSync(path.dirname(target),{recursive:true});
    for(const [name,bytes] of [['changed-archive',Buffer.concat([historical,Buffer.from('\n')])],['current-source-as-historical',current]]){
      fs.writeFileSync(target,bytes);assert.throws(()=>readHistoricalNormativeProofSource(temporary),/NORMATIVE_PROOF_HISTORICAL_INPUT_ORACLE/);cases.push(name);
      fs.writeFileSync(target,historical);assert.deepEqual(readHistoricalNormativeProofSource(temporary),historical);cases.push(name+'-restored');
    }
    assert.equal(fixture.sourceUniverse,'HISTORICAL_SOURCE_TRACE_722382ED');assert.equal(fixture.currentAtomicProof,false);
    assert.equal(fixture.fingerprint.specificationSha256,historicalSha);
    assert.equal(sha(fs.readFileSync(path.join(fixture.directory,SPECIFICATION_PATH))),historicalSha);
    assert.doesNotThrow(()=>validateExecutionReceipt(fixture.receipt,'verify-test-runtime-v3.mjs',fixture.fingerprint));cases.push('actual-historical-producer-receipt');
    assert.throws(()=>validateExecutionReceipt(fixture.receipt,'verify-test-runtime-v3.mjs',fingerprint),/stale source\/specification\/catalog\/runtime receipt/);cases.push('historical-receipt-refused-as-current');
    assert.deepEqual(fs.readFileSync(SPECIFICATION_PATH),current);assert.equal(process.cwd(),root);cases.push('current-source-preserved');
    return {passed:true,cases,currentApplicationProof:false,historicalSourceSha256:historicalSha,currentSourceSha256:sha(current)};
  }finally{fs.rmSync(temporary,{recursive:true,force:true});}
}
