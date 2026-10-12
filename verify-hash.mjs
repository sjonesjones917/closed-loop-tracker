import {verifyCompleteRecordCarrierShapes} from './test-complete-record-carrier-shapes.mjs';
import {verifyCanonicalPrefixSuppliers} from './test-canonical-prefix-supplier.mjs';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
export function verifyCanonicalDigestScopeControls(source=fs.readFileSync('hash.js','utf8')){
 const strict=(ok,name)=>assert(ok,'IMPORT_DIGEST_SCOPE_ORACLE '+name),cases=[],note=name=>cases.push({name,passed:true});
 const digest=text=>createHash('sha256').update(text,'utf8').digest('hex');
 const Encoder=class extends TextEncoder{encode(value){return super.encode(value);}};
 const context=createVerifierRuntime({TextEncoder:Encoder,TextDecoder,Uint8Array,Uint32Array,ArrayBuffer,DataView,Blob});vm.runInContext(source,context);
 const run=code=>vm.runInContext(code,context),reject=(code,pattern)=>{let caught=false;try{run(code);}catch(error){caught=pattern.test(error.message);}strict(caught,code);};
 run(`var hash=closedLoopHash,root={a:[null,true,7,'é🙂'],z:'x'},scope=hash.createCanonicalDigestScope(root);`);
 const expected=digest('{"a":[null,true,7,"é🙂"],"z":"x"}');strict(run('!!scope'),'data-only owned scope');
 strict(run('hash.withCanonicalDigestScope(scope,()=>hash.sha256Value(root))')===expected,'cold exact Unicode preimage');note('cold-exact-unicode');
 strict(run('hash.withCanonicalDigestScope(scope,()=>hash.sha256Value(JSON.parse(JSON.stringify(root))))')===expected,'fresh-container exact reuse');strict(run('hash.canonicalDigestScopeStats(scope).hits')===1,'actual hash reuse');note('fresh-container-exact-reuse');
 for(const [name,mutation,text]of [
  ['same-length-tamper',"root.a[3]='e🙂';",'{"a":[null,true,7,"e🙂"],"z":"x"}'],
  ['ordered-array-change',"root.a[3]='é🙂';root.a.reverse();",'{"a":["é🙂",7,true,null],"z":"x"}'],
  ['omission-versus-null',"root.a.reverse();root.extra=null;",'{"a":[null,true,7,"é🙂"],"extra":null,"z":"x"}'],
  ['wrong-identity',"delete root.extra;root.id='OTHER';",'{"a":[null,true,7,"é🙂"],"id":"OTHER","z":"x"}'],
  ['changed-revision',"delete root.id;root.revision=1;",'{"a":[null,true,7,"é🙂"],"revision":1,"z":"x"}']
 ]){run(mutation);strict(run('hash.withCanonicalDigestScope(scope,()=>hash.sha256Value(root))')===digest(text),name);strict(run('hash.canonicalDigestScopeStats(scope).hits')===1,name+' must not borrow prior digest');note(name);}
 run('delete root.revision;');
 const every=run('Array.prototype.every'),encoder=Encoder.prototype.encode;
 try{run('Array.prototype.every=function(){return true;};');Encoder.prototype.encode=function(value){const bytes=new TextEncoder().encode(value);if(bytes.length)bytes[0]^=1;return bytes;};const cold=run('hash.sha256Value(root)');strict(cold!==expected,'encoder mutation reached');strict(run('hash.withCanonicalDigestScope(scope,()=>hash.sha256Value(root))')===cold,'guard cannot trust mutable every');strict(run('hash.canonicalDigestScopeStats(scope).hits')===1,'guard mutation bypass');}
 finally{context.savedEvery=every;run('Array.prototype.every=savedEvery;');Encoder.prototype.encode=encoder;}note('guard-helper-and-encoder-change');
 const prototype=run('hash.canonicalChunks.prototype');
 try{run(`hash.canonicalChunks.prototype=Object.create(hash.canonicalChunks.prototype,{[Symbol.iterator]:{value:function*(){yield 'changed chunks';}}});`);const cold=run('hash.sha256Value(root)');strict(cold!==expected,'generator mutation reached');strict(run('hash.withCanonicalDigestScope(scope,()=>hash.sha256Value(root))')===cold,'generator own prototype fallback');}
 finally{context.savedPrototype=prototype;run('hash.canonicalChunks.prototype=savedPrototype;');}note('generator-own-prototype-change');
 const weakGet=run('WeakMap.prototype.get');try{run('WeakMap.prototype.get=function(){return undefined;};');strict(run('hash.withCanonicalDigestScope(scope,()=>hash.sha256Value(root))')===expected,'bootstrap-private lookup and current fallback');}finally{context.savedWeakGet=weakGet;run('WeakMap.prototype.get=savedWeakGet;');}note('private-lookup-primitive-change');
 run("root.a[3]='\\ud800';");reject('hash.withCanonicalDigestScope(scope,()=>hash.sha256Value(root))',/unpaired UTF-16 high surrogate/);run("root.a[3]='é🙂';");note('changed-malformed-unicode-rejects');
 reject('hash.withCanonicalDigestScope(scope,()=>Promise.resolve(1))',/synchronous/);strict(run('hash.sha256Value(root)')===expected,'no ambient scope across async');note('async-context-restored');
 reject('hash.withCanonicalDigestScope(scope,()=>{throw Error("INTENDED");})',/INTENDED/);strict(run('hash.sha256Value(root)')===expected,'no ambient scope after failure');note('failure-context-restored');
 for(const [name,value]of [['undefined','undefined'],['unsafe-number','Number.MAX_SAFE_INTEGER+1'],['negative-zero','-0'],['sparse-array','[,,]'],['extra-array-property','Object.assign([], {foreign:true})'],['accessor','({get x(){throw Error("GETTER_MUST_NOT_RUN");}})']]){strict(run('hash.createCanonicalDigestScope('+value+')')===null,'unsupported-'+name);note('unsupported-'+name);}
 strict(run('hash.createCanonicalDigestScope(Array.from({length:50001},()=>({})))')===null,'node budget');note('node-budget-cold-route');
 strict(run('hash.createCanonicalDigestScope(new Array(200001).fill(null))')===null,'edge budget');note('edge-budget-cold-route');
 strict(run("hash.createCanonicalDigestScope(new Array(131073).fill('x'.repeat(4096)))")===null,'aggregate string budget');note('string-budget-cold-route');
 run('hash.disposeCanonicalDigestScope(scope);');strict(run('hash.canonicalDigestScopeMatches(scope,root)')===false,'disposed scope matches nothing');strict(run('hash.withCanonicalDigestScope(scope,()=>hash.sha256Value(root))')===expected,'disposed scope ordinary cold');note('disposed-scope-cold-route');
 return {passed:true,cases,synthetic:true,actualBrowser:false,boundary:'Exact pure canonical preimages and optional bounded import digest scopes in isolated runtime; no cached semantic result, native storage, whole import, deadline or release claim.'};
}

