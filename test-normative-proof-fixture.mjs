// Historical generator/10 source-only singleton consumer fixture. Current
// producer/receipt/gate code runs against pinned historical inputs in disposable
// state; its review/device labels never establish current atomic release proof.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import assert from 'node:assert/strict';
import {readHistoricalNormativeFixtureInputs,readHistoricalNormativeProofSource} from './historical-normative-fixture-inputs.mjs';
import {verificationCatalog,browserVerificationCatalog} from './verification-evidence-catalog.mjs';
import {SPECIFICATION_PATH,sha,evidenceFingerprint,coverageDeclarationSha256,createExecutionReceipt,aggregateExecutedEvidence,readExecutedEvidence} from './verification-evidence.mjs';
export function createNormativeProofFixture(){
  const original=process.cwd(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-normative-proof-'));
  let retainFailedProducerFixture=false;
  const normativePath=SPECIFICATION_PATH.replace('closed-loop-reliability-controlling-implementation-specification.txt','closed-loop-normative-requirements.json'),bindingsPath='verification-assertion-bindings.json',reviewPath='verification/disposable-coverage-review.json',suite='verify-test-runtime-v3.mjs',checkId='test-ir.unknown-operation';
  const copy=relative=>{const target=path.join(directory,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(original,relative),target);};
  try{
    for(const name of fs.readdirSync(original))if(/\.(?:m?js|html|css|json)$/.test(name)&&name!=='TEST_PROJECT.json')copy(name);
    const historical=readHistoricalNormativeFixtureInputs(original),governance=JSON.parse(historical.get('proofGovernance'));
    // Reconstruct the exact 722382ed source-only inputs. Never strip current
    // atomic governance or copy its reviewed universe into a singleton fixture.
    assert.equal(governance.atomicExtraction,undefined,'NORMATIVE_PROOF_HISTORICAL_GOVERNANCE_ORACLE');
    assert.equal(governance.contextApplicabilityReview,undefined,'NORMATIVE_PROOF_HISTORICAL_CONTEXT_ORACLE');
    for(const file of [...new Set([...governance.approvedAmendments.flatMap(row=>[row.sourceReviewPath,row.approvedProposalPath]),...Object.values(governance.independentSourceReview).filter(value=>typeof value==='string'&&value.startsWith('verification/')),...[...Object.values(verificationCatalog),...Object.values(browserVerificationCatalog)].flatMap(row=>row.sourceInputs||[])])])copy(file);
    const historicalInputs=[
      [SPECIFICATION_PATH,'8b17763e915b9475898dad5d44e83a1c9552025c699ec28d24a3d12b9b0cf883'],
      ['verification/independent-source-review-20261014.json','e5821fbce9dc82ebf31cfde0767bb869c26c6ecd30c86fbd55d543eb8a94f429'],
      ['verification/independent-source-reconciliation-20261014.json','b3addac3e66cf726d842a675de83ad640f872e8da6ccc22510c6aac6b5352264'],
      ['verification/historical-source-relocation-crosswalk-20261014.json','922915515fdfee3a97642d943320daa68b3d5ba568cddebc7b13cc087572be1a']
    ];
    for(const [relative,digest] of historicalInputs){const bytes=relative===SPECIFICATION_PATH?readHistoricalNormativeProofSource(original):fs.readFileSync(path.join(original,relative));assert.equal(sha(bytes),digest,'NORMATIVE_PROOF_HISTORICAL_INPUT_ORACLE: '+relative);const target=path.join(directory,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}
    for(const [member,target] of [['proofManifest',normativePath],['proofSpecificationManifest','specification/closed-loop-specification-manifest.json'],['proofGovernance','specification/requirement-evidence-bindings.json']]){const file=path.join(directory,target);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,historical.get(member));}
    const normative=JSON.parse(fs.readFileSync(path.join(directory,normativePath),'utf8')),historicalId='NREQ-318da161cc5f30f33449238ba3870773';
    let requirement=normative.requirements.find(row=>row.normativeRequirementId===historicalId);
    if(!requirement){
      // Relocate only this deliberately synthetic singleton fixture through the
      // accepted byte/source crosswalk. No real declaration or proof is renewed.
      const relocation=JSON.parse(fs.readFileSync(path.join(directory,'verification/historical-source-relocation-crosswalk-20261014.json'),'utf8')),mapping=relocation.crosswalk.filter(row=>row.priorNormativeRequirementId===historicalId);
      assert.equal(relocation.targetSpecificationSha256,normative.specificationSha256,'NORMATIVE_PROOF_FIXTURE_RELOCATION_SOURCE_ORACLE');
      assert.equal(mapping.length,1,'NORMATIVE_PROOF_FIXTURE_RELOCATION_ID_ORACLE');
      const row=mapping[0];assert.equal(row.relation,'EXACT_SOURCE_LINE_RELOCATION');assert.equal(row.targetSourceTraceIds.length,1);assert.equal(row.priorControllingText,'- unknown operation is rejected;');
      requirement=normative.requirements.find(value=>value.normativeRequirementId===row.targetSourceTraceIds[0]);
      assert(requirement&&requirement.sourceLocation.startLine===row.targetSourceLine&&requirement.sourceLocation.lineSha256===row.targetRawLineSha256,'NORMATIVE_PROOF_FIXTURE_RELOCATION_ANCHOR_ORACLE');
    }
    assert(requirement&&requirement.controllingText==='- unknown operation is rejected;','NORMATIVE_PROOF_FIXTURE_SOURCE_ORACLE');
    assert.equal(requirement.requiredBrowserOrPhysicalDeviceProof.length,0);
    assert.equal(requirement.entryKind,undefined,'NORMATIVE_PROOF_HISTORICAL_SOURCE_ONLY_ORACLE');
    normative.requirements=[requirement];normative.fixtureBoundary='Historical 722382ed generator/10 source-only clause for disposable proof-consumer controls; not the current atomic normative universe.';
    fs.writeFileSync(path.join(directory,normativePath),JSON.stringify(normative,null,2)+'\n');
    const fullCoverage={schema:'closed-loop-full-requirement-coverage/1',sourceLineSha256:requirement.sourceLocation.lineSha256,schemaOrRegistryEntry:requirement.schemaOrRegistryEntry,productionOwners:[{path:'test-runtime.js',symbol:'validateSpec',sha256:sha(fs.readFileSync(path.join(directory,'test-runtime.js')))}],obligations:[{id:'unknown-operation-rejection',sourceText:requirement.controllingText,expectedBehavior:'An unregistered Test IR operation fails validation; registered operations retain their conforming controls.',checks:{deterministic:[{suite,checkId}],semantic:[],mutation:[]},nonapplicable:{semantic:'This bounded controlled vocabulary rule has no external semantic determination.',mutation:'This declaration covers the listed unknown-operation rejection case. Broader code-mutation coverage is outside this disposable single-clause consumer fixture.'},evidenceKinds:['EXECUTED_SYNTHETIC_PRODUCTION_ASSERTIONS']}],unresolvedObligations:[]};
    const review={schema:'closed-loop-requirement-coverage-review/1',normativeRequirementId:requirement.normativeRequirementId,sourceLineSha256:requirement.sourceLocation.lineSha256,specificationSha256:normative.specificationSha256,declarationSha256:coverageDeclarationSha256(fullCoverage),decision:'COMPLETE_COVERAGE',evidenceBasis:'EXTERNALLY_SUPPORTED',method:'DISPOSABLE independent-coverage-review input for a gate test, not a real reviewer or full-release proof.',author:{actor:'DISPOSABLE-AUTHOR',contextId:'DISPOSABLE-AUTHOR-CONTEXT'},reviewer:{actor:'DISPOSABLE-REVIEWER',contextId:'DISPOSABLE-REVIEWER-CONTEXT'},reviewedInputs:[{path:SPECIFICATION_PATH,sha256:normative.specificationSha256},{declarationSha256:coverageDeclarationSha256(fullCoverage)},{path:suite,sha256:sha(fs.readFileSync(path.join(directory,suite)))},{path:'verification-evidence-catalog.mjs',sha256:sha(fs.readFileSync(path.join(directory,'verification-evidence-catalog.mjs')))},...(verificationCatalog[suite].sourceInputs||[]).map(inputPath=>({path:inputPath,sha256:sha(fs.readFileSync(path.join(directory,inputPath)))})),...fullCoverage.productionOwners.map(owner=>({path:owner.path,sha256:owner.sha256}))],findings:[],reviewPerformed:true,syntheticFixture:true};
    fs.writeFileSync(path.join(directory,reviewPath),JSON.stringify(review,null,2)+'\n');fullCoverage.review={path:reviewPath,sha256:sha(fs.readFileSync(path.join(directory,reviewPath)))};
    const binding={normativeRequirementId:requirement.normativeRequirementId,sourceLineSha256:requirement.sourceLocation.lineSha256,checkIds:[checkId],scope:'Exact disposable single-clause unknown-operation rejection proof-consumer fixture.',basis:'EXECUTED_DETERMINISTIC_BOUNDARY',fullCoverage};
    fs.writeFileSync(path.join(directory,bindingsPath),JSON.stringify({schema:'closed-loop-verification-assertion-bindings/1',specificationSha256:normative.specificationSha256,bindings:[binding],contractRefs:[]},null,2)+'\n');
    cp.execFileSync('git',['init','--quiet'],{cwd:directory});cp.execFileSync('git',['add','.'],{cwd:directory});cp.execFileSync('git',['-c','user.name=Disposable proof fixture','-c','user.email=fixture@localhost','commit','--quiet','-m','Isolated normative proof consumer'],{cwd:directory});
    const fingerprint=evidenceFingerprint(directory);
    assert.equal(fingerprint.inputSha256['verification/normative-context-applicability-20261005.json'],undefined,'NORMATIVE_PROOF_HISTORICAL_CONTEXT_ISOLATION_ORACLE');
    const producerStartedAt=new Date().toISOString(),producerStarted=process.hrtime.bigint(),producerTimeoutMs=60000,producerMaxBuffer=16*1024*1024;
    const rawExecution=cp.spawnSync(process.execPath,[suite],{cwd:directory,timeout:producerTimeoutMs,maxBuffer:producerMaxBuffer,env:{...process.env,NODE_OPTIONS:''}});
    const producerDurationMs=Number(process.hrtime.bigint()-producerStarted)/1e6;
    const execution={...rawExecution,stdout:rawExecution.stdout?.toString('utf8')??'',stderr:rawExecution.stderr?.toString('utf8')??''};
    let producerFailureDiagnostics;
    if(execution.status!==0){
      // Preserve only failed synthetic executions, after the producer stopped.
      // Diagnostic files remain outside the fingerprinted fixture and never
      // become an execution receipt or a substitute for a successful producer.
      retainFailedProducerFixture=true;
      const diagnosticsDirectory=directory+'-producer-failure',stdoutPath=path.join(diagnosticsDirectory,'stdout.bin'),stderrPath=path.join(diagnosticsDirectory,'stderr.bin');
      producerFailureDiagnostics={schema:'closed-loop-normative-proof-producer-diagnostic/1',scope:'FAILED_SYNTHETIC_PRODUCER_DIAGNOSTIC',outcome:'FAIL',ordinaryExecutionReceipt:false,currentAtomicProof:false,fixtureDirectory:directory,diagnosticsDirectory,command:[process.execPath,suite],pid:execution.pid??null,status:execution.status??null,signal:execution.signal??null,error:execution.error?{name:execution.error.name,code:execution.error.code??null,message:execution.error.message,errno:execution.error.errno??null,syscall:execution.error.syscall??null}:null,timeoutMs:producerTimeoutMs,timedOut:execution.error?.code==='ETIMEDOUT',maxBufferBytes:producerMaxBuffer,startedAt:producerStartedAt,endedAt:new Date().toISOString(),durationMs:producerDurationMs,stdout:{path:stdoutPath,byteLength:rawExecution.stdout?.length??0},stderr:{path:stderrPath,byteLength:rawExecution.stderr?.length??0},sourceFingerprint:{sourceCommit:fingerprint.sourceCommit,sourceInputsSha256:fingerprint.sourceInputsSha256,specificationSha256:fingerprint.specificationSha256,path:path.join(diagnosticsDirectory,'source-fingerprint.json')}};
      try{
        fs.mkdirSync(diagnosticsDirectory);
        fs.writeFileSync(stdoutPath,rawExecution.stdout??Buffer.alloc(0));fs.writeFileSync(stderrPath,rawExecution.stderr??Buffer.alloc(0));
        fs.writeFileSync(producerFailureDiagnostics.sourceFingerprint.path,JSON.stringify(fingerprint,null,2)+'\n');
        fs.writeFileSync(path.join(diagnosticsDirectory,'terminal.json'),JSON.stringify(producerFailureDiagnostics,null,2)+'\n');
      }catch(error){producerFailureDiagnostics.diagnosticPreservationError={code:error.code??null,message:error.message};}
    }
    assert.equal(execution.status,0,'NORMATIVE_PROOF_ACTUAL_PRODUCER_ORACLE: '+execution.stderr+(producerFailureDiagnostics?'\n'+JSON.stringify(producerFailureDiagnostics):''));
    const receipt=createExecutionReceipt(suite,{command:[process.execPath,suite],exitCode:execution.status,outcome:'PASS',stdout:execution.stdout,stderr:execution.stderr,signal:execution.signal},{cwd:directory,fingerprint});
    const withScope=callback=>{const before=process.cwd();process.chdir(directory);try{return callback();}finally{process.chdir(before);}};
    const receipts=new Map([[suite,receipt]]),aggregate=withScope(()=>aggregateExecutedEvidence(receipts,fingerprint));
    const proofs=path.join(directory,'receipts');fs.mkdirSync(proofs);fs.writeFileSync(path.join(proofs,suite+'.json'),JSON.stringify(receipt));
    const evidencePath=path.join(proofs,'evidence.json');fs.writeFileSync(evidencePath,JSON.stringify({...aggregate,evidenceSha256:sha(aggregate)}));
    const evidence=withScope(()=>readExecutedEvidence(evidencePath,fingerprint));
    assert.equal(evidence.fullRequirementProofs.requirements[0].disposition,'CONFORMANT_PROVEN','NORMATIVE_PROOF_VALID_PROGRESS_ORACLE');
    const observations=new Map(receipt.observations.map(row=>[row.checkId,{...row,suite,receiptSha256:receipt.receiptSha256}]));
    return {directory,sourceUniverse:'HISTORICAL_SOURCE_TRACE_722382ED',currentAtomicProof:false,requirement,binding,review,reviewPath,fingerprint,receipt,receipts,evidence,evidencePath,observations,withScope,dispose:()=>fs.rmSync(directory,{recursive:true,force:true})};
  }catch(error){if(!retainFailedProducerFixture)fs.rmSync(directory,{recursive:true,force:true});throw error;}
}
