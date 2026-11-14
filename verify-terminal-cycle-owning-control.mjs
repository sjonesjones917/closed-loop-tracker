import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const repo=process.argv[2];
if(!repo)throw new Error('Usage: node terminal-cycle-owning-control.mjs <repository>');
const load=name=>import(pathToFileURL(`${repo}/${name}`).href);
const {projectStoreRuntime}=await load('test-project-store-runtime.mjs');
const {reservedReleasePrerequisiteFixture}=await load('test-release-semantic-fixture.mjs');
const workflowSource=fs.readFileSync(`${repo}/workflow-engine.js`,'utf8');

const revisionAnchor='const projectScope={...scope(p)};delete projectScope.projectRevision;';
const selectionAnchor='const selectedRecords=terminalDerivationSources(project,families,27);';
const exclusionAnchor="excludedFamilies:['releaseGateReviews','releaseRecords','artifactIdentities','evidenceInvestigations','evidenceChains','deliveryRecords','deliveryAttempts']";
for(const [name,anchor] of Object.entries({revisionAnchor,selectionAnchor,exclusionAnchor}))assert.equal(workflowSource.split(anchor).length-1,1,`${name} must identify one production boundary.`);

function runtime(source=workflowSource){
 const r=projectStoreRuntime({sourceOverrides:{'workflow-engine.js':source}});
 return {...r,schema:r.runtime.closedLoopWorkflowSchema};
}

// Establish the earlier lifecycle as an explicit isolated prerequisite. The
// terminal and persistence operations below use their actual production owners.
function prerequisite(r,commandId){
 const storedPromise=r.store.createProject({commandId});
 return storedPromise.then(stored=>{
  const p=reservedReleasePrerequisiteFixture(r,stored.job.JOB_ID);
  for(const key of ['CURRENT_REQUIREMENTS_VERSION','CURRENT_TEST_SUITE_VERSION','CURRENT_INSTRUCTION_VERSION','CURRENT_PRODUCT_VERSION'])p.job[key]=null;
  r.engine.recalculate(p);
  r.engine.recordReleaseDetermination(p);r.engine.recalculate(p);
  const checkpoint=r.engine.createPreDeliveryCheckpoint(p,{packageId:'PACKAGE-TERMINAL-CONTROL',packageSha256:'a'.repeat(64)});
  r.engine.recordCheckpointExportAction(p,{checkpointId:r.engine.recordId(checkpoint,'backupCheckpoints'),packageSha256:'a'.repeat(64),filename:'terminal-control.zip'});
  r.engine.recalculate(p);
  assert.equal(r.store.validateProjectIntegrity(p).valid,true,'The isolated prerequisite must be canonically valid before terminal ownership is tested.');
  return {stored,p};
 });
}

// Only fixture setup enters the Map adapter directly. Both revision-changing
// commits and all subsequent reloads use the production project-store owners.
function seedPrerequisite(r,p){
 const row=r.rows.get('projects').get(p.job.JOB_ID),sha256=r.store.projectSha256(p);
 p.projectSha256=sha256;
 Object.assign(row,{revision:p.revision,project:r.copy(p),projectSha256:sha256,picker:[p.job.JOB_ID,JSON.stringify({title:p.job.JOB_TITLE,revision:p.revision,isRetainedTestProject:false,retainedSpecRevision:null,activeView:p.activeView,activeStage:p.activeStage})]});
}

async function persistedRevisionCase(source,label){
 const r=runtime(source),{p}=await prerequisite(r,`TERMINAL-REVISION-${label}`);seedPrerequisite(r,p);
 let current=await r.store.readProject(p.job.JOB_ID),preTerminalRevision=current.revision;
 const terminal=r.engine.calculateTerminal(current,{expectedRevision:preTerminalRevision});r.engine.recalculate(current);
 assert.equal(r.store.validateProjectIntegrity(current).valid,true,'Terminal calculation must leave a valid project.');
 current=await r.store.writeProject(current,{expectedProjectRevision:preTerminalRevision});
 const deliveryId=r.engine.recordId(terminal,'deliveryRecords'),terminalRevision=current.revision;
 let reloaded=await r.store.readProject(current.job.JOB_ID),record=r.engine.records(reloaded,'deliveryRecords').find(row=>r.engine.recordId(row,'deliveryRecords')===deliveryId);
 assert.ok(record,'The persisted terminal record must reload.');
 const currentAfterTerminalCommit=r.engine.terminalRecordMatches(reloaded,record,r.engine.terminalPrerequisites(reloaded));
 const changed=r.copy(reloaded);changed.job.JOB_TITLE+=` ${label}`;
 let committed;
 try{committed=await r.store.writeProject(changed,{expectedProjectRevision:reloaded.revision,mutationConfirmation:r.store.mutationImpact(reloaded,changed)});}
 catch(error){
  if(error.code!=='MUTATION_CONFIRMATION_REQUIRED'||!error.impact)throw error;
  committed=await r.store.writeProject(changed,{expectedProjectRevision:reloaded.revision,mutationConfirmation:error.impact});
 }
 reloaded=await r.store.readProject(committed.job.JOB_ID);record=r.engine.records(reloaded,'deliveryRecords',{active:false}).find(row=>r.engine.recordId(row,'deliveryRecords')===deliveryId);
 const currentAfterUnrelatedCommit=Boolean(record&&r.engine.terminalRecordMatches(reloaded,record,r.engine.terminalPrerequisites(reloaded)));
 const stillActive=Boolean(record&&r.engine.isActiveRecord(record));
 return {preTerminalRevision,terminalRevision,reloadedRevision:reloaded.revision,deliveryId,currentAfterTerminalCommit,currentAfterUnrelatedCommit,stillActive,deliveryState:record?r.engine.recordValue(record,'DELIVERY_STATE'):null};
}

