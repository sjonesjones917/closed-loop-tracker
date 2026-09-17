import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const sha=value=>createHash('sha256').update(value).digest('hex');
const original=fs.readFileSync('hash.js','utf8'),sourceSha256=sha(original);
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'clrt-canonical-faults-'));
const faults=[
 {id:'CB-MUT-INDEX',before:'!/^(?:0|[1-9]\\d*)$/.test(key)',after:'!/^\\d+$/.test(key)',oracle:'CB-ARRAY-EXTRA-string-00',control:'CB-ARRAY-VALID-string-2'},
 {id:'CB-MUT-ACCESSOR',before:"else{const index=frame.index++,descriptor=Object.getOwnPropertyDescriptor(input,String(index));if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value'))throw new TypeError(`Cannot canonically hash accessor property at ${path}[${index}].`);if(index)pending+=',';stack.push({kind:'value',value:descriptor.value,path:`${path}[${index}]`});}",after:"else{const index=frame.index++;if(index)pending+=',';stack.push({kind:'value',value:input[index],path:`${path}[${index}]`});}",oracle:'CB-ARRAY-ACCESSOR-string-get',control:'CB-ARRAY-VALID-string-2'},
 {id:'CB-MUT-SYMBOL',before:'        if(Object.getOwnPropertySymbols(input).length)throw new TypeError(`Cannot canonically hash symbol-keyed properties at ${path}.`);\n',after:'',oracle:'CB-ARRAY-SYMBOL-string-true',control:'CB-ARRAY-VALID-string-2'},
 {id:'CB-MUT-CALENDAR',before:'const date=utcCalendarDate(year,month,day);return date.getUTCFullYear()',after:'const date=new Date(Date.UTC(year,month-1,day));return date.getUTCFullYear()',oracle:'CB-DATE-0000-02-29',control:'CB-DATE-0100-02-28'},
 {id:'CB-MUT-EPOCH',before:'const epoch=utcCalendarDate(year,month,day,hour,minute,second,millis).getTime()-offsetMinutes*60000;',after:'const epoch=Date.UTC(year,month-1,day,hour,minute,second,millis)-offsetMinutes*60000;',oracle:'CB-INSTANT-3',control:'CB-INSTANT-7'},
 {id:'CB-MUT-RANGE',before:"  if(instant.getUTCFullYear()<0||instant.getUTCFullYear()>9999)throw new TypeError('INVALID_DATE_TIME: normalized UTC year is outside the four-digit RFC 3339 domain.');\n",after:'',oracle:'CB-INSTANT-RANGE-UPPER',control:'CB-INSTANT-9'}
];
const results=[];
function execute(sourcePath,prefixes=[]){
  const command=[process.execPath,'verify-canonical-boundaries.mjs',...prefixes.map(prefix=>'--case-prefix='+prefix)];
  const startedAt=new Date().toISOString();
  const run=spawnSync(command[0],command.slice(1),{encoding:'utf8',env:{...process.env,CANONICAL_BOUNDARY_HASH_SOURCE:sourcePath},maxBuffer:32*1024*1024});
  const receipt={command,sourcePath,sourceSha256:sha(fs.readFileSync(sourcePath)),startedAt,finishedAt:new Date().toISOString(),exitCode:run.status,signal:run.signal,stdout:run.stdout||'',stderr:run.stderr||''};
  let report;try{report=JSON.parse(receipt.stdout);}catch(error){throw new Error('Boundary runner did not return executed-case evidence: '+receipt.stderr,{cause:error});}
  return {receipt,report};
}
try{
  for(const fault of faults){
    assert.equal(original.split(fault.before).length-1,1,`${fault.id}: production injection point is missing or ambiguous`);
    const mutant=path.join(directory,fault.id+'.js');fs.writeFileSync(mutant,original.replace(fault.before,fault.after));
    const injected=execute(mutant,[fault.oracle,fault.control]);
    assert.equal(injected.receipt.exitCode,1,`${fault.id}: injected violation was not rejected by the regression`);
    const oracle=injected.report.results.find(row=>row.caseId===fault.oracle),control=injected.report.results.find(row=>row.caseId===fault.control);
    assert.equal(oracle?.status,'FAIL',`${fault.id}: intended behavioral oracle did not detect the injected violation`);
    assert.equal(control?.status,'PASS',`${fault.id}: otherwise valid control failed; mutation result is not isolated`);
    const restored=execute(path.resolve('hash.js'),[fault.oracle,fault.control]);
    assert.equal(restored.receipt.exitCode,0,`${fault.id}: unmodified production did not restore the same cases to green`);
    assert.ok(restored.report.results.every(row=>row.status==='PASS'));
    results.push({faultId:fault.id,expectedFailureCase:fault.oracle,validControlCase:fault.control,result:'DETECTED',injected:injected.receipt,restored:restored.receipt});
  }
  const completeRestored=execute(path.resolve('hash.js'));
  assert.equal(completeRestored.receipt.exitCode,0,'Full restored boundary suite failed');
  assert.equal(sha(fs.readFileSync('hash.js')),sourceSha256,'Disposable mutations changed the production authority');
  console.log(JSON.stringify({schema:'closed-loop-canonical-boundary-faults/1',sourceSha256,testSha256:sha(fs.readFileSync('verify-canonical-boundaries.mjs')),synthetic:true,actualBrowser:false,contractTextModified:false,method:'Each independently named disposable production mutation must fail its intended observable, leave a valid control passing, and return the same cases to green on unmodified production. All raw child outputs are retained.',results,completeRestored:completeRestored.receipt},null,2));
}finally{fs.rmSync(directory,{recursive:true,force:true});}
