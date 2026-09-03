import fs from 'node:fs';

function replaceOnce(text, before, after, label) {
  if (!text.includes(before)) throw new Error(`Missing repair anchor: ${label}`);
  return text.replace(before, after);
}

const fullCyclePath = 'verify-full-cycle.mjs';
let fullCycle = fs.readFileSync(fullCyclePath, 'utf8');
fullCycle = replaceOnce(
  fullCycle,
  "overrides:{TEST_TYPE:'DETERMINISTIC',INPUTS:",
  "overrides:{TEST_TYPE:'DETERMINISTIC',VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:12,REQUIRED_BY_STAGE:12,PER_RUN_REQUIRED:true,FINAL_PRODUCT_REQUIRED:false,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{phaseTarget:true},INPUTS:",
  'full-cycle deterministic timing'
);
fullCycle = replaceOnce(
  fullCycle,
  "overrides:{TEST_TYPE:'MEANING',INPUTS:",
  "overrides:{TEST_TYPE:'MEANING',VERIFICATION_PHASE:'FINAL_PRODUCT_MEANING',EARLIEST_EXECUTABLE_STAGE:23,REQUIRED_BY_STAGE:23,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:true,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{phaseTarget:true},INPUTS:",
  'full-cycle meaning timing'
);
fullCycle = replaceOnce(
  fullCycle,
  "overrides:{TEST_TYPE:'ADVERSARIAL',INPUTS:",
  "overrides:{TEST_TYPE:'ADVERSARIAL',VERIFICATION_PHASE:'FINAL_PRODUCT_ADVERSARIAL',EARLIEST_EXECUTABLE_STAGE:24,REQUIRED_BY_STAGE:24,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:true,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{phaseTarget:true},INPUTS:",
  'full-cycle adversarial timing'
);
fullCycle = replaceOnce(
  fullCycle,
  "for(const {runId} of slots)for(const test of stage6Tests){",
  "for(const {runId} of slots)for(const test of stage6Tests.filter(test=>engine.testDueState(p,test,12,{perRunOnly:true}).dueNow)){",
  'full-cycle due-only verification relation generation'
);
fs.writeFileSync(fullCyclePath, fullCycle);

const dodPath = 'verify-v3-definition-of-done.mjs';
let dod = fs.readFileSync(dodPath, 'utf8');
dod = replaceOnce(
  dod,
  "    ['premature-due-negative',/(nondue|not due|before.*target|target.*exists)/i.test(completeTests)]\n  ],['workflow-engine.js','verify-complete.mjs']),",
  "    ['premature-due-negative',/(nondue|not due|before.*target|target.*exists)/i.test(completeTests)],\n    ['stage22-final-phase-selection',/FINAL_PRODUCT_DETERMINISTIC/.test(engine)&&/testDueState\\(project,test,22\\)/.test(engine)],\n    ['stage23-final-phase-selection',/FINAL_PRODUCT_MEANING/.test(engine)&&/testDueState\\(project,test,23\\)/.test(engine)],\n    ['stage24-final-phase-selection',/FINAL_PRODUCT_ADVERSARIAL/.test(engine)&&/testDueState\\(project,test,24\\)/.test(engine)]\n  ],['workflow-engine.js','verify-complete.mjs']),",
  'Section 49 due-stage closed-universe metric'
);
fs.writeFileSync(dodPath, dod);

console.log(JSON.stringify({ repaired: true, files: [fullCyclePath, dodPath] }));
