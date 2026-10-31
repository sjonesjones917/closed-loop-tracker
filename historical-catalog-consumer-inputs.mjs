// Test-only transport of the pre-continuation literal catalog fixture universe.
// These bytes are never installed as current declarations or current proof.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readAtomicEvidenceBytes} from './review-specification-coverage.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
export const historicalCatalogSpecificationSha256='8b17763e915b9475898dad5d44e83a1c9552025c699ec28d24a3d12b9b0cf883';
export const historicalCatalogInputDescriptors=Object.freeze({
 'verification-assertion-bindings.json':Object.freeze({path:'verification/historical-assertion-bindings-8b17763e-20261015.json',byteLength:547923,sha256:'0664e65ce343c1b74ec0157cd1ec57148667de2c7324bb0c2e9ff6146db52b9e'}),
 'specification/closed-loop-normative-requirements.json':Object.freeze({path:'verification/approved-v4-continuation-20261015/immutable-base/specification/closed-loop-normative-requirements.json',byteLength:67560152,sha256:'4773f157f198781918b0fb9f20a696ad9d2b09dbea0120a9407ce0d24c96df5c'}),
 'specification/closed-loop-reliability-controlling-implementation-specification.txt':Object.freeze({path:'verification/approved-v4-continuation-20261015/immutable-base/specification/closed-loop-reliability-controlling-implementation-specification.txt',byteLength:309482,sha256:historicalCatalogSpecificationSha256})
});
export function readHistoricalCatalogInput(logicalPath,cwd=root){
 assert(Object.hasOwn(historicalCatalogInputDescriptors,logicalPath),'HISTORICAL_CATALOG_INPUT_PATH_ORACLE');
 const expected=historicalCatalogInputDescriptors[logicalPath],bytes=readAtomicEvidenceBytes(expected.path,cwd);
 assert.equal(bytes.length,expected.byteLength,'HISTORICAL_CATALOG_INPUT_SIZE_ORACLE: '+logicalPath);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),expected.sha256,'HISTORICAL_CATALOG_INPUT_BYTES_ORACLE: '+logicalPath);
 return bytes;
}
export function readHistoricalCatalogBindings(cwd=root){
 const declarations=JSON.parse(readHistoricalCatalogInput('verification-assertion-bindings.json',cwd));
 assert.equal(declarations.schema,'closed-loop-verification-assertion-bindings/1','HISTORICAL_CATALOG_BINDINGS_SCHEMA_ORACLE');
 assert.equal(declarations.specificationSha256,historicalCatalogSpecificationSha256,'HISTORICAL_CATALOG_BINDINGS_SOURCE_ORACLE');
 return declarations;
}
