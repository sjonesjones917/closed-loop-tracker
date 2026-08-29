from pathlib import Path
import hashlib, re


def replace_once(path, old, new):
    p=Path(path); text=p.read_text()
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{path}: expected exactly one match, found {count}: {old[:80]!r}')
    p.write_text(text.replace(old,new,1))

# app-core.js: keep canonical workbook identity, change only the operator-facing label and guidance.
replace_once('app-core.js',
"const label=k=>String(k||'').replace(/([a-z0-9])([A-Z])/g,'$1 $2').replaceAll('_',' ').replace(/\\s+/g,' ').trim().replace(/\\b\\w/g,c=>c.toUpperCase());",
"const label=k=>String(k||'').replace(/([a-z0-9])([A-Z])/g,'$1 $2').replaceAll('_',' ').replace(/\\s+/g,' ').trim().replace(/\\b\\w/g,c=>c.toUpperCase());\nconst stageDisplayTitle=d=>Number(d?.number)===16?'CORRECT THE ROOT CAUSE':d?.title||'';")
replace_once('app-core.js','${esc(d.title)}</div><div class="stage-meta">','${esc(stageDisplayTitle(d))}</div><div class="stage-meta">')
replace_once('app-core.js','${String(x.number).padStart(2,\'0\')} — ${esc(x.title)}</option>','${String(x.number).padStart(2,\'0\')} — ${esc(stageDisplayTitle(x))}</option>')
replace_once('app-core.js','Stage ${String(n).padStart(2,\'0\')} — ${esc(d.title)}</h2>','Stage ${String(n).padStart(2,\'0\')} — ${esc(stageDisplayTitle(d))}</h2>')
replace_once('app-core.js',
"15:'Every confirmed defect becomes a permanent regression: definition, reproduced failure, later correction proof, and active future protection remain distinct.',17:'The corrected candidate is rerun through the complete ten-execution verification loop.'",
"15:'Every confirmed defect becomes a permanent regression: definition, reproduced failure, later correction proof, and active future protection remain distinct.',16:'Fix the earliest controlled thing that caused each confirmed defect. The application preserves the old version, handles IDs/versions/hashes, and determines what must be repeated. Execution-only failures do not trigger unsupported specification edits.',17:'The corrected candidate is rerun through the complete ten-execution verification loop.'")

insert_after="function evidenceExplanationMarkup(n){if(n!==29)return '';const rows=engine.records(current,'evidenceChains').map(chain=>engine.evidenceChainExplanation(current,chain));return rows.length?`<div class=\"panel\"><h2 class=\"section-title\">Why the application believes each requirement is established</h2>${details('Proposition support',rows,true)}</div>`:'';}\n"
addition="""
function rootCauseCorrectionMarkup(n){
  if(n!==16)return '';
  const plan=engine.stage16CorrectionPlan(current),facts={
    'Defect':plan.defectId||'Not yet identified',
    'Earliest defective layer':plan.earliestDefectiveLayer||'Not yet established',
    'Root cause':plan.rootCause||'Not yet established',
    'Downstream work affected':plan.downstreamInvalidation||'Application will calculate this when the correction is accepted.'
  };
  const tone=plan.actionType==='BLOCKED'?'warn':plan.actionType==='NO_SPECIFICATION_CHANGE'?'success':'';
  return `<div class=\"panel\" id=\"root-cause-correction\"><h2 class=\"section-title\">${esc(plan.heading)}</h2><p class=\"section-intro\">Stage 16 fixes the earliest thing that caused the defect. Do not patch a downstream output merely because that is where the failure became visible.</p><div class=\"notice ${tone}\"><strong>What happens now</strong><br>${esc(plan.explanation)}</div>${details('Why this is the correction point',facts,true)}<div class=\"notice\"><strong>The application handles the control work.</strong><br>You do not choose canonical IDs, version numbers, hashes, invalidation targets, or rerun scope. If human authority is genuinely required, the app asks only for that decision; otherwise the correction follows the validated Stage 16 response path.</div></div>`;
}
"""
replace_once('app-core.js',insert_after,insert_after+addition)
replace_once('app-core.js','${regressionLifecycleMarkup(n)}${contradictionMarkup()}','${regressionLifecycleMarkup(n)}${rootCauseCorrectionMarkup(n)}${contradictionMarkup()}')

