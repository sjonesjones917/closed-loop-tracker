from pathlib import Path

p=Path('workflow-engine.js')
s=p.read_text()
anchor="""function gate(stage,project){
  ensureShape(project);"""
helper="""function reconciliationFacts(project){
  ensureShape(project);
  const release=releaseMetrics(project),scope=currentScope(project),requirements=mandatoryRequirements(project,scope),tests=recordsForCurrentScope(project,'tests').filter(t=>requirements.some(r=>requirementId(r)===testRequirementId(t))&&!['RETIRED','BLOCKED','NOT READY'].includes(upper(recordValue(t,'STATUS')||'READY'))),product=recordsForCurrentScope(project,'products').at(-1),baseline=recordsForCurrentScope(project,'baselines').at(-1),process=recordsForCurrentScope(project,'processAudits'),productAudits=recordsForCurrentScope(project,'productAudits'),contradictions=detectCurrentContradictions(project),defects=unresolvedMaterialDefects(project),stageBlockers=openBlockers(project,26),resultRows=[...recordsForCurrentScope(project,'deterministicResults'),...recordsForCurrentScope(project,'meaningResults'),...recordsForCurrentScope(project,'adversarialResults'),...recordsForCurrentScope(project,'representationInspections')],insufficient=resultRows.filter(r=>!evaluateEvidenceSufficiency(project,{test:testForResult(project,r),result:r}).sufficient),semanticProcess=process.length===1?effectiveDetermination('processAudits',process[0],null,project):'UNDETERMINED',semanticProduct=productAudits.length===1?effectiveDetermination('productAudits',productAudits[0],null,project):'UNDETERMINED';
  const failures=[];
  if(!recordId(product,'products'))failures.push('CURRENT_PRODUCT_MISSING');
  if(!recordId(baseline,'baselines'))failures.push('CURRENT_BASELINE_MISSING');
  if(release.violated)failures.push('MANDATORY_REQUIREMENT_VIOLATION');
  if(release.undetermined)failures.push('MANDATORY_REQUIREMENT_NOT_ESTABLISHED');
  if(release.failedValidatorIds.length)failures.push('MANDATORY_RESULT_VIOLATION');
  if(release.unknownValidatorIds.length)failures.push('MANDATORY_RESULT_UNDETERMINED');
  if(insufficient.length)failures.push('INSUFFICIENT_EVIDENCE');
  if(defects.length)failures.push('UNRESOLVED_MATERIAL_DEFECT');
  if(stageBlockers.length)failures.push('RECONCILIATION_BLOCKER');
  if(contradictions.length)failures.push('CURRENT_CONTRADICTION');
  const facts={productId:recordId(product,'products')||null,productVersion:recordValue(product,'PRODUCT_VERSION')||null,baselineId:recordId(baseline,'baselines')||null,mandatoryRequirementCount:requirements.length,affirmativeSatisfactionCount:release.satisfied,mandatoryRequirementViolatedCount:release.violated,mandatoryRequirementUnknownCount:release.undetermined,mandatoryTestCount:tests.length,currentResultCount:resultRows.length,failedResultIds:release.failedValidatorIds,unknownResultIds:release.unknownValidatorIds,insufficientEvidenceResultIds:insufficient.map(r=>r.id||r.recordId||recordValue(r,'RESULT_ID')||recordValue(r,'MEANING_REVIEW_ID')||recordValue(r,'ATTACK_ID')||recordValue(r,'INSPECTION_ID')).filter(Boolean),criticalDefects:defects.filter(d=>upper(recordValue(d,'SEVERITY'))==='CRITICAL').length,majorDefects:defects.filter(d=>upper(recordValue(d,'SEVERITY'))==='MAJOR').length,blockerIds:stageBlockers.map(b=>recordId(b,'blockers')),contradictions,semanticProcessDetermination:semanticProcess,semanticProductDetermination:semanticProduct,failures,reconciledDetermination:failures.length?'BLOCKED':semanticProcess==='SATISFIED'&&semanticProduct==='SATISFIED'?'SATISFIED':'UNDETERMINED'};
  facts.factsSha256=hash.sha256Value({scope,...facts});
  return facts;
}
function gate(stage,project){
  ensureShape(project);"""
if 'function reconciliationFacts(project)' not in s:
    if anchor not in s: raise SystemExit('gate anchor missing')
    s=s.replace(anchor,helper,1)
