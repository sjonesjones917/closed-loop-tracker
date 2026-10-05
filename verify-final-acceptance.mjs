import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {visualBaselineFixture} from './test-fixtures.mjs';
import {createNormativeProofFixture} from './test-normative-proof-fixture.mjs';
import {applyExecutedEvidence,evaluateFullRequirementProof,coverageDeclarationSha256,validateFinalNormativeProof,readExecutedEvidence,validateExecutionReceipt,aggregateExecutedEvidence,readExecutionReceipts,evidenceFingerprint,observationsFromReports,sha} from './verification-evidence.mjs';
import {runtimePaths} from './verified-site.mjs';
import {evaluateFinalAcceptance,CORE_COVERAGE_KEYS,SECTION49_COVERAGE_KEYS,CORE_ZERO_KEYS,SECTION49_ZERO_KEYS} from './final-acceptance.mjs';
// Disposable publication fixture. This proves the gate, not a physical-device run.
const normativeFixture=createNormativeProofFixture();
process.on('exit',()=>normativeFixture.dispose());
// Reuse this fixture's actual producer report. Mutations below test only its
// finite evidence consumer; they do not stand for additional runtime runs.
const runtimeAdmissionConsumerControls=[];
const runtimeReports=normativeFixture.receipt.reports;
const runtimeAdmissionPassed=reports=>observationsFromReports('verify-test-runtime-v3.mjs',reports).find(row=>row.checkId==='test-ir.operation-registry-admission')?.passed;
assert.equal(runtimeAdmissionPassed(runtimeReports),true,'RUNTIME_ADMISSION_CONSUMER_CONTROL_ORACLE');
for(const [name,change]of [
 ['missing-report',report=>delete report.operationRegistryAdmission],
 ['missing-operation-case',report=>report.operationRegistryAdmission.negativeCases.pop()],
 ['false-operation-rejection',report=>report.operationRegistryAdmission.negativeCases[0].result='ACCEPTED'],
 ['missing-label-case',report=>report.operationRegistryAdmission.labelCases.pop()],
 ['invalid-capability-supported',report=>report.operationRegistryAdmission.capabilityCases[0].supported=true],
 ['missing-prior-exception',report=>report.operationRegistryAdmission.preFixExceptionCases.pop()],
 ['lost-prior-malformed-result',report=>report.operationRegistryAdmission.preFixMalformedResultCompletedExecution=0],
 ['missing-registered-operation',report=>report.operationRegistryAdmission.registeredOperationIds.pop()],
 ['changed-execution',report=>report.operationRegistryAdmission.executionTraceUnchanged=false],
 ['invalid-worker-launched',report=>report.operationRegistryAdmission.workerLaunches=1],
 ['missing-ingestion-case',report=>report.operationRegistryAdmission.ingestion.results.pop()],
 ['invalid-ingestion-accepted',report=>report.operationRegistryAdmission.ingestion.results.find(row=>row.mode==='CURRENT').result='ACCEPTED'],
 ['lost-raw-history',report=>report.operationRegistryAdmission.ingestion.originalRawHistoryPreserved=false],
 ['valid-envelope-blocked',report=>report.operationRegistryAdmission.ingestion.conformingEnvelopeStillValid=false]
]){
 const reports=structuredClone(runtimeReports);change(reports.find(report=>report.verifyTestRuntimeV3==='PASS'));
 assert.equal(runtimeAdmissionPassed(reports),false,'RUNTIME_ADMISSION_CONSUMER_ORACLE: '+name);assert.equal(runtimeAdmissionPassed(runtimeReports),true);runtimeAdmissionConsumerControls.push({case:name,consumerOnly:true,actualProducerRerun:false,result:'REJECTED',restored:'PASS'});
}
const commit=normativeFixture.fingerprint.sourceCommit,visual=visualBaselineFixture(projectStoreRuntime(),{commit});
const fixture={commit,workflow:'mobile-closed-loop/30',contractProfileId:'closed-loop-completion-profile/1',projectSchema:'closed-loop-project/3',responseSchema:'closed-loop-stage-response/3',stageCount:30,stagesCompleted:30,coverageMetrics:{},section49CoverageMetrics:{},section49ZeroCountMetrics:{},section49ZeroCountInvariantCount:26,section49ZeroCountInvariantViolations:0,deployedByteIdentity:true,localChromiumAcceptance:true,deployedChromiumAcceptance:true,jobResults:{test:'success',deploy:'success',live:'success'},dataRouteClosure:'PASS',infrastructureRouteClosure:'PASS',actualIPhoneSafariAcceptance:true,mobileAcceptanceResult:'ACCEPTED',physicalIPhoneJobResult:'success',mobileAcceptanceSourceCommit:commit,mobileAcceptanceDeploymentManifestDigest:'c'.repeat(64),mobileAcceptanceOrigin:'https://sjonesjones917.github.io',mobileAcceptanceBasePath:'/closed-loop-tracker/',mobileAcceptanceTargetId:'DISPOSABLE-TARGET',mobileAcceptanceEvidenceId:'DISPOSABLE-EVIDENCE',mobileAcceptanceTestProjectId:'DISPOSABLE-PROJECT',mobileAcceptancePerformer:'DISPOSABLE-PERFORMER',mobileAcceptanceSubmitter:'DISPOSABLE-SUBMITTER',mobileAcceptancePhysicalDeviceAssertion:true,mobileAcceptanceEvidenceBasis:'HUMAN_OBSERVATION',mobileAcceptanceChallenge:'d'.repeat(64)};
fixture.mobileAcceptanceDeploymentManifestDigest=visual.comparison.deploymentManifest.manifestDigest.digest;
assert.equal(CORE_COVERAGE_KEYS.length+SECTION49_COVERAGE_KEYS.length,35);
assert.equal(CORE_ZERO_KEYS.length+SECTION49_ZERO_KEYS.length,38);
for(const [group,keys] of [['coverageMetrics',CORE_COVERAGE_KEYS],['section49CoverageMetrics',SECTION49_COVERAGE_KEYS]])for(const key of keys){fixture[key]=1;fixture[group][key]={metricId:key,universeDefinition:'Two fixed disposable assertions',derivationVersion:'gate-fixture/1',scopeHash:commit,numerator:2,denominator:2,includedIds:[key+'-1',key+'-2'],excludedIds:[],evidenceReferences:['DISPOSABLE-EXECUTED-PROOF'],value:1,disposition:'SATISFIED'};}
for(const key of CORE_ZERO_KEYS)fixture[key]=0;for(const key of SECTION49_ZERO_KEYS)fixture.section49ZeroCountMetrics[key]=0;
const normalizedNormativeReport=applyExecutedEvidence(fixture,normativeFixture.evidence);
for(const name of ['executedVerificationEvidence','normativeRequirementTrace','fullRequirementProofs','normativeRequirementTraceCoverage'])fixture[name]=normalizedNormativeReport[name];
fixture.section49CoverageMetrics.normativeRequirementTraceCoverage=normalizedNormativeReport.section49CoverageMetrics.normativeRequirementTraceCoverage;
const check=(r,v=visual)=>evaluateFinalAcceptance(r,{visualBaseline:v,baselineResourceGraph:{sourceCommit:v.sourceCommit,paths:runtimePaths},executedEvidence:normativeFixture.evidence});assert.equal(check(fixture).accepted,true);

