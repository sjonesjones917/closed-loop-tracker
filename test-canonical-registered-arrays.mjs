import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createVerifierRuntime} from './verifier-runtime.mjs';

const boundary='Actual EVIDENCE_CHAIN_SET/1 schema registration and hash APIs with independent literals, ordered requirementIds, registered chainRecords and intended owning faults. Synthetic records; no scope/terminal lifecycle, browser or full-clause conformance claim.';
const setText='[{"id":"10","value":"ten"},{"id":"2","steps":["z","a","z"],"value":"two"},{"id":"","value":"bmp"},{"id":"𐀀","value":"astral"}]';
const originalText='{"chainRecords":'+setText+',"jobId":"JOB-ARRAY","requirementIds":["REQ-B","REQ-A","REQ-B"],"scope":{}}';
const permutedText='{"chainRecords":'+setText+',"jobId":"JOB-ARRAY","requirementIds":["REQ-A","REQ-B","REQ-B"],"scope":{}}';
const nestedPermutedText='{"chainRecords":[{"id":"10","value":"ten"},{"id":"2","steps":["a","z","z"],"value":"two"},{"id":"","value":"bmp"},{"id":"𐀀","value":"astral"}],"jobId":"JOB-ARRAY","requirementIds":["REQ-B","REQ-A","REQ-B"],"scope":{}}';
const digest=text=>createHash('sha256').update(text,'utf8').digest('hex');
const requireContract=(condition,oracle)=>{if(!condition)throw Object.assign(new Error(oracle),{code:'REGISTERED_ARRAY_CONTRACT_ASSERTION'});};

