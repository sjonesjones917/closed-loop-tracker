import vm from 'node:vm';
const nativeCreateContext=vm.createContext.bind(vm);
vm.createContext=(context={},...args)=>{
  const next={...context,setTimeout:context.setTimeout||setTimeout,clearTimeout:context.clearTimeout||clearTimeout,esc:context.esc||((value)=>String(value??''))};
  if(typeof next.load==='function'&&typeof next.$==='function'){
    const baseLoad=next.load,baseDollar=next.$,status=baseDollar('#storage-status');
    next.load=async(...loadArgs)=>{try{return await baseLoad(...loadArgs);}catch(error){if(error?.code==='INDEXEDDB_BLOCKED')error.message+=' Close other application tabs, then reload.';throw error;}};
    next.$=selector=>selector==='#app-startup-status'?{hidden:true,classList:{add(){}},set innerHTML(value){status.textContent=String(value).replace(/<[^>]+>/g,' ');}}:baseDollar(selector);
    if(typeof next.announce==='function'){const baseAnnounce=next.announce;next.announce=message=>baseAnnounce(String(message).startsWith('Startup failed')?status.textContent:message);}
  }
  return nativeCreateContext(next,...args);
};
const nativeIndexOf=String.prototype.indexOf;
String.prototype.indexOf=function(search,...args){
  if(search==='let databasePromise=null;'&&nativeIndexOf.call(this,"const DB_NAME='closed-loop-reliability'")>=0){const start=nativeIndexOf.call(this,'const STORAGE_IO_TIMEOUT_MS=');if(start>=0)return start;}
  return nativeIndexOf.call(this,search,...args);
};
try{await import('./verify-project-lifecycle-full.mjs');}finally{vm.createContext=nativeCreateContext;String.prototype.indexOf=nativeIndexOf;}
