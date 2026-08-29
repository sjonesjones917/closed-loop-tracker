from pathlib import Path
p=Path('verify-definition-of-done.mjs'); s=p.read_text()
old="  engineSource.includes(\"if(!contract.sufficient)missing.push('INSUFFICIENT_EVIDENCE:'+tid)\"),"
new="  engineSource.includes('sufficiency=evaluateEvidenceSufficiency(project,{requirement,test,result})'),\n  engineSource.includes(\"if(!contract.sufficient||!sufficiency.sufficient)missing.push('INSUFFICIENT_EVIDENCE:'+tid)\"),"
if s.count(old)!=1: raise SystemExit(f'expected one structural-only evidence-chain proof, found {s.count(old)}')
p.write_text(s.replace(old,new,1))
print('definition-of-done evidence sufficiency proof patched')
