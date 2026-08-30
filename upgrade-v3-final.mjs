import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=process.cwd();const read=file=>fs.readFileSync(path.join(root,file),'utf8');const write=(file,text)=>fs.writeFileSync(path.join(root,file),text);

{
  let text=read('test-runtime.js');
  if(!text.includes('function validateResourceEnvelope('))text=text.replace('function validateRegex(pattern,flags=\'\'){',`function validateResourceEnvelope(claim={}){\n  const issues=[];const allowed=new Set(['totalInputBytes','decompressedBytes','archiveExpansionBytes']);for(const key of Object.keys(claim||{}))if(!allowed.has(key))issues.push('Unknown resource-envelope property '+key+'.');\n  const checks=[['totalInputBytes','maxTotalInputBytes'],['decompressedBytes','maxDecompressedBytes'],['archiveExpansionBytes','maxArchiveExpansionBytes']];\n  for(const [key,limitKey] of checks){if(!Object.prototype.hasOwnProperty.call(claim,key))continue;const value=claim[key];if(!Number.isSafeInteger(value)||value<0)issues.push(key+' must be a nonnegative safe integer.');else if(value>LIMITS[limitKey])issues.push(key+' exceeds '+limitKey+'.');}\n  return {valid:issues.length===0,issues};\n}\nfunction validateRegex(pattern,flags=''){`);
  text=text.replace("  if(totalInputBytes>LIMITS.maxTotalInputBytes)fail('INPUT_BYTE_LIMIT',`Bound input bytes exceed ${LIMITS.maxTotalInputBytes}.`);","  const envelope=validateResourceEnvelope({totalInputBytes});if(!envelope.valid)fail('INPUT_BYTE_LIMIT',envelope.issues.join(' '));");
  const anchor="  let value=null,current=null;const observations=[];let finalAssertion=null;const inputArtifactIds=[];const inputArtifactSha256Values=[];";
  if(text.includes(anchor)&&!text.includes('PREHASH_EVERY_BOUND_ARTIFACT'))text=text.replace(anchor,`${anchor}\n  /* PREHASH_EVERY_BOUND_ARTIFACT: every consumed package input is identity-bound, even when a comparison operation references it without LOAD_ARTIFACT. */\n  for(const [bindingName,artifact] of Object.entries(artifacts||{})){const bytes=bytesOf(artifact?.bytes??artifact);if(!bytes)continue;const calculated=await sha256(bytes);if(artifact?.sha256&&String(artifact.sha256).toLowerCase()!==calculated)fail('ARTIFACT_HASH_MISMATCH',\`Artifact \${artifact.artifactId||bindingName} bytes do not match its declared SHA-256.\`);inputArtifactIds.push(String(artifact?.artifactId||bindingName));inputArtifactSha256Values.push(calculated);}`);
  text=text.replace('operationContracts,sha256Canonical});','operationContracts,sha256Canonical,validateResourceEnvelope});');
  write('test-runtime.js',text);
}

{
  let text=read('verify-test-runtime-limits.mjs');
  text=text.replace("const one=await runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'ONE'},{op:'READ_BYTES'},{op:'ASSERT_EQ',value:[111,110,101]}])","const one=await runtime.execute({spec:spec([{op:'LOAD_ARTIFACT',binding:'ONE'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'ASSERT_EQ',value:'one'}])");
  if(!text.includes('resourceEnvelopeBoundaries'))text=text.replace("const totalBytes=new Uint8Array(runtime.LIMITS.maxTotalInputBytes+1);",`assert.equal(runtime.validateResourceEnvelope({totalInputBytes:runtime.LIMITS.maxTotalInputBytes}).valid,true);\nassert.equal(runtime.validateResourceEnvelope({totalInputBytes:runtime.LIMITS.maxTotalInputBytes+1}).valid,false);\nassert.equal(runtime.validateResourceEnvelope({decompressedBytes:runtime.LIMITS.maxDecompressedBytes}).valid,true);\nassert.equal(runtime.validateResourceEnvelope({decompressedBytes:runtime.LIMITS.maxDecompressedBytes+1}).valid,false);\nassert.equal(runtime.validateResourceEnvelope({archiveExpansionBytes:runtime.LIMITS.maxArchiveExpansionBytes}).valid,true);\nassert.equal(runtime.validateResourceEnvelope({archiveExpansionBytes:runtime.LIMITS.maxArchiveExpansionBytes+1}).valid,false);\nconst resourceEnvelopeBoundaries=true;\n\nconst totalBytes=new Uint8Array(runtime.LIMITS.maxTotalInputBytes+1);`);
  text=text.replace('arbitraryCodeImpossible:true}));','arbitraryCodeImpossible:true,resourceEnvelopeBoundaries}));');
  write('verify-test-runtime-limits.mjs',text);
}

{
  let text=read('verify-v3-definition-of-done.mjs');
  if(!text.includes("verify-test-runtime-limits.mjs"))text=text.replace("const ingestionTests=read('./verify-ingestion.mjs')","const limitTests=read('./verify-test-runtime-limits.mjs');\nconst ingestionTests=read('./verify-ingestion.mjs')");
  if(!text.includes('maxArchiveExpansionBytes'))text=text.replace("assert.match(runtimeTests,/timeout/i);","assert.match(runtimeTests,/timeout/i);assert.match(limitTests,/maxArchiveExpansionBytes/);assert.match(limitTests,/maxDecompressedBytes/);");
  write('verify-v3-definition-of-done.mjs',text);
}