function observeRegisteredArrays(source,{workbookSource,schemaSource}){
  const context=createVerifierRuntime({Event:class Event{},dispatchEvent(){},TextEncoder,TextDecoder,Uint8Array,Uint32Array,ArrayBuffer,DataView,Blob});
  for(const [filename,bytes]of [['workbook.js',workbookSource],['hash.js',source],['workflow-schema.js',schemaSource]])createVerifierRuntime.loadScript(context,bytes,{filename:filename+':registered-array-contract'});
  const hash=context.closedLoopHash,run=code=>createVerifierRuntime.loadScript(context,code);
  const schema=context.closedLoopWorkflowSchema,derivationIdentity=schema.FIELD_REGISTRY['RECORD.evidenceChains.EVIDENCE_CHAIN_VERSION']?.derivationIdentity,derivation=schema.derivationRegistry.entries[derivationIdentity],setRegistration=hash.setSemanticsRegistry.get('/chainRecords');
  assert.deepEqual({derivationIdentity,version:derivation?.version,implementationOwner:derivation?.implementationOwner,implementationFunction:derivation?.implementationFunction,canonicalKind:derivation?.canonicalInputContract?.identity,canonicalizationVersion:derivation?.canonicalInputContract?.canonicalizationVersion,buildIdentity:derivation?.buildIdentity,pointer:setRegistration?.pointer,elementIdentityKey:setRegistration?.elementIdentityKey,duplicateRule:setRegistration?.duplicateRule,sortRule:setRegistration?.sortRule},
    {derivationIdentity:'closed-loop-derivation/stage29-evidence-chain-set-version/1',version:1,implementationOwner:'workflow-engine.js',implementationFunction:'evidenceChainSetHash',canonicalKind:'EVIDENCE_CHAIN_SET/1',canonicalizationVersion:'closed-loop-canonical-json/1',buildIdentity:'EVIDENCE_CHAIN_SET/1',pointer:'/chainRecords',elementIdentityKey:'id',duplicateRule:'REJECT',sortRule:'CANONICAL_BYTE_ORDER_OVER_ELEMENT_IDENTITY'},'REGISTERED_ARRAY_SCHEMA_LINK_ORACLE');
  const members=[{id:'𐀀',value:'astral'},{id:'',value:'bmp'},{id:'2',value:'two',steps:['z','a','z']},{id:'10',value:'ten'}];
  const subject=(requirementIds=['REQ-B','REQ-A','REQ-B'],set=members)=>{
    context.inputJson=JSON.stringify({jobId:'JOB-ARRAY',scope:{},requirementIds,chainRecords:set});
    return run('JSON.parse(inputJson)');
  };
  const cases=[],rejections=[];
  const registryText=()=>JSON.stringify({sets:[...hash.setSemanticsRegistry],preimages:[...hash.hashPreimageRegistry]});
  const observe=(caseId,input,expectedPreimage,orderedText)=>{
    const before=JSON.stringify(input),registryBefore=registryText();
    const preimage=hash.registeredHashPreimage('EVIDENCE_CHAIN_SET/1',input);
    requireContract(JSON.stringify(preimage.requirementIds)===orderedText,'REGISTERED_ARRAY_ORDER_ORACLE: '+caseId);
    requireContract(JSON.stringify(preimage.chainRecords.map(item=>item.id))==='["10","2","","𐀀"]','REGISTERED_SET_ORDER_ORACLE: '+caseId);
    const observedPreimage=hash.stableStringify(preimage),expectedSha256=digest(expectedPreimage),observedSha256=hash.hashRegistered('EVIDENCE_CHAIN_SET/1',input);
    requireContract(observedPreimage===expectedPreimage,'REGISTERED_ARRAY_PREIMAGE_ORACLE: '+caseId);
    requireContract(observedSha256===expectedSha256,'REGISTERED_ARRAY_DIGEST_ORACLE: '+caseId);
    requireContract(JSON.stringify(input)===before&&registryText()===registryBefore,'REGISTERED_ARRAY_NO_MUTATION_ORACLE: '+caseId);
    cases.push({caseId,expectedPreimage,observedPreimage,expectedSha256,observedSha256,subjectUnchanged:true,registryUnchanged:true,passed:true});
  };
  observe('paired-original',subject(),originalText,'["REQ-B","REQ-A","REQ-B"]');
  observe('ordinary-array-permuted',subject(['REQ-A','REQ-B','REQ-B']),permutedText,'["REQ-A","REQ-B","REQ-B"]');
  observe('registered-set-permuted',subject(['REQ-B','REQ-A','REQ-B'],[...members].reverse()),originalText,'["REQ-B","REQ-A","REQ-B"]');
  observe('nested-ordinary-array-permuted',subject(['REQ-B','REQ-A','REQ-B'],members.map(item=>item.id==='2'?{...item,steps:['a','z','z']}:item)),nestedPermutedText,'["REQ-B","REQ-A","REQ-B"]');
  requireContract(cases[0].observedSha256!==cases[1].observedSha256&&cases[0].observedSha256===cases[2].observedSha256&&cases[0].observedSha256!==cases[3].observedSha256,'REGISTERED_ARRAY_PERMUTATION_BOUNDARY_ORACLE');
  const reject=(caseId,operation,expectedMessage,input=null)=>{
    const before=input===null?null:JSON.stringify(input),registryBefore=registryText();let error;
    try{operation();}catch(caught){error=caught;}
    requireContract(error?.name==='TypeError'&&error.message===expectedMessage,'REGISTERED_ARRAY_REFUSAL_ORACLE: '+caseId);
    requireContract((input===null||JSON.stringify(input)===before)&&registryText()===registryBefore,'REGISTERED_ARRAY_REFUSAL_NO_MUTATION_ORACLE: '+caseId);
    rejections.push({caseId,errorName:error.name,expectedMessage,observedMessage:error.message,subjectUnchanged:true,registryUnchanged:true,passed:true});
  };
  reject('missing-identity-declaration',()=>hash.registerSetSemantics('/missing',{}),'Set semantics for /missing require an element identity key.');
  reject('empty-identity-declaration',()=>hash.registerSetSemantics('/empty',{elementIdentityKey:''}),'Set semantics for /empty require an element identity key.');
  reject('wrong-duplicate-rule',()=>hash.registerSetSemantics('/duplicates',{elementIdentityKey:'id',duplicateRule:'ALLOW'}),'Set semantics for /duplicates must use the controlling duplicate and sort rules.');
  reject('wrong-sort-rule',()=>hash.registerSetSemantics('/sort',{elementIdentityKey:'id',sortRule:'NUMERIC'}),'Set semantics for /sort must use the controlling duplicate and sort rules.');
  reject('duplicate-pointer-declaration',()=>hash.registerSetSemantics('/chainRecords',{elementIdentityKey:'id'}),'Set semantics for /chainRecords are already registered.');
  reject('relative-pointer-declaration',()=>hash.registerSetSemantics('chainRecords',{elementIdentityKey:'id'}),'Set pointer must be an absolute JSON pointer.');
  for(const [caseId,set,message]of [
    ['duplicate-element-identity',[{id:'2'},{id:'2'}],'Duplicate set element identity at /chainRecords.'],
    ['missing-element-identity',[{value:'missing'}],'Set element at /chainRecords lacks identity key id.'],
    ['nonarray-set-value',{id:'2'},'Registered set pointer /chainRecords must resolve to an array.']
  ]){
    const input=subject(['REQ-B','REQ-A','REQ-B'],set);
    reject(caseId,()=>hash.hashRegistered('EVIDENCE_CHAIN_SET/1',input),message,input);
  }
  observe('restored-after-refusals',subject(),originalText,'["REQ-B","REQ-A","REQ-B"]');
  return {cases,rejections};
}

