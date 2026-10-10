import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {validateSite} from './verified-site.mjs';

// Artifact/consumer regression; no CI, deployed browser or physical proof claim.
export async function verifyDeploymentContractIdentities(directory){
 const file=path.join(directory,'closed-loop-deployment-manifest.json'),bytes=fs.readFileSync(file),manifest=JSON.parse(bytes),cases=[];
 const keys=['field','operation','scope','durableObject','normalizer','derivation','id'];
 assert.deepEqual(Object.keys(manifest.registryIdentities),keys,'DEPLOYMENT_REGISTRY_UNIVERSE_ORACLE');
 const members={field:'FIELD_REGISTRY',operation:'STAGE_OPERATION_REGISTRY',scope:'STAGE_OPERATION_SCOPE_MATRIX',durableObject:'DURABLE_OBJECT_REGISTRY',normalizer:'normalizerRegistry',derivation:'derivationRegistry'};
 for(const [key,member]of Object.entries(members)){const row=manifest.registryIdentities[key];assert.equal(row.member,member);assert.equal(row.owner.path,'workflow-schema.js');assert.equal(row.ownerVersion,'closed-loop-workflow-schema/3');assert.equal(row.hashAlgorithm,'SHA-256');assert.match(row.digest,/^[a-f0-9]{64}$/);assert.equal(row.owner.sha256,createHash('sha256').update(fs.readFileSync(path.join(directory,row.owner.path))).digest('hex'));}
 assert.equal(manifest.registryIdentities.normalizer.identity,'closed-loop-normalizer-registry/1');assert.equal(manifest.registryIdentities.derivation.identity,'closed-loop-derivation-registry/1');assert.equal(manifest.registryIdentities.id.identity,'closed-loop-id/1');assert.deepEqual(manifest.registryIdentities.id.owners.map(row=>row.path),['hash.js','workflow-schema.js']);
 assert.equal(manifest.testIrIdentities.languageVersion,'closed-loop-test-ir-language/1');assert.equal(manifest.testIrIdentities.operationRegistryVersion,'closed-loop-test-ir-operations/1');assert.match(manifest.testIrIdentities.operationRegistrySha256,/^[a-f0-9]{64}$/);assert.equal(manifest.testIrIdentities.owner.path,'test-runtime.js');
 const write=value=>{delete value.manifestDigest;value.manifestDigest={hashAlgorithm:'SHA-256',digest:globalThis.closedLoopHash.sha256Value(value)};fs.writeFileSync(file,JSON.stringify(value));};
 const source=fs.readFileSync(new URL('./verified-site.mjs',import.meta.url),'utf8'),guard='  validateDeploymentContractIdentities(manifest,directory);';assert.equal(source.split(guard).length,2,'DEPLOYMENT_REGISTRY_FAULT_ANCHOR');
 // Removing only the new identity guard exactly retains the former artifact
 // consumer's byte/digest/origin checks. The old producer omitted both fields.
 const formerSource=source.replace(guard,'').replace(/(from\s*|import\s*)(['"])(\.\/[^'"]+)\2/g,(_,prefix,quote,specifier)=>prefix+quote+new URL(specifier,new URL('./verified-site.mjs',import.meta.url)).href+quote);
 const former=await import('data:text/javascript;base64,'+Buffer.from(formerSource).toString('base64'));
 try{
  assert.equal(validateSite(directory).manifestDigest.digest,manifest.manifestDigest.digest);cases.push('current-build-conforming-control');
  const old=structuredClone(manifest);delete old.registryIdentities;delete old.testIrIdentities;write(old);assert.doesNotThrow(()=>former.validateSite(directory),'DEPLOYMENT_REGISTRY_PRE_FIX_ORACLE');assert.throws(()=>validateSite(directory),/DEPLOYMENT_CONTRACT_IDENTITIES: missing, stale or incorrect registryIdentities/);cases.push('former-omission-accepted-and-correction-rejects');
  for(const [name,change]of [['missing-registry-block',m=>delete m.registryIdentities],['missing-language-block',m=>delete m.testIrIdentities],['extra-registry',m=>m.registryIdentities.other={}],...keys.flatMap(key=>[[key+'-missing',m=>delete m.registryIdentities[key]],[key+'-wrong-digest',m=>m.registryIdentities[key].digest='0'.repeat(64)]]),['wrong-registry-owner',m=>m.registryIdentities.field.owner.sha256='0'.repeat(64)],['wrong-language',m=>m.testIrIdentities.languageVersion='OTHER'],['wrong-operation-version',m=>m.testIrIdentities.operationRegistryVersion='OTHER'],['wrong-operation-digest',m=>m.testIrIdentities.operationRegistrySha256='0'.repeat(64)],['wrong-operation-owner',m=>m.testIrIdentities.owner.sha256='0'.repeat(64)]]){
   const changed=structuredClone(manifest);change(changed);write(changed);assert.throws(()=>validateSite(directory),/DEPLOYMENT_CONTRACT_IDENTITIES/,name);fs.writeFileSync(file,bytes);assert.doesNotThrow(()=>validateSite(directory));cases.push(name);
  }
  const ownerFile=path.join(directory,'workflow-schema.js'),ownerBytes=fs.readFileSync(ownerFile);
  try{
   const changedBytes=Buffer.concat([ownerBytes,Buffer.from('\nthrow new Error("UNTRUSTED_ARTIFACT_EXECUTED");\n')]);fs.writeFileSync(ownerFile,changedBytes);const changed=structuredClone(manifest),resource=changed.runtimeResources.find(row=>row.path==='workflow-schema.js');resource.byteSize=changedBytes.length;resource.digest=createHash('sha256').update(changedBytes).digest('hex');write(changed);
   assert.throws(()=>validateSite(directory),error=>/artifact contract owner differs from checked-out source/.test(error.message)&&!error.message.includes('UNTRUSTED_ARTIFACT_EXECUTED'),'DEPLOYMENT_UNTRUSTED_OWNER_NOT_EXECUTED_ORACLE');cases.push('self-consistent-untrusted-owner-rejected-before-execution');
  }finally{fs.writeFileSync(ownerFile,ownerBytes);fs.writeFileSync(file,bytes);}
  assert.doesNotThrow(()=>validateSite(directory));cases.push('exact-artifact-recovery');
  return {passed:true,cases,formerConsumerEquivalent:'Only new identity guard removed; all original artifact checks remain',formerProducerEquivalent:'Both new identity fields omitted and overall canonical manifest digest recomputed; runtime bytes unchanged',actualBuiltArtifact:true,actualDeployment:false,actualBrowser:false,actualPhysicalDevice:false};
 }finally{fs.writeFileSync(file,bytes);}
}
