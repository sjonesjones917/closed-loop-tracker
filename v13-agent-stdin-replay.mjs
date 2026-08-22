import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const replaceSupported = (text, oldValue, newValue, label) => {
  if (text.includes(newValue)) return text;
  if (!text.includes(oldValue)) throw new Error(`${label} patch anchor missing`);
  return text.replace(oldValue, newValue);
};

let base = fs.readFileSync('self-e2e-agent-base.mjs', 'utf8');
base = replaceSupported(
  base,
  "const prompt=Buffer.from(promptB64,'base64').toString('utf8');",
  "const prompt=promptB64?Buffer.from(promptB64,'base64').toString('utf8'):fs.readFileSync(0,'utf8');",
  'base agent stdin prompt'
);
fs.writeFileSync('self-e2e-agent-base.mjs', base);

let wrapper = fs.readFileSync('self-e2e-agent.mjs', 'utf8');
wrapper = replaceSupported(
  wrapper,
  "const result=spawnSync(process.execPath,['self-e2e-agent-base.mjs',stageArg,role,runArg,Buffer.from(prompt).toString('base64')],{encoding:'utf8',maxBuffer:32*1024*1024});",
  "const result=spawnSync(process.execPath,['self-e2e-agent-base.mjs',stageArg,role,runArg],{encoding:'utf8',input:prompt,maxBuffer:32*1024*1024});",
  'wrapper-to-base stdin dispatch'
);
wrapper = replaceSupported(
  wrapper,
  "if(result.status!==0)throw new Error(`Base external agent failed: ${result.stderr||result.stdout}`);",
  "if(result.status!==0)throw new Error(`Base external agent failed: ${result.error?.stack||result.stderr||result.stdout||`exit status ${result.status}`}`);",
  'wrapper spawn failure diagnostics'
);
fs.writeFileSync('self-e2e-agent.mjs', wrapper);

for (const file of ['self-e2e-agent-base.mjs', 'self-e2e-agent.mjs']) {
  const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (checked.status !== 0) throw new Error(`${file} syntax failure: ${checked.stderr || checked.stdout}`);
}

console.log(JSON.stringify({
  status: 'PATCHED',
  transport: 'STDIN',
  eliminatesSingleArgumentSizeLimit: true,
  files: ['self-e2e-agent-base.mjs', 'self-e2e-agent.mjs']
}));
