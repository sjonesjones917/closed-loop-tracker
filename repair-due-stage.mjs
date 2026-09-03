import fs from 'node:fs';
const path='workflow-engine.js';
let source=fs.readFileSync(path,'utf8');
const repairs=[
  ["CURRENT_SOURCE_SET_VERSION='NOT APPLICABLE'","CURRENT_SOURCE_SET_VERSION=null"],
  ['deliveryRecords:27,deploymentManifests:1','deliveryRecords:30,deploymentManifests:1']
];
for(const [from,to] of repairs){
  const count=source.split(from).length-1;
  if(count!==1)throw new Error(`Expected exactly one ratchet repair target for ${from}; found ${count}.`);
  source=source.replace(from,to);
}
fs.writeFileSync(path,source);
console.log(JSON.stringify({ratchetRepair:'CURRENT_MAIN_ENGINE_FIXES_RESTORED'}));
