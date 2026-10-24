import {runVerifier} from './verify-conformance-regressions.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {createVerifierRuntime} from './verifier-runtime.mjs';
await import('./hash.js');
const faultName=process.argv.find(arg=>arg.startsWith('--fault='))?.split('=')[1],faults={fold:['PINNED_UNICODE_TABLES.caseFoldMappings[cp]||[cp]','[cp]'],confusable:['PINNED_UNICODE_TABLES.confusableMappings[cp]||[cp]','[cp]'],order:['while(position>0&&(ccc[out[position-1]]||0)>rank)','while(false)'],prefix:['for(const paths of seen)for(const path of paths){','for(const paths of [])for(const path of paths){']};
let h=globalThis.closedLoopHash;if(faultName){let source=fs.readFileSync('hash.js','utf8');const [before,after]=faults[faultName];assert.ok(source.includes(before));const runtime=createVerifierRuntime({TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob});vm.runInContext(source.replace(before,after),runtime);h=runtime.closedLoopHash;}
// Section 34.1: bundled-table integrity must fail closed before these APIs
// produce canonical identity. Every call gets a new realm and unverified tables.
export function verifyUnicodeTableIntegrity(source=fs.readFileSync('hash.js','utf8'),{detectCounterexamples=true}={}){
  const before='"65":[97]',after='"65":[98]',position=source.indexOf(before);
  assert.equal(source.split(before).length-1,1,'UNICODE_TABLE_CORRUPTION_FIXTURE_ORACLE');
  const corrupted=source.slice(0,position)+after+source.slice(position+before.length);
  assert.equal(corrupted.length,source.length,'UNICODE_TABLE_CORRUPTION_FIXTURE_ORACLE');
  let changedUnits=0;for(let index=0;index<source.length;index++)if(source[index]!==corrupted[index])changedUnits++;
  assert.equal(changedUnits,1,'UNICODE_TABLE_CORRUPTION_FIXTURE_ORACLE');
  const restored=corrupted.slice(0,position)+before+corrupted.slice(position+after.length);
  assert.equal(restored,source,'UNICODE_TABLE_RESTORATION_ORACLE');
  const checks=[
    {api:'normalizeFilename',input:'A.txt',expected:'A.txt',value:identity=>identity.canonicalPath},
    {api:'pinnedNFC',input:'é',expected:'é',value:identity=>identity},
    {api:'confusableSkeleton',input:'x',expected:'x',value:identity=>identity}
  ],observations=[];
  for(const [phase,bytes] of [['clean',source],['corrupted',corrupted],['restored',restored]])for(const check of checks){
    const context=createVerifierRuntime({TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,closedLoopHash:null});
    vm.runInContext(bytes,context,{filename:'hash.js:'+phase+':'+check.api});
    let returnedIdentity=false;
    const call=()=>{const identity=context.closedLoopHash[check.api](check.input);returnedIdentity=true;return check.value(identity);};
    if(phase==='corrupted'){
      assert.throws(call,error=>typeof error?.message==='string'&&error.message.startsWith('UNICODE_TABLE_MISMATCH: '),'UNICODE_TABLE_MISMATCH_ORACLE '+check.api);
      assert.equal(returnedIdentity,false,'UNICODE_TABLE_NO_IDENTITY_ORACLE '+check.api);
      observations.push({phase,api:check.api,input:check.input,errorCode:'UNICODE_TABLE_MISMATCH',returnedIdentity:false,result:'PASS'});
    }else{
      assert.equal(call(),check.expected,'UNICODE_TABLE_CLEAN_IDENTITY_ORACLE '+phase+' '+check.api);
      observations.push({phase,api:check.api,input:check.input,expected:check.expected,result:'PASS'});
    }
  }
  const negativeControls=[];
  if(detectCounterexamples){
    const gate="if(sha256Value(PINNED_UNICODE_TABLES)!==PINNED_UNICODE_TABLE_SHA256)throw new Error('UNICODE_TABLE_MISMATCH: bundled Unicode 15.1 tables failed integrity verification.');";
    assert.equal(source.split(gate).length-1,1,'UNICODE_TABLE_GATE_COUNTEREXAMPLE_FIXTURE_ORACLE');
    let failure;try{verifyUnicodeTableIntegrity(source.replace(gate,''),{detectCounterexamples:false});}catch(error){failure=error;}
    const oracle='UNICODE_TABLE_MISMATCH_ORACLE normalizeFilename';
    assert(failure?.message.includes(oracle),'UNICODE_TABLE_GATE_COUNTEREXAMPLE_ORACLE');
    negativeControls.push({caseId:'unicode-integrity-gate-removed',oracle,result:'DETECTED'});
  }
  return {synthetic:true,actualBrowser:false,observations,negativeControls};
}

export function verifyExtractionTargetCollisions(hash){
  for(const names of [['a','a/b'],['A','a/b'],['a','а/b']])assert.throws(()=>hash.normalizeFilenameSet(names),/EXTRACTION_TARGET_PATH_COLLISION/,'EXTRACTION_TARGET_COLLISION_ORACLE');
  assert.equal(hash.normalizeFilenameSet(['a/b','a/c']).length,2,'Shared directory prefixes remain valid');
}

