import fs from 'node:fs';
import vm from 'node:vm';

if(!globalThis.closedLoopHash)vm.runInThisContext(fs.readFileSync('hash.js','utf8'),{filename:'hash.js'});
const h=globalThis.closedLoopHash;
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const mustReject=(name,fn,pattern)=>{
  let error=null;
  try{fn();}catch(caught){error=caught;}
  assert(error,`${name} must reject.`);
  if(pattern)assert(pattern.test(String(error?.message||error)),`${name} rejected for the wrong reason: ${error?.message||error}`);
  return true;
};

assert(h.version==='closed-loop-hash/6','Stage 02 primitive authority version is not current.');
assert(h.filenameVersion==='closed-loop-filename/1','Filename contract identity is missing.');
assert(h.trustedTimeVersion==='closed-loop-trusted-time/1','Trusted-time contract identity is missing.');
assert(h.unicodeContract?.version==='15.1.0','Pinned Unicode version is not 15.1.0.');
assert(h.unicodeContract?.sourceCommit==='9595f090650e99e3e752b37a7a3866ac8a91999b','Pinned Unicode release commit identity is missing.');
assert(h.unicodeContract?.caseFoldingBlobSha1==='69c5c64b4c6a124f4608722db723a9e32667f190','Pinned Unicode CaseFolding data identity is missing.');
assert(h.assertPinnedUnicodeHost().version==='15.1.0','Pinned host Unicode conformance fixtures did not pass.');

const filename=h.normalizeFilename('Report-01.JSON');
assert(filename.rawFilename==='Report-01.JSON','Raw filename was not preserved.');
assert(filename.displayFilename==='Report-01.JSON','Display filename changed unexpectedly.');
assert(filename.canonicalPath==='Report-01.JSON','Canonical filename path changed unexpectedly.');
assert(filename.caseFoldCollisionKey==='report-01.json','ASCII default case-fold collision key is wrong.');
assert(h.normalizeFilename('folder/sub/File.txt',{allowPath:true}).canonicalPath==='folder/sub/File.txt','Safe canonical relative path was not preserved.');
assert(h.filenameCollisionKeys('FILE.txt').includes('file.txt'),'Case-fold collision key is absent.');

const filenameMutations=[
  ['empty filename',()=>h.normalizeFilename(''),/UNSAFE_FILENAME/],
  ['parent traversal',()=>h.normalizeFilename('../secret.txt',{allowPath:true}),/UNSAFE_FILENAME/],
  ['dot segment',()=>h.normalizeFilename('./secret.txt',{allowPath:true}),/UNSAFE_FILENAME/],
  ['absolute path',()=>h.normalizeFilename('/tmp/secret.txt',{allowPath:true}),/UNSAFE_FILENAME/],
  ['drive prefix',()=>h.normalizeFilename('C:\\secret.txt',{allowPath:true}),/UNSAFE_FILENAME/],
  ['embedded separator',()=>h.normalizeFilename('folder/file.txt'),/UNSAFE_FILENAME/],
  ['control character',()=>h.normalizeFilename('bad\u0000name.txt'),/UNSAFE_FILENAME/],
  ['trailing dot',()=>h.normalizeFilename('bad.'),/UNSAFE_FILENAME/],
  ['trailing space',()=>h.normalizeFilename('bad '),/UNSAFE_FILENAME/],
  ['unpinned Unicode repertoire',()=>h.normalizeFilename('résumé.txt'),/UNSUPPORTED_UNICODE_FILENAME/]
];
for(const [name,fn,pattern] of filenameMutations)mustReject(name,fn,pattern);