/* The prompt and UI consume the same engine-derived handoff. Keep the operator/executor headings exact. */
{
  let text=read('prompt-engine.js');
  text=text.replaceAll('FILES / CONTEXT YOU MUST NOT RECEIVE','FILES YOU MUST NOT RECEIVE');
  text=text.replaceAll('FILES / EVIDENCE YOU MUST RETURN','FILES OR EVIDENCE YOU MUST RETURN');
  write('prompt-engine.js',text);
}

/* Normalize the permanent Pages workflow around the controlling proof order. */
{
  const file='.github/workflows/pages.yml';let text=read(file);
  if(!text.includes('node --check verify-test-runtime-limits.mjs'))text=text.replace('          node --check verify-test-runtime-v3.mjs','          node --check verify-test-runtime-v3.mjs\n          node --check verify-test-runtime-limits.mjs');
  const start=text.indexOf('      - name: Verify generic deterministic Test IR runtime');
  const end=text.indexOf('      - name: Exercise all 30 stage prompt-response ingestion contracts and negative cases');
  if(start>=0&&end>start){const replacement=`      - name: Verify schema and ownership architecture\n        run: node verify.mjs\n      - name: Verify deterministic migration\n        run: node verify-v3-migration.mjs\n      - name: Verify Test IR validation and security\n        run: |\n          node verify-v3-contract.mjs\n          node verify-test-runtime-v3.mjs\n          node verify-test-runtime-limits.mjs\n      - name: Verify deterministic runtime\n        run: |\n          node verify-test-runtime.mjs\n          node verify-test-runtime-v3.mjs\n          node verify-test-runtime-limits.mjs\n      - name: Verify canonical serialization and SHA-256\n        run: node verify-hash.mjs\n`;text=text.slice(0,start)+replacement+text.slice(end);}
  text=text.replace("      - name: Exercise all 30 stage prompt-response ingestion contracts and negative cases\n        run: |\n          node verify-ingestion.mjs\n          node verify-complete.mjs","      - name: Verify raw-first ingestion and closed-schema negative cases\n        run: node verify-ingestion.mjs\n      - name: Verify workflow gates, derivations, and contradiction-safe release\n        run: node verify-complete.mjs");
  text=text.replace(/node verify-test-runtime-v3\.mjs(?! && node verify-test-runtime-limits\.mjs)/g,'node verify-test-runtime-v3.mjs && node verify-test-runtime-limits.mjs');
  if(!text.includes('node verify-test-runtime-limits.mjs > /tmp/verify-test-runtime-limits.out'))text=text.replace('          node verify-test-runtime-v3.mjs > /tmp/verify-test-runtime-v3.out','          node verify-test-runtime-v3.mjs > /tmp/verify-test-runtime-v3.out\n          node verify-test-runtime-limits.mjs > /tmp/verify-test-runtime-limits.out');
  if(!text.includes("grep -q 'verifyTestRuntimeLimits'"))text=text.replace("          grep -q 'verifyTestRuntimeV3' /tmp/verify-test-runtime-v3.out","          grep -q 'verifyTestRuntimeV3' /tmp/verify-test-runtime-v3.out\n          grep -q 'verifyTestRuntimeLimits' /tmp/verify-test-runtime-limits.out");
  text=text.replace("nativeTestRuntime:'verify-test-runtime.mjs',","nativeTestRuntime:'verify-test-runtime.mjs',\n              nativeRuntimeLimits:'verify-test-runtime-limits.mjs',");
  if(!text.includes("browserWidths:[320,393,'desktop']"))text=text.replace("deployedByteIdentity:process.env.LIVE_RESULT==='success',","deployedByteIdentity:process.env.LIVE_RESULT==='success',\n            browserWidths:[320,393,'desktop'],\n            liveVerification:process.env.LIVE_RESULT==='success',\n            androidChromeAcceptance:false,\n            fullProductionMaturity:false,");
  if(!text.includes('mandatoryEvidenceChainStructuralCoverage:'))text=text.replace('            ...v3,','            ...v3,\n            mandatoryEvidenceChainStructuralCoverage:definition.mandatoryEvidenceChainCoverage,');
  text=text.replace("['workbook.js','hash.js','workflow-schema.js','workflow-engine.js'","['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'");
  write(file,text);
}

for(const file of fs.readdirSync(root).filter(file=>fs.statSync(path.join(root,file)).isFile()&&/\.(?:js|mjs|md)$/.test(file))){let text=read(file);text=text.replaceAll("['workbook.js','hash.js','workflow-schema.js','workflow-engine.js'","['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'");write(file,text);}
execFileSync(process.execPath,['build-test-project.mjs'],{cwd:root,stdio:'inherit'});
console.log(JSON.stringify({resourceEnvelope:true,allArtifactInputsHashed:true,limitProofs:true,ciProofOrder:true,acceptanceMetadata:true,promptHandoffHeadings:true}));
