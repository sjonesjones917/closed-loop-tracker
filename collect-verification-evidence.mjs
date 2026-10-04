import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkedVerifier} from './verify-conformance-regressions.mjs';
import {verificationCatalog} from './verification-evidence-catalog.mjs';
import {evidenceFingerprint,readExecutionReceipts,aggregateExecutedEvidence,validateExecutionReceipt,sha} from './verification-evidence.mjs';

export async function executeEvidenceProducer(suite,{directory,cwd=process.cwd(),environment=process.env,fingerprint=evidenceFingerprint(cwd),evidenceDirectory}={}){
  if(!verificationCatalog[suite])throw new Error('EXECUTED_EVIDENCE_ORACLE: unregistered producer '+suite);
  const receiptDirectory=path.resolve(cwd,directory),preload=fileURLToPath(new URL('./verification-evidence-preload.mjs',import.meta.url));
  // The child owns its report and diagnostics. Inherited descendant output is
  // useful runner evidence, but is not part of that child's emitted JSON report.
  // Explicit preload also protects standalone --run-missing invocations while
  // preserving all ordinary NODE_OPTIONS supplied by the caller.
  await checkedVerifier(process.execPath,['--import',preload,path.resolve(cwd,suite)],{cwd,encoding:'utf8',maxBuffer:64*1024*1024,evidenceDirectory,env:{...environment,CLOSED_LOOP_VERIFICATION_SOURCE_ROOT:path.resolve(cwd),CLOSED_LOOP_VERIFICATION_RECEIPTS:receiptDirectory}});
  const file=path.join(receiptDirectory,suite+'.json');
  if(!fs.existsSync(file))throw new Error('EXECUTED_EVIDENCE_ORACLE: successful producer did not persist its own receipt '+suite);
  return validateExecutionReceipt(JSON.parse(fs.readFileSync(file,'utf8')),suite,fingerprint);
}

export async function collectVerificationEvidence({directory=process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS||'.verification-receipts',runMissing=false,outputPath=null}={}){
  const fingerprint=evidenceFingerprint(),receipts=readExecutionReceipts(directory,fingerprint);
  for(const suite of Object.keys(verificationCatalog)){
    if(receipts.has(suite))continue;
    if(!runMissing)throw new Error('EXECUTED_EVIDENCE_ORACLE: missing required current receipt '+suite);
    const receipt=await executeEvidenceProducer(suite,{directory,fingerprint});receipts.set(suite,receipt);
  }
  const output=aggregateExecutedEvidence(receipts,fingerprint);output.evidenceSha256=sha(output);
  if(outputPath){fs.mkdirSync(path.dirname(outputPath),{recursive:true});fs.writeFileSync(outputPath,JSON.stringify(output,null,2)+'\n');}
  return output;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const output=await collectVerificationEvidence({runMissing:process.argv.includes('--run-missing'),outputPath:process.argv.find(arg=>arg.startsWith('--out='))?.slice(6)||'.verification-receipts/evidence.json'});
  console.log(JSON.stringify({executedVerificationEvidence:'PASS',receiptCount:output.receiptCount,observationCount:output.observationCount,evidenceSha256:output.evidenceSha256,sourceCommit:output.fingerprint.sourceCommit,scopeHash:output.fingerprint.sourceInputsSha256}));
}
