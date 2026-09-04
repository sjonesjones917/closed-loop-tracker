import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const assert=(value,message)=>{if(!value)throw new Error(message);};
const run=(script)=>{
  const moduleUrl=new URL(script,import.meta.url).href;
  return spawnSync(process.execPath,['--input-type=module','-e',`import(${JSON.stringify(moduleUrl)}).then(()=>process.exit(0)).catch(error=>{console.error(error);process.exit(1);})`],{encoding:'utf8',env:process.env});
};

export function verifyProductionInstruction(){
  const source=fs.readFileSync('verify-full-cycle.mjs','utf8');
  const stage8=/data\(8,\{records:\{instructions:\[([\s\S]*?)\],instructionTraces:\[[\s\S]*?\]\}\}\);const instructionId=rid\('instructions'\);complete\(8\);/;
  assert(stage8.test(source),'Stage 08 full-cycle fixture shape changed; production-instruction verifier must be updated rather than silently weakening the oracle.');

  const baseline=run('./verify-full-cycle.mjs');
  assert(baseline.status===0,`Repaired Stage 08 full-cycle path failed.\n${baseline.stdout||''}\n${baseline.stderr||''}`);

  function executeMutation(label,mutate,expectedPattern){
    const mutated=mutate(source);
    assert(mutated!==source,`${label} mutation did not alter the Stage 08 fixture.`);
    const path=`verify-production-instruction.${label}.invalid.mjs`;
    fs.writeFileSync(path,mutated,'utf8');
    try{
      const result=run(`./${path}`),combined=`${result.stdout||''}\n${result.stderr||''}`;
      assert(result.status!==0,`${label} intentional invalid fixture was accepted.`);
      assert(expectedPattern.test(combined),`${label} failed for an unrelated reason.\n${combined}`);
      return {label,rejected:true,exitCode:result.status,observed:combined.split(/\r?\n/).filter(Boolean).slice(-8)};
    }finally{fs.rmSync(path,{force:true});}
  }

  const missingTrace=executeMutation(
    'missing-trace',
    text=>text.replace(stage8,(_whole,instructions)=>`data(8,{records:{instructions:[${instructions}]}});const instructionId=rid('instructions');complete(8);`),
    /Stage 8 gate failed|instruction trace|trace/i
  );

  const missingOutputContract=executeMutation(
    'missing-output-contract',
    text=>text.replace("OUTPUT_CONTRACT:'Structured output'","OUTPUT_CONTRACT:''"),
    /Stage 8|OUTPUT_CONTRACT|invalid|required|empty/i
  );

  const promptCompleteness=run('./verify-stage-prompts-complete.mjs');
  assert(promptCompleteness.status===0,`Stage prompt completeness replay failed.\n${promptCompleteness.stdout||''}\n${promptCompleteness.stderr||''}`);
  const promptSemantics=run('./verify-prompt-semantics.mjs');
  assert(promptSemantics.status===0,`Prompt semantic replay failed.\n${promptSemantics.stdout||''}\n${promptSemantics.stderr||''}`);

  return {
    controllerStage:'12',
    applicationStage:'08',
    productionInstruction:'PASS',
    invalidFixtures:[missingTrace,missingOutputContract],
    repairedFullCycle:true,
    stage8PromptCompleteness:true,
    stage8PromptSemantics:true,
    isolatedFixtureState:true
  };
}

if(process.argv[1]?.endsWith('verify-production-instruction.mjs'))console.log(JSON.stringify(verifyProductionInstruction(),null,2));
