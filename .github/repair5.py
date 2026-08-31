from pathlib import Path

p=Path('verify-stage-prompts-complete.mjs')
s=p.read_text()
old="engine.ensureShape(p);engine.recalculate(p);for(let stage=1;stage<=30;stage++){p.stages[stage].status='COMPLETE';p.stages[stage].gate={complete:true,blocked:false,reasons:[]};}"
new="""engine.ensureShape(p);engine.recalculate(p);
const intakeManifest=engine.intakeCoverageManifest(p);
p.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'Prove every stage prompt has the exact data and instructions required for its job.',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify({schema:'closed-loop-stage01-capture/1',inputVersion:intakeManifest.inputVersion,manifestSha256:intakeManifest.manifestSha256,units:intakeManifest.units.map(unit=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:'RETAINED_AS_CONTEXT',reason:'Synthetic all-stage prompt audit fixture preserves the complete controlled input unit.',extractedStatements:[]}))})};
p.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE'};
p.stages[3].agentData={ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:true,SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:true,NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:false};
for(let stage=1;stage<=30;stage++){p.stages[stage].status='COMPLETE';p.stages[stage].gate={complete:true,blocked:false,reasons:[]};}"""
count=s.count(old)
if count==1:
    p.write_text(s.replace(old,new))
elif count==0 and new in s:
    pass
else:
    raise SystemExit(f'verify-stage-prompts-complete.mjs: expected one valid upstream fixture sentinel, found {count}')
