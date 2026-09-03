from pathlib import Path
import base64
ROOT=Path('.')
DATA=Path('.repair-section49')
def dec(name): return base64.b64decode((DATA/f'{name}.b64').read_text()).decode()
def between(s,start,end,new):
    i=s.index(start); j=s.index(end,i); return s[:i]+new+s[j:]
ep=ROOT/'workflow-engine.js'; s=ep.read_text()
old="const INTAKE_ACCOUNTING_DISPOSITIONS=Object.freeze(['incorporated into the job definition','retained as context','unresolved human-only','later-resolvable','inapplicable with reason']);"
new="const INTAKE_ACCOUNTING_DISPOSITIONS=Object.freeze(['EXTRACTED_RELEVANT_INFORMATION','RETAINED_AS_CONTEXT','NO_PROJECT_RELEVANT_INFORMATION','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE','INACCESSIBLE_OR_BLOCKED']);"
assert s.count(old)==1; s=s.replace(old,new,1)
old="const disposition=String(unit?.disposition||'').trim().toLowerCase();if(!INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition))reasons.push(`Stage 01 intake unit ${id} has an invalid disposition.`);if(disposition==='inapplicable with reason'&&!String(unit?.reason||'').trim())reasons.push(`Stage 01 intake unit ${id} requires an inapplicability reason.`);\n    const statements=safe(unit?.extractedStatements);if(disposition!=='inapplicable with reason'&&!statements.length)reasons.push(`Stage 01 intake unit ${id} contains no extracted human-authority statement.`);"
new="const disposition=String(unit?.disposition||'').trim().toUpperCase();if(!INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition))reasons.push(`Stage 01 intake unit ${id} has an invalid disposition.`);if(disposition==='INACCESSIBLE_OR_BLOCKED'){if(!String(unit?.reason||'').trim())reasons.push(`Stage 01 intake unit ${id} requires an inaccessible-or-blocked reason.`);reasons.push(`Stage 01 intake unit ${id} remains inaccessible or blocked and cannot satisfy Stage 01 completion.`);}\n    const statements=safe(unit?.extractedStatements);if(['EXTRACTED_RELEVANT_INFORMATION','UNRESOLVED_HUMAN_AUTHORITY'].includes(disposition)&&!statements.length)reasons.push(`Stage 01 intake unit ${id} contains no extracted human-authority statement.`);"
assert s.count(old)==1; s=s.replace(old,new,1)
old="if(hashMatches&&INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition)&&statementsValid&&(disposition==='inapplicable with reason'?Boolean(String(unit?.reason||'').trim()):statements.length>0))accounted.add(id);"
new="if(hashMatches&&INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition)&&statementsValid&&(!['EXTRACTED_RELEVANT_INFORMATION','UNRESOLVED_HUMAN_AUTHORITY'].includes(disposition)||statements.length>0)&&(disposition!=='INACCESSIBLE_OR_BLOCKED'||Boolean(String(unit?.reason||'').trim())))accounted.add(id);"
assert s.count(old)==1; s=s.replace(old,new,1)
s=between(s,'function relationSet(p){','function registry(p){',dec('due'))
s=between(s,'function artifactOK(p){','function recalc(p){',dec('terminal'))
s=between(s,'const RESPONSIBLE_STAGE_MAP=','function responsibleStageForMutation',dec('map'))
s=between(s,'const engine=Object.freeze','})();',dec('export'))
ep.write_text(s)
pp=ROOT/'prompt-engine.js'; p=pp.read_text()
old='"disposition":"incorporated into the job definition|retained as context|unresolved human-only|later-resolvable|inapplicable with reason"'
new='"disposition":"EXTRACTED_RELEVANT_INFORMATION|RETAINED_AS_CONTEXT|NO_PROJECT_RELEVANT_INFORMATION|UNRESOLVED_HUMAN_AUTHORITY|LATER_RESOLVABLE|INACCESSIBLE_OR_BLOCKED"'
assert p.count(old)==1; pp.write_text(p.replace(old,new,1))
sp=ROOT/'verify-stage01-intake-closure.mjs'; t=sp.read_text(); assert "disposition:'retained as context'" in t; sp.write_text(t.replace("disposition:'retained as context'","disposition:'RETAINED_AS_CONTEXT'",1))
wp=ROOT/'.github/workflows/pages.yml'; w=wp.read_text(); needle='          node verify-full-cycle.mjs\n          node verify-definition-of-done.mjs\n'; assert needle in w; wp.write_text(w.replace(needle,'          node verify-full-cycle.mjs\n          node verify-terminal-due-contract.mjs\n          node verify-stage01-disposition-contract.mjs\n          node verify-definition-of-done.mjs\n',1))