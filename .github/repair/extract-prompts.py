from pathlib import Path
import json
s=Path('prompt-engine.js').read_text()
start=s.index('const stageSpecial=Object.freeze(')+len('const stageSpecial=Object.freeze(')
end=s.index(');',start)
obj=json.loads(s[start:end])
out=[]
for n in range(21,31):
    out.append(f'STAGE {n:02d}\n{obj[str(n)]}\n')
Path('PROMPT_STAGES_21_30.txt').write_text('\n'.join(out))