let mutationsDetected=0;
function reject(mutate,mutateVisual=null){const r=structuredClone(fixture),v=structuredClone(visual);mutate(r);mutateVisual?.(v);assert.equal(check(r,v).accepted,false,'Invalid publication fixture was accepted.');assert.equal(check(fixture).accepted,true,'Repair failed to restore progression.');mutationsDetected++;}
for(const [group,keys] of [['coverageMetrics',CORE_COVERAGE_KEYS],['section49CoverageMetrics',SECTION49_COVERAGE_KEYS]])for(const key of keys){
  for(const mutation of [r=>delete r[group][key],r=>r[group][key].numerator=r[group][key].denominator-1,r=>r[group][key].denominator=0,r=>r[group][key].includedIds=[],r=>r[group][key].includedIds=[key+'-1',key+'-1'],r=>r[group][key].evidenceReferences=[],r=>r[group][key].disposition='BLOCKED',r=>r[key]=0.5,r=>r[group][key].value=0.5,r=>delete r[group][key].derivationVersion])reject(mutation);
}
for(const key of CORE_ZERO_KEYS){reject(r=>delete r[key]);reject(r=>r[key]=1);}
for(const key of SECTION49_ZERO_KEYS){reject(r=>delete r.section49ZeroCountMetrics[key]);reject(r=>r.section49ZeroCountMetrics[key]=1);}
for(const key of ['deployedByteIdentity','localChromiumAcceptance','deployedChromiumAcceptance','actualIPhoneSafariAcceptance','mobileAcceptancePhysicalDeviceAssertion'])reject(r=>r[key]=false);
for(const key of ['test','deploy','live'])reject(r=>r.jobResults[key]='skipped');
for(const key of ['mobileAcceptanceTargetId','mobileAcceptanceEvidenceId','mobileAcceptanceTestProjectId','mobileAcceptancePerformer','mobileAcceptanceSubmitter'])reject(r=>delete r[key]);
reject(r=>r.mobileAcceptanceSourceCommit='e'.repeat(40));reject(r=>r.mobileAcceptanceEvidenceBasis='SELF_ASSERTED');reject(r=>r.mobileAcceptanceChallenge='short');
reject(()=>{},v=>v.status='OPEN');reject(()=>{},v=>v.comparedCommit='e'.repeat(40));reject(()=>{},v=>v.evidenceReferences=[]);
// §39.18 tuple and authority counterexamples use the real final publication
// helper; disposable claims do not establish actual release/device approval.
for(const change of [v=>delete v.baseline,v=>delete v.baseline.VISUAL_BASELINE_ID,v=>v.baseline.viewports[0].promptBox.height='120px',v=>delete v.comparison,v=>v.comparison.baselineSha256='f'.repeat(64),v=>v.comparison.ignoredDynamicRegionIds=['UNKNOWN'],v=>delete v.authorityRecord,v=>v.authorityRecord.source='AGENT_REPORT',v=>v.authorityReceipt.type='AGENT_REPORT'])reject(()=>{},change);
for(const change of [v=>v.baseline.extension=JSON.parse('1e400'),v=>v.baseline.deploymentManifest.extension=JSON.parse('1e400'),v=>v.unknownExtension='\ud800'])reject(()=>{},change);
reject(r=>r.mobileAcceptanceDeploymentManifestDigest='f'.repeat(64));
// The formerly green summary cannot hide 1/2 detailed evidence.
reject(r=>{r.section49CoverageMetrics.stage01RawInputAccounting.numerator=1;r.section49CoverageMetrics.stage01RawInputAccounting.value=0.5;r.stage01RawInputAccounting=1;});