// Section34 distinguishes content identity from complete-record identity.
// These exact preimages are independent literals, not production projections.
export function verifyRecordHashDistinctionControls(source=fs.readFileSync('hash.js','utf8'),{detectCounterexamples=true}={}){
 const context=createVerifierRuntime({TextEncoder,TextDecoder,Uint8Array,Uint32Array,ArrayBuffer,DataView,Blob});vm.runInContext(source,context,{filename:'hash.js:record-distinction'});
 const run=code=>vm.runInContext(code,context),digest=text=>createHash('sha256').update(text,'utf8').digest('hex'),cases=[];
 run(`var hash=closedLoopHash,base={active:true,fields:{REQ_ID:'REQ-1',OBLIGATION:'must hold',STATUS:'CURRENT',VERSION:'V1',CREATED_AT:'device-a',UPDATED_AT:'device-b'},relationships:{SOURCE_ID:'SOURCE-1'},evidenceRefs:['EVIDENCE-1'],scope:{inputVersion:'INPUT-v001'},recordSha256:'ignored',sha256:'ignored'};`);
 const contentText='{"evidenceRefs":["EVIDENCE-1"],"fields":{"OBLIGATION":"must hold"},"relationships":{"SOURCE_ID":"SOURCE-1"}}';
 const recordText='{"active":true,"evidenceRefs":["EVIDENCE-1"],"fields":{"CREATED_AT":"device-a","OBLIGATION":"must hold","REQ_ID":"REQ-1","STATUS":"CURRENT","UPDATED_AT":"device-b","VERSION":"V1"},"relationships":{"SOURCE_ID":"SOURCE-1"},"scope":{"inputVersion":"INPUT-v001"}}';
 const observe=(name,expression,expectedContentText,expectedRecordText)=>{
  const observed=run(`(()=>{const record=${expression};return {content:hash.contentRecordSha256(record,'REQ_ID'),complete:hash.recordSha256(record)};})()`),expected={content:digest(expectedContentText),complete:digest(expectedRecordText)};
  assert(observed.content===expected.content,'RECORD_HASH_DISTINCTION_CONTENT_ORACLE: '+name);
  assert(observed.complete===expected.complete,'RECORD_HASH_DISTINCTION_COMPLETE_ORACLE: '+name);
  assert(observed.content!==observed.complete,'RECORD_HASH_DISTINCTION_SEPARATE_ORACLE: '+name);
  cases.push({name,expected,observed:{content:observed.content,complete:observed.complete},passed:true});return observed;
 };
 const original=observe('independent-content-and-complete-literals','base',contentText,recordText);
 for(const [field,from,to]of [['REQ_ID','REQ-1','REQ-2'],['STATUS','CURRENT','SUPERSEDED'],['VERSION','V1','V2'],['CREATED_AT','device-a','other-a'],['UPDATED_AT','device-b','other-b']]){
  const changed=observe('identity-or-lifecycle-'+field,`({...base,fields:{...base.fields,${field}:${JSON.stringify(to)}}})`,contentText,recordText.replace(JSON.stringify(field)+':'+JSON.stringify(from),JSON.stringify(field)+':'+JSON.stringify(to)));
  assert(changed.content===original.content&&changed.complete!==original.complete,'RECORD_HASH_DISTINCTION_METADATA_ORACLE: '+field);
 }
 const changed=observe('substantive-change-affects-both',"({...base,fields:{...base.fields,OBLIGATION:'different'}})",contentText.replace('must hold','different'),recordText.replace('must hold','different'));
 assert(changed.content!==original.content&&changed.complete!==original.complete,'RECORD_HASH_DISTINCTION_SUBSTANTIVE_ORACLE');
 observe('registered-self-digest-omissions',"({...base,recordSha256:'changed',sha256:'changed'})",contentText,recordText);
 observe('restored-independent-literals','base',contentText,recordText);
 const negativeControls=[];
 if(detectCounterexamples){
  const anchor="function recordSha256(record){return hashRegistered('CANONICAL_RECORD',record||{});}";
  assert(source.split(anchor).length-1===1,'RECORD_HASH_DISTINCTION_COUNTEREXAMPLE_ANCHOR_ORACLE');
  for(const [name,replacement,oracle]of [
   ['complete-record-collapsed-to-content',"function recordSha256(record){return contentRecordSha256(record,'REQ_ID');}",'RECORD_HASH_DISTINCTION_COMPLETE_ORACLE: independent-content-and-complete-literals'],
   ['changed-record-id-omitted-from-complete-identity',"function recordSha256(record){const input=record?.fields?.REQ_ID==='REQ-2'?{...record,fields:{...record.fields,REQ_ID:'REQ-1'}}:record;return hashRegistered('CANONICAL_RECORD',input||{});}",'RECORD_HASH_DISTINCTION_COMPLETE_ORACLE: identity-or-lifecycle-REQ_ID']
  ]){
   let message=null;try{verifyRecordHashDistinctionControls(source.replace(anchor,replacement),{detectCounterexamples:false});}catch(error){message=error.message;}
   assert(message?.includes(oracle),'RECORD_HASH_DISTINCTION_COUNTEREXAMPLE_ORACLE: '+name);
   negativeControls.push({name,oracle,detected:true});
  }
 }
 return {checkId:'hash.content-complete-record-distinction',passed:true,cases,caseCount:9,negativeControls,negativeCaseCount:negativeControls.length,synthetic:true,actualBrowser:false,scopeLimit:'Independent literal registered REQ_ID content and complete-record helper preimages, ID/lifecycle-only changes, substantive changes and self-digest omissions. No family-wide writer, storage transaction, migration, real operator or current eligible receipt claim.'};
}

