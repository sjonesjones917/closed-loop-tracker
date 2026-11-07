import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {isDeepStrictEqual} from 'node:util';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {browserVerificationCatalog} from './verification-evidence-catalog.mjs';
import {requireBrowserScope} from './verification-evidence.mjs';
import {runVerifier} from './verify-conformance-regressions.mjs';

// Exercise the actual population/manifest gate with explicitly synthetic
// receipt-validation dependencies. The existing receipt owner independently
// checks complete producer reports. These controls issue no eligible receipt.
export async function verifyBrowserEvidenceInventory(){
  const source=fs.readFileSync(new URL('./verification-evidence.mjs',import.meta.url),'utf8');
  const start='export function requireBrowserScope(',end='export function aggregateExecutedEvidence(';
  assert.equal(source.split(start).length,2);assert.equal(source.split(end).length,2);
  const body=source.slice(source.indexOf(start),source.indexOf(end)).replace('export function','function');
  const suites=Object.keys(browserVerificationCatalog),journey='verify-complete-operator-journey.mjs',calls=[];
  assert.equal(suites.length,7);
  const fingerprint={sourceCommit:'a'.repeat(40),sourceTree:'b'.repeat(40),sourceInputsSha256:'c'.repeat(64)};
  const manifest={sourceCommit:fingerprint.sourceCommit,workflowRunIdentity:'11',workflowFileSha256:'d'.repeat(64),buildIdentity:'build-sha256-'+'e'.repeat(64),runtimeResources:[{path:'index.html',digest:'f'.repeat(64),byteSize:9}],manifestDigest:{digest:'1'.repeat(64)}};
  const error=message=>new Error('BROWSER_INVENTORY_CONTROL: '+message);
  const context=vm.createContext({
    browserVerificationCatalog:Object.fromEntries(suites.map(suite=>[suite,{}])),
    isDeepStrictEqual,
    requireEvidence(condition,message){if(!condition)throw error(message);},
    validateExecutionReceipt(receipt,suite,current){
      calls.push(suite);
      if(receipt.suite!==suite||receipt.complete!==true||receipt.outcome!=='PASS'||receipt.identity!==current.sourceInputsSha256)throw error('delegated receipt refusal');
      return receipt;
    }
  });
  vm.runInContext(body+'\nglobalThis.testRequireBrowserScope=requireBrowserScope;',context);
  const gate=context.testRequireBrowserScope,cases=[];
  const fixture=(scope='LOCAL')=>new Map(suites.map(suite=>['browser/'+scope+'/'+suite,{suite,complete:true,outcome:'PASS',identity:fingerprint.sourceInputsSha256,browser:{scope,manifest:structuredClone(manifest)}}]));
  const check=(receipts,options={})=>gate(receipts,fingerprint,{scope:'LOCAL',manifest,...options});
  for(const scope of ['LOCAL','DEPLOYED']){
    calls.length=0;assert.equal(check(fixture(scope),{scope}).receiptCount,7);
    assert.deepEqual(calls,suites);cases.push(scope+'-complete-and-every-validator-called');
  }
  const short=suites.filter(suite=>suite!==journey);
  assert.equal(check(fixture(),{suites:short}).receiptCount,6);
  assert.equal(check(fixture(),{suites:[journey]}).receiptCount,1);
  const shortOnly=fixture();shortOnly.delete('browser/LOCAL/'+journey);
  assert.equal(check(shortOnly,{suites:short}).receiptCount,6);
  const journeyOnly=new Map([['browser/LOCAL/'+journey,fixture().get('browser/LOCAL/'+journey)]]);
  assert.equal(check(journeyOnly,{suites:[journey]}).receiptCount,1);
  cases.push('six-short-and-one-journey-joins');
  for(const suite of suites){
    const missing=fixture();missing.delete('browser/LOCAL/'+suite);
    assert.throws(()=>check(missing),/missing required LOCAL browser receipt/);
    cases.push('missing:'+suite);
  }
  for(const [name,mutate,expected]of [
    ['failed',receipt=>{receipt.outcome='FAIL';},/delegated receipt refusal/],
    ['incomplete',receipt=>{receipt.complete=false;},/delegated receipt refusal/],
    ['stale-source',receipt=>{receipt.identity='0'.repeat(64);},/delegated receipt refusal/],
    ['wrong-scope',receipt=>{receipt.browser.scope='DEPLOYED';},/different scope/],
    ['changed-runtime',receipt=>{receipt.browser.manifest.runtimeResources[0].digest='0'.repeat(64);},/different built runtime graph/],
    ['changed-workflow',receipt=>{receipt.browser.manifest.workflowFileSha256='0'.repeat(64);},/different built runtime graph/],
    ['mixed-manifests',receipt=>{receipt.browser.manifest.workflowRunIdentity='12';},/different retained manifests/],
    ['different-current-manifest',receipt=>{receipt.browser.manifest.manifestDigest.digest='2'.repeat(64);},/different current manifest/]
  ]){
    const rows=fixture(),key='browser/LOCAL/'+suites[name==='mixed-manifests'?1:0];
    mutate(rows.get(key));assert.throws(()=>check(rows),expected);cases.push(name);
  }
  for(const selected of [[],[journey,journey],['unknown.mjs'],short.slice(1)])assert.throws(()=>check(fixture(),{suites:selected}),/selection is invalid|population is incomplete/);
  assert.throws(()=>check(fixture(),{scope:'UNKNOWN'}),/scope is invalid/);
  assert.throws(()=>check(fixture(),{manifest:{...manifest,sourceCommit:'9'.repeat(40)}}),/site is not the current candidate/);
  cases.push('current-candidate-manifest-required');
  const oldCommit='2'.repeat(40),oldDigest='3'.repeat(64),promoted=fixture();
  for(const receipt of promoted.values()){
    receipt.browser.manifest.sourceCommit=oldCommit;receipt.browser.manifest.workflowRunIdentity='8';receipt.browser.manifest.manifestDigest.digest=oldDigest;
    receipt.promotion={sourceCommit:fingerprint.sourceCommit,sourceTree:fingerprint.sourceTree,verifiedSourceCommit:oldCommit,verifiedRunId:'8',verifiedRunAttempt:2};
  }
  assert.equal(check(promoted).receiptCount,7);cases.push('authenticated-promotion-runtime-preserved');
  for(const field of ['sourceCommit','sourceTree','verifiedSourceCommit','verifiedRunId','verifiedRunAttempt']){
    const changed=structuredClone(promoted);delete changed.get('browser/LOCAL/'+journey).promotion[field];
    assert.throws(()=>check(changed),/authenticated same-tree promotion/);cases.push('promotion-missing:'+field);
  }
  for(const attempt of [0,-1,1.5,'2']){
    const changed=structuredClone(promoted);
    changed.get('browser/LOCAL/'+journey).promotion.verifiedRunAttempt=attempt;
    assert.throws(()=>check(changed),/authenticated same-tree promotion/);
  }
  const deployedPromotion=new Map([...promoted].map(([key,receipt])=>{
    const changed=structuredClone(receipt);changed.browser.scope='DEPLOYED';
    return [key.replace('/LOCAL/','/DEPLOYED/'),changed];
  }));
  assert.throws(()=>check(deployedPromotion,{scope:'DEPLOYED'}),/different current manifest/);
  cases.push('invalid-promotion-attempts-and-deployed-promotion-refused');
  // The actual imported helper must delegate to the actual receipt validator.
  assert.throws(()=>requireBrowserScope(fixture(),fingerprint,{scope:'LOCAL',manifest}),/receipt schema\/producer mismatch/);
  cases.push('real-validator-delegation');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'browser-inventory-'));
  try{
    const root=fileURLToPath(new URL('.',import.meta.url)),site=path.join(directory,'site');
    execFileSync(process.execPath,[path.join(root,'build-static-site.mjs'),'--out',site,'--source-commit',execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()],{cwd:root,timeout:30000,maxBuffer:4*1024*1024});
    for(const args of [
      ['--require-browser-scope=LOCAL'],
      ['--require-browser-scope=LOCAL','--run-missing'],
      ['--require-browser-scope=LOCAL','--require-browser-scope=LOCAL'],
      ['--require-browser-scope='],
      ['--require-browser-scope'],
      ['--exclude-browser-suite'],
      ['--browser-suite-only'],
      ['--require-browser-scope=DEPLOYED','--browser-suite=verify-browser.mjs'],
      ['--require-browser-scope=LOCAL','--browser-suite-only=unknown.mjs'],
      ['--require-browser-scope=LOCAL','--exclude-browser-suite='+journey,'--browser-suite-only='+journey]
    ]){
      const run=await runVerifier(process.execPath,[path.join(root,'collect-verification-evidence.mjs'),...args],{cwd:root,timeout:30000,maxBuffer:1024*1024,evidenceDirectory:path.join(directory,'children'),env:{...process.env,STATIC_SITE_ROOT:site,CLOSED_LOOP_VERIFICATION_RECEIPTS:path.join(directory,'empty')}});
      assert.equal(run.status,1);assert.equal(run.signal,null);assert.match(run.stderr,/EXECUTED_EVIDENCE_ORACLE: (missing required LOCAL browser receipt|incompatible required browser arguments|unsupported required browser subset)/);
    }
    cases.push('actual-cli-missing-proof-and-argument-rejection');
    assert.equal(fs.existsSync(path.join(directory,'empty','evidence.json')),false);
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
  return {browserEvidenceInventory:'PASS',synthetic:true,actualBrowser:false,applicationExecuted:false,eligibleReceiptCreated:false,requiredPopulation:7,cases};
}
