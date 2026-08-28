from pathlib import Path

# Integration repair for the generated patch; kept separate so the guarded runner can prove it before committing production files.
p=Path('workflow-engine.js'); s=p.read_text()
old="return {total:items.length,counts,incompleteTestIds,unavailableTestIds,unsupportedApplicationTestIds,missingArtifactTestIds,items,handoff:executionHandoff(project,{stage:Number(project.activeStage||0)})};"
new="return {total:items.length,counts,incompleteTestIds,unavailableTestIds,unsupportedApplicationTestIds,missingArtifactTestIds,items};"
if old not in s: raise RuntimeError('testExecutionPlan recursion anchor missing')
s=s.replace(old,new,1); p.write_text(s)

p=Path('app-core.js'); s=p.read_text()
s=s.replace('<h2 class=\"section-title\">What happens next</h2><p class=\"section-intro\">The application derives executor, capability, exact file custody, and required return evidence from the accepted test definitions. You do not need to interpret execution modes manually.</p>', '<h2 class=\"section-title\">Verification execution — what happens next</h2><p class=\"section-intro\">The application derives executor, capability, exact file custody, and required return evidence from the accepted test definitions. You do not need to interpret execution modes manually. A filename, hash claim, or code block is not file possession.</p>',1)
s=s.replace("details('Exact execution routes',actionRows,true)","details('Who performs the current tests',actionRows,true)",1)
anchor="${blocked.length?`<div class=\"notice warn\"><strong>Execution is blocked.</strong><br>${blocked.map(x=>`${esc(x.testId)}: ${esc(x.blockingReason||'Execution cannot proceed.')}`).join('<br>')}</div>`:''}"
replacement="${plan.unsupportedApplicationTestIds.length?`<div class=\"notice danger\"><strong>Invalid application executor claim.</strong><br>No registered application-native executor exists for ${esc(plan.unsupportedApplicationTestIds.join(', '))}. Request a corrected Stage 6 test definition; do not substitute or fabricate native execution.</div>`:''}${blocked.length?`<div class=\"notice warn\"><strong>Execution is blocked.</strong><br>${blocked.map(x=>`${esc(x.testId)}: ${esc(x.blockingReason||'Execution cannot proceed.')}`).join('<br>')}</div>`:''}"
if anchor not in s: raise RuntimeError('unsupported executor UI anchor missing')
s=s.replace(anchor,replacement,1);p.write_text(s)

p=Path('verify-complete.mjs'); s=p.read_text()
old="const scope={requirementsVersion:'REQUIREMENTS-v001',testSuiteVersion:'TEST-SUITE-v001'};"
new="const scope=engine.currentScope(p);"
if old not in s: raise RuntimeError('reliability routing fixture scope anchor missing')
s=s.replace(old,new,1);p.write_text(s)
