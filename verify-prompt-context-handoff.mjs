import fs from 'node:fs';
const text=fs.readFileSync(new URL('./prompt-engine.js',import.meta.url),'utf8');
const required=[
  "11:Object.freeze(['instructions','artifacts'])",
  "12:Object.freeze(['sources','research','evidenceRecords','artifacts'])",
  "14:Object.freeze(['sources','research','candidateRequirements','requirementResolutions','sourceConflicts','failureTests','preflightRecords','artifacts','evidenceRecords','changes'])",
  "EXECUTE_RUN:Object.freeze(['instructions','artifacts'])",
  "ROOT_CAUSE:Object.freeze(['requirements','tests','instructions','runs','sources','research','candidateRequirements','requirementResolutions','failureTests','preflightRecords','artifacts','evidenceRecords','changes'])",
  "REGRESSION:Object.freeze(['requirements','tests','artifacts','evidenceRecords','runs'])",
  "CORRECT:Object.freeze(['requirements','requirementResolutions','instructions','tests','failureTests','artifacts','evidenceRecords'])",
  "22:Object.freeze(['requirements','evidenceRecords'])",
  'for(const collection of promptReadCollections(stage,operation)){',
  'readCollections:Object.fromEntries(promptReadCollections(stage,operation).map('
];
for(const needle of required)if(!text.includes(needle))throw new Error(`Missing prompt-context handoff invariant: ${needle}`);
console.log('Prompt-context handoff invariants present.');
