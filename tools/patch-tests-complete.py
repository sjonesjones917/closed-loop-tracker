from pathlib import Path
P=Path('verify-complete.mjs'); s=P.read_text()
if 'stage22ProductHandoff:true' not in s:
 s+=r'''

// reliability-hardening-final: Stage 22 exact product handoff, epistemic evidence, and release contradictions.
{
 const p=project('JOB-STAGE22-PRODUCT-HANDOFF');p.job.CURRENT_PRODUCT_ID='PRODUCT-HANDOFF';const scope={...engine.currentScope(p),productId:'PRODUCT-HANDOFF'};
 const productRecord=record('products',21,{PRODUCT_ID:'PRODUCT-HANDOFF',PRODUCT_VERSION:'PRODUCT-v001',BASELINE_ID:'BASELINE-HANDOFF',EXECUTION_ID:'EXEC-HANDOFF',PRODUCTION_CONTEXT_ID:'CTX-HANDOFF',INSTRUCTION_VERSION:'INSTRUCTION-v001',GENERATED_ARTIFACT_INVENTORY:['ARTIFACT-HANDOFF'],STATUS:'COMPLETED'},'PRODUCT-HANDOFF');productRecord.scope=scope;p.projectData.products.push(productRecord);
 const artifactRecord=record('artifacts',21,{FILENAME:'finished-product.bin',TYPE:'application/octet-stream',VERSION:'v1',BYTE_SIZE:4,SHA256:'a'.repeat(64),ROLE:'FINISHED_PRODUCT',STORAGE_REFERENCE:'indexeddb:ARTIFACT-HANDOFF',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},'ARTIFACT-HANDOFF');artifactRecord.scope=scope;p.projectData.artifacts.push(artifactRecord);
 const handoff=engine.executionHandoff(p,{stage:22,operation:'COMPLETE'});assert(handoff.send.some(x=>x.artifactId==='ARTIFACT-HANDOFF'&&x.filename==='finished-product.bin'),'Stage 22 handoff omitted exact current finished-product bytes.');
}
{
 const p=project('JOB-EPISTEMIC-EFFECTIVE'),scope=engine.currentScope(p),req=record('requirements',4,{OBLIGATION:'Meaning must be established.',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'},'REQ-EPISTEMIC'),test=record('tests',6,{REQ_ID:'REQ-EPISTEMIC',TEST_TYPE:'MEANING',EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',REQUIRED_CAPABILITY:'semantic review',ARTIFACT_REQUIREMENTS:'NONE',INPUTS:'product',TOOLS:'independent reviewer',PROCEDURE:'compare meaning',EXPECTED_RESULT:'SATISFIED',FAILURE_CONDITION:'meaning differs',EVIDENCE_TO_PRESERVE:'meaning comparison',STATUS:'READY'},'TEST-EPISTEMIC'),evidence=record('evidenceRecords',23,{KIND:'REVIEW_NOTE',DESCRIPTION:'generic note',AUTHORITY_TYPE:'INDEPENDENT_REVIEWER',LOCATION:'review',CONTENT:'review performed',STATUS:'PRESERVED'},'EVIDENCE-EPISTEMIC'),result=record('meaningResults',23,{REQ_ID:'REQ-EPISTEMIC',TEST_ID:'TEST-EPISTEMIC',PRODUCT_LOCATION:'',EXTERNAL_SOURCE_EVIDENCE:'',REQUIRED_MEANING:'required meaning',OBSERVED_MEANING:'required meaning',EVIDENCE_BASED_COMPARISON:'SATISFIED',DETERMINATION:'SATISFIED'},'MEAN-EPISTEMIC');req.scope=scope;test.scope=scope;evidence.scope=scope;result.scope=scope;result.evidenceRefs=['EVIDENCE-EPISTEMIC'];p.projectData.requirements.push(req);p.projectData.tests.push(test);p.projectData.evidenceRecords.push(evidence);p.projectData.meaningResults.push(result);const effective=engine.evaluateResultConsistency('meaningResults',result,test,p);assert(effective.determination==='UNDETERMINED'&&effective.reasons.some(x=>x.includes('PRODUCT_LOCATION')),'A structurally present but epistemically insufficient meaning result remained effectively satisfied.');
}
{
 const p=project('JOB-RELEASE-CONTRADICTIONS'),scope=engine.currentScope(p),release=record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-CONFLICT');release.scope=scope;p.projectData.releaseRecords.push(release);const blocker=record('blockers',27,{MISSING_ITEM_TYPE:'EVIDENCE',MISSING_FACT_INPUT_AUTHORITY_EVIDENCE_CAPABILITY_DECISION_RULE:'missing proof',WHY_WORK_CANNOT_CONTINUE:'release proof missing',ATTEMPTED_RESOLUTIONS:'none',DOWNSTREAM_WORK_STOPPED:'STAGE 27',STATUS:'OPEN'},'BLOCKER-CONFLICT');blocker.scope=scope;p.projectData.blockers.push(blocker);assert(engine.detectCurrentContradictions(p).some(x=>x.type==='ACCEPTED_RELEASE_WITH_BLOCKER'),'Accepted release plus current blocker was not surfaced as a contradiction.');p.projectData.blockers.length=0;p.release.authorization='AUTHORIZED';p.release.authorizedArtifactIds=['ARTIFACT-STALE'];assert(engine.detectCurrentContradictions(p).some(x=>x.type==='STALE_DELIVERY_AUTHORIZATION'),'Stale delivery authorization was not surfaced as a contradiction.');
}
console.log(JSON.stringify({stage22ProductHandoff:true,epistemicEffectiveEvidence:true,releaseContradictions:true},null,2));
'''
P.write_text(s)
print('verify-complete regressions staged')
