import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const verifier=fileURLToPath(new URL('./verify-normative-governance.mjs',import.meta.url));
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const stableJson=value=>`${JSON.stringify(value,null,2)}\n`;
const makeRoot=()=>fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-governance-'));
const run=root=>spawnSync(process.execPath,[verifier],{encoding:'utf8',env:{...process.env,CLOSED_LOOP_GOVERNANCE_ROOT:root}});

function writeFixture(root,{omit49=false}={}){
  const dir=path.join(root,'specification');
  fs.mkdirSync(dir,{recursive:true});
  const spec='0. Controlling execution instruction\nRepository governance is required.\n\n49. Definition of done\nAll acceptance evidence must be closed.\n\n52. Final controlling rule\nClaims must not exceed evidence.\n';
  const specBytes=Buffer.from(spec,'utf8');
  const specSha=sha256(specBytes);
  const sections=[
    {section:'0',title:'Controlling execution instruction',line:1},
    {section:'49',title:'Definition of done',line:4},
    {section:'52',title:'Final controlling rule',line:7}
  ];
  const mk=(id,section,line)=>({
    normativeRequirementId:id,
    location:{section,startLine:line},
    responsibleImplementationOwner:'repository-ci',
    deterministicTestIds:[],semanticTestIds:[],mutationTestIds:[],
    browserOrPhysicalDeviceProof:'',acceptanceReportField:'normativeRequirementTraceCoverage',
    currentDisposition:'IMPLEMENTED_UNPROVEN'
  });
  const entries=[mk('NREQ-SECTION-0','0',2),...(!omit49?[mk('NREQ-SECTION-49','49',5)]:[]),mk('NREQ-SECTION-52','52',8)];
  const requirements={
    schema:'closed-loop-normative-requirements/1',
    specificationPath:'specification/closed-loop-reliability-controlling-implementation-specification.txt',
    specificationSha256:specSha,
    entries,
    nonnormativeSections:[],
    omissionChallenge:{
      draftExtractionStatus:'COMPLETE',
      independentReviewStatus:'ACCEPTED',
      reconciliationStatus:'ACCEPTED',
      independentReviewerIdentity:'fixture-independent-reviewer',
      reconciliationIdentity:'fixture-reconciler'
    }
  };
  const requirementBytes=Buffer.from(stableJson(requirements),'utf8');
  const manifest={
    schema:'closed-loop-specification-manifest/1',
    repositoryPath:'specification/closed-loop-reliability-controlling-implementation-specification.txt',
    artifactFilename:'closed-loop-reliability-controlling-implementation-specification.txt',
    byteLength:specBytes.length,
    sha256:specSha,
    sourceCommit:'fixture-source-commit',
    contractProfileId:'closed-loop-completion-profile/1',
    sectionInventory:sections,
    normativeRequirementManifestIdentity:'fixture-normative-manifest',
    normativeRequirementManifestSha256:sha256(requirementBytes)
  };
  fs.writeFileSync(path.join(dir,'closed-loop-reliability-controlling-implementation-specification.txt'),specBytes);
  fs.writeFileSync(path.join(dir,'closed-loop-normative-requirements.json'),requirementBytes);
  fs.writeFileSync(path.join(dir,'closed-loop-specification-manifest.json'),stableJson(manifest));
}

const validRoot=makeRoot();
writeFixture(validRoot);
const valid=run(validRoot);
assert.equal(valid.status,0,valid.stderr||valid.stdout);
const validResult=JSON.parse(valid.stdout);
assert.equal(validResult.sectionCount,3);
assert.equal(validResult.normativeRequirementCount,3);
assert.equal(validResult.finalAcceptanceEligible,false,'IMPLEMENTED_UNPROVEN entries must not become final acceptance.');

const uncoveredRoot=makeRoot();
writeFixture(uncoveredRoot,{omit49:true});
const uncovered=run(uncoveredRoot);
assert.notEqual(uncovered.status,0,'An intentionally uncovered specification section must be rejected.');
assert.match(uncovered.stderr,/section 49 is neither traced nor explicitly nonnormative/i);

const missingRoot=makeRoot();
const missing=run(missingRoot);
assert.notEqual(missing.status,0,'Missing governance artifacts must be rejected.');
assert.match(missing.stderr,/Missing required repository-governance artifact/);

for(const root of [validRoot,uncoveredRoot,missingRoot])fs.rmSync(root,{recursive:true,force:true});
console.log(JSON.stringify({normativeGovernanceContract:'PASS',validFixtureProgresses:true,uncoveredSectionMutationRejected:true,missingGovernanceRejected:true},null,2));
