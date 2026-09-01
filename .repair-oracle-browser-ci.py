import pathlib
p=pathlib.Path('verify-spec-grounded-route-oracle.mjs')
s=p.read_text()
old="assert(ci.includes('node verify-human-stage-walkthrough.mjs'),'CI omits operator-experience proof.');"
new="assert(ci.includes('run_browser_verifier verify-human-stage-walkthrough.mjs'),'CI omits operator-experience proof.');"
if s.count(old)!=1: raise SystemExit(f'Expected one browser-CI assertion; found {s.count(old)}')
p.write_text(s.replace(old,new,1))
