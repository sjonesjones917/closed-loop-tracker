import pathlib
p=pathlib.Path('prompt-engine.js')
s=p.read_text()
def rep(old,new,label):
    global s
    if s.count(old)!=1: raise SystemExit(f'{label}: expected one match, found {s.count(old)}')
    s=s.replace(old,new,1)
rep("const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/56';","const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/57';",'prompt version')
rep("if(stage>1&&![11,12,23,24].includes(stage)){const prior=state?.stages?.[stage-1]?","if(stage>1&&![11,12,23,24].includes(stage)&&!((stage===17||stage===19)&&['EXECUTE_RUN','VERIFY'].includes(operation))){const prior=state?.stages?.[stage-1]?",'isolated prior-stage context')
p.write_text(s)