const dateOnly=h.normalizeDateTime('2026-09-03');
assert(dateOnly.kind==='DATE_ONLY'&&dateOnly.normalized==='2026-09-03'&&dateOnly.timeBasis==='NOT_APPLICABLE','Date-only contract is wrong.');
const utc=h.normalizeDateTime('2026-09-03T12:34:56Z');
assert(utc.normalized==='2026-09-03T12:34:56.000Z','UTC instant did not normalize to exactly three fractional digits.');
const offset=h.normalizeDateTime('2026-09-03T12:34:56.7-07:00');
assert(offset.normalized==='2026-09-03T19:34:56.700Z','Offset-bearing instant did not normalize to UTC correctly.');
assert(offset.original==='2026-09-03T12:34:56.7-07:00','Original external time value was not preserved.');
assert(offset.timeBasis==='DEVICE_REPORTED','Normalized external-boundary time was incorrectly promoted to trusted external time.');

const timeMutations=[
  ['leap second',()=>h.normalizeDateTime('2026-12-31T23:59:60Z'),/leap seconds/i],
  ['missing zone',()=>h.normalizeDateTime('2026-09-03T12:34:56'),/RFC 3339/],
  ['space separator',()=>h.normalizeDateTime('2026-09-03 12:34:56Z'),/RFC 3339/],
  ['bad date',()=>h.normalizeDateTime('2026-02-30'),/invalid date/i],
  ['bad hour',()=>h.normalizeDateTime('2026-09-03T24:00:00Z'),/invalid calendar or clock/i],
  ['bad offset',()=>h.normalizeDateTime('2026-09-03T12:34:56+24:00'),/invalid UTC offset/i],
  ['lowercase z',()=>h.normalizeDateTime('2026-09-03T12:34:56z'),/RFC 3339/]
];
for(const [name,fn,pattern] of timeMutations)mustReject(name,fn,pattern);

assert(h.evaluateTrustedTimeEvidence({basis:'DEVICE_REPORTED'}).trusted===false,'Device time was promoted to trusted external time.');
assert(h.evaluateTrustedTimeEvidence({basis:'SOURCE_ASSERTED'}).trusted===false,'Source-asserted time was promoted to trusted external time.');
mustReject('fabricated VERIFIED_EXTERNAL',()=>h.evaluateTrustedTimeEvidence({basis:'VERIFIED_EXTERNAL'}),/VERIFIED_EXTERNAL requires/);
const verified=h.evaluateTrustedTimeEvidence({basis:'VERIFIED_EXTERNAL',attestationContractId:'RFC3161-TEST-CONTRACT'});
assert(verified.trusted===true&&verified.attestationContractId==='RFC3161-TEST-CONTRACT','Registered trusted-time attestation was not accepted.');

// Test-the-tests: prove each gate rejects an intentionally invalid state, then prove the repaired state progresses.
assert(filenameMutations.length===10&&timeMutations.length===7,'Stage 02 mutation universes changed unexpectedly.');
assert(h.normalizeFilename('repaired.txt').canonicalPath==='repaired.txt','Filename mutation repair did not progress.');
assert(h.normalizeDateTime('2026-09-03T12:34:56.000Z').normalized==='2026-09-03T12:34:56.000Z','Time mutation repair did not progress.');
assert(h.evaluateTrustedTimeEvidence({basis:'VERIFIED_EXTERNAL',attributableExternalSystem:true}).trusted===true,'Trusted-time mutation repair did not progress.');

console.log(JSON.stringify({
  stage02PrimitiveProof:'PASS',
  canonicalJsonVersion:h.canonicalizationVersion,
  canonicalIdVersion:h.idVersion,
  filenameVersion:h.filenameVersion,
  trustedTimeVersion:h.trustedTimeVersion,
  unicodeVersion:h.unicodeContract.version,
  unicodeSourceCommit:h.unicodeContract.sourceCommit,
  caseFoldingBlobSha1:h.unicodeContract.caseFoldingBlobSha1,
  filenameInvalidFixturesRejected:filenameMutations.length,
  timeInvalidFixturesRejected:timeMutations.length,
  fabricatedTrustedTimeRejected:true,
  repairedFixturesProgress:true
},null,2));
