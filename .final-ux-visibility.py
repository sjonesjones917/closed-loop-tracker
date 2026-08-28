from pathlib import Path
import re, hashlib


def replace_one(path, old, new):
    p=Path(path); s=p.read_text()
    if old not in s: raise SystemExit(f'missing exact target in {path}: {old[:100]!r}')
    s=s.replace(old,new,1); p.write_text(s)

# Keep prompt identity honest after changing prompt behavior.
replace_one('prompt-engine.js', "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/19';", "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/20';")

p=Path('prompt-engine.js'); s=p.read_text()
old="${(()=>{const plan=verificationBatchPlan(stage,state,operation,scope),ids=plan?.triples?.map(x=>x.testId),handoff=workflow.executionHandoff(state,{stage,testIds:ids});if(!handoff.send.length&&!handoff.withhold.length&&!handoff.expectBack.length)return '';"
new="${(()=>{const plan=verificationBatchPlan(stage,state,operation,scope),ids=plan?.triples?.map(x=>x.testId),runIds=plan?.triples?.map(x=>x.runId),handoff=workflow.executionHandoff(state,{stage,operation,testIds:ids,runIds});if(!handoff.send.length&&!handoff.withhold.length&&!handoff.expectBack.length)return '';"
if old not in s: raise SystemExit('prompt handoff target missing')
s=s.replace(old,new,1); p.write_text(s)

p=Path('workflow-engine.js'); s=p.read_text()
start=s.index('function executionHandoff(')
end=s.index('function evidenceChainExplanation(', start)
new_func=r'''function executionHandoff(project,{stage=Number(project.activeStage||0),operation=null,testIds=null,runIds=null}={}){
  const op=String(operation||'').toUpperCase(),testStages=stage===12||[22,23,24].includes(stage)||(stage===17&&['VERIFY','REGRESSION'].includes(op))||(stage===19&&['VERIFY','REGRESSION_VERIFY'].includes(op)),ids=testIds?new Set(testIds.map(String)):null,items=testStages?testExecutionPlan(project).items.filter(i=>!ids||ids.has(i.testId)):[],send=new Map(),withhold=new Map(),expectBack=new Map(),artifacts=recordsForCurrentScope(project,'artifacts'),artifactsById=new Map(artifacts.map(a=>[recordId(a,'artifacts'),a]));
  const addArtifact=a=>{if(!a||upper(recordValue(a,'AVAILABILITY'))!=='BYTES_PERSISTED_AND_VERIFIED')return;const id=recordId(a,'artifacts');send.set(id,{artifactId:id,filename:String(recordValue(a,'FILENAME')||id),sha256:String(recordValue(a,'SHA256')||'UNKNOWN'),role:String(recordValue(a,'ROLE')||'AUTHORIZED_INPUT')});};
  const addReferenced=value=>{for(const id of new Set((JSON.stringify(value||'').match(/ARTIFACT-[A-Za-z0-9-]+/g)||[])))addArtifact(artifactsById.get(id));};
  for(const item of items){for(const a of item.handoff.send)addArtifact(artifactsById.get(a.artifactId));for(const x of item.handoff.withhold)withhold.set(x.artifactIdOrCategory,x);for(const x of item.handoff.expectBack)expectBack.set(x.kind+'|'+x.filenameOrPattern,x);}
  const current=currentScope(project),runExecution=stage===11||(stage===17&&op==='EXECUTE_RUN')||(stage===19&&op==='EXECUTE_RUN');
  if(runExecution){const candidate=recordsForCurrentScope(project,'candidateFreezes').find(c=>recordId(c,'candidateFreezes')===String(current.candidateId||''))||recordsForCurrentScope(project,'candidateFreezes').at(-1);addReferenced(recordValue(candidate,'COMPONENT_MANIFEST'));addReferenced(recordValue(candidate,'IMMUTABLE_LOCATIONS'));}
  if(stage===21){const baseline=recordsForCurrentScope(project,'baselines').find(b=>recordId(b,'baselines')===String(current.baselineId||''))||recordsForCurrentScope(project,'baselines').at(-1);addReferenced(recordValue(baseline,'IMMUTABLE_ARTIFACT_RECORDS'));addReferenced(recordValue(baseline,'APPROVED_VERSIONS'));}
  if([23,24,25].includes(stage))for(const a of artifacts)if(String(a.scope?.productId||'')===String(current.productId||''))addArtifact(a);
  if(stage===12){const wanted=runIds?new Set(runIds.map(String)):null;for(const run of recordsForCurrentScope(project,'runs'))if(!wanted||wanted.has(recordId(run,'runs')))addReferenced(recordValue(run,'OUTPUT_ARTIFACT_IDENTITIES'));}
  const stageWithhold={11:['outputs from other runs','reviewer feedback','failure explanations','proposed corrections'],12:['other verifiers’ determinations','Stage 13 comparison findings','root-cause analysis','correction proposals'],23:['Stage 21 generator correctness claims','unneeded deterministic pass conclusions','adversarial findings'],24:['generator reasoning or self-evaluation','prior reviewer conclusions that tell the adversarial reviewer what to find']};for(const label of stageWithhold[stage]||[])withhold.set(label,{artifactIdOrCategory:label,reason:'Withheld to preserve information isolation and reduce verification bias.'});
  const externalWork=[11,12,17,19,21,23,24,25].includes(stage);if(externalWork)expectBack.set('STRUCTURED_RESPONSE|final strict JSON response',{kind:'STRUCTURED_RESPONSE',filenameOrPattern:'final strict JSON response',required:true});
  return {send:[...send.values()],withhold:[...withhold.values()],expectBack:[...expectBack.values()]};
}
'''
s=s[:start]+new_func+s[end:]
s=s.replace("const plan=testExecutionPlan(project),relevant=[6,7,12,15,19,22,23,24,25,26,27,29].includes(stage)?plan.items:[];","const plan=testExecutionPlan(project),relevant=[12,22,23,24].includes(stage)?plan.items:[];",1)
p.write_text(s)

