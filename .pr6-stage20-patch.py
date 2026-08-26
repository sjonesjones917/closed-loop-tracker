from pathlib import Path
p=Path('verify-full-cycle.mjs');s=p.read_text();marker="const result={continuousLifecycle:'STAGES_01_TO_19'"
assert marker in s
block="""// Stage 20: accept the current unchanged-confirmation evidence, then human-authorize and application-freeze exact baseline bytes.\npr=savePrompt(20);accept(20,pr,{stageData:stageData(20),records:{}},'STAGE-20-PROPOSAL');\nconst baseline=engine.freezeBaseline(p,{artifactIds:['ARTIFACT-CORRECTED'],operatorLabel:'FULL_CYCLE_OPERATOR',authorization:'AUTHORIZED'});engine.recalculate(p);assert(engine.gate(19,p).complete,`Baseline allocation retroactively invalidated Stage 19: ${JSON.stringify(engine.gate(19,p))}`);assertComplete(20);assert(engine.recordId(baseline,'baselines')===p.job.CURRENT_BASELINE_ID,'Stage 20 did not assign the canonical baseline ID.');\n\n"""
s=s.replace(marker,block+marker,1).replace("continuousLifecycle:'STAGES_01_TO_19',stagesCompleted:19","continuousLifecycle:'STAGES_01_TO_20',stagesCompleted:20",1)
p.write_text(s)
