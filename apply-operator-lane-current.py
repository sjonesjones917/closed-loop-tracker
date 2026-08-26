from pathlib import Path
import hashlib,re


def replace_once(path, old, new, label):
    p=Path(path); s=p.read_text()
    count=s.count(old)
    if count!=1: raise SystemExit(f'{label}: expected one anchor, found {count}')
    p.write_text(s.replace(old,new,1))

p=Path('app-core.js'); s=p.read_text()
anchor="function promptOptions(n){const operation=selectedOperation(n),options={operation},requiresRun=(schema.operationContract(n,operation)?.scopeRequirements||[]).includes('runId');if(requiresRun){const run=selectedRun(n);if(run){const runId=engine.recordId(run,'runs'),contextId=String(recordValue(run,'CONTEXT_ID')||run.relationships?.CONTEXT_ID||run.scope?.contextId||'');options.scope={runId,contextId};}}return options;}\n"
helpers="""const operatorScopeKeys=['inputVersion','sourceSetVersion','requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId','runId','contextId','baselineId','productId'];
function currentOperatorScope(n){return globalThis.closedLoopPromptEngine.scopeFor(n,current,promptOptions(n).scope||{});}
function operatorLaneMatches(item,n){if(Number(item?.stage)!==Number(n)||item?.invalidatedBy)return false;const operation=String(item?.envelope?.operation||item?.operation||'COMPLETE'),selected=selectedOperation(n);if(operation!==selected)return false;const actual=item?.envelope?.scope||item?.scope||{},expected=currentOperatorScope(n),required=schema.operationContract(n,operation)?.scopeRequirements||[];for(const key of operatorScopeKeys){const av=actual?.[key],ev=expected?.[key];if(av!==undefined&&av!==null&&av!==''&&ev!==undefined&&ev!==null&&ev!==''&&String(av)!==String(ev))return false;}for(const key of required){if(key==='projectRevision')continue;if(String(actual?.[key]??'')!==String(expected?.[key]??''))return false;}return true;}
function validationLaneRecord(validation){return safe(current.projectData.generatedPrompts).find(x=>(x.instructionId||x.promptId)===validation?.promptId)||validation;}
function acceptedLaneChanges(n){return engine.acceptedChanges(current,n).filter(x=>operatorLaneMatches(x,n));}
"""
if 'function operatorLaneMatches(item,n)' in s: raise SystemExit('operator lane matcher already exists; do not double-apply')
if s.count(anchor)!=1: raise SystemExit('promptOptions anchor changed')
s=s.replace(anchor,anchor+helpers,1)
old="function validationMarkup(n){const v=safe(current.projectData.responseValidations).filter(x=>Number(x.stage)===n).at(-1);if(!v||v.valid)return '';"
new="function validationMarkup(n){const v=safe(current.projectData.responseValidations).filter(x=>Number(x.stage)===n&&!x.valid&&operatorLaneMatches(validationLaneRecord(x),n)).at(-1);if(!v)return '';"
if s.count(old)!=1: raise SystemExit('validation markup anchor changed')
s=s.replace(old,new,1)
old="function proposalMarkup(n){const p=safe(current.projectData.responseProposals).filter(x=>Number(x.stage)===n&&x.status==='PENDING_OPERATOR_REVIEW').at(-1);"
new="function proposalMarkup(n){const p=safe(current.projectData.responseProposals).filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,n)).at(-1);"
if s.count(old)!=1: raise SystemExit('proposal markup anchor changed')
s=s.replace(old,new,1)
old="${engine.acceptedChanges(current,n).length&&!current.isRetainedTestProject?`<details class=\"record-card\"><summary>Refine accepted result<span>Controlled</span></summary>"
new="${acceptedLaneChanges(n).length&&!current.isRetainedTestProject?`<details class=\"record-card\"><summary>Refine accepted result<span>Controlled</span></summary>"
if s.count(old)!=1: raise SystemExit('refinement visibility anchor changed')
s=s.replace(old,new,1)
old="function pendingProposal(){return safe(current.projectData.responseProposals).filter(x=>Number(x.stage)===current.activeStage&&x.status==='PENDING_OPERATOR_REVIEW').at(-1);}"
new="function pendingProposal(){return safe(current.projectData.responseProposals).filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,current.activeStage)).at(-1);}"
if s.count(old)!=1: raise SystemExit('pending proposal anchor changed')
s=s.replace(old,new,1)
pattern=re.compile(r"const next=clone\(current\),stage=current\.activeStage,changes=engine\.acceptedChanges\(next,stage\),operation=selectedOperation\(stage\),scope=promptOptions\(stage\)\?\.scope\|\|\{\},targetKeys=\['iterationId','candidateId','runId','contextId','baselineId','productId'\],matches=changes\.filter\(change=>String\(change\.operation\|\|'COMPLETE'\)===String\(operation\)&&targetKeys\.every\(key=>scope\[key\]===undefined\|\|scope\[key\]===null\|\|scope\[key\]===''\|\|String\(change\.scope\?\.\[key\]\?\?''\)===String\(scope\[key\]\)\)\),change=matches\.at\(-1\)\|\|\(\(changes\.length===1\)\?changes\[0\]:null\);")
s,count=pattern.subn("const next=clone(current),stage=current.activeStage,change=acceptedLaneChanges(stage).at(-1);",s,count=1)
if count!=1: raise SystemExit('accepted refinement action anchor changed')
p.write_text(s)

p=Path('verify-complete.mjs'); s=p.read_text()
marker='// Explicit workflow gates cannot be bypassed by manual assertions.'
block="""// Multi-operation operator review must remain bound to the selected operation/run lane.
{
  const appSource=fs.readFileSync('app-core.js','utf8');
  assert(appSource.includes('function operatorLaneMatches(item,n)'),'Operator review has no shared lane matcher.');
  assert(appSource.includes("filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,n))"),'Proposal rendering is still stage-wide.');
  assert(appSource.includes("filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,current.activeStage))"),'Accept/reject selection is still stage-wide.');
  assert(appSource.includes('operatorLaneMatches(validationLaneRecord(x),n)'),'Validation feedback is still stage-wide.');
  assert(appSource.includes('acceptedLaneChanges(n).length'),'Refinement control visibility is still stage-wide.');
  assert(appSource.includes('change=acceptedLaneChanges(stage).at(-1)'),'Refinement action can still target a different accepted lane.');
}

"""
if 'Operator review has no shared lane matcher' in s: raise SystemExit('operator lane regression already exists')
if s.count(marker)!=1: raise SystemExit('verify-complete insertion anchor changed')
p.write_text(s.replace(marker,block+marker,1))

runtime=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def blob_sha(path):
    b=Path(path).read_bytes(); return hashlib.sha1(f'blob {len(b)}\0'.encode()+b).hexdigest()
manifest=''.join(f'{name}:{blob_sha(name)}\n' for name in runtime)
token='runtime-'+hashlib.sha256(manifest.encode()).hexdigest()[:16]
p=Path('index.html'); h=p.read_text(); h2,count=re.subn(r'runtime-[0-9a-f]{16}',token,h)
if count!=8: raise SystemExit(f'runtime cache token expected 8 replacements, found {count}')
p.write_text(h2)
print(token)
