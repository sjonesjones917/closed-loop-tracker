import {independentHumanCombinedUiFixture} from './test-human-combined-ui-evidence.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {browserVerificationCatalog} from './verification-evidence-catalog.mjs';
import {independentHumanCombinedFixture} from './test-human-combined-native-evidence.mjs';
import {observationsFromReports,assertRetainedRootNativeSourceInputs,evidenceFingerprint} from './verification-evidence.mjs';

// Independent report-shape controls only: no native execution, eligible receipt,
// real operator, worker, large-project or release-acceptance claim.
const modes=['three-view-saves-and-public-cold','same-label-root','same-label-part','changed-project-row','changed-journal','changed-history-generation','candidate-after-await','primitive-after-await','encoder-after-await','definition-after-await','prepared-state-after-validator','new-file-after-await','artifact-same-label','artifact-metadata','artifact-reference','hash-reject','timeout','late-hash-after-timeout','abort','write-failure','root-mutation-during-preparation','source-mutation-during-preparation','primitive-mutation-during-preparation'];
const names=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const main={browserVerified:true,horizontalOverflow:false,controlsWithinViewport:true,buttonSizing:true,touchTargetFloor:44,minimumUiTextPx:14,all30StagesReachable:true,reloadPersistence:true,runtimeErrors:0};
const digest=text=>createHash('sha256').update(text).digest('hex');
const fixture=()=>({
 status:'PASS',checks:modes.map(mode=>mode==='three-view-saves-and-public-cold'?{mode,readings:['Project','Workflow','Records'].map(activeView=>({activeView,id:'independent-'+activeView,counts:{restore:activeView==='Project'?1:0,digest:activeView==='Project'?1:0,static:1,derived:1,bytes:1,actualHashes:5,owner:1,publish:1}}))}:{mode,error:{code:mode==='definition-after-await'?'PROJECT_INTEGRITY_FAILED':'HISTORY_VERSION_MISMATCH',name:'Error',message:'Independent refusal fixture'},...(mode.endsWith('-during-preparation')?{}:{cleanup:{gates:0,ready:0,terminal:true,running:false}}),noCheckpointReturned:true,noProofPublished:true,exactStatePreserved:true}),
 sourceFiles:Object.fromEntries(names.map(name=>[name,{bytes:1,sha256:digest('independent original '+name),observedRuntimeSha256:digest((['hash.js','project-store.js'].includes(name)?'independent observed ':'independent original ')+name),executed:name!=='app-core.js'}])),
 fixture:{name:'test-retained-root-native.html',bytes:1,sha256:digest('independent fixture')},observerAnchors:Array.from({length:15},(_,index)=>'independent anchor '+index),requiredObserverAnchorsAllMatchedOnce:true,existingBrowserReused:true,isolatedTargetAndOrigin:true
});
export function verifyRetainedRootNativeEvidenceConsumers({directory}={}){
 assert.equal(typeof directory,'string','NATIVE_EVIDENCE_PRIVATE_DIRECTORY_ORACLE');
 const cases=[],good=fixture(),catalog=browserVerificationCatalog['verify-browser.mjs'],fullChecks=catalog.checks;
 const ownedMarkers=['browserVerified','retainedRootNative','humanCombinedNative','humanCombinedUi'],checks=fullChecks.filter(row=>ownedMarkers.includes(row.marker));
 assert.equal(checks.length,14,'NATIVE_EVIDENCE_ORIGINAL_CHECK_POPULATION_ORACLE');
 assert.equal(fullChecks.filter(row=>row.marker==='appendOnlyNative').length,1,'NATIVE_EVIDENCE_UNRELATED_APPEND_ONLY_CATALOG_ORACLE');
 // Scope only this synthetic consumer; the restored release catalogue still requires append-only native evidence.
 const withOwnedChecks=run=>{try{catalog.checks=checks;return run();}finally{catalog.checks=fullChecks;}};
 const observations=(native,reports=[{retainedRootNative:native},main])=>withOwnedChecks(()=>observationsFromReports('verify-browser.mjs',[...reports,{humanCombinedNative:independentHumanCombinedFixture()},{humanCombinedUi:independentHumanCombinedUiFixture()}],{scope:'LOCAL'}));
 const nativePass=native=>observations(native).find(row=>row.checkId==='browser.LOCAL.verify-browser.retained-root-native')?.passed;
 const detect=(caseId,run)=>{run();cases.push({caseId,result:'DETECTED'});};
 const reject=(caseId,change)=>detect(caseId,()=>{const value=structuredClone(good);change(value);assert.equal(nativePass(value),false,'NATIVE_EVIDENCE_REPORT_ORACLE: '+caseId);});
 assert.equal(nativePass(good),true,'NATIVE_EVIDENCE_REPORT_CONTROL_ORACLE');cases.push({caseId:'independent-complete-report-control',result:'PASS'});
 assert.deepEqual(checks.slice(0,9).map(row=>[row.id,row.marker,row.path,row.expected]),Object.entries(main).map(([field,expected])=>['verify-browser.'+field,'browserVerified',field,expected]),'NATIVE_EVIDENCE_MAIN_ASSERTIONS_UNCHANGED_ORACLE');
 cases.push({caseId:'all-nine-main-checks-unchanged',result:'PASS'});
 assert(catalog.sourceInputs.includes('test-retained-root-native.mjs')&&catalog.sourceInputs.includes('test-retained-root-native.html'),'NATIVE_EVIDENCE_SOURCE_DISCOVERY_ORACLE');
 cases.push({caseId:'both-native-owning-sources-declared',result:'PASS'});
 for(const scope of ['LOCAL','DEPLOYED']){
  const rows=withOwnedChecks(()=>observationsFromReports('verify-browser.mjs',[{retainedRootNative:good},main,{humanCombinedNative:independentHumanCombinedFixture()},{humanCombinedUi:independentHumanCombinedUiFixture()}],{scope}));
  assert.equal(rows.length,14);assert.deepEqual(rows.slice(0,10).map(row=>row.checkId),[...Object.keys(main).map(field=>'browser.'+scope+'.verify-browser.'+field),'browser.'+scope+'.verify-browser.retained-root-native']);assert(rows.slice(0,10).every(row=>row.passed&&row.browserScope===scope));assert.equal(rows[10].checkId,'browser.'+scope+'.verify-browser.human-combined-native');assert.equal(rows[10].passed,true);
  assert(/Worker=undefined/.test(rows[9].boundary));
  cases.push({caseId:'extra-marker-and-main-marker-'+scope,result:'PASS'});
 }
 detect('missing-native-marker',()=>assert.throws(()=>observations(good,[main]),/exactly one report marker retainedRootNative; received 0/));
 detect('duplicate-native-marker',()=>assert.throws(()=>observations(good,[{retainedRootNative:good},{retainedRootNative:good},main]),/exactly one report marker retainedRootNative; received 2/));
 detect('native-cannot-replace-main-marker',()=>assert.throws(()=>observations(good,[{retainedRootNative:good}]),/exactly one report marker browserVerified; received 0/));
 detect('partial-main-report-cannot-pass',()=>assert(observations(good,[{retainedRootNative:good},{browserVerified:true,scope:'startup-scroll'}]).some(row=>!row.passed)));
 detect('failed-main-check-not-masked',()=>assert(observations(good,[{retainedRootNative:good},{...main,runtimeErrors:1}]).some(row=>!row.passed)));
 reject('failed-native-status',value=>value.status='FAIL');
 reject('missing-case',value=>value.checks.pop());
 reject('duplicate-case',value=>value.checks[1]=structuredClone(value.checks[2]));
 reject('wrong-case',value=>value.checks[1].mode='unowned-case');
 // Check preservation by named role, rather than trusting the report order.
 const reordered=structuredClone(good);reordered.checks.reverse();assert.equal(nativePass(reordered),true);cases.push({caseId:'named-case-order-independent',result:'PASS'});
 for(const field of ['noCheckpointReturned','noProofPublished','exactStatePreserved'])reject('false-'+field,value=>value.checks[1][field]=false);
 reject('reordered-first-refusal-not-skipped',value=>{value.checks.reverse();value.checks[0].exactStatePreserved=false;});
 reject('missing-refusal-error',value=>delete value.checks[1].error);
 reject('missing-refusal-message',value=>value.checks[1].error.message='');
 reject('missing-refusal-code',value=>delete value.checks[1].error.code);
 reject('missing-abort-error-name',value=>delete value.checks.find(row=>row.mode==='abort').error.name);
 reject('wrong-current-validator-refusal',value=>value.checks.find(row=>row.mode==='definition-after-await').error.code='UNRELATED_ERROR');
 reject('wrong-preparation-refusal',value=>value.checks.at(-1).error.code='UNRELATED_ERROR');
 for(const [field,changed]of [['gates',1],['ready',1],['terminal',false],['running',true]])reject('uncleared-owner-'+field,value=>value.checks[1].cleanup[field]=changed);
 reject('missing-owner-cleanup',value=>delete value.checks[1].cleanup);
 reject('missing-view',value=>value.checks[0].readings.pop());
 reject('duplicate-view',value=>value.checks[0].readings[2]=structuredClone(value.checks[0].readings[1]));
 reject('duplicate-checkpoint-id',value=>value.checks[0].readings[2].id=value.checks[0].readings[1].id);
 reject('cold-without-materialization',value=>value.checks[0].readings[0].counts.restore=0);
 reject('cold-without-dual-digest',value=>value.checks[0].readings[0].counts.digest=0);
 for(const field of ['static','derived','actualHashes'])reject('cold-zero-'+field,value=>value.checks[0].readings[0].counts[field]=0);
 for(const [field,changed]of [['restore',1],['digest',1],['static',0],['derived',0],['bytes',0],['actualHashes',4],['owner',0],['publish',0]])reject('warm-invalid-'+field,value=>value.checks[0].readings[1].counts[field]=changed);
 reject('counter-coercion',value=>value.checks[0].readings[1].counts.bytes='1');
 reject('missing-observer-anchor',value=>value.observerAnchors.pop());
 reject('duplicate-observer-anchor',value=>value.observerAnchors[1]=value.observerAnchors[0]);
 reject('unmatched-observer',value=>value.requiredObserverAnchorsAllMatchedOnce=false);
 reject('shared-target-origin',value=>value.isolatedTargetAndOrigin=false);
 reject('new-browser-process-claim',value=>value.existingBrowserReused=false);
 reject('missing-original-source',value=>delete value.sourceFiles['hash.js']);
 reject('unexpected-original-source',value=>value.sourceFiles['test-worker.js']=structuredClone(value.sourceFiles['hash.js']));
 reject('false-app-executed',value=>value.sourceFiles['app-core.js'].executed=true);
 reject('false-store-not-executed',value=>value.sourceFiles['project-store.js'].executed=false);
 reject('malformed-original-sha',value=>value.sourceFiles['hash.js'].sha256='invalid');
 reject('unobserved-store-bytes',value=>value.sourceFiles['project-store.js'].observedRuntimeSha256=value.sourceFiles['project-store.js'].sha256);
 reject('unexpected-schema-instrumentation',value=>value.sourceFiles['workflow-schema.js'].observedRuntimeSha256=digest('unowned schema instrumentation'));
 reject('wrong-fixture-name',value=>value.fixture.name='other.html');
 reject('missing-fixture-sha',value=>delete value.fixture.sha256);
 const fingerprint={inputSha256:Object.fromEntries(names.map(name=>[name,digest('independent original '+name)]))};
 fingerprint.inputSha256['test-retained-root-native.mjs']=digest('independent module');fingerprint.inputSha256['test-retained-root-native.html']=digest('independent fixture');
 assert.equal(assertRetainedRootNativeSourceInputs(good,fingerprint),good);cases.push({caseId:'exact-original-source-fingerprint-control',result:'PASS'});
 for(const name of names)for(const kind of ['missing','wrong'])detect('fingerprint-'+kind+'-'+name,()=>{
  const changed=structuredClone(fingerprint);if(kind==='missing')delete changed.inputSha256[name];else changed.inputSha256[name]=digest('different '+name);
  assert.throws(()=>assertRetainedRootNativeSourceInputs(good,changed),/original source differs from fingerprint/);
 });
 detect('fingerprint-missing-owning-module',()=>{const changed=structuredClone(fingerprint);delete changed.inputSha256['test-retained-root-native.mjs'];assert.throws(()=>assertRetainedRootNativeSourceInputs(good,changed),/owning module missing from fingerprint/);});
 for(const kind of ['missing','wrong'])detect('fingerprint-'+kind+'-fixture',()=>{const changed=structuredClone(fingerprint);if(kind==='missing')delete changed.inputSha256['test-retained-root-native.html'];else changed.inputSha256['test-retained-root-native.html']=digest('different fixture');assert.throws(()=>assertRetainedRootNativeSourceInputs(good,changed),/fixture differs from fingerprint/);});
 detect('source-binding-missing-source',()=>{const changed=structuredClone(good);delete changed.sourceFiles['app-core.js'];assert.throws(()=>assertRetainedRootNativeSourceInputs(changed,fingerprint),/source population mismatch/);});
 detect('source-binding-extra-source',()=>{const changed=structuredClone(good);changed.sourceFiles['other.js']={};assert.throws(()=>assertRetainedRootNativeSourceInputs(changed,fingerprint),/source population mismatch/);});
 detect('source-binding-app-not-executed',()=>{const changed=structuredClone(good);changed.sourceFiles['app-core.js'].executed=true;assert.throws(()=>assertRetainedRootNativeSourceInputs(changed,fingerprint),/original source differs from fingerprint/);});
 // Execute the actual declared-path loop, omitting unrelated Git/hash work.
 // This preserves its real normalization, realpath and symlink checks.
 const source=evidenceFingerprint.toString(),start=source.indexOf('  const sourceRoot='),end=source.indexOf('  const inputs=',start);
 assert(start>=0&&end>start,'NATIVE_EVIDENCE_DECLARED_PATH_EXTRACTION_ORACLE');
 const validatePaths=new Function('cwd','governed','fs','path','requireEvidence',source.slice(start,end));
 const requireEvidence=(ok,message)=>{if(!ok)throw Error(message);};
 const root=path.join(directory,'declared-inputs');fs.mkdirSync(root,{recursive:true});
 fs.writeFileSync(path.join(root,'test-retained-root-native.html'),'independent html');fs.writeFileSync(path.join(root,'test-retained-root-native.mjs'),'independent module');
 const validate=files=>validatePaths(root,files,fs,path,requireEvidence);
 validate(['test-retained-root-native.mjs','test-retained-root-native.html']);cases.push({caseId:'actual-declared-html-path-loop-control',result:'PASS'});
 for(const name of ['verification/../test-retained-root-native.html','../test-retained-root-native.html','/test-retained-root-native.html','test-retained-root-native.HTML','other.html','UNKNOWN_PROJECT.json','TEST_PROJECT.json.gz','verification/fixture.zip'])detect('invalid-path-'+name,()=>assert.throws(()=>validate([name]),/exact first-party verification path/));
 fs.unlinkSync(path.join(root,'test-retained-root-native.html'));detect('missing-declared-html-file',()=>assert.throws(()=>validate(['test-retained-root-native.html']),/ENOENT/));
 const outside=path.join(directory,'declared-inputs-path-escape');fs.mkdirSync(outside,{recursive:true});fs.writeFileSync(path.join(outside,'native.html'),'outside');fs.symlinkSync(path.join(outside,'native.html'),path.join(root,'test-retained-root-native.html'));
 detect('declared-html-symlink-escape',()=>assert.throws(()=>validate(['test-retained-root-native.html']),/outside the first-party source root/));
 fs.rmSync(root,{recursive:true,force:true});fs.rmSync(outside,{recursive:true,force:true});
 assert.equal(catalog.checks,fullChecks,'NATIVE_EVIDENCE_FULL_CATALOG_RESTORATION_ORACLE');
 assert.throws(()=>observationsFromReports('verify-browser.mjs',[{retainedRootNative:good},main,{humanCombinedNative:independentHumanCombinedFixture()},{humanCombinedUi:independentHumanCombinedUiFixture()}],{scope:'LOCAL'}),/exactly one report marker appendOnlyNative; received 0/,'NATIVE_EVIDENCE_FULL_CATALOG_APPEND_ONLY_REQUIRED_ORACLE');
 return {status:'PASS',synthetic:true,actualBrowser:false,eligibleReceiptCreated:false,cases,caseCount:cases.length,scope:'Actual catalogue/report selector and source-binding/path-loop controls; no native execution or whole browser receipt claim.'};
}
