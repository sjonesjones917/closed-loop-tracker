from pathlib import Path

p=Path('app-core.js')
s=p.read_text()
old="""  const files=safe(current.stages[n].authorizedFiles);
  const applicable=[1,10,17,20,21,25].includes(n),productReady=n!==21||Boolean(currentStageProduct()),fileLocked=locked||!productReady||(n===1&&current.stages[1].status==='COMPLETE');
  const title=n===1?'One-time Stage 01 input files':applicable?'Artifact control':'Returned response files';
"""
new="""  const files=safe(current.stages[n].authorizedFiles),action=displayedStageAction(n);
  const applicable=[1,10,17,20,21,25].includes(n),requiredReturns=safe(action.expectedReturnFiles).filter(item=>item?.required!==false&&String(item?.kind||'').toUpperCase()!=='STRUCTURED_RESPONSE'),needsFileControl=applicable||files.length>0||action.actionType==='ATTACH_REQUIRED_FILES'||requiredReturns.length>0;
  if(!needsFileControl)return '';
  const productReady=n!==21||Boolean(currentStageProduct()),fileLocked=locked||!productReady||(n===1&&current.stages[1].status==='COMPLETE');
  const title=n===1?'One-time Stage 01 input files':applicable?'Artifact control':'Returned response files';
"""
if old not in s: raise SystemExit('artifact control anchor missing')
s=s.replace(old,new,1)
s=s.replace("runtime-20260830-live-operator-51","runtime-20260830-live-operator-52")
p.write_text(s)

p=Path('index.html')
s=p.read_text().replace('runtime-20260830-live-operator-51','runtime-20260830-live-operator-52')
p.write_text(s)
