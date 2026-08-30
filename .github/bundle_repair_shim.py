from pathlib import Path

def patch(path, old, new, count=1):
    p=Path(path); t=p.read_text(); n=t.count(old)
    if n!=count: raise SystemExit(f'{path}: expected {count} matches, found {n}: {old[:100]!r}')
    p.write_text(t.replace(old,new,count))

# Every human-supplied unit identity binds source location, kind, and value hash.
old="const rawValueSha256=hash.sha256Value(line),unitId=`UNIT-${rawValueSha256.slice(0,20).toUpperCase()}`;values.push({unitId,sourceKind,sourcePath:`${path}${lines.length>1?`#line-${i+1}`:''}`,rawValue:line,rawValueSha256});"
new="const rawValueSha256=hash.sha256Value(line),resolvedPath=`${path}${lines.length>1?`#line-${i+1}`:''}`,unitId=`UNIT-${hash.sha256Value({sourceKind,sourcePath:resolvedPath,rawValueSha256}).slice(0,20).toUpperCase()}`;values.push({unitId,sourceKind,sourcePath:resolvedPath,rawValue:line,rawValueSha256});"
patch('workflow-engine.js',old,new)

# Stage 03 cannot complete on one shallow coverage pass. It must cover every current source,
# perform the explicit second conflict/exception pass, and finish with no new material category.
old="requireCount('research',1);const researched=new Set(collection('research').map(record=>String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||''))),missing=sourceIds.filter(id=>!researched.has(id));if(missing.length)reasons.push(`Research is missing for source(s): ${missing.join(', ')}.`);break;"
new="requireCount('research',1);const researched=new Set(collection('research').map(record=>String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||''))),missing=sourceIds.filter(id=>!researched.has(id));if(missing.length)reasons.push(`Research is missing for source(s): ${missing.join(', ')}.`);const s3=project.stages?.[3]?.agentData||{};if(!truth(s3.SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED))reasons.push('Stage 03 second conflict and exception pass is not complete.');if(truth(s3.NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS))reasons.push('Stage 03 latest pass found a new material category; research must continue until a complete pass finds none.');if(numeric(s3.LATEST_PASS_NUMBER)<2)reasons.push('Stage 03 requires at least two documented research passes before saturation can be established.');break;"
patch('workflow-engine.js',old,new)

# Strengthen Stage 04 with explicit upstream completeness checks. A prior-stage defect blocks Stage 04;
# it never turns into another human attachment request.
old="case 4:{const obligationManifest=currentObligationManifest(project);if(!obligationManifest.complete)reasons.push(`Stage 04 obligation accounting is incomplete: ${obligationManifest.classified}/${obligationManifest.total} obligations dispositioned.`);"
new="case 4:{const intakeManifest=currentIntakeCoverageManifest(project),obligationManifest=currentObligationManifest(project);if(!intakeManifest.complete)reasons.push(`Stage 04 is blocked because Stage 01 controlled-input accounting is incomplete: ${intakeManifest.classified}/${intakeManifest.total}. Return to Stage 01; do not ask the human to resend existing project input.`);const stage3Gate=project.stages?.[3]?.gate;if(stage3Gate&&!stage3Gate.complete)reasons.push('Stage 04 is blocked because current Stage 03 research is not complete. Return to Stage 03; do not ask the human to resupply captured intent.');if(!obligationManifest.complete)reasons.push(`Stage 04 obligation accounting is incomplete: ${obligationManifest.classified}/${obligationManifest.total} obligations dispositioned.`);"
patch('workflow-engine.js',old,new)

# Add regression proof for duplicate text at distinct source locations and the explicit Stage 03 saturation guard.
p=Path('verify-bundle-v3.mjs'); t=p.read_text()
needle="console.log('bundle-v3 acceptance: PASS');"
addition="""
{
  const p=core.createBlankProject({jobId:'JOB-INTAKE-IDENTITY'});
  p.job.EXACT_USER_OBJECTIVE_VERBATIM='same statement';
  p.job.EXPLICIT_USER_REQUIREMENTS='same statement';
  p.job.CURRENT_INPUT_VERSION='INPUT-v001';
  p.projectData.inputVersions=[{version:'INPUT-v001',payload:{EXACT_USER_OBJECTIVE_VERBATIM:'same statement',EXPLICIT_USER_REQUIREMENTS:'same statement'}}];
  const m=engine.currentIntakeCoverageManifest(p);
  assert.equal(m.units.length,2,'Identical text at two source locations must remain two controlled input units.');
  assert.notEqual(m.units[0].unitId,m.units[1].unitId,'Controlled input identities must include source location.');
}
{
  const src=fs.readFileSync('workflow-engine.js','utf8');
  for(const text of ['Stage 03 second conflict and exception pass is not complete.','Stage 03 latest pass found a new material category','Stage 03 requires at least two documented research passes'])assert.ok(src.includes(text),`Missing Stage 03 exhaustion gate: ${text}`);
}
"""
if t.count(needle)!=1: raise SystemExit('verify-bundle-v3 insertion anchor mismatch')
p.write_text(t.replace(needle,addition+needle,1))

print('Stage 1 identity and Stage 3/4 exhaustion patch complete')
