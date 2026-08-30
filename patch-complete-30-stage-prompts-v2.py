from pathlib import Path
import ast,re

# Reuse the explicit 30-stage procedure dictionary from the first patch, but apply it
# structurally to whatever valid zero-loss transform has already produced.
source=Path('patch-complete-30-stage-prompts.py').read_text()
module=ast.parse(source)
stages=None
for node in module.body:
    if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='stages' for t in node.targets):
        stages=ast.literal_eval(node.value);break
if not isinstance(stages,dict) or set(stages)!=set(range(1,31)):
    raise SystemExit('Explicit 30-stage procedure dictionary is incomplete.')

p=Path('prompt-engine.js')
t=p.read_text()
ss=t.index('const stageSpecial=Object.freeze({')
ps=t.index('const procedures=',ss)
full='const stageSpecial=Object.freeze({'+','.join(f"{k}:{v!r}" for k,v in stages.items())+'});\n'
t=t[:ss]+full+t[ps:]

# Replace the entire procedure-dispatch section, regardless of its prior exact form.
ps=t.index('const procedures=',ss)
next_fn=t.index('function selectedContextRecords',ps)
ops="""const operationSpecial=Object.freeze({17:Object.freeze({FREEZE:'For this FREEZE operation, inspect the corrected controlled versions/change set supplied by the application and report only substantive freeze observations needed to form the new candidate. Do not execute a run yet.',EXECUTE_RUN:'For this EXECUTE_RUN operation, execute only the reserved current RUN_ID and CONTEXT_ID against the exact corrected frozen candidate. Do not use any other run output or reviewer result.',VERIFY:'For this VERIFY operation, execute only the application-listed currently missing corrected-iteration verification triples using each stored execution route and evidence requirement.',COMPARE:'For this COMPARE operation, compare the complete current corrected-iteration ten-run verification set and preserve every material agreement, disagreement, violation, unknown, and variance.',ROOT_CAUSE:'For this ROOT_CAUSE operation, root-cause every current material corrected-iteration defect to the earliest responsible layer with evidence.',REGRESSION:'For this REGRESSION operation, create and actually execute the required regression definitions and fixtures for confirmed corrected-iteration defects under the current allowed phase.',CORRECT:'For this CORRECT operation, propose only evidence-supported responsible-layer corrections for the current confirmed RCA records; do not execute unrelated reruns in this operation.'}),19:Object.freeze({CONFIRM_FREEZE:'For this semantic freeze-confirmation operation, inspect the exact converged candidate versions and hashes supplied by the application and report any substantive reason they are not unchanged. Do not create a new candidate or execute runs here.',EXECUTE_RUN:'For this EXECUTE_RUN operation, execute only the reserved current confirmation RUN_ID and CONTEXT_ID using the exact unchanged package and no prior-run outputs.',VERIFY:'For this VERIFY operation, execute only the application-listed missing confirmation verification triples using the complete current suite and independent/evidence rules.',COMPARE:'For this COMPARE operation, compare all ten current confirmation runs and preserve every new disagreement, violation, unknown, defect, or correctness-affecting variance.',REGRESSION_VERIFY:'For this REGRESSION_VERIFY operation, execute every application-listed active applicable regression against the unchanged candidate and preserve actual results and sufficient evidence.',CONFIRM:'For this CONFIRM operation, report substantive confirmation observations only after all required execution, verification, comparison, and regression work is present. The application derives the final confirmation result.'})});
const procedures=Object.freeze(Object.fromEntries(core.STAGES.map(stage=>[stage.number,stageSpecial[stage.number]])));
function procedureFor(stage,operation){const base=procedures[stage];if(!base)throw new Error(`No explicit prompt procedure exists for Stage ${stage}.`);const extra=operationSpecial?.[stage]?.[operation];return extra?`${base} CURRENT OPERATION SUBCONTRACT: ${extra}`:base;}
"""
t=t[:ps]+ops+t[next_fn:]

if '${procedures[stage]}' in t:
    t=t.replace('${procedures[stage]}','${procedureFor(stage,operation)}',1)
elif '${procedureFor(stage,operation)}' not in t:
    raise SystemExit('Stage procedure interpolation was not found.')

# Explicit prior-stage stage-data dependencies. Record-level context remains controlled by
# operation readCollections; isolated reviewer stages deliberately have no generic snapshots.
if 'const priorStageDependencies=' not in t:
    cf=t.index('function contextFor(')
    deps={2:[1],3:[1,2],4:[1,3],5:[4],6:[4,5],7:[4,6],8:[4,5,6,7],9:[8],10:[8,9],11:[10],12:[],13:[12],14:[12,13],15:[14],16:[14,15],17:[16],18:[17],19:[18],20:[19],21:[20],22:[21],23:[],24:[],25:[20,21],26:[20,21,22,23,24,25],27:[26],28:[27],29:[27,28],30:[15,20,29]}
    depjs='const priorStageDependencies=Object.freeze('+str(deps).replace("'",'"')+');\nfunction priorStageSnapshotBlock(stage,state){const ids=priorStageDependencies[stage]||[];if(!ids.length)return null;return ids.map(n=>{const s=state?.stages?.[n-1]||{};return `STAGE ${String(n).padStart(2,\'0\')} CURRENT ACCEPTED SNAPSHOT\\n${show({agentData:s.agentData||s.acceptedData||{},humanData:s.humanData||{},derivedData:s.derivedData||{}})}`;}).join(\'\\n\\n\');}\n'
    t=t[:cf]+depjs+t[cf:]

# Inject dependency snapshots exactly once at context construction.
ctx='function contextFor(stage,state,operation,scope={}){'
idx=t.index(ctx)+len(ctx)
if 'priorStageSnapshotBlock(stage,state)' not in t[idx:idx+400]:
    inject="const priorSnapshots=priorStageSnapshotBlock(stage,state);if(priorSnapshots)parts.push(`REQUIRED PRIOR-STAGE PROJECT DATA — APPLICATION SELECTED\\n${priorSnapshots}`);"
    # contextFor begins by declaring parts. Insert after that declaration.
    marker='const parts=[];'
    m=t.index(marker,idx)
    if m>idx+200: raise SystemExit('contextFor parts declaration not found near function start.')
    m+=len(marker);t=t[:m]+inject+t[m:]

# Eliminate the old unrestricted immediate-prior-stage injection; explicit dependency matrix controls it.
t=re.sub(r"if\(stage>1&&!\[11,12,23,24\]\.includes\(stage\)\)\{const prior=.*?parts\.push\(`PRIOR STAGE DECISION AND ACCEPTED DATA\\n\$\{show\(prior\)\}`\);\}","",t,count=1,flags=re.S)

# Permanent verifier needs the exact procedure used by generation.
export='globalThis.closedLoopPromptEngine=Object.freeze({'
if export not in t: raise SystemExit('Prompt-engine export object not found.')
pos=t.index(export)+len(export)
if 'procedureFor,' not in t[pos:pos+300]: t=t[:pos]+'procedureFor,'+t[pos:]

# Hard fail if any stage still has generic fallback behavior.
if 'Perform only Stage ${String(stage.number).padStart(2' in t:
    raise SystemExit('Generic stage prompt fallback remains.')
for n in range(1,31):
    if n not in stages or not stages[n].strip(): raise SystemExit(f'Stage {n} procedure missing.')
p.write_text(t)