// Source-derived Section38 ID literals, not the production family registry.
const primitiveContentIdFields=["SOURCE_ID", "CONFLICT_ID", "RESEARCH_ID", "CANDIDATE_REQ_ID", "REQ_ID", "RESOLUTION_ID", "TEST_ID", "MUTATION_ID", "INSTRUCTION_ID", "REVIEW_ID", "ITERATION_ID", "CANDIDATE_ID", "RUN_ID", "VERIFICATION_ID", "COMPARISON_ID", "DEFECT_ID", "RCA_ID", "REG_ID", "CHANGESET_ID", "CONVERGENCE_ID", "CONFIRMATION_ID", "BASELINE_ID", "PRODUCT_ID", "RESULT_ID", "MEANING_REVIEW_ID", "ATTACK_ID", "INSPECTION_ID", "PROCESS_AUDIT_ID", "PRODUCT_AUDIT_ID", "GATE_REVIEW_ID", "RELEASE_ID", "IDENTITY_ID", "INVESTIGATION_ID", "CHAIN_ID", "TRACE_ID", "REG_EXEC_ID", "BLOCKER_ID", "CONTEXT_ID", "EVIDENCE_ID", "ARTIFACT_ID", "HUMAN_DECISION_ID", "SOURCE_SEARCH_CONTRACT_ID", "SEMANTIC_CHALLENGE_ID", "SEMANTIC_REVIEW_ID", "PROPOSITION_ID", "APPLICABILITY_ID", "PROOF_EXPRESSION_ID", "PROOF_OBLIGATION_ID", "OBSERVATION_ID", "ENTAILMENT_ID", "VARIANCE_CONTRACT_ID", "ENVIRONMENT_MANIFEST_ID", "CAPABILITY_ID", "MATERIALITY_REVIEW_ID", "OPERATION_RESERVATION_ID", "COMMAND_RECEIPT_ID", "BACKUP_POLICY_ID", "CHECKPOINT_ID", "DELIVERY_CANDIDATE_SET_ID", "DELIVERY_ID", "DELIVERY_ATTEMPT_ID", "DEPLOYMENT_MANIFEST_ID", "MOBILE_ACCEPTANCE_RECORD_ID"];
const primitiveContentText='{"evidenceRefs":["EVIDENCE-1"],"fields":{"zzContent":"alpha"},"relationships":{"LINK":"SOURCE-1"}}';
const primitiveContentBoundary='Production registered content/complete-record hashing for63 exact Section38 identity fields with independent literal preimages; synthetic helper records only. Two registry-only identity fields, schema-admission shapes, writers, store transactions and browser acceptance remain outside this observation.';
function primitiveCompleteText(idField,identity='IDENTITY-A',status='CURRENT',version='V1',created='device-a',updated='device-b',content='alpha'){
 const entries=[[idField,identity],['CREATED_AT',created],['STATUS',status],['UPDATED_AT',updated],['VERSION',version],['zzContent',content]];
 entries.sort(([a],[b])=>a<b?-1:a>b?1:0); // independent ASCII fixture ordering
 return '{"evidenceRefs":["EVIDENCE-1"],"fields":{'+entries.map(([key,value])=>JSON.stringify(key)+':'+JSON.stringify(value)).join(',')+'},"relationships":{"LINK":"SOURCE-1"}}';
}
function primitiveResult(checkId,boundary,cases){
 const report={checkId,boundary,synthetic:true,actualBrowser:false,cases,caseCount:cases.length,passed:cases.every(row=>row.passed)};
 const failed=cases.find(row=>!row.passed);if(failed)throw Object.assign(new Error('CANONICAL_PRIMITIVE_OBSERVATION_ORACLE: '+failed.name),{report});return report;
}
export function verifySourceFamilyRecordHashDistinction(source=fs.readFileSync('hash.js','utf8')){
 const context=createVerifierRuntime({TextEncoder,TextDecoder,Uint8Array,Uint32Array,ArrayBuffer,DataView,Blob});vm.runInContext(source,context,{filename:'hash.js:source-family-distinction'});
 const hash=context.closedLoopHash,cases=[],digest=text=>createHash('sha256').update(text,'utf8').digest('hex');
 for(const idField of primitiveContentIdFields){
  const input={fields:{[idField]:'IDENTITY-A',CREATED_AT:'device-a',UPDATED_AT:'device-b',VERSION:'V1',STATUS:'CURRENT',zzContent:'alpha'},relationships:{LINK:'SOURCE-1'},evidenceRefs:['EVIDENCE-1'],recordSha256:'ignored',sha256:'ignored'};
  const fixtures=[
   ['original',input,primitiveContentText,primitiveCompleteText(idField)],
   ['identity-change',{...input,fields:{...input.fields,[idField]:'IDENTITY-B'}},primitiveContentText,primitiveCompleteText(idField,'IDENTITY-B')],
   ['lifecycle-change',{...input,fields:{...input.fields,STATUS:'SUPERSEDED',VERSION:'V2',CREATED_AT:'other-a',UPDATED_AT:'other-b'}},primitiveContentText,primitiveCompleteText(idField,'IDENTITY-A','SUPERSEDED','V2','other-a','other-b')],
   ['substantive-change',{...input,fields:{...input.fields,zzContent:'beta'}},primitiveContentText.replace('alpha','beta'),primitiveCompleteText(idField,'IDENTITY-A','CURRENT','V1','device-a','device-b','beta')],
   ['self-digest-change',{...input,recordSha256:'changed',sha256:'changed'},primitiveContentText,primitiveCompleteText(idField)]
  ];
  for(const [name,value,contentText,completeText]of fixtures){context.input=JSON.stringify(value);const record=vm.runInContext('JSON.parse(input)',context),expected={content:digest(contentText),complete:digest(completeText)},observed={content:hash.contentRecordSha256(record,idField),complete:hash.recordSha256(record)};
   cases.push({name:idField+':'+name,idField,contentText,completeText,expected,observed,passed:observed.content===expected.content&&observed.complete===expected.complete&&observed.content!==observed.complete});
  }
 }
 return primitiveResult('canonical.source-family-content-complete-distinction',primitiveContentBoundary,cases);
}
const primitiveUtf8Literal="{\"a\":\"Aé中🙂\",\"b\":\"﻿\",\"c\":\"é\\r\\n\"}",primitiveUtf8Hex="7b2261223a2241c3a9e4b8adf09f9982222c2262223a22efbbbf222c2263223a2265cc815c725c6e227d",primitiveUtf8Sha="9277240396fb009495eed1849b020121b6d805096b14504144f7f19e0e8ac021",primitiveBomSha="4c5db4b693ac5bc7297295fd488d63ab49753410711f070533c1363fcdb6b756";
const primitiveUtf8Boundary='Production canonical text/value/registered/stream routes encode independently literal Unicode UTF8 bytes without a leading BOM; actual Node WebCrypto typed/offset/DataView and bounded Blob byte routes hash those same bytes. Interior U+FEFF is preserved. Synthetic nonbrowser primitive proof only; no storage, transport or deployment claim.';
export async function verifyCanonicalUtf8ByteObservation(source=fs.readFileSync('hash.js','utf8')){
 const encoded=[];class ObservedEncoder extends TextEncoder{encode(value){const bytes=super.encode(value);encoded.push(Buffer.from(bytes));return bytes;}}
 const context=createVerifierRuntime({TextEncoder:ObservedEncoder,TextDecoder,Uint8Array,Uint32Array,ArrayBuffer,DataView,Blob,crypto:globalThis.crypto});vm.runInContext(source,context,{filename:'hash.js:utf8-observation'});
 const hash=context.closedLoopHash;context.utf8Fixture=JSON.stringify({a:'Aé中🙂',b:'\ufeff',c:'e\u0301\r\n'});vm.runInContext('var utf8Subject=JSON.parse(utf8Fixture);',context);const cases=[],bytes=Uint8Array.from(Buffer.from(primitiveUtf8Hex,'hex'));
 const record=(name,expected,observed)=>cases.push({name,expected,observed,passed:JSON.stringify(expected)===JSON.stringify(observed)});
 record('canonical-literal',primitiveUtf8Literal,hash.stableStringify(context.utf8Subject));
 for(const [name,operation]of [['canonical-value',()=>hash.sha256Value(context.utf8Subject)],['canonical-text',()=>hash.sha256Text(primitiveUtf8Literal)],['canonical-stream',()=>hash.sha256Chunks(hash.canonicalChunks(context.utf8Subject))],['canonical-envelope',()=>hash.canonicalEnvelopeSha256(context.utf8Subject)]]){
  encoded.length=0;const digest=await operation(),hex=Buffer.concat(encoded).toString('hex');record(name,{hex:primitiveUtf8Hex,sha256:primitiveUtf8Sha},{hex,sha256:digest});
 }
 hash.registerHashPreimage('UTF8_OBSERVATION',{includePointers:['']});encoded.length=0;const registered=hash.hashRegistered('UTF8_OBSERVATION',context.utf8Subject);record('canonical-registered',{hex:primitiveUtf8Hex,sha256:primitiveUtf8Sha},{hex:Buffer.concat(encoded).toString('hex'),sha256:registered});
 const padded=new Uint8Array(bytes.length+2);padded[0]=9;padded.set(bytes,1);padded[padded.length-1]=8;
 for(const [name,input]of [['native-typed-bytes',bytes],['native-offset-bytes',padded.subarray(1,-1)],['native-offset-dataview',new DataView(padded.buffer,1,bytes.length)],['fallback-blob-bytes',new Blob([bytes])]])record(name,primitiveUtf8Sha,await hash.sha256Bytes(input));
 record('byte-stream-split-multibyte',primitiveUtf8Sha,await hash.sha256Chunks(Array.from(bytes,byte=>new Uint8Array([byte]))));
 const bom=new Uint8Array(bytes.length+3);bom.set([239,187,191]);bom.set(bytes,3);record('explicit-leading-bom-byte-contrast',primitiveBomSha,await hash.sha256Bytes(bom));
 return primitiveResult('canonical.utf8-no-bom-byte-routes',primitiveUtf8Boundary,cases);
}

