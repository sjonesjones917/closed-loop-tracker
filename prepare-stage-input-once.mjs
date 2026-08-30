import fs from 'node:fs';

const file='verify-prompt-semantics.mjs';
let source=fs.readFileSync(file,'utf8');
const replacements=[
  ['/limited intake inspection is Stage 01 job-definition work/i','/complete meaning-preserving intake inspection is Stage 01 job-definition work/i'],
  ["'Stage 01 does not require every fact needed to execute later stages'","'Stage 01 must capture every materially relevant human-authority statement currently supplied; facts that genuinely require later research may remain identified as later-resolvable'"],
  [
`  p.job.SUPPLIED_MATERIALS_INVENTORY=JSON.stringify([{type:'FILE',exactNameOrReference:'renamed-design-input.pdf'}]);
  const renamed=prompts.buildPromptRecord(4,p,{operation:'COMPLETE'});
  if(renamed.bodySha256===record.bodySha256)throw new Error('Current human input change did not change the Stage 04 instruction body.');`,
`  p.job.SUPPLIED_MATERIALS_INVENTORY=JSON.stringify([{type:'FILE',exactNameOrReference:'renamed-design-input.pdf'}]);
  const renamed=prompts.buildPromptRecord(4,p,{operation:'COMPLETE'});
  if(renamed.bodySha256!==record.bodySha256)throw new Error('Changing only the original intake filename incorrectly changed the Stage 04 instruction body.');
  for(const filename of ['design-input.pdf','renamed-design-input.pdf'])if(record.prompt.includes(filename)||renamed.prompt.includes(filename))throw new Error('Stage 04 exposed an original intake filename: '+filename);
  p.job.INPUT_SET_CONTENTS='CANONICAL-STAGE-01-INTENT-CAPTURE-CHANGED';
  const canonicalChanged=prompts.buildPromptRecord(4,p,{operation:'COMPLETE'});
  if(canonicalChanged.bodySha256===record.bodySha256)throw new Error('Changing canonical Stage 01 intake did not change the Stage 04 instruction body.');`
  ],
];
for(const [oldText,newText] of replacements){
  const count=source.split(oldText).length-1;
  if(count!==1)throw new Error(`Expected one obsolete regression token, found ${count}: ${oldText.slice(0,120)}`);
  source=source.replace(oldText,newText);
}
fs.writeFileSync(file,source);
console.log('Updated obsolete Stage 01 and Stage 04 prompt regressions.');
