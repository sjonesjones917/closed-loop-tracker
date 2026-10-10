import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {evidenceFingerprint,validateExecutionReceipt} from './verification-evidence.mjs';

const suite='verify-due-stage-timing.mjs';

export function currentDeferredMatrixReceipt({required=false}={}){
 const directory=process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS;
 const file=directory&&path.join(directory,suite+'.json');
 if(!file||!fs.existsSync(file)){
  if(required)throw new Error('The complete deferred stage matrix receipt is missing.');
  return null;
 }
 return validateExecutionReceipt(JSON.parse(fs.readFileSync(file,'utf8')),suite,evidenceFingerprint());
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const receipt=currentDeferredMatrixReceipt({required:true});
 console.log(JSON.stringify({deferredMatrixReceipt:'PASS',suite,sourceCommit:receipt.fingerprint.sourceCommit,receiptSha256:receipt.receiptSha256,observations:receipt.observations.length}));
}
