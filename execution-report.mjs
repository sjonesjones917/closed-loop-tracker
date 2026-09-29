// Repository verifier output only; this is not a runtime response parser.
export function selectExecutionReport(stdout, marker) {
  const reports = stdout.trim().split(/\n(?=\{)/).map(text => JSON.parse(text));
  const matching = reports.filter(report => report && !Array.isArray(report) && Object.hasOwn(report, marker));
  if (matching.length !== 1) throw new Error(`Expected one execution report containing ${marker}; found ${matching.length}.`);
  return matching[0];
}
