import fs from 'node:fs';

const enginePath='workflow-engine.js';
let engine=fs.readFileSync(enginePath,'utf8');
const before="const disposition=String(unit?.disposition||'').trim().toUpperCase();if(!INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition))";
const after="const disposition=String(unit?.disposition||'').trim();if(!INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition))";
if(!engine.includes(before))throw new Error('Expected Stage 01 normalized enum validator not found.');
engine=engine.replace(before,after);
if(engine.includes(before))throw new Error('Stage 01 normalized enum validator replacement was not unique.');
fs.writeFileSync(enginePath,engine);

const testPath='verify-stage01-controlling-dispositions.mjs';
let test=fs.readFileSync(testPath,'utf8');
const marker="for(const disposition of ['EXTRACTED_RELEVANT_INFORMATION','RETAINED_AS_CONTEXT','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE']){";
if(!test.includes(marker))throw new Error('Expected Stage 01 disposition regression marker not found.');
const regression=`for(const disposition of ['retained_as_context','Retained_As_Context','extracted_relevant_information']){\n const p=make(),r=engine.evaluateIntakeAccounting(p,{capture:capture(p,disposition,true)});assert.equal(r.complete,false,\`Noncanonical case variant \\${disposition} must be rejected by the exact closed enum.\`);assert(r.reasons.some(x=>/invalid disposition/i.test(x)),\`Case-variant rejection reason missing for \\${disposition}.\`);\n}\n`;
test=test.replace(marker,regression+marker);
fs.writeFileSync(testPath,test);

for(const path of ['.repair-stage01-exact-enum.mjs','.github/workflows/repair-stage01-exact-enum.yml'])if(fs.existsSync(path))fs.unlinkSync(path);
