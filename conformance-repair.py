from pathlib import Path
p=Path('workflow-schema.js')
s=p.read_text()
marker='/* OPERATION REGISTRY COMPATIBILITY AUTHORITY /1 */'
if marker not in s:
    s += r'''
/* OPERATION REGISTRY COMPATIBILITY AUTHORITY /1 */
;(()=>{
'use strict';
const b=globalThis.closedLoopWorkflowSchema;if(!b?.STAGE_OPERATION_REGISTRY)throw new Error('Closed operation registry must exist before compatibility authority.');
const external=(c)=>c.executorClass==='EXTERNAL_AGENT'||c.executorClass==='ROUTED';
const registry=Object.freeze(Object.fromEntries(Object.entries(b.STAGE_OPERATION_REGISTRY).map(([key,c])=>{
  const stage=Number(c.stage),legacy=b.STAGE_CONTRACTS?.[stage]||{};
  const agentWritableCollections=Object.freeze(external(c)?[...(c.writableFamilies||[])]:[]);
  const allowedStageData=Object.freeze(external(c)?[...(legacy.allowedStageData||[])]:[]);
  const scopeRequirements=Object.freeze(Object.entries(c.scopeContract||{}).filter(([,kind])=>kind!=='APPLICATION_DERIVED').map(([name])=>name));
  return [key,Object.freeze({...c,agentWritableCollections,allowedStageData,scopeRequirements})];
})));
function operationContract(stage,operation){const key=`${Number(stage)}:${String(operation||'')}`;const c=registry[key];if(!c)throw new Error(`Unknown stage-operation ${key}`);return c;}
globalThis.closedLoopWorkflowSchema=Object.freeze({...b,STAGE_OPERATION_REGISTRY:registry,operationContract});
})();
'''
p.write_text(s)

Path('verify-operation-authority-compatibility.mjs').write_text(r'''import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';class Event{constructor(type){this.type=type}}const c={console,crypto:webcrypto,TextEncoder,TextDecoder,structuredClone,Uint8Array,ArrayBuffer,Date,Math,JSON,Set,Map,Event,dispatchEvent:()=>true};c.globalThis=c;vm.createContext(c);for(const f of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});const s=c.closedLoopWorkflowSchema;
for(const key of ['18:COMPLETE','22:RUN_NATIVE_TESTS','24:RUN_NATIVE_ATTACKS','25:FREEZE_DELIVERY_CANDIDATE','27:CALCULATE_RELEASE','29:CALCULATE_EVIDENCE_CHAINS','30:CALCULATE_TERMINAL']){const o=s.STAGE_OPERATION_REGISTRY[key];assert.deepEqual([...o.agentWritableCollections],[],`${key} legacy writable alias must stay closed`);assert.deepEqual([...o.allowedStageData],[],`${key} application command cannot accept agent stage data`);assert.equal(o.acceptsExternalResponse,false);}
const advisory=s.operationContract(27,'ADVISORY_REVIEW');assert.deepEqual([...advisory.agentWritableCollections],['releaseGateReviews']);assert.equal(advisory.acceptsExternalResponse,true);
const verify=s.operationContract(12,'VERIFY');assert.ok(verify.scopeRequirements.includes('runId'));assert.ok(verify.scopeRequirements.includes('requirementsVersion'));assert.ok(verify.scopeRequirements.includes('testSuiteVersion'));
assert.equal(typeof c.closedLoopPromptEngine?.buildPromptRecord,'function','prompt engine must still load against closed operation registry');
console.log('operation authority compatibility regression passed');
''')
