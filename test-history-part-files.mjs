// Independent reading of a stored History part list (both
// closed-loop-recovery-project-parts/1 and /2), for consumers that rebuild a
// complete version or select its retained files without the production store.
// A /2 segments entry {path,sha256,byteSize,segments:[{sha256,byteSize,count}]}
// names no file itself: its segments are the files, and their concatenation
// is the array whose canonical encoding has the entry's sha256/byteSize.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const canonical=x=>x===null||typeof x!=='object'?JSON.stringify(x):Array.isArray(x)?'['+x.map(canonical).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';

// Every retained file a part list depends on, in restore order.
export function historyListFiles(parts){
 return (parts?.entries||[]).flatMap(part=>Array.isArray(part.segments)?part.segments.map(({sha256,byteSize})=>({sha256,byteSize})):[{sha256:part.sha256,byteSize:part.byteSize}]);
}
// The value (non-segment) entries of a part list.
export const historyValueEntries=parts=>(parts?.entries||[]).filter(part=>!Array.isArray(part.segments));
// Rebuild a complete version's project in place: readBytes(sha256) returns
// the retained file's bytes (Uint8Array). Every file's digest and size, every
// segment's count and every segmented array's identity are checked.
export async function rebuildHistoryProject(project,parts,readBytes,{label='HISTORY_PART_REBUILD'}={}){
 const read=async file=>{const bytes=await readBytes(file.sha256);assert.equal(sha(bytes),file.sha256,label+': file digest');assert.equal(bytes.length,file.byteSize,label+': file size');return JSON.parse(Buffer.from(bytes).toString('utf8'));};
 for(const part of parts?.entries||[]){
  let value;
  if(Array.isArray(part.segments)){
   value=[];for(const segment of part.segments){const items=await read(segment);assert.ok(Array.isArray(items)&&items.length===segment.count,label+': segment count');for(const item of items)value.push(item);}
   const text=canonical(value);assert.equal(sha(text),part.sha256,label+': segmented array identity');assert.equal(Buffer.byteLength(text),part.byteSize,label+': segmented array size');
  }else value=await read(part);
  let parent=project;for(const key of part.path.slice(0,-1))parent=parent[key];parent[part.path.at(-1)]=value;
 }
 return project;
}
