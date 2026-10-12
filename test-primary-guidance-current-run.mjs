import fs from 'node:fs';
import assert from 'node:assert/strict';
import {artifactFixtureId} from './test-artifact-fixtures.mjs';
// Component fixture: actual allocation, freeze and reservation commands. This
// establishes no completed prerequisite gate, external execution or browser proof.
export function verifyPrimaryGuidanceCurrentRunScope({source=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8')}={}){
 const e=globalThis.closedLoopWorkflowEngine,h=globalThis.closedLoopHash,c=globalThis.closedLoopCore,p=c.createBlankState('SYNTHETIC_GUIDANCE_CURRENT_RUN_COMPONENT');
 p.job.EXACT_USER_OBJECTIVE_VERBATIM='Check selected-stage current-run guidance without claiming completed prefix.';e.recordHumanInputVersion(p,['EXACT_USER_OBJECTIVE_VERBATIM'],'SYNTHETIC_OPERATOR');
 const aid=artifactFixtureId(e,p,'GUIDANCE_CANDIDATE'),text='component fixture bytes';e.registerArtifactBytes(p,{stage:10,artifactId:aid,filename:'candidate.txt',mediaType:'text/plain',byteSize:Buffer.byteLength(text),sha256:h.sha256Text(text)});
 const freeze=stage=>{const d=e.recordRegisteredHumanDecision(p,{stage,purpose:'CANDIDATE_COMPONENT_SELECTION',targetFamily:'artifacts',targetId:h.sha256Value([aid]),value:[aid],operatorLabel:'SYNTHETIC_OPERATOR'});return e.freezeCandidate(p,{stage,artifactIds:[aid],selectionDecisionId:d.id,operatorLabel:'SYNTHETIC_OPERATOR'});};
 const f10=freeze(10),r11=e.reserveRunBatch(p,{stage:11,iterationId:f10.iteration.id}),f17=freeze(17),r17=e.reserveRunBatch(p,{stage:17,iterationId:f17.iteration.id});
 const start=source.indexOf('function currentRunSlots('),end=source.indexOf('\nfunction reviewerOperation',start);assert.ok(start>0&&end>start,'PRIMARY_GUIDANCE_CURRENT_RUN_OWNER_ORACLE');
 const owner=source.slice(start,end),selected=(n,project=p)=>new Function('current','engine','recordValue','runSelection',owner+';return selectedRun('+n+');')(project,e,e.recordValue,{}),cases=[];
 assert.equal(selected(12)?.id,r11[0].runId,'PRIMARY_GUIDANCE_CURRENT_RUN_ORACLE: earlier Stage12 selects Stage10-iteration run, never later correction run');cases.push({caseId:'historical-stage12-selects-original-iteration-run',passed:true});
 assert.equal(selected(17)?.id,r17[0].runId,'PRIMARY_GUIDANCE_CURRENT_RUN_ORACLE: current Stage17 retains its own correction run');cases.push({caseId:'current-stage17-selects-current-iteration-run',passed:true});
 const prepared=e.preparePromptContext(p,12,{operation:'VERIFY',scope:{runId:selected(12).id}},{preview:true});assert.equal(prepared.options.scope.iterationId,f10.iteration.id);assert.equal(prepared.options.scope.candidateId,f10.candidate.id);assert.equal(prepared.options.scope.runId,r11[0].runId);cases.push({caseId:'selected-historical-run-previews-exact-current-stage-candidate',passed:true});
 assert.throws(()=>e.preparePromptContext(p,12,{operation:'VERIFY',scope:{runId:r17[0].runId}},{preview:true}),x=>x.code==='INVALID_SCOPE_REFERENCE'&&x.dimension==='runId','PRIMARY_GUIDANCE_WRONG_RUN_REFUSAL_ORACLE');cases.push({caseId:'wrong-later-run-retains-production-scope-refusal',passed:true});
 const before=e.clone(p);assert.equal(selected(9,before),null,'PRIMARY_GUIDANCE_CURRENT_RUN_ORACLE: earlier pre-freeze stage cannot select future runs');assert.equal(p.job.CURRENT_ITERATION,f17.iteration.id);assert.equal(p.projectData.runs.length,20);assert.notEqual(p.stages[10].status,'COMPLETE');assert.notEqual(p.stages[11].status,'COMPLETE');cases.push({caseId:'no-future-run-or-forced-prefix-completion',passed:true});
 return {status:'PASS',cases,synthetic:true,actualBrowser:false,completedPrefix:false,scope:'Actual currentRunSlots/selectedRun with legal component allocations and selected-stage prompt-scope guard; complete historical rendering remains separately owned.'};
}
