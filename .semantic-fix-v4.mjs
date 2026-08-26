import fs from 'node:fs';
let source=fs.readFileSync('.semantic-fix.mjs','utf8');
const obsolete="  ['If no legitimate external governing source applies','If no legitimate independent external source or evidence applies'],\n";
if(!source.includes(obsolete))throw new Error('Obsolete prompt replacement line was not found.');
source=source.replace(obsolete,'').replaceAll('semanticScopeKeys','operatorScopeKeys');
const fixes=[
  ['`${engine.acceptedChanges(current,n).length&&!current.isRetainedTestProject?', '`\\${engine.acceptedChanges(current,n).length&&!current.isRetainedTestProject?'],
  ['`${acceptedLaneChanges(n).length&&!current.isRetainedTestProject?', '`\\${acceptedLaneChanges(n).length&&!current.isRetainedTestProject?'],
  ['${key}', '\\${key}'],
  ['${token}', '\\${token}']
];
for(const [from,to] of fixes){if(!source.includes(from))throw new Error(`Transformer escape target missing: ${from}`);source=source.split(from).join(to);}
fs.writeFileSync('.semantic-fix-exec.mjs',source);
await import('./.semantic-fix-exec.mjs');
