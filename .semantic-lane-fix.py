from pathlib import Path
import hashlib,re

p=Path('prompt-engine.js')
s=p.read_text()
anchor="""};
const recordId=(record,collection)=>String(record?.id||record?.recordId||record?.[schema.RECORD_SCHEMAS[collection]?.idField]||record?.fields?.[schema.RECORD_SCHEMAS[collection]?.idField]||'UNKNOWN');
"""
if anchor not in s:
    raise SystemExit('prompt-engine insertion anchor missing')
insert="""};
const operationProcedures=Object.freeze({
  11:Object.freeze({
    COMPLETE:'Execute only the single application-reserved RUN_ID and CONTEXT_ID named in this controlling prompt. This prompt is one execution lane of the ten-run batch; the application coordinates the other nine lanes separately. Use the exact frozen candidate and authorized context for this lane, do not inspect or aggregate another run’s output, and report this run’s complete output, contamination state, tool configuration, actual failures, substantive observations, and evidence. Echo the supplied run/context identities exactly; do not create replacements or claim that any other run was executed.'
  }),
  17:Object.freeze({
    FREEZE:'Review only the application-assigned corrected iteration/candidate freeze for completeness, exact component identity, and executability. Do not execute a run, verify outputs, compare runs, perform RCA, execute regressions, or propose a further correction in this operation.',
    EXECUTE_RUN:'Execute only the single application-reserved RUN_ID and CONTEXT_ID named in this controlling prompt. This prompt is one lane of the corrected ten-run batch; the application coordinates the other nine lanes separately. Use the exact corrected frozen candidate, withhold every other run output and prior failure explanation, and report only this run’s complete output, contamination state, actual tool failures, substantive observations, and evidence. Do not perform verification, cross-run comparison, RCA, regression analysis, or correction in this operation.',
    VERIFY:'Verify only the single application-reserved RUN_ID and CONTEXT_ID named in this controlling prompt against every applicable current requirement/test pair for that run. Preserve independent verifier identity, procedure, expected and observed result, evidence, determination, and any defect reference. Do not execute a new production run, compare multiple runs, perform RCA, define regressions, or propose corrections in this operation.',
    COMPARE:'Compare the ten already accepted corrected-iteration runs requirement-by-requirement using their accepted verification evidence. Identify every correctness-affecting variance, repeated or unique failure pattern, inconclusive result, linked defect, and supporting evidence. Do not execute or re-verify a run, perform RCA, define regressions, or propose corrections in this operation.',
    ROOT_CAUSE:'Perform root-cause analysis only for the material defects established by the corrected-iteration comparison/verification evidence. Identify the earliest defective layer, causal chain, affected artifacts, required downstream rework, and evidence. Do not execute runs, compare the batch again, define regression tests, or propose the correction itself in this operation.',
    REGRESSION:'For every confirmed defect requiring regression coverage, propose the permanent regression definition and record only regression executions that actually occurred in the current corrected iteration with evidence. Do not claim an unexecuted regression result, execute production runs, repeat comparison/RCA, or propose the responsible-layer correction in this operation.',
    CORRECT:'Propose only the responsible earliest-layer correction required by the current accepted defect/RCA/regression evidence, including affected controlled artifacts and required reruns/revalidation. Do not claim the correction has already been executed, verified, converged, or confirmed unchanged; those results require later controlled operations.'
  }),
  19:Object.freeze({
    EXECUTE_RUN:'Execute only the single application-reserved RUN_ID and CONTEXT_ID named in this controlling prompt. This prompt is one lane of the ten-run unchanged-confirmation batch; the application coordinates the other nine lanes separately. Use the exact unchanged converged candidate and hashes, withhold every other run output, and report only this run’s complete output, contamination state, actual failures, substantive observations, and evidence. Do not verify, compare, regression-check, or confirm the full batch in this operation.',
    VERIFY:'Verify only the single application-reserved RUN_ID and CONTEXT_ID named in this controlling prompt against every applicable current requirement/test pair for that run. Preserve independent verification evidence and determination. Do not execute a new production run, compare the ten-run batch, execute the regression suite, or declare unchanged confirmation in this operation.',
    COMPARE:'Compare the ten already accepted unchanged-confirmation runs using their accepted verification evidence. Identify any new defect, missed requirement, missed failure case, correctness-affecting variance, or unexplained difference. Do not execute or re-verify runs, execute regressions, or declare final confirmation in this operation.',
    REGRESSION_VERIFY:'Evaluate every current applicable permanent regression against the accepted unchanged-confirmation evidence and record only regression executions that actually occurred, with evidence. Do not claim unexecuted checks, create new production runs, repeat the cross-run comparison, or declare final unchanged confirmation in this operation.',
    CONFIRM:'Review only the already accepted unchanged-confirmation run, verification, comparison, regression, and frozen-candidate evidence and report the substantive confirmation finding. Do not execute, re-verify, or alter the candidate in this operation. The application, not the agent, determines whether the complete unchanged-confirmation gate is satisfied.'
  })
});
function procedureFor(stage,operation){return operationProcedures[stage]?.[operation]||procedures[stage];}
const recordId=(record,collection)=>String(record?.id||record?.recordId||record?.[schema.RECORD_SCHEMAS[collection]?.idField]||record?.fields?.[schema.RECORD_SCHEMAS[collection]?.idField]||'UNKNOWN');
"""
s=s.replace(anchor,insert,1)
old='${procedures[stage]}'
if old not in s:
    raise SystemExit('stage procedure interpolation anchor missing')
