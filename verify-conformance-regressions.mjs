import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
const suites=['verify-history-selection-capture.mjs','verify-history-selection-fault.mjs','verify-context-provenance.mjs','verify-ui-acceptance-impact.mjs','verify-clarification-continuation.mjs','verify-acceptance-boundary-faults.mjs','verify-mutation-impact-projections.mjs','verify-response-selection-status.mjs','verify-file-correction-recovery.mjs','verify-file-correction-faults.mjs','verify-history-view-cost.mjs','verify-quarantine-recovery.mjs','verify-integrity-recovery-faults.mjs','verify-ui-persistence-preconditions.mjs','verify-filename-transports.mjs','verify-unicode-filenames.mjs','verify-unicode-faults.mjs','verify-encrypted-backups.mjs','verify-encrypted-backup-faults.mjs','verify-canonical-allocation.mjs','verify-canonical-allocation-faults.mjs','verify-operational-persistence.mjs','verify-operational-faults.mjs','verify-recoverable-history.mjs','verify-history-contracts.mjs','verify-history-sequences.mjs','verify-history-navigation.mjs','verify-history-project-lifecycle.mjs','verify-history-retention.mjs','verify-recovery-faults.mjs','verify-operator-action-lifecycle.mjs','verify-shared-contract-faults.mjs','verify-operation-sequences.mjs','verify-mobile-operation-observations.mjs','verify-mobile-receipt-boundary.mjs','verify-delivery-transfer-boundary.mjs','verify-checkpoint-boundary.mjs','verify-native-proof-journey.mjs','verify-native-proof-fault.mjs','verify-product-attachment-journey.mjs','verify-operator-counterpart.mjs','verify-counterpart-faults.mjs','verify-execution-identity-allocation.mjs','verify-project-identity-allocation.mjs','verify-response-retry-persistence.mjs','verify-response-retry-fault.mjs'];
const sources=['app-core.js','index.html','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','test-runtime.js','test-worker.js','verify-mobile-acceptance-evidence.mjs',...suites];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const sourceFiles=sources.map(path=>({path,sha256:sha(fs.readFileSync(path))})),workingTreeChanges=execFileSync('git',['status','--porcelain','--',...sources],{encoding:'utf8'}).trim();
const results=[];
for(const suite of suites){
 process.stderr.write(`Running ${suite}\n`);
 const startedAt=new Date().toISOString(),run=spawnSync(process.execPath,[suite],{encoding:'utf8',maxBuffer:64*1024*1024});
 let report=null;try{report=JSON.parse(run.stdout);}catch{}
 results.push({suite,startedAt,finishedAt:new Date().toISOString(),exitCode:run.status,stdoutSha256:sha(run.stdout||''),stderrSha256:sha(run.stderr||''),report});
 if(run.status!==0||!report){process.stderr.write(`${suite} failed:\n${run.stdout||''}\n${run.stderr||''}`);process.exitCode=1;break;}
}
const sourceFilesAtFinish=sources.map(path=>({path,sha256:sha(fs.readFileSync(path))})),sourceChangedDuringRun=JSON.stringify(sourceFiles)!==JSON.stringify(sourceFilesAtFinish);
if(sourceChangedDuringRun){process.stderr.write('Verification sources changed during this run; the result is not an integrated revision proof.\n');process.exitCode=1;}
console.log(JSON.stringify({schema:'closed-loop-conformance-regressions/1',sourceCommit,workingTreeChanges:workingTreeChanges||null,sourceChangedDuringRun,sourceFiles,sourceFilesAtFinish,controllingSpecification:{path:'specification/closed-loop-reliability-controlling-implementation-specification.txt',sha256:sha(fs.readFileSync('specification/closed-loop-reliability-controlling-implementation-specification.txt'))},synthetic:true,completeOperatorJourney:false,physicalDeviceAcceptance:false,results},null,2));
