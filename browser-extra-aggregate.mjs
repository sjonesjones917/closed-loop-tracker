// Repository-only orchestration and admission contract. This does not execute
// application assertions, synthesize browser observations, or renew old receipts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash,randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {validateBrowserExecution} from './browser-execution-evidence.mjs';

export const BROWSER_EXTRA_SUITE='verify-browser-extra.mjs';
export const BROWSER_EXTRA_DEADLINE_MS=600000;
export const BROWSER_EXTRA_CHILD_SCHEMA='closed-loop-browser-extra-child/1';
export const BROWSER_EXTRA_AGGREGATE_SCHEMA='closed-loop-browser-extra-aggregate/1';
const check=(value,message)=>assert.ok(value,'BROWSER_EXTRA_AGGREGATE_ORACLE: '+message);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const digest=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const rootInput=name=>!name.startsWith('.')&&/^[^/\\]+\.(?:m?js|html|css)$/.test(name);
const frozen=lanes=>Object.freeze(lanes.map(lane=>Object.freeze({...lane,scenarios:Object.freeze(lane.scenarios),requiredWorkerPaths:Object.freeze(lane.requiredWorkerPaths)})));
export const BROWSER_EXTRA_LANES=frozen([
 {laneId:'lane1',scenarios:['stage01-confirmation-deadlock','stage01-atomic-human-authority-self-staleness','stage03-duplicate-response-recovery','project-lifecycle-ui','project-lifecycle-functional','closed-connection-stage-package-save','proposal-reload','real-replacement-confirmation','package-round-trip','artifact-logical-paths','blob-persistence','two-tab-cas','storage-failure-rollback','transaction-mutator-lifetime','canonical-write-integrity','support-controls','retained-project-delete-suppression','prompt-context-read-snapshot'],requiredWorkerPaths:['project-store.js']},
 {laneId:'lane2',scenarios:['correction-instruction-to-accepted-proposition-persistence','stage05-export-and-application-failures-inline','automatic-stage05-review-and-stage06-proof-review','stale-new-project-and-atomic-bulk-write'],requiredWorkerPaths:['project-store.js']},
 {laneId:'lane3',scenarios:['cross-stage-review-correction','accumulated-stage04-startup-views-and-exports','large-response-history-handoff-and-ui-restore','backup-projection-validation-and-ui-restore'],requiredWorkerPaths:['project-store.js']},
 {laneId:'lane4',scenarios:['file-intake-navigation-and-rollback','complete-backup-custody-and-import-commit-boundary','project-picker-startup-and-quarantine','nonblocking-storage-diagnostics','version-one-upgrade-and-blocked-tab-recovery','delayed-import-activity-preserves-layout','native-worker-owned-inputs','worker-save-heartbeat-and-commit-recovery'],requiredWorkerPaths:['project-store.js','test-worker.js']}
]);
export function browserExtraSourceFingerprint(cwd=process.cwd()){
 const inputs=Object.fromEntries(fs.readdirSync(cwd).filter(rootInput).sort().map(name=>[name,digest(fs.readFileSync(path.join(cwd,name)))]));
 check(Object.hasOwn(inputs,BROWSER_EXTRA_SUITE)&&Object.hasOwn(inputs,'browser-extra-aggregate.mjs'),'owning sources missing');
 return browserExtraFingerprintFromInputs(inputs);
}
export function browserExtraFingerprintFromInputs(inputs){
 check(plain(inputs),'source input fingerprint missing');
 const rows=Object.keys(inputs).filter(rootInput).sort();
 check(rows.includes(BROWSER_EXTRA_SUITE)&&rows.includes('browser-extra-aggregate.mjs')&&rows.every(name=>hex(inputs[name])),'owning source fingerprint incomplete');
 return digest(Object.fromEntries(rows.map(name=>[name,inputs[name]])));
}
export function browserExtraRequiredPopulations(){
 return {...Object.fromEntries(BROWSER_EXTRA_LANES.flatMap(lane=>lane.scenarios.map(id=>[id,{executions:1}]))),...{"prompt-context-read-snapshot":{"references":258,"uniqueFiles":129,"reads":129,"transactions":1,"available":129,"savedPrompts":16,"sharedArtifacts":1,"abortAtRead":17},"correction-instruction-to-accepted-proposition-persistence":{"accepted":1},"cross-stage-review-correction":{"stages":[2,1]},"accumulated-stage04-startup-views-and-exports":{"attempts":2,"responseCharacters":[128,128],"views":6},"large-response-history-handoff-and-ui-restore":{"attempts":3,"responseCharacters":[256,256,256]},"file-intake-navigation-and-rollback":{"scenarios":["project","stage","revision","second-file-failure","batch-project","last-file-failure"],"files":[2,2,2,2,8,8]},"project-picker-startup-and-quarantine":{"validOwners":50,"corruptOwners":1,"archiveRows":100,"archiveCodeUnits":80000,"postStartupCorruption":1,"mixedAccepted":1,"mixedPending":1,"mixedRemoved":1,"intakeOwners":12},"nonblocking-storage-diagnostics":{"modes":["slow","failed"],"exports":[2,2]},"version-one-upgrade-and-blocked-tab-recovery":{"held":[false,true]},"native-worker-owned-inputs":{"stages":[22,24],"testWorkers":[1,1],"storeCommands":[1,1]},"worker-save-heartbeat-and-commit-recovery":{"rows":100,"rowCodeUnits":80000,"committedOnce":true}}};
}
function checkReportClaims(reports){
 check(Array.isArray(reports)&&reports.every(plain),'child report list malformed');
 for(const report of reports)for(const marker of ['browserExtraVerified','browserExtraAggregate','completeBrowserExtraAggregate','browserExtraChild','browserExecution'])check(!Object.hasOwn(report,marker),'child report masquerades as complete owner: '+marker);
}
function checkChild(value,{lane,invocationId,sourceFingerprint,expected,requiredPopulations}){
 check(plain(value)&&value.schema===BROWSER_EXTRA_CHILD_SCHEMA,'child terminal schema missing');
 check(value.laneId===lane.laneId,'unknown or misplaced child lane');
 check(value.invocationId===invocationId&&value.sourceFingerprint===sourceFingerprint,'child nonce/source mismatch');
 check(value.complete===true&&value.runtimeErrors===0&&isDeepStrictEqual(value.dialogs,[]),'child terminal incomplete or browser/runtime errors');
 for(const field of ['browserExtraVerified','browserExtraAggregate','completeBrowserExtraAggregate','error','reason','focused','focusedOnly'])check(!Object.hasOwn(value,field),'child contains forbidden claim/error: '+field);
 check(Array.isArray(value.scenarios)&&value.scenarios.length===lane.scenarios.length,'missing/duplicate child scenarios');
 for(let i=0;i<lane.scenarios.length;i++){
  const scenario=value.scenarios[i],id=lane.scenarios[i];
  check(plain(scenario)&&scenario.id===id&&scenario.passed===true,'unknown, duplicate, reordered, or failed child scenario');
  check(isDeepStrictEqual(scenario.population,requiredPopulations[id]),'wrong required population: '+id);
 }
 check(!Object.hasOwn(value,'signal')||value.signal===null,'child terminal reports signal');
 checkReportClaims(value.reports);
 if(expected){
  validateBrowserExecution(value.browserExecution,{suite:BROWSER_EXTRA_SUITE,...expected,requiredWorkerPaths:lane.requiredWorkerPaths});
  if(lane.requiredWorkerPaths.includes('project-store.js'))check(value.browserExecution.observedScriptSources.some(row=>{if(row.path!=='project-store.js'||row.targetType!=='WORKER'||!value.browserExecution.observedWorkers.includes(row.url))return false;const query=new URL(row.url).searchParams;return query.get('storeWorker')==='1'&&query.get('archiveParser')!=='1';}),'actual native storage worker was not observed: '+lane.laneId);
 }else check(value.browserExecution===null,'unscoped child must not claim browser execution');
 return true;
}
export function parseBrowserExtraChildOutput(stdout){
 const reports=[],segments=[];let pending='',start=-1;const lines=String(stdout).split('\n');
 for(let i=0;i<lines.length;i++){
  const line=lines[i];if(!pending&&!line.startsWith('{'))continue;
  if(!pending)start=i;pending+=(pending?'\n':'')+line;
  let report;try{report=JSON.parse(pending);}catch(error){if(!(error instanceof SyntaxError))throw error;continue;}
  check(plain(report),'structured stdout must be an object');reports.push(report);segments.push({start,end:i,report});pending='';
 }
 check(!pending,'incomplete structured child output');
 const terminals=reports.filter(row=>Object.hasOwn(row,'browserExtraChild'));
 check(terminals.length===1&&Object.keys(terminals[0]).length===1,'missing/duplicate child terminal marker');
 const terminal=terminals[0],segment=segments.find(row=>row.report===terminal);
 check(reports.at(-1)===terminal&&lines.slice(segment.end+1).every(line=>!line.trim()),'child emitted output after terminal');
 const ordinary=reports.filter(row=>row!==terminal);checkReportClaims(ordinary);
 check(isDeepStrictEqual(ordinary,terminal.browserExtraChild?.reports),'terminal reports differ from actual buffered stdout');
 return {child:terminal.browserExtraChild,reports:ordinary,stdoutWithoutTerminal:[...lines.slice(0,segment.start),...lines.slice(segment.end+1)].join('\n')};
}
export function validateBrowserExtraAggregate(aggregate,{browserExecution,reports,expected=null,sourceFingerprint,requiredPopulations=browserExtraRequiredPopulations()}={}){
 check(plain(aggregate)&&aggregate.schema===BROWSER_EXTRA_AGGREGATE_SCHEMA,'missing aggregate schema');
 check(hex(aggregate.invocationId)&&hex(sourceFingerprint)&&aggregate.sourceFingerprint===sourceFingerprint,'aggregate nonce/source missing or changed');
 check(aggregate.complete===true&&aggregate.maxConcurrent===4&&aggregate.cleanupComplete===true&&isDeepStrictEqual(aggregate.sourceChecks,{before:true,after:true}),'aggregate completion/source checks/cleanup missing');
 check(Number.isFinite(aggregate.elapsedMs)&&aggregate.elapsedMs>=0&&Number.isSafeInteger(aggregate.deadlineMs)&&aggregate.deadlineMs>0&&aggregate.deadlineMs<=BROWSER_EXTRA_DEADLINE_MS&&aggregate.elapsedMs<aggregate.deadlineMs,'aggregate exceeded its one absolute deadline');
 check(Array.isArray(aggregate.children)&&aggregate.children.length===4,'aggregate needs exactly four children');
 check(isDeepStrictEqual(Object.keys(requiredPopulations).sort(),BROWSER_EXTRA_LANES.flatMap(lane=>lane.scenarios).sort()),'required scenario population contract incomplete');
 for(let i=0;i<BROWSER_EXTRA_LANES.length;i++){
  const child=aggregate.children[i];check(child?.outcome==='PASS'&&child.exitCode===0&&child.signal===null&&child.timedOut===false,'child failed, signaled, or timed out');
  checkChild(child,{lane:BROWSER_EXTRA_LANES[i],invocationId:aggregate.invocationId,sourceFingerprint,expected,requiredPopulations});
  check(child.reportsSha256===digest(child.reports),'child report digest mismatch');
 }
 check(isDeepStrictEqual(browserExecution,aggregate.children[0].browserExecution),'top-level browser execution is not the actual lane1 carrier');
 if(reports){
  check(Array.isArray(reports),'parent reports missing');
  const finals=reports.filter(row=>Object.hasOwn(row,'browserExtraVerified'));
  check(finals.length===1&&finals[0].browserExtraVerified===true&&finals[0].completeBrowserExtraAggregate===true&&isDeepStrictEqual(finals[0].browserExtraAggregate,aggregate),'parent final marker missing/duplicate/incomplete');
  check(reports.filter(row=>Object.hasOwn(row,'browserExecution')).length===1&&isDeepStrictEqual(finals[0].browserExecution,browserExecution),'parent actual execution marker duplicated or changed');
  const childReports=aggregate.children.flatMap(child=>child.reports),ordinary=reports.filter(row=>row!==finals[0]);
  const count=(rows,row)=>rows.filter(value=>isDeepStrictEqual(value,row)).length;
  for(const row of childReports)check(count(ordinary,row)===count(childReports,row),'child report missing, duplicated, or changed by parent');
  const combined=ordinary.filter(row=>Object.hasOwn(row,'storageReliabilityBrowser'));
  check(combined.length===1,'combined storage report missing/duplicate');
  const stale=childReports.filter(row=>Object.hasOwn(row,'storageReliabilityStalePart')),storage=childReports.filter(row=>Object.hasOwn(row,'storageReliabilityBrowserPart'));
  check(stale.length===1&&storage.length===1,'storage report contribution missing/duplicate');
  const parts=storage[0].storageReliabilityBrowserPart;
  check(plain(parts)&&isDeepStrictEqual(combined[0],{storageReliabilityBrowser:true,...stale[0].storageReliabilityStalePart,...parts.packageCustodyProof,...parts.importCommitProof,importSurvivedReload:parts.importSurvivedReload}),'parent combined storage report differs from executed child parts');
  check(ordinary.length===childReports.length+1,'unrecognized parent report');
 }
 return true;
}

