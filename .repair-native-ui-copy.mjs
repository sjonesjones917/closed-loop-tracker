import fs from 'node:fs';
const path='.closed-loop-native-test-repair.mjs';
let s=fs.readFileSync(path,'utf8');
const replacements=[
  ['<h2 class="section-title">How these tests will run</h2>','<h2 class="section-title">Verification execution — Who performs the current tests</h2>'],
  ['<h2 class="section-title">What happens next</h2>','<h2 class="section-title">Verification execution — what happens next</h2>'],
  ['Browser storage does not transfer them automatically.</p>','External verification remains blocked for exact artifact bytes that are missing or unverified; browser storage alone does not give an external executor access. Download these exact stored bytes before sending them; a filename, hash claim, or code block is not file possession.</p>']
];
for(const [from,to] of replacements){if(!s.includes(from))throw new Error('Expected UI repair anchor is missing: '+from);s=s.replace(from,to);}
fs.writeFileSync(path,s);
