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

path.write_text(text)
print('Bound every direct Stage 17 ingestion fixture to an explicitly completed Stage 16 predecessor.')
