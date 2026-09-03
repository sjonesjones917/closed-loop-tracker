import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=process.env.CLOSED_LOOP_GOVERNANCE_ROOT||'.';
const rel={
  specification:'specification/closed-loop-reliability-controlling-implementation-specification.txt',
  specificationManifest:'specification/closed-loop-specification-manifest.json',
  requirements:'specification/closed-loop-normative-requirements.json'
};
const SPEC_PATH=path.join(ROOT,rel.specification);
const SPEC_MANIFEST_PATH=path.join(ROOT,rel.specificationManifest);
const REQUIREMENTS_PATH=path.join(ROOT,rel.requirements);
const ALLOWED_DISPOSITIONS=new Set(['CONFORMANT_PROVEN','IMPLEMENTED_UNPROVEN','MISSING','CONTRADICTED','BLOCKED_HUMAN','BLOCKED_ENVIRONMENT','UNKNOWN']);
const fail=message=>{throw new Error(message);};
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const readJson=file=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(error){fail(`${file} is not valid UTF-8 JSON: ${error.message}`);}};

for(const file of [SPEC_PATH,SPEC_MANIFEST_PATH,REQUIREMENTS_PATH])if(!fs.existsSync(file))fail(`Missing required repository-governance artifact: ${file}`);
const specificationBytes=fs.readFileSync(SPEC_PATH);
if(!specificationBytes.length)fail('The controlling specification is empty.');
if(specificationBytes[0]===0xef&&specificationBytes[1]===0xbb&&specificationBytes[2]===0xbf)fail('The controlling specification must be UTF-8 without BOM.');
const specificationText=new TextDecoder('utf-8',{fatal:true}).decode(specificationBytes);
const specificationSha256=sha256(specificationBytes);
const sectionMatches=[...specificationText.matchAll(/^(\d+(?:\.\d+[A-Z]?)?)\.\s+(.+)$/gm)];
const sectionInventory=sectionMatches.map(match=>({section:match[1],title:match[2].trim(),line:specificationText.slice(0,match.index).split('\n').length}));
for(const required of ['0','49','52'])if(!sectionInventory.some(entry=>entry.section===required))fail(`Specification Section ${required} was not found.`);

const specificationManifest=readJson(SPEC_MANIFEST_PATH);
if(specificationManifest.schema!=='closed-loop-specification-manifest/1')fail('Wrong specification-manifest schema.');
if(specificationManifest.repositoryPath!==rel.specification)fail('Specification manifest repositoryPath mismatch.');
if(specificationManifest.artifactFilename!==rel.specification.split('/').at(-1))fail('Specification manifest artifactFilename mismatch.');
if(specificationManifest.byteLength!==specificationBytes.length)fail('Specification manifest byteLength mismatch.');
if(specificationManifest.sha256!==specificationSha256)fail('Specification manifest SHA-256 mismatch.');
if(specificationManifest.contractProfileId!=='closed-loop-completion-profile/1')fail('Specification manifest contract profile mismatch.');
if(!String(specificationManifest.sourceCommit||'').trim())fail('Specification manifest sourceCommit is missing.');
if(!String(specificationManifest.normativeRequirementManifestIdentity||specificationManifest.normativeRequirementManifestId||'').trim())fail('Specification manifest normative-requirement manifest identity is missing.');
if(!String(specificationManifest.normativeRequirementManifestSha256||'').match(/^[0-9a-f]{64}$/))fail('Specification manifest normative-requirement manifest digest is missing or invalid.');
if(!Array.isArray(specificationManifest.sectionInventory)||!specificationManifest.sectionInventory.length)fail('Specification manifest section inventory is missing.');
const manifestSectionKeys=new Set(specificationManifest.sectionInventory.map(entry=>String(entry.section)));
for(const entry of sectionInventory)if(!manifestSectionKeys.has(entry.section))fail(`Specification manifest omits section ${entry.section}.`);

