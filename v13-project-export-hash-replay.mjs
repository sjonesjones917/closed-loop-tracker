import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const file='self-browser-e2e.mjs';
let source=fs.readFileSync(file,'utf8');
const oldExpression="projectExportSha256:crypto.createHash('sha256').update(exportedBytes).digest('hex')";
const newExpression="projectExportSha256:crypto.createHash('sha256').update(projectExportBytes).digest('hex')";
if(source.includes(oldExpression))source=source.replace(oldExpression,newExpression);
else if(!source.includes(newExpression))throw new Error('project-export hash expression is neither the legacy nor current form');
if(!source.includes('const projectExportBytes=fs.readFileSync(projectDownloadPath)'))throw new Error('single visible project-export byte variable is missing');
if(source.includes("update(exportedBytes).digest('hex')"))throw new Error('report still hashes the removed duplicate export variable');
fs.writeFileSync(file,source);
const checked=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
if(checked.status!==0)throw new Error(`${file} syntax failure: ${checked.stderr||checked.stdout}`);
console.log(JSON.stringify({status:'PATCHED_OR_ALREADY_CURRENT',file,projectExportHashSource:'projectExportBytes',visibleProjectExportCount:1}));
