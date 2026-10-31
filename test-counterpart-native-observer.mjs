import assert from 'node:assert/strict';
// The API's canonical comparisons belong to its runtime realm. Preserve every
// parsed evidence field; copying establishes no identity or execution authority.
export function nativeEvidencePayload(owner,text){
 const parsed=JSON.parse(text),payload=owner.copy?owner.copy(parsed):parsed;
 assert.equal(JSON.stringify(payload),JSON.stringify(parsed),'COUNTERPART_NATIVE_OBSERVER_BYTES_ORACLE');
 return payload;
}
export function verifyNativeObserverControls(owner,test,text){
 const runtime=owner.runtime.closedLoopTestRuntime,payload=nativeEvidencePayload(owner,text);
 const checked=runtime.nativeExecutionOutcomeCurrent(test,payload.nativeExecutionIdentity,payload);
 assert(checked.valid&&checked.releaseBearing,JSON.stringify(checked));
 assert(payload.nativeExecutionIdentity.parserRegistryIdentities.length>0,'Registry controls require actual executed parser identity.');
 const mutations=[
  value=>{value.nativeExecutionIdentity.parserRegistryIdentities[0].operation='ALTERED';},
  value=>{value.nativeExecutionIdentity.parserRegistryIdentities[0].registryVersion='ALTERED';},
  value=>{value.nativeExecutionIdentity.parserRegistryIdentities[0].registrySha256='0'.repeat(64);},
  value=>{value.nativeExecutionIdentity.parserRegistryIdentities=[];}
 ];
 for(const mutate of mutations){const altered=JSON.parse(text);mutate(altered);const copied=nativeEvidencePayload(owner,JSON.stringify(altered)),result=runtime.nativeExecutionOutcomeCurrent(test,copied.nativeExecutionIdentity,copied);assert.equal(result.valid,false);assert.equal(result.releaseBearing,false);assert(result.issues.some(issue=>issue.code==='NATIVE_EXECUTION_REGISTRY_MISMATCH'));}
 return {equalSerializedEvidence:true,valid:true,releaseBearing:true,alteredRegistryRefusals:mutations.length};
}
