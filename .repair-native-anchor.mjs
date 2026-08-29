import fs from 'node:fs';
const path='.closed-loop-native-test-repair.mjs';
let s=fs.readFileSync(path,'utf8');
const from="`mode==='APPLICATION_DETERMINISTIC'&&!Object.prototype.hasOwnProperty.call(APPLICATION_TEST_EXECUTORS,String(recordValue(test,'REQUIRED_CAPABILITY')||'').trim())`,\n`mode==='APPLICATION_DETERMINISTIC'&&(!Object.prototype.hasOwnProperty.call(APPLICATION_TEST_EXECUTORS,String(recordValue(test,'REQUIRED_CAPABILITY')||'').trim())||!validateApplicationTestSpec(test).valid)`";
const to="`const unsupportedApplication=mandatoryTests.filter(test=>upper(recordValue(test,'EXECUTION_MODE'))==='APPLICATION_DETERMINISTIC'&&!Object.prototype.hasOwnProperty.call(APPLICATION_TEST_EXECUTORS,String(recordValue(test,'REQUIRED_CAPABILITY')||'').trim()));`,\n`const unsupportedApplication=mandatoryTests.filter(test=>upper(recordValue(test,'EXECUTION_MODE'))==='APPLICATION_DETERMINISTIC'&&(!Object.prototype.hasOwnProperty.call(APPLICATION_TEST_EXECUTORS,String(recordValue(test,'REQUIRED_CAPABILITY')||'').trim())||!validateApplicationTestSpec(test).valid));`";
if(!s.includes(from))throw new Error('Expected Stage 06 repair anchor was not found in the repair script.');
s=s.replace(from,to);
fs.writeFileSync(path,s);
