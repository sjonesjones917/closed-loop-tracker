import fs from 'node:fs';
let source=fs.readFileSync('.semantic-fix.mjs','utf8');
const obsolete="  ['If no legitimate external governing source applies','If no legitimate independent external source or evidence applies'],\n";
if(!source.includes(obsolete))throw new Error('Obsolete prompt replacement line was not found.');
source=source.replace(obsolete,'').replaceAll('semanticScopeKeys','operatorScopeKeys');
const verifyStart=source.indexOf("appendOnce('verify.mjs','FINAL_SEMANTIC_EDGE_RUNTIME_ASSERTIONS'");
const verifyEnd=source.indexOf("\n\nconsole.log('Applied final semantic edge corrections.');",verifyStart);
if(verifyStart<0||verifyEnd<0)throw new Error('verify.mjs appended assertion block was not found.');
source=source.slice(0,verifyStart)+source.slice(verifyEnd+2);
const fixes=[
  ['`${engine.acceptedChanges(current,n).length&&!current.isRetainedTestProject?', '`\\${engine.acceptedChanges(current,n).length&&!current.isRetainedTestProject?'],
  ['`${acceptedLaneChanges(n).length&&!current.isRetainedTestProject?', '`\\${acceptedLaneChanges(n).length&&!current.isRetainedTestProject?'],
  ['${key}', '\\${key}']
];
for(const [from,to] of fixes){if(!source.includes(from))throw new Error(`Transformer escape target missing: ${from}`);source=source.split(from).join(to);}
fs.writeFileSync('.semantic-fix-exec.mjs',source);
await import('./.semantic-fix-exec.mjs');
