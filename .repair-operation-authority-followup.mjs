import fs from 'node:fs';
const path='workflow-schema.js';
let source=fs.readFileSync(path,'utf8');
const before="agentWritableCollections:Object.freeze([...(EXTERNAL_AGENT_WRITES[key]||base?.agentWritableCollections||[])])";
const after="agentWritableCollections:Object.freeze([...(base?.agentWritableCollections||[])])";
if(!source.includes(before))throw new Error('Expected external-agent narrowing expression not found.');
source=source.replace(before,after);
fs.writeFileSync(path,source);
