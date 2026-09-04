from pathlib import Path
p=Path('controller-stage21-apply.py')
s=p.read_text()
old="marker='node verify-corrected-iteration.mjs'"
new="marker='node verify-complete.mjs'"
if old not in s:
    raise SystemExit('Stage 21 Pages workflow insertion marker missing')
s=s.replace(old,new,1)
old="blank.activeStage=18;engine.recalculate(blank);"
new="blank.activeStage=18;blank.projectData.humanInputRequests=[];blank.projectData.responseProposals=[];engine.recalculate(blank);"
if old not in s:
    raise SystemExit('Stage 21 negative-fixture cleanup marker missing')
s=s.replace(old,new,1)
old="assert.equal(engine.operationalNextAction(blank,18).actionType,'CALCULATE_CONVERGENCE','Stage 18 operator path still requests an external response instead of application calculation.');"
if old not in s:
    raise SystemExit('Stage 21 blank operator assertion marker missing')
s=s.replace(old,"",1)
old="assert(engine.acceptedChanges(p,18).length===0,'Stage 18 convergence must not depend on an external accepted proposal.');engine.recordConvergenceDetermination(p);complete(18);"
new="assert(engine.acceptedChanges(p,18).length===0,'Stage 18 convergence must not depend on an external accepted proposal.');assert(engine.operationalNextAction(p,18).actionType==='CALCULATE_CONVERGENCE','Stage 18 current operator path must expose the application-owned convergence calculation.');engine.recordConvergenceDetermination(p);complete(18);"
if old not in s:
    raise SystemExit('Stage 21 full-cycle operator assertion marker missing')
s=s.replace(old,new,1)
old="replace_once('workflow-engine.js', stage19_marker, stage18_action + stage19_marker)"
new="""replace_once('workflow-engine.js', stage19_marker, stage18_action + stage19_marker)\nengine_path=Path('workflow-engine.js')\nengine_text=engine_path.read_text()\nif engine_text.count(stage18_action)!=1:\n    raise SystemExit(f'workflow-engine.js: expected one inserted Stage 18 action block, found {engine_text.count(stage18_action)}')\nengine_text=engine_text.replace(stage18_action,'',1)\noperator_marker=\"function operationalNextAction(project,currentStage){\\n  const stage=Number(currentStage||1),requests=unresolvedHumanRequests(project,stage);\"\noperator_replacement=\"function operationalNextAction(project,currentStage){\\n  const stage=Number(currentStage||1);\\n\"+stage18_action+\"  const requests=unresolvedHumanRequests(project,stage);\"\nif engine_text.count(operator_marker)!=1:\n    raise SystemExit(f'workflow-engine.js: expected one operator action entry marker, found {engine_text.count(operator_marker)}')\nengine_path.write_text(engine_text.replace(operator_marker,operator_replacement,1))"""
if old not in s:
    raise SystemExit('Stage 21 operator-action placement marker missing')
p.write_text(s.replace(old,new,1))
