import fs from 'node:fs';
import vm from 'node:vm';

const dispatchedEvents=[];
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=(event)=>{dispatchedEvents.push(event?.type);return true;};
for(const file of ['workbook.js']) vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore;
if(!core) throw new Error('Workbook runtime failed to load.');
if(!dispatchedEvents.includes('closed-loop-core-ready')) throw new Error('Workbook runtime did not announce readiness.');
if(core.STAGES.length!==30) throw new Error(`Retained candidate changed stage count: ${core.STAGES.length}.`);
const workflows=fs.readdirSync('.github/workflows').filter(name=>name.endsWith('.yml')||name.endsWith('.yaml'));
if(JSON.stringify(workflows)!==JSON.stringify(['pages.yml'])) throw new Error(`Retained candidate contains competing workflow files: ${workflows.join(', ')}`);
console.log(JSON.stringify({retainedCandidateSingleWorkflow:true,stageCount:30}));
