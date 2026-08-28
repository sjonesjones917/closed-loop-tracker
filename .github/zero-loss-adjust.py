from pathlib import Path
p=Path('.github/zero-loss-patch.py')
s=p.read_text()
old="if(mode==='EXTERNAL_AGENT_TOOL'){requiredEvidenceClasses.push('CAPABILITY_EXECUTION');if(!String(recordValue(test,'REQUIRED_CAPABILITY')||'').trim())reasons.push('External tool execution lacks a declared capability identity.');if(adjudicationEmpty(recordValue(result,'OBSERVED_RESULT'))&&adjudicationEmpty(recordValue(result,'ACTUAL_RESULT')))reasons.push('External tool execution lacks an actual observed result.');}"
new="if(mode==='EXTERNAL_AGENT_TOOL'){requiredEvidenceClasses.push('CAPABILITY_EXECUTION');if(!String(recordValue(test,'REQUIRED_CAPABILITY')||'').trim())reasons.push('External tool execution lacks a declared capability identity.');const meaningObservation=!adjudicationEmpty(recordValue(result,'OBSERVED_MEANING'))&&!adjudicationEmpty(recordValue(result,'EVIDENCE_BASED_COMPARISON')),genericObservation=!adjudicationEmpty(recordValue(result,'OBSERVED_RESULT'))||!adjudicationEmpty(recordValue(result,'ACTUAL_RESULT'));if(!genericObservation&&!meaningObservation)reasons.push('External tool execution lacks an actual structured observation.');}"
if s.count(old)!=1: raise SystemExit('generic observation patch target count='+str(s.count(old)))
s=s.replace(old,new,1)
p.write_text(s)
