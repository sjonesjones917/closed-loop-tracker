import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');

// Compare the actual physical codec with its exact pre-sharing algorithm.
// Only this implementation addition is removed; grammar and refusal owners stay.
export async function verifyPhysicalStringSharing(){
 const source=fs.readFileSync('project-store.js','utf8');
 const additionStart=source.indexOf(' // Sharing happens only after the original join has run.'),additionEnd=source.indexOf('\n const integer=',additionStart);
 assert(additionStart>0&&additionEnd>additionStart,'PHYSICAL_STRING_SHARE_PRIVATE_OWNER_ORACLE');
 const addition=source.slice(additionStart,additionEnd),call="s.value=shareJoinedString(s.pieces.join(''));";
 assert.equal(source.split(call).length,2,'PHYSICAL_STRING_SHARE_ONE_DISPATCH_ORACLE');
 const baseline=source.replace(addition+'\n','').replace(call,"s.value=s.pieces.join('');");
 assert.equal(baseline.includes('shareJoinedString'),false);
 const sources={baseline,candidate:source};
function codec(source){
 const start=source.indexOf("const PHYSICAL_RECORD_SCHEMA="),end=source.indexOf('\n// Captures only the codec',start);
 assert(start>0&&end>start);assert.equal(source.indexOf("const PHYSICAL_RECORD_SCHEMA=",start+1),-1);
 return source.slice(start,end);
}
const setup=`
const PROJECTS='projects',META='meta';
const now=()=> '2026-11-07T00:00:00.000Z';
const storageError=(message,code)=>Object.assign(new Error(message),{code});
const quarantineOwnMarker=()=>false;
`;
const cases=[
 {id:'equal-long-values',input:"({a:'A'.repeat(131072),b:'A'.repeat(131072),c:'A'.repeat(131072)})"},
 {id:'unequal-same-length',input:"({a:'A'.repeat(131072),b:'B'.repeat(131072),c:'A'.repeat(131072)})"},
 {id:'unicode-and-unpaired-code-units',input:"({a:('水😀\\u0000\\ud800').repeat(14000),b:('水😀\\u0000\\ud800').repeat(14000)})"},
 {id:'thresholds-and-short-tails',input:"Object.fromEntries([4097,65535,65536,65537,131073].flatMap(n=>[[n+'a','x'.repeat(n)],[n+'b','x'.repeat(n)]]))"},
 {id:'bounded-population-values',input:"Object.fromEntries(Array.from({length:66},(_,i)=>[String(i),'x'.repeat(65536)+String(i).padStart(2,'0')]).concat([['repeat-last','x'.repeat(65536)+'65'],['repeat-first','x'.repeat(65536)+'00']]))"},
 {id:'join-getter-and-call-order',hook:'observe'},
 {id:'join-second-call-throws',hook:'throw-second',error:'JOIN_SECOND'},
 {id:'join-getter-throws-first',hook:'getter-throw',error:'JOIN_GETTER'},
 {id:'join-primitive-result-override',hook:'override'},
 {id:'join-nonstring-result-not-coerced',hook:'object'},
 {id:'join-mutates-next-fragment',hook:'mutate-next'},
 {id:'map-exposes-record-value-setter',hook:'record-setter'},
 {id:'map-observations-unchanged',hook:'map-observe'},
 {id:'join-restores-itself-before-next-call',hook:'self-restore'},
 {id:'prototype-value-and-next-accessors',hook:'prototype-accessors'},
 {id:'preinstalled-namespace-getters-and-reflection-wrappers',bootstrap:true},
 {id:'malformed-string-end-keeps-first-error',corrupt:'string-end',error:'PHYSICAL_RECORD_INVALID'},
 {id:'reused-string-reference-keeps-refusal',corrupt:'reused-ref',error:'PHYSICAL_RECORD_INVALID'},
 {id:'changed-command-count-keeps-refusal',corrupt:'command-count',error:'PHYSICAL_RECORD_INVALID'},
 {id:'changed-string-count-keeps-refusal',corrupt:'string-count',error:'PHYSICAL_RECORD_INVALID'}
];
function observeControl(variant,source,control){
  const context=createVerifierRuntime({});
  if(control.bootstrap)createVerifierRuntime.loadScript(context,`{
   const events=[],names=['Map','Object','String'],descriptors=names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]),own=Object.defineProperty,nativeToString=Function.prototype.toString,nativeApply=Reflect.apply;
   for(const [name,descriptor] of descriptors)own(globalThis,name,{configurable:true,get(){events.push(name);return descriptor.value;}});
   Function.prototype.toString=function(){events.push('Function.toString');return nativeApply(nativeToString,this,[]);};
   Reflect.apply=function(...args){events.push('Reflect.apply');return nativeApply(...args);};
   globalThis.__bootstrapEvents=events;
   globalThis.__restoreBootstrap=()=>{for(const [name,descriptor] of descriptors)own(globalThis,name,descriptor);Function.prototype.toString=nativeToString;Reflect.apply=nativeApply;};
  }`,{filename:'physical-sharing-bootstrap-controls.js'});
  createVerifierRuntime.loadScript(context,setup+codec(source),{filename:variant+'-physical-codec-extracted.js'});
  context.control=control;
  const body=`(()=>{
   const input=${control.input||"({a:'x'.repeat(131072),b:'x'.repeat(131072),c:'x'.repeat(131072)})"};
   const encoded=encodePhysicalRow({jobId:'J',project:input},PROJECTS,'project',{force:true});
   const before=JSON.stringify(encoded),events=[],joinDescriptor=Object.getOwnPropertyDescriptor(Array.prototype,'join'),nativeJoin=joinDescriptor.value,nativeGet=Map.prototype.get,nativeSet=Map.prototype.set,prototypeValue=Object.getOwnPropertyDescriptor(Object.prototype,'value'),prototypeNext=Object.getOwnPropertyDescriptor(Object.prototype,'next');
   let calls=0,triggered=0;const commands=encoded.parts.flatMap(part=>part.value.commands);
   if(control.corrupt==='string-end'){commands.filter(c=>c[0]==='stringEnd')[1][2]++;triggered++;}
   if(control.corrupt==='reused-ref'){const rows=commands.filter(c=>c[0]==='property'&&c[3][0]==='stringRef');rows[1][3]=rows[0][3];triggered++;}
   if(control.corrupt==='command-count'){encoded.root.storageEncoding.commandCount++;triggered++;}
   if(control.corrupt==='string-count'){encoded.root.storageEncoding.stringCodeUnits++;triggered++;}
   const isPieces=value=>Array.isArray(value)&&value.length>0&&typeof value[0]==='string'&&value[0].length>4096;
   if(control.hook==='prototype-accessors'){
    Object.defineProperty(Object.prototype,'next',{configurable:true,get(){throw new Error('UNEXPECTED_NEXT_GET');},set(){throw new Error('UNEXPECTED_NEXT_SET');}});
    Object.defineProperty(Object.prototype,'value',{configurable:true,get(){events.push(['prototype-value-get']);throw new Error('UNEXPECTED_VALUE_GET');},set(value){triggered++;events.push(['prototype-value-set',typeof value]);Object.defineProperty(this,'value',{value,writable:true,enumerable:true,configurable:true});}});
   }
   if(control.hook==='map-observe'||control.hook==='record-setter'){
    Map.prototype.get=function(key){events.push(['map-get',typeof key]);return nativeGet.call(this,key);};
    Map.prototype.set=function(key,value){
     events.push(['map-set',typeof key]);
     if(control.hook==='record-setter'&&value&&Array.isArray(value.pieces)){
      triggered++;let saved;
      Object.defineProperty(value,'value',{configurable:true,enumerable:true,get(){events.push(['record-value-get']);return saved;},set(next){events.push(['record-value-set',typeof next]);saved=next;}});
     }
     return nativeSet.call(this,key,value);
    };
   }
   if(control.hook&& !control.hook.startsWith('map-')&&control.hook!=='prototype-accessors')Object.defineProperty(Array.prototype,'join',{configurable:true,get(){
    if(isPieces(this)){events.push(['join-get',this.length]);if(control.hook==='getter-throw'){triggered++;throw Object.assign(new Error('JOIN_GETTER'),{code:'JOIN_GETTER'});}}
    return function(separator){
     if(!isPieces(this))return nativeJoin.call(this,separator);
     calls++;events.push(['join-call',calls,separator]);
     if(control.hook==='self-restore'){triggered++;Object.defineProperty(Array.prototype,'join',joinDescriptor);}
     if(control.hook==='throw-second'&&calls===2){triggered++;throw Object.assign(new Error('JOIN_SECOND'),{code:'JOIN_SECOND'});}
     if(control.hook==='mutate-next'&&calls===1){const next=commands.find(c=>c[0]==='stringPart'&&c[1]===1);next[3]='y'.repeat(next[3].length);triggered++;}
     const joined=nativeJoin.call(this,separator);
     if(control.hook==='override'){triggered++;return 'z'.repeat(joined.length);}
     if(control.hook==='object'){triggered++;return {length:joined.length,toString(){throw new Error('COERCION_FORBIDDEN');}};}
     return joined;
    };
   }});
   let result,error;
   try{result=decodePhysicalRow(encoded.root,PROJECTS,'project',encoded.parts);}catch(value){error={name:value.name,code:value.code||null,message:value.message};}
   finally{Object.defineProperty(Array.prototype,'join',joinDescriptor);Map.prototype.get=nativeGet;Map.prototype.set=nativeSet;if(control.hook==='prototype-accessors'){if(prototypeValue)Object.defineProperty(Object.prototype,'value',prototypeValue);else delete Object.prototype.value;if(prototypeNext)Object.defineProperty(Object.prototype,'next',prototypeNext);else delete Object.prototype.next;}}
   const sourcePreserved=before===JSON.stringify(encoded);globalThis.__restoreBootstrap?.();
   return JSON.stringify({result,error,events,calls,triggered,sourcePreserved,bootstrapEvents:globalThis.__bootstrapEvents||[]});
  })()`;
  return JSON.parse(createVerifierRuntime.loadScript(context,body,{filename:control.id+'.js'}));
}
const reports=[];
for(const control of cases){
 const observations=Object.fromEntries(Object.entries(sources).map(([variant,source])=>[variant,observeControl(variant,source,control)]));
 assert.deepEqual(observations.candidate,observations.baseline,control.id);
 if(control.error)assert.equal(observations.baseline.error?.code,control.error,control.id);
 else assert.equal(observations.baseline.error,undefined,control.id);
 if(control.hook&&!['observe','map-observe'].includes(control.hook)||control.corrupt)assert(observations.baseline.triggered>0,control.id);
 if(control.hook==='observe')assert.equal(observations.baseline.calls,3);
 if(control.hook==='map-observe')assert(observations.baseline.events.some(row=>row[0]==='map-set'));
 reports.push({id:control.id,outcome:'MATCH',calls:observations.baseline.calls,triggered:observations.baseline.triggered,error:observations.baseline.error||null,observationSha256:sha(JSON.stringify(observations.baseline))});
}

 const identityObservations={};
 for(const [variant,value]of Object.entries(sources)){
  const context=createVerifierRuntime({});
  createVerifierRuntime.loadScript(context,setup+codec(value),{filename:variant+'-physical-identity.js'});
  identityObservations[variant]=JSON.parse(createVerifierRuntime.loadScript(context,`(()=>{
   const text='V'.repeat(65536),shared={text},blob=new Blob(['same bytes']),otherBlob=new Blob(['same bytes']);
   const input={sharedA:shared,sharedB:shared,distinctA:{text},distinctB:{text},blobA:blob,blobAlias:blob,blobOther:otherBlob};
   const encoded=encodePhysicalRow({jobId:'J',project:input},PROJECTS,'project',{force:true}),output=decodePhysicalRow(encoded.root,PROJECTS,'project',encoded.parts).project;
   return JSON.stringify({sharedObjectAlias:output.sharedA===output.sharedB,distinctEqualObjects:output.distinctA!==output.distinctB,sharedBlobAlias:output.blobA===output.blobAlias,originalBlobIdentity:output.blobA===blob,distinctEqualBlobs:output.blobA!==output.blobOther,otherBlobIdentity:output.blobOther===otherBlob,exactText:output.sharedA.text===text&&output.distinctA.text===text&&output.distinctB.text===text});
  })()`,{filename:'physical-sharing-alias-and-blob-control.js'}));
 }
 assert.deepEqual(identityObservations.candidate,identityObservations.baseline);
 for(const value of Object.values(identityObservations.candidate))assert.equal(value,true,'PHYSICAL_STRING_SHARE_GRAPH_IDENTITY_ORACLE');
 const identityPreservation=identityObservations.candidate;
 const faultMutants=[];
 for(const [id,controlId,before,after]of [
  ['skip-original-join','join-second-call-throws',call,"s.value=shareJoinedString('x'.repeat(s.units));"],
  ['reuse-unequal-long-value','unequal-same-length','if(entry.value===value)return entry.value;','if(entry.value.length===value.length)return entry.value;']
 ]){
  assert.equal(source.split(before).length,2);const faultSource=source.replace(before,after),control=cases.find(row=>row.id===controlId),normal=observeControl('current',source,control),mutant=observeControl(id,faultSource,control);
  assert.notDeepEqual(mutant,normal,'PHYSICAL_STRING_SHARE_FAULT_DETECTED_ORACLE '+id);
  if(id==='skip-original-join'){assert.equal(normal.error?.code,'JOIN_SECOND');assert.equal(mutant.error,undefined);assert.equal(mutant.calls,0);}
  else{assert.equal(normal.result.project.b,'B'.repeat(131072));assert.equal(mutant.result.project.b,'A'.repeat(131072));}
  faultMutants.push({id,outcome:'DETECTED',oracle:id==='skip-original-join'?'ORIGINAL_JOIN_ERROR_AND_CALLS':'EXACT_UNEQUAL_VALUE',executedSourceSha256:sha(faultSource),normalObservationSha256:sha(JSON.stringify(normal)),mutantObservationSha256:sha(JSON.stringify(mutant))});
 }

 const hitAnchor='if(entry.value===value)return entry.value;',hitProbe='if(entry.value===value){globalThis.__physicalShareHits++;return entry.value;}';
 assert.equal(source.split(hitAnchor).length,2);
 const observed=source.replace(hitAnchor,hitProbe);assert.equal(observed.replace(hitProbe,hitAnchor),source);
 const privateContext=createVerifierRuntime({__physicalShareHits:0});
 createVerifierRuntime.loadScript(privateContext,setup+codec(observed),{filename:'physical-sharing-observed.js'});
 createVerifierRuntime.loadScript(privateContext,`{const value='x'.repeat(131072),row=encodePhysicalRow({jobId:'J',project:{a:value,b:value,c:value}},PROJECTS,'project',{force:true});decodePhysicalRow(row.root,PROJECTS,'project',row.parts);}`,{filename:'physical-sharing-hit-control.js'});
 assert.equal(privateContext.__physicalShareHits,2,'PHYSICAL_STRING_SHARE_ACTUAL_ROUTE_ORACLE');
 const publicStorage=await verifyPhysicalSharingStorage(source);
 return {schema:'closed-loop-physical-string-sharing-evidence/1',synthetic:true,actualBrowser:false,actualApplication:false,actualStorageAdapter:true,originalJoinPreserved:true,scope:'ONE_PHYSICAL_DECODE',maximumEntries:64,minimumCodeUnits:65536,cases:reports,identityPreservation,faultMutants,privateRouting:{instrumentation:'SYNTHETIC_EXACT_SOURCE_COUNTER',duplicateHits:2,sourceRestored:true},publicStorage,sourceSha256:Object.fromEntries(['project-store.js','test-physical-string-sharing.mjs','verifier-runtime.mjs','hash.js','test-project-store-runtime.mjs'].map(file=>[file,sha(fs.readFileSync(file))]))};
}