// §34.1: cache refusal is not rejection; canonical APIs own admission of data.
export async function verifyCanonicalArrayImplementationControls(source=fs.readFileSync('hash.js','utf8'),{detectCounterexamples=true}={}){
 const strict=(ok,name)=>assert(ok,'CANONICAL_ARRAY_IMPLEMENTATION_ORACLE: '+name),context=createVerifierRuntime({TextEncoder,TextDecoder,Uint8Array,Uint32Array,ArrayBuffer,DataView,Blob});vm.runInContext(source,context,{filename:'hash.js:array-implementation'});
 const h=context.closedLoopHash,run=code=>vm.runInContext(code,context),digest=text=>createHash('sha256').update(text,'utf8').digest('hex'),cases=[];
 context.foreignArray=vm.runInNewContext('[1,null,"é🙂"]');context.foreignSubclass=vm.runInNewContext('new (class Implementation extends Array {})(1,null,"é🙂")');context.foreignArrayPrototype=vm.runInNewContext('Array.prototype');
 for(const [name,expression,text]of [['ordinary-dense-array','[1,null,"é🙂"]','[1,null,"é🙂"]'],['empty-array','[]','[]'],['foreign-native-array','foreignArray','[1,null,"é🙂"]'],['null-prototype-array','Object.setPrototypeOf([1,null,"é🙂"],null)','[1,null,"é🙂"]'],['null-prototype-object','Object.assign(Object.create(null),{a:[1,null,"é🙂"]})','{"a":[1,null,"é🙂"]}'],['frozen-array','Object.freeze([1,null,"é🙂"])','[1,null,"é🙂"]'],['shared-acyclic-arrays','(()=>{const leaf=[1,null,"é🙂"];return [leaf,leaf];})()','[[1,null,"é🙂"],[1,null,"é🙂"]]']]){
  const value=run(expression),expected=digest(text);strict(h.stableStringify(value)===text,'VALID_TEXT: '+name);strict(h.sha256Value(value)===expected,'VALID_DIGEST: '+name);strict(await h.sha256Chunks(h.canonicalChunks(value))===expected,'VALID_STREAM_DIGEST: '+name);strict(h.withCanonicalDigestScope(h.createCanonicalDigestScope(value),()=>h.sha256Value(value))===expected,'VALID_SCOPE_OR_COLD: '+name);cases.push({name,kind:'VALID_CONTROL',text,expectedSha256:expected,passed:true});
 }
 function reject(name,operation,pattern=/nonstandard array prototype/){let error;try{operation();}catch(caught){error=caught;}strict(error?.name==='TypeError'&&pattern.test(error.message),'REJECTION: '+name);}
 const invalid=[['subclass-empty','new (class Implementation extends Array {})()'],['subclass-dense','new (class Implementation extends Array {})(1,null,"é🙂")'],['foreign-subclass','foreignSubclass'],['custom-object-prototype','Object.setPrototypeOf([1,null,"é🙂"],{implementationMethod(){}})'],['inherited-array-prototype-object','Object.setPrototypeOf([1],Object.create(Array.prototype))'],['array-instance-as-prototype','Object.setPrototypeOf([1],[])'],['forged-native-constructor-prototype','(()=>{const prototype=[];Object.setPrototypeOf(prototype,Object.prototype);Object.defineProperty(prototype,"constructor",{value:Array});return Object.setPrototypeOf([1],prototype);})()'],['forged-user-array-constructor','(()=>{const prototype=[];Object.setPrototypeOf(prototype,Object.prototype);const constructor=function Array(){throw Error("MUST_NOT_CALL");};Object.defineProperty(constructor,"prototype",{value:prototype,writable:false});Object.defineProperty(prototype,"constructor",{value:constructor});return Object.setPrototypeOf([1],prototype);})()'],['local-array-prototype-object','Array.prototype'],['foreign-array-prototype-object','foreignArrayPrototype'],['nested-subclass','({a:new (class Implementation extends Array {})(1)})']];
 for(const [name,expression]of invalid){const value=run(expression),pattern=['local-array-prototype-object','foreign-array-prototype-object'].includes(name)?/symbol-keyed properties/:/nonstandard array prototype/;reject(name+':text',()=>h.stableStringify(value),pattern);reject(name+':digest',()=>h.sha256Value(value),pattern);reject(name+':chunks',()=>Array.from(h.canonicalChunks(value)),pattern);strict(h.createCanonicalDigestScope(value)===null,'CACHE_IS_NOT_ADMISSION: '+name);reject(name+':scope-fallback',()=>h.withCanonicalDigestScope(null,()=>h.sha256Value(value)),pattern);let error;try{await h.sha256Chunks(h.canonicalChunks(value));}catch(caught){error=caught;}strict(error?.name==='TypeError'&&pattern.test(error.message),'STREAM_REJECTION: '+name);cases.push({name,kind:'IMPLEMENTATION_REJECTION',errorName:'TypeError',routes:['stableStringify','sha256Value','canonicalChunks','sha256Chunks','scope-cold-fallback'],passed:true});}
 run('var getterCalls=0,accessorPrototype=[];Object.setPrototypeOf(accessorPrototype,Object.prototype);Object.defineProperty(accessorPrototype,"constructor",{get(){getterCalls++;throw Error("GETTER_MUST_NOT_RUN");}});var accessorArray=Object.setPrototypeOf([1],accessorPrototype);');reject('constructor-accessor',()=>h.sha256Value(context.accessorArray));strict(run('getterCalls')===0,'CONSTRUCTOR_GETTER_NOT_INVOKED');cases.push({name:'prototype-constructor-getter-not-invoked',kind:'IMPLEMENTATION_REJECTION',getterCalls:0,passed:true});
 run('var warm=[1,null,"é🙂"],scope=closedLoopHash.createCanonicalDigestScope(warm);');const expected=digest('[1,null,"é🙂"]');strict(run('closedLoopHash.withCanonicalDigestScope(scope,()=>closedLoopHash.sha256Value(warm))')===expected,'WARM_INITIAL');strict(run('closedLoopHash.withCanonicalDigestScope(scope,()=>closedLoopHash.sha256Value(warm))')===expected,'WARM_HIT');const hits=run('closedLoopHash.canonicalDigestScopeStats(scope).hits');strict(hits===1,'ACTUAL_CACHE_HIT');
 run('Object.setPrototypeOf(warm,(class Implementation extends Array {}).prototype);');reject('warm-prototype-mutation',()=>run('closedLoopHash.withCanonicalDigestScope(scope,()=>closedLoopHash.sha256Value(warm))'));strict(run('closedLoopHash.canonicalDigestScopeStats(scope).hits')===hits,'INVALID_PROTOTYPE_CANNOT_BORROW_DIGEST');run('Object.setPrototypeOf(warm,Array.prototype);');strict(run('closedLoopHash.withCanonicalDigestScope(scope,()=>closedLoopHash.sha256Value(warm))')===expected,'PROTOTYPE_RESTORED_CONTROL');cases.push({name:'warm-prototype-mutation-reject-and-restore',kind:'CACHE_GUARD',passed:true});
 run('warm[0]=2;');strict(run('closedLoopHash.withCanonicalDigestScope(scope,()=>closedLoopHash.sha256Value(warm))')===digest('[2,null,"é🙂"]'),'SAME_LENGTH_VALUE_TAMPER_COLD');run('warm[0]=1;');strict(run('closedLoopHash.withCanonicalDigestScope(scope,()=>closedLoopHash.sha256Value(warm))')===expected,'VALUE_RESTORED_CONTROL');cases.push({name:'warm-value-tamper-cold-and-restore',kind:'CACHE_GUARD',passed:true});
 const every=run('Array.prototype.every');try{run('Array.prototype.every=()=>true;');strict(run('closedLoopHash.withCanonicalDigestScope(scope,()=>closedLoopHash.sha256Value(warm))')===expected,'MUTABLE_HELPER_COLD_CONTROL');}finally{context.savedEvery=every;run('Array.prototype.every=savedEvery;');}cases.push({name:'mutable-helper-epoch-cold-control',kind:'CACHE_GUARD',passed:true});
 const raw=new Uint8Array([239,187,191,195,169,13,10,240,159,153,130]);strict(await h.sha256Bytes(raw)===createHash('sha256').update(raw).digest('hex'),'RAW_BYTES_UNCHANGED');cases.push({name:'raw-utf8-bom-and-line-bytes-unchanged',kind:'RAW_BYTE_CONTROL',passed:true});
 const faults=[];if(detectCounterexamples){const anchor='          if(!canonicalDataArrayPrototype(input))throw new TypeError(`Cannot canonically hash nonstandard array prototype at ${path}.`);';strict(source.split(anchor).length===2,'EXACT_FAULT_ANCHOR');let error;try{await verifyCanonicalArrayImplementationControls(source.replace(anchor,''),{detectCounterexamples:false});}catch(caught){error=caught;}strict(error?.message.includes('CANONICAL_ARRAY_IMPLEMENTATION_ORACLE: REJECTION: subclass-empty:text'),'INTENDED_REMOVED_GUARD_COUNTEREXAMPLE');faults.push({name:'array-prototype-guard-removed',oracle:'CANONICAL_ARRAY_IMPLEMENTATION_ORACLE: REJECTION: subclass-empty:text',detected:true});}
 return {checkId:'canonical.array-implementation-objects',passed:true,cases,faults,caseCount:cases.length,synthetic:true,actualBrowser:false,fullNormalProducerClaimed:false,scopeLimit:'Actual canonical APIs reject observable implementation/custom array prototypes with native foreign/null-prototype data and memo fallback guards. Same-engine foreign native prototype recognition; no general Proxy detection, arbitrary foreign plain-object support, store/browser or full-clause claim.'};
}

