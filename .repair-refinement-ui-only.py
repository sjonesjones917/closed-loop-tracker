from pathlib import Path

p=Path('app-core.js')
s=p.read_text()
old="""const next=clone(current),change=engine.acceptedChanges(next,current.activeStage).at(-1);if(!change)throw new Error('No current accepted response exists to refine.');engine.invalidateAcceptedResponse(next,{stage:current.activeStage,rawResponseId:change.rawResponseId,reason,operatorLabel:$('#operator-label')?.value.trim()||'HUMAN_OPERATOR'});"""
new="""const next=clone(current),stage=current.activeStage,changes=engine.acceptedChanges(next,stage),operation=selectedOperation(stage),scope=promptOptions(stage)?.scope||{},targetKeys=['iterationId','candidateId','runId','contextId','baselineId','productId'],matches=changes.filter(change=>String(change.operation||'COMPLETE')===String(operation)&&targetKeys.every(key=>scope[key]===undefined||scope[key]===null||scope[key]===''||String(change.scope?.[key]??'')===String(scope[key]))),change=matches.at(-1)||((changes.length===1)?changes[0]:null);if(!change)throw new Error('No accepted response matches the selected operation/run scope. Select the exact operation and run slot you want to refine.');engine.invalidateAcceptedResponse(next,{stage,rawResponseId:change.rawResponseId,reason,operatorLabel:$('#operator-label')?.value.trim()||'HUMAN_OPERATOR'});"""
if old not in s: raise SystemExit('refinement UI anchor missing')
p.write_text(s.replace(old,new,1))

p=Path('verify-complete.mjs')
s=p.read_text()
check="assert(fs.readFileSync('app-core.js','utf8').includes('No accepted response matches the selected operation/run scope.'),'Refinement UI does not target the selected operation/run scope.');"
if check not in s:
    idx=s.rfind('console.log(JSON.stringify(')
    if idx<0: raise SystemExit('verify-complete report anchor missing')
    s=s[:idx]+check+'\n\n'+s[idx:]
p.write_text(s)