// The actual runtime producer above supports a disposable one-entry universe.
// These reviewed-declaration controls are helper counterexamples; they do not
// manufacture further producer executions or upgrade any repository binding.
const normativeProofCases=[];
const healthyProof=()=>normativeFixture.withScope(()=>evaluateFullRequirementProof(normativeFixture.requirement,[normativeFixture.binding],normativeFixture.observations,normativeFixture.fingerprint));
assert.equal(healthyProof().disposition,'CONFORMANT_PROVEN');
function rejectCoverage(name,change,expectedReason){
 const binding=structuredClone(normativeFixture.binding);change(binding);
 const proof=normativeFixture.withScope(()=>evaluateFullRequirementProof(normativeFixture.requirement,[binding],normativeFixture.observations,normativeFixture.fingerprint));
 assert.equal(proof.disposition,'UNKNOWN','NORMATIVE_COVERAGE_ORACLE: '+name);assert(proof.reasons.includes(expectedReason),'NORMATIVE_COVERAGE_REASON_ORACLE: '+name+' '+JSON.stringify(proof.reasons));assert.equal(healthyProof().disposition,'CONFORMANT_PROVEN');
 normativeProofCases.push({caseId:name,boundary:'Full-coverage declaration evaluator over actual validated producer observations',result:'REJECTED_FOR_EXPECTED_REASON',expectedReason,restored:'CONFORMANT_PROVEN'});
}
for(const [name,change,reason] of [
 ['partial-binding-remains-scoped',b=>delete b.fullCoverage,'NO_REVIEWED_FULL_COVERAGE_DECLARATION'],
 ['missing-independent-review',b=>delete b.fullCoverage.review,'MISSING_OR_STALE_COVERAGE_REVIEW'],
 ['stale-source',b=>b.fullCoverage.sourceLineSha256='0'.repeat(64),'COVERAGE_SOURCE_OR_REGISTRY_MISMATCH'],
 ['stale-owner',b=>b.fullCoverage.productionOwners[0].sha256='0'.repeat(64),'MISSING_OR_STALE_PRODUCTION_OWNER'],
 ['missing-owner',b=>b.fullCoverage.productionOwners=[],'MISSING_OR_STALE_PRODUCTION_OWNER'],
 ['missing-source-clause',b=>b.fullCoverage.obligations[0].sourceText='unknown operation','INCOMPLETE_SOURCE_OBLIGATION_DECOMPOSITION'],
 ['unresolved-source-obligation',b=>b.fullCoverage.unresolvedObligations=['Unproved condition'],'UNRESOLVED_COVERAGE_OBLIGATIONS'],
 ['wrong-check',b=>b.fullCoverage.obligations[0].checks.deterministic[0].checkId='test-ir.exact-integer','REQUIRED_CURRENT_ASSERTION_MISSING_OR_WRONG_PRODUCER'],
 ['wrong-producer',b=>b.fullCoverage.obligations[0].checks.deterministic[0].suite='verify.mjs','REQUIRED_CURRENT_ASSERTION_MISSING_OR_WRONG_PRODUCER'],
 ['different-evidence-kind',b=>b.fullCoverage.obligations[0].evidenceKinds=['EXECUTED_SCHEMA_METADATA_ASSERTIONS'],'REQUIRED_EVIDENCE_KIND_NOT_OBSERVED'],
 ['missing-mutation-applicability',b=>delete b.fullCoverage.obligations[0].nonapplicable.mutation,'REQUIRED_CHECK_ROLE_UNACCOUNTED'],
 ['missing-semantic-applicability',b=>delete b.fullCoverage.obligations[0].nonapplicable.semantic,'REQUIRED_CHECK_ROLE_UNACCOUNTED'],
 ...['ACTUAL_IPHONE_SAFARI','HUMAN_OBSERVATION','VERIFIED_EXTERNAL','LOCAL_AND_DEPLOYED_BROWSER'].map(kind=>['synthetic-cannot-prove-'+kind,b=>b.fullCoverage.obligations[0].evidenceKinds=[kind],'UNSUPPORTED_REQUIRED_EVIDENCE_KIND'])
])rejectCoverage(name,change,reason);
for(const [name,change,reason] of [
 ['self-review',review=>review.reviewer.contextId=review.author.contextId,'INCOMPLETE_OR_SELF_COVERAGE_REVIEW'],
 ['review-not-performed',review=>review.reviewPerformed=false,'INCOMPLETE_OR_SELF_COVERAGE_REVIEW'],
 ['review-has-open-finding',review=>review.findings=['Missing counterexample'],'INCOMPLETE_OR_SELF_COVERAGE_REVIEW'],
 ['review-wrong-declaration',review=>review.declarationSha256='0'.repeat(64),'COVERAGE_REVIEW_BINDING_MISMATCH'],
 ['review-missing-catalog-source',review=>review.reviewedInputs=review.reviewedInputs.filter(row=>row.path!=='verification-evidence-catalog.mjs'),'COVERAGE_REVIEW_TEST_INPUT_MISMATCH'],
 ['review-missing-test-source',review=>review.reviewedInputs=review.reviewedInputs.filter(row=>row.path!=='verify-test-runtime-v3.mjs'),'COVERAGE_REVIEW_TEST_INPUT_MISMATCH']
]){
 const review=structuredClone(normativeFixture.review);change(review);const bytes=JSON.stringify(review),binding=structuredClone(normativeFixture.binding),fingerprint=structuredClone(normativeFixture.fingerprint);binding.fullCoverage.review.sha256=sha(bytes);fingerprint.inputSha256[normativeFixture.reviewPath]=sha(bytes);
 normativeFixture.withScope(()=>{const previous=fs.readFileSync(normativeFixture.reviewPath);try{fs.writeFileSync(normativeFixture.reviewPath,bytes);const proof=evaluateFullRequirementProof(normativeFixture.requirement,[binding],normativeFixture.observations,fingerprint);assert.equal(proof.disposition,'UNKNOWN');assert(proof.reasons.includes(reason),'NORMATIVE_REVIEW_ORACLE: '+name+' '+JSON.stringify(proof.reasons));}finally{fs.writeFileSync(normativeFixture.reviewPath,previous);}});
 normativeProofCases.push({caseId:name,boundary:'Retained review record and full-coverage evaluator; controlled fingerprint is a helper input, not a newly executed receipt',result:'REJECTED_FOR_EXPECTED_REASON',expectedReason:reason});
}
for(const [name,mutateObservation] of [['missing-required-case',rows=>rows.delete('test-ir.unknown-operation')],['failed-required-case',rows=>rows.get('test-ir.unknown-operation').passed=false]]){
 const observations=new Map(structuredClone([...normativeFixture.observations]));mutateObservation(observations);
 const proof=normativeFixture.withScope(()=>evaluateFullRequirementProof(normativeFixture.requirement,[normativeFixture.binding],observations,normativeFixture.fingerprint));assert.equal(proof.disposition,'UNKNOWN');assert(proof.reasons.includes('REQUIRED_CURRENT_ASSERTION_MISSING_OR_WRONG_PRODUCER'),'NORMATIVE_REQUIRED_CASE_ORACLE: '+name);assert.equal(healthyProof().disposition,'CONFORMANT_PROVEN');normativeProofCases.push({caseId:name,boundary:'Full-coverage observation consumer',result:'REJECTED_FOR_EXPECTED_REASON',restored:'CONFORMANT_PROVEN'});
}
const requiresPhysical=structuredClone(normativeFixture.requirement);requiresPhysical.requiredBrowserOrPhysicalDeviceProof=['ACTUAL_IPHONE_SAFARI'];const physicalProof=normativeFixture.withScope(()=>evaluateFullRequirementProof(requiresPhysical,[normativeFixture.binding],normativeFixture.observations,normativeFixture.fingerprint));assert.equal(physicalProof.disposition,'UNKNOWN');assert(physicalProof.reasons.includes('REQUIRED_BROWSER_OR_PHYSICAL_PROOF_NOT_ESTABLISHED_BY_SYNTHETIC_RECEIPTS'));normativeProofCases.push({caseId:'mandatory-manifest-physical-proof',boundary:'Requirement proof metadata consumer',result:'SYNTHETIC_RECEIPT_INSUFFICIENT'});
const withoutCheckedEvidence=evaluateFinalAcceptance(fixture,{visualBaseline:visual,baselineResourceGraph:{sourceCommit:visual.sourceCommit,paths:runtimePaths}});
assert(withoutCheckedEvidence.blockers.some(row=>row.code==='CURRENT_NORMATIVE_PROOF_REQUIRED'),'NORMATIVE_FINAL_GATE_ORACLE: numeric full coverage alone passed');
// Documented pre-fix equivalent: remove only the new receipt-proof guard while
// retaining the corrected visual/metric controls. This is the former numeric
// summary acceptance boundary, not a synthetic claim that the app was released.
const finalSource=fs.readFileSync(new URL('./final-acceptance.mjs',import.meta.url),'utf8'),proofGuard="  try{validateFinalNormativeProof(report,executedEvidence);}catch(error){fail('CURRENT_NORMATIVE_PROOF_REQUIRED','normativeRequirementTrace');blockers.at(-1).reason=String(error.message);}";
assert.equal(finalSource.split(proofGuard).length,2,'NORMATIVE_FINAL_FAULT_ANCHOR_ORACLE');
const formerFinalSource=finalSource.replace(proofGuard,'').replaceAll("'./verification-evidence.mjs'",JSON.stringify(pathToFileURL(new URL('./verification-evidence.mjs',import.meta.url).pathname).href)).replaceAll("'./visual-baseline-submission.mjs'",JSON.stringify(new URL('./visual-baseline-submission.mjs',import.meta.url).href));
const formerFinalGate=(await import('data:text/javascript;base64,'+Buffer.from(formerFinalSource).toString('base64'))).evaluateFinalAcceptance;
assert.equal(formerFinalGate(fixture,{visualBaseline:visual,baselineResourceGraph:{sourceCommit:visual.sourceCommit,paths:runtimePaths}}).accepted,true,'NORMATIVE_FINAL_PRE_FIX_ORACLE: former numeric-only admission was not reproduced');
normativeProofCases.push({caseId:'former-numeric-only-final-acceptance',boundary:'Actual final gate with only the new normative receipt guard removed; earlier publication-summary behavior equivalent',preFixAcceptedWithoutNormativeEvidence:true,postFixRejectedWithoutNormativeEvidence:true,otherPublicationControlsRetained:true});

