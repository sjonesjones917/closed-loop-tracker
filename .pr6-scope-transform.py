from pathlib import Path

p=Path('workflow-engine.js'); s=p.read_text()
old="function recordsForCurrentScope(project,collection,scopeRule={}){const active=records(project,collection);const scope={...currentScope(project),...scopeRule};const applicable=Object.fromEntries(Object.entries(scope).filter(([,v])=>v!==undefined&&v!==null));return active.filter(record=>!record.scope||scopeMatches(record,applicable));}"
new="function recordsForCurrentScope(project,collection,scopeRule={}){const active=records(project,collection);const scope={...currentScope(project),...scopeRule};const applicable=Object.fromEntries(Object.entries(scope).filter(([,v])=>v!==undefined&&v!==null));return active.filter(record=>record.scope&&Object.keys(record.scope).length>0&&scopeMatches(record,applicable));}"
assert old in s
p.write_text(s.replace(old,new,1))

p=Path('verify-complete.mjs'); s=p.read_text()
anchor="  const ids=engine.recordsForCurrentScope(p,'requirements').map(x=>engine.recordId(x,'requirements'));assert(ids.includes('REQ-CURRENT')&&!ids.includes('REQ-STALE'),'Historical scope satisfied current selector.');"
replacement=anchor+"\n  const unscoped=record('requirements',4,{OBLIGATION:'unscoped historical',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'yes',INTENDED_VERIFICATION_METHOD:'test',EXPECTED_EVIDENCE:'e',FAILURE_CONDITION:'f',SEVERITY:'MAJOR',STATUS:'ACTIVE'},'REQ-UNSCOPED');delete unscoped.scope;p.projectData.requirements.push(unscoped);const scopedIds=engine.recordsForCurrentScope(p,'requirements').map(x=>engine.recordId(x,'requirements'));assert(!scopedIds.includes('REQ-UNSCOPED'),'Unscoped historical record satisfied current selector.');"
assert anchor in s
p.write_text(s.replace(anchor,replacement,1))
