from pathlib import Path
import hashlib,re

app=Path('app-core.js')
s=app.read_text(encoding='utf-8')
anchor="function promptOptions(n){const operation=selectedOperation(n),options={operation},requiresRun=(schema.operationContract(n,operation)?.scopeRequirements||[]).includes('runId');if(requiresRun){const run=selectedRun(n);if(run){const runId=engine.recordId(run,'runs'),contextId=String(recordValue(run,'CONTEXT_ID')||run.relationships?.CONTEXT_ID||run.scope?.contextId||'');options.scope={runId,contextId};}}return options;}\n"
assert anchor in s, 'promptOptions anchor changed'
helpers="""const operatorScopeKeys=['inputVersion','sourceSetVersion','requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId','runId','contextId','baselineId','productId'];
function currentOperatorScope(n){const j=current.job||{},options=promptOptions(n),candidate=engine.records(current,'candidateFreezes').filter(x=>engine.isActiveRecord(x)).at(-1);return {inputVersion:j.CURRENT_INPUT_VERSION||null,sourceSetVersion:j.CURRENT_SOURCE_SET_VERSION||null,requirementsVersion:j.CURRENT_REQUIREMENTS_VERSION||null,testSuiteVersion:j.CURRENT_TEST_SUITE_VERSION||null,instructionVersion:j.CURRENT_INSTRUCTION_VERSION||null,iterationId:j.CURRENT_ITERATION||null,candidateId:candidate?engine.recordId(candidate,'candidateFreezes'):null,runId:options.scope?.runId||null,contextId:options.scope?.contextId||null,baselineId:j.CURRENT_BASELINE_ID&&!['NONE','NOT APPLICABLE'].includes(String(j.CURRENT_BASELINE_ID))?j.CURRENT_BASELINE_ID:null,productId:j.CURRENT_PRODUCT_ID&&!['NONE','NOT APPLICABLE'].includes(String(j.CURRENT_PRODUCT_ID))?j.CURRENT_PRODUCT_ID:null};}
function operatorLaneMatches(item,n){if(Number(item?.stage)!==Number(n))return false;const operation=String(item?.envelope?.operation||item?.operation||'COMPLETE'),selected=selectedOperation(n);if(operation!==selected)return false;const actual=item?.envelope?.scope||item?.scope||{},expected=currentOperatorScope(n),required=schema.operationContract(n,operation)?.scopeRequirements||[];for(const key of operatorScopeKeys){const av=actual?.[key],ev=expected?.[key];if(av!==undefined&&av!==null&&av!==''&&ev!==undefined&&ev!==null&&ev!==''&&String(av)!==String(ev))return false;}for(const key of required){if(key==='projectRevision')continue;if(String(actual?.[key]??'')!==String(expected?.[key]??''))return false;}return true;}
function validationLaneRecord(validation){return safe(current.projectData.generatedPrompts).find(x=>(x.instructionId||x.promptId)===validation?.promptId)||validation;}
function acceptedLaneChanges(n){return engine.acceptedChanges(current,n).filter(x=>operatorLaneMatches(x,n));}
"""
s=s.replace(anchor,anchor+helpers,1)
old="function validationMarkup(n){const v=safe(current.projectData.responseValidations).filter(x=>Number(x.stage)===n).at(-1);if(!v||v.valid)return '';return `<div class=\"notice danger\" id=\"validation-report\" tabindex=\"-1\"><strong>Response rejected before canonical mutation.</strong><br>${safe(v.issues).map(x=>esc(`${x.code}: ${x.message}`)).join('<br>')}</div>`;}\nfunction proposalMarkup(n){const p=safe(current.projectData.responseProposals).filter(x=>Number(x.stage)===n&&x.status==='PENDING_OPERATOR_REVIEW').at(-1);if(!p)return validationMarkup(n);"
new="function validationMarkup(n){const v=safe(current.projectData.responseValidations).filter(x=>Number(x.stage)===n&&!x.valid&&operatorLaneMatches(validationLaneRecord(x),n)).at(-1);if(!v)return '';return `<div class=\"notice danger\" id=\"validation-report\" tabindex=\"-1\"><strong>Response rejected before canonical mutation.</strong><br>${safe(v.issues).map(x=>esc(`${x.code}: ${x.message}`)).join('<br>')}</div>`;}\nfunction proposalMarkup(n){const p=safe(current.projectData.responseProposals).filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,n)).at(-1);if(!p)return validationMarkup(n);"
assert old in s, 'validation/proposal selector changed'
s=s.replace(old,new,1)
old="${engine.acceptedChanges(current,n).length&&!current.isRetainedTestProject?`<details class=\"record-card\"><summary>Refine accepted result<span>Controlled</span></summary>"
new="${acceptedLaneChanges(n).length&&!current.isRetainedTestProject?`<details class=\"record-card\"><summary>Refine accepted result<span>Controlled</span></summary>"
assert old in s, 'accepted refinement visibility changed'
s=s.replace(old,new,1)
old="function pendingProposal(){return safe(current.projectData.responseProposals).filter(x=>Number(x.stage)===current.activeStage&&x.status==='PENDING_OPERATOR_REVIEW').at(-1);}"
new="function pendingProposal(){return safe(current.projectData.responseProposals).filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,current.activeStage)).at(-1);}"
assert old in s, 'pending proposal selector changed'
s=s.replace(old,new,1)
app.write_text(s,encoding='utf-8')

v=Path('verify-complete.mjs')
t=v.read_text(encoding='utf-8')
marker='// Explicit workflow gates cannot be bypassed by manual assertions.'
assert marker in t and 'Operator review has no shared lane matcher.' not in t
block="""// Multi-operation review controls must remain bound to the operator-selected operation/run lane.
{
  const appSource=fs.readFileSync('app-core.js','utf8');
  assert(appSource.includes('function operatorLaneMatches(item,n)'),'Operator review has no shared lane matcher.');
  assert(appSource.includes("filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,n))"),'Proposal rendering is still stage-wide.');
  assert(appSource.includes("filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,current.activeStage))"),'Accept/reject selection is still stage-wide.');
  assert(appSource.includes('operatorLaneMatches(validationLaneRecord(x),n)'),'Validation feedback is still stage-wide.');
  assert(appSource.includes('acceptedLaneChanges(n).length'),'Refinement control visibility is still stage-wide.');
}

"""
t=t.replace(marker,block+marker,1)
v.write_text(t,encoding='utf-8')

# Refresh the one shared runtime byte identity because app-core.js changed.
idx=Path('index.html'); h=idx.read_text(encoding='utf-8')
files=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def blob(path):
    b=Path(path).read_bytes(); return hashlib.sha1(f'blob {len(b)}\0'.encode()+b).hexdigest()
token='runtime-'+hashlib.sha256(''.join(f'{f}:{blob(f)}\n' for f in files).encode()).hexdigest()[:16]
h2,n=re.subn(r'(?<=\?v=)runtime-[a-f0-9]{16}',token,h)
assert n==8, f'expected 8 runtime tokens, changed {n}'
idx.write_text(h2,encoding='utf-8')
