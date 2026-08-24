(()=>{'use strict';
const STORE='closed-loop-reliability-projects-v3';
const BACKUP=`${STORE}-preserved-backup`;
const REVISION='closed-loop-storage-20260824-r1';
const proto=globalThis.Storage?.prototype;
const nativeSetItem=proto?.setItem;
let skippedWrites=0,backupReclaims=0;
function parsed(raw){try{return JSON.parse(raw);}catch{return null;}}
function validPrimary(storage=localStorage){const raw=storage.getItem(STORE),value=parsed(raw);return !!raw&&(Array.isArray(value)||(value&&typeof value==='object'));}
function navigationNeutral(raw){const value=parsed(raw);if(!value)return null;const list=Array.isArray(value)?value:[value];return JSON.stringify(list.map(project=>{if(!project||typeof project!=='object')return project;const copy={...project};delete copy.activeView;delete copy.activeStage;return copy;}));}
function navigationOnlyChange(before,after){if(before===after)return true;const a=navigationNeutral(before),b=navigationNeutral(after);return a!==null&&b!==null&&a===b;}
function reclaimRedundantBackup(storage=localStorage){try{if(!storage.getItem(BACKUP)||!validPrimary(storage))return false;storage.removeItem(BACKUP);backupReclaims++;return true;}catch{return false;}}
function install(){if(!proto||typeof nativeSetItem!=='function'||nativeSetItem.__closedLoopStorageReliability)return;reclaimRedundantBackup();function reliableSetItem(key,value){if(this===localStorage){if(key===BACKUP&&validPrimary(this)){skippedWrites++;return;}if(key===STORE){const before=this.getItem(STORE);if(before&&navigationOnlyChange(before,String(value))){skippedWrites++;return;}reclaimRedundantBackup(this);}}return nativeSetItem.call(this,key,value);}reliableSetItem.__closedLoopStorageReliability=true;Object.defineProperty(proto,'setItem',{configurable:true,writable:true,value:reliableSetItem});}
install();
globalThis.closedLoopStorageReliability={revision:REVISION,storeKey:STORE,backupKey:BACKUP,navigationOnlyChange,reclaimRedundantBackup,metrics:()=>({skippedWrites,backupReclaims})};
})();