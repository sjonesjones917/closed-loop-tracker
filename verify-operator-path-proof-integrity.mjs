import fs from 'node:fs';

const path='verify-human-stage-walkthrough.mjs';
const source=fs.readFileSync(path,'utf8');
const failures=[];

// End-to-end operator-path evidence may not manufacture completion by mutating
// canonical/stage state directly. A walkthrough must reach state through the
// same visible controls and durable application commands available to an operator.
const forbiddenStateWrites=[
  /state\.stages\[[^\]]+\]\.status\s*=\s*['"]COMPLETE['"]/,
  /state\.stages\[[^\]]+\]\.gate\s*=\s*\{[^}]*complete\s*:\s*true/s,
];
for(const pattern of forbiddenStateWrites){
  if(pattern.test(source))failures.push(`operator walkthrough fabricates completed stage state: ${pattern}`);
}

// Counting stage-picker options proves only that navigation entries exist. It
// cannot be reported as the number of stages exercised through the operator path.
if(/uiStagesReached\s*:\s*reached\.length/.test(source)){
  failures.push('operator walkthrough reports stage-picker option count as stages reached');
}
if(/reached\.length\s*!==\s*30/.test(source)){
  failures.push('operator walkthrough uses stage-picker option count as 30-stage execution evidence');
}

// A complete 30-stage walkthrough must retain per-stage execution evidence.
// Merely iterating contracts or generating prompts is not stage execution.
if(!/operatorStageEvidence/.test(source)){
  failures.push('operator walkthrough has no retained per-stage operator execution evidence');
}

if(failures.length){
  console.error(JSON.stringify({operatorPathProofIntegrity:false,failures},null,2));
  process.exit(1);
}

console.log(JSON.stringify({operatorPathProofIntegrity:true,checked:path}));