assert.throws(()=>validateFinalNormativeProof(fixture,structuredClone(normativeFixture.evidence)),/unchanged revalidated/,'NORMATIVE_FINAL_GATE_ORACLE: arbitrary copied evidence was treated as revalidated');
const originalDisposition=normativeFixture.evidence.fullRequirementProofs.requirements[0].disposition;normativeFixture.evidence.fullRequirementProofs.requirements[0].disposition='UNKNOWN';assert.equal(check(fixture).accepted,false,'NORMATIVE_FINAL_GATE_ORACLE: post-validation mutation passed');normativeFixture.evidence.fullRequirementProofs.requirements[0].disposition=originalDisposition;assert.equal(check(fixture).accepted,true);
for(const mutate of [r=>r.commit='0'.repeat(40),r=>r.fullRequirementProofs.requirements=[],r=>r.fullRequirementProofs.normativeManifestSha256='0'.repeat(64),r=>r.executedVerificationEvidence.fingerprint.specificationSha256='0'.repeat(64),r=>r.section49CoverageMetrics.normativeRequirementTraceCoverage.includedIds=['UNREVIEWED'],r=>r.section49CoverageMetrics.normativeRequirementTraceCoverage.numerator=0])reject(mutate);
normativeFixture.withScope(()=>{const file='test-runtime.js',bytes=fs.readFileSync(file);try{fs.appendFileSync(file,'\n');assert.throws(()=>readExecutedEvidence(normativeFixture.evidencePath),/not the current source|stale source/,'NORMATIVE_STALE_RECEIPT_ORACLE');assert.throws(()=>validateFinalNormativeProof(fixture,normativeFixture.evidence),/source changed after/,'NORMATIVE_FINAL_FRESHNESS_ORACLE');}finally{fs.writeFileSync(file,bytes);}assert.equal(check(fixture).accepted,true);});
const corruptReceipt=structuredClone(normativeFixture.receipt);corruptReceipt.observations.find(row=>row.checkId==='test-ir.unknown-operation').passed=false;delete corruptReceipt.receiptSha256;corruptReceipt.receiptSha256=sha(corruptReceipt);assert.throws(()=>validateExecutionReceipt(corruptReceipt,corruptReceipt.suite,normativeFixture.fingerprint),/assertions differ from actual executed report/,'NORMATIVE_CORRUPT_RECEIPT_ORACLE');
normativeProofCases.push({caseId:'actual-receipt-final-boundary',boundary:'Real runtime producer -> current receipt read -> source/manifest/ID proof -> final gate; exact source restore permits progress',actualProducerExecuted:true,missingCopiedMutatedEvidenceRejected:true,wrongCandidateOrUniverseRejected:true,staleSourceRejected:true,corruptReceiptRejected:true,restoredProgress:true,isolatedRequirementCount:1,realReleaseProof:false});

