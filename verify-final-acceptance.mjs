import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {evaluateFinalAcceptance,CORE_COVERAGE_KEYS,SECTION49_COVERAGE_KEYS,CORE_ZERO_KEYS,SECTION49_ZERO_KEYS} from './final-acceptance.mjs';
// Disposable publication fixture. This proves the gate, not a physical-device run.
const commit='a'.repeat(40),visual={status:'PROVEN',sourceCommit:'b'.repeat(40),comparedCommit:commit,comparisonResult:'PASS',evidenceReferences:['DISPOSABLE-VISUAL-EVIDENCE'],authority:'VISUAL_BASELINE_AUTHORIZATION'};
const fixture={commit,workflow:'mobile-closed-loop/30',contractProfileId:'closed-loop-completion-profile/1',projectSchema:'closed-loop-project/3',responseSchema:'closed-loop-stage-response/3',stageCount:30,stagesCompleted:30,coverageMetrics:{},section49CoverageMetrics:{},section49ZeroCountMetrics:{},section49ZeroCountInvariantCount:26,section49ZeroCountInvariantViolations:0,deployedByteIdentity:true,localChromiumAcceptance:true,deployedChromiumAcceptance:true,jobResults:{test:'success',deploy:'success',live:'success'},dataRouteClosure:'PASS',infrastructureRouteClosure:'PASS',actualIPhoneSafariAcceptance:true,mobileAcceptanceResult:'ACCEPTED',physicalIPhoneJobResult:'success',mobileAcceptanceSourceCommit:commit,mobileAcceptanceDeploymentManifestDigest:'c'.repeat(64),mobileAcceptanceOrigin:'https://sjonesjones917.github.io',mobileAcceptanceBasePath:'/closed-loop-tracker/',mobileAcceptanceTargetId:'DISPOSABLE-TARGET',mobileAcceptanceEvidenceId:'DISPOSABLE-EVIDENCE',mobileAcceptanceTestProjectId:'DISPOSABLE-PROJECT',mobileAcceptancePerformer:'DISPOSABLE-PERFORMER',mobileAcceptanceSubmitter:'DISPOSABLE-SUBMITTER',mobileAcceptancePhysicalDeviceAssertion:true,mobileAcceptanceEvidenceBasis:'HUMAN_OBSERVATION',mobileAcceptanceChallenge:'d'.repeat(64)};
assert.equal(CORE_COVERAGE_KEYS.length+SECTION49_COVERAGE_KEYS.length,35);
assert.equal(CORE_ZERO_KEYS.length+SECTION49_ZERO_KEYS.length,38);
for(const [group,keys] of [['coverageMetrics',CORE_COVERAGE_KEYS],['section49CoverageMetrics',SECTION49_COVERAGE_KEYS]])for(const key of keys){fixture[key]=1;fixture[group][key]={metricId:key,universeDefinition:'Two fixed disposable assertions',derivationVersion:'gate-fixture/1',scopeHash:commit,numerator:2,denominator:2,includedIds:[key+'-1',key+'-2'],excludedIds:[],evidenceReferences:['DISPOSABLE-EXECUTED-PROOF'],value:1,disposition:'SATISFIED'};}
for(const key of CORE_ZERO_KEYS)fixture[key]=0;for(const key of SECTION49_ZERO_KEYS)fixture.section49ZeroCountMetrics[key]=0;
const check=(r,v=visual)=>evaluateFinalAcceptance(r,{visualBaseline:v});assert.equal(check(fixture).accepted,true);
let mutationsDetected=0;
function reject(mutate,mutateVisual=null){const r=structuredClone(fixture),v=structuredClone(visual);mutate(r);mutateVisual?.(v);assert.equal(check(r,v).accepted,false,'Invalid publication fixture was accepted.');assert.equal(check(fixture).accepted,true,'Repair failed to restore progression.');mutationsDetected++;}
for(const [group,keys] of [['coverageMetrics',CORE_COVERAGE_KEYS],['section49CoverageMetrics',SECTION49_COVERAGE_KEYS]])for(const key of keys){
  for(const mutation of [r=>delete r[group][key],r=>r[group][key].numerator=1,r=>r[group][key].denominator=0,r=>r[group][key].includedIds=[],r=>r[group][key].includedIds=[key+'-1',key+'-1'],r=>r[group][key].evidenceReferences=[],r=>r[group][key].disposition='BLOCKED',r=>r[key]=0.5,r=>r[group][key].value=0.5,r=>delete r[group][key].derivationVersion])reject(mutation);
}
for(const key of CORE_ZERO_KEYS){reject(r=>delete r[key]);reject(r=>r[key]=1);}
for(const key of SECTION49_ZERO_KEYS){reject(r=>delete r.section49ZeroCountMetrics[key]);reject(r=>r.section49ZeroCountMetrics[key]=1);}
for(const key of ['deployedByteIdentity','localChromiumAcceptance','deployedChromiumAcceptance','actualIPhoneSafariAcceptance','mobileAcceptancePhysicalDeviceAssertion'])reject(r=>r[key]=false);
for(const key of ['test','deploy','live'])reject(r=>r.jobResults[key]='skipped');
for(const key of ['mobileAcceptanceTargetId','mobileAcceptanceEvidenceId','mobileAcceptanceTestProjectId','mobileAcceptancePerformer','mobileAcceptanceSubmitter'])reject(r=>delete r[key]);
reject(r=>r.mobileAcceptanceSourceCommit='e'.repeat(40));reject(r=>r.mobileAcceptanceEvidenceBasis='SELF_ASSERTED');reject(r=>r.mobileAcceptanceChallenge='short');
reject(()=>{},v=>v.status='OPEN');reject(()=>{},v=>v.comparedCommit='e'.repeat(40));reject(()=>{},v=>v.evidenceReferences=[]);
// The formerly green summary cannot hide 1/2 detailed evidence.
reject(r=>{r.section49CoverageMetrics.stage01RawInputAccounting.numerator=1;r.section49CoverageMetrics.stage01RawInputAccounting.value=0.5;r.stage01RawInputAccounting=1;});

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
  assert.match(source,/const finalGate=evaluateFinalAcceptance\(report,\{visualBaseline\}\)/);
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
for(const token of ['node verify-final-acceptance.mjs','const finalGate=evaluateFinalAcceptance(report,{visualBaseline})','report.finalAcceptancePublication=finalGate.accepted','report.releaseTagEligible=finalGate.accepted',"if: steps.acceptance.outputs.final_acceptance == 'true'"])assert.throws(()=>assertPublicationWiring(workflow.replace(token,'')));
const artifactFaults=[];
for(const prefix of ['deployed','reverified-deployed']){
 const token='name: '+prefix+'-operator-journeys-${{ github.sha }}-${{ github.run_id }}';
 assert.throws(()=>assertPublicationWiring(workflow.replace(token,'')),/DEPLOYED_JOURNEY_ARTIFACT_ORACLE/);assertPublicationWiring(workflow);artifactFaults.push({fault:'remove-'+prefix+'-archive',oracle:'DEPLOYED_JOURNEY_ARTIFACT_ORACLE',result:'DETECTED',restored:'PASS'});
}
console.log(JSON.stringify({finalAcceptanceGate:'PASS',coverageMetrics:35,zeroInvariants:38,mutationsDetected,metricMasksRejected:true,missingProofRejected:true,deviceAndVisualAuthorityRequired:true,repairedFixtureAccepted:true,intakeMetricCases,intakeMetricFaults,artifactFaults,artifactEvidenceLimit:'Wiring and report-derivation regression only; underlying intake behavior, actual deployed artifact publication and byte verification execute separately.'}));
