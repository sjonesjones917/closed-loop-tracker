import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {projectStoreRuntime,storedArtifactBody} from '/workspace/shared/clrt-release-frozen-086f2b2e/test-project-store-runtime.mjs';

// Disposable reviewer diagnostic. No production source, authority, or clock edits.
const root='/workspace/shared/clrt-release-frozen-086f2b2e';
const evidence='/workspace/shared/clrt-iteration-repair-evidence';
const inputDir=evidence+'/frozen-cd56dd97-release-binding-blocked-r6';
const fixturePath=inputDir+'/release-public-cold.json.gz';
const output=evidence+'/independent-r6-migration-086-r2';
const which=process.argv.find(x=>x.startsWith('--case='))?.slice(7)||'normal';
assert(['normal','forgery','rollback'].includes(which));
assert.equal(process.cwd(),root);
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),'086f2b2ecc271013ebc90a7694350ffd2eee6102');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const inputBytes=fs.readFileSync(fixturePath),fixture=JSON.parse(gunzipSync(inputBytes));
const oldSources=JSON.parse(fs.readFileSync(inputDir+'/producer-sources.json'));
const currentSources=Object.fromEntries(Object.keys(oldSources).map(name=>[name,fs.readFileSync(name,'utf8')]));
for(const[name,digest]of Object.entries(fixture.sourceSha256))assert.equal(sha(oldSources[name]),digest,'Original producer '+name);
assert.equal(sha(currentSources['workflow-engine.js']),'bf9076eaadef45baba900b389d01305be052ac8bc2f3964c7ba842910cfbfd12');
assert.equal(sha(currentSources['project-store.js']),'530047847aafb62755c7f5e768f5ca1cac86bf767e678e74bf0d6dd3e1a64143');
const driverSha256=sha(fs.readFileSync(import.meta.filename));
fs.mkdirSync(output,{recursive:true});
const save=(name,value)=>fs.writeFileSync(output+'/'+which+'-'+name+'.json',JSON.stringify(value,null,2));
save('provenance',{case:which,startedAt:new Date().toISOString(),driverSha256,fixturePath,fixtureSha256:sha(inputBytes),candidate:'086f2b2ecc271013ebc90a7694350ffd2eee6102',oldSourceHashes:fixture.sourceSha256,currentSourceHashes:Object.fromEntries(Object.entries(currentSources).map(([n,s])=>[n,sha(s)])),scope:'Actual expired BLOCKED legacy store activation and reproof in a Node transaction adapter; synthetic isolated corruption/failure controls. No browser, fresh acceptance, full lifecycle, or authority renewal claim.'});
const progress=(phase,data={})=>{const value={phase,observedAt:new Date().toISOString(),...data};save('progress',value);process.stderr.write(JSON.stringify(value)+'\n');};
function decode(value){if(value?.__retainedBlob===true)return new Blob([Buffer.from(value.base64,'base64')],{type:value.type});if(Array.isArray(value))return value.map(decode);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,decode(v)]));return value;}
function install({legacy=false}={}){
 const r=projectStoreRuntime({storageWorker:false,...(legacy?{sourceOverrides:oldSources}:{})});
 for(const[name,entries]of fixture.stores)r.rows.set(name,new Map(entries.map(([key,value])=>[key,r.copy(decode(value))])));
 const row=r.rows.get('projects').get(fixture.jobId);
 assert(row,'Original stored project row');
 assert.equal(r.store.projectSha256(row.project),row.projectSha256,'Original public store digest');
 assert.equal(row.project.projectData.applicationProjection.receipt.derivationId,'closed-loop-derivation/project-current-projection/12');
 return r;
}
function hydrate(r,p){const before=r.runtime.closedLoopHash.sha256Value(p);for(const c of fixture.promptContextFiles){const rows=p.projectData.generatedPrompts.filter(x=>(x.instructionId||x.promptId)===c.instructionId);assert.equal(rows.length,1);r.prompts.retainPromptContextFiles(rows[0],r.copy(c.files));r.prompts.materializePromptContextFiles(rows[0]);}assert.equal(r.runtime.closedLoopHash.sha256Value(p),before,'Exact original context hydration is noncanonical');return p;}
async function digestValue(value){if(value instanceof Blob)return {blobType:value.type,byteSize:value.size,sha256:sha(Buffer.from(await value.arrayBuffer()))};if(Array.isArray(value))return Promise.all(value.map(digestValue));if(value&&typeof value==='object')return Object.fromEntries(await Promise.all(Object.keys(value).sort().map(async k=>[k,await digestValue(value[k])])));return value;}
async function storesDigest(r){return sha(JSON.stringify(await digestValue([...r.rows].map(([name,rows])=>[name,[...rows]]))));}
const projectionId=p=>p.projectData.applicationProjection.receipt.derivationId;
const release=p=>p.projectData.releaseRecords.find(x=>x.id===p.job.CURRENT_RELEASE_ID);
function invariants(r,p){const h=r.runtime.closedLoopHash;return {raw:h.sha256Value(p.projectData.rawResponses),capability:h.sha256Value(p.projectData.externalCapabilities),environment:h.sha256Value(p.projectData.environmentManifests),history:h.sha256Value(p.projectData.history),historyLength:p.projectData.history.length,release:h.sha256Value(release(p)),releaseBody:h.sha256Value(r.copy({fields:release(p).fields,derivationInput:release(p).derivationInput,derivationReceipt:release(p).derivationReceipt})),releaseId:release(p).id};}
function preserved(r,p,prior,{wholeRelease=false}={}){const h=r.runtime.closedLoopHash;assert.equal(h.sha256Value(p.projectData.rawResponses),prior.raw,'Original raw responses');assert.equal(h.sha256Value(p.projectData.externalCapabilities),prior.capability,'Expired capability is unchanged');assert.equal(h.sha256Value(p.projectData.environmentManifests),prior.environment,'Expired environment claims are unchanged');assert.equal(h.sha256Value(p.projectData.history.slice(0,prior.historyLength)),prior.history,'Original History prefix');const old=p.projectData.releaseRecords.find(x=>x.id===prior.releaseId);assert(old,'Original release retained');assert.equal(h.sha256Value(r.copy({fields:old.fields,derivationInput:old.derivationInput,derivationReceipt:old.derivationReceipt})),prior.releaseBody,'Original release calculation bytes');if(wholeRelease)assert.equal(h.sha256Value(old),prior.release,'Activation does not restamp the old release');}
async function capture(r,label,p){
 const h=r.runtime.closedLoopHash,start=new Date().toISOString(),before=h.sha256Value(p),artifacts=[];
 for(const row of r.rows.get('artifacts').values()){if(row.jobId!==p.job.JOB_ID)continue;const bytes=Buffer.from(await storedArtifactBody(r,row.artifactId,{row}).blob.arrayBuffer());assert.equal(bytes.length,row.byteSize);assert.equal(sha(bytes),row.sha256);artifacts.push({...row,blob:undefined,bytesBase64:bytes.toString('base64')});}
 const contexts=p.projectData.generatedPrompts.map(row=>({instructionId:row.instructionId||row.promptId,files:r.prompts.materializePromptContextFiles(row)}));
 const adapter=r.rows.get('projects').get(p.job.JOB_ID),snapshot={label,captureStartedAt:start,captureCompletedAt:new Date().toISOString(),captureKind:label.includes('cold')?'PUBLIC_SAVED_AND_COLD_READ':'COMMAND_CANDIDATE',project:p,projectSha256:before,adapterIdentity:{revision:adapter.revision,storedSha256:adapter.projectSha256,bodySha256:r.store.projectSha256(adapter.project)},promptContextFiles:contexts,artifacts,sourceHashes:Object.fromEntries(Object.entries(currentSources).map(([n,s])=>[n,sha(s)])),driverSha256,originalCustodyFixtureSha256:sha(inputBytes)};
 fs.writeFileSync(output+'/'+which+'-'+label+'.json.gz',gzipSync(JSON.stringify(snapshot)));assert.equal(h.sha256Value(p),before,'Inert capture');progress(label,{projectSha256:before});
}
async function normal(){
 progress('validate-actual-legacy-cold');const old=install({legacy:true}),original=hydrate(old,await old.store.readProject(fixture.jobId));assert.equal(old.store.validateProjectIntegrity(original).valid,true);assert.equal(projectionId(original),'closed-loop-derivation/project-current-projection/12');assert.equal(release(original).derivationReceipt.derivationId,'closed-loop-derivation/stage27-release/3');assert.equal(release(original).fields.DETERMINATION,'BLOCKED');const prior=invariants(old,original);assert.equal(old.engine.gate(2,original).complete,false);
 save('validated-legacy',{observedAt:new Date().toISOString(),prior,projectSha256:original.projectSha256,projectionId:projectionId(original)});
 progress('activate-original-store');const r=install(),p=hydrate(r,await r.store.readProject(fixture.jobId)),e=r.engine,h=r.runtime.closedLoopHash;
 assert.equal(projectionId(p),'closed-loop-derivation/project-current-projection/13');assert.equal(r.store.validateProjectIntegrity(p).valid,true);preserved(r,p,prior,{wholeRelease:true});assert.equal(e.gate(2,p).complete,false);assert.equal(e.releaseRecordMatchesBinding(release(p),e.releaseBinding(p)),false,'Legacy3 is not current4');const activation=p.projectData.history.filter(x=>x.type==='APPLICATION_PROJECTION_DERIVATION_ACTIVATED').at(-1);assert.equal(activation.previousDerivationId,'closed-loop-derivation/project-current-projection/12');assert.equal(activation.derivationId,projectionId(p));await capture(r,'activated-cold',p);
 const next=e.clone(p);await capture(r,'before-command',next);const record=e.recordReleaseDetermination(next);await capture(r,'after-command',next);assert.equal(record.fields.DETERMINATION,'BLOCKED');assert.equal(record.derivationReceipt.derivationId,'closed-loop-derivation/stage27-release/4');assert(e.releaseRecordMatchesBinding(record,e.releaseBinding(next)));preserved(r,next,prior);const exact=h.sha256Value(next),retry=e.recordReleaseDetermination(next);assert.equal(retry.id,record.id);assert.equal(h.sha256Value(next),exact,'Exact retry does not alter canonical state');progress('exact-command-retry');
 const forged=e.clone(record);forged.derivationReceipt.canonicalInputSha256='f'.repeat(64);assert.equal(e.releaseRecordMatchesBinding(forged,e.releaseBinding(next)),false,'Forged current receipt rejected');
 // Explicit synthetic operator review of the exact normal supersession impact.
 // The original unconfirmed write rejection is preserved in the r1 evidence.
 const impact=r.store.mutationImpact(p,next);
 assert.equal(impact.requiresConfirmation,true);assert.equal(impact.stage,27);
 assert.deepEqual(JSON.parse(JSON.stringify(impact.replaces)),[]);
 assert.deepEqual(JSON.parse(JSON.stringify(impact.affected)),[{stage:27,work:[{kind:'releaseRecords',id:prior.releaseId}]}],'Only the known retained release3 may be affected');
 save('synthetic-operator-review',{observedAt:new Date().toISOString(),synthetic:true,scope:'Disposable diagnostic review, not user acceptance or production approval.',initialGuardEvidence:evidence+'/independent-r6-migration-086/normal-failure.json',impact});
 const saved=await r.store.writeProject(next,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,mutationConfirmation:impact}),cold=hydrate(r,await r.store.readProject(saved.job.JOB_ID));assert.equal(r.store.validateProjectIntegrity(cold).valid,true);assert.equal(e.gate(2,cold).complete,false);assert.equal(release(cold).fields.DETERMINATION,'BLOCKED');assert(e.releaseRecordMatchesBinding(release(cold),e.releaseBinding(cold)));preserved(r,cold,prior);await capture(r,'release-cold',cold);
 return {result:'PASS',prior,releaseId:record.id,projectSha256:cold.projectSha256,revision:cold.revision,checks:['actual-valid-legacy12-release3','normal-public-activation13','legacy-release-not-restamped','legacy3-not-current4','expired-authority-unchanged','raw-history-prefix-preserved','ordinary-blocked-release4','exact-command-retry','forged-current-receipt-rejected','exact-synthetic-supersession-review','normal-save-cold-integrity'],fullJourneyExecution:false};
}
async function forgery(){
 progress('synthetic-legacy-receipt-forgery');const r=install(),row=r.rows.get('projects').get(fixture.jobId),originalReceipt=row.project.projectData.applicationProjection.receipt.outputSha256;row.project.projectData.applicationProjection.receipt.outputSha256='f'.repeat(64);assert.notEqual(originalReceipt,'f'.repeat(64));row.projectSha256=r.store.projectSha256(row.project);let observed=null;try{await r.store.readProject(fixture.jobId);}catch(error){observed={code:error.code,message:error.message};}assert.equal(observed?.code,'PROJECT_INTEGRITY_FAILED','Forged inner receipt under recomputed outer digest is rejected');return {result:'PASS',synthetic:true,originalInputUnchanged:true,observed};
}
async function rollback(){
 const cases=[];for(const phase of ['before-project-transaction','before-transaction-commit']){progress('synthetic-rollback-start',{fault:phase});const r=install(),before=await storesDigest(r);r.runtime.__closedLoopStorageFault=phase;let observed=null;try{await r.store.readProject(fixture.jobId);}catch(error){observed={code:error.code,message:error.message};}assert.equal(observed?.code,'INJECTED_STORAGE_FAILURE');assert.equal(await storesDigest(r),before,'Every original adapter row and Blob survives aborted activation');delete r.runtime.__closedLoopStorageFault;const recovered=hydrate(r,await r.store.readProject(fixture.jobId));assert.equal(projectionId(recovered),'closed-loop-derivation/project-current-projection/13');assert.equal(r.store.validateProjectIntegrity(recovered).valid,true);cases.push({phase,result:'PASS',observed,allRowsPreserved:true,retryProjection:projectionId(recovered)});progress('synthetic-rollback-complete',cases.at(-1));}return {result:'PASS',synthetic:true,cases};
}
try{const result=await ({normal,forgery,rollback}[which])();for(const[name,text]of Object.entries(currentSources))assert.equal(fs.readFileSync(name,'utf8'),text,'Pinned runtime source unchanged');save('result',{...result,completedAt:new Date().toISOString(),driverSha256,fixtureSha256:sha(inputBytes)});progress('finished',{result:result.result});}catch(error){save('failure',{observedAt:new Date().toISOString(),message:error.message,code:error.code,stack:error.stack,driverSha256});throw error;}
