import fs from 'node:fs';
const path='.repair-ingestion-fixture-values.mjs';
let s=fs.readFileSync(path,'utf8');
const old="const new1=\"for(const name of def.required){if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)fields[name]=valueForDefinition(def.fieldDefinitions[name]);}\";";
const replacement="const new1=\"for(const name of def.required){if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)fields[name]=name==='ARTIFACT_REQUIRED'?false:valueForDefinition(def.fieldDefinitions[name]);}\";";
if(!s.includes(old))throw new Error('Generic ingestion fixture assignment anchor missing.');
s=s.replace(old,replacement);
fs.writeFileSync(path,s);
console.log('Generic ingestion fixtures no longer claim an artifact unless the test explicitly supplies one.');
