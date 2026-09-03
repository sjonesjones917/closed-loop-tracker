import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyNormativeGovernance,SPEC_PATH,SPEC_MANIFEST_PATH,REQUIREMENTS_PATH} from './verify-normative-governance.mjs';
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const canonical=value=>JSON.stringify(value,null,2)+'\n';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-governance-'));
const write=(relative,data)=>{const file=path.join(temp,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);return file;};
const spec='0. Controlling execution instruction\nThe implementation MUST fail closed.\n\n49. Definition of done\nCoverage MUST be 100%.\n\n52. Final controlling rule\nThe application MUST preserve the contract.\n';
const specBytes=Buffer.from(spec,'utf8'),specSha=sha256(specBytes);write(SPEC_PATH,specBytes);
const requirements={schema:'closed-loop-normative-requirements/1',specificationPath:SPEC_PATH,specificationSha256:specSha,entries:[
  {normativeRequirementId:'NREQ-0-1',location:{section:'0',startLine:2},controllingText:'The implementation MUST fail closed.',responsibleImplementationOwner:'verification',deterministicTestIds:['TEST-GOV-1'],semanticTestIds:[],mutationTestIds:['MUT-GOV-1'],requiresMutationProof:true,browserOrPhysicalDeviceProof:'',acceptanceReportField:'governance.failClosed',currentDisposition:'CONFORMANT_PROVEN'},
  {normativeRequirementId:'NREQ-49-1',location:{section:'49',startLine:5},controllingText:'Coverage MUST be 100%.',responsibleImplementationOwner:'verification',deterministicTestIds:['TEST-GOV-2'],semanticTestIds:[],mutationTestIds:['MUT-GOV-2'],requiresMutationProof:true,browserOrPhysicalDeviceProof:'',acceptanceReportField:'governance.coverage',currentDisposition:'CONFORMANT_PROVEN'},
  {normativeRequirementId:'NREQ-52-1',location:{section:'52',startLine:8},controllingText:'The application MUST preserve the contract.',responsibleImplementationOwner:'workflow-engine.js',deterministicTestIds:['TEST-GOV-3'],semanticTestIds:[],mutationTestIds:['MUT-GOV-3'],requiresMutationProof:true,browserOrPhysicalDeviceProof:'',acceptanceReportField:'governance.contract',currentDisposition:'CONFORMANT_PROVEN'}
],nonnormativeSections:[],omissionChallenge:{draftExtractorIdentity:'EXTRACTOR-A',draftExtractionStatus:'COMPLETE',independentReviewerIdentity:'REVIEWER-B',independentReviewStatus:'ACCEPTED',independentReviewEvidence:'independent section-by-section extraction',reconciliationIdentity:'RECONCILER-C',reconciliationStatus:'ACCEPTED',reconciliationEvidence:'all differences reconciled',unreconciledMaterialDifferences:[]}};
const reqBytes=Buffer.from(canonical(requirements));write(REQUIREMENTS_PATH,reqBytes);
const sectionInventory=[{section:'0',title:'Controlling execution instruction',line:1},{section:'49',title:'Definition of done',line:4},{section:'52',title:'Final controlling rule',line:7}];
const manifest={schema:'closed-loop-specification-manifest/1',sourceCommit:'SYNTHETIC-COMMIT',repositoryPath:SPEC_PATH,artifactFilename:path.basename(SPEC_PATH),byteLength:specBytes.length,sha256:specSha,sectionInventory,contractProfileId:'closed-loop-completion-profile/1',normativeRequirementManifestIdentity:'SYNTHETIC-NORMATIVE-MANIFEST',normativeRequirementManifestSha256:sha256(reqBytes)};write(SPEC_MANIFEST_PATH,canonical(manifest));
const baseline=verifyNormativeGovernance({root:temp,requireFinalAcceptance:true});assert.equal(baseline.finalAcceptanceEligible,true);
const cases=[];const rewriteRequirements=x=>{const b=Buffer.from(canonical(x));fs.writeFileSync(path.join(temp,REQUIREMENTS_PATH),b);const m=JSON.parse(fs.readFileSync(path.join(temp,SPEC_MANIFEST_PATH),'utf8'));m.normativeRequirementManifestSha256=sha256(b);fs.writeFileSync(path.join(temp,SPEC_MANIFEST_PATH),canonical(m));};
const mutate=(name,fn,code)=>{const reqBefore=fs.readFileSync(path.join(temp,REQUIREMENTS_PATH)),manifestBefore=fs.readFileSync(path.join(temp,SPEC_MANIFEST_PATH));try{fn();let rejected=false;try{verifyNormativeGovernance({root:temp,requireFinalAcceptance:true});}catch(error){rejected=true;if(code)assert.equal(error.code,code);}assert.equal(rejected,true,`${name} mutation was not rejected.`);cases.push(name);}finally{fs.writeFileSync(path.join(temp,REQUIREMENTS_PATH),reqBefore);fs.writeFileSync(path.join(temp,SPEC_MANIFEST_PATH),manifestBefore);}};
mutate('missing governance artifact',()=>fs.renameSync(path.join(temp,REQUIREMENTS_PATH),path.join(temp,REQUIREMENTS_PATH)+'.tmp'),'MISSING_GOVERNANCE_ARTIFACT');fs.renameSync(path.join(temp,REQUIREMENTS_PATH)+'.tmp',path.join(temp,REQUIREMENTS_PATH));
mutate('uncovered specification section',()=>{const x=JSON.parse(fs.readFileSync(path.join(temp,REQUIREMENTS_PATH),'utf8'));x.entries=x.entries.filter(e=>e.location.section!=='49');rewriteRequirements(x);});
mutate('duplicate requirement identity',()=>{const x=JSON.parse(fs.readFileSync(path.join(temp,REQUIREMENTS_PATH),'utf8'));x.entries.push({...x.entries[0],location:{section:'0',startLine:3},distinctAtSameLocation:true});rewriteRequirements(x);});
mutate('self review',()=>{const x=JSON.parse(fs.readFileSync(path.join(temp,REQUIREMENTS_PATH),'utf8'));x.omissionChallenge.independentReviewerIdentity=x.omissionChallenge.draftExtractorIdentity;rewriteRequirements(x);});
mutate('unproven conformant entry',()=>{const x=JSON.parse(fs.readFileSync(path.join(temp,REQUIREMENTS_PATH),'utf8'));x.entries[0].deterministicTestIds=[];x.entries[0].mutationTestIds=[];x.entries[0].browserOrPhysicalDeviceProof='';rewriteRequirements(x);});
fs.rmSync(temp,{recursive:true,force:true});
console.log(JSON.stringify({normativeGovernanceVerifier:'PASS',validFixtureAccepted:true,intentionalInvalidFixturesRejected:cases.length,mutations:cases},null,2));