// verified-site first authenticates the successful run, complete proof bundle,
// runtime and exact Git tree. Its explicit promotion is then consumed by the
// ordinary receipt reader and collector. Exercise that latter boundary without
// rerunning the producer or representing this fixture as an actual PR artifact.
normativeFixture.withScope(()=>{
 const suite=normativeFixture.receipt.suite,receiptPath='receipts/'+suite+'.json',receiptBytes=fs.readFileSync(receiptPath),evidenceBytes=fs.readFileSync(normativeFixture.evidencePath);
 try{
  execFileSync('git',['-c','user.name=Disposable proof fixture','-c','user.email=fixture@localhost','commit','--quiet','--allow-empty','-m','Disposable identical-tree promotion']);
  const fingerprint=evidenceFingerprint(),receipt=structuredClone(normativeFixture.receipt);
  assert.notEqual(fingerprint.sourceCommit,normativeFixture.fingerprint.sourceCommit);assert.equal(fingerprint.sourceTree,normativeFixture.fingerprint.sourceTree);assert.equal(fingerprint.sourceInputsSha256,normativeFixture.fingerprint.sourceInputsSha256);
  assert.throws(()=>validateExecutionReceipt(receipt,suite,fingerprint),/different candidate revision/,'NORMATIVE_PROMOTION_ORACLE: unpromoted receipt passed a different candidate');
  receipt.promotion={sourceCommit:fingerprint.sourceCommit,sourceTree:fingerprint.sourceTree,verifiedSourceCommit:receipt.fingerprint.sourceCommit,verifiedRunId:'DISPOSABLE-VERIFIED-RUN',verifiedRunAttempt:1,proofBundleSha256:sha('DISPOSABLE authenticated artifact boundary is tested by verify-verified-site.mjs')};
  delete receipt.receiptSha256;receipt.receiptSha256=sha(receipt);fs.writeFileSync(receiptPath,JSON.stringify(receipt));
  const aggregate=aggregateExecutedEvidence(readExecutionReceipts('receipts',fingerprint),fingerprint);fs.writeFileSync(normativeFixture.evidencePath,JSON.stringify({...aggregate,evidenceSha256:sha(aggregate)}));
  const evidence=readExecutedEvidence(normativeFixture.evidencePath,fingerprint),report=applyExecutedEvidence({...fixture,commit:fingerprint.sourceCommit},evidence);
  assert.doesNotThrow(()=>validateFinalNormativeProof(report,evidence),'NORMATIVE_PROMOTION_ORACLE: valid exact-tree promoted current proof was blocked');
  assert.throws(()=>validateFinalNormativeProof({...report,commit:normativeFixture.fingerprint.sourceCommit},evidence),/different candidate/,'NORMATIVE_PROMOTION_ORACLE: report retained the old tested revision');
  const wrongTree=structuredClone(receipt);wrongTree.promotion.sourceTree='0'.repeat(40);delete wrongTree.receiptSha256;wrongTree.receiptSha256=sha(wrongTree);assert.throws(()=>validateExecutionReceipt(wrongTree,suite,fingerprint),/different candidate revision/,'NORMATIVE_PROMOTION_ORACLE: different tree reused old proof');
 }finally{
  execFileSync('git',['checkout','--quiet','--detach',normativeFixture.fingerprint.sourceCommit]);fs.writeFileSync(receiptPath,receiptBytes);fs.writeFileSync(normativeFixture.evidencePath,evidenceBytes);
 }
 assert.equal(check(fixture).accepted,true,'NORMATIVE_PROMOTION_ORACLE: original controlled candidate failed after restoration');
});
normativeProofCases.push({caseId:'same-tree-promoted-current-proof',boundary:'Actual receipt validation -> re-aggregation at distinct same-tree candidate -> readExecutedEvidence -> final normative proof guard; verified-site API/artifact authentication independently tested',unpromotedCandidateRejected:true,wrongTreeRejected:true,oldReportCandidateRejected:true,permittedCurrentPromotionAccepted:true,originalCandidateRestored:true,producerRerun:false,actualPrPromotion:false});