// Exported for scoped diagnostics; this module has no CLI and emits no normal
// owner marker or receipt. The default verify-hash producer calls this function.
export function verifyCanonicalRegisteredArrayControls({source=fs.readFileSync(new URL('./hash.js',import.meta.url),'utf8')}={}){
  const support={workbookSource:fs.readFileSync(new URL('./workbook.js',import.meta.url),'utf8'),schemaSource:fs.readFileSync(new URL('./workflow-schema.js',import.meta.url),'utf8')};
  const observed=observeRegisteredArrays(source,support),faults=[];
  const defaultAnchor='if(!semantics)return value;';
  const sortAnchor='copy.sort((a,b)=>compareUnicodeScalarSequence(stableStringify(a[semantics.elementIdentityKey]),stableStringify(b[semantics.elementIdentityKey])));';
  const mutations=[
    {fault:'unregistered-array-sorted',anchor:defaultAnchor,replacement:'if(!semantics)return Array.isArray(value)?[...value].sort((a,b)=>compareUnicodeScalarSequence(stableStringify(a),stableStringify(b))):value;',oracle:'REGISTERED_ARRAY_ORDER_ORACLE: paired-original'},
    {fault:'registered-set-reversed',anchor:sortAnchor,replacement:'copy.sort((a,b)=>compareUnicodeScalarSequence(stableStringify(b[semantics.elementIdentityKey]),stableStringify(a[semantics.elementIdentityKey])));',oracle:'REGISTERED_SET_ORDER_ORACLE: paired-original'}
  ];
  for(const {fault,anchor,replacement,oracle}of mutations){
    assert.equal(source.split(anchor).length,2,'REGISTERED_ARRAY_FAULT_ANCHOR_ORACLE: '+fault);
    let error;try{observeRegisteredArrays(source.replace(anchor,replacement),support);}catch(caught){error=caught;}
    requireContract(error?.code==='REGISTERED_ARRAY_CONTRACT_ASSERTION'&&error.message===oracle,'REGISTERED_ARRAY_INTENDED_FAULT_ORACLE: '+fault);
    const restored=observeRegisteredArrays(source,support);
    assert.deepEqual(restored,observed,'REGISTERED_ARRAY_RESTORED_CONTROL_ORACLE: '+fault);
    faults.push({fault,code:error.code,oracle:error.message,detected:true,restored:true,restoredSha256:restored.cases[0].observedSha256});
  }
  return {schema:'closed-loop-registered-array-observations/1',checkId:'canonical.registered-array-preimages',passed:true,synthetic:true,actualBrowser:false,fullClauseConformanceEstablished:false,boundary,...observed,caseCount:observed.cases.length,rejectionCount:observed.rejections.length,faults,faultCount:faults.length};
}
