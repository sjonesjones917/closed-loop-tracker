import fs from 'node:fs';
let source=fs.readFileSync('.semantic-fix.mjs','utf8');
const fixes=[
  ['`${engine.acceptedChanges(current,n).length&&!current.isRetainedTestProject?', '`\\${engine.acceptedChanges(current,n).length&&!current.isRetainedTestProject?'],
  ['`${acceptedLaneChanges(n).length&&!current.isRetainedTestProject?', '`\\${acceptedLaneChanges(n).length&&!current.isRetainedTestProject?'],
  ['${key}', '\\${key}'],
  ['${token}', '\\${token}']
];
for(const [from,to] of fixes){if(!source.includes(from))throw new Error(`Transformer escape target missing: ${from}`);source=source.split(from).join(to);}
fs.writeFileSync('.semantic-fix-exec.mjs',source);
await import('./.semantic-fix-exec.mjs');
