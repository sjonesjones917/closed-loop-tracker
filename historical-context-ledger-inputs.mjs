// DRAFT ONLY: exact historical tuple transport. No current proof or default-suite receipt.
// All dependencies resolve from the fixture-local source closure.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {readHistoricalNormativeFixtureInputs} from './historical-normative-fixture-inputs.mjs';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const sourcePath='specification/closed-loop-reliability-controlling-implementation-specification.txt';
const normativePath='specification/closed-loop-normative-requirements.json';
const contextCapsuleFile=fileURLToPath(new URL('./verification/historical-context-assertion-inputs-7df-20261015.json.gz',import.meta.url));
const contextSourceSha256='95a6a8b1f8857b35c47cb44874aee2bbada1ccfd2ee7aa9033d92fb39c8bda9d';
export function readHistoricalContextAssertionInputs(sourceRoot){
  const root=sourceRoot;
  const packed=fs.readFileSync(contextCapsuleFile);
  assert.equal(packed.length,283340,'HISTORICAL_CONTEXT_CAPSULE_SIZE_ORACLE');
  assert.equal(sha(packed),'142804bf1dfb2f1b0b687ee09b59272b50fec76d96de0cf1e4947786b79d40b6','HISTORICAL_CONTEXT_CAPSULE_DIGEST_ORACLE');
  const raw=gunzipSync(packed,{maxOutputLength:1359165});assert.equal(raw.length,1359165,'HISTORICAL_CONTEXT_DECODED_SIZE_ORACLE');
  const capsule=JSON.parse(raw),expected=[
    ['verification-assertion-bindings.json',754577,'56fda01d13a0d911648fe3ddc31bab50348853791f0b20c9e19e61ff6fd3e70a'],
    ['specification/closed-loop-specification-manifest.json',264450,'651e71dffee949524793d50195d4958a777dc7392cb31f40b5975079a846b258']
  ];
  assert.deepEqual(Object.keys(capsule).sort(),['members','schema','sourceCommit']);
  assert.equal(capsule.schema,'closed-loop-historical-context-assertion-inputs/1');
  assert.equal(capsule.sourceCommit,'7df5f46e9a7e54da09622387a978badb39916c09');assert.equal(capsule.members.length,expected.length);
  const inputs=new Map();
  for(const [index,[file,size,digest]]of expected.entries()){
    const member=capsule.members[index];assert.deepEqual(Object.keys(member).sort(),['base64','byteLength','path','sha256']);
    assert.equal(member.path,file);assert.equal(member.byteLength,size);assert.equal(member.sha256,digest);
    assert.equal(typeof member.base64,'string');assert.equal(member.base64.length,4*Math.ceil(size/3));
    const bytes=Buffer.from(member.base64,'base64');assert.equal(bytes.toString('base64'),member.base64);assert.equal(bytes.length,size);assert.equal(sha(bytes),digest);inputs.set(file,bytes);
  }
  const legacy=readHistoricalNormativeFixtureInputs(root);
  for(const [file,id]of [[sourcePath,'contextSource'],[normativePath,'contextManifest'],['verification/normative-context-applicability-20261005.json','contextApplicabilityReview']])inputs.set(file,legacy.get(id));
  for(const [file,storage,size,digest]of [
    ['specification/requirement-evidence-bindings.json','verification/normative-context-legacy-governance-7df5f46e.json',112646,'9c4631c86ccd2d8234f23469ffc7e11374bcda51eb4bb1f27c1f4a97ade7b72e'],
    ['verification/independent-source-review-20261005.json','verification/independent-source-review-20261005.json',526497,'7e08fd37e0885c3de089d1939ea25515a1bc933dc45aa7997e8062d68ac845bb'],
    ['verification/independent-source-reconciliation-20261005.json','verification/independent-source-reconciliation-20261005.json',1367233,'b2b22f137623d5916a025d12575152a36b2b8b20daa8100db5c420e4d90f87a8'],
    ['verification/approved-deferred-compatibility-proposal-20261005.md','verification/approved-deferred-compatibility-proposal-20261005.md',20197,'06c888569c9eaca414bde1926940cf596838fc2dd12c4ff7d4295e05d27ea22f'],
    ['verification/approved-deferred-compatibility-20261005.json','verification/approved-deferred-compatibility-20261005.json',61857,'f4e7b4b0ab5a68f3049b14ea0b1056329b82688597ebced5c13e97be4d0f5e9a'],
    ['specification/recovery-amendment-20260914.txt','specification/recovery-amendment-20260914.txt',15614,'40340c453d52878d24aa00dc239ec52a2f3489a1c6989a9fc414158ae17b216f']
  ]){const bytes=fs.readFileSync(path.join(root,storage));assert.equal(bytes.length,size);assert.equal(sha(bytes),digest);inputs.set(file,bytes);}
  assert.equal(sha(inputs.get(sourcePath)),contextSourceSha256);
  const normative=JSON.parse(inputs.get(normativePath)),bindings=JSON.parse(inputs.get('verification-assertion-bindings.json'));
  assert.equal(normative.specificationSha256,contextSourceSha256);assert.equal(normative.requirements.length,4066);
  assert.equal(bindings.specificationSha256,contextSourceSha256);assert.equal(bindings.bindings.length,375);
  return inputs;
}

