import fs from 'node:fs';
import assert from 'node:assert/strict';
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
console.log(JSON.stringify({finalAcceptanceGate:'PASS',coverageMetrics:35,zeroInvariants:38,mutationsDetected,metricMasksRejected:true,missingProofRejected:true,deviceAndVisualAuthorityRequired:true,repairedFixtureAccepted:true}));

const workflow=fs.readFileSync(new URL('./.github/workflows/pages.yml',import.meta.url),'utf8');
function assertPublicationWiring(source){
  assert.match(source,/node verify-final-acceptance\.mjs/);
  assert.match(source,/const finalGate=evaluateFinalAcceptance\(report,\{visualBaseline\}\)/);
  assert.match(source,/report\.finalAcceptancePublication=finalGate\.accepted/);
  assert.match(source,/report\.releaseTagEligible=finalGate\.accepted/);
  assert.match(source,/if: steps\.acceptance\.outputs\.final_acceptance == 'true'/);
}
assertPublicationWiring(workflow);
for(const token of ['node verify-final-acceptance.mjs','const finalGate=evaluateFinalAcceptance(report,{visualBaseline})','report.finalAcceptancePublication=finalGate.accepted','report.releaseTagEligible=finalGate.accepted',"if: steps.acceptance.outputs.final_acceptance == 'true'"])assert.throws(()=>assertPublicationWiring(workflow.replace(token,'')));
