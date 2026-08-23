import fs from 'node:fs';
import crypto from 'node:crypto';

const path='TEST_PROJECT.json';
const project=JSON.parse(fs.readFileSync(path,'utf8'));

function rewrite(value){
  if(Array.isArray(value)) return value.map(rewrite);
  if(value&&typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v)]));
  if(typeof value!=='string') return value;
  return value
    .replace(/maintenance[- ]handoff/gi,'field status report')
    .replace(/maintenance handoff/gi,'field status report')
    .replace(/handoff file/gi,'status report file')
    .replace(/handoff/gi,'status report');
}

const out=rewrite(project);
out.schema='human-project/30';
out.title='GEN-042 field status report';
out.specRevision='retained-complete-field-status-job';
out.userJobInput={
  ...(out.userJobInput||{}),
  objective:'Create a concise six-line field status report for generator GEN-042 using only the supplied telemetry snapshot.',
  deliverable:'One UTF-8 plain-text status report file named GEN-042__STATUS__v001.txt.',
  requiredOutputFormat:'Six lines of plain text in the requested order.',
  deadlineOrTemporalScope:'Use the supplied 2026-08-23 telemetry snapshot only.',
  knownAuthorities:'The exact user request, supplied telemetry snapshot, supplied output contract, and the operating rules included with the job.',
  availableTools:'Text processing, exact arithmetic, SHA-256 hashing, file inspection.',
  prohibitedActions:'Do not invent missing telemetry. Do not expose another independent run output to a run. Do not release bytes different from the verified product.',
  explicitRequirements:[
    'Identify generator GEN-042.',
    'Report runtime, fuel, battery voltage, oil pressure, coolant temperature, transfer-switch state, and service-due point from supplied evidence.',
    'Produce exactly six lines of plain text.',
    'Preserve source-to-requirement, requirement-to-test, execution, product, verification, and release evidence.'
  ]
};

if(out.product?.files?.[0]){
  const file=out.product.files[0];
  file.fileName='GEN-042__STATUS__v001.txt';
  file.sha256=crypto.createHash('sha256').update(file.content||'').digest('hex');
  file.size=Buffer.byteLength(file.content||'','utf8');
}
for(const a of out.artifacts||[]){
  if(a.kind==='FINISHED_PRODUCT'){
    a.fileName='GEN-042__STATUS__v001.txt';
    if(typeof a.inlineContent==='string'){
      a.sha256=crypto.createHash('sha256').update(a.inlineContent).digest('hex');
      a.size=Buffer.byteLength(a.inlineContent,'utf8');
    }
  }
}

if(Object.keys(out.stageRecords||{}).length!==30) throw new Error('Retained test project must contain exactly 30 stage records.');
if((out.generatedPrompts||[]).length!==30||(out.generatedOutputs||[]).length!==30||(out.outputReceipts||[]).length!==30) throw new Error('Retained test project must expose all 30 instructions, outputs, and receipts.');
if((out.runRecords||[]).length<20||(out.runRecords||[]).length%10!==0) throw new Error('Retained test project must preserve complete ten-run sets.');
if(/maintenance[- ]handoff/i.test(JSON.stringify(out))) throw new Error('Incorrect maintenance-handoff framing remains in the retained project.');

fs.writeFileSync(path,JSON.stringify(out,null,2)+'\n');
console.log(`materialized preserved 30-stage test project: ${out.title}`);
