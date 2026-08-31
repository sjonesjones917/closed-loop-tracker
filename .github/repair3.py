from pathlib import Path

# The isolated Stage 11 accepted-result refinement regression needs its local
# Stage 10 prerequisite immediately before each prompt build. Production
# prerequisite enforcement remains unchanged.
p=Path('verify-complete.mjs')
s=p.read_text()
old=" let p=project('JOB-SCOPED-ACCEPTED-REFINEMENT'),stage=11;const bytes=new TextEncoder().encode('refinement-candidate');"
new=" let p=project('JOB-SCOPED-ACCEPTED-REFINEMENT'),stage=11;p.stages[9].status='COMPLETE';p.stages[9].gate={complete:true};const bytes=new TextEncoder().encode('refinement-candidate');"
count=s.count(old)
if count==1:
    s=s.replace(old,new)
elif count==0 and new in s:
    pass
else:
    raise SystemExit(f'verify-complete.mjs: expected one Stage 09 prerequisite sentinel, found {count}')
old2=" const acceptLane=(slot,label)=>{const pr={...prompts.buildPromptRecord(stage,p,{scope:{runId:slot.runId,contextId:slot.contextId}}),generatedAt:new Date().toISOString()};"
new2=" const acceptLane=(slot,label)=>{p.stages[10].status='COMPLETE';p.stages[10].gate={complete:true};const pr={...prompts.buildPromptRecord(stage,p,{scope:{runId:slot.runId,contextId:slot.contextId}}),generatedAt:new Date().toISOString()};"
count2=s.count(old2)
if count2==1:
    s=s.replace(old2,new2)
elif count2==0 and new2 in s:
    pass
else:
    raise SystemExit(f'verify-complete.mjs: expected one Stage 10 scoped-lane prerequisite sentinel, found {count2}')
p.write_text(s)

# Prompt completeness must be checked against the actual generated prompt,
# whose selected context is the union of schema reads and prompt-engine context
# additions. `intentStatements` is not a canonical collection in /3; accepted
# Stage 01 intake is carried by PROJECT AUTHORITY BASIS.
p=Path('verify-stage-prompts-complete.mjs')
s=p.read_text()
old="engine.ensureShape(p);engine.recalculate(p);\nconst requiredReads={"
new="engine.ensureShape(p);engine.recalculate(p);for(let stage=1;stage<=30;stage++){p.stages[stage].status='COMPLETE';p.stages[stage].gate={complete:true,blocked:false,reasons:[]};}\nconst requiredReads={"
count=s.count(old)
if count==1:
    s=s.replace(old,new)
elif count==0 and new in s:
    pass
else:
    raise SystemExit(f'verify-stage-prompts-complete.mjs: expected one isolated prerequisite setup sentinel, found {count}')
old="1:['BLOCKING_NOW','ASK_NOW_NONBLOCKING','LATER_RESOLVABLE','every inputId exactly once']"
new="1:['BLOCKING_NOW','ASK_NOW_NONBLOCKING','LATER_RESOLVABLE','APPLICATION INTAKE MANIFEST unit exactly once']"
count=s.count(old)
if count==1:
    s=s.replace(old,new)
elif count==0 and new in s:
    pass
else:
    raise SystemExit(f'verify-stage-prompts-complete.mjs: expected one canonical Stage 01 phrase sentinel, found {count}')
old="  2:['intentStatements'],4:['sourceConflicts'],5:['intentStatements','sources','candidateRequirements'],6:['sources','research'],8:['sources','sourceConflicts'],9:['failureTests','requirementResolutions','sources','sourceConflicts'],10:['artifacts'],13:['tests'],14:['requirements','tests','instructions','runs','research','sources','artifacts','evidenceRecords'],15:['requirements','tests','runs','verification','artifacts','evidenceRecords'],16:['requirements','tests','instructions','runs','artifacts','evidenceRecords'],18:['requirements','tests','rootCauses','changes'],20:['artifacts'],21:['instructions','artifacts'],23:['research','evidenceRecords'],24:['sources','research','evidenceRecords','artifacts'],26:['requirements','tests','instructions','runs','verification','regressionExecutions','confirmationRecords','evidenceRecords'],27:['products','baselines','confirmationRecords','regressions','evidenceRecords'],29:['adversarialResults','representationInspections','regressions','regressionExecutions','processAudits','productAudits','evidenceChains'],30:['requirements','evidenceRecords']"
new="  2:[],4:['sourceConflicts'],5:['sources','candidateRequirements'],6:['sources','research'],8:['sources','sourceConflicts'],9:['failureTests','requirementResolutions','sources','sourceConflicts'],10:['artifacts'],13:['tests'],14:['requirements','tests','instructions','runs','research','sources','artifacts','evidenceRecords'],15:['requirements','tests','runs','verification','artifacts','evidenceRecords'],16:['requirements','tests','instructions','runs','artifacts','evidenceRecords'],18:['requirements','tests','rootCauses','changes'],20:['artifacts'],21:['instructions','artifacts'],23:['research','evidenceRecords'],24:['sources','research','evidenceRecords','artifacts'],26:['requirements','tests','instructions','runs','verification','regressionExecutions','confirmationRecords','evidenceRecords'],27:['products','baselines','confirmationRecords','regressions','evidenceRecords'],29:['adversarialResults','representationInspections','regressions','regressionExecutions','processAudits','productAudits','evidenceChains'],30:['requirements','evidenceRecords']"
count=s.count(old)
if count==1:
    s=s.replace(old,new)
elif count==0 and new in s:
    pass
else:
    raise SystemExit(f'verify-stage-prompts-complete.mjs: expected one requiredReads sentinel, found {count}')
old="    const op=schema.operationContract(stage,operation);\n    for(const needed of requiredReads[stage]||[])if(!op.readCollections.includes(needed))throw new Error(`Stage ${stage} ${operation} missing required read collection ${needed}.`);\n    const scope={runId:'RUN-001',contextId:'CTX-001',iterationId:'ITER-001',candidateId:'CAND-001',baselineId:'BASE-001',productId:'PROD-001'};\n    const prompt=prompts.buildPromptRecord(stage,p,{operation,scope}).prompt;"
new="    const op=schema.operationContract(stage,operation);\n    const scope={runId:'RUN-001',contextId:'CTX-001',iterationId:'ITER-001',candidateId:'CAND-001',baselineId:'BASE-001',productId:'PROD-001'};\n    const prompt=prompts.buildPromptRecord(stage,p,{operation,scope}).prompt;\n    for(const needed of requiredReads[stage]||[]){const heading=needed.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ').toUpperCase();if(!op.readCollections.includes(needed)&&!prompt.includes(`${heading}\\n`))throw new Error(`Stage ${stage} ${operation} missing required prompt context ${needed}.`);}\n    if([2,5].includes(stage)&&!prompt.includes('PROJECT AUTHORITY BASIS — HUMAN INTENT + CURRENT EXTERNAL REQUIREMENTS'))throw new Error(`Stage ${stage} ${operation} omitted the accepted Stage 01 authority basis.`);"
count=s.count(old)
if count==1:
    s=s.replace(old,new)
elif count==0 and new in s:
    pass
else:
    raise SystemExit(f'verify-stage-prompts-complete.mjs: expected one actual-prompt-context validation sentinel, found {count}')
p.write_text(s)
