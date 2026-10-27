import {verifySpecificationSourceHistoryRegressions} from './test-specification-source-history.mjs';
import {assertDetectedFault} from './verify-conformance-regressions.mjs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createApprovedInsertionMap,readInsertionAtomicDescriptor} from './approved-source-continuation.mjs';
import {validateSpecificationSource} from './review-specification-coverage.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const specificationPath='specification/closed-loop-reliability-controlling-implementation-specification.txt';
const expectedSha256='8b17763e915b9475898dad5d44e83a1c9552025c699ec28d24a3d12b9b0cf883';
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const currentSource=fs.readFileSync(path.join(root,specificationPath)),governance=JSON.parse(fs.readFileSync(path.join(root,'specification/requirement-evidence-bindings.json')));
const continuation=governance.atomicExtraction?.schema==='closed-loop-approved-insertion-atomic-extraction/1'?readInsertionAtomicDescriptor(governance.atomicExtraction).continuation:null;
const fixtureSourcePath=continuation?continuation.base.view.find(row=>row.logicalPath===specificationPath).storagePath:specificationPath;
const source=fs.readFileSync(path.join(root,fixtureSourcePath));
assert.equal(source.length,309482,'The regression must exercise the exact supplied target.');
assert.equal(sha256(source),expectedSha256,'The regression fixture cannot silently follow a changed source.');
// This isolated identity fixture is not a generated governance manifest or a
// provenance claim. Full governance separately requires the actual Git source
// and independently reviewed/reconciled coverage before it can pass.
const fixtureCommit='1'.repeat(40);
const identity={sha256:expectedSha256,byteLength:309482,sourceCommit:fixtureCommit};
const accepted=validateSpecificationSource(source,identity,fixtureCommit);
assert.equal(accepted,source.toString('utf8'));
assert.ok(accepted.startsWith('The one\n\n'));
assert.ok(accepted.endsWith('\n\n')&&!accepted.endsWith('\n\n\n'));
const mutations=[];
function reject(name,bytes,pattern,manifest=identity,commit=fixtureCommit){
  assert.throws(()=>validateSpecificationSource(bytes,manifest,commit),pattern,name);
  // A negative case cannot alter the positive control or its evidence tuple.
  assert.equal(validateSpecificationSource(source,identity,fixtureCommit),accepted);
  mutations.push(name);
}
reject('BOM',Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),source]),/BOM is prohibited/);
const invalidUtf8=Buffer.from(source);invalidUtf8[120]=0xff;
reject('invalid UTF-8',invalidUtf8,/encoded data was not valid/);
reject('CRLF conversion',Buffer.from(accepted.replace('\n','\r\n')),/CR or CRLF/);
reject('leading blank line',Buffer.concat([Buffer.from('\n'),source]),/leading blank line/);
reject('missing final LF',source.subarray(0,-1),/two final LF bytes/);
reject('extra final LF',Buffer.concat([source,Buffer.from('\n')]),/two final LF bytes/);
reject('missing supplied header',Buffer.from(accepted.slice('The one\n\n'.length)),/start boundary/);
reject('changed final sentence',Buffer.from(accepted.replace('pinned actual physical-iPhone Safari operator path.\n\n','pinned actual physical-iPhone Safari operator PATH.\n\n')),/end boundary/);
reject('same-length interior byte mutation',Buffer.from(accepted.replace('Required stage count: Exactly 30','Required stage count: Exactly 31')),/does not bind the exact source bytes/);
reject('changed digest tuple',source,/does not bind the exact source bytes/,{...identity,sha256:'0'.repeat(64)});
reject('changed byte-length tuple',source,/byte length is wrong/,{...identity,byteLength:identity.byteLength+1});
reject('missing source commit',source,/source commit is unavailable/,identity,'');
reject('different source commit',source,/source commit is wrong/,{...identity,sourceCommit:'2'.repeat(40)});

