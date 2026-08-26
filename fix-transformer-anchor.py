from pathlib import Path
p=Path('apply-final-boundary-closure.py')
s=p.read_text()
old='p=Path(\'test-fixtures.mjs\'); s=p.read_text()\nanchor="function scalarFor(name,definition,seed=1){const upper=String(name).toUpperCase();"\nreplacement=anchor+"if(upper.includes(\'ARTIFACT_REQUIREMENTS\'))return \'NONE\';"\nif s.count(anchor)!=1: raise SystemExit(\'test fixture scalar anchor mismatch\')\ns=s.replace(anchor,replacement,1); p.write_text(s)'
new='p=Path(\'test-fixtures.mjs\'); s=p.read_text()\nanchor="  const upper=String(name).toUpperCase();\\n"\nreplacement=anchor+"  if(upper.includes(\'ARTIFACT_REQUIREMENTS\'))return \'NONE\';\\n"\nif s.count(anchor)!=1: raise SystemExit(\'test fixture scalar anchor mismatch\')\ns=s.replace(anchor,replacement,1); p.write_text(s)'
if s.count(old)!=1: raise SystemExit('transformer fixture block mismatch')
p.write_text(s.replace(old,new,1))
