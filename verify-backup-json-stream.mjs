import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {gzipSync} from 'node:zlib';
import {performance} from 'node:perf_hooks';

const source=fs.readFileSync('project-store.js','utf8');
const start=source.indexOf('async function readPackageJson('),end=source.indexOf('\nasync function base64BlobToBlob(',start);
assert.ok(start>=0&&end>start);
const parser=source.slice(start,end);
function runtime(fault=null){
 let implementation=parser;
 if(fault){assert.ok(implementation.includes(fault.before),'Implementation fault anchor must exist');implementation=implementation.replace(fault.before,fault.after);}
 implementation=implementation.replace('for(let i=0;i<text.length;i++){','for(let i=0;i<text.length;i++){globalThis.parserSteps++;');
 const context=vm.createContext({Blob,TextDecoder,DecompressionStream,setTimeout,parserSteps:0});
 vm.runInContext(implementation+'\nglobalThis.decode=readPackageJson;',context);
 return context;
}
const compressed=text=>new Blob([gzipSync(Buffer.from(text,'utf8'))]);
const r=runtime(),cases=[];
const note=name=>cases.push({name,result:'PASS'});
const bytes=process.argv.includes('--large')?48000000:4194304;
const text='H'.repeat(bytes)+'é🙂TAIL';
const fixture=JSON.parse('{"__proto__":{"preserved":true},"project":{"text":'+JSON.stringify(text)+'},"artifacts":[{"artifactId":"bytes","base64":"AAH+/w=="}],"nested":[null,true,false,-1.25e3,{"escaped":"\\\"\\\\\\t\\n\\r\\b\\f\\u0000"}]}');
const encoded=JSON.stringify(fixture),began=performance.now(),decoded=await r.decode(compressed(encoded)),elapsedMs=performance.now()-began;
assert.equal(decoded.payload.project.text,text);
assert.equal(Object.hasOwn(decoded.payload,'__proto__'),true);
assert.deepEqual(JSON.parse(JSON.stringify(decoded.payload.nested)),fixture.nested);
assert.equal(decoded.payload.artifacts[0].base64,'');
assert.equal(await decoded.fileContents.get(decoded.payload.artifacts[0]).blob.text(),'AAH+/w==');
note('Long project text, prototype-named properties, numeric values, escape sequences and spooled artifact spelling match independent JSON decoding');

// Put escaped Unicode, quotes and backslashes on both sides of the production
// 16 KiB string-piece and 64 KiB decoder boundaries. No stage state is injected.
for(const boundary of [16384,65536])for(const delta of [-7,-1,0,1,7]){
 const prefix='x'.repeat(boundary+delta),raw='{"value":"'+prefix+'\\uD83D\\uDE42\\\\\\\"\\nend","next":true}';
 const actual=await r.decode(compressed(raw));assert.deepEqual(JSON.parse(JSON.stringify(actual.payload)),JSON.parse(raw));
}
note('Escaped characters and Unicode remain exact across both chunk boundaries');
const invalid=['{"value":"unterminated}','{"value":"bad\\q"}','{"value":"bad\\u12z4"}','{"value":"bad\ncontrol"}','[}', '{]', '[1,]', '{"a":1,}', '{"a" 1}', '{"a":"one" "b":"two"}', 'true false', '{"artifacts":[{"base64":"é"}]}'];
for(const raw of invalid)await assert.rejects(()=>r.decode(compressed(raw)),undefined,'Malformed JSON must be rejected: '+JSON.stringify(raw));
note('Malformed escapes, raw controls, missing separators, mismatched containers, trailing values and non-ASCII artifact encodings are rejected');

const stepBound=Math.ceil(Buffer.byteLength(encoded)/256)+4096;
assert.ok(r.parserSteps<stepBound,'BACKUP_SCAN_COST_ORACLE: plain retained text required '+r.parserSteps+' JavaScript character steps; bound '+stepBound);
note('Plain retained strings are scanned in bounded spans rather than one JavaScript iteration per character');

const slow=runtime({before:'if(!unicode&&!escape){',after:'if(false){'});
await slow.decode(compressed(encoded));
assert.ok(slow.parserSteps>=stepBound,'The removed span-scanning implementation fault must violate the cost oracle');
const permissive=runtime({before:"if(!parent||parent.type!==(char==='}'?'object':'array')||!['keyOrEnd','valueOrEnd','commaOrEnd'].includes(parent.state))fail();",after:'/* deliberate wrong-container validation bypass */'});
const wronglyAccepted=await permissive.decode(compressed('[}'));
assert.deepEqual(JSON.parse(JSON.stringify(wronglyAccepted.payload)),[]);
note('Targeted slow-scanning and mismatched-container validation faults are detected by the same cost and rejection oracles');
console.log(JSON.stringify({synthetic:true,actualBrowser:false,environment:'Node executes the production streaming backup parser; node:zlib and JSON.parse provide independent byte/structure fixtures',workload:{plainTextCharacters:bytes,expandedBytes:Buffer.byteLength(encoded)},observation:{elapsedMs,parserSteps:r.parserSteps,stepBound,deliberateSlowFaultSteps:slow.parserSteps},cases},null,2));
