(()=>{
'use strict';
const STORE='mobile-closed-loop-agent';
const REV='human-ui-20260823-r12';
let view='overview',stageWorkspace=false,loadingTest=false;
const $=(q,r=document)=>r.querySelector(q), $$=(q,r=document)=>[...r.querySelectorAll(q)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label=s=>String(s||'').replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());
const read=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch{return null}};
const write=s=>localStorage.setItem(STORE,JSON.stringify(s));
const stages=s=>Object.entries(s?.stages||{}).map(([n,x])=>[Number(n),x]).filter(([n,x])=>n&&x).sort((a,b)=>a[0]-b[0]);
const pad=n=>String(n).padStart(2,'0');
const stateTone=v=>/BLOCK|VIOLAT|REJECT|OPEN|FAIL/i.test(v||'')?'bad':/UNKNOWN|UNDETERMINED|NOT READY|ATTENTION/i.test(v||'')?'warn':/COMPLETE|READY|SATISF|ACCEPT|CLOSED|CONFIRM/i.test(v||'')?'good':'neutral';
const plain=v=>v===null||v===undefined||v===''?'None recorded':String(v);
function summaryText(st){return st?.result||st?.purpose||st?.description||st?.decisionEvidence||'Open this stage to inspect its record, generated instruction, evidence, decision, and next action.'}
function currentStage(s){const all=stages(s),requested=Number(s?.activeStage);return all.find(([n])=>n===requested)||all.find(([,x])=>!/COMPLETE/i.test(x?.status||''))||all[0]||[1,{}]}
function visibleRecords(v){
  if(v===null||v===undefined||v==='')return '<span class="quiet">None recorded</span>';
  if(Array.isArray(v))return v.length?`<div class="record-list">${v.map((x,i)=>`<details><summary>${esc(x?.title||x?.reqId||x?.testId||x?.defectId||x?.blockerId||x?.regId||x?.changeId||x?.sourceId||x?.receiptId||`Record ${i+1}`)}</summary><div class="record-body">${visibleRecords(x)}</div></details>`).join('')}</div>`:'<span class="quiet">None recorded</span>';
  if(typeof v==='object')return `<dl class="data-list">${Object.entries(v).map(([k,x])=>`<div><dt>${esc(label(k))}</dt><dd>${typeof x==='object'?visibleRecords(x):esc(plain(x))}</dd></div>`).join('')}</dl>`;
  return `<span>${esc(v)}</span>`;
}
const disclosure=(title,body,open=false,cls='')=>`<details class="disclosure ${cls}" ${open?'open':''}><summary>${esc(title)}</summary><div class="disclosure-body">${body}</div></details>`;
function ensureShell(){
  let shell=$('#human-shell');
  if(!shell){shell=document.createElement('section');shell.id='human-shell';$('main')?.prepend(shell)}
  return shell;
}
function hideWorkbookChrome(){
  const master=$('#master'),nav=$('#nav'),content=$('#content');
  if(master)master.hidden=!stageWorkspace;
  if(nav)nav.hidden=true;
  if(content)content.hidden=!stageWorkspace;
  document.body.classList.toggle('stage-workspace-open',stageWorkspace);
}
function compactHeader(){
  const h=$('header h1'); if(h)h.textContent='Closed-Loop Reliability';
  document.title='Closed-Loop Reliability';
  const job=$('#job'); if(job){const s=read();job.textContent=s?.job?.JOB_ID||'UNASSIGNED PROJECT'}
  const tools=$('header .tools'); if(!tools)return;
  $$('button',tools).forEach(b=>{const t=(b.textContent||'').trim();if(/^New clean job$/i.test(t))b.textContent='New project';if(/^Test job$/i.test(t))b.remove()});
  let test=$('#load-test-project');
  if(test){const replacement=test.cloneNode(true);replacement.textContent='Open test project';test.replaceWith(replacement);test=replacement}
  else{test=document.createElement('button');test.id='load-test-project';test.type='button';test.textContent='Open test project';const imp=$$('button',tools).find(b=>/^Import$/i.test((b.textContent||'').trim()));tools.insertBefore(test,imp||null)}
  test.onclick=loadTestProject;
}
function projectActions(s){
  const spec=s?.testProject?.spec;
  return `<div class="project-actions"><button data-action="stage" class="primary-action">Open current stage</button>${spec?'<button data-action="reset-test">Reload test project</button>':''}<button data-action="export">Export project</button></div>`;
}
function projectHeader(s){
  const [n,st]=currentStage(s);const all=stages(s),done=all.filter(([,x])=>/COMPLETE/i.test(x?.status||'')).length,blocked=all.filter(([,x])=>/BLOCK/i.test(`${x?.status||''} ${x?.decision||''}`)).length;
  const title=s?.job?.JOB_TITLE||s?.testProject?.spec?.title||'Untitled project';
  const objective=s?.job?.EXACT_USER_OBJECTIVE_VERBATIM||s?.testProject?.spec?.objective?.exactUserObjective||'Add the exact project objective in Stage 01.';
  return `<div class="project-title-row"><div><div class="eyebrow">PROJECT</div><h2>${esc(title)}</h2><p>${esc(objective)}</p></div><span class="status-pill ${stateTone(s?.job?.CURRENT_STATE)}">${esc(s?.job?.CURRENT_STATE||'NOT STARTED')}</span></div><div class="project-now"><div><b>Current</b><span>Stage ${pad(n)} · ${esc(st?.title||st?.name||'Workflow')}</span></div><div><b>Progress</b><span>${done}/30 complete${blocked?` · ${blocked} blocked`:''}</span></div><div><b>Next</b><span>${esc(s?.job?.NEXT_REQUIRED_ACTION||st?.nextStage||'Continue the current stage')}</span></div></div>${s?.testProject?.spec?'<div class="test-note"><b>Test project</b><span>This is a real persisted project record. It is intentionally not marked complete where independent work has not actually occurred.</span></div>':''}${projectActions(s)}`;
}
function tabs(){return `<nav class="project-tabs">${[['overview','Overview'],['workflow','Workflow'],['records','Project data'],['runs','Runs'],['issues','Issues'],['release','Release'],['history','History']].map(([id,t])=>`<button data-view="${id}" class="${view===id?'selected':''}">${t}</button>`).join('')}</nav>`}
function overview(s){
  const spec=s?.testProject?.spec,[n,st]=currentStage(s);const blockers=spec?.blockers||[];
  return `<section class="panel"><h3>What needs attention now</h3><div class="attention-card ${stateTone(`${st?.status} ${st?.decision}`)}"><div><b>Stage ${pad(n)} · ${esc(st?.title||st?.name||'Workflow')}</b><p>${esc(summaryText(st))}</p></div><button data-action="stage">Open stage</button></div>${blockers.length?`<div class="callout bad"><b>${blockers.length} blocker${blockers.length===1?'':'s'}</b><span>${esc(blockers[0].missingEvidenceAuthorityInputOrCapability||blockers[0].reason||'A mandatory condition is unavailable.')}</span></div>`:''}<div class="overview-grid"><div><h4>Requested result</h4>${visibleRecords(spec?.objective||{objective:s?.job?.EXACT_USER_OBJECTIVE_VERBATIM,deliverable:s?.job?.EXACT_DELIVERABLE_REQUESTED})}</div><div><h4>Latest evidence</h4><p>${esc(s?.job?.LATEST_EVIDENCE_REFERENCE||st?.decisionEvidence||'None recorded')}</p></div></div>${spec?disclosure('Supplied materials',visibleRecords(spec.sourceInventory),true):''}${spec?disclosure('What has been generated',visibleRecords({prompts:spec.generatedPrompts||[],outputs:spec.generatedOutputs||[]}),false):''}</section>`;
}
function workflow(s){
  const [current]=currentStage(s);const rows=stages(s).map(([n,st])=>`<button class="stage-row ${n===current?'current':''}" data-stage-open="${n}"><span class="stage-number">${pad(n)}</span><span class="stage-name">${esc(st?.title||st?.name||`Stage ${n}`)}</span><span class="stage-status ${stateTone(`${st?.status} ${st?.decision}`)}">${esc(st?.status||st?.decision||'NOT STARTED')}</span></button>`).join('');
  return `<section class="panel"><div class="section-title"><div><h3>30-stage workflow</h3><p>Stages remain intact. Open the stage you are working on; the detailed workbook controls stay out of the way until needed.</p></div></div><div class="stage-list">${rows}</div></section>`;
}
function records(s){
  const spec=s?.testProject?.spec;
  return `<section class="panel"><h3>Project data</h3><p class="lede">Everything materially entered, derived, generated, or preserved by the project remains inspectable here.</p>${disclosure('User-entered information',visibleRecords(spec?.userEnteredData||s?.job),true)}${disclosure('Supplied materials and source inventory',visibleRecords(spec?.sourceInventory||[]),true)}${disclosure('Requirements and research',visibleRecords({research:spec?.research||[],requirements:spec?.requirements||[],requirementResolution:spec?.requirementResolution||[]}))}${disclosure('Verification and failure tests',visibleRecords({tests:spec?.tests||[],mutations:spec?.mutations||[]}))}${disclosure('Production instruction',visibleRecords(spec?.productionInstruction||{}),true)}${disclosure('Generated prompts and instructions',visibleRecords(spec?.generatedPrompts||[]),true)}${disclosure('Generated outputs and responses',visibleRecords(spec?.generatedOutputs||[]),true)}</section>`;
}
function runs(s){
  const spec=s?.testProject?.spec;const phaseData=spec?.phases||{};const contextRecords=spec?.freshContexts||[];
  return `<section class="panel"><h3>Independent runs</h3><p class="lede">Each execution/review context is recorded separately. A run is not counted as independent merely because a record exists.</p>${disclosure('Prepared and recorded contexts',visibleRecords(contextRecords),true)}${disclosure('Iterations and runs',visibleRecords(phaseData),true)}${disclosure('Captured outputs',visibleRecords(spec?.generatedOutputs||[]),true)}<div class="callout"><b>Fresh-context control</b><span>Use the current stage workspace to inspect/copy the exact generated instruction and record the returned output. Other-run output and reviewer feedback must remain excluded from an independent run.</span></div></section>`;
}
function issues(s){
  const spec=s?.testProject?.spec;
  return `<section class="panel"><h3>Issues and corrections</h3>${disclosure('Active and resolved blockers',visibleRecords(spec?.blockers||[]),true)}${disclosure('Defects and root cause',visibleRecords(spec?.defects||[]),true)}${disclosure('Regression tests',visibleRecords(spec?.regressions||[]),true)}${disclosure('Changes and downstream invalidation',visibleRecords(spec?.changes||[]),true)}<div class="callout"><b>How this works</b><span>Blockers stop affected downstream work. Material changes invalidate dependent determinations and identify the reruns required before those determinations count again.</span></div></section>`;
}
function release(s){
  const spec=s?.testProject?.spec;
  return `<section class="panel"><h3>Release readiness</h3><p class="lede">This view is derived from project evidence. It is not a second checklist to fill out.</p>${disclosure('Convergence',visibleRecords(spec?.convergence||{}),true)}${disclosure('Baseline',visibleRecords(spec?.baseline||{}),true)}${disclosure('Finished product',visibleRecords(spec?.product||{}),true)}${disclosure('Process and product audit',visibleRecords(spec?.audits||{}),true)}${disclosure('Release gate and artifact identity',visibleRecords(spec?.release||{}),true)}${disclosure('Evidence chains',visibleRecords(spec?.evidenceChains||[]))}</section>`;
}
function history(s){
  const spec=s?.testProject?.spec,prompts=spec?.generatedPrompts||[],outs=spec?.generatedOutputs||[];
  return `<section class="panel"><h3>Complete project history</h3><p class="lede">Earlier records are retained rather than replaced by the current status.</p>${stages(s).map(([n,st])=>`<details class="history-stage"><summary><span>Stage ${pad(n)} · ${esc(st?.title||st?.name||'')}</span><span class="${stateTone(`${st?.status} ${st?.decision}`)}">${esc(st?.status||st?.decision||'NOT STARTED')}</span></summary><div class="history-content">${disclosure('Stage record',`<pre>${esc(st?.draftRecord||'No stage record saved.')}</pre>`,true)}${disclosure('Generated instruction',`<pre>${esc(prompts.find(p=>Number(p.stage)===n)?.prompt||st?.generatedPrompt||'No generated instruction saved.')}</pre>`)}${disclosure('Saved response or output',`<pre>${esc(outs.find(o=>Number(o.stage)===n)?.output||st?.responseDraft||'No response saved.')}</pre>`)}${disclosure('Decision and evidence',visibleRecords({status:st?.status,decision:st?.decision,decisionEvidence:st?.decisionEvidence,nextStage:st?.nextStage,dateTime:st?.dateTime}))}</div></details>`).join('')}</section>`;
}
function render(){
  compactHeader();const s=read(),shell=ensureShell();hideWorkbookChrome();
  if(!s){shell.innerHTML='<section class="panel empty"><h2>No project loaded</h2><p>Create a project, import one, or open the real test project.</p><div class="project-actions"><button data-action="new" class="primary-action">New project</button><button data-action="test">Open test project</button><button data-action="import">Import project</button></div></section>';bind(shell);return}
  const body=view==='overview'?overview(s):view==='workflow'?workflow(s):view==='records'?records(s):view==='runs'?runs(s):view==='issues'?issues(s):view==='release'?release(s):history(s);
  shell.innerHTML=projectHeader(s)+tabs()+body;bind(shell);
}
function bind(root){
  $$('[data-view]',root).forEach(b=>b.onclick=()=>{view=b.dataset.view;stageWorkspace=false;render()});
  $$('[data-stage-open]',root).forEach(b=>b.onclick=()=>openStage(Number(b.dataset.stageOpen)));
  $$('[data-action]',root).forEach(b=>b.onclick=()=>{const a=b.dataset.action;if(a==='stage'){const [n]=currentStage(read());openStage(n)}if(a==='new'&&typeof window.newJob==='function')window.newJob();if(a==='test'||a==='reset-test')loadTestProject();if(a==='import')window.imp?.click();if(a==='export'&&typeof window.exportProject==='function')window.exportProject()});
}
function openStage(n){
  const s=read();if(s){s.activeStage=n;write(s)}stageWorkspace=true;render();
  const target=$$(`#nav [data-stage]`).find(b=>Number(b.dataset.stage)===n);target?.click();
  setTimeout(()=>{humanizeStage();$('#content')?.scrollIntoView({behavior:'smooth',block:'start'})},40);
}
function humanizeStage(){
  if(!stageWorkspace)return;const c=$('#content');if(!c)return;
  $$('h3',c).forEach(h=>{const t=h.textContent.trim();if(t==='AGENT RESPONSE RECEIPT')h.textContent='Saved response and output';if(t==='COPY INTO THE ASSIGNED AGENT')h.textContent='Generated instruction';if(t==='FILL-IN STAGE RECORD')h.textContent='Stage record';if(t==='EVIDENCE TO PRESERVE')h.textContent='Evidence to keep';if(t==='HUMAN CHECKLIST')h.textContent='Required work'});
  let bar=$('#stage-workspace-bar');if(!bar){bar=document.createElement('div');bar.id='stage-workspace-bar';c.prepend(bar)}
  const s=read(),[n,st]=currentStage(s);bar.innerHTML=`<div><b>Stage ${pad(n)} · ${esc(st?.title||st?.name||'Workflow')}</b><span>${esc(summaryText(st))}</span></div><button id="close-stage-workspace">Back to project</button>`;$('#close-stage-workspace').onclick=()=>{stageWorkspace=false;view='workflow';render();window.scrollTo({top:0,behavior:'smooth'})};
}
function buildTestState(template,spec){
  const s=structuredClone(template);s.testProject={id:spec.testProjectId,source:'TEST_PROJECT.json',loadedAt:new Date().toISOString(),spec:structuredClone(spec)};s.job=s.job||{};
  Object.assign(s.job,{JOB_ID:spec.jobId,JOB_TITLE:spec.title,JOB_OWNER:spec.userEnteredData?.requester||'Application owner',DATE_OPENED:spec.date,CURRENT_ITERATION:spec.currentIteration||'ITERATION-001',CURRENT_STAGE:`STAGE ${pad(spec.currentStage||1)}`,CURRENT_STATE:spec.currentState||'IN PROGRESS',CURRENT_INPUT_VERSION:spec.currentVersions?.input||'INPUT-v001',CURRENT_SOURCE_SET_VERSION:spec.currentVersions?.sources||'SOURCE-SET-v001',CURRENT_REQUIREMENTS_VERSION:spec.currentVersions?.requirements||'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:spec.currentVersions?.tests||'TEST-SUITE-v001',CURRENT_INSTRUCTION_VERSION:spec.currentVersions?.instruction||'INSTRUCTION-v001',CURRENT_BASELINE_ID:spec.baseline?.baselineId||'NONE',CURRENT_PRODUCT_ID:spec.product?.productId||'NONE',CURRENT_BLOCKERS:(spec.blockers||[]).filter(x=>x.currentStatus==='OPEN').map(x=>x.blockerId).join(', ')||'NONE',NEXT_REQUIRED_ACTION:spec.nextRequiredAction||'Continue the current stage.',LATEST_EVIDENCE_REFERENCE:spec.latestEvidenceReference||'TEST_PROJECT.json',EXACT_USER_OBJECTIVE_VERBATIM:spec.objective?.exactUserObjective||'',EXACT_DELIVERABLE_REQUESTED:spec.objective?.deliverable||'',REQUIRED_OUTPUT_FORMAT:spec.objective?.requiredOutputFormat||'',DEADLINE_OR_TEMPORAL_SCOPE:spec.objective?.temporalScope||'NONE',KNOWN_AUTHORITATIVE_SOURCES:(spec.sourceInventory||[]).map(x=>x.sourceId).join(', '),AVAILABLE_TOOLS:(spec.availableTools||[]).join(', '),PROHIBITED_ACTIONS:(spec.prohibitedActions||[]).join('\n'),EXPLICIT_USER_REQUIREMENTS:(spec.requirements||[]).map(x=>`${x.reqId}: ${x.requirement}`).join('\n'),ASSUMPTIONS:(spec.assumptions||[]).map(x=>x.statement||x).join('\n')||'NONE',UNKNOWN_INFORMATION:(spec.unknowns||[]).map(x=>x.unknownFact||x).join('\n')||'NONE'});
  for(const [n,st] of stages(s)){
    const r=spec.stageStates?.[String(n)]||spec.stageStates?.[n]||{};st.status=r.status||'NOT STARTED';st.decision=r.decision||'';st.decisionEvidence=r.evidence||'';st.nextStage=r.next||'';st.decidedBy=r.decidedBy||'';st.dateTime=r.dateTime||'';st.draftRecord=r.record||'';st.generatedPrompt=(spec.generatedPrompts||[]).find(p=>Number(p.stage)===n)?.prompt||'';st.responseDraft=(spec.generatedOutputs||[]).find(o=>Number(o.stage)===n)?.output||'';
  }
  s.activeStage=spec.currentStage||1;return s;
}
async function loadTestProject(){
  if(loadingTest)return;loadingTest=true;
  try{const template=read();if(!template)throw new Error('The workflow runtime has not initialized yet.');const r=await fetch(`TEST_PROJECT.json?${REV}-${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const spec=await r.json();write(buildTestState(template,spec));view='overview';stageWorkspace=false;render();window.scrollTo({top:0,behavior:'smooth'})}catch(e){alert(`Test project could not be opened: ${e.message}`)}finally{loadingTest=false}
}
function installStyles(){if($('#human-ui-styles'))return;const s=document.createElement('style');s.id='human-ui-styles';s.textContent=`body{font-size:14px;line-height:1.4}.app{max-width:760px}header{padding:10px 12px!important}main{padding:10px 12px!important}header h1{font-size:19px!important;line-height:1.1!important;margin:0 0 2px!important}header .tools{gap:5px!important;margin:7px 0!important}header .tools button{min-height:32px!important;padding:5px 9px!important;font-size:12px!important;border-radius:7px!important}#job{font-size:12px;color:#666}.bar{height:4px!important}.project-title-row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:1px solid #ddd;padding:1px 0 9px}.project-title-row h2{font-size:19px;margin:2px 0 4px;line-height:1.18}.project-title-row p{margin:0;color:#555;max-width:60ch}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.12em;color:#666}.status-pill{border:1px solid currentColor;border-radius:999px;padding:3px 7px;font-size:10px;font-weight:800;white-space:nowrap}.good{color:#176b3a}.warn{color:#8a5a00}.bad{color:#a12622}.neutral{color:#666}.project-now{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0}.project-now>div{border:1px solid #ddd;border-radius:8px;padding:7px 8px}.project-now b,.project-now span{display:block}.project-now b{font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#666;margin-bottom:2px}.project-now span{font-size:12px}.test-note{display:flex;gap:7px;align-items:baseline;background:#f4f4f1;border-radius:8px;padding:7px 8px;font-size:12px}.project-actions{display:flex;gap:5px;flex-wrap:wrap;margin:8px 0}.project-actions button,.attention-card button{min-height:31px!important;padding:5px 9px!important;font-size:12px!important}.primary-action{background:#111!important;color:#fff!important}.project-tabs{display:flex;gap:3px;overflow:auto;padding:1px 0 5px;margin-bottom:4px}.project-tabs button{min-height:30px!important;padding:4px 8px!important;font-size:11px!important;white-space:nowrap;border-radius:7px!important}.project-tabs button.selected{background:#111;color:#fff}.panel{border:1px solid #ddd;border-radius:10px;padding:10px;margin:0 0 10px}.panel h3{font-size:15px;margin:0 0 4px}.panel h4{font-size:12px;margin:0 0 5px}.lede{color:#555;margin:0 0 9px}.attention-card{display:flex;justify-content:space-between;gap:10px;align-items:center;border:1px solid #ddd;border-left:3px solid currentColor;border-radius:8px;padding:8px;margin:7px 0}.attention-card p{margin:2px 0 0;color:#555;font-size:12px}.overview-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:8px;margin:8px 0}.overview-grid>div{border:1px solid #e2e2e2;border-radius:8px;padding:8px}.overview-grid p{margin:0}.callout{display:flex;gap:7px;align-items:baseline;background:#f4f4f1;border-radius:8px;padding:8px;margin:8px 0;font-size:12px}.callout.bad{background:#fff4f2}.disclosure{border-top:1px solid #e3e3e3;padding:7px 0}.disclosure>summary{cursor:pointer;font-size:12px;font-weight:750}.disclosure-body{padding:7px 0 1px}.data-list{margin:0}.data-list>div{display:grid;grid-template-columns:minmax(120px,32%) 1fr;gap:8px;border-top:1px solid #eee;padding:5px 0}.data-list dt{font-size:10px;color:#666}.data-list dd{margin:0;font-size:12px;overflow-wrap:anywhere}.record-list details{border-top:1px solid #eee;padding:5px 0}.record-list summary{font-size:12px;font-weight:650}.record-body{padding:5px 0}.quiet{color:#666;font-size:12px}.stage-list{margin-top:8px}.stage-row{display:grid!important;grid-template-columns:30px 1fr auto;gap:7px;align-items:center;width:100%;text-align:left;border:0!important;border-top:1px solid #e8e8e8!important;border-radius:0!important;min-height:39px!important;padding:5px 2px!important;background:#fff!important;color:#111!important}.stage-row.current{background:#f6f6f3!important}.stage-number{font-size:10px;font-weight:800;color:#666}.stage-name{font-size:12px;font-weight:650}.stage-status{font-size:9px;font-weight:800}.history-stage{border-top:1px solid #ddd;padding:7px 0}.history-stage>summary{display:flex;justify-content:space-between;gap:8px;font-size:12px;font-weight:750}.history-content pre,.disclosure pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f5f2;border-radius:7px;padding:8px;font:11px/1.35 ui-monospace,monospace;max-height:360px;overflow:auto}.empty{margin-top:8px}#stage-workspace-bar{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;position:sticky;top:0;z-index:4;background:#fff;border:1px solid #ddd;border-radius:9px;padding:8px;margin:0 0 8px;box-shadow:0 2px 8px #0000000b}#stage-workspace-bar b,#stage-workspace-bar span{display:block}#stage-workspace-bar span{color:#555;font-size:11px;margin-top:2px}#stage-workspace-bar button{min-height:30px!important;padding:4px 8px!important;font-size:11px!important}.stage-workspace-open #human-shell{display:none}.stage-workspace-open #content .card{padding:10px!important;margin:8px 0!important}.stage-workspace-open #content h2{font-size:16px!important}.stage-workspace-open #content h3{font-size:12px!important;margin:12px 0 5px!important}.stage-workspace-open #content button{min-height:32px!important;padding:5px 8px!important;font-size:12px!important}.stage-workspace-open #content textarea,.stage-workspace-open #content input,.stage-workspace-open #content select{font-size:16px!important;min-height:36px!important}.stage-workspace-open #content .copy{font-size:11px!important;max-height:320px!important}.tabs button[data-view="appendices"],#appendix-operational-purpose,#repository-test-project,[data-integrated-operational-controls="true"],#project-inspector{display:none!important}@media(max-width:560px){.project-title-row{display:block}.status-pill{display:inline-block;margin-top:6px}.project-now{grid-template-columns:1fr}.overview-grid{grid-template-columns:1fr}.data-list>div{grid-template-columns:1fr}.data-list dt{margin-bottom:-4px}.attention-card{align-items:flex-start}.attention-card button{white-space:nowrap}}`;document.head.appendChild(s)}
function boot(){installStyles();compactHeader();render();if(new URLSearchParams(location.search).get('test')==='1'&&!read()?.testProject)setTimeout(loadTestProject,250)}
const observer=new MutationObserver(()=>{clearTimeout(window.__humanUiTick);window.__humanUiTick=setTimeout(()=>{compactHeader();hideWorkbookChrome();if(stageWorkspace)humanizeStage()},45)});observer.observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('load',()=>setTimeout(boot,120));setTimeout(boot,240);
})();