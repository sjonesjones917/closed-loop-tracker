import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {verifyDueEvidenceConsumers} from './test-due-evidence-consumers.mjs';
import {verifyDueVerificationScheduling,verifyCrossRunVerificationScheduling} from './test-due-verification-scheduling.mjs';
import {runVerifier,AGGREGATE_TIMEOUT_MS} from './verify-conformance-regressions.mjs';
import {evidenceFingerprint,createExecutionReceipt,validateExecutionReceipt,aggregateExecutedEvidence,readExecutedEvidence,readExecutionReceipt,observationsFromReports,sha} from './verification-evidence.mjs';
import {metricCatalog,verificationCatalog,browserVerificationCatalog} from './verification-evidence-catalog.mjs';
import {collectVerificationEvidence,executeEvidenceProducer} from './collect-verification-evidence.mjs';

const ownershipSuites=['verify-ingestion.mjs','verify-response-authority-integrity.mjs','verify-returned-slot-authority.mjs'];
async function ownershipReceiptSource(owner,{currentReceiptDirectory=process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS,readReceipt=readExecutionReceipt,run=executeEvidenceProducer,fallbackDirectory,evidenceDirectory}={}){
  if(currentReceiptDirectory){
    const receipt=readReceipt(currentReceiptDirectory,owner);
    if(!receipt)throw new Error('EXECUTED_EVIDENCE_ORACLE: current ownership receipt is missing for '+owner+'; run '+owner+' before this consumer.');
    return receipt;
  }
  return run(owner,{directory:fallbackDirectory,evidenceDirectory,timeout:owner==='verify-ingestion.mjs'?AGGREGATE_TIMEOUT_MS:undefined});
}
async function verifyOwnershipReceiptRouting(load=ownershipReceiptSource){
  const cases=[];
  for(const owner of ownershipSuites){
    const receipt={suite:owner,reports:[{syntheticOwnershipRouting:true,exactReport:{preserved:[1,2,3]}}]},currentReceiptDirectory='SYNTHETIC_CURRENT_RECEIPTS';
    let calls=0,reads=0;
    const options={currentReceiptDirectory,readReceipt:(directory,suite)=>{reads++;assert.equal(directory,currentReceiptDirectory);assert.equal(suite,owner);return receipt;},run:async()=>{calls++;throw new Error('OWNERSHIP_RECEIPT_REUSE_ORACLE: current owner started again.');}};
    assert.equal(await load(owner,options),receipt,'OWNERSHIP_RECEIPT_COMPLETE_REPORT_ORACLE');assert.equal(calls,0);assert.equal(reads,1);
    await assert.rejects(()=>load(owner,{...options,readReceipt:()=>null}),/current ownership receipt is missing/,'OWNERSHIP_RECEIPT_MISSING_ORACLE');assert.equal(calls,0);
    for(const reason of ['stale source/specification/catalog/runtime receipt','receipt content digest mismatch','failed/incomplete receipt']){
      const failure=new Error('EXECUTED_EVIDENCE_ORACLE: '+reason);
      await assert.rejects(()=>load(owner,{...options,readReceipt:()=>{throw failure;}}),error=>error===failure,'OWNERSHIP_RECEIPT_INVALID_ORACLE');assert.equal(calls,0);
    }
    const fallback=await load(owner,{currentReceiptDirectory:null,fallbackDirectory:'SYNTHETIC_PRIVATE_RECEIPTS',evidenceDirectory:'SYNTHETIC_RUNNER',run:async(suite,options)=>{
      calls++;assert.equal(suite,owner);assert.deepEqual(options,{directory:'SYNTHETIC_PRIVATE_RECEIPTS',evidenceDirectory:'SYNTHETIC_RUNNER',timeout:owner==='verify-ingestion.mjs'?AGGREGATE_TIMEOUT_MS:undefined});return receipt;
    }});
    assert.equal(fallback,receipt);assert.equal(calls,1);
    cases.push({owner,currentReceiptExtraInvocations:0,standaloneAbsentInvocations:1,completeReportPreserved:true,missingCurrentRejected:true,invalidCurrentRejectedWithoutFallback:true});
  }
  return {syntheticRoutingControls:true,receiptAuthenticationClaimed:false,cases};
}

