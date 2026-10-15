// Source-context consumer controls; no implementation conformance is asserted.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readHistoricalNormativeFixtureInputs} from './historical-normative-fixture-inputs.mjs';
import {reviewedContextApplicability,evidenceFingerprint,sha,SPECIFICATION_PATH} from './verification-evidence.mjs';
// The retained 67-row controls belong to the exact historical source universe.
// The current atomic universe is validated separately below, without a reduced
// manifest, rewritten governance or manufactured execution receipt.
const historicalInputs=[
 ["verification/atomic-extraction-20261014/archival/historical-controlling-source-7df5f46e.txt","specification/closed-loop-reliability-controlling-implementation-specification.txt","95a6a8b1f8857b35c47cb44874aee2bbada1ccfd2ee7aa9033d92fb39c8bda9d"],
 ["verification/atomic-extraction-20261014/archival/historical-normative-manifest-7df5f46e.json","specification/closed-loop-normative-requirements.json","97b43f690b60219d67f498459439bce30416650b9f26c46c34a89b972a13929f"],
 ["verification/normative-context-applicability-20261005.json","verification/normative-context-applicability-20261005.json","7cd05ff0028578a1ca1c2560533519a602ce6a974c240ee11dbbd272524cf656"],
 ["verification/independent-source-review-20261005.json","verification/independent-source-review-20261005.json","7e08fd37e0885c3de089d1939ea25515a1bc933dc45aa7997e8062d68ac845bb"],
 ["verification/independent-source-reconciliation-20261005.json","verification/independent-source-reconciliation-20261005.json","b2b22f137623d5916a025d12575152a36b2b8b20daa8100db5c420e4d90f87a8"],
 ["verification/normative-context-legacy-governance-7df5f46e.json","specification/requirement-evidence-bindings.json","9c4631c86ccd2d8234f23469ffc7e11374bcda51eb4bb1f27c1f4a97ade7b72e"],
 ];
