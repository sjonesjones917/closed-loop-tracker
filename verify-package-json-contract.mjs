import assert from 'node:assert/strict';
import {storeRuntime} from './test-store-runtime.mjs';

// §§17.5 and 34.1: names cannot be silently overwritten before canonical hashing.
// This is actual package encoding/import with transaction I/O substituted, not
// evidence of a physical file picker or of an independent project execution.
const source=storeRuntime(),project=source.core.createBlankState('PACKAGE-JSON-CONTRACT');
project.job.JOB_TITLE='Retain replacement character \uFFFD and scalar é🙂';
await source.store.writeProject(source.copy(project),{expectedProjectRevision:0});
await source.store.putArtifact({jobId:project.job.JOB_ID,artifactId:'JSON-CONTRACT-FILE',filename:'exact.txt',mediaType:'text/plain',blob:new Blob(['Exact bytes é🙂\n'])});
const backup=await source.store.exportPackage(project.job.JOB_ID),text=await new Response(backup.stream().pipeThrough(new DecompressionStream('gzip'))).text();
const compress=bytes=>new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
const cases=[];
const mutations=[
 ['root-name',s=>s.replace('{','{"schema":"discarded",')],
 ['escaped-root-name',s=>s.replace('{','{"\\u0073chema":"discarded",')],
 ['nested-name',s=>s.replace('"job":{','"job":{"JOB_TITLE":"discarded",')],
 ['artifact-base64',s=>s.replace('"base64":','"base64":"discarded","base64":')],
 ['escaped-artifact-base64',s=>s.replace('"base64":','"\\u0062ase64":"discarded","base64":')]
];
async function unchanged(store,before){assert.equal((await store.readProject(project.job.JOB_ID)).projectSha256,before,'Rejected bytes changed recoverable project data');}
async function duplicateOracle(runtime,id,mutate){
 const {store}=runtime,initial=await store.importPackage(backup),invalid=mutate(text);assert.notEqual(invalid,text,'Mutation did not reach its intended member');
 await assert.rejects(store.importPackage(await compress(invalid)),error=>error.code==='DUPLICATE_JSON_MEMBER',`DUPLICATE_PACKAGE_NAME_ORACLE: ${id} was not rejected for its duplicate name`);
 await unchanged(store,initial.projectSha256);
 const repaired=await store.importPackage(backup);assert.equal(repaired.job.JOB_TITLE,project.job.JOB_TITLE);
 assert.deepEqual(new Uint8Array(await (await store.getArtifact('JSON-CONTRACT-FILE')).blob.arrayBuffer()),new TextEncoder().encode('Exact bytes é🙂\n'));
}
for(const [id,mutate] of mutations){await duplicateOracle(storeRuntime(),id,mutate);cases.push({caseId:'package-'+id,expectedRejection:'DUPLICATE_JSON_MEMBER',repairedResult:'IMPORTED_WITH_EXACT_FILE_BYTES',result:'PASS'});}
const invalidEncoding=storeRuntime(),initial=await invalidEncoding.store.importPackage(backup),raw=new TextEncoder().encode(text),needle=new TextEncoder().encode('\uFFFD'),offset=Buffer.from(raw).indexOf(Buffer.from(needle));assert(offset>=0);
const invalid=Buffer.concat([raw.subarray(0,offset),Buffer.from([0xff]),raw.subarray(offset+needle.length)]);
await assert.rejects(invalidEncoding.store.importPackage(await compress(invalid)),error=>error.code==='ERR_ENCODING_INVALID_ENCODED_DATA'||error.code==='INVALID_PACKAGE_UTF8','Malformed package UTF-8 was normalized into valid data');await unchanged(invalidEncoding.store,initial.projectSha256);await invalidEncoding.store.importPackage(backup);cases.push({caseId:'package-invalid-utf8',repairedResult:'IMPORTED',result:'PASS'});
const fault=storeRuntime({sourceFault:{file:'project-store.js',before:"if(Object.hasOwn(parent.value,item))throw Object.assign(new SyntaxError('Duplicate project package JSON member: '+item),{code:'DUPLICATE_JSON_MEMBER'});",after:"if(false)throw Object.assign(new SyntaxError('Duplicate project package JSON member: '+item),{code:'DUPLICATE_JSON_MEMBER'});"}});
await assert.rejects(duplicateOracle(fault,...mutations[0]),/DUPLICATE_PACKAGE_NAME_ORACLE/);await duplicateOracle(storeRuntime(),...mutations[0]);
console.log(JSON.stringify({packageJsonContract:'PASS',evidenceClass:'EXPORTED_BACKUP_BYTES_AND_PRODUCTION_IMPORT_WITH_TRANSACTION_IO_DOUBLE',cases,duplicateNameBypassDetected:true,restoredImplementation:'PASS',physicalDeviceAcceptance:false},null,2));
