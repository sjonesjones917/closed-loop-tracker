import fs from 'node:fs';
import vm from 'node:vm';

vm.runInThisContext(fs.readFileSync('hash.js','utf8'),{filename:'hash.js'});
const hash=globalThis.closedLoopHash;
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const mustReject=(label,build)=>{
  let rejected=false;
  try{hash.stableStringify(build());}catch(error){rejected=error instanceof TypeError;}
  assert(rejected,`${label} must be rejected by canonical serialization.`);
};

assert(hash.sha256Text('')==='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855','SHA-256 empty-string vector failed.');
assert(hash.sha256Text('abc')==='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad','SHA-256 abc vector failed.');
assert(hash.stableStringify({b:1,a:2})===hash.stableStringify({a:2,b:1}),'Canonical object key ordering is not stable.');
assert(hash.stableStringify(Object.assign(Object.create(null),{b:1,a:2}))==='{"a":2,"b":1}','Null-prototype JSON object canonicalization failed.');

mustReject('Infinity',()=>({x:Infinity}));
mustReject('NaN',()=>({x:NaN}));
mustReject('-Infinity',()=>({x:-Infinity}));
mustReject('undefined object member',()=>({x:undefined}));
mustReject('undefined array member',()=>[undefined]);
mustReject('undefined root',()=>undefined);
mustReject('bigint',()=>({x:1n}));
mustReject('function',()=>({x(){}}));
mustReject('symbol value',()=>({x:Symbol('x')}));
mustReject('symbol key',()=>{const value={};value[Symbol('x')]=1;return value;});
mustReject('Date',()=>new Date(0));
mustReject('Map',()=>new Map([['x',1]]));
mustReject('Set',()=>new Set([1]));
mustReject('sparse array',()=>{const value=[];value.length=1;return value;});
mustReject('array extra property',()=>{const value=[1];value.extra=2;return value;});
mustReject('accessor property',()=>{const value={};Object.defineProperty(value,'x',{enumerable:true,get(){return 1;}});return value;});
mustReject('cycle',()=>{const value={};value.self=value;return value;});

console.log(JSON.stringify({hashVectors:true,canonicalOrdering:true,ambiguousValuesRejected:17},null,2));
