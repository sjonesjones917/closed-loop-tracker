import fs from 'node:fs';

const file='verify-prompt-semantics.mjs';
let source=fs.readFileSync(file,'utf8');
const replacements=[
  ['/limited intake inspection is Stage 01 job-definition work/i','/complete meaning-preserving intake inspection is Stage 01 job-definition work/i'],
  ["'Stage 01 does not require every fact needed to execute later stages'","'Stage 01 must capture every materially relevant human-authority statement currently supplied; facts that genuinely require later research may remain identified as later-resolvable'"],
];
for(const [oldText,newText] of replacements){
  const count=source.split(oldText).length-1;
  if(count!==1)throw new Error(`Expected one obsolete Stage 01 regression token, found ${count}: ${oldText}`);
  source=source.replace(oldText,newText);
}
fs.writeFileSync(file,source);
console.log('Updated obsolete Stage 01 prompt regressions.');
