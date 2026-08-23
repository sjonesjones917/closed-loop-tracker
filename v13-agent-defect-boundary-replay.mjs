import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const file='self-e2e-agent-base.mjs';
let source=fs.readFileSync(file,'utf8');

const broadDefinition='const correctedSidecar=artifactText.includes("SELF_VERIFIED_PROJECT.json");';
const broadRuntime="raw.toString('utf8').includes('SELF_VERIFIED_PROJECT.json')";
const directFieldDefinition=`const exactSidecarPath=text=>/const\\s+SELF_PROJECT_PATH\\s*=\\s*["']SELF_VERIFIED_PROJECT\\.json["']\\s*;/.test(text);
const correctedSidecar=exactSidecarPath(artifactText);`;

if(source.includes(broadDefinition)){
  source=source.replace(broadDefinition,directFieldDefinition);
}
source=source.replaceAll(broadRuntime,"exactSidecarPath(raw.toString('utf8'))");

const hasFieldFunction=/const\s+(?:exactSidecarPath|hasExactSelfProjectPath)\s*=/.test(source);
const producerVerifierFieldChecks=/(?:exactSidecarPath|hasExactSelfProjectPath)\(raw\.toString\('utf8'\)\)/.test(source);
if(!hasFieldFunction)throw new Error('exact SELF_PROJECT_PATH recognizer missing');
if(!producerVerifierFieldChecks)throw new Error('producer/verifier sidecar checks are not bound to SELF_PROJECT_PATH');
if(source.includes(broadDefinition)||source.includes(broadRuntime))throw new Error('broad candidate filename search remains');

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