const requirementBytes=fs.readFileSync(REQUIREMENTS_PATH);
const requirements=readJson(REQUIREMENTS_PATH);
if(requirements.schema!=='closed-loop-normative-requirements/1')fail('Wrong normative-requirement-manifest schema.');
if(requirements.specificationPath!==rel.specification)fail('Normative manifest specificationPath mismatch.');
if(requirements.specificationSha256!==specificationSha256)fail('Normative manifest specification SHA-256 mismatch.');
if(specificationManifest.normativeRequirementManifestSha256!==sha256(requirementBytes))fail('Specification manifest normative-requirement digest does not match the exact manifest bytes.');
if(!Array.isArray(requirements.entries)||!requirements.entries.length)fail('Normative manifest has no entries.');
const requirementIds=new Set();
for(const entry of requirements.entries){
  if(!entry||typeof entry!=='object')fail('Normative manifest contains a non-object entry.');
  const id=String(entry.normativeRequirementId||'');
  if(!/^NREQ-[A-Z0-9][A-Z0-9._-]*$/.test(id))fail(`Invalid NORMATIVE_REQUIREMENT_ID: ${id}`);
  if(requirementIds.has(id))fail(`Duplicate NORMATIVE_REQUIREMENT_ID: ${id}`);requirementIds.add(id);
  if(!entry.location||!String(entry.location.section||'').trim()||!Number.isInteger(entry.location.startLine)||entry.location.startLine<1)fail(`Requirement ${id} lacks a valid source location.`);
  if(!String(entry.responsibleImplementationOwner||entry.implementationOwner||'').trim())fail(`Requirement ${id} lacks a responsible implementation owner.`);
  if(!ALLOWED_DISPOSITIONS.has(entry.currentDisposition))fail(`Requirement ${id} has invalid currentDisposition ${entry.currentDisposition}.`);
  for(const arrayField of ['deterministicTestIds','semanticTestIds','mutationTestIds'])if(entry[arrayField]!==undefined&&!Array.isArray(entry[arrayField]))fail(`Requirement ${id} ${arrayField} must be an array when present.`);
  if(entry.currentDisposition==='CONFORMANT_PROVEN'){
    const proofLinks=[...(entry.deterministicTestIds||[]),...(entry.semanticTestIds||[]),...(entry.mutationTestIds||[])];
    if(!proofLinks.length&&!String(entry.browserOrPhysicalDeviceProof||entry.requiredBrowserOrPhysicalDeviceProof||'').trim())fail(`CONFORMANT_PROVEN requirement ${id} has no test or browser/device proof relationship.`);
    if(!String(entry.acceptanceReportField||'').trim())fail(`CONFORMANT_PROVEN requirement ${id} lacks acceptanceReportField.`);
  }
}
const coveredSections=new Set(requirements.entries.map(entry=>String(entry.location?.section||'')));
const nonnormativeSections=new Map((requirements.nonnormativeSections||[]).map(entry=>[String(entry.section||''),String(entry.reason||'').trim()]));
for(const entry of sectionInventory){if(!coveredSections.has(entry.section)&&!nonnormativeSections.has(entry.section))fail(`Specification section ${entry.section} is neither traced nor explicitly nonnormative.`);if(nonnormativeSections.has(entry.section)&&!nonnormativeSections.get(entry.section))fail(`Nonnormative section ${entry.section} lacks a reason.`);}
const challenge=requirements.omissionChallenge;
if(!challenge||typeof challenge!=='object')fail('Normative manifest lacks omission-challenge evidence.');
for(const field of ['draftExtractionStatus','independentReviewStatus','reconciliationStatus'])if(!challenge[field])fail(`Normative manifest omission challenge lacks ${field}.`);
if(!String(challenge.independentReviewerIdentity||challenge.independentReviewEvidence||'').trim())fail('Normative manifest lacks independent-review identity/evidence.');
if(!String(challenge.reconciliationIdentity||challenge.reconciliationEvidence||'').trim())fail('Normative manifest lacks reconciliation identity/evidence.');
const unresolved=requirements.entries.filter(entry=>entry.currentDisposition!=='CONFORMANT_PROVEN');
const finalAcceptanceEligible=challenge.independentReviewStatus==='ACCEPTED'&&challenge.reconciliationStatus==='ACCEPTED'&&unresolved.length===0;
const result={specificationPath:rel.specification,specificationByteLength:specificationBytes.length,specificationSha256,sectionCount:sectionInventory.length,normativeRequirementCount:requirements.entries.length,unresolvedDispositionCount:unresolved.length,omissionChallenge:{draftExtractionStatus:challenge.draftExtractionStatus,independentReviewStatus:challenge.independentReviewStatus,reconciliationStatus:challenge.reconciliationStatus},finalAcceptanceEligible};
if(process.argv.includes('--require-final-acceptance')&&!finalAcceptanceEligible)fail(`Final acceptance is blocked: independentReviewStatus=${challenge.independentReviewStatus}, reconciliationStatus=${challenge.reconciliationStatus}, unresolvedDispositionCount=${unresolved.length}.`);
process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