const temporaryRoot=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-source-adoption-'));
const originalFiles=[specificationPath,'specification/closed-loop-specification-manifest.json','specification/closed-loop-normative-requirements.json','specification/requirement-evidence-bindings.json'];
const before=new Map(originalFiles.map(file=>[file,fs.readFileSync(path.join(root,file))]));
const run=(script,args=[],cwd=root)=>cp.spawnSync(process.execPath,[path.join(root,script),...args],{cwd,encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024,env:{...process.env,GITHUB_ACTIONS:'false',SOURCE_COMMIT:fixtureCommit}});
try{
  const review=run('review-specification-coverage.mjs',[path.join(root,fixtureSourcePath)]);
  assert.equal(review.status,0,review.stderr);
  const inventory=JSON.parse(review.stdout);
  assert.equal(inventory.reviewedSourceSha256,expectedSha256);
  assert.equal(inventory.reviewedSourceByteLength,source.length);
  assert.deepEqual(inventory.sectionInventory.filter(section=>/^\d+$/.test(section.sectionId)).map(section=>section.sectionId),Array.from({length:53},(_,index)=>String(index)));
  assert.ok(!inventory.sectionInventory.some(section=>['16.1A','32.4A'].includes(section.sectionId)));
  for(const [name,mutated,pattern] of [
    ['missing top-level section',accepted.replace('\n52. Final controlling rule\n','\nFinal controlling rule\n'),/exact top-level Section 0 through Section 52/],
    ['duplicate subsection',accepted.replace('\n16.2 Canonical-family sole-authority rule\n','\n16.1 Canonical-family sole-authority rule\n'),/duplicate section identifiers/]
  ]){
    const fixture=path.join(temporaryRoot,'mutated-source.txt');fs.writeFileSync(fixture,mutated);
    const result=run('review-specification-coverage.mjs',[fixture]);
    assertDetectedFault(result,pattern,name);
    mutations.push(name);
  }
  // Old-source approval ranges cannot be interpreted as authority for the new
  // source. Only the disposable input tuple is synthesized; no review or
  // acceptance status is created and no committed manifest is regenerated.
  fs.mkdirSync(path.join(temporaryRoot,'specification'));
  fs.writeFileSync(path.join(temporaryRoot,specificationPath),source);
  fs.writeFileSync(path.join(temporaryRoot,'specification/requirement-evidence-bindings.json'),JSON.stringify({
    schema:'closed-loop-requirement-evidence-bindings/1',
    specificationSha256:'95a6a8b1f8857b35c47cb44874aee2bbada1ccfd2ee7aa9033d92fb39c8bda9d',
    approvedClarifications:[{startLine:1283,lineCount:64}],requirements:[]
  }));
  const staleEvidence=run('generate-specification-governance.mjs',[],temporaryRoot);
  assertDetectedFault(staleEvidence,/Requirement evidence bindings do not match the controlling specification/,'Historical source evidence must not regenerate current manifests.');
  assert.ok(!fs.existsSync(path.join(temporaryRoot,'specification/closed-loop-specification-manifest.json')));
  assert.ok(!fs.existsSync(path.join(temporaryRoot,'specification/closed-loop-normative-requirements.json')));
  mutations.push('historical evidence source tuple');
  if(continuation){
    const read=ref=>{const item=continuation.view.find(row=>row.provenancePath===ref.path);assert(item&&item.sha256===ref.sha256,'CURRENT_ADOPTION_CUSTODY_ORACLE');const bytes=fs.readFileSync(path.join(root,item.storagePath));assert.equal(sha256(bytes),ref.sha256,'CURRENT_ADOPTION_BYTES_ORACLE');return bytes;};
    const proposalBytes=read(continuation.proposal),currentBytes=read(continuation.source),declared=JSON.parse(read(continuation.insertionMap));
    assert.deepEqual(currentBytes,currentSource,'CURRENT_ADOPTION_ACTUAL_SOURCE_ORACLE');
    const args={baseBytes:source,currentBytes,proposalBytes,baseSha256:expectedSha256,currentSha256:sha256(currentSource),proposalSha256:continuation.proposal.sha256,specificationPath,ranges:declared.ranges};
    const acceptedCurrent=createApprovedInsertionMap(args);assert.equal(acceptedCurrent.currentSha256,sha256(currentSource));
    for(const [name,change,pattern]of [
      ['changed-current-source',value=>{value.currentBytes=Buffer.from(value.currentBytes);value.currentBytes[100]^=1;},/INSERTION_CURRENT_HASH/],
      ['amendment-omission',value=>value.ranges.pop(),/INSERTION_RECONSTRUCTION/],
      ['amendment-predecessor',value=>value.ranges[0].previousSpecificationSha256='0'.repeat(64),/INSERTION_PREDECESSOR/],
      ['amendment-proposal-range',value=>value.ranges[0].approvedProposalSourceStartLine++,/INSERTION_RANGE_COORDINATES|INSERTION_RANGE_BYTES/]
    ]){const value={...args,ranges:structuredClone(args.ranges)};change(value);assert.throws(()=>createApprovedInsertionMap(value),pattern,name);assert.equal(createApprovedInsertionMap(args).currentSha256,sha256(currentSource));mutations.push(name);}
  }
  const sourceHistoryRegression=await verifySpecificationSourceHistoryRegressions({cwd:root});
  console.log(JSON.stringify({
    sourceHistoryRegression,
    test:'test-specification-source-adoption',result:'PASS',scope:'EXACT_SOURCE_BYTE_VALIDATION_AND_MECHANICAL_SECTION_CONTROLS_ONLY',
    sourceByteLength:source.length,sourceSha256:sha256(source),topLevelSectionCount:53,sectionCount:inventory.sectionInventory.length,
    exactSourceAccepted:true,mutationCount:mutations.length,mutations,
    historicalEvidenceCannotRegenerateCurrentManifests:true,
    normativeCoverageAcceptanceClaim:false,implementationConformanceClaim:false,gitProvenanceAcceptanceClaim:false
  },null,2));
}finally{
  fs.rmSync(temporaryRoot,{recursive:true,force:true});
  for(const [file,bytes] of before)assert.ok(bytes.equals(fs.readFileSync(path.join(root,file))),`Regression mutated committed input: ${file}`);
}
