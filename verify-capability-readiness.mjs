import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine;
const p=core.createBlankState('JOB-CAPABILITY-CLOSURE');engine.ensureShape(p);
p.job.AVAILABLE_TOOLS='CAD_TOOL is available';
assert.equal(engine.capabilityAffirmativelyAvailable(p,'CAD_TOOL','EXTERNAL_AGENT_TOOL',null),false,'Human/tool prose alone must not establish CAPABILITY_READY.');
const cap={id:'CAPABILITY-TEST',active:true,scope:{inputVersion:p.job.CURRENT_INPUT_VERSION},fields:{CAPABILITY_ID:'CAPABILITY-TEST',CAPABILITY_CLAIM:'CAD_TOOL',FRESHNESS_STATUS:'CURRENT',STATUS:'CURRENT',AUTHORIZED:true,PERMISSIONS_READY:true,INPUTS_TRANSFERABLE:true,ROUTE_USABLE:true,EVIDENCE_OBTAINABLE:true}};
p.projectData.externalCapabilities.push(cap);
assert.equal(engine.evaluateCapabilityReadiness(p,'CAD_TOOL','EXTERNAL_AGENT_TOOL',null).truthValue,'TRUE');
for(const field of ['AUTHORIZED','PERMISSIONS_READY','INPUTS_TRANSFERABLE','ROUTE_USABLE','EVIDENCE_OBTAINABLE']){
  const q=structuredClone(p);q.projectData.externalCapabilities[0].fields[field]=false;
  assert.equal(engine.capabilityAffirmativelyAvailable(q,'CAD_TOOL','EXTERNAL_AGENT_TOOL',null),false,`${field}=false must block routing.`);
}
const unknown=structuredClone(p);delete unknown.projectData.externalCapabilities[0].fields.EVIDENCE_OBTAINABLE;
assert.equal(engine.evaluateCapabilityReadiness(unknown,'CAD_TOOL','EXTERNAL_AGENT_TOOL',null).truthValue,'UNKNOWN','Unknown conjunction input must remain UNKNOWN.');
const unknownFreshness=structuredClone(p);delete unknownFreshness.projectData.externalCapabilities[0].fields.FRESHNESS_STATUS;
assert.equal(engine.evaluateCapabilityReadiness(unknownFreshness,'CAD_TOOL','EXTERNAL_AGENT_TOOL',null).truthValue,'UNKNOWN','Unknown capability freshness must remain UNKNOWN.');
const stale=structuredClone(p);stale.projectData.externalCapabilities[0].fields.FRESHNESS_STATUS='EXPIRED';
assert.equal(engine.capabilityAffirmativelyAvailable(stale,'CAD_TOOL','EXTERNAL_AGENT_TOOL',null),false,'Expired capability must block.');
console.log(JSON.stringify({capabilityReadyClosedConjunction:true,proseCannotEstablishCapability:true,unknownFailsClosed:true,unknownFreshnessFailsClosed:true}));