p=Path('app-core.js'); s=p.read_text()
start=s.index('function testExecutionGuidanceMarkup(')
end=s.index('function interactionModeMarkup(', start)
new_ui=r'''function testExecutionGuidanceMarkup(n){
  const operation=selectedOperation(n),verificationStage=n===6||n===12||[22,23,24].includes(n)||(n===17&&['VERIFY','REGRESSION'].includes(operation))||(n===19&&['VERIFY','REGRESSION_VERIFY'].includes(operation));if(!verificationStage)return '';
  const plan=engine.testExecutionPlan(current);if(!plan.total&&n!==6)return '';
  const actionRows=plan.items.map(item=>({test:item.testId,requirement:item.requirementId,executor:item.executorClass,capability:item.requiredCapability,ready:item.executableNow?'YES':'NO',action:item.operatorAction,blockingReason:item.blockingReason||'NONE',files:item.requiredArtifactIds.map((id,index)=>`${id} — ${item.requiredArtifactNames[index]||'file'}`).join('; ')||'NONE',returnEvidence:item.returnRequirements.requiredEvidenceDescription})),handoff=engine.executionHandoff(current,{stage:n,operation}),handoffRows=[...handoff.send.map(x=>({direction:'SEND',item:`${x.artifactId} — ${x.filename}`,reason:`SHA-256 ${x.sha256}`})),...handoff.withhold.map(x=>({direction:'DO NOT SEND',item:x.artifactIdOrCategory,reason:x.reason})),...handoff.expectBack.map(x=>({direction:'RETURN',item:x.filenameOrPattern||x.kind,reason:x.required?'REQUIRED':'OPTIONAL'}))],blocked=plan.items.filter(x=>!x.executableNow),heading=n===6?'Verification execution plan':'Verification execution — what happens next',intro=n===6?'Stage 06 defines who will execute each test, with what capability, files, and proof. No test is represented as executed here.':'The application derives executor, capability, exact file custody, and required return evidence from the accepted test definitions. You do not need to interpret execution modes manually.';
  return `<div class="panel" id="execution-guidance"${blocked.length?' tabindex="-1"':''}><h2 class="section-title">${esc(heading)}</h2><p class="section-intro">${esc(intro)} A filename, hash claim, or code block is not file possession. Tests requiring exact artifact bytes that are missing or unverified remain blocked; browser storage alone does not give an external executor access to those bytes.</p>${plan.unsupportedApplicationTestIds.length?`<div class="notice danger"><strong>Invalid application executor claim.</strong><br>No registered application-native executor exists for ${esc(plan.unsupportedApplicationTestIds.join(', '))}. Request a corrected Stage 6 test definition; do not substitute or fabricate native execution.</div>`:''}${blocked.length?`<div class="notice warn"><strong>${n===6?'Verification route is not ready.':'Execution is blocked.'}</strong><br>${blocked.map(x=>`${esc(x.testId)}: ${esc(x.blockingReason||'Execution cannot proceed.')}`).join('<br>')}</div>`:''}${actionRows.length?details('Who performs the current tests',actionRows,true):'<div class="notice">No accepted test definition exists yet.</div>'}${handoffRows.length?details('Exact handoff',handoffRows,true):''}</div>`;
}
'''
s=s[:start]+new_ui+s[end:]
# Replace identifier-only provenance with collapsed direct evidence hops.
prov_start=s.index('function provenanceMarkup(')
prov_end=s.index('function workflow(){', prov_start)
old_prov=s[prov_start:prov_end]
new_prov=r'''function provenanceMarkup(n){const manifests=safe(current.projectData.extractionManifests).filter(m=>Number(m.stage)===n),cards=manifests.flatMap(m=>safe(m.entries||m.changes).map(e=>{const rawId=m.rawResponseId||m.RAW_RESPONSE_ID,promptId=m.promptId||m.PROMPT_ID,raw=safe(current.projectData.rawResponses).find(x=>x.rawResponseId===rawId),prompt=safe(current.projectData.generatedPrompts).find(x=>(x.instructionId||x.promptId)===promptId),evidence=safe(e.evidenceIds).map(id=>engine.records(current,'evidenceRecords').find(x=>engine.recordId(x,'evidenceRecords')===id)).filter(Boolean),name=`${e.canonicalCollection||e.canonicalRecordType||''}/${e.canonicalRecordId||''}/${e.canonicalField||e.canonicalRelationship||''}`;return `<details class="record-card"><summary>${esc(name)}<span>Trace</span></summary><div class="record-body"><p class="section-intro">Canonical field → extraction manifest → exact response pointer → preserved raw response → controlling prompt → canonical evidence.</p>${details('Extraction manifest and response pointer',{manifestId:m.manifestId,responsePointer:e.jsonPointer||e.JSON_POINTER_IN_RESPONSE||'',rawResponseId:rawId||'NONE',promptId:promptId||'NONE',evidenceIds:e.evidenceIds||[]},true)}${raw?details('Preserved raw response',raw):'<div class="notice warn">Preserved raw response is unavailable for this trace.</div>'}${prompt?details('Controlling prompt',prompt):'<div class="notice warn">Controlling prompt is unavailable for this trace.</div>'}${evidence.length?details('Canonical evidence',evidence):'<div class="notice warn">No canonical evidence record is linked to this value.</div>'}</div></details>`;}));return cards.length?`<div class="panel"><h2 class="section-title">Provenance navigation</h2><p class="section-intro">Open only the value you need to audit; every hop needed to explain where it came from is available in the same trace.</p>${cards.join('')}</div>`:'';}
'''
s=s[:prov_start]+new_prov+s[prov_end:]
p.write_text(s)

