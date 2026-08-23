import fs from 'node:fs';

const project = JSON.parse(fs.readFileSync('SELF_VERIFIED_PROJECT.json', 'utf8'));
const patterns = [
  ['v13', /\bv13\b/i],
  ['version 13', /version\s+13/i],
  ['sidecar', /sidecar/i],
  ['repair framing', /repair[- ]task|repair project|fix stage/i],
  ['implementation history', /implementation[- ]history/i],
  ['agent-instruction relay', /agent instruction|paste (?:the )?agent|copy (?:the )?prompt|prompt relay/i]
];
const matches = [];
const walk = (value, path = '$') => {
  if (typeof value === 'string') {
    for (const [label, pattern] of patterns) {
      if (pattern.test(value)) {
        matches.push({ label, path, excerpt: value.slice(0, 500) });
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) walk(item, `${path}.${key}`);
  }
};
walk(project);
const counts = Object.fromEntries(patterns.map(([label]) => [label, matches.filter(item => item.label === label).length]));
const report = { status: matches.length ? 'REVIEW_REQUIRED' : 'PASS', totalMatches: matches.length, counts, matches };
fs.writeFileSync('PROJECT_LANGUAGE_REPORT.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, totalMatches: report.totalMatches, counts }, null, 2));
