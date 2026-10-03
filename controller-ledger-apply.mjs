import fs from 'node:fs';

const regression = `import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const CANONICAL='verification/closed-loop-build-state.json';
function trackedFiles(){return execFileSync('git',['ls-files'],{encoding:'utf8'}).split(/\\r?\\n/).filter(Boolean);}
function validate(files){
  const ledgers=files.filter(file=>file==='closed-loop-build-state.json'||file.endsWith('/closed-loop-build-state.json')).sort();
  assert.deepEqual(ledgers,[CANONICAL],\`exactly one canonical controller ledger is required; found: \${ledgers.join(', ')||'NONE'}\`);
  return ledgers;
}
const current=validate(trackedFiles());
let invalidRejected=false;
try{validate([...trackedFiles(),'implementation/closed-loop-build-state.json']);}catch{invalidRejected=true;}
assert.equal(invalidRejected,true,'intentional duplicate-ledger fixture was not rejected');
console.log(JSON.stringify({canonicalLedger:current[0],ledgerCount:current.length,intentionalDuplicateRejected:invalidRejected}));
`;
fs.writeFileSync('verify-controller-ledger-uniqueness.mjs',regression);
const workflowPath='.github/workflows/pages.yml';
let workflow=fs.readFileSync(workflowPath,'utf8');
if(!workflow.includes('node verify-controller-ledger-uniqueness.mjs')){
  const anchor='          node verify-build-stage-ledger.mjs\n';
  if(!workflow.includes(anchor))throw new Error('verify-build-stage-ledger workflow anchor not found');
  workflow=workflow.replace(anchor,anchor+'          node verify-controller-ledger-uniqueness.mjs\n');
  fs.writeFileSync(workflowPath,workflow);
}
console.log('Applied canonical-ledger uniqueness regression.');
