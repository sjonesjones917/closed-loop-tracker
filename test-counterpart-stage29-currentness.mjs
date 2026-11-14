import assert from 'node:assert/strict';

// Run on the actual completed chain, retaining its native execution and receipt
// bytes. Every adverse case is a disposable copy; no proof is manufactured.
export function verifyStage29CurrentnessControls(engine,project){
 const copy=()=>JSON.parse(JSON.stringify(project));
 const native=p=>p.projectData.deterministicResults.find(row=>row.source==='APPLICATION_TEST_RUNTIME');
 const chain=p=>engine.recordsForCurrentScope(p,'evidenceChains')[0];
 const result=native(project),before=JSON.stringify(project);
 assert(result,'Stage 29 controls require the actual native result.');
 assert.equal(result.fields.APPLICATION_DETERMINATION,'SATISFIED');
 assert.equal(Object.hasOwn(result.fields,'DETERMINATION'),false);
 assert.equal(engine.currentEvidenceChainSet(project).complete,true);
 const gate=engine.gate(29,project);
 assert.equal(gate.complete,true,'STAGE29_CANONICAL_CURRENTNESS_ORACLE: '+JSON.stringify(gate.reasons));
 assert.equal(JSON.stringify(project),before,'Stage 29 evaluation must preserve canonical bytes.');
 const mutations=[
  ['projected-determination',p=>{native(p).fields.DETERMINATION='SATISFIED';}],
  ['missing-chain',p=>{p.projectData.evidenceChains=[];}],
  ['missing-receipt',p=>{delete chain(p).derivationReceipt;}],
  ['modified-receipt-output',p=>{chain(p).derivationReceipt.outputSha256='0'.repeat(64);}],
  ['stale-receipt-input',p=>{chain(p).derivationReceipt.canonicalInputSha256='0'.repeat(64);}],
  ['modified-receipt-source',p=>{chain(p).derivationReceipt.sourceRecordHashes[0].sha256='0'.repeat(64);}],
  ['altered-derivation-input',p=>{chain(p).derivationInput.selection.requirementId='ALTERED';}],
  ['altered-result',p=>{native(p).fields.APPLICATION_DETERMINATION='VIOLATED';}],
  ['missing-required-result',p=>{p.projectData.deterministicResults=[];}],
  ['missing-evidence',p=>{p.projectData.evidenceRecords=[];}],
  ['altered-native-identity',p=>{const row=native(p),evidence=p.projectData.evidenceRecords.find(item=>row.evidenceRefs.includes(item.id)),payload=JSON.parse(engine.recordValue(evidence,'APPLICATION_EVIDENCE_CONTENT'));assert(payload.nativeExecutionIdentity.runtimeBuildIdentity);payload.nativeExecutionIdentity.runtimeBuildIdentity='ALTERED';evidence.fields.APPLICATION_EVIDENCE_CONTENT=JSON.stringify(payload);}],
  ['altered-test-input',p=>{const row=native(p),test=p.projectData.tests.find(item=>item.id===engine.recordValue(row,'TEST_ID'));assert(test);test.fields.EXECUTABLE_SPEC_SHA256='0'.repeat(64);}],
  ['altered-set-version',p=>{p.job.CURRENT_EVIDENCE_CHAIN_VERSION='EVIDENCE-CHAIN-ALTERED';}]
 ];
 const refused=[];
 for(const [name,mutate]of mutations){
  const candidate=copy();mutate(candidate);
  assert.equal(engine.currentEvidenceChainSet(candidate).complete,false,name+' must invalidate the chain set.');
  const rejected=engine.gate(29,candidate);
  assert.equal(rejected.complete,false,name+' must block Stage 29.');
  assert(rejected.reasons.length,name+' must explain the refusal.');
  refused.push(name);
 }
 assert.equal(JSON.stringify(project),before,'Negative controls must preserve the original project.');
 return {caseId:'stage29-canonical-native-currentness',stage:29,result:'PASS',canonicalBytesPreserved:true,refused};
}
