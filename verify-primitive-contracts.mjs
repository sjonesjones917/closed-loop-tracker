import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const context={console,TextEncoder,TextDecoder,Blob,ArrayBuffer,DataView,Uint8Array,URL,URLSearchParams,crypto:webcrypto,dispatchEvent(){},Event:function Event(type){this.type=type}};
context.globalThis=context;
vm.createContext(context);
for(const file of ['hash.js','workbook.js','workflow-schema.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const h=context.closedLoopHash,s=context.closedLoopWorkflowSchema;
assert.equal(h.canonicalizationVersion,'closed-loop-canonical-json/1');
assert.equal(h.idVersion,'closed-loop-id/1');
assert.equal(h.filenameVersion,'closed-loop-filename/1');
assert.equal(h.unicodeVersion,'Unicode 15.1.0');
assert.equal(h.trustedTimeVersion,'closed-loop-trusted-time/1');
assert.equal(s.normalizerRegistry.identity,'closed-loop-normalizer-registry/1');
assert.equal(s.derivationRegistry.identity,'closed-loop-derivation-registry/1');

const filename=h.normalizeFilename('report.txt');
assert.equal(filename.canonicalPath,'report.txt');
assert.equal(filename.caseFoldKey,'report.txt');
assert.throws(()=>h.normalizeFilename('../x'),/separator|path/i);
assert.throws(()=>h.normalizeFilename('..'),/dot/i);
assert.throws(()=>h.normalizeFilename('/abs.txt'),/absolute/i);
assert.throws(()=>h.normalizeFilename('C:\\abs.txt'),/absolute/i);
assert.throws(()=>h.normalizeFilename('bad\0name'),/NUL|control/i);
assert.throws(()=>h.normalizeFilename('é.txt'),/Unicode scalar outside/i);
assert.throws(()=>h.assertFilenameSetSafe(['A.txt','a.txt']),/Case-fold/i);
assert.throws(()=>h.assertFilenameSetSafe(['m.txt','rn.txt']),/confusable/i);
assert.deepEqual(Array.from(h.assertFilenameSetSafe(['a.txt','b.txt']),x=>x.canonicalPath),['a.txt','b.txt']);

assert.equal(h.normalizeMachineTime('2026-09-03').normalizedValue,'2026-09-03');
assert.equal(h.normalizeMachineTime('2026-09-03T12:34:56Z').normalizedValue,'2026-09-03T12:34:56.000Z');
assert.equal(h.normalizeMachineTime('2026-09-03T07:34:56-05:00').normalizedValue,'2026-09-03T12:34:56.000Z');
assert.equal(h.normalizeMachineTime('2026-09-03T12:34:56.123456Z').normalizedValue,'2026-09-03T12:34:56.123Z');
for(const invalid of ['2026-09-03T12:34:56','2026-09-03 12:34:56Z','2026-09-03T12:34:60Z','2026-02-30','2026-09-03T25:00:00Z'])assert.throws(()=>h.normalizeMachineTime(invalid));
assert.equal(h.validateTrustedTimeEvidence({basis:'DEVICE_REPORTED',time:'2026-09-03T12:34:56Z'}).basis,'DEVICE_REPORTED');
assert.throws(()=>h.validateTrustedTimeEvidence({basis:'VERIFIED_EXTERNAL',time:'2026-09-03T12:34:56Z'}),/verification contract/i);
assert.equal(h.validateTrustedTimeEvidence({basis:'VERIFIED_EXTERNAL',time:'2026-09-03T12:34:56Z',verificationContractId:'rfc3161/1',evidenceId:'EVIDENCE-1',boundChallengeNonce:'nonce'}).basis,'VERIFIED_EXTERNAL');

const source=fs.readFileSync('hash.js','utf8');
const mutated=source.replace("if(!allowPath&&/[\\\\/]/.test(rawFilename))throw new TypeError('Path separators are prohibited in a filename.');","if(false)throw new TypeError('Path separators are prohibited in a filename.');");
assert.notEqual(mutated,source,'Mutation fixture did not alter filename validation.');
let mutationRejected=false;
try{
  const c={console,TextEncoder,TextDecoder,Blob,ArrayBuffer,DataView,Uint8Array,crypto:webcrypto};c.globalThis=c;vm.createContext(c);vm.runInContext(mutated,c,{filename:'hash-mutated.js'});c.closedLoopHash.normalizeFilename('../x');
}catch{mutationRejected=true;}
assert.equal(mutationRejected,false,'Mutation setup did not bypass the intended check.');
assert.throws(()=>h.normalizeFilename('../x'),/separator|path/i,'Permanent filename proof does not reject traversal.');

console.log(JSON.stringify({canonicalJson:true,registeredHashPreimages:h.hashPreimageRegistry.size,registeredSetSemantics:h.setSemanticsRegistry.size,canonicalId:true,filenameContract:true,unicodeIdentity:h.unicodeVersion,trustedTime:true,normalizerRegistryIdentity:s.normalizerRegistry.identity,derivationRegistryIdentity:s.derivationRegistry.identity,intentionalFilenameMutationDetected:true},null,2));
