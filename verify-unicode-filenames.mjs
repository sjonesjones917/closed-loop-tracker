import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readUnicodeSource,sourceHashes,generatedUnicodeBlock} from './generate-unicode-tables.mjs';
const source=fs.readFileSync(new URL('./hash.js',import.meta.url),'utf8');
function load(fault=null,disableHost=false){const context=vm.createContext({TextEncoder,TextDecoder,Uint8Array});let code=source;if(fault){assert(code.includes(fault.before),'Missing Unicode fault anchor');code=code.replace(fault.before,fault.after);}if(disableHost)vm.runInContext("String.prototype.normalize=function(){throw new Error('Host normalization prohibited by this test');}",context);vm.runInContext(code,context);return context.closedLoopHash;}
const h=load();
assert.equal(h.normalizeFilename('résumé.txt').canonicalPath,'résumé.txt','UNICODE_FILENAME_ORACLE: a safe Unicode filename must work');
assert.equal(h.normalizeFilename('re\u0301sume\u0301.txt').canonicalPath,'résumé.txt');
assert.equal(h.normalizeFilename('Straße.txt').caseFoldCollisionKey,h.normalizeFilename('STRASSE.txt').caseFoldCollisionKey);
assert.equal(h.normalizeFilename('report.txt').platformRiskCollisionKey,h.normalizeFilename('rеport.txt').platformRiskCollisionKey,'Cyrillic е confusable was not detected');
assert.notEqual(h.normalizeFilename('file5.txt').platformRiskCollisionKey,h.normalizeFilename('files.txt').platformRiskCollisionKey,'An invented 5-to-s substitution prohibited distinct filenames');
assert(source.includes(generatedUnicodeBlock()),'Bundled Unicode tables differ from the exact pinned source bytes');
assert.deepEqual(JSON.parse(JSON.stringify(h.unicodeContract.sourceSha256)),sourceHashes);
const fromHex=s=>String.fromCodePoint(...s.trim().split(/\s+/).map(v=>parseInt(v,16)));
let normalizationCases=0,caseFoldCases=0,confusableCases=0;
for(const line of readUnicodeSource('NormalizationTest.txt').split(/\r?\n/)){
 const data=line.split('#')[0].trim();if(!data||data.startsWith('@'))continue;
 const [c1,c2,c3,c4,c5]=data.split(';').slice(0,5).map(fromHex);
 for(const input of [c1,c2,c3])assert.equal(h.normalizeUnicode(input,'NFC'),c2,'UNICODE_NFC_ORACLE: '+normalizationCases);
 for(const input of [c4,c5])assert.equal(h.normalizeUnicode(input,'NFC'),c4,'UNICODE_NFC_ORACLE: compatibility form '+normalizationCases);
 for(const input of [c1,c2,c3])assert.equal(h.normalizeUnicode(input,'NFD'),c3,'UNICODE_NFD_ORACLE: '+normalizationCases);
 for(const input of [c4,c5])assert.equal(h.normalizeUnicode(input,'NFD'),c5,'UNICODE_NFD_ORACLE: compatibility form '+normalizationCases);
 normalizationCases++;
}
for(const line of readUnicodeSource('CaseFolding.txt').split(/\r?\n/)){const data=line.split('#')[0].trim();if(!data)continue;const [a,status,b]=data.split(';').map(s=>s.trim());if(status==='C'||status==='F'){assert.equal(h.defaultCaseFold(fromHex(a)),fromHex(b));caseFoldCases++;}}
// UTS #39 revision 28 §4 specifies NFD, removal of default ignorables,
// one mapping pass, then NFD. A raw mapping row is not a promise that
// recursively mapping its target is equivalent. Derive expected output from
// the independent upstream table and the host NFD oracle, whose full pinned
// normalization corpus is checked here before it is used.
for(const line of readUnicodeSource('NormalizationTest.txt').split(/\r?\n/)){const data=line.split('#')[0].trim();if(!data||data.startsWith('@'))continue;const [a,b,c,d,e]=data.split(';').slice(0,5).map(fromHex);for(const input of [a,b,c])assert.equal(input.normalize('NFD'),c);for(const input of [d,e])assert.equal(input.normalize('NFD'),e);}
const mappingRows=readUnicodeSource('confusables.txt').split(/\r?\n/).map(line=>line.split('#')[0].trim()).filter(Boolean).map(line=>line.split(';').slice(0,2).map(fromHex));
const mappings=new Map(mappingRows);
const ignored=readUnicodeSource('DerivedCoreProperties.txt').split(/\r?\n/).map(line=>line.split('#')[0].trim()).filter(line=>line.split(';')[1]?.trim()==='Default_Ignorable_Code_Point').map(line=>{const [a,b=a]=line.split(';')[0].trim().split('..');return [parseInt(a,16),parseInt(b,16)];});
for(const [input] of mappingRows){const expected=Array.from(input.normalize('NFD')).filter(ch=>!ignored.some(([a,b])=>ch.codePointAt(0)>=a&&ch.codePointAt(0)<=b)).map(ch=>mappings.get(ch)||ch).join('').normalize('NFD');assert.equal(h.filenameRiskSkeleton(input),expected);confusableCases++;}
assert.equal(h.filenameRiskSkeleton('file\u200B.txt'),h.filenameRiskSkeleton('file.txt'));

const noHost=load(null,true);assert.equal(noHost.normalizeFilename('e\u0301.txt').canonicalPath,'é.txt','Filename identity depended on host Unicode');
const hostFault=load({before:'function normalizeUnicode(value,form=\'NFC\'){',after:'function normalizeUnicode(value,form=\'NFC\'){ return String(value);'});
assert.throws(()=>hostFault.normalizeFilename('e\u0301.txt'),/UNICODE_TABLE_MISMATCH: bundled normalization failed/);
assert.throws(()=>assert.equal(hostFault.normalizeUnicode('e\u0301.txt'),'é.txt','UNICODE_NFC_ORACLE'),/UNICODE_NFC_ORACLE/);
assert.equal(h.normalizeFilename('e\u0301.txt').canonicalPath,'é.txt');
for(const input of ['../résumé.txt','ré\u0000sumé.txt','ré\u0085sumé.txt','ré\uD800sumé.txt'])assert.throws(()=>h.normalizeFilename(input),/UNSAFE_FILENAME|surrogate|Unicode scalar/i);
console.log(JSON.stringify({unicodeFilenames:'PASS',unicodeVersion:'15.1.0',normalizationCases,normalizationAssertions:normalizationCases*10,caseFoldCases,confusableCases,normalizationBypassFault:'DETECTED',safeUnicodeAccepted:true,unsafePathsRejected:true,sourceSha256:sourceHashes,evidenceClass:'PINNED_UNICODE_CONFORMANCE_AND_FILENAME_COMPONENT_CASES',completeOperatorJourney:false}));
