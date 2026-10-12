import fs from 'node:fs';
import path from 'node:path';
import {verificationCatalog} from './verification-evidence-catalog.mjs';
import {recordExecutionReceipt,evidenceFingerprint,sha,RECEIPT_SCHEMA} from './verification-evidence.mjs';

const suite=path.basename(process.argv[1]||'');
const directory=process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS;
// --check parses a named file without executing its verifier body. Preserve its
// actual parser exit status, but never publish it as an executed suite receipt.
const syntaxOnly=process.execArgv.includes('--check')||process.execArgv.includes('-c');
// Focused timing, fault, and restoration children are different populations.
// Their enclosing required verifiers retain the actual child results; these
// children must never overwrite the complete positive producer receipt.
const focusedDueModes=new Set(['--stage17-receipt-parent-controls','--stage17-correction-parent-controls','--fixture-decoder-bounds','--stage-binding-regressions','--definition-compatibility-witness-only','--definition-compatibility','--evidence-chain-frontier-only','--evidence-chain-faults-only','--deferred-reservations','--conditional-handoff-material','--conditional-independent-retry','--conditional-producer-contracts','--conditional-byte-carriers','--deferred-regression','--deferred-native','--deferred-small','--deferred-only','--regression-only','--deferred-cache-only']);
const focusedPopulation=suite==='verify-acceptance-active-work.mjs'&&process.argv.slice(2).some(argument=>['--fault=audit-is-work','--fault=blank-draft-is-work','--fault=omit-pending-work','--fault=post-commit-failure-misreported'].includes(argument))||suite==='verify-encrypted-backups.mjs'&&process.argv.slice(2).some(argument=>['--fault=secret','--fault=history','--fault=base64-stack'].includes(argument))||suite==='verify-verifier-runtime.mjs'&&(process.argv.includes('--fault-probe')||Boolean(process.env.VERIFIER_RUNTIME_SOURCE))||suite==='verify-history-navigation.mjs'&&(process.argv.slice(2).some(argument=>argument.startsWith('--case=')||argument.startsWith('--fault='))||process.env.CLOSED_LOOP_STARTUP_DRAFT_FAULT==='1'||Boolean(process.env.APP_SOURCE))||suite==='verify-due-stage-timing.mjs'&&process.argv.slice(2).some(argument=>focusedDueModes.has(argument)||argument.startsWith('--deferred-fixture='))||suite==='verify-handoff-disclosure.mjs'&&process.argv.slice(2).some(argument=>argument==='--fault=authorization'||argument==='--fault=scan')||suite==='verify-quarantine-recovery.mjs'&&process.argv.slice(2).some(argument=>argument==='--fault=quarantine-files'||argument==='--fault=quarantine-body-delete')||suite==='verify-human-authority-roundtrip.mjs'&&process.argv.includes('--human-stage-save-only')||suite==='verify-full-cycle.mjs'&&process.argv.includes('--timing-only')||suite==='verify-native-proof-journey.mjs'&&process.env.CONFORMANCE_NATIVE_FAULT==='skip-proof-recording'||suite==='verify-cross-run-comparison.mjs'&&process.argv.slice(2).some(argument=>argument.startsWith('--comparison-fault=')||argument==='--comparison-control'||argument==='--stability-aggregate-control'||argument==='--projection-recovery-only'||argument==='--scheduled-iteration-controls'||['--materiality-only','--materiality-stage19-only','--materiality-retry-package-only','--materiality-package-only'].includes(argument));
// Hosted-log-independent visibility for registered, complete verifier producers.
// Preserve stdout, exit codes and receipt contents; on failure add a bounded
// stderr annotation. Intentional focused and unregistered children keep their
// existing raw stderr contracts. Diagnostics are not redacted here.
// Preserve the contributor's outermost-only annotation ownership: intentional
// children keep their raw stderr contract even when a registered parent fails.
const failureAnnotationNested=process.env.CLOSED_LOOP_FAILURE_ANNOTATION_OWNER==='1';
if(process.env.GITHUB_ACTIONS==='true')process.env.CLOSED_LOOP_FAILURE_ANNOTATION_OWNER='1';
const failureVisibility=process.env.GITHUB_ACTIONS==='true'&&!failureAnnotationNested&&Boolean(verificationCatalog[suite])&&!syntaxOnly&&!focusedPopulation;
const failureTail=[];let failureTailBytes=0,failureError='';
if(failureVisibility){
  const rawStderrWrite=process.stderr.write;
  process.stderr.write=function(chunk,encoding,callback){
    try{
      // Own the saved bytes: callers may reuse their buffer after the callback.
      // Bound conversion before allocation for large strings, and never retain
      // a view of a large backing buffer for a small diagnostic tail.
      const bytes=ArrayBuffer.isView(chunk)?Buffer.from(chunk.buffer,chunk.byteOffset+Math.max(0,chunk.byteLength-8192),Math.min(chunk.byteLength,8192)):Buffer.from(String(chunk).slice(-8192),typeof encoding==='string'?encoding:'utf8');
      const saved=Buffer.from(bytes.subarray(Math.max(0,bytes.length-8192)));
      if(saved.length){failureTail.push(saved);failureTailBytes+=saved.length;}
      while(failureTailBytes>8192){
        const excess=failureTailBytes-8192,first=failureTail[0];
        if(first.length<=excess){failureTailBytes-=first.length;failureTail.shift();}
        else{failureTail[0]=Buffer.from(first.subarray(excess));failureTailBytes-=excess;}
      }
    }catch{}
    return rawStderrWrite.apply(this,arguments);
  };
  process.on('uncaughtExceptionMonitor',error=>{try{failureError=String(error?.stack||error).slice(0,1400);}catch{}});
}
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
