from pathlib import Path
p=Path('verify-prompt-semantics.mjs')
s=p.read_text()
old="if(!record.prompt.includes('implementation-ready specification rather than pretending implementation occurred'))issues.push('ENVIRONMENT_LIMIT_RULE_MISSING');"
new="if(!record.prompt.includes('do not claim it occurred; produce the complete implementation-ready specification'))issues.push('ENVIRONMENT_LIMIT_RULE_MISSING');"
if s.count(old)!=1: raise SystemExit(f'expected environment rule check once, found {s.count(old)}')
s=s.replace(old,new,1)
old="{...original,prompt:original.prompt.replace('implementation-ready specification rather than pretending implementation occurred','assume implementation occurred')}"
new="{...original,prompt:original.prompt.replace('do not claim it occurred; produce the complete implementation-ready specification','assume implementation occurred')}"
if s.count(old)!=1: raise SystemExit(f'expected environment mutant once, found {s.count(old)}')
p.write_text(s.replace(old,new,1))
