import {createVerifierRuntime} from './verifier-runtime.mjs';
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {selectExecutionReport} from './execution-report.mjs';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type}};globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const f of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])createVerifierRuntime.loadScript(globalThis,fs.readFileSync(f,'utf8'),{filename:f});
const core=closedLoopCore,schema=closedLoopWorkflowSchema,engine=closedLoopWorkflowEngine;
function record(family,fields,id){const def=schema.RECORD_SCHEMAS[family];return{id,active:true,fields:{...fields,[def.idField]:id},...fields,[def.idField]:id,scope:{inputVersion:'INPUT-v001'}}}
{const p=core.createBlankState('ACTIVATION-NEG');engine.ensureShape(p);p.projectData.requirements.push(record('requirements',{MANDATORY_OPTIONAL_STATUS:'CONDITIONAL',STATUS:'ACTIVE'},'REQ-A'));p.projectData.propositions.push(record('propositions',{REQUIREMENT_ID:'REQ-A'},'PROP-A'));p.projectData.applicabilityRecords.push(record('applicabilityRecords',{SUBJECT_ID:'PROP-A',SELECTED_APPLICABILITY:'APPLICABLE',PROPOSED_APPLICABILITY:'APPLICABLE'},'APP-A'));assert.equal(engine.evaluateApplicability(p,'PROP-A'),'UNKNOWN');assert.equal(schema.RECORD_SCHEMAS.applicabilityRecords.relationships.ACTIVATION_PROOF_OBLIGATION_ID,'proofObligations');}
{const p=core.createBlankState('ACTIVATION-REPAIRED');engine.ensureShape(p);
p.projectData.requirements.push(record('requirements',{MANDATORY_OPTIONAL_STATUS:'CONDITIONAL',STATUS:'ACTIVE'},'REQ-A'));
p.projectData.propositions.push(record('propositions',{REQUIREMENT_ID:'REQ-A'},'PROP-A'));
p.projectData.applicabilityRecords.push(record('applicabilityRecords',{SUBJECT_ID:'PROP-A',SELECTED_APPLICABILITY:'APPLICABLE',PROPOSED_APPLICABILITY:'APPLICABLE',ACTIVATION_PROOF_OBLIGATION_ID:'ACTIVATION-A'},'APP-A'));
p.projectData.semanticReviews.push(record('semanticReviews',{REVIEWED_RECORD_IDS:['APP-A'],AUTHOR_CONTEXT_ID:'AUTHOR-A',REVIEWER_CONTEXT_ID:'REVIEWER-A',INDEPENDENCE_DETERMINATION:'APPLICATION_ESTABLISHED',RESULT:'ACCEPTED',ACCEPTED_DISPOSITION:'ACCEPTED',RECONCILIATION_STATUS:'NOT_REQUIRED'},'REVIEW-A'));
assert.equal(engine.evaluateApplicability(p,'PROP-A'),'UNKNOWN','An accepted independent review cannot substitute for the missing activation proof.');
const proof=record('proofObligations',{SATISFACTION_STATE:'UNKNOWN'},'ACTIVATION-A');p.projectData.proofObligations.push(proof);assert.equal(engine.evaluateApplicability(p,'PROP-A'),'UNKNOWN');
proof.fields.SATISFACTION_STATE=proof.SATISFACTION_STATE='SATISFIED';assert.equal(engine.evaluateApplicability(p,'PROP-A'),'UNKNOWN','An unbound satisfaction flag must not replace the current reviewed activation expression.');
proof.active=false;assert.equal(engine.evaluateApplicability(p,'PROP-A'),'UNKNOWN','Historical activation proof remained gating.');proof.active=true;assert.equal(engine.evaluateApplicability(p,'PROP-A'),'UNKNOWN');}
{const p=core.createBlankState('CHECKPOINT-NEG');engine.ensureShape(p);let t=engine.terminalPrerequisites(p);assert(t.reasons.some(x=>x.includes('BACKUP_EXPORT_ACTION_COMPLETED')));p.projectData.backupCheckpoints.push(record('backupCheckpoints',{CUSTODY_STATE:'BACKUP_PACKAGE_GENERATED',STATUS:'CURRENT',PROJECT_REVISION:1},'CHECK-1'));t=engine.terminalPrerequisites(p);assert(t.reasons.some(x=>x.includes('BACKUP_EXPORT_ACTION_COMPLETED')));p.projectData.backupCheckpoints.push(record('backupCheckpoints',{CUSTODY_STATE:'BACKUP_EXPORT_ACTION_COMPLETED',STATUS:'CURRENT',PROJECT_REVISION:2,EXTERNAL_EVIDENCE_IDS:['EVIDENCE-FABRICATED']},'CHECK-2'));assert.equal(engine.currentPreDeliveryCheckpoint(p),null,'A manually fabricated exported checkpoint without current Stage 29 bindings and real export evidence must be rejected.');assert.equal(schema.RECORD_SCHEMAS.deliveryRecords.relationships.PRE_DELIVERY_CHECKPOINT_ID,'backupCheckpoints');}
// The valid control uses the existing preceding-stage ingestion journey. A
// hand-built review or satisfaction flag is not an accepted activation proof.
const command=[process.execPath,new URL('./verify-full-cycle.mjs',import.meta.url).pathname,'--timing-only'];
const executed=spawnSync(command[0],command.slice(1),{encoding:'utf8',timeout:180000,killSignal:'SIGKILL',maxBuffer:32*1024*1024});
const raw={command,exitCode:executed.status,signal:executed.signal,stdout:executed.stdout||'',stderr:executed.stderr||''};
assert.equal(executed.status,0,'ACTIVATION_JOURNEY_ORACLE: '+JSON.stringify(raw));
const timing=selectExecutionReport(raw.stdout,'timingFocused'),activation=timing.activationTimingCases;
assert(timing.timingFocused==='PASS'&&activation.length>0&&activation.every(row=>row.result==='PASS'&&row.independentReview&&row.missingActivationUnknown&&row.historicalTargetUnknown&&row.restoredTargetApplicable),'ACTIVATION_JOURNEY_ORACLE: accepted activation and rejection controls did not execute.');
console.log(JSON.stringify({activationProofFailsClosed:true,independentReviewCannotReplaceActivation:true,unknownActivationBlocked:true,historicalActivationBlocked:true,repairedActivationAccepted:true,preDeliveryCheckpointCustodyFailsClosed:true,unboundSatisfactionFlagRejected:true,activationTimingCases:activation,rawExecution:raw}));