// One process group per lane includes Chromium and its descendants. Descendant
// termination is owned here even when a child exits early or ignores SIGTERM.
function killGroup(child){
 if(!child?.pid)return;
 try{process.kill(-child.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}
}
function groupHasRunningProcesses(groupId){
 if(!groupId)return false;
 if(process.platform!=='linux'){try{process.kill(-groupId,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}}
 for(const name of fs.readdirSync('/proc')){
  if(!/^\d+$/.test(name))continue;let fields;
  try{const stat=fs.readFileSync('/proc/'+name+'/stat','utf8');fields=stat.slice(stat.lastIndexOf(')')+2).trim().split(/\s+/);}catch(error){if(['ENOENT','ESRCH'].includes(error.code))continue;throw error;}
  if(Number(fields[2])===groupId&&!['Z','X'].includes(fields[0]))return true;
 }
 return false;
}
const replayFailure=rows=>{for(const row of rows){process.stderr.write('browser-extra '+row.laneId+' buffered stdout ('+row.stdoutPath+'):\n'+row.stdout.replace(/^\{"browserExtraChild":.*\}\r?\n?/gm,''));process.stderr.write('browser-extra '+row.laneId+' buffered stderr ('+row.stderrPath+'):\n'+row.stderr);}};
export async function superviseBrowserExtra({cwd=process.cwd(),script=BROWSER_EXTRA_SUITE,deadlineMs=BROWSER_EXTRA_DEADLINE_MS,sourceChecks,expected=null,requiredPopulations=browserExtraRequiredPopulations(),spawnChild=spawn,outputDirectory,startedAt=Date.now(),environment=process.env,onFailureOutput=replayFailure}={}){
 check(Number.isSafeInteger(deadlineMs)&&deadlineMs>0&&deadlineMs<=BROWSER_EXTRA_DEADLINE_MS,'invalid aggregate deadline');
 check(Number.isFinite(startedAt)&&startedAt<=Date.now(),'invalid aggregate start');
 check(typeof sourceChecks==='function','source-only checks must run before and after children');
 const invocationId=randomBytes(32).toString('hex'),deadlineAt=startedAt+deadlineMs,cleanupReserveMs=Math.min(1000,Math.max(20,Math.floor(deadlineMs/10))),workDeadlineAt=deadlineAt-cleanupReserveMs;
 const directory=outputDirectory||(environment.VERIFIER_CHILD_EVIDENCE_DIRECTORY?path.join(environment.VERIFIER_CHILD_EVIDENCE_DIRECTORY,'browser-extra-'+invocationId):fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-browser-extra-aggregate-')));
 fs.mkdirSync(directory,{recursive:true});
 const rawChildren=[],running=[],profilePaths=[],sourceFingerprint=browserExtraSourceFingerprint(cwd);let rejected=false,timer,abortError;
 const ensureTime=()=>check(!rejected&&Date.now()<workDeadlineAt,'absolute deadline elapsed or aggregate already failed');
 let rejectAbort;const aborted=new Promise((_,reject)=>{rejectAbort=reject;});aborted.catch(()=>{});
 const abort=error=>{if(rejected)return;rejected=true;abortError=error;for(const row of running){try{killGroup(row.process);}catch(killError){error.cleanupErrors??=[];error.cleanupErrors.push(killError.message);}}rejectAbort(error);};
 timer=setTimeout(()=>abort(new Error('BROWSER_EXTRA_AGGREGATE_ORACLE: one absolute deadline expired')),Math.max(0,workDeadlineAt-Date.now()));
 const signalHandler=signal=>abort(new Error('BROWSER_EXTRA_AGGREGATE_ORACLE: parent received '+signal));
 const onTerm=()=>signalHandler('SIGTERM'),onInt=()=>signalHandler('SIGINT');process.once('SIGTERM',onTerm);process.once('SIGINT',onInt);
 const bounded=async callback=>{ensureTime();const result=await Promise.race([Promise.resolve().then(callback),aborted]);ensureTime();return result;};
 let completedResult,primaryError;
 try{
  check(await bounded(()=>sourceChecks('before'))!==false,'source-only precheck failed');
  check(browserExtraSourceFingerprint(cwd)===sourceFingerprint,'source changed during precheck');
  const jobs=BROWSER_EXTRA_LANES.map(lane=>{
   ensureTime();
   // Chromium creates Unix sockets beneath TMPDIR. Keep owned temporary roots
   // short even when evidence paths or inherited TMPDIR are much longer.
   const profilePath=fs.mkdtempSync('/tmp/be-');profilePaths.push(profilePath);
   const chromiumStderrPath=path.resolve(directory,lane.laneId+'.chromium.stderr.log');fs.writeFileSync(chromiumStderrPath,'');
   const child=spawnChild(process.execPath,[script],{cwd,env:{...environment,TMPDIR:profilePath,TMP:profilePath,TEMP:profilePath,CLOSED_LOOP_BROWSER_EXTRA_PROFILE_PATH:profilePath,CLOSED_LOOP_BROWSER_EXTRA_CHROMIUM_STDERR_PATH:chromiumStderrPath,CLOSED_LOOP_BROWSER_EXTRA_LANE:lane.laneId,CLOSED_LOOP_BROWSER_EXTRA_INVOCATION_ID:invocationId,CLOSED_LOOP_BROWSER_EXTRA_SOURCE_FINGERPRINT:sourceFingerprint,CLOSED_LOOP_BROWSER_EXTRA_DEADLINE_AT:String(deadlineAt)},detached:true,stdio:['ignore','pipe','pipe']});
   const row={laneId:lane.laneId,profilePath,chromiumStderrPath,process:child,rawBuffers:{stdout:[],stderr:[]},rawSizes:{stdout:0,stderr:0},stdout:'',stderr:'',stdoutPath:path.join(directory,lane.laneId+'.stdout.log'),stderrPath:path.join(directory,lane.laneId+'.stderr.log'),exitCode:null,signal:null};
   running.push(row);rawChildren.push(row);
   const collect=kind=>chunk=>{const bytes=Buffer.from(chunk);row.rawBuffers[kind].push(bytes);row.rawSizes[kind]+=bytes.length;if(row.rawSizes[kind]>64*1024*1024)abort(new Error('BROWSER_EXTRA_AGGREGATE_ORACLE: excessive child '+kind));};
   child.stdout.on('data',collect('stdout'));child.stderr.on('data',collect('stderr'));
   const job=new Promise((resolve,reject)=>{
    row.closedComplete=false;row.closed=new Promise(done=>child.once('close',()=>{row.stdout=Buffer.concat(row.rawBuffers.stdout).toString('utf8');row.stderr=Buffer.concat(row.rawBuffers.stderr).toString('utf8');row.closedComplete=true;done();}));
    child.once('error',error=>{abort(error);reject(error);});
    child.once('exit',(code,signal)=>{row.exitCode=code;row.signal=signal;try{killGroup(child);}catch(error){abort(error);}if(code!==0||signal){const error=new Error('BROWSER_EXTRA_AGGREGATE_ORACLE: '+lane.laneId+' failed exit '+code+' signal '+signal);abort(error);reject(error);}});
    child.once('close',()=>{
     try{
      ensureTime();check(row.exitCode===0&&row.signal===null,'nonzero/signal child exit');
      const parsed=parseBrowserExtraChildOutput(row.stdout);
      checkChild(parsed.child,{lane,invocationId,sourceFingerprint,expected,requiredPopulations});
      row.stdoutWithoutTerminal=parsed.stdoutWithoutTerminal;
      resolve({...parsed.child,outcome:'PASS',exitCode:row.exitCode,signal:row.signal,timedOut:false,reportsSha256:digest(parsed.reports)});
     }catch(error){abort(error);reject(error);}
    });
   });
   job.catch(()=>{});return job;
  });
  const children=await bounded(()=>Promise.all(jobs));
  check(await bounded(()=>sourceChecks('after'))!==false,'source-only postcheck failed');
  check(browserExtraSourceFingerprint(cwd)===sourceFingerprint,'source changed during child execution or postcheck');
  ensureTime();
  for(const row of running)killGroup(row.process);
  const elapsedMs=Date.now()-startedAt;
  check(elapsedMs<deadlineMs,'completion after absolute deadline');
  const browserExtraAggregate={schema:BROWSER_EXTRA_AGGREGATE_SCHEMA,invocationId,sourceFingerprint,complete:false,elapsedMs,deadlineMs,maxConcurrent:4,cleanupComplete:false,sourceChecks:{before:true,after:true},children};
  const browserExecution=children[0].browserExecution;
  completedResult={browserExtraAggregate,browserExecution,reports:children.flatMap(child=>child.reports)};
 }catch(error){abort(error);primaryError=error;}
 finally{
  clearTimeout(timer);
  const cleanupErrors=[];
  try{
   for(const row of running){try{killGroup(row.process);}catch(error){cleanupErrors.push(error);}}
   for(;;){
    const closed=running.every(row=>row.closedComplete),groupsGone=running.every(row=>!groupHasRunningProcesses(row.process.pid));
    if(closed&&groupsGone)break;
    check(Date.now()<deadlineAt,'child closure/process-group cleanup exceeded absolute deadline');
    await new Promise(resolve=>setTimeout(resolve,Math.min(10,Math.max(1,deadlineAt-Date.now()))));
   }
  }catch(error){cleanupErrors.push(error);}
  for(const profilePath of profilePaths){
   const owner=running.find(row=>row.profilePath===profilePath);
   try{
    // Failed cleanup cannot authorize deleting a live process's temporary root.
    // A never-spawned root is safe; an existing owner's group must be absent.
    if(owner)check(!groupHasRunningProcesses(owner.process.pid),'owned browser/temp root retained: process group still running');
    fs.rmSync(profilePath,{recursive:true,force:true,maxRetries:3,retryDelay:50});check(!fs.existsSync(profilePath),'owned browser profile survived cleanup');
   }catch(error){cleanupErrors.push(new Error(error.message+'; profilePath='+profilePath+'; processGroup='+(owner?.process.pid??'not-spawned')));}
  }
  for(const row of rawChildren){for(const kind of ['stdout','stderr']){const bytes=Buffer.concat(row.rawBuffers[kind]);row[kind]=bytes.toString('utf8');try{fs.writeFileSync(row[kind+'Path'],bytes);}catch(error){cleanupErrors.push(error);}}}
  if(Date.now()>=deadlineAt)cleanupErrors.push(new Error('BROWSER_EXTRA_AGGREGATE_ORACLE: cleanup/log persistence exceeded absolute deadline'));
  primaryError??=abortError;
  if(cleanupErrors.length){if(primaryError)primaryError.cleanupErrors=[...(primaryError.cleanupErrors||[]),...cleanupErrors.map(error=>error.message)];else primaryError=cleanupErrors[0];}
  const diagnostics=rawChildren.map(({process,closed,closedComplete,rawBuffers,rawSizes,...row})=>row);
  if(primaryError&&rawChildren.length){primaryError.rawChildren=diagnostics;try{onFailureOutput(diagnostics);}catch(error){primaryError.outputError=error.message;}}
  process.removeListener('SIGTERM',onTerm);process.removeListener('SIGINT',onInt);
  if(!primaryError){
   check(completedResult,'complete result missing after cleanup');
   completedResult.rawChildren=diagnostics;
   completedResult.browserExtraAggregate.complete=true;
   completedResult.browserExtraAggregate.cleanupComplete=true;
   completedResult.browserExtraAggregate.elapsedMs=Date.now()-startedAt;
  }
 }
 if(primaryError)throw primaryError;
 validateBrowserExtraAggregate(completedResult.browserExtraAggregate,{browserExecution:completedResult.browserExecution,expected,sourceFingerprint,requiredPopulations});
 completedResult.browserExtraAggregate.elapsedMs=Date.now()-startedAt;
 check(completedResult.browserExtraAggregate.elapsedMs<deadlineMs,'final aggregate validation exceeded absolute deadline');
 return completedResult;
}
