import fs from 'node:fs';
import path from 'node:path';
import {verificationCatalog} from './verification-evidence-catalog.mjs';
import {recordExecutionReceipt,evidenceFingerprint,sha,RECEIPT_SCHEMA} from './verification-evidence.mjs';

const suite=path.basename(process.argv[1]||'');

// Hosted-log-independent failure visibility. A required verifier that exits
// non-zero reports its suite, exit code and error as one GitHub annotation, so
// the cause is readable through the checks API even where job logs cannot be
// downloaded. It only observes (uncaughtExceptionMonitor and a bounded stderr
// tail), never changes output bytes, exit codes or receipts, and does nothing
// outside GitHub Actions.
// Only the outermost Node process (the one the workflow invokes) annotates; it
// marks its environment so every descendant stays byte-for-byte unchanged.
// Verifiers spawn controlled failing children and assert their exact stderr,
// so a descendant must never append an annotation to its own output.
const failureAnnotationNested=process.env.CLOSED_LOOP_FAILURE_ANNOTATION_OWNER==='1';
if(process.env.GITHUB_ACTIONS==='true')process.env.CLOSED_LOOP_FAILURE_ANNOTATION_OWNER='1';
const failureVisibility=process.env.GITHUB_ACTIONS==='true'&&!failureAnnotationNested&&!process.execArgv.includes('--check');
const failureTail=[];let failureTailBytes=0,failureError='';
if(failureVisibility){
  const rawStderrWrite=process.stderr.write;
  process.stderr.write=function(chunk,encoding,callback){
    try{const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(String(chunk),typeof encoding==='string'?encoding:'utf8');failureTail.push(bytes);failureTailBytes+=bytes.length;while(failureTailBytes>8192&&failureTail.length>1)failureTailBytes-=failureTail.shift().length;}catch{}
    return rawStderrWrite.apply(this,arguments);
  };
  process.on('uncaughtExceptionMonitor',error=>{try{failureError=String(error?.stack||error).slice(0,1400);}catch{}});
}
const directory=process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS;
// --check parses a named file without executing its verifier body. Preserve its
// actual parser exit status, but never publish it as an executed suite receipt.
const syntaxOnly=process.execArgv.includes('--check')||process.execArgv.includes('-c');
// Focused timing, fault, and restoration children are different populations.
// Their enclosing required verifiers retain the actual child results; these
// children must never overwrite the complete positive producer receipt.
const focusedDueModes=new Set(['--stage17-receipt-parent-controls','--stage17-correction-parent-controls','--fixture-decoder-bounds','--stage-binding-regressions','--definition-compatibility-witness-only','--definition-compatibility','--evidence-chain-frontier-only','--evidence-chain-faults-only','--deferred-reservations','--conditional-handoff-material','--conditional-independent-retry','--conditional-producer-contracts','--conditional-byte-carriers','--deferred-regression','--deferred-native','--deferred-small','--deferred-only','--regression-only','--deferred-cache-only']);
const focusedPopulation=suite==='verify-due-stage-timing.mjs'&&process.argv.slice(2).some(argument=>focusedDueModes.has(argument)||argument.startsWith('--deferred-fixture='))||suite==='verify-handoff-disclosure.mjs'&&process.argv.slice(2).some(argument=>argument==='--fault=authorization'||argument==='--fault=scan')||suite==='verify-quarantine-recovery.mjs'&&process.argv.slice(2).some(argument=>argument==='--fault=quarantine-files'||argument==='--fault=quarantine-body-delete')||suite==='verify-human-authority-roundtrip.mjs'&&process.argv.includes('--human-stage-save-only')||suite==='verify-full-cycle.mjs'&&process.argv.includes('--timing-only')||suite==='verify-native-proof-journey.mjs'&&process.env.CONFORMANCE_NATIVE_FAULT==='skip-proof-recording'||suite==='verify-cross-run-comparison.mjs'&&process.argv.slice(2).some(argument=>argument.startsWith('--comparison-fault=')||argument==='--comparison-control'||argument==='--stability-aggregate-control'||argument==='--projection-recovery-only'||argument==='--scheduled-iteration-controls');
if(directory&&verificationCatalog[suite]&&!syntaxOnly&&!focusedPopulation&&(!process.env.CLOSED_LOOP_VERIFICATION_SOURCE_ROOT||path.resolve(process.cwd())===path.resolve(process.env.CLOSED_LOOP_VERIFICATION_SOURCE_ROOT))){
  const fingerprint=evidenceFingerprint(),chunks=[],stderrChunks=[];
  let byteCount=0,outputOverflow=false;
  const write=process.stdout.write;
  process.stdout.write=function(chunk,encoding,callback){
    const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk,typeof encoding==='string'?encoding:'utf8');
    byteCount+=bytes.length;if(byteCount<=64*1024*1024)chunks.push(bytes);else outputOverflow=true;
    return write.call(this,chunk,encoding,callback);
  };
  const stderrWrite=process.stderr.write;
  process.stderr.write=function(chunk,encoding,callback){
    const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk,typeof encoding==='string'?encoding:'utf8');
    byteCount+=bytes.length;if(byteCount<=64*1024*1024)stderrChunks.push(bytes);else outputOverflow=true;
    return stderrWrite.call(this,chunk,encoding,callback);
  };
  process.on('exit',code=>{
    try{
      if(code!==0||outputOverflow)throw new Error('producer exit/output bound failed');
      const after=evidenceFingerprint();if(after.sourceInputsSha256!==fingerprint.sourceInputsSha256)throw new Error('source changed during producer execution');
      recordExecutionReceipt({command:[process.execPath,...process.argv.slice(1)],exitCode:code,outcome:'PASS',stdout:Buffer.concat(chunks).toString('utf8'),stderr:Buffer.concat(stderrChunks).toString('utf8')},{directory});
    }catch(error){
      fs.mkdirSync(directory,{recursive:true});
      const failure={schema:RECEIPT_SCHEMA,suite,fingerprint,complete:false,exitCode:code,outcome:'FAIL',reason:error.message};failure.receiptSha256=sha(failure);
      fs.writeFileSync(path.join(directory,suite+'.json'),JSON.stringify(failure,null,2)+'\n');
      // Missing assertions or a malformed report fail the actual producer
      // command, not just a later YAML/source-presence check.
      process.stderr.write('EXECUTED_EVIDENCE_ORACLE: '+suite+': '+error.message+'\n');process.exitCode=1;
    }
  });
}

if(failureVisibility){
  process.on('exit',code=>{
    const finalCode=process.exitCode||code;
    if(!finalCode)return;
    try{
      const escape=value=>String(value).replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A');
      const stderrTail=Buffer.concat(failureTail).toString('utf8').slice(-900);
      fs.writeSync(2,'\n::error title='+escape('Verifier failed: '+(suite||'node')+' exit '+finalCode)+'::'+escape((failureError?'error: '+failureError+' | ':'')+'stderr tail: '+stderrTail)+'\n');
    }catch{}
  });
}
