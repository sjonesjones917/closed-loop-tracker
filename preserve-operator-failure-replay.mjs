// Failure diagnostics only. This module cannot issue or satisfy a verifier
// receipt and never promotes a retained prefix to complete browser evidence.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const processLocks=new Set(['SingletonLock','SingletonCookie','SingletonSocket']);
async function fileIdentity(filename){
 const before=fs.statSync(filename),digest=createHash('sha256');let byteSize=0;
 for await(const bytes of fs.createReadStream(filename)){digest.update(bytes);byteSize+=bytes.length;}
 const after=fs.statSync(filename);
 assert.equal(byteSize,before.size,'Replay input changed while hashing: '+filename);
 assert.equal(after.size,before.size,'Replay input size changed: '+filename);
 assert.equal(after.mtimeMs,before.mtimeMs,'Replay input changed after browser closure: '+filename);
 return {byteSize,sha256:digest.digest('hex')};
}
function inventoryTree(directory){
 const root=fs.lstatSync(directory);assert.ok(root.isDirectory()&&!root.isSymbolicLink(),'Replay input root must be a real directory, not a symlink: '+directory);
 const files=[],omitted=[];
 function visit(relative=''){
  for(const name of fs.readdirSync(path.join(directory,relative)).sort()){
   const item=relative?relative+'/'+name:name,filename=path.join(directory,item),stat=fs.lstatSync(filename);
   if(!relative&&processLocks.has(name)){omitted.push({path:item,reason:'Terminated Chrome process lock; remove only from a disposable replay copy.'});continue;}
   assert.ok(!stat.isSymbolicLink(),'A replay profile must not follow a symlink outside its owned directory: '+item);
   if(stat.isDirectory())visit(item);else {assert.ok(stat.isFile(),'Unsupported replay entry: '+item);files.push({path:item,byteSize:stat.size});}
  }
 }
 visit();return {files,omitted};
}
export async function preserveOperatorFailureReplay({directory='operator-evidence',siteDirectory=process.env.STATIC_SITE_ROOT||process.env.VERIFIED_SITE_DIR,sourceDirectory=process.cwd(),maximumBytes=2*1024**3}={}){
 directory=path.resolve(directory);sourceDirectory=path.resolve(sourceDirectory);
 if(!fs.existsSync(directory))return {ready:false,reason:'No operator directory exists; no failed browser state is available.'};
 const root=fs.lstatSync(directory);assert.ok(root.isDirectory()&&!root.isSymbolicLink(),'The owned operator root must be a real directory, not a symlink.');
 const reportPath=path.join(directory,'journey.json');
 if(!fs.existsSync(reportPath))return {ready:false,reason:'No operator report exists; no completed browser closure is established.'};
 const report=JSON.parse(fs.readFileSync(reportPath,'utf8'));
 if(report.complete===true)return {ready:false,reason:'A successful run does not retain a diagnostic browser profile.'};
 assert.equal(report.basis,'SYNTHETIC_EXTERNAL_COUNTERPART_WITH_ACTUAL_BROWSER_FILE_TRANSPORT','Only the owned synthetic operator journey may retain this profile.');
 const closure=report.browserClosure,profile=path.join(directory,'profile');
 assert.equal(closure?.terminal,true,'The browser must reach a terminal process state before replay preservation.');
 assert.equal(closure.exitObserved,true,'The browser process exit must be observed before replay preservation.');
 assert.equal(closure.stdioClosed,true,'The browser stdio must close before replay preservation.');
 assert.equal(path.resolve(closure.profile),profile,'The terminal browser must own this exact profile.');
 assert.ok(Number.isInteger(closure.pid)&&closure.pid>0&&closure.closedAt,'Missing terminal browser identity.');
 // The workflow invokes this after the verifier process has ended. A reused
 // PID is conservatively rejected instead of taking a possibly active snapshot.
 let processExists=false;try{process.kill(closure.pid,0);processExists=true;}catch(error){assert.equal(error.code,'ESRCH');}
 assert.equal(processExists,false,'The recorded Chrome PID is still present; profile preservation is not quiescent.');
 assert.ok(siteDirectory,'The exact built artifact directory is required for a replay.');
 siteDirectory=path.resolve(siteDirectory);
 const deploymentPath=path.join(siteDirectory,'closed-loop-deployment-manifest.json'),deployment=JSON.parse(fs.readFileSync(deploymentPath,'utf8'));
 assert.ok(Array.isArray(deployment.runtimeResources)&&deployment.runtimeResources.length&&deployment.buildIdentity&&deployment.sourceCommit,'Missing built runtime identity.');
 const roots=[{kind:'profile',directory:profile},{kind:'inputs',directory:path.join(directory,'inputs')}];
 const inventories=roots.map(root=>({...root,...inventoryTree(root.directory)}));
 const sourceFiles=fs.readdirSync(sourceDirectory).filter(name=>/\.(?:mjs|js|html)$/.test(name)&&fs.lstatSync(path.join(sourceDirectory,name)).isFile()).sort();
 sourceFiles.push('.github/workflows/pages.yml');
 const siteFiles=['closed-loop-deployment-manifest.json',...deployment.runtimeResources.map(row=>row.path)];
 for(const name of [...sourceFiles,...siteFiles])assert.ok(typeof name==='string'&&!path.isAbsolute(name)&&!name.split('/').includes('..'),'Unsafe replay source path.');
 const git=args=>execFileSync('git',args,{cwd:sourceDirectory,encoding:'utf8',timeout:30000,maxBuffer:32*1024*1024}),patch=git(['diff','--binary','HEAD','--']);
 const byteSize=Buffer.byteLength(patch)+inventories.flatMap(row=>row.files).reduce((n,row)=>n+row.byteSize,0)+sourceFiles.reduce((n,name)=>n+fs.statSync(path.join(sourceDirectory,name)).size,0)+siteFiles.reduce((n,name)=>n+fs.statSync(path.join(siteDirectory,name)).size,0);
 assert.ok(Number.isSafeInteger(maximumBytes)&&maximumBytes>0&&byteSize<=maximumBytes,'Replay exceeds the bounded diagnostic retention size. Originals remain in their owned directory.');
 const destination=path.join(directory,'failure-replay');assert.ok(!fs.existsSync(destination),'An earlier failure replay already exists; preserve it unchanged.');fs.mkdirSync(destination);
 const copied=[];
 for(const [kind,root,names]of [['source',sourceDirectory,sourceFiles],['site',siteDirectory,siteFiles]])for(const name of names){const target=path.join(destination,kind,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,name),target);copied.push({path:kind+'/'+name,...await fileIdentity(target)});}
 for(const expected of deployment.runtimeResources){const actual=copied.find(row=>row.path==='site/'+expected.path);assert.equal(actual?.sha256,expected.digest,'Retained built resource differs from its manifest: '+expected.path);assert.equal(actual.byteSize,expected.byteSize);}
 for(const root of inventories)for(const row of root.files)Object.assign(row,await fileIdentity(path.join(root.directory,row.path)));
 fs.writeFileSync(path.join(destination,'source.patch'),patch);
 const manifest={schema:'incomplete-operator-failure-replay/1',status:'INCOMPLETE_FAILURE_DIAGNOSTIC',applicationAcceptance:false,successfulExecutionEvidence:false,synthetic:true,createdAt:new Date().toISOString(),failedOperation:report.currentOperation||null,completedStages:report.stages?.length||0,failures:report.failures||[],browser:closure,node:{version:process.version,platform:process.platform,architecture:process.arch,executable:process.execPath,...await fileIdentity(process.execPath)},source:{head:git(['rev-parse','HEAD']).trim(),trackedStatus:git(['status','--porcelain=v1','--untracked-files=no']),patchSha256:sha(patch)},deployment:{sourceCommit:deployment.sourceCommit,buildIdentity:deployment.buildIdentity,manifestDigest:deployment.manifestDigest},limits:{maximumBytes,retainedBytes:byteSize},preserved:inventories.map(({kind,files,omitted})=>({kind,files,omitted})),copied,replayInstructions:'Keep these failed originals unchanged. Copy only profile/ into a new disposable driver directory and remove only the recorded Chrome Singleton locks from that copied profile. Keep captured inputs/ separately, read-only, at their original retained location; read their exact bytes when selecting replay files. Leave the new driver inputs/ absent or empty so the driver can allocate numbered uploads. Serve failure-replay/site/ at the recorded original origin and use the recorded browser version. A replay is diagnostic; the full operator assertions must still execute on the final candidate.'};
 if(fs.existsSync(closure.launchExecutable))manifest.browser.launchExecutableIdentity=await fileIdentity(closure.launchExecutable);
 const pending=path.join(destination,'manifest.json.pending');fs.writeFileSync(pending,JSON.stringify(manifest,null,2)+'\n');fs.renameSync(pending,path.join(destination,'manifest.json'));
 return {ready:true,status:manifest.status,manifest:'failure-replay/manifest.json',profileFiles:inventories[0].files.length,retainedBytes:byteSize};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{const result=await preserveOperatorFailureReplay();console.log(JSON.stringify(result));if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'ready='+String(result.ready)+'\n');}
 catch(error){console.error(JSON.stringify({ready:false,error:error.message,originalsPreserved:true}));process.exitCode=1;}
}
