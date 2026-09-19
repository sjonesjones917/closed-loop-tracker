import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {Blob as NodeBlob, File as NodeFile} from 'node:buffer';
import {performance as nodePerformance} from 'node:perf_hooks';
const verifierHashSource=readFileSync(new URL('./hash.js',import.meta.url),'utf8');

function memoryStorage(){
  const values=new Map();
  return {
    get length(){return values.size;},
    key(index){return [...values.keys()][Number(index)]??null;},
    getItem(key){key=String(key);return values.has(key)?values.get(key):null;},
    setItem(key,value){values.set(String(key),String(value));},
    removeItem(key){values.delete(String(key));},
    clear(){values.clear();}
  };
}

function installMissing(target,key,value){if(!(key in target)||target[key]===undefined)target[key]=value;}

function evaluateScript(context,source,options){return context===globalThis?vm.runInThisContext(source,options):vm.runInContext(source,context,options);}

export function createVerifierRuntime(seed={},options){
  if(!seed||typeof seed!=='object')throw new TypeError('Verifier runtime seed must be an object.');
  const context=seed;
  installMissing(context,'setTimeout',globalThis.setTimeout);
  installMissing(context,'clearTimeout',globalThis.clearTimeout);
  installMissing(context,'setInterval',globalThis.setInterval);
  installMissing(context,'clearInterval',globalThis.clearInterval);
  installMissing(context,'queueMicrotask',globalThis.queueMicrotask);
  installMissing(context,'AbortController',globalThis.AbortController);
  installMissing(context,'AbortSignal',globalThis.AbortSignal);
  installMissing(context,'crypto',globalThis.crypto||webcrypto);
  installMissing(context,'TextEncoder',globalThis.TextEncoder);
  installMissing(context,'TextDecoder',globalThis.TextDecoder);
  installMissing(context,'Blob',globalThis.Blob||NodeBlob);
  installMissing(context,'File',globalThis.File||NodeFile);
  installMissing(context,'URL',globalThis.URL);
  installMissing(context,'URLSearchParams',globalThis.URLSearchParams);
  installMissing(context,'performance',globalThis.performance||nodePerformance);
  installMissing(context,'atob',globalThis.atob);
  installMissing(context,'btoa',globalThis.btoa);
  installMissing(context,'console',console);
  installMissing(context,'localStorage',memoryStorage());
  installMissing(context,'sessionStorage',memoryStorage());
  if(!context.navigator||typeof context.navigator!=='object')context.navigator={};
  if(!context.navigator.storage||typeof context.navigator.storage!=='object')context.navigator.storage={};
  installMissing(context.navigator.storage,'persist',async()=>false);
  installMissing(context.navigator.storage,'estimate',async()=>({usage:0,quota:Number.MAX_SAFE_INTEGER}));
  if(typeof context.requestAnimationFrame!=='function')context.requestAnimationFrame=callback=>context.setTimeout(()=>callback(context.performance?.now?.()??Date.now()),0);
  if(typeof context.cancelAnimationFrame!=='function')context.cancelAnimationFrame=id=>context.clearTimeout(id);
  const hasStructuredCloneOverride=Object.prototype.hasOwnProperty.call(context,'structuredClone')&&context.structuredClone!==undefined;
  const created=context===globalThis?context:vm.createContext(context,options);
  if(!hasStructuredCloneOverride){
    created.structuredClone=evaluateScript(created,`(()=>{
      const tagOf=value=>Object.prototype.toString.call(value);
      const clone=(value,seen=new Map())=>{
        const type=typeof value;
        if(value===null||type!=='object'){if(type==='function'||type==='symbol')throw new TypeError('Value is not structured-cloneable.');return value;}
        if(seen.has(value))return seen.get(value);
        if(Array.isArray(value)){const out=[];seen.set(value,out);for(const item of value)out.push(clone(item,seen));return out;}
        const tag=tagOf(value);
        if(tag==='[object Date]')return new Date(value.getTime());
        if(tag==='[object RegExp]'){const out=new RegExp(value.source,value.flags);out.lastIndex=value.lastIndex;return out;}
        if(tag==='[object Map]'){const out=new Map();seen.set(value,out);for(const [key,item] of value)out.set(clone(key,seen),clone(item,seen));return out;}
        if(tag==='[object Set]'){const out=new Set();seen.set(value,out);for(const item of value)out.add(clone(item,seen));return out;}
        if(tag==='[object ArrayBuffer]'){const out=new ArrayBuffer(value.byteLength);new Uint8Array(out).set(new Uint8Array(value));seen.set(value,out);return out;}
        if(ArrayBuffer.isView(value)){const buffer=clone(value.buffer,seen);let out;if(tag==='[object DataView]')out=new DataView(buffer,value.byteOffset,value.byteLength);else{const C=globalThis[value.constructor?.name];if(typeof C!=='function')throw new TypeError('Unsupported typed array in verifier structuredClone.');out=new C(buffer,value.byteOffset,value.length);}seen.set(value,out);return out;}
        if(tag==='[object Blob]'&&typeof Blob==='function'){const out=value.slice(0,value.size,value.type);seen.set(value,out);return out;}
        if(tag==='[object File]'&&typeof File==='function'){const out=new File([value],value.name,{type:value.type,lastModified:value.lastModified});seen.set(value,out);return out;}
        if(tag==='[object Error]'){const C=typeof globalThis[value.name]==='function'?globalThis[value.name]:Error,out=new C(value.message);seen.set(value,out);out.name=value.name;if(value.stack)out.stack=value.stack;return out;}
        if(tag!=='[object Object]')throw new TypeError('Unsupported value in verifier structuredClone: '+tag);
        const out={};seen.set(value,out);for(const key of Object.keys(value))out[key]=clone(value[key],seen);return out;
      };
      return (value,options)=>{if(options?.transfer?.length)throw new TypeError('Transfer lists are not supported by verifier structuredClone.');return clone(value);};
    })()`,{filename:'verifier-runtime:structuredClone'});
  }
  if(!('closedLoopHash' in created)||created.closedLoopHash===undefined)evaluateScript(created,verifierHashSource,{filename:'hash.js'});
  return created;
}

createVerifierRuntime.loadScript=(context,source,options)=>evaluateScript(context===globalThis?createVerifierRuntime(context):context,source,options);
