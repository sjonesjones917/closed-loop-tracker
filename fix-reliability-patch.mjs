import fs from 'node:fs';
const path='apply-reliability-patch.mjs';
let source=fs.readFileSync(path,'utf8');
const broken="},id:fields.CHAIN_ID,stage:29,active:true,scope:currentScope(project),fields:{...fields},...fields};chains.push(fields);chains[chains.length-1]={id:fields.CHAIN_ID,stage:29,active:true,scope:currentScope(project),fields:{...fields},...fields};";
const repaired="};chains.push({id:fields.CHAIN_ID,stage:29,active:true,scope:currentScope(project),fields:{...fields},...fields});";
if(!source.includes(broken))throw new Error('Expected evidence-chain patch-generator defect was not found.');
source=source.replace(broken,repaired);
fs.writeFileSync(path,source);
console.log('Patch generator syntax repaired.');
