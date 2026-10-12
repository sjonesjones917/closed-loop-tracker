import {runVerifier,checkedVerifier,assertDetectedFault} from './verify-conformance-regressions.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {currentOwnerReport,createExecutionReceipt,evidenceFingerprint,sha} from './verification-evidence.mjs';
import {verificationCatalog} from './verification-evidence-catalog.mjs';

const suite='verify-encrypted-backups.mjs',marker='encryptedBackupBytes';
async function restoredPositive({directory=process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS,run=()=>checkedVerifier(process.execPath,[suite],{encoding:'utf8',maxBuffer:16*1024*1024})}={}){
 return currentOwnerReport(suite,marker,{directory,run});
}
// Receipt/guard unit fixtures only. They never enter the publication directory
// or represent a new execution of the encryption/storage producer.
if(process.argv.includes('--owner-receipt-controls')){
 const originalNames=[
  'Known credential material blocks plaintext export before reporting success or changing recovery state',
  'Independent AES-256-GCM/PBKDF2 verification confirms parameters, ciphertext, tag and manifest-digest AAD',
  'Repeated encryption uses fresh salt and IV and produces different ciphertext',
  'Missing/wrong passwords and individual KDF, tag, AAD, ciphertext and length modifications reject without partial activation',
  'Exact base64 alphabet, terminal padding and scalar type controls retain grammar and reject before activation',
  'Encrypted exported bytes restore the complete compatible project, exact files and retained History in an empty store',
  'A credential file only in retained History still requires an encrypted complete backup',
  'A protection-ledger storage failure returns no backup and preserves the prior verified export',
  'A repeated salt/IV pair is rejected before producing ciphertext',
  'Neither the operator passphrase nor derived key appears in persisted project, artifact metadata or META records'
 ],partNames=[
  'Current classified object requires encryption before it becomes historical',
  'Historical classified JSON part blocks plaintext export without changing History or announcing success',
  'Password-protected package restores exact historical object and retained JSON bytes while preserving current state',
  'Inline historical classification retains its existing protection',
  'Literal JSON-looking text is not promoted into a credential classification',
  'Missing referenced JSON bytes reject instead of bypassing the protection decision',
  'Same-size corrupt referenced JSON bytes reject at their byte-identity boundary'
 ];
 const fixture={synthetic:true,actualBrowser:false,testedArtifactBytes:65539,testedLargeArtifactBytes:6291459,encryptedBackupBytes:9000000,cases:originalNames.map(name=>({name,result:'PASS'})),credentialHistoryParts:{status:'PASS',synthetic:true,actualBrowser:false,cases:partNames.map(name=>({name,result:'PASS'}))}},checks=verificationCatalog[suite].checks,cases=[];
 const accepts=report=>checks.every(check=>check.condition(check.path.split('.').reduce((value,key)=>value?.[key],report),report));
 assert.equal(checks.length,17,'ENCRYPTION_CATALOG_POPULATION_ORACLE');assert.equal(accepts(fixture),true,'ENCRYPTION_CATALOG_CONTROL_ORACLE');
 for(const [group,names]of [['cases',originalNames],['credentialHistoryParts',partNames]])for(const name of names)for(const kind of ['missing','failed','duplicate']){
  const changed=structuredClone(fixture),rows=group==='cases'?changed.cases:changed.credentialHistoryParts.cases,index=rows.findIndex(row=>row.name===name);
  if(kind==='missing')rows.splice(index,1);else if(kind==='failed')rows[index].result='FAIL';else rows.push({...rows[index]});
  assert.equal(accepts(changed),false,'ENCRYPTION_CATALOG_REJECTION_ORACLE: '+name+' '+kind);cases.push('guard:'+group+':'+kind+':'+name);
 }
 for(const [name,change]of [['browser-claim',r=>r.actualBrowser=true],['helper-browser-claim',r=>r.credentialHistoryParts.actualBrowser=true],['missing-helper',r=>delete r.credentialHistoryParts],['wrong-byte-workload',r=>r.testedLargeArtifactBytes=1]]){const changed=structuredClone(fixture);change(changed);assert.equal(accepts(changed),false,'ENCRYPTION_CATALOG_SCOPE_ORACLE: '+name);cases.push('guard:'+name);}
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-encrypted-owner-')),fingerprint=evidenceFingerprint(),receipt=createExecutionReceipt(suite,{command:[process.execPath,suite],exitCode:0,outcome:'PASS',stdout:JSON.stringify(fixture),stderr:''},{fingerprint}),file=path.join(directory,suite+'.json'),save=value=>fs.writeFileSync(file,JSON.stringify(value)),never=()=>{throw new Error('ENCRYPTION_RECEIPT_UNEXPECTED_PRODUCER');};
 try{
  save(receipt);assert.deepEqual(await restoredPositive({directory,run:never}),fixture);cases.push('receipt:valid-skips-producer');
  fs.unlinkSync(file);let calls=0;assert.deepEqual(await restoredPositive({directory,run:async()=>{calls++;return JSON.stringify(fixture);}}),fixture);assert.equal(calls,1);cases.push('receipt:absent-runs-once');
  const requirement=process.env.CLOSED_LOOP_REQUIRE_CURRENT_OWNER_RECEIPTS;process.env.CLOSED_LOOP_REQUIRE_CURRENT_OWNER_RECEIPTS='1';try{await assert.rejects(restoredPositive({directory,run:never}),/missing required current receipt/);}finally{if(requirement===undefined)delete process.env.CLOSED_LOOP_REQUIRE_CURRENT_OWNER_RECEIPTS;else process.env.CLOSED_LOOP_REQUIRE_CURRENT_OWNER_RECEIPTS=requirement;}cases.push('receipt:mandatory-absence-blocks');
  for(const [name,change]of [['stale',r=>r.fingerprint.sourceInputsSha256='0'.repeat(64)],['failed',r=>{r.complete=false;r.outcome='FAIL';r.exitCode=1;}],['wrong-scope',r=>r.suite='verify-other.mjs']]){const altered=structuredClone(receipt);change(altered);delete altered.receiptSha256;altered.receiptSha256=sha(altered);save(altered);await assert.rejects(restoredPositive({directory,run:never}),/EXECUTED_EVIDENCE_ORACLE/);cases.push('receipt:'+name+'-blocks');}
  fs.writeFileSync(file,'{corrupt');await assert.rejects(restoredPositive({directory,run:never}));cases.push('receipt:corrupt-blocks');
  save(receipt);const failed=structuredClone(receipt);failed.complete=false;failed.outcome='FAIL';failed.exitCode=1;delete failed.receiptSha256;failed.receiptSha256=sha(failed);save(failed);await assert.rejects(restoredPositive({directory,run:never}),/failed\/incomplete receipt/);cases.push('receipt:later-failure-not-hidden');
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
 console.log(JSON.stringify({encryptedOwnerReceiptControls:'PASS',syntheticReceiptUnitFixtures:true,producerExecuted:false,cases},null,2));
}else{
const cases=[];
for(const [fault,oracle] of [['secret','SECRET_EXPORT_ORACLE'],['history','RETAINED_SECRET_ORACLE'],['base64-stack','ENCRYPTED_LARGE_GRAMMAR_ORACLE']]){
 const run=(await runVerifier(process.execPath,['verify-encrypted-backups.mjs','--fault='+fault],{encoding:'utf8',maxBuffer:16*1024*1024}));assertDetectedFault(run,oracle,'Encryption fault was not detected: '+fault);assert.ok((run.stdout+run.stderr).includes(oracle),'The fault failed for an unrelated reason: '+run.stderr);cases.push({fault,oracle,result:'DETECTED'});
}
const restored=await restoredPositive();assert.equal(restored.synthetic,true);assert.equal(restored.actualBrowser,false);
console.log(JSON.stringify({synthetic:true,actualBrowser:false,cases,restoredImplementation:'PASS'},null,2));
}
