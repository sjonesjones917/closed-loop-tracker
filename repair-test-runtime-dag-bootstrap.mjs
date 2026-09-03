import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const sourcePath='repair-test-runtime-dag.mjs';
const generatedPath='.repair-test-runtime-dag.compiled.mjs';
let source=fs.readFileSync(sourcePath,'utf8');

const blocks=[
  ['regexBlock',";\nreplaceBetween('function validateRegex(pattern,flags=\\'\\'){"],
  ['selectorBlock',";\nreplaceBetween('function parseJsonSelector(path){'"],
  ['dagValidation',";\nreplaceBetween('function validateSpec(spec,bindings){'"],
  ['normalizeBlock',";\nreplaceBetween('function normalizeSpec(spec){'"],
  ['executeBlock',";\nreplaceBetween('async function execute({spec,artifacts={},canonicalBindings={},metadata={}}){'"]
];

for(const [name,endMarker] of blocks){
  const startMarker=`const ${name}=\``;
  const start=source.indexOf(startMarker);
  if(start<0)throw new Error(`Missing repair block ${name}.`);
  const contentStart=start+startMarker.length;
  const markerIndex=source.indexOf(endMarker,contentStart);
  if(markerIndex<0)throw new Error(`Missing end marker for repair block ${name}.`);
  const closingTick=source.lastIndexOf('`',markerIndex);
  if(closingTick<contentStart)throw new Error(`Missing closing template delimiter for ${name}.`);
  const content=source.slice(contentStart,closingTick)
    .replace(/\\/g,'\\\\')
    .replace(/`/g,'\\`')
    .replace(/\$\{/g,'\\${');
  source=source.slice(0,contentStart)+content+source.slice(closingTick);
}

fs.writeFileSync(generatedPath,source);
const run=spawnSync(process.execPath,[generatedPath],{stdio:'inherit'});
try{fs.unlinkSync(generatedPath);}catch{}
if(run.status!==0)process.exit(run.status??1);

const ownerPath='test-runtime.js';
let owner=fs.readFileSync(ownerPath,'utf8');
const duplicate='const encoder=new TextEncoder();const encoder=new TextEncoder();';
if(!owner.includes(duplicate))throw new Error('Expected materializer duplicate declaration was not found; refusing an unreviewed repair path.');
owner=owner.replace(duplicate,'const encoder=new TextEncoder();');
fs.writeFileSync(ownerPath,owner);