const root='unicode-data/15.1.0/',cases=[],note=name=>cases.push({name,result:'PASS'});
assert.equal(h.normalizeFilename('re\u0301sume\u0301.txt').canonicalPath,'résumé.txt','UNICODE_FILENAME_ORACLE');
assert.equal(h.normalizeFilename('中文-🙂.txt').canonicalPath,'中文-🙂.txt');note('Non-ASCII filenames retain their raw spelling and use pinned NFC canonical identities');
const sequence=text=>String.fromCodePoint(...text.trim().split(/\s+/).filter(Boolean).map(cp=>parseInt(cp,16)));let normalizationRows=0;const partOne=new Set();let part='';
for(const raw of fs.readFileSync(root+'NormalizationTest.txt','utf8').split('\n')){const line=raw.split('#')[0].trim();if(!line)continue;if(line.startsWith('@')){part=line;continue;}const [c1,c2,c3,c4,c5]=line.split(';').slice(0,5).map(sequence);if(part==='@Part1')for(const ch of c1)partOne.add(ch.codePointAt(0));for(const [input,nfc,nfd] of [[c1,c2,c3],[c2,c2,c3],[c3,c2,c3],[c4,c4,c5],[c5,c4,c5]]){assert.equal(h.pinnedNFC(input),nfc,'NFC_ORACLE row '+normalizationRows);assert.equal(h.pinnedNFD(input),nfd,'NFD_ORACLE row '+normalizationRows);assert.equal(input.normalize('NFD'),nfd,'REFERENCE_NFD_ORACLE row '+normalizationRows);}normalizationRows++;}
let unchangedScalars=0;for(let cp=0;cp<=0x10ffff;cp++){if(cp>=0xd800&&cp<=0xdfff||partOne.has(cp))continue;const text=String.fromCodePoint(cp);assert.equal(h.pinnedNFC(text),text);assert.equal(h.pinnedNFD(text),text);unchangedScalars++;}note('Every pinned normalization row and all remaining Unicode scalar values satisfy the Unicode normalization conformance conditions');
let caseFoldRows=0,confusableRows=0;for(const raw of fs.readFileSync(root+'CaseFolding.txt','utf8').split('\n')){const [cp,status,mapping]=raw.split('#')[0].split(';').map(x=>x.trim());if(!['C','F'].includes(status))continue;assert.equal(h.defaultCaseFold(sequence(cp)),sequence(mapping),'CASE_FOLD_ORACLE '+cp);caseFoldRows++;}
assert.equal(h.defaultCaseFold('I'),'i');assert.equal(h.defaultCaseFold('İ'),'i\u0307');note('All default C/F case-fold mappings pass, with locale-specific Turkic mappings excluded');
const confusableRowsSource=fs.readFileSync(root+'confusables.txt','utf8').split('\n').map(raw=>raw.split('#')[0].split(';').map(x=>x.trim())).filter(row=>row[0]),referenceMap=new Map(confusableRowsSource.map(([source,target])=>[sequence(source),sequence(target)]));
for(const [source] of confusableRowsSource){const input=sequence(source),expected=[...input.normalize('NFD')].map(character=>referenceMap.get(character)||character).join('').normalize('NFD');assert.equal(h.confusableSkeleton(input),expected,'CONFUSABLE_ORACLE '+source);confusableRows++;}note('Every pinned UTS #39 mapping is exercised with the required NFD preprocessing against an independent host-normalization reference');
for(const [left,right] of [['résumé.txt','re\u0301sume\u0301.txt'],['Straße.txt','STRASSE.txt'],['paypal.txt','pаypal.txt'],['O.txt','0.txt']]){const a=h.filenameCollisionKeys(left),b=h.filenameCollisionKeys(right);assert.ok(a.some((key,index)=>key===b[index]),'FILENAME_COLLISION_ORACLE '+left+' / '+right);}
for(const [names,reason] of [[['résumé.txt','re\u0301sume\u0301.txt'],'DUPLICATE_CANONICAL_PATH'],[['Straße.txt','STRASSE.txt'],'CASE_FOLD_PATH_COLLISION'],[['paypal.txt','pаypal.txt'],'PLATFORM_RISK_PATH_COLLISION']])assert.throws(()=>h.normalizeFilenameSet(names),new RegExp(reason),'PACKAGE_COLLISION_ORACLE');
assert.equal(h.normalizeFilenameSet(['slots/first/result.txt','slots/second/result.txt']).length,2,'Distinct canonical slot paths must not be conflated with matching basenames');
verifyExtractionTargetCollisions(h);
for(const name of ['bad\u0085name.txt','bad\u202ename.txt','..\u2024/secret.txt','folder∕file.txt'])assert.throws(()=>h.normalizeFilename(name,{allowPath:true}),/UNSAFE_FILENAME/);note('Canonical, case-fold, script-confusable, control and ambiguous-path violations are rejected or detected by the shared filename owner');
const context=createVerifierRuntime({TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob});vm.runInContext("String.prototype.normalize=function(){throw new Error('HOST NORMALIZATION MUST NOT RUN');};"+fs.readFileSync('hash.js','utf8'),context);assert.equal(context.closedLoopHash.normalizeFilename('re\u0301sume\u0301.txt').canonicalPath,'résumé.txt');note('Host normalization changes cannot change identities because the application uses its bundled pinned tables');
const unicodeTableIntegrity=verifyUnicodeTableIntegrity();note('Bundled-table mismatch blocks filename, NFC and confusable identities in fresh realms, with clean and exact-restored controls');
const reproduced=(await runVerifier(process.execPath,['generate-unicode-tables.mjs','--check'],{encoding:'utf8'}));assert.equal(reproduced.status,0,reproduced.stderr);note('Runtime tables reproduce exactly from the recorded official source bytes and digests');
console.log(JSON.stringify({synthetic:true,actualBrowser:false,normalizationRows,unchangedScalars,caseFoldRows,confusableRows,unicodeContract:h.unicodeContract,unicodeTableIntegrity,cases},null,2));