// Execute the actual report derivation on controlled observation records. This
// checks reporting truthfulness; the referenced intake suites independently
// execute the underlying application behavior in the same required CI.
const intakeSource=fs.readFileSync(process.env.V3_DEFINITION_SOURCE||new URL('./verify-v3-definition-of-done.mjs',import.meta.url),'utf8');
const intakeDefinitions=[
 ['stage01RequiredFileInspectionAccounting','actualStage01',['artifactIdentityBound','missingInspectionClaimRejected','missingHandoffRejected']],
 ['stage01AcceptedSemanticMappingCoverage','actualZeroLoss',['zeroLossStage01','incompleteIntakeRejected']],
 ['stage04ObligationAccounting','actualZeroLoss',['zeroLossStage04','completeStage03ResearchUnion','incompleteObligationRejected']]
];
const observationFixture={actualStage01:{stage01IntakeClosure:true,artifactIdentityBound:true,currentManifestBound:true,missingInspectionClaimRejected:true,missingHandoffRejected:true,humanAuthorityRoundTripIntegrated:true},actualZeroLoss:{zeroLossStage01:true,incompleteIntakeRejected:true,zeroLossStage04:true,completeStage03ResearchUnion:true,incompleteObligationRejected:true}};
function deriveIntake(source,observations){
 const start=source.indexOf('const executedMetricIds='),end=source.indexOf('const has=',start);assert.ok(start>=0&&end>start);
 const entries=intakeDefinitions.map(([key])=>{const line=source.split('\n').find(line=>line.trimStart().startsWith(key+':metric('));assert.ok(line,'Missing intake reporting owner: '+key);return line;});
 const runtime=createVerifierRuntime({assert,...observations,stage01Source:'',stage01Tests:'',zeroLossTests:'',ingestionTests:'',stage04Source:''});
 return createVerifierRuntime.loadScript(runtime,source.slice(start,end)+'\nglobalThis.observedIntake={'+entries.join('\n')+'};observedIntake;',{filename:'verify-v3-definition-of-done.mjs:actual-intake-metric-derivation'});
}
function checkIntakeReporting(source){
 const healthy=deriveIntake(source,observationFixture),cases=[];
 for(const [key,group,fields] of intakeDefinitions){
  assert.equal(healthy[key].value,1,'EXECUTED_INTAKE_METRIC_ORACLE: executed successful '+key+' must remain available to the status publisher.');
  assert.equal(healthy[key].evidenceBasis,'EXECUTED_SYNTHETIC_CASES');
  assert.equal(healthy[key].applicationConformanceEstablished,false,'A narrow executed case must not claim complete application conformance.');
  cases.push({caseId:key+'-executed',result:'PASS',value:healthy[key].value});
  for(const field of fields){
   const observations=structuredClone(observationFixture);observations[group][field]=false;
   const incomplete=deriveIntake(source,observations)[key];
   assert.ok(incomplete.value<1&&incomplete.disposition!=='SATISFIED','EXECUTED_INTAKE_METRIC_ORACLE: '+key+' hides failed observation '+field);
   cases.push({caseId:key+'-reject-'+field,result:'PASS',value:incomplete.value});
  }
 }
 const missingRoundTrip=structuredClone(observationFixture);missingRoundTrip.actualStage01.humanAuthorityRoundTripIntegrated=false;
 const incomplete=deriveIntake(source,missingRoundTrip).stage01AcceptedSemanticMappingCoverage;
 assert.ok(incomplete.value<1&&incomplete.disposition!=='SATISFIED','EXECUTED_INTAKE_METRIC_ORACLE: semantic mapping hides an unproved human-authority roundtrip.');
 cases.push({caseId:'semantic-mapping-reject-missing-human-authority-roundtrip',result:'PASS',value:incomplete.value});
 return cases;
}
const intakeMetricCases=checkIntakeReporting(intakeSource),intakeMetricFaults=[];
// Exercise the actual metadata reporter's derivation with all source tokens
// present and absent. Neither observation executes a behavioral case.
const definitionSource=fs.readFileSync('verify-definition-of-done-invariants.mjs','utf8');
function verifySourceInspectionReporting(source){
 const start=source.indexOf('function sourceInspectionMetric('),end=source.indexOf('const producers=',start);assert.ok(start>=0&&end>start);
 const context=createVerifierRuntime();
 createVerifierRuntime.loadScript(context,source.slice(start,end),{filename:'definition-of-done:report-derivation'});
 for(const present of [true,false]){
  const metric=context.sourceInspectionMetric('CONTROLLED_SOURCE_INSPECTION',[['scope',present],['ownership',present]],['source-only fixture']);
  assert.equal(metric.value,null,'STATIC_EVIDENCE_ORACLE: source tokens are not executed coverage');
  assert.equal(metric.disposition,'UNKNOWN','STATIC_EVIDENCE_ORACLE: unexecuted behavior is unknown');
  assert.equal(metric.applicationConformanceEstablished,false,'STATIC_EVIDENCE_ORACLE: no whole-application claim');
  assert.equal(metric.sourceInspection.matched,present?2:0);
  const counts=context.unobservedZeroCounts(['invalidWorkAccepted']);
  assert.equal(counts.invalidWorkAccepted,null,'STATIC_ZERO_COUNT_ORACLE: no executions means unknown, not zero');
 }
}
verifySourceInspectionReporting(definitionSource);
const staticEvidenceFaults=[];
for(const [fault,before,after,oracle] of [
 ['source-match-as-execution',"evidenceReferences,value:null,disposition:'UNKNOWN'","evidenceReferences,value:1,disposition:'SATISFIED'",'STATIC_EVIDENCE_ORACLE'],
 ['unobserved-count-as-zero','names.map(name=>[name,null])','names.map(name=>[name,0])','STATIC_ZERO_COUNT_ORACLE']
]){
 assert.equal(definitionSource.split(before).length,2,'STATIC_EVIDENCE_FAULT_ANCHOR_ORACLE: '+fault);
 assert.throws(()=>verifySourceInspectionReporting(definitionSource.replace(before,after)),error=>error.code==='ERR_ASSERTION'&&error.message.startsWith(oracle),'STATIC_EVIDENCE_FAULT_DETECTION_ORACLE: '+fault);
 verifySourceInspectionReporting(definitionSource);staticEvidenceFaults.push({fault,result:'DETECTED',restored:'PASS'});
}
for(const [id,before,after] of [
 ['executed-observation-discarded',"'STAGE_01_REQUIRED_FILE_INSPECTION_ACCOUNTING'","'UNEXECUTED_INSPECTION'"],
 ['missing-file-inspection-masked','actualStage01.missingInspectionClaimRejected===true','true'],
 ['missing-intake-unit-masked','actualZeroLoss.incompleteIntakeRejected===true','true'],
 ['missing-obligation-masked','actualZeroLoss.incompleteObligationRejected===true','true']
]){
 assert.ok(intakeSource.includes(before),'Missing reporting fault anchor: '+id);
 assert.throws(()=>checkIntakeReporting(intakeSource.replace(before,after)),/EXECUTED_INTAKE_METRIC_ORACLE/);
 checkIntakeReporting(intakeSource);intakeMetricFaults.push({fault:id,result:'DETECTED',restored:'PASS'});
}

