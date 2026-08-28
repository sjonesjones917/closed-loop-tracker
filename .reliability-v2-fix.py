from pathlib import Path

p=Path('workflow-engine.js'); s=p.read_text()
old="return {total:items.length,counts,incompleteTestIds,unavailableTestIds,unsupportedApplicationTestIds,missingArtifactTestIds,items,handoff:executionHandoff(project,{stage:Number(project.activeStage||0)})};"
new="return {total:items.length,counts,incompleteTestIds,unavailableTestIds,unsupportedApplicationTestIds,missingArtifactTestIds,items};"
if old not in s: raise RuntimeError('testExecutionPlan recursion anchor missing')
s=s.replace(old,new,1); p.write_text(s)

p=Path('app-core.js'); s=p.read_text()
s=s.replace('<h2 class=\"section-title\">What happens next</h2><p class=\"section-intro\">The application derives executor, capability, exact file custody, and required return evidence from the accepted test definitions. You do not need to interpret execution modes manually.</p>', '<h2 class=\"section-title\">Verification execution — what happens next</h2><p class=\"section-intro\">The application derives executor, capability, exact file custody, and required return evidence from the accepted test definitions. You do not need to interpret execution modes manually. A filename, hash claim, or code block is not file possession.</p>',1)
s=s.replace("details('Exact execution routes',actionRows,true)","details('Who performs the current tests',actionRows,true)",1)
p.write_text(s)
