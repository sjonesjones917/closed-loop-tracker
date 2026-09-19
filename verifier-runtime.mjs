import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {Blob as NodeBlob, File as NodeFile} from 'node:buffer';
import {performance as nodePerformance} from 'node:perf_hooks';

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
  installMissing(context,'structuredClone',globalThis.structuredClone);
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
  const created=vm.createContext(context,options);
  return created;
}

createVerifierRuntime.loadScript=(context,source,options)=>vm.runInContext(source,context,options);
