import fs from 'node:fs';
const path='.repair-test-ir.mjs',lines=fs.readFileSync(path,'utf8').split('\n');
const hits=lines.map((line,index)=>line.includes("prompt Test IR capability block")?index:-1).filter(index=>index>=0);
if(hits.length!==1)throw new Error(`Expected one broken prompt Test IR patch line, found ${hits.length}.`);
const index=hits[0];
lines.splice(index,1,
  " const handoffMarker='${(()=>{const plan=verificationBatchPlan(stage,state,operation,scope)';",
  " const irBlock='${stage===6?(\"CLOSED LOOP TEST IR\\\\nVERSION: \"+schema.TEST_IR_VERSION+\"\\\\nSUPPORTED GENERIC OPERATIONS: \"+schema.TEST_IR_OPERATIONS.join(\", \")+\"\\\\nSUPPORTED EXECUTABLE KINDS: \"+schema.TEST_IR_IMPLEMENTED_KINDS.join(\", \")+\"\\\\nSECURITY BOUNDARY: ARBITRARY_JAVASCRIPT, ARBITRARY_PYTHON, SHELL_COMMAND, eval, Function constructors, and invented operations are prohibited. CUSTOM_PIPELINE composes only registered generic operations. The runtime is subject/domain blind.\\\\n\\\\n\"):\"\"}';",
  " s=one(s,handoffMarker,irBlock+handoffMarker,'prompt Test IR capability block');"
);
let text=lines.join('\n');
const oldStage19='s=one(s,"19:Object.freeze([\'EXECUTE_RUN\',\'VERIFY\',\'COMPARE\',\'REGRESSION_VERIFY\',\'CONFIRM\'])","19:Object.freeze([\'CONFIRM_FREEZE\',\'EXECUTE_RUN\',\'VERIFY\',\'COMPARE\',\'REGRESSION_VERIFY\',\'CONFIRM\'])",\'Stage 19 CONFIRM_FREEZE\');';
const newStage19='s=one(s,"STAGE_OPERATIONS[19]=Object.freeze([\'EXECUTE_RUN\',\'VERIFY\',\'COMPARE\',\'REGRESSION_VERIFY\',\'CONFIRM\']);","STAGE_OPERATIONS[19]=Object.freeze([\'CONFIRM_FREEZE\',\'EXECUTE_RUN\',\'VERIFY\',\'COMPARE\',\'REGRESSION_VERIFY\',\'CONFIRM\']);",\'Stage 19 CONFIRM_FREEZE\');';
if(!text.includes(oldStage19))throw new Error('Expected Stage 19 repair-script target was not found.');
text=text.replace(oldStage19,newStage19);
fs.writeFileSync(path,text);
console.log(JSON.stringify({fixed:true,promptLine:index+1,stage19Target:true}));
