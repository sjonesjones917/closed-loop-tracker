import fs from 'node:fs';
import crypto from 'node:crypto';

const SPEC_PATH = 'specification/closed-loop-reliability-controlling-implementation-specification.txt';
const SPEC_MANIFEST_PATH = 'specification/closed-loop-specification-manifest.json';
const REQUIREMENTS_PATH = 'specification/closed-loop-normative-requirements.json';

const fail = (message) => {
  throw new Error(message);
};
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const readJson = (path) => {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${path} is not valid UTF-8 JSON: ${error.message}`);
  }
  return parsed;
};

for (const path of [SPEC_PATH, SPEC_MANIFEST_PATH, REQUIREMENTS_PATH]) {
  if (!fs.existsSync(path)) fail(`Missing required repository-governance artifact: ${path}`);
}

const specificationBytes = fs.readFileSync(SPEC_PATH);
if (specificationBytes.length === 0) fail('The controlling specification is empty.');
if (specificationBytes[0] === 0xef && specificationBytes[1] === 0xbb && specificationBytes[2] === 0xbf) {
  fail('The controlling specification must be UTF-8 without BOM.');
}
if (specificationBytes.includes(0x0d)) fail('The controlling specification must use LF line endings only.');
const specificationText = new TextDecoder('utf-8', { fatal: true }).decode(specificationBytes);
const specificationSha256 = sha256(specificationBytes);
const physicalLines = specificationText.split('\n');
const sectionMatches = [...specificationText.matchAll(/^(\d+(?:\.\d+[A-Z]?)?)\.\s+(.+)$/gm)];
const sectionInventory = sectionMatches.map((match) => ({
  section: match[1],
  title: match[2].trim(),
  line: specificationText.slice(0, match.index).split('\n').length,
}));
if (!sectionInventory.some((entry) => entry.section === '0')) fail('Specification Section 0 was not found.');
if (!sectionInventory.some((entry) => entry.section === '49')) fail('Specification Section 49 was not found.');
if (!sectionInventory.some((entry) => entry.section === '52')) fail('Specification Section 52 was not found.');

const specificationManifest = readJson(SPEC_MANIFEST_PATH);
if (specificationManifest.schema !== 'closed-loop-specification-manifest/1') fail('Wrong specification-manifest schema.');
if (specificationManifest.repositoryPath !== SPEC_PATH) fail('Specification manifest repositoryPath mismatch.');
if (specificationManifest.artifactFilename !== SPEC_PATH.split('/').at(-1)) fail('Specification manifest artifactFilename mismatch.');
if (specificationManifest.byteLength !== specificationBytes.length) fail('Specification manifest byteLength mismatch.');
if (specificationManifest.sha256 !== specificationSha256) fail('Specification manifest SHA-256 mismatch.');
if (specificationManifest.contractProfileId !== 'closed-loop-completion-profile/1') fail('Specification manifest contract profile mismatch.');
if (!Array.isArray(specificationManifest.sectionInventory) || specificationManifest.sectionInventory.length === 0) {
  fail('Specification manifest section inventory is missing.');
}
const manifestSectionKeys = new Set(specificationManifest.sectionInventory.map((entry) => String(entry.section)));
for (const entry of sectionInventory) {
  if (!manifestSectionKeys.has(entry.section)) fail(`Specification manifest omits section ${entry.section}.`);
}

const requirements = readJson(REQUIREMENTS_PATH);
if (requirements.schema !== 'closed-loop-normative-requirements/1') fail('Wrong normative-requirement-manifest schema.');
if (requirements.specificationPath !== SPEC_PATH) fail('Normative manifest specificationPath mismatch.');
if (requirements.specificationSha256 !== specificationSha256) fail('Normative manifest specification SHA-256 mismatch.');
if (!Array.isArray(requirements.entries) || requirements.entries.length === 0) fail('Normative manifest has no entries.');
const requirementIds = new Set();
for (const entry of requirements.entries) {
  if (!entry || typeof entry !== 'object') fail('Normative manifest contains a non-object entry.');
  if (!/^NREQ-[A-Z0-9][A-Z0-9._-]*$/.test(String(entry.normativeRequirementId || ''))) {
    fail(`Invalid NORMATIVE_REQUIREMENT_ID: ${entry.normativeRequirementId}`);
  }
  if (requirementIds.has(entry.normativeRequirementId)) fail(`Duplicate NORMATIVE_REQUIREMENT_ID: ${entry.normativeRequirementId}`);
  requirementIds.add(entry.normativeRequirementId);
  if (!entry.location || !Number.isInteger(entry.location.startLine) || entry.location.startLine < 1) {
    fail(`Requirement ${entry.normativeRequirementId} lacks a valid source location.`);
  }
  if (!entry.currentDisposition) fail(`Requirement ${entry.normativeRequirementId} lacks currentDisposition.`);
}

const coveredSections = new Set(requirements.entries.map((entry) => String(entry.location?.section || '')));
const nonnormativeSections = new Set((requirements.nonnormativeSections || []).map((entry) => String(entry.section || '')));
for (const entry of sectionInventory) {
  if (!coveredSections.has(entry.section) && !nonnormativeSections.has(entry.section)) {
    fail(`Specification section ${entry.section} is neither traced nor explicitly nonnormative.`);
  }
}

const challenge = requirements.omissionChallenge;
if (!challenge || typeof challenge !== 'object') fail('Normative manifest lacks omission-challenge evidence.');
for (const field of ['draftExtractionStatus', 'independentReviewStatus', 'reconciliationStatus']) {
  if (!challenge[field]) fail(`Normative manifest omission challenge lacks ${field}.`);
}
const independentReviewAccepted = challenge.independentReviewStatus === 'ACCEPTED';
const reconciliationAccepted = challenge.reconciliationStatus === 'ACCEPTED';
const uncovered = requirements.entries.filter((entry) => entry.currentDisposition === 'UNKNOWN').length;
const finalAcceptanceEligible = independentReviewAccepted && reconciliationAccepted && uncovered === 0;

const result = {
  specificationPath: SPEC_PATH,
  specificationByteLength: specificationBytes.length,
  specificationSha256,
  physicalLineCount: physicalLines.length,
  sectionCount: sectionInventory.length,
  normativeRequirementCount: requirements.entries.length,
  unknownDispositionCount: uncovered,
  omissionChallenge: {
    draftExtractionStatus: challenge.draftExtractionStatus,
    independentReviewStatus: challenge.independentReviewStatus,
    reconciliationStatus: challenge.reconciliationStatus,
  },
  finalAcceptanceEligible,
};

if (process.argv.includes('--require-final-acceptance') && !finalAcceptanceEligible) {
  fail(`Final acceptance is blocked: independentReviewStatus=${challenge.independentReviewStatus}, reconciliationStatus=${challenge.reconciliationStatus}, unknownDispositionCount=${uncovered}.`);
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
