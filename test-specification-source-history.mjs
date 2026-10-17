import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import {verifyInsertionSourceBase,verifySpecificationSourceCommit} from './specification-source-history.mjs';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export async function verifySpecificationSourceHistoryRegressions({cwd=process.cwd()}={}){
  const cases=[],specificationPath='specification/closed-loop-reliability-controlling-implementation-specification.txt';
  const approved=JSON.parse(fs.readFileSync(path.join(cwd,'specification/requirement-evidence-bindings.json')));
  const sourceBytes=fs.readFileSync(path.join(cwd,specificationPath));
  const descriptorBytes=fs.readFileSync(path.join(cwd,approved.atomicExtraction.continuation.path)),d=JSON.parse(descriptorBytes);
  const baseRow=d.base.view.find(row=>row.logicalPath===specificationPath),committedBaseBytes=fs.readFileSync(path.join(cwd,baseRow.storagePath));
  const args={approved,sourceBytes,committedBaseBytes,specificationPath,readFile:file=>fs.readFileSync(path.join(cwd,file))};
  assert.equal(verifyInsertionSourceBase(args).basis,'APPROVED_INSERTION_PINNED_BASE_RECONSTRUCTION');cases.push('actual-pinned-insertion-reconstruction');
  for(const [name,change,pattern]of [
    ['wrong-git-base',a=>a.committedBaseBytes=Buffer.from('other base\n'),/recorded source commit differs/i],
    ['changed-current',a=>a.sourceBytes=Buffer.from('other current\n'),/Current insertion source bytes differ/],
    ['missing-amendment',a=>a.approved.approvedAmendments.pop(),/range inventory differs/],
    ['extra-amendment',a=>a.approved.approvedAmendments.push(structuredClone(a.approved.approvedAmendments[0])),/range inventory differs/],
    ['changed-amendment',a=>a.approved.approvedAmendments[0].textSha256='0'.repeat(64),/range inventory differs/],
    ['unsupported-clarification',a=>a.approved.approvedClarifications=[{}],/unsupported clarifications/],
    ['unreconciled-descriptor',a=>a.approved.atomicExtraction.status='UNKNOWN',/INSERTION_PRODUCTION_DESCRIPTOR/]
  ]){const value={...args,approved:structuredClone(approved)};change(value);assert.throws(()=>verifyInsertionSourceBase(value),pattern,name);cases.push(name);}
  const descriptorCase=(name,change,pattern)=>{
    const value=structuredClone(d),overrides=new Map();change(value,overrides);
    const bytes=Buffer.from(JSON.stringify(value)),declaration=structuredClone(approved);declaration.atomicExtraction.continuation.sha256=sha(bytes);
    assert.throws(()=>verifyInsertionSourceBase({...args,approved:declaration,readFile:file=>file===declaration.atomicExtraction.continuation.path?bytes:overrides.get(file)??args.readFile(file)}),pattern,name);cases.push(name);
  };
  descriptorCase('duplicate-provenance-alias',value=>value.view.push(structuredClone(value.view[0])),/INSERTION_PRODUCTION_CLOSURE/);
  descriptorCase('wrong-reference-hash',value=>value.proposal.sha256='0'.repeat(64),/exact reference digest/);
  descriptorCase('wrong-base-path',value=>value.base.source.path='specification/other.txt',/base specification path differs/);
  descriptorCase('wrong-storage-hash',value=>value.view[0].sha256='0'.repeat(64),/INSERTION_PRODUCTION_HASH|INSERTION_PRODUCTION_CONFLICT/);
  descriptorCase('changed-map-segments',(value,overrides)=>{
    const row=value.view.find(row=>row.provenancePath===value.insertionMap.path),map=JSON.parse(args.readFile(row.storagePath));(map.originalToSuccessorSegments??map.segments)[0].lineDelta++;
    const bytes=Buffer.from(JSON.stringify(map));row.sha256=value.insertionMap.sha256=sha(bytes);overrides.set(row.storagePath,bytes);
  },/INSERTION_SEGMENTS/);
  descriptorCase('changed-proposal-bytes',(value,overrides)=>{
    const row=value.view.find(row=>row.provenancePath===value.proposal.path),bytes=Buffer.from(args.readFile(row.storagePath));bytes[0]^=1;row.sha256=value.proposal.sha256=sha(bytes);overrides.set(row.storagePath,bytes);
    // Changing a heading outside an approved passage may be immaterial to the
    // insertion map. Change an actual selected proposal passage instead.
    const mapRow=value.view.find(row=>row.provenancePath===value.insertionMap.path),map=JSON.parse(args.readFile(mapRow.storagePath)),lines=bytes.toString('utf8').split('\n');lines[map.ranges[0].approvedProposalSourceStartLine-1]+=' changed';const selected=Buffer.from(lines.join('\n'));row.sha256=value.proposal.sha256=sha(selected);overrides.set(row.storagePath,selected);
  },/INSERTION_RANGE_BYTES|INSERTION_CURRENT_RANGE/);
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'source-history-legacy-'));
  const git=(...args)=>cp.execFileSync('git',args,{cwd:directory,encoding:'utf8'}).trim();
  try{
    git('init','--quiet','--initial-branch=main');git('remote','add','origin','.');fs.mkdirSync(path.join(directory,'specification'));
    const base=Buffer.from('base one\nbase two\n'),current=Buffer.from('base one\napproved insertion\nbase two\n');fs.writeFileSync(path.join(directory,specificationPath),base);
    git('add','.');git('-c','user.name=Source history fixture','-c','user.email=fixture@localhost','commit','--quiet','-m','Pinned legacy source');const sourceCommit=git('rev-parse','HEAD');
    fs.writeFileSync(path.join(directory,'descendant.txt'),'descendant');git('add','.');git('-c','user.name=Source history fixture','-c','user.email=fixture@localhost','commit','--quiet','-m','Fixture descendant');
    const amendment={approval:true,startLine:2,lineCount:1,textSha256:sha(Buffer.from('approved insertion\n')),baseSpecificationSha256:sha(base)},declaration={approvedAmendments:[amendment]};
    const write=value=>fs.writeFileSync(path.join(directory,'specification/requirement-evidence-bindings.json'),JSON.stringify(value));write(declaration);
    const legacyArgs={cwd:directory,sourceCommit,sourceBytes:current,specificationPath,ci:true};
    assert.equal((await verifySpecificationSourceCommit(legacyArgs)).basis,'APPROVED_PINNED_BASE_RECONSTRUCTION');cases.push('actual-legacy-git-base-reconstruction');
    for(const [name,change,pattern]of [
      ['legacy-missing-approval',value=>delete value.approvedAmendments[0].approval,/Approved source amendment bytes differ/],
      ['legacy-byte-mismatch',value=>value.approvedAmendments[0].textSha256='0'.repeat(64),/Approved source amendment bytes differ/],
      ['legacy-overlap',value=>value.approvedAmendments.push(structuredClone(value.approvedAmendments[0])),/Approved source amendments overlap/],
      ['legacy-unrelated-base',value=>value.approvedAmendments[0].baseSpecificationSha256='0'.repeat(64),/changes unrelated controlling text/]
    ]){const value=structuredClone(declaration);change(value);write(value);await assert.rejects(()=>verifySpecificationSourceCommit(legacyArgs),pattern,name);cases.push(name);}
    write(declaration);await assert.rejects(()=>verifySpecificationSourceCommit({...legacyArgs,sourceBytes:Buffer.from('different\napproved insertion\nbase two\n')}),/changes unrelated controlling text/);cases.push('legacy-unrelated-current-text');
    const unrelated=cp.execFileSync('git',['-c','user.name=Source history fixture','-c','user.email=fixture@localhost','commit-tree',git('rev-parse','HEAD^{tree}')],{cwd:directory,input:'Unrelated source root\n',encoding:'utf8'}).trim();
    await assert.rejects(()=>verifySpecificationSourceCommit({...legacyArgs,sourceCommit:unrelated}),/not reachable/);cases.push('nonancestor-source-refused');
    assert.equal((await verifySpecificationSourceCommit({...legacyArgs,sourceBytes:base})).basis,'EXACT_CURRENT_SPECIFICATION_BYTES');cases.push('exact-git-source-byte-control');
    git('remote','remove','origin');await assert.rejects(()=>verifySpecificationSourceCommit(legacyArgs),/Unable to fetch complete canonical main history/);cases.push('history-fetch-failure-refused');
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
  return {result:'PASS',cases,scope:'Actual pinned insertion source-byte proof and disposable legacy Git ancestry/approval/reconstruction controls; no semantic or application acceptance claim.'};
}
if(process.argv[1]?.endsWith('/test-specification-source-history.mjs'))console.log(JSON.stringify(await verifySpecificationSourceHistoryRegressions()));
