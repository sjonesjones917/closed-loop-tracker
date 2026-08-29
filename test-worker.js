'use strict';

const MAX_STEPS=128;
const enc=new TextEncoder();
const dec=new TextDecoder('utf-8',{fatal:true});
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const stable=value=>{if(value===null||typeof value!=='object')return value;if(Array.isArray(value))return value.map(stable);return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));};
const deepEqual=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const toNumber=value=>{const n=Number(value);if(!Number.isFinite(n))throw new Error('Numeric operation received a non-finite value.');return n;};
const asArray=value=>Array.isArray(value)?value:[value];
const byteView=value=>value instanceof Uint8Array?value:value instanceof ArrayBuffer?new Uint8Array(value):null;
async function sha256(bytes){const view=byteView(bytes);if(!view)throw new Error('HASH_SHA256 requires bytes.');const digest=await crypto.subtle.digest('SHA-256',view);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}
function parseSelector(path){if(path==='$')return [];const tokens=[],re=/(?:\.([A-Za-z0-9_$-]+)|\[(0|[1-9]\d*|\*)\])/g;let last=1,m;while((m=re.exec(path))){if(m.index!==last)throw new Error('Unsupported JSON selector syntax.');tokens.push(m[1]!==undefined?{kind:'key',value:m[1]}:m[2]==='*'?{kind:'wildcard'}:{kind:'index',value:Number(m[2])});last=re.lastIndex;}if(last!==path.length)throw new Error('Unsupported JSON selector syntax.');return tokens;}
function select(value,path){let values=[value];for(const token of parseSelector(path)){const next=[];for(const item of values){if(token.kind==='key'){if(item&&typeof item==='object'&&!Array.isArray(item)&&Object.prototype.hasOwnProperty.call(item,token.value))next.push(item[token.value]);}else if(token.kind==='index'){if(Array.isArray(item)&&token.value<item.length)next.push(item[token.value]);}else if(Array.isArray(item))next.push(...item);else if(item&&typeof item==='object')next.push(...Object.values(item));}values=next;}return values.length===1?values[0]:values;}
function resolveBinding(binding,bindings,artifacts){const spec=bindings?.[binding];if(typeof spec==='string'){const direct=artifacts.find(a=>a.artifactId===spec||a.filename===spec);if(direct)return direct;}if(spec&&typeof spec==='object'){if(spec.artifactId){const hit=artifacts.find(a=>a.artifactId===String(spec.artifactId));if(hit)return hit;}if(spec.filename){const hit=artifacts.find(a=>a.filename===String(spec.filename));if(hit)return hit;}}const direct=artifacts.find(a=>a.artifactId===binding||a.filename===binding);if(direct)return direct;if(artifacts.length===1)return artifacts[0];throw new Error(`Artifact binding ${binding} does not resolve to exactly one supplied artifact.`);}
function regex(step){return new RegExp(String(step.pattern??step.value??''),String(step.flags||''));}
function assertionResult(op,current,step){const expected=step.value;switch(op){case'ASSERT_EQ':return deepEqual(current,expected);case'ASSERT_NE':return!deepEqual(current,expected);case'ASSERT_GT':return toNumber(current)>toNumber(expected);case'ASSERT_GTE':return toNumber(current)>=toNumber(expected);case'ASSERT_LT':return toNumber(current)<toNumber(expected);case'ASSERT_LTE':return toNumber(current)<=toNumber(expected);case'ASSERT_MATCH':return regex(step).test(String(current??''));case'ASSERT_CONTAINS':return Array.isArray(current)?current.some(x=>deepEqual(x,expected)):String(current??'').includes(String(expected??''));case'ASSERT_NOT_CONTAINS':return Array.isArray(current)?!current.some(x=>deepEqual(x,expected)):!String(current??'').includes(String(expected??''));case'ASSERT_SET_EQUAL':return deepEqual([...new Set(asArray(current).map(x=>JSON.stringify(stable(x))))].sort(),[...new Set(asArray(expected).map(x=>JSON.stringify(stable(x))))].sort());case'ASSERT_TRUE':return current===true;case'ASSERT_FALSE':return current===false;default:return null;}}
async function execute(message){
  const spec=message?.spec;if(!spec||spec.version!=='closed-loop-test-spec/1'||!Array.isArray(spec.steps)||!spec.steps.length||spec.steps.length>MAX_STEPS)throw new Error('Invalid Closed Loop Test IR.');const artifacts=(message.artifacts||[]).map(a=>({...a,bytes:new Uint8Array(a.bytes)})),bindings=message.bindings||{};let current=null,artifact=null,assertions=0,failed=0,expected=null,actual=null;const observations=[];
  for(let index=0;index<spec.steps.length;index++){
    const step=spec.steps[index],op=String(step.op||'').toUpperCase();
    switch(op){
      case'LOAD_ARTIFACT':artifact=resolveBinding(String(step.binding||''),bindings,artifacts);current=artifact;break;
      case'READ_BYTES':if(!artifact)throw new Error('READ_BYTES requires a loaded artifact.');current=artifact.bytes;break;
      case'DECODE_UTF8':{const view=byteView(current);if(!view)throw new Error('DECODE_UTF8 requires bytes.');current=dec.decode(view);break;}
      case'PARSE_JSON':if(typeof current!=='string')throw new Error('PARSE_JSON requires text.');current=JSON.parse(current);break;
      case'SELECT_JSON_PATH':current=select(current,String(step.path||'$'));break;
      case'COUNT':current=Array.isArray(current)?current.length:current&&typeof current==='object'?Object.keys(current).length:typeof current==='string'?current.length:0;break;
      case'LENGTH':if(current==null||typeof current.length!=='number')throw new Error('LENGTH requires a value with length.');current=current.length;break;
      case'UNIQUE':current=[...new Map(asArray(current).map(x=>[JSON.stringify(stable(x)),x])).values()];break;
      case'SORT':current=[...asArray(current)].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));break;
      case'SUM':current=asArray(current).reduce((sum,x)=>sum+toNumber(x),0);break;
      case'MIN':current=Math.min(...asArray(current).map(toNumber));break;
      case'MAX':current=Math.max(...asArray(current).map(toNumber));break;
      case'HASH_SHA256':current=await sha256(current);break;
      case'REGEX':current=regex(step).test(String(current??''));break;
      case'ASSERT_EQ':case'ASSERT_NE':case'ASSERT_GT':case'ASSERT_GTE':case'ASSERT_LT':case'ASSERT_LTE':case'ASSERT_MATCH':case'ASSERT_CONTAINS':case'ASSERT_NOT_CONTAINS':case'ASSERT_SET_EQUAL':case'ASSERT_TRUE':case'ASSERT_FALSE':{
        const pass=assertionResult(op,current,step);assertions++;if(!pass)failed++;expected=op==='ASSERT_TRUE'?true:op==='ASSERT_FALSE'?false:clone(step.value??step.pattern);actual=current instanceof Uint8Array?`<${current.byteLength} bytes>`:clone(current);observations.push({step:index+1,op,pass,expected,actual});break;
      }
      default:throw new Error(`Unsupported Test IR operation ${op||'UNKNOWN'}.`);
    }
    if(!op.startsWith('ASSERT_'))observations.push({step:index+1,op,value:current instanceof Uint8Array?`<${current.byteLength} bytes>`:clone(current)});
  }
  if(!assertions)throw new Error('Executable Test IR must contain at least one assertion.');
  return {determination:failed?'VIOLATED':'SATISFIED',status:failed?'VIOLATED':'SATISFIED',assertions,failedAssertions:failed,expected,actual,observations,artifactIdentities:artifacts.map(a=>({artifactId:a.artifactId,filename:a.filename,sha256:a.sha256,byteSize:a.byteSize}))};
}
self.onmessage=async event=>{try{self.postMessage(await execute(event.data||{}));}catch(error){self.postMessage({error:String(error?.message||error),determination:'EXECUTION_FAILED',status:'EXECUTION_FAILED'});}};
