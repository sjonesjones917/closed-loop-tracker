from pathlib import Path
import hashlib
import re


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    p.write_text(text.replace(old, new, 1))


# Bind operator review/actions to the exact selected operation/run/context lane.
p = Path("app-core.js")
text = p.read_text()
anchor = "function promptOptions(n){const operation=selectedOperation(n),options={operation},requiresRun=(schema.operationContract(n,operation)?.scopeRequirements||[]).includes('runId');if(requiresRun){const run=selectedRun(n);if(run){const runId=engine.recordId(run,'runs'),contextId=String(recordValue(run,'CONTEXT_ID')||run.relationships?.CONTEXT_ID||run.scope?.contextId||'');options.scope={runId,contextId};}}return options;}\n"
helpers = """const operatorScopeKeys=['inputVersion','sourceSetVersion','requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId','runId','contextId','baselineId','productId'];
function currentOperatorScope(n){return globalThis.closedLoopPromptEngine.scopeFor(n,current,promptOptions(n).scope||{});}
function operatorLaneMatches(item,n){if(Number(item?.stage)!==Number(n)||item?.invalidatedBy)return false;const operation=String(item?.envelope?.operation||item?.operation||'COMPLETE'),selected=selectedOperation(n);if(operation!==selected)return false;const actual=item?.envelope?.scope||item?.scope||{},expected=currentOperatorScope(n),required=schema.operationContract(n,operation)?.scopeRequirements||[];for(const key of operatorScopeKeys){const av=actual?.[key],ev=expected?.[key];if(av!==undefined&&av!==null&&av!==''&&ev!==undefined&&ev!==null&&ev!==''&&String(av)!==String(ev))return false;}for(const key of required){if(key==='projectRevision')continue;if(String(actual?.[key]??'')!==String(expected?.[key]??''))return false;}return true;}
function validationLaneRecord(validation){return safe(current.projectData.generatedPrompts).find(x=>(x.instructionId||x.promptId)===validation?.promptId)||validation;}
function acceptedLaneChanges(n){return engine.acceptedChanges(current,n).filter(x=>operatorLaneMatches(x,n));}
"""
if "function operatorLaneMatches(item,n)" not in text:
    if text.count(anchor) != 1:
        raise SystemExit("operator lane helper anchor mismatch")
    text = text.replace(anchor, anchor + helpers, 1)

old = "function validationMarkup(n){const v=safe(current.projectData.responseValidations).filter(x=>Number(x.stage)===n).at(-1);if(!v||v.valid)return '';"
new = "function validationMarkup(n){const v=safe(current.projectData.responseValidations).filter(x=>Number(x.stage)===n&&!x.valid&&operatorLaneMatches(validationLaneRecord(x),n)).at(-1);if(!v)return '';"
if old in text:
    text = text.replace(old, new, 1)
old = "function proposalMarkup(n){const p=safe(current.projectData.responseProposals).filter(x=>Number(x.stage)===n&&x.status==='PENDING_OPERATOR_REVIEW').at(-1);"
new = "function proposalMarkup(n){const p=safe(current.projectData.responseProposals).filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,n)).at(-1);"
if old in text:
    text = text.replace(old, new, 1)
old = "${engine.acceptedChanges(current,n).length&&!current.isRetainedTestProject?`<details class=\"record-card\"><summary>Refine accepted result<span>Controlled</span></summary>"
new = "${acceptedLaneChanges(n).length&&!current.isRetainedTestProject?`<details class=\"record-card\"><summary>Refine accepted result<span>Controlled</span></summary>"
if old in text:
    text = text.replace(old, new, 1)
old = "function pendingProposal(){return safe(current.projectData.responseProposals).filter(x=>Number(x.stage)===current.activeStage&&x.status==='PENDING_OPERATOR_REVIEW').at(-1);}"
new = "function pendingProposal(){return safe(current.projectData.responseProposals).filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,current.activeStage)).at(-1);}"
if old in text:
    text = text.replace(old, new, 1)
pattern = re.compile(r"const next=clone\(current\),stage=current\.activeStage,changes=engine\.acceptedChanges\(next,stage\),operation=selectedOperation\(stage\),scope=promptOptions\(stage\)\?\.scope\|\|\{\},targetKeys=\['iterationId','candidateId','runId','contextId','baselineId','productId'\],matches=changes\.filter\(change=>String\(change\.operation\|\|'COMPLETE'\)===String\(operation\)&&targetKeys\.every\(key=>scope\[key\]===undefined\|\|scope\[key\]===null\|\|scope\[key\]===''\|\|String\(change\.scope\?\.\[key\]\?\?''\)===String\(scope\[key\]\)\)\),change=matches\.at\(-1\)\|\|\(\(changes\.length===1\)\?changes\[0\]:null\);")
replacement = "const next=clone(current),stage=current.activeStage,change=acceptedLaneChanges(stage).at(-1);"
text, count = pattern.subn(replacement, text, count=1)
if count not in (0, 1):
    raise SystemExit("accepted refinement lane replacement mismatch")
for required in [
    "function operatorLaneMatches(item,n)",
    "filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,n))",
    "filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,current.activeStage))",
    "operatorLaneMatches(validationLaneRecord(x),n)",
    "acceptedLaneChanges(n).length",
]:
    if required not in text:
        raise SystemExit(f"operator lane repair missing {required}")