function verifyHistoricalNormativeContextApplicability(){
 const cwd=process.cwd(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'normative-context-')),file='verification/normative-context-applicability-20261005.json',inputSha256={};
 try{
  const historicalBytes=readHistoricalNormativeFixtureInputs(cwd),capsuleInputs=new Map([[historicalInputs[0][0],historicalBytes.get('contextSource')],[historicalInputs[1][0],historicalBytes.get('contextManifest')],[historicalInputs[2][0],historicalBytes.get('contextApplicabilityReview')]]);
  for(const [source,target,digest] of historicalInputs){
   const bytes=capsuleInputs.get(source)||fs.readFileSync(source);assert.equal(sha(bytes),digest,'HISTORICAL_CONTEXT_INPUT_IDENTITY_ORACLE: '+source);
   const destination=path.join(directory,target);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes);inputSha256[target]=digest;
  }
  const source=JSON.parse(fs.readFileSync(path.join(directory,file))),normative=JSON.parse(fs.readFileSync(path.join(directory,'specification/closed-loop-normative-requirements.json'))),governance=JSON.parse(fs.readFileSync(path.join(directory,'specification/requirement-evidence-bindings.json')));
  assert.equal(normative.requirements.length,4066,'HISTORICAL_CONTEXT_SOURCE_UNIVERSE_ORACLE');
  // Only the fields read by the context helper are supplied. This synthetic
  // historical input identity never becomes a current execution fingerprint.
  const fingerprint={specificationSha256:inputSha256[SPECIFICATION_PATH],inputSha256};
 const cases=[];
 const run=(review=source,manifest=normative)=>{fs.writeFileSync(file,JSON.stringify(review));const declared={...governance,contextApplicabilityReview:{path:file,sha256:sha(fs.readFileSync(file))}};fs.writeFileSync('specification/requirement-evidence-bindings.json',JSON.stringify(declared));return reviewedContextApplicability(manifest,{...fingerprint,inputSha256:{...fingerprint.inputSha256,[file]:sha(fs.readFileSync(file)),'specification/requirement-evidence-bindings.json':sha(fs.readFileSync('specification/requirement-evidence-bindings.json'))}});};
 process.chdir(directory);const control=run();assert.equal(control.size,67);assert.equal([...control.values()].filter(row=>row.existingReconciledClassification==='STRUCTURAL_REQUIREMENT_CONTEXT').length,58);assert.equal([...control.values()].filter(row=>row.existingReconciledClassification==='HISTORICAL_SOURCE_CONTEXT').length,9);
 for(const [name,change]of [
  ['missing-reviewed-row',r=>r.rows.pop()],['missing-governing-membership',r=>r.rows[0].governingNormativeRequirementIds.splice(1)],['wrong-governing-range',r=>r.rows[0].governingSourceRanges=[[9999,9999]]],['overlapping-governing-range',r=>r.rows[0].governingSourceRanges.push(r.rows[0].governingSourceRanges[0])],['extra-governing-hash',r=>r.rows[0].governingSourceLineHashes['9999']='0'.repeat(64)],['missing-governing-hash',r=>delete r.rows[0].governingSourceLineHashes['124']],['duplicate-reviewed-row',r=>r.rows[1]=r.rows[0]],['stale-source',r=>r.source.sha256='0'.repeat(64)],['unknown-governing-row',r=>r.rows[0].governingNormativeRequirementIds[0]='UNKNOWN'],['self-link',r=>r.rows[0].governingNormativeRequirementIds[0]=r.rows[0].normativeRequirementId],['stale-governing-source',r=>r.rows[0].governingSourceLineHashes['124']='0'.repeat(64)],['behavioral-proof-inflation',r=>r.rows[0].reviewedDisposition='CONFORMANT_PROVEN'],['missing-exclusion-reason',r=>r.rows[0].exclusionReason=''],['independent-review-unresolved',r=>r.unresolved=['pending']],['imperative-excluded',r=>{const requirement=normative.requirements.find(row=>row.sourceLocation.startLine===626);r.rows[0]={...r.rows[0],normativeRequirementId:requirement.normativeRequirementId,sourceLocation:requirement.sourceLocation,controllingText:requirement.controllingText};}]
 ]){const changed=structuredClone(source);change(changed);assert.throws(()=>run(changed),/EXECUTED_EVIDENCE_ORACLE/,'CONTEXT_APPLICABILITY_ORACLE: '+name);assert.equal(run().size,67);cases.push({name,rejected:true,recovery:true});}
 for(const line of [626,4844,5727,5760]){const row=normative.requirements.find(row=>row.sourceLocation.startLine===line);assert(row&&!control.has(row.normativeRequirementId),'MANDATORY_DESCENDANT_REMAINS_IN_PROOF_UNIVERSE: '+line);}
 const changed=structuredClone(source);changed.rows[0].exclusionReason+=' CHANGED';fs.writeFileSync(file,JSON.stringify(changed));assert.throws(()=>reviewedContextApplicability(normative,{...fingerprint,inputSha256:{...fingerprint.inputSha256,[file]:sha(fs.readFileSync(file)),'specification/requirement-evidence-bindings.json':sha(fs.readFileSync('specification/requirement-evidence-bindings.json'))}}),/retained governance declaration/,'CONTEXT_DECLARATION_DIGEST_ORACLE');assert.equal(run().size,67);cases.push({name:'changed-review-without-governance-binding',rejected:true,recovery:true});
 return {schema:'closed-loop-context-applicability-consumer-verification/1',sourceUniverse:'HISTORICAL_7DF5F46E',specificationSha256:fingerprint.specificationSha256,manifestSha256:inputSha256['specification/closed-loop-normative-requirements.json'],passed:true,retainedSourceIds:normative.requirements.length,contextRows:67,mandatoryNoncontextRows:normative.requirements.length-67,cases,syntheticConsumerControls:true,implementationConformanceEstablished:false};
 }finally{process.chdir(cwd);fs.rmSync(directory,{recursive:true,force:true});}
}

