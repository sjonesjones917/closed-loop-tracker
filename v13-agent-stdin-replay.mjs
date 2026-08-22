import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const BASE_OLD = "const prompt=Buffer.from(promptB64,'base64').toString('utf8');";
const BASE_SYNC = "const prompt=promptB64?Buffer.from(promptB64,'base64').toString('utf8'):fs.readFileSync(0,'utf8');";
const BASE_NEW = "const prompt=promptB64?Buffer.from(promptB64,'base64').toString('utf8'):await new Promise((resolve,reject)=>{let text='';process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>text+=chunk);process.stdin.on('end',()=>resolve(text));process.stdin.on('error',reject)});";
const WRAPPER_OLD = "const result=spawnSync(process.execPath,['self-e2e-agent-base.mjs',stageArg,role,runArg,Buffer.from(prompt).toString('base64')],{encoding:'utf8',maxBuffer:32*1024*1024});";
const WRAPPER_NEW = "const result=spawnSync(process.execPath,['self-e2e-agent-base.mjs',stageArg,role,runArg],{encoding:'utf8',input:prompt,maxBuffer:32*1024*1024});";

function ensureAny(text, oldValues, newValue, label) {
  if (text.includes(newValue)) return text;
  for (const oldValue of oldValues) {
    if (text.includes(oldValue)) return text.replace(oldValue, newValue);
  }
  throw new Error(`${label} is neither a supported prior form nor the required current form`);
}

let base = fs.readFileSync('self-e2e-agent-base.mjs', 'utf8');
base = ensureAny(base, [BASE_OLD, BASE_SYNC], BASE_NEW, 'base agent prompt transport');
fs.writeFileSync('self-e2e-agent-base.mjs', base);

let wrapper = fs.readFileSync('self-e2e-agent.mjs', 'utf8');
wrapper = ensureAny(wrapper, [WRAPPER_OLD], WRAPPER_NEW, 'wrapper-to-base prompt transport');
if (!/if\s*\(result\.status\s*!==\s*0\)\s*throw new Error\(/.test(wrapper)) {
  throw new Error('wrapper does not report child-process failure');
}
fs.writeFileSync('self-e2e-agent.mjs', wrapper);

for (const file of ['self-e2e-agent-base.mjs', 'self-e2e-agent.mjs']) {
  const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (checked.status !== 0) throw new Error(`${file} syntax failure: ${checked.stderr || checked.stdout}`);
}

if (!fs.readFileSync('self-e2e-agent-base.mjs', 'utf8').includes(BASE_NEW)) throw new Error('base agent asynchronous stdin transport not installed');
if (!fs.readFileSync('self-e2e-agent.mjs', 'utf8').includes(WRAPPER_NEW)) throw new Error('wrapper stdin transport not installed');

console.log(JSON.stringify({
  status: 'PATCHED_OR_ALREADY_CURRENT',
  transport: 'ASYNC_STDIN',
  idempotent: true,
  eliminatesSingleArgumentSizeLimit: true,
  eliminatesSynchronousStdinEagain: true,
  files: ['self-e2e-agent-base.mjs', 'self-e2e-agent.mjs']
}));
