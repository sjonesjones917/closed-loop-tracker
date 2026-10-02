import fs from 'node:fs';
import path from 'node:path';
import {verificationCatalog} from './verification-evidence-catalog.mjs';
import {recordExecutionReceipt,evidenceFingerprint,sha,RECEIPT_SCHEMA} from './verification-evidence.mjs';

const suite=path.basename(process.argv[1]||'');
const directory=process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS;
// A focused timing-only child and a deliberately faulted native owner are
// different audited populations. Their enclosing required verifiers retain
// their negative receipts; neither can overwrite the complete positive run.
const focusedPopulation=suite==='verify-full-cycle.mjs'&&process.argv.includes('--timing-only')||suite==='verify-native-proof-journey.mjs'&&process.env.CONFORMANCE_NATIVE_FAULT==='skip-proof-recording';
if(directory&&verificationCatalog[suite]&&!focusedPopulation&&(!process.env.CLOSED_LOOP_VERIFICATION_SOURCE_ROOT||path.resolve(process.cwd())===path.resolve(process.env.CLOSED_LOOP_VERIFICATION_SOURCE_ROOT))){
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
