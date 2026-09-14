import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
const suites=['verify-operator-action-lifecycle.mjs','verify-shared-contract-faults.mjs','verify-operation-sequences.mjs','verify-mobile-operation-observations.mjs','verify-mobile-receipt-boundary.mjs','verify-delivery-transfer-boundary.mjs','verify-checkpoint-boundary.mjs','verify-native-proof-journey.mjs','verify-native-proof-fault.mjs','verify-product-attachment-journey.mjs'];
const sources=['app-core.js','index.html','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','test-runtime.js','test-worker.js','verify-mobile-acceptance-evidence.mjs',...suites];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const results=[];
for(const suite of suites){
 const startedAt=new Date().toISOString(),run=spawnSync(process.execPath,[suite],{encoding:'utf8',maxBuffer:64*1024*1024});
 let report=null;try{report=JSON.parse(run.stdout);}catch{}
 results.push({suite,startedAt,finishedAt:new Date().toISOString(),exitCode:run.status,stdoutSha256:sha(run.stdout||''),stderrSha256:sha(run.stderr||''),report});
 if(run.status!==0||!report){process.stderr.write(`${suite} failed:\n${run.stdout||''}\n${run.stderr||''}`);process.exitCode=1;break;}
}
console.log(JSON.stringify({schema:'closed-loop-conformance-regressions/1',sourceCommit,sourceFiles:sources.map(path=>({path,sha256:sha(fs.readFileSync(path))})),controllingSpecification:{path:'specification/closed-loop-reliability-controlling-implementation-specification.txt',sha256:sha(fs.readFileSync('specification/closed-loop-reliability-controlling-implementation-specification.txt'))},synthetic:true,completeOperatorJourney:false,physicalDeviceAcceptance:false,results},null,2));
