// Transport/refusal regression only. No current application or clause proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {readHistoricalCatalogInput,readHistoricalCatalogBindings,historicalCatalogInputDescriptors,historicalCatalogSpecificationSha256} from './historical-catalog-consumer-inputs.mjs';
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export function verifyHistoricalCatalogInputControls(){
 const current=fs.readFileSync(new URL('./verification-assertion-bindings.json',import.meta.url)),declarations=readHistoricalCatalogBindings(),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'historical-catalog-controls-')),cases=[];
 try{
  assert.equal(declarations.specificationSha256,historicalCatalogSpecificationSha256);
  assert.notEqual(JSON.parse(current).specificationSha256,historicalCatalogSpecificationSha256,'HISTORICAL_CATALOG_CURRENT_SOURCE_SEPARATION_ORACLE');
  assert.equal(declarations.bindings.length,358);assert.equal(declarations.contractRefs.length,6);
  for(const [logical,expected] of Object.entries(historicalCatalogInputDescriptors)){
   const bytes=readHistoricalCatalogInput(logical);assert.equal(digest(bytes),expected.sha256);cases.push(logical+':exact-original-bytes');
   const logicalTarget=path.join(temporary,logical),archiveTarget=path.join(temporary,expected.path);fs.mkdirSync(path.dirname(logicalTarget),{recursive:true});fs.writeFileSync(logicalTarget,'Current source cannot substitute for an absent archive.');
   assert.throws(()=>readHistoricalCatalogInput(logical,temporary),error=>error.code==='ENOENT');cases.push(logical+':missing-archive-no-current-fallback');
   fs.mkdirSync(path.dirname(archiveTarget),{recursive:true});fs.writeFileSync(archiveTarget,Buffer.alloc(bytes.length,0));assert.throws(()=>readHistoricalCatalogInput(logical,temporary),/HISTORICAL_CATALOG_INPUT_BYTES_ORACLE/);cases.push(logical+':same-size-corruption');
   fs.writeFileSync(archiveTarget,bytes.subarray(1));assert.throws(()=>readHistoricalCatalogInput(logical,temporary),/HISTORICAL_CATALOG_INPUT_SIZE_ORACLE/);cases.push(logical+':changed-size');
  }
  assert.throws(()=>readHistoricalCatalogInput('../verification-assertion-bindings.json'),/HISTORICAL_CATALOG_INPUT_PATH_ORACLE/);cases.push('undeclared-path');
  // A current declaration document cannot masquerade as the old archive.
  fs.writeFileSync(path.join(temporary,historicalCatalogInputDescriptors['verification-assertion-bindings.json'].path),current);
  assert.throws(()=>readHistoricalCatalogBindings(temporary),/HISTORICAL_CATALOG_INPUT_(SIZE|BYTES)_ORACLE/);cases.push('current-declarations-as-historical');
  const modified=readHistoricalCatalogBindings();modified.bindings[0].checkIds=['MUTATED'];assert.deepEqual(readHistoricalCatalogBindings(),declarations);cases.push('independent-decoded-values');
  assert.deepEqual(fs.readFileSync(new URL('./verification-assertion-bindings.json',import.meta.url)),current);cases.push('current-declarations-unchanged');
  return {passed:true,cases,sourceUniverse:'HISTORICAL_ATOMIC_8B17763E',currentAtomicProof:false,eligibleReceiptCreated:false};
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
}