# Add regression assertions that prevent execution guidance/handoff from leaking onto unrelated stages.
p=Path('verify-prompt-semantics.mjs'); s=p.read_text()
needle="if(!ui.includes('Invalid application executor claim')||!ui.includes('No registered application-native executor exists'))throw new Error('Operator UI does not fail unsupported application-native test claims closed.');"
extra=needle+"\n if(!ui.includes(\"verificationStage=n===6||n===12||[22,23,24].includes(n)\")||ui.includes(\"[7,8,9,10,11,12,17,19,22,23,24,25,26,27,29]\"))throw new Error('Verification execution guidance is not contextually limited to actual verification operations.');\n if(!ui.includes('Preserved raw response')||!ui.includes('Controlling prompt')||!ui.includes('Canonical evidence'))throw new Error('Provenance UI does not expose the complete field-to-raw-to-prompt-to-evidence audit path.');"
if needle not in s: raise SystemExit('semantic assertion anchor missing')
s=s.replace(needle,extra,1); p.write_text(s)

# Update shared runtime token from the exact runtime bytes, matching verify-hash.mjs.
runtime=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def git_blob_sha(path):
    b=Path(path).read_bytes(); return hashlib.sha1(f'blob {len(b)}\0'.encode()+b).hexdigest()
manifest=''.join(f'{f}:{git_blob_sha(f)}\n' for f in runtime)
token='runtime-'+hashlib.sha256(manifest.encode()).hexdigest()[:16]
p=Path('index.html'); s=p.read_text();
for f in runtime:
    s,n=re.subn(rf'(<script\s+defer\s+src="{re.escape(f)}\?v=)[^"]+("\s*></script>)',rf'\g<1>{token}\2',s,count=1)
    if n!=1: raise SystemExit(f'could not update token for {f}')
p.write_text(s)
print(token)
