import fs from 'node:fs';
let s=fs.readFileSync('repair-controlling-bundle-v2.mjs','utf8');
const fixes=[
  ["t=one(t,\"'ASSUMPTIONS','UNKNOWN_INFORMATION','INPUT_SET_CONTENTS'\",\"'ASSUMPTIONS','UNKNOWN_INFORMATION','INPUT_SET_CONTENTS','INTAKE_ACCOUNTING'\",'Stage1 accounting field');","t=one(t,\"'ASSUMPTIONS','UNKNOWN_INFORMATION','INPUT_SET_VERSION','INPUT_SET_CONTENTS'\",\"'ASSUMPTIONS','UNKNOWN_INFORMATION','INPUT_SET_VERSION','INPUT_SET_CONTENTS','INTAKE_ACCOUNTING'\",'Stage1 accounting field');"],
  ["t=one(t,\"'DEFINED_TERM_GAPS','TOTAL_REQUIREMENTS'\",\"'DEFINED_TERM_GAPS','OBLIGATION_ACCOUNTING','TOTAL_REQUIREMENTS'\",'Stage4 accounting field');","t=one(t,\"'REQUIREMENT_RECORDS','ATOMICITY_REVIEW_RESULTS','DEFINED_TERM_GAPS','TOTAL_REQUIREMENTS'\",\"'REQUIREMENT_RECORDS','ATOMICITY_REVIEW_RESULTS','DEFINED_TERM_GAPS','OBLIGATION_ACCOUNTING','TOTAL_REQUIREMENTS'\",'Stage4 accounting field');"]
];
for(const [a,b] of fixes){if(!s.includes(a))throw new Error('repair-runner could not find expected v2 source target');s=s.replace(a,b);}
fs.writeFileSync('/tmp/closed-loop-repair.mjs',s);
await import('file:///tmp/closed-loop-repair.mjs');
