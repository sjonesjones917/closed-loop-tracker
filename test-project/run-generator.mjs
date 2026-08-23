import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [packagePath, outputPath, runId, contextId] = process.argv.slice(2);
if (!packagePath || !outputPath || !runId || !contextId) {
  console.error('Usage: node test-project/run-generator.mjs <package.json> <output.md> <run-id> <context-id>');
  process.exit(2);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const blocked = pkg.safetyState === 'UNKNOWN' || pkg.safetyState === 'VIOLATED';
const releaseState = blocked ? 'BLOCKED' : 'ACCEPTED';
const lines = [
  `# Portable Generator ${pkg.unitId} — Service Handoff`,
  '',
  `**Service date:** ${pkg.serviceDate}`,
  `**Release state:** ${releaseState}`,
  '',
  '## Completed service work',
  ...pkg.completedServiceActions.map(action => `- ${action}`),
  '',
  '## Recorded checks',
  `- Start/stop functional check: ${pkg.startStopFunctionalCheck}`,
  `- Exterior fuel/oil leak inspection: ${pkg.exteriorFuelOilLeakInspection}`,
  '',
  '## Safety decision',
  blocked
    ? 'Release state: BLOCKED — a mandatory safety-critical condition is adverse or UNKNOWN. Return-to-service is prohibited until authorized resolution and revalidation.'
    : 'Release state: ACCEPTED — the mandatory recorded safety evidence required by the supplied site policy is present and non-adverse. No unrecorded fact was inferred.',
  '',
  '## Escalation when a safety-critical condition is found or UNKNOWN',
  '1. Stop return-to-service.',
  '2. Record the blocker.',
  '3. Identify the missing evidence or required repair.',
  '4. Route the unit for authorized resolution.'
];
if (pkg.includeRevalidationStep) lines.push('5. Revalidate before release.');
lines.push('', '## Evidence basis', '- User request: test-project/inputs/REQUEST.md', '- Site policy: test-project/inputs/SITE_POLICY.md', '- Outcome rules: test-project/inputs/WORKFLOW_RULES.md', '');

const output = lines.join('\n');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, output, 'utf8');
const bytes = Buffer.from(output, 'utf8');
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
process.stdout.write(JSON.stringify({
  runId,
  contextId,
  status: 'COMPLETED',
  outputPath: outputPath.replaceAll('\\', '/'),
  byteLength: bytes.length,
  sha256,
  completeResponse: output,
  tool: `node ${process.version}`
}));
