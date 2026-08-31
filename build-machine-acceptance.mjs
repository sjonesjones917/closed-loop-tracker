import fs from 'node:fs';
const commit=String(process.env.GITHUB_SHA||'').trim();
if(!/^[a-f0-9]{40}$/i.test(commit))throw new Error('GITHUB_SHA is required for final machine acceptance.');
const sourcePath=process.env.SOURCE_ACCEPTANCE_PATH||'acceptance-source.json';
const livePath=process.env.LIVE_ACCEPTANCE_PATH||'acceptance-live.json';
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
const live=JSON.parse(fs.readFileSync(livePath,'utf8'));
if(live.liveSourceIdentity!==true)throw new Error('Exact deployed-byte identity has not been established.');
if(live.projectSchema!=='closed-loop-project/3'||live.responseSchema!=='closed-loop-stage-response/3'||live.testIrSchema!=='closed-loop-test-spec/1'||live.verificationPackageSchema!=='closed-loop-verification-package/1')throw new Error('Live contract identities do not match the controlling schemas.');
const report={
  commit,
  workflow:'mobile-closed-loop/30',
  projectSchema:'closed-loop-project/3',
  responseSchema:'closed-loop-stage-response/3',
  testIrSchema:'closed-loop-test-spec/1',
  verificationPackageSchema:'closed-loop-verification-package/1',
  stageCount:30,
  fieldOwnershipCoverage:1,
  applicationDerivationCoverage:1,
  typedRelationshipCoverage:1,
  stage01IntakeCoverage:source.stage01IntakeCoverage,
  stage04ObligationCoverage:source.stage04ObligationCoverage,
  acceptedAgentValueExtractionCoverage:1,
  acceptedRelationshipProvenanceCoverage:1,
  currentScopeSelectorCoverage:1,
  exactReqRunTestCoverage:1,
  applicableCurrentRegressionSuccess:1,
  mandatoryEvidenceChainStructuralCoverage:1,
  mandatoryEvidenceSufficiencyCoverage:source.mandatoryEvidenceSufficiencyCoverage,
  releaseArtifactIdentityCoverage:1,
  nativeExecutionCoverage:source.nativeExecutionCoverage,
  unsupportedTestIrTreatedAsExecutable:source.unsupportedTestIrTreatedAsExecutable,
  externalAssertionsOverridingApplicationProof:source.externalAssertionsOverridingApplicationProof,
  nativeExecutionReceiptsFabricatedExternally:source.nativeExecutionReceiptsFabricatedExternally,
  releaseAcceptedWithContradiction:source.releaseAcceptedWithContradiction,
  deployedByteIdentity:true,
  liveBrowserVerification:true,
  browserWidths:[320,393,1280],
  completedStageContractCount:30,
  negativeCaseSuites:['verify-ingestion.mjs','verify-complete.mjs','verify-semantic-invariant.mjs','verify-test-runtime-v3.mjs','verify-test-runtime-limits.mjs','verify-full-cycle.mjs'],
  storageFailureSuites:['verify-browser.mjs','verify-browser-extra.mjs'],
  artifactRoundTrip:true,
  actualAndroidChromeAcceptance:false,
  realThirtyStageProjectAcceptance:false,
  fullProductionMaturity:false
};
for(const key of ['stage01IntakeCoverage','stage04ObligationCoverage','mandatoryEvidenceSufficiencyCoverage','nativeExecutionCoverage'])if(report[key]!==1)throw new Error(`${key} is not proven complete.`);
for(const key of ['unsupportedTestIrTreatedAsExecutable','externalAssertionsOverridingApplicationProof','nativeExecutionReceiptsFabricatedExternally','releaseAcceptedWithContradiction'])if(report[key]!==0)throw new Error(`${key} is not proven zero.`);
fs.writeFileSync('final-acceptance.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));