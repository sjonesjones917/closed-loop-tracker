import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {executeGate,CREATION_MATRIX_TIMEOUT_MS} from './verify-conformance-regressions.mjs';

const cases=[
 {id:'primary-capability-test-identifier',file:'app-core.js',env:'APP_SOURCE',suite:'verify-verification-routing.mjs',oracle:'CAPABILITY_GUIDANCE_ORACLE',before:'${esc(labels.get(test.testId))}',after:'${esc(test.testId)}'},
 {id:'primary-capability-review-identifier',file:'app-core.js',env:'APP_SOURCE',suite:'verify-verification-routing.mjs',oracle:'CAPABILITY_REVIEW_ORACLE',before:'${esc(labels.get(draft.report.request.testId))}',after:'${esc(draft.report.request.testId)}'},
 {id:'primary-capability-evidence-open',file:'app-core.js',env:'APP_SOURCE',suite:'verify-verification-routing.mjs',oracle:'CAPABILITY_DISCLOSURE_ORACLE',before:"details('Readiness evidence and action boundaries',draft.report)",after:"details('Readiness evidence and action boundaries',draft.report,true)"},
 {id:'duplicated-instruction-preview',file:'app-core.js',env:'APP_SOURCE',suite:'verify-file-first-operator.mjs',oracle:'INSTRUCTION_ONCE_ORACLE',before:'${esc(prompt.slice(0,DATA_VIEW_LIMITS.promptCharacters))}',after:'${esc(prompt.slice(0,DATA_VIEW_LIMITS.promptCharacters))}\n${esc(prompt.slice(0,DATA_VIEW_LIMITS.promptCharacters))}'},
 {id:'instruction-repeated-outside-preview',file:'app-core.js',env:'APP_SOURCE',suite:'verify-file-first-operator.mjs',oracle:'INSTRUCTION_ONCE_ORACLE',before:'<div class="prompt-toolbar">',after:'<pre>${esc(prompt.slice(0,DATA_VIEW_LIMITS.promptCharacters))}</pre><div class="prompt-toolbar">'},
 {id:'repeated-stage-package-control',file:'app-core.js',env:'APP_SOURCE',suite:'verify-primary-guidance.mjs',oracle:'STAGE_HANDOFF_SINGLE_CONTROL_ORACLE',before:'${stagePurposeMarkup(n)}',after:'${stagePurposeMarkup(n)}<button id="download-execution-package" type="button">Download verification package</button>'},
 {id:'superseded-artifact-handoff-control',file:'app-core.js',env:'APP_SOURCE',suite:'verify-file-first-operator.mjs',oracle:'STAGE_HANDOFF_NO_SEPARATE_ARTIFACT_CONTROLS',before:'${testExecutionGuidanceMarkup(n)}',after:'${testExecutionGuidanceMarkup(n)}<button data-download-artifact="INJECTED-ARTIFACT" type="button">Download separate file</button>'},
 {id:'first-instruction-falsely-regenerated',file:'app-core.js',env:'APP_SOURCE',suite:'verify-file-first-operator.mjs',oracle:'INSTRUCTION_STATE_ORACLE',before:'This exact saved instruction is the controlling request. Its identity and strict response contract are embedded below.',after:'Regenerated and saved for the remaining work. This exact saved instruction is ready to export.'},
 {id:'regenerated-instruction-unannounced',file:'app-core.js',env:'APP_SOURCE',suite:'verify-file-first-operator.mjs',oracle:'INSTRUCTION_STATE_ORACLE',before:'Regenerated and saved for the remaining work. This exact saved instruction is ready to export.',after:'This exact saved instruction is ready to export.'},
 {id:'one-stage-action-downloads-twice',file:'app-core.js',env:'APP_SOURCE',suite:'verify-product-reservation-persistence.mjs',oracle:'ONE_FILE_HANDOFF_ORACLE',before:'downloadBlob(pkg.blob,pkg.filename);',after:'downloadBlob(pkg.blob,pkg.filename);downloadBlob(pkg.blob,pkg.filename);'},
 {id:'unallocated-artifact-promotion',file:'workflow-engine.js',env:'ENGINE_SOURCE',suite:'verify-file-allocation-boundaries.mjs',oracle:'ARTIFACT_PROMOTION_AUTHORITY_ORACLE',before:'function assertArtifactAllocation(project,artifactId){',after:'function assertArtifactAllocation(project,artifactId){return true;'},
 {id:'changed-bytes-under-retained-identity',file:'workflow-engine.js',env:'ENGINE_SOURCE',suite:'verify-file-allocation-boundaries.mjs',oracle:'ARTIFACT_RETRY_CONTENT_ORACLE',before:"if(String(recordValue(existing,'FILENAME'))!==String(filename)",after:"if(false&&String(recordValue(existing,'FILENAME'))!==String(filename)",mutate:source=>source.replace(/    if\(String\(recordValue\(existing,'FILENAME'\)\)[^\n]+ARTIFACT_IDENTITY_CONFLICT'\);/,"    // Injected violation: changed content accepted under a retained identity.")},
 {id:'missing-copied-file-commit',file:'project-store.js',env:'PROJECT_STORE_SOURCE',suite:'verify-copy-transaction.mjs',oracle:'COPY_FILE_CUSTODY_ORACLE',before:'      files.put(copied);',after:'      // Injected violation: omit copied bytes.'},
 {id:'missing-external-copy-receipt',file:'project-store.js',env:'PROJECT_STORE_SOURCE',suite:'verify-copy-transaction.mjs',oracle:'COPY_RECEIPT_ORACLE',before:'    meta.put({key:creation.receiptKey,value:creation.receipt,updatedAt:now()});',after:'    // Injected violation: omit the completed clone receipt.'},
 {id:'inconsistent-copy-source-identity',file:'project-store.js',env:'PROJECT_STORE_SOURCE',suite:'verify-copy-transaction.mjs',oracle:'COPY_SOURCE_IDENTITY_ORACLE: filename',before:'function sameCopiedFileIdentity(actual,expected){',after:'function sameCopiedFileIdentity(actual,expected){return Boolean(actual&&expected);'},
 {id:'copy-source-changed-before-commit',file:'project-store.js',env:'PROJECT_STORE_SOURCE',suite:'verify-copy-transaction.mjs',oracle:'COPY_COMMIT_IDENTITY_ORACLE',before:'if(!sameCopiedFileIdentity(sourceFile,{...mapping,artifactId:mapping.sourceArtifactId})||sourceFile.jobId!==source.jobId||!sameCopiedFileIdentity(copied,mapping)||copied.jobId!==id||await request(files.get(mapping.artifactId)))',after:'if(!sourceFile||!copied||await request(files.get(mapping.artifactId)))'},
 {id:'premature-external-product-observation',file:'workflow-engine.js',env:'ENGINE_SOURCE',suite:'verify-product-reservation-persistence.mjs',oracle:'PRODUCT_RESERVATION_OWNERSHIP_ORACLE',before:"GENERATED_ARTIFACT_INVENTORY:[],STATUS:'RESERVED'}",after:"GENERATED_ARTIFACT_INVENTORY:[],BASELINE_MATERIALS:'Invented external observation',STATUS:'RESERVED'}"},
 {id:'reserved-target-treated-as-accepted-input',file:'app-core.js',env:'APP_SOURCE',suite:'verify-product-reservation-persistence.mjs',oracle:'HANDOFF_COMMITTED_CURRENT_ORACLE',before:'try{engine.assertOperationScope(current,n,record.operation,record.scope);return true;}',after:'try{const expected=globalThis.closedLoopPromptEngine.scopeFor(n,current,options.scope||{},options.operation);if(Object.entries(expected).some(([key,value])=>String(record.scope?.[key]??"")!==String(value??"")))return false;engine.assertOperationScope(current,n,record.operation,record.scope);return true;}'},
 {id:'reserved-target-validation-skipped',file:'app-core.js',env:'APP_SOURCE',suite:'verify-product-reservation-persistence.mjs',oracle:'HANDOFF_TARGET_VALIDITY_ORACLE',before:'try{engine.assertOperationScope(current,n,record.operation,record.scope);return true;}',after:'try{return true;}'},
 {id:'primary-project-identifier',file:'app-core.js',env:'APP_SOURCE',suite:'verify-primary-information.mjs',oracle:'PRIMARY_INFORMATION_ORACLE',before:"$('#current-project-summary').textContent=projectDisplayName(current);",after:"$('#current-project-summary').textContent=projectDisplayName(current)+' '+current.job.JOB_ID;"},
 {id:'primary-error-diagnostic',file:'app-core.js',env:'APP_SOURCE',suite:'verify-primary-error-information.mjs',oracle:'PRIMARY_ERROR_INFORMATION_ORACLE',before:'report.textContent=message.slice(0,4096);',after:'report.textContent=diagnostic.slice(0,4096);'},
 {id:'primary-action-identifier',file:'app-core.js',env:'APP_SOURCE',suite:'verify-primary-guidance.mjs',oracle:'PRIMARY_GUIDANCE_ORACLE',before:'return esc(readable)+(readable===text?',after:'return esc(text)+(readable===text?'}
];
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'creation-presentation-faults-')),results=[];
// Every child is independently bounded. The shared supervisor captures streams
// as they arrive, terminates descendants, and never treats TIMEOUT as rejection.
const childTimeoutMs=Math.min(10*60*1000,Number(process.env.CREATION_FAULT_CHILD_TIMEOUT_MS)||10*60*1000);
assert.ok(Number.isFinite(childTimeoutMs)&&childTimeoutMs>0,'A finite child deadline is required.');
const evidenceDirectory=path.resolve(process.env.CREATION_FAULT_EVIDENCE_DIRECTORY||'conformance-regression-evidence/creation-presentation-faults');
const controller=new AbortController(),onTerm=()=>controller.abort('SIGTERM'),onInt=()=>controller.abort('SIGINT');
process.on('SIGTERM',onTerm);process.on('SIGINT',onInt);
const aggregateDeadline=setTimeout(()=>controller.abort('AGGREGATE_TIMEOUT'),CREATION_MATRIX_TIMEOUT_MS);
const report={synthetic:true,actualBrowser:false,expected:'Each deliberate ownership, identity, custody, receipt, or information-display violation is caught by its behavioral oracle; original sources pass afterward.',results,pending:cases.map(item=>item.id),running:null,complete:false,outcome:'RUNNING'};
const persist=()=>{fs.mkdirSync(evidenceDirectory,{recursive:true});const file=path.join(evidenceDirectory,'report.json'),temporary=file+'.partial';fs.writeFileSync(temporary,JSON.stringify(report,null,2)+'\n');fs.renameSync(temporary,file);};
const run=async(name,suite,env={})=>{
 report.running={name,suite,startedAt:new Date().toISOString()};persist();
 process.stderr.write(JSON.stringify({phase:'START',...report.running})+'\n');
 const observed=await executeGate({name,args:[suite]},{directory:evidenceDirectory,env,signal:controller.signal,timeoutMs:childTimeoutMs,requireJson:false});
 process.stderr.write(JSON.stringify({phase:'FINISH',name,suite,outcome:observed.outcome,exitCode:observed.exitCode,signal:observed.signal})+'\n');
 return observed;
};
persist();
try{
 for(const item of cases){
  const source=fs.readFileSync(item.file,'utf8');assert.ok(source.includes(item.before),'Fault anchor is absent: '+item.id);
  const changed=item.mutate?item.mutate(source):source.replace(item.before,item.after);assert.notEqual(changed,source,'Fault was not injected: '+item.id);
  const temporary=path.join(directory,item.id+'.js');fs.writeFileSync(temporary,changed);
  const observed=await run(item.id,item.suite,{[item.env]:temporary});
  const detected=observed.outcome==='FAIL'&&observed.exitCode===1&&!observed.signal&&!observed.error&&!observed.reason&&(observed.stdout+observed.stderr).includes(item.oracle);
  results.push({id:item.id,expectedOracle:item.oracle,detected,...observed});report.pending.shift();report.running=null;persist();
  assert.ok(detected,'Fault escaped or failed for an unrelated reason: '+item.id+'\n'+observed.stdout+'\n'+observed.stderr);
 }
 report.pending=[...new Set(cases.map(item=>item.suite))];persist();
 for(const suite of [...report.pending]){
  const observed=await run('restored-'+path.basename(suite),suite);results.push({restoredSuite:suite,...observed});report.pending.shift();report.running=null;persist();
  assert.equal(observed.outcome,'PASS','Restored source failed: '+suite+'\n'+observed.stdout+'\n'+observed.stderr);
 }
 report.complete=true;report.outcome='PASS';
}catch(error){
 report.outcome=controller.signal.reason==='AGGREGATE_TIMEOUT'||results.some(row=>row.outcome==='TIMEOUT')?'TIMEOUT':'FAIL';
 report.failure=String(error.stack||error);process.stderr.write(report.failure+'\n');process.exitCode=report.outcome==='TIMEOUT'?124:1;
}finally{
 clearTimeout(aggregateDeadline);
 process.removeListener('SIGTERM',onTerm);process.removeListener('SIGINT',onInt);
 fs.rmSync(directory,{recursive:true,force:true});persist();
 console.log(JSON.stringify(report,null,2));
}
