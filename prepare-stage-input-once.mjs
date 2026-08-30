import fs from 'node:fs';
const file='apply-stage-input-once.mjs';
let source=fs.readFileSync(file,'utf8');
const old="  source = replaceRegex(source, /runtime-bec66cf2784e2a2b/g, 'runtime-stage-input-once-20260830a', 'shared runtime build token');";
const replacement="  const buildTokenMatches=source.split('runtime-bec66cf2784e2a2b').length-1;\n  if(buildTokenMatches!==8)throw new Error(`shared runtime build token: expected 8 matches, found ${buildTokenMatches}`);\n  source=source.replaceAll('runtime-bec66cf2784e2a2b','runtime-stage-input-once-20260830a');";
if(source.split(old).length-1!==1)throw new Error('Unable to locate runtime-token applicator line.');
source=source.replace(old,replacement);
source=source.replaceAll('complete semantic intake inspection','complete meaning-preserving intake inspection');
source=source.replaceAll('every semantically relevant human-supplied statement','every materially relevant human-supplied statement');
source=source.replaceAll('every semantically relevant supplied statement','every materially relevant supplied statement');
source=source.replaceAll("`3:${JSON.stringify(stage3)},\\n4:`","`3:'${stage3}',\\n4:`");
source=source.replaceAll("`4:${JSON.stringify(stage4)},\\n5:`","`4:'${stage4}',\\n5:`");
source=source.replaceAll(
  'It is the canonical later-stage intake representation; later stages must not reopen or request the original material.',
  'It is the canonical later-stage intake representation; later stages must not reopen or request the original material. Do not turn it into a Stage 02 archive/file inventory.'
);
source=source.replaceAll(
  "'Stage 03 obligation sentinel','no original intake file is required or used'",
  "'Stage 03 obligation sentinel','The original human-supplied intent file or other intake material must not be requested, consumed, attached, sent, reselected, reopened, or reused'"
);
fs.writeFileSync(file,source);

const promptTestFile='verify-prompt-semantics.mjs';
let promptTests=fs.readFileSync(promptTestFile,'utf8');
const obsolete='/limited intake inspection is Stage 01 job-definition work/i';
const corrected='/complete meaning-preserving intake inspection is Stage 01 job-definition work/i';
if(promptTests.split(obsolete).length-1!==1)throw new Error('Unable to locate obsolete Stage 01 locality assertion.');
promptTests=promptTests.replace(obsolete,corrected);
fs.writeFileSync(promptTestFile,promptTests);
