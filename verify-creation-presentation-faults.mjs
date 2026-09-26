import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const cases=[
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
const run=(suite,env={})=>{const child=spawnSync(process.execPath,[suite],{env:{...process.env,...env},encoding:'utf8',maxBuffer:64*1024*1024});return {command:['node',suite],exitCode:child.status,signal:child.signal,stdout:child.stdout||'',stderr:child.stderr||''};};
try{
 for(const item of cases){
  const source=fs.readFileSync(item.file,'utf8');assert.ok(source.includes(item.before),'Fault anchor is absent: '+item.id);
  const changed=item.mutate?item.mutate(source):source.replace(item.before,item.after);assert.notEqual(changed,source,'Fault was not injected: '+item.id);
  const temporary=path.join(directory,item.id+'.js');fs.writeFileSync(temporary,changed);
  const observed=run(item.suite,{[item.env]:temporary});
  const detected=observed.exitCode!==0&&(observed.stdout+observed.stderr).includes(item.oracle);
  results.push({id:item.id,expectedOracle:item.oracle,detected,...observed});
  assert.ok(detected,'Fault escaped or failed for an unrelated reason: '+item.id+'\n'+observed.stdout+'\n'+observed.stderr);
 }
 for(const suite of [...new Set(cases.map(item=>item.suite))]){
  const observed=run(suite);results.push({restoredSuite:suite,...observed});assert.equal(observed.exitCode,0,'Restored source failed: '+suite+'\n'+observed.stdout+'\n'+observed.stderr);
 }
}finally{
 fs.rmSync(directory,{recursive:true,force:true});
 console.log(JSON.stringify({synthetic:true,actualBrowser:false,expected:'Each deliberate ownership, identity, custody, receipt, or information-display violation is caught by its behavioral oracle; original sources pass afterward.',results},null,2));
}
