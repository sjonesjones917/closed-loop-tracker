import fs from 'node:fs';
const path='apply-reliability-patch.mjs';
let source=fs.readFileSync(path,'utf8');

const broken="},id:fields.CHAIN_ID,stage:29,active:true,scope:currentScope(project),fields:{...fields},...fields};chains.push(fields);chains[chains.length-1]={id:fields.CHAIN_ID,stage:29,active:true,scope:currentScope(project),fields:{...fields},...fields};";
const repaired="};chains.push({id:fields.CHAIN_ID,stage:29,active:true,scope:currentScope(project),fields:{...fields},...fields});";
if(!source.includes(broken))throw new Error('Expected evidence-chain patch-generator defect was not found.');
source=source.replace(broken,repaired);

function encodeRawTemplate(callMarker,endAnchor){
  const callStart=source.indexOf(callMarker);
  if(callStart<0)throw new Error(`Missing embedded-test call marker: ${callMarker}`);
  const rawStart=source.indexOf('String.raw`',callStart);
  if(rawStart<0)throw new Error(`Missing raw template after: ${callMarker}`);
  const bodyStart=rawStart+'String.raw`'.length;
  const anchorStart=source.indexOf(endAnchor,bodyStart);
  if(anchorStart<0)throw new Error(`Missing embedded-test end anchor: ${endAnchor}`);
  const closingBacktick=anchorStart+1;
  if(source[closingBacktick]!=='`')throw new Error(`Expected closing raw-template backtick for: ${callMarker}`);
  const body=source.slice(bodyStart,closingBacktick);
  source=source.slice(0,rawStart)+JSON.stringify(body)+source.slice(closingBacktick+1);
}

encodeRawTemplate("complete=appendOnce(complete,'deterministicReliabilityRouting:true'","\n`);\nwrite('verify-complete.mjs',complete);");
encodeRawTemplate("semantics=appendOnce(semantics,'contextLeakageRegression:true'","\n`);\nwrite('verify-prompt-semantics.mjs',semantics);");

fs.writeFileSync(path,source);
console.log('Patch generator syntax and embedded regression-test encoding repaired.');
