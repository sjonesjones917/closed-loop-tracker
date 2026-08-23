import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const file='build-v13-self.mjs';
let source=fs.readFileSync(file,'utf8');

const replacements=[
  {
    old:"const origins=[...t.matchAll(/(?:^|\\n)\\s*ORIGIN\\s*[:=]\\s*([A-Z_]+)/gim)].map(m=>m[1].toUpperCase());\n    for(const origin of origins)if(!['USER_REQUIREMENT','EXTERNALLY_GOVERNED_REQUIREMENT'].includes(origin))throw Error(`Stage 4 rejected unsupported requirement origin: ${origin}.`);",
    next:"const origins=[...t.matchAll(/\\bORIGIN\\s*[:=]\\s*([A-Z_]+)/gim)].map(m=>m[1].toUpperCase());\n    if(!origins.length)throw Error('Stage 4 must contain at least one explicit ORIGIN field.');\n    for(const origin of origins)if(!['USER_REQUIREMENT','EXTERNALLY_GOVERNED_REQUIREMENT'].includes(origin))throw Error(`Stage 4 rejected unsupported requirement origin: ${origin}.`);",
    label:'application Stage 4 validator'
  },
  {
    old:"const origins=[...text.matchAll(/(?:^|\\n)\\s*ORIGIN\\s*[:=]\\s*([A-Z_]+)/gim)].map(m=>m[1].toUpperCase());\n    for(const origin of origins)if(!['USER_REQUIREMENT','EXTERNALLY_GOVERNED_REQUIREMENT'].includes(origin))throw new Error(`Unsupported requirement origin: ${origin}.`);",
    next:"const origins=[...text.matchAll(/\\bORIGIN\\s*[:=]\\s*([A-Z_]+)/gim)].map(m=>m[1].toUpperCase());\n    if(!origins.length)throw new Error('Stage 4 must contain at least one explicit ORIGIN field.');\n    for(const origin of origins)if(!['USER_REQUIREMENT','EXTERNALLY_GOVERNED_REQUIREMENT'].includes(origin))throw new Error(`Unsupported requirement origin: ${origin}.`);",
    label:'core Stage 4 validator'
  }
];

for(const {old,next,label} of replacements){
  if(source.includes(old))source=source.replace(old,next);
  else if(!source.includes(next))throw new Error(`${label} anchor missing`);
}

if(source.includes("matchAll(/(?:^|\\n)\\s*ORIGIN"))throw new Error('A line-start-only ORIGIN parser remains.');
if(!source.includes("matchAll(/\\bORIGIN\\s*[:=]"))throw new Error('Boundary-based ORIGIN parsing was not installed.');

fs.writeFileSync(file,source);
const syntax=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
if(syntax.status!==0)throw new Error(`${file} syntax failure: ${syntax.stderr||syntax.stdout}`);
console.log(JSON.stringify({status:'PATCHED_OR_ALREADY_CURRENT',file,stage4PermittedOrigins:['USER_REQUIREMENT','EXTERNALLY_GOVERNED_REQUIREMENT'],unsupportedInlineOriginRejected:true,originFieldRequired:true}));