from pathlib import Path

p=Path('workflow-engine.js')
s=p.read_text()
old="function observedValue(result){for(const key of ['OBSERVED_RESULT','ACTUAL_RESULT','OBSERVED_MEANING','OBSERVATIONS','RESULT','VALIDATOR_RESULTS','MEANING_VERIFICATION_RESULTS','PROCESS_EVIDENCE','PRODUCT_EVIDENCE','FINDINGS']){const value=recordValue(result,key);if(!adjudicationEmpty(value))return value;}return null;}"
new="function structurallyPresent(value){if(value===null||value===undefined)return false;if(typeof value==='string')return value.trim().length>0;if(Array.isArray(value))return value.length>0;if(typeof value==='object')return Object.keys(value).length>0;return true;}\nfunction observedValue(result){for(const key of ['OBSERVED_RESULT','ACTUAL_RESULT','OBSERVED_MEANING','OBSERVATIONS','RESULT','VALIDATOR_RESULTS','MEANING_VERIFICATION_RESULTS','PROCESS_EVIDENCE','PRODUCT_EVIDENCE','FINDINGS']){const value=recordValue(result,key);if(structurallyPresent(value))return value;}return null;}"
if old in s:s=s.replace(old,new,1)
elif new not in s:raise RuntimeError('observedValue structural-presence anchor missing')
old_check="if(adjudicationEmpty(observed))reasons.push('Observed value/result is not structurally present.');"
new_check="if(!structurallyPresent(observed))reasons.push('Observed value/result is not structurally present.');"
if old_check in s:s=s.replace(old_check,new_check,1)
elif new_check not in s:raise RuntimeError('evidence-contract structural-presence anchor missing')
p.write_text(s)

# Permanently prove that a factual no-defect observation is structurally present
# but still requires canonical evidence, while an adverse representation cannot
# become satisfied through a favorable submitted conclusion.
vf=Path('verify-semantic-adjudication.mjs');v=vf.read_text()
anchor="// Controlled Stage 7 outcome is application-evaluated, not prose-parsed.\n"
block="""// Structural presence is distinct from adverse-value meaning. "No defects" is a real observation,
// not a missing observation, but it never substitutes for canonical evidence.
{
  const p=clone(base),eid=addEvidence(p),ok=withEvidence(canonical('representationInspections',25,{DETERMINATION:'SATISFIED',OBSERVATIONS:'No defects',EVIDENCE:'supplemental'}),eid);
  assert(engine.evaluateEvidenceContract(null,ok,null,p).sufficient===true,'No-defect representation observation was treated as structurally absent');
  assert(engine.effectiveDetermination('representationInspections',ok,null,p)==='SATISFIED','Structurally present no-defect observation with canonical evidence did not adjudicate SATISFIED');
  const bare=canonical('representationInspections',25,{DETERMINATION:'SATISFIED',OBSERVATIONS:'No defects',EVIDENCE:'supplemental'});
  assert(engine.effectiveDetermination('representationInspections',bare,null,p)!=='SATISFIED','No-defect narrative bypassed canonical evidence');
}

"""
if block not in v:
    if anchor not in v:raise RuntimeError('invariant insertion anchor missing')
    v=v.replace(anchor,block+anchor,1)
vf.write_text(v)