s=s.replace(old,'${procedureFor(stage,operation)}',1)
p.write_text(s)

v=Path('verify-prompt-semantics.mjs')
t=v.read_text()
marker="""if(!core.STAGES[11].completionGate.some(x=>x.includes('REQ_ID × RUN_ID × TEST_ID')))throw new Error('Stage 12 completion language is not the exact verification triple.');
"""
if marker not in t:
    raise SystemExit('semantic verifier insertion anchor missing')
extra="""// Run-scoped prompts must describe exactly one execution/verification lane, while aggregate operations must not tell one agent to perform the whole lifecycle.\n{\n const p=baseProject();\n const s11=prompts.buildPromptRecord(11,p,{operation:'COMPLETE',scope:{projectRevision:0,inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001',testSuiteVersion:'TEST-SUITE-v001',instructionVersion:'INSTRUCTION-v001',iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001',runId:'RUN-000001',contextId:'CONTEXT-000001'}});\n const task=r=>r.prompt.split('STAGE-SPECIFIC TASK\\n')[1].split('\\n\\nPERMITTED AGENT-OWNED STAGE DATA')[0];\n if(!task(s11).includes('single application-reserved RUN_ID and CONTEXT_ID')||!task(s11).includes('one execution lane of the ten-run batch'))throw new Error('Stage 11 run-scoped prompt still describes the whole ten-run batch as one agent task.');\n const scope={projectRevision:0,inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001',testSuiteVersion:'TEST-SUITE-v001',instructionVersion:'INSTRUCTION-v001',iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001',runId:'RUN-000001',contextId:'CONTEXT-000001'};\n const s17run=task(prompts.buildPromptRecord(17,p,{operation:'EXECUTE_RUN',scope}));\n const s17verify=task(prompts.buildPromptRecord(17,p,{operation:'VERIFY',scope}));\n const s17compare=task(prompts.buildPromptRecord(17,p,{operation:'COMPARE',scope}));\n if(!s17run.includes('one lane of the corrected ten-run batch')||!s17run.includes('Do not perform verification'))throw new Error('Stage 17 EXECUTE_RUN operation is not isolated to one execution lane.');\n if(!s17verify.includes('Verify only the single application-reserved RUN_ID and CONTEXT_ID')||!s17verify.includes('Do not execute a new production run'))throw new Error('Stage 17 VERIFY operation is not isolated to its verification lane.');\n if(!s17compare.includes('ten already accepted corrected-iteration runs')||!s17compare.includes('Do not execute or re-verify a run'))throw new Error('Stage 17 COMPARE operation still asks the agent to perform other operations.');\n const s19run=task(prompts.buildPromptRecord(19,p,{operation:'EXECUTE_RUN',scope}));\n const s19confirm=task(prompts.buildPromptRecord(19,p,{operation:'CONFIRM',scope}));\n if(!s19run.includes('one lane of the ten-run unchanged-confirmation batch')||!s19run.includes('Do not verify, compare, regression-check'))throw new Error('Stage 19 EXECUTE_RUN operation is not isolated to one execution lane.');\n if(!s19confirm.includes('Review only the already accepted unchanged-confirmation')||!s19confirm.includes('The application, not the agent, determines'))throw new Error('Stage 19 CONFIRM operation overstates the agent role.');\n}\n\n"""
t=t.replace(marker,extra+marker,1)
v.write_text(t)

# Runtime cache token is a digest of the exact runtime Git blobs. Recompute it after prompt-engine changes.
runtime=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def git_blob_sha(path):
    b=Path(path).read_bytes()
    return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
manifest=''.join(f'{f}:{git_blob_sha(f)}\n' for f in runtime).encode()
token='runtime-'+hashlib.sha256(manifest).hexdigest()[:16]
h=Path('index.html')
html=h.read_text()
html=re.sub(r'(?<=\\?v=)runtime-[0-9a-f]{16}',token,html)
h.write_text(html)
print(token)