# workflow-engine.js: add one derived Stage 16 correction plan and feed NEXT_REQUIRED_ACTION from it.
needle="function operationalNextAction(project,currentStage){const stage=Number(currentStage||1),requests=unresolvedHumanRequests(project,stage);"
helper="""
function stage16CorrectionPlan(project){
  ensureShape(project);
  const roots=recordsForCurrentScope(project,'rootCauses'),root=roots.at(-1)||null;
  if(!root)return {actionType:'BLOCKED',heading:'Root cause required before correction',explanation:'Stage 16 cannot choose a correction point until Stage 14 has established the earliest defective layer with evidence. Return to root-cause analysis; do not patch the final output by guesswork.',defectId:'',earliestDefectiveLayer:'',rootCause:'',downstreamInvalidation:''};
  const defectId=String(recordValue(root,'DEFECT_ID')||root.relationships?.DEFECT_ID||''),earliestDefectiveLayer=String(recordValue(root,'EARLIEST_DEFECTIVE_LAYER')||'').trim(),rootCause=String(recordValue(root,'ROOT_CAUSE')||'').trim(),downstreamInvalidation=String(recordValue(root,'DOWNSTREAM_INVALIDATION')||'').trim(),layer=upper(earliestDefectiveLayer),cause=upper(rootCause);
  const executionOnly=/\\bEXECUTION\\b|\\bRUN\\b/.test(layer)&&!/INSTRUCTION|REQUIREMENT|TEST|SOURCE|RESEARCH|CONFIGURATION|INPUT/.test(layer);
  const humanAuthority=/HUMAN|USER INPUT|HUMAN AUTHORITY/.test(layer+' '+cause);
  if(executionOnly)return {actionType:'NO_SPECIFICATION_CHANGE',heading:'No specification correction required',explanation:'The confirmed defect was introduced during execution, while the controlling requirement/instruction/test layer is not established as defective. Preserve the existing controlled artifacts, keep the regression active, and rerun the next required execution path without inventing an unsupported specification change.',defectId,earliestDefectiveLayer,rootCause,downstreamInvalidation};
  if(humanAuthority)return {actionType:'HUMAN_AUTHORITY',heading:'Human information requires correction',explanation:'The root cause is in human-owned authority. Confirm only the corrected human fact or decision when prompted. The application will create the new human-input/decision version and invalidate dependent downstream work.',defectId,earliestDefectiveLayer,rootCause,downstreamInvalidation};
  return {actionType:'CONTROLLED_CORRECTION',heading:'Correction required at '+(earliestDefectiveLayer||'the established root-cause layer'),explanation:'Use the current Stage 16 correction instruction to correct the earliest defective controlled artifact. Do not patch downstream outputs in place. After validated acceptance, the application preserves the old version, creates the new controlled version, and invalidates the dependent work that must be repeated.',defectId,earliestDefectiveLayer,rootCause,downstreamInvalidation};
}
"""
replace_once('workflow-engine.js',needle,helper+needle)
replace_once('workflow-engine.js',
"function operationalNextAction(project,currentStage){const stage=Number(currentStage||1),requests=unresolvedHumanRequests(project,stage);if(requests.length)return 'Answer the current human-only question(s). Saving the answer will invalidate the old instruction and generate a replacement for this same stage.';const plan=testExecutionPlan(project),relevant=[12,22,23,24].includes(stage)?plan.items:[];",
"function operationalNextAction(project,currentStage){const stage=Number(currentStage||1),requests=unresolvedHumanRequests(project,stage);if(requests.length)return 'Answer the current human-only question(s). Saving the answer will invalidate the old instruction and generate a replacement for this same stage.';if(stage===16){const correction=stage16CorrectionPlan(project);return correction.heading+'. '+correction.explanation;}const plan=testExecutionPlan(project),relevant=[12,22,23,24].includes(stage)?plan.items:[];")
replace_once('workflow-engine.js','executionStability,evidenceChainExplanation,operationalNextAction,operationalMetrics,gate,','executionStability,evidenceChainExplanation,stage16CorrectionPlan,operationalNextAction,operationalMetrics,gate,')

# Browser regression: visible name is plain language, canonical title remains unchanged, and the operator gets exact correction guidance.
verify=Path('verify-browser.mjs')
text=verify.read_text()
anchor=" // Retained test input is MESSAGE content, not a file; do not tell the user to attach it.\n"
assert anchor in text
browser_test=""" // Stage 16 keeps its canonical identity internally while the operator-facing surface explains the actual job in plain language.\n await openStage(cdp,16);let stage16Text=(await snapshot(cdp)).text;assert(stage16Text.includes('Stage 16 — CORRECT THE ROOT CAUSE'),'Stage 16 operator-facing name is still architecture jargon.');assert(stage16Text.includes('Fix the earliest controlled thing that caused each confirmed defect.'),'Stage 16 purpose does not explain the correction goal.');assert(stage16Text.includes('Root cause required before correction'),'Stage 16 does not fail closed when no current root-cause record is available.');assert(stage16Text.includes('The application handles the control work.'),'Stage 16 does not tell the operator that IDs, versions, hashes, invalidation, and rerun scope are application-controlled.');assert(globalThis===globalThis);\n"""
verify.write_text(text.replace(anchor,browser_test+anchor,1))

# Keep the shared cache token exactly bound to the changed runtime graph.
runtime_files=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def git_blob_sha(path):
    data=Path(path).read_bytes()
    return hashlib.sha1(f'blob {len(data)}\\0'.encode()+data).hexdigest()
manifest=''.join(f'{f}:{git_blob_sha(f)}\\n' for f in runtime_files)
token='runtime-'+hashlib.sha256(manifest.encode()).hexdigest()[:16]
index=Path('index.html'); html=index.read_text()
html2=re.sub(r'(?:runtime-[0-9a-f]{16})',token,html)
if html2==html: raise SystemExit('index.html runtime token not found')
index.write_text(html2)
print(token)