p.write_text(text)

# Keep the authority-invalidation verifier aligned with the stronger current semantics,
# and permanently assert the operator lane boundary.
p = Path("verify-complete.mjs")
text = p.read_text()
text = text.replace(
    "assert(appSource.includes(\"invalidateStageForAuthorityChange(next,{stage:1,reason:'User Job Input changed after Stage 01 completion.'\"),'User Job Input edits do not reopen Stage 01.');",
    "assert(appSource.includes(\"hadStageOneActivity=engine.hasStageActivity(current,1)\")&&appSource.includes(\"invalidateStageForAuthorityChange(next,{stage:1,reason:'Authoritative User Job Input changed after Stage 01 work began.'\"),'User Job Input edits do not invalidate existing Stage 01 work.');",
)
text = text.replace(
    "assert(appSource.includes(\"invalidateStageForAuthorityChange(next,{stage,reason:'Human-owned stage input changed after completion.'\"),'Completed human-decision stages are not reopened when their authority changes.');",
    "assert(appSource.includes(\"hadActivity=engine.hasStageActivity(current,stage)\")&&appSource.includes(\"invalidateStageForAuthorityChange(next,{stage,reason:'Stage-specific human authority changed after stage work began.'\"),'Human-decision changes do not invalidate existing stage work.');",
)
marker = "// Explicit workflow gates cannot be bypassed by manual assertions."
block = """// Multi-operation operator review must remain bound to the selected operation/run lane.
{
  const appSource=fs.readFileSync('app-core.js','utf8');
  assert(appSource.includes('function operatorLaneMatches(item,n)'),'Operator review has no shared lane matcher.');
  assert(appSource.includes("filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,n))"),'Proposal rendering is still stage-wide.');
  assert(appSource.includes("filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,current.activeStage))"),'Accept/reject selection is still stage-wide.');
  assert(appSource.includes('operatorLaneMatches(validationLaneRecord(x),n)'),'Validation feedback is still stage-wide.');
  assert(appSource.includes('acceptedLaneChanges(n).length'),'Refinement control visibility is still stage-wide.');
}

"""
if "Operator review has no shared lane matcher" not in text:
    if text.count(marker) != 1:
        raise SystemExit("verify-complete lane marker mismatch")
    text = text.replace(marker, block + marker, 1)
p.write_text(text)

# Permanently prove that the validator obeys the effective contract text limit.
p = Path("verify-ingestion.mjs")
text = p.read_text()
marker = "console.log(JSON.stringify({persistedPromptAuthority:true,readableClarificationTargets:true,humanInputResponseExclusivity:true,choiceContractValidation:true,humanAnswerEdgeValidation:true,totalNegativeCases:negativeCount},null,2));"
check = """{
  const issues=[];
  ingestion.validateValue({valueType:'STRING',nullable:false,enumValues:[]},'12345','/contract-limit',issues,{maxTextFieldLength:4});
  if(!issues.some(x=>x.code==='TEXT_FIELD_TOO_LARGE'))throw new Error('Effective contract text-field limit is not enforced.');
}
"""
if "Effective contract text-field limit is not enforced" not in text:
    if text.count(marker) != 1:
        raise SystemExit("verify-ingestion limit marker mismatch")
    text = text.replace(marker, check + marker, 1)
p.write_text(text)

# Permanently prove that Stage 01 sees application-verified supplied artifact identity.
p = Path("verify-prompt-semantics.mjs")
text = p.read_text()
if "Stage 01 prompt omitted verified supplied artifact identity" not in text:
    text += """

// Stage 01 must receive the exact application-verified supplied artifact manifest.
{
 const p=baseProject();
 engine.registerArtifactBytes(p,{stage:1,artifactId:'ARTIFACT-PROMPT-INPUT',filename:'inputs/reference.step',mediaType:'model/step',byteSize:123,sha256:'a'.repeat(64),lineage:{stage:1,logicalPath:'inputs/reference.step'}});
 engine.recordHumanInputVersion(p,['SUPPLIED_ARTIFACT:ARTIFACT-PROMPT-INPUT'],'VERIFY');
 const prompt=prompts.buildPromptRecord(1,{...p,revision:Number(p.revision||0)+1}).prompt;
 if(!prompt.includes('ARTIFACT-PROMPT-INPUT')||!prompt.includes('inputs/reference.step')||!prompt.includes('a'.repeat(64)))throw new Error('Stage 01 prompt omitted verified supplied artifact identity.');
}
"""
p.write_text(text)

# Runtime script cache identity is a deterministic hash of the exact runtime Git blobs.
runtime_files = [
    "workbook.js", "hash.js", "workflow-schema.js", "workflow-engine.js",
    "prompt-engine.js", "response-ingestion.js", "project-store.js", "app-core.js",
]
def git_blob_sha(path):
    data = Path(path).read_bytes()
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
manifest = "".join(f"{name}:{git_blob_sha(name)}\n" for name in runtime_files)
token = "runtime-" + hashlib.sha256(manifest.encode()).hexdigest()[:16]
p = Path("index.html")
text = p.read_text()
text, count = re.subn(r"runtime-[0-9a-f]{16}", token, text)
if count != 8:
    raise SystemExit(f"runtime cache token update expected 8 scripts, found {count}")
p.write_text(text)
print(f"final proof repair applied; runtime identity {token}")
