import fs from 'node:fs';

const file='rebuild-self-project.mjs';
let source=fs.readFileSync(file,'utf8');
const replacements=[
  ['CURRENT-SELF-VERIFICATION','CURRENT-COMPLETE-APPLICATION-BUILD'],
  ['PROJECT-APPLICATION-SELF-VERIFICATION','PROJECT-APPLICATION-BUILD'],
  ['JOB-APPLICATION-SELF-VERIFICATION','JOB-APPLICATION-BUILD'],
  ['Self-verification','Application-build verification'],
  ['self-verification','application-build verification']
];
for(const [from,to] of replacements)source=source.split(from).join(to);
source=source.replace("currentProject.legacyProjectMetadata?.jobId||'JOB-APPLICATION-BUILD'","'JOB-APPLICATION-BUILD'");
if(/self-verification/i.test(source))throw new Error('Residual self-verification terminology remains in the retained project generator.');
if(source.includes('currentProject.legacyProjectMetadata?.jobId'))throw new Error('The generator still inherits an obsolete legacy job identity.');
fs.writeFileSync(file,source);
console.log(JSON.stringify({status:'PASS',retainedProjectScope:'COMPLETE_APPLICATION_BUILD',legacyJobIdentityInherited:false,replacements:replacements.map(([from,to])=>({from,to}))},null,2));