function verifyCurrentAtomicContextApplicability(){
 const normative=JSON.parse(fs.readFileSync('specification/closed-loop-normative-requirements.json')),fingerprint=evidenceFingerprint(),governance=JSON.parse(fs.readFileSync('specification/requirement-evidence-bindings.json'));
 const contextRows=normative.requirements.filter(row=>row.entryKind==='SOURCE_CONTEXT'),atomicRows=normative.requirements.filter(row=>row.entryKind==='ATOMIC_OBLIGATION');
 const contextIds=contextRows.map(row=>row.normativeRequirementId),atomicIds=atomicRows.map(row=>row.normativeRequirementId);
 assert.equal(normative.requirements.length,7486,'CURRENT_CONTEXT_RETAINED_SOURCE_UNIVERSE_ORACLE');
 assert.equal(new Set([...contextIds,...atomicIds]).size,7486,'CURRENT_CONTEXT_STABLE_ID_UNIVERSE_ORACLE');
 assert.equal(contextRows.length,291,'CURRENT_CONTEXT_COUNT_ORACLE');assert.equal(atomicRows.length,7195,'CURRENT_ATOMIC_COUNT_ORACLE');
 assert.equal(contextRows.filter(row=>row.contextClassification.classification==='STRUCTURAL_REQUIREMENT_CONTEXT').length,282);
 assert.equal(contextRows.filter(row=>row.contextClassification.classification==='HISTORICAL_NONNORMATIVE_CONTEXT').length,9);
 const run=(manifest=normative,identity=fingerprint)=>reviewedContextApplicability(manifest,identity);
 const restored=()=>{
  const contexts=run();assert.deepEqual([...contexts.keys()],contextIds,'CURRENT_CONTEXT_EXACT_IDS_ORACLE');
  for(const row of contextRows){
   const reviewed=contexts.get(row.normativeRequirementId),classification=row.contextClassification;
   assert.deepEqual(reviewed.sourceLocation,row.sourceLocation,'CURRENT_CONTEXT_EXACT_ANCHOR_ORACLE');
   assert.equal(reviewed.controllingText,row.controllingText,'CURRENT_CONTEXT_EXACT_TEXT_ORACLE');
   assert.equal(reviewed.existingReconciledClassification,classification.classification,'CURRENT_CONTEXT_EXACT_CLASSIFICATION_ORACLE');
   assert.deepEqual(reviewed.governingNormativeRequirementIds,classification.governingNormativeRequirementIds,'CURRENT_CONTEXT_EXACT_GOVERNORS_ORACLE');
   assert.equal(reviewed.reviewedDisposition,classification.classification==='STRUCTURAL_REQUIREMENT_CONTEXT'?'CONTEXT_GOVERNED_BY_LINKED_CLAUSES':'HISTORICAL_CONTEXT_NOT_CURRENT_OBLIGATION','CURRENT_CONTEXT_EXACT_DISPOSITION_ORACLE');
  }
  assert.deepEqual(normative.requirements.filter(row=>!contexts.has(row.normativeRequirementId)).map(row=>row.normativeRequirementId),atomicIds,'CURRENT_ATOMIC_IDS_REMAIN_MANDATORY_ORACLE');
 };
 restored();
 const context=contextRows.find(row=>row.contextClassification.classification==='STRUCTURAL_REQUIREMENT_CONTEXT'&&row.contextClassification.governingNormativeRequirementIds.length);
 assert(context,'CURRENT_CONTEXT_GOVERNOR_CONTROL_ORACLE');
 const changeContext=change=>({...normative,requirements:normative.requirements.map(row=>row===context?{...row,contextClassification:{...row.contextClassification,...change}}:row)}),atomicPath=governance.atomicExtraction.draft.path,cases=[];
 assert.equal(fingerprint.inputSha256[atomicPath],governance.atomicExtraction.draft.sha256,'CURRENT_CONTEXT_ATOMIC_FINGERPRINT_CONTROL_ORACLE');
 // All mutations are shallow and in memory. Each refusal and recovery passes
 // through the unchanged owner, including its full reviewed atomic evidence.
 for(const [name,changed,expected] of [
  ['missing-current-context-row',()=>[{...normative,requirements:normative.requirements.filter(row=>row!==context)},fingerprint],/EXECUTED_EVIDENCE_ORACLE: atomic context universe differs from reviewed entries/],
  ['altered-current-governing-link',()=>[changeContext({governingNormativeRequirementIds:['NREQ-UNKNOWN',...context.contextClassification.governingNormativeRequirementIds.slice(1)]}),fingerprint],/EXECUTED_EVIDENCE_ORACLE: atomic context universe differs from reviewed entries/],
  ['altered-current-context-classification',()=>[changeContext({classification:'HISTORICAL_NONNORMATIVE_CONTEXT'}),fingerprint],/EXECUTED_EVIDENCE_ORACLE: atomic context universe differs from reviewed entries/],
  ['stale-current-atomic-evidence-fingerprint',()=>[normative,{...fingerprint,inputSha256:{...fingerprint.inputSha256,[atomicPath]:'0'.repeat(64)}}],/EXECUTED_EVIDENCE_ORACLE: atomic context evidence fingerprint mismatch/]
 ]){assert.throws(()=>run(...changed()),expected,'CURRENT_CONTEXT_APPLICABILITY_ORACLE: '+name);restored();cases.push({name,rejected:true,recovery:true});}
 return {passed:true,sourceUniverse:'CURRENT_REVIEWED_ATOMIC',specificationSha256:fingerprint.specificationSha256,retainedSourceIds:normative.requirements.length,contextRows:contextIds.length,structuralContextRows:282,historicalContextRows:9,mandatoryAtomicRows:atomicIds.length,contextRequirementIds:contextIds,mandatoryAtomicRequirementIds:atomicIds,cases,syntheticConsumerControls:true,implementationConformanceEstablished:false};
}
export function verifyNormativeContextApplicability(){
 // The historical object graph and temporary files leave scope before the
 // resource-sensitive current atomic evidence is loaded. Neither result is
 // an implementation conformance claim or a reusable execution receipt.
 const historicalFixture=verifyHistoricalNormativeContextApplicability();
 const currentAtomic=verifyCurrentAtomicContextApplicability();
 return {schema:'closed-loop-context-applicability-consumer-verification/2',passed:true,historicalFixture,currentAtomic,syntheticConsumerControls:true,implementationConformanceEstablished:false};
}
