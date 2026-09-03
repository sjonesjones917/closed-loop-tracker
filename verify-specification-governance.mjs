import fs from 'node:fs';
import crypto from 'node:crypto';
import childProcess from 'node:child_process';

const SPEC='specification/closed-loop-reliability-controlling-implementation-specification.txt';
const SPEC_MANIFEST='specification/closed-loop-specification-manifest.json';
const NORMATIVE='specification/closed-loop-normative-requirements.json';
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

assert(fs.existsSync(SPEC),'Required controlling specification source is absent.');
childProcess.execFileSync(process.execPath,['generate-specification-governance.mjs'],{stdio:'pipe',env:{...process.env,SOURCE_COMMIT:process.env.SOURCE_COMMIT||childProcess.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()}});
assert(fs.existsSync(SPEC_MANIFEST),'Specification manifest was not generated.');
assert(fs.existsSync(NORMATIVE),'Normative-requirement manifest was not generated.');

const sourceBytes=fs.readFileSync(SPEC);
const specManifest=JSON.parse(fs.readFileSync(SPEC_MANIFEST,'utf8'));
const normative=JSON.parse(fs.readFileSync(NORMATIVE,'utf8'));

const validate=(spec,norm)=>{
  assert(spec.schema==='closed-loop-specification-manifest/1','Wrong specification-manifest schema.');
  assert(norm.schema==='closed-loop-normative-requirements/1','Wrong normative-manifest schema.');
  assert(spec.contractProfileId==='closed-loop-completion-profile/1','Wrong contract profile in specification manifest.');
  assert(norm.contractProfileId==='closed-loop-completion-profile/1','Wrong contract profile in normative manifest.');
  assert(spec.repositoryPath===SPEC,'Wrong controlling specification path.');
  assert(spec.byteLength===sourceBytes.length,'Specification byte length is not bound to actual source bytes.');
  assert(spec.sha256===sha256(sourceBytes),'Specification SHA-256 is not bound to actual source bytes.');
  assert(norm.sourceByteLength===sourceBytes.length&&norm.sourceSha256===spec.sha256,'Normative manifest source identity differs from specification manifest.');
  assert(spec.normativeRequirementManifest?.path===NORMATIVE,'Specification manifest points to wrong normative manifest path.');
  assert(spec.normativeRequirementManifest?.sha256===norm.manifestSha256,'Normative manifest digest is not cross-bound.');
  assert(Array.isArray(spec.sectionInventory)&&spec.sectionInventory.length>0,'Section inventory is absent.');
  assert(Array.isArray(norm.requirements)&&norm.requirements.length>0,'Normative requirement inventory is empty.');
  assert(norm.challengeEvidence?.status==='RECONCILED','Independent omission challenge is not reconciled.');
  assert(Array.isArray(norm.challengeEvidence?.review)&&norm.challengeEvidence.review.length===spec.sectionInventory.length,'Independent section coverage challenge is incomplete.');
  assert(Array.isArray(norm.challengeEvidence?.reconciliation)&&norm.challengeEvidence.reconciliation.length===spec.sectionInventory.length,'Challenge reconciliation is incomplete.');
  const ids=new Set();
  for(const entry of norm.requirements){
    assert(entry.normativeRequirementId&&!ids.has(entry.normativeRequirementId),`Missing or duplicate normative requirement ID ${entry.normativeRequirementId||'<missing>'}.`);
    ids.add(entry.normativeRequirementId);
    assert(entry.sourceLocation?.path===SPEC,'Normative requirement is not traced to controlling source path.');
    assert(Number.isInteger(entry.sourceLocation?.startLine)&&entry.sourceLocation.startLine>0,'Normative requirement lacks a valid source line.');
    assert(entry.implementationOwner,'Normative requirement lacks implementation owner.');
    assert(Array.isArray(entry.deterministicTestIds)&&entry.deterministicTestIds.length>0,'Normative requirement lacks deterministic proof trace.');
    assert(Array.isArray(entry.mutationTestIds)&&entry.mutationTestIds.length>0,'Normative requirement lacks mutation-proof trace.');
    assert(entry.acceptanceReportField,'Normative requirement lacks acceptance-report trace.');
    assert(entry.currentDisposition,'Normative requirement lacks current disposition.');
  }
  for(const section of spec.sectionInventory){
    const covered=(section.normativeRequirementIds||[]).length>0;
    const nonnormative=section.disposition==='NONNORMATIVE'&&typeof section.nonnormativeReason==='string'&&section.nonnormativeReason.length>0;
    assert(covered||nonnormative,`Uncovered specification section ${section.sectionId}.`);
    for(const id of section.normativeRequirementIds||[])assert(ids.has(id),`Section ${section.sectionId} references missing normative requirement ${id}.`);
  }
  const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','test-worker.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js','index.html','TEST_PROJECT.json'];
  const sentinel='Closed-Loop Reliability Application\nZero-Loss Controlling Implementation Specification';
  for(const path of runtimeFiles){
    if(!fs.existsSync(path))continue;
    const text=fs.readFileSync(path,'utf8');
    assert(!text.includes(sentinel),`Controlling specification text leaked into runtime file ${path}.`);
    assert(!text.includes('closed-loop-monotonic-build-controller/1'),`Implementation controller leaked into runtime file ${path}.`);
  }
  const promptSource=fs.readFileSync('prompt-engine.js','utf8');
  assert(!promptSource.includes('MONOTONIC IMPLEMENTATION BUILD CONTROLLER'),'Implementation controller text leaked into external prompt authority.');
  return true;
};

validate(specManifest,normative);

// Test the test: an intentional uncovered-section mutation must be rejected.
const mutated=JSON.parse(JSON.stringify(specManifest));
const target=mutated.sectionInventory.find(section=>(section.normativeRequirementIds||[]).length>0)||mutated.sectionInventory[0];
target.normativeRequirementIds=[];
target.disposition='COVERED';
target.nonnormativeReason=null;
let mutationRejected=false;
try{validate(mutated,normative);}catch(error){mutationRejected=/Uncovered specification section/.test(String(error?.message||error));}
assert(mutationRejected,'Intentional uncovered-section mutation was not rejected by governance verification.');

console.log(JSON.stringify({
  specificationSourcePresent:true,
  sourceByteLength:sourceBytes.length,
  sourceSha256:sha256(sourceBytes),
  sectionCount:specManifest.sectionInventory.length,
  normativeRequirementCount:normative.requirements.length,
  independentOmissionChallenge:true,
  reconciliationComplete:true,
  runtimeSpecificationCopies:0,
  runtimeControllerCopies:0,
  intentionalUncoveredSectionMutationRejected:true,
  stage01GovernanceProof:'PASS'
},null,2));
