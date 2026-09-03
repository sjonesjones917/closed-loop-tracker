import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const SPEC_PATH='specification/closed-loop-reliability-controlling-implementation-specification.txt';
export const SPEC_MANIFEST_PATH='specification/closed-loop-specification-manifest.json';
export const REQUIREMENTS_PATH='specification/closed-loop-normative-requirements.json';
export const ALLOWED_DISPOSITIONS=Object.freeze(new Set(['CONFORMANT_PROVEN','IMPLEMENTED_UNPROVEN','MISSING','CONTRADICTED','BLOCKED_HUMAN','BLOCKED_ENVIRONMENT','UNKNOWN']));
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const fail=(message,code='NORMATIVE_GOVERNANCE_INVALID')=>{const error=new Error(message);error.code=code;throw error;};
const readJson=file=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(error){fail(`${file} is not valid UTF-8 JSON: ${error.message}`,'INVALID_GOVERNANCE_JSON');}};
const asText=value=>String(value??'').trim();
const proofIds=entry=>[...(entry.deterministicTestIds||[]),...(entry.semanticTestIds||[]),...(entry.mutationTestIds||[])].map(asText).filter(Boolean);

export function verifyNormativeGovernance({root=process.cwd(),requireFinalAcceptance=false}={}){
  const resolve=relative=>path.join(root,relative),specFile=resolve(SPEC_PATH),manifestFile=resolve(SPEC_MANIFEST_PATH),requirementsFile=resolve(REQUIREMENTS_PATH);
  for(const file of [specFile,manifestFile,requirementsFile])if(!fs.existsSync(file))fail(`Missing required repository-governance artifact: ${path.relative(root,file)}`,'MISSING_GOVERNANCE_ARTIFACT');
  const specificationBytes=fs.readFileSync(specFile);
  if(!specificationBytes.length)fail('The controlling specification is empty.','EMPTY_SPECIFICATION');
  if(specificationBytes[0]===0xef&&specificationBytes[1]===0xbb&&specificationBytes[2]===0xbf)fail('The controlling specification must be UTF-8 without BOM.','SPECIFICATION_BOM');
  let specificationText;try{specificationText=new TextDecoder('utf-8',{fatal:true}).decode(specificationBytes);}catch(error){fail(`The controlling specification is not valid UTF-8: ${error.message}`,'SPECIFICATION_UTF8');}
  const specificationSha256=sha256(specificationBytes);
  const sectionMatches=[...specificationText.matchAll(/^(\d+(?:\.\d+[A-Z]?)?)\.\s+(.+)$/gm)];
  const sectionInventory=sectionMatches.map(match=>({section:match[1],title:match[2].trim(),line:specificationText.slice(0,match.index).split('\n').length}));
  for(const required of ['0','49','52'])if(!sectionInventory.some(entry=>entry.section===required))fail(`Specification Section ${required} was not found.`,'MISSING_REQUIRED_SPEC_SECTION');

  const specificationManifest=readJson(manifestFile);
  if(specificationManifest.schema!=='closed-loop-specification-manifest/1')fail('Wrong specification-manifest schema.');
  if(specificationManifest.repositoryPath!==SPEC_PATH)fail('Specification manifest repositoryPath mismatch.');
  if(specificationManifest.artifactFilename!==path.basename(SPEC_PATH))fail('Specification manifest artifactFilename mismatch.');
  if(specificationManifest.byteLength!==specificationBytes.length)fail('Specification manifest byteLength mismatch.');
  if(specificationManifest.sha256!==specificationSha256)fail('Specification manifest SHA-256 mismatch.');
  if(specificationManifest.contractProfileId!=='closed-loop-completion-profile/1')fail('Specification manifest contract profile mismatch.');
  if(!asText(specificationManifest.sourceCommit))fail('Specification manifest sourceCommit is missing.');
  if(!asText(specificationManifest.normativeRequirementManifestIdentity||specificationManifest.normativeRequirementManifestId))fail('Specification manifest normative-requirement manifest identity is missing.');
  if(!/^[0-9a-f]{64}$/.test(asText(specificationManifest.normativeRequirementManifestSha256)))fail('Specification manifest normative-requirement manifest digest is missing or invalid.');
  if(!Array.isArray(specificationManifest.sectionInventory)||!specificationManifest.sectionInventory.length)fail('Specification manifest section inventory is missing.');
  const actualSections=new Map(sectionInventory.map(entry=>[entry.section,entry]));
  const manifestSections=new Map();
  for(const entry of specificationManifest.sectionInventory){const key=asText(entry?.section);if(!key)fail('Specification manifest contains a section without an identity.');if(manifestSections.has(key))fail(`Specification manifest duplicates section ${key}.`);manifestSections.set(key,entry);}
  for(const key of actualSections.keys())if(!manifestSections.has(key))fail(`Specification manifest omits section ${key}.`);
  for(const key of manifestSections.keys())if(!actualSections.has(key))fail(`Specification manifest invents section ${key}.`);

  const requirementBytes=fs.readFileSync(requirementsFile),requirements=readJson(requirementsFile);
  if(requirements.schema!=='closed-loop-normative-requirements/1')fail('Wrong normative-requirement-manifest schema.');
  if(requirements.specificationPath!==SPEC_PATH)fail('Normative manifest specificationPath mismatch.');
  if(requirements.specificationSha256!==specificationSha256)fail('Normative manifest specification SHA-256 mismatch.');
  if(specificationManifest.normativeRequirementManifestSha256!==sha256(requirementBytes))fail('Specification manifest normative-requirement digest does not match the exact manifest bytes.');
  if(!Array.isArray(requirements.entries)||!requirements.entries.length)fail('Normative manifest has no entries.');
  const ids=new Set(),locationKeys=new Set();
  for(const entry of requirements.entries){
    if(!entry||typeof entry!=='object'||Array.isArray(entry))fail('Normative manifest contains a non-object entry.');
    const id=asText(entry.normativeRequirementId);if(!/^NREQ-[A-Z0-9][A-Z0-9._-]*$/.test(id))fail(`Invalid NORMATIVE_REQUIREMENT_ID: ${id}`);if(ids.has(id))fail(`Duplicate NORMATIVE_REQUIREMENT_ID: ${id}`);ids.add(id);
    const section=asText(entry.location?.section),startLine=Number(entry.location?.startLine);if(!section||!Number.isInteger(startLine)||startLine<1)fail(`Requirement ${id} lacks a valid source location.`);if(!actualSections.has(section))fail(`Requirement ${id} references unknown specification section ${section}.`);
    const locationKey=`${section}:${startLine}:${asText(entry.location?.endLine||startLine)}`;if(locationKeys.has(locationKey)&&entry.distinctAtSameLocation!==true)fail(`Normative manifest duplicates source location ${locationKey} without an explicit distinct-at-same-location marker.`);locationKeys.add(locationKey);
    if(!asText(entry.controllingText||entry.text||entry.requirementText))fail(`Requirement ${id} lacks controlling text.`);
    if(!asText(entry.responsibleImplementationOwner||entry.implementationOwner))fail(`Requirement ${id} lacks a responsible implementation owner.`);
    if(!ALLOWED_DISPOSITIONS.has(entry.currentDisposition))fail(`Requirement ${id} has invalid currentDisposition ${entry.currentDisposition}.`);
    for(const field of ['deterministicTestIds','semanticTestIds','mutationTestIds'])if(entry[field]!==undefined&&!Array.isArray(entry[field]))fail(`Requirement ${id} ${field} must be an array when present.`);
    if(entry.currentDisposition==='CONFORMANT_PROVEN'){
      if(!proofIds(entry).length&&!asText(entry.browserOrPhysicalDeviceProof||entry.requiredBrowserOrPhysicalDeviceProof))fail(`CONFORMANT_PROVEN requirement ${id} has no test or browser/device proof relationship.`);
      if(!asText(entry.acceptanceReportField))fail(`CONFORMANT_PROVEN requirement ${id} lacks acceptanceReportField.`);
      if(entry.requiresMutationProof===true&&!(entry.mutationTestIds||[]).filter(asText).length)fail(`CONFORMANT_PROVEN requirement ${id} requires mutation proof but has no mutationTestIds.`);
    }
  }
  const coveredSections=new Set(requirements.entries.map(entry=>asText(entry.location?.section))),nonnormative=new Map();
  for(const entry of requirements.nonnormativeSections||[]){const section=asText(entry?.section),reason=asText(entry?.reason);if(!section||!actualSections.has(section))fail(`Nonnormative section ${section||'<missing>'} is not a real specification section.`);if(nonnormative.has(section))fail(`Nonnormative section ${section} is duplicated.`);if(!reason)fail(`Nonnormative section ${section} lacks a reason.`);nonnormative.set(section,reason);}
  for(const section of actualSections.keys())if(!coveredSections.has(section)&&!nonnormative.has(section))fail(`Specification section ${section} is neither traced nor explicitly nonnormative.`);

  const challenge=requirements.omissionChallenge;if(!challenge||typeof challenge!=='object'||Array.isArray(challenge))fail('Normative manifest lacks omission-challenge evidence.');
  for(const field of ['draftExtractionStatus','independentReviewStatus','reconciliationStatus'])if(!asText(challenge[field]))fail(`Normative manifest omission challenge lacks ${field}.`);
  if(!asText(challenge.draftExtractorIdentity))fail('Normative manifest lacks draft extractor identity.');
  if(!asText(challenge.independentReviewerIdentity))fail('Normative manifest lacks independent reviewer identity.');
  if(challenge.independentReviewerIdentity===challenge.draftExtractorIdentity)fail('The omission-challenge reviewer must be distinct from the draft extractor identity.');
  if(!asText(challenge.independentReviewEvidence))fail('Normative manifest lacks independent-review evidence.');
  if(!asText(challenge.reconciliationIdentity))fail('Normative manifest lacks reconciliation identity.');
  if([challenge.draftExtractorIdentity,challenge.independentReviewerIdentity].includes(challenge.reconciliationIdentity))fail('The omission-challenge reconciler must be distinct from extractor and reviewer identities.');
  if(!asText(challenge.reconciliationEvidence))fail('Normative manifest lacks reconciliation evidence.');
  if(Array.isArray(challenge.unreconciledMaterialDifferences)&&challenge.unreconciledMaterialDifferences.length)fail('Normative manifest has unreconciled material omission-challenge differences.');

  const unresolved=requirements.entries.filter(entry=>entry.currentDisposition!=='CONFORMANT_PROVEN');
  const finalAcceptanceEligible=challenge.independentReviewStatus==='ACCEPTED'&&challenge.reconciliationStatus==='ACCEPTED'&&unresolved.length===0;
  const result={specificationPath:SPEC_PATH,specificationByteLength:specificationBytes.length,specificationSha256,sectionCount:sectionInventory.length,normativeRequirementCount:requirements.entries.length,unresolvedDispositionCount:unresolved.length,omissionChallenge:{draftExtractionStatus:challenge.draftExtractionStatus,independentReviewStatus:challenge.independentReviewStatus,reconciliationStatus:challenge.reconciliationStatus},finalAcceptanceEligible};
  if(requireFinalAcceptance&&!finalAcceptanceEligible)fail(`Final acceptance is blocked: independentReviewStatus=${challenge.independentReviewStatus}, reconciliationStatus=${challenge.reconciliationStatus}, unresolvedDispositionCount=${unresolved.length}.`,'FINAL_ACCEPTANCE_BLOCKED');
  return result;
}

if(import.meta.url===`file://${process.argv[1]}`){
  const rootArg=process.argv.find(arg=>arg.startsWith('--root=')),root=rootArg?path.resolve(rootArg.slice('--root='.length)):process.cwd(),result=verifyNormativeGovernance({root,requireFinalAcceptance:process.argv.includes('--require-final-acceptance')});
  process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
}
