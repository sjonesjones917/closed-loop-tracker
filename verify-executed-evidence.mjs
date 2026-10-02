import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {runVerifier} from './verify-conformance-regressions.mjs';
import {evidenceFingerprint,validateExecutionReceipt,aggregateExecutedEvidence,readExecutedEvidence,sha} from './verification-evidence.mjs';
import {metricCatalog} from './verification-evidence-catalog.mjs';
import {collectVerificationEvidence} from './collect-verification-evidence.mjs';

// This exercises the real preload producer, not a YAML presence or mocked
// successful suite. The unchanged Stage 03 verifier first runs all its actual
// prompt/parser/validator/commit/transition assertions in every control.
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-executed-evidence-'));
const source=fs.readFileSync('verify-stage03-agent-protocol.mjs','utf8').replace("'./verifier-runtime.mjs'",JSON.stringify(pathToFileURL(path.resolve('verifier-runtime.mjs')).href));
const preload=path.resolve('verification-evidence-preload.mjs'),suite='verify-stage03-agent-protocol.mjs';
const producerControls=[];
try{
  async function run(name,text){
    const caseDirectory=path.join(directory,name);fs.mkdirSync(caseDirectory);const file=name==='conforming'?path.resolve(suite):path.join(caseDirectory,suite);if(name!=='conforming')fs.writeFileSync(file,text);
    const receipts=path.join(caseDirectory,'receipts');
    const result=await runVerifier(process.execPath,['--import',preload,file],{encoding:'utf8',env:{...process.env,CLOSED_LOOP_VERIFICATION_RECEIPTS:receipts}});
    const receipt=JSON.parse(fs.readFileSync(path.join(receipts,suite+'.json'),'utf8'));
    return {result,receipt};
  }
  const good=await run('conforming',source);
  assert.equal(good.result.status,0,'Conforming actual Stage 03 producer failed before receipt controls.');
  validateExecutionReceipt(good.receipt,suite,evidenceFingerprint());
  assert(good.receipt.observations.some(row=>row.checkId==='stage03.canonical-recordId-accepted'&&row.observed===true));
  for(const [name,text,diagnostic] of [
    ['missing-required-observation',source.replace('stage03AgentProtocol:true','stage03AgentProtocol:false'),'failed or missing required assertion'],
    ['duplicate-report',source+"\nconsole.log(JSON.stringify({stage03AgentProtocol:true}));\n",'expected exactly one report marker'],
    ['duplicate-observation',source.replace("verificationObservations:[","verificationObservations:[{checkId:'stage03.protocol',boundary:'controlled duplicate',expected:true,observed:true,passed:true},"),'duplicate emitted assertion'],
    ['failed-producer',source+"\nthrow new Error('CONTROLLED_NONZERO_CHILD');\n",'producer exit/output bound failed']
  ]){
    const {result,receipt}=await run(name,text);
    assert.equal(result.status,1,`${name} must fail the actual producer command.`);
    assert.equal(receipt.complete,false,`${name} produced a successful receipt.`);
    assert.match(receipt.reason,new RegExp(diagnostic),`${name} failed for the wrong mechanism.`);
    assert.throws(()=>validateExecutionReceipt(receipt,suite,evidenceFingerprint()),/EXECUTED_EVIDENCE_ORACLE/);
    producerControls.push({caseId:name,expectedExit:1,observedExit:result.status,expectedDiagnostic:diagnostic,observedDiagnostic:receipt.reason,accepted:false,result:'DETECTED'});
  }
  for(const [name,mutate] of [
    ['stale-source',receipt=>{receipt.fingerprint.sourceInputsSha256='0'.repeat(64);}],
    ['stale-specification',receipt=>{receipt.fingerprint.specificationSha256='0'.repeat(64);}],
    ['wrong-revision',receipt=>{receipt.fingerprint.sourceCommit='0'.repeat(40);}],
    ['wrong-runtime',receipt=>{receipt.fingerprint.runtime.node='v0.0.0';}],
    ['changed-observation',receipt=>{receipt.observations[0].passed=false;}]
  ]){
    const receipt=structuredClone(good.receipt);mutate(receipt);delete receipt.receiptSha256;receipt.receiptSha256=sha(receipt);
    assert.throws(()=>validateExecutionReceipt(receipt,suite,evidenceFingerprint()),/EXECUTED_EVIDENCE_ORACLE/);producerControls.push({caseId:name,accepted:false,result:'DETECTED'});
  }
  await assert.rejects(collectVerificationEvidence({directory:path.join(directory,'empty'),runMissing:false}),/missing required current receipt/);
  producerControls.push({caseId:'missing-current-producer-receipt',accepted:false,result:'DETECTED'});
  const evidenceDirectory=path.join(directory,'conforming','receipts'),evidencePath=path.join(evidenceDirectory,'evidence.json');
  const genuine=aggregateExecutedEvidence(new Map([[suite,good.receipt]]),evidenceFingerprint());genuine.evidenceSha256=sha(genuine);
  fs.writeFileSync(evidencePath,JSON.stringify(genuine));
  assert.equal(readExecutedEvidence(evidencePath).receiptCount,1,'Actual conforming producer evidence did not reach the real report consumer.');
  const tampered=structuredClone(genuine);tampered.metrics.currentScopeSelectorCoverage={...tampered.metrics.currentScopeSelectorCoverage,numerator:1,denominator:1,value:1,disposition:'SATISFIED'};
  delete tampered.evidenceSha256;tampered.evidenceSha256=sha(tampered);fs.writeFileSync(evidencePath,JSON.stringify(tampered));
  assert.throws(()=>readExecutedEvidence(evidencePath),/aggregated metrics\/populations do not derive/,'A rewritten summary with a matching checksum bypassed actual receipt derivation.');
  producerControls.push({caseId:'aggregate-rewritten-with-matching-checksum',accepted:false,result:'DETECTED'});
  const empty=aggregateExecutedEvidence(new Map(),evidenceFingerprint());
  assert.equal(empty.metrics.currentScopeSelectorCoverage.value,null,'Absent execution was published as measured success.');
  assert.equal(empty.zeroCounts.staleProposalsAccepted,null,'Absent negative execution was published as zero accepted violations.');
  const saved=metricCatalog.closedMetricUniverseCoverage.checkIds;metricCatalog.closedMetricUniverseCoverage.checkIds=[];
  try{assert.throws(()=>aggregateExecutedEvidence(new Map(),evidenceFingerprint()),/empty\/duplicate metric universe/);}finally{metricCatalog.closedMetricUniverseCoverage.checkIds=saved;}
  console.log(JSON.stringify({executedEvidenceProtection:'PASS',producerViolationsRejected:producerControls.every(row=>row.result==='DETECTED'),emptyUniverseRejected:true,controlledProducerPopulation:producerControls,actualConformingStage03AssertionsExecuted:true,missingEvidenceRemainsUnknown:true,verificationObservations:[{checkId:'evidence.real-producer-controls',boundary:'actual Node exit/preload -> receipt consumer',expected:'ALL_CONTROLS_REJECTED_FOR_NAMED_REASON',observed:producerControls,passed:true,requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt#49']}]}));
}finally{fs.rmSync(directory,{recursive:true,force:true});}
