import assert from 'node:assert/strict';
import fs from 'node:fs';
import {verify as oldVerify} from './.review-base.mjs';
import {verify,loadSchema} from './.review-candidate.mjs';
import {observationsFromReports,createExecutionReceipt} from './verification-evidence.mjs';
const source=fs.readFileSync('workflow-schema.js','utf8');
const properties=['targetSlotRule','requiredInputFamilies','writableFieldsRule','independenceRequired'];
function mutated(body,selector='true'){return source+`\n;(()=>{const s=globalThis.closedLoopWorkflowSchema,entries={};for(const [key,original] of Object.entries(s.STAGE_OPERATION_REGISTRY)){const contract={...original};if(${selector}){${body}}entries[key]=Object.freeze(contract);}globalThis.closedLoopWorkflowSchema=Object.freeze({...s,STAGE_OPERATION_REGISTRY:Object.freeze(entries)});})();`;}
const results=[];
for(const p of properties)for(const mode of ['missing','null']){
 const s=mutated(mode==='missing'?`delete contract.${p};`:`contract.${p}=null;`);
 assert.equal(oldVerify(s).contractClosure,'PASS');
 assert.throws(()=>verify(s),new RegExp(`OPERATION_REGISTRY_PROPERTY${mode==='null'?'_SHAPE':''}_ORACLE: .*${p}`));
 results.push(`old escapes/new rejects: ${p}/${mode}`);
}
const schema=loadSchema(source),keys=Object.keys(schema.STAGE_OPERATION_REGISTRY);
for(const p of properties){assert.throws(()=>verify(mutated(`delete contract.${p};`,`key===${JSON.stringify(keys.at(-1))}`)),new RegExp(`missing operation property ${p}`));}
for(const value of ["contract.requiredInputFamilies=[];", "contract.requiredInputFamilies=['requirements','tests'];", "contract.independenceRequired=false;", "contract.independenceRequired=true;", "contract.targetSlotRule='OTHER_REGISTERED_RULE';contract.writableFieldsRule='OTHER_VALID_RULE';"]){assert.equal(verify(mutated(value)).contractClosure,'PASS');results.push('shape-valid accepted: '+value);}
const population={};for(const p of properties)population[p]=[...new Set(Object.values(schema.STAGE_OPERATION_REGISTRY).map(x=>JSON.stringify(x[p])))];
const stdout=fs.readFileSync('/tmp/operation-review-focused.json','utf8'),focused=JSON.parse(stdout);
assert(!Object.hasOwn(focused,'contractClosure'));
assert.throws(()=>observationsFromReports('verify-contract-closure.mjs',[focused]),/expected exactly one report marker contractClosure; received 0/);
assert.throws(()=>createExecutionReceipt('verify-contract-closure.mjs',{exitCode:0,outcome:'PASS',stdout,command:['node','verify-contract-closure.mjs','--operation-registry-properties-only']},{fingerprint:{}}),/expected exactly one report marker contractClosure; received 0/);
console.log(JSON.stringify({status:'PASS',originalEscapes:8,lastEntryOmissionsRejected:4,legitimateShapeVariants:5,focusedCatalogRejected:true,focusedReceiptRejected:true,population,results},null,2));
