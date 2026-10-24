import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import {gunzipSync} from 'node:zlib';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

const {core,engine,store,rows,runtime}=projectStoreRuntime(),password='Disposable quarantine UI evidence password',cases=[];
const pass=caseId=>cases.push({caseId,result:'PASS'});
let project=core.createBlankState('QUARANTINE-UI-OWNER');
project.job.JOB_TITLE='Valid source before quarantine';
engine.ensureShape(project);engine.recalculate(project);
project=await store.writeProject(project,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
const file=await store.putArtifact({artifactId:'QUARANTINE-UI-FILE',jobId:project.job.JOB_ID,filename:'original.bin',blob:new Blob(['ORIGINAL\0BYTES'])});
const damaged=rows.get('projects').get(project.job.JOB_ID);damaged.project.job.JOB_TITLE='Damaged source for UI export';rows.get('artifacts').get(file.artifactId).blob=new Blob(['DAMAGED\0BYTES']);
await assert.rejects(()=>store.readProject(project.job.JOB_ID),error=>error.code==='PROJECT_HASH_MISMATCH');
const saved=[...rows.get('meta').values()].find(row=>row.key.startsWith('quarantine:'+project.job.JOB_ID+':'));
assert.ok(saved?.key,'QUARANTINE_UI_TEST_SETUP_ORACLE');

const app=fs.readFileSync('app-core.js','utf8'),start=app.indexOf('async function exportQuarantineEvidence('),end=app.indexOf('\nasync function exportHistoryEvidence(',start);
assert.ok(start>=0&&end>start,'QUARANTINE_EVIDENCE_UI_CAPABILITY_ORACLE');
const calls=[],downloads=[],messages=[];let selectedPassword=null,passwordRetry=null;
Object.assign(runtime,{
 projectStore:{...store,exportQuarantinedProject:async(key,options)=>{calls.push({key,hasPassphrase:Boolean(options?.passphrase)});return store.exportQuarantinedProject(key,options);}},
 takeBackupPassphrase:()=>selectedPassword,
 downloadBlob:(blob,name)=>downloads.push({blob,name}),
 announce:message=>messages.push(message),
 requestBackupPassword:(retry,error)=>{if(error?.code!=='BACKUP_PASSPHRASE_REQUIRED')return false;passwordRetry=retry;return true;}
});
vm.runInContext(app.slice(start,end)+'\nglobalThis.exportQuarantineEvidenceUnderTest=exportQuarantineEvidence;',runtime);

await runtime.exportQuarantineEvidenceUnderTest(saved.key);
assert.equal(downloads.length,0,'QUARANTINE_EVIDENCE_MISSING_PASSWORD_NO_DOWNLOAD_ORACLE');
assert.equal(typeof passwordRetry,'function');
pass('missing-password-prompts-without-download');

selectedPassword=password;
await assert.rejects(()=>runtime.exportQuarantineEvidenceUnderTest('quarantine:missing'),error=>error.code==='QUARANTINE_NOT_FOUND');
assert.equal(downloads.length,0);
pass('unknown-quarantine-identity-rejected');

await passwordRetry();
assert.deepEqual(calls,[{key:saved.key,hasPassphrase:false},{key:'quarantine:missing',hasPassphrase:true},{key:saved.key,hasPassphrase:true}],'QUARANTINE_EVIDENCE_PASSWORD_SCOPE_ORACLE');
assert.equal(downloads.length,1);assert.equal(downloads[0].name,'project-recovery-evidence.closed-loop.enc.json');assert.equal(downloads[0].blob.type,'application/vnd.closed-loop.encrypted+json');
pass('password-retry-retains-original-quarantine-identity');
pass('application-owner-downloads-protected-recovery-carrier');

function decrypt(container){const key=crypto.pbkdf2Sync(password,Buffer.from(container.salt,'hex'),600000,32,'sha256'),cipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(container.iv,'hex'));cipher.setAAD(Buffer.from(container.manifestSha256,'hex'));cipher.setAuthTag(Buffer.from(container.authenticationTag,'hex'));return JSON.parse(gunzipSync(Buffer.concat([cipher.update(Buffer.from(container.ciphertext,'base64')),cipher.final()])));}
const container=JSON.parse(await downloads[0].blob.text()),payload=decrypt(container);
assert.equal(payload.schema,'closed-loop-quarantine-package/1');assert.equal(payload.packageManifest.quarantineKey,saved.key,'QUARANTINE_EVIDENCE_UI_OWNER_ORACLE');assert.equal(payload.packageManifest.activationPermitted,false,'QUARANTINE_EVIDENCE_UI_NONACTIVATION_ORACLE');
pass('downloaded-manifest-binds-identity-and-forbids-activation');

const members=new Map(payload.artifacts.map(member=>[member.path,Buffer.from(member.base64,'base64')]));
for(const member of payload.packageManifest.members){const bytes=members.get(member.path);assert.equal(bytes.length,member.byteSize);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),member.sha256,'QUARANTINE_EVIDENCE_UI_MEMBER_BYTES_ORACLE');}
const first=payload.packageManifest.members[0],tampered=Buffer.from(members.get(first.path));tampered[0]^=1;assert.notEqual(crypto.createHash('sha256').update(tampered).digest('hex'),first.sha256,'QUARANTINE_EVIDENCE_UI_MEMBER_TAMPER_ORACLE');
pass('independent-member-byte-digests-and-tamper-control');

const graph=JSON.parse(members.get('raw-project.json')),objects=graph.nodes.map(node=>node.kind==='Array'?new Array(node.length):node.kind==='Blob'?members.get(node.path):{}),decode=value=>'ref'in value?objects[value.ref]:value.kind==='undefined'?undefined:value.kind==='null'?null:value.kind==='number'?Number(value.value):value.kind==='bigint'?BigInt(value.value):value.value;
graph.nodes.forEach((node,index)=>{for(const [key,value] of node.entries||[])Object.defineProperty(objects[index],key,{value:decode(value),enumerable:true,writable:true,configurable:true});});const reconstructed=decode(graph.root);
assert.equal(reconstructed.row.project.job.JOB_TITLE,'Damaged source for UI export');assert.equal(reconstructed.artifacts[0].filename,'original.bin');assert.deepEqual(reconstructed.artifacts[0].blob,Buffer.from('DAMAGED\0BYTES'));
pass('independent-graph-decodes-exact-damaged-row-and-file');

await assert.rejects(()=>store.importPackage(downloads[0].blob,{passphrase:password}),/Unsupported project package schema/,'QUARANTINE_EVIDENCE_UI_IMPORT_REJECTION_ORACLE');
assert.ok(await store.metaGet(saved.key));
pass('downloaded-evidence-cannot-import-or-remove-quarantine');

const ciphertext=Buffer.from(container.ciphertext,'base64');ciphertext[0]^=1;assert.throws(()=>decrypt({...container,ciphertext:ciphertext.toString('base64')}),'QUARANTINE_EVIDENCE_UI_CIPHERTEXT_TAMPER_ORACLE');
pass('encrypted-ciphertext-tamper-rejected');
assert.ok(messages.at(-1).includes('inspection'));

console.log(JSON.stringify({schema:'closed-loop-quarantine-ui-export-owner/1',result:'PASS',synthetic:true,actualBrowser:false,actualIndexedDb:false,environment:'Extracted production app-core owner and production project-store under lifecycle Map transaction adapter; independent Node cryptography and graph decoding',cases},null,2));