export function validateHistoricalLedgerClosure(directory,{commit,tree,manifest}){
  const git=(...args)=>cp.execFileSync('git',args,{cwd:directory,encoding:'utf8'}).trim();
  assert.equal(fs.realpathSync(directory),directory,'HISTORICAL_LEDGER_CLOSURE_ROOT_ORACLE');
  assert.equal(git('rev-parse','HEAD'),commit,'HISTORICAL_LEDGER_CLOSURE_COMMIT_ORACLE');assert.equal(git('rev-parse','HEAD^{tree}'),tree,'HISTORICAL_LEDGER_CLOSURE_TREE_ORACLE');
  assert.deepEqual(git('ls-files','-z').split('\0').filter(Boolean).sort(),Object.keys(manifest).sort(),'HISTORICAL_LEDGER_CLOSURE_POPULATION_ORACLE');
  assert.equal(git('ls-files','--others','-z'),'','HISTORICAL_LEDGER_CLOSURE_EXTRA_FILE_ORACLE');
  for(const [name,expected]of Object.entries(manifest)){
    assert(!path.isAbsolute(name)&&path.posix.normalize(name)===name&&!name.split('/').some(x=>x==='..'||x==='.git'),'HISTORICAL_LEDGER_CLOSURE_PATH_ORACLE');
    let target=directory;for(const part of name.split('/')){target=path.join(target,part);assert(!fs.lstatSync(target).isSymbolicLink(),'HISTORICAL_LEDGER_CLOSURE_SYMLINK_ORACLE');}
    assert(fs.lstatSync(target).isFile(),'HISTORICAL_LEDGER_CLOSURE_FILE_ORACLE');const bytes=fs.readFileSync(target);
    assert.equal(bytes.length,expected.bytes,'HISTORICAL_LEDGER_CLOSURE_SIZE_ORACLE');assert.equal(sha(bytes),expected.sha256,'HISTORICAL_LEDGER_CLOSURE_SHA_ORACLE');assert.equal(Boolean(fs.statSync(target).mode&0o111),expected.executable,'HISTORICAL_LEDGER_CLOSURE_MODE_ORACLE');
  }
  assert.equal(git('status','--porcelain'),'','HISTORICAL_LEDGER_CLOSURE_STATUS_ORACLE');return true;
}

