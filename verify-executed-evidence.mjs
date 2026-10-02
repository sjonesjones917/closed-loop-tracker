import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {runVerifier} from './verify-conformance-regressions.mjs';
import {evidenceFingerprint,createExecutionReceipt,validateExecutionReceipt,aggregateExecutedEvidence,readExecutedEvidence,sha} from './verification-evidence.mjs';
import {metricCatalog} from './verification-evidence-catalog.mjs';
import {collectVerificationEvidence,executeEvidenceProducer} from './collect-verification-evidence.mjs';

// This exercises the real preload producer, not a YAML presence or mocked
// successful suite. The unchanged Stage 03 verifier first runs all its actual
// prompt/parser/validator/commit/transition assertions in every control.
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-executed-evidence-'));
const source=fs.readFileSync('verify-stage03-agent-protocol.mjs','utf8').replace("'./verifier-runtime.mjs'",JSON.stringify(pathToFileURL(path.resolve('verifier-runtime.mjs')).href));
const preload=path.resolve('verification-evidence-preload.mjs'),suite='verify-stage03-agent-protocol.mjs';
const producerControls=[];
try{
  const syntaxDirectory=path.join(directory,'syntax-only'),syntaxReceipts=path.join(syntaxDirectory,'receipts');fs.mkdirSync(syntaxDirectory);
  const syntaxEnvironment={...process.env,CLOSED_LOOP_VERIFICATION_RECEIPTS:syntaxReceipts,NODE_OPTIONS:`${process.env.NODE_OPTIONS||''} --import ${preload}`.trim()};
  const syntaxGood=await runVerifier(process.execPath,['--check',path.resolve(suite)],{env:syntaxEnvironment});
  assert.equal(syntaxGood.status,0,'A valid syntax-only invocation was treated as an executed assertion producer.');
  assert.equal(fs.existsSync(path.join(syntaxReceipts,suite+'.json')),false,'Syntax-only inspection fabricated a suite execution receipt.');
  const invalidSyntaxFile=path.join(syntaxDirectory,suite);fs.writeFileSync(invalidSyntaxFile,'const controlledSyntaxViolation = ;\n');
  const syntaxBad=await runVerifier(process.execPath,['--check',invalidSyntaxFile],{env:syntaxEnvironment});
  assert.equal(syntaxBad.status,1,'The preload masked an actual Node syntax failure.');assert.match(syntaxBad.stderr,/SyntaxError/);
  assert.equal(fs.existsSync(path.join(syntaxReceipts,suite+'.json')),false,'A parser failure became an executed suite receipt.');
  const syntaxPopulationCases=[{caseId:'conforming-syntax-without-execution',expectedExit:0,observedExit:syntaxGood.status,executionReceiptCreated:false},{caseId:'controlled-parser-failure',expectedExit:1,observedExit:syntaxBad.status,executionReceiptCreated:false}];
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
  // Real inherited descendant output bypasses the producer's stdout.write
  // capture. Keep it in runner diagnostics without reparsing it as the parent's
  // JSON report or replacing the parent's actual stderr with an empty string.
  const fixture=path.join(directory,'collector-own-output');fs.mkdirSync(fixture);
  for(const file of ['verify-stage03-agent-protocol.mjs','verifier-runtime.mjs','workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','verification-evidence-catalog.mjs','verification-negative-populations.json','verification-assertion-bindings.json','specification/closed-loop-reliability-controlling-implementation-specification.txt']){
    fs.mkdirSync(path.dirname(path.join(fixture,file)),{recursive:true});fs.copyFileSync(file,path.join(fixture,file));
  }
  const nestedProgress='COLLECTOR_INHERITED_CHILD_PROGRESS\n',ownDiagnostic='COLLECTOR_OWN_DIAGNOSTIC\n';
  const fixtureSource=fs.readFileSync(suite,'utf8')+`\nif(process.env.NODE_OPTIONS!=='--no-warnings')throw new Error('COLLECTOR_RUNTIME_OPTIONS_ORACLE');\nprocess.emitWarning('COLLECTOR_WARNING_MUST_BE_SUPPRESSED');\n(await import('node:child_process')).execFileSync(process.execPath,['-e',${JSON.stringify('process.stdout.write('+JSON.stringify(nestedProgress)+')')}],{stdio:'inherit'});\nprocess.stderr.write(${JSON.stringify(ownDiagnostic)});\n`;
  fs.writeFileSync(path.join(fixture,suite),fixtureSource);
  execFileSync('git',['init','--quiet'],{cwd:fixture});execFileSync('git',['add','.'],{cwd:fixture});execFileSync('git',['-c','user.name=Executed evidence fixture','-c','user.email=fixture@localhost','commit','--quiet','-m','Controlled actual producer output'],{cwd:fixture});
  const collectorDirectory=path.join(fixture,'receipts'),runnerDirectory=path.join(fixture,'runner');
  const ownReceipt=await executeEvidenceProducer(suite,{directory:collectorDirectory,cwd:fixture,evidenceDirectory:runnerDirectory,environment:{...process.env,NODE_OPTIONS:'--no-warnings'}});
  const callerEvidence=fs.readdirSync(runnerDirectory).filter(file=>file.endsWith('.json')).map(file=>JSON.parse(fs.readFileSync(path.join(runnerDirectory,file),'utf8'))).find(row=>Array.isArray(row.command)&&row.command.includes(path.join(fixture,suite)));
  assert(callerEvidence,'COLLECTOR_DIAGNOSTIC_ORACLE: real child runner evidence missing.');
  assert.equal(callerEvidence.exitCode,0);assert.equal(callerEvidence.stderr,ownDiagnostic,'COLLECTOR_RUNTIME_OPTIONS_ORACLE: ordinary NODE_OPTIONS was replaced or actual stderr was lost.');
  assert(callerEvidence.stdout.includes(nestedProgress),'COLLECTOR_DIAGNOSTIC_ORACLE: inherited descendant output did not reach the actual runner.');
  assert.notEqual(ownReceipt.stdoutSha256,sha(callerEvidence.stdout),'COLLECTOR_OWN_OUTPUT_ORACLE: merged descendant output replaced the parent-owned report.');
  assert.equal(ownReceipt.stderrSha256,sha(ownDiagnostic),'COLLECTOR_STDERR_ORACLE: actual parent diagnostics were reconstructed as empty stderr.');
  assert.throws(()=>createExecutionReceipt(suite,{...callerEvidence,command:[process.execPath,path.join(fixture,suite)],stdout:callerEvidence.stdout,stderr:''},{cwd:fixture}),/JSON/,'COLLECTOR_OWN_OUTPUT_ORACLE: former merged-output reconstruction did not reject the controlled non-JSON descendant.');
  const persistedOwnReceipt=JSON.parse(fs.readFileSync(path.join(collectorDirectory,suite+'.json'),'utf8'));
  assert.deepEqual(ownReceipt,persistedOwnReceipt,'COLLECTOR_OWN_OUTPUT_ORACLE: collector rewrote the child-owned receipt.');
  const collectorOwnOutputControl={caseId:'run-missing-owned-report-and-diagnostics',result:'PASS',actualStage03AssertionsExecuted:true,preloadInNodeOptions:false,ordinaryRuntimeOptionsPreserved:true,inheritedChildOutputInRunner:true,inheritedOutputExcludedFromOwnReport:true,actualStderrSha256:ownReceipt.stderrSha256,persistedChildReceiptRetained:true,formerReconstructionRejected:true};
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
  console.log(JSON.stringify({executedEvidenceProtection:'PASS',producerViolationsRejected:producerControls.every(row=>row.result==='DETECTED'),syntaxChecksDoNotClaimExecution:true,syntaxPopulationCases,collectorOwnOutputControl,emptyUniverseRejected:true,controlledProducerPopulation:producerControls,actualConformingStage03AssertionsExecuted:true,missingEvidenceRemainsUnknown:true,verificationObservations:[{checkId:'evidence.real-producer-controls',boundary:'actual Node exit/preload -> receipt consumer',expected:'ALL_CONTROLS_REJECTED_FOR_NAMED_REASON',observed:producerControls,passed:true,requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt#49']}]}));
}finally{fs.rmSync(directory,{recursive:true,force:true});}
