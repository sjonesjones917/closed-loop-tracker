import fs from 'node:fs';
const path='app-core.js';
let source=fs.readFileSync(path,'utf8');
const from='The agent should now return one final JSON response file. Select that file below.';
const to='The current external conversation is ready for its final response file. Select the returned response.json below.';
if(!source.includes(from))throw new Error('Expected external-agent directive leak was not found.');
source=source.replace(from,to);
if(/agent must |agent should |the agent should/i.test(source))throw new Error('External-agent behavioral instruction still exists outside prompt-engine.js.');
fs.writeFileSync(path,source);
