import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const STAGE01_BASE='2229af2aefd4a2f67cee4c2ca1b86c3bf5255144';
const STAGE01_HEAD='6373994ff1cdbbf36d4c8029de9654583d940e4f';
const BRANCH='repair/stage01-after-due-stage-final-20260903';
const run=(cmd,args,options={})=>execFileSync(cmd,args,{stdio:'inherit',...options});

run('git',['fetch','origin',STAGE01_BASE,STAGE01_HEAD]);
const patch=execFileSync('git',['diff','--binary',STAGE01_BASE,STAGE01_HEAD,'--','.',':(exclude)prompt-engine.js'],{encoding:'utf8'});
fs.writeFileSync('/tmp/stage01.patch',patch);
run('git',['apply','--3way','/tmp/stage01.patch']);

const promptPath='prompt-engine.js';
let prompt=fs.readFileSync(promptPath,'utf8');
const before='Classify every APPLICATION INTAKE MANIFEST unit exactly once. INPUT_SET_CONTENTS';
const after='Classify every APPLICATION INTAKE MANIFEST unit exactly once. Classify each unit using exactly one of these closed disposition values: EXTRACTED_RELEVANT_INFORMATION, RETAINED_AS_CONTEXT, NO_PROJECT_RELEVANT_INFORMATION, UNRESOLVED_HUMAN_AUTHORITY, LATER_RESOLVABLE, or INACCESSIBLE_OR_BLOCKED. INACCESSIBLE_OR_BLOCKED means required semantic content could not be inspected; report the exact blocker and do not claim Stage 01 completion. INPUT_SET_CONTENTS';
if(!prompt.includes(before)) throw new Error('Current Stage 01 prompt anchor not found; refusing unsafe merge.');
if((prompt.match(new RegExp(before.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length!==1) throw new Error('Stage 01 prompt anchor is not unique.');
prompt=prompt.replace(before,after);
fs.writeFileSync(promptPath,prompt);

for(const [file,args] of [
  ['verify-stage01-disposition-contract.mjs',[]],
  ['verify-stage01-intake-closure.mjs',[]],
  ['verify-zero-loss-accounting.mjs',[]],
  ['verify-ingestion.mjs',[]],
  ['verify-complete.mjs',[]],
  ['verify-full-cycle.mjs',[]],
  ['verify-due-stage-timing.mjs',[]],
  ['verify.mjs',[]]
]) run(process.execPath,[file,...args]);

fs.rmSync('repair-stage01-after-due-stage.mjs',{force:true});
fs.rmSync('.github/workflows/repair-stage01-after-due-stage.yml',{force:true});
run('git',['status','--short']);
console.log(JSON.stringify({repair:'stage01-after-due-stage',branch:BRANCH,stage01Head:STAGE01_HEAD,dueStagePreserved:true,temporaryScaffoldingRemoved:true}));
