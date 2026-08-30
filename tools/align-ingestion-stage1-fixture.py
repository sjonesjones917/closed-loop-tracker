from pathlib import Path

p=Path('verify-ingestion.mjs')
s=p.read_text()
old="""  const stageData={};
  if(stageFields.length)stageData[stageFields[0]]=safeValue(stageFields[0]);
  const records={};"""
new="""  const stageData={};
  if(stage===1){
    const intake=engine.intakeCoverageManifest(p);
    const capture={schema:'closed-loop-intake-capture/1',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,units:intake.units.map((unit,index)=>({sourceUnitId:unit.sourceUnitId,disposition:'INCORPORATED',reason:'',extractedStatements:[{statementKey:'ingestion-stage1-'+(index+1),text:String(unit.text||unit.rawValue||unit.fieldName),statementClass:'PROJECT_INPUT'}]})),conversationStatements:[]};
    stageData.EXACT_DELIVERABLE_REQUESTED='Verify the closed-loop response ingestion path.';
    stageData.ASSUMPTIONS='NONE';
    stageData.UNKNOWN_INFORMATION='NONE';
    stageData.INPUT_SET_CONTENTS=JSON.stringify(capture);
  }else if(stageFields.length)stageData[stageFields[0]]=safeValue(stageFields[0]);
  const records={};"""
if old not in s: raise SystemExit('validEnvelope stageData anchor missing')
s=s.replace(old,new,1)
p.write_text(s)
