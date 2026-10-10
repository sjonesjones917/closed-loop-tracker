// Repository-only projection of the designated runtime contract owners. The
// deployment does not define another registry or execute any Test IR operation.
import fs from 'node:fs';
import path from 'node:path';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {createHash,webcrypto} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {fileURLToPath} from 'node:url';

const sourceNames=['workbook.js','hash.js','workflow-schema.js','test-runtime.js'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function deploymentContractIdentities(directory){
 const trustedRoot=fileURLToPath(new URL('.',import.meta.url));
 const sources=Object.fromEntries(sourceNames.map(name=>[name,fs.readFileSync(path.join(trustedRoot,name))]));
 // Incoming artifact hashes establish self-consistency, not code authority.
 // Require exact owner bytes from this checked-out source before inspecting
 // their declarations. Evaluate only those trusted checkout bytes; node:vm is
 // used for namespace isolation and is never an untrusted-code sandbox.
 for(const name of sourceNames)if(!sources[name].equals(fs.readFileSync(path.join(directory,name))))throw new Error('DEPLOYMENT_CONTRACT_IDENTITIES: artifact contract owner differs from checked-out source: '+name+'.');
 const context=createVerifierRuntime({TextEncoder,TextDecoder,crypto:webcrypto,dispatchEvent(){},Event:function(type){this.type=type;}},{codeGeneration:{strings:false,wasm:false}});
 for(const name of sourceNames)createVerifierRuntime.loadScript(context,sources[name].toString('utf8'),{filename:name,timeout:5000});
 const schema=context.closedLoopWorkflowSchema,hash=context.closedLoopHash,runtime=context.closedLoopTestRuntime;
 if(!schema||!hash||!runtime)throw new Error('DEPLOYMENT_CONTRACT_IDENTITIES: designated runtime contract owner is unavailable.');
 const owner=name=>({path:name,sha256:sha(sources[name])});
 const schemaRegistry=member=>({owner:owner('workflow-schema.js'),member,ownerVersion:schema.version,...(schema[member]?.identity?{identity:schema[member].identity}:{}),hashAlgorithm:'SHA-256',digest:hash.sha256Value(schema[member])});
 // ID allocation is owned by hash.js plus the canonical family declarations,
 // rather than an invented ID_REGISTRY export. Bind both existing sources and
 // their exact registered identity-field/prefix data under closed-loop-id/1.
 const idDeclarations={identity:hash.idVersion,contentRecordIdFields:[...hash.contentRecordIdFields].sort(),canonicalFamilies:Object.fromEntries(Object.entries(schema.RECORD_SCHEMAS).map(([family,record])=>[family,{idField:record.idField,prefix:record.prefix}]))};
 const registryIdentities={field:schemaRegistry('FIELD_REGISTRY'),operation:schemaRegistry('STAGE_OPERATION_REGISTRY'),scope:schemaRegistry('STAGE_OPERATION_SCOPE_MATRIX'),durableObject:schemaRegistry('DURABLE_OBJECT_REGISTRY'),normalizer:schemaRegistry('normalizerRegistry'),derivation:schemaRegistry('derivationRegistry'),id:{owners:[owner('hash.js'),owner('workflow-schema.js')],members:['idVersion','contentRecordIdFields','RECORD_SCHEMAS.idField/prefix'],identity:hash.idVersion,hashAlgorithm:'SHA-256',digest:hash.sha256Value(createVerifierRuntime.loadScript(context,'JSON.parse')(JSON.stringify(idDeclarations)))}};
 const testIrIdentities={owner:owner('test-runtime.js'),languageVersion:runtime.TEST_IR_LANGUAGE_VERSION,operationRegistryVersion:runtime.OPERATION_REGISTRY_VERSION,operationRegistrySha256:runtime.OPERATION_REGISTRY_SHA256};
 return JSON.parse(JSON.stringify({registryIdentities,testIrIdentities}));
}
export function validateDeploymentContractIdentities(manifest,directory){
 const expected=deploymentContractIdentities(directory);
 for(const key of ['registryIdentities','testIrIdentities'])if(!isDeepStrictEqual(manifest[key],expected[key]))throw new Error('DEPLOYMENT_CONTRACT_IDENTITIES: missing, stale or incorrect '+key+'.');
 return expected;
}
