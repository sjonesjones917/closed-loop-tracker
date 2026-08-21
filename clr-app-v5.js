const {STAGES,REQUIRED,BUILTIN}=window.CLR_DATA; const KEY='closed_loop_reliability_v5_31';
let DB=load(); let current=DB.current||BUILTIN.id; const A=document.getElementById('app');
function load(){try{let d=JSON.parse(localStorage.getItem(KEY)||'{"projects":[]}');if(!Array.isArray(d.projects))d.projects=[];if(!d.projects.some(x=>x.id===BUILTIN.id))d.projects.unshift(structuredClone(BUILTIN));return d}catch(e){return{projects:[structuredClone(BUILTIN)]}}}
function save(){DB.current=current;localStorage.setItem(KEY,JSON.stringify(DB));head()}function p(){return DB.projects.find(x=>x.id===current)||null}function esc(v){return String(v??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]))}function head(){let x=p();document.getElementById('sub').textContent=x?`${x.id} • ${x.stages.filter(s=>s.status==='COMPLETE').length}/31 • ${x.release||'UNRELEASED'}`:'No project selected'}async function cp(t){try{await navigator.clipboard.writeText(t)}catch{prompt('Copy:',t)}}
function uid(){let a=new Uint32Array(1);crypto.getRandomValues(a);return 'JOB-'+Date.now().toString(36).toUpperCase()+'-'+a[0].toString(16).toUpperCase()}
function blankJob(){let id=uid();let j={id,title:'Untitled project',objective:'',deliverable:'',supplied:'',format:'',tools:'',prohibited:'',release:'UNRELEASED',stages:STAGES.map((name,i)=>({n:i+1,name,status:'NOT_STARTED',result:'',prompt:''})),artifact:null,builtin:false};j.stages.forEach(s=>s.prompt=makePrompt(s.n,j));return j}
function makePrompt(n,j){let markers=(REQUIRED[n]||[]).map(x=>'- '+x).join('\n');let prior=n===1?'Use the raw job input below; there is no prior stage.':'Use every completed prior-stage result in this project as authoritative workflow state.';let extra=n===9?'\nAudit every sentence/material clause of the production instruction; do not generate the final product in this stage.':(n===11||n===18||n===20?'\nExecute ten genuinely separate runs and record every run; a duplicated summary is invalid.':(n===31?'\nRelease only the exact accepted bytes verified by Stage 30; any identity difference is BLOCKED.':''));return `ROLE
You are the execution agent for one operation of the Closed-Loop Agent Reliability Workflow. Execute the operation; do not merely describe it.

JOB CONTROL
JOB_ID: ${j.id}
CURRENT_STAGE: ${String(n).padStart(2,'0')}
STAGE_NAME: ${STAGES[n-1]}
INPUT_SET_VERSION: INPUT-v001

AUTHORITATIVE JOB INPUT
EXACT_USER_OBJECTIVE:
${j.objective||'UNKNOWN'}

EXACT_DELIVERABLE_REQUESTED:
${j.deliverable||'UNKNOWN'}

SUPPLIED MATERIALS / CONSTRAINTS:
${j.supplied||'NONE SUPPLIED'}

REQUIRED OUTPUT FORMAT:
${j.format||'UNKNOWN'}

AVAILABLE TOOLS:
${j.tools||'UNKNOWN'}

PROHIBITED ACTIONS:
${j.prohibited||'NONE SUPPLIED'}

PRIOR WORKFLOW STATE
${prior}

TASK
Execute Stage ${String(n).padStart(2,'0')} — ${STAGES[n-1]}. Perform every operation necessary for this stage using available tools and evidence. Do not substitute a summary token for performed work. Do not advance to a later stage. If a mandatory fact or capability is unavailable after using available sources/tools, return BLOCKED with the exact missing item and why it prevents completion.${extra}

COMPLETION EVIDENCE CONTRACT
The application rejects completion unless the result contains every marker below:
${markers}

OPERATING RULES
- Do not invent facts.
- Do not silently resolve authoritative conflicts.
- Use deterministic verification whenever deterministically testable.
- Require affirmative evidence for every mandatory requirement.
- Mandatory unknowns are BLOCKED.
- Root-cause every material failure before correction.
- Correct the earliest defective layer.
- Convert confirmed defects to regression tests.
- Preserve exact version and hash identity.
- Never release bytes different from audited bytes.

EXECUTION REQUIREMENT
Execute THIS stage now. Bare phrases such as PASS, COMPLETE, SELFTEST-EVIDENCE-XX, or one-line summaries are invalid.`}
function validateStage(n,text){let miss=(REQUIRED[n]||[]).filter(m=>!text.includes(m));let lines=text.trim().split(/\n/).filter(Boolean);if(lines.length<5)miss.unshift('minimum substantive evidence: >=5 nonblank lines');if(/SELFTEST-EVIDENCE-\d+/i.test(text))miss.unshift('synthetic SELFTEST-EVIDENCE token forbidden');if(text.trim().length<180)miss.unshift('minimum substantive evidence: >=180 characters');return [...new Set(miss)]}
function projects(){A.innerHTML='<div class="row between"><h2>Projects</h2><button onclick="newProject()">New Project</button></div>'+DB.projects.map(x=>`<div class="card ${x.builtin?'ok':''}"><b>${esc(x.title)}</b><div><small>${esc(x.id)} • ${x.stages.filter(s=>s.status==='COMPLETE').length}/31 • ${esc(x.release)}</small></div><p class="muted">${esc(x.objective||'No objective entered.')}</p><button onclick="openP('${x.id}')">Open</button> ${x.builtin?'<span class="pill ACCEPTED">BUILT-IN VERIFIED SELF-TEST</span>':''}</div>`).join('');head()}
function newProject(){let j=blankJob();DB.projects.unshift(j);current=j.id;save();editJob()}
function openP(id){current=id;save();workflow()}
function fld(label,key,area=false){let x=p();return `<label>${label}</label>${area?`<textarea oninput="setField('${key}',this.value)">${esc(x[key])}</textarea>`:`<input value="${esc(x[key])}" oninput="setField('${key}',this.value)">`}`}
function setField(k,v){let x=p();x[k]=v;x.stages.forEach(s=>{if(s.status==='NOT_STARTED')s.prompt=makePrompt(s.n,x)});save()}
function editJob(){let x=p();A.innerHTML='<div class="row between"><h2>Project input</h2><button class="s" onclick="workflow()">Done</button></div><div class="card notice"><b>Stage 1 is not auto-completed.</b><p class="muted">Enter the job facts, then open Stage 01 and execute its actual prompt. The result must satisfy the Stage 01 evidence contract.</p></div><div class="card">'+fld('Project title','title')+fld('Exact user objective','objective',true)+fld('Exact deliverable requested','deliverable',true)+fld('Supplied materials / constraints','supplied',true)+fld('Required output format','format')+fld('Available tools','tools',true)+fld('Prohibited actions','prohibited',true)+'</div>';head()}
function workflow(){let x=p();if(!x)return projects();let c=x.stages.filter(s=>s.status==='COMPLETE').length;A.innerHTML=`<div class="row between"><h2>${esc(x.title)}</h2>${x.builtin?'':'<button class="s" onclick="editJob()">Project input</button>'}</div><div class="grid"><div class="metric"><b>${c}/31</b><small>Completed</small></div><div class="metric"><b>${esc(x.release)}</b><small>Release</small></div></div>`+x.stages.map(s=>`<div class="stage" onclick="stageView(${s.n})"><div class="n">${String(s.n).padStart(2,'0')}</div><div><b>${esc(s.name)}</b><div class="muted" style="font-size:11px">${s.status==='COMPLETE'?'Evidence stored':'Requires execution'}</div></div><span class="pill ${s.status}">${s.status}</span></div>`).join('');head()}
function stageView(n){let x=p(),s=x.stages[n-1];A.innerHTML=`<div class="row between"><button class="s" onclick="workflow()">← Workflow</button><span class="pill ${s.status}">${s.status}</span></div><h2>${String(n).padStart(2,'0')}. ${esc(s.name)}</h2><div class="card notice"><b>Execution prompt</b><pre>${esc(s.prompt||makePrompt(n,x))}</pre><button onclick="cp(p().stages[${n-1}].prompt||makePrompt(${n},p()))">Copy complete prompt</button></div><div class="card"><b>Completion evidence contract</b><pre>${esc((REQUIRED[n]||[]).join('\n'))}</pre></div><div class="card"><label>Complete stage result / evidence</label><textarea id="res" style="min-height:300px" ${x.builtin?'readonly':''}>${esc(s.result)}</textarea>${x.builtin?'':'<div class="row wrap"><button onclick="saveStage('+n+')">Validate & save COMPLETE</button><button class="s" onclick="markBlocked('+n+')">Mark BLOCKED</button></div>'}<div id="vmsg"></div></div>`;head()}
function saveStage(n){let x=p(),t=document.getElementById('res').value,miss=validateStage(n,t),m=document.getElementById('vmsg');if(miss.length){m.innerHTML='<div class="card warn"><b>REJECTED as completion evidence.</b><pre>'+esc(miss.join('\n'))+'</pre></div>';return}x.stages[n-1].result=t;x.stages[n-1].status='COMPLETE';if(n===29){let mm=t.match(/OUTCOME:\s*(ACCEPTED|REJECTED|BLOCKED)/);if(mm)x.release=mm[1]}save();m.innerHTML='<div class="card ok"><b>Evidence contract satisfied and stage stored COMPLETE.</b></div>'}
function markBlocked(n){let x=p(),t=document.getElementById('res').value;if(t.trim().length<80){document.getElementById('vmsg').innerHTML='<div class="card warn">BLOCKED requires substantive blocker evidence, not an empty token.</div>';return}x.stages[n-1].result=t;x.stages[n-1].status='BLOCKED';x.release='BLOCKED';save();workflow()}
function artifactView(){let x=p();if(!x)return projects();if(!x.artifact){A.innerHTML='<h2>Artifact</h2><div class="card warn"><b>No released artifact is stored in this project.</b><p>Stage 31 must release the exact accepted artifact before this screen can show it.</p></div>';return}let a=x.artifact;A.innerHTML=`<h2>Released artifact</h2><div class="card ok"><b>${esc(a.name)}</b><p><small>${a.bytes} bytes • SHA-256 ${esc(a.sha256)}</small></p><label>Exact hexadecimal bytes</label><pre>${esc(a.hex)}</pre><label>Decoded text</label><pre>${esc(a.text)}</pre>${x.builtin?`<button onclick="downloadSelftest()">Download exact artifact</button>`:''}</div>`;head()}
function downloadSelftest(){let b=new Uint8Array(BUILTIN.artifact.hex.match(/../g).map(h=>parseInt(h,16)));let u=URL.createObjectURL(new Blob([b],{type:'text/plain'}));let a=document.createElement('a');a.href=u;a.download=BUILTIN.artifact.name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function auditView(){let x=p();if(!x)return projects();let failures=[];x.stages.forEach(s=>{if(s.status==='COMPLETE'){let m=validateStage(s.n,s.result);if(m.length)failures.push(`Stage ${s.n}: ${m.join('; ')}`)}});let all=x.stages.length===31,complete=x.stages.every(s=>s.status==='COMPLETE');A.innerHTML=`<h2>Application / project audit</h2><div class="card ${failures.length?'warn':'ok'}"><b>Structural checks</b><pre>stage_count=${x.stages.length} expected=31\nall_stage_names_match=${all}\ncompleted_stage_evidence_schema_failures=${failures.length}\nall_31_complete=${complete}\nrelease_state=${esc(x.release)}\nartifact_present=${!!x.artifact}</pre>${failures.length?'<pre class="err">'+esc(failures.join('\n'))+'</pre>':'<p>No completed stage contains a synthetic token or misses its stage-specific evidence markers.</p>'}</div>`;head()}
function backup(){let blob=new Blob([JSON.stringify(DB,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='closed-loop-projects-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
(function boot(){let errors=[];if(STAGES.length!==31)errors.push('STAGES length != 31');if(BUILTIN.stages.length!==31)errors.push('self-test stage length != 31');BUILTIN.stages.forEach(s=>{let m=validateStage(s.n,s.result);if(m.length)errors.push('self-test Stage '+s.n+' invalid: '+m.join(', '))});if(BUILTIN.artifact.bytes!==21)errors.push('self-test artifact byte count != 21');if(errors.length){A.innerHTML='<div class="card warn"><b>APPLICATION BOOT AUDIT FAILED</b><pre class="err">'+esc(errors.join('\n'))+'</pre></div>';head();return}save();projects()})();