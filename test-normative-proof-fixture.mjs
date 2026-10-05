// Isolated repository-evidence consumer fixture. Its one-entry universe and
// review/device labels are test inputs, never a claim about the real release.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import assert from 'node:assert/strict';
import {verificationCatalog} from './verification-evidence-catalog.mjs';
import {SPECIFICATION_PATH,sha,evidenceFingerprint,coverageDeclarationSha256,createExecutionReceipt,aggregateExecutedEvidence,readExecutedEvidence} from './verification-evidence.mjs';
export function createNormativeProofFixture(){
  const original=process.cwd(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-normative-proof-'));
  const normativePath=SPECIFICATION_PATH.replace('closed-loop-reliability-controlling-implementation-specification.txt','closed-loop-normative-requirements.json'),bindingsPath='verification-assertion-bindings.json',reviewPath='verification/disposable-coverage-review.json',suite='verify-test-runtime-v3.mjs',checkId='test-ir.unknown-operation';
  const copy=relative=>{const target=path.join(directory,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(original,relative),target);};
  try{
    for(const name of fs.readdirSync(original))if(/\.(?:m?js|html|css|json)$/.test(name)&&name!=='TEST_PROJECT.json')copy(name);
    const governance=JSON.parse(fs.readFileSync('specification/requirement-evidence-bindings.json','utf8'));
    for(const file of [...new Set([SPECIFICATION_PATH,normativePath,'specification/requirement-evidence-bindings.json',...governance.approvedAmendments.flatMap(row=>[row.sourceReviewPath,row.approvedProposalPath]),...Object.values(governance.independentSourceReview).filter(value=>typeof value==='string'&&value.startsWith('verification/')),...Object.values(verificationCatalog).flatMap(row=>row.sourceInputs||[])])])copy(file);
    // This intentionally one-row consumer universe excludes the real67-row
    // context classification; it cannot claim real-manifest completeness.
    const isolatedGovernance={...governance};delete isolatedGovernance.contextApplicabilityReview;fs.writeFileSync(path.join(directory,'specification/requirement-evidence-bindings.json'),JSON.stringify(isolatedGovernance,null,2)+'\n');
    const normative=JSON.parse(fs.readFileSync(path.join(directory,normativePath),'utf8')),requirement=normative.requirements.find(row=>row.normativeRequirementId==='NREQ-318da161cc5f30f33449238ba3870773');
    assert(requirement&&requirement.controllingText==='- unknown operation is rejected;','NORMATIVE_PROOF_FIXTURE_SOURCE_ORACLE');
    assert.equal(requirement.requiredBrowserOrPhysicalDeviceProof.length,0);
    normative.requirements=[requirement];normative.fixtureBoundary='One independently selected source clause for proof-consumer controls; not the actual full normative universe.';
    fs.writeFileSync(path.join(directory,normativePath),JSON.stringify(normative,null,2)+'\n');
    const fullCoverage={schema:'closed-loop-full-requirement-coverage/1',sourceLineSha256:requirement.sourceLocation.lineSha256,schemaOrRegistryEntry:requirement.schemaOrRegistryEntry,productionOwners:[{path:'test-runtime.js',symbol:'validateSpec',sha256:sha(fs.readFileSync(path.join(directory,'test-runtime.js')))}],obligations:[{id:'unknown-operation-rejection',sourceText:requirement.controllingText,expectedBehavior:'An unregistered Test IR operation fails validation; registered operations retain their conforming controls.',checks:{deterministic:[{suite,checkId}],semantic:[],mutation:[]},nonapplicable:{semantic:'This bounded controlled vocabulary rule has no external semantic determination.',mutation:'This declaration covers the listed unknown-operation rejection case. Broader code-mutation coverage is outside this disposable single-clause consumer fixture.'},evidenceKinds:['EXECUTED_SYNTHETIC_PRODUCTION_ASSERTIONS']}],unresolvedObligations:[]};
    const review={schema:'closed-loop-requirement-coverage-review/1',normativeRequirementId:requirement.normativeRequirementId,sourceLineSha256:requirement.sourceLocation.lineSha256,specificationSha256:normative.specificationSha256,declarationSha256:coverageDeclarationSha256(fullCoverage),decision:'COMPLETE_COVERAGE',evidenceBasis:'EXTERNALLY_SUPPORTED',method:'DISPOSABLE independent-coverage-review input for a gate test, not a real reviewer or full-release proof.',author:{actor:'DISPOSABLE-AUTHOR',contextId:'DISPOSABLE-AUTHOR-CONTEXT'},reviewer:{actor:'DISPOSABLE-REVIEWER',contextId:'DISPOSABLE-REVIEWER-CONTEXT'},reviewedInputs:[{path:SPECIFICATION_PATH,sha256:normative.specificationSha256},{declarationSha256:coverageDeclarationSha256(fullCoverage)},{path:suite,sha256:sha(fs.readFileSync(path.join(directory,suite)))},{path:'verification-evidence-catalog.mjs',sha256:sha(fs.readFileSync(path.join(directory,'verification-evidence-catalog.mjs')))},...(verificationCatalog[suite].sourceInputs||[]).map(inputPath=>({path:inputPath,sha256:sha(fs.readFileSync(path.join(directory,inputPath)))})),...fullCoverage.productionOwners.map(owner=>({path:owner.path,sha256:owner.sha256}))],findings:[],reviewPerformed:true,syntheticFixture:true};
    fs.writeFileSync(path.join(directory,reviewPath),JSON.stringify(review,null,2)+'\n');fullCoverage.review={path:reviewPath,sha256:sha(fs.readFileSync(path.join(directory,reviewPath)))};
    const binding={normativeRequirementId:requirement.normativeRequirementId,sourceLineSha256:requirement.sourceLocation.lineSha256,checkIds:[checkId],scope:'Exact disposable single-clause unknown-operation rejection proof-consumer fixture.',basis:'EXECUTED_DETERMINISTIC_BOUNDARY',fullCoverage};
    fs.writeFileSync(path.join(directory,bindingsPath),JSON.stringify({schema:'closed-loop-verification-assertion-bindings/1',specificationSha256:normative.specificationSha256,bindings:[binding],contractRefs:[]},null,2)+'\n');
    cp.execFileSync('git',['init','--quiet'],{cwd:directory});cp.execFileSync('git',['add','.'],{cwd:directory});cp.execFileSync('git',['-c','user.name=Disposable proof fixture','-c','user.email=fixture@localhost','commit','--quiet','-m','Isolated normative proof consumer'],{cwd:directory});
    const fingerprint=evidenceFingerprint(directory),execution=cp.spawnSync(process.execPath,[suite],{cwd:directory,encoding:'utf8',timeout:60000,maxBuffer:16*1024*1024,env:{...process.env,NODE_OPTIONS:''}});
    assert.equal(execution.status,0,'NORMATIVE_PROOF_ACTUAL_PRODUCER_ORACLE: '+execution.stderr);
    const receipt=createExecutionReceipt(suite,{command:[process.execPath,suite],exitCode:execution.status,outcome:'PASS',stdout:execution.stdout,stderr:execution.stderr,signal:execution.signal},{cwd:directory,fingerprint});
    const withScope=callback=>{const before=process.cwd();process.chdir(directory);try{return callback();}finally{process.chdir(before);}};
    const receipts=new Map([[suite,receipt]]),aggregate=withScope(()=>aggregateExecutedEvidence(receipts,fingerprint));
    const proofs=path.join(directory,'receipts');fs.mkdirSync(proofs);fs.writeFileSync(path.join(proofs,suite+'.json'),JSON.stringify(receipt));
    const evidencePath=path.join(proofs,'evidence.json');fs.writeFileSync(evidencePath,JSON.stringify({...aggregate,evidenceSha256:sha(aggregate)}));
    const evidence=withScope(()=>readExecutedEvidence(evidencePath,fingerprint));
    assert.equal(evidence.fullRequirementProofs.requirements[0].disposition,'CONFORMANT_PROVEN','NORMATIVE_PROOF_VALID_PROGRESS_ORACLE');
    const observations=new Map(receipt.observations.map(row=>[row.checkId,{...row,suite,receiptSha256:receipt.receiptSha256}]));
    return {directory,requirement,binding,review,reviewPath,fingerprint,receipt,receipts,evidence,evidencePath,observations,withScope,dispose:()=>fs.rmSync(directory,{recursive:true,force:true})};
  }catch(error){fs.rmSync(directory,{recursive:true,force:true});throw error;}
}
