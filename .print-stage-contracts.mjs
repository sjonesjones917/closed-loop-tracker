import fs from 'node:fs';import vm from 'node:vm';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const s=globalThis.closedLoopWorkflowSchema;
for(let stage=1;stage<=30;stage++)for(const op of s.STAGE_CONTRACTS[stage].operations){const c=s.operationContract(stage,op);console.log(JSON.stringify({stage,op,readCollections:c.readCollections,writeCollections:c.agentWritableCollections,stageData:c.allowedStageData,scope:c.scopeRequirements}));}