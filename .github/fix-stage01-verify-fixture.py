from pathlib import Path
p=Path('verify.mjs')
text=p.read_text(encoding='utf-8')
old="disposition:'incorporated into the job definition'"
new="disposition:'EXTRACTED_RELEVANT_INFORMATION'"
count=text.count(old)
if count!=1: raise SystemExit(f'verify.mjs expected one legacy Stage 01 fixture disposition, found {count}')
p.write_text(text.replace(old,new,1),encoding='utf-8',newline='\n')
