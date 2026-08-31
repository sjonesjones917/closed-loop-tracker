from pathlib import Path

# workflow-schema.js: Stage 5 may return the complete corrected requirement set plus resolution records.
p=Path('workflow-schema.js')
s=p.read_text()
s=s.replace("  5:['requirementResolutions'],", "  5:['requirements','requirementResolutions'],", 1)
p.write_text(s)

# workflow-engine.js: only bump requirements version at Stage 5 when corrected requirement records were actually committed.
p=Path('workflow-engine.js')
s=p.read_text()
s=s.replace("  4:['CURRENT_REQUIREMENTS_VERSION','REQUIREMENTS'],6:['CURRENT_TEST_SUITE_VERSION','TEST-SUITE'],", "  4:['CURRENT_REQUIREMENTS_VERSION','REQUIREMENTS'],5:['CURRENT_REQUIREMENTS_VERSION','REQUIREMENTS'],6:['CURRENT_TEST_SUITE_VERSION','TEST-SUITE'],", 1)
needle="""  const [jobField,prefix]=config;
  const payload={stage,collections:Object.fromEntries(versionCollections(stage).map(collection=>[collection,records(project,collection).map(record=>({id:recordId(record,collection),fields:recordFields(record),relationships:record.relationships||{},sha256:record.sha256||null}))])),acceptedData:project.stages[stage].acceptedData};"""
replacement="""  const [jobField,prefix]=config;
  if(Number(stage)===5){
    const accepted=safe(project.projectData.acceptedChanges).find(change=>change.changeId===acceptedChangeId),committedIds=new Set(safe(accepted?.canonicalRecordIds).map(String)),changedRequirements=records(project,'requirements').filter(record=>committedIds.has(recordId(record,'requirements')));
    if(!changedRequirements.length){stampCurrentVersionMembership(project,5,project.job.CURRENT_REQUIREMENTS_VERSION);return null;}
  }
  const payload={stage,collections:Object.fromEntries(versionCollections(stage).map(collection=>[collection,records(project,collection).map(record=>({id:recordId(record,collection),fields:recordFields(record),relationships:record.relationships||{},sha256:record.sha256||null}))])),acceptedData:project.stages[stage].acceptedData};"""
if needle not in s: raise SystemExit('registerStageVersion anchor missing')
s=s.replace(needle,replacement,1)
# Strengthen Stage 5 gate: a correction resolution cannot exist without a complete replacement requirement set.
old="""    case 5:
      requireAccepted();
      if(collection('requirementResolutions').some(record=>['OPEN','UNRESOLVED','BLOCKED','UNKNOWN'].includes(upper(recordValue(record,'STATUS')))))reasons.push('A requirement-set defect remains unresolved.');
      break;"""
new="""    case 5:{
      requireAccepted();
      const resolutions=collection('requirementResolutions'),stageFiveRequirements=collection('requirements'),changed=resolutions.filter(record=>{const refs=recordValue(record,'CHANGED_REQUIREMENT_REFS');return Array.isArray(refs)?refs.length>0:Boolean(String(refs||'').trim());});
      if(resolutions.some(record=>['OPEN','UNRESOLVED','BLOCKED','UNKNOWN'].includes(upper(recordValue(record,'STATUS')))))reasons.push('A requirement-set defect remains unresolved.');
      if(changed.length&&!stageFiveRequirements.length)reasons.push('Stage 05 identifies changed requirements but did not return the complete corrected current requirement set.');
      if(stageFiveRequirements.length){for(const req of stageFiveRequirements)for(const name of schema.RECORD_SCHEMAS.requirements.required)if(!String(recordValue(req,name)||'').trim())reasons.push(`${recordId(req,'requirements')}: corrected requirement field ${name} is missing.`);}
      break;
    }"""
if old not in s: raise SystemExit('Stage 5 gate anchor missing')
s=s.replace(old,new,1)
p.write_text(s)

# response-ingestion.js: a Stage 5 corrected set supersedes the prior current requirements even on the first Stage 5 acceptance.
p=Path('response-ingestion.js')
s=p.read_text()
needle="""  const committedRecordIds=commitEvidence(next,proposal),reservedTargetSnapshots=[];
  for(const [collection,list] of Object.entries(proposal.canonicalRecords)){"""
replacement="""  const committedRecordIds=commitEvidence(next,proposal),reservedTargetSnapshots=[];
  const stageFiveReplacesRequirements=stage===5&&safe(proposal.canonicalRecords?.requirements).length>0;
  if(stageFiveReplacesRequirements){for(const record of workflow.records(next,'requirements',{active:true})){record.active=false;record.validity='SUPERSEDED';record.supersededBy=changeId;workflow.refreshRecordHashes(record,'requirements');}}
  for(const [collection,list] of Object.entries(proposal.canonicalRecords)){"""
if needle not in s: raise SystemExit('response commit anchor missing')
s=s.replace(needle,replacement,1)
p.write_text(s)

# prompt-engine.js: make the Stage 5 executor return a complete corrected set when semantic corrections are required.
p=Path('prompt-engine.js')
s=p.read_text()
old='"5":"Resolve only defects in the complete current Stage 04 requirement set supplied in this prompt. Review every requirement for duplication, conflict, impossible combinations, undefined terms, circular dependencies, missing prerequisites, unsupported propositions, indeterminate applicability, non-atomic wording, and absence of a verification path. Use the governing research, source authority, source conflicts, and evidence supplied in current context; do not ask the user to repeat already-known project information. Preserve every valid requirement. Propose semantic corrections only where required, identify affected requirement identities and downstream work, and block unresolved mandatory defects. Do not design tests or production instructions. The application owns resulting version identity, counts, status, invalidation, and gate calculations.",'
new='"5":"Resolve only defects in the complete current Stage 04 requirement set supplied in this prompt. Review every requirement for duplication, conflict, impossible combinations, undefined terms, circular dependencies, missing prerequisites, unsupported propositions, indeterminate applicability, non-atomic wording, and absence of a verification path. Use the governing research, source authority, source conflicts, and evidence supplied in current context; do not ask the user to repeat already-known project information. Preserve every valid requirement. If no requirement semantics need changing, return only the requirementResolutions needed to establish that result and the application preserves the existing requirements version. If any requirement semantics need changing, return BOTH the resolution records and the COMPLETE corrected resulting requirements collection — not only changed rows — so no valid requirement disappears. The application allocates new canonical requirement IDs, creates the new requirements version, supersedes the prior current set, and invalidates downstream work. Every corrected requirement must remain atomic, independently testable, provenance-bound, and complete. Do not design tests or production instructions. The application owns version identity, IDs, counts, status, invalidation, and gate calculations.",'
if old not in s: raise SystemExit('Stage 5 prompt anchor missing')
s=s.replace(old,new,1)
# Version bump for prompt identity only; visual geometry untouched.
s=s.replace("const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/54';", "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/55';", 1)
p.write_text(s)

# Keep one shared runtime cache identity without changing CSS or markup geometry.
for name in ['index.html','app-core.js','test-runtime.js']:
    f=Path(name);text=f.read_text().replace('runtime-20260830-live-operator-63','runtime-20260830-live-operator-64');f.write_text(text)
