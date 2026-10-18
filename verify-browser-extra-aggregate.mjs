// Synthetic admission/process controls only. No browser or app assertions run,
// and no generated control receipt is retained as executed application proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {BROWSER_EXTRA_LANES,BROWSER_EXTRA_CHILD_SCHEMA,BROWSER_EXTRA_AGGREGATE_SCHEMA,browserExtraRequiredPopulations,browserExtraSourceFingerprint,browserExtraFingerprintFromInputs,parseBrowserExtraChildOutput,validateBrowserExtraAggregate,superviseBrowserExtra} from './browser-extra-aggregate.mjs';
import {createExecutionReceipt,validateExecutionReceipt} from './verification-evidence.mjs';

// Explicitly obstruct only this control's own process groups, then prove that
// failed supervisor cleanup retains their roots rather than deleting live data.
export async function verifyBrowserExtraCleanupRetentionControl(){
 const directory=fs.mkdtempSync(path.join(process.cwd(),'.browser-extra-retention-control-'));
 const children=[],profiles=[],suppressedSignals=[],originalKill=process.kill;
 const live=pid=>{try{return !/\) [ZX] /.test(fs.readFileSync('/proc/'+pid+'/stat','utf8'));}catch{return false;}};
 let failure,proof;
 try{
  for(const name of ['verify-browser-extra.mjs','browser-extra-aggregate.mjs'])fs.writeFileSync(path.join(directory,name),'// synthetic retention-control source\n');
  process.kill=function(pid,signal){if(signal==='SIGKILL'&&children.some(row=>-row.process.pid===pid)){suppressedSignals.push(pid);return true;}return originalKill.call(process,pid,signal);};
  await assert.rejects(()=>superviseBrowserExtra({cwd:directory,deadlineMs:250,sourceChecks:()=>{},outputDirectory:directory,onFailureOutput:()=>{},spawnChild:(command,args,options)=>{
   profiles.push(options.env.CLOSED_LOOP_BROWSER_EXTRA_PROFILE_PATH);
   const child=spawn(command,['-e','setInterval(()=>{},50)'],options),row={process:child,closed:false};child.once('close',()=>{row.closed=true;});children.push(row);return child;
  }}),error=>{failure=error;return /absolute deadline expired/.test(error.message);});
  assert.equal(children.length,4);assert.equal(new Set(profiles).size,4);assert(suppressedSignals.length>=4);
  for(let index=0;index<children.length;index++){
   const pid=children[index].process.pid,profile=profiles[index];assert(live(pid),'control process exited before retention observation');assert(fs.existsSync(profile),'live group root was deleted');
   assert(failure.cleanupErrors.some(message=>message.includes('process group still running')&&message.includes('profilePath='+profile)&&message.includes('processGroup='+pid)),'retained root/group absent from exact cleanup diagnostics');
  }
  proof={caseName:'live-process-group-retains-owned-root',retainedRoots:4,liveGroupsAtRejection:4,suppressedKillSignals:suppressedSignals.length,completeRejected:true};
 }finally{
  process.kill=originalKill;
  for(const row of children){try{originalKill.call(process,-row.process.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}}
  const end=Date.now()+3000;
  while(children.some(row=>!row.closed||live(row.process.pid))){assert(Date.now()<end,'retention control could not reap its own process: '+children.map(row=>row.process.pid));await new Promise(resolve=>setTimeout(resolve,10));}
  for(const profile of profiles){fs.rmSync(profile,{recursive:true,force:true});assert(!fs.existsSync(profile));}
  fs.rmSync(directory,{recursive:true,force:true});
 }
 return {...proof,testOwnedCleanupComplete:true};
}

