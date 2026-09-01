import pathlib
p=pathlib.Path('verify-spec-grounded-route-oracle.mjs')
s=p.read_text()
old="state.projectData[c]=[{stage:d.stage||1,fields:sf,scope:ssc,active:true,validity:'CURRENT'},{stage:d.stage||1,fields:f,scope:sc,active:true,validity:'CURRENT'}];"
new="state.projectData[c]=[{id:sid,stage:d.stage||1,fields:sf,scope:ssc,active:true,validity:'CURRENT'},{id,stage:d.stage||1,fields:f,scope:sc,active:true,validity:'CURRENT'}];"
if s.count(old)!=1: raise SystemExit(f'Expected one sentinel record constructor; found {s.count(old)}')
p.write_text(s.replace(old,new,1))