// The caller owns the worker lifetime. This only creates/removes its disposable,
// committed tuple; it never changes the parent's process working directory.
export function createHistoricalContextLedgerFixture({sourceRoot,expectedCommit,expectedTree}={}){
  assert(path.isAbsolute(sourceRoot)&&fs.realpathSync(sourceRoot)===sourceRoot,'HISTORICAL_LEDGER_SOURCE_ROOT_ORACLE');
  const git=(...args)=>cp.execFileSync('git',args,{cwd:sourceRoot,encoding:'utf8'}).trim();
  assert(/^[a-f0-9]{40}$/.test(expectedCommit)&&/^[a-f0-9]{40}$/.test(expectedTree),'HISTORICAL_LEDGER_PARENT_IDENTITY_ORACLE');
  assert.equal(git('rev-parse','HEAD'),expectedCommit);assert.equal(git('rev-parse','HEAD^{tree}'),expectedTree);assert.equal(git('status','--porcelain'),'');
  const inputs=readHistoricalContextAssertionInputs(sourceRoot),parent=fs.mkdtempSync(path.join(os.tmpdir(),'historical-context-ledger-')),directory=path.join(parent,'source');let added=false,removed=false;
  const cleanup=()=>{
    if(removed)return;
    if(added){cp.execFileSync('git',['worktree','remove','--force',directory],{cwd:sourceRoot,stdio:'pipe'});added=false;}
    fs.rmSync(parent,{recursive:true,force:true});removed=true;
  };
  try{
    cp.execFileSync('git',['worktree','add','--detach','--quiet',directory,expectedCommit],{cwd:sourceRoot,stdio:'pipe'});added=true;
    const tracked=git('ls-files','-z').split('\0').filter(Boolean);
    // The fresh worktree already supplies the exact parent tracked closure;
    // only the eleven pinned historical logical inputs may differ.
    for(const [file,bytes]of inputs){assert(!path.isAbsolute(file)&&path.posix.normalize(file)===file&&!file.split('/').some(x=>x==='..'||x==='.git'),'HISTORICAL_LEDGER_LOGICAL_PATH_ORACLE');const target=path.join(directory,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}
    cp.execFileSync('git',['add','--all'],{cwd:directory,stdio:'pipe'});
    cp.execFileSync('git',['-c','user.name=Historical ledger fixture','-c','user.email=fixture@localhost','commit','--quiet','-m','Disposable exact 7df historical ledger tuple'],{cwd:directory,stdio:'pipe'});
    const manifest=Object.fromEntries([...new Set([...tracked,...inputs.keys()])].map(file=>{const bytes=inputs.get(file)||fs.readFileSync(path.join(sourceRoot,file));return [file,{bytes:bytes.length,sha256:sha(bytes),executable:fs.existsSync(path.join(sourceRoot,file))?Boolean(fs.statSync(path.join(sourceRoot,file)).mode&0o111):false}];}));
    const fixtureCommit=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:directory,encoding:'utf8'}).trim(),fixtureTree=cp.execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:directory,encoding:'utf8'}).trim();
    assert.equal(git('rev-parse','HEAD'),expectedCommit);assert.equal(git('rev-parse','HEAD^{tree}'),expectedTree);assert.equal(git('status','--porcelain'),'');
    const validateClosure=()=>{assert.equal(git('rev-parse','HEAD'),expectedCommit);assert.equal(git('rev-parse','HEAD^{tree}'),expectedTree);assert.equal(git('status','--porcelain'),'');return validateHistoricalLedgerClosure(directory,{commit:fixtureCommit,tree:fixtureTree,manifest});};validateClosure();
    return {directory,cleanup,validateClosure,sourceSha256:contextSourceSha256,historicalOnly:true,parentCommit:expectedCommit,parentTree:expectedTree,fixtureCommit,fixtureTree,inputPins:[...inputs].map(([file,bytes])=>({path:file,bytes:bytes.length,sha256:sha(bytes)}))};
  }catch(error){try{cleanup();}catch(cleanupError){throw new AggregateError([error,cleanupError],'Historical ledger fixture setup and cleanup failed.');}throw error;}
}
