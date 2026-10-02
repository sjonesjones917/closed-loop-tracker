import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkedVerifier} from './verify-conformance-regressions.mjs';
import {verificationCatalog} from './verification-evidence-catalog.mjs';
import {evidenceFingerprint,readExecutionReceipts,aggregateExecutedEvidence,recordExecutionReceipt,sha} from './verification-evidence.mjs';

export async function collectVerificationEvidence({directory=process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS||'.verification-receipts',runMissing=false,outputPath=null}={}){
  const fingerprint=evidenceFingerprint(),receipts=readExecutionReceipts(directory,fingerprint);
  for(const suite of Object.keys(verificationCatalog)){
    if(receipts.has(suite))continue;
    if(!runMissing)throw new Error('EXECUTED_EVIDENCE_ORACLE: missing required current receipt '+suite);
    const stdout=await checkedVerifier(process.execPath,[suite],{encoding:'utf8',maxBuffer:64*1024*1024,env:{...process.env,CLOSED_LOOP_VERIFICATION_RECEIPTS:path.resolve(directory)}});
    const receipt=recordExecutionReceipt({command:[process.execPath,suite],stdout,stderr:'',exitCode:0,outcome:'PASS'},{directory});receipts.set(suite,receipt);
  }
  const output=aggregateExecutedEvidence(receipts,fingerprint);output.evidenceSha256=sha(output);
  if(outputPath){fs.mkdirSync(path.dirname(outputPath),{recursive:true});fs.writeFileSync(outputPath,JSON.stringify(output,null,2)+'\n');}
  return output;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const output=await collectVerificationEvidence({runMissing:process.argv.includes('--run-missing'),outputPath:process.argv.find(arg=>arg.startsWith('--out='))?.slice(6)||'.verification-receipts/evidence.json'});
  console.log(JSON.stringify({executedVerificationEvidence:'PASS',receiptCount:output.receiptCount,observationCount:output.observationCount,evidenceSha256:output.evidenceSha256,sourceCommit:output.fingerprint.sourceCommit,scopeHash:output.fingerprint.sourceInputsSha256}));
}