const workflow=fs.readFileSync(new URL('./.github/workflows/pages.yml',import.meta.url),'utf8');
function assertPublicationWiring(source){
  assert.match(source,/node verify-final-acceptance\.mjs/);
  assert.match(source,/const finalGate=evaluateFinalAcceptance\(report,\{visualBaseline,executedEvidence\}\)/);
  assert.match(source,/report\.finalAcceptancePublication=finalGate\.accepted/);
  assert.match(source,/report\.releaseTagEligible=finalGate\.accepted/);
  assert.match(source,/if: steps\.acceptance\.outputs\.final_acceptance == 'true'/);
  const live=source.slice(source.indexOf('\n  verify-live:'),source.indexOf('\n  publish-status:')),publication=source.slice(source.indexOf('\n  publish-status:'));
  for(const [job,text,prefix] of [['verify-live',live,'deployed'],['publish-status',publication,'reverified-deployed']]){
    assert.ok(text.includes('name: '+prefix+'-operator-journeys-${{ github.sha }}-${{ github.run_id }}'),'DEPLOYED_JOURNEY_ARTIFACT_ORACLE: '+job+' must preserve raw observations against the exact SHA/run');
    assert.match(text,/if: always\(\)/,'DEPLOYED_JOURNEY_ARTIFACT_ORACLE: retain failure evidence');
    for(const directory of ['operator-evidence/','recovery-browser-evidence/','mobile-capability-evidence/'])assert.ok(text.includes(directory),'DEPLOYED_JOURNEY_ARTIFACT_ORACLE: '+directory);
  }
  assert.ok(live.includes('node verify-live.mjs 2>&1 | tee /tmp/deployed-byte-proof.log'),'DEPLOYED_JOURNEY_ARTIFACT_ORACLE: retain raw deployed-byte proof');
}
assertPublicationWiring(workflow);
function assertRegressionEvidenceEligibility(source){
 const match=source.match(/      - name: Preserve executed regression evidence\n([\s\S]*?)(?=\n      - name:|\n  [a-z])/);assert.ok(match,'REGRESSION_EVIDENCE_ELIGIBILITY_ORACLE: existing evidence step is missing');
 const condition=match[1].match(/        if: (.+)/)?.[1];assert.ok(condition,'REGRESSION_EVIDENCE_ELIGIBILITY_ORACLE: evidence eligibility must be explicit');
 const evaluate=Function('always','steps','return ('+condition+');');
 for(const outcome of ['success','failure','cancelled','skipped',''])assert.equal(evaluate(()=>true,{conformance:{outcome}}),['success','failure','cancelled'].includes(outcome),'REGRESSION_EVIDENCE_ELIGIBILITY_ORACLE: '+(outcome||'unstarted'));
 assert.match(source,/name: Shared production faults, bounded sequences, and executed observations\n        id: conformance\n/,'REGRESSION_EVIDENCE_ELIGIBILITY_ORACLE: predicate must bind the actual aggregate step');
 assert.match(match[1],/if-no-files-found: error/,'REGRESSION_EVIDENCE_ELIGIBILITY_ORACLE: missing executed evidence must fail');
}
assertRegressionEvidenceEligibility(workflow);
const regressionEvidenceFaults=[];
for(const [id,before,after] of [
 ['skipped-archive',"if: always() && (steps.conformance.outcome == 'success' || steps.conformance.outcome == 'failure' || steps.conformance.outcome == 'cancelled')",'if: always()'],
 ['lost-failure-archive'," || steps.conformance.outcome == 'failure'",''],
 ['lost-cancelled-archive'," || steps.conformance.outcome == 'cancelled'",'']
]){
 assert.ok(workflow.includes(before),'Missing evidence eligibility fault anchor: '+id);
 assert.throws(()=>assertRegressionEvidenceEligibility(workflow.replace(before,after)),/REGRESSION_EVIDENCE_ELIGIBILITY_ORACLE/);assertRegressionEvidenceEligibility(workflow);regressionEvidenceFaults.push({fault:id,result:'DETECTED',restored:'PASS'});
}
// Mutate the named evidence step itself. Its following step has no authority
// over whether missing execution evidence is rejected.
const evidenceStep=workflow.match(/      - name: Preserve executed regression evidence\n([\s\S]*?)(?=\n      - name:|\n  [a-z])/)[0];
assert.ok(evidenceStep.includes('if-no-files-found: error'),'Missing evidence eligibility fault anchor: silent-missing-evidence');
const silentMissingEvidence=workflow.replace(evidenceStep,evidenceStep.replace('if-no-files-found: error','if-no-files-found: warn'));
assert.throws(()=>assertRegressionEvidenceEligibility(silentMissingEvidence),/REGRESSION_EVIDENCE_ELIGIBILITY_ORACLE/);
assertRegressionEvidenceEligibility(workflow);regressionEvidenceFaults.push({fault:'silent-missing-evidence',result:'DETECTED',restored:'PASS'});
const journeyInvocations=[...workflow.matchAll(/run_browser_verifier verify-complete-operator-journey\.mjs (\d+)m/g)];
assert.equal(journeyInvocations.length,3,'Every candidate, main and re-verification journey remains required.');
assert.ok(journeyInvocations.every(match=>Number(match[1])===120),'All existing complete journeys require the same finite120m execution budget.');