createVerifierRuntime.loadScript(globalThis,fs.readFileSync('hash.js','utf8'),{filename:'hash.js'});
const h=globalThis.closedLoopHash;
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const canonicalRejections=[],verificationObservations=[];
const reject=(name,make)=>{let ok=false;try{h.stableStringify(make());}catch(e){ok=e instanceof TypeError;}assert(ok,`${name} must be rejected.`);canonicalRejections.push(name);};
// A single accumulated response must not be scanned in full before the first
// bounded canonical chunk can reach the cooperative hashing/export consumer.
{
  const text='history '.repeat(250000)+'é🙂 EXACT-TAIL',original=String.prototype.charCodeAt;let inspected=0;
  String.prototype.charCodeAt=function(index){if(this.length>65536)inspected++;return original.call(this,index);};
  try{const stream=h.canonicalChunks({raw:text});assert(!stream.next().done,'Canonical response stream was empty.');stream.return();}
  finally{String.prototype.charCodeAt=original;}
  assert(inspected<=65536,`The first canonical chunk scanned ${inspected} code units of an accumulated response before yielding.`);
}
assert(h.sha256Text('')==='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855','empty SHA-256 vector failed');
assert(h.sha256Text('abc')==='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad','abc SHA-256 vector failed');
// The package compressor and digest consume the same already-encoded bytes.
// Byte chunks may split a UTF-8 scalar or use a non-zero buffer offset.
{
  const bytes=new TextEncoder().encode('é🙂\\\"\n'.repeat(12000)+'EXACT-BYTE-TAIL');
  for(const step of [1,63,65535]){
    async function* source(){yield 'prefix:';for(let offset=0;offset<bytes.length;offset+=step)yield bytes.subarray(offset,offset+step);yield new Uint8Array(0);yield ':suffix';}
    const expected=createHash('sha256').update('prefix:').update(bytes).update(':suffix').digest('hex');
    assert(await h.sha256Chunks(source())===expected,`Encoded package chunks changed the native SHA-256 preimage at ${step}.`);
  }
  const foreign=createVerifierRuntime.loadScript(createVerifierRuntime(),'new Uint8Array([9,195,169,240,159,153,130,8]).subarray(1,7)');
  assert(await h.sha256Chunks([foreign])===createHash('sha256').update(Buffer.from(foreign)).digest('hex'),'A byte chunk from another realm was coerced into text.');
  const view=new DataView(foreign.buffer,foreign.byteOffset,foreign.byteLength);
  assert(await h.sha256Chunks([view])===createHash('sha256').update(Buffer.from(foreign)).digest('hex'),'A byte view changed its buffer offset or length.');
}
// Project integrity must not allocate a full UTF-8 copy of accumulated history.
const NativeEncoder=globalThis.TextEncoder;let largestEncoding=0;
globalThis.TextEncoder=class extends NativeEncoder{encode(text){largestEncoding=Math.max(largestEncoding,String(text).length);return super.encode(text);}};
try{
  for(const size of [0,1,55,56,63,64,65,32767,32768,65535,65536,1000000]){
    const value='é🙂\\\"\n'.repeat(Math.ceil(size/7)).slice(0,size)+'tail';
    assert(h.sha256Text(value)===createHash('sha256').update(value).digest('hex'),`Streaming SHA-256 differs from node:crypto at ${size}.`);
  }
  const accumulated={history:Array.from({length:64},(_,index)=>({index,text:'é🙂'.repeat(10000)}))};
  const expected=createHash('sha256').update(h.stableStringify(accumulated)).digest('hex');
  assert(h.sha256Value(accumulated)===expected,'Accumulated project canonical digest changed.');
  assert(largestEncoding<=65536,`Canonical hashing encoded ${largestEncoding} characters at once; accumulated-data working buffers must be bounded.`);
}finally{globalThis.TextEncoder=NativeEncoder;}
// Canonical metadata contains many tiny punctuation/key chunks. Hash them in
// bounded batches instead of allocating a UTF-8 buffer for every fragment.
let encoderCalls=0,encoderInstances=0;
globalThis.TextEncoder=class extends NativeEncoder{constructor(){super();encoderInstances++;}encode(text){encoderCalls++;return super.encode(text);}};
try{
  const metadata=Array.from({length:100},(_,index)=>({index,filename:`file-${index}-é🙂`,scope:{stage:1,active:true},bytes:65537}));
  const canonical=h.stableStringify(metadata),expected=createHash('sha256').update(canonical).digest('hex');
  assert(h.sha256Value(metadata)===expected,'Batched metadata hash changed the exact preimage.');
  assert(encoderInstances<=1&&encoderCalls<=Math.ceil(canonical.length/8192)+1,`Metadata hashing allocated ${encoderInstances} encoders / ${encoderCalls} buffers for ${canonical.length} characters.`);
  encoderCalls=0;encoderInstances=0;
  assert(await h.sha256Chunks(h.canonicalChunks(metadata))===expected,'Asynchronous metadata hash changed the exact preimage.');
  assert(encoderCalls<=Math.ceil(canonical.length/8192)+1,`Asynchronous canonical hashing allocated ${encoderCalls} UTF-8 buffers for ${canonical.length} characters.`);
}finally{globalThis.TextEncoder=NativeEncoder;}
// Check the canonical bytes independently of the chunk generator. Object keys
// here are already ordered; escaped text and Unicode straddle batch boundaries.
for(const size of [16383,16384,16385]){
  const value={a:'x'.repeat(size)+'é🙂',b:['\\\"\n'.repeat(10000),true,null,0],z:'EXACT-TAIL'};
  const expected=JSON.stringify(value),digest=createHash('sha256').update(expected).digest('hex');
  assert([...h.canonicalChunks(value)].join('')===expected,`Canonical batching changed bytes at ${size}.`);
  assert(await h.sha256Chunks(h.canonicalChunks(value))===digest,`Canonical streaming digest changed at ${size}.`);
  async function* asynchronousSource(){yield* h.canonicalChunks(value);}
  assert(await h.sha256Chunks(asynchronousSource())===digest,`Asynchronous package source digest changed at ${size}.`);
}
// The fallback and native validation routes must both reject a malformed tail
// after earlier chunks were consumed, including split surrogate boundaries.
{
  const native=String.prototype.isWellFormed;
  try{for(const fallback of [false,true]){
    if(fallback)String.prototype.isWellFormed=undefined;
    for(const size of [16383,16384,16385,131072]){
      const valid='x'.repeat(size)+'🙂é';assert(h.sha256Value(valid)===createHash('sha256').update(JSON.stringify(valid)).digest('hex'),'Chunk scalar validation changed exact Unicode bytes.');
      for(const tail of ['\uD800','\uDC00']){let rejected=false;try{await h.sha256Chunks(h.canonicalChunks(valid+tail));}catch(error){rejected=error instanceof TypeError;}assert(rejected,'An invalid accumulated-text tail produced a successful canonical digest.');}
    }
  }}finally{if(native===undefined)delete String.prototype.isWellFormed;else String.prototype.isWellFormed=native;}
}
{
  const shared={a:'é🙂',b:[null,true,17]},value={a:Array.from({length:300},()=>({a:shared,b:{a:[],b:{},c:'\\\"\n'.repeat(25)}})),b:shared};
  const expected=JSON.stringify(value);assert([...h.canonicalChunks(value)].join('')===expected,'Canonical traversal changed nested, shared, empty or escaped values.');
  assert(await h.sha256Chunks(h.canonicalChunks(value))===createHash('sha256').update(expected).digest('hex'),'Nested canonical traversal changed the independent digest.');
  const cycle={a:shared};cycle.b={a:cycle};reject('nested repeated reference cycle',()=>cycle);
}
// A file is not a small in-memory buffer. Every file hash must read bounded
// slices, including a tail that is not aligned with a SHA-256 block.
const originalBlobRead=Blob.prototype.arrayBuffer;
let largestBlobRead=0;
try{
  Blob.prototype.arrayBuffer=function(){largestBlobRead=Math.max(largestBlobRead,this.size);return originalBlobRead.call(this);};
  for(const size of [0,1,55,56,63,64,65,65535,65536,65537,2097153]){
    const bytes=Uint8Array.from({length:size},(_,i)=>(i*137+19)%256);
    assert(await h.sha256Bytes(new Blob([bytes]))===createHash('sha256').update(bytes).digest('hex'),`File SHA-256 differs at ${size} bytes.`);
  }
  assert(largestBlobRead<=65536,`File hashing read ${largestBlobRead} bytes at once; accumulated artifacts must use bounded reads.`);
}finally{Blob.prototype.arrayBuffer=originalBlobRead;}
assert(h.canonicalizationVersion==='closed-loop-canonical-json/1','canonicalization version is not controlling /1');
assert(h.idVersion==='closed-loop-id/1','canonical ID version is not controlling /1');
assert(h.stableStringify({b:1,a:2})===h.stableStringify({a:2,b:1}),'object key ordering is not canonical');
assert(h.stableStringify({'2':'two','10':'ten',a:'aye'})==='{"10":"ten","2":"two","a":"aye"}','Integer-like object keys are not serialized in unsigned Unicode scalar order.');
const bmp='\uE000',astral='\u{10000}';
assert(h.stableStringify({[bmp]:1,[astral]:2})===`{"${bmp}":1,"${astral}":2}`,'object keys are not sorted by unsigned Unicode scalar value');
assert(h.stableStringify({x:Number.MAX_SAFE_INTEGER})===`{"x":${Number.MAX_SAFE_INTEGER}}`,'maximum safe integer was not preserved exactly');
assert(h.stableStringify({x:Number.MIN_SAFE_INTEGER})===`{"x":${Number.MIN_SAFE_INTEGER}}`,'minimum safe integer was not preserved exactly');
for(const [name,make] of [
 ['Infinity',()=>({x:Infinity})],['NaN',()=>({x:NaN})],['negative Infinity',()=>({x:-Infinity})],['negative zero',()=>({x:-0})],['fraction',()=>({x:1.25})],['unsafe positive integer',()=>({x:Number.MAX_SAFE_INTEGER+1})],['unsafe negative integer',()=>({x:Number.MIN_SAFE_INTEGER-1})],['unpaired high surrogate',()=>({x:'\uD800'})],['unpaired low surrogate',()=>({x:'\uDC00'})],['unpaired surrogate key',()=>({['\uD800']:1})],['undefined member',()=>({x:undefined})],['undefined array member',()=>[undefined]],['undefined root',()=>undefined],['bigint',()=>({x:1n})],['function',()=>({x(){}})],['symbol value',()=>({x:Symbol('x')})],['symbol key',()=>{const x={};x[Symbol('x')]=1;return x;}],['Date',()=>new Date(0)],['Map',()=>new Map([['x',1]])],['Set',()=>new Set([1])],['sparse array',()=>{const x=[];x.length=1;return x;}],['array property',()=>{const x=[1];x.extra=2;return x;}],['accessor',()=>{const x={};Object.defineProperty(x,'a',{enumerable:true,get(){return 1;}});return x;}],['cycle',()=>{const x={};x.self=x;return x;}]
])reject(name,make);

