from pathlib import Path
P=Path('prompt-engine.js'); s=P.read_text()
def one(a,b):
 global s
 if s.count(a)!=1: raise SystemExit('prompt match count '+str(s.count(a))+': '+a[:100])
 s=s.replace(a,b,1)
one("const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/20';","const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/21';")
one(" if(stage>1){const prior=state?.stages?.[stage-1]?{agentData:state.stages[stage-1].agentData||state.stages[stage-1].acceptedData||{},humanData:state.stages[stage-1].humanData||{},derivedData:state.stages[stage-1].derivedData||{}}:'NONE';parts.push(`PRIOR STAGE DECISION AND ACCEPTED DATA\\n${show(prior)}`);}"," if(stage>1&&![11,12,23,24].includes(stage)){const prior=state?.stages?.[stage-1]?{agentData:state.stages[stage-1].agentData||state.stages[stage-1].acceptedData||{},humanData:state.stages[stage-1].humanData||{},derivedData:state.stages[stage-1].derivedData||{}}:'NONE';parts.push(`PRIOR STAGE DECISION AND ACCEPTED DATA\\n${show(prior)}`);}")
P.write_text(s)
print('prompt patch applied')