old="""  if(stage===26){const process=recordsForCurrentScope(project,'processAudits'),product=recordsForCurrentScope(project,'productAudits'),contradictions=detectCurrentContradictions(project);if(process.length!==1)add([`Exactly one current process audit is required; found ${process.length}.`]);if(product.length!==1)add([`Exactly one current product audit is required; found ${product.length}.`]);if(openBlockers(project,26).length)add(['Stage 26 has unresolved reconciliation blockers.']);if(contradictions.length)add(['Stage 26 cannot reconcile while current contradictions remain.']);}"""
new="""  if(stage===26){const process=recordsForCurrentScope(project,'processAudits'),product=recordsForCurrentScope(project,'productAudits'),facts=reconciliationFacts(project);if(process.length!==1)add([`Exactly one current process audit is required; found ${process.length}.`]);if(product.length!==1)add([`Exactly one current product audit is required; found ${product.length}.`]);for(const [collection,row] of [['processAudits',process[0]],['productAudits',product[0]]])if(row&&!evaluateEvidenceSufficiency(project,{result:row}).sufficient)add([`${collection==='processAudits'?'Process':'Product'} audit evidence is insufficient for its determination.`]);if(process.length===1&&facts.semanticProcessDetermination!=='SATISFIED')add(['Current process audit does not affirmatively establish process correctness.']);if(product.length===1&&facts.semanticProductDetermination!=='SATISFIED')add(['Current product audit does not affirmatively establish product correctness.']);if(facts.failures.length)add([`Application reconciliation facts block progression: ${facts.failures.join(', ')}.`]);}"""
if old in s:s=s.replace(old,new,1)
old2="""case 26:{const process=recordsForCurrentScope(project,'processAudits'),productAudits=recordsForCurrentScope(project,'productAudits'),product=recordsForCurrentScope(project,'products').at(-1),baseline=recordsForCurrentScope(project,'baselines').at(-1),allAudits=[...process,...productAudits],missing=allAudits.filter(a=>!evaluateEvidenceSufficiency(project,{result:a}).sufficient).map(a=>recordId(a,process.includes(a)?'processAudits':'productAudits')),defects=[...new Set(allAudits.map(a=>String(recordValue(a,'DEFECT_ID')||a.relationships?.DEFECT_ID||'')).filter(Boolean))],blockers=openBlockers(project,26).map(b=>recordId(b,'blockers'));Object.assign(derived,{PRODUCT_ID:recordId(product,'products')||'NONE',PRODUCT_VERSION:recordValue(product,'PRODUCT_VERSION')||'NONE',BASELINE_ID:recordId(baseline,'baselines')||project.job.CURRENT_BASELINE_ID||'NONE',REVIEW_VERSION:'RECONCILIATION-'+hash.sha256Value(allAudits.map(a=>a.recordSha256||a.sha256||a.id)).slice(0,16).toUpperCase(),MISSING_EVIDENCE_LINKS:missing,RECONCILIATION_DEFECT_IDS:defects,RECONCILIATION_BLOCKER_IDS:blockers});break;}"""
new2="""case 26:{const process=recordsForCurrentScope(project,'processAudits'),productAudits=recordsForCurrentScope(project,'productAudits'),allAudits=[...process,...productAudits],facts=reconciliationFacts(project),missing=allAudits.filter(a=>!evaluateEvidenceSufficiency(project,{result:a}).sufficient).map(a=>recordId(a,process.includes(a)?'processAudits':'productAudits'));Object.assign(derived,{PRODUCT_ID:facts.productId||'NONE',PRODUCT_VERSION:facts.productVersion||'NONE',BASELINE_ID:facts.baselineId||'NONE',REVIEW_VERSION:'RECONCILIATION-'+facts.factsSha256.slice(0,16).toUpperCase(),PROCESS_REVIEW:process.length===1?recordId(process[0],'processAudits'):'MISSING',PROCESS_CORRECTNESS_DETERMINATION:facts.semanticProcessDetermination,PROCESS_EVIDENCE:process.length===1?recordValue(process[0],'PROCESS_EVIDENCE')||'NONE':'NONE',PRODUCT_REVIEW:productAudits.length===1?recordId(productAudits[0],'productAudits'):'MISSING',PRODUCT_CORRECTNESS_DETERMINATION:facts.semanticProductDetermination,PRODUCT_EVIDENCE:productAudits.length===1?recordValue(productAudits[0],'PRODUCT_EVIDENCE')||'NONE':'NONE',PROCESS_PRODUCT_DISCREPANCIES:facts.failures,MISSING_EVIDENCE_LINKS:[...new Set([...missing,...facts.insufficientEvidenceResultIds])],RECONCILIATION_DEFECT_IDS:unresolvedMaterialDefects(project).map(d=>recordId(d,'defects')),RECONCILIATION_BLOCKER_IDS:facts.blockerIds,RECONCILED_DETERMINATION:facts.reconciledDetermination,CONTROLLING_REASON:facts.failures.length?`Application reconciliation blocked by: ${facts.failures.join(', ')}.`:facts.reconciledDetermination==='SATISFIED'?'Current process and product evidence agree and no release-material canonical conflict is present.':'Semantic process/product review is not affirmatively satisfied.',CONTROLLING_EVIDENCE:facts.factsSha256,APPLICATION_RECONCILIATION_FACTS:facts});break;}"""
if old2 in s:s=s.replace(old2,new2,1)
exp='executionStability,evidenceChainExplanation,stage16CorrectionPlan,operationalNextAction,operationalMetrics'
if exp in s:s=s.replace(exp,'executionStability,evidenceChainExplanation,reconciliationFacts,stage16CorrectionPlan,operationalNextAction,operationalMetrics',1)
p.write_text(s)

q=Path('prompt-engine.js')
t=q.read_text()
ctx="if(stage===4)parts.push(`APPLICATION OBLIGATION MANIFEST — ACCOUNT FOR EVERY OBLIGATION\\n${show(obligationManifest(state))}`);"
if 'APPLICATION RECONCILIATION FACTS — APPLICATION AUTHORITY' not in t:
    if ctx not in t: raise SystemExit('stable prompt context anchor missing')
    t=t.replace(ctx,ctx+"if(stage===26)parts.push(`APPLICATION RECONCILIATION FACTS — APPLICATION AUTHORITY; DO NOT OVERRIDE\\n${show(workflow.reconciliationFacts(state))}`);",1)
q.write_text(t)

for name in ['index.html','app-core.js','test-runtime.js']:
    f=Path(name);text=f.read_text().replace('runtime-20260830-live-operator-62','runtime-20260830-live-operator-63');f.write_text(text)
