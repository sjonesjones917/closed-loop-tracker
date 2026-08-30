import fs from 'node:fs';
const path='repair-stage01-intake-closure.mjs';
let s=fs.readFileSync(path,'utf8');
const old="schema=schema.replace(stage1Override,match=>match.replace(/\\}\\),$/,") + "\"}),INTAKE_ACCOUNTING:Object.freeze({valueType:'OBJECT_ARRAY',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:Object.freeze(['inputId','disposition','statementTempKeys','reason'])})}),\"));";
const replacement="schema=schema.replace(stage1Override,match=>match.slice(0,-3)+\",INTAKE_ACCOUNTING:Object.freeze({valueType:'OBJECT_ARRAY',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:Object.freeze(['inputId','disposition','statementTempKeys','reason'])})}),\");";
if(!s.includes(old))throw new Error('Expected faulty Stage 01 schema transformation not found.');
s=s.replace(old,replacement);
fs.writeFileSync(path,s);
console.log('fix-repair-generator: PASS');
