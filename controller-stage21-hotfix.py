from pathlib import Path
p=Path('controller-stage21-apply.py')
s=p.read_text()
old="marker='node verify-corrected-iteration.mjs'"
new="marker='node verify-complete.mjs'"
if old not in s: raise SystemExit('Stage 21 Pages workflow insertion marker missing')
s=s.replace(old,new,1)
old="blank.activeStage=18;engine.recalculate(blank);"
new="blank.activeStage=18;blank.projectData.humanInputRequests=[];blank.projectData.responseProposals=[];engine.recalculate(blank);"
if old not in s: raise SystemExit('Stage 21 negative-fixture cleanup marker missing')
s=s.replace(old,new,1)
old="assert.equal(engine.operationalNextAction(blank,18).actionType,'CALCULATE_CONVERGENCE','Stage 18 operator path still requests an external response instead of application calculation.');"
if old not in s: raise SystemExit('Stage 21 blank operator assertion marker missing')
s=s.replace(old,"",1)
old="assert(engine.acceptedChanges(p,18).length===0,'Stage 18 convergence must not depend on an external accepted proposal.');engine.recordConvergenceDetermination(p);complete(18);"
new="assert(engine.acceptedChanges(p,18).length===0,'Stage 18 convergence must not depend on an external accepted proposal.');{const a18=engine.operationalNextAction(p,18);assert(a18.actionType==='CALCULATE_CONVERGENCE','Stage 18 current operator path must expose the application-owned convergence calculation; actual='+JSON.stringify(a18));}engine.recordConvergenceDetermination(p);complete(18);"
if old not in s: raise SystemExit('Stage 21 full-cycle operator assertion marker missing')
s=s.replace(old,new,1)
old="replace_once('workflow-engine.js', stage19_marker, stage18_action + stage19_marker)"
new="""replace_once('workflow-engine.js', stage19_marker, stage18_action + stage19_marker)\nengine_path=Path('workflow-engine.js')\nengine_text=engine_path.read_text()\nif engine_text.count(stage18_action)!=1: raise SystemExit(f'workflow-engine.js: expected one inserted Stage 18 action block, found {engine_text.count(stage18_action)}')\nengine_text=engine_text.replace(stage18_action,'',1)\noperator_marker=\"function operationalNextAction(project,currentStage){\\n  const stage=Number(currentStage||1),requests=unresolvedHumanRequests(project,stage);\"\noperator_replacement=\"function operationalNextAction(project,currentStage){\\n  const stage=Number(currentStage||1);\\n\"+stage18_action+\"  const requests=unresolvedHumanRequests(project,stage);\"\nif engine_text.count(operator_marker)!=1: raise SystemExit(f'workflow-engine.js: expected one operator action entry marker, found {engine_text.count(operator_marker)}')\nengine_text=engine_text.replace(operator_marker,operator_replacement,1)\nwrapper_marker=\"function next(p){const b=e0.operationalNextAction(p),n=Number(p.activeStage||p.job?.CURRENT_STAGE||0);\"\nwrapper_replacement=\"function next(p,currentStage){const n=Number(currentStage||p.activeStage||p.job?.CURRENT_STAGE||0),b=e0.operationalNextAction(p,n);\"\nif engine_text.count(wrapper_marker)!=1: raise SystemExit(f'workflow-engine.js: expected one integrated next-action wrapper marker, found {engine_text.count(wrapper_marker)}')\nengine_path.write_text(engine_text.replace(wrapper_marker,wrapper_replacement,1))"""
if old not in s: raise SystemExit('Stage 21 operator-action placement marker missing')
s=s.replace(old,new,1)
old="REQUIREMENT_COVERAGE:metrics.requirementCoverage===null?'UNKNOWN':String(metrics.requirementCoverage),VERIFICATION_COVERAGE:metrics.verificationCoverage===null?'UNKNOWN':String(metrics.verificationCoverage),REGRESSION_SUCCESS:metrics.regressionSuccess===null?'UNKNOWN':String(metrics.regressionSuccess),CRITICAL_DEFECT_COUNT:String(metrics.criticalDefects),MAJOR_DEFECT_COUNT:String(metrics.majorDefects),MANDATORY_UNRESOLVED_UNKNOWN_COUNT:String(metrics.mandatoryUnresolvedUnknowns),CORRECTNESS_AFFECTING_CONTRADICTION_COUNT:String(metrics.contradictions),CORRECTNESS_AFFECTING_AMBIGUITY_COUNT:String(metrics.ambiguities),UNEXPLAINED_CORRECTNESS_AFFECTING_VARIANCE_COUNT:String(metrics.unexplainedVariance)"
new="REQUIREMENT_COVERAGE:metrics.requirementCoverage,VERIFICATION_COVERAGE:metrics.verificationCoverage,REGRESSION_SUCCESS:metrics.regressionSuccess,CRITICAL_DEFECT_COUNT:metrics.criticalDefects,MAJOR_DEFECT_COUNT:metrics.majorDefects,MANDATORY_UNRESOLVED_UNKNOWN_COUNT:metrics.mandatoryUnresolvedUnknowns,CORRECTNESS_AFFECTING_CONTRADICTION_COUNT:metrics.contradictions,CORRECTNESS_AFFECTING_AMBIGUITY_COUNT:metrics.ambiguities,UNEXPLAINED_CORRECTNESS_AFFECTING_VARIANCE_COUNT:metrics.unexplainedVariance"
if old not in s: raise SystemExit('Stage 21 convergence numeric-field marker missing')
s=s.replace(old,new,1)
insert="""
replace_once('verify-browser.mjs',"await waitExpr(cdp,`document.readyState==='complete'`);await waitExpr(cdp,`globalThis.closedLoopAppReady===true`,20000);assert(!(await evalValue(cdp,`globalThis.closedLoopAppError`)),await evalValue(cdp,`globalThis.closedLoopAppError`));","await waitExpr(cdp,`document.readyState==='complete'`);try{await waitExpr(cdp,`globalThis.closedLoopAppReady===true||Boolean(globalThis.closedLoopAppError)`,20000);}catch(error){throw new Error(`${error.message}\\nBrowser startup events: ${JSON.stringify(cdp.events.slice(-80))}`);}{const appError=await evalValue(cdp,`globalThis.closedLoopAppError||''`);assert(!appError,appError);}assert(await evalValue(cdp,`globalThis.closedLoopAppReady===true`),'Application did not reach ready state.');")
"""
marker="print('Stage 21 applicator completed.')"
if marker not in s: raise SystemExit('Stage 21 applicator final marker missing')
s=s.replace(marker,insert+"\n"+marker,1)
p.write_text(s)
