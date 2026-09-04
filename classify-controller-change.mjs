import fs from 'node:fs';
import cp from 'node:child_process';

const STATE_PATH='verification/closed-loop-build-state.json';
const PROOF_RE=/^verification\/build-stages\/stage-(\d{2})-proof\.json$/;

export function classifyControllerChange(paths){
  const normalized=[...new Set((Array.isArray(paths)?paths:[]).filter(value=>typeof value==='string'&&value.length>0))].sort();
  if(normalized.length!==2||!normalized.includes(STATE_PATH))return {controllerProofOnly:false,stage:null,paths:normalized};
  const proofPath=normalized.find(path=>path!==STATE_PATH);
  const match=PROOF_RE.exec(proofPath||'');
  if(!match||Number(match[1])<3||Number(match[1])>28)return {controllerProofOnly:false,stage:null,paths:normalized};
  return {controllerProofOnly:true,stage:match[1],paths:normalized};
}

function main(){
  const base=String(process.env.CONTROLLER_BASE_COMMIT||process.argv[2]||'').trim();
  if(!/^[0-9a-f]{40}$/i.test(base)||/^0{40}$/.test(base)){
    const result={controllerProofOnly:false,stage:null,paths:[],reason:'BASE_COMMIT_UNAVAILABLE'};
    if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`controller_proof_only=false\ncontroller_stage=\n`);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  const diff=cp.execFileSync('git',['diff','--name-only',base,'HEAD'],{encoding:'utf8'}).split(/\r?\n/).filter(Boolean);
  const result=classifyControllerChange(diff);
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`controller_proof_only=${result.controllerProofOnly}\ncontroller_stage=${result.stage||''}\n`);
  process.stdout.write(`${JSON.stringify({...result,baseCommit:base,headCommit:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()})}\n`);
}

if(import.meta.url===new URL(`file://${process.argv[1]}`).href)main();
