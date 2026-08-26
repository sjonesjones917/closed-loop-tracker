from pathlib import Path
p=Path('workflow-engine.js');s=p.read_text()
old="case 30:{requireAccepted();const defects=confirmedDefects(project),regs=recordsForCurrentScope(project,'regressions'),covered=new Set(regs.map(r=>String(recordValue(r,'DEFECT_ID')||r.relationships?.DEFECT_ID||''))),executions=recordsForCurrentScope(project,'regressionExecutions');"
new="case 30:{requireAccepted();const defects=confirmedDefects(project),regs=records(project,'regressions').filter(r=>upper(recordValue(r,'ACTIVE_RETIRED_STATE')||'ACTIVE')!=='RETIRED'),covered=new Set(regs.map(r=>String(recordValue(r,'DEFECT_ID')||r.relationships?.DEFECT_ID||''))),executions=records(project,'regressionExecutions');"
assert old in s
p.write_text(s.replace(old,new,1))
