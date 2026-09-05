import fs from 'node:fs';
const path='verify-stage26-27-reconciliation-release.mjs';
let text=fs.readFileSync(path,'utf8');
const old="const disagreement=mk();disagreement.projectData.processAudits.push(structuredClone(pa));disagreement.projectData.productAudits.push(structuredClone(pr));let ds=e.stage26ReconciliationState(disagreement);";
const replacement="const disagreement=mk();disagreement.projectData.processAudits.push(structuredClone(pa));disagreement.projectData.productAudits.push(structuredClone(pr));disagreement.projectData.evidenceRecords.push(...p.projectData.evidenceRecords.map(x=>structuredClone(x)));let ds=e.stage26ReconciliationState(disagreement);";
if(!text.includes(old))throw new Error('Disagreement fixture anchor missing.');
text=text.replace(old,replacement);
fs.writeFileSync(path,text);
console.log('Stage 27 disagreement fixture now preserves canonical audit evidence.');
