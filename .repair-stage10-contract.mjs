import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

function replaceExact(path,from,to,expectedCount){
  const original=fs.readFileSync(path,'utf8');
  const count=original.split(from).length-1;
  if(count!==expectedCount)throw new Error(`${path}: expected ${expectedCount} occurrence(s), found ${count}`);
  const updated=original.split(from).join(to);
  fs.writeFileSync(path,updated);
}

replaceExact(
  'workflow-schema.js',
  '"HASHES_RECORDED_WHERE_PRACTICAL":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}',
  '"ALL_FROZEN_COMPONENT_BYTES_HASHED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"}',
  1
);
replaceExact(
  'verify-complete.mjs',
  "HASHES_RECORDED_WHERE_PRACTICAL:'TRUE'",
  'ALL_FROZEN_COMPONENT_BYTES_HASHED:true',
  2
);
execFileSync(process.execPath,['build-test-project.mjs'],{stdio:'inherit'});

for(const path of ['workflow-schema.js','verify-complete.mjs','TEST_PROJECT.json']){
  if(fs.readFileSync(path,'utf8').includes('HASHES_RECORDED_WHERE_PRACTICAL'))throw new Error(`${path}: obsolete Stage 10 field remains`);
}
