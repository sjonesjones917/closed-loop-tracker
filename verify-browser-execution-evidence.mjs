import assert from 'node:assert/strict';
import {validateBrowserExecution,loadBrowserExpectedSite} from './browser-execution-evidence.mjs';

// Explicit synthetic admission controls. These test receipt rejection, not a
// browser, physical device, deployed site, or the application assertions.
const names=['index.html','workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js','test-worker.js','TEST_PROJECT.json','.nojekyll'];
const sourceCommit='1'.repeat(40),suite='synthetic-browser-receipt-control.mjs',digest='2'.repeat(64),buildIdentity='build-sha256-'+digest;
const manifest={sourceCommit,canonicalOrigin:'https://sjonesjones917.github.io',canonicalBasePath:'/closed-loop-tracker/',manifestDigest:{digest},buildIdentity,runtimeResources:names.map((path,index)=>({path,byteSize:index,digest,buildIdentity}))};
function fixture(scope='LOCAL'){
 const base=scope==='LOCAL'?'http://127.0.0.1:12345/':manifest.canonicalOrigin+manifest.canonicalBasePath;
 return {schema:'closed-loop-browser-execution/1',suite,scope,sourceCommit,manifestDigest:digest,buildIdentity,pageUrl:base,pageOrigin:new URL(base).origin,browserVersion:'SYNTHETIC_VALIDATOR_CONTROL',complete:true,applicationReady:true,resources:manifest.runtimeResources.map(row=>({path:row.path,byteSize:row.byteSize,sha256:row.digest,responseUrl:new URL(row.path,base).href,status:200,observation:'BROWSER_HTTP_BYTES'})),observedScriptSources:manifest.runtimeResources.filter(row=>row.path.endsWith('.js')&&row.path!=='test-worker.js').map(row=>({path:row.path,byteSize:row.byteSize,sha256:row.digest,url:new URL(row.path,base).href,targetType:'PAGE',observation:'DEBUGGER_SCRIPT_SOURCE'})),observedDocuments:[{url:base,status:200,byteSize:0,sha256:digest,observation:'BROWSER_DOCUMENT_RESPONSE'}],observedWorkers:[],unobservedRuntimeResources:['.nojekyll','TEST_PROJECT.json','index.html','test-worker.js']};
}
const validate=(value,scope='LOCAL')=>validateBrowserExecution(value,{suite,scope,manifest,sourceCommit});
const cases=[];
for(const scope of ['LOCAL','DEPLOYED']){assert.equal(validate(fixture(scope),scope),true);cases.push(scope+' conforming carrier');}
for(const [name,mutate]of [
 ['scope substitution',row=>{row.scope='DEPLOYED';}],['missing main script',row=>row.observedScriptSources.pop()],
 ['HTTP bytes substituted for parsed sources',row=>{row.observedScriptSources=row.resources;}],['stale parsed source',row=>{row.observedScriptSources[0].sha256='0'.repeat(64);}],
 ['stale fetched bytes',row=>{row.resources[0].sha256='0'.repeat(64);}],['missing resource',row=>row.resources.pop()],
 ['duplicate resource',row=>{row.resources[1]=row.resources[0];}],['cross-origin script',row=>{row.observedScriptSources[0].url='https://example.org/workbook.js';}],
 ['redirected HTTP bytes',row=>{row.resources[0].responseUrl='https://example.org/index.html';}],['incomplete suite',row=>{row.complete=false;}],
 ['stale source identity',row=>{row.sourceCommit='0'.repeat(40);}],['stale manifest identity',row=>{row.manifestDigest='0'.repeat(64);}],
 ['missing loaded document',row=>{row.observedDocuments=[];}],['changed loaded document',row=>{row.observedDocuments[0].sha256='0'.repeat(64);}],
 ['unobserved worker claim',row=>{row.observedWorkers=['http://127.0.0.1:12345/test-worker.js'];}],['hidden unobserved graph',row=>{row.unobservedRuntimeResources=[];}],
 ['nonlocal target',row=>{row.pageUrl='https://example.org/';}],['wrong suite',row=>{row.suite='other.mjs';}]
]){const value=fixture();mutate(value);assert.throws(()=>validate(value),/BROWSER_EXECUTION_EVIDENCE:/,name);cases.push(name);}
assert.throws(()=>validate(fixture(),'DEPLOYED'),/scope mismatch/);cases.push('local cannot satisfy deployed');
assert.equal(await loadBrowserExpectedSite({}),null);await assert.rejects(()=>loadBrowserExpectedSite({CLOSED_LOOP_BROWSER_SCOPE:'LOCAL'}),/expected built artifact directory/);cases.push('unscoped omission and scoped artifact requirement');
console.log(JSON.stringify({browserExecutionEvidenceVerified:true,basis:'SYNTHETIC_RECEIPT_VALIDATOR_CONTROLS_ONLY',cases}));
