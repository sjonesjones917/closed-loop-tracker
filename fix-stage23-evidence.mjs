import fs from 'node:fs';
const path='workflow-engine.js';
let source=fs.readFileSync(path,'utf8');
const from="recordValue(result,'PRE_CORRECTION_EVIDENCE'),recordValue(result,'POST_CORRECTION_EVIDENCE')].filter";
const to="recordValue(result,'PRE_CORRECTION_EVIDENCE'),recordValue(result,'POST_CORRECTION_EVIDENCE'),recordValue(result,'PRODUCT_LOCATION'),recordValue(result,'EXTERNAL_SOURCE_EVIDENCE'),recordValue(result,'REQUIRED_MEANING'),recordValue(result,'OBSERVED_MEANING'),recordValue(result,'EVIDENCE_BASED_COMPARISON')].filter";
if(!source.includes(from))throw new Error('Expected direct-evidence list was not found.');
source=source.replace(from,to);
fs.writeFileSync(path,source);
console.log('Stage 23 semantic evidence fields now count as direct evidence.');
