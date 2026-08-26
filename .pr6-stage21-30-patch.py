from pathlib import Path

def replace(path,old,new,count=1):
    p=Path(path);s=p.read_text();assert old in s,f'missing target in {path}';p.write_text(s.replace(old,new,count))

# A production fresh context is intentionally not a run slot; sentinel RUN_ID values are available for product execution.
replace('workflow-engine.js',"const contexts=recordsForCurrentScope(project,'freshContexts').filter(r=>!recordValue(r,'RUN_ID')),context=contexts.at(-1);","const contexts=recordsForCurrentScope(project,'freshContexts').filter(r=>!recordValue(r,'RUN_ID')||['NONE','NOT APPLICABLE','UNASSIGNED','PENDING'].includes(upper(recordValue(r,'RUN_ID')))),context=contexts.at(-1);")

p=Path('verify-full-cycle.mjs');s=p.read_text();marker="const result={continuousLifecycle:'STAGES_01_TO_20'"
assert marker in s
block=r"""// Stage 21: fresh production context, application-reserved product identity, and exact output bytes.
const productionContext=engine.registerFreshContext(p,{stage:21,externalContextIdentifier:'EXTERNAL-PRODUCTION-CONTEXT-21',operatorLabel:'FULL_CYCLE_OPERATOR'});
const product=engine.reserveProductExecution(p,{operatorLabel:'FULL_CYCLE_OPERATOR'}),productId=engine.recordId(product,'products');
const productBytesA=new TextEncoder().encode('{"delivery":"A","verified":true}'),productShaA=await hash.sha256Bytes(productBytesA);
const productBytesB=new TextEncoder().encode('{"delivery":"B","verified":true}'),productShaB=await hash.sha256Bytes(productBytesB);
engine.registerArtifactBytes(p,{stage:21,artifactId:'ARTIFACT-PRODUCT-A',filename:'result-a.json',mediaType:'application/json',byteSize:productBytesA.byteLength,sha256:productShaA,lineage:{productId,baselineId:p.job.CURRENT_BASELINE_ID}});
engine.registerArtifactBytes(p,{stage:21,artifactId:'ARTIFACT-PRODUCT-B',filename:'result-b.json',mediaType:'application/json',byteSize:productBytesB.byteLength,sha256:productShaB,lineage:{productId,baselineId:p.job.CURRENT_BASELINE_ID}});
pr=savePrompt(21);accept(21,pr,{stageData:stageData(21),records:{products:[targetUpdate(productId,requiredAgentFields('products',{BASELINE_MATERIALS:['ARTIFACT-CORRECTED'],EXECUTION_TIMESTAMPS:{completedAt:'2026-08-25T23:00:00Z'},TOOL_CONFIGURATION:'CONTROLLED PRODUCTION CONFIGURATION',DEVIATIONS:'NONE',FAILURES:'NONE',GENERATED_ARTIFACT_INVENTORY:['ARTIFACT-PRODUCT-A','ARTIFACT-PRODUCT-B']}))]}},'STAGE-21-PRODUCT');engine.recalculate(p);assertComplete(21);assert(engine.recordValue(engine.records(p,'products',{stage:21}).at(-1),'PRODUCTION_CONTEXT_ID')===engine.recordId(productionContext,'freshContexts'),'Stage 21 product is not bound to the registered fresh context.');

// Stage 22: exactly one current deterministic product result for the current mandatory deterministic test.
pr=savePrompt(22);accept(22,pr,{stageData:stageData(22),records:{deterministicResults:[proposal('deterministic-1',requiredAgentFields('deterministicResults',{TOOL_AND_VERSION:'Web Crypto SHA-256',PROCEDURE:'Hash exact delivered bytes and compare against canonical product artifact digests.',EXPECTED_RESULT:'SATISFIED',ACTUAL_RESULT:'SATISFIED',DETERMINATION:'SATISFIED',EVIDENCE:'Both stored product artifacts match their application-computed SHA-256 identities.'}),{PRODUCT_ID:refId(productId),TEST_ID:refId(testId)})]}});engine.recalculate(p);assertComplete(22);

// Stage 23: independent current meaning review for the mandatory requirement.
pr=savePrompt(23);accept(23,pr,{stageData:stageData(23),records:{meaningResults:[proposal('meaning-1',requiredAgentFields('meaningResults',{PRODUCT_LOCATION:'result-a.json and result-b.json',EXTERNAL_SOURCE_EVIDENCE:'Current accepted authority and requirement trace.',REQUIRED_MEANING:'Delivered artifacts preserve the exact authorized deterministic content identity.',OBSERVED_MEANING:'Delivered artifacts preserve the required exact identities.',EVIDENCE_BASED_COMPARISON:'Required and observed meanings are aligned without an unresolved variance.',DETERMINATION:'SATISFIED',UNDETERMINED_REASON:''}),{REQ_ID:refId(reqId),PRODUCT_ID:refId(productId)})]}});engine.recalculate(p);assertComplete(23);

// Stage 24: adversarial verification of the current product and active historical regression pattern.
pr=savePrompt(24);accept(24,pr,{stageData:stageData(24),records:{adversarialResults:[proposal('attack-1',requiredAgentFields('adversarialResults',{ATTACK:`BYTE_MUTATION and active regression ${regId}`,METHOD:'Attempt one-byte modification and stale identity substitution.',EXPECTED_BEHAVIOR:'Modified or stale bytes are rejected.',ACTUAL_RESULT:'All adversarial modifications were rejected.',DETERMINATION:'SATISFIED',SEVERITY:'MAJOR',EVIDENCE:`Current product evidence plus permanent regression ${regId}.`}),{PRODUCT_ID:refId(productId)})]}});engine.recalculate(p);assertComplete(24);

// Stage 25: every actual product artifact receives an evidenced representation inspection.
pr=savePrompt(25);accept(25,pr,{stageData:stageData(25),records:{representationInspections:[
 proposal('inspection-a',requiredAgentFields('representationInspections',{REQUIRED_BY_TRACE:reqId,TRANSFORMATION_CHAIN:'Canonical bytes -> stored product artifact -> inspected representation.',TRANSFORMATION_TOOLS_VERSIONS:'Current Chromium-compatible inspection path.',RENDERING_OPENING_EVIDENCE:'result-a.json opened and inspected.',OBSERVATIONS:'No mandatory representation unknown remains.',DETERMINATION:'SATISFIED',EVIDENCE:'Exact artifact A identity and inspection evidence.'}),{ARTIFACT_ID:refId('ARTIFACT-PRODUCT-A')}),
 proposal('inspection-b',requiredAgentFields('representationInspections',{REQUIRED_BY_TRACE:reqId,TRANSFORMATION_CHAIN:'Canonical bytes -> stored product artifact -> inspected representation.',TRANSFORMATION_TOOLS_VERSIONS:'Current Chromium-compatible inspection path.',RENDERING_OPENING_EVIDENCE:'result-b.json opened and inspected.',OBSERVATIONS:'No mandatory representation unknown remains.',DETERMINATION:'SATISFIED',EVIDENCE:'Exact artifact B identity and inspection evidence.'}),{ARTIFACT_ID:refId('ARTIFACT-PRODUCT-B')})
]}});engine.recalculate(p);assertComplete(25);

// Stage 26: current process and product audits both affirmatively satisfied.
pr=savePrompt(26);accept(26,pr,{stageData:stageData(26),records:{processAudits:[proposal('process-audit',requiredAgentFields('processAudits',{APPROVED_INPUTS_VS_ACTUAL:'MATCH',APPROVED_INSTRUCTION_VS_ACTUAL:'MATCH',APPROVED_TOOLS_VS_ACTUAL:'MATCH',REQUIRED_TESTS_VS_EXECUTED:'COMPLETE',UNAUTHORIZED_MODIFICATION:'NONE',AUTHORIZED_CHANGES:'RECORDED',CHAIN_OF_CUSTODY:'COMPLETE',PROCESS_DEFECTS:'NONE',BLOCKERS:'NONE',PROCESS_DETERMINATION:'SATISFIED',PROCESS_EVIDENCE:'Canonical prompts, receipts, manifests, runs, tests and product lineage reconcile.'}))],productAudits:[proposal('product-audit',requiredAgentFields('productAudits',{VALIDATOR_RESULTS:'ALL SATISFIED',MEANING_VERIFICATION_RESULTS:'ALL SATISFIED',PRODUCT_DEFECTS:'NONE',BLOCKERS:'NONE',PRODUCT_DETERMINATION:'SATISFIED',PRODUCT_EVIDENCE:'Current deterministic, meaning, adversarial and representation records reconcile to the product.'}))]}});engine.recalculate(p);assertComplete(26);

// Stage 27: independent release-gate review followed by one idempotent application determination.
pr=savePrompt(27);accept(27,pr,{stageData:stageData(27),records:{releaseGateReviews:[proposal('release-review',requiredAgentFields('releaseGateReviews',{OBSERVED_BLOCKERS:'NONE',OBSERVED_VIOLATIONS:'NONE',OBSERVED_MISSING_EVIDENCE:'NONE',CONTROLLING_RULE_ANALYSIS:'All current mandatory release evidence is affirmatively satisfied.',EVIDENCE:'Current canonical release evidence set.'}),{PRODUCT_ID:refId(productId),BASELINE_ID:refId(p.job.CURRENT_BASELINE_ID)})]}});const release1=engine.recordReleaseDetermination(p),release2=engine.recordReleaseDetermination(p);assert(engine.recordId(release1,'releaseRecords')===engine.recordId(release2,'releaseRecords'),'Stage 27 release evaluation is not idempotent for unchanged evidence.');engine.recalculate(p);assertComplete(27);assert(engine.recordValue(release1,'DETERMINATION')==='ACCEPTED','Stage 27 did not application-derive ACCEPTED from satisfied current evidence.');

// Stage 28: exact audited/delivery bytes join by canonical identity, not array position.
const audited=[{artifactId:'ARTIFACT-PRODUCT-A',name:'result-a.json',version:'PRODUCT-v001',storageReference:'indexeddb:ARTIFACT-PRODUCT-A',size:productBytesA.byteLength,sha256:productShaA},{artifactId:'ARTIFACT-PRODUCT-B',name:'result-b.json',version:'PRODUCT-v001',storageReference:'indexeddb:ARTIFACT-PRODUCT-B',size:productBytesB.byteLength,sha256:productShaB}];
const delivery=[{artifactId:'ARTIFACT-PRODUCT-B',name:'result-b.json',version:'PRODUCT-v001',storageReference:'delivery:result-b.json',size:productBytesB.byteLength,sha256:productShaB},{artifactId:'ARTIFACT-PRODUCT-A',name:'result-a.json',version:'PRODUCT-v001',storageReference:'delivery:result-a.json',size:productBytesA.byteLength,sha256:productShaA}];
const identities=engine.verifyArtifactIdentity(p,audited,delivery);engine.recalculate(p);assertComplete(28);assert(identities.length===2&&identities.every(x=>engine.recordValue(x,'AUTHORIZATION')==='AUTHORIZED'),'Stage 28 failed exact order-independent artifact identity.');

// Stage 29: application constructs complete evidence graphs; no agent-authored routine relationship is needed.
const chains=engine.constructEvidenceChains(p);engine.recalculate(p);assertComplete(29);assert(chains.length===1&&chains.every(x=>engine.recordValue(x,'STATUS')==='COMPLETE'),'Stage 29 did not construct a complete evidence chain for every mandatory requirement.');

// Stage 30: append-only defect/regression history remains unchanged while final permanence is reverified.
const defectHistoryBefore=JSON.stringify(p.projectData.defects),regressionHistoryBefore=JSON.stringify(p.projectData.regressions);pr=savePrompt(30);accept(30,pr,{stageData:stageData(30),records:{}},'STAGE-30-PERMANENCE');engine.recalculate(p);assertComplete(30);assert(JSON.stringify(p.projectData.defects)===defectHistoryBefore,'Stage 30 rewrote append-only defect history.');assert(JSON.stringify(p.projectData.regressions)===regressionHistoryBefore,'Stage 30 rewrote append-only regression history.');

// Reload/recalculation must preserve the entire completed canonical lifecycle.
const reloaded=JSON.parse(JSON.stringify(p));engine.ensureShape(reloaded);engine.recalculate(reloaded);for(let stage=1;stage<=30;stage++)assert(engine.gate(stage,reloaded).complete,`Reloaded project lost Stage ${stage}: ${engine.gate(stage,reloaded).reasons.join('; ')}`);assert(reloaded.stages[30].status==='COMPLETE','Reloaded full-cycle project is not COMPLETE.');

"""
s=s.replace(marker,block+marker,1).replace("continuousLifecycle:'STAGES_01_TO_20',stagesCompleted:20","continuousLifecycle:'STAGES_01_TO_30',stagesCompleted:30,artifactRoundTripReady:true,releaseByteIdentity:true,reloadIntegrity:true",1)
p.write_text(s)
