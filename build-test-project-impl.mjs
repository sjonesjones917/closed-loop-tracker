import fs from 'node:fs';
import cp from 'node:child_process';

const project=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
if(project.jobId!=='JOB-20260823144121'||project.title!=='Mobile Closed-Loop Agent Reliability Workbook')throw new Error('Committed retained project is not the authorized project.');
if(project.currentStage!==2||project.currentState!=='READY'||project.stageRecords?.['1']?.status!=='COMPLETE')throw new Error('Committed retained project state is wrong.');
for(let n=2;n<=30;n++)if(project.stageRecords?.[String(n)]?.status!=='NOT STARTED')throw new Error(`Stage ${n} must remain NOT STARTED.`);

const probeSentinel='/tmp/closed-loop-controller-stages18-28-probe-done';
if(process.env.GITHUB_ACTIONS==='true'&&!fs.existsSync(probeSentinel)){
  fs.writeFileSync(probeSentinel,'running\n');
  const commands=[
    'verify-due-stage-timing.mjs',
    'verify-definition-of-done-invariants.mjs',
    'verify-complete.mjs',
    'verify-test-runtime-v3.mjs',
    'verify-test-runtime-limits.mjs',
    'verify-test-runtime.mjs',
    'verify-full-cycle.mjs',
    'verify-all-stage-prompts.mjs',
    'verify-data-route-closure.mjs',
    'verify-definition-of-done.mjs',
    'verify-v3-definition-of-done.mjs',
    'verify-project-lifecycle.mjs',
    'verify-file-first-operator.mjs',
    'verify-infrastructure-route-closure.mjs'
  ];
  for(const file of commands){
    const result=cp.spawnSync(process.execPath,[file],{encoding:'utf8',env:process.env,maxBuffer:128*1024*1024});
    if(result.stdout)process.stdout.write(result.stdout);
    if(result.stderr)process.stderr.write(result.stderr);
    if(result.status!==0)throw new Error(`Controller Stage 18-28 probe failed: node ${file}`);
    console.log(`CONTROLLER_PROBE_PASS ${file}`);
  }
  fs.writeFileSync(probeSentinel,'done\n');
}

console.log('Committed retained project requires no source materialization.');
