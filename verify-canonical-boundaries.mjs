import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';

// Expected results follow the closed JSON and RFC3339 contracts, not the
// implementation's regexes, Date.UTC behavior, or generated success flags.
const sourcePath=process.env.CANONICAL_BOUNDARY_HASH_SOURCE||'hash.js';
const source=fs.readFileSync(sourcePath,'utf8');
vm.runInThisContext(source,{filename:sourcePath});
const h=globalThis.closedLoopHash,results=[];
const prefixes=process.argv.slice(2).map(arg=>{if(!arg.startsWith('--case-prefix='))throw new Error('Unknown argument: '+arg);return arg.slice('--case-prefix='.length);});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function check(caseId,input,expected,observe){
  if(prefixes.length&&!prefixes.some(prefix=>caseId.startsWith(prefix)))return;
  let actual;
  try{actual=await observe();}catch(error){actual={unexpectedError:{name:error.name,message:error.message}};}
  const status=isDeepStrictEqual(actual,expected)?'PASS':'FAIL';
  results.push({caseId,input,expected,actual,status});
  if(status==='FAIL')process.exitCode=1;
}
const serializers={string:async value=>h.stableStringify(value),digest:async value=>h.sha256Value(value),stream:async value=>h.sha256Chunks(h.canonicalChunks(value))};
async function rejected(value,serialize){
  try{await serialize(value);return {rejected:false};}
  catch(error){return {rejected:error instanceof TypeError&&/^Cannot canonically hash/.test(error.message)};}
}
for(const [method,serialize] of Object.entries(serializers)){
  for(const key of ['00','01','000','1e0','-0','1.0','extra']){
    const value=[7,8];Object.defineProperty(value,key,{value:'SUBSTANTIVE-EXTRA',enumerable:true});
    await check(`CB-ARRAY-EXTRA-${method}-${key}`,{array:[7,8],extraOwnKey:key,extraOwnValue:'SUBSTANTIVE-EXTRA'},{rejected:true},()=>rejected(value,serialize));
  }
  for(const accessorKind of ['get','set','get+set']){
    let invoked=0;const value=[7];const descriptor={enumerable:true,configurable:true};
    if(accessorKind.includes('get'))descriptor.get=()=>++invoked;
    if(accessorKind.includes('set'))descriptor.set=()=>{invoked++;};
    Object.defineProperty(value,'0',descriptor);
    await check(`CB-ARRAY-ACCESSOR-${method}-${accessorKind}`,{index:0,accessorKind,repetitions:2},{first:{rejected:true},second:{rejected:true},invoked:0},async()=>({first:await rejected(value,serialize),second:await rejected(value,serialize),invoked}));
  }
  for(const enumerable of [false,true]){
    const value=[7];Object.defineProperty(value,Symbol('substantive'),{value:'MUST-NOT-DISAPPEAR',enumerable});
    await check(`CB-ARRAY-SYMBOL-${method}-${enumerable}`,{array:[7],symbolOwnValue:'MUST-NOT-DISAPPEAR',enumerable},{rejected:true},()=>rejected(value,serialize));
  }
  const fixtures=[[],[1],[null,true,'é🙂'],[{'a':1,'b':[2,3]},4],Object.freeze([0,1,2])];
  for(let index=0;index<fixtures.length;index++){
    const value=fixtures[index],canonical=JSON.stringify(value),expected=method==='string'?canonical:digest(canonical);
    await check(`CB-ARRAY-VALID-${method}-${index}`,{canonical},expected,()=>serialize(value));
  }
}
// Calendar exploration is bounded to a complete 400-year Gregorian leap cycle,
// including every month. The oracle is independent integer divisibility and a
// month-length table. We exercise each final valid day and the following invalid
// day; no JavaScript Date constructor is used to derive expected results.
for(let year=0;year<400;year++)for(let month=1;month<=12;month++){
  const leap=year%4===0&&(year%100!==0||year%400===0);
  const last=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
  for(const day of [last,last+1]){
    const text=`${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const expected=day===last?{kind:'DATE_ONLY',original:text,normalized:text,timeBasis:'NOT_APPLICABLE'}:{rejected:true};
    await check(`CB-DATE-${text}`,{value:text},expected,()=>{
      try{const {kind,original,normalized,timeBasis}=h.normalizeDateTime(text);return {kind,original,normalized,timeBasis};}
      catch(error){if(error instanceof TypeError&&/^INVALID_DATE_TIME:/.test(error.message))return {rejected:true};throw error;}
    });
  }
}
const instantCases=[
 ['0000-02-29T12:34:56.789Z','0000-02-29T12:34:56.789Z'],
 ['0001-01-01T00:00:00Z','0001-01-01T00:00:00.000Z'],
 ['0096-02-29T23:59:59.123Z','0096-02-29T23:59:59.123Z'],
 ['0099-01-01T00:00:00.000Z','0099-01-01T00:00:00.000Z'],
 ['0099-01-01T00:00:00.001+01:00','0098-12-31T23:00:00.001Z'],
 ['0099-12-31T23:30:00-01:00','0100-01-01T00:30:00.000Z'],
 ['0100-01-01T00:00:00.000Z','0100-01-01T00:00:00.000Z'],
 ['2000-02-29T23:59:59.999Z','2000-02-29T23:59:59.999Z'],
 ['2026-09-17T00:00:00.010-07:00','2026-09-17T07:00:00.010Z'],
 ['9999-12-31T23:59:59.999Z','9999-12-31T23:59:59.999Z'],
];
for(let index=0;index<instantCases.length;index++){
  const [text,normalized]=instantCases[index];
  await check(`CB-INSTANT-${index}`,{value:text},{kind:'INSTANT',original:text,normalized,timeBasis:'DEVICE_REPORTED'},()=>{const {kind,original,normalized,timeBasis}=h.normalizeDateTime(text);return {kind,original,normalized,timeBasis};});
}
for(const [caseId,text] of [
 ['CB-INSTANT-RANGE-UPPER','9999-12-31T23:59:59.999-00:01'],
 ['CB-INSTANT-RANGE-LOWER','0000-01-01T00:00:00.000+00:01'],
 ...['1900-02-29','2100-02-29','2026-00-01','2026-13-01','2026-01-00','0099-01-01T24:00:00Z','0099-01-01T00:60:00Z','0099-01-01T00:00:60Z','0099-01-01T00:00:00+24:00','0099-01-01T00:00:00+01:60'].map((text,index)=>[`CB-INSTANT-INVALID-${index}`,text])
])await check(caseId,{value:text},{rejected:true},()=>{
  try{h.normalizeDateTime(text);return {rejected:false};}
  catch(error){return {rejected:error instanceof TypeError&&/^INVALID_DATE_TIME:/.test(error.message)};}
});
if(!results.length)throw new Error('No requested boundary cases executed.');
console.log(JSON.stringify({selectedCasePrefixes:prefixes,schema:'closed-loop-canonical-boundary-regressions/1',sourcePath,sourceSha256:digest(source),contractTextModified:false,evidenceKind:'executed production-module synthetic boundary cases; not browser or physical-device acceptance',bounds:{calendarYears:{first:0,last:399},months:{first:1,last:12},days:['last valid day','following invalid day'],arrayMethods:Object.keys(serializers)},results},null,2));
