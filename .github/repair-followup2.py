from pathlib import Path

path = Path('verify-ingestion.mjs')
text = path.read_text()

replacements = [
    (
        "{let p=project('JOB-PARALLEL-PROMPT-VALIDATION'),stage=17;p.revision=0;",
        "{let p=project('JOB-PARALLEL-PROMPT-VALIDATION'),stage=17;p.stages[16].status='COMPLETE';p.stages[16].gate={complete:true,blocked:false,reasons:[]};p.revision=0;",
    ),
    (
        "{let p=project('JOB-SCOPED-CLARIFICATION'),stage=17;p.revision=0;",
        "{let p=project('JOB-SCOPED-CLARIFICATION'),stage=17;p.stages[16].status='COMPLETE';p.stages[16].gate={complete:true,blocked:false,reasons:[]};p.revision=0;",
    ),
    (
        "  const p=project('JOB-RAW-SCOPE');\n  p.job.CURRENT_ITERATION='ITERATION-SCOPE-001';",
        "  const p=project('JOB-RAW-SCOPE');\n  p.stages[16].status='COMPLETE';p.stages[16].gate={complete:true,blocked:false,reasons:[]};\n  p.job.CURRENT_ITERATION='ITERATION-SCOPE-001';",
    ),
    (
        "  let p=project('JOB-NEG-OPERATION-STAGEDATA'),stage=17;const pr=",
        "  let p=project('JOB-NEG-OPERATION-STAGEDATA'),stage=17;p.stages[16].status='COMPLETE';p.stages[16].gate={complete:true,blocked:false,reasons:[]};const pr=",
    ),
]

for old, new in replacements:
    if old not in text:
        raise AssertionError(f'Direct Stage 17 fixture fragment was not found: {old}')
    text = text.replace(old, new, 1)

old = "const request=p.projectData.humanInputRequests.at(-1);p=ingestion.answerHumanInput(p,{[request.requestId]:'Exact run-specific answer'},{operator:'VERIFY'}).project;"
new = "const request=p.projectData.humanInputRequests.at(-1);p.stages[16].status='COMPLETE';p.stages[16].gate={complete:true,blocked:false,reasons:[]};p=ingestion.answerHumanInput(p,{[request.requestId]:'Exact run-specific answer'},{operator:'VERIFY'}).project;"
if old not in text:
    raise AssertionError('Scoped Stage 17 clarification regeneration fixture was not found.')
text = text.replace(old, new, 1)

old = "if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='STAGE_OPERATION_FIELD_VIOLATION'))throw new Error('EXECUTE_RUN accepted VERIFY stageData.');"
new = "if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='FIELD_OWNERSHIP_VIOLATION'))throw new Error('EXECUTE_RUN accepted an application-owned Stage 17 field.');"
if old not in text:
    raise AssertionError('The obsolete Stage 17 operation-field rejection assertion was not found.')
text = text.replace(old, new, 1)

path.write_text(text)
print('Bound direct Stage 17 fixtures to Stage 16 and aligned the negative assertion with the controlling application-ownership rejection.')
