import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const file='self-e2e-agent-base.mjs';
let source=fs.readFileSync(file,'utf8');

const oldDefinition='const correctedSidecar=artifactText.includes("SELF_VERIFIED_PROJECT.json");';
const newDefinition=`const hasExactSelfProjectPath=text=>/const SELF_PROJECT_PATH=["']SELF_VERIFIED_PROJECT\\.json["'];/.test(String(text));
const hasDefectiveSelfProjectPath=text=>/const SELF_PROJECT_PATH=["']SELF_VERIFIED_PROJEC\\.json["'];/.test(String(text));
const correctedSidecar=hasExactSelfProjectPath(artifactText);`;
if(!source.includes(newDefinition)){
  if(!source.includes(oldDefinition))throw new Error('corrected-sidecar field anchor missing');
  source=source.replace(oldDefinition,newDefinition);
}

source=source.replaceAll("raw.toString('utf8').includes('SELF_VERIFIED_PROJECT.json')","hasExactSelfProjectPath(raw.toString('utf8'))");

if(!source.includes('hasExactSelfProjectPath(raw.toString'))throw new Error('producer/verifier sidecar checks were not field-bound');
if(source.includes("raw.toString('utf8').includes('SELF_VERIFIED_PROJECT.json')"))throw new Error('broad candidate filename search remains');
if(!source.includes('hasDefectiveSelfProjectPath'))throw new Error('defective path recognizer missing');

fs.writeFileSync(file,source);
const checked=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
if(checked.status!==0)throw new Error(`${file} syntax failure: ${checked.stderr||checked.stdout}`);
console.log(JSON.stringify({
  status:'PATCHED_OR_ALREADY_CURRENT',
  file,
  defectField:'SELF_PROJECT_PATH',
  candidatePath:'SELF_VERIFIED_PROJEC.json',
  correctedPath:'SELF_VERIFIED_PROJECT.json',
  broadFilenameSearch:false
}));
