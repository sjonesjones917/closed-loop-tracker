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

vf=Path('verify-semantic-adjudication.mjs');v=vf.read_text()
anchor="// Controlled Stage 7 outcome is application-evaluated, not prose-parsed.\n"
block="""// Structural presence is distinct from adverse-value meaning. "No defects" is a real observation,
// not a missing observation. Stage 25 satisfaction still requires canonical evidence and
// application-owned exact artifact byte facts; submitted favorable prose alone cannot control it.
{
  const p=clone(base),eid=addEvidence(p),sha='a'.repeat(64),scope={...engine.currentScope(p),productId:'PRODUCT-REP'};
  p.job.CURRENT_PRODUCT_ID='PRODUCT-REP';
  p.projectData.artifacts.push({id:'ARTIFACT-REP',stage:25,active:true,scope,fields:{ARTIFACT_ID:'ARTIFACT-REP',FILENAME:'representation.pdf',TYPE:'application/pdf',VERSION:'v1',BYTE_SIZE:7,SHA256:sha,ROLE:'DELIVERABLE',STORAGE_REFERENCE:'indexeddb:ARTIFACT-REP',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'}});
  const ok=withEvidence(canonical('representationInspections',25,{ARTIFACT_ID:'ARTIFACT-REP',BYTE_SIZE:7,SHA256:sha,RENDERING_OPENING_EVIDENCE:'opened exact artifact',OBSERVATIONS:'No defects',DETERMINATION:'SATISFIED',EVIDENCE:'supplemental'}),eid);ok.scope=scope;ok.relationships={ARTIFACT_ID:'ARTIFACT-REP'};
  assert(engine.evaluateEvidenceContract(null,ok,null,p).sufficient===true,'No-defect representation observation was treated as structurally absent');
  assert(engine.effectiveDetermination('representationInspections',ok,null,p)==='SATISFIED','Exact representation facts plus canonical evidence did not adjudicate SATISFIED');
  const bare=canonical('representationInspections',25,{ARTIFACT_ID:'ARTIFACT-REP',BYTE_SIZE:7,SHA256:sha,RENDERING_OPENING_EVIDENCE:'opened exact artifact',OBSERVATIONS:'No defects',DETERMINATION:'SATISFIED',EVIDENCE:'supplemental'});bare.scope=scope;bare.relationships={ARTIFACT_ID:'ARTIFACT-REP'};
  assert(engine.effectiveDetermination('representationInspections',bare,null,p)!=='SATISFIED','No-defect narrative bypassed canonical evidence');
  const adverse=withEvidence(canonical('representationInspections',25,{ARTIFACT_ID:'ARTIFACT-REP',DEFECT_ID:'DEFECT-REP',BYTE_SIZE:7,SHA256:sha,RENDERING_OPENING_EVIDENCE:'opened exact artifact',OBSERVATIONS:'material rendering defect observed',DETERMINATION:'SATISFIED',EVIDENCE:'supplemental'}),eid);adverse.scope=scope;adverse.relationships={ARTIFACT_ID:'ARTIFACT-REP',DEFECT_ID:'DEFECT-REP'};
  assert(engine.effectiveDetermination('representationInspections',adverse,null,p)==='VIOLATED','Linked representation defect did not override a favorable submitted conclusion');
}

"""
if block not in v:
    if anchor not in v:raise RuntimeError('invariant insertion anchor missing')
    v=v.replace(anchor,block+anchor,1)
vf.write_text(v)
