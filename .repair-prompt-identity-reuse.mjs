import fs from 'node:fs';
const path='prompt-engine.js';
let text=fs.readFileSync(path,'utf8');
const old=`  const descriptor=responseContractDescriptor(stage,operation);
  const contractSha256=hash.sha256Value(descriptor);
  const same=activeExisting.find(x=>x.contextSignature===contextSignature&&x.contractSha256===contractSha256&&x.operation===operation);
  const instructionId=same?.instructionId||same?.promptId||\`INSTRUCTION-\${String(state?.job?.JOB_ID||'UNKNOWN').replace(/[^A-Za-z0-9-]/g,'')}-S\${String(stage).padStart(2,'0')}-\${String(existing.length+1).padStart(3,'0')}\`;
  const transportRule=\`AUTHORITATIVE FILE TRANSPORT — MANDATORY\\
The complete substantive instruction is this instruction.txt file. Treat manifest.json as application-owned transport metadata and echo its promptIdentity, packageId, operationReservationId, challengeNonce, and scope exactly in response.json. Do not copy this instruction into another wrapper. Return the final authoritative response only as UTF-8 response.json plus any manifest-declared returned files. Clipboard text and pasted JSON are nonauthoritative conveniences only.\`;
  let prompt=\`\${UNTRUSTED_DATA_RULE}\\n\\n\${refreshDataEnvelopes(aliasedBody)}\\n\\n\${transportRule}\\n\`;
  prompt=prompt.replace(/\\r\\n?/g,'\\n').replace(/\\n*$/,'\\n');
  const bodySha256=hash.sha256Text(prompt);
  const promptIdentity={instructionId,bodySha256,contractSha256,contextSignature};`;
const replacement=`  const descriptor=responseContractDescriptor(stage,operation);
  const contractSha256=hash.sha256Value(descriptor);
  const transportRule=\`AUTHORITATIVE FILE TRANSPORT — MANDATORY\\
The complete substantive instruction is this instruction.txt file. Treat manifest.json as application-owned transport metadata and echo its promptIdentity, packageId, operationReservationId, challengeNonce, and scope exactly in response.json. Do not copy this instruction into another wrapper. Return the final authoritative response only as UTF-8 response.json plus any manifest-declared returned files. Clipboard text and pasted JSON are nonauthoritative conveniences only.\`;
  let prompt=\`\${UNTRUSTED_DATA_RULE}\\n\\n\${refreshDataEnvelopes(aliasedBody)}\\n\\n\${transportRule}\\n\`;
  prompt=prompt.replace(/\\r\\n?/g,'\\n').replace(/\\n*$/,'\\n');
  const bodySha256=hash.sha256Text(prompt);
  // An instruction identity may be reused only when the authoritative instruction.txt bytes are identical.
  const same=activeExisting.find(x=>x.contextSignature===contextSignature&&x.contractSha256===contractSha256&&x.operation===operation&&x.bodySha256===bodySha256);
  const instructionId=same?.instructionId||same?.promptId||\`INSTRUCTION-\${String(state?.job?.JOB_ID||'UNKNOWN').replace(/[^A-Za-z0-9-]/g,'')}-S\${String(stage).padStart(2,'0')}-\${String(existing.length+1).padStart(3,'0')}\`;
  const promptIdentity={instructionId,bodySha256,contractSha256,contextSignature};`;
const count=text.split(old).length-1;
if(count!==1)throw new Error(`Expected one prompt identity-reuse block, found ${count}.`);
text=text.replace(old,replacement);
fs.writeFileSync(path,text);

const regression=`import fs from 'node:fs';\nimport vm from 'node:vm';\nimport assert from 'node:assert/strict';\nglobalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine;const p=core.createBlankState('JOB-PROMPT-BYTE-IDENTITY-REUSE');p.job.EXACT_USER_OBJECTIVE_VERBATIM='Verify prompt identity reuse.';p.job.CURRENT_INPUT_VERSION='INPUT-v001';engine.ensureShape(p);engine.recalculate(p);const first=prompts.buildPromptRecord(1,p,{operation:'COMPLETE'});p.projectData.generatedPrompts.push({...first,generatedAt:new Date().toISOString()});p.projectData.responseValidations.push({validationId:'VALIDATION-RETRY-CONTEXT',stage:1,promptId:first.instructionId,valid:false,issues:[{code:'MALFORMED_JSON',path:'/',message:'Deliberate retry-context mutation.'}]});const second=prompts.buildPromptRecord(1,p,{operation:'COMPLETE'});assert.notEqual(second.bodySha256,first.bodySha256,'retry context must change authoritative prompt bytes');assert.notEqual(second.instructionId,first.instructionId,'changed authoritative prompt bytes must receive a new instruction identity');const source=fs.readFileSync('prompt-engine.js','utf8');assert.match(source,/x\\.bodySha256===bodySha256/);const bad=source.replace('&&x.bodySha256===bodySha256','');assert.ok(!/x\\.bodySha256===bodySha256/.test(bad),'mutation fixture must remove byte-equality binding');console.log('prompt identity reuse regression passed');\n`;
fs.writeFileSync('verify-prompt-identity-reuse.mjs',regression);