for(const token of ['node verify-final-acceptance.mjs','const finalGate=evaluateFinalAcceptance(report,{visualBaseline,executedEvidence})','report.finalAcceptancePublication=finalGate.accepted','report.releaseTagEligible=finalGate.accepted',"if: steps.acceptance.outputs.final_acceptance == 'true'"])assert.throws(()=>assertPublicationWiring(workflow.replace(token,'')),error=>error.code==='ERR_ASSERTION');
const artifactFaults=[];
for(const prefix of ['deployed','reverified-deployed']){
 const token='name: '+prefix+'-operator-journeys-${{ github.sha }}-${{ github.run_id }}';
 assert.throws(()=>assertPublicationWiring(workflow.replace(token,'')),/DEPLOYED_JOURNEY_ARTIFACT_ORACLE/);assertPublicationWiring(workflow);artifactFaults.push({fault:'remove-'+prefix+'-archive',oracle:'DEPLOYED_JOURNEY_ARTIFACT_ORACLE',result:'DETECTED',restored:'PASS'});
}
console.log(JSON.stringify({finalAcceptanceGate:'PASS',normativeProofCases,runtimeAdmissionConsumerControls,coverageMetrics:35,zeroInvariants:38,mutationsDetected,metricMasksRejected:true,missingProofRejected:true,deviceAndVisualAuthorityRequired:true,repairedFixtureAccepted:true,intakeMetricCases,intakeMetricFaults,staticEvidenceFaults,artifactFaults,regressionEvidenceFaults,artifactEvidenceLimit:'Wiring and report-derivation regression only; underlying intake behavior, actual deployed artifact publication and byte verification execute separately.'}));
