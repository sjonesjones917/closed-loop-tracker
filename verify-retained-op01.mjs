import fs from 'node:fs';
const retained=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
const expected=String(retained.userJobInput?.authorizedOperation01||'').trim();
if(!expected||!expected.includes('OPERATION 01 — DEFINE JOB'))throw new Error('Canonical retained Operation 01 definition is missing.');
if(String(retained.generatedOutputs?.[0]?.output||'').trim()!==expected)throw new Error('Retained generated output differs from canonical Operation 01 definition.');
if(String(retained.stageRecords?.['1']?.output||'').trim()!==expected)throw new Error('Retained Stage 01 output differs from canonical Operation 01 definition.');
if(retained.generatedPrompts?.length!==1||retained.outputReceipts?.length!==1)throw new Error('Retained Stage 01 prompt/receipt history is incomplete.');
console.log(JSON.stringify({retainedOperation01:true,promptHistory:1,receiptHistory:1}));
