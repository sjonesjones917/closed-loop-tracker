import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {runVerifier} from './verify-conformance-regressions.mjs';

const journey='verify-complete-operator-journey.mjs',journeyMs=240*60*1000,ordinaryMs=10*60*1000;
const ordinary=['verify-browser.mjs','verify-browser-extra.mjs','verify-human-stage-walkthrough.mjs','verify-mobile-stage-action.mjs','verify-mobile-capability-journey.mjs','verify-browser-recovery.mjs'];
const dispatch='const result=await runVerifier(',option='timeout:definition.timeoutMs';
const oracle='BROWSER_PRODUCER_BUDGET_ORACLE';

// Import the complete current collector, redirecting only its relative imports
// and its one browser-child dispatch in a disposable module. The dispatch
// observer throws before Chromium can start. Site validation, catalog lookup,
// fingerprinting, argument construction and all earlier checks remain real.
// This is supervision evidence, never browser/application/receipt evidence.
export async function verifyBrowserProducerBudgets(){
 const sourceRoot=fileURLToPath(new URL('.',import.meta.url)),source=fs.readFileSync(new URL('./collect-verification-evidence.mjs',import.meta.url),'utf8');
 const workflow=fs.readFileSync(new URL('./.github/workflows/pages.yml',import.meta.url),'utf8');
 function assertWorkflowBudgets(text){
  const budgets=[...text.matchAll(/run_browser_verifier verify-complete-operator-journey\.mjs (\d+)m/g)].map(match=>Number(match[1])*60000);
  assert.deepEqual(budgets,[journeyMs,journeyMs,journeyMs],oracle+': candidate, deployed and manual journey budgets');
 }
 assertWorkflowBudgets(workflow);
 for(const replacement of ['120m','300m'])assert.throws(()=>assertWorkflowBudgets(workflow.replace('verify-complete-operator-journey.mjs 240m','verify-complete-operator-journey.mjs '+replacement)),error=>error.code==='ERR_ASSERTION'&&error.message.includes(oracle));
 assert.equal(source.split(dispatch).length,2,oracle+': unique current dispatch');
 assert.equal(source.split(option).length,2,oracle+': unique catalog budget forwarding');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'browser-producer-budgets-')),site=path.join(directory,'site'),cases=[];
 try{
  execFileSync(process.execPath,[path.join(sourceRoot,'build-static-site.mjs'),'--out',site,'--source-commit',execFileSync('git',['rev-parse','HEAD'],{cwd:sourceRoot,encoding:'utf8',timeout:30000}).trim()],{cwd:sourceRoot,timeout:30000,maxBuffer:4*1024*1024});
  let sequence=0;
  async function observer(text){
   const file=path.join(directory,'collector-'+(++sequence)+'.mjs');
   const imports=text.replace(/(from\s*|import\()(['"])\.\/([^'"]+)\2/g,(_match,prefix,_quote,name)=>prefix+JSON.stringify(new URL(name,new URL('.',import.meta.url)).href));
   fs.writeFileSync(file,imports.replace(dispatch,'const result=await observeBrowserDispatch(')+'\nfunction observeBrowserDispatch(command,args,options){throw Object.assign(new Error("BROWSER_BUDGET_DISPATCH_OBSERVED"),{code:"BROWSER_BUDGET_DISPATCH_OBSERVED",observed:{command,args,options}});}\n');
   return (await import(pathToFileURL(file).href)).executeBrowserEvidenceProducer;
  }
  async function observe(producer,suite,scope,expected){
   const receipts=path.join(directory,'receipts-'+(++sequence));let observed;
   await assert.rejects(()=>producer(suite,{scope,cwd:sourceRoot,directory:receipts,environment:{STATIC_SITE_ROOT:site}}),error=>{if(error.code!=='BROWSER_BUDGET_DISPATCH_OBSERVED')return false;observed=error.observed;return true;});
   assert.equal(observed.command,process.execPath,oracle+': original runtime');
   assert.deepEqual(observed.args,[path.join(sourceRoot,suite)],oracle+': complete default producer');
   assert.equal(observed.options.timeout,expected,oracle+': '+suite+' '+scope);
   assert.equal(observed.options.env.CLOSED_LOOP_BROWSER_SCOPE,scope,oracle+': original scope');
   assert.equal(fs.existsSync(path.join(receipts,'browser',scope,suite+'.json')),false,oracle+': observer cannot issue browser receipt');
   return observed.options.timeout;
  }
  const current=await observer(source);
  for(const [suite,scope]of [[journey,'LOCAL'],[journey,'DEPLOYED'],...ordinary.map(suite=>[suite,'LOCAL'])]){
   const timeout=await observe(current,suite,scope,suite===journey?journeyMs:ordinaryMs);
   cases.push({suite,scope,timeoutMs:timeout,result:'PASS'});
  }
  // The real supervisor must retain the observed deadline; these children exit
  // immediately and cannot exercise or satisfy any application assertion.
  for(const timeout of [cases[0].timeoutMs,cases[2].timeoutMs]){
   const result=await runVerifier(process.execPath,['-e','process.stdout.write("budget-control")'],{timeout,evidenceDirectory:path.join(directory,'runner')});
   assert.equal(result.outcome,'PASS',oracle+': real supervisor child');
   assert.equal(result.stdout,'budget-control',oracle+': exact child');
   assert.equal(result.timeoutMs,timeout,oracle+': real supervisor deadline');
  }
  const faults=[];
  for(const [name,replacement]of [['former120m','timeout:120*60*1000'],['dropped-forwarding','timeout:undefined']]){
   const altered=await observer(source.replace(option,replacement));
   await assert.rejects(()=>observe(altered,journey,'LOCAL',journeyMs),error=>error.code==='ERR_ASSERTION'&&error.message.includes(oracle));
   faults.push({fault:name,result:'DETECTED'});
  }
  return {browserProducerBudgets:'PASS',synthetic:true,actualBrowser:false,applicationExecuted:false,eligibleReceiptCreated:false,workflowInvocations:3,cases,supervisedBudgetsMs:[journeyMs,ordinaryMs],faults};
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
}
