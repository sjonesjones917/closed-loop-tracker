import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

globalThis.dispatchEvent=()=>true;
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const engine=globalThis.closedLoopWorkflowEngine,hash=globalThis.closedLoopHash,source=fs.readFileSync('verify-full-cycle.mjs','utf8'),anchor=source.indexOf('const checkpoint=engine.createPreDeliveryCheckpoint(p');
assert.ok(anchor>0);
const capture=path.join(os.tmpdir(),`checkpoint-${process.pid}.json`),script=path.resolve(`.checkpoint-${process.pid}.mjs`);
fs.writeFileSync(script,source.slice(0,anchor)+`fs.writeFileSync(${JSON.stringify(capture)},JSON.stringify(p));process.exit(0);`);
let fixture;try{execFileSync(process.execPath,[script],{stdio:'pipe',maxBuffer:64*1024*1024});fixture=JSON.parse(fs.readFileSync(capture,'utf8'));}finally{fs.rmSync(script,{force:true});fs.rmSync(capture,{force:true});}
const cases=[],value=engine.recordValue;
function check(name,run){try{run();cases.push({name,result:'PASS'});}catch(error){cases.push({name,result:'FAIL',message:error.message});}}
function prepared(){const p=structuredClone(fixture),checkpoint=engine.createPreDeliveryCheckpoint(p,{packageId:'ACTUAL-PACKAGE',packageSha256:'a'.repeat(64),projectSha256:'b'.repeat(64),artifactManifestSha256:'c'.repeat(64)});return {p,checkpoint};}
function evidence(p,content){const record={id:'EXPORT-OBSERVATION',stage:29,source:'OPERATOR_ACTION',active:true,scope:engine.currentScope(p),fields:{EVIDENCE_ID:'EXPORT-OBSERVATION',APPLICATION_EVIDENCE_KIND:'BACKUP_EXPORT_ACTION_COMPLETED',APPLICATION_EVIDENCE_CONTENT:JSON.stringify(content),SHA256:hash.sha256Value(content),STATUS:'CURRENT'}};engine.refreshRecordHashes(record,'evidenceRecords');p.projectData.evidenceRecords.push(record);return record.id;}
const binding=c=>({checkpointId:engine.recordId(c,'backupCheckpoints'),packageId:value(c,'PACKAGE_ID'),packageSha256:value(c,'PACKAGE_SHA256')});
check('checkpoint preserves the exact exported project digest',()=>{const {checkpoint}=prepared();assert.equal(value(checkpoint,'PROJECT_SHA256'),'b'.repeat(64));});
for(const field of ['checkpointId','packageId','packageSha256'])check(`wrong ${field} is rejected; exact binding progresses`,()=>{const {p,checkpoint}=prepared(),body=binding(checkpoint),bad={...body,[field]:'UNRELATED'};const eid=evidence(p,bad);assert.throws(()=>engine.recordPreDeliveryCheckpointExport(p,{checkpointId:body.checkpointId,exportEvidenceIds:[eid]}),/exact.*checkpoint|checkpoint.*binding/i);p.projectData.evidenceRecords.pop();const valid=evidence(p,body),out=engine.recordPreDeliveryCheckpointExport(p,{checkpointId:body.checkpointId,exportEvidenceIds:[valid]});assert.equal(value(out,'CUSTODY_STATE'),'BACKUP_EXPORT_ACTION_COMPLETED');});
check('export appends custody and does not rewrite the generated receipt',()=>{const {p,checkpoint}=prepared(),before=JSON.stringify(checkpoint),eid=evidence(p,binding(checkpoint));engine.recordPreDeliveryCheckpointExport(p,{checkpointId:engine.recordId(checkpoint,'backupCheckpoints'),exportEvidenceIds:[eid]});assert.equal(JSON.stringify(checkpoint),before);assert.equal(value(engine.currentPreDeliveryCheckpoint(p),'CUSTODY_STATE'),'BACKUP_EXPORT_ACTION_COMPLETED');});
check('upstream correction prevents exporting a stale checkpoint',()=>{const {p,checkpoint}=prepared(),eid=evidence(p,binding(checkpoint));engine.invalidateDownstream(p,28,'Controlled upstream correction');assert.throws(()=>engine.recordPreDeliveryCheckpointExport(p,{checkpointId:engine.recordId(checkpoint,'backupCheckpoints'),exportEvidenceIds:[eid]}),/current|stale|scope|inactive/i);});
check('complete chain exposes a checkpoint export control before terminal authorization',()=>{const p=structuredClone(fixture);assert.equal(engine.operationalNextAction(p,30).actionType,'EXPORT_PRE_DELIVERY_CHECKPOINT');});
console.log(JSON.stringify({checkpointBoundary:cases.every(c=>c.result==='PASS')?'PASS':'FAIL',basis:'SYNTHETIC_PRODUCTION_LIFECYCLE',specificationSections:['36.11','38'],cases},null,2));if(cases.some(c=>c.result!=='PASS'))process.exitCode=1;
