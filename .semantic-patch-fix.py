from pathlib import Path
p=Path('verify-prompt-semantics.mjs')
s=p.read_text()
replacements=[
("if(!record.prompt.includes('implementation-ready specification rather than pretending implementation occurred'))issues.push('ENVIRONMENT_LIMIT_RULE_MISSING');","if(!record.prompt.includes('do not claim it occurred; produce the complete implementation-ready specification'))issues.push('ENVIRONMENT_LIMIT_RULE_MISSING');"),
("{...original,prompt:original.prompt.replace('implementation-ready specification rather than pretending implementation occurred','assume implementation occurred')}","{...original,prompt:original.prompt.replace('do not claim it occurred; produce the complete implementation-ready specification','assume implementation occurred')}"),
("if(!record.prompt.includes('primary, official, controlling'))issues.push('SOURCE_QUALITY_RULE_MISSING');","if(!record.prompt.includes('most authoritative and reputable sources appropriate to the information type'))issues.push('SOURCE_QUALITY_RULE_MISSING');")
]
for old,new in replacements:
    if s.count(old)!=1: raise SystemExit(f'expected semantic oracle once, found {s.count(old)}: {old}')
    s=s.replace(old,new,1)
p.write_text(s)
