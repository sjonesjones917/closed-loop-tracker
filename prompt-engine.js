(()=>{
'use strict';
const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const hash=globalThis.closedLoopHash;
const workflow=globalThis.closedLoopWorkflowEngine;
const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/26';
if(!core||!schema||!hash||!workflow)throw new Error('workbook.js, hash.js, workflow-schema.js, and workflow-engine.js must load before prompt-engine.js.');
const show=v=>{if(v===undefined||v===null||v==='')return 'UNKNOWN';if(Array.isArray(v)&&!v.length)return 'NONE';if(typeof v==='object')return JSON.stringify(v,null,2);return String(v)};
// Full implementation is restored by resetting this branch to the clean commit below.
throw new Error('BRANCH RESET REQUIRED');
})();