function hasCycle(edges){
 const next=new Map();for(const [from,to] of edges){if(!next.has(from))next.set(from,[]);next.get(from).push(to);}
 const visiting=new Set(),visited=new Set();
 const walk=node=>{if(visiting.has(node))return true;if(visited.has(node))return false;visiting.add(node);for(const child of next.get(node)||[])if(walk(child))return true;visiting.delete(node);visited.add(node);return false;};
 return [...new Set(edges.flat())].some(walk);
}

async function cycleCase(source,label){
 const r=runtime(source),{p}=await prerequisite(r,`TERMINAL-CYCLE-${label}`),release=r.engine.records(p,'releaseRecords').at(-1);
 const releaseId=r.engine.recordId(release,'releaseRecords'),terminal=r.engine.calculateTerminal(p,{expectedRevision:p.revision}),deliveryId=r.engine.recordId(terminal,'deliveryRecords');
 const releaseBinding=r.engine.releaseCalculation(p).sourceBinding;
 const terminalSources=terminal.derivationInput.sourceBinding.records;
 const edges=[];
 if(releaseBinding.records.some(row=>row.family==='deliveryRecords'&&row.id===deliveryId))edges.push(['stage27.release','stage30.terminal']);
 if(terminalSources.some(row=>row.family==='releaseRecords'&&row.id===releaseId))edges.push(['stage30.terminal','stage27.release']);
 return {releaseId,deliveryId,edges,cycleDetected:hasCycle(edges),releaseBindsDelivery:edges.some(([from,to])=>from==='stage27.release'&&to==='stage30.terminal'),terminalBindsRelease:edges.some(([from,to])=>from==='stage30.terminal'&&to==='stage27.release'),releaseStillCurrent:r.engine.releaseRecordMatchesBinding(release,r.engine.releaseBinding(p))};
}

const revisionMutant=workflowSource.replace(revisionAnchor,'const projectScope={...scope(p),projectRevision:Number(p.revision||0)};');
const cycleMutant=workflowSource
 .replace(selectionAnchor,"const selectedRecords=[...terminalDerivationSources(project,families,27),...recordsForCurrentScope(project,'deliveryRecords').map(row=>({family:'deliveryRecords',row}))];")
 .replace(exclusionAnchor,"excludedFamilies:['releaseGateReviews','releaseRecords','artifactIdentities','evidenceInvestigations','evidenceChains','deliveryAttempts']");

const restoredRevision=await persistedRevisionCase(workflowSource,'RESTORED');
const mutatedRevision=await persistedRevisionCase(revisionMutant,'MUTANT');
assert.equal(restoredRevision.currentAfterTerminalCommit,true,'Restored production terminal must remain current after its own persisted commit.');
assert.equal(restoredRevision.currentAfterUnrelatedCommit,true,'Restored production terminal must remain current across an unrelated persisted revision.');
assert.equal(restoredRevision.stillActive,true,'Restored production terminal must remain active.');
assert.equal(mutatedRevision.currentAfterTerminalCommit,true,'The revision mutant must begin with a current persisted terminal control.');
assert.equal(mutatedRevision.currentAfterUnrelatedCommit,false,'A terminal preimage bound to project revision must self-invalidate on the next persisted revision.');

const restoredCycle=await cycleCase(workflowSource,'RESTORED');
const mutatedCycle=await cycleCase(cycleMutant,'MUTANT');
assert.equal(restoredCycle.terminalBindsRelease,true,'Stage 30 must bind the exact Stage 27 release record.');
assert.equal(restoredCycle.releaseBindsDelivery,false,'Stage 27 must exclude Stage 30 delivery outputs.');
assert.equal(restoredCycle.cycleDetected,false,'The restored Stage 27/30 dependency graph must be acyclic.');
assert.equal(mutatedCycle.releaseBindsDelivery,true,'The deliberate mutant must add Stage 30 delivery as a Stage 27 input.');
assert.equal(mutatedCycle.cycleDetected,true,'The independent graph oracle must detect the deliberate Stage 27/30 cycle.');
assert.equal(mutatedCycle.releaseStillCurrent,false,'The deliberate cycle must make the Stage 27 release stale after Stage 30 writes its own output.');

console.log(JSON.stringify({schema:'terminal-cycle-owning-control/1',checks:[
 {checkId:'terminal-persisted-revision-current-control',passed:true,restored:restoredRevision},
 {checkId:'terminal-revision-self-invalidation-mutant-detected',passed:true,restored:restoredRevision,mutant:mutatedRevision},
 {checkId:'stage27-stage30-dependency-cycle-mutant-detected',passed:true,restored:restoredCycle,mutant:mutatedCycle}
]},null,2));
