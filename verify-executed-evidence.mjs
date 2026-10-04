import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {runVerifier} from './verify-conformance-regressions.mjs';
import {evidenceFingerprint,createExecutionReceipt,validateExecutionReceipt,aggregateExecutedEvidence,readExecutedEvidence,observationsFromReports,sha} from './verification-evidence.mjs';
import {metricCatalog} from './verification-evidence-catalog.mjs';
import {collectVerificationEvidence,executeEvidenceProducer} from './collect-verification-evidence.mjs';

// This exercises the real preload producer, not a YAML presence or mocked
// successful suite. The unchanged Stage 03 verifier first runs all its actual
// prompt/parser/validator/commit/transition assertions in every control.
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-executed-evidence-'));
const source=fs.readFileSync('verify-stage03-agent-protocol.mjs','utf8').replace("'./verifier-runtime.mjs'",JSON.stringify(pathToFileURL(path.resolve('verifier-runtime.mjs')).href));
const preload=path.resolve('verification-evidence-preload.mjs'),suite='verify-stage03-agent-protocol.mjs';
const producerControls=[];
const producerFixtureInputs=['verify-stage03-agent-protocol.mjs','verifier-runtime.mjs','workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','verification-evidence-preload.mjs','verification-evidence.mjs','verification-evidence-catalog.mjs','verification-negative-populations.json','verification-assertion-bindings.json','specification/closed-loop-reliability-controlling-implementation-specification.txt'];
try{
  // Project the maintained workflow's actual job and initial checkout step
  // environments, then exercise Node's real preload boundary on a cold
  // workspace. No repository preload may run before its checkout exists.
  const workflow=fs.readFileSync('.github/workflows/pages.yml','utf8'),coldCheckoutCases=[];
  const bootstrapNode=process.env.CLOSED_LOOP_ACTION_NODE||process.execPath;
  const scalar=value=>value==='\'\''?'':value.startsWith('"')?JSON.parse(value):value;
  for(const job of ['test','publish-status']){
    const start=workflow.indexOf('\n  '+job+':\n');assert(start>=0,'COLD_CHECKOUT_ORACLE: instrumented workflow job missing.');
    const tail=workflow.slice(start+1),next=/\n  [a-z][\w-]*:\n/.exec(tail),block=next?tail.slice(0,next.index):tail;
    const jobEnv=block.split('\n    env:\n')[1]?.split(/\n    [a-z][\w-]*:/)[0],jobOptions=/^      NODE_OPTIONS: (.*)$/m.exec(jobEnv||'')?.[1];
    const checkout=/^      - uses: actions\/checkout@[^\n]+\n([\s\S]*?)(?=^      - |(?![\s\S]))/m.exec(block)?.[1];
    assert(jobOptions&&checkout!==undefined,'COLD_CHECKOUT_ORACLE: actual workflow environment/checkout projection unavailable.');
    const override=/^          NODE_OPTIONS: (.*)$/m.exec(checkout)?.[1];
    const workspace=path.join(directory,'cold-checkout-'+job);fs.mkdirSync(workspace);
    const inherited=scalar(jobOptions).replaceAll('${{ github.workspace }}',workspace),effective=override===undefined?inherited:scalar(override);
    const action=`const fs=require('node:fs');if(fs.existsSync('verification-evidence-preload.mjs'))throw new Error('COLD_WORKSPACE_ORACLE');fs.writeFileSync('checkout-body-reached.json','true');console.log(JSON.stringify({actionBodyExecuted:true,repositoryInitiallyAbsent:true,runtime:process.version}));`;
    const before=await runVerifier(bootstrapNode,['-e',action],{cwd:workspace,env:{...process.env,NODE_OPTIONS:inherited}});
    assert.equal(before.status,1,'COLD_CHECKOUT_ORACLE: former inherited preload did not reject the missing repository module.');
    assert.match(before.stderr,/ERR_MODULE_NOT_FOUND/);assert(before.stderr.includes(path.join(workspace,'verification-evidence-preload.mjs')));assert.equal(fs.existsSync(path.join(workspace,'checkout-body-reached.json')),false,'COLD_CHECKOUT_ORACLE: defective preload reached the action body.');
    const after=await runVerifier(bootstrapNode,['-e',action],{cwd:workspace,env:{...process.env,NODE_OPTIONS:effective}});
    assert.equal(after.status,0,'COLD_CHECKOUT_ORACLE: actual checkout environment rejected a cold workspace.');
    const actionReport=JSON.parse(after.stdout);assert.equal(actionReport.actionBodyExecuted,true);
    for(const file of producerFixtureInputs){fs.mkdirSync(path.dirname(path.join(workspace,file)),{recursive:true});fs.copyFileSync(file,path.join(workspace,file));}
    execFileSync('git',['init','--quiet'],{cwd:workspace});execFileSync('git',['add','.'],{cwd:workspace});execFileSync('git',['-c','user.name=Cold checkout fixture','-c','user.email=fixture@localhost','commit','--quiet','-m','Checked-out real producer fixture'],{cwd:workspace});
    const receiptDirectory=path.join(workspace,'receipts');
    // No explicit --import: the workflow's unchanged post-checkout job options
    // must actually record the required verifier receipt, rather than relying
    // on the collector's separate explicit preload to conceal lost wiring.
    const producer=await runVerifier(process.execPath,[path.join(workspace,suite)],{cwd:workspace,env:{...process.env,NODE_OPTIONS:inherited,CLOSED_LOOP_VERIFICATION_SOURCE_ROOT:workspace,CLOSED_LOOP_VERIFICATION_RECEIPTS:receiptDirectory}});
    assert.equal(producer.status,0,'COLD_CHECKOUT_ORACLE: checked-out required producer did not pass.');
    const receipt=JSON.parse(fs.readFileSync(path.join(receiptDirectory,suite+'.json'),'utf8'));validateExecutionReceipt(receipt,suite,evidenceFingerprint(workspace));
    assert(receipt.observations.some(row=>row.checkId==='stage03.canonical-recordId-accepted'&&row.passed));
    coldCheckoutCases.push({job,actionRuntime:actionReport.runtime,formerInheritedExit:before.status,formerActionBodyExecuted:false,checkoutExit:after.status,checkoutBodyExecuted:true,postCheckoutProducerRuntime:receipt.fingerprint.runtime.node,postCheckoutProducerExit:producer.status,jobPreloadCreatedCurrentReceipt:true,producerFileSha256:receipt.producerFileSha256,stdoutSha256:receipt.stdoutSha256,stderrSha256:receipt.stderrSha256,receiptSha256:receipt.receiptSha256});
  }
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
  for(const file of producerFixtureInputs){
    fs.mkdirSync(path.dirname(path.join(fixture,file)),{recursive:true});fs.copyFileSync(file,path.join(fixture,file));
  }
  const nestedProgress='COLLECTOR_INHERITED_CHILD_PROGRESS\n';
  // These exact plain diagnostic lines contaminated the completed production
  // report stream. Keep the JSON-only contract and capture their actual bytes
  // on stderr, including when the producer imports other verifier modules.
  const producerProgress='verify-root-cause-correction: PASS\nverify-corrected-iteration: PASS\nverify-test-runtime-dag: PASS\n';
  const ownDiagnostic='COLLECTOR_OWN_DIAGNOSTIC\n'+producerProgress;
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
  const collectorOwnOutputControl={caseId:'run-missing-owned-report-and-diagnostics',result:'PASS',actualStage03AssertionsExecuted:true,preloadInNodeOptions:false,ordinaryRuntimeOptionsPreserved:true,inheritedChildOutputInRunner:true,inheritedOutputExcludedFromOwnReport:true,producerProgressOnStderr:true,producerProgressBytes:Buffer.byteLength(producerProgress),actualStderrSha256:ownReceipt.stderrSha256,persistedChildReceiptRetained:true,formerReconstructionRejected:true};
  for(const [name,text,diagnostic] of [
    ['producer-progress-on-stdout',source+`\nprocess.stdout.write(${JSON.stringify(producerProgress)});\n`,'Unexpected non-whitespace character after JSON'],
    ['foreign-failed-observation',source+`\nconsole.log(JSON.stringify({foreignImportedReport:true,verificationObservations:[{checkId:'foreign.failed-assertion',boundary:'controlled imported report',expected:true,observed:false,passed:false}]}));\n`,'failed or missing required assertion foreign.failed-assertion'],
    ['foreign-duplicate-observation',source+`\nconsole.log(JSON.stringify({foreignImportedReport:true,verificationObservations:[{checkId:'foreign.duplicate-assertion',boundary:'controlled imported report',expected:true,observed:true,passed:true},{checkId:'foreign.duplicate-assertion',boundary:'controlled imported report',expected:true,observed:true,passed:true}]}));\n`,'duplicate emitted assertion foreign.duplicate-assertion'],
    ['foreign-malformed-observation',source+`\nconsole.log(JSON.stringify({foreignImportedReport:true,verificationObservations:[{checkId:'foreign.malformed-assertion',expected:true,observed:true,passed:true}]}));\n`,'malformed emitted assertion observation'],
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
  const registryRequirements=[['NREQ-a56263f8ca87f003eb82d8ce2a013284','registry.fields'],['NREQ-15bcea4db7a052db7fc4f619dac3acae','registry.operations'],['NREQ-ca1881e2147860bad9fb1f6de8df247f','registry.scopes'],['NREQ-2eda4f41b65187dddb96d68135a7fe03','registry.durable']];
  const beforeRegistry=aggregateExecutedEvidence(new Map([[suite,good.receipt]]),evidenceFingerprint());
  for(const [id,checkId]of registryRequirements){
    const row=beforeRegistry.normativeRequirementTrace.find(row=>row.normativeRequirementId===id);
    assert.equal(row.disposition,'UNKNOWN','NORMATIVE_LINK_ORACLE: a static registry binding was treated as executed proof.');
    assert(row.missingAssertionIds.includes(checkId));assert.equal(row.executedAssertions.length,0);
    assert.equal(row.implementationClassification,null,'NORMATIVE_CLASSIFICATION_ORACLE: missing execution determined implementation or external-capability status.');
  }
  const unlinked=beforeRegistry.normativeRequirementTrace.find(row=>row.scopeBindings.length===0);
  assert(unlinked);assert.equal(unlinked.implementationClassification,null,'NORMATIVE_CLASSIFICATION_ORACLE: absent links were classified as impossible to verify.');
  assert.equal(unlinked.implementationEvidenceDisposition,'INSUFFICIENT_CURRENT_EVIDENCE_TO_CLASSIFY_IMPLEMENTATION');
  const registrySuite='verify-contract-closure.mjs',registryReceipt=await executeEvidenceProducer(registrySuite,{directory:evidenceDirectory,evidenceDirectory:path.join(directory,'registry-runner')});
  const genuine=aggregateExecutedEvidence(new Map([[suite,good.receipt],[registrySuite,registryReceipt]]),evidenceFingerprint());genuine.evidenceSha256=sha(genuine);
  for(const [id,checkId]of registryRequirements){
    const row=genuine.normativeRequirementTrace.find(row=>row.normativeRequirementId===id);
    assert.equal(row.disposition,'QUALIFIED_EXECUTED_ASSERTION_EVIDENCE','NORMATIVE_LINK_ORACLE: actual registry execution was omitted from its exact requirement trace.');
    assert.deepEqual(row.executedAssertions.map(assertion=>assertion.checkId),[checkId]);
    assert.equal(row.implementationClassification,'implemented but insufficiently tested');
  }
  const normativeRegistryLinkageControl={result:'PASS',exactQualifiedLinks:registryRequirements.map(([normativeRequirementId,checkId])=>({normativeRequirementId,checkId})),absentExecutionRemainsUnknown:true,unlinkedImplementationStatusUndetermined:true,fullClauseConformanceClaimed:false};
  // Exercise the actual composed ingestion producer and both registered owners.
  // Their independent report assertions execute; a wrapper's imported report
  // cannot publish the owner's detailed identity or mask its missing receipt.
  const ownershipSuites=['verify-ingestion.mjs','verify-response-authority-integrity.mjs','verify-returned-slot-authority.mjs'];
  const ownershipReceipts=new Map();
  for(const owner of ownershipSuites)ownershipReceipts.set(owner,await executeEvidenceProducer(owner,{directory:path.join(directory,'ownership-receipts'),evidenceDirectory:path.join(directory,'ownership-runner')}));
  const wrapper=ownershipReceipts.get('verify-ingestion.mjs'),canonicalIds=ownershipSuites.slice(1).flatMap(owner=>ownershipReceipts.get(owner).reports.flatMap(report=>report.verificationObservations||[]).map(row=>row.checkId));
  assert.equal(canonicalIds.length,15,'OBSERVATION_OWNER_ORACLE: the actual composed canonical population changed.');
  assert(canonicalIds.every(id=>wrapper.reports.some(report=>report.verificationObservations?.some(row=>row.checkId===id))),'OBSERVATION_OWNER_ORACLE: actual imported reports were discarded.');
  assert(canonicalIds.every(id=>!wrapper.observations.some(row=>row.checkId===id)),'OBSERVATION_OWNER_ORACLE: wrapper claimed canonical imported assertion identities.');
  const ownerAbsent=aggregateExecutedEvidence(new Map([['verify-ingestion.mjs',wrapper]]),evidenceFingerprint());
  const absentLinks=ownerAbsent.normativeRequirementTrace.filter(row=>row.scopeBindings.some(binding=>binding.checkIds.some(id=>canonicalIds.includes(id))));
  assert(absentLinks.length>0&&absentLinks.every(row=>row.disposition==='UNKNOWN'),'OBSERVATION_OWNER_ORACLE: imported reports masked missing canonical owner proof.');
  const ownedAggregate=aggregateExecutedEvidence(ownershipReceipts,evidenceFingerprint());
  assert.equal(ownedAggregate.receiptCount,3,'OBSERVATION_OWNER_ORACLE: actual composed/owner receipts did not aggregate.');
  assert(canonicalIds.every(id=>ownedAggregate.normativeRequirementTrace.some(row=>row.executedAssertions.some(assertion=>assertion.checkId===id&&assertion.suite!=='verify-ingestion.mjs'))),'OBSERVATION_OWNER_ORACLE: exact canonical assertion links were lost.');
  // A second producer explicitly claiming an already owned identity must still
  // fail the real aggregate boundary, even with consistent per-receipt hashes.
  const duplicate=structuredClone(registryReceipt),detail=structuredClone(good.receipt.reports.flatMap(report=>report.verificationObservations||[])[0]);
  duplicate.reports.find(report=>Object.hasOwn(report,'contractClosure')).verificationObservations=[detail];
  duplicate.observations=observationsFromReports(registrySuite,duplicate.reports);delete duplicate.receiptSha256;duplicate.receiptSha256=sha(duplicate);
  assert.throws(()=>aggregateExecutedEvidence(new Map([[suite,good.receipt],[registrySuite,duplicate]]),evidenceFingerprint()),new RegExp('duplicate observation '+detail.checkId),'OBSERVATION_OWNER_ORACLE: a double-owned detailed assertion became accepted evidence.');
  producerControls.push({caseId:'double-owned-detailed-assertion',accepted:false,result:'DETECTED'});
  const observationOwnershipControl={result:'PASS',actualProducerSuites:ownershipSuites,canonicalDetailedAssertionCount:canonicalIds.length,canonicalCheckIds:canonicalIds,importedReportsRetained:true,canonicalOwnerMissingRemainsUnknown:true,exactCanonicalLinksPreserved:true,doubleOwnedDetailedAssertionRejected:true,foreignFailedDuplicateMalformedAssertionsRejected:true};
  fs.writeFileSync(evidencePath,JSON.stringify(genuine));
  assert.equal(readExecutedEvidence(evidencePath).receiptCount,2,'Actual conforming producer evidence did not reach the real report consumer.');
  const tampered=structuredClone(genuine);tampered.metrics.currentScopeSelectorCoverage={...tampered.metrics.currentScopeSelectorCoverage,numerator:1,denominator:1,value:1,disposition:'SATISFIED'};
  delete tampered.evidenceSha256;tampered.evidenceSha256=sha(tampered);fs.writeFileSync(evidencePath,JSON.stringify(tampered));
  assert.throws(()=>readExecutedEvidence(evidencePath),/aggregated metrics\/populations do not derive/,'A rewritten summary with a matching checksum bypassed actual receipt derivation.');
  producerControls.push({caseId:'aggregate-rewritten-with-matching-checksum',accepted:false,result:'DETECTED'});
  const empty=aggregateExecutedEvidence(new Map(),evidenceFingerprint());
  assert.equal(empty.metrics.currentScopeSelectorCoverage.value,null,'Absent execution was published as measured success.');
  assert.equal(empty.zeroCounts.staleProposalsAccepted,null,'Absent negative execution was published as zero accepted violations.');
  const saved=metricCatalog.closedMetricUniverseCoverage.checkIds;metricCatalog.closedMetricUniverseCoverage.checkIds=[];
  try{assert.throws(()=>aggregateExecutedEvidence(new Map(),evidenceFingerprint()),/empty\/duplicate metric universe/);}finally{metricCatalog.closedMetricUniverseCoverage.checkIds=saved;}
  console.log(JSON.stringify({executedEvidenceProtection:'PASS',coldCheckoutCases,producerViolationsRejected:producerControls.every(row=>row.result==='DETECTED'),syntaxChecksDoNotClaimExecution:true,syntaxPopulationCases,collectorOwnOutputControl,normativeRegistryLinkageControl,observationOwnershipControl,emptyUniverseRejected:true,controlledProducerPopulation:producerControls,actualConformingStage03AssertionsExecuted:true,missingEvidenceRemainsUnknown:true,verificationObservations:[{checkId:'evidence.real-producer-controls',boundary:'actual Node exit/preload -> receipt consumer',expected:'ALL_CONTROLS_REJECTED_FOR_NAMED_REASON',observed:producerControls,passed:true,requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt#49']}]}));
}finally{fs.rmSync(directory,{recursive:true,force:true});}
