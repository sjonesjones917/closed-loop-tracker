(()=>{
'use strict';
const STORE='mobile-closed-loop-agent',WORKING='closed-loop-working-snapshot';
const $=(q,r=document)=>r.querySelector(q),$$=(q,r=document)=>[...r.querySelectorAll(q)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch{return null}};
const write=s=>localStorage.setItem(STORE,JSON.stringify(s));
const pad=n=>String(n).padStart(2,'0');
const label=s=>String(s||'').replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').replace(/^./,c=>c.toUpperCase());
const stages=s=>Object.entries(s?.stages||{}).map(([k,v])=>[Number(k),v]).filter(([n,v])=>Number.isFinite(n)&&v).sort((a,b)=>a[0]-b[0]);
const stateClass=v=>/BLOCK|VIOLAT|REJECT|OPEN|FAIL/i.test(v||'')?'blocked':/SATISF|ACCEPT|COMPLETE|READY|CONFIRM|RESOLVED/i.test(v||'')?'satisfied':'';
function value(v,depth=0){
  if(v===null||v===undefined||v==='')return '<span class="muted">None recorded</span>';
  if(Array.isArray(v))return v.length?`<div class="record-stack">${v.map((x,i)=>`<details class="record-card"><summary>${esc(x?.title||x?.outputId||x?.receiptId||x?.reqId||x?.testId||x?.mutationId||x?.defectId||x?.regId||x?.sourceId||x?.artifactId||x?.runId||x?.changeId||x?.blockerId||`Record ${i+1}`)}</summary><div class="record-body">${value(x,depth+1)}</div></details>`).join('')}</div>`:'<span class="muted">None recorded</span>';
  if(typeof v==='object')return `<div class="data-list">${Object.entries(v).map(([k,x])=>`<div class="data-row"><div class="data-key">${esc(label(k))}</div><div class="data-value">${typeof x==='object'&&x!==null?(depth>4?`<pre class="copy">${esc(JSON.stringify(x,null,2))}</pre>`:value(x,depth+1)):esc(x)}</div></div>`).join('')}</div>`;
  return esc(v);
}
const section=(title,body,open=false)=>`<details class="record-card" ${open?'open':''}><summary>${esc(title)}</summary><div class="record-body">${body}</div></details>`;
function current(s){return stages(s).find(([n])=>n===Number(s?.activeStage))||stages(s)[0]||[1,{}]}
function showWorkspace(which){
  for(const id of ['workspace-workbook','workspace-project','workspace-guide'])$(`#${id}`)?.setAttribute('hidden','');
  $(`#workspace-${which}`)?.removeAttribute('hidden');
  $$('.header-actions button').forEach(b=>b.dataset.active='false');
  if(which==='project'&&$('#project-data-button'))$('#project-data-button').dataset.active='true';
  if(which==='guide'&&$('#guide-button'))$('#guide-button').dataset.active='true';
}
function specOf(s){return s?.testProject?.spec||null}
function openBlockers(spec){return (spec?.blockers||[]).filter(b=>String(b.currentStatus||b.status||'').toUpperCase()==='OPEN')}
function stageContext(n,s){
  const unresolved=openBlockers(specOf(s)).length;
  if(unresolved&&n>=Number(s?.activeStage||1))return `Blocked work: ${unresolved} unresolved blocker${unresolved===1?'':'s'} stops affected downstream work until evidence-backed resolution.`;
  if([11,12,17,19,21,23,24].includes(n))return 'Independent context: use only authorized inputs and the generated instruction; preserve isolation and the complete returned output.';
  if(n===16)return 'Change control: preserve prior state, invalidate dependent determinations, and identify required reruns.';
  if([26,27,28,29].includes(n))return 'Release control: derive readiness from process/product audits, evidence, exact artifact identity, and traceability.';
  return '';
}
function workflow(s){
  const [active]=current(s);
  return `<div class="project-panel"><h2>30-stage workflow</h2><p class="muted">The full workflow remains intact. Detailed stage controls appear only when you open a stage.</p><div class="workflow-list">${stages(s).map(([n,st])=>`<article class="workflow-row ${n===active?'current':''}"><button type="button" data-stage-open="${n}"><span class="workflow-num">${pad(n)}</span><span class="workflow-copy"><strong>${esc(st.title||st.name||`Stage ${pad(n)}`)}</strong><small>${esc(st.decisionEvidence||'No evidence recorded yet.')}</small>${stageContext(n,s)?`<em>${esc(stageContext(n,s))}</em>`:''}</span><span class="status-chip ${stateClass(`${st.status} ${st.decision}`)}">${esc(st.status||st.decision||'NOT STARTED')}</span></button></article>`).join('')}</div></div>`;
}
function history(s,spec){
  return `<div class="project-panel"><h2>Complete project history</h2><p class="muted">Stage records, generated instructions, saved outputs, decisions, and evidence remain inspectable after the project advances.</p><div class="stage-record-list">${stages(s).map(([n,st])=>`<details class="record-card"><summary><span>Stage ${pad(n)} · ${esc(st.title||st.name||'')}</span><span class="status-chip ${stateClass(`${st.status} ${st.decision}`)}">${esc(st.status||st.decision||'NOT STARTED')}</span></summary><div class="record-body">${section('What happened',`<p>${esc(st.decisionEvidence||spec?.stageStates?.[String(n)]?.evidence||'No evidence recorded.')}</p>`,true)}${section('Generated instruction',`<pre class="copy">${esc(st.generatedPrompt||spec?.generatedPrompts?.find(p=>Number(p.stage)===n)?.prompt||'No generated instruction captured.')}</pre>`,true)}${section('Stage record',`<pre class="copy">${esc(st.draftRecord||spec?.stageStates?.[String(n)]?.record||'No stage record saved.')}</pre>`)}${section('Saved response and output',`<pre class="copy">${esc(st.responseDraft||spec?.generatedOutputs?.filter(o=>Number(o.stage)===n).map(o=>o.output||o.summary||'').join('\n')||'None recorded.')}</pre>`)}${section('Decision',value({status:st.status,decision:st.decision,nextStage:st.nextStage,dateTime:st.dateTime}))}</div></details>`).join('')}</div></div>`;
}
function runs(spec){
  const list=spec?.runRecords||[],groups=[...new Set(list.map(r=>r.iterationId))];
  const blocked=openBlockers(spec).filter(b=>Number(b.stageDiscovered)===11);
  return `<div class="project-panel"><h2>Independent executions</h2><p class="muted">${list.length?`All ${list.length} recorded runs remain separate; no preferred output replaces the others.`:'No independent run is counted unless a genuinely fresh context and its complete output actually exist.'}</p>${blocked.length?`<div class="notice"><strong>Blocked at Stage 11.</strong> ${esc(blocked[0].missingItem||blocked[0].missingEvidenceAuthorityInputOrCapability||blocked[0].whyMandatorySatisfactionCannotBeEstablished||'Required independent execution evidence is unavailable.')}</div>`:''}${groups.map(g=>section(g,`<div class="run-list">${list.filter(r=>r.iterationId===g).map(r=>`<details class="record-card"><summary><span>${esc(r.runId)}</span><span class="status-chip ${stateClass(r.status)}">${esc(r.status||'RECORDED')}</span></summary><div class="record-body">${value(r)}</div></details>`).join('')}</div>`,true)).join('')}${section('Prepared fresh contexts',value(spec?.freshContexts||[]),true)}${section('Iterations and run counts',value(spec?.phases||{}),true)}${section('Generated output receipts',value(spec?.generatedOutputs||[]),true)}${section('Preserved artifacts',value(spec?.artifacts||[]))}</div>`;
}
function renderProject(view='overview'){
  const s=read();if(!s)return;const spec=specOf(s),host=$('#workspace-project');if(!host)return;
  const [n]=current(s),blockers=openBlockers(spec),reqs=spec?.requirements||[];
  host.innerHTML=`<div class="human-project"><section class="project-hero"><div class="project-hero-top"><div><h2>${esc(s?.job?.JOB_TITLE||spec?.title||'Untitled project')}</h2><p>${esc(s?.job?.EXACT_USER_OBJECTIVE_VERBATIM||spec?.objective?.exactUserObjective||'Define the exact objective in Stage 01.')}</p></div><span class="status-chip ${stateClass(s?.job?.CURRENT_STATE)}">${esc(s?.job?.CURRENT_STATE||'NOT STARTED')}</span></div><div class="project-facts"><div class="fact"><strong>${pad(n)}</strong><span>Current stage</span></div><div class="fact"><strong>${blockers.length}</strong><span>Open blockers</span></div><div class="fact"><strong>${reqs.length}</strong><span>Requirements</span></div><div class="fact"><strong>${spec?.runRecords?.length||0}</strong><span>Recorded runs</span></div></div>${spec?`<div class="notice" style="margin-top:9px"><strong>Test project.</strong> This is ordinary project data in the same application. Only work that actually exists is recorded; downstream stages remain NOT STARTED or BLOCKED when required evidence is absent.</div>`:''}</section><nav class="project-tabs">${[['overview','Overview'],['workflow','Workflow'],['work','Work'],['runs','Runs'],['issues','Issues'],['release','Release'],['history','History']].map(([id,t])=>`<button type="button" data-project-view="${id}" aria-selected="${id===view}">${t}</button>`).join('')}</nav><div id="project-view"></div></div>`;
  const out=$('#project-view');
  if(view==='overview')out.innerHTML=`<div class="project-panel"><h2>Project overview</h2>${section('What the user entered',value(spec?.userEnteredData||s?.job),true)}${section('Supplied materials and source authority',value(spec?.sourceInventory||s?.sourceInventory||[]),true)}${section('Unknowns and assumptions',value({unknowns:spec?.unknowns||[],assumptions:spec?.assumptions||[]}),true)}${section('Current result',value({currentStage:spec?.currentStage||s?.activeStage,currentState:spec?.currentState||s?.job?.CURRENT_STATE,nextRequiredAction:spec?.nextRequiredAction||s?.job?.NEXT_REQUIRED_ACTION,latestEvidence:spec?.latestEvidenceReference||s?.job?.LATEST_EVIDENCE_REFERENCE}),true)}</div>`;
  if(view==='workflow')out.innerHTML=workflow(s);
  if(view==='work')out.innerHTML=`<div class="project-panel"><h2>Requirements, research, tests, and instructions</h2>${section('Source-by-source research',value(spec?.research||spec?.researchRecords||[]),true)}${section('Atomic requirements',value(spec?.requirements||[]),true)}${section('Requirement resolution',value(spec?.requirementResolution||[]))}${section('Verification procedures',value(spec?.tests||[]),true)}${section('Failure and mutation tests',value(spec?.mutations||[]),true)}${section('Production instruction',value(spec?.productionInstruction||{}),true)}${section('Generated stage instructions',value(spec?.generatedPrompts||[]),true)}${section('Generated records and responses',value(spec?.generatedOutputs||[]),true)}</div>`;
  if(view==='runs')out.innerHTML=runs(spec);
  if(view==='issues')out.innerHTML=`<div class="project-panel"><h2>Failures, blockers, and corrections</h2>${section('Blockers',value(spec?.blockers||s?.blockers||[]),true)}${section('Defects and root cause',value(spec?.defects||s?.defects||[]),true)}${section('Permanent regression tests',value(spec?.regressions||s?.regressions||[]),true)}${section('Changes and invalidated work',value(spec?.changes||s?.changes||[]),true)}</div>`;
  if(view==='release')out.innerHTML=`<div class="project-panel"><h2>Release readiness</h2><p class="muted">Readiness is derived from actual project evidence; missing mandatory evidence remains BLOCKED.</p>${section('Convergence',value(spec?.convergence||{}),true)}${section('Baseline',value(spec?.baseline||{}),true)}${section('Finished product',value(spec?.product||{}),true)}${section('Process and product audits',value(spec?.audits||{}),true)}${section('Release gate and artifact identity',value(spec?.release||s?.release||{}),true)}${section('Evidence chains',value(spec?.evidenceChains||[]))}</div>`;
  if(view==='history')out.innerHTML=history(s,spec);
  $$('[data-project-view]',host).forEach(b=>b.onclick=()=>renderProject(b.dataset.projectView));
  $$('[data-stage-open]',host).forEach(b=>b.onclick=()=>openStage(Number(b.dataset.stageOpen)));
}
function openStage(n){
  const s=read();if(s){s.activeStage=n;write(s)}
  const btn=$$('#nav [data-stage]').find(b=>Number(b.dataset.stage)===n);btn?.click();
  if($('#stage-select'))$('#stage-select').value=String(n);
  showWorkspace('workbook');window.scrollTo({top:0,behavior:'smooth'});setTimeout(humanizeStage,40);
}
function humanizeStage(){
  const c=$('#content');if(!c)return;
  $$('h2,h3,h4,summary',c).forEach(h=>{const t=h.textContent.trim();if(t==='COPY INTO THE ASSIGNED AGENT')h.textContent='Generated instruction';if(t==='FILL-IN STAGE RECORD')h.textContent='Stage record';if(t==='EVIDENCE TO PRESERVE')h.textContent='Evidence to keep';if(t==='HUMAN CHECKLIST')h.textContent='Required work';if(/AGENT RESPONSE RECEIPT/i.test(t))h.textContent='Saved response and output';if(/FRESH[- ]CONTEXT LAUNCH/i.test(t))h.textContent='Independent run setup'});
}
function syncStagePicker(){
  const s=read(),sel=$('#stage-select');if(!sel||!stages(s).length)return;
  sel.innerHTML=stages(s).map(([n,st])=>`<option value="${n}">${pad(n)} · ${esc(st.title||st.name||`Stage ${pad(n)}`)}</option>`).join('');
  sel.value=String(s?.activeStage||1);sel.onchange=()=>openStage(Number(sel.value));
  if($('#previous-stage'))$('#previous-stage').onclick=()=>openStage(Math.max(1,Number(sel.value)-1));
  if($('#next-stage'))$('#next-stage').onclick=()=>openStage(Math.min(30,Number(sel.value)+1));
}
function buildTestState(template,spec){
  const s=structuredClone(template);
  s.testProject={id:spec.testProjectId,source:'TEST_PROJECT.json',loadedAt:new Date().toISOString(),spec:structuredClone(spec)};
  s.activeStage=Number(spec.currentStage||1);
  s.job=s.job||{};
  const open=openBlockers(spec);
  Object.assign(s.job,{
    JOB_ID:spec.jobId,JOB_TITLE:spec.title,JOB_OWNER:spec.userEnteredData?.requester||'',DATE_OPENED:spec.date,
    CURRENT_ITERATION:spec.currentIteration||'NONE',CURRENT_STAGE:`STAGE ${pad(spec.currentStage||1)}`,CURRENT_STATE:spec.currentState||'IN PROGRESS',
    CURRENT_INPUT_VERSION:spec.currentVersions?.input||'',CURRENT_SOURCE_SET_VERSION:spec.currentVersions?.sources||'',CURRENT_REQUIREMENTS_VERSION:spec.currentVersions?.requirements||'',CURRENT_TEST_SUITE_VERSION:spec.currentVersions?.tests||'',CURRENT_INSTRUCTION_VERSION:spec.currentVersions?.instruction||'',
    CURRENT_BASELINE_ID:spec.baseline?.baselineId||'NONE',CURRENT_PRODUCT_ID:spec.product?.productId||'NONE',CURRENT_BLOCKERS:open.map(b=>b.blockerId).join(', ')||'NONE',
    NEXT_REQUIRED_ACTION:spec.nextRequiredAction||'',LATEST_EVIDENCE_REFERENCE:spec.latestEvidenceReference||'',EXACT_USER_OBJECTIVE_VERBATIM:spec.objective?.exactUserObjective||spec.userEnteredData?.exactRequest||'',EXACT_DELIVERABLE_REQUESTED:spec.objective?.deliverable||spec.userEnteredData?.requestedDeliverable||'',REQUIRED_OUTPUT_FORMAT:spec.objective?.requiredOutputFormat||'',DEADLINE_OR_TEMPORAL_SCOPE:spec.objective?.temporalScope||'',
    SUPPLIED_MATERIALS_INVENTORY:spec.sourceInventory||[],KNOWN_AUTHORITATIVE_SOURCES:(spec.sourceInventory||[]).map(x=>x.sourceId).join(', '),AVAILABLE_TOOLS:(spec.availableTools||[]).join(', '),PROHIBITED_ACTIONS:(spec.prohibitedActions||spec.userEnteredData?.constraints||[]).join('\n'),EXPLICIT_USER_REQUIREMENTS:(spec.requirements||[]).map(r=>`${r.reqId}: ${r.requirement}`).join('\n'),ASSUMPTIONS:(spec.assumptions||[]).length?JSON.stringify(spec.assumptions):'NONE',UNKNOWN_INFORMATION:(spec.unknowns||[]).length?JSON.stringify(spec.unknowns):'NONE'
  });
  for(const [n,st] of stages(s)){
    const r=spec.stageStates?.[String(n)]||{};
    st.status=r.status||'NOT STARTED';st.decision=r.decision||'';st.decisionEvidence=r.evidence||'';st.nextStage=r.next||'';st.decidedBy=r.decidedBy||'';st.dateTime=r.dateTime||'';
    st.generatedPrompt=spec.generatedPrompts?.find(p=>Number(p.stage)===n)?.prompt||'';
    st.responseDraft=spec.generatedOutputs?.filter(o=>Number(o.stage)===n).map(o=>o.output||o.summary||'').join('\n');
    st.draftRecord=r.record||[ `STAGE ${pad(n)} — ${st.title||st.name||''}`, st.decisionEvidence||'No stage evidence recorded.', `Status: ${st.status}`, `Decision: ${st.decision||'NOT REACHED'}` ].join('\n');
  }
  s.defects=structuredClone(spec.defects||[]);s.regressions=structuredClone(spec.regressions||[]);s.blockers=structuredClone(spec.blockers||[]);s.changes=structuredClone(spec.changes||[]);
  s.release=s.release||{};Object.assign(s.release,{gateState:spec.release?.releaseState||'BLOCKED',authorization:spec.release?.deliveryAuthorization||'NOT AUTHORIZED'});
  return s;
}
async function loadTestProject(auto=false){
  const current=read();if(!current)return alert('Project state is unavailable.');
  if(!current.testProject)sessionStorage.setItem(WORKING,JSON.stringify(current));
  try{const r=await fetch(`TEST_PROJECT.json?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw Error(`HTTP ${r.status}`);write(buildTestState(current,await r.json()));if(auto){syncStagePicker();renderProject('overview');showWorkspace('project')}else location.reload()}catch(e){alert(`Test project could not be opened: ${e.message}`)}
}
function restoreWorking(){const raw=sessionStorage.getItem(WORKING);if(raw){localStorage.setItem(STORE,raw);location.reload();return}if(read()?.testProject&&typeof globalThis.newJob==='function'){globalThis.newJob();location.reload()}}
function guide(){
  const host=$('#workspace-guide');if(!host)return;
  host.innerHTML=`<div class="project-panel"><h2>How this application works</h2><p>The 30 stages are workflow semantics, not thirty permanent checklist pages. Human entry appears where judgment or authorization is needed; the application preserves derived state, evidence, blockers, change impact, run isolation, release readiness, and traceability.</p>${section('Outcome vocabulary',value({UNKNOWN:'Fact not established',NONE:'Evidence establishes no item exists',NOT_APPLICABLE:'Objective rule excludes the field',SATISFIED:'Requirement affirmatively established',VIOLATED:'Evidence shows failure',UNDETERMINED:'Evidence cannot establish satisfaction or violation',ACCEPTED:'Every mandatory requirement and validator succeeds',REJECTED:'A mandatory requirement is demonstrably violated',BLOCKED:'A mandatory fact cannot be established because evidence, authority, input, or capability is unavailable'}),true)}${section('Cross-cutting controls',value({Fresh_contexts:'Run isolation, authorized inputs, contamination state, and outputs are recorded where independence is required.',Blockers:'Missing mandatory evidence, input, authority, or capability stops affected downstream work.',Changes_and_invalidation:'Material changes preserve history and invalidate dependent verification.',Final_release:'Readiness is derived from actual evidence and exact artifact identity.',New_job:'Starts clean without silently inheriting another job state.','Output receipts':'Generated responses retain originating stage, context, inputs, files, failures, and next verification.'}),true)}</div>`;
}
function wire(){
  if($('#new-job-button'))$('#new-job-button').onclick=()=>{sessionStorage.removeItem(WORKING);globalThis.newJob?.()};
  if($('#project-data-button'))$('#project-data-button').onclick=()=>{renderProject('overview');showWorkspace('project')};
  if($('#guide-button'))$('#guide-button').onclick=()=>{guide();showWorkspace('guide')};
  if($('#export-button'))$('#export-button').onclick=()=>globalThis.exportProject?.();
  if($('#import-button'))$('#import-button').onclick=()=>globalThis.imp?.click();
  if(globalThis.imp)globalThis.imp.onchange=function(){globalThis.importProject?.(this)};
  const picker=$('#project-picker');if(picker){picker.value=read()?.testProject?'retained':'working';picker.onchange=()=>picker.value==='retained'?loadTestProject():restoreWorking()}
  syncStagePicker();
}
function boot(){
  wire();humanizeStage();
  const q=new URLSearchParams(location.search);
  if(q.get('test')==='1'&&!read()?.testProject){loadTestProject(true);return}
  renderProject('overview');showWorkspace('project');
}
const observer=new MutationObserver(()=>{clearTimeout(window.__humanize);window.__humanize=setTimeout(()=>{humanizeStage();syncStagePicker()},50)});
observer.observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('load',()=>setTimeout(boot,120));setTimeout(boot,250);
})();
