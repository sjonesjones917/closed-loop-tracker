from pathlib import Path
p=Path('workflow-engine.js')
s=p.read_text()
old="""const SCOPE_KEYS=Object.freeze(['inputVersion','sourceSetVersion','requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId','baselineId','productId']);
function currentScope(project){"""
new="""const SCOPE_KEYS=Object.freeze(['inputVersion','sourceSetVersion','requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId','baselineId','productId']);
const COLLECTION_SCOPE_KEYS=Object.freeze({regressions:Object.freeze(['inputVersion','sourceSetVersion','requirementsVersion','testSuiteVersion','instructionVersion'])});
function currentScope(project){"""
assert old in s
s=s.replace(old,new,1)
old2="""function scopeMatches(record,scopeRule={}){const rs=record?.scope||{};for(const [key,value] of Object.entries(rs)){if(value===undefined||value===null)continue;if(Object.prototype.hasOwnProperty.call(scopeRule,key)&&(scopeRule[key]??null)!==value)return false;}return true;}
function recordsForCurrentScope(project,collection,scopeRule={}){const active=records(project,collection);const scope={...currentScope(project),...scopeRule};const applicable=Object.fromEntries(Object.entries(scope).filter(([,v])=>v!==undefined&&v!==null));return active.filter(record=>!record.scope||scopeMatches(record,applicable));}"""
new2="""function scopeMatches(record,scopeRule={},scopeKeys=SCOPE_KEYS){const rs=record?.scope||{};const keys=new Set(scopeKeys);for(const [key,value] of Object.entries(rs)){if(!keys.has(key)||value===undefined||value===null)continue;if(Object.prototype.hasOwnProperty.call(scopeRule,key)&&(scopeRule[key]??null)!==value)return false;}return true;}
function recordsForCurrentScope(project,collection,scopeRule={}){const active=records(project,collection);const scope={...currentScope(project),...scopeRule};const applicable=Object.fromEntries(Object.entries(scope).filter(([,v])=>v!==undefined&&v!==null));const scopeKeys=COLLECTION_SCOPE_KEYS[collection]||SCOPE_KEYS;return active.filter(record=>!record.scope||scopeMatches(record,applicable,scopeKeys));}"""
assert old2 in s
p.write_text(s.replace(old2,new2,1))
