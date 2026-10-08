import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkedVerifier,runVerifier} from './verify-conformance-regressions.mjs';
import {verificationCatalog,browserVerificationCatalog} from './verification-evidence-catalog.mjs';
import {evidenceFingerprint,readExecutionReceipts,aggregateExecutedEvidence,validateExecutionReceipt,createExecutionReceipt,sha} from './verification-evidence.mjs';

export async function executeEvidenceProducer(suite,{directory,cwd=process.cwd(),environment=process.env,fingerprint=evidenceFingerprint(cwd),evidenceDirectory,timeout}={}){
  if(!verificationCatalog[suite])throw new Error('EXECUTED_EVIDENCE_ORACLE: unregistered producer '+suite);
  const receiptDirectory=path.resolve(cwd,directory),preload=fileURLToPath(new URL('./verification-evidence-preload.mjs',import.meta.url));
  // The child owns its report and diagnostics. Inherited descendant output is
  // useful runner evidence, but is not part of that child's emitted JSON report.
  // Explicit preload also protects standalone --run-missing invocations while
  // preserving all ordinary NODE_OPTIONS supplied by the caller.
  await checkedVerifier(process.execPath,['--import',preload,path.resolve(cwd,suite)],{cwd,encoding:'utf8',maxBuffer:64*1024*1024,evidenceDirectory,timeout,env:{...environment,CLOSED_LOOP_VERIFICATION_SOURCE_ROOT:path.resolve(cwd),CLOSED_LOOP_VERIFICATION_RECEIPTS:receiptDirectory}});
  const file=path.join(receiptDirectory,suite+'.json');
  if(!fs.existsSync(file))throw new Error('EXECUTED_EVIDENCE_ORACLE: successful producer did not persist its own receipt '+suite);
  return validateExecutionReceipt(JSON.parse(fs.readFileSync(file,'utf8')),suite,fingerprint);
}

export async function executeBrowserEvidenceProducer(suite,{scope,directory=process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS||'.verification-receipts',cwd=process.cwd(),environment=process.env}={}){
  const definition=browserVerificationCatalog[suite];if(!definition||!['LOCAL','DEPLOYED'].includes(scope))throw new Error('EXECUTED_EVIDENCE_ORACLE: invalid browser producer/scope');
  const {validateSite}=await import('./verified-site.mjs'),site=environment.STATIC_SITE_ROOT||environment.VERIFIED_SITE_DIR;
  if(!site)throw new Error('EXECUTED_EVIDENCE_ORACLE: browser proof requires the retained built site');
  const manifest=validateSite(path.resolve(cwd,site)),fingerprint=evidenceFingerprint(cwd),file=path.resolve(cwd,directory,'browser',scope,suite+'.json');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  // Invalidate the current slot before execution. A failed new attempt cannot
  // leave an old successful receipt masquerading as that attempt's evidence.
  if(fs.existsSync(file)){const retained=file+'.'+sha(fs.readFileSync(file))+'.superseded';fs.renameSync(file,retained);}
  const result=await runVerifier(process.execPath,[path.resolve(cwd,suite)],{cwd,timeout:definition.timeoutMs,maxBuffer:64*1024*1024,env:{...environment,CLOSED_LOOP_BROWSER_SCOPE:scope,CLOSED_LOOP_BROWSER_SOURCE_COMMIT:fingerprint.sourceCommit}});
  process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
  if(evidenceFingerprint(cwd).sourceInputsSha256!==fingerprint.sourceInputsSha256)throw new Error('EXECUTED_EVIDENCE_ORACLE: browser source changed during execution');
  const receipt=createExecutionReceipt(suite,result,{cwd,fingerprint,browser:{scope,manifest}});
  const temporary=file+'.partial';fs.writeFileSync(temporary,JSON.stringify(receipt,null,2)+'\n');fs.renameSync(temporary,file);return receipt;
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
  const browserSuite=process.argv.find(arg=>arg.startsWith('--browser-suite='))?.slice(16);
  if(browserSuite){await executeBrowserEvidenceProducer(browserSuite,{scope:process.argv.find(arg=>arg.startsWith('--browser-scope='))?.slice(16)});}else {
  const output=await collectVerificationEvidence({runMissing:process.argv.includes('--run-missing'),outputPath:process.argv.find(arg=>arg.startsWith('--out='))?.slice(6)||'.verification-receipts/evidence.json'});
  console.log(JSON.stringify({executedVerificationEvidence:'PASS',receiptCount:output.receiptCount,observationCount:output.observationCount,evidenceSha256:output.evidenceSha256,sourceCommit:output.fingerprint.sourceCommit,scopeHash:output.fingerprint.sourceInputsSha256}));
  }
}
