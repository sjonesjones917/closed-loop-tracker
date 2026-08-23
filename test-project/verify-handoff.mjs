import fs from 'node:fs';

const [expectedPath, outputPath, verifierContextId] = process.argv.slice(2);
if (!expectedPath || !outputPath || !verifierContextId) {
  console.error('Usage: node test-project/verify-handoff.mjs <expected.json> <output.md> <context-id>');
  process.exit(2);
}

const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
const text = fs.readFileSync(outputPath, 'utf8');
const lines = text.split(/\r?\n/);
const locations = needle => lines.flatMap((line, index) => line.includes(needle) ? [index + 1] : []);
const exact = value => text.includes(String(value));
const result = (reqId, satisfied, evidence, observed) => ({
  reqId,
  result: satisfied ? 'SATISFIED' : 'VIOLATED',
  verifierContextId,
  verifierIndependentFromGenerator: true,
  evidence,
  observed
});

const req1 = exact(expected.unitId) && exact(expected.serviceDate);
const req2 = expected.completedServiceActions.every(exact) && exact(expected.startStopFunctionalCheck);
const req3 = exact(expected.exteriorFuelOilLeakInspection);
const shouldBlock = expected.safetyState === 'UNKNOWN' || expected.safetyState === 'VIOLATED';
const req4 = shouldBlock
  ? text.includes('Release state: BLOCKED') && !text.includes('**Release state:** ACCEPTED')
  : text.includes('**Release state:** ACCEPTED') && text.includes('No unrecorded fact was inferred.');
const escalation = [
  'Stop return-to-service.',
  'Record the blocker.',
  'Identify the missing evidence or required repair.',
  'Route the unit for authorized resolution.',
  'Revalidate before release.'
];
const req5 = escalation.every(exact);

const results = [
  result('REQ-001', req1, { unitLines: locations(expected.unitId), dateLines: locations(expected.serviceDate) }, `unit=${expected.unitId}; date=${expected.serviceDate}`),
  result('REQ-002', req2, { actionLines: expected.completedServiceActions.flatMap(locations), checkLines: locations(expected.startStopFunctionalCheck) }, 'Completed actions and start/stop check were compared exactly.'),
  result('REQ-003', req3, { leakInspectionLines: locations(expected.exteriorFuelOilLeakInspection) }, expected.exteriorFuelOilLeakInspection),
  result('REQ-004', req4, { acceptedLines: locations('Release state: ACCEPTED'), blockedLines: locations('Release state: BLOCKED') }, shouldBlock ? 'BLOCKED required' : 'ACCEPTED allowed from complete non-adverse mandatory evidence'),
  result('REQ-005', req5, { escalationLines: escalation.map(item => ({ item, lines: locations(item) })) }, escalation.join(' | '))
];

const determination = results.every(item => item.result === 'SATISFIED') ? 'SATISFIED' : 'VIOLATED';
process.stdout.write(JSON.stringify({
  verifierContextId,
  verifierIndependentFromGenerator: true,
  outputPath: outputPath.replaceAll('\\', '/'),
  determination,
  results
}));
