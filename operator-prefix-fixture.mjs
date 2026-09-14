import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

// A disposable synthetic project progressed by the production commands and
// response-ingestion API. This is not browser, human, or external-agent evidence.
export function operatorPrefixFixture(stage,{initialFailure=false}={}){
  if(!Number.isInteger(stage)||stage<1||stage>30)throw new RangeError('Invalid workflow stage');
  const directory=fs.mkdtempSync(path.join(process.env.TMPDIR||process.cwd(),'operator-prefix-'));
  try{
    const file=path.join(directory,'project.json');
    execFileSync(process.execPath,['verify-operator-counterpart.mjs'],{encoding:'utf8',maxBuffer:16*1024*1024,env:{...process.env,CLRT_COUNTERPART_FAULT:'',CLRT_COUNTERPART_STAGE_LIMIT:String(stage),CLRT_COUNTERPART_PROJECT_FILE:file,CLRT_COUNTERPART_INITIAL_FAILURE:initialFailure?'1':'0'}});
    return fs.readFileSync(file,'utf8');
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
}
