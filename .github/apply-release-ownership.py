from pathlib import Path
p=Path('workflow-engine.js');s=p.read_text()
old="""    case 26:
      requireAccepted();requireCount('processAudits',1);requireCount('productAudits',1);
      if(collection('processAudits').some(record=>upper(recordValue(record,'PROCESS_DETERMINATION'))!=='SATISFIED'))reasons.push('Process audit is not SATISFIED.');
      if(collection('productAudits').some(record=>upper(recordValue(record,'PRODUCT_DETERMINATION'))!=='SATISFIED'))reasons.push('Product audit is not SATISFIED.');for(const audit of [...collection('processAudits'),...collection('productAudits')])if(!evaluateEvidenceSufficiency(project,{result:audit}).sufficient)reasons.push('Stage 26 audit '+String(audit.id||audit.recordId||'UNKNOWN')+' has insufficient evidence.');const stage26Contradictions=detectCurrentContradictions(project);if(stage26Contradictions.length)reasons.push('Current process/product evidence contains unresolved contradictions: '+stage26Contradictions.map(x=>x.type+':'+x.key).join(', ')+'.');
      break;
    case 27:{requireAccepted();const r=recordsForCurrentScope(project,'releaseRecords').at(-1);if(!r)reasons.push('The application has not recorded a current release determination.');else if(!['ACCEPTED','REJECTED','BLOCKED'].includes(upper(recordValue(r,'DETERMINATION'))))reasons.push('Current release determination is invalid.');break;}"""
new="""    case 26:
      requireAccepted();requireCount('processAudits',1);requireCount('productAudits',1);
      for(const audit of [...collection('processAudits'),...collection('productAudits')])if(!evaluateEvidenceSufficiency(project,{result:audit}).sufficient)reasons.push('Stage 26 audit '+String(audit.id||audit.recordId||'UNKNOWN')+' has insufficient evidence.');const stage26Contradictions=detectCurrentContradictions(project);if(stage26Contradictions.length)reasons.push('Current process/product evidence contains unresolved contradictions: '+stage26Contradictions.map(x=>x.type+':'+x.key).join(', ')+'.');
      break;
    case 27:{const r=recordsForCurrentScope(project,'releaseRecords').at(-1);if(!r)reasons.push('The application has not recorded a current release determination.');else if(!['ACCEPTED','REJECTED','BLOCKED'].includes(upper(recordValue(r,'DETERMINATION'))))reasons.push('Current release determination is invalid.');break;}"""
if old not in s: raise SystemExit('Stage 26/27 ownership anchor missing')
s=s.replace(old,new,1)
old30="""    case 30:{requireAccepted();const defects=confirmedDefects(project),regs=records(project,'regressions'),covered=new Set(regs.map(r=>String(recordValue(r,'DEFECT_ID')||r.relationships?.DEFECT_ID||''))),executions=recordsForCurrentScope(project,'regressionExecutions');"""
new30="""    case 30:{const defects=confirmedDefects(project),regs=records(project,'regressions'),covered=new Set(regs.map(r=>String(recordValue(r,'DEFECT_ID')||r.relationships?.DEFECT_ID||''))),executions=recordsForCurrentScope(project,'regressionExecutions');"""
if old30 not in s: raise SystemExit('Stage 30 ownership anchor missing')
s=s.replace(old30,new30,1)
p.write_text(s)
for name in ['index.html','app-core.js','test-runtime.js']:
    f=Path(name);f.write_text(f.read_text().replace('runtime-20260830-live-operator-66','runtime-20260830-live-operator-67'))
