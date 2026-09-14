import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createMobileAcceptanceTarget} from './generate-mobile-acceptance-target.mjs';
import {verifyMobileAcceptanceEvidence} from './verify-mobile-acceptance-evidence.mjs';
import {syntheticMobileOperations} from './mobile-evidence-test-fixture.mjs';

// Disposable validator fixtures: human/device facts below are synthetic values.
// The result proves rejection behavior, never actual physical-device acceptance.
const target=createMobileAcceptanceTarget({sourceCommit:'a'.repeat(40),deploymentManifestDigest:'b'.repeat(64),origin:'https://sjonesjones917.github.io',basePath:'/closed-loop-tracker/',testProjectId:'DISPOSABLE-RECEIPT-BOUNDARY',procedureVersion:'actual-iphone-safari/1',viewport:{width:393,height:852,devicePixelRatio:3},deviceModel:'UNKNOWN',iosVersion:'19.0',safariVersion:'19.0',safariUserAgent:'Mozilla/5.0 (iPhone) Safari/604.1',issuedAt:'2026-09-14T00:00:00.000Z'});
const evidence={...target,...syntheticMobileOperations(target),mobileAcceptanceEvidenceId:'SYNTHETIC-EVIDENCE',physicalDeviceAssertion:true,evidenceBasis:'HUMAN_OBSERVATION',performer:'SYNTHETIC-PERFORMER',identityAssurance:'SELF_ASSERTED',runtimeFindings:{runtimeExceptions:0,unhandledRejections:0},measurements:{horizontalOverflowPx:0,minimumPrimaryTextPx:16,minimumSecondaryTextPx:14,minimumTouchTargetPx:44},exportedProjectDigest:'b'.repeat(64),screenshotOrRecordingReferences:['SYNTHETIC-REFERENCE']};
const expected={verificationTime:'2026-09-14T00:30:00.000Z',buildIdentity:evidence.buildIdentity};
const run=(e,verify=verifyMobileAcceptanceEvidence)=>verify({target,evidence:e,expected});
assert.equal(run(evidence).accepted,true,JSON.stringify(run(evidence).errors));
const cases=[];
function reject(id,change,code){const negative=structuredClone(evidence);change(negative);const result=run(negative);assert.equal(result.accepted,false,id+' was accepted');assert(result.errors.some(e=>e.code===code),id+' rejected for the wrong reason: '+JSON.stringify(result.errors));assert.equal(run(evidence).accepted,true,id+' failed to recover');cases.push({caseId:id,violation:code,rejected:true,repaired:true,result:'PASS'});}
for(const original of evidence.operationReceipts){
 const receipt=e=>e.operationReceipts.find(r=>r.kind===original.kind);
 reject(original.kind+'-MISSING-OBSERVATION',e=>{delete receipt(e).observation;},'RECEIPT_OBSERVATION_REQUIRED');
 reject(original.kind+'-WRONG-CHALLENGE',e=>{receipt(e).challenge='0'.repeat(64);},'RECEIPT_BINDING_MISMATCH');
 reject(original.kind+'-UNRELATED-OBSERVATION',e=>{receipt(e).observation={declaredSuccess:true};},'RECEIPT_OPERATION_EVIDENCE_INVALID');
}
reject('PROBE-API-FLAGS-ONLY',e=>{delete e.mobileCapabilityProbe.observations;},'MOBILE_CAPABILITY_OBSERVATIONS_REQUIRED');
reject('PROBE-MISSING-EXPORTED-BACKUP',e=>{delete e.mobileCapabilityProbe.observations.backupRestore;},'MOBILE_CAPABILITY_BACKUP_OBSERVATION_REQUIRED');
reject('PROBE-WRONG-PROJECT',e=>{e.mobileCapabilityProbe.testProjectId='OTHER';},'MOBILE_CAPABILITY_BINDING_MISMATCH');
reject('BACKUP-DIGEST-DIFFERS',e=>{e.exportedProjectDigest='0'.repeat(64);},'EXPORTED_PROJECT_RECEIPT_MISMATCH');
const source=fs.readFileSync('verify-mobile-acceptance-evidence.mjs','utf8');
const fault=source.split('\n').filter(line=>!line.includes("issue(errors,'RECEIPT_OBSERVATION_REQUIRED'")&&!line.includes("issue(errors,'RECEIPT_OPERATION_EVIDENCE_INVALID'")).join('\n');
assert.notEqual(fault,source,'Observation-validation fault was not applied.');
const mutant=await import('data:text/javascript;base64,'+Buffer.from(fault).toString('base64'));
const broken=structuredClone(evidence);delete broken.operationReceipts[0].observation;
assert.throws(()=>assert.equal(run(broken,mutant.verifyMobileAcceptanceEvidence).accepted,false,'Counterfeit receipt accepted'),/Counterfeit receipt accepted/,'The negative test did not detect bypassed observation validation.');
assert.equal(run(broken).accepted,false);assert.equal(run(evidence).accepted,true);
console.log(JSON.stringify({schema:'closed-loop-executed-cases/1',synthetic:true,physicalDeviceAcceptance:false,environment:'Node; disposable mobile evidence validator cases',cases,implementationFaults:[{faultId:'BYPASS-OPERATION-OBSERVATION-VALIDATION',detected:true,originalRestored:true}]},null,2));
