import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {preserveOperatorFailureReplay} from './preserve-operator-failure-replay.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'operator-replay-controls-')),source=path.join(root,'source'),site=path.join(root,'site'),directory=path.join(root,'operator-evidence'),hash=bytes=>createHash('sha256').update(bytes).digest('hex'),cases=[];
for(const folder of [source,site,path.join(source,'.github/workflows'),path.join(directory,'profile/Default/IndexedDB'),path.join(directory,'inputs/1')])fs.mkdirSync(folder,{recursive:true});
const sourceBody='export const fixture=true;\n',runtimeBody='<!doctype html><title>Synthetic replay control only</title>\n';
fs.writeFileSync(path.join(source,'fixture.mjs'),sourceBody);fs.writeFileSync(path.join(source,'.github/workflows/pages.yml'),'name: synthetic fixture\n');
const git=args=>execFileSync('git',args,{cwd:source,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000});
try{
 git(['init','--initial-branch=main']);git(['add','.']);git(['-c','user.name=Synthetic verifier','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','-m','Disposable replay fixture']);
 const head=git(['rev-parse','HEAD']).trim();
 fs.writeFileSync(path.join(source,'fixture.mjs'),sourceBody+'export const changed=true;\n');
 fs.writeFileSync(path.join(site,'index.html'),runtimeBody);
 fs.writeFileSync(path.join(site,'closed-loop-deployment-manifest.json'),JSON.stringify({sourceCommit:head,buildIdentity:'SYNTHETIC_REPLAY_CONTROL',manifestDigest:{digest:'synthetic'},runtimeResources:[{path:'index.html',byteSize:Buffer.byteLength(runtimeBody),digest:hash(runtimeBody)}]}));
 const original=Buffer.from([0,1,2,255,128,13,10]),profileFile=path.join(directory,'profile/Default/IndexedDB/fixture.ldb');fs.writeFileSync(profileFile,original);fs.writeFileSync(path.join(directory,'inputs/1/response.json'),'synthetic input\n');
 fs.symlinkSync('old-host-123',path.join(directory,'profile/SingletonLock'));
 const stopped=spawnSync(process.execPath,['-e','process.exit(0)'],{timeout:10000});assert.equal(stopped.status,0);
 const base={basis:'SYNTHETIC_EXTERNAL_COUNTERPART_WITH_ACTUAL_BROWSER_FILE_TRANSPORT',complete:false,stages:[{stage:1,result:'PASS'}],failures:[{message:'SYNTHETIC_DIAGNOSTIC_FAILURE'}],browserClosure:{terminal:true,exitObserved:true,stdioClosed:true,pid:stopped.pid,exitCode:0,signal:null,closedAt:new Date().toISOString(),profile:path.join(directory,'profile'),pageUrl:'http://127.0.0.1:4173/',launchExecutable:process.execPath,browserVersion:'SYNTHETIC_NO_BROWSER_ACCEPTANCE'}};
 const save=value=>fs.writeFileSync(path.join(directory,'journey.json'),JSON.stringify(value)),run=options=>preserveOperatorFailureReplay({directory,siteDirectory:site,sourceDirectory:source,...options});
 save({...base,complete:true});assert.equal((await run()).ready,false);assert.ok(!fs.existsSync(path.join(directory,'failure-replay')));cases.push('successful-run-not-retained');
 for(const [name,change,oracle]of [['unterminated',value=>value.browserClosure.terminal=false,/terminal process state/],['unobserved-exit',value=>value.browserClosure.exitObserved=false,/process exit must be observed/],['unclosed-stdio',value=>value.browserClosure.stdioClosed=false,/stdio must close/],['wrong-profile',value=>value.browserClosure.profile=path.join(root,'other-profile'),/exact profile/],['live-process',value=>value.browserClosure.pid=process.pid,/still present/]]){const value=structuredClone(base);change(value);save(value);await assert.rejects(run(),oracle);cases.push(name+'-rejected');}
 save(base);await assert.rejects(run({maximumBytes:1}),/bounded diagnostic retention size/);cases.push('size-limit-rejected');
 const escape=path.join(directory,'profile/escape');fs.symlinkSync(source,escape);await assert.rejects(run(),/must not follow a symlink/);fs.unlinkSync(escape);cases.push('unowned-symlink-rejected');
 for(const name of ['profile','inputs']){const owned=path.join(directory,name),retained=owned+'-original';fs.renameSync(owned,retained);fs.symlinkSync(retained,owned);try{await assert.rejects(run(),/input root must be a real directory/);}finally{fs.unlinkSync(owned);fs.renameSync(retained,owned);}cases.push(name+'-root-symlink-rejected');}
 const retainedDirectory=directory+'-original';fs.renameSync(directory,retainedDirectory);fs.symlinkSync(retainedDirectory,directory);try{await assert.rejects(run(),/operator root must be a real directory/);}finally{fs.unlinkSync(directory);fs.renameSync(retainedDirectory,directory);}cases.push('operator-root-symlink-rejected');
 fs.writeFileSync(path.join(site,'index.html'),runtimeBody+'changed');await assert.rejects(run(),/differs from its manifest/);assert.ok(!fs.existsSync(path.join(directory,'failure-replay/manifest.json')));fs.rmSync(path.join(directory,'failure-replay'),{recursive:true});fs.writeFileSync(path.join(site,'index.html'),runtimeBody);cases.push('mismatched-runtime-rejected');
 const result=await run();assert.equal(result.ready,true);
 const manifest=JSON.parse(fs.readFileSync(path.join(directory,result.manifest),'utf8'));
 assert.equal(manifest.status,'INCOMPLETE_FAILURE_DIAGNOSTIC');assert.equal(manifest.applicationAcceptance,false);assert.equal(manifest.successfulExecutionEvidence,false);assert.equal(manifest.source.head,head);assert.equal(manifest.source.patchSha256,hash(fs.readFileSync(path.join(directory,'failure-replay/source.patch'))));
 assert.deepEqual(fs.readFileSync(profileFile),original);assert.equal(manifest.preserved[0].files[0].sha256,hash(original));assert.deepEqual(manifest.preserved[0].omitted.map(row=>row.path),['SingletonLock']);assert.equal(fs.readlinkSync(path.join(directory,'profile/SingletonLock')),'old-host-123');
 assert.equal(fs.readFileSync(path.join(directory,'failure-replay/site/index.html'),'utf8'),runtimeBody);assert.equal(fs.readFileSync(path.join(directory,'failure-replay/source/fixture.mjs'),'utf8'),sourceBody+'export const changed=true;\n');cases.push('exact-originals-and-incomplete-identities-retained');
 await assert.rejects(run(),/earlier failure replay already exists/);cases.push('earlier-diagnostic-not-overwritten');
 const owner=fs.readFileSync(new URL('./verify-complete-operator-journey.mjs',import.meta.url),'utf8'),start=owner.indexOf('function preserveReport(){'),end=owner.indexOf('\nasync function closeBrowser()',start);assert.ok(start>=0&&end>start,'The report-persistence control must execute its actual owner.');
 for(const interrupted of [true,false]){let written=null;const report={complete:true},context={report,interrupted,browser:{events:[]},directory:'/synthetic-replay-control',path,fs:{writeFileSync(_file,text){written=JSON.parse(text);},renameSync(){}}};vm.runInNewContext(owner.slice(start,end)+'\npreserveReport();',context);assert.equal(written.complete,!interrupted,'A later success assignment must not erase a prior interruption.');assert.equal(report.complete,!interrupted);cases.push(interrupted?'interrupted-success-race-remains-incomplete':'uninterrupted-success-preserved');}
 console.log(JSON.stringify({passed:true,scope:'Failure-artifact ownership, byte identity, bounds and incomplete-status controls; not application or real-browser acceptance.',cases}));
}finally{fs.rmSync(root,{recursive:true,force:true});}