export async function verifyBrowserExtraAggregateControls(){
const sha=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const suite='verify-browser-extra.mjs',sourceCommit='1'.repeat(40),hex='2'.repeat(64),invocationId='3'.repeat(64),buildIdentity='build-sha256-'+hex;
const names=['index.html','workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js','test-worker.js','TEST_PROJECT.json','.nojekyll'];
const manifest={schema:'closed-loop-deployment-manifest/1',sourceCommit,canonicalOrigin:'https://example.invalid',canonicalBasePath:'/closed-loop/',buildIdentity,runtimeResources:names.map((path,index)=>({path,byteSize:index,digest:hex,hashAlgorithm:'SHA-256',buildIdentity}))};
manifest.manifestDigest={hashAlgorithm:'SHA-256',digest:globalThis.closedLoopHash.sha256Value(manifest)};
const populations=browserExtraRequiredPopulations();
const inputSha256=Object.fromEntries(fs.readdirSync('.').filter(name=>!name.startsWith('.')&&/^[^/\\]+\.(?:m?js|html|css)$/.test(name)).sort().map(name=>[name,sha(fs.readFileSync(name))]));
const sourceFingerprint=browserExtraFingerprintFromInputs(inputSha256);
assert.equal(browserExtraSourceFingerprint(),sourceFingerprint);
const fingerprint={sourceCommit,sourceTree:'4'.repeat(40),sourceInputsSha256:sha(inputSha256),inputSha256,specificationSha256:hex,catalogSha256:inputSha256['verification-evidence-catalog.mjs'],runtime:{node:process.version,platform:process.platform,architecture:process.arch}};
const nativeReport={nativeBrowserCommand:{checkId:'test-ir.native-browser-command',passed:true,synthetic:true,actualBrowser:true,buildIdentity,testWorkerSha256:hex,cases:[22,24].map(stage=>({stage,nativeRequests:1,storeCommands:1,actualTestWorker:true,actualStorageWorker:true,actualIndexedDB:true,committedAndReloaded:true,completeIdentityRetained:true,current:true,rawDefinitionPreserved:true,canonicalIntegrity:true,fullStageCompletionClaimed:false,projectSha256:hex,identitySha256:hex,...(stage===22?{mutationConfirmation:{code:'MUTATION_CONFIRMATION_REQUIRED',actualStorageWorker:true,exactCurrentImpact:true,savedDigestUnchanged:true,savedRevisionUnchanged:true,committedProofRetained:true}}:{})}))}};
function carrier(laneId,scope='LOCAL'){
 const base=scope==='LOCAL'?'http://127.0.0.1:'+String(12000+Number(laneId.slice(-1)))+'/':manifest.canonicalOrigin+manifest.canonicalBasePath;
 const scripts=manifest.runtimeResources.filter(row=>row.path.endsWith('.js')&&row.path!=='test-worker.js').map(row=>({path:row.path,byteSize:row.byteSize,sha256:row.digest,url:new URL(row.path,base).href,targetType:'PAGE',observation:'DEBUGGER_SCRIPT_SOURCE'}));
 const workers=BROWSER_EXTRA_LANES.find(lane=>lane.laneId===laneId).requiredWorkerPaths.map(name=>{const row=manifest.runtimeResources.find(row=>row.path===name);return {path:name,byteSize:row.byteSize,sha256:row.digest,url:new URL(name+(name==='project-store.js'?'?storeWorker=1&storeContext=synthetic-'+laneId:'?worker=1'),base).href,targetType:'WORKER',observation:'DEBUGGER_SCRIPT_SOURCE'};});
 return {schema:'closed-loop-browser-execution/1',suite,scope,sourceCommit,manifestDigest:manifest.manifestDigest.digest,buildIdentity,pageUrl:base,pageOrigin:new URL(base).origin,browserVersion:'SYNTHETIC_ADMISSION_CONTROL_ONLY',complete:true,applicationReady:true,resources:manifest.runtimeResources.map(row=>({path:row.path,byteSize:row.byteSize,sha256:row.digest,responseUrl:new URL(row.path,base).href,status:200,observation:'BROWSER_HTTP_BYTES'})),observedScriptSources:[...scripts,...workers],observedDocuments:[{url:base,status:200,byteSize:0,sha256:hex,observation:'BROWSER_DOCUMENT_RESPONSE'}],observedWorkers:workers.map(row=>row.url),unobservedRuntimeResources:manifest.runtimeResources.filter(row=>![...scripts,...workers].some(script=>script.path===row.path)).map(row=>row.path).sort()};
}
function fixture(scope='LOCAL'){
 const children=BROWSER_EXTRA_LANES.map(lane=>{
  const reports=lane.laneId==='lane2'?[{storageReliabilityStalePart:{staleCreatePreserved:true}}]:lane.laneId==='lane4'?[{storageReliabilityBrowserPart:{packageCustodyProof:{requiredMembers:true},importCommitProof:{commit:true},importSurvivedReload:true}},structuredClone(nativeReport)]:[{syntheticLane:lane.laneId}];
  return {schema:BROWSER_EXTRA_CHILD_SCHEMA,laneId:lane.laneId,invocationId,sourceFingerprint,complete:true,scenarios:lane.scenarios.map(id=>({id,population:structuredClone(populations[id]),passed:true})),reports,reportsSha256:sha(reports),browserExecution:scope?carrier(lane.laneId,scope):null,dialogs:[],runtimeErrors:0,outcome:'PASS',exitCode:0,signal:null,timedOut:false};
 });
 const aggregate={schema:BROWSER_EXTRA_AGGREGATE_SCHEMA,invocationId,sourceFingerprint,complete:true,elapsedMs:100,deadlineMs:600000,maxConcurrent:4,cleanupComplete:true,sourceChecks:{before:true,after:true},children};
 const browserExecution=children[0].browserExecution;
 const owner={browserExtraVerified:true,completeBrowserExtraAggregate:true,browserExtraAggregate:aggregate,browserExecution,exactPromptCopy:true,pendingProposalReload:true,successfulExport:true,successfulImport:true,canonicalDataRoundTrip:true,retainedNotDuplicated:true,retainedDeleteSuppression:true,projectLifecycleFunctional:true,blockerControl:true,freshContextControlContextual:true,blobPersistence:true,artifactIdempotence:true,twoTabConflict:true,storageFailureRollback:true,transactionMutatorLifetime:true,closedConnectionPromptSave:true,runtimeErrors:0};
 const reports=[...children.flatMap(child=>child.reports),{storageReliabilityBrowser:true,staleCreatePreserved:true,requiredMembers:true,commit:true,importSurvivedReload:true},owner];
 return {aggregate,browserExecution,reports,expected:scope?{scope,manifest,sourceCommit}:null,sourceFingerprint};
}
const cases=[];
for(const scope of ['LOCAL','DEPLOYED',null]){const row=fixture(scope);assert.equal(validateBrowserExtraAggregate(row.aggregate,row),true);cases.push('conforming-'+(scope||'explicit-unscoped'))}
assert.equal(BROWSER_EXTRA_LANES.length,4);assert.deepEqual(BROWSER_EXTRA_LANES.map(row=>row.scenarios.length),[18,4,4,8]);assert.equal(new Set(BROWSER_EXTRA_LANES.flatMap(row=>row.scenarios)).size,34);
const mutations=[
 ['missing-lane',row=>row.aggregate.children.pop()],['duplicate-lane',row=>row.aggregate.children[1]=structuredClone(row.aggregate.children[0])],['unknown-lane',row=>row.aggregate.children[2].laneId='lane5'],
 ['missing-scenario',row=>row.aggregate.children[0].scenarios.pop()],['duplicate-scenario',row=>row.aggregate.children[0].scenarios[1]=structuredClone(row.aggregate.children[0].scenarios[0])],['unknown-scenario',row=>row.aggregate.children[0].scenarios[0].id='invented'],
 ['failed-scenario',row=>row.aggregate.children[2].scenarios[0].passed=false],['nonzero-child',row=>row.aggregate.children[1].exitCode=1],['signal-child',row=>row.aggregate.children[1].signal='SIGTERM'],['timeout-child',row=>row.aggregate.children[1].timedOut=true],
 ['incomplete-terminal',row=>row.aggregate.children[1].complete=false],['child-nonce',row=>row.aggregate.children[1].invocationId='0'.repeat(64)],['child-source',row=>row.aggregate.children[1].sourceFingerprint='0'.repeat(64)],
 ['aggregate-source',row=>row.aggregate.sourceFingerprint='0'.repeat(64)],['dialogs',row=>row.aggregate.children[1].dialogs.push('unexpected')],['runtime-error',row=>row.aggregate.children[1].runtimeErrors=1],['hidden-error',row=>row.aggregate.children[1].error='failure'],
 ['reports-digest',row=>row.aggregate.children[1].reportsSha256='0'.repeat(64)],['focused-child-owner-masquerade',row=>row.aggregate.children[0].browserExtraVerified=true],['focused-child-reports-masquerade',row=>row.aggregate.children[0].reports.push({browserExtraVerified:true})],
 ['source-postcheck-failure',row=>row.aggregate.sourceChecks.after=false],['cleanup-incomplete',row=>row.aggregate.cleanupComplete=false],['late-success',row=>row.aggregate.elapsedMs=600000],['extended-deadline',row=>row.aggregate.deadlineMs=600001],
 ['missing-lane4-test-worker',row=>{const value=row.aggregate.children[3].browserExecution;value.observedScriptSources=value.observedScriptSources.filter(script=>script.path!=='test-worker.js');value.observedWorkers=value.observedWorkers.filter(url=>!url.includes('test-worker.js'));value.unobservedRuntimeResources.push('test-worker.js');value.unobservedRuntimeResources.sort();}],
 ['wrong-concurrency',row=>row.aggregate.maxConcurrent=3],['invented-union-carrier',row=>{row.browserExecution=structuredClone(row.browserExecution);row.browserExecution.browserVersion='INVENTED UNION';}],
 ['duplicate-final-marker',row=>row.reports.push(structuredClone(row.reports.at(-1)))],['missing-native-report',row=>row.reports.splice(row.reports.findIndex(row=>row.nativeBrowserCommand),1)],
 ['duplicated-parent-child-report',row=>row.reports.unshift(structuredClone(row.reports[0]))],['fabricated-storage-union',row=>row.reports.find(row=>row.storageReliabilityBrowser).commit=false]
];
for(let i=0;i<4;i++)for(const [name,change] of [
 ['scope',value=>value.scope='DEPLOYED'],['source',value=>value.sourceCommit='0'.repeat(40)],['build',value=>value.buildIdentity='build-sha256-'+'0'.repeat(64)],['manifest',value=>value.manifestDigest='0'.repeat(64)],
 ['missing-page-script',value=>value.observedScriptSources=value.observedScriptSources.filter(row=>row.path!=='app-core.js')],['wrong-script-bytes',value=>value.observedScriptSources[0].sha256='0'.repeat(64)],
 ['missing-document',value=>value.observedDocuments=[]],['wrong-document-bytes',value=>value.observedDocuments[0].sha256='0'.repeat(64)],
 ['missing-worker',value=>{value.observedScriptSources=value.observedScriptSources.filter(row=>row.targetType!=='WORKER');value.observedWorkers=[];}],['wrong-worker-bytes',value=>value.observedScriptSources.find(row=>row.targetType==='WORKER').sha256='0'.repeat(64)],
 ['wrong-http-bytes',value=>value.resources[0].sha256='0'.repeat(64)]
])mutations.push(['lane'+(i+1)+'-'+name,row=>change(row.aggregate.children[i].browserExecution)]);
for(let i=0;i<4;i++)for(const mode of ['archive-parser-only','missing-store-worker-role','wrong-store-worker-role'])mutations.push(['lane'+(i+1)+'-'+mode,row=>{
 const execution=row.aggregate.children[i].browserExecution;
 for(const source of execution.observedScriptSources.filter(source=>source.path==='project-store.js'&&source.targetType==='WORKER')){const before=source.url,url=new URL(before);if(mode==='archive-parser-only')url.searchParams.set('archiveParser','1');else if(mode==='missing-store-worker-role')url.searchParams.delete('storeWorker');else url.searchParams.set('storeWorker','0');source.url=url.href;execution.observedWorkers=execution.observedWorkers.map(value=>value===before?source.url:value);}
},/BROWSER_EXTRA_AGGREGATE_ORACLE: actual native storage worker was not observed/]);
for(const lane of BROWSER_EXTRA_LANES)for(const id of lane.scenarios)mutations.push(['wrong-population:'+id,row=>row.aggregate.children.find(child=>child.laneId===lane.laneId).scenarios.find(scenario=>scenario.id===id).population={executions:999}]);
for(const [name,change,pattern=/BROWSER_(?:EXTRA_AGGREGATE_ORACLE|EXECUTION_EVIDENCE)/]of mutations){const row=fixture();change(row);assert.throws(()=>validateBrowserExtraAggregate(row.aggregate,row),pattern,name);cases.push(name);}
const valid=fixture(),stdout=valid.reports.map(row=>JSON.stringify(row)).join('\n');
const receipt=createExecutionReceipt(suite,{command:[process.execPath,suite],exitCode:0,outcome:'PASS',stdout,stderr:''},{fingerprint,browser:{scope:'LOCAL',manifest}});
assert.equal(validateExecutionReceipt(JSON.parse(JSON.stringify(receipt)),suite,fingerprint).receiptSha256,receipt.receiptSha256);cases.push('complete-current-receipt-roundtrip');
for(const [name,mutate]of [
 ['historical-single-carrier-not-reinterpreted',value=>{delete value.reports.at(-1).browserExtraAggregate;delete value.reports.at(-1).completeBrowserExtraAggregate;}],
 ['focused-command',value=>value.command.push('--lane1')],['extra-top-level-carrier',value=>value.reports.push({browserExecution:structuredClone(value.reports.at(-1).browserExecution)})],
 ['receipt-child-source-substitution',value=>value.reports.at(-1).browserExtraAggregate.children[2].sourceFingerprint='0'.repeat(64)],
 ['receipt-lane4-script-substitution',value=>value.reports.at(-1).browserExtraAggregate.children[3].browserExecution.observedScriptSources[0].sha256='0'.repeat(64)]
]){const copy=structuredClone(receipt);mutate(copy);delete copy.receiptSha256;copy.receiptSha256=sha(copy);assert.throws(()=>validateExecutionReceipt(copy,suite,fingerprint),/EVIDENCE|AGGREGATE/,name);cases.push(name);}
const child=structuredClone(valid.aggregate.children[0]);for(const field of ['outcome','exitCode','signal','timedOut','reportsSha256'])delete child[field];
const childStdout='progress\n'+child.reports.map(row=>JSON.stringify(row)).join('\n')+'\n'+JSON.stringify({browserExtraChild:child})+'\n';
assert.deepEqual(parseBrowserExtraChildOutput(childStdout).child,child);
for(const [name,output]of [['duplicate-child-terminal',childStdout+JSON.stringify({browserExtraChild:child})+'\n'],['missing-child-terminal','progress\n'],['incomplete-child-terminal',childStdout.slice(0,-5)],['stdout-after-terminal',childStdout+'late progress\n'],['stdout-report-substitution',childStdout.replace('"syntheticLane":"lane1"','"syntheticLane":"WRONG"')]]){assert.throws(()=>parseBrowserExtraChildOutput(output),/AGGREGATE/,name);cases.push(name);}

// These controls launch real isolated Node process groups, never Chromium.
const directory=fs.mkdtempSync(path.join(process.cwd(),'.browser-extra-process-controls-'));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const live=pid=>{try{const status=fs.readFileSync('/proc/'+pid+'/stat','utf8');return !/\) [ZX] /.test(status);}catch{return false;}};
const processCases=[],socketProofs=[];
try{
 fs.writeFileSync(path.join(directory,suite),'// synthetic process-control source\n');fs.writeFileSync(path.join(directory,'browser-extra-aggregate.mjs'),'// synthetic process-control source\n');
 const terminalByLane=Object.fromEntries(valid.aggregate.children.map(row=>[row.laneId,row]));
 const controlCode=`
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict');
const lane=process.env.CLOSED_LOOP_BROWSER_EXTRA_LANE,mode=process.env.CONTROL_MODE,dir=process.env.CONTROL_DIRECTORY;
const profile=process.env.CLOSED_LOOP_BROWSER_EXTRA_PROFILE_PATH;
fs.writeFileSync(profile+'/synthetic-browser-profile-sentinel','owned');
const temporary=require('node:os').tmpdir()+'/synthetic-fixture-temp';fs.writeFileSync(temporary,'owned fixture tempfile');fs.writeFileSync(dir+'/'+lane+'.tempfile',temporary);
fs.appendFileSync(process.env.CLOSED_LOOP_BROWSER_EXTRA_CHROMIUM_STDERR_PATH,'synthetic Chromium stderr '+lane+'\\n');
const child=JSON.parse(process.env.CONTROL_CHILDREN)[lane];child.invocationId=process.env.CLOSED_LOOP_BROWSER_EXTRA_INVOCATION_ID;child.sourceFingerprint=process.env.CLOSED_LOOP_BROWSER_EXTRA_SOURCE_FINGERPRINT;child.browserExecution=null;
for(const key of ['outcome','exitCode','signal','timedOut','reportsSha256'])delete child[key];
const complete=()=>{for(const row of child.reports)console.log(JSON.stringify(row));console.log(JSON.stringify({browserExtraChild:child}));};
fs.writeFileSync(dir+'/'+lane+'.pid',String(process.pid));fs.writeFileSync(dir+'/'+lane+'.deadline',process.env.CLOSED_LOOP_BROWSER_EXTRA_DEADLINE_AT);
if(mode==='unix-socket'){
 const net=require('node:net'),socketDirectory=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'.org.chromium.Chromium.')),socketPath=path.join(socketDirectory,'SingletonSocket');
 const server=net.createServer(socket=>socket.once('data',data=>{assert.equal(data.toString(),'probe');socket.end('ack');}));
 server.on('error',error=>{console.error('UNIX_SOCKET_CONTROL_FAILURE',error);process.exitCode=1;});
 server.listen(socketPath,()=>{
  assert(fs.statSync(socketPath).isSocket(),'exact socket pathname missing or truncated');assert(Buffer.byteLength(socketPath)<100,'Chromium-shaped socket pathname is too long');
  const client=net.createConnection(socketPath,()=>client.write('probe'));let reply='';client.on('data',data=>reply+=data);client.on('end',()=>{assert.equal(reply,'ack');server.close(()=>{fs.writeFileSync(dir+'/'+lane+'.socket-proof',JSON.stringify({socketPath,bytes:Buffer.byteLength(socketPath),exchange:'probe/ack'}));complete();});});
 });
}else if(mode==='success'||mode==='postcheck'||mode==='sourcechange'){setTimeout(complete,40);}
else if(mode==='orphan'){const descendant=cp.spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});setInterval(()=>{},50)"],{stdio:'ignore'});fs.writeFileSync(dir+'/'+lane+'.descendant',String(descendant.pid));setTimeout(()=>{complete();process.exit(0);},80);}
else{const descendant=cp.spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});setInterval(()=>{},50)"],{stdio:'ignore'});fs.writeFileSync(dir+'/'+lane+'.descendant',String(descendant.pid));if(mode==='failure'&&lane==='lane2')setTimeout(()=>process.exit(7),120);else if(mode==='signal'&&lane==='lane3')setTimeout(()=>process.kill(process.pid,'SIGTERM'),120);else if(mode==='malformed'&&lane==='lane1')setTimeout(()=>{console.log('{\\"browserExtraChild\\":{}}');process.exit(0);},120);else {setTimeout(complete,2000);setInterval(()=>{},50);}}
`;
 function inspectOwnedProfile(options,runDir,ownedProfiles){
  const profile=options.env.CLOSED_LOOP_BROWSER_EXTRA_PROFILE_PATH;ownedProfiles.push(profile);
  assert.equal(path.dirname(profile),'/tmp');assert.match(path.basename(profile),/^be-/);assert(Buffer.byteLength(profile)<40);assert.equal(fs.statSync(profile).mode&0o777,0o700);
  for(const key of ['TMPDIR','TMP','TEMP'])assert.equal(options.env[key],profile);
  const diagnostic=options.env.CLOSED_LOOP_BROWSER_EXTRA_CHROMIUM_STDERR_PATH;assert.equal(diagnostic,path.resolve(runDir,options.env.CLOSED_LOOP_BROWSER_EXTRA_LANE+'.chromium.stderr.log'));assert.equal(fs.readFileSync(diagnostic,'utf8'),'');
 }
 async function run(mode,{deadlineMs=2500,longEvidence=false}={}){
  const caseName=longEvidence?'long-evidence-'+mode:mode,runDir=path.join(directory,caseName,...(longEvidence?['evidence-'.repeat(20)]:[]));fs.mkdirSync(runDir,{recursive:true});let launches=0;const phases=[],ownedProfiles=[];
  const inheritedTemp=path.join(runDir,'inherited-temporary-root');fs.mkdirSync(inheritedTemp);const unrelated=path.join(inheritedTemp,'do-not-remove');fs.writeFileSync(unrelated,'unrelated preserved');
  if(longEvidence)assert(Buffer.byteLength(runDir)>150);
  const call=()=>superviseBrowserExtra({cwd:directory,deadlineMs,onFailureOutput:()=>{},environment:{...process.env,TMPDIR:inheritedTemp,TMP:inheritedTemp,TEMP:inheritedTemp},sourceChecks:phase=>{phases.push(phase);if(mode==='postcheck'&&phase==='after')throw new Error('CONTROLLED_SOURCE_ONLY_POSTCHECK');if(mode==='sourcechange'&&phase==='after')fs.appendFileSync(path.join(directory,suite),'// mutation\n');},outputDirectory:runDir,spawnChild:(command,args,options)=>{launches++;inspectOwnedProfile(options,runDir,ownedProfiles);const child=spawn(command,['-e',controlCode],{...options,env:{...options.env,CONTROL_MODE:mode==='missing-close'?'success':mode,CONTROL_DIRECTORY:runDir,CONTROL_CHILDREN:JSON.stringify(terminalByLane)}});if(mode==='missing-close'){const emit=child.emit.bind(child);child.emit=(event,...args)=>event==='close'?true:emit(event,...args);}return child;}});
  let result;
  if(['success','orphan','unix-socket'].includes(mode))result=await call();else await assert.rejects(call,/AGGREGATE|CONTROLLED_SOURCE_ONLY_POSTCHECK/);
  assert.equal(launches,4,'exactly four processes launch');assert.equal(new Set(ownedProfiles).size,4,'each lane owns an isolated root');
  const deadlines=fs.readdirSync(runDir).filter(name=>name.endsWith('.deadline')).map(name=>fs.readFileSync(path.join(runDir,name),'utf8'));assert.equal(deadlines.length,4);assert.equal(new Set(deadlines).size,1,'all children inherit the same absolute deadline');
  for(const name of fs.readdirSync(runDir).filter(name=>/\.(?:pid|descendant)$/.test(name))){const pid=Number(fs.readFileSync(path.join(runDir,name)));assert.equal(live(pid),false,'surviving process '+name+': '+pid);}
  for(const profile of ownedProfiles)assert(!fs.existsSync(profile),'owned browser/temp root leaked: '+profile);
  assert.equal(fs.readFileSync(unrelated,'utf8'),'unrelated preserved','cleanup removed an unowned inherited temporary root');
  for(const name of fs.readdirSync(runDir).filter(name=>name.endsWith('.tempfile')))assert(!fs.existsSync(fs.readFileSync(path.join(runDir,name),'utf8')),'owned fixture tempfile leaked');
  for(const lane of BROWSER_EXTRA_LANES){assert(fs.existsSync(path.join(runDir,lane.laneId+'.stdout.log')));assert(fs.existsSync(path.join(runDir,lane.laneId+'.stderr.log')));assert.equal(fs.readFileSync(path.join(runDir,lane.laneId+'.chromium.stderr.log'),'utf8'),'synthetic Chromium stderr '+lane.laneId+'\n');}
  if(result){assert.deepEqual(phases,['before','after']);assert.equal(result.rawChildren.length,4);assert.equal(result.browserExecution,null);for(const row of result.rawChildren){assert(!row.stdoutWithoutTerminal.includes('browserExtraChild'));assert.equal(row.stdout,fs.readFileSync(row.stdoutPath,'utf8'));assert.equal(row.chromiumStderrPath,path.join(runDir,row.laneId+'.chromium.stderr.log'));}}
  if(mode==='unix-socket'){for(const lane of BROWSER_EXTRA_LANES){const proof=JSON.parse(fs.readFileSync(path.join(runDir,lane.laneId+'.socket-proof'),'utf8'));assert.equal(proof.exchange,'probe/ack');assert(proof.bytes<100);assert(!fs.existsSync(path.dirname(proof.socketPath)),'owned socket directory leaked');socketProofs.push({laneId:lane.laneId,...proof,evidenceDirectoryBytes:Buffer.byteLength(runDir)});}}
  if(mode==='timeout'){await wait(100);for(const lane of BROWSER_EXTRA_LANES)assert(!fs.readFileSync(path.join(runDir,lane.laneId+'.stdout.log'),'utf8').includes('browserExtraChild'),'late success leaked');}
  processCases.push(caseName);
 }
 await run('success');await run('orphan');await run('failure');await run('signal');await run('malformed');await run('timeout',{deadlineMs:500});await run('missing-close',{deadlineMs:500});await run('postcheck');await run('sourcechange');processCases.push((await verifyBrowserExtraCleanupRetentionControl()).caseName);await run('unix-socket',{longEvidence:true});await run('failure',{longEvidence:true});await run('timeout',{deadlineMs:500,longEvidence:true});
 let precheckLaunches=0;await assert.rejects(()=>superviseBrowserExtra({cwd:directory,sourceChecks:()=>{throw new Error('CONTROLLED_SOURCE_ONLY_PRECHECK');},onFailureOutput:()=>{},outputDirectory:path.join(directory,'precheck'),spawnChild:()=>{precheckLaunches++;throw new Error('should not spawn');}}),/CONTROLLED_SOURCE_ONLY_PRECHECK/);assert.equal(precheckLaunches,0);processCases.push('source-precheck-never-launches');
 const partialDir=path.join(directory,'partial-spawn');fs.mkdirSync(partialDir);const partialProfiles=[];let partialLaunches=0,firstChild;await assert.rejects(()=>superviseBrowserExtra({cwd:directory,sourceChecks:()=>{},onFailureOutput:()=>{},outputDirectory:partialDir,spawnChild:(command,args,options)=>{inspectOwnedProfile(options,partialDir,partialProfiles);if(++partialLaunches===2)throw new Error('CONTROLLED_SYNC_SPAWN_FAILURE');firstChild=spawn(command,['-e','setInterval(()=>{},50)'],options);return firstChild;}}),/CONTROLLED_SYNC_SPAWN_FAILURE/);assert.equal(live(firstChild.pid),false);assert.equal(partialProfiles.length,2);for(const profile of partialProfiles)assert(!fs.existsSync(profile),'partial spawn profile leaked');processCases.push('partial-spawn-failure-cleans-started-child');
 let spawned=false;await assert.rejects(()=>superviseBrowserExtra({cwd:directory,deadlineMs:50,startedAt:Date.now()-100,onFailureOutput:()=>{},sourceChecks:()=>{},outputDirectory:path.join(directory,'expired-setup'),spawnChild:()=>{spawned=true;throw Error('should not launch');}}),/deadline/);assert.equal(spawned,false);processCases.push('setup-already-exhausted-never-launches');
}finally{fs.rmSync(directory,{recursive:true,force:true});}
return {browserExtraAggregateControls:'PASS',synthetic:true,actualBrowser:false,applicationAssertionsExecuted:false,eligibleReceiptCreated:false,cases,processCases,socketProofs};
}
if(path.resolve(process.argv[1]||'')===fileURLToPath(import.meta.url))console.log(JSON.stringify(await verifyBrowserExtraAggregateControls()));