async function verifyPhysicalSharingStorage(source){
 const threshold='const PHYSICAL_INLINE_BYTES=256*1024*1024,',replacement='const PHYSICAL_INLINE_BYTES=128*1024,';
 assert.equal(source.split(threshold).length,2);
 const packed=source.replace(threshold,replacement);assert.equal(packed.replace(replacement,threshold),source);
 const r=projectStoreRuntime({storageWorker:false,sourceOverrides:{'project-store.js':packed}}),{core,engine,store,copy}=r;
 await store.ready;
 let project=core.createBlankState('PHYSICAL-STRING-SHARING');engine.ensureShape(project);
 project.projectData.rawResponses=copy(Array.from({length:3},(_,i)=>({rawResponseId:'SHARED-'+i,stage:1,status:'PRESERVED',rawText:'S'.repeat(65536)+'😀TAIL'})));
 engine.recalculate(project);project=await store.writeProject(project,{expectedProjectRevision:0});
 const row=r.rows.get('projects').get(project.job.JOB_ID);assert.equal(row.storageEncoding?.schema,'closed-loop-record-parts/1');
 const reread=await store.readProject(project.job.JOB_ID);assert.deepEqual(reread,project,'PHYSICAL_STRING_SHARE_PUBLIC_REREAD_ORACLE');
 const database=()=>JSON.stringify([...r.rows].map(([name,rows])=>[name,[...rows]]));
 const beforeStale=database(),beforeRows=[...r.rows].map(([name,rows])=>[name,[...rows]]);await assert.rejects(()=>store.writeProject(copy(project),{expectedProjectRevision:project.revision+1,expectedStateSha256:project.projectSha256}),error=>error.code==='STALE_PROJECT_REVISION');assert.equal(database(),beforeStale,'PHYSICAL_STRING_SHARE_STALE_ATOMICITY_ORACLE');
 for(const [name,rows]of beforeRows){assert.equal(r.rows.get(name).size,rows.length);for(const [key,row]of rows)assert.equal(r.rows.get(name).get(key),row,'PHYSICAL_STRING_SHARE_STALE_STORED_ROW_IDENTITY_ORACLE');}
 const generation=row.storageEncoding.generation,parts=[...r.rows.get('meta').values()].filter(part=>part.value?.generation===generation),command=parts.flatMap(part=>part.value.commands).find(command=>command[0]==='stringPart'&&command[3].startsWith('SSSS'));
 assert(command,'PHYSICAL_STRING_SHARE_FAULT_REACHABILITY');command[3]='X'+command[3].slice(1);
 await assert.rejects(()=>store.readProject(project.job.JOB_ID),error=>error.code==='PROJECT_HASH_MISMATCH');
 assert.equal(r.rows.get('projects').has(project.job.JOB_ID),false);
 assert((await store.listQuarantinedProjects()).some(entry=>entry.jobId===project.job.JOB_ID));
 return {thresholdOnlyInstrumentation:true,packed:true,exactReread:true,cases:[{id:'public-packed-reread',outcome:'PASS'},{id:'stale-write-keeps-all-rows',outcome:'PASS'},{id:'changed-part-refused-and-quarantined',outcome:'PASS',error:'PROJECT_HASH_MISMATCH'}]};
}
