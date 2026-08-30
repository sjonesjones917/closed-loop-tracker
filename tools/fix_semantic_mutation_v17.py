from pathlib import Path
p=Path('verify-prompt-semantics.mjs'); t=p.read_text()
old="{...original,prompt:original.prompt.replace('withhold prior outputs','include prior outputs')},"
new="{...original,prompt:original.prompt.replace(`CONTRACT_SHA256: ${original.contractSha256}`,'CONTRACT_SHA256: 0000000000000000000000000000000000000000000000000000000000000000')},"
if old not in t: raise SystemExit('mutation 8 anchor missing')
t=t.replace(old,new,1)
p.write_text(t)
print('mutation 8 now changes an explicitly validated contract identity')
