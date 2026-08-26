import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine;
const assert=(v,m)=>{if(!v)throw new Error(m);};
const project=id=>{const p=core.createBlankState(id);p.job.JOB_ID=id;p.job.JOB_TITLE='Residual semantic proof';p.job.EXACT_USER_OBJECTIVE_VERBATIM='Proof only';p.job.CURRENT_INPUT_VERSION='INPUT-v001';engine.ensureShape(p);return p;};
const record=(collection,stage,fields,id,scope={})=>{const def=schema.RECORD_SCHEMAS[collection],rid=id||`${def.prefix}-PROOF`;return {id:rid,stage,active:true,scope,fields:{...fields,[def.idField]:rid},...fields,[def.idField]:rid};};

assert(!schema.STAGE_CONTRACTS[18].agentWritableCollections.includes('convergenceRecords'),'Stage 18 still advertises an application-derived collection as agent-writable.');

{
  const p=project('JOB-PROMPT-SCOPE');p.revision=7;p.job.CURRENT_ITERATION='ITER-CURRENT';p.job.CURRENT_PRODUCT_ID='PRODUCT-CURRENT';
  const r=prompts.buildPromptRecord(11,p,{operation:'COMPLETE',scope:{iterationId:'ITER-EXACT',candidateId:'CAND-EXACT',runId:'RUN-EXACT',contextId:'CTX-EXACT',productId:'PRODUCT-EXACT'}});
  assert(r.scope.iterationId==='ITER-EXACT'&&r.scope.candidateId==='CAND-EXACT'&&r.scope.runId==='RUN-EXACT'&&r.scope.contextId==='CTX-EXACT'&&r.scope.productId==='PRODUCT-EXACT','Explicit prompt resource scope was replaced by global current identities.');
  assert(r.scope.projectRevision===7,'Explicit resource scope improperly overrode application-derived project revision.');
}

{
  const p=project('JOB-RELEASE-EARLY');engine.recalculate(p);let blocked=false;try{engine.recordReleaseDetermination(p);}catch(e){blocked=/Stage 26.*COMPLETE/i.test(String(e.message||e));}assert(blocked,'Release determination was recordable before Stage 26 completed.');
}

{
  const p=project('JOB-IDENTITY-AUTH');p.stages[27].status='COMPLETE';const scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.projectData.releaseRecords.push(record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-CURRENT',scope));let blocked=false;try{engine.verifyArtifactIdentity(p,[{artifactId:'ART-X',name:'x.bin',size:1,sha256:'a'.repeat(64)}],[{artifactId:'ART-X',name:'x.bin',size:1,sha256:'a'.repeat(64)}]);}catch(e){blocked=/canonical verified-byte artifact/i.test(String(e.message||e));}assert(blocked,'Engine authorized caller-supplied audited identity without a current canonical verified-byte artifact.');
}

{
  const p=project('JOB-CHAIN-SCOPE'),scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.projectData.requirements.push(record('requirements',4,{MANDATORY_OPTIONAL_STATUS:'MANDATORY',OBLIGATION:'Historical unscoped requirement',STATUS:'ACTIVE'},'REQ-HIST',{}));p.projectData.requirements.push(record('requirements',4,{MANDATORY_OPTIONAL_STATUS:'MANDATORY',OBLIGATION:'Current scoped requirement',STATUS:'ACTIVE',USER_INPUT_RELATIONSHIP:'User Job Input'},'REQ-CURRENT',scope));const made=engine.constructEvidenceChains(p);assert(made.length===1&&engine.recordValue(made[0],'REQ_ID')==='REQ-CURRENT','Stage 29 constructed evidence chains for a requirement outside current scope.');
}

console.log('Residual semantic boundary proofs passed.');
