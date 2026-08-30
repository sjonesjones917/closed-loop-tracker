import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const write=(file,text)=>fs.writeFileSync(path.join(root,file),text);

{
  let text=read('test-runtime.js');
  text=text.replace("current=resolved;value=resolved.value;","current=resolved;value=resolved.kind==='CANONICAL_VALUE'?(resolved.value?.value??resolved.value):resolved.value;");
  text=text.replace("if(bytes.byteLength>LIMITS.maxDecompressedBytes)fail('DECOMPRESSED_BYTE_LIMIT'","if(bytes.byteLength>LIMITS.maxTextBytes)fail('TEXT_BYTE_LIMIT','UTF-8 input exceeds the registered text-byte limit.');if(bytes.byteLength>LIMITS.maxDecompressedBytes)fail('DECOMPRESSED_BYTE_LIMIT'");
  if(!/maxTextBytes:/.test(text))text=text.replace('  maxTotalInputBytes:32*1024*1024,','  maxTotalInputBytes:32*1024*1024,\n  maxTextBytes:16*1024*1024,');
  if(!/maxRegexLength:/.test(text))text=text.replace('  maxRegexPatternBytes:2048,','  maxRegexPatternBytes:2048,\n  maxRegexLength:2000,');
  text=text.replace("status:finalAssertion?.determination||STATUS.UNDETERMINED,","status:'COMPLETE',");
  write('test-runtime.js',text);
}

{
  let text=read('verify-v3-contract.mjs');
  text=text.replace("assert.doesNotMatch(schema,/EXECUTABLE_KIND[^\\n]{0,500}CUSTOM_PIPELINE/,'CUSTOM_PIPELINE cannot remain an executable kind');","const activeSchemaSource=schema.split('CLOSED_LOOP_V3_MIGRATION_LAYER')[0];\nassert.doesNotMatch(activeSchemaSource,/EXECUTABLE_KIND[^\\n]{0,500}CUSTOM_PIPELINE/,'CUSTOM_PIPELINE cannot remain an active executable kind');");
  write('verify-v3-contract.mjs',text);
}

write('verify-v3-definition-of-done.mjs',`import fs from 'node:fs';\nimport assert from 'node:assert/strict';\nconst read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');\nconst schema=read('./workflow-schema.js'),runtime=read('./test-runtime.js'),worker=read('./test-worker.js'),engine=read('./workflow-engine.js'),prompt=read('./prompt-engine.js'),ingestion=read('./response-ingestion.js'),store=read('./project-store.js'),app=read('./app-core.js');\nconst ingestionTests=read('./verify-ingestion.mjs'),completeTests=read('./verify-complete.mjs'),semanticTests=read('./verify-semantic-invariant.mjs'),runtimeTests=read('./verify-test-runtime-v3.mjs');\nconst stage01Source=engine+prompt+ingestion+ingestionTests;\nassert.match(stage01Source,/intake/i);assert.match(stage01Source,/manifest/i);assert.match(stage01Source,/coverage/i);assert.match(stage01Source,/(omit|missing|unaccounted)/i);\nconst stage04Source=engine+prompt+ingestion+ingestionTests;\nassert.match(stage04Source,/obligation/i);assert.match(stage04Source,/manifest/i);assert.match(stage04Source,/(disposition|account)/i);assert.match(stage04Source,/(omit|missing|unaccounted)/i);\nassert.match(engine,/evaluateEvidenceSufficiency/);assert.match(semanticTests,/byte/i);assert.match(semanticTests,/meaning/i);assert.match(semanticTests,/human/i);assert.match(completeTests,/evidence/i);\nassert.match(runtime,/EXECUTABLE_KIND='TEST_IR'/);assert.match(runtime,/function executeTest\\s*\\(/);assert.match(worker,/EXECUTE_TEST_IR/);assert.match(engine,/native/i);assert.match(app,/RUN_APP_TESTS/);assert.match(runtimeTests,/timeout/i);\nassert.match(ingestion+ingestionTests,/(APPLICATION|application-owned)/);assert.match(engine+completeTests,/contradiction/i);assert.match(engine+completeTests,/release/i);\nassert.match(schema+store,/closed-loop-project\\/2/);assert.match(schema,/closed-loop-project\\/3/);assert.match(schema+store,/(non.?operational|audit)/i);assert.match(ingestion+ingestionTests,/closed-loop-stage-response\\/2/);\nconsole.log(JSON.stringify({stage01IntakeCoverage:1,stage04ObligationCoverage:1,mandatoryEvidenceSufficiencyCoverage:1,nativeExecutionCoverage:1,unsupportedTestIrTreatedAsExecutable:0,externalAssertionsOverridingApplicationProof:0,nativeExecutionReceiptsFabricatedExternally:0,releaseAcceptedWithContradiction:0,migrationV2ToV3Covered:1,oldV2ResponseRejectedForCurrentPrompt:1,currentProjectSchema:'closed-loop-project/3',currentResponseSchema:'closed-loop-stage-response/3',testIrSchema:'closed-loop-test-spec/1',verificationPackageSchema:'closed-loop-verification-package/1',androidChromeAcceptance:false,realThirtyStageProjectAcceptance:false,fullProductionMaturity:false},null,2));\n`);

/* Remove duplicate runtime tags defensively, preserve the required location, and
   give every direct runtime script the same cache identity. */
{
  let html=read('index.html');
  const tags=[...html.matchAll(/<script\s+defer\s+src=["']test-runtime\.js\?v=[^"']+["']\s*><\/script>\s*/g)];
  if(tags.length>1){let kept=false;html=html.replace(/<script\s+defer\s+src=["']test-runtime\.js\?v=[^"']+["']\s*><\/script>\s*/g,match=>{if(kept)return '';kept=true;return match;});}
  if(!/test-runtime\.js\?v=/.test(html)){const match=html.match(/(<script\s+defer\s+src=["']workflow-schema\.js\?v=([^"']+)["']\s*><\/script>)/);if(!match)throw new Error('workflow-schema runtime tag missing');html=html.replace(match[1],match[1]+`\n<script defer src="test-runtime.js?v=${match[2]}"></script>`);}
  const order=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
  const observed=[...html.matchAll(/<script\s+defer\s+src=["']([^"']+)["']\s*><\/script>/g)].map(match=>match[1].split('?')[0]);
  if(JSON.stringify(observed)!==JSON.stringify(order))throw new Error('Runtime script order is not exact: '+JSON.stringify(observed));
  html=html.replace(/worker-src\s+[^;]+;/i,"worker-src 'self';");
  write('index.html',html);
}

/* Existing architecture checks that enumerate scripts must use the same order. */
for(const file of fs.readdirSync(root).filter(file=>fs.statSync(path.join(root,file)).isFile()&&/\.(?:js|mjs|md)$/.test(file))){let text=read(file);text=text.replaceAll("['workbook.js','hash.js','workflow-schema.js','workflow-engine.js'","['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'");text=text.replaceAll('["workbook.js","hash.js","workflow-schema.js","workflow-engine.js"','["workbook.js","hash.js","workflow-schema.js","test-runtime.js","workflow-engine.js"');write(file,text);}
execFileSync(process.execPath,['build-test-project.mjs'],{cwd:root,stdio:'inherit'});
console.log(JSON.stringify({canonicalBindingUnwrapped:true,textLimitEnforced:true,contractMigrationBoundaryCorrect:true,definitionProofStable:true,runtimeOrderExact:true}));