// This exercises the real preload producer, not a YAML presence or mocked
// successful suite. The unchanged Stage 03 verifier first runs all its actual
// prompt/parser/validator/commit/transition assertions in every control.
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-executed-evidence-'));
const source=fs.readFileSync('verify-stage03-agent-protocol.mjs','utf8').replace("'./verifier-runtime.mjs'",JSON.stringify(pathToFileURL(path.resolve('verifier-runtime.mjs')).href));
const preload=path.resolve('verification-evidence-preload.mjs'),suite='verify-stage03-agent-protocol.mjs';
const producerControls=[];
const deferredCatalogConsumerControl=verifyDueEvidenceConsumers();
const governanceDeclaration='specification/requirement-evidence-bindings.json';
const governance=JSON.parse(fs.readFileSync(governanceDeclaration,'utf8'));
const fullCoverageReviewInputs=(JSON.parse(fs.readFileSync('verification-assertion-bindings.json','utf8')).bindings||[]).flatMap(binding=>binding.fullCoverage?.review?.path?[binding.fullCoverage.review.path]:[]);
const governedApprovalInputs=[...new Set([...fullCoverageReviewInputs,...(governance.contextApplicabilityReview?[governance.contextApplicabilityReview.path]:[]),...(governance.approvedAmendments||[]).flatMap(amendment=>[amendment.sourceReviewPath,amendment.approvedProposalPath]),...(governance.independentSourceReview?[governance.independentSourceReview.sourceReviewPath,governance.independentSourceReview.reconciliationPath]:[])])].sort();
const declaredVerifierInputs=[...new Set([...Object.values(verificationCatalog),...Object.values(browserVerificationCatalog)].flatMap(suite=>suite.sourceInputs||[]))].sort();
const activeFixtureInputs=declaredVerifierInputs.filter(file=>file.startsWith('verification/')),activeHelperInputs=declaredVerifierInputs.filter(file=>!file.startsWith('verification/'));
const expectedActiveFixtureInputs=[
  'verification/deferred-definition-compatibility-legacy-fixture-20261005.json',
  'verification/deferred-definition-current-prerequisite-fixture-20261007.json',
  'verification/handoff-producer88-source-fixture-20261005.json',
  'verification/handoff-producer89-source-fixture-20261005.json',
  'verification/stage01-retained-capture-legacy-fixture-20261005.json'
];
function assertActiveFixtureInputs(paths){assert.deepEqual(paths,expectedActiveFixtureInputs,'FIXTURE_INPUT_ORACLE: active fixture source paths differ from the independently declared current producer inputs.');}
assertActiveFixtureInputs(activeFixtureInputs);
const fixtureCatalogMutations=[];
for(const file of expectedActiveFixtureInputs){
  assert.throws(()=>assertActiveFixtureInputs(activeFixtureInputs.filter(path=>path!==file)),/FIXTURE_INPUT_ORACLE/,'Omitting '+file+' must not preserve the declared source population.');
  fixtureCatalogMutations.push({file,mutation:'missing-path',result:'DETECTED'});
}
assert.throws(()=>assertActiveFixtureInputs([...activeFixtureInputs.slice(0,-1),'verification/unknown-fixture.json']),/FIXTURE_INPUT_ORACLE/,'A changed fixture path must not preserve the declared source population.');
fixtureCatalogMutations.push({file:'verification/unknown-fixture.json',mutation:'changed-path',result:'DETECTED'});
const producerFixtureInputs=['verify-stage03-agent-protocol.mjs','verifier-runtime.mjs','workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','verification-evidence-preload.mjs','verification-evidence.mjs','deployment-contract-identities.mjs','browser-execution-evidence.mjs','evaluate-mobile-acceptance-submission.mjs','verify-mobile-acceptance-evidence.mjs','verification-evidence-catalog.mjs','verification-negative-populations.json','verification-assertion-bindings.json','specification/closed-loop-reliability-controlling-implementation-specification.txt',governanceDeclaration,...governedApprovalInputs,...declaredVerifierInputs];
try{
  const ownershipReceiptRoutingControl=await verifyOwnershipReceiptRouting();
  await assert.rejects(()=>verifyOwnershipReceiptRouting((owner,options)=>options.run(owner,{})),/OWNERSHIP_RECEIPT_REUSE_ORACLE/,'OWNERSHIP_RECEIPT_FORMER_DUPLICATION_ORACLE');
  ownershipReceiptRoutingControl.formerDuplicateOwnerRejected=true;
  const dueSchedulingControl=await verifyDueVerificationScheduling(path.join(directory,'due-scheduling'));
  const crossRunSchedulingControl=await verifyCrossRunVerificationScheduling(path.join(directory,'cross-run-scheduling'));
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
    assert.equal(producer.status,0,'COLD_CHECKOUT_ORACLE: checked-out required producer did not pass: '+producer.stderr);
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
  const governanceSourceCases=[],activeFixtureSourceCases=[],activeHelperSourceCases=[],governanceBaseline=evidenceFingerprint(fixture);
  assert(governedApprovalInputs.length>=2,'GOVERNANCE_INPUT_ORACLE: active approved proposal/review pair is missing.');
  for(const file of [...governedApprovalInputs,...declaredVerifierInputs]){
    const target=path.join(fixture,file),bytes=fs.readFileSync(target);
    assert.equal(governanceBaseline.inputSha256[file],sha(bytes),'GOVERNANCE_INPUT_ORACLE: actual declared governance bytes are absent from execution identity.');
    fs.appendFileSync(target,'\n');
    const changed=evidenceFingerprint(fixture);
    assert.notEqual(changed.sourceInputsSha256,governanceBaseline.sourceInputsSha256,'GOVERNANCE_INPUT_ORACLE: changed active governance bytes retained the source fingerprint.');
    assert.throws(()=>validateExecutionReceipt(persistedOwnReceipt,suite,changed),/stale source\/specification\/catalog\/runtime receipt/,'GOVERNANCE_INPUT_ORACLE: stale actual producer receipt survived changed governance bytes.');
    fs.writeFileSync(target,bytes);
    validateExecutionReceipt(persistedOwnReceipt,suite,evidenceFingerprint(fixture));
    fs.unlinkSync(target);
    assert.throws(()=>evidenceFingerprint(fixture),/ENOENT/,'GOVERNANCE_INPUT_ORACLE: missing active governance bytes silently disappeared.');
    fs.writeFileSync(target,bytes);
    // Remove only the new active files from Git's index. The declaration still
    // makes their real bytes authoritative before an eventual candidate commit.
    execFileSync('git',['rm','--cached','--quiet',file],{cwd:fixture});
    assert.equal(evidenceFingerprint(fixture).inputSha256[file],sha(bytes),'GOVERNANCE_INPUT_ORACLE: untracked declared governance bytes lost execution identity.');
    fs.appendFileSync(target,'\n');
    const untrackedChanged=evidenceFingerprint(fixture);
    assert.throws(()=>validateExecutionReceipt(persistedOwnReceipt,suite,untrackedChanged),/stale source\/specification\/catalog\/runtime receipt/,'GOVERNANCE_INPUT_ORACLE: untracked governance mutation retained stale actual evidence.');
    fs.writeFileSync(target,bytes);
    execFileSync('git',['add',file],{cwd:fixture});
    validateExecutionReceipt(persistedOwnReceipt,suite,evidenceFingerprint(fixture));
    (activeFixtureInputs.includes(file)?activeFixtureSourceCases:activeHelperInputs.includes(file)?activeHelperSourceCases:governanceSourceCases).push({file,actualByteHashBound:true,changedBytesRejectActualReceipt:true,missingBytesFailHonestly:true,untrackedBytesBound:true,untrackedMutationRejectsActualReceipt:true,exactRestoreAdmitsActualReceipt:true});
  }
  const proposalPath=governedApprovalInputs.find(file=>file.endsWith('.md'));
  assert(proposalPath,'GOVERNANCE_INPUT_ORACLE: exact approved Markdown proposal is absent.');
  const proposalTarget=path.join(fixture,proposalPath),proposalBytes=fs.readFileSync(proposalTarget);
  const formerFingerprint=fingerprint=>{const copy=structuredClone(fingerprint);delete copy.inputSha256[proposalPath];copy.sourceInputsSha256=sha(copy.inputSha256);return copy;};
  const beforeEquivalent=formerFingerprint(evidenceFingerprint(fixture));
  fs.appendFileSync(proposalTarget,'\n');
  assert.equal(formerFingerprint(evidenceFingerprint(fixture)).sourceInputsSha256,beforeEquivalent.sourceInputsSha256,'GOVERNANCE_INPUT_ORACLE: prior Markdown-omitting fingerprint did not reproduce stale identity.');
  fs.writeFileSync(proposalTarget,proposalBytes);
  assertActiveFixtureInputs(activeFixtureInputs);
  const legacyFixturePath='verification/deferred-definition-compatibility-legacy-fixture-20261005.json',legacyFixtureTarget=path.join(fixture,legacyFixturePath),legacyFixtureBytes=fs.readFileSync(legacyFixtureTarget);
  const formerUntrackedFixtureFingerprint=fingerprint=>{const copy=structuredClone(fingerprint);delete copy.inputSha256[legacyFixturePath];copy.sourceInputsSha256=sha(copy.inputSha256);return copy;};
  execFileSync('git',['rm','--cached','--quiet',legacyFixturePath],{cwd:fixture});
  const priorUntrackedFixtureEquivalent=formerUntrackedFixtureFingerprint(evidenceFingerprint(fixture));
  fs.appendFileSync(legacyFixtureTarget,'\n');
  assert.equal(formerUntrackedFixtureFingerprint(evidenceFingerprint(fixture)).sourceInputsSha256,priorUntrackedFixtureEquivalent.sourceInputsSha256,'FIXTURE_INPUT_ORACLE: former untracked-fixture omission did not reproduce stale identity.');
  fs.writeFileSync(legacyFixtureTarget,legacyFixtureBytes);execFileSync('git',['add',legacyFixturePath],{cwd:fixture});validateExecutionReceipt(persistedOwnReceipt,suite,evidenceFingerprint(fixture));
  const activeHelperFingerprintControl={result:'PASS',boundary:'Exact registered first-party assertion helper bytes in the existing receipt fingerprint and freshness validator',actualProducerReceiptReused:true,declaredSourcePaths:activeHelperInputs,sourceCases:activeHelperSourceCases};
  const activeFixtureFingerprintControl={result:'PASS',boundary:'Existing actual Stage03 producer receipt and production source fingerprint/receipt consumer; isolated Git/filesystem, no added child',actualProducerReceiptReused:true,declaredSourcePaths:activeFixtureInputs,sourceCases:activeFixtureSourceCases,fixtureCatalogMutations,formerUntrackedFixtureOmissionReproduced:true};
  const governanceFingerprintControl={result:'PASS',boundary:'Existing actual Stage03 producer receipt, isolated Git checkout and production fingerprint/receipt consumer; no new producer execution',declaredSourcePaths:governedApprovalInputs,actualProducerReceiptReused:true,formerMarkdownOmissionReproduced:true,sourceCases:governanceSourceCases};
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
  // Exercise ingestion and its independent registered authority/custody owners.
  // Their exact receipt assertions cannot be supplied by the ingestion wrapper.
  const expectedCanonicalIdsByOwner={
    'verify-response-authority-integrity.mjs':[
      'PRODUCER-TIMING-REJECT-VERIFICATION_PHASE','PRODUCER-TIMING-REJECT-EARLIEST_EXECUTABLE_STAGE','PRODUCER-TIMING-REJECT-REQUIRED_BY_STAGE','PRODUCER-TIMING-REJECT-PER_RUN_REQUIRED','PRODUCER-TIMING-REJECT-FINAL_PRODUCT_REQUIRED','PRODUCER-TIMING-REJECT-DELIVERY_REQUIRED','PRODUCER-TIMING-REJECT-TARGET_AVAILABILITY_CONDITION','PRODUCER-TIMING-REJECT-TIMING_ENTRIES','PRODUCER-TIMING-REJECT-TIMING_SCHEDULE_SHA256','PRODUCER-TIMING-PROMPT-EXCLUDES-APPLICATION-FIELDS','RESPONSE-CLOSED-FAMILY-BOUNDARY'
    ],
    'verify-returned-slot-authority.mjs':[
      'ATTACHMENT-SLOT-INVENTED-REJECTED','ATTACHMENT-SLOT-FOREIGN-REJECTED','ATTACHMENT-SLOT-ROLE-MISMATCH-REJECTED','ATTACHMENT-PACKAGE-EXACT-SLOT-BYTES','BOUNDARY-CORRECTED-RETURNED-FILE-RETRY','RETURNED-BYTE-CUSTODY-RETRY-RECOVERY','ACTUAL-UI-RETURNED-BYTE-REVERIFY'
    ]
  };
  const ownershipReceipts=new Map();
  // Foundation owns all three complete proofs. Require their validated current
  // receipts in CI; a standalone invocation retains the original producer path.
  for(const owner of ownershipSuites)ownershipReceipts.set(owner,await ownershipReceiptSource(owner,{fallbackDirectory:path.join(directory,'ownership-receipts'),evidenceDirectory:path.join(directory,'ownership-runner')}));
  const wrapper=ownershipReceipts.get('verify-ingestion.mjs'),canonicalIds=ownershipSuites.slice(1).flatMap(owner=>ownershipReceipts.get(owner).reports.flatMap(report=>report.verificationObservations||[]).map(row=>row.checkId));
  for(const [owner,expectedIds]of Object.entries(expectedCanonicalIdsByOwner)){
    const actualIds=ownershipReceipts.get(owner).reports.flatMap(report=>report.verificationObservations||[]).map(row=>row.checkId);
    assert.deepEqual([...actualIds].sort(),[...expectedIds].sort(),'OBSERVATION_OWNER_ORACLE: the exact canonical population differs for '+owner);
  }
  assert(canonicalIds.every(id=>!wrapper.reports.some(report=>report.verificationObservations?.some(row=>row.checkId===id))),'OBSERVATION_OWNER_ORACLE: ingestion redundantly executed an independently owned assertion.');
  assert(canonicalIds.every(id=>!wrapper.observations.some(row=>row.checkId===id)),'OBSERVATION_OWNER_ORACLE: wrapper claimed canonical imported assertion identities.');
  const ingestionReferenceChecks=[
    {checkId:'EVIDENCE-SOURCE-SCOPE-AUTHORITY',marker:'evidenceSourceScopeAuthority',populationId:'ingestion.evidence-source-scope',observed:{currentAccepted:true,invalidAdmissionRejected:5,invalidPrecommitRejected:5,rawAndPendingStatePreserved:true,optionalOmissionAccepted:true,historicalExecutionEvidenceRetained:true,operationContext:{currentUnprovidedRejected:2,preFixEquivalentFalseAdmissions:2,legacyPendingCommitRejected:2,conformingControlsCommitted:5}}},
    {checkId:'EVIDENCE-ATTACHMENT-SCOPE-CUSTODY',marker:'evidenceAttachmentScopeCustody',populationId:'ingestion.evidence-attachment-custody',observed:{currentBytesAccepted:true,metadataAndStaleAdmissionRejected:true,changedAndMissingBytesPrecommitRejected:true,pendingWorkPreserved:true,evidenceAfterByteLossInsufficient:true,restoredExactBytesProgress:true}}
  ];
  for(const {checkId,marker,populationId,observed}of ingestionReferenceChecks){
    const owned=wrapper.observations.filter(row=>row.checkId===checkId);
    assert.equal(owned.length,1,'INGESTION_REFERENCE_OBSERVATION_ORACLE: missing or duplicate owning detail '+checkId);
    assert.equal(owned[0].passed,true);assert.deepEqual(owned[0].observed,observed,'INGESTION_REFERENCE_OBSERVATION_ORACLE: the exact source/custody control population changed.');
    const incomplete=structuredClone(wrapper);
    for(const report of incomplete.reports)if(Array.isArray(report.verificationObservations))report.verificationObservations=report.verificationObservations.filter(row=>row.checkId!==checkId);
    incomplete.observations=observationsFromReports('verify-ingestion.mjs',incomplete.reports);
    assert.equal(incomplete.observations.find(row=>row.checkId===populationId)?.passed,false,'INGESTION_REFERENCE_OBSERVATION_ORACLE: omitted '+checkId+' passed its required population.');
    delete incomplete.receiptSha256;incomplete.receiptSha256=sha(incomplete);
    assert.throws(()=>validateExecutionReceipt(incomplete,'verify-ingestion.mjs',evidenceFingerprint()),/receipt assertions differ from actual executed report/,'INGESTION_REFERENCE_OBSERVATION_ORACLE: omitted '+checkId+' became an acceptable receipt.');
    const missingReport=structuredClone(wrapper.reports).filter(report=>!Object.hasOwn(report,marker));
    assert.throws(()=>observationsFromReports('verify-ingestion.mjs',missingReport),new RegExp('expected exactly one report marker '+marker),'INGESTION_REFERENCE_OBSERVATION_ORACLE: the owning source/custody report disappeared.');
    producerControls.push({caseId:'missing-required-ingestion-reference-observation:'+checkId,accepted:false,result:'DETECTED'});
  }
  const humanTargetCheckId='HUMAN-DECISION-CANDIDATE-TARGET-AUTHORITY',humanTargetMarker='humanDecisionCandidateTargetAuthority';
  const humanTarget=wrapper.observations.filter(row=>row.checkId===humanTargetCheckId);
  assert.equal(humanTarget.length,1,'HUMAN_TARGET_OBSERVATION_ORACLE: missing or duplicate canonical ingestion detail.');
  assert.equal(humanTarget[0].passed,true);
  assert.deepEqual(humanTarget[0].observed,{invalidAdmissionRejected:11,preFixEquivalentFalseAdmission:true,legacyPendingCommitRejected:true,confirmedConformingControls:5,retainedSelectionControl:true,ordinaryHumanFalsePreserved:true,actualAssurance:'SELF_ASSERTED'},'HUMAN_TARGET_OBSERVATION_ORACLE: exact independent target/correction/control population changed.');
  const humanTargetIncomplete=structuredClone(wrapper);
  for(const report of humanTargetIncomplete.reports)if(Array.isArray(report.verificationObservations))report.verificationObservations=report.verificationObservations.filter(row=>row.checkId!==humanTargetCheckId);
  humanTargetIncomplete.observations=observationsFromReports('verify-ingestion.mjs',humanTargetIncomplete.reports);
  assert.equal(humanTargetIncomplete.observations.find(row=>row.checkId==='ingestion.human-decision-target-authority')?.passed,false,'HUMAN_TARGET_OBSERVATION_ORACLE: omitted target detail passed its required population.');
  delete humanTargetIncomplete.receiptSha256;humanTargetIncomplete.receiptSha256=sha(humanTargetIncomplete);
  assert.throws(()=>validateExecutionReceipt(humanTargetIncomplete,'verify-ingestion.mjs',evidenceFingerprint()),/receipt assertions differ from actual executed report/,'HUMAN_TARGET_OBSERVATION_ORACLE: omitted target detail became an acceptable receipt.');
  assert.throws(()=>observationsFromReports('verify-ingestion.mjs',structuredClone(wrapper.reports).filter(report=>!Object.hasOwn(report,humanTargetMarker))),/expected exactly one report marker humanDecisionCandidateTargetAuthority/,'HUMAN_TARGET_OBSERVATION_ORACLE: mandatory target owner marker disappeared.');
  producerControls.push({caseId:'missing-required-human-candidate-target-observation',accepted:false,result:'DETECTED'});
  const externalIdentityCheckId='EXTERNAL-RESPONSE-IDENTITY-SHAPE',externalIdentity=wrapper.observations.filter(row=>row.checkId===externalIdentityCheckId);
  assert.equal(externalIdentity.length,1,'EXTERNAL_IDENTITY_OBSERVATION_ORACLE: missing or duplicate canonical ingestion detail.');
  assert.equal(externalIdentity[0].passed,true);
  assert.deepEqual(externalIdentity[0].observed,{scalarTypeRejections:11,referenceTypeRejections:10,preFixEquivalentFalseAdmissions:17,legacyPendingCommitRejections:2,existingVocabularyAndScopeRejections:7,conformingControlsCommitted:3,nestedFieldTypeRejections:16,nestedPreFixEquivalentFalseAdmissions:16,invalidDiagnosticErrorsSaved:3,preFixDiagnosticSaveFailures:2,arbitraryHumanJsonPreserved:true},'EXTERNAL_IDENTITY_OBSERVATION_ORACLE: independently declared type/recovery/control population changed.');
  const externalIdentityIncomplete=structuredClone(wrapper);
  for(const report of externalIdentityIncomplete.reports)if(Array.isArray(report.verificationObservations))report.verificationObservations=report.verificationObservations.filter(row=>row.checkId!==externalIdentityCheckId);
  externalIdentityIncomplete.observations=observationsFromReports('verify-ingestion.mjs',externalIdentityIncomplete.reports);
  assert.equal(externalIdentityIncomplete.observations.find(row=>row.checkId==='ingestion.external-identity-shape')?.passed,false,'EXTERNAL_IDENTITY_OBSERVATION_ORACLE: omitted identity detail passed its required population.');
  delete externalIdentityIncomplete.receiptSha256;externalIdentityIncomplete.receiptSha256=sha(externalIdentityIncomplete);
  assert.throws(()=>validateExecutionReceipt(externalIdentityIncomplete,'verify-ingestion.mjs',evidenceFingerprint()),/receipt assertions differ from actual executed report/,'EXTERNAL_IDENTITY_OBSERVATION_ORACLE: omitted identity detail became an acceptable receipt.');
  assert.throws(()=>observationsFromReports('verify-ingestion.mjs',structuredClone(wrapper.reports).filter(report=>!Object.hasOwn(report,'externalResponseIdentityShape'))),/expected exactly one report marker externalResponseIdentityShape/,'EXTERNAL_IDENTITY_OBSERVATION_ORACLE: mandatory identity marker disappeared.');
  producerControls.push({caseId:'missing-required-external-response-identity-observation',accepted:false,result:'DETECTED'});
  const canonicalBoundaryChecks=[
    {checkId:'CANONICAL-RESPONSE-RECOVERY',marker:'canonicalResponseRecovery',populationId:'ingestion.canonical-response-recovery',observed:{unsupportedCanonicalValuesRejectedAndReloaded:7,preFixEquivalentCanonicalCrashes:7,directValidatorRejections:7,noncanonicalPendingRejections:2,validUnicodeCommitted:true}},
    {checkId:'RESPONSE-CANONICAL-VALUE-BOUNDARIES',marker:'responseCanonicalValueBoundaries',populationId:'ingestion.canonical-value-boundaries',observed:{malformedAttachmentDigestRejected:true,preFixEquivalentDigestFalseAdmission:true,inheritedFieldRejections:2,preFixInheritedFieldFalseAdmissions:2,reorderedObjectConfirmed:true,reorderedObjectDoesNotCreateCorrection:true,preFixFalseCorrection:true,materialValueChangesRequireCorrection:4}}
  ];
  for(const {checkId,marker,populationId,observed} of canonicalBoundaryChecks){
    const owned=wrapper.observations.filter(row=>row.checkId===checkId);
    assert.equal(owned.length,1,'CANONICAL_BOUNDARY_OBSERVATION_ORACLE: missing or duplicate owning detail '+checkId);
    assert.equal(owned[0].passed,true);assert.deepEqual(owned[0].observed,observed,'CANONICAL_BOUNDARY_OBSERVATION_ORACLE: independently declared finite recovery/value population changed.');
    const incomplete=structuredClone(wrapper);
    for(const report of incomplete.reports)if(Array.isArray(report.verificationObservations))report.verificationObservations=report.verificationObservations.filter(row=>row.checkId!==checkId);
    incomplete.observations=observationsFromReports('verify-ingestion.mjs',incomplete.reports);
    assert.equal(incomplete.observations.find(row=>row.checkId===populationId)?.passed,false,'CANONICAL_BOUNDARY_OBSERVATION_ORACLE: omitted '+checkId+' passed its required population.');
    delete incomplete.receiptSha256;incomplete.receiptSha256=sha(incomplete);
    assert.throws(()=>validateExecutionReceipt(incomplete,'verify-ingestion.mjs',evidenceFingerprint()),/receipt assertions differ from actual executed report/,'CANONICAL_BOUNDARY_OBSERVATION_ORACLE: omitted '+checkId+' became an acceptable receipt.');
    assert.throws(()=>observationsFromReports('verify-ingestion.mjs',structuredClone(wrapper.reports).filter(report=>!Object.hasOwn(report,marker))),new RegExp('expected exactly one report marker '+marker),'CANONICAL_BOUNDARY_OBSERVATION_ORACLE: owning marker disappeared.');
    producerControls.push({caseId:'missing-required-canonical-boundary-observation:'+checkId,accepted:false,result:'DETECTED'});
  }
  const ownerAbsent=aggregateExecutedEvidence(new Map([['verify-ingestion.mjs',wrapper]]),evidenceFingerprint());
  const absentLinks=ownerAbsent.normativeRequirementTrace.filter(row=>row.scopeBindings.some(binding=>binding.checkIds.some(id=>canonicalIds.includes(id))));
  assert(absentLinks.length>0&&absentLinks.every(row=>row.disposition==='UNKNOWN'),'OBSERVATION_OWNER_ORACLE: imported reports masked missing canonical owner proof.');
  const ownedAggregate=aggregateExecutedEvidence(ownershipReceipts,evidenceFingerprint());
  assert.equal(ownedAggregate.receiptCount,3,'OBSERVATION_OWNER_ORACLE: actual composed/owner receipts did not aggregate.');
  // This additional closed-family regression is required by its producer
  // catalog, but is supplemental to the reviewed normative assertion bindings.
  // Every other independently owned detail must retain its exact clause link.
  const supplementalCanonicalIds=['RESPONSE-CLOSED-FAMILY-BOUNDARY'];
  const normativeBindingIds=new Set(JSON.parse(fs.readFileSync('verification-assertion-bindings.json','utf8')).bindings.flatMap(binding=>binding.checkIds));
  assert.deepEqual(canonicalIds.filter(id=>!normativeBindingIds.has(id)),supplementalCanonicalIds,'OBSERVATION_OWNER_ORACLE: the exact supplemental owner population changed.');
  assert(ownershipReceipts.get('verify-response-authority-integrity.mjs').observations.some(row=>row.checkId==='admission-contract.response.closed-family-boundary'&&row.passed===true),'OBSERVATION_OWNER_ORACLE: supplemental closed-family catalog check is missing.');
  assert(canonicalIds.filter(id=>normativeBindingIds.has(id)).every(id=>ownedAggregate.normativeRequirementTrace.some(row=>row.executedAssertions.some(assertion=>assertion.checkId===id&&assertion.suite!=='verify-ingestion.mjs'))),'OBSERVATION_OWNER_ORACLE: exact canonical assertion links were lost.');
  for(const normativeRequirementId of ['NREQ-749b81ff8c36960f18ded1d0142a724a','NREQ-8c446bb0f81585af8291c866b1d2ef37']){
    const requirement=ownedAggregate.normativeRequirementTrace.find(row=>row.normativeRequirementId===normativeRequirementId);
    assert.equal(requirement?.disposition,'QUALIFIED_EXECUTED_ASSERTION_EVIDENCE','INGESTION_REFERENCE_NORMATIVE_LINK_ORACLE: exact relationship/scope/precommit obligation lost its executed control.');
    assert.deepEqual(requirement.executedAssertions.map(row=>[row.checkId,row.suite]),ingestionReferenceChecks.map(row=>[row.checkId,'verify-ingestion.mjs']).concat([[externalIdentityCheckId,'verify-ingestion.mjs']]),'INGESTION_REFERENCE_NORMATIVE_LINK_ORACLE: reference/type controls were omitted or attributed to another producer.');
  }
  const wrongTypeRequirement=ownedAggregate.normativeRequirementTrace.find(row=>row.normativeRequirementId==='NREQ-486b3d356d1077e6a811948127d14ba7');
  assert.equal(wrongTypeRequirement?.disposition,'UNKNOWN','EXTERNAL_IDENTITY_NORMATIVE_OWNER_ORACLE: ingestion assertions masked the missing closed native binding type owner.');
  assert.deepEqual(wrongTypeRequirement.missingAssertionIds,['RUNTIME-CLOSED-BINDING-STRING-TYPES-REJECTED'],'EXTERNAL_IDENTITY_NORMATIVE_OWNER_ORACLE: exact missing native type owner was not retained.');
  assert.deepEqual(wrongTypeRequirement.executedAssertions.map(row=>[row.checkId,row.suite]),[[externalIdentityCheckId,'verify-ingestion.mjs'],['RESPONSE-CANONICAL-VALUE-BOUNDARIES','verify-ingestion.mjs']],'EXTERNAL_IDENTITY_NORMATIVE_LINK_ORACLE: wrong-type control was attributed to another producer.');
  const nativeBindingRequirement=ownedAggregate.normativeRequirementTrace.find(row=>row.normativeRequirementId==='NREQ-621d5f7e000ff2bcf9b817b4229ba8e2');
  assert.equal(nativeBindingRequirement?.disposition,'UNKNOWN','NATIVE_BINDING_NORMATIVE_OWNER_ORACLE: unrelated ingestion receipts established a missing native binding owner.');
  assert.deepEqual(nativeBindingRequirement.missingAssertionIds,['RUNTIME-CLOSED-BINDING-STRING-TYPES-REJECTED']);
  assert.deepEqual(nativeBindingRequirement.executedAssertions,[],'NATIVE_BINDING_NORMATIVE_OWNER_ORACLE: controlled report-shape fixtures became execution evidence.');
  const retainedCustodyMissing=ownedAggregate.normativeRequirementTrace.find(row=>row.normativeRequirementId==='NREQ-b6c59f9417a6a40c7aee067b456a2a81');
  assert.equal(retainedCustodyMissing?.disposition,'UNKNOWN','RETAINED_CUSTODY_NORMATIVE_LINK_ORACLE: ingestion evidence masked the missing canonical reload owner.');
  assert.deepEqual(retainedCustodyMissing.missingAssertionIds,['RETAINED-HISTORICAL-EVIDENCE-CUSTODY']);
  assert.deepEqual(retainedCustodyMissing.executedAssertions.map(row=>[row.checkId,row.suite]),ingestionReferenceChecks.map(row=>[row.checkId,'verify-ingestion.mjs']),'RETAINED_CUSTODY_NORMATIVE_LINK_ORACLE: current reference controls were lost while retained custody was unknown.');
  producerControls.push({caseId:'missing-retained-historical-custody-owner',accepted:false,result:'DETECTED'});
  for(const normativeRequirementId of ['NREQ-9187118f7b09bef886f677cfc943c664','NREQ-a475189429d715ecf6143001a65519a6','NREQ-2bbf10b970acb8382c6def922798d68a']){
    const requirement=ownedAggregate.normativeRequirementTrace.find(row=>row.normativeRequirementId===normativeRequirementId);
    assert.equal(requirement?.disposition,'UNKNOWN','HUMAN_TARGET_NORMATIVE_OWNER_ORACLE: candidate intake masked the missing current native human target/storage owner.');
    assert.deepEqual(requirement.missingAssertionIds,['CURRENT-HUMAN-DECISION-TARGET-INTEGRITY']);
    assert.deepEqual(requirement.executedAssertions.map(row=>[row.checkId,row.suite]),[[humanTargetCheckId,'verify-ingestion.mjs']].concat(normativeRequirementId==='NREQ-9187118f7b09bef886f677cfc943c664'?[['RESPONSE-CANONICAL-VALUE-BOUNDARIES','verify-ingestion.mjs']]:[]),'HUMAN_TARGET_NORMATIVE_OWNER_ORACLE: intake control was attributed to another producer.');
  }
  producerControls.push({caseId:'missing-current-native-human-target-owner',accepted:false,result:'DETECTED'});

  const suppliedInputRequirementIds=['NREQ-e9ee7497bb9d7e5d687f2bd0e17654b3','NREQ-59a90d9d6965e63d52bd071fdaab48e3','NREQ-5820c2c7d769128a6e1e32543e3bf8aa','NREQ-e88a52eae80983f9d011ec1b3d4c5eff'];
  for(const normativeRequirementId of suppliedInputRequirementIds){
    const requirement=ownedAggregate.normativeRequirementTrace.find(row=>row.normativeRequirementId===normativeRequirementId);
    assert.equal(requirement?.disposition,'UNKNOWN','SUPPLIED_INPUT_CUSTODY_OWNER_ORACLE: response intake masked the missing native retained-input storage owner.');
    assert.deepEqual(requirement.missingAssertionIds,['CURRENT-SUPPLIED-INPUT-CUSTODY']);
    assert.deepEqual(requirement.executedAssertions,[],'SUPPLIED_INPUT_CUSTODY_OWNER_ORACLE: unrelated receipts supplied canonical storage evidence.');
  }
  producerControls.push({caseId:'missing-current-supplied-input-custody-owner',accepted:false,result:'DETECTED'});
  // This is a controlled report-shape fixture for the catalog consumer only.
  // It is never turned into an execution receipt or normative evidence. The
  // ordinary persistence producer separately executes these storage assertions.
  const storagePopulationFixture={retainedEvidenceCustody:true,currentSuppliedInputCustody:true,synthetic:true,verificationObservations:[
    {checkId:'RETAINED-HISTORICAL-EVIDENCE-CUSTODY',boundary:'controlled catalog population fixture',expected:true,observed:true,passed:true},
    {checkId:'CURRENT-SUPPLIED-INPUT-CUSTODY',boundary:'controlled catalog population fixture',expected:{omittedInputObserverInsufficient:true,currentSuppliedIdentityRetained:true,noManualReadRequired:true,commitReloadRestoreWorks:true,negativeVariantsInsufficient:5,noRetroactiveHistoricalAuthorization:true},observed:{omittedInputObserverInsufficient:true,currentSuppliedIdentityRetained:true,noManualReadRequired:true,commitReloadRestoreWorks:true,negativeVariantsInsufficient:5,noRetroactiveHistoricalAuthorization:true},passed:true}
  ]};
  // This controlled report contains only the two custody assertions. Isolate
  // their real catalog checks so later, independently owned storage markers do
  // not make this focused consumer fixture malformed.
  const storagePopulationSuite='verify-operational-persistence.custody-fixture.mjs';
  const storageCustodyCheckIds=['store.retained-evidence-custody','store.current-supplied-input-custody'];
  const custodyChecks=verificationCatalog['verify-operational-persistence.mjs'].checks.filter(check=>storageCustodyCheckIds.includes(check.id));
  assert.deepEqual(custodyChecks.map(check=>check.id),storageCustodyCheckIds,'STORAGE_POPULATION_ORACLE: custody catalog checks changed.');
  assert.throws(()=>observationsFromReports('verify-operational-persistence.mjs',[storagePopulationFixture]),/expected exactly one report marker/,'STORAGE_POPULATION_ORACLE: the focused fixture cannot stand in for the complete persistence producer.');
  assert.equal(verificationCatalog[storagePopulationSuite],undefined,'STORAGE_POPULATION_ORACLE: fixture suite collided with a registered producer.');
  verificationCatalog[storagePopulationSuite]={boundary:'controlled custody catalog fixture only',checks:custodyChecks};
  try{
  assert(observationsFromReports(storagePopulationSuite,[storagePopulationFixture]).every(row=>row.passed),'STORAGE_POPULATION_ORACLE: conforming consumer report shape failed.');
  for(const [caseId,mutate] of [
    ['missing-current-supplied-input-outcome',value=>{delete value.noManualReadRequired;}],
    ['wrong-current-supplied-input-outcome',value=>{value.commitReloadRestoreWorks=false;}],
    ['missing-current-supplied-input-negative-case',value=>{value.negativeVariantsInsufficient=4;}],
    ['undeclared-current-supplied-input-outcome',value=>{value.unassertedOutcome=true;}]
  ]){
    const changed=structuredClone(storagePopulationFixture),detail=changed.verificationObservations.find(row=>row.checkId==='CURRENT-SUPPLIED-INPUT-CUSTODY');mutate(detail.expected);mutate(detail.observed);
    assert.equal(observationsFromReports(storagePopulationSuite,[changed]).find(row=>row.checkId==='store.current-supplied-input-custody')?.passed,false,'STORAGE_POPULATION_ORACLE: a self-consistent reported PASS with a changed finite outcome/count masked the required native byte population.');
    producerControls.push({caseId,accepted:false,result:'DETECTED'});
  }
  for(const [checkId,marker,populationId] of [
    ['RETAINED-HISTORICAL-EVIDENCE-CUSTODY','retainedEvidenceCustody','store.retained-evidence-custody'],
    ['CURRENT-SUPPLIED-INPUT-CUSTODY','currentSuppliedInputCustody','store.current-supplied-input-custody']
  ]){
    const missingDetail=structuredClone(storagePopulationFixture);missingDetail.verificationObservations=missingDetail.verificationObservations.filter(row=>row.checkId!==checkId);
    assert.equal(observationsFromReports(storagePopulationSuite,[missingDetail]).find(row=>row.checkId===populationId)?.passed,false,'STORAGE_POPULATION_ORACLE: omitted canonical storage detail passed its required population.');
    const missingMarker=structuredClone(storagePopulationFixture);delete missingMarker[marker];
    assert.throws(()=>observationsFromReports(storagePopulationSuite,[missingMarker]),new RegExp('expected exactly one report marker '+marker),'STORAGE_POPULATION_ORACLE: missing canonical storage marker passed.');
    producerControls.push({caseId:'missing-required-storage-population:'+checkId,accepted:false,result:'DETECTED'});
  }
  }finally{delete verificationCatalog[storagePopulationSuite];}

  // Controlled catalog input only. The Stage 28 owner must supply its own
  // direct derivation and disposable blank-project store observation.
  const stage28ProjectionControl={
    stage28:'PASS',applicationByteRehashRequired:true,exactCandidateMappingRequired:true,
    orderIndependentIdentity:true,destinationBoundIntentGate:true,trustedTimedValidityGate:true,
    ambiguousDuplicateIntentBlocked:true,candidateSemanticDriftRejected:true,
    identityScopeDriftRejected:true,stage28DoesNotAuthorizeDelivery:true,
    pendingIdentityStoreProjection:{formerFault:'PRESENT_NULL',currentPending:'OMITTED',
      realStoreRoundtrip:true,nullWriteRejected:true,lastValidStatePreserved:true,
      boundary:'DIRECT_STAGE28_DERIVATION_AND_DISPOSABLE_BLANK_PROJECT_STORE_WRITE_READ',fullStage27Journey:false}
  };
  const stage28ProjectionId='artifact.pending-id-store-projection';
  const stage28ProjectionPassed=report=>observationsFromReports('verify-stage28-artifact-delivery-intent.mjs',[report]).find(row=>row.checkId===stage28ProjectionId)?.passed;
  assert.equal(stage28ProjectionPassed(stage28ProjectionControl),true,'STAGE28_PENDING_STORE_CATALOG_ORACLE: conforming direct store projection was rejected.');
  for(const [name,mutate] of [
    ['missing-projection',report=>{delete report.pendingIdentityStoreProjection;}],
    ['null-write-accepted',report=>{report.pendingIdentityStoreProjection.nullWriteRejected=false;}],
    ['last-valid-state-lost',report=>{report.pendingIdentityStoreProjection.lastValidStatePreserved=false;}],
    ['false-full-stage27-claim',report=>{report.pendingIdentityStoreProjection.fullStage27Journey=true;}]
  ]){
    const changed=structuredClone(stage28ProjectionControl);mutate(changed);
    assert.equal(stage28ProjectionPassed(changed),false,'STAGE28_PENDING_STORE_CATALOG_ORACLE: '+name+' passed the required current-store observation.');
    producerControls.push({caseId:'stage28-pending-store:'+name,accepted:false,result:'DETECTED'});
  }

  // This independently declared report-shape fixture tests only the native
  // catalog consumer. It is never an executed receipt or normative proof.
  const bindingTypePopulationFixture={verifyTestRuntimeIntegrity:'PASS',verificationObservations:[{
    checkId:'RUNTIME-CLOSED-BINDING-STRING-TYPES-REJECTED',boundary:'controlled native binding catalog fixture',passed:true,
    expected:{attempted:64,rejected:64,accepted:0,presentPropertyType:'NONEMPTY_STRING',hashFormat:'64_LOWERCASE_HEXADECIMAL_CHARACTERS',omission:'EXISTING_DEFAULTS'},
    observed:{attempted:64,rejected:64,accepted:0}
  }]};
  const bindingTypePopulationSuite='verify-test-runtime-integrity.mjs',bindingTypePopulationId='runtime.closed-binding-string-types';
  const bindingTypePopulationResult=report=>observationsFromReports(bindingTypePopulationSuite,[report]).find(row=>row.checkId===bindingTypePopulationId)?.passed;
  assert.equal(bindingTypePopulationResult(bindingTypePopulationFixture),true,'NATIVE_BINDING_POPULATION_ORACLE: conforming finite catalog report shape failed.');
  for(const [caseId,mutate]of [
    ['missing-native-binding-type-count',row=>{delete row.expected.attempted;delete row.observed.attempted;}],
    ['wrong-native-binding-type-count',row=>{row.expected.rejected=63;row.observed.rejected=63;}],
    ['false-native-binding-type-acceptance',row=>{row.expected.accepted=1;row.observed.accepted=1;}],
    ['coerced-native-binding-type-count',row=>{row.expected.attempted='64';row.observed.attempted='64';}],
    ['undeclared-native-binding-type-count',row=>{row.expected.unassertedOutcome=true;row.observed.unassertedOutcome=true;}],
    ['wrong-native-binding-type-contract',row=>{row.expected.presentPropertyType='COERCIBLE_VALUE';}]
  ]){
    const changed=structuredClone(bindingTypePopulationFixture);mutate(changed.verificationObservations[0]);
    assert.equal(bindingTypePopulationResult(changed),false,'NATIVE_BINDING_POPULATION_ORACLE: self-consistent reported PASS replaced the independently declared finite native population: '+caseId);
    producerControls.push({caseId,accepted:false,result:'DETECTED'});
  }
  const missingBindingTypeDetail=structuredClone(bindingTypePopulationFixture);missingBindingTypeDetail.verificationObservations=[];
  assert.equal(bindingTypePopulationResult(missingBindingTypeDetail),false,'NATIVE_BINDING_POPULATION_ORACLE: omitted required native type detail passed.');
  const failedBindingTypeMarker=structuredClone(bindingTypePopulationFixture);failedBindingTypeMarker.verifyTestRuntimeIntegrity='FAIL';
  assert.equal(bindingTypePopulationResult(failedBindingTypeMarker),false,'NATIVE_BINDING_POPULATION_ORACLE: failed native suite marker passed.');
  const missingBindingTypeMarker=structuredClone(bindingTypePopulationFixture);delete missingBindingTypeMarker.verifyTestRuntimeIntegrity;
  assert.throws(()=>bindingTypePopulationResult(missingBindingTypeMarker),/expected exactly one report marker verifyTestRuntimeIntegrity/,'NATIVE_BINDING_POPULATION_ORACLE: missing native suite marker passed.');
  const duplicateBindingTypeDetail=structuredClone(bindingTypePopulationFixture);duplicateBindingTypeDetail.verificationObservations.push(structuredClone(duplicateBindingTypeDetail.verificationObservations[0]));
  assert.throws(()=>bindingTypePopulationResult(duplicateBindingTypeDetail),/duplicate emitted assertion RUNTIME-CLOSED-BINDING-STRING-TYPES-REJECTED/,'NATIVE_BINDING_POPULATION_ORACLE: duplicate required native detail passed.');
  producerControls.push({caseId:'missing-required-native-binding-type-owner',accepted:false,result:'DETECTED'});

  // Each new custody observation is mandatory at the receipt boundary, not
  // merely another favorable imported report. Retain the real producer reports
  // and suppress one detail only in this deliberate negative receipt control.
  const custodySuite='verify-returned-slot-authority.mjs';
  const custodyCheckIds=['RETURNED-BYTE-CUSTODY-RETRY-RECOVERY','ACTUAL-UI-RETURNED-BYTE-REVERIFY'];
  for(const checkId of custodyCheckIds){
    const incomplete=structuredClone(ownershipReceipts.get(custodySuite));
    for(const report of incomplete.reports)if(Array.isArray(report.verificationObservations))report.verificationObservations=report.verificationObservations.filter(row=>row.checkId!==checkId);
    incomplete.observations=observationsFromReports(custodySuite,incomplete.reports);
    assert.equal(incomplete.observations.find(row=>row.checkId==='response.returned-slot-controls')?.passed,false,'CUSTODY_OBSERVATION_ORACLE: omitted '+checkId+' passed the required slot population.');
    delete incomplete.receiptSha256;incomplete.receiptSha256=sha(incomplete);
    assert.throws(()=>validateExecutionReceipt(incomplete,custodySuite,evidenceFingerprint()),/receipt assertions differ from actual executed report/,'CUSTODY_OBSERVATION_ORACLE: omitted '+checkId+' became an acceptable receipt.');
    producerControls.push({caseId:'missing-required-custody-observation:'+checkId,accepted:false,result:'DETECTED'});
  }
  for(const [normativeRequirementId,checkIds]of [
    ['NREQ-45544bcb4c30339899fe4199879fa5e0',custodyCheckIds],
    ['NREQ-d6be21916e3d29c42922719f2b17f4de',['ACTUAL-UI-RETURNED-BYTE-REVERIFY']]
  ]){
    const requirement=ownedAggregate.normativeRequirementTrace.find(row=>row.normativeRequirementId===normativeRequirementId);
    assert(requirement&&checkIds.every(checkId=>requirement.executedAssertions.some(row=>row.checkId===checkId&&row.suite===custodySuite)),'CUSTODY_NORMATIVE_LINK_ORACLE: exact readback/reverify obligation lost its canonical custody assertion.');
  }
  // A second producer explicitly claiming an already owned identity must still
  // fail the real aggregate boundary, even with consistent per-receipt hashes.
  const duplicate=structuredClone(registryReceipt),detail=structuredClone(good.receipt.reports.flatMap(report=>report.verificationObservations||[])[0]);
  duplicate.reports.find(report=>Object.hasOwn(report,'contractClosure')).verificationObservations=[detail];
  duplicate.observations=observationsFromReports(registrySuite,duplicate.reports);delete duplicate.receiptSha256;duplicate.receiptSha256=sha(duplicate);
  assert.throws(()=>aggregateExecutedEvidence(new Map([[suite,good.receipt],[registrySuite,duplicate]]),evidenceFingerprint()),new RegExp('duplicate observation '+detail.checkId),'OBSERVATION_OWNER_ORACLE: a double-owned detailed assertion became accepted evidence.');
  producerControls.push({caseId:'double-owned-detailed-assertion',accepted:false,result:'DETECTED'});
  const observationOwnershipControl={result:'PASS',actualProducerSuites:ownershipSuites,canonicalDetailedAssertionCount:canonicalIds.length,canonicalCheckIds:canonicalIds,ingestionReferenceCheckIds:ingestionReferenceChecks.map(row=>row.checkId),ingestionReferenceOmissionRejected:true,ingestionReferenceExactNormativeLinksPreserved:true,humanCandidateTargetObservationRequired:true,externalIdentityShapeObservationRequired:true,missingNativeHumanTargetOwnerRemainsUnknown:true,missingCurrentSuppliedInputCustodyOwnerRemainsUnknown:true,storageCatalogOmissionControls:true,storageCatalogFixtureIsExecutionEvidence:false,independentOwnerReportsRequired:true,canonicalOwnerMissingRemainsUnknown:true,exactCanonicalLinksPreserved:true,doubleOwnedDetailedAssertionRejected:true,foreignFailedDuplicateMalformedAssertionsRejected:true};
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
  const ownReport={executedEvidenceProtection:'PASS',ownershipReceiptRoutingControl,deferredCatalogConsumerControl,dueSchedulingControl,crossRunSchedulingControl,coldCheckoutCases,producerViolationsRejected:producerControls.every(row=>row.result==='DETECTED'),syntaxChecksDoNotClaimExecution:true,syntaxPopulationCases,collectorOwnOutputControl,governanceFingerprintControl,governanceFingerprintInputs:true,activeFixtureFingerprintControl,activeHelperFingerprintControl,activeFixtureFingerprintInputs:true,normativeRegistryLinkageControl,observationOwnershipControl,emptyUniverseRejected:true,controlledProducerPopulation:producerControls,actualConformingStage03AssertionsExecuted:true,missingEvidenceRemainsUnknown:true,verificationObservations:[{checkId:'evidence.real-producer-controls',boundary:'actual Node exit/preload -> receipt consumer',expected:'ALL_CONTROLS_REJECTED_FOR_NAMED_REASON',observed:producerControls,passed:true,requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt#49']},{checkId:'APPROVED-GOVERNANCE-SOURCE-BYTES',boundary:governanceFingerprintControl.boundary,expected:{actualGovernanceByteHashBound:true,changedBytesRejectActualReceipt:true,missingBytesFailHonestly:true,untrackedBytesBound:true,untrackedMutationRejectsActualReceipt:true,exactRestoreAdmitsActualReceipt:true,formerMarkdownOmissionReproduced:true},observed:{actualGovernanceByteHashBound:governanceSourceCases.every(row=>row.actualByteHashBound),changedBytesRejectActualReceipt:governanceSourceCases.every(row=>row.changedBytesRejectActualReceipt),missingBytesFailHonestly:governanceSourceCases.every(row=>row.missingBytesFailHonestly),untrackedBytesBound:governanceSourceCases.every(row=>row.untrackedBytesBound),untrackedMutationRejectsActualReceipt:governanceSourceCases.every(row=>row.untrackedMutationRejectsActualReceipt),exactRestoreAdmitsActualReceipt:governanceSourceCases.every(row=>row.exactRestoreAdmitsActualReceipt),formerMarkdownOmissionReproduced:true},passed:true,requirementRefs:[96]}]};
  const ownGovernanceCheck='receipts.approved-governance-input-observation';
  assert.equal(observationsFromReports('verify-executed-evidence.mjs',[ownReport]).find(row=>row.checkId===ownGovernanceCheck)?.passed,true,'GOVERNANCE_INPUT_OBSERVATION_ORACLE: actual owner population was not admitted.');
  for(const variant of ['omitted','wrong-value','missing-field','extra-field']){
    const incomplete=structuredClone(ownReport),detail=incomplete.verificationObservations.find(row=>row.checkId==='APPROVED-GOVERNANCE-SOURCE-BYTES');
    if(variant==='omitted')incomplete.verificationObservations=incomplete.verificationObservations.filter(row=>row!==detail);
    else if(variant==='wrong-value')detail.observed.changedBytesRejectActualReceipt=false;
    else if(variant==='missing-field')delete detail.observed.untrackedBytesBound;
    else detail.observed.unrelatedSuccess=true;
    assert.equal(observationsFromReports('verify-executed-evidence.mjs',[incomplete]).find(row=>row.checkId===ownGovernanceCheck)?.passed,false,'GOVERNANCE_INPUT_OBSERVATION_ORACLE: '+variant+' was silently admitted.');
    producerControls.push({caseId:'required-governance-observation-'+variant,accepted:false,result:'DETECTED'});
  }
  const ownFixtureCheck='receipts.active-fixture-inputs';
  assert.equal(observationsFromReports('verify-executed-evidence.mjs',[ownReport]).find(row=>row.checkId===ownFixtureCheck)?.passed,true,'FIXTURE_INPUT_OBSERVATION_ORACLE: actual current fixture-byte controls were not admitted.');
  for(const variant of ['wrong-value','missing-case','extra-case']){
    const incomplete=structuredClone(ownReport),control=incomplete.activeFixtureFingerprintControl;
    if(variant==='wrong-value')control.sourceCases[0].untrackedMutationRejectsActualReceipt=false;
    else if(variant==='missing-case')control.sourceCases=[];
    else control.sourceCases.push(structuredClone(control.sourceCases[0]));
    assert.equal(observationsFromReports('verify-executed-evidence.mjs',[incomplete]).find(row=>row.checkId===ownFixtureCheck)?.passed,false,'FIXTURE_INPUT_OBSERVATION_ORACLE: '+variant+' was silently admitted.');
    producerControls.push({caseId:'required-active-fixture-input-'+variant,accepted:false,result:'DETECTED'});
  }
  const noFixtureMarker=structuredClone(ownReport);delete noFixtureMarker.activeFixtureFingerprintInputs;
  assert.throws(()=>observationsFromReports('verify-executed-evidence.mjs',[noFixtureMarker]),/expected exactly one report marker activeFixtureFingerprintInputs/,'FIXTURE_INPUT_OBSERVATION_ORACLE: the required input owner marker disappeared.');
  console.log(JSON.stringify(ownReport));
}finally{fs.rmSync(directory,{recursive:true,force:true});}