// Exact §34.1 serialization observations. Expected text is declared from the
// source contract, never obtained from another production serialization path.
const canonicalObservation=(checkId,line,expected,observed)=>{assert(JSON.stringify(observed)===JSON.stringify(expected),'CANONICAL_CONTRACT_ORACLE: '+checkId);verificationObservations.push({checkId,requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:'+line],boundary:'Production canonical serializer; independent literal expected text and explicit rejection controls',expected,observed,passed:true});};
const exactNumberContext=createVerifierRuntime({Event:class Event{},dispatchEvent(){}});for(const owner of ['workbook.js','hash.js','workflow-schema.js'])createVerifierRuntime.loadScript(exactNumberContext,fs.readFileSync(owner,'utf8'),{filename:owner});
const numberContract=exactNumberContext.closedLoopWorkflowSchema,exactDecimal=numberContract.canonicalDecimal('0.1'),exactLargeInteger=numberContract.canonicalDecimal('9007199254740992');
assert(exactDecimal==='rational:1/10'&&exactLargeInteger==='rational:9007199254740992/1','CANONICAL_REGISTERED_EXACT_NUMBER_ORACLE');assert(numberContract.isCanonicalNumber(exactDecimal)&&numberContract.isCanonicalNumber(exactLargeInteger),'CANONICAL_REGISTERED_EXACT_NUMBER_TYPE_ORACLE');assert(!numberContract.isCanonicalNumber('rational:2/20'),'CANONICAL_UNREDUCED_NUMBER_ORACLE');
canonicalObservation('canonical.safe-integer-and-typed-string',3023,
 {text:'{"decimal":"rational:1/10","large":"rational:9007199254740992/1","max":9007199254740991,"min":-9007199254740991}',unsafeRejected:true,registeredTypedStrings:true},
 {text:h.stableStringify({min:Number.MIN_SAFE_INTEGER,max:Number.MAX_SAFE_INTEGER,decimal:exactDecimal,large:exactLargeInteger}),unsafeRejected:['fraction','unsafe positive integer','unsafe negative integer'].every(name=>canonicalRejections.includes(name)),registeredTypedStrings:numberContract.isCanonicalNumber(exactDecimal)&&numberContract.isCanonicalNumber(exactLargeInteger)});
canonicalObservation('canonical.unsigned-scalar-key-order',3024,
 '{"10":"ten","2":"two","a":"aye","":"bmp","𐀀":"astral"}',
 h.stableStringify({'𐀀':'astral','':'bmp',a:'aye','2':'two','10':'ten'}));
canonicalObservation('canonical.ordered-arrays',3025,
 ['["b","a","b"]','["a","b","b"]'],[h.stableStringify(['b','a','b']),h.stableStringify(['a','b','b'])]);
canonicalObservation('canonical.exact-string-scalars-and-lines',3026,
 '"é|é|A\\r\\nB\\nC\\rD"',h.stableStringify('é|é|A\r\nB\nC\rD'));
const controlEscapes=['\\u0000','\\u0001','\\u0002','\\u0003','\\u0004','\\u0005','\\u0006','\\u0007','\\b','\\t','\\n','\\u000b','\\f','\\r','\\u000e','\\u000f','\\u0010','\\u0011','\\u0012','\\u0013','\\u0014','\\u0015','\\u0016','\\u0017','\\u0018','\\u0019','\\u001a','\\u001b','\\u001c','\\u001d','\\u001e','\\u001f'];
canonicalObservation('canonical.exact-json-escapes',3027,
 controlEscapes.map(text=>'"'+text+'"').concat(['"\\\""','"\\\\"']),
 Array.from({length:32},(_,value)=>h.stableStringify(String.fromCharCode(value))).concat([h.stableStringify('"'),h.stableStringify('\\')]));
canonicalObservation('canonical.printable-nonascii-unescaped',3028,'"é中🙂𐀀"',h.stableStringify('é中🙂𐀀'));
const prohibitedCanonicalNames=['negative zero','NaN','Infinity','negative Infinity','undefined member','undefined array member','undefined root','sparse array','cycle','Date','Map','Set','function','symbol value','symbol key','accessor'];
canonicalObservation('canonical.prohibited-values-rejected',3029,prohibitedCanonicalNames,prohibitedCanonicalNames.filter(name=>canonicalRejections.includes(name)));

let undefinedPreimageRejected=false;
try{h.hashRegistered('UNREGISTERED_KIND',{x:1});}catch(error){undefinedPreimageRejected=/UNDEFINED_HASH_PREIMAGE/.test(String(error));}
assert(undefinedPreimageRejected,'Unregistered release-bearing hash preimage must fail closed.');
h.registerHashPreimage('TEST_HASH',{includePointers:['/a','/members'],omitPointers:['/digest'],reasonByOmittedPointer:{'/digest':'Digest field is self-dependent.'}});
h.registerSetSemantics('/members',{elementIdentityKey:'id'});
const registeredA=h.hashRegistered('TEST_HASH',{a:1,members:[{id:'B',value:2},{id:'A',value:1}],digest:'ignored'});
const registeredB=h.hashRegistered('TEST_HASH',{a:1,members:[{id:'A',value:1},{id:'B',value:2}],digest:'different'});
assert(registeredA===registeredB,'Registered set semantics or omission rules are not deterministic.');
let duplicateSetRejected=false;
try{h.hashRegistered('TEST_HASH',{a:1,members:[{id:'A'},{id:'A'}],digest:''});}catch(error){duplicateSetRejected=/Duplicate set element identity/.test(String(error));}
assert(duplicateSetRejected,'Duplicate registered set identities must fail closed.');

assert(h.hashPreimageRegistry.has('CONTENT_RECORD:REQ_ID'),'Requirement content hash preimage is not explicitly registered.');
assert(h.hashPreimageRegistry.has('CANONICAL_RECORD'),'Canonical record hash preimage is not explicitly registered.');
const contentRecord={fields:{REQ_ID:'REQ-1',OBLIGATION:'must hold',STATUS:'CURRENT',VERSION:'V1',CREATED_AT:'device-a',UPDATED_AT:'device-b'},relationships:{SOURCE_ID:'SOURCE-1'},evidenceRefs:['EVIDENCE-1']};
const contentPreimage=h.contentRecordValue(contentRecord,'REQ_ID');
assert(!Object.prototype.hasOwnProperty.call(contentPreimage.fields,'REQ_ID'),'Content hash preimage did not apply the registered identity omission.');
assert(!Object.prototype.hasOwnProperty.call(contentPreimage.fields,'STATUS'),'Content hash preimage did not apply the registered lifecycle omission.');
assert(contentPreimage.fields.OBLIGATION==='must hold','Content hash preimage lost substantive canonical content.');
const contentHash=h.contentRecordSha256(contentRecord,'REQ_ID');
assert(contentHash===h.contentRecordSha256({fields:{...contentRecord.fields,REQ_ID:'REQ-2',STATUS:'SUPERSEDED',VERSION:'V2',CREATED_AT:'other',UPDATED_AT:'other'},relationships:contentRecord.relationships,evidenceRefs:contentRecord.evidenceRefs},'REQ_ID'),'Registered noncontent omissions changed content identity.');
assert(contentHash!==h.contentRecordSha256({fields:{...contentRecord.fields,OBLIGATION:'different'},relationships:contentRecord.relationships,evidenceRefs:contentRecord.evidenceRefs},'REQ_ID'),'Substantive content change did not change content identity.');
let unknownContentKindRejected=false;
try{h.contentRecordSha256({fields:{UNKNOWN_ID:'X'},relationships:{},evidenceRefs:[]},'UNKNOWN_ID');}catch(error){unknownContentKindRejected=/UNDEFINED_HASH_PREIMAGE/.test(String(error));}
assert(unknownContentKindRejected,'Unknown content-record hash kind must fail closed instead of inventing a preimage.');
const canonicalRecord={fields:{REQ_ID:'REQ-1',OBLIGATION:'must hold'},relationships:{},evidenceRefs:[],recordSha256:'old',sha256:'legacy'};
const canonicalRecordHash=h.recordSha256(canonicalRecord);
assert(canonicalRecordHash===h.recordSha256({...canonicalRecord,recordSha256:'changed',sha256:'changed'}),'Canonical record digest fields must be omitted only through the registered preimage.');
assert(canonicalRecordHash!==h.recordSha256({...canonicalRecord,fields:{...canonicalRecord.fields,OBLIGATION:'changed'}}),'Canonical record substantive change did not change record identity.');

const idInput={familyPrefix:'REQ',familyNamespace:'requirements',jobNamespace:'JOB-123',commandId:'CMD-1',targetSlot:'slot',parentId:'',allocationSequence:7,collisionCounter:0};
const idA=h.allocateCanonicalId(idInput),idB=h.allocateCanonicalId(idInput);
assert(idA.id===idB.id,'Canonical ID allocation is not stable for an identical allocation tuple.');
assert(/^REQ-[0-9a-v]{32}$/.test(idA.id),'Canonical ID must use uppercase family prefix plus 160-bit lowercase base32hex payload.');

// Reuse the retained independent §34.2 tuple and SHA/base32hex oracle at this
// normal owning verifier; no production projection supplies expected bytes.
canonicalObservation('canonical.id-literal-payload-and-sha160',3039,
 {canonical:'{"allocationSequence":7,"collisionCounter":0,"commandId":"CMD-1","familyNamespace":"requirements","idVersion":"closed-loop-id/1","jobNamespace":"JOB-123","parentId":"","targetSlot":"slot"}',digestHex:'3fc05074940067ee7dae2d5aa988c3ec900b7cc1'},
 {canonical:h.stableStringify(idA.payload),digestHex:idA.digestHex});
canonicalObservation('canonical.id-base32hex-msb-prefix-no-padding',3052,
 'REQ-7v050t4k01jusvde5ldaj263ti80mv61',idA.id);

const idChanged=h.allocateCanonicalId({...idInput,allocationSequence:8});
assert(idChanged.id!==idA.id,'Allocation sequence must participate in canonical ID identity.');
const retry=h.allocateCanonicalIdWithCollisionCheck(idInput,{exists:id=>id===idA.id?idA.payload:false});
assert(retry.id===idA.id&&retry.exactRetry===true,'Exact canonical ID retry must return the original identity.');
const collision=h.allocateCanonicalIdWithCollisionCheck(idInput,{exists:id=>id===idA.id?{different:true}:false});
assert(collision.id!==idA.id&&collision.collisionCounter===1,'Collision handling must increment collisionCounter inside the allocation contract.');

const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','test-worker.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'].filter(file=>file!=='test-worker.js');
const html=fs.readFileSync('index.html','utf8');
const scriptSources=[...html.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
assert(scriptSources.length===runtimeFiles.length,`Expected ${runtimeFiles.length} direct deferred runtime scripts; found ${scriptSources.length}.`);
let sharedBuildIdentity=null;
scriptSources.forEach((source,index)=>{
 const [file,query='']=source.split('?');
 assert(file===runtimeFiles[index],`Runtime script order mismatch at ${runtimeFiles[index]}.`);
 const token=new URLSearchParams(query).get('v');
 assert(typeof token==='string'&&token.trim(),`${file} is missing the shared runtime build identity.`);
 if(sharedBuildIdentity===null)sharedBuildIdentity=token;
 assert(token===sharedBuildIdentity,`${file} cache token ${token} differs from shared runtime identity ${sharedBuildIdentity}.`);
});
for(const owner of ['test-runtime.js','project-store.js']){const workerSourceQuery=scriptSources.find(source=>source.split('?')[0]===owner).split('?')[1];assert(new URLSearchParams(workerSourceQuery).get('workerSha256')===createHash('sha256').update(fs.readFileSync('test-worker.js')).digest('hex'),'Source HTML must bind the exact Test IR worker bytes to '+owner+' as well as the shared cache identity.');}
const testRuntime=fs.readFileSync('test-runtime.js','utf8');
assert(testRuntime.includes("if(source)url.search=new URL(source).search"),'Test IR worker URL must inherit the exact test-runtime.js build/cache query identity.');
assert(testRuntime.includes("new URL('test-worker.js',base)"),'Test IR worker must remain the same-origin registered worker entry.');
const appCore=fs.readFileSync('app-core.js','utf8');
assert(/function\s+artifactControlMarkup\s*\(\s*n\s*,\s*locked\s*\)\s*\{\s*if\s*\(\s*n\s*===\s*19\s*\)/.test(appCore),'Artifact controls must retain the established Stage 19 unchanged-candidate boundary; whitespace or formatting changes must not alter the invariant.');
assert(!/function\s+artifactControlMarkup\s*\(\s*n\s*,\s*locked\s*\)\s*\{[\s\S]{0,500}?if\s*\(\s*n\s*===\s*4\s*\)\s*return\s*['"]{2}\s*;/.test(appCore),'Stage 04 visual controls must not be hidden as a substitute for canonical intent reuse.');

const canonicalPrefixSuppliers=await verifyCanonicalPrefixSuppliers();
const completeRecordCarrierShapes=verifyCompleteRecordCarrierShapes();
const sourceFamilyRecordHashDistinction=verifySourceFamilyRecordHashDistinction();
const canonicalUtf8ByteObservation=await verifyCanonicalUtf8ByteObservation();
const canonicalArrayImplementationObjects=await verifyCanonicalArrayImplementationControls();
verificationObservations.push({checkId:canonicalArrayImplementationObjects.checkId,requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:3029'],boundary:canonicalArrayImplementationObjects.scopeLimit,expected:'Implementation/custom array prototypes rejected; dense ordinary/foreign/null-prototype data preserve literal canonical text/SHA, cold/memo and raw-byte controls',observed:canonicalArrayImplementationObjects,passed:canonicalArrayImplementationObjects.passed});
const recordHashDistinction=verifyRecordHashDistinctionControls();
const importDigestScopes=verifyCanonicalDigestScopeControls();
console.log(JSON.stringify({completeRecordCarrierShapes,canonicalArrayImplementationObjects,canonicalPrefixSuppliers,sourceFamilyRecordHashDistinction,canonicalUtf8ByteObservation,recordHashDistinction,importDigestScopes,verificationObservations,sha256Vectors:true,canonicalOrdering:true,integerLikeKeyOrdering:true,unicodeScalarOrdering:true,safeIntegerBoundaries:true,ambiguousValuesRejected:24,registeredHashPreimageFailureClosed:true,registeredSetSemantics:true,contentRecordPreimagesRegistered:true,unknownContentHashKindRejected:true,canonicalRecordPreimageRegistered:true,closedLoopIdStable:true,closedLoopIdCollisionChecked:true,sharedBuildIdentity,runtimeScriptCount:runtimeFiles.length,workerSharesBuildIdentity:true,stage04RepeatAttachmentControlAbsent:true}));
await import('./verify-stage02-primitives.mjs');
