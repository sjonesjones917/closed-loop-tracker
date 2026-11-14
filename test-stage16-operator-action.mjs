import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {createVerifierRuntime} from './verifier-runtime.mjs';
const digest=text=>createHash('sha256').update(text).digest('hex');

// §33 rendered-plan unit controls. Reuse the correction owner's explicitly
// synthetic Stage14 facts and predecessor/acceptance gate fixture. No proof of
// predecessor execution, native transaction or a real operator is asserted.
export async function verifyStage16OperatorActions({fixture,engine,core,schema,rootCause,defect,scopeFor,sourceOverrides={}}){
 const source=sourceOverrides['app-core.js']??fs.readFileSync('app-core.js','utf8'),promptSource=fs.readFileSync('prompt-engine.js','utf8'),observations=[],detectingControls=[];
 const view=p=>{
  const before=JSON.stringify(p),plan=engine.stage16CorrectionPlan(p),action=engine.operationalNextAction(p,16),api={project:p,engine,core,schema,action};
  const context=createVerifierRuntime({api,closedLoopCore:core,closedLoopHash:globalThis.closedLoopHash,closedLoopWorkflowSchema:schema,closedLoopWorkflowEngine:engine,closedLoopTestRuntime:globalThis.closedLoopTestRuntime,console,URL,Blob,crypto:globalThis.crypto,structuredClone:value=>structuredClone(value),document:{currentScript:null,querySelector:()=>null}});
  vm.runInContext(promptSource,context,{filename:'prompt-engine.js'});
  const cut=source.indexOf("$('#project-picker').onchange");assert.ok(cut>0,'S16_RENDER_OWNER_EXTRACTION_ORACLE');
  vm.runInContext(source.slice(0,cut)+`
   engine=api.engine;schema=api.schema;core=api.core;current=api.project;
   // Rendering unit boundary: select the actual policy output for Stage16.
   // Full stage-entry/current-stage and DOM event routing remain outside scope.
   displayedStageAction=()=>api.action;
   const planHtml=rootCauseCorrectionMarkup(16),actionHtml=nextActionMarkup(true,16),questionHtml=clarificationMarkup(16,false),purposeHtml=stagePurposeMarkup(16);
   let detailHtml='';for(const [id]of detailViews){const body={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null,replaceChildren(){this.innerHTML='';}},node={dataset:{detailId:id},querySelector:()=>body};renderDetail(node);detailHtml+=body.innerHTML;if(detailViews.size>64)throw new Error('Tiny Stage16 view exceeded declared detail bound.');}
   globalThis.rendered={planHtml,actionHtml,questionHtml,purposeHtml,detailHtml,otherStagePlanHtml:rootCauseCorrectionMarkup(14)};
  })();`,context,{filename:'app-core.js'});
  assert.equal(JSON.stringify(p),before,'S16_RENDER_PRESERVES_PROJECT_ORACLE');return {plan:JSON.parse(JSON.stringify(plan)),action:JSON.parse(JSON.stringify(action)),...JSON.parse(JSON.stringify(context.rendered))};
 };
 const noLayerQuestion=v=>{assert.doesNotMatch(v.planHtml+v.actionHtml+v.questionHtml+v.detailHtml,/<(?:input|textarea|select)\b[^>]*(?:responsible[-_ ]?layer|earliest[-_ ]?defective[-_ ]?layer)/i,'S16_NO_OPERATOR_LAYER_SELECTION_ORACLE');assert.doesNotMatch(v.questionHtml,/(?:identify|choose|select|name|which|what)\s+(?:the\s+)?(?:earliest defective|responsible)\s+layer/i,'S16_NO_OPERATOR_LAYER_QUESTION_ORACLE');assert.ok(v.planHtml.includes('You do not choose canonical IDs, version numbers, hashes, invalidation targets, or rerun scope.'),'S16_APPLICATION_CONTROL_NOTICE_ORACLE');};
 const earliest=(v,layer)=>{assert.ok(v.detailHtml.includes(layer),'S16_ESTABLISHED_LAYER_RENDER_ORACLE');assert.ok(v.planHtml.includes('Do not patch a downstream output merely because that is where the failure became visible.'),'S16_EARLIEST_CAUSE_RENDER_ORACLE');assert.ok(v.purposeHtml.includes('The application preserves the old version, handles IDs/versions/hashes, and determines what must be repeated.'),'S16_VERSION_REPEAT_GUIDANCE_ORACLE');noLayerQuestion(v);};
 const external=v=>{assert.equal(v.action.actionType,'EXTERNAL_AGENT_TOOL','S16_EXACT_EXTERNAL_ACTION_ORACLE');assert.equal(v.action.operation,'CORRECT','S16_EXACT_EXTERNAL_OPERATION_ORACLE');assert.ok(v.actionHtml.includes('id="next-export-prompt-file" data-operation="CORRECT"'),'S16_EXACT_EXTERNAL_BUTTON_ORACLE');};
 const check=(name,v,verify)=>{verify(v);observations.push({case:name,plan:v.plan,action:v.action,rendered:v,projectPreserved:true,passed:true});const mutation=name==='missing-root-authority-blocked'?x=>{x.action.actionType='EXTERNAL_AGENT_TOOL';}:name==='pending-correction-review-and-approve'?x=>{x.action.actionType='EXTERNAL_AGENT_TOOL';}:name==='exact-human-authority-question'?x=>{x.questionHtml='';}:null;if(mutation){const bad=structuredClone(v);mutation(bad);let failure;assert.throws(()=>verify(bad),error=>{failure=error.message;return error.code==='ERR_ASSERTION';},'S16_ACTION_MUTATION_ORACLE: '+name);detectingControls.push({case:name+'-missing-required-action',rejected:true,failure});}};
 {
  const p=await fixture();p.projectData.rootCauses=[];const v=view(p);check('missing-root-authority-blocked',v,x=>{assert.equal(x.plan.actionType,'BLOCKED');assert.equal(x.action.actionType,'BLOCKED');assert.ok(x.planHtml.includes('Root cause required before correction'));assert.ok(x.actionHtml.includes('Stage 14 has established the earliest defective layer with evidence'));assert.doesNotMatch(x.actionHtml,/<button\b/,'S16_BLOCKED_NO_ACTION_BUTTON_ORACLE');noLayerQuestion(x);});
 }
 {
  const p=await fixture();p.projectData.rootCauses=[rootCause('RCA-ONLY-INSTRUCTION','DEFECT-1','INSTRUCTION',scopeFor(p))];const v=view(p);check('established-instruction-exact-external-correction',v,x=>{earliest(x,'INSTRUCTION');external(x);assert.ok(x.detailHtml.includes('Correct this earliest defective controlled artifact through the current Stage 16 instruction. Do not patch downstream outputs in place.'));});
  for(const [name,mutate,oracle]of [['missing-established-layer',x=>{x.detailHtml=x.detailHtml.replaceAll('INSTRUCTION','REPLACED');},x=>earliest(x,'INSTRUCTION')],['operator-layer-selection',x=>{x.planHtml+='<select name="responsible-layer"></select>';},noLayerQuestion],['operator-layer-question',x=>{x.questionHtml+='<label>Which responsible layer should we fix?</label>';},noLayerQuestion],['wrong-external-operation',x=>{x.action.operation='COMPLETE';},external],['missing-version-repeat-guidance',x=>{x.purposeHtml='';},x=>earliest(x,'INSTRUCTION')]]){const bad=structuredClone(v);mutate(bad);let failure;assert.throws(()=>oracle(bad),error=>{failure=error.message;return error.code==='ERR_ASSERTION';},'S16_RENDER_MUTATION_ORACLE: '+name);detectingControls.push({case:name,rejected:true,failure});}
 }
 {
  const p=await fixture();p.projectData.responseProposals.push({proposalId:'SYNTHETIC-S16-REVIEW',stage:16,status:'PENDING_OPERATOR_REVIEW',operation:'CORRECT'});const v=view(p);check('pending-correction-review-and-approve',v,x=>{assert.equal(x.action.actionType,'REVIEW_PROPOSAL');assert.equal(x.action.operation,'CORRECT');assert.ok(x.actionHtml.includes('Review proposal'));assert.ok(x.actionHtml.includes('Human operator'));assert.ok(x.actionHtml.includes('before accepting or rejecting this proposal'));noLayerQuestion(x);});
 }
 {
  const p=await fixture();p.projectData.humanInputRequests.push({requestId:'SYNTHETIC-S16-HUMAN-FACT',stage:16,status:'OPEN',blocking:true,question:'What is the corrected human-owned filing deadline?',whyRequired:'The accepted root cause identifies an incorrect human fact.',answerType:'DATE'});const v=view(p);check('exact-human-authority-question',v,x=>{assert.equal(x.action.actionType,'CONTINUE_AGENT_CONVERSATION');assert.ok(x.questionHtml.includes('What is the corrected human-owned filing deadline?'));assert.ok(x.questionHtml.includes('data-human-answer="SYNTHETIC-S16-HUMAN-FACT" type="date"'));assert.ok(x.questionHtml.includes('Answer only these human-authority questions.'));noLayerQuestion(x);});
 }
 {
  const p=await fixture();p.projectData.defects=[defect('DEFECT-EXECUTION','Execution ignored the correct instruction.',scopeFor(p))];p.projectData.rootCauses=[rootCause('RCA-EXECUTION','DEFECT-EXECUTION','EXECUTION',scopeFor(p))];const v=view(p);check('execution-only-preserves-governing-instruction',v,x=>{assert.equal(x.plan.actionType,'NO_SPECIFICATION_CHANGE');earliest(x,'EXECUTION');assert.ok(x.detailHtml.includes('Preserve the governing requirement, test, and instruction; keep the regression active and rerun the required execution path. Do not invent a specification change.'));});
 }
 {
  const p=await fixture();p.projectData.rootCauses=[rootCause('RCA-HUMAN','DEFECT-1','HUMAN INPUT',scopeFor(p))];const v=view(p);check('established-human-root-authority-routing',v,x=>{assert.equal(x.plan.actionType,'HUMAN_AUTHORITY');assert.equal(x.action.actionType,'CONTINUE_AGENT_CONVERSATION');earliest(x,'HUMAN INPUT');assert.ok(x.detailHtml.includes('Confirm only the corrected human-owned fact or decision when requested.'));});
 }
 {
  const p=await fixture();const v=view(p);check('each-established-root-rendered-with-repeat-scope',v,x=>{assert.equal(x.plan.items.length,2);earliest(x,'INSTRUCTION');earliest(x,'TEST');assert.ok(x.detailHtml.includes('Stages 15-30'));assert.equal(x.otherStagePlanHtml,'','S16_PLAN_STAGE_SCOPE_ORACLE');});
 }
 return {checkId:'STAGE16-RENDERED-CORRECTIVE-ACTION',cases:observations,detectingControls,passed:true,sourceHashes:{'app-core.js':digest(source),'prompt-engine.js':digest(promptSource)},synthetic:true,actualBrowser:false,actualOperator:false,priorStageAuthoritySynthetic:true,nativeTransaction:false,stageEntryRoutingProved:false,scope:'Production plan/action policy and actual markup/detail renderers under minimal synthetic DOM; pending proposal/question records are deliberately synthetic unit inputs, not admitted agent responses.',uncovered:['No independent legitimate application-owned Stage16 deterministic no-user-action case established. Execution-only no specification change is not treated as no user action.','Blocked missing root authority is covered; affirmative unavailable external capability/operator-authority report routed through full live handoff is not proven by these unit controls.','Actual approve/correction commit and version/invalidation/replay ownership remain retained separate gate/journey proof, not established by read-only renderer.']};
}
