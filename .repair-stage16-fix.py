from pathlib import Path
import hashlib, re


def replace_once(path, old, new):
    p=Path(path); text=p.read_text()
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{path}: expected exactly one match, found {count}: {old[:100]!r}')
    p.write_text(text.replace(old,new,1))

# The first repair intentionally creates the derived helper. Tighten it here so a Stage 16
# change set presents every current RCA, not merely the latest one.
old_helper="""function stage16CorrectionPlan(project){
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
new_helper="""function stage16CorrectionPlan(project){
  ensureShape(project);
  const roots=recordsForCurrentScope(project,'rootCauses');
  if(!roots.length)return {actionType:'BLOCKED',heading:'Root cause required before correction',explanation:'Stage 16 cannot choose a correction point until Stage 14 has established the earliest defective layer with evidence. Return to root-cause analysis; do not patch the final output by guesswork.',items:[]};
  const items=roots.map(root=>{const defectId=String(recordValue(root,'DEFECT_ID')||root.relationships?.DEFECT_ID||''),earliestDefectiveLayer=String(recordValue(root,'EARLIEST_DEFECTIVE_LAYER')||'').trim(),rootCause=String(recordValue(root,'ROOT_CAUSE')||'').trim(),downstreamInvalidation=String(recordValue(root,'DOWNSTREAM_INVALIDATION')||'').trim(),layer=upper(earliestDefectiveLayer),cause=upper(rootCause),executionOnly=/\\bEXECUTION\\b|\\bRUN\\b/.test(layer)&&!/INSTRUCTION|REQUIREMENT|TEST|SOURCE|RESEARCH|CONFIGURATION|INPUT/.test(layer),humanAuthority=/HUMAN|USER INPUT|HUMAN AUTHORITY/.test(layer+' '+cause);if(executionOnly)return {defectId,earliestDefectiveLayer,rootCause,downstreamInvalidation,actionType:'NO_SPECIFICATION_CHANGE',requiredAction:'Preserve the governing requirement, test, and instruction; keep the regression active and rerun the required execution path. Do not invent a specification change.'};if(humanAuthority)return {defectId,earliestDefectiveLayer,rootCause,downstreamInvalidation,actionType:'HUMAN_AUTHORITY',requiredAction:'Confirm only the corrected human-owned fact or decision when requested. The application versions it and invalidates dependent downstream work.'};return {defectId,earliestDefectiveLayer,rootCause,downstreamInvalidation,actionType:'CONTROLLED_CORRECTION',requiredAction:'Correct this earliest defective controlled artifact through the current Stage 16 instruction. Do not patch downstream outputs in place.'};});
  const executionOnly=items.filter(x=>x.actionType==='NO_SPECIFICATION_CHANGE').length,human=items.filter(x=>x.actionType==='HUMAN_AUTHORITY').length,controlled=items.filter(x=>x.actionType==='CONTROLLED_CORRECTION').length,heading=controlled||human?'Correct the established root cause'+(items.length===1?'':'s'):'No specification correction required',explanation=(controlled?controlled+' controlled correction'+(controlled===1?'':'s')+' required. ':'')+(human?human+' human-authority correction'+(human===1?'':'s')+' required. ':'')+(executionOnly?executionOnly+' execution-only defect'+(executionOnly===1?' requires':'s require')+' no specification edit. ':'')+'The application preserves prior versions and determines downstream invalidation and rerun scope.';
  return {actionType:controlled?'CONTROLLED_CORRECTION':human?'HUMAN_AUTHORITY':'NO_SPECIFICATION_CHANGE',heading,explanation,items};
}
"""
replace_once('workflow-engine.js',old_helper,new_helper)

old_markup="""function rootCauseCorrectionMarkup(n){
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
new_markup="""function rootCauseCorrectionMarkup(n){
  if(n!==16)return '';
  const plan=engine.stage16CorrectionPlan(current),tone=plan.actionType==='BLOCKED'?'warn':plan.actionType==='NO_SPECIFICATION_CHANGE'?'success':'',rows=safe(plan.items).map(item=>({defect:item.defectId||'UNKNOWN',earliestDefectiveLayer:item.earliestDefectiveLayer||'UNKNOWN',rootCause:item.rootCause||'UNKNOWN',requiredAction:item.requiredAction,downstreamWork:item.downstreamInvalidation||'Application determines this from accepted correction scope.'}));
  return `<div class=\"panel\" id=\"root-cause-correction\"><h2 class=\"section-title\">${esc(plan.heading)}</h2><p class=\"section-intro\">Stage 16 fixes the earliest thing that caused each confirmed defect. Do not patch a downstream output merely because that is where the failure became visible.</p><div class=\"notice ${tone}\"><strong>What happens now</strong><br>${esc(plan.explanation)}</div>${rows.length?details('Current root-cause correction plan',rows,true):'<div class=\"empty-state\">No current evidence-supported root cause is available yet.</div>'}<div class=\"notice\"><strong>The application handles the control work.</strong><br>You do not choose canonical IDs, version numbers, hashes, invalidation targets, or rerun scope. If human authority is genuinely required, the app asks only for that decision; otherwise the correction follows the validated Stage 16 response path.</div></div>`;
}
"""
replace_once('app-core.js',old_markup,new_markup)

# Remove a no-op assertion accidentally left in the first repair test.
p=Path('verify-browser.mjs'); text=p.read_text(); p.write_text(text.replace("assert(globalThis===globalThis);\n",'',1))

# Recompute the exact shared runtime cache identity using the same Git blob preimage as verify-hash.mjs.
runtime_files=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def git_blob_sha(path):
    data=Path(path).read_bytes()
    return hashlib.sha1(f'blob {len(data)}'.encode()+b'\0'+data).hexdigest()
manifest=''.join(f'{f}:{git_blob_sha(f)}\n' for f in runtime_files)
token='runtime-'+hashlib.sha256(manifest.encode()).hexdigest()[:16]
index=Path('index.html'); html=index.read_text(); html2=re.sub(r'runtime-[0-9a-f]{16}',token,html)
if html2==html: raise SystemExit('index.html runtime token not found')
index.write_text(html2)
print(token)
